// The layout-plan solver (7.5, A7.1, capabilities/fit.json). Pure and deterministic. The fit capability gives it to
// the drawing; the packer and the checker import it. The core never imports it. What each node, share, item, the
// scale, the budget and the limits do is in 7.5 and A7.1; the steps budget (8,192) leaves an output incomplete.

import { runLadder } from './tiers.mjs';

export const PLAN_LIMITS = Object.freeze({ depth: 12, nodes: 2048 });
export const DEFAULT_BUDGET = 8192;
// The pinned text measurer (A7.1): the same estimate everywhere, so live and baked solves agree.
export const TEXT_MEASURER = Object.freeze({ id: 'hsvg-plan-estimate-1', advance: 0.55, ascent: 0.8, descent: 0.2 });

const round = (x) => Math.round(x * 1e6) / 1e6;
const box = (x, y, width, height) => ({ x: round(x), y: round(y), width: round(width), height: round(height) });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------- 2D matrices [a, b, c, d, e, f], as SVG ----------
export const IDENTITY = Object.freeze([1, 0, 0, 1, 0, 0]);
export const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
export function invert(m) {
  const det = m[0] * m[3] - m[1] * m[2];
  if (!det) return null;
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
}
export function parseTransform(s) {
  let m = IDENTITY;
  for (const [, op, args] of String(s || '').matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g)) {
    const a = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    let t = IDENTITY;
    if (op === 'matrix' && a.length === 6) t = a;
    else if (op === 'translate') t = [1, 0, 0, 1, a[0] || 0, a[1] || 0];
    else if (op === 'scale') t = [a[0] ?? 1, 0, 0, a.length > 1 ? a[1] : (a[0] ?? 1), 0, 0];
    else if (op === 'rotate') {
      const r = ((a[0] || 0) * Math.PI) / 180; const c = Math.cos(r); const s2 = Math.sin(r);
      t = [c, s2, -s2, c, 0, 0];
      if (a.length >= 3) t = mul(mul([1, 0, 0, 1, a[1], a[2]], t), [1, 0, 0, 1, -a[1], -a[2]]);
    } else if (op === 'skewX') t = [1, 0, Math.tan(((a[0] || 0) * Math.PI) / 180), 1, 0, 0];
    else if (op === 'skewY') t = [1, Math.tan(((a[0] || 0) * Math.PI) / 180), 0, 1, 0, 0];
    m = mul(m, t);
  }
  return m;
}
// A node's drawn transforms up to (not including) its drawing's root <svg>: drawing coordinates of its own space.
// A nested <svg> on the way (a mounted use) adds its viewport mapping.
export function worldOf(n) {
  const chain = [];
  for (let x = n; x && x.parent; x = x.parent) chain.push(x);
  let m = IDENTITY;
  for (const x of chain.reverse()) {
    if (x.name === 'svg') m = mul(m, viewportOf(x));
    m = mul(m, parseTransform(x.attrs?.transform));
  }
  return m;
}
// The world of a node's parent: where the node's own transform list starts.
export const parentWorld = (n) => (n.parent ? worldOf(n.parent) : IDENTITY);
export function viewBoxOf(n) {
  const v = String(n?.attrs?.viewBox ?? '').trim().split(/[\s,]+/).map(Number);
  return v.length === 4 && v.every(Number.isFinite) && v[2] > 0 && v[3] > 0 ? { x: v[0], y: v[1], width: v[2], height: v[3] } : null;
}
// A nested <svg>'s viewport: its viewBox fitted into x, y, width, height with xMidYMid meet (the engine's own placing).
function viewportOf(svg) {
  const vb = viewBoxOf(svg);
  const num = (k, d) => (svg.attrs?.[k] === undefined ? d : Number(svg.attrs[k]));
  const x = num('x', 0); const y = num('y', 0);
  if (!vb) return [1, 0, 0, 1, x, y];
  const w = num('width', vb.width); const h = num('height', vb.height);
  const s = Math.min(w / vb.width, h / vb.height);
  return [s, 0, 0, s, x + (w - vb.width * s) / 2 - vb.x * s, y + (h - vb.height * s) / 2 - vb.y * s];
}
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
// The axis-aligned box of a box under a matrix.
export function mapBox(m, b) {
  const pts = [apply(m, b.x, b.y), apply(m, b.x + b.width, b.y), apply(m, b.x, b.y + b.height), apply(m, b.x + b.width, b.y + b.height)];
  const xs = pts.map(p => p[0]); const ys = pts.map(p => p[1]);
  return box(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

// ---------- measuring a drawn part (the reference measurer) ----------
const SKIP = new Set(['defs', 'clipPath', 'mask', 'title', 'desc', 'metadata', 'style', 'linearGradient', 'radialGradient', 'pattern', 'filter', 'symbol', 'marker']);
const inherited = (n, k) => { for (let x = n; x; x = x.parent) { const v = x.attrs?.[k] ?? styleOf(x, k); if (v !== undefined) return v; } return undefined; };
const styleOf = (n, k) => { const m = new RegExp(`(?:^|;)\\s*${k}\\s*:\\s*([^;]+)`).exec(n.attrs?.style || ''); return m ? m[1].trim() : undefined; };
const textOf = (n) => (n.name ? n.children.map(textOf).join('') : n.text || '');
const nums = (s) => String(s || '').match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g)?.map(Number) || [];
// Points of one element in its own coordinates, or null; a group is the union of its children.
function ownPoints(n) {
  const a = (k) => Number(n.attrs[k] ?? 0);
  switch (n.name) {
    case 'rect': case 'image': case 'foreignObject': return [[a('x'), a('y')], [a('x') + a('width'), a('y') + a('height')]];
    case 'svg': { const x = a('x'); const y = a('y'); const vb = viewBoxOf(n); const w = n.attrs.width !== undefined ? a('width') : vb?.width ?? 0; const h = n.attrs.height !== undefined ? a('height') : vb?.height ?? 0; return [[x, y], [x + w, y + h]]; }
    case 'circle': return [[a('cx') - a('r'), a('cy') - a('r')], [a('cx') + a('r'), a('cy') + a('r')]];
    case 'ellipse': return [[a('cx') - a('rx'), a('cy') - a('ry')], [a('cx') + a('rx'), a('cy') + a('ry')]];
    case 'line': return [[a('x1'), a('y1')], [a('x2'), a('y2')]];
    case 'polyline': case 'polygon': { const v = nums(n.attrs.points); const out = []; for (let i = 0; i + 1 < v.length; i += 2) out.push([v[i], v[i + 1]]); return out; }
    case 'path': return pathPoints(n.attrs.d);
    case 'text': {
      const fs = Number.parseFloat(inherited(n, 'font-size')) || 16;
      const w = textOf(n).length * fs * TEXT_MEASURER.advance;
      const anchor = inherited(n, 'text-anchor') || 'start';
      const x0 = a('x') - (anchor === 'middle' ? w / 2 : anchor === 'end' ? w : 0);
      return [[x0, a('y') - fs * TEXT_MEASURER.ascent], [x0 + w, a('y') + fs * TEXT_MEASURER.descent]];
    }
    default: return null;
  }
}
// A path's end and control points (the hull of a curve holds the curve): absolute M L H V C S Q T A Z.
function pathPoints(d) {
  const out = [];
  let x = 0; let y = 0; let sx = 0; let sy = 0;
  const ARGS = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
  for (const [, cmd, rest] of String(d || '').matchAll(/([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g)) {
    const c = cmd.toLowerCase(); const rel = cmd !== cmd.toUpperCase(); const v = nums(rest); const n = ARGS[c];
    if (c === 'z') { x = sx; y = sy; continue; }
    for (let i = 0; i + n <= v.length; i += n) {
      const ox = rel ? x : 0; const oy = rel ? y : 0;
      if (c === 'h') { x = v[i] + ox; out.push([x, y]); continue; }
      if (c === 'v') { y = v[i] + oy; out.push([x, y]); continue; }
      if (c === 'a') {
        const rx = Math.abs(v[i]); const ry = Math.abs(v[i + 1]); const nx = v[i + 5] + ox; const ny = v[i + 6] + oy;
        out.push([x - rx, y - ry], [x + rx, y + ry], [nx - rx, ny - ry], [nx + rx, ny + ry]); // a box that holds the arc
        x = nx; y = ny; continue;
      }
      for (let j = 0; j < n; j += 2) out.push([v[i + j] + ox, v[i + j + 1] + oy]);
      x = v[i + n - 2] + ox; y = v[i + n - 1] + oy;
      if (c === 'm' && i === 0) { sx = x; sy = y; }
    }
  }
  return out;
}
// A drawn node's box in drawing coordinates (its root <svg>'s user space, before that root's viewBox), or null.
export function measure(n) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  const walk = (x, m) => {
    if (!x.name || SKIP.has(x.name)) return;
    const own = mul(m, parseTransform(x.attrs.transform));
    const pts = ownPoints(x);
    if (pts) for (const [px, py] of pts) { const [qx, qy] = apply(own, px, py); x0 = Math.min(x0, qx); y0 = Math.min(y0, qy); x1 = Math.max(x1, qx); y1 = Math.max(y1, qy); }
    if (x.name !== 'text' && x.name !== 'svg') for (const c of x.children) walk(c, own);
  };
  walk(n, parentWorld(n));
  return x0 <= x1 ? box(x0, y0, x1 - x0, y1 - y0) : null;
}
export const isText = (n) => n?.name === 'text' || (n?.name === 'g' && n.children.some(c => c.name) && n.children.filter(c => c.name).every(c => c.name === 'text'));

// ---------- the plan's shape ----------
// Nodes and depth of a plan (the root counts as depth 1).
export function planStats(plan) {
  let nodes = 0; let depth = 0;
  const walk = (n, d) => { if (!n || typeof n !== 'object') return; nodes++; depth = Math.max(depth, d); for (const c of Array.isArray(n.children) ? n.children : []) walk(c?.node, d + 1); };
  walk(plan, 1);
  return { nodes, depth };
}
// Every parent's share children: [{path, kind, shares: [share], weights}] (path: a JSON pointer into the plan).
export function shareGroups(plan) {
  const out = [];
  const walk = (n, at) => {
    if (!n || typeof n !== 'object' || !Array.isArray(n.children)) return;
    const shares = n.children.filter(c => c?.share).map(c => c.share);
    if (shares.length) out.push({ path: at, kind: n.kind, shares, weights: n.children.some(c => c?.weight !== undefined || (!c?.share && c?.size === undefined && c?.box === undefined)) });
    n.children.forEach((c, i) => walk(c?.node, `${at}/children/${i}/node`));
  };
  walk(plan, '');
  return out;
}
// Every item address a plan names (repeats not expanded).
export function planItems(plan) {
  const out = [];
  const walk = (n, at) => {
    if (!n || typeof n !== 'object') return;
    if (typeof n.item === 'string') out.push({ item: n.item, path: at });
    (Array.isArray(n.children) ? n.children : []).forEach((c, i) => walk(c?.node, `${at}/children/${i}/node`));
  };
  walk(plan, '');
  return out;
}
export function planRepeats(plan) {
  const out = [];
  const walk = (n, at) => { if (!n || typeof n !== 'object') return; if (typeof n.repeat === 'string') out.push({ repeat: n.repeat, path: at }); (Array.isArray(n.children) ? n.children : []).forEach((c, i) => walk(c?.node, `${at}/children/${i}/node`)); };
  walk(plan, '');
  return out;
}

// ---------- solving ----------
// The plan's scale factor for a root box (7.5).
export function scaleFactor(plan, root) {
  const s = plan?.scale;
  if (!s) return 1;
  return clamp(Math.min(root.width, root.height) / s.reference, s.minimum, s.maximum);
}
// A gap or padding: a number or a theme spacing name (its value, or its `initial`).
function spacingValue(v, spacing, k, unmet) {
  if (v === undefined) return 0;
  if (typeof v === 'number') return v * k;
  const s = spacing?.[v];
  const n = typeof s === 'number' ? s : typeof s?.initial === 'number' ? s.initial : null;
  if (n === null) { unmet.push({ subject: `spacing:${v}`, reason: `no theme spacing value ${v}` }); return 0; }
  return n * k;
}
// Effective shares of one parent (7.5): bounded, then moved within bounds (unlocked ones, in list order, evenly) so
// that they total `target`. Returns {values, met}.
// Shares an editor set (set[i]) move only after the others have reached their bounds.
export function effectiveShares(shares, requested, locked, target, count, set = []) {
  const v = shares.map((s, i) => clamp(requested[i], s.minimum, s.maximum));
  let met = shares.every((s, i) => !locked[i] || v[i] === requested[i]);
  if (target === null) return { values: v, met };
  for (const late of [false, true]) {
    for (let pass = 0; pass < shares.length + 1; pass++) {
      const diff = target - v.reduce((a, b) => a + b, 0);
      if (Math.abs(diff) < 1e-9) break;
      const free = shares.map((s, i) => i).filter(i => !locked[i] && (!!set[i] === late || late) && (diff > 0 ? v[i] < shares[i].maximum : v[i] > shares[i].minimum));
      count(1);
      if (!free.length) break;
      const each = diff / free.length;
      for (const i of free) v[i] = clamp(v[i] + each, shares[i].minimum, shares[i].maximum);
    }
  }
  if (Math.abs(target - v.reduce((a, b) => a + b, 0)) > 1e-6) met = false;
  return { values: v.map(round), met };
}

// Solves a plan. ctx: root (the root place's box), item(address, cell) -> {box, text, picture} | null, repeat(name) ->
// row addresses, shares {id: {value, locked}}, spacing, direction, budget. Returns {status, boxes: [{item, cell, box,
// scale, clip, text}], shares, unmet, scale, steps}; box: where the measured box goes; clip: the part shown, or null.
export function solve(plan, ctx) {
  const unmet = []; const placed = []; const shareRows = [];
  let steps = 0; let outOfSteps = false;
  const budget = ctx.budget ?? DEFAULT_BUDGET;
  const count = (n = 1) => { steps += n; if (steps > budget) outOfSteps = true; };
  const stats = planStats(plan);
  const root = ctx.root;
  const result = (status) => ({ status, boxes: placed, shares: shareRows, unmet, scale: k, steps, measurer: TEXT_MEASURER.id });
  let k = 1;
  if (stats.depth > PLAN_LIMITS.depth || stats.nodes > PLAN_LIMITS.nodes) {
    unmet.push({ subject: `layoutPlan:${plan.place}`, reason: `the plan has depth ${stats.depth} and ${stats.nodes} nodes; at most ${PLAN_LIMITS.depth} and ${PLAN_LIMITS.nodes}` });
    return result('incomplete');
  }
  k = scaleFactor(plan, root);
  const rtl = ctx.direction === 'rtl';
  const locks = ctx.shares || {};

  const placeItem = (node, cell) => {
    count();
    if (outOfSteps) return;
    const m = ctx.item(node.item, cell);
    if (!m || !m.box || !(m.box.width >= 0 && m.box.height >= 0)) { unmet.push({ subject: node.item, reason: 'the item is not drawn in this frame' }); return; }
    const fit = m.text ? 'text' : node.fit || 'contain';
    // The visible part of the item: its crop, or all of it.
    const c = Array.isArray(node.crop) ? node.crop : [0, 0, 1, 1];
    const vis = { x: m.box.x + c[0] * m.box.width, y: m.box.y + c[1] * m.box.height, width: c[2] * m.box.width, height: c[3] * m.box.height };
    // maxSize caps the box; the capped box is aligned inside the cell.
    const [ax, ay] = Array.isArray(node.align) ? node.align : [node.align || 'middle', node.align || 'middle'];
    const at = (a, flip) => { const f = a === 'start' ? 0 : a === 'end' ? 1 : 0.5; return flip ? 1 - f : f; };
    const fx = at(ax, rtl); const fy = at(ay, false);
    let cb = { ...cell };
    if (Array.isArray(node.maxSize)) {
      const w = Math.min(cell.width, node.maxSize[0]); const h = Math.min(cell.height, node.maxSize[1]);
      cb = { x: cell.x + (cell.width - w) * fx, y: cell.y + (cell.height - h) * fy, width: w, height: h };
    }
    let sx = 1; let sy = 1; let ox; let oy;
    const vw = vis.width || 1e-9; const vh = vis.height || 1e-9;
    if (fit === 'text') {
      ox = cb.x + (cb.width - vis.width) * fx; oy = cb.y + (cb.height - vis.height) * fy;
      if (vis.width > cb.width + 0.5 || vis.height > cb.height + 0.5) unmet.push({ subject: node.item, reason: `the text needs ${round(vis.width)} x ${round(vis.height)}; its box is ${round(cb.width)} x ${round(cb.height)}` });
    } else if (fit === 'stretch') {
      sx = cb.width / vw; sy = cb.height / vh; ox = cb.x; oy = cb.y;
    } else if (fit === 'cover') {
      sx = sy = Math.max(cb.width / vw, cb.height / vh);
      const [px, py] = Array.isArray(node.focal) ? node.focal : [0.5, 0.5];
      const w = vw * sx; const h = vh * sy;
      ox = clamp(cb.x + cb.width / 2 - px * w, cb.x + cb.width - w, cb.x);
      oy = clamp(cb.y + cb.height / 2 - py * h, cb.y + cb.height - h, cb.y);
    } else {
      sx = sy = Math.min(cb.width / vw, cb.height / vh);
      ox = cb.x + (cb.width - vw * sx) * fx; oy = cb.y + (cb.height - vh * sy) * fy;
    }
    // Where the whole measured box goes (the crop moves with it), and the visible part.
    const whole = box(ox - (vis.x - m.box.x) * sx, oy - (vis.y - m.box.y) * sy, m.box.width * sx, m.box.height * sy);
    const shown = box(ox, oy, vw * sx, vh * sy);
    const cropped = Array.isArray(node.crop) || fit === 'cover';
    const clip = cropped ? intersect(shown, cb) : null;
    placed.push({ item: node.item, cell: box(cell.x, cell.y, cell.width, cell.height), box: whole, scale: [round(sx), round(sy)], clip, text: !!m.text, shown: clip || shown });
  };

  const layout = (node, cell) => {
    count();
    if (outOfSteps || !node || typeof node !== 'object') return;
    if (typeof node.item === 'string') { placeItem(node, cell); return; }
    const pad = spacingValue(node.padding, ctx.spacing, k, unmet);
    const gap = spacingValue(node.gap, ctx.spacing, k, unmet);
    const inner = { x: cell.x + pad, y: cell.y + pad, width: Math.max(0, cell.width - 2 * pad), height: Math.max(0, cell.height - 2 * pad) };
    if (cell.width - 2 * pad < -1e-9 || cell.height - 2 * pad < -1e-9) unmet.push({ subject: node.label || node.kind, reason: 'the padding is larger than the box' });
    let children = Array.isArray(node.children) ? node.children : [];
    if (typeof node.repeat === 'string') children = [...children, ...(ctx.repeat?.(node.repeat) || []).map(item => ({ node: { item } }))];
    if (node.kind === 'free') {
      for (const ch of children) {
        const b = Array.isArray(ch.box) ? ch.box : [0, 0, 1, 1];
        layout(ch.node, { x: inner.x + b[0] * inner.width, y: inner.y + b[1] * inner.height, width: b[2] * inner.width, height: b[3] * inner.height });
      }
      return;
    }
    if (node.kind === 'grid') {
      const cols = Math.max(1, node.columns || 1);
      const rows = Math.max(1, Math.ceil(children.length / cols));
      const cw = (inner.width - gap * (cols - 1)) / cols; const chh = (inner.height - gap * (rows - 1)) / rows;
      if (cw < 0 || chh < 0) unmet.push({ subject: node.label || 'grid', reason: 'the gaps are larger than the box' });
      children.forEach((ch, i) => {
        const col = i % cols; const row = Math.floor(i / cols);
        const cx = rtl ? inner.x + inner.width - (col + 1) * cw - col * gap : inner.x + col * (cw + gap);
        layout(ch.node, { x: cx, y: inner.y + row * (chh + gap), width: Math.max(0, cw), height: Math.max(0, chh) });
      });
      return;
    }
    // row and column
    const horiz = node.kind === 'row';
    const length = horiz ? inner.width : inner.height;
    const fixed = children.reduce((t, ch) => t + (typeof ch.size === 'number' ? ch.size * k : 0), 0);
    const usable = length - gap * Math.max(0, children.length - 1) - fixed;
    if (usable < -1e-9) unmet.push({ subject: node.label || node.kind, reason: `fixed sizes and gaps need ${round(length - usable)}; the box is ${round(length)} long` });
    const shareKids = children.filter(ch => ch.share);
    const hasWeights = children.some(ch => !ch.share && typeof ch.size !== 'number');
    const requested = shareKids.map(ch => (typeof locks[ch.share.id]?.value === 'number' ? locks[ch.share.id].value : ch.share.initial));
    const locked = shareKids.map(ch => locks[ch.share.id]?.locked === true);
    const eff = effectiveShares(shareKids.map(ch => ch.share), requested, locked, hasWeights ? null : 100, count, shareKids.map(ch => typeof locks[ch.share.id]?.value === 'number'));
    if (!eff.met) unmet.push({ subject: shareKids.map(ch => `share:${ch.share.id}`).join(' '), reason: hasWeights ? 'a locked share is outside its bounds' : 'the shares cannot total 100 within their bounds and locks' });
    const sharePart = Math.max(0, usable) * (eff.values.reduce((a, b) => a + b, 0) / 100);
    const weights = children.reduce((t, ch) => t + (!ch.share && typeof ch.size !== 'number' ? (ch.weight ?? 1) : 0), 0);
    const rest = Math.max(0, Math.max(0, usable) - sharePart);
    let pos = 0; let si = 0;
    const rows = [];
    for (const ch of children) {
      let len;
      if (typeof ch.size === 'number') len = ch.size * k;
      else if (ch.share) len = Math.max(0, usable) * eff.values[si++] / 100;
      else len = weights > 0 ? rest * (ch.weight ?? 1) / weights : 0;
      const start = horiz && rtl ? inner.x + inner.width - pos - len : (horiz ? inner.x : inner.y) + pos;
      const c = horiz ? { x: start, y: inner.y, width: len, height: inner.height } : { x: inner.x, y: start, width: inner.width, height: len };
      const before = placed.length;
      layout(ch.node, c);
      if (ch.share) rows.push({ ch, i: si - 1, before, after: placed.length, horiz });
      pos += len + gap;
    }
    for (const r of rows) {
      const kids = placed.slice(r.before, r.after);
      let lo = Infinity; let hi = -Infinity;
      for (const p of kids) { const b = p.shown; lo = Math.min(lo, horiz ? b.x : b.y); hi = Math.max(hi, horiz ? b.x + b.width : b.y + b.height); }
      const actual = usable > 0 && hi > lo ? Math.round(((hi - lo) / usable) * 1000) / 10 : 0;
      shareRows.push({ id: r.ch.share.id, requested: requested[r.i], effective: eff.values[r.i], actual, ...(locked[r.i] ? { locked: true } : {}) });
    }
  };
  layout(plan, { ...root });
  if (outOfSteps) { unmet.push({ subject: `layoutPlan:${plan.place}`, reason: 'budget' }); return result('incomplete'); }
  return result(unmet.length ? 'incomplete' : 'complete');
}
function intersect(a, b) {
  const x = Math.max(a.x, b.x); const y = Math.max(a.y, b.y);
  return box(x, y, Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x), Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y));
}
// Does box a lie inside box b (with a small tolerance)?
export const inside = (a, b, eps = 0.01) => a.x >= b.x - eps && a.y >= b.y - eps && a.x + a.width <= b.x + b.width + eps && a.y + a.height <= b.y + b.height + eps;

