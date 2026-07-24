// SmartFav Background - 后台脚本
importScripts('classifier.js', 'browser-bookmarks.js');

const TRASH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const TRASH_CLEANUP_ALARM = 'smartfav-trash-cleanup';

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
      recentlyDeleted: []
    });
    
    console.log('SmartFav 已安装');
  }
});

function getStoredState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['settings', 'favorites', 'recentlyDeleted'], (result) => {
      resolve({
        settings: result.settings || {},
        favorites: Array.isArray(result.favorites) ? result.favorites : [],
        recentlyDeleted: Array.isArray(result.recentlyDeleted) ? result.recentlyDeleted : []
      });
    });
  });
}

function setStoredFavorites(favorites) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ favorites }, resolve);
  });
}

function setStoredState(values) {
  return new Promise((resolve) => {
    chrome.storage.local.set(values, resolve);
  });
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
  const retained = recentlyDeleted.filter((item) => {
    const deletedAt = Number(item.deletedAt) || now;
    const expiresAt = Number(item.expiresAt) || deletedAt + TRASH_RETENTION_MS;
    return expiresAt > now;
  });
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
        chrome.bookmarks
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
      chrome.bookmarks
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
      chrome.bookmarks
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

// 整理浏览器收藏夹：读取全部书签 → 本地分类 → 导入 SmartFav 分类；
// 仅当"允许整理浏览器收藏夹"开启时才把书签移动进 SmartFav/分类 文件夹
async function organizeBrowserBookmarks() {
  const { settings, favorites } = await getStoredState();
  if (!chrome.bookmarks) return { status: 'unavailable' };

  const result = await SmartFavBookmarks.organizeBookmarks(
    settings,
    chrome.bookmarks,
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
    wroteBack: Boolean(settings.bookmarkOrganizeEnabled)
  };
}

// 自动获取浏览器收藏：用户点击收藏星标后自动识别、分类；
// 开启整理后，新增星标也会按同网址模式自动移动或覆盖到 SmartFav/分类
async function handleBookmarkCreated(id, node) {
  if (!node || !node.url) return;
  const { settings, favorites } = await getStoredState();
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
    await setStoredFavorites([
      favorite,
      ...favorites.filter((item) => item.url !== favorite.url)
    ]);
  }

  if (shouldOrganize) {
    if (settings.bookmarkWriteMode === 'add') {
      await SmartFavBookmarks.placeBookmarkInCategory(
        chrome.bookmarks,
        id,
        suggestion.category
      );
    } else {
      await SmartFavBookmarks.writeFavorite(
        favorite,
        { ...settings, browserBookmarksEnabled: true },
        chrome.bookmarks
      );
    }
  }
}

chrome.bookmarks.onCreated.addListener((id, node) => {
  handleBookmarkCreated(id, node).catch((error) => {
    console.error('SmartFav auto capture failed:', error);
  });
});

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
        chrome.storage.local.get(['favorites'], (result) => {
          sendResponse(result.favorites || []);
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
  
  if (message.type === 'saveFavorite') {
    chrome.storage.local.get(['favorites'], (result) => {
      const favorites = Array.isArray(result.favorites) ? result.favorites : [];
      const nextFavorites = [message.favorite, ...favorites.filter((item) => item.url !== message.favorite.url)];
      chrome.storage.local.set({ favorites: nextFavorites }, () => sendResponse({ success: true }));
    });
    return true;
  }

  if (message.type === 'organizeBookmarks') {
    organizeBrowserBookmarks()
      .then(sendResponse)
      .catch((error) => sendResponse({ status: 'error', message: error.message }));
    return true;
  }
});
