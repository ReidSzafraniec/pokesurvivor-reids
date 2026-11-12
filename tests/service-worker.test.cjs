const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const ORIGIN = 'https://friends.example';

function worker() {
  const listeners = new Map(), stored = [];
  const cache = { put: (request, response) => { stored.push(typeof request === 'string' ? request : request.url); } };
  const context = {
    URL, console,
    location: new URL(ORIGIN + '/sw.js'),
    caches: { open: async () => cache, match: async () => undefined, keys: async () => [] },
    fetch: async () => ({ ok: true, redirected: false, clone() { return this; } }),
    Response: { error: () => ({ type: 'error' }) },
    self: {
      registration: { scope: ORIGIN + '/' },
      addEventListener: (type, handler) => listeners.set(type, handler),
      skipWaiting() {}, clients: { claim() {} }
    }
  };
  vm.runInNewContext(source, context);
  async function request(url, init = {}) {
    let response;
    listeners.get('fetch')({
      request: { url: ORIGIN + url, method: 'GET', mode: 'cors', cache: 'default', ...init },
      respondWith: value => { response = value; }
    });
    await response;
    await new Promise(resolve => setImmediate(resolve));
    return stored;
  }
  return { request, stored };
}

test('the service worker keeps ordinary code responses for offline play', async () => {
  const sw = worker();
  await sw.request('/js/town.js?v=1');
  assert.deepEqual(sw.stored, [ORIGIN + '/js/town.js?v=1']);
});

test('no-store requests such as the timestamped update check are never cached', async () => {
  const sw = worker();
  for (let poll = 1; poll <= 3; poll++) await sw.request('/version.json?t=' + poll, { cache: 'no-store' });
  assert.deepEqual(sw.stored, []);
});
