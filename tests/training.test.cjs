const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const data = require('../js/data/learnsets.js');
const { create } = require('../js/training.js');

const training = create(data);
const saveFor = (...ids) => ({
  owned: Object.fromEntries(ids.map(id => [id, { from: 'test', at: 1 }])),
  ptm: {}
});
function atLevel(save, dex, level) {
  training.state(save, dex);
  save.training[dex].xp = training.xpAt(dex, level);
}

test('all species have complete, monotonic official growth curves and playable defaults', () => {
  assert.equal(Object.keys(data.pokemon).length, 1025);
  for (const [dex, mon] of Object.entries(data.pokemon)) {
    const save = saveFor(dex), state = training.state(save, dex);
    assert.equal(state.level, 1);
    assert.equal(state.xp, 0);
    assert(state.loadout.length >= 1 && state.loadout.length <= 4);
    const startingMoves = mon.moves.filter(([, level]) => level <= 1).map(([id]) => id);
    const hasAttack = startingMoves.some(id => !data.moves[id].support);
    const available = hasAttack ? startingMoves : ['struggle', ...startingMoves];
    assert.deepEqual(training.available(save, dex), available);
    assert.equal(state.loadout.length, Math.min(available.length, 4));
    for (let level = 1; level < 100; level++) {
      assert(training.xpAt(dex, level + 1) > training.xpAt(dex, level));
    }
    for (const [id, level] of mon.moves) {
      assert(Object.hasOwn(data.moves, id));
      assert(Number.isInteger(level) && level >= 0 && level <= 100);
    }
  }
});

test('official levels, not shared type pools, control move eligibility', () => {
  const save = saveFor(1, 4, 7);
  assert.deepEqual(training.available(save, 4), ['struggle']);
  atLevel(save, 4, 3);
  assert.deepEqual(training.available(save, 4), ['struggle']);
  atLevel(save, 4, 4);
  assert.deepEqual(training.available(save, 4), ['ember']);
  atLevel(save, 4, 11);
  assert(!training.available(save, 4).includes('dragon-breath'));
  atLevel(save, 4, 12);
  assert(training.available(save, 4).includes('dragon-breath'));
  assert(!training.available(save, 4).includes('hydro-pump'));
  assert.deepEqual(training.state(save, 7).loadout, ['tackle']);
  assert.deepEqual(training.available(save, 7), ['tackle']);
  atLevel(save, 7, 3);
  assert.deepEqual(training.available(save, 7), ['tackle', 'water-gun']);
  assert.deepEqual(training.state(save, 7).loadout, ['tackle']);
  assert(!training.available(save, 1).includes('razor-leaf'));
  atLevel(save, 1, 12);
  assert(training.available(save, 1).includes('razor-leaf'));
});

test('all official level-one moves are available immediately, with up to four equipped', () => {
  const save = saveFor(25, 6);
  for (const dex of [25, 6]) {
    const unlocked = data.pokemon[dex].moves.filter(([, level]) => level <= 1).map(([id]) => id);
    assert(unlocked.length > 1);
    assert.deepEqual(training.available(save, dex), unlocked);
    assert.equal(training.state(save, dex).loadout.length, Math.min(unlocked.length, 4));
    for (const id of unlocked.filter(id => !data.moves[id].support)) {
      assert.deepEqual(training.setLoadout(save, dex, [id]).loadout, [id]);
    }
  }
});

test('all six official growth curves retain their distinct thresholds', () => {
  const expected = {
    1: [156250, 1250000], 2: [125000, 1000000], 3: [100000, 800000],
    4: [117360, 1059860], 5: [125000, 600000], 6: [142500, 1640000]
  };
  assert.equal(Object.keys(data.growth).length, 6);
  for (const [growth, [at50, at100]] of Object.entries(expected)) {
    assert.equal(data.growth[growth][50], at50);
    assert.equal(data.growth[growth][100], at100);
  }
});

test('Scarlet/Violet takes precedence, with a recorded latest-game fallback', () => {
  assert.equal(data.pokemon[4].version, 25);
  assert.equal(data.versions[data.pokemon[201].version], 'legends-arceus');
});

test('evolution moves belong only to the current species', () => {
  const save = saveFor(4, 6);
  assert(data.pokemon[6].moves.some(([id, level]) => id === 'air-slash' && level === 0));
  assert(training.available(save, 6).includes('air-slash'));
  assert(!training.available(save, 4).includes('air-slash'));
});

