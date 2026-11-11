// Stage 2: values, reactions, machines, actions, uses and transactions, on small experiences built from the spec's
// own examples (5.1, 5.13, 5.14, 5.15, 4.3, 9.2).
import { Engine } from '../src/runtime.mjs';
import { eq, ok } from './helpers.mjs';

const experience = (scene, extra = {}) => ({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', values: { best: { type: 'number', initial: 0, minimum: 0, maximum: 3, lifetime: 'saved' } }, story: { start: 'one', scenes: { one: 'one.json' } }, ...extra.exp },
  words: { en: { onward: 'Onward', hello: 'Hi {{ score }}' } },
  data: { topics: [{ id: 'a', n: 1 }] },
  scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'x.svg', ...scene }, words: {} } },
  blocks: extra.blocks || {},
});
const start = (scene, extra) => { const e = new Engine(experience(scene, extra)); const r = e.transaction('host', () => e.mount('one', 'scene', 'one')); ok(r.ok, r.fault?.message); return e; };

export const tests = {
  'values, set, add, toggle and changed events'() {
    const e = start({
      values: { score: { type: 'number', initial: 0, minimum: 0, maximum: 3 }, on: { type: 'boolean', initial: false }, log: { type: 'number', initial: 0, minimum: 0, maximum: 99 } },
      on: {
        'press:point': [{ id: 'p', actions: [{ id: 'a', set: 'score', to: 'score + 1' }, { id: 't', set: 'on', to: '!on' }] }],
        'changed:score': [{ id: 'c', actions: [{ id: 'l', set: 'log', to: 'log + 1' }] }],
      },
    });
    ok(e.send('one', 'press:point').ok);
    eq([e.read('one', 'score'), e.read('one', 'on'), e.read('one', 'log')], [1, true, 1]);
  },
  'a refused write rolls the whole transaction back (9.2)'() {
    const e = start({
      values: { score: { type: 'number', initial: 2, minimum: 0, maximum: 3 }, other: { type: 'number', initial: 0, minimum: 0, maximum: 9 } },
      on: { 'press:x': [{ id: 'p', actions: [{ id: 'o', set: 'other', to: 5 }, { id: 'a', set: 'score', to: 'score + 5' }] }] },
    });
    const r = e.send('one', 'press:x');
    ok(!r.ok); eq(r.fault.code, 'E-RANGE');
    eq([e.read('one', 'score'), e.read('one', 'other')], [2, 0]);
  },
  'only the first reaction whose guard passes runs (5.13)'() {
    const e = start({
      values: { picked: { type: 'string', maxLength: 5, initial: 'a' }, score: { type: 'number', initial: 0, minimum: 0, maximum: 9 } },
      on: { answered: [
        { id: 'right', guard: "picked === 'a'", actions: [{ id: 'up', set: 'score', to: 'score + 1' }] },
        { id: 'always', actions: [{ id: 'up2', set: 'score', to: 'score + 5' }] }] },
    });
    e.send('one', 'answered');
    eq(e.read('one', 'score'), 1);
  },
  'scenes read and write the experience values (5.1.3)'() {
    const e = start({ on: { 'press:x': [{ id: 'p', actions: [{ id: 's', set: 'best', to: 'best + 2' }] }] } });
    e.send('one', 'press:x');
    eq(e.state.blocks.experience.values.best, 2);
    eq(e.read('one', 'best'), 2);
  },
  'the traffic light machine of 5.14: timers, guards, entry and transitions'() {
    const e = start({
      values: { carCount: { type: 'number', initial: 0, minimum: 0, maximum: 9 }, redMs: { type: 'number', initial: 5000, minimum: 1, maximum: 99999 }, crossed: { type: 'number', initial: 0, minimum: 0, maximum: 9 } },
      clips: { 'walk-across': { durationMs: 2000, tracks: [{ id: 't', target: 'p', channel: 'opacity', keys: [[0, 1], [2000, 0]] }] } },
      outputs: { crossedSafely: { kind: 'event' } },
      on: { crossedSafely: [{ id: 'count', actions: [{ id: 'c', set: 'crossed', to: 'crossed + 1' }] }] },
      machines: { light: { initial: 'red', states: {
        red: { after: [{ id: 'turn-green', delayMs: 'redMs', target: 'green' }] },
        green: { on: { 'press:cross': [{ id: 'start-crossing', guard: 'carCount === 0', target: 'crossing' }] }, after: [{ id: 'turn-red', delayMs: 4000, target: 'red' }] },
        crossing: { entry: [{ id: 'walk', play: 'walk-across' }], on: { 'ended:walk-across': [{ id: 'safe', target: 'red', actions: [{ id: 'report', emit: 'crossedSafely' }] }] } },
      } } },
    });
    ok(e.read('one', 'carCount') === 0 && e.isActive('one', 'red'));
    e.advance(4999); ok(e.isActive('one', 'red'), 'still red');
    e.advance(1); ok(e.isActive('one', 'green'), 'green after redMs');
    e.send('one', 'press:cross'); ok(e.isActive('one', 'crossing'));
    e.advance(1999); ok(e.isActive('one', 'crossing'), 'still crossing');
    e.advance(1); ok(e.isActive('one', 'red'), 'red when the walk clip ends');
    eq(e.read('one', 'crossed'), 1);
    e.advance(4999); ok(e.isActive('one', 'red'), 'the old green timer was cancelled on exit');
  },
  'active() and computed values'() {
    const e = start({ computed: { phase: "active('b') ? 'B' : 'A'" }, machines: { m: { initial: 'a', states: { a: { on: { go: [{ id: 'g', target: 'b' }] } }, b: {} } } } });
    eq(e.read('one', 'phase'), 'A');
    e.send('one', 'go');
    eq(e.read('one', 'phase'), 'B');
  },
  'self transition exits and enters again (5.14)'() {
    const e = start({
      values: { n: { type: 'number', initial: 0, minimum: 0, maximum: 9 } },
      machines: { m: { initial: 'a', states: { a: { entry: [{ id: 'up', set: 'n', to: 'n + 1' }], on: { again: [{ id: 'g', target: 'a' }] } } } } },
    });
    eq(e.read('one', 'n'), 1);
    e.send('one', 'again');
    eq(e.read('one', 'n'), 2);
  },
  'uses: inputs from with, outputs read by the parent, output events forwarded (4.3, 5.4, 5.12)'() {
    const button = { doc: { format: 'hsvg/2.0', kind: 'component', id: 'cta', drawing: 'cta.svg',
      inputs: { label: { kind: 'content', type: 'string', maxLength: 18, initial: 'Order' } },
      values: { presses: { type: 'number', initial: 0, minimum: 0, maximum: 9 } },
      outputs: { pressed: { kind: 'event' }, count: { kind: 'result', type: 'number', minimum: 0, maximum: 9, value: 'presses' } },
      on: { 'press:surface': [{ id: 'p', actions: [{ id: 'a', set: 'presses', to: 'presses + 1' }, { id: 'e', emit: 'pressed' }] }] } }, words: {} };
    const e = start({
      values: { label: { type: 'string', maxLength: 18, initial: 'Buy' }, got: { type: 'number', initial: 0, minimum: 0, maximum: 9 } },
      uses: [{ id: 'buy', use: 'cta', into: 'cta-slot', with: { label: 'label' } }],
      on: { 'buy.pressed': [{ id: 'h', actions: [{ id: 's', set: 'got', to: "uses['buy'].count" }] }], 'press:rename': [{ id: 'r', actions: [{ id: 's2', set: 'label', to: "'Sold'" }] }] },
    }, { blocks: { cta: button } });
    eq(e.state.blocks['one/buy'].inputs.label, 'Buy');
    e.send('one/buy', 'press:surface');
    eq(e.read('one', 'got'), 1);
    e.send('one', 'press:rename');
    eq(e.state.blocks['one/buy'].inputs.label, 'Sold');
  },
  'words with templates, and the event payload'() {
    const e = start({ values: { score: { type: 'number', initial: 2, minimum: 0, maximum: 9 }, said: { type: 'string', maxLength: 40, initial: '' } },
      on: { pick: [{ id: 'p', actions: [{ id: 's', set: 'said', to: "words.hello + ' ' + event.choice" }] }] } });
    e.send('one', 'pick', { choice: 'b' });
    eq(e.read('one', 'said'), 'Hi 2 b');
  },
  'setting and openUrl are human-only (5.15.4)'() {
    const e = start({ on: { go: [{ id: 'g', actions: [{ id: 's', call: 'player.setting', with: {muted: true} }] }] } });
    const r = e.send('one', 'go', {}, 'timer');
    ok(!r.ok); eq(r.fault.code, 'E-HUMAN-ONLY');
    ok(e.stopped, 'a timer fault stops play'); e.stopped = null; // the next case on the same engine (X3)
    ok(e.send('one', 'go', {}, 'person').ok);
    eq(e.state.ambient.muted, true);
  },
  'the 4096-step budget is per evaluation, not per transaction (5.6.6)'() {
    const e = start({ values: { n: { type: 'number', initial: 0, minimum: 0, maximum: 9999 } },
      on: { go: [{ id: 'g', actions: Array.from({ length: 60 }, (_, i) => ({ id: `a${i}`, set: 'n', to: 'sum([' + Array(30).fill('1').join(',') + '], item) + ' + i })) }] } });
    ok(e.send('one', 'go').ok);
  },
  'controls: enabled, press events, options write before their event, drags accept or miss (5.11)'() {
    const e = start({
      values: { picked: { type: 'string', maxLength: 5, initial: '' }, got: { type: 'string', maxLength: 9, initial: '' }, ready: { type: 'boolean', initial: false } },
      controls: {
        go: { kind: 'button', target: 'go', enabled: 'ready' },
        answer: { kind: 'choice', value: 'picked', event: 'answered', options: { a: { target: 'answer-a', value: "'a'" }, b: { target: 'answer-b', value: "'b'", enabled: 'false' } } },
        parcel: { kind: 'drag', target: 'parcel', drops: ['basket'], accept: "event.drop === 'basket'", event: 'dropped', missEvent: 'missed' },
      },
      on: { answered: [{ id: 'r', actions: [{ id: 's', set: 'got', to: 'picked' }] }], dropped: [{ id: 'd', actions: [{ id: 's2', set: 'got', to: "'in'" }] }],
        missed: [{ id: 'm', actions: [{ id: 's3', set: 'got', to: "'home'" }] }], 'press:go': [{ id: 'g', actions: [{ id: 's4', set: 'got', to: "'went'" }] }] },
    });
    eq(e.activate('one', 'go').ignored, 'disabled'); eq(e.read('one', 'got'), '');
    ok(e.activate('one', 'answer', 'a').ok); eq(e.read('one', 'got'), 'a');
    eq(e.activate('one', 'answer', 'b').ignored, 'disabled', 'a disabled option');
    e.activate('one', 'parcel', ''); eq(e.read('one', 'got'), 'home');
    e.activate('one', 'parcel', 'basket'); eq(e.read('one', 'got'), 'in');
  },
  'more than 100 events is E-EVENT-LOOP'() {
    const e = start({ on: { ping: [{ id: 'p', actions: [{ id: 'e', emit: 'ping' }] }] } });
    const r = e.send('one', 'ping');
    ok(!r.ok); eq(r.fault.code, 'E-EVENT-LOOP');
  },
};
