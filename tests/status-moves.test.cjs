const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const data = require('../js/data/learnsets.js');
const { create } = require('../js/training.js');

const source = fs.readFileSync(require.resolve('../js/app.min.js'), 'utf8');
const cases = [
  ['defense-curl', 'harden', 'normal'],
  ['withdraw', 'harden', 'water'],
  ['iron-defense', 'harden', 'steel'],
  ['cotton-guard', 'harden', 'grass'],
  ['acid-armor', 'harden', 'poison'],
  ['sharpen', 'swords-dance', 'normal'],
  ['meditate', 'swords-dance', 'psychic'],
  ['howl', 'swords-dance', 'normal'],
  ['hone-claws', 'swords-dance', 'dark'],
  ['belly-drum', 'swords-dance', 'normal'],
  ['tail-glow', 'nasty-plot', 'bug'],
  ['rock-polish', 'agility', 'rock'],
  ['autotomize', 'agility', 'steel'],
  ['tailwind', 'agility', 'flying'],
  ['amnesia', 'harden', 'psychic'],
  ['cosmic-power', 'harden', 'psychic'],
  ['stockpile', 'harden', 'normal'],
  ['charge', 'harden', 'electric'],
  ['barrier', 'harden', 'psychic'],
  ['shelter', 'harden', 'steel'],
  ['defend-order', 'harden', 'bug'],
  ['ingrain', 'aqua-ring', 'grass'],
  ['recover', 'aqua-ring', 'normal'],
  ['slack-off', 'aqua-ring', 'normal'],
  ['milk-drink', 'aqua-ring', 'normal'],
  ['roost', 'aqua-ring', 'flying'],
  ['synthesis', 'aqua-ring', 'grass'],
  ['morning-sun', 'aqua-ring', 'normal'],
  ['moonlight', 'aqua-ring', 'fairy'],
  ['shore-up', 'aqua-ring', 'ground'],
  ['rest', 'aqua-ring', 'psychic'],
  ['soft-boiled', 'aqua-ring', 'normal'],
  ['heal-order', 'aqua-ring', 'bug']
];
const combinedCases = [
  ['growth', 'normal', 'patk', 'satk'],
  ['work-up', 'normal', 'patk', 'satk'],
  ['bulk-up', 'fighting', 'patk', 'def'],
  ['coil', 'poison', 'patk', 'def'],
  ['calm-mind', 'psychic', 'satk', 'def'],
  ['shift-gear', 'steel', 'patk', 'spd'],
  ['tidy-up', 'normal', 'patk', 'spd']
];
const templates = {
  patk: 'swords-dance', satk: 'nasty-plot', spd: 'agility', def: 'harden', regen: 'aqua-ring'
};
const baseAmounts = { patk: 0.13, satk: 0.13, spd: 0.1, def: 0.07, regen: 1.6 };
const singleBuffs = new Set([...Object.values(templates), 'dragon-dance', ...cases.map(([id]) => id)]);
const buffs = new Set([...singleBuffs, ...combinedCases.map(([id]) => id)]);

