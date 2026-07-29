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

  const api = {
    TRASH_RETENTION_MS,
    BROWSER_ACTIVITY_TTL_MS,
    INTERNAL_REMOVE_TTL_MS,
    getTrashExpireAt
  };
  globalScope.SmartFavConstants = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
