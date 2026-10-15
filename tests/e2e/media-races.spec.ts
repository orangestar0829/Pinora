import { test, expect, chromium, type Page } from "@playwright/test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const channel =
  process.env.PINORA_TEST_CHANNEL === "msedge" ? "msedge" : "chromium";
const wallpaper = {
  name: "wallpaper.svg",
  mimeType: "image/svg+xml",
  buffer: Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#638574"/></svg>',
  ),
};
type EncodingGate = Window & {
  releaseEncoding?: () => void;
  encodingWaiting?: boolean;
};

async function pauseEncoding(page: Page) {
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      HTMLCanvasElement.prototype.toBlob = original;
      original.call(
        this,
        (blob) => {
          const gate = window as EncodingGate;
          gate.encodingWaiting = true;
          gate.releaseEncoding = () => {
            gate.encodingWaiting = false;
            callback(blob);
          };
        },
        type,
        quality,
      );
    };
  });
}

test("wallpaper cancellation preserves newer background choices and normal upload", async () => {
  const profile = await mkdtemp(path.join(tmpdir(), "pinora-wallpaper-"));
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
    await page.getByRole("button", { name: "外观与设置", exact: true }).click();
    await page.getByRole("button", { name: "背景", exact: true }).click();
    // A fresh profile has no settings until the first async write completes.
    const readBackground = () =>
      page.evaluate(
        async () =>
          (await chrome.storage.local.get("pinora.settings"))["pinora.settings"]
            ?.background,
      );
    const startUpload = async () => {
      await page.getByLabel("背景类型").selectOption("image");
      await expect
        .poll(async () => (await readBackground())?.type)
        .toBe("image");
      await pauseEncoding(page);
      await page.getByLabel("上传壁纸").setInputFiles(wallpaper);
      await expect
        .poll(() =>
          page.evaluate(() => (window as EncodingGate).encodingWaiting),
        )
        .toBe(true);
    };
    const finishUpload = async () => {
      await page.evaluate(() => (window as EncodingGate).releaseEncoding?.());
      // Reopen image controls to observe completion, without changing background settings.
      await expect(
        page.getByRole("button", { name: "正在处理…", exact: true }),
      ).toHaveCount(0);
      await page.evaluate(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );
    };
    await startUpload();
    await page.screenshot({
      path: test.info().outputPath("upload-pending.png"),
    });
    await page
      .getByRole("button", { name: "恢复默认背景", exact: true })
      .click();
    await expect.poll(async () => (await readBackground())?.type).toBe("solid");
    await finishUpload();
    expect(await readBackground()).toMatchObject({
      type: "solid",
      assetId: null,
    });

    await startUpload();
    await page.getByLabel("背景类型").selectOption("gradient");
    await expect
      .poll(async () => (await readBackground())?.type)
      .toBe("gradient");
    await finishUpload();
    expect(await readBackground()).toMatchObject({
      type: "gradient",
      assetId: null,
    });

    await startUpload();
    await page.getByRole("button", { name: "关闭", exact: true }).click();
    await finishUpload();
    expect(await readBackground()).toMatchObject({
      type: "image",
      assetId: null,
    });
    await page.getByRole("button", { name: "外观与设置", exact: true }).click();
    await page.getByRole("button", { name: "背景", exact: true }).click();

    await startUpload();
    const second = await context.newPage();
    await second.goto(page.url());
    await second
      .getByRole("button", { name: "外观与设置", exact: true })
      .click();
    await second.getByRole("button", { name: "背景", exact: true }).click();
    await second.getByLabel("背景类型").selectOption("solid");
    await expect.poll(async () => (await readBackground())?.type).toBe("solid");
    await finishUpload();
    expect(await readBackground()).toMatchObject({
      type: "solid",
      assetId: null,
    });
    await second.close();

    await page.getByLabel("背景类型").selectOption("image");
    await page.getByLabel("上传壁纸").setInputFiles(wallpaper);
    await expect(
      page.getByText("已保存本地壁纸", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".wallpaper-layer")).toHaveCSS(
      "background-image",
      /blob:/,
    );
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.screenshot({
      path: test.info().outputPath("wallpaper-saved.png"),
    });
  } finally {
    await context.close();
  }
});

test("icon save cannot be dismissed in flight and failures restore controls", async () => {
  const profile = await mkdtemp(path.join(tmpdir(), "pinora-icon-save-"));
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
    const id = await page.evaluate(async () => {
      const [root] = await chrome.bookmarks.getTree();
      return (
        await chrome.bookmarks.create({
          parentId: root.children![0].id,
          title: "Icon save",
          url: "https://example.test/",
        })
      ).id;
    });
    const openEditor = async () => {
      await page
        .getByRole("button", { name: "管理 Icon save", exact: true })
        .click();
      await page
        .getByRole("menuitem", { name: "自定义图标", exact: true })
        .click();
      await page.getByLabel("上传自定义图标").setInputFiles(wallpaper);
      await expect(page.getByLabel("图标裁剪预览")).toBeVisible();
    };
    const dialog = page.getByRole("dialog");
    await openEditor();
    await pauseEncoding(page);
    await dialog.getByRole("button", { name: "保存图标", exact: true }).click();
    await page.waitForFunction(() => (window as EncodingGate).encodingWaiting);
    await expect(
      dialog.getByRole("button", { name: "取消", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "关闭", exact: true }).click();
    await expect(dialog).toBeVisible();
    await page.locator(".dialog-backdrop").click({ position: { x: 5, y: 5 } });
    await expect(dialog).toBeVisible();
    await page.evaluate(() => (window as EncodingGate).releaseEncoding?.());
    await expect(dialog).toHaveCount(0);
    const saved = await page.evaluate(
      async (id) =>
        (await chrome.storage.local.get("pinora.settings"))["pinora.settings"]
          .iconMappings[id],
      id,
    );
    expect(saved).toBeTruthy();

    await openEditor();
    await page.evaluate(() => {
      const original = chrome.storage.local.set.bind(chrome.storage.local);
      chrome.storage.local.set = ((items: object) => {
        chrome.storage.local.set = original;
        if ("pinora.settings" in items)
          return Promise.reject(new Error("injected quota failure"));
        return original(items);
      }) as typeof chrome.storage.local.set;
    });
    await dialog.getByRole("button", { name: "保存图标", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText(
      "injected quota failure",
    );
    await expect(
      dialog.getByRole("button", { name: "取消", exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(
        async (id) =>
          (await chrome.storage.local.get("pinora.settings"))["pinora.settings"]
            .iconMappings[id],
        id,
      ),
    ).toBe(saved);
    await dialog.getByRole("button", { name: "取消", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  } finally {
    await context.close();
  }
});
