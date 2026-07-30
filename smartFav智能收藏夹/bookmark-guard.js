// SmartFav Bookmark Guard - 书签事件顺序、布局事务锁与内部操作标记
// 本模块必须在每个 service worker 实例中只创建一次。队列是内存态：
// worker 被回收后队列会重置；storage.session 中的内部操作标记会保留到浏览器会话结束。
(function attachBookmarkGuard(globalScope) {
  function createBookmarkGuard({
    chrome: chromeApi = globalScope.chrome,
    internalRemoveTtlMs,
    logger = globalScope.console || console
  } = {}) {
    if (!chromeApi) throw new Error('chrome API is unavailable');

    const constants = globalScope.SmartFavConstants || {};
    const markTtlMs = Number(internalRemoveTtlMs)
      || Number(constants.INTERNAL_REMOVE_TTL_MS)
      || 30 * 1000;
    const internallyRemovedBookmarkIds = new Map();
    const internallyMovedBookmarkIds = new Map();
    const INTERNAL_REMOVE_KEY = 'internalBookmarkRemovals';
    const INTERNAL_MOVE_KEY = 'internalBookmarkMoves';

    // 两条 Promise 队列仅在当前 service worker 实例内存活。
    // eventQueue 保持浏览器事件顺序；所有共享状态和书签布局读改写
    // 必须继续进入唯一的 layoutQueue，不能让业务层自行创建第二把锁。
    let bookmarkEventQueue = Promise.resolve();
    let bookmarkLayoutQueue = Promise.resolve();

    function getSessionArea() {
      const storage = chromeApi.storage;
      if (!storage || !storage.session) return null;
      return typeof storage.session.get === 'function' ? storage.session : null;
    }

    function readSessionMarks(key, cache) {
      const area = getSessionArea();
      if (!area) return Promise.resolve(cache);
      return new Promise((resolve) => {
        area.get([key], (result) => {
          if (chromeApi.runtime && chromeApi.runtime.lastError) {
            resolve(cache);
            return;
          }
          const stored = result && result[key];
          if (stored && typeof stored === 'object') {
            Object.keys(stored).forEach((id) => {
              const expiresAt = Number(stored[id]);
              if (expiresAt && !cache.has(id)) cache.set(id, expiresAt);
            });
          }
          resolve(cache);
        });
      });
    }

    function writeSessionMarks(key, cache) {
      const area = getSessionArea();
      if (!area || typeof area.set !== 'function') return;
      const plain = {};
      cache.forEach((expiresAt, id) => {
        plain[id] = expiresAt;
      });
      area.set({ [key]: plain }, () => {
        // 会话标记失败只退化为当前 worker 的内存标记，不阻断用户的书签操作。
        void (chromeApi.runtime && chromeApi.runtime.lastError);
      });
    }

    function pruneMarks(cache, now = Date.now()) {
      cache.forEach((expiresAt, id) => {
        if (expiresAt <= now) cache.delete(id);
      });
    }

    function markInternalOperation(key, cache, id) {
      pruneMarks(cache);
      cache.set(String(id), Date.now() + markTtlMs);
      writeSessionMarks(key, cache);
    }

    async function consumeInternalOperation(key, cache, id) {
      await readSessionMarks(key, cache);
      pruneMarks(cache);
      const normalizedId = String(id);
      const wasInternal = cache.has(normalizedId);
      cache.delete(normalizedId);
      if (wasInternal) writeSessionMarks(key, cache);
      return wasInternal;
    }

    function markInternalBookmarkRemoval(id) {
      markInternalOperation(
        INTERNAL_REMOVE_KEY,
        internallyRemovedBookmarkIds,
        id
      );
    }

    function consumeInternalBookmarkRemoval(id) {
      return consumeInternalOperation(
        INTERNAL_REMOVE_KEY,
        internallyRemovedBookmarkIds,
        id
      );
    }

    function markInternalBookmarkMove(id) {
      markInternalOperation(
        INTERNAL_MOVE_KEY,
        internallyMovedBookmarkIds,
        id
      );
    }

    function consumeInternalBookmarkMove(id) {
      return consumeInternalOperation(
        INTERNAL_MOVE_KEY,
        internallyMovedBookmarkIds,
        id
      );
    }

    // browser-bookmarks.js 在覆盖同网址或同步删除时会调用 remove / move。
    // 先写 session 标记，避免对应事件被误判成用户从浏览器侧发起的操作。
    function getTrackedBookmarksApi() {
      if (!chromeApi.bookmarks) return null;
      return new Proxy(chromeApi.bookmarks, {
        get(target, property) {
          if (property === 'remove') {
            return (id, callback) => {
              markInternalBookmarkRemoval(id);
              return target.remove(id, (...args) => {
                if (chromeApi.runtime && chromeApi.runtime.lastError) {
                  internallyRemovedBookmarkIds.delete(String(id));
                }
                callback(...args);
              });
            };
          }
          if (property === 'move') {
            return (id, destination, callback) => {
              markInternalBookmarkMove(id);
              return target.move(id, destination, (...args) => {
                if (chromeApi.runtime && chromeApi.runtime.lastError) {
                  internallyMovedBookmarkIds.delete(String(id));
                }
                callback(...args);
              });
            };
          }
          const value = target[property];
          return typeof value === 'function' ? value.bind(target) : value;
        }
      });
    }

    function enqueueBookmarkEvent(label, task) {
      bookmarkEventQueue = bookmarkEventQueue
        .then(task)
        .catch((error) => {
          if (logger && typeof logger.error === 'function') {
            logger.error(`SmartFav ${label} failed:`, error);
          }
        });
      return bookmarkEventQueue;
    }

    function withBookmarkLayoutLock(task) {
      const run = bookmarkLayoutQueue.then(task, task);
      bookmarkLayoutQueue = run.catch(() => {});
      return run;
    }

    return Object.freeze({
      getTrackedBookmarksApi,
      enqueueBookmarkEvent,
      withBookmarkLayoutLock,
      markInternalBookmarkRemoval,
      consumeInternalBookmarkRemoval,
      markInternalBookmarkMove,
      consumeInternalBookmarkMove
    });
  }

  const api = { createBookmarkGuard };
  globalScope.SmartFavBookmarkGuard = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
