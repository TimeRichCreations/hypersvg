// Needs (10.11, 5.15.3): every capability the content uses is named in `needs`; a need nothing uses is a warning.
// The schemas already refuse the keys, actions, effect kinds, channels and control kinds a capability owns when its
// need is missing (stage 1). This check adds what they cannot see: capability events in `on` and in links, character
// seats, module calls, and the unused-need warning, which has to look at every file.
import { channelOf, wordOf } from '../../src/binding-words.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walk, isObj, allDocs, needNames, pathStr } from './model.mjs';
import { builtinGrammar, builtinCall, growthSites, growthOf } from '../builtins.mjs';
import { knownAbsent, absentCall } from '../absent.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(fs.readFileSync(path.join(here, '..', '..', '..', '..', 'spec', '2.0', 'capabilities.json'), 'utf8'));
const caps = registry.capabilities;
const capByName = new Map(caps.map(c => [c.name, c]));
const coreEvents = new Set(registry.coreEvents?.events || []);

const bare = (s) => s.replace(/\[.*$/, '');
const actionOwner = new Map();
const channelOwner = new Map();
const effectOwner = new Map();
const controlOwner = new Map();
const eventPatterns = [];
const contentTypeOwner = new Map();
for (const c of caps) {
  for (const t of c.contentTypes || []) contentTypeOwner.set(t, c.name);
  for (const a of c.owns.actions) actionOwner.set(bare(a), c.name);
  for (const a of c.owns.channels) channelOwner.set(a, c.name);
  for (const a of c.owns.effectKinds) effectOwner.set(a, c.name);
  for (const a of c.owns.controlKinds) controlOwner.set(a, c.name);
  for (const e of c.owns.events) {
    const re = new RegExp('^' + e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/<[^>]*>/g, '[^:]+') + '$');
    eventPatterns.push({ re, owner: c.name });
  }
}
const eventOwner = (name) => (coreEvents.has(name) ? null : eventPatterns.find(p => p.re.test(name))?.owner || null);

// A field spec such as "uses[].declared" or "controls.*[kind=drag].<key>" (capabilities.json notation).
const specTokens = (spec) => [...spec.matchAll(/\[([^\]]*)\]|([^.\[\]]+)/g)].map(m => (m[2] !== undefined ? m[2] : `[${m[1]}]`));
function hasField(node, toks) {
  if (!toks.length) return true;
  const [t, ...rest] = toks;
  if (node === null || typeof node !== 'object') return false;
  if (t === '[]') return (Array.isArray(node) ? node : Object.values(node)).some(v => hasField(v, rest));
  if (t.startsWith('[')) {
    const [k, v] = t.slice(1, -1).split('=');
    if (!Array.isArray(node) && node[k] === v) return hasField(node, rest);
    return (Array.isArray(node) ? node : Object.values(node)).some(x => isObj(x) && x[k] === v && hasField(x, rest));
  }
  if (t === '*') return Object.values(node).some(v => hasField(v, rest));
  return !Array.isArray(node) && t in node && hasField(node[t], rest);
}
const fieldSpecs = caps.map(c => ({ name: c.name, toks: c.owns.blockFields.map(specTokens) }));

