// Give-way steps in text fits (7.6, 8.4), from the files.
// - A text binding's fit lists only text steps (7.6): those of a fits rule. Any other is E-RULE.
// The schema already refuses unknown step names, and a give-way rule's step that its kind may not use (8.4).
// - A required content field never has an empty wording (7.9, 5.3.1): each wording of a tier or language object in
//   its `initial`, or in a use's `with` for it, is not an empty string, an empty list or runs with no words.
//   E-CONTENT-REQUIRED. A plain empty `initial` of a required text field ("", or runs with no words) is
//   E-CONTENT-REQUIRED too (7.9).
import { FIT_STEPS, STEPS } from '../src/ladder.mjs';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const esc = (k) => String(k).replace(/~/g, '~0').replace(/\//g, '~1');
// The empty wordings of a tiered or per-language value, as JSON pointer suffixes. A richText leaf is a list of runs.
function emptyWordings(decl, v, at = '') {
  if (!isObj(v)) return [];
  const out = [];
  for (const [k, w] of Object.entries(v)) {
    const here = `${at}/${esc(k)}`;
    if (isObj(w)) { out.push(...emptyWordings(decl, w, here)); continue; }
    const empty = decl.contentType === 'richText'
      ? !Array.isArray(w) || !w.some(r => String(r?.text ?? '').trim() !== '')
      : w === '' || (Array.isArray(w) && !w.length);
    if (empty) out.push(here);
  }
  return out;
}

// A plain empty initial of a text field: "" (a string field), or runs with no words (a richText field) (7.9).
function emptyPlain(decl, v) {
  if (decl.contentType === 'richText') return Array.isArray(v) && !v.some(r => String(r?.text ?? '').trim() !== '');
  return decl.type === 'string' && v === '';
}

export function check(ctx) {
  const { experience: exp, report } = ctx;
  const docs = [{ file: exp.file, doc: exp.doc }];
  for (const s of Object.values(exp.scenes || {})) docs.push(s);
  if (exp.shell) docs.push(exp.shell);
  for (const b of Object.values(exp.blocks || {})) docs.push(b);
  for (const { file, doc } of docs) {
    for (const [name, decl] of Object.entries(isObj(doc?.inputs) ? doc.inputs : {})) {
      if (decl?.kind !== 'content' || decl.required === false) continue;
      if (emptyPlain(decl, decl.initial)) report('E-CONTENT-REQUIRED', file, `/inputs/${esc(name)}/initial`, `${name} is a required field; its initial is empty. Give it a wording, or declare it required: false (7.9)`);
      for (const at of emptyWordings(decl, decl.initial)) report('E-CONTENT-REQUIRED', file, `/inputs/${esc(name)}/initial${at}`, `${name} is a required field; its wording ${at.slice(1)} is empty. A required field never has an empty wording (7.9)`);
    }
    (Array.isArray(doc?.uses) ? doc.uses : []).forEach((u, i) => {
      const target = exp.blocks?.[u?.use]?.doc;
      for (const [name, v] of Object.entries(isObj(u?.with) ? u.with : {})) {
        const decl = target?.inputs?.[name];
        if (decl?.kind !== 'content' || decl.required === false) continue;
        for (const at of emptyWordings(decl, v)) report('E-CONTENT-REQUIRED', file, `/uses/${i}/with/${esc(name)}${at}`, `use ${u.id}: ${name} is a required field of ${u.use}; its wording ${at.slice(1)} is empty (7.9)`);
      }
    });
    (Array.isArray(doc?.bindings) ? doc.bindings : []).forEach((bd, i) => {
      const steps = bd?.fit?.steps;
      if (!Array.isArray(steps)) return;
      steps.forEach((s, k) => { if (STEPS.includes(s) && !FIT_STEPS.includes(s)) report('E-RULE', file, `/bindings/${i}/fit/steps/${k}`, `binding ${bd.id ?? `#${i}`}: a text fit may not use the step ${s}; it may use ${FIT_STEPS.join(', ')} (7.6, 8.4)`); });
    });
  }
}
