// Role schemas on components (6.3 rule 5): E-ROLE-SCHEMA. Theme type roles (7.7): each font a type role names is a
// font resource in scope (themeFonts below): E-REF-UNKNOWN.
// A component whose root carries a role that has a role schema declares the schema's required fields as content
// inputs named `<prefix>.<field>`, with the schema's type and `contentType` and bounds no wider, and binds each
// required field in every layout. The role schemas are in vocabularies.json (`roles`); aliases resolve to the id.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseXml } from '../schema/xml.mjs';
import { roleOf } from '../src/marks.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const vocab = JSON.parse(fs.readFileSync(path.join(here, '..', '..', '..', 'spec', '2.0', 'vocabularies.json'), 'utf8'));
const BY_WORD = new Map();
for (const r of vocab.roles) if (r.schema && r.prefix) for (const w of [r.id, ...(r.aliases || [])]) BY_WORD.set(w, r);

const walk = (n, fn) => { if (!n.name) return; fn(n); n.children.forEach(c => walk(c, fn)); };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A theme's type role names its font by resource id (7.7; 2.6 "Used by id"): its `font` and each `byLanguage` font is
// a font resource the package carries, in the theme's scope: the experience's resources, and for a kit's themes the
// kit's (Q1 Request 6). A name that is no resource, or a resource of another kind, is E-REF-UNKNOWN.
function themeFonts(exp, report) {
  const kitThemes = exp.kit?.doc?.themes || {};
  const own = exp.own ?? exp.doc;
  for (const [tid, t] of Object.entries(exp.doc.themes || {})) {
    const fromKit = !!kitThemes[tid] && !(own.themes || {})[tid];
    const file = fromKit ? exp.kit.file : (exp.file || 'experience.json');
    const scope = { ...(exp.kit?.doc?.resources || {}), ...(own.resources || {}) };
    for (const [role, r] of Object.entries(t?.typeRoles || {})) {
      const fonts = [['font', r?.font], ...Object.entries(r?.byLanguage || {}).map(([lang, f]) => [`byLanguage/${lang}`, f])];
      for (const [at, name] of fonts) {
        if (typeof name !== 'string') continue;
        const res = scope[name];
        if (res?.kind === 'font') continue;
        report('E-REF-UNKNOWN', file, `/themes/${tid}/typeRoles/${role}/${at}`, res ? `the type role ${role} names ${name}, which is a ${res.kind} resource, not a font` : `the type role ${role} names the font ${name}, which the package does not carry (no font resource ${name} in scope, 7.7)`);
      }
    }
  }
}

export function check(ctx) {
  const { experience: exp, report } = ctx;
  themeFonts(exp, report);
  for (const [id, b] of Object.entries(exp.blocks)) {
    if (b.doc.kind !== 'component') continue;
    const frames = []; // [{layout, file, ids: Set(local ids), role}]
    for (const [layout, d] of Object.entries(b.drawings || {})) {
      let root;
      try { root = parseXml(d.text); } catch { continue; }
      const f = { layout, file: d.file, ids: new Set(), role: null };
      walk(root, (n) => {
        const nid = n.attrs.id;
        if (!nid) return;
        f.ids.add(nid === id ? nid : nid.startsWith(`${id}__`) ? nid.slice(id.length + 2) : nid);
        if (nid === id && roleOf(n.attrs)) f.role = roleOf(n.attrs);
      });
      frames.push(f);
    }
    const role = BY_WORD.get(frames.find(f => f.role)?.role);
    if (!role) continue;
    const inputs = b.doc.inputs || {};
    const sites = [
      ...(Array.isArray(b.doc.bindings) ? b.doc.bindings : []).map(x => ({ target: x?.target, text: JSON.stringify(x) })),
      ...Object.values(b.doc.controls || {}).map(x => ({ target: x?.target, text: JSON.stringify(x?.label ?? '') })),
    ];
    for (const [field, schema] of Object.entries(role.schema)) {
      if (!schema.required) continue;
      const name = `${role.prefix}.${field}`;
      const decl = inputs[name];
      const say = (at, msg) => report('E-ROLE-SCHEMA', b.file, at, `role ${role.id}: ${msg} (6.3 rule 5)`);
      if (!decl || typeof decl !== 'object') { say('/inputs', `the component ${id} does not declare the required content field "${name}"`); continue; }
      const at = `/inputs/${name}`;
      if (decl.kind !== 'content') say(at, `"${name}" must be a content field`);
      if (decl.type !== schema.type) say(`${at}/type`, `"${name}" must be ${schema.type}, not ${decl.type}`);
      const wantCt = schema.contentType ?? (schema.type === 'string' ? 'text' : undefined);
      const haveCt = decl.contentType ?? (decl.type === 'string' ? 'text' : undefined);
      if (wantCt && haveCt !== wantCt) say(`${at}/contentType`, `"${name}" must have contentType ${wantCt}, not ${haveCt}`);
      if (schema.maxLength !== undefined && !(typeof decl.maxLength === 'number' && decl.maxLength <= schema.maxLength)) say(`${at}/maxLength`, `"${name}" must have maxLength ${schema.maxLength} or less`);
      if (schema.maximum !== undefined && !(typeof decl.maximum === 'number' && decl.maximum <= schema.maximum)) say(`${at}/maximum`, `"${name}" must have maximum ${schema.maximum} or less`);
      if (schema.minimum !== undefined && !(typeof decl.minimum === 'number' && decl.minimum >= schema.minimum)) say(`${at}/minimum`, `"${name}" must have minimum ${schema.minimum} or more`);
      // Bound in every layout: a binding or control label reads the field. A reader whose target is not drawn in
      // some layout is E-LAYOUT-MISSING (refs.mjs); here, a field that nothing reads is bound in no layout.
      const reads = new RegExp(`(^|[^A-Za-z0-9_.])${esc(name)}(?![A-Za-z0-9_])`);
      if (!sites.some(s => reads.test(s.text))) say('/bindings', `the required field "${name}" is bound in no layout: no binding or control reads it`);
    }
  }
}
