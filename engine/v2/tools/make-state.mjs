// Writes the state fingerprint's conformance files (spec/2.0/conformance/state/, 9.6.1): each file is one state
// document, and expected.json gives its fingerprint, the UTF-8 length of its canonical JSON and, for a short one, the
// canonical text itself. Some documents are written by hand to test the canonical form (numbers, strings, key order);
// the others are the state of a real play after the moves the case names. tests/r1-replay.test.mjs reads every file.
// Usage: node engine/v2/tools/make-state.mjs [--check]
//   --check  write nothing; exit 1 when a file differs from what this tool makes
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadExperience, folderSource } from '../src/load.mjs';
import { loadSchemas } from '../schema/load.mjs';
import { logic, canonicalJson, fingerprintOf } from '../src/logic.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..');
export const folder = path.join(repo, 'spec', '2.0', 'conformance', 'state');
const SHORT = 400;

// The state after feeding moves to a fresh logic-only player of an experience folder, at a fixed epoch.
async function played(rel, moves) {
  const l = loadExperience(await folderSource(path.join(repo, rel)), loadSchemas(path.join(repo, 'spec', '2.0')));
  if (!l.experience) throw new Error(`${rel}: ${l.diags.map(d => d.code).join(', ')}`);
  const a = logic(l.experience, { epochMs: Date.UTC(2026, 0, 1) });
  for (const m of moves) a.feed(m);
  return a.state();
}
const start = { t: 0, source: 'start', payload: [null] };
// The guide's harbour (a shell, a component use, a machine timer), which every export holds.
const HARBOUR = 'docs/guide/examples/harbour';
const go = { t: 400, source: 'activate', payload: ['gate', 'go', null] };

// Every case: [file name, state document]. Hand-written ones first.
export async function stateCases() {
  const empty = { now: 0, seq: 0, blocks: {}, timers: [], records: {}, ambient: {}, story: null, pauses: [] };
  return [
    ['minimal.json', empty],
    ['numbers.json', { ...empty, now: 1500, blocks: { experience: { values: { big: 1e21, small: 1e-7, third: 1 / 3, tiny: 5e-324, safe: 9007199254740991, half: 0.5, neg: -12.25, zero: -0, whole: 100 } } } }],
    ['strings.json', { ...empty, blocks: { experience: { values: { 'é': 'café', A: 'tab\there "quoted" back\\slash', z: 'line\nfeed \u0001 \u007f', '\u{1F600}': 'smile \u{1F600}', 'דּ': 'דּ', '': 'empty key' } } } }],
    ['order.json', { ...empty, blocks: { b: { values: { b: 2, a: 1, B: 3, aa: 4, 10: 5, 9: 6 } }, a: {} }, pauses: ['host', 'hidden'], stopped: 'E-RANGE' }],
    ['harbour-start.json', await played(HARBOUR, [start])],
    ['harbour-sailed.json', await played(HARBOUR, [start, go])],
    // A page sends firstInput before the first press (10.4): the state then says it was reported.
    ['harbour-first-input.json', await played(HARBOUR, [start, { t: 400, source: 'firstInput', payload: [] }, go])],
    ['harbour-later.json', await played(HARBOUR, [start, go, { t: 2600, source: 'activate', payload: ['shell', 'mute', null] }])],
  ];
}

// The files this tool writes: {name: text}.
export async function stateFiles() {
  const out = {};
  const expected = {};
  for (const [name, doc] of await stateCases()) {
    out[name] = `${JSON.stringify(doc, null, 1)}\n`;
    const parsed = JSON.parse(out[name]); // what a reader gets from the file
    const canon = canonicalJson(parsed);
    expected[name] = { fingerprint: fingerprintOf(parsed), bytes: new TextEncoder().encode(canon).length, ...(canon.length <= SHORT ? { canonical: canon } : {}) };
  }
  out['expected.json'] = `${JSON.stringify(expected, null, 1)}\n`;
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const files = await stateFiles();
  let differs = 0;
  for (const [name, text] of Object.entries(files)) {
    const file = path.join(folder, name);
    const now = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (now === text) continue;
    differs++;
    if (check) console.log(`differs: ${path.relative(repo, file)}`);
    else { fs.mkdirSync(folder, { recursive: true }); fs.writeFileSync(file, text); console.log(`wrote ${path.relative(repo, file)}`); }
  }
  const extra = fs.existsSync(folder) ? fs.readdirSync(folder).filter(f => f.endsWith('.json') && !(f in files)) : [];
  for (const f of extra) { differs++; console.log(`not made by this tool: ${f}`); }
  if (check) { console.log(differs ? `${differs} file(s) differ` : 'state conformance files: up to date'); process.exit(differs ? 1 : 0); }
}
