// One-time, checked codemod for the vendored minified engine. Safe to rerun.
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '..', 'js', 'app.min.js');
let source = fs.readFileSync(file, 'utf8');
function replace(before, after) {
  if (source.split(before).length !== 2) throw new Error('Engine anchor is not unique: ' + before.slice(0, 100));
  source = source.replace(before, after);
}
function section(start, end, replacement) {
  const first = source.indexOf(start), last = source.indexOf(end, first);
  if (first < 0 || last < 0) throw new Error('Engine section not found: ' + start);
  source = source.slice(0, first) + replacement + source.slice(last);
}

if (!source.includes("_0x599208['FIREBASE_CONFIG']=window.PSHosting.firebase")) {
section("_0x599208['FIREBASE_CONFIG']=", ",_0x599208['DB']=", "_0x599208['FIREBASE_CONFIG']=window.PSHosting.firebase");
replace("const _0x46ba70=['pokesurvivor.com','www.pokesurvivor.com','jpter78.github.io','localhost','127.0.0.1'];",
  'const _0x46ba70=window.PSHosting.hosts;');
replace("_0x21307d='jugadores.pokesurvivor.net'", "_0x21307d='players.invalid'");
section("_0x599208['RoomsWS']=", ",_0x599208['Social']=", "_0x599208['RoomsWS']={on:false}");
section("_0x599208['Ranking']=", ",_0x599208['Icons']=", "_0x599208['Ranking']=window.PSHosting.ranking()");
section('function _0xd95b93()', 'function _0x270f95(',
  'function _0x41deff(){return [];}function _0x2fb1a2(){return Promise.resolve([]);}');
section('function _0x22093d(', 'async function _0x1ea1a6(',
  "function _0x22093d(_0x1a7b94){const peer=_0x4a35e6.get(_0x1a7b94);if(!peer||peer.mode==='closed'||peer.mode==='relay')return;clearTimeout(peer.timer);peer.mode='relay';if(peer.pc)peer.pc.close();_0x270f95(_0x1a7b94);}");
replace("_0x34f850&&'start'===_0x34f850['k']&&",
  "_0x34f850&&(_0x395468&&_0x395468.mode==='relay'||_0x34f850.k==='start')&&");
replace("_0x37b994[_0x2ec65e(0x30e)]='failed'", "_0x37b994[_0x2ec65e(0x30e)]='relay'");
replace("function _0x3398dd(){window.PSTraining.install(_0x599208);",
  'function _0x3398dd(){if(!window.PSHosting.install(_0x599208))return;window.PSTraining.install(_0x599208);');
}
if (!source.includes('window.PSHosting.joinRoom(')) {
  replace("'m':{[_0x4174ee]:_0x4f932b()}", "'slots':{0:_0x4174ee},'m':{[_0x4174ee]:_0x4f932b()}");
  replace("'m':_0x1599dc", "'slots':Object.fromEntries([_0x4174ee,...Object.keys(_0x1599dc).filter(uid=>uid!==_0x4174ee)].map((uid,i)=>[i,uid])),'m':_0x1599dc");
  replace("_0x2ab190['rtdb']['ref']('rooms/'+_0x3e6318+'/m/'+_0x4174ee)['set'](_0x4f932b())",
    'window.PSHosting.joinRoom(_0x2ab190.rtdb,_0x3e6318,_0x4174ee,_0x4f932b())');
  replace("_0x407aa3['child']('m/'+_0x4174ee)['set'](Object['assign'](_0x4f932b(),_0x2ba0ea&&_0x2ba0ea['at']?{'at':_0x2ba0ea['at']}:{}))",
    "window.PSHosting.joinRoom(_0x2ab190.rtdb,_0x351611,_0x4174ee,Object.assign(_0x4f932b(),_0x2ba0ea&&_0x2ba0ea.at?{at:_0x2ba0ea.at}:{}))");
  replace("await _0x520138[_0x2b1345(0x4cf)]()['catch'](()=>{})",
    "await (_0x4c0f32.isHost?_0x520138.remove():window.PSHosting.releaseSeat(_0x2ab190.rtdb,_0x4c0f32.id,_0x4174ee))");
  replace("_0x2ab190['rtdb']['ref']('rooms/'+_0x8c5800['id']+'/m/'+_0x5163ac)['remove']()",
    'window.PSHosting.releaseSeat(_0x2ab190.rtdb,_0x8c5800.id,_0x5163ac,false)');
}
if (!source.includes("_0x1ff042.key.slice(0,-3)")) {
  replace("_0x458b34&&_0x458b34['f']&&_0x1a96d0(_0x458b34['f'],_0x3dcc83)",
    "_0x458b34&&_0x458b34.f===_0x1ff042.key.slice(0,-3)&&_0x1a96d0(_0x1ff042.key.slice(0,-3),_0x3dcc83)");
}
if (!source.includes('function _psEnsureHost()')) {
  replace('function _0x3b8c40(',
    "function _psEnsureHost(){if(_0x1b6bb4||!_0x35530f||_0x4a35e6.has(_0x35530f))return;const uid=_0x35530f,peer={pc:null,dc:null,mode:'connecting',timer:0};peer.timer=setTimeout(()=>{if(peer.mode==='connecting'){peer.mode='relay';_0x270f95(uid);}},27000);_0x4a35e6.set(uid,peer);}function _0x3b8c40(");
  section("if(!_0x1b6bb4){const _0x37b994=", 'null===_0x41deff()', '_psEnsureHost();');
  replace('else _0x149ae7[_0x23a1a9(0x5d8)](_0x35530f)||_0x3b8c40(_0x35530f);',
    'else _0x149ae7.includes(_0x35530f)?_psEnsureHost():_0x3b8c40(_0x35530f);');
}
if (!source.includes('window.PSHosting.releaseDepartedSeats(')) {
  replace("const _0x14aae7=_0x8c5800['members'];",
    "const _0x14aae7=_0x8c5800['members'];if(_0x8c5800.isHost&&!_0x3be13a)window.PSHosting.releaseDepartedSeats(_0x2ab190.rtdb,_0xedf679,_0x14aae7,_0x479da1).catch(error=>console.warn('[Hosting] Seat cleanup:',error));");
}
if (!source.includes("'[Net] Inbox unavailable:'")) {
  replace('_0x1a96d0(_0x1ff042.key.slice(0,-3),_0x3dcc83);});_psEnsureHost();',
    "_0x1a96d0(_0x1ff042.key.slice(0,-3),_0x3dcc83);},error=>{console.warn('[Net] Inbox unavailable:',error);_0x5b04c9();});_psEnsureHost();");
}
// Fail before writing anything if the edited bundle is not syntactically valid.
new (require('node:vm').Script)(source);
fs.writeFileSync(file, source);
console.log('Applied independent Firebase hosting hooks.');
