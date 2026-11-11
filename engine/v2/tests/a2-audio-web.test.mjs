// web/audio-web.mjs against a fake Web Audio and a fake player: pause keeps position, the voice bus feeds the mouth.
import { attachAudio } from '../web/audio-web.mjs';
const { audioPage } = await addonCode('../src/capabilities/synth.mjs', import.meta.url) ?? {};
import { eq, ok, addonCode } from './helpers.mjs';

function fakeWin() {
  const ctxs = [];
  class Node { constructor() { this.out = []; this.onended = null; } connect(n) { this.out.push(n); return n; } disconnect() { this.out = []; } }
  class Param { constructor() { this.value = 0; } setValueAtTime(v) { this.value = v; } linearRampToValueAtTime(v) { this.value = v; } cancelScheduledValues() {} }
  class Ctx {
    constructor() { this.currentTime = 0; this.sampleRate = 48000; this.destination = new Node(); this.sources = []; this.state = 'running'; this.level = 0; ctxs.push(this); }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    createGain() { const n = new Node(); n.gain = new Param(); return n; }
    createAnalyser() { const n = new Node(); n.fftSize = 1024; n.getFloatTimeDomainData = (a) => a.fill(this.level); return n; }
    // Sources follow the Web Audio rule: stop() before start() throws (InvalidStateError), as in every browser.
    scheduled(n) { n.starts = []; n.start = (when, off) => { n.started = true; n.starts.push(off); }; n.stop = (when) => { if (!n.started) { const e = new Error('cannot call stop without calling start first'); e.name = 'InvalidStateError'; throw e; } n.stopped = true; n.stopAt = when; }; return n; }
    createBufferSource() { const n = this.scheduled(new Node()); this.sources.push(n); return n; }
    createOscillator() { const n = this.scheduled(new Node()); n.type = 'sine'; n.frequency = new Param(); this.oscillators = [...(this.oscillators || []), n]; return n; }
    createBuffer(channels, length) { return { length, getChannelData: () => new Float32Array(length) }; }
    decodeAudioData() { return Promise.resolve({ duration: 10 }); }
  }
  const handlers = {};
  const doc = { hidden: false, addEventListener() {} };
  return { ctxs, doc, win: { location: { href: 'http://x/' }, AudioContext: Ctx, document: doc, addEventListener: (t, f) => { handlers[t] = f; }, handlers } };
}

// The player of an experience that needs audio: the audio capability gave its page part (audioPage).
function fakePlayer() {
  const p = {
    audioPage,
    scene: 'a', stage: null, listeners: [], limits: { soundCopies: 4, oneShotSounds: 16 }, state: { blocks: { a: {} } },
    mix: () => ({ music: 1, sounds: 1, voice: 1 }), music: () => null, pausedStage() { return p.stage; },
    soundSource: (s, n) => ({ path: `${n}.wav` }), mouthLooks: [], eval: (a, f) => f === 'speaking' ? p.speaking : true, speaking: true,
    def: () => ({ addons: { synth: { mouth: { closed: 'closed', small: 'small', open: 'open', round: 'round' } } }, mouth: { target: 'mouth' } }),
  };
  return p;
}
const tick = () => new Promise(r => setTimeout(r, 0));

