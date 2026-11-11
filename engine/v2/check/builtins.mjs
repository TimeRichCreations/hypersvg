// The door for built-in capabilities (D28), on files. A built-in's words live in its manifest
// (spec/2.0/capabilities/<name>.json): grammar.addons.<name> is the schema of its settings pocket addons.<name>, and
// grammar.calls.<verb>.with the inputs of the call <name>.<verb>. Built-ins have bare names; an outside add-on's id is
// owner.name (chapter 12).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slotFormula } from '../src/formula.mjs';

const specDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'spec', '2.0');
const registry = JSON.parse(fs.readFileSync(path.join(specDir, 'capabilities.json'), 'utf8'));
const known = new Map();
// The grammar of a built-in capability that uses the door ({addons, calls, events}), or null.
export function builtinGrammar(name) {
  if (typeof name !== 'string' || name.includes('.')) return null;
  if (!known.has(name)) {
    const c = registry.capabilities.find(x => x.name === name && x.kind === 'capability');
    const f = c && path.join(specDir, ...c.manifest.split('/'));
    const g = f && fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).grammar : null;
    known.set(name, g && (g.addons || g.calls) ? g : null);
  }
  return known.get(name);
}
// Where a built-in's words are listed, for a finding's fix.
export const wordsAt = (name) => `spec/2.0/capabilities/${name}.json (grammar.addons and grammar.calls) and skill/2.0/references/capabilities.md`;
// A built-in's call: {name, verb, call} for "<name>.<verb>" with a bare name whose manifest has calls, or null.
export function builtinCall(text) {
  if (typeof text !== 'string') return null;
  const dot = text.lastIndexOf('.');
  const name = dot > 0 ? text.slice(0, dot) : '';
  const g = builtinGrammar(name);
  return g?.calls ? { name, verb: text.slice(dot + 1), call: g.calls[text.slice(dot + 1)] ?? null, calls: g.calls } : null;
}

// ---- door 2 (D31.5): one view of an add-on's door, for built-ins and outside add-ons alike ----
// {id, builtIn, keys, calls: {verb: {with, humanOnly}}, events: [name or name:<subject>], writes: [key],
//  draws: {binding, text} | null, contentTypes: {name: decl}, grants: [kind]}, or null.
// A built-in's view comes from its manifest (grammar.addons.<id>, calls, events, draws.<id>, contentTypes, and grants);
// an outside add-on's from its manifest's adds (door 1's channels are read as writes).
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const views = new Map();
function builtinView(name) {
  if (views.has(name)) return views.get(name);
  const c = registry.capabilities.find(x => x.name === name && x.kind === 'capability');
  const f = c && path.join(specDir, ...c.manifest.split('/'));
  const man = f && fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
  const g = man?.grammar || {};
  const events = (c?.owns?.events || []).filter(e => e.startsWith(`${name}:`)).map(e => e.slice(name.length + 1).replace(/:<[^>]+>$/, ':<subject>'));
  const v = man && {
    id: name, builtIn: true, keys: g.addons?.[name] ?? null, calls: g.calls || {}, events, writes: g.writes || [],
    draws: g.draws?.[name] ?? null, contentTypes: g.contentTypes || {}, grants: man.grants || [], controls: g.controls || {}, paints: g.paints || {},
  };
  views.set(name, v || null);
  return v || null;
}
export function doorView(exp, id) {
  if (typeof id !== 'string') return null;
  if (!id.includes('.')) return builtinView(id);
  const a = exp?.addons?.[id];
  if (a?.manifest?.kind !== 'capability') return null;
  const ad = a.manifest.adds || {};
  return {
    id, builtIn: false, keys: ad.keys ?? null, calls: ad.calls || {}, events: (ad.events || []).map(e => String(e)), writes: ad.writes || ad.channels || [],
    draws: ad.draws ?? null, contentTypes: ad.contentTypes || {}, grants: ad.grants || [], controls: ad.controls || {}, paints: ad.paints || {},
  };
}
// Whether an event name is an add-on's event (<id>:<event> or <id>:<event>:<subject>, D31.5): true when the add-on
// lists it, false when the add-on is known and does not, null when the head names no add-on.
export function addonEventKnown(exp, name) {
  if (typeof name !== 'string' || !name.includes(':')) return null;
  const [head, ev, ...rest] = name.split(':');
  const v = doorView(exp, head);
  if (!v) return null;
  const subject = rest.join(':');
  return v.events.some(e => (e.endsWith(':<subject>') ? e.slice(0, -10) === ev && subject !== '' : e === ev && subject === ''));
}
// The content types the add-ons of a needs list declare: {name: {id, decl}}. A built-in's are bare names; an outside
// add-on's are <id>.<name>.
export function addonContentTypes(exp, ids) {
  const out = {};
  for (const id of ids) {
    const v = doorView(exp, id);
    for (const [n, decl] of Object.entries(v?.contentTypes || {})) out[v.builtIn ? n : `${id}.${n}`] = { id, decl };
  }
  return out;
}
export { isObj as isObject };
// ---- call inputs as text slots (D31.1) ----
// The declaration of a call's input: a built-in's manifest (grammar.calls.<verb>.with) or an outside add-on's
// (adds.calls), or undefined.
export function callInputDecl(exp, call, key) {
  if (typeof call !== 'string') return undefined;
  const dot = call.lastIndexOf('.');
  if (dot <= 0) return undefined;
  const v = doorView(exp, call.slice(0, dot));
  const d = v?.calls?.[call.slice(dot + 1)]?.with?.properties?.[key];
  return isObj(d) ? d : undefined;
}
// The formula a call's input stands for: an input typed as a string is a text slot, so its plain words are a quoted
// literal and its one {{ f }} is f; words with {{ }} inside give null. Any other input's source as it is.
export const callFormula = (exp, a, key) => slotFormula(callInputDecl(exp, a?.call, key), a?.with?.[key]);
// The text a formula gives when it is one quoted literal ('cta' or "cta"), else null.
export function quotedText(f) {
  if (typeof f !== 'string') return null;
  const single = /^\s*'([^'\\]*)'\s*$/.exec(f);
  if (single) return single[1];
  const double = /^\s*("(?:[^"\\]|\\.)*")\s*$/.exec(f);
  if (!double) return null;
  try { return JSON.parse(double[1]); } catch { return null; }
}
// The name a call's input gives when it is written as words (or an old quoted literal), else null.
export const callName = (exp, a, key) => quotedText(callFormula(exp, a, key));
// Whether an action is a call its add-on marks humanOnly (door 2): only a person's press may cause it (10.5).
export function humanOnlyCall(exp, a) {
  if (!isObj(a) || typeof a.call !== 'string') return false;
  const dot = a.call.lastIndexOf('.');
  return dot > 0 && doorView(exp, a.call.slice(0, dot))?.calls?.[a.call.slice(dot + 1)]?.humanOnly === true;
}
// The binding keys built-ins draw (door 2: grammar.draws.<name>), as a set of names.
let drawKeys = null;
export function builtinDrawKeys() {
  if (!drawKeys) drawKeys = new Set(registry.capabilities.filter(c => c.kind === 'capability' && builtinView(c.name)?.draws).map(c => c.name));
  return drawKeys;
}

