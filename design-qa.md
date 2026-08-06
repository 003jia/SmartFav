# SmartFav browser popup design QA

## Version 1.15.1 dedicated folder destination picker

- source visual truth: local user attachment `codex-clipboard-c45260d9-b333-4b1a-8c3c-8043f9b9fc76.png`, opened locally and intentionally excluded from the public repository
- implementation screenshot: unavailable; the configured in-app browser rejected the local `127.0.0.1:4173` preview before a rendered capture could be made
- intended browser viewport: 360 × 560 CSS px, device density 1
- source pixels: 1135 × 1386 px; the source represents a vertically scrollable compact folder-picker surface rather than a browser window
- state: Chinese light-glass destination picker opened from a folder move or delete-migration control

### Full-view and focused comparison evidence

The source was opened at original resolution and inspected for hierarchy, spacing, color, icon placement, selection state, and list rhythm. A same-state rendered implementation capture could not be opened, so the required side-by-side comparison and focused-region comparison are blocked. Static code inspection and automated verification are not treated as visual evidence.

### Implemented design mapping

- The former in-card dropdown opens a dedicated picker view with an explicit back action, themed search, path breadcrumb, immediate-return hint, selected-folder check, and separate child-folder navigation target.
- The picker uses the existing semantic surface, line, text, muted, primary, focus, and custom-background tokens, so glass, solid, black, parchment, dark, and custom-image themes share one component instead of falling back to a white native menu.
- Search covers allowed folders by both name and full path. Normal browsing is level-by-level; breadcrumbs return to any ancestor. The retained native select remains the business-logic source, and choosing a row dispatches its existing change event after returning to the originating view.

### Findings and comparison history

- [P1] Visual verification is blocked. The local in-app browser rejected the preview URL, so there is no rendered proof for geometry, overflow, glass composition, or interaction state at the target viewport.
- Code fix completed: removed the overlay-opening path from all three dynamic destination controls and routed favorite move, folder-parent move, and delete migration to the shared dedicated picker.
- Automated evidence: JavaScript syntax, locale syntax, `git diff --check`, and `node tests/verify-extension.js` pass. These checks cover structure and regression contracts, not visual fidelity.
- Required follow-up: open the local extension preview or a loaded extension popup, capture the picker at 360 × 560, compare it with the source in the same input, and resolve any P1/P2 differences before changing this result to passed.

final result: blocked

## Version 1.15.1 category-rule dropdown containment

- source visual truth: local user attachment `codex-clipboard-89bfa8c4-eff2-4210-b914-41e8e107c3a0.png`, reviewed locally and intentionally excluded from the public repository
- implementation screenshot: local QA capture `smartfav-category-select-inline-aligned-final.png`, reviewed locally and intentionally excluded from the public repository
- browser-rendered viewport: 367 × 448 CSS px, device density 1
- source pixels: 734 × 896 px at 2×; normalized source and final implementation: 367 × 448 px
- state: Chinese light-glass category manager with the first folder's “移动到” menu open

### Full-view and focused comparison evidence

The 2× source was downsampled to 367 × 448 and opened together with the 367 × 448 implementation capture in one comparison input. The source showed the floating menu crossing the first card boundary and obscuring the next two folder cards. The implementation keeps the same themed trigger and option styling, but contains the open menu inside the active card; the card grows from 168 px to 369 px and the next card begins below it. The full normalized view clearly exposes the card boundary, menu bottom, and following-content position, so an additional crop was not needed.

### Required fidelity surfaces

- Fonts and typography: existing folder option family, size, weight, truncation, and selected blue text remain unchanged.
- Spacing and layout rhythm: both action triggers remain top-aligned. The open list occupies normal card flow with a 5 px trigger gap and 196 px scrollable maximum height; later cards move down instead of being covered.
- Colors and visual tokens: the list retains the active glass surface, blur, border, focus ring, selected fill, and primary-blue check.
- Image quality and asset fidelity: the control contains no raster imagery; existing chevron and check assets remain unchanged and sharp.
- Copy and content: real folder destinations and their ordering remain unchanged. The disabled placeholder is still excluded.

### Findings and comparison history

