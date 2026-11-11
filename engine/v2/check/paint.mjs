// Painted extent (6.4, A6.1; W5-C item 6): E-PAINT, W-PAINT-OVER and E-WIDGET-PAINT.
// - E-PAINT: in a screen drawing, what paints beyond the viewBox must be `backdrop`. A component's viewBox is not a limit.
// - W-PAINT-OVER: at rest, content in front of an overlay (later in document order, boxes cross), an overlay over a
//   control's target, or an overlay over a `keep-clear` safe area.
// - E-WIDGET-PAINT: in a shell drawing, an overlay slot later in document order crosses a declared HTML widget's slot.
// E-PAINT runs only when the caller asks (opts.paint, check.mjs --paint): the three upgraded experiences draw art past
// the viewBox without a backdrop mark, so it stays off by default until they are marked (see the W5-C report).
// The measurer is in paint/. It works on boxes: a shape outlined with no fill counts as its outline, not its inside.
import { parseXml } from '../schema/xml.mjs';
import { measure } from './paint/measure.mjs';
import { overlaps } from './paint/geometry.mjs';
import { declaredWidgets } from '../src/widgets-of.mjs';

const TOL = 0.5; // drawing units of slack before a box counts as outside the viewBox
const label = (r) => (r.id ? `#${r.id}` : `<${r.name}>`);

// The parts of a record that are painted: a hollow outline is four bands, anything else its box.
function bands(r) {
  if (!r.hollow || !r.inner) return [r.box];
  const o = r.box; const i = r.inner;
  if (i.x1 <= i.x0 || i.y1 <= i.y0) return [o];
  return [
    { x0: o.x0, y0: o.y0, x1: o.x1, y1: i.y0 }, { x0: o.x0, y0: i.y1, x1: o.x1, y1: o.y1 },
    { x0: o.x0, y0: i.y0, x1: i.x0, y1: i.y1 }, { x0: i.x1, y0: i.y0, x1: o.x1, y1: i.y1 },
  ];
}
const cross = (a, b) => bands(a).some(x => bands(b).some(y => overlaps(x, y)));

export function check(ctx) {
  const exp = ctx.experience;
  const owners = [...Object.values(exp.scenes), ...Object.values(exp.blocks)];
  if (exp.shell) owners.push(exp.shell);
  const seen = new Set();
  for (const o of owners) {
    const ns = o.doc.id;
    const local = (id) => (id === ns ? id : id.startsWith(`${ns}__`) ? id.slice(ns.length + 2) : id);
    const fitted = new Map((Array.isArray(o.doc.bindings) ? o.doc.bindings : []).filter(b => b && typeof b.fit?.box === 'string' && typeof b.target === 'string').map(b => [b.target, b.fit.box]));
    const targets = new Set();
    for (const c of Object.values(o.doc.controls || {})) {
      if (!c || typeof c !== 'object') continue;
      if (typeof c.target === 'string') targets.add(c.target);
      for (const op of Object.values(c.options || {})) if (op && typeof op.target === 'string') targets.add(op.target);
    }
    for (const d of Object.values(o.drawings || {})) {
      if (seen.has(d.file)) continue;
      seen.add(d.file);
      let root;
      try { root = parseXml(d.text); } catch { continue; }
      const m = measure(root, { fitted, local });
      const said = new Set();
      const say = (code, r, msg) => { const k = `${code}|${r.id ?? r.name}|${msg}`; if (!said.has(k)) { said.add(k); ctx.report(code, d.file, label(r), msg); } };

      // E-PAINT
      if (ctx.strictPaint && root.attrs['data-hsvg-kind'] === 'screen' && m.viewBox) {
        const v = m.viewBox;
        for (const r of m.records) {
          if (r.paint === 'backdrop') continue;
          const out = [];
          if (r.box.x0 < v.x0 - TOL) out.push(`${(v.x0 - r.box.x0).toFixed(1)} left`);
          if (r.box.y0 < v.y0 - TOL) out.push(`${(v.y0 - r.box.y0).toFixed(1)} above`);
          if (r.box.x1 > v.x1 + TOL) out.push(`${(r.box.x1 - v.x1).toFixed(1)} right`);
          if (r.box.y1 > v.y1 + TOL) out.push(`${(r.box.y1 - v.y1).toFixed(1)} below`);
          if (out.length) say('E-PAINT', r, `${label(r)} paints ${out.join(', ')} of the viewBox in the ${r.paint} layer${r.text ? ' (text start point)' : ''}${r.filtered ? ' (filter region)' : ''}; only backdrop may bleed (6.4)`);
        }
      }

      // W-PAINT-OVER
      const overlays = m.records.filter(r => r.paint === 'overlay');
      for (const ov of overlays) {
        for (const r of m.records) {
          if (r === ov || r.paint === 'overlay' || r.paint === 'backdrop' || r.paint === 'decoration') continue;
          if (r.order > ov.order && cross(ov, r)) say('W-PAINT-OVER', ov, `content ${label(r)} is in front of the overlay ${label(ov)} (6.4)`);
          else if (r.order < ov.order && r.chain.some(c => targets.has(c)) && cross(ov, r)) say('W-PAINT-OVER', ov, `the overlay ${label(ov)} covers the control ${label(r)} (6.4)`);
        }
        for (const a of m.areas) if (/keep-clear/.test(a.mode) && bands(ov).some(b => overlaps(b, a.box))) say('W-PAINT-OVER', ov, `the overlay ${label(ov)} covers a keep-clear safe area ${label(a)} (6.4)`);
      }

      // E-WIDGET-PAINT
      if (o === exp.shell) {
        const slotsDoc = o.doc.slots || {};
        const widgets = new Set(declaredWidgets(o.doc).map(u => u.into));
        for (const w of m.slots.filter(s => widgets.has(s.name) && s.tag === 'rect')) {
          for (const s of m.slots) {
            if (s.order > w.order && s.tag === 'rect' && slotsDoc[s.name]?.kind === 'overlay' && overlaps(s.box, w.box)) {
              ctx.report('E-WIDGET-PAINT', d.file, label(s), `the overlay slot ${s.name} comes after the declared widget slot ${w.name} and crosses it; HTML paints above the drawing (A6.1)`);
            }
          }
        }
      }
    }
  }
}
