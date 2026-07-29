(function attachAIKeywordSuggestions(globalScope) {
  const DEFAULT_SAMPLE_LIMIT = 12;
  const DEFAULT_BATCH_SIZE = 5;
  const DEFAULT_KEYWORD_LIMIT = 10;

  function normalize(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLocaleLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function clipText(value, limit) {
    return String(value || '')
      .normalize('NFKC')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, limit);
  }

  function getClassifier() {
    return globalScope.SmartFavClassifier || null;
  }

  function normalizeDomain(url) {
    const classifier = getClassifier();
    if (classifier && typeof classifier.normalizeDomain === 'function') {
      return classifier.normalizeDomain(url);
    }
    try {
      return new URL(String(url || '')).hostname
        .toLocaleLowerCase()
        .replace(/^www\./u, '');
    } catch (_error) {
      return '';
    }
  }

  function getSafeUrlDetails(value) {
    try {
      const url = new URL(String(value || ''));
      if (!['http:', 'https:'].includes(url.protocol)) return null;
      const domain = normalizeDomain(url.toString());
      if (!domain) return null;
      const path = clipText(url.pathname || '/', 120) || '/';
      return {
        domain,
        path,
        key: `${domain}${path}`
      };
    } catch (_error) {
      return null;
    }
  }

  function splitExistingKeywords(value) {
    const classifier = getClassifier();
    const keywords = classifier && typeof classifier.splitKeywords === 'function'
      ? classifier.splitKeywords(value)
      : (Array.isArray(value) ? value : String(value || '').split(/[\s,，;；]+/u));
    return keywords
      .map((keyword) => clipText(keyword, 48))
      .filter((keyword) => keyword && !/^domain\s*:/iu.test(keyword));
  }

  function pickRepresentativeSamples(favorites, sampleLimit) {
    const candidates = favorites
      .map((favorite) => {
        const url = getSafeUrlDetails(favorite && favorite.url);
        if (!url) return null;
        return {
          createdAt: Number(favorite.createdAt) || 0,
          title: clipText(favorite.title || url.domain, 140) || url.domain,
          domain: url.domain,
          path: url.path,
          key: url.key
        };
      })
      .filter(Boolean)
      .sort((left, right) => right.createdAt - left.createdAt);

    const selected = [];
    const selectedKeys = new Set();
    const selectedDomains = new Set();

    candidates.forEach((candidate) => {
      if (selected.length >= sampleLimit || selectedDomains.has(candidate.domain)) return;
      selected.push(candidate);
      selectedKeys.add(candidate.key);
      selectedDomains.add(candidate.domain);
    });
    candidates.forEach((candidate) => {
      if (selected.length >= sampleLimit || selectedKeys.has(candidate.key)) return;
      selected.push(candidate);
      selectedKeys.add(candidate.key);
    });

    return selected.map(({ title, domain, path }) => ({ title, domain, path }));
  }

  function buildCategoryProfiles(
    categoryDraft,
    favorites,
    {
      sampleLimit = DEFAULT_SAMPLE_LIMIT,
      existingKeywordLimit = 30
    } = {}
  ) {
    const safeSampleLimit = Math.min(20, Math.max(1, Number(sampleLimit) || DEFAULT_SAMPLE_LIMIT));
    const favoriteList = Array.isArray(favorites) ? favorites : [];
    return (Array.isArray(categoryDraft) ? categoryDraft : [])
      .map((item) => {
        const category = clipText(item && item.name, 64);
        if (!category) return null;
        const categoryFavorites = favoriteList.filter(
          (favorite) => favorite && String(favorite.category || '') === category
        );
        const samples = pickRepresentativeSamples(categoryFavorites, safeSampleLimit);
        if (!samples.length) return null;
        return {
          category,
          existingKeywords: splitExistingKeywords(item.keywords)
            .slice(0, Math.max(0, Number(existingKeywordLimit) || 0)),
          totalFavorites: categoryFavorites.length,
          samples
        };
      })
      .filter(Boolean);
  }

  function createBatches(profiles, batchSize = DEFAULT_BATCH_SIZE) {
    const size = Math.min(8, Math.max(1, Number(batchSize) || DEFAULT_BATCH_SIZE));
    const list = Array.isArray(profiles) ? profiles : [];
    const batches = [];
    for (let index = 0; index < list.length; index += size) {
      batches.push(list.slice(index, index + size));
    }
    return batches;
  }

  function extractJsonObject(response) {
    const source = String(response || '').trim();
    const start = source.indexOf('{');
    const end = source.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('AI response does not contain JSON');
    return JSON.parse(source.slice(start, end + 1));
  }

  function expandKeywordValues(value) {
    const values = Array.isArray(value) ? value : [value];
    const classifier = getClassifier();
    return values.flatMap((item) => {
      if (typeof item !== 'string') return [];
      const text = item.trim();
      if (!text) return [];
      if (Array.isArray(value) && !/[,，;；\r\n]/u.test(text)) return [text];
      if (classifier && typeof classifier.splitKeywords === 'function') {
        return classifier.splitKeywords(text);
      }
      return text.split(/[,，;；\r\n]+/u);
    });
  }

  function sanitizeSuggestedKeywords(value, keywordLimit = DEFAULT_KEYWORD_LIMIT) {
    const seen = new Set();
    const limit = Math.min(16, Math.max(1, Number(keywordLimit) || DEFAULT_KEYWORD_LIMIT));
    return expandKeywordValues(value)
      .map((keyword) => clipText(keyword, 48))
      .filter((keyword) => {
        const normalized = normalize(keyword);
        if (
          !normalized
          || seen.has(normalized)
          || /^domain\s*:/iu.test(keyword)
          || /^[a-z][a-z0-9+.-]*:\/\//iu.test(keyword)
        ) {
          return false;
        }
        seen.add(normalized);
        return true;
      })
      .slice(0, limit);
  }

  function parseKeywordSuggestions(
    response,
    allowedCategories,
    { keywordLimit = DEFAULT_KEYWORD_LIMIT } = {}
  ) {
    const parsed = extractJsonObject(response);
    const categoryMap = new Map(
      (Array.isArray(allowedCategories) ? allowedCategories : [])
        .map((category) => [normalize(category), String(category)])
        .filter(([normalized]) => normalized)
    );
    let entries = [];
    if (Array.isArray(parsed.categories)) {
      entries = parsed.categories;
    } else if (Array.isArray(parsed.suggestions)) {
      entries = parsed.suggestions;
    } else if (parsed.categories && typeof parsed.categories === 'object') {
      entries = Object.entries(parsed.categories).map(([category, keywords]) => ({
        category,
        keywords
      }));
    } else if (parsed && typeof parsed === 'object') {
      entries = Object.entries(parsed)
        .filter(([category]) => categoryMap.has(normalize(category)))
        .map(([category, keywords]) => ({ category, keywords }));
    }

    const result = new Map();
    entries.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const category = categoryMap.get(normalize(entry.category || entry.name));
      if (!category) return;
      const keywords = sanitizeSuggestedKeywords(
        entry.keywords || entry.suggestedKeywords || entry.tags,
        keywordLimit
      );
      if (!keywords.length) return;
      const current = result.get(category) || [];
      result.set(category, sanitizeSuggestedKeywords([...current, ...keywords], keywordLimit));
    });

    return Array.from(result, ([category, keywords]) => ({ category, keywords }));
  }

  function mergeIntoCategoryDraft(categoryDraft, suggestions) {
    const suggestionMap = new Map(
      (Array.isArray(suggestions) ? suggestions : [])
        .map((item) => [normalize(item && item.category), item])
        .filter(([category]) => category)
    );
    const addedByCategory = {};
    let addedCount = 0;
    const draft = (Array.isArray(categoryDraft) ? categoryDraft : []).map((item) => {
      const existingKeywords = Array.isArray(item.keywords) ? [...item.keywords] : [];
      const existing = new Set(existingKeywords.map(normalize).filter(Boolean));
      const suggestion = suggestionMap.get(normalize(item.name));
      const added = [];
      (suggestion && Array.isArray(suggestion.keywords) ? suggestion.keywords : [])
        .forEach((keyword) => {
          const normalized = normalize(keyword);
          if (!normalized || existing.has(normalized)) return;
          existing.add(normalized);
          existingKeywords.push(keyword);
          added.push(keyword);
        });
      if (added.length) {
        addedByCategory[item.name] = added.length;
        addedCount += added.length;
      }
      return {
        ...item,
        keywords: existingKeywords
      };
    });
    return {
      draft,
      addedByCategory,
      addedCount,
      updatedCategories: Object.keys(addedByCategory).length
    };
  }

  const api = {
    DEFAULT_SAMPLE_LIMIT,
    DEFAULT_BATCH_SIZE,
    DEFAULT_KEYWORD_LIMIT,
    getSafeUrlDetails,
    buildCategoryProfiles,
    createBatches,
    extractJsonObject,
    sanitizeSuggestedKeywords,
    parseKeywordSuggestions,
    mergeIntoCategoryDraft
  };

  globalScope.SmartFavAIKeywordSuggestions = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
