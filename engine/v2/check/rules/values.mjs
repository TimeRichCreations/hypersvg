// `limit` rules (8.9) on values: a limit rule on an input or field holds for every value the files give it,
// in every language: a field's `initial` (a block's too), a use's `with` (a literal, a tier or language object, or
// a word read in every language) and a kit scene's `with`. The checker reports a broken `must` limit as E-RULE at
// the rule (unless a waiver covers it); the change tool (tools/change/rules.mjs) proves the same on its copy.
// maxLines needs the text measurer and is not proved here.
import { literalOf } from '../../src/kit.mjs';
import { slotFormula } from '../../src/formula.mjs';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const WORD = /^\s*words\.([A-Za-z][A-Za-z0-9]*)\s*$/;
const LANG = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/;

// Every rule of a loaded experience: {name, rule, doc, file, index}. In a kit experience the experience document holds
// the kit's rules, then its own (kit.mjs), so the index there is into that joined list.
export function rulesOf(exp) {
  const out = [];
  const own = exp.own ?? exp.doc;
  const kit = exp.kit;
  const add = (doc, file, list, offset = 0) => (Array.isArray(list) ? list : []).forEach((r, i) => { if (isObj(r) && typeof r.id === 'string') out.push({ name: `${doc.id}/${r.id}`, rule: r, doc, file, index: i + offset }); });
  if (kit) { add(kit.doc, exp.file, kit.doc.rules); add(own, exp.file, own.rules, Array.isArray(kit.doc.rules) ? kit.doc.rules.length : 0); } else add(exp.doc, exp.file, exp.doc.rules);
  const seen = new Set([exp.file]);
  for (const e of [...Object.values(exp.scenes || {}), ...(exp.shell ? [exp.shell] : []), ...Object.values(exp.blocks || {})]) {
    const key = `${e.file}|${e.doc.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    add(e.doc, e.file, e.doc.rules);
  }
  return out;
}

// Every waiver in the experience: the joined list of the experience document and the waivers of its documents.
export function waiversOf(exp) {
  const list = [...(Array.isArray(exp.doc.waivers) ? exp.doc.waivers : [])];
  for (const e of [...Object.values(exp.scenes || {}), ...Object.values(exp.blocks || {})]) if (Array.isArray(e.doc.waivers)) list.push(...e.doc.waivers);
  return list.filter(isObj);
}
// A waiver covers a failure when it names the rule and, where it narrows to a subject or a language, that one.
export function covering(waivers, name, rule, failure) {
  return waivers.find(w => w.rule === name && (w.subject === undefined || w.subject === rule.subject || (Array.isArray(rule.subject) && rule.subject.includes(w.subject)))
    && (w.language === undefined || w.language === failure.language) && (w.size === undefined || w.size === failure.size) && (w.theme === undefined || w.theme === failure.theme));
}

// The values an input takes in the copy: [{value, language, where}]. A kit experience's scene inputs come from the
// scene use's `with` (a literal, or a word read in every language); the experience's own inputs from their initial.
export function valuesOf(exp, name, scope) {
  const out = [];
  const lang = exp.doc.language || 'en';
  const words = (scene) => {
    const langs = new Set([...Object.keys(exp.words || {}), ...Object.keys(scene?.words || {}), ...Object.keys(exp.kit?.words || {})]);
    return [...langs].map(l => [l, { ...(exp.kit?.words?.[l] || {}), ...(scene?.words?.[l] || {}), ...(exp.words?.[l] || {}) }]);
  };
  const push = (v, where, scene) => {
    if (typeof v === 'string' || typeof v === 'number') { out.push({ value: v, language: lang, where }); return; }
    if (isObj(v)) for (const [k, x] of Object.entries(v)) push(x, where, scene);
  };
  const fromSite = (doc, scene, where) => {
    const decl = doc.inputs?.[name];
    if (decl && decl.initial !== undefined) { if (isObj(decl.initial) && Object.keys(decl.initial).every(k => LANG.test(k))) for (const [l, x] of Object.entries(decl.initial)) out.push({ value: x, language: l, where }); else push(decl.initial, where, scene); return; }
    const f = doc.computed?.[name];
    if (typeof f !== 'string') return;
    const lit = literalOf(f);
    if (lit) { push(lit.value, where, scene); return; }
    const w = WORD.exec(f);
    if (w) for (const [l, map] of words(scene)) if (typeof map[w[1]] === 'string') out.push({ value: map[w[1]], language: l, where });
  };
  if (scope.experience) fromSite(exp.doc, null, exp.doc.id);
  for (const [key, s] of Object.entries(exp.scenes || {})) if (scope.experience || scope.defs.has(s.use ?? s.doc.id)) fromSite(s.doc, s, key);
  // A block's own initial, and each use's `with` for it, in any document that uses it.
  for (const [id, b] of Object.entries(exp.blocks || {})) {
    if (!scope.defs.has(id) && !scope.defs.has(b.doc.id)) continue;
    fromSite(b.doc, b, id);
    for (const d of [exp.doc, ...Object.values(exp.scenes || {}).map(s => s.doc), ...(exp.shell ? [exp.shell.doc] : []), ...Object.values(exp.blocks || {}).map(x => x.doc)]) {
      for (const u of Array.isArray(d?.uses) ? d.uses : []) {
        if (u?.use !== id || !isObj(u.with) || !(name in u.with)) continue;
        const f = u.with[name]; const where = `${d.id}/${u.id}`;
        if (isObj(f)) { if (Object.keys(f).every(k => LANG.test(k))) for (const [l, x] of Object.entries(f)) out.push({ value: x, language: l, where }); else push(f, where, null); continue; }
        const src = slotFormula(b.doc.inputs?.[name], f); // a text input's plain words (D31.1)
        const lit = src === null ? null : literalOf(src);
        if (lit) { push(lit.value, where, null); continue; }
        const w = WORD.exec(String(src));
        if (w) for (const [l, map] of words(null)) if (typeof map[w[1]] === 'string') out.push({ value: map[w[1]], language: l, where });
      }
    }
  }
  return out;
}

// One limit rule over its values: failures [{message, language}].
export function limitFailures(rule, values) {
  const out = [];
  const forLang = (v, l) => (isObj(v) ? (v[l] ?? v.default) : v);
  for (const { value, language, where } of values) {
    const at = `${where}${language ? ` (${language})` : ''}`;
    if (typeof value === 'string') {
      const n = [...value].length;
      const max = forLang(rule.maxLength, language); const min = forLang(rule.minLength, language);
      if (typeof max === 'number' && n > max) out.push({ language, message: `${JSON.stringify(value)} at ${at} is ${n} characters, over ${max}` });
      if (typeof min === 'number' && n < min) out.push({ language, message: `${JSON.stringify(value)} at ${at} is ${n} characters, under ${min}` });
      if (rule.case === 'upper' && value !== value.toUpperCase()) out.push({ language, message: `${JSON.stringify(value)} at ${at} is not upper case` });
      if (rule.case === 'lower' && value !== value.toLowerCase()) out.push({ language, message: `${JSON.stringify(value)} at ${at} is not lower case` });
      if (rule.case === 'title' && value.split(/\s+/).some(w => w && w[0] !== w[0].toUpperCase())) out.push({ language, message: `${JSON.stringify(value)} at ${at} is not title case` });
    } else if (typeof value === 'number') {
      if (typeof rule.minimum === 'number' && value < rule.minimum) out.push({ language, message: `${value} at ${at} is below ${rule.minimum}` });
      if (typeof rule.maximum === 'number' && value > rule.maximum) out.push({ language, message: `${value} at ${at} is above ${rule.maximum}` });
    }
  }
  return out;
}
export const LIMIT_KEYS = ['minimum', 'maximum', 'minLength', 'maxLength', 'case'];

// The limit rules a rule entry proves on values: its input and field subjects, when it names a limit key.
export function limitSubjects(rule) {
  if (rule?.kind !== 'limit' || !LIMIT_KEYS.some(k => rule[k] !== undefined)) return [];
  return (Array.isArray(rule.subject) ? rule.subject : [rule.subject]).filter(s => typeof s === 'string' && /^(input|field):/.test(s));
}
// The failures of one limit rule of a document over the experience's values.
export function limitRuleFailures(exp, rule, doc) {
  const isExp = doc === (exp.own ?? exp.doc) || doc.kind === 'kit' || doc.kind === 'experience';
  const scope = { experience: isExp, defs: new Set([doc.id]) };
  const out = [];
  for (const s of limitSubjects(rule)) {
    // A role-prefixed field (action.text) is one name; field:<block id>.<field> names the block's field.
    const whole = s.slice(s.indexOf(':') + 1);
    let values = valuesOf(exp, whole, scope);
    if (!values.length && whole.includes('.')) values = valuesOf(exp, whole.split('.').pop(), scope);
    out.push(...limitFailures(rule, values));
  }
  return out;
}

// The checker family: E-RULE for a broken must limit, at the rule, unless a waiver covers each failure.
export function check(ctx) {
  const exp = ctx.experience;
  if (!exp) return;
  const waivers = waiversOf(exp);
  for (const { name, rule, doc, file, index } of rulesOf(exp)) {
    if ((rule.strength || 'must') !== 'must' || !limitSubjects(rule).length) continue;
    const bad = limitRuleFailures(exp, rule, doc).filter(f => !covering(waivers, name, rule, f));
    if (bad.length) ctx.report('E-RULE', file, `/rules/${index}`, `values: rule ${name} is broken: ${bad.map(f => f.message).join('; ').slice(0, 400)}`);
  }
}
