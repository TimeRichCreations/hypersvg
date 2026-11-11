// Resizable slots and picking by input, as far as files show them:
// - size (6.8, 5.10): a size binding's target is a <rect> slot or region in every frame of its block (E-PLACE).
// - input selectors (7.1): an axis entry with `select: "input"` names in `value` an input, knob, setting or value of the
//   block that declares it (or of the experience, for a scene, shell or component); its type is a string with an
//   `enum` that holds exactly the axis's options (E-AXIS-INPUT). The options are the entry's own list, else the
//   shape axis's sizes and shapes, the tiers, a block's layouts or the experience's themes (layout.mjs axisOptions).
import { parseXml } from '../schema/xml.mjs';
import { axisOptions } from '../src/layout.mjs';
import { boxOf } from '../src/marks.mjs';

const local = (t) => typeof t === 'string' && !/[./]/.test(t);

// [{layout, nodes: Map(localId -> node)}] for one block.
function frameNodes(o) {
  const ns = o.doc.id;
  const id = (x) => (x === ns ? x : x.startsWith(`${ns}__`) ? x.slice(ns.length + 2) : x);
  const out = [];
  for (const [layout, d] of Object.entries(o.drawings || {})) {
    let root;
    try { root = parseXml(d.text); } catch { continue; }
    const nodes = new Map();
    const walk = (n) => { if (!n.name) return; if (n.attrs.id) nodes.set(id(n.attrs.id), n); n.children.forEach(walk); };
    walk(root);
    out.push({ layout, nodes });
  }
  return out;
}

export function check(ctx) {
  const { experience: exp, report } = ctx;
  const owners = [...Object.values(exp.scenes), ...Object.values(exp.blocks)];
  if (exp.shell) owners.push(exp.shell);
  for (const o of owners) {
    const frames = frameNodes(o);
    (Array.isArray(o.doc.bindings) ? o.doc.bindings : []).forEach((b, i) => {
      if (!b || typeof b !== 'object' || b.scale === undefined || b.as !== 'box' || !local(b.target)) return;
      for (const f of frames) {
        const n = f.nodes.get(b.target);
        if (!n) continue; // the target check reports a missing part
        const placed = n.attrs['data-hsvg-slot'] !== undefined || boxOf(n.attrs) !== null;
        if (n.name !== 'rect' || !placed) report('E-PLACE', o.file, `/bindings/${i}/target`, `binding ${b.id ?? `#${i}`}: a scale as a box sizes a <rect> slot or fit box; ${b.target} is ${n.name === 'rect' ? 'a <rect> with no data-hsvg-slot or data-hsvg-fit mark' : `a <${n.name}>`} in layout ${f.layout} (6.8, 5.10)`);
      }
    });
  }
  // Input selectors.
  const declOf = (doc, name) => {
    for (const d of [doc, exp.doc]) {
      const x = d?.inputs?.[name] ?? d?.values?.[name];
      if (x) return x;
    }
    return null;
  };
  const docs = [[exp.file || 'experience.json', exp.doc], ...owners.map(o => [o.file, o.doc])];
  for (const [file, doc] of docs) {
    (Array.isArray(doc?.axes) ? doc.axes : []).forEach((a, i) => {
      if (a?.select !== 'input' || typeof a.value !== 'string' || a.axis === 'look') return;
      const options = axisOptions(a, a.axis === 'theme' && !doc.themes ? exp.doc : doc);
      const decl = declOf(doc, a.value);
      const where = `/axes/${i}/value`;
      if (!decl) { report('E-AXIS-INPUT', file, where, `axis ${a.id ?? a.axis}: ${a.value} is not an input, knob, setting or value here (7.1)`); return; }
      const choices = decl.type === 'string' && Array.isArray(decl.enum) ? decl.enum.map(String) : null;
      if (!choices) { report('E-AXIS-INPUT', file, where, `axis ${a.id ?? a.axis}: ${a.value} is not a choice (a string with enum) (7.1)`); return; }
      if (!options) return; // an axis with no options listed: nothing to compare
      const same = choices.length === options.length && options.every(x => choices.includes(x));
      if (!same) report('E-AXIS-INPUT', file, where, `axis ${a.id ?? a.axis}: the choices of ${a.value} (${choices.join(', ')}) are not exactly its options (${options.join(', ')}) (7.1)`);
    });
  }
}
