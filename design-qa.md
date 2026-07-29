# SmartFav browser popup design QA

## Version 1.8.0 navigation, sizing, trash, and background

Browser verification at the native 360 × 560 popup size confirmed that the
My Favorites and Category Folders views both render a content-level back
button directly beneath the toolbar header, at x 14 and y 61, with no
horizontal overflow. The current repository screenshot is
`docs/smartfav-popup.png`.

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

- desktop collection view, 1280 x 800:
  `/Users/jiayancheng/Documents/SmartFav-main/audit/15-floating-home.png`
- desktop settings view, 1280 x 800:
  `/Users/jiayancheng/Documents/SmartFav-main/audit/16-floating-settings.png`
- narrow viewport, 390 x 844:
  `/Users/jiayancheng/Documents/SmartFav-main/audit/17-floating-mobile.png`
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

source visual truth path: `/Users/jiayancheng/Documents/SmartFav-main/audit/reference-browser-popup.png`

implementation screenshot paths:

- default glass collection view: `/Users/jiayancheng/Documents/SmartFav-main/audit/12-theme-glass-default.png`
- black compact settings: `/Users/jiayancheng/Documents/SmartFav-main/audit/13-theme-settings-black.png`
- glass appearance settings: `/Users/jiayancheng/Documents/SmartFav-main/audit/14-appearance-settings-glass.png`

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
- Post-fix evidence: `audit/12-theme-glass-default.png`, `audit/13-theme-settings-black.png`, and `audit/14-appearance-settings-glass.png`, with the default view visually compared against `audit/reference-browser-popup-348.png`.

final result: passed
