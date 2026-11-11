// Route places and video regions are core drawing words (D28): any drawing may carry them, whatever its needs. One
// that nothing uses is ignored by the engine, and the checker warns (W-PLACE-UNUSED). A place is used when its block's
// JSON names it anywhere: a route key of a track or binding, a video binding's target, the block's `places` list, a
// rule's subject, a capability's settings, or the experience's JSON. Names are read as words of the JSON's strings, so
// a formula counts too.
import { parseXml } from '../schema/xml.mjs';
import { boxOf } from '../src/marks.mjs';

const WORD = /[a-z][a-z0-9]*(?:-[a-z0-9]+)*/g;
function words(node, out) {
  if (typeof node === 'string') { for (const m of node.matchAll(WORD)) out.add(m[0]); return out; }
  if (Array.isArray(node)) { node.forEach(x => words(x, out)); return out; }
  if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) { out.add(k); words(v, out); }
  return out;
}

export function check(ctx) {
  const { experience: exp, report } = ctx;
  const owners = [...Object.values(exp.scenes || {}), ...Object.values(exp.blocks || {}), ...(exp.shell ? [exp.shell] : [])];
  let shared = null; // the experience's own JSON may name a place too
  for (const o of owners) {
    const ns = o.doc?.id;
    const local = (x) => (x === ns ? x : x.startsWith(`${ns}__`) ? x.slice(ns.length + 2) : x);
    let named = null;
    for (const d of Object.values(o.drawings || {})) {
      let root; try { root = parseXml(d.text); } catch { continue; }
      const walk = (n) => {
        if (!n.name) return;
        const kind = n.attrs['data-hsvg-route'] !== undefined ? `route place (data-hsvg-route="${n.attrs['data-hsvg-route']}")` : boxOf(n.attrs) === 'video' ? 'video box (data-hsvg-fit="video")' : null;
        if (kind && n.attrs.id) {
          named ??= words(o.doc, new Set(shared ??= words(exp.doc, new Set())));
          const id = local(n.attrs.id);
          if (!named.has(id)) report('W-PLACE-UNUSED', d.file, n.attrs.id, `the ${kind} ${id} is used by nothing in ${ns}, so the engine ignores it: name it (a route key, a video binding's target, the block's places) or remove the mark`);
        }
        n.children.forEach(walk);
      };
      walk(root);
    }
  }
}
