# SmartFav 数据一致性与稳定性加固

> 审查对象：SmartFav 智能收藏夹 v1.14.2（Chrome/Edge Manifest V3 扩展）
> 审查方式：全量源码审查（项目非 git 仓库，无 diff 基线），所有条目均已逐条读代码核实
> 文档用途：问题登记 + 修复方案 + 回溯预案

---

## 一、问题登记

严重度定义：P0 会造成用户数据静默丢失；P1 高概率引发功能异常或数据不一致；P2 中等可维护性/健壮性问题；P3 工程与测试基线。

### P0-1　favorites 存在两条互不知情的读-改-写路径

| 项 | 内容 |
| --- | --- |
| 位置 | `smartFav智能收藏夹/popup.js:1118-1147`、`smartFav智能收藏夹/background.js:1123-1130` |
| 现象 | popup 保存收藏时自行 `storageGet(['favorites'])` → 过滤同 URL → `storageSet`；background 的 `saveFavorite` 消息处理器也做同一件事。两条路径都不经过已有的 `withBookmarkLayoutLock`（background.js:99） |
| 触发条件 | 用户点击"确认收藏"的同时，浏览器侧书签事件（`onCreated` / `onRemoved` / `onMoved`）正在回流并写 favorites |
| 后果 | 后写覆盖先写。丢失的可能是新收藏，也可能是回收站条目——回收站本身即恢复手段，一旦丢失不可恢复 |
| 证据 | popup.js:1118 读、1142 过滤、1147 写，全程无锁；background.js:1124 读、1127 写，同样无锁 |

### P0-2　storage 写入不检查 lastError，失败被当成功

| 项 | 内容 |
| --- | --- |
| 位置 | `smartFav智能收藏夹/background.js:268-278` |
| 现象 | `setStoredFavorites` 与 `setStoredState` 直接把 `resolve` 作为 `chrome.storage.local.set` 的回调，不检查 `chrome.runtime.lastError`。同文件 280-291 的 `setStoredStateChecked` 已实现正确写法，但删除、移动、回收站清理走的都是前两个函数 |
| 触发条件 | `storage.local` 配额超限、存储损坏 |
| 后果 | Promise 正常 resolve，UI 提示成功，数据实际未落盘。用户以为删除成功，重开弹窗内容还在 |
| 证据 | background.js:270 `chrome.storage.local.set({ favorites }, resolve)` 对比 283-287 的 lastError 分支 |

### P1-3　popup 写回浏览器书签绕过内部操作标记

| 项 | 内容 |
| --- | --- |
| 位置 | `smartFav智能收藏夹/popup.js:1153-1158` |
| 现象 | 传入 `SmartFavBookmarks.writeFavorite` 的是原生 `chrome.bookmarks`，而非 background 的 `getTrackedBookmarksApi()` Proxy（background.js:59-89） |
| 触发条件 | 开启"浏览器收藏夹同步"后从 popup 保存收藏 |
| 后果 | 该次 `create` / `move` / `remove` 不会被标记为内部操作，background 的 `onCreated` / `onMoved` 可能把 SmartFav 自己的写入当成用户手动操作，触发反向回流（重复分类、通知误报） |
| 证据 | popup.js:1153 `const bookmarksApi = isExtension && chrome.bookmarks ? chrome.bookmarks : null;` |

### P1-4　MV3 内部操作标记与任务队列为纯内存态

| 项 | 内容 |
| --- | --- |
| 位置 | `smartFav智能收藏夹/background.js:14-17` |
| 现象 | `internallyRemovedBookmarkIds`、`internallyMovedBookmarkIds`（TTL 30s）与 `bookmarkEventQueue`、`bookmarkLayoutQueue` 均为 service worker 模块级变量 |
| 触发条件 | service worker 空闲被回收后重启 |
| 后果 | 标记丢失 → 自身操作被误判为用户操作；队列 Promise 链断裂 → 已排队任务被静默遗弃 |
| 证据 | background.js:14-17 声明；27 行 TTL 30s；92-96 队列追加 |

### P1-5　AI 请求无超时与中断控制

| 项 | 内容 |
| --- | --- |
| 位置 | `smartFav智能收藏夹/ai-client.js:247` |
| 现象 | `fetch(request.endpoint, request.options)` 无 `signal`、无超时、无重试上限 |
| 触发条件 | AI 服务无响应或网络挂起（本机 Ollama 未启动但端口被占用时尤其容易出现） |
| 后果 | 分类建议或"AI 分析并填入"永久停在进行中状态，按钮不恢复 |
| 证据 | ai-client.js:247，`options` 中仅有 method / headers / body |

