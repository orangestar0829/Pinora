import { chromium, expect } from "@playwright/test";
import { mkdir, mkdtemp, readFile, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const output = path.join(root, "artifacts", "submission", `Pinora-${version}`, "assets");
await mkdir(output, { recursive: true });
await mkdir(".test-profiles", { recursive: true });
const profile = await mkdtemp(path.join(root, ".test-profiles", "store-assets-"));
const extension = path.join(root, "dist");
const context = await chromium.launchPersistentContext(profile, {
  channel: "msedge",
  headless: true,
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
  ],
});
try {
  const page = await context.newPage();
  const errors = [];
  const external = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/^https?:/.test(request.url())) external.push(request.url());
  });
  await page.goto("edge://newtab/");
  await expect(page.locator(".loading-ring")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(async () => {
    const [root] = await chrome.bookmarks.getTree();
    const bar = root.children.find((item) => item.folderType === "bookmarks-bar") ?? root.children[0];
    const home = await chrome.bookmarks.create({ parentId: bar.id, title: "常用书签" });
    for (const title of ["工作空间", "设计灵感", "阅读清单", "开发工具"]) {
      const folder = await chrome.bookmarks.create({ parentId: home.id, title });
      await chrome.bookmarks.create({ parentId: folder.id, title: "示例文档", url: "https://example.com/" });
    }
    for (const [title, url] of [
      ["GitHub", "https://github.com/"],
      ["MDN Web Docs", "https://developer.mozilla.org/"],
      ["Figma", "https://figma.com/"],
      ["Notion", "https://notion.so/"],
      ["Wikipedia", "https://wikipedia.org/"],
      ["Dribbble", "https://dribbble.com/"],
      ["Vercel", "https://vercel.com/"],
      ["Are.na", "https://are.na/"],
    ]) await chrome.bookmarks.create({ parentId: home.id, title, url });
    await chrome.storage.local.set({
      "pinora.settings": { schemaVersion: 1, bookmarkFolderId: home.id, theme: "light", showRecentVisits: false },
    });
  });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("常用书签");
  await expect(page.locator(".bookmark-tile")).toHaveCount(12);
  const demoIcons = [
    ["GitHub", "G", "#52665c"],
    ["MDN Web Docs", "M", "#62788b"],
    ["Figma", "F", "#9b786a"],
    ["Notion", "N", "#73746c"],
    ["Wikipedia", "W", "#81778f"],
    ["Dribbble", "D", "#a17680"],
    ["Vercel", "V", "#5b7777"],
    ["Are.na", "A", "#93845d"],
  ];
  const glyphs = {
    G: "M93 38H40V92H93V62H65V75H79V79H54V51H93Z",
    M: "M32 91V37H47L64 65L81 37H96V91H82V61L64 85L46 61V91Z",
    F: "M40 36H92V50H55V60H86V74H55V92H40Z",
    N: "M36 92V36H51L77 70V36H92V92H77L51 58V92Z",
    W: "M25 36H40L48 72L57 42H71L80 72L88 36H103L89 92H74L64 60L54 92V92H39Z",
    D: "M38 36H63C84 36 96 47 96 64S84 92 63 92H38ZM53 50V78H63C75 78 81 73 81 64S75 50 63 50Z",
    V: "M30 36H46L64 76L82 36H98L72 92H56Z",
    A: "M29 92L54 36H74L99 92H83L78 80H50L45 92ZM56 66H72L64 47Z",
  };
  for (const [title, letter, color] of demoIcons) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="32" fill="${color}"/><path d="${glyphs[letter]}" fill="#fffdf6" fill-rule="evenodd"/></svg>`;
    await page.getByRole("button", { name: `管理 ${title}`, exact: true }).click();
    await page.getByRole("menuitem", { name: "自定义图标", exact: true }).click();
    await page.getByLabel("上传自定义图标").setInputFiles({ name: "demo-icon.svg", mimeType: "image/svg+xml", buffer: Buffer.from(svg) });
    await expect(page.getByLabel("图标裁剪预览")).toBeVisible();
    await page.getByRole("button", { name: "保存图标", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".bookmark-tile").filter({ has: page.locator(".tile-title").getByText(title, { exact: true }) }).locator("img")).toHaveAttribute("src", /^blob:/);
  }
  await page.evaluate(() => document.fonts.ready);
  const capture = async (name) => {
    await page.screenshot({ path: path.join(output, name), animations: "disabled" });
  };
  const openSettings = () => page.getByRole("button", { name: "外观与设置", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await capture("01-light.png");
  await openSettings();
  await dialog.getByRole("button", { name: "深色", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  await capture("02-dark.png");
  await openSettings();
  await dialog.getByRole("button", { name: "浅色", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await capture("03-settings.png");

  const svg = await readFile("public/logo.svg", "utf8");
  const png = await page.evaluate(async (svg) => {
    const image = new Image();
    image.src = `data:image/svg+xml;base64,${btoa(svg)}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 300;
    canvas.getContext("2d").drawImage(image, 0, 0, 300, 300);
    return canvas.toDataURL("image/png").split(",")[1];
  }, svg);
  await writeFile(path.join(output, "icon-300.png"), Buffer.from(png, "base64"));
  await copyFile("public/icons/icon-128.png", path.join(output, "icon-128.png"));
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  const record = {
    browser: `Microsoft Edge ${context.browser().version()}`,
    viewport: { width: 1280, height: 800 },
    syntheticBookmarks: true,
    customDemoIcons: true,
    errors,
    externalPageRequests: external,
    screenshots: ["01-light.png", "02-dark.png", "03-settings.png"],
  };
  await writeFile(path.join(output, "capture.json"), `${JSON.stringify(record, null, 2)}\n`);
  console.log(`Store assets: ${output}`);
} finally {
  await context.close();
}
