// SmartFav Folder Nav - 文件夹树导航的统一渲染原语。
//
// 抽取动机：popup.js 里"面包屑 + 层级/搜索解析"被实现了 4 套（收藏夹浏览、
// 文件夹内容、分类管理、文件夹选择器），各自演进导致同一个文件夹在不同入口
// 长成不同样子、点击行为也不一致。这里把纯函数部分抽出来，无 IO、可单测。
//
// 依赖：globalThis.SmartFavFolderTree（由 folder-tree.js 在本文件之前加载）。
(function attachFolderNav(globalScope) {
  function folderTree() {
    return globalScope.SmartFavFolderTree;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 面包屑：从根到 folderId 的完整路径，每段是一个按钮。
  // 三个 scope 共用，靠 dataAttr 区分按钮上挂的属性名：
  //   favorites → 'data-folder-id'   picker → 'data-folder-picker-parent'   manage → 'data-category-parent-id'
  // folderId 为 null/空 时只渲染根按钮。
  function renderBreadcrumb(folders, folderId, options = {}) {
    const tree = folderTree();
    if (!tree) return '';
    const attr = options.dataAttr || 'data-folder-id';
    const rootLabel = options.rootLabel || '';
    const rootBtn = `<button type="button" ${attr}="">${escapeHtml(rootLabel)}</button>`;
    const path = folderId ? tree.getPath(folders, folderId) : [];
    if (!path.length) {
      return `<nav class="folder-breadcrumb" aria-label="${escapeHtml(rootLabel)}">${rootBtn}</nav>`;
    }
    const segments = path.map((folder) =>
      `<span aria-hidden="true">›</span><button type="button" ${attr}="${escapeHtml(folder.id)}">${escapeHtml(folder.name)}</button>`
    ).join('');
    return `<nav class="folder-breadcrumb" aria-label="${escapeHtml(rootLabel)}">${rootBtn}${segments}</nav>`;
  }

  // 层级 + 搜索解析。返回 [{ folder, pathLabel }]。
  //
  // 无 query：返回 parentId 的直接子文件夹，pathLabel = name。这是"当前层 + 直接子层"
  // 浏览模型——popup 宽 360px，不做无限缩进树。
  //
  // 有 query：跨层扁平搜索全部文件夹，name 命中的带上完整路径标签。
  // 这样用户搜"客户"能直接看到"工作 › 客户"，而不用先知道它在哪一层。
  // 之前的 applySearchFilter 只在已渲染的当前层 DOM 上做 display:none，跨层搜不到。
  function resolveVisibleFolders(folders, options = {}) {
    const tree = folderTree();
    if (!tree) return [];
    const normalized = tree.normalizeFolders(folders);
    const parentId = Object.prototype.hasOwnProperty.call(options, 'parentId')
      ? options.parentId
      : null;
    const query = String(options.query || '').trim().toLowerCase();
    if (!query) {
      return tree.childrenOf(normalized, parentId).map((folder) => ({
        folder,
        pathLabel: folder.name
      }));
    }
    return normalized
      .filter((folder) => folder.name.toLowerCase().includes(query))
      .map((folder) => ({
        folder,
        pathLabel: tree.getPathLabel(normalized, folder.id)
      }));
  }

  const api = { escapeHtml, renderBreadcrumb, resolveVisibleFolders };
  globalScope.SmartFavFolderNav = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
