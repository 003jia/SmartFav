const detectedLanguage = SmartFavI18n.detectLanguage();
const detectedDefaults = SmartFavClassifier.getDefaults(detectedLanguage);

const DEFAULT_SETTINGS = {
  language: detectedLanguage,
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
  categories: detectedDefaults.categories,
  keywordRules: detectedDefaults.keywordRules
};

const THEME_STYLES = ['glass', 'white', 'gray', 'black', 'parchment'];
const TRASH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const BROWSER_ACTIVITY_TTL_MS = 5 * 60 * 1000;
const isExtension = typeof chrome !== 'undefined' && Boolean(chrome.storage && chrome.tabs);
const previewState = {
  settings: DEFAULT_SETTINGS,
  favoriteOrder: {},
  recentlyDeleted: [],
  bookmarkRestorePoints: [
    {
      id: 'preview-restore-point',
      schemaVersion: 1,
      createdAt: Date.now() - 12 * 60 * 1000,
      updatedAt: Date.now() - 4 * 60 * 1000,
      reason: 'organize',
      bookmarkCount: 4,
      folderCount: 3,
      legacyManagedCount: 0,
      preservedManagedFolderIds: [],
      bookmarks: []
    }
  ],
  pendingBrowserActivity: null,
  favorites: [
    {
      title: 'GitHub · Build and ship software',
      url: 'https://github.com/',
      category: detectedLanguage === 'zh_CN' ? '编程' : 'Programming',
      summary: detectedLanguage === 'zh_CN' ? '代码托管与协作平台' : 'Code hosting and collaboration',
      createdAt: Date.now() - 3600000
    },
    {
      title: 'MDN Web Docs',
      url: 'https://developer.mozilla.org/',
      category: detectedLanguage === 'zh_CN' ? '学习' : 'Learning',
      summary: detectedLanguage === 'zh_CN' ? 'Web 开发文档' : 'Web development documentation',
      createdAt: Date.now() - 7200000
    },
    {
      title: 'Figma · Collaborative interface design',
      url: 'https://www.figma.com/',
      category: detectedLanguage === 'zh_CN' ? '工具' : 'Tools',
      summary: detectedLanguage === 'zh_CN' ? '协作式界面设计工具' : 'Collaborative interface design tool',
      createdAt: Date.now() - 10800000
    },
    {
      title: 'YouTube',
      url: 'https://www.youtube.com/',
      category: detectedLanguage === 'zh_CN' ? '视频' : 'Video',
      summary: detectedLanguage === 'zh_CN' ? '在线视频平台' : 'Online video platform',
      createdAt: Date.now() - 14400000
    }
  ]
};
if (!isExtension) {
  const previewParams = new URLSearchParams(window.location.search);
  const previewRestoreState = previewParams.get('restoreState');
  if (previewParams.get('preview') === 'reorder') {
    const customCategory = detectedLanguage === 'zh_CN' ? '项目资料' : 'Projects';
    previewState.settings = {
      ...DEFAULT_SETTINGS,
      categories: [...DEFAULT_SETTINGS.categories, customCategory],
      keywordRules: {
        ...DEFAULT_SETTINGS.keywordRules,
        [customCategory]: ['项目', '管理', '流程', '文档']
      }
    };
    previewState.favorites = [
      {
        title: detectedLanguage === 'zh_CN'
          ? 'Comate 客户管理表'
          : 'Comate customer dashboard',
        url: 'https://ku.baidu-int.com/customer',
        category: customCategory,
        createdAt: Date.now() - 5 * 60000
      },
      {
        title: detectedLanguage === 'zh_CN'
          ? 'Comate 智能云下单流程'
          : 'Comate cloud ordering workflow',
        url: 'https://ku.baidu-int.com/order',
        category: customCategory,
        createdAt: Date.now() - 10 * 60000
      },
      {
        title: 'comate.baidu.com/zh/management/home',
        url: 'https://comate.baidu.com/zh/management/home',
        category: customCategory,
        createdAt: Date.now() - 15 * 60000
      },
      {
        title: detectedLanguage === 'zh_CN'
          ? 'Comate 海外模型单价'
          : 'Comate international model pricing',
        url: 'https://comate.baidu.com/pricing',
        category: customCategory,
        createdAt: Date.now() - 20 * 60000
      },
      {
        title: detectedLanguage === 'zh_CN'
          ? 'Comate 试用客户跟进'
          : 'Comate trial customer follow-up',
        url: 'https://ku.baidu-int.com/follow-up',
        category: customCategory,
        createdAt: Date.now() - 25 * 60000
      },
      ...previewState.favorites
    ];
  }
  if (previewParams.get('aiKeywordPreview') === 'success') {
    previewState.settings = {
      ...previewState.settings,
      aiEnabled: true,
      aiAutoClassify: false
    };
  }
  if (previewRestoreState === 'legacy') {
    previewState.bookmarkRestorePoints = [
      {
        id: 'preview-legacy-only',
        schemaVersion: 1,
        createdAt: Date.now() - 12 * 60 * 1000,
        updatedAt: Date.now() - 4 * 60 * 1000,
        reason: 'manual',
        bookmarkCount: 0,
        folderCount: 0,
        legacyManagedCount: 36,
        preservedManagedFolderIds: [],
        bookmarks: []
      }
    ];
  } else if (previewRestoreState === 'empty') {
    previewState.bookmarkRestorePoints = [];
  }
}
if (!isExtension && new URLSearchParams(window.location.search).get('activity') === 'classified') {
  previewState.pendingBrowserActivity = {
    id: 'preview-classified',
    type: 'classified',
    title: 'GitHub · Build and ship software',
    url: 'https://github.com/',
    category: detectedLanguage === 'zh_CN' ? '编程' : 'Programming',
    count: 1,
    createdAt: Date.now(),
    expiresAt: Date.now() + BROWSER_ACTIVITY_TTL_MS
  };
}

const elements = {
  modeBtn: document.getElementById('modeBtn'),
  languageBtn: document.getElementById('languageBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  brandCaption: document.getElementById('brandCaption'),
  mainView: document.getElementById('mainView'),
  favoritesView: document.getElementById('favoritesView'),
  categoriesView: document.getElementById('categoriesView'),
  trashView: document.getElementById('trashView'),
  settingsView: document.getElementById('settingsView'),
  favoritesBackBtn: document.getElementById('favoritesBackBtn'),
  categoriesBackBtn: document.getElementById('categoriesBackBtn'),
  trashBackBtn: document.getElementById('trashBackBtn'),
  trashNavBtn: document.getElementById('trashNavBtn'),
  trashEntryCount: document.getElementById('trashEntryCount'),
  trashViewSummary: document.getElementById('trashViewSummary'),
  trashStatus: document.getElementById('trashStatus'),
  trashList: document.getElementById('trashList'),
  loadingStatus: document.getElementById('loadingStatus'),
  successStatus: document.getElementById('successStatus'),
  successMsg: document.getElementById('successMsg'),
  pageLearningUndoBtn: document.getElementById('pageLearningUndoBtn'),
  errorStatus: document.getElementById('errorStatus'),
  errorMsg: document.getElementById('errorMsg'),
  categorySection: document.getElementById('categorySection'),
  saveTitle: document.getElementById('saveTitle'),
  pageHost: document.getElementById('pageHost'),
  categorySelect: document.getElementById('categorySelect'),
  categorySummary: document.getElementById('categorySummary'),
  sourceBadge: document.getElementById('sourceBadge'),
  confidenceBadge: document.getElementById('confidenceBadge'),
  tagsContainer: document.getElementById('tagsContainer'),
  pageLearningOption: document.getElementById('pageLearningOption'),
  pageLearningCheckbox: document.getElementById('pageLearningCheckbox'),
  pageLearningDescription: document.getElementById('pageLearningDescription'),
  confirmBtn: document.getElementById('confirmBtn'),
  enhanceBtn: document.getElementById('enhanceBtn'),
  aiMessage: document.getElementById('aiMessage'),
  privacyHint: document.getElementById('privacyHint'),
  foldersList: document.getElementById('foldersList'),
  foldersSection: document.getElementById('foldersSection'),
  foldersHeading: document.getElementById('foldersHeading'),
  totalCount: document.getElementById('totalCount'),
  librarySummary: document.getElementById('librarySummary'),
  favoritesViewSummary: document.getElementById('favoritesViewSummary'),
  favoritesReorderStatus: document.getElementById('favoritesReorderStatus'),
  classificationLearningPrompt: document.getElementById('classificationLearningPrompt'),
  classificationLearningTitle: document.getElementById('classificationLearningTitle'),
  classificationLearningMessage: document.getElementById('classificationLearningMessage'),
  classificationLearningHint: document.getElementById('classificationLearningHint'),
  classificationLearningDismissBtn: document.getElementById('classificationLearningDismissBtn'),
  classificationLearningRememberBtn: document.getElementById('classificationLearningRememberBtn'),
  categoryEntrySummary: document.getElementById('categoryEntrySummary'),
  favoritesNavBtn: document.getElementById('favoritesNavBtn'),
  categoryFoldersNavBtn: document.getElementById('categoryFoldersNavBtn'),
  compactThemeStyle: document.getElementById('compactThemeStyle'),
  compactDarkMode: document.getElementById('compactDarkMode'),
  compactPopupWidth: document.getElementById('compactPopupWidth'),
  compactPopupWidthValue: document.getElementById('compactPopupWidthValue'),
  compactPopupHeight: document.getElementById('compactPopupHeight'),
  compactPopupHeightValue: document.getElementById('compactPopupHeightValue'),
  compactBackgroundImage: document.getElementById('compactBackgroundImage'),
  backgroundImagePreview: document.getElementById('backgroundImagePreview'),
  clearBackgroundImageBtn: document.getElementById('clearBackgroundImageBtn'),
  recentSection: document.getElementById('recentSection'),
  recentList: document.getElementById('recentList'),
  viewAllBtn: document.getElementById('viewAllBtn'),
  compactAiEnabled: document.getElementById('compactAiEnabled'),
  compactAiFields: document.getElementById('compactAiFields'),
  compactProvider: document.getElementById('compactProvider'),
  compactApiEndpoint: document.getElementById('compactApiEndpoint'),
  compactApiEndpointField: document.getElementById('compactApiEndpointField'),
  compactModel: document.getElementById('compactModel'),
  compactApiKey: document.getElementById('compactApiKey'),
  compactApiKeyField: document.getElementById('compactApiKeyField'),
  compactClassificationMode: document.getElementById('compactClassificationMode'),
  compactKeywordWeight: document.getElementById('compactKeywordWeight'),
  compactKeywordWeightValue: document.getElementById('compactKeywordWeightValue'),
  compactAiAutoClassify: document.getElementById('compactAiAutoClassify'),
  compactAiCreateCategories: document.getElementById('compactAiCreateCategories'),
  compactBrowserBookmarksEnabled: document.getElementById('compactBrowserBookmarksEnabled'),
  compactBookmarkFields: document.getElementById('compactBookmarkFields'),
  compactBookmarkWriteMode: document.getElementById('compactBookmarkWriteMode'),
  compactBookmarkOrganizeEnabled: document.getElementById('compactBookmarkOrganizeEnabled'),
  compactBookmarkAutoCapture: document.getElementById('compactBookmarkAutoCapture'),
  compactOrganizeBtn: document.getElementById('compactOrganizeBtn'),
  bookmarkBackupBadge: document.getElementById('bookmarkBackupBadge'),
  bookmarkBackupSummary: document.getElementById('bookmarkBackupSummary'),
  bookmarkBackupCreateBtn: document.getElementById('bookmarkBackupCreateBtn'),
  bookmarkBackupPreviewBtn: document.getElementById('bookmarkBackupPreviewBtn'),
  bookmarkBackupRestoreBtn: document.getElementById('bookmarkBackupRestoreBtn'),
  bookmarkBackupExportBtn: document.getElementById('bookmarkBackupExportBtn'),
  bookmarkBackupImportInput: document.getElementById('bookmarkBackupImportInput'),
  bookmarkBackupStatus: document.getElementById('bookmarkBackupStatus'),
  compactNewCategory: document.getElementById('compactNewCategory'),
  compactAddCategoryBtn: document.getElementById('compactAddCategoryBtn'),
  categoryKeywordAiAnalyzeBtn: document.getElementById('categoryKeywordAiAnalyzeBtn'),
  categoryRulesList: document.getElementById('categoryRulesList'),
  categorySettingsStatus: document.getElementById('categorySettingsStatus'),
  categorySaveBtn: document.getElementById('categorySaveBtn'),
  compactTestBtn: document.getElementById('compactTestBtn'),
  compactSettingsStatus: document.getElementById('compactSettingsStatus')
};

let currentTabInfo = null;
let currentSuggestion = null;
let currentSettings = DEFAULT_SETTINGS;
let categoryDraft = [];
let previewThemeStyle = DEFAULT_SETTINGS.themeStyle;
let pendingBackgroundImage = DEFAULT_SETTINGS.customBackgroundImage;
let showingAllFavorites = false;
let activeView = 'home';
let activeFavoriteCategory = null;
let activeFavoriteOrder = {};
let favoriteOpenSuppressUntil = 0;
let aiEnhanceInFlight = false;
let lastShownBrowserActivityId = '';
let currentBrowserActivity = null;
let currentBookmarkRestorePoint = null;
let settingsSaveQueue = Promise.resolve();
let pendingLearningProposal = null;
let recommendedCategory = '';
let currentPageLearningProposal = null;
let pendingPageLearningUndo = null;
let popupCloseTimer = null;
let aiKeywordAnalysisInFlight = false;
let categoryKeywordSuggestionCounts = {};

document.addEventListener('DOMContentLoaded', async () => {
  await recoverManagedBrowserFavorites();
  await cleanupRecentlyDeletedItems();
  currentSettings = await loadSettings();
  applyLanguage();
  await Promise.all([renderFolders(), renderRecentFavorites(), renderRecentlyDeleted()]);
  await analyzeCurrentTab();
  const requestedView = new URLSearchParams(window.location.search).get('view');
  await showView(['favorites', 'categories', 'trash', 'settings'].includes(requestedView)
    ? requestedView
    : 'home');
  await showPendingBrowserActivity();
});

function t(key, variables) {
  return SmartFavI18n.translate(currentSettings.language, key, variables);
}

function storageGet(keys) {
  if (!isExtension) {
    const result = {};
    keys.forEach((key) => { result[key] = previewState[key]; });
    return Promise.resolve(result);
  }
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(values) {
  if (!isExtension) {
    Object.assign(previewState, values);
    return Promise.resolve();
  }
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

function summarizePreviewRestorePoint(point) {
  if (!point) return null;
  return {
    id: point.id,
    createdAt: Number(point.createdAt) || 0,
    updatedAt: Number(point.updatedAt || point.createdAt) || 0,
    restoredAt: Number(point.restoredAt) || 0,
    reason: point.reason || 'manual',
    bookmarkCount: Number(point.bookmarkCount)
      || (Array.isArray(point.bookmarks) ? point.bookmarks.length : 0),
    folderCount: Number(point.folderCount) || 0,
    legacyManagedCount: Number(point.legacyManagedCount) || 0
  };
}

function handlePreviewRuntimeMessage(type, payload = {}) {
  const points = Array.isArray(previewState.bookmarkRestorePoints)
    ? previewState.bookmarkRestorePoints
    : [];
  const active = [...points]
    .filter((point) => !point.restoredAt)
    .sort((left, right) => Number(right.createdAt) - Number(left.createdAt))[0]
    || null;
  const selected = points.find((point) => point.id === payload.pointId)
    || active
    || points[0]
    || null;

  if (type === 'getBookmarkRestorePoints') {
    return {
      status: 'ok',
      points: [...points]
        .sort((left, right) => Number(right.createdAt) - Number(left.createdAt))
        .map(summarizePreviewRestorePoint),
      activePoint: summarizePreviewRestorePoint(active)
    };
  }
  if (type === 'createBookmarkRestorePoint') {
    const point = active || {
      id: `preview-restore-${Date.now()}`,
      schemaVersion: 1,
      createdAt: Date.now(),
      reason: 'manual',
      preservedManagedFolderIds: [],
      bookmarks: []
    };
    point.updatedAt = Date.now();
    point.bookmarkCount = Math.max(point.bookmarkCount || 0, previewState.favorites.length);
    point.folderCount = Math.max(point.folderCount || 0, 3);
    if (!active) previewState.bookmarkRestorePoints = [point, ...points].slice(0, 3);
    return { status: 'ok', point: summarizePreviewRestorePoint(point) };
  }
  if (type === 'previewBookmarkRestore') {
    if (!selected) return { status: 'missing' };
    return {
      status: 'ok',
      point: summarizePreviewRestorePoint(selected),
      movable: Math.max(0, Number(selected.bookmarkCount) - 1),
      alreadyRestored: selected.bookmarkCount ? 1 : 0,
      missingBookmarks: 0,
      foldersToRecreate: 1,
      legacyManagedCount: Number(selected.legacyManagedCount) || 0
    };
  }
  if (type === 'restoreBookmarkLayout') {
    if (!selected) return { status: 'missing' };
    selected.restoredAt = Date.now();
    return {
      status: 'ok',
      restored: Math.max(0, Number(selected.bookmarkCount) - 1),
      alreadyRestored: selected.bookmarkCount ? 1 : 0,
      missingBookmarks: 0,
      unresolvedParents: 0,
      createdFolders: 1,
      removedEmptyFolders: 2,
      errors: [],
      point: summarizePreviewRestorePoint(selected)
    };
  }
  if (type === 'exportBookmarkRestorePoints') {
    return {
      status: 'ok',
      payload: {
        format: 'smartfav-bookmark-restore',
        schemaVersion: 1,
        exportedAt: Date.now(),
        restorePoints: points
      }
    };
  }
  if (type === 'importBookmarkRestorePoints') {
    const imported = payload.payload;
    if (
      !imported
      || imported.format !== 'smartfav-bookmark-restore'
      || !Array.isArray(imported.restorePoints)
      || !imported.restorePoints.length
    ) {
      return { status: 'error', message: 'Invalid SmartFav restore file' };
    }
    previewState.bookmarkRestorePoints = imported.restorePoints.slice(-3);
    return {
      status: 'ok',
      imported: previewState.bookmarkRestorePoints.length
    };
  }
  if (type === 'moveFavoriteToCategory') {
    const localResult = SmartFavOrder.moveFavoriteAcrossCategories(
      previewState.favorites,
      previewState.favoriteOrder,
      payload.url,
      payload.targetCategory
    );
    if (!localResult.changed) {
      return { status: localResult.status, moved: 0, browserStatus: 'disabled' };
    }
    previewState.favorites = localResult.favorites;
    previewState.favoriteOrder = localResult.favoriteOrder;
    return {
      status: 'ok',
      moved: 1,
      favorite: localResult.favorite,
      previousCategory: localResult.previousCategory,
      targetCategory: localResult.targetCategory,
      browserStatus: 'disabled',
      browserMoved: 0,
      browserMissing: 0
    };
  }
  if (type === 'syncManagedOrder') {
    const order = payload.order || {};
    const matched = Array.isArray(order.categories)
      ? order.categories.length
      : Array.isArray(order.orderedUrls)
        ? order.orderedUrls.length
        : 0;
    return {
      status: 'ok',
      moved: matched,
      matched,
      missing: 0,
      categoryFoldersMoved: Array.isArray(order.categories) ? matched : 0,
      favoritesMoved: Array.isArray(order.orderedUrls) ? matched : 0
    };
  }
  return { status: 'unavailable' };
}

function sendRuntimeMessage(type, payload = {}) {
  if (!isExtension || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
    return Promise.resolve(handlePreviewRuntimeMessage(type, payload));
  }
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...payload }, (response) => {
      const runtimeError = chrome.runtime.lastError;
      resolve(runtimeError
        ? { status: 'error', message: runtimeError.message }
        : response);
    });
  });
}

