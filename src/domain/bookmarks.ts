import type { BrowserAdapter } from "../types/browser";
import { canMove, normalizeTree, type BookmarkTree } from "./tree";
import { normalizeUrl } from "./url";
export class BookmarkService {
  tree: BookmarkTree = normalizeTree([]);
  private listeners = new Set<() => void>();
  private generation = 0;
  private latestRefresh?: Promise<void>;
  private dispose?: () => void;
  error: string | null = null;
  constructor(readonly adapter: BrowserAdapter) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit() {
    this.listeners.forEach((l) => l());
  }
  async start() {
    this.dispose?.();
    this.dispose = this.adapter.onBookmarksChanged(() => {
      void this.refresh().catch(() => {
        /* error exposed in state */
      });
    });
    let pending = this.refresh();
    for (;;) {
      try {
        await pending;
      } catch (error) {
        if (pending === this.latestRefresh) throw error;
      }
      // An event can supersede the initial read. Startup must follow that read
      // before consumers treat the tree as authoritative (including icon cleanup).
      if (!this.latestRefresh) throw new Error("书签读取已停止。");
      if (pending === this.latestRefresh) return;
      pending = this.latestRefresh;
    }
  }
  stop() {
    this.dispose?.();
    this.generation++;
    this.latestRefresh = undefined;
  }
  refresh() {
    this.latestRefresh = this.load(++this.generation);
    return this.latestRefresh;
  }
  private async load(generation: number) {
    try {
      const raw = await this.adapter.getTree();
      if (generation !== this.generation) return;
      this.tree = normalizeTree(raw);
      this.error = null;
      this.emit();
    } catch (error) {
      if (generation === this.generation) {
        this.error = error instanceof Error ? error.message : String(error);
        this.emit();
      }
      throw error;
    }
  }
  private editable(id: string) {
    const node = this.tree.nodes.get(id);
    if (!node || node.protected || node.readOnly)
      throw new Error("该项目不存在或受浏览器保护。");
    return node;
  }
  private destination(id: string) {
    const node = this.tree.nodes.get(id);
    if (!node?.folder || node.readOnly || node.parentId === undefined)
      throw new Error("请选择可写入的书签文件夹。");
  }
  private async syncAfterWrite() {
    // A committed native write must not look like a failed save: retrying it
    // could create duplicates. refresh() retains the snapshot and exposes the
    // read error to the dashboard, where the user can retry only the read.
    await this.refresh().catch(() => undefined);
  }
  async create(parentId: string, title: string, url?: string) {
    this.destination(parentId);
    const node = await this.adapter.create({
      parentId,
      title: title.trim() || "未命名",
      ...(url === undefined ? {} : { url: normalizeUrl(url) }),
    });
    await this.syncAfterWrite();
    return node;
  }
  async update(id: string, title: string, url?: string) {
    const node = this.editable(id);
    await this.adapter.update(id, {
      title: title.trim() || "未命名",
      ...(node.folder ? {} : { url: normalizeUrl(url ?? node.url!) }),
    });
    await this.syncAfterWrite();
  }
  async remove(id: string, confirmedNonEmpty = false) {
    const node = this.editable(id);
    if (node.children.length && !confirmedNonEmpty)
      throw new Error("删除此文件夹将删除其中的所有书签，请明确确认。");
    // Let the native non-recursive operation reject an unexpected new child.
    await this.adapter.remove(id, node.folder && confirmedNonEmpty);
    await this.syncAfterWrite();
  }
  // index is the FINAL zero-based position after removing the source from its old list.
  async move(id: string, parentId: string, index?: number) {
    if (!canMove(this.tree, id, parentId))
      throw new Error("不能移到此处：目标无效、受保护或形成循环。");
    if (index !== undefined && (!Number.isInteger(index) || index < 0))
      throw new Error("排序位置无效。");
    const target = this.tree.nodes.get(parentId)!;
    const node = this.tree.nodes.get(id)!;
    const last = target.children.length - (node.parentId === parentId ? 1 : 0);
    const finalIndex = index === undefined ? undefined : Math.min(index, last);
    await this.adapter.move(id, parentId, finalIndex);
    await this.syncAfterWrite();
  }
}
