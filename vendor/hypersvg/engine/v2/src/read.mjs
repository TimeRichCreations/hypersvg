// Stage 1 for the player: read a HyperSVG 2.0 experience from its files (2.1, 2.2, 2.10, 2.11). The source gives text
// by relative path: { read(rel) -> string | null } (sync) — a folder on disk in Node, a packed map in the browser.
// This module only parses: a packed page (schemas null: the packer has checked every file, 10.9) uses it alone, so its
// bundle carries the parsers and no checker (D19). Checking is a part the dev player and the tools pass in: src/load.mjs
// (loadExperience) gives the schema checker and the drawing checker (opts.checkers) and the kit loader (opts.kits).
// A kit experience is flattened by the packer (pack.mjs flattenKit); this module alone does not read kits.
import { parseStrict } from '../schema/json-strict.mjs';
import { raisedLimits, activeLimits } from './limits.mjs';

// A path named by a document, joined to the document's folder (2.1 rule 6). null when `..` would leave the
// experience's folder: the loader refuses it with E-PATH, never flattens it.
const join = (dir, rel) => {
  const parts = (dir ? dir.split('/') : []).concat(rel.split('/'));
  const out = [];
  for (const p of parts) { if (p === '..') { if (!out.length) return null; out.pop(); } else if (p && p !== '.') out.push(p); }
  return out.join('/');
};
const dirOf = (rel) => rel.split('/').slice(0, -1).join('/');

