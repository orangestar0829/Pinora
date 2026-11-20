import { test, expect, chromium } from "@playwright/test";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const channel =
  process.env.PINORA_TEST_CHANNEL === "msedge" ? "msedge" : "chromium";

type FocusRefresh = Window & {
  clickedCard: HTMLAnchorElement;
  pendingReads: number;
};

for (const section of ["recent-visits", "top-sites"]) {
  test(`${section}: returning focus keeps the first click on the same card`, async () => {
    await mkdir(".test-profiles", { recursive: true });
    const profile = await mkdtemp(
      path.join(process.cwd(), ".test-profiles", "focus-navigation-"),
    );
    // Only this isolated copy has required grants; production keeps them optional.
    const extension = path.join(profile, "granted-test-extension");
    await cp(path.join(process.cwd(), "dist"), extension, { recursive: true });
    const manifestPath = path.join(extension, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.permissions.push("history", "topSites");
    delete manifest.optional_permissions;
    await writeFile(manifestPath, JSON.stringify(manifest));
    const context = await chromium.launchPersistentContext(profile, {
      channel,
      executablePath: process.env.PINORA_TEST_EXECUTABLE_PATH,
      headless: true,
      viewport: { width: 1280, height: 900 },
      args: [
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
      ],
    });
    try {
      await context.route("https://focus.example.test/**", (route) =>
        route.fulfill({
          contentType: "text/html; charset=utf-8",
          body: "<title>Single-click destination</title><h1>Opened once</h1>",
        }),
      );
      const page = await context.newPage();
      await page.goto(
        channel === "msedge" ? "edge://newtab/" : "chrome://newtab/",
      );
      await expect(page.locator(".loading-ring")).toHaveCount(0);
      await page.evaluate(async () => {
        chrome.topSites.get = async () => [
          {
            title: "Focus top site",
            url: "https://focus.example.test/popular",
          },
        ];
        await chrome.history.addUrl({
          url: "https://focus.example.test/recent",
        });
        await chrome.storage.local.set({
          "pinora.settings": {
            schemaVersion: 1,
            showRecentVisits: true,
            showTopSites: true,
          },
        });
        window.dispatchEvent(new Event("focus"));
      });
      await expect(page.locator(".recent-visits .tile-main")).toHaveCount(1);
      await expect(page.locator(".top-sites .tile-main")).toHaveCount(1);
      const card = page.locator(`.${section} .tile-main`);
      const destination = await card.getAttribute("href");
      await card.scrollIntoViewIfNeeded();
      const bounds = (await card.boundingBox())!;
      await page.evaluate((section) => {
        const gate = window as unknown as FocusRefresh;
        gate.clickedCard = document.querySelector<HTMLAnchorElement>(
          `.${section} .tile-main`,
        )!;
        gate.pendingReads = 0;
        const search = chrome.history.search.bind(chrome.history);
        const topSites = chrome.topSites.get.bind(chrome.topSites);
        const pause = () =>
          new Promise<void>(() => {
            gate.pendingReads++;
          });
        chrome.history.search = async (query) => {
          await pause();
          return search(query);
        };
        chrome.topSites.get = async () => {
          await pause();
          return topSites();
        };
      }, section);

      // Model the window-focus transition between mouse down and mouse up.
      // A locator click would retry a replaced card and hide the regression.
      await page.mouse.move(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
      );
      await page.mouse.down();
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect
        .poll(() =>
          page.evaluate(() => (window as unknown as FocusRefresh).pendingReads),
        )
        .toBe(2);
      expect(
        await page.evaluate(
          () => (window as unknown as FocusRefresh).clickedCard.isConnected,
        ),
      ).toBe(true);
      expect(
        await page.evaluate(
          ({ x, y }) => {
            const card = (window as unknown as FocusRefresh).clickedCard;
            return document.elementFromPoint(x, y)?.closest("a") === card;
          },
          { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
        ),
      ).toBe(true);
      await page.screenshot({
        path: test.info().outputPath(`${section}-focus-refresh.png`),
        animations: "disabled",
      });
      await page.mouse.up();
      await expect(page).toHaveURL(destination!);
      await expect(page.getByRole("heading")).toHaveText("Opened once");
    } finally {
      await context.close();
    }
  });
}
