// A follower (data-hsvg-follow, 6.2.1) sits on its leader, through the leader's groups, and moves with it. No browser.
import { Player } from '../src/story.mjs';
import { Drawing, parseTransform } from '../src/drawing.mjs';
import { eq, ok } from './helpers.mjs';

const round = (m) => m.map(x => Math.round(x * 1000) / 1000);

// A tiny scene: a leader inside a moved group, and a follower drawn at 0,0 elsewhere in paint order.
const FOLLOW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" data-hsvg-version="2.0" data-hsvg-kind="screen">
  <g transform="translate(100 50)"><g id="house" data-hsvg-kind="part" data-hsvg-motion="move-x 0..50"><rect width="40" height="40"/></g></g>
  <g transform="translate(5 5)"><g id="hand" data-hsvg-kind="part" data-hsvg-follow="house"><circle r="4"/></g></g>
</svg>`;
function followScene() {
  const exp = {
    doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', story: { start: 'one', scenes: { one: 'one.json' } } },
    words: { en: {} }, data: {}, blocks: {},
    scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg',
      clips: { slide: { durationMs: 1000, tracks: [{ id: 's', target: 'house', channel: 'move', axis: 'x', keys: [[0, 0], [1000, 50]] }] } },
      on: { go: [{ id: 'g', actions: [{ id: 'p', play: 'slide' }] }] } }, drawings: { main: { text: FOLLOW_SVG } }, words: {} } },
  };
  const p = new Player(exp);
  ok(p.start().ok);
  const d = new Drawing(p);
  d.mountScene('one');
  return { p, d, hand: d.frames.one.byLocal.get('hand') };
}

export const tests = {
  'follows: a follower sits on its leader, through the leader\'s groups, and moves with it (6.2.1)'() {
    const { p, d, hand } = followScene();
    d.paint();
    // Its real parent is translate(5 5); the leader's world is translate(100 50): the follower's own transform undoes
    // the first and applies the second.
    eq(round(parseTransform(hand.attrs.transform)), [1, 0, 0, 1, 95, 45]);
    p.send('one', 'go'); p.advance(500); d.paint();
    eq(round(parseTransform(hand.attrs.transform)), [1, 0, 0, 1, 120, 45]); // half way through the clip: 25 along
    eq(d.faults, []);
  },
};
