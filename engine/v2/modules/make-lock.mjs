// Makes the reviewed lock of this engine's own hosts (lock.json) and the digest line of each module's index.mjs.
// A module's digest is sha256 over every file its bundle carries from its own folder: index.mjs (with its digest line
// blanked, since it holds the digest) and each file it imports there, in path order, each as "<path>\n<text>\n" with
// LF line ends, so a Windows checkout gives the same digest. The engine's own files it imports (src/modules.mjs) are
// the engine's, reviewed with it. The packer recomputes it and refuses a module whose bytes differ from lock.json.
// Run it after a reviewed change to a module's code: node engine/v2/modules/make-lock.mjs
// Usage with --check: exit 1 when lock.json or a digest line is stale (the fast tests do the same).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// The modules this engine has: [{name, version, file, index}]. The version is the manifest's (spec/2.0/capabilities).
export const MODULES = [{ name: 'chess', version: '0.1.0' }, { name: 'chess-opponent', version: '0.1.0' }].map(m => ({ ...m, file: path.join(here, m.name, `${m.name}.mjs`), index: path.join(here, m.name, 'index.mjs') }));

const DIGEST_LINE = /^export const digest = '[^']*';$/m;
const lf = (t) => t.replace(/\r\n/g, '\n');
// The files of a module's bundle in its own folder: index.mjs and every file it reaches by a relative import that
// stays in that folder, sorted. m: {index} (an entry of MODULES, or one like it).
export function moduleFiles(m) {
  const dir = path.dirname(m.index);
  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const x of lf(fs.readFileSync(file, 'utf8')).matchAll(/^\s*(?:import|export)\b[^'"]*?\bfrom\s*['"](\.{1,2}\/[^'"]+)['"]|^\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/gm)) {
      const to = path.resolve(path.dirname(file), x[1] ?? x[2]);
      const rel = path.relative(dir, to);
      if (!rel.startsWith('..') && !path.isAbsolute(rel)) walk(to);
    }
  };
  walk(m.index);
  return [...seen].map(f => path.relative(dir, f).split(path.sep).join('/')).sort();
}
// The digest of a module: m is an entry of MODULES (or {index}), or a module name.
export function moduleDigest(m) {
  if (typeof m === 'string') m = MODULES.find(x => x.name === m);
  const dir = path.dirname(m.index);
  const h = crypto.createHash('sha256');
  for (const rel of moduleFiles(m)) {
    let text = lf(fs.readFileSync(path.join(dir, ...rel.split('/')), 'utf8'));
    if (rel === 'index.mjs') text = text.replace(DIGEST_LINE, "export const digest = '';");
    h.update(`${rel}\n${text}\n`, 'utf8');
  }
  return 'sha256:' + h.digest('hex');
}
// {lock, indexes: {file: text}}: what the files should hold.
export function expected() {
  const lock = {}; const indexes = {};
  for (const m of MODULES) {
    const d = moduleDigest(m);
    lock[`${m.name}@${m.version}`] = d;
    indexes[m.index] = fs.readFileSync(m.index, 'utf8').replace(DIGEST_LINE, `export const digest = '${d}';`);
  }
  return { lock, indexes, lockText: JSON.stringify(lock, null, 2) + '\n' };
}
export const lockFile = path.join(here, 'lock.json');

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const e = expected();
  const stale = [];
  if (!fs.existsSync(lockFile) || fs.readFileSync(lockFile, 'utf8').replace(/\r\n/g, '\n') !== e.lockText) stale.push(lockFile);
  for (const [f, t] of Object.entries(e.indexes)) if (fs.readFileSync(f, 'utf8') !== t) stale.push(f);
  if (process.argv.includes('--check')) { for (const f of stale) console.log(`stale: ${path.relative(process.cwd(), f)}`); process.exit(stale.length ? 1 : 0); }
  fs.writeFileSync(lockFile, e.lockText);
  for (const [f, t] of Object.entries(e.indexes)) fs.writeFileSync(f, t);
  console.log(`wrote ${Object.keys(e.lock).length} lock entries: ${Object.entries(e.lock).map(([k, v]) => `${k} ${v}`).join(', ')}`);
}
