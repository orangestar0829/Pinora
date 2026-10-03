import { assetStore, withAssetLock } from "./assets";
import type { Settings, SettingsService } from "./settings";
// Commit mappings only after IndexedDB commits; retain old assets for concurrent readers.
export async function saveWallpaper(
  settings: SettingsService,
  blob: Blob,
  canCommit: (draft: Settings) => boolean = () => true,
): Promise<boolean> {
  return withAssetLock(async () => {
    if (!canCommit(settings.value)) return false;
    const id = await assetStore.put(blob);
    const cancelled = Symbol("wallpaper upload cancelled");
    try {
      await settings.update((draft) => {
        // Runs after the settings queue and cross-tab lock, against fresh storage.
        if (!canCommit(draft)) throw cancelled;
        draft.background.assetId = id;
        draft.background.type = "image";
      });
      return true;
    } catch (error) {
      try {
        await assetStore.remove(id);
      } catch (cleanupError) {
        throw new Error(
          `${error === cancelled ? "壁纸上传已取消" : String(error)}；清理未使用图片失败：${String(cleanupError)}`,
        );
      }
      if (error === cancelled) return false;
      throw error;
    }
  });
}
export async function saveCustomIcon(
  settings: SettingsService,
  bookmarkId: string,
  blob: Blob,
) {
  return withAssetLock(async () => {
    const id = await assetStore.put(blob);
    try {
      await settings.update((draft) => {
        draft.iconMappings[bookmarkId] = id;
      });
    } catch (error) {
      await assetStore.remove(id).catch(() => undefined);
      throw error;
    }
  });
}
