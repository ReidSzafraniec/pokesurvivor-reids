const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const data = require('../js/data/learnsets.js');
const { create } = require('../js/training.js');
const training = create(data);
const saveFor = (...ids) => ({
  owned: Object.fromEntries(ids.map(id => [id, { at: 1, from: 'test' }])),
  shiny: {}, ptm: {}, partner: ids[0], starter: ids[0], partnerShiny: false
});
function atLevel(model, save, dex, level) {
  model.state(save, dex);
  save.training[dex].xp = model.xpAt(dex, level);
}

test('canonical ancestry covers every species, including later-generation babies', () => {
  for (const [dex, mon] of Object.entries(data.pokemon)) {
    assert.equal(training.isBase(dex), mon.prevo === 0);
    if (mon.prevo) assert(data.pokemon[mon.prevo]);
    const visited = new Set([+dex]);
    for (let parent = mon.prevo; parent; parent = data.pokemon[parent].prevo) {
      assert(!visited.has(parent));
      visited.add(parent);
    }
    assert(mon.evolutions.length <= 1, 'Unconditional evolutions must be unambiguous');
    for (const [target, level] of mon.evolutions) {
      assert.equal(data.pokemon[target].prevo, +dex);
      assert(Number.isInteger(level) && level > 1 && level <= 100);
    }
  }
  assert.equal(training.baseOf(26), 172);
  assert.equal(training.baseOf(106), 236);
  assert.equal(training.baseOf(35), 173);
  assert.equal(training.baseOf(149), 147);
});

test('official levels include early cocoons, starters, late dragons and all nine generations', () => {
  const expected = {
    1: [2, 16], 2: [3, 32], 4: [5, 16], 5: [6, 36], 7: [8, 16], 8: [9, 36],
    10: [11, 7], 11: [12, 10], 52: [53, 28], 129: [130, 20], 147: [148, 30], 148: [149, 55],
    152: [153, 16], 252: [253, 16], 387: [388, 18], 495: [496, 17],
    650: [651, 16], 722: [723, 17], 810: [811, 16], 885: [886, 50],
    886: [887, 60], 906: [907, 16], 907: [908, 36]
  };
  for (const [dex, evolution] of Object.entries(expected)) {
    assert.deepEqual(data.pokemon[dex].evolutions, [evolution]);
  }
  for (const dex of [25, 133, 42, 64, 95, 236, 265, 744, 790, 848, 83, 122, 206]) {
    assert.deepEqual(data.pokemon[dex].evolutions, [], 'Special conditions are not invented: ' + dex);
  }
});

test('every supported evolution triggers at its exact XP threshold, never one XP early', () => {
  for (const [dex, mon] of Object.entries(data.pokemon)) {
    for (const [target, level] of mon.evolutions) {
      const save = saveFor(+dex), threshold = training.xpAt(dex, level);
      training.state(save, dex);
      save.training[dex].xp = threshold - 1;
      assert.equal(training.pendingEvolution(save, dex), null);
      const result = training.award(save, dex, { time: 2, kills: 0, bosses: 0 });
      assert.deepEqual(result.evolution, { dex: +dex, target, minimum: level, level });
    }
  }
});

test('stopping survives reloads and retries at the next exact level, not the next match', () => {
  let save = saveFor(4);
  atLevel(training, save, 4, 16);
  training.cancelEvolution(save, 4);
  save = JSON.parse(JSON.stringify(save));
  assert.equal(training.pendingEvolution(save, 4), null);
  assert.equal(training.award(save, 4, { time: 0, kills: 0, bosses: 0 }).evolution, null);
  assert.equal(training.award(save, 4, { time: 2, kills: 0, bosses: 0 }).evolution, null);
  save.training[4].xp = training.xpAt(4, 17) - 1;
  assert.equal(training.pendingEvolution(save, 4), null);
  assert.equal(training.award(save, 4, { time: 2, kills: 0, bosses: 0 }).evolution.level, 17);
  training.cancelEvolution(save, 4);
  assert.equal(training.pendingEvolution(save, 4), null);
  assert.throws(() => training.evolve(save, 4, 5), RangeError);
});