test('match performance awards XP to only the played Pokemon and crosses exact thresholds', () => {
  const save = saveFor(4, 7), before = training.state(save, 4);
  const target = training.xpAt(4, 12), needed = target - before.xp;
  const first = training.award(save, 4, { time: (needed - 1) / 2, kills: 0, bosses: 0 });
  assert.equal(first.after.level, 11);
  const second = training.award(save, 4, { time: 0.5, kills: 0, bosses: 0 });
  assert.equal(second.after.level, 12);
  assert(second.unlocked.includes('dragon-breath'));
  assert.equal(training.state(save, 7).level, 1);
  assert.equal(training.reward({ time: 60, kills: 10, bosses: 1 }), 350);
});

test('levels and XP cap at 100 without invalid progress bars', () => {
  const save = saveFor(4);
  atLevel(save, 4, 99);
  const result = training.award(save, 4, { time: 1e7, kills: 99999, bosses: 100 });
  assert.equal(result.after.level, 100);
  assert.equal(result.after.xp, training.xpAt(4, 100));
  assert.equal(result.after.progress, 1);
  assert.equal(result.after.remaining, 0);
  assert.equal(training.award(save, 4, { time: 10, kills: 1, bosses: 0 }).gained, 0);
});

test('invalid performance and invalid levels are explicitly rejected', () => {
  for (const time of [-1, NaN, Infinity, Number.MAX_VALUE]) {
    assert.throws(() => training.reward({ time, kills: 0, bosses: 0 }), RangeError);
  }
  assert.throws(() => training.reward({ time: 1, kills: 0.1, bosses: 0 }), RangeError);
  for (const level of [0, 101, 2.5]) assert.throws(() => training.xpAt(4, level), RangeError);
  assert.throws(() => training.state(saveFor(4), 7), RangeError);
  assert.throws(() => training.state(saveFor(4), '__proto__'), RangeError);
});

test('unlocking an attack never replaces an already valid loadout', () => {
  const save = saveFor(4);
  atLevel(save, 4, 4);
  training.setLoadout(save, 4, ['ember']);
  const needed = training.xpAt(4, 12) - training.state(save, 4).xp;
  training.award(save, 4, { time: needed / 2, kills: 0, bosses: 0 });
  assert(training.available(save, 4).includes('dragon-breath'));
  assert.deepEqual(training.state(save, 4).loadout, ['ember']);
});

test('up to four unique, eligible moves can be selected in a persistent order', () => {
  const save = saveFor(25);
  atLevel(save, 25, 100);
  const ids = ['thunderbolt', 'quick-attack', 'agility', 'electro-ball'];
  assert.deepEqual(training.setLoadout(save, 25, ids, 10).loadout, ids);
  const reloaded = JSON.parse(JSON.stringify(save));
  assert.deepEqual(training.state(reloaded, 25).loadout, ids);
  assert.equal(reloaded.training[25].updated, 10);
  assert.throws(() => training.setLoadout(save, 25, ids.concat('discharge')), RangeError);
  assert.throws(() => training.setLoadout(save, 25, ['thunderbolt', 'thunderbolt']), RangeError);
  assert.throws(() => training.setLoadout(save, 25, ['hydro-pump']), RangeError);
  assert.throws(() => training.setLoadout(save, 25, ['agility']), RangeError);
  assert.throws(() => training.setLoadout(save, 25, []), RangeError);
  assert.throws(() => training.setLoadout(saveFor(25), 25, ['thunderbolt']), RangeError);
});

test('only actually taught, species-compatible TMs can bypass level-up unlocks', () => {
  const save = saveFor(4);
  save.ptm[4] = ['flamethrower', 'hydro-pump', 'not-a-move'];
  assert(training.available(save, 4).includes('flamethrower'));
  assert(!training.available(save, 4).includes('hydro-pump'));
  assert(!training.available(save, 4).includes('not-a-move'));
  training.setLoadout(save, 4, ['flamethrower']);
});

test('Struggle is explicit and disappears once a compatible attack is unlocked', () => {
  const save = saveFor(129, 132, 235);
  for (const dex of [129, 132, 235]) {
    assert.deepEqual(training.available(save, dex), ['struggle']);
    assert.deepEqual(training.state(save, dex).loadout, ['struggle']);
  }
  atLevel(save, 129, 15);
  assert.deepEqual(training.available(save, 129), ['tackle']);
  assert.deepEqual(training.state(save, 129).loadout, ['tackle']);
  assert.throws(() => training.setLoadout(save, 129, ['struggle']), RangeError);
});

