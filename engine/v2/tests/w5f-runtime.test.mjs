// Runtime and host follow-ups from the first reviews. Role-prefixed names (5.3.1), initial values at
// mount (5.1, 5.3), changed: only for a setting that differs (9.2 step 4), changed:chapter when a skipWhen changes
// the count (5.5).
import { Engine } from '../src/runtime.mjs';
import { Player } from '../src/story.mjs';
import { eq, ok, repo, schemas, addonCode, granting } from './helpers.mjs';
import path from 'node:path';
import fs from 'node:fs';
import { loadExperience, folderSource, checkCells } from '../src/load.mjs';
import { mapSource } from './helpers.mjs';
import { makePageDoor } from '../src/capabilities.mjs';
const aiCap = await addonCode('../src/capabilities/ai.mjs', import.meta.url) ?? {};
import { setup as drawingSetup } from './w4d-helpers.mjs';
const { Ai } = await addonCode('../src/ai.mjs', import.meta.url) ?? {};

let aiLoaded;
async function aiPlayer() {
  aiLoaded ??= loadExperience(await folderSource(path.join(repo, 'engine', 'v2', 'tests', 'ai-fixture')), schemas());
  const p = new Player(structuredClone(aiLoaded.experience));
  ok(p.start().ok, 'starts');
  return p;
}

const experience = (scene, exp = {}) => ({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', story: { start: 'one', scenes: { one: 'one.json' } }, ...exp },
  words: { en: {} }, data: {}, blocks: {},
  scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'x.svg', ...scene }, words: {} } },
});
const start = (scene, exp) => { const e = new Engine(experience(scene, exp)); const r = e.transaction('host', () => e.mount('one', 'scene', 'one')); return [e, r]; };
const faultOf = (fn) => { try { fn(); } catch (e) { return e.code; } return null; };

