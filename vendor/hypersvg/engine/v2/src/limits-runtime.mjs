// The limits the engine enforces while playing (9.8), with the player's active limits (engine.limits: the format
// values, raised where the package asks, 9.8.1), and the host profile read at mount (A10.1, host-profile.mjs).
// It is installed by one hook in each of runtime.mjs (installLimits), drawing.mjs (watchArt) and storage.mjs
// (storageGrant, restoredRecord). What it checks, and when:
// - Mounting a block (9.8, 9.2): mount depth, live block uses and SVG elements across mounted drawings, decoded image
//   pixels (each and in total) are E-MOUNT-LIMIT; live repeated uses in one block are E-REPEAT-CAPACITY (4.5);
//   effects in one block are E-RANGE (A1). The transaction that mounts faults and rolls back.
// - In compute, before commit (9.2): live timers and timed links, and deliveries (E-EVENT-LOOP); stored data over
//   savedBytes or sessionBytes (E-MOUNT-LIMIT, never in the deliver phase).
// - Each deadline: deadlines at one engine millisecond (E-EVENT-LOOP); clip marker crossings in one clock step
//   (E-EVENT-LOOP: the spec names no code, see the A5 report).
// - Each formula result: its serialized size in UTF-16 units (5.6.6, E-RANGE).
// - The mounted art (drawing.mjs): SVG elements in the mounted tree and the filter surface (E-MOUNT-LIMIT, pushed to
//   drawing.faults, since the art mounts after the transaction commits).
// - Restored stored data: over its limit, or past the host's retention days, it is not restored (5.1.2).
import { admitHost, budgetResults, expired } from './host-profile.mjs';
import { parseTransform } from './drawing.mjs';

// The engine's fault class, given by installLimits (no import of runtime.mjs: the packer refuses that cycle).
let EngineFault = class extends Error { constructor(code, m, a) { super(`${code} ${a || ''}: ${m}`); this.code = code; this.address = a; } };
const fault = (code, msg, addr) => { throw new EngineFault(code, msg, addr); };
const utf8 = (s) => new TextEncoder().encode(s).length;

// ---------- the art of a block, measured from its drawing text ----------
// Elements: the largest frame of the block (its layouts), counted from the text. Images: decoded pixels of each
// data: image, from its header. A file image is measured only when the host gives imageBytes(path) (none yet).
const ELEMENT = /<[A-Za-z]/g;
const IMAGE = /<image\b[^>]*?\b(?:xlink:)?href\s*=\s*"([^"]*)"/g;

// The pixel size of PNG, GIF, JPEG or WebP bytes: [w, h], or null.
export function imageSize(b) {
  if (!b || b.length < 24) return null;
  const s = (i, n) => String.fromCharCode(...b.slice(i, i + n));
  const be32 = (i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  if (b[0] === 0x89 && s(1, 3) === 'PNG') return [be32(16), be32(20)];
  if (s(0, 3) === 'GIF') return [b[6] | (b[7] << 8), b[8] | (b[9] << 8)];
  if (s(0, 4) === 'RIFF' && s(8, 4) === 'WEBP') {
    const kind = s(12, 4);
    if (kind === 'VP8X') return [1 + (b[24] | (b[25] << 8) | (b[26] << 16)), 1 + (b[27] | (b[28] << 8) | (b[29] << 16))];
    if (kind === 'VP8L') return [1 + (((b[22] & 0x3f) << 8) | b[21]), 1 + (((b[24] & 0xf) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6))];
    if (kind === 'VP8 ') return [(b[26] | (b[27] << 8)) & 0x3fff, (b[28] | (b[29] << 8)) & 0x3fff];
    return null;
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return [(b[i + 7] << 8) | b[i + 8], (b[i + 5] << 8) | b[i + 6]];
      i += 2 + ((b[i + 2] << 8) | b[i + 3]);
    }
  }
  return null;
}
const fromBase64 = (s) => {
  if (typeof atob === 'function') { const t = atob(s); const out = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) out[i] = t.charCodeAt(i); return out; }
  return new Uint8Array(Buffer.from(s, 'base64'));
};
// The decoded pixels of each image in a drawing text: [pixels].
export function imagePixels(text, imageBytes = null) {
  const out = [];
  for (const [, href] of text.matchAll(IMAGE)) {
    let bytes = null;
    const m = /^data:image\/[a-z+.-]+;base64,([A-Za-z0-9+/=\s]*)$/i.exec(href.trim());
    if (m) { try { bytes = fromBase64(m[1].replace(/\s+/g, '').slice(0, 87384)); } catch { bytes = null; } } else if (imageBytes && !href.startsWith('#')) bytes = imageBytes(href);
    const size = imageSize(bytes);
    if (size) out.push(size[0] * size[1]);
  }
  return out;
}
function artOf(engine, kind, def) {
  const cache = (engine.limitArt ??= new Map());
  const key = `${kind}:${def}`;
  if (cache.has(key)) return cache.get(key);
  const owner = kind === 'scene' ? engine.exp.scenes?.[def] : kind === 'shell' ? engine.exp.shell : kind === 'component' ? engine.defs?.[def] : null;
  let elements = 0; let pixels = [];
  for (const f of Object.values(owner?.drawings || {})) {
    const text = f?.text || '';
    elements = Math.max(elements, (text.match(ELEMENT) || []).length);
    const px = imagePixels(text, engine.opts.imageBytes);
    if (px.reduce((a, b) => a + b, 0) > pixels.reduce((a, b) => a + b, 0)) pixels = px;
  }
  const art = { elements, pixels, pixelTotal: pixels.reduce((a, b) => a + b, 0) };
  cache.set(key, art);
  return art;
}

