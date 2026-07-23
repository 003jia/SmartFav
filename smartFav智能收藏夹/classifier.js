(function attachClassifier(globalScope) {
  const DEFAULT_CATEGORIES = ['视频', '编程', '工具', '学习', '资讯', '其他'];

  const DEFAULT_RULES = {
    视频: ['视频', '直播', '电影', '影视', '弹幕', 'bilibili', 'youtube', 'youku', 'iqiyi', 'douyin'],
    编程: ['编程', '代码', '开发', '程序员', '前端', '后端', '算法', 'github', 'gitlab', 'stackoverflow', 'npm', 'python', 'javascript', 'java', 'rust', 'golang'],
    工具: ['工具', '效率', '转换', '下载', '编辑器', '插件', '扩展', '在线工具', 'tool', 'converter', 'editor'],
    学习: ['学习', '教程', '课程', '文档', '知识', '考试', '课堂', '大学', '教育', 'course', 'tutorial', 'docs'],
    资讯: ['新闻', '资讯', '报道', '头条', '快讯', '日报', '周报', 'news', 'article'],
    其他: []
  };

  function normalize(value) {
    return String(value || '')
      .toLocaleLowerCase()
      .normalize('NFKC')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function mergeRules(categories, customRules) {
    return categories.reduce((result, category) => {
      const custom = customRules && Array.isArray(customRules[category])
        ? customRules[category]
        : null;
      result[category] = (custom || DEFAULT_RULES[category] || [])
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

  function classify(tabInfo, settings = {}) {
    const categories = Array.isArray(settings.categories) && settings.categories.length
      ? settings.categories
      : DEFAULT_CATEGORIES;
    const rules = mergeRules(categories, settings.keywordRules);
    const index = buildKeywordIndex(rules);
    const scores = Object.fromEntries(categories.map((category) => [category, 0]));
    const matches = Object.fromEntries(categories.map((category) => [category, new Set()]));
    const fields = [
      { value: normalize(tabInfo.title), weight: 5 },
      { value: normalize(tabInfo.url), weight: 3 },
      { value: normalize(tabInfo.description), weight: 1 }
    ];

    index.forEach((matchedCategories, keyword) => {
      fields.forEach(({ value, weight }) => {
        const occurrences = countOccurrences(value, keyword);
        if (!occurrences) return;
        matchedCategories.forEach((category) => {
          scores[category] += occurrences * weight * Math.min(keyword.length, 5);
          matches[category].add(keyword);
        });
      });
    });

    const fallback = categories.includes('其他') ? '其他' : categories[categories.length - 1];
    const ranked = categories
      .filter((category) => category !== fallback)
      .sort((a, b) => scores[b] - scores[a]);
    const category = ranked[0] && scores[ranked[0]] > 0 ? ranked[0] : fallback;
    const tags = Array.from(matches[category] || []).slice(0, 4);
    const score = scores[category] || 0;

    return {
      category,
      tags,
      score,
      source: 'local',
      summary: tags.length
        ? `匹配到 ${tags.map((tag) => `“${tag}”`).join('、')}`
        : '暂未找到明确关键词，可手动调整分类'
    };
  }

  function rulesToText(categories, rules) {
    const merged = mergeRules(categories, rules);
    return categories
      .map((category) => `${category}=${merged[category].join(', ')}`)
      .join('\n');
  }

  function textToRules(text, categories) {
    const result = {};
    String(text || '').split(/\r?\n/).forEach((line) => {
      const separator = line.indexOf('=');
      if (separator < 1) return;
      const category = line.slice(0, separator).trim();
      if (!categories.includes(category)) return;
      result[category] = line.slice(separator + 1)
        .split(/[,，]/)
        .map((keyword) => keyword.trim())
        .filter(Boolean);
    });
    return mergeRules(categories, result);
  }

  const api = {
    DEFAULT_CATEGORIES,
    DEFAULT_RULES,
    buildKeywordIndex,
    classify,
    mergeRules,
    rulesToText,
    textToRules
  };

  globalScope.SmartFavClassifier = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
