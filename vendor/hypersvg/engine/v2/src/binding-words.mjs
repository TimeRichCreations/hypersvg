import { parse } from './formula.mjs';
// What a part shows (6.8, D33): a binding's key is its word, a clip track's `channel` is its word, and `as` and `axis`
// say which sort. channelOf gives the channel the drawing paints for a word, or null for a word with its own painter
// (text, label, visible, a marked colour, a picture or icon variant, a scale as a box, a draw as points).
export const BINDING_WORDS = Object.freeze(['text', 'label', 'visible', 'variant', 'color', 'move', 'rotate', 'scale', 'opacity', 'draw']);

// The word of a binding (the first of its keys that is a word, or an add-on's owner.name key) or of a clip track.
export function wordOf(o) {
  if (!o || typeof o !== 'object') return null;
  if (typeof o.channel === 'string' && Array.isArray(o.keys)) return o.channel;
  for (const k of BINDING_WORDS) if (k in o) return k;
  return Object.keys(o).find(k => /^[a-z][a-z0-9-]*\.[a-z]/.test(k)) ?? null;
}
// The value a binding gives its word.
export const valueOf = (o) => o?.[wordOf(o)];

export function channelOf(o) {
  const w = wordOf(o);
  const as = o?.as; const axis = o?.axis;
  switch (w) {
    case 'move': return axis === 'route' ? 'route' : axis === 'y' ? 'translate-y' : 'translate-x';
    case 'rotate': return as === 'lean' ? 'skew' : 'rotate';
    case 'scale': return as === 'line' ? 'stroke-width' : as === 'box' ? null : axis === 'x' ? 'scale-x' : axis === 'y' ? 'scale-y' : 'scale';
    case 'opacity': return 'opacity';
    case 'color': return as === 'fill' || as === 'stroke' ? as : null;
    case 'draw': return as === 'wipe' ? 'wipe' : as === 'points' ? null : 'dash';
    case 'variant': return !as || as === 'drawn' ? 'look' : null;
    case 'motion.morph': return 'morph';
    default: return null;
  }
}
// What a binding writes on its part, for the one-writer rule (9.3): its channel, or its own property (text, visible,
// look, picture, icon, color, size, points). A colour binding with a role writes only that role. null for a label.
export function propOf(b) {
  const w = wordOf(b);
  const ch = channelOf(b);
  if (ch) return ch;
  if (w === 'variant') return b.as;
  if (w === 'color') return b.role ? `color:${b.role}` : 'color';
  if (w === 'scale') return 'size';
  if (w === 'draw') return 'points';
  return w === 'text' || w === 'visible' ? w : null;
}
// A scale on axis x whose value can only be -1 or 1 faces the part left or right (6.8): a choice, not motion, so it
// needs no motion range and still follows its value under reduced motion.
const mirrors = new WeakMap();
export function isMirror(b) {
  if (!b || typeof b !== 'object' || channelOf(b) !== 'scale-x') return false;
  if (mirrors.has(b)) return mirrors.get(b);
  let r = false;
  if (typeof b.scale === 'number') r = b.scale === 1 || b.scale === -1;
  else if (typeof b.scale === 'string') {
    try {
      const ends = (n) => (n.k === 'if' ? ends(n.a) && ends(n.b) : n.k === 'lit' ? n.v === 1 || n.v === -1 : n.k === 'un' && n.op === '-' && n.v.k === 'lit' && n.v.v === 1);
      r = ends(parse(b.scale));
    } catch { r = false; }
  }
  mirrors.set(b, r);
  return r;
}
