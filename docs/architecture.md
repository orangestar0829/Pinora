# Pinora architecture

Independent clean-room implementation based solely on supplied behavior specification; no third-party extension source or assets were accessed. Pinora is a development name, not a cleared store trademark.

React UI → domain services → BrowserAdapter → Chromium native bookmarks/storage. Raw bookmarks are browser-owned; the extension stores no competing bookmark database. A normalized Map/tree and prebuilt search index exist only in memory. Browser events refresh snapshots; request generations suppress stale responses. System protection is derived from structure and metadata, never specific IDs.

Settings schema v1 validates every persisted field; migrations normalize legacy unversioned values and preserve recoverable originals. Small settings and custom-image mappings live in chrome.storage.local; processed image blobs live in IndexedDB. Local appearance hint is disposable. No permissions beyond bookmarks/storage/favicon; no optional history/topSites/downloads modules this phase. Manifest CSP denies network connections, allows local/blob/data images and locally bundled code. Opening a bookmark is explicit browser navigation.

Milestones: Bootstrap → Browser adapter → Bookmark tree foundation delivered. UI, folder navigation/favicon/search/CRUD drag controls, settings/theme/wallpaper presentation and real-browser acceptance belong to the next batch. Incremental event indexing, large list windowing, further startup benchmarks and packaging are later hardening; full-tree event refresh is currently deliberate simple Alpha behavior.
