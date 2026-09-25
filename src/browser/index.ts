import type { BrowserAdapter } from "../types/browser";
import { chromiumAdapter, isExtension } from "./chromium";
import { createPreviewAdapter } from "./preview";
export function createAdapter(): BrowserAdapter {
  if (isExtension()) return chromiumAdapter;
  if (new URLSearchParams(location.search).get("preview") === "1")
    return createPreviewAdapter();
  throw new Error(
    "请作为浏览器扩展加载 Pinora。开发预览请使用 ?preview=1（仅演示数据）。",
  );
}
