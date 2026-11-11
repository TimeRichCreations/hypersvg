// Kits (4.6 to 4.9, 6.3, 7.7, 9.9, A9.3). The loader reads the kit and checks the pin's id and version (E-KIT-PIN);
// this family checks the rest on files:
//   E-KIT-PIN       the pin's digest against the kit's computed digest (A9.3);
//   E-KIT-VERSION   a new kit version against the one before (checkKitVersion; the family runs it with opts.previousKit);
//   E-ROLE-KIT      a kit's role words that redefine a core role or alias (6.3);
//   E-THEME-ROLES   a kit theme without a colour or type role the kit's drawings use (7.7);
//   E-SEAL          a `with` or promotion that reaches a sealed definition's body instead of an input (4.6, 4.7);
//   E-SEAL-LEAK     a sealed body that reads or writes a name outside the block (4.6);
//   E-SEAL-DIGEST   a sealed definition in a reviewed kit with a missing or wrong digest (4.6, A9.3);
//   E-RIGHTS        a kit experience's `with` on an input no editor may change (4.8, 9.9);
//   E-RIGHTS-UNKNOWN an `editableBy` that names a right the kit does not declare (4.7, 9.9);
//   W-RIGHTS-WIDEN  a promotion's `editableBy` that adds a right the inner declaration did not name (4.7);
//   E-SETTING       a kit experience's settings item that names no knob of the kit's inputs face (5.3.2, 4.2);
//   E-CATALOGUE     the catalogue of a kit the experience pins or picks from (check/catalogue.mjs, 4.8).
// A definition a kit lists is sealed unless it says `"seal": "open"` (4.6).
import { digestOf, canonical } from './digest.mjs';
import { parse, parseTemplate, slotFormula } from '../src/formula.mjs';
import { versionStep } from '../src/kit.mjs';
import { checkCatalogue } from './catalogue.mjs';
import { blockSites, declsFor } from './formula/sites.mjs';
import { AMBIENT } from './formula/index.mjs';
import { ROLES, parseColorRole } from './drawing-rules.mjs';
import { parseXml } from '../schema/xml.mjs';
import { settingsOf } from '../src/widgets-of.mjs';

const esc = (s) => String(s).replace(/~/g, '~0').replace(/\//g, '~1');
const walkXml = (n, fn) => { if (!n.name) return; fn(n); n.children.forEach(c => walkXml(c, fn)); };

// ---------- digests (A9.3) ----------
// One digest for every tool (check/digest.mjs): the checker's E-KIT-PIN and the change tool's receipts agree.
export { canonical, documentDigest } from './digest.mjs';
// A block definition's digest, or a kit's: the document digest of its file, which follows every document it names
// (blocks, rule packs, samples and their scenes) by their own digests, and its drawings and resources by bytes.
// The inputs a use or a with may set (F1a item 6), for a message: "; its inputs are a, b" (the first 30).
const inputNames = (names) => (names.length ? `; its inputs are ${names.slice(0, 30).join(', ')}${names.length > 30 ? ` and ${names.length - 30} more` : ''}` : '; it has no inputs');

export function blockDigest(source, entry) { return digestOf(source, entry.file, entry.doc); }
export function kitDigest(source, kit) { return digestOf(source, kit.file, kit.doc); }

// ---------- seals ----------
export const isSealed = (def) => def?.doc?.seal === 'sealed' || (def?.doc?.seal === undefined && def?.kit !== undefined);
const reviewed = (kitDoc) => (kitDoc.about?.trust?.review || []).some(r => r?.status === 'candidate' || r?.status === 'accepted');

// The names a formula or template reads at its root (not member keys): [name].
function freeNames(src, mode) {
  const out = [];
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (n.k === 'name') { if (!n.hsvg) out.push(n.v); return; } // hsvg.<name> is a built-in (D22)
    if (n.k === 'mem') { walk(n.o); if (n.key.k !== 'lit') walk(n.key); return; }
    for (const v of Object.values(n)) {
      if (Array.isArray(v)) v.forEach(x => (Array.isArray(x) ? x.forEach(walk) : walk(x)));
      else if (v && typeof v === 'object') walk(v);
    }
  };
  try {
    if (typeof src !== 'string') return out;
    if (mode === 'template' || mode === 'text') { for (const s of parseTemplate(src)) if (typeof s !== 'string') walk(s.f); } else walk(parse(src));
  } catch { /* the formula family reports it */ }
  return out;
}
const OPEN_NAMES = new Set(['words', 'data', 'event', 'item', 'index', ...Object.keys(AMBIENT)]);
// The outside names a sealed definition reads or writes: [{path, name}].
export function sealLeaks(doc, decls) {
  const own = new Set([...Object.keys(doc.values || {}), ...Object.keys(doc.inputs || {}), ...Object.keys(doc.computed || {}),
    ...(doc.uses || []).map(u => u?.id), ...(doc.promote || []).map(p => p?.as || String(p?.from || '').split('/').pop())]);
  const out = [];
  for (const site of blockSites(doc, decls ? { decls } : {})) {
    for (const n of freeNames(site.src, site.mode)) if (!own.has(n) && !OPEN_NAMES.has(n)) out.push({ path: site.path, name: n });
    const target = site.expect?.decl;
    if (typeof target === 'string' && !own.has(target)) out.push({ path: site.path, name: target, write: true });
  }
  return out;
}

