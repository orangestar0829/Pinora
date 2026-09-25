# NelliTab 类新标签页扩展 Clean-room 复刻规格 v1.0

## 1. 项目目标

开发一个全新的浏览器新标签页扩展，定位为：

**“以浏览器原生书签为核心的、本地优先、快速、可高度定制的新标签页。”**

目标不是复制 NelliTab 的源码，而是根据其公开可观察行为重新实现同类产品体验。

第一阶段支持：

* Google Chrome
* Microsoft Edge
* 其他 Chromium 浏览器

第二阶段支持：

* Mozilla Firefox

项目必须拥有：

* 全新项目名称
* 全新 Logo
* 全新 UI 资产
* 全新代码
* 全新工程结构
* 独立的数据结构
* 独立的设置结构

不得使用 NelliTab 商标、Logo、图片、CSS、JavaScript、HTML 或其他原始资源。

---

# 2. Clean-room 强制规则

## 2.1 允许作为开发依据的资料

AI 和开发人员仅允许参考：

1. NelliTab 运行时的用户可见行为。
2. 用户自己制作的截图。
3. 用户自己记录的交互流程。
4. NelliTab 曾经公开发布的商店功能描述。
5. 公开评论和公开评测文章对功能的描述。
6. Chrome / Firefox 官方 WebExtension API 文档。
7. 其他独立开源项目的通用实现方式，但必须遵守其许可证。

NelliTab 的公开产品描述确认它具有书签、Top Sites、历史记录、下载记录、本地 favicon、拖拽书签管理、历史记录按域名分组、自定义图标、壁纸、主题、图标大小、圆角和 backdrop filter 等功能。

历史公开评测还描述了创建文件夹、书签拖动、文件夹排序、搜索以及编辑模式等外部可观察行为。

这些功能可以作为本项目的行为需求，但不得因此复制其内部实现。

---

## 2.2 严禁提供给 AI 的内容

开发期间不得：

* 解包 NelliTab CRX/XPI 后读取 JS。
* 读取 NelliTab CSS。
* 读取 NelliTab HTML。
* 读取 source map。
* 复制其中的图片、SVG、Logo、字体等。
* 把原代码交给 AI 要求“重构”。
* 把原代码交给 AI 要求“用 TypeScript 重写”。
* 根据原代码的变量、类、模块结构重新实现。
* 使用反编译结果作为实现依据。

禁止以下工作流：

```text
NelliTab JS
→ AI
→ 重构
→ 新项目
```

允许：

```text
NelliTab 用户可见行为
→ 功能规格
→ AI
→ 全新架构
→ 全新代码
```

---

# 3. 产品核心原则

产品应遵守以下设计原则：

### Local First

书签、历史、下载、图标、壁纸及配置尽可能在浏览器本地处理。

默认：

* 无账户
* 无云同步服务器
* 无遥测
* 无广告
* 无第三方 favicon 服务
* 无用户行为上传

### Browser Native

书签必须直接使用浏览器现有书签树，而不是建立独立的“Speed Dial”数据库。

即：

```text
浏览器 Bookmarks
        ↓
扩展读取
        ↓
新标签页可视化
```

用户在本扩展中：

* 添加
* 删除
* 重命名
* 移动
* 排序

书签时，应直接反映到浏览器原生书签系统。

---

# 4. 推荐技术栈

建议使用：

```text
TypeScript
React
Vite
Manifest V3
Zustand
dnd-kit
IndexedDB
chrome.storage.local
WebExtension Adapter Layer
```

不强制完全按照以上技术栈实现，但必须保持模块独立。

建议目录：

```text
src/
  app/
  components/
  features/
    bookmarks/
    history/
    top-sites/
    downloads/
    search/
    icons/
    wallpaper/
    settings/
  browser/
    bookmarks.ts
    history.ts
    downloads.ts
    topSites.ts
    favicon.ts
    permissions.ts
  storage/
  theme/
  i18n/
  utils/
  types/
```

