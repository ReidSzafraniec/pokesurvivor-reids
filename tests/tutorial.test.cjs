const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { create } = require('../js/training.js');
const data = require('../js/data/learnsets.js');

function load() {
  const file = require('node:path').join(__dirname, '..', 'js', 'tutorial.js');
  assert(fs.existsSync(file), 'A readable real-combat tutorial controller is required');
  return require(file);
}

function fixture() {
  const nodes = new Map(), listeners = [], leaves = [], calls = [], enemies = [], pickups = [];
  const element = () => ({
    textContent: '', disabled: false, onclick: null,
    classList: { values: new Set(['hidden']),
      add(v) { this.values.add(v); }, remove(v) { this.values.delete(v); },
      contains(v) { return this.values.has(v); } },
    focus() {}, setAttribute() {}
  });
  for (const id of ['tutorial-panel', 'tutorial-title', 'tutorial-text', 'tutorial-skip',
    'tutorial-retry', 'scr-levelup']) nodes.set(id, element());
  const training = create(data);
  let user = 'account-a', save = {
    starter: 4, partner: 4, owned: { 4: { from: 'starter', at: 1 } },
    onboarding: { version: 1, dex: 4, stage: 'practice' },
    coins: 500, stats: { runs: 0 }, bag: {}, tickets: { t1: 0, t10: 0 }
  };
  const game = {
    T: v => v, I18n: { add() {} }, Training: training,
    DB: {
      get save() { return save; }, get user() { return user; }, guest: false,
      commit() { calls.push(['commit']); return true; },
      onSync(fn) { listeners.push(fn); }, onLeave(fn) { leaves.push(fn); }
    },
    Game: {
      state: 'ui', player: null,
      startRun() {
        calls.push(['start']);
        this.player = { dex: 4, x: 0, y: 0, hp: 100, dead: false, level: 1,
          xp: 0, xpNext: 20, xpMul: 1 };
        this.state = 'playing';
      },
      toUI() { this.state = 'ui'; calls.push(['toUI']); }
    },
    Coop: { active: false },
    UI: {
      hideAll() { calls.push(['hideAll']); }, hide(id) { nodes.get(id)?.classList.add('hidden'); },
      toast(v) { calls.push(['toast', v]); }
    },
    Flow: { goMenu() { calls.push(['town']); } },
    Audio: { music() {}, sfx() {} },
    Input: { axis: () => [0, 0], virtual(code) { calls.push(['virtual', code]); } },
    Spawner: { CAP: 64, update() { calls.push(['ordinary-spawn']); } },
    Enemies: { bagAt: () => [{ dex: 19, hp: 10, spd: 60, dmg: 5, xp: 2, behavior: 'chase' }] },
    Enemy: class {
      constructor(def, x, y, scale) { Object.assign(this, def, { x, y, scale, dead: false }); }
    },
    EnemyMgr: { clear() { enemies.length = 0; }, all: () => enemies,
      add(e) { enemies.push(e); }, get count() { return enemies.length; } },
    Pickups: {
      clear() { pickups.length = 0; }, all: () => pickups,
      drop(kind, x, y, value) { pickups.push({ kind, x, y, value }); },
      dropXp() { calls.push(['ordinary-drop']); }
    },
    World: { isFree: () => true }, Camera: { outerRadius: () => 160 },
    FX: { clear() {} }, Projectiles: { clear() {} }, Combat: { clearFields() {} },
    Progress: {
      event(name) { calls.push(['progress', name]); },
      kill() { save.coins += 100; save.stats.totalKills = (save.stats.totalKills || 0) + 1; },
      checkAch() { calls.push(['achievement']); }
    },
    RunUI: { showLevelUp(level, offers, cb) { this.pick = cb; calls.push(['offer', level]); },
      closeLevelUp() {}, showOver() { calls.push(['ordinary-results']); } }
  };
  for (const name of ['Path', 'Hazards', 'Interact', 'Rift', 'Judgment', 'Events', 'Weather']) {
    game[name] = { update() { calls.push([name]); }, reset() {}, clear() {} };
  }
  game.Training.openInitialBuild = (dex, complete) => {
    calls.push(['build', dex]); game.completeBuild = complete;
  };
  const keyHandlers = new Map();
  const host = { document: { getElementById: id => nodes.get(id) },
    addEventListener(type, callback) { keyHandlers.set(type, callback); } };
  const api = load().install(game, host);
  const tick = (dt = 1 / 60, time = 1) => game.Spawner.update(dt, [game.Game.player], time);
  const choose = () => {
    game.Game.state = 'levelup';
    game.RunUI.showLevelUp(++game.Game.player.level, [], () => { game.Game.state = 'playing'; });
    game.RunUI.pick({ apply() {} });
  };
  return { game, api, calls, enemies, pickups, nodes, tick, choose,
    key(code, target) {
      const event = { code, target, stopped: false, prevented: false,
        stopImmediatePropagation() { this.stopped = true; },
        preventDefault() { this.prevented = true; } };
      keyHandlers.get('keydown')?.(event);
      return event;
    },
    sync(next, nextUser = user) { save = next; user = nextUser; listeners.forEach(fn => fn()); },
    leave() { leaves.forEach(fn => fn()); } };
}

