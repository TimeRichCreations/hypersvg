// The fixes for the Q1c review. Each test is a proof of the report
// that failed before its fix.
import { Player } from '../src/story.mjs';
import { Drawing } from '../src/drawing.mjs';
import { checkExperience } from '../check/index.mjs';
import { hostApi } from '../src/host.mjs';
import { makePageDoor, unregister } from '../src/capabilities.mjs';
import { registerAddon } from '../src/addon-door.mjs';
import { modulePort } from '../src/host.mjs';
import { jsonUnits } from '../src/limits-runtime.mjs';
import { parse, evaluate } from '../src/formula.mjs';
import { parseWords } from '../src/read.mjs';
import { scanCode, loadAddons } from '../tools/addons.mjs';
import { pin } from '../tools/addon.mjs';
import { folderSource } from '../src/load.mjs';
import { metered } from '../tools/meter.mjs';
import { confinedExecutor, moduleTick } from '../src/modules.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { base } from './check-refs.test.mjs';
import { eq, ok, schemas, mapSource, granting, repo } from './helpers.mjs';

// The checker's whole findings on a files map: [code, file, path].
const findings = (files) => checkExperience(mapSource(files), schemas()).diags.map(d => [d.code, d.file, d.path]);
const doubling = () => { let s = 'id,text\ngo,Go\n'; for (let i = 0; i < 26; i++) s += `w${i},"{{ words.w${i + 1} }}{{ words.w${i + 1} }}"\n`; return s + 'w26,x\n'; };

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" data-hsvg-version="2.0" data-hsvg-kind="screen">
  <g id="world" data-hsvg-layer="content">
    <text id="count" data-hsvg-kind="part">0</text>
    <rect id="mark" data-hsvg-kind="part" data-hsvg-layer="fill" fill="#111111" width="10" height="10"/>
  </g>
