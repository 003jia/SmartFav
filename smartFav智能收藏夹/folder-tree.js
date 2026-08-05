// SmartFav Folder Tree - 多级收藏夹模型、迁移与纯状态操作
(function attachFolderTree(globalScope) {
  const SCHEMA_VERSION = 2;
  const SOURCE_VALUES = new Set(['default', 'user', 'ai', 'browser']);
  // 目录最大层数（含根层）。浏览器书签树本身无硬限制，但过深路径会让
  // findOrCreateFolderPath 的逐层创建变慢，面包屑也无法在 360px 弹窗内显示。
  const MAX_DEPTH = 8;
  // 零宽字符不可见，若不剥离会让「工作」与「工作\u200b」成为视觉同名的兄弟目录，
  // 绕过 findSiblingByName 的重名校验。
  const INVISIBLE_CHARS = /[\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060-\u2064\ufeff]/g;

  function normalizeText(value, limit = 128) {
    return String(value || '')
      .normalize('NFKC')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(INVISIBLE_CHARS, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, limit);
  }

  function sanitizeFolderName(value) {
    return normalizeText(value, 64)
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function createId(prefix = 'id') {
    const cryptoApi = globalScope.crypto;
    if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
      return `${prefix}-${cryptoApi.randomUUID()}`;
    }
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function uniqueKeywords(values) {
    const seen = new Set();
    return (Array.isArray(values) ? values : [])
      .map((value) => normalizeText(value, 48))
      .filter((value) => {
        const key = value.toLocaleLowerCase();
        if (!value || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 32);
  }

  function normalizeFolder(raw, index = 0) {
    const name = sanitizeFolderName(raw && raw.name);
    if (!name) return null;
    const id = normalizeText(raw && raw.id, 128) || createId('fld');
    const parentId = normalizeText(raw && raw.parentId, 128) || null;
    const source = SOURCE_VALUES.has(raw && raw.source) ? raw.source : 'user';
    const order = Number.isFinite(Number(raw && raw.order)) ? Number(raw.order) : index;
    const browserFolderId = normalizeText(raw && raw.browserFolderId, 256) || '';
    return {
      id,
      parentId,
      name,
      order,
      keywords: uniqueKeywords(raw && raw.keywords),
      source,
      ...(browserFolderId ? { browserFolderId } : {})
    };
  }

  function normalizeFolders(input) {
    const seenIds = new Set();
    const folders = [];
    (Array.isArray(input) ? input : []).forEach((raw, index) => {
      const folder = normalizeFolder(raw, index);
      if (!folder || seenIds.has(folder.id)) return;
      seenIds.add(folder.id);
      folders.push(folder);
    });
    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    // 只断开「自己确实处于环上」的节点：从 folder 向上走能回到 folder 本身。
    // 早期实现把「向上走遇到任何重复节点」都当成 folder 有环，会把挂在环下方
    // 的无辜节点也提升为根目录，用户会看到子目录莫名跳到顶层。
    folders.forEach((folder) => {
      if (!folder.parentId || !byId.has(folder.parentId) || folder.parentId === folder.id) {
        folder.parentId = null;
        return;
      }
      const walked = new Set([folder.id]);
      let current = byId.get(folder.parentId);
      while (current) {
        if (current.id === folder.id) {
          // 回到起点，folder 在环上，断开它这一条边即可打破整个环。
          folder.parentId = null;
          return;
        }
        if (walked.has(current.id)) return; // 环在上游，交给上游节点自己那一轮处理
        walked.add(current.id);
        current = current.parentId ? byId.get(current.parentId) : null;
      }
    });
    return folders;
  }

  // 归一化后的树索引。childrenOf / getPath / getDescendantIds 等只读查询每次调用
  // 都要重跑 normalizeFolders，在「每个文件夹算一次后代数」「每行收藏生成一份移动
  // 下拉」这类渲染路径上会退化成 O(n²)~O(n³)。渲染与服务层应先建一次索引再复用。
  function createIndex(folders) {
    const normalized = normalizeFolders(folders);
    const byId = new Map();
    const childrenByParent = new Map();
    normalized.forEach((folder) => {
      byId.set(folder.id, folder);
      const key = folder.parentId || '';
      if (!childrenByParent.has(key)) childrenByParent.set(key, []);
      childrenByParent.get(key).push(folder);
    });
    childrenByParent.forEach((list) => {
      list.sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
    });

    const pathById = new Map();
    function pathOf(folderId) {
      if (pathById.has(folderId)) return pathById.get(folderId);
      const folder = byId.get(folderId);
      if (!folder) return [];
      const parentPath = folder.parentId ? pathOf(folder.parentId) : [];
      const path = [...parentPath, folder];
      pathById.set(folderId, path);
      return path;
    }
    normalized.forEach((folder) => pathOf(folder.id));

    const descendantsById = new Map();
    function descendantsOf(folderId) {
      if (descendantsById.has(folderId)) return descendantsById.get(folderId);
      const result = [];
      (childrenByParent.get(folderId) || []).forEach((child) => {
        result.push(child.id, ...descendantsOf(child.id));
      });
      descendantsById.set(folderId, result);
      return result;
    }
    normalized.forEach((folder) => descendantsOf(folder.id));

    return {
      folders: normalized,
      byId,
      children: (parentId = null) => [...(childrenByParent.get(parentId || '') || [])],
      path: (folderId) => [...(pathById.get(normalizeText(folderId, 128)) || [])],
      pathLabel: (folderId, separator = ' › ') => (
        (pathById.get(normalizeText(folderId, 128)) || []).map((folder) => folder.name).join(separator)
      ),
      descendantIds: (folderId) => [...(descendantsById.get(normalizeText(folderId, 128)) || [])],
      depth: (folderId) => (pathById.get(normalizeText(folderId, 128)) || []).length
    };
  }

  function childrenOf(folders, parentId = null) {
    const normalizedParent = parentId || null;
    return normalizeFolders(folders)
      .filter((folder) => (folder.parentId || null) === normalizedParent)
      .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
  }

  function getFolder(folders, folderId) {
    const normalizedId = normalizeText(folderId, 128);
    return normalizeFolders(folders).find((folder) => folder.id === normalizedId) || null;
  }

  function getPath(folders, folderId) {
    const normalized = normalizeFolders(folders);
    const byId = new Map(normalized.map((folder) => [folder.id, folder]));
    const path = [];
    const visited = new Set();
    let current = byId.get(normalizeText(folderId, 128));
    while (current && !visited.has(current.id)) {
      path.unshift(current);
      visited.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : null;
    }
    return path;
  }

  function getPathLabel(folders, folderId, separator = ' › ') {
    return getPath(folders, folderId).map((folder) => folder.name).join(separator);
  }

  function getDescendantIds(folders, folderId) {
    const normalized = normalizeFolders(folders);
    const children = new Map();
    normalized.forEach((folder) => {
      const key = folder.parentId || '';
      if (!children.has(key)) children.set(key, []);
      children.get(key).push(folder.id);
    });
    const result = [];
    const queue = [...(children.get(normalizeText(folderId, 128)) || [])];
    const visited = new Set();
    while (queue.length) {
      const id = queue.shift();
      if (!id || visited.has(id)) continue;
      visited.add(id);
      result.push(id);
      queue.push(...(children.get(id) || []));
    }
    return result;
  }

  function findSiblingByName(folders, parentId, name, excludeId = '') {
    const normalizedName = sanitizeFolderName(name).toLocaleLowerCase();
    return normalizeFolders(folders).find((folder) => (
      (folder.parentId || null) === (parentId || null)
      && folder.id !== excludeId
      && folder.name.toLocaleLowerCase() === normalizedName
    )) || null;
  }

  function getFallbackFolder(folders, language = 'zh_CN') {
    const preferred = String(language || '').toLowerCase().startsWith('zh') ? '其他' : 'Other';
    const roots = childrenOf(folders, null);
    return roots.find((folder) => folder.name === preferred)
      || roots[roots.length - 1]
      || null;
  }

  function makeFavoriteId(favorite) {
    return normalizeText(favorite && favorite.id, 128) || createId('fav');
  }

  function migrateState(state = {}, defaults = {}) {
    const settings = state.settings && typeof state.settings === 'object' ? state.settings : {};
    const language = settings.language || defaults.language || 'zh_CN';
    let folders = normalizeFolders(state.folders);
    let changed = Number(state.folderSchemaVersion) !== SCHEMA_VERSION;

    if (!folders.length) {
      const categories = Array.isArray(settings.categories) && settings.categories.length
        ? settings.categories
        : (Array.isArray(defaults.categories) ? defaults.categories : []);
      const keywordRules = settings.keywordRules && typeof settings.keywordRules === 'object'
        ? settings.keywordRules
        : (defaults.keywordRules || {});
      folders = categories.reduce((result, category, index) => {
        const name = sanitizeFolderName(category);
        if (!name || result.some((folder) => folder.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
          return result;
        }
        result.push({
          id: createId('fld'),
          parentId: null,
          name,
          order: index,
          keywords: uniqueKeywords(keywordRules[category]),
          source: index < 6 ? 'default' : 'user'
        });
        return result;
      }, []);
      changed = true;
    }

    // 迁移会遍历全部收藏并为每条求一次路径文本，这里先建一次索引，
    // 避免逐条调用 getPathLabel 时反复重跑 normalizeFolders。
    const index = createIndex(folders);
    const validFolderIds = new Set(folders.map((folder) => folder.id));
    const rootsByName = new Map(
      index.children(null).map((folder) => [folder.name.toLocaleLowerCase(), folder])
    );
    const fallback = getFallbackFolder(folders, language);
    const favoriteIds = new Set();
    const favorites = (Array.isArray(state.favorites) ? state.favorites : []).map((favorite) => {
      let id = makeFavoriteId(favorite);
      while (favoriteIds.has(id)) id = createId('fav');
      favoriteIds.add(id);
      const legacyCategory = normalizeText(favorite && favorite.category, 64);
      const legacyFolder = rootsByName.get(legacyCategory.toLocaleLowerCase());
      const folderId = validFolderIds.has(favorite && favorite.folderId)
        ? favorite.folderId
        : (legacyFolder ? legacyFolder.id : (fallback && fallback.id));
      const next = {
        ...favorite,
        id,
        folderId: folderId || null,
        category: folderId ? index.pathLabel(folderId) : legacyCategory
      };
      if (next.id !== favorite.id || next.folderId !== favorite.folderId || next.category !== favorite.category) {
        changed = true;
      }
      return next;
    });

    const favoritesByUrl = new Map();
    const favoritesById = new Map();
    favorites.forEach((favorite) => {
      const matches = favoritesByUrl.get(favorite.url) || [];
      matches.push(favorite);
      favoritesByUrl.set(favorite.url, matches);
      favoritesById.set(favorite.id, favorite);
    });
    const legacyOrder = state.favoriteOrder && typeof state.favoriteOrder === 'object'
      ? state.favoriteOrder
      : {};
    const favoriteOrder = {};
    Object.entries(legacyOrder).forEach(([key, values]) => {
      // schema v1 的 key 是分类名、value 是 url；v2 改为 folderId → favoriteId。
      // 两种形态都要能读进来，否则升级后用户的手工排序会整条丢掉。
      const folder = validFolderIds.has(key)
        ? index.byId.get(key)
        : rootsByName.get(String(key).toLocaleLowerCase());
      if (!folder) return;
      const orderedIds = [];
      const taken = new Set();
      (Array.isArray(values) ? values : []).forEach((value) => {
        const byId = favoritesById.get(value);
        if (byId && byId.folderId === folder.id && !taken.has(byId.id)) {
          orderedIds.push(byId.id);
          taken.add(byId.id);
          return;
        }
        const byUrl = (favoritesByUrl.get(value) || [])
          .find((favorite) => favorite.folderId === folder.id && !taken.has(favorite.id));
        if (byUrl) {
          orderedIds.push(byUrl.id);
          taken.add(byUrl.id);
        }
      });
      if (orderedIds.length) favoriteOrder[folder.id] = orderedIds;
      if (key !== folder.id || JSON.stringify(values) !== JSON.stringify(orderedIds)) changed = true;
    });

    return {
      changed,
      folderSchemaVersion: SCHEMA_VERSION,
      folders,
      favorites,
      favoriteOrder
    };
  }

  function createFolder(folders, input = {}) {
    const normalized = normalizeFolders(folders);
    const parentId = normalizeText(input.parentId, 128) || null;
    if (parentId && !normalized.some((folder) => folder.id === parentId)) {
      return { status: 'invalid', message: 'Parent folder does not exist', folders: normalized };
    }
    const name = sanitizeFolderName(input.name);
    if (!name) return { status: 'invalid', message: 'Folder name is required', folders: normalized };
    if (findSiblingByName(normalized, parentId, name)) {
      return { status: 'conflict', message: 'A sibling folder already uses this name', folders: normalized };
    }
    // 新目录会落在父级下一层，父级路径长度即为它的父深度。
    if (parentId && getPath(normalized, parentId).length >= MAX_DEPTH) {
      return { status: 'conflict', message: `Folder depth cannot exceed ${MAX_DEPTH}`, folders: normalized };
    }
    const siblings = childrenOf(normalized, parentId);
    const folder = normalizeFolder({
      id: input.id || createId('fld'),
      parentId,
      name,
      order: Number.isFinite(Number(input.order)) ? Number(input.order) : siblings.length,
      keywords: input.keywords,
      source: input.source,
      browserFolderId: input.browserFolderId
    }, siblings.length);
    return { status: 'ok', folder, folders: [...normalized, folder] };
  }

  function updateFolder(folders, folderId, patch = {}) {
    const normalized = normalizeFolders(folders);
    const current = normalized.find((folder) => folder.id === folderId);
    if (!current) return { status: 'invalid', message: 'Folder does not exist', folders: normalized };
    const name = Object.prototype.hasOwnProperty.call(patch, 'name')
      ? sanitizeFolderName(patch.name)
      : current.name;
    if (!name) return { status: 'invalid', message: 'Folder name is required', folders: normalized };
    if (findSiblingByName(normalized, current.parentId, name, current.id)) {
      return { status: 'conflict', message: 'A sibling folder already uses this name', folders: normalized };
    }
    const next = normalized.map((folder) => folder.id === current.id
      ? {
          ...folder,
          name,
          keywords: Object.prototype.hasOwnProperty.call(patch, 'keywords')
            ? uniqueKeywords(patch.keywords)
            : folder.keywords,
          ...(Object.prototype.hasOwnProperty.call(patch, 'browserFolderId')
            ? (patch.browserFolderId
              ? { browserFolderId: normalizeText(patch.browserFolderId, 256) }
              : { browserFolderId: undefined })
            : {})
        }
      : folder);
    return { status: 'ok', folder: next.find((folder) => folder.id === current.id), folders: next };
  }

  function moveFolder(folders, folderId, targetParentId, targetOrder) {
    const normalized = normalizeFolders(folders);
    const current = normalized.find((folder) => folder.id === folderId);
    const parentId = normalizeText(targetParentId, 128) || null;
    if (!current || (parentId && !normalized.some((folder) => folder.id === parentId))) {
      return { status: 'invalid', message: 'Folder or target does not exist', folders: normalized };
    }
    if (parentId === folderId || getDescendantIds(normalized, folderId).includes(parentId)) {
      return { status: 'conflict', message: 'A folder cannot move into itself', folders: normalized };
    }
    if (findSiblingByName(normalized, parentId, current.name, current.id)) {
      return { status: 'conflict', message: 'A sibling folder already uses this name', folders: normalized };
    }
    // 移动是整棵子树搬家，要按「目标父深度 + 子树自身高度」判断，不能只看被移动节点。
    const index = createIndex(normalized);
    const subtreeHeight = index.descendantIds(folderId)
      .reduce((tallest, id) => Math.max(tallest, index.depth(id) - index.depth(folderId) + 1), 1);
    const targetParentDepth = parentId ? index.depth(parentId) : 0;
    if (targetParentDepth + subtreeHeight > MAX_DEPTH) {
      return { status: 'conflict', message: `Folder depth cannot exceed ${MAX_DEPTH}`, folders: normalized };
    }
    const siblings = childrenOf(normalized, parentId).filter((folder) => folder.id !== folderId);
    const safeOrder = Math.max(0, Math.min(siblings.length, Number.isFinite(Number(targetOrder))
      ? Number(targetOrder)
      : siblings.length));
    const orderedIds = [...siblings.map((folder) => folder.id)];
    orderedIds.splice(safeOrder, 0, folderId);
    const orderById = new Map(orderedIds.map((id, index) => [id, index]));
    const next = normalized.map((folder) => {
      if (folder.id === folderId) return { ...folder, parentId, order: orderById.get(folder.id) };
      if ((folder.parentId || null) === parentId && orderById.has(folder.id)) {
        return { ...folder, order: orderById.get(folder.id) };
      }
      return folder;
    });
    return { status: 'ok', folder: next.find((folder) => folder.id === folderId), folders: next };
  }

  function deleteFolder(folders, favorites, favoriteOrder, folderId, targetFolderId) {
    const normalized = normalizeFolders(folders);
    const current = normalized.find((folder) => folder.id === folderId);
    if (!current) {
      return { status: 'invalid', message: 'Folder is required' };
    }
    const safeFavorites = Array.isArray(favorites) ? favorites : [];
    const childFolders = childrenOf(normalized, folderId);
    const directFavorites = safeFavorites.filter((favorite) => favorite.folderId === current.id);
    const target = normalized.find((folder) => folder.id === targetFolderId);
    if (!target && !childFolders.length && !directFavorites.length) {
      const nextOrder = {};
      Object.entries(favoriteOrder && typeof favoriteOrder === 'object' ? favoriteOrder : {})
        .forEach(([key, values]) => {
          if (key !== current.id) nextOrder[key] = Array.isArray(values) ? [...values] : [];
        });
      return {
        status: 'ok',
        folders: normalized.filter((folder) => folder.id !== current.id),
        favorites: safeFavorites,
        favoriteOrder: nextOrder,
        movedFavorites: 0,
        movedFolders: 0
      };
    }
    if (!target || current.id === target.id) {
      return { status: 'invalid', message: 'Non-empty folders require a migration target' };
    }
    if (getDescendantIds(normalized, folderId).includes(target.id)) {
      return { status: 'conflict', message: 'Migration target cannot be inside the deleted folder' };
    }
    const conflict = childFolders.find((child) => (
      findSiblingByName(normalized, target.id, child.name, child.id)
    ));
    if (conflict) {
      return { status: 'conflict', message: `Rename the conflicting folder: ${conflict.name}` };
    }
    const nextFolders = normalized
      .filter((folder) => folder.id !== current.id)
      .map((folder) => folder.parentId === current.id ? { ...folder, parentId: target.id } : folder);
    const movedFavoriteIds = [];
    // 被删目录的子目录已改挂到 target，它们下面所有收藏的路径也随之变化。
    // 因此这里对全部收藏重算 category 快照，而不是只处理直接挂在被删目录下的那些，
    // 否则子目录里的收藏会长期保留旧路径文本。
    const nextIndex = createIndex(nextFolders);
    const nextFavorites = safeFavorites.map((favorite) => {
      const movedOut = favorite.folderId === current.id;
      if (movedOut) movedFavoriteIds.push(favorite.id);
      const folderId = movedOut ? target.id : favorite.folderId;
      const category = nextIndex.byId.has(folderId)
        ? nextIndex.pathLabel(folderId)
        : favorite.category;
      if (!movedOut && category === favorite.category) return favorite;
      return { ...favorite, folderId, category };
    });
    const nextOrder = {};
    Object.entries(favoriteOrder && typeof favoriteOrder === 'object' ? favoriteOrder : {})
      .forEach(([key, values]) => {
        if (key === current.id) return;
        nextOrder[key] = Array.isArray(values) ? [...values] : [];
      });
    const targetOrder = nextOrder[target.id] || [];
    nextOrder[target.id] = [...targetOrder, ...movedFavoriteIds.filter((id) => !targetOrder.includes(id))];
    return {
      status: 'ok',
      folders: nextFolders,
      favorites: nextFavorites,
      favoriteOrder: nextOrder,
      movedFavorites: movedFavoriteIds.length,
      movedFolders: childFolders.length
    };
  }

  function buildClassificationSettings(settings, folders) {
    const normalized = normalizeFolders(folders);
    const categories = normalized.map((folder) => folder.id);
    const keywordRules = {};
    normalized.forEach((folder) => {
      const effective = [];
      const path = getPath(normalized, folder.id);
      path.forEach((ancestor, index) => {
        const distance = path.length - index - 1;
        const weight = distance === 0 ? 1 : Math.pow(0.35, distance);
        ancestor.keywords.forEach((keyword) => effective.push({ keyword, weight, direct: distance === 0 }));
      });
      keywordRules[folder.id] = effective;
    });
    return { ...settings, categories, keywordRules, folders: normalized };
  }

  const api = {
    SCHEMA_VERSION,
    MAX_DEPTH,
    sanitizeFolderName,
    createId,
    uniqueKeywords,
    normalizeFolders,
    createIndex,
    childrenOf,
    getFolder,
    getPath,
    getPathLabel,
    getDescendantIds,
    findSiblingByName,
    getFallbackFolder,
    migrateState,
    createFolder,
    updateFolder,
    moveFolder,
    deleteFolder,
    buildClassificationSettings
  };

  globalScope.SmartFavFolderTree = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
