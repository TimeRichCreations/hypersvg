// Layout plans that files can prove (7.5, 7.4).
// - Limits: depth 12, 2,048 nodes; a scale's minimum above its maximum (E-RANGE).
// - Shares: each share's minimum <= initial <= maximum, all inside 0 to 100; one parent's initial values total 100
//   (at most 100 when the parent also has weight children); the minimums total at most 100 and, without weight
//   children, the maximums at least 100 (E-RANGE). One share id in the plans of several layouts of a block is one
//   knob: the same bounds (E-TYPE).
// - References: `repeat` names a repeated use of the block; an item is a part drawn in the frame, a use of the block
//   or a field; any other kind is not a layout item (E-REF-UNKNOWN).
// - The drawing: in each frame where the layout applies (its own drawing, else the block's) the root place exists
//   (E-DRAWN-MISSING, naming the file) and is a <rect> with no transform (E-PLACE).
// - Item boxes: at each must size the layout applies to, and at both aspect edges of its shape range, every item box
//   lies inside the root place (E-RANGE). Fixed sizes, shares and text that do not fit make an output incomplete,
//   which is not a file error.
// - Field items: `field:<name>` is the part whose text or runs binding shows that field alone; a field item that no
//   part shows is E-REF-UNKNOWN (a column of a list row is not a field item in 2.0). A use item whose slot is a <g>
//   has no box (E-PLACE).
// - Overlaps (E-OVERLAP): at each must size a scene's or shell's layout applies to, no two item boxes overlap unless a `relation` rule with
//   `is: "overlay"` names the two, or one is painted as backdrop or decoration (6.4). A text item counts as its cell.
// - W-PLAN-SCALE: at a declared size of a scene or shell, a text the plan places, drawn at its type size times the
//   frame's design scale, is under the readable floor (7.5): a strip or tower wants a frame of its own.
import { parseXml } from '../schema/xml.mjs';
import { applies, chooseLayout, rangeOf, shapeMapsOf, parseSize } from '../src/layout.mjs';
import * as P from '../src/plan.mjs';
import { readableFloor } from '../src/ladder.mjs';
import { roleOf } from '../src/marks.mjs';

