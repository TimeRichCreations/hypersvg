// Diagnostics of 10.12 rule 1: every finding gets `severity`, `line`, `column`, `pointer`, `address`, `reason` and `fix`.
// severity, reason and fix come from spec/2.0/errors.json; the finding's own `message` stays as the specific text.
// line and column are 1-based and left out for a whole-file problem or when the place cannot be found.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CODES = new Map(JSON.parse(fs.readFileSync(path.join(here, '..', '..', '..', 'spec', '2.0', 'errors.json'), 'utf8')).codes.map(c => [c.code, c]));

// Offsets of every value in a JSON text, by JSON Pointer. Returns a Map, or null when the text does not parse.
export function jsonOffsets(text) {
  const out = new Map();
  let i = 0;
  const ws = () => { while (i < text.length && /\s/.test(text[i])) i++; };
  const esc = (s) => String(s).replace(/~/g, '~0').replace(/\//g, '~1');
  const str = () => {
    const start = i; i++;
    while (i < text.length && text[i] !== '"') { if (text[i] === '\\') i++; i++; }
    i++;
    return JSON.parse(text.slice(start, i));
  };
  const value = (ptr) => {
    ws();
    out.set(ptr, i);
    const c = text[i];
    if (c === '{') {
      i++; ws();
      if (text[i] === '}') { i++; return; }
      for (;;) {
        ws(); const k = str(); ws();
        if (text[i] !== ':') throw new Error('colon');
        i++;
        const before = i; value(`${ptr}/${esc(k)}`);
        ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === '}') { i++; return; }
        throw new Error('object'); // eslint-disable-line no-unreachable
      }
    } else if (c === '[') {
      i++; ws();
      if (text[i] === ']') { i++; return; }
      for (let n = 0; ; n++) {
        value(`${ptr}/${n}`); ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === ']') { i++; return; }
        throw new Error('array');
      }
    } else if (c === '"') str();
    else { while (i < text.length && !/[\s,\]}]/.test(text[i])) i++; }
  };
  try { value(''); } catch { return null; }
  return out;
}

const lineCol = (text, offset) => {
  const before = text.slice(0, offset);
  const line = before.split('\n').length;
  return { line, column: offset - (before.lastIndexOf('\n') + 1) + 1 };
};

// A diagnostic's path as a JSON Pointer ("values.n.initial" and "/values/n/initial" are the same place). has(pointer)
// says whether the document holds a place, so a key with dots stays one token (pointerFrom).
function pointerOf(p, has = () => false) {
  if (typeof p !== 'string' || p === '') return '';
  if (p.startsWith('/')) return p;
  if (/^[A-Za-z_][\w-]*(\.[\w:-]+)*$/.test(p) && p.includes('.')) return pointerFrom(p, has);
  // "story.links[0].on" and "on.press:go[0].actions[1]" are places too (every message has its line, F0b).
  if (/^[A-Za-z_][\w-]*(\.[\w:-]+|\[\d+\])+$/.test(p)) return pointerFrom(p, has);
  return p;
}

