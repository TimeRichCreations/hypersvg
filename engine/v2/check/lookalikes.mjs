// Drawn things that look like more than the JSON makes them (stress test B and D, K2e), warnings only:
//   W-CONTROL-DRAWN: a part that looks like a control (a button's role, or a label that says "button") with no control
//   on it, on a part around it, on a part inside it, or on a hit part that follows it (starfall's cart-hit follows the
//   cart). It draws a button that nothing presses (5.11, 6.3).
//   W-COLOR-UNMARKED (a review finding: --review): with two or more themes, a drawn fill that is exactly one of its colours but carries no colour mark (on
//   itself or a group around it). It is compared with the theme in use; a change of theme leaves it as drawn: a hard-coded colour (6.2.3, 7.7).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseXml } from '../schema/xml.mjs';
import { parseColorRole } from './drawing-rules.mjs';

// The colour mark's name as the vocabulary lists it (data-hsvg-color since K2b, D33).
const vocab = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'spec', '2.0', 'vocabularies.json'), 'utf8'));
const COLOR_MARKS = Object.keys(vocab.marks).filter(m => /^data-hsvg-color(-role)?$/.test(m));
const COLOR_MARK = COLOR_MARKS[0] ?? 'data-hsvg-color';
// #abc and #AABBCC as #aabbcc; anything else (a name, a url(...), none) as null.
const hex = (v) => {
  const m = /^\s*#([0-9a-f]{3}|[0-9a-f]{6})\s*$/i.exec(String(v ?? ''));
  if (!m) return null;
  const h = m[1].toLowerCase();
  return `#${h.length === 3 ? [...h].map(c => c + c).join('') : h}`;
};
const fillOf = (n) => n.attrs.fill ?? /(?:^|;)\s*fill\s*:\s*([^;]+)/.exec(n.attrs.style ?? '')?.[1];
// Does this element's colour mark (any listed name) give its fill a role?
const marksFill = (n) => COLOR_MARKS.some(m => n.attrs[m] !== undefined && (parseColorRole(n.attrs[m]).pairs || []).some(([paint]) => paint === 'fill'));

// The role words of a pressed thing: the action group of the role registry (vocabularies.json) and `button`, `close`.
const BUTTON_ROLES = new Set(['button', 'close', 'action', 'cta', 'primary-action', 'secondary-action', 'command', 'answer', 'next', 'back', 'restart']);
const BUTTON_LABEL = /\bbutton\b/i;

export function check(ctx) {
  const exp = ctx.experience;
  const owners = [...Object.values(exp.scenes), ...Object.values(exp.blocks), ...(exp.shell ? [exp.shell] : [])];
  for (const o of owners) {
    if (!o?.doc || !o.drawings) continue;
    const ns = o.doc.id;
    const local = (id) => (id === ns ? id : id.startsWith(`${ns}__`) ? id.slice(ns.length + 2) : id);
    // The parts a control acts on: a target, a choice option's target.
    const controlled = new Set();
    for (const c of Object.values(o.doc.controls || {})) {
      if (typeof c?.target === 'string') controlled.add(c.target);
      for (const opt of Object.values(c?.options || {})) if (typeof opt?.target === 'string') controlled.add(opt.target);
    }
    const said = new Set();
    for (const d of Object.values(o.drawings)) {
      let root;
      try { root = parseXml(d.text); } catch { continue; } // the load step reported it
      const ids = (n) => (n.attrs?.id ? [local(n.attrs.id)] : []);
      // Who follows whom (the follow mark, data-hsvg-follow, D33): a controlled
      // part that follows a drawn button, or that it follows, is its hit area.
      const follows = new Map();
      const note = (n) => { if (!n.name) return; const f = n.attrs['data-hsvg-follow']; if (n.attrs.id && typeof f === 'string') follows.set(local(n.attrs.id), f.trim().split(/\s+/)[0]); n.children.forEach(note); };
      note(root);
      const linked = (id) => [...follows].filter(([a, b]) => b === id || a === id).flatMap(([a, b]) => [a, b]);
      const inside = (n) => [...ids(n), ...(n.children || []).filter(c => c.name).flatMap(inside)];
      const walk = (n, above) => {
        if (!n.name) return;
        const id = n.attrs.id ? local(n.attrs.id) : null;
        const roles = String(n.attrs['data-hsvg-role'] ?? '').split(/\s+/).filter(Boolean);
        const label = n.attrs['data-hsvg-label'];
        const looks = n.attrs['data-hsvg-kind'] === 'part' && id && (roles.some(r => BUTTON_ROLES.has(r)) || (typeof label === 'string' && BUTTON_LABEL.test(label)));
        if (looks && !said.has(id) && ![...above, ...inside(n), ...linked(id)].some(x => controlled.has(x))) {
          said.add(id);
          const why = roles.find(r => BUTTON_ROLES.has(r)) ? `role ${roles.find(r => BUTTON_ROLES.has(r))}` : `label "${label}"`;
          ctx.report('W-CONTROL-DRAWN', d.file, `#${n.attrs.id}`, `part ${id} looks like a button (${why}) but no control acts on it, so nothing presses it: add "controls": {"${id}": {"kind": "button", "target": "${id}", "event": "..."}} in ${o.file ?? o.doc.id}, or drop the ${why.startsWith('role') ? 'role' : 'label'} if it is only a picture (5.11)`);
        }
        const next = id ? [...above, id] : above;
        n.children.forEach(c => walk(c, next));
      };
      walk(root, []);
    }
  }
  // A review finding (check.mjs --review, test.mjs), as W-TEXT-SMALL: art often draws its palette on purpose, and the
  // starter kit's blocks would make every fresh template warn.
  if (ctx.opts?.review === true || ctx.opts?.only?.includes('review')) colorsUnmarked(ctx, owners);
}

