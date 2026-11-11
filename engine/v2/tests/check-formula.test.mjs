// The formula proofs of the 2.0 checker (engine/v2/check/formula/): names and scopes (5.1.3), types (5.6.3) and ranges
// (5.6.7). Each rule has a valid case that passes and one change that fails with exactly the code the spec gives.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkExperience } from '../check/index.mjs';
import { infer } from '../check/formula/infer.mjs';
import { parse } from '../src/formula.mjs';
import { EFFECT_PARAMS } from '../check/formula/params.mjs';
import { schemas, eq, ok, mapSource, spec, repo } from './helpers.mjs';

const svg = (body, kind = 'screen') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hsvg-version="2.0"${kind ? ` data-hsvg-kind="${kind}"` : ''}>${body}</svg>`;
const sceneSvg = svg('<rect id="go" data-hsvg-kind="part" data-hsvg-pivot="5 5" data-hsvg-motion="rotate -90..90; move-x -10..10; opacity 0..1" width="10" height="10"/>'
  + '<g id="spin" data-hsvg-kind="part" data-hsvg-pivot="5 5" data-hsvg-motion="rotate *"><rect width="4" height="4"/></g>'
  + '<g id="plain" data-hsvg-kind="part"><rect width="4" height="4"/></g>'
  + '<g id="mouth" data-hsvg-kind="part" data-hsvg-pivot="50 50"><g data-hsvg-variant="closed"><rect width="5" height="5"/></g><g data-hsvg-variant="open" display="none"><rect width="6" height="6"/></g></g>');
const badgeSvg = svg('<g id="badge" data-hsvg-kind="component"><g id="badge__face" data-hsvg-kind="part"><rect width="5" height="5"/></g></g>', null);

function base() {
  return {
    'experience.json': {
      format: 'hsvg/2.0', kind: 'experience', id: 'tiny', language: 'en',
      story: { start: 'one', scenes: { one: 'scenes/one/scene.json' }, ends: ['one'] },
      blocks: { badge: 'blocks/badge/component.json' },
      values: { flag: { type: 'boolean', initial: false } },
      inputs: { level: { kind: 'knob', type: 'number', minimum: 0, maximum: 3, initial: 1 } },
      computed: { twice: 'level * 2' },
    },
    'scenes/one/scene.json': {
      format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg',
      uses: [{ id: 'badge', use: 'badge', with: { title: "'Hi'" } }],
      values: { score: { type: 'number', initial: 0, minimum: 0, maximum: 9 }, label: { type: 'string', maxLength: 20, initial: 'a' }, speed: { type: 'number', minimum: -1000000, maximum: 1000000, initial: 1 } },
      inputs: { wait: { kind: 'knob', type: 'number', minimum: 100, maximum: 5000, initial: 500 } },
      computed: { double: 'score * 2', big: 'score > 3 || flag' },
      outputs: { done: { kind: 'event' }, points: { kind: 'result', type: 'number', minimum: 0, maximum: 20, value: 'double' } },
      controls: { go: { kind: 'button', target: 'go', label: 'Go {{ score }}', enabled: 'big' } },
      bindings: [
        { id: 'mouth-look', target: 'mouth', variant: "score > 0 ? 'open' : 'closed'" },
        { id: 'turn', target: 'go', rotate: 'clamp(score * 10, 0, 90)' },
      ],
      machines: [{ id: 'm', initial: 'a', states: { a: { after: [{ id: 't', delayMs: 'wait', target: 'b' }] }, b: {} } }],
      on: { 'press:go': [{ id: 'pressed', guard: 'score < 9', actions: [{ id: 'count', set: 'score', to: 'score + 1' }, { id: 'say', set: 'label', to: "'x'" }, { id: 'fin', emit: 'done' }] }] },
    },
    'scenes/one/one.svg': sceneSvg,
    'blocks/badge/component.json': {
      format: 'hsvg/2.0', kind: 'component', id: 'badge', drawing: 'badge.svg',
      inputs: { title: { kind: 'content', type: 'string', maxLength: 20 }, hidden: { kind: 'knob', type: 'boolean', initial: false } },
      outputs: { shown: { kind: 'result', type: 'boolean', value: '!hidden' } },
    },
    'blocks/badge/badge.svg': badgeSvg,
  };
}
const ROWS = { type: 'array', maxItems: 8, initial: [], items: { type: 'object', properties: { id: { type: 'string', maxLength: 8 }, n: { type: 'number', minimum: 0, maximum: 9 } }, required: ['id', 'n'], additionalProperties: false } };
const scene = (f) => f['scenes/one/scene.json'];
const badge = (f) => f['blocks/badge/component.json'];
const run = (files) => checkExperience(mapSource(files), schemas(), { only: ['formula'] }).diags;
const codes = (files) => run(files).map(d => d.code);
const fails = (files, code, count = 1) => { const d = run(files); eq(d.map(x => x.code), Array(count).fill(code), d.map(x => x.message).join(' | ')); };
const withEv = (f, guard) => { scene(f).on['press:go'][0].guard = guard; return f; };
const withComputed = (f, name, src) => { scene(f).computed[name] = src; return f; };

// type of a formula, with names given as { name: type }
const T = (src, names = {}) => {
  const reports = [];
  const t = infer(parse(src), { name: (n) => names[n], eventOk: false, states: new Set(), uses: () => undefined }, (k, m) => reports.push(`${k}: ${m}`));
  return { t, reports };
};
const num = (lo, hi) => ({ t: 'number', lo, hi });
const range = (src, names) => { const { t } = T(src, names); return t.t === 'number' ? [t.lo, t.hi] : t.t; };

export const tests = {
  'the base experience passes every formula rule'() { eq(codes(base()), []); eq(run(base()).length, 0); },

  // ---------- 5.6.2 / 5.6.4: E-FORMULA ----------
  'a formula that does not parse is E-FORMULA'() { fails(withEv(base(), 'score == 1'), 'E-FORMULA'); },
  'a call outside the closed list is E-FORMULA'() { fails(withComputed(base(), 'x', 'tan(score)'), 'E-FORMULA'); },
  'assignment, methods and backtick strings are E-FORMULA'() {
    for (const bad of ['score = 1', 'label.toUpperCase()', '`a`', 'score and 1']) fails(withComputed(base(), 'x', bad), 'E-FORMULA');
  },
  'a function with the wrong argument count is E-FORMULA'() { fails(withComputed(base(), 'x', 'clamp(score, 1)'), 'E-FORMULA'); },
  'a template with an unclosed span is E-FORMULA'() { const f = base(); scene(f).controls.go.label = 'Go {{ score'; fails(f, 'E-FORMULA'); },
  'a formula over the source budget is E-RANGE'() { fails(withComputed(base(), 'x', `${'1 + '.repeat(1100)}1`), 'E-RANGE'); },

  // ---------- 5.1.3, 5.6.7: names and scopes ----------
  'an unknown name is E-REF-UNKNOWN in a computed value, a guard, a binding and a template'() {
    fails(withComputed(base(), 'x', 'settingsOpen'), 'E-REF-UNKNOWN');
    fails(withEv(base(), 'settingsOpen'), 'E-REF-UNKNOWN');
    const b = base(); scene(b).bindings[0].variant = 'settingsOpen ? "open" : "closed"'; fails(b, 'E-REF-UNKNOWN');
    const t = base(); scene(t).controls.go.label = 'Go {{ settingsOpen }}'; fails(t, 'E-REF-UNKNOWN');
  },
  'a shell formula copied with a name its block lacks is caught (settingsOpen)'() {
    const f = base(); badge(f).computed = { open: 'settingsOpen' }; fails(f, 'E-REF-UNKNOWN');
  },
  'a scene reads the experience values, computed values and inputs'() {
    const f = base(); withComputed(f, 'x', 'flag && twice > level'); eq(codes(f), []);
  },
  'a component that reads an experience name is E-REF-PRIVATE'() {
    const f = base(); badge(f).computed = { open: 'flag' }; fails(f, 'E-REF-PRIVATE');
  },
  'a component that reads an experience data table is E-REF-PRIVATE'() {
    const f = base(); f['experience.json'].data = { rows: { resource: 'rows' } }; badge(f).computed = { n: 'length(data.rows)' };
    ok(codes(f).includes('E-REF-PRIVATE'), codes(f));
  },
  'ambient inputs are readable by every block'() {
    const f = base(); badge(f).computed = { fast: 'reducedMotion || inputMode === "touch" || volume > 0.5 || size.width > 10 || language === "en"' }; eq(codes(f), []);
  },
  'an ambient name cannot be a member that does not exist'() { fails(withComputed(base(), 'x', 'size.depth'), 'E-REF-UNKNOWN'); },
  'event is readable only while an event is handled'() {
    eq(codes(withEv(base(), 'event.ok === true')), []);
    fails(withComputed(base(), 'x', 'event.ok'), 'E-REF-UNKNOWN');
    const b = base(); scene(b).bindings.push({ id: 'vis', target: 'mouth', visible: 'event.ok' }); fails(b, 'E-REF-UNKNOWN');
  },
  'item and index are readable in repeated uses and row functions only'() {
    const f = base(); scene(f).values.rows = { type: 'array', items: { type: 'number', minimum: 0, maximum: 9 }, maxItems: 8, initial: [] };
    scene(f).uses[0].items = 'rows'; scene(f).uses[0].key = 'index'; scene(f).uses[0].with.title = "'Hi'"; eq(codes(f), []);
    fails(withComputed(base(), 'x', 'item'), 'E-REF-UNKNOWN');
    const g = base(); scene(g).values.rows = { type: 'array', items: { type: 'number', minimum: 0, maximum: 9 }, maxItems: 8, initial: [] }; withComputed(g, 'total', 'sum(rows, item * 2) + count(rows, item > index)'); eq(codes(g), []);
  },
  'a use output is readable; an input of the use is E-REF-PRIVATE; no such output is E-REF-UNKNOWN'() {
    eq(codes(withComputed(base(), 'x', "uses['badge'].shown")), []);
    fails(withComputed(base(), 'x', "uses['badge'].hidden"), 'E-REF-PRIVATE');
    fails(withComputed(base(), 'x', "uses['badge'].nothing"), 'E-REF-UNKNOWN');
    fails(withComputed(base(), 'x', "uses['nobody'].shown"), 'E-REF-UNKNOWN');
  },
  'active() takes a state of this block'() {
    eq(codes(withComputed(base(), 'x', "active('a') || active('b')")), []);
    fails(withComputed(base(), 'x', "active('zed')"), 'E-REF-UNKNOWN');
    fails(withComputed(base(), 'x', 'active(label)'), 'E-FORMULA');
  },
  'a link reads the event, the from scene interface and the experience values'() {
    const f = base(); f['experience.json'].story.scenes.two = 'scenes/two/scene.json'; f['experience.json'].story.links = [{ id: 'a', from: 'one', on: 'done', to: 'two', when: 'event.n > 1 && points >= 0 && flag', carry: { start: 'points' } }];
    f['scenes/two/scene.json'] = { format: 'hsvg/2.0', kind: 'scene', id: 'two', drawing: 'two.svg', inputs: { start: { kind: 'content', type: 'number', minimum: 0, maximum: 99, initial: 0 } } };
    f['scenes/two/two.svg'] = svg('<rect id="r" data-hsvg-kind="part" width="1" height="1"/>');
    eq(codes(f), []);
    f['experience.json'].story.links[0].when = 'score > 1'; fails(f, 'E-REF-UNKNOWN');
  },
  'a link name found in two places is E-NAME-SHADOW'() {
    const f = base(); f['experience.json'].story.scenes.two = 'scenes/two/scene.json'; f['experience.json'].story.links = [{ id: 'a', from: 'one', on: 'done', to: 'two', when: 'flag' }];
    scene(f).outputs.flag = { kind: 'result', type: 'boolean', value: 'true' };
    f['scenes/two/scene.json'] = { format: 'hsvg/2.0', kind: 'scene', id: 'two', drawing: 'two.svg' };
    f['scenes/two/two.svg'] = svg('<rect id="r" data-hsvg-kind="part" width="1" height="1"/>');
    ok(codes(f).includes('E-NAME-SHADOW'), codes(f));
  },
  'a start when reads experience values, not the event'() {
    const f = base(); f['experience.json'].story.start = [{ to: 'one', when: 'flag' }, { to: 'one' }]; eq(codes(f), []);
    f['experience.json'].story.start[0].when = 'event.x'; fails(f, 'E-REF-UNKNOWN');
  },
  'computed values that read each other are E-CYCLE'() {
    const f = base(); withComputed(f, 'p', 'q + 1'); withComputed(f, 'q', 'p + 1'); eq(codes(f).filter(c => c === 'E-CYCLE').length, 1);
  },

  // ---------- 5.6.3, 5.6.7: types ----------
  'a guard, if and visible need booleans (E-TYPE)'() {
    fails(withEv(base(), 'score'), 'E-TYPE');
    const a = base(); scene(a).on['press:go'][0].actions.push({ id: 'cond', if: 'score + 1', then: [{ id: 'e2', emit: 'done' }] }); fails(a, 'E-TYPE');
    const v = base(); scene(v).bindings[0] = { id: 'vis', target: 'mouth', visible: "'yes'" }; fails(v, 'E-TYPE');
    const e = base(); scene(e).controls.go.enabled = 'score'; fails(e, 'E-TYPE');
  },
  'delayMs and channel values need numbers (E-TYPE)'() {
    const d = base(); scene(d).machines[0].states.a.after[0].delayMs = 'flag'; ok(codes(d).includes('E-TYPE'), codes(d));
    const c = base(); scene(c).bindings[1].rotate = "'ninety'"; ok(codes(c).includes('E-TYPE'), codes(c));
  },
  'a look binding needs a look name, a colour needs a role name (E-TYPE)'() {
    const f = base(); scene(f).bindings[0].variant = 'score'; fails(f, 'E-TYPE');
    const g = base(); scene(g).bindings.push({ id: 'paint', target: 'mouth', color: 'flag' }); fails(g, 'E-TYPE');
  },
  'no coercion but one: + joins text and a number (D36); text plus true is E-TYPE'() { eq(codes(withComputed(base(), 'x', "'3' + 1")), []); fails(withComputed(base(), 'x', "'3' + flag"), 'E-TYPE'); fails(withComputed(base(), 'x', "!'a'"), 'E-TYPE'); fails(withComputed(base(), 'x', 'score && flag'), 'E-TYPE'); },
  'a conditional needs a boolean test and checks every branch'() { fails(withComputed(base(), 'x', "score ? 1 : 2"), 'E-TYPE'); fails(withComputed(base(), 'x', "flag ? 1 : label + flag"), 'E-TYPE'); },
  'function arguments are typed'() {
    fails(withComputed(base(), 'x', "floor(label)"), 'E-TYPE');
    fails(withComputed(base(), 'x', "length(flag)"), 'E-TYPE');
    fails(withComputed(base(), 'x', "filter(score, item)"), 'E-TYPE');
    eq(codes(withComputed(base(), 'x', "min(1, 2, score) + max(score, 3) + length(label) + round(2.5)")), []);
  },
  'a set writes a value of its type; a with supplies an input of its type'() {
    const f = base(); scene(f).on['press:go'][0].actions[1].to = '3'; fails(f, 'E-TYPE');
    const g = base(); scene(g).uses[0].with.title = '7'; fails(g, 'E-TYPE');
    const h = base(); scene(h).on['press:go'][0].actions[1].to = "'b'"; eq(codes(h), []);
  },
  'a result output fits its declared type'() { const f = base(); scene(f).outputs.points.value = "'many'"; ok(codes(f).includes('E-TYPE'), codes(f)); },
  'a string literal outside an enum is E-RANGE'() {
    const f = base(); scene(f).values.label = { type: 'string', maxLength: 5, enum: ['a', 'b'], initial: 'a' }; scene(f).on['press:go'][0].actions[1].to = "'c'"; fails(f, 'E-RANGE');
  },
  'a template span cannot print an object or an array'() { const f = base(); scene(f).values.rows = { type: 'array', items: { type: 'number', minimum: 0, maximum: 9 }, maxItems: 8, initial: [] }; scene(f).controls.go.label = '{{ rows }}'; fails(f, 'E-TYPE'); },

  // ---------- 5.6.2: null ----------
  'a lookup with a null fallback must be narrowed'() {
    const g = base(); scene(g).values.rows = ROWS;
    withComputed(g, 'ok1', "lookup(rows, 'id', label, null) === null ? 0 : lookup(rows, 'id', label, null).n");
    withComputed(g, 'ok2', "lookup(rows, 'id', label, null) !== null ? lookup(rows, 'id', label, null).n : 0");
    eq(codes(g), []);
    const h = base(); scene(h).values.rows = ROWS;
    withComputed(h, 'bad', "lookup(rows, 'id', label, null).n"); fails(h, 'E-TYPE');
    const k = base(); scene(k).values.rows = ROWS;
    withComputed(k, 'stored', "lookup(rows, 'id', label, null)"); fails(k, 'E-TYPE');
  },

  // ---------- 5.6.7: ranges ----------
  'interval rules: + - * / and the spec worked cases'() {
    const x = { x: num(-1, 1), a: num(2, 3), b: num(-2, 4), n: num(0, 5), k: { t: 'number', lo: -Infinity, hi: Infinity } };
    eq(range('a + b', x), [0, 7]); eq(range('a - b', x), [-2, 5]); eq(range('a * b', x), [-6, 12]); eq(range('a / 2', x), [1, 1.5]);
    eq(range('-a', x), [-3, -2]);
    eq(range('x / x', x), [-Infinity, Infinity]);
    ok(T('x / x', x).t.why.includes('spans zero'));
    eq(range('n % 3', x), [0, 3]); eq(range('b % 3', x), [-Infinity, Infinity]); eq(range('n % b', x), [-Infinity, Infinity]);
  },
  'pow follows the spec cases (5.6.7)'() {
    const x = { x: num(-1, 1), level: { t: 'number', lo: -Infinity, hi: Infinity }, p: num(2, 3), q: num(-3, -2), z: num(-2, 3) };
    eq(range('pow(x, 2)', x), [0, 1]); eq(range('pow(x, 0)', x), [1, 1]); eq(range('pow(x, 3)', x), [-1, 1]);
    eq(range('pow(x, 0.5)', x), [-Infinity, Infinity]); eq(range('pow(clamp(x, 0, 1), 0.5)', x), [0, 1]);
    eq(range('pow(2, clamp(level, 0, 10))', x), [1, 1024]); eq(range('pow(2, level)', x), [-Infinity, Infinity]);
    eq(range('pow(p, -1)', x), [1 / 3, 1 / 2]); eq(range('pow(z, -1)', x), [-Infinity, Infinity]); eq(range('pow(z, 2)', x), [0, 9]);
    eq(range('pow(0.5, clamp(level, 0, 2))', x), [0.25, 1]); eq(range('pow(1, clamp(level, 0, 5))', x), [1, 1]); eq(range('pow(1, level)', x), [-Infinity, Infinity]);
  },
  'clamp, min, max, floor, ceil, round and conditionals pass bounds through'() {
    const x = { v: num(-5, 5), lo: num(0, 1), u: { t: 'number', lo: -Infinity, hi: Infinity }, flag: { t: 'boolean' } };
    eq(range('clamp(u, 0, 10)', x), [0, 10]); eq(range('clamp(v, lo, 3)', x), [0, 3]); eq(range('min(v, 2)', x), [-5, 2]); eq(range('max(v, 2)', x), [2, 5]);
    eq(range('floor(2.7)', x), [2, 2]); eq(range('ceil(v / 2)', x), [-2, 3]); eq(range('round(0.5)', x), [1, 1]);
    eq(range('flag ? 1 : 9', x), [1, 9]); eq(range('flag ? v : u', x), [-Infinity, Infinity]);
    eq(range('[1.1, 1.5, 1.9][v]', x), [1.1, 1.9]);
  },
  'length, count, sum, index, at, lookup and random give bounds'() {
    const x = { list: { t: 'array', item: num(1, 4) }, flag: { t: 'boolean' } };
    eq(range('length(list)', x), [0, 1024]); eq(range('count(list, item > 1)', x), [0, 1024]);
    eq(range('sum(list, item)', x), [0, 4096]); eq(range('sum(list, item - 5)', x), [-4096, 0]);
    eq(range('at(list, 0, 9)', x), [1, 9]); eq(range('random(0, 1, 7)', x), [0, 1]);
    eq(range('sum(list, index)', x), [0, 1024 * 1023]);
    eq(range('length([1, 2, 3])', x), [0, 3]);
  },
  'unbounded sources are unbounded: elapsed, now, size, visits, event'() {
    for (const src of ['elapsed', 'now', 'size.width', "visits['hub']"]) {
      const f = base(); scene(f).machines[0].states.a.after[0].delayMs = src; fails(f, 'E-RANGE');
    }
    const v = base(); scene(v).on['press:go'][0].guard = 'event.n > 1'; eq(codes(v), []);
    const volume = base(); scene(volume).bindings[1].rotate = 'volume * 90'; eq(codes(volume), []);
  },
  'delayMs must be proven inside 1..3,600,000 (E-RANGE)'() {
    const f = base(); scene(f).machines[0].states.a.after[0].delayMs = 'wait'; eq(codes(f), []);
    scene(f).machines[0].states.a.after[0].delayMs = 'wait * 100000'; fails(f, 'E-RANGE');
    scene(f).machines[0].states.a.after[0].delayMs = 'clamp(speed, 1, 3600000)'; eq(codes(f), []);
    scene(f).machines[0].states.a.after[0].delayMs = 0; ok(codes(f).includes('E-RANGE'), codes(f));
    scene(f).machines[0].states.a.after[0].delayMs = 'speed'; fails(f, 'E-RANGE');
  },
  'the E-RANGE message tells the range found'() {
    const f = base(); scene(f).machines[0].states.a.after[0].delayMs = 'wait * 100000';
    ok(run(f)[0].message.includes('10000000..500000000'), run(f)[0].message);
  },
  'a link afterMs formula must be proven inside 1..3,600,000 (E-RANGE)'() {
    const f = base(); f['experience.json'].story.links = [{ id: 'a', from: 'one', afterMs: 'clamp(level * 1000, 1, 5000)', to: 'one' }]; eq(codes(f), []);
    f['experience.json'].story.links[0].afterMs = 'level * 1000000'; fails(f, 'E-RANGE');
  },
  'a clock speed must be proven inside 0.01..100 (E-CLOCK-SPEED)'() {
    const f = base(); scene(f).uses[0].clock = { speed: 'clamp(speed, 0.5, 2)' }; eq(codes(f), []);
    scene(f).uses[0].clock = { speed: 'speed' }; fails(f, 'E-CLOCK-SPEED');
    scene(f).uses[0].clock = { speed: 'level' }; fails(f, 'E-CLOCK-SPEED'); // 0..3 reaches 0, which is outside 0.01..100
  },
  'a clip speed formula must be proven inside 0.01..100 (E-RANGE)'() {
    const f = base(); scene(f).clips = { spin: { durationMs: 500, speed: '[1.1, 1.5, 1.9][level]', tracks: [{ id: 't', target: 'spin', channel: 'rotate', keys: [[0, 0], [500, 360]] }] } }; eq(codes(f), []);
    scene(f).clips.spin.speed = 'speed'; fails(f, 'E-RANGE');
  },
  'a result output must lie inside its declared bounds (E-RANGE)'() {
    const f = base(); scene(f).outputs.points.value = 'double + 100'; fails(f, 'E-RANGE');
  },
  'a binding channel value must be proven inside the part motion range (E-MOTION-RANGE)'() {
    const f = base(); scene(f).bindings[1].rotate = 'score * 20'; fails(f, 'E-MOTION-RANGE');
    scene(f).bindings[1].rotate = 'speed'; fails(f, 'E-MOTION-RANGE');
    scene(f).bindings[1].rotate = 'clamp(speed, -90, 90)'; eq(codes(f), []);
  },
  'rotate(*) is free; a part with no range, or no range for the channel, is E-MOTION-RANGE'() {
    const f = base(); scene(f).bindings.push({ id: 'free', target: 'spin', rotate: 'speed' }); eq(codes(f), []);
    scene(f).bindings.push({ id: 'none', target: 'plain', rotate: '0' }); fails(f, 'E-MOTION-RANGE');
    const g = base(); scene(g).bindings.push({ id: 'noch', target: 'go', scale: '1' }); fails(g, 'E-MOTION-RANGE');
  },
  'translate and scale ranges cover their axes'() {
    const f = base(); f['scenes/one/one.svg'] = sceneSvg.replace('move-x -10..10', 'move-x -10..10; move-y -10..10; scale 0.5..2');
    scene(f).bindings.push({ id: 'ty', target: 'go', axis: 'y', move: 'clamp(speed, -10, 10)' }, { id: 'sx', target: 'go', axis: 'x', scale: 'clamp(speed, 0.5, 2)' });
    eq(codes(f), []);
    scene(f).bindings[2].move = 'clamp(speed, -11, 10)'; fails(f, 'E-MOTION-RANGE');
  },
  'clip keys, including stagger targets, are proven inside the motion range (E-MOTION-RANGE)'() {
    const f = base(); scene(f).clips = { turn: { durationMs: 500, tracks: [{ id: 't', target: 'go', channel: 'rotate', keys: [[0, 0], [500, 90]] }] } }; eq(codes(f), []);
    scene(f).clips.turn.tracks[0].keys[1][1] = 91; fails(f, 'E-MOTION-RANGE');
    scene(f).clips.turn.tracks[0].keys[1][1] = 45; scene(f).clips.turn.tracks[0].stagger = { targets: ['plain'], eachMs: 10 }; fails(f, 'E-MOTION-RANGE', 1); // both keys, one cause: one finding (F0b)
  },
  'the look channel needs a string and no range'() {
    const f = base(); scene(f).bindings.push({ id: 'lk', target: 'mouth', variant: "'open'" }); eq(codes(f), []);
    scene(f).bindings[2].variant = '1'; fails(f, 'E-TYPE');
  },
  'a rule parameter written as a formula reads the document names'() {
    const f = base(); scene(f).rules = [{ id: 'cap', kind: 'limit', subject: 'input:wait', maximum: 'wait', strength: 'should' }]; eq(codes(f), []);
    scene(f).rules[0].maximum = 'nothing'; fails(f, 'E-REF-UNKNOWN');
  },

  'effect parameters are proven inside their stated range (E-RANGE)'() {
    const f = base(); f['experience.json'].needs = ['effects'];
    scene(f).addons = { effects: { particles: {} } };
    const fx = scene(f).addons.effects.particles;
    fx.fx = { target: 'go', source: 'dot', seed: 1, count: 4, position: [1, 'score'], lifeMs: 'clamp(speed, 1, 5000)', reducedMotion: 'rest' };
    eq(codes(f), []);
    fx.fx.lifeMs = 'speed'; fails(f, 'E-RANGE');
  },
  'the parameter table matches the capability schemas'() {
    const eff = JSON.parse(fs.readFileSync(path.join(spec, 'schemas', 'capabilities', 'effects.schema.json'), 'utf8'));
    const rng = (p) => { const n = p.oneOf ? p.oneOf.find(x => x.type === 'number' || x.type === 'integer') : (p.type === 'number' || p.type === 'integer' ? p : null); return n && typeof n.minimum === 'number' ? [n.minimum, n.maximum] : null; };
    const want = {};
    for (const [k, pocket] of Object.entries(eff.$defs)) {
      if (k !== 'addons:effects') continue;
      const d = pocket.properties.particles.additionalProperties; // addons.effects.particles (D31)
      const o = {};
      for (const [pk, p] of Object.entries(d.properties)) {
        if (pk === 'kind' || pk === 'target') continue;
        if (p.type === 'array' && p.items) { const r = rng(p.items); if (r) o[pk] = { each: r }; } else { const r = rng(p); if (r) o[pk] = { range: r, formula: !!(p.oneOf && p.oneOf.some(x => x.type === 'string')) }; }
      }
      want.particles = o;
    }
    eq(EFFECT_PARAMS, want);
  },

  // ---------- the spec text and the example documents ----------
  'every function example in the spec parses (5.6.4)'() {
    const text = fs.readFileSync(path.join(spec, '05-faces-and-body.md'), 'utf8');
    const section = text.slice(text.indexOf('### 5.6.4'), text.indexOf('### 5.6.5'));
    const examples = [...section.matchAll(/\| .*?: `([^`|]+\([^`|]*\))`/g)].map(m => m[1]);
    ok(examples.length >= 15, `found ${examples.length} examples`);
    for (const src of examples) parse(src);
  },
  'the worked formulas of 5.2 and 5.6.1 parse'() {
    for (const src of ["phase === 'done' && tries < 3", 'min(score, 3)', "'ready'", 'ready', 'pow(2, clamp(level, 0, 10))']) parse(src);
  },
  'every code the formula and rules checks can report is in errors.json'() {
    const known = new Set(JSON.parse(fs.readFileSync(path.join(spec, 'errors.json'), 'utf8')).codes.map(c => c.code));
    const here = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'check');
    const files = ['formula/index.mjs', 'formula/infer.mjs', 'formula/sites.mjs', 'formula/motion.mjs', 'rules/index.mjs', 'rules/combine.mjs', 'rules/tables.mjs', 'rules/playing.mjs'];
    for (const f of files) for (const m of fs.readFileSync(path.join(here, f), 'utf8').matchAll(/'(E-[A-Z0-9-]+)'/g)) ok(known.has(m[1]), `${f}: ${m[1]} is not in errors.json`);
  },
};
