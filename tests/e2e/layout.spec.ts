import { test, expect, chromium } from "@playwright/test";
import { mkdir, mkdtemp } from "node:fs/promises";
import path from "node:path";

const channel =
  process.env.PINORA_TEST_CHANNEL === "msedge" ? "msedge" : "chromium";

test("Compact layout keeps actions usable with long folder names", async () => {
  const testInfo = test.info();
  await mkdir(".test-profiles", { recursive: true });
  const profile = await mkdtemp(
    path.join(process.cwd(), ".test-profiles", "layout-regression-"),
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
    const title = "W".repeat(500);
    await page.evaluate(async (title) => {
      const [root] = await chrome.bookmarks.getTree();
      const parent =
        root.children!.find((node) => node.folderType === "bookmarks-bar") ??
        root.children![0];
      await chrome.bookmarks.create({ parentId: parent.id, title });
    }, title);
    for (const width of [2560, 1440, 1280, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await assertCompactHeader();
      await page.screenshot({
        path: testInfo.outputPath(`bookmarks-${width}.png`),
        fullPage: true,
      });
    }
    const originalWidth = await page.locator(".shell").evaluate((element) => {
      const style = (element as HTMLElement).style;
      const original = style.getPropertyValue("--content-width");
      style.setProperty("--content-width", "640px");
      return original;
    });
    for (const width of [1440, 1000, 760, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await assertCompactHeader();
    }
    await page.locator(".shell").evaluate((element, value) => {
      (element as HTMLElement).style.setProperty("--content-width", value);
    }, originalWidth);
    await page
      .locator(".bookmark-tile")
      .filter({
        has: page.locator(".tile-title").getByText(title, { exact: true }),
      })
      .locator("a")
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);

    async function assertCompactHeader() {
      const width = page.viewportSize()!.width;
      const bounds = await page.evaluate(() => {
        const header = document
          .querySelector(".topbar")!
          .getBoundingClientRect();
        const topbarRight = document.querySelector(".topbar-right")!;
        const title = document
          .querySelector("#bookmarks-title")!
          .getBoundingClientRect();
        const search = document
          .querySelector(".search")!
          .getBoundingClientRect();
        const content = document
          .querySelector(
            ".bookmarks-section > .bookmark-grid, .bookmarks-section > .empty-state",
          )!
          .getBoundingClientRect();
        return {
          centerDifference: Math.abs(
            title.top + title.height / 2 - search.top - search.height / 2,
          ),
          contentGap: content.top - header.bottom,
          leftDifference: Math.abs(title.left - content.left),
          documentWidth: document.documentElement.scrollWidth,
          headerHeight: header.height,
          topbarChildren: document.querySelector(".topbar")!.children.length,
          controlsTop: topbarRight.getBoundingClientRect().top,
          controlsBottom: topbarRight.getBoundingClientRect().bottom,
          borderBottom: getComputedStyle(document.querySelector(".topbar")!)
            .borderBottomWidth,
        };
      });
      expect(bounds.documentWidth).toBeLessThanOrEqual(width);
      expect(bounds.headerHeight).toBeLessThanOrEqual(80);
      expect(bounds.topbarChildren).toBe(2);
      expect(bounds.centerDifference).toBeLessThanOrEqual(2);
      expect(bounds.leftDifference).toBeLessThanOrEqual(2);
      expect(bounds.contentGap).toBeGreaterThanOrEqual(0);
      expect(bounds.contentGap).toBeLessThanOrEqual(4);
      expect(bounds.controlsBottom - bounds.controlsTop).toBeLessThanOrEqual(
        bounds.headerHeight,
      );
      expect(bounds.borderBottom).toBe("0px");
      await expect(page.locator(".topbar .brand")).toHaveCount(0);
      await expect(page.locator(".collection-toolbar")).toHaveCount(0);
      await expect(page.locator(".bookmarks-section")).toHaveCount(1);
      await expect(
        page.getByRole("heading", { name: "书签", exact: true }),
      ).toBeVisible();
      await expect(
        page.locator(".breadcrumbs, .brand small, .eyebrow, .canvas-footer"),
      ).toHaveCount(0);
      await expect(page.locator(".bookmarks-heading p")).toHaveCount(0);
    }
    for (const width of [2560, 1440, 1280, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await assertCompactHeader();
      await expect(page.locator(".recent-visits")).toHaveCount(0);
      await page.screenshot({
        path: testInfo.outputPath(`long-title-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
    }
    await page.getByRole("button", { name: "返回上级" }).click();
    await expect(page.locator(".bookmark-grid").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "返回上级" })).toHaveCount(0);
    await page
      .getByRole("textbox", { name: "搜索书签与文件夹" })
      .fill("no matching bookmark");
    await expect(
      page.getByRole("heading", { name: "暂时没有找到" }),
    ).toBeVisible();
    await assertCompactHeader();
  } finally {
    await context.close();
  }
});
