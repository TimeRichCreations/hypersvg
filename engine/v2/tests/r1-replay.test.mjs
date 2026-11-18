// Replay support in the base (9.6, 9.6.1; added after 2.0.0-next.0): the move hook (onMove), the clock passed in,
// the logic-only entry (src/logic.mjs) and the state fingerprint. A play is recorded through the hook, fed to a fresh
// logic-only player, and gives the same fingerprint after every move. No browser.
import fs from 'node:fs';
import path from 'node:path';
import { Player } from '../src/story.mjs';
import { MOVES } from '../src/runtime.mjs';
import { loadExperience, folderSource } from '../src/load.mjs';
import { readAsset, assetPackage } from '../src/asset.mjs';
import { logic, fingerprint, stateDocument, canonicalJson, fingerprintOf } from '../src/logic.mjs';
import { actionsNow } from '../tools/test/node-play.mjs';
import { repo, schemas, eq, ok, throwsCode } from './helpers.mjs';

const load = async (rel) => {
  const l = loadExperience(await folderSource(path.join(repo, rel)), schemas());
  if (!l.experience) throw new Error(l.diags.map(d => `${d.code} ${d.message}`).join('; '));
  return l.experience;
};
// A seeded walk: at each step one usable control or choice (actionsNow, as the test crawler finds them), then the
// clock moves 300 to 1199 ms. Returns the moves heard and the fingerprint after each move.
export function record(exp, { steps = 30, seed = 7, ...opts } = {}) {
  const moves = []; const prints = [];
  const a = logic(exp, { epochMs: 0, ...opts, onMove: (m) => moves.push(m) });
  const after = () => { while (prints.length < moves.length) prints.push(a.fingerprint()); };
  a.start(); after();
  for (let i = 0; i < steps && !a.player.stopped; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const acts = actionsNow(a.player).filter(x => x.t !== 'wait');
    const x = acts[seed % Math.max(1, acts.length)];
    if (x?.t === 'use') a.player.activate(x.addr, x.cid, x.arg);
    else if (x?.t === 'pick') a.player.pick(x.link);
    else if (x?.t === 'close') a.player.closeDialog(x.dialog);
    after();
    a.advance(300 + (seed % 900));
  }
  return { moves, prints, player: a.player };
}
// Feeds the moves to a fresh logic-only player: the fingerprint after each one, and the moves the replay heard.
export function replay(exp, moves, opts = {}) {
  const heard = [];
  const b = logic(exp, { epochMs: 0, ...opts, onMove: (m) => heard.push(m) });
  const prints = moves.map(m => { b.feed(m); return b.fingerprint(); });
  return { prints, heard, player: b.player };
}
export function sameEveryStep(exp, opts = {}) {
  const r = record(exp, opts);
  ok(r.moves[0]?.source === 'start', 'the hook heard the start');
  const p = replay(exp, r.moves, opts);
  for (let i = 0; i < r.moves.length; i++) eq(p.prints[i], r.prints[i], `fingerprint after move ${i} ${JSON.stringify(r.moves[i]).slice(0, 120)}`);
  eq(p.heard, r.moves, 'the replay hears the same moves');
  return r;
}