// ---- D39: the growth slots ----
// The places in a document where content names an add-on's control kind or channel (<id>.<name>, split at the last
// dot, as a call): [{at: [path tokens], value, slot: 'controls' | 'paints'}]. A control's dotted kind, a binding's
// dotted key holding a formula (an object is a door 2 draws binding), a track's dotted channel. motion.morph is the
// motion add-on's channel of the 6.7 grammar, not a growth slot.
export function growthSites(doc) {
  const out = [];
  if (isObj(doc?.controls)) for (const [id, c] of Object.entries(doc.controls)) if (isObj(c) && typeof c.kind === 'string' && c.kind.includes('.')) out.push({ at: ['controls', id, 'kind'], value: c.kind, slot: 'controls' });
  (Array.isArray(doc?.bindings) ? doc.bindings : []).forEach((b, i) => { if (isObj(b)) for (const k of Object.keys(b)) if (k.includes('.') && k !== 'motion.morph' && !isObj(b[k])) out.push({ at: ['bindings', i, k], value: k, slot: 'paints' }); });
  if (isObj(doc?.clips)) for (const [cid, c] of Object.entries(doc.clips)) (Array.isArray(c?.tracks) ? c.tracks : []).forEach((t, i) => { if (isObj(t) && typeof t.channel === 'string' && t.channel.includes('.') && t.channel !== 'motion.morph') out.push({ at: ['clips', cid, 'tracks', i, 'channel'], value: t.channel, slot: 'paints' }); });
  return out;
}
// What a growth value names: {id, name, view, decl}. view is the add-on's door view (null when no add-on of that id is
// pinned or built in); decl is its manifest's controls.<name> or paints.<name>, or null.
export function growthOf(exp, value, slot) {
  const dot = value.lastIndexOf('.');
  const id = value.slice(0, dot); const name = value.slice(dot + 1);
  const view = doorView(exp, id);
  return { id, name, view, decl: view?.[slot]?.[name] ?? null };
}
