// Sounds pause with their owner's clock (6.10, 3.10), with the pure mixer. No browser.
import { createMixer } from '../src/mixer.mjs';
import { eq, ok } from './helpers.mjs';

// A fake host whose handles keep a position: it moves only while the sound is not paused.
const host = () => {
  const handles = [];
  const start = (name, opts) => {
    const h = { name, opts, pos: 0, paused: false, stopped: false, log: [], gain() {}, stop() { h.stopped = true; }, done: () => false,
      pause() { h.paused = true; h.log.push('pause'); }, resume() { h.paused = false; h.log.push('resume'); },
      tick(ms) { if (!h.paused && !h.stopped) h.pos += ms; } };
    handles.push(h);
    return h;
  };
  return { handles, start, tick: (ms) => handles.forEach(h => h.tick(ms)) };
};

export const tests = {
  'a sound of a held owner pauses, and resumes where it was'() {
    const h = host(); const m = createMixer(h.start);
    m.play('bell', 'sounds', 1, 'a');
    h.tick(300);
    m.hold((o) => o === 'a');
    h.tick(500);
    eq(h.handles[0].pos, 300, 'no progress while held');
    m.hold(null);
    h.tick(200);
    eq([h.handles[0].pos, h.handles[0].log], [500, ['pause', 'resume']]);
  },
  'only the held owner and its uses pause; the shell and music go on'() {
    const h = host(); const m = createMixer(h.start);
    m.music({ sound: 'tune', fadeMs: 0 });
    m.play('a1', 'sounds', 1, 'a'); m.play('a2', 'sounds', 1, 'a/stamp'); m.play('s1', 'sounds', 1, 'shell'); m.play('n1', 'sounds', 1, null);
    m.hold((o) => o === 'a' || o.startsWith('a/'));
    eq(m.tracks().map(t => [t.name, t.held]), [['tune', false], ['a1', true], ['a2', true], ['s1', false], ['n1', false]]);
  },
  'a sound that starts while its owner is held starts paused'() {
    const h = host(); const m = createMixer(h.start);
    m.hold((o) => o === 'a');
    m.play('late', 'sounds', 1, 'a');
    eq(h.handles[0].paused, true);
  },
  'hold is idempotent: calling it again does not pause twice'() {
    const h = host(); const m = createMixer(h.start);
    m.play('bell', 'sounds', 1, 'a');
    const held = (o) => o === 'a';
    m.hold(held); m.hold(held); m.hold(held);
    m.hold(null); m.hold(null);
    eq(h.handles[0].log, ['pause', 'resume']);
  },
  'a handle without pause and resume is fine'() {
    const m = createMixer(() => ({ gain() {}, stop() {}, done: () => false }));
    m.play('x', 'sounds', 1, 'a');
    m.hold(() => true); m.hold(null);
    ok(m.busy());
  },
  'a held sound can still be stopped by prune'() {
    const h = host(); const m = createMixer(h.start);
    m.play('a2', 'sounds', 1, 'a/stamp');
    m.hold(() => true);
    m.prune(() => false);
    ok(h.handles[0].stopped);
    eq(m.tracks(), []);
  },
  'voicePlaying is true for a voice sound that is not held'() {
    const h = host(); const m = createMixer(h.start);
    eq(m.voicePlaying(), false);
    m.play('hello', 'voice', 1, 'a');
    eq(m.voicePlaying(), true);
    m.hold(() => true);
    eq(m.voicePlaying(), false);
  },
};
