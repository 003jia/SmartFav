const DEFAULT_SETTINGS = {
  aiEnabled: false,
  apiProvider: 'ollama',
  apiKey: '',
  model: 'qwen2.5:3b',
  categories: SmartFavClassifier.DEFAULT_CATEGORIES,
  keywordRules: SmartFavClassifier.DEFAULT_RULES
};

const isExtension = typeof chrome !== 'undefined' && Boolean(chrome.storage && chrome.tabs);
const previewState = {
  settings: DEFAULT_SETTINGS,
  favorites: [
    {
      title: 'GitHub · Build and ship software',
      url: 'https://github.com/',
      category: '编程',
      summary: '代码托管与协作平台',
      createdAt: Date.now() - 3600000
    },
    {
      title: 'MDN Web Docs',
      url: 'https://developer.mozilla.org/',
      category: '学习',
      summary: 'Web 开发文档',
      createdAt: Date.now() - 7200000
    }
  ]
};

const elements = {
  settingsBtn: document.getElementById('settingsBtn'),
  brandCaption: document.getElementById('brandCaption'),
  mainView: document.getElementById('mainView'),
  settingsView: document.getElementById('settingsView'),
  loadingStatus: document.getElementById('loadingStatus'),
  successStatus: document.getElementById('successStatus'),
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
  recentList: document.getElementById('recentList'),
  viewAllBtn: document.getElementById('viewAllBtn'),
  compactAiEnabled: document.getElementById('compactAiEnabled'),
  compactAiFields: document.getElementById('compactAiFields'),
  compactProvider: document.getElementById('compactProvider'),
  compactModel: document.getElementById('compactModel'),
  compactApiKey: document.getElementById('compactApiKey'),
  compactApiKeyField: document.getElementById('compactApiKeyField'),
  compactCategories: document.getElementById('compactCategories'),
  compactKeywordRules: document.getElementById('compactKeywordRules'),
  compactTestBtn: document.getElementById('compactTestBtn'),
  compactSettingsStatus: document.getElementById('compactSettingsStatus'),
  compactSaveBtn: document.getElementById('compactSaveBtn')
};

let currentTabInfo = null;
let currentSuggestion = null;
let currentSettings = DEFAULT_SETTINGS;

document.addEventListener('DOMContentLoaded', async () => {
  currentSettings = await loadSettings();
  await Promise.all([renderFolders(), renderRecentFavorites()]);
  await analyzeCurrentTab();
  if (new URLSearchParams(window.location.search).get('view') === 'settings') {
    toggleSettingsView(true);
  }
});

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

async function loadSettings() {
  const result = await storageGet(['settings']);
  const saved = result.settings || {};
  const settings = {
    ...DEFAULT_SETTINGS,
    ...saved,
    aiEnabled: typeof saved.aiEnabled === 'boolean' ? saved.aiEnabled : Boolean(saved.apiKey),
    categories: Array.isArray(saved.categories) && saved.categories.length
      ? saved.categories
      : DEFAULT_SETTINGS.categories,
    keywordRules: SmartFavClassifier.mergeRules(
      Array.isArray(saved.categories) && saved.categories.length ? saved.categories : DEFAULT_SETTINGS.categories,
      saved.keywordRules
    )
  };
  if (!result.settings) await storageSet({ settings });
  return settings;
}

