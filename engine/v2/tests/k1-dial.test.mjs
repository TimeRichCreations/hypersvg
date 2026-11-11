// Rotary input as a slider axis ("axis": "angle"), and small control keys.
// k1-fixture: a knob component (a slider with axis angle, range [-135, 135], 11 positions), used twice with different
// `with`. The browser half is tests/browser/k1-dial-browser.mjs.
import path from 'node:path';
import { loadExperience, folderSource } from '../src/load.mjs';
import { Player } from '../src/story.mjs';
import { Drawing, parseTransform } from '../src/drawing.mjs';
import { checkExperience } from '../check/index.mjs';
import { repo, schemas, eq, ok } from './helpers.mjs';

const FIXTURE = path.join(repo, 'engine', 'v2', 'tests', 'k1-fixture');
const near = (a, b, msg) => ok(Math.abs(a - b) < 1e-6, `${msg}: expected ${b}, got ${a}`);
// The fixture's files as a map, changed by edit(files) before checking.
async function files() {
  const src = await folderSource(FIXTURE);
  const rels = ['experience.json', 'components/knob/component.json', 'components/knob/knob.svg', 'components/level/component.json', 'components/level/level.svg', 'scenes/s/scene.json', 'scenes/s/s.svg'];
  return Object.fromEntries(rels.map(r => [r, src.read(r)]));
}
const source = (f) => ({ read: (rel) => (rel in f ? (typeof f[rel] === 'string' ? f[rel] : JSON.stringify(f[rel])) : null) });
async function findings(edit = () => {}) {
  const f = await files();
  f['components/knob/component.json'] = JSON.parse(f['components/knob/component.json']);
  edit(f, f['components/knob/component.json']);
  return checkExperience(source(f), schemas()).diags.map(d => `${d.code} ${d.path}`);
}
// A player with its drawing, painted after each step.
export async function playKnobs(edit) {
  const f = await files();
  if (edit) { f['components/knob/component.json'] = JSON.parse(f['components/knob/component.json']); edit(f, f['components/knob/component.json']); }
  const l = loadExperience(source(f), schemas());
  ok(l.experience, l.diags?.map(d => d.message).join('; '));
  const p = new Player(l.experience, {});
  p.state.ambient.reducedMotion = true;
  ok(p.start().ok, 'starts');
  const d = new Drawing(p);
  d.mountScene('s', 'main');
  d.paint();
  return { p, d, node: (use, id) => d.frames[`s/${use}`].byLocal.get(id) };
}
// The turn a transform gives, in degrees, and where it puts a point.
const turnOf = (t) => { const m = parseTransform(t); return Math.atan2(m[1], m[0]) * 180 / Math.PI; };
const place = (t, [x, y]) => { const m = parseTransform(t); return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; };

