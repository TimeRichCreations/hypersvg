// Stage 5, sound (6.10): the sound action, the mix, scene music and the pure mixer. No browser.
import path from 'node:path';
import { Player } from '../src/story.mjs';
import { createMixer } from '../src/mixer.mjs';
import { loadExperience, folderSource } from '../src/load.mjs';
import { repo, schemas, eq, ok } from './helpers.mjs';

// A fake host: every start gives a handle that records its level.
const fakeHost = () => {
  const handles = [];
  const start = (name, opts) => {
    const h = { name, opts, level: null, stopped: false, ended: false, gain(v) { h.level = v; }, stop() { h.stopped = true; }, done: () => h.ended };
    handles.push(h);
    return h;
  };
  return { handles, start };
};

const exp = (extra = {}, scenes = {}) => new Player({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en',
    resources: { bell: { kind: 'sound', file: 'sounds/bell.wav' }, loop: { kind: 'sound', file: 'sounds/loop.ogg' } },
    story: { start: 'a', scenes: Object.fromEntries(Object.keys(scenes).map(k => [k, `scenes/${k}/scene.json`])) }, ...extra },
  words: { en: {} }, data: {}, blocks: {},
  scenes: Object.fromEntries(Object.entries(scenes).map(([k, d]) => [k, { file: `scenes/${k}/scene.json`, doc: { format: 'hsvg/2.0', kind: 'scene', id: k, drawing: `${k}.svg`, ...d }, words: {} }])),
});
const ring = (sound, more = {}) => ({ press: [{ id: 'r', actions: [{ id: 's', play: sound, as: 'sound', ...more }] }] });