// W-COLOR-UNMARKED: the theme's colours, then every drawn fill that equals one with no fill mark on
// itself or around it. One finding per drawing and colour, naming the first part and how many more.
function colorsUnmarked(ctx, owners) {
  // The theme in use when nothing picks another, as the player finds it (src/drawing.mjs themeOf): the experience's
  // or kit's `theme`, else the first. Another theme's colours (a dark one) say nothing about a light drawing.
  const doc = ctx.experience.doc;
  const themes = doc.themes || {};
  // With one theme nothing ever changes a colour, so an unmarked one loses nothing: only a second theme (a dark one, a
  // re-skin) leaves it behind.
  if (Object.keys(themes).length < 2) return;
  const resolved = (t) => ({ ...(t?.extends && themes[t.extends] ? themes[t.extends].colorRoles : {}), ...(t?.colorRoles || {}) });
  const roles = resolved(themes[doc.theme] || Object.values(themes)[0]);
  const others = Object.values(themes).map(resolved);
  const byColor = new Map();
  for (const [role, v] of Object.entries(roles)) {
    const h = hex(v);
    // White and black are the drawn neutrals (a shine, an outline): too often the same by chance to say anything. A
    // role every theme paints alike loses nothing on a change of theme.
    if (!h || h === '#ffffff' || h === '#000000' || byColor.has(h)) continue;
    if (others.some(r => r[role] !== undefined && hex(r[role]) !== h)) byColor.set(h, role);
  }
  if (!byColor.size) return;
  for (const o of owners) {
    if (!o?.drawings) continue;
    for (const d of Object.values(o.drawings)) {
      let root;
      try { root = parseXml(d.text); } catch { continue; }
      const found = new Map(); // colour -> [where]
      const walk = (n, marked) => {
        if (!n.name || n.name === 'defs') return;
        const m = marked || marksFill(n);
        const h = hex(fillOf(n));
        if (h && !m && byColor.has(h)) { if (!found.has(h)) found.set(h, []); found.get(h).push(n); }
        n.children.forEach(c => walk(c, m));
      };
      walk(root, false);
      for (const [h, where] of found) {
        const role = byColor.get(h);
        const more = where.length > 1 ? ` and ${where.length - 1} more` : '';
        const first = where.find(w => w.attrs.id) ?? where[0];
        const at = first.attrs.id ? `#${first.attrs.id}` : `<${first.name}>`;
        ctx.report('W-COLOR-UNMARKED', d.file, first.attrs.id ? at : `${at} line ${first.line}`, `fill ${h} on ${at}${more} is the theme colour ${role}, but no colour mark says so, so a theme change leaves it as drawn: add ${COLOR_MARK}="${role}" (6.2.3), or pick another colour if it must stay`);
      }
    }
  }
}
