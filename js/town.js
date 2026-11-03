(function () {
  'use strict';

  const WIDTH = 1152, HEIGHT = 896, RADIUS = 10, SPEED = 170;
  const SPAWN = Object.freeze({ x: 528, y: 548 });
  const BUILDINGS = Object.freeze([
    ['play', 'Expediciones', 88, 112, '#bd6651', 'ball'],
    ['training', 'Entrenamiento', 344, 112, '#6887b5', 'book'],
    ['dex', 'Pok\u00e9mon', 600, 112, '#779b68', 'book'],
    ['friends', 'Amigos', 88, 368, '#8e79b1', 'friends'],
    ['rank', 'Ranking', 600, 368, '#b49751', 'trophy'],
    ['settings', 'Ajustes', 856, 368, '#6d9199', 'settings'],
    ['shop', 'Tienda Kecleon', 88, 656, '#7b9b57', 'shop'],
    ['bag', 'Mochila', 344, 656, '#af8058', 'bag'],
    ['gacha', 'Gacha', 600, 656, '#9a719d', 'ball4'],
    ['goals', 'Misiones', 856, 656, '#648d99', 'medal3']
  ].map(([id, label, x, y, color, icon]) => Object.freeze({
    id, label, x, y, color, icon, w: 160, h: 128,
    door: Object.freeze({ x: x + 80, y: y + 150 })
  })));
  const SOLIDS = Object.freeze([
    ...BUILDINGS.map(b => Object.freeze({ x: b.x, y: b.y, w: b.w, h: b.h })),
    Object.freeze({ x: 368, y: 368, w: 160, h: 96 })
  ]);
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));

  function walkable(x, y) {
    return x >= 32 + RADIUS && y >= 32 + RADIUS &&
      x <= WIDTH - 32 - RADIUS && y <= HEIGHT - 32 - RADIUS &&
      !SOLIDS.some(r => x + RADIUS > r.x && x - RADIUS < r.x + r.w &&
        y + RADIUS > r.y && y - RADIUS < r.y + r.h);
  }

  function move(position, axis, seconds) {
    if (![position.x, position.y, axis.x, axis.y, seconds].every(Number.isFinite) || seconds < 0) {
      throw new RangeError('Invalid town movement');
    }
    const length = Math.max(1, Math.hypot(axis.x, axis.y));
    const dx = axis.x / length * SPEED * Math.min(seconds, 0.1);
    const dy = axis.y / length * SPEED * Math.min(seconds, 0.1);
    // Small swept steps prevent crossing a solid between two low-frame-rate updates.
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (RADIUS / 2)));
    let { x, y } = position;
    for (let i = 0; i < steps; i++) {
      if (walkable(x + dx / steps, y)) x += dx / steps;
      if (walkable(x, y + dy / steps)) y += dy / steps;
    }
    return { x, y };
  }

  function nearby(position) {
    return BUILDINGS.find(b => Math.hypot(position.x - b.door.x, position.y - b.door.y) <= 46) || null;
  }

  function direction(x, y) {
    return (Math.round((Math.PI / 2 - Math.atan2(y, x)) / (Math.PI / 4)) + 8) % 8;
  }

  function install(game, host = window) {
    if (game.Town) throw new Error('Town is already installed');
    const doc = host.document, $ = id => doc.getElementById(id);
    const screen = $('scr-town'), canvas = $('town-map'), menu = $('scr-menu');
    if (!screen || !canvas || !menu) throw new Error('Missing town screen');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create the town canvas');
    const keys = new Set(), captured = new Set(), pointers = new Map(), actions = new Map();
    const moves = {
      KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1],
      KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0]
    };
    const text = value => game.T(value);
    let position = { ...SPAWN }, account, avatar, appearance = '', shortcut = false;
    let frame = null, last = null, focused = true, initialized = false, currentDoor;
    let scenery, scale = 1, viewWidth = 0, viewHeight = 0;

    game.I18n.add({
      'Villa Compa\u00f1era': 'Partner Village',
      'Tu pr\u00f3xima aventura empieza aqu\u00ed.': 'Your next adventure starts here.',
      'Expediciones': 'Expeditions',
      'Volver al pueblo': 'Return to town',
      'Men\u00fa': 'Menu',
      'Camina hasta una puerta para abrir su men\u00fa.': 'Walk up to a door to open its menu.',
      'WASD / flechas: moverse \u00b7 E / Espacio: entrar \u00b7 M / Esc: men\u00fa':
        'WASD / arrows: move \u00b7 E / Space: enter \u00b7 M / Esc: menu',
      'Entrar': 'Enter',
      'Ac\u00e9rcate a una puerta': 'Approach a door',
      'Mover arriba': 'Move up',
      'Mover abajo': 'Move down',
      'Mover a la izquierda': 'Move left',
      'Mover a la derecha': 'Move right',
      'Pueblo explorable': 'Walkable town'
    });

    function visible(element) {
      return !element.classList.contains('hidden');
    }

    function blocked() {
      return !!doc.querySelector('.scr:not(.hidden):not(#scr-town), #sound-panel:not(.hidden)');
    }

    function active() {
      return initialized && focused && !doc.hidden && game.Game.state === 'ui' &&
        !!game.DB.save?.partner && visible(screen) && !blocked();
    }

    function clearInput() {
      keys.clear();
      pointers.clear();
      screen.querySelectorAll('[data-town-move]').forEach(button => {
        if (button.classList.contains('pressed')) button.classList.remove('pressed');
      });
    }

    function stop() {
      clearInput();
      if (frame !== null) host.cancelAnimationFrame(frame);
      frame = null;
      last = null;
    }

    function syncAccount() {
      const save = game.DB.save;
      const uid = game.DB.fb?.uid;
      const identity = game.DB.guest ? save : uid ? 'cloud:' + uid :
        game.DB.user ? 'local:' + game.DB.user : save;
      if (account !== identity) {
        account = identity;
        position = { ...SPAWN };
        shortcut = false;
        appearance = '';
        clearInput();
      }
      if (!save?.partner) return false;
      const dex = save.partner, shiny = !!save.partnerShiny && !!save.shiny?.[dex];
      const skin = game.Skins.worn(save, dex);
      const signature = [dex, shiny, skin].join(':');
      if (signature !== appearance) {
        const meta = game.Sprites.animMeta(dex, 'Idle', shiny);
        const size = meta ? Math.min(1, 36 / meta.w, 36 / meta.h) : 1;
        avatar = new game.Sprites.Animator(dex, size, shiny);
        avatar.skin = skin;
        appearance = signature;
        $('town-partner').textContent = game.DEX_BY[dex].name + (shiny ? ' \u2605' : '');
      }
      return true;
    }

    function rect(context, color, x, y, w, h) {
      context.fillStyle = color;
      context.fillRect(x, y, w, h);
    }

    function tree(context, x, y) {
      rect(context, '#796140', x - 5, y + 6, 10, 22);
      rect(context, '#254f49', x - 22, y - 10, 44, 30);
      rect(context, '#32634b', x - 26, y - 18, 52, 26);
      rect(context, '#438357', x - 20, y - 32, 40, 26);
      rect(context, '#5c9960', x - 12, y - 35, 20, 12);
    }

    function building(context, b) {
      const { x, y, w, h } = b;
      rect(context, '#436c51', x + 8, y + h - 4, w + 4, 16);
      rect(context, '#695a50', x, y + 44, w, h - 44);
      rect(context, '#efdfb2', x + 4, y + 46, w - 8, h - 50);
      rect(context, '#d7c391', x + 4, y + h - 18, w - 8, 14);
      rect(context, '#f7ebc7', x + 8, y + 50, 8, h - 70);
      rect(context, '#453f48', x - 8, y + 18, w + 16, 40);
      rect(context, b.color, x - 8, y + 12, w + 16, 38);
      rect(context, b.color, x + 4, y, w - 8, 16);
      rect(context, '#ffffff28', x + 8, y + 4, w - 16, 6);
      for (let row = y + 20; row < y + 48; row += 10) {
        rect(context, '#0000001c', x - 4, row, w + 8, 2);
      }
      for (const wx of [x + 22, x + w - 48]) {
        rect(context, '#735e51', wx - 3, y + 72, 32, 30);
        rect(context, '#a3d8da', wx, y + 75, 26, 22);
        rect(context, '#e7f2ce', wx + 11, y + 75, 3, 22);
        rect(context, '#e7f2ce', wx, y + 85, 26, 3);
      }
      rect(context, '#705140', x + 62, y + h - 36, 36, 36);
      rect(context, '#433f3c', x + 67, y + h - 31, 26, 31);
      rect(context, '#d2ad63', x + 85, y + h - 19, 3, 3);
      rect(context, '#e0cf9f', x + 54, y + h, 52, 7);
      rect(context, '#203e40', x + 8, y + 52, w - 16, 21);
      context.fillStyle = '#fff6db';
      context.font = "bold 14px Pixelify, sans-serif";
      context.textAlign = 'center';
      context.fillText(text(b.label), x + w / 2, y + 67, w - 22);
    }

    function makeScenery() {
      scenery = doc.createElement('canvas');
      scenery.width = WIDTH;
      scenery.height = HEIGHT;
      const brush = scenery.getContext('2d');
      rect(brush, '#7dab69', 0, 0, WIDTH, HEIGHT);
      for (let y = 0; y < HEIGHT; y += 16) {
        for (let x = 0; x < WIDTH; x += 16) {
          const n = (x * 13 + y * 7) % 29;
          if (n < 5) rect(brush, '#91b975', x + 4, y + 6, 3, 2);
          if (n === 7) rect(brush, '#6c9d5d', x + 10, y + 12, 4, 3);
        }
      }
      for (const y of [280, 536, 824]) {
        rect(brush, '#c7b27c', 48, y - 8, WIDTH - 96, 48);
        rect(brush, '#dcc792', 48, y - 4, WIDTH - 96, 40);
        for (let x = 64; x < WIDTH - 64; x += 32) rect(brush, '#bca873', x, y + 10, 12, 2);
      }
      for (const x of [288, 544, 800, 1056]) {
        rect(brush, '#c7b27c', x - 8, 64, 48, HEIGHT - 96);
        rect(brush, '#dcc792', x - 4, 64, 40, HEIGHT - 96);
      }
      rect(brush, '#8b927c', 344, 496, 192, 112);
      rect(brush, '#a2ad96', 352, 504, 176, 96);
      for (let row = 0; row < 6; row++) {
        for (let x = 352 - (row % 2) * 16; x < 528; x += 32) {
          const left = Math.max(x, 352), right = Math.min(x + 32, 528);
          rect(brush, row % 2 ? '#c6cbb0' : '#d5d4ba', left + 1, 505 + row * 16, right - left - 2, 14);
        }
      }
      rect(brush, '#dcc792', 344, 532, 8, 40);
      rect(brush, '#dcc792', 528, 532, 16, 40);
      for (const b of BUILDINGS) {
        rect(brush, '#dcc792', b.door.x - 20, b.y + b.h, 40, 48);
        building(brush, b);
        for (const x of [b.x - 18, b.x + b.w + 10]) {
          rect(brush, '#986d4b', x, b.y + 110, 10, 10);
          rect(brush, '#e9b879', x - 3, b.y + 104, 7, 7);
          rect(brush, '#f4d0c4', x + 4, b.y + 101, 7, 7);
        }
      }
      rect(brush, '#a2a885', 372, 364, 152, 104);
      rect(brush, '#a2a885', 364, 372, 168, 88);
      rect(brush, '#527d91', 376, 372, 144, 88);
      rect(brush, '#527d91', 372, 380, 152, 72);
      rect(brush, '#80b4bb', 384, 380, 128, 72);
      rect(brush, '#80b4bb', 380, 388, 136, 56);
      for (let y = 392; y < 450; y += 16) {
        for (let x = 390; x < 490; x += 36) rect(brush, '#b5dbce', x, y, 16, 2);
      }
      for (const [x, y] of [[394, 432], [484, 400]]) {
        rect(brush, '#5e865a', x, y, 16, 6);
        rect(brush, '#5e865a', x + 3, y - 3, 10, 12);
        rect(brush, '#91b975', x + 3, y, 7, 3);
      }
      for (let x = 24; x < WIDTH; x += 48) {
        tree(brush, x, 22);
        tree(brush, x, HEIGHT - 28);
      }
      for (let y = 70; y < HEIGHT - 48; y += 56) {
        tree(brush, 12, y);
        tree(brush, WIDTH - 12, y);
      }
      rect(brush, '#203e4033', 388, 590, 50, 8);
      rect(brush, '#66503d', 390, 570, 4, 26);
      rect(brush, '#66503d', 426, 570, 4, 26);
      rect(brush, '#a67e4e', 386, 570, 48, 5);
      rect(brush, '#a67e4e', 386, 578, 48, 4);
      rect(brush, '#c79b61', 384, 584, 52, 5);
      rect(brush, '#66503d', 384, 589, 52, 3);
    }

    function resize() {
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const pixelRatio = Math.min(host.devicePixelRatio || 1, 2);
      canvas.width = Math.round(bounds.width * pixelRatio);
      canvas.height = Math.round(bounds.height * pixelRatio);
      scale = clamp(Math.min(bounds.width / 960, bounds.height / 600), 0.75, 1.5);
      viewWidth = bounds.width / scale;
      viewHeight = bounds.height / scale;
      draw();
    }

    function draw() {
      if (!scenery || !avatar || !viewWidth) return;
      const left = clamp(position.x - viewWidth / 2, 0, Math.max(0, WIDTH - viewWidth));
      const top = clamp(position.y - viewHeight / 2, 0, Math.max(0, HEIGHT - viewHeight));
      const zoom = canvas.width / viewWidth;
      ctx.setTransform(zoom, 0, 0, zoom, -Math.round(left * zoom), -Math.round(top * zoom));
      ctx.imageSmoothingEnabled = false;
      rect(ctx, '#315749', left, top, viewWidth, viewHeight);
      ctx.drawImage(scenery, 0, 0);
      const door = nearby(position);
      if (door) {
        rect(ctx, '#fff0ac', door.door.x - 23, door.y + door.h + 8, 46, 4);
        ctx.strokeStyle = '#fff0ac';
        ctx.lineWidth = 2;
        ctx.strokeRect(door.x + 59, door.y + door.h - 39, 42, 42);
      }
      ctx.fillStyle = '#203e4055';
      ctx.beginPath();
      ctx.ellipse(position.x, position.y + 2, 15, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      avatar.draw(ctx, Math.round(position.x), Math.round(position.y));
      if (currentDoor !== door) {
        currentDoor = door;
        $('town-interact').disabled = !door;
        $('town-interact').textContent = text(door ? 'Entrar' : 'Ac\u00e9rcate a una puerta');
        $('town-nearby').textContent = door ? text(door.label) : text('Camina hasta una puerta para abrir su men\u00fa.');
      }
    }

    function tick(now) {
      frame = null;
      if (!active()) return stop();
      if (!syncAccount()) return stop();
      let x = 0, y = 0;
      for (const code of keys) {
        x += moves[code][0];
        y += moves[code][1];
      }
      for (const axis of pointers.values()) {
        x += axis[0];
        y += axis[1];
      }
      const elapsed = last === null ? 0 : (now - last) / 1000;
      last = now;
      const next = move(position, { x, y }, elapsed);
      const walking = next.x !== position.x || next.y !== position.y;
      if (walking) avatar.dir = direction(x, y);
      avatar.loop(walking ? 'Walk' : 'Idle');
      avatar.update(Math.min(elapsed, 0.1));
      position = next;
      draw();
      frame = host.requestAnimationFrame(tick);
    }

    function synchronize() {
      const running = active();
      screen.inert = !running;
      if (!running) return stop();
      if (frame === null) {
        last = null;
        frame = host.requestAnimationFrame(tick);
      }
    }

    function showTown() {
      if (!syncAccount()) return;
      screen.classList.remove('hidden');
      menu.classList.add('hidden');
      $('menu-town').classList.remove('hidden');
      resize();
      synchronize();
      canvas.focus({ preventScroll: true });
    }

    function openMenu() {
      if (!active()) return;
      stop();
      shortcut = true;
      game.MenuUI.open();
      $('menu-town').focus();
    }

    function returnToTown() {
      shortcut = false;
      game.MenuUI.open();
    }

    function enter() {
      if (!active()) return;
      const door = nearby(position);
      if (!door) return;
      stop();
      shortcut = false;
      actions.get(door.id).click();
      synchronize();
    }

    const originalShow = game.UI.show;
    game.UI.show = function (id, ...args) {
      stop();
      syncAccount();
      originalShow.call(this, id, ...args);
      if (id === 'scr-login' || game.Game.state !== 'ui' || !game.DB.save?.partner) {
        screen.classList.add('hidden');
        if (id === 'scr-login') shortcut = false;
      } else if (id === 'scr-menu' && !shortcut) {
        showTown();
      }
      synchronize();
    };
    const originalHideAll = game.UI.hideAll;
    game.UI.hideAll = function (...args) {
      stop();
      screen.classList.add('hidden');
      return originalHideAll.apply(this, args);
    };
    const originalHide = game.UI.hide;
    game.UI.hide = function (...args) {
      const result = originalHide.apply(this, args);
      synchronize();
      return result;
    };
    const originalIsOpen = game.UI.isOpen;
    game.UI.isOpen = function (id) {
      // Native notifications and nickname prompts treat either home view as the menu.
      return originalIsOpen.call(this, id) ||
        (id === 'scr-menu' && visible(screen) && !blocked());
    };
    const originalGoMenu = game.Flow.goMenu;
    game.Flow.goMenu = function (...args) {
      shortcut = false;
      return originalGoMenu.apply(this, args);
    };
    const originalInit = game.MenuUI.init;
    game.MenuUI.init = function (...args) {
      originalInit.apply(this, args);
      for (const b of BUILDINGS) {
        const button = b.id === 'training' ? $('menu-training') :
          doc.querySelector('#scr-menu [data-go="' + b.id + '"]');
        if (!button || typeof button.onclick !== 'function') {
          throw new Error('Missing town destination: ' + b.id);
        }
        actions.set(b.id, button);
      }
      screen.querySelectorAll('[data-town-text]').forEach(element => {
        element.textContent = text(element.dataset.townText);
      });
      screen.querySelectorAll('[data-town-move]').forEach(button => {
        button.setAttribute('aria-label', text(button.dataset.label));
        button.addEventListener('pointerdown', event => {
          if (!active()) return;
          event.preventDefault();
          button.setPointerCapture(event.pointerId);
          pointers.set(event.pointerId, moves[button.dataset.townMove]);
          button.classList.add('pressed');
        });
        const release = event => {
          pointers.delete(event.pointerId);
          button.classList.remove('pressed');
        };
        button.addEventListener('pointerup', release);
        button.addEventListener('pointercancel', release);
        button.addEventListener('lostpointercapture', release);
      });
      canvas.setAttribute('aria-label', text('Pueblo explorable'));
      $('town-menu').onclick = openMenu;
      $('town-interact').onclick = enter;
      $('menu-town').textContent = text('Volver al pueblo');
      $('menu-town').onclick = returnToTown;
      makeScenery();
      initialized = true;
    };

    host.addEventListener('keydown', event => {
      const code = event.code;
      if (code === 'Tab' && visible(screen) && game.Game.state === 'ui') {
        event.stopImmediatePropagation();
        return;
      }
      if (!active()) {
        if (captured.has(code)) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
        return;
      }
      if (event.ctrlKey || event.altKey || event.metaKey ||
          event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (!moves[code] && !['KeyE', 'Space', 'KeyM', 'Escape'].includes(code)) return;
      // Let Space activate a focused DOM button instead of also entering a door.
      if (code === 'Space' && event.target.closest('button')) {
        event.stopImmediatePropagation();
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      captured.add(code);
      if (moves[code]) keys.add(code);
      else if (!event.repeat) {
        if (code === 'KeyM' || code === 'Escape') openMenu();
        else enter();
      }
    }, true);
    host.addEventListener('keyup', event => {
      keys.delete(event.code);
      if (captured.delete(event.code)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
    host.addEventListener('blur', () => {
      focused = false;
      captured.clear();
      stop();
    });
    host.addEventListener('focus', () => { focused = true; synchronize(); });
    host.addEventListener('resize', resize);
    doc.addEventListener('visibilitychange', () => {
      captured.clear();
      synchronize();
    });
    const observer = new host.MutationObserver(() => {
      if (visible(screen)) synchronize();
    });
    observer.observe(doc.body, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
    game.DB.onSync(() => {
      syncAccount();
      synchronize();
    });
    game.Town = { open: returnToTown };
    return game.Town;
  }

  const api = { WIDTH, HEIGHT, RADIUS, SPEED, SPAWN, BUILDINGS, SOLIDS, walkable, move, nearby, direction, install };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    window.PSTown = api;
    // Reuse the native bootstrap's readable installer without editing the obfuscated bundle.
    const installTraining = window.PSTraining.install;
    window.PSTraining.install = function (context) {
      const result = installTraining.call(this, context);
      install(context);
      return result;
    };
  }
})();
