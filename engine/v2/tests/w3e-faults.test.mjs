// Faults found while building layout plans. Clip ends (6.7) and the numbers written to the drawing.
import { Player } from '../src/story.mjs';
import { Drawing } from '../src/drawing.mjs';
import { eq, ok } from './helpers.mjs';

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" data-hsvg-version="2.0" data-hsvg-kind="screen">
  <g id="world" data-hsvg-layer="content">
    <rect id="wing" data-hsvg-kind="part" data-hsvg-motion="rotate *" width="10" height="10"/>
    <rect id="arm" data-hsvg-kind="part" data-hsvg-motion="rotate *" width="10" height="10"/>
    <rect id="mark" data-hsvg-kind="part" data-hsvg-motion="opacity 0..1" width="10" height="10"/>
  </g>
</svg>`;

function setup() {
  const exp = {
    doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', story: { start: 'one', scenes: { one: 'one.json' } } },
    words: { en: {} }, data: {},
    scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg',
      values: { ends: { type: 'number', initial: 0, minimum: 0, maximum: 100 } },
      clips: {
        point: { durationMs: 100, loopMode: 'hold', tracks: [{ id: 'p', target: 'wing', channel: 'rotate', keys: [[0, 0], [100, -26]] }] },
        wave: { durationMs: 100, tracks: [{ id: 'w', target: 'arm', channel: 'rotate', keys: [[0, 0], [100, 40]] }] },
        fade: { durationMs: 900, tracks: [{ id: 'f', target: 'mark', channel: 'opacity', keys: [[0, 0], [900, 1]] }] },
      },
      on: {
        go: [{ id: 'g', actions: [{ id: 'a', play: 'point' }, { id: 'b', play: 'wave' }] }],
        fade: [{ id: 'h', actions: [{ id: 'c', play: 'fade' }] }],
        'ended:point': [{ id: 'e', actions: [{ id: 'd', set: 'ends', to: 'ends + 1' }] }],
      },
    }, drawings: { main: { text: SVG } }, words: {} } },
    blocks: {},
  };
  const p = new Player(exp);
  ok(p.start().ok);
  const d = new Drawing(p);
  d.mountScene('one');
  return { p, d };
}
const attr = (d, local, k) => d.frames.one.byLocal.get(local).attrs[k];

export const tests = {
  'E2: a hold clip keeps its final pose after its end; another clip releases it (6.7)'() {
    const { p, d } = setup();
    p.send('one', 'go');
    p.advance(50); d.paint();
    ok(attr(d, 'wing', 'transform').includes('rotate(-13)'), attr(d, 'wing', 'transform'));
    ok(attr(d, 'arm', 'transform').includes('rotate(20)'), attr(d, 'arm', 'transform'));
    p.advance(500); d.paint();
    eq(attr(d, 'wing', 'transform'), 'translate(0 0) rotate(-26) translate(0 0)', 'hold keeps the last key');
    eq(attr(d, 'arm', 'transform'), undefined, 'a clip that is not hold releases its pose');
    eq(p.read('one', 'ends'), 1, 'ended:point fires once at the natural end');
  },
  'E2: stop releases a held pose and does not fire ended again (6.7)'() {
    const { p, d } = setup();
    p.send('one', 'go'); p.advance(500); d.paint();
    p.transaction('host', () => p.stopClip('one', 'point', true)); d.paint();
    eq(attr(d, 'wing', 'transform'), undefined);
    eq(p.read('one', 'ends'), 1, 'one ended per run');
    p.send('one', 'go'); p.advance(20);
    p.transaction('host', () => p.stopClip('one', 'point', true));
    eq(p.read('one', 'ends'), 2, 'a stop before the end fires ended (interrupted)');
  },
  'E1: transforms and opacity are written with 6 decimals, trailing zeros dropped'() {
    const { p, d } = setup();
    p.send('one', 'fade'); p.advance(200); d.paint();
    eq(attr(d, 'mark', 'opacity'), '0.222222');
    p.send('one', 'go'); p.advance(1); d.paint();
    eq(attr(d, 'wing', 'transform'), 'translate(0 0) rotate(-0.26) translate(0 0)');
  },
};