不要模仿 NelliTab 原来的工程目录。

---

# 5. 浏览器权限设计

遵循：

**最小权限原则。**

基础功能默认只要求：

```text
bookmarks
storage
favicon
```

Chrome 官方 Bookmarks API 可以读取、创建、组织和修改浏览器书签。

Chrome Manifest V3 提供独立的 `favicon` 权限和 `_favicon` 接口，因此 Chromium 版第一阶段不应为了图标请求 `<all_urls>`。

以下功能采用可选权限。

| 功能        | Permission  |
| --------- | ----------- |
| Bookmarks | `bookmarks` |
| 设置        | `storage`   |
| 网站图标      | `favicon`   |
| Top Sites | `topSites`  |
| History   | `history`   |
| Downloads | `downloads` |

Chrome 官方分别要求 `topSites`、`history` 和 `downloads` 权限才能访问这些数据。

不要默认请求：

```text
<all_urls>
tabs
webRequest
scripting
cookies
```

除非以后出现明确且无法通过其他 API 实现的功能。

---

# 6. 新标签页

## FR-001 新标签页替换

安装后：

```text
打开新标签页
↓
显示本扩展 Dashboard
```

页面必须：

* 本地加载。
* 不等待网络。
* 无明显白屏。
* 首屏优先展示书签。
* 设置、背景和布局缓存后立即恢复。

期望：

```text
Warm start < 150 ms
Cold start < 500 ms
```

性能指标属于本项目自身目标，不要求复制任何其他软件的实现。

---

# 7. 主界面结构

建议视觉结构：

```text
┌─────────────────────────────────────┐
│ Breadcrumb                   Search │
│                                     │
│           当前文件夹标题            │
│                                     │
│  [Folder] [Folder] [Site] [Site]   │
│  [Site]   [Site]   [Site] [Site]   │
│                                     │
│                                     │
│ Menu                         Settings│
└─────────────────────────────────────┘
```

这只是信息架构要求。

最终：

* 卡片样式
* 阴影
* 字体
* 圆角
* 菜单
* 动画
* 图标

必须自行设计，不做 NelliTab 像素级复制。

---

# 8. Bookmarks 模块

这是整个产品最高优先级功能。

## FR-100 浏览器书签树

读取完整浏览器 Bookmarks Tree。

需要支持：

```text
Root
├── Bookmarks Bar
├── Other Bookmarks
└── Mobile Bookmarks
```

不同浏览器出现的系统节点应动态检测，而不能写死 ID。

---

## FR-101 文件夹显示

书签文件夹显示为 Folder Tile。

至少显示：

* 文件夹图标
* 文件夹名称
* 可选：项目数量

单击：

```text
Folder
↓
进入 Folder
↓
显示其直接子节点
```

支持无限层级。

---

## FR-102 Breadcrumb

进入：

```text
Bookmarks
  └ Work
      └ Development
```

顶部显示：

```text
Bookmarks / Work / Development
```

点击任一级：

立即返回对应目录。

---

## FR-103 Bookmark Tile

书签至少显示：

```text
favicon
title
```

根据设置可增加：

```text
hostname
URL
```

默认不显示完整 URL。

单击：

在当前标签打开。

支持设置：

```text
当前标签
新标签
后台标签
```

其中中键和 Ctrl/Cmd + Click 应符合浏览器常见行为。

---

# 9. Bookmark 编辑

## FR-110 新建书签

当前目录提供：

```text
+ Add Bookmark
```

表单：

```text
Title
URL
Icon(optional)
```

URL 输入后：

自动规范化。

例如：

```text
google.com
```

可以转换为：

```text
https://google.com/
```

但不得错误修改非 HTTP 协议书签。

---

## FR-111 新建文件夹

提供：

```text
+ New Folder
```

创建在当前目录。

输入：

```text
Folder Name
```

创建后立即出现在 UI 中。

