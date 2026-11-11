// Input on the engine side (5.11, 5.12): held and picked values, key events, slider values. The browser side
// (roles, focus, pointer and keyboard paths) is checked by tests/browser/input-browser.mjs.
import { Player } from '../src/story.mjs';
import { eq, ok } from './helpers.mjs';

const make = (scene = {}, exp = {}) => new Player({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', story: { start: 'a', scenes: { a: 'a.json' } }, ...exp },
  words: { en: {} }, data: {}, blocks: {},
  scenes: { a: { file: 'a.json', doc: { format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg', ...scene }, drawings: {}, words: {} } },
});
const base = {
  values: {
    holding: { type: 'boolean', initial: false }, carried: { type: 'boolean', initial: false },
    speed: { type: 'number', initial: 0, minimum: 0, maximum: 240 }, log: { type: 'string', initial: '' }, open: { type: 'boolean', initial: true },
  },
  controls: {
    horn: { kind: 'button', target: 'horn', held: 'holding', enabled: 'open' },
    parcel: { kind: 'drag', target: 'parcel', drops: ['basket'], picked: 'carried', event: 'dropped', missEvent: 'missed' },
    gas: { kind: 'slider', target: 'knob', value: 'speed', axis: 'x', range: [0, 100], positions: 5 },
    fine: { kind: 'slider', target: 'knob2', value: 'speed', axis: 'x', range: [0, 100] },
  },
  on: {
    'key:KeyA': [{ id: 'ka', actions: [{ id: 'ka1', set: 'log', to: "log + 'A '" }] }],
    'keyUp:KeyA': [{ id: 'kua', actions: [{ id: 'kua1', set: 'log', to: "log + 'a '" }] }],
    dropped: [{ id: 'd', actions: [{ id: 'd1', set: 'log', to: "log + 'dropped:' + event.drop + ' '" }] }],
    missed: [{ id: 'm', actions: [{ id: 'm1', set: 'log', to: "log + 'missed '" }] }],
  },
};

export const tests = {
  'held is true while a press is held; a disabled press is not held'() {
    const p = make(base); ok(p.start().ok);
    ok(p.hold('a', 'horn', true).ok); eq(p.read('a', 'holding'), true);
    ok(p.hold('a', 'horn', false).ok); eq(p.read('a', 'holding'), false);
    p.state.blocks.a.values.open = false;
    eq(p.hold('a', 'horn', true), { ok: true, ignored: 'disabled' });
  },
  'picked is true while a drag item is held; a drop or a miss queues its event'() {
    const p = make(base); ok(p.start().ok);
    p.hold('a', 'parcel', true); eq(p.read('a', 'carried'), true);
    p.hold('a', 'parcel', false); p.activate('a', 'parcel', 'basket');
    p.hold('a', 'parcel', true); p.hold('a', 'parcel', false); p.activate('a', 'parcel', '');
    eq([p.read('a', 'carried'), p.read('a', 'log')], [false, 'dropped:basket missed ']);
  },
  'keys of the fixed set reach the blocks as key: and keyUp:; other keys do nothing'() {
    const p = make(base); ok(p.start().ok);
    ok(p.key('KeyA').ok); ok(p.key('KeyA', true).ok);
    eq(p.key('Tab'), { ok: true, ignored: 'not a key of the set' });
    eq(p.key('Escape'), { ok: true, ignored: 'not a key of the set' });
    eq(p.read('a', 'log'), 'A a ');
  },
  'a slider maps its travel onto the value bounds, snapping to positions'() {
    const p = make(base); ok(p.start().ok);
    eq([0, 0.1, 0.13, 0.5, 0.9, 1, 1.4, -2].map(t => p.sliderValueAt('a', 'gas', t)), [0, 0, 60, 120, 240, 240, 240, 0]);
    eq(p.sliderValueAt('a', 'fine', 0.25), 60);
    eq([p.sliderStep('a', 'gas'), p.sliderStep('a', 'fine')], [60, 24], 'a position, or a tenth of the range');
    eq([p.sliderPage('a', 'gas'), p.sliderPage('a', 'fine')], [60, 24], 'Page Up and Down: a tenth of the range, at least one position (E1 item 4)');
    ok(p.activate('a', 'gas', p.sliderValueAt('a', 'gas', 0.5)).ok);
    eq(p.controlValue('a', 'gas'), 120);
    eq(p.controlValueDecl('a', 'gas').maximum, 240);
  },
  'a slider on a knob writes the person\'s setting'() {
    const p = make({ controls: { vol: { kind: 'slider', target: 'v', value: 'musicVolume', axis: 'x', range: [0, 10] } } },
      { inputs: { musicVolume: { kind: 'knob', type: 'number', minimum: 0, maximum: 1, step: 0.1, initial: 0.5 } }, settings: { items: [{ id: 'm', knob: 'musicVolume', label: 'Music' }] } });
    ok(p.start().ok);
    eq(p.sliderValueAt('p', 'vol', 0.33), null, 'an unknown address has no control');
    eq(p.sliderValueAt('a', 'vol', 0.33), 0.3, 'snapped to the knob step');
    ok(p.activate('a', 'vol', 0.3).ok);
    eq(p.controlValue('a', 'vol'), 0.3);
  },
};
