// The add-on door on files (D23, spec chapter 12). The loader has already read each pinned add-on's manifest, checked
// it and expanded every preset (src/load.mjs, src/addons.mjs); its findings name the preset. This family adds what
// needs the add-on's files and the whole experience:
// - E-ADDON: an add-on folder holds a file that is not text; its files do not hash to the experience's pin (the fix
//   gives the digest to pin, after review); its code reaches outside its door (tools/addons.mjs scanCode); its code is
//   over capabilityBundleBytes (gzip 9 of its code files; the packer measures the built bundle); a block's
//   addons.<id> names an add-on the experience does not pin, or one that is not a capability, or does not fit the
//   manifest's keys; a channel names a value the block does not have.
// The digest is checked when the source can show the add-on's folder (a folder source: src/load.mjs folderSource).
import { knownAbsent } from './absent.mjs';
import { Validator } from '../schema/validate.mjs';
import { addonDigest, checkAddonFiles } from '../tools/addons.mjs';
import { allDocs, isObj } from './story/model.mjs';
import { builtinGrammar, wordsAt, doorView } from './builtins.mjs';

export function check(ctx) {
  const exp = ctx.experience;
  const addons = exp.addons || {};
  const pinsAt = (pinned) => `about.trust.pins.${pinned}`;
  for (const [id, a] of Object.entries(addons)) {
    const dir = ctx.source?.addonDir?.(id);
    if (!dir) continue;
    const digest = addonDigest(dir);
    if (a.digest !== digest) ctx.report('E-ADDON', exp.file || 'experience.json', pinsAt(a.pinned), `the files of ${a.pinned} hash to ${digest}, not the pinned ${a.digest}: if you reviewed the change, pin "${a.pinned}": "${digest}" (node engine/v2/tools/addon.mjs pin <experience folder>)`);
    for (const f of checkAddonFiles(dir, a.manifest.kind)) ctx.report(f.code, `addons/${id}/${f.file}`, '', f.message);
  }
  // A block's settings for capability add-ons: addons.<id>, checked against the manifest's keys.
  for (const d of allDocs(exp)) {
    if (d.doc.addons === undefined) continue;
    if (!isObj(d.doc.addons)) continue; // the schema reports it
    const values = new Set([...Object.keys(isObj(d.doc.values) ? d.doc.values : {}), ...(d.kind === 'scene' || d.doc.kind === 'shell' ? Object.keys(isObj(exp.doc.values) ? exp.doc.values : {}) : [])]);
    for (const [id, given] of Object.entries(d.doc.addons)) {
      const at = `addons.${id}`;
      if (!id.includes('.')) { builtinPocket(ctx, d, id, given); continue; }
      const a = addons[id];
      if (!a) { ctx.report('E-ADDON', d.file, at, `${id} is not an add-on this experience pins: pin it in about.trust.pins as ${id}@<version>`); continue; }
      if (a.manifest.kind !== 'capability' || !a.manifest.adds.keys) { ctx.report('E-ADDON', d.file, at, `${id} takes no settings: only a capability add-on whose manifest declares keys does`); continue; }
      for (const f of new Validator().validate(a.manifest.adds.keys, given)) ctx.report(f.code, d.file, `${at}${f.path ? `.${f.path.replace(/^\//, '').replace(/\//g, '.')}` : ''}`, `${f.message} (the settings of ${id}; its manifest's keys say what fits)`);
      for (const c of a.manifest.adds.writes || a.manifest.adds.channels || []) {
        const v = isObj(given) ? given[c] : undefined;
        if (typeof v === 'string' && !values.has(v)) ctx.report('E-ADDON', d.file, `${at}.${c}`, `${id} writes the value ${v}, which ${d.id} does not declare: add it to values (a number the add-on writes) or name another`);
      }
    }
  }
  for (const d of allDocs(exp)) { checkDraws(ctx, exp, d); checkContentTypes(ctx, exp, d); }
}

// The needs that cover a document (10.11 rule 1): its own, and the experience's for the experience, a scene or the shell.
const needIds = (exp, d) => {
  const ids = (doc) => (Array.isArray(doc?.needs) ? doc.needs : []).filter(n => typeof n === 'string' && !n.startsWith('font:')).map(n => n.split('@')[0]);
  return new Set([...ids(d.doc), ...(d.kind === 'scene' || d.doc.kind === 'shell' || d.doc === exp.doc ? ids(exp.doc) : [])]);
};

// Door 2 draws (D31.5): a binding that names an add-on as its kind, {"target": part, "<id>": {...}}. Its object fits
// the add-on's draws.binding, and the add-on is in needs. A built-in's binding key is placed in the schemas when it
// declares draws; an outside add-on's key is any owner.name (the schema's patternProperties), checked here.
function checkDraws(ctx, exp, d) {
  (Array.isArray(d.doc.bindings) ? d.doc.bindings : []).forEach((b, i) => {
    if (!isObj(b)) return;
    for (const k of Object.keys(b)) {
      if (!k.includes('.')) continue;
      const at = `bindings[${i}].${k}`;
      if (!isObj(b[k])) continue; // not a door-2 draw: an add-on binding word (D34), refined in renamed.mjs
      const v = doorView(exp, k);
      if (!v) { ctx.report('E-ADDON', d.file, at, `${k} is not a capability add-on this experience pins: pin it in about.trust.pins as ${k}@<version> and name it in needs`); continue; }
      if (!v.draws?.binding) { ctx.report('E-ADDON', d.file, at, `${k} draws nothing: only an add-on whose manifest declares draws paints a binding`); continue; }
      if (!needIds(exp, d).has(k)) ctx.report('E-NEEDS-MISSING', d.file, at, `this binding is drawn by ${k}, which needs does not name: add ${k}@<version> to needs`);
      for (const f of new Validator().validate(v.draws.binding, b[k])) ctx.report(f.code, d.file, `${at}${f.path ? `.${f.path.replace(/^\//, '').replace(/\//g, '.')}` : ''}`, `${f.message} (a binding drawn by ${k}; its manifest's draws.binding says what fits)`);
    }
  });
}

// Door 2 content types (D31.5): an input or value whose contentType is an outside add-on's (<owner.name>.<type>) needs
// that add-on in needs, a manifest that declares the type, and the declared value type.
function checkContentTypes(ctx, exp, d) {
  for (const k of ['inputs', 'values']) for (const [name, decl] of Object.entries(isObj(d.doc[k]) ? d.doc[k] : {})) {
    const ct = decl?.contentType;
    if (typeof ct !== 'string' || ct.split('.').length !== 3) continue;
    const id = ct.slice(0, ct.lastIndexOf('.'));
    const type = ct.slice(ct.lastIndexOf('.') + 1);
    const at = `${k}.${name}.contentType`;
    const v = doorView(exp, id);
    const t = v?.contentTypes?.[type];
    if (!t) { ctx.report('E-ADDON', d.file, at, `${ct} is not a content type of a capability add-on this experience pins: ${v ? `${id} declares ${Object.keys(v.contentTypes).join(', ') || 'none'}` : `pin ${id}`}`); continue; }
    if (!needIds(exp, d).has(id)) ctx.report('E-NEEDS-MISSING', d.file, at, `the content type ${ct} belongs to ${id}, which needs does not name`);
    if (decl.type !== undefined && decl.type !== t.type) ctx.report('E-TYPE', d.file, `${k}.${name}.type`, `${ct} holds a ${t.type}, not a ${decl.type}`);
  }
}

// A built-in capability's settings pocket (D28): addons.<name>, a bare name. The schemas check it against the
// manifest's grammar.addons.<name> when needs names the capability (stage 1); here: a bare name that is no built-in
// with settings, and each key of controls names a drag control of the block (physics, E-REF-UNKNOWN).
function builtinPocket(ctx, d, id, given) {
  const at = `addons.${id}`;
  if (knownAbsent(id)?.owns?.blockFields?.includes(`addons.${id}`)) return; // settings of an add-on not in this release: by name only
  if (!builtinGrammar(id)?.addons?.[id]) { ctx.report('E-ADDON', d.file, at, `${id} is a bare name, so it names a built-in capability, but no built-in takes settings under it: an outside add-on's id is owner.name`); return; }
  if (!isObj(given) || !isObj(given.controls)) return;
  const controls = isObj(d.doc.controls) ? d.doc.controls : {};
  for (const c of Object.keys(given.controls)) {
    if (controls[c]?.kind !== 'drag') ctx.report('E-REF-UNKNOWN', d.file, `${at}.controls.${c}`, `${c} is not a drag control of ${d.id}: ${id}'s controls are keyed by the id of a drag control`);
  }
}

// The schemas' findings inside a built-in's pocket name the capability and where its words are listed (D28).
export function refinePocketDiags(diags) {
  return diags.map(f => {
    const m = /^\/?addons[./]([a-z][a-z0-9-]*)(?:[./]|$)/.exec(f.path || '');
    if (!m || !builtinGrammar(m[1])?.addons?.[m[1]]) return f;
    if (f.code === 'E-KEY-UNKNOWN') return { ...f, message: `${f.message}: it is not a word of the ${m[1]} capability's settings; its words are listed in ${wordsAt(m[1])}` };
    if (f.code === 'E-KEY-REQUIRED' || f.code === 'E-TYPE' || f.code === 'E-RANGE') return { ...f, message: `${f.message} (the settings of the ${m[1]} capability, listed in ${wordsAt(m[1])})` };
    return f;
  });
}