// A dotted path's tokens joined into a JSON Pointer. A key may hold dots: an add-on id (addons.example.glow), an
// event of one (on.example.glow:faded), a pin (example.glow@1.0.0) or an input (message.headline). At each step the
// longest run of dotted words that the document holds as one key is one token; else one word is.
function pointerFrom(p, has) {
  const esc = (t) => t.replace(/~/g, '~0').replace(/\//g, '~1');
  const tokens = p.replace(/\[(\d+)\]/g, '.$1').split('.');
  let out = '';
  for (let i = 0; i < tokens.length;) {
    let k = tokens.length - i;
    while (k > 1 && !has(`${out}/${esc(tokens.slice(i, i + k).join('.'))}`)) k--;
    out += `/${esc(tokens.slice(i, i + k).join('.'))}`;
    i += k;
  }
  return out;
}

// Whether a document holds the place a JSON Pointer names.
function docHas(doc, pointer) {
  let at = doc;
  for (const raw of pointer.slice(1).split('/')) {
    const t = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (at === null || typeof at !== 'object' || !Object.prototype.hasOwnProperty.call(at, t)) return false;
    at = at[t];
  }
  return true;
}

const LISTS = new Set(['bindings', 'uses', 'machines', 'layouts', 'rules', 'waivers', 'effects']);
const MAPS = new Set(['values', 'inputs', 'computed', 'outputs', 'controls', 'clips', 'resources', 'data', 'places', 'lines', 'addons', 'effects', 'dialogs']);

// The nearest stable address: the owning document's id, then the name that the pointer reaches.
function addressOf(owner, pointer, doc) {
  if (!owner) return undefined;
  const parts = pointer.startsWith('/') ? pointer.slice(1).split('/').map(s => s.replace(/~1/g, '/').replace(/~0/g, '~')) : [];
  const [head, name] = parts;
  if (head === undefined) return owner;
  if (LISTS.has(head) && Array.isArray(doc?.[head]) && name !== undefined) {
    const id = doc[head][Number(name)]?.id;
    return id ? `${owner}/${id}` : `${owner}/${head}/${name}`;
  }
  if (MAPS.has(head) && name !== undefined) return `${owner}/${name}`;
  return `${owner}/${head}`;
}

// source: {read(rel)}; experience: the loaded experience (for owner ids and documents); returns new diagnostics.
export function describe(diags, source, experience = null) {
  const docs = new Map(); // file -> {id, doc}
  if (experience) {
    docs.set(experience.file, { id: experience.doc?.id, doc: experience.doc });
    for (const e of [...Object.values(experience.scenes || {}), ...Object.values(experience.blocks || {}), experience.shell].filter(Boolean)) docs.set(e.file, { id: e.doc?.id, doc: e.doc });
  }
  const texts = new Map();
  const textOf = (file) => { if (!texts.has(file)) { let t = null; try { t = source.read(file); } catch { t = null; } texts.set(file, typeof t === 'string' ? t : null); } return texts.get(file); };
  const offsets = new Map();
  const offsetsOf = (file) => { if (!offsets.has(file)) { const t = textOf(file); offsets.set(file, t !== null && file.endsWith('.json') ? jsonOffsets(t) : null); } return offsets.get(file); };
  return diags.map((d) => {
    const meta = CODES.get(d.code);
    const out = { code: d.code, severity: meta?.severity ?? (String(d.code).startsWith('W-') ? 'warning' : 'error'), file: d.file };
    const text = d.file ? textOf(d.file) : null;
    const held = text !== null && d.file.endsWith('.json') ? offsetsOf(d.file) : null;
    let pointer = pointerOf(d.path, (q) => !!held?.has(q) || docHas(docs.get(d.file)?.doc, q));
    if (text !== null && d.file.endsWith('.json')) {
      const map = offsetsOf(d.file);
      if (map) {
        // the nearest enclosing place that exists
        let p = pointer.startsWith('/') ? pointer : '';
        while (p !== '' && !map.has(p)) p = p.slice(0, p.lastIndexOf('/'));
        if (pointer.startsWith('/') || pointer === '') Object.assign(out, map.has(p) && (p !== '' || pointer === '') ? lineCol(text, map.get(p)) : {});
      }
    } else if (text !== null && d.file.endsWith('.svg')) {
      const m = /\bline (\d+)\b/.exec(String(d.path));
      const id = /^#(.+)$/.exec(String(d.path))?.[1] ?? /<\w+ id="([^"]+)"/.exec(String(d.path))?.[1];
      if (m) {
        out.line = Number(m[1]);
        // the column of the element's <, found by its id on that line, else the line's first <
        const starts = [0]; for (let k = text.indexOf('\n'); k >= 0; k = text.indexOf('\n', k + 1)) starts.push(k + 1);
        const from = starts[out.line - 1] ?? 0; const to = starts[out.line] ?? text.length;
        let at = id ? text.indexOf(`id="${id}"`, from) : -1;
        if (at < 0 || at >= to) at = -1;
        const lt = at >= 0 ? text.lastIndexOf('<', at) : text.indexOf('<', from);
        if (lt >= from && lt < to) out.column = lt - from + 1;
      } else if (id) {
        const at = text.indexOf(`id="${id}"`);
        if (at >= 0) { const lc = lineCol(text, text.lastIndexOf('<', at)); out.line = lc.line; out.column = lc.column; }
      }
      if (id) pointer = id;
    }
    out.pointer = pointer;
    const owner = docs.get(d.file);
    const address = owner ? addressOf(owner.id, pointer, owner.doc) : undefined;
    if (address) out.address = address;
    out.message = d.message;
    if (meta) { out.reason = meta.reason; out.fix = meta.fix; }
    return out;
  });
}
