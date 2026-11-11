// The rights table (A9.1), computed from the files and never written by hand: the kit's `rights`, the `editableBy` of
// every exposed input (the outermost declaration along each promotion chain), the `waivableBy` of every rule and the
// seat rows of A4.1. Per kit, or per experience when there is no kit.
import { kitPin } from '../../src/kit.mjs';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// A block's inputs face (4.7): its own inputs, then its promoted inputs. defs: {id: {doc}}. Each entry is
// {decl, editableBy, where: 'own' | 'promote', promote?: index}. A promoted input keeps the inner declaration; its
// editableBy is the promote entry's, else the inner list.
export function faceOf(doc, defs, depth = 0) {
  const face = {};
  for (const [k, d] of Object.entries(doc?.inputs || {})) if (isObj(d)) face[k] = { decl: d, editableBy: d.editableBy ?? [], where: 'own' };
  if (depth > 12) return face;
  (Array.isArray(doc?.promote) ? doc.promote : []).forEach((p, i) => {
    const inner = promoted(doc, p, defs, depth);
    if (!inner) return;
    const name = p.as || String(p.from).split('/').pop();
    face[name] = { decl: { ...inner.decl, ...(p.initial !== undefined ? { initial: p.initial } : {}) }, editableBy: p.editableBy ?? inner.editableBy, where: 'promote', promote: i };
  });
  return face;
}
// The inner face entry a promote entry names (`<use id>/<input>`, or `<scene id>/<input>` in an experience), or null
// when its `from` is unknown or deeper than one level (E-PROMOTE).
export function promoted(doc, p, defs, depth = 0) {
  const parts = String(p?.from ?? '').split('/');
  if (parts.length !== 2) return null;
  const [useId, name] = parts;
  const use = (Array.isArray(doc?.uses) ? doc.uses : []).find(u => u?.id === useId);
  let def = use && typeof use.use === 'string' ? defs[use.use] : null;
  if (!def && doc?.kind === 'experience') { const s = doc.story?.scenes?.[useId]; def = typeof s === 'object' ? defs[s?.use] : defs[`scene:${useId}`]; }
  if (!def) return null;
  return faceOf(def.doc, defs, depth + 1)[name] ?? null;
}

// The table for a loaded experience (src/load.mjs). For a kit experience the addresses are those of 4.7 rule 8:
// `<experience>/<kit input>` and `<experience>/<scene key>/<input>`.
export function rightsTable(exp) {
  const own = exp.own ?? exp.doc;
  const kit = exp.kit ?? null;
  const rights = (kit ? kit.doc.rights : own.rights) || {};
  const defs = { ...(kit?.blocks || {}), ...(exp.blocks || {}) };
  for (const [id, s] of Object.entries(exp.scenes || {})) if (!kit) defs[`scene:${id}`] = s;
  const edit = {};
  const put = (address, list) => { edit[address] = Array.isArray(list) ? [...list] : []; };
  if (kit) {
    for (const [k, d] of Object.entries(kit.doc.inputs || {})) if (d?.kind !== 'trigger') put(`${own.id}/${k}`, d?.editableBy);
    for (const [key, s] of Object.entries(own.story?.scenes || {})) {
      const def = isObj(s) ? kit.blocks[s.use] : null;
      if (!def) continue;
      for (const [k, f] of Object.entries(faceOf(def.doc, defs))) if (f.decl.kind !== 'trigger') put(`${own.id}/${key}/${k}`, f.editableBy);
    }
  } else {
    const docs = [own, ...Object.values(exp.scenes || {}).map(s => s.doc), ...(exp.shell ? [exp.shell.doc] : []), ...Object.values(exp.blocks || {}).map(b => b.doc)];
    for (const d of docs) for (const [k, f] of Object.entries(faceOf(d, defs))) if (f.decl.kind !== 'trigger') put(`${d.id}/${k}`, f.editableBy);
  }
  // Waivers: every rule with a waivableBy, as <document or pack id>/<rule id>.
  const waive = {};
  const ruleDocs = [own, ...(kit ? [kit.doc, ...Object.values(kit.blocks).map(b => b.doc)] : []), ...Object.values(exp.scenes || {}).map(s => s.doc), ...Object.values(exp.blocks || {}).map(b => b.doc)];
  for (const d of ruleDocs) for (const r of Array.isArray(d?.rules) ? d.rules : []) if (Array.isArray(r?.waivableBy)) waive[`${d.id}/${r.id}`] = [...r.waivableBy];
  // Abilities, from each right's `may` (9.9).
  const abilities = { edit: [], review: [], publish: [], changeKit: [] };
  for (const [id, r] of Object.entries(rights)) for (const a of Array.isArray(r?.may) ? r.may : []) if (abilities[a]) abilities[a].push(id);
  // Seats (A4.1): each seat id to its inputs and view.
  const seats = {};
  const seatList = own.addons?.seats?.seats ?? exp.doc.addons?.seats?.seats;
  if (isObj(seatList)) for (const [id, s] of Object.entries(seatList)) seats[id] = { inputs: s?.inputs ?? [], view: s?.view ?? null };
  else if (Array.isArray(seatList)) for (const s of seatList) if (s?.id) seats[s.id] = { inputs: s.inputs ?? [], view: s.view ?? null };
  const pin = kitPin(own);
  const table = {};
  if (kit) table.kit = { id: kit.doc.id, version: kit.doc.about?.version ?? pin?.version };
  else table.experience = own.id;
  return { ...table, edit, waive, abilities, seats };
}

// The table for a kit folder (a kit change): the kit's inputs, every rule's waivableBy and the abilities.
export function kitRightsTable(kitDoc, blockDocs = []) {
  const edit = {};
  for (const [k, d] of Object.entries(kitDoc.inputs || {})) if (d?.kind !== 'trigger') edit[`${kitDoc.id}/${k}`] = [...(d?.editableBy || [])];
  const waive = {};
  for (const d of [kitDoc, ...blockDocs]) for (const r of Array.isArray(d?.rules) ? d.rules : []) if (Array.isArray(r?.waivableBy)) waive[`${d.id}/${r.id}`] = [...r.waivableBy];
  const abilities = { edit: [], review: [], publish: [], changeKit: [] };
  for (const [id, r] of Object.entries(kitDoc.rights || {})) for (const a of Array.isArray(r?.may) ? r.may : []) if (abilities[a]) abilities[a].push(id);
  return { kit: { id: kitDoc.id, version: kitDoc.about?.version }, edit, waive, abilities, seats: {} };
}
