// The one rename list (spec/2.0/renames.json, 11.5, A13.4): it is generated from its two tables and stays in step;
// every pointer to 11.5 names a heading; no target names a word that was itself renamed. No browser.
import fs from 'node:fs';
import path from 'node:path';
import { renamesJson, target } from '../tools/make-renames.mjs';
import { spec, eq, ok } from './helpers.mjs';

const read = (...p) => fs.readFileSync(path.join(spec, ...p), 'utf8');
const chapters = () => [
  ...fs.readdirSync(spec).filter(f => /^\d\d-.*\.md$/.test(f)),
  ...fs.readdirSync(path.join(spec, 'reference')).filter(f => f.endsWith('.md')).map(f => path.join('reference', f)),
];
const headings = () => {
  const out = new Set();
  for (const f of chapters()) for (const l of read(f).split(/\r?\n/)) { const m = l.match(/^#{1,4} (A?\d+(?:\.\d+)*)\.? /); if (m) out.add(m[1]); }
  return out;
};
// Words a target must not use: each was renamed in 2.0 (11.5).
const OLD = [/data-hsvg-(?:paint|look|color-role|type-role|region|icon|anchor|side|safe-area|follows)\b/, /\b(?:press|option) controls?\b/,
  /`press` control/, /binding `look`/, /\blooks?\b/, /`resetSaved`/, /\b(?:draw|opacity|reveal)\(/];

export const tests = {
  'renames.json is the file make-renames.mjs writes from A13.4 and 11.5 (run it after changing either table)': () => {
    ok(fs.readFileSync(target, 'utf8') === renamesJson(), 'spec/2.0/renames.json is stale: run node engine/v2/tools/make-renames.mjs');
  },
  'renames.json holds the 0.1 rows and the words renamed while 2.0 was drafted': () => {
    const rows = JSON.parse(read('renames.json')).rows;
    ok(rows.some(r => r.row === 'K-01'), 'the error codes of A13.4 are in');
    const r = (from) => rows.find(x => x.row.startsWith('R-') && x.from.includes(from));
    ok(r('"kind": "press"')?.to.includes('"kind": "button"'), 'press is now button');
    ok(r('data-hsvg-look')?.to.includes('data-hsvg-variant'), 'the look mark is now the variant mark');
    ok(r('motion channel `translate-x`')?.to.includes('move-x'), 'translate-x is now move-x');
    eq(new Set(rows.map(x => x.row)).size, rows.length, 'row ids are unique');
  },
  'no rename target names a word that was itself renamed': () => {
    const bad = JSON.parse(read('renames.json')).rows.filter(r => OLD.some(re => re.test(r.to))).map(r => `${r.row}: ${r.to}`);
    eq(bad, [], 'targets in the final words');
  },
  'every pointer to 11.5 names a heading, E-WORD-RENAMED points there, and nothing cites the missing 5.15.2': () => {
    const heads = headings();
    ok(heads.has('11.5'), '11.5 Renamed words exists');
    const codes = JSON.parse(read('errors.json')).codes;
    ok(codes.find(e => e.code === 'E-WORD-RENAMED')?.where.includes('11.5'), 'E-WORD-RENAMED points to 11.5');
    ok(!heads.has('5.15.2'), '5.15 has no 5.15.2 (its calls are 5.15.3)');
    const cites = (text) => /(^|[^\d.])5\.15\.2(?![\d])/.test(text);
    const bad = ['errors.json', 'capabilities.json', ...chapters()].filter(f => cites(read(f)));
    eq(bad, [], 'no file cites 5.15.2');
  },
};
