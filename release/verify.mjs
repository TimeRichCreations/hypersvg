// Standalone export hygiene check; diagnostics never include matched secret values.
import fs from 'node:fs/promises';
import path from 'node:path';
import {constants} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {scan, safeName} from './scan.mjs';
import {protectedPath,policy,lifted,decide} from './policy.mjs';

// An export's own records sit under release/, not at its root (the root is for the people who use it).
export const POLICY_FILE='release/EXPORT-POLICY.txt', REPORT_FILE='release/EXPORT-REPORT.md';
// The files the exporter writes itself (release/export.mjs). Every other file must be one the policy includes (R09):
// the check is an allowlist gate, not only a list of exclusions.
// The public words check: release/public-words.json lists refused patterns and exact allowed exceptions. Where an
// export carries that file, verifyExport refuses every file whose name or text matches a refused pattern.
export const WORDS_FILE='release/public-words.json';
// The public decision index: every decision number (D and a number) an exported file cites has an entry there.
export const DECISION_INDEX='spec/2.0/decision-index.md';
export const GENERATED=new Set(['README.md','GUIDE.md','AGENTS.md','EXTENDING.md','CONTRIBUTING.md','package.json','LICENSE','.gitattributes',POLICY_FILE,REPORT_FILE,'.github/workflows/checks.yml','.github/workflows/checks.mjs']);

