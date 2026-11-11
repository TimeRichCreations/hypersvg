// Sound for the 2.0 player in a browser (6.10): Web Audio under the pure mixer (../src/mixer.mjs).
// - Nothing sounds before a trusted person gesture; requests before it stay silent. Music starts at the next gesture.
// - A hidden page silences everything; music comes back when the page is visible again.
// - Sound files are fetched from assetsUrl + the resource path.
// - When a use (a component) goes away, its sounds stop.
// - A sound pauses with its owner's clock (a scene that is paused, a dialog that pauses) and keeps its position.
//   A hidden page suspends the audio clock, so every sound keeps its position there too.
// - The audio capability (../src/capabilities/synth.mjs) gives player.audioPage when the experience needs audio: then
//   synths play, and the voice group goes through a bus with an AnalyserNode whose loudness drives the mouths. Without
//   it this file carries no synth or mouth code, and a synth stays silent.
// - Spoken lines (6.11): a `say` delivery with voiced: true plays the line's recording in the voice group, and each
//   frame tells the engine where it is (player.lines.align), so the line's words and mouth follow the audio. A
//   recording that cannot start (no gesture yet, voice silent, a file that fails) or has not started after 300 ms, or
//   stalls for 1000 ms, is dropped: the line goes on with silent timing (player.lines.silent). Turning voice off
//   silences it at once; stopLine, a new line of the same block and the line's end stop it.
// Returns {mixer, log, update(), advance(ms), stats(), lines}; log lists every request with whether it started (for
// tests); lines lists the line recordings ({address, run, state}).
import { createMixer } from '../src/mixer.mjs';

