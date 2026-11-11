// The pivot check (6.2.1, stress test D): W-PIVOT-OUTSIDE when a part's data-hsvg-pivot lies outside the box of what it
// draws, by more than a margin. A part that turns or grows around the wrong point (art moved, the pivot left behind)
// passes every other check and every test that reads values. The box is measured in the coordinates the part's
// children are drawn in (where the pivot is written): every shape below it, through inner transforms. Text counts as
// its start point; a part that draws no shape is not judged.
import { parseXml } from '../schema/xml.mjs';
import { IDENTITY, mul, parseTransform, shapeBox, transformBox, emptyBox, isEmpty, union, addPoint } from './paint/geometry.mjs';

const SKIP = new Set(['defs', 'symbol', 'clipPath', 'mask', 'filter', 'marker', 'pattern', 'linearGradient', 'radialGradient', 'title', 'desc', 'metadata']);
// How far outside counts: more than the box's longer side, and more than 5% of the drawing (a small part may flutter
// around a point just beside it on purpose).
const margin = (b, pic) => Math.max(pic, b.x1 - b.x0, b.y1 - b.y0);

// The box of everything a node draws, in its own coordinates (its own transform not applied).
export function drawnBox(n) {
  let b = emptyBox();
  const walk = (x, m) => {
    if (!x.name || SKIP.has(x.name) || x.attrs.display === 'none') return;
    if (x.name === 'svg') { const sb = shapeBox('rect', x.attrs); if (sb && x.attrs.width !== undefined) b = union(b, transformBox(m, sb)); return; }
    if (x.name === 'text' || x.name === 'tspan') { const px = parseFloat(x.attrs.x); const py = parseFloat(x.attrs.y); if (Number.isFinite(px) && Number.isFinite(py)) { const t = transformBox(m, { x0: px, y0: py, x1: px, y1: py }); b = addPoint(union(b, t), t.x0, t.y0); } return; }
    const sb = shapeBox(x.name, x.attrs);
    if (sb && !isEmpty(sb)) b = union(b, transformBox(m, sb));
    for (const c of x.children) if (c.name) walk(c, mul(m, parseTransform(c.attrs.transform) ?? IDENTITY));
  };
  for (const c of n.children) if (c.name) walk(c, parseTransform(c.attrs.transform) ?? IDENTITY);
  const own = shapeBox(n.name, n.attrs);
  if (own && !isEmpty(own)) b = union(b, own);
  return isEmpty(b) ? null : b;
}

// [{id, pivot: [x, y], box}] for each part of a drawing whose pivot lies outside its drawn box by more than the margin.
// A pivot that several parts share is a centre they turn around on purpose (a dial's ticks): it is not judged.
export function pivotsOutside(root) {
  const out = [];
  const vb = String(root.attrs.viewBox ?? '').trim().split(/[\s,]+/).map(Number);
  const pic = vb.length === 4 && vb.every(Number.isFinite) ? 0.05 * Math.max(vb[2], vb[3]) : 8;
  const shared = new Map();
  (function count(n) { if (!n.name) return; const p = n.attrs['data-hsvg-pivot']; if (p !== undefined && n.attrs['data-hsvg-kind'] === 'part') { const k = p.trim().split(/[\s,]+/).map(Number).join(' '); shared.set(k, (shared.get(k) || 0) + 1); } n.children.forEach(count); })(root);
  const walk = (n) => {
    if (!n.name) return;
    // Only a part that turns or grows (a limited rotate, lean or scale range) uses its pivot; rotate * spins freely.
    const turns = /(^|;)\s*(rotate\s+-?[0-9.]+\.\.|lean\s|scale(-x|-y)?\s)/.test(n.attrs['data-hsvg-motion'] ?? '');
    const pv = n.attrs['data-hsvg-kind'] === 'part' && turns ? String(n.attrs['data-hsvg-pivot'] ?? '').trim().split(/[\s,]+/).map(Number) : [];
    if (pv.length === 2 && pv.every(Number.isFinite) && shared.get(pv.join(' ')) === 1) {
      const b = drawnBox(n);
      if (b) { const d = margin(b, pic); if (pv[0] < b.x0 - d || pv[0] > b.x1 + d || pv[1] < b.y0 - d || pv[1] > b.y1 + d) out.push({ id: n.attrs.id, pivot: pv, box: b }); }
    }
    n.children.forEach(walk);
  };
  walk(root);
  return out;
}

const r1 = (x) => Math.round(x * 10) / 10;
export function check(ctx) {
  const { experience: exp, report } = ctx;
  const owners = [...Object.values(exp.scenes || {}), ...Object.values(exp.blocks || {}), ...(exp.shell ? [exp.shell] : [])];
  for (const o of owners) for (const d of Object.values(o.drawings || {})) {
    let root; try { root = parseXml(d.text); } catch { continue; }
    for (const p of pivotsOutside(root)) {
      report('W-PIVOT-OUTSIDE', d.file, p.id ?? '', `part ${p.id}: its pivot ${p.pivot.join(' ')} is outside what it draws (${r1(p.box.x0)} ${r1(p.box.y0)} to ${r1(p.box.x1)} ${r1(p.box.y1)}), so it turns or grows around a point away from it; move data-hsvg-pivot onto the part (its hinge or centre), or check that the art did not move without it (6.2.1)`);
    }
  }
}
