const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const expected = [
  [1, 4, 7, 25], [152, 155, 158], [252, 255, 258],
  [387, 390, 393], [495, 498, 501], [650, 653, 656],
  [722, 725, 728], [810, 813, 816], [906, 909, 912]
];

function load() {
  const file = require('node:path').join(__dirname, '..', 'js', 'onboarding.js');
  assert(fs.existsSync(file), 'A readable onboarding module must replace the quiz');
  return require(file);
}

function fixture() {
  const elements = new Map(), listeners = new Map(), calls = [];
  const doc = {
    activeElement: null,
    getElementById: id => elements.get(id),
    createElement: tag => element('', tag)
  };
  function element(id, tag = 'div') {
    const classes = new Set(), attrs = new Map();
    const node = {
      id, tagName: tag.toUpperCase(), children: [], dataset: {}, disabled: false,
      textContent: '', innerHTML: '', tabIndex: 0,
      classList: {
        add: value => classes.add(value), remove: value => classes.delete(value),
        contains: value => classes.has(value),
        toggle(value, on) { on ? classes.add(value) : classes.delete(value); }
      },
      set className(value) { classes.clear(); value.split(' ').filter(Boolean).forEach(c => classes.add(c)); },
      setAttribute: (name, value) => attrs.set(name, String(value)),
      getAttribute: name => attrs.get(name) ?? null,
      appendChild(child) { child.parentElement = node; node.children.push(child); return child; },
      append(...children) { children.forEach(child => node.appendChild(child)); },
      replaceChildren(...children) {
        node.children.forEach(child => { child.parentElement = null; });
        node.children = [];
        node.append(...children);
      },
      contains(child) { return child === node || node.children.some(c => c.contains(child)); },
      focus() { doc.activeElement = node; },
      scrollIntoView() {},
      click() { if (!node.disabled) node.onclick?.(); }
    };
    if (id) elements.set(id, node);
    return node;
  }
  for (const id of ['scr-starters', 'starter-title', 'starter-subtitle', 'starter-help',
    'starter-gens', 'starter-panel', 'starter-region',
    'starter-grid', 'starter-info', 'starter-ok']) element(id, id === 'starter-ok' ? 'button' : 'div');
  elements.get('scr-starters').classList.add('hidden');
  const host = { document: doc, addEventListener: (type, handler) => listeners.set(type, handler) };
  const game = {
    T: value => value,
    I18n: { add() {} },
    DEX_BY: Object.fromEntries(expected.flat().map(dex => [dex, {
      dex, name: dex === 25 ? 'Pikachu' : 'Pokemon ' + dex, types: ['grass']
    }])),
    Gacha: { BANNERS: expected.map((_, i) => ({ gen: i + 1, name: 'Region ' + (i + 1) })) },
    TestUI: { init() { throw new Error('Quiz init must not run'); }, start() { throw new Error('Quiz must not run'); } },
    UI: {
      spriteCanvas: () => element('', 'canvas'),
      typeChips: types => types.join(','),
      chrome: value => calls.push(['chrome', value]),
      show(id) { elements.get(id).classList.remove('hidden'); calls.push(['show', id]); },
      toast: message => calls.push(['toast', message])
    },
    DB: {
      save: { owned: {}, coins: 42, personality: { legacy: true } },
      grant(dex, from) { this.save.owned[dex] = { from }; calls.push(['grant', dex, from]); },
      commit() { calls.push(['commit']); return true; }
    },
    Flow: {
      goMenu() { elements.get('scr-starters').classList.add('hidden'); calls.push(['menu']); },
      afterLogin() { game.DB.save.partner ? this.goMenu() : game.TestUI.start(); }
    }
  };
  load().install(game, host);
  game.TestUI.init();
  function key(code, target = doc.activeElement, extra = {}) {
    const event = {
      code, key: code, target, prevented: false, stopped: false,
      preventDefault() { this.prevented = true; },
      stopImmediatePropagation() { this.stopped = true; }, ...extra
    };
    listeners.get('keydown')?.(event);
    return event;
  }
  return {
    game, host, calls, key, elements,
    tabs: () => elements.get('starter-gens').children,
    cards: () => elements.get('starter-grid').children,
    ok: elements.get('starter-ok')
  };
}

