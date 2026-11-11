// Polish from playing the guide and building the library.
// Fixtures are the guide's examples (docs/guide/examples/), so the tests run in the lean base (D41): edit a copy of
// their JSON or drawing in memory, check.
import { checkExperience } from '../check/index.mjs';
import { folderSource } from '../src/load.mjs';
import { repo, schemas, eq, ok } from './helpers.mjs';
import path from 'node:path';
import os from 'node:os';

const examples = path.join(repo, 'docs', 'guide', 'examples');
const harbour = await folderSource(path.join(examples, 'harbour'));
const SCENE = 'harbour.json';
// Checks the harbour after edit(scene); returns the findings as [code, path, message].
const run = (edit = () => {}) => {
  const s = JSON.parse(harbour.read(SCENE));
  edit(s);
  const files = { [SCENE]: JSON.stringify(s) };
  const source = { ...harbour, read: (p) => files[p] ?? harbour.read(p) };
  return checkExperience(source, schemas()).diags.map(d => [d.code, d.path, d.message]);
};
const codes = (r) => r.map(([c, p]) => `${c} ${p}`);
const msg = (r) => r.map(x => x[2]).join(' | ');
// The harbour's sound action and its rope binding, found by what they do (not by position).
const soundOf = (s) => s.on.load[0].actions.find(a => a.as === 'sound');
const ropeOf = (s) => s.bindings.find(b => b.target === 'rope' && b.as === 'stroke');

export const tests = {
  'the harbour checks clean'() { eq(run(), []); },

  // ---------- A1. checker holes ----------
  'an unquoted sound name in play is reported, with the quoted form as the fix (D36)'() {
    const r = run((s) => { soundOf(s).play = 'bell'; });
    eq(codes(r), ['E-REF-UNKNOWN /on/load/0/actions/1/play'], msg(r));
    ok(r[0][2].includes(`"play": "'bell'"`) && r[0][2].includes('D36'), r[0][2]);
  },
  'an unquoted sound id with a hyphen is one finding'() {
    const r = run((s) => { soundOf(s).play = 'ship-bell'; });
    eq(codes(r), ['E-REF-UNKNOWN /on/load/0/actions/1/play'], msg(r));
    ok(r[0][2].includes(`"play": "'ship-bell'"`), r[0][2]);
  },
  'a quoted sound name, or a formula that gives one, checks clean'() {
    eq(run((s) => { soundOf(s).play = "'bell'"; }), []);
    eq(run((s) => { soundOf(s).play = "score > 1 ? 'bell' : 'bell'"; }), []);
  },
  'a sound name of the wrong type is E-TYPE'() {
    const r = run((s) => { soundOf(s).play = 'score'; });
    eq(codes(r), ['E-TYPE /on/load/0/actions/1/play'], msg(r));
  },
  'a theme role in color as stroke is E-TYPE, naming as marked and a colour mark'() {
    const r = run((s) => { ropeOf(s).color = "tension > 3 ? 'ink' : '#5a3a30'"; });
    eq(r.map(x => x[0]), ['E-TYPE'], msg(r));
    ok(/\/bindings\/\d+\/color$/.test(r[0][1]), r[0][1]);
    ok(r[0][2].includes("a stroke value is a #rrggbb colour, not \"ink\"") && r[0][2].includes("color as marked") && r[0][2].includes('data-hsvg-color="stroke:ink"'), r[0][2]);
  },
  'a theme role in color as fill is E-TYPE too'() {
    // the rope is a stroked line: that it draws no fill is a finding of its own
    const r = run((s) => { const b = ropeOf(s); b.as = 'fill'; b.color = "'accent'"; }).filter(x => x[2].includes('a fill value'));
    eq(r.map(x => x[0]), ['E-TYPE'], msg(r));
    ok(r[0][2].includes('not "accent"') && r[0][2].includes('data-hsvg-color="fill:accent"'), r[0][2]);
  },
  'a #rrggbb colour as stroke, and a role as marked, check clean'() {
    eq(run((s) => { ropeOf(s).color = "'#5A3A30'"; }), []);
    eq(run((s) => { const b = ropeOf(s); delete b.as; b.color = "'ink'"; }).filter(x => x[0] === 'E-TYPE'), []);
  },
};

// ---------- A3. the harness presses add-on controls ----------
// test.mjs runs in a child process: the doors' add-ons register themselves, and the registry is shared by later tests.
const { execFileSync } = await import('node:child_process');
tests['the Node play sends each gesture an add-on control kind lists (the doors stepper: press, up, down)'] = () => {
  const doors = path.join(repo, 'engine', 'v2', 'addons', 'examples', 'doors');
  const out = execFileSync(process.execPath, [path.join(repo, 'engine', 'v2', 'tools', 'test.mjs'), doors, '--node-only', '--allow', 'example.steps', '--allow', 'example.sway', '--json'], { encoding: 'utf8' });
  const r = JSON.parse(out.slice(0, out.lastIndexOf('}') + 1)); // the report, then its folder's line
  eq(r.findings.filter(f => f.severity === 'error'), [], JSON.stringify(r.findings));
  ok(r.node.uses >= 5, `uses: ${r.node.uses}`); // the stepper's three gestures, the swing and the reset
};

