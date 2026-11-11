// The motion capability's channels (6.7, capabilities/motion.json) and the points binding (6.8), as far as files show
// them. Per block and frame, for clip tracks and channel bindings on local targets:
// - route: the `route` key names a part drawn with data-hsvg-route (E-REF-UNKNOWN); the target has a placement point,
//   its data-hsvg-pivot (E-PIVOT);
// - morph: the target and the part named by `to` are <path> parts with the same commands and count of numbers
//   (E-TYPE);
// - fill, stroke: the target draws a paint of that kind that is not none (E-TYPE); a key or value written as a
//   string literal is a #rrggbb colour (E-TYPE);
// - dash: the target is a stroked shape or path (<path>, <circle>, <ellipse>, <line>, <polyline>, <polygon>, <rect>
//   with a stroke that is not none) that carries pathLength="1" (E-TYPE);
// - wipe: the target draws no clip-path of its own: the channel owns it (E-WRITER);
// - points: the target is a <polyline> and `area` names a drawn <rect> (E-PLACE).
// The value types and ranges are checked with the formulas (formula/sites.mjs); needs by the schemas.
import { channelOf, wordOf, valueOf } from '../src/binding-words.mjs';
import { parseXml } from '../schema/xml.mjs';
import { isHex } from '../src/paint-channels.mjs';
import { resultLiterals } from './refs/walk.mjs';
import { optional } from './optional.mjs';
import { growthSites, growthOf } from './builtins.mjs';
import { parseMotion } from '../src/physics.mjs';

// D39: an add-on channel's writer sets the part channels its manifest's onto lists; the engine keeps each inside the
// target part's drawn motion range. A part with no drawn range for a channel it would move is E-ADDON (opacity needs
// none: it stays 0..1).
const INNER = { x: 'translate-x', y: 'translate-y', rotate: 'rotate', scale: 'scale' };
function growthRanges(ctx, o, frames) {
  for (const g of growthSites(o.doc)) {
    if (g.slot !== 'paints') continue;
    const { decl } = growthOf(ctx.experience, g.value, 'paints');
    if (!decl) continue;
    const src = g.at[0] === 'bindings' ? o.doc.bindings[g.at[1]] : o.doc.clips[g.at[1]].tracks[g.at[3]];
    const path = g.at.map((k, i) => (typeof k === 'number' ? `[${k}]` : (i ? '.' : '') + k)).join('');
    for (const target of [src.target, ...(src.stagger?.targets || [])]) for (const f of frames) {
      const n = f.nodes.get(target);
      if (!n) continue;
      const have = parseMotion(n.attrs['data-hsvg-motion']);
      const free = String(n.attrs['data-hsvg-motion'] || '');
      for (const on of decl.onto) if (INNER[on] && !have[INNER[on]] && !new RegExp(`(^|;)\\s*${on === 'x' || on === 'y' ? 'translate' : on}[\\w-]*\\s+\\*`).test(free)) ctx.report('E-ADDON', o.file, path, `${g.value} sets ${on} on ${target}, which has no drawn ${on === 'x' || on === 'y' ? `translate-${on}` : on} range in layout ${f.layout}: draw one (data-hsvg-motion), so the engine keeps the add-on's writer inside it (D39)`);
    }
  }
}

// morph is the motion add-on's channel (D28): its shape check comes with the add-on's code. Without it (the core
// release) a morph needs an add-on the release does not hold, and check/index.mjs says so before this family runs.
const motionCode = await optional(new URL('../src/capabilities/motion.mjs', import.meta.url).href);
const morphMismatch = motionCode?.morphMismatch ?? (() => null);

const local = (t) => typeof t === 'string' && !/[./]/.test(t);

// [{layout, file, nodes: Map(localId -> node)}] for one block.
function frameNodes(o) {
  const ns = o.doc.id;
  const id = (x) => (x === ns ? x : x.startsWith(`${ns}__`) ? x.slice(ns.length + 2) : x);
  const out = [];
  for (const [layout, d] of Object.entries(o.drawings || {})) {
    let root;
    try { root = parseXml(d.text); } catch { continue; }
    const nodes = new Map();
    const walk = (n, parent) => { if (!n.name) return; n.parent = parent; if (n.attrs.id) nodes.set(id(n.attrs.id), n); n.children.forEach(c => walk(c, n)); };
    walk(root, null);
    out.push({ layout, file: d.file, nodes });
  }
  return out;
}
// A paint drawn on the part or, for a group, on what it holds.
function drawsPaint(n, kind) {
  const own = (x) => { const v = x.attrs[kind] ?? (/(?:^|;)\s*([a-z-]+)\s*:/.test(x.attrs.style || '') ? new RegExp(`(?:^|;)\\s*${kind}\\s*:\\s*([^;]+)`).exec(x.attrs.style)?.[1]?.trim() : undefined); return v !== undefined && v !== 'none'; };
  if (own(n)) return true;
  return n.name === 'g' && n.children.some(c => c.name && drawsPaint(c, kind));
}

