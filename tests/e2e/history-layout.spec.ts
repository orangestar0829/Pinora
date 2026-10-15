import { test, expect, chromium, type Page } from "@playwright/test";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Settings } from "../../src/storage/settings";

const channel =
  process.env.PINORA_TEST_CHANNEL === "msedge" ? "msedge" : "chromium";

test("history grids respect actual columns and keep complete cards focusable", async () => {
  await mkdir(".test-profiles", { recursive: true });
  const profile = await mkdtemp(
    path.join(process.cwd(), ".test-profiles", "history-layout-"),
  );
  // Headless cannot accept native permission prompts. Grant only this isolated
  // test copy; production dist and its optional permissions remain untouched.
  const extension = path.join(profile, "granted-test-extension");
  await cp(path.join(process.cwd(), "dist"), extension, { recursive: true });
  const manifestPath = path.join(extension, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.permissions.push("history", "topSites");
  delete manifest.optional_permissions;
  await writeFile(manifestPath, JSON.stringify(manifest));
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
    await page.goto(
      channel === "msedge" ? "edge://newtab/" : "chrome://newtab/",
    );
    await expect(page.locator(".loading-ring")).toHaveCount(0);
    await page.evaluate(async () => {
      await chrome.history.deleteAll();
      const [root] = await chrome.bookmarks.getTree();
      const parent =
        root.children!.find((node) => node.folderType === "bookmarks-bar") ??
        root.children![0];
      await chrome.bookmarks.create({
        parentId: parent.id,
        title: "Layout fixture",
        url: "https://bookmark.example.test/",
      });
      // Native topSites can contain too few entries in a new profile. Only its
      // data list is controlled; the production component and adapter are used.
      chrome.topSites.get = async () =>
        Array.from({ length: 28 }, (_, index) => ({
          title: `Popular fixture with a long two-line title ${index}`,
          url: `https://popular-${index}.example.test/`,
        }));
      await chrome.storage.local.set({
        "pinora.settings": {
          schemaVersion: 1,
          showRecentVisits: true,
          showTopSites: true,
          recentVisitsRows: 2,
          topSitesRows: 2,
        },
      });
    });
    await context.route("https://recent-layout.example.test/**", (route) =>
      route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: `<title>Recent fixture with a long two-line title ${new URL(route.request().url()).pathname}</title>`,
      }),
    );
    const visited = await context.newPage();
    for (let index = 0; index < 28; index++)
      await visited.goto(`https://recent-layout.example.test/${index}`);
    await visited.close();
    await page.bringToFront();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.locator(".recent-visits .tile-title").first(),
    ).toContainText("Recent fixture");
    await assertGrids(page, 7, 2);

    await page.setViewportSize({ width: 390, height: 1000 });
    await assertGrids(page, 2, 2);
    await page.screenshot({
      path: test.info().outputPath("history-grids-390.png"),
      fullPage: true,
      animations: "disabled",
    });
    // There are exactly four rendered links per section, with no clipped
    // offscreen entries left in the keyboard tab sequence.
    await page.locator(".recent-visits .tile-main").last().focus();
    await page.keyboard.press("Tab");
    await expect(page.locator(".top-sites .tile-main").first()).toBeFocused();

    await page.setViewportSize({ width: 1440, height: 1000 });
    await updateLayout(
      page,
      {
        tileSize: 96,
        iconSize: 96,
        fontSize: 24,
        labels: "two",
      },
      1,
    );
    await assertGrids(page, 10, 1);
    for (const section of [".recent-visits", ".top-sites"]) {
      const title = page.locator(`${section} .tile-title`).first();
      expect(
        await title.evaluate(
          (element) => element.getBoundingClientRect().height,
        ),
      ).toBeGreaterThan(70);
    }
    await page.screenshot({
      path: test.info().outputPath("history-grids-large-content.png"),
      fullPage: true,
      animations: "disabled",
    });

    // Same container width: CSS settings alone must recompute the columns.
    const width = await page
      .locator(".recent-visits .history-grid")
      .evaluate((element) => element.getBoundingClientRect().width);
    await updateLayout(page, { gapX: 64 });
    await assertGrids(page, 7, 1);
    expect(
      await page
        .locator(".recent-visits .history-grid")
        .evaluate((element) => element.getBoundingClientRect().width),
    ).toBe(width);
    await updateLayout(page, { tileSize: 240 });
    await assertGrids(page, 4, 1);
    await updateLayout(page, { maxWidth: 640 });
    await assertGrids(page, 2, 1);

    // Search unmounts both components; clearing it remounts their async grids.
    await page
      .getByRole("textbox", { name: "搜索书签与文件夹" })
      .fill("fixture");
    await expect(page.locator(".history-grid")).toHaveCount(0);
    await page.getByRole("button", { name: "清除搜索" }).click();
    await assertGrids(page, 2, 1);
    await updateLayout(page, { tileSize: 96, gapX: 16, maxWidth: 2400 }, 4);
    await page.setViewportSize({ width: 2560, height: 1000 });
    await assertGrids(page, 21, 4);
  } finally {
    await context.close();
  }
});

async function updateLayout(
  page: Page,
  layout: Partial<Settings["layout"]>,
  rows?: number,
) {
  await page.evaluate(
    async ({ layout, rows }) => {
      const key = "pinora.settings";
      const current = (await chrome.storage.local.get(key))[key];
      await chrome.storage.local.set({
        [key]: {
          ...current,
          layout: { ...current.layout, ...layout },
          ...(rows === undefined
            ? {}
            : { recentVisitsRows: rows, topSitesRows: rows }),
        },
      });
    },
    { layout, rows },
  );
}

async function assertGrids(page: Page, columns: number, rows: number) {
  for (const section of [".recent-visits", ".top-sites"]) {
    const grid = page.locator(`${section} .history-grid`);
    await expect(grid.locator(".tile-main")).toHaveCount(
      Math.min(28, rows * columns),
    );
    await expect
      .poll(() =>
        grid.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          const cards = [...element.querySelectorAll(".bookmark-tile")];
          const links = [
            ...element.querySelectorAll<HTMLAnchorElement>("a[href]"),
          ];
          const fits = (child: Element) => {
            const rect = child.getBoundingClientRect();
            return (
              rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1
            );
          };
          return {
            columns:
              getComputedStyle(element).gridTemplateColumns.split(/\s+/).length,
            rows: new Set(cards.map((card) => card.getBoundingClientRect().top))
              .size,
            completeCards: cards.every(fits),
            completeLabels: [
              ...element.querySelectorAll(".tile-title, .tile-meta"),
            ].every(fits),
            focusableLinks: links.filter((link) => link.tabIndex >= 0).length,
            horizontalOverflow:
              document.documentElement.scrollWidth > innerWidth,
          };
        }),
      )
      .toEqual({
        columns,
        rows: Math.ceil(Math.min(28, rows * columns) / columns),
        completeCards: true,
        completeLabels: true,
        focusableLinks: Math.min(28, rows * columns),
        horizontalOverflow: false,
      });
  }
}