---

## FR-112 编辑书签

Context Menu：

```text
Open
Open in new tab
Edit
Move
Custom icon
Reset icon
Delete
```

Edit：

```text
Title
URL
```

必须直接修改浏览器原生 bookmark。

---

## FR-113 编辑文件夹

支持：

```text
Rename
Move
Delete
```

删除非空文件夹前：

必须明确提示用户。

---

# 10. Drag & Drop

这是核心交互。

公开的 NelliTab 产品描述明确包含 drag-and-drop bookmark management。

本项目独立实现：

## FR-120 同文件夹排序

```text
A B C D
```

拖：

```text
D → B之前
```

结果：

```text
A D B C
```

必须同步到浏览器 bookmark index。

---

## FR-121 跨文件夹移动

允许：

```text
Bookmark A
↓
拖到 Folder B
```

结果：

Bookmark A 的 `parentId` 修改为 Folder B。

---

## FR-122 Folder 移动

文件夹也允许：

* 排序
* 移到其他目录

必须防止：

```text
Folder A
└ Folder B
```

然后把 Folder A 移入 Folder B。

即阻止循环父子关系。

---

## FR-123 拖动视觉反馈

必须显示：

* Drag ghost
* Drop target
* Insert marker
* Invalid target 状态

---

# 11. 多选 / Edit Mode

作为兼容 NelliTab 类工作流的功能，实现自己的交互。

进入 Edit Mode：

```text
顶部 Edit
```

或：

```text
Shift + Click
```

支持选择：

* 多个 Bookmark
* 多个 Folder

批量功能：

```text
Move
Delete
Reset custom icon
```

不要求复制 NelliTab 原来的 Shift-hover 行为。

---

# 12. Search

## FR-200 全局搜索

右上角提供 Search。

搜索范围默认：

```text
Bookmarks
```

匹配：

```text
title
hostname
URL
folder name
```

例如：

```text
git
```

可以找到：

```text
GitHub
GitLab
Gitea
```

---

## FR-201 搜索结果

结果应显示：

```text
favicon
title
folder path
```

例如：

```text
GitHub
Bookmarks / Development / Code
```

点击直接打开。

---

## FR-202 可选搜索范围

开启对应权限后允许：

```text
Bookmarks
History
Top Sites
```

Downloads 不建议默认加入统一搜索，以避免大量文件结果干扰。

---

# 13. Top Sites

公开 NelliTab 描述包含 Top Sites，本项目使用浏览器官方 API 独立实现。

Chrome `chrome.topSites` 能直接返回浏览器最常访问的网站。

## FR-300 Top Sites 虚拟文件夹

主页可以显示：

```text
★ Top Sites
```

这是虚拟目录，不写入 Bookmarks。

打开后：

展示浏览器提供的 Top Sites。

---

## FR-301 权限按需申请

第一次点击：

```text
Top Sites
```

如果权限未授权：

显示说明：

```text
允许访问浏览器的常用网站？
```

用户确认后：

请求 `topSites`。

拒绝：

功能保持关闭。

---

# 14. History

公开功能描述包括历史记录以及按域名/hostname 分组，并允许删除历史记录。

## FR-400 History 虚拟文件夹

主页面可启用：

```text
History
```

进入后：

默认展示近期记录。

---

## FR-401 History 显示模式

提供：

```text
Chronological
By Domain
By Hostname
```

例如：

```text
github.com
  Repository A
  Repository B

youtube.com
  Video A
  Video B
```

---

## FR-402 时间范围

至少支持：

```text
Today
Last 7 Days
Last 30 Days
```

---

## FR-403 删除 History Item

Context Menu：

```text
Remove from history
```

调用浏览器官方 history API。

删除前无需二次确认单个条目。

批量删除必须确认。

Chrome History API 可以搜索以及删除 URL。

---

# 15. Downloads

公开 NelliTab 功能包含下载记录。

