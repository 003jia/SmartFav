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
    collectExternalBookmarks,
    collectManagedBookmarks,
    isInsideSmartFavFolder,
    placeBookmarkInCategory,
    organizeBookmarks
  };

  globalScope.SmartFavBookmarks = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
