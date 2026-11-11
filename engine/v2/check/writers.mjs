// One writer per channel (5.11, 6.2.4, 6.7, 9.3): E-WRITER, as far as files show it. Per document, for local targets:
// - two `replace` tracks (the default `composite`) of one clip on one target and channel; `scale` also owns
//   `scale-x` and `scale-y`;
// - two bindings that write one property of one target (a `look`, a `channel`, `text`, `visible`, ...);
// - a binding or clip track on a channel that a binding already writes (a `replace` clip track and a channel binding);
// - a look binding or `look` clip track on a part whose looks a control owns (idle, hover, pressed, selected, focus, disabled).
// - a binding an add-on draws ({"target": part, "<addon>": {...}}, door 2) and any other binding on that part: the add-on
//   is the part's only writer;
// - an add-on channel (D39) writes the part channels its manifest's onto lists, as a binding or track of each would.
// Dotted addresses and targets in other blocks are not followed.
import { sayChannel } from './say.mjs';
import { framesOf } from './refs/drawn.mjs';
import { builtinDrawKeys, growthOf } from './builtins.mjs';
import { channelOf, propOf } from '../src/binding-words.mjs';

const CONTROL_LOOKS = new Set(['idle', 'hover', 'pressed', 'selected', 'focus', 'disabled']);
const SCALE = new Set(['scale-x', 'scale-y']);
const local = (t) => typeof t === 'string' && !/[./]/.test(t);
const INNER = { x: 'translate-x', y: 'translate-y', rotate: 'rotate', scale: 'scale', opacity: 'opacity' };
// The part channels an add-on channel <id>.<name> writes (D39), or null when the value is no declared channel.
const grown = (exp, v) => { const d = typeof v === 'string' && v.includes('.') && v !== 'motion.morph' ? growthOf(exp, v, 'paints').decl : null; return d ? d.onto.map(o => INNER[o]) : null; };

