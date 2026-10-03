import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAdapter } from "../browser";
import { createPreviewAdapter } from "../browser/preview";
import { defaults } from "../storage/settings";
import type { RawBookmark } from "../types/browser";
import { createRuntime } from "./runtime";

vi.mock("../browser", () => ({ createAdapter: vi.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("runtime startup and icon cleanup", () => {
  let runtime: ReturnType<typeof createRuntime>;
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    runtime?.stop();
    vi.restoreAllMocks();
  });

  async function setup() {
    const adapter = createPreviewAdapter();
    const tree = await adapter.getTree();
    await adapter.write("pinora.settings", {
      ...structuredClone(defaults),
      iconMappings: { "demo-code": "kept-icon", deleted: "orphan-icon" },
    });
    let changed!: () => void;
    vi.spyOn(adapter, "onBookmarksChanged").mockImplementation((listener) => {
      changed = listener;
      return () => undefined;
    });
    const initial = deferred<RawBookmark[]>();
    const latest = deferred<RawBookmark[]>();
    const getTree = vi
      .spyOn(adapter, "getTree")
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(latest.promise);
    const write = vi.spyOn(adapter, "write");
    vi.mocked(createAdapter).mockReturnValue(adapter);
    runtime = createRuntime();
    const starting = runtime.start();
    await vi.waitFor(() => expect(getTree).toHaveBeenCalledTimes(1));
    changed();
    expect(getTree).toHaveBeenCalledTimes(2);
    return { adapter, tree, initial, latest, write, starting };
  }

  it("waits for the superseding snapshot before pruning persisted icons", async () => {
    const { adapter, tree, initial, latest, write, starting } = await setup();
    const settled = vi.fn();
    void starting.then(settled);
    initial.resolve(tree);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(runtime.settings.value.iconMappings["demo-code"]).toBe("kept-icon");
    latest.resolve(tree);
    await starting;
    await vi.waitFor(() =>
      expect(runtime.settings.value.iconMappings).toEqual({
        "demo-code": "kept-icon",
      }),
    );
    expect(await adapter.read("pinora.settings")).toMatchObject({
      iconMappings: { "demo-code": "kept-icon" },
    });
  });

  it("keeps all mappings if the latest startup read fails, then supports retry", async () => {
    const { tree, initial, latest, write, starting } = await setup();
    const failed = expect(starting).rejects.toThrow("latest read failed");
    initial.resolve(tree);
    latest.reject(new Error("latest read failed"));
    await failed;
    expect(write).not.toHaveBeenCalled();
    expect(runtime.settings.value.iconMappings).toEqual({
      "demo-code": "kept-icon",
      deleted: "orphan-icon",
    });
    await runtime.start();
    await vi.waitFor(() =>
      expect(runtime.settings.value.iconMappings).toEqual({
        "demo-code": "kept-icon",
      }),
    );
  });

  it("ignores an obsolete read failure when the latest snapshot succeeds", async () => {
    const { tree, initial, latest, starting } = await setup();
    latest.resolve(tree);
    initial.reject(new Error("obsolete failure"));
    await starting;
    expect(runtime.bookmarks.error).toBeNull();
    expect(runtime.bookmarks.tree.nodes.has("demo-code")).toBe(true);
    await vi.waitFor(() =>
      expect(runtime.settings.value.iconMappings).toEqual({
        "demo-code": "kept-icon",
      }),
    );
  });

  it("notifies delayed cleanup failures, retains them across unrelated saves, and clears on retry", async () => {
    const adapter = createPreviewAdapter();
    vi.mocked(createAdapter).mockReturnValue(adapter);
    runtime = createRuntime();
    const failed = deferred<void>();
    vi.spyOn(runtime.settings, "pruneIcons")
      .mockReturnValueOnce(failed.promise)
      .mockResolvedValue();
    await runtime.start();
    const changed = vi.fn();
    runtime.settings.subscribe(changed);
    failed.reject(new Error("injected cleanup failure"));
    await vi.waitFor(() =>
      expect(runtime.settings.maintenanceError).toContain(
        "injected cleanup failure",
      ),
    );
    expect(changed).toHaveBeenCalled();
    await runtime.settings.update((draft) => {
      draft.theme = "dark";
    });
    runtime.settings.reportMaintenanceError("assets", null);
    expect(runtime.settings.maintenanceError).toContain(
      "injected cleanup failure",
    );
    await runtime.bookmarks.refresh();
    await vi.waitFor(() =>
      expect(runtime.settings.maintenanceError).toBeNull(),
    );
  });
});
