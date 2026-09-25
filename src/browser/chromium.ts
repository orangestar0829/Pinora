import type { BrowserAdapter } from "../types/browser";
import { normalizeUrl } from "../domain/url";
async function call<T>(
  operation: string,
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw new Error(
      `${operation}失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
export const chromiumAdapter: BrowserAdapter = {
  preview: false,
  getTree: () => call("读取书签", () => chrome.bookmarks.getTree()),
  create: (input) => call("创建书签", () => chrome.bookmarks.create(input)),
  update: (id, input) =>
    call("更新书签", () => chrome.bookmarks.update(id, input)),
  remove: (id, recursive) =>
    call("删除书签", () =>
      recursive ? chrome.bookmarks.removeTree(id) : chrome.bookmarks.remove(id),
    ),
  move: (id, parentId, index) =>
    call("移动书签", async () => {
      // Chrome's index is measured before removing a same-parent source.
      // Read its current position so our adapter exposes final-index semantics.
      const [node] = await chrome.bookmarks.get(id);
      const destinationIndex =
        index !== undefined &&
        node.parentId === parentId &&
        (node.index ?? 0) < index
          ? index + 1
          : index;
      return chrome.bookmarks.move(id, {
        parentId,
        ...(destinationIndex === undefined ? {} : { index: destinationIndex }),
      });
    }),
  onBookmarksChanged(listener) {
    const events = [
      chrome.bookmarks.onCreated,
      chrome.bookmarks.onRemoved,
      chrome.bookmarks.onChanged,
      chrome.bookmarks.onMoved,
      chrome.bookmarks.onChildrenReordered,
    ];
    for (const event of events) event.addListener(listener);
    return () => {
      for (const event of events) event.removeListener(listener);
    };
  },
  read: (key) =>
    call("读取设置", async () => (await chrome.storage.local.get(key))[key]),
  write: (key, value) =>
    call("保存设置", () => chrome.storage.local.set({ [key]: value })),
  onStorageChanged(key, listener) {
    const handle = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === "local" && changes[key]) listener(changes[key].newValue);
    };
    chrome.storage.onChanged.addListener(handle);
    return () => chrome.storage.onChanged.removeListener(handle);
  },
  favicon(url, size = 64) {
    const target = new URL(chrome.runtime.getURL("/_favicon/"));
    target.searchParams.set("pageUrl", url);
    target.searchParams.set("size", String(size));
    return target.href;
  },
  open: (url, mode) =>
    call("打开网址", async () => {
      const safe = normalizeUrl(url);
      if (mode === "current") await chrome.tabs.update({ url: safe });
      else
        await chrome.tabs.create({ url: safe, active: mode !== "background" });
    }),
};
export function isExtension(): boolean {
  return (
    typeof chrome !== "undefined" && !!chrome.runtime?.id && !!chrome.bookmarks
  );
}
