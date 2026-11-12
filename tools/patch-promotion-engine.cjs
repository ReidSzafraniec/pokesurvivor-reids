// Checked codemod: the hidden YouTube button, video notice and menu carousel stop polling GitHub
// and stop their timers. Their elements stay hidden for engine compatibility, and their unused
// preview() hooks no longer show anything. Safe to rerun.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const EDITS = [
  // LiveUI: keep the (hidden) button wiring, drop the live.json poll, its timer and visibility hook.
  ["_0x31b3fd(),_0x85991d(),setInterval(_0x85991d,_0x3b5078),document['addEventListener']('visibilitychange'," +
    "()=>{document['hidden']||_0x85991d();});}};})()),_0x599208['VideoUI']=",
  "_0x31b3fd();}};})()),_0x599208['VideoUI']="],
  // VideoUI: keep the dialog buttons, drop the aviso.json poll and the 2 s check that opens the dialog.
  ["_0x23064a('video-close')[_0x13bd2d(0x4a0)]=_0x4403fe,_0x265937(),setInterval(_0x265937,_0x4d983e)," +
    'setInterval(_0x4ef534,0x7d0);}',
  "_0x23064a('video-close')[_0x13bd2d(0x4a0)]=_0x4403fe;}"],
  // BannerUI: keep the first render, drop the video.json poll, its visibility hook and the 7 s rotation.
  ["_0x135609(),_0x2b379b(),setInterval(_0x2b379b,_0x22bbd3),_0x53178d(),document['addEventListener']('visibilitychange'," +
    "()=>{document['hidden']||_0x2b379b();});},'preview'(_0x419514,_0x5708c8)",
  "_0x135609();},'preview'(_0x419514,_0x5708c8)"]
];

function patch(source) {
  for (const [before, after] of EDITS) {
    if (!source.includes(before) && source.split(after).length === 2) continue;
    if (source.split(before).length !== 2) throw new Error('Promotion engine anchor is missing or not unique: ' + before.slice(0, 100));
    source = source.replace(before, () => after);
  }
  new vm.Script(source);
  return source;
}

if (require.main === module) {
  const file = path.join(__dirname, '..', 'js', 'app.min.js');
  const before = fs.readFileSync(file, 'utf8'), after = patch(before);
  if (after !== before) fs.writeFileSync(file, after);
  console.log('Removed hidden promotion polling.');
}
module.exports = { patch };
