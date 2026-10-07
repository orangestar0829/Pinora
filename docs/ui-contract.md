# Pinora 0.0.2 UI contract

The UI is implemented in `src/app/**`, `src/components/**`, `src/features/**` and `src/styles/**`. All browser calls MUST remain under `src/browser/**`. Synthetic fixtures are restricted to explicit preview mode and isolated test profiles. No real user bookmark fixtures are seeded. Optional `history` and `topSites` permissions are requested through explicit clicks in Settings → Layout → Home content. No remote requests.

## Lifecycle and reactivity

Import `createRuntime` from `src/domain/runtime`. Call once outside React rendering (or memoize). It returns `{ adapter, bookmarks, settings, start(): Promise<void>, stop(): void }`. Await `start()` and catch errors into a visible retry panel. Subscribe to each service with `service.subscribe(callback)`, returning an unsubscribe function. The services replace `bookmarks.tree` and `settings.value` on changes. They are suitable for `useSyncExternalStore(service.subscribe, () => service.tree/value)`; read `service.error` alongside snapshots (errors may not replace snapshots, so explicit rerender subscription can be useful). All async user actions must be caught and surfaced. `runtime.stop` removes browser listeners. Avoid duplicate start from StrictMode unless lifecycle handles it.

`createAdapter` returns Chromium inside an extension. Outside extension it REQUIRES `?preview=1`, otherwise throws. Always render an explicit synthetic-data preview banner when `adapter.preview` is true. Preview bookmarks are in-memory and reset on refresh; preview settings persist in separate `preview.*` localStorage keys. Never describe preview tests as real extension acceptance.

## Tree

`bookmarks.tree: BookmarkTree = { nodes: Map<string, BookmarkNode>, roots: string[], searchIndex }`. Node fields: `id, parentId?, title, url?, index, children: string[], folder, protected, readOnly, path: string[], hostname`. Path holds ancestor IDs, not the node itself. Use node IDs as keys. Root and its direct children and folderType nodes are protected from rename/move/delete; protected system folders may accept children. Managed/readOnly nodes and their descendants are not editable. Root cannot accept writes. Use `resolveBookmarkFolder(tree, settings.bookmarkFolderId)` from `domain/folderScope` as the dashboard root; never hardcode IDs. Null configuration selects the initial real folder. Missing, non-folder and virtual-root configurations show an unavailable state, never the entire library. Navigation, the parent-folder button, Escape and search results must stay within this root using `isInBookmarkFolder`. The compact dashboard places the bookmark heading, search and settings controls in one row, with cards immediately below. It omits the brand/logo, header divider, bookmark count, organize/add toolbar and section subtitles. A screen-reader heading retains the current folder name; descendant folders retain a parent-navigation button. Recent visits and top sites sit below the root grid with section dividers when enabled and not searching. These sections use browser data independently of the selected bookmark folder and are never bookmark editing or drag targets. Use the browser's native interface to add bookmarks to populated folders; writable empty folders retain the first-bookmark action. If a current descendant disappears or moves outside the scope, return to the configured root. The sidebar tree and dashboard folder-creation action are removed; existing folder operations remain available.

`searchTree(tree, query)` returns matching node array using the already-built index (title, URL, hostname, ancestor names). Call per query; does not traverse the raw tree. Index currently rebuilds once per bookmark event snapshot, not incrementally. Render only current folder / search results, consider result cap or windowing for large sets.

## Bookmark writes

- `bookmarks.create(parentId, title, url?)`: omit url to create folder, returns created raw node.
- `bookmarks.update(id, title, url?)`: folder rename or bookmark edit.
- `bookmarks.remove(id, confirmedNonEmpty = false)`: nonempty folder deletion REQUIRES true after explicit UI confirmation. Confirm ordinary deletions too for user clarity.
- `bookmarks.move(id, parentId, index?)`: target index means FINAL index in the target list after source removal; omit to append. The Chromium adapter boundary translates same-parent forward moves to the browser's pre-removal index. Use `canMove(tree, id, parentId)` for visual validation. For insert-before UI derive index from target children **excluding source**, then locate target.
- `bookmarks.refresh()` reloads explicitly and rejects on failure; automatic events expose `bookmarks.error`. Latest-issued snapshot wins to avoid stale responses.

All writes await API completion and a refresh attempt; do not optimistically discard the current tree. If the write succeeds but refreshing fails, the write resolves successfully and the dashboard exposes the read error. This closes the form and offers retrying the read, avoiding duplicate native writes.

## Open and favicon