</svg>`;

// One scene, its values, reactions and bindings as given; words in English.
export function oneScene({ values = {}, on = {}, bindings = [], controls, computed, words = {}, outputs, grants, inputs, expExtra = {} } = {}) {
  return {
    doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', story: { start: 'one', scenes: { one: 'one.json' } }, ...(grants ? { grants } : {}), ...expExtra },
    words: { en: words }, data: {},
    scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg', values, on, bindings, ...(computed ? { computed } : {}), ...(controls ? { controls } : {}), ...(outputs ? { outputs } : {}), ...(inputs ? { inputs } : {}) }, drawings: { main: { text: SVG } }, words: {} } },
    blocks: {},
  };
}
export const started = (exp, opts, wrap = (P) => P) => { const p = new (wrap(Player))(exp, opts); const r = p.start(); ok(r.ok, JSON.stringify(r.fault?.message)); return p; };

export const tests = {
  // ---------- item 1: a stack or memory error inside a transaction or the binding phase is a fault ----------
  'item 1: a RangeError inside a transaction from a control is a fault (E-EVENT-LOOP) that rolls back and stops'() {
    const p = started(oneScene({ values: { n: { type: 'number', initial: 0, minimum: 0, maximum: 9 } } }));
    let stopped = null;
    p.onStop = (f) => { stopped = f; };
    const deep = () => deep();
    let r; let thrown = null;
    try { r = p.transaction('control', () => { p.state.blocks.one.values = { n: 5 }; deep(); }); } catch (e) { thrown = e; }
    eq(thrown, null, 'nothing escapes the transaction');
    eq(r.ok, false); eq(r.fault.code, 'E-EVENT-LOOP');
    eq(p.read('one', 'n'), 0, 'the change rolled back');
    eq(stopped?.code, 'E-EVENT-LOOP', 'the experience stopped with the fault');
    eq(p.transaction('control', () => {}).stopped, true, 'later sources are refused');
  },
  'item 1: from the host, the same error is refused with its code and play goes on'() {
    const p = started(oneScene());
    const r = p.transaction('host', () => { throw new RangeError('Maximum call stack size exceeded'); });
    eq(r.fault.code, 'E-EVENT-LOOP'); ok(!p.stopped);
  },
  'item 1: an engine bug that is not a stack or memory error still throws'() {
    const p = started(oneScene());
    let thrown = null;
    try { p.transaction('control', () => { throw new TypeError('a bug'); }); } catch (e) { thrown = e; }
    ok(thrown instanceof TypeError);
  },
  'item 1: in the binding phase the drawing records a stack error as E-EVENT-LOOP, so the page stops on it'() {
    const p = started(oneScene({ bindings: [{ target: 'count', text: '{{ 1 }}' }] }));
    const d = new Drawing(p);
    d.mountScene('one');
    p.template = () => { throw new RangeError('Maximum call stack size exceeded'); };
    p.bindingPhase(() => d.paint());
    ok(d.faults.some(f => f.code === 'E-EVENT-LOOP'), JSON.stringify(d.faults));
  },
  // ---------- item 2: word templates charge the caller's budget; a word that reads itself is E-CYCLE ----------
  'item 2 (input A): a word that reads itself faults E-CYCLE in a set, and nothing escapes'() {
    const p = started(oneScene({ values: { t: { type: 'number', initial: 0, minimum: 0, maximum: 99 } }, words: { a: '{{ words.a }}' }, on: { go: [{ id: 'g', actions: [{ id: 's', set: 't', to: 'length(words.a)' }] }] } }));
    let r; let thrown = null;
    try { r = p.send('one', 'go'); } catch (e) { thrown = e; }
    eq(thrown, null);
    eq(p.stopped?.code, 'E-CYCLE', JSON.stringify(r));
    eq(p.read('one', 't'), 0);
  },
  'item 2 (input A): a cycle through two words and through plural is E-CYCLE too'() {
    const p = started(oneScene({ words: { a: 'x{{ words.b }}', b: '{{ plural(2, "c") }}', 'c.other': '{{ words.a }}' } }));
    let err = null;
    try { p.bindingPhase(() => p.template('one', '{{ words.a }}')); } catch (e) { err = e; }
    eq(err?.code, 'E-CYCLE', String(err));
  },
  'item 2 (input B): 27 doubling words stop with a fault within the budget, in a binding and in a set'() {
    const words = {};
    for (let i = 0; i < 26; i++) words[`w${i}`] = `{{ words.w${i + 1} }}{{ words.w${i + 1} }}`;
    words.w26 = 'x';
    const t0 = Date.now();
    const p = started(oneScene({ words, values: { t: { type: 'number', initial: 0, minimum: 0, maximum: 9 } }, on: { go: [{ id: 'g', actions: [{ id: 's', set: 't', to: 'length(words.w0) > 0 ? 1 : 0' }] }] } }));
    let err = null;
    try { p.bindingPhase(() => p.template('one', '{{ length(words.w0) > 0 ? "ok" : "no" }}')); } catch (e) { err = e; }
    eq(err?.code, 'E-EVENT-LOOP', String(err));
    p.send('one', 'go');
    eq(p.stopped?.code, 'E-EVENT-LOOP');
    ok(Date.now() - t0 < 10000, `took ${Date.now() - t0} ms`);
  },
  'item 2: a word that reads other words with no cycle still works, and a word read twice is not a cycle'() {
    const p = started(oneScene({ words: { a: '{{ words.b }}-{{ words.b }}', b: 'hi {{ words.c }}', c: 'there' } }));
    eq(p.bindingPhase(() => p.template('one', '{{ words.a }}')), 'hi there-hi there');
  },
  'item 2 (checker): a one-row word that reads itself is E-CYCLE at the words file and row'() {
    const f = base();
    eq(findings(f).filter(d => d[0].startsWith('E-')), [], 'the base is clean');
    f['words/en.csv'] = 'id,text\ngo,Go\na,"{{ words.a }}"\n';
    eq(findings(f).filter(d => d[0] === 'E-CYCLE'), [['E-CYCLE', 'words/en.csv', '/row 3']]);
  },
  'item 2 (checker): a loop through two words and through plural is E-CYCLE; reading a word twice is not'() {
    const f = base();
    f['words/en.csv'] = 'id,text\ngo,Go {{ words.b }}\nb,"{{ plural(2, ""c"") }}"\nc.one,"{{ words.go }}"\nc.other,x\n';
    eq(findings(f).filter(d => d[0] === 'E-CYCLE').length, 1, JSON.stringify(findings(f)));
    f['words/en.csv'] = 'id,text\ngo,Go {{ words.b }}{{ words.b }}\nb,"{{ words.c }}"\nc,x\n';
    eq(findings(f).filter(d => d[0] === 'E-CYCLE'), []);
  },
  'item 2 (checker): the 27-row doubling has no cycle and passes the checker; the engine stops it within the budget'() {
    const f = base();
    f['words/en.csv'] = doubling();
    eq(findings(f).filter(d => d[0] === 'E-CYCLE'), []);
  },
  // ---------- item 3: evaluation outside a transaction has one shared budget per call ----------
  'item 3: host.read of a result output over a chain of 24 computeds faults E-EVENT-LOOP at once; the page door too'() {
    const computed = {};
    // Computeds are cached (5.2, E5): each is evaluated once, so each does about 46,000 steps of work; 24 of them pass
    // the 1,000,000 steps of one call (the doubling alone no longer costs 2^24 evaluations).
    for (let i = 0; i < 23; i++) computed[`c${i}`] = `c${i + 1} + c${i + 1} + sum(range(1024), sum(range(10), item + 1)) * 0`;
    computed.c23 = '1';
    const exp = oneScene();
    Object.assign(exp.doc, { computed, outputs: { total: { kind: 'result', value: 'c0' } } });
    const p = started(exp);
    const t0 = Date.now();
    let err = null;
    try { hostApi(p).read('total'); } catch (e) { err = e; }
    eq(err?.code, 'E-EVENT-LOOP', String(err));
    ok(/one evaluation/.test(err.message), err.message);
    // Each door call on a fresh run: results evaluated before a fault stay cached (they are right), so a second call
    // on the same run has less to do.
    for (const call of [(d) => d.eval('experience', 'c0'), (d) => d.read('experience', 'c0'), (d) => d.template('experience', '{{ c0 }}')]) {
      err = null;
      try { call(makePageDoor(started(exp), 'test', { errors: [] })); } catch (e) { err = e; }
      eq(err?.code, 'E-EVENT-LOOP', String(err));
    }
    ok(Date.now() - t0 < 10000, `took ${Date.now() - t0} ms`);
    ok(!p.stopped, 'a read is refused; play goes on');
    eq(p.eval('experience', 'c20'), 8, 'a short chain still answers');
  },
  // ---------- item 4: the result-size walk never recurses; a deep value gets its declaration's finding ----------
  'item 4: jsonUnits counts a value 100,000 levels deep with no stack overflow, and stops at its limit'() {
    let deep = 1; for (let i = 0; i < 100000; i++) deep = [deep];
    eq(jsonUnits(deep, 1e9), 200001);
    ok(jsonUnits(deep, 1000) > 1000);
    eq(jsonUnits({ a: [1, 'x', null, { b: true }], c: undefined }, 1e9), JSON.stringify({ a: [1, 'x', null, { b: true }] }).length);
    eq(jsonUnits([undefined, 2], 1e9), JSON.stringify([undefined, 2]).length);
  },
  'item 4: a 10,000-deep value from fold in a set is refused by its declaration, rolls back and stops with its code'() {
    const p = started(oneScene({
      values: { deep: { type: 'array', initial: [], maxItems: 4, items: { type: 'array', maxItems: 4, items: { type: 'number', minimum: 0, maximum: 1 } } } },
      on: { added: [{ id: 'a', actions: [{ id: 's', set: 'deep', to: 'fold(range(1000), [], fold(range(10), acc, [acc]))' }] }] },
    }));
    let thrown = null; let r;
    try { r = p.send('one', 'added'); } catch (e) { thrown = e; }
    eq(thrown, null, String(thrown));
    ok(['E-TYPE', 'E-RANGE'].includes(p.stopped?.code), JSON.stringify(r?.fault?.message || p.stopped?.message));
    eq(p.read('one', 'deep'), []);
  },
  'item 4: the same value in a binding is counted with no stack error; its length shows'() {
    const p = started(oneScene({ bindings: [{ target: 'count', text: '{{ length(fold(range(1000), [], fold(range(10), acc, [acc]))) }}' }] }));
    const d = new Drawing(p);
    d.mountScene('one');
    p.bindingPhase(() => d.paint());
    eq(d.faults, []);
    eq(d.frames.one.byLocal.get('count').text ?? d.frames.one.byLocal.get('count').children?.[0]?.text, '1');
  },
  // ---------- item 5: an add-on's timer fields never reach the engine's own ----------
  'item 5: an outside capability with no events cannot emit through a timer field (marker, link, clip, mid); its own timer still comes back with its fields'() {
    const digest = `sha256:${'1'.repeat(64)}`;
    const manifest = { format: 'hsvg/2.0', kind: 'capability', id: 'test.sneak', version: '1.0.0', adds: { calls: { go: { with: { type: 'object', properties: {} } } }, events: [] } };
    let emitted = null; const back = [];
    registerAddon({ manifest, digest, code: { install(door) {
      return {
        calls: { go(address) {
          try { door.emit(address, 'secret'); } catch (e) { emitted = e.code; }
          door.timers.add(address, door.now() + 1, { marker: 'secret', link: 'away', clip: 'pop', mid: 'm', path: [], index: 0, scale: 0 });
        } },
        timer(t) { back.push(t); },
      };
    } } });
    try {
      const exp = oneScene({
        values: { heard: { type: 'number', initial: 0, minimum: 0, maximum: 9 } },
        on: { secret: [{ id: 'h', actions: [{ id: 'a', set: 'heard', to: 'heard + 1' }] }], go: [{ id: 'g', actions: [{ id: 'c', call: 'test.sneak.go', with: {} }] }] },
        expExtra: { needs: ['test.sneak'], about: { title: 't', trust: { pins: { 'test.sneak@1.0.0': digest } } } },
      });
      const p = started(exp, { capabilities: { 'test.sneak': modulePort({ lock: { 'test.sneak@1.0.0': digest } }) } });
      let links = 0; p.onTimedLink = () => { links++; };
      ok(p.send('one', 'go').ok);
      eq(emitted, 'E-ADDON', 'a direct emit is refused');
      p.advance(5);
      eq(p.read('one', 'heard'), 0, 'the marker field emitted nothing');
      eq(links, 0, 'the link field fired no timed link');
      ok(!p.stopped, String(p.stopped?.message));
      eq(back.length, 1);
      eq([back[0].marker, back[0].link, back[0].owner, back[0].cap], ['secret', 'away', 'one', 'test.sneak'], 'the add-on sees its own fields');
    } finally { unregister('test.sneak'); }
  },
  // ---------- item 6: openUrl without its grant does nothing, is reported, and reaches no host ----------
  // With no host profile every asked kind counts as optional (10.5), so the link does nothing and play goes on.
  'item 6: with no host profile, a person\'s openUrl does nothing, is reported, and no output reaches a host'() {
    const exp = () => oneScene({ grants: { openUrl: true }, inputs: { link: { kind: 'content', type: 'string', contentType: 'url', initial: 'https://example.com/' } },
      controls: { go: { kind: 'button', target: 'mark', event: 'go', label: 'Go' } }, on: { go: [{ id: 'g', actions: [{ id: 'o', call: 'player.openUrl', with: {field: "'link'"} }] }] } });
    const p = started(exp());
    eq(p.grants, { openUrl: false });
    const heard = []; hostApi(p).on('openUrl', (o) => heard.push(o));
    const r = p.activate('one', 'go');
    ok(r.ok); eq(r.outputs, []); ok(!p.stopped, 'play goes on');
    ok(p.notes?.some(n => n.kind === 'grant'), JSON.stringify(p.notes));
    eq(heard, []);
    // Granted by a host, the same press reaches it.
    const q = started(exp(), undefined, granting);
    const got = []; hostApi(q).on('openUrl', (o) => got.push(o.detail.field));
    ok(q.activate('one', 'go').ok);
    eq(got, ['link']);
  },
  'item 6: refused but optional, openUrl does nothing and is reported; play goes on'() {
    const exp = oneScene({ grants: { openUrl: true, optional: ['openUrl'] }, inputs: { link: { kind: 'content', type: 'string', contentType: 'url', initial: 'https://example.com/' } },
      controls: { go: { kind: 'button', target: 'mark', event: 'go', label: 'Go' } }, on: { go: [{ id: 'g', actions: [{ id: 'o', call: 'player.openUrl', with: {field: "'link'"} }] }] } });
    const p = started(exp);
    const r = p.activate('one', 'go');
    ok(r.ok); eq(r.outputs, []);
    ok(p.notes?.some(n => n.kind === 'grant'), JSON.stringify(p.notes));
  },
  // ---------- item 7: the capability word scan reads names as JavaScript does ----------
  'item 7: the scan finds window, document, localStorage and location written with escapes, and constructor'() {
    const proof = String.raw`export function install(door) { return {}; }
