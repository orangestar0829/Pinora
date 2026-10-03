# 审计问题修复记录

日期：2026-10-03。基于当前工作区审计，保留修复前已有的未提交修改。

按照中危优先、低危随后逐项处理；每项针对性验证通过后进入下一项。

| 问题 | 严重性 | 状态 | 验证 |
| --- | --- | --- | --- |
| A-01 壁纸旧上传覆盖新选择 | 中 | 已修复、专项验证通过 | media 6 项单测；Chromium 壁纸竞态 E2E；类型检查、构建、修改文件 lint |
| A-02 图标保存中取消仍提交 | 中 | 已修复、专项验证通过 | Chromium 保存/关闭/失败恢复 E2E，生产构建 |
| A-03 设置错误重试及恢复 | 中 | 已修复、专项验证通过 | settings 5 项单测、Chromium 恢复 E2E、构建 |
| A-04 Vitest 安全公告 | 中 | 已修复、专项验证通过 | Vitest/mocker 4.1.11；完整依赖 audit 0；36 单测、typecheck、build |
| R-01 旧图片持续占用存储 | 中 | 已修复、专项验证通过 | 24 小时宽限、引用保护、真实 IDB 回收及待提交锁回归通过 |
| V-01 设置初始读取覆盖新事件 | 中（待验证风险） | 防护已修复、专项验证通过 | 设置/运行时 13 项单测；真实扩展延迟读取回归；自然触发频率仍未知 |
| A-05 主机端口 URL 边界 | 低 | 已修复、专项验证通过 | URL 8 项单测含 IPv6、非法端口、危险协议 |
| A-06 图标清理错误不通知 | 低 | 已修复、专项验证通过 | runtime 4 项单测；Chromium 延迟失败显示及重试 E2E |

## A-01：壁纸旧上传覆盖新选择

根因：图片处理、IndexedDB 写入和设置队列之间存在异步间隔，提交时没有检查上传是否仍有效。

修改 `SettingsPanel.tsx` 与 `storage/media.ts`：操作序号在重置、类型切换、关闭及卸载时失效；提交在最新设置草稿内再次检查操作和背景 type/assetId；取消时不写设置，回收新孤儿图片，真实存储错误继续抛出。

新增 `storage/media.test.ts` 和 `tests/e2e/media-races.spec.ts`。基线复现重置后被旧上传覆盖；修复后 6 项单测、Chromium 1 项 E2E（含五个场景）、typecheck、build、修改文件 ESLint 通过。原有上传及数据格式保持兼容。

边界：同一面板的操作由序号保护；跨标签页在提交时比较背景 type/assetId，不是完整的跨页面操作历史。其他标签先修改、再恢复完全相同字段值的 ABA 顺序不在保证范围。

## A-02：图标保存中取消仍提交

根因：异步保存过程中取消和各关闭路径保持可用，关闭不会中止保存。`CustomIconDialog.tsx` 增加同步保存标记，保存期间禁用取消和选图，关闭回调统一检查保存标记；成功关闭，失败解除忙碌状态并保留原图标。

构建及 `playwright test tests/e2e/media-races.spec.ts -g 'icon save'` 通过。真实扩展验证 Escape、遮罩、关闭按钮均不能在提交中关闭；注入 quota 错误后错误显示、取消恢复且原映射保留。保存期间短暂禁止关闭是有意的交互变化，与书签编辑一致。

## A-03：设置错误重试及恢复

根因：ready 后重试只刷新书签，未知版本又无法经常规 update 迁移，成功外部修复也未清除 error。

修改 `storage/settings.ts`、`app/App.tsx`，增加独立 refresh、成功加载清错、显式确认的备份后恢复默认。恢复与普通设置更新共用跨标签页锁和队列，备份失败绝不覆盖原配置。

settings 5 项单测及 `playwright test tests/e2e/settings-recovery.spec.ts`、生产构建通过。验证了重试真正读取设置、未知字段保留、外部修复清错、取消恢复、备份失败阻止重置和成功恢复。新增测试首次出现 TypeScript 浏览器 API 泛型类型错误，修正测试类型后通过。未改变 v1 schema；恢复为用户明确确认的全设置重置，原始配置保存于 pinora.settings.recovery。

## A-04：Vitest 安全公告

