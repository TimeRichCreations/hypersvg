// The checker tells the truth (R2 findings baggage 1, power 3, speed 11, architecture 5, 7, 8, 10, code 11,
// newcomer F1, F3 to F6). Each test fails on the code before the fix.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { repo, eq, ok, schemas, mapSource } from './helpers.mjs';
import { checkExperience } from '../check/index.mjs';
import { base } from './check-refs.test.mjs';
import { loadExperience } from '../src/load.mjs';
import { Player } from '../src/story.mjs';
import '../src/capabilities/all.mjs';
import { parse, evaluate } from '../src/formula.mjs';

const codesOf = (files, only) => checkExperience(mapSource(files), schemas(), only ? { only } : {}).diags.map(d => `${d.code} ${d.path ?? d.pointer ?? ''}`);

const checkTool = path.join(repo, 'engine', 'v2', 'tools', 'check.mjs');
const runCheck = (dir, ...a) => spawnSync(process.execPath, [checkTool, dir, ...a], { encoding: 'utf8' });
// A scratch copy of a folder; fn(dir) runs on it and the copy is removed after.
function onCopy(from, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-x4-'));
  try { fs.cpSync(from, dir, { recursive: true }); return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJson = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2));
const firstRun = path.join(repo, 'skill', '2.0', 'examples', 'first-run');

