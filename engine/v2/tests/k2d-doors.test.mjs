// The doors of D39 and D40. Written before the engine work, each test failing first (as B1b's).
// - D39: an outside add-on may add a control kind, a binding channel and a clip track channel, each named
//   <add-on id>.<name> and needing the add-on in needs. The door gets the hooks to run them: a control's input and its
//   accessibility, a channel's range proof and writer. The door stays frozen, with listed functions only.
// - D40: the host hands in a picture for a picture place while the page runs (player.picture). The engine checks its
//   type (PNG, JPEG, WebP), its bytes and its size; a picture place shows it. Never SVG or code.
// The worked example is engine/v2/addons/examples/doors (example.steps and example.sway). Fast: no browser.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { folderSource, loadExperience } from '../src/load.mjs';
import { checkExperience } from '../check/index.mjs';
import { Player } from '../src/story.mjs';
import { Drawing } from '../src/drawing.mjs';
import { modulePort, hostApi } from '../src/host.mjs';
import { unregister } from '../src/capabilities.mjs';
import { registerAddon } from '../src/addon-door.mjs';
import { checkManifest } from '../src/addons.mjs';
import { loadAddons } from '../tools/addons.mjs';
import { checkFolder, pin } from '../tools/addon.mjs';
import { FORMAT } from '../src/limits.mjs';
import { repo, schemas, eq, ok, mapSource } from './helpers.mjs';

const EXAMPLES = path.join(repo, 'engine', 'v2', 'addons', 'examples');
const said = (list) => list.map(d => `${d.code} ${d.path} ${d.message}`).join(' | ');
const codes = (list) => list.map(d => `${d.code} ${d.path}`);

// The doors example, copied outside the engine and pinned. edit(scene, experience) changes it first.
async function outside(edit = null) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-k2d-'));
  fs.cpSync(path.join(EXAMPLES, 'addons'), path.join(dir, 'addons'), { recursive: true });
  fs.cpSync(path.join(EXAMPLES, 'doors'), path.join(dir, 'doors'), { recursive: true });
  const exp = path.join(dir, 'doors');
  if (edit) {
    const sf = path.join(exp, 'scenes', 'yard', 'scene.json'); const ef = path.join(exp, 'experience.json');
    const s = JSON.parse(fs.readFileSync(sf, 'utf8')); const e = JSON.parse(fs.readFileSync(ef, 'utf8'));
    edit(s, e, dir);
    fs.writeFileSync(sf, JSON.stringify(s, null, 2)); fs.writeFileSync(ef, JSON.stringify(e, null, 2));
  }
  await pin(exp);
  return { dir, exp };
}
const check = async (dir) => checkExperience(await folderSource(dir), schemas());
// Plays the doors example in Node with its add-ons' real code. Returns {p, d, node, done}; done() unregisters them.
async function play(edit = null) {
  const { exp } = await outside(edit);
  const r = await check(exp);
  const loaded = await loadAddons(await folderSource(exp), r.experience, { allow: Object.keys(r.experience.addons || {}) });
  const lock = Object.fromEntries(loaded.map(a => [a.pinned, a.digest]));
  const p = new Player(r.experience, { capabilities: Object.fromEntries(loaded.map(a => [a.id, modulePort({ lock })])) });
  const done = () => { for (const a of loaded) unregister(a.id); };
  return { p, r, done };
}
const drawn = (p) => { const d = new Drawing(p); d.mountScene('yard'); d.paint(); return { d, node: (id) => d.frames.yard.byLocal.get(id) }; };
const rotation = (n) => { const m = /rotate\(([-\d.e]+)\)/.exec(n?.attrs.transform || ''); return m ? Number(m[1]) : 0; };

