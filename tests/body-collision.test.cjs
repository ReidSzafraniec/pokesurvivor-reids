const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function fixture(enemies, move = () => {}, collide = () => false, after = () => {}) {
  class Enemy {
    update(dt, targets) { return move.call(game.EnemyMgr, dt, targets); }
    netUpdate(dt, targets) { return move.call(game.EnemyMgr, dt, targets); }
  }
  for (const enemy of enemies) Object.setPrototypeOf(enemy, Enemy.prototype);
  const game = {
    Enemy,
    EnemyMgr: {
      all: () => enemies,
      update(dt, targets) {
        let result;
        for (const enemy of enemies) {
          result = enemy.remote ? enemy.netUpdate(dt, targets) : enemy.update(dt, targets);
        }
        after();
        return result;
      }
    },
    World: { collide },
    Coop: { active: false, isHost: false }
  };
  const host = {};
  vm.runInNewContext(read('js/body-collision.js'), { window: host });
  host.PSBodyCollision.install(game);
  return { game, host };
}

const player = (x = 0, y = 0) => ({ x, y, r: 10 });
const enemy = (x = 30, y = 0) => ({ id: 1, x, y, r: 8, kx: 0, ky: 0 });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const separated = (a, b) => assert.ok(distance(a, b) >= a.r + b.r - 1e-8,
  `Bodies overlap at distance ${distance(a, b)}`);

test('fast pursuit cannot sit inside the player, even throughout contact cooldown', () => {
  const p = player(), e = enemy();
  e.touchCd = 0.4;
  const { game } = fixture([e], dt => {
    const d = distance(p, e);
    e.x += (p.x - e.x) / d * 400 * dt;
    e.y += (p.y - e.y) / d * 400 * dt;
  });
  for (let frame = 0; frame < 180; frame++) {
    game.EnemyMgr.update(1 / 60, p);
    separated(e, p);
  }
  assert.deepEqual(p, player());
  assert.equal(e.touchCd, 0.4);
});

test('a fast dash cannot tunnel entirely through the player', () => {
  const p = player(), e = enemy(-50);
  const { game } = fixture([e], () => { e.x = 50; });
  game.EnemyMgr.update(0.05, p);
  separated(e, p);
  assert.ok(e.x < 0, 'Dash should stop on its original side');
});

test('exact-center overlaps resolve deterministically without NaN or player displacement', () => {
  const p = player(), e = enemy(0);
  const { game } = fixture([e]);
  game.EnemyMgr.update(0.016, p);
  separated(e, p);
  assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y));
  const first = { x: e.x, y: e.y };
  e.x = e.y = 0;
  game.EnemyMgr.update(0.016, p);
  assert.deepEqual({ x: e.x, y: e.y }, first);
  assert.deepEqual(p, player());
});

test('walking into an enemy moves only the enemy and keeps it within contact reach', () => {
  const p = player(28, 12), e = enemy(30, 12);
  const { game } = fixture([e]);
  game.EnemyMgr.update(0.016, p);
  separated(e, p);
  assert.ok(distance(e, p) <= e.r + p.r + 0.001);
  assert.deepEqual(p, player(28, 12));
});

test('moving players do not carry a stuck enemy inside them', () => {
  const p = player(), e = enemy();
  const { game } = fixture([e], dt => {
    const d = distance(p, e);
    if (d) {
      e.x += (p.x - e.x) / d * 350 * dt;
      e.y += (p.y - e.y) / d * 350 * dt;
    }
  });
  for (let frame = 0; frame < 180; frame++) {
    p.x += 2;
    p.y += 0.5;
    game.EnemyMgr.update(1 / 60, p);
    separated(e, p);
    assert.equal(p.x, (frame + 1) * 2);
    assert.equal(p.y, (frame + 1) * 0.5);
  }
});

test('enemy separation at the end of native movement cannot push enemies into players', () => {
  const p = player(), e = enemy();
  const { game } = fixture([e], () => {}, () => false, () => { e.x = 3; e.y = 4; });
  game.EnemyMgr.update(0.016, p);
  separated(e, p);
});

test('terrain correction finds a free contact point instead of embedding an enemy in a wall', () => {
  const p = player(), e = enemy(5);
  const collide = body => {
    if (body.x > 12) { body.x = 12; return true; }
    return false;
  };
  const { game } = fixture([e], () => {}, collide);
  game.EnemyMgr.update(0.016, p);
  separated(e, p);
  assert.ok(e.x <= 12, 'Enemy must remain on the free side of the wall');
});

