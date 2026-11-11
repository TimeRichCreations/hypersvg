// The media capability (A2.1, 2.6, 5.10, 6.8), as far as files show it:
// - video resources: an MP4 or WebM file whose signature matches its suffix, with durationMs (at most 24 hours),
//   width and height that match the file's header, and the digest of its bytes (E-RESOURCE); all video files of the
//   package together at most 256 MiB (10.8, E-RESOURCE); a poster names an image resource and each captions entry a
//   captions resource in that language (E-REF-UNKNOWN); a captions file is WebVTT with the digest of its bytes
//   (E-RESOURCE);
// - media bindings ({"target", "media": {video, markers, ...}}, door 2 draws, D31): the target is a drawn <rect> with data-hsvg-fit="video" in every layout (E-PLACE); one binding
//   per place (E-ID-DUPLICATE); a literal video id names a video resource in scope (E-REF-UNKNOWN); a marker lies
//   within the length of every video the binding can show (E-RANGE);
// - the calls media.play, media.pause and media.seek name (quoted) a place of their block, that is, the target of one
//   of its media bindings (E-REF-UNKNOWN); a literal media.seek atMs lies within the longest video the place can show (E-RANGE; a formula's range is proven
//   with the other formulas, formula/sites.mjs);
// A drawn video region is core drawing (D28): one that no video binding uses is W-PLACE-UNUSED (places.mjs).
import crypto from 'node:crypto';
import { parseXml } from '../schema/xml.mjs';
import { walkBehaviour } from './refs/walk.mjs';
import { packageNeeds, capabilityNames } from '../src/capabilities.mjs';
import { callName } from './builtins.mjs';
import { boxOf } from '../src/marks.mjs';

export const VIDEO_MAX_MS = 86400000; // 2.6
export const VIDEO_BYTES_ALL = 256 * 1048576; // 10.8: all video members of a package (not yet in limits.json)

