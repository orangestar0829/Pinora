import { test, expect, chromium } from "@playwright/test";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const channel =
  process.env.PINORA_TEST_CHANNEL === "msedge" ? "msedge" : "chromium";

test("Recent visits read native history and clear when the permission check changes", async () => {
  await mkdir(".test-profiles", { recursive: true });
  const profile = await mkdtemp(
    path.join(process.cwd(), ".test-profiles", "recent-visits-"),
  );
  let extension = path.join(process.cwd(), "dist");
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
  let context = await launch();
  try {
    let page = await context.newPage();
    const newtab = channel === "msedge" ? "edge://newtab/" : "chrome://newtab/";
    await page.goto(newtab);
    const section = () =>
      page.getByRole("region", { name: "最近访问", exact: true });
    await expect(section()).toContainText("请在设置中授予历史记录权限");
    expect(
      await page.evaluate(() =>
        chrome.permissions.contains({ permissions: ["history"] }),
      ),
    ).toBe(false);
    // Only the declined browser prompt is stubbed; authorized reads below use native APIs.
    await page.evaluate(() => {
      chrome.permissions.request = async () => false;
    });
    await page.getByRole("button", { name: "外观与设置", exact: true }).click();
    await page.getByRole("button", { name: "布局", exact: true }).click();
    await page
      .locator(".content-setting")
      .filter({ hasText: "历史记录" })
      .getByRole("button", { name: "获取权限", exact: true })
      .click();
    await page.getByRole("button", { name: "关闭", exact: true }).click();
    await expect(section()).toContainText("请在设置中授予历史记录权限");
    await expect(section().locator(".bookmark-tile")).toHaveCount(0);
    await context.close();

    // Native history requires a grant; headless cannot confirm the native prompt.
    // A test-only copy makes history required, leaving production dist unchanged.
    extension = path.join(profile, "granted-test-extension");
    await cp(path.join(process.cwd(), "dist"), extension, { recursive: true });
    const manifestPath = path.join(extension, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.permissions.push("history");
    delete manifest.optional_permissions;
    await writeFile(manifestPath, JSON.stringify(manifest));
    context = await launch();
    page = await context.newPage();
    await page.goto(newtab);
    expect(
      await page.evaluate(() =>
        chrome.permissions.contains({ permissions: ["history"] }),
      ),
    ).toBe(true);
    await page.evaluate(async () => {
      await chrome.history.deleteAll();
      const [root] = await chrome.bookmarks.getTree();
      const parent =
        root.children!.find((node) => node.folderType === "bookmarks-bar") ??
        root.children![0];
      for (const title of [
        "工作空间",
        "开发文档",
        "阅读清单",
        "设计灵感",
        "项目仓库",
        "我的笔记",
        "工具箱",
      ]) {
        await chrome.bookmarks.create({
          parentId: parent.id,
          title,
          url: `https://bookmarks.example.test/${encodeURIComponent(title)}`,
        });
      }
    });
    await expect(section()).toContainText("暂无最近访问记录");
    await context.route("https://recent.example.test/**", (route) => {
      const slug = new URL(route.request().url()).pathname.slice(1);
      return route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: `<html><head><title>访问页面 ${slug}</title></head><body>Local test fixture</body></html>`,
      });
    });
    const visited = await context.newPage();
    for (let i = 0; i < 16; i++)
      await visited.goto(`https://recent.example.test/${i}`);
    await visited.close();
    await expect(section().locator(".bookmark-tile")).toHaveCount(14);
    // Focus refresh picks up final titles after native history's visited event.
    await page.bringToFront();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(section().locator(".tile-main").first()).toHaveAttribute(
      "href",
      "https://recent.example.test/15",
    );
    await expect(section().locator(".tile-main").last()).toHaveAttribute(
      "href",
      "https://recent.example.test/2",
    );
    await expect(section().locator(".tile-main").first()).toHaveAttribute(
      "title",
      /访问页面 15/,
    );
    await expect(section().getByRole("button", { name: /^管理 / })).toHaveCount(
      0,
    );
    expect(
      await section().evaluate((el) => getComputedStyle(el).borderTopWidth),
    ).toBe("1px");

    await page.getByRole("textbox", { name: "搜索书签与文件夹" }).fill("工作");
    await expect(section()).toHaveCount(0);
    await page.getByRole("button", { name: "清除搜索" }).click();
    await expect(section().locator(".bookmark-tile")).toHaveCount(14);

    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: test.info().outputPath(`recent-visits-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "外观与设置", exact: true }).click();
    await page.getByRole("button", { name: "深色", exact: true }).click();
    await page.getByRole("button", { name: "关闭", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.screenshot({
      path: test.info().outputPath("recent-visits-dark.png"),
      fullPage: true,
      animations: "disabled",
    });

    // A real native deletion updates the rendered data without a page reload.
    await page.evaluate(() =>
      chrome.history.deleteUrl({ url: "https://recent.example.test/15" }),
    );
    await expect(
      section().locator("a[href='https://recent.example.test/15']"),
    ).toHaveCount(0);
    await expect(section().locator(".tile-main").first()).toHaveAttribute(
      "href",
      "https://recent.example.test/14",
    );
    // Required test grants cannot be revoked. Simulate only the grant check;
    // adapter unit tests separately cover the actual onRemoved subscription.
    await page.evaluate(() => {
      chrome.permissions.contains = async () => false;
      window.dispatchEvent(new Event("focus"));
    });
    await expect(section().locator(".bookmark-tile")).toHaveCount(0);
    await expect(
      section().getByText("请在设置中授予历史记录权限"),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
