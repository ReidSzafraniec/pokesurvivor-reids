(function () {
  'use strict';

  const Multiplayer = typeof module === 'object' && module.exports ?
    require('./town-multiplayer.js') : window.PSTownMultiplayer;
  const WIDTH = 1280, HEIGHT = 1024, RADIUS = 10, SPEED = 170;
  // An unchanged scene is still repainted this often (ms), e.g. once a sprite sheet finishes loading.
  const IDLE_REPAINT = 250;
  // Painted-once art stays CPU-backed: a GPU process reset (e.g. on Xbox Edge) would wipe GPU canvases.
  const CACHED_ART = Object.freeze({ willReadFrequently: true });
  const SPAWN = Object.freeze({ x: 640, y: 568 });
  const BUILDINGS = Object.freeze([
    ['training', 'Entrenamiento', 192, 176, 208, 160, '#ae9b57', 'gym'],
    ['dex', 'Pok\u00e9mon', 112, 400, 192, 160, '#d75d54', 'center'],
    ['settings', 'Ajustes', 1040, 352, 128, 112, '#668ba0', 'flat'],
    ['shop', 'Tienda', 176, 704, 176, 144, '#528bbe', 'shop'],
    ['bag', 'Mochila', 416, 736, 128, 112, '#ad7951', 'gable'],
    ['gacha', 'Gacha', 768, 720, 160, 144, '#9274b5', 'dome'],
    ['goals', 'Misiones', 816, 176, 176, 144, '#497e9b', 'hall']
  ].map(([id, label, x, y, w, h, color, style]) => {
    const roofHeight = style === 'flat' ? 32 : Math.min(64, h - 72);
    return Object.freeze({
      id, label, x, y, w, h, color, style, roofHeight, kind: 'building',
      footprint: Object.freeze({ x: x + 4, y: y + roofHeight + 4, w: w - 8, h: h - roofHeight - 4 }),
      approach: Object.freeze({ x: x + w / 2 - 24, y: y + h + RADIUS, w: 48, h: 40 }),
      door: Object.freeze({ x: x + w / 2, y: y + h + 24 })
    });
  }));
  const DESTINATIONS = Object.freeze([
    ...BUILDINGS,
    Object.freeze({
      id: 'rank', label: 'Ranking', kind: 'board', x: 480, y: 376, w: 112, h: 80,
      approach: Object.freeze({ x: 512, y: 466, w: 48, h: 40 }),
      door: Object.freeze({ x: 536, y: 480 })
    }),
    Object.freeze({
      id: 'friends', label: 'Amigos', kind: 'phone', x: 712, y: 392, w: 48, h: 64,
      approach: Object.freeze({ x: 712, y: 466, w: 48, h: 40 }),
      door: Object.freeze({ x: 736, y: 480 })
    }),
    Object.freeze({
      id: 'play', label: 'Expediciones', kind: 'route', x: 600, y: 48, w: 80, h: 64,
      approach: Object.freeze({ x: 610, y: 42, w: 60, h: 134 }),
      door: Object.freeze({ x: 640, y: 128 })
    })
  ]);
  const PLAZA = Object.freeze({ x: 480, y: 464, w: 288, h: 192 });
  const POND = Object.freeze([
    [896, 480, 112, 16], [880, 496, 160, 16], [864, 512, 192, 16],
    [848, 528, 224, 32], [864, 560, 208, 32], [880, 592, 176, 16],
    [896, 608, 144, 16], [912, 624, 112, 16]
  ].map(([x, y, w, h]) => Object.freeze({ x, y, w, h })));
  const PATHS = Object.freeze([
    { x: 600, y: 0, w: 80, h: 928 },
    { x: 264, y: 344, w: 672, h: 56 },
    { x: 872, y: 320, w: 64, h: 80 },
    { x: 200, y: 568, w: 400, h: 56 },
    { x: 168, y: 560, w: 64, h: 64 },
    { x: 680, y: 648, w: 432, h: 48 },
    { x: 1080, y: 464, w: 48, h: 232 },
    { x: 232, y: 872, w: 896, h: 56 },
    ...BUILDINGS.map(b => ({ x: b.door.x - 24, y: b.y + b.h, w: 48, h: b.y < 700 ? 48 : 80 }))
  ].map(Object.freeze));
  const TREES = Object.freeze([
    [456, 240], [760, 224], [1120, 248], [1128, 296], [360, 480],
    [400, 664], [816, 440], [1136, 656], [128, 672], [1056, 800], [1104, 800], [576, 800]
  ].map(([x, y]) => Object.freeze({ x, y })));
  const PROPS = Object.freeze([
    ['bench', 424, 536], ['bench', 704, 624],
    ['lamp', 568, 320], ['lamp', 704, 320], ['lamp', 448, 632],
    ['lamp', 792, 632], ['lamp', 368, 856], ['lamp', 968, 856]
  ].map(([kind, x, y]) => Object.freeze({
    kind, x, y,
    footprint: Object.freeze(kind === 'bench' ? { x, y, w: 56, h: 12 } : { x: x - 4, y: y + 6, w: 16, h: 6 })
  })));
  const SOLIDS = Object.freeze([
    ...BUILDINGS.map(b => b.footprint),
    ...POND,
    Object.freeze({ x: 484, y: 420, w: 104, h: 36 }),
    Object.freeze({ x: 716, y: 420, w: 40, h: 36 }),
    ...TREES.map(t => Object.freeze({ x: t.x - 8, y: t.y, w: 16, h: 16 })),
    ...PROPS.map(p => p.footprint),
    Object.freeze({ x: 708, y: 160, w: 8, h: 8 })
  ]);
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  // Fit by long/short axis so portrait screens see the same town area as landscape, rotated.
  function fitScale(width, height) {
    const long = Math.max(width, height), short = Math.min(width, height);
    return clamp(Math.min(long / 1120, short / 760), 0.6, 1.5);
  }

  function walkable(x, y) {
    return x >= 96 + RADIUS && y >= 32 + RADIUS &&
      x <= WIDTH - 96 - RADIUS && y <= HEIGHT - 64 - RADIUS &&
      (y >= 144 + RADIUS || (x >= 600 + RADIUS && x <= 680 - RADIUS)) &&
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
    return DESTINATIONS.find(({ approach: a }) => position.x >= a.x && position.x <= a.x + a.w &&
      position.y >= a.y && position.y <= a.y + a.h) || null;
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
    let ticking = false, stale = true, scene = '', paintedAt = -Infinity;
    let scenery, layers = [], sharedArt = new Map(), scale = 1, viewWidth = 0, viewHeight = 0;
    let walking = false, arrivalRoom = null, lobbyInitialized = false;
    const remoteAvatars = new Map();
    const multiplayer = Multiplayer.create(game, host, { walkable });
    let partyState = multiplayer.getSnapshot();

    game.I18n.add({
      'Villa Compa\u00f1era': 'Partner Village',
      'Tu pr\u00f3xima aventura empieza aqu\u00ed.': 'Your next adventure starts here.',
      'Expediciones': 'Expeditions',
      'Volver al pueblo': 'Return to town',
      'Men\u00fa': 'Menu',
      'WASD / flechas: moverse \u00b7 E / Espacio: interactuar \u00b7 M / Esc: men\u00fa':
        'WASD / arrows: move \u00b7 E / Space: interact \u00b7 M / Esc: menu',
      'Entrar': 'Enter',
      'Entrenamiento': 'Training',
      'Tienda': 'Shop',
      'Llamar': 'Call',
      'Leer tabla': 'Read board',
      'Salir de expedici\u00f3n': 'Head out',
      'Ruta de expediciones': 'Expedition route',
      'Mover arriba': 'Move up',
      'Mover abajo': 'Move down',
      'Mover a la izquierda': 'Move left',
      'Mover a la derecha': 'Move right',
      'Pueblo explorable': 'Walkable town',
      'Preparar grupo': 'Ready up',
      'Preparado': 'Ready',
      'No preparado': 'Not ready',
      'Prepararme': 'Mark ready',
      'Cancelar preparado': 'Unready',
      'Iniciando expedici\u00f3n...': 'Starting expedition...',
      'Grupo': 'Party',
      'Conectando al pueblo...': 'Connecting to town...',
      'Reconectando al pueblo...': 'Reconnecting to town...',
      'Todos deben prepararse. Cerrar esta sala cancela tu preparado.':
        'Everyone must ready up. Closing this menu unreadies you.',
      'Esperando conexi\u00f3n compatible. Si no conecta, actualizad el juego y volved a entrar.':
        'Waiting for compatible connections. If this persists, update the game and rejoin.',
      'No se pudo iniciar. Todos deben volver a prepararse.':
        'Could not start. Everyone needs to ready up again.',
      'Espera la conexi\u00f3n y abre la sala para prepararte.':
        'Wait for the connection and open the ready-up menu.',
      'No se pudo comunicar tu estado. Int\u00e9ntalo de nuevo.':
        'Could not send your ready status. Please try again.',
      'Todos los jugadores deben estar conectados y preparados.':
        'All players must be connected and ready.'
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
      walking = false;
      if (frame !== null) host.cancelAnimationFrame(frame);
      frame = null;
      last = null;
      publishPresence();
    }

    function publishPresence(knownBlocked) {
      if (!initialized || !avatar || !game.DB.save?.partner) return;
      const inUI = game.Game.state === 'ui' && !game.Coop.active;
      const readyMenu = inUI && visible($('scr-lobby'));
      multiplayer.setReadyMenuOpen(readyMenu);
      const location = !inUI ? 'away' : readyMenu ? 'ready' :
        !visible(screen) ? 'away' : (knownBlocked ?? blocked()) ? 'menu' : 'town';
      multiplayer.updateLocal({
        ...position, dir: avatar.dir || 0, walking: location === 'town' && walking,
        dex: avatar.dex, shiny: !!avatar.shiny, skin: avatar.skin || null, location
      });
    }

    function setText(element, value) {
      if (element.textContent !== value) element.textContent = value;
    }

    function setHidden(element, hidden) {
      if (element.classList.contains('hidden') !== hidden) {
        if (hidden) element.classList.add('hidden');
        else element.classList.remove('hidden');
      }
    }

    function refreshPartyUI() {
      if (!initialized) return;
      const inRoom = !!game.Social.room;
      setHidden($('town-party'), !inRoom);
      setHidden($('town-connection'), !inRoom);
      setText($('town-connection'), partyState.connection === 'connected' ?
        text('Grupo') + ': ' + partyState.members.length + '/4' :
        text(partyState.connection === 'reconnecting' ? 'Reconectando al pueblo...' : 'Conectando al pueblo...'));
      if (!lobbyInitialized) return;
      const connected = partyState.connection === 'connected';
      $('lobby-ready').disabled = !connected || partyState.launching;
      $('lobby-start').disabled = !partyState.canStart;
      $('scr-lobby').inert = partyState.launching;
      setText($('lobby-ready'), text(partyState.ready ? 'Cancelar preparado' : 'Prepararme'));
      const summary = partyState.members.map(m => m.name + ': ' +
        text(m.ready ? 'Preparado' : 'No preparado')).join(' \u00b7 ');
      setText($('lobby-readiness'), summary + (summary ? ' ' : '') + text(partyState.launching ?
        'Iniciando expedici\u00f3n...' : connected ?
          'Todos deben prepararse. Cerrar esta sala cancela tu preparado.' :
          'Esperando conexi\u00f3n compatible. Si no conecta, actualizad el juego y volved a entrar.'));
    }

    function updateRemoteAvatars(state) {
      const present = new Set();
      state.members.forEach((member, index) => {
        if (member.uid === game.Social.uid || !member.connected || !member.pose || member.pose.location === 'away') return;
        present.add(member.uid);
        const p = member.pose, signature = [p.dex, p.shiny, p.skin].join(':');
        let remote = remoteAvatars.get(member.uid);
        if (!remote || remote.appearance !== signature) {
          const meta = game.Sprites.animMeta(p.dex, 'Idle', p.shiny);
          const size = meta ? Math.min(1, 36 / meta.w, 36 / meta.h) : 1;
          const sprite = new game.Sprites.Animator(p.dex, size, p.shiny);
          sprite.skin = p.skin;
          remote = { sprite, appearance: signature, x: p.x, y: p.y };
          remoteAvatars.set(member.uid, remote);
        }
        Object.assign(remote, { target: p, name: member.name, color: game.Coop.COLORS[index] });
        remote.sprite.dir = p.dir;
        remote.sprite.loop(p.walking ? 'Walk' : 'Idle');
      });
      for (const id of remoteAvatars.keys()) if (!present.has(id)) remoteAvatars.delete(id);
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
        stale = true;
        $('town-partner').textContent = game.DEX_BY[dex].name + (shiny ? ' \u2605' : '');
      }
      return true;
    }

    function rect(context, color, x, y, w, h) {
      context.fillStyle = color;
      context.fillRect(x, y, w, h);
    }

    function blob(context, color, x, y, rx, ry) {
      for (let dy = -ry; dy < ry; dy += 4) {
        const span = Math.floor(rx * Math.sqrt(Math.max(0, 1 - ((dy + 2) / ry) ** 2)) / 4) * 4;
        if (span) rect(context, color, x - span, y + dy, span * 2, 4);
      }
    }

    function tree(context, x, y) {
      blob(context, '#244f4938', x + 6, y + 12, 38, 12);
      rect(context, '#534c39', x - 8, y - 12, 16, 28);
      rect(context, '#94794b', x - 4, y - 12, 6, 26);
      rect(context, '#bd9a5d', x - 4, y + 4, 2, 8);
      for (const [dx, dy, rx, ry] of [[0, -22, 38, 28], [-20, -32, 22, 24],
        [20, -32, 22, 24], [0, -50, 30, 30]]) {
        blob(context, '#204e43', x + dx, y + dy + 6, rx, ry);
        blob(context, '#2f7252', x + dx, y + dy, rx - 2, ry - 2);
        blob(context, '#419461', x + dx - 4, y + dy - 8, rx - 6, ry - 10);
        blob(context, '#65b477', x + dx - 8, y + dy - 14, rx - 12, ry - 18);
      }
      for (let i = 0; i < 32; i++) {
        const dx = (i * 19 % 60) - 30, dy = (i * 29 % 52) - 60;
        if ((dx / 34) ** 2 + ((dy + 36) / 40) ** 2 > 1) continue;
        const color = i % 3 ? '#76bd78' : '#245e48';
        rect(context, color, x + dx, y + dy, 4, 2);
        rect(context, color, x + dx + 2, y + dy - 2, 2, 2);
      }
    }

    function windowPane(context, x, y, w = 28, h = 24) {
      rect(context, '#6e6553', x - 4, y - 4, w + 8, h + 8);
      rect(context, '#f5e8be', x - 2, y - 2, w + 4, h + 4);
      rect(context, '#477a8b', x, y, w, h);
      rect(context, '#82c7d0', x + 2, y + 2, w - 4, h - 6);
      rect(context, '#bde7dc', x + 2, y + 2, w - 4, 6);
      rect(context, '#f5e8be', x + w / 2 - 1, y, 2, h);
      rect(context, '#f5e8be', x, y + h / 2, w, 2);
      rect(context, '#b09e74', x - 6, y + h + 4, w + 12, 4);
    }

    function sign(context, label, x, y, w) {
      rect(context, '#413e36', x - w / 2 - 2, y - 2, w + 4, 24);
      rect(context, '#f0d99c', x - w / 2, y, w, 20);
      rect(context, '#b39b67', x - w / 2, y + 18, w, 2);
      context.fillStyle = '#354e4a';
      context.font = 'bold 14px Pixelify, sans-serif';
      context.textAlign = 'center';
      context.fillText(text(label), x, y + 14, w - 8);
    }

    function building(context, b) {
      if (['gym', 'center', 'shop'].includes(b.style)) return landmark(context, b);
      const { x, y, w, h, roofHeight } = b, floor = y + h, center = x + w / 2;
      rect(context, '#254f4938', x + 10, floor - 8, w + 10, 20);
      rect(context, '#746d5c', x, y + roofHeight, w, h - roofHeight);
      rect(context, '#eee4bc', x + 4, y + roofHeight + 4, w - 8, h - roofHeight - 12);
      rect(context, '#d8cca3', x + w - 24, y + roofHeight + 4, 20, h - roofHeight - 12);
      for (let by = floor - 22; by < floor - 4; by += 8) {
        for (let bx = x + 4; bx < x + w - 4; bx += 16) {
          rect(context, '#b2a581', bx + 1, by, 14, 6);
        }
      }
      for (const bx of [x + 8, x + w - 16]) {
        rect(context, '#b0a381', bx, y + roofHeight + 8, 6, h - roofHeight - 32);
      }
      for (let row = 0; row < roofHeight; row += 4) {
        const inset = b.style === 'flat' ? 0 : Math.max(0, 28 - row / 2);
        rect(context, '#4d5350', x - 10 + inset, y + row + 6, w + 20 - inset * 2, 4);
        rect(context, b.color, x - 10 + inset, y + row, w + 20 - inset * 2, 4);
        if (row % 12 === 8) {
          rect(context, '#183a4938', x - 8 + inset, y + row, w + 16 - inset * 2, 2);
          for (let tx = x + inset + (row % 24 ? 0 : 10); tx < x + w - inset; tx += 20) {
            rect(context, '#ffffff24', tx, y + row - 6, 2, 6);
          }
        }
      }
      rect(context, '#ffffff38', x + 22, y, w - 44, 4);
      rect(context, '#e2d5a5', x - 8, y + roofHeight + 4, w + 16, 4);
      if (b.style !== 'flat' && b.style !== 'dome') {
        rect(context, '#666b62', x + w - 40, y - 12, 20, 32);
        rect(context, '#d2c8a9', x + w - 38, y - 14, 14, 30);
        rect(context, '#817c6c', x + w - 40, y - 16, 20, 6);
        rect(context, '#524f48', x + w - 36, y - 14, 12, 2);
      }
      if (b.style === 'gable' || b.style === 'hall') {
        const gable = b.style === 'hall' ? 32 : 24;
        for (let row = 0; row < gable; row += 4) {
          rect(context, '#ece5bf', center - row - 4, y + 8 + row, row * 2 + 8, 4);
          rect(context, '#d9e3ca', center - row, y + 8 + row, row * 2, 2);
        }
        rect(context, '#eae2bd', center - gable, y + 8 + gable, gable * 2, 20);
        windowPane(context, center - 8, y + 28, 16, 18);
      }
      if (b.style === 'dome') {
        blob(context, '#4c4a67', center, y + 12, 36, 28);
        blob(context, '#b79bd1', center - 2, y + 6, 30, 24);
        blob(context, '#ddc6eb', center - 8, y, 18, 14);
        rect(context, '#f7d888', center - 4, y - 28, 8, 12);
      }
      windowPane(context, x + 20, floor - 44, w < 150 ? 20 : 28);
      windowPane(context, x + w - (w < 150 ? 40 : 48), floor - 44, w < 150 ? 20 : 28);
      rect(context, '#726046', center - 20, floor - 42, 40, 40);
      rect(context, '#3f4e4b', center - 16, floor - 38, 32, 36);
      rect(context, '#79a7aa', center - 12, floor - 34, 24, 16);
      rect(context, '#b8ddd0', center - 10, floor - 32, 20, 4);
      rect(context, '#d5b674', center + 8, floor - 14, 4, 4);
      rect(context, '#847a61', center - 28, floor, 56, 6);
      rect(context, '#e4d7ae', center - 28, floor, 56, 2);
      if (b.style === 'market') {
        for (let i = 0; i < 8; i++) {
          rect(context, i % 2 ? '#efe7c0' : '#78a65d', x + 8 + i * (w - 16) / 8,
            floor - 78, (w - 16) / 8, 20);
        }
        rect(context, '#526d43', x + 6, floor - 60, w - 12, 4);
      }
      sign(context, b.label, center, y + roofHeight + 8, Math.min(w - 12, 156));
    }

    function landmark(context, b) {
      const { x, y, w, h, roofHeight, style } = b;
      const floor = y + h, center = x + w / 2, roofBottom = y + roofHeight;
      const edge = style === 'center' ? '#773f47' : '#455b79';
      rect(context, '#254f4938', x + 8, floor - 4, w + 12, 16);
      rect(context, '#617186', x, roofBottom - 4, w, h - roofHeight + 4);
      rect(context, '#e5edf2', x + 4, roofBottom, w - 8, h - roofHeight - 4);
      rect(context, '#bdcddb', x + w - 20, roofBottom, 16, h - roofHeight - 4);
      for (let py = roofBottom + 16; py < floor - 4; py += 16) {
        rect(context, '#a7b9ca', x + 4, py, w - 8, 2);
        rect(context, '#f3f5ed', x + 4, py + 2, w - 24, 2);
      }
      rect(context, '#f6f7ed', x + 6, roofBottom, 6, h - roofHeight - 8);
      for (let row = 0; row < roofHeight; row += 4) {
        const inset = Math.max(0, 20 - row);
        rect(context, edge, x - 8 + inset, y + row + 4, w + 16 - inset * 2, 4);
        rect(context, b.color, x - 6 + inset, y + row, w + 12 - inset * 2, 4);
        if (style === 'gym') {
          rect(context, '#d3bf77', x - 4 + inset, y + row, w + 8 - inset * 2, 2);
          for (let px = x + 8 + inset; px < x + w - inset; px += 12) {
            rect(context, '#8e814c', px, y + row, 2, 4);
          }
        } else if (style === 'shop') {
          for (let px = x + 8 + inset; px < x + w - inset - 8; px += 16) {
            rect(context, '#69bbdc', px, y + row, 10, 4);
            rect(context, '#3f699f', px + 10, y + row, 2, 4);
          }
        } else if (row % 12 === 8) {
          rect(context, '#ee9b7c', x - 2 + inset, y + row, w + 4 - inset * 2, 2);
          for (let px = x + 8 + inset; px < x + w - inset; px += 16) {
            rect(context, '#b84b4c', px, y + row - 6, 2, 6);
          }
        }
      }
      rect(context, edge, x - 8, roofBottom, w + 16, 8);
      rect(context, '#eff2e5', x - 4, roofBottom + 8, w + 8, 4);
      rect(context, '#ffffff38', x + 16, y + 2, w - 32, 4);
      const windowWidth = Math.floor((w - 96) / 2);
      for (const wx of [x + 16, x + w - windowWidth - 16]) {
        windowPane(context, wx, roofBottom + 20, windowWidth, 20);
      }
      rect(context, '#526276', center - 26, floor - 56, 52, 56);
      rect(context, '#9baec0', center - 22, floor - 52, 44, 52);
      rect(context, '#4178a3', center - 18, floor - 48, 36, 48);
      rect(context, '#79b9da', center - 14, floor - 44, 28, 38);
      rect(context, '#addbea', center - 12, floor - 42, 24, 6);
      rect(context, '#e1eaf0', center - 1, floor - 44, 2, 40);
      rect(context, '#d2dae0', center - 32, floor, 64, 6);
      rect(context, '#f4f3df', center - 32, floor, 64, 2);
      const crestY = floor - 76;
      rect(context, '#708499', center - 28, crestY, 56, 22);
      blob(context, '#708499', center, crestY, 28, 24);
      rect(context, '#e5edf2', center - 24, crestY, 48, 18);
      blob(context, '#e5edf2', center, crestY, 24, 20);
      const crestColor = style === 'center' ? '#d34f4d' : style === 'gym' ? '#b79e51' : '#578bc3';
      blob(context, crestColor, center, crestY, 18, 16);
      rect(context, '#edf4ee', center - 18, crestY - 2, 36, 4);
      blob(context, '#edf4ee', center, crestY, 8, 8);
      rect(context, crestColor, center - 4, crestY - 4, 8, 8);
      sign(context, b.label,
        style === 'shop' ? x + w - 38 : x + 38, floor - 26, 60);
    }

    function payphone(context, b) {
      const { x, y, w, h } = b;
      rect(context, '#254f4938', x + 4, y + h - 4, w + 8, 12);
      rect(context, '#879990', x, y + h - 4, w, 8);
      rect(context, '#d1d7bc', x + 2, y + h - 4, w - 4, 2);
      rect(context, '#516b70', x + 4, y + 8, w - 8, h - 12);
      rect(context, '#93aca7', x + 8, y + 10, w - 16, h - 16);
      rect(context, '#b9dbd24d', x + 4, y + 12, 10, h - 20);
      rect(context, '#b9dbd280', x + w - 12, y + 12, 8, h - 20);
      rect(context, '#daf0df', x + 4, y + 12, 2, h - 20);
      rect(context, '#3a5059', x + 16, y + 22, 20, 32);
      rect(context, '#c2cebc', x + 20, y + 24, 14, 28);
      rect(context, '#346d79', x + 22, y + 26, 10, 8);
      rect(context, '#90d8cc', x + 24, y + 28, 6, 4);
      for (let row = 0; row < 3; row++) {
        for (let column = 0; column < 3; column++) {
          rect(context, '#425c65', x + 22 + column * 4, y + 38 + row * 4, 2, 2);
        }
      }
      rect(context, '#243f4b', x + 12, y + 24, 6, 20);
      rect(context, '#243f4b', x + 12, y + 22, 10, 6);
      rect(context, '#243f4b', x + 12, y + 40, 10, 6);
      rect(context, '#b8c7bd', x, y + 6, 4, h - 6);
      rect(context, '#d7e3cf', x, y + 6, 2, h - 6);
      rect(context, '#4d6971', x + w - 4, y + 6, 4, h - 6);
      rect(context, '#8fa9a7', x + w - 4, y + 6, 2, h - 6);
      rect(context, '#87464b', x - 4, y, w + 8, 12);
      rect(context, '#cc514c', x - 2, y - 4, w + 4, 12);
      rect(context, '#e2856b', x + 2, y - 4, w - 4, 2);
      rect(context, '#fff3d4', x + 18, y - 2, 12, 4);
      rect(context, '#fff3d4', x + 16, y, 4, 6);
      rect(context, '#fff3d4', x + 28, y, 4, 6);
      sign(context, b.label, x + w / 2, y - 24, 64);
    }

    function board(context, b) {
      const { x, y, w, h } = b;
      for (const px of [x + 8, x + w - 16]) {
        rect(context, '#514f3b', px, y + 20, 8, h - 20);
        rect(context, '#b18b52', px, y + 20, 4, h - 22);
        rect(context, '#d7c18a', px - 4, y + h - 4, 16, 4);
      }
      rect(context, '#514535', x, y + 12, w, 52);
      rect(context, '#a47a46', x + 4, y + 16, w - 8, 44);
      rect(context, '#c19860', x + 8, y + 20, w - 16, 36);
      for (const [dx, dy] of [[16, 28], [44, 32], [76, 26]]) {
        rect(context, '#6b593e', x + dx + 2, y + dy + 2, 18, 22);
        rect(context, '#f7edc9', x + dx, y + dy, 18, 22);
        rect(context, '#b4ab86', x + dx + 4, y + dy + 6, 10, 2);
        rect(context, '#b4ab86', x + dx + 4, y + dy + 12, 8, 2);
        rect(context, '#a35b4c', x + dx + 8, y + dy, 3, 3);
      }
      rect(context, '#465c4b', x - 6, y + 4, w + 12, 8);
      rect(context, '#78a17a', x - 2, y, w + 4, 6);
      sign(context, b.label, x + w / 2, y - 20, 88);
    }

    function prop(context, p) {
      const { x, y } = p;
      if (p.kind === 'bench') {
        rect(context, '#254f4938', x, y + 8, 60, 8);
        for (const dx of [4, 46]) rect(context, '#4d5a50', x + dx, y - 12, 6, 24);
        for (const dy of [-16, -8, 2]) {
          rect(context, '#7e6247', x, y + dy, 56, 6);
          rect(context, '#c49b62', x, y + dy, 56, 2);
        }
      } else {
        rect(context, '#71796b', x - 4, y + 6, 16, 6);
        rect(context, '#434f4d', x, y - 46, 8, 54);
        rect(context, '#b5bc9b', x + 2, y - 44, 2, 50);
        rect(context, '#3e5350', x - 6, y - 60, 20, 16);
        rect(context, '#f1dda0', x - 2, y - 58, 12, 12);
        rect(context, '#fff0bd', x, y - 56, 4, 8);
        rect(context, '#617a69', x - 8, y - 64, 24, 4);
        rect(context, '#617a69', x - 4, y - 68, 16, 4);
      }
    }

    function cacheLayer(bounds, depth, paint, shared) {
      // Position-independent art (trees, lamps, benches) is painted once and reused at every copy.
      const key = shared && shared + ':' + bounds.w + 'x' + bounds.h;
      let image = key && sharedArt.get(key);
      if (!image) {
        image = doc.createElement('canvas');
        image.width = bounds.w;
        image.height = bounds.h;
        const brush = image.getContext('2d', CACHED_ART);
        brush.translate(-bounds.x, -bounds.y);
        paint(brush);
        if (key) sharedArt.set(key, image);
      }
      layers.push({ ...bounds, depth, image });
    }

    function makeScenery() {
      scenery = doc.createElement('canvas');
      scenery.width = WIDTH;
      scenery.height = HEIGHT;
      layers = [];
      sharedArt = new Map();
      const brush = scenery.getContext('2d', CACHED_ART);
      rect(brush, '#8cbd78', 0, 0, WIDTH, HEIGHT);
      for (let y = 0; y < HEIGHT; y += 8) {
        for (let x = 0; x < WIDTH; x += 8) {
          const n = (x * 31 + y * 17 + (x * y) % 127) % 101;
          if (n < 22) rect(brush, n < 8 ? '#a0ca83' : '#7fb372', x, y, 4, 2);
          if (n === 36) {
            rect(brush, '#5c9e64', x, y, 2, 4);
            rect(brush, '#6caa68', x + 2, y + 2, 2, 4);
          }
        }
      }
      for (const p of PATHS) rect(brush, '#adab72', p.x - 4, p.y - 4, p.w + 8, p.h + 8);
      for (const p of PATHS) rect(brush, '#ebd59b', p.x, p.y, p.w, p.h);
      for (let y = 8; y < HEIGHT; y += 8) {
        for (let x = 8; x < WIDTH; x += 8) {
          if (!PATHS.some(p => x > p.x + 2 && x < p.x + p.w - 6 && y > p.y + 2 && y < p.y + p.h - 6)) continue;
          const n = (x * 7 + y * 13 + x * y % 97) % 59;
          if (n < 9) rect(brush, n < 4 ? '#d2bb82' : '#f5e2ac', x, y, n < 4 ? 2 : 4, 2);
        }
      }
      const { x, y, w, h } = PLAZA;
      rect(brush, '#939d7f', x, y, w, h);
      rect(brush, '#b8bca0', x + 4, y + 4, w - 8, h - 8);
      for (let row = 0; row < (h - 16) / 16; row++) {
        for (let px = x + 8 - (row % 2) * 16; px < x + w - 8; px += 32) {
          const left = Math.max(px, x + 8), right = Math.min(px + 32, x + w - 8);
          rect(brush, row % 2 ? '#d6d4b8' : '#e1ddc2', left + 1, y + 9 + row * 16, right - left - 2, 14);
        }
      }
      for (const p of POND) rect(brush, '#b9b486', p.x - 12, p.y - 12, p.w + 24, p.h + 24);
      for (const p of POND) rect(brush, '#eee1af', p.x - 6, p.y - 6, p.w + 12, p.h + 12);
      for (const p of POND) rect(brush, '#397b99', p.x, p.y, p.w, p.h);
      const insidePond = (px, py, inset) => [[-inset, 0], [inset, 0], [0, -inset], [0, inset]].every(([dx, dy]) =>
        POND.some(p => px + dx >= p.x && px + dx < p.x + p.w && py + dy >= p.y && py + dy < p.y + p.h));
      for (let py = 488; py < 640; py += 4) {
        for (let px = 852; px < 1072; px += 4) {
          if (insidePond(px, py, 8)) rect(brush, '#57a7b9', px, py, 4, 4);
        }
      }
      for (let py = 496; py < 632; py += 16) {
        for (let px = 860; px < 1064; px += 24) {
          if (insidePond(px, py, 16)) {
            rect(brush, '#9ad9d1', px + py % 12, py, 12, 2);
          }
        }
      }
      for (const [px, py] of [[900, 520], [1012, 576], [940, 608]]) {
        blob(brush, '#3f8061', px, py + 2, 12, 6);
        blob(brush, '#88b866', px, py, 10, 6);
        rect(brush, '#d6eb9a', px - 6, py - 2, 6, 2);
        rect(brush, '#edb9c9', px + 2, py - 6, 4, 4);
      }
      blob(brush, '#397b99', 954, 556, 16, 12);
      blob(brush, '#eee1af', 952, 552, 12, 12);
      blob(brush, '#a2ad7b', 952, 548, 8, 8);
      for (const [px, py, count] of [[144, 368, 6], [760, 360, 4], [304, 640, 5],
        [752, 432, 3], [968, 448, 5], [1128, 656, 3], [400, 920, 6]]) {
        for (let i = 0; i < count; i++) {
          const fx = px + i * 12, fy = py + i % 2 * 8;
          rect(brush, '#4b8c5c', fx, fy + 2, 2, 8);
          rect(brush, '#5b9e63', fx - 2, fy + 6, 6, 2);
          rect(brush, i % 3 ? '#fff1cc' : '#e6a5a1', fx - 2, fy, 6, 4);
          rect(brush, '#e2be69', fx, fy, 2, 2);
        }
      }
      for (const b of BUILDINGS) {
        cacheLayer({ x: b.x - 16, y: b.y - 32, w: b.w + 48, h: b.h + 56 }, b.y + b.h,
          context => building(context, b));
      }
      const notice = DESTINATIONS.find(d => d.kind === 'board');
      cacheLayer({ x: notice.x - 8, y: notice.y - 24, w: notice.w + 16, h: notice.h + 32 },
        notice.y + notice.h, context => board(context, notice));
      const phone = DESTINATIONS.find(d => d.kind === 'phone');
      cacheLayer({ x: phone.x - 8, y: phone.y - 24, w: phone.w + 16, h: phone.h + 32 },
        phone.y + phone.h, context => payphone(context, phone));
      const forest = [...TREES];
      for (let py = 40; py <= 136; py += 48) {
        for (let px = 16; px < WIDTH + 32; px += 48) {
          if (px > 548 && px < 732) continue;
          forest.push({ x: px + (py === 88 ? 16 : 0), y: py });
        }
      }
      for (let py = 184; py <= HEIGHT; py += 48) {
        for (const px of [24, 72, WIDTH - 72, WIDTH - 24]) forest.push({ x: px, y: py });
      }
      for (let px = 120; px < WIDTH - 96; px += 48) {
        forest.push({ x: px, y: HEIGHT - 40 }, { x: px + 16, y: HEIGHT + 8 });
      }
      for (const t of forest) {
        cacheLayer({ x: t.x - 48, y: t.y - 84, w: 104, h: 116 }, t.y + 16,
          context => tree(context, t.x, t.y), 'tree');
      }
      for (const p of PROPS) {
        cacheLayer({ x: p.x - 12, y: p.y - 72, w: 84, h: 96 }, p.y + 12,
          context => prop(context, p), 'prop:' + p.kind);
      }
      cacheLayer({ x: 696, y: 112, w: 180, h: 60 }, 168, context => {
        rect(context, '#675f43', 708, 128, 8, 40);
        sign(context, 'Ruta de expediciones', 780, 116, 160);
        rect(context, '#537458', 702, 146, 20, 4);
        rect(context, '#537458', 710, 138, 4, 12);
      });
      for (const px of [624, 640, 656]) {
        rect(brush, '#bfaa75', px - 2, 184, 4, 4);
        rect(brush, '#bfaa75', px - 6, 188, 12, 4);
      }
      layers.sort((a, b) => a.depth - b.depth);
    }

    function resize() {
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const pixelRatio = Math.min(host.devicePixelRatio || 1, 2);
      canvas.width = Math.round(bounds.width * pixelRatio);
      canvas.height = Math.round(bounds.height * pixelRatio);
      scale = fitScale(bounds.width, bounds.height);
      viewWidth = bounds.width / scale;
      viewHeight = bounds.height / scale;
      draw();
    }

    function draw() {
      if (!scenery || !avatar || !viewWidth) return;
      stale = false;
      const left = viewWidth > WIDTH ? (WIDTH - viewWidth) / 2 :
        clamp(position.x - viewWidth / 2, 0, WIDTH - viewWidth);
      const top = viewHeight > HEIGHT ? (HEIGHT - viewHeight) / 2 :
        clamp(position.y - viewHeight / 2, 0, HEIGHT - viewHeight);
      const zoom = canvas.width / viewWidth;
      ctx.setTransform(zoom, 0, 0, zoom, -Math.round(left * zoom), -Math.round(top * zoom));
      ctx.imageSmoothingEnabled = false;
      rect(ctx, '#315749', left, top, viewWidth, viewHeight);
      ctx.drawImage(scenery, 0, 0);
      const door = nearby(position);
      if (door) {
        rect(ctx, '#fff0ac', door.door.x - 20, door.door.y + 8, 40, 4);
        ctx.strokeStyle = '#fff0ac';
        ctx.lineWidth = 2;
        if (door.kind === 'route') ctx.strokeRect(door.x + 4, door.y + 32, door.w - 8, door.h);
      }
      const me = partyState.members.find(m => m.uid === game.Social.uid);
      const actors = [
        { x: position.x, y: position.y, sprite: avatar, name: me?.name,
          color: game.Coop.COLORS[partyState.members.indexOf(me)] },
        ...remoteAvatars.values()
      ].sort((a, b) => a.y - b.y);
      const drawAvatar = actor => {
        ctx.fillStyle = '#203e4055';
        ctx.beginPath();
        ctx.ellipse(actor.x, actor.y + 2, 15, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        actor.sprite.draw(ctx, Math.round(actor.x), Math.round(actor.y));
        if (actor.name) {
          ctx.font = 'bold 12px Pixelify, sans-serif';
          ctx.textAlign = 'center';
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#163c3b';
          ctx.strokeText(actor.name, Math.round(actor.x), Math.round(actor.y) - 28);
          ctx.fillStyle = actor.color;
          ctx.fillText(actor.name, Math.round(actor.x), Math.round(actor.y) - 28);
        }
      };
      let actorIndex = 0;
      for (const layer of layers) {
        while (actorIndex < actors.length && layer.depth > actors[actorIndex].y) drawAvatar(actors[actorIndex++]);
        if (layer.x + layer.w < left || layer.x > left + viewWidth ||
            layer.y + layer.h < top || layer.y > top + viewHeight) continue;
        ctx.drawImage(layer.image, layer.x, layer.y);
      }
      while (actorIndex < actors.length) drawAvatar(actors[actorIndex++]);
      if (currentDoor !== door) {
        currentDoor = door;
        if (door) $('town-action').classList.remove('hidden');
        else $('town-action').classList.add('hidden');
        $('town-interact').disabled = !door;
        $('town-interact').textContent = !door ? '' : text(
          door.kind === 'board' ? 'Leer tabla' : door.kind === 'phone' ? 'Llamar' :
            door.kind === 'route' ? 'Salir de expedici\u00f3n' : 'Entrar');
        $('town-nearby').textContent = door ? text(door.label) : '';
      }
    }

    // Everything tick() animates. Other visual changes mark the scene stale instead.
    function sceneKey() {
      let key = position.x + ',' + position.y + ',' + avatar.cur + ',' + avatar.frame + ',' + avatar.dir;
      for (const remote of remoteAvatars.values()) {
        const sprite = remote.sprite;
        key += '|' + remote.x + ',' + remote.y + ',' + sprite.cur + ',' + sprite.frame + ',' + sprite.dir;
      }
      return key;
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
      walking = next.x !== position.x || next.y !== position.y;
      if (walking) avatar.dir = direction(x, y);
      avatar.loop(walking ? 'Walk' : 'Idle');
      avatar.update(Math.min(elapsed, 0.1));
      position = next;
      for (const remote of remoteAvatars.values()) {
        const blend = Math.min(1, Math.max(0, elapsed) * 12);
        let x = remote.x + (remote.target.x - remote.x) * blend;
        let y = remote.y + (remote.target.y - remote.y) * blend;
        // Settle on the target instead of creeping by sub-pixel steps, so an idle town can stop repainting.
        if (Math.abs(remote.target.x - x) < 0.5 && Math.abs(remote.target.y - y) < 0.5) {
          x = remote.target.x;
          y = remote.target.y;
        }
        if (walkable(x, y)) { remote.x = x; remote.y = y; }
        else { remote.x = remote.target.x; remote.y = remote.target.y; }
        remote.sprite.update(Math.min(elapsed, 0.1));
      }
      ticking = true;
      try {
        // active() has just confirmed that no other screen covers the town.
        publishPresence(false);
      } finally {
        ticking = false;
      }
      const key = sceneKey();
      if (stale || key !== scene || now - paintedAt >= IDLE_REPAINT) {
        draw();
        scene = key;
        paintedAt = now;
      }
      frame = host.requestAnimationFrame(tick);
    }

    function synchronize() {
      publishPresence();
      refreshPartyUI();
      const running = active();
      screen.inert = !running;
      if (!running) return stop();
      if (frame === null) {
        last = null;
        stale = true;
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

    function openParty() {
      if (!game.Social.room || partyState.launching) return;
      arrivalRoom = game.Social.room;
      shortcut = false;
      game.LobbyUI.open();
    }

    function enter() {
      if (!active()) return;
      const door = nearby(position);
      if (!door) return;
      stop();
      shortcut = false;
      if (door.id === 'play' && game.Social.room) openParty();
      else actions.get(door.id).click();
      synchronize();
    }

    const originalShow = game.UI.show;
    game.UI.show = function (id, ...args) {
      if (partyState.launching && id !== 'scr-lobby') return;
      if (id !== 'scr-lobby') multiplayer.setReadyMenuOpen(false);
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
      const result = originalHideAll.apply(this, args);
      publishPresence();
      return result;
    };
    const originalHide = game.UI.hide;
    game.UI.hide = function (...args) {
      if (partyState.launching && args[0] === 'scr-lobby') return;
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
    const originalAfterRun = game.Flow.afterRun;
    game.Flow.afterRun = function (...args) {
      const result = originalAfterRun.apply(this, args);
      if (game.Social.room && game.Game.state === 'ui') returnToTown();
      return result;
    };
    const originalStartCoop = game.Flow.startCoop;
    game.Flow.startCoop = function (message, ...args) {
      if (!multiplayer.acceptStart(message)) {
        game.UI.toast(text('Todos los jugadores deben estar conectados y preparados.'), 3500);
        return;
      }
      shortcut = false;
      return originalStartCoop.call(this, message, ...args);
    };
    const originalBroadcast = game.Net.broadcast;
    game.Net.broadcast = function (message, ...args) {
      if (message?.k === 'start') {
        const proof = multiplayer.getLaunchToken();
        if (!proof) return;
        message.townLaunch = proof;
      }
      return originalBroadcast.call(this, message, ...args);
    };
    const originalLobbyOpen = game.LobbyUI.open;
    game.LobbyUI.open = function (...args) {
      const arrival = game.Social.room && arrivalRoom !== game.Social.room;
      arrivalRoom = game.Social.room;
      const result = originalLobbyOpen.apply(this, args);
      if (arrival) returnToTown();
      synchronize();
      return result;
    };
    const originalLobbyInit = game.LobbyUI.init;
    game.LobbyUI.init = function (...args) {
      const result = originalLobbyInit.apply(this, args);
      const start = $('lobby-start').onclick;
      $('lobby-start').onclick = () => multiplayer.requestStart(() => start.call($('lobby-start')));
      $('lobby-menu').onclick = returnToTown;
      $('lobby-ready').onclick = () => multiplayer.setReady(!partyState.ready);
      setText($('lobby-menu'), text('Volver al pueblo'));
      lobbyInitialized = true;
      game.Social.on(refreshPartyUI);
      refreshPartyUI();
      return result;
    };
    const originalInit = game.MenuUI.init;
    game.MenuUI.init = function (...args) {
      originalInit.apply(this, args);
      for (const b of DESTINATIONS) {
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
      $('town-party').onclick = openParty;
      setText($('town-party'), text('Preparar grupo'));
      $('town-interact').onclick = enter;
      $('menu-town').textContent = text('Volver al pueblo');
      $('menu-town').onclick = returnToTown;
      makeScenery();
      initialized = true;
      refreshPartyUI();
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
      else { publishPresence(); refreshPartyUI(); }
    });
    observer.observe(doc.body, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
    game.DB.onSync(() => {
      syncAccount();
      synchronize();
    });
    multiplayer.subscribe(state => {
      partyState = state;
      updateRemoteAvatars(state);
      refreshPartyUI();
      if (!initialized || !visible(screen)) return;
      // A running loop repaints on its next frame; drawing here too would paint twice.
      if (ticking || frame !== null) stale = true;
      else draw();
    });
    game.Town = { open: returnToTown, openParty, multiplayer };
    return game.Town;
  }

  const api = { WIDTH, HEIGHT, RADIUS, SPEED, IDLE_REPAINT, SPAWN, BUILDINGS, DESTINATIONS, PLAZA, POND, PATHS, PROPS,
    SOLIDS, walkable, move, nearby, direction, fitScale, install };
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
