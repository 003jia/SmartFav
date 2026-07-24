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
const isExtension = typeof chrome !== 'undefined' && Boolean(chrome.storage && chrome.tabs);
const previewState = {
  settings: DEFAULT_SETTINGS,
  recentlyDeleted: [],
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
  errorStatus: document.getElementById('errorStatus'),
  errorMsg: document.getElementById('errorMsg'),
  categorySection: document.getElementById('categorySection'),
  saveTitle: document.getElementById('saveTitle'),
  pageHost: document.getElementById('pageHost'),
  categorySelect: document.getElementById('categorySelect'),
  categorySummary: document.getElementById('categorySummary'),
  sourceBadge: document.getElementById('sourceBadge'),
  tagsContainer: document.getElementById('tagsContainer'),
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
  compactNewCategory: document.getElementById('compactNewCategory'),
  compactAddCategoryBtn: document.getElementById('compactAddCategoryBtn'),
  categoryRulesList: document.getElementById('categoryRulesList'),
  categorySettingsStatus: document.getElementById('categorySettingsStatus'),
  categorySaveBtn: document.getElementById('categorySaveBtn'),
  compactTestBtn: document.getElementById('compactTestBtn'),
  compactSettingsStatus: document.getElementById('compactSettingsStatus'),
  compactSaveBtn: document.getElementById('compactSaveBtn')
};

let currentTabInfo = null;
let currentSuggestion = null;
let currentSettings = DEFAULT_SETTINGS;
let categoryDraft = [];
let previewThemeStyle = DEFAULT_SETTINGS.themeStyle;
let pendingBackgroundImage = DEFAULT_SETTINGS.customBackgroundImage;
let showingAllFavorites = false;
let activeView = 'home';
let aiEnhanceInFlight = false;

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
  return new Promise((resolve) => chrome.storage.local.set(values, resolve));
}

