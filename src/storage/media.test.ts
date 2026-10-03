import { afterEach, expect, test, vi } from "vitest";
import { createPreviewAdapter } from "../browser/preview";
import { assetStore } from "./assets";
import { saveWallpaper } from "./media";
import { migrateSettings, SettingsService } from "./settings";

afterEach(() => vi.restoreAllMocks());

async function setup() {
  localStorage.clear();
  const adapter = createPreviewAdapter();
  const service = new SettingsService(adapter);
  await service.update((draft) => {
    draft.background.type = "image";
  });
  const put = vi.spyOn(assetStore, "put").mockResolvedValue("new-wallpaper");
  const remove = vi.spyOn(assetStore, "remove").mockResolvedValue();
  return { adapter, service, put, remove };
}

test("cancelled wallpaper skips storage entirely", async () => {
  const { service, put } = await setup();
  expect(await saveWallpaper(service, new Blob(), () => false)).toBe(false);
  expect(put).not.toHaveBeenCalled();
});

test("cancellation during IndexedDB write removes only the new asset", async () => {
  const { service, put, remove } = await setup();
  let finish!: (id: string) => void;
  put.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  let current = true;
  const pending = saveWallpaper(service, new Blob(), () => current);
  current = false;
  finish("new-wallpaper");
  expect(await pending).toBe(false);
  expect(remove).toHaveBeenCalledExactlyOnceWith("new-wallpaper");
  expect(service.value.background.assetId).toBeNull();
});

test("guard is checked after waiting for the settings queue", async () => {
  const { adapter, service, remove } = await setup();
  const initial = structuredClone(service.value);
  let finish!: (value: unknown) => void;
  vi.spyOn(adapter, "read").mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const queued = service.update((draft) => {
    draft.theme = "dark";
  });
  await Promise.resolve();
  let current = true;
  const pending = saveWallpaper(service, new Blob(), () => current);
  await Promise.resolve();
  current = false;
  finish(initial);
  await queued;
  expect(await pending).toBe(false);
  expect(remove).toHaveBeenCalledExactlyOnceWith("new-wallpaper");
  expect(service.value.theme).toBe("dark");
  expect(service.value.background.assetId).toBeNull();
});

test("fresh background changes are preserved even before local storage events arrive", async () => {
  const { adapter, service, remove } = await setup();
  const initial = structuredClone(service.value.background);
  const latest = structuredClone(service.value);
  latest.background.type = "solid";
  await adapter.write("pinora.settings", latest);
  expect(
    await saveWallpaper(
      service,
      new Blob(),
      (draft) =>
        draft.background.type === initial.type &&
        draft.background.assetId === initial.assetId,
    ),
  ).toBe(false);
  expect(remove).toHaveBeenCalledExactlyOnceWith("new-wallpaper");
  expect(
    migrateSettings(await adapter.read("pinora.settings")).background.type,
  ).toBe("solid");
});

test("real settings failures are propagated after removing the unreferenced asset", async () => {
  const { adapter, service, remove } = await setup();
  vi.spyOn(adapter, "write").mockRejectedValue(new Error("quota exceeded"));
  await expect(saveWallpaper(service, new Blob())).rejects.toThrow(
    "quota exceeded",
  );
  expect(remove).toHaveBeenCalledExactlyOnceWith("new-wallpaper");
});

test("cleanup failure is visible rather than treated as successful cancellation", async () => {
  const { service, remove } = await setup();
  remove.mockRejectedValue(new Error("database unavailable"));
  let calls = 0;
  await expect(
    saveWallpaper(service, new Blob(), () => ++calls === 1),
  ).rejects.toThrow("database unavailable");
});
