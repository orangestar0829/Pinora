import { test, expect, chromium, type Page } from "@playwright/test";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type PermissionKind = "history" | "topSites";
type PermissionListener = (permissions: chrome.permissions.Permissions) => void;
declare global {
  interface Window {
    permissionTest: {
      granted: Record<PermissionKind, boolean>;
      hold: PermissionKind | null;
      fail: PermissionKind | null;
      checks: Array<{
        kind: PermissionKind;
        resolve: (value: boolean) => void;
      }>;
      requests: Array<{
        kind: PermissionKind;
        resolve: (value: boolean) => void;
        reject: (reason: Error) => void;
      }>;
      removed: Set<PermissionListener>;
    };
  }
}

const channel =
  process.env.PINORA_TEST_CHANNEL === "msedge" ? "msedge" : "chromium";

async function launch(retainGrants = false) {
  await mkdir(".test-profiles", { recursive: true });
  const profile = await mkdtemp(
    path.join(process.cwd(), ".test-profiles", "permission-settings-"),
  );
  let extension = path.join(process.cwd(), "dist");
  if (retainGrants) {
    extension = path.join(profile, "extension");
    await cp(path.join(process.cwd(), "dist"), extension, { recursive: true });
  }
  const start = () =>
    chromium.launchPersistentContext(profile, {
      channel,
      headless: true,
      viewport: { width: 1440, height: 1000 },
      args: [
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
      ],
    });
  if (retainGrants) {
    // Bootstrap grants in a disposable copy, then restore optional permissions
    // at the same extension path/profile. Never modify the production dist.
    const manifestPath = path.join(extension, "manifest.json");
    const original = await readFile(manifestPath, "utf8");
    const manifest = JSON.parse(original);
    manifest.permissions.push("history", "topSites");
    delete manifest.optional_permissions;
    await writeFile(manifestPath, JSON.stringify(manifest));
    const bootstrap = await start();
    try {
      const page = await openPage(bootstrap);
      expect(
        await page.evaluate(() =>
          chrome.permissions.contains({
            permissions: ["history", "topSites"],
          }),
        ),
      ).toBe(true);
    } finally {
      await bootstrap.close();
      await writeFile(manifestPath, original);
    }
  }
  return start();
}

async function openPage(context: Awaited<ReturnType<typeof launch>>) {
  const page = await context.newPage();
  await page.goto(channel === "msedge" ? "edge://newtab/" : "chrome://newtab/");
  await expect(page.locator(".loading-ring")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "外观与设置", exact: true }),
  ).toBeVisible();
  return page;
}

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "外观与设置", exact: true }).click();
  await page.getByRole("button", { name: "布局", exact: true }).click();
}

function row(page: Page, kind: PermissionKind) {
  return page.locator(".content-setting").filter({
    hasText: kind === "history" ? "历史记录" : "热门网站",
  });
}

async function installRaceStubs(page: Page) {
  await page.evaluate(async () => {
    const key = "pinora.settings";
    const settings = (await chrome.storage.local.get(key))[key];
    await chrome.storage.local.set({
      [key]: { ...settings, showRecentVisits: false, showTopSites: false },
    });
  });
  await expect(page.locator(".recent-visits, .top-sites")).toHaveCount(0);
  // Only the race tests stub browser APIs/events. These are deliberately
  // controlled promises, not evidence of accepting native permission prompts.
  await page.evaluate(() => {
    const state: Window["permissionTest"] = {
      granted: { history: false, topSites: false },
      hold: null,
      fail: null,
      checks: [],
      requests: [],
      removed: new Set(),
    };
    window.permissionTest = state;
    chrome.permissions.contains = ((
      permissions: chrome.permissions.Permissions,
    ) => {
      const kind = permissions.permissions![0] as PermissionKind;
      if (state.hold === kind) {
        state.hold = null;
        return new Promise<boolean>((resolve) =>
          state.checks.push({ kind, resolve }),
        );
      }
      if (state.fail === kind)
        return Promise.reject(new Error("fixture check failure"));
      return Promise.resolve(state.granted[kind]);
    }) as typeof chrome.permissions.contains;
    chrome.permissions.request = ((
      permissions: chrome.permissions.Permissions,
    ) => {
      const kind = permissions.permissions![0] as PermissionKind;
      return new Promise<boolean>((resolve, reject) => {
        state.requests.push({ kind, resolve, reject });
      });
    }) as typeof chrome.permissions.request;
    chrome.permissions.onRemoved.addListener = (listener) => {
      state.removed.add(listener);
    };
    chrome.permissions.onRemoved.removeListener = (listener) => {
      state.removed.delete(listener);
    };
  });
}