export const tests = {
  async 'a made sound (audioSynths) starts its oscillator, then stops it after its length (6.10, D31.2)'() {
    const w = fakeWin(); const p = fakePlayer();
    attachAudio(p, w.win, { assetsUrl: './', assets: async () => new ArrayBuffer(4) });
    w.win.handlers.pointerdown({ isTrusted: true });
    const ctx = w.ctxs[0]; ctx.currentTime = 3;
    const synth = { wave: 'sine', from: 880, to: 660, durationMs: 90, gain: 0.4 };
    for (const l of p.listeners) l({ deliveries: [{ kind: 'sound', sound: 'tap', group: 'sounds', gain: 1, address: 'a', source: { synth } }] });
    await tick(); await tick();
    eq((ctx.oscillators || []).length, 1, 'one oscillator');
    const o = ctx.oscillators[0];
    ok(o.started, 'the oscillator is started (a made sound used to stay silent: its stop came before its start)');
    eq(o.stopAt, 3 + 0.09, 'it stops after durationMs');
  },
  async 'a made noise starts its buffer source'() {
    const w = fakeWin(); const p = fakePlayer();
    attachAudio(p, w.win, { assetsUrl: './', assets: async () => new ArrayBuffer(4) });
    w.win.handlers.pointerdown({ isTrusted: true });
    const ctx = w.ctxs[0];
    for (const l of p.listeners) l({ deliveries: [{ kind: 'sound', sound: 'hiss', group: 'sounds', gain: 1, address: 'a', source: { synth: { wave: 'noise', from: 100, to: 100, durationMs: 200, gain: 0.3 } } }] });
    await tick(); await tick();
    eq(ctx.sources.length, 1, 'one buffer source');
    ok(ctx.sources[0].started && ctx.sources[0].stopped, 'started, then its stop scheduled');
  },
  async 'a paused scene stops its sound and the resume starts at the kept position'() {
    const w = fakeWin(); const p = fakePlayer();
    const a = attachAudio(p, w.win, { assetsUrl: './', assets: async () => new ArrayBuffer(4) });
    w.win.handlers.pointerdown({ isTrusted: true });
    const ctx = w.ctxs[0];
    for (const l of p.listeners) l({ deliveries: [{ kind: 'sound', sound: 'bell', group: 'sounds', gain: 1, address: 'a', source: { path: 'bell.wav' } }] });
    await tick(); await tick();
    eq(ctx.sources.length, 1);
    ctx.currentTime = 2;
    p.stage = 'a'; a.advance(16);
    ok(ctx.sources[0].stopped, 'the node stopped for the pause');
    ctx.currentTime = 50; // time passes while paused
    a.advance(16);
    p.stage = null; a.advance(16);
    eq(ctx.sources.length, 2, 'a new node on resume');
    eq(ctx.sources[1].starts, [2], 'it starts 2 s in, where it left off');
    ctx.currentTime = 53; p.stage = 'a'; a.advance(16); p.stage = null; a.advance(16);
    eq(ctx.sources[2].starts, [5], 'a second pause adds the time played');
  },
  async 'a page in a srcdoc frame (about:srcdoc) plays its packed sounds'() {
    const w = fakeWin(); const p = fakePlayer();
    w.win.location.href = 'about:srcdoc';
    const asked = [];
    attachAudio(p, w.win, { assetsUrl: './', assets: async (path) => { asked.push(path); return new ArrayBuffer(4); } });
    w.win.handlers.pointerdown({ isTrusted: true });
    for (const l of p.listeners) l({ deliveries: [{ kind: 'sound', sound: 'bell', group: 'sounds', gain: 1, address: 'a', source: { path: 'bell.wav' } }] });
    await tick(); await tick();
    eq(asked, ['bell.wav']);
    eq(w.ctxs[0].sources.length, 1);
  },
  async 'a sound of the shell goes on while the scene is paused'() {
    const w = fakeWin(); const p = fakePlayer();
    const a = attachAudio(p, w.win, { assetsUrl: './', assets: async () => new ArrayBuffer(4) });
    w.win.handlers.pointerdown({ isTrusted: true });
    for (const l of p.listeners) l({ deliveries: [{ kind: 'sound', sound: 'click', group: 'sounds', gain: 1, address: 'shell', source: { path: 'click.wav' } }] });
    await tick(); await tick();
    p.stage = 'a'; a.advance(16);
    ok(!w.ctxs[0].sources[0].stopped);
  },
  async 'the mouth follows the voice loudness, and closes when the voice stops'() {
    const w = fakeWin(); const p = fakePlayer();
    const a = attachAudio(p, w.win, { assetsUrl: './', assets: async () => new ArrayBuffer(4) });
    w.win.handlers.pointerdown({ isTrusted: true });
    const ctx = w.ctxs[0];
    a.advance(25);
    eq(p.mouthLooks, [{ address: 'a', target: 'mouth', look: 'closed' }], 'closed with no voice');
    for (const l of p.listeners) l({ deliveries: [{ kind: 'sound', sound: 'hello', group: 'voice', gain: 1, address: 'a', source: { path: 'hello.wav' } }] });
    await tick(); await tick();
    ctx.level = 0.1; a.advance(25);
    eq(p.mouthLooks[0].look, 'open');
    ctx.level = 0.3; a.advance(25);
    eq(p.mouthLooks[0].look, 'round');
    p.mix = () => ({ music: 1, sounds: 1, voice: 0 }); a.advance(25);
    eq(p.mouthLooks[0].look, 'closed', 'muted: closed at once');
    p.mix = () => ({ music: 1, sounds: 1, voice: 1 }); a.advance(25);
    eq(p.mouthLooks[0].look, 'round');
    w.doc.hidden = true; a.advance(25);
    eq(p.mouthLooks[0].look, 'closed', 'hidden: closed at once');
  },
  async 'a scene without addons.synth.mouth, or without a mouth key, has no mouth look'() {
    const w = fakeWin(); const p = fakePlayer();
    p.def = () => ({ addons: { synth: { mouth: { closed: 'closed', small: 'small', open: 'open' } } } });
    const a = attachAudio(p, w.win, { assetsUrl: './', assets: async () => new ArrayBuffer(4) });
    w.win.handlers.pointerdown({ isTrusted: true });
    a.advance(25);
    eq(p.mouthLooks, []);
  },
  async 'a character runs its own mouth: only while its when is true, and with a channel it gives numbers (6.11)'() {
    const w = fakeWin(); const p = fakePlayer();
    p.state.blocks = { a: {}, 'a/fia': {} };
    p.def = (addr) => addr === 'a/fia'
      ? { addons: { synth: { mouth: { target: 'lower-beak', when: 'speaking', channel: 'rotate', closed: 0, small: 10, open: 20 } } } }
      : { addons: { synth: { mouth: { target: 'meter', closed: 'closed', small: 'small', open: 'open' } } } };
    const a = attachAudio(p, w.win, { assetsUrl: './', assets: async () => new ArrayBuffer(4) });
    w.win.handlers.pointerdown({ isTrusted: true });
    p.speaking = true; a.advance(25);
    eq(p.mouthLooks.map(m => [m.address, m.target, m.look ?? m.value]), [['a', 'meter', 'closed'], ['a/fia', 'lower-beak', 0]]);
    eq(p.mouthLooks[1].channel, 'rotate');
    p.speaking = false; a.advance(25);
    eq(p.mouthLooks.map(m => m.address), ['a'], 'not speaking: the character writes nothing, so its usual binding takes over');
  },
};
