// The transaction of 9.2 against the faults of the review (docs/spec-2.0-work/reviews/sol-review-2.0.md,
// findings 4, 5 and 6). Stored writes and listeners run in the deliver phase, after commit; the formula step budget
// is checked inside evaluation, and the binding phase has one too; the rollback is exact and cheap. No browser.
import { Engine as BaseEngine } from '../src/runtime.mjs';
import { granting } from './helpers.mjs';
const Engine = granting(BaseEngine); // a host that gives what the experience asks (D31: no profile, no grant)
import { Player as BasePlayer } from '../src/story.mjs';
const Player = granting(BasePlayer); // a host that gives what the experience asks (D31: no profile, no grant)
import { FORMAT } from '../src/limits.mjs';
import { hostApi } from '../src/host.mjs';
import { eq, ok } from './helpers.mjs';

// A tiny experience whose scene "one" has the keys given; the experience may declare values and a storage grant.
const experience = (scene = {}, exp = {}) => ({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', story: { start: 'one', scenes: { one: 'one.json' } }, ...exp },
  words: { en: {} }, data: {}, blocks: {},
  scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg', ...scene }, words: {}, drawings: { main: { text: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" data-hsvg-version="2.0"/>' } } } },
});
// About 3,000 formula steps from a short formula, over a list of 1,000 numbers.
const heavy = 'count(xs, item >= 0)';
const xs = { type: 'array', initial: Array.from({ length: 1000 }, (_, i) => i) };
const counter = { values: { xs, n: { type: 'number', initial: 0, minimum: 0, maximum: 1000000 } }, on: { go: [{ id: 'g', actions: [{ id: 'g1', set: 'n', to: 'n + 1' }] }] } };
const mapStore = () => { const m = new Map(); return { m, get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v), remove: (k) => m.delete(k) }; };

