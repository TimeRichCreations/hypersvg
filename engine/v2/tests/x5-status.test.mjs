// The one status table (spec/2.0/README.md, under <!-- status -->) tells the truth, as far as files
// can show it: every evidence path exists, every status is one of the six words, every capability in the registry and
// every draft in spec/2.0/drafts/ has its row, and the engine README points to the table instead of keeping its own.
import fs from 'node:fs';
import path from 'node:path';
import { repo, spec, eq, ok } from './helpers.mjs';

const STATUS = new Set(['built', 'built in part', 'not built', 'experimental (2.1)', 'draft (2.1)', 'planned (2.1)']);
function rows() {
  const text = fs.readFileSync(path.join(spec, 'README.md'), 'utf8');
  const at = text.indexOf('<!-- status -->');
  ok(at > 0, 'spec/2.0/README.md has no <!-- status --> table');
  const lines = text.slice(at).split('\n').slice(1);
  const table = lines.slice(0, lines.findIndex(l => !l.startsWith('|')));
  return table.slice(2).map(l => { const c = l.slice(1, -1).split(' | ').map(x => x.trim()); return { area: c[0], sections: c[1], status: c[2], evidence: c[3], notes: c[4], line: l }; });
}

export const tests = {
  'X5.14 the status table: six status words, every evidence file exists'() {
    const r = rows();
    ok(r.length >= 30, `only ${r.length} rows`);
    for (const x of r) {
      ok(STATUS.has(x.status), `${x.area}: status "${x.status}" is not one of ${[...STATUS].join(', ')}`);
      const paths = [...x.evidence.matchAll(/`([^`]+)`/g)].map(m => m[1]);
      ok(paths.length >= 1, `${x.area}: no evidence`);
      for (const p of paths) ok(fs.existsSync(path.join(repo, ...p.split('/'))), `${x.area}: evidence ${p} does not exist`);
      if (x.status === 'built') ok(paths.some(p => /\/tests\//.test(p)), `${x.area}: a built row names a test`);
      if (x.status === 'draft (2.1)') ok(paths.some(p => p.startsWith('spec/2.0/drafts/')), `${x.area}: a draft row names its draft`);
    }
  },
  'X5.14 every capability in the registry and every draft has its row'() {
    const r = rows();
    const caps = JSON.parse(fs.readFileSync(path.join(spec, 'capabilities.json'), 'utf8')).capabilities;
    for (const c of caps) {
      // widgets was the shell capability; the status row in spec/2.0/README.md (prose, B2's) keeps the old
      // name until B2 renames it.
      const was = { widgets: 'shell' }[c.name];
      const row = r.find(x => x.area === `Capability \`${c.name}\`` || x.area === `Module \`${c.name}\`` || (was && x.area === `Capability \`${was}\``));
      ok(row, `capability ${c.name} has no row`);
      ok(row.status.startsWith('built'), `capability ${c.name} is in the 2.0 registry, so its row says built: ${row.status}`);
    }
    const drafts = fs.readdirSync(path.join(spec, 'drafts')).filter(f => f !== 'README.md');
    for (const f of drafts) ok(r.some(x => x.evidence.includes(`spec/2.0/drafts/${f}`)), `draft ${f} has no row`);
  },
  'X5.14 the engine README points to the one table and keeps no list of its own'() {
    const text = fs.readFileSync(path.join(repo, 'engine', 'v2', 'README.md'), 'utf8');
    ok(text.includes('spec/2.0/README.md#status'), 'the engine README links to the status table');
    eq(text.includes('## What is not built'), false, 'a second status list');
  },
};
