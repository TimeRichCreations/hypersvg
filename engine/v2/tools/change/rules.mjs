// Check 7 (rules, A9.2): every `must` rule of the experience whose proof includes `files` is checked on the copy,
// budgets included. The engine's checker proves what it proves (its E-RULE findings name the rule by its pointer);
// `limit` on an input or field (8.9), over every value the copy gives that input in every language, is proved by the
// checker's values family (check/rules/values.mjs), which this module shares so both say the same. Rules without a `files` proof are `not-run`
// and never refuse. A waiver (8.5) covers a broken rule; a broken `should` rule is a note.
import { PROOFS } from '../../check/rules/tables.mjs';
import { rulesOf, waiversOf, covering, limitSubjects, limitRuleFailures } from '../../check/rules/values.mjs';

export { rulesOf };

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const proofsOf = (r) => (Array.isArray(r.proof) ? r.proof : r.proof ? [r.proof] : PROOFS[r.kind] || []);


// exp: the loaded copy; diags: the checker's findings on the copy. Returns {rows, diags} where rows are the receipt's
// rule results and diags the E-RULE refusals.
export function checkRules(exp, checkerDiags) {
  const rows = []; const diags = [];
  const waivers = waiversOf(exp);
  for (const { name, rule, doc, file, index } of rulesOf(exp)) {
    const strength = rule.strength || 'must';
    const proofs = proofsOf(rule);
    const row = { rule: name, result: 'pass', proof: proofs.includes('files') ? 'files' : (proofs[0] || 'files') };
    if (strength === 'give-way') { rows.push({ ...row, result: 'not-run', detail: 'a give-way rule acts on outputs; a change never alters the values it asks for' }); continue; }
    if (!proofs.includes('files')) { rows.push({ ...row, result: 'not-run' }); continue; }
    const failures = [];
    // The checker's findings on this rule (its pointer is /rules/<index>/...).
    // (The checker's own value-limit findings, "values: ...", are worked out again below with their languages.)
    for (const d of checkerDiags) if (d.file === file && /^E-RULE/.test(d.code) && !String(d.message).startsWith('values: ') && new RegExp(`^/rules/${index}(/|$)`).test(String(d.path))) failures.push({ message: d.message });
    // Limits on values (check/rules/values.mjs, shared with the checker).
    let measured = rule.kind !== 'limit';
    if (limitSubjects(rule).length) { measured = true; failures.push(...limitRuleFailures(exp, rule, doc)); }
    if (!failures.length) { rows.push(measured ? row : { ...row, result: 'not-run', detail: 'maxLines needs the text measurer' }); continue; }
    const uncovered = failures.filter(f => !covering(waivers, name, rule, f));
    const detail = failures.map(f => f.message).join('; ').slice(0, 500);
    if (!uncovered.length) { const w = covering(waivers, name, rule, failures[0]); rows.push({ ...row, result: 'waived', detail: `${w.reason} (${w.by})`.slice(0, 500) }); continue; }
    if (strength === 'should') { rows.push({ ...row, result: 'note', detail }); continue; }
    rows.push({ ...row, result: 'fail', detail });
    diags.push({ code: 'E-RULE', address: name, path: `/rules/${index}`, file, message: `rule ${name} is broken: ${uncovered.map(f => f.message).join('; ')}` });
  }
  return { rows, diags };
}
