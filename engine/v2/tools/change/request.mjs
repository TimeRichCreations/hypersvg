// The change request (9.10) and the parts of A9.2 that edit time and play time share: check 1 (shape), check 2
// (replay), the value comparison of check 3, and check 5's type and bounds of a value. One path for every source:
// apply.mjs (edit) and play.mjs (play) both call these, so a request refused at edit time is refused at play time
// for the same reason.
import { makeDocumentChecker } from '../../schema/check-document.mjs';
import { checkValue } from '../../src/runtime.mjs';
import { canonical } from '../../check/kits.mjs';

export const SOURCES = ['editor', 'agent', 'widget', 'host', 'server', 'seat', 'test'];
const ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const WHO = /^((person|agent|server|seat|widget):[A-Za-z0-9][A-Za-z0-9._@-]*|host|test)$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
export const MAX_CHANGES = 256;
export const MAX_REASON = 500;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
export const same = (a, b) => canonical(a ?? null) === canonical(b ?? null);
const shapeDiag = (path, message) => ({ code: 'E-CHANGE-SHAPE', path, message });

// Check 1. The request is well formed and within its limits. Returns diagnostics, every failure found.
export function checkShape(req, schemas) {
  if (!isObj(req)) return [shapeDiag('', 'a change request is one JSON object')];
  const out = [];
  // The header and the closed keys, from the generated schema (`expected` is a string or an integer; the rules below
  // say which at edit and at play, 9.10).
  const r = makeDocumentChecker(schemas).check(JSON.parse(JSON.stringify(req)), {}); // a key set to undefined is absent
  for (const d of r.diags) {
    const p = String(d.path || '').replace(/^\//, '');
    out.push(shapeDiag(`/${p}`, `${d.code}: ${d.message}`));
  }
  if (typeof req.id === 'string' && (!ID.test(req.id) || req.id.length > 48)) out.push(shapeDiag('/id', `id ${JSON.stringify(req.id)} is not kebab-case of at most 48 characters`));
  if (req.at !== 'edit' && req.at !== 'play') out.push(shapeDiag('/at', 'at is edit or play'));
  if (typeof req.target === 'string' && !ID.test(req.target)) out.push(shapeDiag('/target', `target ${JSON.stringify(req.target)} is not a document or experience id`));
  if (req.at === 'edit' && req.expected !== undefined && !(typeof req.expected === 'string' && DIGEST.test(req.expected))) out.push(shapeDiag('/expected', 'at edit time, expected is a digest: sha256: and 64 lower-case hex digits'));
  if (req.at === 'play' && req.expected !== undefined && !(Number.isInteger(req.expected) && req.expected >= 0) && !(typeof req.expected === 'string' && /^(0|[1-9][0-9]*)$/.test(req.expected))) out.push(shapeDiag('/expected', 'at play time, expected is the store revision, a whole number'));
  if (req.reason !== undefined && (typeof req.reason !== 'string' || [...req.reason].length > MAX_REASON)) out.push(shapeDiag('/reason', `reason is plain text of at most ${MAX_REASON} characters`));
  if (req.at === 'edit' && typeof req.reason === 'string' && !req.reason.trim()) out.push(shapeDiag('/reason', 'an edit-time change says why: reason is not empty'));
  if (req.by !== undefined) {
    if (!isObj(req.by)) out.push(shapeDiag('/by', 'by is {source, right, who}'));
    else {
      for (const k of Object.keys(req.by)) if (!['source', 'right', 'who'].includes(k)) out.push(shapeDiag(`/by/${k}`, `by has no key ${k}`));
      if (!SOURCES.includes(req.by.source)) out.push(shapeDiag('/by/source', `by.source is one of ${SOURCES.join(', ')}`));
      if (req.by.right !== undefined && !(typeof req.by.right === 'string' && ID.test(req.by.right))) out.push(shapeDiag('/by/right', 'by.right is a right id (edit) or a seat id (play)'));
      if (!(typeof req.by.who === 'string' && WHO.test(req.by.who))) out.push(shapeDiag('/by/who', 'by.who is person:<id>, agent:<id>, server:<id>, host, seat:<id>, widget:<name> or test'));
    }
  } else if (req.at === 'edit') out.push(shapeDiag('/by', 'an edit-time change carries by, filled by whoever authenticated the source'));
  if (req.at === 'edit' && isObj(req.by) && req.by.right === undefined) out.push(shapeDiag('/by/right', 'an edit-time change names the editor right used'));
  if (Array.isArray(req.changes)) {
    if (req.changes.length < 1 || req.changes.length > MAX_CHANGES) out.push(shapeDiag('/changes', `changes holds 1 to ${MAX_CHANGES} items, not ${req.changes.length}`));
    req.changes.forEach((c, i) => {
      const at = `/changes/${i}`;
      if (!isObj(c)) { out.push(shapeDiag(at, 'a change is {address, old, new}')); return; }
      for (const k of Object.keys(c)) if (!['address', 'old', 'new'].includes(k)) out.push(shapeDiag(`${at}/${k}`, `a change has no key ${k}`));
      if (typeof c.address !== 'string' || !c.address) out.push(shapeDiag(`${at}/address`, 'address is a path (2.9)'));
      if (!('new' in c)) out.push(shapeDiag(`${at}/new`, 'a change gives new (null removes, or fires a trigger)'));
    });
    const seen = new Set();
    req.changes.forEach((c, i) => {
      if (!isObj(c) || typeof c.address !== 'string') return;
      const key = `${c.address}|${'old' in c ? canonical(c.old) : '-'}|${canonical(c.new ?? null)}`;
      if (seen.has(key)) out.push(shapeDiag(`/changes/${i}`, `the same change to ${c.address} is listed twice`));
      seen.add(key);
    });
  }
  return out;
}

// Check 2. The first receipt for this id and target, or a shape refusal when the id comes back with other content.
// first: the stored receipt or null. Returns {receipt} to return as it is, {diag} to refuse, or null to go on.
export function checkReplay(req, first) {
  if (!first) return null;
  const sameContent = same(first.changes, req.changes) && same(first.by ?? null, req.by ?? null) && (first.at ?? req.at) === req.at;
  if (sameContent) return { receipt: first };
  return { diag: shapeDiag('/id', `id ${req.id} was already used for ${req.target} with other content; a new request takes a new id`) };
}

// A text value: a plain wording, a language object (tag to wording) or a tier object (5.3.1, 7.9). Returns null or
// [code, message].
const TAG = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/;
const TIERS = ['short', 'medium', 'rich'];
export function checkText(decl, v, depth = 0) {
  if (typeof v === 'string') return checkValue(decl, v);
  if (!isObj(v) || depth > 2) return ['E-TYPE', `expected string, found ${v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v}`];
  const keys = Object.keys(v);
  if (!keys.length) return ['E-TYPE', 'an empty wording object'];
  const tiers = keys.every(k => TIERS.includes(k) || k === 'options' || k === 'default');
  const langs = keys.every(k => TAG.test(k));
  if (!tiers && !langs) return ['E-TYPE', `${keys.join(', ')} are neither language tags nor tiers`];
  for (const k of keys) {
    if (k === 'default') continue;
    const inner = k === 'options' && isObj(v[k]) ? Object.values(v[k]) : [v[k]];
    for (const x of inner) { const r = checkText(decl, x, depth + 1); if (r) return r; }
  }
  return null;
}

// Check 5 for an input value: the declared type, bounds and step lattice, never clamped. A content text field may
// take a language or tier object.
export function checkInputValue(decl, v) {
  if (v === null || v === undefined) return ['E-TYPE', 'an input always has a value; null removes nothing here'];
  if (decl.kind === 'trigger') return ['E-TYPE', 'a trigger has no stored value'];
  if (decl.kind === 'content' && (decl.contentType === 'text' || decl.contentType === undefined) && decl.type === 'string') return checkText(decl, v);
  return checkValue(decl, v);
}
