// A small experience for the fault browser run (9.2): a press that counts, a press whose action faults (E-RANGE),
// a timer whose transition faults after 1 s, and a press that plays a sound file the browser cannot decode.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" data-hsvg-version="2.0" data-hsvg-kind="screen">
<g id="b-go" data-hsvg-kind="part"><rect x="10" y="10" width="80" height="40" fill="#8c8"/></g>
<g id="b-bad" data-hsvg-kind="part"><rect x="100" y="10" width="80" height="40" fill="#c88"/></g>
<g id="b-beep" data-hsvg-kind="part"><rect x="190" y="10" width="80" height="40" fill="#88c"/></g>
</svg>`;
const scene = {
  format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg',
  values: { n: { type: 'number', initial: 0, minimum: 0, maximum: 9 } },
  controls: {
    go: { kind: 'button', target: 'b-go', event: 'went', keys: ['KeyG'], label: 'Go' },
    bad: { kind: 'button', target: 'b-bad', event: 'broke', keys: ['KeyX'], label: 'Bad' },
    beep: { kind: 'button', target: 'b-beep', event: 'beeped', label: 'Beep' },
  },
  machines: [{ id: 'clock', initial: 'wait', states: { wait: { after: [{ id: 'late', delayMs: 1000, target: 'done', actions: [{ id: 'late-bad', set: 'n', to: 'n + 50' }] }] }, done: {} } }],
  on: {
    went: [{ id: 'w', actions: [{ id: 'w1', set: 'n', to: 'n + 1' }] }],
    broke: [{ id: 'b', actions: [{ id: 'b1', set: 'n', to: 'n + 100' }] }],
    beeped: [{ id: 'p', actions: [{ id: 'p1', play: "'bad'", as: 'sound' }] }],
  },
};
export const files = {
  'experience.json': {
    format: 'hsvg/2.0', kind: 'experience', id: 'fault-run', needs: ['synth'],
    story: { start: 'one', scenes: { one: 'scenes/one/scene.json' }, ends: ['one'] },
    resources: { bad: { kind: 'sound', file: 'sounds/bad.ogg', digest: 'sha256:d283440a8a18e90b61e7b56c2a05751ffe36683774c77d3a165558e89de93490' } },
  },
  'scenes/one/scene.json': scene,
  'scenes/one/one.svg': svg,
};
// Served at /assets/sounds/bad.ogg: bytes that are no sound.
export const badSound = Buffer.from('this is not an ogg file at all');
