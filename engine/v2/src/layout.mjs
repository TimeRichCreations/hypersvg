// Choosing a block's layout (7.1 to 7.4). The engine reads what the layouts declare (`size`, `shape`) and a use's
// `layout` map; it never reads a layout's id for meaning.
// - A size is "WxH" in CSS pixels; a layout with `size` applies when the space is exactly that size (whole pixels).
// - A shape is a range (7.2): every key present must hold; minimums are inclusive, maximums exclusive. A layout's
//   `shape` is an inline range or a name. A name is looked up in the shape axes' `shapes` maps, innermost first (the
//   block's own axes, then the experience's); with no map naming it, in the eight standard shapes. (A kit's map
//   replaces the standard shapes, 7.2; kits are not loaded by this engine yet.)
// - Which one (7.4): the use's `layout` map first; then the exact size; then the current layout while it still
//   applies and fits; then the first in list order that applies and fits. If some apply but none fits, the first
//   that applies (the give-way steps work on it, 7.6). If none applies, the nearest by aspect (7.3): the smallest
//   |ln(layout aspect) - ln(space aspect)|, ties to list order.
// - "Fits" is a question the caller answers (fits(id) -> true, false or undefined). Undefined means "not measured"
//   and counts as fitting: before a layout is drawn nothing is measured, so the player reads "fits" from the text fits
//   it has measured (see player-web.mjs).

// The standard shapes of 7.2, by aspect (width / height).
export const STANDARD_SHAPES = {
  skyscraper: { maxAspect: 0.45 },
  tall: { minAspect: 0.45, maxAspect: 0.7 },
  portrait: { minAspect: 0.7, maxAspect: 0.9 },
  square: { minAspect: 0.9, maxAspect: 1.3 },
  landscape: { minAspect: 1.3, maxAspect: 2.5 },
  banner: { minAspect: 2.12, maxAspect: 5 },
  strip: { minAspect: 5, maxAspect: 10 },
  superwide: { minAspect: 10 },
};

// The active shape of a space (7.2, the ambient size of 5.5): the first shape that holds it, in the shape maps
// innermost first, else among the standard shapes; '' when none does.
export function activeShape(space, maps = []) {
  for (const m of [...maps, STANDARD_SHAPES]) for (const [id, range] of Object.entries(m || {})) if (inRange(range, space)) return id;
  return '';
}