- Initial finding (P1): an absolutely positioned category-rule menu overlaid following folder cards, making their controls and text visible through the glass and visually mixing unrelated rows.
- Fix: category-rule menus now participate in normal document flow while open. Only favorite-row move menus retain floating-popover positioning where card expansion would break the compact bookmark row.
- Initial implementation finding (P2): after moving the list into flow, the unopened sibling action stretched vertically and placed its trigger halfway down the enlarged card.
- Fix: aligned the two action columns and their internal grids to the start, keeping both triggers on one row.
- Post-fix evidence: the open menu is fully inside the active card, the next card starts below that card, trigger top-position difference is 0 px, viewport width and scroll width are both 367 px, and only one listbox is open.
- No actionable P0, P1, or P2 mismatch remains. No P3 follow-up is required for this correction.

### Interaction checks

- Pointer opening works for both “移动到” and “删除时迁移到”; both expand the current card and push later cards down.
- Switching between the two controls keeps exactly one listbox open.
- Escape collapses the first card from 369 px to 168 px; Enter reopens it and restores the 369 px expanded state.
- Delete migration still selects `其他`; its placeholder remains hidden and its five real destinations remain available.
- Console: no errors or warnings.
- Automated checks: JavaScript syntax, `git diff --check`, and `node tests/verify-extension.js` pass.

final result: passed

## Version 1.15.1 delete-target placeholder cleanup

- source visual truth: local user attachment `codex-clipboard-bd1b4d87-5635-40c6-9814-a4ced6327266.png`, reviewed locally and intentionally excluded from the public repository
- implementation screenshots: local QA captures `smartfav-delete-placeholder-hidden-final.png` and `smartfav-delete-placeholder-hidden-370x497.png`, reviewed locally and intentionally excluded from the public repository
- browser-rendered viewports: 360 × 560 CSS px for interaction coverage and 370 × 497 CSS px for the normalized visual comparison, device density 1
- source pixels: 740 × 994 px at 2×; normalized source and final comparison capture: 370 × 497 px
- state: Chinese light-glass category manager, the second folder's “删除时迁移到” menu open with `其他` selected

### Full-view and focused comparison evidence

The 2× source was downsampled to 370 × 497 and opened together with the 370 × 497 browser capture in one comparison input. The source exposed `选择目标文件夹` as a first menu row even though it is instructional placeholder copy, making it look like a detached label that covers the folder list. In the implementation, the trigger keeps the current fallback selection while the open list begins directly with the first real destination folder. The focused menu region was readable in the full normalized comparison, so a separate crop was not needed.

### Required fidelity surfaces

- Fonts and typography: folder option typography, current-selection weight, and blue selected text remain unchanged; only the non-actionable placeholder row is removed.
- Spacing and layout rhythm: the compact trigger, translucent menu geometry, row height, padding, radius, and shadow remain unchanged. Removing the placeholder saves one row; the later containment iteration above changes only how category-rule menus occupy space.
- Colors and visual tokens: the menu continues to use the active glass surface, blur, focus ring, selected background, and primary-blue check token.
- Image quality and asset fidelity: this control contains no raster asset; the existing chevron and selected-state check remain unchanged and sharp.
- Copy and content: `选择目标文件夹` remains available as the native empty-state placeholder, but it is disabled and excluded from the listbox; every visible menu entry is now an actual destination.

### Findings and comparison history

- Initial finding (P2): the instructional `选择目标文件夹` option was enabled, so the dynamic listbox rendered it as a selectable folder and gave the appearance of an extra label covering the menu.
- Fix: marked the placeholder option disabled. The shared dynamic listbox already filters disabled native options, so no duplicated special-case UI logic was added.
- Post-fix evidence: the open menu contains only `视频`, `工具`, `学习`, `资讯`, and `其他`; visible placeholder-option count is 0, while the retained native placeholder is still present and disabled. The document and body remain 370/370 px with no horizontal overflow.
- No actionable P0, P1, or P2 mismatch remains. No P3 follow-up is required for this correction.

### Interaction checks

- The current delete-migration value remains `其他` and its selected check is preserved.
- The disabled placeholder cannot receive pointer or keyboard selection and does not enter the rendered listbox.
- The menu still opens as a themed overlay, closes normally, and leaves the separate delete action untouched.
- Console: no errors or warnings.
- Automated checks: JavaScript syntax, `git diff --check`, and `node tests/verify-extension.js` pass.

final result: passed

## Version 1.15.1 unified folder-action dropdowns

