import type {
  BrowserAdapter,
  PopularSite,
  RecentVisit,
} from "../types/browser";
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
  hasHistoryPermission: () =>
    call("检查历史记录权限", () =>
      chrome.permissions.contains({ permissions: ["history"] }),
    ),
  // Keep the browser permission request itself on the synchronous click stack.
  // Wrapping the API call in an async helper can make Chromium/Edge reject it
  // as a missing user gesture even when the helper invokes its action eagerly.
  requestHistoryPermission: () => {
    try {
      return chrome.permissions
        .request({ permissions: ["history"] })
        .catch((error) => {
          throw new Error(
            `申请历史记录权限失败：${error instanceof Error ? error.message : String(error)}`,
          );
        });
    } catch (error) {
      return Promise.reject(
        new Error(
          `申请历史记录权限失败：${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  },
  getRecentVisits: () =>
    call("读取最近访问", async () => {
      if (!(await chrome.permissions.contains({ permissions: ["history"] })))
        return [];
      const items = await chrome.history.search({
        text: "",
        startTime: 0,
        maxResults: 100,
      });
      const visits: RecentVisit[] = [];
      for (const item of items) {
        if (
          !item.url ||
          !Number.isFinite(item.lastVisitTime) ||
          (item.lastVisitTime ?? 0) <= 0
        )
          continue;
        try {
          const url = new URL(item.url);
          if (url.protocol !== "http:" && url.protocol !== "https:") continue;
        } catch {
          continue;
        }
        visits.push({
          id: item.id,
          title: item.title || item.url,
          url: item.url,
          lastVisitTime: item.lastVisitTime!,
        });
      }
      visits.sort((a, b) => b.lastVisitTime - a.lastVisitTime);
      const seen = new Set<string>();
      return visits
        .filter(({ url }) => {
          if (seen.has(url)) return false;
          seen.add(url);
          return true;
        })
        .slice(0, 28);
    }),
  onHistoryChanged(listener) {
    let disposed = false;
    let revision = 0;
    let attached: typeof chrome.history | undefined;
    const detach = () => {
      attached?.onVisited.removeListener(listener);
      attached?.onVisitRemoved.removeListener(listener);
      attached = undefined;
    };
    const attach = () => {
      if (disposed || attached || !chrome.history) return;
      attached = chrome.history;
      attached.onVisited.addListener(listener);
      attached.onVisitRemoved.addListener(listener);
    };
    const added = (permissions: chrome.permissions.Permissions) => {
      if (!permissions.permissions?.includes("history")) return;
      revision++;
      attach();
      listener();
    };
    const removed = (permissions: chrome.permissions.Permissions) => {
      if (!permissions.permissions?.includes("history")) return;
      revision++;
      detach();
      listener();
    };
    chrome.permissions.onAdded.addListener(added);
    chrome.permissions.onRemoved.addListener(removed);
    const initialRevision = revision;
    void chrome.permissions.contains({ permissions: ["history"] }).then(
      (granted) => {
        if (!disposed && revision === initialRevision && granted) attach();
      },
      () => {
        /* The explicit permission/read calls report errors to the UI. */
      },
    );
    return () => {
      disposed = true;
      detach();
      chrome.permissions.onAdded.removeListener(added);
      chrome.permissions.onRemoved.removeListener(removed);
    };
  },
  hasTopSitesPermission: () =>
    call("检查热门网站权限", () =>
      chrome.permissions.contains({ permissions: ["topSites"] }),
    ),
  requestTopSitesPermission: () => {
    try {
      return chrome.permissions
        .request({ permissions: ["topSites"] })
        .catch((error) => {
          throw new Error(
            `申请热门网站权限失败：${error instanceof Error ? error.message : String(error)}`,
          );
        });
    } catch (error) {
      return Promise.reject(
        new Error(
          `申请热门网站权限失败：${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  },
  getTopSites: () =>
    call("读取热门网站", async () => {
      if (!(await chrome.permissions.contains({ permissions: ["topSites"] })))
        return [];
      const items = await chrome.topSites.get();
      const seen = new Set<string>();
      const sites: PopularSite[] = [];
      for (const item of items) {
        if (!item.url) continue;
        try {
          const url = new URL(item.url);
          if (url.protocol !== "http:" && url.protocol !== "https:") continue;
        } catch {
          continue;
        }
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        sites.push({ title: item.title || item.url, url: item.url });
        if (sites.length >= 28) break;
      }
      return sites;
    }),
  onTopSitesChanged(listener) {
    const added = (permissions: chrome.permissions.Permissions) => {
      if (permissions.permissions?.includes("topSites")) listener();
    };
    const removed = (permissions: chrome.permissions.Permissions) => {
      if (permissions.permissions?.includes("topSites")) listener();
    };
    chrome.permissions.onAdded.addListener(added);
    chrome.permissions.onRemoved.addListener(removed);
    return () => {
      chrome.permissions.onAdded.removeListener(added);
      chrome.permissions.onRemoved.removeListener(removed);
    };
  },
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
