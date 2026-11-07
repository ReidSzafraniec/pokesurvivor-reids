const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function patch(source) {
  function hook(anchor, addition) {
    const patched = anchor + addition;
    if (source.includes(patched)) return;
    if (source.split(anchor).length !== 2) throw new Error('Tutorial engine anchor is not unique: ' + anchor);
    source = source.replace(anchor, patched);
  }
  hook('function _0x138343(_0x1592fd=!0x0){',
    "if(_0x599208.Tutorial&&_0x599208.Tutorial.activeFor(_0x17b390))return _0x599208.Tutorial.finish(_0x1592fd?'defeat':'skip');");
  hook('function _0x3c336f(_0x216232=!0x0){',
    'if(_0x599208.Tutorial&&_0x599208.Tutorial.activeFor(_0x17b390))return;');
  new vm.Script(source);
  return source;
}

if (require.main === module) {
  const file = path.join(__dirname, '..', 'js', 'app.min.js');
  const before = fs.readFileSync(file, 'utf8'), after = patch(before);
  if (after !== before) fs.writeFileSync(file, after);
  console.log('Applied checked tutorial match hooks.');
}
module.exports = { patch };