function getBrowserActivityMessage(activity) {
  if (activity.type === 'classified') {
    return t('browserClassifiedActivity', {
      title: activity.title || activity.url || t('untitledPage'),
      category: activity.category || t('otherCategory')
    });
  }
  if (activity.type === 'trashed' && Number(activity.count) > 1) {
    return t('browserTrashedManyActivity', { count: activity.count });
  }
  if (activity.type === 'trashed') {
    return t('browserTrashedActivity', {
      title: activity.title || activity.url || t('untitledPage')
    });
  }
  if (activity.type === 'moved') {
    return t('browserMovedActivity', {
      title: activity.title || activity.url || t('untitledPage'),
      previousCategory: activity.previousCategory || t('otherCategory'),
      category: activity.category || t('otherCategory')
    });
  }
  return '';
}

async function showBrowserActivity(activity) {
  if (!activity || !activity.id || activity.id === lastShownBrowserActivityId) return false;
  const createdAt = Number(activity.createdAt) || 0;
  const expiresAt = Number(activity.expiresAt) || createdAt + BROWSER_ACTIVITY_TTL_MS;
  if (!createdAt || expiresAt <= Date.now()) {
    await storageSet({ pendingBrowserActivity: null });
    return false;
  }
  const message = getBrowserActivityMessage(activity);
  if (!message) return false;
  lastShownBrowserActivityId = activity.id;
  currentBrowserActivity = activity;
  elements.successMsg.textContent = message;
  elements.successStatus.classList.remove('hidden');
  await storageSet({ pendingBrowserActivity: null });
  return true;
}

async function showPendingBrowserActivity() {
  const result = await storageGet(['pendingBrowserActivity']);
  return showBrowserActivity(result.pendingBrowserActivity);
}

if (
  isExtension
  && chrome.storage.onChanged
  && typeof chrome.storage.onChanged.addListener === 'function'
) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes.settings && changes.settings.newValue) {
      currentSettings = {
        ...DEFAULT_SETTINGS,
        ...changes.settings.newValue
      };
    }
    if (changes.pendingBrowserActivity && changes.pendingBrowserActivity.newValue) {
      showBrowserActivity(changes.pendingBrowserActivity.newValue).catch((error) => {
        console.error('SmartFav activity display failed:', error);
      });
    }
    if (changes.favorites || changes.recentlyDeleted) {
      const categoryToKeep = activeView === 'favorites' ? activeFavoriteCategory : null;
      Promise.all([
        renderFolders(),
        renderRecentFavorites(),
        renderRecentlyDeleted()
      ])
        .then(async () => {
          if (!categoryToKeep) return;
          const result = await storageGet(['favorites', 'favoriteOrder']);
          const favorites = Array.isArray(result.favorites) ? result.favorites : [];
          showFavoritesByCategory(categoryToKeep, favorites, result.favoriteOrder);
        })
        .catch((error) => {
          console.error('SmartFav live refresh failed:', error);
        });
    } else if (
      changes.favoriteOrder
      && activeView === 'favorites'
      && activeFavoriteCategory
    ) {
      const categoryToKeep = activeFavoriteCategory;
      storageGet(['favorites', 'favoriteOrder'])
        .then((result) => {
          const favorites = Array.isArray(result.favorites) ? result.favorites : [];
          showFavoritesByCategory(categoryToKeep, favorites, result.favoriteOrder);
        })
        .catch((error) => {
          console.error('SmartFav order refresh failed:', error);
        });
    }
  });
}

function recoverManagedBrowserFavorites() {
  if (!isExtension || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'recoverManagedFavorites' }, (response) => {
      const runtimeError = chrome.runtime.lastError;
      resolve(runtimeError ? null : response);
    });
  });
}

async function loadSettings() {
  const result = await storageGet(['settings']);
  const saved = result.settings || {};
  const language = SmartFavI18n.normalizeLanguage(saved.language || detectedLanguage);
  const localizedDefaults = SmartFavClassifier.getDefaults(language);
  const apiProvider = SmartFavAI.PROVIDERS[saved.apiProvider]
    ? saved.apiProvider
    : DEFAULT_SETTINGS.apiProvider;
  const categories = Array.isArray(saved.categories) && saved.categories.length
    ? saved.categories
    : localizedDefaults.categories;
  const settings = {
    ...DEFAULT_SETTINGS,
    ...saved,
    language,
    themeStyle: normalizeThemeStyle(saved.themeStyle),
    colorMode: saved.themeStyle === 'black' || saved.colorMode === 'dark' ? 'dark' : 'light',
    popupWidth: normalizePopupDimension(saved.popupWidth, 320, 520, DEFAULT_SETTINGS.popupWidth),
    popupHeight: normalizePopupDimension(saved.popupHeight, 420, 600, DEFAULT_SETTINGS.popupHeight),
    customBackgroundImage: typeof saved.customBackgroundImage === 'string'
      ? saved.customBackgroundImage
      : '',
    aiEnabled: typeof saved.aiEnabled === 'boolean' ? saved.aiEnabled : Boolean(saved.apiKey),
    aiAutoClassify: saved.aiAutoClassify !== false,
    aiCreateCategories: Boolean(saved.aiCreateCategories),
    classificationMode: saved.classificationMode === 'vector' ? 'vector' : 'weighted',
    classificationWeights: SmartFavClassifier.normalizeWeights(saved.classificationWeights),
    apiProvider,
    apiEndpoint: typeof saved.apiEndpoint === 'string' ? saved.apiEndpoint : '',
    browserBookmarksEnabled: Boolean(saved.browserBookmarksEnabled),
    bookmarkWriteMode: saved.bookmarkWriteMode === 'add' ? 'add' : 'overwrite',
    bookmarkOrganizeEnabled: Boolean(saved.bookmarkOrganizeEnabled),
    bookmarkAutoCaptureEnabled: Boolean(saved.bookmarkAutoCaptureEnabled),
    categories,
    keywordRules: SmartFavClassifier.mergeRules(categories, saved.keywordRules, language)
  };
  const needsMigration = !result.settings
    || !saved.language
    || !THEME_STYLES.includes(saved.themeStyle)
    || !['light', 'dark'].includes(saved.colorMode)
    || !Number.isFinite(Number(saved.popupWidth))
    || !Number.isFinite(Number(saved.popupHeight))
    || typeof saved.customBackgroundImage !== 'string'
    || typeof saved.aiAutoClassify !== 'boolean'
    || typeof saved.aiCreateCategories !== 'boolean'
    || !['weighted', 'vector'].includes(saved.classificationMode)
    || !saved.classificationWeights
    || !SmartFavAI.PROVIDERS[saved.apiProvider]
    || typeof saved.apiEndpoint !== 'string'
    || typeof saved.browserBookmarksEnabled !== 'boolean'
    || typeof saved.bookmarkOrganizeEnabled !== 'boolean'
    || typeof saved.bookmarkAutoCaptureEnabled !== 'boolean'
    || !saved.bookmarkWriteMode;
  if (needsMigration) await storageSet({ settings });
  return settings;
}

function normalizeThemeStyle(value) {
  return THEME_STYLES.includes(value) ? value : 'glass';
}

function normalizePopupDimension(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(Math.min(maximum, Math.max(minimum, parsed)) / 20) * 20;
}

function applyAppearance(settings = currentSettings) {
  const themeStyle = normalizeThemeStyle(settings.themeStyle);
  const colorMode = themeStyle === 'black' || settings.colorMode === 'dark' ? 'dark' : 'light';
  const popupWidth = normalizePopupDimension(
    settings.popupWidth,
    320,
    520,
    DEFAULT_SETTINGS.popupWidth
  );
  const popupHeight = normalizePopupDimension(
    settings.popupHeight,
    420,
    600,
    DEFAULT_SETTINGS.popupHeight
  );
  const customBackgroundImage = typeof settings.customBackgroundImage === 'string'
    ? settings.customBackgroundImage
    : '';
  document.documentElement.dataset.theme = themeStyle;
  document.documentElement.dataset.mode = colorMode;
  document.documentElement.dataset.customBackground = customBackgroundImage ? 'true' : 'false';
  document.documentElement.style.setProperty('--popup-width', `${popupWidth}px`);
  document.documentElement.style.setProperty('--popup-height', `${popupHeight}px`);
  document.documentElement.style.setProperty(
    '--custom-background-image',
    customBackgroundImage ? `url(${JSON.stringify(customBackgroundImage)})` : 'none'
  );
  elements.modeBtn.textContent = t(colorMode === 'dark' ? 'lightModeShort' : 'darkModeShort');
  elements.modeBtn.disabled = themeStyle === 'black';
  elements.modeBtn.setAttribute(
    'aria-label',
    t(themeStyle === 'black'
      ? 'blackThemeDarkOnly'
      : colorMode === 'dark' ? 'switchToLight' : 'switchToDark')
  );
  elements.modeBtn.title = themeStyle === 'black' ? t('blackThemeDarkOnly') : '';
}

function applyLanguage() {
  SmartFavI18n.applyToDocument(currentSettings.language, document);
  if (currentBrowserActivity) {
    elements.successMsg.textContent = getBrowserActivityMessage(currentBrowserActivity);
  }
  elements.languageBtn.textContent = currentSettings.language === 'zh_CN' ? 'EN' : '中';
  elements.languageBtn.setAttribute('aria-label', t('switchToEnglish'));
  const isHome = activeView === 'home';
  const captionKeys = {
    home: 'saveCurrentPage',
    favorites: 'myFavorites',
    categories: 'categoryFolders',
    trash: 'recentlyDeleted',
    settings: 'extensionSettings'
  };
  elements.settingsBtn.textContent = t(isHome ? 'settings' : 'back');
  elements.settingsBtn.setAttribute('aria-label', t(isHome ? 'openSettings' : 'backToHome'));
  elements.brandCaption.textContent = t(captionKeys[activeView] || 'saveCurrentPage');
  applyAppearance();
}

async function toggleColorMode() {
  if (currentSettings.themeStyle === 'black') return;
  currentSettings = {
    ...currentSettings,
    colorMode: currentSettings.colorMode === 'dark' ? 'light' : 'dark'
  };
  await storageSet({ settings: currentSettings });
  applyAppearance();
  if (activeView === 'settings') {
    elements.compactThemeStyle.value = normalizeThemeStyle(currentSettings.themeStyle);
    elements.compactDarkMode.checked = currentSettings.colorMode === 'dark';
    updateAppearancePreview();
  }
}

