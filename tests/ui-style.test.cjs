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

test('in-game promotion remains suppressed after engine updates', () => {
  for (const selector of ['#btn-yt', '#btn-support', '#scr-support', '.support-ask']) {
    const rule = find(css, selector);
    assert.ok(rule, selector + ' needs a top-level suppression rule');
    assert.match(rule.body, /display:\s*none\s*!important/, selector);
  }
});

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

test('social and info screens adapt to portrait and fit the frame', () => {
  assert.match(find(css, '.lobby-members', MEDIA.PORTRAIT).body, /repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(find(css, '.rk-split', MEDIA.PORTRAIT).body, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(find(css, '.mission', MEDIA.PORTRAIT).body, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(find(css, '.box.settings').body, /max-height: 100%/);
  assert.match(find(css, '.box.news-box').body, /max-height: 100%/);
  assert.match(find(css, '#set-tabs', MEDIA.COMPACT).body, /overflow-x: auto/);
  assert.match(find(css, '.lay-turn').body, /display: none/);
});

test('run dialogs fit the frame: scrollable bodies, fixed headers and action rows', () => {
  assert.match(find(css, '.pause-box').body, /max-height: 100%/);
  assert.match(find(css, '.results-box').body, /max-height: 100%/);
  assert.match(find(css, '.results-actions').body, /flex-shrink: 0/);
  assert.match(find(css, '#bond-cards', MEDIA.COMPACT_LAND).body, /grid-template-columns: 1fr 1fr/);
  assert.ok(find(css, '.evolution-stage', MEDIA.COMPACT_LAND), 'evolution stage shrinks on phone landscape');
  assert.doesNotMatch(find(css, '.card.evo').body, /gradient/);
});

test('town controls sit inside the safe area; d-pad on touch and phones; portrait heading stacks', () => {
  assert.match(find(css, '.town-heading').body, /top: calc\(var\(--frame-t\) \+ var\(--topbar-h\) \+ var\(--gut\)\)/);
  assert.match(find(css, '.town-pad').body, /left: var\(--frame-l\); bottom: var\(--frame-b\)/);
  assert.match(find(css, '.town-footer').body, /bottom: calc\(var\(--frame-b\) \+ 1\.5rem\)/);
  assert.match(find(css, '.town-pad', '(pointer: coarse), (max-width: 499px), (max-height: 499px)').body, /display: grid/);
  assert.match(find(css, '.town-heading', MEDIA.PORTRAIT).body, /flex-wrap: wrap/);
});

test('screenshot-matrix regressions stay fixed', () => {
  // A filled pop animation kept transform: none and pushed centered pop-ups (achievements) off-center.
  assert.doesNotMatch(find(css, '.box').body, /animation: pop[^;]*\bboth\b/);
  assert.match(find(css, '.ach-pop').body, /width: max-content/);
  // Phone landscape: the Pokémon list column scrolls as a whole instead of squeezing the grid.
  assert.match(find(css, '#scr-dex .split > div:first-child', MEDIA.COMPACT_LAND).body, /overflow-y: auto/);
});

test('engine-sized sprites follow the integer scale; rem-sized ones are not double-scaled', () => {
  assert.match(find(css, '.scr canvas').body, /zoom: var\(--s\)/);
  for (const selector of ['#town-map', '#menu-partner', '.evolution-stage canvas', '.topbar img']) {
    assert.match(find(css, selector).body, /zoom: 1/, selector);
  }
});

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