test("open settings follow native history and topSites revocation", async () => {
  const context = await launch(true);
  try {
    const page = await openPage(context);
    const peer = await context.newPage();
    await peer.goto(page.url());
    await page.bringToFront();
    await openSettings(page);
    for (const kind of ["history", "topSites"] as const) {
      const setting = row(page, kind);
      await expect(setting.locator(".permission-status")).toHaveText("已授权");
      expect(
        await peer.evaluate(
          (permission) =>
            chrome.permissions.remove({
              permissions: [permission],
            }),
          kind,
        ),
      ).toBe(true);
      // No focus event or modal reopen: the real native onRemoved must refresh it.
      await expect(setting.locator(".permission-status")).toHaveText("未授权");
      await expect(
        setting.getByRole("button", { name: "获取权限", exact: true }),
      ).toBeEnabled();
      expect(
        await page.evaluate(
          (permission) =>
            chrome.permissions.contains({
              permissions: [permission],
            }),
          kind,
        ),
      ).toBe(false);
    }
  } finally {
    await context.close();
  }
});

test("permission races preserve pending and latest state; query failures stay isolated", async () => {
  const context = await launch();
  try {
    const page = await openPage(context);
    await installRaceStubs(page);
    await openSettings(page);
    for (const kind of ["history", "topSites"] as const) {
      const setting = row(page, kind);
      await expect(setting.locator(".permission-status")).toHaveText("未授权");
      await page.evaluate((permission) => {
        window.permissionTest.hold = permission;
        window.dispatchEvent(new Event("focus"));
      }, kind);
      await expect
        .poll(() => page.evaluate(() => window.permissionTest.checks.length))
        .toBe(1);
      await setting
        .getByRole("button", { name: "获取权限", exact: true })
        .click();
      await page.evaluate((permission) => {
        const state = window.permissionTest;
        state.checks.shift()!.resolve(true);
        for (const listener of state.removed)
          listener({ permissions: [permission] });
        window.dispatchEvent(new Event("focus"));
      }, kind);
      await expect(setting.locator(".permission-status")).toHaveText(
        "等待授权…",
      );
      await expect(
        setting.getByRole("button", { name: "授权中…", exact: true }),
      ).toBeDisabled();
      expect(
        await page.evaluate(() => window.permissionTest.requests.length),
      ).toBe(1);
      // Request success can already be stale: contains still says revoked.
      await page.evaluate(() =>
        window.permissionTest.requests.shift()!.resolve(true),
      );
      await expect(setting.locator(".permission-status")).toHaveText("未授权");

      await page.evaluate((permission) => {
        window.permissionTest.granted[permission] = true;
        window.dispatchEvent(new Event("focus"));
      }, kind);
      await expect(setting.locator(".permission-status")).toHaveText("已授权");
      await page.evaluate((permission) => {
        const state = window.permissionTest;
        state.hold = permission;
        window.dispatchEvent(new Event("focus"));
        state.granted[permission] = false;
        for (const listener of state.removed)
          listener({ permissions: [permission] });
      }, kind);
      await expect(setting.locator(".permission-status")).toHaveText("未授权");
      await page.evaluate(() =>
        window.permissionTest.checks.shift()!.resolve(true),
      );
      await expect(setting.locator(".permission-status")).toHaveText("未授权");
    }
    await page.evaluate(() => {
      window.permissionTest.fail = "history";
      window.permissionTest.granted.topSites = true;
      window.dispatchEvent(new Event("focus"));
    });
    await expect(row(page, "history").locator(".permission-status")).toHaveText(
      "检查失败",
    );
    await expect(
      row(page, "topSites").locator(".permission-status"),
    ).toHaveText("已授权");
  } finally {
    await context.close();
  }
});

test("closing settings disposes subscriptions and ignores old checks and requests", async () => {
  const context = await launch();
  try {
    const page = await openPage(context);
    await installRaceStubs(page);
    await openSettings(page);
    await expect(row(page, "history").locator(".permission-status")).toHaveText(
      "未授权",
    );
    await page.evaluate(() => {
      window.permissionTest.hold = "topSites";
      window.dispatchEvent(new Event("focus"));
    });
    await row(page, "history")
      .getByRole("button", { name: "获取权限", exact: true })
      .click();
    await page.getByRole("button", { name: "关闭", exact: true }).click();
    expect(await page.evaluate(() => window.permissionTest.removed.size)).toBe(
      0,
    );
    await openSettings(page);
    await expect(page.locator(".permission-status")).toHaveText([
      "未授权",
      "未授权",
    ]);
    expect(await page.evaluate(() => window.permissionTest.removed.size)).toBe(
      2,
    );
    await page.evaluate(() => {
      const state = window.permissionTest;
      state.checks.shift()!.resolve(true);
      state.requests.shift()!.reject(new Error("obsolete request failure"));
    });
    await expect(page.locator(".permission-status")).toHaveText([
      "未授权",
      "未授权",
    ]);
    await expect(page.locator(".settings-panel .form-error")).toHaveCount(0);
  } finally {
    await context.close();
  }
});
