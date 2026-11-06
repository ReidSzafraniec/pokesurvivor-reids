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

test('initial build reuses move slots, locks navigation and finishes only once', () => {
  const { model, context, save } = installFixture();
  assert.equal(typeof model.openInitialBuild, 'function');
  const nodes = new Map();
  function node() {
    const classes = new Set();
    return { children: [], value: '', textContent: '', disabled: false,
      classList: { add: v => classes.add(v), remove: v => classes.delete(v),
        contains: v => classes.has(v), toggle(v, on) { on ? classes.add(v) : classes.delete(v); } },
      replaceChildren(...children) { this.children = children; },
      append(...children) { this.children.push(...children); }, setAttribute() {}, focus() {} };
  }
  const originalDocument = global.document, originalOption = global.Option;
  global.document = { getElementById(id) {
    if (!nodes.has(id)) nodes.set(id, node());
    return nodes.get(id);
  }, createElement: node };
  global.Option = class { constructor(label, value) { this.textContent = label; this.value = value; } };
  try {
    context.T = v => v;
    context.I18n.locale = 'en';
    context.U.esc = String;
    context.UI.isOpen = () => false;
    context.UI.sprite = () => {};
    context.Game.state = 'ui';
    context.Social = { room: null };
    context.SPRITE_META = {};
    context.Shop = { count: () => 0 };
    context.Skins = { worn: () => null };
    context.Icons = { html: () => '' };
    context.Mons.abilityOf = () => ({ id: null });
    context.Mons.abilityChoices = () => [];
    context.DB.user = 'test-account';
    save.partner = 25;
    model.ensureLevel(save, 25, 5);
    let completed = 0;
    model.openInitialBuild(25, () => completed++);
    assert.equal(nodes.get('training-mon').disabled, true);
    assert(nodes.get('training-back').classList.contains('hidden'));
    assert(nodes.get('training-tab-perks').disabled);
    assert(!nodes.get('training-initial').classList.contains('hidden'));
    assert(!nodes.get('training-finish').classList.contains('hidden'));
    assert.equal(nodes.get('training-slots').children.length, 4);
    const finish = nodes.get('training-finish').onclick;
    finish(); finish();
    assert.equal(completed, 1);
    model.open(25);
    assert(!nodes.get('training-back').classList.contains('hidden'));
    assert(!nodes.get('training-tab-perks').disabled);
    assert(nodes.get('training-finish').classList.contains('hidden'));
  } finally { global.document = originalDocument; global.Option = originalOption; }
});

test('ensureLevel validates the level and ownership before changing the save', () => {
  const save = saveFor(4), original = JSON.stringify(save);
  for (const level of [0, 101, -1, 1.5, NaN, Infinity, '5', undefined]) {
    assert.throws(() => training.ensureLevel(save, 4, level), RangeError);
    assert.equal(JSON.stringify(save), original);
  }
  assert.throws(() => training.ensureLevel(save, 7, 5), /owned/);
  assert.throws(() => training.ensureLevel(save, 9999, 5), /Unknown Pokemon/);
  assert.equal(JSON.stringify(save), original);
  assert.equal(training.ensureLevel(save, 4, 1).level, 1);
  assert.equal(training.ensureLevel(save, 4, 100).level, 100);
});

test('ensureLevel uses every species official growth floor without changing ordinary starting levels', () => {
  assert.equal(training.START_LEVEL, 1);
  for (const dex of Object.keys(data.pokemon)) {
    const save = saveFor(dex);
    assert.equal(training.state(save, dex).level, 1);
    const result = training.ensureLevel(save, dex, 5);
    assert.equal(result.xp, training.xpAt(dex, 5), dex);
    assert.equal(result.level, 5, dex);
    assert.equal(save.training[dex].updated, 0);
    assert(result.loadout.some(id => id === 'struggle' || !data.moves[id].support), dex);
    assert.deepEqual(training.ensureLevel(save, dex, 5), result);
    assert.equal(training.state(saveFor(dex), dex).level, 1);
  }
});

test('ensureLevel replaces obsolete Struggle with the existing real-attack default', () => {
  const save = saveFor(4);
  assert.deepEqual(training.state(save, 4).loadout, ['struggle']);
  save.training[4].updated = 321;
  const result = training.ensureLevel(save, 4, 5);
  assert.deepEqual(result.loadout, ['ember', 'agility', 'harden', 'swords-dance']);
  assert.equal(save.training[4].updated, 321);
});

test('ensureLevel preserves chosen loadouts, timestamps, inheritance and higher XP', () => {
  const save = saveFor(7, 2);
  atLevel(save, 7, 3);
  training.setLoadout(save, 7, ['water-gun'], 123);
  const owned = JSON.stringify(save.owned);
  assert.deepEqual(training.ensureLevel(save, 7, 5).loadout, ['water-gun']);
  assert.equal(save.training[7].updated, 123);
  atLevel(save, 2, 30);
  Object.assign(save.training[2], {
    xp: training.xpAt(2, 30) + 17, inherited: ['harden'],
    loadout: ['tackle', 'harden'], updated: 456, evolutionLevel: 30
  });
  const existing = JSON.stringify(save.training[2]);
  training.ensureLevel(save, 2, 5);
  assert.equal(JSON.stringify(save.training[2]), existing);
  assert.equal(JSON.stringify(save.owned), owned);
});

test('tutorial awards exactly the level-five floor across every species without learning bonuses', () => {
  for (const dex of Object.keys(data.pokemon)) {
    const save = saveFor(dex);
    save.pupg = { [dex]: { xp: 8 } };
    const before = training.state(save, dex);
    const previous = training.available(save, dex);
    const result = training.awardTutorial(save, dex);
    assert.deepEqual(Object.keys(result).sort(),
      ['dex', 'before', 'after', 'gained', 'earned', 'unlocked', 'evolution'].sort());
    assert.equal(result.dex, +dex);
    assert.deepEqual(result.before, before);
    assert.equal(result.after.xp, training.xpAt(dex, 5), dex);
    assert.equal(result.after.level, 5);
    assert.equal(result.gained, training.xpAt(dex, 5));
    assert.equal(result.earned, result.gained);
    assert.deepEqual(result.unlocked,
      training.available(save, dex).filter(id => id !== 'struggle' && !previous.includes(id)));
    assert.equal(result.evolution, null);
    assert.equal(save.training[dex].updated, 0);
  }
});

