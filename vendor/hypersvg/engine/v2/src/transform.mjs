// SVG transforms as 2D matrices [a, b, c, d, e, f]: the identity, their product, and parseTransform (a transform
// attribute's text to one matrix). Plain ES module; no DOM. Shared by the drawing (src/drawing.mjs) and the logic's
// art-size limits (src/limits-runtime.mjs), so the logic never imports the drawing.
export const IDENTITY = [1, 0, 0, 1, 0, 0];
export const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
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
