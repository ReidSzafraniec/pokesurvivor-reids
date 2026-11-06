# Responsive pixel UI rework — design

Date: 2026-11-05 · Branch: `reidszafraniec-responsive-ui-rework`
Mockup (approved): `files/mockup/` in the session folder (`ui.css` is the visual prototype).

## Problem

- `css/style.css` (~1,400 lines) grew by accretion: ad-hoc `max-height: 520px` / width breakpoints and
  hard-coded top paddings (50/66/92px) per screen.
- `viewport-fit=cover` is set, but no CSS reads `env(safe-area-inset-*)`. On iPhones the top bar, menu
  windows and dialogs run under the Dynamic Island / rounded corners / home indicator.
- Touch devices in portrait get a blocking "rotate your phone" overlay for everything.
- The look is PMD-inspired but soft (gradients, blur, rounded boxes, glows).

## Goals

1. Crisp retro/GBA pixel look that keeps the PMD palette and Pixelify font.
2. Every screen works from iPhone SE to 4K, in portrait and landscape, including gameplay.
3. Nothing interactive or textual ever sits outside the safe area.
4. Pixel-perfect integer scaling (1×/2×/3×).

## Non-goals

- Static content pages (`guia/`, `pokedex/`, … and `css/pages.css`).
- Re-drawing the canvas HUD art (only its positions and scale change).
- Game balance, new features, new screens.

## 1. Visual system

- **Palette tokens** (~16 colors): line `#0b1838`, navy ramp `#183170 #1f3a80 #2c519f #3d67c0 #5b83d6
  #7fa3ee`, edge `#f4f8ff`, gold ramp `#fff1a8 #ffd23f #d98a10 #3a2300`, red `#ff5f6d`, green `#5fe08a`,
  purple `#a98bff`, fire `#ff8a3d`, plus existing rarity colors `--r1..--r5`.
- **Art pixel** `--ap = 0.125rem` (2px at 1×). Borders, bevels, shadows, gaps and icon sizes are
  integer multiples of `--ap`.
- **Windows** (`.box`): 9-slice SVG `border-image` (9×9, slice 4, `shape-rendering: crispEdges`):
  dark outline → white frame → light-blue inner line → navy fill, notched corners; hard shadow via
  `filter: drop-shadow(2ap 2ap 0 …)`. No gradients, no blur, no border-radius.
- **Buttons** (`.btn`): flat fill, 1-ap bevel (inset highlight top-left, shade bottom-right), 3-ap bottom
  edge. Pressed: `translateY(2ap)`, bottom edge 1ap, inverted bevel. Hover: palette step (no
  `filter: brightness`). Variants: gold (primary), ghost (secondary), small, icon, danger, disabled.
- **Pills, tabs, chips, cards, fields, menu items**: square, 1-ap outlines, gold inset outline for
  selected/on. Menu items keep the PMD cursor arrow (pixel SVG) + highlighted band.
- **Dimmed backdrops** (`.scr.dim`): 50% checkerboard dither (`conic-gradient` 2ap pattern) over a light
  tint. Tile/dither patterns are the only allowed gradients outside an explicit art allowlist
  (e.g. gacha banner art).
- **Type ladder** at 1×: 12 / 14 / 16 / 20 / 24 / 32 / 48 px (in rem). Hard 1-ap text shadow.
- **Motion**: `steps()` timing; `prefers-reduced-motion` respected (existing behavior kept).

## 2. Scaling and safe area

- `html { font-size: calc(16px * var(--s)) }`; all sizes in rem → whole pixels at every step.
- `--s: 1` default; `2` at `(min-width: 2560px) and (min-height: 1440px)`; `3` at
  `(min-width: 3840px) and (min-height: 2160px)`.
- `:root { --sa-top/right/bottom/left: env(safe-area-inset-*, 0px) }` is the **only** place `env()` is
  read. Everything else (screens, top bar, toasts, popups, town controls, engine HUD) uses the vars, so
  tests can simulate the island by overriding them.
- Screen frame: `.scr` backgrounds stay full-bleed; content padding per side =
  `max(gutter, safe inset)`, plus `--topbar-h` reserved on screens that show the top bar. Replaces all
  hard-coded top paddings.

## 3. Layout

- **Size classes** (media queries): compact = short side < 500px (phones); medium; expanded = width ≥
  1100px; each × portrait/landscape. Container queries for grids/cards. All legacy
  `max-height: 520px` / `380px` / `400px` hacks are retired.
- **Top bar**: inside safe insets. Compact: coins, tickets, sound, settings, and `⋯` overflow — a native
  `<details class="topbar-more">` holding user pill, save, news, YouTube, support, fullscreen, logout.
  Button ids are unchanged so engine wiring keeps working. Expanded: everything inline with labels.
