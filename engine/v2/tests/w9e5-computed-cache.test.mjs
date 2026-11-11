// Computed values are cached (5.2). A computed is evaluated again only when a name it reads changes; a
// cached read costs no formula steps; no stale result is ever read; E-CYCLE still faults.
import { Engine } from '../src/runtime.mjs';
import { FORMAT } from '../src/limits.mjs';
import { eq, ok } from './helpers.mjs';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" data-hsvg-version="2.0"><rect id="x" width="1" height="1"/></svg>';
const N = (initial = 0) => ({ type: 'number', initial, minimum: 0, maximum: 1e6 });
// heavy: a computed whose evaluation costs many steps, so one evaluation is easy to tell from two.
const COMPUTED = {
  heavy: 'sum(range(200), a + item)',
  twice: 'heavy * 2',
  label: "words.hi + ' ' + numberText(a, 0)",
  other: 'b + 1',
  loopA: 'loopB + 1', loopB: 'loopA + 1',
  visited: "visits.one",
  clock: 'now + sum(range(50), item)',
  huge: 'sum(range(1024), sum(range(100), item))',
};
const exp = () => ({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', story: { start: 'one', scenes: { one: 'one.json' } } },
  words: { en: { hi: 'Hello' }, fr: { hi: 'Bonjour' } }, data: {},
  scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg', values: { a: N(1), b: N(2) }, computed: COMPUTED }, words: {}, drawings: { main: { text: svg } } } },
  blocks: {}, limits: { ...FORMAT },
});
const started = () => { const e = new Engine(exp()); ok(e.transaction('host', () => e.mount('one', 'scene', 'one')).ok); return e; };
// The formula steps one evaluation of f costs, and its result.
const cost = (e, f) => e.outside(() => { const v = e.eval('one', f); return [e.budget.steps, v]; });
const set = (e, n, v) => ok(e.transaction('host', () => e.runActions('one', [{ set: n, value: v }], 'test')).ok);

export const tests = {
  'E5 a computed read twice in one evaluation is evaluated once'() {
    const e = started();
    const [one] = cost(started(), 'heavy');
    const [two, v] = cost(e, 'heavy + heavy');
    eq(v, 2 * (200 * 1 + 199 * 100));
    ok(two < one + 10, `the second read costs no formula steps (one read ${one}, two reads ${two})`);
  },
  'E5 a cached read costs no formula steps in a later evaluation (a later paint)'() {
    const e = started();
    const [first] = cost(e, 'heavy');
    const [again] = cost(e, 'heavy');
    ok(first > 200, `the first read evaluates (${first})`);
    eq(again, 1, 'a cached read is one name step');
  },
  'E5 a write to a name it reads makes the next read evaluate again'() {
    const e = started();
    eq(cost(e, 'heavy')[1], 19900 + 200);
    set(e, 'a', 3);
    const [steps, v] = cost(e, 'heavy');
    eq(v, 19900 + 600, 'the new result, never the old one');
    ok(steps > 200, 'evaluated again');
    // A direct change of state (a test, a host restoring state) is seen too.
    e.state.blocks.one.values.a = 0;
    eq(cost(e, 'heavy')[1], 19900);
  },
  'E5 inside a transaction, the next read after a write sees the new result'() {
    const e = started();
    let seen;
    ok(e.transaction('host', () => { const x = e.eval('one', 'heavy'); e.runActions('one', [{ set: 'a', value: 5 }], 'test'); seen = [x, e.eval('one', 'heavy')]; }).ok);
    eq(seen, [20100, 19900 + 1000]);
  },
  'E5 a write to a name it does not read keeps the cache'() {
    const e = started();
    cost(e, 'heavy');
    set(e, 'b', 9);
    eq(cost(e, 'heavy')[0], 1, 'still cached');
    eq(cost(e, 'other')[1], 10);
  },
  'E5 a chain (a computed reading a computed) refreshes end to end'() {
    const e = started();
    eq(cost(e, 'twice')[1], 40200);
    eq(cost(e, 'twice')[0], 1, 'cached');
    set(e, 'a', 2);
    eq(cost(e, 'twice')[1], 2 * (19900 + 400));
    eq(cost(e, 'heavy')[0], 1, 'the inner one was evaluated again once, and is cached again');
  },
  'E5 a language change refreshes a computed that reads words'() {
    const e = started();
    eq(cost(e, 'label')[1], 'Hello 1');
    eq(cost(e, 'label')[0], 1, 'cached');
    e.state.ambient.language = 'fr';
    eq(cost(e, 'label')[1], 'Bonjour 1');
    e.state.ambient.language = 'en';
    eq(cost(e, 'label')[1], 'Hello 1');
  },
  'E5 visits changed in place refresh a computed that reads them'() {
    const e = started();
    e.state.story = { visits: { one: 0 }, stack: [] };
    eq(cost(e, 'visited')[1], 0);
    e.state.story.visits.one = 2;
    eq(cost(e, 'visited')[1], 2);
  },
  'E5 a block mounted again starts with no cached result'() {
    const e = started();
    set(e, 'a', 4);
    eq(cost(e, 'heavy')[1], 19900 + 800);
    ok(e.transaction('host', () => { e.unmount('one'); e.mount('one', 'scene', 'one'); }).ok);
    eq(cost(e, 'heavy')[1], 19900 + 200, 'the fresh block reads its fresh value');
  },
  'E5 item 2: an evaluation charges what it charged before; a cached read charges one name step'() {
    const e = started();
    const [inline] = cost(e, 'sum(range(200), a + item)');
    eq(cost(e, 'heavy')[0], inline + 1, 'the first read: the name, then the whole formula');
    eq(cost(e, 'heavy')[0], 1, 'a cached read: the name only');
    set(e, 'a', 2);
    eq(cost(e, 'heavy')[0], inline + 1, 'after a write it reads: the whole formula again');
    eq(cost(e, 'heavy + heavy')[0], 3, 'two cached reads and a +');
  },
  'E5 item 2: a computed over its step budget faults at every read (a fault is never cached)'() {
    const e = started();
    for (let i = 0; i < 2; i++) {
      let code = null;
      try { e.outside(() => e.eval('one', 'huge')); } catch (err) { code = err.code; }
      eq(code, 'E-RANGE');
    }
  },
  'E5 a computed that reads now is not cached'() {
    const e = started();
    const [first] = cost(e, 'clock');
    const [again] = cost(e, 'clock');
    ok(first > 50 && again === first, `evaluated at each read (${first}, ${again})`);
  },
  'E5 E-CYCLE still faults, every time'() {
    const e = started();
    for (let i = 0; i < 2; i++) {
      let code = null;
      try { e.outside(() => e.eval('one', 'loopA')); } catch (err) { code = err.code; }
      eq(code, 'E-CYCLE');
    }
  },
  'E5 a computed that faults is not cached'() {
    const e = new Engine(exp());
    e.exp.scenes.one.doc.computed.bad = 'a / 0 > 1 ? x : 1';
    ok(e.transaction('host', () => e.mount('one', 'scene', 'one')).ok);
    let code = null;
    try { e.outside(() => e.eval('one', 'bad')); } catch (err) { code = err.code; }
    ok(code, 'faults');
    set(e, 'a', 0);
    code = null;
    try { e.outside(() => e.eval('one', 'bad')); } catch (err) { code = err.code; }
    ok(code, 'faults again (evaluated again, not a cached fault or result)');
  },
};
