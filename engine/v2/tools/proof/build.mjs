// Packs a product with the 2.0 packer and describes the exact page the proof runs on.
// The page is never changed after packing: its digest (fingerprint) ties every trace and certificate to its bytes.
import { endsOf } from '../../src/ends.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { pack, engineSizes } from '../pack.mjs';
import { digest, digestOf } from './format.mjs';
import { raisedLimits } from '../../src/limits.mjs';

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const posix = (p) => p.split(path.sep).join('/');

// The core player's bundle, and each capability module's own cost, as the packer measures them (pack.mjs engineSizes,
// 10.11): gzip level 9, each with its limit from limits.json (coreBundleBytes, capabilityBundleBytes).
export function bundleSizes(capabilities) { return engineSizes(capabilities); }

// The story as the files declare it: start, scenes, ends, endless and links (3.1, 3.8).
export function storyOf(doc) {
  const s = doc.story;
  if (!s) return null;
  return {
    start: s.start ?? null,
    scenes: Object.keys(s.scenes || {}),
    ends: [...endsOf(s)], // without ends, every scene with no way out (D31.4)
    endless: s.endless === true || doc.endless === true,
    links: (s.links || []).map(l => ({ id: l.id ?? null, from: l.from, to: l.to, on: l.on ?? null, afterMs: l.afterMs ?? null, choice: l.choice !== undefined })),
  };
}

// The ids of an SVG text, each with the elements around it (outermost first): their ids, or slot:<name> for a slot. A small tag reader: enough
// for the drawings a checked package carries (no ids inside comments or CDATA are read).
export function svgAncestry(text) {
  const out = new Map(); const stack = [];
  const tag = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<(\/?)([A-Za-z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  for (let m; (m = tag.exec(text));) {
    if (!m[2]) continue;
    if (m[1]) { stack.pop(); continue; }
    const id = /\sid\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(m[3]);
    const here = id ? (id[1] ?? id[2]) : null;
    const slot = /\sdata-hsvg-slot\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(m[3]);
    if (here !== null && !out.has(here)) out.set(here, stack.filter(Boolean));
    if (!m[4]) stack.push(slot ? `slot:${slot[1] ?? slot[2]}` : here);
  }
  return out;
}

// Where each declared control of the scenes and the shell is drawn (5.11, 7.3): the layouts whose drawing holds its
// target (each option's target for an option control), and the dialog slot it sits in, if any. Keys as controlKey:
// addr#cid or addr#cid=option. A block without layouts has one drawing (layout null).
export function controlPlaces(folder) {
  const read = (rel) => JSON.parse(fs.readFileSync(path.join(folder, ...rel.split('/')), 'utf8'));
  const exp = read('experience.json');
  // Only scenes and a shell given as files in this folder are read; a scene from a kit (or any other form) is not.
  const docs = Object.entries(exp.story?.scenes || {}).filter(([, rel]) => typeof rel === 'string').map(([id, rel]) => ({ id, rel }));
  if (typeof exp.shell === 'string') docs.push({ id: read(exp.shell).id, rel: exp.shell });
  const places = {};
  for (const { id, rel } of docs) {
    if (!fs.existsSync(path.join(folder, ...rel.split('/')))) continue;
    const doc = read(rel);
    const dir = path.posix.dirname(rel);
    const drawings = (doc.layouts?.length ? doc.layouts : [{ id: null, drawing: doc.drawing }]).filter(l => l.drawing)
      .filter(l => typeof l.drawing === 'string' && fs.existsSync(path.join(folder, ...path.posix.join(dir, l.drawing).split('/'))))
      .map(l => ({ layout: l.id ?? null, ids: svgAncestry(fs.readFileSync(path.join(folder, ...path.posix.join(dir, l.drawing).split('/')), 'utf8')) }));
    const dialogs = Object.entries(doc.slots || {}).filter(([, sl]) => sl.kind === 'dialog').map(([k]) => k);
    const place = (target) => {
      const where = drawings.filter(d => d.ids.has(target));
      const dialog = where.flatMap(d => d.ids.get(target)).map(a => (a?.startsWith('slot:') ? a.slice(5) : null)).find(a => dialogs.includes(a)) ?? null;
      return { layouts: where.map(d => d.layout), all: where.length === drawings.length, dialog };
    };
    for (const [cid, c] of Object.entries(doc.controls || {})) {
      if (c.kind === 'choice') for (const [o, opt] of Object.entries(c.options || {})) places[`${id}#${cid}=${o}`] = place(opt.target ?? c.target);
      else places[`${id}#${cid}`] = place(c.target);
    }
  }
  return places;
}

// folder: the experience folder. out: where the page is written (outside the repo). Returns the build.
export async function buildProduct(folder, out, { acceptFindings = false } = {}) {
  folder = path.resolve(folder);
  const packed = await pack(folder, out, { acceptFindings, test: true });
  const bytes = fs.readFileSync(packed.htmlPath);
  const descriptor = JSON.parse(fs.readFileSync(packed.packagePath, 'utf8'));
  const doc = JSON.parse(fs.readFileSync(path.join(folder, 'experience.json'), 'utf8'));
  return {
    file: packed.htmlPath,
    product: { id: packed.id, folder: posix(path.relative(repo, folder)), title: doc.about?.title ?? packed.id },
    fingerprint: digest(bytes),
    package: { needs: descriptor.needs, members: Object.keys(descriptor.members).length, digest: digestOf(descriptor.members) },
    size: { raw: bytes.length, gzip9: gzipSync(bytes, { level: 9 }).length },
    bundle: packed.sizes,
    csp: packed.csp,
    findings: packed.accepted.map(d => d.code),
    story: storyOf(doc),
    raised: raisedLimits([doc]),
    places: controlPlaces(folder),
  };
}

export function verifyBuild(build) {
  if (digest(fs.readFileSync(build.file)) !== build.fingerprint) throw new Error('the packed page changed; pack again before recording or replaying');
}