test('tutorial awards only missing floor XP and preserves higher saved progress without evolution', () => {
  for (const level of [3, 5, 40, 100]) {
    const save = saveFor(4, 7);
    atLevel(save, 4, level);
    if (level < 100) save.training[4].xp += 7;
    if (level >= 5) training.setLoadout(save, 4, ['ember'], 987);
    const before = training.state(save, 4), other = JSON.stringify(save.owned[7]);
    const result = training.awardTutorial(save, 4);
    assert.equal(result.after.xp, Math.max(before.xp, training.xpAt(4, 5)));
    assert.equal(result.gained, result.after.xp - before.xp);
    assert.equal(result.earned, result.gained);
    assert.equal(result.evolution, null);
    if (level >= 5) {
      assert.deepEqual(result.after.loadout, before.loadout);
      assert.equal(save.training[4].updated, 987);
      assert.deepEqual(result.unlocked, []);
    }
    assert.equal(training.awardTutorial(save, 4).gained, 0);
    assert.equal(JSON.stringify(save.owned[7]), other);
    assert.equal(training.state(save, 7).level, 1);
  }
  assert.throws(() => training.awardTutorial(saveFor(), 4), /owned/);
});

test('Synthesis is absent from supported moves and every species learnset', () => {
  assert.equal(data.moves.synthesis, undefined);
  for (const [dex, mon] of Object.entries(data.pokemon)) {
    assert(!mon.moves.some(([id]) => id === 'synthesis'), dex + ': level-up moves');
    assert(!mon.tms.includes('synthesis'), dex + ': TMs');
  }
});

test('old Synthesis loadouts lose only the removed move and preserve permanent XP', () => {
  const save = saveFor(1);
  atLevel(save, 1, 100);
  Object.assign(save.training[1], {
    loadout: ['tackle', 'synthesis', 'growth'], updated: 123
  });
  const xp = save.training[1].xp;
  training.normalize(save);
  assert.deepEqual(training.state(save, 1).loadout, ['tackle', 'growth']);
  assert.equal(save.training[1].xp, xp);
  assert.equal(save.training[1].updated, 123);
  assert(!training.available(save, 1).includes('synthesis'));
  assert.throws(() => training.setLoadout(save, 1, ['tackle', 'synthesis']), RangeError);
});

test('a removed Synthesis-only loadout receives the existing playable default', () => {
  const save = saveFor(1);
  atLevel(save, 1, 100);
  save.training[1].loadout = ['synthesis'];
  training.normalize(save);
  const { loadout } = training.state(save, 1);
  assert(!loadout.includes('synthesis'));
  assert(loadout.some(id => id === 'struggle' || !data.moves[id].support));
});

test('old inherited Synthesis is removed without losing other inherited moves', () => {
  const save = saveFor(2);
  atLevel(save, 2, 100);
  Object.assign(save.training[2], {
    inherited: ['synthesis', 'seed-bomb'], loadout: ['tackle', 'synthesis', 'seed-bomb']
  });
  const xp = save.training[2].xp;
  training.normalize(save);
  assert.deepEqual(save.training[2].inherited, ['seed-bomb']);
  assert.deepEqual(training.state(save, 2).loadout, ['tackle', 'seed-bomb']);
  assert.equal(save.training[2].xp, xp);
});

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

test('base-form buffs unlock at five without TMs and persist in a legal saved loadout', () => {
  for (const dex of [1, 4, 7, 129, 132, 201]) {
    const save = saveFor(dex);
    atLevel(save, dex, 4);
    const original = training.state(save, dex);
    const buffs = data.pokemon[dex].moves
      .filter(([id, level]) => level === 5 && data.moves[id].support).map(([id]) => id);
    assert(buffs.length >= 2, dex + ': missing level-five buffs');
    for (const id of buffs) assert(!training.available(save, dex).includes(id));
    save.training[dex].xp = training.xpAt(dex, 5);
    assert.deepEqual(training.state(save, dex).loadout, original.loadout);
    for (const id of buffs) assert(training.available(save, dex).includes(id));
    const attack = training.available(save, dex).find(id => id === 'struggle' || !data.moves[id].support);
    const loadout = [attack, ...buffs];
    training.setLoadout(save, dex, loadout);
    const reloaded = JSON.parse(JSON.stringify(save));
    training.normalize(reloaded);
    assert.deepEqual(training.state(reloaded, dex).loadout, loadout);
    assert.equal(training.state(reloaded, dex).xp, training.xpAt(dex, 5));
    assert.throws(() => training.setLoadout(reloaded, dex, buffs), /including an attack/);
    assert.throws(() => training.setLoadout(reloaded, dex, [...loadout, attack]), RangeError);
  }
});

test('crossing permanent level five reports each new buff once without replacing selected moves', () => {
  const save = saveFor(1);
  atLevel(save, 1, 4);
  const before = training.state(save, 1);
  save.training[1].xp = training.xpAt(1, 5) - 1;
  const result = training.award(save, 1, { time: 2, kills: 0, bosses: 0 });
  assert.equal(result.after.level, 5);
  assert.deepEqual(result.unlocked, ['agility', 'growth', 'harden']);
  assert.deepEqual(result.after.loadout, before.loadout);
  assert.deepEqual(training.award(save, 1, { time: 2, kills: 0, bosses: 0 }).unlocked, []);
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
  const save = saveFor(4, 7);
  atLevel(save, 4, 11);
  save.training[4].xp = training.xpAt(4, 12) - 1;
  assert(!training.available(save, 4).includes('dragon-breath'));
  const first = training.award(save, 4, { time: 1, kills: 0, bosses: 0 });
  assert.equal(first.gained, 0);
  assert.equal(first.after.level, 11);
  const second = training.award(save, 4, { time: 2, kills: 0, bosses: 0 });
  assert.equal(second.after.level, 12);
  assert(second.unlocked.includes('dragon-breath'));
  assert.equal(training.state(save, 7).level, 1);
  assert.equal(training.reward({ time: 60, kills: 10, bosses: 1 }), 51);
});