test('co-op host separates against all living players, not only the pursuit target', () => {
  const players = [player(-25), player(0)], e = enemy(4);
  const { game } = fixture([e]);
  game.Coop.active = game.Coop.isHost = true;
  game.EnemyMgr.update(0.016, players);
  for (const p of players) separated(e, p);
});

test('co-op client separates remote rendering without rewriting network snapshots', () => {
  const p = player(), e = enemy(30);
  e.remote = true;
  e.net = { x: 2, y: 0, vx: -100, vy: 0, age: 0 };
  const snapshot = { ...e.net };
  const { game } = fixture([e], () => { e.x = 2; });
  game.Coop.active = true;
  game.EnemyMgr.update(0.016, [p]);
  separated(e, p);
  assert.deepEqual(e.net, snapshot);
});

test('offscreen recycling is not mistaken for a dash across the player', () => {
  const p = player(), e = enemy(-1500);
  const { game } = fixture([e], () => {}, () => false, () => { e.x = 1500; });
  game.EnemyMgr.update(0.016, p);
  assert.equal(e.x, 1500);
});

test('authoritative remote snapshots outside the body are not blocked by a local swept path', () => {
  const p = player(), e = enemy(-50);
  e.remote = true;
  const { game } = fixture([e], () => { e.x = 50; });
  game.Coop.active = true;
  game.EnemyMgr.update(0.016, p);
  assert.equal(e.x, 50);
});

test('dead enemies, dead or silent players, and the dedicated Arceus encounter are unchanged', () => {
  for (const [e, p] of [
    [{ ...enemy(1), dead: true }, player()],
    [enemy(1), { ...player(), dead: true }],
    [enemy(1), { ...player(), silent: true }],
    [{ ...enemy(1), arceus: true }, player()]
  ]) {
    const { game } = fixture([e]);
    game.EnemyMgr.update(0.016, p);
    assert.equal(e.x, 1);
    assert.equal(e.y, 0);
  }
});

test('unrelated movement, ranged enemies and knockback stay unchanged outside contact', () => {
  const p = player(), e = { ...enemy(200), behavior: 'ranged', kx: 30, ky: -10 };
  const { game } = fixture([e], dt => { e.x += e.kx * dt; e.y += e.ky * dt; });
  game.EnemyMgr.update(0.1, p);
  assert.equal(e.x, 203);
  assert.equal(e.y, -1);
  assert.equal(e.kx, 30);
  assert.equal(e.ky, -10);
});

test('installation is idempotent and preserves the native update receiver and return value', () => {
  const e = enemy(), p = player();
  let calls = 0;
  const { game, host } = fixture([e], function () {
    calls++;
    assert.equal(this, game.EnemyMgr);
    return 42;
  });
  assert.ok(host.PSBodyCollision, 'Readable collision module must be available');
  host.PSBodyCollision.install(game);
  assert.equal(game.EnemyMgr.update(0.016, p), 42);
  assert.equal(calls, 1);
});

test('engine integration loads the boundary module and retains native contact attacks', () => {
  const engine = read('js/app.min.js');
  assert.ok(engine.includes('window.PSBodyCollision.install(_0x599208);'));
  const contactStart = engine.indexOf("if(!_0x4def28['dead'])for(const _0x140d71");
  const contactEnd = engine.indexOf("'ghostCast':", contactStart);
  const contact = engine.slice(contactStart, contactEnd);
  assert.ok(contact.includes('window.PSBodyCollision.touching(_0x140d71,_0x4def28)'));
  assert.ok(contact.includes("['touchCd']=0.55"));
  assert.ok(contact.includes("['strike'](_0x4def28)"));
  assert.ok(contact.includes("['hurt'](_0x140d71['dmg']"));
  for (const page of ['index.html', 'en/index.html']) {
    const html = read(page);
    const at = html.indexOf('js/body-collision.js?v=body-contact-1');
    assert.ok(at >= 0 && at < html.indexOf('js/app.min.js?v='), page);
  }
  assert.ok(read('sw.js').includes('./js/body-collision.js?v=body-contact-1'));
});

function nativeRuntime(game, host) {
  const source = read('js/app.min.js');
  const runtime = vm.createContext({ _0x599208: game, window: host });
  const bootstrap = source.slice(0, source.indexOf('const a0_0xc9496a=')) +
    source.slice(source.lastIndexOf('function a0_0x48f4()'));
  vm.runInContext(bootstrap, runtime, { timeout: 3000 });
  runtime._0x48be02 = runtime._0x22f572 = runtime.a0_0x422d;
  return { runtime, source };
}