// A made-up outside capability with every D39 word, for door tests.
const DIGEST = ['sha256', ':', 'c'.repeat(64)].join('');
const growth = (id, adds = {}) => ({ door: 2, id, version: '1.0.0', kind: 'capability', title: 'Growth', adds: {
  controls: { stepper: { role: 'spinbutton', gestures: ['press', 'up', 'down'] } },
  paints: { swing: { value: { type: 'number', minimum: -1, maximum: 1 }, onto: ['rotate'] } },
  ...adds,
} });
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hsvg-version="2.0"><path id="flag" data-hsvg-kind="part" data-hsvg-pivot="0 0" data-hsvg-motion="rotate -20..20" d="M0 0 L10 0 L0 10 Z"/><g id="dial" data-hsvg-kind="part"><rect width="10" height="10"/></g></svg>';
// An engine with the made-up add-on, its install given by hooks(door); scene keys added.
function mount(id, hooks, scene = {}, m = growth(id)) {
  registerAddon({ manifest: m, digest: DIGEST, code: { install: (d) => (typeof hooks === 'function' ? hooks(d) : hooks) } });
  const exp = {
    doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', needs: [`${id}@1.0.0`], about: { trust: { pins: { [`${id}@1.0.0`]: DIGEST } } }, story: { start: 'one', scenes: { one: 'one.json' } } },
    words: { en: {} }, data: {},
    scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg', values: { n: { type: 'number', initial: 1, minimum: 0, maximum: 5 }, other: { type: 'number', initial: 0, minimum: 0, maximum: 9 } }, ...scene }, words: {}, drawings: { main: { text: svg } } } },
    blocks: {}, limits: { ...FORMAT },
  };
  const p = new Player(exp, { epochMs: 0, capabilities: { [id]: modulePort({ lock: { [`${id}@1.0.0`]: DIGEST } }) } });
  return p;
}
const stepper = (id) => ({ controls: { s: { kind: `${id}.stepper`, target: 'dial', value: 'n', label: 'N', event: 'stepped' } } });

