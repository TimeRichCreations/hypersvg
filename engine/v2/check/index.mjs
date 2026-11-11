// The 2.0 checker (10.12): the schema checks of stage 1, then the cross-file rules that no single file shows.
// Each rule family is one module with check(ctx); ctx gives the loaded experience and report(code, file, path, msg).
// A code must be in spec/2.0/errors.json. Families: refs.mjs (references and ids), story.mjs (story graph, needs and
// grants), resources.mjs (resource sizes against the limits, 2.6, 9.8.1), formula/ (names, types and ranges of formulas,
// 5.1.3, 5.6), rules/ (the rules of section 8 that files can prove) and budgets.mjs (counted limits per block, and
// budget rules with the host profile opts.host, A10.3; its results are returned as budgets), paths.mjs (E-PATH, drawing
// owners, unused files), drawing-rules.mjs (accessibility owned by the player, names, roles), structure.mjs (key conflicts,
// nested repeats, shell starts, waiver reasons, words), packages.mjs (package members and digests, hook marks) and
// ai.mjs (the AI flow rule, E-AI-FLOW, A5.1) and frames.mjs (frame sizes, shape names, initial values, 6.6, 7.4, 5.1) and roles.mjs (role schemas, E-ROLE-SCHEMA, 6.3) and writers.mjs (one writer per channel, E-WRITER, 9.3) and flow.mjs (words that decide, E-WORDS-DECIDE, 5.8; human-only paths, W-HUMAN-ONLY-PATH, 5.15.4) and words.mjs (row cells and word templates, E-WORDS, 2.7) and paint.mjs (painted extent, E-PAINT, W-PAINT-OVER, E-WIDGET-PAINT, 6.4, A6.1) and actions.mjs (a refinement of the loader's findings on actions and character seats) and motion.mjs (the motion
// channels' routes, paths and paints, and the points binding's places, 6.7, 6.8) and kits.mjs (kit
// pins, versions, seals, rights, kit roles and theme roles, 4.6 to 4.9, 7.7) and page.mjs (page hooks,
// signals and page actions against the grants, A3) and media.mjs (video resources, places, bindings, markers and media
// actions, A2.1) and modules.mjs (module calls, exact versions and pins against the reviewed lock, 10.7, A9.3) and
// plans.mjs (layout plans: limits, shares, items, root places and item boxes, 7.5) and stage.mjs (size binding targets,
// 6.8, 5.10; input selectors, E-AXIS-INPUT, 7.1) and tiers.mjs (give-way steps in text fits, 7.6, 8.4) and richtext.mjs
// (runs, text styles, richText fields and linked text parts, 6.8.1, 5.3.1, 7.7) and lines.mjs (spoken lines: word and
// cue times, voices, the mouth, line fields and the captions rule, 6.11, 8.9) and seats.mjs (player seats: inputs,
// views, turns, the end, legal lists and programs, A4.1) and addons.mjs (the add-on door: folders, digests, code and
// settings, chapter 12) and review.mjs (review findings files can decide: W-NAME-HIDES-LABEL, W-TEXT-SMALL; only with
// opts.review, check.mjs --review).
import { loadExperience } from '../src/load.mjs';
import * as refs from './refs.mjs';
import * as story from './story.mjs';
import * as resources from './resources.mjs';
import * as formula from './formula/index.mjs';
import * as rules from './rules/index.mjs';
import * as values from './rules/values.mjs';
import * as filters from './filters.mjs';
import * as budgets from './budgets.mjs';
import * as paths from './paths.mjs';
import * as drawingRules from './drawing-rules.mjs';
import * as structure from './structure.mjs';
import * as packages from './packages.mjs';
import * as frames from './frames.mjs';
import * as roles from './roles.mjs';
import * as writers from './writers.mjs';
import * as flow from './flow.mjs';
import * as words from './words.mjs';
import * as paint from './paint.mjs';
import * as motion from './motion.mjs';
import * as kits from './kits.mjs';
import * as page from './page.mjs';
import * as media from './media.mjs';
import * as modules from './modules.mjs';
import * as plans from './plans.mjs';
import * as stage from './stage.mjs';
import * as tiers from './tiers.mjs';
import * as seats from './seats.mjs';
import * as live from './live.mjs';
import * as addons from './addons.mjs';
import { refinePocketDiags } from './addons.mjs';
import * as places from './places.mjs';
import * as pivots from './pivots.mjs';
import { namePresets } from '../src/addons.mjs';
import { refineActionDiags } from './actions.mjs';
import { refineRenamed, refineAddonWords } from './renamed.mjs';
import { optional } from './optional.mjs';
import { absentAddons } from './absent.mjs';
import * as cycles from './cycles.mjs';
import * as sliders from './sliders.mjs';
import * as review from './review.mjs';
import * as lookalikes from './lookalikes.mjs';

// The checker families of built-in add-ons (the AI flow, rich text, spoken lines) come with the add-ons' code: in the
// core release they are absent, and an experience that needs one gets absentAddons' finding instead.
const at = (f) => new URL(f, import.meta.url).href;
const ai = await optional(at('./ai.mjs'));
const richtext = await optional(at('./richtext.mjs'));
const lines = await optional(at('./lines.mjs'));

export const families = Object.fromEntries(Object.entries({ refs, story, resources, formula, rules, values, filters, budgets, paths, drawingRules, structure, packages, ai, frames, roles, writers, flow, words, paint, motion, kits, page, media, modules, plans, stage, tiers, richtext, lines, seats, live, addons, places, pivots, cycles, sliders, lookalikes, review }).filter(([, f]) => f));

// source: {read(rel) -> string | null}; schemas: the spec's schemas. Returns {ok, diags, experience}.
export function checkExperience(source, schemas, opts = {}) {
  const loaded = loadExperience(source, schemas, opts);
  // Old words (D33): E-WORD-RENAMED names the final form, and nothing more is checked until they are rewritten.
  const renamed = refineRenamed([...loaded.diags], loaded.experience);
  const diags = refineAddonWords(refinePocketDiags(refineActionDiags(renamed.diags, loaded.experience, schemas)), loaded.experience);
  if (!loaded.experience) return { ok: false, diags, experience: null };
  if (renamed.found) return { ok: false, diags, experience: loaded.experience, budgets: [] };
  // A known add-on whose code this release does not hold (the core release, D30): one warning per need. Its words are
  // accepted by name (absent.mjs) and everything else is checked; pack.mjs refuses to pack it.
  diags.push(...absentAddons(loaded.experience));
  const report = (code, file, path, message) => diags.push({ file, code, path, message });
  const ctx = { experience: loaded.experience, source, report, host: opts.host ?? null, strictPaint: opts.paint === true, opts };
  for (const [name, fam] of Object.entries(families)) {
    if (opts.only && !opts.only.includes(name)) continue;
    // The review findings (review.mjs) run when asked (check.mjs --review, test.mjs) or named in `only`: many
    // folders that check clean today would gain them.
    if (name === 'review' && opts.review !== true && !opts.only?.includes('review')) continue;
    fam.check(ctx);
  }
  // A finding about what a preset added names the preset (D23, chapter 12).
  const named = namePresets(diags, loaded.experience.presetOrigins);
  return { ok: named.length === 0, diags: named, experience: loaded.experience, budgets: ctx.budgets ?? [] };
}
