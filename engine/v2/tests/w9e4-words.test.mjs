// Words cost nothing when unread (2.7). The words map is one per (block definition, language),
// reused across evaluations and built again after a language change; a scope's `words` value is a small view over
// it; the text, the language fallbacks, rendering in the reading scope and E-CYCLE stay as they were.
import { Engine } from '../src/runtime.mjs';
import { FORMAT } from '../src/limits.mjs';
import { parse, evaluate } from '../src/formula.mjs';
import { eq, ok } from './helpers.mjs';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" data-hsvg-version="2.0"><rect id="x" width="1" height="1"/></svg>';
const N = (initial = 0) => ({ type: 'number', initial, minimum: 0, maximum: 1e6 });
const exp = (scene = {}, { words = { en: { hi: 'Hello', who: 'world', n: '{{ count }} left' }, fr: { hi: 'Bonjour' } }, sceneWords = { en: { who: 'scene world' }, 'fr-ca': { who: 'monde' } } } = {}) => ({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', story: { start: 'one', scenes: { one: 'one.json' } } },
  words, data: {},
  scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg', values: { count: N(3), t: N() }, ...scene }, words: sceneWords, drawings: { main: { text: svg } } } },
  blocks: {}, limits: { ...FORMAT },
});
const started = (scene, opts) => { const e = new Engine(exp(scene, opts)); ok(e.transaction('host', () => e.mount('one', 'scene', 'one')).ok); return e; };
const text = (e, t) => e.template('one', t);

export const tests = {
  'E4.1 the words map is reused across evaluations and calls'() {
    const e = started();
    const a = e.words('one');
    text(e, '{{ words.hi }}'); text(e, '{{ words.who }}');
    ok(e.words('one') === a, 'the same map, not a new one per call');
    ok(Object.isFrozen(a), 'the shared map cannot be changed by a reader');
  },
  'E4.1 the words map is built again after a language change, and back'() {
    const e = started();
    const en = e.words('one');
    eq(text(e, '{{ words.hi }} {{ words.who }}'), 'Hello scene world');
    e.state.ambient.language = 'fr-ca';
    const fr = e.words('one');
    ok(fr !== en, 'a new map for the new language');
    eq(text(e, '{{ words.hi }} {{ words.who }}'), 'Bonjour monde', 'fr-ca: the experience falls back to fr, the scene has fr-ca');
    e.state.ambient.language = 'de';
    eq(text(e, '{{ words.hi }} {{ words.who }}'), 'Hello scene world', 'an unknown language falls back to the default');
    e.state.ambient.language = 'en';
    eq(e.words('one'), en);
  },
  'E4.1 new words objects are seen (a reload replaces them)'() {
    const e = started();
    e.words('one');
    e.exp.words = { en: { hi: 'Hi again' } };
    eq(text(e, '{{ words.hi }}'), 'Hi again');
  },
  'E4.1 a word renders in the scope that reads it, at each read'() {
    const e = started();
    eq(text(e, '{{ words.n }}'), '3 left');
    e.state.blocks.one.values.count = 7;
    eq(text(e, '{{ words.n }}'), '7 left');
    eq(e.eval('one', "words['n'] + '!'"), '7 left!');
    eq(e.eval('one', 'words.n', { count: 9 }), '9 left', 'a name given to the reading scope (a row, an event) is seen');
    eq(e.eval('one', 'words.n'), '7 left', 'and not kept for the next scope');
  },
  'E4.1 the words value reads as before: its ids, missing ids and no writes'() {
    const e = started();
    const w = e.outside(() => e.scope('one').builtin('words'));
    eq(Object.keys(w).sort(), ['hi', 'n', 'who']);
    eq(JSON.stringify(w), JSON.stringify({ hi: 'Hello', who: 'scene world', n: '3 left' }));
    ok(Object.prototype.hasOwnProperty.call(w, 'hi') && !Object.prototype.hasOwnProperty.call(w, 'nope'));
    let threw = false;
    try { 'use strict'; w.hi = 'x'; } catch { threw = true; }
    ok(threw, 'a write is refused');
    eq(e.eval('one', 'words.hi'), 'Hello');
  },
  'E4.1 a word that reads itself is still E-CYCLE'() {
    const e = started({}, { words: { en: { a: 'x{{ words.b }}', b: '{{ words.a }}' } }, sceneWords: {} });
    let err = null;
    try { text(e, '{{ words.a }}'); } catch (x) { err = x; }
    eq(err?.code, 'E-CYCLE', String(err));
  },
  'E4.1 a formula that reads no word does no word work'() {
    const e = started();
    let built = 0;
    const real = e.wordObject.bind(e);
    e.wordObject = (...a) => { built++; return real(...a); };
    for (let i = 0; i < 50; i++) e.eval('one', 'count * 2');
    eq(built, 0);
    // and one that reads words many times uses one map
    const first = e.words('one');
    for (let i = 0; i < 50; i++) text(e, '{{ words.hi }}');
    ok(e.words('one') === first);
  },
  // Item 2: the formula steps are counted without a getter per step; the results stay as they were.
  'E4.2 a meter\'s charge returns its steps, and the step limit still stops a formula'() {
    const e = started();
    e.budget = { steps: 0, phase: 'test' };
    try {
      const m = e.meter();
      eq(m.charge(5), m.steps);
      eq(m.charge(2), 7);
    } finally { e.budget = null; }
    let err = null;
    try { e.eval('one', 'fold(range(10000), 0, fold(range(10000), acc, acc + 1))'); } catch (x) { err = x; }
    ok(/E-RANGE|E-EVENT-LOOP/.test(err?.code), String(err));
  },
  'E4.2 min, max, range, sin and cos give what they gave'() {
    const v = (f) => evaluate(parse(f), { name: () => 0 });
    eq(v('min(3, -1, 2)'), -1); eq(v('max(3, -1, 2)'), 3);
    ok(Object.is(v('min(0, -0)'), -0) && Object.is(v('max(-0, 0)'), 0));
    eq(v('range(4)'), [0, 1, 2, 3]); eq(v('range(0)'), []); eq(v('range(2.9)'), [0, 1]);
    eq([v('sin(90)'), v('cos(180)'), v('sin(-90)'), v('cos(270)')], [1, -1, -1, 0]);
    eq(v('sin(30)'), Math.sin(Math.PI / 6));
  },
};