// ---------- stored data (5.1.2, 9.8) ----------
// The storage grant the stores may use: the effective one from the host profile; none without one (closed, 10.5).
export function storageGrant(doc, host) { return host?.grants ?? []; }
// A record read back from a store, or null when it must not be restored: over its stored-data limit (save:invalid),
// or older than the host's retention days (dropped). text: the stored text; host: the storage options.
export function restoredRecord(text, rec, scope, host, notices) {
  if (!rec || !text) return rec;
  const limit = scope === 'saved' ? host?.limits?.savedBytes : host?.limits?.sessionBytes;
  if (limit && utf8(text) > limit) { notices.add('save:invalid'); return null; }
  if (expired(rec.writtenAt, host?.profile, (host?.now || Date.now)())) return null;
  return rec;
}
// The stored JSON each usable scope would hold if this transaction committed, as persist writes it.
function storedTexts(engine) {
  const st = engine.stored;
  const out = {};
  if (!st) return out;
  const exp = engine.exp.doc;
  const graph = engine.graphMemory?.() ?? null;
  const lifetime = exp.story?.lifetime;
  for (const scope of Object.keys(st.stores || {})) {
    const d = st.data[scope];
    const values = { ...d.values };
    for (const [address, b] of Object.entries(engine.state.blocks)) {
      const doc = engine.def(address);
      for (const [k, decl] of Object.entries(doc?.values || {})) if (decl.lifetime === scope) values[`${address}#${k}`] = b.values[k];
    }
    const knobs = { ...d.knobs };
    for (const [k, decl] of Object.entries(exp.inputs || {})) if (decl.kind === 'knob' && decl.lifetime === scope) knobs[k] = engine.state.blocks.experience.inputs[k];
    out[scope] = JSON.stringify({ stamp: exp.saveStamp ?? '', writtenAt: st.now(), values, knobs, graph: lifetime === scope && graph ? graph : d.graph });
  }
  return out;
}

