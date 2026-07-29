# SmartFav 数据一致性与稳定性加固 — 修复过程与回溯手册

修复对象：SmartFav 智能收藏夹 v1.14.2
问题清单来源：`.comate/specs/storage-consistency-hardening/doc.md`
任务计划：`.comate/specs/storage-consistency-hardening/tasks.md`

---

## 一、总体结果

| 项 | 结果 |
| --- | --- |
| 修复条目 | P0 × 2、P1 × 4、P2 × 4、P3 × 1，共 11 条全部完成 |
| 提交数 | 10 个（含 1 个基线快照） |
| 源码净变化 | 新增 1 文件、修改 6 文件、删除 1 文件 |
| 语法检查 | 11 个 js 文件 `node --check` 全部通过 |
| 自动化验证 | `node tests/verify-extension.js` 通过 |
| ZIP 完整性 | `unzip -t dist/SmartFav-Edge-1.14.2.zip` 无错误 |
| 新增行为用例 | 3 组，且均已验证"改回旧实现即失败" |

---

## 二、提交序列（回溯锚点）

从旧到新，每个提交只做一件事，可单独回退：

| # | Commit | 内容 | 对应问题 |
| --- | --- | --- | --- |
| 0 | `f1bfa2b` | **基线快照**（修复前的完整状态） | — |
| 1 | `bc8c017` | 抽取 `constants.js`，统一常量与回收站过期计算；修复因玻璃主题改版而失效的 CSS 断言 | P2-9 |
| 2 | `23376f5` | storage 写入统一检查 `lastError` | P0-2、P2-7 |
| 3 | `1191962` | 内部书签操作标记持久化到 `storage.session` | P1-4 |
| 4 | `c64a700` | 收藏保存收敿到 background 单入口并置于布局锁内 | P0-1、P1-3 |
| 5 | `b7ea30d` | AI 请求增加 30s 超时与中断控制 | P1-5 |
| 6 | `cbce304` | 背景图上限降到 800KB 并校验 base64 实际体积 | P1-6 |
| 7 | `aac1559` | 声明 `extension_pages` CSP；删除无引用的 `options.css` | P2-8、P2-10 |
| 8 | `533849d` | 补充布局锁并发、storage 写入失败、session 标记持久化用例 | P3-11 |
| 9 | `743a8cc` | README 验证命令补齐漏检文件 | — |

---

## 三、逐条修复详情

### P0-1　favorites 两条并行读-改-写路径 → 单入口 + 锁内串行

**改动前**：`popup.js` 的"确认收藏"自己 `storageGet(['favorites'])` → 过滤 → `storageSet`；`background.js` 的 `saveFavorite` 消息处理器也做同一件事。两者都不经过 `withBookmarkLayoutLock`，与浏览器书签事件回流并发时后写覆盖先写。

**改动后**：
- `background.js` 新增 `saveFavoriteEntry(favorite, settingsPatch)`，整段逻辑包在 `withBookmarkLayoutLock` 内，用 `setStoredStateChecked` 一次性提交 `favorites` 与 `settings`
- `saveFavorite` 消息分支改为调用它，回传 `{ status, bookmark, settings }`
- `popup.js` 的 `confirmBtn` 处理器只保留分类与域名学习提案的本地计算，写入改为一次 `sendRuntimeMessage('saveFavorite', { favorite, settingsPatch })`
- 非扩展调试模式（`isExtension === false`）保留原本地写入分支

**验证**：新增用例并发发起两个 `saveFavorite`，断言两条收藏都在。把 `withBookmarkLayoutLock` 临时去掉后该用例失败（`favorites.length` 实际 1、期望 2）——这正是原先会丢数据的现象。

### P0-2　storage 写入不检查 lastError → 统一带检查

**改动前**：`setStoredFavorites`、`setStoredState` 直接把 `resolve` 当回调；同文件的 `setStoredStateChecked` 已有正确写法但只被还原点相关逻辑使用。

