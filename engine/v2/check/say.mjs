// How a message names what a binding or a clip track writes (D33). The engine keeps inner channel names
// (translate-x, skew, stroke-width, dash, look); a message names the final JSON word with its `as` or `axis`, so a
// person or a model who copies it writes the right form.
const SAY = {
  'translate-x': 'move (axis x)', 'translate-y': 'move (axis y)', route: 'move (axis route)',
  skew: 'rotate (as lean)', 'scale-x': 'scale (axis x)', 'scale-y': 'scale (axis y)', 'stroke-width': 'scale (as line)',
  size: 'scale (as box)', dash: 'draw', wipe: 'draw (as wipe)', points: 'draw (as points)', look: 'variant',
  picture: 'variant (as picture)', icon: 'variant (as icon)', fill: 'color (as fill)', stroke: 'color (as stroke)',
  morph: 'motion.morph',
};
export const sayChannel = (ch) => {
  if (typeof ch !== 'string') return String(ch);
  if (ch.startsWith('color:')) return `color (role ${ch.slice(6)})`;
  return SAY[ch] ?? ch;
};
// The binding a slider or dial needs so its part shows its value at rest (5.11). A `move` or `rotate` binding moves
// the part by its number in drawing units or degrees, so the formula maps the value's bounds onto the control's
// range: start + (v - min) / (max - min) * span. d is the value's declaration (its minimum and maximum).
export const mapFormula = (v, d, range) => {
  const ok = Array.isArray(range) && range.length === 2 && range.every(Number.isFinite) && Number.isFinite(d?.minimum) && Number.isFinite(d?.maximum) && d.maximum > d.minimum;
  if (!ok) return `(${v} - min) / (max - min) * span`;
  const [a, b] = range; const lo = d.minimum; const w = d.maximum - lo; const span = b - a;
  if (a === 0 && lo === 0 && w === span) return v;
  const off = lo === 0 ? v : `(${v} ${lo < 0 ? '+' : '-'} ${Math.abs(lo)})`;
  const share = w === 1 ? off : `${off} / ${w}`;
  const scaled = span === 1 ? share : `${share} * ${span}`;
  return a === 0 ? scaled : `${a} + ${scaled}`;
};
export const bindingFor = (c, target, d) => c.kind === 'dial'
  ? `{"target": "${target}", "rotate": "${mapFormula(c.value, d, c.range)}"}`
  : `{"target": "${target}", "move": "${mapFormula(c.value, d, c.range)}", "axis": "${c.axis === 'y' ? 'y' : 'x'}"}`;
