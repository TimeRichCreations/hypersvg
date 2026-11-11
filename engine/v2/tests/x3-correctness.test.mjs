// Engine correctness. Each test failed before its fix.
// No browser.
import { Engine } from '../src/runtime.mjs';
import { Player } from '../src/story.mjs';
import { hostApi } from '../src/host.mjs';
import * as formula from '../src/formula.mjs';
const { parse, evaluate } = formula;
const pluralForm = (...a) => formula.pluralForm(...a);
import { FORMAT } from '../src/limits.mjs';
import * as layout from '../src/layout.mjs';
import { eq, ok, schemas, mapSource, addonCode } from './helpers.mjs';
import { checkValue } from '../src/runtime.mjs';
import { checkExperience } from '../check/index.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repo } from './helpers.mjs';
import { applyChange, besidePath } from '../tools/change/apply.mjs';
import { readFolder, memorySource, digestAt } from '../tools/change/folder.mjs';
import { folderSource, loadExperience } from '../src/load.mjs';
import * as kits from '../check/kits.mjs';
import { attachAudio } from '../web/audio-web.mjs';
const { richTextField } = await addonCode('../web/richtext-web.mjs', import.meta.url) ?? {};
const { attachCaptions } = await addonCode('../web/captions-web.mjs', import.meta.url) ?? {};
import { base as checkBase } from './check-refs.test.mjs';

const svg = (inner = '', vb = '0 0 100 100') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" data-hsvg-version="2.0">${inner}</svg>`;
// A tiny experience: scene "one" (scene keys given), blocks, limits.
const experience = (scene = {}, { blocks = {}, limits = {}, drawing = svg('<g id="slot" data-hsvg-slot="slot"/><rect id="x" width="1" height="1"/>'), exp = {}, scenes = {} } = {}) => ({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', story: { start: 'one', scenes: { one: 'one.json', ...Object.fromEntries(Object.keys(scenes).map(k => [k, `${k}.json`])) } }, ...exp },
  words: { en: {} }, data: {},
  scenes: {
    one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg', ...scene }, words: {}, drawings: { main: { text: drawing } } },
    ...Object.fromEntries(Object.entries(scenes).map(([k, s]) => [k, { doc: { format: 'hsvg/2.0', kind: 'scene', id: k, drawing: `${k}.svg`, ...s }, words: {}, drawings: { main: { text: drawing } } }])),
  },
  blocks,
  limits: { ...FORMAT, ...limits },
});
const mountOne = (e) => e.transaction('host', () => e.mount('one', 'scene', 'one'));
const faultOf = (r) => (r.ok ? null : r.fault.code);
const counter = (names) => Object.fromEntries(names.map(n => [n, { type: 'number', initial: 0, minimum: 0, maximum: 1e9 }]));

// A scene that plays clip c (100 ms) on entry; each marker event logs its name and time into `log`.
const markerScene = (clip) => ({
  values: { log: { type: 'string', initial: '', maxLength: 4000 } },
  entry: [{ id: 'p', play: 'c' }],
  clips: { c: { durationMs: 100, tracks: [{ id: 't', target: 'x', channel: 'opacity', keys: [[0, 1], [100, 0]] }], ...clip } },
  on: Object.fromEntries((clip.markers || []).map(m => [m.event, [{ id: 'r', actions: [{ id: 'a', set: 'log', to: `log + '${m.event}@' + numberText(hsvg.elapsed, 0) + ' '` }] }]])),
});

// A story player: scenes {id: scene keys}, links, experience keys.
const sceneOf = (id, extra = {}) => ({ doc: { format: 'hsvg/2.0', kind: 'scene', id, drawing: `${id}.svg`, ...extra }, words: {} });
const story = (scenes, { start = Object.keys(scenes)[0], links = [], exp = {} } = {}) => new Player({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', story: { start, links, scenes: Object.fromEntries(Object.keys(scenes).map(k => [k, `${k}.json`])) }, ...exp },
  words: { en: {} }, data: {}, blocks: {}, scenes: Object.fromEntries(Object.entries(scenes).map(([k, v]) => [k, sceneOf(k, v)])),
});
const unit = { type: 'number', initial: 0, minimum: 0, maximum: 1 };
const codeOf = (fn) => { try { fn(); return null; } catch (e) { return e.code || `${e.name}: ${e.message}`; } };