export function check(ctx) {
  const { experience: exp, report } = ctx;
  const owners = [...Object.values(exp.scenes), ...Object.values(exp.blocks)];
  if (exp.shell) owners.push(exp.shell);
  const must = []; const declared = [];
  const addSizes = (doc) => { for (const a of doc?.axes || []) if (a?.axis === 'shape' && a.sizes) for (const [sz, c] of Object.entries(a.sizes)) { if (c === 'must' && !must.includes(sz)) must.push(sz); if (!declared.includes(sz)) declared.push(sz); } };
  addSizes(exp.doc);
  for (const sc of Object.values(exp.scenes)) addSizes(sc.doc);
  for (const o of owners) {
    const layouts = Array.isArray(o.doc.layouts) ? o.doc.layouts : [];
    const isScene = Object.values(exp.scenes).includes(o) || o === exp.shell;
    const knobs = new Map(); // share id -> {minimum, maximum, layout}
    layouts.forEach((l, i) => {
      const plan = l?.layoutPlan;
      if (!plan || typeof plan !== 'object') return;
      const at = `/layouts/${i}/layoutPlan`;
      const say = (code, path, msg) => report(code, o.file, `${at}${path}`, `layout ${l.id}: ${msg} (7.5)`);
      const st = P.planStats(plan);
      if (st.depth > P.PLAN_LIMITS.depth || st.nodes > P.PLAN_LIMITS.nodes) say('E-RANGE', '', `the plan has depth ${st.depth} and ${st.nodes} nodes; at most ${P.PLAN_LIMITS.depth} and ${P.PLAN_LIMITS.nodes}`);
      if (plan.scale && plan.scale.minimum > plan.scale.maximum) say('E-RANGE', '/scale', `the scale's minimum ${plan.scale.minimum} is above its maximum ${plan.scale.maximum}`);
      for (const g of P.shareGroups(plan)) {
        const sum = (k) => g.shares.reduce((t, s) => t + (Number(s[k]) || 0), 0);
        for (const s of g.shares) {
          if (!(s.minimum >= 0 && s.maximum <= 100 && s.minimum <= s.initial && s.initial <= s.maximum)) say('E-RANGE', g.path, `share ${s.id}: minimum ${s.minimum}, initial ${s.initial} and maximum ${s.maximum} must hold 0 <= minimum <= initial <= maximum <= 100`);
          const seen = knobs.get(s.id);
          if (seen && (seen.minimum !== s.minimum || seen.maximum !== s.maximum)) say('E-TYPE', g.path, `share ${s.id} has bounds ${s.minimum} to ${s.maximum}; in layout ${seen.layout} it has ${seen.minimum} to ${seen.maximum}. One share id is one knob of the block`);
          else if (!seen) knobs.set(s.id, { minimum: s.minimum, maximum: s.maximum, layout: l.id });
        }
        const init = sum('initial');
        if (g.weights ? init > 100 + 1e-9 : Math.abs(init - 100) > 1e-9) say('E-RANGE', g.path, `the shares' initial values total ${init}; they must total ${g.weights ? 'at most 100 beside weight children' : '100'}`);
        if (sum('minimum') > 100 + 1e-9) say('E-RANGE', g.path, `the shares' minimums total ${sum('minimum')}, over 100`);
        if (!g.weights && sum('maximum') < 100 - 1e-9) say('E-RANGE', g.path, `the shares' maximums total ${sum('maximum')}, under 100`);
      }
      const uses = Array.isArray(o.doc.uses) ? o.doc.uses : [];
      for (const r of P.planRepeats(plan)) if (!uses.some(u => u?.id === r.repeat && u.items !== undefined)) say('E-REF-UNKNOWN', `${r.path}/repeat`, `repeat ${r.repeat} is not a repeated use of this block`);
      // The frames where the layout applies: its own drawing, else the block's.
      const frame = (l.drawing ? o.drawings?.[l.id] : o.drawings?.main) || null;
      if (!frame) return; // a missing file is E-FILE-MISSING
      let root;
      try { root = parseXml(frame.text); } catch { return; }
      const ns = isScene ? null : o.doc.id;
      const byLocal = new Map();
      const walk = (n, parent) => { if (!n.name) return; n.parent = parent; const id = n.attrs.id; if (id) byLocal.set(ns && id.startsWith(`${ns}__`) ? id.slice(ns.length + 2) : id, n); n.children.forEach(c => walk(c, n)); };
      walk(root, null);
      const place = byLocal.get(plan.place);
      if (!place) { report('E-DRAWN-MISSING', frame.file, 'svg', `layout ${l.id} of ${o.file}: the root place ${plan.place} is not drawn in ${frame.file} (7.5)`); return; }
      if (place.name !== 'rect' || place.attrs.transform !== undefined) { report('E-PLACE', frame.file, plan.place, `layout ${l.id} of ${o.file}: the root place ${plan.place} must be a <rect> with no transform (7.5)`); return; }
      let unknown = false;
      for (const it of P.planItems(plan)) {
        const kind = /^([a-z-]+):/.exec(it.item)?.[1];
        if (kind === 'field') {
          if (!fieldPart(it.item, byLocal, o.doc)) { say('E-REF-UNKNOWN', `${it.path}/item`, `${it.item}: no part in ${frame.file} shows that field alone (a text or runs binding of the field)`); unknown = true; }
          continue;
        }
        if (kind === 'use') {
          const u = (o.doc.uses || []).find(x => x?.id === it.item.slice(4).replace(/\[[^\]]*\]$/, ''));
          const slot = u && [...byLocal.values()].find(n => n.attrs['data-hsvg-slot'] === u.into);
          if (slot && slot.name !== 'rect') { report('E-PLACE', frame.file, slot.attrs.id || u.into, `layout ${l.id} of ${o.file}: the use item ${it.item} has no box: its slot ${u.into} is a <${slot.name}>, and a plan places a use only in a <rect> slot (7.5)`); unknown = true; continue; }
        }
        if (kind !== 'part' && kind !== 'use') { say('E-REF-UNKNOWN', `${it.path}/item`, `${it.item} is not a layout item: an item is a part, a use or a field`); unknown = true; continue; }
        if (!P.resolveItem(it.item, { byLocal, doc: o.doc })) { say('E-REF-UNKNOWN', `${it.path}/item`, `${it.item} is not ${kind === 'part' ? `drawn in ${frame.file}` : 'a use of this block'}`); unknown = true; }
      }
      if (unknown) return;
      // Item boxes inside the root: at the must sizes it applies to (scenes and shells), and at its shape's edges.
      const vb = P.viewBoxOf(root);
      const spaces = [];
      if (isScene) for (const sz of must) { const s = parseSize(sz); if (s && applies(l, s, shapeMapsOf(o.doc, exp.doc))) spaces.push([sz, s]); }
      const range = l.shape !== undefined ? rangeOf(l.shape, shapeMapsOf(o.doc, exp.doc)) : null;
      if (range && vb) {
        if (Number.isFinite(range.minAspect) && range.minAspect > 0) spaces.push([`the aspect ${range.minAspect}`, { width: vb.width, height: vb.width / range.minAspect }]);
        if (Number.isFinite(range.maxAspect) && range.maxAspect > 0) spaces.push([`just under the aspect ${range.maxAspect}`, { width: vb.width, height: vb.width / (range.maxAspect * 0.999) }]);
      }
      // W-PLAN-SCALE: at each declared size the layout applies to, a text the plan places is drawn at its type size
      // times the frame's design scale (7.3); under the readable floor, the frame wants its own drawing (7.5).
      if (isScene && vb) {
        const small = []; // [size, text, px, floor]
        for (const sz of declared) {
          const space = parseSize(sz);
          // Only the sizes where the engine picks this layout: an earlier layout that applies is picked first.
          if (!space || chooseLayout(o.doc.layouts, space, { maps: shapeMapsOf(o.doc, exp.doc) }).id !== l.id) continue;
          const g = l.drawing ? vb : P.grownViewBox(vb, space);
          const scale = Math.min(space.width / g.width, space.height / g.height);
          if (scale >= 1 - 1e-9) continue; // drawn at its size or larger: the plan does not scale the text down
          // The texts each item draws, with the scale the solve gives the item (a use: its viewBox in its cell).
          let r = null; try { r = solved(plan, l, root, place, byLocal, o.doc, exp, space); } catch { r = null; }
          for (const it of P.planItems(plan)) {
            const kind = /^([a-z-]+):/.exec(it.item)?.[1];
            let node = kind === 'field' ? fieldPart(it.item, byLocal, o.doc) : kind === 'part' ? P.resolveItem(it.item, { byLocal, doc: o.doc })?.node : null;
            let k = scale;
            if (kind === 'use') {
              const u = (o.doc.uses || []).find(x => x?.id === it.item.slice(4).replace(/\[[^\]]*\]$/, ''));
              const def = u && exp.blocks[u.use];
              const text = def && (def.drawings?.main?.text || Object.values(def.drawings || {})[0]?.text);
              try { node = text ? parseXml(text) : null; } catch { node = null; }
              const b = r?.boxes.find(x => x.item === it.item);
              k = scale * (b ? Math.min(b.scale[0], b.scale[1]) : 1);
            }
            const texts = []; (function find(n) { if (!n?.name) return; if (n.name === 'text') texts.push(n); else n.children.forEach(find); })(node);
            for (const t of texts) {
              const size = Number(t.attrs['font-size']);
              if (!(size > 0)) continue;
              let role = null; for (let x = t; x && !role; x = x.parent) role = roleOf(x.attrs);
              const floor = readableFloor([exp.doc, o.doc], role, exp.host?.readable ?? 12);
              const px = Math.round(size * k * 100) / 100;
              if (px < floor - 0.01) { small.push(`${sz}: ${t.attrs.id || it.item} at ${px} px (scale ${Math.round(scale * 1000) / 1000})`); break; }
            }
          }
        }
        // One finding per layout, naming each size.
        if (small.length) report('W-PLAN-SCALE', o.file, at, `layout ${l.id}: the plan scales the frame's text under the readable floor at ${[...new Set(small.map(x => x.split(':')[0]))].join(', ')} (${small.join('; ')}). A strip or a tower wants a frame drawn at its own size (7.5)`);
      }
      for (const [label, space] of spaces) {
        const out = outside(plan, l, root, place, byLocal, o.doc, exp, space);
        if (out) say('E-RANGE', '', `at ${label}, the box of ${out.item} leaves the root place ${plan.place}`);
        const lap = must.includes(label) ? overlap(plan, l, root, place, byLocal, o.doc, exp, space) : null; // must sizes only
        if (lap) report('E-OVERLAP', o.file, at, `layout ${l.id}: at ${label}, the boxes of ${lap[0]} and ${lap[1]} overlap, and no relation rule allows overlay (7.5)`);
      }
    });
  }
}

