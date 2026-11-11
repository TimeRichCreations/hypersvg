// A small experience with a shell (10.1, A6.1) for the shell browser run: a top bar with a gear, a stage, a settings
// dialog that pauses and holds a declared form, and a scores table; scene b hides the top bar.
const shellSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" data-hsvg-version="2.0" data-hsvg-kind="screen">
<rect width="400" height="300" fill="#eee" data-hsvg-layer="backdrop"/>
<g id="bar" data-hsvg-kind="part" data-hsvg-slot="top-bar"><rect x="0" y="0" width="400" height="36" fill="#246"/>
<g id="home-btn" data-hsvg-kind="part"><rect x="4" y="4" width="40" height="28" fill="#9cf"/></g>
<g id="gear" data-hsvg-kind="part"><rect x="356" y="4" width="40" height="28" fill="#fc6"/></g></g>
<rect id="stage-box" x="0" y="40" width="300" height="260" fill="none" data-hsvg-slot="stage" data-hsvg-kind="part"/>
<rect id="scores-box" x="304" y="40" width="96" height="120" fill="#fff" data-hsvg-slot="scores" data-hsvg-kind="part"/>
<rect id="settings-box" x="40" y="50" width="320" height="220" fill="#fff" data-hsvg-slot="settings" data-hsvg-kind="part"/>
</svg>`;
const sceneSvg = (id, fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" data-hsvg-version="2.0" data-hsvg-kind="screen">
<rect width="200" height="100" fill="${fill}" data-hsvg-layer="backdrop"/>
<g id="next" data-hsvg-kind="part"><rect x="70" y="30" width="60" height="40" fill="#8c8"/></g>
</svg>`;
export const files = {
  'experience.json': {
    format: 'hsvg/2.0', kind: 'experience', id: 'shell-run', needs: ['widgets'], shell: 'shell/frame.json',
    inputs: {
      musicVolume: { kind: 'knob', type: 'number', minimum: 0, maximum: 1, step: 0.1, initial: 0.5 },
      fast: { kind: 'knob', type: 'boolean', initial: false },
    },
    addons: { widgets: { settings: { groups: { sound: 'Sound' }, items: [
      { id: 'music', knob: 'musicVolume', label: 'Music', group: 'sound', when: 'play' },
      { id: 'fast', knob: 'fast', label: 'Fast', when: 'play' }] } } },
    data: {},
    story: { start: 'a', scenes: { a: 'scenes/a/scene.json', b: 'scenes/b/scene.json' }, ends: ['b'],
      links: [{ id: 'a-b', from: 'a', on: 'go', to: 'b' }, { id: 'a-b-timed', from: 'a', afterMs: 3000, to: 'b' }, { id: 'frame-home', from: 'frame', on: 'home', to: 'a' }] },
  },
  'shell/frame.json': {
    format: 'hsvg/2.0', kind: 'shell', id: 'frame', needs: ['widgets'], drawing: 'frame.svg',
    slots: {
      'top-bar': { kind: 'widget', landmark: 'navigation', label: 'Top bar', hideable: true },
      stage: { kind: 'stage', label: 'Stage' },
      scores: { kind: 'widget', label: 'Scores' },
      settings: { kind: 'dialog', label: 'Settings', openValue: 'settingsOpen', pauses: true },
    },
    values: { settingsOpen: { type: 'boolean', initial: false } },
    controls: { gear: { kind: 'button', target: 'gear', event: 'openSettings', label: 'Settings' }, home: { kind: 'button', target: 'home-btn', event: 'home', label: 'Home' } },
    addons: { widgets: {
      settings: { form: { settings: true } },
      scores: { table: { rows: "[{'who': 'Robin', 'score': 3}, {'who': 'Fia', 'score': 5}]", columns: [{ column: 'who', label: 'Who' }, { column: 'score', label: 'Score' }] } },
    } },
    outputs: { home: { kind: 'event' } },
    on: { openSettings: [{ id: 'o', actions: [{ id: 'o1', open: 'settings' }] }] },
  },
  'shell/frame.svg': shellSvg,
  'scenes/a/scene.json': { format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg', outputs: { go: { kind: 'event' } },
    controls: { next: { kind: 'button', target: 'next', event: 'go', label: 'Next' } } },
  'scenes/a/a.svg': sceneSvg('a', '#cde'),
  'scenes/b/scene.json': { format: 'hsvg/2.0', kind: 'scene', id: 'b', drawing: 'b.svg', hideSlots: ['top-bar'] },
  'scenes/b/b.svg': sceneSvg('b', '#edc'),
};