const DASH_SHAPES = new Set(['path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect']);
// The stroke a shape draws: its own, else one inherited from a group above it.
function strokeOf(n) {
  for (let x = n; x; x = x.parent) {
    const v = x.attrs?.stroke ?? new RegExp('(?:^|;)\\s*stroke\\s*:\\s*([^;]+)').exec(x.attrs?.style || '')?.[1]?.trim();
    if (v !== undefined) return v !== 'none';
  }
  return false;
}
export function check(ctx) {
  const { experience: exp, report } = ctx;
  const owners = [...Object.values(exp.scenes), ...Object.values(exp.blocks)];
  if (exp.shell) owners.push(exp.shell);
  for (const o of owners) {
    const doc = o.doc;
    const frames = frameNodes(o);
    growthRanges(ctx, o, frames);
    const writers = [];
    for (const [cid, clip] of Object.entries(doc.clips || {})) {
      (Array.isArray(clip?.tracks) ? clip.tracks : []).forEach((t, i) => {
        if (!t || typeof t !== 'object') return;
        for (const target of [t.target, ...(t.stagger?.targets || [])]) writers.push({ src: t, target, path: `/clips/${cid}/tracks/${i}`, what: `clip ${cid}, track ${t.id ?? `#${i}`}`, values: (t.keys || []).map((k, j) => [`/keys/${j}/1`, Array.isArray(k) ? k[1] : undefined]) });
      });
    }
    (Array.isArray(doc.bindings) ? doc.bindings : []).forEach((b, i) => {
      if (!b || typeof b !== 'object') return;
      if (channelOf(b)) writers.push({ src: b, target: b.target, path: `/bindings/${i}`, what: `binding ${b.id ?? `#${i}`}`, values: [[`/${wordOf(b)}`, valueOf(b)]] });
      if (b.draw !== undefined && b.as === 'points' && local(b.target)) {
        for (const f of frames) {
          const n = f.nodes.get(b.target); const a = f.nodes.get(b.area);
          if (n && n.name !== 'polyline') report('E-PLACE', o.file, `/bindings/${i}/target`, `binding ${b.id ?? `#${i}`}: a points binding draws a <polyline>; ${b.target} is a <${n.name}> in layout ${f.layout} (6.8)`);
          if (n && a?.name !== 'rect') report('E-PLACE', o.file, `/bindings/${i}/area`, `binding ${b.id ?? `#${i}`}: the area ${b.area} is ${a ? `a <${a.name}>` : 'not drawn'} in layout ${f.layout}; it must be a drawn <rect> (6.8)`);
        }
      }
    });
    for (const w of writers) {
      const ch = channelOf(w.src);
      if (!['route', 'morph', 'fill', 'stroke', 'dash', 'wipe'].includes(ch) || !local(w.target)) continue;
      if (ch === 'fill' || ch === 'stroke') {
        // Every text the formula can give (each branch of a conditional) is #rrggbb: a theme role here faults while
        // playing. A theme role goes through color as marked and a colour mark (6.8, 6.2.3).
        for (const [p, v] of w.values) {
          const lit = typeof v === 'string' ? (resultLiterals(v) || []).find(x => !isHex(x)) ?? null : null;
          if (lit === null && (v === undefined || typeof v === 'string')) continue;
          const role = lit !== null && !lit.startsWith('#') ? `. For a theme role, use color as marked (the default: leave out "as") with a colour mark on the part, data-hsvg-color="${ch}:${lit}"` : '';
          report('E-TYPE', o.file, `${w.path}${p}`, `${w.what}: a ${ch} value is a #rrggbb colour, not ${JSON.stringify(lit ?? v)}${role}; else write a #rrggbb value, such as '#5a3a30' (6.7, 6.8)`);
        }
      }
      for (const f of frames) {
        const n = f.nodes.get(w.target);
        if (!n) continue; // the target check reports a missing part
        if (ch === 'wipe') {
          if (n.attrs['clip-path'] !== undefined) report('E-WRITER', o.file, `${w.path}/target`, `${w.what}: the wipe channel owns the clip path of ${w.target}, which draws its own clip-path in layout ${f.layout}; clip a group inside it instead (6.7, 9.3)`);
        } else if (ch === 'dash') {
          const why = !DASH_SHAPES.has(n.name) ? `${w.target} is a <${n.name}>` : !strokeOf(n) ? `${w.target} has no stroke` : n.attrs.pathLength !== '1' ? `${w.target} has no pathLength="1"` : null;
          if (why) report('E-TYPE', o.file, `${w.path}/target`, `${w.what}: draw paints a share of a stroked shape or path that carries pathLength="1"; ${why} in layout ${f.layout} (6.7)`);
        } else if (ch === 'route') {
          const r = f.nodes.get(w.src.route);
          if (!r || r.attrs['data-hsvg-route'] === undefined || !['path', 'line', 'polyline'].includes(r.name)) report('E-REF-UNKNOWN', o.file, `${w.path}/route`, `${w.what}: ${w.src.route} is not a drawn route (data-hsvg-route on a <path>, <line> or <polyline>) in layout ${f.layout} (6.7)`);
          if (n.attrs['data-hsvg-pivot'] === undefined) report('E-PIVOT', o.file, `${w.path}/target`, `${w.what}: ${w.target} follows a route by its placement point; give it data-hsvg-pivot (6.2.1) in layout ${f.layout}`);
        } else if (ch === 'morph') {
          const to = f.nodes.get(w.src.to);
          const why = n.name !== 'path' ? `${w.target} is a <${n.name}>` : !to ? `${w.src.to} is not drawn` : to.name !== 'path' ? `${w.src.to} is a <${to.name}>` : morphMismatch(n.attrs.d, to.attrs.d);
          if (why) report('E-TYPE', o.file, `${w.path}/to`, `${w.what}: morph needs two <path> parts with the same commands; ${why} in layout ${f.layout} (6.7)`);
        } else if (!drawsPaint(n, ch)) report('E-TYPE', o.file, `${w.path}/target`, `${w.what}: ${w.target} draws no ${ch} (or none) in layout ${f.layout}; a ${ch} channel blends a drawn paint (6.7)`);
      }
    }
  }
}
