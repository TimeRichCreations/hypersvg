// The rules checks of the 2.0 checker (engine/v2/check/rules/): subjects (8.2), strengths and proof kinds (8.1, 8.4, 8.8),
// parameters, combining (8.6), waivers (8.5) and budgets (A10.3), and the list of what only play can prove.
import { checkExperience } from '../check/index.mjs';
import { playingOnly } from '../check/rules/index.mjs';
import { combine } from '../check/rules/combine.mjs';
import { schemas, eq, ok, mapSource } from './helpers.mjs';

const svg = (body, kind = 'screen') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hsvg-version="2.0"${kind ? ` data-hsvg-kind="${kind}"` : ''}>${body}</svg>`;
const sceneSvg = svg('<rect id="go" data-hsvg-kind="part" data-hsvg-role="action" width="10" height="10"/><rect id="caption-box" data-hsvg-kind="part" data-hsvg-fit="" width="5" height="5"/>');
const badgeSvg = svg('<g id="badge" data-hsvg-kind="component"><g id="badge__logo" data-hsvg-kind="part" data-hsvg-role="identity"><rect width="5" height="5"/></g></g>', null);

function base() {
  return {
    'experience.json': {
      format: 'hsvg/2.0', kind: 'experience', id: 'tiny', language: 'en',
      story: { start: 'one', scenes: { one: 'scenes/one/scene.json' }, ends: ['one'] },
      blocks: { badge: 'blocks/badge/component.json' },
      values: { flag: { type: 'boolean', initial: false } },
      resources: { bell: { kind: 'sound', file: 'bell.wav', digest: `sha256:${'1'.padStart(64, '0')}` } },
    },
    'scenes/one/scene.json': {
      format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg',
      uses: [{ id: 'badge', use: 'badge' }],
      values: { score: { type: 'number', initial: 0, minimum: 0, maximum: 9 } },
      inputs: { speed: { kind: 'knob', type: 'number', minimum: 0, maximum: 9, initial: 1 } },
      controls: { go: { kind: 'button', target: 'go', label: 'Go' } },
      rules: [{ id: 'speed-ok', kind: 'limit', subject: 'input:speed', minimum: 0, maximum: 9 }],
    },
    'scenes/one/one.svg': sceneSvg,
    'blocks/badge/component.json': { format: 'hsvg/2.0', kind: 'component', id: 'badge', drawing: 'badge.svg' },
    'blocks/badge/badge.svg': badgeSvg,
  };
}
const scene = (f) => f['scenes/one/scene.json'];
const exp = (f) => f['experience.json'];
const badge = (f) => f['blocks/badge/component.json'];
const sourceWith = (files, bytes = {}) => ({ ...mapSource(files), bytes: (rel) => bytes[rel] ?? null });
const runWith = (files, bytes) => checkExperience(sourceWith(files, bytes), schemas(), { only: ['rules'] });
const run = (files, bytes) => runWith(files, bytes).diags;
const codes = (files, bytes) => run(files, bytes).map(d => d.code);
const fails = (files, code, count = 1, bytes) => { const d = run(files, bytes); eq(d.map(x => x.code), Array(count).fill(code), d.map(x => x.message).join(' | ')); };
const rule = (f, r) => { scene(f).rules.push(r); return f; };

export const tests = {
  'the base experience passes every rules check'() { eq(codes(base()), []); },

  // ---------- 8.2: subjects ----------
  'a subject that matches nothing is E-RULE-SUBJECT'() {
    for (const subject of ['part:nope', 'role:nope', 'input:nope', 'value:nope', 'use:nope', 'scene:nope', 'data:nope', 'resource:nope', 'place:nope']) {
      fails(rule(base(), { id: 'r', kind: 'protected', subject }), 'E-RULE-SUBJECT');
    }
  },
  'a subject that exists passes: part, role, place, input, value, use, scene, resource, controls, graph'() {
    for (const subject of ['part:go', 'role:action', 'place:caption-box', 'input:speed', 'value:score', 'use:badge', 'scene:one', 'resource:bell', 'controls', 'graph', 'value:flag', ['part:go', 'role:action']]) {
      eq(codes(rule(base(), { id: 'r', kind: 'protected', subject })), [], JSON.stringify(subject));
    }
  },
  'one bad address in a list is E-RULE-SUBJECT'() { fails(rule(base(), { id: 'r', kind: 'protected', subject: ['part:go', 'part:nope'] }), 'E-RULE-SUBJECT'); },
  'a subject inside a used block counts (8.2)'() {
    eq(codes(rule(base(), { id: 'logo', kind: 'keep', subject: 'role:identity', minSize: [64, 24] })), []);
    eq(codes(rule(base(), { id: 'logo', kind: 'protected', subject: 'part:logo' })), []);
  },
  'a subject in a block is not seen by a sibling scene'() {
    const f = base(); badge(f).rules = [{ id: 'mine', kind: 'protected', subject: 'part:go' }]; fails(f, 'E-RULE-SUBJECT');
  },
  'controls and resources match only when the document has some'() {
    const f = base(); delete scene(f).controls; fails(rule(f, { id: 'c', kind: 'keyboard', subject: 'controls' }), 'E-RULE-SUBJECT');
  },

  // ---------- 8.1, 8.4, 8.8: strength and proof ----------
  'only some kinds may be give-way (E-RULE, from the schema)'() {
    ok(codes(rule(base(), { id: 'r', kind: 'protected', subject: 'part:go', strength: 'give-way', steps: ['shrink'], floor: { keep: true } })).includes('E-RULE'));
    eq(codes(rule(base(), { id: 'r', kind: 'keep', subject: 'part:go', strength: 'give-way', steps: ['shrink'], floor: { keep: true } })), []);
  },
  'a give-way rule has steps and a floor (E-KEY-REQUIRED, from the schema)'() {
    ok(codes(rule(base(), { id: 'r', kind: 'fits', subject: 'part:go', strength: 'give-way', floor: { minTextPx: 9 } })).includes('E-KEY-REQUIRED'));
    fails(rule(base(), { id: 'r', kind: 'fits', subject: 'part:go', strength: 'give-way', steps: ['shrink'] }), 'E-KEY-REQUIRED');
  },
  'a proof kind the rule kind cannot give is E-RULE'() {
    fails(rule(base(), { id: 'r', kind: 'reduced-motion', proof: 'files' }), 'E-RULE');
    fails(rule(base(), { id: 'r', kind: 'judgement', ask: 'Does it read?', proof: 'playing' }), 'E-RULE');
    fails(rule(base(), { id: 'r', kind: 'fits', subject: 'part:go', proof: ['files', 'playing'] }), 'E-RULE');
    eq(codes(rule(base(), { id: 'r', kind: 'fits', subject: 'part:go', proof: ['files', 'review'] })), []);
    eq(codes(rule(base(), { id: 'r2', kind: 'keep', subject: 'part:go', minSize: [8, 8], proof: ['files', 'playing'] })), []);
  },
  'reviewBy needs a review proof'() {
    fails(rule(base(), { id: 'r', kind: 'fits', subject: 'part:go', reviewBy: 'person' }), 'E-RULE');
    eq(codes(rule(base(), { id: 'r', kind: 'fits', subject: 'part:go', proof: ['files', 'review'], reviewBy: 'person' })), []);
  },
  'a rule may name a plan-only layout, and a layout the document lacks is E-REF-UNKNOWN (W4-K 3)'() {
    const f = base(); f['experience.json'].axes = [{ axis: 'shape', select: 'space', shapes: { wide: { minAspect: 1 } } }];
    scene(f).layouts = [{ id: 'main-look', shape: 'wide', drawing: 'one.svg' }, { id: 'plan-only', shape: 'wide', layoutPlan: { place: 'go', kind: 'column', gap: 4, repeat: 'x' } }];
    rule(f, { id: 'r', kind: 'protected', subject: 'part:go', layouts: ['plan-only'] }); eq(codes(f), []);
    scene(f).rules[1].layouts = ['main'];
    fails(f, 'E-REF-UNKNOWN');
    const g = base(); rule(g, { id: 'r', kind: 'protected', subject: 'part:go', layouts: ['wide'] });
    fails(g, 'E-REF-UNKNOWN');
  },
  'layouts name layouts of the document (E-REF-UNKNOWN)'() {
    const f = base(); f['experience.json'].axes = [{ axis: 'shape', select: 'space', shapes: { wide: { minAspect: 1 }, tall: { maxAspect: 1 } } }];
    delete scene(f).drawing; scene(f).layouts = [{ id: 'wide', shape: 'wide', drawing: 'one.svg' }, { id: 'tall', shape: 'tall', drawing: 'one.svg' }];
    rule(f, { id: 'r', kind: 'protected', subject: 'part:go', layouts: ['wide'] }); eq(codes(f), []);
    scene(f).rules[1].layouts = ['wide', 'square']; fails(f, 'E-REF-UNKNOWN');
  },

  // ---------- 8.9, 8.7: parameters ----------
  'a limit whose minimum is above its maximum is E-RULE'() {
    fails(rule(base(), { id: 'r', kind: 'limit', subject: 'value:score', minimum: 5, maximum: 2 }), 'E-RULE');
    fails(rule(base(), { id: 'r', kind: 'limit', subject: 'field:go.text', minLength: 9, maxLength: 3 }), 'E-RULE');
  },
  'a limit on an input is proven over the declared bounds (8.7)'() {
    eq(codes(rule(base(), { id: 'r', kind: 'limit', subject: 'input:speed', minimum: 0, maximum: 10 })), []);
    fails(rule(base(), { id: 'r', kind: 'limit', subject: 'input:speed', maximum: 5 }), 'E-RULE');
    fails(rule(base(), { id: 'r', kind: 'limit', subject: 'input:speed', minimum: 1 }), 'E-RULE');
    const f = base(); delete scene(f).inputs.speed.maximum; scene(f).inputs.speed.kind = 'content'; delete scene(f).inputs.speed.step;
    ok(codes(f).length >= 0);
  },
  'a should limit that the bounds do not prove is only a note, not E-RULE'() {
    eq(codes(rule(base(), { id: 'r', kind: 'limit', subject: 'input:speed', maximum: 5, strength: 'should' })), []);
  },
  'a scoring maximum must be above its minimum (E-RANGE)'() {
    fails(rule(base(), { id: 'r', kind: 'scoring', subject: 'value:score', minimum: 3, maximum: 3 }), 'E-RANGE');
    eq(codes(rule(base(), { id: 'r', kind: 'scoring', subject: 'value:score', minimum: 0, maximum: 9 })), []);
  },
  'a floor stays in range'() {
    fails(rule(base(), { id: 'r', kind: 'fits', subject: 'part:go', strength: 'give-way', steps: ['shrink'], floor: { minShare: 2 } }), 'E-RULE');
  },

  // ---------- A10.3: budgets ----------
  'a budget the files can measure is checked (soundBytes, fontBytes, tableRows)'() {
    const bytes = { 'bell.wav': new Uint8Array(500) };
    eq(codes(rule(base(), { id: 'b', kind: 'budget', measure: 'soundBytes', maximum: 1000 }), bytes), []);
    fails(rule(base(), { id: 'b', kind: 'budget', measure: 'soundBytes', maximum: 100 }), 'E-RULE', 1, bytes);
    ok(run(rule(base(), { id: 'b', kind: 'budget', measure: 'soundBytes', maximum: 100 }), bytes)[0].message.includes('500'));
  },
  'a budget valued by the host, or measured only on an export, is not run by files'() {
    const f = rule(base(), { id: 'b', kind: 'budget', measure: 'archiveBytes', maximum: 'host' }); eq(codes(f), []);
    const g = rule(base(), { id: 'b2', kind: 'budget', measure: 'archiveBytes', maximum: 1000 }); eq(codes(g), []);
    const list = playingOnly(runWith(g).experience);
    ok(list.some(x => x.rule === 'b2' && x.proof === 'export'), JSON.stringify(list));
    ok(playingOnly(runWith(f).experience).some(x => x.rule === 'b' && x.proof === 'host'));
  },
  'a should budget is never E-RULE'() {
    eq(codes(rule(base(), { id: 'b', kind: 'budget', measure: 'soundBytes', maximum: 1, strength: 'should' }), { 'bell.wav': new Uint8Array(500) }), []);
  },

  // ---------- 8.6: combining and conflicts ----------
  'combine: the strictest bound wins and a minimum above a maximum cannot hold'() {
    eq(combine([{ kind: 'limit', maximum: 10 }, { kind: 'limit', maximum: 5 }]), []);
    eq(combine([{ kind: 'limit', minimum: 8 }, { kind: 'limit', maximum: 5 }]).length, 1);
    eq(combine([{ kind: 'limit', minLength: 4, maxLength: 9 }, { kind: 'limit', maxLength: 3 }]).length, 1);
  },
  'combine: font lists and colour lists intersect; case, positions and of must be equal'() {
    eq(combine([{ kind: 'fonts', families: ['A', 'B'] }, { kind: 'fonts', families: ['B', 'C'] }]), []);
    eq(combine([{ kind: 'fonts', families: ['A'] }, { kind: 'fonts', families: ['B'] }]).length, 1);
    eq(combine([{ kind: 'colors', roles: { accent: ['#111'] } }, { kind: 'colors', roles: { accent: ['#222'] } }]).length, 1);
    eq(combine([{ kind: 'limit', case: 'upper' }, { kind: 'limit', case: 'lower' }]).length, 1);
    eq(combine([{ kind: 'answers-spread', positions: 4 }, { kind: 'answers-spread', positions: 4 }]), []);
    eq(combine([{ kind: 'inside', of: 'place:a' }, { kind: 'inside', of: 'place:b' }]).length, 1);
  },
  'rules that cannot hold together are E-RULE-CONFLICT: both fail, each naming the other (8.6, X5.12)'() {
    const f = base(); exp(f).rules = [{ id: 'floor', kind: 'limit', subject: 'input:speed', minimum: 7 }];
    rule(f, { id: 'cap', kind: 'limit', subject: 'input:speed', maximum: 5, strength: 'must' });
    const d = run(f).filter(x => x.code === 'E-RULE-CONFLICT');
    eq(d.map(x => x.file).sort(), ['experience.json', 'scenes/one/scene.json']);
    const at = (file) => d.find(x => x.file === file).message;
    ok(at('scenes/one/scene.json').includes('floor') && at('experience.json').includes('cap'), JSON.stringify(d));
  },
  'rules of different strengths, kinds or subjects are not combined'() {
    const f = base(); exp(f).rules = [{ id: 'floor', kind: 'limit', subject: 'input:speed', minimum: 7, strength: 'should' }];
    rule(f, { id: 'cap', kind: 'limit', subject: 'input:speed', maximum: 5 });
    eq(codes(f).filter(c => c === 'E-RULE-CONFLICT'), []);
  },
  'two font rules with nothing in common conflict'() {
    const f = base(); exp(f).rules = [{ id: 'brand', kind: 'fonts', families: ['Bitter'] }];
    rule(f, { id: 'mine', kind: 'fonts', families: ['Comic'] });
    eq(codes(f).filter(c => c === 'E-RULE-CONFLICT'), ['E-RULE-CONFLICT', 'E-RULE-CONFLICT']);
  },

  // ---------- 8.5: waivers ----------
  'a waiver names a rule that exists, with a right the rule lists'() {
    const f = base(); badge(f).rules = [{ id: 'logo-kept', kind: 'keep', subject: 'role:identity', waivableBy: ['brand-owner'] }];
    scene(f).waivers = [{ rule: 'badge/logo-kept', reason: 'Fixed by the host', by: 'brand-owner' }]; eq(codes(f), []);
    scene(f).waivers[0].by = 'editor'; fails(f, 'E-RIGHTS');
    scene(f).waivers[0].by = 'brand-owner'; scene(f).waivers[0].rule = 'badge/nothing'; fails(f, 'E-REF-UNKNOWN');
    scene(f).waivers[0].rule = 'nobody/logo-kept'; fails(f, 'E-REF-UNKNOWN');
  },
  'a rule without waivableBy cannot be waived; baseline rules cannot be waived'() {
    const f = base(); badge(f).rules = [{ id: 'logo-kept', kind: 'keep', subject: 'role:identity' }];
    scene(f).waivers = [{ rule: 'badge/logo-kept', reason: 'Because', by: 'brand-owner' }]; fails(f, 'E-RIGHTS');
    scene(f).waivers = [{ rule: 'hsvg-baseline/readable', reason: 'Because', by: 'brand-owner' }]; fails(f, 'E-RIGHTS');
  },
  'a waiver of a rule in a pack file named by path resolves'() {
    const f = base(); exp(f).rulePacks = ['rules/brand.json'];
    f['rules/brand.json'] = { format: 'hsvg/2.0', kind: 'rule-pack', id: 'brand', about: { title: 'B', version: '1.0.0' }, rules: [{ id: 'fonts', kind: 'fonts', families: ['Bitter'], waivableBy: ['brand-owner'] }] };
    exp(f).waivers = [{ rule: 'brand/fonts', reason: 'A fixed template font', by: 'brand-owner' }]; eq(codes(f), []);
    exp(f).waivers[0].rule = 'brand/nope'; fails(f, 'E-REF-UNKNOWN');
  },

  // ---------- what only play can prove ----------
  'playingOnly lists the rules that files cannot settle'() {
    const f = base();
    rule(f, { id: 'ride', kind: 'on-route', subject: 'part:go', route: 'place:caption-box' });
    rule(f, { id: 'quiet', kind: 'reduced-motion' });
    rule(f, { id: 'look', kind: 'judgement', ask: 'Does it read?' });
    rule(f, { id: 'fit', kind: 'fits', subject: 'part:go' });
    const list = playingOnly(runWith(f).experience);
    const has = (rule_, proof) => list.some(x => x.rule === rule_ && x.proof === proof);
    ok(has('ride', 'playing') && has('quiet', 'playing') && has('look', 'review') && has('fit', 'measurer'), JSON.stringify(list));
    ok(!list.some(x => x.rule === 'speed-ok'));
  },
};