async function switchLanguage() {
  hideClassificationLearningPrompt();
  const previousLanguage = currentSettings.language;
  const nextLanguage = previousLanguage === 'zh_CN' ? 'en' : 'zh_CN';
  const shouldMigrateDefaults = isUsingDefaultClassification(currentSettings, previousLanguage);
  const previousDefaults = SmartFavClassifier.getDefaults(previousLanguage);
  const nextDefaults = SmartFavClassifier.getDefaults(nextLanguage);
  if (currentBrowserActivity && shouldMigrateDefaults) {
    const categoryIndex = previousDefaults.categories.indexOf(currentBrowserActivity.category);
    if (categoryIndex >= 0 && nextDefaults.categories[categoryIndex]) {
      currentBrowserActivity = {
        ...currentBrowserActivity,
        category: nextDefaults.categories[categoryIndex]
      };
    }
  }
  currentSettings = {
    ...currentSettings,
    language: nextLanguage,
    categories: shouldMigrateDefaults ? nextDefaults.categories : currentSettings.categories,
    keywordRules: shouldMigrateDefaults
      ? nextDefaults.keywordRules
      : SmartFavClassifier.mergeRules(currentSettings.categories, currentSettings.keywordRules, nextLanguage)
  };
  await storageSet({ settings: currentSettings });
  try {
    await reclassifyStoredFavorites();
  } catch (error) {
    console.warn('SmartFav could not reclassify favorites after switching language:', error);
  }
  applyLanguage();
  await Promise.all([renderFolders(), renderRecentFavorites(), renderRecentlyDeleted()]);
  if (currentTabInfo) {
    currentSuggestion = SmartFavClassifier.classify(currentTabInfo, currentSettings);
    showCategorySuggestion(currentSuggestion);
    if (currentSettings.aiEnabled && currentSettings.aiAutoClassify) {
      await enhanceCurrentSuggestion({ automatic: true });
    }
  }
  if (activeView === 'settings') populateCompactSettings();
  if (activeView === 'categories') populateCategoryManager();
}

function isUsingDefaultClassification(settings, language) {
  const defaults = SmartFavClassifier.getDefaults(language);
  if (JSON.stringify(settings.categories) !== JSON.stringify(defaults.categories)) return false;
  const currentRules = SmartFavClassifier.mergeRules(settings.categories, settings.keywordRules, language);
  const defaultRules = SmartFavClassifier.mergeRules(defaults.categories, defaults.keywordRules, language);
  return JSON.stringify(currentRules) === JSON.stringify(defaultRules);
}

async function analyzeCurrentTab() {
  try {
    if (isExtension) {
      const tabs = await new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
      const tab = tabs[0];
      if (!tab || !isSupportedUrl(tab.url)) {
        showError(t('unsupportedPage'));
        return;
      }
      const pageContent = await getPageContent(tab.id);
      currentTabInfo = {
        url: tab.url,
        title: tab.title || getHostname(tab.url),
        favicon: tab.favIconUrl || '',
        description: pageContent.description || '',
        keywords: pageContent.keywords || []
      };
    } else {
      currentTabInfo = {
        url: 'https://github.com/openai/codex',
        title: 'openai/codex · GitHub',
        favicon: '',
        description: 'An open-source coding agent for software development.',
        keywords: ['coding agent', 'developer tools', 'AI']
      };
    }

    currentSuggestion = SmartFavClassifier.classify(currentTabInfo, currentSettings);
    showCategorySuggestion(currentSuggestion);
    if (currentSettings.aiEnabled && currentSettings.aiAutoClassify) {
      await enhanceCurrentSuggestion({ automatic: true });
    }
  } catch (error) {
    console.error('Failed to read page:', error);
    showError(t('readPageFailed'));
  }
}

function isSupportedUrl(url) {
  return Boolean(url) && !/^(chrome|edge|about|chrome-extension):/.test(url);
}

function getPageContent(tabId) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
        const ogDescription = document.querySelector('meta[property="og:description"]')?.content || '';
        const metaKeywords = document.querySelector('meta[name="keywords"]')?.content || '';
        const bodyText = document.body?.innerText?.slice(0, 1200) || '';
        const keywords = metaKeywords
          .split(/[,，;；\r\n]+/)
          .map((keyword) => keyword.trim())
          .filter(Boolean)
          .slice(0, 24);
        return {
          description: metaDescription || ogDescription || bodyText.slice(0, 320),
          keywords
        };
      }
    }, (results) => {
      if (chrome.runtime.lastError) {
        resolve({ description: '' });
        return;
      }
      resolve(results && results[0] && results[0].result ? results[0].result : { description: '' });
    });
  });
}

function showCategorySuggestion(suggestion) {
  elements.loadingStatus.classList.add('hidden');
  elements.errorStatus.classList.add('hidden');
  elements.categorySection.classList.remove('hidden');
  elements.saveTitle.textContent = currentTabInfo.title || t('untitledPage');
  elements.pageHost.textContent = getHostname(currentTabInfo.url);
  elements.categorySelect.innerHTML = currentSettings.categories
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join('');
  elements.categorySelect.value = currentSettings.categories.includes(suggestion.category)
    ? suggestion.category
    : currentSettings.categories[currentSettings.categories.length - 1];
  recommendedCategory = elements.categorySelect.value;
  resetPageLearningOption();
  elements.categorySummary.textContent = suggestion.summary;
  elements.tagsContainer.innerHTML = suggestion.tags
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join('');
  elements.sourceBadge.textContent = t(suggestion.source === 'ai' ? 'aiEnhanced' : 'localRules');
  elements.sourceBadge.classList.toggle('ai', suggestion.source === 'ai');
  const confidence = ['high', 'medium', 'low'].includes(suggestion.confidence)
    ? suggestion.confidence
    : '';
  const confidenceLabel = confidence
    ? t(`confidence${confidence[0].toUpperCase()}${confidence.slice(1)}`)
    : '';
  elements.confidenceBadge.className = `confidence-badge${confidence ? ` confidence-${confidence}` : ''}`;
  elements.confidenceBadge.classList.toggle(
    'hidden',
    suggestion.source === 'ai' || !confidence
  );
  elements.confidenceBadge.textContent = confidenceLabel;
  elements.confidenceBadge.setAttribute(
    'aria-label',
    confidenceLabel
      ? t('classificationConfidence', { level: confidenceLabel })
      : ''
  );
  elements.enhanceBtn.classList.toggle('hidden', !currentSettings.aiEnabled);
  elements.enhanceBtn.textContent = t('aiOptimize');
  elements.privacyHint.textContent = t(suggestion.source === 'ai' ? 'privacyAI' : 'privacyLocal');
  updateConfirmLabel();
}

function updateConfirmLabel() {
  const category = elements.categorySelect.value || t('bookmarksFallback');
  elements.confirmBtn.textContent = t('saveToCategory', { category });
}

function getFallbackCategory() {
  const preferred = currentSettings.language === 'zh_CN' ? '其他' : 'Other';
  return currentSettings.categories.includes(preferred)
    ? preferred
    : currentSettings.categories[currentSettings.categories.length - 1];
}

function resetPageLearningOption() {
  currentPageLearningProposal = null;
  elements.pageLearningOption.classList.add('hidden');
  elements.pageLearningCheckbox.checked = false;
  elements.pageLearningDescription.textContent = '';
}

function updatePageLearningOption() {
  const targetCategory = elements.categorySelect.value;
  if (
    !currentTabInfo
    || !targetCategory
    || !recommendedCategory
    || targetCategory === recommendedCategory
  ) {
    resetPageLearningOption();
    return;
  }
  const proposal = SmartFavClassifier.createDomainLearningProposal(
    currentTabInfo,
    targetCategory,
    currentSettings
  );
  if (!proposal) {
    resetPageLearningOption();
    return;
  }
  currentPageLearningProposal = proposal;
  const isFallback = targetCategory === getFallbackCategory();
  elements.pageLearningCheckbox.checked = !isFallback;
  elements.pageLearningOption.classList.remove('hidden');
  if (isFallback) {
    elements.pageLearningDescription.textContent = t('rememberManualCategoryFallback');
  } else if (proposal.previousCategories.length) {
    elements.pageLearningDescription.textContent = t('rememberManualCategoryConflict', {
      domain: proposal.domain,
      categories: proposal.previousCategories.join(
        currentSettings.language === 'zh_CN' ? '、' : ', '
      ),
      category: proposal.targetCategory
    });
  } else {
    elements.pageLearningDescription.textContent = t('rememberManualCategoryDescription', {
      domain: proposal.domain,
      category: proposal.targetCategory
    });
  }
}

elements.categorySelect.addEventListener('change', () => {
  updateConfirmLabel();
  updatePageLearningOption();
});

elements.enhanceBtn.addEventListener('click', () => {
  enhanceCurrentSuggestion({ automatic: false });
});

async function enhanceCurrentSuggestion({ automatic = false } = {}) {
  if (!currentTabInfo || !currentSettings.aiEnabled || aiEnhanceInFlight) return;
  aiEnhanceInFlight = true;
  elements.enhanceBtn.disabled = true;
  elements.enhanceBtn.textContent = t(automatic ? 'aiAutoOptimizing' : 'optimizing');
  elements.aiMessage.classList.add('hidden');
  try {
    const response = await SmartFavAI.call(buildClassificationPrompt(currentTabInfo), currentSettings);
    const suggestion = await applyAIResponse(response);
    currentSuggestion = suggestion;
    showCategorySuggestion(suggestion);
    if (suggestion.createdCategory) {
      elements.aiMessage.textContent = t('aiCategoryCreated', {
        category: suggestion.createdCategory
      });
      elements.aiMessage.classList.remove('hidden');
      await renderFolders();
    }
  } catch (error) {
    elements.aiMessage.textContent = t('aiFallbackKept', { message: error.message });
    elements.aiMessage.classList.remove('hidden');
  } finally {
    aiEnhanceInFlight = false;
    elements.enhanceBtn.disabled = false;
    elements.enhanceBtn.textContent = t('aiOptimize');
  }
}

function buildClassificationPrompt(tabInfo) {
  const localEvidence = SmartFavClassifier.classify(tabInfo, currentSettings);
  const separator = currentSettings.language === 'zh_CN' ? '、' : ', ';
  const rules = currentSettings.categories
    .map((category) => {
      const keywords = currentSettings.keywordRules[category] || [];
      return `${category}=${keywords.join(', ')}`;
    })
    .join('\n');
  const evidence = Object.entries(localEvidence.scoreRatios || {})
    .sort((left, right) => right[1] - left[1])
    .map(([category, ratio]) => `${category}:${ratio}%`)
    .join(separator);
  const weights = localEvidence.weights || SmartFavClassifier.DEFAULT_WEIGHTS;
  return t('classifyPrompt', {
    title: tabInfo.title,
    url: tabInfo.url,
    description: tabInfo.description,
    keywords: Array.isArray(tabInfo.keywords) ? tabInfo.keywords.join(separator) : '',
    categories: currentSettings.categories.join(separator),
    rules,
    strategy: localEvidence.method,
    evidence,
    weights: `title=${weights.title}, tags=${weights.keywords}, url=${weights.url}, description=${weights.description}`,
    allowCreate: currentSettings.aiCreateCategories ? 'true' : 'false'
  });
}

function sanitizeAICategoryName(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 32);
}

async function applyAIResponse(response) {
  const match = String(response || '').match(/\{[\s\S]*\}/);
  if (!match) throw new Error(t('aiResponseInvalid'));
  const parsed = JSON.parse(match[0]);
  const preferredFallback = currentSettings.language === 'zh_CN' ? '其他' : 'Other';
  const fallback = currentSettings.categories.includes(preferredFallback)
    ? preferredFallback
    : currentSettings.categories[currentSettings.categories.length - 1];
  const requestedCategory = sanitizeAICategoryName(parsed.newCategory || parsed.category);
  const existingCategory = currentSettings.categories.find(
    (category) => normalizeCategoryName(category) === normalizeCategoryName(requestedCategory)
  );
  let category = existingCategory || fallback;
  let createdCategory = '';

  if (
    !existingCategory
    && requestedCategory
    && currentSettings.aiCreateCategories
    && currentSettings.categories.length < 50
  ) {
    const proposedKeywords = [
      ...(Array.isArray(parsed.newKeywords) ? parsed.newKeywords : []),
      ...(Array.isArray(parsed.keywords) ? parsed.keywords : []),
      ...(Array.isArray(parsed.tags) ? parsed.tags : [])
    ];
    const keywords = splitKeywords(proposedKeywords.join(',')).slice(0, 16);
    currentSettings = {
      ...currentSettings,
      categories: [...currentSettings.categories, requestedCategory],
      keywordRules: {
        ...currentSettings.keywordRules,
        [requestedCategory]: keywords
      }
    };
    await storageSet({ settings: currentSettings });
    category = requestedCategory;
    createdCategory = requestedCategory;
  }

  return {
    category,
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 4).map(String) : [],
    summary: String(parsed.summary || t('aiSummaryFallback')),
    source: 'ai',
    createdCategory
  };
}

elements.confirmBtn.addEventListener('click', async () => {
  if (!currentSuggestion || !currentTabInfo) return;
  elements.confirmBtn.disabled = true;
  elements.errorStatus.classList.add('hidden');
  try {
    const result = await storageGet(['favorites']);
    const favorites = Array.isArray(result.favorites) ? result.favorites : [];
    const selectedCategory = elements.categorySelect.value;
    const shouldLearn = Boolean(
      currentPageLearningProposal
      && currentPageLearningProposal.targetCategory === selectedCategory
      && elements.pageLearningCheckbox.checked
    );
    const learningResult = shouldLearn
      ? SmartFavClassifier.applyDomainLearning(
        currentSettings,
        currentPageLearningProposal
      )
      : null;
    const favorite = {
      ...currentTabInfo,
      category: selectedCategory,
      tags: currentSuggestion.tags,
      summary: currentSuggestion.summary,
      classificationSource: currentSuggestion.source,
      suggestedCategory: recommendedCategory,
      manuallyCategorized: selectedCategory !== recommendedCategory,
      createdAt: Date.now()
    };
    const withoutDuplicate = favorites.filter((item) => item.url !== favorite.url);
    const storageValues = {
      favorites: [favorite, ...withoutDuplicate]
    };
    if (learningResult) storageValues.settings = learningResult.settings;
    await storageSet(storageValues);
    if (learningResult) currentSettings = learningResult.settings;

    let successKey = 'savedToSmartFav';
    if (currentSettings.browserBookmarksEnabled) {
      try {
        const bookmarksApi = isExtension && chrome.bookmarks ? chrome.bookmarks : null;
        const bookmarkResult = await SmartFavBookmarks.writeFavorite(
          favorite,
          currentSettings,
          bookmarksApi
        );
        if (bookmarkResult.status === 'unavailable') {
          throw new Error(t('browserBookmarkUnavailable'));
        }
        successKey = 'savedToBrowser';
      } catch (error) {
        console.error('Browser favorite write failed:', error);
        successKey = 'savedBrowserFailed';
      }
    }

    pendingPageLearningUndo = learningResult;
    elements.categorySection.classList.add('hidden');
    elements.successMsg.textContent = learningResult
      ? t('savedAndRemembered', {
        status: t(successKey),
        domain: learningResult.domain,
        category: learningResult.targetCategory
      })
      : t(successKey);
    elements.pageLearningUndoBtn.classList.toggle('hidden', !learningResult);
    elements.pageLearningUndoBtn.disabled = false;
    elements.successStatus.classList.remove('hidden');
    await Promise.all([renderFolders(), renderRecentFavorites()]);
    elements.confirmBtn.disabled = false;
    schedulePopupClose(learningResult ? 6500 : 1300);
  } catch (error) {
    console.error('Favorite save failed:', error);
    elements.errorMsg.textContent = t('favoriteSaveFailed', {
      message: error && error.message ? error.message : String(error || '')
    });
    elements.errorStatus.classList.remove('hidden');
    elements.confirmBtn.disabled = false;
  }
});

