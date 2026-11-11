// Counted limits and budgets (5.2, 6.9, A1, A10.3), against the experience's limits (the format values, raised where
// it asks, 9.8.1):
// - computed values per block (computedPerBlock), player.attach calls per block (attachActionsPerBlock) and
//   (effects per block, effectsPerBlock, is the effects add-on's: its schema and its engine part);
// - the host profile given to the checker (opts.host, A10.1): its own checks (E-RANGE, E-TYPE, E-RULE);
// - budget rules of the experience, its scenes, shell and blocks, and of the host profile (A10.3): soundBytes,
//   videoBytes and fontBytes are measured on the resource bytes; the other measures need an export or a run and are
//   not-run here. A "host" maximum without a host value is not-run, never a pass. A broken must budget is E-RULE; a
//   broken should budget is reported in ctx.budgets only (no code exists for it).
// ctx.budgets keeps every result: [{id, from, measure, on, maximum, measured, status, strength}].
import { budgetResults, experienceResources, profileProblems } from '../src/host-profile.mjs';

// The objects in a document that are player.attach calls (D33).
function attachActions(v, n = 0) {
  if (Array.isArray(v)) { for (const x of v) n = attachActions(x, n); return n; }
  if (v === null || typeof v !== 'object') return n;
  if (v.call === 'player.attach') n++;
  for (const x of Object.values(v)) n = attachActions(x, n);
  return n;
}

export function check(ctx) {
  const { experience: e, source, report, host = null } = ctx;
  const L = e.limits;
  const docs = [[e.file, e.doc], ...[e.shell, ...Object.values(e.scenes || {}), ...Object.values(e.blocks || {})].filter(Boolean).map(b => [b.file, b.doc])];
  for (const [file, doc] of docs) {
    const computed = Object.keys(doc?.computed || {}).length;
    if (computed > L.computedPerBlock) report('E-RANGE', file, 'computed', `${computed} computed values, over computedPerBlock (${L.computedPerBlock})`);
    const attach = attachActions(doc);
    if (attach > L.attachActionsPerBlock) report('E-RANGE', file, '', `${attach} player.attach calls, over attachActionsPerBlock (${L.attachActionsPerBlock})`);
  }

  if (host) for (const p of profileProblems(host)) report(p.code, 'host-profile', p.path, p.message);
  const rules = [];
  for (const [file, doc] of docs) for (const rule of Array.isArray(doc?.rules) ? doc.rules : []) rules.push({ rule, from: file });
  for (const rule of Array.isArray(host?.rules) ? host.rules : []) rules.push({ rule, from: 'host-profile' });
  const measures = {};
  if (typeof source.bytes === 'function') {
    const members = {};
    const res = experienceResources(e);
    for (const r of res) { const b = source.bytes(r.path); if (b) members[r.path] = b; }
    const sum = (kind) => { let n = 0; const seen = new Set(); for (const r of res) if (r.kind === kind && members[r.path] && !seen.has(r.path)) { seen.add(r.path); n += members[r.path].length; } return n; };
    measures.soundBytes = sum('sound');
    measures.videoBytes = sum('video');
    measures.fontBytes = { resources: sum('font') };
    for (const r of res) if (r.kind === 'font' && members[r.path]) measures.fontBytes[`resource:${r.id}`] = members[r.path].length;
  }
  ctx.budgets = budgetResults(rules, host, measures);
  for (const b of ctx.budgets) {
    if (b.status === 'fail' && b.strength === 'must') report('E-RULE', b.from, `rules.${b.id}`, `budget ${b.id}: ${b.measure}${b.on ? ` on ${b.on}` : ''} is ${b.measured}, over ${b.maximum}`);
  }
}
