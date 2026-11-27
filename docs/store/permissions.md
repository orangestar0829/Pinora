# 权限与隐私表单

以下英文段落可直接粘贴到权限用途字段。

## Single purpose

Replace the new tab page with a local dashboard centered on the browser's native bookmarks, with optional recent visits and top sites.

## bookmarks

Read and display the browser's native bookmark tree on the new tab page. Let the user choose a home folder, search within it, create a bookmark in an empty folder, edit or delete bookmarks, rename or delete existing folders, and drag bookmarks to reorder or move them. Changes are written directly to the browser's bookmark API. Bookmark data is not uploaded.

## storage

Save extension preferences and custom icon mappings in storage.local, including the selected home folder, theme, layout and background settings. Notify other open Pinora tabs of settings changes within the same browser profile. This permission is not used for cloud synchronization.

## favicon — Edge only

Display site icons using the browser's local favicon API. Pinora does not call a third-party favicon service. The Firefox package does not request this permission and uses fallback icons.

## history — optional

Only after a user clicks the permission button in Settings > Layout > Home content, read recent browser history to display a Recent visits section. Query at most 100 history entries and display at most 28 HTTP(S) pages. Do not modify, separately persist or upload history. Without permission this data is not read; revocation clears the display.

## topSites — optional

Only after a user clicks the permission button in Settings > Layout > Home content, read the browser's top sites and display up to 28 entries. The list is used in page memory and is not separately persisted or uploaded. Without permission it is not read; revocation clears the display.

## Remote code

No remotely hosted executable code is used. JavaScript, CSS and dependencies are bundled in the extension. Pinora has no backend, analytics or advertising service. Its extension-page Content Security Policy sets connect-src to 'none'. User-opened bookmark destinations are normal browser navigations.

## 数据使用声明

按字段区分本机访问、保存和对外收集/传输：本扩展访问原生书签，并在用户授权后读取浏览历史或热门网站；设置与图片在本机保存。不会把这些数据上传、出售或提供给第三方，不用于广告、信用评估或其他无关用途。

如果后台字段问“是否访问个人数据”，不能因无上传就填成完全不访问。若字段问“是否对外收集/传输”，按不上传的实际行为填写；同时提交隐私政策。

Firefox 包使用 browser_specific_settings.gecko.data_collection_permissions.required = ["none"]，对应当前没有数据收集或传输的行为。API 权限 history/topSites 与数据传输许可是不同的声明。
