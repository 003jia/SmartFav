const detectedLanguage = SmartFavI18n.detectLanguage();
const detectedDefaults = SmartFavClassifier.getDefaults(detectedLanguage);

const DEFAULT_SETTINGS = {
  language: detectedLanguage,
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
  categories: detectedDefaults.categories,
  keywordRules: detectedDefaults.keywordRules
};

const THEME_STYLES = ['glass', 'white', 'gray', 'black', 'parchment'];
const isExtension = typeof chrome !== 'undefined' && Boolean(chrome.storage && chrome.tabs);
const previewState = {
  settings: DEFAULT_SETTINGS,
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
  settingsView: document.getElementById('settingsView'),
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
  totalCount: document.getElementById('totalCount'),
  librarySummary: document.getElementById('librarySummary'),
  libraryPanel: document.getElementById('libraryPanel'),
  libraryToggleBtn: document.getElementById('libraryToggleBtn'),
  compactThemeStyle: document.getElementById('compactThemeStyle'),
  compactDarkMode: document.getElementById('compactDarkMode'),
  recentList: document.getElementById('recentList'),
  viewAllBtn: document.getElementById('viewAllBtn'),
  compactAiEnabled: document.getElementById('compactAiEnabled'),
  compactAiFields: document.getElementById('compactAiFields'),
  compactProvider: document.getElementById('compactProvider'),
  compactModel: document.getElementById('compactModel'),
  compactApiKey: document.getElementById('compactApiKey'),
  compactApiKeyField: document.getElementById('compactApiKeyField'),
  compactBrowserBookmarksEnabled: document.getElementById('compactBrowserBookmarksEnabled'),
  compactBookmarkFields: document.getElementById('compactBookmarkFields'),
  compactBookmarkWriteMode: document.getElementById('compactBookmarkWriteMode'),
  compactBookmarkOrganizeEnabled: document.getElementById('compactBookmarkOrganizeEnabled'),
  compactBookmarkAutoCapture: document.getElementById('compactBookmarkAutoCapture'),
  compactOrganizeBtn: document.getElementById('compactOrganizeBtn'),
  compactNewCategory: document.getElementById('compactNewCategory'),
  compactAddCategoryBtn: document.getElementById('compactAddCategoryBtn'),
  categoryRulesList: document.getElementById('categoryRulesList'),
  compactTestBtn: document.getElementById('compactTestBtn'),
  compactSettingsStatus: document.getElementById('compactSettingsStatus'),
  compactSaveBtn: document.getElementById('compactSaveBtn')
};

let currentTabInfo = null;
let currentSuggestion = null;
let currentSettings = DEFAULT_SETTINGS;
let categoryDraft = [];
let previewThemeStyle = DEFAULT_SETTINGS.themeStyle;
let showingAllFavorites = false;

