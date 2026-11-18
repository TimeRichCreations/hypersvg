// The checks the loaders share (moved from load.mjs; load.mjs still exports raiseSchemas and checkCells): the raised
// limits in the schemas, undeclared images, and the cells of data tables. The full loader (load.mjs) and the HyperSVG
// loader (load-asset.mjs) both use them; the HyperSVG loader carries no kit or add-on code.
import { makeDocumentChecker } from '../schema/check-document.mjs';
import { checkDrawing } from '../schema/drawing-check.mjs';
import { experienceResources } from './host-profile.mjs';
import { SVG_LIMIT } from './limits.mjs';
import { checkValue } from './runtime.mjs';

export const CHECKERS = Object.freeze({ makeDocumentChecker, checkDrawing, checkCells });

const LIMIT_KEYWORDS = ['maxItems', 'maxLength', 'maxProperties', 'maximum'];
// The schemas with the capacity limits a package raises (9.8.1): every node marked x-hsvg-limit with a raised id, and
// the drawing rules' limits. Returns the schemas unchanged when nothing is raised.
export function raiseSchemas(schemas, raised) {
  if (!schemas || !Object.keys(raised).length) return schemas;
  const out = structuredClone(schemas);
  (function walk(node) {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== 'object') return;
    const id = node['x-hsvg-limit'];
    if (id in raised) for (const k of LIMIT_KEYWORDS) if (typeof node[k] === 'number') node[k] = raised[id];
    Object.values(node).forEach(walk);
  })(out);
  for (const [id, v] of Object.entries(raised)) if (SVG_LIMIT[id] && out.drawing?.limits) out.drawing.limits[SVG_LIMIT[id]] = v;
  return out;
}


// An <image> in a drawing holds a data: URI or names a declared image resource by its path from the drawing
// (vocabularies.json svgLimits.addresses, 2.6). Anything else would make a mounted page ask its server for an address
// nobody declared or checked: E-REF-UNKNOWN, so neither the checker nor mount lets it play.
const IMAGE_HREF = /<image\b[^>]*?\s(?:xlink:)?href\s*=\s*(["'])([^"']*)\1/g;
export function undeclaredImages(e) {
  const declared = new Set(experienceResources(e).filter(r => r.kind === 'image').map(r => r.path));
  const out = [];
  const seen = new Set();
  for (const owner of [e.shell, ...Object.values(e.scenes || {}), ...Object.values(e.blocks || {})]) {
    for (const d of Object.values(owner?.drawings || {})) {
      if (!d?.text || seen.has(d.file)) continue;
      seen.add(d.file);
      const dir = String(d.file || '').split('/').slice(0, -1);
      for (const [, , href] of d.text.matchAll(IMAGE_HREF)) {
        if (/^data:/i.test(href.trim()) || href.startsWith('#')) continue;
        const parts = [...dir];
        for (const p of href.split('/')) { if (p === '..') parts.pop(); else if (p && p !== '.') parts.push(p); }
        if (!declared.has(parts.join('/'))) out.push({ code: 'E-REF-UNKNOWN', file: d.file, path: `<image href="${href}">`, message: `the image ${href} is not a declared image resource: declare it in resources ({"kind": "image", "file": "..."}) or embed it as a data: URI` });
      }
    }
  }
  return out;
}

// Every cell is checked against its column before play (2.8): its type and bounds (minimum, maximum, step, maxLength,
// enum, and the rest of 5.1.1), as a value is. JSON rows are closed objects with every column. A broken rule throws
// (the loader gives E-DATA).
export function checkCells(rows, columns, json = true) {
  if (!Array.isArray(rows)) throw new Error('a data table is an array of rows');
  const names = Object.keys(columns);
  rows.forEach((row, ri) => {
    const where = `row ${ri + 1}`;
    if (row === null || typeof row !== 'object' || Array.isArray(row)) throw new Error(`${where}: a row is an object`);
    if (json) {
      const extra = Object.keys(row).filter(k => !(k in columns));
      const missing = names.filter(k => !(k in row));
      if (extra.length || missing.length) throw new Error(`${where}: a row has exactly the declared columns${missing.length ? `; missing ${missing.join(', ')}` : ''}${extra.length ? `; not declared ${extra.join(', ')}` : ''}`);
    }
    for (const c of names) {
      const bad = checkValue(columns[c], row[c]);
      if (bad) throw new Error(`${where}, column ${c}: ${bad[1]} (${bad[0]})`);
    }
  });
  return rows;
}
