import { afterEach, describe, expect, it, vi } from "vitest";
import { chromiumAdapter } from "./chromium";
afterEach(() => vi.unstubAllGlobals());
describe("Chromium move final-index contract", () => {
  it.each([
    [1, 0, 0],
    [0, 1, 2],
    [1, 1, 1],
    [0, 3, 4],
  ])(
    "source %s to final %s calls native index %s",
    async (source, final, native) => {
      const move = vi.fn().mockResolvedValue({ id: "node" });
      vi.stubGlobal("chrome", {
        bookmarks: {
          get: vi
            .fn()
            .mockResolvedValue([
              { id: "node", parentId: "parent", index: source },
            ]),
          move,
        },
      });
      await chromiumAdapter.move("node", "parent", final);
      expect(move).toHaveBeenCalledWith("node", {
        parentId: "parent",
        index: native,
      });
    },
  );
  it("cross-folder moves and append do not shift the destination", async () => {
    const move = vi.fn().mockResolvedValue({ id: "node" });
    vi.stubGlobal("chrome", {
      bookmarks: {
        get: vi.fn().mockResolvedValue([{ parentId: "old", index: 0 }]),
        move,
      },
    });
    await chromiumAdapter.move("node", "new", 2);
    expect(move).toHaveBeenLastCalledWith("node", {
      parentId: "new",
      index: 2,
    });
    await chromiumAdapter.move("node", "old");
    expect(move).toHaveBeenLastCalledWith("node", { parentId: "old" });
  });
});