## FR-500 Downloads 虚拟目录

主页可以启用：

```text
Downloads
```

显示：

```text
文件类型图标
filename
source hostname
download time
state
```

---

## FR-501 下载操作

第一版只实现安全的基本操作：

```text
Open
Show in folder
Copy source URL
```

不要实现：

* 自动删除文件
* 自动下载
* 修改 download shelf

除非未来明确增加。

Chrome Downloads API 可以查询下载并获取操作系统对应的文件图标。

---

# 16. Favicon 系统

这是产品体验的重点。

原则：

**不依赖 Google Favicon API、DuckDuckGo、Clearbit 等第三方 favicon 服务。**

公开 NelliTab 产品描述也特别强调使用网站自身/本地图标而不依赖外部服务。

Chromium 第一阶段优先使用官方 Manifest V3 favicon API。

## FR-600 图标优先级

建议：

```text
1. 用户 Custom Icon
2. Browser Favicon API
3. 本地缓存
4. 自动生成 fallback
```

Fallback 可以是：

```text
G
```

并根据 hostname 稳定生成背景样式。

不得使用其他扩展的 fallback 设计。

---

# 17. Custom Icon

## FR-610 用户自定义图标

支持：

```text
PNG
JPEG
WebP
SVG（需安全解析）
```

用户可以：

```text
上传图片
↓
裁剪
↓
保存
```

建议内部统一生成：

```text
128x128 WebP
```

同时保留透明通道。

---

## FR-611 图标覆盖映射

自定义图标不写入浏览器 Bookmark 数据。

单独保存映射：

```text
bookmarkId → customIconId
```

如果 bookmark 被删除：

自动清理映射。

如果 Bookmark URL 改变：

默认保留 custom icon。

---

# 18. Wallpaper

公开功能描述确认存在自定义 wallpaper。

## FR-700 Background 类型

支持：

```text
Solid Color
Gradient
Local Image
```

未来再考虑：

```text
Video
Remote image
Daily wallpaper
```

第一版不要联网获取壁纸。

---

## FR-701 Background Image

允许从本地上传。

设置：

```text
Cover
Contain
Center
Stretch
Tile
```

另外提供：

```text
Blur
Brightness
Overlay opacity
```

---

# 19. Theme

公开产品功能包括 Light、Dark 和自定义主题。

支持：

```text
Auto
Light
Dark
Custom
```

Auto：

跟随：

```text
prefers-color-scheme
```

---

## FR-710 Custom Theme

允许设置：

```text
Page background
Text
Secondary text
Tile background
Tile hover
Accent
Folder color
Border
Shadow
```

所有颜色必须有 Reset。

---

# 20. Layout Customization

公开描述明确提到 icon size、border radius 等自定义能力。

至少提供：

```text
Tile size
Icon size
Horizontal gap
Vertical gap
Border radius
Font size
Label visibility
Grid density
Max content width
```

不要提供几十个 CSS 原始输入框。

使用清晰的 UI Control。

---

# 21. Glass / Backdrop

可以实现自己的：

```text
Backdrop Blur
Tile Transparency
Background Blur
```

作为实验功能。

例如：

```text
Enable Glass Effect
Blur: 0–40 px
Transparency: 0–100%
```

如果设备性能差：

允许完全关闭。

---

# 22. Settings 页面

设置分为：

```text
General
Appearance
Bookmarks
Top Sites
History
Downloads
Icons
Background
Privacy
Backup
About
```

不要复制 NelliTab 的原设置页面布局。

---

# 23. 首页模块开关

用户可以决定是否显示：

```text
Bookmarks
Top Sites
History
Downloads
```

其中：

Bookmarks 永远可用。

其他模块：

```text
关闭
↓
不申请权限
```

只有开启时才请求相应权限。

---

# 24. 数据存储

推荐：

## chrome.storage.local

保存小型设置：

```ts
settings
theme
layout
featureFlags
iconMappings
```

