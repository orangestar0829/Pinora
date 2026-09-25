import { assetStore } from "./assets";
import type { SettingsService } from "./settings";
// Commit mappings only after IndexedDB commits; retain old assets for concurrent readers.
export async function saveWallpaper(settings: SettingsService, blob: Blob) {
  const id = await assetStore.put(blob);
  try {
    await settings.update((draft) => {
      draft.background.assetId = id;
      draft.background.type = "image";
    });
  } catch (error) {
    await assetStore.remove(id).catch(() => undefined);
    throw error;
  }
}
export async function saveCustomIcon(
  settings: SettingsService,
  bookmarkId: string,
  blob: Blob,
) {
  const id = await assetStore.put(blob);
  try {
    await settings.update((draft) => {
      draft.iconMappings[bookmarkId] = id;
    });
  } catch (error) {
    await assetStore.remove(id).catch(() => undefined);
    throw error;
  }
}