export const tests = {
  'deliver: a throwing listener does not roll back the committed step, and goes to the error callback (9.2)'() {
    const e = new Engine(experience(counter));
    ok(e.transaction('host', () => e.mount('one', 'scene', 'one')).ok);
    const errors = [];
    e.onDeliveryError = (d) => errors.push(d);
    let heard = 0;
    e.on(() => { throw new Error('host bug'); });
    e.on(() => { heard++; });
    const before = e.state.revision;
    const r = e.send('one', 'go');
    ok(r.ok, 'the step committed');
    eq(e.state.blocks.one.values.n, 1, 'the write stays');
    eq(e.state.revision, before + 1, 'the revision rose once');
    eq(heard, 1, 'the next listener still ran');
    eq(errors.map(d => [d.source, d.message]), [['listener', 'host bug']]);
  },
  'deliver: the host API routes deliver-phase failures to its onError (10.6)'() {
    const e = new Engine(experience(counter));
    e.transaction('host', () => e.mount('one', 'scene', 'one'));
    const errors = [];
    hostApi(e, { onError: (d) => errors.push(d) });
    e.on(() => { throw Object.assign(new Error('audio bug'), { code: 'X' }); });
    ok(e.send('one', 'go').ok);
    eq(errors, [{ code: 'X', message: 'audio bug', source: 'listener' }]);
  },
  'deliver: with no error callback, a listener failure goes to the console and the player goes on'() {
    const e = new Engine(experience(counter));
    e.transaction('host', () => e.mount('one', 'scene', 'one'));
    e.on(() => { throw new Error('x'); });
    const logged = [];
    const was = console.error; console.error = (...a) => logged.push(a);
    try { ok(e.send('one', 'go').ok); ok(e.send('one', 'go').ok); } finally { console.error = was; }
    eq(e.state.blocks.one.values.n, 2);
    eq(logged.length, 2);
  },
  'deliver: stored writes run after commit, before listeners; a store that throws never rolls back (9.2, 5.1.2)'() {
    const saved = mapStore();
    const scene = { values: { n: { type: 'number', initial: 0, minimum: 0, maximum: 9, lifetime: 'saved' } }, on: counter.on };
    const exp = experience(scene, { grants: { storage: ['saved'] } });
    const e = new Player(exp, { storage: { saved, page: '/p', partition: 'device', now: () => 1 } });
    ok(e.start().ok);
    const seen = [];
    const set = saved.set;
    saved.set = (k, v) => { seen.push(['store', e.state.revision]); set(k, v); };
    e.on(({ revision }) => seen.push(['listener', revision]));
    const rev = e.state.revision;
    ok(e.send('one', 'go').ok);
    eq(seen, [['store', rev + 1], ['listener', rev + 1]], 'the store is written after the revision rose, then listeners');
    saved.set = () => { throw new Error('quota'); };
    ok(e.send('one', 'go').ok, 'a failed stored write does not fault');
    eq(e.state.blocks.one.values.n, 2, 'and does not roll back');
    ok(e.stored.takeNotices().includes('save:unavailable'));
  },
  'steps: the transaction budget is checked inside evaluation, not only between events (9.2 step 5, 9.8)'() {
    // One event, 400 actions of about 4,000 work steps each (5.6.6): 1.6 million steps before the event ends.
    const actions = Array.from({ length: 400 }, (_, i) => ({ id: `h${i}`, set: 'n', to: heavy }));
    const scene = { values: { xs, n: { type: 'number', initial: 0, minimum: 0, maximum: 1000000 } }, on: { go: [{ id: 'g', actions }] } };
    const e = new Engine(experience(scene));
    e.transaction('host', () => e.mount('one', 'scene', 'one'));
    let steps = 0;
    const evalOne = e.eval.bind(e);
    e.eval = (a, f, x) => { try { return evalOne(a, f, x); } finally { steps = Math.max(steps, e.budget?.steps ?? 0); } };
    const r = e.send('one', 'go');
    ok(!r.ok, 'the transaction faulted');
    eq(r.fault.code, 'E-EVENT-LOOP');
    ok(steps <= FORMAT.formulaStepsPerTransaction + 1, `stopped at the limit, not after it: ${steps}`);
    eq(e.state.blocks.one.values.n, 0, 'rolled back');
  },
  'steps: a heavy list under the budget still runs'() {
    const actions = Array.from({ length: 100 }, (_, i) => ({ id: `h${i}`, set: 'n', to: heavy }));
    const scene = { values: { xs, n: { type: 'number', initial: 0, minimum: 0, maximum: 1000000 } }, on: { go: [{ id: 'g', actions }] } };
    const e = new Engine(experience(scene));
    e.transaction('host', () => e.mount('one', 'scene', 'one'));
    ok(e.send('one', 'go').ok);
    eq(e.state.blocks.one.values.n, 1000);
  },
  'steps: one evaluation over formulaSteps work steps is still E-RANGE (5.6.6)'() {
    const scene = { values: { xs, n: { type: 'number', initial: 0, minimum: 0, maximum: 1000000 } }, on: { go: [{ id: 'g', actions: [{ id: 'g1', set: 'n', to: "sum(xs, count(xs, item >= 0))" }] }] } };
    const e = new Engine(experience(scene));
    e.transaction('host', () => e.mount('one', 'scene', 'one'));
    eq(e.send('one', 'go').fault?.code, 'E-RANGE');
  },
  'steps: the binding phase has its own budget (9.2 step 6, 9.8)'() {
    const e = new Engine(experience(counter));
    e.transaction('host', () => e.mount('one', 'scene', 'one'));
    let code = null; let n = 0;
    e.bindingPhase(() => { try { for (; n < 1000; n++) e.eval('one', heavy); } catch (err) { code = err.code; } });
    eq(code, 'E-EVENT-LOOP');
    // heavy is 4,003 work steps (5.6.6): a call, a name, 1,000 rows visited and 3 steps of row formula on each.
    const each = 4003;
    ok(Math.abs(n - Math.floor(FORMAT.formulaStepsPerTransaction / each)) <= 1, `stopped at a million steps: ${n} evaluations`);
    eq(e.budget, null, 'the budget ends with the phase');
    for (let i = 0; i < 400; i++) e.eval('one', heavy); // outside a phase there is no transaction budget
  },
  'rollback: a fault restores values, inputs, records, timers, clips and machines exactly'() {
    const scene = {
      values: { n: { type: 'number', initial: 0, minimum: 0, maximum: 9 }, list: { type: 'array', initial: [1, 2] } },
      machines: { m: { initial: 'a', states: { a: { after: [{ id: 'later', delayMs: 500, target: 'b' }], on: { go: [{ id: 'to-b', target: 'b' }] } }, b: { after: [{ id: 'back', delayMs: 300, target: 'a' }] } } } },
      clips: { c: { durationMs: 1000, tracks: [] } },
      on: {
        go: [{ id: 'g', actions: [{ id: 'g0', emit: 'row', as: 'record', with: { v: '1' } }, { id: 'g1', set: 'list', to: 'append(list, 3, 10)' }, { id: 'g3', play: 'c' }, { id: 'g2', set: 'n', to: 'n + 1' }, { id: 'g4', set: 'n', to: 'n * 9' }] }],
      },
    };
    const e = new Engine(experience(scene));
    ok(e.transaction('host', () => e.mount('one', 'scene', 'one')).ok);
    e.advance(100);
    ok(e.send('one', 'go').ok, 'the first go commits: n is 9');
    e.advance(100);
    const before = JSON.stringify(e.state);
    const r = e.send('one', 'go');
    ok(!r.ok && r.fault.code === 'E-RANGE', 'n would pass 9');
    eq(JSON.stringify(e.state), before, 'the state is as it was');
  },
  'rollback: the snapshot of a large store is cheap (2 MiB of values, 200 timers)'() {
    const big = Array.from({ length: 40000 }, (_, i) => `item-${i}-${'x'.repeat(40)}`);
    const scene = {
      values: { big: { type: 'array', initial: big }, n: { type: 'number', initial: 0, minimum: 0, maximum: 1000000 } },
      machines: Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`t${i}`, { initial: 'a', states: { a: { after: [{ delayMs: 100000 + i, to: 'a' }] } } }])),
      on: counter.on,
    };
    const e = new Engine(experience(scene));
    ok(e.transaction('host', () => e.mount('one', 'scene', 'one')).ok);
    ok(JSON.stringify(e.state).length > 2 * 1024 * 1024);
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) ok(e.send('one', 'go').ok);
    const ours = performance.now() - t0;
    const t1 = performance.now();
    for (let i = 0; i < 10; i++) structuredClone(e.state);
    const full = (performance.now() - t1) * 10;
    eq(e.state.blocks.one.values.n, 100);
    ok(ours * 3 < full, `100 steps took ${ours.toFixed(0)} ms; 100 full copies take ${full.toFixed(0)} ms`);
  },
};
