import { test, expect, chromium } from "@playwright/test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const channel =
  process.env.PINORA_TEST_CHANNEL === "msedge" ? "msedge" : "chromium";
test("settings retry reloads settings and recovery backs up before resetting", async () => {
  const profile = await mkdtemp(
    path.join(tmpdir(), "pinora-settings-recovery-"),
  );
  const extension = path.join(process.cwd(), "dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel,
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  try {
    const page = await context.newPage();
    await page.goto(
      channel === "msedge" ? "edge://newtab/" : "chrome://newtab/",
    );
    await expect(page.locator(".loading-ring")).toHaveCount(0);
    const unsupported = { schemaVersion: 99, theme: "dark", future: "keep me" };
    await page.evaluate(async (raw) => {
      await chrome.storage.local.set({ "pinora.settings": raw });
    }, unsupported);
    await page.reload();
    await expect(page.locator(".error-banner")).toContainText(
      "设置版本尚不受支持",
    );
    await page.evaluate(() => {
      const original: (key: string) => Promise<Record<string, unknown>> =
        chrome.storage.local.get.bind(chrome.storage.local);
      const state = window as Window & { settingsReads?: number };
      state.settingsReads = 0;
      chrome.storage.local.get = ((key: string) => {
        if (key === "pinora.settings")
          state.settingsReads = (state.settingsReads ?? 0) + 1;
        return original(key);
      }) as typeof chrome.storage.local.get;
    });
    await page.getByRole("button", { name: "重试读取", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as Window & { settingsReads?: number }).settingsReads,
        ),
      )
      .toBeGreaterThan(0);
    expect(
      await page.evaluate(
        async () =>
          (await chrome.storage.local.get("pinora.settings"))[
            "pinora.settings"
          ],
      ),
    ).toEqual(unsupported);
    await page.evaluate(async () => {
      await chrome.storage.local.set({
        "pinora.settings": { schemaVersion: 1, theme: "dark" },
      });
    });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator(".error-banner")).toHaveCount(0);

    await page.evaluate(async (raw) => {
      await chrome.storage.local.set({ "pinora.settings": raw });
    }, unsupported);
    await page
      .getByRole("button", { name: "恢复默认设置…", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "恢复默认设置",
      exact: true,
    });
    await dialog.getByRole("button", { name: "取消", exact: true }).click();
    expect(
      await page.evaluate(
        async () =>
          (await chrome.storage.local.get("pinora.settings"))[
            "pinora.settings"
          ],
      ),
    ).toEqual(unsupported);
    await page
      .getByRole("button", { name: "恢复默认设置…", exact: true })
      .click();
    await page.evaluate(() => {
      const original = chrome.storage.local.set.bind(chrome.storage.local);
      chrome.storage.local.set = ((items: object) => {
        if ("pinora.settings.recovery" in items) {
          chrome.storage.local.set = original;
          return Promise.reject(new Error("injected backup failure"));
        }
        return original(items);
      }) as typeof chrome.storage.local.set;
    });
    await dialog
      .getByRole("button", { name: "备份并恢复默认", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toContainText(
      "injected backup failure",
    );
    expect(
      await page.evaluate(
        async () =>
          (await chrome.storage.local.get("pinora.settings"))[
            "pinora.settings"
          ],
      ),
    ).toEqual(unsupported);
    await dialog
      .getByRole("button", { name: "备份并恢复默认", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    const stored = await page.evaluate(async () =>
      chrome.storage.local.get(["pinora.settings", "pinora.settings.recovery"]),
    );
    expect(stored["pinora.settings.recovery"]).toEqual(unsupported);
    expect(stored["pinora.settings"]).toMatchObject({
      schemaVersion: 1,
      theme: "light",
      iconMappings: {},
    });
    await expect(page.locator(".error-banner")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("delayed icon cleanup errors appear immediately and clear after retry", async () => {
  const profile = await mkdtemp(path.join(tmpdir(), "pinora-cleanup-error-"));
  const extension = path.join(process.cwd(), "dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel,
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  try {
    const page = await context.newPage();
    await page.goto(
      channel === "msedge" ? "edge://newtab/" : "chrome://newtab/",
    );
    await expect(page.locator(".loading-ring")).toHaveCount(0);
    await page.evaluate(async () => {
      await chrome.storage.local.set({
        "pinora.settings": {
          schemaVersion: 1,
          iconMappings: { missing: "missing-image" },
        },
      });
      const original = chrome.storage.local.set.bind(chrome.storage.local);
      chrome.storage.local.set = ((items: object) => {
        if ("pinora.settings" in items) {
          chrome.storage.local.set = original;
          return new Promise<void>((_resolve, reject) => {
            (window as Window & { failCleanup?: () => void }).failCleanup =
              () => reject(new Error("injected delayed cleanup"));
          });
        }
        return original(items);
      }) as typeof chrome.storage.local.set;
      const [root] = await chrome.bookmarks.getTree();
      await chrome.bookmarks.create({
        parentId: root.children![0].id,
        title: "Cleanup trigger",
        url: "https://example.test/",
      });
    });
    await page.waitForFunction(
      () =>
        typeof (window as Window & { failCleanup?: () => void }).failCleanup ===
        "function",
    );
    await expect(
      page.locator(".tile-title").getByText("Cleanup trigger", { exact: true }),
    ).toBeVisible();
    await page.evaluate(() =>
      (window as Window & { failCleanup?: () => void }).failCleanup?.(),
    );
    await expect(page.locator(".error-banner")).toContainText(
      "injected delayed cleanup",
    );
    await page.getByRole("button", { name: "重试读取", exact: true }).click();
    await expect(page.locator(".error-banner")).toHaveCount(0);
    expect(
      await page.evaluate(
        async () =>
          (await chrome.storage.local.get("pinora.settings"))["pinora.settings"]
            .iconMappings,
      ),
    ).toEqual({});
  } finally {
    await context.close();
  }
});

test("a real storage event supersedes an artificially delayed initial read", async () => {
  const profile = await mkdtemp(path.join(tmpdir(), "pinora-settings-order-"));
  const extension = path.join(process.cwd(), "dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel,
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  try {
    const page = await context.newPage();
    await page.goto(
      channel === "msedge" ? "edge://newtab/" : "chrome://newtab/",
    );
    await expect(page.locator(".loading-ring")).toHaveCount(0);
    await page.addInitScript(() => {
      if (typeof chrome === "undefined" || !chrome.storage) return;
      const original: (key: string) => Promise<Record<string, unknown>> =
        chrome.storage.local.get.bind(chrome.storage.local);
      let first = true;
      chrome.storage.local.get = ((key: string) => {
        if (key !== "pinora.settings" || !first) return original(key);
        first = false;
        return original(key).then(
          (raw) =>
            new Promise<Record<string, unknown>>((resolve) => {
              (window as Window & { releaseRead?: () => void }).releaseRead =
                () => resolve(raw);
            }),
        );
      }) as typeof chrome.storage.local.get;
    });
    await page.reload();
    await page.waitForFunction(
      () =>
        typeof (window as Window & { releaseRead?: () => void }).releaseRead ===
        "function",
    );
    await page.evaluate(async () => {
      await chrome.storage.local.set({
        "pinora.settings": { schemaVersion: 1, theme: "dark" },
      });
    });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.evaluate(() =>
      (window as Window & { releaseRead?: () => void }).releaseRead?.(),
    );
    await expect(page.locator(".loading-ring")).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("alert")).toHaveCount(0);
  } finally {
    await context.close();
  }
});
