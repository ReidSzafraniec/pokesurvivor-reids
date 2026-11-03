const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const town = require('../js/town.js');

function loadSpriteDirection() {
  const source = fs.readFileSync(require.resolve('../js/app.min.js'), 'utf8');
  const runtime = vm.createContext({});
  const bootstrap = source.slice(0, source.indexOf('const a0_0xc9496a=')) +
    source.slice(source.lastIndexOf('function a0_0x48f4()'));
  vm.runInContext(bootstrap, runtime, { timeout: 3000 });
  const match = /'dirFromAngle':(function\([^)]*\)\{[^}]*\})/.exec(source);
  assert(match, 'Native sprite direction helper must exist');
  return vm.runInContext('(' + match[1] + ')', runtime, { timeout: 3000 });
}
const spriteDirection = loadSpriteDirection();

test('all eleven menu buildings have reachable, non-overlapping door approaches', () => {
  assert.equal(town.BUILDINGS.length, 11);
  assert.equal(new Set(town.BUILDINGS.map(b => b.id)).size, 11);
  const start = { x: 528, y: 548 }, queue = [start], visited = new Set(['528,548']);
  for (let i = 0; i < queue.length; i++) {
    const point = queue[i];
    for (const [dx, dy] of [[8, 0], [-8, 0], [0, 8], [0, -8]]) {
      const x = point.x + dx, y = point.y + dy, key = x + ',' + y;
      if (!visited.has(key) && town.walkable(x, y)) {
        visited.add(key);
        queue.push({ x, y });
      }
    }
  }
  for (const building of town.BUILDINGS) {
    assert(town.walkable(building.door.x, building.door.y), building.id);
    assert(queue.some(p => town.nearby(p)?.id === building.id), 'Unreachable: ' + building.id);
    assert.equal(town.nearby(building.door).id, building.id);
  }
});

test('diagonal movement is normalized, analog input is retained, and pause gaps are clamped', () => {
  const point = { x: 700, y: 550 };
  for (const axis of [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: -1, y: 1 }]) {
    const next = town.move(point, axis, 0.1);
    assert(Math.abs(Math.hypot(next.x - point.x, next.y - point.y) - town.SPEED / 10) < 1e-8);
    assert.deepEqual(town.move(point, axis, 10), next);
  }
  assert.equal(town.move(point, { x: 0.5, y: 0 }, 0.1).x, point.x + town.SPEED / 20);
  assert.deepEqual(town.move(point, { x: 0, y: 0 }, 0.1), point);
  assert.deepEqual(point, { x: 700, y: 550 });
});

test('swept movement cannot enter any building, pond, or town boundary', () => {
  for (const solid of town.SOLIDS) {
    let point = { x: solid.x + solid.w / 2, y: solid.y + solid.h + town.RADIUS + 1 };
    for (let i = 0; i < 50; i++) point = town.move(point, { x: 0, y: -1 }, 1);
    assert(point.y >= solid.y + solid.h + town.RADIUS);
    assert(town.walkable(point.x, point.y));
  }
  for (const axis of [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]) {
    let point = { ...town.SPAWN };
    for (let i = 0; i < 1000; i++) point = town.move(point, axis, 1);
    assert(town.walkable(point.x, point.y));
    assert(point.x >= 32 + town.RADIUS && point.x <= town.WIDTH - 32 - town.RADIUS);
    assert(point.y >= 32 + town.RADIUS && point.y <= town.HEIGHT - 32 - town.RADIUS);
  }
  assert(!town.walkable(10, 10));
});

test('all eight walk directions use the existing sprite sheet orientation', () => {
  [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]]
    .forEach(([x, y], dir) => {
      assert.equal(spriteDirection(Math.atan2(y, x)), dir);
      assert.equal(town.direction(x, y), dir, `Facing ${x},${y}`);
    });
});

test('invalid town movement is rejected explicitly', () => {
  for (const seconds of [-1, NaN, Infinity]) {
    assert.throws(() => town.move(town.SPAWN, { x: 1, y: 0 }, seconds), RangeError);
  }
  assert.throws(() => town.move({ x: NaN, y: 2 }, { x: 0, y: 1 }, 0.1), RangeError);
});

