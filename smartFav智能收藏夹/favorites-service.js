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
    folderTree = globalScope.SmartFavFolderTree,
    aiOrganization = globalScope.SmartFavAIOrganization,
    logger = globalScope.console || console
  } = {}) {
    if (!chromeApi) throw new Error('chrome API is unavailable');
    if (!stateStore) throw new Error('SmartFavStateStore is unavailable');
    if (!bookmarkGuard) throw new Error('bookmarkGuard is required');
    if (!classifier || !bookmarks || !backup || !order || !constants || !folderTree || !aiOrganization) {
      throw new Error('SmartFav service dependencies are unavailable');
    }

    const chrome = chromeApi;
    const console = logger;
    const SmartFavClassifier = classifier;
    const SmartFavBookmarks = bookmarks;
    const SmartFavBackup = backup;
    const SmartFavOrder = order;
    const SmartFavI18n = i18n;
    const SmartFavFolderTree = folderTree;
    const SmartFavAIOrganization = aiOrganization;
    const {
      TRASH_RETENTION_MS,
      BROWSER_ACTIVITY_TTL_MS,
      getTrashExpireAt
    } = constants;
    const setStoredStateChecked = (values) => stateStore.setStoredStateChecked(values, chrome);
    const setStoredFavorites = (favorites) => stateStore.setStoredFavorites(favorites, chrome);
    const setStoredState = (values) => stateStore.setStoredState(values, chrome);

    async function createFolderMigrationSafetySnapshot(raw) {
      const createdAt = Date.now();
      let bookmarkRestorePoints = raw.bookmarkRestorePoints;
      let browserRestorePointId = '';
      let browserRestoreStatus = 'unavailable';
      if (chrome.bookmarks && typeof chrome.bookmarks.getTree === 'function') {
        try {
          const point = await SmartFavBackup.createRestorePoint(
            chrome.bookmarks,
            'schema-v2-migration'
          );
          bookmarkRestorePoints = SmartFavBackup.trimRestorePoints([
            ...(raw.bookmarkRestorePoints || []),
            point
          ]);
          browserRestorePointId = point.id;
          browserRestoreStatus = 'ok';
        } catch (error) {
          browserRestoreStatus = 'unavailable';
          console.warn('SmartFav could not create a browser restore point before migration:', error);
        }
      }
      return {
        bookmarkRestorePoints,
        folderMigrationBackup: {
          schemaVersion: 1,
          createdAt,
          fromFolderSchemaVersion: Number(raw.folderSchemaVersion) || 0,
          browserRestorePointId,
          browserRestoreStatus,
          state: {
            folderSchemaVersion: Number(raw.folderSchemaVersion) || 0,
            folders: raw.folders,
            settings: raw.settings,
            favorites: raw.favorites,
            favoriteOrder: raw.favoriteOrder,
            recentlyDeleted: raw.recentlyDeleted,
            bookmarkRestorePoints: raw.bookmarkRestorePoints,
            aiOrganizationPreviews: raw.aiOrganizationPreviews,
            pendingBrowserActivity: raw.pendingBrowserActivity
          }
        }
      };
    }

    async function getStoredState() {
      const raw = await stateStore.getStoredState(chrome);
      const language = raw.settings.language
        || (chrome.i18n && chrome.i18n.getUILanguage
          && chrome.i18n.getUILanguage().toLowerCase().startsWith('zh') ? 'zh_CN' : 'en');
      const defaults = SmartFavClassifier.getDefaults(language);
      const migration = SmartFavFolderTree.migrateState(raw, {
        language,
        categories: defaults.categories,
        keywordRules: defaults.keywordRules
      });
      if (migration.changed) {
        const isLegacySchema = Number(raw.folderSchemaVersion) !== SmartFavFolderTree.SCHEMA_VERSION;
        const safety = isLegacySchema && !raw.folderMigrationBackup
          ? await createFolderMigrationSafetySnapshot(raw)
          : {
              folderMigrationBackup: raw.folderMigrationBackup,
              bookmarkRestorePoints: raw.bookmarkRestorePoints
            };
        const migrationPatch = {
          folderSchemaVersion: migration.folderSchemaVersion,
          folders: migration.folders,
          favorites: migration.favorites,
          favoriteOrder: migration.favoriteOrder,
          folderMigrationBackup: safety.folderMigrationBackup,
          bookmarkRestorePoints: safety.bookmarkRestorePoints
        };
        await setStoredStateChecked(migrationPatch);
        return { ...raw, ...migration, ...migrationPatch };
      }
      return { ...raw, ...migration };
    }
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

    function collectRemovedNodeIds(node, result = { bookmarks: new Set(), folders: new Set() }) {
      if (!node) return result;
      if (node.url) result.bookmarks.add(String(node.id || ''));
      else result.folders.add(String(node.id || ''));
      (node.children || []).forEach((child) => collectRemovedNodeIds(child, result));
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
      const { settings, folders, favorites, recentlyDeleted, favoriteOrder } = await getStoredState();
      const entry = recentlyDeleted.find((item) => item.trashId === normalizedId);
      if (!entry) return { status: 'missing', restored: 0 };

      const {
        trashId: _trashId,
        deletedAt: _deletedAt,
        expiresAt: _expiresAt,
        ...favorite
      } = entry;
      const targetFolder = SmartFavFolderTree.getFolder(folders, favorite.folderId)
        || SmartFavFolderTree.getFallbackFolder(folders, settings.language)
        || folders[0];
      if (!targetFolder) return { status: 'invalid', restored: 0, message: 'No target folder' };
      const restoredFavorite = {
        ...favorite,
        id: favorite.id || SmartFavFolderTree.createId('fav'),
        folderId: targetFolder.id,
        category: SmartFavFolderTree.getPathLabel(folders, targetFolder.id)
      };
      let browserStatus = settings.browserBookmarksEnabled ? 'ok' : 'disabled';
      let browserBookmarkId = restoredFavorite.browserBookmarkId || '';
      if (settings.browserBookmarksEnabled) {
        try {
          const browserResult = await SmartFavBookmarks.writeFavorite(
            restoredFavorite,
            settings,
            getTrackedBookmarksApi(),
            { folders }
          );
          browserStatus = browserResult.status;
          browserBookmarkId = browserResult.id || browserBookmarkId;
        } catch (error) {
          browserStatus = 'error';
          console.error('SmartFav browser restore failed:', error);
        }
      }

      const finalFavorite = { ...restoredFavorite, browserBookmarkId };
      const nextFavorites = settings.bookmarkWriteMode === 'add'
        ? [finalFavorite, ...favorites.filter((item) => item.id !== finalFavorite.id)]
        : [finalFavorite, ...favorites.filter((item) => item.url !== finalFavorite.url)];
      const nextOrder = { ...favoriteOrder };
      nextOrder[targetFolder.id] = [
        finalFavorite.id,
        ...(nextOrder[targetFolder.id] || []).filter((id) => id !== finalFavorite.id)
      ];
      const nextRecentlyDeleted = recentlyDeleted.filter((item) => item.trashId !== normalizedId);
      await setStoredState({
        favorites: nextFavorites,
        favoriteOrder: nextOrder,
        recentlyDeleted: nextRecentlyDeleted
      });
      return {
        status: 'ok',
        restored: 1,
        browserStatus,
        favorite: finalFavorite,
        items: nextRecentlyDeleted
      };
    }

    // 启动时递归对账浏览器 SmartFav 目录树；浏览器 ID 优先，完整路径回退。
    function recoverManagedFavorites() {
      return withBookmarkLayoutLock(recoverManagedFavoritesUnlocked);
    }

    async function recoverManagedFavoritesUnlocked() {
      const state = await getStoredState();
      const { settings } = state;
      if (!chrome.bookmarks) {
        return { status: 'unavailable', recovered: 0, total: 0, favorites: state.favorites };
      }

      const language = settings.language
        || (chrome.i18n.getUILanguage().toLowerCase().startsWith('zh') ? 'zh_CN' : 'en');
      const fallback = SmartFavFolderTree.getFallbackFolder(state.folders, language);
      const structure = await SmartFavBookmarks.collectManagedStructure(
        chrome.bookmarks,
        fallback ? fallback.name : (language === 'zh_CN' ? '其他' : 'Other')
      );
      let folders = SmartFavFolderTree.normalizeFolders(state.folders);
      const browserToLocal = new Map();
      const byBrowserId = new Map(
        folders.filter((folder) => folder.browserFolderId)
          .map((folder) => [String(folder.browserFolderId), folder])
      );
      const orderedBrowserFolders = [...structure.folders]
        .sort((left, right) => left.path.length - right.path.length || left.order - right.order);
      orderedBrowserFolders.forEach((browserFolder) => {
        const parentId = browserToLocal.get(String(browserFolder.parentBrowserFolderId)) || null;
        let local = byBrowserId.get(String(browserFolder.browserFolderId));
        if (!local) {
          local = folders.find((folder) => (
            (folder.parentId || null) === parentId && folder.name === browserFolder.name
          ));
        }
        if (!local) {
          const created = SmartFavFolderTree.createFolder(folders, {
            parentId,
            name: browserFolder.name,
            order: browserFolder.order,
            source: 'browser',
            browserFolderId: browserFolder.browserFolderId
          });
          if (created.status !== 'ok') return;
          folders = created.folders;
          local = created.folder;
        } else {
          folders = folders.map((folder) => folder.id === local.id
            ? {
                ...folder,
                parentId,
                name: browserFolder.name,
                order: browserFolder.order,
                browserFolderId: browserFolder.browserFolderId
              }
            : folder);
          local = folders.find((folder) => folder.id === local.id);
        }
        browserToLocal.set(String(browserFolder.browserFolderId), local.id);
      });

      let favorites = [...state.favorites];
      const byBookmarkId = new Map(
        favorites.filter((favorite) => favorite.browserBookmarkId)
          .map((favorite) => [String(favorite.browserBookmarkId), favorite])
      );
      const overwriteMode = settings.bookmarkWriteMode !== 'add';
      const seenUrls = new Set();
      let recovered = 0;
      structure.bookmarks.forEach((node) => {
        const url = String(node.url || '').trim();
        if (!url || (overwriteMode && seenUrls.has(url))) return;
        seenUrls.add(url);
        const folderId = browserToLocal.get(String(node.browserFolderId))
          || (fallback && fallback.id)
          || null;
        let favorite = byBookmarkId.get(String(node.id));
        if (!favorite && overwriteMode) favorite = favorites.find((item) => item.url === url);
        if (favorite) {
          const index = favorites.findIndex((item) => item.id === favorite.id);
          favorites[index] = {
            ...favorite,
            folderId,
            category: SmartFavFolderTree.getPathLabel(folders, folderId) || node.category,
            browserBookmarkId: node.id,
            title: node.title || favorite.title || url
          };
          return;
        }
        favorites.unshift({
          id: SmartFavFolderTree.createId('fav'),
          folderId,
          browserBookmarkId: node.id,
          url,
          title: node.title || url,
          favicon: '',
          description: '',
          category: SmartFavFolderTree.getPathLabel(folders, folderId) || node.category,
          tags: [],
          summary: language === 'zh_CN'
            ? '从浏览器 SmartFav 文件夹恢复'
            : 'Recovered from the browser SmartFav folder',
          classificationSource: 'local',
          createdAt: node.dateAdded || Date.now()
        });
        recovered += 1;
      });

      let recentlyDeleted = [...state.recentlyDeleted];
      let unboundFavorites = 0;
      let unboundFolders = 0;
      // 对账闸门：如果本地存在已绑定浏览器书签的收藏，但这次扫描一条书签都没读到，
      // 几乎一定是 getSubTree 读取异常或根目录被临时移走，而不是用户清空了收藏。
      // 此时直接跳过对账，避免一次性误判全部收藏。
      const boundFavoriteCount = favorites.filter((favorite) => favorite.browserBookmarkId).length;
      const suspiciousEmptyScan = boundFavoriteCount > 0 && structure.bookmarks.length === 0;
      if (structure.roots.length && !suspiciousEmptyScan) {
        const managedBrowserFolderIds = new Set(
          structure.folders.map((folder) => String(folder.browserFolderId))
        );
        const managedBookmarkIds = new Set(
          structure.bookmarks.map((bookmark) => String(bookmark.id))
        );
        // 「浏览器里找不到」不等于「用户想删除」。用户把书签或目录拖出 SmartFav 目录
        // 是正常操作，真正的删除由 chrome.bookmarks.onRemoved 单独入账。
        // 所以这里只解除绑定、保留本地数据，让下一次同步按路径重建，而不是丢进回收站
        // 或直接 filter 掉整棵子树（那样 keywords 与层级都不可恢复）。
        folders = folders.map((folder) => {
          if (!folder.browserFolderId) return folder;
          if (managedBrowserFolderIds.has(String(folder.browserFolderId))) return folder;
          unboundFolders += 1;
          const next = { ...folder };
          delete next.browserFolderId;
          return next;
        });
        favorites = favorites.map((favorite) => {
          if (!favorite.browserBookmarkId) return favorite;
          if (managedBookmarkIds.has(String(favorite.browserBookmarkId))) return favorite;
          unboundFavorites += 1;
          const next = { ...favorite };
          delete next.browserBookmarkId;
          return next;
        });
      }

      const favoriteByBrowserId = new Map(
        favorites.filter((favorite) => favorite.browserBookmarkId)
          .map((favorite) => [String(favorite.browserBookmarkId), favorite])
      );
      const validFavoriteIds = new Set(favorites.map((favorite) => favorite.id));
      const validFolderIds = new Set(folders.map((folder) => folder.id));
      const favoriteOrder = Object.fromEntries(
        Object.entries(state.favoriteOrder)
          .filter(([folderId]) => validFolderIds.has(folderId))
          .map(([folderId, ids]) => [
            folderId,
            (Array.isArray(ids) ? ids : []).filter((id) => validFavoriteIds.has(id))
          ])
      );
      const browserOrderByFolder = new Map();
      structure.folders.forEach((folder) => {
        const folderId = browserToLocal.get(String(folder.browserFolderId));
        if (folderId && !browserOrderByFolder.has(folderId)) browserOrderByFolder.set(folderId, []);
      });
      structure.bookmarks
        .slice()
        .sort((left, right) => Number(left.index || 0) - Number(right.index || 0))
        .forEach((node) => {
          const folderId = browserToLocal.get(String(node.browserFolderId));
          const favorite = favoriteByBrowserId.get(String(node.id));
          if (!folderId || !favorite) return;
          if (!browserOrderByFolder.has(folderId)) browserOrderByFolder.set(folderId, []);
          browserOrderByFolder.get(folderId).push(favorite.id);
        });
      browserOrderByFolder.forEach((ids, folderId) => {
        favoriteOrder[folderId] = ids;
      });

      await setStoredState({
        folderSchemaVersion: SmartFavFolderTree.SCHEMA_VERSION,
        folders,
        favorites,
        favoriteOrder,
        recentlyDeleted
      });

      return {
        status: 'ok',
        recovered,
        total: structure.bookmarks.length,
        foldersRecovered: Math.max(0, folders.length - state.folders.length),
        unboundFavorites,
        unboundFolders,
        skippedReconcile: suspiciousEmptyScan,
        folders,
        favorites,
        favoriteOrder
      };
    }

    // favoriteOrder 的唯一维护入口：key 是 folderId，value 是该目录内的 favoriteId 顺序。
    // 早期各写入路径（删除、保存、自动采集、批量整理）各写各的，导致被删 id 残留、
    // 新收藏不进 order，排序视图位置不确定。所有增删都必须经过这里。
    function applyOrderPatch(favoriteOrder, {
      remove = [],
      insert = [],
      folderId = '',
      position = 'end'
    } = {}) {
      const removeSet = new Set(remove.map((id) => String(id)));
      const next = {};
      Object.entries(favoriteOrder && typeof favoriteOrder === 'object' ? favoriteOrder : {})
        .forEach(([key, ids]) => {
          const kept = (Array.isArray(ids) ? ids : []).filter((id) => !removeSet.has(String(id)));
          next[key] = kept;
        });
      const insertIds = insert.map((id) => String(id)).filter(Boolean);
      if (folderId && insertIds.length) {
        const current = (next[folderId] || []).filter((id) => !insertIds.includes(String(id)));
        // 新收藏在列表里显示在最前，order 也要同向插入，否则排序视图与列表视图不一致。
        next[folderId] = position === 'start'
          ? [...insertIds, ...current]
          : [...current, ...insertIds];
      }
      return next;
    }

    // 删除由 SmartFav 管理的收藏。
    // 顺序仍然是「先删浏览器 → 再写本地」：这样浏览器失败时本地记录完好，
    // 用户不会丢任何东西（1.14.3 起的既有约定，见 tests 中 delete-failure 用例）。
    // 本轮补的是「批量删除中途失败」的缺口：进入循环前先做一次可用性预检，
    // 避免删掉前 N 条后才发现 API 不可用，留下双边失配的中间态。
    function deleteFavorite(identifier) {
      return withBookmarkLayoutLock(() => deleteFavoriteUnlocked(identifier));
    }

    async function deleteFavoriteUnlocked(identifier) {
      const normalizedIdentifier = String(identifier || '').trim();
      if (!normalizedIdentifier) return { status: 'invalid', removed: 0, browserRemoved: 0 };

      const { settings, favorites, favoriteOrder, recentlyDeleted } = await getStoredState();
      const byId = favorites.some((item) => item.id === normalizedIdentifier);
      const removedFavorites = favorites.filter((item) => (
        byId ? item.id === normalizedIdentifier : item.url === normalizedIdentifier
      ));
      const removedIds = new Set(removedFavorites.map((item) => item.id));
      const nextFavorites = favorites.filter((item) => !removedIds.has(item.id));
      const removed = removedFavorites.length;
      if (!removed) return { status: 'ok', removed: 0, browserRemoved: 0 };

      let browserRemoved = 0;
      if (settings.browserBookmarksEnabled) {
        // 预检：书签 API 整体不可用时立刻退出，此时本地一个字节都没改。
        if (!chrome.bookmarks || typeof chrome.bookmarks.getTree !== 'function') {
          throw new Error('Browser favorites are unavailable');
        }
        // 多条删除前建一个还原点：chrome.bookmarks.remove 不可撤销，
        // 中途失败时用户至少能从布局还原点找回被删的浏览器节点。
        if (removedFavorites.length > 1) {
          await ensureBookmarkRestorePointUnlocked('delete-favorites');
        }
        for (const favorite of removedFavorites) {
          const browserResult = await SmartFavBookmarks.removeFavoriteRecord(
            favorite,
            settings,
            getTrackedBookmarksApi()
          );
          if (browserResult.status === 'unavailable') {
            throw new Error('Browser favorites are unavailable');
          }
          browserRemoved += browserResult.removed || 0;
        }
      }

      const now = Date.now();
      const nextRecentlyDeleted = [
        ...removedFavorites.map((favorite, index) => createTrashEntry(favorite, now + index)),
        ...recentlyDeleted.filter((item) => !removedIds.has(item.id))
      ];
      await setStoredState({
        favorites: nextFavorites,
        // 被删 id 必须同时从 favoriteOrder 摘除，否则会留下指向不存在收藏的脏顺序项。
        favoriteOrder: applyOrderPatch(favoriteOrder, { remove: [...removedIds] }),
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
        const fallback = SmartFavFolderTree.getFallbackFolder(state.folders, settings.language);
        const folderByLegacyName = state.folders.find((folder) => (
          folder.name === favorite.category || SmartFavFolderTree.getPathLabel(state.folders, folder.id) === favorite.category
        ));
        const folderId = state.folders.some((folder) => folder.id === favorite.folderId)
          ? favorite.folderId
          : ((folderByLegacyName || fallback) && (folderByLegacyName || fallback).id);
        const normalizedFavorite = {
          ...favorite,
          id: favorite.id || SmartFavFolderTree.createId('fav'),
          folderId: folderId || null,
          category: folderId
            ? SmartFavFolderTree.getPathLabel(state.folders, folderId)
            : String(favorite.category || '')
        };
        const withoutDuplicate = settings.bookmarkWriteMode === 'add'
          ? state.favorites
          : state.favorites.filter((item) => item.url !== normalizedFavorite.url);
        const replacedIds = state.favorites
          .filter((item) => !withoutDuplicate.includes(item))
          .map((item) => item.id);
        const nextValues = {
          favorites: [normalizedFavorite, ...withoutDuplicate],
          // 新收藏必须同时进 favoriteOrder，否则它在排序视图里的位置不确定；
          // 覆盖模式下被替换掉的同网址旧记录也要一并摘除。
          favoriteOrder: applyOrderPatch(state.favoriteOrder, {
            remove: replacedIds,
            insert: [normalizedFavorite.id],
            folderId: normalizedFavorite.folderId || '',
            position: 'start'
          })
        };
        if (settingsPatch) nextValues.settings = settings;
        await setStoredStateChecked(nextValues);

        let bookmark = { status: 'disabled' };
        if (settings.browserBookmarksEnabled) {
          // 书签写回失败不回滚 storage：收藏本身是用户的主要意图，
          // 失败只降级提示（savedBrowserFailed），与修复前的行为保持一致。
          try {
            bookmark = await SmartFavBookmarks.writeFavorite(
              normalizedFavorite,
              settings,
              getTrackedBookmarksApi(),
              { folders: state.folders }
            );
            const boundFolders = applyBrowserFolderBindings(
              state.folders,
              bookmark.createdFolders || []
            );
            if (bookmark.id) {
              nextValues.favorites = nextValues.favorites.map((item) => (
                item.id === normalizedFavorite.id ? { ...item, browserBookmarkId: bookmark.id } : item
              ));
              await setStoredStateChecked({
                favorites: nextValues.favorites,
                folders: boundFolders
              });
            } else if (boundFolders !== state.folders) {
              await setStoredStateChecked({ folders: boundFolders });
            }
          } catch (error) {
            console.error('SmartFav browser favorite write failed:', error);
            bookmark = { status: 'error', message: error && error.message ? error.message : '' };
          }
        }
        return { status: 'ok', bookmark, settings, favorite: normalizedFavorite };
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
      if (!settings.browserBookmarksEnabled && nextSettings.browserBookmarksEnabled) {
        const rebuilt = await rebuildBrowserTreeUnlocked(nextSettings);
        if (rebuilt.status !== 'ok') return rebuilt;
      }
      await setStoredStateChecked({ settings: nextSettings });
      return { status: 'ok', settings: nextSettings };
    }

    // 把浏览器侧新建/复用的目录节点 id 回填到本地 folders。
    // 一个 browserFolderId 只能被一个本地 folder 持有：浏览器侧可能残留历史同名目录，
    // findOrCreateFolderPath 按名称路径查找时会复用到它，从而让两个本地 folder 指向
    // 同一个浏览器节点；之后删除其中一个就会连带删掉另一个的浏览器目录。
    // 这里做唯一性收口——新绑定优先，旧持有者的绑定被清除，等下次同步按路径重建。
    function applyBrowserFolderBindings(folders, bindings = []) {
      const byFolderId = new Map(
        (Array.isArray(bindings) ? bindings : [])
          .filter((binding) => binding && binding.folderId && binding.browserFolderId)
          .map((binding) => [binding.folderId, String(binding.browserFolderId)])
      );
      if (!byFolderId.size) return folders;
      const claimedBrowserIds = new Set(byFolderId.values());
      return folders.map((folder) => {
        if (byFolderId.has(folder.id)) {
          return { ...folder, browserFolderId: byFolderId.get(folder.id) };
        }
        if (folder.browserFolderId && claimedBrowserIds.has(String(folder.browserFolderId))) {
          console.warn(
            'SmartFav detected a duplicated browserFolderId binding and released the stale one:',
            folder.id,
            folder.browserFolderId
          );
          const released = { ...folder };
          delete released.browserFolderId;
          return released;
        }
        return folder;
      });
    }

    function syncFavoritePaths(favorites, folders) {
      return favorites.map((favorite) => ({
        ...favorite,
        category: SmartFavFolderTree.getPathLabel(folders, favorite.folderId)
          || favorite.category
          || ''
      }));
    }

    async function rebuildBrowserTreeUnlocked(settingsOverride) {
      if (!chrome.bookmarks) return { status: 'unavailable', message: 'Browser bookmarks are unavailable' };
      const state = await getStoredState();
      const settings = { ...state.settings, ...settingsOverride, browserBookmarksEnabled: true };
      let folders = state.folders;
      let favorites = state.favorites;
      const orderedFolders = [...folders].sort((left, right) => (
        SmartFavFolderTree.getPath(folders, left.id).length
        - SmartFavFolderTree.getPath(folders, right.id).length
        || left.order - right.order
      ));
      try {
        for (const folder of orderedFolders) {
          const current = SmartFavFolderTree.getFolder(folders, folder.id);
          const result = await SmartFavBookmarks.syncFolderNode(
            current,
            folders,
            settings,
            getTrackedBookmarksApi()
          );
          if (result.status !== 'ok') throw new Error(result.message || result.status);
          folders = applyBrowserFolderBindings(folders, [
            ...(result.createdFolders || []),
            { folderId: folder.id, browserFolderId: result.browserFolderId }
          ]);
        }
        for (const favorite of favorites) {
          let browserBookmarkId = favorite.browserBookmarkId || '';
          let existing = false;
          if (browserBookmarkId) {
            try {
              const nodes = await new Promise((resolve, reject) => {
                chrome.bookmarks.get(browserBookmarkId, (result) => {
                  const runtimeError = chrome.runtime && chrome.runtime.lastError;
                  if (runtimeError) reject(new Error(runtimeError.message));
                  else resolve(result || []);
                });
              });
              existing = Boolean(nodes[0] && nodes[0].url === favorite.url);
            } catch (_error) {
              existing = false;
            }
          }
          const result = existing
            ? await SmartFavBookmarks.moveManagedFavoriteToFolder(
                favorite,
                folders,
                settings,
                getTrackedBookmarksApi()
              )
            : await SmartFavBookmarks.writeFavorite(
                favorite,
                settings,
                getTrackedBookmarksApi(),
                { folders }
              );
          if (!['ok', 'created', 'updated'].includes(result.status)) {
            throw new Error(result.message || result.status);
          }
          browserBookmarkId = result.id || browserBookmarkId;
          favorites = favorites.map((item) => item.id === favorite.id
            ? { ...item, browserBookmarkId }
            : item);
        }
        for (const [folderId, orderedFavoriteIds] of Object.entries(state.favoriteOrder)) {
          await SmartFavBookmarks.reorderManagedFavoriteRecords(
            folderId,
            orderedFavoriteIds,
            favorites,
            folders,
            settings,
            getTrackedBookmarksApi()
          );
        }
      } catch (error) {
        return { status: 'partial', message: error.message };
      }
      await setStoredStateChecked({ folders, favorites });
      return { status: 'ok', folders, favorites };
    }

    async function getFolderTree() {
      const state = await getStoredState();
      return {
        status: 'ok',
        folderSchemaVersion: state.folderSchemaVersion,
        folders: state.folders,
        favorites: state.favorites,
        favoriteOrder: state.favoriteOrder
      };
    }

    function createFolder(input) {
      return withBookmarkLayoutLock(async () => {
        const state = await getStoredState();
        const result = SmartFavFolderTree.createFolder(state.folders, input);
        if (result.status !== 'ok') return result;
        let folders = result.folders;
        let browserStatus = state.settings.browserBookmarksEnabled ? 'ok' : 'disabled';
        if (state.settings.browserBookmarksEnabled) {
          try {
            const browserResult = await SmartFavBookmarks.syncFolderNode(
              result.folder,
              folders,
              state.settings,
              getTrackedBookmarksApi()
            );
            browserStatus = browserResult.status;
            folders = applyBrowserFolderBindings(folders, [
              ...(browserResult.createdFolders || []),
              { folderId: result.folder.id, browserFolderId: browserResult.browserFolderId }
            ]);
          } catch (error) {
            return { status: 'unavailable', message: error.message };
          }
        }
        await setStoredStateChecked({ folders });
        return {
          status: 'ok',
          folder: folders.find((folder) => folder.id === result.folder.id),
          folders,
          browserStatus
        };
      });
    }

    function updateFolder(folderId, patch) {
      return withBookmarkLayoutLock(async () => {
        const state = await getStoredState();
        const result = SmartFavFolderTree.updateFolder(state.folders, folderId, patch);
        if (result.status !== 'ok') return result;
        let folders = result.folders;
        let browserStatus = state.settings.browserBookmarksEnabled ? 'ok' : 'disabled';
        if (state.settings.browserBookmarksEnabled) {
          try {
            const browserResult = await SmartFavBookmarks.syncFolderNode(
              result.folder,
              folders,
              state.settings,
              getTrackedBookmarksApi()
            );
            browserStatus = browserResult.status;
            folders = applyBrowserFolderBindings(folders, [
              ...(browserResult.createdFolders || []),
              { folderId: result.folder.id, browserFolderId: browserResult.browserFolderId }
            ]);
          } catch (error) {
            return { status: 'unavailable', message: error.message };
          }
        }
        const favorites = syncFavoritePaths(state.favorites, folders);
        await setStoredStateChecked({ folders, favorites });
        return {
          status: 'ok',
          folder: folders.find((folder) => folder.id === folderId),
          folders,
          favorites,
          browserStatus
        };
      });
    }

    function moveFolder(folderId, targetParentId, index) {
      return withBookmarkLayoutLock(async () => {
        const state = await getStoredState();
        const result = SmartFavFolderTree.moveFolder(
          state.folders,
          folderId,
          targetParentId,
          index
        );
        if (result.status !== 'ok') return result;
        let folders = result.folders;
        let browserMoved = false;
        if (state.settings.browserBookmarksEnabled) {
          try {
            const browserResult = await SmartFavBookmarks.moveFolderNode(
              result.folder,
              folders,
              state.settings,
              getTrackedBookmarksApi()
            );
            if (!['ok', 'disabled'].includes(browserResult.status)) return browserResult;
            browserMoved = browserResult.status === 'ok';
            folders = applyBrowserFolderBindings(folders, [
              ...(browserResult.createdFolders || []),
              { folderId, browserFolderId: browserResult.browserFolderId }
            ]);
          } catch (error) {
            return { status: 'unavailable', message: error.message };
          }
        }
        const favorites = syncFavoritePaths(state.favorites, folders);
        try {
          await setStoredStateChecked({ folders, favorites });
        } catch (error) {
          if (browserMoved) {
            try {
              const original = SmartFavFolderTree.getFolder(state.folders, folderId);
              await SmartFavBookmarks.moveFolderNode(
                original,
                state.folders,
                state.settings,
                getTrackedBookmarksApi()
              );
            } catch (compensationError) {
              return {
                status: 'partial',
                message: `${error.message}; compensation failed: ${compensationError.message}`
              };
            }
          }
          return { status: 'unavailable', message: error.message, compensated: browserMoved };
        }
        return { ...result, folders, favorites };
      });
    }

    // 删除文件夹并把内容迁移到 targetFolderId。
    // 顺序是「建还原点 → 写本地 → 同步浏览器」，与 moveFolder/moveFavorite 的补偿式写法不同，
    // 原因是删除涉及多步破坏性浏览器写入（逐条移动收藏、逐个改挂子目录、最后删目录节点），
    // 无法逐条可靠回滚。早期实现是「先改浏览器、全部成功才写本地」，任一步中途 return 时
    // 浏览器侧已完成的迁移不回滚、本地一个字节没改，树结构双边永久失配。
    // 现在以本地为准：本地一次性写完，浏览器失败降级为 partial，由下一次对账收敛。
    function deleteFolder(folderId, targetFolderId) {
      return withBookmarkLayoutLock(async () => {
        const state = await getStoredState();
        const current = SmartFavFolderTree.getFolder(state.folders, folderId);
        const result = SmartFavFolderTree.deleteFolder(
          state.folders,
          state.favorites,
          state.favoriteOrder,
          folderId,
          targetFolderId
        );
        if (result.status !== 'ok') return result;

        let restorePointId = '';
        if (state.settings.browserBookmarksEnabled) {
          try {
            const backup = await ensureBookmarkRestorePointUnlocked('delete-folder');
            restorePointId = backup && backup.point ? backup.point.id : '';
          } catch (error) {
            console.warn('SmartFav could not create a restore point before deleting a folder:', error);
          }
        }

        await setStoredStateChecked({
          folders: result.folders,
          favorites: result.favorites,
          favoriteOrder: result.favoriteOrder
        });

        let browserStatus = state.settings.browserBookmarksEnabled ? 'ok' : 'disabled';
        let browserMessage = '';
        if (state.settings.browserBookmarksEnabled) {
          try {
            const movedFavorites = result.favorites.filter((favorite) => (
              favorite.folderId === targetFolderId
              && state.favorites.some((previous) => previous.id === favorite.id && previous.folderId === folderId)
            ));
            for (const favorite of movedFavorites) {
              const browserResult = await SmartFavBookmarks.moveManagedFavoriteToFolder(
                favorite,
                result.folders,
                state.settings,
                getTrackedBookmarksApi()
              );
              if (!['ok', 'missing'].includes(browserResult.status)) {
                browserStatus = 'partial';
                browserMessage = browserResult.message || browserResult.status;
              }
            }
            const movedChildren = result.folders.filter((folder) => (
              folder.parentId === targetFolderId
              && state.folders.some((previous) => previous.id === folder.id && previous.parentId === folderId)
            ));
            for (const folder of movedChildren) {
              const browserResult = await SmartFavBookmarks.moveFolderNode(
                folder,
                result.folders,
                state.settings,
                getTrackedBookmarksApi()
              );
              if (browserResult.status !== 'ok') {
                browserStatus = 'partial';
                browserMessage = browserResult.message || browserResult.status;
              }
            }
            const removeResult = await SmartFavBookmarks.removeFolderNode(
              current,
              state.settings,
              getTrackedBookmarksApi()
            );
            // 'conflict' 表示浏览器目录里还有 SmartFav 不认识的书签（用户自己放进去的）。
            // 这是可接受结果：本地删除照常生效，浏览器侧留一个非空空壳目录，
            // 绝不能因此把整个删除判为失败——那会让本地与浏览器彻底分叉。
            if (!['ok', 'missing', 'conflict'].includes(removeResult.status)) {
              browserStatus = 'partial';
              browserMessage = removeResult.message || removeResult.status;
            }
          } catch (error) {
            browserStatus = 'partial';
            browserMessage = error && error.message ? error.message : String(error);
          }
        }

        return {
          ...result,
          browserStatus,
          message: browserMessage,
          recoveryAvailable: Boolean(restorePointId),
          restorePointId
        };
      });
    }

    function moveFavorite(favoriteId, targetFolderId, index) {
      return withBookmarkLayoutLock(async () => {
        const state = await getStoredState();
        const favorite = state.favorites.find((item) => item.id === favoriteId);
        const target = SmartFavFolderTree.getFolder(state.folders, targetFolderId);
        if (!favorite || !target) return { status: 'invalid', moved: 0 };
        if (favorite.folderId === target.id) return { status: 'ok', moved: 0, favorite };
        const movedFavorite = {
          ...favorite,
          folderId: target.id,
          category: SmartFavFolderTree.getPathLabel(state.folders, target.id),
          manuallyCategorized: true
        };
        let folders = state.folders;
        let browserMoved = false;
        if (state.settings.browserBookmarksEnabled) {
          try {
            const browserResult = await SmartFavBookmarks.moveManagedFavoriteToFolder(
              movedFavorite,
              state.folders,
              state.settings,
              getTrackedBookmarksApi()
            );
            if (!['ok', 'missing'].includes(browserResult.status)) return browserResult;
            browserMoved = browserResult.status === 'ok' && (browserResult.moved || 0) > 0;
            folders = applyBrowserFolderBindings(folders, [
              ...(browserResult.createdFolders || []),
              ...(browserResult.browserFolderId
                ? [{ folderId: target.id, browserFolderId: browserResult.browserFolderId }]
                : [])
            ]);
          } catch (error) {
            return { status: 'unavailable', message: error.message };
          }
        }
        const favorites = state.favorites.map((item) => item.id === favorite.id ? movedFavorite : item);
        const favoriteOrder = {};
        Object.entries(state.favoriteOrder).forEach(([folderKey, ids]) => {
          const filtered = (Array.isArray(ids) ? ids : []).filter((id) => id !== favorite.id);
          if (filtered.length) favoriteOrder[folderKey] = filtered;
        });
        const targetOrder = favoriteOrder[target.id] || [];
        const insertionIndex = Math.max(0, Math.min(targetOrder.length, Number.isFinite(Number(index))
          ? Number(index)
          : targetOrder.length));
        targetOrder.splice(insertionIndex, 0, favorite.id);
        favoriteOrder[target.id] = targetOrder;
        try {
          await setStoredStateChecked({ folders, favorites, favoriteOrder });
        } catch (error) {
          if (browserMoved) {
            try {
              await SmartFavBookmarks.moveManagedFavoriteToFolder(
                favorite,
                state.folders,
                state.settings,
                getTrackedBookmarksApi()
              );
            } catch (compensationError) {
              return {
                status: 'partial',
                message: `${error.message}; compensation failed: ${compensationError.message}`
              };
            }
          }
          return { status: 'unavailable', message: error.message, compensated: browserMoved };
        }
        return { status: 'ok', moved: 1, favorite: movedFavorite, favoriteOrder };
      });
    }

    function previewAIOrganization(rawOperations) {
      return withBookmarkLayoutLock(async () => {
        const state = await getStoredState();
        const validated = SmartFavAIOrganization.validateOperations(
          rawOperations,
          state.folders,
          state.favorites,
          SmartFavFolderTree
        );
        if (!validated.operations.length) {
          return { status: 'invalid', operations: [], rejected: validated.rejected };
        }
        const displayOperations = validated.operations.map((operation) => {
          if (operation.type !== 'move_favorite') return operation;
          const favorite = state.favorites.find((item) => item.id === operation.favoriteId);
          return {
            ...operation,
            favoriteTitle: favorite ? favorite.title || favorite.url : operation.favoriteId
          };
        });
        const createdAt = Date.now();
        const proposal = {
          id: SmartFavFolderTree.createId('proposal'),
          createdAt,
          expiresAt: createdAt + 30 * 60 * 1000,
          operations: displayOperations
        };
        const previews = [
          proposal,
          ...(state.aiOrganizationPreviews || []).filter((item) => (
            item && Number(item.expiresAt) > createdAt
          ))
        ].slice(0, 3);
        await setStoredStateChecked({ aiOrganizationPreviews: previews });
        return {
          status: validated.rejected.length ? 'partial' : 'ok',
          proposalId: proposal.id,
          operations: proposal.operations,
          rejected: validated.rejected
        };
      });
    }

    function applyAIOrganization(proposalId, operationIds) {
      return withBookmarkLayoutLock(async () => {
        const state = await getStoredState();
        const proposal = (state.aiOrganizationPreviews || []).find((item) => (
          item && item.id === String(proposalId || '') && Number(item.expiresAt) > Date.now()
        ));
        if (!proposal) return { status: 'invalid', message: 'AI proposal is missing or expired' };
        const revalidated = SmartFavAIOrganization.validateOperations(
          proposal.operations,
          state.folders,
          state.favorites,
          SmartFavFolderTree
        );
        const selectedIds = new Set(Array.isArray(operationIds) ? operationIds.map(String) : []);
        const selected = revalidated.operations.filter((operation) => selectedIds.has(operation.id));
        if (!selected.length) return { status: 'invalid', message: 'No AI operations selected' };

        let restorePoint = null;
        if (chrome.bookmarks) {
          try {
            const backupResult = await ensureBookmarkRestorePointUnlocked('ai-organize');
            restorePoint = backupResult.summary;
          } catch (error) {
            return { status: 'unavailable', message: error.message };
          }
        }

        let folders = state.folders;
        let favorites = state.favorites;
        let favoriteOrder = Object.fromEntries(
          Object.entries(state.favoriteOrder).map(([folderId, ids]) => [
            folderId,
            Array.isArray(ids) ? [...ids] : []
          ])
        );
        const temporaryIds = new Map();
        const createdFolderIds = [];
        const movedFavoriteIds = [];
        const updatedFolderIds = [];

        for (const operation of selected) {
          if (operation.type === 'create_folder') {
            const parentId = temporaryIds.get(operation.parentId) || operation.parentId || null;
            const result = SmartFavFolderTree.createFolder(folders, {
              parentId,
              name: operation.name,
              keywords: operation.keywords,
              source: 'ai'
            });
            if (result.status !== 'ok') {
              return { status: 'partial', message: result.message, restorePoint, applied: createdFolderIds.length + movedFavoriteIds.length + updatedFolderIds.length };
            }
            folders = result.folders;
            temporaryIds.set(operation.temporaryId, result.folder.id);
            createdFolderIds.push(result.folder.id);
            continue;
          }
          if (operation.type === 'add_keywords') {
            const folderId = temporaryIds.get(operation.folderId) || operation.folderId;
            const folder = SmartFavFolderTree.getFolder(folders, folderId);
            const result = SmartFavFolderTree.updateFolder(folders, folderId, {
              keywords: [...(folder ? folder.keywords : []), ...operation.keywords]
            });
            if (result.status !== 'ok') {
              return { status: 'partial', message: result.message, restorePoint, applied: createdFolderIds.length + movedFavoriteIds.length + updatedFolderIds.length };
            }
            folders = result.folders;
            updatedFolderIds.push(folderId);
            continue;
          }
          const targetFolderId = temporaryIds.get(operation.targetFolderId) || operation.targetFolderId;
          if (!SmartFavFolderTree.getFolder(folders, targetFolderId)) {
            return { status: 'partial', message: 'Unknown target folder', restorePoint, applied: createdFolderIds.length + movedFavoriteIds.length + updatedFolderIds.length };
          }
          favorites = favorites.map((favorite) => favorite.id === operation.favoriteId
            ? {
                ...favorite,
                folderId: targetFolderId,
                category: SmartFavFolderTree.getPathLabel(folders, targetFolderId),
                classificationSource: 'ai'
              }
            : favorite);
          Object.keys(favoriteOrder).forEach((folderId) => {
            favoriteOrder[folderId] = (favoriteOrder[folderId] || []).filter((id) => id !== operation.favoriteId);
          });
          favoriteOrder[targetFolderId] = [
            ...(favoriteOrder[targetFolderId] || []),
            operation.favoriteId
          ];
          movedFavoriteIds.push(operation.favoriteId);
        }

        if (state.settings.browserBookmarksEnabled) {
          try {
            for (const folderId of createdFolderIds) {
              const folder = SmartFavFolderTree.getFolder(folders, folderId);
              const browserResult = await SmartFavBookmarks.syncFolderNode(
                folder,
                folders,
                state.settings,
                getTrackedBookmarksApi()
              );
              if (browserResult.status !== 'ok') throw new Error(browserResult.message || browserResult.status);
              folders = applyBrowserFolderBindings(folders, [
                ...(browserResult.createdFolders || []),
                { folderId, browserFolderId: browserResult.browserFolderId }
              ]);
            }
            for (const favoriteId of movedFavoriteIds) {
              const favorite = favorites.find((item) => item.id === favoriteId);
              const browserResult = await SmartFavBookmarks.moveManagedFavoriteToFolder(
                favorite,
                folders,
                state.settings,
                getTrackedBookmarksApi()
              );
              if (!['ok', 'missing'].includes(browserResult.status)) {
                throw new Error(browserResult.message || browserResult.status);
              }
            }
          } catch (error) {
            return {
              status: 'partial',
              message: error.message,
              restorePoint,
              applied: 0,
              recoveryAvailable: Boolean(restorePoint)
            };
          }
        }

        favorites = syncFavoritePaths(favorites, folders);
        const remainingPreviews = (state.aiOrganizationPreviews || [])
          .filter((item) => item.id !== proposal.id && Number(item.expiresAt) > Date.now());
        await setStoredStateChecked({
          folders,
          favorites,
          favoriteOrder,
          aiOrganizationPreviews: remainingPreviews
        });
        return {
          status: 'ok',
          applied: selected.length,
          createdFolders: createdFolderIds.length,
          movedFavorites: movedFavoriteIds.length,
          updatedFolders: updatedFolderIds.length,
          restorePoint
        };
      });
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
      const { settings, folders, favorites } = await getStoredState();
      let updated = 0;
      const reclassifiedAt = Date.now();
      const nextFavorites = favorites.map((favorite) => {
        const suggestion = SmartFavClassifier.classifyFolders({
          title: favorite.title || favorite.url,
          url: favorite.url,
          description: favorite.description || '',
          keywords: favorite.keywords || []
        }, settings, folders);
        const next = {
          ...favorite,
          category: suggestion.category,
          folderId: suggestion.folderId,
          tags: suggestion.tags,
          summary: suggestion.summary,
          classificationSource: 'local',
          reclassifiedAt
        };
        if (
          favorite.folderId !== next.folderId
          || favorite.category !== next.category
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
        const browserResult = await SmartFavBookmarks.syncManagedFolders(
          nextFavorites,
          folders,
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
        const { settings, folders, favorites } = await getStoredState();
        if (order && order.folderId && Array.isArray(order.orderedFavoriteIds)) {
          return SmartFavBookmarks.reorderManagedFavoriteRecords(
            order.folderId,
            order.orderedFavoriteIds,
            favorites,
            folders,
            settings,
            getTrackedBookmarksApi()
          );
        }
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
      const { settings, folders, favorites, favoriteOrder } = await getStoredState();
      if (!chrome.bookmarks) return { status: 'unavailable' };
      let restorePoint = null;
      if (settings.bookmarkOrganizeEnabled) {
        const backup = await ensureBookmarkRestorePointUnlocked('organize');
        restorePoint = backup.summary;
      }

      const result = await SmartFavBookmarks.organizeBookmarks(
        settings,
        getTrackedBookmarksApi(),
        (tabInfo, currentSettings) => SmartFavClassifier.classifyFolders(
          tabInfo,
          currentSettings,
          folders
        ),
        { folders }
      );
      if (result.status !== 'ok') return result;

      const existingByUrl = new Map(favorites.map((item) => [item.url, item]));
      const additions = [];
      const updatesByUrl = new Map();
      const seenUrls = new Set();
      result.favorites.forEach(({ bookmarkId, ...classified }) => {
        if (settings.bookmarkWriteMode !== 'add' && seenUrls.has(classified.url)) return;
        seenUrls.add(classified.url);
        const existing = settings.bookmarkWriteMode === 'add'
          ? null
          : existingByUrl.get(classified.url);
        if (!existing) {
          additions.push({
            ...classified,
            id: SmartFavFolderTree.createId('fav'),
            folderId: classified.folderId,
            browserBookmarkId: bookmarkId
          });
          return;
        }
        const updated = {
          ...existing,
          title: classified.title || existing.title,
          category: classified.category,
          folderId: classified.folderId,
          browserBookmarkId: bookmarkId,
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
        // 批量整理导入的收藏同样要进 favoriteOrder，按目录分组逐个折叠。
        const nextOrder = additions.reduce((order, addition) => applyOrderPatch(order, {
          insert: [addition.id],
          folderId: addition.folderId || ''
        }), favoriteOrder);
        await setStoredState({
          favorites: [
            ...additions,
            ...favorites.map((item) => updatesByUrl.get(item.url) || item)
          ],
          favoriteOrder: nextOrder
        });
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
      if (!node) return;
      if (!node.url) {
        if (chrome.bookmarks && await SmartFavBookmarks.isInsideSmartFavFolder(chrome.bookmarks, node)) {
          await handleBookmarkTreeChanged();
        }
        return;
      }
      const { settings, folders, favorites, favoriteOrder, recentlyDeleted } = await getStoredState();
      const shouldCapture = Boolean(settings.bookmarkAutoCaptureEnabled);
      const shouldOrganize = Boolean(settings.bookmarkOrganizeEnabled);
      if (!shouldCapture && !shouldOrganize) return;
      if (!chrome.bookmarks) return;
      if (await SmartFavBookmarks.isInsideSmartFavFolder(chrome.bookmarks, node)) return;

      const suggestion = SmartFavClassifier.classifyFolders(
        { title: node.title || node.url, url: node.url, description: '' },
        settings,
        folders
      );
      const favorite = {
        id: SmartFavFolderTree.createId('fav'),
        folderId: suggestion.folderId,
        browserBookmarkId: id,
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
        const replaced = settings.bookmarkWriteMode === 'add'
          ? []
          : favorites.filter((item) => item.url === favorite.url);
        await setStoredState({
          favorites: [
            favorite,
            ...(settings.bookmarkWriteMode === 'add'
              ? favorites
              : favorites.filter((item) => item.url !== favorite.url))
          ],
          // 自动采集的收藏同样要进 favoriteOrder，否则它在排序视图里没有确定位置。
          favoriteOrder: applyOrderPatch(favoriteOrder, {
            remove: replaced.map((item) => item.id),
            insert: [favorite.id],
            folderId: favorite.folderId || '',
            position: 'start'
          }),
          recentlyDeleted: recentlyDeleted.filter((item) => item.url !== favorite.url)
        });
      }

      if (shouldOrganize) {
        // handleBookmarkCreated 的整个读改写过程已经由监听器放入布局锁，
        // 这里不能再次获取同一把锁，否则 Promise 链会互相等待。
        // 新增星标属于一次浏览器布局变更，必须先把当前外部书签
        // （包括刚创建的这条）补进活动还原点。
        await ensureBookmarkRestorePointUnlocked('auto-capture');
        await SmartFavBookmarks.placeBookmarkInFolder(
          getTrackedBookmarksApi(),
          id,
          suggestion.folderId,
          folders
        );
        if (settings.bookmarkWriteMode !== 'add' && shouldCapture) {
          // 去重会永久删除同网址的其他书签。只在「自动采集」开启时才做：
          // 那时本地已有这条收藏的记录，删除是可追溯的。
          // 只开「整理」时 SmartFav 不接管这条书签（本地无任何记录），
          // 此时删除用户的其他副本既无记录也无从恢复，因此跳过。
          await SmartFavBookmarks.deduplicateManagedUrl(
            getTrackedBookmarksApi(),
            favorite.url,
            id
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
      const { settings, favorites } = await getStoredState();
      const shouldSyncMove = Boolean(
        settings.browserBookmarksEnabled || settings.bookmarkAutoCaptureEnabled
      );
      if (!shouldSyncMove) return;
      let previous = favorites.find((favorite) => (
        String(favorite.browserBookmarkId || '') === String(id)
      ));
      if (!previous) {
        try {
          const nodes = await new Promise((resolve, reject) => {
            chrome.bookmarks.get(id, (result) => {
              const runtimeError = chrome.runtime && chrome.runtime.lastError;
              if (runtimeError) reject(new Error(runtimeError.message));
              else resolve(result || []);
            });
          });
          const movedNode = nodes[0];
          if (movedNode && movedNode.url) {
            previous = favorites.find((favorite) => favorite.url === movedNode.url);
          }
        } catch (_error) {
          previous = null;
        }
      }
      const result = await recoverManagedFavoritesUnlocked();
      const current = result.favorites.find((favorite) => (
        String(favorite.browserBookmarkId || '') === String(id)
      ));
      if (!previous || !current || previous.folderId === current.folderId) return;
      const activity = createBrowserActivity('moved', {
        title: current.title || current.url,
        url: current.url,
        category: current.category,
        previousCategory: previous.category
      });
      await setStoredStateChecked({ pendingBrowserActivity: activity });
    }

    async function handleBookmarkTreeChanged() {
      if (!chrome.bookmarks) return;
      const { settings } = await getStoredState();
      if (!settings.browserBookmarksEnabled && !settings.bookmarkAutoCaptureEnabled) return;
      await recoverManagedFavoritesUnlocked();
    }

    async function handleBookmarkRemoved(id, removeInfo) {
      if (await consumeInternalBookmarkRemoval(id)) return;
      const removedUrls = [...collectRemovedUrls(removeInfo && removeInfo.node)];
      const removedNodeIds = collectRemovedNodeIds(removeInfo && removeInfo.node);
      // 用户删掉了 SmartFav 受管根目录：需要把所有本地绑定解开，等下次同步重建。
      // 但仅凭标题相同就全量解绑是危险的——用户在书签栏任意位置手建一个同样叫
      // "SmartFav" 的文件夹再删掉，就会误清全部绑定，再次同步还会重建出整棵重复目录。
      // 因此要求「这次删除的子树里确实包含我们记录过的节点 id」才认定是受管根；
      // 同名但与 SmartFav 无关的目录会继续走下面的常规删除同步。
      if (
        removeInfo
        && removeInfo.node
        && !removeInfo.node.url
        && removeInfo.node.title === SmartFavBookmarks.ROOT_FOLDER_TITLE
      ) {
        const state = await getStoredState();
        const containsTrackedNode = state.favorites.some((favorite) => (
          favorite.browserBookmarkId
          && removedNodeIds.bookmarks.has(String(favorite.browserBookmarkId))
        )) || state.folders.some((folder) => (
          folder.browserFolderId
          && removedNodeIds.folders.has(String(folder.browserFolderId))
        ));
        if (containsTrackedNode) {
          await setStoredStateChecked({
            folders: state.folders.map(({ browserFolderId: _browserFolderId, ...folder }) => folder),
            favorites: state.favorites.map(({ browserBookmarkId: _browserBookmarkId, ...favorite }) => favorite)
          });
          return;
        }
        // 同名但与 SmartFav 无关的目录：不做任何全量处理，继续走下面的常规删除同步。
      }
      if ((!removedUrls.length && !removedNodeIds.folders.size) || !chrome.bookmarks) return;

      const { settings, folders, favorites, favoriteOrder, recentlyDeleted } = await getStoredState();
      const shouldSyncDeletion = Boolean(
        settings.browserBookmarksEnabled || settings.bookmarkAutoCaptureEnabled
      );
      if (!shouldSyncDeletion || !favorites.length) return;

      const favoriteIdsToTrash = new Set(
        favorites
          .filter((favorite) => removedNodeIds.bookmarks.has(String(favorite.browserBookmarkId || '')))
          .map((favorite) => favorite.id)
      );
      for (const url of removedUrls) {
        if (!favorites.some((favorite) => favorite.url === url && !favorite.browserBookmarkId)) continue;
        const remainingMatches = await SmartFavBookmarks.findUrlMatches(chrome.bookmarks, url);
        if (!remainingMatches.length) {
          favorites
            .filter((favorite) => favorite.url === url && !favorite.browserBookmarkId)
            .forEach((favorite) => favoriteIdsToTrash.add(favorite.id));
        }
      }
      const removedFavorites = favorites.filter((favorite) => favoriteIdsToTrash.has(favorite.id));
      const removedFolderIds = new Set(
        folders
          .filter((folder) => removedNodeIds.folders.has(String(folder.browserFolderId || '')))
          .map((folder) => folder.id)
      );
      [...removedFolderIds].forEach((folderId) => {
        SmartFavFolderTree.getDescendantIds(folders, folderId)
          .forEach((descendantId) => removedFolderIds.add(descendantId));
      });
      favorites
        .filter((favorite) => removedFolderIds.has(favorite.folderId))
        .forEach((favorite) => favoriteIdsToTrash.add(favorite.id));
      if (!removedFavorites.length && !removedFolderIds.size) return;
      const allRemovedFavorites = favorites.filter((favorite) => favoriteIdsToTrash.has(favorite.id));
      const now = Date.now();
      const activity = createBrowserActivity('trashed', {
        title: allRemovedFavorites[0]
          ? allRemovedFavorites[0].title || allRemovedFavorites[0].url
          : '',
        url: allRemovedFavorites[0] ? allRemovedFavorites[0].url : '',
        count: allRemovedFavorites.length
      });
      await setStoredState({
        folders: folders.filter((folder) => !removedFolderIds.has(folder.id)),
        favorites: favorites.filter((favorite) => !favoriteIdsToTrash.has(favorite.id)),
        favoriteOrder: Object.fromEntries(
          Object.entries(favoriteOrder)
            .filter(([folderId]) => !removedFolderIds.has(folderId))
            .map(([folderId, ids]) => [
              folderId,
              (Array.isArray(ids) ? ids : []).filter((favoriteId) => !favoriteIdsToTrash.has(favoriteId))
            ])
        ),
        recentlyDeleted: [
          ...allRemovedFavorites.map((favorite, index) => createTrashEntry(favorite, now + index)),
          ...recentlyDeleted.filter((item) => !favoriteIdsToTrash.has(item.id))
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
      getFolderTree,
      createFolder,
      updateFolder,
      moveFolder,
      deleteFolder,
      moveFavorite,
      previewAIOrganization,
      applyAIOrganization,
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
      handleBookmarkTreeChanged,
      handleBookmarkRemoved
    });
  }

  const api = { createFavoritesService };
  globalScope.SmartFavFavoritesService = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
