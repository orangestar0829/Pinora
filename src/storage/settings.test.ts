import { afterEach, expect, test, vi } from "vitest";
import { defaults, migrateSettings, SettingsService } from "./settings";
import { createPreviewAdapter } from "../browser/preview";
import { assetReferences } from "./maintenance";
afterEach(() => vi.restoreAllMocks());
test("legacy settings default to the initial folder and valid native or preview IDs persist", async () => {
  expect(migrateSettings({ schemaVersion: 1 }).bookmarkFolderId).toBeNull();
  for (const id of ["123", "preview-folder_2", "toolbar_____", null])
    expect(migrateSettings({ bookmarkFolderId: id }).bookmarkFolderId).toBe(id);
  for (const id of [
    "",
    " ",
    "a/b",
    "<script>",
    "a\n",
    "a".repeat(129),
    123,
    {},
    [],
  ])
    expect(
      migrateSettings({ bookmarkFolderId: id }).bookmarkFolderId,
    ).toBeNull();
  localStorage.clear();
  const adapter = createPreviewAdapter();
  const service = new SettingsService(adapter);
  await service.start();
  await service.update((draft) => {
    draft.bookmarkFolderId = "preview-folder_2";
  });
  await service.refresh();
  expect(service.value.bookmarkFolderId).toBe("preview-folder_2");
  expect(await adapter.read("pinora.settings")).toMatchObject({
    schemaVersion: 1,
    bookmarkFolderId: "preview-folder_2",
  });
  service.stop();
});
test("migrates unversioned data idempotently and resets corrupt fields", () => {
  const first = migrateSettings({
    theme: "dark",
    layout: { tileSize: -4 },
    background: { color: "url(https://x)" },
  });
  expect(first.theme).toBe("dark");
  expect(first.layout.tileSize).toBe(defaults.layout.tileSize);
  expect(first.background.color).toBe(defaults.background.color);
  expect(migrateSettings(first)).toEqual(first);
  expect(() => migrateSettings({ schemaVersion: 99 })).toThrow();
  expect(migrateSettings(null)).toEqual(defaults);
});
test("serializes rapid updates without dropping fields", async () => {
  localStorage.clear();
  const service = new SettingsService(createPreviewAdapter());
  await service.start();
  await Promise.all([
    service.update((s) => {
      s.theme = "dark";
    }),
    service.update((s) => {
      s.layout.iconSize = 60;
    }),
  ]);
  expect(service.value.theme).toBe("dark");
  expect(service.value.layout.iconSize).toBe(60);
  service.stop();
});

test("unsupported settings stay intact until an explicit backed-up recovery", async () => {
  localStorage.clear();
  const adapter = createPreviewAdapter();
  const raw = { schemaVersion: 99, theme: "dark", future: { keep: true } };
  await adapter.write("pinora.settings", raw);
  const service = new SettingsService(adapter);
  await service.start();
  expect(service.needsRecovery).toBe(true);
  expect(await adapter.read("pinora.settings")).toEqual(raw);
  await expect(
    service.update((d) => {
      d.theme = "light";
    }),
  ).rejects.toThrow();
  await service.resetToDefaults();
  expect(await adapter.read("pinora.settings.recovery")).toEqual(raw);
  expect(await adapter.read("pinora.settings")).toEqual(defaults);
  expect(service.error).toBeNull();
  expect(service.needsRecovery).toBe(false);
  service.stop();
});

test("failed backup prevents resetting the current configuration", async () => {
  localStorage.clear();
  const adapter = createPreviewAdapter();
  const raw = { schemaVersion: 99, valuable: "preserve" };
  await adapter.write("pinora.settings", raw);
  const service = new SettingsService(adapter);
  const original = adapter.write;
  vi.spyOn(adapter, "write").mockImplementation((key, value) =>
    key.endsWith(".recovery")
      ? Promise.reject(new Error("backup quota"))
      : original(key, value),
  );
  await expect(service.resetToDefaults()).rejects.toThrow("backup quota");
  expect(await adapter.read("pinora.settings")).toEqual(raw);
});

test("successful reload and external repair clear stale settings errors", async () => {
  localStorage.clear();
  const adapter = createPreviewAdapter();
  const service = new SettingsService(adapter);
  await adapter.write("pinora.settings", { schemaVersion: 99 });
  await service.start();
  await adapter.write("pinora.settings", { ...defaults, theme: "dark" });
  expect(service.value.theme).toBe("dark");
  expect(service.error).toBeNull();
  await adapter.write("pinora.settings", { schemaVersion: 99 });
  expect(service.error).not.toBeNull();
  service.stop();
  await adapter.write("pinora.settings", defaults);
  await service.refresh();
  expect(service.error).toBeNull();
  expect(service.needsRecovery).toBe(false);
});

test("browser key reordering does not overwrite an existing recovery copy on startup", async () => {
  localStorage.clear();
  const adapter = createPreviewAdapter();
  const original = { schemaVersion: 99, future: { image: "recovery-image" } };
  await adapter.write("pinora.settings.recovery", original);
  const reordered = JSON.parse(
    JSON.stringify(defaults, (_key, value: unknown) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.fromEntries(
            Object.entries(value).sort(([a], [b]) => a.localeCompare(b)),
          )
        : value,
    ),
  );
  await adapter.write("pinora.settings", reordered);
  const service = new SettingsService(adapter);
  await service.start();
  expect(await adapter.read("pinora.settings.recovery")).toEqual(original);
  service.stop();
});

