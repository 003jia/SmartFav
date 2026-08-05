// SmartFav Background - 生命周期、浏览器事件与消息传输层
importScripts(
  'constants.js',
  'folder-tree.js',
  'state-store.js',
  'bookmark-guard.js',
  'bookmark-events.js',
  'classifier.js',
  'ai-organization.js',
  'browser-bookmarks.js',
  'bookmark-backup.js',
  'order-utils.js',
  'i18n.js',
  'favorites-service.js'
);

const { setStoredStateChecked } = SmartFavStateStore;
const bookmarkGuard = SmartFavBookmarkGuard.createBookmarkGuard({ chrome });
const favoritesService = SmartFavFavoritesService.createFavoritesService({
  chrome, stateStore: SmartFavStateStore, bookmarkGuard,
  classifier: SmartFavClassifier, bookmarks: SmartFavBookmarks,
  backup: SmartFavBackup, order: SmartFavOrder, i18n: SmartFavI18n,
  constants: SmartFavConstants, folderTree: SmartFavFolderTree,
  aiOrganization: SmartFavAIOrganization
});
const TRASH_CLEANUP_ALARM = 'smartfav-trash-cleanup';

function scheduleTrashCleanup() {
  if (!chrome.alarms || typeof chrome.alarms.create !== 'function') return;
  chrome.alarms.create(TRASH_CLEANUP_ALARM, {
    delayInMinutes: 1,
    periodInMinutes: 60
  });
}

function createDefaultSettings(language) {
  // 保留 1.14.3 首次安装默认词表；重构只搬迁代码，不扩大默认分类行为。
  const localizedDefaults = language === 'zh_CN'
    ? {
        categories: ['视频', '编程', '工具', '学习', '资讯', '其他'],
        keywordRules: {
          视频: ['视频', '直播', '电影', '影视', '弹幕', 'bilibili', 'youtube'],
          编程: ['编程', '代码', '开发', 'github', 'gitlab', 'javascript', 'python'],
          工具: ['工具', '效率', '转换', '下载', '插件', '扩展'],
          学习: ['学习', '教程', '课程', '文档', '知识', '教育'],
          资讯: ['新闻', '资讯', '报道', '头条', '快讯'],
          其他: []
        }
      }
    : {
        categories: ['Video', 'Programming', 'Tools', 'Learning', 'News', 'Other'],
        keywordRules: {
          Video: ['video', 'movie', 'stream', 'bilibili', 'youtube'],
          Programming: ['programming', 'coding', 'github', 'javascript', 'python'],
          Tools: ['tool', 'utility', 'converter', 'download', 'extension'],
          Learning: ['learning', 'tutorial', 'course', 'docs', 'education'],
          News: ['news', 'article', 'report', 'headline'],
          Other: []
        }
      };
  return {
    language,
    themeStyle: 'glass',
    colorMode: 'light',
    popupWidth: 360,
    popupHeight: 560,
    customBackgroundImage: '',
    customBackgroundPositionX: 50,
    customBackgroundPositionY: 50,
    aiEnabled: false,
    aiAutoClassify: true,
    aiCreateCategories: false,
    classificationMode: 'weighted',
    classificationWeights: SmartFavClassifier.DEFAULT_WEIGHTS,
    apiProvider: 'ollama',
    apiEndpoint: '',
    apiKey: '',
    model: 'qwen2.5:3b',
    browserBookmarksEnabled: false,
    bookmarkWriteMode: 'overwrite',
    bookmarkOrganizeEnabled: false,
    bookmarkAutoCaptureEnabled: false,
    categories: localizedDefaults.categories,
    keywordRules: localizedDefaults.keywordRules
  };
}

chrome.runtime.onInstalled.addListener((details) => {
  scheduleTrashCleanup();
  if (details.reason !== 'install') return;
  const language = chrome.i18n.getUILanguage().toLowerCase().startsWith('zh')
    ? 'zh_CN'
    : 'en';
  setStoredStateChecked({
    folderSchemaVersion: SmartFavFolderTree.SCHEMA_VERSION,
    folderMigrationBackup: null,
    folders: [],
    settings: createDefaultSettings(language),
    favorites: [],
    favoriteOrder: {},
    recentlyDeleted: [],
    bookmarkRestorePoints: [],
    aiOrganizationPreviews: [],
    pendingBrowserActivity: null
  })
    .then(() => console.log('SmartFav 已安装'))
    .catch((error) => console.error('SmartFav initialization failed:', error));
});

SmartFavBookmarkEvents.attach({ chrome, favoritesService, bookmarkGuard });

if (chrome.runtime.onStartup && typeof chrome.runtime.onStartup.addListener === 'function') {
  chrome.runtime.onStartup.addListener(() => {
    scheduleTrashCleanup();
    favoritesService.cleanupRecentlyDeleted().catch((error) => {
      console.error('SmartFav trash cleanup failed:', error);
    });
    favoritesService.recoverManagedFavorites().catch((error) => {
      console.error('SmartFav startup bookmark reconciliation failed:', error);
    });
  });
}

