// Idempotent, checked codemod for the vendored engine: portrait play, safe-area vars,
// full safe insets for the HUD and per-orientation touch layouts. Safe to rerun.
const fs = require('node:fs');
const path = require('node:path');

// Extra y for top-center HUD text: the safe-area top, plus 56px on narrow screens (under the HP group).
const HUD_TOP = "+_0x599208['Touch']['safeArea']()['top']+(_0x3d17e6<0x230?0x38:0x0)";

const PATCHES = [
  // Portrait is supported: never show the rotate overlay and never lock to landscape.
  ["_0x147905=_0x599208['Touch']['active']&&innerHeight>innerWidth", '_0x147905=!1'],
  ["_0x1624c1['then'](()=>{try{screen['orientation']['lock']('landscape')['catch'](()=>{});}catch(_0x887069){}})",
    "_0x1624c1['then'](()=>{})"],
  // Fit by long/short axis: landscape unchanged, portrait sees the same area rotated.
  ["this['scale']=Math['min'](this['_cw']/this['VIEW_W'],this['_ch']/this['MIN_VIEW_H'])/this['zoom']",
    "this['scale']=Math['min'](Math['max'](this['_cw'],this['_ch'])/this['VIEW_W'],Math['min'](this['_cw'],this['_ch'])/this['MIN_VIEW_H'])/this['zoom']"],
  // Safe-area probe reads the stylesheet's --sa-* vars (single source of truth, simulable in tests).
  [String.raw`padding:env(safe-area-inset-top)\x20env(safe-area-inset-right)\x20env(safe-area-inset-bottom)\x20env(safe-area-inset-left)`,
    String.raw`padding:var(--sa-top,0px)\x20var(--sa-right,0px)\x20var(--sa-bottom,0px)\x20var(--sa-left,0px)`],
  // XP bar below the status bar / island.
  ["_0x21c456['fillRect'](0x0,0x0,_0x3d17e6,0x7)",
    "_0x21c456['fillRect'](0x0,_0x599208['Touch']['safeArea']()['top'],_0x3d17e6,0x7)"],
  ["_0x21c456['fillRect'](0x0,0x0,_0x3d17e6*_0x599208['U']['clamp'](_0xa1db99,0x0,0x1),0x7)",
    "_0x21c456['fillRect'](0x0,_0x599208['Touch']['safeArea']()['top'],_0x3d17e6*_0x599208['U']['clamp'](_0xa1db99,0x0,0x1),0x7)"],
  // Pause button: full insets instead of the old 44px/20px caps (HUD, default spot, layout reset).
  ["_0x3d17e6-0x34-Math['min'](0x2c,_0x579ff0[_0x2a477f(0x195)])", "_0x3d17e6-0x34-_0x579ff0[_0x2a477f(0x195)]"],
  ["0xc+Math['min'](0x14,_0x579ff0['top'])", "0xc+_0x579ff0['top']"],
  ["[_0x1e92fa-0x34-Math['min'](0x2c,_0x4b18b5['right'])+0x14,0xc+Math['min'](0x14,_0x4b18b5['top'])+0x14]",
    "[_0x1e92fa-0x34-_0x4b18b5['right']+0x14,0xc+_0x4b18b5['top']+0x14]"],
  ["'pause':[_0x3929ef-0x34-Math['min'](0x2c,_0x150644['right'])+0x14,0xc+Math['min'](0x14,_0x150644['top'])+0x14]",
    "'pause':[_0x3929ef-0x34-_0x150644['right']+0x14,0xc+_0x150644['top']+0x14]"],
  // Custom touch layouts: 'pad' = landscape (existing saves), 'padP' = portrait.
  ["'pad':null,'gamepad'", "'pad':null,'padP':null,'gamepad'"],
  ["const _0x530368=_0x599208['Settings']['get']('pad');",
    "const _0x530368=_0x599208['Settings']['get'](innerHeight>innerWidth?'padP':'pad');"],
  ["_0x599208['Settings']['set']('pad',", "_0x599208['Settings']['set'](innerHeight>innerWidth?'padP':'pad',"],
  // The layout editor never asks to rotate.
  ["_0x1d304e['querySelector']('.lay-turn')[_0xca6c53(0x512)]['toggle']('hidden',innerWidth>=innerHeight)",
    "_0x1d304e['querySelector']('.lay-turn')[_0xca6c53(0x512)]['toggle']('hidden',!0)"],
  // Top-center HUD (timer, zone line, boss bar, rift timer) below the safe-area top; on narrow
  // screens (< 560px) it drops 56px under the HP group, and the weather badge moves under the boss bar.
  ["_0x21c456['fillText'](_0x599208['U']['mmss'](_0x5fa260['time']),_0x3d17e6/0x2,0x2a)",
    `_0x21c456['fillText'](_0x599208['U']['mmss'](_0x5fa260['time']),_0x3d17e6/0x2,0x2a${HUD_TOP})`],
  ["+_0x5da693,_0x3d17e6/0x2,0x3a)", `+_0x5da693,_0x3d17e6/0x2,0x3a${HUD_TOP})`],
  ["_0x4c351d=0xe+_0x1a2069['top'];", "_0x4c351d=0xe+_0x1a2069['top']+(_0x3d17e6<0x230?0x8c:0x0);"],
  ["_0x2e10e7(_0x21c456,(_0x3d17e6-_0x3ca050)/0x2,0x46,", `_0x2e10e7(_0x21c456,(_0x3d17e6-_0x3ca050)/0x2,0x46${HUD_TOP},`],
  ["_0x21c456['fillText'](_0x30a375['name']['toUpperCase'](),_0x3d17e6/0x2,0x50)",
    `_0x21c456['fillText'](_0x30a375['name']['toUpperCase'](),_0x3d17e6/0x2,0x50${HUD_TOP})`],
  ["_0x3d17e6/0x2,_0x30a375?0x62:0x4c)", `_0x3d17e6/0x2,(_0x30a375?0x62:0x4c)${HUD_TOP})`],
  // Bottom of the HUD: the orb bar and the opening hint clear the full home-indicator inset (was capped at 28px).
  [",_0x3d17e6/0x2,_0x3de3e0-0x4)),_0x21c456['restore']();}",
    ",_0x3d17e6/0x2,_0x3de3e0-0x4-_0x599208['Touch']['safeArea']()['bottom'])),_0x21c456['restore']();}"],
  ["(_0x2be7a5?Math['min'](0x1c,_0x599208['Touch']['safeArea']()['bottom']):0x0)", "(_0x2be7a5?_0x599208['Touch']['safeArea']()['bottom']:0x0)"],
  ["_0x54835f-_0x12bd93-0x12-Math['min'](0x1c,_0x4b18b5['bottom'])+0x1b", "_0x54835f-_0x12bd93-0x12-_0x4b18b5['bottom']+0x1b"],
  ["_0xc055e7-_0x12bd93-0x12-Math['min'](0x1c,_0x150644['bottom'])+0x1b", "_0xc055e7-_0x12bd93-0x12-_0x150644['bottom']+0x1b"],
  // Canvas HUD at the integer UI scale (falls back to the original call if ui-scale.js is missing).
  ["_0x599208['Judgment']['cinematic']||_0x599208['HUD']['draw'](_0x1464ad,_0x34875d,_0x159de6,_0x17b390,_0x5f4834)",
    "_0x599208['Judgment']['cinematic']||(window.PSUiScale?window.PSUiScale.drawHud(_0x599208['HUD'],_0x1464ad,_0x34875d,_0x159de6,_0x17b390,_0x5f4834):_0x599208['HUD']['draw'](_0x1464ad,_0x34875d,_0x159de6,_0x17b390,_0x5f4834))"],
  // Touch buttons registered while the HUD is scaled are stored in screen pixels.
  ["{_0x12e847['push']({'x':_0x22e037,'y':_0x427dde,'w':_0x5685dd,'h':_0x39c07d,'fn':_0x7c54a2,'pad':_0x38da72});}",
    "{const _psK=window.PSUiScale?window.PSUiScale.buttonScale():1;_0x12e847['push']({'x':_0x22e037*_psK,'y':_0x427dde*_psK,'w':_0x5685dd*_psK,'h':_0x39c07d*_psK,'fn':_0x7c54a2,'pad':_0x38da72*_psK});}"]
];

function patch(source, patches = PATCHES) {
  let out = source;
  for (const [before, after] of patches) {
    const count = out.split(before).length - 1;
    if (count === 1) out = out.replace(before, () => after);
    else if (count === 0 && out.includes(after)) continue;
    else throw new Error(`Engine anchor ${count ? 'is not unique' : 'not found'}: ${before.slice(0, 100)}`);
  }
  return out;
}

function patchFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  const next = patch(source);
  if (next !== source) fs.writeFileSync(file, next);
  console.log((next === source ? 'Already patched: ' : 'Patched: ') + file);
  return next !== source;
}

module.exports = { PATCHES, patch, patchFile };
if (require.main === module) patchFile(process.argv[2] || path.join(__dirname, '..', 'js', 'app.min.js'));
