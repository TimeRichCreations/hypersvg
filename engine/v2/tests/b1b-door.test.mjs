// The add-on door made safe and complete (D31, P1 risks 1 and 2, door 2). Item 1's tests each reproduce a
// finding; each failed on engine-2.0 before its fix. Fast: no browser.
import { eq, ok } from './helpers.mjs';
import { registerAddon } from '../src/addon-door.mjs';
import { registered, unregister } from '../src/capabilities.mjs';
import { Player } from '../src/story.mjs';
import { FORMAT } from '../src/limits.mjs';
import { modulePort } from '../src/host.mjs';
import { admitHost } from '../src/host-profile.mjs';
import { scanCode, addonDigest } from '../tools/addons.mjs';
import { checkManifest } from '../src/addons.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repo, schemas } from './helpers.mjs';
import { folderSource } from '../src/load.mjs';
import { checkExperience } from '../check/index.mjs';
import { pin } from '../tools/addon.mjs';

// A digest built from pieces, plainly fake.
const DIGEST = ['sha256', ':', 'b'.repeat(64)].join('');
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hsvg-version="2.0"><rect id="x" width="1" height="1"/></svg>';
const num = (initial = 0) => ({ type: 'number', initial, minimum: 0, maximum: 1e9 });
// A tiny experience that needs and pins the outside capability id, with scene "one" holding the given keys.
const tiny = (id, scene = {}, exp = {}) => ({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', needs: [`${id}@1.0.0`], about: { trust: { pins: { [`${id}@1.0.0`]: DIGEST } } }, story: { start: 'one', scenes: { one: 'one.json' } }, ...exp },
  words: { en: {} }, data: {},
  scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg', ...scene }, words: {}, drawings: { main: { text: svg } } },
    two: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'two', drawing: 'two.svg' }, words: {}, drawings: { main: { text: svg } } } },
  blocks: {}, limits: { ...FORMAT },
});
const manifest = (id, adds = {}) => ({ door: 1, id, version: '1.0.0', kind: 'capability', adds: { calls: {}, events: ['done'], channels: ['level'], ...adds } });
// A door 2 manifest with every door 2 word.
const door2 = (id) => ({ door: 2, id, version: '1.0.0', kind: 'capability', title: 'Two',
  adds: {
    keys: { type: 'object', properties: { level: { type: 'string', maxLength: 48 } }, additionalProperties: false },
    calls: { go: { with: { type: 'object', properties: { n: { type: 'number', minimum: 0, maximum: 9 }, label: { type: 'string', maxLength: 9 } }, required: ['n'], additionalProperties: false } },
      buy: { humanOnly: true, with: { type: 'object', properties: {}, additionalProperties: false } } },
    events: ['done', 'ended:<subject>'],
    writes: ['level'],
    draws: { binding: { type: 'object', properties: { color: { type: 'string', maxLength: 7 } }, required: ['color'], additionalProperties: false }, text: false },
    contentTypes: { ramp: { type: 'string', maxLength: 64 } },
    grants: ['storage'],
  } });
// Registers an outside capability whose install keeps its door and returns hooks; mounts an engine that needs it.
function mountEvil(id, hooks = {}, scene = {}, m = manifest(id), exp = {}) {
  let door = null;
  registerAddon({ manifest: m, digest: DIGEST, code: { install: (d) => { door = d; return typeof hooks === 'function' ? hooks(d) : hooks; } } });
  const engine = new Player(tiny(id, { values: { level: num(), secret: num() }, addons: { [id]: { level: 'level' } }, ...scene }, exp), { epochMs: 0, capabilities: { [id]: modulePort({ lock: { [`${id}@1.0.0`]: DIGEST } }) } });
  return { engine, door };
}

