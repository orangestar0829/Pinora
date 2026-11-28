# Reviewer notes - Pinora 0.0.2

Pinora is a Manifest V3 new-tab extension using React, TypeScript and Vite. UI: Simplified Chinese. No account, payment or external service is needed. Use a disposable profile and test bookmarks: edits/deletions change native bookmarks.

## Test steps
1. Install and open a new tab; accept the new-tab change if prompted. Create bookmarks and a child folder in the browser bookmark manager.
2. In top-right settings, use 外观 (Appearance) > 书签文件夹 (Bookmark folder) to select a folder. Browse folders, search, open/edit/move bookmarks and drag to reorder. Cancel deletion unless using test data.
3. Test light/dark/system themes and 布局 (Layout). Settings persist locally and update other open Pinora tabs in the same profile.
4. In 布局 > 主页内容 (Home content), enable 最近访问 (Recent visits) or 热门网站 (Top sites) using their permission buttons. Both permissions are optional. Visit test sites first. These sections appear only at the home folder with no search. No permission means no data read; revoking it clears the display.
5. In 背景 (Background), test solid/gradient/local wallpaper. Upload a 自定义图标 (Custom icon) from a bookmark menu. Images stay in local IndexedDB.

## Packages
Edge: Pinora-0.0.2.zip uses bookmarks, storage and local favicon; history/topSites are optional.
Firefox: Pinora-0.0.2-firefox.xpi targets desktop Firefox 140+. ID: pinora@pinora.local. No Chromium-only favicon permission or minimum_chrome_version; fallback icons are used.

## Source and privacy
Build source: Pinora-0.0.2-source.zip. Follow its root BUILDING.md for exact environment versions and build commands. Use Windows x64 and PowerShell 5.1 for packaging. package-lock.json pins npm dependencies; npm ci restores them. Third-party notices/licenses are bundled.
All runtime code is bundled. No remote executable code, telemetry, analytics or data upload. Bookmarks and optional history/top-sites data stay on device. Firefox data_collection_permissions.required is ["none"].

## Automated validation warnings
AMO report, 2026-11-27: 0 errors, 3 warnings.
- Android: this submission targets desktop only; gecko_android is omitted. data_collection_permissions is supported on desktop 140 but Android 142. Android compatibility is not requested.
- Two innerHTML warnings in assets/index-C1fmyFgT.js, line 49, columns 1842/4776: React DOM 19.3.0's dangerouslySetInnerHTML implementation, in setProp/setPropOnCustomElement (node_modules/react-dom/cjs/react-dom-client.production.js). Pinora does not call dangerouslySetInnerHTML or assign innerHTML; bookmark/history titles use React text children.
