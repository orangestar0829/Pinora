# 提交 Edge / Firefox

在仓库根目录运行 `npm.cmd run package:submission`，安装包、Firefox 源码包和可复制的文案会输出到 `artifacts/submission/Pinora-0.0.2/`。再运行 `node scripts/capture-store-assets.mjs` 生成商店图标和三张 1280×800 截图。

| 后台字段 | 使用材料 |
| --- | --- |
| Edge 安装包 | `edge/Pinora-0.0.2.zip` |
| Firefox 安装包 | `firefox/Pinora-0.0.2-firefox.xpi`，上传后由 Mozilla 签名 |
| Firefox 源码 | `firefox/Pinora-0.0.2-source.zip`，源码问题选 Yes |
| 简体中文名称、简介、详细介绍 | `copy/listing-zh-CN.md` |
| 英文介绍与版本说明 | `copy/listing-en-US.md`，明确 UI 为简体中文 |
| 权限说明与数据表单 | `copy/permissions.md` |
| 审核备注 | `copy/reviewer-notes.md`，全文可粘贴，AMO 上限 3000 字符 |
| Firefox 自身许可证 | `copy/firefox-license.txt`，当前按保留全部权利准备 |
| 商店图标 | `assets/icon-300.png`，另有 128 像素版 |
| 商店截图 | `assets/01-light.png`、`02-dark.png`、`03-settings.png` |

后台选择许可证时，使用保留全部权利的选项；如需自定义许可，粘贴 `firefox-license.txt`。公开 GitHub 仓库本身不会授予开源使用许可。

## 公开链接

- 主页：https://github.com/orangestar0829/Pinora
- 隐私：https://github.com/orangestar0829/Pinora/blob/master/public/privacy.md
- 反馈：https://github.com/orangestar0829/Pinora/issues

隐私说明直接使用 GitHub 的公开文档页面，无需额外部署网站。

## 提交顺序

1. Edge：[注册开发者](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account)，进入 [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview)，新建扩展并上传 ZIP。选择公开或隐藏分发，填写介绍、图标、隐私链接与权限用途，附审核备注后提交。
2. Firefox：进入 [AMO 提交页](https://addons.mozilla.org/developers/addon/submit/)，选 On this site（公开上架）或 On your own（只签名自行分发），上传 XPI 和源码 ZIP，处理自动验证结果后提交。完成后下载签名包；不要把未签名包当作正式可长期安装的版本分发。

Firefox 的兼容平台仅选择桌面版。当前 0.0.2 在 AMO 自动验证中为 0 个错误、3 个警告：1 条涉及 Android 数据声明的最低版本，另 2 条涉及 React DOM 内部的 innerHTML。桌面最低版本保持 140，不声明 Android 支持；各警告来源已写入 `copy/reviewer-notes.md` 的 Automated validation warnings 部分，可一同粘贴到审核备注。此结果允许继续提交，最终签名和审核结果以 AMO 后台为准。

开发者账号、商店条款和最终提交由账号本人完成。支持入口使用 GitHub Issues，无需公开个人邮箱。

## 材料生成与复现

生成前先运行 `npm.cmd run check`。所有安装包来自同一份 `dist`，源码包排除 `.git`、`node_modules`、浏览器档案、个人数据和生成材料。源码包的 `BUILDING.md` 记录实际 Node.js、npm、Windows 和 PowerShell 版本。

截图在独立、未登录的浏览器测试配置文件中使用合成书签拍摄，演示图标通过实际的自定义图标功能上传，不修改用户的浏览器配置。Firefox 没有 Chromium 本地 favicon API，因此默认使用替代图标；共同截图展示的是相同的界面功能。

更新版本时修改 package.json 和 public/manifest.json 中的版本号，同步更新本目录中的版本说明、文件名和审核备注，在原商店条目下上传更高版本，保留现有 Firefox 扩展 ID。

## 官方依据

- [Edge 提交流程与素材要求](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)
- [Mozilla 提交流程](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)
- [Mozilla 源码复现要求](https://extensionworkshop.com/documentation/publish/source-code-submission/)
- [Firefox 数据声明](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)
