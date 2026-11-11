// The accessibility contract on the engine side (spec 10.13). The page side (announcements, the tap path
// for drag, fades) is checked by tests/browser/b4a-access-browser.mjs.
import { Player } from '../src/story.mjs';
import { Drawing } from '../src/drawing.mjs';
import { eq, ok } from './helpers.mjs';

const scene = (id, extra = {}) => ({ doc: { format: 'hsvg/2.0', kind: 'scene', id, drawing: `${id}.svg`, ...extra }, words: {} });
const make = (story, scenes) => new Player({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', story: { scenes: Object.fromEntries(Object.keys(scenes).map(k => [k, `${k}.json`])), ...story } },
  words: { en: {} }, data: {}, blocks: {}, scenes,
});
// One scene `a` with a machine whose state `wait` moves to `done` after 1000 ms, a clip of 1000 ms with a marker at
// 500, and a timed link to `b` after 3000 ms.
const timed = () => make({ start: 'a', links: [{ id: 'a-b', from: 'a', afterMs: 3000, to: 'b' }] }, {
  a: scene('a', {
    values: { log: { type: 'string', initial: '', maxLength: 200 } },
    clips: { pop: { durationMs: 1000, markers: [{ id: 'half', atMs: 500, event: 'half' }], tracks: [{ id: 't', target: 'p', channel: 'opacity', keys: [[0, 1], [1000, 0]] }] } },
    on: {
      half: [{ id: 'mh', actions: [{ id: 'mh1', set: 'log', to: "log + 'half '" }] }],
      'ended:pop': [{ id: 'ep', actions: [{ id: 'ep1', set: 'log', to: "log + 'ended '" }] }],
    },
    entry: [{ id: 'go', play: 'pop' }],
    machines: { m: { initial: 'wait', states: { wait: { after: [{ id: 'later', delayMs: 1000, target: 'done' }] }, done: {} } } },
  }),
  b: scene('b'),
});
// A scene whose wheel turns with elapsed (a channel binding) and whose text counts elapsed seconds.
const SPIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" data-hsvg-version="2.0" data-hsvg-kind="screen">
  <rect id="wheel" data-hsvg-kind="part" data-hsvg-pivot="50 50" data-hsvg-motion="rotate(*)" width="10" height="10"/>
  <text id="count" data-hsvg-kind="part" x="10" y="20">0</text>
</svg>`;
const spinning = (reduced) => {
  const p = new Player({
    doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', story: { start: 'one', scenes: { one: 'one.json' } } },
    words: { en: {} }, data: {}, blocks: {},
    scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg',
      bindings: [{ id: 'turn', target: 'wheel', rotate: 'elapsed / 10' }, { id: 'secs', target: 'count', text: '{{ floor(elapsed / 1000) }}' }],
    }, drawings: { main: { text: SPIN_SVG } }, words: {} } },
  });
  p.state.ambient.reducedMotion = reduced;
  ok(p.start().ok);
  const d = new Drawing(p);
  d.mountScene('one');
  return { p, d, wheel: () => d.frames.one.byLocal.get('wheel').attrs.transform, count: () => d.frames.one.byLocal.get('count').children[0].text };
};
const setting = (p, v) => p.applySettings([['timeLimits', v]], 'host');

export const tests = {
  'timeLimits is a person setting: 1 by default, 0 or 1..10, never shorter (10.13)'() {
    const p = timed(); ok(p.start().ok);
    eq(p.read('a', 'timeLimits'), 1, 'readable as an ambient value, 1 by default');
    ok(setting(p, 2).ok, 'a factor of 2 is taken');
    eq(p.read('a', 'timeLimits'), 2);
    eq(setting(p, 0.5).fault?.code, 'E-RANGE', 'a factor that shortens is refused');
    eq(setting(p, 11).fault?.code, 'E-RANGE', 'at most 10');
    eq(setting(p, '2').fault?.code, 'E-TYPE', 'a number');
    ok(setting(p, 0).ok, '0 turns time limits off');
  },
  'timeLimits multiplies machine timers and timed links, and not clips or their markers (10.13)'() {
    const p = timed();
    p.state.ambient.timeLimits = 2; // as a host or the page sets it before the start
    ok(p.start().ok);
    p.advance(500); eq(p.read('a', 'log'), 'half ', 'a clip marker keeps its own time');
    p.advance(500); eq(p.read('a', 'log'), 'half ended ', 'a clip keeps its own time: motion is not a time limit');
    p.advance(999); ok(p.isActive('a', 'wait'), 'the machine timer waits twice as long');
    p.advance(1); ok(p.isActive('a', 'done'));
    p.advance(3999); eq(p.scene, 'a', 'the timed link waits twice as long');
    p.advance(1); eq(p.scene, 'b');
  },
  'a change applies at once to waiting timers: their time left is multiplied anew (10.13)'() {
    const p = timed(); ok(p.start().ok);
    p.advance(400);
    ok(setting(p, 3).ok); // 600 ms left of the machine timer becomes 1800; 2600 of the link becomes 7800
    p.advance(1799); ok(p.isActive('a', 'wait'));
    p.advance(1); ok(p.isActive('a', 'done'));
    p.advance(7800 - 1800 - 1); eq(p.scene, 'a');
    p.advance(1); eq(p.scene, 'b');
  },
  'timeLimits 0 holds every time limit until a factor is set again (10.13)'() {
    const p = timed(); ok(p.start().ok);
    p.advance(500);
    ok(setting(p, 0).ok);
    p.advance(3600000); ok(p.isActive('a', 'wait'), 'off: the machine timer never fires'); eq(p.scene, 'a', 'off: the timed link never fires');
    ok(setting(p, 1).ok);
    p.advance(499); ok(p.isActive('a', 'wait'));
    p.advance(1); ok(p.isActive('a', 'done'), 'back on: the time left runs out');
    p.advance(2000); eq(p.scene, 'b');
  },
  'a scene entered while timeLimits is 0 starts with its timers off (10.13)'() {
    const p = timed(); p.state.ambient.timeLimits = 0; ok(p.start().ok);
    p.advance(10000); ok(p.isActive('a', 'wait')); eq(p.scene, 'a');
  },
  'under reduced motion a channel binding that reads elapsed holds still; text keeps counting (10.13)'() {
    const moving = spinning(false);
    moving.d.paint(); moving.p.advance(900); moving.d.paint('all');
    eq(moving.wheel(), 'translate(50 50) rotate(90) translate(-50 -50)', 'without reduced motion the wheel turns');
    const s = spinning(true);
    s.d.paint();
    const rest = s.wheel();
    s.p.advance(2500); s.d.paint('all');
    eq(s.wheel(), rest, 'reduced motion: the wheel holds its rest pose');
    eq(s.count(), '2', 'a text binding still reads the live clock');
    s.p.transaction('host', () => s.p.setAmbient('reducedMotion', false)); s.d.paint('all');
    eq(s.wheel(), 'translate(50 50) rotate(250) translate(-50 -50)', 'reduced motion off: it follows the clock again');
    s.p.transaction('host', () => s.p.setAmbient('reducedMotion', true)); s.d.paint('all'); s.p.advance(1000); s.d.paint('all');
    eq(s.wheel(), 'translate(50 50) rotate(250) translate(-50 -50)', 'on again mid-scene: it holds where it was');
  },
};