test('evolution replaces the source and transfers XP, moves, shinies and purchased progress', () => {
  const save = saveFor(4);
  atLevel(training, save, 4, 16);
  save.training[4].xp += 13;
  training.setLoadout(save, 4, ['ember', 'dragon-breath'], 20);
  save.shiny[4] = { at: 10 };
  save.partnerShiny = true;
  save.pupg = { 4: { hp: 3, dmg: 2 } };
  save.pnat = { 4: ['adamant', 15] };
  save.pabil = { 4: [2, 15] };
  save.dfav = { 4: 1 };
  save.pused = { 4: 12 };
  save.profile = { favs: [4, 5] };
  save.ptm[4] = ['flamethrower'];
  const before = training.state(save, 4), result = training.evolve(save, 4, 5, 100);
  assert.equal(result.after.level, 16);
  assert.equal(result.after.xp, before.xp);
  assert.equal(save.partner, 5);
  assert.equal(save.starter, 5);
  assert(save.partnerShiny);
  assert.deepEqual(save.training[5].loadout, before.loadout);
  assert.deepEqual(save.pupg[5], { hp: 3, dmg: 2 });
  assert.deepEqual(save.pnat[5], ['adamant', 100]);
  assert.deepEqual(save.pabil[5], [2, 100]);
  assert.equal(save.pused[5], 12);
  assert.deepEqual(save.profile.favs, [5]);
  assert(training.available(save, 5).includes('flamethrower'));
  for (const key of ['owned', 'training', 'shiny', 'pupg', 'pnat', 'pabil', 'ptm', 'dfav', 'pused']) {
    assert(!Object.hasOwn(save[key], 4), key + ' retained the source');
  }
  assert.equal(save.rvk.owned[4], 100);
  assert.equal(save.rvk.shiny[4], 100);
  assert(save.owned[5] && save.shiny[5]);
  assert.throws(() => training.evolve(save, 4, 5), RangeError);
});

test('retained pre-evolution attacks remain legal across multiple stages', () => {
  const save = saveFor(13);
  atLevel(training, save, 13, 7);
  training.setLoadout(save, 13, ['poison-sting']);
  training.evolve(save, 13, 14, 100);
  assert.deepEqual(training.state(save, 14).loadout, ['poison-sting']);
  assert(training.available(save, 14).includes('poison-sting'));
  assert(!training.available(save, 14).includes('struggle'));
  atLevel(training, save, 14, 10);
  training.evolve(save, 14, 15, 200);
  const reloaded = JSON.parse(JSON.stringify(save));
  training.normalize(reloaded);
  assert.deepEqual(training.state(reloaded, 15).loadout, ['poison-sting']);
  reloaded.training[15].inherited.push('hydro-pump', 'not-a-move');
  training.normalize(reloaded);
  assert(!training.available(reloaded, 15).includes('hydro-pump'));
});

test('multi-level awards permit chained evolutions, but stopping checks the attained level', () => {
  const save = saveFor(4);
  atLevel(training, save, 4, 40);
  assert.equal(training.pendingEvolution(save, 4).level, 40);
  training.evolve(save, 4, 5, 100);
  assert.equal(training.pendingEvolution(save, 5).minimum, 36);
  training.evolve(save, 5, 6, 200);
  assert.equal(training.pendingEvolution(save, 6), null);
  assert.equal(training.state(save, 6).level, 40);
  const stopped = saveFor(4);
  atLevel(training, stopped, 4, 40);
  training.cancelEvolution(stopped, 4);
  assert.equal(training.pendingEvolution(stopped, 4), null);
  atLevel(training, stopped, 4, 41);
  assert.equal(training.pendingEvolution(stopped, 4).level, 41);
});

test('existing evolved progress never loses levels or upgrades; other Pokemon stay untouched', () => {
  const save = saveFor(4, 5, 7);
  atLevel(training, save, 4, 16);
  atLevel(training, save, 5, 50);
  save.pupg = { 4: { hp: 2 }, 5: { hp: 5, dmg: 1 } };
  const water = JSON.stringify(training.state(save, 7));
  training.evolve(save, 4, 5, 100);
  assert.equal(training.state(save, 5).level, 50);
  assert.deepEqual(save.pupg[5], { hp: 5, dmg: 1 });
  assert.equal(JSON.stringify(training.state(save, 7)), water);
});

test('maximum-level cancellation cannot re-prompt without a new level', () => {
  const save = saveFor(4);
  atLevel(training, save, 4, 100);
  training.cancelEvolution(save, 4);
  assert.equal(training.award(save, 4, { time: 100, kills: 100, bosses: 1 }).evolution, null);
});

