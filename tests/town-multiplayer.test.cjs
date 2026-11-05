const test = require('node:test');
const assert = require('node:assert/strict');
const { party } = require('./helpers/town-party.cjs');

test('four isolated clients receive every town avatar through the host', () => {
  const f = party(), before = f.clients.map(c => JSON.stringify(c.game.DB.save));
  for (const c of f.clients) {
    const state = c.controller.getSnapshot();
    assert.equal(state.members.length, 4);
    assert(state.members.every(m => m.connected && m.pose));
    assert.deepEqual(state.members.map(m => m.pose.x), [600, 620, 640, 660]);
  }
  const c = f.clients[2];
  c.controller.updateLocal({ ...c.controller.getSnapshot().members[2].pose, x: 700, walking: true });
  f.advance(200);
  for (const peer of f.clients) assert.equal(peer.controller.getSnapshot().members[2].pose.x, 700);
  assert.deepEqual(f.clients.map(c => JSON.stringify(c.game.DB.save)), before);
  assert(!f.sent.some(e => e.from !== 'p0' && e.to !== 'p0'), 'Guests never need guest-to-guest links');
});

test('host menu presence does not pause networking or reveal private save data', () => {
  const f = party(), host = f.clients[0];
  host.controller.updateLocal({ ...host.controller.getSnapshot().members[0].pose, location: 'menu', walking: false });
  f.clients[1].controller.updateLocal({ ...f.clients[1].controller.getSnapshot().members[1].pose, x: 820, walking: true, coins: 99999 });
  f.advance(300);
  assert.equal(f.clients[3].controller.getSnapshot().members[1].pose.x, 820);
  assert.equal(f.clients[3].controller.getSnapshot().members[0].pose.location, 'menu');
  assert(!JSON.stringify(f.sent).includes('coins'));
  assert(!JSON.stringify(f.sent).includes('owned'));
});

test('movement is coalesced and idle peers remain present using heartbeats', () => {
  const f = party(), c = f.clients[1];
  f.sent.length = 0;
  for (let i = 0; i < 100; i++) c.controller.updateLocal({ ...c.controller.getSnapshot().members[1].pose, x: 650 + i });
  f.advance(100);
  assert(f.sent.filter(e => e.from === 'p1' && e.packet.k === 'town-pose').length <= 1);
  assert.equal(f.clients[0].controller.getSnapshot().members[1].pose.x, 749);
  f.advance(100);
  assert.equal(f.clients[2].controller.getSnapshot().members[1].pose.x, 749);
  f.advance(12000);
  assert(f.clients.every(c => c.controller.getSnapshot().members.every(m => m.connected)));
});

test('backpressure retains only the latest pose', () => {
  const f = party(), c = f.clients[1];
  c.game.Net.busy = () => true;
  for (const x of [700, 710, 720]) c.controller.updateLocal({ ...c.controller.getSnapshot().members[1].pose, x });
  f.advance(300);
  assert.equal(f.clients[0].controller.getSnapshot().members[1].pose.x, 620);
  c.game.Net.busy = () => false;
  f.advance(200);
  assert.equal(f.clients[3].controller.getSnapshot().members[1].pose.x, 720);
});

test('unready state is retried after backpressure even while the ready menu stays open', () => {
  const f = party(), c = f.clients[1];
  f.readyAll();
  c.game.Net.busy = () => true;
  c.controller.setReady(false);
  c.game.Net.busy = () => false;
  f.advance(200);
  assert(!f.clients[0].controller.getSnapshot().members[1].ready);
  assert(!f.clients[0].controller.getSnapshot().canStart);
});

test('invalid and forged packets cannot change a different player or touch saves', () => {
  const f = party(), packet = f.sent.findLast(e => e.from === 'p1' && e.packet.k === 'town-pose').packet;
  for (const pose of [{ ...packet.pose, x: NaN }, { ...packet.pose, x: 0 }, { ...packet.pose, dex: 999999 }]) {
    f.deliver(0, 'p1', { ...packet, seq: packet.seq + 100, pose });
  }
  f.deliver(0, 'outsider', { ...packet, seq: packet.seq + 100, pose: { ...packet.pose, x: 999 } });
  f.deliver(2, 'p1', { ...packet, k: 'town-snapshot', members: [] });
  f.advance(100);
  assert.equal(f.clients[0].controller.getSnapshot().members[1].pose.x, 620);
  assert(f.clients[0].warnings.length > 0);
  assert.equal(f.clients[2].controller.getSnapshot().members.length, 4);
});

