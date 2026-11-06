const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PATCHES, patch } = require('../tools/patch-responsive-engine.cjs');

const engine = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.min.js'), 'utf8');

test('every responsive engine patch is applied exactly once', () => {
  for (const [before, after] of PATCHES) {
    assert.ok(!engine.includes(before), 'Unpatched anchor: ' + before.slice(0, 80));
    assert.equal(engine.split(after).length - 1, 1, 'Missing or duplicated patch: ' + after.slice(0, 80));
  }
});

test('the codemod is idempotent and refuses missing or ambiguous anchors', () => {
  assert.equal(patch(engine), engine);
  assert.throws(() => patch('a;a', [['a', 'b']]), /not unique/);
  assert.throws(() => patch('x', [['a', 'b']]), /not found/);
});

test('portrait sees the same world area as landscape, rotated; landscape is unchanged', () => {
  const body = /'fit'\(\)\{(this\['scale'\][^}]*)\}/.exec(engine)[1];
  const fit = new Function(body);
  const view = (w, h) => { const camera = { _cw: w, _ch: h, VIEW_W: 768, MIN_VIEW_H: 420, zoom: 1 }; fit.call(camera); return camera; };
  const land = view(852, 393), port = view(393, 852);
  assert.ok(Math.abs(port.w - land.h) < 1e-9 && Math.abs(port.h - land.w) < 1e-9);
  assert.equal(view(1280, 720).scale, Math.min(1280 / 768, 720 / 420));
});

test('portrait is never blocked and touch layouts are stored per orientation', () => {
  assert.match(engine, /_0x147905=!1/);
  assert.doesNotMatch(engine, /\['lock'\]\('landscape'\)/);
  assert.match(engine, /padding:var\(--sa-top,0px\)/);
  assert.match(engine, /\['get'\]\(innerHeight>innerWidth\?'padP':'pad'\)/);
  assert.match(engine, /\['set'\]\(innerHeight>innerWidth\?'padP':'pad',/);
  assert.match(engine, /'pad':null,'padP':null,'gamepad'/);
});

test('top-center HUD text clears the safe area and drops under the HP group on narrow screens', () => {
  const offset = "+_0x599208['Touch']['safeArea']()['top']+(_0x3d17e6<0x230?0x38:0x0)";
  for (const anchor of ["_0x5fa260['time']),_0x3d17e6/0x2,0x2a", '_0x3d17e6/0x2,0x3a', '(_0x3d17e6-_0x3ca050)/0x2,0x46', "['toUpperCase'](),_0x3d17e6/0x2,0x50", '(_0x30a375?0x62:0x4c)']) {
    assert.ok(engine.includes(anchor + offset), 'HUD element not offset: ' + anchor);
  }
  assert.match(engine, /_0x4c351d=0xe\+_0x1a2069\['top'\]\+\(_0x3d17e6<0x230\?0x8c:0x0\)/);
});

test('the HUD and its touch buttons go through PSUiScale, with a safe fallback', () => {
  assert.match(engine, /window\.PSUiScale\?window\.PSUiScale\.drawHud\(_0x599208\['HUD'\],/);
  assert.match(engine, /const _psK=window\.PSUiScale\?window\.PSUiScale\.buttonScale\(\):1;/);
  for (const page of ['index.html', 'en/index.html']) {
    const source = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    const at = source.indexOf('js/ui-scale.js?v=');
    assert.ok(at > 0 && at < source.indexOf('js/app.min.js?v='), page);
  }
});
