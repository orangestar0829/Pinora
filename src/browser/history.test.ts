import { afterEach, describe, expect, it, vi } from "vitest";
import { chromiumAdapter } from "./chromium";
import { createPreviewAdapter } from "./preview";

function event<T extends unknown[]>() {
  const listeners = new Set<(...args: T) => void>();
  return {
    listeners,
    addListener: (listener: (...args: T) => void) => listeners.add(listener),
    removeListener: (listener: (...args: T) => void) =>
      listeners.delete(listener),
    emit: (...args: T) => listeners.forEach((listener) => listener(...args)),
  };
}
function setup(granted = false) {
  const permissions = {
    contains: vi.fn().mockResolvedValue(granted),
    request: vi.fn().mockResolvedValue(false),
    onAdded: event<[chrome.permissions.Permissions]>(),
    onRemoved: event<[chrome.permissions.Permissions]>(),
  };
  const history = {
    search: vi.fn().mockResolvedValue([]),
    onVisited: event<[]>(),
    onVisitRemoved: event<[]>(),
  };
  vi.stubGlobal("chrome", { permissions, history });
  return { permissions, history };
}
afterEach(() => vi.unstubAllGlobals());

describe("recent browser visits", () => {
  it("never reads history without permission and requests directly in the gesture", async () => {
    const { permissions, history } = setup();
    expect(await chromiumAdapter.hasHistoryPermission()).toBe(false);
    expect(await chromiumAdapter.getRecentVisits()).toEqual([]);
    expect(history.search).not.toHaveBeenCalled();
    permissions.contains.mockClear();
    const request = chromiumAdapter.requestHistoryPermission();
    expect(permissions.request).toHaveBeenCalledWith({
      permissions: ["history"],
    });
    expect(permissions.contains).not.toHaveBeenCalled();
    expect(await request).toBe(false);
  });

  it("filters unsafe or unvisited URLs, sorts stably, deduplicates and limits", async () => {
    const { history } = setup(true);
    const item = (id: string, url: string, lastVisitTime?: number) => ({
      id,
      url,
      lastVisitTime,
    });
    history.search.mockResolvedValue([
      item("older-duplicate", "https://same.example/", 1),
      item("internal", "chrome://settings/", 500),
      item("bad", "not a url", 500),
      item("script", "javascript:alert(1)", 500),
      item("file", "file:///tmp/file", 500),
      item("zero", "https://zero.example/", 0),
      item("missing", "https://missing.example/"),
      item("infinity", "https://infinity.example/", Infinity),
      item("negative", "https://negative.example/", -1),
      item("new-duplicate", "https://same.example/", 100),
      item("tie", "http://tie.example/", 100),
      ...Array.from({ length: 40 }, (_, i) =>
        item(String(i), `https://example.com/${i}`, i + 2),
      ),
    ]);
    const visits = await chromiumAdapter.getRecentVisits();
    expect(history.search).toHaveBeenCalledWith({
      text: "",
      startTime: 0,
      maxResults: 100,
    });
    expect(visits).toHaveLength(28);
    expect(visits.map(({ id }) => id)).toEqual([
      "new-duplicate",
      "tie",
      ...Array.from({ length: 26 }, (_, i) => String(39 - i)),
    ]);
    expect(visits[0].title).toBe("https://same.example/");
  });

  it("attaches on permission grant and immediately notifies/detaches on removal", async () => {
    const { permissions, history } = setup();
    const listener = vi.fn();
    const dispose = chromiumAdapter.onHistoryChanged(listener);
    await Promise.resolve();
    expect(history.onVisited.listeners.size).toBe(0);
    permissions.onAdded.emit({ permissions: ["storage"] });
    expect(listener).not.toHaveBeenCalled();
    permissions.onAdded.emit({ permissions: ["history"] });
    history.onVisited.emit();
    history.onVisitRemoved.emit();
    expect(listener).toHaveBeenCalledTimes(3);
    permissions.onRemoved.emit({ permissions: ["history"] });
    expect(listener).toHaveBeenCalledTimes(4);
    expect(history.onVisited.listeners.size).toBe(0);
    permissions.onAdded.emit({ permissions: ["history"] });
    expect(history.onVisited.listeners.size).toBe(1);
    dispose();
    expect(history.onVisited.listeners.size).toBe(0);
    expect(history.onVisitRemoved.listeners.size).toBe(0);
    expect(permissions.onAdded.listeners.size).toBe(0);
    expect(permissions.onRemoved.listeners.size).toBe(0);
  });

  it.each(["dispose", "revoke"])(
    "ignores stale initial permission resolution after %s",
    async (action) => {
      const { permissions, history } = setup();
      let resolve!: (value: boolean) => void;
      permissions.contains.mockReturnValue(
        new Promise<boolean>((done) => {
          resolve = done;
        }),
      );
      const listener = vi.fn();
      const dispose = chromiumAdapter.onHistoryChanged(listener);
      if (action === "dispose") dispose();
      else permissions.onRemoved.emit({ permissions: ["history"] });
      resolve(true);
      await Promise.resolve();
      expect(history.onVisited.listeners.size).toBe(0);
      dispose();
    },
  );

  it("attaches existing permission and tolerates a rejected initial check", async () => {
    const { permissions, history } = setup(true);
    const dispose = chromiumAdapter.onHistoryChanged(vi.fn());
    await Promise.resolve();
    expect(history.onVisited.listeners.size).toBe(1);
    dispose();
    permissions.contains.mockRejectedValue(new Error("unavailable"));
    const disposeRejected = chromiumAdapter.onHistoryChanged(vi.fn());
    await Promise.resolve();
    expect(history.onVisited.listeners.size).toBe(0);
    disposeRejected();
  });

  it("wraps history read failures with operation context", async () => {
    const { history } = setup(true);
    history.search.mockRejectedValue(new Error("denied"));
    await expect(chromiumAdapter.getRecentVisits()).rejects.toThrow(
      "读取最近访问失败：denied",
    );
  });

  it("does not fabricate preview history or permission", async () => {
    const adapter = createPreviewAdapter();
    expect(await adapter.hasHistoryPermission()).toBe(false);
    expect(await adapter.requestHistoryPermission()).toBe(false);
    expect(await adapter.getRecentVisits()).toEqual([]);
    const listener = vi.fn();
    adapter.onHistoryChanged(listener)();
    expect(listener).not.toHaveBeenCalled();
  });
});
