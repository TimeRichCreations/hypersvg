// The checker proves what the spec marks [files]: frames and sizes, shape names, initial values.
import { checkExperience } from '../check/index.mjs';
import { schemas, eq, ok, mapSource } from './helpers.mjs';

const svg = (attrs, body = '') => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs} data-hsvg-version="2.0" data-hsvg-kind="screen"><title>t</title>${body}</svg>`;

export function base() {
  return {
    'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'tiny', language: 'en', story: { start: 'one', scenes: { one: 'scenes/one/scene.json' }, ends: ['one'] } },
    'scenes/one/scene.json': {
      format: 'hsvg/2.0', kind: 'scene', id: 'one',
      layouts: [{ id: 'rect', size: '300x250', drawing: 'rect.svg' }, { id: 'wide', shape: 'landscape', drawing: 'wide.svg' }],
    },
    'scenes/one/rect.svg': svg('width="300" height="250" viewBox="0 0 300 250"'),
    'scenes/one/wide.svg': svg('viewBox="0 0 400 200"'),
  };
}
export const run = (files) => checkExperience(mapSource(files), schemas(), { only: ['frames'] }).diags;
const codes = (files) => run(files).map(d => d.code);
const scene = (f) => f['scenes/one/scene.json'];

export const tests = {
  'the base passes the frames checks'() { eq(codes(base()), []); },
  // ----- item 1: frames and their size -----
  'an exact-size frame without width and height is E-SVG-ROOT'() {
    const f = base(); f['scenes/one/rect.svg'] = svg('viewBox="0 0 300 250"');
    const d = run(f); eq(d.map(x => x.code), ['E-SVG-ROOT']); eq(d[0].file, 'scenes/one/rect.svg');
  },
  'width and height that differ from the viewBox are E-SVG-ROOT (the drawing schema)'() {
    const f = base(); f['scenes/one/rect.svg'] = svg('width="300" height="200" viewBox="0 0 300 250"');
    ok(codes(f).includes('E-SVG-ROOT'));
  },
  'a viewBox that differs from the size is E-SVG-ROOT (728x90 frame for 300x600)'() {
    const f = base(); scene(f).layouts[0].size = '300x600';
    eq(codes(f), ['E-SVG-ROOT']);
    const g = base(); g['scenes/one/rect.svg'] = svg('width="728" height="90" viewBox="0 0 728 90"');
    eq(codes(g), ['E-SVG-ROOT']);
  },
  'a shape frame needs no width and height'() { eq(codes(base()), []); },
  'an unknown shape name is E-REF-UNKNOWN'() {
    const f = base(); scene(f).layouts[1].shape = 'nonsense';
    const d = run(f); eq(d.map(x => x.code), ['E-REF-UNKNOWN']); eq(d[0].path, '/layouts/1/shape');
  },
  'a shape named by an axis, a standard shape and an inline range pass'() {
    const f = base();
    f['experience.json'].axes = [{ axis: 'shape', select: 'space', shapes: { stubby: { maxAspect: 0.5 } } }];
    scene(f).layouts.push({ id: 'a', shape: 'stubby', drawing: 'wide.svg' }, { id: 'b', shape: { minAspect: 3 }, drawing: 'wide.svg' }, { id: 'c', shape: 'strip', drawing: 'wide.svg' });
    eq(codes(f), []);
  },
  // ----- item 2: initial values in bounds -----
  'an initial above its maximum is E-RANGE'() {
    const f = base(); scene(f).values = { n: { type: 'number', initial: 99, minimum: 0, maximum: 9 } };
    const d = run(f); eq(d.map(x => x.code), ['E-RANGE']); eq(d[0].path, '/values/n/initial');
  },
  'an initial of the wrong type is E-TYPE'() {
    const f = base(); scene(f).values = { n: { type: 'number', initial: 'x', minimum: 0, maximum: 9 } };
    ok(codes(f).includes('E-TYPE'), 'the type is reported (by the schema)');
  },
  'a string initial outside its enum or maxLength is E-RANGE'() {
    const f = base(); scene(f).values = { s: { type: 'string', enum: ['a', 'b'], maxLength: 1, initial: 'c' } };
    eq(codes(f), ['E-RANGE']);
  },
  'an initial inside its bounds passes, also on inputs and the experience'() {
    const f = base(); scene(f).values = { n: { type: 'number', initial: 9, minimum: 0, maximum: 9 } };
    scene(f).inputs = { k: { kind: 'knob', type: 'number', minimum: 0, maximum: 9, initial: 1 } };
    f['experience.json'].values = { e: { type: 'boolean', initial: false } };
    eq(codes(f), []);
  },
  'a knob initial out of bounds is E-RANGE'() {
    const f = base(); scene(f).inputs = { k: { kind: 'knob', type: 'number', minimum: 0, maximum: 9, initial: 10 } };
    eq(codes(f), ['E-RANGE']);
  },
  'an experience value out of bounds is E-RANGE'() {
    const f = base(); f['experience.json'].values = { e: { type: 'number', initial: -1, minimum: 0, maximum: 3 } };
    const d = run(f); eq(d.map(x => x.code), ['E-RANGE']); eq(d[0].file, 'experience.json');
  },
};

// ----- items 3 and 4: role-prefixed names, role schemas -----
const btn = (attrs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 20" data-hsvg-version="2.0"><title>b</title><g id="btn" data-hsvg-kind="component"${attrs || ' data-hsvg-role="action"'}><rect id="btn__surface" data-hsvg-kind="part" data-hsvg-role="surface" width="50" height="20"/><text id="btn__label" data-hsvg-kind="part" data-hsvg-role="label">GO</text></g></svg>`;
function roleBase() {
  return {
    'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'pr', language: 'en', blocks: { btn: 'blocks/btn/component.json' }, story: { start: 'one', scenes: { one: 'scenes/one/scene.json' }, ends: ['one'] } },
    'scenes/one/scene.json': { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg', uses: [{ id: 'b', use: 'btn', into: 'slot' }] },
    'scenes/one/one.svg': svg('viewBox="0 0 100 100"', '<rect id="slot" data-hsvg-kind="part" data-hsvg-slot="slot" width="50" height="20"/>'),
    'blocks/btn/component.json': {
      format: 'hsvg/2.0', kind: 'component', id: 'btn', drawing: 'btn.svg',
      inputs: { 'action.text': { kind: 'content', type: 'string', maxLength: 24, initial: 'GO' } },
      outputs: { pressed: { kind: 'event' } },
      controls: { press: { kind: 'button', target: 'surface', event: 'pressed', label: '{{ action.text }}' } },
      bindings: [{ id: 'label-text', target: 'label', text: '{{ action.text }}' }],
    },
    'blocks/btn/btn.svg': btn(),
  };
}
const full = (files, only) => checkExperience(mapSource(files), schemas(), only ? { only } : {}).diags;
const comp = (f) => f['blocks/btn/component.json'];

Object.assign(tests, {
  'a formula reads action.text as one name'() { eq(full(roleBase()).map(d => d.code), []); },
  'a role prefix not in the registry is still an unknown name'() {
    const f = roleBase(); comp(f).bindings[0].text = '{{ banana.text }}'; comp(f).controls.press.label = 'GO';
    eq(full(f, ['formula']).map(d => d.code), ['E-REF-UNKNOWN']);
  },
  'a role-prefixed name the block does not declare is an unknown name'() {
    const f = roleBase(); comp(f).bindings[0].text = '{{ action.supportingText }}';
    ok(full(f, ['formula']).some(d => d.code === 'E-REF-UNKNOWN'));
  },
  'a component with the role action and no action.text is E-ROLE-SCHEMA'() {
    const f = roleBase(); delete comp(f).inputs['action.text']; comp(f).inputs.other = { kind: 'content', type: 'string', maxLength: 5, initial: 'x' };
    comp(f).bindings[0].text = '{{ other }}'; comp(f).controls.press.label = 'GO';
    const d = full(f, ['roles']); eq(d.map(x => x.code), ['E-ROLE-SCHEMA']);
    ok(d[0].message.includes('action.text'));
  },
  'an alias of the role has the same duty (cta)'() {
    const f = roleBase(); f['blocks/btn/btn.svg'] = btn(' data-hsvg-role="cta"'); delete comp(f).inputs['action.text'];
    comp(f).bindings = []; comp(f).controls.press.label = 'GO';
    ok(full(f, ['roles']).some(d => d.code === 'E-ROLE-SCHEMA'));
  },
  'wider bounds, a wrong type or a wrong contentType than the schema is E-ROLE-SCHEMA'() {
    for (const change of [{ maxLength: 500 }, { type: 'number' }, { contentType: 'picture' }]) {
      const f = roleBase(); Object.assign(comp(f).inputs['action.text'], change);
      ok(full(f, ['roles']).some(d => d.code === 'E-ROLE-SCHEMA'), JSON.stringify(change));
    }
  },
  'a required field that nothing reads is E-ROLE-SCHEMA'() {
    const f = roleBase(); comp(f).bindings = []; comp(f).controls.press.label = 'GO';
    eq(full(f, ['roles']).map(d => d.code), ['E-ROLE-SCHEMA']);
    // A reader whose target is missing in one layout is E-LAYOUT-MISSING, from the references check.
    const g = roleBase(); delete comp(g).drawing;
    comp(g).layouts = [{ id: 'a', shape: 'landscape', drawing: 'btn.svg' }, { id: 'b', shape: 'portrait', drawing: 'btn-b.svg' }];
    g['blocks/btn/btn-b.svg'] = btn().replace('<text id="btn__label"', '<text id="btn__other"');
    eq(full(g).map(x => x.code), ['E-LAYOUT-MISSING']);
  },
  'a role with no schema, or an unknown role, has no duty'() {
    const f = roleBase(); f['blocks/btn/btn.svg'] = btn(' data-hsvg-role="surface"'); delete comp(f).inputs['action.text'];
    comp(f).bindings = []; comp(f).controls.press.label = 'GO';
    eq(full(f, ['roles']).map(d => d.code), []);
  },
  'fields of other roles may be added (message.kicker)'() {
    const f = roleBase(); comp(f).inputs['message.kicker'] = { kind: 'content', type: 'string', maxLength: 40, initial: 'x' };
    eq(full(f, ['roles']).map(d => d.code), []);
  },
});

// ----- item 5: E-WRITER -----
function writerBase() {
  return {
    'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'wr', language: 'en', story: { start: 'one', scenes: { one: 'scenes/one/scene.json' }, ends: ['one'] } },
    'scenes/one/scene.json': {
      format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg',
      values: { n: { type: 'number', initial: 0, minimum: 0, maximum: 9 } },
      controls: { go: { kind: 'button', target: 'btn', event: 'pressed', label: 'Go' } },
      outputs: { pressed: { kind: 'event' } },
      clips: { wave: { durationMs: 1000, tracks: [{ id: 't1', target: 'arm', channel: 'rotate', keys: [[0, 0], [1000, 10]] }] } },
      bindings: [{ id: 'arm-turn', target: 'arm', axis: 'x', move: 'n' }],
    },
    'scenes/one/one.svg': svg('viewBox="0 0 100 100"', '<g id="arm" data-hsvg-kind="part"><rect width="5" height="5"/></g><g id="btn" data-hsvg-kind="part"><g data-hsvg-variant="idle"><rect width="5" height="5"/></g><g data-hsvg-variant="hover" display="none"><rect width="6" height="6"/></g></g><g id="face" data-hsvg-kind="part"><g data-hsvg-variant="a"><rect width="5" height="5"/></g><g data-hsvg-variant="b" display="none"><rect width="5" height="5"/></g></g>'),
  };
}
const wcodes = (f) => full(f, ['writers']).map(d => d.code);
const wscene = (f) => f['scenes/one/scene.json'];
Object.assign(tests, {
  'the writer base passes'() { eq(wcodes(writerBase()), []); },
  'two replace tracks on one channel of one clip are E-WRITER'() {
    const f = writerBase(); wscene(f).clips.wave.tracks.push({ id: 't2', target: 'arm', channel: 'rotate', keys: [[0, 0], [1000, 5]] });
    eq(wcodes(f), ['E-WRITER']);
  },
  'a track\'s composite is a 2.1 draft (D31): refused with E-DRAFT'() {
    const f = writerBase(); wscene(f).clips.wave.tracks.push({ id: 't2', target: 'arm', channel: 'rotate', composite: 'add', keys: [[0, 0], [1000, 5]] });
    eq(wcodes(f), ['E-DRAFT']);
  },
  'a scale track and a scale-x track compete'() {
    const f = writerBase(); wscene(f).clips.wave.tracks = [{ id: 'a', target: 'arm', channel: 'scale', keys: [[0, 1], [1000, 2]] }, { id: 'b', target: 'arm', channel: 'scale', axis: 'x', keys: [[0, 1], [1000, 2]] }];
    eq(wcodes(f), ['E-WRITER']);
  },
  'a replace track and a channel binding on one part are E-WRITER'() {
    const f = writerBase(); wscene(f).bindings[0] = { id: 'arm-turn', target: 'arm', rotate: 'n' };
    eq(wcodes(f), ['E-WRITER']);
  },
  'two bindings that write one property are E-WRITER'() {
    const f = writerBase(); wscene(f).bindings.push({ id: 'arm-turn-2', target: 'arm', axis: 'x', move: 'n * 2' });
    eq(wcodes(f), ['E-WRITER']);
  },
  'two colour bindings with different roles write different paints; the same role twice is E-WRITER (6.8, A-22)'() {
    let f = writerBase();
    wscene(f).bindings.push({ id: 'arm-fill', target: 'arm', color: "'accent'", role: 'fill-paint' }, { id: 'arm-stroke', target: 'arm', color: "'ink'", role: 'stroke-paint' });
    eq(wcodes(f), []);
    f = writerBase();
    wscene(f).bindings.push({ id: 'arm-fill', target: 'arm', color: "'accent'", role: 'fill-paint' }, { id: 'arm-fill-2', target: 'arm', color: "'ink'", role: 'fill-paint' });
    eq(wcodes(f), ['E-WRITER']);
  },
  'a look binding on a part whose looks a control owns is E-WRITER'() {
    const f = writerBase(); wscene(f).bindings.push({ id: 'btn-look', target: 'btn', variant: "n > 1 ? 'idle' : 'hover'" });
    eq(wcodes(f), ['E-WRITER']);
  },
  'a look track on a part whose looks a control owns is E-WRITER'() {
    const f = writerBase(); wscene(f).clips.wave.tracks.push({ id: 'lk', target: 'btn', channel: 'variant', keys: [[0, 'idle'], [1000, 'hover']] });
    eq(wcodes(f), ['E-WRITER']);
  },
  'a look binding and a look track on one part are E-WRITER; a look binding alone is fine'() {
    const f = writerBase(); wscene(f).bindings.push({ id: 'face-look', target: 'face', variant: "n > 1 ? 'a' : 'b'" });
    eq(wcodes(f), []);
    wscene(f).clips.wave.tracks.push({ id: 'lk', target: 'face', channel: 'variant', keys: [[0, 'a'], [1000, 'b']] });
    eq(wcodes(f), ['E-WRITER']);
  },
});

// ----- item 5: E-WORDS-DECIDE, W-HUMAN-ONLY-PATH -----
function flowBase() {
  const f = writerBase();
  const s = wscene(f);
  s.inputs = { label: { kind: 'content', type: 'string', maxLength: 20, initial: 'Go' }, kindOf: { kind: 'content', type: 'string', enum: ['a', 'b'], maxLength: 1, initial: 'a' } };
  s.values = { n: { type: 'number', initial: 0, minimum: 0, maximum: 9 }, shown: { type: 'string', maxLength: 20, initial: '' }, kept: { type: 'string', maxLength: 20, initial: '', lifetime: 'saved' } };
  s.computed = { echo: 'label' };
  s.outputs = { pressed: { kind: 'event' }, done: { kind: 'event' } };
  s.on = { pressed: [{ id: 'r1', actions: [{ id: 'a1', set: 'n', to: '1' }] }] };
  s.bindings = [{ id: 'show', target: 'arm', text: '{{ label }} {{ echo }}' }];
  s.clips = { wave: { durationMs: 1000, markers: [{ id: 'm', atMs: 500, event: 'waved' }], tracks: [{ id: 't1', target: 'arm', channel: 'rotate', keys: [[0, 0], [1000, 10]] }] } };
  return f;
}
const fcodes = (f) => full(f, ['flow']).map(d => d.code);
Object.assign(tests, {
  'the flow base passes both rules'() { eq(fcodes(flowBase()), []); },
  'a guard on a text content field is E-WORDS-DECIDE'() {
    const f = flowBase(); wscene(f).on.pressed[0].guard = "label === 'Go'";
    const d = full(f, ['flow']); eq(d.map(x => x.code), ['E-WORDS-DECIDE']); eq(d[0].path, '/on/pressed/0/guard');
  },
  'a choice field may decide'() {
    const f = flowBase(); wscene(f).on.pressed[0].guard = "kindOf === 'a'"; eq(fcodes(f), []);
  },
  'an if on words, a computed value from words, and plural are E-WORDS-DECIDE'() {
    const f = flowBase(); wscene(f).on.pressed[0].actions = [{ id: 'c', if: "echo === 'x'", then: [{ id: 'x', set: 'n', to: '2' }] }];
    eq(fcodes(f), ['E-WORDS-DECIDE']);
    const g = flowBase(); wscene(g).on.pressed[0].actions = [{ id: 'c', if: "plural(n, words.cat) === 'x'", then: [{ id: 'x', set: 'n', to: '2' }] }];
    eq(fcodes(g), ['E-WORDS-DECIDE']);
    const h = flowBase(); wscene(h).on.pressed[0].actions = [{ id: 'c', if: "language === 'en'", then: [{ id: 'x', set: 'n', to: '2' }] }];
    eq(fcodes(h), ['E-WORDS-DECIDE']);
  },
  'words copied into a value that a guard reads are E-WORDS-DECIDE; a binding may read it'() {
    const f = flowBase(); wscene(f).on.pressed[0].actions.push({ id: 'a2', set: 'shown', to: 'label' });
    wscene(f).bindings.push({ id: 'show2', target: 'arm', text: '{{ shown }}' });
    eq(fcodes(f), []);
    wscene(f).on.pressed[0].guard = "shown === 'Go'";
    eq(fcodes(f), ['E-WORDS-DECIDE']);
  },
  'words written to a saved value are E-WORDS-DECIDE'() {
    const f = flowBase(); wscene(f).on.pressed[0].actions.push({ id: 'a2', set: 'kept', to: 'label' });
    eq(fcodes(f), ['E-WORDS-DECIDE']);
  },
  'a rule when on words is E-WORDS-DECIDE'() {
    const f = flowBase(); wscene(f).rules = [{ id: 'r', kind: 'protected', subject: 'part:arm', when: "label === 'x'" }];
    eq(fcodes(f), ['E-WORDS-DECIDE']);
  },
  'a timer that runs openUrl is W-HUMAN-ONLY-PATH'() {
    const f = flowBase(); wscene(f).machines = [{ id: 'm1', initial: 'a', states: { a: { after: [{ id: 'tm', delayMs: 1000, actions: [{ id: 'op', call: 'player.openUrl', with: {field: "'x'"} }] }] } } }];
    const d = full(f, ['flow']); eq(d.map(x => x.code), ['W-HUMAN-ONLY-PATH']); eq(d[0].path, '/machines/m1/states/a/after/0/actions/0');
  },
  'a person press that runs openUrl is fine'() {
    const f = flowBase(); wscene(f).on.pressed[0].actions.push({ id: 'op', call: 'player.openUrl', with: {field: "'x'"} });
    eq(fcodes(f), []);
  },
  'a clip marker, and an event emitted from it, reach setting (but not voice off)'() {
    const f = flowBase(); wscene(f).on.waved = [{ id: 'w', actions: [{ id: 's1', call: 'player.setting', with: {muted: true} }, { id: 's2', call: 'player.setting', with: {voice: false} }, { id: 'e', emit: 'done' }] }];
    wscene(f).on.done = [{ id: 'd', actions: [{ id: 's3', call: 'player.setting', with: {volume: 0.5} }] }];
    const d = full(f, ['flow']); eq(d.map(x => x.path), ['/on/waved/0/actions/0', '/on/done/0/actions/0']);
  },
});

// ----- item 6: diagnostics of 10.12 rule 1 -----
import { describe, jsonOffsets } from '../check/diagnostics.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { repo } from './helpers.mjs';

Object.assign(tests, {
  'jsonOffsets finds values by pointer'() {
    const m = jsonOffsets('{\n "a": {"b": [1, 2]},\n "c/d": true\n}');
    eq(m.get('/a/b/1'), 18); eq(m.get('/c~1d'), 31);
  },
  'a finding gets severity, line, column, pointer, address, reason and fix'() {
    const f = base(); scene(f).values = { n: { type: 'number', initial: 99, minimum: 0, maximum: 9 } };
    const files = { ...f }; const text = JSON.stringify(f['scenes/one/scene.json'], null, 2);
    const source = { read: (rel) => (rel === 'scenes/one/scene.json' ? text : mapSource(files).read(rel)) };
    const r = checkExperience(source, schemas(), { only: ['frames'] });
    const [d] = describe(r.diags, source, r.experience);
    eq([d.code, d.severity, d.pointer, d.address], ['E-RANGE', 'error', '/values/n/initial', 'one/n']);
    ok(d.line > 1 && d.column > 1, `line ${d.line} column ${d.column}`);
    ok(d.reason.length > 10 && d.fix.length > 10, 'reason and fix come from errors.json');
    eq(text.split('\n')[d.line - 1].trim().startsWith('"initial": 99'), true, text.split('\n')[d.line - 1]);
  },
  'a warning has severity warning, and a dotted schema path becomes a pointer'() {
    const [d] = describe([{ code: 'W-ROLE-UNKNOWN', file: 'a.svg', path: '#x', message: 'm' }, { code: 'E-TYPE', file: 'scenes/one/scene.json', path: 'values.n.initial', message: 'm' }], { read: () => null });
    eq(d.severity, 'warning');
    eq(describe([{ code: 'E-TYPE', file: 'x.json', path: 'values.n.initial', message: 'm' }], { read: () => null })[0].pointer, '/values/n/initial');
  },
  'check.mjs --json prints the fields, and the plain output adds the line'() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w4k-'));
    try {
      const f = base(); scene(f).values = { n: { type: 'number', initial: 99, minimum: 0, maximum: 9 } };
      for (const [rel, v] of Object.entries(f)) { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), typeof v === 'string' ? v : JSON.stringify(v, null, 2)); }
      const tool = path.join(repo, 'engine', 'v2', 'tools', 'check.mjs');
      const j = JSON.parse(spawnSync(process.execPath, [tool, dir, '--only', 'frames', '--json'], { encoding: 'utf8' }).stdout);
      const d = j.find(x => x.code === 'E-RANGE');
      for (const k of ['severity', 'line', 'column', 'pointer', 'address', 'reason', 'fix']) ok(d[k] !== undefined, `${k} is missing`);
      const plain = spawnSync(process.execPath, [tool, dir, '--only', 'frames'], { encoding: 'utf8' }).stdout;
      ok(new RegExp(`E-RANGE scenes/one/scene.json:${d.line}:${d.column} /values/n/initial`).test(plain), plain);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  },
});

// ----- item 7: the generated references -----
Object.assign(tests, {
  'formulas.md gives each function its own example, the row functions and the operators'() {
    const t = fs.readFileSync(path.join(repo, 'skill', '2.0', 'references', 'formulas.md'), 'utf8');
    for (const ex of ['`max(speed, 10)`', '`floor(score)`', '`ceil(score)`', '`round(score)`', '`min(speed, 10)`']) ok(t.includes(ex), `missing ${ex}`);
    ok(/Row functions[^\n]*`filter`, `count`, `sum`, `minBy`/.test(t), 'row functions');
    ok(!/Row functions[^\n]*: none/.test(t));
    ok(t.includes('## Operators') && t.includes('| 4 | `===`, `!==`'), 'operators');
  },
  'keys.md lists the nested keys of controls, links, bindings, actions and uses'() {
    const t = fs.readFileSync(path.join(repo, 'skill', '2.0', 'references', 'keys.md'), 'utf8');
    ok(t.includes('## Nested keys'));
    for (const h of ['### controls:', '### story.links:', '### bindings:', '### actions:', '### uses:']) ok(t.includes(h), h);
    for (const k of ['| `held` |', '| `afterMs` |', '| `glide` |', '| `into` |']) ok(t.includes(k), k);
  },
});
