// SmartFav Background - 后台脚本
importScripts(
  'constants.js',
  'classifier.js',
  'browser-bookmarks.js',
  'bookmark-backup.js',
  'order-utils.js',
  'i18n.js'
);

const {
  TRASH_RETENTION_MS,
  BROWSER_ACTIVITY_TTL_MS,
  INTERNAL_REMOVE_TTL_MS,
  getTrashExpireAt
} = SmartFavConstants;
const TRASH_CLEANUP_ALARM = 'smartfav-trash-cleanup';
const internallyRemovedBookmarkIds = new Map();
const internallyMovedBookmarkIds = new Map();
// 注意：以下两条队列依赖同一 service worker 实例内的 Promise 链，
// worker 被回收后队列会重置。队列内的任务本身满足"失败即中止、不留半状态"，
// 因此重置只会丢弃尚未开始的任务，不会留下半完成的书签结构。
let bookmarkEventQueue = Promise.resolve();
let bookmarkLayoutQueue = Promise.resolve();

const INTERNAL_REMOVE_KEY = 'internalBookmarkRemovals';
const INTERNAL_MOVE_KEY = 'internalBookmarkMoves';

// MV3 的 service worker 空闲即被回收，纯内存标记会随之丢失，
// 导致 SmartFav 自己发起的书签写入在 worker 重启后被误判为"用户在浏览器侧操作"。
// 因此以 chrome.storage.session（随浏览器会话存活）作为权威来源，内存 Map 仅作一级缓存。
function getSessionArea() {
  const storage = chrome.storage;
  if (!storage || !storage.session) return null;
  return typeof storage.session.get === 'function' ? storage.session : null;
}