// What E-KIT-PIN means and how to fix it (F0): the pin says which files the experience was checked with.
const PIN_RULE = 'A pinned kit or picked library stays the library\'s: its files may not change under the pin (4.8). If you meant to change it, make a new version of the library (a new about.version) and pin that; if the files changed by mistake, put them back. Copying the new digest into the pin only hides the change.';

// ---------- versions (4.8) ----------
const RANK = { patch: 1, minor: 2, major: 3 };
const same = (a, b) => canonical(a ?? null) === canonical(b ?? null);
const setEq = (a = [], b = []) => same([...a].sort(), [...b].sort());
// The class a change from one input declaration to another needs, with the reasons.
function declChange(x, y, at, out) {
  const need = (c, why) => out.push({ need: c, why: `${at}: ${why}` });
  if (!setEq(x.editableBy, y.editableBy)) need('major', 'editableBy changed');
  for (const k of ['kind', 'type', 'contentType', 'step']) if (!same(x[k], y[k])) need('major', `${k} changed`);
  const bound = (k, lower) => {
    if (same(x[k], y[k])) return;
    const narrower = y[k] !== undefined && (x[k] === undefined || (lower ? y[k] > x[k] : y[k] < x[k]));
    need(narrower ? 'major' : 'minor', `${k} ${narrower ? 'narrowed' : 'widened'}`);
  };
  bound('minimum', true); bound('maximum', false); bound('maxLength', false); bound('maxItems', false);
  if (!same(x.enum, y.enum)) need((x.enum || []).some(v => !(y.enum || []).includes(v)) || (!x.enum && y.enum) ? 'major' : 'minor', 'enum changed');
  if (!same(x.initial, y.initial)) need('minor', 'initial changed');
  const seen = new Set(['editableBy', 'kind', 'type', 'contentType', 'step', 'minimum', 'maximum', 'maxLength', 'maxItems', 'enum', 'initial']);
  for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) if (!seen.has(k) && !same(x[k], y[k])) need('major', `${k} changed`);
}
function mapChange(a = {}, b = {}, at, out, { added = 'minor', changed = 'major', addedNeeds = null } = {}) {
  for (const k of Object.keys(a)) if (!(k in b)) out.push({ need: 'major', why: `${at}/${k} removed` });
  for (const k of Object.keys(b)) {
    if (!(k in a)) out.push({ need: addedNeeds ? addedNeeds(b[k]) : added, why: `${at}/${k} added` });
    else if (!same(a[k], b[k])) out.push({ need: changed, why: `${at}/${k} changed` });
  }
}
function inputsChange(a = {}, b = {}, at, out) {
  mapChange(a, b, at, out, { changed: 'patch', addedNeeds: (d) => (d?.kind !== 'trigger' && d?.initial === undefined ? 'major' : 'minor') });
  for (const k of Object.keys(a)) if (k in b) declChange(a[k], b[k], `${at}/${k}`, out);
}
function rulesChange(a = [], b = [], at, out) {
  const byId = (l) => new Map((Array.isArray(l) ? l : []).map(r => [r?.id, r]));
  const x = byId(a); const y = byId(b);
  for (const [id] of x) if (!y.has(id)) out.push({ need: 'major', why: `${at}/${id} removed` });
  for (const [id, r] of y) {
    if (!x.has(id)) out.push({ need: (r?.strength ?? 'must') === 'must' ? 'major' : 'minor', why: `${at}/${id} added (${r?.strength ?? 'must'})` });
    else if (!same(x.get(id), r)) out.push({ need: 'major', why: `${at}/${id} changed` });
  }
}
function packsChange(a = [], b = [], at, out) {
  const pins = (l) => new Map((Array.isArray(l) ? l : []).map(p => (typeof p === 'string' ? [p, null] : String(p?.use || '').split('@'))));
  const x = pins(a); const y = pins(b);
  for (const [id, v] of x) {
    if (!y.has(id)) out.push({ need: 'major', why: `${at}/${id} removed` });
    else if (v !== y.get(id)) { const s = versionStep(v, y.get(id)); out.push({ need: s === 'minor' || s === 'patch' ? s : 'major', why: `${at}/${id} moved ${v} to ${y.get(id)}` }); }
  }
  for (const [id] of y) if (!x.has(id)) out.push({ need: 'major', why: `${at}/${id} added` });
}
// The class a kit change needs: {need: 'none'|'patch'|'minor'|'major', reasons: [string]}. kit: {doc, blocks: {id: {doc}}}.
export function kitChangeClass(before, after) {
  const out = [];
  const a = before.doc; const b = after.doc;
  for (const id of Object.keys(before.blocks || {})) if (!(after.blocks || {})[id]) out.push({ need: 'major', why: `block ${id} removed` });
  for (const [id, nb] of Object.entries(after.blocks || {})) {
    const ob = before.blocks?.[id];
    if (!ob) { out.push({ need: 'minor', why: `block ${id} added` }); continue; }
    const x = ob.doc; const y = nb.doc;
    inputsChange(x.inputs, y.inputs, `${id}/inputs`, out);
    mapChange(x.outputs, y.outputs, `${id}/outputs`, out);
    mapChange(x.places, y.places, `${id}/places`, out);
    rulesChange(x.rules, y.rules, `${id}/rules`, out);
    const face = new Set(['inputs', 'outputs', 'places', 'rules', 'about']);
    const body = (d) => Object.fromEntries(Object.entries(d).filter(([k]) => !face.has(k)));
    if (!same(body(x), body(y))) out.push({ need: 'patch', why: `${id}: body changed` });
  }
  inputsChange(a.inputs, b.inputs, 'kit/inputs', out);
  if (!same(a.rights, b.rights)) out.push({ need: 'major', why: 'kit/rights changed' });
  rulesChange(a.rules, b.rules, 'kit/rules', out);
  packsChange(a.rulePacks, b.rulePacks, 'kit/rulePacks', out);
  mapChange(a.resources, b.resources, 'kit/resources', out, { changed: 'patch' });
  mapChange(a.themes, b.themes, 'kit/themes', out, { changed: 'patch' });
  if (!same(a.theme, b.theme)) out.push({ need: 'patch', why: 'kit/theme changed' });
  const counted = new Set(['format', 'kind', 'id', '$schema', 'about', 'blocks', 'inputs', 'rights', 'rules', 'rulePacks', 'resources', 'themes', 'theme', 'evidence', 'samples']);
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (!counted.has(k) && !same(a[k], b[k])) out.push({ need: 'major', why: `kit/${k} changed` });
  const need = out.reduce((m, o) => (RANK[o.need] > (RANK[m] || 0) ? o.need : m), 'none');
  return { need, reasons: out.filter(o => o.need === need).map(o => o.why) };
}
// E-KIT-VERSION: the new version's step must be at least the class its changes need. Returns [{code, path, message}].
export function checkKitVersion(before, after) {
  const from = before.doc.about?.version; const to = after.doc.about?.version;
  const { need, reasons } = kitChangeClass(before, after);
  const step = versionStep(from, to);
  if (step === null) return [{ code: 'E-KIT-VERSION', path: '/about/version', message: `cannot compare versions ${from} and ${to}` }];
  if (need === 'none') return step === 'down' ? [{ code: 'E-KIT-VERSION', path: '/about/version', message: `${to} is before ${from}` }] : [];
  if (step === 'down' || step === 'same' || RANK[step] < RANK[need]) {
    return [{ code: 'E-KIT-VERSION', path: '/about/version', message: `${from} to ${to} is ${step === 'same' ? 'no new version' : `a ${step} step`}; the changes need a ${need} version (${reasons.slice(0, 3).join('; ')})` }];
  }
  return [];
}

