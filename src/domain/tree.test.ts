import { expect, test } from "vitest";
import { canMove, initialFolder, normalizeTree, searchTree } from "./tree";
import type { RawBookmark } from "../types/browser";
const raw: RawBookmark[] = [
  {
    id: "r",
    title: "",
    children: [
      {
        id: "bar-x",
        title: "Bar",
        children: [
          {
            id: "f",
            title: "Work",
            children: [{ id: "a", title: "Code", url: "https://github.com" }],
          },
          {
            id: "managed",
            title: "Policy",
            unmodifiable: "managed",
            children: [
              { id: "m", title: "Managed", url: "https://example.com" },
            ],
          },
        ],
      },
    ],
  },
];
test("derives system nodes, paths and read-only descendants without fixed ids", () => {
  const tree = normalizeTree(raw);
  expect(initialFolder(tree)).toBe("bar-x");
  expect(tree.nodes.get("bar-x")?.protected).toBe(true);
  expect(tree.nodes.get("a")?.path).toEqual(["r", "bar-x", "f"]);
  expect(tree.nodes.get("m")?.readOnly).toBe(true);
  expect(canMove(tree, "f", "f")).toBe(false);
  expect(canMove(tree, "f", "managed")).toBe(false);
  expect(canMove(tree, "a", "bar-x")).toBe(true);
  expect(canMove(tree, "bar-x", "f")).toBe(false);
});
test("search index covers host and ancestor folder", () => {
  const tree = normalizeTree(raw);
  expect(searchTree(tree, "work github").map((n) => n.id)).toEqual(["a"]);
  expect(searchTree(tree, "")).toEqual([]);
});
test("cycles are rejected and deep trees do not recurse", () => {
  const cycle: RawBookmark = { id: "cycle", title: "", children: [] };
  cycle.children!.push(cycle);
  expect(() => normalizeTree([cycle])).toThrow();
});