- source visual truth: three local problem-state attachments (`codex-clipboard-4b55efc9-2e0e-4f45-902c-2788cbcb2408.png`, `codex-clipboard-324ffce0-920f-4d87-9c02-8d80baab402d.png`, and `codex-clipboard-d1c86b0e-f835-4b87-b674-cbc1c43d1f53.png`) plus the selected target attachment `codex-clipboard-de5d7beb-0fec-4266-9d70-9b5877ceaf3f.png`, reviewed locally and intentionally excluded from the public repository
- implementation screenshots: local QA captures `smartfav-dynamic-folder-move-final.png`, `smartfav-dynamic-delete-move-final.png`, and `smartfav-dynamic-favorite-move-final.png`, reviewed locally and intentionally excluded from the public repository
- browser-rendered viewport: 360 × 560 CSS px, device density 1
- source target pixels: 688 × 614 px; all three implementation captures: 360 × 560 px
- state: Chinese light-glass theme with the folder-parent, delete-migration, and favorite-move menus opened independently

### Full-view and focused comparison evidence

The target dropdown and all three final implementation states were opened together in one comparison input. The implementation intentionally preserves each host control's compact width, but matches the target's interaction language: blue focus halo, upward chevron while open, translucent blurred menu, soft selected row, blue selected text/check, rounded options, and a slim scrollbar. The three problem screenshots confirmed that the replaced surfaces were browser-native white menus with platform selection colors rather than SmartFav components.

### Required fidelity surfaces

- Fonts and typography: the existing system-font stack is retained. Compact triggers remain 10 px in row/action contexts, while menu options use 12 px semibold labels for the same readable hierarchy as the target.
- Spacing and layout rhythm: folder-rule triggers remain 30 px high and favorite-row actions remain 29 px high so the surrounding cards do not grow. Menus use 6 px padding, 2 px option gaps, 34 px rows, and a 224 px maximum height.
- Colors and visual tokens: triggers use the existing control, surface, primary, and focus tokens. Menus use `--settings-menu-bg`, the existing 18–22 px theme blur range, selected `--primary-soft`, and theme-aware text; no fixed white system surface remains.
- Image quality and asset fidelity: the requested controls contain no raster assets. The existing chevron and check icon convention is reused consistently and remains sharp at density 1.
- Copy and content: all folder paths, `移动`, `收藏分类`, `选择目标文件夹`, and bilingual accessible labels are preserved. The disabled favorite-move placeholder is correctly excluded from the target list.

### Findings and comparison history

- Initial finding (P1): favorite moves, folder-parent changes, and delete-migration targets opened as native browser menus, breaking the established glass dropdown style and producing inconsistent selection colors, borders, and shadows.
- Fix: retained the native selects as hidden value/event sources and wrapped all dynamically rendered instances with one accessible themed combobox/listbox controller.
- Initial finding (P2): compact favorite actions and half-width folder-rule fields could not use the home selector's full-width geometry without clipping or expanding their cards.
- Fix: added context variants. Folder menus use a 168 px minimum width with edge-aware alignment; favorite menus are 184 px and right-aligned. Menus switch above the trigger when vertical space is insufficient, while open rows temporarily allow overflow.
- Post-fix evidence: all three menus remained inside the 360 px viewport with no horizontal overflow. Glass used a translucent blurred surface; black resolved to `rgb(17, 20, 25)`; parchment resolved to `rgb(247, 236, 215)`. Exactly one menu remained open at a time.
- No actionable P0, P1, or P2 mismatch remains. No P3 follow-up is required for these controls.

### Interaction checks

- Favorite move: selecting `编程` moved the YouTube favorite out of `视频`, leaving the expected empty state.
- Folder parent: keyboard Enter opened the menu, ArrowDown moved focus, Escape closed and restored focus, and selecting `编程` moved `视频` beneath it; the controls rebuilt cleanly after the rerender.
- Delete migration: choosing an option updates the retained native select and selected check without deleting anything until the separate delete action is used.
- Pointer outside, view changes, rerenders, Escape, and Tab close the active menu. Only one dynamic menu can be open at a time.
- Native select change events remain the business-logic boundary; failed moves restore both the native value and the themed label.
- Glass, black, and parchment themes were switched through the real appearance control. The final handoff state is restored to light glass.
- Document and body widths both resolve to 360/360.
- Console: no errors or warnings.
- Automated checks: JavaScript syntax, `git diff --check`, and `node tests/verify-extension.js` pass.

final result: passed

## Version 1.15.1 inline folder feedback and themed search surfaces

