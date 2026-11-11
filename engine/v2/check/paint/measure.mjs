// The painted extent of a drawing (6.4): for each element that paints, its bounding box in the root's coordinates.
// Painted extent is the geometry's box grown by half the stroke width, the filter region for a filtered element, and a
// text box, after clip paths. A mask with an explicit region clips too. Elements that paint nothing (fill none and no
// stroke, display none, opacity 0, defs and the like) have no extent.
//
// Text: the pinned measurer (6.4) is not in this repository, so a text's width is "not-run". A text bound with `fit`
// lies in its fit region (7.6), so its extent is the region's box. Any other text counts as its start point on the
// baseline, which is certain wherever the text runs.
import { IDENTITY, mul, parseTransform, shapeBox, transformBox, emptyBox, isEmpty, union, intersect, grow } from './geometry.mjs';
import { boxOf, keepOf } from '../../src/marks.mjs';

const SKIP = new Set(['defs', 'symbol', 'clipPath', 'mask', 'filter', 'marker', 'pattern', 'linearGradient', 'radialGradient', 'title', 'desc', 'metadata', 'style', 'script', 'font-face']);
const INHERIT = ['fill', 'stroke', 'stroke-width', 'fill-opacity', 'stroke-opacity', 'font-size', 'text-anchor'];

const styleOf = (s) => {
  const out = {};
  for (const part of String(s ?? '').split(';')) { const i = part.indexOf(':'); if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim(); }
  return out;
};
const urlId = (v) => /^url\(\s*['"]?#([^'")\s]+)['"]?\s*\)$/.exec(String(v ?? '').trim())?.[1] ?? null;
export const textOf = (n) => (n.name ? n.children.map(textOf).join('') : n.text || '');

