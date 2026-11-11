// Review findings that files can decide, as checker warnings (check/review.mjs).
// W-NAME-HIDES-LABEL: a press or option whose name does not hold the words drawn in its target (WCAG 2.5.3).
// W-TEXT-SMALL: text under the readable floor where the layout's scale is known.
import { checkExperience } from '../check/index.mjs';
import { templateTexts } from '../check/review.mjs';
import { schemas, eq, ok, mapSource } from './helpers.mjs';

const svg = (vb, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>t</title>${inner}</svg>`;
const button = (text, size = 20) => `<g id="go" data-hsvg-kind="part"><rect x="10" y="10" width="200" height="60" fill="#ccc"/><text id="go-text" x="20" y="50" font-size="${size}">${text}</text></g>`;
function files({ label = 'Go on', shown = 'Go on', bound = null, size = 20, layouts = null, axes = null, disabledLabel = null } = {}) {
  const scene = { format: 'hsvg/2.0', kind: 'scene', id: 'one', controls: { go: { kind: 'button', target: 'go', label, ...(disabledLabel ? { disabledLabel, enabled: 'false' } : {}) } } };
  if (bound) scene.bindings = [{ target: 'go-text', text: bound }];
  const f = {
    'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'r', language: 'en', story: { start: 'one', scenes: { one: 'scenes/one/scene.json' }, ends: ['one'] }, ...(axes ? { axes } : {}),
      resources: { 'words-en': { kind: 'words', file: 'words/en.csv', language: 'en', digest: `sha256:${'0'.repeat(64)}` } } },
    'words/en.csv': 'id,text\ngoOn,Go on\nnext,Continue\nmore,"{{ words.goOn }}, please"\n',
    'scenes/one/scene.json': scene,
  };
  if (layouts) { scene.layouts = layouts.map(l => ({ id: l.id, shape: l.shape, drawing: `${l.id}.svg` })); for (const l of layouts) f[`scenes/one/${l.id}.svg`] = svg(l.vb, button(shown, l.size ?? size)); } else { scene.drawing = 'one.svg'; f['scenes/one/one.svg'] = svg('0 0 640 400', button(shown, size)); }
  return f;
}
const run = (f) => { const src = mapSource(f); src.list = () => Object.keys(f); return checkExperience(src, schemas(), { only: ['review'] }).diags.map(d => d.code); };

export const tests = {
  'templateTexts: plain words, word lookups and a ? b : c of them; anything else is not compared'() {
    const w = { a: 'Next', b: 'Finish', c: '{{ words.a }} step' };
    eq(templateTexts('Go', w), ['Go']);
    eq(templateTexts('{{ words.a }}', w), ['Next']);
    eq(templateTexts('{{ last ? words.b : words.c }}', w), ['Finish', 'Next step']);
    eq(templateTexts('{{ score }} points', w), null);
  },
  'W-NAME-HIDES-LABEL: the name holds the visible words, or the checker warns'() {
    eq(run(files()), []);
    eq(run(files({ label: 'Go on: to the next step' })), [], 'extra words after the visible ones are fine');
    eq(run(files({ label: 'Continue' })), ['W-NAME-HIDES-LABEL']);
    eq(run(files({ label: '{{ words.next }}' })), ['W-NAME-HIDES-LABEL'], 'through a word');
    eq(run(files({ label: '{{ words.goOn }}', shown: '·', bound: '{{ words.more }}' })), ['W-NAME-HIDES-LABEL'], 'a bound text: "Go on, please" is not in "Go on"');
    eq(run(files({ label: '{{ words.more }}', shown: '·', bound: '{{ words.goOn }}' })), []);
    eq(run(files({ label: 'Back to {{ place }}', shown: 'Back home' })), [], 'a formula name is left to the browser test');
    eq(run(files({ label: 'Go on', shown: 'Wait', disabledLabel: 'Wait: the swing runs' })), [], 'the disabledLabel names it while it shows other words');
    eq(run(files({ label: 'Small', shown: 'S' })), [], 'one letter is not words');
  },
  'W-TEXT-SMALL: at a declared size, and on the phone only where a layout is meant for it'() {
    eq(run(files({ size: 8 })), [], 'one drawing, no sizes: its scale on a phone is not known');
    const phone = [{ id: 'wide', shape: { minAspect: 1 }, vb: '0 0 960 600' }, { id: 'tall', shape: { maxAspect: 1 }, vb: '0 0 600 960', size: 16 }];
    eq(run(files({ layouts: phone })), ['W-TEXT-SMALL'], 'a 600 x 960 tall layout shows at 65 % on a 390 x 844 phone: 16 units are 10.4 px');
    eq(run(files({ layouts: [phone[0], { ...phone[1], vb: '0 0 390 844' }] })), [], 'drawn at 390 x 844: 16 px');
    const axes = [{ axis: 'shape', select: 'space', shapes: { any: {} }, sizes: { '300x250': 'must' } }];
    eq(run(files({ axes, size: 9 })), ['W-TEXT-SMALL'], 'at a declared size 300 x 250 the 640 x 400 drawing is at 47 %');
    eq(run(files({ axes, size: 30 })), []);
  },
};
