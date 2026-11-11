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
// The binding a slider or dial needs so its part shows its value at rest (5.11).
export const bindingFor = (c, target) => c.kind === 'dial'
  ? `{"target": "${target}", "rotate": "${c.value}"}`
  : `{"target": "${target}", "move": "${c.value}", "axis": "${c.axis === 'y' ? 'y' : 'x'}"}`;