// A fake window for the web parts: listeners kept by type (added and removed), a fake Web Audio, a tiny DOM.
function fakeWin() {
  const ctxs = [];
  const on = (o) => { o.handlers = {}; o.addEventListener = (t, f) => { (o.handlers[t] ??= []).push(f); }; o.removeEventListener = (t, f) => { o.handlers[t] = (o.handlers[t] || []).filter(x => x !== f); }; o.fire = (t, ev = {}) => { for (const f of [...(o.handlers[t] || [])]) f(ev); }; return o; };
  class Node { constructor() { this.out = []; } connect(n) { this.out.push(n); return n; } disconnect() { this.out = []; } }
  class Param { constructor() { this.value = 0; } setValueAtTime(v) { this.value = v; } linearRampToValueAtTime(v) { this.value = v; } cancelScheduledValues() {} }
  class Ctx {
    constructor() { this.currentTime = 0; this.destination = new Node(); this.sources = []; this.state = 'running'; ctxs.push(this); }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    createGain() { const n = new Node(); n.gain = new Param(); return n; }
    createBufferSource() { const n = new Node(); n.start = () => { n.playing = true; }; n.stop = () => { n.playing = false; }; this.sources.push(n); return n; }
    decodeAudioData() { return Promise.resolve({ duration: 10 }); }
  }
  const el = (tag) => { const e = { tag, children: [], attrs: {}, style: {}, hidden: false, textContent: '', parent: null,
    get isConnected() { return !!this.parent; }, setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; }, removeAttribute(k) { delete this.attrs[k]; },
    appendChild(c) { c.parent = this; this.children.push(c); return c; }, remove() { if (this.parent) { this.parent.children = this.parent.children.filter(x => x !== this); this.parent = null; } },
    querySelector: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) }; return e; };
  const doc = on({ hidden: false, createElement: el });
  const win = on({ location: { href: 'http://x/' }, AudioContext: Ctx, document: doc, getComputedStyle: () => ({ position: 'relative' }) });
  return { ctxs, doc, win, el };
}
const tick = () => new Promise(r => setTimeout(r, 0));

