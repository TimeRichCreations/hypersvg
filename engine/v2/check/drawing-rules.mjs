// Drawing rules that files can prove (2.11, 6.2.3, 6.3, 6.5): E-A11Y-OWNED, W-A11Y-TITLE, E-A11Y-NAME, W-ROLE-UNKNOWN, E-ROLE-KIT (the experience's own roles; a kit's are in kits.mjs),
// E-COLOR-ROLE, W-COLOR-ROLE-THEME.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseXml } from '../schema/xml.mjs';
import { roleOf } from '../src/marks.mjs';

// Where a drawing finding is: the element's id, else its name and line (check.mjs --json gives the line).
const where = (n) => (n.attrs.id ? `#${n.attrs.id}` : `<${n.name}> line ${n.line}`);

const here = path.dirname(fileURLToPath(import.meta.url));
const vocab = JSON.parse(fs.readFileSync(path.join(here, '..', '..', '..', 'spec', '2.0', 'vocabularies.json'), 'utf8'));
export const ROLES = new Set([...vocab.roles.flatMap(r => [r.id, ...(r.aliases || [])]), ...Object.values(vocab.partRoles).filter(Array.isArray).flat()]);

// What each role word applies to (6.3 rule 1): part, component, slot. Aliases resolve to their entry.
const APPLIES = new Map();
for (const r of vocab.roles) if (Array.isArray(r.appliesTo)) for (const w of [r.id, ...(r.aliases || [])]) APPLIES.set(w, r.appliesTo);

const CORE_COLOR = new Set(vocab.colorRoles.core);
const CORE_TYPE = new Set(vocab.typeRoles.core);
const ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

// The paints and roles of a data-hsvg-color value (6.2.3). Returns {error} or {pairs: [[paint, role]]}.
export function parseColorRole(value) {
  const tokens = String(value).trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { error: 'the value is empty' };
  const qualified = tokens.filter(t => t.includes(':')).length;
  if (qualified && qualified !== tokens.length) return { error: 'bare and qualified forms are mixed' };
  if (!qualified && tokens.length > 1) return { error: 'a bare role is one word' };
  const pairs = []; const seen = new Set();
  for (const t of tokens) {
    const [paint, role = t, ...rest] = qualified ? t.split(':') : ['fill', t];
    if (rest.length || !role) return { error: `"${t}" is not fill:<role> or stroke:<role>` };
    if (paint !== 'fill' && paint !== 'stroke') return { error: `"${paint}" is not fill or stroke` };
    if (seen.has(paint)) return { error: `${paint} is given twice` };
    if (!ID.test(role)) return { error: `"${role}" is not a role id` };
    seen.add(paint); pairs.push([paint, role]);
  }
  return { pairs };
}

const walk = (n, fn) => { if (!n.name) return; fn(n); n.children.forEach(c => walk(c, fn)); };
const textOf = (n) => (n.name ? n.children.map(textOf).join('') : n.text || '');

