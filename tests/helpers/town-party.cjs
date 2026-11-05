const assert = require('node:assert/strict');
const fs = require('node:fs');

function party(count = 4) {
  const path = require('node:path').join(__dirname, '..', '..', 'js', 'town-multiplayer.js');
  assert(fs.existsSync(path), 'The shared-town controller must exist');
  const { create } = require(path);
  const clients = [], queue = [], sent = [], timers = new Map(), blocked = new Set();
  let now = 0, timerId = 0, nonce = 0;
  const roster = Array.from({ length: count }, (_, i) => ({ uid: 'p' + i, name: 'Player ' + i, dex: 25, shiny: false }));
  function send(from, to, packet) {
    const entry = { from, to, packet: structuredClone(packet) };
    sent.push(entry);
    if (!blocked.has(from) && !blocked.has(to)) queue.push(entry);
  }
  for (let i = 0; i < count; i++) {
    const uid = 'p' + i, social = new Set(), network = new Set(), peers = new Set(), warnings = [], notices = [];
    const game = {
      DB: { fb: { uid }, save: { partner: 25, coins: i * 100, owned: { 25: {} } } },
      DEX_BY: { 25: { name: 'Pikachu' }, 4: { name: 'Charmander' } },
      Skins: { get: (id, dex) => id === 'hat' && dex === 25 ? {} : null },
      Game: { state: 'ui' }, Coop: { active: false },
      T: value => value, UI: { toast: message => notices.push(message) },
      Social: {
        uid, room: { id: 'room', host: 'p0', isHost: i === 0, members: structuredClone(roster), lost: false },
        on: fn => social.add(fn), off: fn => social.delete(fn)
      },
      Net: {
        mode: peer => blocked.has(uid) || blocked.has(peer) ? 'failed' : 'direct',
        busy: () => false,
        on: fn => network.add(fn), off: fn => network.delete(fn),
        onPeer: fn => peers.add(fn),
        send: (peer, packet) => send(uid, peer, packet),
        toHost: packet => send(uid, 'p0', packet),
        broadcast: packet => roster.filter(m => m.uid !== uid).forEach(m => send(uid, m.uid, packet))
      }
    };
    const host = {
      performance: { now: () => now }, crypto: { randomUUID: () => 'nonce-' + ++nonce },
      console: { warn: (...args) => warnings.push(args) },
      setInterval(fn, interval) { timers.set(++timerId, { fn, interval, next: now + interval }); return timerId; },
      clearInterval: id => timers.delete(id)
    };
    const controller = create(game, host, { walkable: (x, y) => x >= 100 && x <= 1100 && y >= 100 && y <= 900 });
    const client = { uid, game, host, controller, social, network, peers, warnings, notices };
    clients.push(client);
    controller.updateLocal({ x: 600 + i * 20, y: 568, dir: 0, walking: false, dex: 25, shiny: false, skin: null, location: 'town' });
  }
  function flush(filter = () => true) {
    let deliveries = 0;
    while (queue.some(filter)) {
      assert(deliveries++ < 2000, 'Network must settle without a message loop');
      const index = queue.findIndex(filter), entry = queue.splice(index, 1)[0];
      const target = clients.find(c => c.uid === entry.to);
      if (target && !blocked.has(entry.from) && !blocked.has(entry.to)) {
        for (const receive of target.network) receive(entry.from, structuredClone(entry.packet));
      }
    }
  }
  function advance(ms = 100, filter = () => true) {
    const end = now + ms;
    while ([...timers.values()].some(t => t.next <= end)) {
      now = Math.min(...[...timers.values()].map(t => t.next));
      for (const [id, timer] of [...timers]) {
        if (timers.has(id) && timer.next <= now) { timer.next += timer.interval; timer.fn(); }
      }
      flush(filter);
    }
    now = end;
    flush(filter);
  }
  function readyAll() {
    advance(300);
    for (const c of clients) {
      c.controller.setReadyMenuOpen(true);
      c.controller.setReady(true);
      flush();
    }
    advance(100);
  }
  function membership(members) {
    for (const c of clients) {
      c.game.Social.room.members = structuredClone(members);
      for (const onChange of c.social) onChange('room');
    }
    advance(200);
  }
  advance(400);
  return { clients, queue, sent, timers, blocked, roster, flush, advance, readyAll, membership,
    deliver(to, from, packet) { for (const receive of clients[to].network) receive(from, structuredClone(packet)); } };
}

module.exports = { party };
