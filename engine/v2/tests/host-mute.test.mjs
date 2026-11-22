// The host's mute (experimental, added for 2.0.0-next.2): muted at mount and host.mute(on) silence the sound part
// (web/audio-web.mjs) over the person's own mute, and host.mute is safe on every mount, with or without sound.
// Against a fake Web Audio and a fake player, as a2-audio-web.test.mjs.
import { attachAudio } from '../web/audio-web.mjs';
import { hostApi } from '../src/host.mjs';
import { logic } from '../src/logic.mjs';
import { loadExperience } from '../src/load.mjs';
import { loadSchemas } from '../schema/load.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq, ok } from './helpers.mjs';

const SPEC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'spec', '2.0');

function fakeWin() {
  const ctxs = [];
  class Node { constructor() { this.out = []; this.onended = null; } connect(n) { this.out.push(n); return n; } disconnect() { this.out = []; } }
  class Param { constructor() { this.value = 0; } setValueAtTime(v) { this.value = v; } linearRampToValueAtTime(v) { this.value = v; } cancelScheduledValues() {} }
  class Ctx {
    constructor() { this.currentTime = 0; this.sampleRate = 48000; this.destination = new Node(); this.oscillators = []; ctxs.push(this); }
    resume() { return Promise.resolve(); }
    suspend() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
    createGain() { const n = new Node(); n.gain = new Param(); return n; }
    createOscillator() { const n = new Node(); n.frequency = new Param(); n.start = () => { n.started = true; }; n.stop = () => {}; this.oscillators.push(n); return n; }
  }
  const handlers = {};
  const doc = { hidden: false, addEventListener() {}, removeEventListener() {} };
  return { ctxs, win: { location: { href: 'http://x/' }, AudioContext: Ctx, document: doc, addEventListener: (t, f) => { handlers[t] = f; }, removeEventListener() {}, handlers } };
}
// person: the person's own mix ({music, sounds, voice}); muted by the person is all 0 (Engine.mix, 6.10).
function fakePlayer(person = { music: 1, sounds: 1, voice: 1 }) {
  const p = { scene: 'a', listeners: [], limits: { soundCopies: 4, oneShotSounds: 16 }, state: { blocks: { a: {} }, ambient: { voice: true } },
    person, mix: () => p.person, music: () => null, soundSource: () => null };
  return p;
}
const tick = () => new Promise(r => setTimeout(r, 0));
const TONE = { wave: 'sine', from: 660, to: 880, durationMs: 2000, gain: 0.5 };
// Presses a made sound; returns the level its oscillator reaches the output with (the sound's own gain node).
async function press(p, ctx) {
  for (const l of p.listeners) l({ deliveries: [{ kind: 'sound', sound: 'tone', group: 'sounds', gain: 1, address: 'a', source: { synth: TONE } }] });
  await tick(); await tick();
  const o = ctx.oscillators.at(-1);
  return { osc: o, level: () => o.out[0].out[0].gain.value }; // oscillator -> envelope -> the sound's own level
}
function setup(opts = {}, person) {
  const w = fakeWin(); const p = fakePlayer(person);
  const a = attachAudio(p, w.win, { assetsUrl: './', ...opts });
  w.win.handlers.pointerdown({ isTrusted: true });
  return { w, p, a, ctx: w.ctxs[0] };
}

export const tests = {
  async 'muted at mount: the first press makes no sound (its level is 0)'() {
    const { p, ctx } = setup({ muted: true });
    const s = await press(p, ctx);
    eq(s.level(), 0, 'the host muted the piece at mount');
    const { p: p2, ctx: ctx2 } = setup({});
    eq((await press(p2, ctx2)).level(), 1, 'without muted the same press sounds');
  },
  async 'host mute while a sound plays silences it at once; unmute lets it and the next sound play'() {
    const { p, a, ctx } = setup();
    const s = await press(p, ctx);
    eq(s.level(), 1, 'it plays');
    p.hostMute(true);
    eq(s.level(), 0, 'silent at once');
    ok(a.hostMuted, 'the audio part says the host muted it');
    const muted = await press(p, ctx);
    eq(muted.level(), 0, 'a new sound under the host mute is silent');
    p.hostMute(false);
    eq(s.level(), 1, 'the playing sound comes back');
    eq((await press(p, ctx)).level(), 1, 'the next sound plays');
  },
  async 'the host never unmutes what the person muted'() {
    const { p, ctx } = setup({}, { music: 0, sounds: 0, voice: 0 });
    const s = await press(p, ctx);
    p.hostMute(false);
    eq(s.level(), 0, 'the person muted: host.mute(false) does not unmute');
    p.person = { music: 1, sounds: 1, voice: 1 }; p.hostMute(true);
    eq(s.level(), 0, 'the person unmuted, the host muted: silent');
    p.hostMute(false);
    eq(s.level(), 1, 'neither muted: it plays');
  },
  'host.mute on a player without sound does nothing and does not throw; a wrong value is E-TYPE'() {
    const p = { exp: { doc: {} }, on() {}, onOutcome: null };
    const host = hostApi(p);
    host.mute(true); host.mute(false); host.mute();
    let code = null;
    try { host.mute('yes'); } catch (e) { code = e.code; }
    eq(code, 'E-TYPE');
    host.destroy();
    host.mute(true); // a destroyed mount: nothing, no throw
    let heard = null;
    const q = { exp: { doc: {} }, on() {}, hostMute: (on) => { heard = on; } };
    hostApi(q).mute();
    eq(heard, true, 'mute() is mute(true)');
  },
  'host.mute through logic() (no sound part) does nothing and changes no state'() {
    const files = {
      'experience.json': JSON.stringify({ format: 'hsvg/2.0', kind: 'experience', id: 'quiet', story: { start: 'a', scenes: { a: 'a.json' }, endless: true } }),
      'a.json': JSON.stringify({ format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg' }),
      'a.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" data-hsvg-version="2.0" data-hsvg-kind="screen"><rect width="10" height="10" data-hsvg-layer="backdrop"/></svg>',
    };
    const loaded = loadExperience({ read: (r) => files[r] ?? null }, loadSchemas(SPEC));
    eq(loaded.diags.filter(d => d.code.startsWith('E-')), []);
    const run = logic(loaded.experience, { epochMs: 0 });
    run.start();
    const before = JSON.stringify(run.state()); const print = run.fingerprint();
    run.host.mute(true); run.host.mute(false);
    eq(JSON.stringify(run.state()), before, 'no state change');
    eq(run.fingerprint(), print, 'the same fingerprint');
  },
};
