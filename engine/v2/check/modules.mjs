// Logic modules on files (10.7, 10.11, A9.3).
// - E-MODULE-CALL: a call names <module>.<export> of a module's manifest; `with` gives exactly the export's inputs;
//   `to` maps exactly its outputs to distinct body values the block may write, each of the output's type.
// - E-MODULE-REVIEW: a module in needs carries its exact version, which is the manifest's; the experience's
//   about.trust.pins pins <name>@<version>; and the pinned digest is the one this engine's reviewed lock lists
//   (engine/v2/modules/lock.json). A missing need is E-NEEDS-MISSING (story/needs.mjs).
// E-MODULE-CONFINEMENT is proven at mount (src/modules.mjs): files cannot show how a host runs code.
import { absentCall } from './absent.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walk, isObj, allDocs, pathStr } from './story/model.mjs';
import { builtinCall, doorView, quotedText } from './builtins.mjs';
import { slotFormula } from '../src/formula.mjs';
import { Validator } from '../schema/validate.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const specDir = path.join(here, '..', '..', '..', 'spec', '2.0');
const registry = JSON.parse(fs.readFileSync(path.join(specDir, 'capabilities.json'), 'utf8'));
const MODULES = new Set(registry.capabilities.filter(c => c.kind === 'module' || c.contract === 'module').map(c => c.name));
const manifests = new Map();
// The module's manifest beside the spec (capabilities/<name>.json), or null.
export function manifestOf(name) {
  if (!manifests.has(name)) {
    const f = path.join(specDir, 'capabilities', `${name}.json`);
    manifests.set(name, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
  }
  return manifests.get(name);
}
// This engine's reviewed lock: {"<name>@<version>": digest}.
export function reviewedLock() {
  return JSON.parse(fs.readFileSync(path.join(here, '..', 'modules', 'lock.json'), 'utf8'));
}

const LISTS = ['entry', 'exit', 'actions', 'then', 'else'];
const same = (x, y) => x.length === y.length && x.every(k => y.includes(k));

// The body values a document's actions may write: its own, and the experience's for a scene or shell (5.1.3).
function writable(d, exp) {
  const own = isObj(d.doc.values) ? d.doc.values : {};
  if (d.kind === 'scene' || d.kind === 'shell') return { ...(isObj(exp.doc.values) ? exp.doc.values : {}), ...own };
  return own;
}

// The player's own calls (D33): player.openUrl {field}, player.setting {<one setting>}, player.resetSaved {settings?},
// player.attach {part, to}. Each with entry is a formula.
const PLAYER_CALLS = { openUrl: { need: ['field'], only: null }, setting: { need: [], only: null }, resetSaved: { need: [], only: ['settings'] }, attach: { need: ['part', 'to'], only: ['part', 'to'] } };
function checkPlayerCall(ctx, d, at, a, verb, exp) {
  const spec = PLAYER_CALLS[verb];
  if (!spec) { ctx.report('E-REF-UNKNOWN', d.file, `${at}.call`, `${a.call}: the player's calls are player.openUrl, player.setting, player.resetSaved and player.attach (D33)`); return; }
  const w = isObj(a.with) ? a.with : {};
  if (a.with !== undefined && !isObj(a.with)) { ctx.report('E-TYPE', d.file, `${at}.with`, `${a.call}: with is an object of formulas`); return; }
  for (const k of spec.need) if (!(k in w)) ctx.report('E-KEY-REQUIRED', d.file, `${at}.with`, `${a.call} needs "with": {${spec.need.map(x => `"${x}": ...`).join(', ')}}${verb === 'attach' ? `, such as {"part": "'parcel'", "to": "'bike.basket'"} (to null takes it off)` : verb === 'openUrl' ? `, such as {"field": "'shopLink'"}: the quoted name of a url input` : ''}`);
  if (spec.only) for (const k of Object.keys(w)) if (!spec.only.includes(k)) ctx.report('E-KEY-UNKNOWN', d.file, `${at}.with.${k}`, `${a.call} takes ${spec.only.join(' and ')} in with, not ${k}`);
  if (verb === 'setting' && Object.keys(w).length !== 1) ctx.report('E-KEY-REQUIRED', d.file, `${at}.with`, `${a.call} sets exactly one setting: "with": {"muted": true}`);
  if (a.to !== undefined) ctx.report('E-KEY-UNKNOWN', d.file, `${at}.to`, `${a.call} returns nothing, so it has no to`);
  // player.openUrl's field names an input of the experience whose contentType is url, never an address (10.4, F0b).
  const field = verb === 'openUrl' && typeof w.field === 'string' ? /^\s*'([^'\\]*)'\s*$/.exec(w.field)?.[1] : undefined;
  if (field !== undefined && /[:/]/.test(field)) ctx.report('E-TYPE', d.file, `${at}.with.field`, `player.openUrl's field names an input of the experience whose contentType is url, not an address: declare one, as "inputs": {"clickUrl": {"kind": "content", "type": "string", "contentType": "url", "maxLength": 200, "initial": "${field}"}}, and write {"call": "player.openUrl", "with": {"field": "'clickUrl'"}} (10.4)`);
  else if (field !== undefined && exp.doc.inputs?.[field]?.contentType !== 'url' && d.doc.inputs?.[field]?.contentType !== 'url') ctx.report('E-REF-UNKNOWN', d.file, `${at}.with.field`, `player.openUrl: ${field} is not a url content field of this block or of the experience (10.4)`);
}

