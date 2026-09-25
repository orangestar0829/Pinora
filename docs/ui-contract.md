# Pinora 0.1 Alpha UI contract

Foundation only is complete; `src/main.tsx` is a placeholder to replace. UI owns `src/app/**`, `src/components/**`, `src/features/**`, styles and main bootstrap. All browser calls MUST remain under `src/browser/**`. No real bookmark fixtures are seeded. No new permissions or remote requests.

## Lifecycle and reactivity

Import `createRuntime` from `src/domain/runtime`. Call once outside React rendering (or memoize). It returns `{ adapter, bookmarks, settings, start(): Promise<void>, stop(): void }`. Await `start()` and catch errors into a visible retry panel. Subscribe to each service with `service.subscribe(callback)`, returning an unsubscribe function. The services replace `bookmarks.tree` and `settings.value` on changes. They are suitable for `useSyncExternalStore(service.subscribe, () => service.tree/value)`; read `service.error` alongside snapshots (errors may not replace snapshots, so explicit rerender subscription can be useful). All async user actions must be caught and surfaced. `runtime.stop` removes browser listeners. Avoid duplicate start from StrictMode unless lifecycle handles it.

`createAdapter` returns Chromium inside an extension. Outside extension it REQUIRES `?preview=1`, otherwise throws. Always render an explicit synthetic-data preview banner when `adapter.preview` is true. Preview bookmarks are in-memory and reset on refresh; preview settings persist in separate `preview.*` localStorage keys. Never describe preview tests as real extension acceptance.

## Tree

`bookmarks.tree: BookmarkTree = { nodes: Map<string, BookmarkNode>, roots: string[], searchIndex }`. Node fields: `id, parentId?, title, url?, index, children: string[], folder, protected, readOnly, path: string[], hostname`. Path holds ancestor IDs, not the node itself. Use node IDs as keys. Root and its direct children and folderType nodes are protected from rename/move/delete; protected system folders may accept children. Managed/readOnly nodes and their descendants are not editable. Root cannot accept writes. Use `initialFolder(tree)` from `domain/tree` for first writable system folder or root fallback; never hardcode IDs. Breadcrumb path is `[...node.path, node.id]` mapped through nodes. If current folder disappears select initialFolder again.

`searchTree(tree, query)` returns matching node array using the already-built index (title, URL, hostname, ancestor names). Call per query; does not traverse the raw tree. Index currently rebuilds once per bookmark event snapshot, not incrementally. Render only current folder / search results, consider result cap or windowing for large sets.

## Bookmark writes

- `bookmarks.create(parentId, title, url?)`: omit url to create folder, returns created raw node.
- `bookmarks.update(id, title, url?)`: folder rename or bookmark edit.
- `bookmarks.remove(id, confirmedNonEmpty = false)`: nonempty folder deletion REQUIRES true after explicit UI confirmation. Confirm ordinary deletions too for user clarity.
- `bookmarks.move(id, parentId, index?)`: target index means FINAL index in the target list after source removal; omit to append. Use `canMove(tree, id, parentId)` for visual validation. For insert-before UI derive index from target children **excluding source**, then locate target. Drag reorder same-parent forward/backward must be verified in real Chromium as API semantics are not yet smoke tested.
- `bookmarks.refresh()` reloads explicitly and rejects on failure; automatic events expose `bookmarks.error`. Latest-issued snapshot wins to avoid stale responses.

All writes await API completion and refresh; do not optimistically discard current tree. Refresh failure after an API success means native mutation may already have happened; prompt retry refresh, not blindly duplicate creation.

## Open and favicon

`adapter.open(url, mode)` with `'current' | 'new' | 'background'`. UI must preserve middle-click/Ctrl/Cmd/Shift conventions; use background for Ctrl/Cmd or middle, new for Shift. `adapter.favicon(url, size=64)` returns extension-local URL, undefined in preview. Use local fallback if load fails. Custom icon first, favicon next, locally generated initials last. `normalizeUrl` from domain/url rejects active schemes and normalizes bare hosts while preserving explicitly allowed schemes.

## Settings (stable v1)

Import `Settings`, `defaults` from `storage/settings`. `settings.value` is validated; `settings.update(draft => { draft.theme = 'dark'; })` is Promise<void>. Do NOT pass captured full snapshots: mutate fresh draft fields only. Page queue + Web Locks serialize read/modify/write across new tabs where supported. storage.onChanged propagates to all tabs. Default theme light; themes light/dark/system. Resolve system preference live in UI. A synchronous localStorage theme hint is applied by startup.ts before app render; authoritative values remain extension local storage.

- `schemaVersion: 1`
- `theme: 'light'|'dark'|'system'`, `openMode: 'current'|'new'|'background'`
- `layout.tileSize`: 96..240, default 148
- `layout.iconSize`: 20..96, default 40
- `layout.gapX/gapY`: 4..64, defaults 16/20
- `layout.radius`: 0..40, default 18
- `layout.fontSize`: 10..24, default 14
- `layout.labels`: one/two/hidden
- `layout.maxWidth`: 640..2400, default 1200
- `layout.showHostname`: boolean, default true
- `background.type`: solid/gradient/image
- `background.color/gradientEnd`: #RRGGBB, defaults #f5f4ee/#dce8dc
- `background.assetId`: string|null
- `background.fit`: cover/contain/center/stretch/tile
- `background.blur`: 0..40 px; brightness 20..150 percent; overlay 0..90 percent
- `iconMappings: Record<bookmarkId, assetId>`

Invalid individual fields reset to defaults. Unknown schema version throws and original is retained; settings.start records original under pinora.settings.recovery. UI show settings.error. Reset via `settings.update(d => Object.assign(d, structuredClone(defaults)))`; if preserving user icons/background is desired reset fields independently. Runtime removes mappings when bookmarks disappear. Blob garbage collection is intentionally not automatic (avoid deleting shared/referenced assets); remove replaced assets only after checking all current references.

## Local images

`prepareImage(file, 'icon'|'wallpaper', crop?)` in storage/images returns processed Blob. PNG/JPEG/WebP/SVG; 5MB icons, 30MB wallpapers. SVG allowlist strips executable/external content and is decoded into raster. Icons become 128px WebP; optional crop `{x,y,size}` uses original image pixel coordinates and square region. Without crop center square. Wallpaper max 3840x2160, retains aspect ratio. UI supplies actual crop controls/preview. All image errors reject usefully.

`assetStore.put(blob): Promise<assetId>`, `.get(id): Promise<Blob|undefined>`, `.remove(id): Promise<void>` in storage/assets. Save processed blob then await settings mapping/background update; if setting write fails remove new orphan if safe. Render via URL.createObjectURL and revoke URLs on replacement/unmount. Missing assets render fallback and let user reimport. IndexedDB failures surface to UI. Imported SVG is never injected into DOM or rendered from its original bytes.

## Remaining verification

Foundation typecheck/lint/unit/build passed. No real browser loaded yet. Root should own Playwright extension smoke, native create/edit/move/delete/event sync, same-parent reorder directions, wallpaper/icon persistence and zero external network assertion. Need PNG icons for store packaging later; SVG logo is original display asset. No extension service worker is needed for new-tab-only Alpha.
