// Plain geometry for the painted-extent checks (6.4): 2D matrices, transform lists, bounding boxes of shapes and paths.
// A box is {x0, y0, x1, y1}. No dependencies.

export const IDENTITY = [1, 0, 0, 1, 0, 0];
// Matrices are [a, b, c, d, e, f] as in SVG.
export const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
export const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
export const scaleOf = (m) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 0;

// Parses a transform list. Returns a matrix, or null when the text is not a list of known functions.
export function parseTransform(text) {
  if (text === undefined || text === null || String(text).trim() === '') return IDENTITY;
  let m = IDENTITY;
  const re = /\s*(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)\s*,?/gy;
  let last = 0; let hit;
  const src = String(text);
  while ((hit = re.exec(src))) {
    last = re.lastIndex;
    const a = hit[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (a.some(Number.isNaN)) return null;
    const rad = (d) => (d * Math.PI) / 180;
    let t;
    switch (hit[1]) {
      case 'matrix': if (a.length !== 6) return null; t = a; break;
      case 'translate': t = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0]; break;
      case 'scale': t = [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0]; break;
      case 'rotate': {
        const c = Math.cos(rad(a[0] ?? 0)); const s = Math.sin(rad(a[0] ?? 0));
        t = [c, s, -s, c, 0, 0];
        if (a.length === 3) t = mul(mul([1, 0, 0, 1, a[1], a[2]], t), [1, 0, 0, 1, -a[1], -a[2]]);
        break;
      }
      case 'skewX': t = [1, 0, Math.tan(rad(a[0] ?? 0)), 1, 0, 0]; break;
      default: t = [1, Math.tan(rad(a[0] ?? 0)), 0, 1, 0, 0];
    }
    m = mul(m, t);
  }
  return last >= src.trimEnd().length ? m : null;
}

export const emptyBox = () => ({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
export const isEmpty = (b) => !b || b.x0 > b.x1 || b.y0 > b.y1;
export const addPoint = (b, x, y) => { b.x0 = Math.min(b.x0, x); b.y0 = Math.min(b.y0, y); b.x1 = Math.max(b.x1, x); b.y1 = Math.max(b.y1, y); return b; };
export const union = (a, b) => (isEmpty(a) ? b : isEmpty(b) ? a : { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });
export const intersect = (a, b) => ({ x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) });
export const grow = (b, d) => ({ x0: b.x0 - d, y0: b.y0 - d, x1: b.x1 + d, y1: b.y1 + d });
// The box of a box under a matrix.
export function transformBox(m, b) {
  if (isEmpty(b)) return b;
  const out = emptyBox();
  for (const [x, y] of [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]]) addPoint(out, ...apply(m, x, y));
  return out;
}
// Boxes overlap by more than `eps` in both directions.
export const overlaps = (a, b, eps = 0.5) => !isEmpty(a) && !isEmpty(b) && Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > eps && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > eps;

const nums = (s) => String(s ?? '').trim().split(/[\s,]+/).filter(Boolean).map(Number);

