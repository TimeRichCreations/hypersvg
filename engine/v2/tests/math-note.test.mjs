// The maths note (5.6.4, D62 3.3): pow, exp, log, sin and cos give the platform's result within 1 unit in the last
// place, so the checker notes such a result that reaches a guard, a value that is written or an output with no round,
// floor or ceil around it (W-MATH-UNROUNDED). A note, never an error: the file still checks and plays.
import { checkExperience } from '../check/index.mjs';
import { describe } from '../check/diagnostics.mjs';
import { schemas, eq, ok, mapSource } from './helpers.mjs';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>Maths</title><g id="go" data-hsvg-kind="part" data-hsvg-pivot="5 5" data-hsvg-motion="rotate -90..90"><rect width="10" height="10"/></g></svg>`;
// A small experience whose formulas use maths only where it is rounded or only drawn. edit(scene, experience) adds one.
function files(edit = () => {}) {
  const exp = {
    format: 'hsvg/2.0', kind: 'experience', id: 'maths', language: 'en',
    story: { start: 'one', scenes: { one: 'scenes/one/scene.json' }, ends: ['one'] },
  };
  const scene = {
    format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg',
    values: { angle: { type: 'number', initial: 30, minimum: 0, maximum: 360 }, score: { type: 'number', initial: 0, minimum: -1000, maximum: 1000 } },
    outputs: { hit: { kind: 'event', payload: { type: 'object', properties: { at: { type: 'number', minimum: -1000, maximum: 1000 } }, required: ['at'], additionalProperties: false } } },
    controls: { go: { kind: 'button', target: 'go', label: 'Go' } },
    bindings: [{ id: 'turn', target: 'go', rotate: 'clamp(sin(angle) * 90, -90, 90)' }],
    on: { 'press:go': [{ id: 'pressed', guard: 'round(sin(angle) * 100) > 40', actions: [{ id: 'count', set: 'score', to: 'floor(pow(angle, 0.5))' }, { id: 'fin', emit: 'hit', with: { at: 'ceil(log(angle + 1))' } }] }] },
  };
  edit(scene, exp);
  return { 'experience.json': exp, 'scenes/one/scene.json': scene, 'scenes/one/one.svg': svg };
}
const run = (f) => checkExperience(mapSource(f), schemas());
const notes = (f) => run(f).diags.filter(d => d.code === 'W-MATH-UNROUNDED').map(d => d.path);
const handler = (s) => s.on['press:go'][0];

export const tests = {
  'no note where maths is rounded, or only drawn (a binding); the base checks clean'() {
    const r = run(files());
    eq(r.diags.map(d => d.code), []);
  },
  'a guard, an if, a set, an event payload, a result output, a control\'s enabled and a link\'s when are noted'() {
    eq(notes(files((s) => { handler(s).guard = 'sin(angle) > 0.4'; })), ['/on/press:go/0/guard']);
    eq(notes(files((s) => { handler(s).actions.push({ id: 'maybe', if: 'cos(angle) < 0', then: [{ id: 'z', set: 'score', to: '0' }] }); })), ['/on/press:go/0/actions/2/if']);
    eq(notes(files((s) => { handler(s).actions[0].to = 'clamp(pow(angle, 1.5), 0, 1000)'; })), ['/on/press:go/0/actions/0/to']);
    eq(notes(files((s) => { handler(s).actions[1].with.at = 'exp(angle / 100)'; })), ['/on/press:go/0/actions/1/with/at']);
    eq(notes(files((s) => { s.outputs.total = { kind: 'result', type: 'number', value: 'log(angle + 1)' }; })), ['/outputs/total/value']);
    eq(notes(files((s) => { s.controls.go.enabled = 'sin(angle) > 0'; })), ['/controls/go/enabled']);
    const linked = files((s, e) => {
      e.story.scenes.two = 'scenes/two/scene.json';
      e.story.ends = ['two'];
      e.story.links = [{ id: 'on', from: 'one', on: 'hit', when: 'pow(event.at, 2) > 1', to: 'two' }];
    });
    linked['scenes/two/scene.json'] = { format: 'hsvg/2.0', kind: 'scene', id: 'two', drawing: 'two.svg' };
    linked['scenes/two/two.svg'] = svg.replace('id="go"', 'id="stay"');
    eq(notes(linked), ['/story/links/0/when']);
  },
  'round, floor or ceil anywhere above the call clears it; sqrt and the exact functions are never noted'() {
    eq(notes(files((s) => { handler(s).guard = 'round(sin(angle) * 10) / 10 > 0.4'; })), []);
    eq(notes(files((s) => { handler(s).actions[0].to = 'min(floor(exp(1) * 100), 1000)'; })), []);
    eq(notes(files((s) => { handler(s).guard = 'sqrt(angle) > 2 && angle % 7 > 1'; })), []);
    eq(notes(files((s) => { handler(s).guard = 'round(sin(angle)) > 0 || cos(angle) > 0'; })), ['/on/press:go/0/guard'], 'one unrounded call is enough');
  },
  'it is a warning from errors.json, with its reason and fix; the file still has no error'() {
    const r = run(files((s) => { handler(s).guard = 'sin(angle) > 0.4'; }));
    const f = files((s) => { handler(s).guard = 'sin(angle) > 0.4'; });
    const d = describe(r.diags, mapSource(f), r.experience).find(x => x.code === 'W-MATH-UNROUNDED');
    ok(d && d.severity === 'warning' && /round/.test(d.fix) && /1 unit in the last place/.test(d.reason), JSON.stringify(d));
    ok(/sin\(\.\.\.\) reaches a guard or condition unrounded/.test(r.diags.find(x => x.code === 'W-MATH-UNROUNDED').message));
    eq(r.diags.filter(x => x.code.startsWith('E-')), []);
    ok(r.experience, 'the experience still loads');
  },
};
