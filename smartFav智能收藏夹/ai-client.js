(function attachAIClient(globalScope) {
  // AI 请求超时：无超时的 fetch 在服务无响应时会让界面永久停在进行中状态。
  const REQUEST_TIMEOUT_MS = 30000;

  const PROVIDERS = {
    ollama: {
      name: 'Ollama（本机免费）',
      model: 'qwen2.5:3b',
      requiresKey: false,
      protocol: 'ollama',
      endpoint: 'http://localhost:11434/api/chat'
    },
    openrouter: {
      name: 'OpenRouter 免费路由',
      model: 'openrouter/free',
      requiresKey: true,
      protocol: 'openai',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions'
    },
    minimax: {
      name: 'MiniMax',
      model: 'MiniMax-M2.5',
      requiresKey: true,
      protocol: 'openai',
      endpoint: 'https://api.minimaxi.com/v1/text/chatcompletion_v2'
    },
    deepseek: {
      name: 'DeepSeek',
      model: 'deepseek-chat',
      requiresKey: true,
      protocol: 'openai',
      endpoint: 'https://api.deepseek.com/v1/chat/completions'
    },
    openai: {
      name: 'OpenAI',
      model: 'gpt-4o-mini',
      requiresKey: true,
      protocol: 'openai',
      endpoint: 'https://api.openai.com/v1/chat/completions'
    },
    openai_compatible: {
      name: 'OpenAI 兼容 API',
      model: 'gpt-4o-mini',
      requiresKey: true,
      protocol: 'openai',
      customEndpoint: true,
      endpoint: 'https://api.openai.com/v1/chat/completions'
    },
    anthropic_compatible: {
      name: 'Anthropic 兼容 API',
      model: 'claude-sonnet-5',
      requiresKey: true,
      protocol: 'anthropic',
      customEndpoint: true,
      endpoint: 'https://api.anthropic.com/v1/messages'
    }
  };

  function getProvider(providerId) {
    return PROVIDERS[providerId] || PROVIDERS.ollama;
  }

  function validateEndpoint(value) {
    const rawValue = String(value || '').trim();
    if (!rawValue) return { valid: false, code: 'required' };

    let url;
    try {
      url = new URL(rawValue);
    } catch (_error) {
      return { valid: false, code: 'invalid' };
    }

    if (url.username || url.password || !['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, code: 'invalid' };
    }

    const localHosts = new Set(['localhost', '127.0.0.1']);
    if (url.protocol === 'http:' && !localHosts.has(url.hostname.toLowerCase())) {
      return { valid: false, code: 'insecure' };
    }

    url.hash = '';
    return {
      valid: true,
      endpoint: url.toString(),
      originPattern: `${url.protocol}//${url.hostname}/*`
    };
  }

  function endpointErrorMessage(code, isChinese) {
    const messages = {
      required: {
        zh: '请填写完整的 API 地址',
        en: 'Enter the full API endpoint'
      },
      invalid: {
        zh: 'API 地址格式无效',
        en: 'The API endpoint is invalid'
      },
      insecure: {
        zh: '远程 API 地址必须使用 HTTPS；HTTP 仅支持 localhost 或 127.0.0.1',
        en: 'Remote API endpoints must use HTTPS; HTTP is limited to localhost or 127.0.0.1'
      }
    };
    const message = messages[code] || messages.invalid;
    return isChinese ? message.zh : message.en;
  }

  function resolveEndpoint(providerId, settings, isChinese) {
    const provider = getProvider(providerId);
    if (!provider.customEndpoint) return provider.endpoint;
    const validation = validateEndpoint(settings.apiEndpoint || provider.endpoint);
    if (!validation.valid) {
      throw new Error(endpointErrorMessage(validation.code, isChinese));
    }
    return validation.endpoint;
  }

  function extractTextContent(content) {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (!part || typeof part !== 'object') return '';
        if (typeof part.text === 'string') return part.text;
        if (part.text && typeof part.text.value === 'string') return part.text.value;
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  function extractResponseText(protocol, data) {
    if (protocol === 'ollama') {
      return data && data.message ? extractTextContent(data.message.content) : '';
    }
    if (protocol === 'anthropic') {
      return data ? extractTextContent(data.content) : '';
    }
    const message = data && data.choices && data.choices[0]
      ? data.choices[0].message
      : null;
    return message ? extractTextContent(message.content) : '';
  }

  function buildRequest(providerId, prompt, settings) {
    const provider = getProvider(providerId);
    const apiKey = String(settings.apiKey || '').trim();
    const model = String(settings.model || provider.model).trim();
    const endpoint = resolveEndpoint(providerId, settings, false);

    if (provider.protocol === 'ollama') {
      return {
        endpoint,
        options: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            stream: false,
            format: 'json'
          })
        }
      };
    }

    if (provider.protocol === 'anthropic') {
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      };
      const endpointUrl = new URL(endpoint);
      if (endpointUrl.hostname === 'api.anthropic.com') {
        headers['anthropic-dangerous-direct-browser-access'] = 'true';
      }
      return {
        endpoint,
        options: {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }]
          })
        }
      };
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    };
    if (providerId === 'openrouter') headers['X-Title'] = 'SmartFav';
    const body = {
      model,
      messages: [{ role: 'user', content: prompt }]
    };
    if (!provider.customEndpoint) body.response_format = { type: 'json_object' };
    return {
      endpoint,
      options: {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      }
    };
  }

  // 用 AbortController 给请求加超时上限。不做自动重试：
  // 交互本身已经偏慢，重试只会让用户等更久，失败后调用方会回退到本地分类。
  async function fetchWithTimeout(endpoint, options, isChinese) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      : null;
    try {
      return await fetch(
        endpoint,
        controller ? { ...options, signal: controller.signal } : options
      );
    } catch (error) {
      if (error && error.name === 'AbortError') {
        throw new Error(isChinese
          ? `AI 请求超时（${Math.round(REQUEST_TIMEOUT_MS / 1000)} 秒）`
          : `AI request timed out after ${Math.round(REQUEST_TIMEOUT_MS / 1000)}s`);
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function readErrorDetail(response) {
    if (!response || typeof response.json !== 'function') return '';
    try {
      const data = await response.json();
      const detail = data && data.error
        ? (typeof data.error === 'string' ? data.error : data.error.message)
        : data && data.message;
      return typeof detail === 'string' ? detail.trim().slice(0, 240) : '';
    } catch (_error) {
      return '';
    }
  }

  async function call(prompt, settings) {
    const providerId = settings.apiProvider || 'ollama';
    const provider = getProvider(providerId);
    const apiKey = String(settings.apiKey || '').trim();
    const model = String(settings.model || provider.model).trim();
    const isChinese = String(settings.language || 'zh_CN').toLowerCase().startsWith('zh');

    if (provider.requiresKey && !apiKey) {
      throw new Error(isChinese
        ? '请先在设置中填写 API Key'
        : 'Enter an API Key in settings first');
    }

    if (!model) {
      throw new Error(isChinese ? '请填写模型名称' : 'Enter a model name');
    }

    const endpoint = resolveEndpoint(providerId, settings, isChinese);
    const request = buildRequest(providerId, prompt, {
      ...settings,
      apiEndpoint: endpoint,
      model
    });
    const response = await fetchWithTimeout(request.endpoint, request.options, isChinese);

    if (!response.ok) {
      const detail = await readErrorDetail(response);
      const serviceName = provider.protocol === 'ollama' ? 'Ollama' : 'API';
      const baseMessage = isChinese
        ? `${serviceName} 请求失败（${response.status}）`
        : `${serviceName} request failed (${response.status})`;
      throw new Error(detail ? `${baseMessage}: ${detail}` : baseMessage);
    }
    const data = await response.json();
    return extractResponseText(provider.protocol, data);
  }

  const api = {
    PROVIDERS,
    getProvider,
    validateEndpoint,
    resolveEndpoint,
    buildRequest,
    extractResponseText,
    call
  };
  globalScope.SmartFavAI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
