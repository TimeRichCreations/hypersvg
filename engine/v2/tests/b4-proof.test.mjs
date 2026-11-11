// The 2.0 proof tools (engine/v2/tools/proof). Fast parts only: formats, the explorer's choices, the
// certificate's rules, the product list. The browser parts: engine/v2/tools/proof/tests/proof-browser.mjs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repo, eq, ok } from './helpers.mjs';
import { canonical, digestOf, validateInput, validateTrace, controlKey, identity, TRACE, CERTIFICATE } from '../tools/proof/format.mjs';
import { candidatesFor, pointerFor, pickNext, stateKey } from '../tools/proof/explore.mjs';
import { certify, markdown, linkReachable, unreachedScenes } from '../tools/proof/certificate.mjs';
import { buildProduct, storyOf } from '../tools/proof/build.mjs';
import { packFailure, indexMarkdown } from '../tools/proof/proof.mjs';

const throws = (fn, re) => { try { fn(); } catch (e) { ok(re.test(e.message), `wrong error: ${e.message}`); return; } throw new Error('expected a throw'); };
const press = { addr: 'intro', cid: 'go', id: 'intro__go', role: 'button', name: 'Go', kind: 'button', enabled: true };
const fp = 'sha256:' + 'a'.repeat(64);
const story = { start: 'a', scenes: ['a', 'b', 'c', 'd'], ends: ['c'], endless: false, links: [{ id: 'ab', from: 'a', to: 'b', on: 'go', afterMs: null, choice: false }, { id: 'bc', from: 'b', to: 'c', on: 'done', afterMs: null, choice: false }] };
const build = (extra = {}) => ({ product: { id: 'demo', folder: 'x/demo', title: 'Demo' }, fingerprint: fp, package: { needs: ['effects'], members: 3, digest: fp },
  size: { raw: 1000, gzip9: 400 }, bundle: { core: { gzip9: 300 }, capabilities: [{ id: 'effects', gzip9: 2000 }] }, csp: "default-src 'none'", findings: [], story, raised: {}, ...extra });
const trace = (acts = [{ t: 0, act: 'activate', control: identity(press), via: 'keyboard' }, { t: 500, act: 'advance' }]) => ({
  format: TRACE, product: { id: 'demo' }, fingerprint: fp, start: { viewport: { width: 10, height: 10 }, reducedMotion: true, storage: 'empty' }, acts,
  checkpoints: [{}, ...acts.map(() => ({}))], expect: { scene: 'c', time: 500, values: {}, error: null, visitedScenes: ['a', 'b', 'c'] } });
const exploration = (extra = {}) => ({
  mode: 'bounded-browser-observation', start: {}, policy: {}, ms: 1, startError: null, steps: 3, stopped: null, pendingStates: 0, pointerSteps: 1, pointerStopped: null,
  states: [{ id: 0 }], edges: [], scenes: ['a', 'b', 'c'], failures: [], network: [], errors: [],
  controls: [{ key: 'a#go', reached: true, enabled: true, keyboard: { from: 0, acts: [] }, pointer: { from: 0, acts: [] } }],
  measures: { elements: 10, blocks: 2, depth: 1, timers: 0, savedBytes: 0, sessionBytes: 0 }, sceneElements: { a: 10 }, endings: ['c'],
  traces: [{ why: 'ending', scene: 'c', reached: 'c', trace: trace(), replay: { pass: true, differences: [] } }], ...extra });

