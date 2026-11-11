// File paths and drawing ownership (2.1 rule 6, 2.4, 2.10, 10.8): E-PATH, E-DRAWING-OWNER, W-FILE-UNUSED.
// Every path a document names is checked against the portable names (vocabularies.json, portableNames), and each
// drawing belongs to one document. W-FILE-UNUSED needs a listing of the folder: it runs only when source.list() exists.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const portable = JSON.parse(fs.readFileSync(path.join(here, '..', '..', '..', 'spec', '2.0', 'vocabularies.json'), 'utf8')).portableNames;
const RANGES = portable.allowed.codePointRanges.map(r => r.split('-').map(h => parseInt(h, 16))).map(([a, b]) => [a, b ?? a]);
const DEVICES = new Set(portable.reservedWindowsNames);
const dirOf = (rel) => rel.split('/').slice(0, -1).join('/');

const allowedChar = (ch) => {
  if (/^[A-Za-z0-9_.-]$/.test(ch)) return true;
  const cp = ch.codePointAt(0);
  return RANGES.some(([a, b]) => cp >= a && cp <= b);
};
// The fixed case fold (10.8): add 32 to the listed ranges, then the small map.
const FOLD_RANGES = portable.caseFold.add32.map(r => r.split('-').map(h => parseInt(h, 16))).map(([a, b]) => [a, b ?? a]);
export function fold(s) {
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    const hex = cp.toString(16).toUpperCase().padStart(4, '0');
    if (hex in portable.caseFold.map) { const v = portable.caseFold.map[hex]; out += /^[0-9A-F]{4}$/.test(v) ? String.fromCodePoint(parseInt(v, 16)) : v; }
    else if (FOLD_RANGES.some(([a, b]) => cp >= a && cp <= b)) out += String.fromCodePoint(cp + 32);
    else out += ch;
  }
  return out;
}

// Why a path as written is not portable, or null. `written` is the authored string.
export function badPath(written) {
  if (typeof written !== 'string' || written === '') return 'is empty';
  if (written.includes('\\')) return 'has a backslash';
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(written) || written.startsWith('//')) return 'is a URL or a drive path';
  if (written.startsWith('/')) return 'is an absolute path';
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(written)) return 'has a control character';
  if (Buffer.byteLength(written, 'utf8') > portable.maxPathBytes) return `is over ${portable.maxPathBytes} bytes`;
  for (const seg of written.split('/')) {
    if (seg === '' ) return 'has an empty segment';
    if (seg === '.') return 'has a "." segment';
    if (seg === '..') continue;
    for (const ch of seg) if (!allowedChar(ch)) return `has the character "${ch}", which is not in the portable names`;
    if (seg.endsWith('.')) return 'has a segment that ends with a dot';
    const stem = fold(seg).split('.')[0].toUpperCase();
    if (DEVICES.has(stem)) return `has the Windows device name "${seg}"`;
  }
  return null;
}

// Joins a path to a folder. Returns null when the path leaves the folder of the experience.
export function resolveInside(dir, rel) {
  const out = dir ? dir.split('/') : [];
  for (const p of rel.split('/')) {
    if (p === '..') { if (!out.length) return null; out.pop(); } else if (p && p !== '.') out.push(p);
  }
  return out.join('/');
}

// Every file path a document names: [path as written, pointer].
function namedPaths(doc) {
  const out = [];
  if (typeof doc.drawing === 'string') out.push([doc.drawing, '/drawing']);
  (doc.layouts || []).forEach((l, i) => { if (l && typeof l.drawing === 'string') out.push([l.drawing, `/layouts/${i}/drawing`]); });
  for (const [k, r] of Object.entries(doc.resources || {})) if (r && typeof r.file === 'string') out.push([r.file, `/resources/${k}/file`]);
  for (const [k, f] of Object.entries(doc.story?.scenes || {})) if (typeof f === 'string') out.push([f, `/story/scenes/${k}`]);
  for (const [k, f] of Object.entries(doc.blocks || {})) if (typeof f === 'string') out.push([f, `/blocks/${k}`]);
  if (typeof doc.shell === 'string') out.push([doc.shell, '/shell']);
  return out;
}

export function check(ctx) {
  const exp = ctx.experience;
  // A symbolic link in the folder (R03): never followed, so the file it names would be missing from the pack.
  for (const rel of ctx.source?.links?.() || []) ctx.report('E-PATH', rel, '', `${rel} is a symbolic link: the folder holds its own files, never links (they are not followed, so the page would miss it). Copy the file in place of the link`);
  const docs = [{ file: exp.file, doc: exp.doc }];
  for (const s of Object.values(exp.scenes)) docs.push(s);
  for (const b of Object.values(exp.blocks)) docs.push(b);
  if (exp.shell) docs.push(exp.shell);

  // E-PATH: each named path, then collisions among the resolved files.
  const resolved = new Map(); // folded path -> first real path
  const named = new Set();
  for (const d of docs) {
    for (const [written, at] of namedPaths(d.doc)) {
      const why = badPath(written);
      if (why) { ctx.report('E-PATH', d.file, at, `"${written}" ${why}`); continue; }
      const full = resolveInside(dirOf(d.file), written);
      if (full === null) { ctx.report('E-PATH', d.file, at, `"${written}" leaves the folder of the experience`); continue; }
      named.add(full);
      const key = fold(full);
      if (resolved.has(key) && resolved.get(key) !== full) ctx.report('E-PATH', d.file, at, `"${full}" collides with "${resolved.get(key)}" under the case fold`);
      else resolved.set(key, full);
    }
  }
  // a file that is also another file's parent
  for (const f of named) for (const g of named) if (g.startsWith(`${f}/`)) ctx.report('E-PATH', f, '', `"${f}" is a file and also the parent of "${g}"`);

  // E-DRAWING-OWNER (2.10 rule 4): one drawing file, one document.
  const owner = new Map();
  for (const d of docs) {
    const files = new Set(Object.values(d.drawings || {}).map(x => x.file));
    for (const f of files) {
      if (owner.has(f) && owner.get(f) !== d.file) ctx.report('E-DRAWING-OWNER', d.file, '/drawing', `${f} is also the drawing of ${owner.get(f)}`);
      else owner.set(f, d.file);
    }
  }

  // W-FILE-UNUSED (2.4): a listed file that nothing names.
  if (typeof ctx.source.list === 'function') {
    const used = new Set([...named, exp.file, 'package.json']);
    for (const d of docs) for (const x of Object.values(d.drawings || {})) used.add(x.file);
    for (const rel of ctx.source.list()) {
      if (used.has(rel) || /^(evidence|tests)\//.test(rel)) continue;
      ctx.report('W-FILE-UNUSED', rel, '', `${rel} is named by no document or drawing`);
    }
  }
}
