import { expect, it } from "vitest";
import { normalizeTree, searchTree } from "./tree";
import type { RawBookmark } from "../types/browser";
it("indexes 5,000 bookmarks across 500 folders and a 10-level path without losing entries", () => {
  const bar: RawBookmark = { id: "bar", title: "书签栏", children: [] };
  const root: RawBookmark = { id: "root", title: "全部书签", children: [bar] };
  let parent = bar;
  for (let i = 0; i < 500; i++) {
    const folder: RawBookmark = {
      id: `folder-${i}`,
      title: `Folder ${i}`,
      children: [],
    };
    (i < 10 ? parent : bar).children!.push(folder);
    if (i < 10) parent = folder;
    for (let j = 0; j < 10; j++)
      folder.children!.push({
        id: `b-${i}-${j}`,
        title: `Site ${i} number ${j}`,
        url: `https://site${i}.test/page${j}`,
      });
  }
  const tree = normalizeTree([root]);
  expect(tree.nodes.size).toBe(5502);
  expect(tree.nodes.get("b-9-0")?.path).toHaveLength(12);
  expect(searchTree(tree, "site499.test")).toHaveLength(10);
  expect(searchTree(tree, "site499.test/page9").map((n) => n.id)).toEqual([
    "b-499-9",
  ]);
});
