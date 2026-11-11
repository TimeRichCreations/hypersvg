// The host API (10.6): face-only access, checked writes, listeners, waiting calls, restart and partitions.
import { Player as BasePlayer } from '../src/story.mjs';
import { granting } from './helpers.mjs';
const Player = granting(BasePlayer); // a host that gives what the experience asks (D31: no profile, no grant)
import { hostApi } from '../src/host.mjs';
import { eq, ok } from './helpers.mjs';

const mem = () => { const m = new Map(); return { m, get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => m.set(k, v), remove: (k) => m.delete(k) }; };
const exp = () => ({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', grants: { storage: ['saved'] },
    inputs: {
      visitorName: { kind: 'content', type: 'string', maxLength: 20, initial: 'friend' },
      note: { kind: 'content', type: 'string', contentType: 'freeText', maxLength: 500, initial: '' },
      musicVolume: { kind: 'knob', type: 'number', minimum: 0, maximum: 1, initial: 0.5 },
      start: { kind: 'trigger' },
    },
    values: { secret: { type: 'number', initial: 7 }, best: { type: 'number', initial: 0, minimum: 0, maximum: 99, lifetime: 'saved' } },
    outputs: {
      bestScore: { kind: 'result', type: 'number', minimum: 0, maximum: 99, value: 'best' },
      won: { kind: 'event' },
      answers: { kind: 'record', maxRows: 10, row: { type: 'object', properties: { q: { type: 'number' } }, required: ['q'] } },
    },
    on: { start: [{ id: 's', actions: [{ id: 's1', set: 'best', to: 'best + 1' }, { id: 's2', emit: 'won' }, { id: 's3', emit: 'answers', as: 'record', with: { q: 'best' } }] }] },
    story: { start: 'a', scenes: { a: 'a.json' } } },
  words: { en: {} }, data: {}, blocks: {},
  scenes: { a: { file: 'a.json', doc: { format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg' }, drawings: {}, words: {} } },
});
const make = (opts = {}, storage = null) => { const p = new Player(exp(), storage ? { storage } : {}); p.start(); return { p, h: hostApi(p, opts) }; };
const code = (fn) => { try { fn(); } catch (e) { return e.code; } return 'none'; };
const tick = () => new Promise(r => setTimeout(r, 0));

export const tests = {
  'read gives inputs and output results; body values and free text are private'() {
    const { h } = make();
    eq([h.read('visitorName'), h.read('musicVolume'), h.read('bestScore')], ['friend', 0.5, 0]);
    eq([code(() => h.read('secret')), code(() => h.read('note')), code(() => h.read('nothing'))], ['E-HOST-PRIVATE', 'E-HOST-PRIVATE', 'E-REF-UNKNOWN']);
  },
  'set writes a declared input, checked and never clamped; a refused set changes nothing'() {
    const { h, p } = make();
    h.set('visitorName', 'Robin'); h.set('musicVolume', 0.2);
    eq([h.read('visitorName'), h.read('musicVolume')], ['Robin', 0.2]);
    eq([code(() => h.set('musicVolume', 2)), code(() => h.set('visitorName', 5)), code(() => h.set('secret', 1)), code(() => h.set('start', true))], ['E-RANGE', 'E-TYPE', 'E-REF-UNKNOWN', 'E-TYPE']);
    eq(h.read('musicVolume'), 0.2);
    eq(p.state.blocks.experience.values.secret, 7);
  },
  'emit fires a trigger; on hears output events and record rows, frozen'() {
    const { h } = make();
    const heard = [];
    h.on('won', (e) => heard.push(e.name));
    h.on('answers', (e) => { heard.push(e.detail.row.q, e.detail.filler); ok(Object.isFrozen(e.detail)); });
    h.on('entered', (e) => heard.push(e.detail.scene));
    h.emit('start');
    // The record row is written while its action runs; the emitted event leaves after the reaction (5.12).
    eq(heard, [1, 'program', 'won']);
    eq(h.read('bestScore'), 1);
    eq([code(() => h.on('secret', () => {})), code(() => h.emit('visitorName')), code(() => h.emit('start', { x: 1 }))], ['E-REF-UNKNOWN', 'E-REF-UNKNOWN', 'E-TYPE']);
  },
  async 'a change made while listeners run waits for the step to end; a throwing listener goes to onError'() {
    const errors = [];
    const { h } = make({ onError: (e) => errors.push(e.source) });
    h.on('won', () => { h.set('visitorName', 'Later'); eq(h.read('visitorName'), 'friend', 'not yet'); });
    h.on('won', () => { throw new Error('boom'); });
    h.emit('start');
    await tick();
    eq([h.read('visitorName'), errors], ['Later', ['listener']]);
  },
  'restart starts a new run; clearStorage and setPartition restart with other stored values'() {
    const saved = mem();
    const { h, p } = make({}, { saved, session: mem(), partition: 'device' });
    h.emit('start'); h.emit('start');
    eq(h.read('bestScore'), 2);
    h.restart();
    eq([h.read('bestScore'), p.scene], [2, 'a'], 'saved values come back after a restart');
    h.setPartition('learner-1');
    eq(h.read('bestScore'), 0, 'another partition starts fresh');
    h.emit('start');
    h.setPartition('device'); eq(h.read('bestScore'), 2);
    h.clearStorage(); eq(h.read('bestScore'), 0);
    eq(code(() => h.setPartition('no spaces')), 'E-RANGE');
  },
  'pause reasons, the scene, seats not yet, and destroy'() {
    const { h } = make({ test: true });
    h.pause('host'); h.pause('ad'); h.resume('host');
    eq([h.paused, h.scene(), code(() => h.seat('white', 'human')), typeof h.internal.state], [true, 'a', 'E-NEEDS-MISSING', 'object']);
    h.resume('ad'); eq(h.paused, false);
    h.destroy();
    eq(code(() => h.read('visitorName')), 'E-HOST-CLOSED', 'calls after destroy are refused');
    eq(make().h.internal, undefined, 'internal only in test mode');
  },
};
