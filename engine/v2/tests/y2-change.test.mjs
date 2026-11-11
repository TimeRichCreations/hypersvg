// Change requests against one revision. Two changes with the same expected digest
// cannot both commit; a failed write leaves nothing half done, so a retry passes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repo, schemas, eq, ok } from './helpers.mjs';
import { applyChange } from '../tools/change/apply.mjs';
import { readFolder, memorySource, digestAt } from '../tools/change/folder.mjs';
import { folderSource } from '../src/load.mjs';

// Each test runs twice: on the kit ads (an add-on test: the ads come with the add-ons release) and on the core kit
// fixture (engine/v2/tests/kit-fixture), which the core release holds.
const CASES = {
  ad: { root: path.join(repo, 'examples', '2.0-kit-ads'), dir: ['ads', 'ad-300x250'], target: 'ad-300x250', word: 'headline',
    address: 'ad-300x250/open/headline@en', old: 'Rain? Bring it on.' },
  core: { root: path.join(repo, 'engine', 'v2', 'tests', 'kit-fixture'), dir: ['tales', 'fox-tale'], target: 'fox-tale', word: 'heading',
    address: 'fox-tale/first/heading@en', old: 'Fox finds a feather.' },
};
const NOW = '2026-11-08T10:00:00Z';
const COPY = { source: 'agent', right: 'copywriter', who: 'agent:rio' };
const copyOf = (c) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-y2-')); fs.cpSync(c.root, d, { recursive: true }); return path.join(d, ...c.dir); };
const digestOfFolder = async (dir) => digestAt(memorySource(readFolder(dir), await folderSource(dir)), 'experience.json');
const headline = (c, id, expected, text) => ({ format: 'hsvg/2.0', kind: 'change', id, at: 'edit', target: c.target, expected, by: COPY, reason: 'A test edit',
  changes: [{ address: c.address, old: c.old, new: text }] });
const apply = (dir, req) => applyChange(dir, req, { schemas: schemas(), now: NOW, by: req.by });
const words = (ad) => fs.readFileSync(path.join(ad, 'words', 'en.csv'), 'utf8');

async function twoChanges(c) {
  const ad = copyOf(c);
  const expected = await digestOfFolder(ad);
  const [a, b] = await Promise.all([apply(ad, headline(c, 'edit-first', expected, 'FIRST')), apply(ad, headline(c, 'edit-second', expected, 'SECOND'))]);
  const statuses = [a.receipt.status, b.receipt.status].sort();
  eq(statuses, ['fail', 'pass'], 'exactly one passes');
  const [won, lost] = a.receipt.status === 'pass' ? [a, b] : [b, a];
  ok(lost.receipt.errors.some(e => e.code === 'E-CHANGE-STALE'), 'the other is stale');
  eq(lost.written, []);
  ok(words(ad).includes(`${c.word},${won === a ? 'FIRST' : 'SECOND'}`), 'disk holds the winner');
  eq(won.receipt.digest, await digestOfFolder(ad), 'the winner\'s digest is the one on disk');
}
async function failedWrite(c) {
  const ad = copyOf(c);
  const req = headline(c, 'edit-io', await digestOfFolder(ad), 'WRITTEN');
  const before = words(ad);
  const write = fs.writeFileSync;
  fs.writeFileSync = (file, ...rest) => { if (String(file).includes(`${path.sep}changes${path.sep}`)) throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' }); return write(file, ...rest); };
  let failed = null;
  try { await apply(ad, req); } catch (e) { failed = e.code; } finally { fs.writeFileSync = write; }
  eq([failed, words(ad) === before], ['ENOSPC', true], 'the error reaches the caller and nothing changed');
  const r = await apply(ad, req);
  eq(r.receipt.status, 'pass', 'the retry passes');
  ok(words(ad).includes(`${c.word},WRITTEN`));
}

export const tests = {
  async 'Y2.7 two changes against the same revision: one commits, the other is refused as stale'() { await twoChanges(CASES.ad); },
  async 'Y2.7 a failed receipt write leaves nothing written, so the same request passes on retry'() { await failedWrite(CASES.ad); },
  async 'core kit: Y2.7 two changes against the same revision: one commits, the other is refused as stale'() { await twoChanges(CASES.core); },
  async 'core kit: Y2.7 a failed receipt write leaves nothing written, so the same request passes on retry'() { await failedWrite(CASES.core); },
};
