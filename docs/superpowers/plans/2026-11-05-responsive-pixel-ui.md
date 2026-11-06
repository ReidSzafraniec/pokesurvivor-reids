# Responsive Pixel UI Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the game UI as a crisp retro/GBA pixel system that respects iPhone safe areas, works in portrait and landscape (including gameplay) from iPhone SE to 4K, and snaps to integer 1×/2×/3× scales.

**Architecture:** `css/style.css` is rewritten section by section in place (tokens → components → shell → screens → run), each commit leaving the game working; legacy token aliases bridge unported sections until the final cleanup. Small readable modules (`js/topbar.js`, `js/ui-scale.js`) plus an idempotent, anchor-checked codemod (`tools/patch-responsive-engine.cjs`) adapt the obfuscated engine (`js/app.min.js`). Node tests guard selectors, layout rules and engine patches; a Playwright screenshot matrix verifies devices visually.

**Tech Stack:** Plain HTML/CSS/JS (no build step), Node ≥22 `node:test`, Playwright (dev-only), Firebase hosting (unchanged).

**Spec:** `docs/superpowers/specs/2026-11-05-responsive-pixel-ui-design.md` (session copy: `files/responsive-pixel-ui-design.md`). **Approved mockup:** `files/mockup/` in the session folder (`ui.css` is the visual reference; run `node files/mockup/serve.cjs <repo> 8791`).

## Global Constraints

- Scope: `index.html`, `en/index.html`, `css/style.css`, `js/town.js`, `js/app.min.js` (via codemod), new `js/topbar.js`, `js/ui-scale.js`, tools, tests, README. Do **not** touch `css/pages.css` or static content pages.
- Keep every existing id and class name; engine binds by id and `#scr-menu [data-go]`. Mockup names `.win`/`.mi` are illustrative only.
- `index.html` and `en/index.html` stay structurally identical (en is translated at runtime; its markup is Spanish too).
- `env(safe-area-inset-*)` is read **only** in `:root` as `--sa-top/--sa-right/--sa-bottom/--sa-left`; everything else uses those vars.
- Integer scale: `html { font-size: calc(16px * var(--s)) }`; `--s: 1` default, `2` at `(min-width: 2560px) and (min-height: 1440px)`, `3` at `(min-width: 3840px) and (min-height: 2160px)`. Lengths in rem or multiples of `--ap` (`0.125rem`).
- Size-class media queries — use these exact strings (tests compare them):
  - COMPACT `(max-width: 499px), (max-height: 499px)`
  - COMPACT_LAND `(max-height: 499px) and (orientation: landscape)`
  - PORTRAIT `(orientation: portrait)`
  - EXPANDED `(min-width: 1100px) and (min-height: 600px)`
- No `blur(`, no `backdrop-filter`, no `border-radius` on UI chrome (circles via `50%` allowed). `linear-gradient`/`radial-gradient` only in the art allowlist: `.banner`, `.ball`, `#pull-fx`, `.shop-sign`, `.evolution-running`, `.yt-btn .rec`. `conic-gradient` is allowed for dither/tile patterns.
- Touch targets ≥ 44px (`2.75rem`) on touch.
- Top-bar overflow uses a `<button id="topbar-more">` + `js/topbar.js` toggle (spec amendment: a closed `<details>` cannot show its children inline on wide screens).
- `version.json` `v` must equal the `app.min.js?v=` query in both HTML files and `sw.js` and be 10 lowercase hex chars (existing test).
- Commit after every task with the trailer `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`.
- Run tests with `npm test` (= `node --test tests/*.test.cjs`). Baseline before Task 1: all existing tests pass.

## File Map

| File | Responsibility |
|---|---|
| `css/style.css` | Whole UI stylesheet, sectioned: tokens, base, components, shell, menu, collection, social, run, town, i18n |
| `index.html`, `en/index.html` | Top-bar overflow markup, Play button moved under partner, new script tags, cache-busting versions |
| `js/topbar.js` (new) | Top-bar overflow toggle (`install(document)`) |
| `js/ui-scale.js` (new) | Reads `--s`; scales canvas HUD and touch hit areas (`create(root)`) |
| `js/town.js` | `fitScale(width, height)` long/short-axis fit, used by `resize()` |
| `tools/patch-responsive-engine.cjs` (new) | Idempotent anchored codemod: portrait, camera fit, safe-area probe, HUD positions, per-orientation touch layouts, HUD scale hooks |
| `js/app.min.js` | Patched output of the codemod |
| `tools/extract-selectors.cjs` (new) | Lists class/id tokens used in a stylesheet's selectors |
| `tools/ui-shots.cjs` (new) | Playwright screenshot matrix (`npm run shots`) |
| `tests/helpers/css.cjs` (new) | Minimal CSS rule reader + size-class constants |
| `tests/fixtures/legacy-style-selectors.json` (new) | Snapshot of selector tokens before the rewrite |
| `tests/ui-style.test.cjs` (new) | Selector inventory, tokens, safe area, scale ladder, per-section layout rules, cleanup rules |
| `tests/ui-modules.test.cjs` (new) | `topbar.js`, `ui-scale.js`, `town.fitScale` |
| `tests/responsive-engine.test.cjs` (new) | Codemod applied, idempotent, camera math |
| `tests/menu.test.cjs` | Updated cache/precache assertions |
| `sw.js`, `version.json` | New asset versions, cache name `ps-code-v24` |
| `README.md` | Portrait support, safe areas, scaling, `npm run shots` |

## Legacy Section Map (`git show 58362b0:css/style.css`)

Line numbers are approximate; each block starts at the quoted comment or selector.

| Lines | Block | Ported in |
|---|---|---|
| 1–46 | fonts, `:root`, base | Task 2 |
| 47–96 | town overlay | Task 8 |
| 97–122 | `#game`, `.scr`, `.dim`, keyframes | Task 3 |
| 124–202 | `.box`, `.btn`, `.row`, menu-list/menu-item, forms, logo | Task 2 (logo → Task 4) |
| 203–240 | test/result (legacy quiz), `.stage` | Task 4 / Task 2 |
| 241–325 | grid/cell, split/panel/stat, mon-extra, type, filters, dex-tools, pause-sum, chip | Task 2 (components), Task 5 (dex), Task 7 (pause-sum) |
| 327–388 | menu layout, splash, partner-card, topbar, pill, coin, credits | Task 3 / Task 4 |
| 390–550 | upgrades, gacha banner, pull-fx, ball, support-ask, pcard, shop | Task 5 |
| 552–595 | cards, stats, kbd, toast, scrollbar, narrow menu | Task 2 / Task 4 |
| 597–700 | icons, move-tip, gen-tabs, starters, Halloween, seg, caught | Task 2 / Task 4 / Task 5 |
| 712–745 | sound panel, cloud/sync, legal, boot | Task 3 / Task 6 |
| 747–836 | friends, lobby, invite-pop, ranking, mod, card states, tickets, upg-head, slot | Task 6 / Task 7 / Task 5 |
| 838–900 | goals, missions, achievements, legendaries, favorites, profile, ach-pop, card.evo/bond | Task 6 / Task 7 |
| 903–975 | touch/rotate, settings, layout editor, keys, pad-focus, about, danger | Task 3 / Task 6 |
| 977–1032 | low-screen blocks (`max-height: 520px/400px`) | dropped; intent re-expressed per section |
| 1034–1093 | boot-in, tapstart, login tags, support, bind/ban, video, news, YouTube | Task 3 / Task 4 / Task 5 / Task 6 |
| 1094–1178 | menu-banner carousel (permanently hidden) | Task 4 (only the hidden rule survives) |
| 1179–1215 | save, sup-tab, dex compact | Task 3 / Task 6 / Task 5 |
| 1217–1222 | CJK fonts | Task 2 |
| 1224–1280 | top-bar fixes | dropped (Task 3 replaces) |
| 1282–1394 | training, results/progress, evolution | Task 5 / Task 7 |

## Conversion Recipe (apply to every ported legacy rule)

1. Lengths: `Npx` → `N/16 rem` (e.g. `14px` → `0.875rem`, `10px 20px` → `0.625rem 1.25rem`). 1–3px borders → `var(--ap)`; 4–6px → `calc(2 * var(--ap))`/`calc(3 * var(--ap))`.
2. `border-radius` → remove (keep only `50%` circles: dots, joystick, ball).
3. Panel/inset backgrounds `rgba(0,0,0,.18–.35)` → `var(--navy-0)`; card backgrounds → `var(--navy-2)`; hairline borders `rgba(244,248,255,.1–.4)` → `var(--ap) solid var(--edge-in)`; selected/on → inset gold outline `box-shadow: inset 0 0 0 var(--ap) var(--gold)`.
4. Gradients outside the art allowlist → flat token color (top color of the old gradient mapped to the nearest token).
5. Blurred `box-shadow` → hard `calc(2 * var(--ap)) calc(2 * var(--ap)) 0 var(--line)`; glow shadows → `0 0 0 var(--ap) <color>` ring; glow pulses → `steps(2)` alternation between two ring colors.
6. `filter: brightness(...)` hovers → background one step lighter on the navy ramp; remove `backdrop-filter`.
7. Animations: keep names; timing `steps(3)`/`steps(4)`; keep existing `prefers-reduced-motion` overrides.
8. `max-height: calc(100dvh - Npx)` / `vh` caps → `max-height: 100%` (the `.scr` frame already subtracts safe areas and gutters).
9. Fixed-position elements: offsets become `calc(var(--frame-*) + …)`.
10. Each dropped `@media (max-height: 520px|400px|380px)` / `(max-width: 760px|600px…)` block is rewritten under COMPACT / COMPACT_LAND / PORTRAIT / EXPANDED next to the section it affects.

---

### Task 0: Housekeeping

**Files:**
- Delete: `.playwright-mcp/` (stray untracked tool output)
- Modify: `.gitignore`
- Create: `docs/superpowers/specs/2026-11-05-responsive-pixel-ui-design.md`, `docs/superpowers/plans/2026-11-05-responsive-pixel-ui.md`

- [ ] **Step 1: Clean and ignore tool output**

```powershell
Remove-Item -Recurse -Force .playwright-mcp
Add-Content .gitignore ".playwright-mcp/`n.shots/"
```

- [ ] **Step 2: Copy spec and plan into the repo**

```powershell
$s = 'C:\Users\ruria\.copilot\session-state\51b8b974-7461-4626-b20f-935229712f99'
New-Item -ItemType Directory -Force docs\superpowers\specs, docs\superpowers\plans | Out-Null
Copy-Item "$s\files\responsive-pixel-ui-design.md" docs\superpowers\specs\2026-11-05-responsive-pixel-ui-design.md
Copy-Item "$s\plan.md" docs\superpowers\plans\2026-11-05-responsive-pixel-ui.md
```

- [ ] **Step 3: Baseline tests**

Run: `npm test`
Expected: all existing tests PASS (record the count).

- [ ] **Step 4: Commit**

```powershell
git add .gitignore docs/superpowers
git commit -m "Add responsive pixel UI spec and plan" -m "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

### Task 1: CSS test helper and selector inventory

**Files:**
- Create: `tests/helpers/css.cjs`, `tools/extract-selectors.cjs`, `tests/fixtures/legacy-style-selectors.json`, `tests/ui-style.test.cjs`

**Interfaces:**
- Produces: `require('./helpers/css.cjs')` → `{ rules(source), find(source, selector, media = ''), tokens(source), MEDIA: { COMPACT, COMPACT_LAND, PORTRAIT, EXPANDED } }`. `rules` returns `[{ media, selector, body }]` (media = normalized prelude after `@media`, `''` at top level; `@keyframes`/`@font-face` skipped). `find` merges the bodies of every rule whose comma-separated selector list contains `selector` exactly and whose media equals `media` (whitespace-normalized) into `{ media, selector, body }`, else returns `undefined`. `tokens` returns the sorted unique `.class`/`#id` tokens across all selectors.
- Produces: `RETIRED` map in `tests/ui-style.test.cjs` (token → reason) that later tasks extend.

- [ ] **Step 1: Write the helper**

```js
// tests/helpers/css.cjs
// Minimal CSS reader for tests: top-level and @media rules (one nesting level).
const MEDIA = {
  COMPACT: '(max-width: 499px), (max-height: 499px)',
  COMPACT_LAND: '(max-height: 499px) and (orientation: landscape)',
  PORTRAIT: '(orientation: portrait)',
  EXPANDED: '(min-width: 1100px) and (min-height: 600px)'
};
const norm = text => text.replace(/\s+/g, ' ').trim();

function rules(source) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const close = open => {
    for (let depth = 0, i = open; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}' && --depth === 0) return i;
    }
    throw new Error('Unbalanced CSS near offset ' + open);
  };
  (function walk(from, to, media) {
    for (let at = from; at < to;) {
      const open = css.indexOf('{', at);
      if (open < 0 || open >= to) return;
      const prelude = norm(css.slice(at, open));
      const end = close(open);
      if (prelude.startsWith('@media')) walk(open + 1, end, norm(prelude.slice(6)));
      else if (!prelude.startsWith('@')) out.push({ media, selector: prelude, body: norm(css.slice(open + 1, end)) });
      at = end + 1;
    }
  })(0, css.length, '');
  return out;
}

function find(source, selector, media = '') {
  const matches = rules(source).filter(rule => rule.media === norm(media) &&
    rule.selector.split(',').map(norm).includes(selector));
  return matches.length ? { media: norm(media), selector, body: matches.map(rule => rule.body).join(' ') } : undefined;
}

function tokens(source) {
  const set = new Set();
  for (const { selector } of rules(source)) {
    for (const token of selector.replace(/\[[^\]]*\]/g, '').match(/[.#]-?[A-Za-z_][\w-]*/g) || []) set.add(token);
  }
  return [...set].sort();
}

module.exports = { MEDIA, rules, find, tokens };
```

- [ ] **Step 2: Write the extractor and snapshot the legacy selectors**

```js
// tools/extract-selectors.cjs
// Prints the class/id tokens a stylesheet's selectors use (JSON array).
const fs = require('node:fs');
const path = require('node:path');
const { tokens } = require('../tests/helpers/css.cjs');
const file = process.argv[2] || path.join(__dirname, '..', 'css', 'style.css');
process.stdout.write(JSON.stringify(tokens(fs.readFileSync(file, 'utf8')), null, 2) + '\n');
```

Run: `node tools/extract-selectors.cjs | Out-File -Encoding utf8NoBOM tests/fixtures/legacy-style-selectors.json`
Expected: a JSON array of several hundred tokens including `".box"`, `"#scr-menu"`, `".menu-item"`, `".mb-slide"`.

- [ ] **Step 3: Write the inventory test**

```js
// tests/ui-style.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { MEDIA, rules, find, tokens } = require('./helpers/css.cjs');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const css = read('css/style.css');
const legacy = require('./fixtures/legacy-style-selectors.json');

// Selectors intentionally dropped by the rewrite, with the reason.
const RETIRED = {};

test('every legacy selector token is still styled or explicitly retired', () => {
  const current = new Set(tokens(css));
  const missing = legacy.filter(token => !current.has(token) && !RETIRED[token]);
  assert.deepEqual(missing, [], 'Restyle these or add them to RETIRED with a reason');
  for (const [token, reason] of Object.entries(RETIRED)) assert.ok(reason.length > 10, token + ' needs a reason');
});
```

- [ ] **Step 4: Run it**

Run: `node --test tests/ui-style.test.cjs`
Expected: PASS (stylesheet unchanged so far).

- [ ] **Step 5: Commit**

```powershell
git add tests/helpers/css.cjs tools/extract-selectors.cjs tests/fixtures/legacy-style-selectors.json tests/ui-style.test.cjs
git commit -m "Add CSS test helper and legacy selector inventory" -m "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

### Task 2: Tokens, integer scale, safe area, base and components

**Files:**
- Modify: `css/style.css` (replace legacy lines ≈1–46 except the town block, and the component rules listed in Step 4)
- Test: `tests/ui-style.test.cjs`

**Interfaces:**
- Produces CSS custom properties used by every later task: `--s`, `--ap`, `--sa-top|right|bottom|left`, `--gut`, `--topbar-h`, `--frame-t|r|b|l`, `--hard`, `--dither`, `--frame-img`, `--frame-gold`, palette `--line --navy-0..5 --edge-in --hi --edge --gold-hi --gold --gold-lo --gold-ink --red --green --purple --fire --night --ink --muted --r1..--r5`, legacy aliases `--box1 --box2 --edge-out --gold2 --shadow` (removed in Task 13).
- Produces component classes: `.box .btn(.gold|.ghost|.small|.danger|.google) .row .grow .menu-list .menu-item .mi-ico .tabs .tab .gen-tabs .gen-tab .field .chip .chips .filters .seg kbd .type .tag-chip .stage .grid .cell .panel .split .wide .stat .cards .card .stats .pill .coin .toast .move-tip .pad-focus`.

- [ ] **Step 1: Write the failing tests** (append to `tests/ui-style.test.cjs`)

```js
test('tokens: integer scale ladder, art pixel and safe-area vars', () => {
  assert.match(find(css, 'html').body, /font-size: calc\(16px \* var\(--s\)\)/);
  assert.match(find(css, ':root', '(min-width: 2560px) and (min-height: 1440px)').body, /--s: 2/);
  assert.match(find(css, ':root', '(min-width: 3840px) and (min-height: 2160px)').body, /--s: 3/);
  const root = find(css, ':root').body;
  assert.match(root, /--ap: 0\.125rem/);
  for (const side of ['top', 'right', 'bottom', 'left']) {
    assert.match(root, new RegExp(`--sa-${side}: env\\(safe-area-inset-${side}, 0px\\)`));
  }
  assert.match(root, /--frame-t: max\(var\(--gut\), var\(--sa-top\)\)/);
});

