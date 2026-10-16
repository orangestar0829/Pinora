# Pinora 0.0.2

以浏览器原生书签为中心的本地新标签页扩展，适用于 Chrome 和 Edge。无需账户，无广告、无遥测。

![Pinora 浅色界面](artifacts/pinora-light.png)

## 使用

- **书签首页**：在「外观与设置 → 外观 → 书签文件夹」选择首页目录。支持子文件夹导航、返回上级和目录范围内搜索。
- **紧凑布局**：“书签”标题、搜索框与设置按钮同排，卡片紧接下方；不显示数量与整理工具栏。
- **书签管理**：右键菜单可编辑、删除、移动书签和设置图标，也可重命名或删除已有文件夹；支持同目录拖拽排序和拖入文件夹。修改直接作用于浏览器书签。
- **新增书签**：使用浏览器原生收藏入口或书签管理器；空文件夹仍提供“添加第一个书签”。
- **历史记录与热门网站**：在「外观与设置 → 布局 → 主页内容」分别设置显隐、展示 1–4 行，并获取相应权限。历史记录显示为“最近访问”；热门网站来自浏览器的常访网站列表。两个区域显示在首页书签下方，搜索或进入子文件夹时隐藏。
- **外观自定义**：浅色、深色、跟随系统；调整卡片、图标、间距、圆角、文字及内容宽度；使用纯色、渐变或本地壁纸，并设置适配方式、模糊、亮度和遮罩。

Ctrl / Cmd + F 搜索；方向键移动卡片焦点；Enter 打开；F2 编辑；Delete 打开删除确认；Esc 关闭弹窗或返回上层。中键或 Ctrl / Cmd 点击在后台打开，Shift 点击在新标签页打开。

## 安装到 Chrome / Edge

1. 从 GitHub 仓库的 Releases 页面下载最新的 `Pinora-<版本>.zip`，解压到一个固定目录。
2. 打开 `chrome://extensions` 或 `edge://extensions`，开启“开发者模式”。
3. 选择“加载已解压的扩展”，选中解压后的目录。
4. 新建标签页，在设置中选择要展示的书签文件夹。

升级时下载新版本覆盖解压目录，在扩展管理页点击“重新加载”，再刷新已打开的新标签页。

## 数据与权限

基础权限为 `bookmarks`、`storage` 和 `favicon`，分别用于原生书签、本地设置和浏览器本地网站图标。可选权限 `history`、`topSites` 仅在设置中点击授权后获取，分别用于最近访问和热门网站；未授权不读取，撤销权限后清空对应显示。

Pinora 不上传书签、历史记录或常访网站列表。设置、自定义图标和壁纸仅保存在本机；历史记录和热门网站只读取到页面内存，不另行持久化。浏览器自身启用的书签同步仍由浏览器管理。设置变更会同步到同一浏览器配置文件中已打开的新标签页。

删除书签会影响浏览器原生数据，删除非空文件夹需要确认。完整说明见[隐私说明](public/privacy.md)。

## 开发与验证

需要 Node.js 22+。在项目目录执行：

```powershell
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
```

`npm run check` 执行类型检查、Lint、单元测试和生产构建，输出到 `dist`。E2E 使用已构建的 `dist` 和独立测试配置文件；修改源码后先构建。验证结果和限制见[验证记录](docs/validation.md)。

### 本地调试

本地开发无需打包：在扩展管理页开启“开发者模式”，通过“加载已解压的扩展”选择项目的 `dist` 目录。修改源码后执行 `npm run build`，再在扩展管理页点击“重新加载”并刷新新标签页。

```powershell
npm run dev
```

打开[开发预览](http://127.0.0.1:5173/?preview=1)。预览使用明确标识的合成书签，刷新后重置，不代表浏览器原生 API 验收。

### 发布

```powershell
npm run package:extension
```

打包命令需要 PowerShell，会先构建，再生成 `artifacts/Pinora-<版本>.zip`（不纳入版本控制）。发布时将该压缩包上传到 GitHub Release，供用户下载安装。

## 项目资料

- [架构](docs/architecture.md)、[界面与接口契约](docs/ui-contract.md)
- [验证记录](docs/validation.md)、[验收结果](artifacts/acceptance.json)
- [浅色截图](artifacts/pinora-light.png)、[深色截图](artifacts/pinora-dark.png)、[设置截图](artifacts/pinora-settings.png)
- [隐私说明](public/privacy.md)、[第三方许可](public/THIRD_PARTY_NOTICES.md)

截图中的书签为隔离测试配置文件里的合成样例。当前版本面向 Chromium 浏览器，尚不支持 Firefox。