test('permanent rewards favor survival and defeats without excessive horde scaling or quit farming', () => {
  const reward = (time, kills, bosses = 0) => training.reward({ time, kills, bosses });
  assert.equal(reward(0, 0), 0);
  assert.equal(reward(180, 0), 90);
  assert.equal(reward(180, 60, 1), 130);
  assert.equal(reward(300, 150, 2), 233);
  assert.equal(reward(300, 150, 3) - reward(300, 150, 2), 15);
  assert(reward(300, 150) > reward(180, 150));
  assert(reward(300, 150) > reward(300, 60));
  const low = reward(300, 100), middle = reward(300, 200), high = reward(300, 300);
  assert(high - middle < middle - low);
  assert(reward(1800, 10000, 20) < 2300);
  for (const [time, kills, bosses, parts] of [[300, 150, 2, 2], [1800, 900, 12, 6]]) {
    assert(reward(time, kills, bosses) >= parts * reward(time / parts, kills / parts, bosses / parts));
  }
});

test('early training boost ends at level 10 and later XP is converted at every crossed level', () => {
  const slow = saveFor(129);
  assert.equal(training.award(slow, 129, { time: 1200, kills: 0, bosses: 0 }).after.level, 10);
  assert.equal(training.state(slow, 129).xp, training.xpAt(129, 10));
  assert.equal(training.award(slow, 129, { time: 2, kills: 0, bosses: 0 }).gained, 1);

  const save = saveFor(4);
  atLevel(save, 4, 12);
  const cost = (training.xpAt(4, 13) - training.xpAt(4, 12)) / (1 + 2 / 3);
  const points = Math.ceil(cost) + 60;
  const result = training.award(save, 4, { time: points * 2, kills: 0, bosses: 0 });
  assert.equal(result.after.level, 13);
  assert.equal(result.after.xp, training.xpAt(4, 13) + Math.floor((points - cost) * 2));
  assert.equal(result.earned, result.gained);

  const erraticDex = +Object.keys(data.pokemon).find(dex => data.pokemon[dex].growth === 5);
  assert.equal(training.award(saveFor(erraticDex), erraticDex, {
    time: 60, kills: 10, bosses: 1
  }).gained, 153);
});

test('all growth groups reach level 10 in 10-15 minutes of representative short runs', () => {
  for (const growth of Object.keys(data.growth)) {
    const dex = +Object.keys(data.pokemon).find(id => data.pokemon[id].growth === +growth);
    for (const performance of [
      { time: 180, kills: 60, bosses: 1 }, { time: 300, kills: 150, bosses: 2 }
    ]) {
      let save = saveFor(dex), minutes = 0;
      while (training.state(save, dex).level < 10 && minutes < 20) {
        training.award(save, dex, performance);
        minutes += performance.time / 60;
        save = JSON.parse(JSON.stringify(save));
        training.normalize(save);
      }
      assert(minutes >= 10 && minutes <= 15, 'Growth ' + growth + ': ' + minutes + ' minutes');
    }
  }
});

test('typical starters reach level 36 in 2-3 hours, with slower later levels', () => {
  for (const dex of [1, 4, 7, 152, 252, 387, 495, 650, 722, 810, 906]) {
    for (const performance of [
      { time: 180, kills: 60, bosses: 1 }, { time: 300, kills: 150, bosses: 2 },
      { time: 600, kills: 600, bosses: 5 }
    ]) {
      const save = saveFor(dex), reached = {};
      let minutes = 0;
      while (training.state(save, dex).level < 50 && minutes < 600) {
        const result = training.award(save, dex, performance);
        minutes += performance.time / 60;
        for (const level of [10, 20, 36, 50]) {
          if (result.after.level >= level && !reached[level]) reached[level] = minutes;
        }
      }
      assert(reached[36] >= 120 && reached[36] <= 180, 'Starter ' + dex + ': ' + reached[36]);
      assert(reached[20] - reached[10] > reached[10]);
      assert((reached[50] - reached[36]) / 14 > (reached[20] - reached[10]) / 10);
    }
  }
});

test('rebalancing preserves already-earned official XP, levels and selected moves', () => {
  const save = saveFor(4, 25);
  atLevel(save, 4, 36);
  atLevel(save, 25, 80);
  training.setLoadout(save, 4, ['ember', 'dragon-breath']);
  const before = [4, 25].map(dex => training.state(save, dex));
  const reloaded = JSON.parse(JSON.stringify(save));
  const model = create(data);
  model.normalize(reloaded);
  assert.deepEqual([4, 25].map(dex => model.state(reloaded, dex)), before);
  model.award(reloaded, 4, { time: 300, kills: 150, bosses: 2 });
  assert(model.state(reloaded, 4).xp > before[0].xp);
  assert.deepEqual(model.state(reloaded, 4).loadout, before[0].loadout);
  assert.deepEqual(model.state(reloaded, 25), before[1]);
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
  assert.equal(training.award(save, 4, { time: 0, kills: 0, bosses: 0 }).earned, 0);
});

test('invalid performance and invalid levels are explicitly rejected', () => {
  for (const time of [-1, NaN, Infinity, Number.MAX_VALUE]) {
    assert.throws(() => training.reward({ time, kills: 0, bosses: 0 }), RangeError);
  }
  assert.throws(() => training.reward({ time: 1, kills: 0.1, bosses: 0 }), RangeError);
  for (const field of ['kills', 'bosses']) {
    for (const value of [-1, NaN, Infinity, 0.1, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => training.reward({ time: 60, kills: 0, bosses: 0, [field]: value }), RangeError);
    }
  }
  for (const level of [0, 101, 2.5]) assert.throws(() => training.xpAt(4, level), RangeError);
  assert.throws(() => training.state(saveFor(4), 7), RangeError);
  assert.throws(() => training.state(saveFor(4), '__proto__'), RangeError);
});