// ---------- plan-only layouts (7.4) ----------
// The viewBox grown about its centre to the space's aspect: its height kept when the space is wider, its width when
// it is taller.
export function grownViewBox(vb, space) {
  if (!vb || !space || !(space.width > 0 && space.height > 0)) return vb;
  const a = space.width / space.height;
  if (Math.abs(a - vb.width / vb.height) < 1e-9) return vb;
  if (a > vb.width / vb.height) { const w = vb.height * a; return box(vb.x - (w - vb.width) / 2, vb.y, w, vb.height); }
  const h = vb.width / a;
  return box(vb.x, vb.y - (h - vb.height) / 2, vb.width, h);
}
// A root place's box after the viewBox grows: the edges drawn on the viewBox's edges move with it.
export function grownPlace(place, vb, grown) {
  const eq = (p, q) => Math.abs(p - q) < 0.01;
  const out = { ...place };
  if (eq(place.x, vb.x) && eq(place.x + place.width, vb.x + vb.width)) { out.x = grown.x; out.width = grown.width; }
  if (eq(place.y, vb.y) && eq(place.y + place.height, vb.y + vb.height)) { out.y = grown.y; out.height = grown.height; }
  return box(out.x, out.y, out.width, out.height);
}

// ---------- items in a frame ----------
// An item address in a block's frame -> {kind, node, use} or null. A field is the part whose binding shows it alone.
export function resolveItem(address, { byLocal, doc }) {
  const m = /^(part|use|field):(.+)$/.exec(String(address));
  if (!m) return null;
  if (m[1] === 'part') { const node = byLocal.get(m[2]); return node ? { kind: node.attrs?.['data-hsvg-slot'] !== undefined && node.name === 'rect' ? 'slot' : 'part', node } : null; }
  if (m[1] === 'use') {
    const id = m[2].replace(/\[[^\]]*\]$/, '');
    const use = (doc.uses || []).find(u => u.id === id);
    return use ? { kind: 'use', use, key: /\[([^\]]*)\]$/.exec(m[2])?.[1] ?? null } : null;
  }
  const name = m[2];
  const bd = (doc.bindings || []).find(b => typeof b.text === 'string' && new RegExp(`^\\s*\\{\\{\\s*${name.replace(/\./g, '\\.')}\\s*\\}\\}\\s*$`).test(b.text));
  const node = bd && byLocal.get(bd.target);
  return node ? { kind: 'part', node } : null;
}

