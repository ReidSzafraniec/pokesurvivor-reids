const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { patch } = require('../tools/patch-gpu-reset-engine.cjs');

const engine = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.min.js'), 'utf8');

// Runs one engine function with a fake document that records how each canvas context is requested.
function runEngine(start, end, call) {
  const requests = [];
  const document = {
    createElement: () => {
      const canvas = { width: 0, height: 0 };
      canvas.getContext = (type, options) => {
        requests.push({ type, options: options && { ...options } });
        return {
          createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
          putImageData() {}, drawImage() {}, fillRect() {}
        };
      };
      return canvas;
    }
  };
  const context = vm.createContext({ document, WeakMap, Uint32Array });
  vm.runInContext(engine.slice(0, engine.indexOf('const a0_0xc9496a=')) +
    engine.slice(engine.lastIndexOf('function a0_0x48f4()')), context, { timeout: 3000 });
  context._0x58bf0b = context.a0_0x422d;
  const from = engine.indexOf(start), to = engine.indexOf(end, from);
  assert(from > 0 && to > from, 'Engine function not found: ' + start);
  vm.runInContext(engine.slice(from, to) + ';globalThis.__result = (' + call + ');', context, { timeout: 3000 });
  return requests;
}

test('generated terrain chunks and props keep their pixels in system memory, surviving GPU resets', () => {
  const requests = runEngine('function _0x317046(', "_0x5a30a2['push'](", '_0x317046(4, 3).canvas()');
  assert.deepEqual(requests, [{ type: '2d', options: { willReadFrequently: true } }]);
});

test('hit-flash silhouettes keep their pixels in system memory, surviving GPU resets', () => {
  const requests = runEngine('const _0x535d87=new WeakMap();', 'function _0x1f4e60(', '_0x45c044({ width: 4, height: 3 })');
  assert.deepEqual(requests, [{ type: '2d', options: { willReadFrequently: true } }]);
});

test('the run minimap cache keeps its pixels in system memory', () => {
  assert(engine.includes("const _0x1ad821=_0x127bdf['getContext']('2d',{'willReadFrequently':!0x0}),_0x2549f2="));
});

test('the GPU-reset engine patch is applied, idempotent and checked', () => {
  assert.equal(patch(engine), engine);
  assert.throws(() => patch('const unrelated = true;'), /anchor is missing or not unique/);
});