function schedulePopupClose(delay) {
  if (!isExtension) return;
  if (popupCloseTimer) clearTimeout(popupCloseTimer);
  popupCloseTimer = setTimeout(() => window.close(), delay);
}

async function undoPageLearning() {
  if (!pendingPageLearningUndo) return;
  if (popupCloseTimer) {
    clearTimeout(popupCloseTimer);
    popupCloseTimer = null;
  }
  elements.pageLearningUndoBtn.disabled = true;
  const learningResult = pendingPageLearningUndo;
  try {
    const revertedSettings = SmartFavClassifier.revertDomainLearning(
      currentSettings,
      learningResult
    );
    await storageSet({ settings: revertedSettings });
    currentSettings = revertedSettings;
    pendingPageLearningUndo = null;
    elements.successMsg.textContent = t('learningUndone', {
      category: learningResult.targetCategory
    });
    elements.pageLearningUndoBtn.classList.add('hidden');
    schedulePopupClose(1800);
  } catch (error) {
    console.error('Domain learning undo failed:', error);
    elements.successMsg.textContent = t('learningUndoFailed');
    elements.pageLearningUndoBtn.disabled = false;
  }
}

elements.pageLearningUndoBtn.addEventListener('click', undoPageLearning);

async function renderFolders() {
  activeFavoriteCategory = null;
  const result = await storageGet(['favorites', 'settings', 'favoriteOrder']);
  const favorites = Array.isArray(result.favorites) ? result.favorites : [];
  const categories = result.settings && Array.isArray(result.settings.categories) && result.settings.categories.length
    ? result.settings.categories
    : currentSettings.categories;
  activeFavoriteOrder = normalizeFavoriteOrderMap(result.favoriteOrder);
  const counts = Object.fromEntries(categories.map((category) => [category, 0]));
  favorites.forEach((favorite) => {
    if (Object.prototype.hasOwnProperty.call(counts, favorite.category)) counts[favorite.category] += 1;
  });
  elements.totalCount.textContent = t('favoritesCount', { count: favorites.length });
  const librarySummary = t('librarySummary', {
    favorites: favorites.length,
    categories: categories.length
  });
  elements.librarySummary.textContent = librarySummary;
  elements.favoritesViewSummary.textContent = librarySummary;
  elements.categoryEntrySummary.textContent = t('categoryCount', { count: categories.length });
  elements.recentSection.classList.remove('hidden');
  elements.foldersHeading.classList.remove('hidden');
  elements.foldersList.classList.remove('list-view');
  elements.foldersList.innerHTML = categories.map((category) => `
    <button
      class="folder-item"
      type="button"
      draggable="true"
      data-category="${escapeHtml(category)}"
      aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight"
      title="${escapeHtml(t('dragFolderHint'))}"
    >
      <span class="reorder-grip folder-reorder-grip" aria-hidden="true"></span>
      <span class="folder-name">${escapeHtml(category)}</span>
      <span class="folder-count">${counts[category] || 0}</span>
    </button>
  `).join('');
  bindFolderInteractions(categories, favorites);
}

function normalizeFavoriteOrderMap(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function announceFavoriteReorder(message) {
  if (!elements.favoritesReorderStatus) return;
  elements.favoritesReorderStatus.textContent = '';
  requestAnimationFrame(() => {
    elements.favoritesReorderStatus.textContent = message;
  });
}

function showFavoriteReorderError(error) {
  const message = t('reorderFailed', {
    message: error && error.message ? error.message : String(error || '')
  });
  announceFavoriteReorder(message);
  elements.errorMsg.textContent = message;
  elements.errorStatus.classList.remove('hidden');
}

async function finishFavoriteReorder(message, order) {
  elements.errorStatus.classList.add('hidden');
  if (!currentSettings.browserBookmarksEnabled) {
    announceFavoriteReorder(message);
    return;
  }

  try {
    const response = await sendRuntimeMessage('syncManagedOrder', { order });
    if (
      !response
      || response.status === 'error'
      || response.status === 'unavailable'
      || response.status === 'invalid'
    ) {
      throw new Error(
        response && response.message
          ? response.message
          : t('browserBookmarkUnavailable')
      );
    }
    if (response.status === 'disabled') {
      announceFavoriteReorder(message);
      return;
    }
    if (response.status === 'missing' || (!response.matched && response.missing)) {
      announceFavoriteReorder(t('orderBrowserTargetMissing', { message }));
      return;
    }
    if (response.missing > 0) {
      announceFavoriteReorder(t('orderPartiallySyncedToBrowser', {
        message,
        count: response.missing
      }));
      return;
    }
    announceFavoriteReorder(t('orderSyncedToBrowser', { message }));
  } catch (error) {
    const syncError = t('orderBrowserSyncFailed', {
      message: error && error.message ? error.message : String(error || '')
    });
    announceFavoriteReorder(syncError);
    elements.errorMsg.textContent = syncError;
    elements.errorStatus.classList.remove('hidden');
  }
}

function clearReorderMarkers(container) {
  container.querySelectorAll('.is-drop-before, .is-drop-after, .is-dragging')
    .forEach((item) => {
      item.classList.remove('is-drop-before', 'is-drop-after', 'is-dragging');
    });
}

function markReorderTarget(container, target, placement) {
  container.querySelectorAll('.is-drop-before, .is-drop-after').forEach((item) => {
    item.classList.remove('is-drop-before', 'is-drop-after');
  });
  target.classList.add(placement === 'after' ? 'is-drop-after' : 'is-drop-before');
}

function getDropPlacement(event, target, layout = 'vertical') {
  const rect = target.getBoundingClientRect();
  const middleX = rect.left + rect.width / 2;
  const middleY = rect.top + rect.height / 2;
  if (layout === 'grid' && Math.abs(event.clientY - middleY) < rect.height * 0.3) {
    return event.clientX >= middleX ? 'after' : 'before';
  }
  return event.clientY >= middleY ? 'after' : 'before';
}

function focusReorderedItem(container, selector, dataKey, value) {
  const item = Array.from(container.querySelectorAll(selector))
    .find((candidate) => candidate.dataset[dataKey] === value);
  if (item) item.focus();
}

async function persistCategoryOrder(nextCategories, movedCategory) {
  if (
    !Array.isArray(nextCategories)
    || nextCategories.join('\u0000') === currentSettings.categories.join('\u0000')
  ) {
    return;
  }
  currentSettings = {
    ...currentSettings,
    categories: nextCategories
  };
  await storageSet({ settings: currentSettings });
  await renderFolders();
  focusReorderedItem(elements.foldersList, '.folder-item', 'category', movedCategory);
  const message = t('categoryOrderUpdated', {
    category: movedCategory,
    position: nextCategories.indexOf(movedCategory) + 1
  });
  await finishFavoriteReorder(message, { categories: nextCategories });
}

function bindFolderInteractions(categories, favorites) {
  let draggedCategory = '';
  let suppressClick = false;
  const items = Array.from(elements.foldersList.querySelectorAll('.folder-item'));

  items.forEach((item) => {
    item.addEventListener('click', (event) => {
      if (suppressClick) {
        event.preventDefault();
        return;
      }
      showFavoritesByCategory(item.dataset.category, favorites, activeFavoriteOrder);
    });

    item.addEventListener('keydown', (event) => {
      if (!event.altKey || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        return;
      }
      event.preventDefault();
      const offset = ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1;
      const nextCategories = SmartFavOrder.moveValue(categories, item.dataset.category, offset);
      persistCategoryOrder(nextCategories, item.dataset.category).catch(showFavoriteReorderError);
    });

    item.addEventListener('dragstart', (event) => {
      draggedCategory = item.dataset.category;
      suppressClick = true;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-smartfav-category', draggedCategory);
      event.dataTransfer.setData('text/plain', draggedCategory);
      requestAnimationFrame(() => item.classList.add('is-dragging'));
    });

    item.addEventListener('dragover', (event) => {
      if (!draggedCategory || draggedCategory === item.dataset.category) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      markReorderTarget(
        elements.foldersList,
        item,
        getDropPlacement(event, item, 'grid')
      );
    });

    item.addEventListener('drop', (event) => {
      if (!draggedCategory || draggedCategory === item.dataset.category) return;
      event.preventDefault();
      const placement = getDropPlacement(event, item, 'grid');
      const nextCategories = SmartFavOrder.reorderValues(
        categories,
        draggedCategory,
        item.dataset.category,
        placement
      );
      const movedCategory = draggedCategory;
      clearReorderMarkers(elements.foldersList);
      persistCategoryOrder(nextCategories, movedCategory).catch(showFavoriteReorderError);
    });

    item.addEventListener('dragend', () => {
      draggedCategory = '';
      clearReorderMarkers(elements.foldersList);
      setTimeout(() => { suppressClick = false; }, 0);
    });
  });
}

async function renderRecentFavorites() {
  const result = await storageGet(['favorites']);
  const favorites = Array.isArray(result.favorites) ? result.favorites : [];
  if (favorites.length <= 3) showingAllFavorites = false;
  elements.viewAllBtn.classList.toggle('hidden', favorites.length <= 3);
  elements.viewAllBtn.textContent = t(showingAllFavorites ? 'showLess' : 'viewAll');
  elements.viewAllBtn.setAttribute('aria-expanded', String(showingAllFavorites));
  const visibleFavorites = showingAllFavorites ? favorites : favorites.slice(0, 3);
  if (!visibleFavorites.length) {
    elements.recentList.innerHTML = `<div class="empty-state">${escapeHtml(t('emptyFavorites'))}</div>`;
    return;
  }
  elements.recentList.innerHTML = visibleFavorites
    .map((favorite) => renderFavoriteRow(favorite))
    .join('');
  bindFavoriteActions(elements.recentList);
}

async function toggleAllFavorites() {
  showingAllFavorites = !showingAllFavorites;
  await renderRecentFavorites();
}

async function cleanupRecentlyDeletedItems() {
  if (isExtension) return sendRuntimeMessage('cleanupRecentlyDeleted');
  const result = await storageGet(['recentlyDeleted']);
  const items = Array.isArray(result.recentlyDeleted) ? result.recentlyDeleted : [];
  const now = Date.now();
  const retained = items.filter((item) => {
    const deletedAt = Number(item.deletedAt) || now;
    return (Number(item.expiresAt) || deletedAt + TRASH_RETENTION_MS) > now;
  });
  if (retained.length !== items.length) {
    await storageSet({ recentlyDeleted: retained });
  }
  return { status: 'ok', removed: items.length - retained.length, items: retained };
}

async function getRecentlyDeletedItems() {
  if (isExtension) {
    const response = await sendRuntimeMessage('getRecentlyDeleted');
    if (!response || response.status !== 'ok') {
      throw new Error(response && response.message ? response.message : t('trashLoadFailed'));
    }
    return Array.isArray(response.items) ? response.items : [];
  }
  const cleanup = await cleanupRecentlyDeletedItems();
  return cleanup.items || [];
}

function renderTrashRow(item) {
  const title = item.title || item.url || t('untitledPage');
  const expiresAt = Number(item.expiresAt)
    || (Number(item.deletedAt) || Date.now()) + TRASH_RETENTION_MS;
  const days = Math.max(1, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
  return `
    <article class="trash-row">
      <div class="trash-copy">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(item.category || t('otherCategory'))} · ${escapeHtml(t('trashDaysLeft', { days }))}</span>
      </div>
      <div class="trash-actions">
        <button
          class="trash-restore-button"
          type="button"
          data-trash-id="${escapeHtml(item.trashId)}"
          aria-label="${escapeHtml(t('restoreFavorite', { title }))}"
        >${escapeHtml(t('restoreShort'))}</button>
        <button
          class="trash-delete-button"
          type="button"
          data-trash-id="${escapeHtml(item.trashId)}"
          aria-label="${escapeHtml(t('permanentlyDeleteFavorite', { title }))}"
        >${escapeHtml(t('deletePermanentlyShort'))}</button>
      </div>
    </article>
  `;
}

async function renderRecentlyDeleted() {
  try {
    const items = await getRecentlyDeletedItems();
    elements.trashEntryCount.textContent = String(items.length);
    elements.trashViewSummary.textContent = t('trashSummary', { count: items.length });
    elements.trashList.innerHTML = items.length
      ? items.map(renderTrashRow).join('')
      : `<div class="empty-state trash-empty">${escapeHtml(t('trashEmpty'))}</div>`;
    elements.trashList.querySelectorAll('.trash-restore-button').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        await restoreRecentlyDeleted(button.dataset.trashId);
      });
    });
    elements.trashList.querySelectorAll('.trash-delete-button').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        await permanentlyDeleteRecentlyDeleted(button.dataset.trashId);
      });
    });
  } catch (error) {
    elements.trashStatus.textContent = t('trashOperationFailed', { message: error.message });
    elements.trashStatus.className = 'compact-settings-status error';
  }
}

async function restoreRecentlyDeleted(trashId) {
  try {
    if (isExtension) {
      const response = await sendRuntimeMessage('restoreDeletedFavorite', { trashId });
      if (!response || response.status !== 'ok') {
        throw new Error(response && response.message ? response.message : t('trashRestoreFailed'));
      }
    } else {
      const result = await storageGet(['favorites', 'recentlyDeleted']);
      const items = Array.isArray(result.recentlyDeleted) ? result.recentlyDeleted : [];
      const entry = items.find((item) => item.trashId === trashId);
      if (!entry) throw new Error(t('trashItemMissing'));
      const {
        trashId: _trashId,
        deletedAt: _deletedAt,
        expiresAt: _expiresAt,
        ...favorite
      } = entry;
      const favorites = Array.isArray(result.favorites) ? result.favorites : [];
      await storageSet({
        favorites: [favorite, ...favorites.filter((item) => item.url !== favorite.url)],
        recentlyDeleted: items.filter((item) => item.trashId !== trashId)
      });
    }
    elements.trashStatus.textContent = t('trashRestored');
    elements.trashStatus.className = 'compact-settings-status success';
    await Promise.all([renderFolders(), renderRecentFavorites(), renderRecentlyDeleted()]);
  } catch (error) {
    elements.trashStatus.textContent = t('trashOperationFailed', { message: error.message });
    elements.trashStatus.className = 'compact-settings-status error';
    await renderRecentlyDeleted();
  }
}

async function permanentlyDeleteRecentlyDeleted(trashId) {
  try {
    if (isExtension) {
      const response = await sendRuntimeMessage('permanentlyDeleteFavorite', { trashId });
      if (!response || response.status !== 'ok') {
        throw new Error(response && response.message ? response.message : t('trashDeleteFailed'));
      }
    } else {
      const result = await storageGet(['recentlyDeleted']);
      const items = Array.isArray(result.recentlyDeleted) ? result.recentlyDeleted : [];
      await storageSet({
        recentlyDeleted: items.filter((item) => item.trashId !== trashId)
      });
    }
    elements.trashStatus.textContent = t('trashDeletedPermanently');
    elements.trashStatus.className = 'compact-settings-status success';
    await renderRecentlyDeleted();
  } catch (error) {
    elements.trashStatus.textContent = t('trashOperationFailed', { message: error.message });
    elements.trashStatus.className = 'compact-settings-status error';
    await renderRecentlyDeleted();
  }
}

