// D22 for events (5.9, 5.12): the bare built-in events `paused`, `resumed`, `returned` and `playEnded` are reserved
// as event names, so an author's own event never shares an `on` key with them. Every built-in event added after 2.0
// is `hsvg:<name>`, which no author name can be. E-NAME-RESERVED at the declaration or the producer.
import { walkBehaviour, ptr } from './walk.mjs';

export const RESERVED_EVENTS = new Set(['paused', 'resumed', 'returned', 'playEnded']);

// report(path, name): one call per declaration or producer of a reserved event name in the document.
export function reservedEvents(doc, report) {
  const hit = (name, path) => { if (typeof name === 'string' && RESERVED_EVENTS.has(name)) report(path, name); };
  for (const [n, o] of Object.entries(doc.outputs || {})) if (o?.kind === 'event') hit(n, ptr('outputs', n));
  for (const [n, i] of Object.entries(doc.inputs || {})) if (i?.kind === 'trigger') hit(n, ptr('inputs', n));
  for (const [id, c] of Object.entries(doc.controls || {})) {
    hit(c?.event, ptr('controls', id, 'event'));
    hit(c?.missEvent, ptr('controls', id, 'missEvent'));
    for (const [o, opt] of Object.entries(c?.options || {})) hit(opt?.event, ptr('controls', id, 'options', o, 'event'));
  }
  for (const [id, clip] of Object.entries(doc.clips || {})) (Array.isArray(clip?.markers) ? clip.markers : []).forEach((m, i) => hit(m?.event, ptr('clips', id, 'markers', String(i), 'event')));
  (Array.isArray(doc.bindings) ? doc.bindings : []).forEach((b, i) => (Array.isArray(b?.markers) ? b.markers : []).forEach((m, k) => hit(m?.event, ptr('bindings', String(i), 'markers', String(k), 'event'))));
  for (const [id, line] of Object.entries(doc.addons?.lines?.lines || {})) for (const [vid, v] of Object.entries(line?.voices || {})) (Array.isArray(v?.words) ? v.words : []).forEach((w, k) => hit(w?.event, ptr('addons', 'lines', 'lines', id, 'voices', vid, 'words', String(k), 'event')));
  // Every action that names an event it produces: emit (an AI answer is ai:answered, which no author name can be).
  walkBehaviour(doc, { action(a, path) { if ((a.as ?? 'event') === 'event') hit(a.emit, `${path}/emit`); } });
}
