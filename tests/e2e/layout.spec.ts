import { test, expect, chromium } from "@playwright/test";
import { mkdir, mkdtemp } from "node:fs/promises";
import path from "node:path";

const channel =
  process.env.PINORA_TEST_CHANNEL === "msedge" ? "msedge" : "chromium";

test("Long folder titles stay within the viewport and leave actions usable", async () => {
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
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const title = "W".repeat(500);
    await page.evaluate(async (title) => {
      const [root] = await chrome.bookmarks.getTree();
      const parent =
        root.children!.find((node) => node.folderType === "bookmarks-bar") ??
        root.children![0];
      await chrome.bookmarks.create({ parentId: parent.id, title });
    }, title);
    await page
      .locator(".bookmark-tile")
      .filter({
        has: page.locator(".tile-title").getByText(title, { exact: true }),
      })
      .locator("a")
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      `${title}.`,
    );

    for (const width of [1440, 1280, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const bounds = await page.evaluate(() => {
        const title = document.querySelector("h1")!;
        const heading = title.getBoundingClientRect();
        const actions = document
          .querySelector(".collection-actions")!
          .getBoundingClientRect();
        return {
          documentWidth: document.documentElement.scrollWidth,
          headingLeft: heading.left,
          headingRight: heading.right,
          headingHeight: heading.height,
          titleLineHeight: Number.parseFloat(
            getComputedStyle(title).lineHeight,
          ),
          actionsLeft: actions.left,
          actionsRight: actions.right,
        };
      });
      expect(bounds.documentWidth).toBeLessThanOrEqual(width);
      expect(bounds.headingLeft).toBeGreaterThanOrEqual(0);
      expect(bounds.headingRight).toBeLessThanOrEqual(width);
      expect(bounds.headingHeight).toBeLessThanOrEqual(
        bounds.titleLineHeight * 2 + 1,
      );
      await expect(page.getByRole("heading", { level: 1 })).toHaveAttribute(
        "title",
        title,
      );
      expect(bounds.actionsLeft).toBeGreaterThanOrEqual(0);
      expect(bounds.actionsRight).toBeLessThanOrEqual(width);
      await page.getByRole("button", { name: "添加书签", exact: true }).click();
      await expect(
        page.getByRole("dialog", { name: "添加书签" }),
      ).toBeVisible();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "取消", exact: true })
        .click();
      await page.screenshot({
        path: testInfo.outputPath(`long-title-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
    }
  } finally {
    await context.close();
  }
});
