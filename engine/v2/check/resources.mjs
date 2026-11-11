// Resource limits (2.6): the size of each declared file, all sounds and all fonts together, and the decoded length
// of a sound, against the experience's limits (the format values, raised where it asks, 9.8.1). E-RESOURCE.
// Needs a source with bytes(rel); without it (a packed map) the sizes are not checked here.
import { UP_TO } from '../src/limits.mjs';

const EACH = { sound: 'soundBytesEach', image: 'imageBytesEach', font: 'fontBytesEach', video: 'videoBytesEach', data: 'dataBytesEach', words: 'dataBytesEach', captions: 'dataBytesEach', 'icon-set': 'iconSetBytesEach' };
const ALL = { sound: 'soundBytesAll', font: 'fontBytesAll' };

const join = (dir, rel) => {
  const out = [];
  for (const p of [...(dir ? dir.split('/') : []), ...rel.split('/')]) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); }
  return out.join('/');
};
const dirOf = (rel) => rel.split('/').slice(0, -1).join('/');
const raise = (id) => (id in UP_TO ? `; a host may let the experience raise ${id} (limits, 9.8.1)` : '');

// The decoded length of a PCM WAV file in ms, from its header; null when the file is not one.
export function wavMs(b) {
  if (b.length < 44 || String.fromCharCode(...b.slice(0, 4)) !== 'RIFF' || String.fromCharCode(...b.slice(8, 12)) !== 'WAVE') return null;
  const u32 = (i) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24) >>> 0;
  let byteRate = null;
  for (let i = 12; i + 8 <= b.length;) {
    const id = String.fromCharCode(...b.slice(i, i + 4)); const size = u32(i + 4) >>> 0;
    if (id === 'fmt ') byteRate = u32(i + 16) >>> 0;
    if (id === 'data') return byteRate ? Math.round((size / byteRate) * 1000) : null;
    i += 8 + size + (size % 2);
  }
  return null;
}

const ascii = (b, i, n) => String.fromCharCode(...b.subarray(i, i + n));

// The decoded length of an Ogg file (Vorbis or Opus) in ms: the last page's granule position over the sample rate
// (Ogg Opus: 48000 Hz, less the pre-skip). null when the file is not a readable Ogg stream.
export function oggMs(b) {
  if (b.length < 28 || ascii(b, 0, 4) !== 'OggS') return null;
  const first = 27 + b[26]; // the first packet starts after the segment table
  let rate = null; let skip = 0;
  if (ascii(b, first + 1, 6) === 'vorbis' && b[first] === 1) rate = (b[first + 12] | (b[first + 13] << 8) | (b[first + 14] << 16) | (b[first + 15] << 24)) >>> 0;
  else if (ascii(b, first, 8) === 'OpusHead') { rate = 48000; skip = b[first + 10] | (b[first + 11] << 8); }
  if (!rate) return null;
  for (let i = b.length - 27; i >= 0; i--) {
    if (b[i] !== 0x4f || ascii(b, i, 4) !== 'OggS' || (b[i + 5] & 2)) continue; // the first page is a header, not a position
    let g = 0n;
    for (let k = 7; k >= 0; k--) g = (g << 8n) | BigInt(b[i + 6 + k]);
    if (g === 0xffffffffffffffffn) continue; // a page that ends no packet has no position
    const samples = Number(g) - skip;
    return samples < 0 ? 0 : Math.round((samples / rate) * 1000);
  }
  return null;
}

const L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BR1 = { 1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448], 2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384], 3: L3 };
const L23 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const BR2 = { 1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256], 2: L23, 3: L23 };
const RATE = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

// One frame header at i: {size, samples, rate, mono, v1} or null. layer: 1, 2 or 3.
function mpegFrame(b, i) {
  if (i + 4 > b.length || b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) return null;
  const ver = (b[i + 1] >> 3) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5, 1 = reserved
  const layer = 4 - ((b[i + 1] >> 1) & 3); // 1..3, 4 = reserved
  const bi = b[i + 2] >> 4; const ri = (b[i + 2] >> 2) & 3; const pad = (b[i + 2] >> 1) & 1;
  if (ver === 1 || layer === 4 || bi === 0 || bi === 15 || ri === 3) return null;
  const v1 = ver === 3;
  const br = (v1 ? BR1 : BR2)[layer][bi] * 1000;
  const rate = RATE[ver][ri];
  const size = layer === 1 ? (Math.floor((12 * br) / rate) + pad) * 4 : Math.floor(((layer === 3 && !v1 ? 72 : 144) * br) / rate) + pad;
  const samples = layer === 1 ? 384 : layer === 3 && !v1 ? 576 : 1152;
  return { size, samples, rate, mono: (b[i + 3] >> 6) === 3, v1, layer };
}

