const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
  test('Firebase access rules (run npm run test:rules with Java 21+)', { skip: true }, () => {});
} else {
  const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
  const { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, serverTimestamp } = require('firebase/firestore');
  const { ref, set, get, remove, update, onDisconnect, goOffline } = require('firebase/database');
  let env;
  const db = uid => env.authenticatedContext(uid).database();
  const store = uid => env.authenticatedContext(uid).firestore();
  const member = (name = 'Player') => ({ name, dex: 25, shiny: false, at: Date.now() });
  const room = () => ({ host: 'host', open: true, at: Date.now(), slots: { 0: 'host' }, m: { host: member('Host') } });
  const friendship = () => ({
    users: ['guest', 'host'], from: 'host', to: 'guest', status: 'pending',
    names: { host: 'Host', guest: 'Guest' }, at: serverTimestamp()
  });
  test.before(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-pokesurvivor',
      firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') },
      database: { rules: fs.readFileSync(path.join(__dirname, '..', 'database.rules.json'), 'utf8') }
    });
  });
  test.beforeEach(async () => {
    await env.clearFirestore();
    await env.clearDatabase();
  });
  test.after(async () => { if (env) await env.cleanup(); });

  test('saves are owner-only, validate metadata, and cannot grant privileges', async () => {
    const save = { save: { name: 'Host', coins: 42 }, v: 3, rev: 1, updatedAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(store('host'), 'saves/host'), save));
    await assertSucceeds(getDoc(doc(store('host'), 'saves/host')));
    await assertFails(getDoc(doc(store('guest'), 'saves/host')));
    await assertFails(setDoc(doc(store('guest'), 'saves/host'), save));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'saves/host')));
    await assertFails(updateDoc(doc(store('host'), 'saves/host'), { ban: false }));
    await assertFails(updateDoc(doc(store('host'), 'saves/host'), { save: 'not a save' }));
    await assertSucceeds(deleteDoc(doc(store('host'), 'saves/host')));
  });

  test('save revisions reject stale overwrites so the engine can merge concurrent progress', async () => {
    const target = doc(store('host'), 'saves/host');
    const save = { save: { coins: 42 }, v: 3, rev: 1, updatedAt: serverTimestamp() };
    await assertFails(setDoc(target, { ...save, rev: 8 }));
    await setDoc(target, save);
    await assertFails(setDoc(target, { ...save, save: { coins: 1 } }));
    await assertFails(setDoc(target, { ...save, rev: 0 }));
    await assertFails(setDoc(target, { ...save, rev: 3 }));
    await assertSucceeds(setDoc(target, { ...save, rev: 2 }));
  });

  test('nickname claims are unique and profiles expose only public fields', async () => {
    await assertSucceeds(getDoc(doc(store('host'), 'names/host')));
    await assertSucceeds(setDoc(doc(store('host'), 'names/host'), { uid: 'host' }));
    await assertFails(setDoc(doc(store('guest'), 'names/host'), { uid: 'guest' }));
    await assertFails(setDoc(doc(store('guest'), 'names/guest'), { uid: 'host' }));
    const profile = { name: 'Host', lower: 'host', at: serverTimestamp() };
    await assertSucceeds(setDoc(doc(store('host'), 'profiles/host'), profile));
    await assertSucceeds(getDoc(doc(store('guest'), 'profiles/host')));
    await assertFails(setDoc(doc(store('host'), 'profiles/host'), { ...profile, password: 'no' }));
    await assertFails(setDoc(doc(store('guest'), 'profiles/host'), profile));
  });

  test('friend requests require the recipient to accept and restrict participant queries', async () => {
    const request = doc(store('host'), 'friendships/guest_host');
    await assertSucceeds(setDoc(request, friendship()));
    await assertFails(updateDoc(request, { status: 'ok' }));
    await assertFails(updateDoc(doc(store('stranger'), 'friendships/guest_host'), { status: 'ok' }));
    await assertSucceeds(updateDoc(doc(store('guest'), 'friendships/guest_host'), {
      status: 'ok', at: serverTimestamp(), 'names.guest': 'Guest'
    }));
    await assertSucceeds(getDocs(query(collection(store('guest'), 'friendships'), where('users', 'array-contains', 'guest'))));
    await assertFails(getDocs(collection(store('stranger'), 'friendships')));
    await assertFails(setDoc(request, friendship()));
    await assertSucceeds(deleteDoc(doc(store('guest'), 'friendships/guest_host')));
  });

  test('only accepted friends can invite, and either participant can delete an invitation', async () => {
    const invite = { from: 'host', to: 'guest', name: 'Host', room: 'host', at: serverTimestamp() };
    await assertFails(setDoc(doc(store('host'), 'inv/guest_host'), invite));
    await setDoc(doc(store('host'), 'friendships/guest_host'), friendship());
    await updateDoc(doc(store('guest'), 'friendships/guest_host'), { status: 'ok' });
    await assertSucceeds(setDoc(doc(store('host'), 'inv/guest_host'), invite));
    await assertSucceeds(getDocs(query(collection(store('guest'), 'inv'), where('to', '==', 'guest'))));
    await assertFails(setDoc(doc(store('stranger'), 'inv/guest_host'), invite));
    await assertSucceeds(deleteDoc(doc(store('guest'), 'inv/guest_host')));
  });

  test('rooms permit four members, reject a fifth, and protect host controls', async () => {
    await assertSucceeds(set(ref(db('host'), 'rooms/host'), room()));
    await assertSucceeds(get(ref(db('guest'), 'rooms/host/open')));
    await assertFails(get(ref(db('guest'), 'rooms/host/m')));
    for (const [index, uid] of ['guest', 'third', 'fourth'].entries()) {
      await assertSucceeds(set(ref(db(uid), 'rin/host/' + uid), true));
      await assertSucceeds(set(ref(db(uid), 'rooms/host/slots/' + (index + 1)), uid));
      await assertSucceeds(set(ref(db(uid), 'rooms/host/m/' + uid), member()));
    }
    await assertFails(set(ref(db('fifth'), 'rooms/host/slots/4'), 'fifth'));
    await assertFails(set(ref(db('fifth'), 'rooms/host/m/fifth'), member()));
    await assertSucceeds(get(ref(db('guest'), 'rooms/host/m')));
    await assertFails(set(ref(db('guest'), 'rooms/host/open'), false));
    await assertFails(set(ref(db('guest'), 'rooms/host/host'), 'guest'));
    await assertFails(remove(ref(db('guest'), 'rooms/host')));
    await assertSucceeds(set(ref(db('host'), 'rooms/host/open'), false));
    await assertSucceeds(update(ref(db('guest'), 'rooms/host/m/guest'), { dex: 4 }));
    await assertSucceeds(remove(ref(db('fourth'), 'rooms/host/m/fourth')));
    await assertSucceeds(remove(ref(db('fourth'), 'rooms/host/slots/3')));
    await assertFails(set(ref(db('fifth'), 'rooms/host/m/fifth'), member()));
    await assertSucceeds(set(ref(db('host'), 'rooms/host/open'), true));
    await assertSucceeds(remove(ref(db('host'), 'rooms/host')));
  });

  test('simultaneous joins publish only three guest seats with matching members', async () => {
    const host = db('host');
    await set(ref(host, 'rooms/host'), room());
    const hosting = require('../js/hosting.js').create({}, { hostname: 'localhost', protocol: 'http:' });
    const results = await Promise.allSettled(['guest', 'third', 'fourth', 'fifth'].map(uid =>
      hosting.joinRoom(db(uid), 'host', uid, member())
    ));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 3);
    const rejected = results.find(result => result.status === 'rejected');
    assert.match(rejected.reason.message, /full/);
    const seats = (await get(ref(host, 'rooms/host/slots'))).val();
    const members = (await get(ref(host, 'rooms/host/m'))).val();
    assert.deepEqual(Object.values(seats).sort(), Object.keys(members).sort());
    assert.equal(Object.keys(members).length, 4);
  });

  test('relay and signaling inboxes are member-only with authenticated sender and payload bounds', async () => {
    await set(ref(db('host'), 'rooms/host'), room());
    await set(ref(db('guest'), 'rooms/host/slots/1'), 'guest');
    await set(ref(db('guest'), 'rooms/host/m/guest'), member());
    const inbox = 'rooms/host/q/guest/host_00';
    const packet = JSON.stringify({ f: 'host', d: { k: 'f', x: 7 } });
    await assertSucceeds(set(ref(db('host'), inbox), packet));
    await assertSucceeds(get(ref(db('guest'), 'rooms/host/q/guest')));
    await assertFails(get(ref(db('third'), 'rooms/host/q/guest')));
    await assertFails(get(ref(db('host'), 'rooms/host/q/guest')));
    await assertFails(set(ref(db('third'), inbox), packet));
    await assertFails(set(ref(db('guest'), 'rooms/host/q/host/host_00'), packet));
    await assertFails(set(ref(db('guest'), 'rooms/host/q/host/guest_00'), packet));
    await assertFails(set(ref(db('host'), inbox), 'x'.repeat(1048577)));
    await assertSucceeds(remove(ref(db('guest'), inbox)));
    await assertFails(get(ref(env.unauthenticatedContext().database(), 'rooms/host/open')));
    assert.equal(Object.keys((await get(ref(db('host'), 'rooms/host/m'))).val()).length, 2);
  });

  test('a disconnect releases both the member and reserved seat', async () => {
    const host = db('host'), guest = db('guest');
    await set(ref(host, 'rooms/host'), room());
    await set(ref(guest, 'rooms/host/slots/1'), 'guest');
    await onDisconnect(ref(guest, 'rooms/host/m/guest')).remove();
    await set(ref(guest, 'rooms/host/m/guest'), member());
    goOffline(guest);
    for (let attempt = 0; attempt < 100; attempt++) {
      if (!(await get(ref(host, 'rooms/host/m/guest'))).exists()) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal((await get(ref(host, 'rooms/host/m/guest'))).exists(), false);
    // onDisconnect evaluates each path separately; only the host releases the vacant seat.
    const hosting = require('../js/hosting.js').create({}, { hostname: 'localhost', protocol: 'http:' });
    await hosting.releaseDepartedSeats(host, 'host', [{ uid: 'guest' }], {});
    assert.equal((await get(ref(host, 'rooms/host/slots/1'))).exists(), false);
  });
}
