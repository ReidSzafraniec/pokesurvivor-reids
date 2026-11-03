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

test('seven buildings, a payphone, a leaderboard board and a north route serve every town destination', () => {
  assert.deepEqual(town.BUILDINGS.map(b => b.id).sort(),
    ['bag', 'dex', 'gacha', 'goals', 'settings', 'shop', 'training']);
  assert.equal(town.DESTINATIONS.length, 10);
  assert.equal(new Set(town.DESTINATIONS.map(b => b.id)).size, 10);
  assert.equal(town.DESTINATIONS.find(b => b.id === 'rank').kind, 'board');
  const route = town.DESTINATIONS.find(b => b.id === 'play');
  assert.equal(route.kind, 'route');
  assert(route.door.y < 160);
  assert(Math.abs(route.door.x - town.WIDTH / 2) < 64);
  assert(!town.DESTINATIONS.some(b => b.id === 'upgrades'));
  const phone = town.DESTINATIONS.find(b => b.id === 'friends');
  const board = town.DESTINATIONS.find(b => b.id === 'rank');
  assert.equal(phone.kind, 'phone');
  assert(phone.x > board.x + board.w);
  assert(phone.y + phone.h <= town.PLAZA.y);
  assert(!town.PATHS.some(p => phone.x < p.x + p.w && phone.x + phone.w > p.x &&
    phone.y + phone.h - 12 < p.y + p.h && phone.y + phone.h > p.y), 'The payphone stands on grass');
  const center = town.BUILDINGS.find(b => b.id === 'dex');
  assert.equal(center.style, 'center');
  assert(center.x < town.PLAZA.x && center.y >= 400, 'Pokemon Center replaces the former Friends house');
  const gym = town.BUILDINGS.find(b => b.id === 'training');
  assert.equal(gym.style, 'gym');
  assert.equal(town.BUILDINGS.find(b => b.id === 'shop').style, 'shop');
  const missions = town.BUILDINGS.find(b => b.id === 'goals');
  assert.deepEqual({ x: missions.x, y: missions.y }, { x: 816, y: 176 });
});

test('destinations can only be used directly in front, not alongside or behind them', () => {
  for (const d of town.DESTINATIONS) {
    assert.equal(town.nearby(d.door)?.id, d.id);
    assert.notEqual(town.nearby({ x: d.approach.x - 1, y: d.door.y })?.id, d.id);
    assert.notEqual(town.nearby({ x: d.approach.x + d.approach.w + 1, y: d.door.y })?.id, d.id);
    assert.notEqual(town.nearby({ x: d.door.x, y: d.approach.y - 1 })?.id, d.id);
    assert.notEqual(town.nearby({ x: d.door.x, y: d.approach.y + d.approach.h + 1 })?.id, d.id);
  }
});

test('lamps align along road edges without occupying paths or interaction approaches', () => {
  const lamps = town.PROPS.filter(p => p.kind === 'lamp');
  assert.equal(lamps.length, 6);
  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  for (const lamp of lamps) {
    assert(town.SOLIDS.includes(lamp.footprint));
    assert(!town.PATHS.some(p => overlaps(lamp.footprint, p)), 'Lamp base must stay off paths');
    assert(!town.DESTINATIONS.some(d => overlaps(lamp.footprint, d.approach)), 'Keep all entrances clear');
    assert(!town.SOLIDS.some(s => s !== lamp.footprint && overlaps(lamp.footprint, s)), 'Do not overlap other obstacles');
    assert.equal(lamps.filter(other => other.y === lamp.y).length, 2, 'Place lamps in aligned pairs');
  }
});

test('every destination has a reachable, unambiguous approach from spawn', () => {
  const start = { ...town.SPAWN }, queue = [start], visited = new Set([start.x + ',' + start.y]);
  assert(town.walkable(start.x, start.y));
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
  for (const building of town.DESTINATIONS) {
    assert(town.walkable(building.door.x, building.door.y), building.id);
    assert(queue.some(p => town.nearby(p)?.id === building.id), 'Unreachable: ' + building.id);
    assert.equal(town.nearby(building.door).id, building.id);
    assert.equal(town.DESTINATIONS.filter(b => building.door.x >= b.approach.x &&
      building.door.x <= b.approach.x + b.approach.w && building.door.y >= b.approach.y &&
      building.door.y <= b.approach.y + b.approach.h).length, 1);
  }
});

test('building collision follows the facade while the roof remains an overhead layer', () => {
  for (const b of town.BUILDINGS) {
    assert.equal(b.footprint.y, b.y + b.roofHeight + 4);
    assert.equal(b.footprint.y + b.footprint.h, b.y + b.h);
    assert(town.SOLIDS.includes(b.footprint));
    assert(town.walkable(b.x + b.w / 2, b.y + 8), 'The roof does not block walking behind a building');
    assert(!town.walkable(b.x + b.w / 2, b.y + b.h - 8), 'The facade is solid');
  }
});

