// The certificate: what the explorer showed about one packed page, with its evidence and what it could not show.
// It is a proof-certificate/2.0 document with an A8.1 play-test receipt inside. Property results are pass,
// pass-observed (true on the paths explored), fail, unknown, measured or not-applicable. A missing proof never
// becomes a pass.
import { FORMAT, activeLimits } from '../../src/limits.mjs';
import { CERTIFICATE, digestOf } from './format.mjs';

// Scenes that story links reach from the start, guards ignored (3.1).
export function linkReachable(story) {
  if (!story?.start) return new Set();
  const seen = new Set([story.start]); const todo = [story.start];
  while (todo.length) { const s = todo.pop(); for (const l of story.links) if (l.from === s && !seen.has(l.to)) { seen.add(l.to); todo.push(l.to); } }
  return seen;
}

export function unreachedScenes(story, reached, stopped) {
  if (!story) return [];
  const linked = linkReachable(story);
  return story.scenes.filter(s => !reached.includes(s)).map((scene) => {
    const into = story.links.filter(l => l.to === scene);
    if (!linked.has(scene)) return { scene, why: 'no story link leads to it from the start' };
    const from = into.map(l => `${l.from}${l.on ? ` on ${l.on}` : l.afterMs !== null ? ` after ${l.afterMs} ms` : l.choice ? ' (choice)' : ''}${reached.includes(l.from) ? '' : ' (not reached)'}`).join('; ');
    if (stopped) return { scene, why: `not reached before the ${stopped} budget ran out; links in: ${from}` };
    return { scene, why: `the explored inputs never caused the link; links in: ${from}. It may need text entry, a slider value, a long order of moves or timing the explorer does not try` };
  });
}

// Declared controls never on screen (B4 finding 9), each with why: in a dialog slot (settings), drawn only in some
// layouts (other layouts), its scene never reached, or its scene reached but the control never shown (hidden by a
// binding or a state on the paths explored). places: build.places (build.mjs controlPlaces).
export const NEVER_SEEN = Object.freeze({
  dialog: 'in a dialog slot (settings); shown only while the dialog is open',
  'other-layouts': 'drawn only in other layouts than the one shown at this viewport',
  'scene-not-reached': 'its scene was not reached on the paths explored',
  'not-shown': 'its scene was reached, but the control was never shown and usable there (a binding or state hides it)',
  unplaced: 'not a scene or shell control (a component use); its place is not read',
});
export function neverSeenBy(keys, places = {}, story = null, reached = []) {
  const out = Object.fromEntries(Object.keys(NEVER_SEEN).map(k => [k, []]));
  for (const key of keys) {
    const addr = key.slice(0, key.indexOf('#'));
    const at = places[key];
    const reason = !at ? 'unplaced' : at.dialog ? 'dialog' : !at.all ? 'other-layouts'
      : story?.scenes?.includes(addr) && !reached.includes(addr) ? 'scene-not-reached' : 'not-shown';
    out[reason].push(at?.dialog ? `${key} (${at.dialog})` : !at?.all && at ? `${key} (${at.layouts.join(', ')})` : key);
  }
  for (const k of Object.keys(out)) if (!out[k].length) delete out[k];
  return out;
}

