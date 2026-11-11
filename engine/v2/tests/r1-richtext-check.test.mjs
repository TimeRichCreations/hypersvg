// The checker's rich text family (check/richtext.mjs) and the run formulas (check/formula/sites.mjs).
import { checkExperience } from '../check/index.mjs';
import { files } from './richtext-fixture/files.mjs';
import { eq, ok, mapSource, schemas } from './helpers.mjs';

const variant = (change) => { const f = structuredClone(files); change(f); return f; };
const run = (f) => checkExperience(mapSource(f), schemas()).diags.filter(d => d.code.startsWith('E-'));
const has = (diags, code, part) => diags.some(d => d.code === code && (d.path + ' ' + d.message).includes(part));
const exp = (f) => f['experience.json'];
const scene = (f) => f['scenes/ad/scene.json'];

export const tests = {
  'the rich text fixture checks clean'() {
    eq(run(files), []);
  },
  'a run style the theme lacks is E-REF-UNKNOWN; strong and emphasis are always defined (6.8.1)'() {
    const d = run(variant(f => { scene(f).bindings[2]['rich-text'].runs[0].style = 'shout'; }));
    ok(has(d, 'E-REF-UNKNOWN', 'style shout'), JSON.stringify(d));
    eq(run(variant(f => { scene(f).bindings[2]['rich-text'].runs[0].style = 'emphasis'; })), []);
  },
  "a field's styles must be text styles of addons.rich-text.styles (5.3.1, 7.7)"() {
    const d = run(variant(f => { exp(f).inputs.headline.styles.push('loud'); }));
    ok(has(d, 'E-REF-UNKNOWN', 'style loud'), JSON.stringify(d));
    const two = run(variant(f => { delete exp(f).addons['rich-text'].styles.accent; }));
    ok(has(two, 'E-REF-UNKNOWN', 'not a text style of addons.rich-text.styles'), JSON.stringify(two));
  },
  'a richText value uses only the field styles and holds no markup (5.3.1, 6.8.1)'() {
    let d = run(variant(f => { exp(f).inputs.headline.initial[0].style = 'emphasis'; exp(f).inputs.headline.styles = ['accent', 'strong']; }));
    ok(has(d, 'E-TYPE', 'not one of the field'), JSON.stringify(d));
    d = run(variant(f => { exp(f).inputs.headline.initial[1].text = '<b>Bring</b> it on.'; }));
    ok(has(d, 'E-TYPE', 'a tag'), JSON.stringify(d));
    d = run(variant(f => { scene(f).uses[0].with.label.de[0].text = 'Neue &amp; '; }));
    ok(has(d, 'E-TYPE', 'an entity') && has(d, 'E-TYPE', '/uses/0/with/label/de/0/text'), JSON.stringify(d));
    d = run(variant(f => { scene(f).uses[0].with.label.en[0].style = 'accent'; }));
    ok(has(d, 'E-TYPE', 'style accent is not one of'), JSON.stringify(d));
  },
  'styles belong to a richText field'() {
    const d = run(variant(f => { scene(f).values = { ...scene(f).values }; exp(f).inputs.title = { kind: 'content', type: 'string', maxLength: 20, initial: 'x', styles: ['strong'] }; }));
    ok(has(d, 'E-TYPE', 'styles belongs to a richText field'), JSON.stringify(d));
  },
  "a text style's roles exist in the theme; contrast on surface and on the highlight (7.7, 8.9)"() {
    let d = run(variant(f => { exp(f).addons['rich-text'].styles.price.highlightRole = 'moon'; }));
    ok(has(d, 'E-REF-UNKNOWN', 'no colour role moon'), JSON.stringify(d));
    d = run(variant(f => { exp(f).addons['rich-text'].styles.legal.typeRole = 'fine'; }));
    ok(has(d, 'E-REF-UNKNOWN', 'no type role fine'), JSON.stringify(d));
    d = run(variant(f => { exp(f).themes.day.colorRoles.pale = '#dddddd'; exp(f).addons['rich-text'].styles.legal.colorRole = 'pale'; }));
    ok(has(d, 'E-RULE', 'text style legal in theme day: pale on surface'), JSON.stringify(d));
    d = run(variant(f => { exp(f).themes.day.colorRoles.sun = '#1d2a33'; }));
    ok(has(d, 'E-RULE', 'the text on its highlight sun'), JSON.stringify(d));
  },
  'a flow part drawn in no frame, or not a text, is E-REF-UNKNOWN; one some frames lack is fine (6.8.1)'() {
    let d = run(variant(f => { scene(f).bindings[0]['rich-text'].flow = ['head-9']; }));
    ok(has(d, 'E-REF-UNKNOWN', 'flow part head-9 is drawn in no frame'), JSON.stringify(d));
    d = run(variant(f => { scene(f).bindings[0]['rich-text'].flow = ['price-box']; }));
    ok(has(d, 'E-REF-UNKNOWN', 'flow part price-box is not a <text>'), JSON.stringify(d));
  },
  'a readable floor applies per style: by style name or type role (8.9)'() {
    const d = run(variant(f => { scene(f).rules = [{ id: 'legal-size', kind: 'readable', subject: 'part:price', minTextPx: 10, byRole: { 'was-price': 20 } }]; }));
    ok(has(d, 'E-RULE', 'under the readable floor 20 for style was-price'), JSON.stringify(d));
  },
  'run templates and highlight formulas are checked as formulas (5.6)'() {
    let d = run(variant(f => { scene(f).bindings[1]['rich-text'].runs[1].highlight = 'nosuch'; }));
    ok(d.some(x => x.path.includes('/bindings/1/rich-text/runs/1/highlight')), JSON.stringify(d));
    d = run(variant(f => { scene(f).bindings[2]['rich-text'].runs[0].text = '{{ nosuch }}'; }));
    ok(d.some(x => x.path.includes('/bindings/2/rich-text/runs/0/text')), JSON.stringify(d));
  },
};
