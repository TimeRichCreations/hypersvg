// A slider with no stops, compared exactly (5.11; F1a item 2). Without `positions`, a slider's value can be any number
// between its bounds (an arrow moves a tenth of the range), so `lane === 1` or `lane !== 2` rarely holds as meant.
// W-SLIDER-EQUALS: a value a slider without `positions` writes is compared with `===` or `!==` in a formula of the
// block that holds it (or, for an experience value, in any scene or the experience). A value with a `step` is left
// out: it is stepped already.
// E-RANGE (F2): a slider's `range` is the handle's travel from where it is drawn, along its axis, in the handle's
// parent units. In every layout both ends lie inside the handle's drawn motion range for that axis (translate-x for
// x, translate-y for y).
// An angle slider (axis angle, K1): its target turns about its pivot (E-PIVOT); range is the turn in degrees from the
// drawn angle, its span more than 0 and at most 360, inside the target's rotate motion range or rotate * (E-RANGE); no
// clip track writes the target's rotate (E-WRITER).
// W-CONTROL-STILL (K1): no binding of the target's axis channel (rotate, translate-x or translate-y; a handle that
// follows a leader, the leader's) reads the slider's value, directly or through a computed value: the part does not
// show its value at rest.
// E-TYPE (K1): `held` (press, slider) and `checked` (press) name a boolean value of the block.
// W-LABEL-HAS-VALUE (E2): a slider's `label` template reads the slider's own `value`, directly or through a computed
// value. The value is already spoken as the value (and as `valueText`), so a screen reader says it twice.
// Codes: W-SLIDER-EQUALS, E-RANGE, E-PIVOT, E-WRITER, W-CONTROL-STILL, E-TYPE, W-LABEL-HAS-VALUE.
import { bindingFor } from './say.mjs';
import { channelOf } from '../src/binding-words.mjs';
import { markChannel } from '../src/physics.mjs';
import { parse, parseTemplate } from '../src/formula.mjs';
import { blockSites, declsFor } from './formula/sites.mjs';
import { motionFrames } from './formula/motion.mjs';

// The names a tree compares with === or !== (one side is the bare name).
function comparedNames(tree, out = new Set()) {
  if (!tree || typeof tree !== 'object') return out;
  if (tree.k === 'bin' && (tree.op === '===' || tree.op === '!==')) {
    for (const side of [tree.l, tree.r]) if (side?.k === 'name' && !side.hsvg) out.add(side.v);
  }
  for (const v of Object.values(tree)) {
    if (Array.isArray(v)) for (const x of v) comparedNames(x, out);
    else if (v && typeof v === 'object') comparedNames(v, out);
  }
  return out;
}
// The trees of one formula site: a formula, or the {{ }} spans of a template or text slot. Bad syntax gives none
// (the formula family reports it).
function treesOf(site) {
  if (typeof site.src !== 'string') return [];
  try {
    if (site.mode === 'formula') return [parse(site.src)];
    return parseTemplate(site.src).filter(s => typeof s !== 'string').map(s => s.f);
  } catch { return []; }
}
// The stops to suggest: one per whole number of the bounds when there are few, else 3.
const stopsFor = (d) => (Number.isInteger(d.minimum) && Number.isInteger(d.maximum) && d.maximum - d.minimum >= 1 && d.maximum - d.minimum <= 20 ? d.maximum - d.minimum + 1 : 3);

export function check(ctx) {
  const { experience: exp, report } = ctx;
  const owners = [...Object.values(exp.scenes), ...Object.values(exp.blocks)];
  if (exp.shell) owners.push(exp.shell);
  const expOwner = { file: exp.file, doc: exp.doc };
  const sitesOf = new Map();
  const sites = (o) => {
    if (!sitesOf.has(o)) { try { sitesOf.set(o, blockSites(o.doc, { experience: o === expOwner, decls: declsFor(o.doc, exp) })); } catch { sitesOf.set(o, []); } }
    return sitesOf.get(o);
  };
  for (const o of owners) { travels(o, report); turns(o, report); still(o, report); flags(o, exp, report); named(o, report); }
  for (const o of owners) {
    const shared = o.doc?.kind === 'scene' || o.doc?.kind === 'shell';
    for (const [id, c] of Object.entries(o.doc?.controls || {})) {
      if (!c || (c.kind !== 'slider' && c.kind !== 'dial') || c.positions !== undefined || typeof c.value !== 'string') continue; // a formula has stops too
      const own = o.doc.values?.[c.value];
      const d = own ?? (shared ? exp.doc.values?.[c.value] : undefined);
      if (!d || d.type !== 'number' || d.step !== undefined || typeof d.minimum !== 'number' || typeof d.maximum !== 'number') continue;
      // Where the value can be read: its own block; an experience value from any scene, the shell and the experience.
      const readers = own ? [o] : [expOwner, ...Object.values(exp.scenes), ...(exp.shell ? [exp.shell] : [])];
      for (const r of readers) {
        if (r !== o && r !== expOwner && r.doc?.values?.[c.value]) continue; // a scene's own value of that name hides it
        for (const site of sites(r)) {
          if (![...treesOf(site)].some(t => comparedNames(t).has(c.value))) continue;
          report('W-SLIDER-EQUALS', r.file, site.path, `${c.value} is written by slider ${id}, which has no positions, so it can be any number from ${d.minimum} to ${d.maximum}; this === or !== rarely holds. Add "positions": ${stopsFor(d)} to the slider (one stop per value), or compare with < and > (5.11)`);
        }
      }
    }
  }
}

