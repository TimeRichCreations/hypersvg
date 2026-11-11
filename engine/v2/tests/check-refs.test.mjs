// The references-and-ids rules of the 2.0 checker (engine/v2/check/refs.mjs): each rule has a valid experience that
// passes and one change that fails with exactly the code the spec gives.
import { checkExperience } from '../check/index.mjs';
import { schemas, eq, mapSource } from './helpers.mjs';

const digest = (n) => `sha256:${String(n).padStart(64, '0')}`;
const svg = (body, kind = 'screen') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hsvg-version="2.0"${kind ? ` data-hsvg-kind="${kind}"` : ''}><title>t</title>${body}</svg>`;
const sceneSvg = (extra = '') => svg(`<rect id="go" data-hsvg-kind="part" data-hsvg-pivot="5 5" data-hsvg-motion="rotate -90..90" width="10" height="10"/><g id="badge-spot" data-hsvg-kind="part" data-hsvg-slot="badge-spot"/>`
  + `<g id="mouth" data-hsvg-kind="part" data-hsvg-pivot="50 50"><g data-hsvg-variant="closed"><rect width="5" height="5"/></g><g data-hsvg-variant="open" display="none"><rect width="6" height="6"/></g></g>${extra}`);
const badgeSvg = svg('<g id="badge" data-hsvg-kind="component"><g id="badge__face" data-hsvg-kind="part"><rect width="5" height="5"/></g></g>', null);

// A small valid experience: one scene that uses one component.
export function base() {
  return {
    'experience.json': {
      format: 'hsvg/2.0', kind: 'experience', id: 'tiny', language: 'en',
      story: { start: 'one', scenes: { one: 'scenes/one/scene.json' }, ends: ['one'] },
      blocks: { badge: 'blocks/badge/component.json' },
      values: { flag: { type: 'boolean', initial: false } },
      inputs: { level: { kind: 'knob', type: 'number', minimum: 0, maximum: 3, initial: 1 } },
      resources: {
        'words-en': { kind: 'words', file: 'words/en.csv', language: 'en', digest: digest(1) },
        bell: { kind: 'sound', file: 'sounds/bell.wav', digest: digest(2) },
      },
    },
    'words/en.csv': 'id,text\ngo,Go\n',
    'scenes/one/scene.json': {
      format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg',
      uses: [{ id: 'badge', use: 'badge', into: 'badge-spot', with: { title: "'Hi'" } }],
      values: { score: { type: 'number', initial: 0, minimum: 0, maximum: 9 } },
      computed: { double: 'score * 2' },
      outputs: { done: { kind: 'event' } },
      controls: { go: { kind: 'button', target: 'go', label: '{{ words.go }}' } },
      bindings: [{ id: 'mouth-look', target: 'mouth', variant: "score > 0 ? 'open' : 'closed'" }],
      clips: { wave: { durationMs: 500, tracks: [{ id: 'turn', target: 'go', channel: 'rotate', keys: [[0, 0], [500, 10]] }] } },
      music: { sound: 'bell' },
      on: {
        'press:go': [{ id: 'go-pressed', actions: [
          { id: 'count', set: 'score', to: 'score + 1' },
          { id: 'turn-it', play: 'wave' },
          { id: 'ding', play: "'bell'", as: 'sound' },
          { id: 'cheer', emit: 'badge.celebrate', as: 'trigger' },
          { id: 'raise', set: 'flag', to: '!flag' },
          { id: 'finish', emit: 'done' }] }],
        'badge.opened': [{ id: 'badge-opened', actions: [{ id: 'stop-turn', stop: 'wave' }] }],
        'ended:wave': [{ id: 'wave-ended', actions: [{ id: 'quiet', set: 'flag', to: 'false' }] }],
        'changed:score': [{ id: 'score-changed', actions: [{ id: 'hush', stop: 'wave' }] }],
        'key:KeyA': [{ id: 'key-a', actions: [{ id: 'again', emit: 'done' }] }],
      },
    },
    'scenes/one/one.svg': sceneSvg(),
    'blocks/badge/component.json': {
      format: 'hsvg/2.0', kind: 'component', id: 'badge', drawing: 'badge.svg',
      inputs: { title: { kind: 'content', type: 'string', maxLength: 20 }, celebrate: { kind: 'trigger' } },
      outputs: { opened: { kind: 'event' } },
    },
    'blocks/badge/badge.svg': badgeSvg,
  };
}

function codes(files, only = ['refs']) {
  const r = checkExperience(mapSource(files), schemas(), { only });
  return r.diags.map(d => d.code);
}
const scene = (files) => files['scenes/one/scene.json'];
const fails = (files, code, count = 1) => eq(codes(files), Array(count).fill(code));
// A tall layout for the scene whose drawing lacks `extra` ids is made by these two helpers.
function twoLayouts(files, tallSvg) {
  files['experience.json'].axes = [{ axis: 'shape', select: 'space', shapes: { wide: { minAspect: 1 }, tall: { maxAspect: 1 } } }];
  delete scene(files).drawing;
  scene(files).layouts = [{ id: 'wide', shape: 'wide', drawing: 'one.svg' }, { id: 'tall', shape: 'tall', drawing: 'one-tall.svg' }];
  files['scenes/one/one-tall.svg'] = tallSvg;
}

export const tests = {
  'the small valid experience passes every rule'() { eq(codes(base()), []); eq(codes(base(), null), []); },

  // 1. uses (4.3, 4.5)
  'a use of a block that is not listed is E-REF-UNKNOWN'() { const f = base(); scene(f).uses[0].use = 'nope'; fails(f, 'E-REF-UNKNOWN'); },
  'a with key that is no input of the block is E-REF-UNKNOWN'() { const f = base(); scene(f).uses[0].with.color = "'red'"; fails(f, 'E-REF-UNKNOWN'); },
  'an input without initial that the use does not supply is E-KEY-REQUIRED'() { const f = base(); scene(f).uses[0].with = {}; fails(f, 'E-KEY-REQUIRED'); },
  'a use into a slot that is not drawn is E-REF-UNKNOWN'() { const f = base(); scene(f).uses[0].into = 'elsewhere'; fails(f, 'E-REF-UNKNOWN'); },
  'a slot drawn in only one layout is E-LAYOUT-MISSING'() {
    const f = base(); twoLayouts(f, svg('<rect id="go" data-hsvg-kind="part" width="1" height="1"/><g id="mouth" data-hsvg-kind="part"><g data-hsvg-variant="closed"><rect width="1" height="1"/></g><g data-hsvg-variant="open" display="none"><rect width="1" height="1"/></g></g>'));
    eq(codes(f), ['E-LAYOUT-MISSING']);
  },

  // 2. targets (5.11, 6.7, 6.8)
  'a control target that is not drawn is E-REF-UNKNOWN'() { const f = base(); scene(f).controls.go.target = 'nowhere'; fails(f, 'E-REF-UNKNOWN', 2); /* the target, and press:go that now has no producer */ },
  'a binding target that is not drawn is E-REF-UNKNOWN'() { const f = base(); scene(f).bindings.push({ id: 'b2', target: 'nowhere', visible: 'true' }); fails(f, 'E-REF-UNKNOWN'); },
  'a clip track target that is not drawn is E-REF-UNKNOWN'() { const f = base(); scene(f).clips.wave.tracks[0].target = 'nowhere'; fails(f, 'E-REF-UNKNOWN'); },
  'an option target that is not drawn is E-REF-UNKNOWN'() {
    const f = base();
    scene(f).values.chosen = { type: 'string', initial: 'a', maxLength: 4 };
    scene(f).controls.chosen = { kind: 'choice', value: 'chosen', options: { a: { target: 'go', value: "'a'" }, b: { target: 'nowhere', value: "'b'" } } };
    fails(f, 'E-REF-UNKNOWN');
  },
  'a control target missing from one layout is E-LAYOUT-MISSING'() {
    const f = base(); twoLayouts(f, svg('<g id="badge-spot" data-hsvg-kind="part" data-hsvg-slot="badge-spot"/><g id="mouth" data-hsvg-kind="part"><g data-hsvg-variant="closed"><rect width="1" height="1"/></g><g data-hsvg-variant="open" display="none"><rect width="1" height="1"/></g></g>'));
    // go is a control target and a clip target: one finding for each
    eq(codes(f), ['E-LAYOUT-MISSING', 'E-LAYOUT-MISSING']);
  },

  // 3. looks (6.2.4, 6.8)
  'a binding look that is not drawn is E-LOOK-NOT-DRAWN'() { const f = base(); scene(f).bindings[0].variant = "score > 0 ? 'wide' : 'closed'"; fails(f, 'E-LOOK-NOT-DRAWN'); },
  'a look clip key that is not drawn is E-LOOK-NOT-DRAWN'() {
    const f = base();
    scene(f).clips.talk = { durationMs: 400, tracks: [{ id: 'talk-look', target: 'mouth', channel: 'variant', keys: [[0, "'closed'"], [200, "'wide'"]] }] };
    fails(f, 'E-LOOK-NOT-DRAWN');
  },
  'a look drawn in one layout only is E-LOOK-NOT-DRAWN'() {
    const f = base(); twoLayouts(f, svg('<rect id="go" data-hsvg-kind="part" width="1" height="1"/><g id="badge-spot" data-hsvg-kind="part" data-hsvg-slot="badge-spot"/><g id="mouth" data-hsvg-kind="part"><g data-hsvg-variant="closed"><rect width="1" height="1"/></g><g data-hsvg-variant="smile" display="none"><rect width="1" height="1"/></g></g>'));
    eq(codes(f), ['E-LOOK-NOT-DRAWN']);
  },

  // 4. actions (5.15.1)
  'play of a clip the block does not have is E-REF-UNKNOWN'() { const f = base(); scene(f).on['press:go'][0].actions[1].play = 'jump'; fails(f, 'E-REF-UNKNOWN'); },
  'trigger of a use that is not there is E-REF-UNKNOWN'() { const f = base(); scene(f).on['press:go'][0].actions[3].emit = 'nobody.celebrate'; fails(f, 'E-REF-UNKNOWN'); },
  'trigger of an input that is no trigger is E-REF-UNKNOWN'() { const f = base(); scene(f).on['press:go'][0].actions[3].emit = 'badge.title'; fails(f, 'E-REF-UNKNOWN'); },
  'attach of a name that is no use is E-REF-UNKNOWN'() { const f = base(); scene(f).on['press:go'][0].actions.push({ id: 'load', call: 'player.attach', with: {part: "'ghost'", to: "'badge.nowhere'"} }); eq(codes(f), ['E-REF-UNKNOWN', 'E-REF-UNKNOWN']); },
  'set of an input is E-WRITE-INPUT'() { const f = base(); scene(f).on['press:go'][0].actions.push({ id: 'bad', set: 'level', to: '2' }); fails(f, 'E-WRITE-INPUT'); },
  'set of a computed value is E-WRITE-INPUT'() { const f = base(); scene(f).on['press:go'][0].actions.push({ id: 'bad', set: 'double', to: '2' }); fails(f, 'E-WRITE-INPUT'); },
  'set of a name nobody declares is E-REF-UNKNOWN'() { const f = base(); scene(f).on['press:go'][0].actions.push({ id: 'bad', set: 'ghost', to: '2' }); fails(f, 'E-REF-UNKNOWN'); },
  'a scene may write the experience values (5.1.3)'() { const f = base(); scene(f).on['press:go'][0].actions.push({ id: 'ok', set: 'flag', to: 'true' }); eq(codes(f), []); },
  'a component writing an experience value is E-REF-PRIVATE'() {
    const f = base(); f['blocks/badge/component.json'].on = { celebrate: [{ id: 'cel', actions: [{ id: 'w', set: 'flag', to: 'true' }] }] };
    fails(f, 'E-REF-PRIVATE');
  },
  'a setting that no play item names is E-WRITE-INPUT'() {
    const f = base(); scene(f).on['press:go'][0].actions.push({ id: 'tune', call: 'player.setting', with: {level: '2'} }); fails(f, 'E-WRITE-INPUT');
    f['experience.json'].addons = { widgets: { settings: { items: [{ id: 'level-item', knob: 'level', label: '{{ words.go }}', when: 'play' }] } } }; (f['experience.json'].needs ??= []).push('widgets');
    eq(codes(f), []);
  },

  // 5. reaction keys (5.12, 5.13)
  'a custom event nobody produces is E-REF-UNKNOWN'() { const f = base(); scene(f).on.nobodyEmitsThis = [{ id: 'dead', actions: [{ id: 'x', emit: 'done' }] }]; fails(f, 'E-REF-UNKNOWN'); },
  'press of a target with no control is E-REF-UNKNOWN'() { const f = base(); scene(f).on['press:mouth'] = [{ id: 'dead', actions: [{ id: 'x', emit: 'done' }] }]; fails(f, 'E-REF-UNKNOWN'); },
  'changed of a computed value is E-REF-UNKNOWN'() { const f = base(); scene(f).on['changed:double'] = [{ id: 'dead', actions: [{ id: 'x', emit: 'done' }] }]; fails(f, 'E-REF-UNKNOWN'); },
  'ended of an unknown clip is E-REF-UNKNOWN'() { const f = base(); scene(f).on['ended:jump'] = [{ id: 'dead', actions: [{ id: 'x', emit: 'done' }] }]; fails(f, 'E-REF-UNKNOWN'); },
  'a use event that the block does not output is E-REF-UNKNOWN'() { const f = base(); scene(f).on['badge.closed'] = [{ id: 'dead', actions: [{ id: 'x', emit: 'done' }] }]; fails(f, 'E-REF-UNKNOWN'); },
  'a machine state key is checked like a root key'() {
    const f = base();
    scene(f).machines = [{ id: 'm', initial: 'a', states: { a: { on: { 'press:go': [{ id: 'm-go', target: 'b' }], nothing: [{ id: 'm-dead', target: 'b' }] } }, b: {} } }];
    fails(f, 'E-REF-UNKNOWN');
  },
  'a trigger input and a control event are producers'() {
    const f = base();
    scene(f).inputs = { poke: { kind: 'trigger' } };
    scene(f).controls.go.event = 'went';
    scene(f).on.poke = [{ id: 'poked', actions: [{ id: 'p', emit: 'done' }] }];
    scene(f).on.went = [{ id: 'went-it', actions: [{ id: 'w', emit: 'done' }] }];
    delete scene(f).on['press:go'];
    eq(codes(f), []);
  },

  // 6. resources (2.6)
  'a sound action naming no sound is E-REF-UNKNOWN'() { const f = base(); scene(f).on['press:go'][0].actions[2].play = "'gong'"; fails(f, 'E-REF-UNKNOWN'); },
  'a synth is a sound'() { const f = base(); f['experience.json'].needs = ['synth']; f['experience.json'].audioSynths = { blip: { wave: 'sine', from: 440, to: 440, durationMs: 100, gain: 0.5 } }; scene(f).on['press:go'][0].actions[2].play = "'blip'"; eq(codes(f), []); },
  'a scene music sound that is no resource is E-REF-UNKNOWN'() { const f = base(); scene(f).music.sound = 'gong'; fails(f, 'E-REF-UNKNOWN'); },
  'a resource id declared by a scene and the experience is E-NAME-SHADOW'() {
    const f = base(); scene(f).resources = { bell: { kind: 'sound', file: 'scenes/one/bell.wav', digest: digest(3) } }; fails(f, 'E-NAME-SHADOW');
  },
  'one path declared twice in a document is E-RESOURCE-TWICE'() {
    const f = base(); f['experience.json'].resources.bell2 = { kind: 'sound', file: 'sounds/bell.wav', digest: digest(4) }; fails(f, 'E-RESOURCE-TWICE');
  },
  'equal digests in a document are E-RESOURCE-TWICE'() {
    const f = base(); f['experience.json'].resources.bell2 = { kind: 'sound', file: 'sounds/bell2.wav', digest: digest(2) }; fails(f, 'E-RESOURCE-TWICE');
  },
  'a scene value that reuses an experience value is E-NAME-SHADOW'() { const f = base(); scene(f).values.flag = { type: 'boolean', initial: false }; fails(f, 'E-NAME-SHADOW'); },

  // 7. words (2.7, 5.7)
  'a template word that no words file has is E-REF-UNKNOWN'() { const f = base(); scene(f).controls.go.label = '{{ words.missing }}'; fails(f, 'E-REF-UNKNOWN'); },
  'a plural word is found by its other form'() { const f = base(); f['words/en.csv'] += 'left.one,One\nleft.other,Many\n'; scene(f).controls.go.label = '{{ words.left }}'; eq(codes(f), []); },
  'a translation that adds a word is E-WORDS-UNKNOWN'() {
    const f = base();
    f['experience.json'].resources['words-de'] = { kind: 'words', file: 'words/de.csv', language: 'de', digest: digest(5) };
    f['words/de.csv'] = 'id,text\ngo,Los\nextra,Mehr\n';
    fails(f, 'E-WORDS-UNKNOWN');
  },

  // 8. ids (2.9, 5.3)
  'an input and a value with one name are E-ID-DUPLICATE'() { const f = base(); scene(f).inputs = { score: { kind: 'knob', type: 'number', minimum: 0, maximum: 3, initial: 1 } }; fails(f, 'E-ID-DUPLICATE'); },
  'a use id that equals a value name is E-ID-DUPLICATE'() { const f = base(); scene(f).uses[0].id = 'score'; scene(f).on['score.opened'] = scene(f).on['badge.opened']; delete scene(f).on['badge.opened']; scene(f).on['press:go'][0].actions[3].emit = 'score.celebrate'; fails(f, 'E-ID-DUPLICATE'); },
  'an action id that equals a reaction id is E-ID-DUPLICATE'() { const f = base(); scene(f).on['press:go'][0].actions[0].id = 'go-pressed'; fails(f, 'E-ID-DUPLICATE'); },
  'two machine states of one name are E-ID-DUPLICATE'() {
    const f = base();
    scene(f).machines = [{ id: 'm', initial: 'a', states: { a: { initial: 'b', states: { b: {} } }, c: { initial: 'b', states: { b: {} } } } }];
    fails(f, 'E-ID-DUPLICATE');
  },
};
