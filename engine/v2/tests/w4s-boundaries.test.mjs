// Checks at the boundaries. Ambient settings are checked (5.5, 9.10); a missing use stops play (9.2);
// the owned fields are generated (10.11); needs is the union (10.11); a capability gets a door, not the engine
// (10.11, principle 4); mount() checks what it is given (10.6, 10.12).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pack } from '../tools/pack.mjs';
import { Player } from '../src/story.mjs';
import { OWNED_FIELDS, OWNED_EFFECT_KINDS, packageNeeds, capabilityNames } from '../src/capabilities.mjs';
import { target as capsFile, ownedFile, addonsHeld } from '../tools/make-owned.mjs';
import { mount } from '../web/mount-web.mjs';
import { sha256 } from '../src/members.mjs';
import { repo, schemas, eq, ok } from './helpers.mjs';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g id="sky" data-hsvg-kind="part"></g></svg>';
// One scene a with the given body; blocks: {id: doc}.
const make = (scene, { needs = [], blocks = {}, modules, sceneNeeds } = {}) => new Player({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', needs, story: { start: 'a', scenes: { a: 'a.json' } } },
  words: { en: {} }, data: {},
  blocks: Object.fromEntries(Object.entries(blocks).map(([id, doc]) => [id, { file: `${id}.json`, doc: { format: 'hsvg/2.0', kind: 'block', id, ...doc }, drawings: {}, words: {} }])),
  scenes: { a: { file: 'a.json', doc: { format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg', ...(sceneNeeds ? { needs: sceneNeeds } : {}), values: { log: { type: 'string', initial: '' } }, ...scene },
    drawings: { main: { file: 'a.svg', text: SVG } }, words: {} } },
}, modules === undefined ? {} : { modules });
const press = (actions) => ({ on: { 'press:go': [{ id: 'go', actions }] } });

export const tests = {
  'a setting of volume is checked for type: "very" faults with E-TYPE and writes nothing'() {
    const p = make(press([{ id: 's', call: 'player.setting', with: {volume: '"very"'} }]));
    ok(p.start().ok);
    const r = p.send('a', 'press:go', {}, 'person');
    eq(r.fault?.code, 'E-TYPE');
    eq(p.state.ambient.volume, 1, 'the volume is unchanged');
  },
  'a setting of volume is checked for range: 2 faults with E-RANGE; 0.5 is written'() {
    const high = make(press([{ id: 's', call: 'player.setting', with: {volume: '2'} }]));
    ok(high.start().ok);
    eq(high.send('a', 'press:go', {}, 'person').fault?.code, 'E-RANGE');
    const fine = make(press([{ id: 's', call: 'player.setting', with: {volume: '0.5'} }]));
    ok(fine.start().ok);
    ok(fine.send('a', 'press:go', {}, 'person').ok);
    eq(fine.state.ambient.volume, 0.5);
  },
  'a setting of muted or voice must be a boolean'() {
    for (const name of ['muted', 'voice']) {
      const p = make(press([{ id: 's', call: 'player.setting', with: { [name]: '1' } }]));
      ok(p.start().ok);
      eq(p.send('a', 'press:go', {}, 'person').fault?.code, 'E-TYPE', name);
      const good = make(press([{ id: 's', call: 'player.setting', with: { [name]: 'true' } }]));
      ok(good.start().ok);
      ok(good.send('a', 'press:go', {}, 'person').ok, name);
      eq(good.state.ambient[name], true, name);
    }
  },
  'a settings form checks the ambient items the same way'() {
    const p = make({});
    ok(p.start().ok);
    eq(p.applySettings([['volume', 'loud']]).fault?.code, 'E-TYPE');
    eq(p.applySettings([['volume', -0.1]]).fault?.code, 'E-RANGE');
    eq(p.applySettings([['muted', 'yes']]).fault?.code, 'E-TYPE');
    ok(p.applySettings([['volume', 0.25]]).ok);
    eq(p.state.ambient.volume, 0.25);
  },
  'a use whose block is not defined stops play with E-REF-UNKNOWN'() {
    const p = make({ uses: [{ id: 'badge', use: 'missing-badge' }] });
    const r = p.start();
    eq(r.fault?.code, 'E-REF-UNKNOWN');
    ok(/missing-badge/.test(r.fault.message), r.fault.message);
    eq(p.notes?.filter(n => n.kind === 'use-skipped') ?? [], [], 'no note: it is a fault');
  },
  'a use whose block is defined still mounts'() {
    const p = make({ uses: [{ id: 'badge', use: 'badge' }] }, { blocks: { badge: { values: { n: { type: 'number', initial: 1 } } } } });
    ok(p.start().ok, p.lastFault?.message);
    ok(p.state.blocks['a/badge'], 'the use is mounted');
  },
  'OWNED_FIELDS is the part made from spec/2.0/capabilities.json (run tools/make-owned.mjs)'() {
    if (!addonsHeld()) return; // the core release holds no built-in add-on: the hypersvg-addons release checks the part
    const text = fs.readFileSync(capsFile, 'utf8');
    ok(text === ownedFile(text), 'engine/v2/src/capabilities.mjs is stale: run engine/v2/tools/make-owned.mjs');
    eq(OWNED_FIELDS.physics, undefined, 'physics settings are addons.physics, the door for built-ins (D28)');
    eq(OWNED_FIELDS.slots, undefined, 'slots and hideSlots are core (D31.2); the widgets add-on owns addons.widgets');
    eq(OWNED_EFFECT_KINDS.particles, undefined, 'particles are addons.effects.particles (D31)');
    eq([OWNED_FIELDS.audioMouth, OWNED_FIELDS.audioSynths], [undefined, undefined], 'the mouth is addons.synth.mouth and made sounds are core (D31.2)');
    eq(OWNED_FIELDS.play, undefined, 'seats settings are addons.seats, the door for built-ins (D31)');
  },
  'a field from the generated table without its capability: E-NEEDS-MISSING naming the capability'() {
    const r = make({ addons: { effects: { particles: { pop: { target: 'sky', source: 'sky', seed: 1, count: 1, reducedMotion: 'rest' } } } } }).start();
    eq(r.fault?.code, 'E-NEEDS-MISSING');
    ok(/effects capability/.test(r.fault.message), r.fault.message);
  },
  'whose needs: the union of the experience, its scenes, its shell and its blocks (10.11 needs rule 1)'() {
    const exp = { doc: { needs: ['synth', 'font:Inter'] }, scenes: { a: { doc: { needs: ['snapshot'] } } }, shell: { doc: { needs: ['shell'] } },
      blocks: { b: { doc: { needs: ['physics', 'chess@0.1.0', 'synth'] } } } };
    eq(packageNeeds(exp), ['synth', 'font:Inter', 'snapshot', 'shell', 'physics', 'chess@0.1.0']);
    eq(capabilityNames(packageNeeds(exp)), ['synth', 'snapshot', 'shell', 'physics', 'chess']);
  },
  'the engine installs a capability that only a scene or a block names in its needs'() {
    const shot = { controls: { save: { kind: 'button', target: 'sky', label: 'Save' } }, addons: { snapshot: { saves: { sky: { as:'picture', variant: 'sky', filename: 'a.png', pixelWidth: 100 } } } },
      on: { 'press:sky': [{ actions: [{ call: 'snapshot.save', with: { save: "'sky'" } }] }] } };
    const p = make(shot, { sceneNeeds: ['snapshot'] });
    eq(p.caps.ids, ['snapshot']);
    ok(p.start().ok);
    ok(p.activate('a', 'save').ok, 'the snapshot control runs');
    const physics = { bodies: { b: { target: 'sky', shape: { kind: 'box', width: 10, height: 10 }, rest: [0, 0] } } };
    const byBlock = make({}, { blocks: { ball: { needs: ['physics'], addons: { physics } } } });
    eq(byBlock.caps.ids, ['physics'], 'a block definition\'s needs count');
  },
  async 'the packer bundles and declares the union of needs'() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w4s-needs-'));
    const src = path.join(dir, 'exp'); const out = path.join(dir, 'out');
    try {
      fs.cpSync(path.join(repo, 'engine', 'v2', 'tests', 'pack-fixture'), src, { recursive: true });
      const file = path.join(src, 'scenes', 'one', 'scene.json');
      const scene = JSON.parse(fs.readFileSync(file, 'utf8'));
      scene.needs = ['snapshot'];
      scene.values.status = { type: 'string', initial: '', maxLength: 200 };
      scene.controls.save = { kind: 'button', target: 'button', label: 'Save' };
      scene.addons = { snapshot: { saves: { one: { picture: 'bg', filename: 'one.png', pixelWidth: 200, status: 'status' } } } };
      scene.on = { ...(scene.on || {}), 'press:button': [{ actions: [{ call: 'snapshot.save', with: { save: "'one'" } }] }] };
      fs.writeFileSync(file, JSON.stringify(scene));
      const r = await pack(src, out);
      eq(r.capabilities, ['snapshot'], 'the scene\'s need selects its module');
      eq(JSON.parse(fs.readFileSync(r.packagePath, 'utf8')).needs, ['snapshot'], 'package.json needs is the union');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  },
  'a capability gets a door, not the engine: copies to read, frozen documents, no state'() {
    let door = null;
    const spy = { id: 'spy', install(d) { door = d; return {}; } };
    const p = make({ values: { log: { type: 'string', initial: '', maxLength: 5 } } }, { needs: ['spy'], modules: [spy] });
    ok(p.start().ok);
    ok(door && door.id === 'spy');
    ok(Object.isFrozen(door), 'the door is frozen');
    for (const k of ['state', 'exp', 'defs', 'queue', 'transaction_', 'caps']) ok(!(k in door), `the door has no ${k}`);
    ok(Object.isFrozen(door.def('a')) && Object.isFrozen(door.experience), 'documents are frozen copies');
    let threw = false; try { door.def('a').values.log.maxLength = 99; } catch { threw = true; }
    ok(threw, 'a capability cannot change a document');
    eq(p.def('a').values.log.maxLength, 5);
  },
  'a capability not named in needs never installs'() {
    let installed = false;
    const spy = { id: 'spy', install() { installed = true; return {}; } };
    const p = make({}, { needs: [], modules: [spy] });
    ok(p.start().ok);
    ok(!installed);
    eq(p.caps.ids, []);
  },
  'door.write is a checked set: type and bounds refuse, a good write queues changed:'() {
    let door = null;
    const spy = { id: 'spy', install(d) { door = d; return { actions: { spyWrite: (address, a) => door.write(address, 'n', a.spyWrite) } }; } };
    const scene = { values: { n: { type: 'number', initial: 0, minimum: 0, maximum: 3 }, log: { type: 'string', initial: '', maxLength: 50 } },
      on: { 'press:hi': [{ id: 'h', actions: [{ id: 'w', spyWrite: 9 }] }], 'press:ok': [{ id: 'o', actions: [{ id: 'w', spyWrite: 2 }] }],
        'press:str': [{ id: 's', actions: [{ id: 'w', spyWrite: 'two' }] }], 'changed:n': [{ id: 'c', actions: [{ id: 'l', set: 'log', to: "log + 'changed '" }] }] } };
    const p = make(scene, { needs: ['spy'], modules: [spy] });
    ok(p.start().ok);
    eq(p.send('a', 'press:hi').fault?.code, 'E-RANGE');
    p.stopped = null; // a control fault stops play (X3): the next case on the same engine
    eq(p.send('a', 'press:str').fault?.code, 'E-TYPE');
    p.stopped = null;
    ok(p.send('a', 'press:ok').ok);
    eq([p.read('a', 'n'), p.read('a', 'log')], [2, 'changed ']);
    let refused = null; try { door.write('a', 'log', 'x'); } catch (e) { refused = e; }
    ok(refused, 'a write outside a transaction is refused by the core, as any write is');
  },
  'door.write cannot write an input; own state rolls back with a fault'() {
    let door = null;
    const spy = { id: 'spy', install(d) { door = d; return { actions: {
      spyIn: (address) => door.write(address, 'shown', true),
      spyOwn: (address) => { door.setOwn(address, { n: 1 }); door.fault('E-RANGE', 'after the write', address); },
    } }; } };
    const p = make({ inputs: { shown: { kind: 'content', type: 'boolean', initial: false } },
      on: { 'press:in': [{ id: 'i', actions: [{ id: 'w', spyIn: true }] }], 'press:own': [{ id: 'o', actions: [{ id: 'w', spyOwn: true }] }] } }, { needs: ['spy'], modules: [spy] });
    ok(p.start().ok, p.lastFault?.message);
    eq(p.send('a', 'press:in').fault?.code, 'E-WRITE-INPUT');
    p.stopped = null; // a control fault stops play (X3): the next case on the same engine
    eq(p.send('a', 'press:own').fault?.code, 'E-RANGE');
    eq(door.own('a'), undefined, 'the own state rolled back');
  },
  'door: timers are its own, deliveries carry its kind, expose never replaces the engine'() {
    let door = null;
    const spy = { id: 'spy', install(d) { door = d; return { actions: { spyGo: (address) => { door.timers.add(address, door.now() + 10, { bell: 1 }); door.deliver({ kind: 'spy', address }); } }, timer: (t) => door.emit(t.owner, 'rang', {}) }; } };
    const p = make({ on: { 'press:go': [{ id: 'g', actions: [{ id: 'x', spyGo: true }] }], rang: [{ id: 'r', actions: [{ id: 'l', set: 'log', to: "'rang'" }] }] } }, { needs: ['spy'], modules: [spy] });
    ok(p.start().ok);
    const r = p.send('a', 'press:go');
    ok(r.ok);
    eq(r.deliveries.filter(d => d.kind === 'spy').length, 1);
    eq(door.timers.list().length, 1);
    p.advance(20);
    eq(p.read('a', 'log'), 'rang');
    eq(door.transaction('host', () => door.deliver({ kind: 'sound' })).fault?.code, 'E-NEEDS-MISSING', 'another kind is refused');
    let threw = false; try { door.expose('state', {}); } catch { threw = true; }
    ok(threw, 'expose cannot take an engine name');
  },
  'a host plug-in gets a door, and only when needs names it'() {
    let got = null;
    const plug = { actions: ['hostBeep'], run(door, address, a) { got = door; door.emit(address, 'beeped', {}); } };
    const scene = { on: { 'press:go': [{ id: 'g', actions: [{ id: 'b', hostBeep: true }] }], beeped: [{ id: 'r', actions: [{ id: 'l', set: 'log', to: "'beeped'" }] }] } };
    const named = new Player(make(scene, { needs: ['beeper'] }).exp, { capabilities: { beeper: plug } });
    ok(named.start().ok);
    ok(named.send('a', 'press:go').ok);
    ok(got && got.id === 'beeper' && !('state' in got), 'run gets the door');
    eq(named.read('a', 'log'), 'beeped');
    const unnamed = new Player(make(scene).exp, { capabilities: { beeper: plug } });
    ok(unnamed.start().ok);
    eq(unnamed.send('a', 'press:go').fault?.code, 'E-NEEDS-MISSING');
  },
  'no built capability module reaches into the engine'() {
    const dir = path.join(repo, 'engine', 'v2', 'src', 'capabilities');
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.mjs'))) {
      const code = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
      ok(!/\bengine\s*[.[(]/.test(code), `${f} reaches into the engine`);
    }
  },
  'mount checks the package: an hsvg/0.1 file is E-HEADER and the message names the upgrade tool'() {
    const pkg = mountPackage((files) => { files['experience.json'].format = 'hsvg/0.1'; });
    const e = refusal(() => mount(null, pkg, { schemas: schemas() }));
    eq(e?.code, 'E-HEADER');
    ok(/the upgrade tool \(A13\.3/.test(e.message) && /a13-migration\.md/.test(e.message) && /does not upgrade in memory/.test(e.message), e?.message);
  },
  'mount checks every document: an unknown key in a scene stops with its code before play'() {
    const pkg = mountPackage((files) => { files['scenes/a/scene.json'].script = 'alert(1)'; });
    const e = refusal(() => mount(null, pkg, { schemas: schemas() }));
    eq(e?.code, 'E-KEY-UNKNOWN');
    ok(e.diagnostics.some(d => d.file === 'scenes/a/scene.json'), JSON.stringify(e.diagnostics));
  },
  'mount checks drawings too: a script in a drawing is refused'() {
    const pkg = mountPackage((files) => { files['scenes/a/a.svg'] = files['scenes/a/a.svg'].replace('</svg>', '<script>alert(1)</script></svg>'); });
    const e = refusal(() => mount(null, pkg, { schemas: schemas() }));
    ok(e?.code?.startsWith('E-SVG'), `${e?.code} ${e?.message}`);
  },
  'mount without schemas is refused: a mounted package never plays unchecked'() {
    const e = refusal(() => mount(null, mountPackage(), {}));
    ok(e instanceof TypeError && /schemas/.test(e.message), e?.message);
  },
  'a clean package passes the checks at mount (play then needs a page)'() {
    const e = refusal(() => mount(null, mountPackage(), { schemas: schemas() }));
    ok(e && !e.code && /window/.test(e.message), `it failed at the checks: ${e?.code} ${e?.message}`);
  },
};

// A small package as bytes, as mount takes it; change edits the documents first.
function mountPackage(change = () => {}) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hsvg-version="2.0" data-hsvg-kind="screen"><rect id="a-bg" width="100" height="100" fill="#ddd" data-hsvg-layer="backdrop"/></svg>';
  const files = {
    'package.json': { format: 'hsvg/2.0', kind: 'package', id: 'm', experience: 'experience.json', needs: [], members: {} },
    'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'm', story: { start: 'a', scenes: { a: 'scenes/a/scene.json' }, ends: ['a'] } },
    'scenes/a/scene.json': { format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg' },
    'scenes/a/a.svg': svg,
  };
  change(files);
  const enc = new TextEncoder();
  const bytes = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, enc.encode(typeof v === 'string' ? v : JSON.stringify(v))]));
  // The descriptor lists every member with its digest (10.8), as mount checks.
  const desc = files['package.json'];
  desc.members = Object.fromEntries(Object.keys(bytes).filter(k => k !== 'package.json').map(k => [k, sha256(bytes[k])]));
  bytes['package.json'] = enc.encode(JSON.stringify(desc));
  return bytes;
}
function refusal(fn) { try { fn(); return null; } catch (e) { return e; } }
