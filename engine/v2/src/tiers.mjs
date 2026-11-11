// Content tiers (7.9), and the give-way rules' steps (8.4): the core's part. Plain functions: no DOM and no engine.
// The drawing chooses each block's tier and wording with these (drawing.mjs); a baked page shows the packer's ladder
// result with them. The give-way ladder at play is the ladder capability's (ladder.mjs, D18). The ladder's step
// order (runLadder) is here too: fit's plan steps run it as well.
//
// Tiers (7.9)
// - A tier is a depth of content: short, medium or rich. A field's `tier` is the smallest tier in which it shows
//   (default short). A tier object gives one wording per tier.
// - The tier is chosen by a content axis entry: by `space` (the first `tiers` entry whose shape holds the space; an
//   entry without a shape is the last resort), by `input` (the value the entry names), or by `person` or `host` (the
//   entry's `default`, else rich). With no content axis, the tier is rich (the format sets no thresholds).
// - With a tier chosen, a field uses its wording for that tier; else the nearest longer one given; else the nearest
//   shorter one. Nothing is ever invented or cut.
import { inRange, rangeOf } from './layout.mjs';

export const TIERS = ['short', 'medium', 'rich'];
export const tierRank = (t) => TIERS.indexOf(t);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// A tier object (7.9): a non-empty object whose keys are all tier names.
export function isTierObject(v) {
  if (!isObj(v)) return false;
  const keys = Object.keys(v);
  return keys.length > 0 && keys.every(k => TIERS.includes(k));
}

// The wording of a tier object for a tier: the tier's own, else the nearest longer given, else the nearest shorter.
// Anything else is returned as it is.
export function wordingAt(v, tier) {
  if (!isTierObject(v)) return v;
  return v[TIERS[sourceTier(v, tier)]];
}
// The index of the tier whose wording stands for a tier: its own, else the nearest longer, else the nearest shorter.
function sourceTier(v, tier) {
  const r = Math.max(0, tierRank(tier));
  for (let i = r; i < TIERS.length; i++) if (TIERS[i] in v) return i;
  for (let i = r - 1; i >= 0; i--) if (TIERS[i] in v) return i;
  return -1;
}

// The wordings the `short` step may use, longest first: the tier's wording, then each shorter authored wording that
// differs from the one before it. Empty wordings are left out: leaving a field out is the `remove` step.
export function wordingsDown(v, tier) {
  if (!isTierObject(v)) return [v];
  const s = sourceTier(v, tier);
  const out = [v[TIERS[s]]];
  for (let i = s - 1; i >= 0; i--) {
    const w = v[TIERS[i]];
    if (w === undefined || w === '' || w === out[out.length - 1]) continue;
    out.push(w);
  }
  return out;
}

// Does a field show at a tier? A field shows from its own tier up; required fields are short.
export function fieldShown(decl, tier) {
  const own = decl && decl.required !== false ? 'short' : (decl?.tier ?? 'short');
  return tierRank(own) <= tierRank(tier);
}

// The content axis entry that picks tiers for a block: the innermost entry on the content axis with no subject that
// has `tiers` or a selector. docs: innermost first (the block, then the scene, then the experience).
export function tierEntry(docs) {
  for (const d of docs) for (const a of d?.axes || []) {
    if (!isObj(a) || a.axis !== 'content' || a.subject !== undefined) continue;
    if (Array.isArray(a.tiers) || a.select === 'input') return a; // one content selector: space or input
  }
  return null;
}

// Chooses the tier. entry: tierEntry(); space: {width, height} in CSS pixels, or null; maps: shape maps (layout.mjs);
// valueOf(name): the value an input selector names. Returns {tier, why}: why is space, input, default or none.
export function chooseTier(entry, { space = null, maps = [], valueOf = () => undefined } = {}) {
  if (!entry) return { tier: 'rich', why: 'none' };
  const fallback = TIERS.includes(entry.default) ? entry.default : 'rich';
  const select = entry.select ?? 'space';
  if (select === 'input') {
    const v = valueOf(entry.value);
    return TIERS.includes(v) ? { tier: v, why: 'input' } : { tier: fallback, why: 'default' };
  }
  if (select === 'space' && Array.isArray(entry.tiers)) {
    if (space) for (const t of entry.tiers) if (t?.shape !== undefined && inRange(rangeOf(t.shape, maps), space)) return { tier: t.tier, why: 'space' };
    const last = entry.tiers.find(t => t && t.shape === undefined);
    if (last) return { tier: last.tier, why: 'space' };
  }
  return { tier: fallback, why: 'default' };
}

