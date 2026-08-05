// SmartFav AI Organization - validates preview-only proposals before any mutation.
(function attachAIOrganization(globalScope) {
  const ALLOWED_TYPES = new Set(['move_favorite', 'create_folder', 'add_keywords']);
  const MAX_OPERATIONS = 100;

  function cleanText(value, limit = 240) {
    return String(value || '')
      .normalize('NFKC')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, limit);
  }

  function extractJsonObject(response) {
    const source = String(response || '').trim();
    const start = source.indexOf('{');
    const end = source.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('AI response does not contain JSON');
    return JSON.parse(source.slice(start, end + 1));
  }

  function parseOperations(response) {
    const parsed = typeof response === 'string' ? extractJsonObject(response) : response;
    const operations = parsed && Array.isArray(parsed.operations) ? parsed.operations : [];
    return operations.slice(0, MAX_OPERATIONS);
  }

  function buildProfiles(folders, favorites, folderTree, sampleLimit = 12) {
    const safeFolders = folderTree.normalizeFolders(folders);
    const safeFavorites = Array.isArray(favorites) ? favorites : [];
    return safeFolders.map((folder) => ({
      folderId: folder.id,
      path: folderTree.getPathLabel(safeFolders, folder.id),
      parentId: folder.parentId,
      keywords: [...(folder.keywords || [])],
      totalFavorites: safeFavorites.filter((favorite) => favorite.folderId === folder.id).length,
      favorites: safeFavorites
        .filter((favorite) => favorite.folderId === folder.id)
        .slice(0, Math.max(1, Math.min(12, Number(sampleLimit) || 12)))
        .map((favorite) => {
          let domain = '';
          let path = '/';
          try {
            const url = new URL(String(favorite.url || ''));
            if (['http:', 'https:'].includes(url.protocol)) {
              domain = url.hostname.replace(/^www\./i, '').slice(0, 160);
              path = (url.pathname || '/').slice(0, 160);
            }
          } catch (_error) {
            // Invalid and private URLs are intentionally omitted from AI input.
          }
          return {
            favoriteId: favorite.id,
            title: cleanText(favorite.title, 140),
            domain,
            path
          };
        })
        .filter((favorite) => favorite.domain)
    }));
  }

  function validateOperations(rawOperations, folders, favorites, folderTree) {
    const safeFolders = folderTree.normalizeFolders(folders);
    const folderIds = new Set(safeFolders.map((folder) => folder.id));
    const favoriteIds = new Set((Array.isArray(favorites) ? favorites : []).map((favorite) => favorite.id));
    const temporaryFolders = new Map();
    const operations = [];
    const rejected = [];

    (Array.isArray(rawOperations) ? rawOperations : []).slice(0, MAX_OPERATIONS)
      .forEach((raw, index) => {
        const type = cleanText(raw && raw.type, 32);
        const id = cleanText(raw && raw.id, 128) || `op-${index + 1}`;
        const reason = cleanText(raw && raw.reason, 240);
        if (!ALLOWED_TYPES.has(type)) {
          rejected.push({ id, reason: 'unsupported_type' });
          return;
        }
        if (type === 'move_favorite') {
          const favoriteId = cleanText(raw.favoriteId, 128);
          const targetFolderId = cleanText(raw.targetFolderId, 128);
          if (!favoriteIds.has(favoriteId) || (!folderIds.has(targetFolderId) && !temporaryFolders.has(targetFolderId))) {
            rejected.push({ id, reason: 'unknown_id' });
            return;
          }
          operations.push({ id, type, favoriteId, targetFolderId, reason });
          return;
        }
        if (type === 'create_folder') {
          const parentId = cleanText(raw.parentId, 128) || null;
          const temporaryId = cleanText(raw.temporaryId || raw.folderId, 128) || `new-${index + 1}`;
          const name = folderTree.sanitizeFolderName(raw.name);
          const keywords = folderTree.uniqueKeywords(raw.keywords);
          const parentExists = !parentId || folderIds.has(parentId) || temporaryFolders.has(parentId);
          const siblingConflict = safeFolders.some((folder) => (
            (folder.parentId || null) === parentId
            && folder.name.toLocaleLowerCase() === name.toLocaleLowerCase()
          ));
          if (!name || !parentExists || siblingConflict || folderIds.has(temporaryId) || temporaryFolders.has(temporaryId)) {
            rejected.push({ id, reason: !name ? 'invalid_name' : siblingConflict ? 'name_conflict' : 'unknown_id' });
            return;
          }
          temporaryFolders.set(temporaryId, { parentId, name });
          operations.push({ id, type, temporaryId, parentId, name, keywords, reason });
          return;
        }
        const folderId = cleanText(raw.folderId, 128);
        const keywords = folderTree.uniqueKeywords(raw.keywords);
        if ((!folderIds.has(folderId) && !temporaryFolders.has(folderId)) || !keywords.length) {
          rejected.push({ id, reason: 'unknown_id' });
          return;
        }
        operations.push({ id, type, folderId, keywords, reason });
      });

    return { operations, rejected };
  }

  const api = { ALLOWED_TYPES, MAX_OPERATIONS, parseOperations, buildProfiles, validateOperations };
  globalScope.SmartFavAIOrganization = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
