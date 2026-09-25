import type { RawBookmark } from "../types/browser";
import { hostname } from "./url";
export interface BookmarkNode {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  index: number;
  children: string[];
  folder: boolean;
  protected: boolean;
  readOnly: boolean;
  path: string[];
  hostname: string;
}
export interface BookmarkTree {
  nodes: Map<string, BookmarkNode>;
  roots: string[];
  searchIndex: { id: string; text: string }[];
}
export function normalizeTree(raw: RawBookmark[]): BookmarkTree {
  const nodes = new Map<string, BookmarkNode>();
  const roots: string[] = [];
  const stack = raw
    .map((node, index) => ({
      node,
      parentId: undefined as string | undefined,
      index,
      path: [] as string[],
      readOnly: false,
    }))
    .reverse();
  while (stack.length) {
    const { node, parentId, index, path, readOnly } = stack.pop()!;
    if (nodes.has(node.id)) throw new Error("书签树包含重复 ID 或循环引用。");
    const system =
      parentId === undefined ||
      !!node.folderType ||
      (parentId !== undefined && roots.includes(parentId));
    const item: BookmarkNode = {
      id: node.id,
      parentId,
      title: node.title || (parentId ? "未命名" : "全部书签"),
      url: node.url,
      index,
      children: [],
      folder: node.url === undefined,
      protected: system,
      readOnly: readOnly || !!node.unmodifiable,
      path,
      hostname: hostname(node.url),
    };
    nodes.set(item.id, item);
    if (!parentId) roots.push(item.id);
    else nodes.get(parentId)!.children.push(item.id);
    const children = node.children ?? [];
    for (let i = children.length - 1; i >= 0; i--)
      stack.push({
        node: children[i],
        parentId: item.id,
        index: i,
        path: [...path, item.id],
        readOnly: item.readOnly,
      });
  }
  const searchIndex = [...nodes.values()]
    .filter((n) => n.parentId !== undefined)
    .map((n) => ({
      id: n.id,
      text: [
        n.title,
        n.url ?? "",
        n.hostname,
        ...n.path.map((id) => nodes.get(id)!.title),
      ]
        .join(" ")
        .toLocaleLowerCase(),
    }));
  return { nodes, roots, searchIndex };
}
export function searchTree(tree: BookmarkTree, query: string): BookmarkNode[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return tree.searchIndex
    .filter((item) => words.every((w) => item.text.includes(w)))
    .map((item) => tree.nodes.get(item.id)!);
}
export function canMove(
  tree: BookmarkTree,
  id: string,
  parentId: string,
): boolean {
  const node = tree.nodes.get(id),
    target = tree.nodes.get(parentId);
  return (
    !!node &&
    !!target &&
    !node.protected &&
    !node.readOnly &&
    target.folder &&
    !target.readOnly &&
    target.parentId !== undefined &&
    id !== parentId &&
    !target.path.includes(id)
  );
}
export function initialFolder(tree: BookmarkTree): string | undefined {
  const root = tree.nodes.get(tree.roots[0]);
  return (
    root?.children.find(
      (id) => tree.nodes.get(id)?.folder && !tree.nodes.get(id)?.readOnly,
    ) ?? root?.id
  );
}