test('migration preserves valid legacy choices but cannot grandfather illegal moves', () => {
  const save = saveFor(7);
  save.pstart = { 7: 'water-gun' };
  save.pstart2 = { 7: 'ember' };
  save.pbind = { 7: ['ember', 'tackle'] };
  save.training = { 7: { xp: training.xpAt(7, 3) } };
  assert.deepEqual(training.state(save, 7).loadout, ['water-gun', 'tackle']);
  save.training[7] = { xp: Infinity, updated: -1, loadout: ['ember', 'water-gun', 'water-gun'] };
  save.training[999999] = { xp: 999999 };
  save.training[4] = { xp: 999999 };
  training.normalize(save);
  assert.equal(training.state(save, 7).level, 1);
  assert.deepEqual(save.training[7].loadout, ['tackle']);
  assert(!Object.hasOwn(save.training, 999999));
  assert(!Object.hasOwn(save.training, 4));
  save.training = [];
  assert.deepEqual(training.normalize(save).training, {});
});

test('cloud merges keep maximum XP and independently timestamped loadouts per Pokemon', () => {
  const left = saveFor(25, 4), right = saveFor(25, 4);
  atLevel(left, 25, 40);
  atLevel(right, 25, 20);
  training.setLoadout(left, 25, ['thunderbolt'], 100);
  training.setLoadout(right, 25, ['quick-attack', 'electro-ball'], 200);
  atLevel(left, 4, 4);
  training.setLoadout(left, 4, ['ember'], 300);
  const merge = (a, b) => training.merge(saveFor(25, 4), a, b);
  const first = merge(left, right);
  assert.equal(training.state(first, 25).level, 40);
  assert.deepEqual(training.state(first, 25).loadout, ['quick-attack', 'electro-ball']);
  assert.deepEqual(first.training, merge(right, left).training);
  assert.deepEqual(first.training, merge(first, first).training);
  assert.deepEqual(left.training[25].loadout, ['thunderbolt']);
  const alias = JSON.parse(JSON.stringify(left));
  assert.deepEqual(training.merge(alias, alias, right).training, first.training);
});

test('temporary rewards are only stats, honor caps, and leave moves unchanged', () => {
  const player = { statsTaken: { capped: 1 }, hp: 100, moves: ['ember'] };
  const stats = [
    { id: 'hp', title: 'HP', apply: p => { p.hp += 20; } },
    { id: 'capped', max: 1, apply: () => assert.fail('Capped reward was offered') },
    { id: 'heal', title: 'Heal', apply: () => {} },
    { id: 'regen', title: 'Regen', apply: () => {} }
  ];
  const offers = training.temporaryOffers(stats, player, (items, count) => items.slice(0, count));
  assert.equal(offers.length, 3);
  assert(offers.every(offer => offer.type === 'stat'));
  offers[0].apply(player);
  assert.equal(player.hp, 120);
  assert.equal(player.statsTaken.hp, 1);
  assert.deepEqual(player.moves, ['ember']);
});

function installFixture() {
  const model = create(data), save = saveFor(25, 129), events = [];
  const context = {
    DEX: [{ dex: 25 }, { dex: 129 }],
    Moves: { BY_ID: Object.fromEntries(Object.keys(data.moves).map(id => [
      id, { id, name: id, kind: id === 'tackle' ? 'melee' : 'shot', cd: 0.5 }
    ])) },
    Mons: {},
    I18n: { add() {} },
    DB: { save, onSync() {} },
    Upgrades: {
      LIST: ['hp', 'moves', 'start', 'start2', 'ban'].map(id => ({ id })),
      perks: () => ({ hp: 20, startMoves: 2, bans: 3 })
    },
    LevelUp: { STATS: [] },
    U: { pickN: (items, count) => items.slice(0, count) },
    Progress: {
      event(name, details) {
        events.push({ name, details, xp: model.state(save, 25).xp });
        return 'original-event';
      }
    },
    RunUI: { showOver() {} },
    UI: { show() {} },
    MenuUI: { init() {} },
    Flow: { play() {} },
    Game: {}
  };
  model.install(context);
  return { model, context, events, save };
}

function makePlayer(dex) {
  return {
    dex, moves: [{ id: 'legacy' }], slots: [[{ id: 'legacy' }]],
    bind: { legacy: 3 }, active: 3, level: 1, kills: 10, bosses: 1,
    addMove(id) {
      const move = { id, lvl: 1 };
      this.moves.push(move);
      this.slots.push([move]);
    }
  };
}