// The budgets: what the page measured against the limits (9.8, 10.11) the experience runs under.
export function budgets(build, exploration, raised = {}) {
  const limits = activeLimits(raised);
  const m = exploration.measures;
  const rows = [
    { limit: 'mountedElements', observed: m.elements, max: limits.mountedElements, what: 'elements in the stage, the most seen' },
    { limit: 'mountDepth', observed: m.depth, max: limits.mountDepth, what: 'block address depth, the most seen' },
    { limit: 'liveBlockUses', observed: Math.max(0, m.blocks - 1), max: limits.liveBlockUses, what: 'mounted blocks other than the experience, the most seen (an upper bound on live uses)' },
    { limit: 'liveTimers', observed: m.timers, max: limits.liveTimers, what: 'pending deadlines, the most seen after a step' },
    { limit: 'savedBytes', observed: m.savedBytes, max: limits.savedBytes, what: 'localStorage bytes of the page, the most seen' },
    { limit: 'sessionBytes', observed: m.sessionBytes, max: limits.sessionBytes, what: 'sessionStorage bytes of the page, the most seen' },
    { limit: 'coreBundleBytes', observed: build.bundle.core.gzip9, max: FORMAT.coreBundleBytes, what: 'the core player: gzip 9 of the bundle without capabilities' },
    ...build.bundle.capabilities.map(c => ({ limit: 'capabilityBundleBytes', capability: c.id, observed: c.gzip9, max: FORMAT.capabilityBundleBytes, what: `the ${c.id} module: gzip 9 of the bundle with it, less without it` })),
    ...(build.bundle.modules || []).map(c => ({ limit: 'capabilityBundleBytes', module: c.id, observed: c.gzip9, max: FORMAT.capabilityBundleBytes, what: `the logic module ${c.id}: gzip 9 of the bundle with it, less without it (10.11)` })),
  ];
  for (const r of rows) r.result = r.observed > r.max ? 'fail' : 'pass';
  return {
    result: rows.some(r => r.result === 'fail') ? 'fail' : exploration.startError ? 'unknown' : 'pass-observed',
    packed: build.size, core: build.bundle.core, capabilities: build.bundle.capabilities.map(c => c.id), needs: build.package.needs,
    rows, sceneElements: exploration.sceneElements,
  };
}

const UNKNOWNS = [
  'Bounded observation, not exhaustive proof: a state is the scene, the declared values and the usable controls. Hidden timers, motion, effects and capability state are not part of it.',
  'One viewport, reduced motion on, empty storage and the authored seeds were tested. Other sizes, saved state, seeds and input timings are not.',
  'Network evidence covers the paths explored, with every outside request blocked; it is not a static proof of every path.',
  'Keyboard evidence means each control was reached by Tab and used once. It is not screen-reader quality, contrast or focus order review. A slider was moved one step; a drag was tried on each drop.',
  'Text entry, AI answers from a host source and page signals are not explored.',
];