// Returns { ok, diags: [{file, code, path, message}], experience } where experience holds parsed documents and
// drawing texts: { doc, scenes: {id: {file, doc, drawings: {layoutId|'main': {file, text}}}}, blocks: {id: {...}} }.
export function readExperience(source, schemas, opts = {}) {
  let raised = {};
  try { raised = raisedLimits([parseStrict(source.read('experience.json') ?? '{}')]); } catch { /* the check below reports it */ }
  const ck = opts.checkers;
  if (schemas && !ck) throw new TypeError('checking files needs the checkers: use loadExperience (src/load.mjs)');
  const docs = schemas ? ck.makeDocumentChecker(schemas) : { check: (text) => { try { const doc = typeof text === 'string' ? parseStrict(text) : text; return { doc, needs: doc.needs || [], diags: [] }; } catch (e) { return { doc: null, diags: [{ code: 'E-JSON', path: '', message: e.message }] }; } } };
  const diags = [];
  const add = (file, list) => { for (const d of list) diags.push({ file, ...d }); };
  // The file a document names, or null with E-PATH when the path climbs above the experience's folder, or, for a
  // kit's document, above the kit's folder (2.1 rule 6).
  const named = (dir, rel, from, at) => {
    let file = join(dir, rel);
    const root = /^kits\/[^/]+/.exec(dir)?.[0];
    if (file !== null && root && !file.startsWith(root + '/')) file = null;
    if (file === null) add(from, [{ code: 'E-PATH', path: at, message: `${rel} leaves the ${root ? 'kit' : 'experience'}'s folder` }]);
    return file;
  };
  // Whose needs cover a document (10.11 rule 1): a scene and the shell are the experience's own behaviour, so its needs
  // cover them; a block definition (a component) names its own, so it works in any experience.
  const coveredBy = (inherited) => (kind) => (kind === 'scene' || kind === 'shell' ? inherited : []);
  const readDoc = (rel, needs, from = 'experience.json', at = rel, dir = '') => {
    if (named(dir, rel, from, at) === null) return null;
    rel = join(dir, rel);
    const text = source.read(rel);
    if (text == null) { add(rel, [{ code: 'E-FILE-MISSING', path: rel, message: 'not found' }]); return null; }
    // Presets (D23, chapter 12) are expanded into ordinary content before the document is checked: opts.presets is the
    // loader's (src/load.mjs). A packed page carries documents the packer has expanded, so it needs none.
    let input = text;
    if (opts.presets && text.includes('"presets"')) {
      let raw = null;
      try { raw = parseStrict(text); } catch { /* the check below reports it */ }
      if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.presets !== undefined) {
        const x = opts.presets.expand(raw, rel);
        add(rel, x.diags);
        input = x.doc;
      }
    }
    const r = docs.check(input, { needs, file: rel });
    add(rel, r.diags.map(upgradeHint));
    if (r.doc == null) return null;
    // 5.14: machines are a list in the order they run; the engine keeps them as a map in that order.
    if (Array.isArray(r.doc.machines)) {
      const map = {};
      r.doc.machines.forEach((m, i) => {
        if (!m || typeof m.id !== 'string') return;
        if (m.id in map) { add(rel, [{ code: 'E-ID-DUPLICATE', path: `machines/${i}`, message: `machine id ${m.id} is used twice` }]); return; }
        const { id, ...rest } = m;
        map[id] = rest;
      });
      r.doc.machines = map;
    }
    return { doc: r.doc, needs: r.needs };
  };
  const readDrawings = (rel, doc) => {
    const out = {};
    const dir = dirOf(rel);
    // The block's own drawing (main), and each layout's own drawing (a drawn or derived frame, 7.4).
    const own = (doc.layouts || []).filter(l => l && typeof l.drawing === 'string').map(l => [l.id, l.drawing]);
    const list = typeof doc.drawing === 'string' ? [['main', doc.drawing], ...own] : own;
    for (const [id, f] of list) {
      const file = named(dir, f, rel, id === 'main' ? 'drawing' : `layouts.${id}.drawing`);
      if (file === null) continue;
      const text = source.read(file);
      if (text == null) { add(file, [{ code: 'E-FILE-MISSING', path: file, message: `named by ${rel}, not found` }]); continue; }
      if (schemas) add(file, ck.checkDrawing(text, schemas.drawing, { addons: opts.addons || {}, markAliases: schemas.addons?.['a13-migration']?.['x-hsvg-drawing']?.markAliases }).diags);
      out[id] = { file, text };
    }
    return out;
  };
  const words = (rel, doc) => {
    const out = {};
    const dir = dirOf(rel);
    for (const [name, r] of Object.entries(doc.resources || {})) {
      if (r.kind !== 'words') continue;
      const file = named(dir, r.file, rel, `resources.${name}.file`);
      if (file === null) continue;
      const text = source.read(file);
      if (text == null) { add(rel, [{ code: 'E-FILE-MISSING', path: r.file, message: 'words file not found' }]); continue; }
      out[r.language] = parseWords(text, (m) => add(file, [{ code: 'E-WORDS', path: r.file, message: m }]));
    }
    return out;
  };
  const exp = readDoc('experience.json', []);
  if (!exp) return { ok: false, diags, experience: null };
  const needs = exp.needs ? [...exp.needs] : [];
  const experience = { file: 'experience.json', doc: exp.doc, needs, raised, limits: activeLimits(raised), words: words('experience.json', exp.doc), data: {}, scenes: {}, blocks: {} };
  // Icon sets (2.6, 6.2.2): the text of each icon-set resource of the experience, checked as the SVG subset (an icon
  // set holds <symbol data-hsvg-role="icon"> elements named by their ids; the drawing reads them, src/drawing.mjs).
  experience.iconSets = {};
  for (const [name, r] of Object.entries(exp.doc.resources || {})) {
    if (r?.kind !== 'icon-set' || named('', r.file, 'experience.json', `resources.${name}.file`) === null) continue;
    const text = source.read(r.file);
    if (text == null) { add('experience.json', [{ code: 'E-FILE-MISSING', path: r.file, message: 'icon set not found' }]); continue; }
    if (schemas) add(r.file, ck.checkDrawing(text, schemas.drawing, { iconSet: true }).diags);
    experience.iconSets[name] = text;
  }
  // Data tables (2.8): JSON rows, or CSV rows typed by the table's declared columns.
  for (const [name, t] of Object.entries(exp.doc.data || {})) {
    // A table without a resource only gives the shape of a rows content field (2.8): no rows.
    if (t && typeof t === 'object' && t.resource === undefined) { experience.data[name] = []; continue; }
    const res = exp.doc.resources?.[t.resource];
    if (!res) { add('experience.json', [{ code: 'E-REF-UNKNOWN', path: `data.${name}`, message: `resource ${t.resource} is not declared` }]); continue; }
    if (named('', res.file, 'experience.json', `resources.${t.resource}.file`) === null) continue;
    const text = source.read(res.file);
    if (text == null) { add('experience.json', [{ code: 'E-FILE-MISSING', path: res.file, message: 'data file not found' }]); continue; }
    try {
      const json = res.file.endsWith('.json');
      const rows = json ? parseStrict(`{"rows":${text}}`).rows : parseCsv(text, t.columns);
      if (t.columns) ck?.checkCells(rows, t.columns, json); // the checkers' (a packed page's cells are the packer's)
      experience.data[name] = rows;
    } catch (e) { add(res.file, [{ code: 'E-DATA', path: res.file, message: e.message }]); }
  }
  for (const [id, rel] of Object.entries(exp.doc.story?.scenes || {})) {
    if (typeof rel !== 'string') continue;
    const s = readDoc(rel, needs, 'experience.json', `story.scenes.${id}`);
    if (s) experience.scenes[id] = { file: rel, doc: s.doc, drawings: readDrawings(rel, s.doc), words: words(rel, s.doc) };
  }
  for (const [id, rel] of Object.entries(exp.doc.blocks || {})) {
    if (typeof rel !== 'string') continue;
    const b = readDoc(rel, coveredBy(needs), 'experience.json', `blocks.${id}`);
    if (b) experience.blocks[id] = { file: rel, doc: b.doc, drawings: readDrawings(rel, b.doc), words: words(rel, b.doc) };
  }
  if (typeof exp.doc.shell === 'string') {
    const s = readDoc(exp.doc.shell, needs, 'experience.json', 'shell');
    if (s) experience.shell = { file: exp.doc.shell, doc: s.doc, drawings: readDrawings(exp.doc.shell, s.doc), words: words(exp.doc.shell, s.doc) };
  }
  // A kit experience (4.8, 4.9): the pinned kit, read from kits/<id>/, then applied (kit.mjs).
  const kits = opts.kits;
  const pin = kits ? kits.kitPin(exp.doc) : (exp.doc.kit && typeof exp.doc.kit === 'object' ? exp.doc.kit : null);
  if (pin && !kits) add('experience.json', [{ code: 'E-KIT-PIN', path: '/kit', message: 'this player reads no kits: the packer flattens a kit experience (tools/pack.mjs), and the dev player loads it with src/load.mjs' }]);
  else if (pin) {
    const kit = kits.readKit({ source, add, named, readDoc, readDrawings, words, join, needs, coveredBy }, pin);
    if (kit) kits.applyKit(experience, kit, (code, file, path, message) => add(file, [{ code, path, message }]));
  }
  // Pick-and-use (4.8, D24): the kit loader's (kit.mjs readPicks); a packed page plays it flattened.
  else kits?.readPicks?.({ source, add, named, readDoc, readDrawings, words, join, needs: [], coveredBy }, experience);
  return { ok: !diags.some(d => d.code.startsWith('E-')), diags, experience };
}