test('integration equips the exact selected four without changing the temporary run level', () => {
  const { model, context, save } = installFixture();
  atLevel(save, 25, 40);
  const selected = ['thunderbolt', 'quick-attack', 'agility', 'electro-ball'];
  model.setLoadout(save, 25, selected);
  const player = makePlayer(25);
  model.preparePlayer(player);
  assert.deepEqual(player.moves.map(move => move.id), selected);
  assert.deepEqual(player.slots.map(slot => slot.map(move => move.id)), selected.map(id => [id]));
  assert.equal(player.pokemonLevel, 40);
  assert.equal(player.level, 1);
  assert.equal(player.active, 0);
  assert.deepEqual(player.bind, {});
  assert.equal(context.startMoveOf(25), 'thunderbolt');
  assert.deepEqual(context.Upgrades.LIST.map(upgrade => upgrade.id), ['hp']);
  assert.deepEqual(context.Upgrades.perks({}), { hp: 20, startMoves: 1, bans: 0 });
  assert.deepEqual(context.Moves.poolFor({ dex: 7 }), ['tackle']);
  assert(!Object.hasOwn(save.training, 7));
  save.ptm[25] = ['thunderbolt', 'hydro-pump'];
  assert.deepEqual(context.Mons.taught(25), ['thunderbolt']);
});

test('integration awards performance XP before forwarding runEnd, and only once per match', () => {
  const { model, context, events, save } = installFixture();
  const player = makePlayer(25), before = model.state(save, 25).xp;
  context.Game.player = player;
  model.preparePlayer(player);
  const details = { time: 60 };
  assert.equal(context.Progress.event('runEnd', details), 'original-event');
  assert.equal(model.state(save, 25).xp, before + 350);
  assert.equal(events[0].xp, before + 350);
  assert.equal(events[0].details, details);
  context.Progress.event('runEnd', details);
  assert.equal(model.state(save, 25).xp, before + 350);
  assert.equal(model.state(save, 129).level, 1);
  model.preparePlayer(player);
  context.Progress.event('runEnd', details);
  assert.equal(model.state(save, 25).xp, before + 700);
});

test('integration refuses to reward a different player or account', () => {
  for (const change of ['player', 'save']) {
    const { model, context } = installFixture(), player = makePlayer(25);
    context.Game.player = player;
    model.preparePlayer(player);
    if (change === 'player') context.Game.player = makePlayer(25);
    else context.DB.save = saveFor(25);
    assert.throws(() => context.Progress.event('runEnd', { time: 60 }), /different account or match/);
  }
});

test('integration supplies an instantiated emergency combat move without polluting official data', () => {
  const { model, context } = installFixture(), player = makePlayer(129);
  model.preparePlayer(player);
  assert.deepEqual(player.moves.map(move => move.id), ['struggle']);
  assert.equal(context.Moves.BY_ID.struggle.kind, context.Moves.BY_ID.tackle.kind);
  assert.equal(context.Moves.BY_ID.struggle.cd, context.Moves.BY_ID.tackle.cd);
  assert(!data.pokemon[129].moves.some(([id]) => id === 'struggle'));
  assert.throws(() => model.install(context), /already installed/);
});

test('startup asset failures show a retry instead of leaving the loading screen frozen', () => {
  let handler, replacements, reloaded = false, hidden = false;
  const boot = {
    classList: { contains: () => hidden },
    replaceChildren(...elements) { replacements = elements; }
  };
  const context = {
    window: { PS_LOCALES: { lang: 'en' } },
    document: {
      querySelector: () => null,
      querySelectorAll: () => [{}, {}],
      getElementById: () => boot,
      createElement: () => ({})
    },
    location: { reload() { reloaded = true; } },
    addEventListener(name, callback) { assert.equal(name, 'error'); handler = callback; }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/boot.js'), 'utf8'), context);
  handler({ target: { src: 'https://www.gstatic.com/firebase-app-compat.js' } });
  assert.equal(replacements, undefined);
  handler({ target: { src: '/js/data/learnsets.js?v=training-1' } });
  assert.match(replacements[0].textContent, /Could not load/);
  assert.equal(replacements[1].textContent, 'Reload');
  replacements[1].onclick();
  assert(reloaded);
  replacements = undefined;
  hidden = true;
  handler({ target: {}, filename: '/js/training.js' });
  assert.equal(replacements, undefined);
});

test('entry pages, updater manifest and offline cache use the same compatible build ID', () => {
  const { v } = require('../version.json');
  assert.match(v, /^[0-9a-f]{10}$/);
  for (const page of ['../index.html', '../en/index.html']) {
    const source = fs.readFileSync(require.resolve(page), 'utf8');
    assert(source.includes('js/app.min.js?v=' + v + '"'));
  }
  assert(fs.readFileSync(require.resolve('../sw.js'), 'utf8').includes('./js/app.min.js?v=' + v));
});
