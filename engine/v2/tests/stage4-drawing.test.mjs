// Stage 4: the drawing. Bindings (6.8), clips (6.7), looks (6.2.4), layers and mounted ids (2.12), theme roles (7.7).
import { Player } from '../src/story.mjs';
import { Drawing, ease, sampleKeys } from '../src/drawing.mjs';
import { eq, ok } from './helpers.mjs';

const SCENE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" data-hsvg-version="2.0" data-hsvg-kind="screen">
  <g id="sky" data-hsvg-layer="backdrop"><rect id="sky-fill" width="200" height="100" data-hsvg-color="surface" fill="#000000"/></g>
  <g id="world" data-hsvg-layer="content">
    <text id="say" data-hsvg-kind="part" x="10" y="20">old</text>
    <g id="sign" data-hsvg-kind="part"><rect width="5" height="5"/></g>
    <g id="mouth" data-hsvg-kind="part"><g data-hsvg-variant="closed"><path d="M0 0h2"/></g><g data-hsvg-variant="open" display="none"><circle r="1"/></g></g>
    <rect id="wheel" data-hsvg-kind="part" data-hsvg-pivot="50 50" data-hsvg-motion="rotate *" width="10" height="10"/>
    <g id="cta-slot" data-hsvg-kind="part" data-hsvg-slot="cta" transform="translate(100 50)"/>
  </g>
</svg>`;
const CTA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20" data-hsvg-version="2.0" width="40" height="20" overflow="visible">
  <g id="cta" data-hsvg-kind="component"><rect id="cta__surface" data-hsvg-kind="part" width="40" height="20"/><text id="cta__label" data-hsvg-kind="part">x</text></g>
</svg>`;

function setup() {
  const exp = {
    doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', theme: 'day', themes: { day: { colorRoles: { surface: '#fff4d8', accent: '#e6af42', ink: '#153b4b' } } }, story: { start: 'one', scenes: { one: 'one.json' } } },
    words: { en: {} }, data: {},
    scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg',
      values: { line: { type: 'string', maxLength: 20, initial: 'Hello' }, shown: { type: 'boolean', initial: true }, open: { type: 'boolean', initial: false }, speed: { type: 'number', initial: 0, minimum: 0, maximum: 10 } },
      uses: [{ id: 'buy', use: 'cta', into: 'cta', with: { label: "'Buy now'" } }],
      bindings: [
        { id: 'say-text', target: 'say', text: '{{ line }}!' },
        { id: 'sign-visible', target: 'sign', visible: 'shown' },
        { id: 'mouth-look', target: 'mouth', variant: "open ? 'open' : 'closed'" },
      ],
      clips: { spin: { durationMs: 1000, loop: true, tracks: [{ id: 'w', target: 'wheel', channel: 'rotate', keys: [[0, 0], [1000, 360]] }] } },
      on: { go: [{ id: 'g', actions: [{ id: 'a', set: 'line', to: "'Bye'" }, { id: 'b', set: 'shown', to: '!shown' }, { id: 'c', set: 'open', to: '!open' }, { id: 'd', play: 'spin' }] }] },
    }, drawings: { main: { text: SCENE_SVG } }, words: {} } },
    blocks: { cta: { doc: { format: 'hsvg/2.0', kind: 'component', id: 'cta', drawing: 'cta.svg', inputs: { label: { kind: 'content', type: 'string', maxLength: 18, initial: 'Order' } },
      bindings: [{ id: 'label-text', target: 'label', text: '{{ label }}' }] }, drawings: { main: { text: CTA_SVG } }, words: {} } },
  };
  const p = new Player(exp);
  ok(p.start().ok);
  const d = new Drawing(p);
  d.mountScene('one');
  return { p, d };
}
const node = (d, addr, local) => d.frames[addr].byLocal.get(local);

export const tests = {
  'mounted ids take the scene and use path (2.12 rule 6)'() {
    const { d } = setup();
    eq(node(d, 'one', 'say').attrs.id, 'one__say');
    eq(node(d, 'one/buy', 'label').attrs.id, 'one__buy__label');
    ok(d.serialize().includes('data-player-use="one__buy"'), 'the use is placed in its slot');
  },
  'theme colour roles paint parts (7.7)'() {
    const { d } = setup();
    eq(node(d, 'one', 'sky-fill').attrs.fill, '#fff4d8');
  },
  'text, visible and look bindings repaint from values (6.8)'() {
    const { p, d } = setup();
    d.paint();
    eq(node(d, 'one', 'say').children[0].text, 'Hello!');
    eq(node(d, 'one/buy', 'label').children[0].text, 'Buy now');
    eq(node(d, 'one', 'sign').attrs.display, undefined);
    p.send('one', 'go'); d.paint();
    eq(node(d, 'one', 'say').children[0].text, 'Bye!');
    eq(node(d, 'one', 'sign').attrs.display, 'none');
    const looks = node(d, 'one', 'mouth').children.filter(c => c.name);
    eq(looks.map(c => c.attrs.display), ['none', undefined]);
    eq(d.faults, []);
  },
  'clips sample on the clock about the pivot (6.7)'() {
    const { p, d } = setup();
    p.send('one', 'go');
    p.advance(250); d.paint();
    eq(node(d, 'one', 'wheel').attrs.transform, 'translate(50 50) rotate(90) translate(-50 -50)');
    p.advance(1000); d.paint();
    eq(node(d, 'one', 'wheel').attrs.transform, 'translate(50 50) rotate(90) translate(-50 -50)', 'looping');
  },
  'easing solves the cubic (6.7)'() {
    eq(ease('linear', 0.3), 0.3);
    ok(Math.abs(ease('ease-in-out', 0.5) - 0.5) < 1e-6);
    ok(ease('ease-in', 0.25) < 0.25 && ease('ease-out', 0.25) > 0.25);
    eq(sampleKeys([[0, 0], [100, 10, 'hold'], [200, 20]], 50, x => x), 0);
    eq(sampleKeys([[0, 'a'], [100, 'b']], 100, x => x), 'b');
  },
  'stopping a clip restores the drawing'() {
    const { p, d } = setup();
    p.send('one', 'go'); p.advance(250); d.paint();
    p.transaction('host', () => p.stopClip('one', 'spin', true)); d.paint();
    eq(node(d, 'one', 'wheel').attrs.transform, undefined);
  },
};