- source visual truth: two local user attachments (`codex-clipboard-2d6242c5-7f8b-4152-9d3b-43810c2f069a.png` and `codex-clipboard-871b2480-5e47-415e-9f38-5bda54344f82.png`), reviewed locally and intentionally excluded from the public repository
- implementation screenshots: local QA captures `smartfav-create-search-final.png`, `smartfav-create-feedback-comparison.png`, and `smartfav-search-comparison-final.png`, reviewed locally and intentionally excluded from the public repository
- browser-rendered viewport: 360 × 560 CSS px, device density 1
- source pixels: create region 342 × 206 px and search region 349 × 89 px; implementation full view 360 × 560 px, with normalized crops at 342 × 206 px and 349 × 89 px
- state: Chinese category-folder view, light glass theme, successful creation of `视觉测试`, and both category/favorite search controls in their idle state

### Full-view and focused comparison evidence

The two source regions and their final implementation crops were opened together in the same comparison inputs. The create region preserves the existing title, explanation, compact input/button row, and keyword guidance, while adding one small success line directly below the input row. The search region preserves the same size and placement but replaces the visually detached opaque fill with a theme-token surface and backdrop blur. The 349 × 89 search comparison used identical source and implementation pixel dimensions.

### Required fidelity surfaces

- Fonts and typography: existing system typography, 11 px input copy, and compact hint hierarchy are unchanged. The new feedback uses a 10 px success/error line so it reads as local confirmation rather than a new section.
- Spacing and layout rhythm: the feedback occupies a new grid row directly under the create input/button only when it contains text. Empty state adds no height. Both search bars retain the existing sticky position, 8 px vertical padding, control radius, and compact 13 px search text.
- Colors and visual tokens: create success/error text uses `--success` and `--danger`. Search containers use `--search-bar-bg`, inputs use `--search-input-bg`, and both follow glass, black, parchment, solid, dark, and custom-background theme surfaces instead of a fixed pale panel.
- Image quality and asset fidelity: neither requested region includes raster assets or non-standard icons; existing assets remain unchanged.
- Copy and content: success reports the actual created folder name; duplicate and empty-name errors use existing bilingual messages. Chinese and English translations remain key-aligned.

### Findings and comparison history

- Initial finding (P1): folder creation feedback was emitted in the generic status area below the entire manager and automatic focus moved the viewport to the new rule, so the user could not see whether creation succeeded beside the initiating field.
- Fix: introduced a dedicated live status in the create grid, routed creation success and validation/conflict errors to it, retained focus on the create field, and clear the message when the user starts the next name.
- Initial finding (P2): both search bars used a special opaque glass override, making the search region appear like a foreign white strip instead of part of the selected theme.
- Fix: introduced semantic search surface variables, removed the fixed glass override, added input-level backdrop blur, and mapped custom backgrounds to `--custom-surface`.
- Post-fix evidence: successful creation remained visible at y 243 directly below the input ending at y 237. Duplicate and whitespace-only name paths showed inline errors. Glass resolved to translucent `rgba(247, 249, 252, 0.12)` / `rgba(255, 255, 255, 0.16)` surfaces; black resolved to `rgb(23, 26, 31)` / `rgb(11, 13, 16)`; parchment resolved to `rgb(234, 217, 184)` / `rgb(244, 231, 203)`.
- No actionable P0, P1, or P2 mismatch remains. No P3 follow-up is required for these focused changes.

### Interaction checks

- Successful folder creation shows `已创建“视觉测试”，请继续填写匹配关键词` below the create row and keeps the create input focused and visible.
- Reusing the same folder name shows the localized conflict message in the same position.
- A whitespace-only name shows `请填写文件夹名称` and returns focus to the input.
- Typing a new name clears the previous create message.
- Both `favoritesSearchInput` and `categoriesSearchInput` use the same themed search variables and 18 px backdrop blur.
- Glass, black, and parchment themes were switched through the real appearance control and rendered without horizontal overflow; the final preview was restored to light glass.
- Document and body widths both resolve to 360/360.
- Console: no errors or warnings.
- Automated checks: JavaScript syntax, locale syntax, `git diff --check`, and `node tests/verify-extension.js` pass.

final result: passed

## Version 1.15.1 themed settings dropdowns

