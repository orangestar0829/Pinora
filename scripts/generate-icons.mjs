import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
// Rasterize our own SVG once. This script is a development tool, never shipped.
const svg = await readFile("public/logo.svg", "utf8");
const browser = await chromium.launch({ channel: "chromium", headless: true });
try {
  const page = await browser.newPage();
  await mkdir("public/icons", { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    const png = await page.evaluate(
      async ({ svg, size }) => {
        const img = new Image();
        img.src = `data:image/svg+xml;base64,${btoa(svg)}`;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        canvas.getContext("2d").drawImage(img, 0, 0, size, size);
        return canvas.toDataURL("image/png").split(",")[1];
      },
      { svg, size },
    );
    await writeFile(
      `public/icons/icon-${size}.png`,
      Buffer.from(png, "base64"),
    );
  }
} finally {
  await browser.close();
}