test('unlocking an attack never replaces an already valid loadout', () => {
  const save = saveFor(4);
  atLevel(save, 4, 4);
  training.setLoadout(save, 4, ['ember']);
  training.award(save, 4, { time: 3000, kills: 0, bosses: 0 });
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
  assert.deepEqual(training.available(save, 129), ['agility', 'harden', 'swords-dance', 'tackle']);
  assert.deepEqual(training.state(save, 129).loadout, ['tackle', 'agility', 'harden', 'swords-dance']);
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
  assert(offers.every(offer => !Object.hasOwn(offer, 'tag')));
  offers[0].apply(player);
  assert.equal(player.hp, 120);
  assert.equal(player.statsTaken.hp, 1);
  assert.deepEqual(player.moves, ['ember']);
});

function installFixture() {
  const model = create(data), save = saveFor(25, 129), events = [];
  const context = {
    DEX: [25, 129].map(dex => ({
      dex, hp: 100, pa: 1.2, sa: 0.8, atk: 1.2, df: 200, sd: 50, spd: 100, types: ['normal']
    })),
    Moves: { BY_ID: Object.fromEntries(Object.keys(data.moves).map(id => [
      id, { id, name: id, kind: id === 'tackle' ? 'melee' : 'shot', cd: 0.5 }
    ])) },
    Mons: {},
    I18n: { add() {} },
    DB: { save, onSync() {} },
    Upgrades: {},
    LevelUp: { STATS: [] },
    U: {
      pickN: (items, count) => items.slice(0, count),
      clamp: (value, low, high) => Math.max(low, Math.min(high, value))
    },
    Progress: {
      event(name, details) {
        events.push({ name, details, xp: model.state(save, 25).xp });
        return 'original-event';
      }
    },
    RunUI: { showOver() {} },
    UI: { show() {}, refreshCoins() {} },
    MenuUI: { init() {} },
    Flow: { play() {} },
    Game: {}
  };
  context.DEX_BY = Object.fromEntries(context.DEX.map(mon => [mon.dex, mon]));
  loadNativeStats(context);
  model.install(context);
  return { model, context, events, save };
}

function loadNativeStats(context) {
  const source = fs.readFileSync(require.resolve('../js/app.min.js'), 'utf8');
  const runtime = vm.createContext({ _0x599208: context });
  vm.runInContext(source.slice(0, source.indexOf('const a0_0xc9496a=')) +
    source.slice(source.lastIndexOf('function a0_0x48f4()')), runtime, { timeout: 3000 });
  runtime._0x48be02 = runtime.a0_0x422d;
  for (const [first, next] of [['NATURES', 'ABIL'], ['Stats', 'AbilityFX'], ['Upgrades', 'Items']]) {
    const start = source.indexOf("_0x599208['" + first + "']="),
      end = next === 'ABIL' ? source.indexOf('_0x599208[_0x48be02(0x5e2)]', start)
        : source.indexOf(",_0x599208['" + next + "']=", start);
    assert(start > 0 && end > start);
    vm.runInContext(source.slice(start, end), runtime, { timeout: 3000 });
  }
}

test('permanent stats grow to exact endpoints and nature applies once without changing species', () => {
  const { model, context, save } = installFixture();
  save.pnat = { 25: ['hasty', 1], 129: ['hardy', 1] };
  const original = JSON.stringify(context.DEX_BY);
  const first = model.statsFor(25);
  assert.equal(first.hp, 100);
  assert.equal(first.df, 180);
  assert.equal(first.spd, 110.00000000000001);
  for (const level of [2, 50, 100]) {
    atLevel(save, 25, level);
    const stats = context.Mons.monFor(25), fraction = (level - 1) / 99;
    for (const key of ['hp', 'pa', 'sa', 'df', 'sd']) {
      assert.equal(stats[key], first[key] * (1 + 0.5 * fraction), key);
    }
    assert.equal(stats.spd, first.spd * (1 + 0.15 * fraction));
    assert.equal(stats.atk, Math.max(stats.pa, stats.sa));
    assert.deepEqual(model.statsFor(25), stats);
  }
  assert.equal(JSON.stringify(context.DEX_BY), original);
  const neutral = model.statsFor(129);
  for (const key of ['hp', 'pa', 'sa', 'df', 'sd', 'spd']) {
    assert.equal(neutral[key], context.DEX_BY[129][key]);
  }
  delete save.owned[129];
  assert.equal(context.Mons.monFor(129).hp, 100);
});

test('native player damage and durability use permanent stats beyond the old defense clamp', () => {
  const { model, context, save } = installFixture();
  save.pnat = { 25: ['hardy', 1] };
  loadNativePlayer(context);
  const baseline = context.Mons.monFor(25);
  const low = new context.Player(baseline);
  const physical = low.atkFor({ cat: 'physical', type: 'ghost' });
  const special = low.atkFor({ cat: 'special', type: 'ghost' });
  const incoming = ['physical', 'special'].map(cat => context.Stats.taken(baseline, cat));
  atLevel(save, 25, 100);
  const high = new context.Player(context.Mons.monFor(25));
  assert.equal(high.maxHp, low.maxHp * 1.5);
  assert.equal(high.baseSpd, low.baseSpd * 1.15);
  assert.equal(high.atkFor({ cat: 'physical', type: 'ghost' }), physical * 1.5);
  assert(Math.abs(high.atkFor({ cat: 'special', type: 'ghost' }) - special * 1.5) < 1e-12);
  for (const [index, cat] of ['physical', 'special'].entries()) {
    assert.equal(context.Stats.taken(high.mon, cat), incoming[index] / Math.pow(1.5, 0.35));
    assert(context.Stats.taken(high.mon, cat) < incoming[index]);
  }
  assert.equal(context.Stats.taken(context.DEX_BY[25], 'physical'), incoming[0]);
  assert.equal(context.Stats.taken(high.mon, null), 1);
  assert.equal(context.Stats.taken(null, 'physical'), 1);
  high.maxHp += 20;
  assert.equal(high.maxHp, 170);
  assert.equal(new context.Player(context.Mons.monFor(25)).maxHp, 150);
});