// The part a field item names (7.5): the target of a binding whose text is that field alone, or whose runs are it.
export function fieldPart(address, byLocal, doc) {
  const r = P.resolveItem(address, { byLocal, doc });
  if (r) return r.node;
  const name = String(address).slice('field:'.length);
  const bd = (doc.bindings || []).find(b => typeof b?.['rich-text']?.runs === 'string' && b['rich-text'].runs.trim() === name);
  return (bd && byLocal.get(bd.target)) || null;
}

// The first pair of item boxes that overlap when the plan is solved at a space, as [item, item], or null. Items
// painted as backdrop or decoration may overlap; so may two items a relation rule with is "overlay" names. A text
// item counts as its cell: text that leaves its cell is an incomplete output, not a file error.
function overlap(plan, layout, root, place, byLocal, doc, exp, space) {
  const r = solved(plan, layout, root, place, byLocal, doc, exp, space);
  const paintOf = (item) => { const x = /^part:/.test(item) || /^field:/.test(item) ? (/^field:/.test(item) ? fieldPart(item, byLocal, doc) : byLocal.get(item.slice(5))) : null; return x?.attrs?.['data-hsvg-layer'] ?? null; };
  const base = (item) => item.replace(/\[[^\]]*\]$/, '');
  const rules = [...(doc.rules || []), ...(exp.doc.rules || [])].filter(x => x?.kind === 'relation' && x.is === 'overlay');
  const names = (v) => [].concat(v ?? []).filter(x => typeof x === 'string');
  const allowed = (a, b) => rules.some(x => (names(x.subject).includes(a) && names(x.to).includes(b)) || (names(x.subject).includes(b) && names(x.to).includes(a)));
  const boxes = r.boxes.filter(b => !['backdrop', 'decoration'].includes(paintOf(b.item))).map(b => ({ item: b.item, box: b.text ? b.cell : b.shown }));
  const eps = 0.5;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].box; const b = boxes[j].box;
      const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (w > eps && h > eps && !allowed(base(boxes[i].item), base(boxes[j].item))) return [boxes[i].item, boxes[j].item];
    }
  }
  return null;
}