官方 registry 的 audit 再次确认 GHSA-82fw-gwwq-j7x9 命中 vitest/mocker 3.2.7，修复范围为 >=4.1.11。`npm view vitest@4.1.11 ...` 确认支持现有 Node 24、Vite 6，遂将 package.json 精确固定 4.1.11 并更新 lock，未升级生产依赖或 Vite。

执行 `npm install --save-dev --save-exact vitest@4.1.11 --ignore-scripts --registry=https://registry.npmjs.org`。升级后完整 npm audit 为 0，npm ls 确认 vitest/mocker 均为 4.1.11 且复用 Vite 6.4.3；36 项单测、typecheck 和 build 通过。开发工具主版本变化已在现有测试中验证；最低 Node/浏览器环境没有因此额外验证。

## R-01：图片生命周期

根因：替换或重置仅改变引用，成功写入的旧 Blob 从不回收。

修改 `storage/assets.ts`、`media.ts`、`settings.ts`，新增 `maintenance.ts`，在 runtime 接入启动、引用变化和每小时检查。回收只加载资源键及标记，避免将全部图片读进内存；首次发现无引用时登记时间，24 小时后才回收。图片提交全程与回收共用 Web Lock，回收在设置锁内读取最新配置与恢复副本。维护错误向界面通知并可重试，不影响正常书签启动。保留现有 IndexedDB 版本及 Blob 数据格式，新增一条保留名称的元数据记录。

单测覆盖宽限边界、恢复引用、时钟回拨与重新引用。真实 IndexedDB E2E 验证替换壁纸、删除过期孤儿、保留当前/恢复/近期资源，以及等待媒体锁后读取最新引用。首次 E2E 暴露旧迁移检测依赖 JSON 键顺序，会覆盖恢复副本；已改为规范化键排序比较并增加回归，重跑通过。

独立复核进一步补充：回收同时保留原始当前配置中的未知字段引用，防止迁移备份尚未完成时丢失图片。设置单测和真实 IDB 测试加入这一路径。

兼容性与边界：没有 Web Locks 时跳过删除；支持的 Chromium 环境已验证。24 小时按标记时间计算，长期开着的页面每小时检查；快速大量上传仍可能在宽限期内耗尽浏览器配额，错误正常显示。恢复副本仍引用的旧图不会删除，这是保留恢复能力的有意行为。恢复键只保存最近一次备份，并非备份历史。

## V-01：过期设置读取

受控适配器中已复现旧读取覆盖新事件；真实自然调度的触发频率未确认。防御性修改 `SettingsService.refresh/start/stop/apply`，用读取 generation 和设置 revision 检查读取及迁移备份后的状态；失效读取的成功/失败都不能覆盖较新事件，当前读取错误仍传播。

新增单测覆盖旧成功、旧失败、新无效版本事件、迁移备份期间事件、并发刷新及当前错误。设置/运行时 13 项测试通过；真实扩展以延迟初始 API 返回、实际 storage.onChanged 更新的方式回归通过。没有修改持久化 schema。

独立复核后，将 refresh 的恢复备份纳入同一设置队列/Web Lock，锁内重读并核对原始快照；新增回归确认延迟旧备份不能覆盖较新显式恢复的备份，以及没有事件通知时仍重新核对存储值。浏览器自然发生写入乱序的频率未验证，测试采用可控延迟。

## A-05：URL 主机端口边界

`domain/url.ts` 的主机端口判别补充 ?/# 边界。8 项 URL 测试通过，包含主机/localhost/IPv6、显式凭据 URL，以及危险协议和非法端口拒绝。协议白名单保持有效。

## A-06：图标清理错误通知

原 catch 直接写 error 字段，绕过订阅者。`domain/runtime.ts` 改用设置服务的维护错误通知，按 icons/assets 分别保留和清除，普通设置保存不会隐藏清理错误；过期清理结果不覆盖最新结果。

runtime 4 项单测通过，验证延迟失败通知、无关保存不清错、成功重试清错；真实扩展 E2E 在页面渲染完成后注入延迟 quota 失败，横幅立即显示，重试后映射清理成功且错误消失。

复核发现原 generation 只限制结果通知，排队的旧清理仍可能删除后来恢复有效的映射；现增加 mutator 内的快照有效性检查，取消旧清理，不吞掉真实错误。新增队列回归通过。补强后的 settings/runtime/assets 专项共 21 项通过。

## 整体验证

以上数字为各阶段的专项记录；最终合并状态的结果如下。没有遗漏或因阻塞而搁置的原审计项；V-01 的防护通过故障注入验证，不据此声称确认了浏览器自然发生率。