function fixture() {
  const effects = [];
  const game = {
    Sprites: {
      PX: 1, hasShiny: () => false, playerScale: () => 1,
      playerRadius: () => 8, bodyHeight: () => 16, animMeta: () => null,
      dirFromAngle: () => 0,
      Animator: class {
        update() {}
        busy() { return false; }
        play() {}
        loop() {}
      }
    },
    U: {
      TYPE_COLOR: {
        normal: '#fff', water: '#00f', psychic: '#f0f',
        steel: '#aaa', grass: '#0f0', poison: '#a0a', fighting: '#a00',
        dark: '#333', bug: '#aa0', rock: '#a80', flying: '#aaf',
        electric: '#ff0', fairy: '#faf', ground: '#b80'
      },
      clamp: (value, low, high) => Math.max(low, Math.min(high, value)),
      rand: (low, high) => (low + high) / 2
    },
    Coop: { active: false },
    Audio: { sfx() {} },
    FX: {
      ring(...args) { effects.push(['ring', ...args]); },
      sp(...args) { effects.push(['sp', ...args]); }
    },
    Game: { st: { time: 0 } },
    Input: { axis: () => [0, 0] },
    World: { collide() {}, isLiquid: () => false, nearestBreakable: () => null },
    Weather: { speedFor: () => 1 },
    EnemyMgr: { all: () => [] },
    Projectiles: { nearest: () => null },
    Settings: { get: () => false }
  };
  const runtime = vm.createContext({ _0x599208: game, performance: { now: () => 0 } });
  vm.runInContext(source.slice(0, source.indexOf('const a0_0xc9496a=')) +
    source.slice(source.lastIndexOf('function a0_0x48f4()')), runtime, { timeout: 3000 });
  runtime._0x48be02 = runtime.a0_0x422d;
  const moves = source.indexOf('_0x160cd9=');
  vm.runInContext(source.slice(source.lastIndexOf('((()=>{', moves),
    source.indexOf(",_0x599208['NATURES']=", moves)), runtime, { timeout: 3000 });
  for (const [first, next] of [
    ['Player', 'Stats'], ['Stats', 'AbilityFX'], ['VFX', 'FX'], ['Combat', 'Spawner']
  ]) {
    const start = source.indexOf("_0x599208['" + first + "']="),
      end = source.indexOf(",_0x599208['" + next + "']=", start);
    assert(start > 0 && end > start, first + ' module boundaries');
    vm.runInContext(source.slice(start, end), runtime, { timeout: 3000 });
  }
  const player = new game.Player({
    dex: 7, hp: 100, atk: 10, pa: 10, sa: 10, df: 100, sd: 100, spd: 100,
    types: ['water']
  });
  return { game, player, effects };
}

for (const [id, template, type] of cases) {
  test(id + ' is a distinct native buff with the existing template balance', () => {
    const { game } = fixture(), move = game.Moves.BY_ID[id];
    assert(move, 'Missing native move: ' + id);
    assert.equal(game.Moves.ALL.filter(entry => entry.id === id).length, 1);
    assert.equal(game.Moves.ALL.find(entry => entry.id === id), move);
    assert.notEqual(move, game.Moves.BY_ID[template]);
    assert.equal(move.type, type);
    for (const key of ['kind', 'stat', 'amount', 'cd', 'dur', 'stacks', 'desc']) {
      assert.equal(move[key], game.Moves.BY_ID[template][key], id + ': ' + key);
    }
    assert.equal(move.cat, null);
    const instance = game.Moves.instance(id);
    assert.equal(instance.id, id);
    assert.equal(instance.def, move);
    assert.notEqual(instance, move);
    assert.equal(instance.lvl, 1);
    assert.equal(instance.t, 0);
    assert.equal(move.maxLvl, game.Moves.BY_ID[template].maxLvl);
    assert.equal(game.VFX.forMove(move).buff || 'arrow',
      game.VFX.forMove(game.Moves.BY_ID[template]).buff || 'arrow');
    for (let level = 1; level <= move.maxLvl; level++) {
      const instance = game.Moves.instance(id, level), original = game.Moves.instance(template, level);
      for (const key of ['stat', 'amount', 'cd', 'dur', 'stacks']) {
        assert.equal(instance[key], original[key], id + ': ' + key + ' at level ' + level);
      }
    }
  });
}