// The names a formula reads (bad syntax: none).
function namesOf(src, out = new Set()) {
  if (typeof src !== 'string') return out;
  let tree; try { tree = parse(src); } catch { return out; }
  const walk = (t) => {
    if (!t || typeof t !== 'object') return;
    if (t.k === 'name' && !t.hsvg) out.add(t.v);
    for (const v of Object.values(t)) { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v); }
  };
  walk(tree);
  return out;
}
// Whether a name, or a computed value of the block that reads it (at any depth), is the name sought.
function readsVia(doc, name) {
  const seen = new Set();
  const via = (n) => {
    if (n === name) return true;
    if (seen.has(n) || typeof doc.computed?.[n] !== 'string') return false;
    seen.add(n);
    return [...namesOf(doc.computed[n])].some(via);
  };
  return via;
}
// A slider whose label reads its own value: the value is spoken twice (5.11).
function named(o, report) {
  for (const [id, c] of Object.entries(o.doc?.controls || {})) {
    if (!c || (c.kind !== 'slider' && c.kind !== 'dial') || typeof c.value !== 'string' || typeof c.label !== 'string') continue;
    let spans = [];
    try { spans = parseTemplate(c.label).filter(x => typeof x !== 'string'); } catch { continue; } // the formula family reports it
    const via = readsVia(o.doc, c.value);
    const names = new Set();
    const walk = (t) => { if (!t || typeof t !== 'object') return; if (t.k === 'name' && !t.hsvg) names.add(t.v); for (const v of Object.values(t)) { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v); } };
    for (const x of spans) walk(x.f);
    if (![...names].some(via)) continue;
    report('W-LABEL-HAS-VALUE', o.file, `/controls/${id}/label`, `${c.kind} ${id}: its label reads its own value ${c.value}, which is already spoken as the slider's value, so it is heard twice; name the slider only (such as "Current") and say the value in valueText (5.11)`);
  }
}
// Whether a binding reads a name: its formulas (value, keyframe values), directly or through computed values.
function reads(doc, b, name) {
  const via = readsVia(doc, name);
  const srcs = [];
  const walk = (v, k) => { if (k === 'target' || k === 'id' || k === 'channel' || k === 'axis' || k === 'as') return; if (typeof v === 'string') srcs.push(v); else if (Array.isArray(v)) v.forEach(x => walk(x)); else if (v && typeof v === 'object') for (const [kk, x] of Object.entries(v)) walk(x, kk); };
  walk(b);
  return srcs.some(s => [...namesOf(s)].some(via));
}
// A dial's target, range and writers (5.11).
function turns(o, report) {
  for (const [id, c] of Object.entries(o.doc?.controls || {})) {
    if (!c || c.kind !== 'dial' || typeof c.target !== 'string') continue;
    const at = `/controls/${id}/range`;
    const ok = Array.isArray(c.range) && c.range.length === 2 && c.range.every(Number.isFinite);
    const span = ok ? Math.abs(c.range[1] - c.range[0]) : 0;
    if (!ok || !(span > 0) || span > 360) { report('E-RANGE', o.file, at, `dial ${id}: a dial's range is [from, to], the turn in degrees from where the part is drawn, clockwise positive; from and to differ by more than 0 and at most 360, such as [-135, 135] (5.11)`); }
    for (const f of motionFrames(o)) {
      const m = f.motion.get(c.target);
      if (!m) continue;
      const where = f.layout && f.layout !== 'default' ? ` in layout ${f.layout}` : '';
      if (f.attrs.get(c.target)?.['data-hsvg-pivot'] === undefined) report('E-PIVOT', o.file, `/controls/${id}/target`, `dial ${id}: a dial turns ${c.target} about its pivot; give it data-hsvg-pivot="x y"${where} (5.11, 6.2.1)`);
      if (!ok || !(span > 0) || span > 360) continue;
      const r = m.rotate;
      const lo = Math.min(...c.range); const hi = Math.max(...c.range);
      if (r === 'free') continue;
      if (!r) report('E-RANGE', o.file, at, `dial ${id}: its target ${c.target} has no rotate motion range${where}; draw one (data-hsvg-motion="rotate ${lo}..${hi}", or rotate *) (5.11)`);
      else if (lo < r.lo - 1e-9 || hi > r.hi + 1e-9) report('E-RANGE', o.file, at, `dial ${id}: range [${c.range.join(', ')}] is not inside ${c.target}'s rotate motion range ${r.lo}..${r.hi}${where}: the range is the turn from where it is drawn (5.11)`);
    }
    for (const [cid, clip] of Object.entries(o.doc.clips || {})) {
      (Array.isArray(clip?.tracks) ? clip.tracks : []).forEach((t, i) => {
        if (t?.target === c.target && channelOf(t) === 'rotate') report('E-WRITER', o.file, `/clips/${cid}/tracks/${i}`, `clip ${cid}: track ${t.id ?? i} writes the rotate of ${c.target}, which dial ${id} turns: its binding from the value is the one writer (5.11)`);
      });
    }
  }
}
// `held` (button, toggle, slider, dial) and a toggle's `value` name a boolean value of the block (a scene's or shell's
// may be the experience's; a toggle's value may be a boolean knob, D45): E-TYPE otherwise (5.11).
function flags(o, exp, report) {
  const shared = o.doc?.kind === 'scene' || o.doc?.kind === 'shell';
  for (const [id, c] of Object.entries(o.doc?.controls || {})) {
    if (!c) continue;
    for (const key of c.kind === 'toggle' ? ['held', 'value'] : ['held']) {
      if (typeof c[key] !== 'string') continue;
      // A toggle's value may be a boolean knob of the experience, as a slider's or a choice's may (D45).
      const knob = key === 'value' && exp.doc.inputs?.[c[key]]?.kind === 'knob' ? exp.doc.inputs[c[key]] : undefined;
      const d = knob ?? o.doc.values?.[c[key]] ?? (shared ? exp.doc.values?.[c[key]] : undefined);
      if (d?.type !== 'boolean') report('E-TYPE', o.file, `/controls/${id}/${key}`, `${c.kind} ${id}: ${key} names ${c[key]}, which is not a boolean value of this block; declare "${c[key]}": {"type": "boolean", "initial": false} in values (5.11)`);
    }
  }
}
// A slider whose part does not show its value at rest: no binding of its channel reads the value (5.11).
function still(o, report) {
  const binds = Array.isArray(o.doc?.bindings) ? o.doc.bindings : [];
  for (const [id, c] of Object.entries(o.doc?.controls || {})) {
    if (!c || (c.kind !== 'slider' && c.kind !== 'dial') || typeof c.target !== 'string' || typeof c.value !== 'string' || !Array.isArray(c.range)) continue;
    const ch = c.kind === 'dial' ? 'rotate' : c.axis === 'y' ? 'translate-y' : 'translate-x';
    // The target, and the leaders it follows (6.2.1) in any layout.
    const parts = new Set([c.target]);
    for (const f of motionFrames(o)) {
      let t = c.target;
      for (let i = 0; i < 32; i++) { const lead = f.attrs.get(t)?.['data-hsvg-follow']; if (!lead) break; t = f.local(lead); parts.add(t); }
    }
    if (binds.some(b => b && parts.has(b.target) && channelOf(b) === ch && reads(o.doc, b, c.value))) continue;
    const what = c.kind === 'dial' ? 'turning part' : 'handle';
    report('W-CONTROL-STILL', o.file, `/controls/${id}`, `${c.kind} ${id}: the ${what} ${c.target} does not show its value at rest; bind it to ${c.value}: add the binding ${bindingFor(c, c.target)} (5.11)`);
  }
}