- source visual truth: four local user attachments (`codex-clipboard-10119f4e-aa6b-4f92-83bb-cfa0069601c2.png`, `codex-clipboard-e02cebae-fd09-492f-8494-20cbf8ae1c41.png`, `codex-clipboard-7ec1383d-72fc-46cc-96df-382087b07f99.png`, and `codex-clipboard-90b5814b-801d-4fd7-8c39-669017274e72.png`), reviewed locally and intentionally excluded from the public repository
- implementation screenshot: local QA capture `smartfav-themed-select-provider-final.png`, reviewed locally and intentionally excluded from the public repository
- browser-rendered viewport: 360 × 560 CSS px, device density 1
- source provider screenshot: 362 × 310 px; implementation full view: 360 × 560 px; implementation comparison crop: 360 × 310 px
- state: Chinese settings view, light glass theme, AI enabled, provider menu open with Ollama selected

### Full-view and focused comparison evidence

The source AI-provider screenshot and a 360 × 310 implementation crop were opened together in one comparison input. The source exposed the browser's opaque white native picker, which ignored SmartFav's glass surface and focus treatment. The implementation keeps the same compact field width and option order but renders an app-owned listbox using the active theme tokens, a translucent blurred surface, the existing blue focus halo, and a clear selected-option check. Separate live checks covered the bookmark write mode, classification strategy, and appearance style menus.

### Required fidelity surfaces

- Fonts and typography: the existing system-font stack and 12 px settings-field typography remain unchanged. Option labels keep their Chinese and English translations and truncate safely when space is constrained.
- Spacing and layout rhythm: the trigger remains 38 px high, options are 32 px high, and the menu uses compact 6 px padding and 2 px gaps. The menu automatically opens upward when the remaining settings viewport is too short.
- Colors and visual tokens: glass uses `--settings-menu-bg` with 22 px blur and 145% saturation; white, gray, black, and parchment inherit their semantic overlay surfaces. The selected row uses `--primary-soft` and `--primary`, while hover/focus states reuse existing control tokens.
- Image quality and asset fidelity: the controls contain no raster imagery. The chevron and selected-state check use the existing inline icon convention and remain sharp at device density 1.
- Copy and content: provider, strategy, write-mode, and appearance option values are unchanged. Language switching re-renders every option label without reopening the popup.

### Findings and comparison history

- Initial finding (P1): the four native `<select>` menus were drawn by the browser as opaque white system popups, so they broke glass, black, parchment, and custom-background themes.
- Fix: retained each native select as the single state and persistence source, hid only its visual surface, and added an accessible themed combobox/listbox controller that dispatches the existing native `change` event.
- Post-fix evidence: glass, black, and parchment menus were rendered and inspected in the browser. Black resolved to `rgb(17, 20, 25)` with white option text; parchment resolved to `rgb(247, 236, 215)` with brown option text. White and gray are covered by the same semantic overlay token path. No horizontal overflow occurred at 360 px.
- No actionable P0, P1, or P2 mismatch remains. No P3 follow-up is required for this focused interaction.

### Interaction checks

- All four settings controls expose `role="combobox"`, `aria-expanded`, `aria-controls`, and a labelled `role="listbox"`; option state uses `aria-selected`.
- Pointer selection updates the retained native select and invokes the existing theme, AI-provider, classification-strategy, or bookmark-write handler.
- Keyboard checks covered Enter/Space opening and selection, Arrow navigation, Home/End, Escape, Tab closing, focus restoration, and outside-click dismissal.
- Only one settings menu can be open at a time; switching views or collapsing its settings section closes it.
- The Chinese/English switch re-renders translated option labels. Theme switching was verified for glass, black, and parchment, with the final state restored to Chinese light glass.
- DOM/content: all four native selects remain present and hidden, all menus are closed after interaction, and document/body widths both resolve to 360/360.
- Console: no errors or warnings.
- Automated checks: JavaScript syntax, `git diff --check`, and `node tests/verify-extension.js` pass.

final result: passed

## Version 1.15.1 category-folder drop preview

- source visual truth: user-provided category-folder drag reference, reviewed locally and intentionally excluded from the public repository
- implementation screenshot: local browser-rendered comparison, reviewed locally and intentionally excluded from the public repository
- browser-rendered viewport: 360 × 560 CSS px, device density 1
- source pixels: 686 × 648; implementation focused crop: 360 × 310
- state: light glass theme, Favorites category grid, last folder being moved toward the top edge of the second folder

### Full-view and focused comparison evidence

