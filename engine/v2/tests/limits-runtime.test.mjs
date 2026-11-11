// The limits the engine enforces while playing (9.8), with the player's active limits. Each test lowers one limit
// on a tiny experience (experience.limits, as a package that raises limits sets them) and passes it. No browser.
import { Engine as BaseEngine } from '../src/runtime.mjs';
import { granting } from './helpers.mjs';
const Engine = granting(BaseEngine); // a host that gives what the experience asks (D31: no profile, no grant)
import { Player as BasePlayer } from '../src/story.mjs';
const Player = granting(BasePlayer); // a host that gives what the experience asks (D31: no profile, no grant)
import { Drawing } from '../src/drawing.mjs';
import { FORMAT } from '../src/limits.mjs';
import { imageSize, imagePixels, filterSurface } from '../src/limits-runtime.mjs';
import { parseXml } from '../schema/xml.mjs';
import { eq, ok } from './helpers.mjs';

const svg = (inner = '', vb = '0 0 100 100') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" data-hsvg-version="2.0">${inner}</svg>`;
// A tiny experience: scene "one" (scene keys and drawing given), blocks, and limits lowered as given.
const experience = (scene = {}, { blocks = {}, limits = {}, drawing = svg('<g id="slot" data-hsvg-slot="slot"/>'), exp = {} } = {}) => ({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', story: { start: 'one', scenes: { one: 'one.json' } }, ...exp },
  words: { en: {} }, data: {},
  scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg', ...scene }, words: {}, drawings: { main: { text: drawing } } } },
  blocks,
  limits: { ...FORMAT, ...limits },
});
const block = (id, doc = {}, drawing = svg('<rect width="1" height="1"/>')) => ({ doc: { format: 'hsvg/2.0', kind: 'component', id, drawing: `${id}.svg`, ...doc }, words: {}, drawings: { main: { text: drawing } } });
const mountOne = (e) => e.transaction('host', () => e.mount('one', 'scene', 'one'));
const faultOf = (r) => (r.ok ? null : r.fault.code);
// A PNG header claiming w by h pixels, as a data: URI.
const png = (w, h) => {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const be = (i, v) => { b[i] = (v >>> 24) & 255; b[i + 1] = (v >>> 16) & 255; b[i + 2] = (v >>> 8) & 255; b[i + 3] = v & 255; };
  be(16, w); be(20, h);
  return `data:image/png;base64,${Buffer.from(b).toString('base64')}`;
};

