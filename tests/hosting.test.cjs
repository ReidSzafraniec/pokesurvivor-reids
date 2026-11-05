const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function runtime(config, hostname = 'friends-game.web.app') {
  const context = {
    module: { exports: {} }, console, URL,
    location: { hostname, protocol: 'https:' }
  };
  vm.runInNewContext(read('js\\hosting.js'), context);
  return context.module.exports.create(config, context.location);
}

const config = {
  apiKey: 'test-key', projectId: 'friends-game',
  authDomain: 'friends-game.firebaseapp.com', appId: 'test-app',
  databaseURL: 'https://friends-game-default-rtdb.firebaseio.com'
};

test('hosting accepts only the configured project and its exact deployment hosts', () => {
  const hosting = runtime(config);
  assert.equal(hosting.firebase.projectId, 'friends-game');
  assert.equal(hosting.error, '');
  assert.equal(runtime(config, 'localhost').error, '');
  assert.match(runtime(config, 'friends-game.web.app.attacker.test').error, /host/i);
  assert.match(runtime({ ...config, projectId: 'pokesurvivor-free' }).error, /original/i);
  assert.match(runtime({ ...config, databaseURL: 'https://other.firebaseio.com' }).error, /database/i);
});

test('missing configuration produces an explicit setup error without a cloud fallback', () => {
  const hosting = runtime(null);
  assert.equal(hosting.firebase, null);
  assert.match(hosting.error, /Firebase.*config/i);
});

test('both language pages load configuration and runtime before the engine', () => {
  for (const file of ['index.html', 'en\\index.html']) {
    const page = read(file);
    const engine = page.indexOf('src="js/app.min.js');
    assert(page.indexOf('src="js/hosting-config.js') > 0);
    assert(page.indexOf('src="js/hosting-config.js') < page.indexOf('src="js/hosting.js'));
    assert(page.indexOf('src="js/hosting.js') < engine);
  }
});

test('engine uses the hosting configuration and never initializes the original services', () => {
  const source = read('js\\app.min.js');
  assert(source.includes("_0x599208['FIREBASE_CONFIG']=window.PSHosting.firebase"));
  assert(source.includes('window.PSHosting.install(_0x599208)'));
  assert(!source.includes('pokesurvivor-free'));
  assert(!source.includes('ice.pokesurvivor.com'));
  assert(!source.includes("localStorage['getItem']('ps.rooms')"));
  assert(!source.includes("localStorage['getItem']('ps.rank')"));
});

function netFixture(rtc) {
  const source = read('js\\app.min.js');
  const context = {
    console, TextEncoder, TextDecoder, URL, AbortController,
    setTimeout, clearTimeout, RTCPeerConnection: rtc,
    localStorage: { getItem: () => 'vps' }, fetch() { throw new Error('Unexpected fetch'); }
  };
  vm.createContext(context);
  vm.runInContext(source.slice(0, source.indexOf('const a0_0xc9496a=')) +
    source.slice(source.lastIndexOf('function a0_0x48f4()')), context, { timeout: 3000 });
  const writes = [], listeners = new Map(), cancelled = new Map(), notices = [];
  const database = {
    ref(key) {
      return {
        set(value) { writes.push([key, value]); return Promise.resolve(); },
        on(event, handler, onCancelled) { listeners.set(key, handler); cancelled.set(key, onCancelled); },
        off() { listeners.delete(key); cancelled.delete(key); }
      };
    }
  };
  context._0x48be02 = context.a0_0x422d;
  context._0x599208 = {
    DB: { fb: { uid: 'host', rtdb: database, auth: { currentUser: { uid: 'host' } } } },
    RoomsWS: { on: false }
  };
  const start = source.indexOf("_0x599208['Net']=");
  const end = source.indexOf(",_0x599208['Coop']=", start);
  vm.runInContext(source.slice(start, end), context, { timeout: 3000 });
  const net = context._0x599208.Net;
  net.onPeer((uid, mode) => notices.push([uid, mode]));
  return { net, writes, listeners, cancelled, notices };
}

