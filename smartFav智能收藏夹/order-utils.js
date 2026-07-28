(function attachOrderUtils(globalScope) {
  function uniqueStrings(values) {
    const seen = new Set();
    return (Array.isArray(values) ? values : []).reduce((result, value) => {
      const normalized = String(value || '').trim();
      if (!normalized || seen.has(normalized)) return result;
      seen.add(normalized);
      result.push(normalized);
      return result;
    }, []);
  }

  function reorderValues(values, sourceValue, targetValue, placement = 'before') {
    const next = uniqueStrings(values);
    const source = String(sourceValue || '').trim();
    const target = String(targetValue || '').trim();
    if (!source || !target || source === target) return next;

    const sourceIndex = next.indexOf(source);
    const targetIndex = next.indexOf(target);
    if (sourceIndex < 0 || targetIndex < 0) return next;

    const [moved] = next.splice(sourceIndex, 1);
    const adjustedTargetIndex = next.indexOf(target);
    const insertionIndex = adjustedTargetIndex + (placement === 'after' ? 1 : 0);
    next.splice(insertionIndex, 0, moved);
    return next;
  }

  function moveValue(values, value, offset) {
    const next = uniqueStrings(values);
    const source = String(value || '').trim();
    const sourceIndex = next.indexOf(source);
    const targetIndex = sourceIndex + Number(offset || 0);
    if (
      sourceIndex < 0
      || targetIndex < 0
      || targetIndex >= next.length
      || targetIndex === sourceIndex
    ) {
      return next;
    }
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    return next;
  }

  function applyFavoriteOrder(favorites, category, preferredUrls) {
    const categoryFavorites = (Array.isArray(favorites) ? favorites : [])
      .filter((favorite) => favorite && favorite.category === category);
    const byUrl = new Map(categoryFavorites.map((favorite) => [favorite.url, favorite]));
    const preferred = uniqueStrings(preferredUrls).filter((url) => byUrl.has(url));
    const preferredSet = new Set(preferred);
    const unordered = categoryFavorites.filter((favorite) => !preferredSet.has(favorite.url));
    return [
      ...unordered,
      ...preferred.map((url) => byUrl.get(url))
    ];
  }

  function reorderFavoriteUrls(
    favorites,
    category,
    preferredUrls,
    sourceUrl,
    targetUrl,
    placement = 'before'
  ) {
    const displayedUrls = applyFavoriteOrder(favorites, category, preferredUrls)
      .map((favorite) => favorite.url);
    return reorderValues(displayedUrls, sourceUrl, targetUrl, placement);
  }

  function moveFavoriteUrl(favorites, category, preferredUrls, sourceUrl, offset) {
    const displayedUrls = applyFavoriteOrder(favorites, category, preferredUrls)
      .map((favorite) => favorite.url);
    return moveValue(displayedUrls, sourceUrl, offset);
  }

  const api = {
    applyFavoriteOrder,
    moveFavoriteUrl,
    moveValue,
    reorderFavoriteUrls,
    reorderValues,
    uniqueStrings
  };

  globalScope.SmartFavOrder = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
