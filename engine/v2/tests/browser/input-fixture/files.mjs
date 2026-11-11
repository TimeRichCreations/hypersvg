// A small experience for the input browser run: every control kind, a disabled control with its reason, control
// looks, a shortcut key, a held button, a choice, a slider with positions, a dial and a
// drag with one drop target.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" data-hsvg-version="2.0" data-hsvg-kind="screen">
<g id="b-go" data-hsvg-kind="part"><rect x="10" y="10" width="80" height="40" fill="#8c8"/></g>
<g id="b-locked" data-hsvg-kind="part"><rect x="100" y="10" width="80" height="40" fill="#c88"/></g>
<g id="b-arm" data-hsvg-kind="part"><g data-hsvg-variant="idle"><rect x="190" y="10" width="80" height="40" fill="#ccc"/></g><g data-hsvg-variant="hover" display="none"><rect x="190" y="10" width="80" height="40" fill="#9cf"/></g><g data-hsvg-variant="focus" display="none"><rect x="190" y="10" width="80" height="40" fill="#fc9"/></g></g>
<g id="b-hide" data-hsvg-kind="part"><rect x="280" y="10" width="80" height="40" fill="#cc8"/></g>
<g id="o-a" data-hsvg-kind="part"><rect x="10" y="70" width="60" height="40" fill="#ddd"/></g>
<g id="o-b" data-hsvg-kind="part"><rect x="80" y="70" width="60" height="40" fill="#ddd"/></g>
<g id="o-c" data-hsvg-kind="part"><rect x="150" y="70" width="60" height="40" fill="#ddd"/></g>
<rect x="100" y="140" width="200" height="6" fill="#999" data-hsvg-layer="decoration"/>
<g id="knob" data-hsvg-kind="part" data-hsvg-motion="move-x 0..200"><rect x="90" y="128" width="20" height="30" fill="#36c"/></g>
<g id="basket" data-hsvg-kind="part"><rect x="280" y="200" width="100" height="80" fill="#eed"/></g>
<g id="parcel" data-hsvg-kind="part" data-hsvg-motion="move-x -400..400; move-y -300..300"><rect x="20" y="220" width="50" height="50" fill="#a63"/></g>
<g id="dial" data-hsvg-kind="part" data-hsvg-pivot="355 125" data-hsvg-motion="rotate -90..90"><circle cx="355" cy="125" r="20" fill="#555"/><rect x="353" y="106" width="4" height="12" fill="#fd0"/></g>
</svg>`;
const set = (name, to) => ({ set: name, to });
const scene = {
  format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg',
  values: {
    presses: { type: 'number', initial: 0, minimum: 0, maximum: 99 }, holding: { type: 'boolean', initial: false },
    armed: { type: 'boolean', initial: false }, showGo: { type: 'boolean', initial: true },
    choice: { type: 'string', initial: '', maxLength: 1 }, speed: { type: 'number', initial: 0, minimum: 0, maximum: 100 },
    heat: { type: 'number', initial: 0, minimum: 0, maximum: 100 },
    carried: { type: 'boolean', initial: false }, log: { type: 'string', initial: '', maxLength: 500 },
  },
  controls: {
    go: { kind: 'button', target: 'b-go', event: 'went', held: 'holding', keys: ['KeyN'], label: 'Go' },
    locked: { kind: 'button', target: 'b-locked', event: 'unlocked', enabled: 'armed', label: 'Locked', disabledLabel: 'Arm first' },
    arm: { kind: 'button', target: 'b-arm', event: 'armIt', label: 'Arm' },
    hide: { kind: 'button', target: 'b-hide', event: 'hideGo', label: 'Hide go' },
    pick: { kind: 'choice', value: 'choice', event: 'picked', options: {
      a: { target: 'o-a', value: "'a'", label: 'Option A' }, b: { target: 'o-b', value: "'b'", label: 'Option B' },
      c: { target: 'o-c', value: "'c'", label: 'Option C', keys: ['KeyC'] } } },
    speed: { kind: 'slider', target: 'knob', value: 'speed', axis: 'x', range: [0, 200], positions: 5, label: 'Speed' },
    heat: { kind: 'dial', target: 'dial', value: 'heat', range: [-90, 90], positions: 5, label: 'Heat' },
    parcel: { kind: 'drag', target: 'parcel', drops: ['basket'], picked: 'carried', event: 'dropped', missEvent: 'missed', label: 'Parcel' },
  },
  bindings: [
    { id: 'go-shown', target: 'b-go', visible: 'showGo' },
    { id: 'knob-at', target: 'knob', axis: 'x', move: 'speed * 2' },
    { id: 'dial-at', target: 'dial', rotate: '-90 + heat * 1.8' },
  ],
  on: {
    went: [{ id: 'w', actions: [{ id: 'w1', set: 'presses', to: 'presses + 1' }] }],
    unlocked: [{ id: 'u', actions: [{ id: 'u1', ...set('log', "log + 'unlocked '") }] }],
    armIt: [{ id: 'r', actions: [{ id: 'r1', ...set('armed', true) }] }],
    hideGo: [{ id: 'h', actions: [{ id: 'h1', ...set('showGo', false) }] }],
    picked: [{ id: 'p', actions: [{ id: 'p1', ...set('log', "log + 'picked:' + choice + ' '") }] }],
    dropped: [{ id: 'd', actions: [{ id: 'd1', ...set('log', "log + 'dropped:' + event.drop + ' '") }] }],
    missed: [{ id: 'm', actions: [{ id: 'm1', ...set('log', "log + 'missed '") }] }],
    'key:KeyA': [{ id: 'k', actions: [{ id: 'k1', ...set('log', "log + 'A '") }] }],
  },
};
for (const list of Object.values(scene.on)) for (const r of list) for (const a of r.actions) a.id ??= `${r.id}x`;
export const files = {
  'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'input-run', story: { start: 'one', scenes: { one: 'scenes/one/scene.json' }, ends: ['one'] } },
  'scenes/one/scene.json': scene,
  'scenes/one/one.svg': svg,
};