test('readiness requires all current players and is cleared by closing its menu', () => {
  const f = party();
  assert(!f.clients[0].controller.getSnapshot().canStart);
  f.readyAll();
  assert(f.clients[0].controller.getSnapshot().canStart);
  f.clients[2].controller.setReadyMenuOpen(false);
  assert(!f.clients[2].controller.getSnapshot().ready);
  f.flush();
  assert(!f.clients[0].controller.getSnapshot().canStart);
  f.clients[2].controller.setReadyMenuOpen(true);
  f.advance();
  assert(!f.clients[2].controller.getSnapshot().ready);
  assert.throws(() => f.clients[3].controller.updateLocal({ x: NaN }), /pose/i);
});

test('joining, leaving and reconnecting clear the entire party readiness', () => {
  const f = party();
  f.readyAll();
  f.membership(f.roster.slice(0, 3));
  assert(f.clients.slice(0, 3).every(c => !c.controller.getSnapshot().ready));
  f.membership(f.roster);
  f.readyAll();
  assert(f.clients[0].controller.getSnapshot().canStart);
  f.blocked.add('p2');
  f.advance(200);
  assert(f.clients.filter(c => c.uid !== 'p2').every(c => !c.controller.getSnapshot().ready));
  f.blocked.delete('p2');
  f.advance(1500);
  assert(f.clients.every(c => !c.controller.getSnapshot().ready));
  assert(f.clients[0].controller.getSnapshot().members.every(m => m.connected));
});

test('old roster and old session messages cannot restore readiness', () => {
  const f = party();
  f.readyAll();
  const old = f.sent.findLast(e => e.from === 'p1' && e.packet.k === 'town-ready').packet;
  f.membership(f.roster.slice(0, 3));
  f.membership(f.roster);
  f.deliver(0, 'p1', { ...old, seq: old.seq + 1000 });
  f.advance();
  assert(!f.clients[0].controller.getSnapshot().members[1].ready);
  assert(!f.clients[0].controller.getSnapshot().canStart);
});

test('host starts the native expedition exactly once after every acknowledgement', async () => {
  for (const count of [2, 3, 4]) {
    const f = party(count);
    f.readyAll();
    let starts = 0;
    const result = f.clients[0].controller.requestStart(() => {
      starts++;
      const message = { k: 'start', host: 'p0', members: f.roster, townLaunch: f.clients[0].controller.getLaunchToken() };
      for (const c of f.clients) {
        assert(c.controller.acceptStart(message));
        assert(!c.controller.acceptStart(message), 'A consumed start must not replay');
      }
    });
    assert.equal(starts, 0);
    f.flush();
    assert.equal(await result, true);
    assert.equal(starts, 1);
    assert(f.clients.every(c => !c.controller.getSnapshot().ready));
  }
});

test('three Firebase relay clients share town presence and start only after everyone is ready', async () => {
  const f = party(3, 'relay');
  for (const c of f.clients) {
    assert(c.controller.getSnapshot().members.every(m => m.connected && m.pose));
    assert(!c.controller.getSnapshot().canStart);
  }
  f.readyAll();
  assert(f.clients[0].controller.getSnapshot().canStart);
  let starts = 0;
  const result = f.clients[0].controller.requestStart(() => {
    starts++;
    const message = { k: 'start', host: 'p0', members: f.roster, townLaunch: f.clients[0].controller.getLaunchToken() };
    for (const c of f.clients) {
      assert(c.controller.acceptStart(message));
      assert(!c.controller.acceptStart(message));
    }
  });
  f.flush();
  assert.equal(await result, true);
  assert.equal(starts, 1);
});

test('switching a connected party to Firebase relay preserves its readiness and heartbeats', () => {
  const f = party(3);
  f.readyAll();
  for (const c of f.clients) {
    c.game.Net.mode = () => 'relay';
    for (const member of f.roster) {
      if (member.uid !== c.uid) for (const onPeer of c.peers) onPeer(member.uid, 'relay');
    }
  }
  assert(f.clients[0].controller.getSnapshot().canStart);
  f.advance(12000);
  assert(f.clients[0].controller.getSnapshot().canStart);
  assert(f.clients.every(c => c.controller.getSnapshot().members.every(m => m.connected)));
});