// What a document uses: [{owner, path, what, gated}]. `gated` marks use the schemas already refuse without the need.
function usesIn(d, exp) {
  const out = [];
  const add = (owner, p, what, gated) => { if (owner) out.push({ owner, path: pathStr(p), what, gated }); };
  for (const f of fieldSpecs) for (const toks of f.toks) if (hasField(d.doc, toks)) add(f.name, [], `a field ${toks.join('.')}`, true);
  // The settings of a capability add-on (addons.<id>, chapter 12) are a use of it.
  if (isObj(d.doc.addons)) for (const id of Object.keys(d.doc.addons)) if (addonCode(exp, id)) add(id, ['addons', id], `the settings addons.${id}`, false);
  // A built-in's settings pocket (D28): the schemas refuse it without the need.
  if (isObj(d.doc.addons)) for (const id of Object.keys(d.doc.addons)) if (builtinGrammar(id)?.addons?.[id]) add(id, ['addons', id], `the settings addons.${id}`, true);
  // The settings of a known add-on this release does not hold: the schemas cannot see them, so this asks for the need.
  if (isObj(d.doc.addons)) for (const id of Object.keys(d.doc.addons)) if (knownAbsent(id)?.owns?.blockFields?.includes(`addons.${id}`)) add(id, ['addons', id], `the settings addons.${id}`, false);
  // D39: an add-on's control kind or channel (<id>.<name>) that its manifest declares is a use of it.
  for (const g of growthSites(d.doc)) { const x = growthOf(exp, g.value, g.slot); if (x.decl) add(x.id, g.at, `the ${g.slot === 'controls' ? 'control kind' : 'channel'} ${g.value}`, false); }
  const seats = exp.doc.addons?.seats?.seats; // the seats pocket (D31)
  // A seat's program is a logic module (10.7, A4.1): content names it in needs.
  if (d.doc === exp.doc && isObj(seats)) {
    for (const [id, s] of Object.entries(seats)) {
      for (const [n, key] of [[s?.program, 'program'], [isObj(s?.fallback) ? s.fallback.program : undefined, 'fallback.program']]) {
        if (typeof n === 'string' && capByName.get(n)?.kind === 'module') add(n, ['addons', 'seats', 'seats', id, ...key.split('.')], `the program of seat ${id}`, false);
      }
    }
  }
  // A content type a capability owns (contentTypes in the registry: richText is rich-text's), on an input or value.
  for (const k of ['inputs', 'values']) for (const [name, decl] of Object.entries(isObj(d.doc[k]) ? d.doc[k] : {})) {
    if (isObj(decl) && contentTypeOwner.has(decl.contentType)) add(contentTypeOwner.get(decl.contentType), [k, name, 'contentType'], `the content type ${decl.contentType}`, false);
  }
  walk(d.doc, (n, p) => {
    if (!isObj(n)) return;
    // Actions sit in lists under entry, exit, actions, then and else.
    for (const k of ['entry', 'exit', 'actions', 'then', 'else']) {
      if (!Array.isArray(n[k])) continue;
      n[k].forEach((a, i) => {
        if (!isObj(a)) return; // an action's id is optional (D29)
        for (const op of Object.keys(a)) {
          if (actionOwner.has(op)) add(actionOwner.get(op), [...p, k, i], `action ${op}`, true);
        }
        if (typeof a.call === 'string' && a.call.includes('.')) {
          const mod = a.call.slice(0, a.call.lastIndexOf('.'));
          if (capByName.get(mod)?.kind === 'module' || addonCode(exp, mod) || builtinCall(a.call) || absentCall(a.call, mod)) add(mod, [...p, k, i], `call ${a.call}`, false);
        }
      });
    }
    if (channelOf(n) && channelOwner.has(channelOf(n))) add(channelOwner.get(channelOf(n)), p, `the word ${wordOf(n)}`, true);
    if (typeof n.kind === 'string') {
      if (p.includes('effects') && effectOwner.has(n.kind)) add(effectOwner.get(n.kind), p, `effect kind ${n.kind}`, true);
      if (p.includes('controls') && controlOwner.has(n.kind)) add(controlOwner.get(n.kind), p, `control kind ${n.kind}`, true);
    }
    if (isObj(n.on)) {
      for (const ev of Object.keys(n.on)) add(eventOwner(ev) ?? addonEventOwner(exp, ev), [...p, 'on', ev], `event ${ev}`, false);
    }
  });
  if (d.kind === 'experience') {
    for (const [i, l] of (exp.doc.story?.links || []).entries()) if (typeof l.on === 'string') add(eventOwner(l.on), ['story', 'links', i, 'on'], `event ${l.on}`, false);
    for (const [i, c] of (exp.doc.story?.chapters || []).entries()) for (const f of ['next', 'back']) if (typeof c[f] === 'string') add(eventOwner(c[f]), ['story', 'chapters', i, f], `event ${c[f]}`, false);
  }
  return out;
}