function fixture() {
  const elements = new Map(), frames = new Map(), listeners = new Map(), sync = [];
  let nextFrame = 0, observer;
  const brush = new Proxy({}, { get: (target, key) => target[key] || (() => {}), set: (target, key, value) => (target[key] = value, true) });
  const painted = [];
  brush.fillRect = (x, y, w, h) => painted.push({ color: brush.fillStyle, x, y, w, h });
  function element(id, hidden = true) {
    const classes = new Set(hidden ? ['hidden'] : []), events = new Map();
    const node = {
      id, dataset: {}, disabled: false, textContent: '', children: [],
      classList: {
        add: value => classes.add(value), remove: value => classes.delete(value),
        contains: value => classes.has(value)
      },
      getContext: () => brush,
      getBoundingClientRect: () => ({ width: 960, height: 600 }),
      querySelectorAll: selector => selector === '[data-town-move]' ? pads : [],
      setAttribute() {},
      addEventListener: (type, handler) => events.set(type, handler),
      setPointerCapture() {},
      dispatch(type, data) { events.get(type)?.(data); },
      closest(selector) { return selector === 'button' && id !== 'town-map' ? node : null; },
      focus() { doc.activeElement = node; },
      click() { node.onclick?.(); }
    };
    elements.set(id, node);
    return node;
  }
  const screenIds = ['scr-town', 'scr-menu', 'scr-login', ...town.BUILDINGS.map(b => 'scr-' + b.id)];
  screenIds.forEach(id => element(id));
  for (const id of ['town-map', 'town-menu', 'town-partner', 'town-interact', 'town-nearby', 'menu-town']) element(id);
  const pads = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].map(code => {
    const pad = element('pad-' + code, false);
    pad.dataset = { townMove: code, label: code };
    return pad;
  });
  const doc = {
    body: {}, hidden: false,
    getElementById: id => elements.get(id),
    createElement: () => element('scenery'),
    addEventListener: (name, handler) => listeners.set(name, handler),
    querySelector(selector) {
      if (selector.startsWith('.scr:')) {
        return screenIds.map(id => elements.get(id))
          .find(node => node.id !== 'scr-town' && !node.classList.contains('hidden')) || null;
      }
      const id = /data-go="([^"]+)"/.exec(selector)?.[1];
      return elements.get('menu-' + id);
    }
  };
  const host = {
    document: doc, devicePixelRatio: 1,
    addEventListener: (name, handler) => listeners.set(name, handler),
    requestAnimationFrame: handler => { frames.set(++nextFrame, handler); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id),
    MutationObserver: class {
      constructor(callback) { observer = callback; }
      observe() {}
    }
  };
  const avatars = [], drawn = [], actions = [];
  const game = {
    Game: { state: 'ui' },
    DB: {
      user: 'first', guest: false, save: { partner: 25, owned: { 25: {} }, shiny: {}, partnerShiny: false },
      onSync: callback => sync.push(callback)
    },
    T: value => value, I18n: { add() {} }, Skins: { worn: () => null },
    DEX_BY: { 25: { name: 'Pikachu' }, 4: { name: 'Charmander' } },
    Sprites: {
      animMeta: () => ({ w: 40, h: 48 }),
      Animator: class {
        constructor(dex, size, shiny) { this.dex = dex; this.size = size; this.shiny = shiny; avatars.push(this); }
        loop(animation) { this.animation = animation; }
        update() {}
        draw(ctx, x, y) { drawn.push({ x, y }); }
      }
    },
    UI: {
      show(id, keepMenu) {
        screenIds.filter(name => name !== 'scr-town' && name !== id && !(keepMenu && name === 'scr-menu'))
          .forEach(name => elements.get(name).classList.add('hidden'));
        elements.get(id).classList.remove('hidden');
      },
      hide(id) { elements.get(id).classList.add('hidden'); },
      hideAll() { screenIds.filter(id => id !== 'scr-town').forEach(id => elements.get(id).classList.add('hidden')); },
      isOpen: id => !elements.get(id).classList.contains('hidden')
    },
    MenuUI: {
      init() {
        for (const b of town.BUILDINGS) {
          element('menu-' + b.id).onclick = () => {
            actions.push(b.id);
            game.UI.show('scr-' + b.id, true);
          };
        }
      },
      open() { game.UI.show('scr-menu'); }
    },
    Flow: {
      goMenu() {
        game.Game.state = 'ui';
        game.MenuUI.open();
      }
    }
  };
  town.install(game, host);
  game.MenuUI.init();
  function advance(time) {
    const pending = [...frames.entries()];
    for (const [id, handler] of pending) {
      frames.delete(id);
      handler(time);
    }
  }
  function key(type, code, options = {}) {
    const event = {
      code, repeat: false, target: elements.get('town-map'), preventDefault() { this.prevented = true; },
      stopImmediatePropagation() { this.stopped = true; }, ...options
    };
    listeners.get(type)(event);
    return event;
  }
  return { game, host, elements, frames, sync, avatars, drawn, painted, actions, advance, key, pads,
    observe: () => observer(), visible: id => !elements.get(id).classList.contains('hidden') };
}