`adapter.open(url, mode)` with `'current' | 'new' | 'background'`. UI must preserve middle-click/Ctrl/Cmd/Shift conventions; use background for Ctrl/Cmd or middle, new for Shift. `adapter.favicon(url, size=64)` returns extension-local URL, undefined in preview. Use local fallback if load fails. Custom icon first, favicon next, locally generated initials last. `normalizeUrl` from domain/url rejects active schemes and normalizes bare hosts while preserving explicitly allowed schemes.

## Recent visits

`adapter.hasHistoryPermission()` and `adapter.hasTopSitesPermission()` check the optional grants; the corresponding request methods must be invoked directly within a settings button click. Without permission, never read the source data and show the settings path. `getRecentVisits()` queries at most 100 browser history entries with an explicit `startTime: 0`, filters valid visited HTTP(S) pages, orders by `lastVisitTime` descending, deduplicates URL and returns at most 28 entries. `getTopSites()` reads the browser's local top-sites list, filters HTTP(S), deduplicates URL and returns at most 28 entries. Settings control whether each section is shown and its 1–4 visible rows. `onHistoryChanged(listener)` observes visits, deletions and grant changes; `onTopSitesChanged(listener)` observes top-sites permission changes; dispose both on unmount and refresh on focus/visibility. Clear entries during refresh/revocation and discard stale async responses. Recheck permission before displaying history results. History and top-sites data are held only in component memory. Preview shows installation hints instead of synthetic data. Cards reuse layout/open-mode settings and local favicons but do not expose bookmark actions.

## Settings (stable v1)

Import `Settings`, `defaults` from `storage/settings`. `settings.value` is validated; `settings.update(draft => { draft.theme = 'dark'; })` is Promise<void>. Do NOT pass captured full snapshots: mutate fresh draft fields only. Page queue + Web Locks serialize read/modify/write across new tabs where supported. storage.onChanged propagates to all tabs. Default theme light; themes light/dark/system. Resolve system preference live in UI. A synchronous localStorage theme hint is applied by startup.ts before app render; authoritative values remain extension local storage.

- `schemaVersion: 1`
- `theme: 'light'|'dark'|'system'`, `openMode: 'current'|'new'|'background'`
- `bookmarkFolderId: string|null`: selected dashboard root, null for the default real folder; persisted and synchronized between tabs. Legacy v1 data without this field remains valid.
- `showRecentVisits` / `showTopSites`: boolean visibility switches for the two home sections; defaults `true` / `false`.
- `recentVisitsRows` / `topSitesRows`: integer 1..4 controlling each section's visible rows; default `2`.
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

Invalid individual fields reset to defaults. Unknown schema version throws and original is retained; settings.start records original under pinora.settings.recovery. UI shows settings.error and retries settings.refresh(). After explicit user confirmation, settings.resetToDefaults() backs up the current raw settings before replacing them; backup failure prevents replacement. The recovery key retains the latest backup, not a history. Refresh backups share the settings queue/lock and recheck the captured data before writing. Runtime removes mappings when bookmarks disappear and cancels queued cleanup if its bookmark snapshot becomes obsolete.

Unreferenced blobs are marked first and reclaimed after a 24-hour grace period. Maintenance runs on startup, reference changes and hourly; raw current settings and recovery-copy references are protected, including unknown fields. Media commits and collection share the pinora.assets Web Lock, with fresh settings read under the pinora.settings lock. Collection is skipped where Web Locks are unavailable. settings.maintenanceError is notified independently of ordinary settings errors; runtime.retryMaintenance() retries asset collection, while refreshing bookmarks retries icon cleanup.

## Local images

`prepareImage(file, 'icon'|'wallpaper', crop?)` in storage/images returns processed Blob. PNG/JPEG/WebP/SVG; 5MB icons, 30MB wallpapers. SVG allowlist strips executable/external content and is decoded into raster. Icons become 128px WebP; optional crop `{x,y,size}` uses original image pixel coordinates and square region. Without crop center square. Wallpaper max 3840x2160, retains aspect ratio. UI supplies actual crop controls/preview. All image errors reject usefully.

`assetStore.put(blob): Promise<assetId>`, `.get(id): Promise<Blob|undefined>`, `.remove(id): Promise<void>` in storage/assets. Save processed blob then await settings mapping/background update; if setting write fails remove new orphan if safe. Render via URL.createObjectURL and revoke URLs on replacement/unmount. Missing assets render fallback and let user reimport. IndexedDB failures surface to UI. Imported SVG is never injected into DOM or rendered from its original bytes.

## Remaining verification

See validation.md for verification evidence and remaining boundaries. Original PNG manifest icons are included. No extension service worker is needed for this new-tab-only extension.
