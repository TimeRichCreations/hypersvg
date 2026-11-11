// Stage 4: the drawing. Mounts frames as one tree (the strict XML reader's), places uses in their slots, gives every
// id its mounted form (2.12 rule 6), applies the theme's colour roles (7.7), and paints bindings (6.8), clips (6.7)
// and looks (6.2.4) from the engine's state. In a browser each node mirrors to a real SVG element (node.dom).
import { parseXml } from '../schema/xml.mjs';
import { parseMotion } from './physics.mjs';
import { entryKey } from './entry-key.mjs';
import { OWNED_BINDING_KEYS, TEXT_BINDING_KEYS } from './capabilities.mjs';
// A binding an add-on draws in a box of its own (door 2 draws, such as a media binding): its label names that box, not
// the part.
const drawsBox = (bd) => Object.keys(bd).some(k => Object.hasOwn(OWNED_BINDING_KEYS, k) && !Object.hasOwn(TEXT_BINDING_KEYS, k) && bd[k] && typeof bd[k] === 'object' && !Array.isArray(bd[k]));
// The settings of a binding an add-on paints as text (TEXT_BINDING_KEYS: rich text), or null.
const richOf = (bd) => { for (const k of Object.keys(TEXT_BINDING_KEYS)) if (bd[k] && typeof bd[k] === 'object' && !Array.isArray(bd[k])) return bd[k]; return null; };
import { isHex, mixColour, dashOf } from './paint-channels.mjs';
import { channelOf, valueOf, wordOf, isMirror } from './binding-words.mjs';
import { routePoint } from './route.mjs';
// The code of a binding's fault: its own, or E-EVENT-LOOP for a stack or memory error (9.2), so the page stops on it.
const faultCode = (err) => err?.code || (err instanceof RangeError || err?.name === 'InternalError' ? 'E-EVENT-LOOP' : 'E-FORMULA');
import { fitText, drawnState } from './fit.mjs';
import { isTierObject, wordingAt, wordingsDown, fieldShown, tierEntry, chooseTier, giveWayRules, badSteps } from './tiers.mjs';
import { watchArt, bboxOf } from './limits-runtime.mjs';
import { chooseLayout, shapeMapsOf, aspectsOf, directionOf, pickedLayout, picksFor, resizedBox, sizeValue, nearestSize } from './layout.mjs';
import { roleOf, boxOf, recordOf } from './marks.mjs';

const clone = (n) => (n.name ? { name: n.name, attrs: { ...n.attrs }, attrOrder: [...n.attrOrder], children: n.children.map(clone) } : { text: n.text });
const PAINT_ATTR = { fill: 'fill', stroke: 'stroke' };

// The shown text of a text binding with case (6.8): upper or lower, by the language's rules.
const caseOf = (text, kase, language) => (kase === 'upper' ? text.toLocaleUpperCase(language) : kase === 'lower' ? text.toLocaleLowerCase(language) : text);

// ---------- easing (6.7) ----------
// How long a slider's handle takes to settle on its value's place after a person lets go (5.11).
export const SETTLE_MS = 140;
const NAMED = { linear: null, ease: [0.25, 0.1, 0.25, 1], 'ease-in': [0.42, 0, 1, 1], 'ease-out': [0, 0, 0.58, 1], 'ease-in-out': [0.42, 0, 0.58, 1] };
export function ease(e, x, theme) {
  if (e === undefined || e === 'linear') return x;
  if (e === 'hold') return 0;
  if (e === 'theme') return ease(theme?.motion?.easing || 'linear', x);
  let c = Array.isArray(e) ? e : NAMED[e];
  if (typeof e === 'string' && e.startsWith('cubic-bezier(')) c = e.slice(13, -1).split(',').map(Number);
  if (!c) return x;
  const [x1, y1, x2, y2] = c;
  const bez = (t, a, b) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  let lo = 0; let hi = 1;
  for (let i = 0; i < 48; i++) { const mid = (lo + hi) / 2; if (bez(mid, x1, x2) < x) lo = mid; else hi = mid; }
  return bez((lo + hi) / 2, y1, y2);
}
// The value of a track at local time t (keys [timeMs, value, easing?]).
// mix(a, b, x): blends two values that are not numbers (the motion capability's colours); without it they hold.
export function sampleKeys(keys, t, valueOf, theme, mix = null) {
  if (t <= keys[0][0]) return valueOf(keys[0][1]);
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, e] = keys[i];
    const [t0, v0] = keys[i - 1];
    if (t <= t1) {
      const a = valueOf(v0); const b = valueOf(v1);
      const x = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
      if (mix && (typeof a !== 'number' || typeof b !== 'number')) return mix(a, b, ease(e, x, theme));
      if (typeof a !== 'number' || typeof b !== 'number') return e === 'hold' || t < t1 ? a : b; // looks hold
      return a + (b - a) * ease(e, x, theme);
    }
  }
  return valueOf(keys[keys.length - 1][1]);
}

// ---------- layout spaces (7.3, 7.4) ----------
// The design scale: CSS pixels per drawing unit, the smaller of the two ratios (7.3); 1 when the space is unknown.
function designScale(svgText, space) {
  if (!space) return 1;
  const m = /<svg\b[^>]*?\sviewBox\s*=\s*["']([^"']+)["']/.exec(String(svgText || ''));
  const v = m ? m[1].trim().split(/[\s,]+/).map(Number) : [];
  if (v.length !== 4 || !(v[2] > 0 && v[3] > 0)) return 1;
  return Math.min(space.width / v[2], space.height / v[3]);
}
// The design scale of a mounted root, from its viewBox as it is now (a plan-only layout grows it, 7.4).
function rootScale(root, space) {
  const v = String(root?.attrs?.viewBox ?? '').trim().split(/[\s,]+/).map(Number);
  if (!space || v.length !== 4 || !(v[2] > 0 && v[3] > 0)) return 1;
  return Math.min(space.width / v[2], space.height / v[3]);
}
// The uniform scale of one transform list: the square root of the determinant's size.
function scaleOf(t) {
  let k = 1;
  for (const [, op, args] of String(t || '').matchAll(/(matrix|scale|translate|rotate|skewX|skewY)\s*\(([^)]*)\)/g)) {
    const a = args.trim().split(/[\s,]+/).map(Number);
    if (op === 'scale') k *= Math.sqrt(Math.abs(a[0] * (a.length > 1 ? a[1] : a[0])));
    else if (op === 'matrix' && a.length === 6) k *= Math.sqrt(Math.abs(a[0] * a[3] - a[1] * a[2]));
  }
  return Number.isFinite(k) && k > 0 ? k : 1;
}
// The scale of a node's own transform and its ancestors' up to its frame's root <svg> (whose viewBox is the frame's
// design scale).
function transformScale(n) {
  let k = 1;
  for (let x = n; x && x.name !== 'svg'; x = x.parent) k *= scaleOf(x.attrs?.transform);
  return k;
}

// A component's viewBox is not a paint limit (6.4): a shadow may reach past it, and so does the focus outline of a
// control that fills it (5.11, C1 gap 4). A nested <svg> clips at its viewport by default, so a mounted one is drawn
// with overflow="visible".
function paintPastViewBox(put) { put('overflow', 'visible'); }

// The field a text binding shows whole (`{{ name }}`), or null.
// The layouts a block may choose from (7.1): an inner shape entry narrows an outer one, so a layout made for an exact
// size the innermost entry with sizes does not list is left out (a kit's ad size the experience drops). docs: outer
// first (the experience, then the block). All of them when none would be left.
export function narrowLayouts(layouts, ...docs) {
  const list = Array.isArray(layouts) ? layouts : [];
  const entries = docs.flatMap(d => (d?.axes || []).filter(a => a?.axis === 'shape' && (a.id ?? 'shape') === 'shape' && a.sizes && typeof a.sizes === 'object'));
  const inner = entries[entries.length - 1];
  if (!inner) return list;
  const keep = list.filter(l => l?.size == null || Object.hasOwn(inner.sizes, l.size));
  return keep.length ? keep : list;
}
function fieldOf(bd) { const m = /^\s*\{\{\s*([A-Za-z_][\w.]*)\s*\}\}\s*$/.exec(String(bd?.text ?? '')); return m ? m[1] : null; }
export class Drawing {
  constructor(engine, opts = {}) {
    this.engine = engine;
    this.opts = opts;
    this.frames = {}; // address -> { root, byLocal: Map(localId -> node), layout, scale }
    // opts.layouts: address -> the layout chosen last (kept across drawings, so a resize keeps the current one, 7.3).
    // opts.choices: address -> {id, why} of this drawing's choices, for tests and the player.
    // opts.picks: what the input selectors pick now (layout.mjs inputPicks, 7.1); opts.theme: the theme they pick.
    // opts.onSpace(address, target, box): called when a size binding gives a slot or region a box (6.8), at mount
    // and when it changes; lanes that solve again for a new space hook here.
    this.choices = {};
    this.theme = this.themeOf();
    this.faults = [];
    watchArt(this); // mounted elements and the filter surface (9.8): limits-runtime.mjs
    // Formulas, visible bindings and templates read a content field at the block's tier (7.9; runtime contentRead).
    engine.tierAt = (addr) => (engine.state.blocks[addr] ? this.tierOf(addr).tier : undefined);
  }
  themeOf() {
    const d = this.engine.exp.doc;
    const name = this.opts.theme ?? d.theme;
    const t = d.themes?.[name] || Object.values(d.themes || {})[0] || {};
    if (t.extends && d.themes?.[t.extends]) return { ...d.themes[t.extends], ...t, colorRoles: { ...d.themes[t.extends].colorRoles, ...t.colorRoles } };
    return t;
  }

