(function attachAIClient(globalScope) {
  const PROVIDERS = {
    ollama: {
      name: 'Ollama（本机免费）',
      model: 'qwen2.5:3b',
      requiresKey: false,
      endpoint: 'http://localhost:11434/api/chat'
    },
    openrouter: {
      name: 'OpenRouter 免费路由',
      model: 'openrouter/free',
      requiresKey: true,
      endpoint: 'https://openrouter.ai/api/v1/chat/completions'
    },
    minimax: {
      name: 'MiniMax',
      model: 'MiniMax-M2.5',
      requiresKey: true,
      endpoint: 'https://api.minimaxi.com/v1/text/chatcompletion_v2'
    },
    deepseek: {
      name: 'DeepSeek',
      model: 'deepseek-chat',
      requiresKey: true,
      endpoint: 'https://api.deepseek.com/v1/chat/completions'
    },
    openai: {
      name: 'OpenAI',
      model: 'gpt-4o-mini',
      requiresKey: true,
      endpoint: 'https://api.openai.com/v1/chat/completions'
    }
  };

  function getProvider(providerId) {
    return PROVIDERS[providerId] || PROVIDERS.ollama;
  }

  async function call(prompt, settings) {
    const providerId = settings.apiProvider || 'ollama';
    const provider = getProvider(providerId);
    const apiKey = String(settings.apiKey || '').trim();
    const model = String(settings.model || provider.model).trim();

    if (provider.requiresKey && !apiKey) {
      throw new Error('请先在设置中填写 API Key');
    }

    if (providerId === 'ollama') {
      const response = await fetch(provider.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          format: 'json'
        })
      });
      if (!response.ok) throw new Error(`Ollama 连接失败（${response.status}）`);
      const data = await response.json();
      return data.message && data.message.content ? data.message.content : '';
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    };
    if (providerId === 'openrouter') headers['X-Title'] = 'SmartFav';

    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) throw new Error(`API 请求失败（${response.status}）`);
    const data = await response.json();
    return data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content || ''
      : '';
  }

  const api = { PROVIDERS, getProvider, call };
  globalScope.SmartFavAI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