// The travel of each slider lies inside its handle's motion range, in every layout (5.11).
function travels(o, report) {
  for (const [id, c] of Object.entries(o.doc?.controls || {})) {
    if (!c || c.kind !== 'slider' || !Array.isArray(c.range) || c.range.length !== 2 || !c.range.every(Number.isFinite) || typeof c.target !== 'string') continue;
    const ch = c.axis === 'y' ? 'translate-y' : 'translate-x';
    const [a, b] = c.range;
    for (const f of motionFrames(o)) {
      const m = f.motion.get(c.target);
      if (!m) continue; // not drawn in this layout: the refs family says so
      const r = m[ch] && [m[ch].lo, m[ch].hi];
      const where = f.layout && f.layout !== 'default' ? ` in layout ${f.layout}` : '';
      if (!r || !r.every(Number.isFinite)) { report('E-RANGE', o.file, `/controls/${id}/range`, `slider ${id}: its handle ${c.target} has no ${markChannel(ch)} motion range${where}; draw one (data-hsvg-motion="${markChannel(ch)} ${Math.min(a, b)}..${Math.max(a, b)}"), since the travel is how far the handle moves from where it is drawn (5.11)`); continue; }
      if (Math.min(a, b) < r[0] - 1e-9 || Math.max(a, b) > r[1] + 1e-9) report('E-RANGE', o.file, `/controls/${id}/range`, `slider ${id}: range [${a}, ${b}] is not inside its handle's ${markChannel(ch)} motion range ${r[0]}..${r[1]}${where}. The range is the handle's travel from where it is drawn, such as [0, 256] for a handle that moves 256 units along ${c.axis === 'y' ? 'y' : 'x'} (5.11); the upgrade turns a range in drawing positions into a travel`);
    }
  }
}