function showFavoritesByCategory(category, favorites, favoriteOrder = activeFavoriteOrder) {
  activeFavoriteCategory = category;
  activeFavoriteOrder = normalizeFavoriteOrderMap(favoriteOrder);
  elements.recentSection.classList.add('hidden');
  elements.foldersHeading.classList.add('hidden');
  renderFavoriteList(category, favorites, activeFavoriteOrder);
}

function renderFavoriteList(title, favorites, favoriteOrder = activeFavoriteOrder) {
  const orderedFavorites = SmartFavOrder.applyFavoriteOrder(
    favorites,
    title,
    favoriteOrder[title]
  );
  elements.foldersList.classList.add('list-view');
  elements.foldersList.innerHTML = `
    <div class="category-header">
      <button class="back-button" id="backToFolders" type="button">${escapeHtml(t('backToCategories'))}</button>
      <div class="category-heading">
        <span class="category-title">${escapeHtml(title)}</span>
        <span class="category-count">${escapeHtml(t('favoritesCount', { count: orderedFavorites.length }))}</span>
      </div>
    </div>
    <div class="favorite-list-rows">
      ${orderedFavorites.length
        ? orderedFavorites.map((favorite) => renderFavoriteRow(favorite, {
          showCategory: false,
          inFolder: true
        })).join('')
        : `<div class="empty-state">${escapeHtml(t('emptyCategory'))}</div>`}
    </div>
  `;
  document.getElementById('backToFolders').addEventListener('click', renderFolders);
  bindFavoriteActions(elements.foldersList);
  bindFavoriteReordering(elements.foldersList, title);
}

function renderFavoriteRow(favorite, { showCategory = true, inFolder = false } = {}) {
  const image = favorite.favicon
    ? `<img src="${escapeHtml(favorite.favicon)}" class="favicon" alt="">`
    : '';
  const title = favorite.title || t('untitledPage');
  const hostname = getHostname(favorite.url);
  const category = favorite.category || t('otherCategory');
  const metadata = showCategory ? `${category} · ${hostname}` : hostname;
  const reorderAttributes = inFolder
    ? `
      draggable="true"
      data-favorite-url="${escapeHtml(favorite.url)}"
      data-category="${escapeHtml(category)}"
      title="${escapeHtml(t('dragFavoriteHint'))}"`
    : '';
  const keyboardAttributes = inFolder
    ? 'aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"'
    : '';
  const targetCategories = (Array.isArray(currentSettings.categories)
    ? currentSettings.categories
    : [])
    .filter((item) => item && item !== category);
  const moveSelect = inFolder && targetCategories.length
    ? `
      <select
        class="favorite-move-select"
        draggable="false"
        data-url="${escapeHtml(favorite.url)}"
        data-current-category="${escapeHtml(category)}"
        aria-label="${escapeHtml(t('moveFavorite', { title }))}"
        title="${escapeHtml(t('moveFavorite', { title }))}"
      >
        <option value="" selected disabled>${escapeHtml(t('moveShort'))}</option>
        ${targetCategories.map((targetCategory) => (
          `<option value="${escapeHtml(targetCategory)}">${escapeHtml(targetCategory)}</option>`
        )).join('')}
      </select>`
    : '';
  const deleteButton = `
    <button
      class="favorite-delete-button"
      type="button"
      draggable="false"
      data-url="${escapeHtml(favorite.url)}"
      aria-label="${escapeHtml(t('deleteFavorite', { title }))}"
    >${escapeHtml(t('deleteShort'))}</button>
  `;
  return `
    <article
      class="favorite-row favorite-row-card${inFolder ? ' favorite-row-in-folder' : ''}"
      ${reorderAttributes}
    >
      ${inFolder ? '<span class="reorder-grip favorite-reorder-grip" aria-hidden="true"></span>' : ''}
      <button
        class="recent-item favorite-link"
        type="button"
        data-url="${escapeHtml(favorite.url)}"
        title="${escapeHtml(`${title} · ${hostname}`)}"
        ${keyboardAttributes}
      >
        ${image}
        <span class="recent-info">
          <span class="recent-title">${escapeHtml(title)}</span>
          <span class="recent-category">${escapeHtml(metadata)}</span>
        </span>
      </button>
      ${inFolder
        ? `<div class="favorite-row-actions${moveSelect ? '' : ' only-delete'}">${moveSelect}${deleteButton}</div>`
        : deleteButton}
    </article>
  `;
}

function bindFavoriteActions(container) {
  container.querySelectorAll('.favicon').forEach((image) => {
    image.addEventListener('error', () => image.remove(), { once: true });
  });
  container.querySelectorAll('.favorite-link').forEach((item) => {
    item.addEventListener('click', () => {
      if (Date.now() < favoriteOpenSuppressUntil) return;
      openUrl(item.dataset.url);
    });
  });
  container.querySelectorAll('.favorite-delete-button').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      const deleted = await deleteFavorite(button.dataset.url);
      if (!deleted) button.disabled = false;
    });
  });
  container.querySelectorAll('.favorite-move-select').forEach((select) => {
    select.addEventListener('pointerdown', (event) => event.stopPropagation());
    select.addEventListener('dragstart', (event) => event.preventDefault());
    select.addEventListener('change', async () => {
      const targetCategory = select.value;
      if (!targetCategory) return;
      select.disabled = true;
      const moved = await moveFavoriteToCategory(select.dataset.url, targetCategory);
      if (!moved) {
        select.disabled = false;
        select.value = '';
      }
    });
  });
}

async function moveFavoriteToCategory(url, targetCategory) {
  const categoryToKeep = activeFavoriteCategory;
  try {
    const response = await sendRuntimeMessage('moveFavoriteToCategory', {
      url,
      targetCategory
    });
    if (!response || response.status !== 'ok') {
      throw new Error(
        response && response.message
          ? response.message
          : t('browserBookmarkUnavailable')
      );
    }

    const title = response.favorite && response.favorite.title
      ? response.favorite.title
      : url;
    let message = t('favoriteCategoryUpdated', {
      title,
      category: targetCategory
    });
    let syncFailed = false;
    if (response.browserStatus === 'ok') {
      message = t('favoriteCategorySynced', {
        title,
        category: targetCategory
      });
    } else if (response.browserStatus === 'missing') {
      message = t('favoriteCategoryBrowserMissing', {
        title,
        category: targetCategory
      });
    } else if (
      response.browserStatus === 'error'
      || response.browserStatus === 'unavailable'
      || response.browserStatus === 'invalid'
    ) {
      syncFailed = true;
      message = t('favoriteCategorySyncFailed', {
        message: response.message || t('browserBookmarkUnavailable')
      });
    }

    announceFavoriteReorder(message);
    elements.errorStatus.classList.toggle('hidden', !syncFailed);
    if (syncFailed) elements.errorMsg.textContent = message;

    const result = await storageGet(['favorites', 'favoriteOrder']);
    const favorites = Array.isArray(result.favorites) ? result.favorites : [];
    await renderRecentFavorites();
    if (categoryToKeep) {
      showFavoritesByCategory(categoryToKeep, favorites, result.favoriteOrder);
    } else {
      await renderFolders();
    }
    showClassificationLearningPrompt(
      response.favorite || { title, url },
      targetCategory
    );
    return true;
  } catch (error) {
    const message = t('favoriteMoveFailed', {
      message: error && error.message ? error.message : String(error || '')
    });
    announceFavoriteReorder(message);
    elements.errorMsg.textContent = message;
    elements.errorStatus.classList.remove('hidden');
    return false;
  }
}

function hideClassificationLearningPrompt() {
  pendingLearningProposal = null;
  elements.classificationLearningPrompt.classList.add('hidden');
  elements.classificationLearningPrompt.classList.remove('is-saved', 'is-error');
  elements.classificationLearningRememberBtn.hidden = false;
  elements.classificationLearningRememberBtn.disabled = false;
  elements.classificationLearningRememberBtn.textContent = t('rememberClassification');
  elements.classificationLearningDismissBtn.textContent = t('skipLearning');
}

function showClassificationLearningPrompt(favorite, targetCategory) {
  const proposal = SmartFavClassifier.createDomainLearningProposal(
    favorite,
    targetCategory,
    currentSettings
  );
  if (!proposal) {
    hideClassificationLearningPrompt();
    return;
  }
  pendingLearningProposal = proposal;
  elements.classificationLearningPrompt.classList.remove('hidden', 'is-saved', 'is-error');
  elements.classificationLearningTitle.textContent = t('rememberClassificationTitle');
  elements.classificationLearningMessage.textContent = t('rememberClassificationMessage', {
    domain: proposal.domain,
    category: proposal.targetCategory
  });
  elements.classificationLearningHint.textContent = proposal.previousCategories.length
    ? t('rememberClassificationConflictHint', {
      categories: proposal.previousCategories.join('、')
    })
    : t('rememberClassificationHint', { rule: proposal.keyword });
  elements.classificationLearningRememberBtn.hidden = false;
  elements.classificationLearningRememberBtn.disabled = false;
  elements.classificationLearningRememberBtn.textContent = t('rememberClassification');
  elements.classificationLearningDismissBtn.textContent = t('skipLearning');
}

async function rememberClassificationLearning() {
  if (!pendingLearningProposal) return;
  const proposal = pendingLearningProposal;
  elements.classificationLearningRememberBtn.disabled = true;
  try {
    const learned = SmartFavClassifier.applyDomainLearning(currentSettings, proposal);
    currentSettings = learned.settings;
    await storageSet({ settings: currentSettings });
    pendingLearningProposal = null;
    elements.classificationLearningPrompt.classList.remove('is-error');
    elements.classificationLearningPrompt.classList.add('is-saved');
    elements.classificationLearningTitle.textContent = t('learningSavedTitle');
    elements.classificationLearningMessage.textContent = t('learningSaved', {
      domain: learned.domain,
      category: learned.targetCategory
    });
    elements.classificationLearningHint.textContent = t('rememberClassificationHint', {
      rule: learned.keyword
    });
    elements.classificationLearningRememberBtn.hidden = true;
    elements.classificationLearningDismissBtn.textContent = t('done');
    announceFavoriteReorder(elements.classificationLearningMessage.textContent);
  } catch (error) {
    elements.classificationLearningPrompt.classList.add('is-error');
    elements.classificationLearningMessage.textContent = t('learningSaveFailed', {
      message: error && error.message ? error.message : String(error || '')
    });
    elements.classificationLearningRememberBtn.disabled = false;
  }
}

async function saveFavoriteOrder(category, nextUrls, movedUrl, favorites, favoriteOrder) {
  const currentUrls = SmartFavOrder.applyFavoriteOrder(
    favorites,
    category,
    favoriteOrder[category]
  ).map((favorite) => favorite.url);
  if (nextUrls.join('\u0000') === currentUrls.join('\u0000')) return;

  const nextFavoriteOrder = {
    ...favoriteOrder,
    [category]: nextUrls
  };
  await storageSet({ favoriteOrder: nextFavoriteOrder });
  activeFavoriteOrder = nextFavoriteOrder;
  showFavoritesByCategory(category, favorites, nextFavoriteOrder);
  focusReorderedItem(elements.foldersList, '.favorite-link', 'url', movedUrl);

  const movedFavorite = favorites.find((favorite) => favorite.url === movedUrl);
  const message = t('favoriteOrderUpdated', {
    title: movedFavorite && movedFavorite.title ? movedFavorite.title : movedUrl,
    position: nextUrls.indexOf(movedUrl) + 1
  });
  await finishFavoriteReorder(message, {
    category,
    orderedUrls: nextUrls
  });
}

async function reorderFavorite(category, sourceUrl, targetUrl, placement) {
  const result = await storageGet(['favorites', 'favoriteOrder']);
  const favorites = Array.isArray(result.favorites) ? result.favorites : [];
  const favoriteOrder = normalizeFavoriteOrderMap(result.favoriteOrder);
  const nextUrls = SmartFavOrder.reorderFavoriteUrls(
    favorites,
    category,
    favoriteOrder[category],
    sourceUrl,
    targetUrl,
    placement
  );
  await saveFavoriteOrder(category, nextUrls, sourceUrl, favorites, favoriteOrder);
}

async function moveFavorite(category, sourceUrl, offset) {
  const result = await storageGet(['favorites', 'favoriteOrder']);
  const favorites = Array.isArray(result.favorites) ? result.favorites : [];
  const favoriteOrder = normalizeFavoriteOrderMap(result.favoriteOrder);
  const nextUrls = SmartFavOrder.moveFavoriteUrl(
    favorites,
    category,
    favoriteOrder[category],
    sourceUrl,
    offset
  );
  await saveFavoriteOrder(category, nextUrls, sourceUrl, favorites, favoriteOrder);
}

function bindFavoriteReordering(container, category) {
  let draggedUrl = '';
  const rows = Array.from(container.querySelectorAll('.favorite-row-in-folder'));

  rows.forEach((row) => {
    const link = row.querySelector('.favorite-link');
    if (link) {
      link.addEventListener('keydown', (event) => {
        if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        const offset = event.key === 'ArrowUp' ? -1 : 1;
        moveFavorite(category, link.dataset.url, offset).catch(showFavoriteReorderError);
      });
    }

    row.addEventListener('dragstart', (event) => {
      if (event.target.closest('.favorite-delete-button, .favorite-move-select')) {
        event.preventDefault();
        return;
      }
      draggedUrl = row.dataset.favoriteUrl;
      favoriteOpenSuppressUntil = Date.now() + 1000;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-smartfav-favorite', draggedUrl);
      event.dataTransfer.setData('text/plain', draggedUrl);
      requestAnimationFrame(() => row.classList.add('is-dragging'));
    });

    row.addEventListener('dragover', (event) => {
      if (!draggedUrl || draggedUrl === row.dataset.favoriteUrl) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      markReorderTarget(container, row, getDropPlacement(event, row));
    });

    row.addEventListener('drop', (event) => {
      if (!draggedUrl || draggedUrl === row.dataset.favoriteUrl) return;
      event.preventDefault();
      const placement = getDropPlacement(event, row);
      const movedUrl = draggedUrl;
      clearReorderMarkers(container);
      reorderFavorite(
        category,
        movedUrl,
        row.dataset.favoriteUrl,
        placement
      ).catch(showFavoriteReorderError);
    });

    row.addEventListener('dragend', () => {
      draggedUrl = '';
      favoriteOpenSuppressUntil = Date.now() + 180;
      clearReorderMarkers(container);
    });
  });
}

