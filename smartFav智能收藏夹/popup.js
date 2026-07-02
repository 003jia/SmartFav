// SmartFav Popup - 弹出窗口逻辑

// DOM 元素
const elements = {
  settingsBtn: document.getElementById('settingsBtn'),
  loadingStatus: document.getElementById('loadingStatus'),
  successStatus: document.getElementById('successStatus'),
  errorStatus: document.getElementById('errorStatus'),
  errorMsg: document.getElementById('errorMsg'),
  categorySection: document.getElementById('categorySection'),
  suggestedCategory: document.getElementById('suggestedCategory'),
  categorySummary: document.getElementById('categorySummary'),
  tagsContainer: document.getElementById('tagsContainer'),
  confirmBtn: document.getElementById('confirmBtn'),
  foldersList: document.getElementById('foldersList'),
  recentSection: document.getElementById('recentSection'),
  recentList: document.getElementById('recentList'),
  viewAllBtn: document.getElementById('viewAllBtn')
};

// 状态
let currentTabInfo = null;
let aiSuggestion = null;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await analyzeCurrentTab();
  await renderFolders();
  await renderRecentFavorites();
});

// 加载设置
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['settings'], (result) => {
      if (!result.settings) {
        // 默认设置
        const defaultSettings = {
          apiProvider: 'minimax',
          apiKey: '',
          model: 'MiniMax-M2.5',
          categories: ['视频', '编程', '工具', '学习', '资讯', '其他']
        };
        chrome.storage.local.set({ settings: defaultSettings });
      }
      resolve(result.settings);
    });
  });
}

// 分析当前标签页
async function analyzeCurrentTab() {
  try {
    // 获取当前标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) {
      showError('无法分析此页面');
      return;
    }

    // 获取页面信息
    currentTabInfo = {
      url: tab.url,
      title: tab.title,
      favicon: tab.favIconUrl
    };

    // 获取页面内容摘要
    const pageContent = await getPageContent(tab.id);
    currentTabInfo.description = pageContent.description;

    // 调用 AI 分析
    await analyzeWithAI(currentTabInfo);

  } catch (error) {
    console.error('分析失败:', error);
    showError('分析失败: ' + error.message);
  }
}

// 获取页面内容
async function getPageContent(tabId) {
  try {
    // 注入脚本获取页面内容
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
        const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
        const bodyText = document.body?.innerText?.substring(0, 1000) || '';
        
        return {
          description: metaDescription || ogTitle || bodyText.substring(0, 200)
        };
      }
    });
    
    return results[0]?.result || { description: '' };
  } catch (error) {
    return { description: '' };
  }
}

// AI 分析
async function analyzeWithAI(tabInfo) {
  const settings = await loadSettings();
  
  if (!settings.apiKey) {
    showError('请先在设置中配置 API Key');
    return;
  }

  try {
    const prompt = buildClassificationPrompt(tabInfo);
    const response = await callAIApi(prompt, settings);
    
    // 解析 AI 响应
    aiSuggestion = parseAIResponse(response);
    
    // 显示分类建议
    showCategorySuggestion(aiSuggestion);
    
  } catch (error) {
    console.error('AI 分析失败:', error);
    showError('AI 分析失败');
  }
}

// 构建分类提示词
function buildClassificationPrompt(tabInfo) {
  return `你是一个网页分类助手。用户收藏了一个网页，请根据内容分类。

网页信息：
- 标题: ${tabInfo.title}
- 描述: ${tabInfo.description}
- URL: ${tabInfo.url}

请返回以下格式的JSON（直接返回JSON，不要其他内容）：
{
  "category": "分类名称",
  "tags": ["标签1", "标签2"],
  "summary": "一句话描述"
}

分类选项：视频, 编程, 工具, 学习, 资讯, 文档, 娱乐, 购物, 社交, 其他`;
}