function bundledGacha(createModel = create) {
  const source = fs.readFileSync(require.resolve('../js/app.min.js'), 'utf8');
  const model = createModel(data);
  const context = {
    _0x599208: {
      DEX: Object.keys(data.pokemon).map(Number).map(dex => ({
        dex, gen: [151, 251, 386, 493, 649, 721, 809, 905, 1025].findIndex(max => dex <= max) + 1,
        types: ['ghost'], rarity: dex % 5 + 1, bst: dex,
        hp: 100, pa: 1, sa: 1, atk: 1, df: 75, sd: 75, spd: 100
      })),
      SPRITE_META: Object.fromEntries(Object.keys(data.pokemon).map(id => [id, {}])),
      Sprites: { hasShiny: () => true }, Halloween: { on: true },
      U: { pick: list => list[Math.floor(Math.random() * list.length)], pickN: () => [] },
      Moves: { BY_ID: Object.fromEntries(Object.keys(data.moves).map(id => [id, {}])) },
      Mons: {}, I18n: { add() {} }, DB: { onSync(callback) { this.notify = callback; } },
      Upgrades: { LIST: [], perks() {} }, LevelUp: {},
      Progress: { event() {}, checkAch() {} },
      RunUI: { showOver(details, done) {
        context._0x599208.UI.show('scr-over');
        context._0x599208.UI.$?.('over-stats').replaceChildren();
        if (context._0x599208.UI.$) context._0x599208.UI.$('btn-again').onclick = done;
      } },
      UI: {
        refreshCoins() {},
        show(id) {
          this.screen = id;
          this.hideAll();
          this.$?.(id).classList.remove('hidden');
        },
        hideAll() {
          for (const id of ['scr-over', 'scr-evolution', 'scr-menu']) this.$?.(id).classList.add('hidden');
        }
      },
      MenuUI: { init() {}, open() {} }, Flow: {}
    }
  };
  vm.createContext(context);
  const bootstrap = source.slice(0, source.indexOf('const a0_0xc9496a=')) +
    source.slice(source.lastIndexOf('function a0_0x48f4()'));
  vm.runInContext(bootstrap, context, { timeout: 3000 });
  context._0x48be02 = context.a0_0x422d;
  const game = context._0x599208;
  game.DEX_BY = Object.fromEntries(game.DEX.map(mon => [mon.dex, mon]));
  const natureStart = source.indexOf("_0x599208['NATURES']="),
    natureEnd = source.indexOf('_0x599208[_0x48be02(0x5e2)]', natureStart);
  vm.runInContext(source.slice(natureStart, natureEnd), context, { timeout: 3000 });
  const statsStart = source.indexOf("_0x599208['Stats']="),
    statsEnd = source.indexOf(",_0x599208['AbilityFX']=", statsStart);
  vm.runInContext(source.slice(statsStart, statsEnd), context, { timeout: 3000 });
  const upgradesStart = source.indexOf("_0x599208['Upgrades']="),
    upgradesEnd = source.indexOf(",_0x599208['Items']=", upgradesStart);
  vm.runInContext(source.slice(upgradesStart, upgradesEnd), context, { timeout: 3000 });
  const module = source.match(/_0x599208\['Gacha'\]=.*?(?=,_0x599208\['Interact'\]=)/)[0];
  vm.runInContext(module, context, { timeout: 3000 });
  model.install(context._0x599208);
  return { model, game: context._0x599208, runtime: context };
}

test('the actual bundled gacha excludes evolutions in every rarity, featured list and banner', () => {
  const { model, game } = bundledGacha();
  for (let banner = 1; banner <= 10; banner++) {
    for (let rarity = 1; rarity <= 5; rarity++) {
      for (const mon of game.Gacha.pool(rarity, banner)) {
        assert(model.isBase(mon.dex));
        assert.equal(mon.rarity, rarity);
      }
    }
    assert(game.Gacha.featured(banner).every(dex => model.isBase(dex)));
    const save = { ...saveFor(), coins: 0, tickets: { t1: 10000, t10: 10000 }, stats: {} };
    for (const [count, ticket] of [[1, 't1'], [10, 't1'], [10, 't10'], [100, 't1'], [100, 't10']]) {
      const results = game.Gacha.pull(save, count, banner, ticket);
      assert.equal(results.length, count);
      assert(results.every(result => model.isBase(result.dex)));
      assert(results.every(result => Number.isInteger(result.refund)));
    }
    assert.equal(save.stats.pulls, 221);
  }
});