// An older format (hsvg/0.1) is refused with E-HEADER; the message names the upgrade tool (A13.2 rule 4). The
// in-memory upgrade of A13.2 rule 2 is not built: an old file is upgraded by the tool before it reaches a player.
// It names the tool and the page every release holds; the base ships no upgrade command (D41, D42).
export const UPGRADE_TOOL = 'the upgrade tool (A13.3, spec/2.0/reference/a13-migration.md), run on a copy';
function upgradeHint(d) {
  if (d.code !== 'E-HEADER' || d.path !== 'format') return d;
  return { ...d, message: `${d.message}. Upgrade an older file first with ${UPGRADE_TOOL}. The player does not upgrade in memory` };
}

// Words files (2.7): CSV with the header id,text. Returns { id: text }.
export function parseWords(text, fail) {
  const rows = parseCsvRows(text);
  const head = rows.shift() || [];
  if (head[0] !== 'id' || head[1] !== 'text' || head.length !== 2) fail?.('the header is not id,text');
  // A null-prototype object: constructor, toString and __proto__ are ordinary ids (Q1c finding 9).
  const out = Object.create(null);
  for (const r of rows) {
    if (r.length === 1 && r[0] === '') continue;
    if (Object.hasOwn(out, r[0])) fail?.(`word ${r[0]} is repeated`);
    out[r[0]] = r[1] ?? '';
  }
  return out;
}
// A data table's CSV (2.8). With columns (the table's declared column types), the header must name exactly those
// columns, in any order. Number cells use JSON number syntax and become numbers; boolean cells are true or false and
// become booleans; an empty cell is an empty string in a string column and an error in any other; strings stay
// strings; no type is guessed. Arrays and objects need a JSON file. A broken rule throws (the loader gives E-DATA).
const JSON_NUMBER = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$/;
export function parseCsv(text, columns = null) {
  if (text.charCodeAt(0) === 0xfeff && columns) throw new Error('a data CSV has no byte order mark');
  const rows = parseCsvRows(text);
  const head = rows.shift() || [];
  const body = rows.filter(r => !(r.length === 1 && r[0] === ''));
  if (!columns) return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
  const names = Object.keys(columns);
  const extra = head.filter(h => !(h in columns));
  const missing = names.filter(n => !head.includes(n));
  if (extra.length || missing.length || new Set(head).size !== head.length) {
    throw new Error(`the header must be exactly the declared columns${missing.length ? `; missing ${missing.join(', ')}` : ''}${extra.length ? `; not declared ${extra.join(', ')}` : ''}`);
  }
  return body.map((r, ri) => {
    if (r.length !== head.length) throw new Error(`row ${ri + 1} has ${r.length} cells, the header ${head.length}`);
    return Object.fromEntries(head.map((h, i) => [h, csvCell(r[i], columns[h].type, `row ${ri + 1}, column ${h}`)]));
  });
}
function csvCell(cell, type, where) {
  if (type === 'string') return cell;
  if (cell === '') throw new Error(`${where}: an empty cell in a ${type} column`);
  if (type === 'number') {
    const n = JSON_NUMBER.test(cell) ? Number(cell) : NaN;
    if (!Number.isFinite(n)) throw new Error(`${where}: ${JSON.stringify(cell)} is not a JSON number`);
    return n;
  }
  if (type === 'boolean') {
    if (cell !== 'true' && cell !== 'false') throw new Error(`${where}: ${JSON.stringify(cell)} is not true or false`);
    return cell === 'true';
  }
  throw new Error(`${where}: a ${type} column needs a JSON file, not CSV`);
}
// RFC 4180 rows.
function parseCsvRows(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