test('env(safe-area-inset-*) is only read in :root', () => {
  const readers = rules(css).filter(rule => /env\(safe-area-inset/.test(rule.body));
  assert.deepEqual(readers.map(rule => rule.selector), [':root']);
});

test('components are pixel-crisp: 9-slice windows, beveled buttons, no radius or gradients', () => {
  assert.match(find(css, '.box').body, /border-image: var\(--frame-img\) 4 fill \/ calc\(4 \* var\(--ap\)\) stretch/);
  assert.match(find(css, '.btn').body, /inset var\(--ap\) var\(--ap\) 0 var\(--hi\)/);
  assert.match(find(css, '.btn:active').body, /translateY\(calc\(2 \* var\(--ap\)\)\)/);
  for (const selector of ['.box', '.btn', '.btn.gold', '.btn.ghost', '.pill', '.tab', '.gen-tab', '.chip', '.card', '.cell', '.panel', '.field', '.stage', '.toast']) {
    const rule = find(css, selector);
    assert.ok(rule, selector + ' must be styled at top level');
    assert.doesNotMatch(rule.body, /border-radius|linear-gradient|radial-gradient|blur\(/, selector);
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/ui-style.test.cjs`
Expected: the three new tests FAIL (no `--ap`, `.box` uses gradients); inventory test PASS.

- [ ] **Step 3: Insert the new foundation block at the top of `css/style.css`**

Replace everything from the file start through the legacy `canvas { image-rendering… }` line (≈ line 46), keeping the town block that follows (Task 8 ports it), with:

```css
/* ============ PokéSurvivor — pixel UI (retro handheld × Mystery Dungeon) ============
 * Size classes (use these exact queries everywhere):
 *   COMPACT      (max-width: 499px), (max-height: 499px)
 *   COMPACT_LAND (max-height: 499px) and (orientation: landscape)
 *   PORTRAIT     (orientation: portrait)
 *   EXPANDED     (min-width: 1100px) and (min-height: 600px)
 * Lengths are rem or multiples of --ap, so the 2× and 3× scales land on whole pixels.
 * env(safe-area-inset-*) is read only in :root, as --sa-*. */
@font-face { font-family: 'Pixelify'; src: url('../assets/fonts/PixelifyPS-400.ttf') format('truetype'); font-weight: 400 550; font-display: block; }
@font-face { font-family: 'Pixelify'; src: url('../assets/fonts/PixelifyPS-700.ttf') format('truetype'); font-weight: 551 900; font-display: block; }

:root {
  --s: 1;
  --ap: 0.125rem;
  --sa-top: env(safe-area-inset-top, 0px);
  --sa-right: env(safe-area-inset-right, 0px);
  --sa-bottom: env(safe-area-inset-bottom, 0px);
  --sa-left: env(safe-area-inset-left, 0px);
  --gut: 0.75rem;
  --topbar-h: 2.75rem;
  --frame-t: max(var(--gut), var(--sa-top));
  --frame-r: max(var(--gut), var(--sa-right));
  --frame-b: max(var(--gut), var(--sa-bottom));
  --frame-l: max(var(--gut), var(--sa-left));
  --line: #0b1838; --navy-0: #162b62; --navy-1: #183170; --navy-2: #1f3a80; --navy-3: #2c519f; --navy-4: #3d67c0; --navy-5: #4a76d0;
  --edge-in: #5b83d6; --hi: #7fa3ee; --edge: #f4f8ff;
  --gold-hi: #fff1a8; --gold: #ffd23f; --gold-lo: #d98a10; --gold-ink: #3a2300;
  --red: #ff5f6d; --green: #5fe08a; --purple: #a98bff; --fire: #ff8a3d; --night: #050914;
  --ink: #f4f8ff; --muted: #a9bfe8;
  --r1: #9fb1c9; --r2: #5fe08a; --r3: #4fb4ff; --r4: #c47bff; --r5: #ffcb3d;
  --hard: calc(2 * var(--ap)) calc(2 * var(--ap)) 0 var(--line);
  --font: 'Pixelify', 'Segoe UI', system-ui, sans-serif;
  --dither: conic-gradient(rgba(5, 9, 20, .8) 25%, transparent 0 50%, rgba(5, 9, 20, .8) 0 75%, transparent 0);
  --frame-img: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9' viewBox='0 0 9 9' shape-rendering='crispEdges'%3E%3Cdefs%3E%3Cg id='c'%3E%3Cpath fill='%230b1838' d='M2 0h2v1H2zM1 1h1v1H1zM0 2h1v2H0z'/%3E%3Cpath fill='%23f4f8ff' d='M2 1h2v1H2zM1 2h1v2H1z'/%3E%3Cpath fill='%235b83d6' d='M2 2h2v1H2zM2 3h1v1H2z'/%3E%3Cpath fill='%231f3a80' d='M3 3h1v1H3z'/%3E%3C/g%3E%3C/defs%3E%3Cuse href='%23c'/%3E%3Cuse href='%23c' transform='matrix(-1 0 0 1 9 0)'/%3E%3Cuse href='%23c' transform='matrix(1 0 0 -1 0 9)'/%3E%3Cuse href='%23c' transform='matrix(-1 0 0 -1 9 9)'/%3E%3Cpath fill='%230b1838' d='M4 0h1v1H4zM4 8h1v1H4zM0 4h1v1H0zM8 4h1v1H8z'/%3E%3Cpath fill='%23f4f8ff' d='M4 1h1v1H4zM4 7h1v1H4zM1 4h1v1H1zM7 4h1v1H7z'/%3E%3Cpath fill='%235b83d6' d='M4 2h1v1H4zM4 6h1v1H4zM2 4h1v1H2zM6 4h1v1H6z'/%3E%3Cpath fill='%231f3a80' d='M3 3h3v3H3z'/%3E%3C/svg%3E");
  --frame-gold: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9' viewBox='0 0 9 9' shape-rendering='crispEdges'%3E%3Cdefs%3E%3Cg id='c'%3E%3Cpath fill='%230b1838' d='M2 0h2v1H2zM1 1h1v1H1zM0 2h1v2H0z'/%3E%3Cpath fill='%23ffd23f' d='M2 1h2v1H2zM1 2h1v2H1z'/%3E%3Cpath fill='%235b83d6' d='M2 2h2v1H2zM2 3h1v1H2z'/%3E%3Cpath fill='%231f3a80' d='M3 3h1v1H3z'/%3E%3C/g%3E%3C/defs%3E%3Cuse href='%23c'/%3E%3Cuse href='%23c' transform='matrix(-1 0 0 1 9 0)'/%3E%3Cuse href='%23c' transform='matrix(1 0 0 -1 0 9)'/%3E%3Cuse href='%23c' transform='matrix(-1 0 0 -1 9 9)'/%3E%3Cpath fill='%230b1838' d='M4 0h1v1H4zM4 8h1v1H4zM0 4h1v1H0zM8 4h1v1H8z'/%3E%3Cpath fill='%23ffd23f' d='M4 1h1v1H4zM4 7h1v1H4zM1 4h1v1H1zM7 4h1v1H7z'/%3E%3Cpath fill='%235b83d6' d='M4 2h1v1H4zM4 6h1v1H4zM2 4h1v1H2zM6 4h1v1H6z'/%3E%3Cpath fill='%231f3a80' d='M3 3h3v3H3z'/%3E%3C/svg%3E");
  /* Legacy aliases for sections not yet ported (removed in Task 13). */
  --box1: var(--navy-3); --box2: var(--navy-1); --edge-out: var(--line); --gold2: var(--gold-lo); --shadow: var(--line);
}
@media (min-width: 2560px) and (min-height: 1440px) { :root { --s: 2; } }
@media (min-width: 3840px) and (min-height: 2160px) { :root { --s: 3; } }

/* ---------- base ---------- */
* { box-sizing: border-box; }
.hidden { display: none !important; }
html { font-size: calc(16px * var(--s)); }
html, body { height: 100%; margin: 0; overscroll-behavior: none; -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; }
body { background: var(--night); color: var(--ink); font: 1rem/1.3 var(--font); overflow: hidden; -webkit-font-smoothing: none; touch-action: manipulation; }
body, body * { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
input, textarea, [contenteditable] { -webkit-user-select: text; user-select: text; -webkit-touch-callout: default; }
canvas, img.pix { image-rendering: pixelated; image-rendering: crisp-edges; }
img.pix { vertical-align: middle; }
img.pix.off { filter: grayscale(1); opacity: .4; }
#game { display: block; position: fixed; inset: 0; width: 100%; height: 100%; touch-action: none; }
button, input, select { font: inherit; color: inherit; }
body.touch kbd, body.touch .card .key, body.touch .kbd-hint { display: none !important; }
.touch-hint { display: none; }
body.touch .touch-hint { display: block; }
html:lang(zh-Hant) { --font: 'Pixelify', 'PingFang TC', 'Microsoft JhengHei', 'Noto Sans CJK TC', system-ui, sans-serif; }
html:lang(zh-Hans) { --font: 'Pixelify', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', system-ui, sans-serif; }
html:lang(zh) body { line-height: 1.5; -webkit-font-smoothing: antialiased; }
html:lang(zh) .btn, html:lang(zh) .chip { letter-spacing: 0; }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes pop { from { transform: scale(.94); opacity: 0; } to { transform: none; opacity: 1; } }

/* ---------- windows ---------- */
.box {
  position: relative; max-height: 100%; overflow: auto; padding: 0.75rem 1rem;
  border: calc(4 * var(--ap)) solid transparent;
  border-image: var(--frame-img) 4 fill / calc(4 * var(--ap)) stretch;
  filter: drop-shadow(var(--hard));
  text-shadow: var(--ap) var(--ap) 0 var(--line);
  animation: pop .2s steps(3) both;
}
.box h1, .box h2, .box h3 { margin: 0 0 0.375rem; font-weight: 700; }
.box h2 { font-size: 1.5rem; color: var(--gold); }
.box h3 { font-size: 1.125rem; }
.sub { color: var(--muted); margin: 0 0 1rem; font-size: 0.875rem; }
.gold { color: var(--gold); }
.center { text-align: center; }
.note { color: var(--muted); font-size: 0.75rem; margin-top: 0.75rem; }
.err { color: #ffb0b8; min-height: 1.25rem; font-size: 0.875rem; margin: 0.5rem 0 0; }
.wide { width: min(61.25rem, 100%); }
.split { display: grid; grid-template-columns: minmax(0, 1fr) 18.75rem; gap: 1rem; }
.panel { padding: 0.75rem; background: var(--navy-0); border: var(--ap) solid var(--line); box-shadow: inset 0 0 0 var(--ap) var(--edge-in); }
.row { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
.row.end { justify-content: flex-end; }
.row.between { justify-content: space-between; }
.row.wrap { flex-wrap: wrap; }
.grow { flex: 1; }

/* ---------- buttons ---------- */
.btn {
  appearance: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem;
  min-height: 2.75rem; padding: 0.375rem 0.875rem 0.25rem; white-space: nowrap;
  font-size: 1rem; font-weight: 700; line-height: 1; color: var(--ink); text-shadow: var(--ap) var(--ap) 0 var(--line);
  background: var(--navy-4); border: var(--ap) solid var(--line); border-bottom-width: calc(3 * var(--ap));
  box-shadow: inset var(--ap) var(--ap) 0 var(--hi), inset calc(-1 * var(--ap)) calc(-1 * var(--ap)) 0 var(--navy-1);
}
.btn:hover { background: var(--navy-5); }
.btn:active { transform: translateY(calc(2 * var(--ap))); border-bottom-width: var(--ap); box-shadow: inset var(--ap) var(--ap) 0 var(--navy-1); }
.btn.gold { color: var(--gold-ink); text-shadow: none; background: var(--gold);
  box-shadow: inset var(--ap) var(--ap) 0 var(--gold-hi), inset calc(-1 * var(--ap)) calc(-1 * var(--ap)) 0 var(--gold-lo); }
.btn.gold:hover { background: #ffdd60; }
.btn.gold:active { box-shadow: inset var(--ap) var(--ap) 0 var(--gold-lo); }
.btn.ghost { background: rgba(11, 24, 56, .78); box-shadow: inset 0 0 0 var(--ap) var(--edge-in); }
.btn.ghost:hover { background: var(--navy-3); }
.btn.small { min-height: 2.25rem; padding: 0.25rem 0.5rem 0.125rem; font-size: 0.875rem; }
body.touch .btn.small { min-height: 2.75rem; }
.btn.danger { background: #8a1f2e; box-shadow: inset var(--ap) var(--ap) 0 #ff8a96, inset calc(-1 * var(--ap)) calc(-1 * var(--ap)) 0 #4f0f19; }
.btn.google { color: #1f2a44; text-shadow: none; background: var(--edge); box-shadow: inset var(--ap) var(--ap) 0 #ffffff, inset calc(-1 * var(--ap)) calc(-1 * var(--ap)) 0 #b9c4d8; }
.btn:disabled { cursor: not-allowed; transform: none; color: #9aa6c0; background: #4a5470; box-shadow: none; }
a.btn { text-decoration: none; color: var(--ink); }

/* ---------- menu list (PMD cursor + highlighted band) ---------- */
.menu-list { display: grid; gap: var(--ap); }
.menu-item {
  appearance: none; position: relative; cursor: pointer; width: 100%; min-height: 2.75rem;
  display: grid; grid-template-columns: 1.75rem minmax(0, 1fr); column-gap: 0.5rem; align-items: center;
  padding: 0.25rem 0.5rem 0.25rem 1.125rem; text-align: left; background: none; border: 0;
  font-size: 1.25rem; font-weight: 700; line-height: 1.1; text-shadow: var(--ap) var(--ap) 0 var(--line);
}
.menu-item small { grid-column: 2; min-width: 0; font-size: 0.75rem; font-weight: 400; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.menu-item::before { content: ''; position: absolute; left: 0.25rem; top: 50%; width: 0.5rem; height: 0.875rem; margin-top: -0.4375rem;
  background: var(--ico-cursor) no-repeat center / contain; image-rendering: pixelated; opacity: 0; }
.menu-item:hover, .menu-item:focus-visible { outline: none; background: var(--navy-3); box-shadow: inset 0 0 0 var(--ap) var(--edge-in); }
.menu-item:hover::before, .menu-item:focus-visible::before { opacity: 1; }
.mi-ico { grid-row: span 2; display: flex; }
.mi-ico img { width: 1.5rem; height: 1.5rem; }

/* ---------- tabs, fields, chips ---------- */
.tabs { display: flex; gap: var(--ap); margin-bottom: 0.875rem; }
.tab, .gen-tab {
  appearance: none; cursor: pointer; min-height: 2.75rem; padding: 0.375rem 0.75rem; line-height: 1.1;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--ap);
  font-weight: 700; text-align: center; text-shadow: var(--ap) var(--ap) 0 var(--line);
  background: var(--navy-2); border: var(--ap) solid var(--line); box-shadow: inset 0 0 0 var(--ap) var(--edge-in);
}
.tab { flex: 1; }
.tab:hover, .gen-tab:hover { background: var(--navy-3); }
.tab.on, .gen-tab.on { color: var(--gold); background: var(--navy-3); box-shadow: inset 0 0 0 var(--ap) var(--gold); }
.gen-tabs { display: flex; gap: var(--ap); overflow-x: auto; padding: var(--ap) 0 0.5rem; margin-top: 0.375rem; scrollbar-width: none; }
.gen-tabs::-webkit-scrollbar { display: none; }
.gen-tab { flex: 0 0 auto; }
.gen-tab b { font-size: 0.9375rem; }
.gen-tab small { font-size: 0.6875rem; font-weight: 400; color: var(--muted); }
.gen-tab.on b { color: var(--gold); }
label { display: block; font-size: 0.875rem; color: var(--muted); margin: 0.5rem 0 0.25rem; }
.field, select.field { width: 100%; min-height: 2.75rem; padding: 0.5rem 0.75rem; font-size: 1rem; font-family: var(--font);
  color: var(--ink); background: var(--line); border: var(--ap) solid var(--edge-in); outline: none; }
.field:focus { border-color: var(--gold); }
.chip { appearance: none; cursor: pointer; min-height: 2rem; padding: var(--ap) 0.5rem; font-size: 0.8125rem;
  background: rgba(11, 24, 56, .8); border: var(--ap) solid var(--edge-in); text-shadow: var(--ap) var(--ap) 0 var(--line); }
.chip.on { color: var(--gold); border-color: var(--gold); }
.chips { display: flex; gap: 0.375rem; flex-wrap: wrap; }
.filters { display: flex; gap: 0.375rem; flex-wrap: wrap; margin-bottom: 0.625rem; }
.seg { display: flex; width: max-content; margin: var(--ap) auto 0.5rem; border: var(--ap) solid var(--line); }
.seg button { appearance: none; cursor: pointer; min-height: 2rem; padding: var(--ap) 0.75rem; display: flex; gap: 0.3125rem; align-items: center;
  font-size: 0.875rem; color: var(--muted); background: var(--navy-2); border: 0; text-shadow: var(--ap) var(--ap) 0 var(--line); }
.seg button.on { color: var(--ink); background: var(--navy-4); box-shadow: inset 0 0 0 var(--ap) var(--hi); }
kbd { display: inline-block; padding: 0 0.375rem; font: inherit; font-size: 0.8125rem; text-shadow: none;
  border: var(--ap) solid var(--edge-in); border-bottom-width: calc(2 * var(--ap)); }
.type, .tag-chip { display: inline-block; padding: 0 0.375rem; font-size: 0.75rem; font-weight: 700; line-height: 1.5;
  color: #10131a; text-shadow: none; border: var(--ap) solid var(--line); }
.type { margin-right: 0.25rem; }
.tag-chip { font-size: 0.6875rem; }
.tag-chip.cat { color: var(--ink); background: var(--navy-1); border-color: var(--edge-in); }
.m-rw img, .a-rw img, .tag-chip img { vertical-align: middle; }

/* ---------- sprites, grids, stats, cards ---------- */
.stage { display: block; margin: 0.5rem auto 0.375rem; background: var(--line); border: var(--ap) solid var(--line);
  box-shadow: inset 0 0 0 var(--ap) var(--stage-c, var(--edge-in)), var(--hard); }
.stage.shiny { box-shadow: inset 0 0 0 var(--ap) #9ae6ff, 0 0 0 var(--ap) #9ae6ff, var(--hard); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(6rem, 1fr)); gap: 0.5rem; max-height: 56vh; overflow-y: auto; padding: 0.25rem; }
.cell { position: relative; cursor: pointer; text-align: center; padding: 0.25rem 0.125rem 0.375rem;
  background: var(--navy-0); border: var(--ap) solid var(--line); box-shadow: inset 0 0 0 var(--ap) var(--navy-3); }
.cell:hover { background: var(--navy-2); box-shadow: inset 0 0 0 var(--ap) var(--edge-in); }
.cell.on { background: var(--navy-3); box-shadow: inset 0 0 0 var(--ap) var(--gold); }
.cell.locked { cursor: default; opacity: .75; }
.cell.locked:hover { background: var(--navy-0); box-shadow: inset 0 0 0 var(--ap) var(--navy-3); }
.cell canvas { display: block; margin: 0 auto; }
.cell b { display: block; font-size: 0.8125rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cell .no { position: absolute; top: 0.1875rem; left: 0.375rem; font-size: 0.6875rem; color: var(--muted); }
.cell .stars { font-size: 0.625rem; }
.cell .partner { position: absolute; top: 0.1875rem; right: 0.3125rem; font-size: 0.75rem; }
.stars-row { display: inline-flex; gap: 0.0625rem; vertical-align: middle; }
.cell .stars-row { display: flex; justify-content: center; margin-top: var(--ap); }
.badge-r { position: absolute; top: 0.1875rem; right: 0.25rem; }
.stat { display: grid; grid-template-columns: 5.625rem minmax(0, 1fr) 2.125rem; gap: 0.5rem; align-items: center; font-size: 0.875rem; margin: 0.3125rem 0; }
.stat .bar { height: 0.5rem; background: var(--line); }
.stat .bar i { display: block; height: 100%; background: var(--gold); }
.stat.nat-up > span:first-child, .stat.nat-up > span:last-child { color: #7fe8a0; }
.stat.nat-up .bar i { background: var(--green); }
.stat.nat-down > span:first-child, .stat.nat-down > span:last-child { color: #ff9aa5; }
.stat.nat-down .bar i { background: var(--red); }
.cards { display: flex; flex-direction: column; gap: 0.625rem; width: min(35rem, 100%); }
.card { display: flex; align-items: center; gap: 0.875rem; min-height: 2.75rem; padding: 0.75rem 0.875rem; text-align: left; cursor: pointer;
  background: var(--navy-2); border: var(--ap) solid var(--line); box-shadow: inset 0 0 0 var(--ap) var(--edge-in); }
.card:hover { background: var(--navy-3); box-shadow: inset 0 0 0 var(--ap) var(--gold); }
.card .ico { flex: 0 0 2.875rem; height: 2.875rem; display: grid; place-items: center; font-size: 1.5rem; border: var(--ap) solid var(--line); }
.card .ico img { display: block; }
.card .txt { flex: 1; }
.card .nm { font-weight: 700; font-size: 1.125rem; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.card .ds { color: var(--muted); font-size: 0.875rem; }
.card .key { font-size: 0.8125rem; color: var(--muted); border: var(--ap) solid var(--edge-in); padding: var(--ap) 0.5rem; }
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin: 0.625rem 0 1.125rem; }
.stats > div { padding: 0.5rem 0.625rem; background: var(--navy-0); border: var(--ap) solid var(--line); }
.stats > div > span:first-child { display: block; color: var(--muted); font-size: 0.75rem; text-transform: uppercase; }
.stats b { font-size: 1.375rem; }
.move-icons { display: flex; flex-wrap: wrap; gap: 0.1875rem; margin: 0 0 0.625rem; }

/* ---------- pills, toast, tooltip, focus, scrollbars ---------- */
.pill { display: flex; align-items: center; gap: 0.375rem; min-height: 2.125rem; padding: 0 0.625rem 0 0.375rem; font-weight: 700;
  background: var(--navy-2); border: var(--ap) solid var(--edge); box-shadow: 0 0 0 var(--ap) var(--line), var(--hard);
  text-shadow: var(--ap) var(--ap) 0 var(--line); }
.coin { display: inline-block; width: 1.125rem; height: 1.125rem; background: var(--ico-coin) no-repeat center / contain; image-rendering: pixelated; }
.toast { position: fixed; z-index: 60; left: 50%; bottom: calc(var(--frame-b) + 1.25rem); transform: translateX(-50%); pointer-events: none;
  max-width: calc(100% - var(--frame-l) - var(--frame-r)); padding: 0.625rem 1.125rem;
  background: var(--navy-1); border: var(--ap) solid var(--edge); box-shadow: 0 0 0 var(--ap) var(--line), var(--hard);
  text-shadow: var(--ap) var(--ap) 0 var(--line); animation: pop .2s steps(3); }
.move-tip { position: fixed; z-index: 30; max-width: 16.25rem; padding: 0.5rem 0.625rem; pointer-events: none; font-size: 0.875rem;
  background: var(--navy-2); border: var(--ap) solid var(--edge); box-shadow: 0 0 0 var(--ap) var(--line), var(--hard); }
.move-tip-tags { display: flex; gap: 0.25rem; margin: 0.3125rem 0; }
.move-tip .sub { margin: 0; font-size: 0.75rem; line-height: 1.4; }
.pad-focus { outline: calc(2 * var(--ap)) solid var(--gold) !important; outline-offset: var(--ap); }
::-webkit-scrollbar { width: 0.625rem; height: 0.625rem; }
::-webkit-scrollbar-thumb { background: var(--edge-in); border: var(--ap) solid var(--line); }
::-webkit-scrollbar-track { background: var(--line); }
```

- [ ] **Step 4: Delete the superseded legacy rules**

Remove the legacy declarations of every selector defined in Step 3 wherever they appear (`git show 58362b0:css/style.css` lines ≈36–46, 97–100 `#game`/`button`/`input`, 124–196, the `.stage`/`.stage.shiny` rules ≈224–233, ≈241–262 grid/cell/wide/split/panel/stat, `.type`/`.filters` ≈276–283, `.chip` ≈318–324, `.pill`/`.coin` ≈376–384, ≈552–587 cards/stats/kbd/toast/scrollbars, ≈597–627 icons/move-tip/gen-tabs, ≈702–708 `.seg`, ≈903–911 base touch rules, `.chips` ≈952, `.pad-focus` ≈958, `.btn.danger`/`.row.wrap`/`.touch-hint`/`a.btn` ≈965–974, `.btn.google` ≈728, CJK ≈1217–1222). When a legacy selector list mixes ported and unported selectors, delete only the ported selectors from the list.

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS, including the inventory test (a FAIL there names a selector you deleted without re-adding — restore it).

- [ ] **Step 6: Smoke check in a browser**

Run: `python -m http.server 8080` then open `http://localhost:8080/` (guest login). Expected: windows show notched pixel frames, buttons bevel and sink on press; nothing is invisible. Stop the server.

- [ ] **Step 7: Commit**

```powershell
git add css/style.css tests/ui-style.test.cjs
git commit -m "Pixel UI foundation: tokens, integer scale, safe-area vars, components" -m "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

### Task 3: Screen frame, top bar overflow and floating elements

**Files:**
- Create: `js/topbar.js`, `tests/ui-modules.test.cjs`
- Modify: `index.html`, `en/index.html` (top bar markup, script tag), `css/style.css`
- Test: `tests/ui-style.test.cjs`, `tests/ui-modules.test.cjs`

**Interfaces:**
- Consumes: Task 2 tokens (`--frame-*`, `--topbar-h`, `--dither`, `--frame-img`, `--frame-gold`, `--hard`).
- Produces: `#topbar-more` button + `#topbar-menu` container; `.topbar.more-open` state class; `require('../js/topbar.js')` → `{ install(doc) }` returning `{ set(open: boolean) }` or `null` when markup is missing. In the browser it self-installs on `document`.

- [ ] **Step 1: Write failing tests**

Append to `tests/ui-style.test.cjs`:

```js
const html = { es: read('index.html'), en: read('en/index.html') };
Object.assign(RETIRED, Object.fromEntries(['#scr-test', '#scr-result', '#scr-nick', '#scr-over', '#scr-progress'].map(token => [token,
  'Only referenced by the dropped max-height:520px padding override; the safe-area .scr frame now pads these screens'])));
const topbarIds = source => [...source.slice(source.indexOf('<div id="topbar"'), source.indexOf('<div id="sound-panel"'))
  .matchAll(/id="([^"]+)"/g)].map(match => match[1]);

test('top bar: primary actions inline, secondary actions in the overflow menu, identical in both pages', () => {
  assert.deepEqual(topbarIds(html.es), topbarIds(html.en));
  const menu = html.es.slice(html.es.indexOf('id="topbar-menu"'), html.es.indexOf('<div id="sound-panel"'));
  for (const id of ['user-pill', 'btn-save', 'btn-news', 'btn-yt', 'btn-support', 'btn-full', 'btn-logout']) {
    assert.match(menu, new RegExp(`id="${id}"`), id + ' belongs in the overflow menu');
  }
  assert.match(html.es, /<button id="topbar-more"[^>]*aria-expanded="false"[^>]*aria-controls="topbar-menu"/);
  for (const source of Object.values(html)) {
    assert.ok(source.indexOf('js/topbar.js?v=') > 0 && source.indexOf('js/topbar.js?v=') < source.indexOf('js/app.min.js?v='));
  }
});

test('screens and floating UI sit inside the safe-area frame', () => {
  assert.match(find(css, '.scr').body, /padding: var\(--frame-t\) var\(--frame-r\) var\(--frame-b\) var\(--frame-l\)/);
  assert.match(find(css, '#scr-dex').body, /padding-top: calc\(var\(--frame-t\) \+ var\(--topbar-h\) \+ var\(--gut\)\)/);
  assert.match(find(css, '.topbar').body, /top: var\(--frame-t\)/);
  for (const selector of ['.toast', '.sound-panel', '.credits-line', '.invite-pop', '.ach-pop']) {
    assert.match(find(css, selector).body, /var\(--frame-/, selector);
  }
  assert.match(find(css, '.scr.dim').body, /background-image: var\(--dither\)/);
  assert.match(find(css, '.topbar-menu', MEDIA.EXPANDED).body, /display: contents/);
  assert.match(find(css, '#rotate').body, /display: none !important/);
});
```

Create `tests/ui-modules.test.cjs`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { install } = require('../js/topbar.js');

function element() {
  const classes = new Set(), attrs = {}, listeners = {};
  return {
    classes, attrs, listeners,
    classList: { toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)), contains: name => classes.has(name) },
    setAttribute: (name, value) => { attrs[name] = String(value); },
    getAttribute: name => (name in attrs ? attrs[name] : null),
    addEventListener: (type, fn) => { listeners[type] = fn; },
    contains: target => Boolean(target && target.inside)
  };
}

test('top bar overflow opens, closes on item click, outside click and Escape', () => {
  const bar = element(), toggle = element(), menu = element(), docListeners = {};
  const doc = {
    getElementById: id => ({ topbar: bar, 'topbar-more': toggle, 'topbar-menu': menu })[id],
    addEventListener: (type, fn) => { docListeners[type] = fn; }
  };
  install(doc);
  const stop = { stopPropagation() {} };
  toggle.listeners.click(stop);
  assert.equal(toggle.attrs['aria-expanded'], 'true');
  assert.ok(bar.classes.has('more-open'));
  menu.listeners.click({ target: { closest: () => ({}) } });
  assert.equal(toggle.attrs['aria-expanded'], 'false');
  toggle.listeners.click(stop);
  docListeners.click({ target: { inside: false } });
  assert.ok(!bar.classes.has('more-open'));
  toggle.listeners.click(stop);
  docListeners.keydown({ key: 'Escape' });
  assert.ok(!bar.classes.has('more-open'));
});

test('top bar overflow is inert when its markup is missing', () => {
  assert.equal(install({ getElementById: () => null, addEventListener() {} }), null);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/ui-style.test.cjs tests/ui-modules.test.cjs`
Expected: FAIL (`Cannot find module '../js/topbar.js'`, missing `#topbar-more`, legacy `.scr` padding).

- [ ] **Step 3: Create `js/topbar.js`**

```js
// Top-bar overflow ("⋯") on phones and tablets. Button ids are untouched, so the engine's wiring keeps working.
(function () {
  function install(doc) {
    const bar = doc.getElementById('topbar');
    const toggle = doc.getElementById('topbar-more');
    const menu = doc.getElementById('topbar-menu');
    if (!bar || !toggle || !menu) return null;
    const set = open => {
      toggle.setAttribute('aria-expanded', String(open));
      bar.classList.toggle('more-open', open);
    };
    toggle.addEventListener('click', event => {
      event.stopPropagation();
      set(toggle.getAttribute('aria-expanded') !== 'true');
    });
    menu.addEventListener('click', event => {
      if (event.target && event.target.closest && event.target.closest('button, .pill')) set(false);
    });
    doc.addEventListener('click', event => { if (!bar.contains(event.target)) set(false); });
    doc.addEventListener('keydown', event => { if (event.key === 'Escape') set(false); });
    return { set };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { install };
  else install(document);
})();
```

- [ ] **Step 4: Replace the top-bar markup in `index.html` and `en/index.html`**

Replace the whole `<div id="topbar" …>…</div>` block (index.html ≈ lines 210–221) in **both** files with:

```html
<div id="topbar" class="topbar hidden">
  <div class="pill"><span class="coin"></span><span id="coins">0</span></div>
  <div class="pill" id="tickets-pill" title="Tickets del gacha"></div>
  <button id="btn-sound" class="btn small ghost" title="Sonido"></button>
  <button id="btn-settings" class="btn small ghost" title="Ajustes"></button>
  <button id="topbar-more" class="btn small ghost" type="button" aria-expanded="false" aria-controls="topbar-menu" title="Más opciones"><span class="dots" aria-hidden="true"></span></button>
  <div id="topbar-menu" class="topbar-menu">
    <div class="pill" id="user-pill"></div>
    <button id="btn-save" class="btn small gold save-btn hidden" title="Guardar la partida en la nube"></button>
    <button id="btn-news" class="btn small ghost news-btn" title="Novedades"></button>
    <button id="btn-yt" class="btn small ghost yt-btn" title="Mi canal de YouTube"></button>
    <button id="btn-support" class="btn small gold hidden" title="Apoyar el proyecto"></button>
    <button id="btn-full" class="btn small ghost hidden" title="Pantalla completa"></button>
    <button id="btn-logout" class="btn small ghost">Salir</button>
  </div>
</div>
```

In both files add, directly before `<script defer src="js/app.min.js?v=…">`:

```html
<script defer src="js/topbar.js?v=pixel-ui-1"></script>
```

- [ ] **Step 5: Add the shell CSS** (after the components block) and delete the superseded legacy rules: `.scr`, `.scr.hidden`, `body.touch #scr-levelup…` touch-action, the `@media (min-height: 521px)` padding-top list, `.scr.dim`, `.topbar*`, `#user-pill*`, `.save-btn`, `.news-btn*`, `.yt-btn*`, `#btn-sound`, `#btn-support span`, `.sound-panel`, `.sound-inline`, `.snd-row`, `input[type=range]*`, `.credits-line*`, `.invite-pop*`, `.ach-pop*`, `.sync*`, `#rotate*`, `@keyframes rot-hint`, `.boot*`, `.tapstart*`, `.tap-blink`, `@keyframes blink`, and the whole top-bar fix sections (≈1224–1280).

```css
/* ---------- screen frame ---------- */
.scr { position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center;
  padding: var(--frame-t) var(--frame-r) var(--frame-b) var(--frame-l); animation: fade .2s steps(4); }
.scr.hidden { display: none; }
.scr.dim { background-color: rgba(5, 9, 20, .35); background-image: var(--dither); background-size: calc(2 * var(--ap)) calc(2 * var(--ap)); }
#scr-goals, #scr-dex, #scr-upgrades, #scr-gacha, #scr-friends, #scr-rank, #scr-lobby, #scr-profile, #scr-shop, #scr-news,
#scr-training, #scr-bag, #scr-mod { padding-top: calc(var(--frame-t) + var(--topbar-h) + var(--gut)); }
/* Level-up/bond/item on touch: outside the window drags the joystick (touch.js). */
body.touch #scr-levelup, body.touch #scr-bond, body.touch #scr-item { touch-action: none; }
#rotate { display: none !important; }   /* kept for the engine; portrait is supported */
#rotate-ico { display: inline-block; }

/* ---------- top bar ---------- */
.topbar { position: fixed; z-index: 25; top: var(--frame-t); left: var(--frame-l); right: var(--frame-r); height: var(--topbar-h);
  display: flex; align-items: center; justify-content: flex-end; gap: 0.375rem; pointer-events: none; }
.topbar > *, .topbar-menu > * { pointer-events: auto; flex: 0 0 auto; white-space: nowrap; }
.topbar .btn.small { min-width: 2.75rem; min-height: 2.75rem; }
.topbar img { width: 1.25rem; height: 1.25rem; }
#tickets-pill { margin-right: auto; }
#topbar-more .dots { display: block; width: 0.25rem; height: 0.25rem; margin: 0 0.5rem; background: currentColor;
  box-shadow: -0.5rem 0 0 currentColor, 0.5rem 0 0 currentColor; }
.topbar-menu { position: absolute; z-index: 2; top: calc(100% + 0.5rem); right: 0; display: none; flex-direction: column; align-items: stretch; gap: 0.375rem;
  min-width: 13rem; max-height: calc(100vh - var(--frame-t) - var(--topbar-h) - var(--frame-b) - 1rem); overflow: auto; padding: 0.5rem;
  border: calc(4 * var(--ap)) solid transparent; border-image: var(--frame-img) 4 fill / calc(4 * var(--ap)) stretch; filter: drop-shadow(var(--hard)); }
.topbar.more-open .topbar-menu { display: flex; }
.topbar-menu .btn { justify-content: flex-start; }
#user-pill { cursor: pointer; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
#user-pill > span { overflow: hidden; text-overflow: ellipsis; }
.save-btn { font-weight: 700; }
.news-btn { position: relative; }
.news-btn .dot { display: none; position: absolute; top: 0.1875rem; right: 0.1875rem; width: 0.5rem; height: 0.5rem; background: var(--red); box-shadow: 0 0 0 var(--ap) var(--line); }
.news-btn.new .dot { display: block; }
.yt-btn.live { color: #fff; background: #e0202a; box-shadow: inset 0 0 0 var(--ap) #ff8a8a; }
.yt-btn .rec { display: none; width: 0.5rem; height: 0.5rem; margin-right: var(--ap); border-radius: 50%; background: #fff; animation: yt-rec 1.2s steps(2) infinite; }
.yt-btn.live .rec { display: inline-block; }
@keyframes yt-rec { 50% { opacity: .25; } }
.sync { display: inline-block; width: 0.5rem; height: 0.5rem; margin-left: 0.5rem; box-shadow: 0 0 0 var(--ap) var(--line); }
.sync.ok { background: var(--green); }
.sync.syncing, .sync.pending { background: var(--gold); }
.sync.offline { background: var(--red); }
.sync.local { background: var(--r1); }
.sync.guest { display: none; }
@media (min-width: 1100px) and (min-height: 600px) {
  #topbar-more { display: none; }
  #tickets-pill { margin-right: 0; }
  .topbar-menu, .topbar.more-open .topbar-menu { display: contents; }
  #user-pill { order: 1; max-width: 13.75rem; }
  #btn-save { order: 2; } #btn-news { order: 3; } #btn-yt { order: 4; } #btn-support { order: 5; }
  #btn-sound { order: 6; } #btn-full { order: 7; } #btn-settings { order: 8; } #btn-logout { order: 9; }
}
@media (min-width: 1100px) and (max-width: 1599px) and (min-height: 600px) {
  #btn-news span, #btn-support span, #btn-save span, #btn-yt:not(.live) span { display: none; }
}

/* ---------- panels and pop-ups that float over everything ---------- */
.sound-panel { position: fixed; z-index: 30; top: calc(var(--frame-t) + var(--topbar-h) + 0.5rem); right: var(--frame-r);
  width: min(17rem, calc(100% - var(--frame-l) - var(--frame-r))); padding: 0.875rem 1rem; }
.sound-inline { margin: 0.375rem auto 1rem; max-width: 20rem; }
.snd-row { display: grid; grid-template-columns: 1.25rem 4rem 1fr; gap: 0.5rem; align-items: center; margin-bottom: 0.625rem; font-size: 0.875rem; }
#btn-sound { padding: 0.3125rem 0.5625rem; }
input[type=range] { -webkit-appearance: none; appearance: none; width: 100%; height: 0.5rem; background: var(--line); outline: none; }
input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 1rem; height: 1rem; background: var(--gold); border: var(--ap) solid var(--gold-ink); cursor: pointer; }
input[type=range]::-moz-range-thumb { width: 0.875rem; height: 0.875rem; background: var(--gold); border: var(--ap) solid var(--gold-ink); }
.credits-line { position: fixed; z-index: 25; left: var(--frame-l); bottom: var(--frame-b); font-size: 0.75rem; color: var(--muted); text-shadow: var(--ap) var(--ap) 0 #000; }
.credits-line a { color: inherit; }
.invite-pop { position: fixed; z-index: 70; right: var(--frame-r); bottom: calc(var(--frame-b) + 2.5rem);
  width: min(21.25rem, calc(100% - var(--frame-l) - var(--frame-r))); padding: 0.875rem 1rem; }
.invite-pop img { vertical-align: middle; }
.ach-pop { position: fixed; z-index: 80; left: 50%; top: calc(var(--frame-t) + var(--topbar-h) + 0.5rem); transform: translateX(-50%); pointer-events: none;
  display: flex; gap: 0.625rem; align-items: center; padding: 0.625rem 1rem; border-image-source: var(--frame-gold); }
.ach-pop b { display: block; color: var(--gold); }
.ach-pop small { color: var(--muted); }
body.in-run .ach-pop { top: calc(var(--frame-t) + 3.5rem); }

/* ---------- boot and "tap to start" ---------- */
.boot { position: fixed; inset: 0; z-index: 70; display: flex; align-items: center; justify-content: center; background: var(--night); color: var(--muted); font-size: 1.125rem; }
.boot.noscript { z-index: 90; }
.boot-in { max-width: 40rem; text-align: center; padding: var(--frame-t) var(--frame-r) var(--frame-b) var(--frame-l); }
.boot-in h1 { margin: 0 0 0.5rem; font-size: 3rem; font-weight: 700; color: var(--gold);
  text-shadow: calc(2 * var(--ap)) calc(2 * var(--ap)) 0 #a55f00, calc(4 * var(--ap)) calc(4 * var(--ap)) 0 var(--line); }
.boot-in p { margin: 0.375rem 0; color: var(--muted); }
.boot-in a { color: #9fd4ff; }
.boot-ld { color: var(--ink); margin-top: 1.125rem !important; }
.tapstart { position: fixed; inset: 0; z-index: 80; display: flex; align-items: center; justify-content: center; cursor: pointer;
  background-color: rgba(5, 9, 20, .45); background-image: var(--dither); background-size: calc(2 * var(--ap)) calc(2 * var(--ap)); animation: fade .4s steps(4); }
.tapstart .boot-in p { color: #dfe7ff; text-shadow: var(--ap) var(--ap) 0 #000; }
.tap-blink { color: var(--ink) !important; font-size: 1.25rem; margin-top: 1.375rem !important; animation: blink 1.1s steps(2) infinite; }
@keyframes blink { 50% { opacity: .25; } }

@media (max-width: 499px), (max-height: 499px) {
  .credits-line { display: none !important; }
  .boot-in h1 { font-size: 2.25rem; }
}
@media (max-height: 499px) and (orientation: landscape) {
  .ach-pop { top: auto; bottom: var(--frame-b); }
  body.in-run .ach-pop { top: var(--frame-t); bottom: auto; }
}
```

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Smoke check**

Run `python -m http.server 8080`, open `http://localhost:8080/` with DevTools device toolbar at 393×852 and 852×393. Expected: coins/tickets left, sound/settings/⋯ right; ⋯ opens a framed menu with profile, news, YouTube, logout; clicking an item or outside closes it; at 1280×720 all buttons sit inline with no ⋯.

- [ ] **Step 8: Commit**

```powershell
git add js/topbar.js index.html en/index.html css/style.css tests/ui-style.test.cjs tests/ui-modules.test.cjs
git commit -m "Safe-area screen frame and top bar overflow" -m "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

### Task 4: Main menu, login, starters and inline styles

**Files:**
- Modify: `index.html`, `en/index.html`, `css/style.css`
- Test: `tests/ui-style.test.cjs`, existing `tests/menu.test.cjs`

**Interfaces:**
- Consumes: Task 2 components, Task 3 frame vars and the `html` helper in `tests/ui-style.test.cjs`.
- Engine contract (verified): menu items are bound with `document.querySelectorAll('#scr-menu [data-go]')` and Play's subtitle is set through `#scr-menu [data-go=play] small`, so Play may move anywhere inside `#scr-menu`.

- [ ] **Step 1: Write failing tests** (append to `tests/ui-style.test.cjs`; also add the carousel tokens to `RETIRED`)

```js
Object.assign(RETIRED, Object.fromEntries(['.menu-banner', '.mb-slide', '.mb-img', '.mb-play', '.mb-txt', '.mb-tag', '.mb-nav',
  '.mb-dots', '.mb-arr', '.next', '.yt'].map(token => [token,
  'Menu carousel is permanently suppressed (tests/menu.test.cjs); only the #menu-banner hidden rule remains'])));

test('main menu: Play sits under the partner, outside the list, in both pages', () => {
  for (const source of Object.values(html)) {
    const menu = source.slice(source.indexOf('<section id="scr-menu"'), source.indexOf('<div id="topbar"'));
    const play = menu.indexOf('data-go="play"');
    assert.ok(play > menu.indexOf('class="partner-card"') && play < menu.indexOf('class="menu-list"'));
    assert.match(menu, /<button class="menu-item play" data-go="play">Jugar<small>Entra en la mazmorra<\/small><\/button>/);
    assert.match(menu, /<div class="box menu-stats-box"><div id="menu-stats"><\/div><\/div>/);
  }
});

test('inline styles in the game pages use rem, never px', () => {
  for (const source of Object.values(html)) {
    const px = [...source.matchAll(/style="([^"]*)"/g)].filter(match => /\d+px/.test(match[1])).map(match => match[0]);
    assert.deepEqual(px, []);
  }
});

test('menu layouts: safe frame, two-column list on compact landscape, tiles in portrait', () => {
  assert.match(find(css, '#scr-menu').body,
    /padding: calc\(var\(--frame-t\) \+ var\(--topbar-h\) \+ var\(--gut\)\) var\(--frame-r\) var\(--frame-b\) var\(--frame-l\)/);
  assert.match(find(css, '.menu-list', MEDIA.COMPACT_LAND).body, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(find(css, '.menu-list', MEDIA.PORTRAIT).body, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(find(css, '.menu-list .menu-item', MEDIA.PORTRAIT).body, /border-bottom-width: calc\(3 \* var\(--ap\)\)/);
  assert.match(find(css, '.menu-left > .menu-item.play').body, /background: var\(--gold\)/);
  assert.match(find(css, '#starter-grid .starter-card', MEDIA.PORTRAIT).body, /flex-basis: calc\(\(100% - 0\.75rem\) \/ 2\)/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/ui-style.test.cjs`
Expected: the three new tests FAIL.

- [ ] **Step 3: Markup changes in both `index.html` and `en/index.html`**

1. Delete `<button class="menu-item play" data-go="play">Jugar<small>Entra en la mazmorra</small></button>` from `.menu-list` and insert the identical line right after the closing `</div>` of `.partner-card` (still inside `.menu-left`).
2. Replace `<div class="box" style="padding:14px 18px">` / `<div id="menu-stats" style="font-size:14px;color:var(--muted)"></div>` / `</div>` with the single line `<div class="box menu-stats-box"><div id="menu-stats"></div></div>`.
3. Save this as `$env:TEMP\px-to-rem.cjs` and run `node $env:TEMP\px-to-rem.cjs`, then `git --no-pager diff --stat`:

```js
const fs = require('node:fs');
for (const file of ['index.html', 'en/index.html']) {
  const source = fs.readFileSync(file, 'utf8').replace(/style="([^"]*)"/g, (all, body) =>
    'style="' + body.replace(/(\d*\.?\d+)px/g, (_, n) => (Number(n) / 16) + 'rem') + '"');
  fs.writeFileSync(file, source);
}
```

Expected: only `style="…"` attributes change (e.g. `width:min(420px,100%)` → `width:min(26.25rem,100%)`). Delete the temp script.

- [ ] **Step 4: Menu, logo and login CSS**

Delete legacy `#scr-menu`, `.menu-left*`, `.menu-right*`, `.logo*`, `.splash`, `@keyframes splash-pulse`, `.partner-card*`, `.menu-item.play`, `.hw-count*`, every `.menu-banner`/`.mb-*` rule (keep only the `#scr-menu > #menu-banner` rule below), `.login-*`, the `max-width: 760px` menu block (≈589–595) and the menu parts of the `max-height: 520px/400px` blocks. Add:

```css
/* ---------- main menu ---------- */
#scr-menu { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 25rem); align-items: center; gap: 1rem 2rem; overflow-y: auto;
  padding: calc(var(--frame-t) + var(--topbar-h) + var(--gut)) var(--frame-r) var(--frame-b) var(--frame-l); }
/* Keep the engine's compatibility container hidden after announcement updates. */
#scr-menu > #menu-banner { display: none !important; }
.menu-left { display: grid; justify-items: center; align-content: center; gap: 0.75rem; min-width: 0; }
.menu-right { display: grid; align-content: center; gap: 0.75rem; min-width: 0; }
.logo { text-align: center; margin-bottom: 0.25rem; }
.logo .t1 { position: relative; display: inline-block; font-size: 2.875rem; font-weight: 700; line-height: 1; color: var(--gold);
  text-shadow: calc(2 * var(--ap)) calc(2 * var(--ap)) 0 #a55f00, calc(4 * var(--ap)) calc(4 * var(--ap)) 0 var(--line); }
.logo .t2 { margin-top: 0.375rem; font-size: 1.125rem; letter-spacing: 0.1875rem; text-transform: uppercase; }
.menu-left .logo .t1 { font-size: 3rem; }
.splash { position: absolute; right: 0; top: 82%; z-index: 3; width: max-content; max-width: 14em; pointer-events: none;
  font-size: 0.9375rem; font-weight: 700; line-height: 1.15; color: #ffff40; text-shadow: var(--ap) var(--ap) 0 #3f3f00;
  transform: translateX(62%) rotate(-14deg); animation: splash-pulse .9s steps(3) infinite alternate; }
@keyframes splash-pulse { from { transform: translateX(62%) rotate(-14deg) scale(.94); } to { transform: translateX(62%) rotate(-14deg) scale(1.06); } }
.hw-count { display: inline-flex; align-items: center; gap: 0.5rem; margin-top: 0.75rem; padding: 0.3125rem 0.875rem 0.3125rem 0.625rem;
  font-size: 0.9375rem; font-variant-numeric: tabular-nums; color: #ffd9a8; background: #26133f; border: var(--ap) solid #ff8a2a; }
.hw-count.hidden { display: none; }
.partner-card { display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-areas: "stage nm" "stage lv" "stage xp" "stage seg";
  column-gap: 0.75rem; align-items: center; justify-items: start; width: min(100%, 28.75rem); padding: 0.5rem 0.75rem;
  border: calc(4 * var(--ap)) solid transparent; border-image: var(--frame-img) 4 fill / calc(4 * var(--ap)) stretch;
  filter: drop-shadow(var(--hard)); text-shadow: var(--ap) var(--ap) 0 var(--line); }
#menu-partner { grid-area: stage; margin: 0; width: auto; height: 7.5rem; }
.partner-card .nm { grid-area: nm; font-size: 1.5rem; font-weight: 700; }
.partner-card .lv { grid-area: lv; font-size: 0.875rem; color: var(--muted); }
#menu-training-progress { grid-area: xp; width: 100%; margin: 0; }
#menu-shiny { grid-area: seg; margin: 0; }
.menu-left > .menu-item.play { display: flex; justify-content: center; gap: 0.5rem; width: min(100%, 28.75rem); min-height: 3.25rem; padding: 0.5rem 1rem;
  font-size: 1.5rem; color: var(--gold-ink); text-shadow: none; background: var(--gold);
  border: var(--ap) solid var(--line); border-bottom-width: calc(3 * var(--ap));
  box-shadow: inset var(--ap) var(--ap) 0 var(--gold-hi), inset calc(-1 * var(--ap)) calc(-1 * var(--ap)) 0 var(--gold-lo); }
.menu-left > .menu-item.play:hover, .menu-left > .menu-item.play:focus-visible { background: #ffdd60;
  box-shadow: inset var(--ap) var(--ap) 0 var(--gold-hi), inset calc(-1 * var(--ap)) calc(-1 * var(--ap)) 0 var(--gold-lo); }
.menu-left > .menu-item.play:active { transform: translateY(calc(2 * var(--ap))); border-bottom-width: var(--ap); }
.menu-item.play::before { display: none; }
.menu-item.play .mi-ico { grid-row: auto; }
.menu-item.play small { align-self: center; font-size: 0.75rem; color: var(--gold-ink); opacity: .8; }
#menu-stats { font-size: 0.875rem; color: var(--muted); }
.menu-stats-box { padding: 0.5rem 0.75rem; }
@media (prefers-reduced-motion: reduce) { .splash { animation: none; } }

@media (max-height: 499px) and (orientation: landscape) {
  #scr-menu { grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 0.5rem 0.75rem; padding-top: calc(var(--frame-t) + var(--topbar-h) + 0.25rem); }
  .menu-left { gap: 0.5rem; }
  .menu-left .logo .t1 { font-size: 2rem; }
  .logo .t2 { font-size: 0.75rem; margin-top: 0.25rem; letter-spacing: 0.125rem; }
  .splash { display: none; }
  #menu-partner { height: 6.25rem; }
  .partner-card .nm { font-size: 1.25rem; }
  .menu-list { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--ap); }
  .menu-item { font-size: 1rem; padding: 0.125rem 0.375rem 0.125rem 1rem; grid-template-columns: 1.25rem minmax(0, 1fr); }
  .mi-ico img { width: 1.25rem; height: 1.25rem; }
  .menu-left > .menu-item.play { min-height: 2.75rem; font-size: 1.25rem; }
}
@media (orientation: portrait) {
  #scr-menu { grid-template-columns: minmax(0, 1fr); align-content: start; }
  .menu-left .logo .t1 { font-size: 2rem; }
  .splash { display: none; }
  .menu-list { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.375rem; }
  .menu-list .menu-item { min-height: 3.5rem; padding: 0.375rem 0.5rem; font-size: 1rem; grid-template-columns: 1.5rem minmax(0, 1fr);
    background: var(--navy-4); border: var(--ap) solid var(--line); border-bottom-width: calc(3 * var(--ap));
    box-shadow: inset var(--ap) var(--ap) 0 var(--hi), inset calc(-1 * var(--ap)) calc(-1 * var(--ap)) 0 var(--navy-1); }
  .menu-list .menu-item::before { display: none; }
  .menu-list .menu-item:hover, .menu-list .menu-item:focus-visible { background: var(--navy-5);
    box-shadow: inset var(--ap) var(--ap) 0 var(--hi), inset calc(-1 * var(--ap)) calc(-1 * var(--ap)) 0 var(--navy-1); }
  .menu-list .menu-item:active { transform: translateY(calc(2 * var(--ap))); border-bottom-width: var(--ap); }
}
@media (max-width: 499px), (max-height: 499px) {
  .menu-stats-box { display: none; }
}
@media (min-width: 1100px) and (min-height: 600px) {
  .menu-left .logo .t1 { font-size: 4rem; }
  #menu-partner { height: 10rem; }
}

/* ---------- login ---------- */
.login-tag { margin: -0.375rem 0 0.75rem; font-size: 0.8125rem; color: var(--muted); text-align: center; }
.login-official { margin: -0.375rem 0 0.75rem; font-size: 0.75rem; color: var(--muted); text-align: center; }
.login-links { margin-top: 0.625rem; font-size: 0.8125rem; text-align: center; }
.login-links a, #scr-login a { color: #9fd4ff; }
```

- [ ] **Step 5: Starters and legacy quiz/result CSS**

Delete legacy `#scr-starters*`, `#starter-*`, `.starter-*`, `.test-box`, `.progress`, `.q`, `.answers`, `.answer*`, `.result*` rules and their media blocks. Add:

```css
/* ---------- starter selection ---------- */
#scr-starters .starter-box { width: min(61.25rem, 100%); }
#starter-gens { flex-wrap: wrap; overflow: visible; margin-bottom: 0.75rem; }
#starter-gens .gen-tab { flex: 1 0 5.25rem; padding: 0.5rem 0.625rem; }
#starter-panel { padding: 1rem; background: var(--navy-0); border: var(--ap) solid var(--line); box-shadow: inset 0 0 0 var(--ap) var(--edge-in); }
#starter-region { font-size: 1.5rem; }
#starter-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.75rem; max-height: none; overflow: visible; }
#starter-grid .starter-card { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 0 1 calc((100% - 2.25rem) / 4);
  min-width: 0; padding: 0.875rem 0.375rem; color: var(--ink); font: inherit; text-shadow: inherit; }
#starter-grid .starter-card b { max-width: 100%; font-size: 1.125rem; margin: 0.25rem 0 0.625rem; }
#starter-grid .starter-card canvas { max-width: 100%; height: auto; }
.starter-types { display: flex; justify-content: center; flex-wrap: wrap; gap: 0.25rem; }
#starter-info { color: var(--gold); font-weight: 700; }
.starter-footer { margin-top: 0.75rem; }
#scr-starters button:focus-visible { outline: calc(2 * var(--ap)) solid var(--edge); outline-offset: calc(2 * var(--ap)); }
#starter-help { margin: 0.75rem 0 0; }
@media (max-height: 499px) and (orientation: landscape) {
  #scr-starters .starter-box { padding: 0.5rem 0.875rem; }
  #scr-starters .sub { margin-bottom: 0.25rem; }
  #starter-subtitle { display: none; }
  #starter-gens { margin-bottom: 0.25rem; padding-bottom: 0.25rem; }
  #starter-gens .gen-tab { flex-basis: 4.375rem; padding: 0.25rem 0.5rem; }
  #starter-panel { padding: 0.375rem 0.625rem; }
  #starter-region { font-size: 1.125rem; margin-bottom: 0; }
  #starter-grid .starter-card { padding: 0.25rem; }
  #starter-grid .starter-card canvas { width: 5.25rem; height: 4.125rem; }
  #starter-grid .starter-card b { font-size: 0.875rem; margin: var(--ap) 0 0.25rem; }
  #starter-help { font-size: 0.6875rem; margin-top: 0.25rem; }
  .starter-footer { margin-top: 0.375rem; }
}
@media (orientation: portrait) {
  #starter-grid .starter-card { flex-basis: calc((100% - 0.75rem) / 2); }
}

/* ---------- legacy personality quiz (empty compatibility screens) ---------- */
.test-box { width: min(38.75rem, 100%); }
.progress { height: 0.5rem; margin-bottom: 1.125rem; background: var(--line); }
.progress i { display: block; height: 100%; background: var(--gold); }
.q { font-size: 1.375rem; margin: 0 0 1rem; min-height: 2.6em; }
.answers { display: flex; flex-direction: column; gap: 0.5rem; }
.answer { appearance: none; position: relative; cursor: pointer; text-align: left; padding: 0.75rem 1rem 0.75rem 2.125rem; font-size: 1.0625rem;
  background: var(--navy-2); border: var(--ap) solid var(--line); box-shadow: inset 0 0 0 var(--ap) var(--edge-in); text-shadow: var(--ap) var(--ap) 0 var(--line); }
.answer:hover { background: var(--navy-3); box-shadow: inset 0 0 0 var(--ap) var(--gold); }
.result { width: min(35rem, 100%); text-align: center; }
.result .trait { font-size: 1.875rem; color: var(--gold); margin: 0.25rem 0; }
```

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: PASS (including the carousel tests in `tests/menu.test.cjs`).

- [ ] **Step 7: Smoke check**

`python -m http.server 8080`; guest login; check 852×393, 393×852 and 1280×720. Expected: Play is a gold button under the partner; the list is 2 columns on phone landscape and beveled tiles in portrait; tapping Play still starts the expedition flow.

- [ ] **Step 8: Commit**

```powershell
git add index.html en/index.html css/style.css tests/ui-style.test.cjs
git commit -m "Responsive main menu, login and starter selection" -m "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

### Task 5: Collection and commerce screens (Pokémon, Gacha, Shop, Bag, Upgrades, Training)

**Files:**
- Modify: `css/style.css`
- Test: `tests/ui-style.test.cjs`

**Interfaces:**
- Consumes: Task 2 components, Task 3 frame (these screens already get `padding-top` for the top bar).

- [ ] **Step 1: Write failing tests** (append to `tests/ui-style.test.cjs`)

```js
test('collection screens: list/detail split stacks in portrait with a sticky primary action', () => {
  assert.match(find(css, '#scr-dex .split', MEDIA.PORTRAIT).body, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(find(css, '#scr-gacha .split', MEDIA.PORTRAIT).body, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(find(css, '#dex-detail > .btn').body, /position: sticky/);
  assert.match(find(css, '#scr-dex .box').body, /height: 100%/);
  assert.match(find(css, '.training-slots', MEDIA.PORTRAIT).body, /repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(find(css, '.upg').body, /minmax\(min\(17\.5rem, 100%\), 1fr\)/);
});

test('gacha cards glow with hard pixel rings, not blurred shadows', () => {
  assert.match(find(css, '.pcard').body, /box-shadow: 0 0 0 var\(--ap\) var\(--rc, #fff\)/);
  assert.doesNotMatch(find(css, '.pcard').body, /border-radius|blur/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/ui-style.test.cjs`
Expected: both new tests FAIL.

- [ ] **Step 3: Layout-critical CSS** (add after the starters section)

```css
/* ---------- Pokémon and Gacha: list + detail ---------- */
#scr-dex .box, #scr-gacha .box { display: flex; flex-direction: column; height: 100%; }
#scr-dex .split, #scr-gacha .split { flex: 1; min-height: 0; margin-top: 0.5rem; }
#scr-dex .split { grid-template-columns: minmax(0, 1fr) minmax(12rem, 36%); }
#scr-dex .split > div:first-child { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
#scr-dex .grid { flex: 1; min-height: 0; max-height: none; }
#dex-detail { display: flex; flex-direction: column; min-height: 0; overflow-y: auto; }
#dex-detail > .btn { position: sticky; bottom: 0; order: 9; margin-top: auto; }
#scr-gacha .split > div:first-child { min-height: 0; overflow-y: auto; }
#pull-10, #pull-10b, #pull-100, #pull-100b { flex: 1 1 45%; }
.dex-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.dex-tools input, .dex-tools select { min-height: 2.25rem; padding: 0.25rem 0.625rem; font-size: 0.875rem; color: inherit;
  background: var(--line); border: var(--ap) solid var(--edge-in); }
.dex-tools input { flex: 1 1 11.25rem; min-width: 0; }
.dex-tools select option { background: var(--navy-1); }
.dex-sort { align-items: center; margin-top: -0.25rem; }
.dex-sort .sub { margin: 0 var(--ap) 0 0; font-size: 0.8125rem; }
.dex-more { grid-column: 1 / -1; height: 0.0625rem; }
.fit-low { display: block; margin-top: var(--ap); font-size: 0.75rem; color: #ffb37a; }
@media (orientation: portrait) {
  #scr-dex .split, #scr-gacha .split { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; }
  #dex-detail { max-height: 45dvh; }
  #gacha-rates { max-height: 30dvh; overflow-y: auto; }
}
@media (max-width: 499px), (max-height: 499px) {
  #scr-dex .box, #scr-gacha .box { padding: 0.5rem 0.625rem; }
  #scr-dex .gen-tabs, #scr-dex .filters, #gacha-gens { flex: 0 0 auto; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; margin-bottom: 0.25rem; }
  #scr-dex .chip { flex: 0 0 auto; }
  #scr-dex .grid { grid-template-columns: repeat(auto-fill, minmax(4.875rem, 1fr)); gap: 0.3125rem; }
  #scr-dex .cell canvas { width: 4.3125rem; height: 3.75rem; }
  #scr-dex .cell b { font-size: 0.6875rem; }
  #dex-detail { padding: 0.375rem 0.5rem; }
  #dex-detail .stage { width: 8.25rem; height: 7.125rem; margin: var(--ap) auto 0.25rem; }
  #dex-detail .stat { grid-template-columns: 3.875rem minmax(0, 1fr) 2.125rem; gap: 0.25rem; margin: var(--ap) 0; font-size: 0.75rem; }
  #dex-detail p { margin: 0.25rem 0 !important; font-size: 0.75rem !important; }
  .banner .feat { height: 7.5rem; }
}

/* ---------- gacha pull results ---------- */
.pcard { width: 9.375rem; padding: 0.625rem 0.375rem; text-align: center; background: var(--navy-1);
  border: calc(2 * var(--ap)) solid var(--rc, #fff); box-shadow: 0 0 0 var(--ap) var(--rc, #fff), var(--hard);
  text-shadow: var(--ap) var(--ap) 0 var(--line); animation: pop .3s steps(3) both; }
.pcard.r5, .pcard.shiny { animation: pop .3s steps(3) both, legend 1.2s steps(2) infinite; }
@keyframes legend { 50% { box-shadow: 0 0 0 calc(2 * var(--ap)) var(--rc, #fff), var(--hard); } }

/* ---------- upgrades and training ---------- */
.upg { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(17.5rem, 100%), 1fr)); gap: 0.625rem; }
.training-slots { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.625rem; margin: 0.875rem 0; }
.training-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; margin: 0.875rem 0; }
.training-tabs { position: sticky; top: 0; z-index: 1; display: flex; gap: 0.5rem; padding: 0.625rem 0; background: var(--navy-2); }
@media (orientation: portrait) {
  .training-slots, .training-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .training-item-row { grid-template-columns: minmax(0, 1fr) auto; }
  .training-item-row label { grid-column: 1 / -1; margin: 0; }
  .training-perk { grid-template-columns: 1.75rem minmax(0, 1fr); }
  .training-perk > .btn { grid-column: 2; justify-self: start; }
}
@media (max-height: 499px) and (orientation: landscape) {
  .training-head .stage { display: none; }
  .training-box { padding: 0.625rem 0.875rem; }
  .training-moves { max-height: 11.25rem; }
}
@media (max-width: 499px), (max-height: 499px) {
  .shop-stall { height: 12.5rem; }
  .shop-sign { font-size: 0.875rem; }
  .shop-bubble { font-size: 0.6875rem; }
}
```

- [ ] **Step 4: Port the remaining rules with the Conversion Recipe**

Port (convert, then delete the legacy copy) every rule for these selectors, from the legacy lines in the Section Map: `.mon-extra*`, `#dex-moves*`, `.caught*`, `.upg-item*`, `.pips*`, `.upg-head*`, `.upg-btns`, `.ban-picker`, `.bind-panel`, `.bind-slots`, `.bind-slot*`, `.ban-moves*`, `.banner*`, `.rates*`, `#pull-fx*`, `#pull-close`, `#pull-skip`, `.pull-results*`, `.pull-sum`, `.iris-get*`, `.ball*` + its keyframes (`drop`, `shake`, `burst`), `.pcard *` children (`.stars`, `b`, `.tag`, `.new`, `.pmon`), `#slot`, `.tickets-line img`, `#tickets-pill img`, `#cost-*` imgs, `.gen-tab.spooky*`, `#scr-shop .shop-box`, `.shop-*` (stall, scene, sign, bubble, fly) + keyframes (`shopSign`, `shopBulbs`, `shopBubble`, `shopBump`, `shopFade`), `#shop-body .ic.bump`, all `.training-*`, `#training-play`, `#scr-training .training-box`. Specific conversions:
- `.shop-stall { margin: -0.75rem -1rem 0.875rem; height: 18.375rem; }` (matches the new `.box` padding); drop its `border-radius`.
- `.shop-sign`, `.shop-bubble`: square corners, `border: calc(2 * var(--ap)) solid …`; keep the bulb `radial-gradient` dots (art allowlist).
- `#slot`: drop its glow `filter`; keep its size, `image-rendering: pixelated` and the `pop` animation (now `steps(3)`).
- `.banner` keeps its gradients (art allowlist) but gets `border: var(--ap) solid var(--line); box-shadow: inset 0 0 0 var(--ap) var(--edge-in);` and no radius.
- `.ball`, `.ball::after` keep their hard-stop gradient and `50%` radius (art).
- `.pull-results.many .pcard` and the compact `.pcard` sizes move into the COMPACT block (widths `6.25rem`, canvases `5.25rem`).

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS (inventory included).

- [ ] **Step 6: Smoke check** at 393×852 and 852×393: Pokémon list scrolls and "Elegir de compañero" stays visible; Gacha pull ×10 shows cards with square rarity rings; shop stall fits; Training tabs stay pinned while moves scroll.

- [ ] **Step 7: Commit**

```powershell
git add css/style.css tests/ui-style.test.cjs
git commit -m "Pixel UI for collection, gacha, shop and training screens" -m "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

### Task 6: Social and info screens (Settings, layout editor, News, Support, Legal, Friends, Lobby, Ranking, Missions, Profile)

**Files:**
- Modify: `css/style.css`
- Test: `tests/ui-style.test.cjs`

- [ ] **Step 1: Write failing tests**

```js
test('social and info screens adapt to portrait and fit the frame', () => {
  assert.match(find(css, '.lobby-members', MEDIA.PORTRAIT).body, /repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(find(css, '.rk-split', MEDIA.PORTRAIT).body, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(find(css, '.mission', MEDIA.PORTRAIT).body, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(find(css, '.box.settings').body, /max-height: 100%/);
  assert.match(find(css, '.box.news-box').body, /max-height: 100%/);
  assert.match(find(css, '#set-tabs', MEDIA.COMPACT).body, /overflow-x: auto/);
  assert.match(find(css, '.lay-turn').body, /display: none/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/ui-style.test.cjs`
Expected: FAIL.

- [ ] **Step 3: Layout-critical CSS**

```css
/* ---------- settings, news, legal and other dialogs ---------- */
#scr-settings, #scr-support { z-index: 60; }
#scr-legal { z-index: 65; }
.box.settings { display: flex; flex-direction: column; width: min(40rem, 100%); max-height: 100%; }
.set-body { min-height: 0; overflow-y: auto; padding-right: 0.25rem; }
#set-tabs { flex-wrap: wrap; }
#set-tabs .gen-tab { padding: 0.375rem 0.75rem; }
.box.news-box { display: flex; flex-direction: column; width: min(40rem, 100%); max-height: 100%; }
.news-body { min-height: 0; overflow-y: auto; padding-right: 0.25rem; }
.profile-box { width: min(40rem, 100%); max-height: 100%; overflow-y: auto; }
.lay-turn { display: none; }   /* portrait is supported: never ask to rotate */
@media (max-width: 499px), (max-height: 499px) {
  #set-tabs { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
  #set-tabs::-webkit-scrollbar { display: none; }
  #set-tabs .gen-tab { flex: 0 0 auto; }
  .rk-row, .rk-split .rk-row { grid-template-columns: 2.5rem auto minmax(0, 1fr) auto 1.375rem; gap: 0.375rem; }
  .lob-card { min-height: 8rem; }
}

/* ---------- friends, lobby, ranking, missions ---------- */
.lobby-members { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.625rem; margin-top: 0.625rem; }
#scr-rank .box.wide { width: min(77.5rem, 100%); }
.rk-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0.875rem; }
.mission { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 0.875rem; align-items: center; margin-bottom: 0.375rem;
  padding: 0.625rem 0.75rem; background: var(--navy-0); border: var(--ap) solid var(--line); box-shadow: inset 0 0 0 var(--ap) var(--navy-3); }
.mission.ready { background: var(--navy-2); box-shadow: inset 0 0 0 var(--ap) var(--gold); }
.mission.claimed { opacity: .55; }
@media (orientation: portrait) {
  .lobby-members { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .rk-split { grid-template-columns: minmax(0, 1fr); }
  .rk-split .rk-list { max-height: 38dvh; }
  .mission { grid-template-columns: minmax(0, 1fr); }
  .prof-marks { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
```

- [ ] **Step 4: Port the remaining rules with the Conversion Recipe**

Port and delete the legacy copies of: `.set-h*`, `.set-row*`, `.set-chips`, `.keys*`, `.padkey`, `.credits*` (the About list, not `.credits-line`), `.about-logo`, `#scr-layout`, `.lay-thing*`, `.lay-bar`, `.lay-slot*`, `.lay-tag`, `.lay-pause*`, `.lay-stick*`, `.lay-panel*`, `#lay-mode`, `.lay-help`, `.lay-btns`, `.legal*`, `.legal-link*`, `.box.support`, `.support-ask*`, `.sup-tab*`, `#savenote-body p`, `.box.video-box`, `.video-thumb*`, `.news-day*`, `.news-part`, `.news-tag*`, `.fr-list`, `.fr-row*`, `.dot*`, `#fr-add*`, `.lob-card*`, `.rk-tools*`, `.rk-list`, `.rk-row*`, `.rk-rep*`, `.mod-warn`, `.mod-acts`, `.rk-col`, `.rk-h`, `.rk-me`, `.goals-body` (→ `max-height: 62dvh`), `.goals-h*`, `.mission *` children, `.m-rw`, `.a-rw`, `.ach-grid` (→ `minmax(min(17.5rem, 100%), 1fr)`), `.ach*`, `.leg-grid`, `.leg-cell*`, `.fav-slots*`, `.fav-slot*`, `.prof-head*`, `.prof-title`, `.prof-marks*`, `.prof-medals*`, `a.plink*`. Specific conversions: `.lay-slot`/`.lay-pause` keep their in-game look (they mirror the canvas HUD) but use `var(--ap)` borders; `.lay-stick` and `.dot` keep `50%`/square shapes; `.fav-slot` dashed border becomes `border: var(--ap) dashed var(--edge-in)`.

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Smoke check** at 393×852: Settings tabs scroll sideways, body scrolls, Close stays visible; Ranking columns stack; Lobby shows a 2×2 grid; Missions rows stack.

- [ ] **Step 7: Commit**

```powershell
git add css/style.css tests/ui-style.test.cjs
git commit -m "Pixel UI for settings, social, ranking and mission screens" -m "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

### Task 7: Run screens (Pause, Level-up, Bond, Item, Results, XP progress, Evolution)

**Files:**
- Modify: `css/style.css`
- Test: `tests/ui-style.test.cjs`

- [ ] **Step 1: Write failing tests**

```js
test('run dialogs fit the frame: scrollable bodies, fixed headers and action rows', () => {
  assert.match(find(css, '.pause-box').body, /max-height: 100%/);
  assert.match(find(css, '.results-box').body, /max-height: 100%/);
  assert.match(find(css, '.results-actions').body, /flex-shrink: 0/);
  assert.match(find(css, '#bond-cards', MEDIA.COMPACT_LAND).body, /grid-template-columns: 1fr 1fr/);
  assert.ok(find(css, '.evolution-stage', MEDIA.COMPACT_LAND), 'evolution stage shrinks on phone landscape');
  assert.doesNotMatch(find(css, '.card.evo').body, /gradient/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/ui-style.test.cjs`
Expected: FAIL.

- [ ] **Step 3: Layout-critical CSS**

```css
/* ---------- pause ---------- */
.pause-box { width: min(45rem, 100%); max-height: 100%; overflow-y: auto; }
#scr-pause .row { flex-wrap: wrap; justify-content: center; }
.sum-stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(12.5rem, 100%), 1fr)); gap: 0.25rem 0.875rem; font-size: 0.875rem; }

/* ---------- level-up, bond, item ---------- */
#scr-levelup .box, #scr-item .box { width: min(37.5rem, 100%); }
.card.evo { background: #3a3a2a; box-shadow: inset 0 0 0 var(--ap) var(--gold); }
.card.evo .nm { color: var(--gold); }
.bond-title { color: #ff8ad8; }
.card.bond { background: #3a2a40; box-shadow: inset 0 0 0 var(--ap) #ff8ad8; }
.card.bond .nm { color: #ff8ad8; }
.cards.done .card { pointer-events: none; opacity: .45; }
.cards.guard .card { opacity: .5; }
.cards.done .card.picked { opacity: 1; box-shadow: inset 0 0 0 var(--ap) var(--gold); }
#lvl-wait { color: var(--gold); font-size: 0.9375rem; }

/* ---------- results and XP progress ---------- */
.results-box { display: flex; flex-direction: column; max-height: 100%; overflow: hidden; }
.results-header { flex: 0 0 auto; padding-bottom: 0.625rem; border-bottom: var(--ap) solid var(--edge-in); }
.results-step { display: flex; justify-content: center; align-items: center; gap: 0.4375rem; margin: 0 0 0.625rem; font-size: 0.8125rem; color: var(--muted); }
.results-dot { flex: 0 0 0.5rem; width: 0.5rem; height: 0.5rem; background: var(--navy-4); box-shadow: 0 0 0 var(--ap) var(--line); }
.results-dot.active { background: var(--gold); }
#over-stats, .progress-content { min-height: 0; overflow: auto; overscroll-behavior: contain; }
.results-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; flex-shrink: 0; padding-top: 0.75rem; border-top: var(--ap) solid var(--edge-in); }
.results-actions .btn { flex: 1; }

/* ---------- evolution ---------- */
#scr-evolution { z-index: 80; }
.evolution-box { width: min(32.5rem, 100%); }
.evolution-stage { position: relative; width: 15rem; height: 12.5rem; margin: 0.75rem auto; }
.evolution-stage canvas { position: absolute; inset: 0; width: 15rem; height: 12.5rem; }

@media (max-height: 499px) and (orientation: landscape) {
  #scr-levelup .box, #scr-bond .box, #scr-item .box { padding: 0.5rem 0.875rem; }
  #scr-levelup .card, #scr-bond .card, #scr-item .card { padding: 0.375rem 0.625rem; }
  #scr-bond .bond-hint { display: none; }
  #scr-bond .box { width: min(51.25rem, 100%); }
  #bond-cards { display: grid; grid-template-columns: 1fr 1fr; width: 100%; }
  .results-header { padding-bottom: 0.375rem; }
  .results-step { margin-bottom: 0.25rem; }
  .results-actions { padding-top: 0.375rem; }
  .progress-stage { width: 6rem; height: 4.5rem; }
  .progress-content { padding: 0.375rem 0.125rem; }
  .progress-reward { margin: 0.5rem 0; padding: 0.5rem; }
  .evolution-box { padding: 0.75rem 1.125rem; }
  .evolution-stage, .evolution-stage canvas { width: 10.5rem; height: 8.75rem; }
  .evolution-stage { margin: 0 auto; }
  .evolution-box p, .evolution-option { margin: 0.375rem 0; }
}
```

- [ ] **Step 4: Port the remaining rules with the Conversion Recipe**

Port and delete the legacy copies of: `.pause-sum*`, `.sum-moves*`, `.sum-stats div/span/small`, `.cards .card` transition (→ `transition: none`; state changes are instant in the pixel style), `.progress-box*`, `.progress-stage`, `.progress-reward*`, `.progress-unlocks*`, `.progress-note`, `#evolution-after`, `.evolution-complete*`, `.evolution-running*` (keep its `radial-gradient` halo: art allowlist; square off nothing else), `.evolution-option`, `.evolution-soft*`, `@keyframes evolution-before/after` (→ `steps(1, end)` already), reduced-motion overrides, `#pause-sound + .row`.

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Verify no legacy block is left besides town**

Run: `Select-String -Path css/style.css -Pattern 'max-height: 520px|max-height: 400px|max-height: 380px|min-height: 521px|max-width: 760px'`
Expected: matches only inside the town block (≈ legacy lines 47–96), which Task 8 replaces.

- [ ] **Step 7: Commit**

```powershell
git add css/style.css tests/ui-style.test.cjs
git commit -m "Pixel UI for pause, level-up, results and evolution" -m "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

### Task 8: Town overlay and town camera fit

**Files:**
- Modify: `css/style.css` (replace the legacy town block ≈47–96), `js/town.js:81-82,694-704,1050-1051`
- Test: `tests/ui-style.test.cjs`, `tests/ui-modules.test.cjs`

**Interfaces:**
- Produces: `PSTown.fitScale(width: number, height: number): number` (also `require('../js/town.js').fitScale`).

- [ ] **Step 1: Write failing tests**

Append to `tests/ui-style.test.cjs`:

```js
test('town controls sit inside the safe area; d-pad on touch and phones; portrait heading stacks', () => {
  assert.match(find(css, '.town-heading').body, /top: calc\(var\(--frame-t\) \+ var\(--topbar-h\) \+ var\(--gut\)\)/);
  assert.match(find(css, '.town-pad').body, /left: var\(--frame-l\); bottom: var\(--frame-b\)/);
  assert.match(find(css, '.town-footer').body, /bottom: calc\(var\(--frame-b\) \+ 1\.5rem\)/);
  assert.match(find(css, '.town-pad', '(pointer: coarse), (max-width: 499px), (max-height: 499px)').body, /display: grid/);
  assert.match(find(css, '.town-heading', MEDIA.PORTRAIT).body, /flex-direction: column/);
});
```

Append to `tests/ui-modules.test.cjs`:

```js
const town = require('../js/town.js');

test('town camera fits by long and short axis, clamped to 0.6–1.5', () => {
  assert.equal(town.fitScale(1280, 720), Math.min(1280 / 1120, 720 / 760));
  assert.equal(town.fitScale(820, 1180), Math.min(1180 / 1120, 820 / 760));
  assert.equal(town.fitScale(820, 1180), town.fitScale(1180, 820));
  assert.equal(town.fitScale(393, 852), 0.6);
  assert.equal(town.fitScale(3840, 2160), 1.5);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/ui-style.test.cjs tests/ui-modules.test.cjs`
Expected: FAIL (`town.fitScale is not a function`, legacy town CSS).

- [ ] **Step 3: Implement `fitScale` in `js/town.js`**

After `const clamp = (n, low, high) => Math.max(low, Math.min(high, n));` (line 81) add:

```js
  // Fit by long/short axis so portrait screens see the same town area as landscape, rotated.
  function fitScale(width, height) {
    const long = Math.max(width, height), short = Math.min(width, height);
    return clamp(Math.min(long / 1120, short / 760), 0.6, 1.5);
  }
```

In `resize()` replace `scale = clamp(Math.min(bounds.width / 1120, bounds.height / 760), 0.6, 1.5);` with `scale = fitScale(bounds.width, bounds.height);`.

In the `api` object add `fitScale` after `direction`:

```js
  const api = { WIDTH, HEIGHT, RADIUS, SPEED, SPAWN, BUILDINGS, DESTINATIONS, PLAZA, POND, PATHS, PROPS,
    SOLIDS, walkable, move, nearby, direction, fitScale, install };
```

- [ ] **Step 4: Replace the town CSS block** (legacy ≈47–96) with:

```css
/* ---------- town overlay ---------- */
.town { z-index: 10; padding: 0; background: #315749; animation: none; }
#town-map { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; }
#town-map:focus-visible { outline: calc(2 * var(--ap)) solid var(--gold); outline-offset: calc(-2 * var(--ap)); }
.town-heading, .town-footer { position: absolute; left: var(--frame-l); right: var(--frame-r); display: flex; align-items: center;
  justify-content: space-between; gap: 1rem; pointer-events: none; text-shadow: var(--ap) var(--ap) 0 #203e40; }
.town-heading { top: calc(var(--frame-t) + var(--topbar-h) + var(--gut)); align-items: flex-start; }
.town-heading h1 { margin: 0; font-size: 1.5rem; color: #fff6db; }
.town-heading p, .town-footer p { margin: 0.25rem 0 0; }
.town-heading p { display: none; }
.town-heading > div:first-child { max-width: calc(100% - 7.5rem); }
.town-controls { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.5rem; max-width: 52%; }
#town-connection { width: 100%; text-align: right; font-size: 0.75rem; }
.town-heading > div, .town-caption, .town-door { padding: 0.5rem 0.75rem; background: #163c3b;
  border: var(--ap) solid #d5d9ad; box-shadow: 0 0 0 var(--ap) #0f2a29, var(--hard); }
.town-footer { bottom: calc(var(--frame-b) + 1.5rem); align-items: flex-end; }
.town-caption { max-width: 52%; }
.town-caption b { font-size: 1.125rem; color: #fff0ac; }
.town-caption p { font-size: 0.75rem; color: #dce8c9; }
.town-door { min-width: 11.875rem; max-width: 15.625rem; text-align: center; }
.town-door p { margin: 0 0 0.375rem; font-size: 0.875rem; color: #fff0ac; }
.town button { pointer-events: auto; }
.town #town-menu, .town #town-party, .town #town-interact { min-height: 2.75rem; padding: 0.5rem 1rem; font-size: 1rem; }
.town-pad { position: absolute; left: var(--frame-l); bottom: var(--frame-b); display: none; grid-template-columns: repeat(3, 3rem); gap: 0.3125rem; }
.town-pad button { width: 3rem; height: 2.75rem; padding: 0; touch-action: none; }
.town-pad button:first-child { grid-column: 2; }
.town-pad button:nth-child(2) { grid-column: 1; grid-row: 2; }
.town-pad button:nth-child(3) { grid-column: 2; grid-row: 2; }
.town-pad button:nth-child(4) { grid-column: 3; grid-row: 2; }
.town-pad button.pressed { transform: translateY(calc(2 * var(--ap))); border-bottom-width: var(--ap); }
.town button:focus-visible, #menu-town:focus-visible { outline: calc(2 * var(--ap)) solid var(--gold); outline-offset: calc(2 * var(--ap)); }
@media (min-width: 1100px) and (min-height: 600px) {
  .town-heading p { display: block; }
  .town-heading > div:first-child { max-width: none; }
}
@media (pointer: coarse), (max-width: 499px), (max-height: 499px) {
  .town-pad { display: grid; }
  .town-heading h1 { font-size: 1.375rem; }
  .town-heading > div { padding: 0.375rem 0.625rem; }
  .town-heading p, .town-caption { display: none; }
  .town-footer { left: auto; right: var(--frame-r); bottom: var(--frame-b); }
  .town-door { min-width: 11.25rem; padding: 0.5rem; }
  .town-door p { max-width: 13.75rem; }
}
@media (orientation: portrait) {
  .town-heading { flex-direction: column; align-items: stretch; gap: 0.5rem; }
  .town-heading > div:first-child { max-width: none; }
  .town-controls { max-width: none; justify-content: flex-start; }
  .town-door { min-width: 0; max-width: calc(100vw - var(--frame-l) - var(--frame-r) - 10.25rem); }
}
@media (prefers-reduced-motion: reduce) { .town button { transition: none; } }
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS (including `tests/town.test.cjs`).

- [ ] **Step 6: Smoke check** at 393×852 (DevTools touch emulation): title box below the top bar, d-pad bottom-left, "interact" panel bottom-right, nothing overlapping; walking works.

- [ ] **Step 7: Commit**

```powershell
git add css/style.css js/town.js tests/ui-style.test.cjs tests/ui-modules.test.cjs
git commit -m "Town overlay inside safe areas with long/short-axis camera fit" -m "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

### Task 9: Engine codemod for portrait play and safe areas

**Files:**
- Create: `tools/patch-responsive-engine.cjs`, `tests/responsive-engine.test.cjs`
- Modify: `js/app.min.js` (generated by the codemod)

**Interfaces:**
- Produces: `require('../tools/patch-responsive-engine.cjs')` → `{ PATCHES: Array<[before: string, after: string]>, patch(source: string, patches = PATCHES): string, patchFile(file: string): boolean }`. `patch` replaces each unique `before`; if `before` is absent and `after` is present it skips (idempotent); otherwise it throws `Engine anchor not found` / `Engine anchor is not unique`.
- Engine behavior after patching: rotate overlay never shown; fullscreen no longer locks orientation; `Camera.fit` uses long/short axes; `Touch.safeArea()` reads `--sa-*`; XP bar drawn at `safe.top`; pause button uses full top/right insets; touch layouts stored in `pad` (landscape) and `padP` (portrait); layout editor's rotate hint never shown.

- [ ] **Step 1: Write failing tests** (`tests/responsive-engine.test.cjs`)

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PATCHES, patch } = require('../tools/patch-responsive-engine.cjs');

const engine = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.min.js'), 'utf8');

test('every responsive engine patch is applied exactly once', () => {
  for (const [before, after] of PATCHES) {
    assert.ok(!engine.includes(before), 'Unpatched anchor: ' + before.slice(0, 80));
    assert.equal(engine.split(after).length - 1, 1, 'Missing or duplicated patch: ' + after.slice(0, 80));
  }
});

test('the codemod is idempotent and refuses missing or ambiguous anchors', () => {
  assert.equal(patch(engine), engine);
  assert.throws(() => patch('a;a', [['a', 'b']]), /not unique/);
  assert.throws(() => patch('x', [['a', 'b']]), /not found/);
});

test('portrait sees the same world area as landscape, rotated; landscape is unchanged', () => {
  const body = /'fit'\(\)\{(this\['scale'\][^}]*)\}/.exec(engine)[1];
  const fit = new Function(body);
  const view = (w, h) => { const camera = { _cw: w, _ch: h, VIEW_W: 768, MIN_VIEW_H: 420, zoom: 1 }; fit.call(camera); return camera; };
  const land = view(852, 393), port = view(393, 852);
  assert.ok(Math.abs(port.w - land.h) < 1e-9 && Math.abs(port.h - land.w) < 1e-9);
  assert.equal(view(1280, 720).scale, Math.min(1280 / 768, 720 / 420));
});

test('portrait is never blocked and touch layouts are stored per orientation', () => {
  assert.match(engine, /_0x147905=!1/);
  assert.doesNotMatch(engine, /\['lock'\]\('landscape'\)/);
  assert.match(engine, /padding:var\(--sa-top,0px\)/);
  assert.match(engine, /\['get'\]\(innerHeight>innerWidth\?'padP':'pad'\)/);
  assert.match(engine, /\['set'\]\(innerHeight>innerWidth\?'padP':'pad',/);
  assert.match(engine, /'pad':null,'padP':null,'gamepad'/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/responsive-engine.test.cjs`
Expected: FAIL (`Cannot find module '../tools/patch-responsive-engine.cjs'`).

- [ ] **Step 3: Create `tools/patch-responsive-engine.cjs`**

```js
// Idempotent, checked codemod for the vendored engine: portrait play, safe-area vars,
// full safe insets for the HUD and per-orientation touch layouts. Safe to rerun.
const fs = require('node:fs');
const path = require('node:path');

const PATCHES = [
  // Portrait is supported: never show the rotate overlay and never lock to landscape.
  ["_0x147905=_0x599208['Touch']['active']&&innerHeight>innerWidth", '_0x147905=!1'],
  ["_0x1624c1['then'](()=>{try{screen['orientation']['lock']('landscape')['catch'](()=>{});}catch(_0x887069){}})",
    "_0x1624c1['then'](()=>{})"],
  // Fit by long/short axis: landscape unchanged, portrait sees the same area rotated.
  ["this['scale']=Math['min'](this['_cw']/this['VIEW_W'],this['_ch']/this['MIN_VIEW_H'])/this['zoom']",
    "this['scale']=Math['min'](Math['max'](this['_cw'],this['_ch'])/this['VIEW_W'],Math['min'](this['_cw'],this['_ch'])/this['MIN_VIEW_H'])/this['zoom']"],
  // Safe-area probe reads the stylesheet's --sa-* vars (single source of truth, simulable in tests).
  [String.raw`padding:env(safe-area-inset-top)\x20env(safe-area-inset-right)\x20env(safe-area-inset-bottom)\x20env(safe-area-inset-left)`,
    String.raw`padding:var(--sa-top,0px)\x20var(--sa-right,0px)\x20var(--sa-bottom,0px)\x20var(--sa-left,0px)`],
  // XP bar below the status bar / island.
  ["_0x21c456['fillRect'](0x0,0x0,_0x3d17e6,0x7)",
    "_0x21c456['fillRect'](0x0,_0x599208['Touch']['safeArea']()['top'],_0x3d17e6,0x7)"],
  ["_0x21c456['fillRect'](0x0,0x0,_0x3d17e6*_0x599208['U']['clamp'](_0xa1db99,0x0,0x1),0x7)",
    "_0x21c456['fillRect'](0x0,_0x599208['Touch']['safeArea']()['top'],_0x3d17e6*_0x599208['U']['clamp'](_0xa1db99,0x0,0x1),0x7)"],
  // Pause button: full insets instead of the old 44px/20px caps (HUD, default spot, layout reset).
  ["_0x3d17e6-0x34-Math['min'](0x2c,_0x579ff0[_0x2a477f(0x195)])", "_0x3d17e6-0x34-_0x579ff0[_0x2a477f(0x195)]"],
  ["0xc+Math['min'](0x14,_0x579ff0['top'])", "0xc+_0x579ff0['top']"],
  ["[_0x1e92fa-0x34-Math['min'](0x2c,_0x4b18b5['right'])+0x14,0xc+Math['min'](0x14,_0x4b18b5['top'])+0x14]",
    "[_0x1e92fa-0x34-_0x4b18b5['right']+0x14,0xc+_0x4b18b5['top']+0x14]"],
  ["'pause':[_0x3929ef-0x34-Math['min'](0x2c,_0x150644['right'])+0x14,0xc+Math['min'](0x14,_0x150644['top'])+0x14]",
    "'pause':[_0x3929ef-0x34-_0x150644['right']+0x14,0xc+_0x150644['top']+0x14]"],
  // Custom touch layouts: 'pad' = landscape (existing saves), 'padP' = portrait.
  ["'pad':null,'gamepad'", "'pad':null,'padP':null,'gamepad'"],
  ["const _0x530368=_0x599208['Settings']['get']('pad');",
    "const _0x530368=_0x599208['Settings']['get'](innerHeight>innerWidth?'padP':'pad');"],
  ["_0x599208['Settings']['set']('pad',", "_0x599208['Settings']['set'](innerHeight>innerWidth?'padP':'pad',"],
  // The layout editor never asks to rotate.
  ["_0x1d304e['querySelector']('.lay-turn')[_0xca6c53(0x512)]['toggle']('hidden',innerWidth>=innerHeight)",
    "_0x1d304e['querySelector']('.lay-turn')[_0xca6c53(0x512)]['toggle']('hidden',!0)"]
];

function patch(source, patches = PATCHES) {
  let out = source;
  for (const [before, after] of patches) {
    const count = out.split(before).length - 1;
    if (count === 1) out = out.replace(before, () => after);
    else if (count === 0 && out.includes(after)) continue;
    else throw new Error(`Engine anchor ${count ? 'is not unique' : 'not found'}: ${before.slice(0, 100)}`);
  }
  return out;
}

function patchFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  const next = patch(source);
  if (next !== source) fs.writeFileSync(file, next);
  console.log((next === source ? 'Already patched: ' : 'Patched: ') + file);
  return next !== source;
}

module.exports = { PATCHES, patch, patchFile };
if (require.main === module) patchFile(process.argv[2] || path.join(__dirname, '..', 'js', 'app.min.js'));
```

- [ ] **Step 4: Apply and verify idempotency**

Run: `node tools/patch-responsive-engine.cjs; node tools/patch-responsive-engine.cjs`
Expected: `Patched: …app.min.js` then `Already patched: …app.min.js`.

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS (`tests/town.test.cjs` still boots the patched engine's sprite helper).

- [ ] **Step 6: Smoke check in portrait** (DevTools 393×852, touch emulation): no rotate prompt; start a run; the world shows ≈420 units wide; XP bar, HP and pause sit below a simulated inset (add `:root{--sa-top:59px}` in DevTools); Settings → Controls → place buttons in portrait, save, rotate to landscape: landscape keeps its own layout.

- [ ] **Step 7: Commit**

```powershell
git add tools/patch-responsive-engine.cjs tests/responsive-engine.test.cjs js/app.min.js
git commit -m "Engine: portrait play, safe-area HUD and per-orientation touch layouts" -m "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

### Task 10: Integer HUD scale on large screens

**Files:**
- Create: `js/ui-scale.js`
- Modify: `tools/patch-responsive-engine.cjs` (two more patches), `js/app.min.js`, `index.html`, `en/index.html`
- Test: `tests/ui-modules.test.cjs`, `tests/responsive-engine.test.cjs`

**Interfaces:**
- Produces: `require('../js/ui-scale.js')` → `{ create(root) }`; `create(root)` returns `{ scale(): number, buttonScale(): number, drawHud(hud, ctx, width, height, player, extra) }`. In the browser: `window.PSUiScale = create(window)`. `scale()` is the integer `--s` (≥1, cached until `resize`). During `drawHud` at scale S the context is scaled by S, the HUD receives `width/S`, `height/S`, and `buttonScale()` returns S so touch buttons registered by the HUD are stored in screen pixels.

- [ ] **Step 1: Write failing tests**

Append to `tests/ui-modules.test.cjs`:

```js
const { create } = require('../js/ui-scale.js');

function scaleRoot(read) {
  const listeners = {};
  return { listeners, document: { documentElement: {} },
    getComputedStyle: () => ({ getPropertyValue: () => read() }),
    addEventListener: (type, fn) => { listeners[type] = fn; } };
}

test('HUD draws at the integer UI scale and touch hit areas follow it', () => {
  let value = ' 2';
  const root = scaleRoot(() => value);
  const ui = create(root);
  const calls = [];
  const ctx = { save: () => calls.push('save'), restore: () => calls.push('restore'), scale: (x, y) => calls.push(['scale', x, y]) };
  let seen;
  const hud = { draw: (c, w, h, player, extra) => { seen = { w, h, player, extra, k: ui.buttonScale() }; } };
  ui.drawHud(hud, ctx, 2560, 1440, 'p', 'x');
  assert.deepEqual(seen, { w: 1280, h: 720, player: 'p', extra: 'x', k: 2 });
  assert.deepEqual(calls, ['save', ['scale', 2, 2], 'restore']);
  assert.equal(ui.buttonScale(), 1);
  value = ' 1';
  root.listeners.resize();
  ui.drawHud(hud, ctx, 1280, 720, 'p', 'x');
  assert.deepEqual(seen, { w: 1280, h: 720, player: 'p', extra: 'x', k: 1 });
});

test('missing or invalid UI scale falls back to 1', () => {
  assert.equal(create(scaleRoot(() => '')).scale(), 1);
  assert.equal(create(scaleRoot(() => ' 0')).scale(), 1);
});
```

Append to `tests/responsive-engine.test.cjs`:

```js
test('the HUD and its touch buttons go through PSUiScale, with a safe fallback', () => {
  assert.match(engine, /window\.PSUiScale\?window\.PSUiScale\.drawHud\(_0x599208\['HUD'\],/);
  assert.match(engine, /const _psK=window\.PSUiScale\?window\.PSUiScale\.buttonScale\(\):1;/);
  for (const page of ['index.html', 'en/index.html']) {
    const source = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    const at = source.indexOf('js/ui-scale.js?v=');
    assert.ok(at > 0 && at < source.indexOf('js/app.min.js?v='), page);
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/ui-modules.test.cjs tests/responsive-engine.test.cjs`
Expected: FAIL (missing module and patches).

- [ ] **Step 3: Create `js/ui-scale.js`**

```js
// Integer UI scale (--s) for the canvas HUD: large screens draw it at 2× / 3× like the HTML UI.
(function () {
  function create(root) {
    let cached = 0, active = 1;
    const read = () => {
      const value = parseInt(root.getComputedStyle(root.document.documentElement).getPropertyValue('--s'), 10);
      return Number.isInteger(value) && value > 1 ? value : 1;
    };
    root.addEventListener('resize', () => { cached = 0; });
    return {
      scale: () => cached || (cached = read()),
      buttonScale: () => active,
      drawHud(hud, ctx, width, height, player, extra) {
        const s = this.scale();
        if (s === 1) return hud.draw(ctx, width, height, player, extra);
        ctx.save();
        ctx.scale(s, s);
        active = s;
        try { return hud.draw(ctx, width / s, height / s, player, extra); }
        finally { active = 1; ctx.restore(); }
      }
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { create };
  else window.PSUiScale = create(window);
})();
```

- [ ] **Step 4: Add the two patches** to the end of `PATCHES` in `tools/patch-responsive-engine.cjs`

```js
  // Canvas HUD at the integer UI scale (falls back to the original call if ui-scale.js is missing).
  ["_0x599208['Judgment']['cinematic']||_0x599208['HUD']['draw'](_0x1464ad,_0x34875d,_0x159de6,_0x17b390,_0x5f4834)",
    "_0x599208['Judgment']['cinematic']||(window.PSUiScale?window.PSUiScale.drawHud(_0x599208['HUD'],_0x1464ad,_0x34875d,_0x159de6,_0x17b390,_0x5f4834):_0x599208['HUD']['draw'](_0x1464ad,_0x34875d,_0x159de6,_0x17b390,_0x5f4834))"],
  // Touch buttons registered while the HUD is scaled are stored in screen pixels.
  ["{_0x12e847['push']({'x':_0x22e037,'y':_0x427dde,'w':_0x5685dd,'h':_0x39c07d,'fn':_0x7c54a2,'pad':_0x38da72});}",
    "{const _psK=window.PSUiScale?window.PSUiScale.buttonScale():1;_0x12e847['push']({'x':_0x22e037*_psK,'y':_0x427dde*_psK,'w':_0x5685dd*_psK,'h':_0x39c07d*_psK,'fn':_0x7c54a2,'pad':_0x38da72*_psK});}"]
```

Run: `node tools/patch-responsive-engine.cjs`
Expected: `Patched: …app.min.js`.

- [ ] **Step 5: Load the module before the engine** in both `index.html` and `en/index.html`, right after the `js/topbar.js` tag:

```html
<script defer src="js/ui-scale.js?v=pixel-ui-1"></script>
```

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Smoke check** with DevTools at 2560×1440: the HUD (HP, level, orbs) is exactly twice the 1280×720 size and crisp; at 1280×720 it is unchanged.

- [ ] **Step 8: Commit**

```powershell
git add js/ui-scale.js tools/patch-responsive-engine.cjs js/app.min.js index.html en/index.html tests/ui-modules.test.cjs tests/responsive-engine.test.cjs
git commit -m "Draw the canvas HUD at the integer UI scale" -m "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

### Task 11: Cache busting and offline precache

**Files:**
- Modify: `index.html`, `en/index.html`, `sw.js`, `version.json`
- Test: `tests/menu.test.cjs` (existing `tests/training.test.cjs` build-ID test must keep passing)

- [ ] **Step 1: Write the failing test** (append to `tests/menu.test.cjs`)

```js
test('new UI scripts load before the engine and are precached with the new stylesheet', () => {
  for (const file of ['js/topbar.js?v=pixel-ui-1', 'js/ui-scale.js?v=pixel-ui-1']) {
    for (const page of ['index.html', 'en/index.html']) assert.ok(read(page).includes(`src="${file}"`), page + ' ' + file);
    assert.ok(worker.includes(`'./${file}'`), 'Uncached ' + file);
  }
  for (const page of ['index.html', 'en/index.html']) assert.ok(read(page).includes('href="css/style.css?v=pixel-ui-1"'));
  assert.doesNotMatch(worker, /CODE\s*=\s*'ps-code-v23'/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/menu.test.cjs`
Expected: FAIL.

- [ ] **Step 3: Bump versions**

```powershell
$v = (Get-FileHash js/app.min.js -Algorithm SHA256).Hash.Substring(0, 10).ToLower()
$at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.000Z")
Set-Content -NoNewline version.json ('{"v":"' + $v + '","at":"' + $at + '"}')
foreach ($f in 'index.html', 'en/index.html') {
  (Get-Content -Raw $f).Replace('css/style.css?v=shared-town-menu-1', 'css/style.css?v=pixel-ui-1').Replace('js/app.min.js?v=f56a91b304', "js/app.min.js?v=$v") | Set-Content -NoNewline $f
}
$sw = (Get-Content -Raw sw.js).Replace("'ps-code-v23'", "'ps-code-v24'").Replace('./css/style.css?v=shared-town-menu-1', './css/style.css?v=pixel-ui-1').Replace("'./js/app.min.js?v=f56a91b304'", "'./js/topbar.js?v=pixel-ui-1', './js/ui-scale.js?v=pixel-ui-1',`n    './js/app.min.js?v=$v'")
Set-Content -NoNewline sw.js $sw
git --no-pager diff --stat
```

Expected: `version.json`, both HTML files and `sw.js` change; `sw.js` lists both new scripts before `app.min.js`.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS, including `entry pages, updater manifest and offline cache use the same compatible build ID`.

- [ ] **Step 5: Commit**

```powershell
git add index.html en/index.html sw.js version.json tests/menu.test.cjs
git commit -m "Cache-bust the pixel UI build" -m "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

### Task 12: Screenshot matrix and visual fixes

**Files:**
- Create: `tools/ui-shots.cjs`
- Modify: `package.json`, `package-lock.json` (Playwright devDependency + `shots` script); `css/style.css`, `tests/ui-style.test.cjs` for any fix found

- [ ] **Step 1: Install Playwright (dev-only)**

```powershell
npm install --save-dev --save-exact playwright
npx playwright install chromium
```

Add to `package.json` `scripts`: `"shots": "node tools/ui-shots.cjs"`.

- [ ] **Step 2: Create `tools/ui-shots.cjs`**

```js
// Playwright screenshot matrix for the responsive UI (dev-only).
// Usage: npm run shots            (all devices)
//        npm run shots -- --only=iphone-15-pro
// Simulated safe-area insets override --sa-*; unsafe bands are hatched red in the captures.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const out = path.join(root, '.shots');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
// Insets are [top, right, bottom, left] in CSS px.
const DEVICES = [
  { name: 'iphone-se', width: 375, height: 667, dpr: 2, touch: true, portrait: [20, 0, 0, 0], landscape: [0, 0, 0, 0] },
  { name: 'iphone-15-pro', width: 393, height: 852, dpr: 3, touch: true, portrait: [59, 0, 34, 0], landscape: [0, 59, 21, 59] },
  { name: 'iphone-15-pro-max', width: 430, height: 932, dpr: 3, touch: true, portrait: [59, 0, 34, 0], landscape: [0, 59, 21, 59] },
  { name: 'ipad', width: 820, height: 1180, dpr: 2, touch: true, portrait: [24, 0, 20, 0], landscape: [24, 0, 20, 0] },
  { name: '720p', width: 1280, height: 720, dpr: 1, landscape: [0, 0, 0, 0] },
  { name: '1080p', width: 1920, height: 1080, dpr: 1, landscape: [0, 0, 0, 0] },
  { name: '1440p', width: 2560, height: 1440, dpr: 1, landscape: [0, 0, 0, 0] },
  { name: '4k', width: 3840, height: 2160, dpr: 1, landscape: [0, 0, 0, 0] }
];
const MENU_SCREENS = ['dex', 'shop', 'bag', 'gacha', 'goals', 'friends', 'rank', 'settings'];
const STATIC_SCREENS = ['scr-legal', 'scr-news', 'scr-support', 'scr-nick', 'scr-recover', 'scr-lobby', 'scr-evolution', 'scr-profile'];

function serve() {
  const server = http.createServer((req, res) => {
    let file = path.normalize(path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(0, 'localhost', () => resolve(server)));
}

const visible = (page, selector, timeout = 8000) => page.waitForSelector(selector + ':not(.hidden)', { state: 'visible', timeout });

async function step(page, dir, name, action) {
  try {
    if (action) await action();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(dir, name + '.png') });
    console.log('  ok  ' + name);
  } catch (error) {
    console.log('  --  ' + name + ': ' + error.message.split('\n')[0]);
  }
}

async function toMenu(page) {
  await page.keyboard.press('Escape');
  await visible(page, '#scr-menu', 2000).catch(() => page.click('#town-menu').catch(() => {}));
}

async function capture(browser, base, device, orientation) {
  const portrait = orientation === 'portrait';
  const long = Math.max(device.width, device.height), short = Math.min(device.width, device.height);
  const [width, height] = portrait ? [short, long] : [long, short];
  const insets = device[orientation];
  const dir = path.join(out, `${device.name}-${orientation}`);
  fs.mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: device.dpr,
    isMobile: Boolean(device.touch), hasTouch: Boolean(device.touch), serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript(([t, r, b, l]) => {
    addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      const hatch = 'position:fixed;z-index:2147483647;pointer-events:none;background:repeating-linear-gradient(45deg,rgba(255,0,80,.4) 0 6px,transparent 6px 12px)';
      style.textContent = `:root{--sa-top:${t}px;--sa-right:${r}px;--sa-bottom:${b}px;--sa-left:${l}px}`;
      document.head.append(style);
      for (const css of [t && `top:0;left:0;right:0;height:${t}px`, r && `top:0;bottom:0;right:0;width:${r}px`,
        b && `left:0;right:0;bottom:0;height:${b}px`, l && `top:0;bottom:0;left:0;width:${l}px`].filter(Boolean)) {
        const band = document.createElement('div');
        band.style.cssText = hatch + ';' + css;
        document.body.append(band);
      }
    });
  }, insets);
  console.log(`${device.name} ${orientation} (${width}x${height})`);
  await page.goto(base + '/index.html');
  await step(page, dir, '01-login', async () => {
    const tap = await page.waitForSelector('#tap-start:not(.hidden)', { timeout: 15000 }).catch(() => null);
    if (tap) await tap.click();
    await visible(page, '#scr-login', 20000);
  });
  await step(page, dir, '02-starters', async () => { await page.click('#btn-guest'); await visible(page, '#scr-starters', 20000); });
  await step(page, dir, '03-town', async () => {
    await page.click('#starter-grid .starter-card');
    await page.click('#starter-ok');
    await visible(page, '#scr-town', 20000);
  });
  await step(page, dir, '04-menu', async () => { await page.click('#town-menu'); await visible(page, '#scr-menu'); });
  if (device.touch) {
    await step(page, dir, '05-topbar-more', () => page.click('#topbar-more'));
    await page.keyboard.press('Escape');
  }
  for (const [index, go] of MENU_SCREENS.entries()) {
    await step(page, dir, `1${index}-${go}`, async () => { await page.click(`#scr-menu [data-go="${go}"]`); await page.waitForTimeout(600); });
    await toMenu(page);
  }
  await step(page, dir, '20-training', async () => { await page.click('#menu-training'); await visible(page, '#scr-training'); });
  await toMenu(page);
  for (const id of STATIC_SCREENS) {
    await step(page, dir, '30-' + id, () => page.evaluate(target => document.getElementById(target).classList.remove('hidden'), id));
    await page.evaluate(target => document.getElementById(target).classList.add('hidden'), id);
  }
  await step(page, dir, '40-play-setup', async () => { await page.click('#scr-menu [data-go="play"]'); await page.waitForTimeout(1200); });
  await step(page, dir, '41-run-hud', async () => {
    const start = await page.$('#training-play:not(.hidden)');
    if (start) await start.click();
    await page.waitForTimeout(4000);
  });
  await step(page, dir, '42-level-up', () => visible(page, '#scr-levelup', 45000));
  await page.click('#cards .card').catch(() => {});
  await step(page, dir, '43-pause', async () => { await page.keyboard.press('Escape'); await visible(page, '#scr-pause'); });
  await step(page, dir, '44-results', async () => { await page.click('#btn-quit'); await visible(page, '#scr-over', 15000); });
  await step(page, dir, '45-xp-progress', async () => { await page.click('#btn-again'); await visible(page, '#scr-progress', 15000); });
  await context.close();
}

(async () => {
  const only = (process.argv.find(arg => arg.startsWith('--only=')) || '').slice('--only='.length);
  fs.rmSync(out, { recursive: true, force: true });
  const server = await serve();
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    for (const device of DEVICES.filter(d => !only || d.name === only)) {
      for (const orientation of ['portrait', 'landscape']) if (device[orientation]) await capture(browser, base, device, orientation);
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log('Screenshots in ' + out);
})();
```

- [ ] **Step 3: Run the matrix**

Run: `npm run shots`
Expected: `.shots/<device>-<orientation>/*.png` for 14 device/orientation pairs; each line `ok` or `--` with a reason. A `--` caused by a flow change (e.g. a confirm dialog after `#btn-quit`) is fixed in the script by clicking through it; screens that only appear by chance (level-up) may stay `--` if the 45 s window passes without a level.

- [ ] **Step 4: Review every capture against this checklist**

- No text, button or HUD element inside a red hatched band (simulated island / home indicator / side insets).
- Nothing clipped by the viewport; dialogs scroll internally with their header and action row visible.
- No overlapping elements (top bar vs. screen titles, d-pad vs. door panel, HUD vs. orbs, ⋯ menu vs. screen).
- Touch targets ≥ 44px on touch devices.
- 1440p and 4K captures look exactly like 720p at 2× and 3× (crisp, no half-pixel blur).
- In-run portrait shows roughly 420 world units wide (same scene area as landscape, rotated).

- [ ] **Step 5: Fix each finding with a regression test**

For each issue: add a failing assertion to `tests/ui-style.test.cjs` that pins the corrected rule (same `find(css, selector, MEDIA.X)` style as earlier tasks), fix the rule in the section that owns it, run `npm test`, and rerun `npm run shots -- --only=<device>`. HUD overlaps are fixed by adding an anchored patch to `PATCHES` in `tools/patch-responsive-engine.cjs` (validated by `tests/responsive-engine.test.cjs`), then re-applying the codemod and redoing Task 11 Step 3 (new `app.min.js` hash).

- [ ] **Step 6: Commit**

```powershell
git add tools/ui-shots.cjs package.json package-lock.json css/style.css tests/ui-style.test.cjs
git commit -m "Add Playwright screenshot matrix and fix responsive findings" -m "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

### Task 13: Cleanup, global style rules and documentation

**Files:**
- Modify: `css/style.css`, `tests/ui-style.test.cjs`, `README.md`

- [ ] **Step 1: Write the failing global tests** (append to `tests/ui-style.test.cjs`)

```js
test('no legacy breakpoints, blur, backdrop filters, soft radii or legacy aliases remain', () => {
  assert.doesNotMatch(css, /max-height: (520|400|380)px|min-height: 521px|max-width: (480|600|620|640|760|800|1000|1200|1280|1600)px/);
  assert.doesNotMatch(css, /blur\(|backdrop-filter/);
  assert.doesNotMatch(css, /--(box1|box2|edge-out|gold2|shadow)\b/);
  for (const rule of rules(css)) {
    const radius = /border-radius:\s*([^;]+)/.exec(rule.body);
    if (radius) assert.equal(radius[1].trim(), '50%', rule.selector + ' uses a soft radius');
  }
});

test('soft gradients only appear in the art allowlist', () => {
  const art = /\.banner|\.ball|#pull-fx|\.shop-sign|\.evolution-running|\.yt-btn \.rec/;
  for (const rule of rules(css)) {
    if (/(?<!repeating-)(linear|radial)-gradient/.test(rule.body)) assert.match(rule.selector, art, rule.selector);
  }
});

test('box shadows are hard pixels: no blur radius', () => {
  const blurred = /(?:^|[\s,])-?\d*\.?\d+(?:px|rem)?\s+-?\d*\.?\d+(?:px|rem)?\s+[1-9]\d*\.?\d*(?:px|rem)/;
  for (const rule of rules(css)) {
    const shadow = /box-shadow:\s*([^;]+)/.exec(rule.body);
    if (shadow) assert.doesNotMatch(shadow[1], blurred, rule.selector);
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/ui-style.test.cjs`
Expected: FAIL only where leftovers exist (legacy aliases at minimum).

- [ ] **Step 3: Remove leftovers**

1. `Select-String -Path css/style.css -Pattern 'var\(--(box1|box2|edge-out|gold2|shadow)\)'` → replace each use with the matching token (`--navy-3`, `--navy-1`, `--line`, `--gold-lo`, `--line`).
2. `Select-String -Path js/app.min.js,js/*.js -Pattern "var\(--(box1|box2|edge-out|gold2|shadow)\)"` → if the engine or a module uses a legacy alias in inline styles, keep that alias in `:root` and relax the alias assertion to the remaining names; otherwise delete the alias line from `:root`.
3. Fix every remaining rule reported by the three tests using the Conversion Recipe.

- [ ] **Step 4: Update `README.md`**

Replace `**En móvil o tablet** (en horizontal): pon el dedo` with `**En móvil o tablet** (en vertical u horizontal): pon el dedo`.

Replace `En móvil horizontal hay una cruceta y el mismo botón` with `En móvil y tableta, en vertical u horizontal, hay una cruceta y el mismo botón`.

Insert before `## Pueblo principal`:

````md
## Interfaz

La interfaz usa ventanas de píxeles al estilo de Mundo Misterioso y de las consolas
portátiles: marcos nítidos, botones con relieve y sombras duras, sin desenfoques. Se adapta
a cualquier pantalla, en vertical u horizontal, también durante la partida: en vertical ves
la misma porción del mapa que en horizontal, girada.

En iPhone y otros móviles con isla, muesca o barra de inicio, nada interactivo queda debajo:
todo se coloca dentro de la zona segura que indica el sistema. En monitores grandes la
interfaz y el HUD de la partida se amplían a escalas enteras (×2 desde 2560×1440 y ×3 desde
3840×2160) para que cada píxel siga siendo nítido.

Si colocas a mano los botones táctiles, se guarda una disposición para vertical y otra para
horizontal.

Para revisar la interfaz en varios dispositivos:

```sh
npm install
npx playwright install chromium
npm run shots                 # o: npm run shots -- --only=iphone-15-pro
```

Las capturas quedan en `.shots/`, con las zonas inseguras simuladas rayadas en rojo.
````

In `### Datos y comprobaciones`, after the sentence about `js/app.min.js`, add: `` `tools/patch-responsive-engine.cjs` aplica al motor los cambios de orientación, zona segura y escala de la interfaz; se puede volver a ejecutar sin efectos. ``

- [ ] **Step 5: Full verification**

Run: `npm test`
Expected: PASS (all suites).
Run: `npm run shots -- --only=iphone-15-pro` and `npm run shots -- --only=720p`
Expected: captures still clean per the Task 12 checklist.

- [ ] **Step 6: Commit**

```powershell
git add css/style.css tests/ui-style.test.cjs README.md
git commit -m "Finish pixel UI cleanup and document responsive behavior" -m "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

## Self-Review Notes

- Spec coverage: §1 visual system → Tasks 2–7, 13; §2 scaling/safe area → Tasks 2, 3, 10; §3 layout → Tasks 3–8; §4 engine items 1–5 → Task 9, item 6 → Task 10; §5 compatibility → Tasks 1, 3, 4, 11; §6 verification → Tasks 1–13 tests, Task 12 matrix.
- Spec amendment: the top-bar overflow uses a button + `js/topbar.js` instead of `<details>` (a closed `<details>` cannot render its children inline on wide screens).
- Engine anchors were validated in memory against commit `58362b0`: all 16 are unique, the patched bundle parses, re-running is a no-op, and portrait at 393×852 sees 420×910.5 world units, exactly landscape 852×393 rotated.