// root: the parsed <svg>. opts.fitted: Map of a fitted text's local id to its fit region's local id. Returns {records, slots, areas}.
export function measure(root, opts = {}) {
  const ids = new Map();
  const index = (n) => { if (!n.name) return; if (n.attrs.id) ids.set(n.attrs.id, n); n.children.forEach(index); };
  index(root);
  const records = []; const slots = []; const areas = [];
  let order = 0;
  const regionBoxes = new Map();
  const local = opts.local || ((id) => id);

  const props = (n, inh) => {
    const st = styleOf(n.attrs.style);
    const get = (k) => st[k] ?? n.attrs[k];
    const next = { ...inh };
    for (const k of INHERIT) { const v = get(k); if (v !== undefined) next[k] = v; }
    const paint = n.attrs['data-hsvg-layer']; if (paint !== undefined) next.paint = paint;
    return { get, next };
  };
  const clipBox = (n, get, ctm, depth) => {
    const cp = ids.get(urlId(get('clip-path')) ?? '');
    if (!cp || cp.name !== 'clipPath' || cp.attrs.clipPathUnits === 'objectBoundingBox') return null;
    const m = mul(ctm, parseTransform(cp.attrs.transform) ?? IDENTITY);
    let b = emptyBox();
    for (const c of cp.children) {
      if (!c.name) continue;
      const sb = shapeBox(c.name, c.attrs);
      if (sb && !isEmpty(sb)) b = union(b, transformBox(mul(m, parseTransform(c.attrs.transform) ?? IDENTITY), sb));
    }
    return isEmpty(b) ? null : b;
  };
  const maskBox = (get, ctm) => {
    const mk = ids.get(urlId(get('mask')) ?? '');
    if (!mk || mk.name !== 'mask' || mk.attrs.maskUnits === 'objectBoundingBox' || ['x', 'y', 'width', 'height'].some(k => mk.attrs[k] === undefined)) return null;
    const x = parseFloat(mk.attrs.x); const y = parseFloat(mk.attrs.y);
    return transformBox(ctm, { x0: x, y0: y, x1: x + parseFloat(mk.attrs.width), y1: y + parseFloat(mk.attrs.height) });
  };
  const filterRegion = (get, ctm, bbox) => {
    const f = ids.get(urlId(get('filter')) ?? '');
    if (!f || f.name !== 'filter') return null;
    const a = f.attrs; const num = (k, d) => { const v = parseFloat(a[k]); return Number.isFinite(v) ? v : d; };
    if (a.filterUnits === 'userSpaceOnUse' && ['x', 'y', 'width', 'height'].every(k => a[k] !== undefined)) {
      const x = num('x', 0); const y = num('y', 0);
      return transformBox(ctm, { x0: x, y0: y, x1: x + num('width', 0), y1: y + num('height', 0) });
    }
    const w = bbox.x1 - bbox.x0; const h = bbox.y1 - bbox.y0;
    return { x0: bbox.x0 + num('x', -0.1) * w, y0: bbox.y0 + num('y', -0.1) * h, x1: bbox.x0 + (num('x', -0.1) + num('width', 1.2)) * w, y1: bbox.y0 + (num('y', -0.1) + num('height', 1.2)) * h };
  };

  const walk = (n, ctm, inh, chain, depth, out) => {
    if (!n.name || SKIP.has(n.name) || depth > 40) return;
    const { get, next } = props(n, inh);
    if (get('display') === 'none' || get('opacity') === '0') return;
    const m = mul(ctm, parseTransform(n.attrs.transform) ?? IDENTITY);
    const nextChain = n.attrs.id ? [...chain, local(n.attrs.id)] : chain;
    const paint = next.paint ?? 'content';
    const el = { name: n.name, id: n.attrs.id ?? null, node: n };
    const mine = [];

    if (n.attrs['data-hsvg-slot'] !== undefined || boxOf(n.attrs) !== null || keepOf(n.attrs) !== null) {
      const sb = shapeBox(n.name, n.attrs);
      if (sb && !isEmpty(sb)) {
        const box = transformBox(m, sb);
        if (n.attrs['data-hsvg-slot'] !== undefined) slots.push({ ...el, name: n.attrs['data-hsvg-slot'], tag: n.name, box, order: order++ });
        if (keepOf(n.attrs) !== null) areas.push({ ...el, mode: keepOf(n.attrs), box });
        if (n.attrs.id) regionBoxes.set(local(n.attrs.id), box);
      }
      return;
    }
    if (n.attrs['data-hsvg-route'] !== undefined) return;

    const sb = shapeBox(n.name, n.attrs);
    if (sb && !isEmpty(sb)) {
      const fill = next.fill ?? 'black';
      const fillOn = n.name === 'image' || (fill !== 'none' && next['fill-opacity'] !== '0' && n.name !== 'line');
      const sw = parseFloat(next['stroke-width'] ?? '1');
      const strokeOn = next.stroke !== undefined && next.stroke !== 'none' && next['stroke-opacity'] !== '0' && sw > 0;
      if (fillOn || strokeOn) {
        const grown = strokeOn ? grow(sb, sw / 2) : sb;
        const hollow = !fillOn && strokeOn && (n.name === 'rect' || n.name === 'circle' || n.name === 'ellipse' || n.name === 'polygon');
        mine.push({ ...el, box: transformBox(m, grown), hollow, inner: hollow ? transformBox(m, grow(sb, -sw / 2)) : null, paint, chain: nextChain, order: order++ });
      }
    } else if (n.name === 'text') {
      const id = n.attrs.id ? local(n.attrs.id) : null;
      if (textOf(n).trim()) {
        const first = (v) => { const p = parseFloat(String(v ?? '').trim().split(/[\s,]+/)[0]); return Number.isFinite(p) ? p : 0; };
        const x = first(n.attrs.x); const y = first(n.attrs.y);
        const rec = { ...el, box: transformBox(m, { x0: x, y0: y, x1: x, y1: y }), text: true, paint, chain: nextChain, order: order++ };
        const region = id ? opts.fitted?.get(id) : undefined;
        if (region !== undefined) { rec.fitRegion = region; rec.ctm = m; }
        mine.push(rec);
      }
    } else if (n.name === 'use') {
      const target = ids.get((n.attrs.href ?? n.attrs['xlink:href'] ?? '').replace(/^#/, ''));
      if (target) {
        const um = mul(m, [1, 0, 0, 1, parseFloat(n.attrs.x) || 0, parseFloat(n.attrs.y) || 0]);
        walk(target, um, next, nextChain, depth + 1, mine);
      }
    } else {
      for (const c of n.children) walk(c, m, next, nextChain, depth + 1, mine);
    }

    // Clip paths and masks cut the extent; a filter replaces it with the filter region.
    let list = mine;
    const cb = clipBox(n, get, m, depth); const mb = maskBox(get, m);
    for (const cut of [cb, mb]) if (cut) list = list.map(r => ({ ...r, box: intersect(r.box, cut), hollow: false })).filter(r => !isEmpty(r.box));
    if (list.length && get('filter')) {
      const bbox = list.reduce((b, r) => union(b, r.box), emptyBox());
      const region = filterRegion(get, m, bbox);
      if (region) list = [{ ...el, box: region, filtered: true, paint, chain: nextChain, order: list[0].order }];
    }
    out.push(...list);
  };

  const vb = String(root.attrs.viewBox ?? '').trim().split(/[\s,]+/).map(Number);
  const tops = [];
  for (const c of root.children) walk(c, IDENTITY, {}, [], 0, tops);
  for (const r of tops) if (r.fitRegion !== undefined && regionBoxes.has(r.fitRegion)) r.box = regionBoxes.get(r.fitRegion);
  records.push(...tops);
  return { records, slots, areas, viewBox: vb.length === 4 && vb.every(Number.isFinite) ? { x0: vb[0], y0: vb[1], x1: vb[0] + vb[2], y1: vb[1] + vb[3] } : null };
}