test('keyboard and touch movement face the same direction as native combat sprites', () => {
  for (const [codes, x, y] of [
    [['ArrowDown'], 0, 1], [['ArrowDown', 'ArrowRight'], 1, 1],
    [['ArrowRight'], 1, 0], [['ArrowUp', 'ArrowRight'], 1, -1],
    [['ArrowUp'], 0, -1], [['ArrowUp', 'ArrowLeft'], -1, -1],
    [['ArrowLeft'], -1, 0], [['ArrowDown', 'ArrowLeft'], -1, 1]
  ]) {
    for (const touch of [false, true]) {
      const f = fixture();
      f.game.Flow.goMenu();
      f.advance(0);
      codes.forEach((code, index) => {
        if (touch) {
          f.pads.find(pad => pad.dataset.townMove === code)
            .dispatch('pointerdown', { pointerId: index, preventDefault() {} });
        } else f.key('keydown', code);
      });
      f.advance(100);
      const avatar = f.avatars.at(-1), expected = spriteDirection(Math.atan2(y, x));
      assert.equal(avatar.animation, 'Walk');
      assert.equal(avatar.dir, expected, `${touch ? 'Touch' : 'Keyboard'} ${codes}`);
      codes.forEach((code, index) => {
        if (touch) {
          f.pads.find(pad => pad.dataset.townMove === code)
            .dispatch('pointerup', { pointerId: index });
        } else f.key('keyup', code);
      });
      f.advance(200);
      assert.equal(avatar.animation, 'Idle');
      assert.equal(avatar.dir, expected, 'Stopping retains the correct facing');
    }
  }
});

test('pond plaza stays west of the north-south path with open street connections', () => {
  const f = fixture();
  f.game.Flow.goMenu();
  const plaza = f.painted.find(r => r.x === 344 && r.y === 496);
  assert(plaza);
  assert.equal(plaza.x + plaza.w, 536, 'Paving must not cover the north-south path');
  assert.equal(plaza.h, 112);
  for (const x of [344, 528]) {
    assert(f.painted.some(r => r.x === x && r.y === 532 && r.w >= 8 && r.h === 40),
      'Street must connect through the plaza border');
  }
  for (let y = plaza.y; y <= plaza.y + plaza.h; y += 8) assert(town.walkable(552, y));
});

test('plaza paving has staggered joints and clips every tile to its inset border', () => {
  const f = fixture();
  f.game.Flow.goMenu();
  const rows = Array.from({ length: 6 }, (_, row) =>
    f.painted.filter(r => r.y === 505 + row * 16 && r.h === 14 && r.x >= 353 && r.x < 527));
  for (const row of rows) {
    assert(row.length >= 6, 'Every row must contain separate paving stones');
    assert(row.every(r => r.x + r.w <= 527), 'No stone may overhang the plaza');
    for (let i = 1; i < row.length; i++) {
      assert.equal(row[i].x - (row[i - 1].x + row[i - 1].w), 2, 'Visible mortar joints');
    }
  }
  const joints = row => row.map(r => r.x + r.w);
  assert.notDeepEqual(joints(rows[0]), joints(rows[1]), 'Adjacent rows must be staggered');
  assert.deepEqual(joints(rows[0]), joints(rows[2]), 'Stagger repeats every two rows');
});