function sendRuntimeMessage(type, payload = {}) {
  if (!isExtension || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
    return Promise.resolve({ status: 'unavailable' });
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
  const previousLanguage = currentSettings.language;
  const nextLanguage = previousLanguage === 'zh_CN' ? 'en' : 'zh_CN';
  const shouldMigrateDefaults = isUsingDefaultClassification(currentSettings, previousLanguage);
  const nextDefaults = SmartFavClassifier.getDefaults(nextLanguage);
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
          .split(/[,，]/)
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
  elements.categorySummary.textContent = suggestion.summary;
  elements.tagsContainer.innerHTML = suggestion.tags
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join('');
  elements.sourceBadge.textContent = t(suggestion.source === 'ai' ? 'aiEnhanced' : 'localRules');
  elements.sourceBadge.classList.toggle('ai', suggestion.source === 'ai');
  elements.enhanceBtn.classList.toggle('hidden', !currentSettings.aiEnabled);
  elements.enhanceBtn.textContent = t('aiOptimize');
  elements.privacyHint.textContent = t(suggestion.source === 'ai' ? 'privacyAI' : 'privacyLocal');
  updateConfirmLabel();
}

function updateConfirmLabel() {
  const category = elements.categorySelect.value || t('bookmarksFallback');
  elements.confirmBtn.textContent = t('saveToCategory', { category });
}

elements.categorySelect.addEventListener('change', () => {
  if (currentSuggestion) currentSuggestion.category = elements.categorySelect.value;
  updateConfirmLabel();
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
  const result = await storageGet(['favorites']);
  const favorites = Array.isArray(result.favorites) ? result.favorites : [];
  const favorite = {
    ...currentTabInfo,
    category: elements.categorySelect.value,
    tags: currentSuggestion.tags,
    summary: currentSuggestion.summary,
    classificationSource: currentSuggestion.source,
    createdAt: Date.now()
  };
  const withoutDuplicate = favorites.filter((item) => item.url !== favorite.url);
  await storageSet({ favorites: [favorite, ...withoutDuplicate] });

  let successKey = 'savedToSmartFav';
  if (currentSettings.browserBookmarksEnabled) {
    try {
      const bookmarksApi = isExtension && chrome.bookmarks ? chrome.bookmarks : null;
      const bookmarkResult = await SmartFavBookmarks.writeFavorite(
        favorite,
        currentSettings,
        bookmarksApi
      );
      if (bookmarkResult.status === 'unavailable') throw new Error(t('browserBookmarkUnavailable'));
      successKey = 'savedToBrowser';
    } catch (error) {
      console.error('Browser favorite write failed:', error);
      successKey = 'savedBrowserFailed';
    }
  }

  elements.categorySection.classList.add('hidden');
  elements.successMsg.textContent = t(successKey);
  elements.successStatus.classList.remove('hidden');
  await Promise.all([renderFolders(), renderRecentFavorites()]);
  elements.confirmBtn.disabled = false;
  if (isExtension) setTimeout(() => window.close(), 1300);
});

async function renderFolders() {
  const result = await storageGet(['favorites', 'settings']);
  const favorites = Array.isArray(result.favorites) ? result.favorites : [];
  const categories = result.settings && Array.isArray(result.settings.categories) && result.settings.categories.length
    ? result.settings.categories
    : currentSettings.categories;
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
    <button class="folder-item" type="button" data-category="${escapeHtml(category)}">
      <span class="folder-name">${escapeHtml(category)}</span>
      <span class="folder-count">${counts[category] || 0}</span>
    </button>
  `).join('');
  elements.foldersList.querySelectorAll('.folder-item').forEach((item) => {
    item.addEventListener('click', () => showFavoritesByCategory(item.dataset.category, favorites));
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
  elements.recentList.innerHTML = visibleFavorites.map(renderFavoriteRow).join('');
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

function showFavoritesByCategory(category, favorites) {
  elements.recentSection.classList.add('hidden');
  elements.foldersHeading.classList.add('hidden');
  renderFavoriteList(category, favorites.filter((favorite) => favorite.category === category));
}

function renderFavoriteList(title, favorites) {
  elements.foldersList.classList.add('list-view');
  elements.foldersList.innerHTML = `
    <div class="category-header">
      <button class="back-button" id="backToFolders" type="button">${escapeHtml(t('backToCategories'))}</button>
      <span class="category-title">${escapeHtml(title)} · ${favorites.length}</span>
    </div>
    ${favorites.length
      ? favorites.map(renderFavoriteRow).join('')
      : `<div class="empty-state">${escapeHtml(t('emptyCategory'))}</div>`}
  `;
  document.getElementById('backToFolders').addEventListener('click', renderFolders);
  bindFavoriteActions(elements.foldersList);
}

function renderFavoriteRow(favorite) {
  const image = favorite.favicon
    ? `<img src="${escapeHtml(favorite.favicon)}" class="favicon" alt="">`
    : '';
  const title = favorite.title || t('untitledPage');
  return `
    <div class="favorite-row">
      <button class="recent-item favorite-link" type="button" data-url="${escapeHtml(favorite.url)}">
        ${image}
        <span class="recent-info">
          <span class="recent-title">${escapeHtml(title)}</span>
          <span class="recent-category">${escapeHtml(favorite.category || t('otherCategory'))}</span>
        </span>
      </button>
      <button
        class="favorite-delete-button"
        type="button"
        data-url="${escapeHtml(favorite.url)}"
        aria-label="${escapeHtml(t('deleteFavorite', { title }))}"
      >${escapeHtml(t('deleteShort'))}</button>
    </div>
  `;
}

function bindFavoriteActions(container) {
  container.querySelectorAll('.favicon').forEach((image) => {
    image.addEventListener('error', () => image.remove(), { once: true });
  });
  container.querySelectorAll('.favorite-link').forEach((item) => {
    item.addEventListener('click', () => openUrl(item.dataset.url));
  });
  container.querySelectorAll('.favorite-delete-button').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      const deleted = await deleteFavorite(button.dataset.url);
      if (!deleted) button.disabled = false;
    });
  });
}

async function deleteFavorite(url) {
  if (!url) return false;
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
elements.settingsBtn.addEventListener('click', () => {
  showView(activeView === 'home' ? 'settings' : 'home');
});

async function showView(view) {
  activeView = ['home', 'favorites', 'categories', 'trash', 'settings'].includes(view)
    ? view
    : 'home';
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
  elements.compactModel.value = currentSettings.model || SmartFavAI.getProvider(elements.compactProvider.value).model;
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
  updateCompactAIFields(false);
  updateCompactBookmarkFields();
  updateAppearancePreview();
  updatePopupSizeLabels();
  updateBackgroundImagePreview();
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
    showCompactSettingsStatus(t('backgroundImageReady'), 'success');
  } catch (error) {
    showCompactSettingsStatus(error.message, 'error');
  } finally {
    elements.compactBackgroundImage.value = '';
  }
}

function clearBackgroundImage() {
  pendingBackgroundImage = '';
  updateBackgroundImagePreview();
  updateAppearancePreview();
  showCompactSettingsStatus(t('backgroundImageCleared'), 'success');
}

function handlePopupSizeInput() {
  updatePopupSizeLabels();
  updateAppearancePreview();
}

function handleThemeStyleChange() {
  const nextThemeStyle = normalizeThemeStyle(elements.compactThemeStyle.value);
  if (previewThemeStyle === 'black' && nextThemeStyle !== 'black') {
    elements.compactDarkMode.checked = false;
  }
  updateAppearancePreview();
}

function updateCompactAIFields(resetModel) {
  const provider = SmartFavAI.getProvider(elements.compactProvider.value);
  elements.compactAiFields.classList.toggle('hidden', !elements.compactAiEnabled.checked);
  elements.compactApiKeyField.classList.toggle('hidden', !provider.requiresKey);
  if (resetModel || !elements.compactModel.value.trim()) elements.compactModel.value = provider.model;
  elements.compactKeywordWeightValue.textContent = elements.compactKeywordWeight.value;
}

function updateCompactBookmarkFields() {
  elements.compactBookmarkFields.classList.toggle(
    'hidden',
    !elements.compactBrowserBookmarksEnabled.checked
  );
}

async function persistBookmarkSettings(patch) {
  currentSettings = { ...currentSettings, ...patch };
  await storageSet({ settings: currentSettings });
  showCompactSettingsStatus(t('settingsSaved'), 'success');
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
  await persistBookmarkSettings({
    bookmarkOrganizeEnabled: enabled
  });
  if (enabled) await runOrganizeBookmarks();
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
  return [...new Set(String(value || '')
    .split(/[,，]/)
    .map((keyword) => keyword.trim())
    .filter(Boolean))];
}

function renderCategoryRules() {
  elements.categoryRulesList.innerHTML = categoryDraft.map((item, index) => `
    <div class="category-rule-item" data-category-index="${index}">
      <div class="category-rule-header">
        <span class="category-rule-name">${escapeHtml(item.name)}</span>
        <button
          class="category-remove-button"
          type="button"
          data-category-index="${index}"
          aria-label="${escapeHtml(t('removeCategory', { category: item.name }))}"
        >${escapeHtml(t('removeShort'))}</button>
      </div>
      <label class="category-rule-keywords">
        <span>${escapeHtml(t('matchingKeywords'))}</span>
        <input
          class="category-keywords-input"
          type="text"
          autocomplete="off"
          data-category-index="${index}"
          value="${escapeHtml(item.keywords.join(', '))}"
          placeholder="${escapeHtml(t('keywordsPlaceholder'))}"
        >
      </label>
    </div>
  `).join('');
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
  categoryDraft.splice(index, 1);
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
elements.compactDarkMode.addEventListener('change', updateAppearancePreview);
elements.compactAiEnabled.addEventListener('change', () => updateCompactAIFields(false));
elements.compactProvider.addEventListener('change', () => updateCompactAIFields(true));
elements.compactPopupWidth.addEventListener('input', handlePopupSizeInput);
elements.compactPopupHeight.addEventListener('input', handlePopupSizeInput);
elements.compactBackgroundImage.addEventListener('change', handleBackgroundImageChange);
elements.clearBackgroundImageBtn.addEventListener('click', clearBackgroundImage);
elements.compactKeywordWeight.addEventListener('input', () => {
  elements.compactKeywordWeightValue.textContent = elements.compactKeywordWeight.value;
});
elements.compactBrowserBookmarksEnabled.addEventListener('change', handleBrowserBookmarkWriteChange);
elements.compactBookmarkOrganizeEnabled.addEventListener('change', handleBookmarkOrganizeChange);
elements.compactBookmarkAutoCapture.addEventListener('change', handleBookmarkAutoCaptureChange);
elements.compactBookmarkWriteMode.addEventListener('change', handleBookmarkWriteModeChange);
elements.compactAddCategoryBtn.addEventListener('click', addCategoryFolder);
elements.compactNewCategory.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  addCategoryFolder();
});
elements.categoryRulesList.addEventListener('input', (event) => {
  if (!event.target.classList.contains('category-keywords-input')) return;
  const index = Number(event.target.dataset.categoryIndex);
  if (!Number.isInteger(index) || !categoryDraft[index]) return;
  categoryDraft[index].keywords = splitKeywords(event.target.value);
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

elements.compactSaveBtn.addEventListener('click', async () => {
  const provider = SmartFavAI.getProvider(elements.compactProvider.value);
  if (elements.compactAiEnabled.checked && provider.requiresKey && !elements.compactApiKey.value.trim()) {
    showCompactSettingsStatus(t('apiKeyRequired'), 'error');
    return;
  }
  const wasOrganizeActive = currentSettings.bookmarkOrganizeEnabled;
  currentSettings = {
    ...currentSettings,
    themeStyle: normalizeThemeStyle(elements.compactThemeStyle.value),
    colorMode: elements.compactThemeStyle.value === 'black' || elements.compactDarkMode.checked
      ? 'dark'
      : 'light',
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
    apiKey: elements.compactApiKey.value.trim(),
    model: elements.compactModel.value.trim() || provider.model,
    browserBookmarksEnabled: elements.compactBrowserBookmarksEnabled.checked,
    bookmarkWriteMode: elements.compactBookmarkWriteMode.value === 'add' ? 'add' : 'overwrite',
    bookmarkOrganizeEnabled: elements.compactBookmarkOrganizeEnabled.checked,
    bookmarkAutoCaptureEnabled: elements.compactBookmarkAutoCapture.checked
  };
  await storageSet({ settings: currentSettings });
  applyAppearance();
  await renderFolders();
  if (currentTabInfo) {
    currentSuggestion = SmartFavClassifier.classify(currentTabInfo, currentSettings);
    showCategorySuggestion(currentSuggestion);
  }
  showCompactSettingsStatus(t('settingsSaved'), 'success');
  if (currentTabInfo && currentSettings.aiEnabled && currentSettings.aiAutoClassify) {
    await enhanceCurrentSuggestion({ automatic: true });
  }
  const organizeActive = currentSettings.bookmarkOrganizeEnabled;
  if (organizeActive && !wasOrganizeActive) {
    await runOrganizeBookmarks();
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

elements.compactTestBtn.addEventListener('click', async () => {
  const provider = SmartFavAI.getProvider(elements.compactProvider.value);
  if (provider.requiresKey && !elements.compactApiKey.value.trim()) {
    showCompactSettingsStatus(t('enterApiKeyFirst'), 'error');
    return;
  }
  elements.compactTestBtn.disabled = true;
  elements.compactTestBtn.textContent = t('testing');
  try {
    const response = await SmartFavAI.call(t('testPrompt'), {
      language: currentSettings.language,
      apiProvider: elements.compactProvider.value,
      apiKey: elements.compactApiKey.value.trim(),
      model: elements.compactModel.value.trim() || provider.model
    });
    if (!response) throw new Error(t('serviceNoContent'));
    showCompactSettingsStatus(t('connectionSuccess'), 'success');
  } catch (error) {
    showCompactSettingsStatus(error.message, 'error');
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
