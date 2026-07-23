const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const extensionRoot = path.join(projectRoot, 'smartFav智能收藏夹');
const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'manifest.json'), 'utf8'));
const zhMessages = JSON.parse(
  fs.readFileSync(path.join(extensionRoot, '_locales/zh_CN/messages.json'), 'utf8')
);
const enMessages = JSON.parse(
  fs.readFileSync(path.join(extensionRoot, '_locales/en/messages.json'), 'utf8')
);
const popupHtml = fs.readFileSync(path.join(extensionRoot, 'popup.html'), 'utf8');
const popupJs = fs.readFileSync(path.join(extensionRoot, 'popup.js'), 'utf8');
const popupCss = fs.readFileSync(path.join(extensionRoot, 'styles/popup.css'), 'utf8');
const backgroundJs = fs.readFileSync(path.join(extensionRoot, 'background.js'), 'utf8');

const classifier = require(path.join(extensionRoot, 'classifier.js'));
const i18n = require(path.join(extensionRoot, 'i18n.js'));
const browserBookmarks = require(path.join(extensionRoot, 'browser-bookmarks.js'));

function verifyManifestAndLocales() {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, '1.6.7');
  assert.equal(manifest.default_locale, 'zh_CN');
  assert.equal(manifest.name, '__MSG_extensionName__');
  assert.equal(manifest.description, '__MSG_extensionDescription__');
  assert.ok(manifest.permissions.includes('bookmarks'));
  ['16', '32', '48', '128'].forEach((size) => {
    assert.equal(manifest.icons[size], `icons/icon${size}.png`);
    assert.equal(manifest.action.default_icon[size], `icons/icon${size}.png`);
    assert.ok(fs.existsSync(path.join(extensionRoot, `icons/icon${size}.png`)), `missing icons/icon${size}.png`);
  });
  assert.match(popupHtml, /class="brand-logo" src="icons\/icon32\.png"/);
  assert.equal(manifest.action.default_popup, 'popup.html');
  assert.equal(manifest.action.default_title, '__MSG_actionTitle__');
  assert.equal(manifest.web_accessible_resources, undefined);
  assert.doesNotMatch(backgroundJs, /chrome\.action\.onClicked\.addListener/);
  assert.doesNotMatch(backgroundJs, /openLibraryFallback|resizeStandalone|floating-panel/);
  assert.doesNotMatch(popupJs, /isEmbedded|isStandaloneLibrary|postFloatingHostMessage/);
  assert.match(popupJs, /previewThemeStyle === 'black' && nextThemeStyle !== 'black'/);
  assert.match(popupJs, /elements\.compactDarkMode\.checked = false/);
  assert.ok(zhMessages.extensionName.message.includes('智能收藏夹'));
  assert.ok(enMessages.extensionName.message.includes('Smart Favorites'));
  assert.match(popupHtml, /id="languageBtn"/);
  assert.match(popupHtml, /id="modeBtn"/);
  assert.doesNotMatch(popupHtml, /id="embeddedCloseBtn"/);
  assert.match(popupHtml, /id="compactThemeStyle"/);
  assert.match(popupHtml, /id="compactNewCategory"/);
  assert.match(popupHtml, /id="compactAddCategoryBtn"/);
  assert.match(popupHtml, /id="categoryRulesList"/);
  assert.doesNotMatch(popupHtml, /id="compactKeywordRules"/);
  ['glass', 'white', 'gray', 'black', 'parchment'].forEach((themeStyle) => {
    assert.match(popupHtml, new RegExp(`option value="${themeStyle}"`));
  });
  assert.match(popupHtml, /id="compactBookmarkWriteMode"/);
  assert.match(popupHtml, /id="compactBookmarkOrganizeEnabled"/);
  assert.match(popupHtml, /id="compactBookmarkAutoCapture"/);
  assert.match(popupHtml, /id="compactOrganizeBtn"/);
  assert.match(
    popupHtml,
    /id="compactBookmarkFields"[\s\S]*?<\/div>\s*<label class="compact-toggle" for="compactBookmarkOrganizeEnabled"/
  );
  assert.match(popupHtml, /class="compact-toggle" for="compactBookmarkAutoCapture"/);
  assert.match(popupHtml, /class="bookmark-actions"/);
  assert.match(backgroundJs, /chrome\.bookmarks\.onCreated\.addListener/);
  assert.match(backgroundJs, /organizeBookmarks/);
  assert.match(backgroundJs, /recoverManagedFavorites/);
  assert.match(backgroundJs, /collectManagedBookmarks/);
  assert.match(popupJs, /type:\s*'recoverManagedFavorites'/);
  assert.match(backgroundJs, /SmartFavBookmarks\.removeFavorite/);
  assert.match(backgroundJs, /message\.type === 'deleteFavorite'/);
  assert.match(popupJs, /type:\s*'deleteFavorite',\s*url/);
  assert.match(backgroundJs, /bookmarkOrganizeEnabled/);
  assert.match(backgroundJs, /bookmarkAutoCaptureEnabled/);
  assert.doesNotMatch(
    backgroundJs,
    /!settings\.browserBookmarksEnabled\s*\|\|\s*!settings\.bookmarkAutoCaptureEnabled/
  );
  assert.doesNotMatch(
    backgroundJs,
    /organizeBrowserBookmarks\(\)[\s\S]{0,180}!settings\.browserBookmarksEnabled/
  );
  assert.match(
    popupJs,
    /const wasOrganizeActive = currentSettings\.bookmarkOrganizeEnabled/
  );
  assert.match(popupJs, /class="favorite-delete-button"/);
  assert.match(popupJs, /async function deleteFavorite\(url\)/);
  assert.match(popupJs, /showingAllFavorites = !showingAllFavorites/);
  assert.match(popupJs, /t\(showingAllFavorites \? 'showLess' : 'viewAll'\)/);
  assert.match(
    popupJs,
    /compactBookmarkOrganizeEnabled\.addEventListener\('change', handleBookmarkOrganizeChange\)/
  );
  assert.match(
    popupJs,
    /compactBookmarkAutoCapture\.addEventListener\('change', handleBookmarkAutoCaptureChange\)/
  );
  assert.match(
    backgroundJs,
    /if \(shouldOrganize\) \{/
  );
  assert.match(backgroundJs, /SmartFavBookmarks\.writeFavorite\(/);
  assert.match(backgroundJs, /if \(!shouldCapture && !shouldOrganize\) return/);
  assert.match(popupJs, /chrome\.tabs\.update\(activeTab\.id, \{ url \}/);
  assert.match(popupJs, /t\('backToCategories'\)/);
  assert.match(
    i18n.MESSAGES.zh_CN.browserFolderNote,
    /不删除内容/
  );
  assert.match(
    i18n.MESSAGES.en.browserFolderNote,
    /never deletes/
  );
  assert.match(i18n.MESSAGES.zh_CN.browserBookmarksHint, /收藏或删除/);
  assert.match(i18n.MESSAGES.en.browserBookmarksHint, /saving or deleting/);
  assert.match(popupCss, /html,\s*body\s*\{[^}]*width:\s*360px;[^}]*min-width:\s*360px;/s);
  assert.match(popupCss, /html,\s*body\s*\{[^}]*border-radius:\s*var\(--shell-radius\);[^}]*overflow:\s*hidden;/s);
  assert.match(popupCss, /body\s*\{[^}]*padding:\s*0;[^}]*contain:\s*paint;/s);
  assert.match(popupCss, /--shell-radius:\s*0/);
  assert.match(popupCss, /\.app-shell\s*\{[^}]*border:\s*0;[^}]*border-radius:\s*0;[^}]*box-shadow:\s*none;/s);
  assert.match(popupCss, /\.library-panel\s*\{[^}]*max-height:\s*185px;[^}]*overflow-y:\s*auto;/s);
  assert.match(popupCss, /--shadow:\s*none/);
  assert.match(popupCss, /blur\(18px\)\s+saturate\(135%\)/);
  assert.doesNotMatch(popupCss, /body::before/);
  assert.doesNotMatch(popupCss, /body::after/);
  assert.doesNotMatch(popupCss, /\.app-shell::before/);
  assert.doesNotMatch(popupCss, /@media\s*\(max-width:\s*346px\)[\s\S]*body\s*\{\s*width:\s*100vw/);

  const htmlKeys = [...popupHtml.matchAll(/data-i18n(?:-[\w-]+)?="([^"]+)"/g)]
    .map((match) => match[1]);
  const jsKeys = [...popupJs.matchAll(/\bt\('([^']+)'/g)]
    .map((match) => match[1]);
  [...new Set([...htmlKeys, ...jsKeys])].forEach((key) => {
    assert.ok(i18n.MESSAGES.zh_CN[key], `Missing zh_CN UI message: ${key}`);
    assert.ok(i18n.MESSAGES.en[key], `Missing en UI message: ${key}`);
  });
}

function verifyBilingualClassification() {
  const zhDefaults = classifier.getDefaults('zh_CN');
  const enDefaults = classifier.getDefaults('en');
  const zhResult = classifier.classify(
    { title: 'JavaScript 编程教程', url: 'https://github.com/example', description: '' },
    { language: 'zh_CN', ...zhDefaults }
  );
  const enResult = classifier.classify(
    { title: 'JavaScript programming tutorial', url: 'https://github.com/example', description: '' },
    { language: 'en', categories: enDefaults.categories, keywordRules: enDefaults.keywordRules }
  );
  assert.equal(zhResult.category, '编程');
  assert.equal(enResult.category, 'Programming');
  assert.match(zhResult.summary, /匹配到/);
  assert.match(enResult.summary, /Matched/);
  assert.equal(i18n.translate('zh_CN', 'settings'), '设置');
  assert.equal(i18n.translate('en', 'settings'), 'Settings');
  assert.equal(
    i18n.translate('en', 'saveToCategory', { category: 'Tools' }),
    'Save to “Tools”'
  );
  const customResult = classifier.classify(
    { title: 'Figma interface design', url: 'https://figma.com/file/example', description: '' },
    {
      language: 'en',
      categories: ['Design', 'Other'],
      keywordRules: { Design: ['figma', 'interface'], Other: [] }
    }
  );
  assert.equal(customResult.category, 'Design');
  assert.deepEqual(customResult.tags, ['figma', 'interface']);
}

function createMockBookmarks() {
  let nextId = 1;
  const nodes = new Map();

  function cloneTree(id) {
    const node = nodes.get(String(id));
    if (!node) return null;
    const clone = { ...node };
    if (!node.url) {
      clone.children = [...nodes.values()]
        .filter((child) => child.parentId === node.id)
        .map((child) => cloneTree(child.id));
    }
    return clone;
  }

  return {
    nodes,
    search(query, callback) {
      callback([...nodes.values()].filter((node) => node.title === query.title));
    },
    create(data, callback) {
      const node = {
        id: String(nextId++),
        parentId: data.parentId ? String(data.parentId) : 'other',
        title: data.title,
        ...(data.url ? { url: data.url } : {})
      };
      nodes.set(node.id, node);
      callback({ ...node });
    },
    getChildren(parentId, callback) {
      callback([...nodes.values()].filter((node) => node.parentId === String(parentId)));
    },
    getSubTree(id, callback) {
      callback([cloneTree(id)]);
    },
    update(id, changes, callback) {
      const node = nodes.get(String(id));
      Object.assign(node, changes);
      callback({ ...node });
    },
    move(id, destination, callback) {
      const node = nodes.get(String(id));
      node.parentId = String(destination.parentId);
      callback({ ...node });
    },
    remove(id, callback) {
      nodes.delete(String(id));
      callback();
    },
    get(id, callback) {
      const node = nodes.get(String(id));
      callback(node ? [{ ...node }] : []);
    },
    getTree(callback) {
      const topLevel = [...nodes.values()]
        .filter((node) => !nodes.has(node.parentId))
        .map((node) => cloneTree(node.id));
      callback([{ id: '0', title: '', children: topLevel }]);
    }
  };
}

async function verifyBookmarkModes() {
  const api = createMockBookmarks();
  const first = {
    title: 'Example page',
    url: 'https://example.com',
    category: 'Tools'
  };
  const created = await browserBookmarks.writeFavorite(
    first,
    { browserBookmarksEnabled: true, bookmarkWriteMode: 'overwrite' },
    api
  );
  assert.equal(created.status, 'created');

  const updated = await browserBookmarks.writeFavorite(
    { ...first, title: 'Updated page', category: 'Learning' },
    { browserBookmarksEnabled: true, bookmarkWriteMode: 'overwrite' },
    api
  );
  assert.equal(updated.status, 'updated');
  const urlMatchesAfterUpdate = [...api.nodes.values()]
    .filter((node) => node.url === first.url);
  assert.equal(urlMatchesAfterUpdate.length, 1);
  assert.equal(urlMatchesAfterUpdate[0].title, 'Updated page');

  const added = await browserBookmarks.writeFavorite(
    first,
    { browserBookmarksEnabled: true, bookmarkWriteMode: 'add' },
    api
  );
  assert.equal(added.status, 'created');
  const urlMatchesAfterAdd = [...api.nodes.values()]
    .filter((node) => node.url === first.url);
  assert.equal(urlMatchesAfterAdd.length, 2);

  const deduplicated = await browserBookmarks.writeFavorite(
    { ...first, title: 'Deduplicated page', category: 'Tools' },
    { browserBookmarksEnabled: true, bookmarkWriteMode: 'overwrite' },
    api
  );
  assert.equal(deduplicated.status, 'updated');
  assert.equal(deduplicated.removedDuplicates, 1);
  const urlMatchesAfterDeduplicate = [...api.nodes.values()]
    .filter((node) => node.url === first.url);
  assert.equal(urlMatchesAfterDeduplicate.length, 1);
  assert.equal(urlMatchesAfterDeduplicate[0].title, 'Deduplicated page');

  // 覆盖模式必须命中 SmartFav 文件夹外由浏览器星标创建的同网址收藏。
  const externalApi = createMockBookmarks();
  const external = await new Promise((resolve) => externalApi.create(
    { title: 'Browser star', url: 'https://external.example.com' },
    resolve
  ));
  const externalUpdated = await browserBookmarks.writeFavorite(
    {
      title: 'SmartFav title',
      url: 'https://external.example.com',
      category: 'Learning'
    },
    { browserBookmarksEnabled: true, bookmarkWriteMode: 'overwrite' },
    externalApi
  );
  assert.equal(externalUpdated.status, 'updated');
  assert.equal(externalUpdated.id, external.id);
  const externalMatches = [...externalApi.nodes.values()]
    .filter((node) => node.url === 'https://external.example.com');
  assert.equal(externalMatches.length, 1);
  assert.equal(externalMatches[0].title, 'SmartFav title');
  assert.equal(externalApi.nodes.get(externalMatches[0].parentId).title, 'Learning');

  const disabled = await browserBookmarks.writeFavorite(
    first,
    { browserBookmarksEnabled: false, bookmarkWriteMode: 'overwrite' },
    api
  );
  assert.equal(disabled.status, 'disabled');

  // 同步删除只移除 SmartFav 受管目录中的同网址书签，不误删外部同网址收藏。
  const removalApi = createMockBookmarks();
  const removalSettings = {
    browserBookmarksEnabled: true,
    bookmarkWriteMode: 'add'
  };
  await browserBookmarks.writeFavorite(
    { title: 'Managed one', url: 'https://remove.example.com', category: 'Tools' },
    removalSettings,
    removalApi
  );
  await browserBookmarks.writeFavorite(
    { title: 'Managed two', url: 'https://remove.example.com', category: 'Learning' },
    removalSettings,
    removalApi
  );
  const externalCopy = await new Promise((resolve) => removalApi.create(
    { title: 'External copy', url: 'https://remove.example.com' },
    resolve
  ));
  const removed = await browserBookmarks.removeFavorite(
    'https://remove.example.com',
    removalSettings,
    removalApi
  );
  assert.equal(removed.status, 'removed');
  assert.equal(removed.removed, 2);
  const remainingCopies = [...removalApi.nodes.values()]
    .filter((node) => node.url === 'https://remove.example.com');
  assert.equal(remainingCopies.length, 1);
  assert.equal(remainingCopies[0].id, externalCopy.id);

  const disabledRemoval = await browserBookmarks.removeFavorite(
    externalCopy.url,
    { browserBookmarksEnabled: false },
    removalApi
  );
  assert.equal(disabledRemoval.status, 'disabled');
  assert.equal(disabledRemoval.removed, 0);
  assert.ok(removalApi.nodes.has(externalCopy.id));
}

async function verifyOrganizeBookmarks() {
  const api = createMockBookmarks();
  await new Promise((resolve) => api.create(
    { title: 'Online course tutorial', url: 'https://course.example.com' },
    resolve
  ));
  await new Promise((resolve) => api.create(
    { title: 'Daily news headline', url: 'https://news.example.com' },
    resolve
  ));
  const enDefaults = classifier.getDefaults('en');
  const settings = {
    language: 'en',
    categories: enDefaults.categories,
    keywordRules: enDefaults.keywordRules,
    browserBookmarksEnabled: true,
    bookmarkOrganizeEnabled: false
  };

  // 不允许整理：只分类，不写回浏览器收藏夹
  const localOnly = await browserBookmarks.organizeBookmarks(settings, api, classifier.classify);
  assert.equal(localOnly.status, 'ok');
  assert.equal(localOnly.favorites.length, 2);
  assert.equal(localOnly.moved, 0);
  assert.equal(
    [...api.nodes.values()].filter((node) => !node.url && node.title === 'SmartFav').length,
    0
  );

  // 允许整理：书签被移入 SmartFav/分类 文件夹
  const written = await browserBookmarks.organizeBookmarks(
    { ...settings, bookmarkOrganizeEnabled: true },
    api,
    classifier.classify
  );
  assert.equal(written.status, 'ok');
  assert.equal(written.moved, 2);
  const root = [...api.nodes.values()].find((node) => !node.url && node.title === 'SmartFav');
  assert.ok(root);
  const tutorialNode = [...api.nodes.values()].find((node) => node.url === 'https://course.example.com');
  assert.equal(api.nodes.get(tutorialNode.parentId).title, 'Learning');
  assert.equal(api.nodes.get(tutorialNode.parentId).parentId, root.id);
  const newsNode = [...api.nodes.values()].find((node) => node.url === 'https://news.example.com');
  assert.equal(api.nodes.get(newsNode.parentId).title, 'News');

  // SmartFav 文件夹内的书签不会被重复整理
  const secondPass = await browserBookmarks.organizeBookmarks(
    { ...settings, bookmarkOrganizeEnabled: true },
    api,
    classifier.classify
  );
  assert.equal(secondPass.favorites.length, 0);

  // 旧版已经整理到 SmartFav/分类 下的记录仍可被恢复，并保留原分类。
  const managed = await browserBookmarks.collectManagedBookmarks(api, 'Other');
  assert.equal(managed.length, 2);
  assert.equal(
    managed.find((node) => node.url === 'https://course.example.com').category,
    'Learning'
  );
  assert.equal(
    managed.find((node) => node.url === 'https://news.example.com').category,
    'News'
  );

  // isInsideSmartFavFolder：星标自动捕获时用于忽略插件自己写入的记录
  assert.equal(await browserBookmarks.isInsideSmartFavFolder(api, tutorialNode), true);
  const outsideNode = { id: 'x', parentId: 'other', url: 'https://outside.example.com' };
  assert.equal(await browserBookmarks.isInsideSmartFavFolder(api, outsideNode), false);

  // placeBookmarkInCategory：把新捕获的书签移动到对应分类
  const created = await new Promise((resolve) => api.create(
    { title: 'GitHub repo', url: 'https://github.com/example' },
    resolve
  ));
  await browserBookmarks.placeBookmarkInCategory(api, created.id, 'Programming');
  const movedNode = api.nodes.get(created.id);
  assert.equal(api.nodes.get(movedNode.parentId).title, 'Programming');
}

function createBackgroundHarness(initialSettings, initialFavorites = []) {
  const bookmarks = createMockBookmarks();
  const state = {
    settings: { ...initialSettings },
    favorites: [...initialFavorites]
  };
  const listeners = {};
  const errors = [];
  const chromeMock = {
    bookmarks: {
      ...bookmarks,
      onCreated: {
        addListener(listener) {
          listeners.onCreated = listener;
        }
      }
    },
    i18n: {
      getUILanguage() {
        return 'en-US';
      }
    },
    runtime: {
      lastError: null,
      onInstalled: {
        addListener(listener) {
          listeners.onInstalled = listener;
        }
      },
      onMessage: {
        addListener(listener) {
          listeners.onMessage = listener;
        }
      }
    },
    storage: {
      local: {
        get(keys, callback) {
          const requested = Array.isArray(keys) ? keys : Object.keys(keys || {});
          callback(Object.fromEntries(requested.map((key) => [key, state[key]])));
        },
        set(values, callback) {
          Object.assign(state, values);
          if (callback) callback();
        }
      }
    }
  };
  const context = vm.createContext({
    chrome: chromeMock,
    SmartFavClassifier: classifier,
    SmartFavBookmarks: browserBookmarks,
    importScripts() {},
    console: {
      log() {},
      error(...args) {
        errors.push(args);
      }
    }
  });
  vm.runInContext(backgroundJs, context, { filename: 'background.js' });
  return { bookmarks, state, listeners, errors, context };
}

async function createBookmark(api, data) {
  return new Promise((resolve) => api.create(data, resolve));
}

async function fireBookmarkCreated(harness, node) {
  harness.listeners.onCreated(node.id, node);
  await new Promise((resolve) => setImmediate(resolve));
}

async function sendBackgroundMessage(harness, message) {
  return new Promise((resolve) => {
    const keepsChannelOpen = harness.listeners.onMessage(message, {}, resolve);
    assert.equal(keepsChannelOpen, true);
  });
}

async function verifyBackgroundBookmarkFlows() {
  const enDefaults = classifier.getDefaults('en');
  const baseSettings = {
    language: 'en',
    categories: enDefaults.categories,
    keywordRules: enDefaults.keywordRules,
    browserBookmarksEnabled: false,
    bookmarkWriteMode: 'overwrite',
    bookmarkOrganizeEnabled: false,
    bookmarkAutoCaptureEnabled: false
  };

  // 重新加载扩展且本地 storage 为空时，应从旧 SmartFav/分类 目录恢复，
  // 保留旧分类并把自定义分类补回设置，不能移动或重复导入浏览器收藏。
  const recoveryHarness = createBackgroundHarness(baseSettings);
  const legacyRoot = await createBookmark(recoveryHarness.bookmarks, {
    title: 'SmartFav'
  });
  const legacyLearning = await createBookmark(recoveryHarness.bookmarks, {
    parentId: legacyRoot.id,
    title: 'Learning'
  });
  const legacyCustom = await createBookmark(recoveryHarness.bookmarks, {
    parentId: legacyRoot.id,
    title: 'Research'
  });
  const legacyCourse = await createBookmark(recoveryHarness.bookmarks, {
    parentId: legacyLearning.id,
    title: 'Existing course',
    url: 'https://legacy.example.com/course'
  });
  const legacyPaper = await createBookmark(recoveryHarness.bookmarks, {
    parentId: legacyCustom.id,
    title: 'Existing paper',
    url: 'https://legacy.example.com/paper'
  });
  const recoveryResult = await sendBackgroundMessage(
    recoveryHarness,
    { type: 'recoverManagedFavorites' }
  );
  assert.equal(recoveryResult.status, 'ok');
  assert.equal(recoveryResult.total, 2);
  assert.equal(recoveryResult.recovered, 2);
  assert.equal(recoveryResult.categoriesAdded, 1);
  assert.equal(recoveryHarness.state.favorites.length, 2);
  assert.equal(
    recoveryHarness.state.favorites.find(
      (favorite) => favorite.url === legacyCourse.url
    ).category,
    'Learning'
  );
  assert.equal(
    recoveryHarness.state.favorites.find(
      (favorite) => favorite.url === legacyPaper.url
    ).category,
    'Research'
  );
  assert.ok(recoveryHarness.state.settings.categories.includes('Research'));
  assert.equal(recoveryHarness.bookmarks.nodes.get(legacyCourse.id).parentId, legacyLearning.id);
  assert.equal(recoveryHarness.bookmarks.nodes.get(legacyPaper.id).parentId, legacyCustom.id);
  const repeatedRecovery = await sendBackgroundMessage(
    recoveryHarness,
    { type: 'recoverManagedFavorites' }
  );
  assert.equal(repeatedRecovery.recovered, 0);
  assert.equal(recoveryHarness.state.favorites.length, 2);

  // 开启同步时，插件删除先移除 SmartFav 受管浏览器收藏，再删除本地记录；
  // 外部文件夹中的同网址收藏继续保留。
  const syncedDeleteUrl = 'https://delete-sync.example.com';
  const syncedDeleteHarness = createBackgroundHarness(
    { ...baseSettings, browserBookmarksEnabled: true },
    [{
      title: 'Delete with sync',
      url: syncedDeleteUrl,
      category: 'Tools',
      createdAt: 1
    }]
  );
  await browserBookmarks.writeFavorite(
    {
      title: 'Delete with sync',
      url: syncedDeleteUrl,
      category: 'Tools'
    },
    syncedDeleteHarness.state.settings,
    syncedDeleteHarness.bookmarks
  );
  const externalDeleteCopy = await createBookmark(syncedDeleteHarness.bookmarks, {
    title: 'Keep external copy',
    url: syncedDeleteUrl
  });
  const syncedDeleteResult = await sendBackgroundMessage(
    syncedDeleteHarness,
    { type: 'deleteFavorite', url: syncedDeleteUrl }
  );
  assert.equal(syncedDeleteResult.status, 'ok');
  assert.equal(syncedDeleteResult.removed, 1);
  assert.equal(syncedDeleteResult.browserRemoved, 1);
  assert.equal(syncedDeleteHarness.state.favorites.length, 0);
  const syncedDeleteMatches = [...syncedDeleteHarness.bookmarks.nodes.values()]
    .filter((node) => node.url === syncedDeleteUrl);
  assert.equal(syncedDeleteMatches.length, 1);
  assert.equal(syncedDeleteMatches[0].id, externalDeleteCopy.id);

  // 关闭同步时只删除 SmartFav 本地记录，浏览器收藏保持不变。
  const localDeleteUrl = 'https://delete-local.example.com';
  const localDeleteHarness = createBackgroundHarness(
    baseSettings,
    [{
      title: 'Delete locally',
      url: localDeleteUrl,
      category: 'Other',
      createdAt: 1
    }]
  );
  const localBrowserCopy = await createBookmark(localDeleteHarness.bookmarks, {
    title: 'Keep browser copy',
    url: localDeleteUrl
  });
  const localDeleteResult = await sendBackgroundMessage(
    localDeleteHarness,
    { type: 'deleteFavorite', url: localDeleteUrl }
  );
  assert.equal(localDeleteResult.status, 'ok');
  assert.equal(localDeleteResult.browserRemoved, 0);
  assert.equal(localDeleteHarness.state.favorites.length, 0);
  assert.ok(localDeleteHarness.bookmarks.nodes.has(localBrowserCopy.id));

  // 浏览器同步失败时不能先删本地记录，否则会产生不可恢复的不一致。
  const failedDeleteHarness = createBackgroundHarness(
    { ...baseSettings, browserBookmarksEnabled: true },
    [{
      title: 'Keep on failure',
      url: 'https://delete-failure.example.com',
      category: 'Other',
      createdAt: 1
    }]
  );
  failedDeleteHarness.context.chrome.bookmarks = null;
  const failedDeleteResult = await sendBackgroundMessage(
    failedDeleteHarness,
    { type: 'deleteFavorite', url: 'https://delete-failure.example.com' }
  );
  assert.equal(failedDeleteResult.status, 'error');
  assert.equal(failedDeleteHarness.state.favorites.length, 1);

  // 即使关闭普通写入，"立即整理"仍会读取浏览器收藏并仅导入 SmartFav。
  const localHarness = createBackgroundHarness(baseSettings, [{
    title: 'Old title',
    url: 'https://developer.example.com/tutorial',
    category: 'Other',
    tags: [],
    summary: 'Old classification',
    classificationSource: 'local',
    createdAt: 1
  }]);
  await createBookmark(localHarness.bookmarks, {
    title: 'JavaScript tutorial',
    url: 'https://developer.example.com/tutorial'
  });
  await createBookmark(localHarness.bookmarks, {
    title: 'JavaScript tutorial duplicate',
    url: 'https://developer.example.com/tutorial'
  });
  await createBookmark(localHarness.bookmarks, {
    title: 'Daily news',
    url: 'https://news.example.com/story'
  });
  const localResult = await sendBackgroundMessage(localHarness, { type: 'organizeBookmarks' });
  assert.equal(localResult.status, 'ok');
  assert.equal(localResult.total, 3);
  assert.equal(localResult.imported, 1);
  assert.equal(localResult.updated, 1);
  assert.equal(localResult.moved, 0);
  assert.equal(localResult.wroteBack, false);
  assert.equal(localHarness.state.favorites.length, 2);
  assert.equal(
    localHarness.state.favorites.find(
      (favorite) => favorite.url === 'https://developer.example.com/tutorial'
    ).category,
    'Programming'
  );
  assert.equal(
    [...localHarness.bookmarks.nodes.values()]
      .filter((node) => !node.url && node.title === 'SmartFav').length,
    0
  );

  // 允许整理后，同一批外部收藏会移动到浏览器 SmartFav 分类文件夹。
  localHarness.state.settings = {
    ...localHarness.state.settings,
    bookmarkOrganizeEnabled: true
  };
  const writeBackResult = await sendBackgroundMessage(
    localHarness,
    { type: 'organizeBookmarks' }
  );
  assert.equal(writeBackResult.status, 'ok');
  assert.equal(writeBackResult.imported, 0);
  assert.equal(writeBackResult.updated, 0);
  assert.equal(writeBackResult.moved, 3);
  assert.equal(writeBackResult.wroteBack, true);
  const organizedNode = [...localHarness.bookmarks.nodes.values()]
    .find((node) => node.url === 'https://developer.example.com/tutorial');
  assert.equal(localHarness.bookmarks.nodes.get(organizedNode.parentId).title, 'Programming');

  // 自动获取与整理开关独立：关闭整理时只进入 SmartFav，不移动原收藏。
  const captureHarness = createBackgroundHarness({
    ...baseSettings,
    browserBookmarksEnabled: false,
    bookmarkAutoCaptureEnabled: true,
    bookmarkOrganizeEnabled: false
  });
  const starred = await createBookmark(captureHarness.bookmarks, {
    title: 'Daily news headline',
    url: 'https://news.example.com/story'
  });
  await fireBookmarkCreated(captureHarness, starred);
  assert.equal(captureHarness.state.favorites.length, 1);
  assert.equal(captureHarness.state.favorites[0].category, 'News');
  assert.equal(captureHarness.bookmarks.nodes.get(starred.id).parentId, 'other');

  // 自动获取 + 允许整理：加入 SmartFav 后，同时移动浏览器原收藏到匹配分类。
  const captureAndMoveHarness = createBackgroundHarness({
    ...baseSettings,
    browserBookmarksEnabled: false,
    bookmarkAutoCaptureEnabled: true,
    bookmarkOrganizeEnabled: true
  });
  const starredRepo = await createBookmark(captureAndMoveHarness.bookmarks, {
    title: 'GitHub coding project',
    url: 'https://github.com/example/project'
  });
  await fireBookmarkCreated(captureAndMoveHarness, starredRepo);
  assert.equal(captureAndMoveHarness.state.favorites.length, 1);
  assert.equal(captureAndMoveHarness.state.favorites[0].category, 'Programming');
  const movedStarredRepo = captureAndMoveHarness.bookmarks.nodes.get(starredRepo.id);
  assert.equal(
    captureAndMoveHarness.bookmarks.nodes.get(movedStarredRepo.parentId).title,
    'Programming'
  );

  // SmartFav 写入和浏览器星标两条路径产生同网址时，覆盖模式最终只保留一条。
  const overwriteCaptureHarness = createBackgroundHarness({
    ...baseSettings,
    browserBookmarksEnabled: true,
    bookmarkWriteMode: 'overwrite',
    bookmarkAutoCaptureEnabled: true,
    bookmarkOrganizeEnabled: true
  });
  await browserBookmarks.writeFavorite(
    {
      title: 'Existing SmartFav page',
      url: 'https://duplicate.example.com',
      category: 'Tools'
    },
    overwriteCaptureHarness.state.settings,
    overwriteCaptureHarness.bookmarks
  );
  const duplicateStar = await createBookmark(overwriteCaptureHarness.bookmarks, {
    title: 'Duplicate browser star',
    url: 'https://duplicate.example.com'
  });
  await fireBookmarkCreated(overwriteCaptureHarness, duplicateStar);
  const duplicateMatches = [...overwriteCaptureHarness.bookmarks.nodes.values()]
    .filter((node) => node.url === 'https://duplicate.example.com');
  assert.equal(duplicateMatches.length, 1);
  assert.equal(overwriteCaptureHarness.state.favorites.length, 1);

  // 只开启整理时不写入 SmartFav，但新增星标仍会自动进入匹配浏览器分类。
  const organizeOnlyHarness = createBackgroundHarness({
    ...baseSettings,
    browserBookmarksEnabled: false,
    bookmarkAutoCaptureEnabled: false,
    bookmarkOrganizeEnabled: true
  });
  const organizeOnly = await createBookmark(organizeOnlyHarness.bookmarks, {
    title: 'JavaScript coding guide',
    url: 'https://organize-only.example.com'
  });
  await fireBookmarkCreated(organizeOnlyHarness, organizeOnly);
  assert.equal(organizeOnlyHarness.state.favorites.length, 0);
  const organizedOnlyNode = organizeOnlyHarness.bookmarks.nodes.get(organizeOnly.id);
  assert.equal(
    organizeOnlyHarness.bookmarks.nodes.get(organizedOnlyNode.parentId).title,
    'Programming'
  );

  // 自动获取和整理均关闭时，新增浏览器星标保持原位且不写入 SmartFav。
  const disabledHarness = createBackgroundHarness(baseSettings);
  const ignored = await createBookmark(disabledHarness.bookmarks, {
    title: 'Ignored page',
    url: 'https://ignored.example.com'
  });
  await fireBookmarkCreated(disabledHarness, ignored);
  assert.equal(disabledHarness.state.favorites.length, 0);
  assert.equal(disabledHarness.bookmarks.nodes.get(ignored.id).parentId, 'other');

  // SmartFav 自身目录内的新记录不会循环捕获。
  const selfHarness = createBackgroundHarness({
    ...baseSettings,
    bookmarkAutoCaptureEnabled: true,
    bookmarkOrganizeEnabled: true
  });
  const selfCreated = await createBookmark(selfHarness.bookmarks, {
    title: 'SmartFav managed page',
    url: 'https://managed.example.com'
  });
  await browserBookmarks.placeBookmarkInCategory(
    selfHarness.bookmarks,
    selfCreated.id,
    'Tools'
  );
  await fireBookmarkCreated(selfHarness, selfHarness.bookmarks.nodes.get(selfCreated.id));
  assert.equal(selfHarness.state.favorites.length, 0);

  assert.equal(typeof captureHarness.listeners.onCreated, 'function');
  assert.equal(captureHarness.errors.length, 0);
}

async function main() {
  verifyManifestAndLocales();
  verifyBilingualClassification();
  await verifyBookmarkModes();
  await verifyOrganizeBookmarks();
  await verifyBackgroundBookmarkFlows();
  console.log('SmartFav extension verification passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
