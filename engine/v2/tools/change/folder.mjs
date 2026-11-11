// An experience or kit folder held in memory, so a change runs on a copy and nothing is written until it passes
// (A9.2). Digests of JSON documents follow A9.3. Node only.
import fs from 'node:fs';
import path from 'node:path';
import { sha, join, dirOf, digestAt, digestOf } from '../../check/digest.mjs';

// Folders a change never reads or writes: evidence is never covered by a digest (A9.3).
const SKIP = new Set(['evidence', 'node_modules', '.git']);

// The digest helpers live in check/digest.mjs, shared with the checker (one kit digest, A9.3).
export { sha, join, dirOf, digestAt, digestOf };

// Every file of a folder: Map of '/'-joined relative path to its bytes (a Buffer).
export function readFolder(dir) {
  const files = new Map();
  const walk = (abs, rel) => {
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!(rel === '' && SKIP.has(e.name))) walk(path.join(abs, e.name), rel ? `${rel}/${e.name}` : e.name); } else if (e.isFile()) files.set(rel ? `${rel}/${e.name}` : e.name, fs.readFileSync(path.join(abs, e.name)));
    }
  };
  walk(dir, '');
  return files;
}

// Writes the files whose relative paths are listed (or every file) under dir.
export function writeFiles(dir, files, only = null) {
  for (const [rel, bytes] of files) {
    if (only && !only.has(rel)) continue;
    const abs = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, bytes);
  }
}

// A checker source over the files in memory. Paths it does not hold (a kit beside the folder, `kits/<id>/...`) go to
// the fallback source, a folderSource of the folder on disk.
export function memorySource(files, fallback = null) {
  return {
    read(rel) { if (files.has(rel)) return files.get(rel).toString('utf8'); return fallback ? fallback.read(rel) : null; },
    bytes(rel) { if (files.has(rel)) return new Uint8Array(files.get(rel)); return fallback?.bytes ? fallback.bytes(rel) : null; },
    kitDir: fallback?.kitDir,
  };
}

export function readJson(source, rel) {
  const text = source.read(rel);
  if (text == null) return null;
  try { return JSON.parse(text); } catch { return null; }
}

// The document with this id in the folder: experience.json or kit.json first, then any other JSON document.
export function findDocument(files, id) {
  for (const rel of ['experience.json', 'kit.json']) {
    const doc = parse(files.get(rel));
    if (doc?.id === id) return { rel, doc };
  }
  for (const [rel, bytes] of files) {
    if (!rel.endsWith('.json') || rel === 'experience.json' || rel === 'kit.json') continue;
    const doc = parse(bytes);
    if (doc && typeof doc.kind === 'string' && doc.id === id) return { rel, doc };
  }
  return null;
}
function parse(bytes) { if (!bytes) return null; try { return JSON.parse(bytes.toString('utf8')); } catch { return null; } }

// A JSON document written back: two-space indent and one final LF, the way the repo's documents are kept.
export const jsonBytes = (doc) => Buffer.from(`${JSON.stringify(doc, null, 2)}\n`, 'utf8');

// ---------- words files (2.7): CSV with the header id,text ----------
function csvRows(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const csvCell = (s) => (/[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
// The words of a words file: [[id, text]] in file order, or null.
export function readWords(text) {
  const rows = csvRows(text.replace(/^﻿/, ''));
  const head = rows.shift();
  if (!head || head[0] !== 'id' || head[1] !== 'text') return null;
  return rows.filter(r => !(r.length === 1 && r[0] === '')).map(r => [r[0], r[1] ?? '']);
}
export const writeWords = (list) => `id,text\n${list.map(([id, t]) => `${csvCell(id)},${csvCell(t)}`).join('\n')}\n`;
