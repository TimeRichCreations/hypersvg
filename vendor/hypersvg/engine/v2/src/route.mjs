// Drawn routes (6.7, core since D31): the `route` clip channel moves a part's placement point along a part drawn with
// data-hsvg-route, by length (progress 0..1). Lines, polylines and paths (M L H V C S Q T A Z, absolute and relative)
// are measured; curves are split into 32 straight pieces each. The path tokens are shared with motion's morph.

// ---------- path data ----------
const TOKEN = /[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
const ARGS = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
// [{cmd, args: [numbers]}], one entry per command letter as written (repeated argument groups stay in one entry).
export function tokens(d) {
  const out = [];
  for (const t of String(d || '').match(TOKEN) || []) {
    if (/[a-z]/i.test(t)) out.push({ cmd: t, args: [] });
    else if (out.length) out[out.length - 1].args.push(Number(t));
  }
  return out;
}
const STEPS = 32;
export function flatten(d) {
  const segs = [];
  let x = 0; let y = 0; let sx = 0; let sy = 0; let pc = null; let pq = null; // last control points for S and T
  const line = (nx, ny) => { segs.push([x, y, nx, ny]); x = nx; y = ny; };
  const curve = (f) => { let px = x; let py = y; for (let i = 1; i <= STEPS; i++) { const [nx, ny] = f(i / STEPS); segs.push([px, py, nx, ny]); px = nx; py = ny; } x = px; y = py; };
  for (const { cmd, args } of tokens(d)) {
    const rel = cmd === cmd.toLowerCase(); const c = cmd.toLowerCase(); const n = ARGS[c];
    if (c === 'z') { line(sx, sy); pc = pq = null; continue; }
    for (let i = 0; i + n <= args.length; i += n) {
      const a = args.slice(i, i + n);
      const ox = rel ? x : 0; const oy = rel ? y : 0;
      // A move's further pairs are lines (SVG 1.1, 8.3.2).
      if (c === 'm') { if (i === 0) { x = a[0] + ox; y = a[1] + oy; sx = x; sy = y; } else line(a[0] + ox, a[1] + oy); pc = pq = null; continue; }
      if (c === 'l') { line(a[0] + ox, a[1] + oy); pc = pq = null; } else if (c === 'h') { line(a[0] + ox, y); pc = pq = null; } else if (c === 'v') { line(x, a[0] + oy); pc = pq = null; } else if (c === 'c' || c === 's') {
        const x0 = x; const y0 = y;
        const [x1, y1] = c === 'c' ? [a[0] + ox, a[1] + oy] : pc ? [2 * x0 - pc[0], 2 * y0 - pc[1]] : [x0, y0];
        const k = c === 'c' ? 2 : 0;
        const x2 = a[k] + ox; const y2 = a[k + 1] + oy; const x3 = a[k + 2] + ox; const y3 = a[k + 3] + oy;
        curve((t) => { const u = 1 - t; return [u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]; });
        pc = [x2, y2]; pq = null;
      } else if (c === 'q' || c === 't') {
        const x0 = x; const y0 = y;
        const [x1, y1] = c === 'q' ? [a[0] + ox, a[1] + oy] : pq ? [2 * x0 - pq[0], 2 * y0 - pq[1]] : [x0, y0];
        const k = c === 'q' ? 2 : 0;
        const x2 = a[k] + ox; const y2 = a[k + 1] + oy;
        curve((t) => { const u = 1 - t; return [u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2]; });
        pq = [x1, y1]; pc = null;
      } else if (c === 'a') {
        arc(x, y, a[0], a[1], a[2], a[3], a[4], a[5] + ox, a[6] + oy, curve, line);
        pc = pq = null;
      }
    }
  }
  return segs;
}
// An SVG arc, by its centre form (SVG 1.1, F.6.5).
function arc(x1, y1, rx, ry, phi, large, sweep, x2, y2, curve, line) {
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (!rx || !ry || (x1 === x2 && y1 === y2)) { line(x2, y2); return; }
  const r = (phi * Math.PI) / 180; const cs = Math.cos(r); const sn = Math.sin(r);
  const dx = (x1 - x2) / 2; const dy = (y1 - y2) / 2;
  const xp = cs * dx + sn * dy; const yp = -sn * dx + cs * dy;
  const lam = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / (rx * rx * yp * yp + ry * ry * xp * xp)));
  const cxp = (k * rx * yp) / ry; const cyp = (-k * ry * xp) / rx;
  const cx = cs * cxp - sn * cyp + (x1 + x2) / 2; const cy = sn * cxp + cs * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
  const t1 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
  let dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI; else if (sweep && dt < 0) dt += 2 * Math.PI;
  curve((t) => { const a = t1 + dt * t; const ex = rx * Math.cos(a); const ey = ry * Math.sin(a); return t === 1 ? [x2, y2] : [cs * ex - sn * ey + cx, sn * ex + cs * ey + cy]; });
}
// A drawn route's straight pieces: from a node of the drawing tree ({name, attrs}).
export function routeSegments(node) {
  const a = node.attrs;
  if (node.name === 'line') return [[+a.x1 || 0, +a.y1 || 0, +a.x2 || 0, +a.y2 || 0]];
  if (node.name === 'polyline' || node.name === 'polygon') {
    const n = String(a.points || '').trim().split(/[\s,]+/).filter(Boolean).map(Number);
    const segs = [];
    for (let i = 2; i + 1 < n.length; i += 2) segs.push([n[i - 2], n[i - 1], n[i], n[i + 1]]);
    if (node.name === 'polygon' && n.length >= 4) segs.push([n[n.length - 2], n[n.length - 1], n[0], n[1]]);
    return segs;
  }
  if (node.name === 'path') return flatten(a.d);
  return null;
}
// The point at progress p (0..1, clamped) along the pieces, by length.
export function pointAt(segs, p) {
  if (!segs?.length) return null;
  const lens = segs.map(([a, b, c, d]) => Math.hypot(c - a, d - b));
  const total = lens.reduce((s, l) => s + l, 0);
  if (!(total > 0)) return [segs[0][0], segs[0][1]];
  let want = Math.max(0, Math.min(1, p)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (want <= lens[i] || i === segs.length - 1) {
      const k = lens[i] ? Math.min(1, want / lens[i]) : 0;
      const [a, b, c, d] = segs[i];
      return [a + (c - a) * k, b + (d - b) * k];
    }
    want -= lens[i];
  }
  return null;
}

const cache = new Map(); // route attribute text -> pieces
// The point at progress p along a drawn route node ({name, attrs}), or null when it has no length.
export function routePoint(node, p) {
  const key = `${node.name}|${node.attrs.d ?? ''}|${node.attrs.points ?? ''}|${node.attrs.x1},${node.attrs.y1},${node.attrs.x2},${node.attrs.y2}`;
  if (!cache.has(key)) { if (cache.size > 256) cache.clear(); cache.set(key, routeSegments(node)); }
  return pointAt(cache.get(key), p);
}