function checkCalls(ctx, exp) {
  for (const d of allDocs(exp)) {
    const values = writable(d, exp);
    const inputs = isObj(d.doc.inputs) ? d.doc.inputs : {};
    walk(d.doc, (n, p) => {
      if (!isObj(n)) return;
      for (const k of LISTS) {
        if (!Array.isArray(n[k])) continue;
        n[k].forEach((a, i) => {
          if (!isObj(a) || typeof a.call !== 'string') return;
          const at = pathStr([...p, k, i]);
          const bad = (msg) => ctx.report('E-MODULE-CALL', d.file, at, `call ${a.call}: ${msg}`);
          // <module>.<export>: the module is everything before the last dot (an outside one is owner.name).
          const dot = a.call.lastIndexOf('.');
          const mod = dot > 0 ? a.call.slice(0, dot) : '';
          const name = dot > 0 ? a.call.slice(dot + 1) : '';
          if (!mod || !name || mod.split('.').length > 2) return bad('a call names <module>.<export>, or <owner.name>.<export> for an outside add-on');
          if (mod === 'player') return checkPlayerCall(ctx, d, at, a, name, exp);
          // A call of a known add-on this release does not hold is accepted by name (absent.mjs); needs.mjs asks for its need.
          if (absentCall(a.call, mod)) return;
          const built = builtinCall(a.call);
          if (built) return checkBuiltinCall(ctx, d, at, a, built);
          const addon = exp.addons?.[mod];
          if (addon?.manifest.kind === 'capability') {
            // An outside capability's call (chapter 12, door 2): checked as a built-in's (B1a Request 2).
            const v = doorView(exp, mod);
            return checkBuiltinCall(ctx, d, at, a, { name: mod, verb: name, call: v.calls[name] ?? null, calls: v.calls });
          }
          if (!MODULES.has(mod) && addon?.manifest.kind !== 'module') return bad(mod.includes('.') ? `${mod} is not a module add-on this experience pins: pin it in about.trust.pins as ${mod}@<version> and name it in needs` : `${mod} is not a logic module of the registry`);
          const ex = addon ? addon.manifest.adds.exports?.[name] : manifestOf(mod)?.grammar?.exports?.[name];
          if (!ex) return bad(`${mod} has no export ${name}`);
          const ins = Object.keys(ex.with?.properties || {});
          const outs = Object.keys(ex.returns?.properties || {});
          const withKeys = Object.keys(isObj(a.with) ? a.with : {});
          const toKeys = Object.keys(isObj(a.to) ? a.to : {});
          if (!same(withKeys, ins)) bad(`with gives ${withKeys.join(', ') || 'nothing'}; the export takes exactly ${ins.join(', ')}`);
          if (!same(toKeys, outs)) bad(`to maps ${toKeys.join(', ') || 'nothing'}; the export returns exactly ${outs.join(', ')}`);
          const targets = toKeys.map(o => a.to[o]);
          if (new Set(targets).size !== targets.length) bad('to maps two outputs to one value; each goes to its own value');
          for (const o of toKeys) {
            const v = a.to[o];
            const decl = values[v];
            if (!decl) { bad(v in inputs ? `${v} is an input; to writes body values only` : `${v} is not a body value this ${d.kind} may write`); continue; }
            const want = ex.returns?.properties?.[o]?.type;
            if (want && decl.type !== want) bad(`the output ${o} is a ${want}; the value ${v} is a ${decl.type}`);
          }
        });
      }
    });
  }
}