export const tests = {
  // ---------- 1. role-prefixed names (W4-K Request 2) ----------
  'a role-prefixed field reads as one name: action.text (5.3.1)'() {
    const [e, r] = start({ values: { n: { type: 'number', initial: 0, minimum: 0, maximum: 99 } } }, {
      inputs: { 'action.text': { kind: 'content', type: 'string', maxLength: 20, initial: 'Order now' } },
    });
    ok(r.ok, r.fault?.message);
    eq(e.eval('one', 'action.text'), 'Order now');
    eq(e.eval('one', "action.text + '!'"), 'Order now!');
    eq(e.eval('one', 'length(action.text)'), 9);
    eq(e.template('one', 'Tap: {{ action.text }}'), 'Tap: Order now');
  },
  'an undeclared role-prefixed name still faults; member access on other names is unchanged'() {
    const [e, r] = start({ values: { pos: { type: 'object', properties: { x: { type: 'number', minimum: 0, maximum: 9 } }, initial: { x: 3 } } } });
    ok(r.ok, r.fault?.message);
    eq(e.eval('one', 'pos.x'), 3);
    eq(faultOf(() => e.eval('one', 'action.text')), 'E-FORMULA');
  },

  // ---------- 2. initial values at mount (W4-K Request 3) ----------
  'a value initial outside its bounds faults at mount (5.1)'() {
    const [, r] = start({ values: { score: { type: 'number', initial: 7, minimum: 0, maximum: 3 } } });
    ok(!r.ok); eq(r.fault.code, 'E-RANGE'); ok(/initial of value score/.test(r.fault.message), r.fault.message);
  },
  'a value initial of the wrong type faults at mount (5.1)'() {
    const [, r] = start({ values: { on: { type: 'boolean', initial: 'yes' } } });
    ok(!r.ok); eq(r.fault.code, 'E-TYPE');
  },
  "an experience input's initial off its step or enum faults at mount (5.3)"() {
    eq(faultOf(() => new Engine(experience({}, { inputs: { speed: { kind: 'knob', type: 'number', minimum: 0.5, maximum: 1.5, step: 0.25, initial: 0.6 } } }))), 'E-RANGE');
    eq(faultOf(() => new Engine(experience({}, { inputs: { colour: { kind: 'content', type: 'string', maxLength: 5, enum: ['red', 'blue'], initial: 'green' } } }))), 'E-RANGE');
    eq(faultOf(() => new Engine(experience({}, { values: { best: { type: 'number', initial: -1, minimum: 0, maximum: 3, lifetime: 'saved' } } }))), 'E-RANGE');
  },
  "a component input's own initial is checked even when the use gives a value (5.3)"() {
    const ex = experience({ uses: [{ id: 'b', use: 'badge', with: { size: '2' } }] });
    ex.blocks = { badge: { doc: { format: 'hsvg/2.0', kind: 'component', id: 'badge', drawing: 'b.svg', inputs: { size: { kind: 'content', type: 'number', minimum: 0, maximum: 3, initial: 9 } } } } };
    const e = new Engine(ex);
    const r = e.transaction('host', () => e.mount('one', 'scene', 'one'));
    ok(!r.ok); eq(r.fault.code, 'E-RANGE'); eq(r.fault.address, 'one/b');
  },
  'good initials, a language object and a tier object for text mount clean'() {
    const [e, r] = start({ values: { n: { type: 'number', initial: 1, minimum: 0, maximum: 3 } } }, {
      inputs: { 'message.headline': { kind: 'content', type: 'string', maxLength: 20, initial: { en: 'Fresh bread', de: 'Frisches Brot' } },
        note: { kind: 'content', type: 'string', maxLength: 10, initial: { short: 'Hi', medium: 'Hello' } } },
    });
    ok(r.ok, r.fault?.message);
    eq(e.read('one', 'n'), 1);
  },

  // ---------- 3. changed: only when a setting differs (W4-S Request 9) ----------
  'a setting of muted, volume or voice to the same value queues no changed: (9.2 step 4)'() {
    const [e, r] = start({
      values: { heard: { type: 'number', initial: 0, minimum: 0, maximum: 99 } },
      on: {
        'press:same': [{ id: 's', actions: [{ id: 'm', call: 'player.setting', with: {muted: 'false'} }, { id: 'v', call: 'player.setting', with: {volume: '1'} }] }],
        'press:other': [{ id: 'o', actions: [{ id: 'm', call: 'player.setting', with: {muted: 'true'} }] }],
        'changed:muted': [{ id: 'cm', actions: [{ id: 'a', set: 'heard', to: 'heard + 1' }] }],
        'changed:volume': [{ id: 'cv', actions: [{ id: 'a', set: 'heard', to: 'heard + 10' }] }],
      },
    });
    ok(r.ok, r.fault?.message);
    ok(e.send('one', 'press:same').ok);
    eq(e.read('one', 'heard'), 0, 'nothing differs');
    ok(e.send('one', 'press:other').ok);
    eq(e.read('one', 'heard'), 1, 'muted differs once');
    ok(e.send('one', 'press:other').ok);
    eq(e.read('one', 'heard'), 1, 'the same value again');
  },

  // ---------- 9. changed:chapter when a skipWhen changes the count (W4-R) ----------
  'changed:chapter is heard when a skipWhen changes the count while a step is on the stage (5.5)'() {
    const scene = (id) => ({ doc: { format: 'hsvg/2.0', kind: 'scene', id, drawing: 'x.svg', outputs: { next: { kind: 'event' } },
      on: { 'press:skip': [{ id: 's', actions: [{ id: 't', set: 'skipTwo', to: '!skipTwo' }] }], 'changed:chapter': [{ id: 'h', actions: [{ id: 'a', set: 'heard', to: 'heard + 1' }] }] } }, words: {} });
    const p = new Player({
      doc: { format: 'hsvg/2.0', kind: 'experience', id: 'deck', language: 'en',
        values: { skipTwo: { type: 'boolean', initial: false }, heard: { type: 'number', initial: 0, minimum: 0, maximum: 9 } },
        story: { start: 'deck', scenes: { one: 'one.json', two: 'two.json', three: 'three.json' },
          chapters: [{ id: 'deck', scenes: ['one', { scene: 'two', skipWhen: 'skipTwo' }, 'three'], next: 'next' }] } },
      words: { en: {} }, data: {}, blocks: {}, scenes: { one: scene('one'), two: scene('two'), three: scene('three') },
    });
    ok(p.start().ok);
    eq(p.read('one', 'chapter').count, 3);
    ok(p.send('one', 'press:skip').ok);
    eq(p.read('one', 'chapter').count, 2);
    eq(p.read('experience', 'heard'), 1, 'heard once, in the same transaction');
    ok(p.send('one', 'press:skip').ok);
    eq(p.read('experience', 'heard'), 2);
  },

  // ---------- 4. ai.mjs on the door; page parts get a door (W4-S Requests 4, 5) ----------
  async 'ai.mjs works on its door: no aiView, no engine reference, its state rolls back (10.11)'() {
    eq('aiView' in aiCap, false, 'aiView is gone');
    const src = fs.readFileSync(path.join(repo, 'engine', 'v2', 'src', 'ai.mjs'), 'utf8');
    ok(!/\bengine\b\s*[.[]/.test(src.replace(/\/\/.*$/gm, '')), 'ai.mjs reaches nothing through an engine object');
    const p = await aiPlayer();
    ok(p.ai instanceof Ai);
    eq(Object.isFrozen(p.ai.door), true, 'it holds a frozen door');
    eq('engine' in p.ai, false);
    ok(p.setInput('askText', 'oil', 'widget').ok);
    ok(p.send('desk', 'askGuide', {}, 'widget').ok);
    eq(p.ai.waiting('desk'), true, 'the ask waits in its own state');
    p.advance(0);
    eq(p.read('desk', 'answer'), 'Oil keeps the chain smooth and quiet.');
    eq(p.ai.waiting('desk'), false);
  },
  async "a page part gets a page door: copies to read, whole steps to write, faults on the page's stop path"() {
    const p = await aiPlayer();
    const stops = []; let paints = 0;
    const page = { drawing: null, errors: [], fault: (r, source) => { stops.push([r.fault.code, source]); return r; }, after: () => { paints++; } };
    const door = makePageDoor(p, 'shell', page);
    ok(Object.isFrozen(door) && Object.isFrozen(door.experience), 'the door and what it reads are frozen');
    eq(door.shellId, p.shellId);
    const words = door.words(door.shellId); words.injected = 'x';
    eq('injected' in p.words(door.shellId), false, 'words are a copy');
    let r = door.setInput('askText', 'oil');
    ok(r.ok); eq(door.input('askText'), 'oil'); eq(paints, 1, 'a step repaints');
    const before = p.state.revision;
    r = door.setInput('askText', 42);
    ok(!r.ok); eq(stops, [['E-TYPE', 'control']], 'a fault takes the stop path'); eq(p.state.revision, before);
    eq(door.revision(), p.state.revision);
    eq(door.exposed('ai'), p.ai);
    eq(door.exposed('state'), null, "the engine's own fields are not exposed names");
  },

  // ---------- 5. snap inside activate (W4-D Request 2) ----------
  'an accepted drop of a snap drag rests in the same step; a pick-up clears it (5.11)'() {
    const { p, d } = drawingSetup({ edit: (f) => { const c = f['scenes/one/scene.json'].controls.token; c.drops = ['goal', 'home']; c.accept = "event.drop === 'goal'"; c.missEvent = 'missed'; } });
    const before = p.state.revision;
    const r = p.activate('one', 'token', 'goal', 'seat');
    ok(r.ok, r.fault?.message);
    eq(p.state.revision, before + 1, 'one step');
    eq(p.state.blocks.one.snaps, { token: 'goal' });
    eq([...d.snapNodes().keys()].length, 1, 'the drawing paints the rest');
    ok(p.hold('one', 'token', true).ok);
    eq(p.state.blocks.one.snaps, {}, 'picked up: home again');
    ok(p.activate('one', 'token', 'goal').ok);
    ok(p.activate('one', 'token', 'home').ok, 'refused by accept');
    eq(p.state.blocks.one.snaps, {}, 'a refused drop returns the item home');
  },
  'a snap rest rolls back with a fault in the drop step (5.11, 9.2)'() {
    const { p } = drawingSetup({ edit: (f) => { const s = f['scenes/one/scene.json']; s.on ??= {}; s.on.dropped = [{ id: 'bad', actions: [{ id: 'w', set: 'nothing', to: '1' }] }]; } });
    const r = p.activate('one', 'token', 'goal');
    eq(r.ok, false);
    eq(p.state.blocks.one.snaps, undefined);
  },
  'a drag without snap never rests through activate'() {
    const { p } = drawingSetup({ edit: (f) => { delete f['scenes/one/scene.json'].controls.token.snap; } });
    ok(p.activate('one', 'token', 'goal').ok);
    eq(p.state.blocks.one.snaps, undefined);
  },

  // ---------- 6. repeated uses follow a changed list (W4-D Request 3, 4.5) ----------
  'a changed list keeps, moves, adds and removes repeated uses by key (4.5)'() {
    const card = { doc: { format: 'hsvg/2.0', kind: 'component', id: 'card', drawing: 'card.svg',
      inputs: { name: { kind: 'content', type: 'string', maxLength: 8, initial: '' }, place: { kind: 'content', type: 'number', minimum: 0, maximum: 9, initial: 0 } },
      values: { taps: { type: 'number', initial: 0, minimum: 0, maximum: 9 }, moved: { type: 'number', initial: 0, minimum: 0, maximum: 9 } },
      on: { tap: [{ id: 't', actions: [{ id: 'a', set: 'taps', to: 'taps + 1' }] }], 'changed:place': [{ id: 'm', actions: [{ id: 'a', set: 'moved', to: 'moved + 1' }] }] },
      exit: [{ id: 'bye', emit: 'gone', as: 'record', with: { name: 'name' } }] }, words: {}, drawings: {} };
    const ex = experience({
      values: { names: { type: 'array', items: { type: 'string', maxLength: 8 }, maxItems: 5, initial: ['ann', 'bo', 'cy'] } },
      uses: [{ id: 'rows', use: 'card', into: 'row', items: 'names', key: 'item', with: { name: 'item', place: 'index' } }],
      on: {
        'press:swap': [{ id: 's', actions: [{ id: 'w', set: 'names', to: "['cy', 'ann', 'dee']" }] }],
        'press:back': [{ id: 'b', actions: [{ id: 'w', set: 'names', to: "['bo', 'cy']" }] }],
      },
    });
    ex.blocks = { card };
    const p = new Player(ex);
    ok(p.start().ok);
    const keys = () => p.state.blocks.one.uses.find(u => u.id === 'rows').keys;
    eq(keys(), ['ann', 'bo', 'cy']);
    ok(p.send('one/rows[ann]', 'tap').ok); ok(p.send('one/rows[cy]', 'tap').ok); ok(p.send('one/rows[bo]', 'tap').ok);
    const lists = p.state.lists || 0;
    ok(p.send('one', 'press:swap').ok);
    eq(keys(), ['cy', 'ann', 'dee'], 'the new order');
    eq([p.read('one/rows[cy]', 'taps'), p.read('one/rows[ann]', 'taps')], [1, 1], 'kept uses keep their values');
    eq([p.read('one/rows[cy]', 'place'), p.read('one/rows[ann]', 'place'), p.read('one/rows[dee]', 'place')], [0, 1, 2], 'with is read with the new index');
    eq([p.read('one/rows[cy]', 'moved'), p.read('one/rows[ann]', 'moved')], [1, 1], 'a kept use hears its changed input');
    eq(p.read('one/rows[dee]', 'taps'), 0, 'a new key gets a new use');
    eq(p.state.blocks['one/rows[bo]'], undefined, 'a gone key is removed');
    eq(p.state.records['one/rows[bo]#gone'], [{ name: 'bo' }], 'after its exit list');
    eq(p.state.lists, lists + 1);
    ok(p.send('one', 'press:back').ok);
    eq(keys(), ['bo', 'cy']);
    eq(p.read('one/rows[bo]', 'taps'), 0, 'a removed and re-added key starts with fresh moment values');
    eq(p.read('one/rows[cy]', 'taps'), 1);
  },
  'duplicate keys fault, at mount and on a change (4.5, E-ID-DUPLICATE)'() {
    const card = { doc: { format: 'hsvg/2.0', kind: 'component', id: 'card', drawing: 'card.svg', inputs: { name: { kind: 'content', type: 'string', maxLength: 8, initial: '' } } }, words: {}, drawings: {} };
    const ex = experience({
      values: { names: { type: 'array', items: { type: 'string', maxLength: 8 }, maxItems: 5, initial: ['a', 'b'] } },
      uses: [{ id: 'rows', use: 'card', into: 'row', items: 'names', key: 'item', with: { name: 'item' } }],
      on: { 'press:dup': [{ id: 'd', actions: [{ id: 'w', set: 'names', to: "['a', 'a']" }] }] },
    });
    ex.blocks = { card };
    const p = new Player(ex);
    ok(p.start().ok);
    const r = p.send('one', 'press:dup');
    eq(r.ok, false); eq(r.fault.code, 'E-ID-DUPLICATE');
    eq(p.read('one', 'names'), ['a', 'b'], 'rolled back');
    ex.doc.values = {};
    ex.scenes.one.doc.values.names.initial = ['x', 'x'];
    const q = new Player(ex);
    const r2 = q.start();
    eq(r2.ok, false); eq(r2.fault.code, 'E-ID-DUPLICATE');
  },

  // ---------- 7. shell music (6.10) ----------
  "a scene's music wins over the shell's while it plays; a scene without music lets the shell's play (6.10)"() {
    const scene = (id, extra = {}) => ({ file: `${id}.json`, doc: { format: 'hsvg/2.0', kind: 'scene', id, drawing: `${id}.svg`, outputs: { next: { kind: 'event' } }, on: { go: [{ id: 'g', actions: [{ id: 'e', emit: 'next' }] }] }, ...extra }, drawings: {}, words: {} });
    const p = new Player({
      doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', needs: ['shell'], shell: 'frame.json', audio: { fadeMs: 300 },
        story: { start: 'a', scenes: { a: 'a.json', b: 'b.json', c: 'c.json' }, links: [{ id: 'a-b', from: 'a', on: 'next', to: 'b' }, { id: 'b-c', from: 'b', on: 'next', to: 'c' }] } },
      words: { en: {} }, data: {}, blocks: {},
      shell: { file: 'frame.json', doc: { format: 'hsvg/2.0', kind: 'shell', id: 'frame', needs: ['shell'], drawing: 'frame.svg', slots: { stage: { kind: 'stage', label: 'Stage' } }, music: { sound: 'shell-loop', gain: 0.5 } }, drawings: {}, words: {} },
      scenes: { a: scene('a'), b: scene('b', { music: { sound: 'harbour', fadeMs: 900, whilePaused: 'pause' } }), c: scene('c') },
    });
    ok(p.start().ok);
    eq(p.music(), { sound: 'shell-loop', fadeMs: 300, gain: 0.5 }, "the shell's music, with no owner");
    ok(p.send('a', 'go').ok); eq(p.scene, 'b');
    eq(p.music(), { sound: 'harbour', fadeMs: 900, gain: 1, owner: 'b' }, "the scene's music wins");
    ok(p.send('b', 'go').ok); eq(p.scene, 'c');
    eq(p.music().sound, 'shell-loop', "the shell's music again");
  },

  // ---------- 8. data cell bounds (W4-R; 2.8) ----------
  'data cells are checked against their column bounds, for CSV and JSON (2.8)'() {
    const columns = { id: { type: 'string', maxLength: 6 }, share: { type: 'number', minimum: 0, maximum: 1 }, colour: { type: 'string', maxLength: 5, enum: ['red', 'blue'] } };
    const files = (file, text) => ({
      'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'd', language: 'en', resources: { t: { kind: 'data', file } },
        data: { t: { resource: 't', key: 'id', maxRows: 4, columns } }, story: { start: 'one', scenes: { one: 'scenes/one/scene.json' } } },
      [file]: text,
      'scenes/one/scene.json': { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg' },
      'scenes/one/one.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" data-hsvg-version="2.0" data-hsvg-kind="screen"><g id="w" data-hsvg-layer="content"/></svg>',
    });
    const dataErrors = (f, t) => loadExperience(mapSource(files(f, t)), schemas()).diags.filter(d => d.code === 'E-DATA').map(d => d.message);
    eq(dataErrors('t.csv', 'id,share,colour\napple,0.5,red\n'), [], 'a good CSV');
    eq(dataErrors('t.json', '[{"id":"apple","share":0.5,"colour":"red"}]'), [], 'a good JSON');
    const cases = [
      ['t.csv', 'id,share,colour\napple,1.5,red\n', /row 1, column share: 1.5 is above 1/],
      ['t.csv', 'id,share,colour\napple,-1,red\n', /below 0/],
      ['t.csv', 'id,share,colour\nwatermelon,0.5,red\n', /column id: longer than 6/],
      ['t.csv', 'id,share,colour\napple,0.5,green\n', /column colour: .*not one of the enum/],
      ['t.json', '[{"id":"apple","share":2,"colour":"red"}]', /above 1/],
      ['t.json', '[{"id":"apple","share":0.5,"colour":"pink"}]', /enum/],
      ['t.json', '[{"id":"apple","share":"0.5","colour":"red"}]', /expected number/],
      ['t.json', '[{"id":"apple","share":0.5}]', /missing colour/],
      ['t.json', '[{"id":"apple","share":0.5,"colour":"red","x":1}]', /not declared x/],
    ];
    for (const [f, t, re] of cases) { const m = dataErrors(f, t); ok(m.length === 1 && re.test(m[0]), `${t}: ${m.join('; ')}`); }
    eq(checkCells([{ n: 2 }], { n: { type: 'number', minimum: 0, maximum: 4, step: 2 } }), [{ n: 2 }]);
  },

  // ---------- 11. the host hears outputs (C1 gap 8; 10.6, 5.16) ----------
  async "the player's on(name, fn) hears openUrl, entered and an experience record a scene adds (10.6)"() {
    const r = loadExperience(await folderSource(path.join(repo, 'engine', 'v2', 'tests', 'host-fixture')), schemas());
    ok(r.experience, r.diags.map(d => d.message).join('; '));
    const p = new (granting(Player))(r.experience);
    const heard = [];
    for (const n of ['openUrl', 'entered', 'orders']) p.on(n, (e) => { ok(Object.isFrozen(e) && Object.isFrozen(e.detail)); heard.push([e.name, e.detail]); });
    const errors = []; p.onDeliveryError = (d) => errors.push(d.code);
    const stop = p.on('nothing', () => heard.push('never'));
    eq(errors, ['E-REF-UNKNOWN'], 'an unknown name is reported and hears nothing');
    ok(p.start().ok);
    eq(heard, [['entered', { slot: 'stage', scene: 'one', link: '' }]]);
    heard.length = 0;
    ok(p.activate('one', 'order').ok);
    const by = Object.fromEntries(heard);
    eq(Object.keys(by).sort(), ['openUrl', 'orders']);
    eq(by.orders.row, { item: 'bread' });
    eq(by.orders.filler, 'human');
    eq(by.openUrl, { field: 'clickUrl', with: { from: 'fixture' } });
    eq(p.state.records['experience#orders'], [{ item: 'bread' }], "the row is the experience's");
    stop();
  },
  async 'an experience record row from a scene is checked: its properties and maxRows (5.16)'() {
    const r = loadExperience(await folderSource(path.join(repo, 'engine', 'v2', 'tests', 'host-fixture')), schemas());
    const exp = structuredClone(r.experience);
    exp.scenes.one.doc.on.order[0].actions[0].with = { item: "'a very long item name'" };
    const p = new (granting(Player))(exp); ok(p.start().ok);
    const f = p.activate('one', 'order');
    eq(f.ok, false); eq(f.fault.code, 'E-RANGE');
    const q = new (granting(Player))(structuredClone(r.experience)); ok(q.start().ok);
    for (let i = 0; i < 8; i++) ok(q.activate('one', 'order').ok);
    const g = q.activate('one', 'order');
    eq(g.ok, false); eq(g.fault.code, 'E-RANGE', 'a row beyond maxRows faults');
  },
};