export const tests = {
  'mountDepth: a use inside a use deeper than the limit faults the mounting transaction (E-MOUNT-LIMIT)'() {
    const blocks = { a: block('a', { uses: [{ id: 'b', use: 'b', into: 's' }] }), b: block('b', { uses: [{ id: 'c', use: 'c', into: 's' }] }), c: block('c') };
    const scene = { uses: [{ id: 'a', use: 'a', into: 'slot' }] };
    ok(mountOne(new Engine(experience(scene, { blocks, limits: { mountDepth: 3 } }))).ok);
    const e = new Engine(experience(scene, { blocks, limits: { mountDepth: 2 } }));
    eq(faultOf(mountOne(e)), 'E-MOUNT-LIMIT');
    eq(Object.keys(e.state.blocks), ['experience'], 'rolled back');
  },
  'liveBlockUses: one use more than the limit faults (E-MOUNT-LIMIT)'() {
    const blocks = { a: block('a') };
    const scene = { uses: ['u1', 'u2', 'u3'].map(id => ({ id, use: 'a', into: 'slot' })) };
    ok(mountOne(new Engine(experience(scene, { blocks, limits: { liveBlockUses: 3 } }))).ok);
    eq(faultOf(mountOne(new Engine(experience(scene, { blocks, limits: { liveBlockUses: 2 } })))), 'E-MOUNT-LIMIT');
  },
  'liveRepeatedUses: a repeat with more live items than the limit in one block faults (E-REPEAT-CAPACITY, 4.5)'() {
    const blocks = { a: block('a', { inputs: { n: { kind: 'content', type: 'number', initial: 0 } } }) };
    const scene = { values: { list: { type: 'array', initial: [1, 2, 3] } }, uses: [{ id: 'r', use: 'a', into: 'slot', items: 'list', key: 'item', with: { n: 'item' } }] };
    const e = new Engine(experience(scene, { blocks, limits: { liveRepeatedUses: 3 } }));
    ok(mountOne(e).ok);
    eq(Object.keys(e.state.blocks).filter(k => k.startsWith('one/r[')).length, 3);
    eq(faultOf(mountOne(new Engine(experience(scene, { blocks, limits: { liveRepeatedUses: 2 } })))), 'E-REPEAT-CAPACITY');
  },
  'effectsPerBlock: a block with more effects than the limit is refused when it mounts (E-RANGE, A1)'() {
    // The effects add-on refuses it when the block enters (D31: the core no longer reads addons.effects).
    const fx = { start: 'play', target: 'x', source: 'x', seed: 1, reducedMotion: 'rest' };
    const e = new Engine(experience({ addons: { effects: { particles: { e1: fx, e2: fx, e3: fx } } } }, { limits: { effectsPerBlock: 2 }, exp: { needs: ['effects'] } }));
    eq(faultOf(e.transaction('host', () => { e.mount('one', 'scene', 'one'); e.caps.phase('entered', 'one', e.def('one')); })), 'E-RANGE');
  },
  'mountedElements: SVG elements across the mounted drawings, counted per block from its largest frame (E-MOUNT-LIMIT)'() {
    const blocks = { a: block('a', {}, svg('<rect/><rect/><rect/>')) }; // 4 elements with the root
    const scene = { uses: [{ id: 'u1', use: 'a', into: 'slot' }, { id: 'u2', use: 'a', into: 'slot' }] };
    const drawing = svg('<g data-hsvg-slot="slot"/>'); // 2 elements: 2 + 4 + 4 = 10
    ok(mountOne(new Engine(experience(scene, { blocks, drawing, limits: { mountedElements: 10 } }))).ok);
    eq(faultOf(mountOne(new Engine(experience(scene, { blocks, drawing, limits: { mountedElements: 9 } })))), 'E-MOUNT-LIMIT');
  },
  'imagePixelsEach and imagePixelsAll: decoded pixels of data: images, each and in total (E-MOUNT-LIMIT)'() {
    eq(imageSize(Buffer.from(png(5000, 4000).split(',')[1], 'base64')), [5000, 4000]);
    const big = svg(`<image href="${png(5000, 4000)}" width="10" height="10"/>`); // 20,000,000 pixels
    eq(imagePixels(big), [20000000]);
    eq(faultOf(mountOne(new Engine(experience({}, { drawing: big })))), 'E-MOUNT-LIMIT');
    ok(mountOne(new Engine(experience({}, { drawing: big, limits: { imagePixelsEach: 20000000, imagePixelsAll: 20000000 } }))).ok);
    const two = svg(`<image href="${png(3000, 3000)}"/><image href="${png(3000, 3000)}"/>`);
    ok(mountOne(new Engine(experience({}, { drawing: two }))).ok);
    eq(faultOf(mountOne(new Engine(experience({}, { drawing: two, limits: { imagePixelsAll: 17999999 } })))), 'E-MOUNT-LIMIT');
  },
  'filterSurface: the filter regions over the player box area, measured on the mounted art (E-MOUNT-LIMIT in drawing.faults)'() {
    const f = '<defs><filter id="f"><feGaussianBlur stdDeviation="1"/></filter></defs>';
    const rects = (n) => Array.from({ length: n }, () => '<rect width="100" height="100" filter="url(#f)"/>').join('');
    eq(Math.round(filterSurface(parseXml(svg(f + rects(2)))).ratio * 100), 288); // 2 x 1.2 x 1.2
    eq(Math.round(filterSurface(parseXml(svg(f + `<g transform="scale(0.5)">${rects(1)}</g>`))).ratio * 100), 36);
    const mounted = (n) => { const e = new Engine(experience({}, { drawing: svg(f + rects(n)) })); ok(mountOne(e).ok); const d = new Drawing(e); d.mountScene('one', 'main'); return d; };
    eq(mounted(2).faults, []);
    eq(mounted(3).faults.map(x => x.code), ['E-MOUNT-LIMIT']); // 4.32 > 4
  },
  'liveTimers: one machine timer or timed link more than the limit faults in compute (E-EVENT-LOOP)'() {
    const after = (n) => Array.from({ length: n }, (_, i) => ({ id: `t${i}`, delayMs: 1000 + i, target: 'b' }));
    const scene = (n) => ({ machines: { m: { initial: 'a', states: { a: { after: after(n) }, b: {} } } } });
    ok(mountOne(new Engine(experience(scene(3), { limits: { liveTimers: 3 } }))).ok);
    eq(faultOf(mountOne(new Engine(experience(scene(4), { limits: { liveTimers: 3 } })))), 'E-EVENT-LOOP');
  },
  'deliveriesPerTransaction: more deliveries than the limit in one transaction fault (E-EVENT-LOOP)'() {
    // lines.say delivers once per line (6.11); each line is declared, so only the limit faults.
    const lines = { one: { text: 'One.', durationMs: 100 }, two: { text: 'Two.', durationMs: 100 }, three: { text: 'Three.', durationMs: 100 } };
    const say = (id, line) => ({ id, call: 'lines.say', with: { line } });
    const scene = { addons: { lines: { lines } }, on: { 'press:x': [{ id: 'p', actions: [say('a', "'one'"), say('b', "'two'"), say('c', "'three'")] }] } };
    const e = new Engine(experience(scene, { limits: { deliveriesPerTransaction: 2 }, exp: { needs: ['lines'] } }));
    ok(mountOne(e).ok);
    eq(faultOf(e.send('one', 'press:x')), 'E-EVENT-LOOP');
    const f = new Engine(experience(scene, { limits: { deliveriesPerTransaction: 3 }, exp: { needs: ['lines'] } }));
    ok(mountOne(f).ok); ok(f.send('one', 'press:x').ok);
  },
  'deadlinesPerMs: more deadlines due at one engine millisecond than the limit fault (E-EVENT-LOOP)'() {
    const scene = { values: { n: { type: 'number', initial: 0, minimum: 0, maximum: 9 } }, machines: Object.fromEntries(['m1', 'm2', 'm3'].map(m => [m, { initial: 'a', states: { a: { after: [{ id: 'go', delayMs: 100, target: 'b' }] }, b: { entry: [{ id: 'add', set: 'n', to: 'n + 1' }] } } }])) };
    const e = new Engine(experience(scene, { limits: { deadlinesPerMs: 2 } }));
    ok(mountOne(e).ok);
    const rs = e.advance(200);
    eq(rs.map(faultOf), [null, null, 'E-EVENT-LOOP']);
    eq(e.read('one', 'n'), 2);
  },
  'markerCrossingsPerMs: more crossings of one clip at one engine millisecond fault; step size never matters (6.7)'() {
    const clip = (times) => ({ entry: [{ id: 'p', play: 'c' }], clips: { c: { durationMs: 100, tracks: [{ id: 't', target: 'x', channel: 'opacity', keys: [[0, 1], [100, 0]] }], markers: times.map((at, i) => ({ id: `k${i}`, atMs: at, event: `m${i}` })) } } });
    const same = new Engine(experience(clip([10, 10, 10]), { limits: { markerCrossingsPerMs: 2 } }));
    ok(mountOne(same).ok);
    eq(same.advance(50).map(faultOf), [null, null, 'E-EVENT-LOOP']);
    const spread = new Engine(experience(clip([10, 20, 30]), { limits: { markerCrossingsPerMs: 2 } }));
    ok(mountOne(spread).ok);
    eq(spread.advance(50).map(faultOf), [null, null, null], 'three markers at three times in one big step');
  },
  'formulaResultUnits: a formula result larger than the limit faults (E-RANGE, 5.6.6)'() {
    const scene = { values: { s: { type: 'string', initial: '' } }, on: { 'press:x': [{ id: 'p', actions: [{ id: 'a', set: 's', to: "'abcdefghijkl'" }] }], 'press:y': [{ id: 'p', actions: [{ id: 'a', set: 's', to: "'abc'" }] }] } };
    const e = new Engine(experience(scene, { limits: { formulaResultUnits: 10 } }));
    ok(mountOne(e).ok);
    eq(faultOf(e.send('one', 'press:x')), 'E-RANGE');
    ok(e.stopped, 'a control fault stops play'); e.stopped = null; // the next case on the same engine (X3)
    ok(e.send('one', 'press:y').ok);
  },
};