test('diagonal movement is normalized, analog input is retained, and pause gaps are clamped', () => {
  const point = { ...town.SPAWN };
  for (const axis of [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: -1, y: 1 }]) {
    const next = town.move(point, axis, 0.1);
    assert(Math.abs(Math.hypot(next.x - point.x, next.y - point.y) - town.SPEED / 10) < 1e-8);
    assert.deepEqual(town.move(point, axis, 10), next);
  }
  assert.equal(town.move(point, { x: 0.5, y: 0 }, 0.1).x, point.x + town.SPEED / 20);
  assert.deepEqual(town.move(point, { x: 0, y: 0 }, 0.1), point);
  assert.deepEqual(point, town.SPAWN);
});

test('swept movement cannot enter any building, pond, or town boundary', () => {
  for (const solid of town.SOLIDS) {
    let point = { x: solid.x + solid.w / 2, y: solid.y + solid.h + town.RADIUS + 1 };
    while (!town.walkable(point.x, point.y) && point.y < town.HEIGHT - 48) point.y += 8;
    assert(town.walkable(point.x, point.y), 'A clear approach must exist below the obstacle');
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
  const painted = [], rendered = [], labels = [];
  brush.fillRect = (x, y, w, h) => painted.push({ color: brush.fillStyle, x, y, w, h });
  brush.fillText = text => labels.push(text);
  brush.drawImage = (image, x, y) => {
    if (image.width === town.WIDTH && image.height === town.HEIGHT) rendered.length = 0;
    rendered.push({ kind: 'layer', x, y });
  };
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
  const screenIds = ['scr-town', 'scr-menu', 'scr-login', ...town.DESTINATIONS.map(b => 'scr-' + b.id)];
  screenIds.forEach(id => element(id));
  for (const id of ['town-map', 'town-menu', 'town-partner', 'town-action', 'town-interact', 'town-nearby', 'menu-town']) element(id);
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
        draw(ctx, x, y) { drawn.push({ x, y }); rendered.push({ kind: 'avatar', x, y }); }
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
        for (const b of town.DESTINATIONS) {
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
  return { game, host, elements, frames, sync, avatars, drawn, painted, rendered, labels, actions, advance, key, pads,
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

test('the landscaped plaza connects spawn, the leaderboard and the north route', () => {
  const f = fixture();
  f.game.Flow.goMenu();
  const { x, y, w, h } = town.PLAZA;
  const plaza = f.painted.find(r => r.x === x && r.y === y && r.w === w && r.h === h);
  assert(plaza);
  assert(town.SPAWN.x >= x && town.SPAWN.x <= x + w);
  assert(town.SPAWN.y >= y && town.SPAWN.y <= y + h);
  for (let py = 48; py <= town.SPAWN.y; py += 8) assert(town.walkable(640, py));
  assert(town.PATHS.some(p => p.y === 0 && p.x <= 640 && p.x + p.w >= 640));
  assert(f.painted.some(r => r.color === '#f7edc9' && r.w >= 12 && r.h >= 16),
    'The leaderboard has posted-paper artwork');
});

test('plaza paving has staggered joints and clips every tile to its inset border', () => {
  const f = fixture();
  f.game.Flow.goMenu();
  const { x, y, w, h } = town.PLAZA;
  const rows = Array.from({ length: (h - 16) / 16 }, (_, row) =>
    f.painted.filter(r => r.y === y + 9 + row * 16 && r.h === 14 && r.x >= x + 9 && r.x < x + w - 8));
  for (const row of rows) {
    assert(row.length >= 6, 'Every row must contain separate paving stones');
    assert(row.every(r => r.x + r.w <= x + w - 9), 'No stone may overhang the plaza');
    for (let i = 1; i < row.length; i++) {
      assert.equal(row[i].x - (row[i - 1].x + row[i - 1].w), 2, 'Visible mortar joints');
    }
  }
  const joints = row => row.map(r => r.x + r.w);
  assert.notDeepEqual(joints(rows[0]), joints(rows[1]), 'Adjacent rows must be staggered');
  assert.deepEqual(joints(rows[0]), joints(rows[2]), 'Stagger repeats every two rows');
});

test('gym, Pokemon Center, shop and payphone have their own recognizable artwork', () => {
  const f = fixture();
  f.game.Flow.goMenu();
  for (const [id, color] of [['training', '#d3bf77'], ['dex', '#e5edf2'], ['shop', '#69bbdc'],
    ['friends', '#cc514c']]) {
    const d = town.DESTINATIONS.find(d => d.id === id);
    assert(f.painted.some(r => r.color === color && r.x >= d.x - 8 && r.x < d.x + d.w &&
      r.y >= d.y - 8 && r.y < d.y + d.h), id + ' must not fall back to the generic house artwork');
  }
  const phone = town.DESTINATIONS.find(d => d.kind === 'phone');
  assert(f.rendered.some(r => r.kind === 'layer' && r.x === phone.x - 8 && r.y === phone.y - 24));
  assert(!town.walkable(phone.door.x, phone.y + phone.h - 4), 'The payphone has a solid base');
});

test('landmark signs name the Training and Pokemon destinations instead of Gym and P.C.', () => {
  const f = fixture();
  f.game.Flow.goMenu();
  assert(f.labels.includes('Entrenamiento'));
  assert(f.labels.includes('Pok\u00e9mon'));
  assert(!f.labels.includes('Gimnasio'));
  assert(!f.labels.includes('P.C.'));
  assert.equal(town.BUILDINGS.find(b => b.id === 'training').label, 'Entrenamiento');
  assert.equal(town.BUILDINGS.find(b => b.id === 'dex').label, 'Pok\u00e9mon');
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

function approach(f, id) {
  f.game.Flow.goMenu();
  f.advance(0);
  const queue = [{ ...town.SPAWN, path: [] }], visited = new Set();
  let path;
  for (let i = 0; i < queue.length; i++) {
    const point = queue[i];
    if (typeof id === 'function' ? id(point) : town.nearby(point)?.id === id) { path = point.path; break; }
    for (const [dx, dy, code] of [[8, 0, 'ArrowRight'], [-8, 0, 'ArrowLeft'],
      [0, 8, 'ArrowDown'], [0, -8, 'ArrowUp']]) {
      const x = point.x + dx, y = point.y + dy, key = x + ',' + y;
      if (!visited.has(key) && town.walkable(x, y)) {
        visited.add(key);
        queue.push({ x, y, path: [...point.path, code] });
      }
    }
  }
  assert(path, String(id));
  let time = 0;
  for (const code of path) {
    f.key('keydown', code);
    f.advance(time += 8000 / town.SPEED);
    f.key('keyup', code);
  }
}

test('cached buildings render behind the partner at their entrance and over the partner behind their roof', () => {
  const b = town.BUILDINGS.find(b => b.id === 'training');
  for (const behind of [false, true]) {
    const f = fixture();
    approach(f, behind ? point => point.x === b.door.x && point.y === b.y + 32 : b.id);
    const buildingIndex = f.rendered.findIndex(r => r.kind === 'layer' && r.x === b.x - 16 && r.y === b.y - 32);
    const avatarIndex = f.rendered.findIndex(r => r.kind === 'avatar');
    assert(buildingIndex >= 0);
    assert(avatarIndex >= 0);
    assert.equal(avatarIndex < buildingIndex, behind);
  }
  const f = fixture();
  f.game.Flow.goMenu();
  const count = f.painted.length;
  f.advance(0);
  f.advance(100);
  assert.equal(f.painted.length - count, 2, 'Only the viewport background is filled; scenery is not repainted');
});

test('every destination dispatches its existing menu handler once and returns to town', () => {
  for (const building of town.DESTINATIONS) {
    const f = fixture();
    approach(f, building.id);
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

test('board, phone and route use distinct prompts and explicit keyboard or touch activation', () => {
  for (const [id, label] of [['rank', 'Leer tabla'], ['friends', 'Llamar'], ['play', 'Salir de expedici\u00f3n']]) {
    for (const touch of [false, true]) {
      const f = fixture();
      approach(f, id);
      assert.deepEqual(f.actions, [], 'Walking to the destination never activates it');
      assert.equal(f.elements.get('town-interact').textContent, label);
      assert.equal(f.elements.get('town-interact').disabled, false);
      assert(f.visible('town-action'));
      const before = f.drawn.at(-1);
      if (touch) f.elements.get('town-interact').click();
      else f.key('keydown', 'Space');
      assert.deepEqual(f.actions, [id]);
      f.game.UI.show('scr-menu');
      assert.deepEqual(f.drawn.at(-1), before, 'Return to the same town position');
    }
  }
});

test('the entire interaction panel appears only while standing in front of a destination', () => {
  const f = fixture();
  f.game.Flow.goMenu();
  assert(!f.visible('town-action'));
  assert.equal(f.elements.get('town-interact').disabled, true);
  approach(f, 'rank');
  assert(f.visible('town-action'));
  f.key('keydown', 'ArrowDown');
  for (let i = 0; i < 10; i++) f.advance(10000 + i * 100);
  f.key('keyup', 'ArrowDown');
  assert(!f.visible('town-action'));
  assert.equal(f.elements.get('town-interact').disabled, true);
  f.key('keydown', 'KeyE');
  f.elements.get('town-interact').click();
  assert.deepEqual(f.actions, []);
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
    const stylesheet = /href="(css\/style\.css\?v=[^"]+)"/.exec(source)[1];
    assert(worker.includes('./' + stylesheet));
    assert(source.includes('E / Espacio: interactuar'));
    for (const building of town.DESTINATIONS) {
      assert(source.includes(building.id === 'training' ? 'id="menu-training"' : 'data-go="' + building.id + '"'));
    }
  }
});
