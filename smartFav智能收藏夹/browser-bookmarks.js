(function attachBrowserBookmarks(globalScope) {
  const ROOT_FOLDER_TITLE = 'SmartFav';

  // 协议白名单来自 constants.js。Node 测试里 browser-bookmarks 可能先于 constants
  // 被 require，因此这里做惰性取值并保留一个等价兜底实现（同样不依赖 URL 构造器）。
  const FALLBACK_SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):/i;

  function isSafeNavigableUrl(value) {
    const shared = globalScope.SmartFavConstants;
    if (shared && typeof shared.isSafeNavigableUrl === 'function') {
      return shared.isSafeNavigableUrl(value);
    }
    const raw = String(value || '').replace(/[\u0000-\u0020\u007f]/g, '');
    const matched = FALLBACK_SCHEME_PATTERN.exec(raw);
    return Boolean(matched) && ['http:', 'https:'].includes(`${matched[1].toLowerCase()}:`);
  }

  function callApi(api, method, ...args) {
    return new Promise((resolve, reject) => {
      if (!api || typeof api[method] !== 'function') {
        reject(new Error(`bookmarks.${method} is unavailable`));
        return;
      }
      api[method](...args, (result) => {
        const runtimeError = typeof chrome !== 'undefined'
          && chrome.runtime
          && chrome.runtime.lastError;
        if (runtimeError) {
          reject(new Error(runtimeError.message));
          return;
        }
        resolve(result);
      });
    });
  }

  async function findRoot(api) {
    const matches = await callApi(api, 'search', { title: ROOT_FOLDER_TITLE });
    return (matches || []).find((item) => !item.url && item.title === ROOT_FOLDER_TITLE) || null;
  }

  async function findRoots(api) {
    const matches = await callApi(api, 'search', { title: ROOT_FOLDER_TITLE });
    return (matches || []).filter(
      (item) => !item.url && item.title === ROOT_FOLDER_TITLE
    );
  }

  async function findOrCreateRoot(api) {
    const existing = await findRoot(api);
    if (existing) return existing;
    return callApi(api, 'create', { title: ROOT_FOLDER_TITLE });
  }

  async function findOrCreateCategory(api, rootId, category) {
    const children = await callApi(api, 'getChildren', rootId);
    const existing = (children || []).find((item) => !item.url && item.title === category);
    if (existing) return existing;
    return callApi(api, 'create', { parentId: rootId, title: category });
  }

  async function findFolderById(api, folderId) {
    const id = String(folderId || '').trim();
    if (!id) return null;
    try {
      const matches = await callApi(api, 'get', id);
      const node = matches && matches[0];
      return node && !node.url ? node : null;
    } catch (_error) {
      return null;
    }
  }

  // 受管范围断言版本：只返回确实位于某个 SmartFav 根目录之下的文件夹节点。
  // folder.browserFolderId 来自本地 storage，是不可信输入——状态损坏、导入了旧备份、
  // 或该 id 被浏览器复用给了用户自己的文件夹时，直接拿它去 update/move/remove
  // 会改动甚至删除用户的非托管目录。改名/移动/删除三类写操作必须走这里。
  // 返回 null 时调用方应清空本地绑定，让下一次同步按路径重建。
  async function findManagedFolderById(api, folderId) {
    const node = await findFolderById(api, folderId);
    if (!node) return null;
    // 没有 parentId 的是浏览器根节点（书签栏/其他收藏夹），任何情况下都不能改。
    if (!node.parentId) return null;
    return await isInsideSmartFavFolder(api, node) ? node : null;
  }

  function getLocalFolderPath(folders, folderId) {
    const list = Array.isArray(folders) ? folders : [];
    const byId = new Map(list.map((folder) => [String(folder.id), folder]));
    const path = [];
    const visited = new Set();
    let current = byId.get(String(folderId || ''));
    while (current && !visited.has(String(current.id))) {
      path.unshift(current);
      visited.add(String(current.id));
      current = current.parentId ? byId.get(String(current.parentId)) : null;
    }
    return path;
  }

  async function findOrCreateFolderPath(api, rootId, path, options = {}) {
    let parentId = rootId;
    let current = null;
    const created = [];
    for (const segment of (Array.isArray(path) ? path : [])) {
      const name = String(segment && (segment.name || segment.title) || '').trim();
      if (!name) continue;
      const bound = segment.browserFolderId
        ? await findFolderById(api, segment.browserFolderId)
        : null;
      if (bound && String(bound.parentId || '') === String(parentId)) {
        current = bound;
      } else {
        const children = await callApi(api, 'getChildren', parentId);
        current = (children || []).find((node) => !node.url && node.title === name) || null;
        if (!current && options.create !== false) {
          current = await callApi(api, 'create', {
            parentId,
            title: name,
            ...(Number.isFinite(Number(segment.order)) ? { index: Number(segment.order) } : {})
          });
          created.push({ folderId: segment.id || '', browserFolderId: current.id });
        }
      }
      if (!current) return { status: 'missing', folder: null, created };
      parentId = current.id;
    }
    return { status: current ? 'ok' : 'missing', folder: current, created };
  }

  async function resolveFavoriteFolder(api, favorite, folders, options = {}) {
    const root = options.root || await findOrCreateRoot(api);
    const path = getLocalFolderPath(folders, favorite && favorite.folderId);
    if (path.length) return findOrCreateFolderPath(api, root.id, path, options);
    const category = String(favorite && favorite.category || 'Other').trim() || 'Other';
    const folder = await findOrCreateCategory(api, root.id, category);
    return { status: 'ok', folder, created: [] };
  }

  function flattenBookmarks(nodes, result = []) {
    (nodes || []).forEach((node) => {
      if (node.url) result.push(node);
      if (node.children) flattenBookmarks(node.children, result);
    });
    return result;
  }

  async function findUrlMatches(api, url) {
    const tree = await callApi(api, 'getTree');
    return flattenBookmarks(tree).filter((item) => item.url === url);
  }

  async function writeFavorite(favorite, settings = {}, api, context = {}) {
    if (!settings.browserBookmarksEnabled) return { status: 'disabled' };
    if (!api) return { status: 'unavailable' };

    const root = await findOrCreateRoot(api);
    const resolved = await resolveFavoriteFolder(api, favorite, context.folders, { root });
    if (!resolved.folder) return { status: 'missing' };
    const categoryFolder = resolved.folder;
    const writeMode = settings.bookmarkWriteMode === 'add' ? 'add' : 'overwrite';

    if (writeMode === 'overwrite') {
      const [matches, subtree] = await Promise.all([
        findUrlMatches(api, favorite.url),
        callApi(api, 'getSubTree', root.id)
      ]);
      const managedIds = new Set(flattenBookmarks(subtree).map((item) => item.id));
      const managedMatches = matches.filter((item) => managedIds.has(item.id));
      const existing = managedMatches[0];
      if (existing) {
        await callApi(api, 'update', existing.id, {
          title: favorite.title || favorite.url,
          url: favorite.url
        });
        if (existing.parentId !== categoryFolder.id) {
          await callApi(api, 'move', existing.id, { parentId: categoryFolder.id });
        }
        const duplicates = managedMatches.filter((item) => item.id !== existing.id);
        for (const duplicate of duplicates) {
          await callApi(api, 'remove', duplicate.id);
        }
        return {
          status: 'updated',
          id: existing.id,
          removedDuplicates: duplicates.length,
          createdFolders: resolved.created
        };
      }
    }

    const created = await callApi(api, 'create', {
      parentId: categoryFolder.id,
      title: favorite.title || favorite.url,
      url: favorite.url
    });
    return { status: 'created', id: created.id, createdFolders: resolved.created };
  }

  // 开启浏览器收藏同步后，只删除 SmartFav 受管目录内的同网址记录。
  // 用户在其他浏览器文件夹中手工保存的同网址收藏不属于 SmartFav，不应误删。
  async function removeFavorite(url, settings = {}, api) {
    if (!settings.browserBookmarksEnabled) return { status: 'disabled', removed: 0 };
    if (!api) return { status: 'unavailable', removed: 0 };

    const normalizedUrl = String(url || '').trim();
    if (!normalizedUrl) return { status: 'invalid', removed: 0 };
    const matches = (await collectManagedBookmarks(api))
      .filter((item) => item.url === normalizedUrl);
    for (const match of matches) {
      await callApi(api, 'remove', match.id);
    }
    return { status: 'removed', removed: matches.length };
  }

  async function removeFavoriteRecord(favorite, settings = {}, api) {
    if (!settings.browserBookmarksEnabled) return { status: 'disabled', removed: 0 };
    if (!api || !favorite) return { status: 'unavailable', removed: 0 };
    if (favorite.browserBookmarkId) {
      try {
        const nodes = await callApi(api, 'get', favorite.browserBookmarkId);
        const node = nodes && nodes[0];
        if (node && node.url === favorite.url && await isInsideSmartFavFolder(api, node)) {
          await callApi(api, 'remove', node.id);
          return { status: 'removed', removed: 1 };
        }
      } catch (_error) {
        // 书签 ID 可能在浏览器导入或恢复后变化，继续按 URL 回退。
      }
    }
    if (settings.bookmarkWriteMode === 'add') {
      const match = (await collectManagedBookmarks(api))
        .find((item) => item.url === favorite.url);
      if (!match) return { status: 'missing', removed: 0 };
      await callApi(api, 'remove', match.id);
      return { status: 'removed', removed: 1 };
    }
    return removeFavorite(favorite.url, settings, api);
  }

  async function deduplicateManagedUrl(api, url, keepId) {
    if (!api) return { status: 'unavailable', removed: 0 };
    const matches = (await collectManagedBookmarks(api)).filter((node) => (
      node.url === String(url || '') && String(node.id) !== String(keepId || '')
    ));
    for (const match of matches) await callApi(api, 'remove', match.id);
    return { status: 'ok', removed: matches.length };
  }

  // 分类规则更新后，仅移动 SmartFav 受管目录中的已有收藏。
  // 不创建缺失收藏，也不触碰用户在其他浏览器文件夹中的同网址记录。
  async function syncManagedCategories(favorites, settings = {}, api) {
    if (!settings.browserBookmarksEnabled) return { status: 'disabled', moved: 0 };
    if (!api) return { status: 'unavailable', moved: 0 };

    const managed = await collectManagedBookmarks(api);
    if (!managed.length) return { status: 'ok', moved: 0 };
    const desiredByUrl = new Map(
      (favorites || [])
        .filter((favorite) => favorite && favorite.url)
        .map((favorite) => [favorite.url, favorite])
    );
    const root = await findOrCreateRoot(api);
    const categoryFolders = new Map();
    let moved = 0;

    for (const node of managed) {
      const favorite = desiredByUrl.get(node.url);
      if (!favorite) continue;
      const category = String(favorite.category || 'Other').trim() || 'Other';
      if (!categoryFolders.has(category)) {
        categoryFolders.set(
          category,
          await findOrCreateCategory(api, root.id, category)
        );
      }
      const targetFolder = categoryFolders.get(category);
      if (node.parentId === targetFolder.id) continue;
      await callApi(api, 'move', node.id, { parentId: targetFolder.id });
      moved += 1;
    }
    return { status: 'ok', moved };
  }

  // 将 SmartFav 本地收藏跨分类移动时，只移动浏览器 SmartFav 目录内的同网址记录。
  // 同网址存在多个受管副本时全部移动；外部普通收藏不受影响。
  async function moveManagedFavorite(url, targetCategory, settings = {}, api) {
    if (!settings.browserBookmarksEnabled) {
      return { status: 'disabled', moved: 0, matched: 0, missing: 0 };
    }
    if (!api) {
      return { status: 'unavailable', moved: 0, matched: 0, missing: 0 };
    }

    const normalizedUrl = String(url || '').trim();
    const category = String(targetCategory || '').trim();
    if (!normalizedUrl || !category) {
      return { status: 'invalid', moved: 0, matched: 0, missing: 0 };
    }

    const matches = (await collectManagedBookmarks(api))
      .filter((node) => node.url === normalizedUrl);
    if (!matches.length) {
      return { status: 'missing', moved: 0, matched: 0, missing: 1 };
    }

    const root = await findOrCreateRoot(api);
    const targetFolder = await findOrCreateCategory(api, root.id, category);
    let moved = 0;
    for (const node of matches) {
      if (node.parentId === targetFolder.id) continue;
      await callApi(api, 'move', node.id, { parentId: targetFolder.id });
      moved += 1;
    }
    return {
      status: 'ok',
      moved,
      matched: matches.length,
      missing: 0,
      category
    };
  }

  function normalizeOrderedValues(values) {
    const seen = new Set();
    return (Array.isArray(values) ? values : [])
      .map((value) => String(value || '').trim())
      .filter((value) => {
        if (!value || seen.has(value)) return false;
        seen.add(value);
        return true;
      });
  }

  async function moveNodesToFront(api, parentId, orderedNodes) {
    let moved = 0;
    for (let index = 0; index < orderedNodes.length; index += 1) {
      const node = orderedNodes[index];
      const children = await callApi(api, 'getChildren', parentId);
      const currentIndex = (children || []).findIndex((item) => item.id === node.id);
      if (currentIndex < 0 || currentIndex === index) continue;
      await callApi(api, 'move', node.id, { parentId, index });
      moved += 1;
    }
    return moved;
  }

  // 手动调整分类顺序后，只重排 SmartFav 根目录下已经存在的同名分类文件夹。
  // 不创建空文件夹，也不改变未知文件夹或普通书签之间的相对顺序。
  async function reorderManagedCategories(categories, settings = {}, api) {
    if (!settings.browserBookmarksEnabled) {
      return { status: 'disabled', moved: 0, matched: 0, missing: 0 };
    }
    if (!api) {
      return { status: 'unavailable', moved: 0, matched: 0, missing: 0 };
    }

    const orderedCategories = normalizeOrderedValues(categories);
    const root = await findRoot(api);
    if (!root) {
      return {
        status: 'missing',
        moved: 0,
        matched: 0,
        missing: orderedCategories.length
      };
    }

    const children = await callApi(api, 'getChildren', root.id);
    const firstFolderByTitle = new Map();
    (children || []).forEach((node) => {
      if (!node.url && !firstFolderByTitle.has(node.title)) {
        firstFolderByTitle.set(node.title, node);
      }
    });
    const orderedNodes = orderedCategories
      .map((category) => firstFolderByTitle.get(category))
      .filter(Boolean);
    const moved = await moveNodesToFront(api, root.id, orderedNodes);
    return {
      status: 'ok',
      moved,
      matched: orderedNodes.length,
      missing: orderedCategories.length - orderedNodes.length
    };
  }

  // 手动调整分类内书签顺序后，只重排该分类文件夹中已经存在的同网址书签。
  // 同网址有多个副本时保留全部副本及其相对顺序；未匹配书签和子文件夹保留在其后。
  async function reorderManagedFavorites(category, orderedUrls, settings = {}, api) {
    if (!settings.browserBookmarksEnabled) {
      return { status: 'disabled', moved: 0, matched: 0, missing: 0 };
    }
    if (!api) {
      return { status: 'unavailable', moved: 0, matched: 0, missing: 0 };
    }

    const normalizedCategory = String(category || '').trim();
    const urls = normalizeOrderedValues(orderedUrls);
    if (!normalizedCategory || !urls.length) {
      return { status: 'ok', moved: 0, matched: 0, missing: urls.length };
    }

    const root = await findRoot(api);
    if (!root) {
      return { status: 'missing', moved: 0, matched: 0, missing: urls.length };
    }
    const rootChildren = await callApi(api, 'getChildren', root.id);
    const categoryFolder = (rootChildren || [])
      .find((node) => !node.url && node.title === normalizedCategory);
    if (!categoryFolder) {
      return { status: 'missing', moved: 0, matched: 0, missing: urls.length };
    }

    const children = await callApi(api, 'getChildren', categoryFolder.id);
    const requestedUrls = new Set(urls);
    const nodesByUrl = new Map();
    (children || []).forEach((node) => {
      if (!node.url || !requestedUrls.has(node.url)) return;
      const matches = nodesByUrl.get(node.url) || [];
      matches.push(node);
      nodesByUrl.set(node.url, matches);
    });
    const orderedNodes = urls.flatMap((url) => nodesByUrl.get(url) || []);
    const moved = await moveNodesToFront(api, categoryFolder.id, orderedNodes);
    const matched = urls.filter((url) => nodesByUrl.has(url)).length;
    return {
      status: 'ok',
      moved,
      matched,
      missing: urls.length - matched
    };
  }

  async function reorderManagedFavoriteRecords(
    folderId,
    orderedFavoriteIds,
    favorites,
    folders,
    settings = {},
    api
  ) {
    if (!settings.browserBookmarksEnabled) {
      return { status: 'disabled', moved: 0, matched: 0, missing: 0 };
    }
    if (!api) return { status: 'unavailable', moved: 0, matched: 0, missing: 0 };
    const folder = (folders || []).find((item) => item.id === folderId);
    if (!folder) return { status: 'invalid', moved: 0, matched: 0, missing: 0 };
    const root = await findOrCreateRoot(api);
    const resolved = await findOrCreateFolderPath(api, root.id, getLocalFolderPath(folders, folderId));
    if (!resolved.folder) return { status: 'missing', moved: 0, matched: 0, missing: orderedFavoriteIds.length };
    const children = await callApi(api, 'getChildren', resolved.folder.id);
    const favoriteById = new Map((favorites || []).map((favorite) => [favorite.id, favorite]));
    const usedNodeIds = new Set();
    const orderedNodes = [];
    (orderedFavoriteIds || []).forEach((favoriteId) => {
      const favorite = favoriteById.get(favoriteId);
      if (!favorite) return;
      let node = favorite.browserBookmarkId
        ? (children || []).find((item) => item.id === favorite.browserBookmarkId)
        : null;
      if (!node) {
        node = (children || []).find((item) => (
          item.url === favorite.url && !usedNodeIds.has(item.id)
        ));
      }
      if (!node) return;
      usedNodeIds.add(node.id);
      orderedNodes.push(node);
    });
    const moved = await moveNodesToFront(api, resolved.folder.id, orderedNodes);
    return {
      status: 'ok',
      moved,
      matched: orderedNodes.length,
      missing: Math.max(0, orderedFavoriteIds.length - orderedNodes.length)
    };
  }

  async function syncManagedOrder(order = {}, settings = {}, api) {
    if (!settings.browserBookmarksEnabled) {
      return {
        status: 'disabled',
        moved: 0,
        matched: 0,
        missing: 0,
        categoryFoldersMoved: 0,
        favoritesMoved: 0
      };
    }
    if (!api) {
      return {
        status: 'unavailable',
        moved: 0,
        matched: 0,
        missing: 0,
        categoryFoldersMoved: 0,
        favoritesMoved: 0
      };
    }

    const categoryResult = Array.isArray(order.categories)
      ? await reorderManagedCategories(order.categories, settings, api)
      : null;
    const favoriteResult = order.category && Array.isArray(order.orderedUrls)
      ? await reorderManagedFavorites(order.category, order.orderedUrls, settings, api)
      : null;
    const results = [categoryResult, favoriteResult].filter(Boolean);
    if (!results.length) {
      return {
        status: 'invalid',
        moved: 0,
        matched: 0,
        missing: 0,
        categoryFoldersMoved: 0,
        favoritesMoved: 0
      };
    }
    const status = results.some((result) => result.status === 'unavailable')
      ? 'unavailable'
      : results.every((result) => result.status === 'missing')
        ? 'missing'
        : results.some((result) => result.status === 'disabled')
          ? 'disabled'
          : 'ok';
    const categoryFoldersMoved = categoryResult ? categoryResult.moved : 0;
    const favoritesMoved = favoriteResult ? favoriteResult.moved : 0;
    return {
      status,
      moved: categoryFoldersMoved + favoritesMoved,
      matched: results.reduce((total, result) => total + result.matched, 0),
      missing: results.reduce((total, result) => total + result.missing, 0),
      categoryFoldersMoved,
      favoritesMoved
    };
  }

  // 收集浏览器收藏夹中所有不在 SmartFav 文件夹内的书签
  async function collectExternalBookmarks(api) {
    const tree = await callApi(api, 'getTree');
    const roots = await findRoots(api);
    const rootIds = new Set(roots.map((root) => root.id));
    const result = [];
    (function walk(nodes, insideRoot) {
      (nodes || []).forEach((node) => {
        const inRoot = insideRoot || rootIds.has(node.id);
        if (node.url && !inRoot) result.push(node);
        if (node.children) walk(node.children, inRoot);
      });
    })(tree, false);
    return result;
  }

  // 读取 SmartFav 受管目录的完整树；使用迭代遍历与 visited 防止异常树导致死循环。
  async function collectManagedStructure(api, fallbackCategory = 'Other') {
    const roots = await findRoots(api);
    const folders = [];
    const bookmarks = [];
    for (const root of roots) {
      const subtree = await callApi(api, 'getSubTree', root.id);
      const rootNode = subtree && subtree[0];
      if (!rootNode) continue;
      const queue = (rootNode.children || []).map((node, index) => ({
        node,
        parentBrowserFolderId: root.id,
        path: [],
        index
      }));
      const visited = new Set();
      while (queue.length) {
        const current = queue.shift();
        const node = current.node;
        const key = String(node && node.id || '');
        if (!node || !key || visited.has(key)) continue;
        visited.add(key);
        if (node.url) {
          const path = current.path;
          bookmarks.push({
            ...node,
            browserBookmarkId: node.id,
            browserFolderId: path.length ? path[path.length - 1].browserFolderId : '',
            folderPath: path.map((segment) => segment.name),
            category: path.length
              ? path.map((segment) => segment.name).join(' › ')
              : fallbackCategory
          });
          continue;
        }
        const segment = {
          browserFolderId: node.id,
          parentBrowserFolderId: current.parentBrowserFolderId,
          name: String(node.title || fallbackCategory).trim() || fallbackCategory,
          order: Number.isFinite(Number(node.index)) ? Number(node.index) : current.index
        };
        const path = [...current.path, segment];
        folders.push({ ...segment, path: path.map((item) => item.name) });
        (node.children || []).forEach((child, index) => {
          queue.push({
            node: child,
            parentBrowserFolderId: node.id,
            path,
            index
          });
        });
      }
    }
    return { roots, folders, bookmarks };
  }

  // 恢复已经整理进 SmartFav 的书签，并保留最深层完整路径。
  async function collectManagedBookmarks(api, fallbackCategory = 'Other') {
    const structure = await collectManagedStructure(api, fallbackCategory);
    return structure.bookmarks;
  }

  // 判断某个书签节点是否位于 SmartFav 文件夹内（用于忽略插件自己写入的记录）
  async function isInsideSmartFavFolder(api, node) {
    const roots = await findRoots(api);
    const rootIds = new Set(roots.map((root) => root.id));
    if (!rootIds.size || !node) return false;
    let parentId = node.parentId;
    const visited = new Set();
    while (parentId && !visited.has(parentId)) {
      if (rootIds.has(parentId)) return true;
      visited.add(parentId);
      let parents;
      try {
        parents = await callApi(api, 'get', parentId);
      } catch (_) {
        return false;
      }
      const parent = parents && parents[0];
      if (!parent) return false;
      parentId = parent.parentId;
    }
    return false;
  }

  // 读取一个浏览器书签当前所在的 SmartFav 最深层目录及完整路径。
  async function getManagedBookmarkInfo(api, bookmarkId) {
    if (!api) return { status: 'unavailable', node: null, category: '' };
    const nodes = await callApi(api, 'get', bookmarkId);
    const node = nodes && nodes[0];
    if (!node || !node.url) {
      return { status: 'unsupported', node: node || null, category: '' };
    }

    const roots = await findRoots(api);
    const rootIds = new Set(roots.map((root) => root.id));
    if (!rootIds.size) return { status: 'outside', node, category: '' };

    let current = node;
    const folderPath = [];
    const visited = new Set([String(node.id)]);
    while (current && current.parentId && !visited.has(String(current.parentId))) {
      const parents = await callApi(api, 'get', current.parentId);
      const parent = parents && parents[0];
      if (!parent) break;
      if (rootIds.has(parent.id)) {
        const category = folderPath.join(' › ');
        return category
          ? {
              status: 'ok',
              node,
              category,
              folderPath: [...folderPath],
              browserFolderId: current.url ? '' : current.id
            }
          : { status: 'root', node, category: '' };
      }
      if (!parent.url) folderPath.unshift(String(parent.title || '').trim());
      visited.add(String(parent.id));
      current = parent;
    }
    return { status: 'outside', node, category: '' };
  }

  // 将浏览器中已存在的书签移动到 SmartFav/分类 文件夹
  async function placeBookmarkInCategory(api, bookmarkId, category) {
    if (!api) return { status: 'unavailable' };
    const root = await findOrCreateRoot(api);
    const normalized = String(category || 'Other').trim() || 'Other';
    const folder = await findOrCreateCategory(api, root.id, normalized);
    await callApi(api, 'move', bookmarkId, { parentId: folder.id });
    return { status: 'moved', id: bookmarkId };
  }

  async function placeBookmarkInFolder(api, bookmarkId, folderId, folders) {
    if (!api) return { status: 'unavailable' };
    const root = await findOrCreateRoot(api);
    const path = getLocalFolderPath(folders, folderId);
    if (!path.length) return { status: 'invalid' };
    const resolved = await findOrCreateFolderPath(api, root.id, path);
    if (!resolved.folder) return { status: 'missing' };
    await callApi(api, 'move', bookmarkId, { parentId: resolved.folder.id });
    return {
      status: 'moved',
      id: bookmarkId,
      browserFolderId: resolved.folder.id,
      createdFolders: resolved.created
    };
  }

  async function moveManagedFavoriteToFolder(favorite, folders, settings = {}, api) {
    if (!settings.browserBookmarksEnabled) {
      return { status: 'disabled', moved: 0, matched: 0, missing: 0 };
    }
    if (!api) return { status: 'unavailable', moved: 0, matched: 0, missing: 0 };
    const root = await findOrCreateRoot(api);
    const resolved = await resolveFavoriteFolder(api, favorite, folders, { root });
    if (!resolved.folder) return { status: 'missing', moved: 0, matched: 0, missing: 1 };
    let matches = [];
    if (favorite.browserBookmarkId) {
      try {
        const nodes = await callApi(api, 'get', favorite.browserBookmarkId);
        matches = (nodes || []).filter((node) => node && node.url === favorite.url);
      } catch (_error) {
        matches = [];
      }
    }
    if (!matches.length) {
      matches = (await collectManagedBookmarks(api)).filter((node) => node.url === favorite.url);
      if (settings.bookmarkWriteMode === 'add') matches = matches.slice(0, 1);
    }
    if (!matches.length) return { status: 'missing', moved: 0, matched: 0, missing: 1 };
    let moved = 0;
    for (const node of matches) {
      if (String(node.parentId) === String(resolved.folder.id)) continue;
      await callApi(api, 'move', node.id, { parentId: resolved.folder.id });
      moved += 1;
    }
    return {
      status: 'ok',
      moved,
      matched: matches.length,
      missing: 0,
      browserFolderId: resolved.folder.id,
      createdFolders: resolved.created
    };
  }

  async function syncManagedFolders(favorites, folders, settings = {}, api) {
    if (!settings.browserBookmarksEnabled) return { status: 'disabled', moved: 0 };
    if (!api) return { status: 'unavailable', moved: 0 };
    let moved = 0;
    let missing = 0;
    for (const favorite of (Array.isArray(favorites) ? favorites : [])) {
      const result = await moveManagedFavoriteToFolder(favorite, folders, settings, api);
      moved += result.moved || 0;
      if (result.status === 'missing') missing += 1;
    }
    return { status: missing && !moved ? 'missing' : 'ok', moved, missing };
  }

  async function syncFolderNode(folder, folders, settings = {}, api) {
    if (!settings.browserBookmarksEnabled) return { status: 'disabled' };
    if (!api || !folder) return { status: 'unavailable' };
    const root = await findOrCreateRoot(api);
    // 改名 / 移动前必须确认这个节点真的在 SmartFav 目录内。
    const existing = await findManagedFolderById(api, folder.browserFolderId);
    if (existing) {
      const parentPath = folder.parentId ? getLocalFolderPath(folders, folder.parentId) : [];
      const parentResult = parentPath.length
        ? await findOrCreateFolderPath(api, root.id, parentPath)
        : { status: 'ok', folder: root, created: [] };
      if (!parentResult.folder) return { status: 'missing' };
      if (existing.title !== folder.name) {
        await callApi(api, 'update', existing.id, { title: folder.name });
      }
      if (
        String(existing.parentId || '') !== String(parentResult.folder.id)
        || Number(existing.index) !== Math.max(0, Number(folder.order) || 0)
      ) {
        await callApi(api, 'move', existing.id, {
          parentId: parentResult.folder.id,
          index: Math.max(0, Number(folder.order) || 0)
        });
      }
      return {
        status: 'ok',
        browserFolderId: existing.id,
        createdFolders: parentResult.created || []
      };
    }
    const path = getLocalFolderPath(folders, folder.id);
    const resolved = await findOrCreateFolderPath(api, root.id, path);
    if (!resolved.folder) return { status: 'missing' };
    if (resolved.folder.title !== folder.name) {
      await callApi(api, 'update', resolved.folder.id, { title: folder.name });
    }
    return {
      status: 'ok',
      browserFolderId: resolved.folder.id,
      createdFolders: resolved.created
    };
  }

  async function moveFolderNode(folder, folders, settings = {}, api) {
    if (!settings.browserBookmarksEnabled) return { status: 'disabled' };
    if (!api || !folder) return { status: 'unavailable' };
    const node = await findManagedFolderById(api, folder.browserFolderId);
    const root = await findOrCreateRoot(api);
    const parentPath = folder.parentId ? getLocalFolderPath(folders, folder.parentId) : [];
    const parentResult = parentPath.length
      ? await findOrCreateFolderPath(api, root.id, parentPath)
      : { status: 'ok', folder: root, created: [] };
    if (!parentResult.folder) return { status: 'missing' };
    const target = node || (await syncFolderNode(folder, folders, settings, api)).browserFolderId;
    const targetNode = typeof target === 'string'
      ? await findManagedFolderById(api, target)
      : target;
    if (!targetNode) return { status: 'missing' };
    await callApi(api, 'move', targetNode.id, {
      parentId: parentResult.folder.id,
      index: Math.max(0, Number(folder.order) || 0)
    });
    return { status: 'ok', browserFolderId: targetNode.id };
  }

  async function removeFolderNode(folder, settings = {}, api) {
    if (!settings.browserBookmarksEnabled) return { status: 'disabled' };
    if (!api || !folder || !folder.browserFolderId) return { status: 'missing' };
    // 删除是不可撤销的，这里的受管范围校验尤其关键。
    const node = await findManagedFolderById(api, folder.browserFolderId);
    if (!node) return { status: 'missing' };
    const children = await callApi(api, 'getChildren', node.id);
    if (children && children.length) return { status: 'conflict' };
    await callApi(api, 'remove', node.id);
    return { status: 'ok' };
  }

  // 整理浏览器收藏夹：读取全部书签并分类；
  // 仅当 settings.bookmarkOrganizeEnabled 为 true 时才把书签移动进 SmartFav/分类 文件夹
  async function organizeBookmarks(settings = {}, api, classify, context = {}) {
    if (!api || typeof classify !== 'function') {
      return { status: 'unavailable', favorites: [], moved: 0 };
    }
    const nodes = await collectExternalBookmarks(api);
    const favorites = nodes
      // 书签栏里可能存在 bookmarklet（javascript:...）等非网页条目。
      // 它们不该被当成普通收藏导入，否则会出现在收藏列表里且可被点击执行。
      .filter((node) => isSafeNavigableUrl(node.url))
      .map((node) => {
      const suggestion = classify(
        { title: node.title || node.url, url: node.url, description: '' },
        settings
      );
      return {
        bookmarkId: node.id,
        url: node.url,
        title: node.title || node.url,
        favicon: '',
        description: '',
        category: suggestion.category,
        folderId: suggestion.folderId || '',
        tags: suggestion.tags || [],
        summary: suggestion.summary || '',
        classificationSource: 'local',
        createdAt: node.dateAdded || Date.now()
      };
    });

    let moved = 0;
    if (settings.bookmarkOrganizeEnabled) {
      const root = await findOrCreateRoot(api);
      for (const favorite of favorites) {
        const resolved = await resolveFavoriteFolder(api, favorite, context.folders, { root });
        if (!resolved.folder) continue;
        await callApi(api, 'move', favorite.bookmarkId, { parentId: resolved.folder.id });
        moved += 1;
      }
    }
    return { status: 'ok', favorites, moved };
  }

  const api = {
    ROOT_FOLDER_TITLE,
    findRoot,
    findRoots,
    findOrCreateRoot,
    findFolderById,
    findOrCreateFolderPath,
    resolveFavoriteFolder,
    flattenBookmarks,
    findUrlMatches,
    writeFavorite,
    removeFavorite,
    removeFavoriteRecord,
    deduplicateManagedUrl,
    syncManagedCategories,
    moveManagedFavorite,
    reorderManagedCategories,
    reorderManagedFavorites,
    reorderManagedFavoriteRecords,
    syncManagedOrder,
    collectExternalBookmarks,
    collectManagedStructure,
    collectManagedBookmarks,
    isInsideSmartFavFolder,
    getManagedBookmarkInfo,
    placeBookmarkInCategory,
    placeBookmarkInFolder,
    moveManagedFavoriteToFolder,
    syncManagedFolders,
    syncFolderNode,
    moveFolderNode,
    removeFolderNode,
    organizeBookmarks
  };

  globalScope.SmartFavBookmarks = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
