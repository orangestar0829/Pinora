import { assetStore, withAssetLock } from "./assets";
import type { SettingsService } from "./settings";

// Recovery copies may contain fields from a newer schema. Preserve every string
// reference instead of discarding fields that this version does not understand.
export function assetReferences(...values: unknown[]): Set<string> {
  const references = new Set<string>();
  const seen = new Set<object>();
  const pending = [...values];
  while (pending.length) {
    const value = pending.pop();
    if (typeof value === "string") references.add(value);
    else if (value && typeof value === "object" && !seen.has(value)) {
      seen.add(value);
      for (const child of Object.values(value)) pending.push(child);
    }
  }
  return references;
}

export async function collectUnusedAssets(
  settings: SettingsService,
): Promise<number> {
  // Do not delete without cross-tab serialization. All supported Chromium versions have Web Locks.
  if (!navigator.locks) return 0;
  return withAssetLock(() =>
    settings.withStoredSettings((current, recovery, raw) =>
      assetStore.collect(assetReferences(current, recovery, raw)),
    ),
  );
}

export function startAssetMaintenance(settings: SettingsService) {
  let active = true;
  let inFlight: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout>;
  let signature = "";
  const run = () => {
    inFlight ??= collectUnusedAssets(settings)
      .then(
        () => {
          if (active) settings.reportMaintenanceError("assets", null);
        },
        (error: unknown) => {
          if (active)
            settings.reportMaintenanceError(
              "assets",
              `清理未使用图片失败：${String(error)}`,
            );
        },
      )
      .finally(() => {
        inFlight = undefined;
      });
    return inFlight;
  };
  const schedule = () => {
    const next = JSON.stringify([
      settings.value.background.assetId,
      settings.value.iconMappings,
    ]);
    if (next === signature) return;
    signature = next;
    clearTimeout(timer);
    timer = setTimeout(() => void run(), 500);
  };
  const unsubscribe = settings.subscribe(schedule);
  const interval = setInterval(() => void run(), 60 * 60 * 1000);
  schedule();
  return {
    run,
    stop() {
      active = false;
      clearTimeout(timer);
      clearInterval(interval);
      unsubscribe();
    },
  };
}
