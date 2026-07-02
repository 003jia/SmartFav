// SmartFav Options - 设置页面逻辑

// 加载设置
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupEventListeners();
});

// 加载设置
function loadSettings() {
  chrome.storage.local.get(['settings'], (result) => {
    const settings = result.settings || {};
    
    document.getElementById('apiProvider').value = settings.apiProvider || 'minimax';
    document.getElementById('apiKey').value = settings.apiKey || '';
    document.getElementById('model').value = settings.model || 'MiniMax-M2.5';
    document.getElementById('categories').value = (settings.categories || []).join(', ');
  });
}

// 设置事件监听
function setupEventListeners() {
  // 保存按钮
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  
  // 测试连接按钮
  document.getElementById('testBtn').addEventListener('click', testConnection);
  
  // 显示/隐藏 API Key
  document.getElementById('toggleVisibility').addEventListener('click', () => {
    const input = document.getElementById('apiKey');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
}

// 保存设置
function saveSettings() {
  const settings = {
    apiProvider: document.getElementById('apiProvider').value,
    apiKey: document.getElementById('apiKey').value,
    model: document.getElementById('model').value,
    categories: document.getElementById('categories').value
      .split(',')
      .map(c => c.trim())
      .filter(c => c)
  };
  
  chrome.storage.local.set({ settings }, () => {
    showTestResult('设置已保存！', 'success');
  });
}

// 测试连接
async function testConnection() {
  const settings = {
    apiProvider: document.getElementById('apiProvider').value,
    apiKey: document.getElementById('apiKey').value,
    model: document.getElementById('model').value
  };
  
  if (!settings.apiKey) {
    showTestResult('请先输入 API Key', 'error');
    return;
  }
  
  showTestResult('测试中...', 'success');
  
  const prompt = '你好，请回复"连接成功"';
  
  try {
    const response = await callAIApi(prompt, settings);
    showTestResult('✓ 连接成功！AI 响应: ' + response.substring(0, 50), 'success');
  } catch (error) {
    showTestResult('✗ 连接失败: ' + error.message, 'error');
  }
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

// 显示测试结果
function showTestResult(message, type) {
  const resultEl = document.getElementById('testResult');
  resultEl.textContent = message;
  resultEl.className = 'test-result ' + type;
}