### P1-6　背景图以 base64 挤占 storage 配额

| 项 | 内容 |
| --- | --- |
| 位置 | `smartFav智能收藏夹/popup.js:2552-2566` |
| 现象 | 自定义背景图经 `readAsDataURL` 转 base64 后存入 `settings`，上限 3MB（base64 后实际约 4MB），与 `favorites`、`bookmarkRestorePoints` 共用同一 `storage.local` 配额；manifest 未申请 `unlimitedStorage` |
| 触发条件 | 用户上传较大背景图 + 收藏量较多 + 存在还原点 |
| 后果 | 配额触顶，叠加 P0-2 后表现为静默失败 |
| 证据 | popup.js:2558 `file.size > 3 * 1024 * 1024`；manifest.json permissions 无 `unlimitedStorage` |

### P2-7　getFavorites 降级分支未检查 lastError

- 位置：`smartFav智能收藏夹/background.js:1060-1062`
- 现象：`recoverManagedFavorites()` 失败后回退读 storage，回调未检查 lastError，失败时把 `undefined` 交给 `sendResponse`

### P2-8　manifest 未显式声明 CSP

- 位置：`smartFav智能收藏夹/manifest.json`
- 现象：无 `content_security_policy` 字段。MV3 默认策略已禁止 inline script 与远程代码，当前无实际漏洞；显式声明用于防止后续改动无意放宽

### P2-9　常量与回收站清理逻辑双写

- 位置：`popup.js:29-30` ↔ `background.js:10-13`（`TRASH_RETENTION_MS`、`BROWSER_ACTIVITY_TTL_MS`）；`popup.js:1479-1492` ↔ `background.js:302-312`（清理逻辑）；`popup.js:1486` 与 `1508-1509`（过期时间表达式重复）
- 后果：两处已具备独立漂移的条件，改一处漏一处即产生行为不一致

### P2-10　死代码

- `smartFav智能收藏夹/options.js` 仅 1 行重定向到 `popup.html?view=settings`
- `smartFav智能收藏夹/styles/options.css` 414 行，无任何 HTML 引用

### P3-11　测试基线薄弱

- `tests/verify-extension.js` 中约半数断言是对源码做正则匹配（`assert.match(popupJs, /…/)`），无法发现行为回归，重构时会大面积误报
- `popup.js` 3322 行零行为覆盖
- 全部集成用例串行 `await`，`withBookmarkLayoutLock` 的锁语义从未被真正验证

### 复核后已排除的疑似问题

以下条目在自动审查中被报出，经逐条读代码确认**不成立**，不纳入修复：

| 疑似问题 | 复核结论 |
| --- | --- |
| innerHTML 拼接存在 XSS | 9 处 `innerHTML` 的全部动态值均经 `escapeHtml`（popup.js:2104），含属性位置。不成立 |
| onMessage 缺少 `return true` | background.js:1048-1179 每个分支均有 `return true`。不成立 |
| 多处 `console.log` 残留 | 全项目仅 background.js:233 一处安装日志。不成立 |
| 多处使用 `==` / `!=` | 仅 3 处 `== null` 惯用写法（bookmark-backup.js:33、popup.js:2081、2105）。不成立 |
| 存在 `var` 声明、`content-script.js` | 均不存在。不成立 |

---

## 二、修复方案

### 技术路线

核心思路是**把 favorites / recentlyDeleted / settings 的写入收敿为单一入口**，让 background 成为唯一的写者，并复用其已有的 `withBookmarkLayoutLock` 与 `getTrackedBookmarksApi`。popup 从"自己读写 storage + 自己操作书签"退化为"发消息 + 渲染"。

这条路线不新增抽象层，只是让已经存在的锁和 Proxy 覆盖到目前漏掉的路径。

### 修复 1：收藏保存改由 background 在锁内完成（治 P0-1、P1-3）

`background.js` 重写 `saveFavorite` 消息处理器：

```javascript
async function saveFavoriteEntry(favorite, settingsPatch) {
  return withBookmarkLayoutLock(async () => {
    const state = await getStoredState();
    const settings = settingsPatch ? { ...state.settings, ...settingsPatch } : state.settings;
    const withoutDuplicate = state.favorites.filter((item) => item.url !== favorite.url);
    const nextValues = { favorites: [favorite, ...withoutDuplicate] };
    if (settingsPatch) nextValues.settings = settings;
    await setStoredStateChecked(nextValues);

    let bookmark = { status: 'disabled' };
    if (settings.browserBookmarksEnabled) {
      bookmark = await SmartFavBookmarks.writeFavorite(
        favorite,
        settings,
        getTrackedBookmarksApi()
      );
    }
    return { status: 'ok', bookmark };
  });
}
```