export const tests = {
  // ----- baggage 1: a rule kind with no evaluator is reported not-run, never passed -----
  'X4 baggage 1: fonts and colors rules with no evaluator are listed not-run by check.mjs'() {
    onCopy(firstRun, (dir) => {
      const svgFile = path.join(dir, 'scenes', 'hello', 'hello.svg');
      const svg = fs.readFileSync(svgFile, 'utf8').replace('font-family="sans-serif" font-size="28" fill="#153b4b"', 'font-family="Comic Sans MS" font-size="28" fill="#ff00ff"');
      fs.writeFileSync(svgFile, svg);
      const f = path.join(dir, 'scenes', 'hello', 'scene.json');
      const s = readJson(f);
      s.rules = [{ id: 'f1', kind: 'fonts', subject: 'part:count', families: ['Inter'] },
        { id: 'c1', kind: 'colors', subject: 'part:count', roles: { accent: ['#000000'] }, exhaustive: true }];
      writeJson(f, s);
      const plain = runCheck(dir);
      ok(/\n0 findings \{\}\n$/.test(plain.stdout) && plain.status === 0, plain.stdout); // not findings, and no failure
      ok(/NOT-RUN scenes\/hello\/scene\.json \/rules\/0: rule f1 \(fonts\) needs a files proof/.test(plain.stdout), plain.stdout);
      ok(/NOT-RUN scenes\/hello\/scene\.json \/rules\/1: rule c1 \(colors\)/.test(plain.stdout), plain.stdout);
      ok(/2 rules not-run \{"files":2\}/.test(plain.stdout), plain.stdout);
      const j = JSON.parse(runCheck(dir, '--json').stdout);
      eq(j.filter(x => x.severity === 'not-run').map(x => [x.rule, x.proof]), [['f1', 'files'], ['c1', 'files']]);
    });
  },

  // ----- power 3, speed 11: a repeated use's maxItems must fit its repeat region's slots (4.5, E-REPEAT-CAPACITY) -----
  'X4 power 3: maxItems 7 or 500 over a 6-slot repeat region is E-REPEAT-CAPACITY, 6 passes'() {
    const dash = path.join(repo, 'skill', '2.0', 'examples', 'recipes', 'live-dashboard');
    const codes = (n, plain = false) => onCopy(dash, (dir) => {
      const f = path.join(dir, 'experience.json');
      const e = readJson(f);
      e.data.readings.maxRows = n; e.inputs.readings.maxItems = n;
      if (plain) { delete e.inputs.readings.table; delete e.inputs.readings.live; delete e.inputs.readings.contentType; }
      writeJson(f, e);
      const j = JSON.parse(runCheck(dir, '--json').stdout).filter(x => x.code === 'E-REPEAT-CAPACITY');
      return j.map(x => x.message);
    });
    eq(codes(6), []);
    const seven = codes(7);
    ok(seven.length === 1 && /use hours may have 7 rows .* repeat group hours .* draws 6 slots/.test(seven[0]), JSON.stringify(seven));
    ok(codes(500).some(m => /500 rows .* more than the 256 live repeated uses/.test(m)), 'liveRepeatedUses');
    ok(codes(7, true).length === 1, 'a plain array input with maxItems 7');
  },

  // ----- architecture 5: one name is not both an input and an output (5.4) -----
  'X4 architecture 5: an input and an output of the same name is E-ID-DUPLICATE, on the experience and on a block'() {
    eq(codesOf(base()).filter(c => c.startsWith('E-ID-DUPLICATE')), []);
    const f = base();
    f['experience.json'].outputs = { level: { kind: 'result', type: 'number', value: '2' } };
    ok(codesOf(f).some(c => /^E-ID-DUPLICATE .*outputs\/level/.test(c)), JSON.stringify(codesOf(f)));
    const g = base();
    g['blocks/badge/component.json'].outputs.title = { kind: 'event' };
    ok(codesOf(g).some(c => /^E-ID-DUPLICATE .*outputs\/title/.test(c)), JSON.stringify(codesOf(g)));
  },

  // ----- architecture 7: one rule for whose needs covers a use (10.11 rule 1) -----
  'X4 architecture 7: own needs, plus the experience\'s for scenes and the shell; the checker and the engine agree'() {
    const pop = { target: 'go', source: 'go', seed: 1, count: 2, position: [1, 1], start: 'play', reducedMotion: 'rest' }; // addons.effects.particles (D31)
    const fx = { effects: { particles: { pop } } };
    const scene = (f) => f['scenes/one/scene.json'];
    const badge = (f) => f['blocks/badge/component.json'];
    const needsMissing = (f) => codesOf(f).filter(c => c.startsWith('E-NEEDS-MISSING'));
    const engineCode = (f) => {
      const exp = loadExperience(mapSource(f), null).experience;
      try { return new Player(exp).start().fault?.code ?? null; } catch (e) { return e.code ?? String(e); }
    };
    // A: the scene uses particles, only the component names effects: the scene is not covered.
    const a = base(); scene(a).addons = fx; badge(a).needs = ['effects'];
    ok(needsMissing(a).length > 0, 'A check'); eq(engineCode(a), 'E-NEEDS-MISSING', 'A engine');
    // B: the component uses particles, only the experience names effects: a component names its own.
    const b = base(); badge(b).addons = fx; b['experience.json'].needs = ['effects'];
    ok(needsMissing(b).length > 0, 'B check'); eq(engineCode(b), 'E-NEEDS-MISSING', 'B engine');
    // Covered: the scene by the experience's needs, the component by its own.
    const c = base(); scene(c).addons = fx; c['experience.json'].needs = ['effects'];
    eq(needsMissing(c), [], 'scene covered'); ok(engineCode(c) !== 'E-NEEDS-MISSING', 'scene covered at play');
    const d = base(); badge(d).addons = fx; badge(d).needs = ['effects'];
    eq(needsMissing(d), [], 'component covered'); ok(engineCode(d) !== 'E-NEEDS-MISSING', 'component covered at play');
    // Only a module carries a version (10.11 rule 5).
    const e = base(); e['experience.json'].needs = ['physics@2.0.0'];
    ok(codesOf(e).some(x => x.startsWith('E-NEEDS-UNKNOWN')), JSON.stringify(codesOf(e)));
  },

  // ----- architecture 8: capability event names are checked against the owner's events (10.11) -----
  'X4 architecture 8: physics:hti:go, chess:moved:x and media:ended:nowhere are E-REF-UNKNOWN; real ones pass'() {
    const withOn = (key, extra) => { const f = base(); const s = f['scenes/one/scene.json']; extra?.(s); s.on[key] = [{ id: 'h', actions: [{ id: 'a', set: 'score', to: 1 }] }]; return codesOf(f, ['refs']).filter(c => c.startsWith('E-REF-UNKNOWN')); };
    for (const key of ['physics:hti:go', 'chess:moved:x', 'media:ended:nowhere', 'physics:hit:nobody', 'physics:nosuchevent']) ok(withOn(key).length === 1, `${key}: ${JSON.stringify(withOn(key))}`);
    eq(withOn('physics:hit:go', (s) => { s.addons = { physics: { bodies: { go: { target: 'go' } } } }; }), []);
    eq(withOn('media:ended:go', (s) => { s.bindings.push({ id: 'v', target: 'go', media: { video: "'film'" } }); }), []);
  },

  // ----- architecture 10: the coverage test counts only codes something real produces -----
  async 'X4 architecture 10: a code quoted in a one-off spec edit script is not produced; the upgrade tool still is'() {
    const cov = await import('./check-coverage.test.mjs');
    const under = (f) => cov.PRODUCERS.some(d => !path.relative(d, f).startsWith('..'));
    const spec = path.join(repo, 'docs', 'spec-2.0-work', 'tools');
    ok(fs.readFileSync(path.join(spec, 'fixes-5f.mjs'), 'utf8').includes('E-CAPABILITY-GRAMMAR'), 'the probe file still quotes the code');
    ok(!under(path.join(spec, 'fixes-5f.mjs')) && !under(path.join(spec, 'fixes-5b.mjs')), 'spec edit scripts are not producers');
    ok(under(path.join(spec, 'upgrade', 'upgrade.mjs')), 'the upgrade tool is a producer (E-UPGRADE-SOURCE)');
    const codes = new Set(JSON.parse(fs.readFileSync(path.join(repo, 'spec', '2.0', 'errors.json'), 'utf8')).codes.map(c => c.code));
    for (const c of ['E-TRUST-BLOCKED', 'E-AUTHORING-ONLY', 'E-UPGRADE-INCOMPLETE']) ok(!codes.has(c), `${c} produced by nothing, removed by X5`);
    // The add-on door reads outside manifests, so it produces these two (src/addons.mjs checkManifest).
    for (const c of ['E-CAPABILITY-FORMAT', 'E-CAPABILITY-GRAMMAR']) ok(codes.has(c) && !(c in cov.ALLOW), `${c} is produced by the add-on door now`);
  },

  // ----- code 11: the checker refuses what the engine always faults on (5.6.1, 5.6.4, 5.14, 5.3.1) -----
  'X4 code 11: each formula row of the report is refused by the checker as the engine refuses it'() {
    const scene = (f) => f['scenes/one/scene.json'];
    const list = { type: 'array', items: { type: 'number', minimum: 0, maximum: 1 }, maxItems: 3, initial: [] };
    const label = { type: 'string', maxLength: 9, initial: '' };
    const values = { list: [1, 0], label: 'abc' };
    const engineCode = (src) => { try { evaluate(parse(src), { name: (n) => values[n], has: () => false, words: { 'go.other': 'Go' } }); return null; } catch (e) { return e.code; } };
    const checkCodes = (src) => { const f = base(); Object.assign(scene(f).values, { list, label }); scene(f).computed.x = src; return codesOf(f, ['formula', 'refs']).filter(c => / \/computed\/x$/.test(c)).map(c => c.split(' ')[0]); };
    for (const [src, code] of [['list.length', 'E-TYPE'], ['label.length', 'E-TYPE'], ['list.foo', 'E-TYPE'], ['list[1.5]', 'E-TYPE'], ["plural(2, 'nope')", 'E-REF-UNKNOWN'], ['numberText(1, 9)', 'E-FORMULA']]) {
      ok(engineCode(src) !== null, `${src} faults at play`);
      eq(checkCodes(src), [code], src);
    }
    const withWord = base(); withWord['words/en.csv'] += 'apples.one,apple\napples.other,apples\n'; scene(withWord).computed.x = "plural(2, 'apples')";
    eq(codesOf(withWord, ['formula', 'refs']).filter(c => / \/computed\/x$/.test(c)), [], 'a word with its other form');
    eq(engineCode('numberText(1, 9)'), 'E-FORMULA');
    // length(label) is bounded by the label's maxLength, not by the list limit (1024): a motion range of 0..60 holds
    // for maxLength 50 and not for maxLength 4000.
    const motion = (maxLength) => { const f = base(); scene(f).values.label = { type: 'string', maxLength, initial: '' }; scene(f).bindings.push({ id: 'spin', target: 'go', rotate: 'length(label)' }); return codesOf(f, ['formula']).filter(c => c.startsWith('E-MOTION-RANGE')); };
    eq(motion(50), []); eq(motion(4000).length, 1);
    // an after transition to a state that does not exist; an initial that is not a state
    const m = base(); scene(m).machines = [{ id: 'm', initial: 'a', states: { a: { after: [{ id: 'go-on', delayMs: 100, target: 'nowhere' }] }, b: { initial: 'zz', states: { c: {} } } } }];
    const mc = codesOf(m, ['refs']);
    ok(mc.some(c => c.startsWith('E-MACHINE-TARGET')) && mc.some(c => c.startsWith('E-MACHINE-INITIAL')), JSON.stringify(mc));
    // a dotted name that is not a role prefix
    const d = base(); scene(d).inputs = { 'foo.bar': { kind: 'content', type: 'string', maxLength: 5, initial: 'hi' } };
    ok(codesOf(d, ['refs']).some(c => c.startsWith('E-NAME-SHAPE')), JSON.stringify(codesOf(d, ['refs'])));
  },

  // ----- newcomer F1: the front page leads with 2.0 and sends 0.1 readers to their own page -----
  'X4 newcomer F1: README.md leads with 2.0 (the kit, START.md, the skill); its links resolve; its commands run'() {
    const text = fs.readFileSync(path.join(repo, 'README.md'), 'utf8');
    const first = text.indexOf('## ');
    const lead = text.slice(0, text.indexOf('\n## ', first + 3));
    for (const s of ['hsvg/2.0', 'kit/2.0/build.mjs', 'kit/2.0/START.md', 'skill/2.0/SKILL.md', 'engine/v2/tools/check.mjs']) ok(lead.includes(s), `the first section names ${s}`);
    ok(!/engine\/tools\/check\.mjs|experience\/0\.1/.test(lead), 'the first section is 2.0 only');
    ok(text.includes('](docs/guide/README-0.1.md)'), 'a link to the 0.1 page');
    const links = (file) => [...fs.readFileSync(file, 'utf8').matchAll(/\]\(([^)#:]+)(#[^)]*)?\)/g)].map(m => path.resolve(path.dirname(file), m[1]));
    for (const f of [path.join(repo, 'README.md'), path.join(repo, 'docs', 'guide', 'README-0.1.md')]) for (const l of links(f)) ok(fs.existsSync(l), `${path.relative(repo, f)} links to ${path.relative(repo, l)}, which is missing`);
    // the root commands: check gives 0 findings, pack writes the page the text names
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-x4-readme-'));
    try {
      const ex = path.join(repo, 'skill', '2.0', 'examples', 'first-run');
      ok(/0 findings/.test(runCheck(ex).stdout), 'check');
      const p = spawnSync(process.execPath, [path.join(repo, 'engine', 'v2', 'tools', 'pack.mjs'), ex, path.join(out, 'first-run')], { encoding: 'utf8' });
      eq(p.status, 0, p.stderr);
      ok(text.includes('out/first-run/first-run.html') && fs.existsSync(path.join(out, 'first-run', 'first-run.html')), 'the packed page is where the README says');
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  },

  // ----- newcomer F4, F6: the messages say how to fix it -----
  'X4 newcomer F4: a link on an event nothing sends says how to send it; an event the scene sends needs no outputs (D31.4)'() {
    const wc = path.join(repo, 'skill', '2.0', 'examples', 'water-cycle');
    const msg = (edit) => onCopy(wc, (dir) => { edit(dir); return JSON.parse(runCheck(dir, '--json').stdout).filter(x => x.code === 'E-REF-UNKNOWN').map(x => x.message); });
    const never = msg((dir) => { const f = path.join(dir, 'experience.json'); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('"on": "finished", "to": "ending"', '"on": "finish", "to": "ending"')); });
    ok(never.length === 1 && never[0].includes('send it from quiz') && never[0].includes('{"emit": "finish"}'), JSON.stringify(never));
    const undeclared = msg((dir) => { const f = path.join(dir, 'scenes', 'quiz', 'scene.json'); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('"outputs": {"finished": {"kind": "event"}},', '')); });
    eq(undeclared, [], 'quiz sends finished and a link hears it: no outputs entry is needed');
  },
  'X4 newcomer F6: a literal clip key outside the motion range says the key and what to change, not clamp'() {
    const f = base(); f['scenes/one/scene.json'].clips.wave.tracks[0].keys = [[0, 0], [500, 200]];
    const m = checkExperience(mapSource(f), schemas(), { only: ['formula'] }).diags.filter(d => d.code === 'E-MOTION-RANGE').map(d => d.message);
    ok(m.length === 1 && /the key is 200, outside the motion range -90\.\.90 of go for rotate/.test(m[0]) && /widen data-hsvg-motion on go or change the key/.test(m[0]) && !m[0].includes('clamp'), JSON.stringify(m));
    const g = base(); g['scenes/one/scene.json'].clips.wave.tracks[0].keys = [[0, 0], [500, 'score * 100']];
    const n = checkExperience(mapSource(g), schemas(), { only: ['formula'] }).diags.filter(d => d.code === 'E-MOTION-RANGE').map(d => d.message);
    ok(n.length === 1 && n[0].includes('write clamp(...)'), JSON.stringify(n)); // a formula keeps the clamp advice
  },
};