test('speed and utility perks remain purchasable while other old core-stat ranks are inert', () => {
  const { context } = installFixture();
  assert.deepEqual(Array.from(context.Upgrades.LIST, perk => perk.id),
    ['spd', 'cd', 'regen', 'magnet', 'xp', 'coins', 'crit', 'reroll']);
  const old = { hp: 10, atk: 10, spd: 8, def: 8, xp: 8, crit: 10, cd: 8 };
  const perks = context.Upgrades.perks(old);
  assert.equal(perks.hp, 0);
  assert.equal(perks.atkMul, 1);
  assert.equal(perks.spdMul, 1.24);
  assert.equal(perks.dmgReduce, 0);
  assert.equal(perks.xpMul, 1.4);
  assert.equal(perks.crit, 0.3);
  assert.equal(perks.cdMul, 0.76);
  assert.equal(context.Upgrades.cost('xp', 0), 100);
  assert.equal(context.Upgrades.BY.xp.max, 8);
  assert.equal(old.hp, 10);
});

test('speed purchases retain original prices and cap and persist per Pokemon', () => {
  const { model, context, save } = installFixture();
  context.Game.state = 'ui';
  const persisted = [];
  context.DB.commit = () => {
    persisted.push(JSON.parse(JSON.stringify(save)));
    return true;
  };
  const perk = context.Upgrades.LIST.find(perk => perk.id === 'spd');
  assert(perk);
  assert.equal(perk.max, 8);
  assert.equal(perk.base, 70);
  assert.equal(perk.grow, 1.4);
  assert.equal(context.Upgrades.cost('spd', 0), 70);
  assert.equal(context.Upgrades.cost('spd', 1), 100);
  save.coins = 10000;
  for (let rank = 0; rank < 8; rank++) {
    const coins = save.coins, cost = 10 * Math.round(70 * 1.4 ** rank / 10);
    assert.equal(context.Upgrades.cost('spd', rank), cost);
    assert(model.buyPerk(25, 'spd'));
    assert.equal(save.coins, coins - cost);
    assert.equal(save.pupg[25].spd, rank + 1);
    assert.equal(persisted.at(-1).pupg[25].spd, rank + 1);
    assert.equal(context.Upgrades.perks(save.pupg[25]).spdMul, 1 + 0.03 * (rank + 1));
    assert.equal(save.pupg[129], undefined);
  }
  const coins = save.coins;
  assert.throws(() => model.buyPerk(25, 'spd'), /maximum/);
  assert.equal(save.coins, coins);
  assert.equal(persisted.length, 8);
});

test('speed purchases enforce ownership, funds and between-run access', () => {
  const { model, context, save } = installFixture();
  context.Game.state = 'ui';
  context.DB.guest = true;
  save.coins = 69;
  assert.throws(() => model.buyPerk(25, 'spd'), /coins/);
  assert.equal(save.coins, 69);
  assert.equal(save.pupg, undefined);
  assert.throws(() => model.buyPerk(4, 'spd'), /owned/);
  save.coins = 70;
  context.Game.state = 'playing';
  assert.throws(() => model.buyPerk(25, 'spd'), /between/);
  assert.equal(save.coins, 70);
});

test('saved speed ranks stack with permanent level growth in each new run', () => {
  const { model, context } = installFixture();
  loadNativePlayer(context);
  context.Weather = { speedFor: () => 1 };
  for (const level of [1, 100]) {
    atLevel(context.DB.save, 25, level);
    const mon = context.Mons.monFor(25);
    const baseline = new context.Player(mon);
    for (const rank of [0, 1, 8, 99]) {
      context.DB.save.pupg = { 25: { spd: rank } };
      context.DB.save = JSON.parse(JSON.stringify(context.DB.save));
      model.normalize(context.DB.save);
      const perks = context.Upgrades.perks(context.DB.save.pupg[25]);
      const multiplier = 1 + 0.03 * Math.min(rank, 8);
      for (let run = 0; run < 2; run++) {
        const player = new context.Player(context.Mons.monFor(25), perks);
        model.preparePlayer(player);
        assert.equal(player.pokemonLevel, level);
        assert.equal(player.baseSpd, baseline.baseSpd);
        assert.equal(player.spdMul, multiplier);
        assert.equal(player.spd, baseline.spd * multiplier);
      }
      assert.equal(context.Upgrades.perks(context.DB.save.pupg[129]).spdMul, 1);
    }
  }
});

test('learning speed boosts both XP channels and is snapshotted without item multipliers', () => {
  for (const rank of [0, 1, 8, 99]) {
    const { model, context, save } = installFixture();
    save.pupg = { 25: { xp: rank } };
    const multiplier = 1 + 0.05 * Math.min(rank, 8);
    assert.equal(model.learningMultiplier(save, 25), multiplier);
    assert.equal(context.Upgrades.perks(save.pupg[25]).xpMul, multiplier);
    loadNativePlayer(context);
    const player = new context.Player(context.Mons.monFor(25), context.Upgrades.perks(save.pupg[25]));
    context.Game.player = player;
    player.kills = 150;
    player.bosses = 2;
    model.preparePlayer(player);
    const xp = player.xp;
    player.gainXp(1);
    assert.equal(player.xp - xp, multiplier);
    player.xpMul *= 10;
    save.pupg[25].xp = 0;
    context.Progress.event('runEnd', { time: 300 });
    const expected = saveFor(25);
    training.award(expected, 25, { time: 300, kills: 150, bosses: 2 }, multiplier);
    assert.equal(model.state(save, 25).xp, training.state(expected, 25).xp);
    const earlyRate = Math.max(1, model.xpAt(25, 10) / 600);
    assert.equal(model.state(save, 25).xp, Math.floor(233 * multiplier * earlyRate));
    context.Progress.event('runEnd', { time: 300 });
    assert.equal(model.state(save, 25).xp, training.state(expected, 25).xp);
  }
});

