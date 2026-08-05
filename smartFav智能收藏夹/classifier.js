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

  function normalizeDomain(value) {
    const source = String(value || '').trim();
    if (!source) return '';
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//iu.test(source)
      ? source
      : `https://${source}`;
    try {
      const parsed = new URL(candidate);
      if (!['http:', 'https:'].includes(parsed.protocol)) return '';
      return normalize(parsed.hostname)
        .replace(/^www\./u, '')
        .replace(/\.$/u, '');
    } catch (error) {
      return '';
    }
  }

  function parseDomainRule(value) {
    const keyword = normalize(value);
    if (!keyword.startsWith('domain:')) return '';
    return normalizeDomain(keyword.slice('domain:'.length));
  }

  function isDomainRule(value) {
    return normalize(value).startsWith('domain:');
  }

  function domainMatches(hostname, domain) {
    return Boolean(
      hostname
      && domain
      && (hostname === domain || hostname.endsWith(`.${domain}`))
    );
  }

  function splitKeywords(value) {
    if (Array.isArray(value)) {
      return [...new Set(value
        .map((keyword) => String(keyword || '').trim())
        .filter(Boolean))];
    }

    const keywords = [];
    let token = '';
    let quote = '';
    const pushToken = () => {
      const keyword = token.trim();
      token = '';
      if (keyword && !keywords.includes(keyword)) keywords.push(keyword);
    };

    const source = String(value || '');
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (quote) {
        if (
          character === '\\'
          && index + 1 < source.length
          && (source[index + 1] === quote || source[index + 1] === '\\')
        ) {
          token += source[index + 1];
          index += 1;
        } else if (character === quote) {
          quote = '';
        } else {
          token += character;
        }
        continue;
      }

      if ((character === '"' || character === "'") && !token) {
        quote = character;
      } else if (/[\s,，;；]/u.test(character)) {
        pushToken();
      } else {
        token += character;
      }
    }
    pushToken();
    return keywords;
  }

  function formatKeywords(value) {
    return splitKeywords(value)
      .map((keyword) => {
        if (!/[\s,，;；]/u.test(keyword)) return keyword;
        const escaped = keyword
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"');
        return `"${escaped}"`;
      })
      .join(', ');
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
        if (isDomainRule(keyword)) return;
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
    keywords
      .filter((keyword) => !isDomainRule(keyword))
      .forEach((keyword) => addToVector(vector, keyword, 1));
    return vector;
  }

  function scoreRatios(scores) {
    const total = Object.values(scores).reduce((sum, score) => sum + Math.max(0, score), 0);
    return Object.fromEntries(Object.entries(scores).map(([category, score]) => [
      category,
      total ? Math.round((Math.max(0, score) / total) * 1000) / 10 : 0
    ]));
  }

  function findDomainRuleMatch(url, categories, rules) {
    const hostname = normalizeDomain(url);
    if (!hostname) return null;
    for (const category of categories) {
      const matchedDomain = (rules[category] || [])
        .map(parseDomainRule)
        .find((domain) => domainMatches(hostname, domain));
      if (matchedDomain) {
        return {
          category,
          domain: matchedDomain,
          keyword: `domain:${matchedDomain}`
        };
      }
    }
    return null;
  }

  function calculateConfidence({
    category,
    fallback,
    method,
    score,
    scores,
    tags,
    domainMatch
  }) {
    if (domainMatch) return 'high';
    if (!category || category === fallback || score <= 0) return 'low';
    const rankedScores = Object.entries(scores)
      .filter(([name]) => name !== fallback)
      .map(([, value]) => Math.max(0, Number(value) || 0))
      .sort((left, right) => right - left);
    const margin = Math.max(0, score - (rankedScores[1] || 0));
    if (method === 'vector') {
      return score >= 18 && margin >= 4 ? 'high' : 'medium';
    }
    if (
      tags.length >= 2
      || (score >= 24 && margin >= Math.max(8, score * 0.35))
    ) {
      return 'high';
    }
    return 'medium';
  }

  function createDomainLearningProposal(favorite, targetCategory, settings = {}) {
    const categories = Array.isArray(settings.categories) ? settings.categories : [];
    if (!categories.includes(targetCategory)) return null;
    const domain = normalizeDomain(favorite && favorite.url);
    if (!domain) return null;
    const language = String(settings.language || 'zh_CN').toLowerCase().startsWith('zh')
      ? 'zh_CN'
      : 'en';
    const rules = mergeRules(categories, settings.keywordRules, language);
    const matchingCategories = categories.filter((category) => (
      (rules[category] || []).some((keyword) => parseDomainRule(keyword) === domain)
    ));
    const alreadyInTarget = matchingCategories.includes(targetCategory);
    const previousCategories = matchingCategories.filter((category) => category !== targetCategory);
    if (alreadyInTarget && !previousCategories.length) return null;
    return {
      type: 'domain',
      domain,
      keyword: `domain:${domain}`,
      title: favorite && favorite.title ? String(favorite.title) : '',
      targetCategory,
      previousCategories,
      alreadyInTarget
    };
  }

  function applyDomainLearning(settings = {}, proposal = {}) {
    const categories = Array.isArray(settings.categories) ? settings.categories : [];
    const targetCategory = String(proposal.targetCategory || '');
    const domain = normalizeDomain(proposal.domain) || parseDomainRule(proposal.keyword);
    if (!domain || !categories.includes(targetCategory)) {
      throw new Error('Invalid domain learning proposal');
    }
    const language = String(settings.language || 'zh_CN').toLowerCase().startsWith('zh')
      ? 'zh_CN'
      : 'en';
    const currentRules = mergeRules(categories, settings.keywordRules, language);
    const removedFrom = [];
    const nextRules = Object.fromEntries(categories.map((category) => {
      const keywords = (currentRules[category] || []).filter((keyword) => {
        const shouldRemove = parseDomainRule(keyword) === domain;
        if (shouldRemove && category !== targetCategory && !removedFrom.includes(category)) {
          removedFrom.push(category);
        }
        return !shouldRemove;
      });
      if (category === targetCategory) keywords.push(`domain:${domain}`);
      return [category, [...new Set(keywords)]];
    }));
    return {
      settings: {
        ...settings,
        keywordRules: nextRules
      },
      previousKeywordRules: Object.fromEntries(categories.map((category) => [
        category,
        [...(currentRules[category] || [])]
      ])),
      domain,
      keyword: `domain:${domain}`,
      targetCategory,
      removedFrom
    };
  }

  function revertDomainLearning(settings = {}, learningResult = {}) {
    const categories = Array.isArray(settings.categories) ? settings.categories : [];
    const previousRules = learningResult.previousKeywordRules;
    if (!previousRules || typeof previousRules !== 'object') {
      throw new Error('Invalid domain learning rollback');
    }
    const keywordRules = Object.fromEntries(categories.map((category) => {
      if (!Array.isArray(previousRules[category])) {
        throw new Error('Incomplete domain learning rollback');
      }
      return [
        category,
        [...new Set(previousRules[category].map(normalize).filter(Boolean))]
      ];
    }));
    return {
      ...settings,
      keywordRules
    };
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
    const domainMatch = findDomainRuleMatch(tabInfo.url, categories, rules);
    if (domainMatch) {
      const highestScore = Math.max(0, ...Object.values(scores));
      scores[domainMatch.category] = Math.max(
        Number(scores[domainMatch.category]) || 0,
        highestScore + 100
      );
    }
    const preferredFallback = language === 'zh_CN' ? '其他' : 'Other';
    const fallback = categories.includes(preferredFallback)
      ? preferredFallback
      : categories[categories.length - 1];
    const ranked = categories
      .filter((category) => category !== fallback)
      .sort((a, b) => scores[b] - scores[a]);
    const minimumScore = method === 'vector' ? 4 : 0;
    const category = domainMatch
      ? domainMatch.category
      : ranked[0] && scores[ranked[0]] > minimumScore ? ranked[0] : fallback;
    const vectorTags = (rules[category] || [])
      .filter((keyword) => !isDomainRule(keyword))
      .map((keyword) => {
        const keywordVector = new Map();
        addToVector(keywordVector, keyword, 1);
        return { keyword, similarity: cosineSimilarity(pageVector, keywordVector) };
      })
      .filter((item) => item.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .map((item) => item.keyword);
    const tags = domainMatch
      ? [domainMatch.domain]
      : (method === 'vector'
        ? vectorTags
        : Array.from(matches[category] || []))
        .slice(0, 4);
    const score = scores[category] || 0;
    const ratios = scoreRatios(scores);
    const confidence = calculateConfidence({
      category,
      fallback,
      method,
      score,
      scores,
      tags,
      domainMatch
    });

    return {
      category,
      tags,
      score,
      scores,
      scoreRatios: ratios,
      method,
      weights,
      confidence,
      matchType: domainMatch ? 'domain' : 'keywords',
      source: 'local',
      summary: domainMatch
        ? language === 'zh_CN'
          ? `根据已记住的域名规则“${domainMatch.domain}”归类`
          : `Classified by the remembered domain rule “${domainMatch.domain}”`
        : tags.length
        ? language === 'zh_CN'
          ? `匹配到 ${tags.map((tag) => `“${tag}”`).join('、')}`
          : `Matched ${tags.map((tag) => `“${tag}”`).join(', ')}`
        : language === 'zh_CN'
          ? '暂未找到明确关键词，可手动调整分类'
          : 'No clear keyword match. You can adjust the category.'
    };
  }

  // 多级收藏夹分类：folderId 是稳定身份，名称与父级关键词只用于评分。
  // 父级语义按每层 0.35 衰减；直接规则、域名规则和更深路径优先。
  function classifyFolders(tabInfo, settings = {}, folderInput = []) {
    const folders = (Array.isArray(folderInput) ? folderInput : [])
      .filter((folder) => folder && folder.id && folder.name);
    if (!folders.length) {
      const legacy = classify(tabInfo, settings);
      return { ...legacy, folderId: '', folderPath: legacy.category };
    }
    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    const language = String(settings.language || 'zh_CN').toLowerCase().startsWith('zh')
      ? 'zh_CN'
      : 'en';
    const weights = normalizeWeights(settings.classificationWeights);
    const method = settings.classificationMode === 'vector' ? 'vector' : 'weighted';
    const fields = [
      { value: normalize(tabInfo.title), weight: weights.title },
      {
        value: normalize(Array.isArray(tabInfo.keywords) ? tabInfo.keywords.join(' ') : tabInfo.keywords),
        weight: weights.keywords
      },
      { value: normalize(tabInfo.url), weight: weights.url },
      { value: normalize(tabInfo.description), weight: weights.description }
    ];
    const hostname = normalizeDomain(tabInfo.url);

    function pathFor(folder) {
      const path = [];
      const visited = new Set();
      let current = folder;
      while (current && !visited.has(current.id)) {
        path.unshift(current);
        visited.add(current.id);
        current = current.parentId ? byId.get(current.parentId) : null;
      }
      return path;
    }

    const details = new Map();
    folders.forEach((folder) => {
      const path = pathFor(folder);
      const rules = [];
      path.forEach((segment, index) => {
        const distance = path.length - index - 1;
        const inheritedWeight = distance === 0 ? 1 : Math.pow(0.35, distance);
        rules.push({ value: segment.name, weight: inheritedWeight * 1.25, direct: distance === 0 });
        (Array.isArray(segment.keywords) ? segment.keywords : []).forEach((keyword) => {
          rules.push({ value: keyword, weight: inheritedWeight, direct: distance === 0 });
        });
      });
      details.set(folder.id, { folder, path, rules });
    });

    const scores = {};
    const matches = {};
    const matchedDomains = {};
    const pageVector = createPageVector(tabInfo, weights);
    folders.forEach((folder) => {
      const detail = details.get(folder.id);
      let weightedScore = 0;
      const matched = [];
      let matchedDomain = '';
      detail.rules.forEach((rule) => {
        const keyword = normalize(rule.value);
        if (!keyword) return;
        const domain = parseDomainRule(keyword);
        if (domain) {
          if (domainMatches(hostname, domain)) {
            const domainScore = 1000 * rule.weight * (rule.direct ? 1.2 : 1);
            if (domainScore > weightedScore) weightedScore = domainScore;
            matchedDomain = domain;
          }
          return;
        }
        fields.forEach((field) => {
          const occurrences = countOccurrences(field.value, keyword);
          if (!occurrences) return;
          weightedScore += occurrences * field.weight * Math.min(keyword.length, 5) * rule.weight;
          if (!matched.includes(keyword)) matched.push(keyword);
        });
      });
      if (method === 'vector') {
        const vector = new Map();
        detail.rules.forEach((rule) => {
          if (!isDomainRule(rule.value)) addToVector(vector, rule.value, rule.weight);
        });
        scores[folder.id] = Math.round(cosineSimilarity(pageVector, vector) * 1000) / 10;
        if (matchedDomain) scores[folder.id] = Math.max(scores[folder.id], 1000);
      } else {
        scores[folder.id] = Math.round(weightedScore * 100) / 100;
      }
      matches[folder.id] = matched;
      matchedDomains[folder.id] = matchedDomain;
    });

    const preferredFallback = language === 'zh_CN' ? '其他' : 'Other';
    const roots = folders.filter((folder) => !folder.parentId);
    const fallback = roots.find((folder) => folder.name === preferredFallback)
      || roots[roots.length - 1]
      || folders[folders.length - 1];
    const ranked = [...folders].sort((left, right) => {
      const scoreDifference = (scores[right.id] || 0) - (scores[left.id] || 0);
      if (scoreDifference) return scoreDifference;
      const directDifference = matches[right.id].length - matches[left.id].length;
      if (directDifference) return directDifference;
      return details.get(right.id).path.length - details.get(left.id).path.length;
    });
    const minimumScore = method === 'vector' ? 4 : 0;
    const winner = ranked[0] && scores[ranked[0].id] > minimumScore ? ranked[0] : fallback;
    const winnerId = winner ? winner.id : '';
    const tags = matchedDomains[winnerId]
      ? [matchedDomains[winnerId]]
      : (matches[winnerId] || []).slice(0, 4);
    const folderPath = winnerId
      ? details.get(winnerId).path.map((folder) => folder.name).join(' › ')
      : '';
    const confidence = calculateConfidence({
      category: winnerId,
      fallback: fallback && fallback.id,
      method,
      score: scores[winnerId] || 0,
      scores,
      tags,
      domainMatch: matchedDomains[winnerId] ? { domain: matchedDomains[winnerId] } : null
    });
    return {
      category: folderPath,
      folderId: winnerId,
      folderPath,
      tags,
      score: scores[winnerId] || 0,
      scores,
      scoreRatios: scoreRatios(scores),
      method,
      weights,
      confidence,
      matchType: matchedDomains[winnerId] ? 'domain' : 'keywords',
      source: 'local',
      summary: matchedDomains[winnerId]
        ? (language === 'zh_CN'
          ? `根据已记住的域名规则“${matchedDomains[winnerId]}”归类到“${folderPath}”`
          : `Classified into “${folderPath}” by the remembered domain rule “${matchedDomains[winnerId]}”`)
        : tags.length
          ? (language === 'zh_CN'
            ? `匹配到 ${tags.map((tag) => `“${tag}”`).join('、')}`
            : `Matched ${tags.map((tag) => `“${tag}”`).join(', ')}`)
          : (language === 'zh_CN'
            ? '暂未找到明确关键词，可手动调整分类'
            : 'No clear keyword match. You can adjust the folder.')
    };
  }

  function rulesToText(categories, rules, language = 'zh_CN') {
    const merged = mergeRules(categories, rules, language);
    return categories
      .map((category) => `${category}=${formatKeywords(merged[category])}`)
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
    classifyFolders,
    normalizeDomain,
    parseDomainRule,
    createDomainLearningProposal,
    applyDomainLearning,
    revertDomainLearning,
    cosineSimilarity,
    mergeRules,
    normalizeWeights,
    tokenizeVectorText,
    splitKeywords,
    formatKeywords,
    rulesToText,
    textToRules
  };

  globalScope.SmartFavClassifier = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