test('failed WebRTC sends gameplay and start messages through the Firebase inbox', async t => {
  const { net, writes, listeners } = netFixture(class { constructor() { throw new Error('No RTC'); } });
  t.after(() => net.close());
  net.open('host', true, 'host');
  net.syncMembers(['host', 'guest']);
  await Promise.resolve();
  assert.equal(net.mode('guest'), 'relay');
  net.send('guest', { k: 'f', x: 7 });
  net.send('guest', { k: 'start' });
  assert.equal(writes.length, 2);
  assert.equal(writes[0][0], 'rooms/host/q/guest/host_00');
  assert.deepEqual(JSON.parse(writes[0][1]), { f: 'host', d: { k: 'f', x: 7 } });
  const received = [];
  net.on((uid, value) => received.push([uid, value.k]));
  listeners.get('rooms/host/q/host')({
    key: 'guest_00',
    val: () => JSON.stringify({ f: 'guest', d: { k: 'f' } }),
    ref: { remove: () => Promise.resolve() }
  });
  assert.deepEqual(received, [['guest', 'f']]);
  listeners.get('rooms/host/q/host')({
    key: 'guest_01', val: () => '{"f":"guest","d":{"k":"start"},"f":"host"}',
    ref: { remove: () => Promise.resolve() }
  });
  assert.deepEqual(received, [['guest', 'f']], 'The inbox key, not client JSON, authenticates the sender');
  net.close();
});

test('failed direct connection changes to relay without dropping the peer', async t => {
  let connection;
  class RTC {
    constructor() { connection = this; }
    createDataChannel() { return { send() {}, close() {} }; }
    async createOffer() { return {}; }
    async setLocalDescription() { this.localDescription = { toJSON: () => ({}) }; }
    close() {}
  }
  const { net, notices } = netFixture(RTC);
  t.after(() => net.close());
  net.open('host', true, 'host');
  net.syncMembers(['host', 'guest']);
  await Promise.resolve();
  await Promise.resolve();
  connection.connectionState = 'failed';
  connection.onconnectionstatechange();
  assert.equal(net.mode('guest'), 'relay');
  assert(!notices.some(([, mode]) => mode === 'failed' || mode === 'closed'));
  net.close();
});

test('a guest restores its relay peer when the host reappears without sending an RTC offer', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { net, writes } = netFixture(class { constructor() { throw new Error('No RTC'); } });
  t.after(() => net.close());
  net.open('owner', false, 'owner');
  net.syncMembers([]);
  net.syncMembers(['owner', 'host']);
  t.mock.timers.tick(27000);
  assert.equal(net.mode('owner'), 'relay');
  net.toHost({ k: 'f', x: 9 });
  assert.deepEqual(JSON.parse(writes[0][1]), { f: 'host', d: { k: 'f', x: 9 } });
});

test('a guest reopens a revoked inbox after its room membership reconnects', t => {
  const { net, listeners, cancelled } = netFixture(class { constructor() { throw new Error('No RTC'); } });
  t.after(() => net.close());
  net.open('owner', false, 'owner');
  const inbox = 'rooms/owner/q/host';
  assert.equal(typeof cancelled.get(inbox), 'function');
  cancelled.get(inbox)(new Error('permission_denied'));
  assert.equal(net.open_, false);
  net.open('owner', false, 'owner');
  const received = [];
  net.on((uid, value) => received.push([uid, value.k]));
  listeners.get(inbox)({
    key: 'owner_00',
    val: () => JSON.stringify({ f: 'owner', d: { k: 'start' } }),
    ref: { remove: () => Promise.resolve() }
  });
  assert.deepEqual(received, [['owner', 'start']]);
});

