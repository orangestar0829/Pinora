import { test, expect, chromium } from "@playwright/test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const channel =
  process.env.PINORA_TEST_CHANNEL === "msedge" ? "msedge" : "chromium";
const metadataKey = "__pinora_unreferenced_assets__";
test("asset collection respects grace, recovery references and pending commits", async () => {
  const profile = await mkdtemp(path.join(tmpdir(), "pinora-asset-gc-"));
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
    await page.getByRole("button", { name: "外观与设置", exact: true }).click();
    await page.getByRole("button", { name: "背景", exact: true }).click();
    await page.getByLabel("背景类型").selectOption("image");
    const upload = {
      name: "wall.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#638574"/></svg>',
      ),
    };
    const currentAsset = () =>
      page.evaluate(
        async () =>
          (await chrome.storage.local.get("pinora.settings"))["pinora.settings"]
            .background.assetId as string | null,
      );
    await page.getByLabel("上传壁纸").setInputFiles(upload);
    await expect.poll(currentAsset).toBeTruthy();
    const first = (await currentAsset())!;
    await expect(
      page.getByRole("button", { name: "选择本地图片", exact: true }),
    ).toBeEnabled();
    await page.getByLabel("上传壁纸").setInputFiles(upload);
    await expect.poll(currentAsset).not.toBe(first);
    const current = (await currentAsset())!;
    await page.evaluate(
      async ({ first, current, metadataKey }) => {
        await navigator.locks.request("pinora.assets", async () => {
          await chrome.storage.local.set({
            "pinora.settings.recovery": {
              schemaVersion: 99,
              future: { image: "recovery-image" },
            },
          });
          await new Promise<void>((resolve, reject) => {
            const open = indexedDB.open("pinora-assets", 1);
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const db = open.result;
              const tx = db.transaction("assets", "readwrite");
              const store = tx.objectStore("assets");
              const blob = store.get(current);
              blob.onsuccess = () => {
                for (const key of [
                  "expired-orphan",
                  "fresh-orphan",
                  "recovery-image",
                ])
                  store.put(blob.result, key);
                const old = Date.now() - 25 * 60 * 60 * 1000;
                store.put(
                  {
                    [first]: old,
                    [current]: old,
                    "expired-orphan": old,
                    "recovery-image": old,
                  },
                  metadataKey,
                );
              };
              tx.oncomplete = () => {
                db.close();
                resolve();
              };
              tx.onabort = () => {
                db.close();
                reject(tx.error);
              };
            };
          });
        });
      },
      { first, current, metadataKey },
    );
    const keys = () =>
      page.evaluate(
        () =>
          new Promise<string[]>((resolve, reject) => {
            const open = indexedDB.open("pinora-assets", 1);
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const db = open.result;
              const tx = db.transaction("assets");
              const request = tx.objectStore("assets").getAllKeys();
              tx.oncomplete = () => {
                db.close();
                resolve(request.result as string[]);
              };
              tx.onabort = () => {
                db.close();
                reject(tx.error);
              };
            };
          }),
      );
    await page.reload();
    await expect.poll(keys).not.toContain("expired-orphan");
    expect(await keys()).not.toContain(first);
    expect(await keys()).toEqual(
      expect.arrayContaining([current, "fresh-orphan", "recovery-image"]),
    );
    await expect(page.locator(".wallpaper-layer")).toHaveCSS(
      "background-image",
      /blob:/,
    );

    // Hold the same lock as a media write between its blob and mapping commits.
    await page.evaluate(() => {
      void navigator.locks.request(
        "pinora.assets",
        () =>
          new Promise<void>((resolve) => {
            (window as Window & { releaseAsset?: () => void }).releaseAsset =
              resolve;
          }),
      );
    });
    await page.waitForFunction(
      () =>
        typeof (window as Window & { releaseAsset?: () => void })
          .releaseAsset === "function",
    );
    await page.evaluate(
      async ({ current, metadataKey }) => {
        await new Promise<void>((resolve, reject) => {
          const open = indexedDB.open("pinora-assets", 1);
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction("assets", "readwrite");
            const store = tx.objectStore("assets");
            const blob = store.get(current);
            blob.onsuccess = () => {
              store.put(blob.result, "pending-image");
              store.put(blob.result, "expired-second");
              store.put(blob.result, "unknown-current-image");
              const old = Date.now() - 25 * 60 * 60 * 1000;
              store.put(
                {
                  "pending-image": old,
                  "expired-second": old,
                  "unknown-current-image": old,
                },
                metadataKey,
              );
            };
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onabort = () => {
              db.close();
              reject(tx.error);
            };
          };
        });
        const stored = (await chrome.storage.local.get("pinora.settings"))[
          "pinora.settings"
        ];
        stored.background.assetId = null;
        await chrome.storage.local.set({ "pinora.settings": stored });
      },
      { current, metadataKey },
    );
    await expect
      .poll(() =>
        page.evaluate(async () =>
          (await navigator.locks.query()).pending?.some(
            (lock) => lock.name === "pinora.assets",
          ),
        ),
      )
      .toBe(true);
    expect(await keys()).toContain("expired-second");
    await page.evaluate(async () => {
      const stored = (await chrome.storage.local.get("pinora.settings"))[
        "pinora.settings"
      ];
      stored.background.assetId = "pending-image";
      stored.future = { image: "unknown-current-image" };
      await chrome.storage.local.set({ "pinora.settings": stored });
      (window as Window & { releaseAsset?: () => void }).releaseAsset?.();
    });
    await expect.poll(keys).not.toContain("expired-second");
    expect(await keys()).toContain("pending-image");
    expect(await keys()).toContain("unknown-current-image");
    await expect(page.locator(".wallpaper-layer")).toHaveCSS(
      "background-image",
      /blob:/,
    );
    await expect(page.getByRole("alert")).toHaveCount(0);
  } finally {
    await context.close();
  }
});