消息分支：

```javascript
if (message.type === 'saveFavorite') {
  saveFavoriteEntry(message.favorite, message.settingsPatch)
    .then(sendResponse)
    .catch((error) => sendResponse({ status: 'error', message: error.message }));
  return true;
}
```

`popup.js:1113-1167` 的处理器改为：保留分类推荐、域名学习提案的计算逻辑（纯本地计算，不涉及存储），把"写 storage + 写书签"两步替换为一次 `sendRuntimeMessage('saveFavorite', { favorite, settingsPatch })`；根据返回的 `bookmark.status` 决定提示文案（`disabled` / `unavailable` / 其它）。非扩展调试模式（`isExtension === false`）保留原有本地写入分支。

### 修复 2：统一使用带检查的写入（治 P0-2、P2-7）

- `background.js:268-278`：`setStoredFavorites` 与 `setStoredState` 改为复用 `setStoredStateChecked` 的实现（内部检查 lastError 并 reject）
- 因这两个函数原先永不 reject，需检查其全部调用点是否都处在有 `.catch(...)` 的消息链路中——现有消息处理器均已 `.catch` 并回传 `{ status: 'error' }`，无需额外改动
- `background.js:1060`：降级分支补 lastError 检查，失败时回传空数组而非 `undefined`

### 修复 3：内部标记落到 storage.session（治 P1-4）

将 `internallyRemovedBookmarkIds` / `internallyMovedBookmarkIds` 的读写改为经 `chrome.storage.session`（MV3 提供，随浏览器会话存活，不随 worker 回收丢失）。保留内存 Map 作为一级缓存以避免每次事件都异步读取，`chrome.storage.session` 作为权威来源。

`bookmarkEventQueue` / `bookmarkLayoutQueue` 不做持久化改造——队列语义依赖同一 worker 实例内的 Promise 链，跨重启持久化需要引入任务表与幂等重放，超出本次修复范围。改为在文件顶部注明该限制，并确保队列内的任务本身满足"失败即中止、不留半状态"（现有实现已满足，`verify-extension.js` 有对应用例）。

### 修复 4：AI 请求加超时（治 P1-5）

`ai-client.js` 的 `call()` 中引入 `AbortController` + 30s 超时：

```javascript
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
let response;
try {
  response = await fetch(request.endpoint, { ...request.options, signal: controller.signal });
} catch (error) {
  if (error && error.name === 'AbortError') {
    throw new Error(isChinese ? 'AI 请求超时（30 秒）' : 'AI request timed out (30s)');
  }
  throw error;
} finally {
  clearTimeout(timer);
}
```

超时错误归入既有的失败分支：批量关键词建议保持"整批失败则界面不变"的现有语义，收藏分类保持"AI 失败回退本地分类"的现有语义。i18n.js 补对应文案键。

### 修复 5：背景图配额治理（治 P1-6）

- 上限从 3MB 降到 800KB，并在 `readBackgroundImage` 中于 `readAsDataURL` 之后校验 base64 实际长度
- 背景图从 `settings` 拆到独立 key `customBackgroundImage`，避免每次保存设置都重写整张图
- i18n 中"背景图过大"的文案更新为新上限

> 不申请 `unlimitedStorage`：该权限会在商店审核与安装提示中增加权限项，对一张背景图不划算。

### 修复 6：常量与清理逻辑去重（治 P2-9）

新增 `smartFav智能收藏夹/constants.js`，导出 `TRASH_RETENTION_MS`、`BROWSER_ACTIVITY_TTL_MS`、`INTERNAL_REMOVE_TTL_MS` 及工具函数 `getTrashExpireAt(item, now)`。沿用项目既有的 IIFE + `globalScope` + `module.exports` 双导出模式，由 `background.js` 的 `importScripts` 与 `popup.html` 的 `<script>` 各自引入。popup 与 background 中的重复定义与重复表达式改为引用该模块。

### 修复 7：CSP 与死代码（治 P2-8、P2-10）

- `manifest.json` 增加 `"content_security_policy": { "extension_pages": "script-src 'self'; object-src 'self'" }`
- 删除 `styles/options.css`（确认无引用）
- 保留 `options.js` + `options.html`：它是 `chrome://extensions` 里"扩展选项"入口的落地页，删掉会导致该入口失效

### 修复 8：测试补强（治 P3-11，最小范围）

