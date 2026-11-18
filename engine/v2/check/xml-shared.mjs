// The checker's drawing reader: the same tree for the same text (parseXml of schema/xml.mjs), frozen. The player does not
// use it. Plain ES module.
import { parseXml } from '../schema/xml.mjs';
// The same tree for the same text, frozen, for readers that only read it (the checker's passes each read every
// drawing). A few recent texts are kept; a text that does not parse throws each time, as parseXml does.
const shared = new Map();
// Each element is linked to its parent first (the root to null), as the passes that walk up the tree link it; they
// leave a link that is already right as it is.
const freeze = (n, parent) => {
  if (n.name) { n.parent = parent; for (const c of n.children) freeze(c, n); Object.freeze(n.children); Object.freeze(n.attrs); Object.freeze(n.attrOrder); }
  return Object.freeze(n);
};
export function parseXmlShared(src) {
  const hit = shared.get(src);
  if (hit) return hit;
  const root = freeze(parseXml(src), null);
  if (shared.size >= 32) shared.delete(shared.keys().next().value);
  shared.set(src, root);
  return root;
}