export function check(ctx) {
  const exp = ctx.experience;
  const owners = [];
  for (const s of Object.values(exp.scenes)) owners.push(s);
  for (const b of Object.values(exp.blocks)) owners.push(b);
  if (exp.shell) owners.push(exp.shell);
  // A kit experience whose kit did not load (E-KIT-PIN) has no themes or roles to check against; once the kit is
  // loaded, its themes and roles are in the document (src/kit.mjs) and the checks below use them.
  const kitPinned = exp.doc.kit !== undefined && !exp.kit;
  // The experience's own themes define roles the way a kit's themes do (7.7).
  const themes = Object.values(exp.doc.themes || {});
  const colorRoles = new Set([...CORE_COLOR, ...themes.flatMap(t => Object.keys(t?.colorRoles || {}))]);
  const typeRoles = new Set([...CORE_TYPE, ...themes.flatMap(t => Object.keys(t?.typeRoles || {}))]);
  // The experience's own role words (6.3): known like the core registry's. One never redefines a core role or
  // alias (E-ROLE-KIT). A kit's roles are in the document too (src/kit.mjs); kits.mjs checks them in the kit's file.
  const known = new Set(ROLES);
  const ownRoles = exp.own ? exp.own.roles : exp.doc.roles;
  for (const [id, entry] of Object.entries(exp.doc.roles || {})) {
    for (const w of [id, ...(Array.isArray(entry?.aliases) ? entry.aliases : [])]) {
      if (ownRoles?.[id] && ROLES.has(w)) ctx.report('E-ROLE-KIT', 'experience.json', `/roles/${id}`, `role word "${w}" redefines a core role or alias`);
      known.add(w);
      if (Array.isArray(entry?.appliesTo) && !APPLIES.has(w)) APPLIES.set(w, entry.appliesTo);
    }
  }
  const seenFiles = new Set();
  const unknownRoles = new Set(); // one W-ROLE-UNKNOWN per role word in the experience, at its first drawing
  for (const o of owners) {
    const roots = [];
    for (const d of Object.values(o.drawings || {})) {
      let root;
      try { root = parseXml(d.text); } catch { continue; }
      roots.push(root);
      if (seenFiles.has(d.file)) continue;
      seenFiles.add(d.file);
      const said = new Set(); // one finding per file, code and message: a role used 500 times is one finding
      const r = (code, at, msg) => { const k = `${code}|${msg}`; if (!said.has(k)) { said.add(k); ctx.report(code, d.file, at, msg); } };
      // 2.11: the player owns role, tabindex and aria-*.
      walk(root, (n) => {
        for (const a of Object.keys(n.attrs)) {
          if (a === 'role' || a === 'tabindex' || a.startsWith('aria-')) r('E-A11Y-OWNED', where(n), `<${n.name}> carries ${a}, which the player owns`);
        }
        const cr = n.attrs['data-hsvg-color'];
        if (cr !== undefined) {
          const parsed = parseColorRole(cr);
          if (parsed.error) r('E-COLOR-ROLE', where(n), `data-hsvg-color: ${parsed.error}`);
          else if (!kitPinned) {
            for (const [, role] of parsed.pairs) {
              if (colorRoles.has(role)) continue;
              if (themes.length) r('E-COLOR-ROLE', where(n), `colour role "${role}" is defined by no theme of the experience`);
              else r('W-COLOR-ROLE-THEME', where(n), `colour role "${role}" is outside the core roles`);
            }
          }
        }
        const tr = n.attrs['data-hsvg-text-style'];
        if (tr === 'display' || tr === 'text') r('E-WORD-RENAMED', where(n), `the text style ${tr} is now ${tr === 'display' ? 'heading' : 'body'} (D37)`);
        else if (tr !== undefined && !kitPinned && !typeRoles.has(tr)) r('W-COLOR-ROLE-THEME', where(n), `text style "${tr}" is not heading, body or caption, and no theme defines it`);
        const role = roleOf(n.attrs) ?? undefined;
        if (role !== undefined && !kitPinned && !known.has(role) && !unknownRoles.has(role) && unknownRoles.add(role)) r('W-ROLE-UNKNOWN', where(n), `role "${role}" is in no registry (no kit or the experience's roles list it)`);
      });
      // 6.3 rule 1: a role word on an element of a kind its registry entry does not list warns (W5-C item 4).
      walk(root, (n) => {
        const role = roleOf(n.attrs) ?? undefined;
        const applies = role !== undefined ? APPLIES.get(role) : undefined;
        if (!applies) return;
        const kinds = [n.attrs['data-hsvg-kind'], n.attrs['data-hsvg-slot'] !== undefined ? 'slot' : undefined].filter(k => ['part', 'component', 'slot'].includes(k));
        if (kinds.length && !kinds.some(k => applies.includes(k))) {
          r('W-ROLE-UNKNOWN', where(n), `role "${role}" applies to ${applies.join(', ')}, not to a ${kinds.join(' or ')}`);
        }
      });
      // 6.5 rule 1: the root title.
      if (!root.children.some(c => c.name === 'title' && textOf(c).trim())) r('W-A11Y-TITLE', `<svg> line ${root.line}`, 'the drawing has no root <title>');
    }
    // 6.5 rule 1: a control's name is its label, its target's data-hsvg-label, or its target's only <text>.
    const parts = new Map();
    for (const root of roots) walk(root, (n) => { if (n.attrs.id) parts.set(n.attrs.id, n); });
    const ns = o.doc.id;
    const find = (id) => parts.get(id) ?? parts.get(`${ns}__${id}`);
    // 5.10: a <rect> slot carries no transform, so a clip track on it is E-PLACE (W5-C item 5).
    for (const [cname, clip] of Object.entries(o.doc.clips || {})) {
      (Array.isArray(clip?.tracks) ? clip.tracks : []).forEach((t, i) => {
        const el = typeof t?.target === 'string' ? find(t.target) : null;
        if (el && el.name === 'rect' && el.attrs['data-hsvg-slot'] !== undefined) {
          ctx.report('E-PLACE', o.file, `/clips/${cname}/tracks/${i}/target`, `track ${t.id ?? i} moves ${t.target}, a <rect> slot; a <rect> slot carries no transform, so use a <g> slot (5.10)`);
        }
      });
    }
    for (const [name, c] of Object.entries(o.doc.controls || {})) {
      if (!c || typeof c !== 'object') continue;
      if (typeof c.label === 'string' && c.label.trim()) continue;
      const t = typeof c.target === 'string' ? find(c.target) : null;
      if (!t) continue; // a missing target is E-REF-UNKNOWN, not this
      if (t.attrs['data-hsvg-label']) continue;
      const texts = [];
      walk(t, (n) => { if (n.name === 'text') texts.push(n); });
      if (texts.length === 1 && textOf(texts[0]).trim()) continue;
      ctx.report('E-A11Y-NAME', o.file, `/controls/${name}`, `control ${name} has no label, and its target ${c.target} has no data-hsvg-label or single <text>`);
    }
  }
}