test('perk purchases enforce ownership, allowed IDs, costs, caps and between-run access', () => {
  const { model, context, save } = installFixture();
  context.Game.state = 'ui';
  save.coins = 1000;
  context.DB.guest = true;
  let chromeCoins;
  context.UI.refreshCoins = () => { chromeCoins = save.coins; };
  const before = model.state(save, 25).xp;
  assert(model.buyPerk(25, 'xp'));
  assert.equal(save.coins, 900);
  assert.equal(chromeCoins, 900);
  assert.equal(save.pupg[25].xp, 1);
  assert.equal(model.state(save, 25).xp, before);
  for (const id of ['hp', 'atk', 'def', 'moves', 'nope']) {
    assert.throws(() => model.buyPerk(25, id), /utility perk/);
  }
  assert.throws(() => model.buyPerk(4, 'xp'), /owned/);
  save.coins = 0;
  assert.throws(() => model.buyPerk(25, 'xp'), /coins/);
  assert.equal(save.pupg[25].xp, 1);
  save.pupg[25].xp = 8;
  assert.throws(() => model.buyPerk(25, 'xp'), /maximum/);
  assert.equal(save.coins, 0);
  context.Game.state = 'playing';
  assert.throws(() => model.buyPerk(25, 'crit'), /between/);
});

test('Training nature and ability changes consume only the required owned item', () => {
  const { model, context, save } = installFixture();
  context.Game.state = 'ui';
  context.DB.guest = true;
  save.bag = { mint: 1, cap: 1, caph: 1 };
  context.DEX_ABIL = { 25: ['static', 'lightning-rod', 'surge-surfer'] };
  save.pabil = { 25: [0, 1] };
  context.Shop = {
    count: id => save.bag[id] || 0,
    take(id) {
      if (!save.bag[id]) return false;
      save.bag[id]--;
      return true;
    }
  };
  assert.throws(() => model.useNature(25, 'missing'), /nature/);
  assert.equal(save.bag.mint, 1);
  assert(model.useNature(25, 'hasty'));
  assert.equal(save.bag.mint, 0);
  assert.equal(context.Mons.natureOf(25).id, 'hasty');
  assert.throws(() => model.useNature(25, 'hardy'), /item/);
  assert.throws(() => model.useAbility(25, 2, 'cap'), /ability/);
  assert.equal(save.bag.cap, 1);
  assert(model.useAbility(25, 1, 'cap'));
  assert.equal(save.bag.cap, 0);
  assert.equal(context.Mons.abilityOf(25).slot, 1);
  assert(model.useAbility(25, 2, 'caph'));
  assert.equal(save.bag.caph, 0);
  assert.equal(context.Mons.abilityOf(25).slot, 2);
  context.Game.state = 'playing';
  assert.throws(() => model.useNature(25, 'hardy'), /between/);
});

test('purchased learning speed crosses thresholds and caps XP without rounding the multiplier early', () => {
  const save = saveFor(25);
  save.pupg = { 25: { xp: 8 } };
  atLevel(save, 25, 99);
  save.training[25].xp = training.xpAt(25, 100) - 1;
  assert.equal(training.award(save, 25, { time: 2, kills: 0, bosses: 0 }).after.level, 100);
  assert.equal(training.award(save, 25, { time: 10000, kills: 1000, bosses: 100 }).gained, 0);
  for (const multiplier of [NaN, Infinity, 0, -1, 1.5]) {
    assert.throws(() => training.award(save, 25, { time: 1, kills: 0, bosses: 0 }, multiplier),
      /learning multiplier/);
  }
});

test('a failed perk save reports the persistence error rather than claiming success', () => {
  const { model, context, save } = installFixture();
  context.Game.state = 'ui';
  save.coins = 100;
  let warning;
  context.DB.commit = () => false;
  context.UI.toast = message => { warning = message; };
  context.T = text => text;
  assert.equal(model.buyPerk(25, 'xp'), false);
  assert.match(warning, /No se pudo guardar/);
});

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

function loadNativePlayer(context) {
  const source = fs.readFileSync(require.resolve('../js/app.min.js'), 'utf8');
  const runtime = vm.createContext({ _0x599208: context });
  const bootstrap = source.slice(0, source.indexOf('const a0_0xc9496a=')) +
    source.slice(source.lastIndexOf('function a0_0x48f4()'));
  vm.runInContext(bootstrap, runtime, { timeout: 3000 });
  runtime._0x48be02 = runtime.a0_0x422d;
  const start = source.indexOf("_0x599208['Player']=class");
  const end = source.indexOf(",_0x599208['Stats']=", start);
  assert(start > 0 && end > start);
  vm.runInContext(source.slice(start, end), runtime, { timeout: 3000 });
  context.Sprites = {
    hasShiny: () => false, playerScale: () => 1, playerRadius: () => 8,
    bodyHeight: () => 16, Animator: class {}
  };
  context.Moves.instance = id => ({ ...context.Moves.BY_ID[id], lvl: 1 });
  context.Game.st = { time: 0 };
  return runtime;
}

test('actual upgrade cards omit absent badges and preserve labeled badges and selection', () => {
  const { context } = installFixture();
  const runtime = loadNativePlayer(context);
  const source = fs.readFileSync(require.resolve('../js/app.min.js'), 'utf8');
  const start = source.indexOf('function _0x36f88e(');
  const end = source.indexOf('function _0x128f9d(', start);
  assert(start > 0 && end > start);
  const cards = [];
  const container = { appendChild: card => cards.push(card) };
  runtime.document = {
    createElement: () => ({ dataset: {}, classList: { add() {} } })
  };
  runtime._0x35b851 = id => id === 'cards'
    ? container : { classList: { toggle() {} } };
  runtime._0x28e4f6 = () => 1;
  runtime._0x5c28bf = (card, choose) => { card.onclick = choose; };
  let selected;
  runtime._0x128f9d = index => { selected = index; };
  context.Icons = { html: icon => '<i data-icon="' + icon + '"></i>' };
  vm.runInContext(source.slice(start, end), runtime, { timeout: 3000 });
  const base = {
    type: 'stat', icon: 'power', color: '#8fa3c4',
    title: 'Power', desc: '+10% physical damage'
  };
  runtime._0x36f88e([
    base, { ...base, tag: '' }, { ...base, tag: 'Tagged stat' },
    { ...base, type: 'new', tag: 'Fire', cat: 'Special' },
    { ...base, type: 'up', tag: 'Fire' },
    { ...base, type: 'evo', tag: 'Evolution' }
  ]);
  assert.equal(cards.length, 6);
  for (const card of cards.slice(0, 2)) {
    assert.doesNotMatch(card.innerHTML, /tag-chip|undefined/);
    assert.match(card.innerHTML, /Power/);
    assert.match(card.innerHTML, /\+10% physical damage/);
    assert.match(card.innerHTML, /data-icon="power"/);
  }
  assert.match(cards[0].innerHTML, /class="key">1<\/div>/);
  for (const [index, label] of [[2, 'Tagged stat'], [3, 'Fire'], [4, 'Fire'], [5, 'Evolution']]) {
    assert.match(cards[index].innerHTML, /class="tag-chip"/);
    assert(cards[index].innerHTML.includes(label));
  }
  assert.match(cards[3].innerHTML, /class="tag-chip cat">Special/);
  cards[0].onclick();
  assert.equal(selected, 0);
  cards[2].onclick();
  assert.equal(selected, 2);
});