async function deleteFavorite(url) {
  if (!url) return false;
  const categoryToKeep = activeView === 'favorites' ? activeFavoriteCategory : null;
  try {
    if (isExtension) {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'deleteFavorite', url }, (result) => {
          const runtimeError = chrome.runtime.lastError;
          resolve(runtimeError
            ? { status: 'error', message: runtimeError.message }
            : result);
        });
      });
      if (!response || response.status !== 'ok') {
        throw new Error(response && response.message
          ? response.message
          : t('browserBookmarkUnavailable'));
      }
    } else {
      const result = await storageGet(['favorites', 'recentlyDeleted']);
      const favorites = Array.isArray(result.favorites) ? result.favorites : [];
      const recentlyDeleted = Array.isArray(result.recentlyDeleted)
        ? result.recentlyDeleted
        : [];
      const removedFavorites = favorites.filter((favorite) => favorite.url === url);
      const now = Date.now();
      await storageSet({
        favorites: favorites.filter((favorite) => favorite.url !== url),
        recentlyDeleted: [
          ...removedFavorites.map((favorite, index) => ({
            ...favorite,
            trashId: `trash-${now}-${index}`,
            deletedAt: now,
            expiresAt: now + TRASH_RETENTION_MS
          })),
          ...recentlyDeleted.filter((item) => item.url !== url)
        ]
      });
    }
    elements.errorStatus.classList.add('hidden');
    await Promise.all([renderFolders(), renderRecentFavorites(), renderRecentlyDeleted()]);
    if (categoryToKeep) {
      const result = await storageGet(['favorites', 'favoriteOrder']);
      const favorites = Array.isArray(result.favorites) ? result.favorites : [];
      showFavoritesByCategory(categoryToKeep, favorites, result.favoriteOrder);
    }
    return true;
  } catch (error) {
    console.error('Favorite delete failed:', error);
    elements.errorMsg.textContent = t('deleteSyncFailed', { message: error.message });
    elements.errorStatus.classList.remove('hidden');
    return false;
  }
}

function openUrl(url) {
  if (!url) return;
  if (!isExtension) {
    window.open(url, '_blank', 'noopener');
    return;
  }
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs && tabs[0];
    if (activeTab && activeTab.id != null) {
      chrome.tabs.update(activeTab.id, { url }, () => window.close());
      return;
    }
    chrome.tabs.create({ url });
  });
}

function showError(message) {
  elements.loadingStatus.classList.add('hidden');
  elements.categorySection.classList.add('hidden');
  elements.errorStatus.classList.remove('hidden');
  elements.errorMsg.textContent = message;
}

function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (_) {
    return t('currentPageFallback');
  }
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

elements.modeBtn.addEventListener('click', toggleColorMode);
elements.languageBtn.addEventListener('click', switchLanguage);
elements.viewAllBtn.addEventListener('click', toggleAllFavorites);
elements.favoritesNavBtn.addEventListener('click', () => showView('favorites'));
elements.categoryFoldersNavBtn.addEventListener('click', () => showView('categories'));
elements.favoritesBackBtn.addEventListener('click', () => showView('home'));
elements.categoriesBackBtn.addEventListener('click', () => showView('home'));
elements.trashNavBtn.addEventListener('click', () => showView('trash'));
elements.trashBackBtn.addEventListener('click', () => showView('favorites'));
elements.classificationLearningDismissBtn.addEventListener(
  'click',
  hideClassificationLearningPrompt
);
elements.classificationLearningRememberBtn.addEventListener(
  'click',
  rememberClassificationLearning
);
elements.settingsBtn.addEventListener('click', () => {
  showView(activeView === 'home' ? 'settings' : 'home');
});

async function showView(view) {
  activeView = ['home', 'favorites', 'categories', 'trash', 'settings'].includes(view)
    ? view
    : 'home';
  if (activeView !== 'favorites') hideClassificationLearningPrompt();
  elements.mainView.classList.toggle('hidden', activeView !== 'home');
  elements.favoritesView.classList.toggle('hidden', activeView !== 'favorites');
  elements.categoriesView.classList.toggle('hidden', activeView !== 'categories');
  elements.trashView.classList.toggle('hidden', activeView !== 'trash');
  elements.settingsView.classList.toggle('hidden', activeView !== 'settings');
  applyLanguage();

  if (activeView === 'favorites') {
    await Promise.all([renderFolders(), renderRecentFavorites()]);
  } else if (activeView === 'categories') {
    populateCategoryManager();
  } else if (activeView === 'trash') {
    elements.trashStatus.textContent = '';
    elements.trashStatus.className = 'compact-settings-status';
    await renderRecentlyDeleted();
  } else if (activeView === 'settings') {
    populateCompactSettings();
  } else {
    applyAppearance();
  }
}

function populateCompactSettings() {
  elements.compactThemeStyle.value = normalizeThemeStyle(currentSettings.themeStyle);
  previewThemeStyle = elements.compactThemeStyle.value;
  pendingBackgroundImage = currentSettings.customBackgroundImage || '';
  elements.compactDarkMode.checked = currentSettings.colorMode === 'dark'
    || currentSettings.themeStyle === 'black';
  elements.compactPopupWidth.value = String(currentSettings.popupWidth);
  elements.compactPopupHeight.value = String(currentSettings.popupHeight);
  elements.compactAiEnabled.checked = currentSettings.aiEnabled;
  elements.compactProvider.value = currentSettings.apiProvider || 'ollama';
  const provider = SmartFavAI.getProvider(elements.compactProvider.value);
  elements.compactApiEndpoint.value = currentSettings.apiEndpoint || provider.endpoint;
  elements.compactModel.value = currentSettings.model || provider.model;
  elements.compactApiKey.value = currentSettings.apiKey || '';
  elements.compactClassificationMode.value = currentSettings.classificationMode || 'weighted';
  elements.compactKeywordWeight.value = String(
    SmartFavClassifier.normalizeWeights(currentSettings.classificationWeights).keywords
  );
  elements.compactAiAutoClassify.checked = currentSettings.aiAutoClassify !== false;
  elements.compactAiCreateCategories.checked = Boolean(currentSettings.aiCreateCategories);
  elements.compactBrowserBookmarksEnabled.checked = currentSettings.browserBookmarksEnabled;
  elements.compactBookmarkWriteMode.value = currentSettings.bookmarkWriteMode || 'overwrite';
  elements.compactBookmarkOrganizeEnabled.checked = Boolean(currentSettings.bookmarkOrganizeEnabled);
  elements.compactBookmarkAutoCapture.checked = Boolean(currentSettings.bookmarkAutoCaptureEnabled);
  elements.compactSettingsStatus.textContent = '';
  elements.compactSettingsStatus.className = 'compact-settings-status';
  showBookmarkBackupStatus();
  updateCompactAIFields(false);
  updateCompactBookmarkFields();
  updateAppearancePreview();
  updatePopupSizeLabels();
  updateBackgroundImagePreview();
  refreshBookmarkRestorePoints();
}

