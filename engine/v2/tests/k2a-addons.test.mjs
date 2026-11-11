// Add-on words in JSON (D34) and needs for a known add-on. Fixtures are made from the toss recipe
// (skill/2.0/examples/recipes/toss), which uses the physics add-on.
import { checkExperience } from '../check/index.mjs';
import { folderSource } from '../src/load.mjs';
import { repo, schemas, eq, ok } from './helpers.mjs';
import path from 'node:path';

const dir = path.join(repo, 'skill', '2.0', 'examples', 'recipes', 'toss');
const folder = await folderSource(dir);
// Checks toss after edit(experience, play scene); returns the findings as [code, path, message].
const run = (edit = () => {}) => {
  const e = JSON.parse(folder.read('experience.json')); const s = JSON.parse(folder.read('scenes/play/scene.json'));
  edit(e, s);
  const files = { 'experience.json': JSON.stringify(e), 'scenes/play/scene.json': JSON.stringify(s) };
  const source = { ...folder, read: (p) => files[p] ?? folder.read(p) };
  return checkExperience(source, schemas()).diags.map(d => [d.code, d.path, d.message]);
};
const codes = (r) => r.map(([c, p]) => `${c} ${p}`);

export const tests = {
  'toss checks clean'() { eq(run(), []); },
  // D39 opened these slots: a dotted kind or channel is now an add-on's, when its manifest declares it (k2d-doors).
  'D34, D39: a control kind an add-on does not declare is one E-ADDON that names the six kinds'() {
    const r = run((e, s) => { s.controls.spring = { kind: 'physics.spring', target: 'ball', label: 'Spring' }; });
    eq(codes(r), ['E-ADDON controls.spring.kind']);
    ok(r[0][2].includes('physics adds no control kind') && r[0][2].includes('button, toggle, choice, slider, dial or drag'), r[0][2]);
  },
  'D34, D39: a channel an add-on does not declare (a formula under an add-on name) is one E-ADDON'() {
    const r = run((e, s) => { s.bindings.push({ target: 'ball', 'physics.spin': 'speed' }); });
    const i = JSON.parse(folder.read('scenes/play/scene.json')).bindings.length;
    eq(codes(r), [`E-ADDON bindings[${i}].physics.spin`]);
    ok(r[0][2].includes('physics adds no channel'), r[0][2]);
  },
  'D34, D39: a clip channel an add-on does not declare is one E-ADDON; motion.morph is the motion add-on\'s channel'() {
    const r = run((e, s) => { s.clips = { ...(s.clips || {}), spin: { durationMs: 500, tracks: [{ target: 'ball', channel: 'physics.spin', keys: [[0, 0], [500, 1]] }] } }; });
    eq(codes(r), ['E-ADDON clips.spin.tracks[0].channel']);
    ok(r[0][2].includes('physics adds no channel') && r[0][2].includes('motion.morph'), r[0][2]);
  },
  'a call of an add-on asks for the add-on in needs'() {
    const r = run((e) => { e.needs = e.needs.filter(n => n !== 'physics'); });
    ok(r.length > 0 && r.every(([c]) => c === 'E-NEEDS-MISSING'), JSON.stringify(r));
    ok(r.some(([, , m]) => m.startsWith('call physics.throw belongs to the capability physics')), JSON.stringify(r));
  },
};
