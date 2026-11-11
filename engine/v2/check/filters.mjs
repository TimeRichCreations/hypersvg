// W-MOUNT-LIMIT (9.8): the checker estimates each scene's (and the shell's) filter surface from the files, as play
// measures it (src/limits-runtime.mjs filterSurface): the sum of the filter regions of every filtered element over the
// player box. A component used in a slot counts its own surface times the slot's share of the scene's area. Over the
// experience's filterSurface limit (4 by default, or as it raises it), play would refuse the mount with E-MOUNT-LIMIT;
// the checker warns first. It is an estimate: text and missing references are left out, as at play.
import { parseXml } from '../schema/xml.mjs';
import { filterSurface } from '../src/limits-runtime.mjs';
import { activeLimits, raisedLimits } from '../src/limits.mjs';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const parse = (text) => { try { return parseXml(text); } catch { return null; } };
const vbArea = (root) => { const v = String(root?.attrs?.viewBox || '').trim().split(/[\s,]+/).map(Number); return v.length === 4 && v[2] > 0 && v[3] > 0 ? v[2] * v[3] : 0; };

// The surface of a block's drawing (its first frame), with its uses' surfaces in their slots. depth guards nesting.
function surface(entry, exp, frameText, depth = 0) {
  const root = parse(frameText);
  if (!root) return 0;
  let ratio = filterSurface(root).ratio;
  const area = vbArea(root);
  if (!area || depth > 4) return ratio;
  const slots = new Map();
  (function walk(n) { if (!n?.name) return; const s = n.attrs['data-hsvg-slot']; if (s && n.name === 'rect') slots.set(s, (Number(n.attrs.width) || 0) * (Number(n.attrs.height) || 0)); n.children.forEach(walk); })(root);
  for (const u of Array.isArray(entry.doc.uses) ? entry.doc.uses : []) {
    const def = exp.blocks?.[u?.use];
    const slot = slots.get(u?.into);
    const text = def && (def.drawings?.main?.text || Object.values(def.drawings || {})[0]?.text);
    if (!def || !slot || !text) continue;
    ratio += surface(def, exp, text, depth + 1) * (slot / area);
  }
  return ratio;
}

export function check(ctx) {
  const exp = ctx.experience;
  if (!exp) return;
  const limit = activeLimits(exp.raised ?? raisedLimits([exp.doc])).filterSurface;
  const owners = [...Object.values(exp.scenes || {}), ...(exp.shell ? [exp.shell] : [])];
  for (const o of owners) {
    for (const [layout, d] of Object.entries(isObj(o.drawings) ? o.drawings : {})) {
      if (typeof d?.text !== 'string') continue;
      const r = surface(o, exp, d.text);
      if (r > limit) ctx.report('W-MOUNT-LIMIT', d.file || o.file, 'svg', `the filter surface of ${o.doc.id} (${layout}) is about ${r.toFixed(2)} times the player box, over the mount limit ${limit}; play would refuse it (E-MOUNT-LIMIT, 9.8)`);
    }
  }
}