export const tests = {
  // ---- item 1: the door's leaks (P1 risk 1) ----
  'item 1: an outside capability\'s door has no prototype, no transaction, and only its listed functions'() {
    const { engine, door } = mountEvil('acme.proto');
    ok(engine.start().ok);
    ok(door, 'install ran');
    eq(Object.getPrototypeOf(door), null, 'the door has no prototype (it reached the raw write and emit)');
    ok(!('transaction' in door), 'no transaction: it could act as a person');
    ok(Object.isFrozen(door), 'the door is frozen');
    eq(Object.keys(door).sort(), ['def', 'emit', 'entryKey', 'fault', 'id', 'now', 'read', 'settings', 'timers', 'write'], 'only its listed functions');
    ok(Object.isFrozen(door.timers) && Object.getPrototypeOf(door.timers) === null, 'its timers are frozen with no prototype');
    // The raw core door is out of reach: neither the prototype nor a property gives a write outside its channels.
    let raw = Object.getPrototypeOf(door);
    for (const k of Object.getOwnPropertyNames(door)) if (door[k] && typeof door[k] === 'object' && 'write' in door[k] && door[k] !== door) raw = door[k];
    eq(raw, null, 'no raw door');
  },
  'item 1: an outside capability cannot start a step as a person (the human-only check)'() {
    const { engine, door } = mountEvil('acme.person');
    ok(engine.start().ok);
    let r = null;
    try { r = door.transaction?.('person', () => engine.humanOnly('experience', 'invoke')) ?? null; } catch { r = null; }
    eq(r, null, 'no transaction as a person');
  },
  'item 1: the hooks install returns cannot rename the add-on or claim another\'s hooks'() {
    const { engine } = mountEvil('acme.hooks', { id: 'seats', record: { attach: () => 'stolen' }, play: () => true, stop: () => true, actions: { set: () => {} }, controls: { press: () => {} }, input: { initial: () => 99 }, clock: { next: () => ({ due: 0, run: () => {} }) } });
    ok(engine.caps.has('acme.hooks'), 'it keeps its id');
    ok(!engine.caps.has('seats'), 'it cannot take another id');
    const c = engine.caps.list.find(x => x.id === 'acme.hooks');
    eq(c.record, registered().get('acme.hooks'), 'its record is its own');
    for (const k of ['play', 'stop', 'actions', 'controls', 'input', 'clock']) ok(c[k] === undefined, `the hook ${k} is not an outside capability's`);
    eq(engine.caps.play('scene:one', 'x'), false, 'it cannot claim play');
  },
  'item 1: a built-in\'s hooks are an allowed list too, placed after its id and record'() {
    const { engine } = mountEvil('acme.order', { calls: {}, timer: () => {} });
    const c = engine.caps.list.find(x => x.id === 'acme.order');
    eq(Object.keys(c).slice(0, 2), ['id', 'record'], 'id and record first');
    ok(typeof c.timer === 'function' && typeof c.calls === 'object', 'its allowed hooks are kept');
  },
  'item 1: attach gets only its door, and part returns a limited handle, never the page element'() {
    let seen = null;
    registerAddon({ manifest: manifest('acme.paint'), digest: DIGEST, code: { install: () => ({}), attach: (arg) => { seen = arg; } } });
    const el = { style: {}, ownerDocument: { defaultView: { secret: 1 } }, parentNode: {}, setAttribute() {} };
    const coreDoor = { id: 'acme.paint', experience: {}, part: () => el, slot: () => el, read: () => 1 };
    const player = { def: () => ({ addons: { 'acme.paint': { part: 'p' } } }), state: { blocks: { experience: {} } } };
    registered().get('acme.paint').attach({ player, door: coreDoor, container: { secret: 1 }, win: { secret: 1 }, options: {} });
    ok(seen, 'attach ran');
    eq(Object.keys(seen), ['door'], 'attach gets only its door');
    const h = seen.door.part('experience', 'p');
    ok(h && h !== el, 'part gives a handle, not the element');
    ok(h.ownerDocument === undefined && h.parentNode === undefined && h.setAttribute === undefined, 'the handle reaches no document');
    eq(Object.getPrototypeOf(h), null, 'the handle has no prototype');
    h.style.filter = 'drop-shadow(0 0 4px #ffaa00)';
    eq(el.style.filter, 'drop-shadow(0 0 4px #ffaa00)', 'it changes how the part looks');
    h.style.opacity = '0.5';
    eq(el.style.opacity, '0.5');
    h.style.filter = 'url(https://example.invalid/x.svg#f)';
    eq(el.style.filter, 'drop-shadow(0 0 4px #ffaa00)', 'a value that loads a file is refused');
    let threw = false; try { h.style.backgroundImage = 'x'; } catch { threw = true; }
    ok(threw || el.style.backgroundImage === undefined, 'only the listed style properties');
    const s = seen.door.slot('captions');
    ok(s && s !== el && s.ownerDocument === undefined, 'slot gives a handle too');
  },
  'item 1: the checker\'s word list refuses getPrototypeOf, window, document, location and hsvg in a capability'() {
    for (const w of ['getPrototypeOf', 'window', 'document', 'location', 'hsvg', 'globalThis']) {
      const code = `export function install(door) { const x = ${w === 'getPrototypeOf' ? 'Object.getPrototypeOf(door)' : `${w}.anything`}; return {}; }\n`;
      ok(scanCode(code, 'capability').some(m => m.includes(`"${w}"`)), `${w} is refused`);
    }
    eq(scanCode('export function install(door) { return {}; }\n', 'capability'), [], 'plain code passes');
  },
  // ---- item 2: door 2 (D31.5) ----
  'item 2: a door 2 manifest declares draws, humanOnly calls, contentTypes, grants, writes and subject events'() {
    eq(checkManifest(door2('acme.two'), { folder: 'acme.two' }), []);
    const said = (m) => checkManifest(m).map(d => `${d.code} ${d.message}`).join(' | ');
    ok(said({ ...door2('acme.two'), door: 3 }).includes('write "door": 2'), 'door 3 is refused with the fix');
    const one = { ...door2('acme.two'), door: 1 };
    ok(said(one).includes('E-CAPABILITY-FORMAT') && said(one).includes('door 2 word'), `door 2 words in a door 1 manifest: ${said(one)}`);
    const chan = structuredClone(door2('acme.two')); chan.adds.channels = chan.adds.writes; delete chan.adds.writes;
    ok(said(chan).includes('rename channels to writes'), said(chan));
    const glow = JSON.parse(fs.readFileSync(path.join(repo, 'engine', 'v2', 'addons', 'examples', 'addons', 'example.glow', 'manifest.json'), 'utf8'));
    eq(glow.door, 1); eq(checkManifest(glow, { folder: 'example.glow' }), [], 'a door 1 manifest keeps working (channels read as writes)');
    const bad = structuredClone(door2('acme.two'));
    bad.adds.grants = ['moon']; bad.adds.calls.buy.humanOnly = 'yes'; bad.adds.contentTypes.Ramp = { type: 'string', maxLength: 3 }; bad.adds.draws.text = 1;
    const out = said(bad);
    for (const w of ['grants lists', 'humanOnly is true or false', 'camelCase word', 'text is true when']) ok(out.includes(w), `${w}: ${out}`);
  },
  'item 2: the outside door honours required inputs, humanOnly calls and events with a subject'() {
    const seen = [];
    const { engine } = mountEvil('acme.two', (d) => ({ calls: {
      go: (address, input) => { seen.push(input); d.write(address, 'level', input.n); d.emit(address, 'ended', {}, 'intro'); },
      buy: () => seen.push('bought'),
    } }), { values: { level: num(), heard: num() }, addons: { 'acme.two': { level: 'level' } },
      controls: { pay: { kind: 'button', target: 'x', event: 'pay' } },
      on: { poke: [{ actions: [{ call: 'acme.two.go', with: { n: '3' } }] }], 'acme.two:ended:intro': [{ actions: [{ set: 'heard', to: '1' }] }],
        sneak: [{ actions: [{ call: 'acme.two.buy' }] }], pay: [{ actions: [{ call: 'acme.two.buy' }] }],
        bare: [{ actions: [{ call: 'acme.two.go', with: { label: "'x'" } }] }] } }, door2('acme.two'));
    ok(engine.start().ok);
    ok(engine.send('one', 'poke').ok, 'an optional input may be left out');
    eq(seen[0], { n: 3 });
    eq([engine.read('one', 'level'), engine.read('one', 'heard')], [3, 1], 'it wrote its value; content heard acme.two:ended:intro');
    ok(engine.activate('one', 'pay').ok, 'a person\'s press may make a humanOnly call');
    ok(seen.includes('bought'));
    eq(engine.send('one', 'sneak', {}, 'host').fault?.code, 'E-HUMAN-ONLY', 'a humanOnly call from no person is refused');
    const again = mountEvil('acme.two', (d) => ({ calls: { go: () => {}, buy: () => {} } }), { on: { bare: [{ actions: [{ call: 'acme.two.go', with: { label: "'x'" } }] }] } }, door2('acme.two')).engine;
    ok(again.start().ok);
    eq(again.send('one', 'bare').fault?.code, 'E-ADDON', 'a required input left out is refused');
  },
  'item 2: a story link hears an add-on\'s event of its from scene'() {
    const { engine } = mountEvil('acme.link', (d) => ({ calls: { go: (address) => d.emit(address, 'ended', {}, 'intro') } }), {
      on: { poke: [{ actions: [{ call: 'acme.link.go', with: { n: '1' } }] }] } }, door2('acme.link'),
    { story: { start: 'one', scenes: { one: 'one.json', two: 'two.json' }, links: [{ id: 'l', from: 'one', on: 'acme.link:ended:intro', to: 'two' }] } });
    ok(engine.start().ok);
    ok(engine.send('one', 'poke').ok);
    eq(engine.state.story.current, 'two', 'the link on acme.link:ended:intro fired');
  },
  async 'item 2: the checker reads an outside add-on\'s door 2 words: draws, humanOnly paths, required inputs, links and content types'() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-b1b-'));
    const EX = path.join(repo, 'engine', 'v2', 'addons', 'examples');
    fs.cpSync(path.join(EX, 'addons'), path.join(dir, 'addons'), { recursive: true });
    fs.cpSync(path.join(EX, 'noughts'), path.join(dir, 'noughts'), { recursive: true });
    const mf = path.join(dir, 'addons', 'example.glow', 'manifest.json');
    const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
    m.door = 2; m.adds.writes = m.adds.channels; delete m.adds.channels;
    m.adds.calls.pulse.with.properties.soft = { type: 'boolean' };
    m.adds.calls.buy = { humanOnly: true, with: { type: 'object', properties: {}, additionalProperties: false } };
    m.adds.events.push('ended:<subject>');
    m.adds.draws = door2('x.y').adds.draws; m.adds.contentTypes = door2('x.y').adds.contentTypes;
    fs.writeFileSync(mf, JSON.stringify(m, null, 2));
    const sf = path.join(dir, 'noughts', 'scenes', 'game', 'scene.json');
    const base = fs.readFileSync(sf, 'utf8');
    await pin(path.join(dir, 'noughts'));
    const check = async (edit) => { const s = JSON.parse(base); edit(s); fs.writeFileSync(sf, JSON.stringify(s, null, 2)); return (await checkExperience(await folderSource(path.join(dir, 'noughts')), schemas())).diags; };
    const said = (list) => list.map(d => `${d.code} ${d.path} ${d.message}`).join(' | ');
    let d = await check(() => {});
    eq(d.filter(x => x.code.startsWith('E-')), [], `door 2 manifest, unchanged scene: ${said(d)}`);
    d = await check((s) => { s.bindings = [...(s.bindings || []), { target: 'board', 'example.glow': { color: '#ffcc00' } }]; });
    eq(d.filter(x => x.code.startsWith('E-')), [], `a draws binding that fits: ${said(d)}`);
    d = await check((s) => { s.bindings = [...(s.bindings || []), { target: 'board', 'example.glow': { colour: 1 } }]; });
    ok(d.some(x => x.path?.startsWith('bindings[') && x.message.includes('draws.binding')), `a draws binding that does not fit: ${said(d)}`);
    d = await check((s) => { s.bindings = [...(s.bindings || []), { target: 'board', 'example.glow': { color: '#ffcc00' } }, { target: 'board', visible: 'true' }]; });
    ok(d.some(x => x.code === 'E-WRITER' && x.message.includes('only writer')), `the add-on is the part's only writer: ${said(d)}`);
    d = await check((s) => { s.on.later = [{ actions: [{ call: 'example.glow.pulse', with: { soft: 'true' } }] }]; });
    ok(d.some(x => x.code === 'E-ADDON' && x.message.includes('needs the input times')), `a required input: ${said(d)}`);
    d = await check((s) => { s.on.later = [{ actions: [{ call: 'example.glow.pulse', with: { times: '2' } }] }]; });
    ok(!d.some(x => x.code === 'E-ADDON'), `an optional input left out: ${said(d)}`);
    d = await check((s) => { s.machines = [...(s.machines || []), { id: 'tick', initial: 'a', states: { a: { after: [{ delayMs: 100, target: 'b', actions: [{ call: 'example.glow.buy' }] }] }, b: {} } }]; });
    ok(d.some(x => x.code === 'W-HUMAN-ONLY-PATH' && x.message.includes('call example.glow.buy')), `a humanOnly call from a timer: ${said(d)}`);
    d = await check((s) => { s.on['example.glow:ended:intro'] = [{ actions: [] }]; s.on['example.glow:ended'] = [{ actions: [] }]; });
    ok(!d.some(x => x.message.includes('"example.glow:ended:intro"')), `a subject event is heard: ${said(d)}`);
    ok(d.some(x => x.message.includes('"example.glow:ended"')), `ended needs its subject: ${said(d)}`);
    d = await check((s) => { s.inputs = { ...(s.inputs || {}), shade: { kind: 'content', type: 'string', contentType: 'example.glow.ramp', initial: 'a', maxLength: 64 }, tone: { kind: 'content', type: 'string', contentType: 'example.glow.nope', initial: 'a', maxLength: 64 } }; });
    ok(!d.some(x => x.path === 'inputs.shade.contentType'), `a declared content type: ${said(d)}`);
    ok(d.some(x => x.path === 'inputs.tone.contentType' && x.message.includes('declares ramp')), `an undeclared one: ${said(d)}`);
    // A story link hears an add-on's event of its from scene.
    const ef = path.join(dir, 'noughts', 'experience.json');
    const e = JSON.parse(fs.readFileSync(ef, 'utf8'));
    fs.mkdirSync(path.join(dir, 'noughts', 'scenes', 'done'));
    fs.writeFileSync(path.join(dir, 'noughts', 'scenes', 'done', 'done.svg'), svg);
    fs.writeFileSync(path.join(dir, 'noughts', 'scenes', 'done', 'scene.json'), JSON.stringify({ format: 'hsvg/2.0', kind: 'scene', id: 'done', drawing: 'done.svg' }));
    e.story.scenes.done = 'scenes/done/scene.json'; e.story.ends = ['done']; e.story.links = [{ id: 'won', from: 'game', on: 'example.glow:faded', to: 'done' }];
    fs.writeFileSync(ef, JSON.stringify(e, null, 2));
    d = await check(() => {});
    ok(!d.some(x => x.path?.includes('links') && x.code === 'E-REF-UNKNOWN'), `a link hears example.glow:faded: ${said(d)}`);
    e.story.links[0].on = 'example.glow:fizzled'; fs.writeFileSync(ef, JSON.stringify(e, null, 2));
    d = await check(() => {});
    ok(d.some(x => x.code === 'E-REF-UNKNOWN' && x.message.includes('not an event its add-on gives')), `an event the add-on does not give: ${said(d)}`);
  },
  // ---- item 3: the built-ins on the door ----
  'item 3: a built-in humanOnly call (snapshot.save) runs from a press and is refused from a timer, in the engine and the checker'() {
    const exp = (machine) => ({
      doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', needs: ['snapshot'], story: { start: 'a', scenes: { a: 'a.json' } } },
      words: { en: {} }, data: {}, blocks: {},
      scenes: { a: { file: 'a.json', drawings: {}, words: {}, doc: { format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg',
        controls: { save: { kind: 'button', target: 'card', label: 'Save' } },
        addons: { snapshot: { saves: { card: { picture: 'card', filename: 'card.png', pixelWidth: 100 } } } },
        on: { 'press:card': [{ actions: [{ call: 'snapshot.save', with: { save: "'card'" } }] }], later: [{ actions: [{ call: 'snapshot.save', with: { save: "'card'" } }] }] },
        ...(machine ? { machines: [{ id: 'm', initial: 'a', states: { a: { after: [{ delayMs: 10, target: 'b', actions: [{ call: 'snapshot.save', with: { save: "'card'" } }] }] }, b: {} } }] } : {}) } } },
    });
    const p = new Player(exp(false));
    ok(p.start().ok);
    const r = p.activate('a', 'save');
    ok(r.ok && r.deliveries.some(d => d.kind === 'snapshot'), JSON.stringify(r.fault));
    eq(p.send('a', 'later', {}, 'host').fault?.code, 'E-HUMAN-ONLY', 'a host step cannot save');
  },
  async 'item 3: the checker flags a built-in humanOnly call on a timer path (W-HUMAN-ONLY-PATH)'() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-b1b3-'));
    fs.mkdirSync(path.join(dir, 'a'));
    fs.writeFileSync(path.join(dir, 'a', 'a.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>A</title><g id="card" data-hsvg-kind="part"><rect width="10" height="10"/></g></svg>\n');
    fs.writeFileSync(path.join(dir, 'experience.json'), JSON.stringify({ format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', about: { title: 'X' }, needs: ['snapshot'], story: { start: 'a', scenes: { a: 'a/scene.json' }, ends: ['a'] } }));
    fs.writeFileSync(path.join(dir, 'a', 'scene.json'), JSON.stringify({ format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg',
      addons: { snapshot: { saves: { card: { picture: 'card', filename: 'card.png', pixelWidth: 100 } } } },
      machines: [{ id: 'm', initial: 'a', states: { a: { after: [{ delayMs: 10, target: 'b', actions: [{ call: 'snapshot.save', with: { save: "'card'" } }] }] }, b: {} } }] }));
    const d = (await checkExperience(await folderSource(dir), schemas())).diags;
    ok(d.some(x => x.code === 'W-HUMAN-ONLY-PATH' && x.message.includes('call snapshot.save')), d.map(x => `${x.code} ${x.message}`).join(' | '));
  },
  'item 3: no core schema names a capability outside the door\'s places, apart from motion\'s morph (D28)'() {
    // Each built-in's settings pocket (addons.<name>) is the door's placement, filled from its manifest when needs
    // names it (D28). Everything else a capability owns in a core schema is listed here; the list may only shrink
    // as each capability moves onto the door (B1b moved synth, route, live-data, effects and snapshot; B1d lines, page and media; B1e seats, ai, rich-text and widgets). Only motion's morph is left (D28).
    const dir = path.join(repo, 'spec', '2.0', 'schemas', 'core');
    const left = {};
    const SKIP = new Set(['properties', '$defs', 'items', 'allOf', 'oneOf', 'anyOf', 'then', 'if', 'additionalProperties']);
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.schema.json'))) {
      (function walk(n, at) {
        if (Array.isArray(n)) { n.forEach(x => walk(x, at)); return; }
        if (!n || typeof n !== 'object') return;
        const o = n['x-hsvg-owner'];
        // The door's placements: the settings pocket addons.<name>, and a draws binding key bindings.<name> (door 2).
        if (o && o !== 'core' && at !== `addons.${o}` && at !== `bindings.${o}`) (left[o] ??= new Set()).add(at);
        for (const [k, v] of Object.entries(n)) walk(v, SKIP.has(k) ? at : (at ? `${at}.${k}` : k));
      })(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), '');
    }
    const got = Object.fromEntries(Object.entries(left).map(([k, v]) => [k, [...v].sort()]).sort());
    eq(got, {
      motion: ['bindings.motion.morph', 'bindings.to', 'clips.tracks.channel', 'clips.tracks.to'],
    });
    for (const moved of ['synth', 'effects', 'live-data', 'snapshot', 'physics', 'lines', 'page', 'media', 'seats', 'ai', 'rich-text', 'widgets', 'shell']) ok(!got[moved], `${moved} is only in its pocket`);
  },
  'item 1: (clean up) the test add-ons leave the registry'() {
    for (const id of ['acme.proto', 'acme.person', 'acme.hooks', 'acme.order', 'acme.paint', 'acme.two', 'acme.link']) unregister(id);
    ok(![...registered().keys()].some(k => k.startsWith('acme.')));
  },
  // ---- item 1: closed default grants (P1 risk 2) ----
  'item 1: a page with no host profile is given no grant (closed by default, 10.5)'() {
    const doc = { grants: { storage: ['saved'], openUrl: true, fillers: ['agent'], ai: { chat: 'guided' }, signals: ['idle'] } };
    const h = admitHost(doc, null);
    for (const [k, v] of Object.entries(h.grants)) ok(v === false || (Array.isArray(v) ? v.length === 0 : Object.keys(v).length === 0), `${k} is not given: ${JSON.stringify(v)}`);
    eq([...h.refused].sort(), ['ai', 'fillers', 'openUrl', 'signals', 'storage'], 'every asked kind is refused');
  },
};