- **Main menu**: Play is a big gold button under the partner in every layout.
  Landscape = logo + partner + Play column | list window (2 columns on compact).
  Portrait = logo, partner strip, Play, 2-column tile grid. Desktop = single-column list with
  subtitles + stats window; credits line bottom-left.
- **List/detail screens** (Pokémon, Gacha, Ranking): side by side in landscape; portrait stacks list
  then detail, with the detail's primary action sticky at the bottom.
- **Dialogs** (pause, level-up, item, bond, results, progress, evolution, settings, news, legal,
  support, nick, recover, savenote, profile, lobby, …): centered window; max-height = frame; sticky
  header and action row; body scrolls.
- **Town**: heading below safe-top; d-pad bottom-left and action button bottom-right above the home
  indicator and inside side insets; portrait supported. `town.js` fit uses long/short axis:
  `clamp(min(long/1120, short/760), .6, 1.5)`.
- Touch targets ≥ 44px on touch. Floating elements (toast, achievement pop, invite pop, sound panel,
  move tooltip, credits line) offset by the safe-area vars.

## 4. Engine changes (`js/app.min.js`)

New `tools/patch-responsive-engine.cjs`: idempotent codemod, unique-anchor checks, optional file-path
argument (for tests), same style as `tools/patch-hosting-engine.cjs`.

1. Rotate overlay never shown (`#rotate` element kept for compatibility); fullscreen no longer calls
   `screen.orientation.lock('landscape')`.
2. `Camera.fit`: `min(max(w,h)/VIEW_W, min(w,h)/MIN_VIEW_H) / zoom` — landscape unchanged, portrait
   sees the same world area rotated.
3. `Touch.safeArea()` probe reads `var(--sa-*)` instead of `env()`.
4. HUD: XP bar at `y = safe.top`; pause button uses the full top/right insets (today capped at 20/44px);
   any element that overlaps at narrow widths is repositioned (driven by the screenshot matrix).
5. Custom touch layouts saved per orientation: existing `pad` = landscape, new `padP` = portrait;
   no saved layout → defaults. Layout editor's "turn the phone" hint is removed.
6. Canvas HUD drawn at `--s` on large screens (`ctx.scale(S)`, `W/S`, `H/S`), touch hit areas scaled to
   match. `S` read from the root `--s` on resize.

## 5. Compatibility constraints

- Existing class names and ids are kept (`.box`, `.btn`, `.menu-item`, `.scr`, …); the mockup's
  `.win`/`.mi` names are illustrative only.
- Moving Play under the partner must not break engine bindings: first confirm how the engine binds
  `[data-go]` / `.menu-item`. If binding depends on the container, keep the markup in `.menu-list`
  and position it with CSS grid areas instead.
- Every class/id the engine emits keeps a style: a test compares selectors against a snapshot of the
  current stylesheet; anything dropped must be listed as retired with a reason.
- `index.html` and `en/index.html` stay structurally identical (ids, `.topbar-more`).
- Cache busting: new `style.css` and `app.min.js` version strings in both HTML files and `sw.js`;
  bump the `CODE` cache name.
- Existing tests (`tests/menu.test.cjs`, town, onboarding, hosting, …) keep passing; update only
  assertions tied to replaced markup/CSS.

## 6. Verification

- `node --test` additions:
  - selector inventory vs `tests/fixtures/legacy-style-selectors.json` (+ retired list);
  - no `blur(` anywhere; gradients only in tile/dither patterns or the art allowlist; no legacy
    `max-height: 520px` queries; `env(safe-area-inset-` only in `:root`; `.scr`, `.topbar`, `.toast`,
    town controls use `var(--sa-*)`; integer-scale ladder present;
  - engine codemod applied, idempotent on a temp copy, anchors unique; rotate never shown; camera fit
    uses long/short axis;
  - HTML parity and service-worker precache versions.
- `npm run shots` (dev-only, adds `playwright` devDependency): local static server + Chromium; devices
  iPhone SE, iPhone 15 Pro (simulated island insets via `--sa-*`), 15 Pro Max, iPad, 1280×720,
  1920×1080, 2560×1440, 3840×2160, both orientations; screens: login, starters, town, menu, training,
  Pokémon, shop, bag, gacha + pull results, settings, friends, lobby, ranking, missions, pause,
  level-up, results, XP progress, evolution, in-run HUD; output in an ignored `.shots/` folder;
  reviewed manually and every overlap/clipping issue fixed.

## Risks

- Large CSS rewrite can miss engine-generated markup → mitigated by the selector inventory and the
  screenshot matrix.
- Obfuscated engine anchors are brittle → unique-anchor checks fail loudly; codemod is idempotent.
- `filter: drop-shadow` on big scrolling windows could cost GPU on low-end phones → fall back to
  square `box-shadow` if the matrix/profiling shows jank.