test('starter enters real solo practice and movement gates the first XP lesson', () => {
  const f = fixture();
  f.api.start();
  assert.equal(f.game.Game.state, 'playing');
  assert.equal(f.game.Training.state(f.game.DB.save, 4).level, 1);
  for (let i = 0; i < 100; i++) f.tick();
  assert.equal(f.pickups.length, 0);
  f.game.Game.player.x = 64;
  f.tick();
  for (let i = 0; i < 100; i++) f.tick();
  assert.equal(f.pickups.length, 0, 'movement and waiting cannot replace combat');
  assert.equal(f.game.Game.player.xp, 0);
  assert(f.enemies.length <= 4);
  assert.match(f.nodes.get('tutorial-text').textContent, /enemigos/);
  assert(!f.calls.some(c => c[0] === 'ordinary-spawn'));
});

test('only defeated teaching enemies drop normal XP at their death position once', () => {
  const f = fixture();
  f.api.start();
  f.game.Game.player.x = 64;
  f.tick();
  const enemy = f.enemies[0];
  assert.equal(enemy.xp, 2);
  f.game.Progress.kill(enemy);
  f.game.Progress.kill({ dead: true, x: 1, y: 2, xp: 20 });
  assert.equal(f.pickups.length, 0);
  enemy.dead = true;
  f.game.Progress.kill(enemy);
  f.game.Progress.kill(enemy);
  assert.deepEqual(f.pickups, [{ kind: 'xp', x: enemy.x, y: enemy.y, value: 2 }]);
  assert.equal(f.game.Game.player.xp, 0, 'XP is a pickup, not a direct level award');
  assert.equal(f.game.Game.player.level, 1);
  assert.equal(f.game.DB.save.coins, 500);
  assert.deepEqual(f.game.DB.save.stats, { runs: 0 });
  assert(!f.calls.some(c => c[0] === 'ordinary-drop'));
  assert.match(f.nodes.get('tutorial-text').textContent, /cristal de XP/);
});

test('both lessons require multiple defeated enemies and collected XP', () => {
  const f = fixture();
  f.api.start();
  f.game.Game.player.x = 64;
  f.tick();
  for (let lesson = 0; lesson < 2; lesson++) {
    let killed = 0;
    while (f.game.Game.player.xp < f.game.Game.player.xpNext) {
      f.tick();
      const enemy = f.enemies.find(e => !e.dead);
      enemy.dead = true;
      f.game.Progress.kill(enemy);
      const xp = f.pickups.splice(0);
      assert.equal(xp.length, 1);
      f.game.Game.player.xp += xp[0].value * f.game.Game.player.xpMul;
      killed++;
    }
    assert.equal(killed, 10);
    f.game.Game.player.xp -= f.game.Game.player.xpNext;
    f.choose();
    if (lesson < 1) assert.match(f.nodes.get('tutorial-text').textContent, /enemigos/);
  }
  f.tick();
  const enemy = f.enemies.find(e => !e.dead);
  enemy.dead = true;
  f.game.Progress.kill(enemy);
  assert.equal(f.pickups.length, 0, 'swarm gives no additional guided levels');
});

test('swarm requires two applied choices and stays bounded without killing player', () => {
  const f = fixture();
  f.api.start();
  f.game.Game.player.x = 64;
  f.tick();
  for (let i = 0; i < 1; i++) {
    f.pickups.length = 0;
    f.choose();
    f.tick();
    assert(f.enemies.length <= 4);
  }
  f.choose();
  for (let i = 0; i < 20; i++) {
    const before = f.enemies.length;
    f.tick(1 / 60, 20);
    assert(f.enemies.length - before <= 8);
  }
  assert.equal(f.enemies.length, 64);
  const hp = f.game.Game.player.hp;
  for (let i = 0; i < 100; i++) f.tick(1, i);
  assert.equal(f.game.Game.player.hp, hp);
  assert.equal(f.game.Game.state, 'playing');
  assert.equal(f.game.DB.save.onboarding.stage, 'practice');
  f.enemies.splice(0, 8);
  f.tick();
  assert.equal(f.enemies.length, 64);
});

