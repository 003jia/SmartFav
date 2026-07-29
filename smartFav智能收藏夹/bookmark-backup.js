(function attachBookmarkBackup(globalScope) {
  const FORMAT = 'smartfav-bookmark-restore';
  const SCHEMA_VERSION = 1;
  const MAX_RESTORE_POINTS = 3;
  const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
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

  function normalizeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeText(value, maximum = 2048) {
    return String(value == null ? '' : value).slice(0, maximum);
  }

  function normalizeFolder(node) {
    return {
      id: normalizeText(node.id, 256),
      title: normalizeText(node.title, 512),
      parentId: normalizeText(node.parentId, 256),
      index: normalizeNumber(node.index, 0),
      ...(node.folderType ? { folderType: normalizeText(node.folderType, 64) } : {})
    };
  }

  function flattenTree(nodes, result = []) {
    (nodes || []).forEach((node) => {
      if (!node) return;
      result.push(node);
      if (node.children) flattenTree(node.children, result);
    });
    return result;
  }

  function buildTreeAnalysis(tree) {
    const nodes = flattenTree(tree);
    const nodesById = new Map(nodes.map((node) => [String(node.id), node]));
    const smartFavRootIds = new Set(
      nodes
        .filter((node) => !node.url && node.title === ROOT_FOLDER_TITLE)
        .map((node) => String(node.id))
    );

    function getFolderPath(node) {
      const path = [];
      let parentId = node && node.parentId;
      const visited = new Set();
      while (parentId && !visited.has(String(parentId))) {
        const normalizedId = String(parentId);
        visited.add(normalizedId);
        const parent = nodesById.get(normalizedId);
        if (!parent) break;
        if (String(parent.id) === '0' && !parent.title) break;
        if (!parent.url) path.unshift(normalizeFolder(parent));
        parentId = parent.parentId;
      }
      return path;
    }

    function isInsideSmartFav(node) {
      let parentId = node && node.parentId;
      const visited = new Set();
      while (parentId && !visited.has(String(parentId))) {
        const normalizedId = String(parentId);
        if (smartFavRootIds.has(normalizedId)) return true;
        visited.add(normalizedId);
        const parent = nodesById.get(normalizedId);
        if (!parent) return false;
        parentId = parent.parentId;
      }
      return false;
    }

    const managedFolderIds = nodes
      .filter((node) => !node.url && (
        smartFavRootIds.has(String(node.id)) || isInsideSmartFav(node)
      ))
      .map((node) => String(node.id));
    const externalBookmarks = nodes
      .filter((node) => node.url && !isInsideSmartFav(node));
    const managedBookmarkCount = nodes
      .filter((node) => node.url && isInsideSmartFav(node))
      .length;
    const topLevelFolders = nodes.filter((node) => {
      if (node.url || String(node.id) === '0') return false;
      const parent = nodesById.get(String(node.parentId || ''));
      return !parent || (String(parent.id) === '0' && !parent.title);
    });

    return {
      tree,
      nodes,
      nodesById,
      smartFavRootIds,
      managedFolderIds,
      externalBookmarks,
      managedBookmarkCount,
      topLevelFolders,
      getFolderPath,
      isInsideSmartFav
    };
  }

  function createBookmarkEntry(node, analysis) {
    return {
      id: normalizeText(node.id, 256),
      title: normalizeText(node.title, 2048),
      url: normalizeText(node.url, 8192),
      originalParentId: normalizeText(node.parentId, 256),
      originalIndex: normalizeNumber(node.index, 0),
      parentPath: analysis.getFolderPath(node),
      dateAdded: normalizeNumber(node.dateAdded, 0)
    };
  }

  async function analyzeBookmarks(api) {
    const tree = await callApi(api, 'getTree');
    return buildTreeAnalysis(tree || []);
  }

  function createRestorePointId(now = Date.now()) {
    return `restore-${now}-${Math.random().toString(36).slice(2, 9)}`;
  }

  async function createRestorePoint(api, reason = 'manual') {
    const analysis = await analyzeBookmarks(api);
    const createdAt = Date.now();
    const bookmarks = analysis.externalBookmarks
      .map((node) => createBookmarkEntry(node, analysis));
    return {
      id: createRestorePointId(createdAt),
      schemaVersion: SCHEMA_VERSION,
      createdAt,
      updatedAt: createdAt,
      reason: normalizeText(reason, 64) || 'manual',
      bookmarkCount: bookmarks.length,
      folderCount: new Set(
        bookmarks.flatMap((bookmark) => bookmark.parentPath.map((folder) => folder.id))
      ).size,
      legacyManagedCount: analysis.managedBookmarkCount,
      preservedManagedFolderIds: [...analysis.managedFolderIds],
      bookmarks
    };
  }

  async function appendExternalBookmarks(api, point, bookmarkIds = null) {
    if (!point) return createRestorePoint(api, 'automatic');
    const analysis = await analyzeBookmarks(api);
    const selectedIds = Array.isArray(bookmarkIds) && bookmarkIds.length
      ? new Set(bookmarkIds.map(String))
      : null;
    const existingIds = new Set((point.bookmarks || []).map((bookmark) => bookmark.id));
    const additions = analysis.externalBookmarks
      .filter((node) => !selectedIds || selectedIds.has(String(node.id)))
      .filter((node) => !existingIds.has(String(node.id)))
      .map((node) => createBookmarkEntry(node, analysis));
    const bookmarks = [...(point.bookmarks || []), ...additions];
    return {
      ...point,
      updatedAt: Date.now(),
      bookmarkCount: bookmarks.length,
      folderCount: new Set(
        bookmarks.flatMap((bookmark) => bookmark.parentPath.map((folder) => folder.id))
      ).size,
      bookmarks,
      addedBookmarks: additions.length
    };
  }

  function trimRestorePoints(points) {
    const sorted = [...(points || [])]
      .sort((left, right) => normalizeNumber(left.createdAt) - normalizeNumber(right.createdAt));
    if (sorted.length <= MAX_RESTORE_POINTS) return sorted;
    const active = getActiveRestorePoint(sorted);
    const retained = sorted.slice(-MAX_RESTORE_POINTS);
    if (!active || retained.some((point) => point.id === active.id)) return retained;
    return [
      active,
      ...retained.slice(-(MAX_RESTORE_POINTS - 1))
    ].sort((left, right) => normalizeNumber(left.createdAt) - normalizeNumber(right.createdAt));
  }

  function getActiveRestorePoint(points) {
    return [...(points || [])]
      .filter((point) => point && !point.restoredAt)
      .sort((left, right) => normalizeNumber(right.createdAt) - normalizeNumber(left.createdAt))[0]
      || null;
  }

  function findRestorePoint(points, pointId) {
    const normalizedId = normalizeText(pointId, 256);
    if (normalizedId) {
      return (points || []).find((point) => point.id === normalizedId) || null;
    }
    return getActiveRestorePoint(points)
      || [...(points || [])]
        .sort((left, right) => normalizeNumber(right.createdAt) - normalizeNumber(left.createdAt))[0]
      || null;
  }

  function summarizeRestorePoint(point) {
    if (!point) return null;
    return {
      id: point.id,
      createdAt: normalizeNumber(point.createdAt),
      updatedAt: normalizeNumber(point.updatedAt, normalizeNumber(point.createdAt)),
      restoredAt: normalizeNumber(point.restoredAt, 0),
      reason: normalizeText(point.reason, 64),
      bookmarkCount: Array.isArray(point.bookmarks)
        ? point.bookmarks.length
        : normalizeNumber(point.bookmarkCount),
      folderCount: normalizeNumber(point.folderCount),
      legacyManagedCount: normalizeNumber(point.legacyManagedCount)
    };
  }

  function folderMatchesSegment(node, segment, parentId) {
    return Boolean(
      node
      && !node.url
      && String(node.parentId || '') === String(parentId || '')
      && node.title === segment.title
    );
  }

  function findTopLevelFolder(segment, analysis) {
    const exact = analysis.nodesById.get(String(segment.id));
    if (exact && !exact.url) return exact;
    if (segment.folderType) {
      const byType = analysis.topLevelFolders.find(
        (node) => node.folderType === segment.folderType
      );
      if (byType) return byType;
    }
    return analysis.topLevelFolders.find((node) => node.title === segment.title) || null;
  }

  function findExistingTargetParent(entry, analysis) {
    const exactParent = analysis.nodesById.get(String(entry.originalParentId));
    if (exactParent && !exactParent.url) return exactParent;
    const path = Array.isArray(entry.parentPath) ? entry.parentPath : [];
    if (!path.length) return null;
    let current = findTopLevelFolder(path[0], analysis);
    if (!current) return null;
    for (let index = 1; index < path.length; index += 1) {
      const segment = path[index];
      const exact = analysis.nodesById.get(String(segment.id));
      if (exact && folderMatchesSegment(exact, segment, current.id)) {
        current = exact;
        continue;
      }
      const byTitle = analysis.nodes.find(
        (node) => folderMatchesSegment(node, segment, current.id)
      );
      if (!byTitle) return null;
      current = byTitle;
    }
    return current;
  }

  async function previewRestorePoint(api, point) {
    if (!point) return { status: 'missing' };
    const analysis = await analyzeBookmarks(api);
    const missingFolderKeys = new Set();
    let movable = 0;
    let alreadyRestored = 0;
    let missingBookmarks = 0;

    (point.bookmarks || []).forEach((entry) => {
      const current = analysis.nodesById.get(String(entry.id));
      if (!current || !current.url) {
        missingBookmarks += 1;
        return;
      }
      const target = findExistingTargetParent(entry, analysis);
      if (
        target
        && String(current.parentId) === String(target.id)
        && normalizeNumber(current.index, normalizeNumber(entry.originalIndex))
          === normalizeNumber(entry.originalIndex)
      ) {
        alreadyRestored += 1;
        return;
      }
      movable += 1;
      if (!target) {
        (entry.parentPath || []).forEach((folder, index) => {
          if (!analysis.nodesById.has(String(folder.id))) {
            missingFolderKeys.add(`${index}:${folder.title}:${folder.parentId || ''}`);
          }
        });
      }
    });

    return {
      status: 'ok',
      point: summarizeRestorePoint(point),
      movable,
      alreadyRestored,
      missingBookmarks,
      foldersToRecreate: missingFolderKeys.size,
      legacyManagedCount: normalizeNumber(point.legacyManagedCount)
    };
  }

  async function resolveTargetParent(api, entry, context) {
    const exactParent = context.analysis.nodesById.get(String(entry.originalParentId));
    if (exactParent && !exactParent.url) return exactParent;
    const path = Array.isArray(entry.parentPath) ? entry.parentPath : [];
    if (!path.length) return null;

    let current = findTopLevelFolder(path[0], context.analysis);
    if (!current) return null;
    for (let index = 1; index < path.length; index += 1) {
      const segment = path[index];
      const exact = context.analysis.nodesById.get(String(segment.id));
      if (exact && folderMatchesSegment(exact, segment, current.id)) {
        current = exact;
        continue;
      }
      const byTitle = context.analysis.nodes.find(
        (node) => folderMatchesSegment(node, segment, current.id)
      );
      if (byTitle) {
        current = byTitle;
        continue;
      }
      const created = await callApi(api, 'create', {
        parentId: current.id,
        title: segment.title,
        index: normalizeNumber(segment.index, 0)
      });
      context.analysis.nodes.push(created);
      context.analysis.nodesById.set(String(created.id), created);
      context.createdFolders += 1;
      current = created;
    }
    return current;
  }

  async function cleanupManagedFolders(api, preservedIds) {
    const analysis = await analyzeBookmarks(api);
    const preserved = new Set((preservedIds || []).map(String));
    const candidates = analysis.nodes
      .filter((node) => !node.url && (
        analysis.smartFavRootIds.has(String(node.id)) || analysis.isInsideSmartFav(node)
      ))
      .sort((left, right) => {
        return analysis.getFolderPath(right).length - analysis.getFolderPath(left).length;
      });
    let removed = 0;
    for (const folder of candidates) {
      if (preserved.has(String(folder.id))) continue;
      try {
        const children = await callApi(api, 'getChildren', folder.id);
        if ((children || []).length) continue;
        await callApi(api, 'remove', folder.id);
        removed += 1;
      } catch (_) {
        // A concurrent browser change can make a folder non-empty or unavailable.
      }
    }
    return removed;
  }

  async function restorePoint(api, point) {
    if (!point) return { status: 'missing' };
    const analysis = await analyzeBookmarks(api);
    const context = {
      analysis,
      createdFolders: 0
    };
    const entries = [...(point.bookmarks || [])]
      .sort((left, right) => {
        const leftPath = (left.parentPath || []).map((folder) => folder.title).join('/');
        const rightPath = (right.parentPath || []).map((folder) => folder.title).join('/');
        return leftPath.localeCompare(rightPath)
          || normalizeNumber(left.originalIndex) - normalizeNumber(right.originalIndex);
      });
    let restored = 0;
    let alreadyRestored = 0;
    let missingBookmarks = 0;
    let unresolvedParents = 0;
    const errors = [];

    for (const entry of entries) {
      const current = context.analysis.nodesById.get(String(entry.id));
      if (!current || !current.url) {
        missingBookmarks += 1;
        continue;
      }
      try {
        const target = await resolveTargetParent(api, entry, context);
        if (!target) {
          unresolvedParents += 1;
          continue;
        }
        if (
          String(current.parentId) === String(target.id)
          && normalizeNumber(current.index, normalizeNumber(entry.originalIndex))
            === normalizeNumber(entry.originalIndex)
        ) {
          alreadyRestored += 1;
          continue;
        }
        const children = await callApi(api, 'getChildren', target.id);
        const targetIndex = Math.min(
          Math.max(0, normalizeNumber(entry.originalIndex)),
          (children || []).length
        );
        const moved = await callApi(api, 'move', current.id, {
          parentId: target.id,
          index: targetIndex
        });
        Object.assign(current, moved || { parentId: target.id, index: targetIndex });
        restored += 1;
      } catch (error) {
        errors.push({
          id: entry.id,
          title: entry.title,
          message: normalizeText(error.message, 512)
        });
      }
    }

    const removedEmptyFolders = await cleanupManagedFolders(
      api,
      point.preservedManagedFolderIds
    );
    return {
      status: errors.length || unresolvedParents ? 'partial' : 'ok',
      restored,
      alreadyRestored,
      missingBookmarks,
      unresolvedParents,
      createdFolders: context.createdFolders,
      removedEmptyFolders,
      errors: errors.slice(0, 20)
    };
  }

  function normalizeImportedFolder(folder) {
    return {
      id: normalizeText(folder && folder.id, 256),
      title: normalizeText(folder && folder.title, 512),
      parentId: normalizeText(folder && folder.parentId, 256),
      index: normalizeNumber(folder && folder.index, 0),
      ...(folder && folder.folderType
        ? { folderType: normalizeText(folder.folderType, 64) }
        : {})
    };
  }

  function normalizeImportedBookmark(bookmark) {
    return {
      id: normalizeText(bookmark && bookmark.id, 256),
      title: normalizeText(bookmark && bookmark.title, 2048),
      url: normalizeText(bookmark && bookmark.url, 8192),
      originalParentId: normalizeText(bookmark && bookmark.originalParentId, 256),
      originalIndex: normalizeNumber(bookmark && bookmark.originalIndex, 0),
      parentPath: Array.isArray(bookmark && bookmark.parentPath)
        ? bookmark.parentPath.slice(0, 64).map(normalizeImportedFolder)
        : [],
      dateAdded: normalizeNumber(bookmark && bookmark.dateAdded, 0)
    };
  }

  function normalizeImportedPoint(point) {
    const bookmarks = Array.isArray(point && point.bookmarks)
      ? point.bookmarks.slice(0, 100000).map(normalizeImportedBookmark)
      : [];
    if (!point || !point.id || !point.createdAt || !Array.isArray(point.bookmarks)) {
      throw new Error('Invalid restore point');
    }
    return {
      id: normalizeText(point.id, 256),
      schemaVersion: SCHEMA_VERSION,
      createdAt: normalizeNumber(point.createdAt),
      updatedAt: normalizeNumber(point.updatedAt, normalizeNumber(point.createdAt)),
      ...(point.restoredAt ? { restoredAt: normalizeNumber(point.restoredAt) } : {}),
      reason: normalizeText(point.reason, 64) || 'imported',
      bookmarkCount: bookmarks.length,
      folderCount: normalizeNumber(point.folderCount),
      legacyManagedCount: normalizeNumber(point.legacyManagedCount),
      preservedManagedFolderIds: Array.isArray(point.preservedManagedFolderIds)
        ? point.preservedManagedFolderIds.slice(0, 10000).map((id) => normalizeText(id, 256))
        : [],
      bookmarks
    };
  }

  function createExportPayload(points, exportedAt = Date.now()) {
    return {
      format: FORMAT,
      schemaVersion: SCHEMA_VERSION,
      exportedAt,
      restorePoints: trimRestorePoints(points)
    };
  }

  function parseImportPayload(payload) {
    const serialized = JSON.stringify(payload || {});
    if (serialized.length > MAX_IMPORT_BYTES) throw new Error('Restore file is too large');
    if (
      !payload
      || payload.format !== FORMAT
      || normalizeNumber(payload.schemaVersion) !== SCHEMA_VERSION
      || !Array.isArray(payload.restorePoints)
    ) {
      throw new Error('Invalid SmartFav restore file');
    }
    const points = payload.restorePoints.map(normalizeImportedPoint);
    if (!points.length) throw new Error('Restore file does not contain a restore point');
    return trimRestorePoints(points);
  }

  function mergeRestorePoints(currentPoints, importedPoints) {
    const byId = new Map();
    [...(currentPoints || []), ...(importedPoints || [])].forEach((point) => {
      if (point && point.id) byId.set(point.id, point);
    });
    return trimRestorePoints([...byId.values()]);
  }

  const api = {
    FORMAT,
    SCHEMA_VERSION,
    MAX_RESTORE_POINTS,
    MAX_IMPORT_BYTES,
    flattenTree,
    buildTreeAnalysis,
    analyzeBookmarks,
    createRestorePoint,
    appendExternalBookmarks,
    trimRestorePoints,
    getActiveRestorePoint,
    findRestorePoint,
    summarizeRestorePoint,
    previewRestorePoint,
    restorePoint,
    createExportPayload,
    parseImportPayload,
    mergeRestorePoints
  };

  globalScope.SmartFavBackup = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