const sha = (b) => `sha256:${crypto.createHash('sha256').update(b).digest('hex')}`;
const join = (dir, rel) => {
  const out = [];
  for (const p of [...(dir ? dir.split('/') : []), ...rel.split('/')]) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); }
  return out.join('/');
};
const dirOf = (rel) => rel.split('/').slice(0, -1).join('/');
const literal = (src) => { const m = /^\s*'([^']*)'\s*$/.exec(String(src)) || /^\s*"([^"]*)"\s*$/.exec(String(src)); return m ? m[1] : null; };
const esc = (s) => String(s).replace(/~/g, '~0').replace(/\//g, '~1');

// ---------- headers ----------
// WebM (Matroska, EBML): {kind: 'webm', durationMs, width, height}; null when the bytes are not EBML.
export function webmInfo(b) {
  if (b.length < 4 || b[0] !== 0x1a || b[1] !== 0x45 || b[2] !== 0xdf || b[3] !== 0xa3) return null;
  const vint = (i, keepMarker) => {
    const first = b[i];
    if (first === undefined) return null;
    let len = 1; while (len <= 8 && !(first & (0x80 >> (len - 1)))) len++;
    if (len > 8) return null;
    let v = keepMarker ? first : first & (0xff >> len);
    let unknown = v === (0xff >> len);
    for (let k = 1; k < len; k++) { v = v * 256 + b[i + k]; if (b[i + k] !== 0xff) unknown = false; }
    return { v, len, unknown: !keepMarker && unknown };
  };
  const uint = (i, n) => { let v = 0; for (let k = 0; k < n; k++) v = v * 256 + b[i + k]; return v; };
  const out = { kind: 'webm', durationMs: null, width: null, height: null };
  let scale = 1000000; let duration = null;
  const CONTAINERS = new Set([0x18538067, 0x1549a966, 0x1654ae6b, 0xae, 0xe0]);
  const walk = (start, end) => {
    let i = start;
    while (i < end) {
      const id = vint(i, true); if (!id) return;
      const size = vint(i + id.len, false); if (!size) return;
      const body = i + id.len + size.len;
      const stop = size.unknown ? end : Math.min(end, body + size.v);
      if (id.v === 0x1f43b675) return; // a Cluster: the header is over
      if (CONTAINERS.has(id.v)) walk(body, stop);
      else if (id.v === 0x2ad7b1) scale = uint(body, size.v);
      else if (id.v === 0x4489) { const dv = new DataView(b.buffer, b.byteOffset + body, size.v); duration = size.v === 4 ? dv.getFloat32(0) : dv.getFloat64(0); }
      else if (id.v === 0xb0 && out.width === null) out.width = uint(body, size.v);
      else if (id.v === 0xba && out.height === null) out.height = uint(body, size.v);
      i = stop;
    }
  };
  walk(0, b.length);
  if (duration !== null) out.durationMs = Math.round((duration * scale) / 1e6);
  return out;
}
// MP4 (ISO BMFF): {kind: 'mp4', durationMs, width, height} from mvhd and the first tkhd with a size; null when the
// bytes have no ftyp box.
export function mp4Info(b) {
  const at = (i) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
  if (b.length < 12 || at(4) !== 'ftyp') return null;
  const u32 = (i) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
  const u64 = (i) => u32(i) * 4294967296 + u32(i + 4);
  const out = { kind: 'mp4', durationMs: null, width: null, height: null };
  const walk = (start, end) => {
    let i = start;
    while (i + 8 <= end) {
      let size = u32(i); const type = at(i + 4); let head = 8;
      if (size === 1) { size = u64(i + 8); head = 16; } else if (size === 0) size = end - i;
      if (size < head) return;
      const body = i + head;
      if (type === 'moov' || type === 'trak') walk(body, Math.min(end, i + size));
      else if (type === 'mvhd') {
        const v1 = b[body] === 1;
        const scale = u32(body + (v1 ? 20 : 12));
        const dur = v1 ? u64(body + 24) : u32(body + 16);
        if (scale) out.durationMs = Math.round((dur * 1000) / scale);
      } else if (type === 'tkhd' && !out.width) {
        const off = body + (b[body] === 1 ? 88 : 76);
        const w = u32(off) / 65536; const h = u32(off + 4) / 65536;
        if (w && h) { out.width = Math.round(w); out.height = Math.round(h); }
      }
      i += size;
    }
  };
  walk(0, b.length);
  return out;
}
export const videoInfo = (b) => webmInfo(b) || mp4Info(b);

// ---------- the family ----------
export function check(ctx) {
  const { experience: exp, source, report } = ctx;
  const needsMedia = capabilityNames(packageNeeds(exp)).includes('media');
  const owners = [...Object.values(exp.scenes), ...Object.values(exp.blocks)];
  if (exp.shell) owners.push(exp.shell);
  const docs = [{ file: exp.file, doc: exp.doc }, ...owners];
  const bytes = (rel) => (typeof source.bytes === 'function' ? source.bytes(rel) : null);

  // Resources by owner: what a block can name (its own, then the experience's, 2.6).
  const inScope = (o, id) => {
    const own = o && o !== docs[0] ? o.doc.resources?.[id] : undefined;
    if (own) return { res: own, file: o.file };
    const top = exp.doc.resources?.[id];
    return top ? { res: top, file: exp.file } : null;
  };

  // 1. Resources: video and captions files.
  let videoBytes = 0;
  const seen = new Set();
  for (const d of docs) {
    for (const [id, r] of Object.entries(d.doc.resources || {})) {
      if (!r || typeof r !== 'object' || typeof r.file !== 'string') continue;
      const where = `/resources/${esc(id)}`;
      const rel = join(dirOf(d.file), r.file);
      if (r.kind === 'video') {
        for (const k of ['durationMs', 'width', 'height']) if (typeof r[k] !== 'number') report('E-RESOURCE', d.file, `${where}`, `video ${id} needs ${k}, measured from its file (2.6)`);
        if (typeof r.durationMs === 'number' && r.durationMs > VIDEO_MAX_MS) report('E-RESOURCE', d.file, `${where}/durationMs`, `video ${id} is ${r.durationMs} ms, over 24 hours (86,400,000 ms, 2.6)`);
        if (r.poster !== undefined) { const p = inScope(d, r.poster); if (!p || p.res.kind !== 'image') report('E-REF-UNKNOWN', d.file, `${where}/poster`, `video ${id}: poster ${r.poster} is not an image resource in scope (2.6)`); }
        for (const [lang, cid] of Object.entries(r.captions || {})) {
          const c = inScope(d, cid);
          if (!c || c.res.kind !== 'captions') report('E-REF-UNKNOWN', d.file, `${where}/captions/${esc(lang)}`, `video ${id}: ${cid} is not a captions resource in scope (2.6)`);
          else if (c.res.language !== lang) report('E-RESOURCE', d.file, `${where}/captions/${esc(lang)}`, `video ${id}: captions ${cid} are in ${c.res.language}, not ${lang}`);
        }
        const b = bytes(rel);
        if (!b) continue; // a missing file is reported by the references rules
        if (!seen.has(rel)) { seen.add(rel); videoBytes += b.length; }
        const ext = rel.split('.').pop().toLowerCase();
        const info = videoInfo(b);
        if (!['mp4', 'webm'].includes(ext)) report('E-RESOURCE', d.file, `${where}/file`, `video ${id}: ${rel} is not .mp4 or .webm (2.6)`);
        else if (!info || info.kind !== ext) report('E-RESOURCE', d.file, `${where}/file`, `video ${id}: ${rel} does not start like a ${ext === 'mp4' ? 'MP4 (an ftyp box)' : 'WebM (an EBML header)'} file`);
        else {
          if (info.durationMs !== null && typeof r.durationMs === 'number' && Math.abs(info.durationMs - r.durationMs) > 1) report('E-RESOURCE', d.file, `${where}/durationMs`, `video ${id}: the file plays ${info.durationMs} ms, not ${r.durationMs}`);
          for (const k of ['width', 'height']) if (info[k] !== null && typeof r[k] === 'number' && info[k] !== r[k]) report('E-RESOURCE', d.file, `${where}/${k}`, `video ${id}: the file's ${k} is ${info[k]}, not ${r[k]}`);
        }
        if (typeof r.digest === 'string' && /^sha256:[0-9a-f]{64}$/.test(r.digest) && sha(b) !== r.digest) report('E-RESOURCE', d.file, `${where}/digest`, `video ${id}: ${rel} does not match its digest; its digest is ${sha(b)}`);
      } else if (r.kind === 'captions') {
        const b = bytes(rel);
        if (!b) continue;
        const text = new TextDecoder().decode(b).replace(/^﻿/, '');
        if (!/^WEBVTT(?:[ \t]|\r?\n|$)/.test(text)) report('E-RESOURCE', d.file, `${where}/file`, `captions ${id}: ${rel} is not WebVTT (it must start with WEBVTT)`);
        if (typeof r.digest === 'string' && /^sha256:[0-9a-f]{64}$/.test(r.digest) && sha(b) !== r.digest) report('E-RESOURCE', d.file, `${where}/digest`, `captions ${id}: ${rel} does not match its digest; its digest is ${sha(b)}`);
      }
    }
  }
  if (videoBytes > VIDEO_BYTES_ALL) report('E-RESOURCE', exp.file, '/resources', `all video files are ${videoBytes} bytes, over 256 MiB for one package (10.8)`);

  // 2. Places, bindings, markers and actions, per block.
  for (const o of owners) {
    const doc = o.doc;
    // Every drawn video region, and the element each local id is drawn on.
    const drawn = [];
    for (const [layout, dr] of Object.entries(o.drawings || {})) {
      let root; try { root = parseXml(dr.text); } catch { continue; }
      const ns = doc.id; const local = (x) => (x === ns ? x : x.startsWith(`${ns}__`) ? x.slice(ns.length + 2) : x);
      const nodes = new Map(); const regions = [];
      const walk = (n) => { if (!n.name) return; if (n.attrs.id) nodes.set(local(n.attrs.id), n); if (boxOf(n.attrs) === 'video') regions.push(n); n.children.forEach(walk); };
      walk(root);
      drawn.push({ layout, file: dr.file, nodes, regions });
    }
    const places = new Map(); // place -> {binding, lengths}
    (Array.isArray(doc.bindings) ? doc.bindings : []).forEach((b, i) => {
      // A media binding (door 2 draws, D31): {"target", "media": {video, markers, ...}}, read flat.
      if (!b || typeof b !== 'object' || !b.media || typeof b.media !== 'object' || typeof b.media.video !== 'string' || typeof b.target !== 'string') return;
      const bd = { ...b.media, id: b.id, target: b.target };
      const p = `/bindings/${i}`;
      const m = `${p}/media`;
      if (places.has(bd.target)) report('E-ID-DUPLICATE', o.file, `${p}/target`, `binding ${bd.id ?? `#${i}`}: ${bd.target} is already the place of binding ${places.get(bd.target).binding}; a place shows one video`);
      for (const f of drawn) {
        const n = f.nodes.get(bd.target);
        if (!n) continue; // the references rules report a part that is not drawn
        if (n.name !== 'rect' || boxOf(n.attrs) !== 'video') report('E-PLACE', o.file, `${p}/target`, `binding ${bd.id ?? `#${i}`}: a video plays in a drawn <rect data-hsvg-fit="video"> (5.10); ${bd.target} is a <${n.name}>${n.attrs['data-hsvg-fit'] ? ` with data-hsvg-fit="${n.attrs['data-hsvg-fit']}"` : ''} in layout ${f.layout}`);
      }
      // The videos the binding can show: a literal names one; a formula may give any video in scope.
      const id = literal(bd.video);
      let lengths;
      if (id !== null && id !== '') {
        const r = inScope(o, id);
        if (!r || r.res.kind !== 'video') report('E-REF-UNKNOWN', o.file, `${m}/video`, `binding ${bd.id ?? `#${i}`}: ${id} is not a video resource in scope (2.6)`);
        lengths = r?.res.kind === 'video' && typeof r.res.durationMs === 'number' ? [r.res.durationMs] : [];
      } else {
        lengths = [...Object.values(doc.resources || {}), ...Object.values(exp.doc.resources || {})].filter(r => r?.kind === 'video' && typeof r.durationMs === 'number').map(r => r.durationMs);
      }
      places.set(bd.target, { binding: bd.id ?? `#${i}`, longest: lengths.length ? Math.max(...lengths) : null, shortest: lengths.length ? Math.min(...lengths) : null });
      const ids = new Set();
      (Array.isArray(bd.markers) ? bd.markers : []).forEach((mk, j) => {
        if (!mk || typeof mk !== 'object') return;
        if (ids.has(mk.id)) report('E-ID-DUPLICATE', o.file, `${m}/markers/${j}/id`, `binding ${bd.id ?? `#${i}`}: marker ${mk.id} twice`);
        ids.add(mk.id);
        const short = places.get(bd.target).shortest;
        if (typeof mk.atMs === 'number' && short !== null && mk.atMs > short) report('E-RANGE', o.file, `${m}/markers/${j}/atMs`, `binding ${bd.id ?? `#${i}`}: marker ${mk.id} at ${mk.atMs} ms is past the end of a video it can show (${short} ms)`);
      });
    });
    walkBehaviour(doc, {
      action(a, path) {
        // The calls media.play, media.pause and media.seek: a place written as words names a place of the block (D31.1).
        if (!['media.play', 'media.pause', 'media.seek'].includes(a?.call)) return;
        const name = callName(exp, a, 'place');
        if (name === null) return; // a formula: checked when the call runs
        const pl = places.get(name);
        if (!pl) { report('E-REF-UNKNOWN', o.file, `${path}/with/place`, `${a.id ?? a.call}: ${name} is not a video place of ${doc.id}; no media binding targets it (A2.1)`); return; }
        const at = a.with?.atMs;
        if (a.call === 'media.seek' && typeof at === 'number' && pl.longest !== null && (at < 0 || at > pl.longest)) report('E-RANGE', o.file, `${path}/with/atMs`, `${a.id ?? a.call}: atMs ${at} is outside 0..${pl.longest}, the longest video ${name} can show`);
      },
    });
  }
}