// The decoded length of an MP3 file in ms. A Xing, Info or VBRI header gives the frame count; else the frames are
// counted one by one. null when no frame is found.
export function mp3Ms(b) {
  let i = 0;
  if (b.length >= 10 && ascii(b, 0, 3) === 'ID3') i = 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9]) + (b[5] & 0x10 ? 10 : 0);
  let f = null;
  while (i < b.length - 4) { // find the first real frame: two headers in a row agree
    f = mpegFrame(b, i);
    if (f && (i + f.size >= b.length || mpegFrame(b, i + f.size))) break;
    f = null; i++;
  }
  if (!f) return null;
  const be = (j) => ((b[j] << 24) | (b[j + 1] << 16) | (b[j + 2] << 8) | b[j + 3]) >>> 0;
  const xing = i + 4 + (f.v1 ? (f.mono ? 17 : 32) : (f.mono ? 9 : 17));
  if (f.layer === 3 && (ascii(b, xing, 4) === 'Xing' || ascii(b, xing, 4) === 'Info') && (b[xing + 7] & 1)) return Math.round((be(xing + 8) * f.samples / f.rate) * 1000);
  if (f.layer === 3 && ascii(b, i + 36, 4) === 'VBRI') return Math.round((be(i + 50) * f.samples / f.rate) * 1000);
  let frames = 0; let samples = 0;
  while (i < b.length - 4) {
    const g = mpegFrame(b, i);
    if (!g) { i++; continue; } // junk or a tag: look for the next frame
    frames++; samples += g.samples; i += g.size;
  }
  return frames ? Math.round((samples / f.rate) * 1000) : null;
}

// A sound's length in ms: its declared durationMs, else read from its header (WAV, Ogg, MP3), else null.
export function soundMs(r, bytes) {
  if (typeof r.durationMs === 'number') return r.durationMs;
  return wavMs(bytes) ?? oggMs(bytes) ?? mp3Ms(bytes);
}

export function check(ctx) {
  const { experience: e, source, report } = ctx;
  if (typeof source.bytes !== 'function') return;
  const L = e.limits;
  const docs = [[e.file, e.doc], ...[e.shell, ...Object.values(e.scenes), ...Object.values(e.blocks)].filter(Boolean).map(b => [b.file, b.doc])];
  const seen = new Set();
  const totals = { sound: 0, font: 0 };
  for (const [file, doc] of docs) {
    for (const [id, r] of Object.entries(doc.resources || {})) {
      if (!r || typeof r.file !== 'string' || !EACH[r.kind]) continue;
      const rel = join(dirOf(file), r.file);
      const bytes = source.bytes(rel);
      if (!bytes) continue; // a missing file is reported by the references rules
      const where = `resources.${id}`;
      const each = EACH[r.kind];
      if (bytes.length > L[each]) report('E-RESOURCE', file, where, `${rel} is ${bytes.length} bytes, over ${each} (${L[each]})${raise(each)}`);
      if (r.kind === 'sound') {
        const ms = soundMs(r, bytes);
        if (ms != null && ms > L.soundMsEach) report('E-RESOURCE', file, where, `${rel} plays ${ms} ms, over soundMsEach (${L.soundMsEach})${raise('soundMsEach')}`);
      }
      if (ALL[r.kind] && !seen.has(rel)) { seen.add(rel); totals[r.kind] += bytes.length; }
    }
  }
  for (const [kind, n] of Object.entries(totals)) {
    const id = ALL[kind];
    if (n > L[id]) report('E-RESOURCE', e.file, 'resources', `all ${kind} resources are ${n} bytes, over ${id} (${L[id]})${raise(id)}`);
  }
}
