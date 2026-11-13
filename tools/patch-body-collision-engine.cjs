const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PATCHES = [
  [
    'window.PSTraining.install(_0x599208);const _0x5313dd=',
    'window.PSTraining.install(_0x599208);window.PSBodyCollision.install(_0x599208);const _0x5313dd='
  ],
  [
    "if(_0x599208['U']['dist2'](_0x140d71['x'],_0x140d71['y'],_0x4def28['x'],_0x4def28['y'])>(_0x140d71['r']+_0x4def28['r'])*(_0x140d71['r']+_0x4def28['r']))continue;",
    'if(!window.PSBodyCollision.touching(_0x140d71,_0x4def28))continue;'
  ]
];

function patch(source, patches = PATCHES) {
  for (const [before, after] of patches) {
    const applied = source.split(after).length - 1;
    const originals = source.split(before).length - 1;
    if (applied === 1 && originals === 0) continue;
    if (applied || originals !== 1) throw new Error('Body collision anchor is missing or not unique: ' + before);
    source = source.replace(before, after);
  }
  new vm.Script(source);
  return source;
}

if (require.main === module) {
  const file = path.join(__dirname, '..', 'js', 'app.min.js');
  const before = fs.readFileSync(file, 'utf8'), after = patch(before);
  if (after !== before) fs.writeFileSync(file, after);
  console.log('Applied checked player body collision hooks.');
}

module.exports = { PATCHES, patch };
