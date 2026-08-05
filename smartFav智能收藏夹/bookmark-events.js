// SmartFav Bookmark Events - 浏览器书签事件到单一布局事务的适配层
(function attachBookmarkEvents(globalScope) {
  function attach({ chrome, favoritesService, bookmarkGuard }) {
    if (!chrome || !chrome.bookmarks || !favoritesService || !bookmarkGuard) return;
    const { enqueueBookmarkEvent, withBookmarkLayoutLock } = bookmarkGuard;
    const register = (event, label, handler) => {
      if (!event || typeof event.addListener !== 'function') return;
      event.addListener((...args) => {
        enqueueBookmarkEvent(
          label,
          () => withBookmarkLayoutLock(() => handler(...args))
        );
      });
    };

    register(
      chrome.bookmarks.onCreated,
      'auto capture',
      (id, node) => favoritesService.handleBookmarkCreated(id, node)
    );
    register(
      chrome.bookmarks.onMoved,
      'browser move sync',
      (id, moveInfo) => favoritesService.handleBookmarkMoved(id, moveInfo)
    );
    register(
      chrome.bookmarks.onRemoved,
      'browser deletion sync',
      (id, removeInfo) => favoritesService.handleBookmarkRemoved(id, removeInfo)
    );
    register(
      chrome.bookmarks.onChanged,
      'browser tree change sync',
      () => favoritesService.handleBookmarkTreeChanged()
    );
    register(
      chrome.bookmarks.onChildrenReordered,
      'browser order sync',
      () => favoritesService.handleBookmarkTreeChanged()
    );
  }

  const api = { attach };
  globalScope.SmartFavBookmarkEvents = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
