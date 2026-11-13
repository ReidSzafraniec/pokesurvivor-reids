// Checked codemod: static texture caches keep their pixels in system memory. Safe to rerun.
// GPU-backed canvases are wiped when the browser's GPU process resets (seen on Xbox Edge), and the
// engine never repaints its caches, so terrain, trees and props vanished for the rest of the run.
// willReadFrequently keeps a canvas CPU-backed; the browser re-uploads it after a reset by itself.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const CPU = "{'willReadFrequently':!0x0}";
const EDITS = [
  // Procedural terrain chunks and props (trees, grass, rocks, chests...).
  ["const _0x28fd01=_0x4869ad['getContext']('2d'),_0x1434c8=_0x28fd01['createImageData']",
    "const _0x28fd01=_0x4869ad['getContext']('2d'," + CPU + "),_0x1434c8=_0x28fd01['createImageData']"],
  // White hit-flash silhouettes of sprite sheets.
  ["const _0x355677=_0x42f255['getContext']('2d');return _0x355677['drawImage'](_0x341cf7,0x0,0x0)",
    "const _0x355677=_0x42f255['getContext']('2d'," + CPU + ");return _0x355677['drawImage'](_0x341cf7,0x0,0x0)"],
  // Run minimap.
  ["const _0x1ad821=_0x127bdf['getContext']('2d'),_0x2549f2=",
    "const _0x1ad821=_0x127bdf['getContext']('2d'," + CPU + "),_0x2549f2="]
];

function patch(source) {
  for (const [before, after] of EDITS) {
    if (!source.includes(before) && source.split(after).length === 2) continue;
    if (source.split(before).length !== 2) throw new Error('GPU-reset engine anchor is missing or not unique: ' + before.slice(0, 100));
    source = source.replace(before, () => after);
  }
  new vm.Script(source);
  return source;
}

if (require.main === module) {
  const file = path.join(__dirname, '..', 'js', 'app.min.js');
  const before = fs.readFileSync(file, 'utf8'), after = patch(before);
  if (after !== before) fs.writeFileSync(file, after);
  console.log('Static engine texture caches now survive GPU resets.');
}
module.exports = { patch };