export function certify(build, exploration, { raised = build.raised || {}, date = new Date().toISOString().replace(/\.\d+Z$/, 'Z') } = {}) {
  const e = exploration;
  const story = build.story;
  const failed = !!e.startError;
  // Finishable: a keyboard path reached an ending, and its recorded trace reached it again.
  const ending = e.traces.find(t => t.why === 'ending' && t.reached === t.scene);
  const finishable = story?.endless ? { result: 'not-applicable', meaning: 'the experience declares itself endless (3.1)' }
    : failed ? { result: 'fail', meaning: 'the page did not start' }
    : !story?.ends?.length ? { result: 'unknown', meaning: 'the story declares no ending scene' }
    : ending ? { result: 'pass', meaning: 'an ending scene was reached by keyboard alone', ending: ending.scene, inputs: ending.trace.acts.length }
    : { result: 'unknown', meaning: 'no ending scene was reached within the budgets' };
  // Keyboard: every control seen was used by keyboard alone.
  const seen = e.controls.filter(c => c.reached && c.enabled);
  const noKeys = seen.filter(c => !c.keyboard).map(c => c.key);
  const keyboard = { result: failed ? 'fail' : noKeys.length ? 'unknown' : 'pass', used: seen.length - noKeys.length, seen: seen.length, missing: noKeys,
    neverSeen: e.controls.filter(c => !c.reached).map(c => c.key),
    neverSeenBy: neverSeenBy(e.controls.filter(c => !c.reached).map(c => c.key), build.places, story, e.scenes), neverEnabled: e.controls.filter(c => c.reached && !c.enabled).map(c => c.key) };
  const pointerFails = e.controls.filter(c => c.pointer?.failed).map(c => ({ control: c.key, reason: c.pointer.failed }));
  const pointerMissing = e.controls.filter(c => c.keyboard && (!c.pointer || c.pointer.skipped)).map(c => c.key);
  const pointer = { result: failed ? 'fail' : pointerFails.length ? 'fail' : pointerMissing.length ? 'unknown' : 'pass', used: e.controls.filter(c => c.pointer && !c.pointer.failed && !c.pointer.skipped).length, failures: pointerFails, missing: pointerMissing };
  const unreached = unreachedScenes(story, e.scenes, e.stopped);
  const scenes = { result: failed ? 'fail' : unreached.length ? 'unknown' : 'pass', reached: e.scenes, unreached };
  const network = { result: e.network.length ? 'fail' : 'pass-observed', attempts: e.network, csp: build.csp };
  const errors = { result: e.errors.length || failed ? 'fail' : 'pass-observed', errors: [...new Set(failed ? [`start: ${e.startError}`, ...e.errors] : e.errors)] };
  const replays = e.traces.map(t => ({ why: t.why, scene: t.scene, inputs: t.trace.acts.length, pass: t.replay.pass, differences: t.replay.differences }));
  const replay = { result: failed ? 'fail' : !replays.length ? 'unknown' : replays.every(r => r.pass) ? 'pass' : 'fail', traces: replays };
  const budget = budgets(build, e, raised);
  const properties = { finishable, keyboard, pointer, scenes, network, errors, budgets: budget, replay };

  const unknowns = [...UNKNOWNS];
  if (e.stopped) unknowns.push(`The ${e.stopped} budget ran out with ${e.pendingStates} states not expanded.`);
  if (e.pointerStopped) unknowns.push(`The pointer pass stopped on its ${e.pointerStopped} budget.`);
  if (unreached.length) unknowns.push(`${unreached.length} of ${story.scenes.length} scenes were not reached; each is listed with why.`);
  if (noKeys.length) unknowns.push(`${noKeys.length} controls were seen but have no keyboard use witness.`);
  if (e.failures.length) unknowns.push(`${e.failures.length} attempted inputs failed or showed no effect; they are listed in failures.`);
  if (build.findings.length) unknowns.push(`The page was packed with accepted checker findings: ${[...new Set(build.findings)].join(', ')}.`);

  const toRule = (name, p) => ({ rule: `proof/${name}`, result: p.result === 'fail' ? 'fail' : p.result === 'unknown' ? 'not-run' : p.result === 'not-applicable' ? 'waived' : 'pass', proof: 'playing',
    ...(p.result === 'pass-observed' ? { detail: 'observed on the explored paths' } : p.result === 'unknown' ? { detail: 'not proved within the budgets' } : p.result === 'not-applicable' ? { detail: p.meaning } : {}) });
  const rules = Object.entries(properties).map(([k, p]) => toRule(k, p));
  const status = rules.some(r => r.result === 'fail') ? 'fail' : rules.some(r => r.result === 'not-run') ? 'incomplete' : 'pass';
  const evidence = digestOf(exploration);
  return {
    format: CERTIFICATE,
    product: build.product, fingerprint: build.fingerprint, package: build.package,
    policy: { start: e.start, ...e.policy },
    explored: { mode: e.mode, steps: e.steps, stoppedBy: e.stopped, pendingStates: e.pendingStates, states: e.states.length, edges: e.edges.length, pointerSteps: e.pointerSteps, ms: e.ms },
    status, properties, unknowns,
    failures: e.failures,
    witnesses: { ending: ending ? ending.trace.acts : null },
    receipt: {
      format: 'hsvg/2.0', kind: 'receipt', id: `${build.product.id}-proof`, run: 'play-test', subject: `document:${build.product.id}`,
      digest: build.fingerprint, date, status, rules,
      authority: { player: 'engine/v2', profile: 'packed page', measurer: 'engine/v2/tools/proof' },
    },
    evidenceHash: evidence,
  };
}

// The engine's sizes against their limits (10.11): the core, then each capability module, gzip 9.
const sizes = (b) => b.rows.filter(r => r.limit === 'coreBundleBytes' || r.limit === 'capabilityBundleBytes')
  .map(r => `${r.capability ?? r.module ?? 'core'} ${r.observed} of ${r.max}${r.result === 'fail' ? ' (over)' : ''}`).join(', ');