export function safePath(name) {
  return typeof name === 'string' && name.length > 0 && !/[\\:\x00-\x1f\x7f<>"|?*]/.test(name) &&
    name.split('/').every(p => p && p !== '.' && p !== '..' && !/[ .]$/.test(p) &&
      !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p));
}
export function scanBytes(name, bytes) {
  const found = [...scan(name, bytes), ...scan('', name)];
  if (found.length) throw Error('Secret/private-path scan failed: ' + safeName(name) + '; ' + found.map(f => f.rule + (f.line ? ' at line ' + f.line : '')).join(', '));
}
export async function readRegular(file) {
  const entry = await fs.lstat(file);
  if (!entry.isFile() || entry.isSymbolicLink()) throw Error('Export needs a regular file');
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try { if (!(await handle.stat()).isFile()) throw Error('Export needs a regular file'); return await handle.readFile(); }
  finally { await handle.close(); }
}
// Read the words file: each refused pattern with its reason, each allowed exception with its reason.
export function publicWords(text) {
  const list = JSON.parse(String(text));
  if (!Array.isArray(list.refuse) || !Array.isArray(list.allow)) throw Error('Invalid public words file: it needs refuse and allow lists');
  for (const r of [...list.refuse, ...list.allow]) if (typeof r.reason !== 'string' || !r.reason) throw Error('Invalid public words file: every entry needs a reason');
  return {
    refuse: list.refuse.map(r => ({ re: new RegExp(r.pattern, 'g' + (r.flags || '').replace(/g/g, '')), reason: r.reason })),
    allow: list.allow.map(a => { if (typeof a.text !== 'string' || !a.text) throw Error('Invalid public words file: an allow entry needs its exact text'); return { text: a.text, file: a.file, reason: a.reason }; })
  };
}
const BINARY = /\.(?:png|jpe?g|gif|webp|avif|wav|ogg|mp3|mp4|webm|woff2?|ttf|otf|tgz|zip|ico)$/i;
// Every refused word in one file: {file, line, reason}. Line 0 is the file's name. A match is allowed when an allow
// entry for this file (or for every file) covers it on the same line.
export function refusedWords(name, bytes, words) {
  if (name === WORDS_FILE) return [];
  const found = [], text = BINARY.test(name) ? '' : Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes);
  const lines = [name, ...(text ? text.split(/\r?\n/) : [])];
  lines.forEach((line, n) => {
    for (const rule of words.refuse) {
      rule.re.lastIndex = 0; let m;
      while ((m = rule.re.exec(line))) {
        const from = m.index, to = from + m[0].length;
        const allowed = words.allow.some(a => (!a.file || a.file === name) && covers(line, a.text, from, to));
        if (!allowed) found.push({ file: name, line: n, reason: rule.reason });
        if (!m[0].length) rule.re.lastIndex++;
      }
    }
  });
  return found;
}
// The numbers the decision index explains: its lines "- **D<number> <title>.** ...".
export function decisionEntries(text) {
  return new Set([...String(text).matchAll(/^- \*\*D(\d+) /gm)].map(m => Number(m[1])));
}
// Every decision number one file cites that the index does not explain: {file, line, number}.
export function unexplainedDecisions(name, bytes, entries) {
  if (BINARY.test(name)) return [];
  const found = [];
  (Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes)).split(/\r?\n/).forEach((line, n) => {
    for (const m of line.matchAll(/\bD(\d{1,3})\b/g)) if (!entries.has(Number(m[1]))) found.push({ file: name, line: n + 1, number: Number(m[1]) });
  });
  return found;
}
function covers(line, text, from, to) {
  for (let i = line.indexOf(text); i >= 0; i = line.indexOf(text, i + 1)) if (i <= from && to <= i + text.length) return true;
  return false;
}
export async function verifyExport(root,{policyBytes,words}={}) {
  if (!(await fs.lstat(root)).isDirectory() || (await fs.lstat(root)).isSymbolicLink()) throw Error('Export needs a real directory');
  const declared = await readRegular(path.join(root, ...POLICY_FILE.split('/')));
  if (policyBytes && !declared.equals(policyBytes)) throw Error('Export policy changed during checks');
  const rules = policy(declared.toString()), exclusions = rules.filter(r => !r.include), lift = lifted(rules);
  const fixtures = new Set();
  // The words check runs where the export carries its words file (the hypersvg base), or with the words given.
  let wordRules = words || null;
  if (!wordRules) { try { wordRules = publicWords(await readRegular(path.join(root, ...WORDS_FILE.split('/')))); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
  const refused = [];
  // The decision check runs where the export carries the decision index.
  let decisions = null;
  try { decisions = decisionEntries(await readRegular(path.join(root, ...DECISION_INDEX.split('/')))); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const unexplained = [];
  const files = [], seen = new Set();
  async function walk(dir, prefix = '') {
    for (const item of (await fs.readdir(dir, {withFileTypes:true})).sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      // A published repository's own checks run in a git checkout: its top-level .git folder is git's, not exported
      // content. A .git folder anywhere deeper is still a protected subtree.
      if (prefix === '' && item.name === '.git' && item.isDirectory() && !item.isSymbolicLink()) continue;
      const name = prefix + item.name, file = path.join(dir, item.name);
      if (!safePath(name)) throw Error('Export contains a nonportable path');
      if (protectedPath(name, lift)) throw Error('Export contains a protected subtree');
      if (seen.has(name.toLowerCase())) throw Error('Export contains a case-colliding path');
      seen.add(name.toLowerCase());
      scanBytes(name, '');
      if (item.isSymbolicLink()) throw Error('Export contains a non-regular entry');
      if (item.isDirectory()) await walk(file, name + '/');
      else {
        if (!item.isFile()) throw Error('Export contains a non-regular entry');
        if (!fixtures.has(name) && exclusions.some(r => r.test.test(name))) throw Error('Export contains an excluded policy path: ' + safeName(name));
        if (!GENERATED.has(name) && !decide(name, rules).include) throw Error('Export contains a file the policy does not include: ' + safeName(name));
        const bytes = await readRegular(file); scanBytes(name, bytes);
        if (wordRules) refused.push(...refusedWords(name, bytes, wordRules));
        if (decisions) unexplained.push(...unexplainedDecisions(name, bytes, decisions));
        files.push({name, size:bytes.length, hash:createHash('sha256').update(bytes).digest('hex')});
      }
    }
  }
  await walk(root);
  if (unexplained.length) throw Error(`Export cites ${unexplained.length} decision number${unexplained.length === 1 ? '' : 's'} that ${DECISION_INDEX} does not explain: ` +
    unexplained.slice(0, 40).map(f => `${safeName(f.file)}:${f.line} D${f.number}`).join('; ') + (unexplained.length > 40 ? '; ...' : ''));
  if (refused.length) throw Error(`Export contains ${refused.length} refused word${refused.length === 1 ? '' : 's'} (${WORDS_FILE}): ` +
    refused.slice(0, 40).map(f => `${safeName(f.file)}:${f.line} ${f.reason}`).join('; ') + (refused.length > 40 ? '; ...' : ''));
  // Every export carries the repository's LICENSE (Apache-2.0, the person's choice), unchanged.
  if (!files.some(f => f.name === 'LICENSE')) throw Error('Missing licence: LICENSE');
  if (files.some(f => f.name === 'LICENSE-TODO.md')) throw Error('Invalid licence: LICENSE-TODO.md is replaced by LICENSE');
  const licence = (await readRegular(path.join(root, 'LICENSE'))).toString();
  if (!licence.includes('Apache License') || !licence.includes('Version 2.0, January 2004')) throw Error('Invalid licence: LICENSE is not the Apache-2.0 text');
  // Every export keeps LF line endings on every system (a Windows clone would otherwise get CRLF and other bytes).
  if (!files.some(f => f.name === '.gitattributes')) throw Error('Missing .gitattributes (LF line endings)');
  if (!/^\*\s+text=auto\s+eol=lf\s*$/m.test((await readRegular(path.join(root, '.gitattributes'))).toString())) throw Error('Invalid .gitattributes: it must say "* text=auto eol=lf"');
  return files;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { if (process.argv.length !== 3) throw Error('Usage: node release/verify.mjs <export-folder>'); const files = await verifyExport(path.resolve(process.argv[2])); console.log(`Export hygiene PASS: ${files.length} files; secrets, private paths and licence checked.`); }
  catch (e) { console.error(scan('', e.message).length ? 'Export verification failed; sensitive diagnostic withheld.' : e.message); process.exitCode = 1; }
}