for (const id of singleBuffs) {
  test(id + ' casts without a target, shares capped stat stacks, and expires', () => {
    const { game, player, effects } = fixture();
    assert(game.Moves.BY_ID[id], 'Missing native move: ' + id);
    const move = game.Moves.instance(id), definition = game.Moves.BY_ID[id];
    player.moves = [move];
    player.slots = [player.moves];
    if (definition.stat === 'regen') player.hp = 50;
    const hp = player.hp;
    const physical = player.atkFor({ type: 'normal', cat: 'physical' });
    const special = player.atkFor({ type: 'normal', cat: 'special' });
    const speed = player.spd, reduction = player.reduction, regen = player.regen;
    assert.equal(player.target, undefined);
    game.Combat.tick(0.01, player, 0);
    const buff = player.buffs[definition.stat];
    assert.equal(buff.n, 1);
    assert.equal(buff.amount, definition.amount);
    assert.equal(buff.t, definition.dur);
    assert.equal(move.t, definition.cd);
    assert.equal(player.hp, hp);
    assert.equal(effects.filter(([kind]) => kind === 'ring').length, 1);
    assert.equal(effects.filter(([kind]) => kind === 'sp').length, 3);
    const shape = game.VFX.forMove(definition).buff || 'arrow';
    assert(effects.filter(([kind]) => kind === 'sp').every(([, value]) => value === shape));
    assert.equal(player.atkFor({ type: 'normal', cat: 'physical' }) / physical,
      1 + (definition.stat === 'patk' ? definition.amount : 0));
    assert.equal(player.atkFor({ type: 'normal', cat: 'special' }) / special,
      1 + (definition.stat === 'satk' ? definition.amount : 0));
    assert.equal(player.spd / speed, 1 + (definition.stat === 'spd' ? definition.amount : 0));
    assert.equal(player.reduction - reduction, definition.stat === 'def' ? definition.amount : 0);
    assert.equal(player.regen - regen, definition.stat === 'regen' ? definition.amount : 0);
    for (let i = 0; i < 10; i++) game.Combat.tick(definition.cd + 0.01, player, i + 1);
    assert.equal(buff.n, definition.stacks);
    player.update(3);
    assert.equal(buff.t, definition.dur - 3);
    game.Combat.tick(definition.cd + 0.01, player, 12);
    assert.equal(buff.n, definition.stacks);
    assert.equal(buff.t, definition.dur);
    player.update(definition.dur);
    assert.equal(buff.n, 0);
    assert.equal(player.atkFor({ type: 'normal', cat: 'physical' }), physical);
    assert.equal(player.atkFor({ type: 'normal', cat: 'special' }), special);
    assert.equal(player.spd, speed);
    assert.equal(player.reduction, reduction);
    assert.equal(player.regen, regen);
    assert(Math.abs(player.hp - (hp + (definition.stat === 'regen' ? definition.stacks * definition.amount * 3 : 0))) < 1e-10);
  });
}

