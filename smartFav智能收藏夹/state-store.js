// SmartFav State Store - chrome.storage.local 的唯一读写与默认值归一化层
// 扩展 worker 通过 globalScope.SmartFavStateStore 使用，Node 测试通过 require 使用。
(function attachStateStore(globalScope) {
  const STATE_KEYS = Object.freeze([
    'settings',
    'favorites',
    'favoriteOrder',
    'recentlyDeleted',
    'bookmarkRestorePoints',
    'pendingBrowserActivity'
  ]);

  function getChromeApi(chromeApi) {
    const api = chromeApi || globalScope.chrome;
    if (
      !api
      || !api.storage
      || !api.storage.local
      || typeof api.storage.local.get !== 'function'
      || typeof api.storage.local.set !== 'function'
    ) {
      throw new Error('chrome.storage.local is unavailable');
    }
    return api;
  }

  function getRuntimeError(chromeApi) {
    return chromeApi.runtime && chromeApi.runtime.lastError;
  }

  function normalizeStoredState(result) {
    const safeResult = result || {};
    return {
      settings: safeResult.settings
        && typeof safeResult.settings === 'object'
        && !Array.isArray(safeResult.settings)
        ? safeResult.settings
        : {},
      favorites: Array.isArray(safeResult.favorites) ? safeResult.favorites : [],
      favoriteOrder: safeResult.favoriteOrder
        && typeof safeResult.favoriteOrder === 'object'
        && !Array.isArray(safeResult.favoriteOrder)
        ? safeResult.favoriteOrder
        : {},
      recentlyDeleted: Array.isArray(safeResult.recentlyDeleted)
        ? safeResult.recentlyDeleted
        : [],
      bookmarkRestorePoints: Array.isArray(safeResult.bookmarkRestorePoints)
        ? safeResult.bookmarkRestorePoints
        : [],
      pendingBrowserActivity: safeResult.pendingBrowserActivity || null
    };
  }

  function getStoredState(chromeApi) {
    return new Promise((resolve, reject) => {
      let api;
      try {
        api = getChromeApi(chromeApi);
      } catch (error) {
        reject(error);
        return;
      }
      api.storage.local.get(STATE_KEYS, (result) => {
        const runtimeError = getRuntimeError(api);
        if (runtimeError) {
          reject(new Error(runtimeError.message));
          return;
        }
        resolve(normalizeStoredState(result));
      });
    });
  }

  // storage.local 配额超限或存储损坏时，set() 的回调仍可能触发。
  // 所有写入必须检查 lastError，避免 UI 把失败误报为保存成功。
  function setStoredStateChecked(values, chromeApi) {
    return new Promise((resolve, reject) => {
      let api;
      try {
        api = getChromeApi(chromeApi);
      } catch (error) {
        reject(error);
        return;
      }
      api.storage.local.set(values, () => {
        const runtimeError = getRuntimeError(api);
        if (runtimeError) {
          reject(new Error(runtimeError.message));
          return;
        }
        resolve();
      });
    });
  }

  function setStoredFavorites(favorites, chromeApi) {
    return setStoredStateChecked({ favorites }, chromeApi);
  }

  function setStoredState(values, chromeApi) {
    return setStoredStateChecked(values, chromeApi);
  }

  const api = {
    STATE_KEYS,
    normalizeStoredState,
    getStoredState,
    setStoredStateChecked,
    setStoredFavorites,
    setStoredState
  };

  globalScope.SmartFavStateStore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
