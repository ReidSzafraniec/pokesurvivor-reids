const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
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

const town = require('../js/town.js');

test('town camera fits by long and short axis, clamped to 0.6–1.5', () => {
  assert.equal(town.fitScale(1280, 720), Math.min(1280 / 1120, 720 / 760));
  assert.equal(town.fitScale(820, 1180), Math.min(1180 / 1120, 820 / 760));
  assert.equal(town.fitScale(820, 1180), town.fitScale(1180, 820));
  assert.equal(town.fitScale(393, 852), 0.6);
  assert.equal(town.fitScale(3840, 2160), 1.5);
});

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

function loadLocales(language) {
  const written = [];
  const context = {
    localStorage: { getItem: () => null },
    location: { pathname: '/' },
    navigator: { languages: [language], language },
    document: {
      documentElement: {},
      currentScript: { src: 'https://friends.example/js/core/locales.js?v=test-7' },
      write: html => written.push(html)
    }
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/core/locales.js'), 'utf8'), context);
  return { written, lang: context.PS_LOCALES.lang };
}

test('translations load deferred, so the page paints first but the game still runs after them', () => {
  const { written, lang } = loadLocales('fr-FR');
  assert.equal(lang, 'fr');
  assert.deepEqual(written, ['<script defer src="js/lang/fr.js?v=test-7"></script>']);
  const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
  assert(html.indexOf('js/core/locales.js') < html.indexOf('<script defer src="js/app.min.js'),
    'Deferred scripts run in document order, so the language file precedes the engine');
  assert.deepEqual(loadLocales('es-ES').written, [], 'Spanish is built in');
  assert.deepEqual(loadLocales('en-GB').written, [], 'English is built in');
});
