// Limits (9.8, 9.8.1): the engine's limits come from spec/2.0/limits.json; an experience raises capacity limits,
// a host profile allows them, the checker and the schemas follow the raised values, and the packer and the player
// refuse a package the host does not allow (E-HOST-LIMIT). No browser.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { limitsModule, target } from '../tools/make-limits.mjs';
import { FORMAT, UP_TO, raisedLimits, refusedLimits } from '../src/limits.mjs';
import { Player } from '../src/story.mjs';
import { loadExperience } from '../src/load.mjs';
import { checkExperience } from '../check/index.mjs';
import { wavMs } from '../check/resources.mjs';
const { createWorld } = await addonCode('../src/capabilities/physics.mjs', import.meta.url) ?? {};
import { pack, PackError } from '../tools/pack.mjs';
import { repo, schemas, eq, ok, throwsCode, mapSource, addonCode } from './helpers.mjs';

// A minimal experience on disk-like maps: one scene, and the given extra keys and files.
const files = (extra = {}, more = {}) => ({
  'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'x', about: { title: 'X' }, needs: [], story: { start: 'a', scenes: { a: 'scenes/a/scene.json' }, ends: ['a'] }, ...extra },
  'scenes/a/scene.json': { format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg' },
  'scenes/a/a.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" data-hsvg-version="2.0" data-hsvg-kind="screen"><rect id="bg" width="10" height="10" fill="#fff" data-hsvg-layer="decoration"/></svg>',
  ...more,
});
// A source that also gives bytes, for the resource rules.
const withBytes = (map, bytes) => ({ ...mapSource(map), bytes: (rel) => bytes[rel] ?? null });
const DIGEST = `sha256:${'0'.repeat(64)}`;
const codes = (diags) => diags.filter(d => d.code.startsWith('E-')).map(d => d.code);
// A PCM WAV header for ms milliseconds at 8 kHz mono 8-bit, with size bytes in all.
const wav = (ms, size = 44 + ms * 8) => {
  const b = new Uint8Array(size);
  const put = (i, s) => { for (let k = 0; k < s.length; k++) b[i + k] = s.charCodeAt(k); };
  const u32 = (i, v) => { b[i] = v & 255; b[i + 1] = (v >> 8) & 255; b[i + 2] = (v >> 16) & 255; b[i + 3] = (v >>> 24) & 255; };
  put(0, 'RIFF'); u32(4, size - 8); put(8, 'WAVE'); put(12, 'fmt '); u32(16, 16); u32(28, 8000); put(36, 'data'); u32(40, ms * 8);
  return b;
};

export const tests = {
  'src/limits.mjs is the one made from spec/2.0/limits.json (run tools/make-limits.mjs after set-limit.mjs)'() {
    ok(fs.readFileSync(target, 'utf8') === limitsModule(), 'engine/v2/src/limits.mjs is stale');
    eq([FORMAT.soundBytesEach, FORMAT.eventsPerTransaction, FORMAT.seatQuestions, 'eventsPerTransaction' in UP_TO], [200000, 100, 64, false]);
  },
  'a package raises each limit to the largest value its experiences ask for; safety and out-of-range values are ignored'() {
    eq(raisedLimits([{ limits: { soundBytesAll: 3000000, eventsPerTransaction: 500 } }, { limits: { soundBytesAll: 5000000, soundBytesEach: 100 } }]), { soundBytesAll: 5000000 });
    eq(raisedLimits([{ limits: { soundBytesEach: UP_TO.soundBytesEach + 1 } }]), {});
  },
  'the player refuses a raised limit the host does not allow, and plays with the experience\'s value, not the host\'s (9.8.1)'() {
    const loaded = () => loadExperience(mapSource(files({ limits: { physicsBodies: 40 } })), schemas()).experience;
    throwsCode(() => new Player(loaded()), 'E-HOST-LIMIT');
    throwsCode(() => new Player(loaded(), { host: { limits: { physicsBodies: 36 } } }), 'E-HOST-LIMIT');
    const p = new Player(loaded(), { host: { limits: { physicsBodies: 100 } } });
    eq([p.limits.physicsBodies, p.limits.soundBytesEach], [40, FORMAT.soundBytesEach]);
    ok(p.start().ok);
    eq(refusedLimits({}, null), []);
  },
  'physics refuses more bodies than the player\'s limit'() {
    const config = { bodies: Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`b${i}`, { target: 't' }])) };
    const fail = (code, m) => { const e = new Error(m); e.code = code; throw e; };
    throwsCode(() => createWorld(config, () => null, () => ({}), fail, 32), 'E-RANGE');
    throwsCode(() => createWorld(config, () => null, () => ({}), fail, 40), 'E-MOTION-RANGE'); // past the count, on to the next check
  },
  'the schemas follow the raised limits: more synths than 64 pass only when the experience raises audioSynths'() {
    const synths = Object.fromEntries(Array.from({ length: 70 }, (_, i) => [`s${i}`, { wave: 'sine', from: 440, to: 440, durationMs: 100, gain: 0.5 }]));
    const plain = loadExperience(mapSource(files({ needs: ['synth'], audioSynths: synths })), schemas());
    ok(codes(plain.diags).length > 0, 'expected a schema error for 70 synths');
    const raised = loadExperience(mapSource(files({ needs: ['synth'], audioSynths: synths, limits: { audioSynths: 80 } })), schemas());
    eq(codes(raised.diags), []);
    eq(raised.experience.limits.audioSynths, 80);
  },
  'a raised limit outside its range, or a safety limit, is refused by the schema (E-RANGE, E-KEY-UNKNOWN)'() {
    eq(codes(loadExperience(mapSource(files({ limits: { audioSynths: UP_TO.audioSynths + 1 } })), schemas()).diags), ['E-RANGE']);
    eq(codes(loadExperience(mapSource(files({ limits: { eventsPerTransaction: 200 } })), schemas()).diags), ['E-KEY-UNKNOWN']);
  },
  'the checker measures resources against the experience\'s limits (2.6, E-RESOURCE)'() {
    const res = { resources: { big: { kind: 'sound', file: 'sounds/big.wav', digest: DIGEST }, long: { kind: 'sound', file: 'sounds/long.wav', digest: DIGEST } } };
    const bytes = { 'sounds/big.wav': wav(1000, 250000), 'sounds/long.wav': wav(40000, 100000) };
    eq(wavMs(bytes['sounds/long.wav']), 40000);
    const plain = checkExperience(withBytes(files(res), bytes), schemas(), { only: ['resources'] });
    eq(plain.diags.filter(d => d.code === 'E-RESOURCE').map(d => d.path), ['resources.big', 'resources.long']);
    ok(plain.diags.some(d => /a host may let the experience raise soundBytesEach/.test(d.message)), 'the message names the limit to raise');
    const raised = checkExperience(withBytes(files({ ...res, limits: { soundBytesEach: 300000, soundMsEach: 60000 } }), bytes), schemas(), { only: ['resources'] });
    eq(raised.diags.filter(d => d.code === 'E-RESOURCE'), []);
    eq(codes(raised.diags), []);
    const all = checkExperience(withBytes(files({ resources: { a: { kind: 'sound', file: 'a.wav', digest: DIGEST }, b: { kind: 'sound', file: 'b.wav', digest: `sha256:${'1'.repeat(64)}` } } }), { 'a.wav': wav(1, 199000), 'b.wav': wav(1, 199000) }), schemas(), { only: ['resources'] });
    eq(codes(all.diags), []);
    // Eleven sounds of 199,000 bytes each pass one by one, but together pass soundBytesAll (2,000,000).
    const ids = 'abcdefghijk'.split('');
    const many = Object.fromEntries(ids.map((k, i) => [k, { kind: 'sound', file: `${k}.wav`, digest: `sha256:${i.toString(16).repeat(64)}` }]));
    const over = checkExperience(withBytes(files({ resources: many }), Object.fromEntries(ids.map(k => [`${k}.wav`, wav(1, 199000)]))), schemas(), { only: ['resources'] });
    eq(over.diags.map(d => [d.code, d.path]), [['E-RESOURCE', 'resources']]);
  },
  async 'the packer refuses a package its --host profile does not allow, and embeds the profile it is given'() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-limits-'));
    const out = path.join(dir, 'out');
    try {
      fs.cpSync(path.join(repo, 'engine', 'v2', 'tests', 'pack-fixture'), path.join(dir, 'exp'), { recursive: true });
      const ef = path.join(dir, 'exp', 'experience.json');
      fs.writeFileSync(ef, JSON.stringify({ ...JSON.parse(fs.readFileSync(ef, 'utf8')), limits: { soundBytesAll: 3000000 } }, null, 2));
      try { await pack(path.join(dir, 'exp'), out); throw new Error('packed without a host'); } catch (e) { ok(e instanceof PackError && /E-HOST-LIMIT/.test(e.message), e.message); }
      const host = JSON.stringify({ format: 'hsvg/2.0', kind: 'host-profile', id: 'kiosk', limits: { soundBytesAll: 4000000 } });
      const r = await pack(path.join(dir, 'exp'), out, { host });
      ok(fs.readFileSync(r.htmlPath, 'utf8').includes('"limits":{"soundBytesAll":4000000}'), 'the page holds the host profile');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  },
};
