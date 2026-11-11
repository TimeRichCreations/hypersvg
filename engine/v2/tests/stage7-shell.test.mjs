// The shell in the engine (10.1): it mounts once before the start scene and stays; its outputs drive links that
// replace the stage's scene; open and close write a dialog's openValue; a dialog with pauses holds the stage's time.
import { Player } from '../src/story.mjs';
import { eq, ok } from './helpers.mjs';

const shell = {
  format: 'hsvg/2.0', kind: 'shell', id: 'frame', needs: ['shell'], drawing: 'frame.svg',
  slots: { stage: { kind: 'stage', label: 'Stage' }, settings: { kind: 'dialog', label: 'Settings', openValue: 'settingsOpen', pauses: true },
    help: { kind: 'dialog', label: 'Help', openValue: 'helpOpen' } },
  values: { settingsOpen: { type: 'boolean', initial: false }, helpOpen: { type: 'boolean', initial: false }, taps: { type: 'number', initial: 0 } },
  outputs: { map: { kind: 'event' } },
  on: {
    tap: [{ id: 't', actions: [{ id: 't1', set: 'taps', to: 'taps + 1' }] }],
    goMap: [{ id: 'g', actions: [{ id: 'g1', emit: 'map' }] }],
    gear: [{ id: 'o', actions: [{ id: 'o1', open: 'settings' }] }],
  },
};
const scene = (id, extra = {}) => ({ file: `${id}.json`, doc: { format: 'hsvg/2.0', kind: 'scene', id, drawing: `${id}.svg`, ...extra }, drawings: {}, words: {} });
const make = () => new Player({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', needs: ['shell'], shell: 'frame.json',
    story: { start: 'a', scenes: { a: 'a.json', b: 'b.json', map: 'map.json' }, ends: ['map'],
      links: [{ id: 'a-b', from: 'a', afterMs: 500, to: 'b' }, { id: 'frame-map', from: 'frame', on: 'map', to: 'map' }] } },
  words: { en: {} }, data: {}, blocks: {}, shell: { file: 'frame.json', doc: shell, drawings: {}, words: {} },
  scenes: { a: scene('a', { values: { n: { type: 'number', initial: 0 }, heard: { type: 'string', initial: '' } }, clips: { wave: { durationMs: 300, tracks: [{ id: 'w', target: 'x', channel: 'opacity', keys: [[0, 1], [300, 0]] }] } },
    on: { paused: [{ id: 'pz', actions: [{ id: 'pz1', set: 'heard', to: "heard + 'paused:' + event.reason + ' '" }] }], resumed: [{ id: 'rz', actions: [{ id: 'rz1', set: 'heard', to: "heard + 'resumed:' + event.reason + ' '" }] }],
      closeIt: [{ id: 'c', actions: [{ id: 'c1', close: 'settings' }] }], bad: [{ id: 'b', actions: [{ id: 'b1', open: 'nowhere' }] }] } }), b: scene('b'), map: scene('map') },
});

export const tests = {
  'the shell mounts before the start scene and keeps its values while scenes change'() {
    const p = make(); ok(p.start().ok);
    ok(p.state.blocks.frame?.kind === 'shell');
    p.send('frame', 'tap');
    p.advance(600);
    eq([p.scene, p.read('frame', 'taps')], ['b', 1]);
  },
  "a shell output fires its link, replacing the stage's scene"() {
    const p = make(); p.start();
    ok(p.send('frame', 'goMap').ok);
    eq(p.scene, 'map');
    ok(p.state.blocks.frame, 'the shell stays');
  },
  'open and close write the openValue; an unknown slot is a fault'() {
    const p = make(); p.start();
    p.send('frame', 'gear');
    eq([p.read('frame', 'settingsOpen'), p.openDialogs().map(d => d.id)], [true, ['settings']]);
    p.send('a', 'closeIt');
    eq(p.read('frame', 'settingsOpen'), false);
    eq(p.send('a', 'bad').fault?.code, 'E-REF-UNKNOWN');
  },
  "a dialog with pauses holds the stage's timed links and clips; one without does not"() {
    const p = make(); p.start();
    p.transaction('host', () => p.playClip('a', 'wave'));
    p.send('frame', 'gear');
    p.advance(1000);
    eq([p.scene, p.state.blocks.a.clips.wave.startedAt], ['a', 1000], 'held while settings are open');
    p.send('a', 'closeIt');
    p.advance(499); eq(p.scene, 'a');
    p.advance(1); eq(p.scene, 'b', 'the timed link fires 500 ms of stage time after entry');
    const q = make(); q.start();
    q.transaction('host', () => q.dialog('help', true));
    q.advance(600); eq(q.scene, 'b', 'help does not pause');
  },
  'a settings Apply writes every change at once, or none; ambient settings too (5.3.2)'() {
    const p = new Player({
      doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', story: { start: 'a', scenes: { a: 'a.json' } },
        inputs: { music: { kind: 'knob', type: 'number', minimum: 0, maximum: 1, initial: 0.5 }, fast: { kind: 'knob', type: 'boolean', initial: false } } },
      words: { en: {} }, data: {}, blocks: {},
      scenes: { a: scene('a', { values: { log: { type: 'string', initial: '' } }, on: {
        'changed:music': [{ id: 'm', actions: [{ id: 'm1', set: 'log', to: "log + 'music '" }] }],
        'changed:fast': [{ id: 'f', actions: [{ id: 'f1', set: 'log', to: "log + 'fast '" }] }] } }) },
    });
    p.start();
    eq(p.applySettings([['music', 0.2], ['fast', 'yes']]).fault?.code, 'E-TYPE');
    eq(p.state.blocks.experience.inputs.music, 0.5, 'nothing written');
    ok(p.applySettings([['fast', true], ['music', 0.2], ['muted', true]]).ok);
    eq([p.state.blocks.experience.inputs.music, p.state.ambient.muted, p.read('a', 'log')], [0.2, true, 'fast music '], 'changed in item order');
    eq(p.applySettings([['secret', 1]]).fault?.code, 'E-SETTING');
  },
  'the stage scene hears paused and resumed, with the reason (3.10)'() {
    const p = make(); p.start();
    p.send('frame', 'gear');
    p.send('a', 'closeIt');
    p.setPause('host', true); p.setPause('hidden', true); p.setPause('host', false); p.setPause('hidden', false);
    eq(p.read('a', 'heard'), 'paused:dialog resumed:dialog paused:host resumed:hidden ');
    p.transaction('host', () => p.dialog('help', true)); p.afterCommit();
    eq(p.read('a', 'heard'), 'paused:dialog resumed:dialog paused:host resumed:hidden ', 'a dialog without pauses is no reason');
  },
  'restart mounts a fresh shell'() {
    const p = make(); p.start();
    p.send('frame', 'tap'); p.send('frame', 'gear');
    ok(p.restart().ok);
    eq([p.read('frame', 'taps'), p.read('frame', 'settingsOpen'), p.scene], [0, false, 'a']);
  },
};
