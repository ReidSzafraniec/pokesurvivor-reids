const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { MEDIA, rules, find, tokens } = require('./helpers/css.cjs');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const css = read('css/style.css');
const legacy = require('./fixtures/legacy-style-selectors.json');

// Selectors intentionally dropped by the rewrite, with the reason.
const RETIRED = {};

test('every legacy selector token is still styled or explicitly retired', () => {
  const current = new Set(tokens(css));
  const missing = legacy.filter(token => !current.has(token) && !RETIRED[token]);
  assert.deepEqual(missing, [], 'Restyle these or add them to RETIRED with a reason');
  for (const [token, reason] of Object.entries(RETIRED)) assert.ok(reason.length > 10, token + ' needs a reason');
});