test('home defaults to town; private back callbacks and shortcut menus keep their return destinations', () => {
  const f = fixture();
  f.game.Flow.goMenu();
  assert(f.visible('scr-town'));
  assert(!f.visible('scr-menu'));
  assert(f.game.UI.isOpen('scr-menu'), 'Town remains the native home notification context');
  f.game.UI.show('scr-shop', true);
  assert.equal(f.frames.size, 0);
  f.game.UI.show('scr-menu');
  assert(!f.visible('scr-menu'), 'Private native back callback returns to town');
  f.key('keydown', 'KeyM');
  f.key('keyup', 'KeyM');
  assert(f.visible('scr-menu'));
  f.elements.get('menu-shop').click();
  f.game.UI.show('scr-menu');
  assert(f.visible('scr-menu'), 'Shortcut-origin screen returns to the list');
  f.elements.get('menu-town').click();
  assert(!f.visible('scr-menu'));
  assert(f.visible('scr-town'));
  assert.equal(f.frames.size, 1);
});

test('town controls move the avatar without mutating save data or leaking held keys into menus', () => {
  const f = fixture(), before = JSON.stringify(f.game.DB.save);
  f.game.Flow.goMenu();
  f.advance(0);
  const start = f.drawn.at(-1);
  assert(f.key('keydown', 'ArrowRight').stopped);
  f.advance(100);
  assert(f.drawn.at(-1).x > start.x);
  f.key('keydown', 'KeyM');
  assert.equal(f.frames.size, 0);
  assert(f.key('keydown', 'ArrowRight', { repeat: true }).stopped);
  f.key('keyup', 'ArrowRight');
  f.key('keyup', 'KeyM');
  f.elements.get('menu-town').click();
  f.advance(200);
  const returned = f.drawn.at(-1);
  f.advance(300);
  assert.deepEqual(f.drawn.at(-1), returned);
  assert.equal(JSON.stringify(f.game.DB.save), before);
  assert.equal(f.frames.size, 1);
});

test('every door dispatches its existing menu handler once and returns to town', () => {
  for (const building of town.BUILDINGS) {
    const f = fixture();
    f.game.Flow.goMenu();
    f.advance(0);
    const queue = [{ ...town.SPAWN, path: [] }], visited = new Set();
    let path;
    for (let i = 0; i < queue.length; i++) {
      const point = queue[i];
      if (town.nearby(point)?.id === building.id) { path = point.path; break; }
      for (const [dx, dy, code] of [[8, 0, 'ArrowRight'], [-8, 0, 'ArrowLeft'],
        [0, 8, 'ArrowDown'], [0, -8, 'ArrowUp']]) {
        const x = point.x + dx, y = point.y + dy, key = x + ',' + y;
        if (!visited.has(key) && town.walkable(x, y)) {
          visited.add(key);
          queue.push({ x, y, path: [...point.path, code] });
        }
      }
    }
    assert(path, building.id);
    let time = 0;
    for (const code of path) {
      f.key('keydown', code);
      f.advance(time += 8000 / town.SPEED);
      f.key('keyup', code);
    }
    f.key('keydown', 'KeyE');
    f.key('keydown', 'KeyE', { repeat: true });
    f.key('keyup', 'KeyE');
    assert.deepEqual(f.actions, [building.id]);
    assert(f.visible('scr-' + building.id));
    assert.equal(f.frames.size, 0);
    f.game.UI.show('scr-menu');
    assert(!f.visible('scr-menu'));
    assert(f.visible('scr-town'));
    assert.equal(f.frames.size, 1);
  }
});

test('modal visibility pauses the town and removes its controls from keyboard focus', () => {
  const f = fixture();
  f.game.Flow.goMenu();
  f.elements.get('scr-settings').classList.remove('hidden');
  f.observe();
  assert.equal(f.frames.size, 0);
  assert.equal(f.elements.get('scr-town').inert, true);
  assert(!f.key('keydown', 'ArrowRight').stopped);
  f.elements.get('scr-settings').classList.add('hidden');
  f.observe();
  assert.equal(f.frames.size, 1);
  assert.equal(f.elements.get('scr-town').inert, false);
  assert.equal(f.key('keydown', 'Tab').prevented, undefined);
  assert(f.key('keydown', 'Tab').stopped);
  const space = f.key('keydown', 'Space', { target: f.elements.get('town-menu') });
  assert(space.stopped);
  assert.equal(space.prevented, undefined, 'Space retains the focused button default action');
});

