// Stored values (5.1.2) and the graph's memory (3.8), with in-memory stores in place of the browser's.
import path from 'node:path';
import { Player as BasePlayer } from '../src/story.mjs';
import { granting } from './helpers.mjs';
const Player = granting(BasePlayer); // a host that gives what the experience asks (D31: no profile, no grant)
import { loadExperience, folderSource } from '../src/load.mjs';
import { repo, schemas, eq, ok, throwsCode } from './helpers.mjs';

const memStore = () => { const m = new Map(); return { m, get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => m.set(k, v), remove: (k) => m.delete(k) }; };
const host = (saved, extra = {}) => ({ saved, session: memStore(), page: '/game/', partition: 'device', now: () => 1000, ...extra });
const scene = (id, extra = {}) => ({ file: `${id}.json`, doc: { format: 'hsvg/2.0', kind: 'scene', id, drawing: `${id}.svg`, ...extra }, words: {} });
const make = (store, { grants = { storage: ['saved'] }, expExtra = {}, a = {}, blocks = {}, h = {} } = {}) => new Player({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', grants,
    values: { stars: { type: 'number', initial: 0, minimum: 0, maximum: 9, lifetime: 'saved' }, log: { type: 'string', initial: '' } },
    story: { start: 'a', scenes: { a: 'a.json', b: 'b.json', end: 'end.json' }, ends: ['end'], resumeAt: ['b'], lifetime: 'saved',
      links: [{ id: 'a-b', from: 'a', on: 'go', to: 'b' }, { id: 'b-end', from: 'b', on: 'go', to: 'end' }] }, ...expExtra },
  words: { en: {} }, data: {}, blocks,
  scenes: {
    a: scene('a', { outputs: { go: { kind: 'event' } }, values: { taps: { type: 'number', initial: 0, minimum: 0, maximum: 99, lifetime: 'saved' }, here: { type: 'number', initial: 0 } },
      on: { tap: [{ id: 't', actions: [{ id: 't1', set: 'taps', to: 'taps + 1' }, { id: 't2', set: 'here', to: 'here + 1' }] }],
        star: [{ id: 's', actions: [{ id: 's1', set: 'stars', to: 'stars + 1' }] }],
        bad: [{ id: 'x', actions: [{ id: 'x1', set: 'stars', to: 'stars + 1' }, { id: 'x2', set: 'nope', to: 1 }] }],
        reset: [{ id: 'r', actions: [{ id: 'r1', call: 'player.resetSaved' }] }],
        'save:unavailable': [{ id: 'u', actions: [{ id: 'u1', set: 'log', to: "log + 'unavailable '" }] }],
        'save:invalid': [{ id: 'i', actions: [{ id: 'i1', set: 'log', to: "log + 'invalid '" }] }],
        go: [{ id: 'g', actions: [{ id: 'g1', emit: 'go' }] }] }, ...a }),
    b: scene('b', { outputs: { go: { kind: 'event' } }, on: { go: [{ id: 'g', actions: [{ id: 'g1', emit: 'go' }] }] } }),
    end: scene('end'),
  },
}, { storage: host(store, h) });

