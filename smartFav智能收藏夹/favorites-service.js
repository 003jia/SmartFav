// SmartFav Favorites Service - 收藏状态与浏览器书签布局的单一事务边界
// 本轮只做分层搬迁，不按回收站/同步/备份等功能域继续拆分。
// 若要按域拆分，必须先完成重构清单 Task 7 的显式事务对象，避免形成两把锁或循环依赖。
(function attachFavoritesService(globalScope) {
  function createFavoritesService({
    chrome: chromeApi = globalScope.chrome,
    stateStore = globalScope.SmartFavStateStore,
    bookmarkGuard,
    classifier = globalScope.SmartFavClassifier,
    bookmarks = globalScope.SmartFavBookmarks,
    backup = globalScope.SmartFavBackup,
    order = globalScope.SmartFavOrder,
    i18n = globalScope.SmartFavI18n,
    constants = globalScope.SmartFavConstants,
    logger = globalScope.console || console
  } = {}) {
    if (!chromeApi) throw new Error('chrome API is unavailable');
    if (!stateStore) throw new Error('SmartFavStateStore is unavailable');
    if (!bookmarkGuard) throw new Error('bookmarkGuard is required');
    if (!classifier || !bookmarks || !backup || !order || !constants) {
      throw new Error('SmartFav service dependencies are unavailable');
    }

    const chrome = chromeApi;
    const console = logger;
    const SmartFavClassifier = classifier;
    const SmartFavBookmarks = bookmarks;
    const SmartFavBackup = backup;
    const SmartFavOrder = order;
    const SmartFavI18n = i18n;
    const {
      TRASH_RETENTION_MS,
      BROWSER_ACTIVITY_TTL_MS,
      getTrashExpireAt
    } = constants;
    const getStoredState = () => stateStore.getStoredState(chrome);
    const setStoredStateChecked = (values) => stateStore.setStoredStateChecked(values, chrome);
    const setStoredFavorites = (favorites) => stateStore.setStoredFavorites(favorites, chrome);
    const setStoredState = (values) => stateStore.setStoredState(values, chrome);
    const {
      getTrackedBookmarksApi,
      withBookmarkLayoutLock,
      consumeInternalBookmarkRemoval,
      consumeInternalBookmarkMove
    } = bookmarkGuard;

    function createBrowserActivity(type, details = {}) {
      const createdAt = Date.now();
      return {
        id: `browser-${type}-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        title: String(details.title || ''),
        url: String(details.url || ''),
        category: String(details.category || ''),
        previousCategory: String(details.previousCategory || ''),
        count: Number(details.count) || 1,
        createdAt,
        expiresAt: createdAt + BROWSER_ACTIVITY_TTL_MS
      };
    }

    function translate(language, key, variables) {
      if (typeof SmartFavI18n !== 'undefined' && SmartFavI18n.translate) {
        return SmartFavI18n.translate(language, key, variables);
      }
      return key;
    }

    function showClassificationNotification(activity, language) {
      if (!chrome.notifications || typeof chrome.notifications.create !== 'function') {
        return Promise.resolve({ status: 'unavailable' });
      }
      const iconUrl = chrome.runtime && typeof chrome.runtime.getURL === 'function'
        ? chrome.runtime.getURL('icons/icon128.png')
        : 'icons/icon128.png';
      const options = {
        type: 'basic',
        iconUrl,
        title: translate(language, 'browserClassifiedNotificationTitle'),
        message: translate(language, 'browserClassifiedActivity', {
          title: activity.title || activity.url,
          category: activity.category
        })
      };
      return new Promise((resolve) => {
        chrome.notifications.create(activity.id, options, () => {
          // 读取 lastError 可以避免 Edge 在通知被系统禁用时输出未处理警告。
          const runtimeError = chrome.runtime && chrome.runtime.lastError;
          resolve(runtimeError
            ? { status: 'error', message: runtimeError.message }
            : { status: 'ok' });
        });
      });
    }

    function collectRemovedUrls(node, result = new Set()) {
      if (!node) return result;
      if (node.url) result.add(String(node.url));
      (node.children || []).forEach((child) => collectRemovedUrls(child, result));
      return result;
    }

    function createTrashEntry(favorite, now = Date.now()) {
      return {
        ...favorite,
        trashId: `trash-${now}-${Math.random().toString(36).slice(2, 9)}`,
        deletedAt: now,
        expiresAt: now + TRASH_RETENTION_MS
      };
    }

    function cleanupRecentlyDeleted(now = Date.now()) {
      return withBookmarkLayoutLock(() => cleanupRecentlyDeletedUnlocked(now));
    }

    async function cleanupRecentlyDeletedUnlocked(now = Date.now()) {
      const { recentlyDeleted } = await getStoredState();
      const retained = recentlyDeleted.filter((item) => getTrashExpireAt(item, now) > now);
      const removed = recentlyDeleted.length - retained.length;
      if (removed) await setStoredState({ recentlyDeleted: retained });
      return { status: 'ok', removed, items: retained };
    }

    async function getRecentlyDeleted() {
      return cleanupRecentlyDeleted();
    }

    function permanentlyDeleteFavorite(trashId) {
      return withBookmarkLayoutLock(() => permanentlyDeleteFavoriteUnlocked(trashId));
    }

    async function permanentlyDeleteFavoriteUnlocked(trashId) {
      const normalizedId = String(trashId || '').trim();
      const { recentlyDeleted } = await getStoredState();
      const nextRecentlyDeleted = recentlyDeleted.filter((item) => item.trashId !== normalizedId);
      const removed = recentlyDeleted.length - nextRecentlyDeleted.length;
      if (removed) await setStoredState({ recentlyDeleted: nextRecentlyDeleted });
      return { status: 'ok', removed, items: nextRecentlyDeleted };
    }

    function restoreDeletedFavorite(trashId) {
      return withBookmarkLayoutLock(() => restoreDeletedFavoriteUnlocked(trashId));
    }

    async function restoreDeletedFavoriteUnlocked(trashId) {
      const normalizedId = String(trashId || '').trim();
      const { settings, favorites, recentlyDeleted } = await getStoredState();
      const entry = recentlyDeleted.find((item) => item.trashId === normalizedId);
      if (!entry) return { status: 'missing', restored: 0 };

      const {
        trashId: _trashId,
        deletedAt: _deletedAt,
        expiresAt: _expiresAt,
        ...favorite
      } = entry;
      let browserStatus = settings.browserBookmarksEnabled ? 'ok' : 'disabled';
      if (settings.browserBookmarksEnabled) {
        try {
          const browserResult = await SmartFavBookmarks.writeFavorite(
            favorite,
            settings,
            getTrackedBookmarksApi()
          );
          browserStatus = browserResult.status;
        } catch (error) {
          browserStatus = 'error';
          console.error('SmartFav browser restore failed:', error);
        }
      }

      const nextFavorites = [
        favorite,
        ...favorites.filter((item) => item.url !== favorite.url)
      ];
      const nextRecentlyDeleted = recentlyDeleted.filter((item) => item.trashId !== normalizedId);
      await setStoredState({
        favorites: nextFavorites,
        recentlyDeleted: nextRecentlyDeleted
      });
      return {
        status: 'ok',
        restored: 1,
        browserStatus,
        favorite,
        items: nextRecentlyDeleted
      };
    }

    // 扩展被移除后重新加载、或换目录加载时，chrome.storage 可能是空的，
    // 但旧版本整理到浏览器 SmartFav/分类 下的网址仍然存在。
    // 启动弹窗时从这些受管目录恢复缺失记录，并保留原文件夹分类。
    function recoverManagedFavorites() {
      return withBookmarkLayoutLock(recoverManagedFavoritesUnlocked);
    }

    async function recoverManagedFavoritesUnlocked() {
      const { settings, favorites } = await getStoredState();
      if (!chrome.bookmarks) {
        return { status: 'unavailable', recovered: 0, total: 0, favorites };
      }

      const language = settings.language
        || (chrome.i18n.getUILanguage().toLowerCase().startsWith('zh') ? 'zh_CN' : 'en');
      const defaults = SmartFavClassifier.getDefaults(language);
      const baseCategories = Array.isArray(settings.categories) && settings.categories.length
        ? [...settings.categories]
        : [...defaults.categories];
      const fallbackCategory = baseCategories[baseCategories.length - 1]
        || (language === 'zh_CN' ? '其他' : 'Other');
      const managed = await SmartFavBookmarks.collectManagedBookmarks(
        chrome.bookmarks,
        fallbackCategory
      );

      const existingUrls = new Set(favorites.map((item) => item.url));
      const seenUrls = new Set();
      const additions = [];
      const recoveredCategories = [];
      managed.forEach((node) => {
        const url = String(node.url || '').trim();
        if (!url || seenUrls.has(url)) return;
        seenUrls.add(url);
        const category = String(node.category || fallbackCategory).trim() || fallbackCategory;
        if (!baseCategories.includes(category) && !recoveredCategories.includes(category)) {
          recoveredCategories.push(category);
        }
        if (existingUrls.has(url)) return;
        additions.push({
          url,
          title: node.title || url,
          favicon: '',
          description: '',
          category,
          tags: [],
          summary: language === 'zh_CN'
            ? '从浏览器 SmartFav 文件夹恢复'
            : 'Recovered from the browser SmartFav folder',
          classificationSource: 'local',
          createdAt: node.dateAdded || Date.now()
        });
      });

      const nextCategories = [...baseCategories, ...recoveredCategories];
      const settingsChanged = recoveredCategories.length > 0
        || !Array.isArray(settings.categories)
        || !settings.categories.length;
      const nextSettings = settingsChanged
        ? {
            ...settings,
            language,
            categories: nextCategories,
            keywordRules: SmartFavClassifier.mergeRules(
              nextCategories,
              settings.keywordRules,
              language
            )
          }
        : settings;
      const nextFavorites = additions.length ? [...additions, ...favorites] : favorites;

      if (additions.length || settingsChanged) {
        await setStoredState({
          favorites: nextFavorites,
          settings: nextSettings
        });
      }

      return {
        status: 'ok',
        recovered: additions.length,
        total: managed.length,
        categoriesAdded: recoveredCategories.length,
        favorites: nextFavorites
      };
    }

    // 删除由 SmartFav 管理的收藏。开启浏览器同步时，先删除浏览器侧记录；
    // 只有浏览器操作成功后才更新本地 storage，避免两边状态失配。
    function deleteFavorite(url) {
      return withBookmarkLayoutLock(() => deleteFavoriteUnlocked(url));
    }

    async function deleteFavoriteUnlocked(url) {
      const normalizedUrl = String(url || '').trim();
      if (!normalizedUrl) return { status: 'invalid', removed: 0, browserRemoved: 0 };

      const { settings, favorites, recentlyDeleted } = await getStoredState();
      const removedFavorites = favorites.filter((item) => item.url === normalizedUrl);
      const nextFavorites = favorites.filter((item) => item.url !== normalizedUrl);
      const removed = removedFavorites.length;
      if (!removed) return { status: 'ok', removed: 0, browserRemoved: 0 };

      let browserRemoved = 0;
      if (settings.browserBookmarksEnabled) {
        const browserResult = await SmartFavBookmarks.removeFavorite(
          normalizedUrl,
          settings,
          getTrackedBookmarksApi()
        );
        if (browserResult.status === 'unavailable') {
          throw new Error('Browser favorites are unavailable');
        }
        browserRemoved = browserResult.removed || 0;
      }

      const now = Date.now();
      const nextRecentlyDeleted = [
        ...removedFavorites.map((favorite, index) => createTrashEntry(favorite, now + index)),
        ...recentlyDeleted.filter((item) => item.url !== normalizedUrl)
      ];
      await setStoredState({
        favorites: nextFavorites,
        recentlyDeleted: nextRecentlyDeleted
      });
      return {
        status: 'ok',
        removed,
        trashed: removed,
        browserRemoved,
        syncEnabled: Boolean(settings.browserBookmarksEnabled)
      };
    }

    // 收藏保存的唯一写入入口。
    // 放在 withBookmarkLayoutLock 内，保证与浏览器书签事件回流、批量整理、排序写回互斥；
    // 书签写入统一走 getTrackedBookmarksApi()，使 SmartFav 自身的操作被标记为内部操作。
    async function saveFavoriteEntry(favorite, settingsPatch) {
      if (!favorite || !favorite.url) {
        throw new Error('Favorite url is required');
      }
      return withBookmarkLayoutLock(async () => {
        const state = await getStoredState();
        const settings = settingsPatch
          ? { ...state.settings, ...settingsPatch }
          : state.settings;
        const withoutDuplicate = state.favorites.filter((item) => item.url !== favorite.url);
        const nextValues = { favorites: [favorite, ...withoutDuplicate] };
        if (settingsPatch) nextValues.settings = settings;
        await setStoredStateChecked(nextValues);

        let bookmark = { status: 'disabled' };
        if (settings.browserBookmarksEnabled) {
          // 书签写回失败不回滚 storage：收藏本身是用户的主要意图，
          // 失败只降级提示（savedBrowserFailed），与修复前的行为保持一致。
          try {
            bookmark = await SmartFavBookmarks.writeFavorite(
              favorite,
              settings,
              getTrackedBookmarksApi()
            );
          } catch (error) {
            console.error('SmartFav browser favorite write failed:', error);
            bookmark = { status: 'error', message: error && error.message ? error.message : '' };
          }
        }
        return { status: 'ok', bookmark, settings };
      });
    }

    function updateSettings(settingsPatch) {
      return withBookmarkLayoutLock(() => updateSettingsUnlocked(settingsPatch));
    }

    async function updateSettingsUnlocked(settingsPatch) {
      if (
        !settingsPatch
        || typeof settingsPatch !== 'object'
        || Array.isArray(settingsPatch)
      ) {
        throw new Error('Settings patch must be an object');
      }
      const { settings } = await getStoredState();
      const nextSettings = { ...settings, ...settingsPatch };
      await setStoredStateChecked({ settings: nextSettings });
      return { status: 'ok', settings: nextSettings };
    }

    function updateFavoriteOrder(category, orderedUrls) {
      return withBookmarkLayoutLock(() => updateFavoriteOrderUnlocked(category, orderedUrls));
    }

    async function updateFavoriteOrderUnlocked(category, orderedUrls) {
      const normalizedCategory = String(category || '').trim();
      if (!normalizedCategory || !Array.isArray(orderedUrls)) {
        throw new Error('Favorite order requires a category and an ordered URL list');
      }
      const normalizedUrls = [...new Set(
        orderedUrls.map((url) => String(url || '').trim()).filter(Boolean)
      )];
      const { favoriteOrder } = await getStoredState();
      const nextFavoriteOrder = { ...favoriteOrder };
      if (normalizedUrls.length) {
        nextFavoriteOrder[normalizedCategory] = normalizedUrls;
      } else {
        delete nextFavoriteOrder[normalizedCategory];
      }
      await setStoredStateChecked({ favoriteOrder: nextFavoriteOrder });
      return { status: 'ok', favoriteOrder: nextFavoriteOrder };
    }

    function consumePendingBrowserActivity(activityId) {
      return withBookmarkLayoutLock(async () => {
        const normalizedId = String(activityId || '').trim();
        const { pendingBrowserActivity } = await getStoredState();
        if (
          !pendingBrowserActivity
          || !normalizedId
          || pendingBrowserActivity.id !== normalizedId
        ) {
          return {
            status: 'ok',
            consumed: false,
            activity: pendingBrowserActivity
          };
        }
        await setStoredStateChecked({ pendingBrowserActivity: null });
        return { status: 'ok', consumed: true, activity: null };
      });
    }

    // 分类文件夹或关键词规则变更后，使用已保存的标题、网址和描述
    // 重新运行本地分类器；开启浏览器同步时，同时移动 SmartFav 受管书签。
    async function reclassifyFavorites() {
      return withBookmarkLayoutLock(reclassifyFavoritesUnlocked);
    }

    async function reclassifyFavoritesUnlocked() {
      const { settings, favorites } = await getStoredState();
      let updated = 0;
      const reclassifiedAt = Date.now();
      const nextFavorites = favorites.map((favorite) => {
        const suggestion = SmartFavClassifier.classify({
          title: favorite.title || favorite.url,
          url: favorite.url,
          description: favorite.description || '',
          keywords: favorite.keywords || []
        }, settings);
        const next = {
          ...favorite,
          category: suggestion.category,
          tags: suggestion.tags,
          summary: suggestion.summary,
          classificationSource: 'local',
          reclassifiedAt
        };
        if (
          favorite.category !== next.category
          || JSON.stringify(favorite.tags || []) !== JSON.stringify(next.tags || [])
          || favorite.summary !== next.summary
          || favorite.classificationSource !== next.classificationSource
        ) {
          updated += 1;
        }
        return next;
      });

      await setStoredFavorites(nextFavorites);
      let browserMoved = 0;
      let browserStatus = settings.browserBookmarksEnabled ? 'ok' : 'disabled';
      try {
        const browserResult = await SmartFavBookmarks.syncManagedCategories(
          nextFavorites,
          settings,
          getTrackedBookmarksApi()
        );
        browserMoved = browserResult.moved || 0;
        browserStatus = browserResult.status;
      } catch (error) {
        browserStatus = 'error';
        console.error('SmartFav browser category sync failed:', error);
      }

      return {
        status: 'ok',
        total: nextFavorites.length,
        updated,
        browserMoved,
        browserStatus
      };
    }

    async function ensureBookmarkRestorePointUnlocked(reason = 'automatic') {
      if (!chrome.bookmarks) throw new Error('Browser bookmarks are unavailable');
      const { bookmarkRestorePoints } = await getStoredState();
      let point = SmartFavBackup.getActiveRestorePoint(bookmarkRestorePoints);
      let nextPoints;

      if (point) {
        // 还原点在恢复前持续生效。每次整理前把新出现的外部书签补入，
        // 避免后续星标或新文件夹丢失它们各自的原始位置。
        point = await SmartFavBackup.appendExternalBookmarks(
          chrome.bookmarks,
          point
        );
        nextPoints = SmartFavBackup.trimRestorePoints(
          bookmarkRestorePoints.map((item) => item.id === point.id ? point : item)
        );
      } else {
        point = await SmartFavBackup.createRestorePoint(chrome.bookmarks, reason);
        nextPoints = SmartFavBackup.trimRestorePoints([
          ...bookmarkRestorePoints,
          point
        ]);
      }

      // 必须先确认快照写入成功，调用方才可以移动浏览器书签。
      await setStoredStateChecked({ bookmarkRestorePoints: nextPoints });
      return {
        point,
        summary: SmartFavBackup.summarizeRestorePoint(point),
        points: nextPoints
      };
    }

    async function getBookmarkRestorePointState() {
      if (!chrome.bookmarks) return { status: 'unavailable', points: [], activePoint: null };
      const { bookmarkRestorePoints } = await getStoredState();
      const points = [...bookmarkRestorePoints]
        .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0))
        .map(SmartFavBackup.summarizeRestorePoint);
      return {
        status: 'ok',
        points,
        activePoint: SmartFavBackup.summarizeRestorePoint(
          SmartFavBackup.getActiveRestorePoint(bookmarkRestorePoints)
        )
      };
    }

    function createBookmarkRestorePoint() {
      return withBookmarkLayoutLock(async () => {
        const result = await ensureBookmarkRestorePointUnlocked('manual');
        return {
          status: 'ok',
          point: result.summary,
          points: result.points.map(SmartFavBackup.summarizeRestorePoint)
        };
      });
    }

    function previewBookmarkRestore(pointId) {
      return withBookmarkLayoutLock(async () => {
        if (!chrome.bookmarks) return { status: 'unavailable' };
        const { bookmarkRestorePoints } = await getStoredState();
        const point = SmartFavBackup.findRestorePoint(bookmarkRestorePoints, pointId);
        return SmartFavBackup.previewRestorePoint(chrome.bookmarks, point);
      });
    }

    function restoreBookmarkLayout(pointId) {
      return withBookmarkLayoutLock(async () => {
        if (!chrome.bookmarks) return { status: 'unavailable' };
        const { bookmarkRestorePoints } = await getStoredState();
        const point = SmartFavBackup.findRestorePoint(bookmarkRestorePoints, pointId);
        if (!point) return { status: 'missing' };

        const result = await SmartFavBackup.restorePoint(
          getTrackedBookmarksApi(),
          point
        );
        let nextPoints = bookmarkRestorePoints;
        if (result.status === 'ok' && result.unresolvedParents === 0) {
          const restoredPoint = {
            ...point,
            restoredAt: Date.now(),
            lastRestoreResult: {
              restored: result.restored,
              alreadyRestored: result.alreadyRestored,
              missingBookmarks: result.missingBookmarks,
              createdFolders: result.createdFolders
            }
          };
          nextPoints = bookmarkRestorePoints.map(
            (item) => item.id === point.id ? restoredPoint : item
          );
          await setStoredStateChecked({ bookmarkRestorePoints: nextPoints });
        }

        return {
          ...result,
          point: SmartFavBackup.summarizeRestorePoint(
            SmartFavBackup.findRestorePoint(nextPoints, point.id)
          )
        };
      });
    }

    async function exportBookmarkRestorePoints() {
      const { bookmarkRestorePoints } = await getStoredState();
      return {
        status: 'ok',
        payload: SmartFavBackup.createExportPayload(bookmarkRestorePoints)
      };
    }

    function importBookmarkRestorePoints(payload) {
      return withBookmarkLayoutLock(async () => {
        const importedPoints = SmartFavBackup.parseImportPayload(payload);
        const { bookmarkRestorePoints } = await getStoredState();
        const nextPoints = SmartFavBackup.mergeRestorePoints(
          bookmarkRestorePoints,
          importedPoints
        );
        await setStoredStateChecked({ bookmarkRestorePoints: nextPoints });
        return {
          status: 'ok',
          imported: importedPoints.length,
          points: nextPoints.map(SmartFavBackup.summarizeRestorePoint),
          activePoint: SmartFavBackup.summarizeRestorePoint(
            SmartFavBackup.getActiveRestorePoint(nextPoints)
          )
        };
      });
    }

    function syncManagedOrder(order) {
      return withBookmarkLayoutLock(async () => {
        const { settings } = await getStoredState();
        return SmartFavBookmarks.syncManagedOrder(
          order,
          settings,
          getTrackedBookmarksApi()
        );
      });
    }

    function moveFavoriteToCategory(url, targetCategory) {
      return withBookmarkLayoutLock(async () => {
        const {
          settings,
          favorites,
          favoriteOrder
        } = await getStoredState();
        const localResult = SmartFavOrder.moveFavoriteAcrossCategories(
          favorites,
          favoriteOrder,
          url,
          targetCategory
        );
        if (!localResult.changed) {
          return {
            status: localResult.status,
            moved: 0,
            browserStatus: settings.browserBookmarksEnabled ? 'missing' : 'disabled'
          };
        }

        await setStoredStateChecked({
          favorites: localResult.favorites,
          favoriteOrder: localResult.favoriteOrder
        });

        let browserResult = {
          status: settings.browserBookmarksEnabled ? 'missing' : 'disabled',
          moved: 0,
          matched: 0,
          missing: settings.browserBookmarksEnabled ? 1 : 0
        };
        if (settings.browserBookmarksEnabled) {
          try {
            browserResult = await SmartFavBookmarks.moveManagedFavorite(
              url,
              targetCategory,
              settings,
              getTrackedBookmarksApi()
            );
          } catch (error) {
            browserResult = {
              status: 'error',
              moved: 0,
              matched: 0,
              missing: 0,
              message: error.message
            };
          }
        }

        return {
          status: 'ok',
          moved: 1,
          favorite: localResult.favorite,
          previousCategory: localResult.previousCategory,
          targetCategory: localResult.targetCategory,
          browserStatus: browserResult.status,
          browserMoved: browserResult.moved || 0,
          browserMatched: browserResult.matched || 0,
          browserMissing: browserResult.missing || 0,
          message: browserResult.message || ''
        };
      });
    }

    // 整理浏览器收藏夹：读取全部书签 → 本地分类 → 导入 SmartFav 分类；
    // 仅当"允许整理浏览器收藏夹"开启时才把书签移动进 SmartFav/分类 文件夹
    function organizeBrowserBookmarks() {
      return withBookmarkLayoutLock(organizeBrowserBookmarksUnlocked);
    }

    async function organizeBrowserBookmarksUnlocked() {
      const { settings, favorites } = await getStoredState();
      if (!chrome.bookmarks) return { status: 'unavailable' };
      let restorePoint = null;
      if (settings.bookmarkOrganizeEnabled) {
        const backup = await ensureBookmarkRestorePointUnlocked('organize');
        restorePoint = backup.summary;
      }

      const result = await SmartFavBookmarks.organizeBookmarks(
        settings,
        getTrackedBookmarksApi(),
        SmartFavClassifier.classify
      );
      if (result.status !== 'ok') return result;

      const existingByUrl = new Map(favorites.map((item) => [item.url, item]));
      const additions = [];
      const updatesByUrl = new Map();
      const seenUrls = new Set();
      result.favorites.forEach(({ bookmarkId, ...classified }) => {
        if (seenUrls.has(classified.url)) return;
        seenUrls.add(classified.url);
        const existing = existingByUrl.get(classified.url);
        if (!existing) {
          additions.push(classified);
          return;
        }
        const updated = {
          ...existing,
          title: classified.title || existing.title,
          category: classified.category,
          tags: classified.tags,
          summary: classified.summary,
          classificationSource: 'local'
        };
        if (
          updated.title !== existing.title
          || updated.category !== existing.category
          || JSON.stringify(updated.tags) !== JSON.stringify(existing.tags)
          || updated.summary !== existing.summary
          || updated.classificationSource !== existing.classificationSource
        ) {
          updatesByUrl.set(classified.url, updated);
        }
      });
      if (additions.length || updatesByUrl.size) {
        await setStoredFavorites([
          ...additions,
          ...favorites.map((item) => updatesByUrl.get(item.url) || item)
        ]);
      }

      return {
        status: 'ok',
        total: result.favorites.length,
        imported: additions.length,
        updated: updatesByUrl.size,
        moved: result.moved,
        wroteBack: Boolean(settings.bookmarkOrganizeEnabled),
        restorePoint
      };
    }

    // 自动获取浏览器收藏：用户点击收藏星标后自动识别、分类；
    // 开启整理后，新增星标也会按同网址模式自动移动或覆盖到 SmartFav/分类
    async function handleBookmarkCreated(id, node) {
      if (!node || !node.url) return;
      const { settings, favorites, recentlyDeleted } = await getStoredState();
      const shouldCapture = Boolean(settings.bookmarkAutoCaptureEnabled);
      const shouldOrganize = Boolean(settings.bookmarkOrganizeEnabled);
      if (!shouldCapture && !shouldOrganize) return;
      if (!chrome.bookmarks) return;
      if (await SmartFavBookmarks.isInsideSmartFavFolder(chrome.bookmarks, node)) return;

      const suggestion = SmartFavClassifier.classify(
        { title: node.title || node.url, url: node.url, description: '' },
        settings
      );
      const favorite = {
        url: node.url,
        title: node.title || node.url,
        favicon: '',
        description: '',
        category: suggestion.category,
        tags: suggestion.tags,
        summary: suggestion.summary,
        classificationSource: 'local',
        createdAt: Date.now()
      };
      if (shouldCapture) {
        await setStoredState({
          favorites: [
            favorite,
            ...favorites.filter((item) => item.url !== favorite.url)
          ],
          recentlyDeleted: recentlyDeleted.filter((item) => item.url !== favorite.url)
        });
      }

      if (shouldOrganize) {
        // handleBookmarkCreated 的整个读改写过程已经由监听器放入布局锁，
        // 这里不能再次获取同一把锁，否则 Promise 链会互相等待。
        // 新增星标属于一次浏览器布局变更，必须先把当前外部书签
        // （包括刚创建的这条）补进活动还原点。
        await ensureBookmarkRestorePointUnlocked('auto-capture');
        if (settings.bookmarkWriteMode === 'add') {
          await SmartFavBookmarks.placeBookmarkInCategory(
            getTrackedBookmarksApi(),
            id,
            suggestion.category
          );
        } else {
          await SmartFavBookmarks.writeFavorite(
            favorite,
            { ...settings, browserBookmarksEnabled: true },
            getTrackedBookmarksApi()
          );
        }
      }

      const activity = createBrowserActivity('classified', {
        title: favorite.title,
        url: favorite.url,
        category: favorite.category
      });
      await setStoredState({ pendingBrowserActivity: activity });
      await showClassificationNotification(activity, settings.language);
    }

    async function handleBookmarkMoved(id, moveInfo) {
      if (await consumeInternalBookmarkMove(id)) return;
      if (!chrome.bookmarks) return;
      if (
        moveInfo
        && String(moveInfo.parentId || '') === String(moveInfo.oldParentId || '')
      ) {
        return;
      }

      const {
        settings,
        favorites,
        favoriteOrder
      } = await getStoredState();
      const shouldSyncMove = Boolean(
        settings.browserBookmarksEnabled || settings.bookmarkAutoCaptureEnabled
      );
      if (!shouldSyncMove || !favorites.length) return;

      const managed = await SmartFavBookmarks.getManagedBookmarkInfo(
        chrome.bookmarks,
        id
      );
      if (managed.status !== 'ok' || !managed.node || !managed.category) return;

      const localResult = SmartFavOrder.moveFavoriteAcrossCategories(
        favorites,
        favoriteOrder,
        managed.node.url,
        managed.category
      );
      if (!localResult.changed) return;

      let nextSettings = settings;
      const categories = Array.isArray(settings.categories)
        ? settings.categories
        : [];
      if (!categories.includes(managed.category)) {
        const language = settings.language
          || (chrome.i18n.getUILanguage().toLowerCase().startsWith('zh') ? 'zh_CN' : 'en');
        const nextCategories = [...categories, managed.category];
        nextSettings = {
          ...settings,
          language,
          categories: nextCategories,
          keywordRules: SmartFavClassifier.mergeRules(
            nextCategories,
            settings.keywordRules,
            language
          )
        };
      }

      const activity = createBrowserActivity('moved', {
        title: localResult.favorite.title || managed.node.title || managed.node.url,
        url: managed.node.url,
        category: managed.category,
        previousCategory: localResult.previousCategory
      });
      await setStoredStateChecked({
        favorites: localResult.favorites,
        favoriteOrder: localResult.favoriteOrder,
        ...(nextSettings !== settings ? { settings: nextSettings } : {}),
        pendingBrowserActivity: activity
      });
    }

    async function handleBookmarkRemoved(id, removeInfo) {
      if (await consumeInternalBookmarkRemoval(id)) return;
      const removedUrls = [...collectRemovedUrls(removeInfo && removeInfo.node)];
      if (!removedUrls.length || !chrome.bookmarks) return;

      const { settings, favorites, recentlyDeleted } = await getStoredState();
      const shouldSyncDeletion = Boolean(
        settings.browserBookmarksEnabled || settings.bookmarkAutoCaptureEnabled
      );
      if (!shouldSyncDeletion || !favorites.length) return;

      const urlsToTrash = new Set();
      for (const url of removedUrls) {
        if (!favorites.some((favorite) => favorite.url === url)) continue;
        const remainingMatches = await SmartFavBookmarks.findUrlMatches(chrome.bookmarks, url);
        if (!remainingMatches.length) urlsToTrash.add(url);
      }
      if (!urlsToTrash.size) return;

      const removedFavorites = favorites.filter((favorite) => urlsToTrash.has(favorite.url));
      if (!removedFavorites.length) return;
      const now = Date.now();
      const activity = createBrowserActivity('trashed', {
        title: removedFavorites[0].title || removedFavorites[0].url,
        url: removedFavorites[0].url,
        count: removedFavorites.length
      });
      await setStoredState({
        favorites: favorites.filter((favorite) => !urlsToTrash.has(favorite.url)),
        recentlyDeleted: [
          ...removedFavorites.map((favorite, index) => createTrashEntry(favorite, now + index)),
          ...recentlyDeleted.filter((item) => !urlsToTrash.has(item.url))
        ],
        pendingBrowserActivity: activity
      });
    }

    return Object.freeze({
      cleanupRecentlyDeleted,
      getRecentlyDeleted,
      permanentlyDeleteFavorite,
      restoreDeletedFavorite,
      recoverManagedFavorites,
      deleteFavorite,
      saveFavoriteEntry,
      updateSettings,
      updateFavoriteOrder,
      consumePendingBrowserActivity,
      reclassifyFavorites,
      getBookmarkRestorePointState,
      createBookmarkRestorePoint,
      previewBookmarkRestore,
      restoreBookmarkLayout,
      exportBookmarkRestorePoints,
      importBookmarkRestorePoints,
      syncManagedOrder,
      moveFavoriteToCategory,
      organizeBrowserBookmarks,
      handleBookmarkCreated,
      handleBookmarkMoved,
      handleBookmarkRemoved
    });
  }

  const api = { createFavoritesService };
  globalScope.SmartFavFavoritesService = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