概念数据结构：

```text
Settings
  version
  theme
  layout
  features
  behavior
```

不要模仿任何旧扩展的 schema。

---

## IndexedDB

用于较大 Blob：

```text
wallpaper
custom icon
generated thumbnail
future assets
```

建议：

```text
Database
  assets
  metadata
```

---

# 25. 配置版本迁移

所有设置必须：

```text
schemaVersion
```

例如：

```text
1
2
3
```

升级扩展：

```text
v1 config
↓ migration
v2 config
```

Migration 必须：

* 可测试
* 幂等
* 出错后保留原配置备份

---

# 26. Backup / Restore

这是我们自己的增强功能。

## FR-800 Export Settings

导出：

```text
JSON
```

包含：

```text
appearance
layout
custom icon mappings
wallpaper settings
feature settings
```

可选择：

```text
Include custom images
```

---

## FR-801 不导出 Bookmarks

默认不要把浏览器整个书签库混入 Settings Backup。

因为 Bookmarks 本身由浏览器管理。

可以另外提供：

```text
Export bookmarks
```

但作为完全独立功能。

---

# 27. 实时同步

必须监听 Browser Bookmark events。

当用户：

```text
浏览器书签管理器
↓
新增/删除/移动 Bookmark
```

已经打开的新标签页应自动更新。

监听：

```text
onCreated
onRemoved
onChanged
onMoved
onChildrenReordered
```

不要每秒轮询整个 Bookmark Tree。

---

# 28. 多标签页状态

同时打开：

```text
Tab A
Tab B
Tab C
```

Tab A 调整主题：

Tab B、C 应快速收到更新。

使用：

```text
storage.onChanged
```

或者 extension message。

---

# 29. Context Menu

Bookmark Tile 右键：

```text
Open
Open in new tab
Edit
Move
Custom icon
Copy URL
Delete
```

Folder：

```text
Open
Rename
Move
Change appearance
Delete
```

History：

```text
Open
Open in new tab
Remove from history
```

Download：

```text
Open
Show in folder
Copy source URL
```

---

# 30. Keyboard Navigation

至少支持：

```text
Arrow Keys → Tile navigation
Enter → Open
Space → Select
Esc → Back / Close Dialog
Ctrl/Cmd + F → Search
Delete → Delete selected item
F2 → Rename
```

删除操作仍遵循安全确认规则。

---

# 31. Accessibility

必须支持：

```text
Keyboard-only operation
ARIA labels
Visible focus indicator
Contrast compliance
prefers-reduced-motion
```

动画不得成为功能必要条件。

---

# 32. 响应式布局

至少适配：

```text
1280×720
1366×768
1920×1080
2560×1440
3840×2160
```

窗口宽度变化：

Grid 自动调整列数。

不能因为收藏夹名称过长导致 layout shift。

---

# 33. Bookmark 名称显示

标题策略：

```text
1 line
2 lines
hidden
```

超长：

```text
GitHub - Where the world buil...
```

Hover：

显示完整标题 Tooltip。

---

# 34. URL 安全

禁止直接执行：

```text
javascript:
data:text/html
```

等高风险 URL。

默认允许：

```text
http:
https:
chrome:
edge:
about:
file:
```

其中部分浏览器内部地址可能无法由扩展直接打开，应优雅失败。

不得自行绕过浏览器安全限制。

---

# 35. Privacy

项目必须遵循：

```text
No telemetry by default
No analytics
No remote tracking
No ads
No account
```

扩展不得把以下内容发送到服务器：

```text
Bookmarks
History
Downloads
URLs
Search terms
Custom icons
Wallpaper
Settings
```

除非未来单独开发显式 opt-in 云同步功能。

---

# 36. 网络策略

第一版应尽可能做到：

```text
新标签页工作
=
0 个外部网络请求
```

普通 Bookmark 点击自然访问网站不计。

开发时应提供测试：