// 调用 AI API
async function callAIApi(prompt, settings) {
  const apiConfigs = {
    minimax: {
      url: 'https://api.minimaxi.com/v1/text/chatcompletion_v2',
      body: {
        model: settings.model || 'MiniMax-M2.5',
        messages: [{ role: 'user', content: prompt }]
      }
    },
    openai: {
      url: 'https://api.openai.com/v1/chat/completions',
      body: {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }]
      }
    },
    deepseek: {
      url: 'https://api.deepseek.com/v1/chat/completions',
      body: {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }]
      }
    }
  };

  const config = apiConfigs[settings.apiProvider];
  
  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify(config.body)
  });

  if (!response.ok) {
    throw new Error(`API 请求失败: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// 解析 AI 响应
function parseAIResponse(response) {
  try {
    // 尝试提取 JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('无法解析响应');
  } catch (error) {
    // 默认值
    return {
      category: '其他',
      tags: [],
      summary: '未能分析内容'
    };
  }
}

// 显示分类建议
function showCategorySuggestion(suggestion) {
  elements.loadingStatus.classList.add('hidden');
  elements.categorySection.classList.remove('hidden');
  
  elements.suggestedCategory.textContent = suggestion.category;
  elements.categorySummary.textContent = suggestion.summary;
  
  // 渲染标签
  elements.tagsContainer.innerHTML = suggestion.tags
    .map(tag => `<span class="tag">${tag}</span>`)
    .join('');
}

// 确认收藏
elements.confirmBtn?.addEventListener('click', async () => {
  if (!aiSuggestion || !currentTabInfo) return;
  
  const favorite = {
    ...currentTabInfo,
    category: aiSuggestion.category,
    tags: aiSuggestion.tags,
    summary: aiSuggestion.summary,
    createdAt: Date.now()
  };
  
  // 保存收藏
  const { favorites = [] } = await chrome.storage.local.get(['favorites']);
  favorites.unshift(favorite);
  await chrome.storage.local.set({ favorites });
  
  // 显示成功
  elements.categorySection.classList.add('hidden');
  elements.successStatus.classList.remove('hidden');
  
  // 刷新列表
  await renderFolders();
  
  // 2秒后关闭
  setTimeout(() => {
    window.close();
  }, 1500);
});

// 渲染收藏夹列表
async function renderFolders() {
  const { favorites = [], settings } = await chrome.storage.local.get(['favorites', 'settings']);
  const categories = settings?.categories || ['视频', '编程', '工具', '学习', '资讯', '其他'];
  
  // 统计每个分类的数量
  const counts = {};
  categories.forEach(cat => counts[cat] = 0);
  favorites.forEach(fav => {
    if (counts[fav.category] !== undefined) {
      counts[fav.category]++;
    }
  });
  
  // 更新显示
  elements.foldersList.innerHTML = categories.map(cat => `
    <div class="folder-item" data-category="${cat}">
      <span class="folder-icon">📁</span>
      <span class="folder-name">${cat}</span>
      <span class="folder-count">(${counts[cat] || 0})</span>
    </div>
  `).join('');
  
  // 添加点击事件 - 显示该分类的收藏内容
  document.querySelectorAll('.folder-item').forEach(item => {
    item.addEventListener('click', () => {
      const category = item.dataset.category;
      showFavoritesByCategory(category, favorites);
    });
  });
}

// 渲染最近收藏
async function renderRecentFavorites() {
  const { favorites = [] } = await chrome.storage.local.get(['favorites']);
  
  // 只显示最近5条
  const recent = favorites.slice(0, 5);
  
  if (recent.length === 0) {
    elements.recentList.innerHTML = '<div class="empty-recent">暂无收藏</div>';
    return;
  }
  
  elements.recentList.innerHTML = recent.map(fav => `
    <div class="recent-item" data-url="${fav.url}">
      <img src="${fav.favicon || ''}" class="favicon" onerror="this.style.display='none'">
      <div class="recent-info">
        <div class="recent-title">${fav.title}</div>
        <div class="recent-category">${fav.category}</div>
      </div>
    </div>
  `).join('');
  
  // 点击收藏项打开链接
  document.querySelectorAll('.recent-item').forEach(item => {
    item.addEventListener('click', () => {
      const url = item.dataset.url;
      if (url) chrome.tabs.create({ url });
    });
  });
}

// 显示全部收藏
async function showAllFavorites() {
  const { favorites = [] } = await chrome.storage.local.get(['favorites']);
  
  if (favorites.length === 0) {
    elements.foldersList.innerHTML = `
      <div class="empty-message">
        <p>暂无收藏</p>
        <button class="back-btn" id="backToFolders">返回</button>
      </div>
    `;
  } else {
    elements.foldersList.innerHTML = `
      <div class="category-header">
        <button class="back-btn" id="backToFolders">← 返回</button>
        <span class="category-title">全部收藏 (${favorites.length})</span>
      </div>
      ${favorites.map(fav => `
        <div class="favorite-item" data-url="${fav.url}">
          <img src="${fav.favicon || ''}" class="favicon" onerror="this.style.display='none'">
          <div class="favorite-info">
            <div class="favorite-title">${fav.title}</div>
            <div class="favorite-meta">
              <span class="favorite-category-tag">${fav.category}</span>
              <span class="favorite-summary">${fav.summary || ''}</span>
            </div>
          </div>
        </div>
      `).join('')}
    `;
  }
  
  // 返回按钮事件
  document.getElementById('backToFolders')?.addEventListener('click', () => {
    renderFolders();
  });
  
  // 点击收藏项打开链接
  document.querySelectorAll('.favorite-item').forEach(item => {
    item.addEventListener('click', () => {
      const url = item.dataset.url;
      if (url) chrome.tabs.create({ url });
    });
  });
}

// 查看全部按钮事件
elements.viewAllBtn?.addEventListener('click', () => {
  showAllFavorites();
});

// 显示指定分类的收藏内容
function showFavoritesByCategory(category, favorites) {
  const filtered = favorites.filter(fav => fav.category === category);
  
  if (filtered.length === 0) {
    elements.foldersList.innerHTML = `
      <div class="empty-message">
        <p>暂无收藏</p>
        <button class="back-btn" id="backToFolders">返回</button>
      </div>
    `;
  } else {
    elements.foldersList.innerHTML = `
      <div class="category-header">
        <button class="back-btn" id="backToFolders">← 返回</button>
        <span class="category-title">${category}</span>
      </div>
      ${filtered.map(fav => `
        <div class="favorite-item" data-url="${fav.url}">
          <img src="${fav.favicon || ''}" class="favicon" onerror="this.style.display='none'">
          <div class="favorite-info">
            <div class="favorite-title">${fav.title}</div>
            <div class="favorite-summary">${fav.summary || ''}</div>
          </div>
        </div>
      `).join('')}
    `;
  }
  
  // 返回按钮事件
  document.getElementById('backToFolders')?.addEventListener('click', () => {
    renderFolders();
  });
  
  // 点击收藏项打开链接
  document.querySelectorAll('.favorite-item').forEach(item => {
    item.addEventListener('click', () => {
      const url = item.dataset.url;
      if (url) chrome.tabs.create({ url });
    });
  });
}

// 显示错误
function showError(message) {
  elements.loadingStatus.classList.add('hidden');
  elements.errorStatus.classList.remove('hidden');
  elements.errorMsg.textContent = message;
}

// 打开设置
elements.settingsBtn?.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
