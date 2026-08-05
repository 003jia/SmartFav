const detectedLanguage = SmartFavI18n.detectLanguage();
const detectedDefaults = SmartFavClassifier.getDefaults(detectedLanguage);

const DEFAULT_SETTINGS = {
  language: detectedLanguage,
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
  categories: detectedDefaults.categories,
  keywordRules: detectedDefaults.keywordRules
};

const THEME_STYLES = ['glass', 'white', 'gray', 'black', 'parchment'];
// 背景图以 base64 存在 settings 中，与收藏、布局还原点共用 storage.local 配额，
// 因此限制在 800 KB 以内，避免挤占用户数据空间导致写入失败。
const MAX_BACKGROUND_IMAGE_BYTES = 800 * 1024;
const {
  TRASH_RETENTION_MS,
  BROWSER_ACTIVITY_TTL_MS,
  getTrashExpireAt
} = SmartFavConstants;
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
          ? 'Nova 项目看板'
          : 'Nova project dashboard',
        url: 'https://projects.example.com/dashboard',
        category: customCategory,
        createdAt: Date.now() - 5 * 60000
      },
      {
        title: detectedLanguage === 'zh_CN'
          ? 'Atlas 项目流程'
          : 'Atlas project workflow',
        url: 'https://workflow.example.com/process',
        category: customCategory,
        createdAt: Date.now() - 10 * 60000
      },
      {
        title: 'Project documentation overview',
        url: 'https://docs.example.com/project/overview',
        category: customCategory,
        createdAt: Date.now() - 15 * 60000
      },
      {
        title: detectedLanguage === 'zh_CN'
          ? 'Orion 产品说明'
          : 'Orion product guide',
        url: 'https://catalog.example.com/product-guide',
        category: customCategory,
        createdAt: Date.now() - 20 * 60000
      },
      {
        title: detectedLanguage === 'zh_CN'
          ? '团队协作计划'
          : 'Team collaboration plan',
        url: 'https://planning.example.com/team',
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
  retryBootstrapBtn: document.getElementById('retryBootstrapBtn'),
  favoritesSearchInput: document.getElementById('favoritesSearchInput'),
  favoritesSearchClear: document.getElementById('favoritesSearchClear'),
  favoritesEmptyState: document.getElementById('favoritesEmptyState'),
  favoritesEmptyAction: document.getElementById('favoritesEmptyAction'),
  favoritesNoResults: document.getElementById('favoritesNoResults'),
  favoritesNoResultsAction: document.getElementById('favoritesNoResultsAction'),
  categoriesSearchInput: document.getElementById('categoriesSearchInput'),
  categoriesSearchClear: document.getElementById('categoriesSearchClear'),
  categoriesEmptyState: document.getElementById('categoriesEmptyState'),
  categoriesNoResults: document.getElementById('categoriesNoResults'),
  categoriesNoResultsAction: document.getElementById('categoriesNoResultsAction'),
  trashEmptyState: document.getElementById('trashEmptyState'),
  categorySection: document.getElementById('categorySection'),
  saveTitle: document.getElementById('saveTitle'),
  pageHost: document.getElementById('pageHost'),
  categorySelect: document.getElementById('categorySelect'),
  categorySelectControl: document.getElementById('categorySelectControl'),
  categorySelectButton: document.getElementById('categorySelectButton'),
  categorySelectValue: document.getElementById('categorySelectValue'),
  categorySelectMenu: document.getElementById('categorySelectMenu'),
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
  backgroundPositionValue: document.getElementById('backgroundPositionValue'),
  resetBackgroundPositionBtn: document.getElementById('resetBackgroundPositionBtn'),
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
  aiOrganizationAnalyzeBtn: document.getElementById('aiOrganizationAnalyzeBtn'),
  aiOrganizationPreview: document.getElementById('aiOrganizationPreview'),
  aiOrganizationPreviewSummary: document.getElementById('aiOrganizationPreviewSummary'),
  aiOrganizationOperations: document.getElementById('aiOrganizationOperations'),
  aiOrganizationApplyBtn: document.getElementById('aiOrganizationApplyBtn'),
  categoryRulesList: document.getElementById('categoryRulesList'),
  categorySettingsStatus: document.getElementById('categorySettingsStatus'),
  categorySaveBtn: document.getElementById('categorySaveBtn'),
  compactTestBtn: document.getElementById('compactTestBtn'),
  compactSettingsStatus: document.getElementById('compactSettingsStatus')
};

let currentTabInfo = null;
let currentSuggestion = null;
let currentSettings = DEFAULT_SETTINGS;
let currentFolders = [];
let categoryDraft = [];
let previewThemeStyle = DEFAULT_SETTINGS.themeStyle;
let pendingBackgroundImage = DEFAULT_SETTINGS.customBackgroundImage;
let pendingBackgroundPositionX = DEFAULT_SETTINGS.customBackgroundPositionX;
let pendingBackgroundPositionY = DEFAULT_SETTINGS.customBackgroundPositionY;
let backgroundPositionDrag = null;
let showingAllFavorites = false;
let activeView = 'home';
let activeFavoriteCategory = null;
let activeCategoryParentId = null;
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
let pendingAIFolderProposal = null;
let activeAIOrganizationProposal = null;

// 弹窗启动链路：任何一步抛错都必须收敛成「错误提示 + 重试入口」，
// 否则用户只会看到永久停留的「正在读取当前网页」而无法自救。
async function bootstrapPopup() {
  await recoverManagedBrowserFavorites();
  await cleanupRecentlyDeletedItems();
  currentSettings = await loadSettings();
  await loadFolderState();
  applyLanguage();
  await Promise.all([renderFolders(), renderRecentFavorites(), renderRecentlyDeleted()]);
  initSearchAndEmptyStates();
  updateEmptyStates();
  await analyzeCurrentTab();
  const requestedView = new URLSearchParams(window.location.search).get('view');
  await showView(['favorites', 'categories', 'trash', 'settings'].includes(requestedView)
    ? requestedView
    : 'home');
  await showPendingBrowserActivity();
}

async function runBootstrapWithRetry() {
  if (elements.retryBootstrapBtn) {
    elements.retryBootstrapBtn.classList.add('hidden');
    elements.retryBootstrapBtn.disabled = true;
  }
  try {
    await bootstrapPopup();
  } catch (error) {
    console.error('SmartFav popup bootstrap failed', error);
    // applyLanguage 可能还没跑过，但 t() 只依赖 currentSettings.language，默认值可用。
    showError(t('loadStateFailed'));
    if (elements.retryBootstrapBtn) {
      elements.retryBootstrapBtn.textContent = t('retryLoad');
      elements.retryBootstrapBtn.classList.remove('hidden');
      elements.retryBootstrapBtn.disabled = false;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (elements.retryBootstrapBtn) {
    elements.retryBootstrapBtn.addEventListener('click', () => { runBootstrapWithRetry(); });
  }
  runBootstrapWithRetry();
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
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      const runtimeError = chrome.runtime && chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve(result || {});
    });
  });
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

async function loadFolderState() {
  if (isExtension) {
    const response = await sendRuntimeMessage('getFolderTree');
    if (!response || response.status !== 'ok') {
      throw new Error(response && response.message ? response.message : 'Folder tree unavailable');
    }
    currentFolders = SmartFavFolderTree.normalizeFolders(response.folders);
    activeFavoriteOrder = normalizeFavoriteOrderMap(response.favoriteOrder);
    return response;
  }
  const migration = SmartFavFolderTree.migrateState(previewState, {
    language: currentSettings.language,
    categories: currentSettings.categories,
    keywordRules: currentSettings.keywordRules
  });
  Object.assign(previewState, migration);
  currentFolders = migration.folders;
  activeFavoriteOrder = migration.favoriteOrder;
  return { status: 'ok', ...migration };
}

// 渲染路径上会对每个文件夹、每行收藏反复查路径与后代，逐次调用 getPathLabel /
// getDescendantIds 会重跑 normalizeFolders，整体退化成 O(n²)~O(n³)。
// 这里按 currentFolders 的数组身份缓存一份索引：currentFolders 每次都是整体替换，
// 所以身份变化即等价于数据变化，不需要额外的失效逻辑。
let folderIndexCache = { source: null, index: null };
// renderFolders 当前渲染的层级：null 表示根层级。
// 只有根层级的"空"才等于"一条收藏都没有"，子层级为空是另一回事。
let favoritesListParentId = null;

function getFolderIndex() {
  if (folderIndexCache.source !== currentFolders) {
    folderIndexCache = {
      source: currentFolders,
      index: SmartFavFolderTree.createIndex(currentFolders)
    };
  }
  return folderIndexCache.index;
}

function getFolderPathLabel(folderId) {
  return getFolderIndex().pathLabel(folderId);
}

function getFolderDescendantIds(folderId) {
  return getFolderIndex().descendantIds(folderId);
}

function classifyCurrentFolders(tabInfo) {
  return SmartFavClassifier.classifyFolders(tabInfo, currentSettings, currentFolders);
}

async function updateStoredSettings(settingsPatch) {
  if (!isExtension) {
    const settings = { ...(previewState.settings || {}), ...settingsPatch };
    await storageSet({ settings });
    return settings;
  }
  const response = await sendRuntimeMessage('updateSettings', { patch: settingsPatch });
  if (!response || response.status !== 'ok' || !response.settings) {
    throw new Error(
      response && response.message ? response.message : 'Settings update failed'
    );
  }
  return response.settings;
}

async function updateStoredFavoriteOrder(folderId, orderedFavoriteIds) {
  if (!isExtension) {
    const result = await storageGet(['favoriteOrder']);
    const nextFavoriteOrder = {
      ...(result.favoriteOrder || {}),
      [folderId]: orderedFavoriteIds
    };
    await storageSet({ favoriteOrder: nextFavoriteOrder });
    return nextFavoriteOrder;
  }
  const response = await sendRuntimeMessage('updateFavoriteOrder', {
    folderId,
    orderedFavoriteIds
  });
  if (!response || response.status !== 'ok' || !response.favoriteOrder) {
    throw new Error(
      response && response.message ? response.message : 'Favorite order update failed'
    );
  }
  return response.favoriteOrder;
}