test('staging allowlists public assets, keeps credits, and removes stale output', t => {
  const { stage } = require('../tools/stage-hosting.cjs');
  const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ps-hosting-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const folder of ['js', 'assets', 'en', 'tests', '.git']) fs.mkdirSync(path.join(dir, folder));
  fs.writeFileSync(path.join(dir, 'js', 'hosting-config.js'), 'window.PS_FIREBASE_CONFIG = ' + JSON.stringify(config));
  for (const file of ['index.html', 'en\\index.html', 'assets\\sprite.png', 'CREDITS.md', 'LICENSE',
    'CNAME', 'tests\\secret.txt', '.git\\config', 'database.rules.json']) {
    fs.writeFileSync(path.join(dir, file), 'test');
  }
  stage(dir);
  assert(fs.existsSync(path.join(dir, 'dist', 'assets', 'sprite.png')));
  assert(fs.existsSync(path.join(dir, 'dist', 'en', 'index.html')));
  assert(fs.existsSync(path.join(dir, 'dist', 'CREDITS.md')));
  assert(fs.existsSync(path.join(dir, 'dist', 'LICENSE')));
  for (const file of ['CNAME', 'tests', '.git', 'database.rules.json']) assert(!fs.existsSync(path.join(dir, 'dist', file)));
  fs.unlinkSync(path.join(dir, 'assets', 'sprite.png'));
  stage(dir);
  assert(!fs.existsSync(path.join(dir, 'dist', 'assets', 'sprite.png')));
});

test('staging refuses incomplete Firebase setup before publishing', () => {
  const { validateConfig } = require('../tools/stage-hosting.cjs');
  assert.throws(() => validateConfig('window.PS_FIREBASE_CONFIG = null'), /configuration/);
});

test('joining reserves a bounded seat, schedules member removal, and cleans departed lobby seats', async () => {
  const hosting = runtime(config);
  const values = { 'rooms/host/slots/0': 'host' }, cleanups = [], events = [];
  const db = {
    ref(key) {
      return {
        async get() {
          return { exists: () => values[key] != null, val: () => key.endsWith('/slots')
            ? Object.fromEntries(Object.entries(values).filter(([child, value]) => child.startsWith(key + '/') && value !== null).map(([child, value]) => [child.slice(key.length + 1), value]))
            : values[key] || null };
        },
        async transaction(update) {
          events.push('reservation');
          const value = update(values[key] || null);
          if (value === undefined) return { committed: false };
          values[key] = value;
          return { committed: true };
        },
        async update(patch) {
          events.push(Object.keys(patch).sort());
          for (const [child, value] of Object.entries(patch)) values[key + '/' + child] = value;
        },
        async set(value) { values[key] = value; },
        async remove() { values[key] = null; },
        onDisconnect() { return { async remove() { cleanups.push(key); events.push('disconnect'); }, async cancel() {} }; }
      };
    }
  };
  await hosting.joinRoom(db, 'host', 'guest', { name: 'Guest' });
  assert.equal(values['rooms/host/slots/1'], 'guest');
  assert.equal(cleanups[0], 'rooms/host/m/guest');
  assert.deepEqual(events.slice(0, 2), ['disconnect', ['m/guest', 'slots/1']]);
  assert.equal(values['rooms/host/m/guest'].name, 'Guest');
  values['rooms/host/slots/2'] = 'third';
  values['rooms/host/slots/3'] = 'fourth';
  await assert.rejects(() => hosting.joinRoom(db, 'host', 'fifth', {}), /full/i);
  await hosting.releaseSeat(db, 'host', 'guest');
  assert.equal(values['rooms/host/slots/1'], null);
  assert.equal(values['rooms/host/m/guest'], null);
  values['rooms/host/slots/1'] = 'guest';
  values['rooms/host/m/guest'] = { name: 'Guest' };
  await hosting.releaseDepartedSeats(db, 'host', [{ uid: 'guest' }], {});
  assert.equal(values['rooms/host/slots/1'], 'guest', 'A returning member keeps their seat');
  values['rooms/host/m/guest'] = null;
  await hosting.releaseDepartedSeats(db, 'host', [{ uid: 'guest' }], {});
  assert.equal(values['rooms/host/slots/1'], null);
  assert(read('js\\app.min.js').includes('window.PSHosting.releaseDepartedSeats('));
});