if (chrome.alarms && chrome.alarms.onAlarm) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (!alarm || alarm.name !== TRASH_CLEANUP_ALARM) return;
    favoritesService.cleanupRecentlyDeleted().catch((error) => {
      console.error('SmartFav trash cleanup failed:', error);
    });
  });
}

scheduleTrashCleanup();

function readFavoritesFallback() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['favorites'], (result) => {
      const runtimeError = chrome.runtime && chrome.runtime.lastError;
      if (runtimeError || !result) {
        resolve([]);
        return;
      }
      resolve(Array.isArray(result.favorites) ? result.favorites : []);
    });
  });
}

const MESSAGE_ROUTES = Object.freeze({
  recoverManagedFavorites: { handle: () => favoritesService.recoverManagedFavorites() },
  getFavorites: {
    responseShape: 'raw',
    handle: async () => {
      try {
        const result = await favoritesService.recoverManagedFavorites();
        return result.favorites || [];
      } catch (_error) {
        return readFavoritesFallback();
      }
    }
  },
  deleteFavorite: {
    handle: (message) => favoritesService.deleteFavorite(message.favoriteId || message.url)
  },
  getRecentlyDeleted: { handle: () => favoritesService.getRecentlyDeleted() },
  restoreDeletedFavorite: {
    handle: (message) => favoritesService.restoreDeletedFavorite(message.trashId)
  },
  permanentlyDeleteFavorite: {
    handle: (message) => favoritesService.permanentlyDeleteFavorite(message.trashId)
  },
  cleanupRecentlyDeleted: { handle: () => favoritesService.cleanupRecentlyDeleted() },
  reclassifyFavorites: { handle: () => favoritesService.reclassifyFavorites() },
  syncManagedOrder: {
    handle: (message) => favoritesService.syncManagedOrder(message.order)
  },
  moveFavoriteToCategory: {
    handle: (message) => (
      favoritesService.moveFavoriteToCategory(message.url, message.targetCategory)
    )
  },
  updateSettings: {
    handle: (message) => favoritesService.updateSettings(message.patch)
  },
  getFolderTree: { handle: () => favoritesService.getFolderTree() },
  createFolder: { handle: (message) => favoritesService.createFolder(message.folder) },
  updateFolder: {
    handle: (message) => favoritesService.updateFolder(message.folderId, message.patch)
  },
  moveFolder: {
    handle: (message) => (
      favoritesService.moveFolder(message.folderId, message.targetParentId, message.index)
    )
  },
  deleteFolder: {
    handle: (message) => favoritesService.deleteFolder(message.folderId, message.targetFolderId)
  },
  moveFavorite: {
    handle: (message) => (
      favoritesService.moveFavorite(message.favoriteId, message.targetFolderId, message.index)
    )
  },
  previewAIOrganization: {
    handle: (message) => favoritesService.previewAIOrganization(message.operations)
  },
  applyAIOrganization: {
    handle: (message) => (
      favoritesService.applyAIOrganization(message.proposalId, message.operationIds)
    )
  },
  updateFavoriteOrder: {
    handle: (message) => (
      favoritesService.updateFavoriteOrder(
        message.folderId || message.category,
        message.orderedFavoriteIds || message.orderedUrls
      )
    )
  },
  consumePendingBrowserActivity: {
    handle: (message) => (
      favoritesService.consumePendingBrowserActivity(message.activityId)
    )
  },
  saveFavorite: {
    handle: (message) => (
      favoritesService.saveFavoriteEntry(message.favorite, message.settingsPatch)
    )
  },
  getBookmarkRestorePoints: {
    handle: () => favoritesService.getBookmarkRestorePointState()
  },
  createBookmarkRestorePoint: {
    handle: () => favoritesService.createBookmarkRestorePoint()
  },
  previewBookmarkRestore: {
    handle: (message) => favoritesService.previewBookmarkRestore(message.pointId)
  },
  restoreBookmarkLayout: {
    handle: (message) => favoritesService.restoreBookmarkLayout(message.pointId)
  },
  exportBookmarkRestorePoints: {
    handle: () => favoritesService.exportBookmarkRestorePoints()
  },
  importBookmarkRestorePoints: {
    handle: (message) => favoritesService.importBookmarkRestorePoints(message.payload)
  },
  organizeBookmarks: { handle: () => favoritesService.organizeBrowserBookmarks() }
});

function routeMessage(route, message, sendResponse) {
  Promise.resolve()
    .then(() => route.handle(message))
    .catch((error) => (
      route.responseShape === 'raw'
        ? []
        : {
            status: 'error',
            message: error && error.message ? error.message : String(error)
          }
    ))
    .then(sendResponse);
  return true;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message && typeof message.type === 'string' ? message.type : '';
  if (!Object.prototype.hasOwnProperty.call(MESSAGE_ROUTES, type)) return false;
  return routeMessage(MESSAGE_ROUTES[type], message, sendResponse);
});