test('native contact resolution still damages at the boundary with original cooldown and knockback', () => {
  const p = player(), e = enemy(1);
  const { game, host } = fixture([e]);
  game.EnemyMgr.update(0.016, p);
  let hits = 0, strikes = 0;
  Object.assign(p, { hasItem: () => false, hurt(dmg) { assert.equal(dmg, 12); hits++; } });
  Object.assign(e, { dmg: 12, atkType: 'normal', strike() { strikes++; } });
  game.U = { norm(x, y) { const d = Math.hypot(x, y) || 1; return [x / d, y / d]; } };
  game.Projectiles = { all: () => [] };
  game.EnemyMgr.queryCircle = () => [e];
  const { runtime, source } = nativeRuntime(game, host);
  const start = source.indexOf("_0x599208['Combat']=");
  const end = source.indexOf(",_0x599208['Spawner']=", start);
  vm.runInContext(source.slice(start, end), runtime, { timeout: 3000 });
  game.Combat.resolve(0.016, p, 0);
  assert.equal(hits, 1);
  assert.equal(strikes, 1);
  assert.equal(e.touchCd, 0.55);
  assert.ok(Math.abs(Math.hypot(e.kx, e.ky) - 150) < 1e-8);
  game.Combat.resolve(0.016, p, 0.016);
  assert.equal(hits, 1, 'Separation must not bypass the existing contact cooldown');
  e.touchCd = 0;
  e.stunT = 1;
  game.Combat.resolve(0.016, p, 0.6);
  assert.equal(hits, 1, 'Stunned enemies must remain unable to deal contact damage');
  e.stunT = 0;
  e.x += 0.01;
  game.Combat.resolve(0.016, p, 0.7);
  assert.equal(hits, 1, 'Contact tolerance must not become an expanded attack radius');
});

test('native runner movement remains outside the player over repeated real enemy updates', () => {
  const game = {
    DEX_BY: { 25: { name: 'Pikachu', types: ['electric'] } },
    Sprites: {
      bodyRadius: () => 8, bodyHeight: () => 16, hovers: () => false,
      dirFromAngle: () => 0,
      Animator: class { update() {} loop() {} }
    },
    Stats: { sideOf: () => 'physical' },
    U: {
      rand: a => a, clamp: (v, min, max) => Math.min(max, Math.max(min, v)),
      norm(x, y) { const d = Math.hypot(x, y) || 1; return [x / d, y / d]; },
      dist: (x, y, a, b) => Math.hypot(a - x, b - y)
    },
    Camera: { sees: () => false },
    World: { isLiquid: () => false, collide: () => false },
    Weather: { speedFor: () => 1 },
    Path: { dirFor: () => null }
  };
  const host = {};
  const { runtime, source } = nativeRuntime(game, host);
  const start = source.indexOf('class _0x36a4fa');
  const end = source.indexOf("_0x599208['Enemy']=", start);
  runtime._0x201b59 = 1;
  vm.runInContext(source.slice(start, end) + ';_0x599208.Enemy=_0x36a4fa;', runtime);
  const e = new game.Enemy({ dex: 25, hp: 100, spd: 400, dmg: 12, xp: 1, behavior: 'runner' },
    30, 0, { hp: 1, spd: 1, dmg: 1 });
  game.EnemyMgr = { all: () => [e], update(dt, p) { e.update(dt, p); } };
  vm.runInNewContext(read('js/body-collision.js'), { window: host });
  host.PSBodyCollision.install(game);
  const p = { ...player(), level: 1, _vx: 0, _vy: 0 };
  for (let frame = 0; frame < 180; frame++) {
    game.EnemyMgr.update(1 / 60, p);
    separated(e, p);
  }
});

test('collision codemod is applied once, is idempotent and rejects missing or ambiguous anchors', () => {
  const { PATCHES, patch } = require('../tools/patch-body-collision-engine.cjs');
  const engine = read('js/app.min.js');
  assert.equal(patch(engine), engine);
  for (const [before, after] of PATCHES) {
    assert.equal(engine.split(before).length - 1, 0);
    assert.equal(engine.split(after).length - 1, 1);
  }
  assert.throws(() => patch('x', [['a', 'b']]), /missing|not unique/);
  assert.throws(() => patch('a;a', [['a', 'b']]), /not unique/);
  assert.throws(() => patch('b;b', [['a', 'b']]), /not unique/);
});
