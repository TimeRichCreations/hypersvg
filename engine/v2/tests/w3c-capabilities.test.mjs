// Capabilities ship only when needed (1.1 principle 8, 10.11). The registry (src/capabilities.mjs), its
// hooks, E-NEEDS-MISSING when a capability is not installed, and the modules the packer bundles for each page.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Player as BasePlayer } from '../src/story.mjs';
import { granting } from './helpers.mjs';
const Player = granting(BasePlayer); // a host that gives what the experience asks (D31: no profile, no grant)
import { registered } from '../src/capabilities.mjs';
import { bundle, capabilityModules, pack } from '../tools/pack.mjs';
import { repo, eq, ok } from './helpers.mjs';

const ENTRY = path.join(repo, 'engine', 'v2', 'web', 'packed-entry.mjs');
const CAP_DIR = path.join(repo, 'engine', 'v2', 'src', 'capabilities');
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><g id="dot" data-hsvg-kind="part" data-hsvg-motion="move-x 0..400; move-y 0..400"><circle r="3"/></g></defs><g id="sky" data-hsvg-kind="part"></g><g id="ball" data-hsvg-motion="move-x -20..20; move-y -400..0"><rect width="10" height="10"/></g></svg>';
// One scene a with the given body; needs and modules as given.
const make = (scene, needs, modules) => new Player({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', needs, story: { start: 'a', scenes: { a: 'a.json' } } },
  words: { en: {} }, data: {}, blocks: {},
  scenes: { a: { file: 'a.json', doc: { format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg', values: { log: { type: 'string', initial: '' } }, ...scene },
    drawings: { main: { file: 'a.svg', text: SVG } }, words: {} } },
}, modules === undefined ? {} : { modules });
const press = (actions) => ({ on: { 'press:go': [{ id: 'go', actions }] } });
const physics = { bodies: { b: { target: 'ball', shape: { kind: 'box', width: 10, height: 10 }, rest: [0, 0], gravity: [0, 600] } } };
// A particle effect of addons.effects.particles (D31: entries have no kind).
const particle = { target: 'sky', source: 'dot', seed: 1, count: 2, start: 'play', reducedMotion: 'rest' };
const snapshot = { controls: { save: { kind: 'snapshot', target: 'sky', as:'picture', variant: 'sky', filename: 'a.png', pixelWidth: 100 } } };

// The relative paths of the modules a page bundles for these needs.
const bundled = (needs) => bundle(ENTRY, capabilityModules(needs).map(c => c.file)).files;
const has = (files, rel) => files.includes(rel);

export const tests = {
  'every built capability module registers itself; all.mjs imports each file of src/capabilities'() {
    const files = fs.readdirSync(CAP_DIR).filter(f => f.endsWith('.mjs') && f !== 'all.mjs').sort();
    const all = fs.readFileSync(path.join(CAP_DIR, 'all.mjs'), 'utf8');
    eq(files.filter(f => !all.includes(`'./${f}'`)), [], 'all.mjs misses a module');
    eq([...registered()].filter(([, c]) => !c.module).map(([id]) => id).sort(), files.map(f => f.slice(0, -4)), 'each file registers the id of its name');
  },
  'the core imports no capability module'() {
    const core = bundle(ENTRY).files;
    eq(core.filter(f => f.startsWith('engine/v2/src/capabilities/')), []);
    for (const f of ['engine/v2/src/ai.mjs', 'engine/v2/src/ai-words.mjs', 'engine/v2/web/snapshot-web.mjs', 'engine/v2/web/widgets-web.mjs']) ok(!has(core, f), `${f} is in the core`);
    // What the core keeps of physics.mjs and effects.mjs is the drawing's: motion ranges and particle places.
    const src = (f) => fs.readFileSync(path.join(repo, 'engine', 'v2', 'src', f), 'utf8');
    ok(!/createWorld|function step\b/.test(src('physics.mjs')), 'the physics simulation left the core');
    ok(!/startParticles/.test(src('effects.mjs')), 'starting particles left the core');
  },
  'only capabilities in needs are installed, even when registered'() {
    eq(make({}, []).caps.ids, []);
    eq(make({}, ['effects', 'seats', 'physics']).caps.ids, ['effects', 'seats', 'physics'], 'seats has a module');
    eq(make({}, ['effects', 'remote-seats', 'physics']).caps.ids, ['effects', 'physics'], 'remote-seats has no module: nothing to install');
  },
  'a capability in needs that is not installed: its field, action and control are E-NEEDS-MISSING'() {
    eq(make({ addons: { physics } }, ['physics'], []).start().fault?.code, 'E-NEEDS-MISSING', 'the physics settings');
    eq(make({ addons: { effects: { particles: { pop: { ...particle, start: 'entry' } } } } }, ['effects'], []).start().fault?.code, 'E-NEEDS-MISSING', 'the effects settings');
    const thrown = make(press([{ id: 't', call: 'physics.throw', with: { body: "'b'", vx: 0, vy: -100 } }]), ['physics'], []);
    ok(thrown.start().ok);
    eq(thrown.send('a', 'press:go').fault?.code, 'E-NEEDS-MISSING', 'physics.throw');
    const shot = make(snapshot, ['snapshot'], []);
    ok(shot.start().ok);
    eq(shot.activate('a', 'save').fault?.code, 'E-NEEDS-MISSING', 'snapshot control');
    eq(shot.snapshotStatus, undefined, 'no snapshot status port without the capability');
  },
  'a capability not in needs stays E-NEEDS-MISSING although the dev player registered it'() {
    eq(make({ addons: { physics } }, []).start().fault?.code, 'E-NEEDS-MISSING');
    const thrown = make(press([{ id: 't', call: 'physics.kick', with: { body: "'b'", vx: 0, vy: 1 } }]), []);
    ok(thrown.start().ok);
    eq(thrown.send('a', 'press:go').fault?.code, 'E-NEEDS-MISSING');
    const shot = make(snapshot, []);
    ok(shot.start().ok);
    eq(shot.activate('a', 'save').fault?.code, 'E-NEEDS-MISSING');
  },
  'the interface: actions, controls, timers, mount and entered phases, play and clock phases'() {
    const seen = [];
    const fake = {
      id: 'fake',
      install(door) {
        const { fault } = door;
        return {
          actions: { fakeRing: (address, a, E) => { if (E(a.times) > 3) fault('E-RANGE', 'too many', address); door.timers.add(address, door.now() + 50, { fakeBell: a.fakeRing }); } },
          controls: { fakeKnob: (address, id, c, arg) => door.emit(address, c.event, { arg: String(arg) }) },
          timer: (t) => door.emit(t.owner, `bell:${t.fakeBell}`, {}),
          mount: (address) => seen.push(`mount ${address}`),
          entered: (address) => seen.push(`entered ${address}`),
          play: (address, id) => { if (id !== 'tune') return false; seen.push(`play ${id}`); return true; },
          hold: (address, ms) => seen.push(`hold ${ms}`),
          clock: { begin() { seen.push('begin'); }, next: () => null, end(end) { seen.push(`end ${end}`); } },
        };
      },
    };
    const p = make({
      controls: { k: { kind: 'fakeKnob', target: 'sky', event: 'turned' } },
      on: {
        'press:go': [{ id: 'go', actions: [{ id: 'r', fakeRing: 'x', times: '2' }, { id: 'p', play: 'tune' }] }],
        'bell:x': [{ id: 'b', actions: [{ id: 'l', set: 'log', to: "log + 'bell '" }] }],
        turned: [{ id: 't', actions: [{ id: 'l2', set: 'log', to: "log + 'knob' + event.arg + ' '" }] }],
      },
    }, ['fake'], [fake]);
    ok(p.start().ok, p.lastFault?.message);
    eq(seen, ['mount a', 'entered a']);
    ok(p.send('a', 'press:go').ok);
    eq(seen.includes('play tune'), true, 'play goes to the owner');
    p.advance(60);
    eq(p.read('a', 'log'), 'bell ');
    const turned = p.activate('a', 'k', 7);
    ok(turned.ok, JSON.stringify(turned));
    eq(p.read('a', 'log'), 'bell knob7 ');
    ok(seen.includes('begin') && seen.includes('end 60'), 'clock phases');
    const bad = make(press([{ id: 'r', fakeRing: 'x', times: '9' }]), ['fake'], [fake]);
    ok(bad.start().ok);
    eq(bad.send('a', 'press:go').fault?.code, 'E-RANGE', 'a capability fault rolls back like any other');
  },
  'the pack fixture (made sounds, now core: D31.2) bundles no capability module'() {
    const files = bundled(JSON.parse(fs.readFileSync(path.join(repo, 'engine', 'v2', 'tests', 'pack-fixture', 'experience.json'), 'utf8')).needs || []);
    eq(files.filter(f => f.startsWith('engine/v2/src/capabilities/')), []);
    for (const f of ['engine/v2/src/ai.mjs', 'engine/v2/web/snapshot-web.mjs', 'engine/v2/web/widgets-web.mjs']) ok(!has(files, f), f);
  },
  'the AI fixture bundles ai and widgets, not physics, effects or snapshot'() {
    const files = bundled(['widgets', 'ai']);
    for (const f of ['ai', 'widgets']) ok(has(files, `engine/v2/src/capabilities/${f}.mjs`), f);
    for (const f of ['engine/v2/src/ai.mjs', 'engine/v2/src/ai-words.mjs', 'engine/v2/web/widgets-web.mjs']) ok(has(files, f), f);
    for (const f of ['physics', 'effects', 'snapshot']) ok(!has(files, `engine/v2/src/capabilities/${f}.mjs`), f);
  },
  async 'a packed page lists its capability modules and registers them before the player boots'() {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'w3c-pack-'));
    try {
      const r = await pack(path.join(repo, 'engine', 'v2', 'tests', 'ai-fixture'), out);
      eq(r.capabilities, ['ai', 'widgets']);
      const html = fs.readFileSync(r.htmlPath, 'utf8');
      ok(html.includes('// engine/v2/src/capabilities/ai.mjs') && !html.includes('// engine/v2/src/capabilities/physics.mjs'));
      const runs = html.match(/^req\(\d+\);$/gm) || [];
      eq(runs.length, 2, 'one req per capability module (ai, widgets), before the entry runs');
      ok(html.indexOf(runs[1]) < html.indexOf('.run(pack);'));
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  },
};
