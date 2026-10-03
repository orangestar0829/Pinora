import { expect, test } from "vitest";
import { normalizeTree, searchTree } from "./tree";
import { isInBookmarkFolder, resolveBookmarkFolder } from "./folderScope";

const tree = normalizeTree([
  {
    id: "root",
    title: "All",
    children: [
      {
        id: "bar",
        title: "Bar",
        children: [
          {
            id: "chosen",
            title: "Chosen",
            children: [
              {
                id: "child",
                title: "Child",
                children: [
                  { id: "inside", title: "Shared", url: "https://inside.test" },
                ],
              },
            ],
          },
          { id: "outside", title: "Shared", url: "https://outside.test" },
        ],
      },
    ],
  },
]);

test("legacy default chooses the initial real folder, never the virtual root", () => {
  expect(resolveBookmarkFolder(tree, null)).toBe("bar");
  expect(resolveBookmarkFolder(normalizeTree([]), null)).toBeNull();
  expect(
    resolveBookmarkFolder(normalizeTree([{ id: "root", title: "All" }]), null),
  ).toBeNull();
});

test("missing, bookmark and virtual roots do not silently expose the default", () => {
  for (const id of ["deleted", "outside", "root"])
    expect(resolveBookmarkFolder(tree, id)).toBeNull();
  expect(resolveBookmarkFolder(tree, "chosen")).toBe("chosen");
});

test("scope includes its root and descendants but excludes ancestors and siblings", () => {
  for (const id of ["chosen", "child", "inside"])
    expect(isInBookmarkFolder(tree, id, "chosen")).toBe(true);
  for (const id of ["root", "bar", "outside", "missing"])
    expect(isInBookmarkFolder(tree, id, "chosen")).toBe(false);
  expect(isInBookmarkFolder(tree, "inside", null)).toBe(false);
  expect(isInBookmarkFolder(tree, "inside", "root")).toBe(false);
  expect(
    searchTree(tree, "Shared")
      .filter((node) => isInBookmarkFolder(tree, node.id, "chosen"))
      .map((node) => node.id),
  ).toEqual(["inside"]);
});