test('duplicate upgrade callbacks and unselected offers do not advance lessons', () => {
  const f = fixture();
  f.api.start();
  f.game.Game.player.x = 64;
  f.tick();
  f.game.RunUI.showLevelUp(2, [], () => {});
  assert(f.nodes.get('tutorial-panel').classList.contains('tutorial-choosing'));
  assert.match(f.nodes.get('tutorial-text').textContent, /^\(1\/2\)/);
  f.tick();
  assert(f.enemies.length <= 4);
  const pick = f.game.RunUI.pick;
  pick({}); pick({});
  assert(!f.nodes.get('tutorial-panel').classList.contains('tutorial-choosing'));
  for (let i = 0; i < 10; i++) f.tick();
  assert(f.enemies.length <= 4, 'only one distinct selection completed');
  f.game.RunUI.showLevelUp(3, [], () => {});
  assert.match(f.nodes.get('tutorial-text').textContent, /^\(2\/2\)/);
  f.tick();
  assert(f.enemies.length <= 4, 'the second upgrade still needs a selection');
  f.choose();
  for (let i = 0; i < 10; i++) f.tick();
  assert.equal(f.enemies.length, 64, 'the second applied selection starts the swarm');
});

test('blocked spawn positions are bounded and do not block skip', () => {
  const f = fixture();
  f.game.World.isFree = () => false;
  f.api.start();
  f.game.Game.player.x = 64;
  f.tick();
  f.choose(); f.choose();
  f.tick();
  assert.equal(f.enemies.length, 0);
  f.api.finish('skip');
  assert.equal(f.game.DB.save.onboarding.stage, 'build');
});

test('defeat and skip give exactly level five once and no ordinary rewards', () => {
  for (const reason of ['defeat', 'skip']) {
    const f = fixture(), before = JSON.stringify({
      coins: f.game.DB.save.coins, stats: f.game.DB.save.stats, bag: f.game.DB.save.bag,
      tickets: f.game.DB.save.tickets, owned: f.game.DB.save.owned
    });
    f.api.start();
    f.game.Progress.event('kill');
    f.game.Progress.kill({});
    f.game.Progress.checkAch();
    f.api.finish(reason);
    f.api.finish(reason);
    assert.equal(f.game.Training.state(f.game.DB.save, 4).xp, f.game.Training.xpAt(4, 5));
    assert.equal(f.game.DB.save.onboarding.stage, 'build');
    assert.deepEqual(f.calls.filter(c => c[0] === 'build'), [['build', 4]]);
    assert.equal(JSON.stringify({ coins: f.game.DB.save.coins, stats: f.game.DB.save.stats,
      bag: f.game.DB.save.bag, tickets: f.game.DB.save.tickets, owned: f.game.DB.save.owned }), before);
    assert(!f.calls.some(c => ['progress', 'ordinary-results', 'achievement'].includes(c[0])));
    f.game.completeBuild();
    assert.equal(f.game.DB.save.onboarding.stage, 'done');
    assert(f.calls.some(c => c[0] === 'town'));
  }
});

test('failed reward save has a visible retry that never awards XP twice', () => {
  const f = fixture();
  f.api.start();
  f.game.DB.commit = () => false;
  f.api.finish('skip');
  const xp = f.game.Training.state(f.game.DB.save, 4).xp;
  assert(!f.calls.some(c => c[0] === 'build'));
  assert(!f.nodes.get('tutorial-retry').classList.contains('hidden'));
  assert(f.calls.some(c => c[0] === 'toast'));
  f.game.DB.commit = () => true;
  f.nodes.get('tutorial-retry').onclick();
  assert.equal(f.game.Training.state(f.game.DB.save, 4).xp, xp);
  assert.deepEqual(f.calls.filter(c => c[0] === 'build'), [['build', 4]]);
});

test('failed build completion exposes retry and does not strand the saved build', () => {
  const f = fixture();
  f.api.start();
  f.api.finish('skip');
  f.game.DB.commit = () => false;
  f.game.completeBuild();
  assert(!f.nodes.get('tutorial-panel').classList.contains('hidden'));
  assert(!f.nodes.get('tutorial-retry').classList.contains('hidden'));
  assert(!f.calls.some(c => c[0] === 'town'));
  f.game.DB.commit = () => true;
  f.nodes.get('tutorial-retry').onclick();
  assert(f.calls.some(c => c[0] === 'town'));
});