```text
打开新标签
↓
DevTools Network
↓
无第三方请求
```

---

# 37. UI Identity

为了保证 clean-room，明确禁止：

```text
NelliTab Logo
NelliTab 名称
原版宣传图
原版图标
像素级 UI
原版配色预设
原版 CSS 数值整套复刻
```

允许：

```text
文件夹卡片
网站图标
网格布局
搜索框
设置按钮
背景图
暗色主题
```

这些属于通用产品模式。

---

# 38. 品牌

项目开发阶段使用代号：

```text
Project NovaTab
```

这只是占位名。

发布前进行：

* Chrome Store 名称搜索
* GitHub 项目名称搜索
* 商标冲突检查

最终名称再确定。

---

# 39. 浏览器抽象层

UI 层禁止到处直接调用：

```text
chrome.*
```

统一封装：

```text
BrowserBookmarks
BrowserHistory
BrowserTopSites
BrowserDownloads
BrowserFavicon
BrowserPermissions
BrowserStorage
```

例如：

```text
UI
 ↓
BookmarkService
 ↓
BrowserAdapter
 ↓
Chrome / Firefox
```

这样未来 Firefox 不需要重写 UI。

---

# 40. 权限降级

如果用户拒绝 History：

不能报错。

应该：

```text
History
Permission required
[Enable]
```

如果不授权：

Bookmarks 等其他模块继续正常工作。

Downloads / Top Sites 同理。

---

# 41. Error Handling

任何 Browser API 调用必须：

```text
try
catch
```

并处理：

* permission denied
* bookmark disappeared
* folder changed during drag
* invalid URL
* corrupted setting
* IndexedDB unavailable
* image too large

UI 不出现：

```text
Uncaught Promise rejection
```

---

# 42. 图片限制

自定义 icon 建议限制：

```text
<= 5 MB
```

Wallpaper：

```text
<= 30 MB
```

大图片导入后：

根据屏幕合理 resize / encode。

防止用户上传一张 80MB PNG 导致新标签页变慢。

---

# 43. Performance

创建一个测试书签库：

```text
5,000 Bookmarks
500 Folders
10 levels deep
```

要求：

* 打开当前文件夹不遍历 DOM 渲染全部 5000 条。
* 搜索可以快速返回。
* Drag 不明显掉帧。
* Background 不阻塞主线程。

大型列表必要时 virtualize。

---

# 44. Search Index

书签初始化后建立内存搜索索引：

```text
bookmark id
title
url
hostname
folder path
```

Bookmark event：

进行增量更新。

不要每次输入一个字符重新遍历完整 Bookmark Tree。

---

# 45. 测试要求

Unit Test：

```text
Bookmark tree normalization
URL normalization
Search
Folder path calculation
Settings migration
Theme serialization
Permission state
```

Integration Test：

```text
Create bookmark
Rename bookmark
Move bookmark
Delete bookmark
Create folder
Drag between folders
```

E2E：

```text
Install extension
Open New Tab
Navigate folders
Search
Change theme
Upload wallpaper
Restart browser
Verify persistence
```

---

# 46. Clean-room 验收检查

发布前必须回答全部：

```text
[ ] 项目是否从空仓库开始？
[ ] 是否没有导入 NelliTab CRX/XPI？
[ ] 是否没有读取 NelliTab JS？
[ ] 是否没有读取 NelliTab CSS？
[ ] 是否没有复制 NelliTab 图片？
[ ] 是否没有使用 NelliTab Logo？
[ ] 是否没有使用其名称作为产品名？
[ ] UI 是否为独立视觉设计？
[ ] 数据结构是否自行设计？
[ ] 架构是否自行设计？
[ ] 代码是否可以解释其独立来源？
```

所有答案必须满足 clean-room 要求。

---

# 47. 第一阶段 MVP

首先只完成：

