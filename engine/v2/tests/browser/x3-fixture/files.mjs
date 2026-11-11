// A small experience for the X3 browser run: a shortcut key G whose key:KeyG reaction faults (the same keydown must
// not then press Go), a counter of changed:size,
// and the box and shape it reads (5.5).
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>X3</title>
<g id="b-go" data-hsvg-kind="part"><rect x="10" y="10" width="80" height="40" fill="#8c8"/></g>
</svg>`;
const scene = {
  format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg',
  values: { n: { type: 'number', initial: 0, minimum: 0, maximum: 9 }, sizes: { type: 'number', initial: 0, minimum: 0, maximum: 999 } },
  computed: { box: "size.shape + ' ' + numberText(size.width, 0) + 'x' + numberText(size.height, 0)" },
  controls: { go: { kind: 'button', target: 'b-go', event: 'went', keys: ['KeyG'], label: 'Go' } },
  on: {
    went: [{ id: 'w', actions: [{ id: 'w1', set: 'n', to: 'n + 1' }] }],
    'key:KeyG': [{ id: 'k', actions: [{ id: 'k1', set: 'n', to: 'n + 100' }] }],
    'changed:size': [{ id: 's', actions: [{ id: 's1', set: 'sizes', to: 'sizes + 1' }] }],
  },
};
export const files = {
  'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'x3-run', story: { start: 'one', scenes: { one: 'scenes/one/scene.json' }, ends: ['one'] } },
  'scenes/one/scene.json': scene,
  'scenes/one/one.svg': svg,
};
