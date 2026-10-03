import { initialFolder, type BookmarkTree } from "./tree";

/** An unavailable configured root must never reveal a different collection. */
export function resolveBookmarkFolder(
  tree: BookmarkTree,
  configuredId: string | null,
): string | null {
  const id = configuredId ?? initialFolder(tree);
  const node = id === undefined ? undefined : tree.nodes.get(id);
  return node?.folder && node.parentId !== undefined ? node.id : null;
}

export function isInBookmarkFolder(
  tree: BookmarkTree,
  nodeId: string,
  rootId: string | null,
): boolean {
  if (rootId === null || resolveBookmarkFolder(tree, rootId) === null)
    return false;
  const node = tree.nodes.get(nodeId);
  return !!node && (node.id === rootId || node.path.includes(rootId));
}
