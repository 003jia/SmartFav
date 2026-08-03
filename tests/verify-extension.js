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
const optionsHtml = fs.readFileSync(path.join(extensionRoot, 'options.html'), 'utf8');
const popupJs = fs.readFileSync(path.join(extensionRoot, 'popup.js'), 'utf8');
const popupCss = fs.readFileSync(path.join(extensionRoot, 'styles/popup.css'), 'utf8');
const backgroundJs = fs.readFileSync(path.join(extensionRoot, 'background.js'), 'utf8');
const aiClientJs = fs.readFileSync(path.join(extensionRoot, 'ai-client.js'), 'utf8');
const favoritesServiceJs = fs.readFileSync(
  path.join(extensionRoot, 'favorites-service.js'),
  'utf8'
);

const classifier = require(path.join(extensionRoot, 'classifier.js'));
const i18n = require(path.join(extensionRoot, 'i18n.js'));
const browserBookmarks = require(path.join(extensionRoot, 'browser-bookmarks.js'));
const bookmarkBackup = require(path.join(extensionRoot, 'bookmark-backup.js'));
const aiClient = require(path.join(extensionRoot, 'ai-client.js'));
const aiKeywordSuggestions = require(path.join(extensionRoot, 'ai-keyword-suggestions.js'));
const orderUtils = require(path.join(extensionRoot, 'order-utils.js'));
const constants = require(path.join(extensionRoot, 'constants.js'));
const stateStore = require(path.join(extensionRoot, 'state-store.js'));
const bookmarkGuardModule = require(path.join(extensionRoot, 'bookmark-guard.js'));
const favoritesServiceModule = require(path.join(extensionRoot, 'favorites-service.js'));

const BACKGROUND_MESSAGE_TYPES = [
  'recoverManagedFavorites',
  'getFavorites',
  'deleteFavorite',
  'getRecentlyDeleted',
  'restoreDeletedFavorite',
  'permanentlyDeleteFavorite',
  'cleanupRecentlyDeleted',
  'reclassifyFavorites',
  'syncManagedOrder',
  'moveFavoriteToCategory',
  'updateSettings',
  'updateFavoriteOrder',
  'consumePendingBrowserActivity',
  'saveFavorite',
  'getBookmarkRestorePoints',
  'createBookmarkRestorePoint',
  'previewBookmarkRestore',
  'restoreBookmarkLayout',
  'exportBookmarkRestorePoints',
  'importBookmarkRestorePoints',
  'organizeBookmarks'
];

const FAVORITES_SERVICE_METHODS = [
  'cleanupRecentlyDeleted',
  'getRecentlyDeleted',
  'permanentlyDeleteFavorite',
  'restoreDeletedFavorite',
  'recoverManagedFavorites',
  'deleteFavorite',
  'saveFavoriteEntry',
  'updateSettings',
  'updateFavoriteOrder',
  'consumePendingBrowserActivity',
  'reclassifyFavorites',
  'getBookmarkRestorePointState',
  'createBookmarkRestorePoint',
  'previewBookmarkRestore',
  'restoreBookmarkLayout',
  'exportBookmarkRestorePoints',
  'importBookmarkRestorePoints',
  'syncManagedOrder',
  'moveFavoriteToCategory',
  'organizeBrowserBookmarks',
  'handleBookmarkCreated',
  'handleBookmarkMoved',
  'handleBookmarkRemoved'
];
const exercisedBackgroundMessageTypes = new Set();

