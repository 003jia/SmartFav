// SmartFav Constants - popup 与 background 共用的常量与派生计算
// 双导出：扩展页面通过 globalScope.SmartFavConstants 使用，Node 测试通过 require 使用。
(function attachConstants(globalScope) {
  // 最近删除保留期：7 天
  const TRASH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
  // 浏览器侧改动提示的存活时间：5 分钟
  const BROWSER_ACTIVITY_TTL_MS = 5 * 60 * 1000;
  // 内部书签操作标记的存活时间：30 秒
  const INTERNAL_REMOVE_TTL_MS = 30 * 1000;

  // 回收站条目的过期时刻。缺失 expiresAt 的历史数据按 deletedAt + 保留期推算。
  function getTrashExpireAt(item, now = Date.now()) {
    const entry = item || {};
    const explicit = Number(entry.expiresAt);
    if (explicit) return explicit;
    const deletedAt = Number(entry.deletedAt) || now;
    return deletedAt + TRASH_RETENTION_MS;
  }

  // 允许 SmartFav 收藏并在点击时导航的协议白名单。
  // 采用白名单而非黑名单：书签栏里的 bookmarklet（javascript:...）会被批量整理
  // 当成普通网址导入，随后点击就会在扩展页或预览页上下文执行；data: / file: 同理。
  // 只放行真正的网页协议，其余一律拒绝收藏与导航。
  const SAFE_URL_PROTOCOLS = Object.freeze(['http:', 'https:']);
  // 故意用正则解析协议而不是 new URL()：URL 在 service worker、扩展页里都有，
  // 但在 Node 的 vm 沙箱等宿主里未必存在，缺失时 new URL 会抛异常并把所有网址
  // 误判为不安全。这里只需要判断协议头，正则足够且无宿主依赖。
  const URL_SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):/i;

  function isSafeNavigableUrl(value) {
    // 浏览器在导航时会忽略控制字符与空白，"java\nscript:" 同样会被当成
    // javascript:，所以比较协议前必须先把这些字符全部剥掉。
    const raw = String(value || '').replace(/[\u0000-\u0020\u007f]/g, '');
    if (!raw) return false;
    const matched = URL_SCHEME_PATTERN.exec(raw);
    if (!matched) return false; // 相对地址或畸形串一律不放行
    return SAFE_URL_PROTOCOLS.includes(`${matched[1].toLowerCase()}:`);
  }

  const api = {
    TRASH_RETENTION_MS,
    BROWSER_ACTIVITY_TTL_MS,
    INTERNAL_REMOVE_TTL_MS,
    SAFE_URL_PROTOCOLS,
    isSafeNavigableUrl,
    getTrashExpireAt
  };
  globalScope.SmartFavConstants = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
