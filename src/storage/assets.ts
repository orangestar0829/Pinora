let database: Promise<IDBDatabase> | undefined;
// Stored alongside blobs to keep the existing database version and old tabs compatible.
export const ASSET_GC_KEY = "__pinora_unreferenced_assets__";
export const ASSET_GRACE_MS = 24 * 60 * 60 * 1000;
export function planAssetCollection(
  ids: string[],
  rawMarks: unknown,
  references: Set<string>,
  now: number,
) {
  const previous =
    rawMarks && typeof rawMarks === "object"
      ? (rawMarks as Record<string, unknown>)
      : {};
  const marks: Record<string, number> = Object.create(null);
  const remove: string[] = [];
  for (const id of ids) {
    if (id === ASSET_GC_KEY || references.has(id)) continue;
    const value = Object.hasOwn(previous, id) ? previous[id] : undefined;
    const since =
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= now
        ? value
        : now;
    if (now - since >= ASSET_GRACE_MS) remove.push(id);
    else marks[id] = since;
  }
  return { marks, remove };
}
export function withAssetLock<T>(action: () => Promise<T>): Promise<T> {
  return navigator.locks
    ? navigator.locks.request("pinora.assets", action)
    : action();
}
function open(): Promise<IDBDatabase> {
  database ??= new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("此环境无法使用本地图片存储。"));
      return;
    }
    const request = indexedDB.open("pinora-assets", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("assets");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("打开本地图片存储失败。"));
    request.onblocked = () =>
      reject(new Error("本地图片存储被其他页面占用，请关闭旧页面后重试。"));
  });
  return database.catch((error) => {
    database = undefined;
    throw error;
  });
}
async function operation<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("assets", mode);
    const request = action(tx.objectStore("assets"));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = tx.onabort = () =>
      reject(
        new Error(
          `保存或读取图片失败：${tx.error?.message ?? "存储空间不足或不可用"}`,
        ),
      );
  });
}
export const assetStore = {
  async put(blob: Blob): Promise<string> {
    const id = crypto.randomUUID();
    await operation("readwrite", (store) => store.put(blob, id));
    return id;
  },
  async get(id: string): Promise<Blob | undefined> {
    const value = await operation("readonly", (store) => store.get(id));
    return value instanceof Blob ? value : undefined;
  },
  async remove(id: string): Promise<void> {
    await operation("readwrite", (store) => store.delete(id));
  },
  async collect(references: Set<string>, now = Date.now()): Promise<number> {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("assets", "readwrite");
      const store = tx.objectStore("assets");
      const keys = store.getAllKeys();
      const metadata = store.get(ASSET_GC_KEY);
      let deleted = 0;
      // Requests complete in order; only keys and timestamps are loaded, never image bodies.
      metadata.onsuccess = () => {
        const plan = planAssetCollection(
          keys.result.filter((key): key is string => typeof key === "string"),
          metadata.result,
          references,
          now,
        );
        for (const id of plan.remove) store.delete(id);
        store.put(plan.marks, ASSET_GC_KEY);
        deleted = plan.remove.length;
      };
      tx.oncomplete = () => resolve(deleted);
      tx.onerror = tx.onabort = () =>
        reject(
          new Error(`清理本地图片失败：${tx.error?.message ?? "存储不可用"}`),
        );
    });
  },
};
