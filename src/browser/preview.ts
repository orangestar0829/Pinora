import type { BrowserAdapter, RawBookmark } from "../types/browser";
import { normalizeUrl } from "../domain/url";
// Synthetic demonstration data, only instantiated with explicit ?preview=1 outside extensions.
export function createPreviewAdapter(): BrowserAdapter {
  const tree: RawBookmark[] = [
    {
      id: "demo-root",
      title: "全部书签",
      children: [
        {
          id: "demo-bar",
          title: "书签栏",
          children: [
            {
              id: "demo-work",
              title: "工作空间",
              children: [
                {
                  id: "demo-mdn",
                  title: "MDN Web Docs",
                  url: "https://developer.mozilla.org/",
                },
              ],
            },
            {
              id: "demo-design",
              title: "设计灵感",
              children: [
                {
                  id: "demo-example",
                  title: "Example",
                  url: "https://example.com/",
                },
              ],
            },
            { id: "demo-code", title: "GitHub", url: "https://github.com/" },
            {
              id: "demo-wiki",
              title: "Wikipedia",
              url: "https://wikipedia.org/",
            },
          ],
        },
        { id: "demo-other", title: "其他书签", children: [] },
      ],
    },
  ];
  const listeners = new Set<() => void>();
  const storageListeners = new Map<string, Set<(value: unknown) => void>>();
  const find = (id: string): RawBookmark => {
    const stack = [...tree];
    while (stack.length) {
      const n = stack.pop()!;
      if (n.id === id) return n;
      stack.push(...(n.children ?? []));
    }
    throw new Error("演示项目不存在。");
  };
  const parent = (id: string): RawBookmark => {
    const stack = [...tree];
    while (stack.length) {
      const n = stack.pop()!;
      if (n.children?.some((c) => c.id === id)) return n;
      stack.push(...(n.children ?? []));
    }
    throw new Error("演示父目录不存在。");
  };
  const emit = () => listeners.forEach((l) => l());
  return {
    preview: true,
    getTree: async () => structuredClone(tree),
    create: async (input) => {
      const n = {
        ...input,
        id: crypto.randomUUID(),
        ...(input.url === undefined ? { children: [] } : {}),
      };
      find(input.parentId).children!.push(n);
      emit();
      return n;
    },
    update: async (id, input) => {
      const n = find(id);
      Object.assign(n, input);
      emit();
      return n;
    },
    remove: async (id) => {
      const p = parent(id);
      p.children = p.children!.filter((n) => n.id !== id);
      emit();
    },
    move: async (id, parentId, index) => {
      const n = find(id);
      const p = parent(id);
      p.children = p.children!.filter((c) => c.id !== id);
      const target = find(parentId);
      target.children!.splice(index ?? target.children!.length, 0, n);
      n.parentId = parentId;
      emit();
      return n;
    },
    onBookmarksChanged: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    read: async (key) => {
      const raw = localStorage.getItem(`preview.${key}`);
      return raw ? (JSON.parse(raw) as unknown) : undefined;
    },
    write: async (key, value) => {
      localStorage.setItem(`preview.${key}`, JSON.stringify(value));
      storageListeners.get(key)?.forEach((l) => l(value));
    },
    onStorageChanged: (key, listener) => {
      const set = storageListeners.get(key) ?? new Set();
      set.add(listener);
      storageListeners.set(key, set);
      const handler = (event: StorageEvent) => {
        if (event.key === `preview.${key}`)
          listener(
            event.newValue
              ? (JSON.parse(event.newValue) as unknown)
              : undefined,
          );
      };
      window.addEventListener("storage", handler);
      return () => {
        set.delete(listener);
        window.removeEventListener("storage", handler);
      };
    },
    favicon: () => undefined,
    open: async (url, mode) => {
      const safe = normalizeUrl(url);
      if (mode === "current") location.assign(safe);
      else {
        const tab = window.open(safe, "_blank", "noopener,noreferrer");
        if (!tab) throw new Error("浏览器可能已拦截新标签页。");
      }
    },
  };
}