function verifyManifestAndLocales() {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, '1.14.5');
  assert.ok(
    Array.from(popupHtml.matchAll(/\?v=([^"]+)/g), (match) => match[1])
      .every((version) => version === manifest.version)
  );
  assert.match(optionsHtml, new RegExp(`options\\.js\\?v=${manifest.version}`));
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
  assert.match(popupHtml, /id="backgroundImagePreview"[^>]*tabindex="-1"/s);
  assert.match(popupHtml, /id="backgroundPositionValue"/);
  assert.match(popupHtml, /id="resetBackgroundPositionBtn"/);
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
  assert.match(popupJs, /const MAX_BACKGROUND_IMAGE_BYTES = 800 \* 1024/);
  assert.match(popupJs, /file\.size > MAX_BACKGROUND_IMAGE_BYTES/);
  assert.match(popupJs, /customBackgroundPositionX:\s*50/);
  assert.match(popupJs, /customBackgroundPositionY:\s*50/);
  assert.match(popupJs, /function normalizeBackgroundPosition\(/);
  assert.match(popupJs, /function handleBackgroundPositionPointerDown\(/);
  assert.match(popupJs, /backgroundImagePreview\.tabIndex = hasImage \? 0 : -1/);
  assert.match(popupJs, /async function persistBackgroundPosition\(/);
  assert.match(popupJs, /backgroundImagePreview\.addEventListener\('pointermove'/);
  assert.match(popupJs, /backgroundImagePreview\.addEventListener\('keydown'/);
  assert.match(i18n.MESSAGES.zh_CN.customBackgroundHint, /拖动/);
  assert.match(i18n.MESSAGES.en.customBackgroundHint, /Drag/);
  assert.match(i18n.MESSAGES.zh_CN.backgroundPositionSaved, /自动保存/);
  assert.match(i18n.MESSAGES.en.backgroundPositionAriaLabel, /arrow keys/);
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
  assert.match(favoritesServiceJs, /chrome\.notifications\.create/);
  assert.match(favoritesServiceJs, /pendingBrowserActivity/);
  assert.match(backgroundJs, /organizeBookmarks/);
  assert.match(backgroundJs, /importScripts\([^)]*bookmark-backup\.js/);
  assert.match(backgroundJs, /importScripts\([^)]*order-utils\.js/);
  assert.match(backgroundJs, /importScripts\([^)]*favorites-service\.js/);
  assert.match(favoritesServiceJs, /ensureBookmarkRestorePointUnlocked/);
  assert.match(backgroundJs, /const MESSAGE_ROUTES = Object\.freeze\(\{/);
  assert.match(backgroundJs, /function routeMessage\(route, message, sendResponse\)/);
  assert.doesNotMatch(backgroundJs, /if \(message\.type ===/);
  BACKGROUND_MESSAGE_TYPES.forEach((type) => {
    assert.match(backgroundJs, new RegExp(`\\n  ${type}: \\{`));
  });
  assert.match(backgroundJs, /recoverManagedFavorites/);
  assert.match(favoritesServiceJs, /collectManagedBookmarks/);
  assert.match(popupJs, /type:\s*'recoverManagedFavorites'/);
  assert.match(favoritesServiceJs, /SmartFavBookmarks\.removeFavorite/);
  assert.match(favoritesServiceJs, /async function reclassifyFavorites\(\)/);
  assert.match(favoritesServiceJs, /SmartFavBookmarks\.syncManagedCategories/);
  assert.match(favoritesServiceJs, /SmartFavBookmarks\.syncManagedOrder/);
  assert.match(
    favoritesServiceJs,
    /本文件是单一事务边界|单一事务边界/
  );
  assert.ok(
    backgroundJs.split('\n').length - 1 <= 250,
    'background.js should remain a thin lifecycle and transport layer'
  );
  assert.deepEqual(
    Array.from(
      backgroundJs.matchAll(/^function ([A-Za-z0-9_]+)\(/gm),
      (match) => match[1]
    ),
    [
      'scheduleTrashCleanup',
      'createDefaultSettings',
      'readFavoritesFallback',
      'routeMessage'
    ]
  );
  assert.equal(constants.TRASH_RETENTION_MS, 7 * 24 * 60 * 60 * 1000);
  assert.match(backgroundJs, /importScripts\([^)]*constants\.js/);
  assert.match(
    backgroundJs,
    /importScripts\(\s*'constants\.js',\s*'state-store\.js',\s*'bookmark-guard\.js'/
  );
  assert.match(backgroundJs, /\} = SmartFavStateStore;/);
  assert.match(
    backgroundJs,
    /const bookmarkGuard = SmartFavBookmarkGuard\.createBookmarkGuard\(\{ chrome \}\)/
  );
  assert.doesNotMatch(backgroundJs, /function withBookmarkLayoutLock\(/);
  assert.doesNotMatch(backgroundJs, /let bookmarkLayoutQueue =/);
  assert.match(popupHtml, /<script src="constants\.js/);
  assert.match(
    manifest.content_security_policy.extension_pages,
    /script-src 'self'/
  );
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
  assert.match(popupJs, /async function updateStoredSettings\(settingsPatch\)/);
  assert.match(popupJs, /sendRuntimeMessage\('updateSettings', \{ patch: settingsPatch \}\)/);
  assert.match(backgroundJs, /\n  updateSettings: \{/);
  assert.match(
    popupJs,
    /class="favorite-row favorite-row-card\$\{inFolder \? ' favorite-row-in-folder' : ''\}"/
  );
  assert.match(popupJs, /draggable="true"[\s\S]{0,160}data-category=/);
  assert.match(popupJs, /data-favorite-url=/);
  assert.match(popupJs, /SmartFavOrder\.reorderValues/);
  assert.match(popupJs, /SmartFavOrder\.reorderFavoriteUrls/);
  assert.match(popupJs, /SmartFavOrder\.moveFavoriteUrl/);
  assert.match(popupJs, /async function updateStoredFavoriteOrder\(category, orderedUrls\)/);
  assert.match(backgroundJs, /\n  updateFavoriteOrder: \{/);
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
    favoritesServiceJs,
    /if \(shouldOrganize\) \{/
  );
  assert.match(favoritesServiceJs, /SmartFavBookmarks\.writeFavorite\(/);
  assert.match(favoritesServiceJs, /if \(!shouldCapture && !shouldOrganize\) return/);
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
  assert.match(popupCss, /--custom-background-position:\s*50% 50%/);
  assert.match(popupCss, /background-position:\s*center, var\(--custom-background-position\)/);
  assert.match(popupCss, /\.background-image-preview\s*\{[^}]*touch-action:\s*none;/s);
  assert.match(popupCss, /:root\[data-theme="glass"\] \.background-upload-button/);
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
  // 纯磨砂亚克力只保留 blur + saturate，不再叠加 brightness、高光或光场素材。
  assert.match(popupCss, /--panel-backdrop-filter:\s*blur\(\d+px\)\s+saturate\(\d+%\)/);
  assert.doesNotMatch(popupCss, /--panel-backdrop-filter:[^;]*brightness\(/);
  assert.match(popupCss, /backdrop-filter:\s*var\(--panel-backdrop-filter\)/);
  assert.match(popupCss, /--panel-highlight:\s*transparent/);
  assert.match(popupCss, /--panel-sheen:\s*none/);
  assert.match(popupCss, /--shell-sheen:\s*none/);
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
  // 玻璃主题会用 .app-shell::before 铺一层光泽；该伪元素必须限定在玻璃主题下，
  // 不允许出现无条件的全局遮罩层。
  assert.doesNotMatch(popupCss, /(?<!\[data-theme="glass"\] )\.app-shell::before/);
  assert.match(popupCss, /\[data-theme="glass"\] \.app-shell::before/);
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

  let observedTimeoutMs = null;
  const timeoutContext = vm.createContext({
    AbortController,
    URL,
    setTimeout(callback, timeoutMs) {
      observedTimeoutMs = timeoutMs;
      queueMicrotask(callback);
      return 1;
    },
    clearTimeout() {},
    fetch(_endpoint, options) {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      });
    }
  });
  vm.runInContext(aiClientJs, timeoutContext, { filename: 'ai-client.js' });
  await assert.rejects(
    timeoutContext.SmartFavAI.call('Return JSON', {
      language: 'en',
      apiProvider: 'openai_compatible',
      apiEndpoint: 'https://gateway.example.com/v1/chat/completions',
      apiKey: 'timeout-test-key',
      model: 'timeout-test-model'
    }),
    /AI request timed out after 30s/
  );
  assert.equal(observedTimeoutMs, 30000);
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
  initialFavoriteOrder = {},
  options = {}
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
  const sessionState = {};
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
          const snapshot = Object.fromEntries(requested.map((key) => [key, state[key]]));
          const respond = () => {
            if (options.storageReadError) {
              chromeMock.runtime.lastError = { message: options.storageReadError };
              callback(undefined);
              chromeMock.runtime.lastError = null;
              return;
            }
            callback(snapshot);
          };
          if (options.storageDelay) {
            setImmediate(respond);
          } else {
            respond();
          }
        },
        set(values, callback) {
          const respond = () => {
            // storageWriteError 用于模拟配额超限：回调照常触发，但置位 lastError。
            if (options.storageWriteError) {
              chromeMock.runtime.lastError = { message: options.storageWriteError };
              if (callback) callback();
              chromeMock.runtime.lastError = null;
              return;
            }
            Object.assign(state, values);
            if (callback) callback();
          };
          if (options.storageDelay) {
            setImmediate(respond);
          } else {
            respond();
          }
        }
      },
      // session 区：内部书签操作标记的权威存储，worker 回收后仍然有效。
      session: {
        get(keys, callback) {
          const requested = Array.isArray(keys) ? keys : Object.keys(keys || {});
          callback(Object.fromEntries(requested.map((key) => [key, sessionState[key]])));
        },
        set(values, callback) {
          Object.assign(sessionState, values);
          if (callback) callback();
        }
      }
    }
  };
  let context;
  const contextGlobals = {
    chrome: chromeMock,
    importScripts(...scriptNames) {
      scriptNames.forEach((scriptName) => {
        const scriptPath = path.join(extensionRoot, scriptName);
        const scriptSource = fs.readFileSync(scriptPath, 'utf8');
        vm.runInContext(scriptSource, context, { filename: scriptName });
      });

      const guardModule = context.SmartFavBookmarkGuard;
      context.SmartFavBookmarkGuard = {
        createBookmarkGuard({ chrome: guardChrome }) {
          const guard = guardModule.createBookmarkGuard({
            chrome: guardChrome,
            internalRemoveTtlMs: context.SmartFavConstants.INTERNAL_REMOVE_TTL_MS,
            logger: {
              error(...args) {
                errors.push(args);
              }
            }
          });
          if (!options.disableLayoutLock) return guard;
          return Object.freeze({
            ...guard,
            withBookmarkLayoutLock(task) {
              return Promise.resolve().then(task);
            }
          });
        }
      };

      const serviceModule = context.SmartFavFavoritesService;
      context.SmartFavFavoritesService = {
        createFavoritesService(optionsForService) {
          return serviceModule.createFavoritesService({
            ...optionsForService,
            logger: {
              log() {},
              error(...args) {
                errors.push(args);
              }
            }
          });
        }
      };
    },
    console: {
      log() {},
      error(...args) {
        errors.push(args);
      }
    }
  };
  context = vm.createContext(contextGlobals);
  vm.runInContext(backgroundJs, context, { filename: 'background.js' });
  return {
    bookmarks,
    state,
    sessionState,
    listeners,
    alarmSchedules,
    notifications,
    errors,
    context
  };
}

function createStateStoreChrome(initial = {}, options = {}) {
  const data = { ...initial };
  const chromeApi = {
    runtime: {
      lastError: null
    },
    storage: {
      local: {
        get(keys, callback) {
          if (options.readError) {
            chromeApi.runtime.lastError = { message: options.readError };
            callback(undefined);
            chromeApi.runtime.lastError = null;
            return;
          }
          callback(Object.fromEntries(
            keys.map((key) => [key, data[key]])
          ));
        },
        set(values, callback) {
          if (options.writeError) {
            chromeApi.runtime.lastError = { message: options.writeError };
            callback();
            chromeApi.runtime.lastError = null;
            return;
          }
          Object.assign(data, values);
          callback();
        }
      }
    }
  };
  return { chromeApi, data };
}

async function verifyStateStore() {
  assert.deepEqual(Array.from(stateStore.STATE_KEYS), [
    'settings',
    'favorites',
    'favoriteOrder',
    'recentlyDeleted',
    'bookmarkRestorePoints',
    'pendingBrowserActivity'
  ]);

  const validFavorite = { url: 'https://state-store.example.com/' };
  const success = createStateStoreChrome({
    settings: { language: 'en' },
    favorites: [validFavorite],
    favoriteOrder: { Tools: [validFavorite.url] },
    recentlyDeleted: null,
    bookmarkRestorePoints: 'invalid',
    pendingBrowserActivity: { id: 'activity-1' }
  });
  const stored = await stateStore.getStoredState(success.chromeApi);
  assert.equal(stored.settings.language, 'en');
  assert.deepEqual(stored.favorites, [validFavorite]);
  assert.deepEqual(stored.favoriteOrder, { Tools: [validFavorite.url] });
  assert.deepEqual(stored.recentlyDeleted, []);
  assert.deepEqual(stored.bookmarkRestorePoints, []);
  assert.equal(stored.pendingBrowserActivity.id, 'activity-1');

  await stateStore.setStoredFavorites([validFavorite], success.chromeApi);
  await stateStore.setStoredState(
    { recentlyDeleted: [{ trashId: 'trash-1' }] },
    success.chromeApi
  );
  assert.deepEqual(success.data.favorites, [validFavorite]);
  assert.equal(success.data.recentlyDeleted[0].trashId, 'trash-1');

  const readFailure = createStateStoreChrome({}, { readError: 'read failed' });
  await assert.rejects(
    stateStore.getStoredState(readFailure.chromeApi),
    /read failed/
  );
  const writeFailure = createStateStoreChrome({}, { writeError: 'write failed' });
  await assert.rejects(
    stateStore.setStoredStateChecked({ favorites: [] }, writeFailure.chromeApi),
    /write failed/
  );
  await assert.rejects(
    stateStore.getStoredState({ runtime: {} }),
    /chrome\.storage\.local is unavailable/
  );
}

function createBookmarkGuardChrome() {
  const sessionState = {};
  const calls = [];
  const chromeApi = {
    runtime: {
      lastError: null
    },
    storage: {
      session: {
        get(keys, callback) {
          callback(Object.fromEntries(
            keys.map((key) => [key, sessionState[key]])
          ));
        },
        set(values, callback) {
          Object.assign(sessionState, values);
          if (callback) callback();
        }
      }
    },
    bookmarks: {
      remove(id, callback) {
        calls.push({ type: 'remove', id: String(id) });
        callback();
      },
      move(id, destination, callback) {
        calls.push({ type: 'move', id: String(id), destination });
        callback({ id: String(id), ...destination });
      },
      search(query, callback) {
        calls.push({ type: 'search', query });
        callback([]);
      }
    }
  };
  return { chromeApi, sessionState, calls };
}

async function verifyBookmarkGuard() {
  const mock = createBookmarkGuardChrome();
  const errors = [];
  const guard = bookmarkGuardModule.createBookmarkGuard({
    chrome: mock.chromeApi,
    internalRemoveTtlMs: 30 * 1000,
    logger: {
      error(...args) {
        errors.push(args);
      }
    }
  });

  const sequence = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const first = guard.withBookmarkLayoutLock(async () => {
    sequence.push('first-start');
    await firstGate;
    sequence.push('first-end');
  });
  const second = guard.withBookmarkLayoutLock(async () => {
    sequence.push('second-start');
    sequence.push('second-end');
  });
  await Promise.resolve();
  assert.deepEqual(sequence, ['first-start']);

  // 第二个 guard 是另一 worker 实例的模型，锁状态不能互相污染。
  const independentGuard = bookmarkGuardModule.createBookmarkGuard({
    chrome: mock.chromeApi,
    internalRemoveTtlMs: 30 * 1000
  });
  const independentResult = await independentGuard.withBookmarkLayoutLock(
    async () => 'independent'
  );
  assert.equal(independentResult, 'independent');
  assert.deepEqual(sequence, ['first-start']);

  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(sequence, [
    'first-start',
    'first-end',
    'second-start',
    'second-end'
  ]);

  await assert.rejects(
    guard.withBookmarkLayoutLock(async () => {
      throw new Error('layout failure');
    }),
    /layout failure/
  );
  assert.equal(
    await guard.withBookmarkLayoutLock(async () => 'queue recovered'),
    'queue recovered'
  );

  const eventSequence = [];
  guard.enqueueBookmarkEvent('first event', async () => {
    eventSequence.push('first');
  });
  guard.enqueueBookmarkEvent('failed event', async () => {
    throw new Error('event failure');
  });
  await guard.enqueueBookmarkEvent('last event', async () => {
    eventSequence.push('last');
  });
  assert.deepEqual(eventSequence, ['first', 'last']);
  assert.equal(errors.length, 1);
  assert.match(String(errors[0][0]), /failed event/);

  const tracked = guard.getTrackedBookmarksApi();
  await new Promise((resolve) => tracked.remove('remove-1', resolve));
  const restartedAfterRemove = bookmarkGuardModule.createBookmarkGuard({
    chrome: mock.chromeApi,
    internalRemoveTtlMs: 30 * 1000
  });
  assert.equal(
    await restartedAfterRemove.consumeInternalBookmarkRemoval('remove-1'),
    true
  );
  assert.equal(
    await restartedAfterRemove.consumeInternalBookmarkRemoval('remove-1'),
    false
  );

  await new Promise((resolve) => {
    tracked.move('move-1', { parentId: 'folder-2' }, resolve);
  });
  const restartedAfterMove = bookmarkGuardModule.createBookmarkGuard({
    chrome: mock.chromeApi,
    internalRemoveTtlMs: 30 * 1000
  });
  assert.equal(
    await restartedAfterMove.consumeInternalBookmarkMove('move-1'),
    true
  );
  assert.equal(
    await restartedAfterMove.consumeInternalBookmarkMove('move-1'),
    false
  );
  assert.deepEqual(
    mock.calls.map((call) => call.type),
    ['remove', 'move']
  );
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
  exercisedBackgroundMessageTypes.add(message.type);
  return new Promise((resolve) => {
    const keepsChannelOpen = harness.listeners.onMessage(message, {}, resolve);
    assert.equal(keepsChannelOpen, true);
  });
}

async function verifyFavoritesServiceDependencyInjection() {
  const injectedChrome = {
    runtime: { lastError: null },
    bookmarks: {}
  };
  let chromeUsedForRead = null;
  const injectedStateStore = {
    getStoredState(chromeApi) {
      chromeUsedForRead = chromeApi;
      return Promise.resolve({
        settings: {},
        favorites: [],
        favoriteOrder: {},
        recentlyDeleted: [],
        bookmarkRestorePoints: [],
        pendingBrowserActivity: null
      });
    },
    setStoredStateChecked() {
      return Promise.resolve();
    },
    setStoredFavorites() {
      return Promise.resolve();
    },
    setStoredState() {
      return Promise.resolve();
    }
  };
  const service = favoritesServiceModule.createFavoritesService({
    chrome: injectedChrome,
    stateStore: injectedStateStore,
    bookmarkGuard: {
      getTrackedBookmarksApi() {
        return injectedChrome.bookmarks;
      },
      withBookmarkLayoutLock(task) {
        return Promise.resolve().then(task);
      },
      consumeInternalBookmarkRemoval() {
        return Promise.resolve(false);
      },
      consumeInternalBookmarkMove() {
        return Promise.resolve(false);
      }
    },
    classifier,
    bookmarks: browserBookmarks,
    backup: bookmarkBackup,
    order: orderUtils,
    i18n,
    constants,
    logger: { log() {}, error() {} }
  });
  const result = await service.getRecentlyDeleted();
  assert.equal(result.status, 'ok');
  assert.equal(chromeUsedForRead, injectedChrome);
}

async function verifyBackgroundMessageRoutes() {
  const enDefaults = classifier.getDefaults('en');
  const harness = createBackgroundHarness({
    language: 'en',
    categories: enDefaults.categories,
    keywordRules: enDefaults.keywordRules
  });
  const routeTypes = Array.from(
    vm.runInContext('Object.keys(MESSAGE_ROUTES)', harness.context)
  );
  assert.deepEqual(
    routeTypes.slice().sort(),
    BACKGROUND_MESSAGE_TYPES.slice().sort()
  );
  const serviceMethods = Array.from(
    vm.runInContext('Object.keys(favoritesService)', harness.context)
  );
  assert.deepEqual(
    serviceMethods.slice().sort(),
    FAVORITES_SERVICE_METHODS.slice().sort()
  );

  let unknownResponseCalled = false;
  const unknownResult = harness.listeners.onMessage(
    { type: 'unknownMessage' },
    {},
    () => {
      unknownResponseCalled = true;
    }
  );
  assert.equal(unknownResult, false);
  assert.equal(unknownResponseCalled, false);

  // getFavorites 保留历史裸数组协议；即使恢复与降级读取都失败，
  // 也必须返回 []，不能混入带 status 的错误对象。
  const readFailureHarness = createBackgroundHarness(
    {
      language: 'en',
      categories: enDefaults.categories,
      keywordRules: enDefaults.keywordRules
    },
    [],
    [],
    [],
    {},
    { storageReadError: 'storage unavailable' }
  );
  const favorites = await sendBackgroundMessage(
    readFailureHarness,
    { type: 'getFavorites' }
  );
  assert.deepEqual(Array.from(favorites), []);

  const recentlyDeleted = await sendBackgroundMessage(
    harness,
    { type: 'getRecentlyDeleted' }
  );
  assert.equal(recentlyDeleted.status, 'ok');
  const restorePoint = await sendBackgroundMessage(
    harness,
    { type: 'createBookmarkRestorePoint' }
  );
  assert.equal(restorePoint.status, 'ok');
}

async function verifySaveFavoriteConsistency() {
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

  // 并发保存两条收藏：布局锁必须把两次读-改-写串行化，后写不能覆盖先写。
  const lockHarness = createBackgroundHarness({ ...baseSettings });
  const [firstResponse, secondResponse] = await Promise.all([
    sendBackgroundMessage(lockHarness, {
      type: 'saveFavorite',
      favorite: {
        title: 'Concurrent one',
        url: 'https://concurrent.example.com/one',
        category: 'Tools',
        createdAt: 1
      }
    }),
    sendBackgroundMessage(lockHarness, {
      type: 'saveFavorite',
      favorite: {
        title: 'Concurrent two',
        url: 'https://concurrent.example.com/two',
        category: 'Tools',
        createdAt: 2
      }
    })
  ]);
  assert.equal(firstResponse.status, 'ok');
  assert.equal(secondResponse.status, 'ok');
  assert.equal(lockHarness.state.favorites.length, 2);
  assert.deepEqual(
    [...lockHarness.state.favorites].map((item) => item.url).sort(),
    ['https://concurrent.example.com/one', 'https://concurrent.example.com/two']
  );

  // 同一网址重复保存只保留一条，且是最新的那条。
  const dedupeHarness = createBackgroundHarness({ ...baseSettings });
  await sendBackgroundMessage(dedupeHarness, {
    type: 'saveFavorite',
    favorite: { title: 'Old title', url: 'https://dedupe.example.com/', category: 'Tools' }
  });
  await sendBackgroundMessage(dedupeHarness, {
    type: 'saveFavorite',
    favorite: { title: 'New title', url: 'https://dedupe.example.com/', category: 'Learning' }
  });
  assert.equal(dedupeHarness.state.favorites.length, 1);
  assert.equal(dedupeHarness.state.favorites[0].title, 'New title');
  assert.equal(dedupeHarness.state.favorites[0].category, 'Learning');

  // 域名学习提案随保存一起落盘，settings 与 favorites 在同一次写入中提交。
  const learningHarness = createBackgroundHarness({ ...baseSettings });
  const learningResponse = await sendBackgroundMessage(learningHarness, {
    type: 'saveFavorite',
    favorite: { title: 'Learned', url: 'https://learned.example.com/a', category: 'Learning' },
    settingsPatch: { ...baseSettings, bookmarkWriteMode: 'add' }
  });
  assert.equal(learningResponse.status, 'ok');
  assert.equal(learningHarness.state.settings.bookmarkWriteMode, 'add');
  assert.equal(learningHarness.state.favorites.length, 1);

  // 开启同步时，书签写入必须经过后台的受管 API，并把结果回传给 popup。
  const syncHarness = createBackgroundHarness({
    ...baseSettings,
    browserBookmarksEnabled: true
  });
  const syncResponse = await sendBackgroundMessage(syncHarness, {
    type: 'saveFavorite',
    favorite: { title: 'Synced', url: 'https://synced.example.com/a', category: 'Tools' }
  });
  assert.equal(syncResponse.status, 'ok');
  assert.notEqual(syncResponse.bookmark.status, 'disabled');
  const syncedNodes = [...syncHarness.bookmarks.nodes.values()]
    .filter((node) => node.url === 'https://synced.example.com/a');
  assert.equal(syncedNodes.length, 1);

  // 关闭同步时不触碰浏览器收藏夹。
  const disabledHarness = createBackgroundHarness({ ...baseSettings });
  const disabledResponse = await sendBackgroundMessage(disabledHarness, {
    type: 'saveFavorite',
    favorite: { title: 'Local only', url: 'https://local-only.example.com/', category: 'Tools' }
  });
  assert.equal(disabledResponse.bookmark.status, 'disabled');
  assert.equal(
    [...disabledHarness.bookmarks.nodes.values()]
      .filter((node) => node.url === 'https://local-only.example.com/').length,
    0
  );

  // 缺少 url 的收藏请求必须被拒绝，而不是写入一条脏数据。
  const invalidHarness = createBackgroundHarness({ ...baseSettings });
  const invalidResponse = await sendBackgroundMessage(invalidHarness, {
    type: 'saveFavorite',
    favorite: { title: 'No url' }
  });
  assert.equal(invalidResponse.status, 'error');
  assert.equal(invalidHarness.state.favorites.length, 0);
}

async function verifyCrossEntryConsistency() {
  const enDefaults = classifier.getDefaults('en');
  const baseSettings = {
    language: 'en',
    themeStyle: 'glass',
    colorMode: 'light',
    popupWidth: 360,
    categories: enDefaults.categories,
    keywordRules: enDefaults.keywordRules,
    browserBookmarksEnabled: false,
    bookmarkWriteMode: 'overwrite',
    bookmarkOrganizeEnabled: false,
    bookmarkAutoCaptureEnabled: false
  };

  // Popup 保存与浏览器星标自动采集必须共享同一状态锁。storage 延迟让两条路径
  // 真正重叠；若 onCreated 只走独立 eventQueue，最终只会剩下一条收藏。
  const captureHarness = createBackgroundHarness(
    { ...baseSettings, bookmarkAutoCaptureEnabled: true },
    [],
    [],
    [],
    {},
    { storageDelay: true }
  );
  const browserCreated = await createBookmark(captureHarness.bookmarks, {
    title: 'Browser-created bookmark',
    url: 'https://cross-entry.example.com/browser'
  });
  const popupSave = sendBackgroundMessage(captureHarness, {
    type: 'saveFavorite',
    favorite: {
      title: 'Popup favorite',
      url: 'https://cross-entry.example.com/popup',
      category: 'Tools',
      createdAt: 1
    }
  });
  captureHarness.listeners.onCreated(browserCreated.id, browserCreated);
  const popupSaveResult = await popupSave;
  await flushBackgroundEvents();
  assert.equal(popupSaveResult.status, 'ok');
  assert.deepEqual(
    Array.from(captureHarness.state.favorites, (item) => item.url).sort(),
    [
      'https://cross-entry.example.com/browser',
      'https://cross-entry.example.com/popup'
    ]
  );

  // 用户删除旧收藏与保存新收藏同时发生时，新收藏不能被旧快照覆盖，
  // 被删条目也必须完整进入最近删除。
  const deleteUrl = 'https://cross-entry.example.com/delete';
  const deleteHarness = createBackgroundHarness(
    baseSettings,
    [{ title: 'Delete me', url: deleteUrl, category: 'Tools', createdAt: 1 }],
    [],
    [],
    {},
    { storageDelay: true }
  );
  const [concurrentSave, concurrentDelete] = await Promise.all([
    sendBackgroundMessage(deleteHarness, {
      type: 'saveFavorite',
      favorite: {
        title: 'Keep me',
        url: 'https://cross-entry.example.com/keep',
        category: 'Learning',
        createdAt: 2
      }
    }),
    sendBackgroundMessage(deleteHarness, { type: 'deleteFavorite', url: deleteUrl })
  ]);
  assert.equal(concurrentSave.status, 'ok');
  assert.equal(concurrentDelete.status, 'ok');
  assert.deepEqual(
    Array.from(deleteHarness.state.favorites, (item) => item.url),
    ['https://cross-entry.example.com/keep']
  );
  assert.equal(deleteHarness.state.recentlyDeleted.length, 1);
  assert.equal(deleteHarness.state.recentlyDeleted[0].url, deleteUrl);

  // 变异哨兵：在同一份生产源码中临时移除布局锁，完全相同的并发场景
  // 必须破坏最终不变量，证明上述用例确实能够捕获“旧快照覆盖新状态”。
  const unlockedKeepUrl = 'https://cross-entry.example.com/unlocked-keep';
  const unlockedHarness = createBackgroundHarness(
    baseSettings,
    [{ title: 'Delete me', url: deleteUrl, category: 'Tools', createdAt: 1 }],
    [],
    [],
    {},
    { storageDelay: true, disableLayoutLock: true }
  );
  await Promise.all([
    sendBackgroundMessage(unlockedHarness, {
      type: 'saveFavorite',
      favorite: {
        title: 'Unlocked keep',
        url: unlockedKeepUrl,
        category: 'Learning',
        createdAt: 2
      }
    }),
    sendBackgroundMessage(unlockedHarness, {
      type: 'deleteFavorite',
      url: deleteUrl
    })
  ]);
  const unlockedFavoriteUrls = unlockedHarness.state.favorites.map((item) => item.url);
  const unlockedInvariantHolds = (
    unlockedFavoriteUrls.length === 1
    && unlockedFavoriteUrls[0] === unlockedKeepUrl
    && unlockedHarness.state.recentlyDeleted.length === 1
    && unlockedHarness.state.recentlyDeleted[0].url === deleteUrl
  );
  assert.equal(unlockedInvariantHolds, false);

  // 浏览器侧删除回流与 popup 保存同时发生，也必须保留新收藏并把旧收藏入回收站。
  const browserDeleteUrl = 'https://cross-entry.example.com/browser-delete';
  const browserDeleteHarness = createBackgroundHarness(
    { ...baseSettings, browserBookmarksEnabled: true },
    [{
      title: 'Browser delete',
      url: browserDeleteUrl,
      category: 'Tools',
      createdAt: 1
    }],
    [],
    [],
    {},
    { storageDelay: true }
  );
  const browserDeleteNode = await createBookmark(browserDeleteHarness.bookmarks, {
    title: 'Browser delete',
    url: browserDeleteUrl
  });
  const browserConcurrentSave = sendBackgroundMessage(browserDeleteHarness, {
    type: 'saveFavorite',
    favorite: {
      title: 'Survives browser deletion',
      url: 'https://cross-entry.example.com/survives',
      category: 'Learning',
      createdAt: 2
    }
  });
  const browserDeletion = fireBookmarkRemoved(
    browserDeleteHarness,
    browserDeleteNode.id
  );
  await Promise.all([browserConcurrentSave, browserDeletion]);
  await flushBackgroundEvents();
  assert.deepEqual(
    Array.from(browserDeleteHarness.state.favorites, (item) => item.url),
    ['https://cross-entry.example.com/survives']
  );
  assert.equal(browserDeleteHarness.state.recentlyDeleted.length, 1);
  assert.equal(browserDeleteHarness.state.recentlyDeleted[0].url, browserDeleteUrl);

  // 重新分类全部收藏与浏览器侧跨分类移动并发时，两个入口必须基于最新状态串行提交。
  // A 由规则重新分类到 Programming，B 由浏览器移动到 Tools；任一路径使用旧快照
  // 覆盖另一条路径，都会让其中一个结果退回 Other。
  const reclassifyUrl = 'https://cross-entry.example.com/javascript-guide';
  const movedUrl = 'https://cross-entry.example.com/useful-extension';
  const reclassifyMoveHarness = createBackgroundHarness(
    { ...baseSettings, bookmarkAutoCaptureEnabled: true },
    [
      {
        title: 'JavaScript coding guide',
        url: reclassifyUrl,
        category: 'Other',
        createdAt: 1
      },
      {
        title: 'Useful extension tool',
        url: movedUrl,
        category: 'Other',
        createdAt: 2
      }
    ],
    [],
    [],
    {},
    { storageDelay: true }
  );
  const managedMoveResult = await browserBookmarks.writeFavorite(
    {
      title: 'Useful extension tool',
      url: movedUrl,
      category: 'Other'
    },
    { ...baseSettings, browserBookmarksEnabled: true },
    reclassifyMoveHarness.bookmarks
  );
  const managedRoot = [...reclassifyMoveHarness.bookmarks.nodes.values()]
    .find((node) => !node.url && node.title === browserBookmarks.ROOT_FOLDER_TITLE);
  assert.ok(managedRoot);
  const toolsFolder = await createBookmark(reclassifyMoveHarness.bookmarks, {
    parentId: managedRoot.id,
    title: 'Tools'
  });
  const reclassifyPromise = sendBackgroundMessage(reclassifyMoveHarness, {
    type: 'reclassifyFavorites'
  });
  const movePromise = fireBookmarkMoved(
    reclassifyMoveHarness,
    managedMoveResult.id,
    toolsFolder.id
  );
  const [reclassifyResult] = await Promise.all([reclassifyPromise, movePromise]);
  await flushBackgroundEvents();
  assert.equal(reclassifyResult.status, 'ok');
  assert.equal(reclassifyMoveHarness.state.favorites.length, 2);
  assert.equal(
    new Set(reclassifyMoveHarness.state.favorites.map((item) => item.url)).size,
    2
  );
  const reclassifiedByUrl = new Map(
    reclassifyMoveHarness.state.favorites.map((item) => [item.url, item])
  );
  assert.equal(reclassifiedByUrl.get(reclassifyUrl).category, 'Programming');
  assert.equal(reclassifiedByUrl.get(movedUrl).category, 'Tools');

  // 同一条回收站记录的到期清理与手工恢复必须互斥：先进入队列的操作获胜，
  // 后进入的操作只能返回 0，不能出现“既恢复到收藏又报告已清理”。
  const expiredTrashItem = {
    title: 'Expired concurrent item',
    url: 'https://cross-entry.example.com/expired',
    category: 'Other',
    trashId: 'cross-entry-expired',
    deletedAt: Date.now() - (8 * 24 * 60 * 60 * 1000),
    expiresAt: Date.now() - 1000
  };
  const cleanupFirstHarness = createBackgroundHarness(
    baseSettings,
    [],
    [expiredTrashItem],
    [],
    {},
    { storageDelay: true }
  );
  const [cleanupFirst, restoreAfterCleanup] = await Promise.all([
    sendBackgroundMessage(cleanupFirstHarness, {
      type: 'cleanupRecentlyDeleted'
    }),
    sendBackgroundMessage(cleanupFirstHarness, {
      type: 'restoreDeletedFavorite',
      trashId: expiredTrashItem.trashId
    })
  ]);
  assert.equal(cleanupFirst.removed, 1);
  assert.equal(restoreAfterCleanup.restored, 0);
  assert.equal(cleanupFirstHarness.state.favorites.length, 0);
  assert.equal(cleanupFirstHarness.state.recentlyDeleted.length, 0);

  const restoreFirstHarness = createBackgroundHarness(
    baseSettings,
    [],
    [expiredTrashItem],
    [],
    {},
    { storageDelay: true }
  );
  const [restoreFirst, cleanupAfterRestore] = await Promise.all([
    sendBackgroundMessage(restoreFirstHarness, {
      type: 'restoreDeletedFavorite',
      trashId: expiredTrashItem.trashId
    }),
    sendBackgroundMessage(restoreFirstHarness, {
      type: 'cleanupRecentlyDeleted'
    })
  ]);
  assert.equal(restoreFirst.restored, 1);
  assert.equal(cleanupAfterRestore.removed, 0);
  assert.equal(restoreFirstHarness.state.favorites.length, 1);
  assert.equal(restoreFirstHarness.state.recentlyDeleted.length, 0);

  // 两个设置补丁只能合并各自字段，不能用旧的整份 settings 互相覆盖。
  const settingsHarness = createBackgroundHarness(
    baseSettings,
    [],
    [],
    [],
    {},
    { storageDelay: true }
  );
  const [modeUpdate, widthUpdate] = await Promise.all([
    sendBackgroundMessage(settingsHarness, {
      type: 'updateSettings',
      patch: { colorMode: 'dark' }
    }),
    sendBackgroundMessage(settingsHarness, {
      type: 'updateSettings',
      patch: { popupWidth: 420 }
    })
  ]);
  assert.equal(modeUpdate.status, 'ok');
  assert.equal(widthUpdate.status, 'ok');
  assert.equal(settingsHarness.state.settings.colorMode, 'dark');
  assert.equal(settingsHarness.state.settings.popupWidth, 420);

  // 不同分类的排序更新必须基于最新 favoriteOrder 合并。
  const orderHarness = createBackgroundHarness(
    baseSettings,
    [],
    [],
    [],
    {},
    { storageDelay: true }
  );
  await Promise.all([
    sendBackgroundMessage(orderHarness, {
      type: 'updateFavoriteOrder',
      category: 'Tools',
      orderedUrls: ['https://order.example.com/tool']
    }),
    sendBackgroundMessage(orderHarness, {
      type: 'updateFavoriteOrder',
      category: 'Learning',
      orderedUrls: ['https://order.example.com/learn']
    })
  ]);
  assert.deepEqual(Array.from(orderHarness.state.favoriteOrder.Tools), [
    'https://order.example.com/tool'
  ]);
  assert.deepEqual(Array.from(orderHarness.state.favoriteOrder.Learning), [
    'https://order.example.com/learn'
  ]);

  // 旧弹窗只能消费自己展示的活动，不能清掉随后到达的新活动。
  const activityHarness = createBackgroundHarness(baseSettings);
  activityHarness.state.pendingBrowserActivity = {
    id: 'activity-new',
    type: 'classified',
    createdAt: Date.now()
  };
  const staleConsume = await sendBackgroundMessage(activityHarness, {
    type: 'consumePendingBrowserActivity',
    activityId: 'activity-old'
  });
  assert.equal(staleConsume.status, 'ok');
  assert.equal(staleConsume.consumed, false);
  assert.equal(activityHarness.state.pendingBrowserActivity.id, 'activity-new');
  const matchingConsume = await sendBackgroundMessage(activityHarness, {
    type: 'consumePendingBrowserActivity',
    activityId: 'activity-new'
  });
  assert.equal(matchingConsume.consumed, true);
  assert.equal(activityHarness.state.pendingBrowserActivity, null);
}

async function verifyStorageWriteFailures() {
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

  // 配额超限：set 回调照常触发但 lastError 被置位，写入必须报错而不是静默成功。
  const failingHarness = createBackgroundHarness(
    { ...baseSettings },
    [],
    [],
    [],
    {},
    { storageWriteError: 'QUOTA_BYTES quota exceeded' }
  );
  const saveResponse = await sendBackgroundMessage(failingHarness, {
    type: 'saveFavorite',
    favorite: { title: 'Quota', url: 'https://quota.example.com/', category: 'Tools' }
  });
  assert.equal(saveResponse.status, 'error');
  assert.match(saveResponse.message, /quota/i);
  assert.equal(failingHarness.state.favorites.length, 0);

  // 删除路径同样不能把失败当成功。
  const deleteHarness = createBackgroundHarness(
    { ...baseSettings },
    [{ title: 'Doomed', url: 'https://doomed.example.com/', category: 'Tools' }],
    [],
    [],
    {},
    { storageWriteError: 'QUOTA_BYTES quota exceeded' }
  );
  const deleteResponse = await sendBackgroundMessage(deleteHarness, {
    type: 'deleteFavorite',
    url: 'https://doomed.example.com/'
  });
  assert.equal(deleteResponse.status, 'error');
  assert.equal(deleteHarness.state.favorites.length, 1);
  assert.equal(deleteHarness.state.recentlyDeleted.length, 0);

  // 读取失败同样必须显式报错，不能把空对象误当成真实的空收藏状态再覆盖数据。
  const readFailHarness = createBackgroundHarness(
    { ...baseSettings },
    [{ title: 'Preserve me', url: 'https://read-fail.example.com/', category: 'Tools' }],
    [],
    [],
    {},
    { storageReadError: 'Storage backend unavailable' }
  );
  const readFailResponse = await sendBackgroundMessage(readFailHarness, {
    type: 'saveFavorite',
    favorite: {
      title: 'Must not overwrite',
      url: 'https://read-fail.example.com/new',
      category: 'Learning'
    }
  });
  assert.equal(readFailResponse.status, 'error');
  assert.match(readFailResponse.message, /unavailable/i);
  assert.deepEqual(
    Array.from(readFailHarness.state.favorites, (item) => item.url),
    ['https://read-fail.example.com/']
  );
}

async function verifyInternalMarkPersistence() {
  const enDefaults = classifier.getDefaults('en');
  const harness = createBackgroundHarness({
    language: 'en',
    categories: enDefaults.categories,
    keywordRules: enDefaults.keywordRules,
    browserBookmarksEnabled: true,
    bookmarkWriteMode: 'overwrite',
    bookmarkOrganizeEnabled: false,
    bookmarkAutoCaptureEnabled: true
  });

  // SmartFav 自己发起的删除会把内部标记写入 storage.session，
  // 这样 worker 被回收重启后仍能识别出"这是我自己的操作"。
  await sendBackgroundMessage(harness, {
    type: 'saveFavorite',
    favorite: { title: 'Marked', url: 'https://marked.example.com/a', category: 'Tools' }
  });
  await sendBackgroundMessage(harness, {
    type: 'deleteFavorite',
    url: 'https://marked.example.com/a'
  });
  assert.ok(
    Object.prototype.hasOwnProperty.call(harness.sessionState, 'internalBookmarkRemovals'),
    'internal removal marks should be persisted into storage.session'
  );
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
  assert.deepEqual(Array.from(smartFavMoveHarness.state.favoriteOrder.Learning), [
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
  assert.deepEqual(Array.from(browserMoveHarness.state.favoriteOrder.Learning), [browserMoveUrl]);
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
  await verifyStateStore();
  await verifyBookmarkGuard();
  await verifyFavoritesServiceDependencyInjection();
  await verifyBackgroundMessageRoutes();
  await verifyBackgroundBookmarkFlows();
  await verifySaveFavoriteConsistency();
  await verifyCrossEntryConsistency();
  await verifyStorageWriteFailures();
  await verifyInternalMarkPersistence();
  assert.deepEqual(
    [...exercisedBackgroundMessageTypes].sort(),
    BACKGROUND_MESSAGE_TYPES.slice().sort(),
    'every background message route must be executed by the regression suite'
  );
  console.log('SmartFav extension verification passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