document.addEventListener('DOMContentLoaded', async () => {
  await recoverManagedBrowserFavorites();
  currentSettings = await loadSettings();
  applyLanguage();
  await Promise.all([renderFolders(), renderRecentFavorites()]);
  await analyzeCurrentTab();
  if (new URLSearchParams(window.location.search).get('view') === 'settings') {
    toggleSettingsView(true);
  }
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
    aiEnabled: typeof saved.aiEnabled === 'boolean' ? saved.aiEnabled : Boolean(saved.apiKey),
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

function applyAppearance(settings = currentSettings) {
  const themeStyle = normalizeThemeStyle(settings.themeStyle);
  const colorMode = themeStyle === 'black' || settings.colorMode === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = themeStyle;
  document.documentElement.dataset.mode = colorMode;
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
  const settingsOpen = !elements.settingsView.classList.contains('hidden');
  elements.languageBtn.textContent = currentSettings.language === 'zh_CN' ? 'EN' : '中';
  elements.languageBtn.setAttribute('aria-label', t('switchToEnglish'));
  elements.settingsBtn.textContent = t(settingsOpen ? 'back' : 'settings');
  elements.settingsBtn.setAttribute('aria-label', t(settingsOpen ? 'backToSave' : 'openSettings'));
  elements.brandCaption.textContent = t(settingsOpen ? 'extensionSettings' : 'saveCurrentPage');
  const expanded = elements.libraryToggleBtn.getAttribute('aria-expanded') === 'true';
  elements.libraryToggleBtn.textContent = t(expanded ? 'collapse' : 'expand');
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
  if (!elements.settingsView.classList.contains('hidden')) {
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
  applyLanguage();
  await Promise.all([renderFolders(), renderRecentFavorites()]);
  if (currentTabInfo) {
    currentSuggestion = SmartFavClassifier.classify(currentTabInfo, currentSettings);
    showCategorySuggestion(currentSuggestion);
  }
  if (!elements.settingsView.classList.contains('hidden')) populateCompactSettings();
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
        description: pageContent.description || ''
      };
    } else {
      currentTabInfo = {
        url: 'https://github.com/openai/codex',
        title: 'openai/codex · GitHub',
        favicon: '',
        description: 'An open-source coding agent for software development.'
      };
    }

    currentSuggestion = SmartFavClassifier.classify(currentTabInfo, currentSettings);
    showCategorySuggestion(currentSuggestion);
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
        const bodyText = document.body?.innerText?.slice(0, 1200) || '';
        return { description: metaDescription || ogDescription || bodyText.slice(0, 320) };
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

elements.enhanceBtn.addEventListener('click', async () => {
  if (!currentTabInfo || !currentSettings.aiEnabled) return;
  elements.enhanceBtn.disabled = true;
  elements.enhanceBtn.textContent = t('optimizing');
  elements.aiMessage.classList.add('hidden');
  try {
    const response = await SmartFavAI.call(buildClassificationPrompt(currentTabInfo), currentSettings);
    const suggestion = parseAIResponse(response);
    currentSuggestion = suggestion;
    showCategorySuggestion(suggestion);
  } catch (error) {
    elements.aiMessage.textContent = t('aiFallbackKept', { message: error.message });
    elements.aiMessage.classList.remove('hidden');
  } finally {
    elements.enhanceBtn.disabled = false;
    elements.enhanceBtn.textContent = t('aiOptimize');
  }
});

function buildClassificationPrompt(tabInfo) {
  return t('classifyPrompt', {
    title: tabInfo.title,
    url: tabInfo.url,
    description: tabInfo.description,
    categories: currentSettings.categories.join(currentSettings.language === 'zh_CN' ? '、' : ', ')
  });
}

function parseAIResponse(response) {
  const match = String(response || '').match(/\{[\s\S]*\}/);
  if (!match) throw new Error(t('aiResponseInvalid'));
  const parsed = JSON.parse(match[0]);
  const preferredFallback = currentSettings.language === 'zh_CN' ? '其他' : 'Other';
  const fallback = currentSettings.categories.includes(preferredFallback)
    ? preferredFallback
    : currentSettings.categories[currentSettings.categories.length - 1];
  return {
    category: currentSettings.categories.includes(parsed.category) ? parsed.category : fallback,
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 4).map(String) : [],
    summary: String(parsed.summary || t('aiSummaryFallback')),
    source: 'ai'
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
  elements.librarySummary.textContent = t('librarySummary', {
    favorites: favorites.length,
    categories: categories.length
  });
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

function showFavoritesByCategory(category, favorites) {
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
      const result = await storageGet(['favorites']);
      const favorites = Array.isArray(result.favorites) ? result.favorites : [];
      await storageSet({
        favorites: favorites.filter((favorite) => favorite.url !== url)
      });
    }
    elements.errorStatus.classList.add('hidden');
    await Promise.all([renderFolders(), renderRecentFavorites()]);
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
elements.libraryToggleBtn.addEventListener('click', () => {
  const willExpand = elements.libraryPanel.classList.contains('hidden');
  elements.libraryPanel.classList.toggle('hidden', !willExpand);
  elements.libraryToggleBtn.textContent = t(willExpand ? 'collapse' : 'expand');
  elements.libraryToggleBtn.setAttribute('aria-expanded', String(willExpand));
});
elements.settingsBtn.addEventListener('click', () => toggleSettingsView());

function toggleSettingsView(forceOpen) {
  const shouldOpen = typeof forceOpen === 'boolean'
    ? forceOpen
    : elements.settingsView.classList.contains('hidden');
  elements.mainView.classList.toggle('hidden', shouldOpen);
  elements.settingsView.classList.toggle('hidden', !shouldOpen);
  elements.settingsBtn.textContent = t(shouldOpen ? 'back' : 'settings');
  elements.settingsBtn.setAttribute('aria-label', t(shouldOpen ? 'backToSave' : 'openSettings'));
  elements.brandCaption.textContent = t(shouldOpen ? 'extensionSettings' : 'saveCurrentPage');
  if (shouldOpen) populateCompactSettings();
  else applyAppearance();
}

function populateCompactSettings() {
  elements.compactThemeStyle.value = normalizeThemeStyle(currentSettings.themeStyle);
  previewThemeStyle = elements.compactThemeStyle.value;
  elements.compactDarkMode.checked = currentSettings.colorMode === 'dark'
    || currentSettings.themeStyle === 'black';
  elements.compactAiEnabled.checked = currentSettings.aiEnabled;
  elements.compactProvider.value = currentSettings.apiProvider || 'ollama';
  elements.compactModel.value = currentSettings.model || SmartFavAI.getProvider(elements.compactProvider.value).model;
  elements.compactApiKey.value = currentSettings.apiKey || '';
  elements.compactBrowserBookmarksEnabled.checked = currentSettings.browserBookmarksEnabled;
  elements.compactBookmarkWriteMode.value = currentSettings.bookmarkWriteMode || 'overwrite';
  elements.compactBookmarkOrganizeEnabled.checked = Boolean(currentSettings.bookmarkOrganizeEnabled);
  elements.compactBookmarkAutoCapture.checked = Boolean(currentSettings.bookmarkAutoCaptureEnabled);
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
  elements.compactSettingsStatus.textContent = '';
  elements.compactSettingsStatus.className = 'compact-settings-status';
  updateCompactAIFields(false);
  updateCompactBookmarkFields();
  updateAppearancePreview();
}

function updateAppearancePreview() {
  const themeStyle = normalizeThemeStyle(elements.compactThemeStyle.value);
  const colorMode = themeStyle === 'black' || elements.compactDarkMode.checked ? 'dark' : 'light';
  elements.compactDarkMode.checked = colorMode === 'dark';
  elements.compactDarkMode.disabled = themeStyle === 'black';
  elements.compactDarkMode.title = themeStyle === 'black' ? t('blackThemeDarkOnly') : '';
  applyAppearance({ ...currentSettings, themeStyle, colorMode });
  previewThemeStyle = themeStyle;
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
    ...getClassificationDraftSettings(),
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
    showCompactSettingsStatus(t('duplicateCategory'), 'error');
    return;
  }
  categoryDraft.push({ name, keywords: [] });
  elements.compactNewCategory.value = '';
  renderCategoryRules();
  showCompactSettingsStatus(t('categoryAdded'), 'success');
  const newRuleInput = elements.categoryRulesList.querySelector(
    `.category-keywords-input[data-category-index="${categoryDraft.length - 1}"]`
  );
  if (newRuleInput) newRuleInput.focus();
}

function removeCategoryFolder(index) {
  if (categoryDraft.length <= 1) {
    showCompactSettingsStatus(t('cannotRemoveLastCategory'), 'error');
    return;
  }
  categoryDraft.splice(index, 1);
  renderCategoryRules();
  showCompactSettingsStatus(t('categoryRemoved'), 'success');
}

elements.compactThemeStyle.addEventListener('change', handleThemeStyleChange);
elements.compactDarkMode.addEventListener('change', updateAppearancePreview);
elements.compactAiEnabled.addEventListener('change', () => updateCompactAIFields(false));
elements.compactProvider.addEventListener('change', () => updateCompactAIFields(true));
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

elements.compactSaveBtn.addEventListener('click', async () => {
  const categories = categoryDraft.map((item) => item.name);
  const provider = SmartFavAI.getProvider(elements.compactProvider.value);
  if (!categories.length) {
    showCompactSettingsStatus(t('keepOneCategory'), 'error');
    return;
  }
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
    aiEnabled: elements.compactAiEnabled.checked,
    apiProvider: elements.compactProvider.value,
    apiKey: elements.compactApiKey.value.trim(),
    model: elements.compactModel.value.trim() || provider.model,
    browserBookmarksEnabled: elements.compactBrowserBookmarksEnabled.checked,
    bookmarkWriteMode: elements.compactBookmarkWriteMode.value === 'add' ? 'add' : 'overwrite',
    bookmarkOrganizeEnabled: elements.compactBookmarkOrganizeEnabled.checked,
    bookmarkAutoCaptureEnabled: elements.compactBookmarkAutoCapture.checked,
    categories,
    keywordRules: Object.fromEntries(
      categoryDraft.map((item) => [item.name, [...item.keywords]])
    )
  };
  await storageSet({ settings: currentSettings });
  applyAppearance();
  await renderFolders();
  if (currentTabInfo) {
    currentSuggestion = SmartFavClassifier.classify(currentTabInfo, currentSettings);
    showCategorySuggestion(currentSuggestion);
  }
  showCompactSettingsStatus(t('settingsSaved'), 'success');
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
  await persistBookmarkSettings(getClassificationDraftSettings());
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
