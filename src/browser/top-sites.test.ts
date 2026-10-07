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
  const topSites = { get: vi.fn().mockResolvedValue([]) };
  vi.stubGlobal("chrome", { permissions, topSites });
  return { permissions, topSites };
}

afterEach(() => vi.unstubAllGlobals());

describe("popular browser sites", () => {
  it("never reads top sites without permission and requests directly in the gesture", async () => {
    const { permissions, topSites } = setup();
    expect(await chromiumAdapter.hasTopSitesPermission()).toBe(false);
    expect(await chromiumAdapter.getTopSites()).toEqual([]);
    expect(topSites.get).not.toHaveBeenCalled();
    permissions.contains.mockClear();
    const request = chromiumAdapter.requestTopSitesPermission();
    expect(permissions.request).toHaveBeenCalledWith({
      permissions: ["topSites"],
    });
    expect(permissions.contains).not.toHaveBeenCalled();
    expect(await request).toBe(false);
  });

  it("filters unsafe URLs, falls back titles, deduplicates and limits", async () => {
    const { topSites } = setup(true);
    topSites.get.mockResolvedValue([
      { title: "", url: "https://same.example/" },
      { title: "duplicate", url: "https://same.example/" },
      { title: "internal", url: "chrome://settings" },
      { title: "bad", url: "not-a-url" },
      { title: "script", url: "javascript:alert(1)" },
      ...Array.from({ length: 30 }, (_, i) => ({
        title: `Site ${i}`,
        url: `https://example.com/${i}`,
      })),
    ]);
    const sites = await chromiumAdapter.getTopSites();
    expect(sites).toHaveLength(28);
    expect(sites[0]).toEqual({
      title: "https://same.example/",
      url: "https://same.example/",
    });
    expect(sites.map(({ url }) => url)).toEqual([
      "https://same.example/",
      ...Array.from({ length: 27 }, (_, i) => `https://example.com/${i}`),
    ]);
  });

  it("notifies on permission grant/revoke and cleans up", () => {
    const { permissions } = setup();
    const listener = vi.fn();
    const dispose = chromiumAdapter.onTopSitesChanged(listener);
    permissions.onAdded.emit({ permissions: ["history"] });
    expect(listener).not.toHaveBeenCalled();
    permissions.onAdded.emit({ permissions: ["topSites"] });
    permissions.onRemoved.emit({ permissions: ["topSites"] });
    expect(listener).toHaveBeenCalledTimes(2);
    dispose();
    permissions.onAdded.emit({ permissions: ["topSites"] });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(permissions.onAdded.listeners.size).toBe(0);
    expect(permissions.onRemoved.listeners.size).toBe(0);
  });

  it("does not fabricate preview popular sites or permission", async () => {
    const adapter = createPreviewAdapter();
    expect(await adapter.hasTopSitesPermission()).toBe(false);
    expect(await adapter.requestTopSitesPermission()).toBe(false);
    expect(await adapter.getTopSites()).toEqual([]);
    const listener = vi.fn();
    adapter.onTopSitesChanged(listener)();
    expect(listener).not.toHaveBeenCalled();
  });
});