test('blur, hidden tabs, pointer cancellation and native hideAll stop town updates', () => {
  const f = fixture();
  f.game.Flow.goMenu();
  f.pads[3].dispatch('pointerdown', { pointerId: 7, preventDefault() {} });
  f.advance(0);
  f.advance(100);
  f.pads[3].dispatch('pointercancel', { pointerId: 7 });
  const position = f.drawn.at(-1);
  f.advance(200);
  assert.deepEqual(f.drawn.at(-1), position);
  f.key('blur');
  assert.equal(f.frames.size, 0);
  f.key('focus');
  assert.equal(f.frames.size, 1);
  f.host.document.hidden = true;
  f.key('visibilitychange');
  assert.equal(f.frames.size, 0);
  f.host.document.hidden = false;
  f.key('visibilitychange');
  assert.equal(f.frames.size, 1);
  f.game.UI.hideAll();
  assert(!f.visible('scr-town'));
  assert.equal(f.frames.size, 0);
});

test('partner, shiny and account changes refresh the avatar and isolate positions', () => {
  const f = fixture();
  f.game.Flow.goMenu();
  assert.equal(f.avatars.at(-1).dex, 25);
  f.game.DB.save.shiny[25] = {};
  f.game.DB.save.partnerShiny = true;
  f.sync.forEach(callback => callback());
  assert.equal(f.avatars.at(-1).shiny, true);
  f.game.DB.save.partner = 4;
  f.sync.forEach(callback => callback());
  assert.equal(f.avatars.at(-1).dex, 4);
  assert.equal(f.avatars.at(-1).shiny, false);
  f.advance(0);
  f.key('keydown', 'ArrowRight');
  f.advance(100);
  assert(f.drawn.at(-1).x > town.SPAWN.x);
  f.game.DB.user = 'second';
  f.sync.forEach(callback => callback());
  f.advance(200);
  assert.deepEqual(f.drawn.at(-1), town.SPAWN);
  f.game.UI.show('scr-login');
  assert(!f.visible('scr-town'));
  assert.equal(f.frames.size, 0);
});

test('cloud users with the same display name cannot share a town position', () => {
  const f = fixture();
  f.game.DB.fb = { uid: 'first-id' };
  f.game.Flow.goMenu();
  f.advance(0);
  f.key('keydown', 'ArrowRight');
  f.advance(100);
  assert(f.drawn.at(-1).x > town.SPAWN.x);
  f.game.DB.fb = { uid: 'second-id' };
  f.sync.forEach(callback => callback());
  f.advance(200);
  assert.deepEqual(f.drawn.at(-1), town.SPAWN);
});

test('the town never bypasses the existing Play handler or cooperative room checks', () => {
  const f = fixture();
  f.game.Flow.goMenu();
  f.elements.get('town-menu').click();
  let room = true, prepared = 0, lobbies = 0;
  f.elements.get('menu-play').onclick = () => {
    if (room) lobbies++;
    else prepared++;
  };
  f.elements.get('menu-play').click();
  assert.equal(lobbies, 1);
  assert.equal(prepared, 0);
  room = false;
  f.elements.get('menu-play').click();
  assert.equal(prepared, 1);
  assert.equal(lobbies, 1);
  assert.throws(() => town.install(f.game, f.host), /already installed/);
});

test('both entry points load the town after training and cache all required assets', () => {
  const worker = fs.readFileSync(require.resolve('../sw.js'), 'utf8');
  for (const page of ['../index.html', '../en/index.html']) {
    const source = fs.readFileSync(require.resolve(page), 'utf8');
    assert(source.indexOf('src="js/training.js') < source.indexOf('src="js/town.js'));
    assert(source.indexOf('src="js/town.js') < source.indexOf('src="js/app.min.js'));
    const asset = /src="(js\/town\.js\?v=[^"]+)"/.exec(source)[1];
    assert(worker.includes('./' + asset));
    for (const building of town.BUILDINGS) {
      assert(source.includes(building.id === 'training' ? 'id="menu-training"' : 'data-go="' + building.id + '"'));
    }
  }
});
