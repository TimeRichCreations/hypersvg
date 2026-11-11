// The change tool (9.10, A9.2): saves edits as new revisions, without a server.
//
//   node engine/v2/tools/change.mjs apply <experience or kit folder> <request.json> --right <id> --who <who> --source <source>
//        [--out <folder>] [--host <host-profile.json>] [--previous-kit <kit folder>]
//   node engine/v2/tools/change.mjs make <before folder> <after folder | edits.json> --id <id>
//        [--right <id> --who <who> --source <source>] [--reason <text>] [--out <request.json>]
//   node engine/v2/tools/change.mjs rights <experience or kit folder>
//
// apply runs the eight checks in order and writes nothing unless all pass. It writes the receipt beside the request
// (<request>.receipt.json) and, on a pass, in the folder's evidence/changes/<target>/<id>.json. A retry with the same id prints
// the first receipt and writes nothing. --right, --who and --source are the authenticated `by`: they replace the
// request's own, which is never trusted. Without them apply refuses the request (E-RIGHTS): it has no rights. --previous-kit names the kit as it was before a series of kit changes (4.8): the last request, the
// version change, is checked against it (E-KIT-VERSION). Exit 0 on pass, 1 on a refusal, 2 on a usage error.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSchemas } from '../schema/load.mjs';
import { folderSource, loadExperience } from '../src/load.mjs';
import { applyChange } from './change/apply.mjs';
import { makeRequest } from './change/make.mjs';
import { rightsTable, kitRightsTable } from './change/rights.mjs';
import { loadPreviousKit } from './previous-kit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..');
const USAGE = 'usage: node engine/v2/tools/change.mjs apply <folder> <request.json> --right <id> --who <who> --source <source> [--out <folder>]\n'
  + '       node engine/v2/tools/change.mjs make <before folder> <after folder | edits.json> --id <id> [--right <id> --who <who> --source <source>] [--reason <text>] [--out <request.json>]\n'
  + '       node engine/v2/tools/change.mjs rights <folder>';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(`--${name}`); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
const out = flag('out'); const right = flag('right'); const who = flag('who'); const source = flag('source');
const reason = flag('reason'); const id = flag('id'); const hostFile = flag('host'); const previousKitDir = flag('previous-kit');
const by = right || who || source ? { source: source ?? 'editor', ...(right ? { right } : {}), who: who ?? 'host' } : undefined;
const [cmd, a, b] = args;
const fail = (m) => { console.log(m); process.exit(2); };
const schemas = loadSchemas(path.join(repo, 'spec', '2.0'));

if (cmd === 'apply') {
  if (!a || !b) fail(USAGE);
  let req;
  try { req = JSON.parse(fs.readFileSync(b, 'utf8')); } catch (e) { req = null; console.log(`the request does not read as JSON: ${e.message}`); }
  const host = hostFile ? JSON.parse(fs.readFileSync(hostFile, 'utf8')) : null;
  const previousKit = previousKitDir ? loadPreviousKit(path.resolve(previousKitDir), schemas) : null;
  if (previousKitDir && !previousKit) fail(`${previousKitDir} holds no kit (kit.json) that loads`);
  const r = await applyChange(path.resolve(a), req, { schemas, by, out, requestPath: path.resolve(b), host, previousKit });
  const rc = r.receipt;
  console.log(`${rc.status} ${rc.id}${r.replayed ? ' (the first receipt; nothing applied)' : ''} ${rc.previous} -> ${rc.digest}`);
  for (const [k, v] of Object.entries(rc.verdicts)) console.log(`  ${k}: ${v}`);
  for (const row of rc.rules || []) if (row.result !== 'pass') console.log(`  rule ${row.rule}: ${row.result}${row.detail ? ` (${row.detail})` : ''}`);
  for (const e of rc.errors || []) console.log(`  ${e.code} ${e.address ?? e.pointer}: ${e.message}`);
  if (r.written.length) console.log(`  wrote ${r.written.join(', ')} in ${r.dir}`);
  process.exit(rc.status === 'fail' ? 1 : 0);
} else if (cmd === 'make') {
  if (!a || !b || !id) fail(USAGE);
  const after = fs.statSync(b).isDirectory() ? path.resolve(b) : JSON.parse(fs.readFileSync(b, 'utf8'));
  const req = await makeRequest(path.resolve(a), after, { schemas, id, by, reason });
  const text = `${JSON.stringify(req, null, 2)}\n`;
  if (out) fs.writeFileSync(out, text); else process.stdout.write(text);
  if (!req.changes.length) { console.error('no exposed input changed'); process.exit(1); }
} else if (cmd === 'rights') {
  if (!a) fail(USAGE);
  const dir = path.resolve(a);
  if (fs.existsSync(path.join(dir, 'kit.json'))) console.log(JSON.stringify(kitRightsTable(JSON.parse(fs.readFileSync(path.join(dir, 'kit.json'), 'utf8'))), null, 2));
  else {
    const exp = loadExperience(await folderSource(dir), schemas).experience;
    if (!exp) fail(`${a} does not load as an experience`);
    console.log(JSON.stringify(rightsTable(exp), null, 2));
  }
} else fail(USAGE);
