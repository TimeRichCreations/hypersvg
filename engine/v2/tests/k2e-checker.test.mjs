// The checker holes the stress test found.
// Fixtures are made from k2e-fixture, a copy of the drag-sort recipe (skill/2.0/examples/recipes/drag-sort), so the
// tests run in the lean base (D41): edit its JSON or drawing, check.
import { checkExperience } from '../check/index.mjs';
import { folderSource } from '../src/load.mjs';
import { repo, schemas, eq, ok } from './helpers.mjs';
import path from 'node:path';

const dir = path.join(repo, 'engine', 'v2', 'tests', 'k2e-fixture');
const folder = await folderSource(dir);
const SCENE = 'scenes/sort/scene.json'; const SVG = 'scenes/sort/sort.svg';
// Checks drag-sort after edit(experience, sort scene) and draw(svg text); returns the findings as [code, path, message].
const run = (edit = () => {}, draw = (s) => s, opts = {}) => {
  const e = JSON.parse(folder.read('experience.json')); const s = JSON.parse(folder.read(SCENE));
  edit(e, s);
  const files = { 'experience.json': JSON.stringify(e), [SCENE]: JSON.stringify(s), [SVG]: draw(folder.read(SVG)) };
  const source = { ...folder, read: (p) => files[p] ?? folder.read(p) };
  return checkExperience(source, schemas(), opts).diags.map(d => [d.code, d.path, d.message]);
};
const codes = (r) => r.map(([c, p]) => `${c} ${p}`);
const msg = (r) => r.map(x => x[2]).join(' | ');
const REVIEW = { review: true }; // the review findings (check.mjs --review, test.mjs)