async function analyzeCurrentTab() {
  try {
    if (isExtension) {
      const tabs = await new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
      const tab = tabs[0];
      if (!tab || !isSupportedUrl(tab.url)) {
        showError('这个浏览器页面暂时无法收藏');
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
    console.error('读取网页失败:', error);
    showError('读取当前网页失败，请稍后再试');
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
  elements.saveTitle.textContent = currentTabInfo.title || '未命名网页';
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
  elements.sourceBadge.textContent = suggestion.source === 'ai' ? 'AI 增强' : '本地规则';
  elements.sourceBadge.classList.toggle('ai', suggestion.source === 'ai');
  elements.enhanceBtn.classList.toggle('hidden', !currentSettings.aiEnabled);
  elements.privacyHint.textContent = suggestion.source === 'ai'
    ? '本次内容已发送给你配置的 AI 服务。'
    : '分类在浏览器本地完成，不会发送网页内容。';
  updateConfirmLabel();
}

function updateConfirmLabel() {
  const category = elements.categorySelect.value || '收藏夹';
  elements.confirmBtn.textContent = `收藏到“${category}”`;
}

elements.categorySelect.addEventListener('change', () => {
  if (currentSuggestion) currentSuggestion.category = elements.categorySelect.value;
  updateConfirmLabel();
});

elements.enhanceBtn.addEventListener('click', async () => {
  if (!currentTabInfo || !currentSettings.aiEnabled) return;
  elements.enhanceBtn.disabled = true;
  elements.enhanceBtn.textContent = '优化中';
  elements.aiMessage.classList.add('hidden');
  try {
    const response = await SmartFavAI.call(buildClassificationPrompt(currentTabInfo), currentSettings);
    const suggestion = parseAIResponse(response);
    currentSuggestion = suggestion;
    showCategorySuggestion(suggestion);
  } catch (error) {
    elements.aiMessage.textContent = `${error.message}，已保留本地分类结果。`;
    elements.aiMessage.classList.remove('hidden');
  } finally {
    elements.enhanceBtn.disabled = false;
    elements.enhanceBtn.textContent = 'AI 优化';
  }
});

function buildClassificationPrompt(tabInfo) {
  return `请将网页归入给定分类，并只返回 JSON。\n\n网页标题：${tabInfo.title}\n网页地址：${tabInfo.url}\n网页描述：${tabInfo.description}\n可选分类：${currentSettings.categories.join('、')}\n\nJSON 格式：{"category":"分类","tags":["关键词"],"summary":"简短理由"}`;
}

function parseAIResponse(response) {
  const match = String(response || '').match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI 返回内容无法识别');
  const parsed = JSON.parse(match[0]);
  const fallback = currentSettings.categories.includes('其他')
    ? '其他'
    : currentSettings.categories[currentSettings.categories.length - 1];
  return {
    category: currentSettings.categories.includes(parsed.category) ? parsed.category : fallback,
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 4).map(String) : [],
    summary: String(parsed.summary || 'AI 已完成分类优化'),
    source: 'ai'
  };
}

elements.confirmBtn.addEventListener('click', async () => {
  if (!currentSuggestion || !currentTabInfo) return;
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
  elements.categorySection.classList.add('hidden');
  elements.successStatus.classList.remove('hidden');
  await Promise.all([renderFolders(), renderRecentFavorites()]);
  if (isExtension) setTimeout(() => window.close(), 1100);
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
  elements.totalCount.textContent = `${favorites.length} 条`;
  elements.librarySummary.textContent = `${favorites.length} 条收藏 · ${categories.length} 个分类`;
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
  const recent = favorites.slice(0, 3);
  if (!recent.length) {
    elements.recentList.innerHTML = '<div class="empty-state">还没有收藏，先保存当前网页吧</div>';
    return;
  }
  elements.recentList.innerHTML = recent.map(renderFavoriteRow).join('');
  bindFavoriteLinks(elements.recentList);
}

async function showAllFavorites() {
  const result = await storageGet(['favorites']);
  const favorites = Array.isArray(result.favorites) ? result.favorites : [];
  renderFavoriteList('全部收藏', favorites);
}

function showFavoritesByCategory(category, favorites) {
  renderFavoriteList(category, favorites.filter((favorite) => favorite.category === category));
}

function renderFavoriteList(title, favorites) {
  elements.foldersList.classList.add('list-view');
  elements.foldersList.innerHTML = `
    <div class="category-header">
      <button class="back-button" id="backToFolders" type="button">返回</button>
      <span class="category-title">${escapeHtml(title)} · ${favorites.length}</span>
    </div>
    ${favorites.length ? favorites.map(renderFavoriteRow).join('') : '<div class="empty-state">这个分类还是空的</div>'}
  `;
  document.getElementById('backToFolders').addEventListener('click', renderFolders);
  bindFavoriteLinks(elements.foldersList);
}

function renderFavoriteRow(favorite) {
  const image = favorite.favicon
    ? `<img src="${escapeHtml(favorite.favicon)}" class="favicon" alt="">`
    : '';
  return `
    <button class="recent-item favorite-link" type="button" data-url="${escapeHtml(favorite.url)}">
      ${image}
      <span class="recent-info">
        <span class="recent-title">${escapeHtml(favorite.title || '未命名网页')}</span>
        <span class="recent-category">${escapeHtml(favorite.category || '其他')}</span>
      </span>
    </button>
  `;
}

function bindFavoriteLinks(container) {
  container.querySelectorAll('.favicon').forEach((image) => {
    image.addEventListener('error', () => image.remove(), { once: true });
  });
  container.querySelectorAll('.favorite-link').forEach((item) => {
    item.addEventListener('click', () => openUrl(item.dataset.url));
  });
}

function openUrl(url) {
  if (!url) return;
  if (isExtension) chrome.tabs.create({ url });
  else window.open(url, '_blank', 'noopener');
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
    return '当前网页';
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

elements.viewAllBtn.addEventListener('click', showAllFavorites);
elements.libraryToggleBtn.addEventListener('click', () => {
  const willExpand = elements.libraryPanel.classList.contains('hidden');
  elements.libraryPanel.classList.toggle('hidden', !willExpand);
  elements.libraryToggleBtn.textContent = willExpand ? '收起' : '展开';
  elements.libraryToggleBtn.setAttribute('aria-expanded', String(willExpand));
});
elements.settingsBtn.addEventListener('click', () => toggleSettingsView());

function toggleSettingsView(forceOpen) {
  const shouldOpen = typeof forceOpen === 'boolean'
    ? forceOpen
    : elements.settingsView.classList.contains('hidden');
  elements.mainView.classList.toggle('hidden', shouldOpen);
  elements.settingsView.classList.toggle('hidden', !shouldOpen);
  elements.settingsBtn.textContent = shouldOpen ? '返回' : '设置';
  elements.settingsBtn.setAttribute('aria-label', shouldOpen ? '返回收藏' : '打开设置');
  elements.brandCaption.textContent = shouldOpen ? '插件设置' : '收藏当前网页';
  if (shouldOpen) populateCompactSettings();
}

function populateCompactSettings() {
  elements.compactAiEnabled.checked = currentSettings.aiEnabled;
  elements.compactProvider.value = currentSettings.apiProvider || 'ollama';
  elements.compactModel.value = currentSettings.model || SmartFavAI.getProvider(elements.compactProvider.value).model;
  elements.compactApiKey.value = currentSettings.apiKey || '';
  elements.compactCategories.value = currentSettings.categories.join(', ');
  elements.compactKeywordRules.value = SmartFavClassifier.rulesToText(
    currentSettings.categories,
    currentSettings.keywordRules
  );
  elements.compactSettingsStatus.textContent = '';
  elements.compactSettingsStatus.className = 'compact-settings-status';
  updateCompactAIFields(false);
}

function updateCompactAIFields(resetModel) {
  const provider = SmartFavAI.getProvider(elements.compactProvider.value);
  elements.compactAiFields.classList.toggle('hidden', !elements.compactAiEnabled.checked);
  elements.compactApiKeyField.classList.toggle('hidden', !provider.requiresKey);
  if (resetModel || !elements.compactModel.value.trim()) elements.compactModel.value = provider.model;
}

function getCompactCategories() {
  return [...new Set(elements.compactCategories.value
    .split(/[,，]/)
    .map((category) => category.trim())
    .filter(Boolean))];
}

elements.compactAiEnabled.addEventListener('change', () => updateCompactAIFields(false));
elements.compactProvider.addEventListener('change', () => updateCompactAIFields(true));

elements.compactSaveBtn.addEventListener('click', async () => {
  const categories = getCompactCategories();
  const provider = SmartFavAI.getProvider(elements.compactProvider.value);
  if (!categories.length) {
    showCompactSettingsStatus('请至少保留一个收藏分类', 'error');
    return;
  }
  if (elements.compactAiEnabled.checked && provider.requiresKey && !elements.compactApiKey.value.trim()) {
    showCompactSettingsStatus('请填写所选服务的 API Key', 'error');
    return;
  }
  currentSettings = {
    aiEnabled: elements.compactAiEnabled.checked,
    apiProvider: elements.compactProvider.value,
    apiKey: elements.compactApiKey.value.trim(),
    model: elements.compactModel.value.trim() || provider.model,
    categories,
    keywordRules: SmartFavClassifier.textToRules(elements.compactKeywordRules.value, categories)
  };
  await storageSet({ settings: currentSettings });
  await renderFolders();
  if (currentTabInfo) {
    currentSuggestion = SmartFavClassifier.classify(currentTabInfo, currentSettings);
    showCategorySuggestion(currentSuggestion);
  }
  showCompactSettingsStatus('设置已保存', 'success');
});

elements.compactTestBtn.addEventListener('click', async () => {
  const provider = SmartFavAI.getProvider(elements.compactProvider.value);
  if (provider.requiresKey && !elements.compactApiKey.value.trim()) {
    showCompactSettingsStatus('请先填写 API Key', 'error');
    return;
  }
  elements.compactTestBtn.disabled = true;
  elements.compactTestBtn.textContent = '测试中';
  try {
    const response = await SmartFavAI.call('只返回 JSON：{"status":"ok"}', {
      apiProvider: elements.compactProvider.value,
      apiKey: elements.compactApiKey.value.trim(),
      model: elements.compactModel.value.trim() || provider.model
    });
    if (!response) throw new Error('服务没有返回内容');
    showCompactSettingsStatus('连接成功', 'success');
  } catch (error) {
    showCompactSettingsStatus(error.message, 'error');
  } finally {
    elements.compactTestBtn.disabled = false;
    elements.compactTestBtn.textContent = '测试连接';
  }
});

function showCompactSettingsStatus(message, type) {
  elements.compactSettingsStatus.textContent = message;
  elements.compactSettingsStatus.className = `compact-settings-status ${type}`;
}
