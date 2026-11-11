// The checker's counted limits per block (5.2, 6.9, A1) and budget rules with a host profile (A10.3). No browser.
import { checkExperience } from '../check/index.mjs';
import { schemas, eq, ok, mapSource } from './helpers.mjs';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" data-hsvg-version="2.0" data-hsvg-kind="screen"><rect id="bg" width="10" height="10" fill="#fff" data-hsvg-layer="decoration"/></svg>';
const files = (extra = {}, scene = {}, more = {}) => ({
  'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'x', about: { title: 'X' }, needs: [], story: { start: 'a', scenes: { a: 'scenes/a/scene.json' }, ends: ['a'] }, ...extra },
  'scenes/a/scene.json': { format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg', ...scene },
  'scenes/a/a.svg': svg,
  ...more,
});
const withBytes = (map, bytes) => ({ ...mapSource(map), bytes: (rel) => bytes[rel] ?? null });
const run = (src, opts = {}) => checkExperience(src, schemas(), { only: ['budgets'], ...opts });
const codes = (r) => r.diags.map(d => [d.code, d.file]);
const ranges = (r) => r.diags.filter(d => d.code === 'E-RANGE').map(d => [d.code, d.file]); // other schema findings aside
const DIGEST = `sha256:${'0'.repeat(64)}`;

export const tests = {
  'computedPerBlock: more computed values in one block than the limit is E-RANGE (5.2)'() {
    const computed = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`c${i}`, `${i}`]));
    eq(codes(run(mapSource(files({}, { computed: computed(256) })))), []);
    eq(codes(run(mapSource(files({}, { computed: computed(257) })))), [['E-RANGE', 'scenes/a/scene.json']]);
  },
  'attachActionsPerBlock: more player.attach calls in one block than the limit is E-RANGE (6.9)'() {
    const acts = (n) => Array.from({ length: n }, (_, i) => (i % 2 ? { id: `d${i}`, call: 'player.attach', with: {part: "'hat'", to: 'null'} } : { id: `a${i}`, call: 'player.attach', with: {part: "'hat'", to: "'head'"} }));
    eq(codes(run(mapSource(files({}, { entry: acts(256) })))), []);
    eq(codes(run(mapSource(files({}, { entry: acts(200), on: { tap: [{ id: 't', actions: acts(57) }] } })))), [['E-RANGE', 'scenes/a/scene.json']]);
  },
  'effectsPerBlock: more effects in one block than the limit is E-RANGE (A1)'() {
    // addons.effects.particles (D31): its schema caps the map at effectsPerBlock.
    const fx = { target: 'sky', source: 'dot', seed: 1, reducedMotion: 'rest' };
    const effects = (n) => ({ effects: { particles: Object.fromEntries(Array.from({ length: n }, (_, i) => [`e${i}`, fx])) } });
    const over = (n) => run(mapSource(files({ needs: ['effects'] }, { addons: effects(n) }))).diags.filter(d => /effectsPerBlock|maxProperties|at most 16|over 16/.test(d.message) || (d.code === 'E-RANGE' && d.path?.includes('particles')));
    eq(over(16), []);
    ok(over(17).length > 0, 'over the limit');
  },
  'budget rules: measured on the resource bytes; "host" without a host value is not-run; a broken must rule is E-RULE (A10.3)'() {
    const res = { resources: { beep: { kind: 'sound', file: 'beep.wav', digest: DIGEST } }, rules: [
      { id: 'sound-weight', kind: 'budget', measure: 'soundBytes', maximum: 'host' },
      { id: 'sound-cap', kind: 'budget', measure: 'soundBytes', maximum: 50, strength: 'should' },
      { id: 'length', kind: 'budget', measure: 'lengthMs', maximum: 15000 },
    ] };
    const src = withBytes(files(res), { 'beep.wav': new Uint8Array(100) });
    const plain = run(src);
    eq(plain.budgets.map(b => [b.id, b.status]), [['sound-weight', 'not-run'], ['sound-cap', 'fail'], ['length', 'not-run']]);
    eq(codes(plain), [], 'a should budget is reported, not an error');
    const host = { format: 'hsvg/2.0', kind: 'host-profile', id: 'h', budgets: { soundBytes: 80 }, rules: [{ id: 'host-weight', kind: 'budget', measure: 'soundBytes', maximum: 'host' }] };
    const hosted = run(src, { host });
    eq(hosted.budgets.map(b => [b.id, b.maximum, b.measured, b.status]), [['sound-weight', 80, 100, 'fail'], ['sound-cap', 50, 100, 'fail'], ['length', 15000, null, 'not-run'], ['host-weight', 80, 100, 'fail']]);
    eq(codes(hosted), [['E-RULE', 'experience.json'], ['E-RULE', 'host-profile']]);
    ok(run(src, { host: { ...host, budgets: { soundBytes: 100 } } }).diags.length === 0);
  },
  'a host profile given to the checker is checked: retention, budgets, rules'() {
    const host = { format: 'hsvg/2.0', kind: 'host-profile', id: 'h', retention: 0, budgets: { bogus: 1 } };
    eq(run(mapSource(files()), { host }).diags.map(d => [d.code, d.path]), [['E-RANGE', 'retention'], ['E-RULE', 'budgets.bogus']]);
  },
};
