// Sound lengths in the checker (2.6): OGG (Vorbis, Opus) and MP3 (frames, Xing, VBRI). E-RESOURCE over soundMsEach.
import { oggMs, mp3Ms, soundMs } from '../check/resources.mjs';
import { checkExperience } from '../check/index.mjs';
import { schemas, eq, ok, mapSource } from './helpers.mjs';

const put = (b, i, s) => { for (let k = 0; k < s.length; k++) b[i + k] = s.charCodeAt(k); };

// An Ogg file: a first page with the id header, then a last page with the granule position.
function ogg(kind, rate, granule, preSkip = 312) {
  const head = new Uint8Array(kind === 'vorbis' ? 30 : 19);
  if (kind === 'vorbis') { head[0] = 1; put(head, 1, 'vorbis'); head[12] = rate & 255; head[13] = (rate >> 8) & 255; head[14] = (rate >> 16) & 255; }
  else { put(head, 0, 'OpusHead'); head[8] = 1; head[9] = 2; head[10] = preSkip & 255; head[11] = preSkip >> 8; }
  const page = (g, body, flags) => {
    const p = new Uint8Array(27 + 1 + body.length);
    put(p, 0, 'OggS'); p[5] = flags;
    let v = BigInt(g); for (let k = 0; k < 8; k++) { p[6 + k] = Number(v & 255n); v >>= 8n; }
    p[26] = 1; p[27] = body.length; p.set(body, 28);
    return p;
  };
  const a = page(0, head, 2); const mid = page(-1n & 0xffffffffffffffffn, new Uint8Array(20), 0); const z = page(granule, new Uint8Array(10), 4);
  return Uint8Array.from([...a, ...mid, ...z]);
}

// An MP3: MPEG1 layer III, 128 kbit/s, 44100 Hz, stereo: 417 or 418 bytes a frame, 1152 samples.
function mp3(frames, { xing = null, vbri = null, id3 = false } = {}) {
  const hdr = (pad) => [0xff, 0xfb, 0x90 | (pad << 1), 0x00];
  const out = [];
  if (id3) { out.push(...[0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 20], ...new Array(20).fill(0)); }
  for (let i = 0; i < frames; i++) {
    const pad = i % 2; const size = 417 + pad;
    const f = new Uint8Array(size); f.set(hdr(pad), 0);
    if (i === 0 && xing != null) { put(f, 36, 'Xing'); f[43] = 1; f[44] = (xing >>> 24) & 255; f[45] = (xing >> 16) & 255; f[46] = (xing >> 8) & 255; f[47] = xing & 255; }
    if (i === 0 && vbri != null) { put(f, 36, 'VBRI'); f[50] = (vbri >>> 24) & 255; f[51] = (vbri >> 16) & 255; f[52] = (vbri >> 8) & 255; f[53] = vbri & 255; }
    out.push(...f);
  }
  return Uint8Array.from(out);
}

const files = (resources) => ({
  'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'x', about: { title: 'X' }, needs: [], resources, story: { start: 'a', scenes: { a: 'scenes/a/scene.json' }, ends: ['a'] } },
  'scenes/a/scene.json': { format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg' },
  'scenes/a/a.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" data-hsvg-version="2.0" data-hsvg-kind="screen"><rect id="bg" width="10" height="10" fill="#fff" data-hsvg-layer="decoration"/></svg>',
});
const D = (n) => `sha256:${String(n).repeat(64)}`;

export const tests = {
  'Ogg Vorbis: the last granule over the sample rate'() {
    eq(oggMs(ogg('vorbis', 44100, 44100 * 3)), 3000);
    eq(oggMs(ogg('vorbis', 22050, 11025)), 500);
  },
  'Ogg Opus: the last granule less the pre-skip, over 48000 Hz'() {
    eq(oggMs(ogg('opus', 0, 48000 * 2 + 312, 312)), 2000);
  },
  'Ogg: a file that is not Ogg, or has no position, gives null'() {
    eq(oggMs(new Uint8Array(100)), null);
    eq(oggMs(ogg('vorbis', 44100, 0xffffffffffffffffn).slice(0, 80)), null);
  },
  'MP3: counting frames is exact for constant bit rate, with or without an ID3 tag'() {
    // 100 frames x 1152 samples at 44100 Hz = 2612 ms (rounded).
    eq(mp3Ms(mp3(100)), 2612);
    eq(mp3Ms(mp3(100, { id3: true })), 2612);
  },
  'MP3: a Xing header gives the frame count; so does a VBRI header'() {
    eq(mp3Ms(mp3(5, { xing: 1000 })), Math.round(1000 * 1152 / 44100 * 1000));
    eq(mp3Ms(mp3(5, { vbri: 2000 })), Math.round(2000 * 1152 / 44100 * 1000));
  },
  'MP3: a file with no frame gives null'() {
    eq(mp3Ms(new Uint8Array(500)), null);
  },
  'soundMs: a declared durationMs wins over the header'() {
    eq(soundMs({ durationMs: 123 }, ogg('vorbis', 44100, 44100)), 123);
    eq(soundMs({}, ogg('vorbis', 44100, 44100)), 1000);
  },
  'the checker reports an Ogg or an MP3 over soundMsEach as E-RESOURCE'() {
    const res = {
      long: { kind: 'sound', file: 'long.ogg', digest: D(1) },
      slow: { kind: 'sound', file: 'slow.mp3', digest: D(2) },
      fine: { kind: 'sound', file: 'fine.ogg', digest: D(3) },
    };
    const bytes = { 'long.ogg': ogg('vorbis', 44100, 44100 * 31), 'slow.mp3': mp3(100, { xing: 1200000 / 1152 * 44100 / 1000 | 0 }), 'fine.ogg': ogg('vorbis', 44100, 44100 * 2) };
    // slow.mp3: Xing says about 1,200,000 ms; limit is 30,000 ms.
    const src = { ...mapSource(files(res)), bytes: (rel) => bytes[rel] ?? null };
    const r = checkExperience(src, schemas(), { only: ['resources'] });
    eq(r.diags.filter(d => d.code === 'E-RESOURCE').map(d => d.path), ['resources.long', 'resources.slow']);
    ok(r.diags.some(d => /31000 ms, over soundMsEach/.test(d.message)), 'the message names the length');
  },
};
