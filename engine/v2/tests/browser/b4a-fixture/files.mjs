// A small experience for the accessibility browser run (spec 10.13): three scenes with titles, a plain
// link, a fade link, a timed link, and a drag with two drop places.
const drawing = (title, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" data-hsvg-version="2.0" data-hsvg-kind="screen">
<title>${title}</title>
${body}
</svg>`;
const button = (id, x) => `<g id="${id}" data-hsvg-kind="part"><rect x="${x}" y="10" width="80" height="50" fill="#8c8"/></g>`;
const one = drawing('Harbour', `${button('b-next', 10)}${button('b-fade', 100)}
<g id="left" data-hsvg-kind="part"><rect x="10" y="180" width="100" height="100" fill="#eed"/></g>
<g id="right" data-hsvg-kind="part"><rect x="290" y="180" width="100" height="100" fill="#dee"/></g>
<g id="parcel" data-hsvg-kind="part" data-hsvg-motion="translate-x(-400 400) translate-y(-300 300)"><rect x="170" y="200" width="60" height="60" fill="#a63"/></g>
<g id="spinner" data-hsvg-kind="part" data-hsvg-motion="rotate(-360 360)"><rect x="320" y="80" width="40" height="40" fill="#36c"/></g>`);
const two = drawing('Market', `${button('b-back', 10)}${button('b-fade2', 100)}`);
const three = drawing('Beacon', button('b-home', 10));
const act = (id, name, to) => ({ id, actions: [{ id: `${id}1`, set: name, to }] });
const scene = (id, extra) => ({ format: 'hsvg/2.0', kind: 'scene', id, drawing: `${id}.svg`, ...extra });
export const files = {
  'experience.json': {
    format: 'hsvg/2.0', kind: 'experience', id: 'b4a-run',
    story: {
      start: 'one', scenes: { one: 'scenes/one/scene.json', two: 'scenes/two/scene.json', three: 'scenes/three/scene.json' }, ends: ['three'],
      links: [
        { id: 'one-two', from: 'one', on: 'next', to: 'two' },
        { id: 'one-two-fade', from: 'one', on: 'fadeOn', to: 'two', transition: 'fade', transitionMs: 400 },
        { id: 'two-one', from: 'two', on: 'back', to: 'one' },
        { id: 'two-three', from: 'two', afterMs: 5000, to: 'three' },
        { id: 'two-three-fade', from: 'two', on: 'fadeOn', to: 'three', transition: 'fade', transitionMs: 400 },
        { id: 'three-one', from: 'three', on: 'home', to: 'one' },
      ],
    },
  },
  'scenes/one/scene.json': scene('one', {
    values: { log: { type: 'string', initial: '', maxLength: 500 }, carried: { type: 'boolean', initial: false } },
    outputs: { next: { kind: 'event' }, fadeOn: { kind: 'event' } },
    controls: {
      next: { kind: 'button', target: 'b-next', event: 'next', label: 'Next' },
      fade: { kind: 'button', target: 'b-fade', event: 'fadeOn', label: 'Fade' },
      parcel: { kind: 'drag', target: 'parcel', drops: ['left', 'right'], accept: "event.drop === 'right'", picked: 'carried', event: 'dropped', missEvent: 'missed', label: 'Parcel' },
    },
    bindings: [{ id: 'spin', target: 'spinner', rotate: '30 + elapsed / 10 % 360' }],
    on: {
      dropped: [act('d', 'log', "log + 'dropped:' + event.drop + ' '")],
      missed: [act('m', 'log', "log + 'missed:' + event.drop + ' '")],
    },
  }),
  'scenes/two/scene.json': scene('two', {
    outputs: { back: { kind: 'event' }, fadeOn: { kind: 'event' } },
    controls: { back: { kind: 'button', target: 'b-back', event: 'back', label: 'Back' }, fade: { kind: 'button', target: 'b-fade2', event: 'fadeOn', label: 'Fade' } },
  }),
  'scenes/three/scene.json': scene('three', {
    outputs: { home: { kind: 'event' } },
    controls: { home: { kind: 'button', target: 'b-home', event: 'home', label: 'Home' } },
  }),
  'scenes/one/one.svg': one,
  'scenes/two/two.svg': two,
  'scenes/three/three.svg': three,
};