export const tests = {
  'item 1: the fixture checks with 0 findings'() {
    return findings().then(f => eq(f, [], 'findings'));
  },
  'item 1: an angle slider in a component used twice: each use keeps its own value and turn'() {
    return playKnobs().then(({ p, d, node }) => {
      eq([p.read('s/oven', 'share'), p.read('s/fan', 'share')], [0, 0.5], 'starts from `with`');
      near(turnOf(node('oven', 'knob').attrs.transform), -135, 'oven drawn turn');
      ok(!node('fan', 'knob').attrs.transform || Math.abs(turnOf(node('fan', 'knob').attrs.transform)) < 1e-6, 'fan at its drawn angle');
      ok(p.activate('s/oven', 'turn', 0.3).ok, 'activates'); d.paint();
      eq([p.read('s/oven', 'share'), p.read('s/fan', 'share'), p.read('s', 'heard')], [0.3, 0.5, 1], 'one use changed, its event heard');
      near(turnOf(node('oven', 'knob').attrs.transform), -135 + 0.3 * 270, 'the binding turns it');
      eq(p.controlValueDecl('s/fan', 'turn').maximum, 1, 'value bounds');
    });
  },
  'item 1: the travel maps onto the value; keys move one stop; Home and End are the ends'() {
    return playKnobs().then(({ p }) => {
      eq(p.sliderValueAt('s/oven', 'turn', 0.53), 0.5, 'nearest of 11 stops');
      near(p.sliderStep('s/oven', 'turn'), 0.1, 'one stop');
      // As the page's keys do: one stop up, then Home and End.
      const v = p.sliderValueAt('s/fan', 'turn', p.controlValue('s/fan', 'turn') + p.sliderStep('s/fan', 'turn'));
      p.activate('s/fan', 'turn', v);
      near(p.read('s/fan', 'share'), 0.6, 'ArrowRight');
      p.activate('s/fan', 'turn', p.controlValueDecl('s/fan', 'turn').minimum); eq(p.read('s/fan', 'share'), 0, 'Home');
      p.activate('s/fan', 'turn', p.controlValueDecl('s/fan', 'turn').maximum); eq(p.read('s/fan', 'share'), 1, 'End');
    });
  },
  'item 1: one writer: a held turn is one outer rotate about the pivot over the binding, and lets go to it'() {
    return playKnobs().then(({ p, d, node }) => {
      const n = node('oven', 'knob');
      const bound = n.attrs.transform;
      d.hold(n, { addr: 's/oven', axis: 'angle', at: 40 }); d.paint();
      const t = n.attrs.transform;
      ok(t.startsWith('rotate(') && t.endsWith(bound), `outer rotate over the binding: ${t}`);
      near(turnOf(t), 40, 'held turn');
      const pv = place(t, [100, 100]); const pb = place(bound, [100, 100]);
      near(pv[0], pb[0], 'pivot x stays'); near(pv[1], pb[1], 'pivot y stays');
      // Held past 180 degrees from the binding (the binding at -135, the hold at 135): the turn is still exact.
      d.hold(n, { addr: 's/oven', axis: 'angle', at: 135 }); d.paint();
      near(turnOf(n.attrs.transform), 135, 'held at the far end');
      // The value changes under the hold: the hold is measured against the new binding at the next paint.
      p.activate('s/oven', 'turn', 1); d.paint();
      near(turnOf(n.attrs.transform), 135, 'still where the pointer is');
      d.hold(n, null); d.paint(); // reduced motion: at once
      eq(n.attrs.transform, bound.replace(/rotate\([^)]*\)/, 'rotate(135)'), 'rests where its binding puts it');
    });
  },
  'item 1: the release glides the outer rotate away over SETTLE_MS'() {
    return playKnobs().then(({ p, d, node }) => {
      p.state.ambient.reducedMotion = false;
      const n = node('oven', 'knob');
      d.hold(n, { addr: 's/oven', axis: 'angle', at: -95 }); d.paint();
      d.hold(n, null); d.paint();
      near(turnOf(n.attrs.transform), -95, 'starts where it was held');
      p.advance(70); d.paint();
      const mid = turnOf(n.attrs.transform);
      ok(mid < -95 && mid > -135, `half way: ${mid}`);
      p.advance(100); d.paint();
      near(turnOf(n.attrs.transform), -135, 'settled');
    });
  },
  'item 1 checker: an angle slider needs a pivot (E-PIVOT)'() {
    return findings((f) => { f['components/knob/knob.svg'] = f['components/knob/knob.svg'].replace(' data-hsvg-pivot="100 100" data-hsvg-motion="rotate -135..135"', ' data-hsvg-motion="move-x 0..10"'); })
      .then(f => ok(f.includes('E-PIVOT /controls/turn/target'), f.join('; ')));
  },
  'item 1 checker: range inside the rotate motion range, or rotate * (E-RANGE)'() {
    return Promise.all([
      findings((f) => { f['components/knob/knob.svg'] = f['components/knob/knob.svg'].replace('rotate -135..135', 'rotate -90..90'); }),
      findings((f) => { f['components/knob/knob.svg'] = f['components/knob/knob.svg'].replace('rotate -135..135', 'rotate *'); }),
      findings((f) => { f['components/knob/knob.svg'] = f['components/knob/knob.svg'].replace('rotate -135..135', 'scale 1..1.1'); }),
    ]).then(([narrow, free, none]) => {
      ok(narrow.includes('E-RANGE /controls/turn/range'), narrow.join('; '));
      eq(free, [], 'rotate * holds any range');
      ok(none.includes('E-RANGE /controls/turn/range'), none.join('; '));
    });
  },
  'item 1 checker: the span is more than 0 and at most 360 (E-RANGE)'() {
    return Promise.all([
      findings((f, c) => { c.controls.turn.range = [0, 0]; }),
      findings((f, c) => { c.controls.turn.range = [-200, 200]; f['components/knob/knob.svg'] = f['components/knob/knob.svg'].replace('rotate -135..135', 'rotate *'); }),
      findings((f, c) => { c.controls.turn.range = [0, 360]; c.bindings[0].rotate = 'share * 360'; f['components/knob/knob.svg'] = f['components/knob/knob.svg'].replace('rotate -135..135', 'rotate *'); }),
      findings((f, c) => { c.controls.turn.range = [135, -135]; c.bindings[0].rotate = '135 - share * 270'; }),
    ]).then(([zero, wide, full, back]) => {
      ok(zero.includes('E-RANGE /controls/turn/range'), zero.join('; '));
      ok(wide.includes('E-RANGE /controls/turn/range'), wide.join('; '));
      eq(full, [], 'a full turn');
      eq(back, [], 'from may be greater than to');
    });
  },
  'item 1 checker: a clip track on the turned part\'s rotate is E-WRITER'() {
    return findings((f, c) => { c.clips = { wobble: { durationMs: 200, tracks: [{ id: 'w', target: 'knob', channel: 'rotate', keys: [[0, 0], [200, 5]] }] } }; })
      .then(f => ok(f.includes('E-WRITER /clips/wobble/tracks/0'), f.join('; ')));
  },
  'item 1 checker: W-CONTROL-STILL when no binding of the part\'s channel reads the value'() {
    return Promise.all([
      findings((f, c) => { c.bindings[0].rotate = '-135'; }),
      findings((f, c) => { c.bindings.splice(0, 1); }),
      findings((f, c) => { c.computed = { turned: '-135 + share * 270' }; c.bindings[0].rotate = 'turned'; }),
      // A line slider: the same warning for its axis channel.
      findings((f, c) => {
        c.controls.turn = { kind: 'slider', axis: 'x', target: 'knob', value: 'share', range: [0, 10], label: 'x' };
        c.bindings[0] = { target: 'knob', rotate: 'share' };
        f['components/knob/knob.svg'] = f['components/knob/knob.svg'].replace('rotate -135..135', 'move-x 0..10');
      }),
    ]).then(([constant, none, computed, line]) => {
      ok(constant.includes('W-CONTROL-STILL /controls/turn'), constant.join('; '));
      ok(none.includes('W-CONTROL-STILL /controls/turn'), none.join('; '));
      eq(computed, [], 'through a computed value');
      ok(line.includes('W-CONTROL-STILL /controls/turn'), line.join('; '));
    });
  },
  // ---------- item 2: positions may be a formula ----------
  'item 2: positions from an input, proven in 2..1000 (5.6.7)'() {
    const withStep = (c, pos, lo = 0.01) => {
      c.inputs.step = { kind: 'knob', type: 'number', minimum: lo, maximum: 1, initial: 0.1 };
      c.controls.turn.positions = pos;
    };
    return Promise.all([
      findings((f, c) => withStep(c, 'clamp(round(1 / step) + 1, 2, 1000)')),
      findings((f, c) => withStep(c, 'round(1 / step) + 1', 0.0001)),
      findings((f, c) => withStep(c, 'step')),
      findings((f, c) => withStep(c, 'label')),
    ]).then(([proven, big, small, text]) => {
      eq(proven, [], 'clamp(round(span / step) + 1, 2, 1000) passes');
      ok(big.includes('E-RANGE /controls/turn/positions'), big.join('; '));
      ok(small.includes('E-RANGE /controls/turn/positions'), small.join('; '));
      ok(text.some(x => /^E-(TYPE|RANGE) \/controls\/turn\/positions$/.test(x)), text.join('; '));
    });
  },
  'item 2: each use takes its stops from its own input; a change of stops does not rewrite the value'() {
    return playKnobs((f, c) => {
      c.inputs.step = { kind: 'knob', type: 'number', minimum: 0.01, maximum: 1, initial: 0.1 };
      c.controls.turn.positions = 'clamp(round(1 / step) + 1, 2, 1000)';
      const s = JSON.parse(f['scenes/s/scene.json']); s.uses[1].with.step = 'fine ? 0.1 : 0.25'; s.values.fine = { type: 'boolean', initial: false }; f['scenes/s/scene.json'] = s;
    }).then(({ p }) => {
      eq([p.controlPositions('s/oven', 'turn'), p.controlPositions('s/fan', 'turn')], [11, 5], 'stops from each use\'s input');
      near(p.sliderStep('s/fan', 'turn'), 0.25, 'an arrow moves one of 5 stops');
      eq(p.sliderValueAt('s/fan', 'turn', 0.6), 0.5, 'the nearest of 5 stops');
      eq(p.sliderValueAt('s/oven', 'turn', 0.63), 0.6, 'the nearest of 11 stops');
      p.activate('s/fan', 'turn', 0.75);
      ok(p.transaction('person', () => p.runActions('s', [{ id: 'fine-on', set: 'fine', to: 'true' }], 'control')).ok, 'fine on');
      eq(p.controlPositions('s/fan', 'turn'), 11, 'read again when the input changes');
      eq(p.read('s/fan', 'share'), 0.75, 'the stored value is not rewritten');
      eq(p.sliderValueAt('s/fan', 'turn', 0.75), 0.8, 'the next move snaps to the new stops');
    });
  },
  // ---------- item 3: valueText ----------
  'item 3: the oven example checks clean; its spoken value is the formatted heat, read back by the Node player'() {
    const dir = path.join(repo, 'skill', '2.0', 'examples', 'recipes', 'oven-dial');
    return folderSource(dir).then(async (src) => {
      eq(checkExperience(src, schemas()).diags.map(d => `${d.code} ${d.path}`), [], 'oven-dial findings');
      const l = loadExperience(src, schemas());
      const p = new Player(l.experience, {});
      ok(p.start().ok, 'starts');
      eq(p.controlPositions('kitchen/oven', 'heat'), 21, 'stops from the inputs: 50 to 250 in steps of 10');
      eq(p.controlValueText('kitchen/oven', 'heat'), '50 °C', 'spoken at the start');
      p.activate('kitchen/oven', 'heat', p.sliderValueAt('kitchen/oven', 'heat', 0.6));
      eq([p.read('kitchen/oven', 'share'), p.controlValueText('kitchen/oven', 'heat')], [0.6, '170 °C'], 'spoken after a turn');
      eq(p.controlValueText('s/oven', 'turn'), undefined, 'no valueText: nothing');
    });
  },
  'item 3 checker: valueText is a template of the block\'s names'() {
    return Promise.all([
      findings((f, c) => { c.controls.turn.valueText = '{{ numberText(share * 100, 0) }} %'; }),
      findings((f, c) => { c.controls.turn.valueText = '{{ nowhere }} %'; }),
    ]).then(([good, bad]) => {
      eq(good, [], 'a good template');
      ok(bad.some(x => x.endsWith('/controls/turn/valueText')), bad.join('; '));
    });
  },
  // ---------- item 4: held on a slider ----------
  'item 4: a slider\'s held is true while held, for each use alone'() {
    return playKnobs().then(({ p }) => {
      eq(p.read('s/oven', 'holding'), false, 'not held at the start');
      ok(p.hold('s/oven', 'turn', true).ok, 'held');
      eq([p.read('s/oven', 'holding'), p.read('s/fan', 'holding')], [true, false], 'only that use');
      p.hold('s/oven', 'turn', false);
      eq(p.read('s/oven', 'holding'), false, 'let go');
      p.hold('s/level', 'slide', true); eq(p.read('s/level', 'holding'), true, 'a line slider too');
    });
  },
  'item 4 checker: held names a boolean value of the block (E-TYPE)'() {
    return Promise.all([
      findings((f, c) => { c.controls.turn.held = 'share'; }),
      findings((f, c) => { c.controls.turn.held = 'nothing'; }),
    ]).then(([num, none]) => {
      ok(num.includes('E-TYPE /controls/turn/held'), num.join('; '));
      ok(none.includes('E-TYPE /controls/turn/held'), none.join('; '));
    });
  },
  // ---------- item 5: checked on a press ----------
  'item 5: a toggle flips its value on each activation, then queues its event'() {
    return playKnobs().then(({ p }) => {
      eq([p.read('s', 'lights'), p.read('s', 'toggles')], [false, 0], 'off at the start');
      p.activate('s', 'lights');
      eq([p.read('s', 'lights'), p.read('s', 'toggles')], [true, 1], 'on, and the event heard after the write');
      p.activate('s', 'lights');
      eq([p.read('s', 'lights'), p.read('s', 'toggles')], [false, 2], 'off again');
    });
  },
  'item 5 checker: a toggle\'s value names a boolean value of the block (E-TYPE); value with held is allowed'() {
    const scene = (f, edit) => { const s = JSON.parse(f['scenes/s/scene.json']); edit(s); f['scenes/s/scene.json'] = s; };
    return Promise.all([
      findings((f) => scene(f, s => { s.controls.lights.value = 'toggles'; })),
      findings((f) => scene(f, s => { s.values.pressing = { type: 'boolean', initial: false }; s.controls.lights.held = 'pressing'; })),
    ]).then(([num, both]) => {
      ok(num.includes('E-TYPE /controls/lights/value'), num.join('; '));
      eq(both, [], 'value and held on one toggle');
    });
  },
  // ---------- item 7: a hidden option cannot activate ----------
  'item 7: the Node player refuses a hidden option, as the page does'() {
    return playKnobs().then(({ p }) => {
      ok(p.controlEnabled('s', 'size', 'l'), 'shown: usable');
      ok(p.transaction('person', () => p.runActions('s', [{ id: 'hide-l', set: 'large', to: 'false' }], 'control')).ok, 'hide it');
      eq([p.controlEnabled('s', 'size', 'l'), p.controlEnabled('s', 'size', 's'), p.controlEnabled('s', 'size')], [false, true, true], 'hidden option refused; the others and the control stay');
      const r = p.activate('s', 'size', 'l');
      eq([r.ok, r.ignored, p.read('s', 'pick')], [true, 'disabled', 'm'], 'activating it does nothing');
      p.activate('s', 'size', 's'); eq(p.read('s', 'pick'), 's', 'a shown option still works');
    });
  },
};