**改动后**：前两个函数改为复用 `setStoredStateChecked`，失败时 reject。已逐一确认全部调用点都在有 `.catch` 的链路中（消息处理器、`enqueueBookmarkEvent`、alarm 与 `onStartup` 均已捕获）。

**验证**：新增用例在 mock 中置位 `lastError`，断言 `saveFavorite` 与 `deleteFavorite` 都回传 `status: 'error'` 且数据未被改动。改回不检查的写法后该用例失败（实际 `'ok'`、期望 `'error'`）。

### P1-3　popup 绕过内部操作标记 → 统一走受管 API

书签写入随 P0-1 一并迁入 background，改用 `getTrackedBookmarksApi()`（带 remove/move 打标的 Proxy）。popup 不再直接接触 `chrome.bookmarks`。

书签写回失败**不回滚** storage：收藏本身是用户主要意图，失败只降级为 `savedBrowserFailed` 提示，与修复前行为一致。

### P1-4　内部标记纯内存 → storage.session 权威 + 内存缓存

新增 `getSessionArea` / `readSessionMarks` / `writeSessionMarks`；`consumeInternalBookmarkRemoval`、`consumeInternalBookmarkMove` 改为 async 并在判断前先合并会话态；两处调用点相应改为 `await`。`chrome.storage.session` 不可用时静默退化为纯内存态。

`bookmarkEventQueue` / `bookmarkLayoutQueue` **未做持久化**（见第六节遗留项），已在声明处加注释说明限制。

### P1-5　AI 请求无超时 → 30s AbortController

`ai-client.js` 新增 `REQUEST_TIMEOUT_MS = 30000` 与 `fetchWithTimeout`，`AbortError` 转换为中英双语超时提示，`finally` 中清理定时器。不做自动重试。

### P1-6　背景图挤占配额 → 800KB 上限 + base64 二次校验

`MAX_BACKGROUND_IMAGE_BYTES = 800 * 1024`；除原有的 `file.size` 校验外，在 `readAsDataURL` 完成后再按 data URL 实际长度校验一次。中英文提示文案同步更新为 800 KB。

### P2-7　getFavorites 降级分支

补 `lastError` 检查，失败或结果异常时回传空数组，不再把 `undefined` 交给 popup。

### P2-8　CSP

`manifest.json` 增加 `"content_security_policy": { "extension_pages": "script-src 'self'; object-src 'self'" }`，并在测试中加断言固化。

### P2-9　常量与逻辑双写

新增 `constants.js`（IIFE + `globalScope` + `module.exports` 双导出），导出 `TRASH_RETENTION_MS`、`BROWSER_ACTIVITY_TTL_MS`、`INTERNAL_REMOVE_TTL_MS` 与 `getTrashExpireAt(item, now)`。popup 与 background 的重复常量声明、三处重复的过期时间表达式全部改为引用该模块。

### P2-10　死代码

删除 `styles/options.css`（414 行，已确认全仓库无引用）。
**保留** `options.js` 与 `options.html`：它们是 `chrome://extensions` "扩展选项"入口的落地页，删除会导致该入口失效。

### P3-11　测试补强

新增三组行为用例（`verifySaveFavoriteConsistency`、`verifyStorageWriteFailures`、`verifyInternalMarkPersistence`），覆盖并发保存、同网址去重、settings 与 favorites 原子提交、同步开关、非法入参、配额失败、session 标记落盘。harness 增加 `storage.session` mock 与 `storageWriteError` 故障注入选项。

---

## 四、文件清单