test('closing readiness before prepare arrives cancels rather than pulling a player from a menu', async () => {
  const f = party();
  f.readyAll();
  let starts = 0;
  const result = f.clients[0].controller.requestStart(() => starts++);
  f.clients[1].controller.setReadyMenuOpen(false);
  f.flush();
  assert.equal(await result, false);
  assert.equal(starts, 0);
  assert(f.clients.every(c => !c.controller.getSnapshot().launching));
});

test('missing launch acknowledgements time out visibly and reset readiness', async () => {
  const f = party();
  f.readyAll();
  let starts = 0;
  const result = f.clients[0].controller.requestStart(() => starts++);
  f.queue.length = 0;
  f.advance(5500);
  assert.equal(await result, false);
  assert.equal(starts, 0);
  assert(!f.clients[0].controller.getSnapshot().ready);
  assert(f.clients.every(c => !c.controller.getSnapshot().ready), 'Cancellation clears readiness even if prepare was lost');
  assert(f.clients[0].notices.length > 0);
});

test('a last acknowledgement after the deadline cannot broadcast a start before the next timer tick', async () => {
  const f = party(2);
  f.readyAll();
  f.advance(50);
  let starts = 0;
  const result = f.clients[0].controller.requestStart(() => starts++);
  const holdAck = entry => entry.from !== 'p1';
  f.advance(100, holdAck);
  f.advance(4901, holdAck);
  f.flush();
  assert.equal(starts, 0);
  f.advance(100);
  assert.equal(await result, false);
  assert.equal(f.clients[0].controller.getLaunchToken(), null);
});

test('a room loss and recovery between polling ticks clears readiness for everyone', () => {
  const f = party(2);
  f.readyAll();
  const host = f.clients[0];
  host.game.Social.room.lost = true;
  for (const onChange of host.social) onChange('room');
  assert(!host.controller.getSnapshot().ready);
  f.advance(50);
  host.game.Social.room.lost = false;
  for (const onChange of host.social) onChange('room');
  f.advance(1500);
  assert(f.clients.every(c => !c.controller.getSnapshot().ready));
  assert(f.clients[0].controller.getSnapshot().members.every(m => m.connected));
});

test('the host joins a start it already authorized even if broadcasting crosses the deadline', async () => {
  const f = party(2);
  f.readyAll();
  const result = f.clients[0].controller.requestStart(() => {
    const message = { k: 'start', host: 'p0', members: f.roster, townLaunch: f.clients[0].controller.getLaunchToken() };
    assert(message.townLaunch);
    assert(f.clients[1].controller.acceptStart(message));
    f.clients[0].host.performance.now = () => 100000;
    assert(f.clients[0].controller.acceptStart(message));
  });
  f.flush();
  assert.equal(await result, true);
});

test('native peer lifecycle events catch a connection replacement between polling ticks', () => {
  const f = party(2);
  f.readyAll();
  for (const onPeer of f.clients[0].peers) onPeer('p1', 'connecting');
  for (const onPeer of f.clients[1].peers) onPeer('p0', 'connecting');
  for (const onPeer of f.clients[0].peers) onPeer('p1', 'direct');
  for (const onPeer of f.clients[1].peers) onPeer('p0', 'direct');
  f.advance(1500);
  assert(f.clients.every(c => !c.controller.getSnapshot().ready));
  assert(f.clients[0].controller.getSnapshot().members.every(m => m.connected));
});

test('unready, legacy and nonhost callers cannot start an expedition', async () => {
  const f = party();
  let starts = 0;
  assert.equal(await f.clients[0].controller.requestStart(() => starts++), false);
  f.readyAll();
  assert.equal(await f.clients[1].controller.requestStart(() => starts++), false);
  assert(!f.clients[2].controller.acceptStart({ k: 'start', host: 'p0', members: f.roster }));
  f.clients[3].controller.dispose();
  f.advance(5500);
  assert.equal(await f.clients[0].controller.requestStart(() => starts++), false);
  assert.equal(starts, 0);
});

test('leaving and disposal clear listeners, timers and remote state without closing native Net', () => {
  const f = party();
  for (const c of f.clients) {
    c.game.Social.room = null;
    for (const onChange of c.social) onChange('room');
    assert.equal(c.controller.getSnapshot().members.length, 0);
    c.controller.dispose();
    assert.equal(c.social.size, 0);
    assert.equal(c.network.size, 0);
  }
  assert.equal(f.timers.size, 0);
});