export const tests = {
  'saved values come back in the next run, keyed by page, experience, partition and owner'() {
    const store = memStore();
    const p = make(store); ok(p.start().ok);
    p.send('a', 'tap'); p.send('a', 'tap'); p.send('a', 'star');
    const q = make(store); ok(q.start().ok);
    eq([q.read('a', 'taps'), q.read('a', 'here'), q.read('a', 'stars')], [2, 0, 1], 'saved values back, a moment value not');
    eq([...store.m.keys()], ['hsvg/2.0|/game|x|device|saved']);
    const rec = JSON.parse(store.m.get('hsvg/2.0|/game|x|device|saved'));
    eq([rec.stamp, rec.writtenAt, rec.values['a#taps'], rec.values['experience#stars']], ['', 1000, 2, 1]);
  },
  'a step that rolls back writes nothing'() {
    const store = memStore();
    const p = make(store); p.start(); p.send('a', 'star');
    const before = store.m.get('hsvg/2.0|/game|x|device|saved');
    eq(p.send('a', 'bad').ok, false);
    eq(store.m.get('hsvg/2.0|/game|x|device|saved'), before);
  },
  'without the storage grant, saved values last for the run and save:unavailable fires once'() {
    const store = memStore();
    const p = make(store, { grants: {} }); ok(p.start().ok);
    p.send('a', 'tap');
    eq(p.read('a', 'log'), 'unavailable ');
    eq(store.m.size, 0);
    eq(make(store, { grants: {} }).read('experience', 'stars'), 0);
  },
  'stored data of the wrong type or out of bounds takes the initial; save:invalid fires'() {
    const store = memStore();
    store.set('hsvg/2.0|/game|x|device|saved', JSON.stringify({ stamp: '', values: { 'experience#stars': 42, 'a#taps': 'many' }, knobs: {}, graph: null }));
    const p = make(store); ok(p.start().ok);
    eq([p.read('a', 'stars'), p.read('a', 'taps'), p.read('a', 'log')], [0, 0, 'invalid ']);
  },
  'another saveStamp drops the stored data whole'() {
    const store = memStore();
    const p = make(store); p.start(); p.send('a', 'star'); p.send('a', 'go');
    const q = make(store, { expExtra: { saveStamp: 'v2' } }); ok(q.start().ok);
    eq([q.scene, q.read('a', 'stars'), q.read('a', 'log')], ['a', 0, 'invalid ']);
  },
  'partitions keep apart; a partition id outside the grammar is E-RANGE'() {
    const store = memStore();
    const p = make(store, { h: { partition: 'learner-1' } }); p.start(); p.send('a', 'star');
    eq(make(store, { h: { partition: 'learner-2' } }).read('experience', 'stars'), 0);
    eq(make(store, { h: { partition: 'learner-1' } }).read('experience', 'stars'), 1);
    throwsCode(() => make(store, { h: { partition: 'no spaces' } }), 'E-RANGE');
  },
  'the graph remembers the resume scene; an ending clears it (3.8)'() {
    const store = memStore();
    const p = make(store); p.start(); p.send('a', 'go');
    eq(p.scene, 'b');
    const q = make(store); q.start();
    eq([q.scene, q.state.story.visits.b], ['b', 2], 'resumed at b: one remembered visit plus this entry');
    q.send('b', 'go'); eq(q.scene, 'end');
    const r = make(store); r.start();
    eq(r.scene, 'a', 'after the ending, start again');
  },
  'resetSaved clears stored values and the graph memory; the next run starts fresh'() {
    const store = memStore();
    const p = make(store); p.start(); p.send('a', 'tap'); p.send('a', 'star');
    ok(p.send('a', 'reset').ok);
    eq([p.read('a', 'taps'), p.read('a', 'stars')], [0, 0]);
    const q = make(store); q.start();
    eq([q.read('a', 'taps'), q.read('a', 'stars')], [0, 0]);
  },
  'saved knobs come back; clearStorage removes the record'() {
    const store = memStore();
    const knob = { inputs: { musicVolume: { kind: 'knob', type: 'number', minimum: 0, maximum: 1, initial: 0.5, lifetime: 'saved' } },
      settings: { items: [{ id: 'music', knob: 'musicVolume', label: 'Music' }] } };
    const p = make(store, { expExtra: knob }); p.start();
    ok(p.transaction('person', () => p.action('a', { id: 'k', call: 'player.setting', with: {musicVolume: 0.2} }, 'test')).ok);
    eq(make(store, { expExtra: knob }).state.blocks.experience.inputs.musicVolume, 0.2);
    p.clearStorage();
    eq(store.m.size, 0);
  },
};