// A made sound (audioSynths, core since D31.2): a pitch glide over durationMs with attack and release. The caller
// starts the node and then schedules its stop (startSynth): Web Audio refuses stop() before start(), and a refused
// stop here left every made sound silent.
export function startSynth(node, ctx, durationMs) { node.start(); node.stop(ctx.currentTime + durationMs / 1000); return node; }
export function synthNode(ctx, s, env) {
  const now = ctx.currentTime;
  const len = s.durationMs / 1000;
  let node;
  if (s.wave === 'noise') {
    const buf = ctx.createBuffer(1, Math.max(1, Math.ceil(len * ctx.sampleRate)), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    node = ctx.createBufferSource();
    node.buffer = buf;
  } else {
    node = ctx.createOscillator();
    node.type = s.wave;
    node.frequency.setValueAtTime(s.from, now);
    node.frequency.linearRampToValueAtTime(s.to, now + len);
  }
  const attack = Math.min(len, (s.attackMs ?? 5) / 1000);
  const release = Math.min(len - attack, (s.releaseMs ?? 20) / 1000);
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(s.gain, now + attack);
  env.gain.setValueAtTime(s.gain, now + len - release);
  env.gain.linearRampToValueAtTime(0, now + len);
  return node;
}

// assets: optional (path) -> Promise<ArrayBuffer>, for a packed page; otherwise files are fetched from assetsUrl.
// onFail: optional (path, error), called once per sound file that cannot be fetched or decoded.
// The base for sound files. A page in a srcdoc frame has the address about:srcdoc, which is no base: then null, and a
// packed page reads its assets from memory anyway.
export function assetsBase(assetsUrl, win) {
  try { return new URL(assetsUrl || './', win.location.href); } catch { return null; }
}

export function attachAudio(player, win, { assetsUrl, assets = null, onFail = null }) {
  let ctx = null;
  let gone = false; // destroyed or stopped
  let out = null;
  let voiceBus = null;
  let analyser = null;
  let analyserData = null;
  const buffers = new Map();
  const log = [];
  const failed = new Set();
  const base = assetsBase(assetsUrl, win);
  const extras = player.audioPage || null; // the synth capability's page part (the loudness mouth), or null

  const decode = (path) => {
    if (!buffers.has(path)) {
      const bytes = assets ? Promise.resolve().then(() => assets(path)) : fetch(base ? new URL(path, base) : path).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))));
      buffers.set(path, bytes
        .then(b => ctx.decodeAudioData(b)).catch((err) => { failed.add(path); try { onFail?.(path, err); } catch { /* the host's callback */ } return null; }));
    }
    return buffers.get(path);
  };

  const start = (name, { loop, group, owner, source }) => {
    const src = source || player.soundSource(player.scene, name);
    const entry = { name, group, owner, started: false };
    log.push(entry);
    if (!ctx || win.document.hidden || !src) return null;
    entry.started = true;
    const local = ctx.createGain();
    const env = ctx.createGain();
    env.connect(local);
    local.connect(group === 'voice' ? voiceBus : out);
    local.gain.value = 0;
    let node = null;
    let finished = false;
    let paused = false;
    let ready = null; // the decoded buffer, or true for a synth
    let elapsed = 0; // seconds of the sound already played
    let began = 0; // ctx time when the current node started
    const drop = () => { if (!node) return; node.onended = null; try { node.stop(); } catch { /* not started */ } try { node.disconnect(); } catch { /* gone */ } node = null; };
    const end = () => { finished = true; drop(); env.disconnect(); local.disconnect(); };
    // Starts a node from the position kept in elapsed (a pause stops the node and a resume makes a new one).
    const play = () => {
      if (finished || paused || !ready || node) return;
      let n; let synth = null;
      if (src.synth) {
        const s = src.synth; const len = s.durationMs / 1000; const left = len - elapsed;
        if (left < 0.001) { end(); return; }
        synth = elapsed > 0 ? { ...s, from: s.from + (s.to - s.from) * (elapsed / len), durationMs: Math.max(1, Math.round(left * 1000)), attackMs: 0 } : s;
        n = synthNode(ctx, synth, env);
      } else {
        n = ctx.createBufferSource();
        n.buffer = ready;
        n.loop = loop;
      }
      n.connect(env);
      n.onended = () => { if (node === n && !loop) end(); };
      node = n;
      began = ctx.currentTime;
      if (synth) startSynth(n, ctx, synth.durationMs); else n.start(0, ready.duration ? elapsed % ready.duration : 0);
    };
    const handle = {
      gain(v, ms = 0) {
        const p = local.gain; const t = ctx.currentTime;
        p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(v, t + ms / 1000);
      },
      pause() { if (paused || finished) return; paused = true; if (node) { elapsed += ctx.currentTime - began; drop(); } },
      resume() { if (!paused) return; paused = false; play(); },
      stop: end,
      done: () => finished,
    };
    (async () => {
      try {
        if (src.synth) ready = true;
        else {
          const buffer = await decode(src.path);
          if (finished) return;
          if (!buffer) { end(); return; }
          ready = buffer;
        }
        play();
      } catch { end(); }
    })();
    return handle;
  };

  const mixer = createMixer(start, player.limits);

  // ---------- spoken lines (6.11) ----------
  const voiced = new Map(); // address -> {run, state: 'waiting'|'playing'|'dropped'|'ended', node, gain, began, at, waited, stalled}
  const lineLog = [];
  const dropLine = (address, why) => {
    const v = voiced.get(address);
    if (!v) return;
    voiced.delete(address);
    if (v.node) { v.node.onended = null; try { v.node.stop(); } catch { /* not started */ } try { v.node.disconnect(); } catch { /* gone */ } }
    try { v.gain?.disconnect(); } catch { /* gone */ }
    v.entry.state = why;
    if (why !== 'ended' && why !== 'stopped') player.lines.silent(address, v.run);
  };
  const sayLine = (d) => {
    dropLine(d.address, 'stopped');
    if (!d.voiced || !d.source?.path) return;
    const entry = { address: d.address, line: d.line, run: d.run, state: 'waiting' };
    lineLog.push(entry);
    const v = { run: d.run, entry, node: null, gain: null, began: 0, at: 0, waited: 0, stalled: 0, offset: 0 };
    voiced.set(d.address, v);
    // Speech is never queued for later: no armed audio, a hidden page or a silent voice group means silent timing.
    if (!ctx || win.document.hidden || !(player.mix().voice > 0)) { dropLine(d.address, 'silent'); return; }
    v.gain = ctx.createGain();
    v.gain.gain.value = player.mix().voice;
    v.gain.connect(voiceBus);
    decode(d.source.path).then((buffer) => {
      if (voiced.get(d.address) !== v) return;
      if (!buffer) { dropLine(d.address, 'failed'); return; }
      if (v.waited > 300) { dropLine(d.address, 'late'); return; }
      v.buffer = buffer;
      playFrom(d.address, v, 0);
      entry.state = 'playing';
    }).catch(() => dropLine(d.address, 'failed'));
  };
  // Each frame: the recording's position aligns the line; a pause of the owner pauses the recording.
  const playFrom = (address, v, offset) => {
    const n = ctx.createBufferSource(); n.buffer = v.buffer; n.connect(v.gain);
    // At its end the recording's last position is its length: the line's origin takes it, so the line ends with it.
    n.onended = () => { if (voiced.get(address) === v && v.node === n) { v.node = null; v.entry.state = 'ended'; voiced.delete(address); player.lines.align(address, v.run, v.buffer.duration * 1000, true); } };
    v.node = n; v.began = ctx.currentTime; v.offset = offset; n.start(0, offset);
  };
  const stepLines = (ms) => {
    const held = player.pausedStage?.();
    for (const [address, v] of [...voiced]) {
      const line = player.state.blocks[address]?.line;
      if (!line || line.run !== v.run) { dropLine(address, 'stopped'); continue; }
      if (!player.state.ambient.voice) { dropLine(address, 'silenced'); continue; }
      if (v.gain) v.gain.gain.value = player.mix().voice;
      const paused = player.clockHeld ? player.clockHeld(address) : !!held && (address === held || address.startsWith(held + '/'));
      if (v.paused) { if (!paused) { v.paused = false; playFrom(address, v, v.offset); } continue; }
      if (!v.node) { v.waited += ms; if (v.waited > 300) dropLine(address, 'late'); continue; }
      if (paused) { v.paused = true; v.offset += ctx.currentTime - v.began; v.node.onended = null; try { v.node.stop(); } catch { /* done */ } v.node = null; continue; }
      const pos = (v.offset + (ctx.currentTime - v.began)) * 1000;
      // A stalled audio clock (a suspended context) for 1000 ms drops the recording.
      if (pos === v.at) { v.stalled += ms; if (v.stalled > 1000) { dropLine(address, 'stalled'); continue; } } else v.stalled = 0;
      v.at = pos;
      player.lines.align(address, v.run, pos);
    }
  };
  // 6.10: a sound pauses with its owner's clock; the stage's scene and its components share the stage's pause, and
  // an authored clock's pause holds its block and the blocks under it (3.10).
  const syncHold = () => {
    const stage = player.pausedStage?.();
    const st = player.clockStates?.();
    mixer.hold(st ? (o) => st.get(o)?.rate === 0 : stage ? (o) => o === stage || o.startsWith(stage + '/') : null);
  };
  const update = () => {
    if (gone) return; // a stopped or destroyed player never sounds again
    mixer.setLevels(player.mix());
    syncHold();
    // 6.10 "removing a use stops its sounds": uses only (addresses with a '/'); a scene's sound outlives its exit.
    mixer.prune((owner) => !owner.includes('/') || !!player.state.blocks[owner]);
    if (ctx && !win.document.hidden) mixer.music(player.music());
  };
  const arm = (e) => {
    if (!e.isTrusted || ctx || gone) return;
    try {
      ctx = new win.AudioContext();
      out = ctx.createGain();
      out.connect(ctx.destination);
      voiceBus = ctx.createGain();
      voiceBus.connect(out);
      if (extras) {
        analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyserData = new Float32Array(analyser.fftSize);
        voiceBus.connect(analyser);
      }
      ctx.resume().catch(() => {});
    } catch { ctx = null; }
    update();
  };
  for (const type of ['pointerdown', 'keydown']) win.addEventListener(type, arm, true);
  const shown = () => {
    if (gone) return;
    if (win.document.hidden) ctx?.suspend().catch(() => {});
    else { ctx?.resume().catch(() => {}); update(); }
  };
  win.document.addEventListener('visibilitychange', shown);
  const delivered = ({ deliveries }) => {
    if (gone) return;
    for (const d of deliveries) {
      if (d.kind === 'sound') mixer.play(d.sound, d.group, d.gain, d.address, d.source);
      else if (d.kind === 'say') sayLine(d);
      else if (d.kind === 'stopLine') dropLine(d.address, 'stopped');
    }
    update();
  };
  player.listeners.push(delivered);
  const stats = async () => {
    await Promise.all(buffers.values());
    return { armed: !!ctx, requests: log.length, started: log.filter(e => e.started).length, decoded: buffers.size - failed.size, failed: [...failed], music: mixer.nowPlaying() };
  };
  // Loudness mouths (audioMouth, 6.11), when the audio capability is there: it writes player.mouthLooks.
  const read = () => { analyser.getFloatTimeDomainData(analyserData); const v = player.mix().voice; return v > 0 ? extras.rms(analyserData) / v : 0; };
  const heard = () => !!ctx && !!analyser && !win.document.hidden && player.mix().voice > 0 && (mixer.voicePlaying() || [...voiced.values()].some(v => v.node));
  const mouth = extras ? extras.mouths(player, { read, heard }) : null;
  const advance = (ms) => { if (gone) return; syncHold(); mixer.advance(ms); stepLines(ms); mouth?.(ms); };
  // After a fatal stop or destroy (10.6): every sound, music and spoken recording stops, nothing starts again (a shown
  // tab, a press), the listeners go and the audio context closes.
  const destroy = () => {
    if (gone) return;
    gone = true;
    try { mixer.silence(); } catch { /* nothing sounds */ }
    for (const address of [...voiced.keys()]) dropLine(address, 'stopped');
    for (const type of ['pointerdown', 'keydown']) win.removeEventListener(type, arm, true);
    win.document.removeEventListener('visibilitychange', shown);
    const i = player.listeners.indexOf(delivered); if (i >= 0) player.listeners.splice(i, 1);
    try { ctx?.close?.().catch?.(() => {}); } catch { /* closed */ }
  };
  return { mixer, log, update, stats, advance, destroy, lines: lineLog, get armed() { return !!ctx; }, get gone() { return gone; } };
}
