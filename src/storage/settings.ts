import type { BrowserAdapter, OpenMode } from "../types/browser";
export interface Settings {
  schemaVersion: 1;
  theme: "light" | "dark" | "system";
  openMode: OpenMode;
  bookmarkFolderId: string | null;
  layout: {
    tileSize: number;
    iconSize: number;
    gapX: number;
    gapY: number;
    radius: number;
    fontSize: number;
    labels: "one" | "two" | "hidden";
    maxWidth: number;
    showHostname: boolean;
  };
  background: {
    type: "solid" | "gradient" | "image";
    color: string;
    gradientEnd: string;
    assetId: string | null;
    fit: "cover" | "contain" | "center" | "stretch" | "tile";
    blur: number;
    brightness: number;
    overlay: number;
  };
  iconMappings: Record<string, string>;
}
export const defaults: Settings = {
  schemaVersion: 1,
  theme: "light",
  openMode: "current",
  bookmarkFolderId: null,
  layout: {
    tileSize: 148,
    iconSize: 40,
    gapX: 16,
    gapY: 20,
    radius: 18,
    fontSize: 14,
    labels: "one",
    maxWidth: 1200,
    showHostname: true,
  },
  background: {
    type: "solid",
    color: "#f5f4ee",
    gradientEnd: "#dce8dc",
    assetId: null,
    fit: "cover",
    blur: 0,
    brightness: 100,
    overlay: 0,
  },
  iconMappings: {},
};
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function pick<T extends string>(
  value: unknown,
  choices: readonly T[],
  fallback: T,
): T {
  return choices.includes(value as T) ? (value as T) : fallback;
}
function number(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
    ? value
    : fallback;
}
function color(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[\da-f]{6}$/i.test(value)
    ? value
    : fallback;
}
export function migrateSettings(value: unknown): Settings {
  const data = object(value);
  const l = object(data.layout);
  const b = object(data.background);
  const d = defaults;
  if (
    data.schemaVersion !== undefined &&
    data.schemaVersion !== 0 &&
    data.schemaVersion !== 1
  )
    throw new Error("设置版本尚不受支持，原配置已保留。");
  const mappings: Record<string, string> = {};
  for (const [id, asset] of Object.entries(object(data.iconMappings)))
    if (
      id !== "__proto__" &&
      typeof asset === "string" &&
      /^[a-zA-Z\d_-]{1,100}$/.test(asset)
    )
      mappings[id] = asset;
  return {
    schemaVersion: 1,
    theme: pick(data.theme, ["light", "dark", "system"], d.theme),
    openMode: pick(data.openMode, ["current", "new", "background"], d.openMode),
    bookmarkFolderId:
      typeof data.bookmarkFolderId === "string" &&
      /^[a-zA-Z\d_-]{1,128}$/.test(data.bookmarkFolderId)
        ? data.bookmarkFolderId
        : null,
    layout: {
      tileSize: number(l.tileSize, 96, 240, d.layout.tileSize),
      iconSize: number(l.iconSize, 20, 96, d.layout.iconSize),
      gapX: number(l.gapX, 4, 64, d.layout.gapX),
      gapY: number(l.gapY, 4, 64, d.layout.gapY),
      radius: number(l.radius, 0, 40, d.layout.radius),
      fontSize: number(l.fontSize, 10, 24, d.layout.fontSize),
      labels: pick(l.labels, ["one", "two", "hidden"], d.layout.labels),
      maxWidth: number(l.maxWidth, 640, 2400, d.layout.maxWidth),
      showHostname:
        typeof l.showHostname === "boolean"
          ? l.showHostname
          : d.layout.showHostname,
    },
    background: {
      type: pick(b.type, ["solid", "gradient", "image"], d.background.type),
      color: color(b.color, d.background.color),
      gradientEnd: color(b.gradientEnd, d.background.gradientEnd),
      assetId:
        typeof b.assetId === "string" && /^[a-zA-Z\d_-]{1,100}$/.test(b.assetId)
          ? b.assetId
          : null,
      fit: pick(
        b.fit,
        ["cover", "contain", "center", "stretch", "tile"],
        d.background.fit,
      ),
      blur: number(b.blur, 0, 40, 0),
      brightness: number(b.brightness, 20, 150, 100),
      overlay: number(b.overlay, 0, 90, 0),
    },
    iconMappings: mappings,
  };
}
const KEY = "pinora.settings";
function canonicalJson(value: unknown): string | undefined {
  return JSON.stringify(value, (_key, entry: unknown) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
      ? Object.fromEntries(
          Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)),
        )
      : entry,
  );
}
export class SettingsService {
  value = migrateSettings(undefined);
  error: string | null = null;
  needsRecovery = false;
  private maintenanceErrors = new Map<string, string>();
  get maintenanceError(): string | null {
    return [...this.maintenanceErrors.values()].join("\n") || null;
  }
  reportMaintenanceError(source: "assets" | "icons", message: string | null) {
    if ((this.maintenanceErrors.get(source) ?? null) === message) return;
    if (message) this.maintenanceErrors.set(source, message);
    else this.maintenanceErrors.delete(source);
    this.listeners.forEach((listener) => listener());
  }
  private listeners = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private dispose?: () => void;
  private revision = 0;
  private refreshGeneration = 0;
  constructor(private adapter: BrowserAdapter) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private apply(raw: unknown) {
    this.value = migrateSettings(raw);
    this.revision++;
    this.error = null;
    this.needsRecovery = false;
    try {
      localStorage.setItem("pinora.theme", this.value.theme);
    } catch {
      /* disposable hint */
    }
    this.listeners.forEach((l) => l());
  }
  async start() {
    this.dispose?.();
    this.dispose = this.adapter.onStorageChanged(KEY, (raw) => {
      // Even invalid newer data must supersede an earlier initial read.
      this.revision++;
      try {
        this.apply(raw);
      } catch (error) {
        this.error = String(error);
        this.needsRecovery = true;
        this.listeners.forEach((l) => l());
      }
    });
    await this.refresh();
  }
  async refresh() {
    const generation = ++this.refreshGeneration;
    const revision = this.revision;
    const isCurrent = () =>
      generation === this.refreshGeneration && revision === this.revision;
    let raw: unknown;
    try {
      raw = await this.adapter.read(KEY);
    } catch (error) {
      if (isCurrent()) throw error;
      return;
    }
    if (!isCurrent()) return;
    const backupCurrent = () =>
      this.enqueue(async () => {
        if (!isCurrent()) return false;
        const latest = await this.adapter.read(KEY);
        if (!isCurrent() || canonicalJson(latest) !== canonicalJson(raw))
          return false;
        if (raw !== undefined)
          await this.adapter.write("pinora.settings.recovery", raw);
        return isCurrent();
      });
    let migrated: Settings;
    try {
      migrated = migrateSettings(raw);
    } catch (error) {
      if (!(await backupCurrent())) return;
      this.error = String(error);
      this.needsRecovery = true;
      this.listeners.forEach((l) => l());
      return;
    }
    if (
      raw !== undefined &&
      canonicalJson(raw) !== canonicalJson(migrated) &&
      !(await backupCurrent())
    )
      return;
    if (isCurrent()) this.apply(migrated);
  }
  stop() {
    this.refreshGeneration++;
    this.dispose?.();
    this.dispose = undefined;
  }
  private enqueue<T>(action: () => Promise<T>): Promise<T> {
    const locked = () =>
      navigator.locks
        ? navigator.locks.request("pinora.settings", action)
        : action();
    const result = this.queue.then(locked, locked);
    this.queue = result.catch(() => undefined);
    return result;
  }
  withStoredSettings<T>(
    action: (current: Settings, recovery: unknown, raw: unknown) => Promise<T>,
  ): Promise<T> {
    return this.enqueue(async () => {
      const raw = await this.adapter.read(KEY);
      return action(
        migrateSettings(raw),
        await this.adapter.read("pinora.settings.recovery"),
        raw,
      );
    });
  }
  // Mutate a validated fresh draft. Cross-tab Web Locks prevent lost read/modify/write updates.
  update(mutator: (draft: Settings) => void): Promise<void> {
    return this.enqueue(async () => {
      const draft = migrateSettings(await this.adapter.read(KEY));
      mutator(draft);
      const next = migrateSettings(draft);
      await this.adapter.write(KEY, next);
      this.error = null;
      this.apply(next);
    });
  }
  // Only called after explicit confirmation; never overwrite an unknown schema without a backup.
  resetToDefaults(): Promise<void> {
    return this.enqueue(async () => {
      const raw = await this.adapter.read(KEY);
      if (raw !== undefined)
        await this.adapter.write("pinora.settings.recovery", raw);
      const next = structuredClone(defaults);
      await this.adapter.write(KEY, next);
      this.apply(next);
    });
  }
  async pruneIcons(validIds: Set<string>, isCurrent = () => true) {
    const stale = Object.keys(this.value.iconMappings).filter(
      (id) => !validIds.has(id),
    );
    if (!stale.length) return;
    const cancelled = Symbol("obsolete bookmark snapshot");
    try {
      await this.update((draft) => {
        if (!isCurrent()) throw cancelled;
        for (const id of stale) delete draft.iconMappings[id];
      });
    } catch (error) {
      if (error !== cancelled) throw error;
    }
  }
}
