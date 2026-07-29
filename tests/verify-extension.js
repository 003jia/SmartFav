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
const bookmarkBackup = require(path.join(extensionRoot, 'bookmark-backup.js'));
const aiClient = require(path.join(extensionRoot, 'ai-client.js'));
const aiKeywordSuggestions = require(path.join(extensionRoot, 'ai-keyword-suggestions.js'));
const orderUtils = require(path.join(extensionRoot, 'order-utils.js'));

function verifyManifestAndLocales() {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, '1.14.2');
  assert.equal(manifest.default_locale, 'zh_CN');
  assert.equal(manifest.name, '__MSG_extensionName__');
  assert.equal(manifest.description, '__MSG_extensionDescription__');
  assert.ok(manifest.permissions.includes('bookmarks'));
  assert.ok(manifest.permissions.includes('alarms'));
  assert.ok(manifest.permissions.includes('notifications'));
  assert.deepEqual(manifest.optional_host_permissions, [
    'https://*/*',
    'http://localhost/*',
    'http://127.0.0.1/*'
  ]);
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
  assert.equal(enMessages.extensionName.message, 'SmartFav - Bookmark Organizer');
  assert.match(popupHtml, /id="languageBtn"/);
  assert.match(popupHtml, /id="modeBtn"/);
  assert.doesNotMatch(popupHtml, /id="embeddedCloseBtn"/);
  assert.match(popupHtml, /id="compactThemeStyle"/);
  assert.match(popupHtml, /id="compactNewCategory"/);
  assert.match(popupHtml, /id="compactAddCategoryBtn"/);
  assert.match(popupHtml, /id="categoryRulesList"/);
  assert.match(popupHtml, /id="categoryKeywordAiAnalyzeBtn"/);
  assert.match(popupHtml, /id="aiKeywordAssistantHint"/);
  assert.match(popupHtml, /id="keywordSeparatorHint"[^>]*data-i18n="keywordSeparatorHint"/);
  assert.match(popupHtml, /id="favoritesNavBtn"/);
  assert.match(popupHtml, /id="categoryFoldersNavBtn"/);
  assert.match(popupHtml, /id="favoritesView"/);
  assert.match(popupHtml, /id="favoritesReorderStatus"[^>]*aria-live="polite"/);
  assert.match(popupHtml, /id="classificationLearningPrompt"/);
  assert.match(popupHtml, /id="classificationLearningRememberBtn"/);
  assert.match(popupHtml, /id="classificationLearningDismissBtn"/);
  assert.match(popupHtml, /id="confidenceBadge"/);
  assert.match(popupHtml, /id="pageLearningOption"/);
  assert.match(popupHtml, /id="pageLearningCheckbox"/);
  assert.match(popupHtml, /id="pageLearningUndoBtn"/);
  assert.doesNotMatch(popupHtml, /id="categorySummary"[^>]*data-i18n=/);
  assert.match(popupHtml, /id="categoriesView"/);
  assert.match(popupHtml, /id="trashView"/);
  assert.match(popupHtml, /id="favoritesBackBtn"/);
  assert.match(popupHtml, /id="categoriesBackBtn"/);
  assert.match(popupHtml, /id="trashBackBtn"/);
  assert.match(popupHtml, /id="trashNavBtn"/);
  assert.match(popupHtml, /id="categorySaveBtn"/);
  assert.match(popupHtml, /id="compactPopupWidth"/);
  assert.match(popupHtml, /id="compactPopupHeight"/);
  assert.match(popupHtml, /id="compactBackgroundImage"/);
  assert.match(popupHtml, /id="clearBackgroundImageBtn"/);
  assert.match(popupHtml, /id="compactClassificationMode"/);
  assert.match(popupHtml, /id="compactKeywordWeight"/);
  assert.match(popupHtml, /id="compactAiAutoClassify"/);
  assert.match(popupHtml, /id="compactAiCreateCategories"/);
  assert.match(popupHtml, /value="openai_compatible"/);
  assert.match(popupHtml, /value="anthropic_compatible"/);
  assert.match(popupHtml, /id="compactApiEndpoint"/);
  assert.match(popupHtml, /id="compactApiEndpointField"/);
  const mainViewHtml = popupHtml.match(/<main id="mainView">([\s\S]*?)<\/main>/)?.[1] || '';
  assert.doesNotMatch(mainViewHtml, /id="recentSection"|id="foldersList"|id="categoryRulesList"/);
  assert.doesNotMatch(popupHtml, /id="libraryPanel"|id="libraryToggleBtn"/);
  assert.doesNotMatch(popupHtml, /id="compactKeywordRules"/);
  ['glass', 'white', 'gray', 'black', 'parchment'].forEach((themeStyle) => {
    assert.match(popupHtml, new RegExp(`option value="${themeStyle}"`));
  });
  assert.match(popupHtml, /id="compactBookmarkWriteMode"/);
  assert.match(popupHtml, /id="compactBookmarkOrganizeEnabled"/);
  assert.match(popupHtml, /id="compactBookmarkAutoCapture"/);
  assert.match(popupHtml, /id="compactOrganizeBtn"/);
  assert.match(popupHtml, /id="bookmarkBackupCreateBtn"/);
  assert.match(popupHtml, /id="bookmarkBackupPreviewBtn"/);
  assert.match(popupHtml, /id="bookmarkBackupRestoreBtn"/);
  assert.match(popupHtml, /id="bookmarkBackupExportBtn"/);
  assert.match(popupHtml, /id="bookmarkBackupImportInput"/);
  assert.doesNotMatch(popupHtml, /id="compactSaveBtn"/);
  assert.doesNotMatch(popupJs, /compactSaveBtn/);
  assert.match(popupJs, /async function persistSettingsPatch\(/);
  assert.match(popupJs, /settingsAutoSaved/);
  assert.match(popupJs, /bookmarkRestoreLegacyOnlyBadge/);
  assert.match(popupJs, /hasRestorableBookmarkPoint/);
  assert.match(
    popupHtml,
    /id="compactBookmarkFields"[\s\S]*?<\/div>\s*<label class="compact-toggle" for="compactBookmarkOrganizeEnabled"/
  );
  assert.match(popupHtml, /class="compact-toggle" for="compactBookmarkAutoCapture"/);
  assert.match(popupHtml, /class="bookmark-actions"/);
  assert.match(backgroundJs, /chrome\.bookmarks\.onCreated\.addListener/);
  assert.match(backgroundJs, /chrome\.bookmarks\.onRemoved\.addListener/);
  assert.match(backgroundJs, /chrome\.bookmarks\.onMoved\.addListener/);
  assert.match(backgroundJs, /chrome\.notifications\.create/);
  assert.match(backgroundJs, /pendingBrowserActivity/);
  assert.match(backgroundJs, /organizeBookmarks/);
  assert.match(backgroundJs, /importScripts\([^)]*bookmark-backup\.js/);
  assert.match(backgroundJs, /importScripts\([^)]*order-utils\.js/);
  assert.match(backgroundJs, /ensureBookmarkRestorePointUnlocked/);
  assert.match(backgroundJs, /message\.type === 'getBookmarkRestorePoints'/);
  assert.match(backgroundJs, /message\.type === 'createBookmarkRestorePoint'/);
  assert.match(backgroundJs, /message\.type === 'previewBookmarkRestore'/);
  assert.match(backgroundJs, /message\.type === 'restoreBookmarkLayout'/);
  assert.match(backgroundJs, /message\.type === 'exportBookmarkRestorePoints'/);
  assert.match(backgroundJs, /message\.type === 'importBookmarkRestorePoints'/);
  assert.match(backgroundJs, /recoverManagedFavorites/);
  assert.match(backgroundJs, /collectManagedBookmarks/);
  assert.match(popupJs, /type:\s*'recoverManagedFavorites'/);
  assert.match(backgroundJs, /SmartFavBookmarks\.removeFavorite/);
  assert.match(backgroundJs, /async function reclassifyFavorites\(\)/);
  assert.match(backgroundJs, /SmartFavBookmarks\.syncManagedCategories/);
  assert.match(backgroundJs, /SmartFavBookmarks\.syncManagedOrder/);
  assert.match(backgroundJs, /message\.type === 'reclassifyFavorites'/);
  assert.match(backgroundJs, /message\.type === 'syncManagedOrder'/);
  assert.match(backgroundJs, /message\.type === 'moveFavoriteToCategory'/);
  assert.match(backgroundJs, /message\.type === 'deleteFavorite'/);
  assert.match(backgroundJs, /message\.type === 'getRecentlyDeleted'/);
  assert.match(backgroundJs, /message\.type === 'restoreDeletedFavorite'/);
  assert.match(backgroundJs, /message\.type === 'permanentlyDeleteFavorite'/);
  assert.match(backgroundJs, /TRASH_RETENTION_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(backgroundJs, /chrome\.alarms\.onAlarm\.addListener/);
  assert.match(popupJs, /type:\s*'deleteFavorite',\s*url/);
  assert.match(popupJs, /type:\s*'reclassifyFavorites'/);
  assert.match(popupJs, /sendRuntimeMessage\('syncManagedOrder', \{ order \}\)/);
  assert.match(popupJs, /orderSyncedToBrowser/);
  assert.equal(typeof browserBookmarks.syncManagedOrder, 'function');
  assert.equal(typeof browserBookmarks.moveManagedFavorite, 'function');
  assert.equal(typeof browserBookmarks.getManagedBookmarkInfo, 'function');
  assert.match(popupJs, /async function showView\(view\)/);
  assert.match(popupJs, /activeView === 'favorites'/);
  assert.match(popupJs, /activeView === 'categories'/);
  assert.match(popupJs, /activeView === 'trash'/);
  assert.match(popupJs, /async function applyAIResponse\(response\)/);
  assert.match(popupJs, /currentSettings\.aiCreateCategories/);
  assert.match(popupJs, /classificationMode/);
  assert.match(popupJs, /customBackgroundImage/);
  assert.match(popupJs, /chrome\.permissions\.request\(\{ origins: \[validation\.originPattern\] \}/);
  assert.match(popupJs, /SmartFavAI\.validateEndpoint/);
  assert.match(popupJs, /async function renderRecentlyDeleted\(\)/);
  assert.match(popupJs, /async function showPendingBrowserActivity\(\)/);
  assert.match(
    popupJs,
    /<textarea[\s\S]{0,260}class="category-keywords-input"[\s\S]{0,260}aria-describedby="keywordSeparatorHint"/
  );
  assert.match(
    popupJs,
    /categoryRulesList\.addEventListener\('focusout',[\s\S]{0,180}updateCategoryKeywordsFromInput\(event\.target, \{ format: true \}\)/
  );
  assert.match(popupJs, /chrome\.storage\.onChanged\.addListener/);
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
  assert.match(popupJs, /const saved = await persistBookmarkSettings/);
  assert.match(popupJs, /if \(saved && enabled\) await runOrganizeBookmarks\(\)/);
  assert.match(popupJs, /class="favorite-delete-button"/);
  assert.match(popupJs, /class="favorite-move-select"/);
  assert.match(popupJs, /sendRuntimeMessage\('moveFavoriteToCategory'/);
  assert.match(popupJs, /SmartFavOrder\.moveFavoriteAcrossCategories/);
  assert.match(popupJs, /SmartFavClassifier\.createDomainLearningProposal\(/);
  assert.match(popupJs, /SmartFavClassifier\.applyDomainLearning\(/);
  assert.match(popupJs, /SmartFavClassifier\.revertDomainLearning\(/);
  assert.match(popupJs, /elements\.pageLearningCheckbox\.checked = !isFallback/);
  assert.match(popupJs, /suggestedCategory: recommendedCategory/);
  assert.match(popupJs, /manuallyCategorized: selectedCategory !== recommendedCategory/);
  assert.match(popupJs, /schedulePopupClose\(learningResult \? 6500 : 1300\)/);
  assert.match(popupJs, /await storageSet\(\{ settings: currentSettings \}\)/);
  assert.match(
    popupJs,
    /class="favorite-row favorite-row-card\$\{inFolder \? ' favorite-row-in-folder' : ''\}"/
  );
  assert.match(popupJs, /draggable="true"[\s\S]{0,160}data-category=/);
  assert.match(popupJs, /data-favorite-url=/);
  assert.match(popupJs, /SmartFavOrder\.reorderValues/);
  assert.match(popupJs, /SmartFavOrder\.reorderFavoriteUrls/);
  assert.match(popupJs, /SmartFavOrder\.moveFavoriteUrl/);
  assert.match(popupJs, /storageSet\(\{ favoriteOrder: nextFavoriteOrder \}\)/);
  assert.match(popupJs, /aria-keyshortcuts="Alt\+ArrowUp Alt\+ArrowDown"/);
  assert.match(
    popupHtml,
    /<script src="order-utils\.js\?v=[^"]+"><\/script>\s*<script src="popup\.js/
  );
  assert.match(
    popupHtml,
    /<script src="ai-client\.js\?v=[^"]+"><\/script>\s*<script src="ai-keyword-suggestions\.js/
  );
  assert.match(popupJs, /async function analyzeCategoryKeywordsWithAI\(\)/);
  assert.match(popupJs, /SmartFavAIKeywordSuggestions\.buildCategoryProfiles/);
  assert.match(popupJs, /SmartFavAIKeywordSuggestions\.mergeIntoCategoryDraft/);
  assert.match(popupJs, /const metadata = showCategory \? `\$\{category\} · \$\{hostname\}` : hostname/);
  assert.match(popupJs, /class="category-count"/);
  assert.match(popupJs, /class="favorite-list-rows"/);
  assert.match(popupJs, /const categoryToKeep = activeView === 'favorites' \? activeFavoriteCategory : null/);
  assert.match(
    popupJs,
    /if \(categoryToKeep\) \{[\s\S]{0,360}showFavoritesByCategory\(categoryToKeep, favorites, result\.favoriteOrder\)/
  );
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
  assert.match(popupCss, /--popup-width:\s*360px/);
  assert.match(popupCss, /--popup-height:\s*560px/);
  assert.match(popupCss, /html,\s*body\s*\{[^}]*width:\s*var\(--popup-width\);[^}]*height:\s*var\(--popup-height\);/s);
  assert.match(popupCss, /html,\s*body\s*\{[^}]*border-radius:\s*var\(--shell-radius\);[^}]*overflow:\s*hidden;/s);
  assert.match(popupCss, /body\s*\{[^}]*padding:\s*0;[^}]*contain:\s*paint;/s);
  assert.match(popupCss, /--shell-radius:\s*0/);
  assert.match(popupCss, /\.app-shell\s*\{[^}]*border:\s*0;[^}]*border-radius:\s*0;[^}]*box-shadow:\s*none;/s);
  assert.match(popupCss, /\.panel-view,\s*\.settings-view\s*\{[^}]*overflow-y:\s*auto;/s);
  assert.match(popupCss, /\.content-back-button\s*\{/);
  assert.match(popupCss, /\.background-image-field\s*\{/);
  assert.match(popupCss, /\.trash-row\s*\{/);
  assert.match(popupCss, /\.favorite-row-in-folder\s*\{/);
  assert.match(popupCss, /\.favorite-row-card\s*\{/);
  assert.match(popupCss, /\.favorite-row-card \.recent-title\s*\{[^}]*-webkit-line-clamp:\s*2;/s);
  assert.match(popupCss, /\.favorite-row-card \.favorite-delete-button\s*\{[^}]*min-width:\s*48px;/s);
  assert.match(popupCss, /\.learning-prompt\s*\{/);
  assert.match(popupCss, /\.confidence-badge\.confidence-high\s*\{/);
  assert.match(popupCss, /\.page-learning-option\s*\{/);
  assert.match(popupCss, /\.notice-action\s*\{/);
  assert.match(popupCss, /\.reorder-grip\s*\{/);
  assert.match(popupCss, /\.folder-item\.is-drop-before,/);
  assert.match(popupCss, /\.favorite-row-in-folder\.is-drop-before\s*\{/);
  assert.match(
    popupCss,
    /\.appearance-toggle input\[type="checkbox"\],[\s\S]{0,320}\.page-learning-option input\[type="checkbox"\]\s*\{[^}]*flex:\s*0 0 18px;[^}]*width:\s*18px;[^}]*height:\s*18px;[^}]*appearance:\s*none;/s
  );
  assert.match(
    popupCss,
    /input\[type="checkbox"\]:focus-visible[\s\S]{0,260}box-shadow:\s*inset 0 0 0 2px var\(--focus-ring\);/
  );
  assert.match(popupCss, /\.category-count\s*\{/);
  assert.match(popupCss, /data-custom-background="true"/);
  assert.match(popupCss, /\.home-navigation-item\s*\{[^}]*min-height:\s*54px;/s);
  assert.match(popupCss, /--shadow:\s*none/);
  assert.match(popupCss, /blur\(18px\)\s+saturate\(135%\)/);
  assert.match(
    popupCss,
    /\.button-primary:hover:not\(:disabled\)\s*\{[^}]*box-shadow:\s*inset 0 0 0 999px rgba\(0,\s*0,\s*0,\s*0\.12\);/s
  );
  assert.doesNotMatch(
    popupCss,
    /\.button-primary:hover[^{]*\{[^}]*background:/s
  );
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

function verifyManualOrdering() {
  assert.deepEqual(
    orderUtils.reorderValues(['视频', '编程', '工具', '学习'], '学习', '编程', 'before'),
    ['视频', '学习', '编程', '工具']
  );
  assert.deepEqual(
    orderUtils.reorderValues(['视频', '编程', '工具', '学习'], '视频', '工具', 'after'),
    ['编程', '工具', '视频', '学习']
  );
  assert.deepEqual(
    orderUtils.moveValue(['视频', '编程', '工具'], '编程', 1),
    ['视频', '工具', '编程']
  );
  assert.deepEqual(
    orderUtils.moveValue(['视频', '编程', '工具'], '视频', -1),
    ['视频', '编程', '工具']
  );

  const favorites = [
    { title: 'Alpha', url: 'https://alpha.example.com', category: '编程' },
    { title: 'Design', url: 'https://design.example.com', category: '工具' },
    { title: 'Beta', url: 'https://beta.example.com', category: '编程' },
    { title: 'Gamma', url: 'https://gamma.example.com', category: '编程' }
  ];
  const reorderedUrls = orderUtils.reorderFavoriteUrls(
    favorites,
    '编程',
    [],
    'https://alpha.example.com',
    'https://gamma.example.com',
    'after'
  );
  assert.deepEqual(reorderedUrls, [
    'https://beta.example.com',
    'https://gamma.example.com',
    'https://alpha.example.com'
  ]);
  assert.deepEqual(
    orderUtils.applyFavoriteOrder(favorites, '编程', reorderedUrls)
      .map((favorite) => favorite.title),
    ['Beta', 'Gamma', 'Alpha']
  );

  const favoritesWithNewItem = [
    { title: 'Newest', url: 'https://new.example.com', category: '编程' },
    ...favorites
  ];
  assert.deepEqual(
    orderUtils.applyFavoriteOrder(favoritesWithNewItem, '编程', reorderedUrls)
      .map((favorite) => favorite.title),
    ['Newest', 'Beta', 'Gamma', 'Alpha']
  );
  assert.deepEqual(
    orderUtils.moveFavoriteUrl(
      favorites,
      '编程',
      reorderedUrls,
      'https://gamma.example.com',
      -1
    ),
    [
      'https://gamma.example.com',
      'https://beta.example.com',
      'https://alpha.example.com'
    ]
  );

  const crossCategory = orderUtils.moveFavoriteAcrossCategories(
    favorites,
    {
      编程: [
        'https://beta.example.com',
        'https://gamma.example.com',
        'https://alpha.example.com'
      ],
      工具: ['https://design.example.com']
    },
    'https://beta.example.com',
    '工具'
  );
  assert.equal(crossCategory.status, 'ok');
  assert.equal(crossCategory.previousCategory, '编程');
  assert.equal(crossCategory.favorite.category, '工具');
  assert.deepEqual(crossCategory.favoriteOrder.编程, [
    'https://gamma.example.com',
    'https://alpha.example.com'
  ]);
  assert.deepEqual(crossCategory.favoriteOrder.工具, [
    'https://design.example.com',
    'https://beta.example.com'
  ]);
  assert.deepEqual(
    orderUtils.applyFavoriteOrder(
      crossCategory.favorites,
      '工具',
      crossCategory.favoriteOrder.工具
    ).map((favorite) => favorite.url),
    [
      'https://design.example.com',
      'https://beta.example.com'
    ]
  );
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
  assert.deepEqual(
    classifier.splitKeywords('设计， UI; Figma；\n"UX research", 设计'),
    ['设计', 'UI', 'Figma', 'UX research']
  );
  assert.deepEqual(
    classifier.splitKeywords('design AI machine-learning'),
    ['design', 'AI', 'machine-learning']
  );
  const quotedKeywords = ['design', 'machine learning', 'AI'];
  const formattedKeywords = classifier.formatKeywords(quotedKeywords);
  assert.equal(formattedKeywords, 'design, "machine learning", AI');
  assert.deepEqual(classifier.splitKeywords(formattedKeywords), quotedKeywords);
  const serializedRules = classifier.rulesToText(
    ['Research'],
    { Research: ['machine learning', 'AI'] },
    'en'
  );
  assert.equal(serializedRules, 'Research="machine learning", ai');
  assert.deepEqual(
    classifier.textToRules(serializedRules, ['Research'], 'en'),
    { Research: ['machine learning', 'ai'] }
  );
  assert.match(i18n.MESSAGES.zh_CN.keywordSeparatorHint, /空格/);
  assert.match(i18n.MESSAGES.en.keywordSeparatorHint, /spaces/);
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
  assert.equal(customResult.confidence, 'high');

  const customFolderResult = classifier.classify(
    {
      title: 'GitHub · Build and ship software',
      url: 'https://github.com/',
      description: ''
    },
    {
      language: 'zh_CN',
      categories: [...zhDefaults.categories, '构建'],
      keywordRules: {
        ...zhDefaults.keywordRules,
        构建: ['build']
      }
    }
  );
  assert.equal(customFolderResult.category, '构建');
  assert.deepEqual(customFolderResult.tags, ['build']);

  const weightedKeywordResult = classifier.classify(
    {
      title: 'Weekly notes',
      url: 'https://example.com/notes',
      description: '',
      keywords: ['browser automation', 'playwright']
    },
    {
      language: 'en',
      categories: ['Automation', 'Other'],
      keywordRules: {
        Automation: ['browser automation', 'playwright'],
        Other: []
      },
      classificationMode: 'weighted',
      classificationWeights: {
        title: 1,
        keywords: 10,
        url: 1,
        description: 1
      }
    }
  );
  assert.equal(weightedKeywordResult.category, 'Automation');
  assert.equal(weightedKeywordResult.method, 'weighted');
  assert.equal(weightedKeywordResult.weights.keywords, 10);
  assert.ok(weightedKeywordResult.scoreRatios.Automation > 99);

  const vectorResult = classifier.classify(
    {
      title: 'Vector database guide',
      url: 'https://example.com/guide',
      description: 'Semantic retrieval for an AI knowledge base',
      keywords: ['embeddings', 'semantic search']
    },
    {
      language: 'en',
      categories: ['AI Research', 'Cooking', 'Other'],
      keywordRules: {
        'AI Research': ['vector database', 'embedding', 'semantic retrieval'],
        Cooking: ['recipe', 'kitchen'],
        Other: []
      },
      classificationMode: 'vector'
    }
  );
  assert.equal(vectorResult.category, 'AI Research');
  assert.equal(vectorResult.method, 'vector');
  assert.ok(vectorResult.score > 4);
  assert.ok(vectorResult.scoreRatios['AI Research'] > vectorResult.scoreRatios.Cooking);

  assert.equal(
    classifier.normalizeDomain('https://www.docs.example.com/guide'),
    'docs.example.com'
  );
  assert.equal(classifier.parseDomainRule('domain:docs.example.com'), 'docs.example.com');
  assert.equal(classifier.buildKeywordIndex({
    Research: ['domain:docs.example.com', 'research']
  }).has('domain:docs.example.com'), false);

  const learningSettings = {
    language: 'en',
    categories: ['Programming', 'Research', 'Other'],
    keywordRules: {
      Programming: ['code', 'domain:docs.example.com'],
      Research: ['research'],
      Other: []
    }
  };
  const learningProposal = classifier.createDomainLearningProposal(
    {
      title: 'Example documentation',
      url: 'https://docs.example.com/guide'
    },
    'Research',
    learningSettings
  );
  assert.equal(learningProposal.keyword, 'domain:docs.example.com');
  assert.deepEqual(learningProposal.previousCategories, ['Programming']);
  const learned = classifier.applyDomainLearning(learningSettings, learningProposal);
  assert.ok(learned.settings.keywordRules.Research.includes('domain:docs.example.com'));
  assert.ok(!learned.settings.keywordRules.Programming.includes('domain:docs.example.com'));
  assert.ok(learningSettings.keywordRules.Programming.includes('domain:docs.example.com'));
  const revertedLearning = classifier.revertDomainLearning(learned.settings, learned);
  assert.deepEqual(
    revertedLearning.keywordRules,
    classifier.mergeRules(
      learningSettings.categories,
      learningSettings.keywordRules,
      learningSettings.language
    )
  );
  assert.throws(
    () => classifier.revertDomainLearning(learned.settings, {}),
    /Invalid domain learning rollback/
  );

  const domainResult = classifier.classify(
    {
      title: 'An unrelated title',
      url: 'https://api.docs.example.com/reference',
      description: ''
    },
    learned.settings
  );
  assert.equal(domainResult.category, 'Research');
  assert.equal(domainResult.matchType, 'domain');
  assert.equal(domainResult.confidence, 'high');
  assert.deepEqual(domainResult.tags, ['docs.example.com']);
  assert.match(domainResult.summary, /remembered domain rule/);
  const vectorDomainResult = classifier.classify(
    {
      title: 'Code and programming reference',
      url: 'https://api.docs.example.com/reference',
      description: 'javascript python developer'
    },
    {
      ...learned.settings,
      classificationMode: 'vector'
    }
  );
  assert.equal(vectorDomainResult.category, 'Research');
  assert.equal(vectorDomainResult.matchType, 'domain');
  assert.equal(vectorDomainResult.confidence, 'high');
  assert.equal(
    classifier.createDomainLearningProposal(
      { url: 'https://docs.example.com/another' },
      'Research',
      learned.settings
    ),
    null
  );
  assert.equal(
    classifier.createDomainLearningProposal(
      { url: 'chrome://extensions' },
      'Research',
      learned.settings
    ),
    null
  );

  const fallbackResult = classifier.classify(
    {
      title: 'Unrelated page',
      url: 'https://unknown.example/',
      description: ''
    },
    {
      language: 'en',
      categories: ['Research', 'Other'],
      keywordRules: { Research: ['quantum'], Other: [] }
    }
  );
  assert.equal(fallbackResult.category, 'Other');
  assert.equal(fallbackResult.confidence, 'low');
  assert.equal(i18n.translate('zh_CN', 'confidenceHigh'), '把握高');
  assert.equal(i18n.translate('en', 'rememberClassification'), 'Remember');
  assert.equal(i18n.translate('zh_CN', 'undoRemember'), '撤销记住');
  assert.equal(i18n.translate('en', 'rememberManualCategory'), 'Remember this website category too');
}

async function verifyAIProtocols() {
  assert.equal(aiClient.getProvider('openai_compatible').protocol, 'openai');
  assert.equal(aiClient.getProvider('anthropic_compatible').protocol, 'anthropic');
  assert.equal(aiClient.getProvider('openai_compatible').customEndpoint, true);
  assert.equal(aiClient.getProvider('anthropic_compatible').customEndpoint, true);

  assert.deepEqual(
    aiClient.validateEndpoint('https://gateway.example.com/v1/chat/completions'),
    {
      valid: true,
      endpoint: 'https://gateway.example.com/v1/chat/completions',
      originPattern: 'https://gateway.example.com/*'
    }
  );
  assert.equal(aiClient.validateEndpoint('http://localhost:4000/v1/messages').valid, true);
  assert.equal(aiClient.validateEndpoint('http://127.0.0.1:4000/v1/messages').valid, true);
  assert.equal(aiClient.validateEndpoint('http://gateway.example.com/v1/messages').code, 'insecure');
  assert.equal(aiClient.validateEndpoint('https://key:secret@gateway.example.com/v1/messages').code, 'invalid');

  const originalFetch = global.fetch;
  const requests = [];
  try {
    global.fetch = async (endpoint, options) => {
      requests.push({ endpoint, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: [{ type: 'text', text: '{"status":"openai-ok"}' }]
            }
          }]
        })
      };
    };
    const openAIResult = await aiClient.call('Return JSON', {
      language: 'en',
      apiProvider: 'openai_compatible',
      apiEndpoint: 'https://gateway.example.com/v1/chat/completions',
      apiKey: 'openai-secret',
      model: 'custom-openai-model'
    });
    assert.equal(openAIResult, '{"status":"openai-ok"}');
    assert.equal(requests[0].endpoint, 'https://gateway.example.com/v1/chat/completions');
    assert.equal(requests[0].options.headers.Authorization, 'Bearer openai-secret');
    const openAIBody = JSON.parse(requests[0].options.body);
    assert.equal(openAIBody.model, 'custom-openai-model');
    assert.deepEqual(openAIBody.messages, [{ role: 'user', content: 'Return JSON' }]);
    assert.equal(openAIBody.response_format, undefined);

    global.fetch = async (endpoint, options) => {
      requests.push({ endpoint, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          content: [
            { type: 'text', text: '{"status":' },
            { type: 'text', text: '"anthropic-ok"}' }
          ]
        })
      };
    };
    const anthropicResult = await aiClient.call('Return JSON', {
      language: 'en',
      apiProvider: 'anthropic_compatible',
      apiEndpoint: 'https://api.anthropic.com/v1/messages',
      apiKey: 'anthropic-secret',
      model: 'claude-test'
    });
    assert.equal(anthropicResult, '{"status":\n"anthropic-ok"}');
    const anthropicRequest = requests[1];
    assert.equal(anthropicRequest.endpoint, 'https://api.anthropic.com/v1/messages');
    assert.equal(anthropicRequest.options.headers['x-api-key'], 'anthropic-secret');
    assert.equal(anthropicRequest.options.headers['anthropic-version'], '2023-06-01');
    assert.equal(
      anthropicRequest.options.headers['anthropic-dangerous-direct-browser-access'],
      'true'
    );
    const anthropicBody = JSON.parse(anthropicRequest.options.body);
    assert.equal(anthropicBody.model, 'claude-test');
    assert.equal(anthropicBody.max_tokens, 1024);
    assert.deepEqual(anthropicBody.messages, [{ role: 'user', content: 'Return JSON' }]);
  } finally {
    global.fetch = originalFetch;
  }
}

function verifyAIKeywordSuggestions() {
  const profiles = aiKeywordSuggestions.buildCategoryProfiles(
    [
      {
        name: 'Programming',
        keywords: ['code', 'domain:docs.example.com']
      },
      {
        name: 'Other',
        keywords: []
      }
    ],
    [
      {
        title: 'Codex repository',
        url: 'https://github.com/openai/codex?token=secret#readme',
        category: 'Programming',
        createdAt: 3
      },
      {
        title: 'Developer documentation',
        url: 'https://docs.example.com/guide?account=private',
        category: 'Programming',
        createdAt: 2
      },
      {
        title: 'Older repository page',
        url: 'https://github.com/openai/codex/issues?page=2',
        category: 'Programming',
        createdAt: 1
      },
      {
        title: 'Protected browser page',
        url: 'chrome://extensions',
        category: 'Other',
        createdAt: 4
      }
    ],
    { sampleLimit: 2 }
  );
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].category, 'Programming');
  assert.deepEqual(profiles[0].existingKeywords, ['code']);
  assert.equal(profiles[0].totalFavorites, 3);
  assert.deepEqual(
    profiles[0].samples.map((sample) => sample.domain),
    ['github.com', 'docs.example.com']
  );
  const serializedProfiles = JSON.stringify(profiles);
  assert.doesNotMatch(serializedProfiles, /token|secret|account|private|#readme/);
  assert.match(serializedProfiles, /\/openai\/codex/);
  assert.equal(aiKeywordSuggestions.createBatches(Array(11).fill({}), 5).length, 3);

  const parsed = aiKeywordSuggestions.parseKeywordSuggestions(
    '```json\n{"categories":[{"category":"Programming","keywords":["agent coding","code","domain:evil.example","https://evil.example","AI, TypeScript"]},{"category":"Unknown","keywords":["ignore"]}]}\n```',
    ['Programming', 'Other']
  );
  assert.deepEqual(parsed, [{
    category: 'Programming',
    keywords: ['agent coding', 'code', 'AI', 'TypeScript']
  }]);

  const merged = aiKeywordSuggestions.mergeIntoCategoryDraft(
    [
      {
        name: 'Programming',
        keywords: ['code', 'domain:docs.example.com']
      },
      {
        name: 'Other',
        keywords: []
      }
    ],
    parsed
  );
  assert.equal(merged.addedCount, 3);
  assert.equal(merged.updatedCategories, 1);
  assert.deepEqual(merged.addedByCategory, { Programming: 3 });
  assert.deepEqual(merged.draft[0].keywords, [
    'code',
    'domain:docs.example.com',
    'agent coding',
    'AI',
    'TypeScript'
  ]);
  assert.deepEqual(
    aiKeywordSuggestions.parseKeywordSuggestions(
      '{"categories":{"Other":["reference material"]}}',
      ['Programming', 'Other']
    ),
    [{ category: 'Other', keywords: ['reference material'] }]
  );
  assert.throws(
    () => aiKeywordSuggestions.parseKeywordSuggestions('not-json', ['Programming']),
    /does not contain JSON/
  );
  assert.match(i18n.MESSAGES.zh_CN.aiKeywordAssistantHint, /查询参数/);
  assert.match(i18n.MESSAGES.en.aiKeywordAssistantHint, /query-free/);
}

function createMockBookmarks() {
  let nextId = 1;
  const nodes = new Map([[
    'other',
    {
      id: 'other',
      parentId: '0',
      index: 0,
      title: 'Other favorites',
      folderType: 'other'
    }
  ]]);

  function getChildren(parentId) {
    return [...nodes.values()]
      .filter((node) => node.parentId === String(parentId))
      .sort((left, right) => Number(left.index || 0) - Number(right.index || 0));
  }

  function normalizeSiblingIndexes(parentId) {
    getChildren(parentId).forEach((node, index) => {
      node.index = index;
    });
  }

  function cloneTree(id) {
    const node = nodes.get(String(id));
    if (!node) return null;
    const clone = { ...node };
    if (!node.url) {
      clone.children = getChildren(node.id)
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
      const parentId = data.parentId ? String(data.parentId) : 'other';
      const siblings = getChildren(parentId);
      const insertionIndex = Number.isFinite(Number(data.index))
        ? Math.min(Math.max(0, Number(data.index)), siblings.length)
        : siblings.length;
      const node = {
        id: String(nextId++),
        parentId,
        index: insertionIndex,
        title: data.title,
        dateAdded: Date.now(),
        ...(data.url ? { url: data.url } : {})
      };
      nodes.set(node.id, node);
      siblings.splice(insertionIndex, 0, node);
      siblings.forEach((sibling, index) => {
        sibling.index = index;
      });
      callback({ ...node });
    },
    getChildren(parentId, callback) {
      callback(getChildren(parentId).map((node) => ({ ...node })));
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
      const previousParentId = node.parentId;
      const previousSiblings = getChildren(previousParentId)
        .filter((sibling) => sibling.id !== node.id);
      previousSiblings.forEach((sibling, index) => {
        sibling.index = index;
      });
      node.parentId = String(destination.parentId);
      const targetSiblings = getChildren(node.parentId)
        .filter((sibling) => sibling.id !== node.id);
      const insertionIndex = Number.isFinite(Number(destination.index))
        ? Math.min(Math.max(0, Number(destination.index)), targetSiblings.length)
        : targetSiblings.length;
      targetSiblings.splice(insertionIndex, 0, node);
      targetSiblings.forEach((sibling, index) => {
        sibling.index = index;
      });
      callback({ ...node });
    },
    remove(id, callback) {
      const normalizedId = String(id);
      const node = nodes.get(normalizedId);
      nodes.delete(normalizedId);
      if (node) normalizeSiblingIndexes(node.parentId);
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

  // 规则重分后只移动 SmartFav 受管书签，外部同网址收藏保持原位。
  const managedSyncApi = createMockBookmarks();
  const managedSyncSettings = {
    browserBookmarksEnabled: true,
    bookmarkWriteMode: 'add'
  };
  await browserBookmarks.writeFavorite(
    { title: 'Research paper', url: 'https://paper.example.com', category: 'Other' },
    managedSyncSettings,
    managedSyncApi
  );
  const externalPaper = await new Promise((resolve) => managedSyncApi.create(
    { title: 'External paper', url: 'https://paper.example.com' },
    resolve
  ));
  const managedSyncResult = await browserBookmarks.syncManagedCategories(
    [{ title: 'Research paper', url: 'https://paper.example.com', category: 'Research' }],
    managedSyncSettings,
    managedSyncApi
  );
  assert.equal(managedSyncResult.status, 'ok');
  assert.equal(managedSyncResult.moved, 1);
  const managedPaper = [...managedSyncApi.nodes.values()]
    .find((node) => node.url === 'https://paper.example.com' && node.id !== externalPaper.id);
  const originalManagedParentId = managedPaper.parentId;
  assert.equal(managedSyncApi.nodes.get(originalManagedParentId).title, 'Research');
  assert.equal(managedSyncApi.nodes.get(externalPaper.id).parentId, 'other');

  const managedInfo = await browserBookmarks.getManagedBookmarkInfo(
    managedSyncApi,
    managedPaper.id
  );
  assert.equal(managedInfo.status, 'ok');
  assert.equal(managedInfo.category, 'Research');
  const crossCategoryMove = await browserBookmarks.moveManagedFavorite(
    managedPaper.url,
    'Learning',
    managedSyncSettings,
    managedSyncApi
  );
  assert.equal(crossCategoryMove.status, 'ok');
  assert.equal(crossCategoryMove.moved, 1);
  assert.equal(managedSyncApi.nodes.get(originalManagedParentId).title, 'Research');
  const movedManagedPaper = managedSyncApi.nodes.get(managedPaper.id);
  assert.equal(managedSyncApi.nodes.get(movedManagedPaper.parentId).title, 'Learning');
  assert.equal(managedSyncApi.nodes.get(externalPaper.id).parentId, 'other');
}

async function verifyManagedOrderSync() {
  const api = createMockBookmarks();
  const settings = {
    browserBookmarksEnabled: true,
    bookmarkWriteMode: 'add'
  };
  const favorites = [
    { title: 'Tool A', url: 'https://tools.example.com/a', category: 'Tools' },
    { title: 'Tool B', url: 'https://tools.example.com/b', category: 'Tools' },
    { title: 'Tool C', url: 'https://tools.example.com/c', category: 'Tools' },
    { title: 'Video A', url: 'https://video.example.com/a', category: 'Video' },
    { title: 'Learning A', url: 'https://learning.example.com/a', category: 'Learning' }
  ];
  for (const favorite of favorites) {
    await browserBookmarks.writeFavorite(favorite, settings, api);
  }

  const root = [...api.nodes.values()]
    .find((node) => !node.url && node.title === browserBookmarks.ROOT_FOLDER_TITLE);
  assert.ok(root);
  const legacyFolder = await new Promise((resolve) => api.create(
    { parentId: root.id, title: 'Legacy' },
    resolve
  ));
  const looseRootBookmark = await new Promise((resolve) => api.create(
    {
      parentId: root.id,
      title: 'Loose root bookmark',
      url: 'https://loose-root.example.com'
    },
    resolve
  ));
  const externalBookmark = await new Promise((resolve) => api.create(
    { title: 'External bookmark', url: 'https://external-order.example.com' },
    resolve
  ));

  const categoryResult = await browserBookmarks.syncManagedOrder(
    { categories: ['Learning', 'Tools', 'Video', 'Missing category'] },
    settings,
    api
  );
  assert.equal(categoryResult.status, 'ok');
  assert.equal(categoryResult.matched, 3);
  assert.equal(categoryResult.missing, 1);
  const rootChildren = await new Promise((resolve) => api.getChildren(root.id, resolve));
  assert.deepEqual(
    rootChildren.slice(0, 3).map((node) => node.title),
    ['Learning', 'Tools', 'Video']
  );
  assert.deepEqual(
    rootChildren.slice(3).map((node) => node.id),
    [legacyFolder.id, looseRootBookmark.id]
  );
  assert.equal(api.nodes.get(externalBookmark.id).parentId, 'other');

  const toolsFolder = rootChildren.find((node) => node.title === 'Tools');
  const duplicateB = await new Promise((resolve) => api.create(
    {
      parentId: toolsFolder.id,
      title: 'Tool B duplicate',
      url: 'https://tools.example.com/b'
    },
    resolve
  ));
  const unknownBookmark = await new Promise((resolve) => api.create(
    {
      parentId: toolsFolder.id,
      title: 'Unknown tool',
      url: 'https://tools.example.com/unknown'
    },
    resolve
  ));
  const unknownFolder = await new Promise((resolve) => api.create(
    { parentId: toolsFolder.id, title: 'Nested folder' },
    resolve
  ));
  const favoriteResult = await browserBookmarks.syncManagedOrder(
    {
      category: 'Tools',
      orderedUrls: [
        'https://tools.example.com/c',
        'https://tools.example.com/b',
        'https://tools.example.com/a',
        'https://tools.example.com/not-written'
      ]
    },
    settings,
    api
  );
  assert.equal(favoriteResult.status, 'ok');
  assert.equal(favoriteResult.matched, 3);
  assert.equal(favoriteResult.missing, 1);
  const toolChildren = await new Promise((resolve) => api.getChildren(toolsFolder.id, resolve));
  assert.deepEqual(
    toolChildren.slice(0, 4).map((node) => node.url),
    [
      'https://tools.example.com/c',
      'https://tools.example.com/b',
      'https://tools.example.com/b',
      'https://tools.example.com/a'
    ]
  );
  assert.equal(toolChildren[2].id, duplicateB.id);
  assert.deepEqual(
    toolChildren.slice(4).map((node) => node.id),
    [unknownBookmark.id, unknownFolder.id]
  );
  assert.equal(api.nodes.get(externalBookmark.id).parentId, 'other');

  const orderBeforeDisabledSync = toolChildren.map((node) => node.id);
  const disabledResult = await browserBookmarks.syncManagedOrder(
    {
      category: 'Tools',
      orderedUrls: [
        'https://tools.example.com/a',
        'https://tools.example.com/c'
      ]
    },
    { browserBookmarksEnabled: false },
    api
  );
  assert.equal(disabledResult.status, 'disabled');
  const orderAfterDisabledSync = await new Promise(
    (resolve) => api.getChildren(toolsFolder.id, (nodes) => resolve(nodes.map((node) => node.id)))
  );
  assert.deepEqual(orderAfterDisabledSync, orderBeforeDisabledSync);

  const emptyApi = createMockBookmarks();
  const missingResult = await browserBookmarks.syncManagedOrder(
    { categories: ['Tools', 'Learning'] },
    settings,
    emptyApi
  );
  assert.equal(missingResult.status, 'missing');
  assert.equal(missingResult.missing, 2);
  assert.equal(
    [...emptyApi.nodes.values()]
      .filter((node) => !node.url && node.title === browserBookmarks.ROOT_FOLDER_TITLE)
      .length,
    0
  );
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

async function verifyBookmarkRestorePoints() {
  const settings = {
    ...classifier.getDefaults('en'),
    language: 'en',
    bookmarkOrganizeEnabled: true
  };
  const api = createMockBookmarks();
  const workFolder = await createBookmark(api, {
    parentId: 'other',
    title: 'Work'
  });
  const original = await createBookmark(api, {
    parentId: workFolder.id,
    title: 'GitHub engineering',
    url: 'https://github.com/example/restore'
  });
  const point = await bookmarkBackup.createRestorePoint(api, 'organize');
  assert.equal(point.bookmarkCount, 1);
  assert.equal(point.folderCount, 2);
  assert.deepEqual(
    point.bookmarks[0].parentPath.map((folder) => folder.title),
    ['Other favorites', 'Work']
  );

  // 已整理到 SmartFav 目录的旧书签仍会被读取，但不能伪造整理前路径。
  const managedOnlyApi = createMockBookmarks();
  const smartFavFolder = await createBookmark(managedOnlyApi, {
    parentId: 'other',
    title: 'SmartFav'
  });
  const learningFolder = await createBookmark(managedOnlyApi, {
    parentId: smartFavFolder.id,
    title: 'Learning'
  });
  await createBookmark(managedOnlyApi, {
    parentId: learningFolder.id,
    title: 'Existing managed bookmark one',
    url: 'https://managed.example.com/one'
  });
  await createBookmark(managedOnlyApi, {
    parentId: learningFolder.id,
    title: 'Existing managed bookmark two',
    url: 'https://managed.example.com/two'
  });
  const managedOnlyPoint = await bookmarkBackup.createRestorePoint(managedOnlyApi, 'manual');
  assert.equal(managedOnlyPoint.bookmarkCount, 0);
  assert.equal(managedOnlyPoint.folderCount, 0);
  assert.equal(managedOnlyPoint.legacyManagedCount, 2);
  assert.equal(managedOnlyPoint.bookmarks.length, 0);

  const organized = await browserBookmarks.organizeBookmarks(
    settings,
    api,
    classifier.classify
  );
  assert.equal(organized.moved, 1);
  assert.notEqual(api.nodes.get(original.id).parentId, workFolder.id);

  const preview = await bookmarkBackup.previewRestorePoint(api, point);
  assert.equal(preview.status, 'ok');
  assert.equal(preview.movable, 1);
  assert.equal(preview.missingBookmarks, 0);

  const restored = await bookmarkBackup.restorePoint(api, point);
  assert.equal(restored.status, 'ok');
  assert.equal(restored.restored, 1);
  assert.equal(api.nodes.get(original.id).parentId, workFolder.id);
  assert.equal(
    [...api.nodes.values()].filter((node) => !node.url && node.title === 'SmartFav').length,
    0
  );

  // 恢复操作可安全重试，不会复制书签或重复创建文件夹。
  const repeatedRestore = await bookmarkBackup.restorePoint(api, point);
  assert.equal(repeatedRestore.status, 'ok');
  assert.equal(repeatedRestore.restored, 0);
  assert.equal(repeatedRestore.alreadyRestored, 1);
  assert.equal(
    [...api.nodes.values()].filter((node) => node.url === original.url).length,
    1
  );

  // 书签仍在原文件夹但顺序被改变时，也要恢复原 index。
  const orderApi = createMockBookmarks();
  const orderFolder = await createBookmark(orderApi, {
    parentId: 'other',
    title: 'Ordered'
  });
  const firstOrdered = await createBookmark(orderApi, {
    parentId: orderFolder.id,
    title: 'First',
    url: 'https://example.com/first'
  });
  const secondOrdered = await createBookmark(orderApi, {
    parentId: orderFolder.id,
    title: 'Second',
    url: 'https://example.com/second'
  });
  const orderPoint = await bookmarkBackup.createRestorePoint(orderApi, 'manual');
  await new Promise((resolve) => orderApi.move(
    firstOrdered.id,
    { parentId: orderFolder.id, index: 1 },
    resolve
  ));
  assert.equal(orderApi.nodes.get(firstOrdered.id).index, 1);
  const orderRestore = await bookmarkBackup.restorePoint(orderApi, orderPoint);
  assert.equal(orderRestore.status, 'ok');
  assert.equal(orderApi.nodes.get(firstOrdered.id).index, 0);
  assert.equal(orderApi.nodes.get(secondOrdered.id).index, 1);

  // 原文件夹被用户删掉时，按记录路径重建文件夹后再移动现有书签。
  await browserBookmarks.organizeBookmarks(settings, api, classifier.classify);
  await new Promise((resolve) => api.remove(workFolder.id, resolve));
  const recreatedRestore = await bookmarkBackup.restorePoint(api, point);
  assert.equal(recreatedRestore.status, 'ok');
  assert.equal(recreatedRestore.createdFolders, 1);
  const recreatedWork = [...api.nodes.values()]
    .find((node) => !node.url && node.title === 'Work');
  assert.ok(recreatedWork);
  assert.equal(api.nodes.get(original.id).parentId, recreatedWork.id);

  // 用户已删除的书签不重新创建，恢复只处理仍存在的 ID。
  const deletedApi = createMockBookmarks();
  const deletedFolder = await createBookmark(deletedApi, {
    parentId: 'other',
    title: 'Archive'
  });
  const deletedBookmark = await createBookmark(deletedApi, {
    parentId: deletedFolder.id,
    title: 'Deleted intentionally',
    url: 'https://example.com/deleted-intentionally'
  });
  const deletedPoint = await bookmarkBackup.createRestorePoint(deletedApi, 'manual');
  await new Promise((resolve) => deletedApi.remove(deletedBookmark.id, resolve));
  const missingRestore = await bookmarkBackup.restorePoint(deletedApi, deletedPoint);
  assert.equal(missingRestore.status, 'ok');
  assert.equal(missingRestore.missingBookmarks, 1);
  assert.equal(
    [...deletedApi.nodes.values()]
      .filter((node) => node.url === deletedBookmark.url).length,
    0
  );

  const exportPayload = bookmarkBackup.createExportPayload([point, deletedPoint], 1234);
  assert.equal(exportPayload.format, 'smartfav-bookmark-restore');
  assert.equal(exportPayload.exportedAt, 1234);
  const importedPoints = bookmarkBackup.parseImportPayload(
    JSON.parse(JSON.stringify(exportPayload))
  );
  assert.equal(importedPoints.length, 2);
  assert.throws(
    () => bookmarkBackup.parseImportPayload({ format: 'unknown', restorePoints: [] }),
    /Invalid SmartFav restore file/
  );

  // 即使导入了更晚的已恢复记录，未恢复的活动还原点也不能被三份上限裁掉。
  const activeOld = { ...point, id: 'active-old', createdAt: 1 };
  const trimmed = bookmarkBackup.trimRestorePoints([
    activeOld,
    { ...point, id: 'restored-2', createdAt: 2, restoredAt: 20 },
    { ...point, id: 'restored-3', createdAt: 3, restoredAt: 30 },
    { ...point, id: 'restored-4', createdAt: 4, restoredAt: 40 }
  ]);
  assert.equal(trimmed.length, 3);
  assert.ok(trimmed.some((item) => item.id === activeOld.id));
}

function createBackgroundHarness(
  initialSettings,
  initialFavorites = [],
  initialRecentlyDeleted = [],
  initialRestorePoints = [],
  initialFavoriteOrder = {}
) {
  const bookmarks = createMockBookmarks();
  const state = {
    settings: { ...initialSettings },
    favorites: [...initialFavorites],
    favoriteOrder: { ...initialFavoriteOrder },
    recentlyDeleted: [...initialRecentlyDeleted],
    bookmarkRestorePoints: [...initialRestorePoints],
    pendingBrowserActivity: null
  };
  const listeners = {};
  const alarmSchedules = [];
  const notifications = [];
  const errors = [];
  const bookmarkApi = {
    ...bookmarks,
    onCreated: {
      addListener(listener) {
        listeners.onCreated = listener;
      }
    },
    onRemoved: {
      addListener(listener) {
        listeners.onRemoved = listener;
      }
    },
    onMoved: {
      addListener(listener) {
        listeners.onMoved = listener;
      }
    },
    move(id, destination, callback) {
      const normalizedId = String(id);
      const before = bookmarks.nodes.get(normalizedId);
      const oldParentId = before && before.parentId;
      const oldIndex = before && before.index;
      bookmarks.move(normalizedId, destination, (movedNode) => {
        if (movedNode && listeners.onMoved) {
          listeners.onMoved(normalizedId, {
            parentId: movedNode.parentId,
            index: movedNode.index,
            oldParentId,
            oldIndex
          });
        }
        callback(movedNode);
      });
    },
    remove(id, callback) {
      const normalizedId = String(id);
      const removedNode = bookmarks.nodes.get(normalizedId);
      bookmarks.remove(normalizedId, () => {
        if (removedNode && listeners.onRemoved) {
          listeners.onRemoved(normalizedId, {
            parentId: removedNode.parentId,
            index: 0,
            node: { ...removedNode }
          });
        }
        callback();
      });
    }
  };
  const chromeMock = {
    bookmarks: bookmarkApi,
    i18n: {
      getUILanguage() {
        return 'en-US';
      }
    },
    runtime: {
      lastError: null,
      getURL(pathname) {
        return `chrome-extension://smartfav/${pathname}`;
      },
      onInstalled: {
        addListener(listener) {
          listeners.onInstalled = listener;
        }
      },
      onStartup: {
        addListener(listener) {
          listeners.onStartup = listener;
        }
      },
      onMessage: {
        addListener(listener) {
          listeners.onMessage = listener;
        }
      }
    },
    alarms: {
      create(name, options) {
        alarmSchedules.push({ name, options });
      },
      onAlarm: {
        addListener(listener) {
          listeners.onAlarm = listener;
        }
      }
    },
    notifications: {
      create(id, options, callback) {
        notifications.push({ id, options });
        callback(id);
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
    SmartFavBackup: bookmarkBackup,
    SmartFavOrder: orderUtils,
    SmartFavI18n: i18n,
    importScripts() {},
    console: {
      log() {},
      error(...args) {
        errors.push(args);
      }
    }
  });
  vm.runInContext(backgroundJs, context, { filename: 'background.js' });
  return {
    bookmarks,
    state,
    listeners,
    alarmSchedules,
    notifications,
    errors,
    context
  };
}

async function createBookmark(api, data) {
  return new Promise((resolve) => api.create(data, resolve));
}

async function fireBookmarkCreated(harness, node) {
  harness.listeners.onCreated(node.id, node);
  await flushBackgroundEvents();
}

async function flushBackgroundEvents() {
  for (let index = 0; index < 6; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

async function fireBookmarkRemoved(harness, id) {
  const normalizedId = String(id);
  const subtree = await new Promise((resolve) => {
    harness.bookmarks.getSubTree(normalizedId, resolve);
  });
  const removedNode = subtree && subtree[0];
  assert.ok(removedNode, `missing bookmark node ${normalizedId}`);
  (function removeSubtree(node) {
    (node.children || []).forEach(removeSubtree);
    harness.bookmarks.nodes.delete(String(node.id));
  })(removedNode);
  harness.listeners.onRemoved(normalizedId, {
    parentId: removedNode.parentId,
    index: 0,
    node: removedNode
  });
  await flushBackgroundEvents();
}

async function fireBookmarkMoved(harness, id, parentId, index) {
  const normalizedId = String(id);
  const before = harness.bookmarks.nodes.get(normalizedId);
  assert.ok(before, `missing bookmark node ${normalizedId}`);
  const oldParentId = before.parentId;
  const oldIndex = before.index;
  const movedNode = await new Promise((resolve) => {
    harness.bookmarks.move(normalizedId, { parentId, index }, resolve);
  });
  harness.listeners.onMoved(normalizedId, {
    parentId: movedNode.parentId,
    index: movedNode.index,
    oldParentId,
    oldIndex
  });
  await flushBackgroundEvents();
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

  // Popup 的排序消息必须经过后台布局锁并真正写回浏览器收藏夹。
  const orderHarness = createBackgroundHarness({
    ...baseSettings,
    browserBookmarksEnabled: true,
    bookmarkWriteMode: 'add'
  });
  const managedOrderFavorites = [
    { title: 'Tool one', url: 'https://background-order.example.com/one', category: 'Tools' },
    { title: 'Tool two', url: 'https://background-order.example.com/two', category: 'Tools' },
    { title: 'Learning one', url: 'https://background-order.example.com/learn', category: 'Learning' }
  ];
  for (const favorite of managedOrderFavorites) {
    await browserBookmarks.writeFavorite(
      favorite,
      orderHarness.state.settings,
      orderHarness.bookmarks
    );
  }
  const categoryOrderResult = await sendBackgroundMessage(orderHarness, {
    type: 'syncManagedOrder',
    order: { categories: ['Learning', 'Tools'] }
  });
  assert.equal(categoryOrderResult.status, 'ok');
  const managedOrderRoot = [...orderHarness.bookmarks.nodes.values()]
    .find((node) => !node.url && node.title === 'SmartFav');
  const managedOrderFolders = await new Promise(
    (resolve) => orderHarness.bookmarks.getChildren(managedOrderRoot.id, resolve)
  );
  assert.deepEqual(
    managedOrderFolders.map((node) => node.title),
    ['Learning', 'Tools']
  );
  const favoriteOrderResult = await sendBackgroundMessage(orderHarness, {
    type: 'syncManagedOrder',
    order: {
      category: 'Tools',
      orderedUrls: [
        'https://background-order.example.com/two',
        'https://background-order.example.com/one'
      ]
    }
  });
  assert.equal(favoriteOrderResult.status, 'ok');
  const managedToolsFolder = managedOrderFolders.find((node) => node.title === 'Tools');
  const managedToolBookmarks = await new Promise(
    (resolve) => orderHarness.bookmarks.getChildren(managedToolsFolder.id, resolve)
  );
  assert.deepEqual(
    managedToolBookmarks.map((node) => node.url),
    [
      'https://background-order.example.com/two',
      'https://background-order.example.com/one'
    ]
  );

  // SmartFav 内跨分类移动必须同时更新本地分类、两侧顺序和浏览器受管书签。
  const smartFavMoveUrl = 'https://cross-category.example.com/task';
  const smartFavMoveHarness = createBackgroundHarness(
    {
      ...baseSettings,
      browserBookmarksEnabled: true,
      bookmarkWriteMode: 'add'
    },
    [
      {
        title: 'Cross-category task',
        url: smartFavMoveUrl,
        category: 'Tools',
        createdAt: 1
      },
      {
        title: 'Learning reference',
        url: 'https://cross-category.example.com/reference',
        category: 'Learning',
        createdAt: 2
      }
    ],
    [],
    [],
    {
      Tools: [smartFavMoveUrl],
      Learning: ['https://cross-category.example.com/reference']
    }
  );
  await browserBookmarks.writeFavorite(
    smartFavMoveHarness.state.favorites[0],
    smartFavMoveHarness.state.settings,
    smartFavMoveHarness.bookmarks
  );
  const smartFavMoveResult = await sendBackgroundMessage(smartFavMoveHarness, {
    type: 'moveFavoriteToCategory',
    url: smartFavMoveUrl,
    targetCategory: 'Learning'
  });
  assert.equal(smartFavMoveResult.status, 'ok');
  assert.equal(smartFavMoveResult.browserStatus, 'ok');
  assert.equal(smartFavMoveHarness.state.favorites[0].category, 'Learning');
  assert.equal(smartFavMoveHarness.state.favoriteOrder.Tools, undefined);
  assert.deepEqual(smartFavMoveHarness.state.favoriteOrder.Learning, [
    'https://cross-category.example.com/reference',
    smartFavMoveUrl
  ]);
  const smartFavMovedBrowserNode = [...smartFavMoveHarness.bookmarks.nodes.values()]
    .find((node) => node.url === smartFavMoveUrl);
  assert.equal(
    smartFavMoveHarness.bookmarks.nodes.get(smartFavMovedBrowserNode.parentId).title,
    'Learning'
  );
  await flushBackgroundEvents();
  assert.equal(smartFavMoveHarness.state.pendingBrowserActivity, null);

  // 用户在浏览器 SmartFav 分类间移动书签时，本地分类和顺序必须实时跟随。
  const browserMoveUrl = 'https://browser-cross-category.example.com';
  const browserMoveHarness = createBackgroundHarness(
    {
      ...baseSettings,
      browserBookmarksEnabled: true,
      bookmarkWriteMode: 'add'
    },
    [{
      title: 'Browser moved task',
      url: browserMoveUrl,
      category: 'Tools',
      createdAt: 1
    }],
    [],
    [],
    { Tools: [browserMoveUrl] }
  );
  await browserBookmarks.writeFavorite(
    browserMoveHarness.state.favorites[0],
    browserMoveHarness.state.settings,
    browserMoveHarness.bookmarks
  );
  const browserMoveRoot = [...browserMoveHarness.bookmarks.nodes.values()]
    .find((node) => !node.url && node.title === 'SmartFav');
  const browserMoveLearning = await createBookmark(browserMoveHarness.bookmarks, {
    parentId: browserMoveRoot.id,
    title: 'Learning'
  });
  const browserMovedNode = [...browserMoveHarness.bookmarks.nodes.values()]
    .find((node) => node.url === browserMoveUrl);
  await fireBookmarkMoved(
    browserMoveHarness,
    browserMovedNode.id,
    browserMoveLearning.id,
    0
  );
  assert.equal(browserMoveHarness.state.favorites[0].category, 'Learning');
  assert.equal(browserMoveHarness.state.favoriteOrder.Tools, undefined);
  assert.deepEqual(browserMoveHarness.state.favoriteOrder.Learning, [browserMoveUrl]);
  assert.equal(browserMoveHarness.state.pendingBrowserActivity.type, 'moved');
  assert.equal(browserMoveHarness.state.pendingBrowserActivity.previousCategory, 'Tools');
  assert.equal(browserMoveHarness.state.pendingBrowserActivity.category, 'Learning');

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

  // 新增分类和规则后，已有 SmartFav 收藏会重新读取已存信息并更新分类；
  // 开启浏览器同步时，受管浏览器书签也移动到新分类。
  const reclassifyUrl = 'https://papers.example.com/research';
  const reclassifyHarness = createBackgroundHarness(
    {
      ...baseSettings,
      browserBookmarksEnabled: true,
      categories: ['Research', 'Other'],
      keywordRules: {
        Research: ['research', 'paper'],
        Other: []
      }
    },
    [{
      title: 'AI research paper',
      url: reclassifyUrl,
      description: 'A new research paper',
      category: 'Other',
      tags: [],
      summary: 'No clear keyword match.',
      classificationSource: 'local',
      createdAt: 1
    }]
  );
  await browserBookmarks.writeFavorite(
    {
      title: 'AI research paper',
      url: reclassifyUrl,
      category: 'Other'
    },
    reclassifyHarness.state.settings,
    reclassifyHarness.bookmarks
  );
  const reclassifyResult = await sendBackgroundMessage(
    reclassifyHarness,
    { type: 'reclassifyFavorites' }
  );
  assert.equal(reclassifyResult.status, 'ok');
  assert.equal(reclassifyResult.total, 1);
  assert.equal(reclassifyResult.updated, 1);
  assert.equal(reclassifyResult.browserMoved, 1);
  assert.equal(reclassifyHarness.state.favorites[0].category, 'Research');
  assert.ok(reclassifyHarness.state.favorites[0].tags.includes('research'));
  const reclassifiedBrowserNode = [...reclassifyHarness.bookmarks.nodes.values()]
    .find((node) => node.url === reclassifyUrl);
  assert.equal(
    reclassifyHarness.bookmarks.nodes.get(reclassifiedBrowserNode.parentId).title,
    'Research'
  );

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
  assert.equal(syncedDeleteResult.trashed, 1);
  assert.equal(syncedDeleteHarness.state.favorites.length, 0);
  assert.equal(syncedDeleteHarness.state.recentlyDeleted.length, 1);
  assert.equal(
    syncedDeleteHarness.state.recentlyDeleted[0].expiresAt
      - syncedDeleteHarness.state.recentlyDeleted[0].deletedAt,
    7 * 24 * 60 * 60 * 1000
  );
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
  assert.equal(localDeleteResult.trashed, 1);
  assert.equal(localDeleteHarness.state.favorites.length, 0);
  assert.equal(localDeleteHarness.state.recentlyDeleted.length, 1);
  assert.ok(localDeleteHarness.bookmarks.nodes.has(localBrowserCopy.id));

  const trashedItem = localDeleteHarness.state.recentlyDeleted[0];
  const restoreResult = await sendBackgroundMessage(
    localDeleteHarness,
    { type: 'restoreDeletedFavorite', trashId: trashedItem.trashId }
  );
  assert.equal(restoreResult.status, 'ok');
  assert.equal(restoreResult.restored, 1);
  assert.equal(localDeleteHarness.state.favorites.length, 1);
  assert.equal(localDeleteHarness.state.favorites[0].url, localDeleteUrl);
  assert.equal(localDeleteHarness.state.recentlyDeleted.length, 0);

  await sendBackgroundMessage(
    localDeleteHarness,
    { type: 'deleteFavorite', url: localDeleteUrl }
  );
  const permanentlyDeletedItem = localDeleteHarness.state.recentlyDeleted[0];
  const permanentDeleteResult = await sendBackgroundMessage(
    localDeleteHarness,
    {
      type: 'permanentlyDeleteFavorite',
      trashId: permanentlyDeletedItem.trashId
    }
  );
  assert.equal(permanentDeleteResult.status, 'ok');
  assert.equal(permanentDeleteResult.removed, 1);
  assert.equal(localDeleteHarness.state.favorites.length, 0);
  assert.equal(localDeleteHarness.state.recentlyDeleted.length, 0);

  const expiredHarness = createBackgroundHarness(
    baseSettings,
    [],
    [{
      title: 'Expired bookmark',
      url: 'https://expired.example.com',
      category: 'Other',
      trashId: 'expired-1',
      deletedAt: Date.now() - (8 * 24 * 60 * 60 * 1000),
      expiresAt: Date.now() - 1000
    }]
  );
  const cleanupResult = await sendBackgroundMessage(
    expiredHarness,
    { type: 'cleanupRecentlyDeleted' }
  );
  assert.equal(cleanupResult.status, 'ok');
  assert.equal(cleanupResult.removed, 1);
  assert.equal(expiredHarness.state.recentlyDeleted.length, 0);
  assert.equal(expiredHarness.alarmSchedules[0].name, 'smartfav-trash-cleanup');
  assert.equal(expiredHarness.alarmSchedules[0].options.periodInMinutes, 60);
  assert.equal(typeof expiredHarness.listeners.onAlarm, 'function');
  assert.equal(typeof expiredHarness.listeners.onStartup, 'function');

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
  assert.ok(writeBackResult.restorePoint);
  assert.equal(localHarness.state.bookmarkRestorePoints.length, 1);
  assert.equal(localHarness.state.bookmarkRestorePoints[0].bookmarkCount, 3);
  const organizedNode = [...localHarness.bookmarks.nodes.values()]
    .find((node) => node.url === 'https://developer.example.com/tutorial');
  assert.equal(localHarness.bookmarks.nodes.get(organizedNode.parentId).title, 'Programming');
  const restorePointState = await sendBackgroundMessage(
    localHarness,
    { type: 'getBookmarkRestorePoints' }
  );
  assert.equal(restorePointState.status, 'ok');
  assert.equal(restorePointState.activePoint.id, writeBackResult.restorePoint.id);
  const restorePreview = await sendBackgroundMessage(
    localHarness,
    {
      type: 'previewBookmarkRestore',
      pointId: writeBackResult.restorePoint.id
    }
  );
  assert.equal(restorePreview.status, 'ok');
  assert.equal(restorePreview.movable, 3);
  const bookmarkLayoutRestoreResult = await sendBackgroundMessage(
    localHarness,
    {
      type: 'restoreBookmarkLayout',
      pointId: writeBackResult.restorePoint.id
    }
  );
  assert.equal(bookmarkLayoutRestoreResult.status, 'ok');
  assert.equal(bookmarkLayoutRestoreResult.restored, 3);
  assert.equal(localHarness.bookmarks.nodes.get(organizedNode.id).parentId, 'other');
  assert.ok(localHarness.state.bookmarkRestorePoints[0].restoredAt);

  const exportedRestorePoints = await sendBackgroundMessage(
    localHarness,
    { type: 'exportBookmarkRestorePoints' }
  );
  assert.equal(exportedRestorePoints.status, 'ok');
  assert.equal(exportedRestorePoints.payload.format, 'smartfav-bookmark-restore');
  const importHarness = createBackgroundHarness(baseSettings);
  const importedRestorePoints = await sendBackgroundMessage(
    importHarness,
    {
      type: 'importBookmarkRestorePoints',
      payload: exportedRestorePoints.payload
    }
  );
  assert.equal(importedRestorePoints.status, 'ok');
  assert.equal(importedRestorePoints.imported, 1);
  assert.equal(importHarness.state.bookmarkRestorePoints.length, 1);

  // 快照持久化失败时必须中止整理，不能先移动浏览器书签。
  const failedBackupHarness = createBackgroundHarness({
    ...baseSettings,
    bookmarkOrganizeEnabled: true
  });
  const protectedBookmark = await createBookmark(failedBackupHarness.bookmarks, {
    title: 'Protected tutorial',
    url: 'https://developer.example.com/protected'
  });
  const originalStorageSet = failedBackupHarness.context.chrome.storage.local.set;
  failedBackupHarness.context.chrome.storage.local.set = (values, callback) => {
    if (Object.prototype.hasOwnProperty.call(values, 'bookmarkRestorePoints')) {
      failedBackupHarness.context.chrome.runtime.lastError = {
        message: 'Simulated storage failure'
      };
      callback();
      failedBackupHarness.context.chrome.runtime.lastError = null;
      return;
    }
    originalStorageSet(values, callback);
  };
  const failedBackupResult = await sendBackgroundMessage(
    failedBackupHarness,
    { type: 'organizeBookmarks' }
  );
  assert.equal(failedBackupResult.status, 'error');
  assert.match(failedBackupResult.message, /Simulated storage failure/);
  assert.equal(
    failedBackupHarness.bookmarks.nodes.get(protectedBookmark.id).parentId,
    'other'
  );
  assert.equal(
    [...failedBackupHarness.bookmarks.nodes.values()]
      .filter((node) => !node.url && node.title === 'SmartFav').length,
    0
  );

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
  assert.equal(captureHarness.state.pendingBrowserActivity.type, 'classified');
  assert.equal(captureHarness.state.pendingBrowserActivity.category, 'News');
  assert.equal(captureHarness.notifications.length, 1);
  assert.equal(
    captureHarness.notifications[0].options.title,
    'SmartFav classified a bookmark'
  );
  assert.match(captureHarness.notifications[0].options.message, /News/);

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
  assert.equal(captureAndMoveHarness.state.bookmarkRestorePoints.length, 1);
  assert.ok(
    captureAndMoveHarness.state.bookmarkRestorePoints[0].bookmarks
      .some((bookmark) => bookmark.id === starredRepo.id)
  );
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
  assert.equal(overwriteCaptureHarness.state.recentlyDeleted.length, 0);

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
  assert.equal(disabledHarness.notifications.length, 0);

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
  assert.equal(typeof captureHarness.listeners.onRemoved, 'function');
  assert.equal(captureHarness.errors.length, 0);

  // 浏览器删除只在双向同步或自动获取开启时影响 SmartFav。
  // URL 级收藏有多个浏览器副本时，删掉其中一份不能误删 SmartFav。
  const externalDeleteUrl = 'https://browser-delete.example.com/story';
  const browserDeleteHarness = createBackgroundHarness(
    {
      ...baseSettings,
      bookmarkAutoCaptureEnabled: true
    },
    [{
      title: 'Browser delete story',
      url: externalDeleteUrl,
      category: 'News',
      createdAt: 1
    }]
  );
  const firstBrowserCopy = await createBookmark(browserDeleteHarness.bookmarks, {
    title: 'Browser delete story',
    url: externalDeleteUrl
  });
  const secondBrowserCopy = await createBookmark(browserDeleteHarness.bookmarks, {
    title: 'Browser delete story duplicate',
    url: externalDeleteUrl
  });
  await fireBookmarkRemoved(browserDeleteHarness, firstBrowserCopy.id);
  assert.equal(browserDeleteHarness.state.favorites.length, 1);
  assert.equal(browserDeleteHarness.state.recentlyDeleted.length, 0);

  await fireBookmarkRemoved(browserDeleteHarness, secondBrowserCopy.id);
  assert.equal(browserDeleteHarness.state.favorites.length, 0);
  assert.equal(browserDeleteHarness.state.recentlyDeleted.length, 1);
  assert.equal(browserDeleteHarness.state.recentlyDeleted[0].url, externalDeleteUrl);
  assert.equal(
    browserDeleteHarness.state.recentlyDeleted[0].expiresAt
      - browserDeleteHarness.state.recentlyDeleted[0].deletedAt,
    7 * 24 * 60 * 60 * 1000
  );
  assert.equal(browserDeleteHarness.state.pendingBrowserActivity.type, 'trashed');

  // 同步与自动获取都关闭时，浏览器侧删除不改变 SmartFav 本地收藏。
  const ignoredDeleteUrl = 'https://browser-delete-disabled.example.com';
  const ignoredDeleteHarness = createBackgroundHarness(
    baseSettings,
    [{
      title: 'Local-only favorite',
      url: ignoredDeleteUrl,
      category: 'Other',
      createdAt: 1
    }]
  );
  const ignoredBrowserDelete = await createBookmark(ignoredDeleteHarness.bookmarks, {
    title: 'Local-only favorite',
    url: ignoredDeleteUrl
  });
  await fireBookmarkRemoved(ignoredDeleteHarness, ignoredBrowserDelete.id);
  assert.equal(ignoredDeleteHarness.state.favorites.length, 1);
  assert.equal(ignoredDeleteHarness.state.recentlyDeleted.length, 0);

  // 删除浏览器文件夹只触发一个 onRemoved；仍需递归同步其中每个网址。
  const folderDeleteHarness = createBackgroundHarness(
    {
      ...baseSettings,
      browserBookmarksEnabled: true
    },
    [
      {
        title: 'Folder item one',
        url: 'https://folder-delete.example.com/one',
        category: 'Tools',
        createdAt: 1
      },
      {
        title: 'Folder item two',
        url: 'https://folder-delete.example.com/two',
        category: 'Learning',
        createdAt: 2
      }
    ]
  );
  const removedFolder = await createBookmark(folderDeleteHarness.bookmarks, {
    title: 'Delete this folder'
  });
  await createBookmark(folderDeleteHarness.bookmarks, {
    parentId: removedFolder.id,
    title: 'Folder item one',
    url: 'https://folder-delete.example.com/one'
  });
  const nestedFolder = await createBookmark(folderDeleteHarness.bookmarks, {
    parentId: removedFolder.id,
    title: 'Nested'
  });
  await createBookmark(folderDeleteHarness.bookmarks, {
    parentId: nestedFolder.id,
    title: 'Folder item two',
    url: 'https://folder-delete.example.com/two'
  });
  await fireBookmarkRemoved(folderDeleteHarness, removedFolder.id);
  assert.equal(folderDeleteHarness.state.favorites.length, 0);
  assert.equal(folderDeleteHarness.state.recentlyDeleted.length, 2);
  assert.equal(folderDeleteHarness.state.pendingBrowserActivity.count, 2);

  // SmartFav 自己同步删除浏览器书签时，onRemoved 必须被来源标记吞掉，
  // 不能再生成一条“浏览器删除”提示或重复写最近删除。
  const internalDeleteUrl = 'https://internal-delete.example.com';
  const internalDeleteHarness = createBackgroundHarness(
    {
      ...baseSettings,
      browserBookmarksEnabled: true
    },
    [{
      title: 'Internal delete',
      url: internalDeleteUrl,
      category: 'Tools',
      createdAt: 1
    }]
  );
  await browserBookmarks.writeFavorite(
    {
      title: 'Internal delete',
      url: internalDeleteUrl,
      category: 'Tools'
    },
    internalDeleteHarness.state.settings,
    internalDeleteHarness.bookmarks
  );
  const internalDeleteResult = await sendBackgroundMessage(
    internalDeleteHarness,
    { type: 'deleteFavorite', url: internalDeleteUrl }
  );
  await flushBackgroundEvents();
  assert.equal(internalDeleteResult.status, 'ok');
  assert.equal(internalDeleteHarness.state.recentlyDeleted.length, 1);
  assert.equal(internalDeleteHarness.state.pendingBrowserActivity, null);
  assert.equal(internalDeleteHarness.errors.length, 0);
}

async function main() {
  verifyManifestAndLocales();
  verifyManualOrdering();
  verifyBilingualClassification();
  await verifyAIProtocols();
  verifyAIKeywordSuggestions();
  await verifyBookmarkModes();
  await verifyManagedOrderSync();
  await verifyOrganizeBookmarks();
  await verifyBookmarkRestorePoints();
  await verifyBackgroundBookmarkFlows();
  console.log('SmartFav extension verification passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