// An outside module or capability add-on the experience pins (chapter 12), by id.
const addonCode = (exp, id) => { const a = exp.addons?.[id]; return !!a && a.manifest.kind !== 'preset'; };
const addonEventOwner = (exp, ev) => { const head = ev.slice(0, Math.max(0, ev.indexOf(':'))); return exp.addons?.[head]?.manifest.kind === 'capability' ? head : null; };

const coveredByExperience = (d) => d.kind === 'experience' || ['scene', 'shell'].includes(d.doc?.kind);

export function checkNeeds(ctx, m) {
  const exp = m.exp;
  const expNeeds = new Set(needNames(exp.doc.needs));
  const used = new Set();
  for (const d of allDocs(exp)) {
    // Whose needs cover a use (10.11 rule 1), as the loader and the engine: a document's own needs; the experience's
    // too for the experience, its scenes and its shell. A block definition names its own (it works in any experience).
    const have = new Set([...(coveredByExperience(d) ? expNeeds : []), ...needNames(d.doc.needs)]);
    for (const u of usesIn(d, exp)) {
      used.add(u.owner);
      if (!u.gated && !have.has(u.owner)) ctx.report('E-NEEDS-MISSING', d.file, u.path, `${u.what} belongs to the capability ${u.owner}, which needs does not name${knownAbsent(u.owner) ? `: list ${u.owner} in needs, although it is not in this release (it comes with the hypersvg-addons release)` : ''}`);
    }
  }
  // The give-way ladder at play (8.4, D2) is the ladder capability's: in a package that needs fit (the union of every
  // document's needs, 10.11), a give-way rule of kind fits, limit or keep runs while playing, so the package needs
  // ladder. A baked page (no fit) needs none: the packer runs the ladder.
  const all = new Set(allDocs(exp).flatMap(d => needNames(d.doc.needs)));
  if (all.has('fit')) {
    for (const d of allDocs(exp)) {
      (Array.isArray(d.doc.rules) ? d.doc.rules : []).forEach((r, i) => {
        if (!isObj(r) || r.strength !== 'give-way' || !Array.isArray(r.steps) || !['fits', 'limit', 'keep'].includes(r.kind)) return;
        used.add('ladder');
        if (!all.has('ladder')) ctx.report('E-NEEDS-MISSING', d.file, `rules[${i}]`, `the give-way rule ${r.id ?? i} runs while playing in a package that needs fit: it belongs to the capability ladder, which needs does not name`);
      });
    }
  }
  // A capability that another used one depends on is used.
  for (const n of [...used]) for (const dep of capByName.get(n)?.dependsOn || []) used.add(dep);
  // W-NEEDS-UNUSED (W4-S request 7). The package's needs are the union of every document's needs (10.11), so a need
  // is used when any document uses it, whichever document names it. Each document is judged on the needs it names.
  for (const d of allDocs(exp)) {
    (Array.isArray(d.doc.needs) ? d.doc.needs : []).forEach((entry, i) => {
      const name = needNames([entry])[0];
      if (addonCode(exp, name)) {
        if (!used.has(name)) ctx.report('W-NEEDS-UNUSED', d.file, `needs[${i}]`, `needs names the add-on ${entry}, but no document calls it or gives it settings: remove it, or use it`);
        return;
      }
      const c = capByName.get(name);
      if (!c) return;
      // Only capabilities whose use shows in the files can be judged: fit adds no content grammar.
      const o = c.owns;
      const visible = o.blockFields.length + o.actions.length + o.events.length + o.channels.length + o.effectKinds.length + o.controlKinds.length + (c.contentTypes || []).length > 0 || c.kind === 'module';
      if (visible && !used.has(name)) {
        ctx.report('W-NEEDS-UNUSED', d.file, `needs[${i}]`, `needs names ${name}, but no document in the experience uses it (the package's needs are the union of every document's needs, 10.11)`);
      }
    });
  }
}
