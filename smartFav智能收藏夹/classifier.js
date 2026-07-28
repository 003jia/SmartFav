(function attachClassifier(globalScope) {
  const DEFAULTS = {
    zh_CN: {
      categories: ['视频', '编程', '工具', '学习', '资讯', '其他'],
      rules: {
        视频: ['视频', '直播', '电影', '影视', '弹幕', 'bilibili', 'youtube', 'youku', 'iqiyi', 'douyin', 'video', 'movie', 'stream'],
        编程: ['编程', '代码', '开发', '程序员', '前端', '后端', '算法', 'github', 'gitlab', 'stackoverflow', 'npm', 'python', 'javascript', 'java', 'rust', 'golang', 'coding', 'developer'],
        工具: ['工具', '效率', '转换', '下载', '编辑器', '插件', '扩展', '在线工具', 'tool', 'converter', 'editor', 'utility', 'download'],
        学习: ['学习', '教程', '课程', '文档', '知识', '考试', '课堂', '大学', '教育', 'course', 'tutorial', 'docs', 'learn', 'education'],
        资讯: ['新闻', '资讯', '报道', '头条', '快讯', '日报', '周报', 'news', 'article', 'report'],
        其他: []
      }
    },
    en: {
      categories: ['Video', 'Programming', 'Tools', 'Learning', 'News', 'Other'],
      rules: {
        Video: ['video', 'movie', 'stream', 'live', 'bilibili', 'youtube', 'youku', 'iqiyi', 'douyin', '视频', '直播', '电影'],
        Programming: ['programming', 'coding', 'code', 'developer', 'frontend', 'backend', 'algorithm', 'github', 'gitlab', 'stackoverflow', 'npm', 'python', 'javascript', 'java', 'rust', 'golang', '编程', '代码', '开发'],
        Tools: ['tool', 'utility', 'converter', 'download', 'editor', 'extension', 'plugin', 'productivity', '工具', '效率', '插件'],
        Learning: ['learning', 'learn', 'tutorial', 'course', 'docs', 'documentation', 'education', 'university', '学习', '教程', '课程', '文档'],
        News: ['news', 'article', 'report', 'headline', 'daily', 'weekly', '新闻', '资讯', '报道'],
        Other: []
      }
    }
  };

  const DEFAULT_CATEGORIES = DEFAULTS.zh_CN.categories;
  const DEFAULT_RULES = DEFAULTS.zh_CN.rules;
  const DEFAULT_WEIGHTS = {
    title: 5,
    keywords: 6,
    url: 3,
    description: 1
  };

  function getDefaults(language) {
    const source = String(language || '').toLowerCase().startsWith('zh')
      ? DEFAULTS.zh_CN
      : DEFAULTS.en;
    return {
      categories: [...source.categories],
      keywordRules: Object.fromEntries(
        Object.entries(source.rules).map(([category, keywords]) => [category, [...keywords]])
      )
    };
  }

  function normalize(value) {
    return String(value || '')
      .toLocaleLowerCase()
      .normalize('NFKC')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function splitKeywords(value) {
    return [...new Set(String(value || '')
      .split(/[,，;；\r\n]+/)
      .map((keyword) => keyword.trim())
      .filter(Boolean))];
  }

  function mergeRules(categories, customRules, language = 'zh_CN') {
    const defaults = getDefaults(language).keywordRules;
    return categories.reduce((result, category) => {
      const custom = customRules && Array.isArray(customRules[category])
        ? customRules[category]
        : null;
      result[category] = (custom || defaults[category] || [])
        .map(normalize)
        .filter(Boolean);
      return result;
    }, {});
  }

  function buildKeywordIndex(rules) {
    const index = new Map();
    Object.entries(rules).forEach(([category, keywords]) => {
      keywords.forEach((keyword) => {
        if (!index.has(keyword)) index.set(keyword, []);
        index.get(keyword).push(category);
      });
    });
    return index;
  }

  function countOccurrences(text, keyword) {
    if (!text || !keyword) return 0;
    let count = 0;
    let position = 0;
    while ((position = text.indexOf(keyword, position)) !== -1) {
      count += 1;
      position += Math.max(keyword.length, 1);
    }
    return count;
  }

  function normalizeWeights(value) {
    const source = value && typeof value === 'object' ? value : {};
    return Object.fromEntries(Object.entries(DEFAULT_WEIGHTS).map(([field, fallback]) => {
      const parsed = Number(source[field]);
      return [field, Number.isFinite(parsed) ? Math.min(10, Math.max(1, parsed)) : fallback];
    }));
  }

  function tokenizeVectorText(value) {
    const segments = normalize(value).match(/[\p{Script=Han}]+|[a-z0-9]+/gu) || [];
    const tokens = [];
    segments.forEach((segment) => {
      const characters = Array.from(segment);
      tokens.push(segment);
      if (/^\p{Script=Han}+$/u.test(segment)) {
        characters.forEach((character) => tokens.push(character));
        for (let index = 0; index < characters.length - 1; index += 1) {
          tokens.push(characters.slice(index, index + 2).join(''));
        }
        return;
      }
      if (segment.length >= 4) {
        for (let index = 0; index < segment.length - 2; index += 1) {
          tokens.push(`#${segment.slice(index, index + 3)}`);
        }
      }
    });
    return tokens;
  }

  function addToVector(vector, value, weight) {
    tokenizeVectorText(value).forEach((token) => {
      vector.set(token, (vector.get(token) || 0) + weight);
    });
  }

  function cosineSimilarity(left, right) {
    if (!left.size || !right.size) return 0;
    let dot = 0;
    let leftMagnitude = 0;
    let rightMagnitude = 0;
    left.forEach((value, token) => {
      leftMagnitude += value * value;
      dot += value * (right.get(token) || 0);
    });
    right.forEach((value) => {
      rightMagnitude += value * value;
    });
    if (!leftMagnitude || !rightMagnitude) return 0;
    return dot / Math.sqrt(leftMagnitude * rightMagnitude);
  }

  function createPageVector(tabInfo, weights) {
    const vector = new Map();
    addToVector(vector, tabInfo.title, weights.title);
    addToVector(
      vector,
      Array.isArray(tabInfo.keywords) ? tabInfo.keywords.join(' ') : tabInfo.keywords,
      weights.keywords
    );
    addToVector(vector, tabInfo.url, weights.url);
    addToVector(vector, tabInfo.description, weights.description);
    return vector;
  }

  function createCategoryVector(category, keywords) {
    const vector = new Map();
    addToVector(vector, category, 2);
    keywords.forEach((keyword) => addToVector(vector, keyword, 1));
    return vector;
  }

  function scoreRatios(scores) {
    const total = Object.values(scores).reduce((sum, score) => sum + Math.max(0, score), 0);
    return Object.fromEntries(Object.entries(scores).map(([category, score]) => [
      category,
      total ? Math.round((Math.max(0, score) / total) * 1000) / 10 : 0
    ]));
  }

  function classify(tabInfo, settings = {}) {
    const categories = Array.isArray(settings.categories) && settings.categories.length
      ? settings.categories
      : DEFAULT_CATEGORIES;
    const language = String(settings.language || 'zh_CN').toLowerCase().startsWith('zh')
      ? 'zh_CN'
      : 'en';
    const rules = mergeRules(categories, settings.keywordRules, language);
    const index = buildKeywordIndex(rules);
    const weightedScores = Object.fromEntries(categories.map((category) => [category, 0]));
    const matches = Object.fromEntries(categories.map((category) => [category, new Set()]));
    const defaultCategories = new Set(getDefaults(language).categories);
    const weights = normalizeWeights(settings.classificationWeights);
    const fields = [
      { value: normalize(tabInfo.title), weight: weights.title },
      {
        value: normalize(Array.isArray(tabInfo.keywords) ? tabInfo.keywords.join(' ') : tabInfo.keywords),
        weight: weights.keywords
      },
      { value: normalize(tabInfo.url), weight: weights.url },
      { value: normalize(tabInfo.description), weight: weights.description }
    ];

    index.forEach((matchedCategories, keyword) => {
      fields.forEach(({ value, weight }) => {
        const occurrences = countOccurrences(value, keyword);
        if (!occurrences) return;
        matchedCategories.forEach((category) => {
          // User-created folders are intentionally more specific than the
          // broad built-in buckets, so a direct match should be able to win
          // even when a generic default rule also matches the page URL.
          const categoryBoost = defaultCategories.has(category) ? 1 : 2;
          weightedScores[category] += occurrences * weight * Math.min(keyword.length, 5) * categoryBoost;
          matches[category].add(keyword);
        });
      });
    });

    const pageVector = createPageVector(tabInfo, weights);
    const vectorScores = Object.fromEntries(categories.map((category) => {
      const similarity = cosineSimilarity(
        pageVector,
        createCategoryVector(category, rules[category] || [])
      );
      const categoryBoost = defaultCategories.has(category) ? 1 : 1.12;
      return [category, Math.round(similarity * 1000 * categoryBoost) / 10];
    }));
    const method = settings.classificationMode === 'vector' ? 'vector' : 'weighted';
    const scores = method === 'vector' ? vectorScores : weightedScores;
    const preferredFallback = language === 'zh_CN' ? '其他' : 'Other';
    const fallback = categories.includes(preferredFallback)
      ? preferredFallback
      : categories[categories.length - 1];
    const ranked = categories
      .filter((category) => category !== fallback)
      .sort((a, b) => scores[b] - scores[a]);
    const minimumScore = method === 'vector' ? 4 : 0;
    const category = ranked[0] && scores[ranked[0]] > minimumScore ? ranked[0] : fallback;
    const vectorTags = (rules[category] || [])
      .map((keyword) => {
        const keywordVector = new Map();
        addToVector(keywordVector, keyword, 1);
        return { keyword, similarity: cosineSimilarity(pageVector, keywordVector) };
      })
      .filter((item) => item.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .map((item) => item.keyword);
    const tags = (method === 'vector'
      ? vectorTags
      : Array.from(matches[category] || []))
      .slice(0, 4);
    const score = scores[category] || 0;

    return {
      category,
      tags,
      score,
      scores,
      scoreRatios: scoreRatios(scores),
      method,
      weights,
      source: 'local',
      summary: tags.length
        ? language === 'zh_CN'
          ? `匹配到 ${tags.map((tag) => `“${tag}”`).join('、')}`
          : `Matched ${tags.map((tag) => `“${tag}”`).join(', ')}`
        : language === 'zh_CN'
          ? '暂未找到明确关键词，可手动调整分类'
          : 'No clear keyword match. You can adjust the category.'
    };
  }

  function rulesToText(categories, rules, language = 'zh_CN') {
    const merged = mergeRules(categories, rules, language);
    return categories
      .map((category) => `${category}=${merged[category].join(', ')}`)
      .join('\n');
  }

  function textToRules(text, categories, language = 'zh_CN') {
    const result = {};
    String(text || '').split(/\r?\n/).forEach((line) => {
      const separator = line.indexOf('=');
      if (separator < 1) return;
      const category = line.slice(0, separator).trim();
      if (!categories.includes(category)) return;
      result[category] = splitKeywords(line.slice(separator + 1));
    });
    return mergeRules(categories, result, language);
  }

  const api = {
    DEFAULTS,
    DEFAULT_CATEGORIES,
    DEFAULT_RULES,
    DEFAULT_WEIGHTS,
    getDefaults,
    buildKeywordIndex,
    classify,
    cosineSimilarity,
    mergeRules,
    normalizeWeights,
    tokenizeVectorText,
    splitKeywords,
    rulesToText,
    textToRules
  };

  globalScope.SmartFavClassifier = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
