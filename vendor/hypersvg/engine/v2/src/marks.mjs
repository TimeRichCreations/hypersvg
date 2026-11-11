// What the final drawing marks say (6.1, D33): a role's words, a box mark, a protected area. The player and the checker
// read the marks through these, so a side or a protected-area word never reads as a role.
export const SIDES = ['left', 'right', 'near', 'far'];
export const KEEPS = ['keep-inside', 'keep-clear', 'keep-empty'];
const words = (a) => String(a?.['data-hsvg-role'] ?? '').split(/\s+/).filter(Boolean);
// The role word of a part (its job): data-hsvg-role without its side and protected-area words; null when none.
export const roleOf = (a) => words(a).find(w => !SIDES.includes(w) && !KEEPS.includes(w)) ?? null;
export const sideOf = (a) => words(a).find(w => SIDES.includes(w)) ?? null;
// A protected area's words, in one order ('keep-inside keep-clear'), or null.
export const keepOf = (a) => { const w = words(a); const k = KEEPS.filter(x => w.includes(x)); return k.length ? k.join(' ') : null; };
// A box: 'text', 'items' or 'video' (data-hsvg-fit; no value is text, 5.10), 'repeat' (data-hsvg-repeat), else null.
export const boxOf = (a) => (a?.['data-hsvg-fit'] !== undefined ? (a['data-hsvg-fit'] || 'text') : a?.['data-hsvg-repeat'] !== undefined ? 'repeat' : null);
// The tool record (6.6): the one JSON object in the root's <metadata>, as {derived, steps}; {} when there is none.
export function recordOf(root) {
  const m = root?.children?.find(c => c.name === 'metadata');
  try { const j = JSON.parse((m?.children || []).map(c => c.text ?? '').join('')); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch { return {}; }
}