test('a completed build synchronized from another tab returns to town once', () => {
  const f = fixture();
  f.api.start();
  f.api.finish('skip');
  const complete = f.game.completeBuild;
  const saved = JSON.parse(JSON.stringify(f.game.DB.save));
  saved.onboarding.stage = 'done';
  f.sync(saved);
  assert.equal(f.calls.filter(c => c[0] === 'town').length, 1);
  complete();
  f.sync(saved);
  assert.equal(f.calls.filter(c => c[0] === 'town').length, 1);
});

test('synchronous completion synchronization cannot enter town twice', () => {
  const f = fixture();
  f.api.start();
  f.api.finish('skip');
  f.game.DB.commit = () => {
    f.sync(JSON.parse(JSON.stringify(f.game.DB.save)));
    return true;
  };
  f.game.completeBuild();
  assert.equal(f.calls.filter(c => c[0] === 'town').length, 1);
});

test('controller Back cannot leave initial build but other virtual input stays available', () => {
  const f = fixture();
  f.api.start();
  f.game.Input.virtual('escape');
  assert.equal(f.calls.filter(c => c[0] === 'virtual').length, 1);
  f.api.finish('skip');
  f.game.Input.virtual('escape');
  assert.equal(f.calls.filter(c => c[0] === 'virtual').length, 1);
  f.game.Input.virtual('keyr');
  assert.deepEqual(f.calls.filter(c => c[0] === 'virtual').at(-1), ['virtual', 'keyr']);
  f.game.completeBuild();
  f.game.Input.virtual('escape');
  assert.equal(f.calls.filter(c => c[1] === 'escape').length, 2);
});

test('onboarding stages merge monotonically without touching established accounts', () => {
  const { merge } = load();
  const owned = { 4: { at: 1 } };
  const save = stage => ({ starter: 4, partner: 4, owned,
    onboarding: { version: 1, dex: 4, stage } });
  for (const pair of [['practice', 'build'], ['build', 'done'], ['practice', 'done']]) {
    const a = save(pair[0]), b = save(pair[1]);
    const left = merge({ ...a }, a, b), right = merge({ ...b }, b, a);
    assert.deepEqual(left.onboarding, right.onboarding);
    assert.equal(left.onboarding.stage, pair[1]);
    assert.deepEqual(merge({ ...left }, left, left).onboarding, left.onboarding);
  }
  const established = { starter: 7, owned: { 7: {} } };
  assert.equal(merge(established, established, save('done')).onboarding, undefined);
});

test('pending practice restarts, pending build resumes, done and established partners do not replay', () => {
  for (const stage of ['practice', 'build', 'done', null]) {
    const f = fixture();
    if (stage) f.game.DB.save.onboarding.stage = stage;
    else delete f.game.DB.save.onboarding;
    const result = f.api.resume();
    assert.equal(result, stage === 'practice' || stage === 'build');
    assert.equal(f.calls.some(c => c[0] === 'start'), stage === 'practice');
    assert.equal(f.calls.some(c => c[0] === 'build'), stage === 'build');
  }
});

test('same-account save replacement remains valid but account switch invalidates callbacks', () => {
  const f = fixture();
  f.api.start();
  const player = f.game.Game.player;
  const replacement = JSON.parse(JSON.stringify(f.game.DB.save));
  f.sync(replacement);
  assert(f.api.activeFor(player));
  const other = JSON.parse(JSON.stringify(replacement));
  other.starter = other.partner = 7;
  other.owned = { 7: { at: 1, from: 'starter' } };
  other.onboarding.dex = 7;
  f.sync(other, 'account-b');
  f.api.finish('skip');
  assert.equal(f.game.Training.state(other, 7).level, 1);
  assert.equal(f.game.Game.state, 'ui');
});

test('ordinary encounters and progression resume after tutorial completion', () => {
  const f = fixture();
  f.api.start();
  for (const name of ['Events', 'Hazards', 'Rift']) f.game[name].update();
  assert(!f.calls.some(c => ['Events', 'Hazards', 'Rift'].includes(c[0])));
  f.api.finish('skip');
  f.game.completeBuild();
  f.game.Progress.event('kill');
  f.game.Spawner.update(1, [f.game.Game.player], 1);
  f.game.Events.update();
  assert(f.calls.some(c => c[0] === 'ordinary-spawn'));
  assert(f.calls.some(c => c[0] === 'progress'));
  assert(f.calls.some(c => c[0] === 'Events'));
});

