// Logic modules (10.7, A9.3). The call action, the step and time budgets, admission (needs, pin, the
// host's reviewed lock, a confined executor) and what confines a module in this engine. No browser.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { Player } from '../src/story.mjs';
import { modulePort } from '../src/host.mjs';
import { registerModule, confinedExecutor } from '../src/modules.mjs';
const { chess, exports: chessExports, digest } = await addonCode('../modules/chess/index.mjs', import.meta.url) ?? {};
import { expected, lockFile, moduleDigest, MODULES } from '../modules/make-lock.mjs';
import { repo, eq, ok, throwsCode, addonCode } from './helpers.mjs';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const LOCK = { 'chess@0.1.0': digest };
const port = (o = {}) => modulePort({ lock: LOCK, ...o });

// A one-scene experience. scene: extra scene fields; needs, pins, capabilities as given.
function make({ values = {}, entry = [], on = {}, controls = {}, needs = ['chess@0.1.0'], pins = LOCK, capabilities = { chess: port() }, modules = undefined } = {}) {
  const scene = {
    format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg',
    values: { pos: { type: 'string', maxLength: 100, initial: START }, moves: { type: 'array', maxItems: 256, items: { type: 'string', maxLength: 5 }, initial: [] },
      done: { type: 'boolean', initial: false }, outcome: { type: 'string', maxLength: 5, initial: '' }, short: { type: 'string', maxLength: 3, initial: '' }, ...values },
    entry, on, controls: { go: { kind: 'button', target: 'g', event: 'go' }, ...controls },
  };
  const doc = { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', needs, about: { title: 'x', ...(pins ? { trust: { pins } } : {}) }, story: { start: 'a', scenes: { a: 'a.json' } } };
  const p = new Player({ doc, words: { en: {} }, data: {}, blocks: {}, scenes: { a: { file: 'a.json', doc: scene, drawings: {}, words: {} } } }, { capabilities, ...(modules ? { modules } : {}) });
  const r = p.start();
  if (!r.ok) throw Object.assign(new Error(r.fault.message || r.fault.code), { code: r.fault.code });
  return p;
}
const go = (p) => p.activate('a', 'go');
const onGo = (actions) => ({ go: [{ id: 'g', actions }] });
const legalCall = { id: 'l', call: 'chess.legalMoves', with: { position: 'pos' }, to: { moves: 'moves' } };

// A test module: one export that returns {a, b} after `work` steps.
function testModule(name, { work = 1, budgetSteps, budgetMs = 100, makeWork = false, swallow = false, result = null } = {}) {
  return registerModule({
    name, version: '1.0.0', digest: 'sha256:' + '0'.repeat(64),
    exports: { run: { with: { type: 'object', properties: { n: { type: 'number' } }, required: ['n'], additionalProperties: false },
      returns: { type: 'object', properties: { a: { type: 'string', maxLength: 10 }, b: { type: 'string', maxLength: 10 } }, required: ['a', 'b'], additionalProperties: false },
      budgetMs, ...(budgetSteps ? { budgetSteps } : {}) } },
    make(step) {
      if (makeWork) step();
      return { run({ n }) {
        for (let i = 0; i < work; i++) { if (swallow) { try { step(); } catch { /* a module that hides the stop */ } } else step(); }
        return result ?? { a: 'a' + n, b: 'b' + n };
      } };
    },
  });
}
function withModule(rec, opts = {}) {
  const pin = { [`${rec.id}@1.0.0`]: rec.module.digest };
  return make({ needs: [`${rec.id}@1.0.0`], pins: pin, capabilities: { [rec.id]: modulePort({ lock: pin, ...(opts.port || {}) }) }, modules: [rec],
    values: { first: { type: 'string', maxLength: 10, initial: '' }, second: { type: 'string', maxLength: 1, initial: '' } },
    on: onGo([{ id: 'r', call: `${rec.id}.run`, with: { n: '7' }, to: { a: 'first', b: 'second' } }]), ...opts.make });
}

export const tests = {
  'a call runs at entry and writes its outputs'() {
    const p = make({ entry: [legalCall] });
    eq(p.read('a', 'moves').length, 20);
  },
  'calls in a reaction: apply a move, then read the status'() {
    const p = make({ values: { pos: { type: 'string', maxLength: 100, initial: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1' } }, on: onGo([
      { id: 'm', call: 'chess.applyMove', with: { position: 'pos', move: "'d1d8'" }, to: { position: 'pos' } },
      { id: 's', call: 'chess.status', with: { position: 'pos' }, to: { done: 'done', outcome: 'outcome' } },
    ]) });
    ok(go(p).ok);
    eq([p.read('a', 'pos'), p.read('a', 'done'), p.read('a', 'outcome')], ['3R2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 1 1', true, 'white']);
  },
  'an illegal move faults the transaction and nothing is written'() {
    const p = make({ on: onGo([{ id: 'w', set: 'outcome', to: "'x'" }, { id: 'm', call: 'chess.applyMove', with: { position: 'pos', move: "'e2e5'" }, to: { position: 'pos' } }]) });
    const r = go(p);
    eq([r.ok, r.fault.code], [false, 'E-MODULE-RESULT']);
    eq([p.read('a', 'pos'), p.read('a', 'outcome')], [START, ''], 'rolled back');
  },
  'a malformed position faults the call (E-MODULE-RESULT)'() {
    const p = make({ values: { pos: { type: 'string', maxLength: 100, initial: 'not a position' } }, on: onGo([legalCall]) });
    eq(go(p).fault.code, 'E-MODULE-RESULT');
  },
  'inputs are checked against the export before the call'() {
    const p = make({ on: onGo([{ id: 'l', call: 'chess.legalMoves', with: { position: '3' }, to: { moves: 'moves' } }]) });
    eq(go(p).fault.code, 'E-MODULE-RESULT');
  },
  'with and to must match the export exactly (E-MODULE-CALL, also at play)'() {
    for (const a of [
      { id: 'l', call: 'chess.legalMoves', with: {}, to: { moves: 'moves' } },
      { id: 'l', call: 'chess.legalMoves', with: { position: 'pos', extra: "'x'" }, to: { moves: 'moves' } },
      { id: 'l', call: 'chess.legalMoves', with: { position: 'pos' }, to: {} },
      { id: 'l', call: 'chess.status', with: { position: 'pos' }, to: { done: 'done', outcome: 'done' } },
      { id: 'l', call: 'chess.nothing', with: { position: 'pos' }, to: { moves: 'moves' } },
      { id: 'l', call: 'chess', with: { position: 'pos' }, to: { moves: 'moves' } },
      { id: 'l', call: 'chess.legalMoves', with: { position: 'pos' }, to: { moves: 'nowhere' } },
    ]) eq(go(make({ on: onGo([a]) })).fault.code, 'E-MODULE-CALL', JSON.stringify(a));
  },
  'every result is checked before any write: no partial output'() {
    const rec = testModule('tpair');
    const p = withModule(rec);
    const r = go(p); // b7 fits b's type but not the value second (maxLength 1): a is not written either
    eq(r.fault.code, 'E-MODULE-RESULT');
    eq([p.read('a', 'first'), p.read('a', 'second')], ['', '']);
    const bad = withModule(testModule('tbad', { result: { a: 'x', c: 'y' } }));
    eq(go(bad).fault.code, 'E-MODULE-RESULT', 'a result outside the manifest');
  },
  'the step budget: a breach is E-MODULE-RESULT'() {
    const p = withModule(testModule('tsteps', { work: 5000, budgetSteps: 1000 }), { make: { values: { first: { type: 'string', maxLength: 10, initial: '' }, second: { type: 'string', maxLength: 10, initial: '' } } } });
    const r = go(p);
    eq(r.fault.code, 'E-MODULE-RESULT');
    ok(/step budget of 1000/.test(r.fault.message), r.fault.message);
    const fits = withModule(testModule('tsteps2', { work: 1000, budgetSteps: 1000 }), { make: { values: { first: { type: 'string', maxLength: 10, initial: '' }, second: { type: 'string', maxLength: 10, initial: '' } } } });
    ok(go(fits).ok, 'exactly the budget fits');
  },
  'a host may set a smaller step budget than the export'() {
    const p = withModule(testModule('thost', { work: 2000 }), { port: { maxSteps: 1500 }, make: { values: { first: { type: 'string', maxLength: 10, initial: '' }, second: { type: 'string', maxLength: 10, initial: '' } } } });
    eq(go(p).fault.code, 'E-MODULE-RESULT');
  },
  'the time budget: the executor reads its own clock and stops the call'() {
    let t = 0;
    const clock = () => (t += 1); // one millisecond per read
    const p = withModule(testModule('ttime', { work: 50000, budgetMs: 5 }), { port: { clock }, make: { values: { first: { type: 'string', maxLength: 10, initial: '' }, second: { type: 'string', maxLength: 10, initial: '' } } } });
    const r = go(p);
    eq(r.fault.code, 'E-MODULE-RESULT');
    ok(/time budget/.test(r.fault.message), r.fault.message);
  },
  'a module that catches the stop still fails'() {
    const p = withModule(testModule('tswallow', { work: 3000, budgetSteps: 100, swallow: true }), { make: { values: { first: { type: 'string', maxLength: 10, initial: '' }, second: { type: 'string', maxLength: 10, initial: '' } } } });
    eq(go(p).fault.code, 'E-MODULE-RESULT');
  },
  'a module that works outside a call is refused at mount (E-MODULE-CONFINEMENT)'() {
    throwsCode(() => withModule(testModule('tmake', { makeWork: true })), 'E-MODULE-CONFINEMENT');
  },
  'admission: needs, pin and the reviewed lock (E-MODULE-REVIEW)'() {
    throwsCode(() => make({ pins: null }), 'E-MODULE-REVIEW');
    throwsCode(() => make({ pins: { 'chess@0.2.0': digest } }), 'E-MODULE-REVIEW');
    throwsCode(() => make({ pins: { 'chess@0.1.0': 'sha256:' + '1'.repeat(64) } }), 'E-MODULE-REVIEW');
    throwsCode(() => make({ capabilities: { chess: modulePort({ lock: {} }) } }), 'E-MODULE-REVIEW');
    throwsCode(() => make({ capabilities: { chess: modulePort({ lock: { 'chess@0.1.0': 'sha256:' + '2'.repeat(64) } }) } }), 'E-MODULE-REVIEW');
    throwsCode(() => make({ capabilities: {} }), 'E-MODULE-REVIEW');
  },
  'admission: a port the host made itself does not confine (E-MODULE-CONFINEMENT)'() {
    throwsCode(() => make({ capabilities: { chess: { kind: 'module-port', lock: LOCK, limits: {} } } }), 'E-MODULE-CONFINEMENT');
  },
  'without needs the module is not installed: the call is refused'() {
    eq(go(make({ needs: [], pins: null, capabilities: {}, on: onGo([legalCall]) })).fault.code, 'E-MODULE-CALL');
  },
  'modulePort checks its lock and limits'() {
    throwsCode(() => modulePort({}), 'E-TYPE');
    throwsCode(() => modulePort({ lock: { chess: digest } }), 'E-TYPE');
    throwsCode(() => modulePort({ lock: LOCK, maxMs: 2000 }), 'E-RANGE');
    throwsCode(() => modulePort({ lock: LOCK, maxSteps: 0 }), 'E-RANGE');
    ok(Object.isFrozen(port()) && Object.isFrozen(port().lock));
  },
  'the executor hands the module frozen copies and copies its result out'() {
    let seen = null; const kept = { list: [1] };
    const ex = confinedExecutor().load({ name: 't', make: () => ({ f(input) { seen = input; return kept; } }) });
    const input = { a: { b: 1 } };
    const r = ex.call('f', input, { ms: 100, steps: 10 });
    ok(r.ok && Object.isFrozen(seen) && Object.isFrozen(seen.a) && seen !== input);
    r.value.list.push(2); eq(kept.list, [1], 'the result is a copy');
    eq(ex.call('g', {}, { ms: 100, steps: 10 }).ok, false, 'an unknown export');
    eq(confinedExecutor().load({ name: 't', make: () => ({ f() { return { fn() {} }; } }) }).call('f', {}, { ms: 100, steps: 10 }).ok, false, 'a function cannot leave');
  },
  'review: the chess code imports nothing and names no global, clock, random source or catch'() {
    const src = fs.readFileSync(path.join(repo, 'engine', 'v2', 'modules', 'chess', 'chess.mjs'), 'utf8');
    const code = src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n').replace(/'[^'\n]*'|`[^`\n]*`/g, "''"); // without comments and strings
    ok(!/^\s*import\b/m.test(code) && !/\bimport\s*\(/.test(code), 'no import');
    const banned = ['globalThis', 'window', 'self', 'document', 'fetch', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage', 'indexedDB', 'navigator', 'location',
      'Date', 'performance', 'random', 'setTimeout', 'setInterval', 'queueMicrotask', 'Promise', 'async', 'await', 'eval', 'Function', 'require', 'process', 'crypto', 'Reflect', 'Proxy', 'try', 'catch', 'this', 'arguments'];
    for (const w of banned) ok(!new RegExp(`\\b${w}\\b`).test(code), `chess.mjs names ${w}`);
    eq((code.match(/^export\b.*$/gm) || []).map(l => l.trim()), ['export function make(step) {'], 'one export: make');
  },
  'confinement: the chess code runs the same in a context with no globals at all'() {
    const src = fs.readFileSync(path.join(repo, 'engine', 'v2', 'modules', 'chess', 'chess.mjs'), 'utf8').replace(/^export\s+/m, '');
    const ctx = vm.createContext(Object.create(null));
    // Take away even the language's own clock, random source and global names.
    vm.runInContext('delete globalThis.Date; delete globalThis.Math; delete globalThis.Reflect; delete globalThis.Proxy; delete globalThis.eval; delete globalThis.Function; delete globalThis.WebAssembly; delete globalThis.Atomics; delete globalThis.SharedArrayBuffer;', ctx);
    const confined = vm.runInContext(`${src}\n;make`, ctx)(() => {});
    const open = chess.make(() => {});
    for (const fen of [START, 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', '4k3/P7/8/8/8/8/8/4K3 w - - 0 1']) {
      eq(JSON.stringify(confined.legalMoves({ position: fen })), JSON.stringify(open.legalMoves({ position: fen })), fen);
      eq(JSON.stringify(confined.status({ position: fen })), JSON.stringify(open.status({ position: fen })));
    }
  },
  'the reviewed lock and the module digest are fresh (make-lock.mjs)'() {
    const e = expected();
    eq(fs.readFileSync(lockFile, 'utf8').replace(/\r\n/g, '\n'), e.lockText, 'lock.json is stale: node engine/v2/modules/make-lock.mjs');
    for (const [f, t] of Object.entries(e.indexes)) eq(fs.readFileSync(f, 'utf8'), t, `${f} is stale`);
    eq(chess.digest, moduleDigest(MODULES[0]));
  },
  'the chess exports are the manifest beside the spec, and the version is the manifest\'s'() {
    const m = JSON.parse(fs.readFileSync(path.join(repo, 'spec', '2.0', 'capabilities', 'chess.json'), 'utf8'));
    eq(chessExports, m.grammar.exports);
    eq(chess.version, m.about.version);
    eq(m.grants, []);
  },
};
