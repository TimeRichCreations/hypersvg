// The give-way ladder (8.4) and its text steps, with content tiers (7.9, tiers.mjs, re-exported here). Plain
// functions: no DOM and no engine. The ladder capability's drawing part (ladder-draw.mjs) calls them while playing; a
// baking tool calls the same ones with its own measurer, so a live output and a baked one at the same size are the
// same. The core imports only tiers.mjs.
//
// Tiers (7.9)
// - A tier is a depth of content: short, medium or rich. A field's `tier` is the smallest tier in which it shows
//   (default short). A tier object gives one wording per tier.
// - The tier is chosen by a content axis entry: by `space` (the first `tiers` entry whose shape holds the space; an
//   entry without a shape is the last resort), by `input` (the value the entry names), or by `person` or `host` (the
//   entry's `default`, else rich). With no content axis, the tier is rich (the format sets no thresholds).
// - With a tier chosen, a field uses its wording for that tier; else the nearest longer one given; else the nearest
//   shorter one. Nothing is ever invented or cut.
//
// The ladder (8.4)
// - Give-way rules run lowest priority first; at equal priority, the rule written first goes first. A rule uses up
//   its steps, in order, before the next rule takes its first step. The ladder stops as soon as every rule holds.
// - A step of a rule is taken only while that rule does not hold, or while it shares space with a rule that does not
//   hold (`related`; a layout plan's solver says which rules share space). Rules in fixed regions share nothing.
// - A step that cannot move (no shorter wording, no smaller size above the floor) passes to the next step.
// - The search is bounded (maxMoves). Running out leaves the output incomplete.
import { TIERS, tierRank, isTierObject, wordingAt, wordingsDown, fieldShown, tierEntry, chooseTier, STEPS, STEPS_BY_KIND, FIT_STEPS, DEFAULT_FIT_STEPS, badSteps, giveWayRules, ladderOrder, runLadder } from './tiers.mjs';
import { fontSizes, breakLines } from './fit.mjs';
export { TIERS, tierRank, isTierObject, wordingAt, wordingsDown, fieldShown, tierEntry, chooseTier, STEPS, STEPS_BY_KIND, FIT_STEPS, DEFAULT_FIT_STEPS, badSteps, giveWayRules, ladderOrder, runLadder };

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// ---------- floors (8.4, 7.6 rule 3) ----------
// The readable floor in CSS pixels for a text with a role: the strictest of the host's readable value (the baseline
// pack's "host", 12 when the host gives none) and every readable rule of the documents (minTextPx and byRole).
export function readableFloor(docs, role, hostReadable = 12) {
  let px = typeof hostReadable === 'number' ? hostReadable : 12;
  const val = (v) => (v === 'host' ? hostReadable : v);
  for (const d of docs) for (const r of Array.isArray(d?.rules) ? d.rules : []) {
    if (!isObj(r) || r.kind !== 'readable' || r.strength === 'should') continue;
    const a = val(r.minTextPx); if (typeof a === 'number') px = Math.max(px, a);
    const b = role && isObj(r.byRole) ? val(r.byRole[role]) : undefined; if (typeof b === 'number') px = Math.max(px, b);
  }
  return px;
}
// A give-way rule's text floor in CSS pixels: its own minTextPx, never below the readable floor.
export function textFloor(rule, readablePx) {
  const own = typeof rule?.floor?.minTextPx === 'number' ? rule.floor.minTextPx : 0;
  return Math.max(own, readablePx || 0);
}
// Whether a rule's floor forbids removing its subject.
export const keepsSubject = (rule) => rule?.floor?.keep === true || rule?.kind === 'keep';