// ---------- the engine hook ----------
// Called once by the Engine constructor, before the first run, with its fault class. Reads the host profile (throws E-GRANT, E-RANGE,
// E-TYPE, E-RULE or E-AXIS-INPUT as an EngineFault), keeps the effective grants and options, and guards the engine.
export function installLimits(engine, Fault) {
  if (Fault) EngineFault = Fault;
  const L = engine.limits;
  let host;
  try { host = admitHost(engine.exp.doc, engine.opts.host ?? null, { options: engine.opts.options || {} }); } catch (e) {
    if (e instanceof EngineFault || !e.code) throw e;
    throw new EngineFault(e.code, e.message.replace(/^\S+ host: /, ''), 'host');
  }
  engine.host = host;
  engine.grants = host.grants;
  engine.options = host.options;
  // Host rules (8.2): budget rules measured on the package bytes the host gives at mount (opts.measures).
  const rules = (host.profile?.rules || []).map(rule => ({ rule, from: 'host' }));
  engine.hostRules = budgetResults(rules, host.profile, engine.opts.measures || {});
  if (engine.opts.storage) engine.opts = { ...engine.opts, storage: { ...engine.opts.storage, grants: host.grants.storage || [], profile: host.profile, limits: L } };

  const blocks = () => engine.state.blocks;
  // Running counts of the mounted blocks (live uses, repeated uses per parent, SVG elements, image pixels), so each
  // admission costs the same whatever is mounted. They belong to one blocks object: a rollback or a reset replaces
  // it, and the counts are taken again once. Mount adds a block; unmount takes away the blocks it removed.
  let tally = null;
  const repParent = (a, b) => (b.kind === 'component' && b.parent && /^\/[^/]+\[[^/]*\]$/.test(a.slice(b.parent.length)) ? b.parent : null);
  const add = (t, a, b, sign) => {
    if (b.kind === 'experience') return;
    const art = artOf(engine, b.kind, b.def);
    t.elements += sign * art.elements; t.pixels += sign * art.pixelTotal;
    if (b.kind !== 'component') return;
    t.live += sign;
    const p = repParent(a, b);
    if (p) t.repeated.set(p, (t.repeated.get(p) || 0) + sign);
  };
  const counts = () => {
    const all = blocks();
    if (tally?.blocks === all) return tally;
    tally = { blocks: all, live: 0, repeated: new Map(), elements: 0, pixels: 0 };
    for (const [a, b] of Object.entries(all)) add(tally, a, b, 1);
    return tally;
  };
  const unmount = engine.unmount.bind(engine);
  engine.unmount = (address) => {
    const t = counts(); const all = blocks();
    const gone = unmount(address);
    if (t.blocks === all) for (const [a, b] of gone) add(t, a, b, -1);
    return gone;
  };
  const mount = engine.mount.bind(engine);
  engine.mount = (address, kind, defId, parent = null, inputs = {}) => {
    const all = blocks();
    const t = counts();
    if (kind === 'component') {
      let depth = 1;
      for (let p = parent; p && all[p]?.kind === 'component'; p = all[p].parent) depth++;
      if (depth > L.mountDepth) fault('E-MOUNT-LIMIT', `a mount depth over ${L.mountDepth} (a use inside a use)`, address);
      const repeats = parent && repParent(address, { kind, parent });
      if (t.live + 1 > L.liveBlockUses) fault('E-MOUNT-LIMIT', `more than ${L.liveBlockUses} live block uses`, address);
      if (repeats && (t.repeated.get(parent) || 0) + 1 > L.liveRepeatedUses) fault('E-REPEAT-CAPACITY', `more than ${L.liveRepeatedUses} live repeated uses in ${parent}`, address);
    }
    const art = artOf(engine, kind, defId);
    for (const px of art.pixels) if (px > L.imagePixelsEach) fault('E-MOUNT-LIMIT', `an image of ${px} decoded pixels, over ${L.imagePixelsEach}`, address);
    if (art.elements || art.pixelTotal) {
      const old = all[address] && all[address].kind !== 'experience' ? artOf(engine, all[address].kind, all[address].def) : { elements: 0, pixelTotal: 0 };
      const elements = t.elements - old.elements + art.elements; const pixels = t.pixels - old.pixelTotal + art.pixelTotal;
      if (elements > L.mountedElements) fault('E-MOUNT-LIMIT', `${elements} SVG elements across mounted drawings, over ${L.mountedElements}`, address);
      if (pixels > L.imagePixelsAll) fault('E-MOUNT-LIMIT', `${pixels} decoded image pixels mounted, over ${L.imagePixelsAll}`, address);
    }
    // The block is in the counts from the moment it is stored, so the uses it mounts see it (as before, by a walk).
    if (all[address]) tally = null;
    else { const b = { kind, def: defId, parent }; const tt = counts(); add(tt, address, b, 1); }
    try { return mount(address, kind, defId, parent, inputs); } catch (e) { tally = null; throw e; }
  };

  // In compute, before commit: timers, deliveries, stored data.
  const transaction = engine.transaction.bind(engine);
  engine.transaction = (source, fn) => transaction(source, () => {
    fn();
    engine.drain();
    let timers = 0;
    for (const t of engine.state.timers) if (t.mid !== undefined || t.link !== undefined) timers++;
    if (timers > L.liveTimers) fault('E-EVENT-LOOP', `more than ${L.liveTimers} live timers and timed links`);
    if (engine.state.deliveries.length > L.deliveriesPerTransaction) fault('E-EVENT-LOOP', `more than ${L.deliveriesPerTransaction} deliveries in one transaction`);
    for (const [scope, text] of Object.entries(storedTexts(engine))) {
      const limit = scope === 'saved' ? L.savedBytes : L.sessionBytes;
      const n = utf8(text);
      if (n > limit) fault('E-MOUNT-LIMIT', `${scope} values would take ${n} bytes, over ${scope}Bytes (${limit})`);
    }
  });

  // Deadlines at one engine millisecond, and the marker crossings of one clip at one engine millisecond (6.7): markers
  // are deadlines, so the count never depends on how time is split into steps.
  let dueAt = null; let dueCount = 0; const crossings = new Map();
  const fire = engine.fire.bind(engine);
  engine.fire = (t) => {
    const at = Math.floor(t.due);
    if (at !== dueAt) { dueAt = at; dueCount = 0; crossings.clear(); }
    if (++dueCount > L.deadlinesPerMs) fault('E-EVENT-LOOP', `more than ${L.deadlinesPerMs} deadlines at ${at} ms`, t.owner);
    if (t.marker) {
      const k = `${t.owner}|${t.clip}`;
      const n = (crossings.get(k) || 0) + 1;
      crossings.set(k, n);
      if (n > L.markerCrossingsPerMs) fault('E-EVENT-LOOP', `more than ${L.markerCrossingsPerMs} crossings of clip ${t.clip}'s markers at ${at} ms`, t.owner);
    }
    return fire(t);
  };

  // The serialized size of each formula result (5.6.6), counted as JSON.stringify would print it but stopping once it
  // passes the limit, so a result that shares one array many times (fold building [acc, acc]) is never walked whole.
  const sized = (address, v) => { const n = jsonUnits(v, L.formulaResultUnits); if (n > L.formulaResultUnits) fault('E-RANGE', `a formula result of more than ${L.formulaResultUnits} UTF-16 units`, address); return v; };
  const evalOne = engine.eval.bind(engine);
  engine.eval = (address, f, extra, deps) => (typeof f === 'string' ? sized(address, evalOne(address, f, extra, deps)) : f); // deps: a computed's reads (runtime computed())
  const template = engine.template.bind(engine);
  engine.template = (address, t, extra) => sized(address, template(address, t, extra));
}

