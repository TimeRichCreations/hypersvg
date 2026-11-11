// Checks a 2.0 experience folder: schemas, then the cross-file rules (10.12).
// Usage: node engine/v2/tools/check.mjs <experience folder> [--only refs,story] [--json] [--paint] [--review]
// --review adds the review findings files can decide (check/review.mjs): W-NAME-HIDES-LABEL and W-TEXT-SMALL.
// --json prints the findings as JSON: each with code, level (error or warning), severity, file, line, column, pointer,
// message, reason and fix. A drawing finding names its SVG file and the element's line.
//        node engine/v2/tools/check.mjs <experience or kit folder> --rights     # print the rights table (A9.1)
//        node engine/v2/tools/check.mjs <experience folder> --previous-kit <kit folder>   # E-KIT-VERSION (4.8)
//        node engine/v2/tools/check.mjs <experience folder> --kit <kit folder>   # find a pinned or picked kit there
//        node engine/v2/tools/check.mjs <kit folder>                              # the kit alone: its catalogue (E-CATALOGUE)
// --previous-kit names the folder of the kit as it was before a version change (its kit.json and files): the checker
// compares the pinned kit with it, so a change needs its version class (E-KIT-VERSION, A9.1).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { folderSource, loadExperience } from '../src/load.mjs';
import { checkExperience } from '../check/index.mjs';
import { playingOnly } from '../check/rules/index.mjs';
import { describe } from '../check/diagnostics.mjs';
import { loadSchemas } from '../schema/load.mjs';
import { rightsTable, kitRightsTable } from './change/rights.mjs';
import { loadPreviousKit } from './previous-kit.mjs';
import { checkKitFolder } from './library.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..');
const args = process.argv.slice(2);
const USAGE = 'usage: node engine/v2/tools/check.mjs <experience or kit folder> [--only refs,story] [--json] [--paint] [--review] [--rights] [--previous-kit <kit folder>] [--kit <kit folder>]';
if (!args[0]) { console.log(USAGE); process.exit(2); }
// The ASKS line (10.5): what the experience asks the host for. openUrl adds what a page opened alone does with it.
function asksLine(list) {
  const line = `ASKS ${list.join(', ')}: requested from use, written by the packer; the host decides (10.5)`;
  if (!list.includes('openUrl')) return line;
  return `${line}. A page opened alone has no host: a link press opens nothing and logs "openUrl refused". To open links, a host listens with window.hsvg.on('openUrl', fn), or pack with --host and a profile that grants openUrl`;
}
const value = (name) => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1] ?? null; };
const only = value('--only')?.split(',') ?? null;
const dir = path.resolve(args[0]);
const schemas = loadSchemas(path.join(repo, 'spec', '2.0'));
// --kit <folder> (may repeat): where a kit the experience pins or picks from is, before kits/<id>/ is looked for.
const kits = {};
args.forEach((a, i) => { if (a === '--kit' && args[i + 1]) { const k = path.resolve(args[i + 1]); try { kits[JSON.parse(fs.readFileSync(path.join(k, 'kit.json'), 'utf8')).id] = k; } catch { console.error(`${args[i + 1]} holds no kit.json`); process.exit(2); } } });

// --rights: the rights table, computed by the checker's own rules (A9.1), then the usual check.
if (args.includes('--rights')) {
  if (fs.existsSync(path.join(dir, 'kit.json'))) { console.log(JSON.stringify(kitRightsTable(JSON.parse(fs.readFileSync(path.join(dir, 'kit.json'), 'utf8'))), null, 2)); process.exit(0); }
  const exp = loadExperience(await folderSource(dir, { kits }), schemas).experience;
  if (!exp) { console.error(`${args[0]} does not load as an experience`); process.exit(1); }
  console.log(JSON.stringify(rightsTable(exp), null, 2));
  process.exit(0);
}

// A kit folder alone: the kit's own checks a tool can make without an experience (its catalogue).
if (fs.existsSync(path.join(dir, 'kit.json')) && !fs.existsSync(path.join(dir, 'experience.json'))) {
  const found = checkKitFolder(dir, schemas);
  for (const d of found) console.log(`${d.code} ${d.file} ${d.path}: ${d.message}`);
  const by = {}; for (const d of found) by[d.code] = (by[d.code] || 0) + 1;
  console.log(`${found.length} findings ${JSON.stringify(by)}`);
  process.exit(found.some(d => d.code.startsWith('E-')) ? 1 : 0);
}
const source = await folderSource(dir, { kits });
const opts = { only, paint: args.includes('--paint'), review: args.includes('--review') };
const prev = value('--previous-kit');
if (args.includes('--previous-kit')) {
  if (!prev) { console.error(USAGE); process.exit(2); }
  opts.previousKit = loadPreviousKit(path.resolve(prev), schemas);
  if (!opts.previousKit) { console.error(`${prev} holds no kit (kit.json) that loads`); process.exit(1); }
}
const r = checkExperience(source, schemas, opts);
// Every finding carries severity, line, column, pointer, address, reason and fix (10.12, rule 1).
const found = describe(r.diags, source, r.experience);
// The rules files cannot settle (8.8): each is listed as not-run, never counted as a pass. They are not findings and
// do not change the exit code. In --json they follow the findings with severity "not-run".
const notRun = r.experience && (!only || only.includes('rules')) ? playingOnly(r.experience) : [];
// --json: every finding has its level (error or warning), and its file and line (a drawing finding: the SVG file).
if (args.includes('--json')) console.log(JSON.stringify([...found.map(d => ({ code: d.code, level: d.code.startsWith('E-') ? 'error' : 'warning', ...d })), ...notRun.map(x => ({ code: 'NOT-RUN', severity: 'not-run', ...x }))], null, 1));
else {
  for (const d of found.slice(0, 200)) console.log(`${d.code} ${d.file}${d.line ? `:${d.line}${d.column ? `:${d.column}` : ''}` : ''} ${d.pointer}: ${d.message}`);
  for (const x of notRun.slice(0, 200)) console.log(`NOT-RUN ${x.file} ${x.path}: rule ${x.rule ?? '?'} (${x.kind}) needs a ${x.proof} proof: ${x.why}`);
  if (notRun.length) { const k = {}; for (const x of notRun) k[x.proof] = (k[x.proof] || 0) + 1; console.log(`${notRun.length} rules not-run ${JSON.stringify(k)}: not a pass; play, a measurer, the host or a person settles them (8.8)`); }
  // The grants asked for from use (10.5, D31.4): the packer writes them; the host decides.
  const asked = r.experience?.derivedGrants || {};
  const askList = [...(asked.openUrl ? ['openUrl'] : []), ...(asked.storage || []).map(s => `storage ${s}`)];
  if (askList.length) console.log(asksLine(askList));
  const by = {}; for (const d of found) by[d.code] = (by[d.code] || 0) + 1;
  console.log(`${found.length} findings ${JSON.stringify(by)}`);
}
// Errors (E-) fail the check; warnings (W-) are listed only.
process.exit(r.diags.some(d => d.code?.startsWith('E-')) ? 1 : 0);
