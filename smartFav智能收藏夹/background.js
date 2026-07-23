// SmartFav Background - 后台脚本
importScripts('classifier.js', 'browser-bookmarks.js');

// 监听安装事件
chrome.runtime.onInstalled.addListener((details) => {
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
      aiEnabled: false,
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
      favorites: []
    });
    
    console.log('SmartFav 已安装');
  }
});

function getStoredState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['settings', 'favorites'], (result) => {
      resolve({
        settings: result.settings || {},
        favorites: Array.isArray(result.favorites) ? result.favorites : []
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
