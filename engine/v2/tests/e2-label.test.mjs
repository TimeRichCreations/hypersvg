// W-LABEL-HAS-VALUE. A slider's (or angle slider's) `label` that reads its own `value`, directly or
// through a computed value, is heard twice: as the name and as the value (5.11). On tests/e2-fixture (a line slider
// "lev" on `level`, an angle slider "knob" on `turn`).
import path from 'node:path';
import { folderSource } from '../src/load.mjs';
import { checkExperience } from '../check/index.mjs';
import { repo, schemas, eq, ok } from './helpers.mjs';

const FIXTURE = path.join(repo, 'engine', 'v2', 'tests', 'e2-fixture');
const RELS = ['experience.json', 'scenes/one/scene.json', 'scenes/one/one.svg', 'scenes/two/scene.json', 'scenes/two/two.svg'];
async function findings(edit = () => {}) {
  const src = await folderSource(FIXTURE);
  const f = Object.fromEntries(RELS.map(r => [r, src.read(r)]));
  const scene = JSON.parse(f['scenes/one/scene.json']);
  edit(scene);
  f['scenes/one/scene.json'] = JSON.stringify(scene);
  const r = checkExperience({ read: (rel) => (rel in f ? f[rel] : null) }, schemas());
  return r.diags.map(d => `${d.code} ${d.path}`);
}
const W = (id) => `W-LABEL-HAS-VALUE /controls/${id}/label`;

export const tests = {
  async 'the fixture checks clean: a label that names the slider only'() {
    eq(await findings(), []);
  },
  async 'a slider label that reads its value: directly, through a computed value, in a call'() {
    const direct = await findings((s) => { s.controls.lev.label = 'Level, {{ level }}'; });
    eq(direct, [W('lev')]);
    const computed = await findings((s) => { s.computed = { shown: 'numberText(level, 0)', said: "shown + ' steps'" }; s.controls.lev.label = 'Level, {{ said }}'; });
    eq(computed, [W('lev')], 'through two computed values');
    const angle = await findings((s) => { s.controls.knob.label = "{{ 'Knob at ' + numberText(turn * 100, 0) + ' percent' }}"; });
    eq(angle, [W('knob')], 'an angle slider');
  },
  async 'no warning: valueText reads the value, the label reads other names, a press label reads a value'() {
    eq(await findings((s) => { s.controls.lev.valueText = '{{ numberText(level, 0) }} steps'; }), []);
    eq(await findings((s) => { s.controls.lev.label = '{{ on ? "Level" : "Level (off)" }}'; s.controls.knob.label = 'Knob {{ taps }}'; }), []);
    eq(await findings((s) => { s.controls.act.label = 'Act at level {{ level }}'; }), []);
    eq(await findings((s) => { s.computed = { other: 'taps + 1' }; s.controls.lev.label = 'Level {{ other }}'; }), [], 'a computed value that does not read it');
  },
  async 'the code is registered: a warning of 5.11, found in the files'() {
    const { readFileSync } = await import('node:fs');
    const reg = JSON.parse(readFileSync(path.join(repo, 'spec', '2.0', 'errors.json'), 'utf8'));
    const row = reg.codes.find(c => c.code === 'W-LABEL-HAS-VALUE');
    ok(row, 'in errors.json');
    eq([row.severity, row.where, row.proof], ['warning', ['5.11'], ['files']]);
  },
};