  // Mounts a scene's frame (by layout id, or the single drawing) with its uses, and returns the root node.
  // space: the output size in CSS pixels {width, height}, or null; it gives the design scale (7.3) for the uses' slots.
  mountScene(sceneId, layoutId, space = null) {
    const sc = this.engine.exp.scenes[sceneId];
    const drawings = sc.drawings;
    const frame = this.planDrawing(sc, layoutId, space) || drawings[layoutId] || drawings.main || Object.values(drawings)[0];
    if (!frame) return null;
    const root = parseXml(frame.text);
    const plan = this.planFrame(sceneId, sc, layoutId, root, space);
    this.prefixIds(root, (id) => `${sceneId}__${id}`);
    const byLocal = new Map();
    this.index(root, byLocal, (id) => id.slice(sceneId.length + 2));
    this.frames[sceneId] = { root, byLocal, layout: layoutId, scale: plan ? rootScale(root, space) : designScale(frame.text, space), ...(plan ? { plan } : {}), space };
    this.applyTheme(root);
    this.applySizes(sceneId, byLocal);
    this.mountUses(sceneId, byLocal, layoutId);
    this.scene = sceneId;
    this.root = root;
    return root;
  }
  // The shell's master frame (10.1): mounted once, with its uses; scenes then mount into its first stage slot.
  mountShell(shellId, layoutId, space = null) {
    const sh = this.engine.exp.shell;
    const frame = this.planDrawing(sh, layoutId, space) || sh.drawings[layoutId] || sh.drawings.main || Object.values(sh.drawings)[0];
    if (!frame) return null;
    const root = parseXml(frame.text);
    const plan = this.planFrame(shellId, sh, layoutId, root, space);
    this.prefixIds(root, (id) => `${shellId}__${id}`);
    const byLocal = new Map();
    this.index(root, byLocal, (id) => id.slice(shellId.length + 2));
    this.frames[shellId] = { root, byLocal, layout: layoutId, scale: plan ? rootScale(root, space) : designScale(frame.text, space), ...(plan ? { plan } : {}), space };
    this.applyTheme(root);
    this.applySizes(shellId, byLocal);
    this.mountUses(shellId, byLocal, layoutId);
    this.shellId = shellId;
    this.root = root;
    this.slots = {};
    const walk = (n) => { if (!n.name) return; if (n.attrs['data-hsvg-slot'] && n.parent !== undefined) this.slots[n.attrs['data-hsvg-slot']] ??= n; n.children.forEach(walk); };
    walk(root);
    const stageName = Object.entries(sh.doc.slots || {}).find(([, s]) => s.kind === 'stage')?.[0];
    const slot = stageName && this.slots[stageName];
    if (!slot) { this.faults.push({ code: 'E-SHELL-SLOT', address: shellId, message: `no stage slot ${stageName} drawn in the shell's ${layoutId} frame` }); return root; }
    // The scene sits in a group right after the stage slot's drawn box.
    const holder = { name: 'g', attrs: { 'data-player-stage': stageName }, attrOrder: ['data-player-stage'], children: [], parent: slot.parent };
    holder.base = { ...holder.attrs };
    const siblings = slot.parent.children;
    siblings.splice(siblings.indexOf(slot) + 1, 0, holder);
    const num = (k) => Number(slot.attrs[k] ?? 0);
    this.stage = { name: stageName, node: slot, holder, box: { x: num('x'), y: num('y'), width: num('width'), height: num('height') } };
    return root;
  }
  // A scene in the stage slot, scaled uniformly to fit the slot's box and centred (10.1). The previous scene's frames go.
  // doc: the browser document, to swap the DOM in place (the shell's own DOM and focus stay).
  // space: the stage slot's box in CSS pixels (stageSpace), or null.
  // True size (7.3, D3; B7 batch 2): with opts.stageSizes (an experience made only in exact sizes, shown as the whole
  // page) the scene is drawn at the size nearest the stage's box, one drawing unit per CSS pixel, centred in the
  // stage; scaled down only when the stage is smaller, never up. The shell keeps its own size around it.
  mountStage(sceneId, layoutId, doc = null, space = null) {
    for (const a of Object.keys(this.frames)) if (a !== this.shellId && !a.startsWith(this.shellId + '/')) delete this.frames[a];
    const box = space && this.stage?.box;
    const t = box && this.opts.stageSizes ? nearestSize(this.opts.stageSizes, space) : null;
    const k = t ? space.width / box.width : 1; // CSS pixels per shell unit
    this.stageTrue = t;
    if (t) space = { width: t.width, height: t.height };
    const sc = this.engine.exp.scenes[sceneId];
    const frame = this.planDrawing(sc, layoutId, space) || sc.drawings[layoutId] || sc.drawings.main || Object.values(sc.drawings)[0];
    if (!frame || !this.stage) return null;
    const svg = parseXml(frame.text);
    const plan = this.planFrame(sceneId, sc, layoutId, svg, space);
    this.prefixIds(svg, (id) => `${sceneId}__${id}`);
    const byLocal = new Map();
    this.index(svg, byLocal, (id) => id.slice(sceneId.length + 2));
    this.frames[sceneId] = { root: svg, byLocal, layout: layoutId, scale: plan ? rootScale(svg, space) : designScale(frame.text, space), ...(plan ? { plan } : {}), space };
    this.ladderKey = null;
    if (this.fits) for (const k of Object.keys(this.fits)) if (k.startsWith(`${sceneId}#`) || k.startsWith(`${sceneId}/`)) delete this.fits[k];
    this.applyTheme(svg);
    this.applySizes(sceneId, byLocal);
    this.mountUses(sceneId, byLocal, layoutId);
    let { x, y, width, height } = this.stage.box;
    if (t) {
      const w = (t.width * t.scale) / k; const h = (t.height * t.scale) / k;
      x += (width - w) / 2; y += (height - h) / 2; width = w; height = h;
    }
    for (const n of ['xmlns', 'data-hsvg-version', 'width', 'height']) delete svg.attrs[n];
    Object.assign(svg.attrs, { x: fmt(x), y: fmt(y), width: fmt(width), height: fmt(height), preserveAspectRatio: 'xMidYMid meet', 'data-player-scene': sceneId });
    if (t) svg.attrs['data-player-true-size'] = `${t.width}x${t.height}`;
    svg.attrOrder = [...svg.attrOrder.filter(n => n in svg.attrs && !['x', 'y', 'width', 'height', 'preserveAspectRatio', 'data-player-scene', 'data-player-true-size'].includes(n)), 'x', 'y', 'width', 'height', 'preserveAspectRatio', 'data-player-scene', ...(t ? ['data-player-true-size'] : [])];
    svg.parent = this.stage.holder;
    this.stage.holder.children = [svg];
    if (doc && this.stage.holder.dom) this.stage.holder.dom.replaceChildren(this.toDom(doc, svg));
    this.scene = sceneId;
    return svg;
  }
  // The stage slot's shape, for choosing the scene's layout (7.3, 7.4).
  stageAspect() { const b = this.stage?.box; return b && b.height ? b.width / b.height : null; }
  // The stage slot's box in CSS pixels: its drawn box times the shell's design scale and the transforms above it.
  stageSpace() {
    const b = this.stage?.box;
    if (!b || !(b.width > 0 && b.height > 0) || !this.shellId) return null;
    const k = (this.frames[this.shellId]?.scale ?? 1) * transformScale(this.stage.node);
    return { width: b.width * k, height: b.height * k };
  }
  // A use's layout (7.4): the use's layout map for the parent's layout first; else by the slot's box in CSS pixels
  // (a <rect> slot: its box at the parent's design scale; an empty <g> slot has no box, so the first layout).
  // Returns {id, space, why}.
  useLayout(address, u, def, slot, addr) {
    const e = this.engine;
    const parentLayout = this.frames[address]?.layout;
    const forced = parentLayout != null && u.layout ? u.layout[parentLayout] ?? null : null;
    let space = null;
    if (slot.name === 'rect') {
      const k = (this.frames[address]?.scale ?? 1) * transformScale(slot);
      const w = Number(slot.attrs.width); const h = Number(slot.attrs.height);
      if (w > 0 && h > 0) space = { width: w * k, height: h * k, direction: directionOf(e.exp.doc, e.state.ambient?.language) };
    }
    const maps = shapeMapsOf(def.doc, e.exp.doc);
    const input = this.opts.picks ? pickedLayout(def.doc.layouts, picksFor(this.opts.picks, addr), maps) : null;
    const c = chooseLayout(def.doc.layouts, space, { forced, input, current: this.opts.layouts?.[addr] ?? null, aspectOf: aspectsOf(def), maps });
    return { ...c, space };
  }
  mountUses(address, byLocal, layoutId) {
    const e = this.engine;
    const b = e.state.blocks[address];
    if (!b) return;
    const doc = e.def(address);
    for (const u of doc.uses || []) {
      const def = e.defs[u.use];
      if (!def) continue;
      for (const { addr, slot } of this.usePlaces(address, u, byLocal, b)) {
        const pick = this.useLayout(address, u, def, slot, addr);
        const frame = this.planDrawing(def, pick.id, pick.space) || (pick.id != null && def.drawings[pick.id]) || def.drawings.main || Object.values(def.drawings)[0];
        if (!frame) continue;
        if (pick.id != null) { this.choices[addr] = { id: pick.id, why: pick.why }; if (this.opts.layouts) this.opts.layouts[addr] = pick.id; }
        const svg = parseXml(frame.text);
        const ns = (def.doc.id);
        const plan = this.planFrame(addr, def, pick.id, svg, pick.space, { ns, use: u });
        const mounted = addr.replace(/\[([^\]]*)\]/g, '-$1').split('/').join('__');
        this.prefixIds(svg, (id) => (id === ns ? mounted : id.startsWith(ns + '__') ? `${mounted}__${id.slice(ns.length + 2)}` : `${mounted}__${id}`));
        // a nested <svg> keeps the component's own coordinates (its root's viewBox)
        svg.attrs['data-player-use'] = mounted; svg.attrOrder.push('data-player-use');
        delete svg.attrs.xmlns; delete svg.attrs['data-hsvg-version'];
        svg.attrOrder = svg.attrOrder.filter(a => a in svg.attrs);
        this.placeUse(svg, slot, (this.opts.namespace || '') + mounted);
        const map = new Map();
        this.index(svg, map, (id) => (id === mounted ? def.doc.id : id.slice(mounted.length + 2)));
        // a <g> slot draws the component in its own units, scaled by the slot's transforms
        const scale = pick.space ? (plan ? rootScale(svg, pick.space) : designScale(frame.text, pick.space)) : (this.frames[address]?.scale ?? 1) * transformScale(slot);
        this.frames[addr] = { root: svg, byLocal: map, layout: pick.id ?? undefined, scale, ...(plan ? { plan } : {}), space: pick.space };
        this.applyTheme(svg);
        this.applySizes(addr, map);
        this.mountUses(addr, map, pick.id);
      }
    }
  }
  // Where a use's mounted drawings go (4.5, 5.10): [{addr, slot}]. A use goes in the slot its `into` names. A repeated
  // use whose `into` names a `repeat` region puts its rows, in list order, in the region's direct child slots, in
  // document order; rows beyond the slots are a fault (E-REPEAT-CAPACITY) and are not drawn.
  usePlaces(address, u, byLocal, b) {
    const addrs = u.items ? (b.uses.find(x => x.id === u.id)?.keys || []).map(k => `${address}/${u.id}[${k}]`) : [`${address}/${u.id}`];
    const cells = this.planCells?.[address]?.[u.id];
    if (cells && u.items) return addrs.map((addr, i) => (cells[i] ? { addr, slot: cells[i] } : null)).filter(Boolean);
    const nodes = [...byLocal.values()];
    const slot = nodes.find(n => n.attrs['data-hsvg-slot'] === u.into);
    if (slot) return addrs.map(addr => ({ addr, slot }));
    const region = byLocal.get(u.into);
    if (boxOf(region?.attrs) === 'repeat' && u.items) {
      const slots = region.children.filter(n => n.name && n.attrs['data-hsvg-slot'] !== undefined);
      if (addrs.length > slots.length) this.faults.push({ code: 'E-REPEAT-CAPACITY', address, message: `use ${u.id} has ${addrs.length} rows; repeat group ${u.into} has ${slots.length} slots` });
      return addrs.slice(0, slots.length).map((addr, i) => ({ addr, slot: slots[i] }));
    }
    this.faults.push({ code: 'E-PLACE', address, message: `no slot ${u.into} for use ${u.id}` });
    return [];
  }
  // A mounted drawing in its slot (5.10). In a <g> slot it takes the <g>'s coordinates (one unit is one unit), with
  // its placement point at the <g>'s origin: the component root's pivot, default the viewBox centre (6.2.1). In a
  // <rect> slot it is scaled uniformly to fit the box and centred; it is drawn right after the <rect>, which holds no
  // children.
  placeUse(svg, slot, mounted) {
    const vb = String(svg.attrs.viewBox || '').trim().split(/[\s,]+/).map(Number);
    const hasBox = vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0;
    const put = (k, v) => { if (!(k in svg.attrs)) svg.attrOrder.push(k); svg.attrs[k] = String(v); };
    paintPastViewBox(put);
    if (slot.name === 'rect') {
      for (const k of ['x', 'y', 'width', 'height']) put(k, slot.attrs[k] ?? 0);
      put('preserveAspectRatio', 'xMidYMid meet');
      svg.parent = slot.parent;
      const siblings = slot.parent?.children;
      if (siblings) siblings.splice(siblings.indexOf(slot) + 1 + siblings.filter(n => n.slotOf === slot).length, 0, svg);
      svg.slotOf = slot;
      return;
    }
    if (hasBox) {
      const root = svg.children.find(n => n.name && n.attrs.id === mounted && n.attrs['data-hsvg-kind'] === 'component');
      const pv = String(root?.attrs['data-hsvg-pivot'] ?? '').trim().split(/[\s,]+/).map(Number);
      const [px, py] = pv.length === 2 && pv.every(Number.isFinite) ? pv : [vb[0] + vb[2] / 2, vb[1] + vb[3] / 2];
      put('x', fmt(vb[0] - px)); put('y', fmt(vb[1] - py)); put('width', fmt(vb[2])); put('height', fmt(vb[3]));
    }
    slot.children.push(svg);
    svg.mountedIn = slot; // where it hangs now; player.attach moves it (applyAttach)
  }
  // ---------- layout plans (7.4, 7.5) ----------
  // The solver, when this block solves while playing: the fit capability (engine.planSolver) installed and fit named
  // in the block's or the experience's needs; or the packer's own solver (opts.planSolver), which bakes.
  solverFor(block) {
    if (this.opts.planSolver) return this.opts.planSolver;
    const named = (d) => Array.isArray(d?.needs) && d.needs.includes('fit');
    return this.engine.planSolver && (named(block?.doc) || named(this.engine.exp.doc)) ? this.engine.planSolver : null;
  }
  // A plan-only layout (7.4) that this player does not solve shows the baked frames (A7.1): the derived frame of the
  // same plan nearest by aspect (7.3), scaled uniformly; ties go to list order. Returns {text} or null.
  planDrawing(block, layoutId, space) {
    const layouts = block?.doc?.layouts || [];
    const layout = layouts.find(l => l.id === layoutId);
    if (!layout?.layoutPlan || layout.drawing || this.solverFor(block)) return null;
    const plan = JSON.stringify(layout.layoutPlan);
    const target = space && space.width > 0 && space.height > 0 ? Math.log(space.width / space.height) : 0;
    let best = null; let bestD = Infinity;
    for (const l of layouts) {
      const d = block.drawings?.[l.id];
      if (!l.drawing || !d || JSON.stringify(l.layoutPlan) !== plan || !/<metadata>[^<]*"derived"\s*:/.test(d.text)) continue;
      const a = viewBoxAspectOf(d.text);
      if (!(a > 0)) continue;
      const dist = Math.abs(Math.log(a) - target);
      if (dist < bestD - 1e-12) { best = d; bestD = dist; }
    }
    return best;
  }
  // Solves the layout's plan in a parsed frame, before its ids are prefixed and its uses mount: a plan-only layout's
  // viewBox grows to the space (7.4), then each item moves (a translate and a scale on its mount, 7.5) and each use's
  // slot takes its box, so the uses mount where the plan puts them. A derived frame is already solved. Returns the
  // plan's record ({layout, status, boxes, shares, unmet, ...}; also this.plans[address]) or null.
  // ns: a component's namespace (its drawing ids are <ns>__<local>); use: the use that placed it (its locks, 4.3).
  planFrame(addr, block, layoutId, root, space, { ns = null, use = null } = {}) {
    const layout = (block?.doc?.layouts || []).find(l => l.id === layoutId);
    const plan = layout?.layoutPlan;
    const P = plan ? this.solverFor(block) : null;
    if (!P || recordOf(root).derived !== undefined) return null;
    // A baked frame is for a size in whole CSS pixels (7.2), so baking solves at that size.
    if (this.opts.bake && space) space = { ...space, width: Math.round(space.width), height: Math.round(space.height) };
    if (this.planCells?.[addr]) delete this.planCells[addr];
    const local = (id) => (ns && id.startsWith(`${ns}__`) ? id.slice(ns.length + 2) : id);
    const byLocal = new Map();
    const walk = (n, parent) => { if (!n.name) return; n.parent = parent; if (n.attrs.id) byLocal.set(local(n.attrs.id), n); n.children.forEach(c => walk(c, n)); };
    walk(root, null);
    const record = { layout: layoutId, place: plan.place, status: 'incomplete', boxes: [], shares: [], unmet: [] };
    (this.plans ??= {})[addr] = record;
    const place = byLocal.get(plan.place);
    if (!place || place.name !== 'rect') { record.unmet.push({ subject: `place:${plan.place}`, reason: `no rectangle ${plan.place} is drawn in this frame` }); return record; }
    let rootBox = P.measure(place);
    const vb = P.viewBoxOf(root);
    if (!layout.drawing && space && vb) {
      const grown = P.grownViewBox(vb, space);
      putAttr(root, 'viewBox', [grown.x, grown.y, grown.width, grown.height].map(fmt).join(' '));
      const pb = P.grownPlace(rootBox, vb, grown);
      if (JSON.stringify(pb) !== JSON.stringify(rootBox)) {
        const lb = P.mapBox(P.invert(P.parentWorld(place)) || P.IDENTITY, pb);
        for (const k of ['x', 'y', 'width', 'height']) putAttr(place, k, fmt(lb[k]));
        rootBox = pb;
      }
      record.viewBox = grown;
    }
    const doc = block.doc;
    const design = rootScale(root, space);
    const measured = new Map();
    const item = (address, cell) => {
      if (measured.has(address)) return measured.get(address);
      const r = P.resolveItem(address, { byLocal, doc });
      let out = null;
      // A text with a fit takes its place by its fit box: the plan places the box, and the text keeps its place in it.
      if (r?.kind === 'part') { const fb = P.isText(r.node) ? this.planFitBoxes(doc, byLocal, local, r.node, measured, false)[0] : null; out = { kind: 'part', node: r.node, box: (fb && P.measure(fb)) || P.measure(r.node), text: P.isText(r.node) }; }
      else if (r) {
        const u = r.kind === 'use' ? r.use : (doc.uses || []).find(x => x.into === r.node.attrs['data-hsvg-slot']);
        const def = u && this.engine.defs[u.use];
        const slot = r.kind === 'slot' ? r.node : (u && !u.items ? [...byLocal.values()].find(n => n.attrs['data-hsvg-slot'] === u.into) : null);
        const own = def && this.planUseBox(def, cell, design);
        if (own) out = { kind: 'slot', slot, use: u, key: r.key ?? null, box: own, picture: true };
      }
      measured.set(address, out);
      return out;
    };
    const state = this.engine.state.blocks[addr];
    const repeat = (name) => (state?.uses?.find(x => x.id === name)?.keys || []).map(k => `use:${name}[${k}]`);
    const shares = {};
    for (const id of Array.isArray(use?.locks) ? use.locks : []) shares[id] = { locked: true };
    for (const [id, value] of Object.entries(this.opts.shares?.[addr] || {})) shares[id] = { ...shares[id], value };
    const r = P.solve(plan, { root: rootBox, item, repeat, shares, spacing: this.theme.spacing, direction: directionOf(this.engine.exp.doc, this.engine.state.ambient?.language), budget: this.opts.planBudget });
    Object.assign(record, { status: r.status, boxes: r.boxes, shares: r.shares, unmet: r.unmet, scale: r.scale, steps: r.steps, measurer: r.measurer });
    let clips = 0;
    const clipId = () => { clips++; return ns ? `${ns}__plan-clip-${clips}` : `plan-clip-${clips}`; };
    for (const b of r.boxes) {
      const m = measured.get(b.item);
      if (m?.kind === 'part') this.placePlanPart(P, m.node, m.box, b, clipId, this.planFitBoxes(doc, byLocal, local, m.node, measured));
      else if (m?.kind === 'slot') {
        const slot = m.use?.items ? this.planCell(addr, place, m.use.id) : m.slot;
        if (slot) this.placePlanSlot(P, slot, b, clipId);
        else record.unmet.push({ subject: b.item, reason: 'a use item needs a <rect> slot' });
      }
    }
    if (record.unmet.length) record.status = 'incomplete';
    record.key = JSON.stringify([record.viewBox ?? null, r.boxes.map(b => [b.item, b.box, b.clip])]);
    if (this.opts.bake) this.opts.bake.push({ address: addr, block, layoutId, space, record, text: this.derivedText(root, space) });
    return record;
  }
  // A use's own box for the plan: the viewBox of the layout it would take in a cell (a plan-only layout takes the
  // cell's own aspect). design: CSS pixels per drawing unit of the parent's frame.
  planUseBox(def, cell, design) {
    const space = { width: cell.width * design, height: cell.height * design };
    const c = chooseLayout(def.doc.layouts, space.width > 0 && space.height > 0 ? space : null, { aspectOf: aspectsOf(def), maps: shapeMapsOf(def.doc, this.engine.exp.doc) });
    const l = (def.doc.layouts || []).find(x => x.id === c.id);
    if (l && l.layoutPlan && !l.drawing) return { x: 0, y: 0, width: cell.width || 1, height: cell.height || 1 };
    const text = (c.id != null && def.drawings[c.id]?.text) || def.drawings.main?.text || Object.values(def.drawings)[0]?.text;
    const v = /<svg\b[^>]*?\sviewBox\s*=\s*["']([^"']+)["']/.exec(String(text || ''));
    const n = v ? v[1].trim().split(/[\s,]+/).map(Number) : [];
    return n.length === 4 && n[2] > 0 && n[3] > 0 ? { x: n[0], y: n[1], width: n[2], height: n[3] } : null;
  }
  // A part moves by a translate and a scale on its own transform (7.5); its path data is never rewritten. In
  // drawing coordinates the measured box goes to the solved box; the transform list is worked out in the part's own.
  // A text's fit box (the region of a fit on a binding that shows it) moves with it by the same move, so the fit
  // lays the lines out where the plan puts the text, live and baked (B7, batch 2).
  placePlanPart(P, node, mbox, b, clipId, fitBoxes = []) {
    const [sx, sy] = b.scale;
    const M = [sx, 0, 0, sy, b.box.x - sx * mbox.x, b.box.y - sy * mbox.y];
    for (const n of [node, ...fitBoxes]) {
      const pw = P.parentWorld(n);
      const own = P.parseTransform(n.attrs.transform);
      const t = P.mul(P.mul(P.mul(P.invert(pw) || P.IDENTITY, M), pw), own);
      putAttr(n, 'transform', `matrix(${t.map(fmt).join(' ')})`);
    }
    if (b.clip) this.planClip(P, node, b.clip, clipId);
  }
  // The fit regions of the bindings that show a part: each a drawn node that is not the part itself and is not an
  // item of the plan (an item takes its own box). A region shared by two moved parts moves once, with the first.
  planFitBoxes(doc, byLocal, local, node, measured, mark = true) {
    const id = node.attrs.id ? local(node.attrs.id) : null;
    if (!id) return [];
    const items = new Set([...measured.values()].filter(Boolean).map(m => m.node || m.slot));
    const done = (measured.fitMoved ??= new Set());
    const out = [];
    for (const bd of doc?.bindings || []) {
      if (bd?.target !== id || typeof bd.fit?.box !== 'string') continue;
      const r = byLocal.get(bd.fit.box);
      if (!r || r === node || items.has(r) || done.has(r) || out.includes(r)) continue;
      if (mark) done.add(r);
      out.push(r);
    }
    return out;
  }
  // A use's <rect> slot takes the solved box (the use then mounts in it, 5.10), in its parent's coordinates.
  placePlanSlot(P, slot, b, clipId) {
    const lb = P.mapBox(P.invert(P.parentWorld(slot)) || P.IDENTITY, b.box);
    for (const k of ['x', 'y', 'width', 'height']) putAttr(slot, k, fmt(lb[k]));
    if (b.clip) this.planClip(P, slot, b.clip, clipId);
  }
  // A cropped or covering item shows only its visible part: it goes in a group clipped to that box.
  planClip(P, node, clip, clipId) {
    const parent = node.parent;
    if (!parent) return;
    const lb = P.mapBox(P.invert(P.worldOf(parent)) || P.IDENTITY, clip);
    const id = clipId();
    const rect = { name: 'rect', attrs: { x: fmt(lb.x), y: fmt(lb.y), width: fmt(lb.width), height: fmt(lb.height) }, attrOrder: ['x', 'y', 'width', 'height'], children: [] };
    const cp = { name: 'clipPath', attrs: { id }, attrOrder: ['id'], children: [rect] };
    const defs = { name: 'defs', attrs: {}, attrOrder: [], children: [cp] };
    const g = { name: 'g', attrs: { 'clip-path': `url(#${id})` }, attrOrder: ['clip-path'], children: [defs, node] };
    parent.children.splice(parent.children.indexOf(node), 1, g);
    g.parent = parent; defs.parent = g; cp.parent = defs; rect.parent = cp; node.parent = g;
  }
  // One cell of a repeated use under a plan: an unpainted <rect> right after the root place (and the cells before it).
  planCell(addr, place, useId) {
    const list = (((this.planCells ??= {})[addr] ??= {})[useId] ??= []);
    const cell = { name: 'rect', attrs: { fill: 'none' }, attrOrder: ['fill'], children: [], parent: place.parent };
    const all = Object.values(this.planCells[addr]).flat();
    const sib = place.parent.children;
    sib.splice(sib.indexOf(place) + 1 + all.length, 0, cell);
    list.push(cell);
    return cell;
  }
  // A solved frame as a derived frame file (6.6): an exact-size frame (its viewBox and width and height the size in
  // CSS pixels) whose drawing keeps its own coordinates under one transform; its tool record (<metadata>) says derived.
  // A component's root group carries no transform (E-KIND), so the transform wraps the children inside it.
  derivedText(root, space) {
    const out = clone(root);
    const v = String(out.attrs.viewBox ?? '').trim().split(/[\s,]+/).map(Number);
    if (!space || v.length !== 4) return this.serialize(out);
    const W = Math.round(space.width); const H = Math.round(space.height);
    const k = Math.min(W / v[2], H / v[3]);
    const m = [k, 0, 0, k, (W - v[2] * k) / 2 - v[0] * k, (H - v[3] * k) / 2 - v[1] * k];
    putAttr(out, 'viewBox', `0 0 ${W} ${H}`); putAttr(out, 'width', String(W)); putAttr(out, 'height', String(H));
    out.children = [{ name: 'metadata', attrs: {}, attrOrder: [], children: [{ text: JSON.stringify({ ...recordOf(out), derived: 'derived' }) }] }, ...out.children.filter(c => c.name !== 'metadata')];
    const kids = out.children.filter(c => c.name);
    const blockRoot = kids.length === kids.filter(c => ['title', 'desc', 'metadata'].includes(c.name)).length + 1 && kids.find(c => c.name === 'g' && c.attrs['data-hsvg-kind'] === 'component');
    const isIdentity = m.every((x, i) => Math.abs(x - [1, 0, 0, 1, 0, 0][i]) < 1e-9);
    if (isIdentity) return this.serialize(out);
    const host = blockRoot || out;
    const keep = host.children.filter(c => c.name && ['title', 'desc', 'metadata'].includes(c.name));
    const wrap = { name: 'g', attrs: { transform: `matrix(${m.map(fmt).join(' ')})` }, attrOrder: ['transform'], children: host.children.filter(c => !keep.includes(c)) };
    host.children = [...keep, wrap];
    return this.serialize(out);
  }
  prefixIds(root, f) {
    const map = {};
    const walk = (n) => { if (!n.name) return; if (n.attrs.id) { map[n.attrs.id] = (this.opts.namespace || '') + f(n.attrs.id); n.attrs.id = map[n.attrs.id]; } n.children.forEach(walk); };
    walk(root);
    const fix = (n) => {
      if (!n.name) return;
      for (const k of ['href', 'xlink:href', 'fill', 'stroke', 'clip-path', 'mask', 'filter', 'style', 'marker-start', 'marker-mid', 'marker-end']) {
        if (n.attrs[k]) n.attrs[k] = n.attrs[k].replace(/#([A-Za-z_][\w.-]*)/g, (m, id) => (map[id] ? `#${map[id]}` : m));
      }
      for (const k of ['aria-labelledby', 'aria-describedby']) if (n.attrs[k]) n.attrs[k] = n.attrs[k].split(/\s+/).map(id => map[id] || id).join(' ');
      if (n.attrs['data-hsvg-follow'] && map[n.attrs['data-hsvg-follow']]) n.attrs['data-hsvg-follow'] = map[n.attrs['data-hsvg-follow']];
      n.children.forEach(fix);
    };
    fix(root);
  }
  index(root, map, local) {
    const walk = (n, parent) => {
      if (!n.name) return;
      n.parent = parent;
      n.base = { ...n.attrs };
      if (n.attrs.id) map.set(local(n.attrs.id.slice((this.opts.namespace || '').length)), n);
      n.children.forEach(c => walk(c, n));
    };
    walk(root, null);
  }
  applyTheme(root) {
    const roles = this.theme.colorRoles || {};
    const walk = (n) => {
      if (!n.name) return;
      const r = n.attrs['data-hsvg-color'];
      if (r) for (const part of r.trim().split(/\s+/)) {
        const [paint, role] = part.includes(':') ? part.split(':') : ['fill', part];
        if (typeof role === 'string' && Object.hasOwn(roles, role) && roles[role]) this.set(n, PAINT_ATTR[paint], roles[role]);
      }
      n.children.forEach(walk);
    };
    walk(root);
  }

  // The colour of a theme role (6.4): only the theme's own role names (a role such as constructor or toString is
  // unknown, never Object's); an unknown role gives null, so the colour stays as it is (Q1c finding 10).
  roleColour(role) {
    const roles = this.theme.colorRoles;
    if (typeof role !== 'string' || !roles || !Object.hasOwn(roles, role)) return null;
    return typeof roles[role] === 'string' ? roles[role] : null;
  }

  // ---------- resizable slots (6.8 size, 5.10, D1) ----------
  // A size binding gives a <rect> slot or region a [width, height] in its drawing's units, about its anchor. At mount
  // the box is written before the uses are placed, so what sits in it chooses its frame and layout for the new space
  // (7.4). At paint a changed box moves the <rect>, what is placed in it, the stage's scene and the fits in it, and is
  // listed in this.resized; the player then chooses again (web/player-web.mjs).
  sizeBox(addr, byLocal, bd) {
    const n = byLocal.get(bd.target);
    if (!n) return null;
    if (n.name !== 'rect' || (n.attrs['data-hsvg-slot'] === undefined && boxOf(n.attrs) === null)) {
      const e = new Error(`a scale as a box sizes a <rect> slot or fit box; ${bd.target} is ${n.name === 'rect' ? 'a <rect> with no data-hsvg-slot or data-hsvg-fit mark' : `a <${n.name}>`}`); e.code = 'E-PLACE'; throw e;
    }
    const num = (k) => Number(n.base?.[k] ?? n.attrs[k] ?? 0);
    n.drawnBox ??= { x: num('x'), y: num('y'), width: num('width'), height: num('height') };
    return { n, box: resizedBox(n.drawnBox, sizeValue(this.val(addr, bd.scale)), bd.anchor) };
  }
  sizeBindings(addr) { return (this.engine.def(addr)?.bindings || []).filter(b => b && typeof b === 'object' && 'scale' in b && b.as === 'box'); }
  applySizes(addr, byLocal) {
    for (const bd of this.sizeBindings(addr)) {
      try {
        const r = this.sizeBox(addr, byLocal, bd);
        if (!r) continue;
        this.writeBox(r.n, r.box);
        this.opts.onSpace?.(addr, bd.target, r.box);
      } catch (err) { this.faults.push({ code: faultCode(err), address: addr, message: `binding ${this.bkey(addr, bd)}: ${err.message}` }); }
    }
  }
  writeBox(n, box) { for (const k of ['x', 'y', 'width', 'height']) this.set(n, k, fmt(box[k])); }
  paintSizes(addr, f) {
    for (const bd of this.sizeBindings(addr)) {
      try {
        const r = this.sizeBox(addr, f.byLocal, bd);
        if (!r) continue;
        const { n, box } = r;
        if (['x', 'y', 'width', 'height'].every(k => n.attrs[k] === fmt(box[k]))) continue;
        this.writeBox(n, box);
        // What is placed in it: a use's drawing in a <rect> slot, the stage's scene.
        for (const x of n.parent?.children || []) if (x.slotOf === n) this.writeBox(x, box);
        if (this.stage?.node === n) {
          this.stage.box = { ...box };
          const sc = this.stage.holder.children[0];
          if (sc) this.writeBox(sc, box);
        }
        // Text fitted in it fits again.
        for (const t of this.engine.def(addr)?.bindings || []) if (t?.fit?.box === bd.target) { const tn = f.byLocal.get(t.target); if (tn) tn.fitText = null; }
        this.resized.push({ address: addr, target: bd.target, box });
        this.opts.onSpace?.(addr, bd.target, box);
      } catch (err) { this.faults.push({ code: faultCode(err), address: addr, message: `binding ${this.bkey(addr, bd)}: ${err.message}` }); }
    }
  }

  // ---------- painting (9.2 step 9) ----------
  // While a paint batches (this.batch), the DOM is written at flush(), once per attribute, only if it changed.
  set(n, k, v) {
    const batch = this.batch;
    if (v === undefined || v === null) {
      if (!(k in n.attrs)) return;
      if (batch && n.dom) this.noteBatch(n, k);
      delete n.attrs[k]; n.attrOrder = n.attrOrder.filter(x => x !== k);
      if (!batch) n.dom?.removeAttribute(k);
      return;
    }
    const s = String(v);
    if (n.attrs[k] === s) return;
    if (batch && n.dom) this.noteBatch(n, k);
    if (!(k in n.attrs)) n.attrOrder.push(k);
    n.attrs[k] = s;
    if (!batch) n.dom?.setAttribute(k, s);
  }
  noteBatch(n, k) {
    let m = this.batch.get(n);
    if (!m) this.batch.set(n, (m = new Map()));
    if (!m.has(k)) m.set(k, n.attrs[k]);
  }
  flush() {
    const batch = this.batch;
    this.batch = null;
    if (!batch) return;
    for (const [n, m] of batch) for (const [k, was] of m) {
      const v = n.attrs[k];
      if (v === was) continue;
      if (v === undefined) n.dom.removeAttribute(k); else n.dom.setAttribute(k, v);
    }
  }
  // A text binding with a fit (7.6), in a browser: fitted again only when its text changes. this.fits holds each
  // fit's outcome by binding (drawn, fitted or incomplete); a region not drawn here is a fault.
  fitBinding(addr, f, n, bd, text) {
    if (n.fitText === text) return;
    const region = f.byLocal.get(bd.fit.box);
    if (!region?.dom) { if (n.fitText !== text) this.faults.push({ code: 'E-REF-UNKNOWN', address: addr, message: `fit ${this.bkey(addr, bd)}: no box ${bd.fit.box} in this frame` }); this.setText(n, text); n.fitText = text; return; }
    n.drawnFit ??= drawnState(n.dom);
    const out = fitText(n.dom, region.dom, text, bd.fit, n.drawnFit);
    if (!out) return; // not laid out yet
    n.fitText = text;
    n.children = [{ text }];
    (this.fits ??= {})[`${addr}#${this.bkey(addr, bd)}`] = out;
    (this.fitRaw ??= {})[`${addr}#${this.bkey(addr, bd)}`] = out; // as fitted, before any give-way step (8.4)
  }
  // A baked frame's text under give-way rules (8.4, A7.1): the packer ran the ladder and wrote each text's wording, size
  // and removal into the derived frame. A block that does not need fit shows that result while its content still
  // gives the baked wording; then the text's own fit runs from the baked size. Returns true when it drew the text.
  // The baked read-out (8.4, E4 Request 3): such a text joins this.bakedTexts, and the frame's recorded steps (the
  // steps the bake took, written by the packer) give the block's steps (bakedLadder).
  bakedText(addr, f, n, bd, wordings, optional) {
    if (recordOf(f.root).derived !== 'derived' || this.needsFit(addr)) return false;
    if (!this.giveWayAll().some(({ rule, at }) => ['fits', 'limit'].includes(rule.kind) && [].concat(rule.subject ?? []).some(x => typeof x === 'string' && this.namesText(x, at, addr, bd, n)))) return false;
    n.baked ??= { text: n.children.map(c => c.text ?? '').join(''), hidden: n.attrs.display === 'none', px: Number(n.attrs['font-size']) || undefined };
    const plain = (x) => String(x ?? '').replace(/\s+/g, ' ').trim();
    const key = `${addr}#${this.bkey(addr, bd)}`;
    const field = fieldOf(bd);
    const read = (text, outcome) => { ((this.bakedTexts ??= {})[addr] ??= {})[this.bkey(addr, bd)] = { field, binding: this.bkey(addr, bd), text, px: n.baked.px ?? null, lines: text ? 1 : 0, outcome }; };
    if (n.baked.hidden && optional) { this.setText(n, ''); (this.fits ??= {})[key] = 'fitted'; read('', 'removed'); return true; }
    if (!wordings.some(w => plain(w) === plain(n.baked.text))) return false;
    read(n.baked.text, plain(n.baked.text) === plain(wordings[0]) && !n.baked.px ? 'fitted' : 'given-way');
    if (n.dom) this.fitBinding(addr, f, n, { ...bd, fit: { ...bd.fit, ...(n.baked.px ? { fontPx: n.baked.px } : {}) } }, n.baked.text);
    else this.setText(n, n.baked.text);
    return true;
  }
  // ---------- content tiers (7.9) and the give-way ladder (8.4) ----------
  // The documents above a block, innermost first: the block, its parents up to the scene or shell, then the experience.
  docsUp(addr) {
    const e = this.engine; const out = [];
    for (let a = addr; a; a = a.includes('/') ? a.slice(0, a.lastIndexOf('/')) : null) { const d = e.def(a); if (d && !out.includes(d)) out.push(d); }
    if (!out.includes(e.exp.doc)) out.push(e.exp.doc);
    return out;
  }
  // The tier of a block (7.9): chosen by the innermost content entry, with the space of the block that declares it
  // (the experience's entry uses the scene's space); a block without an entry of its own takes its parent's tier.
  // this.tiers[addr] = {tier, why}; chosen again at each paint, so a tier by input follows its value.
  tierOf(addr) {
    if (this.tiers?.[addr]) return this.tiers[addr];
    const e = this.engine;
    const doc = e.def(addr);
    const parent = addr.includes('/') ? addr.slice(0, addr.lastIndexOf('/')) : null;
    const own = tierEntry([doc]);
    let r;
    if (!own && parent) r = this.tierOf(parent);
    else {
      const entry = own || tierEntry([e.exp.doc]);
      const space = this.frames[addr]?.space ?? null;
      r = chooseTier(entry, { space, maps: shapeMapsOf(doc, e.exp.doc), valueOf: (name) => this.inputValue(addr, name) });
    }
    (this.tiers ??= {})[addr] = r;
    return r;
  }
  inputValue(addr, name) {
    const st = this.engine.state.blocks;
    for (const b of [st[addr], st.experience]) for (const k of ['inputs', 'values']) if (b?.[k] && Object.hasOwn(b[k], name)) return b[k][name];
    return undefined;
  }
  // A text binding that shows one whole field with tiered wordings (7.9): {text, wordings, field, optional}, else null.
  // The wording is the chosen tier's; a field left out at the tier reads as empty.
  tierText(addr, bd) {
    const field = fieldOf(bd);
    if (!field) return null;
    const e = this.engine;
    const doc = e.def(addr);
    const decl = doc?.inputs?.[field] ?? (doc?.kind === 'scene' || doc?.kind === 'shell' ? e.exp.doc.inputs?.[field] : undefined);
    const raw = this.rawField(addr, field);
    if (!raw && !(decl?.tier && decl.required === false)) return null;
    const { tier } = this.tierOf(addr);
    const optional = decl?.required === false;
    if (decl && !fieldShown(decl, tier)) return { text: '', wordings: [''], field, optional };
    if (!raw) return null;
    const lang = (w) => (w !== null && typeof w === 'object' ? e.literalWith(w) : w);
    return { text: String(lang(wordingAt(raw, tier)) ?? ''), wordings: wordingsDown(raw, tier).map(w => String(lang(w) ?? '')), field, optional };
  }
  // The tier object behind a field, or null: the block's own value, a use's literal `with` (the runtime gives its
  // short wording, 7.9, so the literal counts while the value is still that wording), or the experience's input.
  rawField(addr, name) {
    const e = this.engine;
    const b = e.state.blocks[addr];
    const v = b?.inputs?.[name];
    if (isTierObject(v)) return v;
    const cut = addr.lastIndexOf('/');
    if (cut > 0) {
      const u = e.def(addr.slice(0, cut))?.uses?.find(x => x.id === addr.slice(cut + 1).replace(/\[[^\]]*\]$/, ''));
      const lit = u?.with?.[name];
      if (isTierObject(lit) && v === e.literalWith(lit)) return lit;
    }
    if (!(b?.inputs && Object.hasOwn(b.inputs, name))) { const x = e.state.blocks.experience?.inputs?.[name]; if (isTierObject(x)) return x; }
    return null;
  }
  // Does the block need fit (A7.1)? Its own needs, a parent's or the experience's.
  needsFit(addr) { return this.docsUp(addr).some(d => Array.isArray(d.needs) && d.needs.includes('fit')); }
  // Every give-way rule of the drawing, with the frame its document is drawn at, in written order (outer first).
  giveWayAll() {
    if (this.giveWayRulesNow) return this.giveWayRulesNow;
    const e = this.engine; const out = [];
    const top = this.scene;
    if (top) for (const rule of giveWayRules([e.exp.doc])) out.push({ rule, at: top });
    for (const addr of Object.keys(this.frames)) for (const rule of giveWayRules([e.def(addr)])) out.push({ rule, at: addr });
    return (this.giveWayRulesNow = out.filter(x => !badSteps(x.rule).length));
  }
  // Does a subject address, written in the document at `at`, name this text binding?
  namesText(subject, at, addr, bd, n) {
    const field = fieldOf(bd);
    const rel = addr === at ? '' : addr.startsWith(at + '/') ? addr.slice(at.length + 1) : null;
    if (rel === null) return false;
    const useId = rel.split('/')[0].replace(/\[[^\]]*\]$/, '');
    const [form, name] = [subject.slice(0, subject.indexOf(':')), subject.slice(subject.indexOf(':') + 1)];
    // In its own document a field is `field:<field>` or, as 8.2 writes it in a component's rules, `field:<block id>.<field>`.
    if (form === 'field') return rel === '' ? name === field || name === `${this.engine.def(at)?.id}.${field}` : !rel.includes('/') && name === `${useId}.${field}`;
    if (form === 'part') return rel === '' && name === bd.target;
    if (form === 'use') return rel !== '' && name === useId;
    if (form === 'role') { for (let x = n; x; x = x.parent) if (roleOf(x.attrs) === name) return true; }
    return false;
  }
  // The give-way ladder at play (8.4, D2) is the ladder capability's drawing part (capabilities/ladder.mjs, D18). Without
  // it no text takes give-way steps while playing; the engine refuses a package that needs fit and has a fits, limit or
  // keep give-way rule (E-NEEDS-MISSING).
  ladderRulesOf(addr, bd, n) { const lad = this.engine.caps?.drawing('ladder'); return lad ? lad.rulesOf(this, addr, bd, n) : null; }
  giveWay(pending) { this.engine.caps?.drawing('ladder')?.giveWay(this, pending); }
  // CSS pixels per drawing unit at a node: its frame's design scale times the transforms above it (7.3).
  unitPx(addr, n) { return (this.frames[addr]?.scale ?? 1) * transformScale(n); }

  // The ambient `layout` value (B7, batch 2): for each block on screen, its frame (the layout it shows, or null), its
  // tier and the give-way steps its rules used, in step order. Plain data, sorted by address, so equal drawings give
  // equal values.
  layoutValue() {
    const out = {};
    for (const addr of Object.keys(this.frames).sort()) {
      const f = this.frames[addr];
      const lr = this.ladder?.[addr];
      out[addr] = { frame: f.layout ?? null, tier: lr?.tier ?? this.tierOf(addr).tier, steps: (lr?.steps || []).map(u => u.step).filter(x => typeof x === 'string') };
    }
    return out;
  }
  // A baked page's read-out (8.4, A7.1; E4 Request 3): for each derived frame, the steps its tool record (<metadata>)
  // lists (the bake's, in order, collapsed into {rule, step, times}) and its baked texts, marked baked: true. Run after
  // giveWay at each paint. (A block that needs fit is never baked, so a live entry is never replaced.)
  bakedLadder() {
    for (const [addr, f] of Object.entries(this.frames)) {
      const rec = recordOf(f.root); const marks = rec.derived === 'derived' ? rec.steps : undefined;
      const texts = Object.values(this.bakedTexts?.[addr] || {});
      if (marks === undefined && !texts.length) continue;
      const steps = [];
      for (const m of String(marks ?? '').split(/\s+/).filter(Boolean)) {
        const at = m.indexOf(':'); const rule = m.slice(0, at); const step = m.slice(at + 1);
        const last = steps[steps.length - 1];
        if (last && last.rule === rule && last.step === step) last.times++; else steps.push({ rule, step, times: 1 });
      }
      (this.ladder ??= {})[addr] = { tier: this.tierOf(addr).tier, tierWhy: this.tierOf(addr).why, steps, texts, baked: true };
    }
  }
  // The runs bindings under give-way rules (runsGiveWay) join the read-out with their texts. Run after giveWay at
  // each paint; it replaces its own entries.
  ladderRuns() {
    for (const { addr, result } of Object.values(this.runsLadder || {})) {
      if (!this.frames[addr]) continue;
      const r = (this.ladder ??= {})[addr] ??= { tier: this.tierOf(addr).tier, tierWhy: this.tierOf(addr).why, steps: [], texts: [] };
      r.texts = [...r.texts.filter(t => t.binding !== result.binding), result];
    }
  }
  // The key of a binding or a track: its id, or its position in the block definition when it has none (D29).
  bkey(addr, entry) { return entryKey(this.engine.def(addr), entry); }
  // The DOM of a fit key `${addr}#${binding id}`.
  fitDom(key) {
    const at = key.lastIndexOf('#'); const addr = key.slice(0, at); const id = key.slice(at + 1);
    const bd = (this.engine.def(addr)?.bindings || []).find(b => this.bkey(addr, b) === id);
    return bd ? this.frames[addr]?.byLocal.get(bd.target)?.dom ?? null : null;
  }
  // An icon by id (6.2.2): the icon place (a nested <svg> part with role icon) shows the <symbol> of that id, from the
  // active theme's icon set, then the icon-set resources in declaration order; with no match its drawn icon stays.
  iconOf(id) {
    if (!this.iconSyms) {
      this.iconSyms = {};
      for (const [name, text] of Object.entries(this.engine.exp.iconSets || {})) {
        const syms = {}; let root; try { root = parseXml(text); } catch { continue; }
        (function walk(x) { if (!x.name) return; if (x.name === 'symbol' && roleOf(x.attrs) === 'icon' && x.attrs.id) syms[x.attrs.id] = x; x.children.forEach(walk); })(root);
        this.iconSyms[name] = syms;
      }
    }
    const sets = Object.keys(this.iconSyms); const t = this.theme?.icons;
    for (const name of t && this.iconSyms[t] ? [t, ...sets.filter(s => s !== t)] : sets) if (this.iconSyms[name][id]) return this.iconSyms[name][id];
    return null;
  }
  paintIcon(n, id) {
    if (n.iconShown === id) return;
    n.iconShown = id;
    n.iconDrawn ??= { kids: n.children, viewBox: n.attrs.viewBox };
    const sym = typeof id === 'string' ? this.iconOf(id) : null;
    // A copy of the symbol's drawing, without ids: an icon place holds no parts.
    const copy = (x) => (x.name ? { name: x.name, attrs: Object.fromEntries(Object.entries(x.attrs).filter(([k]) => k !== 'id')), attrOrder: x.attrOrder.filter(k => k !== 'id'), children: x.children.map(copy) } : { text: x.text });
    this.set(n, 'viewBox', sym ? sym.attrs.viewBox ?? n.iconDrawn.viewBox : n.iconDrawn.viewBox);
    this.setChildren(n, sym ? sym.children.map(copy) : n.iconDrawn.kids);
  }
  setChildren(n, kids) {
    if (!kids.length && !n.children.length) return;
    n.children = kids;
    if (n.dom) n.dom.replaceChildren(...kids.map(k => this.toDom(n.dom.ownerDocument, k)));
  }
  setText(n, text) {
    if (n.children.length === 1 && n.children[0].text === text) return;
    n.children = [{ text }];
    if (n.dom) n.dom.textContent = text;
  }
  // Rich text (6.8.1) is the rich-text capability's drawing part (capabilities/rich-text.mjs, D18): runs and
  // linked text parts. Without it a runs or flow binding is E-NEEDS-MISSING (the engine refuses it at mount).
  richText(addr) {
    const part = this.engine.caps?.drawing('rich-text');
    if (!part) { const err = new Error('runs and flow need the rich-text capability (needs: ["rich-text"])'); err.code = 'E-NEEDS-MISSING'; throw err; }
    return part;
  }
  // Names and live regions (6.5 item 2), on the page only (never in a saved or baked drawing): a part with a
  // data-hsvg-label, or a label binding, is a named image; a part with the role feedback is a polite live region.
  // A named part, or a drawing's root, that holds a control target is a named group instead, so its controls are not
  // hidden inside an image (5.11). An element the input layer made an option group (data-hsvg-group) is left to it.
  // Control targets get their names from the input layer (5.11).
  names(addr, f, doc) {
    if (!f.root?.dom) return;
    const controls = f.controlTargets ??= new Set(Object.values(doc.controls || {}).map(c => c?.target));
    const dom = (n, k, v) => { if (!n.dom) return; if (v === null) n.dom.removeAttribute(k); else if (n.dom.getAttribute(k) !== v) n.dom.setAttribute(k, v); };
    if (!f.named) {
      f.named = [];
      for (const [id, n] of f.byLocal) {
        if (controls.has(id)) continue;
        if (roleOf(n.attrs) === 'feedback') dom(n, 'aria-live', 'polite');
        if (n.attrs['data-hsvg-label'] !== undefined) f.named.push([n, null]);
      }
      for (const bd of doc.bindings || []) if (typeof bd.label === 'string' && !drawsBox(bd) && !controls.has(bd.target) && f.byLocal.get(bd.target)) f.named.push([f.byLocal.get(bd.target), bd]);
    }
    const targets = this.targetDoms();
    const holds = (el) => targets.some(t => t !== el && el.contains?.(t));
    // An open shell dialog (aria-modal, set by the input layer, 10.3) keeps its role too.
    const grouped = (el) => el?.getAttribute('data-hsvg-group') != null || el?.getAttribute('aria-modal') != null;
    const root = f.root.dom;
    if (!grouped(root) && !targets.includes(root) && (holds(root) || root.getAttribute('role') != null)) dom(f.root, 'role', holds(root) ? 'group' : null);
    for (const [n, bd] of f.named) {
      if (grouped(n.dom)) continue;
      let name = n.attrs['data-hsvg-label'];
      if (bd) { try { name = this.engine.template(addr, bd.label); } catch (err) { this.faults.push({ code: faultCode(err), address: addr, message: `binding ${this.bkey(addr, bd)}: ${err.message}` }); continue; } }
      dom(n, 'role', n.dom && holds(n.dom) ? 'group' : 'img'); dom(n, 'aria-label', String(name));
    }
  }
  // The elements of every control target drawn now (press, slider and drag targets, and every option's), in all
  // blocks: read once per paint.
  targetDoms() {
    if (this.targetsNow) return this.targetsNow;
    const list = [];
    for (const [a, g] of Object.entries(this.frames)) {
      for (const c of Object.values(this.engine.def(a)?.controls || {})) {
        for (const t of [c?.target, ...Object.values(c?.options || {}).map(o => o?.target)]) { const d = g.byLocal.get(t)?.dom; if (d) list.push(d); }
      }
    }
    return (this.targetsNow = list);
  }
  // dirty: the blocks to evaluate again (engine.takeDirty(): a Set of addresses, or 'all'); null or 'all' paints
  // everything. A block not in it, whose last paint read no time (no running clip, particles, physics, mouth, a
  // give-way rule or a read of `elapsed` or `now`), is not evaluated: what it put last time is put again, and its
  // texts and names stay as written. this.live is the set of blocks that read time, so the page paints again only
  // while it is not empty or a transaction changed something (9.2 step 9).
  paint(dirty = null) {
    const e = this.engine;
    const now = e.state.now;
    const channels = new Map(); // node -> {channel: value}
    let rec = null; // the puts of the block being painted, kept for the next paint
    const put = (n, ch, v) => { rec?.push([n, ch, v]); if (!channels.has(n)) channels.set(n, {}); channels.get(n)[ch] = v; };
    const particles = new Map(); // empty group node -> generated children
    const full = !dirty || dirty === 'all' || !this.memo;
    this.targetsNow = null;
    if (full) this.memo = {};
    const mouths = new Set((e.mouthLooks || []).map(ml => ml.address));
    const kept = (addr) => !full && !dirty.has(addr) && !this.live?.has(addr) && !mouths.has(addr) && this.memo[addr] !== undefined;
    const live = new Set();
    this.resized = [];
    for (const [addr, f] of Object.entries(this.frames)) if (!kept(addr)) this.paintSizes(addr, f);
    const pending = []; // texts under give-way rules, laid out by the ladder after the bindings (8.4)
    if (full) this.tiers = {}; else for (const addr of Object.keys(this.tiers || {})) if (!kept(addr)) delete this.tiers[addr];
    this.giveWayRulesNow = null;
    for (const [addr, f] of Object.entries(this.frames)) {
      const b = e.state.blocks[addr];
      if (!b) continue;
      if (kept(addr)) {
        const m = this.memo[addr];
        for (const [n, ch, v] of m.puts) put(n, ch, v);
        for (const [g, kids] of m.particles) particles.set(g, [...(particles.get(g) || []), ...kids]);
        continue;
      }
      const memo = { puts: [], particles: [] };
      this.memo[addr] = memo;
      rec = memo.puts;
      e.timeRead = false;
      const hadPending = pending.length;
      const doc = e.def(addr);
      // Clips first; bindings write the channels they own (one writer per channel, 9.3).
      // A clip stopped with keep (6.7) shows its pose at the moment it stopped; it goes first, so any other writer of
      // a channel wins.
      const runs = Object.entries(b.clips || {}).sort(([, x], [, y]) => (y.keptAt !== undefined) - (x.keptAt !== undefined));
      for (const [cid, run] of runs) {
        const clip = doc.clips?.[cid];
        if (!clip) continue;
        if (this.clipRunning(clip, run, now)) live.add(addr);
        const t = this.clipTime(clip, run, run.keptAt ?? now);
        for (const tr of clip.tracks) {
          const targets = [[tr.target, 0], ...((tr.stagger?.targets || []).map((x, i) => [x, (i + 1) * tr.stagger.eachMs]))];
          const ch = channelOf(tr); // the track's word, as the channel it paints (D33)
          const pw = ch ? null : e.caps?.paint(tr.channel); // an add-on's channel (D39)
          for (const [target, delay] of targets) {
            const n = f.byLocal.get(target);
            if (!n) continue;
            if (run.dropped?.includes(`${target}|${ch}`)) continue; // another writer moved it since
            try {
              const mix = MOTION.has(ch) ? this.motionMix(ch) : null;
              const v = sampleKeys(tr.keys, t - delay, (x) => (typeof x === 'string' ? this.val(addr, x) : x), this.theme, mix); // every key value is a formula (6.7), variant names too
              if (pw) this.addonPut(pw, addr, n, v, put); else if (MOTION.has(ch)) this.motionPut(f, n, ch, v, tr, put, addr); else put(n, ch, v);
            } catch (err) { this.faults.push({ code: faultCode(err), address: addr, message: `clip ${cid}, track ${this.bkey(addr, tr)}: ${err.message}` }); }
          }
        }
      }
      this.names(addr, f, doc);
      for (const bd of doc.bindings || []) {
        const n = f.byLocal.get(bd.target);
        if (!n) continue;
        try {
          // A binding a door-2 add-on paints as text (rich text: runs, or one text across linked parts, 6.8.1): its
          // settings join the binding (the outer keys, such as fit and case, stay the binding's own).
          const rich = richOf(bd);
          if (rich && rich.runs === undefined) this.richText(addr).paintRuns(this, addr, f, n, { ...bd, ...rich, runs: [{ text: rich.text ?? '' }] });
          else if (rich) this.richText(addr).paintRuns(this, addr, f, n, { ...bd, ...rich });
          else if ('text' in bd) {
            const tt = this.tierText(addr, bd);
            const written = tt ? tt.text : e.template(addr, bd.text);
            // case (6.8): only what is shown changes, by the active language's rules; the accessible name keeps the
            // text as written, and the fit measures the shown text.
            const t = caseOf(written, bd.case, e.state.ambient?.language || e.exp.doc.language || 'en');
            if (bd.case) this.set(n, 'aria-label', t === written ? undefined : written);
            const rules = bd.fit && n.dom ? this.ladderRulesOf(addr, bd, n) : null;
            if (rules) pending.push({ addr, f, n, bd, field: tt?.field ?? fieldOf(bd), wordings: tt ? tt.wordings : [t], optional: tt ? tt.optional : false, rules });
            else if (bd.fit && this.bakedText(addr, f, n, bd, tt ? tt.wordings : [t], tt?.optional ?? false)) { /* the baked result */ }
            else if (bd.fit && n.dom) this.fitBinding(addr, f, n, bd, t); else this.setText(n, t);
          }
          else if ('visible' in bd) put(n, 'visible', this.val(addr, bd.visible));
          else if ('variant' in bd) {
            const as = bd.as ?? 'drawn';
            if (as === 'drawn') put(n, 'look', this.val(addr, bd.variant));
            else if (as === 'icon') this.paintIcon(n, this.val(addr, bd.variant));
            // A picture place (6.8) shows a host picture (10.6, D40) while its value names one (host:<name>).
            const v = as === 'picture' && this.val(addr, bd.variant); const u = typeof v === 'string' && v.startsWith('host:') && e.hostPictures?.[v.slice(5)];
            if (u) { if (n.name !== 'image') { const err = new Error(`a picture place is an <image>; ${bd.target} is a <${n.name}>`); err.code = 'E-PLACE'; throw err; } put(n, 'picture', u); }
          }
          else if ('draw' in bd && bd.as === 'points') this.paintPoints(f, n, bd, this.still(addr, () => this.val(addr, bd.draw)));
          else if ('color' in bd && (bd.as ?? 'marked') === 'marked') { const c = this.roleColour(this.val(addr, bd.color)); if (c) this.paintRole(n, bd.role, c); }
          else if (e.caps?.paint(wordOf(bd))) this.addonPut(e.caps.paint(wordOf(bd)), addr, n, this.glided(addr, bd, this.still(addr, () => this.val(addr, valueOf(bd))), now, live), put);
          else if (channelOf(bd)) {
            const ch = channelOf(bd); const v = this.glided(addr, bd, isMirror(bd) ? this.val(addr, bd.scale) : this.still(addr, () => this.val(addr, valueOf(bd))), now, live);
            if (ch !== 'look' && !MOTION.has(ch) && (typeof v !== 'number' || !Number.isFinite(v))) { const err = new Error(`${ch} ${JSON.stringify(v)} is not a number`); err.code = 'E-TYPE'; throw err; }
            if (MOTION.has(ch)) this.motionPut(f, n, ch, v, bd, put, addr); else put(n, ch, v);
          }
        } catch (err) { this.faults.push({ code: faultCode(err), address: addr, message: `binding ${this.bkey(addr, bd)}: ${err.message}` }); }
      }
      // Loudness mouths (audioMouth, 6.11): the audio player sets engine.mouthLooks, a look or a channel value per part.
      for (const ml of e.mouthLooks || []) {
        if (ml.address !== addr) continue;
        const n = f.byLocal.get(ml.target);
        if (!n) continue;
        put(n, ml.channel || 'look', ml.channel ? ml.value : ml.look);
        // A line mouth within blendMs of a change (6.11): its `from` look at 1 - mix and its look at mix, by group opacity.
        if (!ml.channel && ml.from && ml.from !== ml.look && ml.mix < 1) put(n, 'lookBlend', { from: ml.from, mix: Math.max(0, ml.mix) });
      }
      // Particles (A1.1): <use> copies of the source part, made inside the empty target group. Where they are is the
      // effects add-on's drawing part (its liveCopies); a block has runs only when the add-on is installed.
      const fx = e.caps?.drawing('effects');
      for (const { effect, run } of fx ? e.particlesNow(addr) : []) {
        const g = f.byLocal.get(run.target); const src = f.byLocal.get(run.source);
        if (!g || !src) { this.faults.push({ code: 'E-REF-UNKNOWN', address: addr, message: `effect ${effect}: no part ${g ? run.source : run.target}` }); continue; }
        const pivot = src.attrs['data-hsvg-pivot'] || '0 0';
        const kids = fx.liveCopies(run, now, parseMotion(src.attrs['data-hsvg-motion'])).map(c => ({ name: 'use', attrs: { href: `#${src.attrs.id}`, transform: `translate(${fmt(c.x)} ${fmt(c.y)}) rotate(${fmt(c.rotate)} ${pivot})`, opacity: fmt(c.opacity) }, attrOrder: ['href', 'transform', 'opacity'], children: [] }));
        particles.set(g, [...(particles.get(g) || []), ...kids]);
        memo.particles.push([g, kids]);
        live.add(addr);
      }
      // A physics body owns the whole transform of its target; under reduced motion it shows its rest position.
      for (const body of Object.values(b.physics?.bodies || {})) {
        const n = f.byLocal.get(body.target);
        if (!n) continue;
        const reduced = e.state.ambient.reducedMotion;
        put(n, 'translate-x', reduced ? body.rest[0] : body.x);
        put(n, 'translate-y', reduced ? body.rest[1] : body.y);
        live.add(addr);
      }
      if (e.timeRead || pending.length > hadPending || mouths.has(addr)) live.add(addr);
      rec = null;
    }
    this.live = live;
    this.giveWay(pending);
    this.bakedLadder();
    this.ladderRuns();
    // Reset parts that nothing writes now to their drawn state, then write the channels.
    // The DOM is written once per attribute at the end, and only where the value differs from what it shows.
    const snapped = this.snapNodes();
    this.batch = new Map();
    for (const f of Object.values(this.frames)) for (const n of f.byLocal.values()) if (n.touched && !channels.has(n)) { this.restore(n, snapped.has(n)); n.touched = false; }
    // A node whose channels are the same values as at the last paint already shows them (not a follower or a snapped
    // item: those build their transform on the written one).
    for (const [n, ch] of channels) {
      if (!(n.touched && sameChannels(n.painted, ch) && !snapped.has(n) && !n.attrs['data-hsvg-follow'])) { this.restore(n); this.write(n, ch); }
      n.painted = ch; n.touched = true;
    }
    this.applyFaces(channels);
    this.flush();
    if (snapped.size) this.applySnaps(snapped, channels);
    else for (const f of Object.values(this.frames)) for (const n of f.byLocal.values()) if (n.snapAt) n.snapAt = null;
    // Generated particle children: replaced each paint; a group whose run ended is empty again.
    for (const n of this.particleGroups || []) if (!particles.has(n)) this.setChildren(n, []);
    for (const [n, kids] of particles) this.setChildren(n, kids);
    this.particleGroups = new Set(particles.keys());
    this.batch = new Map();
    this.applyHolds();
    this.applyAttach();
    this.applyFollows(channels);
    // Shell slots (10.1): a dialog shows while its openValue is true; a hideable slot hides while the stage's scene
    // lists it in hideSlots.
    if (this.shellId) {
      const sh = e.exp.shell.doc;
      const values = e.state.blocks[this.shellId]?.values || {};
      const hide = new Set(e.def(this.scene)?.hideSlots || []);
      for (const [name, s] of Object.entries(sh.slots || {})) {
        const n = this.slots?.[name];
        if (!n) continue;
        const shown = s.kind === 'dialog' ? values[s.openValue] === true : !(s.hideable && hide.has(name));
        this.set(n, 'display', shown ? n.base.display : 'none');
      }
    }
    this.flush();
  }
  // Reduced motion for bindings that read `elapsed` (10.13): under reduced motion a channel or points binding reads
  // `elapsed` as it was at the block's first paint with reduced motion on (its rest, for a block entered then), so it
  // holds still and does not keep the page painting. Text, visible, look and colour bindings read the live clock: a
  // count or a state shown is information, not motion (a count-up text reads reducedMotion itself, 6.8). Off again,
  // the binding follows the clock.
  still(addr, fn) {
    const e = this.engine;
    const b = e.state.blocks[addr];
    if (e.state.ambient?.reducedMotion !== true || !b) { if (this.heldAt) delete this.heldAt[addr]; return fn(); }
    this.heldAt ??= {};
    let h = this.heldAt[addr];
    if (!h || h.born !== b.born) h = this.heldAt[addr] = { born: b.born, elapsed: e.state.now - b.born };
    e.heldElapsed = h.elapsed;
    try { return fn(); } finally { e.heldElapsed = undefined; }
  }
  // Is a clip run still moving at engine time now (6.7)? A kept or finished run, or one reduced motion shows as one
  // pose, holds still.
  clipRunning(clip, run, now) {
    if (run.keptAt !== undefined || run.ended) return false;
    if (this.engine.state.ambient?.reducedMotion === true && clip.reducedMotion !== 'keep') return false;
    const loops = clip.loop === true ? Infinity : typeof clip.loop === 'number' ? clip.loop : 1;
    return (now - run.startedAt) * (run.speed || 1) < clip.durationMs * loops;
  }
  // A clip's local time at engine time now (6.7). Under reduced motion (the ambient reducedMotion) a clip shows one
  // pose: `finish` (default) its final pose, `rest` its first key; an endless loop shows its first key. `keep` plays
  // as usual. Markers and ended are timers of the runtime, so they still fire at their normal times.
  clipTime(clip, run, now) {
    const dur = clip.durationMs;
    const loops = clip.loop === true ? Infinity : typeof clip.loop === 'number' ? clip.loop : 1;
    const pingPong = clip.loopMode === 'ping-pong';
    if (this.engine.state.ambient?.reducedMotion === true && clip.reducedMotion !== 'keep') {
      if (clip.reducedMotion === 'rest' || !Number.isFinite(loops)) return 0;
      return pingPong && (loops - 1) % 2 === 1 ? 0 : dur;
    }
    let t = (now - run.startedAt) * (run.speed || 1);
    if (t >= dur * loops) t = dur; else if (loops > 1) { const i = Math.floor(t / dur); t -= i * dur; if (pingPong && i % 2 === 1) t = dur - t; }
    return t;
  }
  // Snapped drags (5.11): a drag control with `snap: true` whose item was accepted on a drop keeps it there, its box
  // centre on the drop's box centre, until it is picked up again or its block enters afresh. The rest is the
  // control's state in its block (block.snaps: control id -> drop id), so it rolls back with the block. The offset
  // is measured in the item's own coordinates once per drawing (a browser lays it out), so it holds through a
  // resize that keeps the drawing; a new drawing (a new layout) measures again. Returns the snapped nodes.
  snapNodes() {
    const out = new Map(); // node -> {drop node, drop id}
    for (const [addr, f] of Object.entries(this.frames)) {
      const snaps = this.engine.state.blocks[addr]?.snaps;
      if (!snaps) continue;
      const controls = this.engine.def(addr)?.controls || {};
      for (const [cid, drop] of Object.entries(snaps)) {
        const c = controls[cid];
        const n = c?.kind === 'drag' && c.snap === true ? f.byLocal.get(c.target) : null;
        const d = n && f.byLocal.get(drop);
        if (n && d) out.set(n, { dropNode: d, drop });
      }
    }
    return out;
  }
  applySnaps(snapped, channels) {
    for (const [n, { dropNode, drop }] of snapped) {
      const bare = channels.has(n) ? n.attrs.transform : n.base.transform;
      const key = this.snapKey(n, dropNode, bare);
      if (n.snapAt?.drop !== drop || n.snapAt.dropNode !== dropNode || n.snapAt.key !== key) {
        n.snapAt = null;
        if (!n.dom?.getScreenCTM || !dropNode.dom) { this.set(n, 'transform', bare); continue; }
        this.set(n, 'transform', bare);
        const a = n.dom.getBoundingClientRect(); const b = dropNode.dom.getBoundingClientRect(); const m = n.dom.getScreenCTM();
        if (!m || !(a.width > 0 || a.height > 0) || !(b.width > 0 || b.height > 0)) continue; // not laid out yet
        const inv = m.inverse();
        const local = (x, y) => [inv.a * x + inv.c * y + inv.e, inv.b * x + inv.d * y + inv.f];
        const [ax, ay] = local(a.x + a.width / 2, a.y + a.height / 2); const [bx, by] = local(b.x + b.width / 2, b.y + b.height / 2);
        n.snapAt = { drop, dropNode, key, dx: bx - ax, dy: by - ay };
      }
      this.set(n, 'transform', `${bare ? `${bare} ` : ''}translate(${fmt(n.snapAt.dx)} ${fmt(n.snapAt.dy)})`);
      n.touched = true;
    }
    for (const f of Object.values(this.frames)) for (const n of f.byLocal.values()) if (n.snapAt && !snapped.has(n)) n.snapAt = null;
  }
  // A snapped item follows its drop (5.11): the offset is measured again when a clip or a binding moves the drop, the
  // item or one of their parents. The key is every transform (and a mounted drawing's x and y) from each up to the
  // root, with the item's own transform as written before the snap. A resize changes none of them.
  snapKey(n, dropNode, bare) {
    const chain = (x) => { const out = []; for (; x; x = x.parent) out.push(`${x.attrs.transform ?? ''},${x.attrs.x ?? ''},${x.attrs.y ?? ''}`); return out.join(';'); };
    return `${bare ?? ''}|${chain(n.parent)}|${chain(dropNode)}`;
  }
  // A color binding (6.8): the part's paints marked with `role` take the colour; without `role`, every marked paint
  // of the part; a part with no marked paint takes it as its fill. Text and unmarked paints keep their own colour.
  paintRole(n, role, colour) {
    let marked = 0;
    const walk = (x) => {
      if (!x.name) return;
      const r = x.attrs['data-hsvg-color'];
      if (r) for (const part of r.trim().split(/\s+/)) {
        const [paint, name] = part.includes(':') ? part.split(':') : ['fill', part];
        if (role && name !== role) continue;
        marked++;
        this.set(x, PAINT_ATTR[paint] || 'fill', colour);
      }
      x.children.forEach(walk);
    };
    walk(n);
    if (!marked && !role) this.set(n, 'fill', colour);
  }
  // A held slider (5.11). While a person holds a slider, its handle follows the pointer, and the drawing stays the one
  // writer of the handle's transform: the control gives a hold place (`at`, the handle's travel along its axis, in
  // its parent's units), and the drawing puts the handle there with one outer translate over what the channels wrote.
  // The author's binding keeps running underneath, and the hold is measured against it at every paint, so a binding's
  // glide does not shake the handle. A handle that follows a leader (6.2.1) moves its leader, so whatever follows the
  // leader comes too. On release the outer translate glides away over SETTLE_MS, so the handle settles where its
  // binding puts it (its value's place); under reduced motion it goes at once.
  // hold(n, {addr, axis, at}) holds or moves the hold; hold(n, null) lets go.
  hold(n, h) {
    this.holds ??= new Map();
    const was = this.holds.get(n);
    if (h) { this.holds.set(n, { ...h, mover: was?.mover ?? (h.axis === 'angle' ? n : this.moverOf(n)), d: was?.d ?? [0, 0], release: null }); this.live?.add(h.addr); return; }
    if (was && !was.release) was.release = { at: this.engine.state.now };
  }
  moverOf(n) {
    let m = n;
    for (let i = 0; i < 32 && m.attrs['data-hsvg-follow']; i++) {
      const f = Object.values(this.frames).find(x => [...x.byLocal.values()].includes(m));
      const lead = f && [...f.byLocal.values()].find(x => x.attrs.id === m.attrs['data-hsvg-follow']);
      if (!lead) break;
      m = lead;
    }
    return m;
  }
  applyHolds() {
    if (!this.holds?.size) return;
    const now = this.engine.state.now;
    const world = (n) => { let m = IDENTITY; const chain = []; for (let x = n; x; x = x.parent) chain.push(x); for (const x of chain.reverse()) m = mul(m, parseTransform(x.attrs.transform)); return m; };
    for (const [n, h] of [...this.holds]) {
      const m = h.mover;
      const under = m.held && m.attrs.transform === m.held.to ? m.held.from : m.attrs.transform;
      let d = h.d;
      // An angle slider (axis angle): `at` is the part's turn from its drawn angle, in degrees. The hold is one outer
      // rotate about the pivot (where the channels put it now) by what the binding's turn leaves to make up.
      const turn = h.axis === 'angle';
      const M = turn ? parseTransform(under) : null;
      if (turn && !h.release) {
        const rel = mul(invert(parseTransform(m.base.transform)) || IDENTITY, M);
        d = h.d = [((h.at - Math.atan2(rel[1], rel[0]) * 180 / Math.PI) % 360 + 540) % 360 - 180, 0];
      } else if (!h.release) {
        // How far the binding has the handle from its drawn place now (the mover's parent's units), in the handle's
        // parent's units; the hold makes up the rest along the axis.
        const M = parseTransform(under); const B = parseTransform(m.base.transform);
        const k = m === n ? IDENTITY : mul(invert(n.parent ? world(n.parent) : IDENTITY) || IDENTITY, m.parent ? world(m.parent) : IDENTITY);
        const lin = (q, [x, y]) => [q[0] * x + q[2] * y, q[1] * x + q[3] * y];
        const shift = lin(k, [M[4] - B[4], M[5] - B[5]]);
        const want = h.axis === 'y' ? [0, h.at - shift[1]] : [h.at - shift[0], 0];
        d = h.d = lin(invert([k[0], k[1], k[2], k[3], 0, 0]) || IDENTITY, want);
      } else {
        const x = this.engine.state.ambient?.reducedMotion ? 1 : Math.min(1, Math.max(0, (now - h.release.at) / SETTLE_MS));
        const left = 1 - ease('ease-out', x, this.theme);
        d = x >= 1 ? null : [h.d[0] * left, h.d[1] * left];
      }
      if (!d) { this.set(m, 'transform', under); m.held = null; this.holds.delete(n); continue; }
      const [px, py] = (n.attrs['data-hsvg-pivot'] || '0 0').split(/[\s,]+/).map(Number);
      const to = `${turn ? `rotate(${fmt(d[0])} ${fmt(M[0] * px + M[2] * py + M[4])} ${fmt(M[1] * px + M[3] * py + M[5])})` : `translate(${fmt(d[0])} ${fmt(d[1])})`}${under ? ` ${under}` : ''}`;
      this.set(m, 'transform', to);
      m.held = { from: under, to };
      this.live?.add(h.addr);
    }
  }
  // Attach (6.9): player.attach puts a use of a block on a <g> slot, its own or one of its uses' ('bike.basket-point');
  // the use's mounted drawing moves into that slot, so it rides on the part that holds the slot, with its placement
  // point at the slot's origin. With to null, or to the use's home slot (its `into`), it goes back where it was drawn.
  applyAttach() {
    const e = this.engine;
    for (const addr of Object.keys(this.frames)) {
      const at = e.state.blocks[addr]?.attach || {};
      for (const u of e.def(addr)?.uses || []) {
        const f = this.frames[`${addr}/${u.id}`]; const svg = f?.root;
        if (!svg?.mountedIn) continue; // a use in a <rect> slot keeps its box
        svg.home ??= svg.mountedIn;
        let to = at[u.id] ?? null; let slot = null;
        if (to !== null && to !== u.into) {
          const dot = to.indexOf('.');
          const frame = dot < 0 ? this.frames[addr] : this.frames[`${addr}/${to.slice(0, dot)}`];
          const name = dot < 0 ? to : to.slice(dot + 1);
          slot = frame && [...frame.byLocal.values()].find(n => n.name === 'g' && n.attrs['data-hsvg-slot'] === name) || null;
          if (!slot) { this.faults.push({ code: 'E-REF-UNKNOWN', address: addr, message: `player.attach: no <g> slot ${to} is drawn` }); continue; }
          let loop = false; for (let x = slot; x; x = x.parent) if (x === svg) loop = true;
          if (loop) { this.faults.push({ code: 'E-CYCLE', address: addr, message: `player.attach: ${u.id} cannot ride on a slot inside itself` }); continue; }
        }
        const into = slot || svg.home;
        if (svg.mountedIn === into) continue;
        svg.mountedIn.children.splice(svg.mountedIn.children.indexOf(svg), 1);
        into.children.push(svg); svg.mountedIn = into;
        if (into.dom && svg.dom) into.dom.appendChild(svg.dom);
      }
    }
  }
  // Follows (6.2.1): a part with data-hsvg-follow moves as if nested inside its leader. Its transform becomes
  //   inverse(world of its real parent) x world of the leader x its own transform,
  // worked out from the drawn and painted transforms, leaders first. Nested <svg> viewports are shared by a follower
  // and its leader (one drawing), so they cancel out.
  applyFollows(channels) {
    const pairs = [];
    for (const f of Object.values(this.frames)) {
      // A frame's followers and leaders are fixed by its drawing: found once.
      if (!f.follows) {
        f.follows = [];
        const marked = [...f.byLocal.values()].filter(n => n.attrs['data-hsvg-follow']);
        const byId = marked.length ? new Map([...f.byLocal.values()].map(n => [n.attrs.id, n])) : null;
        for (const n of marked) { const lid = n.attrs['data-hsvg-follow']; f.follows.push([n, byId.get(lid) ?? null, lid]); }
      }
      for (const [n, leader, lid] of f.follows) {
        if (leader) pairs.push([n, leader]); else this.faults.push({ code: 'E-FOLLOWS', message: `${n.attrs.id} follows ${lid}, which is not in its drawing` });
      }
    }
    if (!pairs.length) return;
    const followers = new Set(pairs.map(([n]) => n));
    const done = new Set();
    const world = (n) => { let m = IDENTITY; const chain = []; for (let x = n; x; x = x.parent) chain.push(x); for (const x of chain.reverse()) m = mul(m, parseTransform(x.attrs.transform)); return m; };
    const waitsOn = (n) => { const out = []; for (let x = n; x; x = x.parent) if (followers.has(x)) out.push(x); return out; };
    let pending = pairs;
    while (pending.length) {
      const next = [];
      for (const [n, leader] of pending) {
        const deps = [...waitsOn(leader), ...(n.parent ? waitsOn(n.parent) : [])];
        if (deps.some(d => !done.has(d))) { next.push([n, leader]); continue; }
        if (!channels.has(n)) this.set(n, 'transform', n.base.transform);
        const adjust = mul(invert(n.parent ? world(n.parent) : IDENTITY), world(leader));
        if (!adjust) { this.faults.push({ code: 'E-FOLLOWS', message: `${n.attrs.id}: its parent cannot be inverted` }); done.add(n); continue; }
        const own = n.attrs.transform;
        this.set(n, 'transform', `matrix(${adjust.map(fmt).join(' ')})${own ? ` ${own}` : ''}`);
        n.touched = true;
        done.add(n);
      }
      if (next.length === pending.length) { for (const [n] of next) this.faults.push({ code: 'E-FOLLOWS', message: `${n.attrs.id}: follows loop` }); break; }
      pending = next;
    }
  }
  // A visible binding owns visibility (6.8): true shows a part drawn with display="none". restore() puts the drawn
  // display back first, so a part the binding no longer shows is hidden again as drawn.
  showDrawnHidden(n) {
    if (n.base?.display === 'none' || n.attrs.display === 'none') this.set(n, 'display', undefined);
  }
  val(addr, f) { return this.engine.eval(addr, f); }
  // keepTransform: a snapped item (applySnaps) keeps its transform, written again after the channels.
  restore(n, keepTransform = false) {
    for (const k of ['transform', 'opacity', 'display', 'stroke-dasharray', 'stroke-dashoffset']) if (!(keepTransform && k === 'transform')) this.set(n, k, n.base[k]);
    if (n.motionBase) for (const [k, v] of Object.entries(n.motionBase)) this.set(n, k, v);
    for (const c of n.children) if (c.name && c.base && 'data-hsvg-variant' in c.base) { this.set(c, 'display', c.base.display); if (c.blended) { this.set(c, 'opacity', c.base.opacity); c.blended = false; } }
  }
  write(n, ch) {
    if (ch.visible === false) this.set(n, 'display', 'none');
    if (ch.visible === true) this.showDrawnHidden(n);
    if (ch.look !== undefined) {
      const looks = n.children.filter(c => c.name && 'data-hsvg-variant' in c.attrs);
      if (looks.length && !looks.some(c => c.attrs['data-hsvg-variant'] === ch.look)) this.faults.push({ code: 'E-LOOK-NOT-DRAWN', message: `variant ${ch.look} is not drawn on ${n.attrs.id}` });
      else for (const c of looks) {
        const id = c.attrs['data-hsvg-variant'];
        const blend = ch.lookBlend && looks.some(x => x.attrs['data-hsvg-variant'] === ch.lookBlend.from) ? ch.lookBlend : null;
        const shown = id === ch.look || (blend && id === blend.from);
        this.set(c, 'display', shown ? undefined : 'none');
        if (blend && shown) { this.set(c, 'opacity', fmt(id === ch.look ? blend.mix : 1 - blend.mix)); c.blended = true; }
        else if (c.blended) { this.set(c, 'opacity', c.base?.opacity); c.blended = false; }
      }
    }
    if (ch.opacity !== undefined) this.set(n, 'opacity', fmt(ch.opacity));
    this.writeMotion(n, ch);
    const tx = (ch['translate-x'] || 0) + (ch.route?.dx || 0); const ty = (ch['translate-y'] || 0) + (ch.route?.dy || 0);
    const r = ch.rotate || 0; const k = ch.skew || 0;
    const sx = ch.scale ?? ch['scale-x'] ?? 1; const sy = ch.scale ?? ch['scale-y'] ?? 1;
    if (tx || ty || r || k || sx !== 1 || sy !== 1) {
      const [px, py] = (n.attrs['data-hsvg-pivot'] || '0 0').split(/\s+/).map(Number);
      const parts = [];
      if (n.base.transform) parts.push(n.base.transform);
      if (tx || ty) parts.push(`translate(${fmt(tx)} ${fmt(ty)})`);
      if (r || k || sx !== 1 || sy !== 1) {
        parts.push(`translate(${fmt(px)} ${fmt(py)})`);
        if (r) parts.push(`rotate(${fmt(r)})`);
        if (k) parts.push(`skewX(${fmt(k)})`);
        if (sx !== 1 || sy !== 1) parts.push(`scale(${fmt(sx)} ${fmt(sy)})`);
        parts.push(`translate(${fmt(-px)} ${fmt(-py)})`);
      }
      this.set(n, 'transform', parts.join(' '));
    }
  }

  // Facing (6.8): a part whose x scale is negative (a scale on axis x of -1 faces left) is mirrored in write(); each
  // <text> inside an odd number of mirrored parts is mirrored back about its own x, with its anchor swapped (start and
  // end), so it reads the right way round in the same place. this.faceTexts holds the texts turned back, to undo when
  // nothing mirrors them.
  applyFaces(channels) {
    const now = new Set();
    for (const [n, ch] of channels) {
      if (!mirrored(ch)) continue;
      const walk = (x) => { if (!x.name) return; if (x.name === 'text') now.add(x); else x.children.forEach(walk); };
      n.children.forEach(walk);
    }
    for (const t of now) {
      let odd = false;
      for (let x = t.parent; x; x = x.parent) if (mirrored(channels.get(x))) odd = !odd;
      if (!odd) now.delete(t);
    }
    for (const t of this.faceTexts || []) if (!now.has(t)) this.turnText(t, false);
    for (const t of now) this.turnText(t, true);
    this.faceTexts = now;
  }
  turnText(t, on) {
    const x = Number(String(t.attrs.x ?? '0').trim().split(/[\s,]+/)[0]) || 0;
    const back = ` translate(${fmt(2 * x)} 0) scale(-1 1)`;
    const tr = t.attrs.transform || '';
    const has = tr.endsWith(back.trim());
    if (on && !has) this.set(t, 'transform', (tr + back).trim());
    if (!on && has) this.set(t, 'transform', tr.slice(0, tr.length - back.trim().length).trim() || undefined);
    let a = t.base?.['text-anchor'];
    for (let p = t.parent; !a && p; p = p.parent) a = p.attrs['text-anchor'];
    if (a !== 'middle') this.set(t, 'text-anchor', on ? (a === 'end' ? 'start' : 'end') : t.base?.['text-anchor']);
  }
  // A channel binding's glide (6.8): a new value is reached over glide.durationMs with its easing (default linear),
  // from the value shown when it changed; the block keeps painting until it arrives. A number glides; a colour of the
  // paint channels blends. Under reduced motion, or with no glide, the value jumps.
  glided(addr, bd, v, now, live) {
    const g = bd.glide;
    const key = `${addr}|${this.bkey(addr, bd)}`;
    this.glides ??= new Map();
    const was = this.glides.get(key);
    const ch = channelOf(bd);
    const mix = ch === 'fill' || ch === 'stroke' ? (a, b, x) => mixColour(ch, a, b, x) : typeof v === 'number' ? (a, b, x) => a + (b - a) * x : null;
    if (!g || !mix || this.engine.state.ambient?.reducedMotion || !was || typeof was.from !== typeof v) { this.glides.set(key, { from: v, to: v, at: now }); return v; }
    const shown = (w) => (w.from === w.to ? w.to : mix(w.from, w.to, ease(g.easing || 'linear', Math.min(1, Math.max(0, (now - w.at) / g.durationMs)), this.theme)));
    if (v !== was.to) { const from = shown(was); this.glides.set(key, { from, to: v, at: now }); }
    const w = this.glides.get(key);
    if (now - w.at < g.durationMs && w.from !== w.to) live.add(addr);
    return now - w.at >= g.durationMs ? w.to : shown(w);
  }
  // ---------- the paint channels (core, D28), the motion capability's channels (6.7) and the points binding (6.8) ----------
  // fill, stroke, stroke-width and dash (paint-channels.mjs) and route (route.mjs) are core. morph comes from the motion
  // capability (src/capabilities/motion.mjs), installed only when needs names it; without it it is a fault
  // (E-NEEDS-MISSING).
  motionApi() {
    const m = this.engine.motionChannels;
    if (!m) { const e = new Error('motion.morph needs the motion add-on (needs: ["motion"])'); e.code = 'E-NEEDS-MISSING'; throw e; }
    return m;
  }
  motionMix(channel) {
    return channel === 'fill' || channel === 'stroke' ? (a, b, x) => mixColour(channel, a, b, x) : null;
  }
  // An add-on channel (D39): its writer's part channels, kept inside n's drawn motion ranges.
  addonPut(pw, addr, n, v, put) { for (const [k, x] of Object.entries(pw(addr, v, parseMotion(n.attrs['data-hsvg-motion'])))) put(n, k, x); }
  // Works out what a motion channel writes on n, from its value v and its source's keys (route, to), and puts it.
  motionPut(f, n, channel, v, src, put, addr) {
    if (channel === 'dash') {
      // The checker proves both inside 0..1 (6.7); an easing's overshoot is clamped, as the maths does.
      const num = (x, what) => { if (typeof x !== 'number' || !Number.isFinite(x)) { const e = new Error(`draw ${what} ${JSON.stringify(x)} is not a number`); e.code = 'E-TYPE'; throw e; } return x; };
      const start = src.start === undefined ? 0 : num(typeof src.start === 'string' ? this.val(addr, src.start) : src.start, 'start');
      put(n, 'dash', dashOf(num(v, 'share'), start));
      return;
    }
    const m = channel === 'morph' ? this.motionApi() : null;
    if (channel === 'route') {
      const route = f.byLocal.get(src.route);
      if (!route || route.attrs['data-hsvg-route'] === undefined) { const e = new Error(`no drawn route ${src.route} (data-hsvg-route)`); e.code = 'E-REF-UNKNOWN'; throw e; }
      if (typeof v !== 'number' || !Number.isFinite(v)) { const e = new Error(`route progress ${JSON.stringify(v)} is not a number`); e.code = 'E-TYPE'; throw e; }
      const pt = routePoint(route, v);
      if (!pt) { const e = new Error(`the route ${src.route} has no length`); e.code = 'E-REF-UNKNOWN'; throw e; }
      // The route's point, in the coordinates the part is placed in (its parent's), minus its placement point.
      const map = mul(invert(n.parent ? baseWorld(n.parent) : IDENTITY) || IDENTITY, baseWorld(route));
      const x = map[0] * pt[0] + map[2] * pt[1] + map[4]; const y = map[1] * pt[0] + map[3] * pt[1] + map[5];
      const [px, py] = (n.attrs['data-hsvg-pivot'] || '0 0').split(/[\s,]+/).map(Number);
      put(n, 'route', { dx: x - (px || 0), dy: y - (py || 0) });
      return;
    }
    if (channel === 'morph') {
      const to = f.byLocal.get(src.to);
      if (n.name !== 'path' || to?.name !== 'path') { const e = new Error(`morph needs two <path> parts: ${n.attrs.id} and ${src.to}`); e.code = 'E-TYPE'; throw e; }
      put(n, 'morph', m.morphPath(n.base.d, to.base.d, Math.max(0, Math.min(1, v))));
      return;
    }
    if ((channel === 'fill' || channel === 'stroke') && !isHex(v)) { const e = new Error(`${channel} ${JSON.stringify(v)} is not a #rrggbb colour`); e.code = 'E-TYPE'; throw e; }
    if (channel === 'stroke-width' && (typeof v !== 'number' || !(v >= 0))) { const e = new Error(`scale as line ${JSON.stringify(v)} is not a number of at least 0`); e.code = 'E-TYPE'; throw e; }
    put(n, channel, v);
  }
  // Writes the attributes of the motion channels; restore() puts back what was there before the first write.
  writeMotion(n, ch) {
    const w = (k, v) => { n.motionBase ??= {}; if (!(k in n.motionBase)) n.motionBase[k] = n.attrs[k]; this.set(n, k, v); };
    if (ch.morph !== undefined) w('d', ch.morph);
    if (ch.picture !== undefined) w('href', ch.picture);
    if (ch.fill !== undefined) w('fill', ch.fill);
    if (ch.stroke !== undefined) w('stroke', ch.stroke);
    if (ch['stroke-width'] !== undefined) w('stroke-width', fmt(ch['stroke-width']));
    if (ch.wipe !== undefined) this.writeWipe(n, ch.wipe, w);
    if (ch.dash !== undefined) { this.set(n, 'stroke-dasharray', ch.dash.array); this.set(n, 'stroke-dashoffset', ch.dash.offset); w('visibility', ch.dash.hidden ? 'hidden' : n.motionBase?.visibility ?? n.attrs.visibility); }
  }
  // The wipe channel (6.7): the share v (0..1) of the part shown, from the left, through a rectangle in a clip path.
  // The part owns one <clipPath>, id <its mounted id>_wipe (no drawn or mounted id has a single _), made at its first
  // wipe just before it. The rectangle spans the part's box at its first wipe, with its widest stroke either side; its
  // width grows with v. clip-path goes back to as drawn when nothing wipes the part (restore()).
  writeWipe(n, v, w) {
    if (typeof v !== 'number' || !Number.isFinite(v)) { this.faults.push({ code: 'E-TYPE', message: `wipe ${JSON.stringify(v)} on ${n.attrs.id} is not a number` }); return; }
    let wp = n.wipe;
    if (!wp) {
      const box = bboxOf(n, new Map());
      let pad = 0.5;
      const strokes = (x) => { if (!x.name) return; const s = Number(x.attrs['stroke-width']); if (x.attrs.stroke && x.attrs.stroke !== 'none' && s > 0) pad = Math.max(pad, s); else if (x.attrs.stroke && x.attrs.stroke !== 'none') pad = Math.max(pad, 1); x.children.forEach(strokes); };
      strokes(n);
      // Unmeasured (a <use> without a page): the part's own bounding box, with room either side.
      const [x0, y0, x1, y1] = box || [-0.5, -0.5, 1.5, 1.5];
      const p = box ? pad : 0;
      const rect = { name: 'rect', attrs: { x: fmt(x0 - p), y: fmt(y0 - p), width: '0', height: fmt(y1 - y0 + 2 * p) }, attrOrder: ['x', 'y', 'width', 'height'], children: [] };
      const cp = { name: 'clipPath', attrs: { id: `${n.attrs.id}_wipe`, ...(box ? {} : { clipPathUnits: 'objectBoundingBox' }) }, attrOrder: ['id', ...(box ? [] : ['clipPathUnits'])], children: [rect] };
      rect.parent = cp;
      const host = n.parent || n;
      cp.parent = host; rect.base = { ...rect.attrs }; cp.base = { ...cp.attrs };
      const sib = host.children; sib.splice(host === n ? 0 : sib.indexOf(n), 0, cp);
      const el = n.dom && this.toDom(n.dom.ownerDocument, cp);
      if (el) { if (host === n) n.dom.prepend(el); else n.dom.before(el); }
      wp = n.wipe = { rect, id: cp.attrs.id, span: x1 - x0 + 2 * p };
    }
    this.set(wp.rect, 'width', fmt(Math.min(1, Math.max(0, v)) * wp.span));
    w('clip-path', `url(#${wp.id})`);
  }
  // A points binding (6.8): the polyline's points from a list of numbers (y, spread evenly in x) or [x, y] pairs,
  // mapped into the area <rect>'s box, y upwards; a value outside its range sits on the box's edge. Default ranges:
  // x the item indexes, y 0..1. Only the points attribute is written.
  paintPoints(f, n, bd, list) {
    const fail = (code, msg) => { const e = new Error(msg); e.code = code; throw e; };
    if (n.name !== 'polyline') fail('E-PLACE', `a points binding draws a <polyline>; ${bd.target} is a <${n.name}>`);
    const area = f.byLocal.get(bd.area);
    if (area?.name !== 'rect') fail('E-PLACE', `the area ${bd.area} of a points binding is not a drawn <rect>`);
    const max = this.engine.limits?.linePoints ?? 512;
    if (!Array.isArray(list) || list.length < 2 || list.length > max) fail('E-RANGE', `a points binding needs 2 to ${max} values (linePoints); it has ${Array.isArray(list) ? list.length : typeof list}`);
    const pairs = list.map((v, i) => (Array.isArray(v) ? v : [i, v]));
    if (!pairs.every(p => p.length === 2 && p.every(x => typeof x === 'number' && Number.isFinite(x)))) fail('E-TYPE', 'a points binding takes numbers or [x, y] pairs of numbers');
    const [x0, x1] = bd.range?.x || [0, list.length - 1];
    const [y0, y1] = bd.range?.y || [0, 1];
    const num = (k) => Number(area.base[k] ?? 0);
    const ax = num('x'); const ay = num('y'); const aw = num('width'); const ah = num('height');
    const share = (v, lo, hi) => (hi === lo ? 0 : Math.max(0, Math.min(1, (v - lo) / (hi - lo))));
    // The area's box, in the polyline's own coordinates.
    const map = mul(invert(baseWorld(n)) || IDENTITY, baseWorld(area));
    const pts = pairs.map(([x, y]) => {
      const px = ax + share(x, x0, x1) * aw; const py = ay + ah - share(y, y0, y1) * ah;
      return `${fmt(map[0] * px + map[2] * py + map[4])},${fmt(map[1] * px + map[3] * py + map[5])}`;
    });
    this.set(n, 'points', pts.join(' '));
  }

  // ---------- output ----------
  serialize(n = this.root) {
    if (!n.name) return n.text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const attrs = n.attrOrder.filter(k => k in n.attrs).map(k => ` ${k}="${n.attrs[k].replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"`).join('');
    if (!n.children.length) return `<${n.name}${attrs}/>`;
    return `<${n.name}${attrs}>${n.children.map(c => this.serialize(c)).join('')}</${n.name}>`;
  }
  // Builds real DOM nodes (browser): returns the root element.
  toDom(doc, n = this.root) {
    if (!n.name) return doc.createTextNode(n.text);
    const el = doc.createElementNS('http://www.w3.org/2000/svg', n.name);
    for (const k of n.attrOrder) if (k in n.attrs) { if (k === 'xlink:href') el.setAttributeNS('http://www.w3.org/1999/xlink', k, n.attrs[k]); else if (k !== 'xmlns') el.setAttribute(k, n.attrs[k]); }
    for (const c of n.children) el.appendChild(this.toDom(doc, c));
    n.dom = el;
    return el;
  }
}
// The channels drawn by motionPut: the core paint channels (D28), route (D31) and morph, which motion adds (6.7).
const MOTION = new Set(['route', 'morph', 'fill', 'stroke', 'stroke-width', 'dash']);
// A node's drawn transform and its ancestors' up to its frame's <svg>, as one matrix (drawn transforms only).
function baseWorld(n) {
  const chain = [];
  for (let x = n; x && x.name !== 'svg'; x = x.parent) chain.push(x);
  let m = IDENTITY;
  for (const x of chain.reverse()) m = mul(m, parseTransform(x.base?.transform ?? x.attrs.transform));
  return m;
}
// The same channels with the same values (a value kept from the last paint is the same object).
function sameChannels(a, b) {
  if (!a) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}