The source and implementation were opened together after matching the active drag state. The reference establishes the desired thin blue horizontal insertion line used by bookmark rows. The category grid keeps the same compact two-column layout, fades the dragged source card, highlights the target, and now shows exactly one blue guide on the edge nearest the pointer. No numbered badge remains. Separate rendered checks covered top, bottom, left, and right; the focused category crop was sufficient because all affected cards, grips, counts, and edge feedback remain legible.

### Required fidelity surfaces

- Fonts and typography: existing system-font family, card-name weight, count size, line height, truncation, and search-field copy are unchanged; no new visible text or number is introduced by the drop preview.
- Spacing and layout rhythm: the 8 px grid gap and 48 px card height are preserved. The 3 px guide occupies the existing gap and the target shifts only 3 px during preview, so no layout reflow or horizontal overflow is introduced.
- Colors and visual tokens: all four guides, the target border, and focus halo reuse `--primary`, `--primary-soft`, and `--focus-ring`; no new hard-coded theme surface was introduced.
- Image quality and asset fidelity: this interaction contains no raster imagery or non-standard icon asset. Existing bookmark icon assets are unaffected.
- Copy and content: folder names and favorite counts remain unchanged. Screen-reader status announces the dragged folder and its predicted final position in both Chinese and English.

### Findings and comparison history

- Initial finding (P2): the first iteration distinguished only before/after with left/right guides and added a numeric badge, but the requested behavior is a four-edge guide matching the bookmark-row horizontal insertion line without a number.
- Fix: removed the badge and `data-drop-position`, split the target into nearest-edge top/bottom/left/right hit zones, mapped top/left to before and bottom/right to after, and added matching horizontal or vertical guides.
- Post-fix evidence: top and bottom resolve to 146 × 3 px guides; left and right resolve to 3 × 36 px guides. All four use the primary blue token, no numeric drop badge exists, document width equals client width at 360 px, and no framework overlay or console warning/error is present.
- No actionable P0, P1, or P2 mismatch remains. No P3 follow-up is required for this focused interaction.

### Interaction checks

- Page identity: `SmartFav`, Favorites view, local 1.15.1 source.
- Visual preview: screenshots used a temporary local QA state to render the top, bottom, left, and right edge states independently. That fixture was removed from the formal source before packaging, so no folder is highlighted by default.
- Real reorder path: keyboard `Alt + ArrowLeft` moved `项目资料` from position 7 to position 6, restored focus to the moved card, and announced `“项目资料”已移动到第 6 位`.
- DOM/content: all seven folder cards remain present, counts remain readable, and document width is 360/360 with no horizontal overflow.
- Console: no errors or warnings.
- Automated checks: JavaScript syntax, `git diff --check`, and `node tests/verify-extension.js` pass.

final result: passed

## Version 1.8.0 navigation, sizing, trash, and background

Browser verification at the native 360 × 560 popup size confirmed that the
My Favorites and Category Folders views both render a content-level back
button directly beneath the toolbar header, at x 14 and y 61, with no
horizontal overflow. Verification screenshots were reviewed locally and are
intentionally excluded from the public repository.

The appearance controls resized the rendered document and app shell from
360 × 560 to 440 × 480 in real time; the settings view retained zero
horizontal overflow at the new size. A local PNG upload set the custom
background data URL, preview state, and clear control without producing
console errors.

Recently Deleted verification moved a favorite out of the collection,
displayed a 7-day remaining period, restored it, deleted it again, and then
permanently removed it. The final list and count updated immediately at every
step. Static background-worker tests additionally verify hourly alarm
scheduling and automatic removal of expired entries.

## Version 1.6.0 native popup return

The shipping surface has returned to the browser-owned toolbar popup through
`action.default_popup = popup.html`. The page-injected floating host and the
standalone library window have been removed. The document, body, and app shell
use a zero outer radius and no outer border or shell shadow, so the visible
frame is the browser's native rectangular popup canvas.

## Version 1.6.1 black-theme transition

Black still forces and locks dark mode. The appearance selector now tracks the
previous preview style; leaving black for any other style clears the dark-mode
checkbox, restores light mode immediately, and re-enables the mode control.

## Version 1.5.0 floating-panel verification

The active product surface is now a webpage-injected floating panel instead of
the browser-owned action popup. It opens 12 px from the top-right of a normal
webpage, uses a 360 px compact width and 18 px clipped corners, and leaves the
current webpage visibly exposed outside all four corners.

