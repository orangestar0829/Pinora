import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Runtime } from "../../app/runtime";
import { createPreviewAdapter } from "../../browser/preview";
import { defaults } from "../../storage/settings";
import { RecentVisits } from "./RecentVisits";
import { TopSites } from "./TopSites";

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

for (const Component of [RecentVisits, TopSites]) {
  describe(Component.name, () => {
    async function mount() {
      const entries = [
        {
          id: "visit",
          title: "Focus fixture",
          url: "https://focus.example.test/",
          lastVisitTime: 1,
        },
      ];
      const read = vi.fn().mockResolvedValue(entries);
      const permission = vi.fn().mockResolvedValue(true);
      let changed!: () => void;
      const subscribe = (listener: () => void) => {
        changed = listener;
        return () => {};
      };
      const adapter = {
        ...createPreviewAdapter(),
        preview: false,
        hasHistoryPermission: permission,
        hasTopSitesPermission: permission,
        getRecentVisits: read,
        getTopSites: read,
        onHistoryChanged: subscribe,
        onTopSitesChanged: subscribe,
        open: vi.fn().mockResolvedValue(undefined),
      };
      const runtime = {
        adapter,
        settings: { value: defaults },
      } as unknown as Runtime;
      await act(async () => root.render(createElement(Component, { runtime })));
      const card = host.querySelector<HTMLAnchorElement>(".tile-main")!;
      expect(card).not.toBeNull();
      return { entries, read, permission, changed, adapter, card };
    }

    it("keeps the same clickable link through focus and visibility refreshes", async () => {
      const { entries, read, adapter, card } = await mount();
      for (const target of [window, document]) {
        const pending = deferred<typeof entries>();
        read.mockReturnValueOnce(pending.promise);
        await act(async () => {
          target.dispatchEvent(
            new Event(target === window ? "focus" : "visibilitychange"),
          );
        });
        expect(host.querySelector(".tile-main")).toBe(card);
        await act(async () => {
          card.click();
        });
        expect(adapter.open).toHaveBeenLastCalledWith(
          entries[0].url,
          "current",
        );
        await act(async () => pending.resolve(entries));
        expect(host.querySelector(".tile-main")).toBe(card);
      }
      expect(adapter.open).toHaveBeenCalledTimes(2);
    });

    it("clears cards when a focus permission check is denied", async () => {
      const { read, permission } = await mount();
      read.mockClear();
      permission.mockResolvedValue(false);
      await act(async () => {
        window.dispatchEvent(new Event("focus"));
      });
      expect(host.querySelector(".tile-main")).toBeNull();
      expect(host.textContent).toContain("权限");
      expect(read).not.toHaveBeenCalled();
    });

    if (Component === RecentVisits) {
      it("clears retained history if permission is lost before the read finishes", async () => {
        const { entries, read, permission } = await mount();
        const pending = deferred<typeof entries>();
        read.mockReturnValueOnce(pending.promise);
        await act(async () => {
          window.dispatchEvent(new Event("focus"));
        });
        permission.mockResolvedValue(false);
        await act(async () => pending.resolve(entries));
        expect(host.querySelector(".tile-main")).toBeNull();
        expect(host.textContent).toContain("权限");
      });
    }

    it("immediately clears on a permission event and ignores an older focus read", async () => {
      const { entries, read, permission, changed } = await mount();
      const pending = deferred<typeof entries>();
      read.mockReturnValueOnce(pending.promise);
      await act(async () => {
        window.dispatchEvent(new Event("focus"));
      });
      permission.mockResolvedValue(false);
      await act(async () => changed());
      expect(host.querySelector(".tile-main")).toBeNull();
      await act(async () => pending.resolve(entries));
      expect(host.querySelector(".tile-main")).toBeNull();
      expect(host.textContent).toContain("权限");
    });

    it("clears cards and exposes a failed focus refresh", async () => {
      const { read } = await mount();
      read.mockRejectedValueOnce(new Error("focus read failed"));
      await act(async () => {
        window.dispatchEvent(new Event("focus"));
      });
      expect(host.querySelector(".tile-main")).toBeNull();
      expect(host.querySelector('[role="alert"]')?.textContent).toContain(
        "focus read failed",
      );
    });
  });
}