// Sets an attribute on a node that is not mounted yet (no DOM).
function putAttr(n, k, v) { if (!(k in n.attrs)) n.attrOrder.push(k); n.attrs[k] = String(v); }
function viewBoxAspectOf(text) {
  const m = /<svg\b[^>]*?\sviewBox\s*=\s*["']([^"']+)["']/.exec(String(text || ''));
  const v = m ? m[1].trim().split(/[\s,]+/).map(Number) : [];
  return v.length === 4 && v[2] > 0 && v[3] > 0 ? v[2] / v[3] : null;
}
// A face binding's value (6.8): left or right.
// A part mirrored left to right: its x scale (scale, or scale on axis x) is negative.
function mirrored(ch) { return !!ch && (ch.scale ?? ch['scale-x'] ?? 1) < 0; }
// Numbers written to the drawing: 6 decimals, trailing zeros dropped (as the 0.1 player wrote them).
const fmt = (x) => String(Math.round(x * 1e6) / 1e6);

// ---------- 2D matrices [a, b, c, d, e, f], as SVG ----------
const IDENTITY = [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
function invert(m) {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-12) return null;
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
}
// An SVG transform attribute as one matrix: translate, scale, rotate (with a centre), skewX, skewY, matrix.
export function parseTransform(s) {
  let m = IDENTITY;
  if (!s) return m;
  const rad = (a) => (a * Math.PI) / 180;
  for (const [, fn, args] of String(s).matchAll(/([a-zA-Z]+)\s*\(([^)]*)\)/g)) {
    const v = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    let k = IDENTITY;
    if (fn === 'translate') k = [1, 0, 0, 1, v[0] || 0, v[1] || 0];
    else if (fn === 'scale') k = [v[0], 0, 0, v[1] ?? v[0], 0, 0];
    else if (fn === 'rotate') { const c = Math.cos(rad(v[0])); const n = Math.sin(rad(v[0])); k = [c, n, -n, c, 0, 0]; if (v.length === 3) k = mul(mul([1, 0, 0, 1, v[1], v[2]], k), [1, 0, 0, 1, -v[1], -v[2]]); }
    else if (fn === 'skewX') k = [1, 0, Math.tan(rad(v[0])), 1, 0, 0];
    else if (fn === 'skewY') k = [1, Math.tan(rad(v[0])), 0, 1, 0, 0];
    else if (fn === 'matrix') k = v.slice(0, 6);
    m = mul(m, k);
  }
  return m;
}
export { clone };