function formatBookmarkRestoreTime(timestamp) {
  const date = new Date(Number(timestamp) || 0);
  if (!Number.isFinite(date.getTime()) || !Number(timestamp)) return '—';
  return new Intl.DateTimeFormat(
    currentSettings.language === 'zh_CN' ? 'zh-CN' : 'en',
    {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  ).format(date);
}

function showBookmarkBackupStatus(message = '', type = '') {
  elements.bookmarkBackupStatus.textContent = message;
  elements.bookmarkBackupStatus.className = `bookmark-backup-status${type ? ` ${type}` : ''}`;
}

function hasRestorableBookmarkPoint(point) {
  return Boolean(point) && Number(point.bookmarkCount) > 0;
}

function setBookmarkBackupBusy(busy) {
  const hasRestorablePoint = hasRestorableBookmarkPoint(currentBookmarkRestorePoint);
  [
    elements.bookmarkBackupCreateBtn,
    elements.bookmarkBackupPreviewBtn,
    elements.bookmarkBackupRestoreBtn,
    elements.bookmarkBackupExportBtn
  ].forEach((button) => {
    button.disabled = Boolean(busy)
      || (button !== elements.bookmarkBackupCreateBtn && !hasRestorablePoint);
  });
  elements.bookmarkBackupImportInput.disabled = Boolean(busy);
}

function renderBookmarkRestorePointState(response) {
  const points = response && Array.isArray(response.points) ? response.points : [];
  const activePoint = response && response.activePoint;
  const latestPoint = activePoint || points[0] || null;
  currentBookmarkRestorePoint = latestPoint;
  const hasRestorablePoint = hasRestorableBookmarkPoint(latestPoint);
  const legacyManagedCount = Number(latestPoint && latestPoint.legacyManagedCount) || 0;

  elements.bookmarkBackupBadge.classList.toggle(
    'is-active',
    Boolean(activePoint) && hasRestorablePoint
  );
  elements.bookmarkBackupBadge.classList.toggle(
    'is-limited',
    Boolean(latestPoint) && !hasRestorablePoint && legacyManagedCount > 0
  );
  if (latestPoint && !hasRestorablePoint && legacyManagedCount > 0) {
    elements.bookmarkBackupBadge.textContent = t('bookmarkRestoreLegacyOnlyBadge');
    elements.bookmarkBackupSummary.textContent = t('bookmarkRestoreLegacyOnlySummary', {
      count: legacyManagedCount
    });
  } else if (latestPoint && !hasRestorablePoint) {
    elements.bookmarkBackupBadge.textContent = t('bookmarkRestoreNothingBadge');
    elements.bookmarkBackupSummary.textContent = t('bookmarkRestoreNothingSummary');
  } else if (activePoint) {
    elements.bookmarkBackupBadge.textContent = t('bookmarkRestoreActiveBadge');
    elements.bookmarkBackupSummary.textContent = t('bookmarkRestoreActiveSummary', {
      count: activePoint.bookmarkCount || 0,
      folders: activePoint.folderCount || 0,
      time: formatBookmarkRestoreTime(activePoint.updatedAt || activePoint.createdAt)
    });
  } else if (latestPoint) {
    elements.bookmarkBackupBadge.textContent = t('bookmarkRestoreDoneBadge');
    elements.bookmarkBackupSummary.textContent = t('bookmarkRestoreDoneSummary', {
      time: formatBookmarkRestoreTime(latestPoint.restoredAt || latestPoint.updatedAt)
    });
  } else {
    elements.bookmarkBackupBadge.textContent = t('bookmarkRestoreEmptyBadge');
    elements.bookmarkBackupSummary.textContent = t('bookmarkRestoreEmpty');
  }

  if (hasRestorablePoint && legacyManagedCount > 0) {
    elements.bookmarkBackupSummary.textContent += ` ${t('bookmarkRestoreLegacy', {
      count: legacyManagedCount
    })}`;
  }
  setBookmarkBackupBusy(false);
}

async function refreshBookmarkRestorePoints() {
  try {
    const response = await sendRuntimeMessage('getBookmarkRestorePoints');
    if (!response || response.status !== 'ok') {
      throw new Error(response && response.message
        ? response.message
        : t('bookmarkRestoreUnavailable'));
    }
    renderBookmarkRestorePointState(response);
  } catch (error) {
    currentBookmarkRestorePoint = null;
    renderBookmarkRestorePointState({ status: 'error', points: [], activePoint: null });
    showBookmarkBackupStatus(
      t('bookmarkRestoreOperationFailed', { message: error.message }),
      'error'
    );
  }
}

async function createOrUpdateBookmarkRestorePoint() {
  setBookmarkBackupBusy(true);
  showBookmarkBackupStatus();
  try {
    const response = await sendRuntimeMessage('createBookmarkRestorePoint');
    if (!response || response.status !== 'ok') {
      throw new Error(response && response.message
        ? response.message
        : t('bookmarkRestoreUnavailable'));
    }
    const bookmarkCount = Number(response.point && response.point.bookmarkCount) || 0;
    const legacyManagedCount = Number(response.point && response.point.legacyManagedCount) || 0;
    const statusKey = bookmarkCount > 0
      ? 'bookmarkRestoreCreated'
      : legacyManagedCount > 0
        ? 'bookmarkRestoreScannedLegacy'
        : 'bookmarkRestoreScannedEmpty';
    showBookmarkBackupStatus(t(statusKey, {
      count: bookmarkCount > 0 ? bookmarkCount : legacyManagedCount
    }), 'success');
    await refreshBookmarkRestorePoints();
  } catch (error) {
    showBookmarkBackupStatus(
      t('bookmarkRestoreOperationFailed', { message: error.message }),
      'error'
    );
  } finally {
    setBookmarkBackupBusy(false);
  }
}

async function previewBookmarkRestore() {
  if (!hasRestorableBookmarkPoint(currentBookmarkRestorePoint)) return;
  setBookmarkBackupBusy(true);
  showBookmarkBackupStatus();
  try {
    const response = await sendRuntimeMessage('previewBookmarkRestore', {
      pointId: currentBookmarkRestorePoint.id
    });
    if (!response || response.status !== 'ok') {
      throw new Error(response && response.message
        ? response.message
        : t('bookmarkRestoreUnavailable'));
    }
    showBookmarkBackupStatus(t('bookmarkRestorePreviewDone', {
      movable: response.movable || 0,
      restored: response.alreadyRestored || 0,
      folders: response.foldersToRecreate || 0,
      missing: response.missingBookmarks || 0
    }), 'success');
  } catch (error) {
    showBookmarkBackupStatus(
      t('bookmarkRestoreOperationFailed', { message: error.message }),
      'error'
    );
  } finally {
    setBookmarkBackupBusy(false);
  }
}

async function restoreBookmarkFolders() {
  if (!hasRestorableBookmarkPoint(currentBookmarkRestorePoint)) return;
  if (!window.confirm(t('bookmarkRestoreConfirm'))) return;
  setBookmarkBackupBusy(true);
  showBookmarkBackupStatus();
  try {
    const response = await sendRuntimeMessage('restoreBookmarkLayout', {
      pointId: currentBookmarkRestorePoint.id
    });
    if (!response || !['ok', 'partial'].includes(response.status)) {
      throw new Error(response && response.message
        ? response.message
        : t('bookmarkRestoreUnavailable'));
    }
    if (response.status === 'partial') {
      const firstError = response.errors && response.errors[0];
      showBookmarkBackupStatus(t('bookmarkRestorePartial', {
        message: firstError && firstError.message
          ? firstError.message
          : `${response.unresolvedParents || 0}`
      }), 'error');
    } else {
      showBookmarkBackupStatus(t('bookmarkRestoreCompleted', {
        restored: response.restored || 0,
        unchanged: response.alreadyRestored || 0,
        folders: response.createdFolders || 0
      }), 'success');
    }
    await refreshBookmarkRestorePoints();
  } catch (error) {
    showBookmarkBackupStatus(
      t('bookmarkRestoreOperationFailed', { message: error.message }),
      'error'
    );
  } finally {
    setBookmarkBackupBusy(false);
  }
}

function downloadBookmarkRestorePayload(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `SmartFav-layout-backup-${date}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function exportBookmarkRestorePoints() {
  if (!hasRestorableBookmarkPoint(currentBookmarkRestorePoint)) return;
  setBookmarkBackupBusy(true);
  showBookmarkBackupStatus();
  try {
    const response = await sendRuntimeMessage('exportBookmarkRestorePoints');
    if (!response || response.status !== 'ok' || !response.payload) {
      throw new Error(response && response.message
        ? response.message
        : t('bookmarkRestoreUnavailable'));
    }
    downloadBookmarkRestorePayload(response.payload);
    showBookmarkBackupStatus(t('bookmarkRestoreExported'), 'success');
  } catch (error) {
    showBookmarkBackupStatus(
      t('bookmarkRestoreOperationFailed', { message: error.message }),
      'error'
    );
  } finally {
    setBookmarkBackupBusy(false);
  }
}

function readBookmarkRestoreFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result || '')), { once: true });
    reader.addEventListener('error', () => reject(new Error(t('bookmarkRestoreImportInvalid'))), { once: true });
    reader.readAsText(file);
  });
}

async function importBookmarkRestorePoints() {
  const file = elements.bookmarkBackupImportInput.files
    && elements.bookmarkBackupImportInput.files[0];
  if (!file) return;
  setBookmarkBackupBusy(true);
  showBookmarkBackupStatus();
  try {
    if (file.size > 8 * 1024 * 1024) {
      throw new Error(t('bookmarkRestoreImportTooLarge'));
    }
    let payload;
    try {
      payload = JSON.parse(await readBookmarkRestoreFile(file));
    } catch (error) {
      if (error && error.message === t('bookmarkRestoreImportTooLarge')) throw error;
      throw new Error(t('bookmarkRestoreImportInvalid'));
    }
    const response = await sendRuntimeMessage('importBookmarkRestorePoints', { payload });
    if (!response || response.status !== 'ok') {
      throw new Error(response && response.message
        ? response.message
        : t('bookmarkRestoreImportInvalid'));
    }
    showBookmarkBackupStatus(t('bookmarkRestoreImported', {
      count: response.imported || 0
    }), 'success');
    await refreshBookmarkRestorePoints();
  } catch (error) {
    showBookmarkBackupStatus(
      t('bookmarkRestoreOperationFailed', { message: error.message }),
      'error'
    );
  } finally {
    elements.bookmarkBackupImportInput.value = '';
    setBookmarkBackupBusy(false);
  }
}

function populateCategoryManager() {
  const mergedRules = SmartFavClassifier.mergeRules(
    currentSettings.categories,
    currentSettings.keywordRules,
    currentSettings.language
  );
  categoryDraft = currentSettings.categories.map((category) => ({
    name: category,
    keywords: [...(mergedRules[category] || [])]
  }));
  categoryKeywordSuggestionCounts = {};
  elements.compactNewCategory.value = '';
  renderCategoryRules();
  elements.categorySettingsStatus.textContent = '';
  elements.categorySettingsStatus.className = 'compact-settings-status';
}

function updateAppearancePreview() {
  const themeStyle = normalizeThemeStyle(elements.compactThemeStyle.value);
  const colorMode = themeStyle === 'black' || elements.compactDarkMode.checked ? 'dark' : 'light';
  elements.compactDarkMode.checked = colorMode === 'dark';
  elements.compactDarkMode.disabled = themeStyle === 'black';
  elements.compactDarkMode.title = themeStyle === 'black' ? t('blackThemeDarkOnly') : '';
  applyAppearance({
    ...currentSettings,
    themeStyle,
    colorMode,
    popupWidth: normalizePopupDimension(
      elements.compactPopupWidth.value,
      320,
      520,
      DEFAULT_SETTINGS.popupWidth
    ),
    popupHeight: normalizePopupDimension(
      elements.compactPopupHeight.value,
      420,
      600,
      DEFAULT_SETTINGS.popupHeight
    ),
    customBackgroundImage: pendingBackgroundImage
  });
  previewThemeStyle = themeStyle;
}

function updatePopupSizeLabels() {
  const width = normalizePopupDimension(
    elements.compactPopupWidth.value,
    320,
    520,
    DEFAULT_SETTINGS.popupWidth
  );
  const height = normalizePopupDimension(
    elements.compactPopupHeight.value,
    420,
    600,
    DEFAULT_SETTINGS.popupHeight
  );
  elements.compactPopupWidthValue.textContent = `${width}px`;
  elements.compactPopupHeightValue.textContent = `${height}px`;
}

function updateBackgroundImagePreview() {
  elements.backgroundImagePreview.classList.toggle('has-image', Boolean(pendingBackgroundImage));
  elements.backgroundImagePreview.style.backgroundImage = pendingBackgroundImage
    ? `url(${JSON.stringify(pendingBackgroundImage)})`
    : '';
  elements.clearBackgroundImageBtn.disabled = !pendingBackgroundImage;
}

function readBackgroundImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      reject(new Error(t('backgroundImageTypeError')));
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      reject(new Error(t('backgroundImageTooLarge')));
      return;
    }
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result || '')), { once: true });
    reader.addEventListener('error', () => reject(new Error(t('backgroundImageReadFailed'))), { once: true });
    reader.readAsDataURL(file);
  });
}

async function handleBackgroundImageChange() {
  const file = elements.compactBackgroundImage.files
    && elements.compactBackgroundImage.files[0];
  if (!file) return;
  try {
    pendingBackgroundImage = await readBackgroundImage(file);
    updateBackgroundImagePreview();
    updateAppearancePreview();
    await persistSettingsPatch(
      { customBackgroundImage: pendingBackgroundImage },
      { applyAppearanceNow: true, statusKey: 'backgroundImageReady' }
    );
  } catch (error) {
    showCompactSettingsStatus(error.message, 'error');
  } finally {
    elements.compactBackgroundImage.value = '';
  }
}

async function clearBackgroundImage() {
  pendingBackgroundImage = '';
  updateBackgroundImagePreview();
  updateAppearancePreview();
  await persistSettingsPatch(
    { customBackgroundImage: '' },
    { applyAppearanceNow: true, statusKey: 'backgroundImageCleared' }
  );
}

function handlePopupSizeInput() {
  updatePopupSizeLabels();
  updateAppearancePreview();
}

async function handlePopupSizeChange() {
  await persistSettingsPatch(
    {
      popupWidth: normalizePopupDimension(
        elements.compactPopupWidth.value,
        320,
        520,
        DEFAULT_SETTINGS.popupWidth
      ),
      popupHeight: normalizePopupDimension(
        elements.compactPopupHeight.value,
        420,
        600,
        DEFAULT_SETTINGS.popupHeight
      )
    },
    { applyAppearanceNow: true }
  );
}

async function handleThemeStyleChange() {
  const nextThemeStyle = normalizeThemeStyle(elements.compactThemeStyle.value);
  if (previewThemeStyle === 'black' && nextThemeStyle !== 'black') {
    elements.compactDarkMode.checked = false;
  }
  updateAppearancePreview();
  await persistSettingsPatch(
    {
      themeStyle: nextThemeStyle,
      colorMode: nextThemeStyle === 'black' || elements.compactDarkMode.checked
        ? 'dark'
        : 'light'
    },
    { applyAppearanceNow: true }
  );
}

async function handleDarkModeChange() {
  updateAppearancePreview();
  await persistSettingsPatch(
    {
      colorMode: elements.compactDarkMode.checked ? 'dark' : 'light'
    },
    { applyAppearanceNow: true }
  );
}

function updateCompactAIFields(resetModel) {
  const provider = SmartFavAI.getProvider(elements.compactProvider.value);
  elements.compactAiFields.classList.toggle('hidden', !elements.compactAiEnabled.checked);
  elements.compactApiKeyField.classList.toggle('hidden', !provider.requiresKey);
  elements.compactApiEndpointField.classList.toggle('hidden', !provider.customEndpoint);
  if (provider.customEndpoint && (resetModel || !elements.compactApiEndpoint.value.trim())) {
    elements.compactApiEndpoint.value = provider.endpoint;
  }
  if (resetModel || !elements.compactModel.value.trim()) elements.compactModel.value = provider.model;
  elements.compactKeywordWeightValue.textContent = elements.compactKeywordWeight.value;
}

function getApiEndpointValidation(provider) {
  if (!provider.customEndpoint) return null;
  return SmartFavAI.validateEndpoint(elements.compactApiEndpoint.value);
}

function showApiEndpointValidationError(validation) {
  const messageKeys = {
    required: 'apiEndpointRequired',
    invalid: 'apiEndpointInvalid',
    insecure: 'apiEndpointInsecure'
  };
  showCompactSettingsStatus(t(messageKeys[validation.code] || 'apiEndpointInvalid'), 'error');
}

function requestApiEndpointPermission(validation) {
  if (
    !isExtension
    || !chrome.permissions
    || typeof chrome.permissions.request !== 'function'
  ) {
    return Promise.resolve(true);
  }
  return new Promise((resolve, reject) => {
    chrome.permissions.request({ origins: [validation.originPattern] }, (granted) => {
      const runtimeError = chrome.runtime && chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve(Boolean(granted));
    });
  });
}

function updateCompactBookmarkFields() {
  elements.compactBookmarkFields.classList.toggle(
    'hidden',
    !elements.compactBrowserBookmarksEnabled.checked
  );
}

async function persistSettingsPatch(
  patch,
  {
    applyAppearanceNow = false,
    refreshSuggestion = false,
    statusKey = 'settingsAutoSaved'
  } = {}
) {
  currentSettings = { ...currentSettings, ...patch };
  const settingsSnapshot = { ...currentSettings };
  const saveTask = settingsSaveQueue
    .catch(() => undefined)
    .then(() => storageSet({ settings: settingsSnapshot }));
  settingsSaveQueue = saveTask;
  try {
    await saveTask;
    if (applyAppearanceNow) applyAppearance();
    if (refreshSuggestion && currentTabInfo) {
      currentSuggestion = SmartFavClassifier.classify(currentTabInfo, currentSettings);
      showCategorySuggestion(currentSuggestion);
    }
    showCompactSettingsStatus(t(statusKey), 'success');
    return true;
  } catch (error) {
    showCompactSettingsStatus(
      t('settingsAutoSaveFailed', { message: error.message }),
      'error'
    );
    return false;
  }
}

async function persistAISettings({ refreshSuggestion = false } = {}) {
  const provider = SmartFavAI.getProvider(elements.compactProvider.value);
  if (
    elements.compactAiEnabled.checked
    && provider.requiresKey
    && !elements.compactApiKey.value.trim()
  ) {
    showCompactSettingsStatus(t('apiKeyRequired'), 'error');
    return false;
  }
  if (elements.compactAiEnabled.checked && !elements.compactModel.value.trim()) {
    showCompactSettingsStatus(t('modelRequired'), 'error');
    return false;
  }

  const endpointValidation = getApiEndpointValidation(provider);
  if (endpointValidation && !endpointValidation.valid) {
    showApiEndpointValidationError(endpointValidation);
    return false;
  }
  if (elements.compactAiEnabled.checked && endpointValidation) {
    try {
      const granted = await requestApiEndpointPermission(endpointValidation);
      if (!granted) {
        showCompactSettingsStatus(t('apiEndpointPermissionDenied'), 'error');
        return false;
      }
    } catch (error) {
      showCompactSettingsStatus(
        t('apiEndpointPermissionFailed', { message: error.message }),
        'error'
      );
      return false;
    }
  }

  return persistSettingsPatch(
    {
      aiEnabled: elements.compactAiEnabled.checked,
      aiAutoClassify: elements.compactAiAutoClassify.checked,
      aiCreateCategories: elements.compactAiCreateCategories.checked,
      classificationMode: elements.compactClassificationMode.value === 'vector'
        ? 'vector'
        : 'weighted',
      classificationWeights: SmartFavClassifier.normalizeWeights({
        ...currentSettings.classificationWeights,
        keywords: Number(elements.compactKeywordWeight.value)
      }),
      apiProvider: elements.compactProvider.value,
      apiEndpoint: provider.customEndpoint && endpointValidation
        ? endpointValidation.endpoint
        : '',
      apiKey: elements.compactApiKey.value.trim(),
      model: elements.compactModel.value.trim() || provider.model
    },
    { refreshSuggestion }
  );
}

async function handleAIEnabledChange() {
  updateCompactAIFields(false);
  await persistAISettings({ refreshSuggestion: true });
}

async function handleAIProviderChange() {
  updateCompactAIFields(true);
  await persistAISettings();
}

async function handleAIClassificationChange() {
  await persistAISettings({ refreshSuggestion: true });
}

async function persistBookmarkSettings(patch) {
  return persistSettingsPatch(patch);
}

async function handleBrowserBookmarkWriteChange() {
  updateCompactBookmarkFields();
  await persistBookmarkSettings({
    browserBookmarksEnabled: elements.compactBrowserBookmarksEnabled.checked
  });
}

function getClassificationDraftSettings() {
  const categories = categoryDraft.map((item) => item.name);
  return {
    categories,
    keywordRules: Object.fromEntries(
      categoryDraft.map((item) => [item.name, [...item.keywords]])
    )
  };
}

async function handleBookmarkOrganizeChange() {
  const enabled = elements.compactBookmarkOrganizeEnabled.checked;
  const saved = await persistBookmarkSettings({
    bookmarkOrganizeEnabled: enabled
  });
  if (saved && enabled) await runOrganizeBookmarks();
}

async function handleBookmarkAutoCaptureChange() {
  await persistBookmarkSettings({
    bookmarkAutoCaptureEnabled: elements.compactBookmarkAutoCapture.checked
  });
}

async function handleBookmarkWriteModeChange() {
  await persistBookmarkSettings({
    bookmarkWriteMode: elements.compactBookmarkWriteMode.value === 'add'
      ? 'add'
      : 'overwrite'
  });
}

function normalizeCategoryName(value) {
  return String(value || '').normalize('NFKC').trim().toLocaleLowerCase();
}

function splitKeywords(value) {
  return SmartFavClassifier.splitKeywords(value);
}

function formatKeywords(value) {
  return SmartFavClassifier.formatKeywords(value);
}

function updateCategoryKeywordsFromInput(input, { format = false } = {}) {
  const index = Number(input.dataset.categoryIndex);
  if (!Number.isInteger(index) || !categoryDraft[index]) return;
  const keywords = splitKeywords(input.value);
  categoryDraft[index].keywords = keywords;
  if (!format) return;
  const formattedValue = formatKeywords(keywords);
  if (input.value.trim() === formattedValue) return;
  input.value = formattedValue;
  showCategorySettingsStatus(t('keywordsNormalized'), 'success');
}

function syncCategoryDraftFromInputs() {
  elements.categoryRulesList
    .querySelectorAll('.category-keywords-input')
    .forEach((input) => updateCategoryKeywordsFromInput(input));
}

function buildAIKeywordPrompt(profiles) {
  const folders = profiles.map((profile) => ({
    category: profile.category,
    existingKeywords: profile.existingKeywords,
    totalFavorites: profile.totalFavorites,
    favorites: profile.samples
  }));
  return t('aiKeywordPrompt', {
    folders: JSON.stringify(folders, null, 2)
  });
}

function buildPreviewAIKeywordResponse(profiles) {
  const keywordMap = {
    视频: ['影音平台', '在线直播'],
    Video: ['media platform', 'online streaming'],
    编程: ['开源项目', '代码协作'],
    Programming: ['open source', 'code collaboration'],
    工具: ['协作设计', '生产力应用'],
    Tools: ['collaborative design', 'productivity app'],
    学习: ['开发文档', '技术参考'],
    Learning: ['developer docs', 'technical reference'],
    项目资料: ['客户管理', '项目流程'],
    Projects: ['customer management', 'project workflow']
  };
  return JSON.stringify({
    categories: profiles.map((profile) => ({
      category: profile.category,
      keywords: keywordMap[profile.category] || []
    }))
  });
}

function requestAIKeywordSuggestions(profiles) {
  if (
    !isExtension
    && new URLSearchParams(window.location.search).get('aiKeywordPreview') === 'success'
  ) {
    return Promise.resolve(buildPreviewAIKeywordResponse(profiles));
  }
  return SmartFavAI.call(buildAIKeywordPrompt(profiles), currentSettings);
}

async function analyzeCategoryKeywordsWithAI() {
  if (aiKeywordAnalysisInFlight) return;
  if (!currentSettings.aiEnabled) {
    showCategorySettingsStatus(t('aiKeywordNeedsEnabled'), 'error');
    return;
  }
  const provider = SmartFavAI.getProvider(currentSettings.apiProvider);
  if (provider.requiresKey && !String(currentSettings.apiKey || '').trim()) {
    showCategorySettingsStatus(t('apiKeyRequired'), 'error');
    return;
  }
  if (!String(currentSettings.model || provider.model || '').trim()) {
    showCategorySettingsStatus(t('modelRequired'), 'error');
    return;
  }

  syncCategoryDraftFromInputs();
  const result = await storageGet(['favorites']);
  const favorites = Array.isArray(result.favorites) ? result.favorites : [];
  const profiles = SmartFavAIKeywordSuggestions.buildCategoryProfiles(
    categoryDraft,
    favorites
  );
  if (!profiles.length) {
    showCategorySettingsStatus(t('aiKeywordNoFavorites'), 'error');
    return;
  }
  const batches = SmartFavAIKeywordSuggestions.createBatches(profiles);
  const suggestions = [];
  aiKeywordAnalysisInFlight = true;
  elements.categoryKeywordAiAnalyzeBtn.disabled = true;
  elements.categorySaveBtn.disabled = true;
  elements.categoryKeywordAiAnalyzeBtn.textContent = t('optimizing');

  try {
    for (let index = 0; index < batches.length; index += 1) {
      const batch = batches[index];
      showCategorySettingsStatus(t('aiKeywordProgress', {
        current: index + 1,
        total: batches.length
      }), '');
      const response = await requestAIKeywordSuggestions(batch);
      suggestions.push(...SmartFavAIKeywordSuggestions.parseKeywordSuggestions(
        response,
        batch.map((profile) => profile.category)
      ));
    }

    syncCategoryDraftFromInputs();
    const merged = SmartFavAIKeywordSuggestions.mergeIntoCategoryDraft(
      categoryDraft,
      suggestions
    );
    if (!merged.addedCount) {
      showCategorySettingsStatus(t('aiKeywordNoNew'), 'success');
      return;
    }
    categoryDraft = merged.draft;
    categoryKeywordSuggestionCounts = merged.addedByCategory;
    renderCategoryRules();
    showCategorySettingsStatus(t('aiKeywordFilled', {
      folders: merged.updatedCategories,
      count: merged.addedCount
    }), 'success');
  } catch (error) {
    showCategorySettingsStatus(t('aiKeywordFailed', {
      message: error.message
    }), 'error');
  } finally {
    aiKeywordAnalysisInFlight = false;
    elements.categoryKeywordAiAnalyzeBtn.disabled = false;
    elements.categorySaveBtn.disabled = false;
    elements.categoryKeywordAiAnalyzeBtn.textContent = t('aiKeywordAnalyze');
  }
}

function renderCategoryRules() {
  elements.categoryRulesList.innerHTML = categoryDraft.map((item, index) => {
    const suggestionCount = Number(categoryKeywordSuggestionCounts[item.name]) || 0;
    return `
    <div class="category-rule-item${suggestionCount ? ' has-ai-suggestions' : ''}" data-category-index="${index}">
      <div class="category-rule-header">
        <span class="category-rule-title">
          <span class="category-rule-name">${escapeHtml(item.name)}</span>
          ${suggestionCount
    ? `<span class="category-rule-ai-badge">AI +${suggestionCount}</span>`
    : ''}
        </span>
        <button
          class="category-remove-button"
          type="button"
          data-category-index="${index}"
          aria-label="${escapeHtml(t('removeCategory', { category: item.name }))}"
        >${escapeHtml(t('removeShort'))}</button>
      </div>
      <label class="category-rule-keywords">
        <span>${escapeHtml(t('matchingKeywords'))}</span>
        <textarea
          class="category-keywords-input"
          rows="1"
          autocomplete="off"
          spellcheck="false"
          aria-describedby="keywordSeparatorHint"
          data-category-index="${index}"
          placeholder="${escapeHtml(t('keywordsPlaceholder'))}"
        >${escapeHtml(formatKeywords(item.keywords))}</textarea>
      </label>
    </div>
  `;
  }).join('');
}

function addCategoryFolder() {
  const name = elements.compactNewCategory.value.trim();
  if (!name) {
    elements.compactNewCategory.focus();
    return;
  }
  const normalizedName = normalizeCategoryName(name);
  if (categoryDraft.some((item) => normalizeCategoryName(item.name) === normalizedName)) {
    showCategorySettingsStatus(t('duplicateCategory'), 'error');
    return;
  }
  categoryDraft.push({ name, keywords: [] });
  elements.compactNewCategory.value = '';
  renderCategoryRules();
  showCategorySettingsStatus(t('categoryAdded'), 'success');
  const newRuleInput = elements.categoryRulesList.querySelector(
    `.category-keywords-input[data-category-index="${categoryDraft.length - 1}"]`
  );
  if (newRuleInput) newRuleInput.focus();
}

function removeCategoryFolder(index) {
  if (categoryDraft.length <= 1) {
    showCategorySettingsStatus(t('cannotRemoveLastCategory'), 'error');
    return;
  }
  const [removed] = categoryDraft.splice(index, 1);
  if (removed) delete categoryKeywordSuggestionCounts[removed.name];
  renderCategoryRules();
  showCategorySettingsStatus(t('categoryRemoved'), 'success');
}

function reclassifyFavoriteRecord(favorite, settings) {
  const suggestion = SmartFavClassifier.classify({
    title: favorite.title || favorite.url,
    url: favorite.url,
    description: favorite.description || '',
    keywords: favorite.keywords || []
  }, settings);
  return {
    ...favorite,
    category: suggestion.category,
    tags: suggestion.tags,
    summary: suggestion.summary,
    classificationSource: 'local',
    reclassifiedAt: Date.now()
  };
}

function classificationChanged(previous, next) {
  return previous.category !== next.category
    || JSON.stringify(previous.tags || []) !== JSON.stringify(next.tags || [])
    || previous.summary !== next.summary
    || previous.classificationSource !== next.classificationSource;
}

async function reclassifyStoredFavorites() {
  if (isExtension) {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'reclassifyFavorites' }, (result) => {
        const runtimeError = chrome.runtime.lastError;
        resolve(runtimeError
          ? { status: 'error', message: runtimeError.message }
          : result);
      });
    });
    if (!response || response.status !== 'ok') {
      throw new Error(response && response.message
        ? response.message
        : t('reclassifyFailed'));
    }
    return response;
  }

  const result = await storageGet(['favorites']);
  const favorites = Array.isArray(result.favorites) ? result.favorites : [];
  let updated = 0;
  const nextFavorites = favorites.map((favorite) => {
    const next = reclassifyFavoriteRecord(favorite, currentSettings);
    if (classificationChanged(favorite, next)) updated += 1;
    return next;
  });
  await storageSet({ favorites: nextFavorites });
  return {
    status: 'ok',
    total: nextFavorites.length,
    updated,
    browserMoved: 0
  };
}

elements.compactThemeStyle.addEventListener('change', handleThemeStyleChange);
elements.compactDarkMode.addEventListener('change', handleDarkModeChange);
elements.compactAiEnabled.addEventListener('change', handleAIEnabledChange);
elements.compactProvider.addEventListener('change', handleAIProviderChange);
elements.compactPopupWidth.addEventListener('input', handlePopupSizeInput);
elements.compactPopupHeight.addEventListener('input', handlePopupSizeInput);
elements.compactPopupWidth.addEventListener('change', handlePopupSizeChange);
elements.compactPopupHeight.addEventListener('change', handlePopupSizeChange);
elements.compactBackgroundImage.addEventListener('change', handleBackgroundImageChange);
elements.clearBackgroundImageBtn.addEventListener('click', clearBackgroundImage);
elements.compactKeywordWeight.addEventListener('input', () => {
  elements.compactKeywordWeightValue.textContent = elements.compactKeywordWeight.value;
});
elements.compactKeywordWeight.addEventListener('change', handleAIClassificationChange);
elements.compactClassificationMode.addEventListener('change', handleAIClassificationChange);
elements.compactApiEndpoint.addEventListener('change', () => persistAISettings());
elements.compactModel.addEventListener('change', () => persistAISettings());
elements.compactApiKey.addEventListener('change', () => persistAISettings());
elements.compactAiAutoClassify.addEventListener('change', () => persistAISettings());
elements.compactAiCreateCategories.addEventListener('change', () => persistAISettings());
elements.compactBrowserBookmarksEnabled.addEventListener('change', handleBrowserBookmarkWriteChange);
elements.compactBookmarkOrganizeEnabled.addEventListener('change', handleBookmarkOrganizeChange);
elements.compactBookmarkAutoCapture.addEventListener('change', handleBookmarkAutoCaptureChange);
elements.compactBookmarkWriteMode.addEventListener('change', handleBookmarkWriteModeChange);
elements.compactAddCategoryBtn.addEventListener('click', addCategoryFolder);
elements.categoryKeywordAiAnalyzeBtn.addEventListener(
  'click',
  analyzeCategoryKeywordsWithAI
);
elements.compactNewCategory.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  addCategoryFolder();
});
elements.categoryRulesList.addEventListener('input', (event) => {
  if (!event.target.classList.contains('category-keywords-input')) return;
  updateCategoryKeywordsFromInput(event.target);
});
elements.categoryRulesList.addEventListener('focusout', (event) => {
  if (!event.target.classList.contains('category-keywords-input')) return;
  updateCategoryKeywordsFromInput(event.target, { format: true });
});
elements.categoryRulesList.addEventListener('click', (event) => {
  const removeButton = event.target.closest('.category-remove-button');
  if (!removeButton) return;
  const index = Number(removeButton.dataset.categoryIndex);
  if (!Number.isInteger(index) || !categoryDraft[index]) return;
  removeCategoryFolder(index);
});

elements.categorySaveBtn.addEventListener('click', async () => {
  const classificationSettings = getClassificationDraftSettings();
  if (!classificationSettings.categories.length) {
    showCategorySettingsStatus(t('keepOneCategory'), 'error');
    return;
  }

  elements.categorySaveBtn.disabled = true;
  elements.categorySaveBtn.textContent = t('reclassifying');
  try {
    currentSettings = {
      ...currentSettings,
      ...classificationSettings
    };
    await storageSet({ settings: currentSettings });
    const result = await reclassifyStoredFavorites();
    await Promise.all([renderFolders(), renderRecentFavorites()]);
    if (currentTabInfo) {
      currentSuggestion = SmartFavClassifier.classify(currentTabInfo, currentSettings);
      showCategorySuggestion(currentSuggestion);
    }
    categoryKeywordSuggestionCounts = {};
    renderCategoryRules();
    showCategorySettingsStatus(t('reclassifyDone', {
      total: result.total || 0,
      updated: result.updated || 0,
      moved: result.browserMoved || 0
    }), 'success');
  } catch (error) {
    showCategorySettingsStatus(t('reclassifyFailed', { message: error.message }), 'error');
  } finally {
    elements.categorySaveBtn.disabled = false;
    elements.categorySaveBtn.textContent = t('saveAndReclassify');
  }
});

async function runOrganizeBookmarks() {
  if (!isExtension) {
    showCompactSettingsStatus(t('browserBookmarkUnavailable'), 'error');
    return;
  }
  elements.compactOrganizeBtn.disabled = true;
  elements.compactOrganizeBtn.textContent = t('organizing');
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'organizeBookmarks' }, resolve);
    });
    if (!response || response.status === 'error') {
      throw new Error(response && response.message
        ? response.message
        : t('browserBookmarkWriteFailed'));
    }
    if (response.status === 'disabled') {
      showCompactSettingsStatus(t('browserBookmarkUnavailable'), 'error');
      return;
    }
    if (response.status !== 'ok') {
      showCompactSettingsStatus(t('browserBookmarkUnavailable'), 'error');
      return;
    }
    showCompactSettingsStatus(
      t(response.wroteBack ? 'organizeDone' : 'organizeDoneLocal', {
        total: response.total,
        imported: response.imported,
        updated: response.updated || 0,
        moved: response.moved
      }),
      'success'
    );
    await refreshBookmarkRestorePoints();
    await Promise.all([renderFolders(), renderRecentFavorites()]);
  } catch (error) {
    showCompactSettingsStatus(t('organizeFailed', { message: error.message }), 'error');
  } finally {
    elements.compactOrganizeBtn.disabled = false;
    elements.compactOrganizeBtn.textContent = t('organizeNow');
  }
}

async function handleOrganizeNow() {
  await runOrganizeBookmarks();
}

elements.compactOrganizeBtn.addEventListener('click', handleOrganizeNow);
elements.bookmarkBackupCreateBtn.addEventListener('click', createOrUpdateBookmarkRestorePoint);
elements.bookmarkBackupPreviewBtn.addEventListener('click', previewBookmarkRestore);
elements.bookmarkBackupRestoreBtn.addEventListener('click', restoreBookmarkFolders);
elements.bookmarkBackupExportBtn.addEventListener('click', exportBookmarkRestorePoints);
elements.bookmarkBackupImportInput.addEventListener('change', importBookmarkRestorePoints);

elements.compactTestBtn.addEventListener('click', async () => {
  const provider = SmartFavAI.getProvider(elements.compactProvider.value);
  if (provider.requiresKey && !elements.compactApiKey.value.trim()) {
    showCompactSettingsStatus(t('enterApiKeyFirst'), 'error');
    return;
  }
  if (!elements.compactModel.value.trim()) {
    showCompactSettingsStatus(t('modelRequired'), 'error');
    return;
  }
  const endpointValidation = getApiEndpointValidation(provider);
  if (endpointValidation && !endpointValidation.valid) {
    showApiEndpointValidationError(endpointValidation);
    return;
  }
  const permissionRequest = endpointValidation
    ? requestApiEndpointPermission(endpointValidation)
    : Promise.resolve(true);
  elements.compactTestBtn.disabled = true;
  elements.compactTestBtn.textContent = t('testing');
  try {
    const granted = await permissionRequest;
    if (!granted) {
      showCompactSettingsStatus(t('apiEndpointPermissionDenied'), 'error');
      return;
    }
    const response = await SmartFavAI.call(t('testPrompt'), {
      language: currentSettings.language,
      apiProvider: elements.compactProvider.value,
      apiEndpoint: endpointValidation ? endpointValidation.endpoint : '',
      apiKey: elements.compactApiKey.value.trim(),
      model: elements.compactModel.value.trim() || provider.model
    });
    if (!response) throw new Error(t('serviceNoContent'));
    showCompactSettingsStatus(t('connectionSuccess'), 'success');
  } catch (error) {
    const message = endpointValidation
      && /permission|权限|not allowed/i.test(error.message)
      ? t('apiEndpointPermissionFailed', { message: error.message })
      : error.message;
    showCompactSettingsStatus(message, 'error');
  } finally {
    elements.compactTestBtn.disabled = false;
    elements.compactTestBtn.textContent = t('testConnection');
  }
});

function showCompactSettingsStatus(message, type) {
  elements.compactSettingsStatus.textContent = message;
  elements.compactSettingsStatus.className = `compact-settings-status ${type}`;
}

function showCategorySettingsStatus(message, type) {
  elements.categorySettingsStatus.textContent = message;
  elements.categorySettingsStatus.className = `compact-settings-status ${type}`;
}