// ---------- the family ----------
export function check(ctx) {
  const { experience: exp, report } = ctx;
  const kit = exp.kit;
  const defs = { ...(kit?.blocks || {}), ...exp.blocks };
  const rightsDoc = kit ? kit.doc : exp.doc;
  const rights = rightsDoc.rights;

  if (kit) {
    // E-KIT-PIN: the digest a pin gives must be the kit's (A9.3).
    const pin = exp.own?.kit;
    if (pin?.digest) {
      const d = kitDigest(ctx.source, kit);
      if (d !== pin.digest) report('E-KIT-PIN', exp.file, '/kit/digest', `kit ${pin.id} ${pin.version} has digest ${d}, not ${pin.digest}. ${PIN_RULE}`);
    }
    // E-KIT-VERSION, when the checker is given the version before (opts.previousKit, a loaded kit).
    if (ctx.opts?.previousKit) for (const d of checkKitVersion(ctx.opts.previousKit, kit)) report(d.code, kit.file, d.path, d.message);
    // E-ROLE-KIT: a kit's role words never redefine a core role or alias (6.3).
    for (const [id, entry] of Object.entries(kit.doc.roles || {})) {
      for (const w of [id, ...(Array.isArray(entry?.aliases) ? entry.aliases : [])]) if (ROLES.has(w)) report('E-ROLE-KIT', kit.file, `/roles/${esc(id)}`, `role word "${w}" redefines a core role or alias`);
    }
    themeRoles(kit, report);
    // E-SEAL-DIGEST and E-SEAL-LEAK: the kit's sealed definitions.
    const strict = reviewed(kit.doc);
    for (const [id, def] of Object.entries(kit.blocks)) {
      if (!isSealed(def)) continue;
      const recorded = def.doc.about?.trust?.digest;
      if (strict) {
        const d = blockDigest(ctx.source, def);
        if (recorded === undefined) report('E-SEAL-DIGEST', def.file, '/about/trust', `sealed ${id} in a reviewed kit records no digest; its digest is ${d}`);
        else if (recorded !== d) report('E-SEAL-DIGEST', def.file, '/about/trust/digest', `sealed ${id} records ${recorded}, but its digest is ${d}`);
      }
      const said = new Set();
      for (const l of sealLeaks(def.doc, declsFor(def.doc, exp))) {
        const k = `${l.path}|${l.name}`;
        if (said.has(k)) continue;
        said.add(k);
        report('E-SEAL-LEAK', def.file, l.path, `sealed ${id} ${l.write ? 'writes' : 'reads'} ${l.name}, which is outside the block; pass it in as an input`);
      }
    }
    // The kit experience's own `with` values: the kit inputs, the scenes and the shell.
    const own = exp.own;
    withValues(own.with, kit.doc.inputs, null, '/with', 'kit');
    for (const [sid, s] of Object.entries(own.story?.scenes || {})) if (s && typeof s === 'object') withValues(s.with, defs[s.use]?.doc.inputs, defs[s.use], `/story/scenes/${esc(sid)}/with`, s.use);
    settings(own, exp.doc.inputs || {});
    if (own.shell && typeof own.shell === 'object') withValues(own.shell.with, defs[own.shell.use]?.doc.inputs, defs[own.shell.use], '/shell/with', own.shell.use);
  }
  // Pick-and-use (4.8, D24): each library's pin digest, and the `with` of the story scenes and shell that use a
  // picked scene or shell definition, as in a kit experience.
  const picked = exp.picked;
  if (picked && !kit) {
    (picked.own.picks || []).forEach((p, n) => {
      const k = picked.kits[p?.id];
      if (!k || !p.digest) return;
      const d = kitDigest(ctx.source, k);
      if (d !== p.digest) report('E-KIT-PIN', exp.file, `/picks/${n}/digest`, `library ${p.id} ${p.version} has digest ${d}, not ${p.digest}. ${PIN_RULE}`);
    });
    for (const [sid, s] of Object.entries(picked.own.story?.scenes || {})) if (s && typeof s === 'object' && picked.blocks[s.use]) withValues(s.with, picked.blocks[s.use].doc.inputs, picked.blocks[s.use], `/story/scenes/${esc(sid)}/with`, s.use);
    const sh = picked.own.shell;
    if (sh && typeof sh === 'object' && picked.blocks[sh.use]) withValues(sh.with, picked.blocks[sh.use].doc.inputs, picked.blocks[sh.use], '/shell/with', sh.use);
  }
  // E-CATALOGUE: the catalogue of every kit the experience pins or picks from (check/catalogue.mjs).
  for (const k of [kit, ...(kit ? [] : Object.values(picked?.kits || {}))]) {
    if (!k || typeof k.doc.catalogue !== 'string') continue;
    const file = `${k.root}/${k.doc.catalogue}`;
    const text = k.catalogue ? null : ctx.source.read(file);
    let doc = k.catalogue?.doc;
    if (!doc) {
      if (text == null) { report('E-FILE-MISSING', k.file, '/catalogue', `${file} is not found`); continue; }
      try { doc = JSON.parse(text); } catch (e) { report('E-JSON', file, '', e.message); continue; }
    }
    const blockKind = (id) => (k.blocks[id] ? k.blocks[id].doc.kind : Object.hasOwn(k.doc.blocks || {}, id) ? undefined : null);
    const exists = (rel) => !!(ctx.source.bytes ? ctx.source.bytes(`${k.root}/${rel}`) : ctx.source.read(`${k.root}/${rel}`) != null);
    for (const d of checkCatalogue(doc, k.doc, { blockKind, exists })) report(d.code, file, d.path, d.message);
  }
  // E-SETTING (5.3.2): a kit experience's settings name knobs of its inputs face, which is the kit's (4.2), or the
  // ambient voice, muted and volume; each knob once; groups declared; `when: "make"` needs an editableBy.
  function settings(own, face) {
    const s = settingsOf(own); // the settings are the widgets add-on's (addons.widgets.settings, D31)
    if (!s) return;
    const groups = s.groups || {};
    const seenKnobs = new Set();
    (Array.isArray(s.items) ? s.items : []).forEach((item, i) => {
      const at = `/addons/widgets/settings/items/${i}`;
      const decl = face[item?.knob];
      const ambient = ['voice', 'muted', 'volume', 'reducedMotion', 'timeLimits'].includes(item?.knob);
      if (!ambient && decl?.kind !== 'knob') report('E-SETTING', exp.file, `${at}/knob`, `${item?.knob} is not a knob on the kit experience's inputs face (the kit's inputs)`);
      if (seenKnobs.has(item?.knob)) report('E-SETTING', exp.file, `${at}/knob`, `${item?.knob} is in more than one item`);
      seenKnobs.add(item?.knob);
      if (item?.group !== undefined && !(item.group in groups)) report('E-SETTING', exp.file, `${at}/group`, `group ${item.group} is not declared`);
      if (item?.when === 'make' && !ambient && !(Array.isArray(decl?.editableBy) && decl.editableBy.length)) report('E-SETTING', exp.file, `${at}/when`, `${item.knob} is for making and needs an editableBy`);
    });
  }
  function withValues(map, inputs, def, at, name) {
    for (const k of Object.keys(map || {})) {
      const decl = inputs?.[k];
      if (!decl || decl.kind === 'trigger') {
        if (def === null) continue; // a kit input the kit lacks: the loader reports it (src/kit.mjs)
        const body = def && (k in (def.doc.values || {}) || k in (def.doc.computed || {}));
        if (body && isSealed(def)) report('E-SEAL', exp.file, `${at}/${esc(k)}`, `${k} is in the sealed body of ${name}, not an input; a use gives inputs only`);
        else report('E-TYPE', exp.file, `${at}/${esc(k)}`, `${k} is not an input of ${name}${inputNames(Object.keys(inputs || {}).filter(n => inputs[n]?.kind !== 'trigger'))}`);
        continue;
      }
      // A text input of a scene or shell definition takes plain words or one {{ formula }} (D31.1, src/kit.mjs).
      if (def !== null && slotFormula(decl, map[k]) === null) report('E-TYPE', exp.file, `${at}/${esc(k)}`, `input ${k} of ${name} is text: write plain words, or one {{ formula }}; for words around a value write one formula, as "{{ 'Hello ' + name }}" (5.6.1)`);
      if (!Array.isArray(decl.editableBy) || !decl.editableBy.length) report('E-RIGHTS', exp.file, `${at}/${esc(k)}`, `no editor may change ${name}'s input ${k} (its editableBy is empty); only a kit change can`);
    }
  }

  // Uses and promotions in every document, against sealed definitions (E-SEAL), the rights (E-RIGHTS-UNKNOWN) and the
  // inner declarations (W-RIGHTS-WIDEN).
  const owners = [];
  for (const s of Object.values(exp.scenes)) owners.push(s);
  for (const b of Object.values(exp.blocks)) owners.push(b);
  if (exp.shell) owners.push(exp.shell);
  const seen = new Set();
  for (const o of owners) {
    // A kit scene's document is a copy per use; the definition's file is checked once.
    const doc = o.kit !== undefined && kit?.blocks[o.use] ? kit.blocks[o.use].doc : o.doc;
    if (seen.has(o.file)) continue;
    seen.add(o.file);
    (doc.uses || []).forEach((u, i) => {
      const def = defs[u?.use];
      if (!def || !isSealed(def)) return;
      for (const k of Object.keys(u.with || {})) {
        if (k in (def.doc.inputs || {})) continue;
        if (k in (def.doc.values || {}) || k in (def.doc.computed || {})) report('E-SEAL', o.file, `/uses/${i}/with/${esc(k)}`, `${k} is in the sealed body of ${u.use}, not an input`);
      }
    });
    (doc.promote || []).forEach((p, i) => {
      const [useId, name] = String(p?.from || '').split('/');
      const u = (doc.uses || []).find(x => x?.id === useId);
      const def = u && defs[u.use];
      if (!def) return;
      const inner = def.doc.inputs?.[name];
      if (!inner && isSealed(def) && (name in (def.doc.values || {}) || name in (def.doc.computed || {}))) report('E-SEAL', o.file, `/promote/${i}/from`, `${name} is in the sealed body of ${u.use}; only inputs can be promoted`);
      if (inner && Array.isArray(p.editableBy)) {
        const added = p.editableBy.filter(r => !(inner.editableBy || []).includes(r));
        if (added.length) report('W-RIGHTS-WIDEN', o.file, `/promote/${i}/editableBy`, `the promotion adds ${added.join(', ')}, which ${u.use}'s ${name} does not name`);
      }
    });
    if (rights) rightsNamed(doc, o.file);
  }
  if (rights) {
    rightsNamed(exp.own ?? exp.doc, exp.file);
    if (kit) rightsNamed(kit.doc, kit.file);
  }
  // E-RIGHTS-UNKNOWN: every right an editableBy names is declared by the kit (or the experience made without one).
  function rightsNamed(doc, file) {
    const check = (list, at) => (Array.isArray(list) ? list : []).forEach((r, j) => {
      if (!(r in rights)) report('E-RIGHTS-UNKNOWN', file, `${at}/${j}`, `right ${r} is not declared by ${kit ? `kit ${kit.doc.id}` : 'the experience'}`);
    });
    for (const [k, d] of Object.entries(doc.inputs || {})) check(d?.editableBy, `/inputs/${esc(k)}/editableBy`);
    (doc.promote || []).forEach((p, i) => check(p?.editableBy, `/promote/${i}/editableBy`));
  }
}