// ---------- the give-way ladder's text steps (8.4) ----------
// A text under a give-way rule is laid out step by step instead of by searchFit. Its state says which authored
// wording shows, how many lines are allowed, which size, and whether it is on one line, ends in an ellipsis or is
// left out. Each step moves the state once; the ladder (ladder.mjs) decides which step comes next.
// - Lines: with `wrap` in the rule's steps, the text starts on as many lines as its own line feeds give, and `wrap`
//   adds one line at a time up to maxLines. Without `wrap`, the text wraps up to maxLines from the start, as a fit
//   does (7.6). So steps of only wrap and shrink end where searchFit ends, in either order.
// - Sizes: the font search of rule 2, from fontPx down to the larger of minFontPx and the floor (in drawing units).
// - ellipsis cuts after a whole word and adds "…"; the full text stays the accessible name. remove leaves an optional
//   text out. one-line joins the lines.
// textStart({wordings, fit, drawnPx, floorUnits, optional, steps}) -> state.
export function textStart({ wordings, fit, drawnPx, floorUnits = 0, optional = false, steps = [] }) {
  const top = Math.floor(fit.fontPx ?? drawnPx);
  const low = Math.max(Math.ceil(fit.minFontPx), Math.ceil(floorUnits - 1e-9));
  const sizes = low >= top ? [top] : fontSizes(top, low);
  const maxLines = fit.maxLines ?? 1;
  const wrap = fit.wrap ?? 'words';
  const own = String(wordings[0] ?? '').split('\n').length;
  const lines = wrap !== 'none' && steps.includes('wrap') ? Math.max(1, Math.min(own, maxLines)) : maxLines;
  return { wordings: wordings.map(w => String(w ?? '')), wi: 0, sizes, si: 0, lines, maxLines, wrap, lh: fit.lineHeight ?? 1.2, oneLine: false, ellipsis: false, removed: false, optional, floor: low };
}

// One step on a text state: the next state, or null when the step cannot move.
export function textStep(st, step) {
  switch (step) {
    case 'short': return st.wi + 1 < st.wordings.length ? { ...st, wi: st.wi + 1 } : null;
    case 'wrap': return st.wrap !== 'none' && !st.oneLine && st.lines < st.maxLines ? { ...st, lines: st.lines + 1 } : null;
    case 'one-line': return st.oneLine ? null : { ...st, oneLine: true, lines: 1 };
    case 'shrink': return st.si + 1 < st.sizes.length ? { ...st, si: st.si + 1 } : null;
    case 'ellipsis': return st.ellipsis ? null : { ...st, ellipsis: true };
    case 'remove': return st.optional && !st.removed ? { ...st, removed: true } : null;
  }
  return null;
}

// Lays out a text state. measure(px) -> (s) -> width; room: the region's width less 2%; height: its height.
// lineEm: the height of one line's font box in em that must fit (1 at play, where the drawing then moves the ink
// inside the region; the bake, measuring with the estimate, passes the whole line box, BAKE_LINE_EM).
// Returns {px, lines, text, full, fits, removed}.
export const BAKE_LINE_EM = 1.2;
export function textLayout(st, measure, room, height, lineEm = 1) {
  const px = st.sizes[st.si];
  const full = st.wordings[st.wi];
  if (st.removed) return { px, lines: [], text: '', full, fits: true, removed: true };
  const text = st.oneLine ? full.replace(/\s*\n\s*/g, ' ') : full;
  const mm = measure(px);
  // A size below the floor never fits (8.4): a text drawn smaller than its floor takes its steps (remove, if optional).
  const ok = (lines) => !(px < (st.floor ?? 0) - 1e-9) && lines.length <= st.lines && px * (lineEm + (lines.length - 1) * st.lh) <= height + 0.01 && lines.every(l => mm(l) <= room);
  const lay = (t) => breakLines(t, st.oneLine || st.wrap === 'none' ? 'none' : 'words', mm, room);
  const lines = lay(text);
  if (ok(lines)) return { px, lines, text, full, fits: true, removed: false };
  if (st.ellipsis) {
    const words = text.split(/(\s+)/);
    for (let n = words.length - 1; n > 0; n--) {
      const cut = words.slice(0, n).join('').trimEnd();
      if (!cut || cut === text) continue;
      const l = lay(`${cut}…`);
      if (ok(l)) return { px, lines: l, text: `${cut}…`, full, fits: true, removed: false, ellipsis: true };
    }
  }
  return { px, lines, text, full, fits: false, removed: false };
}
