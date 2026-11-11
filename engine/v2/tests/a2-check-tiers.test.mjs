// The checker's give-way step checks (check/tiers.mjs and the schema): a give-way step its rule kind may not use stays the schema's E-RULE (8.4),
// and a text fit lists only text steps (7.6).
import { checkExperience } from '../check/index.mjs';
import { schemas, eq, mapSource } from './helpers.mjs';

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hsvg-version="2.0" data-hsvg-kind="screen">${body}</svg>`;
const blockSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20" data-hsvg-version="2.0"><g id="line" data-hsvg-kind="component"><rect id="line__box" data-hsvg-kind="part" data-hsvg-fit="" width="100" height="20"/><text id="line__text" data-hsvg-kind="part" x="0" y="15" font-size="12">Sample</text></g></svg>';
function base() {
  return {
    'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'tiny', language: 'en', story: { start: 'one', scenes: { one: 'scenes/one/scene.json' }, ends: ['one'] }, blocks: { line: 'blocks/line/component.json' } },
    'scenes/one/scene.json': { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg', uses: [{ id: 'headline', use: 'line', into: 'slot', with: { copy: { short: 'Hi', rich: 'Hello there' } } }], rules: [] },
    'scenes/one/one.svg': svg('<rect id="slot" data-hsvg-kind="part" data-hsvg-slot="slot" width="100" height="20"/>'),
    'blocks/line/component.json': {
      format: 'hsvg/2.0', kind: 'component', id: 'line', drawing: 'line.svg',
      inputs: { copy: { kind: 'content', type: 'string', initial: { short: 'Sample', medium: 'A sample' }, maxLength: 60 } },
      bindings: [{ id: 'copy-text', target: 'text', text: '{{ copy }}', fit: { box: 'box', minFontPx: 8 } }],
    },
    'blocks/line/line.svg': blockSvg,
  };
}
const all = (f) => checkExperience(mapSource(f), schemas(), { only: ['tiers'] }).diags.map(d => `${d.code} ${d.path}`);
// The tiers family's own findings (its paths are JSON pointers; the schema's are dotted).
const run = (f) => all(f).filter(x => x.split(' ')[1].startsWith('/'));

export const tests = {
  'the fixture base has no findings'() { eq(all(base()), []); },
  'a give-way rule with a step its kind may not use is E-RULE, once, from the schema (8.4)'() {
    const f = base();
    f['scenes/one/scene.json'].rules = [
      { id: 'logo-kept', kind: 'keep', subject: 'use:headline', strength: 'give-way', steps: ['shrink', 'remove', 'mark-only'], floor: { keep: true } },
      { id: 'legal-fits', kind: 'fits', subject: 'use:headline', strength: 'give-way', steps: ['short', 'mark-only', 'remove'], floor: { minTextPx: 9 } },
      { id: 'fine', kind: 'inside', of: 'place:slot', subject: 'use:headline', strength: 'give-way', steps: ['column', 'crop'], floor: { minShare: 0.2 } },
    ];
    eq(all(f), ['E-RULE rules[0].steps[1]', 'E-RULE rules[1].steps[1]']);
  },
  'a text fit with a step that is not a text step is E-RULE (7.6)'() {
    const f = base();
    f['blocks/line/component.json'].bindings[0].fit.steps = ['short', 'shrink', 'mark-only', 'reflow'];
    eq(run(f), ['E-RULE /bindings/0/fit/steps/2']);
  },
};