test('checked engine patch is idempotent and leaves invalid input unchanged', () => {
  const file = require('node:path').join(__dirname, '..', 'tools', 'patch-tutorial-engine.cjs');
  assert(fs.existsSync(file), 'A checked tutorial engine patch is required');
  const { patch } = require(file);
  const source = fs.readFileSync(require.resolve('../js/app.min.js'), 'utf8');
  const edited = patch(source);
  assert.equal(patch(edited), edited);
  assert.doesNotThrow(() => new vm.Script(edited));
  assert.throws(() => patch('const unrelated = true;'), /anchor/);
  assert(edited.includes("Tutorial.finish(_0x1592fd?'defeat':'skip')"));
  assert(edited.includes('Tutorial.activeFor(_0x17b390)'));
});

test('both entry pages deliver accessible tutorial and build controls with coherent precache', () => {
  const path = require('node:path');
  const worker = fs.readFileSync(require.resolve('../sw.js'), 'utf8');
  for (const entry of ['index.html', 'en\\index.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', entry), 'utf8');
    for (const id of ['tutorial-panel', 'tutorial-skip', 'tutorial-retry',
      'training-initial', 'training-finish']) assert(html.includes('id="' + id + '"'), id);
    assert(html.indexOf('js/tutorial.js') < html.indexOf('js/onboarding.js'));
    assert.match(html, /id="tutorial-text"[^>]*aria-live="polite"/);
    for (const asset of html.matchAll(/(?:src|href)="((?:js\/(?:tutorial|training|onboarding|app\.min)|css\/style)[^"]+)"/g)) {
      assert(worker.includes(asset[1]), 'Precache must include ' + asset[1]);
    }
  }
  assert(fs.readFileSync(require.resolve('../js/boot.js'), 'utf8').includes('tutorial'));
});

test('guest skip does not require persistence and paused frames do not spawn', () => {
  const f = fixture();
  f.game.DB.guest = true;
  f.game.DB.commit = () => { throw new Error('Guest must not persist'); };
  f.api.start();
  f.game.Game.state = 'paused';
  f.game.Game.player.x = 64;
  f.tick();
  assert.equal(f.pickups.length, 0);
  f.nodes.get('tutorial-skip').onclick();
  assert.equal(f.game.Training.state(f.game.DB.save, 4).level, 5);
  assert(f.calls.some(c => c[0] === 'build'));
});

test('tutorial prompts do not announce the level-five reward', () => {
  const f = fixture();
  f.api.start();
  f.choose(); f.choose();
  assert(!f.nodes.get('tutorial-text').textContent.includes('5'));
  f.api.finish('skip');
  assert(!f.nodes.get('tutorial-text').textContent.includes('5'));
});

test('native keyboard navigation works for skip and initial move selects', () => {
  const f = fixture();
  f.api.start();
  const tab = f.key('Tab');
  assert(tab.stopped);
  assert(!tab.prevented);
  assert(f.key('Enter', f.nodes.get('tutorial-skip')).stopped);
  assert(!f.key('Digit2').stopped, 'upgrade shortcuts remain available');
  f.api.finish('skip');
  const arrow = f.key('ArrowDown', { tagName: 'SELECT' });
  assert(arrow.stopped);
  assert(!arrow.prevented, 'native select keyboard behavior is preserved');
  assert(f.key('Escape').prevented, 'initial build cannot be bypassed');
});

test('actual private engine ending and pickup checkpoints bypass practice bookkeeping', () => {
  const source = fs.readFileSync(require.resolve('../js/app.min.js'), 'utf8');
  const start = source.indexOf('function _0x138343(');
  const end = source.indexOf("_0x599208['onRescue']=", start);
  assert(start > 0 && end > start);
  const calls = [], player = {};
  const runtime = vm.createContext({
    _0x17b390: player, _0x3e3d0a: 'playing',
    _0x599208: { Tutorial: { activeFor: p => p === player,
      finish: reason => calls.push(reason) } }
  });
  vm.runInContext(source.slice(start, end), runtime);
  vm.runInContext('_0x138343(true); _0x138343(false);', runtime);
  assert.deepEqual(calls, ['defeat', 'skip']);
  const first = source.indexOf('function _0x3c336f(');
  const last = source.indexOf('const _0x35303a=', first);
  assert(first > 0 && last > first);
  vm.runInContext(source.slice(first, last), runtime);
  assert.doesNotThrow(() => vm.runInContext('_0x3c336f();', runtime),
    'checkpoint returns before attempting ordinary save writes');
});
