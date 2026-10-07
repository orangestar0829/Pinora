import { test, expect, chromium } from "@playwright/test";
import { mkdir, mkdtemp } from "node:fs/promises";
import path from "node:path";

const channel =
  process.env.PINORA_TEST_CHANNEL === "msedge" ? "msedge" : "chromium";

test("content visibility and row settings control the home sections", async () => {
  await mkdir(".test-profiles", { recursive: true });
  const profile = await mkdtemp(
    path.join(process.cwd(), ".test-profiles", "content-settings-"),
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

    const openSettings = async () => {
      await page
        .getByRole("button", { name: "外观与设置", exact: true })
        .click();
      await page.getByRole("button", { name: "布局", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "主页内容" }),
      ).toBeVisible();
    };
    const closeSettings = () =>
      page.getByRole("button", { name: "关闭", exact: true }).click();

    await expect(page.locator(".recent-visits")).toBeVisible();
    await expect(page.locator(".recent-visits-heading p")).toHaveCount(0);
    await expect(page.locator(".top-sites")).toHaveCount(0);
    await openSettings();
    const historyToggle = page
      .locator(".content-setting")
      .filter({ hasText: "历史记录" })
      .getByRole("checkbox");
    const topSitesToggle = page
      .locator(".content-setting")
      .filter({ hasText: "热门网站" })
      .getByRole("checkbox");
    await expect(historyToggle).toBeChecked();
    await expect(topSitesToggle).not.toBeChecked();
    await page
      .getByRole("combobox", { name: "历史记录展示行数" })
      .selectOption("1");
    await expect(
      page.getByRole("combobox", { name: "历史记录展示行数" }),
    ).toHaveValue("1");
    await historyToggle.click();
    await expect(historyToggle).not.toBeChecked();
    await topSitesToggle.click();
    await expect(topSitesToggle).toBeChecked();
    await expect(
      page.locator(".content-setting").filter({ hasText: "历史记录" }),
    ).toContainText("未授权");
    await expect(
      page.locator(".content-setting").filter({ hasText: "热门网站" }),
    ).toContainText("未授权");
    await closeSettings();
    await expect(page.locator(".recent-visits")).toHaveCount(0);
    await expect(page.locator(".top-sites")).toBeVisible();
    await expect(
      page.locator(".top-sites .recent-visits-heading p"),
    ).toHaveCount(0);
    await expect(page.locator(".top-sites")).toContainText(
      "请在设置中授予热门网站权限",
    );

    await openSettings();
    await historyToggle.click();
    await expect(historyToggle).toBeChecked();
    await topSitesToggle.click();
    await expect(topSitesToggle).not.toBeChecked();
    await closeSettings();
    await expect(page.locator(".recent-visits")).toBeVisible();
    await expect(page.locator(".top-sites")).toHaveCount(0);
  } finally {
    await context.close();
  }
});