// The UTF-16 length of JSON.stringify(v) for a JSON value; a string counts its own length (a text result). Stops and
// returns max + 1 once the count passes max. It walks with its own stack, never by recursion, so a value of any depth
// is counted (or stopped at max) without a stack overflow; its depth is then its declaration's to judge (5.1).
export function jsonUnits(v, max) {
  if (typeof v === 'string') return v.length;
  if (v === null || typeof v !== 'object') return 0;
  let n = 0;
  const stack = [v];
  while (stack.length && n <= max) {
    const x = stack.pop();
    if (x === null || typeof x !== 'object') { n += x === undefined ? 4 : JSON.stringify(x).length; continue; }
    if (Array.isArray(x)) {
      n += 1 + Math.max(0, x.length - 1) + 1;
      for (let i = x.length - 1; i >= 0 && n <= max; i--) stack.push(x[i] === undefined ? null : x[i]);
      continue;
    }
    const keys = Object.keys(x).filter(k => x[k] !== undefined);
    n += 1 + Math.max(0, keys.length - 1) + 1;
    for (let i = keys.length - 1; i >= 0 && n <= max; i--) { n += JSON.stringify(keys[i]).length + 1; stack.push(x[keys[i]]); }
  }
  return n > max ? Math.max(n, max + 1) : n;
}