test('rarity fallback and guaranteed shinies cannot award evolved species', () => {
  const { model, game } = bundledGacha();
  game.DEX = game.DEX.filter(mon => mon.gen === 1 && mon.rarity === 1);
  const save = { ...saveFor(), coins: 0, tickets: { t1: 100, t10: 0 }, stats: {}, pity: { 1: 69 } };
  game.Gacha.debugForceShiny(10);
  const results = game.Gacha.pull(save, 10, 1);
  assert(results.every(result => model.isBase(result.dex)));
  assert(results.some(result => result.shiny));
  assert(!model.isBase(25));
  assert(!game.Gacha.pool(1, 1).some(mon => mon.dex === 25));
});

test('empty epic tiers upgrade the ten-pull guarantee and publish accurate effective odds', () => {
  const { model, game, runtime } = bundledGacha();
  game.DEX = game.DEX.filter(mon => mon.rarity !== 4);
  const rates = new Map(model.gachaRates(1));
  assert.equal(rates.get(4), 0);
  assert.equal(rates.get(5), 8);
  assert.equal([...rates.values()].reduce((sum, rate) => sum + rate), 100);
  vm.runInContext('Math.random = () => 0', runtime);
  const save = { ...saveFor(), coins: 0, tickets: { t1: 100, t10: 0 }, stats: {} };
  const results = game.Gacha.pull(save, 10, 1);
  assert.equal(results[9].rarity, 5);
  assert(results.every(result => model.isBase(result.dex)));
  assert.equal(save.tickets.t1, 90);
});

test('base-family banner completion and shiny bonuses survive evolution', () => {
  const { model, game } = bundledGacha();
  const save = saveFor(...game.DEX.filter(mon => model.gachaEligible(mon, 1)).map(mon => mon.dex));
  save.shiny[4] = { at: 1 };
  atLevel(model, save, 4, 16);
  const before = game.Gacha.dexOf(save, 1);
  assert.equal(before.have, before.total);
  assert(game.Gacha.hasIris(save, 1));
  model.evolve(save, 4, 5, 100);
  assert.deepEqual(game.Gacha.dexOf(save, 1), before);
  assert.equal(game.Gacha.shinyRate(save, 1), 0.02);
});

test('cloud training merges preserve cancellation and reject retired progress after recapture', () => {
  const left = saveFor(4);
  atLevel(training, left, 4, 16);
  const right = JSON.parse(JSON.stringify(left));
  training.cancelEvolution(right, 4);
  const combined = training.merge(saveFor(4), left, right);
  assert.equal(training.pendingEvolution(combined, 4), null);
  assert.deepEqual(combined.training, training.merge(saveFor(4), right, left).training);
  training.evolve(left, 4, 5, 100);
  left.owned[4] = { at: 101, from: 'gacha' };
  right.pupg = { 4: { hp: 8 } };
  right.ptm[4] = ['flamethrower'];
  const target = JSON.parse(JSON.stringify(left));
  training.merge(target, left, right);
  assert.equal(training.state(target, 4).level, 1);
  assert.equal(training.state(target, 5).level, 16);
  assert(!target.pupg[4]);
  assert(!target.ptm[4]);
  target.owned[4].at = 99;
  training.normalize(target);
  assert(!target.owned[4]);
  assert(!target.training[4]);
});