export const tests = {
  // ---------- the hook ----------
  'hook: every input in MOVES is heard once, before it runs, as {t, source, payload}; none without onMove'() {
    const exp = { doc: { id: 'h', inputs: { go: { kind: 'trigger' }, name: { kind: 'content', type: 'string', maxLength: 20, initial: '' } },
      story: { start: 'a' } }, blocks: {}, scenes: { a: { doc: { id: 'a', values: { n: { type: 'number', initial: 0 } },
      on: { go: [{ id: 'g', actions: [{ id: 'i', set: 'n', to: 'n + 1' }] }] } } } } };
    const moves = [];
    const p = new Player(exp, { onMove: (m) => moves.push({ ...m, n: p.state.blocks.a?.values.n }) });
    p.start(); p.advance(250); p.trigger('go'); p.setInput('name', 'Robin'); p.restart(); p.key('Space');
    eq(moves.map(m => [m.t, m.source, m.n]), [[0, 'start', undefined], [250, 'trigger', 0], [250, 'setInput', 1], [250, 'restart', 1], [0, 'key', 0]], 'start inside restart is part of it; heard before each runs; a restart sets engine time to 0');
    eq(moves[1].payload, ['go'], 'the arguments as given');
    p.hold('a', 'none', undefined); eq(moves.at(-1).payload, ['a', 'none', null], 'an undefined argument is null');
    eq(Object.keys(moves[0].payload[0]).includes('timeLimits'), true, 'start carries the ambient values');
    const quiet = new Player(exp); quiet.start(); quiet.trigger('go');
    eq(quiet.moveIn === Player.prototype.moveIn && !Object.hasOwn(quiet, 'trigger'), true, 'no hook: the methods are the prototype\'s');
    ok(MOVES.includes('snap') && MOVES.includes('closeDialog') && MOVES.includes('setLanguage') && MOVES.includes('motion') && MOVES.includes('shellEvent'));
  },
  'hook: a freeText value is heard by its length only (5.3.1, 9.6), and fed as that many x; the fingerprint holds the length'() {
    const exp = { doc: { id: 'f', inputs: { said: { kind: 'content', type: 'string', contentType: 'freeText', maxLength: 40, required: false, initial: '' } },
      story: { start: 'a' } }, blocks: {}, scenes: { a: { doc: { id: 'a' } } } };
    const moves = [];
    const a = logic(exp, { onMove: (m) => moves.push(m) }); a.start();
    a.player.setInput('said', 'my secret words', 'widget');
    eq(moves[1], { t: 0, source: 'setInput', payload: ['said', { freeText: 15 }, 'widget'] });
    ok(!JSON.stringify(moves).includes('secret'), 'the words are not in the log');
    eq(a.state().blocks.experience.inputs.said, { freeText: 15 });
    const b = logic(exp); for (const m of moves) b.feed(m);
    eq(b.player.state.blocks.experience.inputs.said, 'x'.repeat(15));
    eq(b.fingerprint(), a.fingerprint(), 'same state, the words aside');
  },
  'hook: a hook that throws goes to the error path; the move still runs'() {
    const exp = { doc: { id: 'e', story: { start: 'a' } }, blocks: {}, scenes: { a: { doc: { id: 'a' } } } };
    const errs = [];
    const p = new Player(exp, { onMove: () => { throw new Error('boom'); } });
    p.onDeliveryError = (d) => errs.push(d);
    ok(p.start().ok);
    eq([p.scene, errs[0]?.message, errs[0]?.source], ['a', 'boom', 'listener']);
  },
  // ---------- the clock ----------
  'clock: the host clock gives now, called with the engine time; Date.now is the default'() {
    const exp = { doc: { id: 'c', story: { start: 'a' } }, blocks: {}, scenes: { a: { doc: { id: 'a', values: { at: { type: 'number', initial: 0 } },
      on: { 'changed:now': [{ id: 'n', actions: [{ id: 's', set: 'at', to: 'now' }] }] } } } } };
    const E = Date.UTC(2026, 10, 17, 12, 0, 0);
    const seen = [];
    const a = logic(exp, { clock: (t) => { seen.push(t); return E + t; } }); a.start(); a.advance(2500);
    eq(a.player.read('a', 'at'), E + 2000, 'now follows the host clock');
    ok(seen.includes(0) && seen.every(t => typeof t === 'number'), 'the clock is given the engine time');
    const d = logic(exp); d.start(); d.advance(1000);
    ok(Math.abs(d.player.read('a', 'at') - Date.now()) < 5000, 'the default is the wall clock');
    throwsCode(() => logic(exp, { clock: 5 }), 'E-TYPE');
  },
  // ---------- the entry ----------
  'entry: a package is checked as mount() checks it; it plays with no page, and hears outputs'() {
    const asset = readAsset(fs.readFileSync(path.join(repo, 'spec', '2.0', 'conformance', 'hypersvg', 'valid-one-scene.svg'), 'utf8'));
    const pkg = assetPackage(asset);
    ok(typeof globalThis.document === 'undefined', 'no DOM in this test');
    const a = logic(pkg, { schemas: schemas() });
    ok(a.start().ok);
    eq(a.heard[0], { t: 0, name: 'entered', detail: { slot: 'stage', scene: a.player.scene, link: '' } });
    const bad = { ...pkg, 'experience.json': new TextEncoder().encode('{}') };
    throwsCode(() => logic(bad, { schemas: schemas() }), 'E-PACKAGE-DIGEST');
    let typeError = null; try { logic(pkg); } catch (e) { typeError = e; }
    ok(typeError instanceof TypeError && /schemas/.test(typeError.message), 'a package needs the schemas');
    throwsCode(() => a.feed({ t: 0, source: 'nothing', payload: [] }), 'E-REF-UNKNOWN');
    throwsCode(() => a.feed({ t: 0, source: 'key' }), 'E-TYPE');
    a.advance(100);
    throwsCode(() => a.feed({ t: 50, source: 'key', payload: ['Space'] }), 'E-RANGE');
    eq(a.feed({ t: 200, source: 'door', payload: ['page', 'signal'] }), { ok: true, ignored: 'needs a page' });
    eq(a.now, 200, 'a move advances the clock to its time');
  },
  // ---------- the fingerprint ----------
  'fingerprint: canonical JSON is RFC 8785 (sorted keys, ECMAScript numbers, JSON escapes)'() {
    eq(canonicalJson({ b: [1, 1e21, 1e-7, -0, 0.1, true, null], a: { 'é': 'x', A: '\u0001"\\' }, z: undefined }), '{"a":{"A":"\\u0001\\"\\\\","é":"x"},"b":[1,1e+21,1e-7,0,0.1,true,null]}');
    eq(canonicalJson({ '\uFB33': 2, '\u{1F600}': 1 }), '{"\u{1F600}":1,"\uFB33":2}', 'keys sort by UTF-16 code units (U+1F600 is D83D DE00, before FB33)');
    eq(fingerprintOf({}), 'sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a');
  },
  'fingerprint: the conformance files (spec/2.0/conformance/state/) give their expected canonical text and fingerprint'() {
    const dir = path.join(repo, 'spec', '2.0', 'conformance', 'state');
    const expected = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8'));
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'expected.json');
    eq(files.sort(), Object.keys(expected).sort(), 'every file has its expected result');
    for (const f of files) {
      const doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      eq(fingerprintOf(doc), expected[f].fingerprint, f);
      eq(new TextEncoder().encode(canonicalJson(doc)).length, expected[f].bytes, `${f}: canonical length in UTF-8 bytes`);
      if (expected[f].canonical !== undefined) eq(canonicalJson(doc), expected[f].canonical, `${f}: canonical text`);
    }
  },
  async 'fingerprint: the state document leaves out revision, outputs, deliveries and the ambient layout; two equal players agree'() {
    const exp = await load('docs/guide/examples/harbour');
    const a = new Player(exp); a.start();
    const b = new Player(exp); b.start(); b.state.revision += 5; b.state.outputs = [{ name: 'x' }]; b.state.ambient.layout = { x: 1 };
    eq(fingerprint(a), fingerprint(b));
    b.state.blocks.gate.values.replayProbe = 1;
    ok(fingerprint(a) !== fingerprint(b), 'a store value is in');
    const d = stateDocument(a);
    eq(Object.keys(d).sort(), ['ambient', 'blocks', 'now', 'pauses', 'records', 'seq', 'story', 'timers']);
  },
  // ---------- record and replay ----------
  async 'replay: a quiz gives the same fingerprint after every move'() {
    const r = sameEveryStep(await load('skill/2.0/examples/recipes/quiz'));
    ok(new Set(r.prints).size > 5 && r.player.scene !== 'intro', 'the play moved on');
  },
  async 'replay: a scoring game with timers and clips (starfall) gives the same fingerprint after every move'() {
    const r = sameEveryStep(await load('examples/2.0-showcase/starfall'), { steps: 25 });
    ok(r.moves.length > 10 && new Set(r.prints).size > 10);
  },
  async 'replay: clips that loop (idle-loop) and a story with choices (branching-story)'() {
    sameEveryStep(await load('skill/2.0/examples/recipes/idle-loop'));
    const r = sameEveryStep(await load('skill/2.0/examples/recipes/branching-story'));
    ok(r.moves.some(m => m.source === 'pick' || m.source === 'activate'));
  },
  async 'replay: the guide\'s harbour (a shell, a component, a timer), lamp and list'() {
    const r = sameEveryStep(await load('docs/guide/examples/harbour'));
    ok(r.moves.length > 10 && new Set(r.prints).size > 3);
    sameEveryStep(await load('docs/guide/examples/lamp'));
    sameEveryStep(await load('docs/guide/examples/list'));
  },
  async 'replay: a HyperSVG, from its package'() {
    const asset = readAsset(fs.readFileSync(path.join(repo, 'spec', '2.0', 'conformance', 'hypersvg', 'valid-one-scene.svg'), 'utf8'));
    const pkg = assetPackage(asset);
    sameEveryStep(pkg, { schemas: schemas() });
  },
  async 'replay: without the hook nothing is heard, so a replay has nothing to feed'() {
    const exp = await load('docs/guide/examples/harbour');
    const a = logic(exp, { epochMs: 0 }); a.start(); a.player.activate('gate', 'go');
    const b = logic(exp, { epochMs: 0 }); b.start();
    ok(a.fingerprint() !== b.fingerprint(), 'a press changed the state, and nothing recorded it');
  },
  async 'replay: a page input that was a closure is a move now (snap, dialog close, language, motion, shell event)'() {
    const exp = { doc: { id: 's', language: 'en', story: { start: 'a' } }, words: { en: {}, fr: {} }, blocks: {}, scenes: { a: { doc: { id: 'a', values: { heard: { type: 'number', initial: 0 } },
      on: { 'changed:language': [{ id: 'l', actions: [{ id: 'i', set: 'heard', to: 'heard + 1' }] }], 'changed:reducedMotion': [{ id: 'm', actions: [{ id: 'j', set: 'heard', to: 'heard + 10' }] }] } } } } };
    const moves = [];
    const a = logic(exp, { onMove: (m) => moves.push(m) }); a.start();
    a.player.setLanguage('fr'); a.player.motion(true); a.player.snap('a', 'd', 'x'); a.player.snap('a', 'd');
    eq(moves.map(m => m.source), ['start', 'setLanguage', 'motion', 'snap', 'snap']);
    eq(a.player.read('a', 'heard'), 11);
    const b = logic(exp); for (const m of moves) b.feed(m);
    eq(b.fingerprint(), a.fingerprint());
  },
};
