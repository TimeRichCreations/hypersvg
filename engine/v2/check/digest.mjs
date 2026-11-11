// Document digests (A9.3), one function for every tool: the checker (E-KIT-PIN), the change tool's receipts and the
// packer. A JSON document's digest is canonical {document, files} and one LF; `files` holds each drawing and resource
// it names by the digest of its bytes, and each JSON document it names (scenes, blocks, the shell, rule packs,
// samples, listed experiences) by that document's own digest, followed all the way down. Node only.
import crypto from 'node:crypto';

export const sha = (bytes) => `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;

// Canonical JSON (RFC 8785): compact, keys sorted by UTF-16 code units, ECMAScript numbers, minimal escapes.
export function canonical(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
}
// A JSON document's digest from its named files' digests; about.trust.digest, review and signature removed.
export function documentDigest(doc, files = {}) {
  const d = structuredClone(doc);
  const t = d?.about?.trust;
  if (t && typeof t === 'object') { delete t.digest; delete t.review; delete t.signature; }
  return sha(Buffer.from(`${canonical({ document: d, files })}\n`, 'utf8'));
}

// Joins a folder-relative directory and a relative path with '/'. Returns null when it climbs above the folder.
export function join(dir, rel) {
  const out = [];
  for (const p of [...(dir ? dir.split('/') : []), ...String(rel).split('/')]) {
    if (p === '..') { if (!out.length) return null; out.pop(); } else if (p && p !== '.') out.push(p);
  }
  return out.join('/');
}
export const dirOf = (rel) => rel.split('/').slice(0, -1).join('/');

// The JSON documents a document names, by path relative to it.
function namedDocuments(doc) {
  const out = [];
  const add = (v) => { if (typeof v === 'string' && v.endsWith('.json')) out.push(v); };
  for (const v of Object.values(doc.story?.scenes || {})) add(v);
  for (const v of Object.values(doc.blocks || {})) add(v);
  add(doc.shell);
  for (const v of Array.isArray(doc.rulePacks) ? doc.rulePacks : []) add(v);
  for (const v of Object.values(doc.samples || {})) add(v);
  return out;
}
// The files a document names by their bytes: drawings and resources.
function namedFiles(doc) {
  const out = [];
  if (typeof doc.drawing === 'string') out.push(doc.drawing);
  for (const l of Array.isArray(doc.layouts) ? doc.layouts : []) if (typeof l?.drawing === 'string') out.push(l.drawing);
  for (const r of Object.values(doc.resources || {})) if (typeof r?.file === 'string') out.push(r.file);
  return out;
}
// A file's bytes from a source ({read, bytes?}), or null.
function bytesAt(source, rel) {
  const b = source.bytes?.(rel);
  if (b) return Buffer.from(b);
  const t = source.read(rel);
  return t == null ? null : Buffer.from(t, 'utf8');
}
function readJson(source, rel) {
  const text = source.read(rel);
  if (text == null) return null;
  try { return JSON.parse(text); } catch { return null; }
}

// The digest of the JSON document at rel, or null when rel is not JSON. A kit experience covers its kit only through
// the pin object in its document.
export function digestAt(source, rel, seen = new Set()) {
  const doc = readJson(source, rel);
  if (!doc || typeof doc !== 'object') return null;
  return digestOf(source, rel, doc, seen);
}
export function digestOf(source, rel, doc, seen = new Set()) {
  if (seen.has(rel)) return null;
  const inner = new Set([...seen, rel]);
  const dir = dirOf(rel);
  const files = {};
  for (const f of namedFiles(doc)) {
    const at = join(dir, f);
    const b = at === null ? null : bytesAt(source, at);
    if (b) files[f] = sha(b);
  }
  for (const f of namedDocuments(doc)) {
    const at = join(dir, f);
    const d = at === null ? null : digestAt(source, at, inner);
    if (d) files[f] = d;
  }
  return documentDigest(doc, files);
}