export const tests = {
  'drag-sort checks clean'() { eq(run(), []); },

  // ---------- 1. a drag's drop that names no part ----------
  'a drop that names no drawn part is E-REF-UNKNOWN, with the near name'() {
    const r = run((e, s) => { s.controls.paper.drops = ['compost-bin', 'recycle-bn']; });
    eq(codes(r), ['E-REF-UNKNOWN /controls/paper/drops/1'], msg(r));
    ok(r[0][2].includes('"recycle-bn"') && r[0][2].includes('recycle-bin'), r[0][2]);
  },
  'every drawn drop passes'() { eq(run((e, s) => { s.controls.paper.drops = ['recycle-bin']; }), []); },

  // ---------- 2. words that name a value but have no {{ }} ----------
  'a text binding that names a value without {{ }} is W-TEXT-LITERAL with the fixed text'() {
    const r = run((e, s) => { s.bindings[0].text = 'Sorted: sorted of 4'; });
    eq(codes(r), ['W-TEXT-LITERAL /bindings/0/text'], msg(r));
    ok(r[0][2].includes('{{ sorted }}') && r[0][2].includes('"Sorted: {{ sorted }} of 4"'), r[0][2]);
  },
  'a label with a name after a colon and a name no word is spelt like is one W-TEXT-LITERAL naming both'() {
    const r = run((e, s) => { s.bindings.push({ id: 'tally', target: 'status', label: 'Sorted: sorted, missed misses, apple appleIn' }); });
    eq(codes(r), ['W-TEXT-LITERAL /bindings/1/label'], msg(r));
    ok(r[0][2].includes('"Sorted: {{ sorted }}, missed misses, apple {{ appleIn }}"'), r[0][2]);
  },
  'words with {{ }}, a name in another case, or a plain word not after a colon, pass'() {
    eq(run((e, s) => { s.bindings[0].text = 'Sorted {{ sorted }} of 4. Misses: {{ misses }}'; }), []);
    eq(run((e, s) => { s.bindings[0].text = 'Sorted of 4. Misses'; }), []);
    eq(run((e, s) => { s.bindings[0].text = 'Count the misses, then try again'; }), []);
  },

  // ---------- 3. a literal out of a value's range inside an action ----------
  'set to a number outside the value\'s bounds is E-RANGE'() {
    for (const to of [5, '5', -1, 'min(9, 7)']) {
      const r = run((e, s) => { s.on.appleSorted[0].actions[1].to = to; });
      eq(codes(r), ['E-RANGE /on/appleSorted/0/actions/1/to'], `${JSON.stringify(to)}: ${msg(r)}`);
      ok(r[0][2].includes('0..4') && r[0][2].includes('sorted'), r[0][2]);
    }
  },
  'set to a number inside the bounds, or a formula that may fit, passes'() {
    for (const to of [4, '0', 'sorted + 1', 'appleIn ? 9 : 1']) eq(run((e, s) => { s.on.appleSorted[0].actions[1].to = to; }), [], JSON.stringify(to));
  },
  'set to a text longer than the value\'s maxLength is E-RANGE; one that fits passes'() {
    const add = (to) => (e, s) => { s.values.note = { type: 'string', initial: '', maxLength: 4 }; s.on.appleSorted[0].actions.push({ id: 'note-it', set: 'note', to }); };
    const r = run(add("'apple'"));
    eq(codes(r), ['E-RANGE /on/appleSorted/0/actions/3/to'], msg(r));
    ok(r[0][2].includes('maxLength 4'), r[0][2]);
    eq(run(add("'pear'")), []);
  },
  'a nested set (inside if) is checked too'() {
    const r = run((e, s) => { s.on.appleSorted[0].actions[2].then.push({ id: 'too-many', set: 'misses', to: 100 }); });
    eq(codes(r), ['E-RANGE /on/appleSorted/0/actions/2/then/1/to'], msg(r));
  },

  // ---------- 4. a drawn part that looks like a control, with no control on it ----------
  'a part with a button role and no control is W-CONTROL-DRAWN, with the control to add'() {
    const drawn = '<g id="hint-btn" data-hsvg-kind="part" data-hsvg-role="action"><rect x="600" y="20" width="120" height="44" fill="#ffffff"/><text x="620" y="50">Hint</text></g>';
    const r = run(() => {}, (svg) => svg.replace('</svg>', `${drawn}</svg>`));
    eq(codes(r), ['W-CONTROL-DRAWN #hint-btn'], msg(r));
    ok(r[0][2].includes('hint-btn') && r[0][2].includes('"kind": "button", "target": "hint-btn"'), r[0][2]);
  },
  'a part labelled as a button, or with the role button, and no control is W-CONTROL-DRAWN'() {
    for (const marks of ['data-hsvg-label="Hint button"', 'data-hsvg-role="button"']) {
      const drawn = `<g id="hint" data-hsvg-kind="part" ${marks}><rect x="600" y="20" width="120" height="44" fill="#ffffff"/></g>`;
      const r = run(() => {}, (svg) => svg.replace('</svg>', `${drawn}</svg>`));
      ok(codes(r).includes('W-CONTROL-DRAWN #hint'), `${marks}: ${msg(r)}`);
    }
  },
  'a button part with a control on it, on its parent or on a part inside it passes'() {
    const drawn = '<g id="hint-box" data-hsvg-kind="part"><g id="hint-btn" data-hsvg-kind="part" data-hsvg-role="action"><rect id="hint-face" data-hsvg-kind="part" x="600" y="20" width="120" height="44" fill="#ffffff"/></g></g>';
    for (const target of ['hint-btn', 'hint-box', 'hint-face']) {
      const r = run((e, s) => { s.controls.hint = { kind: 'button', target, label: 'Hint', event: 'hint' }; s.on.hint = [{ id: 'h', actions: [{ id: 'h1', set: 'misses', to: '0' }] }]; }, (svg) => svg.replace('</svg>', `${drawn}</svg>`));
      eq(codes(r), [], `${target}: ${msg(r)}`);
    }
  },
  'a button part whose control is on a hit part that follows it passes'() {
    const drawn = '<g id="hint-btn" data-hsvg-kind="part" data-hsvg-role="action"><rect x="600" y="20" width="120" height="44" fill="#ffffff"/></g><rect id="hint-hit" data-hsvg-kind="part" data-hsvg-follow="hint-btn" x="600" y="20" width="120" height="44" fill="none"/>';
    const r = run((e, s) => { s.controls.hint = { kind: 'button', target: 'hint-hit', label: 'Hint', event: 'hint' }; s.on.hint = [{ id: 'h', actions: [{ id: 'h1', set: 'misses', to: '0' }] }]; }, (svg) => svg.replace('</svg>', `${drawn}</svg>`));
    eq(codes(r).filter(c => c.startsWith('W-CONTROL-DRAWN')), [], msg(r));
  },

  // ---------- 5. a drawn fill that equals a theme colour but has no colour mark ----------
  'with two themes, a fill that equals a theme colour with no colour mark is W-COLOR-UNMARKED (review), naming the role'() {
    const theme = (e) => { e.theme = 'yard'; e.themes = { yard: { colorRoles: { surface: '#010101', ink: '#020202', accent: '#e85d3a', 'accent-2': '#030303', muted: '#040404', success: '#050505', warning: '#060606', danger: '#070707' } }, dusk: { extends: 'yard', colorRoles: { accent: '#ff9900' } } }; };
    const r = run(theme, (svg) => svg.replace('</svg>', '<rect id="tag" data-hsvg-kind="part" x="10" y="10" width="40" height="20" fill="#E85D3A"/></svg>'), REVIEW);
    eq(run(theme, (svg) => svg.replace('</svg>', '<rect id="tag" data-hsvg-kind="part" x="10" y="10" width="40" height="20" fill="#E85D3A"/></svg>')).filter(([c]) => c === 'W-COLOR-UNMARKED'), [], 'a review finding only');
    const w = r.filter(([c]) => c === 'W-COLOR-UNMARKED');
    eq(w.length, 1, msg(r));
    ok(w[0][2].includes('#e85d3a') && w[0][2].includes('accent') && w[0][2].includes('="accent"'), w[0][2]);
  },
  'a marked fill, a fill under a marked group, or a fill of no theme colour passes'() {
    const theme = (e) => { e.theme = 'yard'; e.themes = { yard: { colorRoles: { surface: '#010101', ink: '#020202', accent: '#e85d3a', 'accent-2': '#030303', muted: '#040404', success: '#050505', warning: '#060606', danger: '#070707' } }, dusk: { extends: 'yard', colorRoles: { accent: '#ff9900' } } }; };
    const base = run(theme, undefined, REVIEW).filter(([c]) => c === 'W-COLOR-UNMARKED').length;
    eq(base, 0, 'the recipe draws no colour of this theme');
    for (const add of [
      '<rect id="tag" data-hsvg-kind="part" data-hsvg-color="accent" x="10" y="10" width="40" height="20" fill="#e85d3a"/>',
      '<g id="tag" data-hsvg-kind="part" data-hsvg-color="fill:accent"><rect x="10" y="10" width="40" height="20" fill="#e85d3a"/></g>',
      '<rect id="tag" data-hsvg-kind="part" x="10" y="10" width="40" height="20" fill="#e85d3b"/>',
    ]) eq(run(theme, (svg) => svg.replace('</svg>', `${add}</svg>`), REVIEW).filter(([c]) => c === 'W-COLOR-UNMARKED').length, base, add);
  },
  'with no theme, a drawn fill is never W-COLOR-UNMARKED'() {
    eq(run(() => {}, (svg) => svg.replace('</svg>', '<rect id="tag" data-hsvg-kind="part" x="10" y="10" width="40" height="20" fill="#e85d3a"/></svg>'), REVIEW).filter(([c]) => c === 'W-COLOR-UNMARKED'), []);
  },
  'with one theme nothing changes a colour, so a drawn theme colour passes'() {
    const one = (e) => { e.theme = 'yard'; e.themes = { yard: { colorRoles: { surface: '#010101', ink: '#020202', accent: '#e85d3a', 'accent-2': '#030303', muted: '#040404', success: '#050505', warning: '#060606', danger: '#070707' } } }; };
    eq(run(one, (svg) => svg.replace('</svg>', '<rect id="tag" data-hsvg-kind="part" x="10" y="10" width="40" height="20" fill="#e85d3a"/></svg>'), REVIEW).filter(([c]) => c === 'W-COLOR-UNMARKED'), []);
  },
  'a role that every theme paints alike passes: a change of theme loses nothing'() {
    const same = (e) => { e.theme = 'yard'; e.themes = { yard: { colorRoles: { surface: '#010101', ink: '#020202', accent: '#e85d3a', 'accent-2': '#030303', muted: '#040404', success: '#050505', warning: '#060606', danger: '#070707' } }, dusk: { extends: 'yard', colorRoles: { surface: '#090909' } } }; };
    eq(run(same, (svg) => svg.replace('</svg>', '<rect id="tag" data-hsvg-kind="part" x="10" y="10" width="40" height="20" fill="#e85d3a"/></svg>'), REVIEW).filter(([c]) => c === 'W-COLOR-UNMARKED'), []);
  },
};
