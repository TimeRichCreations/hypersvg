// What a block's drawings show to the checker: for each frame, the local ids, the looks of each part, the slots and
// the regions. Local ids drop the component namespace (2.12 rule 4): `pip__body` is `body`, the root `pip` stays `pip`.
import { parseXml } from '../../schema/xml.mjs';
import { boxOf, roleOf } from '../../src/marks.mjs';

// Returns [{layout, file, ids: Set, looks: Map(id -> Set(name)), slots: Set, regions: Set, icons: Set}] for one block.
export function framesOf(owner) {
  const frames = [];
  const ns = owner.doc.id;
  const local = (id) => (id === ns ? id : id.startsWith(`${ns}__`) ? id.slice(ns.length + 2) : id);
  for (const [layout, d] of Object.entries(owner.drawings || {})) {
    let root;
    try { root = parseXml(d.text); } catch { continue; } // the load step already reported a bad drawing
    const f = { layout, file: d.file, ids: new Set(), looks: new Map(), slots: new Set(), regions: new Set(), icons: new Set() };
    const walk = (n) => {
      if (!n.name) return;
      const id = n.attrs.id ? local(n.attrs.id) : null;
      if (id) {
        f.ids.add(id);
        const looks = n.children.filter(c => c.name === 'g' && c.attrs['data-hsvg-variant'] !== undefined).map(c => c.attrs['data-hsvg-variant']);
        if (looks.length) f.looks.set(id, new Set(looks));
        if (boxOf(n.attrs) !== null) f.regions.add(id);
        if (n.name === 'svg' && roleOf(n.attrs) === 'icon') f.icons.add(id); // an icon place (6.2.2)
      }
      if (n.attrs['data-hsvg-slot'] !== undefined) f.slots.add(n.attrs['data-hsvg-slot']);
      n.children.forEach(walk);
    };
    walk(root);
    frames.push(f);
  }
  return frames;
}
