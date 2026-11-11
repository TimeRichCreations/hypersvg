// A small experience for the drawing builds (drawing.mjs, input-web.mjs, player-web.mjs): one 800 x 600 scene.
// - Rect slots (5.10): the badge (viewBox 40 x 20) in a 300 x 100 box and in a 60 x 60 box: fitted and centred.
// - A repeat region (4.5, 5.10): five dots, one per row of `names`, in the region's five child slots, in order.
// - Placement points (6.2.1): the pin's pivot is its foot (20 40); the flag has none, so its viewBox centre.
// - Reduced motion (6.7): `slide` (1 s, finish) and `spin` (an endless loop) start on entry; `heard` counts
//   changed:reducedMotion.
// - Snap (5.11): the token is a drag with snap: true onto the goal; `drops` counts accepted drops. The shifter moves
//   the goal by a binding (`goalShift`, x) and a clip (`goal-rise`, y); a snapped token follows.
// - A focus outline past a component's viewBox (6.4, 5.11): the tile's face, a press control, fills the
//   tile's viewBox; its focus outline must still be painted.
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20" width="40" height="20" data-hsvg-version="2.0">
<title>Badge</title>
<g id="badge" data-hsvg-kind="component"><rect id="badge__face" data-hsvg-kind="part" x="0" y="0" width="40" height="20" rx="4" fill="#e6af42"/></g>
</svg>`;
const dot = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40" data-hsvg-version="2.0">
<title>Dot</title>
<g id="dot" data-hsvg-kind="component"><circle id="dot__disc" data-hsvg-kind="part" cx="20" cy="20" r="18" fill="#168e91"/>
<text id="dot__name" data-hsvg-kind="part" x="20" y="26" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#fff4d8">?</text></g>
</svg>`;
const pin = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40" data-hsvg-version="2.0">
<title>Pin</title>
<g id="pin" data-hsvg-kind="component" data-hsvg-pivot="20 40"><rect id="pin__body" data-hsvg-kind="part" x="0" y="0" width="40" height="40" fill="#153b4b"/></g>
</svg>`;
const flag = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" width="60" height="30" data-hsvg-version="2.0">
<title>Flag</title>
<g id="flag" data-hsvg-kind="component"><rect id="flag__cloth" data-hsvg-kind="part" x="0" y="0" width="60" height="30" fill="#ed795f"/></g>
</svg>`;
const tile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40" width="120" height="40" data-hsvg-version="2.0">
<title>Tile</title>
<g id="tile" data-hsvg-kind="component" data-hsvg-pivot="0 0"><rect id="tile__face" data-hsvg-kind="part" x="0" y="0" width="120" height="40" fill="#e6af42"/></g>
</svg>`;
const NAMES = ['ann', 'bo', 'cy', 'di', 'ed'];
const scene = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" data-hsvg-version="2.0" data-hsvg-kind="screen">
<title>Drawing gaps</title>
<rect x="-400" y="-300" width="1600" height="1200" fill="#fff4d8" data-hsvg-layer="backdrop"/>
<rect id="big-box" data-hsvg-kind="part" data-hsvg-slot="big" x="20" y="20" width="300" height="100" fill="none"/>
<rect id="small-box" data-hsvg-kind="part" data-hsvg-slot="small" x="340" y="20" width="60" height="60" fill="none"/>
<g id="row" data-hsvg-kind="part" data-hsvg-repeat="">
${NAMES.map((_, i) => `<g id="r${i + 1}" data-hsvg-kind="part" data-hsvg-slot="r${i + 1}" transform="translate(${60 + 120 * i} 200)"/>`).join('\n')}
</g>
<g id="pin-at" data-hsvg-kind="part" data-hsvg-slot="pin-at" transform="translate(200 400)"/>
<g id="flag-at" data-hsvg-kind="part" data-hsvg-slot="flag-at" transform="translate(400 400)"/>
<g id="slider" data-hsvg-kind="part" data-hsvg-motion="move-x 0..100"><rect x="20" y="460" width="40" height="40" fill="#153b4b"/></g>
<g id="spinner" data-hsvg-kind="part" data-hsvg-motion="move-x 0..100"><rect x="20" y="530" width="40" height="40" fill="#153b4b"/></g>
<rect id="goal" data-hsvg-kind="part" data-hsvg-motion="move-x -150..0; move-y -100..0" x="640" y="440" width="120" height="120" fill="#bfe4de"/>
<g id="token" data-hsvg-kind="part"><circle cx="520" cy="500" r="30" fill="#ed795f"/></g>
<g id="shifter" data-hsvg-kind="part"><rect x="700" y="100" width="60" height="30" fill="#153b4b"/></g>
<g id="tile-at" data-hsvg-kind="part" data-hsvg-slot="tile-at" transform="translate(560 40)"/>
</svg>`;
export const files = {
  'experience.json': {
    format: 'hsvg/2.0', kind: 'experience', id: 'drawing-gaps', language: 'en',
    blocks: { badge: 'components/badge/component.json', dot: 'components/dot/component.json', pin: 'components/pin/component.json', flag: 'components/flag/component.json', tile: 'components/tile/component.json' },
    story: { start: 'one', scenes: { one: 'scenes/one/scene.json' }, ends: ['one'] },
  },
  'components/badge/component.json': { format: 'hsvg/2.0', kind: 'component', id: 'badge', drawing: 'badge.svg' },
  'components/badge/badge.svg': badge,
  'components/dot/component.json': {
    format: 'hsvg/2.0', kind: 'component', id: 'dot', drawing: 'dot.svg',
    inputs: { name: { kind: 'content', type: 'string', maxLength: 8, initial: '?' } },
    bindings: [{ id: 'dot-name', target: 'name', text: '{{ name }}' }],
  },
  'components/dot/dot.svg': dot,
  'components/pin/component.json': { format: 'hsvg/2.0', kind: 'component', id: 'pin', drawing: 'pin.svg' },
  'components/pin/pin.svg': pin,
  'components/flag/component.json': { format: 'hsvg/2.0', kind: 'component', id: 'flag', drawing: 'flag.svg' },
  'components/flag/flag.svg': flag,
  'components/tile/component.json': {
    format: 'hsvg/2.0', kind: 'component', id: 'tile', drawing: 'tile.svg',
    controls: { face: { kind: 'button', target: 'face', label: 'Tile' } },
  },
  'components/tile/tile.svg': tile,
  'scenes/one/scene.json': {
    format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg',
    values: {
      names: { type: 'array', items: { type: 'string', maxLength: 8 }, maxItems: 5, initial: NAMES },
      heard: { type: 'number', minimum: 0, maximum: 1000, initial: 0 },
      drops: { type: 'number', minimum: 0, maximum: 1000, initial: 0 },
      goalShift: { type: 'number', minimum: -150, maximum: 0, initial: 0 },
    },
    bindings: [{ id: 'goal-x', target: 'goal', axis: 'x', move: 'goalShift' }],
    uses: [
      { id: 'big-badge', use: 'badge', into: 'big' },
      { id: 'small-badge', use: 'badge', into: 'small' },
      { id: 'dots', use: 'dot', into: 'row', items: 'names', key: 'item', with: { name: 'item' } },
      { id: 'pin', use: 'pin', into: 'pin-at' },
      { id: 'flag', use: 'flag', into: 'flag-at' },
      { id: 'tile', use: 'tile', into: 'tile-at' },
    ],
    clips: {
      slide: { durationMs: 1000, tracks: [{ id: 'slide-x', target: 'slider', channel: 'move', axis: 'x', keys: [[0, 0], [1000, 100]] }] },
      'goal-rise': { durationMs: 500, loopMode: 'hold', tracks: [{ id: 'goal-y', target: 'goal', channel: 'move', axis: 'y', keys: [[0, 0], [500, -100]] }] },
      spin: { durationMs: 1000, loop: true, tracks: [{ id: 'spin-x', target: 'spinner', channel: 'move', axis: 'x', keys: [[0, 0], [1000, 100]] }] },
    },
    entry: [{ id: 'play-slide', play: 'slide' }, { id: 'play-spin', play: 'spin' }],
    controls: { token: { kind: 'drag', target: 'token', drops: ['goal'], event: 'dropped', snap: true, label: 'Token' }, shifter: { kind: 'button', target: 'shifter', label: 'Move the goal' } },
    on: {
      'press:shifter': [{ id: 'shift-goal', actions: [{ id: 'set-shift', set: 'goalShift', to: '-150' }, { id: 'play-rise', play: 'goal-rise' }] }],
      dropped: [{ id: 'count-drop', actions: [{ id: 'add-drop', set: 'drops', to: 'drops + 1' }] }],
      'changed:reducedMotion': [{ id: 'hear-motion', actions: [{ id: 'add-heard', set: 'heard', to: 'heard + 1' }] }],
    },
  },
  'scenes/one/one.svg': scene,
};
export { NAMES };