function animationFixture() {
  const elements = new Map(), timers = new Map();
  let nextTimer = 1;
  function element(id) {
    const classes = new Set(['hidden']);
    const attributes = new Map();
    return {
      get id() { return id; },
      set id(value) { id = value; elements.set(value, this); },
      children: [],
      classList: {
        add: value => classes.add(value), remove: value => classes.delete(value),
        contains: value => classes.has(value),
        toggle(value, on) { on ? classes.add(value) : classes.delete(value); }
      },
      append(...children) { this.children.push(...children); },
      prepend(...children) { this.children.unshift(...children); },
      replaceChildren(...children) { this.children = children; },
      insertAdjacentHTML() {},
      setAttribute(name, value) { attributes.set(name, String(value)); },
      getAttribute(name) { return attributes.get(name); },
      focus() { document.activeElement = this; }
    };
  }
  const document = {
    activeElement: null,
    querySelector: selector => selector === '#scr-lobby .box' ? document.getElementById('lobby-box') : null,
    createElement: () => element(),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, element(id));
      return elements.get(id);
    }
  };
  const context = {
    module: { exports: {} }, document, window: { matchMedia: () => ({ matches: false }) },
    Option: function (text, value) { this.text = text; this.value = value; },
    setTimeout(callback) { const id = nextTimer++; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/training.js'), 'utf8'), context);
  const fixture = bundledGacha(context.module.exports.create), { model, game } = fixture;
  game.DEX_BY = Object.fromEntries(game.DEX.map(mon => [mon.dex, { ...mon, name: 'Pokemon ' + mon.dex }]));
  game.DB.save = saveFor(4);
  game.DB.commit = () => true;
  game.T = value => value;
  game.Settings = { get: () => false };
  game.Audio = { sfx() {} };
  game.Game = { state: 'over' };
  game.U.esc = String;
  game.Icons = { html: () => '' };
  game.Social = { room: null };
  game.Skins = { worn: () => null };
  game.Shop = { count: id => game.DB.save.bag?.[id] || 0 };
  game.AbilityFX = { of: () => ({ d: 'Ability effect' }) };
  game.UI.sprite = () => {};
  game.UI.$ = id => document.getElementById(id);
  game.UI.isOpen = id => game.UI.screen === id;
  game.UI.toast = () => assert.fail('Unexpected evolution warning');
  atLevel(model, game.DB.save, 4, 16);
  return { ...fixture, document, timers };
}

test('unified Training keeps selection across keyboard tabs and displays level-grown stats', () => {
  const { model, game, document } = animationFixture();
  game.Game.state = 'ui';
  game.DB.save.coins = 1000;
  game.MenuUI.init();
  model.open(4);
  const moves = document.getElementById('training-tab-moves'),
    perks = document.getElementById('training-tab-perks');
  assert.equal(moves.getAttribute('aria-selected'), 'true');
  assert.equal(perks.getAttribute('aria-selected'), 'false');
  perks.onclick();
  assert.equal(perks.getAttribute('aria-selected'), 'true');
  assert.equal(document.getElementById('training-mon').value, 4);
  assert(document.getElementById('training-panel-moves').classList.contains('hidden'));
  assert(!document.getElementById('training-panel-perks').classList.contains('hidden'));
  assert.match(document.getElementById('training-stats').innerHTML, /HP/);
  assert.match(document.getElementById('training-coins').textContent, /1,?000/);
  const rows = document.getElementById('training-perks').children;
  assert.equal(rows.length, 8);
  assert.match(document.getElementById('training-perk-spd').textContent, /70/);
  document.getElementById('training-perk-spd').onclick();
  assert.equal(game.DB.save.coins, 930);
  assert.equal(game.DB.save.pupg[4].spd, 1);
  assert.match(document.getElementById('training-perk-spd').textContent, /100/);
  assert.match(document.getElementById('training-perk-xp').textContent, /100/);
  document.getElementById('training-perk-xp').onclick();
  assert.equal(game.DB.save.coins, 830);
  assert.equal(game.DB.save.pupg[4].xp, 1);
  assert.equal(perks.getAttribute('aria-selected'), 'true');
  let prevented = false;
  perks.onkeydown({ key: 'Home', preventDefault() { prevented = true; } });
  assert(prevented);
  assert.equal(document.activeElement, moves);
  assert.equal(moves.getAttribute('aria-selected'), 'true');
  game.Flow.play();
  assert.equal(moves.getAttribute('aria-selected'), 'true');
  assert.equal(document.getElementById('training-mon').disabled, true);
  assert(!document.getElementById('training-play').classList.contains('hidden'));
});

test('Training refreshes unavailable selection on sync and legacy upgrades open the same page', () => {
  const { model, game, document } = animationFixture();
  game.Game.state = 'ui';
  game.MenuUI.init();
  game.DB.save.owned[7] = { at: 1 };
  game.DB.save.partner = 7;
  model.open(4);
  delete game.DB.save.owned[4];
  game.DB.notify();
  assert.equal(document.getElementById('training-mon').value, 7);
  game.UI.show('scr-upgrades', true);
  assert.equal(game.UI.screen, 'scr-training');
  assert.equal(document.getElementById('training-tab-perks').getAttribute('aria-selected'), 'true');
});

test('Training returns to the cooperative lobby only when opened from that lobby', () => {
  const { model, game, document } = animationFixture();
  game.Game.state = 'ui';
  game.Social.room = {};
  let lobby = 0, menu = 0;
  game.LobbyUI = { open() { lobby++; } };
  game.MenuUI.open = () => { menu++; };
  game.MenuUI.init();
  game.UI.screen = 'scr-lobby';
  model.open(4);
  document.getElementById('training-back').onclick();
  assert.equal(lobby, 1);
  assert.equal(menu, 0);
  game.UI.screen = 'scr-menu';
  model.open(4);
  document.getElementById('training-back').onclick();
  assert.equal(lobby, 1);
  assert.equal(menu, 1);
});

test('evolution recalculates grown stats from the evolved species and preserves utility ranks and nature', () => {
  const { model, game } = animationFixture();
  const save = game.DB.save;
  Object.assign(game.DEX_BY[5], { hp: 140, df: 90 });
  save.pupg = { 4: { xp: 3, crit: 2, hp: 10 } };
  game.Mons.setNature(4, 'hasty');
  const before = model.statsFor(4);
  model.evolve(save, 4, 5, 100);
  const after = model.statsFor(5), factor = 1 + 0.5 * (16 - 1) / 99;
  assert.equal(model.state(save, 5).level, 16);
  assert.equal(after.hp, game.DEX_BY[5].hp * factor);
  assert.equal(after.df, game.DEX_BY[5].df * 0.9 * factor);
  assert(after.hp > before.hp);
  assert.equal(game.Mons.natureOf(5).id, 'hasty');
  assert.equal(model.learningMultiplier(save, 5), 1.15);
  assert.equal(game.Upgrades.perks(save.pupg[5]).hp, 0);
  assert.equal(game.Upgrades.perks(save.pupg[5]).crit, 0.06);
});

test('both game pages expose one Training destination and matching accessible tab panels', () => {
  for (const page of ['../index.html', '../en/index.html']) {
    const source = fs.readFileSync(require.resolve(page), 'utf8');
    assert(!source.includes('data-go="upgrades"'));
    for (const id of ['training-stats', 'training-nature', 'training-ability',
      'training-tab-moves', 'training-tab-perks', 'training-panel-moves', 'training-panel-perks']) {
      assert(source.includes('id="' + id + '"'), page + ': ' + id);
    }
    assert(source.includes('role="tablist"'));
    assert(source.includes('aria-controls="training-panel-perks"'));
    assert(source.includes('aria-labelledby="training-tab-moves"'));
  }
});

test('eligible Pokemon do not trigger evolution from menus, training or match preparation', () => {
  const { model, game, timers } = animationFixture();
  game.Game.state = 'ui';
  assert(model.pendingEvolution(game.DB.save, 4));
  game.MenuUI.open();
  assert.equal(timers.size, 0);
  model.open(4);
  assert.equal(game.UI.screen, 'scr-training');
  game.Flow.play();
  assert.equal(game.UI.screen, 'scr-training');
  assert.equal(timers.size, 0);
  assert(game.DB.save.owned[4]);
  assert.throws(() => model.openEvolution(4, () => {}), /only available on the match XP results screen/);
});

for (const [description, level, time, evolves] of [
  ['crossing the evolution level', 15, 2, true],
  ['already eligible without XP', 16, 0, false],
  ['already eligible with XP but no new level', 16, 2, false],
  ['no level-up below the threshold', 15, 0, false]
]) {
  test('results-screen evolution: ' + description, () => {
    const { model, game, document, timers } = animationFixture();
    atLevel(model, game.DB.save, 4, level);
    if (level === 15) game.DB.save.training[4].xp = model.xpAt(4, 16) - 1;
    const player = { dex: 4, kills: 0, bosses: 0, addMove() {} };
    game.Game.player = player;
    model.preparePlayer(player);
    game.Progress.event('runEnd', { time });
    game.RunUI.showOver();
    assert.equal(game.UI.screen, 'scr-over');
    assert.equal(timers.size, 0);
    assert.equal(document.getElementById('over-stats').children.length, 0);
    document.getElementById('btn-again').onclick();
    assert.equal(game.UI.screen, 'scr-progress');
    assert.equal(timers.size, 0);
    if (evolves) {
      document.getElementById('progress-next').onclick();
      assert.equal(game.UI.screen, 'scr-evolution');
      assert.equal(timers.size, 1);
    }
    assert(game.DB.save.owned[4]);
  });
}

test('run results and permanent progress can be revisited without awarding XP again', () => {
  const { model, game, document } = animationFixture();
  atLevel(model, game.DB.save, 4, 1);
  const player = { dex: 4, kills: 13, bosses: 0, addMove() {} };
  game.Game.player = player;
  model.preparePlayer(player);
  game.Progress.event('runEnd', { time: 40 });
  const xp = model.state(game.DB.save, 4).xp;
  let exits = 0;
  game.RunUI.showOver({}, () => { exits++; });
  assert.equal(document.getElementById('btn-again').textContent, 'Continuar a XP permanente');
  document.getElementById('btn-again').onclick();
  assert.equal(game.UI.screen, 'scr-progress');
  assert.equal(document.activeElement.id, 'progress-title');
  assert.match(document.getElementById('progress-reward').textContent, /^\+\d+ XP$/);
  assert.match(document.getElementById('progress-level').textContent, /1.*2/);
  assert.match(document.getElementById('progress-summary').innerHTML, /value="/);
  document.getElementById('progress-back').onclick();
  assert.equal(game.UI.screen, 'scr-over');
  assert.equal(document.getElementById('scr-progress').classList.contains('hidden'), true);
  assert.equal(document.activeElement.id, 'btn-again');
  document.getElementById('btn-again').onclick();
  document.getElementById('progress-next').onclick();
  assert.equal(exits, 1);
  assert.equal(model.state(game.DB.save, 4).xp, xp);
});

test('hiding all screens also dismisses permanent results before a new match', () => {
  const { model, game, document } = animationFixture();
  const player = { dex: 4, kills: 0, bosses: 0, addMove() {} };
  game.Game.player = player;
  model.preparePlayer(player);
  game.Progress.event('runEnd', { time: 0 });
  game.RunUI.showOver({}, () => {});
  document.getElementById('btn-again').onclick();
  assert.equal(document.getElementById('scr-progress').classList.contains('hidden'), false);
  game.UI.hideAll();
  assert.equal(document.getElementById('scr-progress').classList.contains('hidden'), true);
});

for (const action of ['btn-again', 'progress-next', 'progress-back']) {
  test('result navigation rejects an account change before ' + action, () => {
    const { model, game, document, timers } = animationFixture();
    atLevel(model, game.DB.save, 4, 15);
    game.DB.save.training[4].xp = model.xpAt(4, 16) - 1;
    const player = { dex: 4, kills: 0, bosses: 0, addMove() {} };
    game.Game.player = player;
    model.preparePlayer(player);
    game.Progress.event('runEnd', { time: 2 });
    game.RunUI.showOver({}, () => assert.fail('Stale result exit callback'));
    if (action !== 'btn-again') document.getElementById('btn-again').onclick();
    const replacement = game.DB.save = saveFor(4);
    atLevel(model, replacement, 4, 16);
    let warnings = 0, menus = 0;
    game.UI.toast = () => { warnings++; };
    game.MenuUI.open = () => { menus++; };
    document.getElementById(action).onclick();
    assert.equal(warnings, 1);
    assert.equal(menus, 1);
    assert.equal(timers.size, 0);
    assert(replacement.owned[4]);
    assert(!replacement.owned[5]);
  });
}

test('newly unlocked moves appear only on permanent progress', () => {
  const { model, game, document } = animationFixture();
  const [move, level] = data.pokemon[4].moves.find(([, level]) => level > 1 && level < 16);
  atLevel(model, game.DB.save, 4, level - 1);
  game.DB.save.training[4].xp = model.xpAt(4, level) - 1;
  const player = { dex: 4, kills: 0, bosses: 0, addMove() {} };
  game.Game.player = player;
  model.preparePlayer(player);
  game.Progress.event('runEnd', { time: 2 });
  game.RunUI.showOver({}, () => {});
  assert.equal(document.getElementById('over-stats').children.length, 0);
  document.getElementById('btn-again').onclick();
  const unlocks = document.getElementById('progress-unlocks');
  assert.equal(unlocks.classList.contains('hidden'), false);
  assert(unlocks.innerHTML.includes(data.moves[move].names.es));
});

for (const cancelled of [false, true]) {
  test('evolution returns to permanent progress after ' + (cancelled ? 'cancellation' : 'completion'), () => {
    const { model, game, document, timers } = animationFixture();
    atLevel(model, game.DB.save, 4, 15);
    game.DB.save.training[4].xp = model.xpAt(4, 16) - 1;
    const player = { dex: 4, kills: 0, bosses: 0, addMove() {} };
    game.Game.player = player;
    model.preparePlayer(player);
    game.Progress.event('runEnd', { time: 2 });
    let exits = 0;
    game.RunUI.showOver({}, () => { exits++; });
    document.getElementById('btn-again').onclick();
    assert.equal(document.getElementById('progress-next').textContent, 'Continuar a evoluci\u00f3n');
    document.getElementById('progress-next').onclick();
    assert.equal(document.getElementById('scr-progress').classList.contains('hidden'), true);
    if (cancelled) document.getElementById('evolution-stop').onclick();
    else [...timers.values()][0]();
    document.getElementById('evolution-continue').onclick();
    assert.equal(game.UI.screen, 'scr-progress');
    assert.equal(timers.size, 0);
    assert.equal(document.getElementById('progress-name').textContent, 'Pokemon ' + (cancelled ? 4 : 5));
    assert.equal(document.getElementById('progress-next').textContent, 'Volver al men\u00fa');
    document.getElementById('progress-back').onclick();
    document.getElementById('btn-again').onclick();
    document.getElementById('progress-next').onclick();
    assert.equal(exits, 1);
  });
}

for (const level of [1, 100]) {
  test('permanent results show zero XP correctly at level ' + level, () => {
    const { model, game, document } = animationFixture();
    atLevel(model, game.DB.save, 4, level);
    const player = { dex: 4, kills: 0, bosses: 0, addMove() {} };
    game.Game.player = player;
    model.preparePlayer(player);
    game.Progress.event('runEnd', { time: 0 });
    game.RunUI.showOver({}, () => {});
    document.getElementById('btn-again').onclick();
    assert.equal(document.getElementById('progress-reward').textContent, '+0 XP');
    assert.equal(document.getElementById('progress-level').textContent, 'Nivel permanente ' + level);
    assert.equal(document.getElementById('progress-next').textContent, 'Volver al men\u00fa');
    assert.equal(document.getElementById('progress-unlocks').classList.contains('hidden'), true);
    if (level === 100) {
      assert.match(document.getElementById('progress-summary').innerHTML, /Nivel m\u00e1ximo/);
    }
  });
}

test('animation stop cancels its timer, retains the source and waits for the next level', () => {
  const { model, game, document, timers } = animationFixture();
  let finished;
  model.openEvolution(4, dex => { finished = dex; });
  assert.equal(document.activeElement.id, 'evolution-stop');
  assert.equal(timers.size, 1);
  document.getElementById('evolution-stop').onclick();
  assert.equal(timers.size, 0);
  assert(game.DB.save.owned[4]);
  assert(!game.DB.save.owned[5]);
  assert.equal(model.pendingEvolution(game.DB.save, 4), null);
  document.getElementById('evolution-continue').onclick();
  assert.equal(finished, 4);
});

test('animation commits exactly once and continues with the evolved Pokemon', () => {
  const { model, game, document, timers } = animationFixture();
  let finished, commits = 0;
  game.DB.commit = () => { commits++; game.DB.notify(); return true; };
  model.openEvolution(4, dex => { finished = dex; });
  const complete = [...timers.values()][0];
  complete();
  complete();
  assert.equal(commits, 1);
  assert(!game.DB.save.owned[4]);
  assert(game.DB.save.owned[5]);
  assert.equal(model.state(game.DB.save, 5).level, 16);
  document.getElementById('evolution-continue').onclick();
  assert.equal(finished, 5);
});

test('leaving the evolution screen clears its timer without cancelling the pending evolution', () => {
  const { model, game, timers } = animationFixture();
  model.openEvolution(4, () => assert.fail('Dismissed animation continued'));
  const complete = [...timers.values()][0];
  game.UI.show('scr-login');
  assert.equal(timers.size, 0);
  complete();
  assert(game.DB.save.owned[4]);
  assert(!game.DB.save.owned[5]);
  assert(model.pendingEvolution(game.DB.save, 4));
});

test('a concurrent cloud evolution restores match results instead of leaving a blank screen', () => {
  const { model, game, timers } = animationFixture();
  let resumed;
  game.Game.state = 'over';
  game.UI.toast = () => {};
  model.openEvolution(4, dex => { resumed = dex; });
  model.evolve(game.DB.save, 4, 5);
  game.DB.notify();
  assert.equal(timers.size, 0);
  assert.equal(resumed, 5);
});