export function escapeProof() {
  const w = window;
  w.__pwned = 'capability escaped: ' + typeof w.\u{6c}ocation + ' ' + w.document.title;
  try { w.localStorage.setItem('from-addon', '1'); } catch (e) { void e; }
}`;
    const said = scanCode(proof, 'capability').join(' | ');
    for (const w of ['window', 'location', 'document', 'localStorage']) ok(said.includes(`"${w}"`), `${w}: ${said}`);
    ok(scanCode('export function install(door) { return { f: () => (() => 0).constructor }; }', 'capability').some(m => m.includes('"constructor"')));
    ok(scanCode('export function make(step) { return { f: () => self["\\x77indow"] }; }', 'module').some(m => m.includes('"window"')), 'a \\x escape in a string is read too');
    eq(scanCode('export function install(door) { return { label: () => "caf\\u00e9" }; }', 'capability'), [], 'an escape that spells no banned word is fine');
  },
  // ---------- item 8: a module that never calls step() stops at its time budget ----------
  'item 8: the meter puts a check in every loop condition and function body, and the code means the same'() {
    eq(metered('for (;;) n++;'), 'for (; __hsvgTick();) n++;');
    eq(metered('while (true) n++;'), 'while (__hsvgTick() && (true)) n++;');
    eq(metered('do n++; while (true);'), 'do n++; while (__hsvgTick() && (true));');
    eq(metered('const f = (n) => n ? f(n - 1) : 0;'), 'const f = (n) => { __hsvgTick(); return (n ? f(n - 1) : 0); };');
    eq(metered('function g(a) { if (a) { return 1 } }'), 'function g(a) { __hsvgTick(); if (a) { return 1 } }');
    const src = `export function make(step) {
  const sq = x => x * x
  const o = { m(a) { return a.map(v => sq(v)).filter(v => v > 1) }, get k() { return \`\${[1, 2].map(z => z + 1).join('-')}/\` } };
  let t = 0; for (let i = 0; i < 4; i++) t += i; for (const v of [1, 2]) t += v; let j = 0; while (j < 3) j++; do j--; while (j > 0)
  return { f: () => ({ m: o.m([1, 2, 3]), k: o.k, t, j, r: /a\\/b/.test('a/b') ? 2 / 1 : 0 }) };
}`;
    const run = (text) => new Function('__hsvgTick', `${text.replace('export function make', 'function make')}; return make(() => {}).f();`)(() => true);
    eq(run(metered(src)), run(src));
    eq(run(src), { m: [4, 9], k: '2-3/', t: 9, j: 0, r: 2 });
  },
  async 'item 8: an outside module that loops without step() (for (;;), while (true), do, recursion) stops within its time budget'() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-f1c-loop-'));
    let loaded = [];
    try {
      const EX = path.join(repo, 'engine', 'v2', 'addons', 'examples');
      fs.cpSync(path.join(EX, 'addons'), path.join(dir, 'addons'), { recursive: true });
      fs.cpSync(path.join(EX, 'noughts'), path.join(dir, 'noughts'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'addons', 'example.noughts', 'index.mjs'), `// It never calls step().
export function make(step) {
  const grow = (n) => (n ? grow(n - 1) + grow(n - 1) : 1);
  return {
    turn({ board, cell, level }) {
      let n = 0;
      if (cell === 0) for (;;) n++;
      if (cell === 1) while (true) n++;
      if (cell === 2) do n++; while (true);
      if (cell === 3) n = grow(60);
      return { board, winner: '', reply: -1 };
    },
  };
}
`);
      const exp = path.join(dir, 'noughts');
      await pin(exp);
      const src = await folderSource(exp);
      const r = checkExperience(src, schemas());
      eq(r.diags.filter(d => d.code.startsWith('E-')), []);
      loaded = await loadAddons(src, r.experience, { allow: Object.keys(r.experience.addons || {}) });
      const lock = Object.fromEntries(loaded.map(a => [a.pinned, a.digest]));
      for (const c of ['c0', 'c1', 'c2', 'c3']) {
        const p = new Player(r.experience, { capabilities: Object.fromEntries(loaded.map(a => [a.id, modulePort({ lock })])) });
        ok(p.start().ok);
        ok(p.activate('pick', 'levels', 'easy').ok); ok(p.activate('pick', 'go').ok); p.advance(600);
        const t0 = Date.now();
        const f = p.activate('game', 'cells', c);
        const took = Date.now() - t0;
        eq(f.ok, false, c);
        eq(f.fault.code, 'E-MODULE-RESULT', `${c}: ${f.fault.message}`);
        ok(/time budget/.test(f.fault.message), f.fault.message);
        ok(took < 2000, `${c} took ${took} ms (budget 250 ms)`);
      }
    } finally {
      for (const a of loaded) unregister(a.id); // the registry as the other tests expect it
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
  'item 8: the executor stops a metered call at its time and keeps the step count apart'() {
    const make = new Function('__hsvgTick', `return (step) => ({ spin: () => { for (; __hsvgTick();) {} }, count: () => { let i = 0; while (__hsvgTick() && (i < 5000)) { step(); i++; } return i; } });`)(moduleTick);
    const m = confinedExecutor().load({ name: 'm', make });
    const t0 = Date.now();
    const r = m.call('spin', {}, { ms: 100, steps: 1000 });
    eq(r.ok, false); ok(/time budget/.test(r.why), r.why); ok(Date.now() - t0 < 1000);
    eq(m.call('count', {}, { ms: 100, steps: 10000 }), { ok: true, value: 5000, steps: 5000 }, 'ticks count no step');
    eq(moduleTick(), true, 'outside a call a tick does nothing');
  },
  // ---------- item 9: sort by code points; ordinary word ids; own colour roles ----------
  'item 9 (finding 8): sort orders strings by code point, so U+FF61 comes before U+1F600'() {
    const scope = { name: (n) => { throw new Error(n); }, has: () => false, builtin: () => undefined };
    const sorted = (xs, down = false) => evaluate(parse(`sort(${JSON.stringify(xs)}, item${down ? ', true' : ''})`), scope);
    eq(sorted(['😀', '｡']), ['｡', '😀']);
    eq(sorted(['b', 'a', '😀', '', 'ab', '']), ['', 'a', 'ab', 'b', '', '😀']);
    eq(sorted(['｡', '😀'], true), ['😀', '｡']);
    eq(sorted([3, 1, 2]), [1, 2, 3], 'numbers as before');
  },
  'item 9 (finding 9): a words file reads constructor, toString and __proto__ as ordinary ids'() {
    const said = [];
    const w = parseWords('id,text\nconstructor,Hello\ntoString,Hi\n__proto__,Yo\n', (m) => said.push(m));
    eq(said, []);
    eq([w.constructor, w.toString, Object.getOwnPropertyDescriptor(w, '__proto__')?.value], ['Hello', 'Hi', 'Yo']);
    eq(Object.keys(w), ['constructor', 'toString', '__proto__']);
    parseWords('id,text\na,1\na,2\n', (m) => said.push(m));
    eq(said, ['word a is repeated'], 'a repeated id is still found');
  },
  'item 9 (finding 10): a colour binding reads only the theme\'s own roles; constructor leaves the colour as it is'() {
    const p = started(oneScene({ values: { role: { type: 'string', initial: 'constructor', maxLength: 20 } }, bindings: [{ target: 'mark', color: 'role' }] }));
    const d = new Drawing(p);
    d.mountScene('one');
    const fill = () => d.frames.one.byLocal.get('mark').attrs.fill;
    const before = fill();
    p.bindingPhase(() => d.paint());
    eq(fill(), before, 'an inherited name is unknown');
    for (const r of ['toString', '__proto__', 'hasOwnProperty']) { p.state.blocks.one.values = { role: r }; p.bindingPhase(() => d.paint()); eq(fill(), before, r); }
    eq(d.roleColour('constructor'), null);
    const own = Object.keys(d.theme.colorRoles || {})[0];
    if (own) eq(d.roleColour(own), d.theme.colorRoles[own]);
  },
};