export const tests = {
  'the sound action resolves its id in the scene, then the experience, and reports the path (2.1, 2.6)'() {
    const p = exp({}, { a: { resources: { chime: { kind: 'sound', file: '../../sounds/chime.wav' } }, on: { ...ring("'chime'"), other: [{ id: 'o', actions: [{ id: 's2', play: "'bell'", as: 'sound', volume: 0.5 }] }] } } });
    ok(p.start().ok);
    const r = p.send('a', 'press');
    ok(r.ok, r.fault?.message);
    eq(r.deliveries.map(d => [d.sound, d.group, d.gain, d.source.path]), [['chime', 'sounds', 1, 'scenes/a/../../sounds/chime.wav']]);
    eq(p.send('a', 'other').deliveries.map(d => [d.sound, d.gain, d.source.path]), [['bell', 0.5, 'sounds/bell.wav']]);
  },
  'an unknown sound, a wrong group or a gain outside 0..1 is a fault, and the step rolls back (5.15.1, 6.10)'() {
    for (const [sound, more, code] of [["'nope'", {}, 'E-REF-UNKNOWN'], ["'bell'", { group: 'music' }, 'E-RANGE'], ["'bell'", { volume: 2 }, 'E-RANGE']]) {
      const p = exp({}, { a: { values: { n: { type: 'number', initial: 0 } }, on: { press: [{ id: 'r', actions: [{ id: 'i', set: 'n', to: 'n + 1' }, { id: 's', play: sound, as: 'sound', ...more }] }] } } });
      ok(p.start().ok);
      const r = p.send('a', 'press');
      eq([r.ok, r.fault?.code, p.read('a', 'n')], [false, code, 0], sound);
    }
  },
  'a made sound is a core sound: it plays with no need (D31.2)'() {
    const synth = { beep: { wave: 'sine', from: 440, to: 880, durationMs: 120, gain: 0.4 } };
    const yes = exp({ audioSynths: synth }, { a: { on: ring("'beep'") } });
    ok(yes.start().ok);
    eq(yes.send('a', 'press').deliveries[0].source, { synth: synth.beep });
    const no = exp({}, { a: { on: ring("'beep'") } });
    ok(no.start().ok);
    eq(no.send('a', 'press').fault?.code, 'E-REF-UNKNOWN', 'a sound name with no file and no made sound');
  },
  'the mix is master volume x group knob; master or group mute gives 0 (6.10)'() {
    const p = exp({
      inputs: { musicVolume: { kind: 'knob', type: 'number', minimum: 0, maximum: 1, initial: 0.5 }, musicMuted: { kind: 'knob', type: 'boolean', initial: false } },
      audio: { groups: { music: 'musicVolume' }, mutes: { music: 'musicMuted' }, fadeMs: 700 },
    }, { a: {} });
    ok(p.start().ok);
    eq(p.mix(), { music: 0.5, sounds: 1, voice: 1 });
    p.state.ambient.volume = 0.5;
    eq(p.mix(), { music: 0.25, sounds: 0.5, voice: 0.5 });
    p.state.blocks.experience.inputs.musicMuted = true;
    eq(p.mix().music, 0);
    p.state.ambient.muted = true;
    eq(p.mix(), { music: 0, sounds: 0, voice: 0 });
  },
  'a scene gives its music; fadeMs falls back to the experience audio, then 400 (6.10)'() {
    const p = exp({ audio: { fadeMs: 700 } }, { a: { music: { sound: 'loop' } }, b: { music: { sound: 'loop', fadeMs: 900, gain: 0.8 } }, c: {} });
    ok(p.start().ok);
    eq(p.music(), { sound: 'loop', fadeMs: 700, gain: 1 });
    p.state.story.current = 'b'; eq(p.music(), { sound: 'loop', fadeMs: 900, gain: 0.8 });
    p.state.story.current = 'c'; eq(p.music(), null);
  },
  'mixer: the same music continues, other music crossfades, no music fades out; two music at most (6.10)'() {
    const h = fakeHost(); const m = createMixer(h.start);
    m.music({ sound: 'm1', fadeMs: 1000, gain: 1 });
    eq(h.handles.length, 1); eq(h.handles[0].level, 0);
    m.advance(500); eq(h.handles[0].level, 0.5);
    m.music({ sound: 'm1', fadeMs: 1000, gain: 1 }); eq(h.handles.length, 1, 'same music continues');
    m.advance(500);
    m.music({ sound: 'm2', fadeMs: 1000, gain: 1 });
    eq(h.handles.length, 2); m.advance(250);
    eq([h.handles[0].level, h.handles[1].level], [0.75, 0.25], 'crossfade');
    m.music({ sound: 'm3', fadeMs: 1000, gain: 1 });
    eq(m.tracks().filter(t => t.group === 'music').map(t => t.name), ['m2', 'm3'], 'two music at most');
    ok(h.handles[0].stopped, 'm1 stopped');
    m.music(null); m.advance(1000);
    eq(m.tracks(), [], 'no music fades out and stops');
  },
  'mixer: a music that could not start is tried again (the next gesture) (6.10)'() {
    let allow = false; const h = fakeHost();
    const m = createMixer((n, o) => (allow ? h.start(n, o) : null));
    m.music({ sound: 'm1', fadeMs: 0 }); eq(m.nowPlaying(), null);
    allow = true; m.music({ sound: 'm1', fadeMs: 0 }); eq(m.nowPlaying(), 'm1'); eq(h.handles[0].level, 1);
  },
  'mixer: level = group x fade x gain, and changes reach sounds already playing (6.10)'() {
    const h = fakeHost(); const m = createMixer(h.start);
    m.setLevels({ music: 1, sounds: 0.5, voice: 1 });
    ok(m.play('bell', 'sounds', 0.6, 'a'));
    eq(h.handles[0].level, 0.3);
    m.setLevels({ sounds: 0 }); eq(h.handles[0].level, 0, 'mute reaches a playing sound');
  },
  'mixer: four copies of one sound and 16 one-shots at most; over the limit does not start (6.10)'() {
    const h = fakeHost(); const m = createMixer(h.start);
    eq([1, 2, 3, 4, 5].map(() => m.play('pop', 'sounds')), [true, true, true, true, false]);
    for (let i = 0; i < 12; i++) ok(m.play(`s${i}`, 'sounds'));
    eq(m.play('late', 'sounds'), false);
    ok(!h.handles.some(x => x.stopped), 'nothing already playing was stopped');
    h.handles[0].ended = true; m.advance(0);
    ok(m.play('late', 'sounds'), 'an ended sound frees its place');
  },
  'mixer: a gone owner stops its sounds; others keep playing (6.10)'() {
    const h = fakeHost(); const m = createMixer(h.start);
    m.play('a', 'sounds', 1, 'hub/stamp'); m.play('b', 'sounds', 1, 'hub');
    m.prune(o => o !== 'hub/stamp');
    eq([h.handles[0].stopped, h.handles[1].stopped], [true, false]);
  },
};
