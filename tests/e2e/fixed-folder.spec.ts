import { test, expect, chromium } from "@playwright/test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const channel =
  process.env.PINORA_TEST_CHANNEL === "msedge" ? "msedge" : "chromium";

test("fixed folder confines navigation and search, synchronizes and fails closed after deletion", async () => {
  const testInfo = test.info();
  const profile = await mkdtemp(path.join(tmpdir(), "pinora-fixed-folder-"));
  const extension = path.join(process.cwd(), "dist");
  const context = await chromium.launchPersistentContext(profile, {
    channel,
    headless: true,
    viewport: { width: 1440, height: 1000 },
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(
      channel === "msedge" ? "edge://newtab/" : "chrome://newtab/",
    );
    await expect(page.locator(".loading-ring")).toHaveCount(0);
    const ids = await page.evaluate(async () => {
      const [root] = await chrome.bookmarks.getTree();
      const bar =
        root.children!.find((node) => node.folderType === "bookmarks-bar") ??
        root.children![0];
      const selected = await chrome.bookmarks.create({
        parentId: bar.id,
        title: "固定收藏",
      });
      const nested = await chrome.bookmarks.create({
        parentId: selected.id,
        title: "子目录",
      });
      const other = await chrome.bookmarks.create({
        parentId: bar.id,
        title: "其他收藏",
      });
      await chrome.bookmarks.create({
        parentId: selected.id,
        title: "范围内共同关键词",
        url: "https://inside.test",
      });
      await chrome.bookmarks.create({
        parentId: nested.id,
        title: "子目录共同关键词",
        url: "https://nested.test",
      });
      await chrome.bookmarks.create({
        parentId: other.id,
        title: "外部共同关键词",
        url: "https://outside.test",
      });
      return { selected: selected.id, nested: nested.id, other: other.id };
    });
    const second = await context.newPage();
    await second.goto(page.url());
    await expect(second.locator(".loading-ring")).toHaveCount(0);
    const settings = () =>
      page.getByRole("button", { name: "外观与设置", exact: true }).click();
    const close = () =>
      page
        .getByRole("dialog")
        .getByRole("button", { name: "关闭", exact: true })
        .click();
    const heading = page.getByRole("heading", { level: 1 });
    const tile = (title: string) =>
      page.locator(".bookmark-tile").filter({
        has: page.locator(".tile-title").getByText(title, { exact: true }),
      });
    await settings();
    await page
      .getByRole("combobox", { name: "书签文件夹", exact: true })
      .selectOption(ids.selected);
    await expect(second.getByRole("heading", { level: 1 })).toHaveText(
      "固定收藏",
    );
    await close();
    await expect(heading).toHaveText("固定收藏");
    await expect(page.locator(".bookmark-tile")).toHaveCount(2);
    await expect(page.locator(".sidebar")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "新建文件夹", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("textbox", { name: "搜索书签与文件夹" })
      .fill("共同关键词");
    await expect(page.locator(".bookmark-tile")).toHaveCount(2);
    await expect(tile("外部共同关键词")).toHaveCount(0);
    await expect(tile("子目录共同关键词")).toBeVisible();
    await page.keyboard.press("Escape");
    await tile("子目录").locator(".tile-main").click();
    await expect(heading).toHaveText("子目录");
    await page.keyboard.press("Escape");
    await expect(heading).toHaveText("固定收藏");
    await tile("子目录").locator(".tile-main").click();
    await expect(heading).toHaveText("子目录");
    await page.keyboard.press("Escape");
    await expect(heading).toHaveText("固定收藏");
    await page.keyboard.press("Escape");
    await expect(heading).toHaveText("固定收藏");
    await page.reload();
    await expect(heading).toHaveText("固定收藏");

    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`fixed-home-${width}.png`),
        fullPage: true,
      });
      await settings();
      await expect(
        page.getByRole("combobox", { name: "书签文件夹", exact: true }),
      ).toHaveValue(ids.selected);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`fixed-settings-${width}.png`),
        fullPage: true,
      });
      await close();
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await settings();
    await page
      .getByRole("combobox", { name: "书签文件夹", exact: true })
      .selectOption(ids.other);
    await close();
    await expect(heading).toHaveText("其他收藏");
    await expect(tile("外部共同关键词")).toBeVisible();
    await expect(tile("范围内共同关键词")).toHaveCount(0);
    await expect(second.getByRole("heading", { level: 1 })).toHaveText(
      "其他收藏",
    );
    await page.evaluate(async (id) => {
      await chrome.bookmarks.removeTree(id);
    }, ids.other);
    await expect(
      page.getByRole("heading", { name: "书签文件夹不可用" }),
    ).toBeVisible();
    await expect(
      second.getByRole("heading", { name: "书签文件夹不可用" }),
    ).toBeVisible();
    await expect(page.locator(".bookmark-tile")).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "书签文件夹不可用" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "选择书签文件夹", exact: true })
      .click();
    await expect(
      page.getByRole("combobox", { name: "书签文件夹", exact: true }),
    ).toHaveValue(ids.other);
    await page
      .getByRole("combobox", { name: "书签文件夹", exact: true })
      .selectOption(ids.selected);
    await close();
    await expect(heading).toHaveText("固定收藏");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
