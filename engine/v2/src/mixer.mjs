// The 2.0 mixer (6.10): pure rules, no clock and no Web Audio. The host supplies start(name, {loop, group, owner}),
// which returns a handle {gain(level, rampMs), stop(), done()} or null when the sound cannot start (no gesture yet,
// hidden page, a file that will not decode). The host calls advance(ms) with elapsed time.
//
// Rules kept here:
// - level = group level (master volume x group knob, 0 when muted; Engine.mix()) x fade x the sound's gain;
// - changes reach sounds already playing;
// - music loops; the same music continues, different music crossfades, no music fades out; at most two music
//   sources at once;
// - at most soundCopies (4) copies of one sound and oneShotSounds (16) one-shot sounds at once (the player's limits,
//   9.8.1): a sound over either limit does not start;
// - each block owns its sounds: when its owner is gone, they stop (prune);
// - a sound pauses with its owner's clock (6.10, 3.10): hold(isHeld) pauses the sounds whose owner is held and
//   resumes the others, each keeping its position. A handle may give pause() and resume(); a sound without an owner
//   is never held. Music has no owner, unless its scene's whilePaused is pause: then m.owner is the scene, and the
//   music pauses while that scene is paused.
export function createMixer(start, limits = { soundCopies: 4, oneShotSounds: 16 }) {
  const levels = { music: 1, sounds: 1, voice: 1 };
  let tracks = [];
  let current = null; // the music track wanted now
  let isHeld = null; // (owner) -> boolean: the owner's clock is paused
  const level = (t) => (levels[t.group] ?? 1) * t.fadeLevel * t.gain;
  const apply = (t, ramp = 25) => t.handle.gain(Math.max(0, Math.min(1, level(t))), ramp);
  const stop = (t) => { t.handle.stop(); tracks = tracks.filter(x => x !== t); if (current === t) current = null; };
  const fadeTo = (t, to, ms) => {
    if (!ms) { t.fade = null; t.fadeLevel = to; if (!to) stop(t); else apply(t); return; }
    t.fade = { from: t.fadeLevel, to, ms, at: 0 };
  };
  const sync = (t) => {
    const held = !!(t.owner && isHeld && isHeld(t.owner));
    if (held === t.held) return;
    t.held = held;
    if (held) t.handle.pause?.(); else t.handle.resume?.();
  };
  const begin = (name, group, gain, owner, loop, fadeLevel, source) => {
    const handle = start(name, { loop, group, owner, source });
    if (!handle) return null;
    const t = { name, group, gain, owner, loop, handle, fadeLevel, fade: null, held: false };
    tracks.push(t);
    apply(t, 0);
    sync(t);
    return t;
  };
  const oneShots = () => tracks.filter(t => t.group !== 'music');

  return {
    // levels: {music, sounds, voice}, each 0..1.
    setLevels(next) {
      for (const g of Object.keys(levels)) if (typeof next[g] === 'number') levels[g] = Math.max(0, Math.min(1, next[g]));
      for (const t of tracks) apply(t);
    },
    // m: {sound, fadeMs, gain, owner?} or null. A music that could not start is tried again on the next call.
    music(m) {
      const want = m?.sound || null;
      if (current && current.name === want) {
        if (m.gain !== current.gain) { current.gain = m.gain ?? 1; apply(current); }
        if ((m.owner ?? null) !== current.owner) { current.owner = m.owner ?? null; sync(current); }
        return;
      }
      const ms = m?.fadeMs ?? 400;
      // At most the outgoing and the incoming music survive.
      for (const t of tracks.filter(x => x.group === 'music' && x !== current)) stop(t);
      const old = current;
      current = null;
      if (old) fadeTo(old, 0, ms);
      if (want) {
        current = begin(want, 'music', m.gain ?? 1, m.owner ?? null, true, ms ? 0 : 1);
        if (current && ms) fadeTo(current, 1, ms);
      }
    },
    // A sound action (5.15.1): returns true when it started. source is what the engine resolved (handed to start).
    play(name, group, gain = 1, owner = null, source = null) {
      if (oneShots().filter(t => t.name === name).length >= limits.soundCopies) return false;
      if (oneShots().length >= limits.oneShotSounds) return false;
      return !!begin(name, group, gain, owner, false, 1, source);
    },
    // Stops the one-shot sounds of owners that are gone. isLive(owner) -> boolean.
    prune(isLive) {
      for (const t of oneShots()) if (t.owner && !isLive(t.owner)) stop(t);
    },
    // isHeld(owner) -> boolean, or null for none. Call it again whenever a pause starts or ends.
    hold(fn) { isHeld = fn; for (const t of tracks) sync(t); },
    advance(ms) {
      for (const t of [...tracks]) {
        if (t.handle.done()) { stop(t); continue; }
        if (!t.fade) continue;
        const f = t.fade;
        f.at += ms;
        const p = Math.min(1, f.at / f.ms);
        t.fadeLevel = f.from + (f.to - f.from) * p;
        if (p === 1) { t.fade = null; if (!f.to) { stop(t); continue; } }
        apply(t);
      }
    },
    // Hidden page or master stop: everything stops; music starts again on the next music() call.
    silence() { for (const t of [...tracks]) stop(t); },
    // True while a voice-group sound plays (not held): the loudness mouth listens only then.
    voicePlaying() { return tracks.some(t => t.group === 'voice' && !t.held); },
    busy() { return tracks.length > 0; },
    // For tests and the developer view.
    tracks() { return tracks.map(t => ({ name: t.name, group: t.group, owner: t.owner, level: +level(t).toFixed(4), fading: !!t.fade, held: t.held })); },
    nowPlaying() { return current?.name || null; },
  };
}
