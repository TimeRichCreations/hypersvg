// Shared setup for the drawing tests (w4d-*.test.mjs): the drawing fixture, loaded, started and drawn.
import { Player } from '../src/story.mjs';
import { Drawing } from '../src/drawing.mjs';
import { loadExperience } from '../src/load.mjs';
import { ok, mapSource, schemas } from './helpers.mjs';
import { files } from './browser/drawing-fixture/files.mjs';
export { NAMES } from './browser/drawing-fixture/files.mjs';

// reduced: the ambient reducedMotion from the start; edit(files): changes a copy of the fixture first.
export function setup({ reduced = false, edit = null } = {}) {
  const f = structuredClone(files);
  edit?.(f);
  const loaded = loadExperience(mapSource(f), schemas());
  ok(loaded.experience, loaded.diags.map(d => `${d.code} ${d.message}`).join('; '));
  const p = new Player(loaded.experience);
  p.state.ambient.reducedMotion = reduced;
  ok(p.start().ok);
  const d = new Drawing(p);
  d.mountScene('one');
  return { p, d };
}
export const useSvg = (d, addr) => d.frames[addr].root;
export const attrs = (n, ...ks) => ks.map(k => n.attrs[k]);
// The translate-x a paint wrote on a part (0 when none).
export const tx = (n) => { const m = /translate\(([-\d.e]+) /.exec(n.attrs.transform || ''); return m ? Number(m[1]) : 0; };
