// Names an action for what it is (W5-C items 1 and 2). The stage-1 schema offers an action as one of many forms. When
// an action fits none, its closest-form guess can pick a form that belongs to the wrong capability, and the finding
// blames that capability. This pass looks at the action's own operation key instead:
// - an operation no capability knows is E-KEY-UNKNOWN, named as unknown;
// - a known operation is checked against its own form, so the finding says which key is wrong;
// - a known operation from a capability that needs does not name stays E-NEEDS-MISSING, naming the right capability.
import { Validator } from '../schema/validate.mjs';
import { allDocs, needNames } from './story/model.mjs';

const BLAME = /belongs to the capability (\S+),/;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const LISTS = new Set(['entry', 'exit', 'actions', 'then', 'else']);

// The forms of an action by operation key: {op -> {branch, owner}}. The operation is the first required key after id.
function forms(schemas) {
  const scene = schemas.kinds?.scene;
  const branches = scene?.$defs?.action?.oneOf || [];
  const byOp = new Map();
  for (const b of branches) {
    const op = (b.required || []).find(k => k !== 'id');
    if (op && !byOp.has(op)) byOp.set(op, { branch: { $defs: scene.$defs, ...b }, owner: b['x-hsvg-owner'] || 'core' });
  }
  return byOp;
}

function at(doc, path) {
  let cur = doc;
  for (const m of path.matchAll(/\[(\d+)\]|([^.\[\]]+)/g)) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = m[1] !== undefined ? cur[Number(m[1])] : cur[m[2]];
  }
  return cur;
}
const isActionPath = (p) => { const m = /(?:^|[.\]])([a-z]+)\[\d+\]$/.exec(p); return !!m && LISTS.has(m[1]); };



// diags: the loader's findings (file, code, path, message). Returns the list with misleading action findings replaced.
export function refineActionDiags(diags, experience, schemas) {
  if (!experience || !schemas?.kinds) return diags;
  const byOp = forms(schemas);
  const docs = new Map(allDocs(experience).map(d => [d.file, d]));
  const expNeeds = new Set(needNames(experience.doc.needs));
  const validator = new Validator();
  const out = [];
  const unknownSaid = new Set();
  // Say the action words, and how to change scene (F0b): there is no go action.
  const unknownAction = (d, action) => {
    const keys = Object.keys(action).filter(k => k !== 'id');
    const words = [...byOp.keys()].filter(k => byOp.get(k).owner === 'core').sort();
    return { ...d, code: 'E-KEY-UNKNOWN', message: `${d.path} is not a known action: none of its keys (${keys.join(', ') || 'none'}) names an action. The actions are ${words.join(', ')}. To change scene, emit an event ({"emit": "next"}) and add a story link that hears it ({"from": "<this scene>", "on": "next", "to": "<scene>"})` };
  };
  for (const d of diags) {
    // An old word's hint (check/renamed.mjs, D33) already names the final form: keep it.
    if (d.code === 'E-WORD-RENAMED') { out.push(d); continue; }
    // An object with no action word at all: the closest form's complaint (a required key) misleads; say it is unknown.
    const lone = isActionPath(d.path) && d.code !== 'E-NEEDS-MISSING' ? at(docs.get(d.file)?.doc, d.path) : null;
    if (isObj(lone) && !Object.keys(lone).some(k => byOp.has(k))) {
      if (!unknownSaid.has(`${d.file}|${d.path}`)) { unknownSaid.add(`${d.file}|${d.path}`); out.push(unknownAction(d, lone)); }
      continue;
    }
    const blame = d.code === 'E-NEEDS-MISSING' ? BLAME.exec(d.message) : null;
    const doc = blame && isActionPath(d.path) ? docs.get(d.file) : null;
    const action = doc ? at(doc.doc, d.path) : null;
    if (!isObj(action)) { out.push(d); continue; }
    const ops = Object.keys(action).filter(k => byOp.has(k));
    if (!ops.length) { out.push(unknownAction(d, action)); continue; }
    const have = new Set([...expNeeds, ...needNames(doc.doc.needs)]);
    const form = byOp.get(ops[0]);
    if (form.owner !== 'core' && !have.has(form.owner)) {
      out.push({ ...d, message: `${d.path} (action ${ops[0]}) belongs to the capability ${form.owner}, which needs does not name` });
      continue;
    }
    const inner = validator.validate(form.branch, action, { needs: have });
    if (!inner.length) { out.push(d); continue; }
    for (const e of inner) {
      const msg = e.message;
      out.push({ file: d.file, code: e.code, path: e.path === '(document)' ? d.path : `${d.path}.${e.path}`, message: msg });
    }
  }
  return out;
}

// Not a rule family: the refinement runs on the loader's findings in index.mjs.
export const check = () => {};