test('actual run levels and power-ups reset while permanent levels and move unlocks survive', () => {
  const { model, context, save } = installFixture();
  save.owned[4] = { at: 1, from: 'test' };
  atLevel(save, 4, 3);
  loadNativePlayer(context);
  const mon = { dex: 4, hp: 100, atk: 10, spd: 100 };
  const player = new context.Player(mon, { xpMul: 2 });
  context.Game.player = player;
  model.preparePlayer(player);
  const before = model.state(save, 4);
  assert.equal(player.level, 1);
  assert.equal(player.xp, 0);
  assert.equal(player.pokemonLevel, 3);
  assert.equal(player.gainXp(player.xpNext / 2), 1);
  assert.equal(player.level, 2);
  context.LevelUp.STATS = [{
    id: 'hp', title: 'HP', max: 3,
    apply(target) { target.maxHp += 20; target.hp += 20; }
  }];
  const offers = context.LevelUp.offer(player);
  assert(offers.every(offer => offer.type === 'stat'));
  offers[0].apply(player);
  context.Progress.event('levelUp', { level: player.level });
  assert.equal(player.maxHp, 120);
  assert.equal(player.statsTaken.hp, 1);
  assert.deepEqual(model.state(save, 4), before);
  assert(!model.available(save, 4).includes('ember'));
  assert.deepEqual(Array.from(player.moves, move => move.id), ['struggle']);

  player.kills = 60;
  player.bosses = 1;
  context.Progress.event('runEnd', { time: 180 });
  assert.equal(model.state(save, 4).xp, before.xp + 130);
  assert(model.available(save, 4).includes('ember'));
  assert.equal(player.level, 2);
  assert.equal(player.pokemonLevel, 3);
  assert.deepEqual(Array.from(player.moves, move => move.id), ['struggle']);

  const permanent = model.state(save, 4);
  context.DB.save = JSON.parse(JSON.stringify(save));
  model.normalize(context.DB.save);
  assert.deepEqual(model.state(context.DB.save, 4), permanent);
  model.setLoadout(context.DB.save, 4, ['ember']);
  const next = new context.Player(mon);
  context.Game.player = next;
  model.preparePlayer(next);
  assert.equal(next.level, 1);
  assert.equal(next.xp, 0);
  assert.equal(next.xpNext, context.Player.xpFor(1));
  assert.equal(next.pokemonLevel, permanent.level);
  assert.equal(next.maxHp, 100);
  assert.equal(Object.keys(next.statsTaken).length, 0);
  assert.deepEqual(Array.from(next.moves, move => move.id), ['ember']);
});

test('actual orb XP multipliers affect temporary levels, never permanent performance rewards', () => {
  const results = [];
  for (const xpMul of [1, 10]) {
    const { model, context, save } = installFixture();
    loadNativePlayer(context);
    const player = new context.Player({ dex: 25, hp: 100, atk: 10, spd: 100 }, { xpMul });
    context.Game.player = player;
    model.preparePlayer(player);
    player.gainXp(1000);
    const runLevel = player.level;
    assert.equal(model.state(save, 25).xp, 0);
    player.kills = 150;
    player.bosses = 2;
    context.Progress.event('runEnd', { time: 300 });
    results.push({ runLevel, permanent: model.state(save, 25) });
  }
  assert(results[1].runLevel > results[0].runLevel);
  assert.deepEqual(results[1].permanent, results[0].permanent);
});

test('level-five combat pools and prepared moves use the same buff eligibility as training', () => {
  const { model, context, save } = installFixture();
  atLevel(save, 129, 4);
  assert.deepEqual(context.Moves.poolFor({ dex: 129 }), []);
  atLevel(save, 129, 5);
  const buffs = ['agility', 'harden', 'swords-dance'];
  assert.deepEqual(context.Moves.poolFor({ dex: 129 }), buffs);
  assert.deepEqual(context.Moves.poolFor({ dex: 129 }, true), buffs);
  assert.deepEqual(model.available(save, 129), ['struggle', ...buffs]);
  const selected = ['struggle', ...buffs];
  model.setLoadout(save, 129, selected);
  const player = makePlayer(129);
  model.preparePlayer(player);
  assert.deepEqual(player.moves.map(move => move.id), selected);
  assert.equal(player.pokemonLevel, 5);
  assert.equal(player.level, 1);
});

