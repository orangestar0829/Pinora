# Pinora · 0.1 Alpha

以浏览器原生书签为中心的新标签页扩展。独立设计与实现，默认无账户、无遥测、无外部服务。

本次按规格第 47、51 节交付**第一阶段 Alpha**，不将后续 Beta / 1.0 功能混入当前版本。Pinora 是开发名称，发布前仍需名称与商标检查。

![Pinora 浅色界面](artifacts/pinora-light.png)

## 安装到 Chrome / Edge

1. 打开浏览器的扩展管理页面：Chrome 的 `chrome://extensions` 或 Edge 的 `edge://extensions`。
2. 开启“开发者模式”，选择“加载已解压的扩展”。
3. 选择本项目的 **`dist`** 文件夹（当前工作区为 `I:\code\Pinora\dist`）。
4. 新建标签页。扩展立即读取该浏览器配置文件中的真实书签。

本地交付压缩包为 `artifacts/Pinora-0.1.0-alpha.zip`，也可以解压后加载。尚未发布到商店。扩展会直接修改原生书签；删除非空文件夹会明确确认。测试只使用独立临时浏览器配置文件，没有改动日常浏览器数据。

## 已实现

- MV3 新标签页覆盖；仅 `bookmarks`、`storage`、`favicon` 三项基础权限。
- 动态系统目录、任意层级文件夹导航、面包屑、基于内存索引的全局搜索。
- 原生书签／文件夹增删改、移动菜单、同目录双向拖拽排序、拖入文件夹和侧栏目录。
- 根目录及系统目录保护、托管只读节点保护、循环移动检查、URL 安全校验。
- 本地 favicon、原创首字母后备图标、自定义图标裁剪／重置与安全 SVG 栅格化。
- 浅色／深色／跟随系统；卡片、图标、间距、圆角、文字和内容宽度设置。
- 纯色、渐变、本地壁纸；适配方式、模糊、亮度、遮罩；IndexedDB 保存处理后的图片。
- 书签事件实时同步、设置跨标签页同步、版本迁移与原配置恢复副本。
- 基础键盘操作、焦点提示和减少动画支持；每页 200 项，所有结果均可翻页访问。

中键／Ctrl／Cmd 点击在后台打开，Shift 点击在新标签页打开。Ctrl／Cmd+F 搜索；方向键移动卡片焦点；Enter 打开；F2 编辑；Delete 打开删除确认；Esc 关闭弹窗或返回上层。右键或卡片右上角菜单可设置图标。

## 开发与验证

Node.js 22+，本机已使用 Node.js 24 验证。依赖锁定在 `package-lock.json`。

```powershell
cd I:\code\Pinora
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
npm run package:extension
```

`npm run check` 依次执行 typecheck、lint、22 项单测和生产构建，任一步失败即停止。E2E 加载已构建的 `dist`，修改源码后请先构建。Chrome for Testing 与本机 Edge 均通过完整 E2E。测试的本地配置文件位于忽略目录 `.test-profiles`。

```powershell
npm run dev
```

开发预览入口：[http://127.0.0.1:5173/?preview=1](http://127.0.0.1:5173/?preview=1)。预览有明显的合成数据标识；其书签会在刷新时重置，不代表扩展原生 API 验收。

## 设计与证据

- [架构设计](docs/architecture.md)、[服务接口契约](docs/ui-contract.md)、[原始规格](docs/specification-v1.md)
- [验收说明与边界](docs/validation.md)、[运行结果](artifacts/acceptance.json)
- [浅色截图](artifacts/pinora-light.png)、[深色截图](artifacts/pinora-dark.png)、[设置截图](artifacts/pinora-settings.png)
- [隐私说明](public/privacy.md)、[第三方许可](public/THIRD_PARTY_NOTICES.md)

截图来自真实扩展，书签是测试配置文件中的合成样例。全新测试配置文件没有已访问网站的 favicon 缓存，因此截图中部分网站显示浏览器默认图标。

## 后续阶段

0.5 Beta：Top Sites、历史记录与分组、下载记录、按需可选权限、多选、设置备份、自定义主题和玻璃效果。

1.0：Firefox 适配、更完整的无障碍与键盘流程、增量事件索引、大库启动性能及商店发布验收。当前 Chromium 原生书签事件会刷新树快照和搜索索引；输入搜索词不会重新读取或遍历原始书签树。旧图片 Blob 保守保留，后续将加入确认引用后的垃圾回收。