for (const [id, type, primaryStat, secondaryStat] of combinedCases) {
  const primaryAmount = baseAmounts[primaryStat] / 2, secondaryAmount = baseAmounts[secondaryStat] / 2;
  test(id + ' applies both native stat buffs on one automatic cast', () => {
    const { game, player, effects } = fixture(), definition = game.Moves.BY_ID[id];
    assert(definition, 'Missing native move: ' + id);
    assert.equal(game.Moves.ALL.filter(move => move.id === id).length, 1);
    assert.equal(definition.type, type);
    assert.equal(definition.kind, 'buff');
    assert.equal(definition.cat, null);
    assert.equal(definition.stat, primaryStat);
    assert.equal(definition.amount, primaryAmount);
    assert.equal(definition.secondaryStat, secondaryStat);
    assert.equal(definition.secondaryAmount, secondaryAmount);
    const move = game.Moves.instance(id);
    player.moves = [move];
    player.slots = [player.moves];
    const physical = player.atkFor({ type: 'normal', cat: 'physical' });
    const special = player.atkFor({ type: 'normal', cat: 'special' });
    const reduction = player.reduction, speed = player.spd;
    const includes = stat => primaryStat === stat || secondaryStat === stat;
    assert.equal(player.target, undefined);
    game.Combat.tick(0.01, player, 0);
    assert.equal(move.t, 0.85);
    assert.equal(player.hp, 100);
    assert.equal(player.atkFor({ type: 'normal', cat: 'physical' }) / physical, includes('patk') ? 1.065 : 1);
    assert.equal(player.atkFor({ type: 'normal', cat: 'special' }) / special,
      includes('satk') ? 1.065 : 1);
    assert.equal(player.reduction - reduction, includes('def') ? 0.035 : 0);
    assert.equal(player.spd / speed, includes('spd') ? 1.05 : 1);
    for (const [stat, amount] of [[primaryStat, primaryAmount], [secondaryStat, secondaryAmount]]) {
      assert.equal(player.buffs[stat].n, 1);
      assert.equal(player.buffs[stat].amount, amount);
      assert.equal(player.buffs[stat].t, 7);
    }
    for (const stat of Object.keys(templates).filter(stat => !includes(stat))) {
      assert.equal(player.buffs[stat].n, 0, stat);
    }
    assert.equal(effects.filter(([kind]) => kind === 'ring').length, 1);
    assert.equal(effects.filter(([kind]) => kind === 'sp').length, 3);
    for (let i = 0; i < 10; i++) game.Combat.tick(0.86, player, i + 1);
    assert.equal(player.buffs[primaryStat].n, 5);
    assert.equal(player.buffs[secondaryStat].n, 5);
    assert.equal(player.buffs[primaryStat].amount, primaryAmount);
    assert.equal(player.buffs[secondaryStat].amount, secondaryAmount);
    assert.equal(player.atkFor({ type: 'normal', cat: 'physical' }) / physical, includes('patk') ? 1.325 : 1);
    assert.equal(player.atkFor({ type: 'normal', cat: 'special' }) / special, includes('satk') ? 1.325 : 1);
    assert.equal(player.spd / speed, includes('spd') ? 1.25 : 1);
    player.update(3);
    assert.equal(player.buffs[primaryStat].t, 4);
    assert.equal(player.buffs[secondaryStat].t, 4);
    game.Combat.tick(0.86, player, 12);
    assert.equal(player.buffs[primaryStat].t, 7);
    assert.equal(player.buffs[secondaryStat].t, 7);
    player.update(7);
    assert.equal(player.buffs[primaryStat].n, 0);
    assert.equal(player.buffs[secondaryStat].n, 0);
    assert.equal(player.atkFor({ type: 'normal', cat: 'physical' }), physical);
    assert.equal(player.atkFor({ type: 'normal', cat: 'special' }), special);
    assert.equal(player.spd, speed);
    assert.equal(player.reduction, reduction);
  });

  test(id + ' stays half-strength at every move level without mutating definitions or other instances', () => {
    const { game } = fixture(), definition = game.Moves.BY_ID[id];
    assert(definition, 'Missing native move: ' + id);
    const upgraded = game.Moves.instance(id);
    for (let level = 1; level <= definition.maxLvl; level++) {
      const direct = game.Moves.instance(id, level);
      const primary = game.Moves.instance(templates[primaryStat], level);
      const secondary = game.Moves.instance(templates[secondaryStat], level);
      for (const move of [direct, upgraded]) {
        assert.equal(move.amount, primary.amount / 2);
        assert.equal(move.secondaryAmount, secondary.amount / 2);
        assert.equal(move.dur, primary.dur);
        assert.equal(move.stacks, primary.stacks);
      }
      assert.equal(game.Moves.BY_ID[id].amount, primaryAmount);
      assert.equal(game.Moves.BY_ID[id].secondaryAmount, secondaryAmount);
      assert.equal(game.Moves.instance(id).secondaryAmount, secondaryAmount);
      if (level < definition.maxLvl) assert.equal(game.Moves.levelUp(upgraded), true);
    }
    assert.equal(game.Moves.levelUp(upgraded), false);
  });
}

test('combined buffs share each stat pool with existing single-stat buffs', () => {
  const { game, player } = fixture();
  for (const id of ['swords-dance', 'growth', 'work-up', 'bulk-up']) {
    assert(game.Moves.BY_ID[id], 'Missing native move: ' + id);
  }
  player.moves = ['swords-dance', 'growth', 'work-up', 'bulk-up'].map(id => game.Moves.instance(id));
  player.slots = [player.moves];
  game.Combat.tick(0.01, player, 0);
  assert.equal(player.buffs.patk.n, 4);
  assert.equal(player.buffs.satk.n, 2);
  assert.equal(player.buffs.def.n, 1);
  game.Combat.tick(0.86, player, 1);
  assert.equal(player.buffs.patk.n, 5);
  assert.equal(player.buffs.satk.n, 4);
  assert.equal(player.buffs.def.n, 2);
  game.Combat.tick(0.86, player, 2);
  assert.equal(player.buffs.patk.n, 5);
  assert.equal(player.buffs.satk.n, 5);
  assert.equal(player.buffs.def.n, 3);
});

