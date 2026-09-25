import { describe, expect, it, vi } from "vitest";
import { BookmarkService } from "./bookmarks";
import { createPreviewAdapter } from "../browser/preview";
import { initialFolder } from "./tree";
import type { RawBookmark } from "../types/browser";

async function setup() {
  const adapter = createPreviewAdapter();
  const service = new BookmarkService(adapter);
  await service.start();
  return { adapter, service, parent: initialFolder(service.tree)! };
}
describe("bookmark service with event-driven native adapter contract", () => {
  it("creates folder/bookmark, normalizes URL, renames, moves, and deletes", async () => {
    const { service, parent } = await setup();
    const folder = await service.create(parent, "我的文件夹");
    const bookmark = await service.create(parent, "新站点", "example.com/path");
    expect(service.tree.nodes.get(bookmark.id)?.url).toBe(
      "https://example.com/path",
    );
    await service.update(bookmark.id, "已改名");
    expect(service.tree.nodes.get(bookmark.id)?.title).toBe("已改名");
    await service.move(bookmark.id, folder.id);
    expect(service.tree.nodes.get(bookmark.id)?.parentId).toBe(folder.id);
    await expect(service.remove(folder.id)).rejects.toThrow("请明确确认");
    await service.remove(folder.id, true);
    expect(service.tree.nodes.has(bookmark.id)).toBe(false);
    service.stop();
  });
  it("preserves the final-index contract in the preview in both directions", async () => {
    const { service, parent } = await setup();
    const folder = await service.create(parent, "sort");
    const a = await service.create(folder.id, "A", "https://a.test");
    const b = await service.create(folder.id, "B", "https://b.test");
    await service.move(a.id, folder.id, 1);
    expect(service.tree.nodes.get(folder.id)?.children).toEqual([b.id, a.id]);
    await service.move(a.id, folder.id, 0);
    expect(service.tree.nodes.get(folder.id)?.children).toEqual([a.id, b.id]);
    service.stop();
  });
  it("rejects cyclic moves, system writes, missing nodes, and executable URLs", async () => {
    const { service, parent } = await setup();
    const folder = await service.create(parent, "parent");
    const child = await service.create(folder.id, "child");
    await expect(service.move(folder.id, child.id)).rejects.toThrow("循环");
    await expect(service.move(parent, folder.id)).rejects.toThrow("受保护");
    await expect(service.remove(parent, true)).rejects.toThrow("保护");
    await expect(service.update("missing", "gone")).rejects.toThrow("不存在");
    await expect(
      service.create(parent, "bad", "javascript:alert(1)"),
    ).rejects.toThrow("不安全");
    service.stop();
  });
  it("reflects external bookmark events without polling", async () => {
    const { service, adapter, parent } = await setup();
    const item = await adapter.create({
      parentId: parent,
      title: "external",
      url: "https://example.com",
    });
    await vi.waitFor(() => expect(service.tree.nodes.has(item.id)).toBe(true));
    await adapter.update(item.id, { title: "changed" });
    await vi.waitFor(() =>
      expect(service.tree.nodes.get(item.id)?.title).toBe("changed"),
    );
    await adapter.remove(item.id, false);
    await vi.waitFor(() => expect(service.tree.nodes.has(item.id)).toBe(false));
    service.stop();
  });
  it("discards late snapshots instead of restoring stale bookmark state", async () => {
    const { service, adapter } = await setup();
    let resolveOld!: (tree: RawBookmark[]) => void;
    adapter.getTree = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<RawBookmark[]>((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValueOnce([
        { id: "latest-root", title: "latest", children: [] },
      ]);
    const old = service.refresh();
    await service.refresh();
    resolveOld([{ id: "stale-root", title: "stale", children: [] }]);
    await old;
    expect(service.tree.roots).toEqual(["latest-root"]);
    service.stop();
  });
  it("does not report a committed create as failed when only refreshing fails", async () => {
    const { service, adapter, parent } = await setup();
    adapter.create = vi
      .fn()
      .mockResolvedValue({
        id: "committed",
        parentId: parent,
        title: "created",
        url: "https://example.com/",
      });
    adapter.getTree = vi.fn().mockRejectedValue(new Error("read failed"));
    await expect(
      service.create(parent, "created", "example.com"),
    ).resolves.toMatchObject({ id: "committed" });
    expect(adapter.create).toHaveBeenCalledTimes(1);
    expect(service.error).toBe("read failed");
    service.stop();
  });
  it("retains a usable snapshot and exposes API refresh failures", async () => {
    const { service, adapter } = await setup();
    const previous = service.tree;
    adapter.getTree = vi.fn().mockRejectedValue(new Error("permission denied"));
    await expect(service.refresh()).rejects.toThrow("permission denied");
    expect(service.tree).toBe(previous);
    expect(service.error).toBe("permission denied");
    service.stop();
  });
});