function readSessionMarks(key, cache) {
  const area = getSessionArea();
  if (!area) return Promise.resolve(cache);
  return new Promise((resolve) => {
    area.get([key], (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
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
    // 读取 lastError 避免未处理警告；会话标记丢失只会退化为内存态，不阻断主流程。
    void (chrome.runtime && chrome.runtime.lastError);
  });
}

function pruneInternalBookmarkRemovals(now = Date.now()) {
  internallyRemovedBookmarkIds.forEach((expiresAt, id) => {
    if (expiresAt <= now) internallyRemovedBookmarkIds.delete(id);
  });
}

function markInternalBookmarkRemoval(id) {
  pruneInternalBookmarkRemovals();
  internallyRemovedBookmarkIds.set(String(id), Date.now() + INTERNAL_REMOVE_TTL_MS);
  writeSessionMarks(INTERNAL_REMOVE_KEY, internallyRemovedBookmarkIds);
}

async function consumeInternalBookmarkRemoval(id) {
  await readSessionMarks(INTERNAL_REMOVE_KEY, internallyRemovedBookmarkIds);
  pruneInternalBookmarkRemovals();
  const normalizedId = String(id);
  const wasInternal = internallyRemovedBookmarkIds.has(normalizedId);
  internallyRemovedBookmarkIds.delete(normalizedId);
  if (wasInternal) writeSessionMarks(INTERNAL_REMOVE_KEY, internallyRemovedBookmarkIds);
  return wasInternal;
}

function pruneInternalBookmarkMoves(now = Date.now()) {
  internallyMovedBookmarkIds.forEach((expiresAt, id) => {
    if (expiresAt <= now) internallyMovedBookmarkIds.delete(id);
  });
}

function markInternalBookmarkMove(id) {
  pruneInternalBookmarkMoves();
  internallyMovedBookmarkIds.set(String(id), Date.now() + INTERNAL_REMOVE_TTL_MS);
  writeSessionMarks(INTERNAL_MOVE_KEY, internallyMovedBookmarkIds);
}

async function consumeInternalBookmarkMove(id) {
  await readSessionMarks(INTERNAL_MOVE_KEY, internallyMovedBookmarkIds);
  pruneInternalBookmarkMoves();
  const normalizedId = String(id);
  const wasInternal = internallyMovedBookmarkIds.has(normalizedId);
  internallyMovedBookmarkIds.delete(normalizedId);
  if (wasInternal) writeSessionMarks(INTERNAL_MOVE_KEY, internallyMovedBookmarkIds);
  return wasInternal;
}

// browser-bookmarks.js 在覆盖同网址或同步删除时会调用 bookmarks.remove。
// 先标记这些 ID，避免 onRemoved / onMoved 把 SmartFav 自己的写操作当成用户操作。
function getTrackedBookmarksApi() {
  if (!chrome.bookmarks) return null;
  return new Proxy(chrome.bookmarks, {
    get(target, property) {
      if (property === 'remove') {
        return (id, callback) => {
          markInternalBookmarkRemoval(id);
          return target.remove(id, (...args) => {
            if (chrome.runtime && chrome.runtime.lastError) {
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
            if (chrome.runtime && chrome.runtime.lastError) {
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
      console.error(`SmartFav ${label} failed:`, error);
    });
}

function withBookmarkLayoutLock(task) {
  const run = bookmarkLayoutQueue.then(task, task);
  bookmarkLayoutQueue = run.catch(() => {});
  return run;
}

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

function scheduleTrashCleanup() {
  if (!chrome.alarms || typeof chrome.alarms.create !== 'function') return;
  chrome.alarms.create(TRASH_CLEANUP_ALARM, {
    delayInMinutes: 1,
    periodInMinutes: 60
  });
}

// 监听安装事件
chrome.runtime.onInstalled.addListener((details) => {
  scheduleTrashCleanup();
  if (details.reason === 'install') {
    const language = chrome.i18n.getUILanguage().toLowerCase().startsWith('zh')
      ? 'zh_CN'
      : 'en';
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
    // 初始化默认设置
    const defaultSettings = {
      language,
      themeStyle: 'glass',
      colorMode: 'light',
      popupWidth: 360,
      popupHeight: 560,
      customBackgroundImage: '',
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
    
    chrome.storage.local.set({
      settings: defaultSettings,
      favorites: [],
      favoriteOrder: {},
      recentlyDeleted: [],
      bookmarkRestorePoints: [],
      pendingBrowserActivity: null
    });
    
    console.log('SmartFav 已安装');
  }
});

function getStoredState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      [
        'settings',
        'favorites',
        'favoriteOrder',
        'recentlyDeleted',
        'bookmarkRestorePoints',
        'pendingBrowserActivity'
      ],
      (result) => {
        resolve({
          settings: result.settings || {},
          favorites: Array.isArray(result.favorites) ? result.favorites : [],
          favoriteOrder: result.favoriteOrder
            && typeof result.favoriteOrder === 'object'
            && !Array.isArray(result.favoriteOrder)
            ? result.favoriteOrder
            : {},
          recentlyDeleted: Array.isArray(result.recentlyDeleted) ? result.recentlyDeleted : [],
          bookmarkRestorePoints: Array.isArray(result.bookmarkRestorePoints)
            ? result.bookmarkRestorePoints
            : [],
          pendingBrowserActivity: result.pendingBrowserActivity || null
        });
      }
    );
  });
}

// 所有写入都必须检查 lastError：storage.local 配额超限或存储损坏时
// set() 的回调仍会触发，若不检查会把失败当成成功，UI 提示成功而数据未落盘。
function setStoredStateChecked(values) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      const runtimeError = chrome.runtime && chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve();
    });
  });
}

function setStoredFavorites(favorites) {
  return setStoredStateChecked({ favorites });
}

function setStoredState(values) {
  return setStoredStateChecked(values);
}

function createTrashEntry(favorite, now = Date.now()) {
  return {
    ...favorite,
    trashId: `trash-${now}-${Math.random().toString(36).slice(2, 9)}`,
    deletedAt: now,
    expiresAt: now + TRASH_RETENTION_MS
  };
}

async function cleanupRecentlyDeleted(now = Date.now()) {
  const { recentlyDeleted } = await getStoredState();
  const retained = recentlyDeleted.filter((item) => getTrashExpireAt(item, now) > now);
  const removed = recentlyDeleted.length - retained.length;
  if (removed) await setStoredState({ recentlyDeleted: retained });
  return { status: 'ok', removed, items: retained };
}

async function getRecentlyDeleted() {
  return cleanupRecentlyDeleted();
}

async function permanentlyDeleteFavorite(trashId) {
  const normalizedId = String(trashId || '').trim();
  const { recentlyDeleted } = await getStoredState();
  const nextRecentlyDeleted = recentlyDeleted.filter((item) => item.trashId !== normalizedId);
  const removed = recentlyDeleted.length - nextRecentlyDeleted.length;
  if (removed) await setStoredState({ recentlyDeleted: nextRecentlyDeleted });
  return { status: 'ok', removed, items: nextRecentlyDeleted };
}

async function restoreDeletedFavorite(trashId) {
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
async function recoverManagedFavorites() {
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
async function deleteFavorite(url) {
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

// 分类文件夹或关键词规则变更后，使用已保存的标题、网址和描述
// 重新运行本地分类器；开启浏览器同步时，同时移动 SmartFav 受管书签。
async function reclassifyFavorites() {
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
    await withBookmarkLayoutLock(async () => {
      // 新增星标同样属于一次浏览器布局变更，必须先把当前外部书签
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
    });
  }

  const activity = createBrowserActivity('classified', {
    title: favorite.title,
    url: favorite.url,
    category: favorite.category
  });
  await setStoredState({ pendingBrowserActivity: activity });
  await showClassificationNotification(activity, settings.language);
}

chrome.bookmarks.onCreated.addListener((id, node) => {
  enqueueBookmarkEvent('auto capture', () => handleBookmarkCreated(id, node));
});

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

if (chrome.bookmarks.onMoved && typeof chrome.bookmarks.onMoved.addListener === 'function') {
  chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
    enqueueBookmarkEvent(
      'browser move sync',
      () => withBookmarkLayoutLock(() => handleBookmarkMoved(id, moveInfo))
    );
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

if (chrome.bookmarks.onRemoved && typeof chrome.bookmarks.onRemoved.addListener === 'function') {
  chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
    enqueueBookmarkEvent('browser deletion sync', () => handleBookmarkRemoved(id, removeInfo));
  });
}

if (chrome.runtime.onStartup && typeof chrome.runtime.onStartup.addListener === 'function') {
  chrome.runtime.onStartup.addListener(() => {
    scheduleTrashCleanup();
    cleanupRecentlyDeleted().catch((error) => {
      console.error('SmartFav trash cleanup failed:', error);
    });
  });
}

if (chrome.alarms && chrome.alarms.onAlarm) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (!alarm || alarm.name !== TRASH_CLEANUP_ALARM) return;
    cleanupRecentlyDeleted().catch((error) => {
      console.error('SmartFav trash cleanup failed:', error);
    });
  });
}