export const tests = {
  'canonical JSON sorts keys, keeps array order and refuses non-finite numbers'() {
    eq(canonical({ b: 1, a: [2, 1] }), '{"a":[2,1],"b":1}');
    eq(digestOf({ a: 1, b: 2 }), digestOf({ b: 2, a: 1 }));
    throws(() => canonical({ x: NaN }), /finite/);
  },
  'an input is checked: times in order, a named control, a drop for a drag'() {
    validateInput({ t: 0, act: 'activate', control: identity(press), via: 'keyboard' });
    throws(() => validateInput({ t: 5, act: 'advance' }, 10), /order/);
    throws(() => validateInput({ t: 0, act: 'activate', control: { role: 'button' }, via: 'keyboard' }), /accessible name/);
    throws(() => validateInput({ t: 0, act: 'activate', control: identity(press), via: 'mind' }), /keyboard or pointer/);
    throws(() => validateInput({ t: 0, act: 'drag', control: identity(press), via: 'pointer' }), /drop/);
    throws(() => validateInput({ t: 0, act: 'jump' }), /unknown input act/);
  },
  'a trace is checked: format, page digest, one checkpoint per input'() {
    validateTrace(trace());
    throws(() => validateTrace({ ...trace(), format: 'trace/0.1' }), /proof-trace/);
    throws(() => validateTrace({ ...trace(), fingerprint: 'x' }), /digest/);
    throws(() => validateTrace({ ...trace(), checkpoints: [{}] }), /checkpoint/);
  },
  'control keys name the address, the control and the option'() {
    eq(controlKey(press), 'intro#go');
    eq(controlKey({ addr: 'q', cid: 'pick', option: 'b' }), 'q#pick=b');
    eq(controlKey({ widget: true, role: 'button', name: 'Close' }), 'widget:button:Close');
  },
  'the explorer tries each control kind by keyboard: one candidate per drop, none for text'() {
    eq(candidatesFor(press, 100, 500), [[{ t: 100, act: 'activate', control: identity(press), via: 'keyboard' }, { t: 600, act: 'advance' }]]);
    eq(candidatesFor({ ...press, kind: 'slider' }, 0, 500)[0][0].key, 'ArrowRight');
    eq(candidatesFor({ ...press, kind: 'widget-check' }, 0, 500)[0][0].key, 'Space');
    const drags = candidatesFor({ ...press, kind: 'drag', drops: ['x', 'y'] }, 0, 500);
    eq(drags.map(c => c[0].drop), ['x', 'y']);
    eq(candidatesFor({ ...press, kind: 'widget-text' }, 0, 500), null);
    eq(pointerFor(drags[1]).map(i => i.via ?? null), ['pointer', null]);
  },
  'a state ignores time and control order, and counts the deadlines to come'() {
    const c2 = { ...press, cid: 'b', id: 'intro__b', name: 'B' };
    eq(stateKey({ scene: 'a', values: { x: 1 }, time: 1 }, [press, c2]), stateKey({ scene: 'a', values: { x: 1 }, time: 9 }, [c2, press]));
    ok(stateKey({ scene: 'a', values: { x: 1 } }, [press]) !== stateKey({ scene: 'a', values: { x: 2 } }, [press]));
    // A timed link still to come: waiting changes the time left, so it is a new state.
    ok(stateKey({ scene: 'a', values: {}, pending: [['a', 4000]] }, []) !== stateKey({ scene: 'a', values: {}, pending: [['a', 1000]] }, []));
  },
  'the next state to expand: a new scene first, then newest and oldest in turn'() {
    const states = [{ id: 0, scene: 'a' }, { id: 1, scene: 'a' }, { id: 2, scene: 'b' }, { id: 3, scene: 'a' }];
    eq(pickNext(states, new Set([0]), 0).id, 2);
    eq(pickNext(states, new Set([0, 2]), 1).id, 3);
    eq(pickNext(states, new Set([0, 2]), 2).id, 1);
    eq(pickNext(states, new Set([0, 1, 2, 3]), 0), null);
  },
  'unreached scenes say why: no link, the budget, or inputs that never caused the link'() {
    eq([...linkReachable(story)].sort(), ['a', 'b', 'c']);
    const why = Object.fromEntries(unreachedScenes(story, ['a', 'b'], null).map(u => [u.scene, u.why]));
    ok(/no story link/.test(why.d), why.d);
    ok(/b on done/.test(why.c) && /never caused/.test(why.c), why.c);
    ok(/steps budget/.test(unreachedScenes(story, ['a'], 'steps').find(u => u.scene === 'c').why));
  },
  'a full certificate passes only with evidence for every property'() {
    const c = certify(build(), exploration(), { date: '2026-11-06T00:00:00Z' });
    eq(c.format, CERTIFICATE);
    eq(c.status, 'incomplete'); // scene d is not reached
    eq(c.properties.finishable.result, 'pass');
    eq(c.properties.scenes.result, 'unknown');
    eq(c.receipt.status, 'incomplete');
    eq(c.receipt.rules.find(r => r.rule === 'proof/scenes').result, 'not-run');
    const all = certify(build({ story: { ...story, scenes: ['a', 'b', 'c'] } }), exploration(), { date: '2026-11-06T00:00:00Z' });
    eq(all.status, 'pass');
    ok(markdown(all).includes('| Finishable | pass |'));
  },
  'a network attempt, a page error, a replay difference or a budget over fails'() {
    eq(certify(build(), exploration({ network: [{ url: 'https://x.test/', kind: 'request' }] })).properties.network.result, 'fail');
    eq(certify(build(), exploration({ errors: ['page error: boom'] })).properties.errors.result, 'fail');
    const t = exploration().traces[0];
    eq(certify(build(), exploration({ traces: [{ ...t, replay: { pass: false, differences: ['expect values'] } }] })).properties.replay.result, 'fail');
    const big = certify(build({ bundle: { core: { gzip9: 1 }, capabilities: [{ id: 'effects', gzip9: 11000 }] } }), exploration());
    eq(big.properties.budgets.result, 'fail');
    eq(big.status, 'fail');
    eq(certify(build(), exploration({ measures: { ...exploration().measures, elements: 300000 } })).properties.budgets.rows[0].result, 'fail');
  },
  'finishable is unknown with no ending reached, and not applicable when endless'() {
    eq(certify(build(), exploration({ traces: [] })).properties.finishable.result, 'unknown');
    eq(certify(build(), exploration({ traces: [] })).properties.replay.result, 'unknown');
    eq(certify(build({ story: { ...story, endless: true } }), exploration()).properties.finishable.result, 'not-applicable');
    eq(certify(build(), exploration({ startError: 'E-X: no' })).status, 'fail');
  },
  'a control seen but never used by keyboard leaves keyboard unknown'() {
    const c = certify(build(), exploration({ controls: [...exploration().controls, { key: 'b#x', reached: true, enabled: true, keyboard: null, pointer: null }] }));
    eq(c.properties.keyboard.result, 'unknown');
    eq(c.properties.keyboard.missing, ['b#x']);
  },
  'a control the pointer pass skipped leaves pointer unknown, a pointer failure fails it'() {
    const base = exploration().controls[0];
    eq(certify(build(), exploration({ controls: [{ ...base, pointer: { skipped: 'a spinbutton' } }] })).properties.pointer.result, 'unknown');
    eq(certify(build(), exploration({ controls: [{ ...base, pointer: { from: 0, failed: 'no effect' } }] })).properties.pointer.result, 'fail');
  },
  'the receipt in a certificate has only A8.1 keys, and all the required ones'() {
    const docs = JSON.parse(fs.readFileSync(path.join(repo, 'spec', '2.0', 'documents.json'), 'utf8'));
    const keys = docs.kinds?.receipt?.keys;
    ok(keys, 'documents.json has the receipt keys');
    const r = certify(build(), exploration()).receipt;
    for (const k of Object.keys(r)) ok(k in keys, `receipt key ${k} is not in A8.1`);
    for (const [k, v] of Object.entries(keys)) if (v.required) ok(k in r, `receipt needs ${k}`);
    for (const row of r.rules) ok(['pass', 'fail', 'note', 'waived', 'not-run'].includes(row.result), row.result);
    ok(['pass', 'reduced', 'incomplete', 'fail'].includes(r.status));
  },
  'a product that does not pack gets a failing certificate with the reason'() {
    const c = packFailure({ name: 'x', folder: 'a/x' }, Object.assign(new Error('refusing to pack: 1 errors'), { diags: [{ code: 'E-NEEDS-UNKNOWN', file: 'experience.json', path: '/needs/0' }] }));
    eq(c.status, 'fail');
    eq(c.properties.packs.findings, ['E-NEEDS-UNKNOWN experience.json /needs/0']);
    ok(indexMarkdown([{ name: 'x', c }]).includes('does not pack'));
  },
  'the story is read from the files: ends and endless'() {
    eq(storyOf({ story: { start: 's', scenes: { s: 'x' }, ends: ['s'] } }).ends, ['s']);
    eq(storyOf({ story: { start: 's', scenes: {}, endless: true } }).endless, true);
    eq(storyOf({}), null);
  },
  async 'packing twice gives the same page digest (a trace is tied to the bytes)'() {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-b4-'));
    try {
      const dir = path.join(repo, 'skill', '2.0', 'examples', 'recipes', 'drag-sort');
      const a = await buildProduct(dir, path.join(out, 'a'));
      const b = await buildProduct(dir, path.join(out, 'b'));
      eq(a.fingerprint, b.fingerprint);
      eq(a.story.ends, ['done']);
      ok(a.size.gzip9 > 0 && a.size.raw > a.size.gzip9);
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  },
};