// ---- pictures (D40): the smallest headers that say a type and a size ----
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16le = (n) => [n & 255, (n >>> 8) & 255];
const PNG = (w, h) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...u32(w), ...u32(h), 8, 6, 0, 0, 0, 0, 0, 0, 0]);
const JPEG = (w, h) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, (h >> 8) & 255, h & 255, (w >> 8) & 255, w & 255, 1, 1, 0x11, 0, 0xff, 0xd9]);
const WEBP = (w, h) => new Uint8Array([0x52, 0x49, 0x46, 0x46, 30, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58, 10, 0, 0, 0, 0, 0, 0, 0, ...u16le(w - 1), 0, ...u16le(h - 1), 0]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const pictureFiles = () => ({
  'experience.json': {
    format: 'hsvg/2.0', kind: 'experience', id: 'frame', language: 'en',
    inputs: { photo: { kind: 'content', type: 'string', contentType: 'picture', maxLength: 48, initial: 'drawn' }, caption: { kind: 'content', type: 'string', maxLength: 40, initial: 'Hello' } },
    story: { start: 'wall', scenes: { wall: 'scenes/wall/scene.json' }, ends: ['wall'] },
  },
  'scenes/wall/scene.json': { format: 'hsvg/2.0', kind: 'scene', id: 'wall', drawing: 'wall.svg', bindings: [{ target: 'photo', variant: 'photo', as: 'picture' }] },
  'scenes/wall/wall.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>Frame</title><image id="photo" data-hsvg-kind="part" x="20" y="20" width="160" height="120" preserveAspectRatio="xMidYMid slice" href="data:image/png;base64,iVBORw0KGgo="/></svg>',
});
function pictured() {
  const loaded = loadExperience(mapSource(pictureFiles()), schemas());
  ok(loaded.experience, said(loaded.diags));
  const p = new Player(loaded.experience, {});
  ok(p.start().ok);
  const host = hostApi(p);
  const d = new Drawing(p); d.mountScene('wall'); d.paint();
  return { p, host, d, photo: () => { d.paint(); return d.frames.wall.byLocal.get('photo').attrs.href; } };
}
const refusal = (fn) => { try { fn(); return null; } catch (e) { return e; } };

export const tests = {
  // ---------- D39: the manifest ----------
  'D39: a door 2 manifest may add controls and paints; each is checked and says the fix'() {
    eq(checkManifest(growth('acme.grow')), [], 'controls and paints are door 2 words');
    const bad = (adds) => checkManifest(growth('acme.grow', adds)).map(f => `${f.code} ${f.path} ${f.message}`).join(' | ');
    ok(/E-ADDON adds\.controls\.stepper\.role .*button.*spinbutton/.test(bad({ controls: { stepper: { role: 'link', gestures: ['press'] } } })), bad({ controls: { stepper: { role: 'link', gestures: ['press'] } } }));
    ok(/E-ADDON adds\.controls\.stepper\.gestures .*press, up, down/.test(bad({ controls: { stepper: { role: 'button', gestures: ['swipe'] } } })), 'an unknown gesture');
    ok(/E-ADDON adds\.controls\.Stepper /.test(bad({ controls: { Stepper: { role: 'button', gestures: ['press'] } } })), 'a kind name is small letters and dashes');
    ok(/E-ADDON adds\.paints\.swing\.value .*minimum.*maximum/.test(bad({ paints: { swing: { value: { type: 'number' }, onto: ['rotate'] } } })), 'a channel value needs its range');
    ok(/E-ADDON adds\.paints\.swing\.onto .*x, y, rotate, scale, opacity/.test(bad({ paints: { swing: { value: { type: 'number', minimum: 0, maximum: 1 }, onto: ['transform'] } } })), 'onto names part channels');
    const one = checkManifest({ ...growth('acme.grow'), door: 1 });
    ok(one.some(f => f.code === 'E-CAPABILITY-FORMAT' && f.path === 'adds.controls'), said(one));
  },

  // ---------- D39: the checker ----------
  async 'D39: the doors example checks clean, in place and from outside the engine'() {
    eq(checkFolder(path.join(EXAMPLES, 'addons', 'example.steps')), []);
    eq(checkFolder(path.join(EXAMPLES, 'addons', 'example.sway')), []);
    eq(said((await check(path.join(EXAMPLES, 'doors'))).diags), '');
    const { exp } = await outside();
    eq(said((await check(exp)).diags), '');
  },
  async 'D39: a kind or channel the add-on does not declare is E-ADDON, and names what it declares'() {
    const { exp } = await outside((s) => {
      s.controls.wind.kind = 'example.steps.spinner';
      s.bindings[0] = { target: 'flag', 'example.sway.sway': 'wind / 5' };
      s.clips.blow.tracks[0].channel = 'example.sway.wobble';
    });
    const d = (await check(exp)).diags.filter(x => x.code.startsWith('E-'));
    eq(codes(d).sort(), ['E-ADDON bindings[0].example.sway.sway', 'E-ADDON clips.blow.tracks[0].channel', 'E-ADDON controls.wind.kind'], said(d));
    ok(d.find(x => x.path === 'controls.wind.kind').message.includes('example.steps.stepper'), said(d));
    ok(d.find(x => x.path === 'bindings[0].example.sway.sway').message.includes('example.sway.swing'), said(d));
  },
  async 'D39: each slot needs its add-on in needs'() {
    const { exp } = await outside((s, e) => { e.needs = []; });
    const d = (await check(exp)).diags;
    for (const at of ['controls.wind.kind', 'bindings[0].example.sway.swing', 'clips.blow.tracks[0].channel']) ok(d.some(x => x.code === 'E-NEEDS-MISSING' && x.path === at), `${at}: ${said(d)}`);
  },
  async 'D39: the range proof: a formula or a key that can leave the channel\'s range is E-RANGE'() {
    const { exp } = await outside((s) => {
      s.bindings[0]['example.sway.swing'] = 'wind';
      s.clips.blow.tracks[0].keys[1] = [300, 2];
    });
    const d = (await check(exp)).diags;
    ok(d.some(x => x.code === 'E-RANGE' && /^\/?bindings[/[]0/.test(x.path) && x.message.includes('-1..1')), said(d));
    ok(d.some(x => x.code === 'E-RANGE' && /^\/?clips[/.]blow[/.]tracks[/[]0\]?[/.]keys[/[]1/.test(x.path)), said(d));
  },
  async 'D39: a channel onto a part with no drawn range for it is E-ADDON (the writer stays inside the drawing)'() {
    const { exp } = await outside((s, e, dir) => {
      const f = path.join(dir, 'doors', 'scenes', 'yard', 'yard.svg');
      fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('id="flag" data-hsvg-kind="part" data-hsvg-pivot="104 64" data-hsvg-motion="rotate -20..20"', 'id="flag" data-hsvg-kind="part" data-hsvg-pivot="104 64"'));
    });
    const d = (await check(exp)).diags;
    ok(d.some(x => x.code === 'E-ADDON' && x.path === 'bindings[0].example.sway.swing' && x.message.includes('rotate')), said(d));
  },

  async 'D39: an add-on channel writes the part channels onto lists: a core binding of the same channel is E-WRITER'() {
    const { exp } = await outside((s) => { s.bindings.push({ target: 'flag', rotate: 'wind' }); });
    const d = (await check(exp)).diags;
    ok(d.some(x => x.code === 'E-WRITER' && x.message.includes('rotate of flag')), said(d));
    const t = await outside((s) => { s.clips.blow.tracks.push({ target: 'flag', channel: 'rotate', keys: [[0, 0], [1200, 0]] }); });
    const d2 = (await check(t.exp)).diags;
    ok(d2.some(x => x.code === 'E-WRITER' && x.message.includes('rotate of flag')), said(d2));
  },

  // ---------- D39: the engine ----------
  async 'D39: a control kind: a gesture runs the add-on\'s input; the value is written and checked'() {
    const { p, done } = await play();
    try {
      ok(p.start().ok);
      eq(p.read('yard', 'wind'), 1);
      ok(p.activate('yard', 'wind', 'up').ok); eq(p.read('yard', 'wind'), 2);
      ok(p.activate('yard', 'wind', 'down').ok); ok(p.activate('yard', 'wind', 'down').ok); ok(p.activate('yard', 'wind', 'down').ok);
      eq(p.read('yard', 'wind'), 0, 'down stops at the minimum');
      for (let i = 0; i < 5; i++) ok(p.activate('yard', 'wind', 'press').ok);
      eq(p.read('yard', 'wind'), 5);
      ok(p.activate('yard', 'wind', 'press').ok);
      eq(p.read('yard', 'wind'), 0, 'a press at the maximum wraps round');
    } finally { done(); }
  },
  async 'D39: a control\'s accessibility: the manifest\'s role, the hook\'s valueText, the value and its bounds'() {
    const { p, done } = await play();
    try {
      ok(p.start().ok);
      eq(p.controlAccess('yard', 'wind'), { role: 'spinbutton', valueText: '1 of 5', valueNow: 1, valueMin: 0, valueMax: 5, gestures: ['press', 'up', 'down'] });
      eq(p.controlAccess('yard', 'gust'), null, 'a core kind is the page\'s own');
    } finally { done(); }
  },
  'D39 security: a gesture the manifest does not list never reaches the hook; a value out of bounds rolls back'() {
    const seen = [];
    const hooks = { controls: { stepper: { input: (a, c, g) => { seen.push(g); return g === 'up' ? 9 : 2; }, access: () => ({}) } } };
    let p = mount('acme.steps1', hooks, stepper('acme.steps1'));
    try {
      ok(p.start().ok);
      const r = p.activate('one', 's', 'swipe');
      ok(!r.ok && r.fault.code === 'E-ADDON' && r.fault.message.includes('press, up, down'), JSON.stringify(r));
      eq(seen, [], 'the hook did not run');
      eq(p.read('one', 'n'), 1, 'nothing was written');
    } finally { unregister('acme.steps1'); }
    p = mount('acme.steps1', hooks, stepper('acme.steps1'));
    try {
      ok(p.start().ok);
      const big = p.activate('one', 's', 'up');
      ok(!big.ok && big.fault.code === 'E-RANGE', JSON.stringify(big));
      eq(p.read('one', 'n'), 1, 'nothing was written');
    } finally { unregister('acme.steps1'); }
  },
  'D39 security: the input hook gets frozen copies, no prototype on the control, and writes only through its answer'() {
    let got = null;
    const p = mount('acme.steps2', (door) => ({ controls: { stepper: { input: (a, c, g) => { got = { a, c, g, door }; try { c.value = 'other'; } catch { /* frozen */ } return 3; }, access: () => ({}) } } }), stepper('acme.steps2'));
    try {
      ok(p.start().ok);
      ok(p.activate('one', 's', 'press').ok);
      ok(Object.isFrozen(got.c) && Object.getPrototypeOf(got.c) === null, 'a frozen copy with no prototype');
      eq(got.c.value, 'n');
      eq(p.read('one', 'n'), 3); eq(p.read('one', 'other'), 0, 'only the control\'s own value was written');
      eq(Object.keys(got.door).sort(), ['def', 'emit', 'entryKey', 'fault', 'id', 'now', 'read', 'settings', 'timers', 'write'], 'the door is the same list');
    } finally { unregister('acme.steps2'); }
  },
  'D39 security: an access answer is cleaned: only valueText (plain text, at most 200 characters) is kept'() {
    const answers = [{ valueText: 'three', role: 'link', onclick: 'x' }, { valueText: 'x'.repeat(201) }, { valueText: 7 }, null];
    let i = 0;
    const p = mount('acme.steps3', { controls: { stepper: { input: () => 1, access: () => answers[i] } } }, stepper('acme.steps3'));
    try {
      ok(p.start().ok);
      const a = p.controlAccess('one', 's');
      eq([a.role, a.valueText, 'onclick' in a], ['spinbutton', 'three', false]);
      for (i = 1; i < answers.length; i++) eq(p.controlAccess('one', 's').valueText, null, `answer ${i}`);
    } finally { unregister('acme.steps3'); }
  },
  async 'D39: a binding channel paints through the writer; a clip track paints during its clip'() {
    const { p, done } = await play();
    try {
      ok(p.start().ok);
      const { d, node } = drawn(p);
      eq(rotation(node('flag')), 4, 'wind 1: swing 0.2, rotate 4');
      ok(p.activate('yard', 'wind', 'up').ok); d.paint();
      eq(rotation(node('flag')), 8);
      eq(rotation(node('pennant')), 0, 'the pennant rests');
      ok(p.activate('yard', 'gust').ok);
      p.advance(300); d.paint();
      eq(rotation(node('pennant')), 20, 'at 300 ms the gust swings it right');
    } finally { done(); }
  },
  'D39 security: a value outside the channel\'s range stops before the writer; a writer answer outside onto is refused'() {
    const seen = [];
    const run = (id, writer, value) => {
      const p = mount(id, { paints: { swing: (v) => { seen.push(v); return writer(v); } } }, { bindings: [{ target: 'flag', [`${id}.swing`]: value }] });
      try {
        ok(p.start().ok);
        const d = new Drawing(p); d.mountScene('one'); d.paint();
        return { faults: d.faults.map(f => `${f.code} ${f.message}`), flag: d.frames.one.byLocal.get('flag') };
      } finally { unregister(id); }
    };
    const out = run('acme.sw1', () => ({ rotate: 5 }), '3');
    ok(out.faults.some(f => f.startsWith('E-RANGE')), out.faults.join(' | '));
    eq(seen, [], 'the writer did not run');
    const side = run('acme.sw2', () => ({ rotate: 5, opacity: 0 }), '0.5');
    ok(side.faults.some(f => f.startsWith('E-ADDON') && f.includes('opacity')), side.faults.join(' | '));
    const nan = run('acme.sw3', () => ({ rotate: NaN }), '0.5');
    ok(nan.faults.some(f => f.startsWith('E-ADDON')), nan.faults.join(' | '));
    const far = run('acme.sw4', () => ({ rotate: 400 }), '1');
    eq(far.faults, []);
    eq(rotation(far.flag), 20, 'kept inside the drawn range rotate -20..20');
  },
  'D39 security: only controls and channels the manifest lists are taken from the hooks'() {
    const p = mount('acme.sw5', { controls: { stepper: { input: () => 2, access: () => ({}) }, sneak: { input: () => 4 } }, paints: { swing: () => ({}), sneak: () => ({ opacity: 0 }) } }, stepper('acme.sw5'));
    try {
      ok(p.start().ok);
      const c = p.caps.list.find(x => x.id === 'acme.sw5');
      eq(Object.keys(c.controls), ['acme.sw5.stepper']);
      eq(Object.keys(c.paints), ['acme.sw5.swing']);
    } finally { unregister('acme.sw5'); }
  },

  // ---------- D40: host pictures ----------
  'D40: player.picture checks a PNG, JPEG or WebP and the picture place shows it'() {
    const { host, p, photo } = pictured();
    const before = photo();
    ok(before.startsWith('data:image/png;base64,iVBOR'), before);
    host.picture('photo', PNG(64, 48), 'image/png');
    eq(p.read('experience', 'photo'), 'host:photo', 'the input names the host picture');
    ok(photo().startsWith('data:image/png;base64,'), photo());
    ok(photo() !== before, 'the place shows the handed-in picture');
    host.picture('photo', JPEG(800, 600), 'image/jpeg');
    ok(photo().startsWith('data:image/jpeg;base64,/9j/'), photo());
    host.picture('photo', WEBP(320, 200), 'image/webp');
    ok(photo().startsWith('data:image/webp;base64,UklGR'), photo());
    eq(host.read('photo'), 'host:photo');
  },
  'D40: SVG, a type the bytes do not show, too many bytes or pixels, and an input that is not a picture are refused'() {
    const { host, p, photo } = pictured();
    const keep = photo();
    const code = (fn) => refusal(fn)?.code ?? 'taken';
    eq(code(() => host.picture('photo', SVG, 'image/svg+xml')), 'E-HOST-PICTURE', 'never SVG');
    eq(code(() => host.picture('photo', SVG, 'image/png')), 'E-HOST-PICTURE', 'SVG named as PNG');
    eq(code(() => host.picture('photo', new TextEncoder().encode('<html><script>x</script></html>'), 'text/html')), 'E-HOST-PICTURE', 'never code');
    eq(code(() => host.picture('photo', JPEG(10, 10), 'image/png')), 'E-HOST-PICTURE', 'the bytes are a JPEG, not a PNG');
    eq(code(() => host.picture('photo', PNG(5000, 5000), 'image/png')), 'E-HOST-PICTURE', 'over imagePixelsEach');
    const huge = new Uint8Array(FORMAT.imageBytesEach + 1); huge.set(PNG(10, 10));
    eq(code(() => host.picture('photo', huge, 'image/png')), 'E-HOST-PICTURE', 'over imageBytesEach');
    eq(code(() => host.picture('photo', 'iVBORw0KGgo=', 'image/png')), 'E-HOST-PICTURE', 'bytes, not text');
    eq(code(() => host.picture('caption', PNG(10, 10), 'image/png')), 'E-TYPE', 'caption holds words, not a picture');
    eq(code(() => host.picture('nothing', PNG(10, 10), 'image/png')), 'E-REF-UNKNOWN');
    eq(code(() => host.set('photo', 'host:photo')), 'E-TYPE', 'only picture() names a host picture');
    eq(p.read('experience', 'photo'), 'drawn', 'nothing changed');
    eq(photo(), keep);
  },
  'D40: the bytes are copied at the call; changing them after does not change the picture'() {
    const { host, photo } = pictured();
    const bytes = PNG(64, 48);
    host.picture('photo', bytes, 'image/png');
    const shown = photo();
    bytes.fill(0);
    eq(photo(), shown);
  },

  // ---------- D40: the spec ----------
  'D40: the spec plans no bridge; runtime import is outside the standard'() {
    const read = (f) => fs.readFileSync(path.join(repo, 'spec', '2.0', f), 'utf8');
    for (const f of ['10-hosts-and-delivery.md', '12-writing-an-addon.md', 'reference/a10-hosts-and-packages.md']) ok(!/bridge/i.test(read(f).replace(/abridged/g, '')), `${f} still names the bridge`);
    ok(/runtime import[^.]*outside the standard/i.test(read('10-hosts-and-delivery.md')), '10.6 says runtime import is outside the standard');
    ok(read('10-hosts-and-delivery.md').includes('player.picture('), '10.6 shows player.picture');
  },
};
