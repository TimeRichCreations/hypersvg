// Words files (2.7, W5-C item 3): a row with more cells than the header is E-WORDS (an unquoted comma), and each
// word's text is parsed as a template, so a broken {{ }} is found at check time, not at play. The loader has read
// the files already; this pass reads the rows again to count their cells.
import { parseTemplate } from '../src/formula.mjs';

function rowsOf(text) {
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
const join = (dir, rel) => {
  const out = [];
  for (const p of (dir ? dir.split('/') : []).concat(rel.split('/'))) { if (p === '..') { if (!out.length) return null; out.pop(); } else if (p && p !== '.') out.push(p); }
  return out.join('/');
};

// The words a word's text reads (2.7): words.id and words["id"], and plural(n, "id") (every id.<form> row).
function wordReads(text, ids) {
  const out = new Set();
  let spans;
  try { spans = parseTemplate(text); } catch { return out; }
  const go = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(go); return; }
    if (n.k === 'mem' && n.o?.k === 'name' && n.o.v === 'words' && !n.o.hsvg && n.key?.k === 'lit' && typeof n.key.v === 'string') out.add(n.key.v);
    if (n.k === 'call' && n.f === 'plural' && n.a?.[1]?.k === 'lit' && typeof n.a[1].v === 'string') for (const id of ids) if (id.startsWith(`${n.a[1].v}.`)) out.add(id);
    for (const v of Object.values(n)) if (v && typeof v === 'object') go(v);
  };
  for (const x of spans) if (typeof x !== 'string') go(x.f);
  return out;
}
// A word that reads itself, directly or through other words, is E-CYCLE (2.7, 5.2): the engine could not finish it.
// A block reads the experience's words and its own (its own win), in one language at a time, so each block's words
// are searched together, per language. words: [{owner, language, rows: Map id -> {text, file, at}}].
function wordCycles(ctx, words) {
  const expFile = ctx.experience.file;
  const langs = new Set(words.map(w => w.language));
  const owners = new Set(words.map(w => w.owner));
  const seen = new Set();
  for (const owner of owners) for (const lang of langs) {
    const map = new Map();
    for (const w of words) if (w.language === lang && w.owner === expFile) for (const [id, r] of w.rows) map.set(id, r);
    if (owner !== expFile) for (const w of words) if (w.language === lang && w.owner === owner) for (const [id, r] of w.rows) map.set(id, r);
    const ids = [...map.keys()];
    const edges = new Map(ids.map(id => [id, [...wordReads(map.get(id).text, ids)].filter(x => map.has(x))]));
    const state = new Map(); // 1: on the path, 2: done
    const path = [];
    const visit = (id) => {
      state.set(id, 1); path.push(id);
      for (const next of edges.get(id)) {
        if (state.get(next) === 1) {
          const loop = path.slice(path.indexOf(next)).concat(next);
          const r = map.get(next);
          const key = `${r.file}${r.at}`;
          if (!seen.has(key)) { seen.add(key); ctx.report('E-CYCLE', r.file, r.at, `word "${next}" reads itself: ${loop.join(' -> ')}; a word cannot be made from itself (2.7)`); }
        } else if (!state.has(next)) visit(next);
      }
      path.pop(); state.set(id, 2);
    };
    for (const id of ids) if (!state.has(id)) visit(id);
  }
}

export function check(ctx) {
  const exp = ctx.experience;
  const words = [];
  const owners = [{ file: exp.file, doc: exp.doc }, ...Object.values(exp.scenes), ...Object.values(exp.blocks)];
  if (exp.shell) owners.push(exp.shell);
  for (const o of owners) {
    const dir = o.file.split('/').slice(0, -1).join('/');
    for (const r of Object.values(o.doc.resources || {})) {
      if (!r || r.kind !== 'words' || typeof r.file !== 'string') continue;
      const file = join(dir, r.file);
      const text = file === null ? null : ctx.source.read(file);
      if (text == null) continue;
      const rows = rowsOf(text);
      const head = rows.shift() || [];
      const found = { owner: o.file, language: r.language, rows: new Map() };
      words.push(found);
      rows.forEach((row, n) => {
        if (row.length === 1 && row[0] === '') return;
        const at = `/row ${n + 2}`;
        if (row.length > head.length) {
          ctx.report('E-WORDS', file, at, `the row for "${row[0]}" has ${row.length} cells, but the header has ${head.length}; quote the text if it holds a comma`);
          return;
        }
        if (row.length < head.length) {
          ctx.report('E-WORDS', file, at, `the row for "${row[0]}" has ${row.length} cell, but the header has ${head.length}`);
          return;
        }
        try { parseTemplate(row[1]); } catch (e) { ctx.report(e.code || 'E-FORMULA', file, at, `word "${row[0]}": ${e.message}`); }
        if (!found.rows.has(row[0])) found.rows.set(row[0], { text: row[1] ?? '', file, at });
      });
    }
  }
  wordCycles(ctx, words);
}