| 实际执行 | 位置 / 环境 | 最终结果 |
| --- | --- | --- |
| `npm run check` | 当前工作区；Node 24.18.1、npm 12.0.2 | TypeScript、全仓 ESLint、10 文件共 55 项单测、Vite 6.4.3 生产构建均通过 |
| `npm audit --json --ignore-scripts --registry=https://registry.npmjs.org` | 当前完整依赖树 | 0 漏洞（包含开发依赖） |
| `node node_modules/@playwright/test/cli.js test '--reporter=list,json'` | 当前代码副本；`PINORA_TEST_CHANNEL=chromium` | Chromium 153.0.8010.12，9/9 通过，25.7 秒；0 跳过、0 重试波动 |
| 同上，`PINORA_TEST_CHANNEL=msedge` | 相同副本 | Edge 154.0.4258.48，9/9 通过，41.5 秒；0 跳过、0 重试波动 |
| `git diff --check` | 当前工作区 | 通过 |
| `Compress-Archive`，随后 Python `zipfile` 比较每个条目 SHA-256 | 当前 dist 与新修复包 | ZIP 内文件逐一匹配构建结果 |

完整 E2E 同时覆盖原生 CRUD、同目录双向拖拽、跨目录移动、跨标签设置同步、图片重启持久化、离线加载、删除竞态、长标题布局，以及新增的图片/设置异常顺序。两种浏览器的验收记录均为 pageErrors=[]、externalRequests=[]；仅表示这些执行路径的观测结果。

E2E 在 `C:\Users\potter\AppData\Local\Temp\pinora-remediation-1DxKrR` 运行，使用当前源码、当前 node_modules 和刚构建的 dist。61 个源码、测试、public、依赖及配置文件的 SHA-256 核对无差异。原测试会输出验收 JSON 与截图，因此在副本执行并将新证据保存到独立目录；工作区原有 9 个纳入版本控制的 artifacts 文件与审计开始时完全一致。未覆盖用户原有改动、未提交或发布。

执行失败也保留记录：直接使用 `npm run test:e2e -- --reporter=list,json` 时，本机 npm 报 `EUNKNOWNCONFIG` / `Unknown cli flag --reporter`，该次没有运行测试。随后直接调用本地 Playwright CLI，两个浏览器均完整通过。npm 提示全局 `.npmrc` 的已有 install-scripts 条目无法解析；未更改全局配置。升级与安全扫描使用官方 registry，避免原镜像 audit 端点不支持导致的失败。

证据：[`verification.json`](../artifacts/audit-remediation-2026-10-03/verification.json)、[Chromium 测试报告](../artifacts/audit-remediation-2026-10-03/audit-chromium.json)、[Edge 测试报告](../artifacts/audit-remediation-2026-10-03/audit-msedge.json)、[打包校验](../artifacts/audit-remediation-2026-10-03/package.json)。新包为 `artifacts/Pinora-0.1.0-audit-fixed.zip`；原 alpha 包和 release.json 保留为历史交付，不能视为已包含本次修复。

## 修改汇总与剩余边界

- UI：SettingsPanel 取消旧上传；CustomIconDialog 提交中防关闭；App 设置重试、显式恢复和维护错误展示。
- 存储：SettingsService 并发读取、排队备份、受保护的图标清理；media 提交有效性与资产锁；assets/maintenance 引用保护和延迟回收。保留设置 v1 和 IndexedDB v1。
- 领域及依赖：runtime 维护生命周期与通知、URL 端口边界；Vitest/mocker 4.1.11、对应 lock；未变更生产依赖、权限或 CSP。
- 回归与文档：补充 settings/runtime/url 单测，新增 media/assets 单测及 3 个 E2E 文件；更新 README、架构与接口契约。

未进行最低 Chrome 114、其他 Node 版本、Firefox、真实用户大书签库或长期运行验收。24 小时回收采用时间戳注入验证边界，没有声称运行了整整 24 小时；高频大图仍可能在宽限期内达到配额。没有 Web Locks 时保守跳过回收；恢复副本的引用会继续保留图片。A-01 的跨标签 ABA 边界见上文。建议后续优先补足最低支持版本与长时间多标签压力验证，再扩大 Alpha 使用范围。

本次列出的可修复问题均已实现并通过上述验证，当前版本适合继续受控 Alpha 使用；这些结果不等同于生产环境全面安全认证或所有调度顺序的形式化证明。