// ---------- the mounted art (drawing.mjs) ----------
const SKIP = new Set(['defs', 'mask', 'clipPath', 'symbol', 'pattern', 'filter', 'marker', 'linearGradient', 'radialGradient', 'title', 'desc', 'metadata', 'style']);
const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const frac = (v, d) => (v === undefined ? d : String(v).trim().endsWith('%') ? parseFloat(v) / 100 : num(v, d));
const viewBox = (n) => { const v = String(n.attrs.viewBox || '').trim().split(/[\s,]+/).map(Number); return v.length === 4 && v.every(Number.isFinite) && v[2] > 0 && v[3] > 0 ? v : null; };
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const union = (a, b) => (!a ? b : !b ? a : [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
const boxOf = (pts) => (pts.length ? [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))] : null);
const through = (m, b) => (b ? boxOf([apply(m, b[0], b[1]), apply(m, b[2], b[1]), apply(m, b[0], b[3]), apply(m, b[2], b[3])]) : null);

// The points of a path's data: end and control points, so the box may be a little large (never small).
function pathPoints(d) {
  const toks = String(d || '').match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
  const pts = []; let x = 0; let y = 0; let sx = 0; let sy = 0; let cmd = null; let i = 0;
  const n = () => Number(toks[i++]);
  const ARGS = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    if (!cmd) break;
    const lc = cmd.toLowerCase(); const rel = cmd !== cmd.toUpperCase();
    if (lc === 'z') { x = sx; y = sy; cmd = null; continue; }
    if (i + ARGS[lc] > toks.length) break;
    if (lc === 'h') { x = (rel ? x : 0) + n(); pts.push([x, y]); continue; }
    if (lc === 'v') { y = (rel ? y : 0) + n(); pts.push([x, y]); continue; }
    if (lc === 'a') { const rx = n(); const ry = n(); i += 3; const nx = (rel ? x : 0) + n(); const ny = (rel ? y : 0) + n(); pts.push([x - rx, y - ry], [x + rx, y + ry], [nx, ny]); x = nx; y = ny; continue; }
    const k = ARGS[lc] / 2; let ex = x; let ey = y;
    for (let j = 0; j < k; j++) { ex = (rel ? x : 0) + n(); ey = (rel ? y : 0) + n(); pts.push([ex, ey]); }
    x = ex; y = ey;
    if (lc === 'm') { sx = x; sy = y; cmd = rel ? 'l' : 'L'; }
  }
  return pts;
}
// The box of a node in its own user space (its transform not applied), or null when it cannot be measured.
export function bboxOf(n, ids, depth = 0) {
  if (!n?.name || depth > 16) return null;
  try { if (n.dom?.getBBox) { const b = n.dom.getBBox(); if (b.width || b.height) return [b.x, b.y, b.x + b.width, b.y + b.height]; } } catch { /* not rendered */ }
  const a = n.attrs;
  switch (n.name) {
    case 'rect': case 'image': return [num(a.x), num(a.y), num(a.x) + num(a.width), num(a.y) + num(a.height)];
    case 'circle': return [num(a.cx) - num(a.r), num(a.cy) - num(a.r), num(a.cx) + num(a.r), num(a.cy) + num(a.r)];
    case 'ellipse': return [num(a.cx) - num(a.rx), num(a.cy) - num(a.ry), num(a.cx) + num(a.rx), num(a.cy) + num(a.ry)];
    case 'line': return boxOf([[num(a.x1), num(a.y1)], [num(a.x2), num(a.y2)]]);
    case 'polygon': case 'polyline': { const v = String(a.points || '').trim().split(/[\s,]+/).map(Number); const p = []; for (let k = 0; k + 1 < v.length; k += 2) p.push([v[k], v[k + 1]]); return boxOf(p); }
    case 'path': return boxOf(pathPoints(a.d));
    case 'use': {
      const ref = ids.get(String(a.href || a['xlink:href'] || '').replace(/^#/, ''));
      if (!ref) return null;
      let b = ref.name === 'symbol' || ref.name === 'svg' ? (num(a.width) && num(a.height) ? [0, 0, num(a.width), num(a.height)] : viewBox(ref) && [0, 0, viewBox(ref)[2], viewBox(ref)[3]]) : through(parseTransform(ref.attrs.transform), bboxOf(ref, ids, depth + 1));
      if (!b) return null;
      return [b[0] + num(a.x), b[1] + num(a.y), b[2] + num(a.x), b[3] + num(a.y)];
    }
    case 'g': case 'a': case 'svg': {
      if (n.name === 'svg' && depth > 0 && num(a.width) && num(a.height)) return [num(a.x), num(a.y), num(a.x) + num(a.width), num(a.y) + num(a.height)];
      if (!n.children.some(c => c.name && !SKIP.has(c.name))) return [0, 0, 0, 0]; // nothing drawn: no area
      let b = null;
      for (const c of n.children) if (c.name && !SKIP.has(c.name)) b = union(b, through(parseTransform(c.attrs.transform), bboxOf(c, ids, depth + 1)));
      return b;
    }
    default: return null;
  }
}
// The filter surface of a mounted tree (9.8): the sum of the filter regions of all filtered elements, over the
// player box area (the root's viewBox). Filtered content inside masks counts once, in the mask's own space. Returns {ratio, filtered, unmeasured}. Transforms and nested viewports
// scale each region; an element whose box cannot be measured (text, a missing reference) is left out and counted.
export function filterSurface(root) {
  const ids = new Map();
  const index = (n) => { if (!n.name) return; if (n.attrs.id) ids.set(n.attrs.id, n); n.children.forEach(index); };
  index(root);
  const vb = viewBox(root) || [0, 0, num(root.attrs.width, 0), num(root.attrs.height, 0)];
  const boxArea = vb[2] * vb[3];
  let sum = 0; let filtered = 0; let unmeasured = 0;
  // Content inside a mask is filtered when the mask is drawn, so it counts; other definitions only count where used.
  const walk = (n, scale, isRoot) => {
    if (!n.name) return;
    if (n.name === 'defs') { for (const c of n.children) if (c.name === 'mask') walk(c, scale, false); return; }
    if (SKIP.has(n.name) && n.name !== 'mask') return;
    const m = parseTransform(n.attrs.transform);
    let s = scale * Math.abs(m[0] * m[3] - m[1] * m[2]);
    if (n.name === 'svg' && !isRoot) {
      const v = viewBox(n); const w = num(n.attrs.width, 0); const h = num(n.attrs.height, 0);
      if (v && w && h) { const k = n.attrs.preserveAspectRatio === 'none' ? (w * h) / (v[2] * v[3]) : Math.min(w / v[2], h / v[3]) ** 2; s *= k; }
    }
    const ref = /url\(\s*#([^)\s]+)\s*\)/.exec(n.attrs.filter || '');
    const f = ref && ids.get(ref[1]);
    if (f) {
      filtered++;
      const fa = f.attrs;
      if (fa.filterUnits === 'userSpaceOnUse') sum += s * frac(fa.width, 1.2) * (String(fa.width ?? '').endsWith('%') ? vb[2] : 1) * frac(fa.height, 1.2) * (String(fa.height ?? '').endsWith('%') ? vb[3] : 1);
      else {
        const b = bboxOf(n, ids);
        if (!b) unmeasured++;
        else sum += s * (b[2] - b[0]) * (b[3] - b[1]) * frac(fa.width, 1.2) * frac(fa.height, 1.2);
      }
    }
    for (const c of n.children) walk(c, s, false);
  };
  walk(root, 1, true);
  return { ratio: boxArea > 0 ? sum / boxArea : 0, filtered, unmeasured };
}
const countElements = (n) => (n?.name ? 1 + n.children.reduce((a, c) => a + countElements(c), 0) : 0);

// Called once by the Drawing constructor: after each scene, shell or stage mount, the mounted tree is measured
// against mountedElements and filterSurface. Over a limit is a fault in drawing.faults (E-MOUNT-LIMIT).
export function watchArt(drawing) {
  const L = drawing.engine.limits;
  const measure = (address) => {
    const root = drawing.root;
    if (!root) return;
    const elements = countElements(root);
    if (elements > L.mountedElements) drawing.faults.push({ code: 'E-MOUNT-LIMIT', address, message: `${elements} SVG elements across mounted drawings, over ${L.mountedElements}` });
    const fs = filterSurface(root);
    drawing.filterSurface = fs;
    if (fs.ratio > L.filterSurface) drawing.faults.push({ code: 'E-MOUNT-LIMIT', address, message: `a filter surface of ${fs.ratio.toFixed(2)} times the player box area, over ${L.filterSurface}` });
  };
  for (const name of ['mountScene', 'mountShell', 'mountStage']) {
    const orig = drawing[name].bind(drawing);
    drawing[name] = (...args) => { const r = orig(...args); measure(args[0]); return r; };
  }
}
