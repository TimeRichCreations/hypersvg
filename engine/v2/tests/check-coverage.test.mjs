// Coverage (W2-C, X5): every code in spec/2.0/errors.json is produced by some tool, or is on the allow-list below
// with its reason. A tool "produces" a code when its source (PRODUCERS) names the code in quotes, or the spec's schemas carry it as
// `x-hsvg-code` (the schema checker reports it). The allow-list must stay honest: a code that is now produced, or is not
// a `files` code, must leave the list.
import fs from 'node:fs';
import path from 'node:path';
import { repo, eq, ok } from './helpers.mjs';

const read = (...p) => fs.readFileSync(path.join(repo, ...p), 'utf8');
function sources(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'tests' && e.name !== 'node_modules') sources(p, out); } else if (/\.(mjs|js)$/.test(e.name) && !/\.test\.mjs$/.test(e.name)) out.push(p);
  }
  return out;
}
// Producers are the engine and its tools (engine/v2, not its tests) and the upgrade tool (A13), which emits
// E-UPGRADE-SOURCE. The other scripts in docs/spec-2.0-work/tools are one-off spec edits: a code quoted in their
// replacement text is prose, not a producer (R2 architecture 10).
export const PRODUCERS = [path.join(repo, 'engine', 'v2'), path.join(repo, 'docs', 'spec-2.0-work', 'tools', 'upgrade')];
const toolText = PRODUCERS.flatMap(d => sources(d)).map(f => fs.readFileSync(f, 'utf8')).join('\n');
const schemaText = read('spec', '2.0', 'documents.json');
const produced = (code) => new RegExp(`['"\`]${code}['"\`]`).test(toolText) || schemaText.includes(`"x-hsvg-code": "${code}"`);

// Every code in errors.json is produced (decisions 9 and 10 removed the rest). The add-on door
// produces the two capability manifest codes (src/addons.mjs checkManifest), so nothing waits here.
export const ALLOW = {
};

export const tests = {
  'every code (files, playing or review) is produced by a tool or is on the allow-list'() {
    const codes = JSON.parse(read('spec', '2.0', 'errors.json')).codes;
    const missing = codes.filter(c => !produced(c.code) && !(c.code in ALLOW)).map(c => c.code);
    eq(missing, [], 'codes with no producer and no reason:');
  },
  'the allow-list holds only files codes that are still not produced, each with a reason'() {
    const codes = new Map(JSON.parse(read('spec', '2.0', 'errors.json')).codes.map(c => [c.code, c]));
    for (const [code, reason] of Object.entries(ALLOW)) {
      ok(codes.has(code), `${code} is not in errors.json`);
      ok(codes.get(code).proof.includes('files'), `${code} is not a files code`);
      ok(!produced(code), `${code} is produced now: remove it from the allow-list`);
      ok(typeof reason === 'string' && reason.length > 20, `${code} needs a reason`);
    }
  },
};