// ---------- steps (8.4) ----------
export const STEPS = ['short', 'wrap', 'one-line', 'shrink', 'ellipsis', 'column', 'crop', 'minimum-share', 'mark-only', 'simplify', 'remove'];
// Which steps a rule kind may list (8.4). Any other pairing is E-RULE.
export const STEPS_BY_KIND = {
  fits: ['short', 'wrap', 'one-line', 'shrink', 'ellipsis', 'remove'],
  limit: ['short', 'wrap', 'one-line', 'shrink', 'ellipsis', 'remove'],
  keep: ['shrink', 'mark-only', 'simplify'],
  inside: ['column', 'crop', 'minimum-share', 'shrink'],
  relation: ['column', 'crop', 'minimum-share', 'shrink'],
  clear: [], 'reading-order': [], intrinsic: [],
};
// The steps a text binding's fit may list (7.6): the text steps of fits. Trying the next layout is not a step: the
// player always tries the layouts in list order first (7.4).
export const FIT_STEPS = [...STEPS_BY_KIND.fits];
export const DEFAULT_FIT_STEPS = ['short', 'wrap', 'shrink'];

// The steps of a rule its kind may not use: [{step, index}].
export function badSteps(rule) {
  const allowed = STEPS_BY_KIND[rule?.kind];
  if (!allowed || !Array.isArray(rule.steps)) return [];
  return rule.steps.map((step, index) => ({ step, index })).filter(x => STEPS.includes(x.step) && !allowed.includes(x.step));
}

// The give-way rules of some documents, in written order (outer documents first).
export function giveWayRules(docs) {
  const out = [];
  for (const d of docs) for (const r of Array.isArray(d?.rules) ? d.rules : []) if (isObj(r) && r.strength === 'give-way' && Array.isArray(r.steps)) out.push(r);
  return out;
}

// The ladder's step order (8.4). In the core because two capabilities run it: the ladder (its texts, ladder-draw.mjs)
// and fit (a plan's steps, plan.mjs); the packer runs it when it bakes.
// Lowest priority first; at equal priority, written order (a stable sort).
export function ladderOrder(rules) {
  const p = (r) => (typeof r.priority === 'number' ? r.priority : 0.5);
  return rules.map((r, i) => [r, i]).sort((a, b) => p(a[0]) - p(b[0]) || a[1] - b[1]).map(x => x[0]);
}

// Runs the ladder. rules: give-way rules; holds(rule) -> boolean; apply(rule, step) -> true when the step moved
// something (it never passes a floor); related(a, b): whether rule a's steps can help rule b.
// Returns {outcome, used: [{rule, step, times}], moves}: outcome is unchanged (every rule held at once), reduced
// (steps were taken and every rule holds) or incomplete (a rule still fails at its floor, or the search ran out).
export function runLadder(rules, { holds, apply, related = () => false, maxMoves = 512 } = {}) {
  const used = [];
  let moves = 0;
  const failing = () => rules.filter(r => !holds(r));
  if (!failing().length) return { outcome: 'unchanged', used, moves };
  for (const r of ladderOrder(rules)) {
    for (const step of r.steps) {
      for (;;) {
        const bad = failing();
        if (!bad.length) return { outcome: 'reduced', used, moves };
        if (!bad.some(x => x === r || related(r, x))) break;
        if (moves >= maxMoves) return { outcome: 'incomplete', used, moves, ranOut: true };
        if (!apply(r, step)) break;
        moves++;
        const last = used[used.length - 1];
        if (last && last.rule === r.id && last.step === step) last.times++; else used.push({ rule: r.id, step, times: 1 });
      }
    }
  }
  return { outcome: failing().length ? 'incomplete' : 'reduced', used, moves };
}