test("a newer event wins over both late initial success and late initial failure", async () => {
  for (const fail of [false, true]) {
    localStorage.clear();
    const adapter = createPreviewAdapter();
    let changed!: (raw: unknown) => void;
    let finish!: (raw: unknown) => void;
    let reject!: (error: Error) => void;
    vi.spyOn(adapter, "onStorageChanged").mockImplementation(
      (_key, listener) => {
        changed = listener;
        return () => undefined;
      },
    );
    vi.spyOn(adapter, "read").mockReturnValueOnce(
      new Promise((resolve, no) => {
        finish = resolve;
        reject = no;
      }),
    );
    const service = new SettingsService(adapter);
    const starting = service.start();
    changed({ ...defaults, theme: "dark" });
    if (fail) reject(new Error("obsolete read failure"));
    else finish(defaults);
    await starting;
    expect(service.value.theme).toBe("dark");
    expect(service.error).toBeNull();
    service.stop();
  }
});

test("an invalid newer event is not hidden by a late valid read", async () => {
  localStorage.clear();
  const adapter = createPreviewAdapter();
  let finish!: (raw: unknown) => void;
  vi.spyOn(adapter, "read").mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const service = new SettingsService(adapter);
  const starting = service.start();
  await adapter.write("pinora.settings", { schemaVersion: 99 });
  finish(defaults);
  await starting;
  expect(service.needsRecovery).toBe(true);
  expect(service.error).toContain("设置版本尚不受支持");
  service.stop();
});

test("events arriving during migration backup supersede the initial snapshot", async () => {
  localStorage.clear();
  const adapter = createPreviewAdapter();
  await adapter.write("pinora.settings", { theme: "light" });
  let finish!: () => void;
  const original = adapter.write;
  vi.spyOn(adapter, "write").mockImplementation((key, value) =>
    key.endsWith(".recovery")
      ? new Promise<void>((resolve) => {
          finish = resolve;
        })
      : original(key, value),
  );
  const service = new SettingsService(adapter);
  const starting = service.start();
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  await adapter.write("pinora.settings", { ...defaults, theme: "dark" });
  finish();
  await starting;
  expect(service.value.theme).toBe("dark");
  service.stop();
});

test("only the newest explicit refresh applies, and current failures still reject", async () => {
  localStorage.clear();
  const adapter = createPreviewAdapter();
  let finish!: (raw: unknown) => void;
  const read = vi
    .spyOn(adapter, "read")
    .mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    )
    .mockResolvedValueOnce({ ...defaults, theme: "dark" });
  const service = new SettingsService(adapter);
  const old = service.refresh();
  await service.refresh();
  finish(defaults);
  await old;
  expect(service.value.theme).toBe("dark");
  read.mockRejectedValueOnce(new Error("current failure"));
  await expect(service.refresh()).rejects.toThrow("current failure");
});

test("a delayed refresh backup cannot overwrite the newer explicit recovery backup", async () => {
  localStorage.clear();
  const adapter = createPreviewAdapter();
  const older = { schemaVersion: 99, valuable: "older" };
  const newer = { schemaVersion: 99, valuable: "newer" };
  await adapter.write("pinora.settings", older);
  const original = adapter.write;
  let release!: () => void;
  vi.spyOn(adapter, "write").mockImplementation(async (key, value) => {
    if (
      key.endsWith(".recovery") &&
      value &&
      (value as typeof older).valuable === "older"
    )
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    await original(key, value);
  });
  const service = new SettingsService(adapter);
  const starting = service.start();
  await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  await adapter.write("pinora.settings", newer);
  const resetting = service.resetToDefaults();
  release();
  await Promise.all([starting, resetting]);
  expect(await adapter.read("pinora.settings.recovery")).toEqual(newer);
  expect(await adapter.read("pinora.settings")).toEqual(defaults);
  service.stop();
});

test("refresh rechecks persisted data before backing up even without a storage event", async () => {
  localStorage.clear();
  const adapter = createPreviewAdapter();
  const recovery = { valuable: "previous backup" };
  await adapter.write("pinora.settings", defaults);
  await adapter.write("pinora.settings.recovery", recovery);
  vi.spyOn(adapter, "read").mockResolvedValueOnce({ schemaVersion: 99 });
  const service = new SettingsService(adapter);
  await service.refresh();
  expect(await adapter.read("pinora.settings.recovery")).toEqual(recovery);
  expect(service.error).toBeNull();
});

test("collection retains unknown current fields before a migration backup exists", async () => {
  localStorage.clear();
  const adapter = createPreviewAdapter();
  await adapter.write("pinora.settings", {
    ...defaults,
    future: { image: "future-image" },
  });
  const service = new SettingsService(adapter);
  const refs = await service.withStoredSettings(
    async (current, recovery, raw) => assetReferences(current, recovery, raw),
  );
  expect(refs.has("future-image")).toBe(true);
  expect(await adapter.read("pinora.settings.recovery")).toBeUndefined();
});

test("queued icon pruning cannot delete a mapping after its bookmark snapshot is obsolete", async () => {
  localStorage.clear();
  const adapter = createPreviewAdapter();
  await adapter.write("pinora.settings", {
    ...defaults,
    iconMappings: { restored: "kept-image" },
  });
  const service = new SettingsService(adapter);
  await service.start();
  let release!: (value: unknown) => void;
  vi.spyOn(adapter, "read").mockReturnValueOnce(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  const saving = service.update((draft) => {
    draft.theme = "dark";
  });
  await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  let current = true;
  const pruning = service.pruneIcons(new Set(), () => current);
  current = false;
  release(service.value);
  await Promise.all([saving, pruning]);
  expect(service.value.iconMappings).toEqual({ restored: "kept-image" });
  expect(await adapter.read("pinora.settings")).toMatchObject({
    theme: "dark",
    iconMappings: { restored: "kept-image" },
  });
  service.stop();
});
