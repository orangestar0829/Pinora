import type { BrowserAdapter } from "../types/browser";
import { installedExtensionAdapter } from "./webExtension";
import { createPreviewAdapter } from "./preview";
export function createAdapter(): BrowserAdapter {
  const installed = installedExtensionAdapter();
  if (installed) return installed;
  if (new URLSearchParams(location.search).get("preview") === "1")
    return createPreviewAdapter();
  throw new Error(
    "请作为浏览器扩展加载 Pinora。开发预览请使用 ?preview=1（仅演示数据）。",
  );
}