// Path data to a box of its points, with curves sampled. Returns an empty box on bad data.
export function pathBox(d) {
  const box = emptyBox();
  const tokens = String(d ?? '').match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
  let i = 0; let cmd = ''; let x = 0; let y = 0; let sx = 0; let sy = 0; let px = 0; let py = 0; let prev = '';
  const num = () => Number(tokens[i++]);
  const more = () => i < tokens.length && !/^[A-Za-z]$/.test(tokens[i]);
  const bez = (pts) => {
    for (let t = 0; t <= 1.0001; t += 1 / 24) {
      let q = pts.map(p => p.slice());
      while (q.length > 1) q = q.slice(1).map((p, k) => [q[k][0] + (p[0] - q[k][0]) * t, q[k][1] + (p[1] - q[k][1]) * t]);
      addPoint(box, q[0][0], q[0][1]);
    }
  };
  while (i < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[i])) cmd = tokens[i++];
    else if (!cmd) return emptyBox();
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0; const oy = rel ? y : 0;
    if (C === 'Z') { x = sx; y = sy; prev = 'Z'; continue; }
    if (!more()) { if (i >= tokens.length || /^[A-Za-z]$/.test(tokens[i])) { /* a command with no numbers */ } }
    if (C === 'M') { x = ox + num(); y = oy + num(); sx = x; sy = y; addPoint(box, x, y); cmd = rel ? 'l' : 'L'; prev = 'M'; continue; }
    if (C === 'L') { x = ox + num(); y = oy + num(); addPoint(box, x, y); }
    else if (C === 'H') { x = ox + num(); addPoint(box, x, y); }
    else if (C === 'V') { y = oy + num(); addPoint(box, x, y); }
    else if (C === 'C') {
      const p1 = [ox + num(), oy + num()]; const p2 = [ox + num(), oy + num()]; const p3 = [ox + num(), oy + num()];
      bez([[x, y], p1, p2, p3]); px = p2[0]; py = p2[1]; x = p3[0]; y = p3[1]; prev = 'C'; continue;
    } else if (C === 'S') {
      const p1 = prev === 'C' ? [2 * x - px, 2 * y - py] : [x, y];
      const p2 = [ox + num(), oy + num()]; const p3 = [ox + num(), oy + num()];
      bez([[x, y], p1, p2, p3]); px = p2[0]; py = p2[1]; x = p3[0]; y = p3[1]; prev = 'C'; continue;
    } else if (C === 'Q') {
      const p1 = [ox + num(), oy + num()]; const p2 = [ox + num(), oy + num()];
      bez([[x, y], p1, p2]); px = p1[0]; py = p1[1]; x = p2[0]; y = p2[1]; prev = 'Q'; continue;
    } else if (C === 'T') {
      const p1 = prev === 'Q' ? [2 * x - px, 2 * y - py] : [x, y];
      const p2 = [ox + num(), oy + num()];
      bez([[x, y], p1, p2]); px = p1[0]; py = p1[1]; x = p2[0]; y = p2[1]; prev = 'Q'; continue;
    } else if (C === 'A') {
      const rx = Math.abs(num()); const ry = Math.abs(num()); const rot = num(); const large = num(); const sweep = num();
      const ex = ox + num(); const ey = oy + num();
      arc(box, x, y, rx, ry, rot, large, sweep, ex, ey);
      x = ex; y = ey; prev = 'A'; continue;
    } else return emptyBox();
    prev = C;
  }
  return Number.isNaN(box.x0 + box.y0 + box.x1 + box.y1) ? emptyBox() : box;
}

// An elliptical arc by its endpoints (SVG F.6.5), sampled.
function arc(box, x1, y1, rx, ry, rotDeg, large, sweep, x2, y2) {
  addPoint(box, x1, y1); addPoint(box, x2, y2);
  if (!rx || !ry || (x1 === x2 && y1 === y2)) return;
  const phi = (rotDeg * Math.PI) / 180; const c = Math.cos(phi); const s = Math.sin(phi);
  const dx = (x1 - x2) / 2; const dy = (y1 - y2) / 2;
  const x1p = c * dx + s * dy; const y1p = -s * dx + c * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (k * rx * y1p) / ry; const cyp = (-k * ry * x1p) / rx;
  const cx = c * cxp - s * cyp + (x1 + x2) / 2; const cy = s * cxp + c * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI; else if (sweep && dt < 0) dt += 2 * Math.PI;
  for (let n = 0; n <= 48; n++) {
    const t = t1 + (dt * n) / 48;
    addPoint(box, cx + rx * Math.cos(t) * c - ry * Math.sin(t) * s, cy + rx * Math.cos(t) * s + ry * Math.sin(t) * c);
  }
}

// The box of a basic shape element's geometry in its own coordinates, or null for an element that is not a shape.
export function shapeBox(name, a) {
  const n = (k, d = 0) => { const v = parseFloat(a[k]); return Number.isFinite(v) ? v : d; };
  switch (name) {
    case 'rect': case 'image': return { x0: n('x'), y0: n('y'), x1: n('x') + n('width'), y1: n('y') + n('height') };
    case 'circle': return { x0: n('cx') - n('r'), y0: n('cy') - n('r'), x1: n('cx') + n('r'), y1: n('cy') + n('r') };
    case 'ellipse': return { x0: n('cx') - n('rx'), y0: n('cy') - n('ry'), x1: n('cx') + n('rx'), y1: n('cy') + n('ry') };
    case 'line': return { x0: Math.min(n('x1'), n('x2')), y0: Math.min(n('y1'), n('y2')), x1: Math.max(n('x1'), n('x2')), y1: Math.max(n('y1'), n('y2')) };
    case 'polyline': case 'polygon': {
      const v = nums(a.points); const b = emptyBox();
      for (let i = 0; i + 1 < v.length; i += 2) addPoint(b, v[i], v[i + 1]);
      return b;
    }
    case 'path': return pathBox(a.d);
    default: return null;
  }
}
