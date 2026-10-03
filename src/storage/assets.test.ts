import { expect, test } from "vitest";
import { ASSET_GC_KEY, ASSET_GRACE_MS, planAssetCollection } from "./assets";
import { assetReferences } from "./maintenance";

test("collection protects current and recovery references and gives unknown legacy assets a grace period", () => {
  const now = ASSET_GRACE_MS * 3;
  const references = assetReferences(
    { background: { assetId: "current" } },
    { future: { image: "recovery" } },
  );
  const plan = planAssetCollection(
    ["current", "recovery", "legacy", "expired", "recent", ASSET_GC_KEY],
    { current: 0, recovery: 0, expired: now - ASSET_GRACE_MS, recent: now - 1 },
    references,
    now,
  );
  expect(plan.remove).toEqual(["expired"]);
  expect(plan.marks).toEqual({ legacy: now, recent: now - 1 });
});

test("resurrected references reset the grace period before a later removal", () => {
  const now = ASSET_GRACE_MS * 3;
  const used = planAssetCollection(
    ["image"],
    { image: 0 },
    new Set(["image"]),
    now,
  );
  expect(used.remove).toEqual([]);
  const unused = planAssetCollection(["image"], used.marks, new Set(), now + 1);
  expect(unused.remove).toEqual([]);
  expect(unused.marks.image).toBe(now + 1);
});

test("invalid metadata and a backwards clock never cause immediate removal", () => {
  const now = ASSET_GRACE_MS * 3;
  const plan = planAssetCollection(
    ["a", "b", "c", "d"],
    { a: NaN, b: -1, c: now + 100, d: "0" },
    new Set(),
    now,
  );
  expect(plan.remove).toEqual([]);
  expect(Object.values(plan.marks)).toEqual([now, now, now, now]);
});