// ---------- A4. messages ----------
const { UPGRADE_TOOL } = await import('../src/read.mjs');
const fs = await import('node:fs');
tests['the upgrade fixes name the upgrade tool (A13), not an hsvg upgrade command the base does not have'] = () => {
  const codes = JSON.parse(fs.readFileSync(path.join(repo, 'spec', '2.0', 'errors.json'), 'utf8')).codes;
  for (const c of ['E-SVG-ROOT', 'E-HEADER']) {
    const fix = codes.find(x => x.code === c).fix;
    ok(fix.includes('the upgrade tool (A13.3)') && !fix.includes('hsvg upgrade'), `${c}: ${fix}`);
  }
  ok(UPGRADE_TOOL.startsWith('the upgrade tool (A13.3') && !UPGRADE_TOOL.includes('hsvg upgrade'), UPGRADE_TOOL);
};
tests['the old action add is E-WORD-RENAMED with the set form, by 1 or by its by'] = () => {
  let r = run((s) => { s.on.load[0].actions[0] = { add: 'score' }; });
  eq(codes(r), ['E-WORD-RENAMED on.load[0].actions[0]'], msg(r));
  ok(r[0][2].includes('{"set": "score", "to": "score + 1"}'), r[0][2]);
  r = run((s) => { s.on.load[0].actions[0] = { add: 'score', by: 2 }; });
  eq(codes(r), ['E-WORD-RENAMED on.load[0].actions[0]'], msg(r));
  ok(r[0][2].includes('"to": "score + 2"'), r[0][2]);
};

// ---------- A2. accessible names (10.13): the page uses the label, else the part's data-hsvg-label ----------
// The page side is engine/v2/tests/browser/k2g-polish-browser.mjs. The checker's review finding reads the same name.
const lampDir = await folderSource(path.join(examples, 'lamp'));
const lamp = (draw, edit = () => {}) => {
  const s = JSON.parse(lampDir.read('lamp.json')); edit(s);
  const files = { 'lamp.svg': draw(lampDir.read('lamp.svg')), 'lamp.json': JSON.stringify(s) };
  const source = { ...lampDir, read: (p) => files[p] ?? lampDir.read(p) };
  return checkExperience(source, schemas(), { review: true }).diags.map(d => [d.code, d.path, d.message]);
};
const named = (label) => (svg) => svg.replace('<g id="switch" data-hsvg-kind="part"', `<g id="switch" data-hsvg-kind="part" data-hsvg-label="${label}"`);
tests['a part\'s data-hsvg-label that hides the drawn words is W-NAME-HIDES-LABEL when the control has no label'] = () => {
  const r = lamp(named('Light switch')).filter(x => x[0] === 'W-NAME-HIDES-LABEL');
  eq(r.length, 1, msg(r));
  ok(r[0][2].includes('named by its data-hsvg-label') && r[0][2].includes('"Light switch"'), r[0][2]);
};
tests['a data-hsvg-label that holds the drawn words, or a label that does, is not reported'] = () => {
  // the words stay "Turn on" when their binding is gone
  eq(lamp(named('Turn on the lamp'), (s) => { s.bindings = s.bindings.filter(b => b.target !== 'switch-words'); }).filter(x => x[0] === 'W-NAME-HIDES-LABEL'), []);
  eq(lamp(named('Light switch'), (s) => { s.controls.switch.label = "Turn {{ lit ? 'off' : 'on' }}"; }).filter(x => x[0] === 'W-NAME-HIDES-LABEL'), []);
};

// ---------- A5. tools for asset makers ----------
const { parseArgs } = await import('../tools/test.mjs');
tests['test.mjs --min-width takes a whole number of CSS pixels, 100 to 2000'] = () => {
  eq(parseArgs(['x', '--min-width', '320']).minWidth, 320);
  eq(parseArgs(['x']).minWidth, undefined);
  for (const bad of ['50', '320.5', 'wide', '5000']) {
    let msg = '';
    try { parseArgs(['x', '--min-width', bad]); } catch (e) { msg = e.message; }
    ok(msg.includes('--min-width'), `${bad}: ${msg}`);
  }
};
// check.mjs --json on a copy of the lamp with drawing findings on elements with and without an id.
tests['check.mjs --json: every finding has its level, and a drawing finding its SVG file and line'] = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-k2g-'));
  try {
    fs.cpSync(path.join(examples, 'lamp'), dir, { recursive: true });
    const f = path.join(dir, 'lamp.svg');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('<title>Lamp</title>', '').replace('<rect x="185"', '<rect role="img" x="185"').replace('data-hsvg-label="Bulb"', 'data-hsvg-label="Bulb" data-hsvg-pivot="nope"'));
    let out = '';
    try { out = execFileSync(process.execPath, [path.join(repo, 'engine', 'v2', 'tools', 'check.mjs'), dir, '--json'], { encoding: 'utf8' }); } catch (e) { out = e.stdout; }
    const found = JSON.parse(out).filter(d => d.code !== 'NOT-RUN');
    ok(found.length >= 3, out);
    for (const d of found) {
      ok(d.level === (d.code.startsWith('E-') ? 'error' : 'warning'), JSON.stringify(d));
      ok(d.file === 'lamp.svg' && Number.isInteger(d.line) && d.line > 0, JSON.stringify(d));
    }
    const codes = found.map(d => d.code);
    for (const c of ['W-A11Y-TITLE', 'E-A11Y-OWNED', 'E-MARK-VALUE']) ok(codes.includes(c), codes.join(', '));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};