// Stored data (9.8, 5.1.2): in compute before commit, and when restored.
const memStore = (init = {}) => { const m = new Map(Object.entries(init)); return { m, get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => m.set(k, v), remove: (k) => m.delete(k) }; };
const KEY = 'hsvg/2.0|/p|t|device|saved';
const stored = (store, { limits = {}, host = null, now = 1000 } = {}) => new Player(experience({
  values: { note: { type: 'string', initial: '', lifetime: 'saved' }, log: { type: 'string', initial: '' } },
  on: {
    'press:long': [{ id: 'p', actions: [{ id: 'a', set: 'note', to: `'${'x'.repeat(200)}'` }] }],
    'press:short': [{ id: 'p', actions: [{ id: 'a', set: 'note', to: "'hi'" }] }],
    'save:invalid': [{ id: 'i', actions: [{ id: 'i1', set: 'log', to: "log + 'invalid '" }] }],
  },
}, { limits, exp: { grants: { storage: ['saved'] } } }), { storage: { saved: store, session: memStore(), page: '/p', partition: 'device', now: () => now }, host });

Object.assign(tests, {
  'savedBytes: a transaction whose saved values would pass the limit faults before commit, and nothing is written (E-MOUNT-LIMIT)'() {
    const store = memStore();
    const p = stored(store, { limits: { savedBytes: 150 } });
    ok(p.start().ok);
    ok(p.send('one', 'press:short').ok);
    const before = store.m.get(KEY);
    const r = p.send('one', 'press:long');
    eq(faultOf(r), 'E-MOUNT-LIMIT');
    eq([p.read('one', 'note'), store.m.get(KEY)], ['hi', before]);
  },
  'sessionBytes: the same for session values'() {
    const session = memStore();
    const p = new Player(experience({ values: { note: { type: 'string', initial: '', lifetime: 'session' } }, on: { 'press:long': [{ id: 'p', actions: [{ id: 'a', set: 'note', to: `'${'x'.repeat(200)}'` }] }] } },
      { limits: { sessionBytes: 150 }, exp: { grants: { storage: ['session'] } } }), { storage: { session, page: '/p', partition: 'device', now: () => 1 } });
    ok(p.start().ok);
    eq(faultOf(p.send('one', 'press:long')), 'E-MOUNT-LIMIT');
  },
  'restored stored data over its limit is ignored with save:invalid, not a fault (5.1.2)'() {
    const rec = JSON.stringify({ stamp: '', writtenAt: 1, values: { 'one#note': 'y'.repeat(300) }, knobs: {}, graph: null });
    const p = stored(memStore({ [KEY]: rec }), { limits: { savedBytes: 200 } });
    ok(p.start().ok);
    eq([p.read('one', 'note'), p.read('one', 'log')], ['', 'invalid ']);
    const q = stored(memStore({ [KEY]: rec }));
    ok(q.start().ok);
    eq(q.read('one', 'note'), 'y'.repeat(300));
  },
});

// capabilityBundleBytes (10.11): each capability's runtime code, gzip level 9. There is no built bundle yet, so the
// test measures the source files of each capability together, which is an upper bound on what a bundle adds.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
const v2 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CAPABILITY_FILES = {
  physics: ['src/physics.mjs'], effects: ['src/effects.mjs'], fit: ['src/capabilities/fit.mjs', 'src/plan.mjs'],
  audio: ['src/mixer.mjs', 'web/audio-web.mjs'], snapshot: ['web/snapshot-web.mjs'],
};
tests['capabilityBundleBytes: each capability\'s runtime code is at most capabilityBundleBytes gzip level 9 (10.11); fit is its own files, not core text fitting'] = () => {
  for (const [cap, files] of Object.entries(CAPABILITY_FILES)) {
    const text = files.map(f => fs.readFileSync(path.join(v2, ...f.split('/')), 'utf8')).join('\n');
    const n = zlib.gzipSync(Buffer.from(text), { level: 9 }).length;
    ok(n <= FORMAT.capabilityBundleBytes, `${cap}: ${n} bytes gzip -9, over ${FORMAT.capabilityBundleBytes}`);
  }
};
