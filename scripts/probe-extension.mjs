import { chromium } from "@playwright/test";
import { mkdir, mkdtemp } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
await mkdir(".test-profiles", { recursive: true });
await mkdir("artifacts", { recursive: true });
const profile = await mkdtemp(path.join(root, ".test-profiles", "probe-"));
const extension = path.join(root, "dist");
const context = await chromium.launchPersistentContext(profile, {
  channel: "chromium",
  headless: true,
  viewport: { width: 1440, height: 1000 },
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
  ],
});
try {
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("CONSOLE ERROR", msg.text());
  });
  await page.goto("chrome://newtab/");
  await page.getByRole("heading", { level: 1 }).waitFor();
  console.log(
    JSON.stringify(
      await page.evaluate(async () => ({
        url: location.href,
        id: chrome.runtime.id,
        tree: await chrome.bookmarks.getTree(),
        manifest: chrome.runtime.getManifest(),
      })),
      null,
      2,
    ),
  );
  await page.screenshot({ path: "artifacts/initial.png", fullPage: true });
} finally {
  await context.close();
}