test('half-strength combined casts preserve stronger existing single-stat buffs', () => {
  for (const [stat, single, combined] of [
    ['patk', 'swords-dance', 'growth'],
    ['satk', 'nasty-plot', 'work-up'],
    ['def', 'harden', 'bulk-up']
  ]) {
    const { game, player } = fixture(), definition = game.Moves.BY_ID[single];
    for (let i = 0; i < 3; i++) player.addBuff(stat, definition.amount, 4, 5);
    const buff = player.buffs[stat], total = buff.n * buff.amount;
    player.moves = [game.Moves.instance(combined)];
    player.slots = [player.moves];
    game.Combat.tick(0.01, player, 0);
    assert.equal(buff.n, 3, stat);
    assert.equal(buff.amount, definition.amount, stat);
    assert.equal(buff.n * buff.amount, total, stat);
    assert.equal(buff.t, 7);
    assert.equal(player.buffs[stat === 'patk' ? 'satk' : 'patk'].n, 1);
  }
});

test('move category labels include both attack categories without changing single-stat labels', () => {
  const { game } = fixture();
  assert.equal(typeof game.Stats.categoryLabel, 'function');
  for (const id of ['growth', 'work-up']) {
    assert.equal(game.Stats.categoryLabel(game.Moves.BY_ID[id]), 'F\u00edsico / Especial');
  }
  assert.equal(game.Stats.categoryLabel(game.Moves.BY_ID['bulk-up']), 'F\u00edsico');
  for (const [id, , primaryStat, secondaryStat] of combinedCases) {
    assert(game.Moves.BY_ID[id], id);
    const expected = primaryStat === 'satk' ? 'Especial' :
      secondaryStat === 'satk' ? 'F\u00edsico / Especial' : 'F\u00edsico';
    assert.equal(game.Stats.categoryLabel(game.Moves.BY_ID[id]), expected, id);
  }
  for (const move of game.Moves.ALL.filter(move => !move.secondaryStat)) {
    const expected = game.Stats.NAME[move.cat ||
      (move.stat === 'patk' ? 'physical' : move.stat === 'satk' ? 'special' : '')] || '';
    assert.equal(game.Stats.categoryLabel(move), expected, move.id);
  }
});

for (const [stat, ids, amount] of [
  ['patk', ['swords-dance', 'sharpen', 'meditate', 'howl'], 0.13],
  ['def', ['harden', 'iron-defense', 'cotton-guard', 'acid-armor'], 0.07],
  ['regen', ['aqua-ring', 'ingrain', 'recover', 'rest'], 1.6]
]) {
  test('different ' + stat + ' moves reuse the native shared buff pool', () => {
    const { game, player } = fixture();
    for (const id of ids) assert(game.Moves.BY_ID[id], 'Missing native move: ' + id);
    player.moves = ids.map(id => game.Moves.instance(id));
    player.slots = [player.moves];
    game.Combat.tick(0.01, player, 0);
    assert.equal(player.buffs[stat].n, 4);
    assert.equal(player.buffs[stat].amount, amount);
    assert.equal(player.buffs.satk.n, 0);
    assert.equal(player.buffs[stat === 'patk' ? 'def' : 'patk'].n, 0);
    game.Combat.tick(0.86, player, 1);
    assert.equal(player.buffs[stat].n, game.Moves.BY_ID[ids[0]].stacks);
  });
}

