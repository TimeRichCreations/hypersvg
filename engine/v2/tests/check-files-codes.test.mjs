// The `files` codes added to the checker. Each has a valid fixture that stays clean and a failing
// fixture that gives exactly that code (checked with only the new family running, so older findings do not mix in).
import crypto from 'node:crypto';
import { checkExperience } from '../check/index.mjs';
import { checkPackage, lintHooks } from '../check/packages.mjs';
import { badPath } from '../check/paths.mjs';
import { schemas, eq, ok, mapSource } from './helpers.mjs';
import { base } from './check-refs.test.mjs';

const svgWith = (inner, { title = true, attrs = '' } = {}) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hsvg-version="2.0" data-hsvg-kind="screen"${attrs}>${title ? '<title>t</title>' : ''}${inner}</svg>`;
const found = (files, code, family, list) => {
  const src = mapSource(files);
  if (list) src.list = () => Object.keys(files);
  return checkExperience(src, schemas(), { only: [family] }).diags.filter(d => d.code === code);
};
// Valid: the code is absent. Failing: present at least once.
function pair(code, family, change, list = false) {
  const good = found(base(), code, family, list);
  if (good.length) throw new Error(`valid fixture gave ${code}: ${good[0].message}`);
  const f = base();
  change(f);
  const bad = found(f, code, family, list);
  if (!bad.length) throw new Error(`failing fixture did not give ${code}`);
}
const scene = (f) => f['scenes/one/scene.json'];

export const tests = {
  // names: the schema checks produce these (documents.json x-hsvg-code), checked here once so the coverage is real
  'E-NAME-SHAPE and E-NAME-RESERVED come from the schema checks'() {
    const f = base();
    f['experience.json'].values.Bad_name = { type: 'number', initial: 0 };
    f['experience.json'].values.hsvg = { type: 'number', initial: 0 }; // the root of the built-ins (D22, 5.9)
    const codes = checkExperience(mapSource(f), schemas(), { only: [] }).diags.map(d => d.code);
    ok(codes.includes('E-NAME-SHAPE') && codes.includes('E-NAME-RESERVED'), codes.join());
  },

  // paths
  'portable paths: good names pass, bad ones say why'() {
    eq(badPath('scenes/one/one.svg'), null);
    eq(badPath('../shared/a.svg'), null);
    for (const bad of ['a\\b.svg', '/a.svg', 'https://x/a.svg', 'C:/a.svg', './a.svg', 'a/./b.svg', 'a b.svg', 'con.svg', 'NUL', 'a.', 'a//b']) ok(badPath(bad), bad);
  },
  'E-PATH: a backslash, a URL, a path out of the folder'() {
    pair('E-PATH', 'paths', f => { scene(f).drawing = 'scenes\\one.svg'; });
    pair('E-PATH', 'paths', f => { f['experience.json'].resources.bell.file = 'https://example.com/bell.wav'; });
    pair('E-PATH', 'paths', f => { scene(f).drawing = '../../../one.svg'; });
  },
  'E-PATH: a Windows device name, and two paths that differ only by case'() {
    pair('E-PATH', 'paths', f => { f['experience.json'].resources.bell.file = 'sounds/con.wav'; });
    pair('E-PATH', 'paths', f => { f['experience.json'].resources.bell2 = { kind: 'sound', file: 'sounds/Bell.wav', digest: `sha256:${'3'.repeat(64)}` }; });
  },
  'E-DRAWING-OWNER: two documents name one drawing'() {
    pair('E-DRAWING-OWNER', 'paths', f => {
      f['experience.json'].blocks.badge2 = 'blocks/badge2/component.json';
      f['blocks/badge2/component.json'] = { format: 'hsvg/2.0', kind: 'component', id: 'badge2', drawing: '../badge/badge.svg' };
    });
  },
  'W-FILE-UNUSED: a listed file that nothing names'() {
    pair('W-FILE-UNUSED', 'paths', f => { f['notes/extra.txt'] = 'x'; }, true);
  },

  // drawing rules
  'E-A11Y-OWNED: an authored role, tabindex or aria attribute'() {
    pair('E-A11Y-OWNED', 'drawingRules', f => { f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('<rect id="go"', '<rect id="go" role="button"'); });
    pair('E-A11Y-OWNED', 'drawingRules', f => { f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('<rect id="go"', '<rect id="go" aria-label="x"'); });
  },
  'W-A11Y-TITLE: a drawing with no root title'() {
    pair('W-A11Y-TITLE', 'drawingRules', f => { f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('<title>t</title>', ''); });
  },
  'E-A11Y-NAME: a control with no label, no target label and no text'() {
    pair('E-A11Y-NAME', 'drawingRules', f => { delete scene(f).controls.go.label; });
    // a target label gives the name
    const f = base();
    delete scene(f).controls.go.label;
    f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('<rect id="go"', '<rect id="go" data-hsvg-label="Go"');
    eq(found(f, 'E-A11Y-NAME', 'drawingRules').length, 0);
  },
  'W-ROLE-UNKNOWN: a role word in no registry'() {
    pair('W-ROLE-UNKNOWN', 'drawingRules', f => { f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('<rect id="go"', '<rect id="go" data-hsvg-role="wheel"'); });
    const f = base();
    f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('<rect id="go"', '<rect id="go" data-hsvg-role="mouth"');
    eq(found(f, 'W-ROLE-UNKNOWN', 'drawingRules').length, 0);
  },
  'experience roles (6.3): a listed word does not warn; redefining a core role is E-ROLE-KIT'() {
    const withRoles = (roles) => (f) => {
      f['experience.json'].roles = roles;
      f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('<rect id="go"', '<rect id="go" data-hsvg-role="wheel"');
    };
    let f = base(); withRoles({ wheel: { appliesTo: ['part'] } })(f);
    eq(found(f, 'W-ROLE-UNKNOWN', 'drawingRules').length, 0);
    eq(found(f, 'E-ROLE-KIT', 'drawingRules').length, 0);
    f = base(); withRoles({ hub: { aliases: ['wheel'], appliesTo: ['part'] } })(f);
    eq(found(f, 'W-ROLE-UNKNOWN', 'drawingRules').length, 0, 'an alias counts');
    f = base(); withRoles({ mouth: { appliesTo: ['part'] }, wheel: { aliases: ['cta'] } })(f);
    eq(found(f, 'E-ROLE-KIT', 'drawingRules').length, 2);
  },

  // structure
  'E-KEY-CONFLICT: a link with two triggers, or `to` and `return`, or a layout with size and shape'() {
    pair('E-KEY-CONFLICT', 'structure', f => { f['experience.json'].story.links = [{ id: 'l', from: 'one', to: 'one', on: 'go', afterMs: 100 }]; });
    pair('E-KEY-CONFLICT', 'structure', f => { f['experience.json'].story.links = [{ id: 'l', from: 'one', to: 'one', return: true, on: 'go' }]; });
    pair('E-KEY-CONFLICT', 'structure', f => { scene(f).layouts = [{ id: 'row', size: '100x100', shape: 'wide', drawing: 'one.svg' }]; });
  },
  'E-REPEAT-NESTED: a repeated use of a block that holds a repeated use'() {
    pair('E-REPEAT-NESTED', 'structure', f => {
      f['experience.json'].blocks.row = 'blocks/row/component.json';
      f['blocks/row/component.json'] = { format: 'hsvg/2.0', kind: 'component', id: 'row', uses: [{ id: 'cell', use: 'badge', into: 'cells', items: 'data.rows', key: 'id' }] };
      scene(f).uses.push({ id: 'rows', use: 'row', into: 'badge-spot', items: 'data.rows', key: 'id' });
    });
  },
  'E-WAIVER-REASON: a waiver with no reason, or an empty one'() {
    pair('E-WAIVER-REASON', 'structure', f => { scene(f).waivers = [{ rule: 'pack/rule', by: 'author' }]; });
    pair('E-WAIVER-REASON', 'structure', f => { scene(f).waivers = [{ rule: 'pack/rule', by: 'author', reason: '  ' }]; });
    const f = base(); scene(f).waivers = [{ rule: 'pack/rule', by: 'author', reason: 'the photo is full bleed' }];
    eq(found(f, 'E-WAIVER-REASON', 'structure').length, 0);
  },
  'W-WORDS-MISSING and E-WORDS-PATH: translations'() {
    const add = (f, csv) => {
      f['experience.json'].resources['words-fr'] = { kind: 'words', file: 'words/fr.csv', language: 'fr', digest: `sha256:${'4'.repeat(64)}` };
      f['words/fr.csv'] = csv;
    };
    pair('W-WORDS-MISSING', 'structure', f => add(f, 'id,text\n'));
    pair('E-WORDS-PATH', 'structure', f => { f['words/en.csv'] = 'id,text\ngo,Go {{ score }}\n'; add(f, 'id,text\ngo,Va {{ lives }}\n'); });
    const f = base(); f['words/en.csv'] = 'id,text\ngo,Go {{ score }}\n'; add(f, 'id,text\ngo,Va {{ score }}\n');
    eq(found(f, 'E-WORDS-PATH', 'structure').length + found(f, 'W-WORDS-MISSING', 'structure').length, 0);
  },

  // packages and hook marks
  'E-PACKAGE-MEMBER and E-PACKAGE-DIGEST: checkPackage'() {
    const sha = (s) => `sha256:${crypto.createHash('sha256').update(s).digest('hex')}`;
    const files = { 'experience.json': '{}', 'a.svg': '<svg/>' };
    const pkg = { members: { 'experience.json': sha('{}'), 'a.svg': sha('<svg/>') } };
    eq(checkPackage(pkg, files), []);
    eq(checkPackage({ members: { 'experience.json': sha('{}') } }, files).map(d => d.code), ['E-PACKAGE-MEMBER']); // extra file
    eq(checkPackage(pkg, { 'experience.json': '{}' }).map(d => d.code), ['E-PACKAGE-MEMBER']); // missing file
    eq(checkPackage(pkg, { ...files, 'a.svg': '<svg />' }).map(d => d.code), ['E-PACKAGE-DIGEST']);
  },
  'E-PACKAGE-MEMBER: the family reads package.json beside the files'() {
    const sha = (s) => `sha256:${crypto.createHash('sha256').update(s).digest('hex')}`;
    const f = base();
    f['package.json'] = { format: 'hsvg/2.0', kind: 'package', id: 'tiny', experience: 'experience.json', members: {} };
    for (const k of Object.keys(f)) if (k !== 'package.json') f['package.json'].members[k] = sha(typeof f[k] === 'string' ? f[k] : JSON.stringify(f[k]));
    eq(found(f, 'E-PACKAGE-MEMBER', 'packages', true).length + found(f, 'E-PACKAGE-DIGEST', 'packages', true).length, 0);
    f['extra.txt'] = 'x';
    eq(found(f, 'E-PACKAGE-MEMBER', 'packages', true).length, 1);
  },
  'E-HOOK-MARK: the page linter'() {
    eq(lintHooks('<div data-hsvg-hook="surface:site-header target:signup"></div>'), []);
    eq(lintHooks('<div data-hsvg-hook="surface:Site_Header"></div>').length, 1);
    eq(lintHooks('<div data-hsvg-hook="dock:x"></div>').length, 1);
    eq(lintHooks('<div data-hsvg-hook=""></div>').length, 1);
  },
};

Object.assign(tests, {
  'E-COLOR-ROLE: empty, unknown paint, repeated paint, mixed forms'() {
    const mark = (v) => (f) => { f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('<rect id="go"', `<rect id="go" data-hsvg-color="${v}"`); };
    for (const bad of ['', 'edge:ink', 'fill:ink fill:accent', 'accent stroke:ink', 'accent ink']) pair('E-COLOR-ROLE', 'drawingRules', mark(bad));
    for (const good of ['accent', 'fill:surface stroke:ink', 'stroke:ink fill:surface']) { const f = base(); mark(good)(f); eq(found(f, 'E-COLOR-ROLE', 'drawingRules').length, 0, good); }
  },
  'W-COLOR-ROLE-THEME: a role outside the core, checked alone'() {
    pair('W-COLOR-ROLE-THEME', 'drawingRules', f => { f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('<rect id="go"', '<rect id="go" data-hsvg-color="brand-blue"'); });
    pair('W-COLOR-ROLE-THEME', 'drawingRules', f => { f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('<rect id="go"', '<rect id="go" data-hsvg-text-style="mono"'); });
  },
  'E-PROMOTE: a promoted name that collides, or is also given in with'() {
    pair('E-PROMOTE', 'structure', f => { scene(f).promote = [{ from: 'badge/title', as: 'level' }]; f['experience.json'].inputs.level = { kind: 'knob', type: 'number', minimum: 0, maximum: 3, initial: 1 }; scene(f).inputs = { level: { kind: 'knob', type: 'number', minimum: 0, maximum: 3, initial: 1 } }; });
    pair('E-PROMOTE', 'structure', f => { scene(f).promote = [{ from: 'badge/title' }, { from: 'badge/celebrate', as: 'title' }]; });
    pair('E-PROMOTE', 'structure', f => { scene(f).promote = [{ from: 'badge/title' }]; });
    const f = base(); scene(f).promote = [{ from: 'badge/celebrate' }];
    eq(found(f, 'E-PROMOTE', 'structure').length, 0);
  },
  'E-PRIVATE-LEAK: a resource with a private licence'() {
    pair('E-PRIVATE-LEAK', 'structure', f => { f['experience.json'].resources.bell.license = 'LicenseRef-Private-ref'; });
    const f = base(); f['experience.json'].resources.bell.license = 'CC0-1.0';
    eq(found(f, 'E-PRIVATE-LEAK', 'structure').length, 0);
  },
});
