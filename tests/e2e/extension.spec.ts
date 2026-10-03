import {
  test,
  expect,
  chromium,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
const channel =
  process.env.PINORA_TEST_CHANNEL === "msedge" ? "msedge" : "chromium";

test("Deletion confirmation follows live children and rejects unconfirmed native races", async () => {
  await mkdir(".test-profiles", { recursive: true });
  const profile = await mkdtemp(
    path.join(process.cwd(), ".test-profiles", "delete-regression-"),
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
    const folderId = await page.evaluate(async () => {
      const [root] = await chrome.bookmarks.getTree();
      const parent =
        root.children!.find((node) => node.folderType === "bookmarks-bar") ??
        root.children![0];
      return (
        await chrome.bookmarks.create({
          parentId: parent.id,
          title: "删除竞态检查",
        })
      ).id;
    });
    const dialog = page.getByRole("dialog");
    const openDelete = async () => {
      await page
        .getByRole("button", { name: "管理 删除竞态检查", exact: true })
        .click();
      await page.getByRole("menuitem", { name: "删除", exact: true }).click();
    };
    await openDelete();
    await expect(dialog).not.toContainText("其所有后代");
    const childId = await page.evaluate(
      async (parentId) =>
        (
          await chrome.bookmarks.create({
            parentId,
            title: "外部新增",
            url: "https://example.test/",
          })
        ).id,
      folderId,
    );
    await expect(dialog).toContainText("全部 1 个直接子项及其所有后代");
    await dialog.getByRole("button", { name: "取消", exact: true }).click();
    expect(
      await page.evaluate(
        async (id) => (await chrome.bookmarks.get(id))[0].id,
        childId,
      ),
    ).toBe(childId);
    await page.evaluate(async (id) => {
      await chrome.bookmarks.remove(id);
    }, childId);
    await openDelete();
    await expect(dialog).not.toContainText("其所有后代");
    // Insert a child exactly at the native remove boundary, after UI confirmation.
    await page.evaluate((id) => {
      const original = chrome.bookmarks.remove.bind(chrome.bookmarks);
      Object.assign(chrome.bookmarks, {
        remove: async (target: string) => {
          Object.assign(chrome.bookmarks, { remove: original });
          await chrome.bookmarks.create({
            parentId: id,
            title: "删除瞬间新增",
            url: "https://example.test/race",
          });
          await original(target);
        },
      });
    }, folderId);
    await dialog.getByRole("button", { name: "确认删除", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    expect(
      await page.evaluate(
        async (id) =>
          (await chrome.bookmarks.getChildren(id)).map((node) => node.title),
        folderId,
      ),
    ).toEqual(["删除瞬间新增"]);
    await expect(dialog).toContainText("其所有后代");
    // The retry now explicitly confirms the displayed non-empty warning.
    await dialog.getByRole("button", { name: "确认删除", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(
      await page.evaluate(
        async () =>
          (await chrome.bookmarks.search({ title: "删除竞态检查" })).length,
      ),
    ).toBe(0);

    const missingId = await page.evaluate(async () => {
      const [root] = await chrome.bookmarks.getTree();
      return (
        await chrome.bookmarks.create({
          parentId: root.children![0].id,
          title: "删除竞态检查",
        })
      ).id;
    });
    await openDelete();
    await page.evaluate(async (id) => {
      await chrome.bookmarks.remove(id);
    }, missingId);
    await expect(dialog).toContainText("该项目已被删除");
    await expect(
      dialog.getByRole("button", { name: "确认删除", exact: true }),
    ).toBeDisabled();
    await dialog.getByRole("button", { name: "取消", exact: true }).click();
  } finally {
    await context.close();
  }
});

test("Chromium Alpha: native bookmarks, drag, local media, synchronization and restart", async () => {
  await mkdir(".test-profiles", { recursive: true });
  await mkdir("artifacts", { recursive: true });
  const profile = await mkdtemp(
    path.join(process.cwd(), ".test-profiles", "acceptance-"),
  );
  const extension = path.join(process.cwd(), "dist");
  const launch = () =>
    chromium.launchPersistentContext(profile, {
      channel,
      headless: true,
      viewport: { width: 1440, height: 1000 },
      args: [
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
      ],
    });
  let context: BrowserContext = await launch();
  const errors: string[] = [];
  const external: string[] = [];
  const timings: number[] = [];
  function observe(page: Page) {
    page.setDefaultTimeout(10_000);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (/^https?:/.test(request.url())) external.push(request.url());
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
  }
  let page = await context.newPage();
  observe(page);
  let rootTitle = "";
  const open = async () => {
    await page.goto(
      channel === "msedge" ? "edge://newtab/" : "chrome://newtab/",
    );
    rootTitle = await page.evaluate(async () => {
      const tree = await chrome.bookmarks.getTree();
      return (
        tree[0].children!.find((n) => n.folderType === "bookmarks-bar") ??
        tree[0].children![0]
      ).title;
    });
    await expect(page.locator(".loading-ring")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      `${rootTitle}.`,
    );
  };
  const tile = (title: string) =>
    page.locator(".bookmark-tile").filter({
      has: page.locator(".tile-title").getByText(title, { exact: true }),
    });
  const settings = () =>
    page.getByRole("button", { name: "外观与设置", exact: true }).click();
  const dialog = () => page.getByRole("dialog");
  const close = () =>
    dialog().getByRole("button", { name: "关闭", exact: true }).click();
  let base = "";
  let target = "";
  let github = "";
  let savedAsset = "";
  let savedIcon = "";
  try {
    await test.step("Load the actual MV3 extension and native test bookmarks", async () => {
      await open();
      expect(
        await page.evaluate(() => chrome.runtime.getManifest().permissions),
      ).toEqual(["bookmarks", "storage", "favicon"]);
      const ids = await page.evaluate(async () => {
        const roots = await chrome.bookmarks.getTree();
        const bar =
          roots[0].children!.find(
            (node) => node.folderType === "bookmarks-bar",
          ) ?? roots[0].children![0];
        const folders = [];
        for (const title of ["工作空间", "设计灵感", "阅读清单", "开发工具"])
          folders.push(
            await chrome.bookmarks.create({ parentId: bar.id, title }),
          );
        await chrome.bookmarks.create({
          parentId: folders[0].id,
          title: "项目文档",
          url: "https://example.com/project",
        });
        for (const [title, url] of [
          ["GitHub", "https://github.com/"],
          ["MDN Web Docs", "https://developer.mozilla.org/"],
          ["Figma", "https://figma.com/"],
          ["Notion", "https://notion.so/"],
          ["Wikipedia", "https://wikipedia.org/"],
          ["Dribbble", "https://dribbble.com/"],
          ["Vercel", "https://vercel.com/"],
          ["Are.na", "https://are.na/"],
        ])
          await chrome.bookmarks.create({ parentId: bar.id, title, url });
        return {
          base: bar.id,
          target: folders[1].id,
          github: (await chrome.bookmarks.search({ title: "GitHub" }))[0].id,
        };
      });
      ({ base, target, github } = ids);
      await expect(page.locator(".bookmark-tile")).toHaveCount(12);
      await page.screenshot({
        path:
          channel === "msedge"
            ? "artifacts/pinora-light-msedge.png"
            : "artifacts/pinora-light.png",
        fullPage: true,
        animations: "disabled",
      });
    });
    await test.step("Folder navigation and indexed search with ancestor path", async () => {
      await tile("工作空间").locator(".tile-main").click();
      await expect(tile("项目文档")).toBeVisible();
      await page.keyboard.press("Control+f");
      await expect(
        page.getByRole("textbox", { name: "搜索书签与文件夹" }),
      ).toBeFocused();
      await page
        .getByRole("textbox", { name: "搜索书签与文件夹" })
        .fill("github");
      await expect(page.locator(".bookmark-tile")).toHaveCount(1);
      await expect(tile("GitHub").locator(".tile-path")).toContainText(
        rootTitle,
      );
      await page.getByRole("button", { name: "清除搜索" }).click();
      await page
        .locator(".breadcrumbs")
        .getByRole("button", { name: rootTitle, exact: true })
        .click();
    });
    await test.step("Native create, normalize URL, rename and confirmed deletion", async () => {
      await page.getByRole("button", { name: "添加书签", exact: true }).click();
      await dialog().getByLabel("名称", { exact: true }).fill("测试书签");
      await dialog()
        .getByLabel("网址", { exact: true })
        .fill("example.com/new");
      await dialog().getByRole("button", { name: "保存", exact: true }).click();
      await expect(tile("测试书签")).toBeVisible();
      expect(
        await page.evaluate(
          async () =>
            (await chrome.bookmarks.search({ title: "测试书签" }))[0].url,
        ),
      ).toBe("https://example.com/new");
      await tile("测试书签").locator(".tile-main").focus();
      await page.keyboard.press("F2");
      await dialog().getByLabel("名称", { exact: true }).fill("已重命名");
      await dialog().getByRole("button", { name: "保存", exact: true }).click();
      await expect(tile("已重命名")).toBeVisible();
      await tile("已重命名").locator(".tile-main").focus();
      await page.keyboard.press("Delete");
      await dialog().getByRole("button", { name: "取消", exact: true }).click();
      await expect(tile("已重命名")).toBeVisible();
      await tile("已重命名").locator(".tile-main").focus();
      await page.keyboard.press("Delete");
      await dialog().getByRole("button", { name: "确认删除" }).click();
      await expect(tile("已重命名")).toHaveCount(0);
      expect(
        await page.evaluate(
          async () =>
            (await chrome.bookmarks.search({ title: "已重命名" })).length,
        ),
      ).toBe(0);
    });
    const titles = () =>
      page.evaluate(
        async (id) =>
          (await chrome.bookmarks.getChildren(id)).map((n) => n.title),
        base,
      );
    await test.step("Real drag in both same-folder directions, then into another folder", async () => {
      await tile("MDN Web Docs").dragTo(tile("GitHub"), {
        targetPosition: { x: 5, y: 40 },
      });
      await expect
        .poll(async () => (await titles()).slice(4, 6))
        .toEqual(["MDN Web Docs", "GitHub"]);
      const box = await tile("GitHub").boundingBox();
      await tile("MDN Web Docs").dragTo(tile("GitHub"), {
        targetPosition: { x: box!.width * 0.65, y: 40 },
      });
      await expect
        .poll(async () => (await titles()).slice(4, 6))
        .toEqual(["GitHub", "MDN Web Docs"]);
      await tile("GitHub").dragTo(tile("设计灵感"));
      await expect
        .poll(() =>
          page.evaluate(
            async (id) => (await chrome.bookmarks.get(id))[0].parentId,
            github,
          ),
        )
        .toBe(target);
      await tile("设计灵感").locator(".tile-main").click();
      await expect(tile("GitHub")).toBeVisible();
      await page
        .getByRole("button", { name: "管理 GitHub", exact: true })
        .click();
      await page.getByRole("menuitem", { name: "移动到…" }).click();
      await dialog().getByLabel("目标文件夹").selectOption(base);
      await dialog().getByRole("button", { name: "移动", exact: true }).click();
      await page
        .locator(".breadcrumbs")
        .getByRole("button", { name: rootTitle, exact: true })
        .click();
      await expect(tile("GitHub")).toBeVisible();
    });
    await test.step("Native external events and protected folder handling", async () => {
      const id = await page.evaluate(
        async (parentId) =>
          (
            await chrome.bookmarks.create({
              parentId,
              title: "来自原生管理器",
              url: "about:blank",
            })
          ).id,
        base,
      );
      await expect(tile("来自原生管理器")).toBeVisible();
      await page.evaluate(async (id) => {
        await chrome.bookmarks.update(id, { title: "原生变更已同步" });
      }, id);
      await expect(tile("原生变更已同步")).toBeVisible();
      await page.evaluate(async (id) => {
        await chrome.bookmarks.remove(id);
      }, id);
      await expect(tile("原生变更已同步")).toHaveCount(0);
      await page
        .getByRole("button", { name: "管理 工作空间", exact: true })
        .click();
      await page.getByRole("menuitem", { name: "删除", exact: true }).click();
      await expect(dialog()).toContainText("其所有后代");
      await dialog().getByRole("button", { name: "取消" }).click();
    });
    await test.step("Theme and layout persist and synchronize to another tab", async () => {
      const second = await context.newPage();
      observe(second);
      await second.goto(page.url());
      await settings();
      await dialog().getByRole("button", { name: "深色", exact: true }).click();
      await expect(second.locator("html")).toHaveAttribute(
        "data-theme",
        "dark",
      );
      await dialog().getByRole("button", { name: "布局", exact: true }).click();
      await dialog()
        .getByRole("slider", { name: /卡片尺寸/ })
        .focus();
      await page.keyboard.press("ArrowRight");
      await expect
        .poll(() =>
          page.evaluate(
            async () =>
              (await chrome.storage.local.get("pinora.settings"))[
                "pinora.settings"
              ].layout.tileSize,
          ),
        )
        .toBe(149);
      await close();
      await page.screenshot({
        path:
          channel === "msedge"
            ? "artifacts/pinora-dark-msedge.png"
            : "artifacts/pinora-dark.png",
        fullPage: true,
        animations: "disabled",
      });
      await second.close();
    });
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="#b7cbb1"/><circle cx="400" cy="120" r="150" fill="#f1e9cc"/><path d="M0 350Q180 70 400 300T600 250V400H0Z" fill="#638574"/></svg>';
    await test.step("Safe custom icon cropping and IndexedDB persistence", async () => {
      await page
        .getByRole("button", { name: "管理 GitHub", exact: true })
        .click();
      await page
        .getByRole("menuitem", { name: "自定义图标", exact: true })
        .click();
      await dialog()
        .getByLabel("上传自定义图标")
        .setInputFiles({
          name: "icon.svg",
          mimeType: "image/svg+xml",
          buffer: Buffer.from(svg),
        });
      await expect(dialog().getByLabel("图标裁剪预览")).toBeVisible();
      await dialog().getByRole("slider", { name: /缩放/ }).focus();
      await page.keyboard.press("ArrowRight");
      await dialog().getByRole("button", { name: "保存图标" }).click();
      await expect(tile("GitHub").locator("img")).toHaveAttribute(
        "src",
        /^blob:/,
      );
      savedIcon = await page.evaluate(
        async (id) =>
          (await chrome.storage.local.get("pinora.settings"))["pinora.settings"]
            .iconMappings[id],
        github,
      );
    });
    await test.step("Local wallpaper upload, settings screenshot and zero external requests", async () => {
      await settings();
      await dialog().getByRole("button", { name: "外观", exact: true }).click();
      await dialog().getByRole("button", { name: "浅色", exact: true }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      await page.screenshot({
        path:
          channel === "msedge"
            ? "artifacts/pinora-settings-msedge.png"
            : "artifacts/pinora-settings.png",
        fullPage: true,
        animations: "disabled",
      });
      await dialog().getByRole("button", { name: "背景", exact: true }).click();
      await dialog().getByLabel("背景类型").selectOption("image");
      await dialog()
        .getByLabel("上传壁纸")
        .setInputFiles({
          name: "wallpaper.svg",
          mimeType: "image/svg+xml",
          buffer: Buffer.from(svg),
        });
      await expect(dialog()).toContainText("已保存本地壁纸");
      await close();
      await expect(page.locator(".wallpaper-layer")).toHaveCSS(
        "background-image",
        /blob:/,
      );
      savedAsset = await page.evaluate(
        async () =>
          (await chrome.storage.local.get("pinora.settings"))["pinora.settings"]
            .background.assetId,
      );
      await page.reload();
      await expect(tile("GitHub").locator("img")).toHaveAttribute(
        "src",
        /^blob:/,
      );
      await expect(page.locator(".wallpaper-layer")).toHaveCSS(
        "background-image",
        /blob:/,
      );
      await context.setOffline(true);
      await page.reload();
      await expect(tile("GitHub")).toBeVisible();
      await expect(page.locator(".wallpaper-layer")).toHaveCSS(
        "background-image",
        /blob:/,
      );
      expect(external).toEqual([]);
      await context.setOffline(false);
    });
    await test.step("Restart isolated browser and verify both local assets survive", async () => {
      await context.close();
      context = await launch();
      page = await context.newPage();
      observe(page);
      await open();
      await expect(tile("GitHub").locator("img")).toHaveAttribute(
        "src",
        /^blob:/,
      );
      await expect(page.locator(".wallpaper-layer")).toHaveCSS(
        "background-image",
        /blob:/,
      );
      const stored = await page.evaluate(
        async () =>
          (await chrome.storage.local.get("pinora.settings"))[
            "pinora.settings"
          ],
      );
      expect(stored.background.assetId).toBe(savedAsset);
      expect(stored.iconMappings[github]).toBe(savedIcon);
      expect(stored.layout.tileSize).toBe(149);
      await settings();
      await dialog().getByRole("button", { name: "背景", exact: true }).click();
      await dialog().getByRole("button", { name: "恢复默认背景" }).click();
      await close();
      for (const [width, height] of [
        [1280, 720],
        [1366, 768],
        [1920, 1080],
        [2560, 1440],
        [3840, 2160],
      ]) {
        await page.setViewportSize({ width, height });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      for (let i = 0; i < 3; i++) {
        await page.reload();
        await expect(tile("GitHub")).toBeVisible();
        timings.push(await page.evaluate(() => performance.now()));
      }
      await page.evaluate(async (parentId) => {
        for (let i = 0; i < 220; i++)
          await chrome.bookmarks.create({
            parentId,
            title: `分页检查 ${i}`,
            url: `https://example.test/${i}`,
          });
      }, base);
      await page
        .getByRole("textbox", { name: "搜索书签与文件夹" })
        .fill("分页检查");
      await expect(page.locator(".bookmark-tile")).toHaveCount(200);
      await page.getByRole("button", { name: "下一页", exact: true }).click();
      await expect(page.locator(".bookmark-tile")).toHaveCount(20);
      await expect(tile("分页检查 219")).toBeVisible();
      expect(errors).toEqual([]);
      expect(external).toEqual([]);
      await writeFile(
        channel === "msedge"
          ? "artifacts/acceptance-msedge.json"
          : "artifacts/acceptance.json",
        JSON.stringify(
          {
            browser: context.browser()?.version(),
            profile,
            externalRequests: external,
            pageErrors: errors,
            warmReadyObservedMs: timings,
            nativeCRUD: true,
            nativeBidirectionalDrag: true,
            crossFolderMove: true,
            settingsCrossTab: true,
            mediaRestartPersistence: true,
            offline: true,
            viewportWidths: [1280, 1366, 1920, 2560, 3840],
          },
          null,
          2,
        ),
      );
    });
  } finally {
    await context.close();
  }
});
