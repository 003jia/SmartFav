(function attachBrowserBookmarks(globalScope) {
  const ROOT_FOLDER_TITLE = 'SmartFav';

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

  async function writeFavorite(favorite, settings = {}, api) {
    if (!settings.browserBookmarksEnabled) return { status: 'disabled' };
    if (!api) return { status: 'unavailable' };

    const root = await findOrCreateRoot(api);
    const category = String(favorite.category || 'Other').trim() || 'Other';
    const categoryFolder = await findOrCreateCategory(api, root.id, category);
    const writeMode = settings.bookmarkWriteMode === 'add' ? 'add' : 'overwrite';

    if (writeMode === 'overwrite') {
      const [matches, subtree] = await Promise.all([
        findUrlMatches(api, favorite.url),
        callApi(api, 'getSubTree', root.id)
      ]);
      const managedIds = new Set(flattenBookmarks(subtree).map((item) => item.id));
      const existing = matches.find((item) => managedIds.has(item.id)) || matches[0];
      if (existing) {
        await callApi(api, 'update', existing.id, {
          title: favorite.title || favorite.url,
          url: favorite.url
        });
        if (existing.parentId !== categoryFolder.id) {
          await callApi(api, 'move', existing.id, { parentId: categoryFolder.id });
        }
        const duplicates = matches.filter((item) => item.id !== existing.id);
        for (const duplicate of duplicates) {
          await callApi(api, 'remove', duplicate.id);
        }
        return {
          status: 'updated',
          id: existing.id,
          removedDuplicates: duplicates.length
        };
      }
    }

    const created = await callApi(api, 'create', {
      parentId: categoryFolder.id,
      title: favorite.title || favorite.url,
      url: favorite.url
    });
    return { status: 'created', id: created.id };
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

  // 恢复旧版本已经整理进 SmartFav/分类 的书签。
  // 分类文件夹名称是用户之前的明确选择，因此恢复时保持原分类，不重新猜测。
  async function collectManagedBookmarks(api, fallbackCategory = 'Other') {
    const roots = await findRoots(api);
    const result = [];
    for (const root of roots) {
      const subtree = await callApi(api, 'getSubTree', root.id);
      const rootNode = subtree && subtree[0];
      if (!rootNode) continue;

      (function walk(nodes, category) {
        (nodes || []).forEach((node) => {
          if (node.url) {
            result.push({
              ...node,
              category: category || fallbackCategory
            });
            return;
          }
          const nextCategory = category || node.title || fallbackCategory;
          if (node.children) walk(node.children, nextCategory);
        });
      })(rootNode.children, '');
    }
    return result;
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

  // 读取一个浏览器书签当前所在的 SmartFav 顶层分类。
  // 书签可位于分类内的子文件夹中，但直接放在 SmartFav 根目录时不视为有效分类。
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
    const visited = new Set([String(node.id)]);
    while (current && current.parentId && !visited.has(String(current.parentId))) {
      const parents = await callApi(api, 'get', current.parentId);
      const parent = parents && parents[0];
      if (!parent) break;
      if (rootIds.has(parent.id)) {
        const category = current.url ? '' : String(current.title || '').trim();
        return category
          ? { status: 'ok', node, category }
          : { status: 'root', node, category: '' };
      }
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

  // 整理浏览器收藏夹：读取全部书签并分类；
  // 仅当 settings.bookmarkOrganizeEnabled 为 true 时才把书签移动进 SmartFav/分类 文件夹
  async function organizeBookmarks(settings = {}, api, classify) {
    if (!api || typeof classify !== 'function') {
      return { status: 'unavailable', favorites: [], moved: 0 };
    }
    const nodes = await collectExternalBookmarks(api);
    const favorites = nodes.map((node) => {
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
        const folder = await findOrCreateCategory(api, root.id, favorite.category);
        await callApi(api, 'move', favorite.bookmarkId, { parentId: folder.id });
        moved += 1;
      }
    }
    return { status: 'ok', favorites, moved };
  }

  const api = {
    ROOT_FOLDER_TITLE,
    flattenBookmarks,
    findUrlMatches,
    writeFavorite,
    removeFavorite,
    syncManagedCategories,
    moveManagedFavorite,
    reorderManagedCategories,
    reorderManagedFavorites,
    syncManagedOrder,
    collectExternalBookmarks,
    collectManagedBookmarks,
    isInsideSmartFavFolder,
    getManagedBookmarkInfo,
    placeBookmarkInCategory,
    organizeBookmarks
  };

  globalScope.SmartFavBookmarks = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
