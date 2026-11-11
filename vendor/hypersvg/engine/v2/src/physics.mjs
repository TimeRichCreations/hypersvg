// Motion ranges of drawn parts (6.2.1): the core reads them for physics bodies, particles and channels.
// The physics simulation itself is the physics capability: src/capabilities/physics.mjs. It ships only when an
// experience's needs names physics (1.1 principle 8).

// The translate ranges of the element with this id in a drawing's text (6.2.1), or null.
export function motionRanges(text, id) {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tag = new RegExp(`<[A-Za-z][^>]*\\bid="${esc}"[^>]*>`).exec(text);
  const m = tag && /\bdata-hsvg-motion="([^"]*)"/.exec(tag[0]);
  if (!m) return null;
  const out = parseMotion(m[1]);
  return out['translate-x'] && out['translate-y'] ? out : null;
}
// The entries of a data-hsvg-motion value (6.2.1, D31.3): channel ranges with two dots, split by semicolons, as
// "scale 1..1.2; rotate -6..6; move-y -60..0"; "rotate *" turns freely. [{channel, lo, hi} or {channel, free}],
// or null when the value is not in that form (the old "scale(1 1.2)" is not).
const NUM = '-?\\d+(?:\\.\\d+)?';
const ENTRY = new RegExp(`^([a-z][a-z-]*)\\s+(?:(\\*)|(${NUM})\\.\\.(${NUM}))$`);
export function motionEntries(value) {
  const parts = String(value ?? '').split(';').map(t => t.trim());
  if (parts.length && parts[parts.length - 1] === '') parts.pop();
  const out = [];
  for (const t of parts) {
    const m = ENTRY.exec(t);
    if (!m) return null;
    out.push(m[2] ? { channel: m[1], free: true } : { channel: m[1], lo: Number(m[3]), hi: Number(m[4]) });
  }
  return out;
}
// The motion mark names its channels as the JSON words (6.2.1, D33); the engine keeps its inner names.
export const MOTION_INNER = { 'move-x': 'translate-x', 'move-y': 'translate-y', lean: 'skew', draw: 'dash', line: 'stroke-width' };
// An inner channel as the motion mark writes it, for messages.
export const markChannel = (ch) => Object.keys(MOTION_INNER).find(k => MOTION_INNER[k] === ch) ?? ch;
// A data-hsvg-motion value (6.2.1) as {innerChannel: [min, max]}.
export function parseMotion(value) {
  const out = {};
  for (const e of motionEntries(value) || []) if (!e.free) out[MOTION_INNER[e.channel] ?? e.channel] = [e.lo, e.hi];
  return out;
}
// The two-dot spelling of an old data-hsvg-motion value ("scale(1 1.2) translate(60)" -> "scale 1..1.2; translate
// -60..60"), or null when it is not the old form. The checker shows it; the upgrade step writes it.
export function motionDots(value) {
  const s = String(value ?? '').trim();
  const toks = s.match(/[a-z-]+\([^)]*\)/g);
  if (!toks || toks.join(' ') !== s.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')) return null;
  const out = [];
  for (const t of toks) {
    const [, ch, raw] = /^([a-z-]+)\(([^)]*)\)$/.exec(t);
    const a = raw.trim().split(/[\s,]+/).filter(Boolean);
    if (a.length === 1 && a[0] === '*') out.push(`${ch} *`);
    else if (a.length === 1 && ch === 'translate' && Number.isFinite(Number(a[0]))) out.push(`${ch} ${-Number(a[0])}..${Number(a[0])}`);
    else if (a.length === 2 && a.every(x => Number.isFinite(Number(x)))) out.push(`${ch} ${Number(a[0])}..${Number(a[1])}`);
    else return null;
  }
  return out.join('; ');
}