```text
Manifest V3
New Tab override
Bookmarks Tree
Folder navigation
Bookmark cards
Browser favicon
Search
Create/Edit/Delete
Drag & Drop
Dark/Light mode
Layout customization
Local settings
Custom icon
Wallpaper
```

达到这里即可作为：

**0.1 Alpha**

---

# 48. 第二阶段

加入：

```text
Top Sites
History
History grouping
History deletion
Downloads
Optional permissions
Multi-select
Import/export settings
Custom theme
Advanced layout
Glass effect
```

作为：

**0.5 Beta**

---

# 49. 第三阶段

重点做：

```text
Firefox adapter
Accessibility
Large bookmark performance
Keyboard workflow
Migration testing
Store packaging
Privacy policy
```

作为：

**1.0**

---

# 50. 明确不做的功能

第一版禁止 scope creep：

```text
账号系统
云服务器
AI
天气
RSS
Crypto
广告
新闻
邮件
在线壁纸市场
插件商店
服务端 favicon
社交功能
```

产品核心始终是：

```text
Bookmarks
+
Top Sites
+
History
+
Downloads
+
优秀的新标签页体验
```

---

# 51. AI 开发指令

把下面这部分直接提供给 Codex：

> 你正在从零开发一个 Manifest V3 浏览器新标签页扩展。
>
> 项目采用 clean-room 方法实现。不得搜索、下载、反编译、读取或参考 NelliTab 的任何源代码、CRX/XPI 内容、CSS、HTML、图片资源、source map 或内部数据结构。
>
> 唯一允许参考的是本文档描述的产品行为、浏览器官方 API 文档和通用开源技术资料。
>
> 所有架构、文件结构、类型、组件、状态模型、CSS、图标、视觉设计以及测试必须独立创建。
>
> 如果某个功能在本文档中没有明确说明，不得通过寻找 NelliTab 原实现来确定行为，应根据现代浏览器扩展最佳实践自行设计。
>
> 优先目标依次为：
>
> 1. 数据安全。
> 2. 本地优先。
> 3. 最小权限。
> 4. 快速启动。
> 5. 原生浏览器书签兼容。
> 6. 易维护。
> 7. Chrome/Edge 首先，Firefox 可扩展。
>
> 第一阶段请不要一次完成整个项目。
>
> 按顺序实施：
>
> `Bootstrap → Browser Adapter → Bookmark Tree → New Tab UI → Folder Navigation → Favicon → Search → Bookmark CRUD → Drag & Drop → Settings → Theme → Wallpaper → Tests`
>
> 每完成一个阶段：
>
> * 运行 typecheck。
> * 运行 lint。
> * 运行 tests。
> * 检查浏览器扩展是否仍可加载。
> * 提交独立 Git commit。
>
> 不得为了简化开发而请求 `<all_urls>`。
>
> 不得引入任何遥测或第三方服务。

---

# 52. 最终验收场景

一个新用户安装扩展。

浏览器已经拥有：

```text
Bookmarks Bar
├── AI
│   ├── ChatGPT
│   ├── Claude
│   └── Gemini
├── VPS
│   ├── Netcup
│   └── Cloudflare
└── GitHub
```

打开 New Tab：

应立即看到这些真实书签。

进入：

```text
AI
```

看到：

```text
ChatGPT
Claude
Gemini
```

把：

```text
Gemini
```

拖到：

```text
VPS
```

浏览器原生 Bookmark Manager 中也必须发生对应变化。

修改：

```text
Dark Theme
Tile Size
Icon Size
Wallpaper
```

关闭浏览器重新打开：

设置完整恢复。

开启：

```text
History
Top Sites
Downloads
```

只在用户开启对应功能时申请对应权限。

断网：

书签、设置、自定义图标、壁纸和已有 favicon 仍然正常展示。

打开 New Tab：

不得向第三方服务器发送书签、历史、下载或其他浏览数据。

达到以上标准，即视为本项目已经实现预期的 NelliTab 类核心体验，同时保持技术和代码实现独立。
