# SmartFav 数据一致性与稳定性加固 — 任务计划

> 依据 `doc.md` 拆分。回溯基线采用**方案 A（git init）**：粒度精确到行，且随时可用 `rm -rf .git` 撤销，比整目录备份更可控。
> 修复范围：P0（2 条）+ P1（4 条）+ P2（4 条）+ P3（最小范围）。
> 原则：每个任务结束后代码都处于可运行状态；改动大的任务（Task 5）前后各跑一次验证。

- [x] Task 1: 建立回溯基线
    - 1.1: 在项目根执行 `git init`
    - 1.2: 创建 `.gitignore`，排除 `.DS_Store`、`dist/`、`audit/` 下的大体积图片
    - 1.3: 提交基线快照 `chore: baseline v1.14.2 before consistency hardening`
    - 1.4: 记录基线 commit hash，写入后续的修复过程文档

- [x] Task 2: 抽取 constants.js 消除常量与逻辑双写
    - 2.1: 新增 `smartFav智能收藏夹/constants.js`，沿用 IIFE + globalScope + module.exports 双导出模式
    - 2.2: 导出 `TRASH_RETENTION_MS`、`BROWSER_ACTIVITY_TTL_MS`、`INTERNAL_REMOVE_TTL_MS`
    - 2.3: 导出工具函数 `getTrashExpireAt(item, now)`，统一过期时间计算
    - 2.4: `background.js` 的 `importScripts` 首位加入 constants.js，删除本地重复常量声明
    - 2.5: `popup.html` 在 i18n.js 之前引入 constants.js，`popup.js` 删除重复常量声明
    - 2.6: `popup.js:1486`、`1508-1509` 与 `background.js:302-312` 的过期时间表达式改为调用 `getTrashExpireAt`
    - 2.7: `node --check` 全部改动文件，跑 `node tests/verify-extension.js`

- [x] Task 3: storage 写入统一为带检查版本
    - 3.1: `background.js` 的 `setStoredFavorites`、`setStoredState` 改为检查 `chrome.runtime.lastError` 并在失败时 reject
    - 3.2: 逐一排查这两个函数的全部调用点，确认都处在已有 `.catch` 的链路中，缺失的补上
    - 3.3: `background.js:1060` 的 `getFavorites` 降级分支补 lastError 检查，失败回传空数组而非 undefined
    - 3.4: 跑验证脚本，确认既有的"写入失败即中止"用例仍通过

- [x] Task 4: 内部操作标记持久化到 storage.session
    - 4.1: 新增 `readInternalMarks` / `writeInternalMarks`，以 `chrome.storage.session` 为权威来源、内存 Map 为一级缓存
    - 4.2: `markInternalBookmarkRemoval` / `consumeInternalBookmarkRemoval` 及 move 对应的两个函数改为读写该层
    - 4.3: `chrome.storage.session` 不可用时静默回退为纯内存态，不抛错
    - 4.4: 在 `bookmarkEventQueue` / `bookmarkLayoutQueue` 声明处加注释，说明跨 worker 重启不持久化的已知限制
    - 4.5: 跑验证脚本中的书签事件回流用例

- [x] Task 5: 收藏保存路径收敿到 background（核心改动）
    - 5.1: `background.js` 新增 `saveFavoriteEntry(favorite, settingsPatch)`，全程置于 `withBookmarkLayoutLock` 内
    - 5.2: 该函数内用 `setStoredStateChecked` 写 favorites 与 settings，用 `getTrackedBookmarksApi()` 写浏览器书签
    - 5.3: 重写 `saveFavorite` 消息分支，改为调用 `saveFavoriteEntry` 并回传 `{ status, bookmark }`
    - 5.4: `popup.js:1113-1167` 的 `confirmBtn` 处理器：保留分类与域名学习提案的本地计算，把写 storage + 写书签替换为一次 `sendRuntimeMessage('saveFavorite', …)`
    - 5.5: 按返回的 `bookmark.status` 映射既有提示文案（`savedToSmartFav` / `savedToBrowser` / `savedBrowserFailed`）
    - 5.6: 保留 `isExtension === false` 的本地写入分支，供网页调试模式使用
    - 5.7: 跑验证脚本，重点确认收藏保存与浏览器写回相关用例

- [x] Task 6: AI 请求增加超时与中断
    - 6.1: `ai-client.js` 新增 `REQUEST_TIMEOUT_MS = 30000`
    - 6.2: `call()` 中引入 `AbortController`，超时 abort，`finally` 中 `clearTimeout`
    - 6.3: 捕获 `AbortError` 并转换为中英双语超时错误信息
    - 6.4: `i18n.js` 补充超时文案键
    - 6.5: 确认超时错误落入既有失败分支：批量建议整批失败时界面不变，收藏分类回退本地规则
    - 6.6: 跑验证脚本中的 AI 协议用例（该用例已 stub fetch，需确认 stub 与 signal 参数兼容）

- [x] Task 7: 背景图配额治理
    - 7.1: `readBackgroundImage` 上限从 3MB 降到 800KB，并在 `readAsDataURL` 完成后校验 base64 实际长度
    - 7.2: 背景图从 `settings` 拆出为独立 storage key `customBackgroundImage`
    - 7.3: 更新读取、预览、清除、应用外观四处的引用
    - 7.4: 加入对旧数据的一次性迁移：`settings.customBackgroundImage` 存在时搬到新 key
    - 7.5: `i18n.js` 更新背景图体积超限文案中的数值
    - 7.6: 跑验证脚本

- [x] Task 8: CSP 声明与死代码清理
    - 8.1: `manifest.json` 增加 `content_security_policy.extension_pages`
    - 8.2: 再次确认 `styles/options.css` 无任何引用后删除
    - 8.3: 保留 `options.js` 与 `options.html`（扩展选项入口落地页，删除会导致入口失效）
    - 8.4: 跑验证脚本中的 manifest 契约用例

- [x] Task 9: 补充行为测试
    - 9.1: 新增用例：并发发起两个 `saveFavorite`，断言两条收藏都存在、无覆盖，验证锁真实生效
    - 9.2: 新增用例：mock 置位 `chrome.runtime.lastError` 时 `setStoredFavorites` 确实 reject，且消息回传 `status: 'error'`
    - 9.3: 将两个新用例接入 `verify-extension.js` 的执行序列
    - 9.4: 确认 mock 的 `chrome.storage.session` 支持已就位

- [ ] Task 10: 全量验证
    - 10.1: 对全部 10 个 js 文件执行 `node --check`（含 README 未列出的 ai-client.js、bookmark-backup.js、i18n.js、constants.js）
    - 10.2: 跑 `node tests/verify-extension.js`，要求全绿
    - 10.3: 更新 README「开发与验证」章节的检查命令清单，补齐漏检文件
    - 10.4: 记录验证输出，供修复过程文档引用

- [ ] Task 11: 产出修复过程与回溯文档
    - 11.1: 汇总每条问题的修复位置、改动前后行为差异
    - 11.2: 列出全部新增、修改、删除的文件清单
    - 11.3: 写明三级回溯方式：单文件回退、整次修复回退、回到基线 commit
    - 11.4: 附浏览器端手工回归清单，覆盖收藏保存、双向同步、排序写回、备份还原、回收站过期五条高风险链路
    - 11.5: 写入 `.comate/specs/storage-consistency-hardening/summary.md`
