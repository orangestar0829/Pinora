import { useCallback, useEffect, useState } from "react";
import { searchTree, type BookmarkTree } from "../domain/tree";
import {
  resolveBookmarkFolder,
  isInBookmarkFolder,
} from "../domain/folderScope";

export const PAGE_SIZE = 200;
// Current folder, search and pagination, all confined to the configured root.
export function useFolderNavigation(
  tree: BookmarkTree,
  bookmarkFolderId: string | null,
) {
  const [folderId, setFolderId] = useState<string>();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage(0);
  }, [folderId, query]);
  const rootId = resolveBookmarkFolder(tree, bookmarkFolderId);
  const currentId =
    folderId &&
    tree.nodes.get(folderId)?.folder &&
    isInBookmarkFolder(tree, folderId, rootId)
      ? folderId
      : rootId;
  const current = tree.nodes.get(currentId ?? "");
  useEffect(() => {
    setFolderId(rootId ?? undefined);
    setQuery("");
    setPage(0);
  }, [rootId, bookmarkFolderId]);
  useEffect(() => {
    if (folderId && folderId !== currentId) {
      setFolderId(currentId ?? undefined);
      setQuery("");
      setPage(0);
    }
  }, [folderId, currentId]);
  const searching = !!query.trim();
  const results = searching
    ? searchTree(tree, query).filter(
        (node) =>
          node.id !== rootId && isInBookmarkFolder(tree, node.id, rootId),
      )
    : (current?.children.map((id) => tree.nodes.get(id)!) ?? []);
  const navigate = useCallback(
    (id: string) => {
      if (!tree.nodes.get(id)?.folder || !isInBookmarkFolder(tree, id, rootId))
        return;
      setFolderId(id);
      setQuery("");
    },
    [tree, rootId],
  );
  const pageCount = Math.ceil(results.length / PAGE_SIZE);
  const visiblePage = Math.min(page, Math.max(0, pageCount - 1));
  return {
    rootId,
    currentId,
    current,
    // Defined only when the current folder can navigate up within the root.
    parentId:
      current?.parentId && current.id !== rootId ? current.parentId : undefined,
    navigate,
    query,
    setQuery,
    searching,
    results,
    page,
    setPage,
    pageCount,
    pageNodes: results.slice(
      visiblePage * PAGE_SIZE,
      (visiblePage + 1) * PAGE_SIZE,
    ),
  };
}
