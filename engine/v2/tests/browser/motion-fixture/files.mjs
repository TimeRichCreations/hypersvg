// A small experience for the motion tests (the motion capability, the points binding, stop keep, the slide transition): two
// 800 x 600 scenes.
// Scene one:
// - route: the dot travels along the curved wire, 2 s a lap, endless (`travel`);
// - points: a chart line from the value `samples`, in the plot box; the press `sample` adds a value (`append`);
// - fill: the lamp fades from ink to gold over 1 s (`glow`, held at its end);
// - stop keep: the heart pulses endlessly (`pulse`); the press `freeze` stops it with keep, so it keeps its pose;
// - stroke-width and stroke: the wire's ring grows and changes colour by a binding of `level`;
// - slide: the press `onward` leaves for scene two with a 400 ms slide; scene two's `back` slides in from the start.
const wire = 'M100 260 C 250 60, 550 460, 700 260';
const one = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" data-hsvg-version="2.0" data-hsvg-kind="screen">
<title>Motion lab</title>
<rect x="-400" y="-300" width="1600" height="1200" fill="#fff4d8" data-hsvg-layer="backdrop"/>
<path id="wire" data-hsvg-kind="part" data-hsvg-route="track" d="${wire}" fill="none" stroke="#153b4b" stroke-width="4"/>
<g id="dot" data-hsvg-kind="part" data-hsvg-pivot="0 0"><circle cx="0" cy="0" r="14" fill="#ed795f"/></g>
<rect id="plot" data-hsvg-kind="part" x="80" y="380" width="320" height="160" fill="#ffffff" stroke="#9aa5ab"/>
<polyline id="line" data-hsvg-kind="part" points="80,540 400,380" fill="none" stroke="#168e91" stroke-width="3"/>
<circle id="lamp" data-hsvg-kind="part" cx="520" cy="460" r="40" fill="#153b4b"/>
<g id="heart" data-hsvg-kind="part" data-hsvg-pivot="660 460" data-hsvg-motion="scale 1..1.5"><rect x="630" y="430" width="60" height="60" rx="12" fill="#ed795f"/></g>
<circle id="ring" data-hsvg-kind="part" cx="740" cy="120" r="30" fill="none" stroke="#153b4b" stroke-width="2" data-hsvg-motion="line 2..12"/>
<g id="sample" data-hsvg-kind="part"><rect x="80" y="560" width="120" height="32" rx="6" fill="#168e91"/></g>
<g id="freeze" data-hsvg-kind="part"><rect x="220" y="560" width="120" height="32" rx="6" fill="#ed795f"/></g>
<g id="onward" data-hsvg-kind="part"><rect x="640" y="560" width="120" height="32" rx="6" fill="#153b4b"/></g>
</svg>`;
const two = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" data-hsvg-version="2.0" data-hsvg-kind="screen">
<title>Motion lab, second scene</title>
<rect x="-400" y="-300" width="1600" height="1200" fill="#bfe4de" data-hsvg-layer="backdrop"/>
<circle id="sun" data-hsvg-kind="part" cx="400" cy="260" r="80" fill="#e6af42"/>
<g id="back" data-hsvg-kind="part"><rect x="40" y="560" width="120" height="32" rx="6" fill="#153b4b"/></g>
</svg>`;
export const WIRE = wire;
export const files = {
  'experience.json': {
    format: 'hsvg/2.0', kind: 'experience', id: 'motion-lab', language: 'en',
    story: {
      start: 'one', scenes: { one: 'scenes/one/scene.json', two: 'scenes/two/scene.json' }, ends: ['two'],
      links: [
        { id: 'one-onward', from: 'one', on: 'onward', to: 'two', transition: 'slide', transitionMs: 400 },
        { id: 'two-back', from: 'two', on: 'back', to: 'one', transition: 'slide', transitionMs: 400, slideFrom: 'start' },
      ],
    },
  },
  'scenes/one/scene.json': {
    format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg',
    values: {
      samples: { type: 'array', items: { type: 'number', minimum: 0, maximum: 1 }, maxItems: 16, initial: [0.2, 0.6, 0.4, 0.9] },
      level: { type: 'number', minimum: 0, maximum: 1, initial: 0 },
    },
    outputs: { onward: { kind: 'event' } },
    clips: {
      travel: { durationMs: 2000, loop: true, tracks: [{ id: 'dot-travel', target: 'dot', channel: 'move', axis: 'route', route: 'wire', keys: [[0, 0], [2000, 1]] }] },
      glow: { durationMs: 1000, loopMode: 'hold', tracks: [{ id: 'lamp-glow', target: 'lamp', channel: 'color', as: 'fill', keys: [[0, "'#153b4b'"], [1000, "'#e6af42'"]] }] },
      pulse: { durationMs: 1000, loop: true, tracks: [{ id: 'heart-pulse', target: 'heart', channel: 'scale', keys: [[0, 1], [500, 1.5], [1000, 1]] }] },
    },
    bindings: [
      { id: 'chart-line', target: 'line', as:'points', draw: 'samples', area: 'plot' },
      { id: 'ring-width', target: 'ring', as: 'line', scale: 'clamp(2 + level * 10, 2, 12)' },
      { id: 'ring-colour', target: 'ring', as: 'stroke', color: "level > 0.5 ? '#ed795f' : '#153b4b'" },
    ],
    entry: [{ id: 'play-travel', play: 'travel' }, { id: 'play-glow', play: 'glow' }, { id: 'play-pulse', play: 'pulse' }],
    controls: {
      sample: { kind: 'button', target: 'sample', event: 'sampled', label: 'Add a sample' },
      freeze: { kind: 'button', target: 'freeze', event: 'frozen', label: 'Freeze the heart' },
      onward: { kind: 'button', target: 'onward', event: 'onward', label: 'Onward' },
    },
    on: {
      sampled: [{ id: 'add-sample', actions: [
        { id: 'push-sample', set: 'samples', to: 'append(samples, length(samples) % 2 === 0 ? 0.1 : 1, 16)' },
        { id: 'raise-level', set: 'level', to: 'min(1, level + 0.25)' },
      ] }],
      frozen: [{ id: 'freeze-heart', actions: [{ id: 'keep-pulse', stop: 'pulse', keep: true }] }],
    },
  },
  'scenes/one/one.svg': one,
  'scenes/two/scene.json': {
    format: 'hsvg/2.0', kind: 'scene', id: 'two', drawing: 'two.svg',
    outputs: { back: { kind: 'event' } },
    controls: { back: { kind: 'button', target: 'back', event: 'back', label: 'Back' } },
  },
  'scenes/two/two.svg': two,
};