scheduleTrashCleanup();

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'recoverManagedFavorites') {
    recoverManagedFavorites()
      .then(sendResponse)
      .catch((error) => sendResponse({ status: 'error', message: error.message }));
    return true;
  }

  if (message.type === 'getFavorites') {
    recoverManagedFavorites()
      .then((result) => sendResponse(result.favorites || []))
      .catch(() => {
        // 降级读取：失败时回传空数组，避免把 undefined 交给 popup。
        chrome.storage.local.get(['favorites'], (result) => {
          const runtimeError = chrome.runtime && chrome.runtime.lastError;
          if (runtimeError || !result) {
            sendResponse([]);
            return;
          }
          sendResponse(Array.isArray(result.favorites) ? result.favorites : []);
        });
      });
    return true;
  }

  if (message.type === 'deleteFavorite') {
    deleteFavorite(message.url)
      .then(sendResponse)
      .catch((error) => sendResponse({ status: 'error', message: error.message }));
    return true;
  }

  if (message.type === 'getRecentlyDeleted') {
    getRecentlyDeleted()
      .then(sendResponse)
      .catch((error) => sendResponse({ status: 'error', message: error.message }));
    return true;
  }

  if (message.type === 'restoreDeletedFavorite') {
    restoreDeletedFavorite(message.trashId)
      .then(sendResponse)
      .catch((error) => sendResponse({ status: 'error', message: error.message }));
    return true;
  }

  if (message.type === 'permanentlyDeleteFavorite') {
    permanentlyDeleteFavorite(message.trashId)
      .then(sendResponse)
      .catch((error) => sendResponse({ status: 'error', message: error.message }));
    return true;
  }

  if (message.type === 'cleanupRecentlyDeleted') {
    cleanupRecentlyDeleted()
      .then(sendResponse)
      .catch((error) => sendResponse({ status: 'error', message: error.message }));
    return true;
  }

  if (message.type === 'reclassifyFavorites') {
    reclassifyFavorites()
      .then(sendResponse)
      .catch((error) => sendResponse({ status: 'error', message: error.message }));
    return true;
  }

  if (message.type === 'syncManagedOrder') {
    syncManagedOrder(message.order)
      .then(sendResponse)
      .catch((error) => sendResponse({ status: 'error', message: error.message }));
    return true;
  }

  if (message.type === 'moveFavoriteToCategory') {
    moveFavoriteToCategory(message.url, message.targetCategory)
      .then(sendResponse)
      .catch((error) => sendResponse({ status: 'error', message: error.message }));
    return true;
  }
  
  if (message.type === 'saveFavorite') {
    saveFavoriteEntry(message.favorite, message.settingsPatch)
      .then(sendResponse)
      .catch((error) => sendResponse({ status: 'error', message: error.message }));
    return true;
  }

  if (message.type === 'getBookmarkRestorePoints') {
    getBookmarkRestorePointState()
      .then(sendResponse)
      .catch((error) => sendResponse({ status: 'error', message: error.message }));
    return true;
  }

  if (message.type === 'createBookmarkRestorePoint') {
    createBookmarkRestorePoint()
      .then(sendResponse)
      .catch((error) => sendResponse({ status: 'error', message: error.message }));
    return true;
  }

  if (message.type === 'previewBookmarkRestore') {
    previewBookmarkRestore(message.pointId)
      .then(sendResponse)
      .catch((error) => sendResponse({ status: 'error', message: error.message }));
    return true;
  }

  if (message.type === 'restoreBookmarkLayout') {
    restoreBookmarkLayout(message.pointId)
      .then(sendResponse)
      .catch((error) => sendResponse({ status: 'error', message: error.message }));
    return true;
  }

  if (message.type === 'exportBookmarkRestorePoints') {
    exportBookmarkRestorePoints()
      .then(sendResponse)
      .catch((error) => sendResponse({ status: 'error', message: error.message }));
    return true;
  }

  if (message.type === 'importBookmarkRestorePoints') {
    importBookmarkRestorePoints(message.payload)
      .then(sendResponse)
      .catch((error) => sendResponse({ status: 'error', message: error.message }));
    return true;
  }

  if (message.type === 'organizeBookmarks') {
    organizeBrowserBookmarks()
      .then(sendResponse)
      .catch((error) => sendResponse({ status: 'error', message: error.message }));
    return true;
  }
});