export function check(ctx) {
  const { experience: exp, report } = ctx;
  const owners = [...Object.values(exp.scenes), ...Object.values(exp.blocks)];
  if (exp.shell) owners.push(exp.shell);
  for (const o of owners) {
    const rep = (path, msg) => report('E-WRITER', o.file, path, msg);
    const frames = framesOf({ doc: o.doc, drawings: o.drawings });
    // who writes (target, property) among bindings
    const bound = new Map(); // "target|prop" -> first binding index
    const drawn = new Map(); // target -> [addon, index] of a binding an add-on draws
    const anyOn = new Map(); // target -> first binding index
    const draws = builtinDrawKeys();
    (Array.isArray(o.doc.bindings) ? o.doc.bindings : []).forEach((b, i) => {
      if (!b || typeof b !== 'object' || !local(b.target)) return;
      const name = (j) => o.doc.bindings[j].id ?? `#${j}`;
      const by = Object.keys(b).find(k => (k.includes('.') || draws.has(k)) && b[k] && typeof b[k] === 'object');
      if (drawn.has(b.target)) rep(`/bindings/${i}`, `binding ${name(i)} writes ${b.target}, which ${drawn.get(b.target)[0]} draws (binding ${name(drawn.get(b.target)[1])}): the add-on is the part's only writer`);
      else if (by && anyOn.has(b.target)) rep(`/bindings/${i}`, `binding ${name(i)} is drawn by ${by} on ${b.target}, which binding ${name(anyOn.get(b.target))} already writes: the add-on is the part's only writer`);
      if (!anyOn.has(b.target)) anyOn.set(b.target, i);
      if (by) { if (!drawn.has(b.target)) drawn.set(b.target, [by, i]); return; }
      // A colour binding with a `role` repaints only the paints marked with that role (6.8, A-22): each role is its own property.
      const g = grown(exp, Object.keys(b).find(k => k.includes('.') && typeof b[k] !== 'object'));
      for (const prop of g ?? [propOf(b)]) {
      if (!prop) return;
      const slot = `${b.target}|${prop}`;
      if (bound.has(slot)) rep(`/bindings/${i}`, `bindings ${o.doc.bindings[bound.get(slot)].id ?? `#${bound.get(slot)}`} and ${b.id ?? `#${i}`} both write ${sayChannel(prop)} of ${b.target}: one writer owns a channel (9.3)`);
      else bound.set(slot, i);
      if (prop === 'scale') for (const s of SCALE) if (bound.has(`${b.target}|${s}`)) rep(`/bindings/${i}`, `binding ${b.id ?? `#${i}`} writes scale of ${b.target}, which also owns ${sayChannel(s)} (9.3)`);
      if (SCALE.has(prop) && bound.has(`${b.target}|scale`) && bound.get(`${b.target}|scale`) !== i) rep(`/bindings/${i}`, `binding ${b.id ?? `#${i}`} writes ${sayChannel(prop)} of ${b.target}, and scale owns both axes (9.3)`);
      }
    });
    // parts whose looks a control owns
    const owned = new Map(); // target -> control name
    for (const [name, c] of Object.entries(o.doc.controls || {})) {
      if (!c) continue;
      // An option control's targets are its options' (5.11).
      const targets = c.kind === 'choice' ? Object.values(c.options || {}).map(x => x?.target) : [c.target];
      for (const t of targets) {
        if (!local(t)) continue;
        const hasLooks = frames.some(f => [...(f.looks.get(t) || [])].some(l => CONTROL_LOOKS.has(l)));
        if (hasLooks) owned.set(t, name);
      }
    }
    for (const [slot, i] of bound) {
      const [target, prop] = slot.split('|');
      if (prop === 'look' && owned.has(target)) rep(`/bindings/${i}`, `the variant of ${target} is owned by control ${owned.get(target)} (it has idle, hover, pressed, selected, focus or disabled variants): a variant binding competes (5.11)`);
    }
    // clips
    for (const [cid, clip] of Object.entries(o.doc.clips || {})) {
      const seen = new Map(); // "target|channel" -> track index (replace writers)
      (Array.isArray(clip?.tracks) ? clip.tracks : []).forEach((t, i) => {
        if (!t || !local(t.target) || typeof t.channel !== 'string') return;
        for (const ch of grown(exp, t.channel) ?? [channelOf(t)]) {
        if (!ch) return;
        const replace = (t.composite ?? 'replace') === 'replace';
        const at = `/clips/${cid}/tracks/${i}`;
        if (ch === 'look' && owned.has(t.target)) rep(at, `clip ${cid}: the variant of ${t.target} is owned by control ${owned.get(t.target)}: a variant track competes (5.11)`);
        if (!replace) return;
        if (ch === 'look' && bound.has(`${t.target}|look`)) rep(at, `clip ${cid}: a variant track and the variant binding ${o.doc.bindings[bound.get(`${t.target}|look`)].id} both write the variant of ${t.target} (6.2.4)`);
        const slot = `${t.target}|${ch}`;
        const clash = [slot, ...(ch === 'scale' ? [...SCALE].map(s => `${t.target}|${s}`) : SCALE.has(ch) ? [`${t.target}|scale`] : [])].find(k => seen.has(k));
        if (clash) rep(at, `clip ${cid}: tracks ${clip.tracks[seen.get(clash)].id ?? seen.get(clash)} and ${t.id ?? i} both replace ${sayChannel(ch)} of ${t.target}; make one an add track (6.7)`);
        else seen.set(slot, i);
        if (ch !== 'look' && bound.has(slot)) rep(at, `clip ${cid}: track ${t.id ?? i} replaces ${sayChannel(ch)} of ${t.target}, and binding ${o.doc.bindings[bound.get(slot)].id ?? `#${bound.get(slot)}`} writes it too (9.3)`);
        }
      });
    }
  }
}