async function consumeStoredBrowserActivity(activityId) {
  if (!isExtension) {
    const current = previewState.pendingBrowserActivity;
    if (current && current.id === activityId) {
      await storageSet({ pendingBrowserActivity: null });
    }
    return;
  }
  const response = await sendRuntimeMessage('consumePendingBrowserActivity', { activityId });
  if (!response || response.status !== 'ok') {
    throw new Error(
      response && response.message ? response.message : 'Browser activity update failed'
    );
  }
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
  if (type === 'getFolderTree') {
    return {
      status: 'ok',
      folderSchemaVersion: SmartFavFolderTree.SCHEMA_VERSION,
      folders: SmartFavFolderTree.normalizeFolders(previewState.folders),
      favorites: previewState.favorites,
      favoriteOrder: previewState.favoriteOrder
    };
  }
  if (type === 'createFolder') {
    const result = SmartFavFolderTree.createFolder(previewState.folders, payload.folder || {});
    if (result.status === 'ok') previewState.folders = result.folders;
    return result;
  }
  if (type === 'updateFolder') {
    const result = SmartFavFolderTree.updateFolder(
      previewState.folders,
      payload.folderId,
      payload.patch || {}
    );
    if (result.status === 'ok') {
      previewState.folders = result.folders;
      previewState.favorites = previewState.favorites.map((favorite) => ({
        ...favorite,
        category: SmartFavFolderTree.getPathLabel(result.folders, favorite.folderId)
      }));
    }
    return result;
  }
  if (type === 'moveFolder') {
    const result = SmartFavFolderTree.moveFolder(
      previewState.folders,
      payload.folderId,
      payload.targetParentId,
      payload.index
    );
    if (result.status === 'ok') {
      previewState.folders = result.folders;
      previewState.favorites = previewState.favorites.map((favorite) => ({
        ...favorite,
        category: SmartFavFolderTree.getPathLabel(result.folders, favorite.folderId)
      }));
    }
    return result;
  }
  if (type === 'deleteFolder') {
    const result = SmartFavFolderTree.deleteFolder(
      previewState.folders,
      previewState.favorites,
      previewState.favoriteOrder,
      payload.folderId,
      payload.targetFolderId
    );
    if (result.status === 'ok') {
      previewState.folders = result.folders;
      previewState.favorites = result.favorites;
      previewState.favoriteOrder = result.favoriteOrder;
    }
    return result;
  }
  if (type === 'moveFavorite') {
    const favorite = previewState.favorites.find((item) => item.id === payload.favoriteId);
    const target = SmartFavFolderTree.getFolder(previewState.folders, payload.targetFolderId);
    if (!favorite || !target) return { status: 'invalid', moved: 0 };
    previewState.favorites = previewState.favorites.map((item) => item.id === favorite.id
      ? {
        ...item,
        folderId: target.id,
        category: SmartFavFolderTree.getPathLabel(previewState.folders, target.id),
        manuallyCategorized: true
      }
      : item);
    const nextOrder = {};
    Object.entries(previewState.favoriteOrder || {}).forEach(([folderId, ids]) => {
      const retained = (Array.isArray(ids) ? ids : []).filter((id) => id !== favorite.id);
      if (retained.length) nextOrder[folderId] = retained;
    });
    const targetOrder = nextOrder[target.id] || [];
    const index = Math.max(0, Math.min(targetOrder.length, Number.isFinite(Number(payload.index))
      ? Number(payload.index)
      : targetOrder.length));
    targetOrder.splice(index, 0, favorite.id);
    nextOrder[target.id] = targetOrder;
    previewState.favoriteOrder = nextOrder;
    return {
      status: 'ok',
      moved: 1,
      favorite: previewState.favorites.find((item) => item.id === favorite.id),
      favoriteOrder: nextOrder
    };
  }
  if (type === 'previewAIOrganization') {
    const validated = SmartFavAIOrganization.validateOperations(
      payload.operations,
      previewState.folders,
      previewState.favorites,
      SmartFavFolderTree
    );
    if (!validated.operations.length) {
      return { status: 'invalid', operations: [], rejected: validated.rejected };
    }
    const proposalId = SmartFavFolderTree.createId('proposal');
    const proposal = { id: proposalId, operations: validated.operations };
    previewState.aiOrganizationPreviews = [proposal];
    return {
      status: validated.rejected.length ? 'partial' : 'ok',
      proposalId,
      operations: validated.operations,
      rejected: validated.rejected
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
    await consumeStoredBrowserActivity(activity.id);
    return false;
  }
  const message = getBrowserActivityMessage(activity);
  if (!message) return false;
  lastShownBrowserActivityId = activity.id;
  currentBrowserActivity = activity;
  elements.successMsg.textContent = message;
  elements.successStatus.classList.remove('hidden');
  await consumeStoredBrowserActivity(activity.id);
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
    if (changes.folders) {
      currentFolders = SmartFavFolderTree.normalizeFolders(changes.folders.newValue);
    }
    if (changes.favorites || changes.recentlyDeleted || changes.folders) {
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
    customBackgroundPositionX: normalizeBackgroundPosition(
      saved.customBackgroundPositionX,
      DEFAULT_SETTINGS.customBackgroundPositionX
    ),
    customBackgroundPositionY: normalizeBackgroundPosition(
      saved.customBackgroundPositionY,
      DEFAULT_SETTINGS.customBackgroundPositionY
    ),
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
    || !Number.isFinite(Number(saved.customBackgroundPositionX))
    || !Number.isFinite(Number(saved.customBackgroundPositionY))
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
  if (needsMigration) return updateStoredSettings(settings);
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

function normalizeBackgroundPosition(value, fallback = 50) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(Math.min(100, Math.max(0, parsed)) * 10) / 10;
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
  const customBackgroundPositionX = normalizeBackgroundPosition(
    settings.customBackgroundPositionX,
    DEFAULT_SETTINGS.customBackgroundPositionX
  );
  const customBackgroundPositionY = normalizeBackgroundPosition(
    settings.customBackgroundPositionY,
    DEFAULT_SETTINGS.customBackgroundPositionY
  );
  document.documentElement.dataset.theme = themeStyle;
  document.documentElement.dataset.mode = colorMode;
  document.documentElement.dataset.customBackground = customBackgroundImage ? 'true' : 'false';
  document.documentElement.style.setProperty('--popup-width', `${popupWidth}px`);
  document.documentElement.style.setProperty('--popup-height', `${popupHeight}px`);
  document.documentElement.style.setProperty(
    '--custom-background-position',
    `${customBackgroundPositionX}% ${customBackgroundPositionY}%`
  );
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
  // 分组摘要是运行时拼出来的，data-i18n 兜不住，换语言后要重算一遍。
  updateSettingsGroupSummaries();
  applyAppearance();
}

async function toggleColorMode() {
  if (currentSettings.themeStyle === 'black') return;
  currentSettings = await updateStoredSettings({
    colorMode: currentSettings.colorMode === 'dark' ? 'light' : 'dark'
  });
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
  currentSettings = await updateStoredSettings({
    language: currentSettings.language,
    categories: currentSettings.categories,
    keywordRules: currentSettings.keywordRules
  });
  try {
    await reclassifyStoredFavorites();
  } catch (error) {
    console.warn('SmartFav could not reclassify favorites after switching language:', error);
  }
  applyLanguage();
  await Promise.all([renderFolders(), renderRecentFavorites(), renderRecentlyDeleted()]);
  if (currentTabInfo) {
    currentSuggestion = classifyCurrentFolders(currentTabInfo);
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

    currentSuggestion = classifyCurrentFolders(currentTabInfo);
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

// 是否允许点击后导航。escapeHtml 只防属性逃逸，不防协议：
// 批量整理会把书签栏里的 bookmarklet（javascript:...）当成普通网址导入，
// 之后点击就会在扩展页/预览页上下文执行。这里统一用 constants.js 的协议白名单
// 收口，收藏列表、favicon 与 openUrl 三处都必须过这一关。
function isSafeNavigableUrl(url) {
  return SmartFavConstants.isSafeNavigableUrl(url);
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

function getCategorySelectOptionButtons() {
  return Array.from(elements.categorySelectMenu.querySelectorAll('.category-select-option'));
}

function syncCategorySelectControl() {
  const selectedOption = elements.categorySelect.selectedOptions[0] || null;
  const selectedValue = elements.categorySelect.value;
  const selectedLabel = selectedOption ? selectedOption.textContent.trim() : '';
  elements.categorySelectValue.textContent = selectedLabel;
  elements.categorySelectButton.title = selectedLabel;
  getCategorySelectOptionButtons().forEach((button) => {
    button.setAttribute('aria-selected', button.dataset.value === selectedValue ? 'true' : 'false');
  });
}

function focusCategorySelectOption(index) {
  const options = getCategorySelectOptionButtons();
  if (!options.length) return;
  const nextIndex = Math.max(0, Math.min(options.length - 1, index));
  options[nextIndex].focus();
  elements.categorySelectButton.setAttribute('aria-activedescendant', options[nextIndex].id);
}

function setCategorySelectOpen(open, { focusSelected = false, restoreFocus = false } = {}) {
  const shouldOpen = Boolean(open) && elements.categorySelect.options.length > 0;
  elements.categorySelectControl.classList.toggle('is-open', shouldOpen);
  elements.categorySection.classList.toggle('has-open-select', shouldOpen);
  elements.categorySelectMenu.classList.toggle('hidden', !shouldOpen);
  elements.categorySelectButton.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
  if (!shouldOpen) {
    elements.categorySelectButton.removeAttribute('aria-activedescendant');
    if (restoreFocus) elements.categorySelectButton.focus();
    return;
  }
  if (focusSelected) {
    const selectedIndex = Math.max(0, elements.categorySelect.selectedIndex);
    requestAnimationFrame(() => focusCategorySelectOption(selectedIndex));
  }
}

function renderCategorySelectControl() {
  const selectedValue = elements.categorySelect.value;
  elements.categorySelectMenu.innerHTML = Array.from(elements.categorySelect.options)
    .map((option, index) => `
      <button
        id="categorySelectOption-${index}"
        class="category-select-option"
        type="button"
        role="option"
        tabindex="-1"
        data-value="${escapeHtml(option.value)}"
        aria-selected="${option.value === selectedValue ? 'true' : 'false'}"
      >
        <span>${escapeHtml(option.textContent)}</span>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="m3.5 8 3 3 6-6.5"></path>
        </svg>
      </button>
    `)
    .join('');
  syncCategorySelectControl();
  setCategorySelectOpen(false);
}

function selectCategoryFromControl(value) {
  if (!Array.from(elements.categorySelect.options).some((option) => option.value === value)) return;
  elements.categorySelect.value = value;
  elements.categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
  setCategorySelectOpen(false, { restoreFocus: true });
}

function showCategorySuggestion(suggestion) {
  elements.loadingStatus.classList.add('hidden');
  elements.errorStatus.classList.add('hidden');
  elements.categorySection.classList.remove('hidden');
  elements.saveTitle.textContent = currentTabInfo.title || t('untitledPage');
  elements.pageHost.textContent = getHostname(currentTabInfo.url);
  const folderOptions = [...currentFolders].sort((left, right) => (
    getFolderPathLabel(left.id).localeCompare(getFolderPathLabel(right.id))
  ));
  elements.categorySelect.innerHTML = folderOptions
    .map((folder) => (
      `<option value="${escapeHtml(folder.id)}">${escapeHtml(getFolderPathLabel(folder.id))}</option>`
    ))
    .join('');
  const fallback = SmartFavFolderTree.getFallbackFolder(currentFolders, currentSettings.language);
  elements.categorySelect.value = currentFolders.some((folder) => folder.id === suggestion.folderId)
    ? suggestion.folderId
    : (fallback && fallback.id) || (folderOptions[0] && folderOptions[0].id) || '';
  renderCategorySelectControl();
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
  const category = getFolderPathLabel(elements.categorySelect.value) || t('bookmarksFallback');
  elements.confirmBtn.textContent = t('saveToCategory', { category });
}

function getFallbackCategory() {
  const fallback = SmartFavFolderTree.getFallbackFolder(currentFolders, currentSettings.language);
  return fallback ? fallback.id : '';
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
  const proposal = buildFolderDomainLearningProposal(currentTabInfo, targetCategory);
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
  } else if (proposal.previousFolderIds.length) {
    elements.pageLearningDescription.textContent = t('rememberManualCategoryConflict', {
      domain: proposal.domain,
      categories: proposal.previousFolderIds.map(getFolderPathLabel).join(
        currentSettings.language === 'zh_CN' ? '、' : ', '
      ),
      category: getFolderPathLabel(proposal.targetFolderId)
    });
  } else {
    elements.pageLearningDescription.textContent = t('rememberManualCategoryDescription', {
      domain: proposal.domain,
      category: getFolderPathLabel(proposal.targetFolderId)
    });
  }
}

elements.categorySelect.addEventListener('change', () => {
  syncCategorySelectControl();
  updateConfirmLabel();
  updatePageLearningOption();
});

elements.categorySelectButton.addEventListener('click', () => {
  const open = !elements.categorySelectControl.classList.contains('is-open');
  setCategorySelectOpen(open, { focusSelected: open });
});

elements.categorySelectButton.addEventListener('keydown', (event) => {
  if (!['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Escape'].includes(event.key)) return;
  event.preventDefault();
  if (event.key === 'Escape') {
    setCategorySelectOpen(false);
    return;
  }
  setCategorySelectOpen(true, { focusSelected: true });
});

elements.categorySelectMenu.addEventListener('click', (event) => {
  const option = event.target.closest('.category-select-option');
  if (!option) return;
  selectCategoryFromControl(option.dataset.value);
});

elements.categorySelectMenu.addEventListener('keydown', (event) => {
  const option = event.target.closest('.category-select-option');
  if (!option) return;
  const options = getCategorySelectOptionButtons();
  const index = options.indexOf(option);
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    focusCategorySelectOption(index + (event.key === 'ArrowDown' ? 1 : -1));
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    focusCategorySelectOption(event.key === 'Home' ? 0 : options.length - 1);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    selectCategoryFromControl(option.dataset.value);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    setCategorySelectOpen(false, { restoreFocus: true });
  } else if (event.key === 'Tab') {
    setCategorySelectOpen(false);
  }
});

document.addEventListener('pointerdown', (event) => {
  if (!elements.categorySelectControl.contains(event.target)) setCategorySelectOpen(false);
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
    if (suggestion.proposedFolder) renderAIFolderProposal(suggestion.proposedFolder);
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
  const localEvidence = classifyCurrentFolders(tabInfo);
  const separator = currentSettings.language === 'zh_CN' ? '、' : ', ';
  const rules = currentFolders
    .map((folder) => {
      const path = getFolderPathLabel(folder.id);
      return `${folder.id}|${path}=${(folder.keywords || []).join(', ')}`;
    })
    .join('\n');
  const evidence = Object.entries(localEvidence.scoreRatios || {})
    .sort((left, right) => right[1] - left[1])
    .map(([folderId, ratio]) => `${folderId}|${getFolderPathLabel(folderId)}:${ratio}%`)
    .join(separator);
  const weights = localEvidence.weights || SmartFavClassifier.DEFAULT_WEIGHTS;
  return t('classifyPrompt', {
    title: tabInfo.title,
    url: tabInfo.url,
    description: tabInfo.description,
    keywords: Array.isArray(tabInfo.keywords) ? tabInfo.keywords.join(separator) : '',
    categories: currentFolders.map((folder) => `${folder.id}|${getFolderPathLabel(folder.id)}`).join(separator),
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
  const fallback = SmartFavFolderTree.getFallbackFolder(currentFolders, currentSettings.language);
  const requestedPath = sanitizeAICategoryName(parsed.category || parsed.folderPath);
  const requestedFolder = currentFolders.find((folder) => folder.id === parsed.targetFolderId)
    || currentFolders.find((folder) => (
      normalizeCategoryName(getFolderPathLabel(folder.id)) === normalizeCategoryName(requestedPath)
    ));
  const parsedConfidence = Number(parsed.confidence);
  const confidence = Math.max(0, Math.min(1, Number.isFinite(parsedConfidence)
    ? parsedConfidence
    : (requestedFolder ? 0.8 : 0)));
  const selectedFolder = requestedFolder && confidence >= 0.75 ? requestedFolder : fallback;
  const rawProposal = parsed.proposedFolder || (parsed.newCategory
    ? {
        parentId: parsed.parentId || (selectedFolder && selectedFolder.parentId),
        name: parsed.newCategory,
        keywords: parsed.newKeywords
      }
    : null);
  let proposedFolder = null;
  if (currentSettings.aiCreateCategories && rawProposal) {
    const name = sanitizeAICategoryName(rawProposal.name);
    const parentId = currentFolders.some((folder) => folder.id === rawProposal.parentId)
      ? rawProposal.parentId
      : null;
    if (name && !SmartFavFolderTree.findSiblingByName(currentFolders, parentId, name)) {
      proposedFolder = {
        parentId,
        name,
        keywords: splitKeywords(Array.isArray(rawProposal.keywords)
          ? rawProposal.keywords.join(',')
          : rawProposal.keywords).slice(0, 16)
      };
    }
  }

  return {
    category: selectedFolder ? getFolderPathLabel(selectedFolder.id) : '',
    folderId: selectedFolder ? selectedFolder.id : '',
    folderPath: selectedFolder ? getFolderPathLabel(selectedFolder.id) : '',
    confidence: confidence >= 0.75 ? 'high' : confidence >= 0.5 ? 'medium' : 'low',
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 4).map(String) : [],
    summary: String(parsed.reason || parsed.summary || t('aiSummaryFallback')),
    source: 'ai',
    proposedFolder
  };
}

function renderAIFolderProposal(proposal) {
  pendingAIFolderProposal = proposal;
  const parentPath = proposal.parentId ? getFolderPathLabel(proposal.parentId) : t('favoriteCategories');
  elements.aiMessage.innerHTML = `
    <span>${escapeHtml(`${parentPath} › ${proposal.name}`)}</span>
    <button class="inline-message-action" id="confirmAIFolderProposal" type="button">${escapeHtml(t('confirmCreate'))}</button>
  `;
  elements.aiMessage.classList.remove('hidden');
  document.getElementById('confirmAIFolderProposal').addEventListener('click', confirmAIFolderProposal);
}

async function confirmAIFolderProposal() {
  if (!pendingAIFolderProposal) return;
  const response = await sendRuntimeMessage('createFolder', { folder: {
    ...pendingAIFolderProposal,
    source: 'ai'
  } });
  if (!response || response.status !== 'ok') {
    elements.aiMessage.textContent = response && response.message
      ? response.message
      : t('browserBookmarkUnavailable');
    return;
  }
  pendingAIFolderProposal = null;
  await loadFolderState();
  elements.categorySelect.innerHTML = currentFolders
    .map((folder) => `<option value="${escapeHtml(folder.id)}">${escapeHtml(getFolderPathLabel(folder.id))}</option>`)
    .join('');
  elements.categorySelect.value = response.folder.id;
  renderCategorySelectControl();
  currentSuggestion = {
    ...currentSuggestion,
    folderId: response.folder.id,
    category: getFolderPathLabel(response.folder.id),
    folderPath: getFolderPathLabel(response.folder.id)
  };
  elements.aiMessage.textContent = t('aiCategoryCreated', { category: currentSuggestion.category });
  updateConfirmLabel();
}

elements.confirmBtn.addEventListener('click', async () => {
  if (!currentSuggestion || !currentTabInfo) return;
  elements.confirmBtn.disabled = true;
  elements.errorStatus.classList.add('hidden');
  try {
    const selectedFolderId = elements.categorySelect.value;
    const selectedCategory = getFolderPathLabel(selectedFolderId);
    const shouldLearn = Boolean(
      currentPageLearningProposal
      && currentPageLearningProposal.targetFolderId === selectedFolderId
      && elements.pageLearningCheckbox.checked
    );
    const learningResult = shouldLearn
      ? createFolderLearningResult(currentPageLearningProposal)
      : null;
    const favorite = {
      ...currentTabInfo,
      category: selectedCategory,
      folderId: selectedFolderId,
      tags: currentSuggestion.tags,
      summary: currentSuggestion.summary,
      classificationSource: currentSuggestion.source,
      suggestedCategory: getFolderPathLabel(recommendedCategory),
      suggestedFolderId: recommendedCategory,
      manuallyCategorized: selectedFolderId !== recommendedCategory,
      createdAt: Date.now()
    };

    // 收藏与书签写入统一交给 background：它在 withBookmarkLayoutLock 内串行执行，
    // 并使用带内部操作标记的书签 API，避免与浏览器事件回流互相覆盖。
    let successKey = 'savedToSmartFav';
    if (isExtension) {
      if (learningResult) {
        for (const [folderId, keywords] of Object.entries(learningResult.folderUpdates)) {
          const folderResponse = await sendRuntimeMessage('updateFolder', {
            folderId,
            patch: { keywords }
          });
          if (!folderResponse || folderResponse.status !== 'ok') {
            throw new Error(folderResponse && folderResponse.message
              ? folderResponse.message
              : t('learningSaveFailed'));
          }
        }
        await loadFolderState();
      }
      const response = await sendRuntimeMessage('saveFavorite', {
        favorite,
        settingsPatch: null
      });
      if (!response || response.status !== 'ok') {
        throw new Error(response && response.message
          ? response.message
          : t('browserBookmarkUnavailable'));
      }
      const bookmarkStatus = (response.bookmark && response.bookmark.status) || 'disabled';
      if (bookmarkStatus === 'unavailable' || bookmarkStatus === 'error') {
        successKey = 'savedBrowserFailed';
      } else if (bookmarkStatus !== 'disabled') {
        successKey = 'savedToBrowser';
      }
    } else {
      const result = await storageGet(['favorites']);
      const favorites = Array.isArray(result.favorites) ? result.favorites : [];
      const storageValues = {
        favorites: [
          { ...favorite, id: favorite.id || SmartFavFolderTree.createId('fav') },
          ...(currentSettings.bookmarkWriteMode === 'add'
            ? favorites
            : favorites.filter((item) => item.url !== favorite.url))
        ]
      };
      await storageSet(storageValues);
    }

    pendingPageLearningUndo = learningResult;
    elements.categorySection.classList.add('hidden');
    elements.successMsg.textContent = learningResult
      ? t('savedAndRemembered', {
        status: t(successKey),
        domain: learningResult.domain,
        category: getFolderPathLabel(learningResult.targetFolderId)
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
    const entries = Object.entries(learningResult.previousFolderKeywords || {});
    for (const [folderId, keywords] of entries) {
      const response = await sendRuntimeMessage('updateFolder', {
        folderId,
        patch: { keywords }
      });
      if (!response || response.status !== 'ok') {
        throw new Error(response && response.message ? response.message : t('learningUndoFailed'));
      }
    }
    await loadFolderState();
    pendingPageLearningUndo = null;
    elements.successMsg.textContent = t('learningUndone', {
      category: getFolderPathLabel(learningResult.targetFolderId)
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

async function renderFolders(parentId = null) {
  activeFavoriteCategory = parentId || null;
  const result = await storageGet(['favorites', 'folders', 'favoriteOrder']);
  const favorites = Array.isArray(result.favorites) ? result.favorites : [];
  if (Array.isArray(result.folders) && result.folders.length) {
    currentFolders = SmartFavFolderTree.normalizeFolders(result.folders);
  }
  const folders = SmartFavFolderTree.childrenOf(currentFolders, parentId);
  activeFavoriteOrder = normalizeFavoriteOrderMap(result.favoriteOrder);
  elements.totalCount.textContent = t('favoritesCount', { count: favorites.length });
  const librarySummary = t('librarySummary', {
    favorites: favorites.length,
    categories: currentFolders.length
  });
  elements.librarySummary.textContent = librarySummary;
  elements.favoritesViewSummary.textContent = librarySummary;
  elements.categoryEntrySummary.textContent = t('categoryCount', { count: currentFolders.length });
  elements.recentSection.classList.toggle('hidden', Boolean(parentId));
  elements.foldersHeading.classList.remove('hidden');
  elements.foldersList.classList.remove('list-view');
  elements.foldersList.innerHTML = `${parentId ? renderFolderBreadcrumb(parentId) : ''}${folders.map((folder) => `
    <button
      class="folder-item"
      type="button"
      draggable="true"
      data-folder-id="${escapeHtml(folder.id)}"
      aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight"
      title="${escapeHtml(t('dragFolderHint'))}"
    >
      <span class="reorder-grip folder-reorder-grip" aria-hidden="true"></span>
      <span class="folder-name">${escapeHtml(folder.name)}</span>
      <span class="folder-count">${escapeHtml(t('folderItemCount', {
    count: getDescendantFavoriteCount(folder.id, favorites)
  }))}</span>
    </button>
  `).join('') || (parentId
    // 根层级留白交给 #favoritesEmptyState（带图标和引导按钮）；
    // 子层级仍用这行内联文案，因为面包屑要留在列表里不能被整块隐藏。
    ? `<div class="empty-state">${escapeHtml(t('emptyCategory'))}</div>`
    : '')}`;
  favoritesListParentId = parentId;
  bindFolderInteractions(folders, favorites, parentId);
  bindBreadcrumbActions(favorites, activeFavoriteOrder);
  updateEmptyStates();
}

function getDescendantFavoriteCount(folderId, favorites) {
  const ids = new Set([folderId, ...getFolderDescendantIds(folderId)]);
  return favorites.filter((favorite) => ids.has(favorite.folderId)).length;
}

function renderFolderBreadcrumb(folderId) {
  const path = SmartFavFolderTree.getPath(currentFolders, folderId);
  return `
    <nav class="folder-breadcrumb" aria-label="${escapeHtml(t('folderPath'))}">
      <button type="button" data-folder-id="">${escapeHtml(t('favoriteCategories'))}</button>
      ${path.map((folder) => `
        <span aria-hidden="true">›</span>
        <button type="button" data-folder-id="${escapeHtml(folder.id)}">${escapeHtml(folder.name)}</button>
      `).join('')}
    </nav>
  `;
}

function bindBreadcrumbActions(favorites, favoriteOrder) {
  elements.foldersList.querySelectorAll('.folder-breadcrumb button').forEach((button) => {
    button.addEventListener('click', () => {
      const folderId = button.dataset.folderId || null;
      if (!folderId) renderFolders();
      else showFavoritesByCategory(folderId, favorites, favoriteOrder);
    });
  });
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
  container.querySelectorAll(`
    .is-drop-before,
    .is-drop-after,
    .is-drop-top,
    .is-drop-bottom,
    .is-drop-left,
    .is-drop-right,
    .is-dragging
  `)
    .forEach((item) => {
      item.classList.remove(
        'is-drop-before',
        'is-drop-after',
        'is-drop-top',
        'is-drop-bottom',
        'is-drop-left',
        'is-drop-right',
        'is-dragging'
      );
    });
}

function markReorderTarget(container, target, placement, direction = '') {
  container.querySelectorAll(`
    .is-drop-before,
    .is-drop-after,
    .is-drop-top,
    .is-drop-bottom,
    .is-drop-left,
    .is-drop-right
  `).forEach((item) => {
    item.classList.remove(
      'is-drop-before',
      'is-drop-after',
      'is-drop-top',
      'is-drop-bottom',
      'is-drop-left',
      'is-drop-right'
    );
  });
  target.classList.add(placement === 'after' ? 'is-drop-after' : 'is-drop-before');
  if (direction) target.classList.add(`is-drop-${direction}`);
}

function getDropPlacement(event, target) {
  const rect = target.getBoundingClientRect();
  const middleY = rect.top + rect.height / 2;
  return event.clientY >= middleY ? 'after' : 'before';
}

function getGridDropDirection(event, target) {
  const rect = target.getBoundingClientRect();
  const relativeX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const relativeY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
  const distances = [
    ['top', relativeY],
    ['bottom', 1 - relativeY],
    ['left', relativeX],
    ['right', 1 - relativeX]
  ];
  distances.sort((a, b) => a[1] - b[1]);
  return distances[0][0];
}

function getGridDropPlacement(direction) {
  return direction === 'bottom' || direction === 'right' ? 'after' : 'before';
}

function focusReorderedItem(container, selector, dataKey, value) {
  const item = Array.from(container.querySelectorAll(selector))
    .find((candidate) => candidate.dataset[dataKey] === value);
  if (!item) return;
  item.focus();
  item.classList.remove('motion-settled');
  requestAnimationFrame(() => item.classList.add('motion-settled'));
  item.addEventListener('animationend', () => {
    item.classList.remove('motion-settled');
  }, { once: true });
}

async function persistCategoryOrder(nextFolderIds, movedFolderId, parentId) {
  if (!Array.isArray(nextFolderIds)) return;
  const index = nextFolderIds.indexOf(movedFolderId);
  if (index < 0) return;
  const response = await sendRuntimeMessage('moveFolder', {
    folderId: movedFolderId,
    targetParentId: parentId,
    index
  });
  if (!response || response.status !== 'ok') {
    throw new Error(response && response.message ? response.message : t('browserBookmarkUnavailable'));
  }
  await loadFolderState();
  if (parentId) {
    const result = await storageGet(['favorites', 'favoriteOrder']);
    showFavoritesByCategory(parentId, result.favorites || [], result.favoriteOrder);
  } else {
    await renderFolders();
  }
  focusReorderedItem(elements.foldersList, '.folder-item', 'folderId', movedFolderId);
  const movedFolder = currentFolders.find((folder) => folder.id === movedFolderId);
  const message = t('categoryOrderUpdated', {
    category: movedFolder ? movedFolder.name : '',
    position: index + 1
  });
  announceFavoriteReorder(message);
}

function bindFolderInteractions(folders, favorites, parentId = null) {
  let draggedFolderId = '';
  let dragPreviewKey = '';
  let suppressClick = false;
  const items = Array.from(elements.foldersList.querySelectorAll('.folder-item'));

  items.forEach((item) => {
    item.addEventListener('click', (event) => {
      if (suppressClick) {
        event.preventDefault();
        return;
      }
      showFavoritesByCategory(item.dataset.folderId, favorites, activeFavoriteOrder);
    });

    item.addEventListener('keydown', (event) => {
      if (!event.altKey || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        return;
      }
      event.preventDefault();
      const offset = ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1;
      const ids = folders.map((folder) => folder.id);
      const nextIds = SmartFavOrder.moveValue(ids, item.dataset.folderId, offset);
      persistCategoryOrder(nextIds, item.dataset.folderId, parentId).catch(showFavoriteReorderError);
    });

    item.addEventListener('dragstart', (event) => {
      draggedFolderId = item.dataset.folderId;
      dragPreviewKey = '';
      suppressClick = true;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-smartfav-folder', draggedFolderId);
      event.dataTransfer.setData('text/plain', draggedFolderId);
      requestAnimationFrame(() => item.classList.add('is-dragging'));
    });

    item.addEventListener('dragover', (event) => {
      if (!draggedFolderId || draggedFolderId === item.dataset.folderId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      const direction = getGridDropDirection(event, item);
      const placement = getGridDropPlacement(direction);
      const nextFolderIds = SmartFavOrder.reorderValues(
        folders.map((folder) => folder.id),
        draggedFolderId,
        item.dataset.folderId,
        placement
      );
      const previewPosition = nextFolderIds.indexOf(draggedFolderId) + 1;
      markReorderTarget(
        elements.foldersList,
        item,
        placement,
        direction
      );
      const nextPreviewKey = `${item.dataset.folderId}:${direction}:${previewPosition}`;
      if (nextPreviewKey !== dragPreviewKey) {
        dragPreviewKey = nextPreviewKey;
        const draggedFolder = folders.find((folder) => folder.id === draggedFolderId);
        announceFavoriteReorder(t('folderDropPreview', {
          category: draggedFolder ? draggedFolder.name : '',
          position: previewPosition
        }));
      }
    });

    item.addEventListener('drop', (event) => {
      if (!draggedFolderId || draggedFolderId === item.dataset.folderId) return;
      event.preventDefault();
      const direction = getGridDropDirection(event, item);
      const placement = getGridDropPlacement(direction);
      const nextFolderIds = SmartFavOrder.reorderValues(
        folders.map((folder) => folder.id),
        draggedFolderId,
        item.dataset.folderId,
        placement
      );
      const movedFolderId = draggedFolderId;
      clearReorderMarkers(elements.foldersList);
      persistCategoryOrder(nextFolderIds, movedFolderId, parentId).catch(showFavoriteReorderError);
    });

    item.addEventListener('dragend', () => {
      draggedFolderId = '';
      dragPreviewKey = '';
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
  const retained = items.filter((item) => getTrashExpireAt(item, now) > now);
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
  const expiresAt = getTrashExpireAt(item);
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
  updateEmptyStates();
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

function showFavoritesByCategory(folderId, favorites, favoriteOrder = activeFavoriteOrder) {
  activeFavoriteCategory = folderId;
  activeFavoriteOrder = normalizeFavoriteOrderMap(favoriteOrder);
  elements.recentSection.classList.add('hidden');
  elements.foldersHeading.classList.add('hidden');
  renderFavoriteList(folderId, favorites, activeFavoriteOrder);
}

function applyFavoriteOrderById(favorites, folderId, orderedIds) {
  const direct = favorites.filter((favorite) => favorite.folderId === folderId);
  const byId = new Map(direct.map((favorite) => [favorite.id, favorite]));
  const ordered = (Array.isArray(orderedIds) ? orderedIds : [])
    .map((id) => byId.get(id))
    .filter(Boolean);
  const orderedSet = new Set(ordered.map((favorite) => favorite.id));
  return [...direct.filter((favorite) => !orderedSet.has(favorite.id)), ...ordered];
}

function renderFavoriteList(folderId, favorites, favoriteOrder = activeFavoriteOrder) {
  const folder = SmartFavFolderTree.getFolder(currentFolders, folderId);
  if (!folder) {
    renderFolders();
    return;
  }
  const orderedFavorites = applyFavoriteOrderById(favorites, folderId, favoriteOrder[folderId]);
  const childFolders = SmartFavFolderTree.childrenOf(currentFolders, folderId);
  elements.foldersList.classList.add('list-view');
  elements.foldersList.innerHTML = `
    ${renderFolderBreadcrumb(folderId)}
    <div class="category-header">
      <button class="back-button" id="backToFolders" type="button">${escapeHtml(t('backToCategories'))}</button>
      <div class="category-heading">
        <span class="category-title">${escapeHtml(folder.name)}</span>
        <span class="category-count">${escapeHtml(t('favoritesCount', { count: orderedFavorites.length }))}</span>
      </div>
    </div>
    ${childFolders.length ? `<div class="nested-folder-grid">
      ${childFolders.map((child) => `
        <button class="folder-item nested-folder-item" type="button" draggable="true" data-folder-id="${escapeHtml(child.id)}">
          <span class="reorder-grip folder-reorder-grip" aria-hidden="true"></span>
          <span class="folder-name">${escapeHtml(child.name)}</span>
          <span class="folder-count">${escapeHtml(t('folderItemCount', {
    count: getDescendantFavoriteCount(child.id, favorites)
  }))}</span>
        </button>
      `).join('')}
    </div>` : ''}
    <div class="favorite-list-rows">
      ${orderedFavorites.length
        ? orderedFavorites.map((favorite) => renderFavoriteRow(favorite, {
          showCategory: false,
          inFolder: true
        })).join('')
        : `<div class="empty-state">${escapeHtml(t('emptyCategory'))}</div>`}
    </div>
  `;
  document.getElementById('backToFolders').addEventListener('click', () => {
    if (folder.parentId) showFavoritesByCategory(folder.parentId, favorites, favoriteOrder);
    else renderFolders();
  });
  bindBreadcrumbActions(favorites, favoriteOrder);
  bindFolderInteractions(childFolders, favorites, folderId);
  bindFavoriteActions(elements.foldersList);
  bindFavoriteReordering(elements.foldersList, folderId);
}

function renderFavoriteRow(favorite, { showCategory = true, inFolder = false } = {}) {
  // favicon 也要过协议白名单：data: 图片可以承载任意内容，且 escapeHtml 只处理属性逃逸。
  const image = favorite.favicon && isSafeNavigableUrl(favorite.favicon)
    ? `<img src="${escapeHtml(favorite.favicon)}" class="favicon" alt="">`
    : '';
  // 非网页协议的收藏（例如从书签栏导入的 bookmarklet 历史数据）降级为不可点击，
  // 只展示文字，避免点击后触发导航。
  const navigable = isSafeNavigableUrl(favorite.url);
  const title = favorite.title || t('untitledPage');
  const hostname = getHostname(favorite.url);
  const category = favorite.category || t('otherCategory');
  const metadata = showCategory ? `${category} · ${hostname}` : hostname;
  const reorderAttributes = inFolder
    ? `
      draggable="true"
      data-favorite-id="${escapeHtml(favorite.id || '')}"
      data-favorite-url="${escapeHtml(favorite.url)}"
      data-folder-id="${escapeHtml(favorite.folderId || '')}"
      title="${escapeHtml(t('dragFavoriteHint'))}"`
    : '';
  const keyboardAttributes = inFolder
    ? 'aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"'
    : '';
  const targetFolders = currentFolders.filter((item) => item.id !== favorite.folderId);
  const moveSelect = inFolder && targetFolders.length
    ? `
      <select
        class="favorite-move-select"
        draggable="false"
        data-favorite-id="${escapeHtml(favorite.id || '')}"
        data-current-folder-id="${escapeHtml(favorite.folderId || '')}"
        aria-label="${escapeHtml(t('moveFavorite', { title }))}"
        title="${escapeHtml(t('moveFavorite', { title }))}"
      >
        <option value="" selected disabled>${escapeHtml(t('moveShort'))}</option>
        ${targetFolders.map((targetFolder) => (
          `<option value="${escapeHtml(targetFolder.id)}">${escapeHtml(getFolderPathLabel(targetFolder.id))}</option>`
        )).join('')}
      </select>`
    : '';
  const deleteButton = `
    <button
      class="favorite-delete-button"
      type="button"
      draggable="false"
      data-favorite-id="${escapeHtml(favorite.id || '')}"
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
      ${navigable
        ? `<button
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
      </button>`
        : `<span
        class="recent-item favorite-link favorite-link-blocked"
        title="${escapeHtml(t('unsafeUrlBlocked'))}"
      >
        <span class="recent-info">
          <span class="recent-title">${escapeHtml(title)}</span>
          <span class="recent-category">${escapeHtml(t('unsafeUrlBlocked'))}</span>
        </span>
      </span>`}
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
      const deleted = await deleteFavorite(button.dataset.favoriteId || button.dataset.url);
      if (!deleted) button.disabled = false;
    });
  });
  container.querySelectorAll('.favorite-move-select').forEach((select) => {
    select.addEventListener('pointerdown', (event) => event.stopPropagation());
    select.addEventListener('dragstart', (event) => event.preventDefault());
    select.addEventListener('change', async () => {
      const targetFolderId = select.value;
      if (!targetFolderId) return;
      select.disabled = true;
      const moved = await moveFavoriteToCategory(
        select.dataset.favoriteId,
        targetFolderId
      );
      if (!moved) {
        select.disabled = false;
        select.value = '';
      }
    });
  });
}

async function moveFavoriteToCategory(favoriteId, targetFolderId) {
  const categoryToKeep = activeFavoriteCategory;
  try {
    const response = await sendRuntimeMessage('moveFavorite', {
      favoriteId,
      targetFolderId
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
      : favoriteId;
    const targetCategory = getFolderPathLabel(targetFolderId);
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
      response.favorite || { title, url: '' },
      targetFolderId
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

function buildFolderDomainLearningProposal(favorite, targetFolderId) {
  const target = SmartFavFolderTree.getFolder(currentFolders, targetFolderId);
  let domain = '';
  try {
    domain = new URL(favorite && favorite.url ? favorite.url : '').hostname
      .replace(/^www\./i, '')
      .toLocaleLowerCase();
  } catch (_error) {
    return null;
  }
  if (!target || !domain) return null;
  const keyword = `domain:${domain}`;
  const previousFolders = currentFolders.filter((folder) => (
    (folder.keywords || []).some((item) => String(item).toLocaleLowerCase() === keyword)
  ));
  if (previousFolders.length === 1 && previousFolders[0].id === target.id) return null;
  return {
    type: 'domain',
    domain,
    keyword,
    targetFolderId: target.id,
    targetCategory: getFolderPathLabel(target.id),
    previousFolderIds: previousFolders
      .filter((folder) => folder.id !== target.id)
      .map((folder) => folder.id)
  };
}

function createFolderLearningResult(proposal) {
  const affectedIds = [...new Set([
    proposal.targetFolderId,
    ...(proposal.previousFolderIds || [])
  ])];
  const previousFolderKeywords = {};
  const folderUpdates = {};
  affectedIds.forEach((folderId) => {
    const folder = SmartFavFolderTree.getFolder(currentFolders, folderId);
    if (!folder) return;
    previousFolderKeywords[folderId] = [...(folder.keywords || [])];
    const filtered = (folder.keywords || []).filter((keyword) => (
      String(keyword).toLocaleLowerCase() !== proposal.keyword
    ));
    folderUpdates[folderId] = folderId === proposal.targetFolderId
      ? [...filtered, proposal.keyword]
      : filtered;
  });
  return { ...proposal, previousFolderKeywords, folderUpdates };
}

function showClassificationLearningPrompt(favorite, targetFolderId) {
  const proposal = buildFolderDomainLearningProposal(favorite, targetFolderId);
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
  elements.classificationLearningHint.textContent = proposal.previousFolderIds.length
    ? t('rememberClassificationConflictHint', {
      categories: proposal.previousFolderIds.map(getFolderPathLabel).join('、')
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
    const learned = createFolderLearningResult(proposal);
    for (const [folderId, keywords] of Object.entries(learned.folderUpdates)) {
      const response = await sendRuntimeMessage('updateFolder', {
        folderId,
        patch: { keywords }
      });
      if (!response || response.status !== 'ok') {
        throw new Error(response && response.message ? response.message : t('learningSaveFailed'));
      }
    }
    await loadFolderState();
    pendingPageLearningUndo = learned;
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

async function saveFavoriteOrder(folderId, nextIds, movedId, favorites, favoriteOrder) {
  const currentIds = applyFavoriteOrderById(
    favorites,
    folderId,
    favoriteOrder[folderId]
  ).map((favorite) => favorite.id);
  if (nextIds.join('\u0000') === currentIds.join('\u0000')) return;

  const nextFavoriteOrder = await updateStoredFavoriteOrder(folderId, nextIds);
  activeFavoriteOrder = nextFavoriteOrder;
  showFavoritesByCategory(folderId, favorites, nextFavoriteOrder);
  focusReorderedItem(elements.foldersList, '.favorite-row', 'favoriteId', movedId);

  const movedFavorite = favorites.find((favorite) => favorite.id === movedId);
  const message = t('favoriteOrderUpdated', {
    title: movedFavorite && movedFavorite.title ? movedFavorite.title : movedId,
    position: nextIds.indexOf(movedId) + 1
  });
  await finishFavoriteReorder(message, {
    folderId,
    orderedFavoriteIds: nextIds
  });
}

async function reorderFavorite(folderId, sourceId, targetId, placement) {
  const result = await storageGet(['favorites', 'favoriteOrder']);
  const favorites = Array.isArray(result.favorites) ? result.favorites : [];
  const favoriteOrder = normalizeFavoriteOrderMap(result.favoriteOrder);
  const displayedIds = applyFavoriteOrderById(favorites, folderId, favoriteOrder[folderId])
    .map((favorite) => favorite.id);
  const nextIds = SmartFavOrder.reorderValues(
    displayedIds,
    sourceId,
    targetId,
    placement
  );
  await saveFavoriteOrder(folderId, nextIds, sourceId, favorites, favoriteOrder);
}

async function moveFavorite(folderId, sourceId, offset) {
  const result = await storageGet(['favorites', 'favoriteOrder']);
  const favorites = Array.isArray(result.favorites) ? result.favorites : [];
  const favoriteOrder = normalizeFavoriteOrderMap(result.favoriteOrder);
  const displayedIds = applyFavoriteOrderById(favorites, folderId, favoriteOrder[folderId])
    .map((favorite) => favorite.id);
  const nextIds = SmartFavOrder.moveValue(
    displayedIds,
    sourceId,
    offset
  );
  await saveFavoriteOrder(folderId, nextIds, sourceId, favorites, favoriteOrder);
}

function bindFavoriteReordering(container, folderId) {
  let draggedId = '';
  const rows = Array.from(container.querySelectorAll('.favorite-row-in-folder'));

  rows.forEach((row) => {
    const link = row.querySelector('.favorite-link');
    if (link) {
      link.addEventListener('keydown', (event) => {
        if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        const offset = event.key === 'ArrowUp' ? -1 : 1;
        moveFavorite(folderId, row.dataset.favoriteId, offset).catch(showFavoriteReorderError);
      });
    }

    row.addEventListener('dragstart', (event) => {
      if (event.target.closest('.favorite-delete-button, .favorite-move-select')) {
        event.preventDefault();
        return;
      }
      draggedId = row.dataset.favoriteId;
      favoriteOpenSuppressUntil = Date.now() + 1000;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-smartfav-favorite', draggedId);
      event.dataTransfer.setData('text/plain', draggedId);
      requestAnimationFrame(() => row.classList.add('is-dragging'));
    });

    row.addEventListener('dragover', (event) => {
      if (!draggedId || draggedId === row.dataset.favoriteId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      markReorderTarget(container, row, getDropPlacement(event, row));
    });

    row.addEventListener('drop', (event) => {
      if (!draggedId || draggedId === row.dataset.favoriteId) return;
      event.preventDefault();
      const placement = getDropPlacement(event, row);
      const movedId = draggedId;
      clearReorderMarkers(container);
      reorderFavorite(
        folderId,
        movedId,
        row.dataset.favoriteId,
        placement
      ).catch(showFavoriteReorderError);
    });

    row.addEventListener('dragend', () => {
      draggedId = '';
      favoriteOpenSuppressUntil = Date.now() + 180;
      clearReorderMarkers(container);
    });
  });
}

async function deleteFavorite(identifier) {
  if (!identifier) return false;
  const categoryToKeep = activeView === 'favorites' ? activeFavoriteCategory : null;
  try {
    if (isExtension) {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'deleteFavorite', favoriteId: identifier }, (result) => {
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
      const removedFavorites = favorites.filter((favorite) => (
        favorite.id === identifier || favorite.url === identifier
      ));
      const removedIds = new Set(removedFavorites.map((favorite) => favorite.id));
      const now = Date.now();
      await storageSet({
        favorites: favorites.filter((favorite) => !removedIds.has(favorite.id)),
        recentlyDeleted: [
          ...removedFavorites.map((favorite, index) => ({
            ...favorite,
            trashId: `trash-${now}-${index}`,
            deletedAt: now,
            expiresAt: now + TRASH_RETENTION_MS
          })),
          ...recentlyDeleted.filter((item) => !removedIds.has(item.id))
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
  // 最后一道闸门：即使某条历史数据绕过了渲染层，也不允许导航到非网页协议。
  if (!isSafeNavigableUrl(url)) {
    showError(t('unsafeUrlBlocked'));
    return;
  }
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
  setCategorySelectOpen(false);
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

function setSettingsGroupCollapsed(group, collapsed) {
  if (!group) return;
  group.classList.toggle('collapsed', collapsed);
  group.querySelector('.settings-group-header')
    ?.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  const body = group.querySelector('.settings-group-body');
  if (!body) return;
  body.setAttribute('aria-hidden', collapsed ? 'true' : 'false');
  body.toggleAttribute('inert', collapsed);
}

// 设置页分组折叠：点击标题行切换 collapsed 状态，chevron 由 CSS 旋转。
// inert + aria-hidden 确保收起后内部控件不会继续进入键盘或读屏顺序。
function initSettingsGroupToggles() {
  const headers = elements.settingsView.querySelectorAll('.settings-group-header');
  headers.forEach((header) => {
    const group = header.closest('.settings-group');
    setSettingsGroupCollapsed(group, group?.classList.contains('collapsed'));
    if (header.dataset.bound) return;
    header.dataset.bound = 'true';
    header.addEventListener('click', () => {
      const group = header.closest('.settings-group');
      if (!group) return;
      setSettingsGroupCollapsed(group, !group.classList.contains('collapsed'));
    });
  });
  // AI 启用时自动展开 AI 分组
  const aiGroup = elements.settingsView.querySelector('[data-group="ai"]');
  if (aiGroup && currentSettings.aiEnabled) {
    setSettingsGroupCollapsed(aiGroup, false);
  }
  updateSettingsGroupSummaries();
}

function selectedOptionLabel(select) {
  if (!select || !select.selectedOptions || !select.selectedOptions.length) return '';
  return (select.selectedOptions[0].textContent || '').trim();
}

// 折叠态下也要能看出每组的当前状态，省得为了确认一个开关点开又收起。
function updateSettingsGroupSummaries() {
  if (!elements.settingsView) return;
  const summaries = {
    appearance: selectedOptionLabel(elements.compactThemeStyle),
    ai: currentSettings.aiEnabled
      ? selectedOptionLabel(elements.compactProvider)
      : t('summaryDisabled'),
    bookmarks: currentSettings.browserBookmarksEnabled
      ? t('summaryEnabled')
      : t('summaryDisabled'),
    backup: hasRestorableBookmarkPoint(currentBookmarkRestorePoint)
      ? t('summaryHasRestorePoint')
      : t('summaryNoRestorePoint')
  };
  elements.settingsView.querySelectorAll('.settings-group-summary').forEach((node) => {
    node.textContent = summaries[node.dataset.summary] || '';
  });
}

// P2 搜索 + P3 空状态
// 收藏和分类两个视图各持有一份搜索词与防抖计时器，互不干扰。
const SEARCH_DEBOUNCE_MS = 150;

const searchScopes = {
  favorites: {
    query: '',
    timer: null,
    input: () => elements.favoritesSearchInput,
    clearBtn: () => elements.favoritesSearchClear,
    // renderFolders 是异步的，且它自己会在写完 DOM 后调用 updateEmptyStates，
    // 这里只需要等它完成。
    refresh: async () => {
      await renderFolders(favoritesListParentId);
    }
  },
  categories: {
    query: '',
    timer: null,
    input: () => elements.categoriesSearchInput,
    clearBtn: () => elements.categoriesSearchClear,
    refresh: () => {
      renderCategoryRules();
      updateEmptyStates();
    }
  }
};

function clearSearch(scope) {
  const config = searchScopes[scope];
  if (!config) return;
  clearTimeout(config.timer);
  config.query = '';
  const input = config.input();
  const clearBtn = config.clearBtn();
  if (input) input.value = '';
  if (clearBtn) clearBtn.classList.add('hidden');
  config.refresh();
}

function bindSearchScope(scope) {
  const config = searchScopes[scope];
  if (!config) return;
  const input = config.input();
  const clearBtn = config.clearBtn();
  if (input && !input.dataset.bound) {
    input.dataset.bound = 'true';
    input.addEventListener('input', (event) => {
      config.query = event.target.value.trim().toLowerCase();
      if (clearBtn) clearBtn.classList.toggle('hidden', !config.query);
      clearTimeout(config.timer);
      config.timer = setTimeout(() => { config.refresh(); }, SEARCH_DEBOUNCE_MS);
    });
  }
  if (clearBtn && !clearBtn.dataset.bound) {
    clearBtn.dataset.bound = 'true';
    clearBtn.addEventListener('click', () => { clearSearch(scope); });
  }
}

function bindClickOnce(element, handler) {
  if (!element || element.dataset.bound) return;
  element.dataset.bound = 'true';
  element.addEventListener('click', handler);
}

function initSearchAndEmptyStates() {
  bindSearchScope('favorites');
  bindSearchScope('categories');
  bindClickOnce(elements.favoritesEmptyAction, () => { showView('home'); });
  bindClickOnce(elements.favoritesNoResultsAction, () => { clearSearch('favorites'); });
  bindClickOnce(elements.categoriesNoResultsAction, () => { clearSearch('categories'); });
}

// 按搜索词隐藏不匹配的条目，返回仍然可见的条目数。
// 判空必须用这个返回值而不是 children.length：全部过滤掉时节点还在 DOM 里，
// 只是 display:none，用 children.length 会把"搜索无结果"误判成"有内容"。
function applySearchFilter(container, itemSelector, query) {
  if (!container) return { total: 0, visible: 0 };
  const items = container.querySelectorAll(itemSelector);
  let visible = 0;
  items.forEach((item) => {
    const searchableText = item.dataset.searchText || item.textContent || '';
    const matched = !query || searchableText.toLowerCase().includes(query);
    item.style.display = matched ? '' : 'none';
    if (matched) visible += 1;
  });
  return { total: items.length, visible };
}

// "一条数据都没有"和"搜索没命中"是两种空，文案与操作不同，各用一个静态块。
function toggleEmptyState(list, emptyEl, noResultsEl, counts, query) {
  const isEmpty = counts.total === 0;
  const isNoMatch = !isEmpty && counts.visible === 0 && Boolean(query);
  if (emptyEl) emptyEl.classList.toggle('hidden', !isEmpty);
  if (noResultsEl) noResultsEl.classList.toggle('hidden', !isNoMatch);
  if (list) list.classList.toggle('hidden', isEmpty);
}

// 渲染后统一刷新三个视图的空状态。
function updateEmptyStates() {
  // 只有根层级的文件夹树才适用"还没有收藏"；子层级和"按分类看收藏"
  // （list-view）都有自己的上下文，不能套用整站级别的空状态。
  const favoritesQuery = searchScopes.favorites.query;
  const inFolderTreeRoot = favoritesListParentId === null
    && Boolean(elements.foldersList)
    && !elements.foldersList.classList.contains('list-view');
  const favoritesCounts = applySearchFilter(elements.foldersList, '.folder-item', favoritesQuery);
  toggleEmptyState(
    null,
    elements.favoritesEmptyState,
    elements.favoritesNoResults,
    inFolderTreeRoot ? favoritesCounts : { total: 1, visible: 1 },
    favoritesQuery
  );

  // 分类列表里还有面包屑节点，不能整块隐藏，所以 list 传 null。
  const categoriesQuery = searchScopes.categories.query;
  toggleEmptyState(
    null,
    elements.categoriesEmptyState,
    elements.categoriesNoResults,
    applySearchFilter(elements.categoryRulesList, '.category-rule-item', categoriesQuery),
    categoriesQuery
  );

  if (elements.trashEmptyState && elements.trashList) {
    elements.trashEmptyState.classList.toggle('hidden', elements.trashList.children.length > 0);
  }
}

function populateCompactSettings() {
  elements.compactThemeStyle.value = normalizeThemeStyle(currentSettings.themeStyle);
  previewThemeStyle = elements.compactThemeStyle.value;
  pendingBackgroundImage = currentSettings.customBackgroundImage || '';
  pendingBackgroundPositionX = normalizeBackgroundPosition(
    currentSettings.customBackgroundPositionX,
    DEFAULT_SETTINGS.customBackgroundPositionX
  );
  pendingBackgroundPositionY = normalizeBackgroundPosition(
    currentSettings.customBackgroundPositionY,
    DEFAULT_SETTINGS.customBackgroundPositionY
  );
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
  initSettingsGroupToggles();
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
  updateSettingsGroupSummaries();
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
  categoryDraft = SmartFavFolderTree.childrenOf(currentFolders, activeCategoryParentId).map((folder) => ({
    id: folder.id,
    parentId: folder.parentId,
    name: folder.name,
    path: getFolderPathLabel(folder.id),
    keywords: [...(folder.keywords || [])]
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
    customBackgroundImage: pendingBackgroundImage,
    customBackgroundPositionX: pendingBackgroundPositionX,
    customBackgroundPositionY: pendingBackgroundPositionY
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
  const hasImage = Boolean(pendingBackgroundImage);
  elements.backgroundImagePreview.classList.toggle('has-image', hasImage);
  elements.backgroundImagePreview.style.backgroundImage = pendingBackgroundImage
    ? `url(${JSON.stringify(pendingBackgroundImage)})`
    : '';
  updateBackgroundPositionDisplay();
  elements.backgroundImagePreview.tabIndex = hasImage ? 0 : -1;
  elements.backgroundImagePreview.setAttribute('aria-disabled', String(!hasImage));
  elements.clearBackgroundImageBtn.disabled = !hasImage;
  elements.resetBackgroundPositionBtn.disabled = !hasImage;
}

function updateBackgroundPositionDisplay() {
  const position = `${pendingBackgroundPositionX}% ${pendingBackgroundPositionY}%`;
  elements.backgroundImagePreview.style.backgroundPosition =
    position;
  document.documentElement.style.setProperty('--custom-background-position', position);
  elements.backgroundPositionValue.textContent =
    `${Math.round(pendingBackgroundPositionX)}% · ${Math.round(pendingBackgroundPositionY)}%`;
}

function updatePendingBackgroundPosition(positionX, positionY) {
  pendingBackgroundPositionX = normalizeBackgroundPosition(positionX);
  pendingBackgroundPositionY = normalizeBackgroundPosition(positionY);
  updateBackgroundPositionDisplay();
}

async function persistBackgroundPosition(statusKey = 'backgroundPositionSaved') {
  await persistSettingsPatch(
    {
      customBackgroundPositionX: pendingBackgroundPositionX,
      customBackgroundPositionY: pendingBackgroundPositionY
    },
    { applyAppearanceNow: true, statusKey }
  );
}

function handleBackgroundPositionPointerDown(event) {
  if (!pendingBackgroundImage || event.button !== 0) return;
  const rect = elements.backgroundImagePreview.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  event.preventDefault();
  backgroundPositionDrag = {
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startPositionX: pendingBackgroundPositionX,
    startPositionY: pendingBackgroundPositionY,
    width: rect.width,
    height: rect.height
  };
  elements.backgroundImagePreview.classList.add('is-dragging');
  elements.backgroundImagePreview.setPointerCapture(event.pointerId);
}

function handleBackgroundPositionPointerMove(event) {
  if (!backgroundPositionDrag || event.pointerId !== backgroundPositionDrag.pointerId) return;
  const offsetX = event.clientX - backgroundPositionDrag.startClientX;
  const offsetY = event.clientY - backgroundPositionDrag.startClientY;
  updatePendingBackgroundPosition(
    backgroundPositionDrag.startPositionX - (offsetX / backgroundPositionDrag.width) * 100,
    backgroundPositionDrag.startPositionY - (offsetY / backgroundPositionDrag.height) * 100
  );
}

async function finishBackgroundPositionDrag(event) {
  if (!backgroundPositionDrag || event.pointerId !== backgroundPositionDrag.pointerId) return;
  const pointerId = backgroundPositionDrag.pointerId;
  backgroundPositionDrag = null;
  elements.backgroundImagePreview.classList.remove('is-dragging');
  if (elements.backgroundImagePreview.hasPointerCapture(pointerId)) {
    elements.backgroundImagePreview.releasePointerCapture(pointerId);
  }
  await persistBackgroundPosition();
}

async function handleBackgroundPositionKeydown(event) {
  if (!pendingBackgroundImage) return;
  const step = event.shiftKey ? 10 : 2;
  const offsets = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step]
  };
  const offset = offsets[event.key];
  if (!offset) return;
  event.preventDefault();
  updatePendingBackgroundPosition(
    pendingBackgroundPositionX + offset[0],
    pendingBackgroundPositionY + offset[1]
  );
  await persistBackgroundPosition();
}

async function resetBackgroundPosition() {
  updatePendingBackgroundPosition(
    DEFAULT_SETTINGS.customBackgroundPositionX,
    DEFAULT_SETTINGS.customBackgroundPositionY
  );
  await persistBackgroundPosition('backgroundPositionReset');
}

function readBackgroundImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      reject(new Error(t('backgroundImageTypeError')));
      return;
    }
    if (file.size > MAX_BACKGROUND_IMAGE_BYTES) {
      reject(new Error(t('backgroundImageTooLarge')));
      return;
    }
    const reader = new FileReader();
    reader.addEventListener(
      'load',
      () => {
        const dataUrl = String(reader.result || '');
        // base64 编码后体积约为原文件的 4/3，settings 与收藏、还原点共用
        // storage.local 配额，因此按编码后的实际长度再校验一次。
        if (dataUrl.length > MAX_BACKGROUND_IMAGE_BYTES * 2) {
          reject(new Error(t('backgroundImageTooLarge')));
          return;
        }
        resolve(dataUrl);
      },
      { once: true }
    );
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
    pendingBackgroundPositionX = DEFAULT_SETTINGS.customBackgroundPositionX;
    pendingBackgroundPositionY = DEFAULT_SETTINGS.customBackgroundPositionY;
    updateBackgroundImagePreview();
    updateAppearancePreview();
    await persistSettingsPatch(
      {
        customBackgroundImage: pendingBackgroundImage,
        customBackgroundPositionX: pendingBackgroundPositionX,
        customBackgroundPositionY: pendingBackgroundPositionY
      },
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
  pendingBackgroundPositionX = DEFAULT_SETTINGS.customBackgroundPositionX;
  pendingBackgroundPositionY = DEFAULT_SETTINGS.customBackgroundPositionY;
  updateBackgroundImagePreview();
  updateAppearancePreview();
  await persistSettingsPatch(
    {
      customBackgroundImage: '',
      customBackgroundPositionX: pendingBackgroundPositionX,
      customBackgroundPositionY: pendingBackgroundPositionY
    },
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
  const saveTask = settingsSaveQueue
    .catch(() => undefined)
    .then(() => updateStoredSettings(patch));
  settingsSaveQueue = saveTask;
  try {
    const savedSettings = await saveTask;
    if (settingsSaveQueue === saveTask) currentSettings = savedSettings;
    if (applyAppearanceNow) applyAppearance();
    if (refreshSuggestion && currentTabInfo) {
      currentSuggestion = classifyCurrentFolders(currentTabInfo);
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

function updateCategoryNameFromInput(input) {
  const index = Number(input.dataset.categoryIndex);
  if (!Number.isInteger(index) || !categoryDraft[index]) return;
  categoryDraft[index].name = input.value.trim();
}

function syncCategoryDraftFromInputs() {
  elements.categoryRulesList
    .querySelectorAll('.category-name-input')
    .forEach((input) => updateCategoryNameFromInput(input));
  elements.categoryRulesList
    .querySelectorAll('.category-keywords-input')
    .forEach((input) => updateCategoryKeywordsFromInput(input));
}

function buildAIKeywordPrompt(profiles) {
  const folders = profiles.map((profile) => ({
    folderId: profile.category,
    path: profile.name,
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
    项目资料: ['团队协作', '项目流程'],
    Projects: ['team collaboration', 'project workflow']
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

function buildAIOrganizationPrompt(profiles) {
  return t('aiOrganizationPrompt', {
    folders: JSON.stringify(profiles, null, 2)
  });
}

function describeAIOrganizationOperation(operation) {
  if (operation.type === 'move_favorite') {
    return t('aiOrganizationMoveFavorite', {
      title: operation.favoriteTitle || operation.favoriteId,
      category: getFolderPathLabel(operation.targetFolderId) || operation.targetFolderId
    });
  }
  if (operation.type === 'create_folder') {
    const parent = operation.parentId
      ? getFolderPathLabel(operation.parentId) || operation.parentId
      : t('favoriteCategories');
    return t('aiOrganizationCreateFolder', { path: `${parent} › ${operation.name}` });
  }
  return t('aiOrganizationAddKeywords', {
    category: getFolderPathLabel(operation.folderId) || operation.folderId,
    keywords: (operation.keywords || []).join(', ')
  });
}

function renderAIOrganizationPreview(response) {
  activeAIOrganizationProposal = response;
  elements.aiOrganizationPreview.classList.remove('hidden');
  elements.aiOrganizationPreviewSummary.textContent = t('aiOrganizationPreviewSummary', {
    count: response.operations.length,
    rejected: (response.rejected || []).length
  });
  elements.aiOrganizationOperations.innerHTML = response.operations.map((operation) => `
    <label class="ai-organization-operation">
      <input type="checkbox" value="${escapeHtml(operation.id)}" checked>
      <span>
        <strong>${escapeHtml(describeAIOrganizationOperation(operation))}</strong>
        ${operation.reason ? `<small>${escapeHtml(operation.reason)}</small>` : ''}
      </span>
    </label>
  `).join('');
}

async function analyzeAIOrganization() {
  if (!currentSettings.aiEnabled) {
    showCategorySettingsStatus(t('aiKeywordNeedsEnabled'), 'error');
    return;
  }
  const provider = SmartFavAI.getProvider(currentSettings.apiProvider);
  if (provider.requiresKey && !String(currentSettings.apiKey || '').trim()) {
    showCategorySettingsStatus(t('apiKeyRequired'), 'error');
    return;
  }
  const result = await storageGet(['favorites']);
  const favorites = Array.isArray(result.favorites) ? result.favorites : [];
  const profiles = SmartFavAIOrganization.buildProfiles(
    currentFolders,
    favorites,
    SmartFavFolderTree,
    12
  );
  if (!profiles.some((profile) => profile.favorites.length)) {
    showCategorySettingsStatus(t('aiKeywordNoFavorites'), 'error');
    return;
  }
  elements.aiOrganizationAnalyzeBtn.disabled = true;
  elements.aiOrganizationAnalyzeBtn.textContent = t('optimizing');
  try {
    const rawResponse = await SmartFavAI.call(buildAIOrganizationPrompt(profiles), currentSettings);
    const rawOperations = SmartFavAIOrganization.parseOperations(rawResponse);
    const response = await sendRuntimeMessage('previewAIOrganization', { operations: rawOperations });
    if (!response || !['ok', 'partial'].includes(response.status) || !response.operations.length) {
      throw new Error(t('aiOrganizationNoSuggestions'));
    }
    renderAIOrganizationPreview(response);
    showCategorySettingsStatus(t('aiOrganizationReady'), 'success');
  } catch (error) {
    activeAIOrganizationProposal = null;
    elements.aiOrganizationPreview.classList.add('hidden');
    showCategorySettingsStatus(t('aiOrganizationFailed', { message: error.message }), 'error');
  } finally {
    elements.aiOrganizationAnalyzeBtn.disabled = false;
    elements.aiOrganizationAnalyzeBtn.textContent = t('aiOrganizationAnalyze');
  }
}

async function applyAIOrganizationSelection() {
  if (!activeAIOrganizationProposal) return;
  const operationIds = [...elements.aiOrganizationOperations.querySelectorAll('input:checked')]
    .map((input) => input.value);
  if (!operationIds.length) {
    showCategorySettingsStatus(t('aiOrganizationChooseOne'), 'error');
    return;
  }
  elements.aiOrganizationApplyBtn.disabled = true;
  try {
    const response = await sendRuntimeMessage('applyAIOrganization', {
      proposalId: activeAIOrganizationProposal.proposalId,
      operationIds
    });
    // 'partial' 表示本地已写入、但浏览器书签侧没有完全同步：
    // 不能当失败回滚（本地已经变了），也不能当完全成功，需要单独提示。
    if (!response || !['ok', 'partial'].includes(response.status)) {
      throw new Error(describeFolderError(response, 'aiOrganizationApplyFailed'));
    }
    activeAIOrganizationProposal = null;
    elements.aiOrganizationPreview.classList.add('hidden');
    await loadFolderState();
    populateCategoryManager();
    await Promise.all([renderFolders(), renderRecentFavorites()]);
    const appliedSummary = t('aiOrganizationApplied', {
      count: Number(response.applied) || 0,
      folders: Number(response.createdFolders) || 0,
      moved: Number(response.movedFavorites) || 0
    });
    if (response.status === 'partial') {
      showCategorySettingsStatus(`${appliedSummary} · ${t('partialApplySummary')}`, 'error');
    } else {
      showCategorySettingsStatus(appliedSummary, 'success');
    }
  } catch (error) {
    showCategorySettingsStatus(t('aiOrganizationApplyFailed', { message: error.message }), 'error');
  } finally {
    elements.aiOrganizationApplyBtn.disabled = false;
  }
}

function renderCategoryRules() {
  const breadcrumb = activeCategoryParentId
    ? renderCategoryManagerBreadcrumb(activeCategoryParentId)
    : '';
  elements.categoryRulesList.innerHTML = breadcrumb + categoryDraft.map((item, index) => {
    const suggestionCount = Number(categoryKeywordSuggestionCounts[item.id]) || 0;
    const blockedTargets = new Set([item.id, ...getFolderDescendantIds(item.id)]);
    const parentOptions = currentFolders.filter((folder) => !blockedTargets.has(folder.id));
    const deleteDefault = item.parentId
      || (SmartFavFolderTree.getFallbackFolder(currentFolders, currentSettings.language) || {}).id
      || '';
    return `
    <div
      class="category-rule-item${suggestionCount ? ' has-ai-suggestions' : ''}"
      data-category-index="${index}"
      data-folder-id="${escapeHtml(item.id)}"
      data-search-text="${escapeHtml([item.path, item.name, ...(item.keywords || [])].join(' ').toLowerCase())}"
    >
      <div class="category-rule-header">
        <span class="category-rule-title category-rule-name-field">
          <input class="category-name-input" data-category-index="${index}" value="${escapeHtml(item.name)}" aria-label="${escapeHtml(t('folderName'))}">
          ${suggestionCount
    ? `<span class="category-rule-ai-badge">AI +${suggestionCount}</span>`
    : ''}
        </span>
        <button class="category-enter-button" type="button" data-folder-id="${escapeHtml(item.id)}">${escapeHtml(t('openFolder'))}</button>
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
      <div class="category-folder-actions">
        <label>
          <span>${escapeHtml(t('moveFolderTo'))}</span>
          <select class="category-parent-select" data-folder-id="${escapeHtml(item.id)}">
            <option value="">${escapeHtml(t('favoriteCategories'))}</option>
            ${parentOptions.map((folder) => `
              <option value="${escapeHtml(folder.id)}"${folder.id === item.parentId ? ' selected' : ''}>${escapeHtml(getFolderPathLabel(folder.id))}</option>
            `).join('')}
          </select>
        </label>
        <label>
          <span>${escapeHtml(t('deleteMoveTo'))}</span>
          <select class="category-delete-target" data-folder-id="${escapeHtml(item.id)}">
            <option value="">${escapeHtml(t('chooseFolder'))}</option>
            ${parentOptions.map((folder) => `
              <option value="${escapeHtml(folder.id)}"${folder.id === deleteDefault ? ' selected' : ''}>${escapeHtml(getFolderPathLabel(folder.id))}</option>
            `).join('')}
          </select>
        </label>
      </div>
    </div>
  `;
  }).join('');
  updateEmptyStates();
}

function renderCategoryManagerBreadcrumb(folderId) {
  const path = SmartFavFolderTree.getPath(currentFolders, folderId);
  return `
    <nav class="folder-breadcrumb category-manager-breadcrumb" aria-label="${escapeHtml(t('folderPath'))}">
      <button type="button" data-category-parent-id="">${escapeHtml(t('favoriteCategories'))}</button>
      ${path.map((folder) => `
        <span aria-hidden="true">›</span>
        <button type="button" data-category-parent-id="${escapeHtml(folder.id)}">${escapeHtml(folder.name)}</button>
      `).join('')}
    </nav>
  `;
}

async function addCategoryFolder() {
  const name = elements.compactNewCategory.value.trim();
  if (!name) {
    elements.compactNewCategory.focus();
    return;
  }
  const response = await sendRuntimeMessage('createFolder', {
    folder: { parentId: activeCategoryParentId, name, keywords: [], source: 'user' }
  });
  if (!response || response.status !== 'ok') {
    showCategorySettingsStatus(
      describeFolderError(response, 'duplicateCategory', { conflict: 'duplicateCategory' }),
      'error'
    );
    return;
  }
  await loadFolderState();
  elements.compactNewCategory.value = '';
  populateCategoryManager();
  showCategorySettingsStatus(t('categoryAdded'), 'success');
  const newRuleInput = elements.categoryRulesList.querySelector(`[data-folder-id="${response.folder.id}"] .category-keywords-input`);
  if (newRuleInput) newRuleInput.focus();
}

// 后端 folder 相关接口统一返回 { status, message }，其中 message 是英文调试文案。
// 这里按 status 分派到 i18n 文案，避免把内部英文直接透给用户；
// overrides 允许调用点针对具体操作给出更贴切的措辞。
function describeFolderError(response, fallbackKey, overrides = {}) {
  const status = response && response.status ? response.status : 'error';
  if (overrides[status]) return t(overrides[status]);
  if (status === 'conflict') return t('folderNameConflict');
  if (status === 'invalid') return t('folderInvalidInput');
  return t(fallbackKey || 'folderOperationFailed');
}

async function removeCategoryFolder(index, targetFolderId) {
  const item = categoryDraft[index];
  if (!item) return;
  // 非空文件夹（有子文件夹或直接收藏）必须先指定迁移目标，
  // 否则后端只会回一个英文 invalid，用户看不懂也不知道该改哪里。
  const hasChildren = currentFolders.some((folder) => folder.parentId === item.id);
  if (!targetFolderId && hasChildren) {
    showCategorySettingsStatus(t('migrationTargetRequired'), 'error');
    return;
  }
  // 删除文件夹会连带迁移其下全部收藏，属于不易撤销的操作，加一道二次确认。
  if (!window.confirm(t('confirmDeleteFolder', { name: item.name }))) return;
  const response = await sendRuntimeMessage('deleteFolder', {
    folderId: item.id,
    targetFolderId
  });
  if (!response || response.status !== 'ok') {
    showCategorySettingsStatus(
      describeFolderError(response, 'categoryRemoveFailed', {
        invalid: 'migrationTargetRequired',
        conflict: 'folderInvalidInput'
      }),
      'error'
    );
    return;
  }
  delete categoryKeywordSuggestionCounts[item.id];
  await loadFolderState();
  populateCategoryManager();
  showCategorySettingsStatus(t('categoryRemoved'), 'success');
}

function reclassifyFavoriteRecord(favorite, settings) {
  const suggestion = SmartFavClassifier.classifyFolders({
    title: favorite.title || favorite.url,
    url: favorite.url,
    description: favorite.description || '',
    keywords: favorite.keywords || []
  }, settings, currentFolders);
  return {
    ...favorite,
    category: suggestion.category,
    folderId: suggestion.folderId,
    tags: suggestion.tags,
    summary: suggestion.summary,
    classificationSource: 'local',
    reclassifiedAt: Date.now()
  };
}

function classificationChanged(previous, next) {
  return previous.folderId !== next.folderId
    || previous.category !== next.category
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
elements.backgroundImagePreview.addEventListener('pointerdown', handleBackgroundPositionPointerDown);
elements.backgroundImagePreview.addEventListener('pointermove', handleBackgroundPositionPointerMove);
elements.backgroundImagePreview.addEventListener('pointerup', finishBackgroundPositionDrag);
elements.backgroundImagePreview.addEventListener('pointercancel', finishBackgroundPositionDrag);
elements.backgroundImagePreview.addEventListener('keydown', handleBackgroundPositionKeydown);
elements.resetBackgroundPositionBtn.addEventListener('click', resetBackgroundPosition);
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
elements.aiOrganizationAnalyzeBtn.addEventListener('click', analyzeAIOrganization);
elements.aiOrganizationApplyBtn.addEventListener('click', applyAIOrganizationSelection);
elements.compactNewCategory.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  addCategoryFolder();
});
elements.categoryRulesList.addEventListener('input', (event) => {
  if (event.target.classList.contains('category-keywords-input')) {
    updateCategoryKeywordsFromInput(event.target);
  } else if (event.target.classList.contains('category-name-input')) {
    updateCategoryNameFromInput(event.target);
  }
});
elements.categoryRulesList.addEventListener('focusout', (event) => {
  if (!event.target.classList.contains('category-keywords-input')) return;
  updateCategoryKeywordsFromInput(event.target, { format: true });
});
elements.categoryRulesList.addEventListener('click', (event) => {
  const breadcrumbButton = event.target.closest('[data-category-parent-id]');
  if (breadcrumbButton) {
    activeCategoryParentId = breadcrumbButton.dataset.categoryParentId || null;
    populateCategoryManager();
    return;
  }
  const enterButton = event.target.closest('.category-enter-button');
  if (enterButton) {
    activeCategoryParentId = enterButton.dataset.folderId || null;
    populateCategoryManager();
    return;
  }
  const removeButton = event.target.closest('.category-remove-button');
  if (!removeButton) return;
  const index = Number(removeButton.dataset.categoryIndex);
  if (!Number.isInteger(index) || !categoryDraft[index]) return;
  const row = removeButton.closest('.category-rule-item');
  const targetFolderId = row && row.querySelector('.category-delete-target')
    ? row.querySelector('.category-delete-target').value
    : '';
  removeCategoryFolder(index, targetFolderId);
});

elements.categoryRulesList.addEventListener('change', async (event) => {
  if (!event.target.classList.contains('category-parent-select')) return;
  const folderId = event.target.dataset.folderId;
  const targetParentId = event.target.value || null;
  const previousParentId = SmartFavFolderTree.getFolder(currentFolders, folderId)?.parentId || null;
  if (previousParentId === targetParentId) return;
  const response = await sendRuntimeMessage('moveFolder', { folderId, targetParentId });
  if (!response || response.status !== 'ok') {
    event.target.value = previousParentId || '';
    showCategorySettingsStatus(describeFolderError(response, 'categoryMoveFailed'), 'error');
    return;
  }
  await loadFolderState();
  populateCategoryManager();
  showCategorySettingsStatus(t('categoryMoved'), 'success');
});

elements.categorySaveBtn.addEventListener('click', async () => {
  syncCategoryDraftFromInputs();
  elements.categorySaveBtn.disabled = true;
  elements.categorySaveBtn.textContent = t('reclassifying');
  try {
    for (const item of categoryDraft) {
      if (!item.name) throw new Error(t('folderNameRequired'));
      const response = await sendRuntimeMessage('updateFolder', {
        folderId: item.id,
        patch: { name: item.name, keywords: item.keywords }
      });
      if (!response || response.status !== 'ok') {
        throw new Error(describeFolderError(response, 'categorySaveFailed'));
      }
    }
    await loadFolderState();
    const result = await reclassifyStoredFavorites();
    await Promise.all([renderFolders(), renderRecentFavorites()]);
    if (currentTabInfo) {
      currentSuggestion = classifyCurrentFolders(currentTabInfo);
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
