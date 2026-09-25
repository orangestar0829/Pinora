import type { BrowserAdapter, OpenMode } from '../types/browser';
export interface Settings {
  schemaVersion: 1;
  theme: 'light' | 'dark' | 'system';
  openMode: OpenMode;
  layout: { tileSize: number; iconSize: number; gapX: number; gapY: number; radius: number; fontSize: number; labels: 'one' | 'two' | 'hidden'; maxWidth: number; showHostname: boolean };
  background: { type: 'solid' | 'gradient' | 'image'; color: string; gradientEnd: string; assetId: string | null; fit: 'cover' | 'contain' | 'center' | 'stretch' | 'tile'; blur: number; brightness: number; overlay: number };
  iconMappings: Record<string, string>;
}
export const defaults: Settings = { schemaVersion: 1, theme: 'light', openMode: 'current', layout: { tileSize: 148, iconSize: 40, gapX: 16, gapY: 20, radius: 18, fontSize: 14, labels: 'one', maxWidth: 1200, showHostname: true }, background: { type: 'solid', color: '#f5f4ee', gradientEnd: '#dce8dc', assetId: null, fit: 'cover', blur: 0, brightness: 100, overlay: 0 }, iconMappings: {} };
function object(value: unknown): Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function pick<T extends string>(value: unknown, choices: readonly T[], fallback: T): T { return choices.includes(value as T) ? value as T : fallback; }
function number(value: unknown, min: number, max: number, fallback: number): number { return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fallback; }
function color(value: unknown, fallback: string): string { return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value : fallback; }
export function migrateSettings(value: unknown): Settings {
  const data = object(value); const l = object(data.layout); const b = object(data.background); const d = defaults;
  if (data.schemaVersion !== undefined && data.schemaVersion !== 0 && data.schemaVersion !== 1) throw new Error('设置版本尚不受支持，原配置已保留。');
  const mappings: Record<string, string> = {};
  for (const [id, asset] of Object.entries(object(data.iconMappings))) if (id !== '__proto__' && typeof asset === 'string' && /^[a-zA-Z\d_-]{1,100}$/.test(asset)) mappings[id] = asset;
  return { schemaVersion: 1, theme: pick(data.theme, ['light', 'dark', 'system'], d.theme), openMode: pick(data.openMode, ['current', 'new', 'background'], d.openMode), layout: { tileSize: number(l.tileSize, 96, 240, d.layout.tileSize), iconSize: number(l.iconSize, 20, 96, d.layout.iconSize), gapX: number(l.gapX, 4, 64, d.layout.gapX), gapY: number(l.gapY, 4, 64, d.layout.gapY), radius: number(l.radius, 0, 40, d.layout.radius), fontSize: number(l.fontSize, 10, 24, d.layout.fontSize), labels: pick(l.labels, ['one', 'two', 'hidden'], d.layout.labels), maxWidth: number(l.maxWidth, 640, 2400, d.layout.maxWidth), showHostname: typeof l.showHostname === 'boolean' ? l.showHostname : d.layout.showHostname }, background: { type: pick(b.type, ['solid', 'gradient', 'image'], d.background.type), color: color(b.color, d.background.color), gradientEnd: color(b.gradientEnd, d.background.gradientEnd), assetId: typeof b.assetId === 'string' && /^[a-zA-Z\d_-]{1,100}$/.test(b.assetId) ? b.assetId : null, fit: pick(b.fit, ['cover', 'contain', 'center', 'stretch', 'tile'], d.background.fit), blur: number(b.blur, 0, 40, 0), brightness: number(b.brightness, 20, 150, 100), overlay: number(b.overlay, 0, 90, 0) }, iconMappings: mappings };
}
const KEY = 'pinora.settings';
export class SettingsService {
  value = migrateSettings(undefined);
  error: string | null = null;
  private listeners = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private dispose?: () => void;
  constructor(private adapter: BrowserAdapter) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private apply(raw: unknown) { this.value = migrateSettings(raw); try { localStorage.setItem('pinora.theme', this.value.theme); } catch { /* disposable hint */ } this.listeners.forEach(l => l()); }
  async start() { this.dispose?.(); this.dispose = this.adapter.onStorageChanged(KEY, raw => { try { this.apply(raw); } catch (error) { this.error = String(error); this.listeners.forEach(l => l()); } }); const raw = await this.adapter.read(KEY); try { const migrated = migrateSettings(raw); if (raw !== undefined && JSON.stringify(raw) !== JSON.stringify(migrated)) await this.adapter.write('pinora.settings.recovery', raw); this.apply(migrated); } catch (error) { if (raw !== undefined) await this.adapter.write('pinora.settings.recovery', raw); this.error = String(error); this.listeners.forEach(l => l()); } }
  stop() { this.dispose?.(); }
  // Mutate a validated fresh draft. Cross-tab Web Locks prevent lost read/modify/write updates.
  update(mutator: (draft: Settings) => void): Promise<void> { const action = async () => { const draft = migrateSettings(await this.adapter.read(KEY)); mutator(draft); const next = migrateSettings(draft); await this.adapter.write(KEY, next); this.error = null; this.apply(next); }; const locked = () => navigator.locks ? navigator.locks.request('pinora.settings', action) : action(); const result = this.queue.then(locked, locked); this.queue = result.catch(() => undefined); return result; }
  async pruneIcons(validIds: Set<string>) { const stale = Object.keys(this.value.iconMappings).filter(id => !validIds.has(id)); if (stale.length) await this.update(draft => { for (const id of stale) delete draft.iconMappings[id]; }); }
}