const mark = (r) => ({ pass: 'pass', 'pass-observed': 'pass (observed)', fail: '**FAIL**', unknown: 'unknown', 'not-applicable': 'not applicable', measured: 'measured' }[r] || r);
export function markdown(c) {
  const p = c.properties;
  const lines = [
    `# ${c.product.title} (${c.product.id})`, '',
    `Folder \`${c.product.folder}\`. Packed page \`${c.fingerprint.slice(0, 23)}…\`, ${p.budgets.packed.raw} bytes (gzip 9: ${p.budgets.packed.gzip9}).`,
    `Status: **${c.status}**. Explored ${c.explored.states} states in ${c.explored.steps} keyboard steps and ${c.explored.pointerSteps} pointer steps${c.explored.stoppedBy ? `; stopped by the ${c.explored.stoppedBy} budget` : '; the frontier drained'}.`, '',
    '| Property | Result | Evidence |', '|---|---|---|',
    ...(p.packs ? [`| Packs | **FAIL** | ${p.packs.reason}: ${p.packs.findings.join('; ')} |`] : []),
    `| Finishable | ${mark(p.finishable.result)} | ${p.finishable.meaning}${p.finishable.ending ? ` (${p.finishable.ending}, ${p.finishable.inputs} inputs)` : ''} |`,
    `| Keyboard | ${mark(p.keyboard.result)} | ${p.keyboard.used} of ${p.keyboard.seen} controls used by keyboard alone${p.keyboard.neverSeen.length ? `; ${p.keyboard.neverSeen.length} declared controls never shown` : ''} |`,
    `| Pointer | ${mark(p.pointer.result)} | ${p.pointer.used} controls used by the pointer${p.pointer.failures.length ? `; ${p.pointer.failures.length} failed` : ''}${p.pointer.missing.length ? `; ${p.pointer.missing.length} not tried` : ''} |`,
    `| Scenes | ${mark(p.scenes.result)} | ${p.scenes.reached.length} reached${p.scenes.unreached.length ? `, ${p.scenes.unreached.length} not reached` : ''} |`,
    `| Network | ${mark(p.network.result)} | ${p.network.attempts.length} attempts |`,
    `| Page errors | ${mark(p.errors.result)} | ${p.errors.errors.length} errors |`,
    `| Budgets | ${mark(p.budgets.result)} | ${p.budgets.rows.filter(r => r.result === 'fail').length} limits over; ${sizes(p.budgets)} |`,
    `| Replay | ${mark(p.replay.result)} | ${p.replay.traces.map(t => `${t.why} ${t.scene}: ${t.pass ? 'same' : 'differs (' + t.differences.slice(0, 3).join(', ') + ')'}`).join('; ') || 'no trace'} |`,
  ];
  if (p.scenes.unreached.length) lines.push('', 'Scenes not reached:', ...p.scenes.unreached.map(u => `- \`${u.scene}\`: ${u.why}`));
  if (p.errors.errors.length) lines.push('', 'Errors:', ...p.errors.errors.slice(0, 5).map(x => `- ${x.slice(0, 300)}`));
  if (p.pointer.failures.length) lines.push('', 'Pointer failures:', ...p.pointer.failures.slice(0, 8).map(f => `- \`${f.control}\`: ${f.reason}`));
  const by = p.keyboard.neverSeenBy || {};
  if (Object.keys(by).length) lines.push('', 'Declared controls never on screen, by reason:', ...Object.entries(by).map(([r, keys]) => `- ${r} (${keys.length}): ${NEVER_SEEN[r]}. ${keys.slice(0, 6).map(k => `\`${k}\``).join(', ')}${keys.length > 6 ? ` and ${keys.length - 6} more` : ''}`));
  if (p.keyboard.missing.length) lines.push('', 'Controls with no keyboard witness:', ...p.keyboard.missing.slice(0, 12).map(k => `- \`${k}\``));
  lines.push('', 'Unknowns:', ...c.unknowns.map(u => `- ${u}`), '');
  return lines.join('\n');
}
