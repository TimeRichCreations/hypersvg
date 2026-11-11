// Motion ranges drawn on parts (`data-hsvg-motion`, 6.2.1): per frame, a map from a part's local id to its channel ranges.
// A range is { lo, hi } or 'free' for rotate *. A channel a part does not list has no entry (it moves with its parent only).
import { parseXml } from '../../schema/xml.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { motionEntries, MOTION_INNER } from '../../src/physics.mjs';

// The channel words a motion range may name (vocabularies.json, data-hsvg-motion), with the axes scale covers.
export function motionChannels() {
  const v = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'spec', '2.0', 'vocabularies.json'), 'utf8'));
  return new Set(Object.keys(v.marks['data-hsvg-motion'].value.channels).map(c => MOTION_INNER[c] ?? c));
}

export function parseMotion(text) {
  const out = {};
  // Two dots, split by semicolons (D31.3, src/physics.mjs motionEntries); the old spelling is refused by the drawing check.
  for (const e of motionEntries(text) || []) {
    const ch = MOTION_INNER[e.channel] ?? e.channel; // the engine's inner channel names
    out[ch] = e.free ? 'free' : { lo: e.lo, hi: e.hi };
  }
  // `scale` covers both axes (6.2.1).
  if (out.scale) { out['scale-x'] ??= out.scale; out['scale-y'] ??= out.scale; }
  return out;
}

// [{ layout, motion: Map(localId -> {channel: range}) }] for one block.
export function motionFrames(owner) {
  const frames = [];
  const ns = owner.doc.id;
  const local = (id) => (id === ns ? id : id.startsWith(`${ns}__`) ? id.slice(ns.length + 2) : id);
  for (const [layout, d] of Object.entries(owner.drawings || {})) {
    let root;
    try { root = parseXml(d.text); } catch { continue; }
    const motion = new Map();
    const attrs = new Map(); // local id -> the part's attributes (its pivot, its leader)
    const walk = (n) => {
      if (!n.name) return;
      if (n.attrs.id) { motion.set(local(n.attrs.id), n.attrs['data-hsvg-motion'] !== undefined ? parseMotion(n.attrs['data-hsvg-motion']) : {}); attrs.set(local(n.attrs.id), n.attrs); }
      n.children.forEach(walk);
    };
    walk(root);
    frames.push({ layout, motion, attrs, local });
  }
  return frames;
}