test('generated self-buffs are support moves with canonical localized names and native definitions', () => {
  const { game } = fixture();
  for (const id of buffs) {
    assert(data.moves[id], 'Missing generated move: ' + id);
    assert.equal(data.moves[id].support, true, id);
    assert(data.moves[id].names.en);
    assert(data.moves[id].names.es);
    assert.equal(game.Moves.BY_ID[id].name, data.moves[id].names.es, id);
  }
  for (const id of Object.keys(data.moves)) assert(game.Moves.BY_ID[id], id);
  for (const id of ['growl', 'tail-whip', 'leer', 'focus-energy', 'double-team', 'minimize']) assert(!data.moves[id]);
});

test('official buff unlocks use permanent levels and preserve saved loadouts', () => {
  const training = create(data);
  for (const id of buffs) {
    const entry = Object.entries(data.pokemon).find(([, mon]) =>
      mon.moves.some(([move, level]) => move === id && level > 1));
    // Level-one-only and unavailable moves have no later unlock to exercise.
    if (!entry) continue;
    const [dex, mon] = entry, level = mon.moves.find(([move]) => move === id)[1];
    const save = { owned: { [dex]: { at: 1 } }, ptm: {} };
    training.state(save, dex);
    save.training[dex].xp = training.xpAt(dex, level - 1);
    assert(!training.available(save, dex).includes(id), id + ' unlocked early');
    const original = training.state(save, dex).loadout;
    save.training[dex].xp = training.xpAt(dex, level);
    assert(training.available(save, dex).includes(id), id + ' still locked');
    assert.deepEqual(training.state(save, dex).loadout, original);
    assert.throws(() => training.setLoadout(save, dex, [id]), /including an attack/);
    const attack = training.available(save, dex).find(move => !data.moves[move]?.support);
    training.setLoadout(save, dex, [attack, id]);
    training.normalize(save);
    assert.deepEqual(training.state(save, dex).loadout, [attack, id]);
  }
});

test('new core copies retain selected-version canonical unlock examples', () => {
  for (const [id, dex, level] of [
    ['amnesia', 54, 34], ['calm-mind', 175, 18], ['shift-gear', 599, 40],
    ['recover', 120, 48], ['roost', 16, 37], ['tail-glow', 313, 22]
  ]) {
    assert(data.pokemon[dex].moves.some(([move, at]) => move === id && at === level), id);
  }
});

test('removed moves are implemented without inventing modern official learners', () => {
  for (const id of ['sharpen', 'meditate', 'barrier', 'shelter', 'heal-order']) {
    assert.equal(data.moves[id].support, true);
    for (const mon of Object.values(data.pokemon)) {
      assert(!mon.moves.some(([move]) => move === id), id);
      assert(!mon.tms.includes(id), id);
    }
  }
});

test('support-only starting moves still get the damaging Struggle fallback', () => {
  const training = create(data), save = { owned: { 27: { at: 1 } }, ptm: {} };
  assert.deepEqual(training.available(save, 27), ['struggle', 'defense-curl']);
  assert.deepEqual(training.state(save, 27).loadout, ['struggle', 'defense-curl']);
});

test('base-form coverage partitions all unevolved species without fabricated eligibility', () => {
  const bases = Object.entries(data.pokemon).filter(([, mon]) => mon.prevo === 0);
  const covered = bases.filter(([, mon]) => mon.moves.some(([id]) => buffs.has(id)));
  const uncovered = bases.filter(([, mon]) => !mon.moves.some(([id]) => buffs.has(id)));
  assert.equal(bases.length, 541);
  assert.equal(covered.length, 396);
  assert.equal(uncovered.length, 145);
  const original = new Set(['harden', 'defense-curl', 'withdraw', 'sharpen', 'meditate', 'howl']);
  assert.equal(covered.filter(([, mon]) =>
    mon.moves.some(([id, level]) => original.has(id) && level <= 1)).length, 46);
  const allSupport = bases.filter(([, mon]) => mon.moves.some(([id]) => data.moves[id].support));
  assert.equal(allSupport.length, 396);
  assert.equal(covered.length + uncovered.length, bases.length);
  assert(covered.some(([dex]) => dex === '7'));
  assert(uncovered.some(([dex]) => dex === '129'));
  assert(bases.some(([dex]) => dex === '150'));
});
