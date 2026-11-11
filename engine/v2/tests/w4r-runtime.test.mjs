// What the checker passes but the runtime could not play. The chapter ambient input (3.12, 5.5), typed CSV
// cells (2.8), a use's with that reads active(...) (5.3), a scene music's whilePaused (6.10).
import { Player } from '../src/story.mjs';
import { Drawing } from '../src/drawing.mjs';
import { loadExperience, parseCsv } from '../src/load.mjs';
import { createMixer } from '../src/mixer.mjs';
import path from 'node:path';
import { bundle, capabilityModules } from '../tools/pack.mjs';
import { attachAudio } from '../web/audio-web.mjs';
import { repo } from './helpers.mjs';
import { eq, ok, mapSource, schemas } from './helpers.mjs';

const svg = (id) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" data-hsvg-version="2.0" data-hsvg-kind="screen">
  <g id="world" data-hsvg-layer="content"><text id="step" data-hsvg-kind="part" x="10" y="20">${id}</text></g>
</svg>`;
const stepScene = (id) => ({ doc: { format: 'hsvg/2.0', kind: 'scene', id, drawing: `${id}.svg`,
  outputs: { next: { kind: 'event' }, back: { kind: 'event' } },
  bindings: [{ id: 'step-text', target: 'step', text: 'Step {{ chapter.index + 1 }} of {{ chapter.count }}' }],
  on: { 'press:next': [{ id: 'n', actions: [{ id: 'e', emit: 'next' }] }], 'press:back': [{ id: 'b', actions: [{ id: 'e', emit: 'back' }] }] },
}, drawings: { main: { text: svg(id) } }, words: {} });

function deck(values = {}) {
  const scenes = { one: stepScene('one'), two: stepScene('two'), three: stepScene('three'), end: stepScene('end') };
  return new Player({
    doc: { format: 'hsvg/2.0', kind: 'experience', id: 'deck', language: 'en', values,
      story: { start: 'deck', scenes: Object.fromEntries(Object.keys(scenes).map(k => [k, `${k}.json`])),
        chapters: [{ id: 'deck', scenes: ['one', { scene: 'two', skipWhen: 'skipTwo' }, 'three'], next: 'next', back: 'back', after: 'end' }] } },
    words: { en: {} }, data: {}, blocks: {}, scenes,
  });
}
const text = (d, scene) => d.frames[scene].byLocal.get('step').children[0].text;

export const tests = {
  'the chapter ambient input: a binding that reads it plays (3.12, 5.5)'() {
    const p = deck({ skipTwo: { type: 'boolean', initial: false } });
    ok(p.start().ok);
    const d = new Drawing(p);
    d.mountScene('one'); d.paint();
    eq(text(d, 'one'), 'Step 1 of 3');
    eq(p.read('one', 'chapter'), { id: 'deck', index: 0, count: 3 });
    p.send('one', 'press:next'); eq(p.scene, 'two');
    d.mountScene('two'); d.paint();
    eq(text(d, 'two'), 'Step 2 of 3');
    eq(d.faults, []);
  },
  'the chapter ambient input counts present steps only in an ordered chapter (3.12)'() {
    const p = deck({ skipTwo: { type: 'boolean', initial: true } });
    ok(p.start().ok);
    eq(p.read('one', 'chapter'), { id: 'deck', index: 0, count: 2 });
    p.send('one', 'press:next'); eq(p.scene, 'three');
    eq(p.read('three', 'chapter'), { id: 'deck', index: 1, count: 2 }, 'Step 2 of 2');
    p.send('three', 'press:next'); eq(p.scene, 'end');
    eq(p.read('end', 'chapter'), { id: '', index: 0, count: 0 }, 'no chapter on the stage');
  },
  'changed:chapter is heard when the chapter value changes (5.5)'() {
    const p = deck({ skipTwo: { type: 'boolean', initial: false }, heard: { type: 'number', initial: 0, minimum: 0, maximum: 9 } });
    for (const id of ['two', 'end']) p.exp.scenes[id].doc.on['changed:chapter'] = [{ id: 'h', actions: [{ id: 'a', set: 'heard', to: 'heard + 1' }] }];
    ok(p.start().ok);
    p.send('one', 'press:next'); eq(p.read('experience', 'heard'), 1);
    p.send('two', 'press:next'); p.send('three', 'press:next'); eq(p.scene, 'end');
    eq(p.read('experience', 'heard'), 2);
  },
  'a chapter without next names its group; index is the list place (3.12)'() {
    const scenes = { a: stepScene('a'), b: stepScene('b') };
    const p = new Player({
      doc: { format: 'hsvg/2.0', kind: 'experience', id: 'g', language: 'en',
        story: { start: 'a', scenes: { a: 'a.json', b: 'b.json' }, links: [{ id: 'a-b', from: 'a', on: 'next', to: 'b' }], chapters: [{ id: 'group', scenes: ['a', 'b'] }] } },
      words: { en: {} }, data: {}, blocks: {}, scenes,
    });
    ok(p.start().ok);
    eq(p.read('a', 'chapter'), { id: 'group', index: 0, count: 2 });
    p.send('a', 'press:next'); eq(p.read('b', 'chapter'), { id: 'group', index: 1, count: 2 });
  },

  'CSV data cells: numbers and booleans by the declared column types (2.8)'() {
    const cols = { id: { type: 'string' }, share: { type: 'number' }, ripe: { type: 'boolean' }, note: { type: 'string' } };
    const rows = parseCsv('share,id,ripe,note\r\n0.25,apple,true,\n-1e2,pear,false,"12"\n', cols);
    eq(rows, [{ share: 0.25, id: 'apple', ripe: true, note: '' }, { share: -100, id: 'pear', ripe: false, note: '12' }]);
    eq(typeof rows[0].share, 'number');
  },
  'CSV data cells that break 2.8 are refused'() {
    const cols = { id: { type: 'string' }, n: { type: 'number' }, b: { type: 'boolean' } };
    const bad = (csv, c = cols) => { try { parseCsv(csv, c); } catch (e) { return e.message; } return null; };
    for (const n of ['01', '1.', '.5', '+1', '0x10', 'NaN', 'Infinity', ' 1', '1e999']) ok(bad(`id,n,b\nx,${n},true\n`), `number cell ${n}`);
    for (const b of ['TRUE', 'yes', '1']) ok(bad(`id,n,b\nx,1,${b}\n`), `boolean cell ${b}`);
    ok(bad('id,n,b\nx,,true\n'), 'empty number cell');
    ok(bad('id,n\nx,1\n'), 'a missing column');
    ok(bad('id,n,b,z\nx,1,true,q\n'), 'an undeclared column');
    ok(bad('id,n,b\nx,1\n'), 'a short row');
    ok(bad('id,list\nx,[1]\n', { id: { type: 'string' }, list: { type: 'array' } }), 'an array column needs JSON');
    ok(bad('﻿id,n,b\nx,1,true\n'), 'a byte order mark');
  },
  'a CSV table loads typed, so a number column reads as a number (2.8)'() {
    const exp = { format: 'hsvg/2.0', kind: 'experience', id: 'csv', language: 'en',
      resources: { fruit: { kind: 'data', file: 'data/fruit.csv' } },
      data: { fruit: { resource: 'fruit', key: 'id', maxRows: 4, columns: { id: { type: 'string', maxLength: 8 }, share: { type: 'number', minimum: 0, maximum: 1 }, big: { type: 'boolean' } } } },
      story: { start: 'one', scenes: { one: 'scenes/one/scene.json' } } };
    const files = { 'experience.json': exp, 'data/fruit.csv': 'id,share,big\napple,0.5,false\nmelon,0.25,true\n',
      'scenes/one/scene.json': { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg' },
      'scenes/one/one.svg': svg('one') };
    const r = loadExperience(mapSource(files), schemas());
    eq(r.diags.filter(d => d.code === 'E-DATA'), []);
    eq(r.experience.data.fruit, [{ id: 'apple', share: 0.5, big: false }, { id: 'melon', share: 0.25, big: true }]);
    const p = new Player(r.experience);
    ok(p.start().ok);
    eq(p.eval('one', 'data.fruit[0].share + data.fruit[1].share'), 0.75);
    eq(p.eval('one', 'data.fruit[1].big'), true);
    files['data/fruit.csv'] = 'id,share,big\napple,half,false\n';
    ok(loadExperience(mapSource(files), schemas()).diags.some(d => d.code === 'E-DATA'), 'a bad cell is E-DATA');
  },

  "a use's with that reads active(...) follows the machine state (5.3)"() {
    const exp = {
      doc: { format: 'hsvg/2.0', kind: 'experience', id: 'm', language: 'en', story: { start: 'one', scenes: { one: 'one.json' } } },
      words: { en: {} }, data: {},
      scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg',
        values: { n: { type: 'number', initial: 0, minimum: 0, maximum: 9 } },
        uses: [{ id: 'lamp', use: 'lamp', with: { lit: "active('on')", count: 'n' } }],
        machines: { power: { initial: 'off', states: { off: { on: { flip: [{ id: 'to-on', target: 'on' }] } }, on: { on: { flip: [{ id: 'to-off', target: 'off' }] }, after: [{ id: 'auto-off', delayMs: 500, target: 'off' }] } } } },
      }, words: {} } },
      blocks: { lamp: { doc: { format: 'hsvg/2.0', kind: 'component', id: 'lamp', drawing: 'lamp.svg',
        inputs: { lit: { kind: 'content', type: 'boolean', initial: false }, count: { kind: 'content', type: 'number', initial: 0, minimum: 0, maximum: 9 } },
        values: { heard: { type: 'number', initial: 0, minimum: 0, maximum: 99 } },
        on: { 'changed:lit': [{ id: 'h', actions: [{ id: 'a', set: 'heard', to: 'heard + 1' }] }] } }, words: {} } },
    };
    const p = new Player(exp);
    ok(p.start().ok);
    eq(p.read('one/lamp', 'lit'), false);
    p.send('one', 'flip'); eq(p.read('one/lamp', 'lit'), true, 'a transition alone moves the use');
    eq(p.read('one/lamp', 'heard'), 1, 'the component hears changed:lit');
    p.advance(500); eq(p.read('one/lamp', 'lit'), false, 'a timed transition too');
    eq(p.read('one/lamp', 'heard'), 2);
    p.send('one', 'flip'); p.send('one', 'flip'); eq(p.read('one/lamp', 'lit'), false);
    eq(p.read('one/lamp', 'heard'), 4);
  },
  "a use's with that reads active(...) sees the machine's initial state at mount (5.3)"() {
    const exp = {
      doc: { format: 'hsvg/2.0', kind: 'experience', id: 'm', language: 'en', story: { start: 'one', scenes: { one: 'one.json' } } },
      words: { en: {} }, data: {},
      scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg',
        uses: [{ id: 'lamp', use: 'lamp', with: { lit: "active('on')" } }],
        machines: { power: { initial: 'on', states: { on: {}, off: {} } } } }, words: {} } },
      blocks: { lamp: { doc: { format: 'hsvg/2.0', kind: 'component', id: 'lamp', drawing: 'lamp.svg',
        inputs: { lit: { kind: 'content', type: 'boolean', initial: false } } }, words: {} } },
    };
    const p = new Player(exp);
    ok(p.start().ok);
    eq(p.read('one/lamp', 'lit'), true, 'uses mount before machines (5.15.1); the with is read again after');
  },

  "a scene music's whilePaused: pause holds it with its scene, play keeps today's behaviour (6.10)"() {
    const scene = (id, music) => ({ doc: { format: 'hsvg/2.0', kind: 'scene', id, drawing: `${id}.svg`, music }, words: {} });
    const p = new Player({
      doc: { format: 'hsvg/2.0', kind: 'experience', id: 'mu', language: 'en', story: { start: 'a', scenes: { a: 'a.json', b: 'b.json', c: 'c.json' },
        links: [{ id: 'a-b', from: 'a', on: 'go', to: 'b' }, { id: 'b-c', from: 'b', on: 'go', to: 'c' }] } },
      words: { en: {} }, data: {}, blocks: {},
      scenes: { a: scene('a', { sound: 'tune', fadeMs: 0, whilePaused: 'pause' }), b: scene('b', { sound: 'tune', fadeMs: 0, whilePaused: 'play' }), c: scene('c', { sound: 'tune', fadeMs: 0 }) },
    });
    for (const id of ['a', 'b']) p.exp.scenes[id].doc.outputs = { go: { kind: 'event' } };
    ok(p.start().ok);
    eq(p.music(), { sound: 'tune', fadeMs: 0, gain: 1, owner: 'a' });
    // The web player's hold rule: the paused stage's scene and its uses (audio-web.mjs syncHold).
    const handles = [];
    const m = createMixer((name) => { const h = { name, paused: false, gain() {}, stop() {}, done: () => false, pause() { h.paused = true; }, resume() { h.paused = false; } }; handles.push(h); return h; });
    const sync = () => { const stage = p.pausedStage(); m.hold(stage ? (o) => o === stage || o.startsWith(stage + '/') : null); m.music(p.music()); };
    sync();
    p.setPause('host', true); sync();
    eq(handles[0].paused, true, 'pause: the music pauses with its scene');
    p.setPause('host', false); sync();
    eq(handles[0].paused, false, 'and resumes with it');
    p.send('a', 'go'); eq(p.scene, 'b'); sync();
    eq(p.music(), { sound: 'tune', fadeMs: 0, gain: 1 }, 'play: no owner');
    p.setPause('host', true); sync();
    eq([handles.length, handles[0].paused], [1, false], 'play: the same music continues and goes on while paused');
    p.setPause('host', false);
    p.send('b', 'go'); eq(p.scene, 'c');
    eq(p.music(), { sound: 'tune', fadeMs: 0, gain: 1 }, 'the default is play');
  },
  'mixer: music with an owner is held with it; the same music taking an owner is held at once (6.10)'() {
    const handles = [];
    const m = createMixer((name) => { const h = { name, paused: false, gain() {}, stop() {}, done: () => false, pause() { h.paused = true; }, resume() { h.paused = false; } }; handles.push(h); return h; });
    m.hold((o) => o === 'a');
    m.music({ sound: 'tune', fadeMs: 0 });
    eq(handles[0].paused, false);
    m.music({ sound: 'tune', fadeMs: 0, owner: 'a' });
    eq([handles.length, handles[0].paused], [1, true]);
    m.music({ sound: 'tune', fadeMs: 0 });
    eq(handles[0].paused, false);
  },

  'the audio capability: synths and the loudness mouth ship only when needs names audio (W3-C Request 4)'() {
    const ENTRY = path.join(repo, 'engine', 'v2', 'web', 'packed-entry.mjs');
    const files = (needs) => bundle(ENTRY, capabilityModules(needs).map(c => c.file)).files;
    const none = files([]);
    for (const f of ['engine/v2/src/capabilities/synth.mjs', 'engine/v2/src/mouth.mjs']) ok(!none.includes(f), `${f} is not in a page without audio`);
    ok(none.includes('engine/v2/web/audio-web.mjs') && none.includes('engine/v2/src/mixer.mjs'), 'plain sounds and music stay core (6.10)');
    const withAudio = files(['synth']);
    for (const f of ['engine/v2/src/capabilities/synth.mjs', 'engine/v2/src/mouth.mjs']) ok(withAudio.includes(f), `${f} ships with audio`);
  },
  'a made sound plays without the synth module (core, D31.2); the module gives only the mouth page part'() {
    const synth = { beep: { wave: 'sine', from: 440, to: 880, durationMs: 120, gain: 0.4 } };
    const make = (modules) => new Player({
      doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', needs: ['synth'], audioSynths: synth, story: { start: 'a', scenes: { a: 'a.json' } } },
      words: { en: {} }, data: {}, blocks: {},
      scenes: { a: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg', on: { press: [{ id: 'r', actions: [{ id: 's', play: "'beep'", as: 'sound' }] }] } }, words: {} } },
    }, modules ? { modules } : {});
    const yes = make(null); ok(yes.start().ok);
    ok(yes.audioPage, 'the audio module gives the page part');
    eq(yes.send('a', 'press').deliveries[0].source, { synth: synth.beep });
    const no = make([]); ok(no.start().ok);
    eq(no.audioPage, undefined);
    eq(no.send('a', 'press').deliveries[0].source, { synth: synth.beep }, 'the made sound plays without the module');
  },
  async 'audio-web without the synth capability: plain and made sounds play, no mouth is driven'() {
    const started = [];
    class Node { connect(n) { return n; } disconnect() {} }
    class Param { setValueAtTime() {} linearRampToValueAtTime() {} cancelScheduledValues() {} }
    class Ctx {
      constructor() { this.currentTime = 0; this.destination = new Node(); this.analysers = 0; }
      resume() { return Promise.resolve(); }
      createGain() { const n = new Node(); n.gain = new Param(); return n; }
      createAnalyser() { this.analysers++; return new Node(); }
      createBufferSource() { const n = new Node(); n.start = () => started.push('file'); n.stop = () => {}; return n; }
      createOscillator() { started.push('synth'); return new Node(); }
      decodeAudioData() { return Promise.resolve({ duration: 1 }); }
    }
    const handlers = {}; let ctx;
    const win = { location: { href: 'http://x/' }, AudioContext: class extends Ctx { constructor() { super(); ctx = this; } }, document: { hidden: false, addEventListener() {} }, addEventListener: (t, f) => { handlers[t] = f; } };
    const p = { scene: 'a', listeners: [], limits: { soundCopies: 4, oneShotSounds: 16 }, state: { blocks: { a: {} } }, mix: () => ({ music: 1, sounds: 1, voice: 1 }), music: () => null,
      pausedStage: () => null, soundSource: () => null, def: () => ({ addons: { synth: { mouth: { closed: 'c', small: 's', open: 'o' } } }, mouth: { target: 'mouth' } }), eval: () => true };
    const a = attachAudio(p, win, { assetsUrl: './', assets: async () => new ArrayBuffer(4) });
    handlers.pointerdown({ isTrusted: true });
    for (const l of p.listeners) l({ deliveries: [{ kind: 'sound', sound: 'beep', group: 'sounds', gain: 1, address: 'a', source: { synth: { wave: 'sine', from: 440, to: 440, durationMs: 50, gain: 1 } } }] });
    eq(a.log.map(e => [e.name, e.started]), [['beep', true]], 'the made sound starts (core, D31.2)');
    a.advance(25);
    eq(p.mouthLooks, undefined, 'no mouth looks');
    eq(ctx.analysers, 0, 'no analyser');
    for (const l of p.listeners) l({ deliveries: [{ kind: 'sound', sound: 'bell', group: 'sounds', gain: 1, address: 'a', source: { path: 'bell.wav' } }] });
    await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0));
    eq(started, ['synth', 'file'], 'a made sound and a plain sound play');
  },
};