// The first item whose box leaves the root place when the plan is solved at a space, or null. Parts are measured
// as drawn; a use counts as its definition's drawing (its viewBox).
function outside(plan, layout, root, place, byLocal, doc, exp, space) {
  const { r, rootBox } = solvedWithRoot(plan, layout, root, place, byLocal, doc, exp, space);
  for (const b of r.boxes) if (!b.text && !P.inside(b.shown, rootBox, 0.5)) return b; // text that does not fit is incomplete, not E-RANGE
  return null;
}
const solved = (...a) => solvedWithRoot(...a).r;
// The plan solved at a space, with its root box.
function solvedWithRoot(plan, layout, root, place, byLocal, doc, exp, space) {
  let rootBox = P.measure(place);
  const vb = P.viewBoxOf(root);
  if (!layout.drawing && vb) { const g = P.grownViewBox(vb, space); rootBox = P.grownPlace(rootBox, vb, g); }
  const item = (address, cell) => {
    const r = P.resolveItem(address, { byLocal, doc });
    if (r?.kind === 'part') return { box: P.measure(r.node), text: P.isText(r.node) };
    const u = r?.kind === 'use' ? r.use : r?.kind === 'slot' ? (doc.uses || []).find(x => x.into === r.node.attrs['data-hsvg-slot']) : null;
    const def = u && exp.blocks[u.use];
    const text = def && (def.drawings?.main?.text || Object.values(def.drawings || {})[0]?.text);
    let own = null;
    try { own = text ? P.viewBoxOf(parseXml(text)) : null; } catch { own = null; }
    return { box: own || { x: 0, y: 0, width: cell.width || 1, height: cell.height || 1 }, picture: true };
  };
  const repeat = (name) => { const u = (doc.uses || []).find(x => x.id === name); const n = Math.max(1, Math.min(Number(u?.maxItems) || 1, 64)); return Array.from({ length: n }, (_, i) => `use:${name}[${i}]`); };
  const r = P.solve(plan, { root: rootBox, item, repeat, spacing: Object.values(exp.doc.themes || {})[0]?.spacing });
  return { r, rootBox };
}