// E-THEME-ROLES: every theme of the kit has every colour role and type role its drawings use (7.7).
function themeRoles(kit, report) {
  const themes = kit.doc.themes || {};
  if (!Object.keys(themes).length) return;
  const color = new Set(); const type = new Set();
  for (const def of Object.values(kit.blocks)) {
    for (const d of Object.values(def.drawings || {})) {
      let root;
      try { root = parseXml(d.text); } catch { continue; }
      walkXml(root, (n) => {
        const cr = n.attrs['data-hsvg-color'];
        if (cr !== undefined) for (const [, role] of parseColorRole(cr).pairs || []) color.add(role);
        const tr = n.attrs['data-hsvg-text-style'];
        if (tr !== undefined) type.add(tr);
      });
    }
  }
  for (const [id, t] of Object.entries(themes)) {
    const base = t?.extends && themes[t.extends] ? themes[t.extends] : {};
    const has = (k) => new Set([...Object.keys(base?.[k] || {}), ...Object.keys(t?.[k] || {})]);
    const c = has('colorRoles'); const ty = has('typeRoles');
    const missing = [...[...color].filter(r => !c.has(r)).map(r => `colour role ${r}`), ...[...type].filter(r => !ty.has(r)).map(r => `type role ${r}`)];
    if (missing.length) report('E-THEME-ROLES', kit.file, `/themes/${esc(id)}`, `theme ${id} lacks ${missing.join(', ')}, which the kit uses`);
  }
}
