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

test('tokens: integer scale ladder, art pixel and safe-area vars', () => {
  assert.match(find(css, 'html').body, /font-size: calc\(16px \* var\(--s\)\)/);
  assert.match(find(css, ':root', '(min-width: 2560px) and (min-height: 1440px)').body, /--s: 2/);
  assert.match(find(css, ':root', '(min-width: 3840px) and (min-height: 2160px)').body, /--s: 3/);
  const root = find(css, ':root').body;
  assert.match(root, /--ap: 0\.125rem/);
  for (const side of ['top', 'right', 'bottom', 'left']) {
    assert.match(root, new RegExp(`--sa-${side}: env\\(safe-area-inset-${side}, 0px\\)`));
  }
  assert.match(root, /--frame-t: max\(var\(--gut\), var\(--sa-top\)\)/);
});

test('env(safe-area-inset-*) is only read in :root', () => {
  const readers = rules(css).filter(rule => /env\(safe-area-inset/.test(rule.body));
  assert.deepEqual(readers.map(rule => rule.selector), [':root']);
});

test('components are pixel-crisp: 9-slice windows, beveled buttons, no radius or gradients', () => {
  assert.match(find(css, '.box').body, /border-image: var\(--frame-img\) 4 fill \/ calc\(4 \* var\(--ap\)\) stretch/);
  assert.match(find(css, '.btn').body, /inset var\(--ap\) var\(--ap\) 0 var\(--hi\)/);
  assert.match(find(css, '.btn:active').body, /translateY\(calc\(2 \* var\(--ap\)\)\)/);
  for (const selector of ['.box', '.btn', '.btn.gold', '.btn.ghost', '.pill', '.tab', '.gen-tab', '.chip', '.card', '.cell', '.panel', '.field', '.stage', '.toast']) {
    const rule = find(css, selector);
    assert.ok(rule, selector + ' must be styled at top level');
    assert.doesNotMatch(rule.body, /border-radius|linear-gradient|radial-gradient|blur\(/, selector);
  }
});