本次只补两类真正缺失的行为测试，不重构既有正则断言（那是独立的工程任务）：

1. `withBookmarkLayoutLock` 的并发语义：并发发起两个 `saveFavorite`，断言两条收藏都在、无覆盖
2. `setStoredFavorites` 在 `lastError` 被置位时确实 reject，且调用方不会向 UI 回报成功

---

## 三、受影响文件

| 文件 | 修改类型 | 涉及函数 / 位置 |
| --- | --- | --- |
| `smartFav智能收藏夹/constants.js` | 新增 | 全文 |
| `smartFav智能收藏夹/background.js` | 修改 | `importScripts`、常量声明、内部标记读写、`setStoredFavorites`、`setStoredState`、新增 `saveFavoriteEntry`、`saveFavorite` 与 `getFavorites` 消息分支 |
| `smartFav智能收藏夹/popup.js` | 修改 | 常量声明、`confirmBtn` 处理器、`cleanupRecentlyDeletedItems`、`renderTrashRow`、`readBackgroundImage`、背景图读写与外观应用 |
| `smartFav智能收藏夹/ai-client.js` | 修改 | 新增超时常量、`call()` |
| `smartFav智能收藏夹/i18n.js` | 修改 | 新增超时文案键、更新背景图体积文案 |
| `smartFav智能收藏夹/manifest.json` | 修改 | 新增 `content_security_policy` |
| `smartFav智能收藏夹/popup.html` | 修改 | 引入 `constants.js` |
| `smartFav智能收藏夹/styles/options.css` | 删除 | 全文 |
| `tests/verify-extension.js` | 修改 | 新增 2 个验证函数 |

---

## 四、边界与异常处理

- **`storage.session` 不可用**：旧版浏览器无 `chrome.storage.session`，内部标记回退为纯内存态（即当前行为），不抛错
- **`setStoredState` 改为会 reject 后**：逐一确认调用点都在已有 `.catch` 的链路中；`cleanupRecentlyDeleted` 由 alarm 触发，其 `.catch` 已存在（background.js:1040）
- **saveFavorite 消息失败**：popup 展示既有的 `favoriteSaveFailed` 错误态并恢复按钮，不关闭弹窗
- **书签写回失败但 storage 已成功**：沿用现状（收藏保留，提示 `savedBrowserFailed`），不回滚 storage——收藏本身是用户主要意图
- **AI 超时**：不重试。重试会让本已缓慢的交互进一步变慢，且失败语义已明确回退本地分类
- **背景图上限下调**：已存超限图片的老用户不做强制清理，仅在下次更换时按新上限校验

## 五、数据流（修复后）

```
用户点击"确认收藏"
  └─ popup：计算分类 / 域名学习提案（纯本地）
       └─ sendRuntimeMessage('saveFavorite', { favorite, settingsPatch })
            └─ background：withBookmarkLayoutLock
                 ├─ getStoredState()
                 ├─ setStoredStateChecked({ favorites, settings })   ← 失败即 reject
                 └─ SmartFavBookmarks.writeFavorite(..., getTrackedBookmarksApi())
                      └─ 内部 remove/move 自动打标 → storage.session
       └─ popup：按 bookmark.status 渲染提示，刷新列表
```

## 六、预期结果

- 收藏、删除、回收站的写入全部经由 background 单入口且在锁内，并发写不再互相覆盖
- storage 写入失败会明确反馈到 UI，不再出现"提示成功但数据未落盘"
- SmartFav 自身的书签操作全部被正确标记，service worker 重启后标记依然有效
- AI 请求 30s 内必定结束，界面不再卡在进行中
- `node tests/verify-extension.js` 通过，且新增的并发与写入失败用例通过
- 各文件 `node --check` 通过

---

## 七、回溯预案（重要）

**当前项目不是 git 仓库**（`git rev-parse` 失败），这意味着修复后没有任何原生手段可以回退代码。在动手改之前必须先建立基线，二选一：

- **方案 A（推荐）**：`git init` + 提交一次基线快照。回溯方式为 `git diff` 查看改动、`git checkout -- <file>` 或 `git revert` 回退，粒度精确到行
- **方案 B**：把 `smartFav智能收藏夹/` 与 `tests/` 复制为 `.backup-1.14.2/` 目录。回溯方式为整目录覆盖回去，粒度只到文件

另外 `dist/SmartFav-Edge-1.14.2.zip` 是修复前源码的完整压缩包，可作为最后兜底。

请确认：**采用方案 A 还是方案 B**，以及**修复范围**（建议 P0 + P1 + P2 共 10 条，P3 按修复 8 的最小范围做）。
