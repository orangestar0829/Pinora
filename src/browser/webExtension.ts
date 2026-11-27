import type {
  BrowserAdapter,
  PopularSite,
  RecentVisit,
} from "../types/browser";
import { normalizeUrl } from "../domain/url";

type ExtensionApi = Pick<
  typeof chrome,
  "bookmarks" | "history" | "permissions" | "runtime" | "storage" | "tabs"
> & {
  topSites: {
    get(options?: { limit: number }): Promise<chrome.topSites.MostVisitedURL[]>;
  };
};

declare const browser: ExtensionApi | undefined;

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
function createExtensionAdapter(
  api: () => ExtensionApi,
  firefox: boolean,
): BrowserAdapter {
  return {
    preview: false,
    hasHistoryPermission: () =>
      call("检查历史记录权限", () =>
        api().permissions.contains({ permissions: ["history"] }),
      ),
    // Keep the browser permission request itself on the synchronous click stack.
    // Wrapping the API call in an async helper can make Chromium/Edge reject it
    // as a missing user gesture even when the helper invokes its action eagerly.
    requestHistoryPermission: () => {
      try {
        return api()
          .permissions.request({ permissions: ["history"] })
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
        if (!(await api().permissions.contains({ permissions: ["history"] })))
          return [];
        const items = await api().history.search({
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
        // Firefox removes these events from even a retained history object on revocation.
        attached?.onVisited?.removeListener(listener);
        attached?.onVisitRemoved?.removeListener(listener);
        attached = undefined;
      };
      const attach = () => {
        if (disposed || attached || !api().history) return;
        attached = api().history;
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
      const { permissions } = api();
      permissions.onAdded.addListener(added);
      permissions.onRemoved.addListener(removed);
      const initialRevision = revision;
      void permissions.contains({ permissions: ["history"] }).then(
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
        permissions.onAdded.removeListener(added);
        permissions.onRemoved.removeListener(removed);
      };
    },
    hasTopSitesPermission: () =>
      call("检查热门网站权限", () =>
        api().permissions.contains({ permissions: ["topSites"] }),
      ),
    requestTopSitesPermission: () => {
      try {
        return api()
          .permissions.request({ permissions: ["topSites"] })
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
        if (!(await api().permissions.contains({ permissions: ["topSites"] })))
          return [];
        const { topSites } = api();
        const items = await (firefox
          ? topSites.get({ limit: 28 })
          : topSites.get());
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
      const { permissions } = api();
      permissions.onAdded.addListener(added);
      permissions.onRemoved.addListener(removed);
      return () => {
        permissions.onAdded.removeListener(added);
        permissions.onRemoved.removeListener(removed);
      };
    },
    getTree: () => call("读取书签", () => api().bookmarks.getTree()),
    create: (input) => call("创建书签", () => api().bookmarks.create(input)),
    update: (id, input) =>
      call("更新书签", () => api().bookmarks.update(id, input)),
    remove: (id, recursive) =>
      call("删除书签", () =>
        recursive ? api().bookmarks.removeTree(id) : api().bookmarks.remove(id),
      ),
    move: (id, parentId, index) =>
      call("移动书签", async () => {
        // The native index is measured before removing a same-parent source.
        // Read its current position so our adapter exposes final-index semantics.
        const { bookmarks } = api();
        const [node] = await bookmarks.get(id);
        const destinationIndex =
          index !== undefined &&
          node.parentId === parentId &&
          (node.index ?? 0) < index
            ? index + 1
            : index;
        return bookmarks.move(id, {
          parentId,
          ...(destinationIndex === undefined
            ? {}
            : { index: destinationIndex }),
        });
      }),
    onBookmarksChanged(listener) {
      const { bookmarks } = api();
      const events = [
        bookmarks.onCreated,
        bookmarks.onRemoved,
        bookmarks.onChanged,
        bookmarks.onMoved,
        bookmarks.onChildrenReordered,
      ];
      for (const event of events) event?.addListener(listener);
      return () => {
        for (const event of events) event?.removeListener(listener);
      };
    },
    read: (key) =>
      call("读取设置", async () => (await api().storage.local.get(key))[key]),
    write: (key, value) =>
      call("保存设置", () => api().storage.local.set({ [key]: value })),
    onStorageChanged(key, listener) {
      const handle = (
        changes: Record<string, chrome.storage.StorageChange>,
        area: string,
      ) => {
        if (area === "local" && changes[key]) listener(changes[key].newValue);
      };
      const { onChanged } = api().storage;
      onChanged.addListener(handle);
      return () => onChanged.removeListener(handle);
    },
    favicon(url, size = 64) {
      if (firefox) return undefined;
      const target = new URL(api().runtime.getURL("/_favicon/"));
      target.searchParams.set("pageUrl", url);
      target.searchParams.set("size", String(size));
      return target.href;
    },
    open: (url, mode) =>
      call("打开网址", async () => {
        const safe = normalizeUrl(url);
        const { tabs } = api();
        if (mode === "current") await tabs.update({ url: safe });
        else await tabs.create({ url: safe, active: mode !== "background" });
      }),
  };
}

export const chromiumAdapter = createExtensionAdapter(() => chrome, false);

export function installedExtensionAdapter(): BrowserAdapter | undefined {
  if (
    location.protocol === "moz-extension:" &&
    typeof browser !== "undefined"
  ) {
    const api = browser;
    return createExtensionAdapter(() => api, true);
  }
  if (typeof chrome !== "undefined" && chrome.runtime?.id && chrome.bookmarks)
    return chromiumAdapter;
}