| 文件 | 类型 | 说明 |
| --- | --- | --- |
| `smartFav智能收藏夹/constants.js` | 新增 | 共用常量与过期计算 |
| `smartFav智能收藏夹/background.js` | 修改 | +153/-? 行；importScripts、内部标记持久化、写入检查、`saveFavoriteEntry`、消息分支 |
| `smartFav智能收藏夹/popup.js` | 修改 | 常量引用、保存路径改走消息、过期计算复用、背景图上限 |
| `smartFav智能收藏夹/ai-client.js` | 修改 | 超时与中断 |
| `smartFav智能收藏夹/i18n.js` | 修改 | 背景图体积文案（中英各一处） |
| `smartFav智能收藏夹/manifest.json` | 修改 | CSP 声明 |
| `smartFav智能收藏夹/popup.html` | 修改 | 引入 `constants.js` |
| `smartFav智能收藏夹/styles/options.css` | 删除 | 死代码 |
| `tests/verify-extension.js` | 修改 | 新增 3 组用例、harness 扩展、修复 2 条失效 CSS 断言 |
| `README.md` | 修改 | 验证命令补齐 |
| `.gitignore` | 修改 | 新增 `dist/`、设计走查临时预览页 |

---

## 五、回溯方式

### 5.1 查看改了什么

```bash
# 全部改动一览
git diff --stat f1bfa2b HEAD

# 某个文件的完整改动
git diff f1bfa2b HEAD -- "smartFav智能收藏夹/background.js"

# 某次修复单独看
git show c64a700
```

### 5.2 三级回退

**① 只回退某一条修复**（推荐，粒度最小）

```bash
git revert c64a700          # 例：撤销"保存路径收敿"这一条
```

`revert` 会生成一个新提交来抵消目标提交，历史保留、可再次 revert 恢复。各提交之间基本独立，唯一顺序依赖是：`bc8c017`（constants.js）被后续所有提交引用，若要回退它需连带回退 popup/background 中的引用。

**② 回退单个文件到修复前**

```bash
git checkout f1bfa2b -- "smartFav智能收藏夹/popup.js"
node tests/verify-extension.js   # 回退后务必重跑
```

**③ 整体回到修复前基线**

```bash
git revert --no-commit 743a8cc..HEAD && git commit -m "revert: 回退一致性加固"
# 或（会丢弃提交历史，谨慎）
git reset --hard f1bfa2b
```

**④ 最后兜底**：`dist/SmartFav-Edge-1.14.2.zip` 是修复前的完整源码包，解压即得原始文件。

### 5.3 回退后必做

```bash
node tests/verify-extension.js
```

注意：新增的 3 组用例是针对修复后的行为写的。若回退了 `c64a700` 或 `23376f5`，对应用例会失败——这是预期的，说明回退生效。

---

## 六、遗留项与需要你决定的事

### 6.1 会话中发现的外部改动（非本次修复引入）

`smartFav智能收藏夹/styles/popup.css` 在本次会话期间被外部修改过（2423 → 2439 行，玻璃主题改为静态光场 + `.app-shell::before` 光泽层，`--backdrop-filter` 变量被 `--panel-backdrop-filter` 取代）。这次改动没有同步更新测试，导致 2 条断言失效：

- `blur(18px) saturate(135%)` → 已改为断言 `--panel-backdrop-filter: blur(14px) saturate(140%)` 并检查其被正确引用
- `doesNotMatch(/\.app-shell::before/)` → 已改为"该伪元素必须限定在玻璃主题下，不允许无条件全局遮罩"

我**没有改动 popup.css**，只更新了测试去匹配它。若那次 CSS 改动尚未定稿，请在定稿后复核这两条断言。

### 6.2 未做的事（有意跳过）

| 项 | 原因 |
| --- | --- |
| `bookmarkEventQueue` / `bookmarkLayoutQueue` 持久化 | 跨 worker 重启的队列重放需要引入任务表与幂等设计，改动面远超本次范围。当前队列内任务已满足"失败即中止、不留半状态"，重置只会丢弃未开始的任务 |
| 背景图拆到独立 storage key | 涉及 settings 读写、预览态、外观应用等 10 余处引用；降低上限 + 写入失败可见已解决实际风险，拆 key 收益不足 |
| AI 超时文案走 i18n | 沿用 `ai-client.js` 内既有的 `endpointErrorMessage` 双语内联模式，保持文件内一致 |
| 申请 `unlimitedStorage` | 会在商店审核与安装提示中增加权限项，对一张背景图不划算 |

### 6.3 需要你确认

