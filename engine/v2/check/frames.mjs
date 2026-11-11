// Frames and initial values that files can prove (6.6, 7.4, 5.1).
// - A layout for an exact `size` has a frame whose root sets `width` and `height` equal to its viewBox, and the
//   viewBox matches the size (E-SVG-ROOT, 6.6).
// - A layout `shape` that is a name must be an inline range, a name in a shape axis, or a standard shape
//   (E-REF-UNKNOWN, 7.4).
// - A value's or input's `initial` must satisfy its type and bounds (E-TYPE, E-RANGE, 5.1).
import { parseXml } from '../schema/xml.mjs';
import { STANDARD_SHAPES, parseSize, shapeMapsOf } from '../src/layout.mjs';
import { checkValue } from '../src/runtime.mjs';

export function check(ctx) {
  const { experience: exp, report } = ctx;
  const owners = [...Object.values(exp.scenes), ...Object.values(exp.blocks)];
  if (exp.shell) owners.push(exp.shell);
  for (const o of owners) {
    const maps = shapeMapsOf(o.doc, exp.doc);
    (Array.isArray(o.doc.layouts) ? o.doc.layouts : []).forEach((l, i) => {
      if (!l || typeof l !== 'object') return;
      const at = `/layouts/${i}`;
      if (typeof l.shape === 'string' && !(l.shape in STANDARD_SHAPES) && !maps.some(m => m && l.shape in m)) {
        report('E-REF-UNKNOWN', o.file, `${at}/shape`, `layout ${l.id}: "${l.shape}" is not a shape name (no shape axis names it, and it is not one of the standard shapes, 7.4)`);
      }
      if (l.size === undefined || l.drawing === undefined) return;
      const size = parseSize(l.size);
      const d = o.drawings?.[l.id];
      if (!size || !d) return; // a bad size is the schema's; a missing file is E-FILE-MISSING
      let root;
      try { root = parseXml(d.text); } catch { return; }
      const say = (msg) => report('E-SVG-ROOT', d.file, 'svg', `layout ${l.id} is for ${l.size}: ${msg} (6.6)`);
      const vb = String(root.attrs.viewBox ?? '').trim().split(/[\s,]+/).map(Number);
      // A width or height that differs from the viewBox is reported by the drawing schema; here: missing ones.
      if (root.attrs.width === undefined || root.attrs.height === undefined) say('the root must set width and height equal to its viewBox');
      if (vb.length === 4 && (vb[2] !== size.width || vb[3] !== size.height)) say(`the viewBox is ${vb[2]} x ${vb[3]}, not ${size.width} x ${size.height}`);
    });
  }
  // Initial values (5.1): literal JSON inside the type and bounds.
  // A value the author gave in a with (a kit scene's or shell's, or the kit's own) is reported at the author's key, not
  // at the library's initial (F0).
  const esc = (k) => String(k).replace(/~/g, '~0').replace(/\//g, '~1');
  const has = (w, k) => w && typeof w === 'object' && Object.hasOwn(w, k);
  const sceneKey = new Map(Object.entries(exp.scenes || {}).map(([k, s]) => [s, k]));
  const authored = (o) => (name) => {
    if (o === exp && has(exp.own?.with, name)) return `/with/${esc(name)}`;
    if (o && o === exp.shell && has(o.with, name)) return `/shell/with/${esc(name)}`;
    if (o && sceneKey.has(o) && o.use !== undefined && has(o.with, name)) return `/story/scenes/${esc(sceneKey.get(o))}/with/${esc(name)}`;
    return null;
  };
  const docs = [[exp.file, exp.doc, authored(exp)], ...owners.map(o => [o.file, o.doc, authored(o)])];
  for (const [file, doc, by] of docs) {
    for (const [kind, map] of [['values', doc.values], ['inputs', doc.inputs]]) {
      for (const [name, decl] of Object.entries(map && typeof map === 'object' ? map : {})) {
        if (!decl || typeof decl !== 'object' || decl.initial === undefined || typeof decl.type !== 'string') continue;
        if (kind === 'inputs' && decl.kind === 'trigger') continue;
        const bad = checkValue(decl, decl.initial);
        // the schema reports a wrong type; the bounds are reported here
        // A url's address (5.3.1) is checked here too: the schema sees only a string.
        if (!(bad && (bad[0] === 'E-RANGE' || (decl.contentType === 'url' && typeof decl.initial === 'string')))) continue;
        const at = kind === 'inputs' ? by(name) : null;
        const long = typeof decl.initial === 'string' && typeof decl.maxLength === 'number' && [...decl.initial].length > decl.maxLength;
        if (at) report(bad[0], exp.file, at, long ? `${name}: your text is ${[...decl.initial].length} characters; this field takes ${decl.maxLength}. Shorten it (5.1)` : `${name}: ${JSON.stringify(decl.initial)} is not valid here: ${bad[1]} (5.1)`);
        else report(bad[0], file, `/${kind}/${name}/initial`, `${kind === 'values' ? 'value' : 'input'} ${name}: initial ${JSON.stringify(decl.initial)} is not valid: ${bad[1]} (5.1)`);
      }
    }
  }
}