test('nine regions contain exactly the traditional starters plus Kanto Pikachu', () => {
  const { REGIONS } = load();
  assert.deepEqual(REGIONS.map(region => [...region.starters]), expected);
  assert.deepEqual(REGIONS.map(region => region.gen), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(new Set(REGIONS.flatMap(region => region.starters)).size, 28);
});

test('new accounts and guests enter Kanto without quiz initialization or save writes', () => {
  for (const guest of [false, true]) {
    const f = fixture();
    f.game.DB.save.guest = guest;
    f.game.Flow.afterLogin();
    assert.equal(f.tabs().length, 9);
    assert.equal(f.tabs()[0].getAttribute('aria-selected'), 'true');
    assert.equal(f.cards().length, 4);
    assert(f.ok.disabled);
    assert(f.calls.some(call => call[0] === 'show' && call[1] === 'scr-starters'));
    assert(!f.calls.some(call => ['grant', 'commit', 'menu'].includes(call[0])));
  }
});

test('selection is explicit and confirmation grants the chosen normal Pokemon exactly once', () => {
  const f = fixture();
  f.game.Flow.afterLogin();
  f.cards()[3].click();
  assert(!f.ok.disabled);
  assert.equal(f.cards()[3].getAttribute('aria-pressed'), 'true');
  assert.match(f.elements.get('starter-info').textContent, /Pikachu/);
  assert(!f.calls.some(call => call[0] === 'grant'));
  f.ok.click();
  f.ok.onclick();
  assert.deepEqual(f.calls.filter(call => ['grant', 'commit', 'menu'].includes(call[0])),
    [['grant', 25, 'starter'], ['commit'], ['menu']]);
  assert.equal(f.game.DB.save.partner, 25);
  assert.equal(f.game.DB.save.starter, 25);
  assert.equal(f.game.DB.save.coins, 42);
  assert.deepEqual(f.game.DB.save.personality, { legacy: true });
  assert.deepEqual(Object.keys(f.game.DB.save.owned), ['25']);
});

test('changing region clears hidden selections and stale cards cannot grant a Pokemon', () => {
  const f = fixture();
  f.game.TestUI.start();
  const oldCard = f.cards()[3];
  oldCard.click();
  f.tabs()[8].click();
  assert(f.ok.disabled);
  assert.equal(f.cards().length, 3);
  assert.equal(f.tabs()[8].getAttribute('aria-selected'), 'true');
  assert.equal(f.elements.get('starter-panel').getAttribute('aria-labelledby'), f.tabs()[8].id);
  oldCard.click();
  assert(f.ok.disabled);
  assert(f.calls.some(call => call[0] === 'toast'));
  f.cards()[2].click();
  f.ok.click();
  assert.equal(f.game.DB.save.partner, 912);
});

test('returning accounts keep their existing partner and never get another starter', () => {
  const f = fixture();
  f.game.DB.save.partner = 54;
  f.game.DB.save.owned = { 54: { from: 'legacy' } };
  f.game.Flow.afterLogin();
  assert.deepEqual(f.calls, [['menu']]);
  assert.equal(f.game.DB.save.partner, 54);
});

test('switching accounts cannot confirm a previous accounts selection', () => {
  const f = fixture();
  f.game.TestUI.start();
  f.cards()[3].click();
  f.game.DB.save = { owned: {}, coins: 100 };
  f.ok.click();
  assert(!f.calls.some(call => call[0] === 'grant'));
  assert(f.calls.some(call => call[0] === 'toast'));
  f.game.TestUI.start();
  assert(f.ok.disabled);
  assert.equal(f.tabs()[0].getAttribute('aria-selected'), 'true');
});

test('a failed account save stays on the picker and retries without granting twice', () => {
  const f = fixture();
  f.game.TestUI.start();
  f.cards()[3].click();
  f.game.DB.commit = () => { f.calls.push(['commit']); return false; };
  f.ok.click();
  assert(!f.calls.some(call => call[0] === 'menu'));
  assert(f.calls.some(call => call[0] === 'toast' && /guardar/.test(call[1])));
  assert(!f.ok.disabled, 'The same save can be retried');
  assert(f.tabs().every(button => button.disabled));
  assert(f.cards().every(button => button.disabled));
  f.game.DB.commit = () => { f.calls.push(['commit']); return true; };
  f.ok.click();
  assert.deepEqual(f.calls.filter(call => ['grant', 'commit', 'menu'].includes(call[0])),
    [['grant', 25, 'starter'], ['commit'], ['commit'], ['menu']]);
});

test('guest selection reaches town even though guests do not persist progress', () => {
  const f = fixture();
  f.game.DB.guest = true;
  f.game.DB.commit = () => false;
  f.game.TestUI.start();
  f.cards()[0].click();
  f.ok.click();
  assert.equal(f.game.DB.save.partner, 1);
  assert(f.calls.some(call => call[0] === 'menu'));
});

test('keyboard tabs and cards have predictable arrow navigation and native activation', () => {
  const f = fixture();
  f.game.TestUI.start();
  assert.equal(f.host.document.activeElement, f.tabs()[0]);
  assert(f.key('ArrowRight').prevented);
  assert.equal(f.host.document.activeElement, f.tabs()[1]);
  assert.equal(f.tabs()[1].getAttribute('aria-selected'), 'true');
  f.key('End');
  assert.equal(f.host.document.activeElement, f.tabs()[8]);
  f.key('Home');
  assert.equal(f.host.document.activeElement, f.tabs()[0]);
  f.key('ArrowDown');
  assert.equal(f.host.document.activeElement, f.cards()[0]);
  f.key('ArrowRight');
  assert.equal(f.host.document.activeElement, f.cards()[1]);
  assert(f.ok.disabled, 'Focus is not selection');
  assert(!f.key('Enter').prevented, 'Native button activation must be retained');
  assert(!f.key('Space').prevented, 'Native button activation must be retained');
  f.cards()[1].click();
  f.key('ArrowDown');
  assert.equal(f.host.document.activeElement, f.ok);
  assert(!f.key('Tab').prevented);
  assert(f.key('Tab').stopped, 'Global game shortcuts must not consume browser Tab');
  assert(f.key('Escape').prevented);
});

test('onboarding keyboard handlers leave other screens and modifier shortcuts alone', () => {
  const f = fixture();
  assert(!f.key('ArrowRight', f.tabs()[0]).stopped);
  f.game.TestUI.start();
  assert(!f.key('ArrowRight', f.tabs()[0], { ctrlKey: true }).stopped);
  f.cards()[0].click();
  f.ok.click();
  assert(!f.key('Escape').stopped);
});

test('browser installation composes training and town before replacing quiz init', () => {
  const order = [];
  const f = fixture();
  const host = {
    PSTraining: { install(context) { order.push('training-town'); assert.equal(context, f.game); return 'installed'; } }
  };
  const context = vm.createContext({ window: host });
  vm.runInContext(fs.readFileSync(require.resolve('../js/onboarding.js'), 'utf8'), context);
  host.PSOnboarding.install = () => { throw new Error('The installer must use its lexical API'); };
  // The actual browser wrapper needs a document, while the pure API remains injectable.
  host.document = f.host.document;
  host.addEventListener = f.host.addEventListener;
  assert.equal(host.PSTraining.install(f.game), 'installed');
  assert.deepEqual(order, ['training-town']);
  f.game.TestUI.init();
});

test('both entry pages and offline cache load the picker before the game engine', () => {
  for (const file of ['index.html', 'en\\index.html']) {
    const source = fs.readFileSync(require('node:path').join(__dirname, '..', file), 'utf8');
    assert.match(source, /id="starter-gens"[^>]*role="tablist"/);
    assert.match(source, /id="starter-panel"[^>]*role="tabpanel"/);
    for (const id of ['test', 'result']) {
      assert.match(source, new RegExp('<section id="scr-' + id + '" class="scr hidden" aria-hidden="true"></section>'),
        'The native screen registry requires an empty hidden ' + id + ' container');
    }
    assert(!/id="(?:test-q|test-a|res-trait|res-ok|res-other)"/.test(source));
    assert(!/id="starter-back"/.test(source));
    assert(source.indexOf('js/town.js') < source.indexOf('js/onboarding.js'));
    assert(source.indexOf('js/onboarding.js') < source.indexOf('js/app.min.js'));
    const worker = fs.readFileSync(require.resolve('../sw.js'), 'utf8');
    for (const asset of source.matchAll(/(?:src|href)="((?:js\/(?:onboarding|app\.min)|css\/style)[^"]+)"/g)) {
      assert(worker.includes(asset[1]), 'Precache must include ' + asset[1]);
    }
  }
  assert.match(fs.readFileSync(require.resolve('../js/boot.js'), 'utf8'), /onboarding/);
});