test('integration equips the exact selected four without changing the temporary run level', () => {
  const { model, context, save } = installFixture();
  atLevel(save, 25, 40);
  const selected = ['thunderbolt', 'quick-attack', 'agility', 'electro-ball'];
  model.setLoadout(save, 25, selected);
  const player = makePlayer(25);
  model.preparePlayer(player);
  assert.deepEqual(player.moves.map(move => move.id), selected);
  assert.deepEqual(player.slots.map(slot => slot.map(move => move.id)), [selected]);
  assert.equal(player.pokemonLevel, 40);
  assert.equal(player.level, 1);
  assert.equal(player.active, 0);
  assert.deepEqual(player.bind, {});
  assert.equal(context.startMoveOf(25), 'thunderbolt');
  assert(!context.Upgrades.LIST.some(upgrade => upgrade.id === 'hp'));
  assert.equal(context.Upgrades.perks({}).startMoves, 1);
  assert.equal(context.Upgrades.perks({}).bans, 0);
  assert.deepEqual(context.Moves.poolFor({ dex: 7 }), ['tackle']);
  assert(!Object.hasOwn(save.training, 7));
  save.ptm[25] = ['thunderbolt', 'hydro-pump'];
  assert.deepEqual(context.Mons.taught(25), ['thunderbolt']);
});

for (const count of [1, 2, 3, 4]) {
  test('native Player starts with all ' + count + ' selected moves in one active group', () => {
    const { model, context, save } = installFixture();
    atLevel(save, 25, 40);
    const selected = ['thunderbolt', 'quick-attack', 'agility', 'electro-ball'].slice(0, count);
    model.setLoadout(save, 25, selected);
    loadNativePlayer(context);
    const player = new context.Player({ dex: 25, hp: 100, atk: 10, spd: 100 });
    const bonds = player.bonds;
    for (let run = 0; run < 2; run++) {
      model.preparePlayer(player);
      assert.equal(player.slots.length, 1);
      assert.deepEqual(Array.from(player.activeGroup(), move => move.id), selected);
      assert.equal(player.activeGroup().length, player.moves.length);
      assert(player.activeGroup().every((move, i) => move === player.moves[i]));
      assert.equal(player.active, 0);
      assert.equal(player.bonds, bonds);
      player.setActive(3);
      player.cycle(1);
      assert.deepEqual(Array.from(player.activeGroup(), move => move.id), selected);
      assert.deepEqual(model.state(save, 25).loadout, selected);
    }
  });
}

test('native combat fires every prepared attack immediately with independent cooldowns', () => {
  const { model, context, save } = installFixture();
  atLevel(save, 25, 40);
  const selected = ['thunderbolt', 'quick-attack', 'electro-ball'];
  model.setLoadout(save, 25, selected);
  for (const [i, id] of selected.entries()) {
    Object.assign(context.Moves.BY_ID[id], {
      kind: 'melee', type: 'normal', radius: 100, arc: Math.PI, cd: i + 1, t: 0
    });
  }
  const runtime = loadNativePlayer(context);
  runtime.performance = { now: () => 0 };
  const source = fs.readFileSync(require.resolve('../js/app.min.js'), 'utf8');
  const start = source.indexOf("_0x599208['Combat']=");
  const end = source.indexOf(",_0x599208['Spawner']=", start);
  assert(start > 0 && end > start);
  vm.runInContext(source.slice(start, end), runtime, { timeout: 3000 });
  context.Coop = { active: false };
  context.U.TYPE_COLOR = { normal: '#fff' };
  context.U.dist = () => 0;
  context.LIFT = 0;
  context.FX = { slash() {} };
  context.VFX = { forMove: () => ({}) };
  context.EnemyMgr = { queryCircle: () => [] };
  context.World = { propsInCircle: () => [] };
  const player = new context.Player({ dex: 25, hp: 100, atk: 10, spd: 100 });
  model.preparePlayer(player);
  player.target = { x: 0, y: 0 };
  const casts = [];
  player.cast = move => { casts.push(move.id); };
  context.Combat.tick(0.01, player, 0);
  assert.deepEqual(casts, selected);
  assert.deepEqual(Array.from(player.moves, move => move.t), [1, 2, 3]);
  casts.length = 0;
  context.Combat.tick(1.01, player, 1.01);
  assert.deepEqual(casts, ['thunderbolt']);
  assert.equal(player.moves[1].cd, 2);
  assert.equal(player.moves[2].cd, 3);
  casts.length = 0;
  player.dead = true;
  context.Combat.tick(10, player, 11.01);
  assert.deepEqual(casts, []);
});

test('integration awards performance XP before forwarding runEnd, and only once per match', () => {
  const { model, context, events, save } = installFixture();
  const player = makePlayer(25), before = model.state(save, 25).xp;
  context.Game.player = player;
  model.preparePlayer(player);
  const details = { time: 60 };
  assert.equal(context.Progress.event('runEnd', details), 'original-event');
  assert.equal(model.state(save, 25).xp, before + 85);
  assert.equal(events[0].xp, before + 85);
  assert.equal(events[0].details, details);
  context.Progress.event('runEnd', details);
  assert.equal(model.state(save, 25).xp, before + 85);
  assert.equal(model.state(save, 129).level, 1);
  model.preparePlayer(player);
  context.Progress.event('runEnd', details);
  assert.equal(model.state(save, 25).xp, before + 170);
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
  handler({ target: {}, filename: '/js/town.js?v=town-1' });
  assert.match(replacements[0].textContent, /Could not load/);
  replacements = undefined;
  handler({ target: { src: '/js/town-multiplayer.js?v=shared-town-1' } });
  assert.match(replacements[0].textContent, /Could not load/);
  replacements = undefined;
  hidden = true;
  handler({ target: {}, filename: '/js/training.js' });
  assert.equal(replacements, undefined);
});

test('entry pages, updater manifest and offline cache use the same compatible build ID', () => {
  const { v } = require('../version.json');
  const worker = fs.readFileSync(require.resolve('../sw.js'), 'utf8');
  assert.match(v, /^[0-9a-f]{10}$/);
  for (const page of ['../index.html', '../en/index.html']) {
    const source = fs.readFileSync(require.resolve(page), 'utf8');
    assert(source.includes('js/app.min.js?v=' + v + '"'));
    const assets = [...source.matchAll(/(?:src|href)="((?:css\/style\.css|js\/(?:training|app\.min|data\/learnsets)\.js)\?v=[^"]+)"/g)];
    assert.equal(assets.length, 4);
    for (const [, asset] of assets) assert(worker.includes('./' + asset), 'Uncached game asset: ' + asset);
  }
  assert(worker.includes('./js/app.min.js?v=' + v));
});