// ---------- give-way plan steps (8.4, A7.1) ----------
// column: the first row (depth first) becomes a column. crop: each picture item (cover, or with a crop) shows 20% less
// about its focal point, never below half the picture each way (the plan has no safe area; this bound stands for it).
// minimum-share: each unlocked share holding a picture goes to its minimum; an editor's value for it no longer applies.
export const PLAN_STEPS = ['column', 'crop', 'minimum-share'];
const pic = (n) => !!n && (typeof n.item === 'string' ? n.item.startsWith('use:') || n.fit === 'cover' || !!n.crop : (n.children || []).some(c => pic(c.node)));
// One step on a copy of a plan: {plan, moved, unshare (share ids whose editor value goes)}.
export function planStep(plan, step, locks = {}) {
  const p = structuredClone(plan); let moved = false; const unshare = [];
  const each = (n, fn) => { if (!n || typeof n !== 'object') return; fn(n); for (const c of n.children || []) { if (c.share) fn(c, 1); each(c.node, fn); } };
  if (step === 'column') { let r = null; each(p, n => { if (!r && n.kind === 'row') r = n; }); if (r) { r.kind = 'column'; moved = true; } }
  if (step === 'crop') each(p, (n, ch) => {
    if (ch || typeof n.item !== 'string' || !(n.fit === 'cover' || n.crop)) return;
    const [x, y, w, h] = n.crop || [0, 0, 1, 1]; const W = Math.max(0.5, w * 0.8); const H = Math.max(0.5, h * 0.8);
    if (W < w - 1e-9 || H < h - 1e-9) { const [fx, fy] = n.focal || [0.5, 0.5]; n.crop = [x + (w - W) * fx, y + (h - H) * fy, W, H].map(round); moved = true; }
  });
  if (step === 'minimum-share') each(p, (c, ch) => {
    if (!ch || !pic(c.node) || locks[c.share.id]?.locked) return;
    if (c.share.initial !== c.share.minimum) { c.share.initial = c.share.minimum; moved = true; }
    unshare.push(c.share.id);
  });
  return { plan: p, moved, unshare };
}
// The give-way rules that may move a plan: inside and relation rules listing a plan step.
export const planRules = (rules) => (Array.isArray(rules) ? rules : []).filter(r => r?.strength === 'give-way' && ['inside', 'relation'].includes(r.kind) && (r.steps || []).some(s => PLAN_STEPS.includes(s)));
// solve; while incomplete, the rules' plan steps in ladder order, each re-solving. The rules share the plan: one holds
// when the solve is complete. Adds givenWay ([{rule, step, times}]) and plan (the plan solved) to solve's result.
export function solveGivingWay(plan, ctx, rules = []) {
  let cur = plan; let c = ctx; let r = solve(cur, c);
  const mine = planRules(rules);
  const used = mine.length && r.status !== 'complete' ? runLadder(mine, {
    holds: () => r.status === 'complete', related: () => true,
    apply(rule, step) {
      if (!PLAN_STEPS.includes(step)) return false;
      const t = planStep(cur, step, c.shares || {}); const shares = { ...c.shares };
      let gone = false;
      for (const id of t.unshare) if (shares[id] && 'value' in shares[id]) { shares[id] = { locked: shares[id].locked }; gone = true; }
      if (!t.moved && !gone) return false;
      cur = t.plan; c = { ...c, shares }; r = solve(cur, c);
      return true;
    },
  }).used : [];
  return { ...r, givenWay: used, plan: cur };
}
