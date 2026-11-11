// The core paint channels (6.7, D28): fill, stroke, stroke-width and dash, in clip tracks and channel bindings.
// - fill, stroke: #rrggbb colours; keys blend red, green and blue in sRGB, rounded to whole numbers.
// - stroke-width: a number in drawing coordinates, written as it is.
// - dash: the drawn share 0..1 of a stroked shape that carries pathLength="1", from a start 0..1. The dash pattern has
//   period 1, so on a closed shape a dash past the end goes on from the beginning (a donut ring, a gauge arc).
const fmt = (v) => String(Math.round(v * 1e6) / 1e6);
const HEX = /^#[0-9a-fA-F]{6}$/;
export const isHex = (s) => typeof s === 'string' && HEX.test(s);
// a and b are #rrggbb; x is 0..1 (an easing may overshoot: each component is clamped to 0..255).
export function blendHex(a, b, x) {
  const c = (s, i) => parseInt(s.slice(1 + 2 * i, 3 + 2 * i), 16);
  const h = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${[0, 1, 2].map(i => h(c(a, i) + (c(b, i) - c(a, i)) * x)).join('')}`;
}
// Blends two key values of a colour channel.
export function mixColour(channel, a, b, x) {
  if (!isHex(a) || !isHex(b)) { const e = new Error(`a ${channel} key is not a #rrggbb colour: ${JSON.stringify(isHex(a) ? b : a)}`); e.code = 'E-TYPE'; throw e; }
  return blendHex(a, b, x);
}
// The stroke-dasharray and stroke-dashoffset of a drawn share v from start s, both clamped to 0..1, with pathLength 1.
export function dashOf(v, s = 0) {
  const share = Math.max(0, Math.min(1, v)); const from = Math.max(0, Math.min(1, s));
  // A share of 0 hides the part, whatever its caps (round caps draw a dot for a zero-length dash).
  return { array: `${fmt(share)} ${fmt(1 - share)}`, offset: fmt(from ? -from : 0), ...(share === 0 ? { hidden: true } : {}) };
}