export const tests = {
  'X3.1 clip markers fire on an endless loop, once per crossed iteration (6.7)'() {
    const e = new Engine(experience(markerScene({ loop: true, markers: [{ id: 'm', atMs: 50, event: 'hit' }] })));
    ok(mountOne(e).ok);
    e.advance(1000);
    eq(e.read('one', 'log').trim().split(' ').length, 10, e.read('one', 'log'));
    ok(e.state.timers.length <= 2, `timers ${e.state.timers.length}`);
  },
  'X3.1 ping-pong reverse runs cross markers in reverse order (6.7)'() {
    const e = new Engine(experience(markerScene({ loop: 2, loopMode: 'ping-pong', markers: [{ id: 'a', atMs: 10, event: 'ma' }, { id: 'b', atMs: 90, event: 'mb' }] })));
    ok(mountOne(e).ok);
    e.advance(300);
    eq(e.read('one', 'log').trim(), 'ma@10 mb@90 mb@110 ma@190');
  },
  'X3.1 a large loop count queues one timer per marker, never one per loop'() {
    const e = new Engine(experience(markerScene({ loop: 1000000, markers: [{ id: 'm', atMs: 50, event: 'hit' }] })));
    const t0 = Date.now();
    ok(mountOne(e).ok);
    ok(e.state.timers.length <= 2, `timers ${e.state.timers.length}`);
    e.advance(350);
    eq(e.read('one', 'log').trim().split(' ').length, 4);
    ok(Date.now() - t0 < 1000, `${Date.now() - t0} ms`);
  },
  'X3.2 a faulting paused reaction stops play once and never recurses (3.10, 9.2)'() {
    let runs = 0;
    const p = story({ a: { values: { v: unit }, on: { paused: [{ id: 'r', actions: [{ id: 's', set: 'v', to: 5 }] }] } } });
    ok(p.start().ok);
    const tx = p.transaction.bind(p); p.transaction = (src, fn) => { runs++; return tx(src, fn); };
    const h = hostApi(p);
    eq(codeOf(() => h.pause('ad')), null, 'pause itself is the host\'s call and is not refused');
    eq(p.stopped?.code, 'E-RANGE');
    eq(runs, 1, 'the reaction ran once');
    ok(!p.send('a', 'anything').ok, 'later sources are refused');
    eq(runs, 2);
  },
  'X3.2a a held outcome that faults stops play; start reports the stop (3.2, 9.2)'() {
    const p = story({ a: { outputs: { go: { kind: 'event' } }, entry: [{ id: 'e', emit: 'go' }] }, b: { inputs: { x: { kind: 'content', type: 'number', initial: 0, minimum: 0, maximum: 9 } } } },
      { links: [{ id: 'a-b', from: 'a', on: 'go', to: 'b', carry: { x: '1 / 0' } }] });
    let heard = null; p.onStop = (f, source) => { heard = [f.code, source]; };
    p.start();
    eq(p.stopped?.code, 'E-FORMULA');
    eq(heard, ['E-FORMULA', 'link'], 'the page hears the stop once');
    eq(p.scene, 'a');
    ok(!p.send('a', 'press:x').ok);
  },
  'X3.2b after a deadline faults, later deadlines in the same advance never fire (9.2)'() {
    const m = (id, delay, action) => ({ initial: 's', states: { s: { after: [{ id: 'go', delayMs: delay, target: 't' }] }, t: { entry: [action] } } });
    const p = story({ a: { values: { v: unit, log: { type: 'string', initial: '' } }, machines: { m1: m('m1', 10, { id: 'bad', set: 'v', to: 5 }), m2: m('m2', 20, { id: 'ok', set: 'log', to: "'ran after the fault'" }) } } });
    ok(p.start().ok);
    const rs = p.advance(100);
    eq(rs.map(r => (r.ok ? 'ok' : r.fault.code)), ['E-RANGE']);
    eq(p.read('a', 'log'), '');
    eq(p.state.now, 10, 'the clock stops at the fault');
    eq(p.advance(100), []);
  },
  'X3.2c after a fatal stop the host API refuses every call with E-HOST-CLOSED (10.6)'() {
    const p = story({ a: { values: { v: unit }, on: { 'press:x': [{ id: 'r', actions: [{ id: 's', set: 'v', to: 5 }] }] } } },
      { exp: { inputs: { won: { kind: 'trigger' }, level: { kind: 'knob', type: 'number', initial: 0, minimum: 0, maximum: 9 } }, outputs: { done: { kind: 'event' } } } });
    ok(p.start().ok);
    const h = hostApi(p);
    eq(p.send('a', 'press:x', {}, 'person').fault.code, 'E-RANGE');
    eq([codeOf(() => h.emit('won')), codeOf(() => h.set('level', 3)), codeOf(() => h.pause('ad')), codeOf(() => h.read('level')), codeOf(() => h.on('done', () => {})), codeOf(() => h.restart())],
      Array(6).fill('E-HOST-CLOSED'));
  },
  'X3.2c a host change that faults is refused and play goes on (9.2)'() {
    const p = story({ a: { values: { v: unit }, on: { 'changed:level': [{ id: 'r', actions: [{ id: 's', set: 'v', to: 'level' }] }] } } },
      { exp: { inputs: { level: { kind: 'knob', type: 'number', initial: 0, minimum: 0, maximum: 9 } } } });
    ok(p.start().ok);
    const h = hostApi(p);
    eq(codeOf(() => h.set('level', 3)), 'E-RANGE');
    eq(p.stopped ?? null, null);
    eq(codeOf(() => h.set('level', 1)), null);
    eq(p.read('a', 'v'), 1);
  },
  'X3.3 plural follows the language with Intl.PluralRules (2.7)'() {
    const words = { 'apple.zero': 'z', 'apple.one': 'one', 'apple.two': 'two', 'apple.few': 'few', 'apple.many': 'many', 'apple.other': 'other' };
    const say = (language, n) => evaluate(parse(`plural(${n}, 'apple')`), { name: () => { throw new Error('no names'); }, words, language });
    eq([0, 1, 1.5, 2].map(n => say('fr', n)), ['one', 'one', 'one', 'other']);
    eq([1, 3, 5, 22].map(n => say('pl', n)), ['one', 'few', 'many', 'few']);
    eq([0, 2, 3, 11].map(n => say('ar', n)), ['z', 'two', 'few', 'many']);
    eq([0, 1, 2].map(n => say('en', n)), ['other', 'one', 'other']);
    // A form with no row reads `other`.
    eq(evaluate(parse("plural(3, 'pear')"), { name: () => 0, words: { 'pear.one': 'a pear', 'pear.other': 'pears' }, language: 'pl' }), 'pears');
  },
  'X3.3 plural: a language the platform does not know, or no Intl, takes the fixed fallback (one for 1, else other)'() {
    eq([0, 1, 2].map(n => pluralForm(n, 'tlh')), ['other', 'one', 'other']);
    const real = globalThis.Intl;
    try { globalThis.Intl = undefined; eq([0, 1, 1.5].map(n => pluralForm(n, 'fr')), ['other', 'one', 'other']); } finally { globalThis.Intl = real; }
  },
  'X3.3 plural in a block reads the active language'() {
    const e = new Engine(experience({ values: { said: { type: 'string', initial: '', maxLength: 40 } }, on: { go: [{ id: 'g', actions: [{ id: 's', set: 'said', to: "plural(3, 'apple')" }] }] } },
      { exp: { language: 'pl' } }));
    e.exp.words = { pl: { 'apple.one': 'jabłko', 'apple.few': 'jabłka', 'apple.other': 'jabłek' } };
    ok(mountOne(e).ok);
    ok(e.send('one', 'go', {}, 'host').ok, e.lastFault?.message);
    eq(e.read('one', 'said'), 'jabłka');
  },
  'X3.4 the ambient size: read at mount, changed:size on a new box or shape, nothing for the same (5.5)'() {
    const e = new Engine(experience({ values: { log: { type: 'string', initial: '', maxLength: 400 } },
      computed: { box: "size.shape + ' ' + numberText(size.width, 0) + 'x' + numberText(hsvg.size.height, 0)" },
      on: { 'changed:size': [{ id: 'c', actions: [{ id: 'l', set: 'log', to: "log + size.shape + ' '" }] }] } }));
    ok(typeof e.setSize === 'function', 'the engine takes the size');
    e.setSize({ width: 300, height: 250, shape: 'square' });
    ok(mountOne(e).ok);
    eq(e.eval('one', 'box'), 'square 300x250');
    ok(e.setSize({ width: 728.4, height: 90, shape: 'strip' }).ok);
    eq(e.eval('one', 'box'), 'strip 728x90');
    eq(e.setSize({ width: 728, height: 90, shape: 'strip' }), null, 'the same size is no change');
    eq(e.read('one', 'log'), 'strip ');
  },
  'X3.4 the active shape of a box: the experience\'s own shape map first, else the standard shapes (7.2)'() {
    const activeShape = (...a) => layout.activeShape(...a);
    eq([activeShape({ width: 300, height: 250 }), activeShape({ width: 160, height: 600 }), activeShape({ width: 728, height: 90 })], ['square', 'skyscraper', 'strip']);
    eq(activeShape({ width: 300, height: 600 }, [{ wide: { minAspect: 1 }, narrow: { maxAspect: 1 } }]), 'narrow');
  },
  'X3.5 a visit stops the caller\'s clock: elapsed, clip time and deadlines resume where they were (3.7)'() {
    const clip = { durationMs: 5000, tracks: [{ id: 't', target: 'x', channel: 'opacity', keys: [[0, 1], [5000, 0]] }] };
    const p = story({
      a: { outputs: { go: { kind: 'event' } }, entry: [{ id: 'p', play: 'c' }], clips: { c: clip }, on: { 'press:go': [{ id: 'r', actions: [{ id: 'e', emit: 'go' }] }] } },
      v: { outputs: { back: { kind: 'event' } }, on: { 'press:back': [{ id: 'r', actions: [{ id: 'e', emit: 'back' }] }] } },
    }, { links: [{ id: 'a-v', from: 'a', on: 'go', to: 'v', visit: true }, { id: 'v-a', from: 'v', on: 'back', return: true }] });
    ok(p.start().ok);
    p.advance(1000);
    const clock = () => [p.eval('a', 'hsvg.elapsed'), p.state.now - p.state.blocks.a.clips.c.startedAt, p.state.timers.find(t => t.owner === 'a' && t.clip === 'c').due - p.state.now];
    eq(clock(), [1000, 1000, 4000]);
    ok(p.send('a', 'press:go').ok); eq(p.scene, 'v');
    p.advance(3000);
    ok(p.send('v', 'press:back').ok); eq(p.scene, 'a');
    eq(clock(), [1000, 1000, 4000], 'elapsed, clip time and the clip end as before the visit');
  },
  'X3.5 a host pause stops elapsed too (3.10)'() {
    const p = story({ a: {} });
    ok(p.start().ok);
    p.advance(1000);
    hostApi(p).pause('ad');
    p.advance(3000);
    eq(p.eval('a', 'hsvg.elapsed'), 1000);
  },
  'X3.6 names from Object.prototype never resolve as values in the engine (5.9)'() {
    const e = new Engine(experience({ values: { valueOf: { type: 'number', initial: 3, minimum: 0, maximum: 9 }, toString: { type: 'number', initial: 1, minimum: 0, maximum: 9 }, out: { type: 'number', initial: 0, minimum: 0, maximum: 9 }, hits: { type: 'array', items: { type: 'number' }, maxItems: 9, initial: [] } },
      on: { go: [{ id: 'g', actions: [{ id: 's', set: 'out', to: 'valueOf + 1' }, { id: 'h', set: 'hits', to: 'filter([1, 2], item === toString)' }] }] } }));
    ok(mountOne(e).ok);
    ok(e.send('one', 'go', {}, 'host').ok, e.lastFault?.message);
    eq([e.read('one', 'out'), e.read('one', 'hits')], [4, [1]], 'a declared valueOf and toString are the author\'s values');
    const f = new Engine(experience({}));
    ok(mountOne(f).ok);
    for (const n of ['toString', 'hasOwnProperty', 'constructor', 'isPrototypeOf', 'hsvg.toString']) {
      let code = null; try { f.eval('one', n); } catch (err) { code = err.code; }
      eq(code, 'E-FORMULA', n);
    }
  },
  'X3.6 checkValue refuses an undeclared member named like an Object.prototype member, and __proto__'() {
    const decl = { type: 'object', properties: { a: { type: 'number' } } };
    eq(checkValue(decl, { a: 1, toString: 2 })?.[0], 'E-TYPE');
    eq(checkValue(decl, JSON.parse('{"a": 1, "__proto__": {"x": 1}}'))?.[0], 'E-TYPE');
    eq(checkValue({ type: 'object', properties: { a: { type: 'number' }, valueOf: { type: 'number' } } }, { a: 1 })?.[0], 'E-TYPE', 'a missing declared member valueOf');
  },
  'X3.6 the checker never resolves an Object.prototype name: a formula or a changed: event'() {
    const run = (edit) => { const f = checkBase(); edit(f); return checkExperience(mapSource(f), schemas()).diags.filter(d => d.code.startsWith('E-')).map(d => d.code); };
    eq(run(() => {}), [], 'the base checks clean');
    ok(run(f => { f['scenes/one/scene.json'].computed.bad = 'toString'; }).includes('E-REF-UNKNOWN'), 'a bare toString');
    ok(run(f => { f['scenes/one/scene.json'].computed.bad = 'hsvg.valueOf'; }).includes('E-REF-UNKNOWN'), 'hsvg.valueOf');
    ok(run(f => { f['scenes/one/scene.json'].on['changed:toString'] = [{ id: 'c', actions: [{ id: 'a', set: 'score', to: 'score + 1' }] }]; }).includes('E-REF-UNKNOWN'), 'changed:toString');
  },
  'X3.7 now is the date: UTC milliseconds rounded down to whole seconds, from a fixed epoch or the wall clock (5.5)'() {
    const at = (opts, ms) => { const e = new Engine(experience({}), opts); ok(mountOne(e).ok); e.advance(ms); return e.eval('one', 'hsvg.now'); };
    eq([at({ epochMs: 1700000000000 }, 0), at({ epochMs: 1700000000000 }, 5300), at({ epochMs: 1700000000500 }, 600)], [1700000000000, 1700000005000, 1700000001000]);
    eq(at({ wallClock: () => 1700000004321 }, 0), 1700000004000);
    eq(at({ wallClock: () => 1700000004321, epochMs: 5000 }, 0), 5000, 'a fixed epoch wins (play tests)');
    eq(at({}, 5300), 5000, 'no epoch: 0');
  },
  'X3.7 changed:now fires once a second, only in blocks that hear it (5.5)'() {
    const e = new Engine(experience({ values: { n: { type: 'number', initial: 0, minimum: 0, maximum: 99 }, seen: { type: 'array', items: { type: 'number' }, maxItems: 20, initial: [] } },
      on: { 'changed:now': [{ id: 'c', actions: [{ id: 'a', set: 'n', to: 'n + 1' }, { id: 's', set: 'seen', to: 'append(seen, now - 1700000000000, 20)' }] }] } }), { epochMs: 1700000000500 });
    ok(mountOne(e).ok);
    e.advance(5300);
    eq([e.read('one', 'n'), e.read('one', 'seen')], [5, [1000, 2000, 3000, 4000, 5000]]);
    const split = new Engine(experience({ values: { n: { type: 'number', initial: 0, minimum: 0, maximum: 99 } }, on: { 'changed:now': [{ id: 'c', actions: [{ id: 'a', set: 'n', to: 'n + 1' }] }] } }), { epochMs: 1700000000500 });
    ok(mountOne(split).ok);
    for (let i = 0; i < 53; i++) split.advance(100);
    eq(split.read('one', 'n'), 5, 'the same events in small steps');
    const quiet = new Engine(experience({}), { epochMs: 0 });
    ok(mountOne(quiet).ok);
    eq(quiet.advance(5000).length, 0, 'no block hears it: no step');
  },
  async 'X3.8 destroy stops music and spoken recordings for good: a shown tab or a press starts nothing (10.6)'() {
    const w = fakeWin();
    const p = { scene: 'a', listeners: [], limits: { soundCopies: 4, oneShotSounds: 16 }, state: { blocks: { a: {} }, ambient: { voice: true } },
      mix: () => ({ music: 1, sounds: 1, voice: 1 }), music: () => ({ sound: 'theme' }), pausedStage: () => null,
      soundSource: (s, n) => ({ path: `${n}.wav` }), lines: { align() {}, silent() {} } };
    const a = attachAudio(p, w.win, { assetsUrl: './', assets: async () => new ArrayBuffer(4) });
    w.win.fire('pointerdown', { isTrusted: true });
    await tick(); await tick();
    const ctx = w.ctxs[0];
    eq(a.mixer.nowPlaying(), 'theme');
    ok(typeof a.destroy === 'function', 'the audio part has a destroy');
    a.destroy();
    eq([a.mixer.nowPlaying(), ctx.sources.some(n => n.playing), ctx.state], [null, false, 'closed']);
    w.doc.hidden = true; w.doc.fire('visibilitychange'); w.doc.hidden = false; w.doc.fire('visibilitychange');
    w.win.fire('pointerdown', { isTrusted: true });
    for (const l of p.listeners) l({ deliveries: [{ kind: 'sound', sound: 'bell', group: 'sounds', gain: 1, address: 'a', source: { path: 'bell.wav' } }] });
    await tick(); await tick();
    eq([a.mixer.nowPlaying(), ctx.sources.some(n => n.playing), w.ctxs.length], [null, false, 1], 'nothing sounds after destroy');
    eq([(w.doc.handlers.visibilitychange || []).length, (w.win.handlers.pointerdown || []).length, p.listeners.length], [0, 0, 0], 'no listener is left');
  },
  'X3.8 destroy removes the caption box; a resize after it never brings it back (10.6)'() {
    const w = fakeWin();
    const container = w.el('div'); container.parent = {};
    const p = { scene: 'a', shellId: null, exp: {}, listeners: [], lines: { running: () => [{ address: 'a', line: 'hi', text: 'Hello there', word: 0 }] } };
    const c = attachCaptions(p, {}, container, w.win);
    eq(container.children.length, 1);
    ok(typeof c.destroy === 'function', 'the captions part has a destroy');
    c.destroy();
    eq(container.children.length, 0);
    w.win.fire('resize');
    for (const l of p.listeners) l({});
    eq(container.children.length, 0, 'nothing comes back');
  },
  async 'X3.9 the change tool with --out: a retry returns the first receipt; a refused replay never overwrites it (9.10)'() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-x3-'));
    fs.cpSync(path.join(repo, 'examples', '2.0-kit-ads'), root, { recursive: true });
    const ad = path.join(root, 'ads', 'ad-300x250');
    const out = path.join(root, 'out');
    const expected = await digestAt(memorySource(readFolder(ad), await folderSource(ad)), 'experience.json');
    const req = { format: 'hsvg/2.0', kind: 'change', id: 'chg-a', at: 'edit', target: 'ad-300x250', expected, by: { source: 'agent', right: 'copywriter', who: 'agent:rio' }, reason: 'Shorter headline', changes: [{ address: 'ad-300x250/open/headline@en', old: 'Rain? Bring it on.', new: 'Rain? Go!' }] };
    const requestPath = path.join(root, 'req.json');
    const apply = (r, o = {}) => applyChange(ad, r, { schemas: schemas(), now: '2026-11-07T10:00:00Z', out, requestPath, by: r?.by, ...o });
    const first = await apply(req);
    eq(first.receipt.status, 'pass');
    const other = await apply({ ...req, changes: [{ ...req.changes[0], new: 'Rain? Yes!' }] });
    eq(other.receipt.status, 'fail');
    eq(JSON.parse(fs.readFileSync(besidePath(requestPath), 'utf8')).status, 'pass', 'the first receipt beside the request stays');
    const again = await apply(req, { now: '2026-11-08T10:00:00Z' });
    eq([again.replayed, again.receipt.status, again.receipt.date], [true, 'pass', '2026-11-07T10:00:00Z']);
    const copied = await apply(req, { requestPath: path.join(root, 'copy.json'), now: '2026-11-09T10:00:00Z' });
    eq([copied.replayed, copied.written], [true, []], 'a copy of the request at a new path finds the out folder\'s ledger');
  },
  async 'X3.9 one kit digest: the checker and the change tool agree, and a sample\'s scene moves it (A9.3)'() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-x3-'));
    fs.cpSync(path.join(repo, 'examples', '2.0-kit-ads'), root, { recursive: true });
    const ad = path.join(root, 'ads', 'ad-300x250');
    const kitDir = path.join(root, 'kits', 'ad-kit');
    const kitJson = path.join(kitDir, 'kit.json');
    const k = JSON.parse(fs.readFileSync(kitJson, 'utf8')); k.samples = { s1: 'samples/s1/experience.json' }; fs.writeFileSync(kitJson, JSON.stringify(k, null, 2) + '\n');
    fs.mkdirSync(path.join(kitDir, 'samples', 's1'), { recursive: true });
    fs.writeFileSync(path.join(kitDir, 'samples', 's1', 'experience.json'), JSON.stringify({ format: 'hsvg/2.0', kind: 'experience', id: 's1', language: 'en', story: { start: 'a', scenes: { a: 'a.json' } } }));
    const scene = (title) => fs.writeFileSync(path.join(kitDir, 'samples', 's1', 'a.json'), JSON.stringify({ format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg', about: { title } }));
    const both = async () => {
      const checker = kits.kitDigest(await folderSource(ad), loadExperience(await folderSource(ad), schemas()).experience.kit);
      const tool = digestAt(memorySource(readFolder(kitDir), await folderSource(kitDir)), 'kit.json');
      return [checker, tool];
    };
    scene('one');
    const [c1, t1] = await both();
    eq(c1, t1, 'the checker and the change tool give one digest');
    scene('two');
    const [c2, t2] = await both();
    eq(c2, t2);
    ok(c2 !== c1, 'an edit to a sample\'s scene moves the kit digest');
  },
  'X3.9 the rich-text editor indexes text by UTF-16 units: typing, styling and deleting next to an emoji (6.8.1)'() {
    const mk = (tag) => { const e = { tag, children: [], attrs: {}, style: {}, handlers: {}, value: '', textContent: '', selectionStart: 0, selectionEnd: 0,
      setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; }, addEventListener(t, f) { (this.handlers[t] ??= []).push(f); },
      append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; }, replaceChildren(...c) { this.children = c; },
      setSelectionRange(a, b) { this.selectionStart = a; this.selectionEnd = b; }, fire(t) { for (const f of this.handlers[t] || []) f({ preventDefault() {} }); } }; return e; };
    const doc = { createElement: mk };
    const door = { experience: { themes: {} } };
    let value = null;
    const field = richTextField({ doc, door, word: (k) => k, words: () => ({}), buttonCss: '', roles: () => ({}) }, { styles: ['bold'] }, 'f', 'Text', (v) => { value = v; });
    const input = field.el.children[0];
    const bold = field.el.children[1].children.find(b => b.attrs['data-player-style'] === 'bold');
    const type = (text) => { input.value = text; input.fire('input'); };
    field.set([{ text: '😀a' }]);
    eq(input.value, '😀a');
    type('😀xa');
    eq(value, [{ text: '😀xa' }], 'typed after the emoji');
    input.setSelectionRange(3, 4); bold.fire('click');
    eq(value, [{ text: '😀x' }, { text: 'a', style: 'bold' }], 'the selected letter after the emoji is bold');
    type('xa');
    eq(value, [{ text: 'x' }, { text: 'a', style: 'bold' }], 'deleting the emoji keeps every letter');
  },
  'X3.10 the bare built-in events are reserved as event names: outputs, triggers and every producer (D22, 5.9, 5.12)'() {
    const run = (edit) => { const f = checkBase(); edit(f, f['scenes/one/scene.json'], f['experience.json']); return checkExperience(mapSource(f), schemas()).diags.filter(d => d.code === 'E-NAME-RESERVED').map(d => d.path); };
    eq(run(() => {}), []);
    eq(run((f, s) => { s.outputs.paused = { kind: 'event' }; }), ['/outputs/paused']);
    eq(run((f, s) => { s.on['press:go'][0].actions.push({ id: 'say-resumed', emit: 'resumed' }); }), [`/on/press:go/0/actions/${checkBase()['scenes/one/scene.json'].on['press:go'][0].actions.length}/emit`]);
    eq(run((f, s, e) => { e.inputs.returned = { kind: 'trigger' }; }), ['/inputs/returned']);
    eq(run((f, s) => { s.controls.go.event = 'playEnded'; }), ['/controls/go/event']);
    eq(run((f, s) => { s.clips.wave.markers = [{ id: 'm', atMs: 10, event: 'paused' }]; }), ['/clips/wave/markers/0/event']);
    eq(run((f, s) => { s.values.paused = { type: 'boolean', initial: false }; }), [], 'a value may be called paused: values are not events');
  },
  'X3.10 the host hears a built-in output by its bare name or as hsvg.<name> (5.9, 10.6)'() {
    const p = story({ a: {} });
    const h = hostApi(p);
    const heard = [];
    h.on('hsvg.entered', (o) => heard.push(['hsvg', o.name]));
    h.on('entered', (o) => heard.push(['bare', o.name]));
    ok(p.start().ok);
    eq(heard, [['hsvg', 'entered'], ['bare', 'entered']]);
    eq(codeOf(() => h.on('hsvg.nothing', () => {})), 'E-REF-UNKNOWN');
    eq(codeOf(() => h.read('hsvg.entered')), 'E-REF-UNKNOWN', 'no built-in output is a result to read in 2.0');
  },
};