Final verification evidence:

- desktop collection view at 1280 x 800
- desktop settings view at 1280 x 800
- narrow viewport at 390 x 844
- desktop panel bounds: x 908, y 12, width 360, height 416
- desktop settings bounds: x 908, y 12, width 360, height 538
- narrow panel bounds: x 12, y 12, width 351, height 416
- narrow document width and scroll width both resolve to 375 px, so there is no
  horizontal overflow
- the toolbar action toggles the surface, the in-panel close button removes it,
  and Escape provides an additional close path
- console errors in the desktop, settings, and narrow checks: none

The floating host uses a closed Shadow DOM so page styles do not contaminate
the extension UI. Its iframe reports content height to the host, allowing the
settings state to grow without turning the surrounding page into a plugin
canvas. Edge-protected pages such as `edge://` and the extension stores cannot
accept injected scripts; the toolbar badge reports that limitation.

## Version 1.5.1 protected-page fallback

Computer-use verification in Microsoft Edge confirmed that the injected panel
and its “我的收藏” expansion work on `https://example.com`. The reported red
exclamation badge came from clicking SmartFav on `edge://extensions/`, where
Edge blocks all extension page injection. Version 1.5.1 replaces that dead end
with a compact standalone “我的收藏” window. Protected pages still cannot be
saved, but stored favorites and settings remain reachable.

## Version 1.5.2 live sizing and glass composition

The standalone library window now measures `.app-shell` instead of the browser
viewport and reports that value whenever its content changes. Browser
verification measured 443 px for the expanded library, 114 px after collapse,
and 538 px for compact settings; each reported value matched the rendered shell
height. The background worker adds only the native window frame allowance and
updates the popup window between 160 and 720 px.

The page-injected panel now owns the actual `blur(24px) saturate(150%)`
backdrop filter. The embedded default glass theme uses translucent shell and
surface tokens, so the outer host blurs the real webpage rather than trying to
simulate glass inside an opaque extension canvas.

The source reference and implementation screenshots were reviewed locally and
are intentionally excluded from the public repository.

viewport: 348 px wide; default collection view 411 CSS px tall; compact settings viewport 540 CSS px tall

source pixels: 466 x 522; normalized comparison copy: 348 x 390

implementation pixels: collection view 348 x 411; compact settings 348 x 540

states:

- default glass popup, local keyword suggestion ready, collection panel collapsed
- settings opened from the popup, appearance selector visible, AI and browser favorites disabled
- black settings theme with white text and its dark-mode control locked

## Full-view comparison evidence

The normalized source crop and the latest default implementation were opened together at native width. Both preserve the small browser-extension footprint, compact vertical rhythm, thin separators, restrained controls, and a single toolbar-popup surface. SmartFav uses a translucent blue-white glass treatment by default while keeping the reference's density and direct interaction pattern.

## Focused region comparison evidence

A separate focused crop was not needed: at 348 px wide, the full-view comparison keeps the header, classification control, primary action, privacy copy, and collapsed collection row legible at native size.

## Required fidelity surfaces

- Fonts and typography: system UI font stack matches the browser-menu character of the reference. Hierarchy, weights, line heights, truncation, and small-label sizing are consistent with a toolbar popup.
- Spacing and layout rhythm: the 348 x 411 collection view stays close to the normalized reference footprint. Settings uses a 480 px internal scroll region inside a 540 px popup viewport, preserving the compact single-column rhythm with no page-level horizontal overflow.
- Colors and visual tokens: the default glass theme uses translucent white surfaces, a soft blue canvas, neutral dark text, and a restrained blue primary action. White, gray, black, and parchment themes reuse the same semantic tokens; black resolves to `rgb(255, 255, 255)` text.
- Image quality and asset fidelity: the reference icons belong to another extension's commands and are outside the SmartFav content target. The implementation does not replace them with fake glyphs or CSS drawings; real page favicons are used when available.
- Copy and content: the title/domain block is now explicitly labeled `当前网页 / Current page`, clarifying that it identifies the active tab. Settings keeps appearance, local classification, optional AI, browser favorites, categories, and advanced keyword rules inside the same compact surface.

## Findings

No actionable P0, P1, or P2 mismatches remain for the stated target: a small browser-toolbar popup with selectable appearance, a clear active-page region, and compact inline settings.

