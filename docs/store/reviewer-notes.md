# Reviewer notes — Pinora 0.0.2

## Overview

Pinora is a Manifest V3 new tab extension built with React, TypeScript and Vite. The UI is in Simplified Chinese. No account, password, subscription or external service is needed. Please test with a disposable browser profile and synthetic bookmarks: edits and deletions affect native browser bookmarks.

## Test steps

1. Install the package and open a new tab. Accept the browser's prompt to keep the new tab change, if shown.
2. Add bookmarks and a child folder using the browser's native bookmark manager. Pinora should display them. If needed, click the top-right settings button “外观与设置” (Appearance and settings), then “外观” (Appearance) and choose “书签文件夹” (Bookmark folder).
3. Open a child folder and return to its parent. Search from the top bar. Open a bookmark's menu to edit or move it, or drag to reorder it. Cancel a deletion prompt unless you intend to change test data.
4. In settings, choose “浅色” (Light), “深色” (Dark) or system theme. Adjust layout under “布局” (Layout). Changes are saved locally and synchronize to other open Pinora tabs in this browser profile.
5. In “布局” > “主页内容” (Layout > Home content), use the permission button for “最近访问” (Recent visits) or “热门网站” (Top sites). Each permission is optional and requested only from a user action. Open test websites first if the test profile has no browser history. These sections appear only at the home folder with no active search. Without permission there is no history/top-sites read. Revoking permission clears the corresponding display.
6. In “背景” (Background), select a solid color, gradient or a local wallpaper. In a bookmark's menu, use “自定义图标” (Custom icon) to upload a local icon. Images are stored in the extension's local IndexedDB.

## Edge-specific notes

The submitted file is Pinora-0.0.2.zip. It requests bookmarks, storage and favicon; history and topSites are optional. Favicon access uses the browser's local favicon API. All runtime code is bundled; there is no remote executable code or data upload.

## Firefox-specific notes

The submitted file is the unsigned Pinora-0.0.2-firefox.xpi, targeting desktop Firefox 140.0 and later. The add-on ID is pinora@pinora.local. The package removes the Chromium-only favicon permission and minimum_chrome_version. Firefox uses fallback site icons.

Source code is supplied separately as Pinora-0.0.2-source.zip. BUILDING.md at its root records the exact environment and build commands. npm dependencies are pinned by package-lock.json. The build uses Windows PowerShell 5.1 for archive creation; please use the documented Windows environment. The bundled third-party notices and licenses are in public/ and are included in the install package.

The manifest declares required data collection permissions as ["none"]. Bookmarks and optional history/top-sites data are processed on the device. No telemetry, analytics or upload is performed.

## Automated validation warnings

The AMO validation report dated November 27, 2026 passed with zero errors and three warnings:

- Android minimum version: Pinora targets desktop Firefox only. browser_specific_settings.gecko_android is intentionally omitted. The desktop minimum is 140.0, which supports data_collection_permissions; that feature was introduced in Firefox for Android 142. This submission does not request Android compatibility.
- Two innerHTML assignments: assets/index-C1fmyFgT.js, line 49, columns 1842 and 4776, are from the bundled React DOM 19.3.0 implementation of dangerouslySetInnerHTML. The corresponding dependency source is node_modules/react-dom/cjs/react-dom-client.production.js, in setProp and setPropOnCustomElement. Pinora's application source does not use dangerouslySetInnerHTML or assign to innerHTML. Bookmark and history titles are rendered as React text children, not as HTML.

The dependency version is recorded in package-lock.json; npm ci restores the dependency source for review. Desktop compatibility is documented at https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings and data consent support at https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/ .