// A built-in capability's call (D28): <name>.<verb> of its manifest's calls; with gives only its inputs and every
// required one; a literal fits its input (E-TYPE, E-RANGE); a quoted literal for an input that names an entry of the
// settings (x-hsvg-names: bodies) names one of the block's (E-REF-UNKNOWN). A formula's type and range are proven with
// the other formulas (formula/sites.mjs). The call has no to: it writes nothing back.
function checkBuiltinCall(ctx, d, at, a, { name, verb, call, calls }) {
  const bad = (code, msg) => ctx.report(code, d.file, at, `call ${a.call}: ${msg}`);
  if (!call) return bad('E-ADDON', `${name} has no call ${verb}; it has ${Object.keys(calls).join(', ') || 'none'}`);
  const props = call.with?.properties || {};
  const given = isObj(a.with) ? a.with : {};
  for (const k of Object.keys(given)) if (!Object.hasOwn(props, k)) bad('E-ADDON', `${k} is not an input of ${a.call}; it takes ${Object.keys(props).join(', ')}`);
  for (const k of call.with?.required || []) if (!Object.hasOwn(given, k)) bad('E-ADDON', `it needs the input ${k}; it takes ${Object.keys(props).join(', ')}`);
  if (a.to !== undefined) bad('E-ADDON', `a capability's call returns nothing, so it has no to`);
  const pocket = isObj(d.doc.addons?.[name]) ? d.doc.addons[name] : {};
  for (const [k, v] of Object.entries(given)) {
    const p = props[k];
    if (!p) continue;
    if (typeof v !== 'string') { for (const f of new Validator().validate(p, v)) ctx.report(f.code, d.file, `${at}.with.${k}`, `call ${a.call}: ${k} ${f.message}`); continue; }
    const lit = quotedText(slotFormula(p, v)); // a string input is a text slot: its words name the entry (D31.1)
    if (lit !== null && typeof p['x-hsvg-names'] === 'string' && !Object.hasOwn(isObj(pocket[p['x-hsvg-names']]) ? pocket[p['x-hsvg-names']] : {}, lit)) {
      ctx.report('E-REF-UNKNOWN', d.file, `${at}.with.${k}`, `call ${a.call}: ${lit} is not one of the ${p['x-hsvg-names']} in addons.${name} of ${d.id}`);
    }
  }
}

function checkReview(ctx, exp) {
  const lock = reviewedLock();
  const pins = isObj(exp.doc.about?.trust?.pins) ? exp.doc.about.trust.pins : {};
  const expFile = exp.file || 'experience.json';
  const needed = new Map(); // pinned name -> first {file, at}
  for (const d of allDocs(exp)) {
    (Array.isArray(d.doc.needs) ? d.doc.needs : []).forEach((entry, i) => {
      if (typeof entry !== 'string') return;
      const name = entry.includes('@') ? entry.slice(0, entry.indexOf('@')) : entry;
      if (!MODULES.has(name)) return; // an outside module's pin and files are the add-on door's (addons.mjs)
      const at = `needs[${i}]`;
      const version = manifestOf(name)?.about?.version;
      if (!entry.includes('@')) { ctx.report('E-MODULE-REVIEW', d.file, at, `the module ${name} is named without its exact version; write ${name}@${version}`); return; }
      const v = entry.slice(entry.indexOf('@') + 1);
      if (v !== version) { ctx.report('E-MODULE-REVIEW', d.file, at, `${entry}: the module's manifest is version ${version}`); return; }
      if (!needed.has(entry)) needed.set(entry, { file: d.file, at });
    });
  }
  for (const pinned of needed.keys()) {
    const listed = lock[pinned];
    if (!(pinned in pins)) ctx.report('E-MODULE-REVIEW', expFile, 'about.trust.pins', `${pinned} is in needs but about.trust.pins does not pin it${listed ? ` (the reviewed lock lists ${listed})` : ''}`);
    else if (!listed) ctx.report('E-MODULE-REVIEW', expFile, `about.trust.pins.${pinned}`, `${pinned} is not in this engine's reviewed lock`);
    else if (pins[pinned] !== listed) ctx.report('E-MODULE-REVIEW', expFile, `about.trust.pins.${pinned}`, `the pin ${pins[pinned]} is not the reviewed digest ${listed}`);
  }
}

export function check(ctx) {
  const exp = ctx.experience;
  checkCalls(ctx, exp);
  checkReview(ctx, exp);
}