1. **商店截图素材仍在 git 索引中**。你在 `.gitignore` 里加了 `docs/github-assets/`、`docs/store-assets/`、`docs/smartfav-popup.png`，并把扩展 README 改为"本地生成脱敏截图后直传、公开仓库不保存素材"。但这些文件在基线提交时已入库，`.gitignore` 对已跟踪文件无效。需要执行下面这步才能真正从索引中移除（文件仍留在磁盘上）：

   ```bash
   git rm -r --cached docs/github-assets docs/store-assets docs/smartfav-popup.png
   git commit -m "chore: 商店与展示素材移出版本库"
   ```

   要我执行吗？另外 `README.md` 顶部的 hero 图与功能概览图引用了 `docs/github-assets/` 下的文件，移出后 GitHub 页面会显示裂图，需要一并决定是改为外链还是删除引用。

2. **是否需要重新打包 1.14.2**。`dist/` 里的 ZIP 仍是修复前的源码。修复后若要出包，建议提升版本号到 1.14.3 并同步 `manifest.json`、`popup.html` 的 `?v=` 查询串、README 中的下载链接（版本号目前散落 4 处，尚未做单一来源收敿）。

---

## 七、浏览器端手工回归清单

自动化用例跑在 mock 上，以下五条高风险链路建议在真实浏览器中过一遍。前置：`edge://extensions` → 开发者模式 → 加载 `smartFav智能收藏夹` 目录。

### R1 收藏保存（P0-1、P1-3 主验证点）

1. 关闭"浏览器收藏夹同步"，收藏任意网页 → 收藏出现在"我的收藏"，浏览器书签栏无新增
2. 开启同步，收藏另一网页 → 提示"已保存到浏览器收藏夹"，`SmartFav / 分类` 下出现该书签，且**不应**弹出"浏览器新建星标"通知（说明内部标记生效）
3. 收藏同一网址两次并改分类 → 列表只有一条，分类为最新；浏览器侧书签被移动而非新增副本
4. 收藏时勾选"记住该网站归属" → 保存成功后分类规则已更新，"撤销"按钮可用且点击后规则回退

### R2 双向同步抖动

1. 开启同步，在浏览器书签栏一次性拖动 3~5 条 `SmartFav / 分类` 内的书签到另一分类 → SmartFav 分类跟随更新，无重复条目、无来回搬运
2. 在浏览器中删除其中一条 → 对应收藏进入"最近删除"，且只进入一次
3. 从 SmartFav 中删除一条 → 浏览器侧受管副本消失，"最近删除"新增一条，**不应**出现"浏览器删除"提示

### R3 排序写回

1. 用鼠标拖动与 `Alt + 方向键` 各调整一次分类文件夹顺序和分类内书签顺序
2. 打开浏览器书签管理器，确认 `SmartFav / 分类` 下的顺序与 popup 一致
3. 重开 popup，顺序保持不变

### R4 备份还原（唯一不可逆链路，重点验）

1. 创建布局备份 → 记录条目数
2. 执行一次批量整理 → 确认书签被移动
3. 预览还原 → 数字与实际相符；执行还原 → 目录结构回到整理前
4. 导出 JSON → 修改文件中任意字段使其损坏 → 导入应被拒绝且不影响现有还原点
5. 连续创建 4 次备份 → 确认活动还原点没有被 3 份上限裁掉

### R5 回收站过期

1. 删除一条收藏 → "最近删除"显示剩余 7 天
2. 手动还原 → 收藏回到列表，浏览器侧受管副本重新出现（若开启同步）
3. 永久删除 → 条目消失且不可恢复

### R6 配额与超时（本次新增的防线）

1. 上传一张 > 800KB 的图片作为背景 → 应提示"背景图片不能超过 800 KB"并拒绝
2. 上传一张 < 800KB 的图片 → 正常生效
3. 在 AI 设置中把接口地址指向一个不响应的地址（如 `http://localhost:1/v1/chat/completions`）→ 30 秒内出现超时提示，按钮恢复可用，不会永久转圈