// "300x250" -> {width: 300, height: 250}, else null.
export function parseSize(s) {
  const m = /^(\d+)x(\d+)$/.exec(String(s ?? ''));
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

// Does the space {width, height, direction} lie in the range? Minimums inclusive, maximums exclusive (7.2).
export function inRange(range, space) {
  if (!range || typeof range !== 'object' || !space) return false;
  const { width: w, height: h } = space;
  if (!(w > 0 && h > 0)) return false;
  const v = { Aspect: w / h, Width: w, Height: h, Pixels: w * h };
  for (const [k, limit] of Object.entries(range)) {
    if (k === 'direction') { if ((space.direction || 'ltr') !== limit) return false; continue; }
    const m = /^(min|max)(Aspect|Width|Height|Pixels)$/.exec(k);
    if (!m) continue; // labels and keys of other sections are not conditions
    if (m[1] === 'min' ? !(v[m[2]] >= limit) : !(v[m[2]] < limit)) return false;
  }
  return true;
}

// The shape maps that name shapes for a block, innermost first: the block's own shape axes, then the experience's.
export function shapeMapsOf(blockDoc, experienceDoc) {
  const maps = [];
  for (const d of [blockDoc, experienceDoc]) for (const a of d?.axes || []) if (a?.axis === 'shape' && a.shapes) maps.push(a.shapes);
  return maps;
}

// A layout's range, or null (an unknown shape name, which the checker reports).
export function rangeOf(shape, maps = []) {
  if (shape && typeof shape === 'object') return shape;
  for (const m of maps) if (m[shape]) return m[shape];
  return STANDARD_SHAPES[shape] || null;
}

// Does the layout apply to the space by its own keys (size or shape)?
export function applies(layout, space, maps = []) {
  if (!space) return false;
  if (layout.size != null) { const s = parseSize(layout.size); return !!s && s.width === Math.round(space.width) && s.height === Math.round(space.height); }
  if (layout.shape != null) return inRange(rangeOf(layout.shape, maps), space);
  return false;
}

// The aspect of a drawing's viewBox (width / height), or null.
export function viewBoxAspect(svgText) {
  const m = /<svg\b[^>]*?\sviewBox\s*=\s*["']([^"']+)["']/.exec(String(svgText || ''));
  if (!m) return null;
  const v = m[1].trim().split(/[\s,]+/).map(Number);
  return v.length === 4 && v[2] > 0 && v[3] > 0 ? v[2] / v[3] : null;
}

// The chosen language's direction (7.8): the language axis's option for it, else ltr.
export function directionOf(experienceDoc, language) {
  for (const a of experienceDoc?.axes || []) {
    if (a?.axis !== 'language' || !a.options || Array.isArray(a.options)) continue;
    const o = a.options[language] || a.options[String(language || '').split('-')[0]];
    if (o?.direction) return o.direction;
  }
  return 'ltr';
}

// Chooses one layout. layouts: the block's list. space: {width, height, direction} in CSS pixels, or null when the
// block has no box (an empty <g> slot). Options:
// - forced: the layout id a use's `layout` map names for the parent's layout, or null;
// - input: the layout id an `input` selector picked (7.1, inputPicks), or null; it comes after the use's map and
//   before the space;
// - current: the layout shown now, kept while it still applies and fits;
// - fits(id): true, false or undefined (not measured: counts as fitting);
// - aspectOf(id): the layout's drawing aspect, for the nearest-aspect rule;
// - maps: shape maps, innermost first (shapeMapsOf).
// Returns {id, why}: why is use, input, size, current, order, incomplete, nearest, first or none.
export function chooseLayout(layouts, space, { forced = null, input = null, current = null, fits = () => undefined, aspectOf = () => null, maps = [] } = {}) {
  const list = (layouts || []).filter(l => l && typeof l.id === 'string');
  if (!list.length) return { id: null, why: 'none' };
  const has = (id) => list.some(l => l.id === id);
  if (forced != null && has(forced)) return { id: forced, why: 'use' };
  if (input != null && has(input)) return { id: input, why: 'input' };
  if (!space) return { id: list[0].id, why: 'first' };
  const ok = (l) => fits(l.id) !== false;
  const exact = list.find(l => l.size != null && applies(l, space, maps));
  if (exact) return { id: exact.id, why: 'size' };
  const applying = list.filter(l => applies(l, space, maps));
  const cur = applying.find(l => l.id === current);
  if (cur && ok(cur)) return { id: cur.id, why: 'current' };
  const first = applying.find(ok);
  if (first) return { id: first.id, why: 'order' };
  if (applying.length) return { id: applying[0].id, why: 'incomplete' };
  // None applies: the nearest by aspect (7.3); ties go to list order.
  const target = Math.log(space.width / space.height);
  let best = null; let bestD = Infinity;
  for (const l of list) {
    const a = aspectOf(l.id);
    if (!(a > 0)) continue;
    const d = Math.abs(Math.log(a) - target);
    if (d < bestD - 1e-12) { best = l; bestD = d; }
  }
  return { id: (best || list[0]).id, why: 'nearest' };
}

// The aspect of each layout of a loaded block ({doc, drawings}): its own drawing, else the block's drawing.
export function aspectsOf(block) {
  const main = block?.drawings?.main?.text;
  return (id) => viewBoxAspect(block?.drawings?.[id]?.text ?? main);
}

// ---------- picking by input (7.1) ----------
// An axis entry with `select: "input"` names in `value` an input, knob, setting or value of the block that declares
// it; its current choice picks the option on that axis while playing. A change picks again at once (the player draws
// again). The axes: shape (a size id or a shape name), layout (a layout id), content (a tier or option, read by the
// tiers code through the picks), language and theme.

// The options of an axis entry, or null when the entry lists none. block: the declaring document, for a layout axis
// without its own list (its layouts) and a theme axis without one (its themes).
export function axisOptions(a, block = null) {
  if (!a || typeof a !== 'object') return null;
  if (Array.isArray(a.options)) return a.options.map(String);
  if (a.options && typeof a.options === 'object') return Object.keys(a.options);
  if (a.axis === 'shape') { const out = [...Object.keys(a.sizes || {}), ...Object.keys(a.shapes || {})]; return out.length ? out : null; }
  if (a.axis === 'content' && Array.isArray(a.tiers)) return a.tiers.map(t => t?.tier).filter(Boolean);
  if (a.axis === 'layout' && Array.isArray(block?.layouts)) return block.layouts.map(l => l?.id).filter(Boolean);
  if (a.axis === 'theme' && block?.themes && typeof block.themes === 'object') return Object.keys(block.themes);
  return null;
}

// The input-selected entries of one document's axes: [{entry, id, options}]. The look axis is left out: a look is
// picked by a binding (6.8).
export function inputAxes(doc) {
  const out = [];
  for (const a of doc?.axes || []) {
    if (a?.select !== 'input' || typeof a.value !== 'string' || a.axis === 'look') continue;
    out.push({ entry: a, id: a.id ?? a.axis, options: axisOptions(a, doc) });
  }
  return out;
}

// What the input selectors pick now. read(address, name) gives a name's value in a block's scope. blocks: [[address,
// doc]] of the mounted blocks that may declare axes (the experience first). Returns {experience: {axis: pick},
// blocks: {address: {axis: pick}}, bad: [{address, id, value, options}]}. A block's own entry wins for the block; a
// pick outside the entry's options is not used and is listed in bad (E-AXIS-INPUT).
export function inputPicks(blocks, read) {
  const out = { experience: {}, blocks: {}, bad: [] };
  for (const [address, doc] of blocks) {
    for (const { entry, id, options } of inputAxes(doc)) {
      let v;
      try { v = read(address, entry.value); } catch { v = undefined; }
      if (v === undefined || v === null) continue;
      if (options && !options.includes(v)) { out.bad.push({ address, id, value: v, options }); continue; }
      const into = address === 'experience' ? out.experience : (out.blocks[address] ??= {});
      into[entry.axis] = v;
    }
  }
  return out;
}

// The picks that hold for one block: its own, else the experience's.
export function picksFor(picks, address) {
  return { ...(picks?.experience || {}), ...(picks?.blocks?.[address] || {}) };
}

// The layout an input pick names for a block, or null. layout: a layout id of the block. shape: a size id (the
// layout with that size) or a shape name (the first layout naming that shape, else the first whose range is the
// named range).
export function pickedLayout(layouts, pick, maps = []) {
  const list = (layouts || []).filter(l => l && typeof l.id === 'string');
  if (pick?.layout != null && list.some(l => l.id === pick.layout)) return pick.layout;
  const s = pick?.shape;
  if (s == null) return null;
  if (parseSize(s)) return list.find(l => l.size === s)?.id ?? null;
  const named = list.find(l => l.shape === s);
  if (named) return named.id;
  const range = rangeOf(s, maps);
  return (range && list.find(l => l.shape && typeof l.shape === 'object' && JSON.stringify(l.shape) === JSON.stringify(range))?.id) ?? null;
}

// ---------- true size (7.3) ----------
// The exact sizes an experience is made in, when its shape axis lists only exact sizes (an ad), else null. The
// innermost shape entry counts (an experience's entry narrows its kit's: the kit's come first in the merged list).
export function trueSizes(experienceDoc) {
  const shapes = (experienceDoc?.axes || []).filter(a => a?.axis === 'shape' && (a.id ?? 'shape') === 'shape');
  const a = shapes[shapes.length - 1];
  if (!a || a.shapes || !a.sizes || typeof a.sizes !== 'object') return null;
  const out = Object.keys(a.sizes).map(parseSize).filter(Boolean);
  return out.length ? out : null;
}

// The size nearest a window (7.3: the smallest |ln(aspect) - ln(window aspect)|, ties to list order), and the scale
// it is drawn at: 1 (true size) when it fits, smaller when the window is smaller; never above 1.
export function nearestSize(sizes, win) {
  if (!sizes?.length) return null;
  let best = sizes[0];
  if (win?.width > 0 && win?.height > 0) {
    const t = Math.log(win.width / win.height);
    let d = Infinity;
    for (const s of sizes) { const x = Math.abs(Math.log(s.width / s.height) - t); if (x < d - 1e-12) { d = x; best = s; } }
  }
  const scale = win?.width > 0 && win?.height > 0 ? Math.min(1, win.width / best.width, win.height / best.height) : 1;
  return { width: best.width, height: best.height, scale };
}

// ---------- resizable slots (6.8 size, 5.10) ----------
// A <rect> slot or region's box for a new [width, height], about its anchor ([x, y] of start, middle or end; default
// the middle) on its drawn box {x, y, width, height}.
const SHARE = { start: 0, middle: 0.5, end: 1 };
export function resizedBox(drawn, size, anchor = null) {
  const [w, h] = size;
  const fx = SHARE[anchor?.[0]] ?? 0.5; const fy = SHARE[anchor?.[1]] ?? 0.5;
  return { x: drawn.x + (drawn.width - w) * fx, y: drawn.y + (drawn.height - h) * fy, width: w, height: h };
}

// A size binding's value, checked: [width, height], each a finite number of at least 1. Else throws with a code.
export function sizeValue(v) {
  const fail = (code, msg) => { const e = new Error(msg); e.code = code; throw e; };
  if (!Array.isArray(v) || v.length !== 2 || !v.every(x => typeof x === 'number' && Number.isFinite(x))) fail('E-TYPE', `a size is [width, height], two numbers; got ${JSON.stringify(v)}`);
  if (!(v[0] >= 1 && v[1] >= 1)) fail('E-RANGE', `a size is at least 1 each way; got ${JSON.stringify(v)}`);
  return v;
}
