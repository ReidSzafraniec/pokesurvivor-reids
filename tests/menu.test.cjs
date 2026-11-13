const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { patch } = require('../tools/patch-promotion-engine.cjs');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const css = read('css/style.css');
const worker = read('sw.js');

for (const file of ['index.html', 'en/index.html']) {
  const html = read(file);

  test(`${file}: login and menu use the Evolution subtitle`, () => {
    const subtitles = [...html.matchAll(/<div class="t2"([^>]*)>([^<]*)<\/div>/g)];
    assert.equal(subtitles.length, 2);
    for (const [, attributes, text] of subtitles) {
      assert.equal(text, 'Evolution');
      assert.match(attributes, /\btranslate="no"/);
    }
  });

  test(`${file}: carousel compatibility container is inaccessible`, () => {
    const banner = html.match(/<div\b[^>]*\bid="menu-banner"[^>]*>/)?.[0];
    assert.ok(banner, 'The engine still requires the banner container');
    assert.match(banner, /class="menu-banner hidden"/);
    assert.match(banner, / hidden(?:\s|>)/);
    assert.match(banner, / inert(?:\s|>)/);
    assert.match(banner, /aria-hidden="true"/);
    assert.doesNotMatch(banner, /\b(?:role|tabindex|aria-label)=/);
  });

  test(`${file}: updated stylesheet is also precached`, () => {
    const stylesheet = html.match(/href="(css\/style\.css\?v=[^"]+)"/)?.[1];
    assert.ok(stylesheet);
    assert.notEqual(stylesheet, 'css/style.css?v=starter-town-1');
    assert.ok(worker.includes(`'./${stylesheet}'`));
  });
}

test('carousel stays suppressed when runtime removes its hidden class', () => {
  assert.match(css, /#scr-menu\s*>\s*#menu-banner\s*\{\s*display:\s*none\s*!important;\s*\}/);
});

test('carousel updates cannot reserve menu space or shrink the logo and partner', () => {
  assert.doesNotMatch(css, /\.menu-banner:not\(\.hidden\)\s*\+\s*\.menu-left/);
});

test('service worker invalidates the previous presentation cache', () => {
  assert.doesNotMatch(worker, /CODE\s*=\s*'ps-code-v14'/);
  assert.match(worker, /ART\s*=\s*'ps-art-v1'/);
});

test('new UI scripts load before the engine and are precached with the new stylesheet', () => {
  for (const file of ['js/topbar.js?v=pixel-ui-1', 'js/ui-scale.js?v=pixel-ui-1']) {
    for (const page of ['index.html', 'en/index.html']) assert.ok(read(page).includes(`src="${file}"`), page + ' ' + file);
    assert.ok(worker.includes(`'./${file}'`), 'Uncached ' + file);
  }
  for (const page of ['index.html', 'en/index.html']) {
    assert.doesNotMatch(read(page), /href="css\/style\.css\?v=(?:pixel-ui-1|no-promotion-1|starter-tutorial-1)"/);
  }
  assert.doesNotMatch(worker, /CODE\s*=\s*'ps-code-v23'/);
});

test('promotion removal refreshes the stylesheet and presentation cache', () => {
  assert.doesNotMatch(worker, /CODE\s*=\s*'ps-code-v24'/);
  assert.doesNotMatch(worker, /css\/style\.css\?v=pixel-ui-1/);
});

function initPromotion(engine) {
  const calls = { fetch: [], timers: [], listeners: [] };
  const element = () => ({ classList: { toggle() {}, add() {}, remove() {}, contains: () => true }, style: {} });
  const context = vm.createContext({
    _0x599208: { UI: { $: element }, Icons: { html: () => '' }, U: { esc: value => value }, BANNER: [] },
    fetch: url => { calls.fetch.push(url); return new Promise(() => {}); },
    setInterval: (fn, ms) => { calls.timers.push(ms); return 1; },
    clearInterval() {},
    document: { hidden: false, addEventListener: type => calls.listeners.push(type), getElementById: element },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    window: { open() {} }
  });
  const bootstrap = engine.slice(0, engine.indexOf('const a0_0xc9496a=')) +
    engine.slice(engine.lastIndexOf('function a0_0x48f4()'));
  vm.runInContext(bootstrap, context, { timeout: 3000 });
  const start = engine.indexOf("_0x599208['LiveUI']=");
  const end = engine.indexOf(",_0x599208[_0x48be02(0x1c1)]=((()=>{const _0x53fdc3=", start);
  assert(start > 0 && end > start);
  vm.runInContext(engine.slice(start, end), context, { timeout: 3000 });
  for (const ui of ['LiveUI', 'VideoUI', 'BannerUI']) context._0x599208[ui].init();
  return calls;
}

test('hidden YouTube promotion and menu carousel no longer poll GitHub or keep timers running', () => {
  const engine = read('js/app.min.js');
  assert.equal(patch(engine), engine, 'The shipped engine already has the checked patch');
  assert.deepEqual(initPromotion(engine), { fetch: [], timers: [], listeners: [] });
  assert.throws(() => patch('const unrelated = true;'), /anchor is missing or not unique/);
});

test('pages preload the same compact WOFF2 pixel fonts that the stylesheets use first', () => {
  const fonts = ['assets/fonts/PixelifyPS-400.woff2', 'assets/fonts/PixelifyPS-700.woff2'];
  for (const sheet of ['css/style.css', 'css/pages.css']) {
    const sources = [...read(sheet).matchAll(/@font-face\s*\{[^}]*?src:\s*url\('\.\.\/([^']+)'\)\s*format\('woff2'\)/g)];
    assert.deepEqual(sources.map(match => match[1]), fonts, sheet);
  }
  for (const page of ['index.html', 'en/index.html']) {
    const preloads = [...read(page).matchAll(/<link rel="preload" href="([^"]+)" as="font" type="font\/woff2" crossorigin>/g)];
    assert.deepEqual(preloads.map(match => match[1]), fonts, page);
  }
  for (const font of fonts) {
    assert.equal(fs.readFileSync(path.join(__dirname, '..', font)).subarray(0, 4).toString('latin1'), 'wOF2', font);
  }
});