P3 follow-up: the native checkbox is visually squarer than the reference extension's switch. It remains a platform-accessible control and does not affect compactness or task clarity. A real-extension capture may also show a slightly different outer shadow because Chrome owns the popup window frame.

## Interaction checks

- Manual category change updates the save button label.
- Save action reaches the success state and updates the collection count.
- Collection panel expands with `aria-expanded=true`.
- Settings opens inside the same 348 px popup and returns to the collection view.
- The `EN / 中` control switches all static and dynamic UI copy, default categories, keyword summaries, button labels, and accessibility labels without reopening the popup.
- AI fields stay collapsed by default, expand only after AI is enabled, and update provider/model/API Key requirements.
- Browser favorites stays disabled by default; enabling it reveals exactly one write-mode selector with `覆盖同网址 / 始终新增`.
- The browser-favorites settings state uses internal vertical scrolling and has no page-level or settings-level horizontal overflow at 348 px.
- Settings save reaches the `设置已保存` state.
- The five theme choices resolve to `glass`, `white`, `gray`, `black`, and `parchment`.
- The top `暗 / 明` control changes and persists the color mode; English copy changes to `Dark / Light`.
- Black style always resolves to dark mode, disables both quick and settings dark-mode controls, and renders primary text in white.
- Closing settings without saving restores the previously saved appearance.
- The active-page title/domain region is labeled in both Chinese and English.
- The legacy `options.html` entry redirects to `popup.html?view=settings`; the manifest no longer declares a separate options page.
- No horizontal overflow at 348 px.
- Browser console errors: none.

## Comparison history

- Earlier implementation used a light page canvas and nested rounded cards, which made the popup read like a miniature dashboard.
- Fix: replaced the canvas with one white surface, removed nested-card shadows and decorative initial placeholders, tightened the frame to 348 x 395, and moved library content behind a collapsed row.
- A later settings implementation still opened as a separate, wider options page.
- Fix: moved settings into the popup, kept optional AI configuration progressively disclosed, removed the manifest options-page entry, and left a compatibility redirect for old links.
- Version 1.2 added a compact language control and browser-favorites settings without changing the single-surface layout or primary save hierarchy.
- Version 1.3 adds semantic theme tokens, five saved appearance styles, a saved light/dark mode, and an explicit current-page label.
- Version 1.3.1 removes the `max-width: 346px` / `body: 100vw` feedback loop and fixes both `html` and `body` at 348 px. At the browser runtime's minimum 240 px test viewport, the document still reports a 348 px intrinsic width; at 348 px it has no horizontal overflow.
- Version 1.4 increases the glass blur to 30 px with layered translucent gradients and 14 px shell corners. It replaces the raw comma-list and multiline rule editor with per-folder add, remove, and keyword controls. Browser verification added `设计`, saved `figma, UI, 设计`, and confirmed the home summary changed from 6 to 7 categories.
- Version 1.4.1 adapts the glass treatment to Edge's opaque native popup backing: a 360 px canvas contains a 348 px glass shell inset by 6 px, with an 18 px radius, visible internal blue/cyan/violet light field, 32 px shell blur, and 18 px panel blur.
- Version 1.4.2 corrects the glass composition to match the supplied overlay reference: the blue/cyan/violet field now lives on the popup backdrop behind the shell, while the 348 px shell is a neutral translucent overlay with 26 px backdrop blur, a white edge highlight, and shadow.
- Version 1.4.3 follows the user's simplified requirement: all decorative backdrop pseudo-elements are removed, the popup canvas is transparent, and a 344 px shell is inset by 8 px with an 18 px clipped radius, visible neutral border, and soft shadow.
- Version 1.4.4 removes the remaining visible popup-canvas strip below the rounded shell by reducing body padding to 1 px, making the glass-theme canvas transparent, and disabling its outer shadow. The shell remains clipped to an 18 px radius and expands to 358 px within the 360 px popup.
- Version 1.4.5 applies the 18 px radius to the root `html` canvas, `body`, and `.app-shell`, removes body padding entirely, and adds `overflow: hidden`, rounded `clip-path`, and paint containment so the extension document itself is clipped at all four corners.
- Version 1.5.0 moves the compact interface out of the browser-owned action popup and into a page-injected floating panel. The toolbar action toggles an isolated extension iframe at the page's top-right, with an 18 px clip, independent close control, dynamic height messages, and webpage content visible outside every corner.
- Post-fix visual evidence was reviewed locally and is intentionally excluded from the public repository.

final result: passed
