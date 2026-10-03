import { createAdapter } from "../browser";
import { SettingsService } from "../storage/settings";
import { BookmarkService } from "./bookmarks";
import { startAssetMaintenance } from "../storage/maintenance";
export function createRuntime() {
  const adapter = createAdapter();
  const bookmarks = new BookmarkService(adapter);
  const settings = new SettingsService(adapter);
  let unsubscribe: (() => void) | undefined;
  let maintenance: ReturnType<typeof startAssetMaintenance> | undefined;
  let pruneGeneration = 0;
  return {
    adapter,
    bookmarks,
    settings,
    async retryMaintenance() {
      await maintenance?.run();
    },
    async start() {
      pruneGeneration++;
      unsubscribe?.();
      maintenance?.stop();
      await settings.start();
      await bookmarks.start();
      const prune = () => {
        const generation = ++pruneGeneration;
        if (!bookmarks.error)
          void settings
            .pruneIcons(
              new Set(bookmarks.tree.nodes.keys()),
              () => generation === pruneGeneration && !bookmarks.error,
            )
            .then(
              () => {
                if (generation === pruneGeneration)
                  settings.reportMaintenanceError("icons", null);
              },
              (error: unknown) => {
                if (generation === pruneGeneration)
                  settings.reportMaintenanceError(
                    "icons",
                    `清理已删除书签的图标映射失败：${String(error)}`,
                  );
              },
            );
      };
      unsubscribe = bookmarks.subscribe(prune);
      prune();
      maintenance = startAssetMaintenance(settings);
    },
    stop() {
      pruneGeneration++;
      unsubscribe?.();
      maintenance?.stop();
      bookmarks.stop();
      settings.stop();
    },
  };
}
