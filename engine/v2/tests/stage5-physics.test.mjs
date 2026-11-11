// Stage 5, physics (capabilities/physics.json): bodies, ticks on the clock, contacts and their events. No browser.
import path from 'node:path';
import { Player } from '../src/story.mjs';
import { motionRanges } from '../src/physics.mjs';
import { loadExperience, folderSource } from '../src/load.mjs';
import { repo, schemas, eq, ok } from './helpers.mjs';

const svg = (parts) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">${parts}</svg>`;
// A scene with a physics block over a drawing; reactions log every physics event into the value log.
const world = (bodies, parts, extra = {}) => {
  const logOn = {};
  for (const id of Object.keys(bodies)) for (const ev of ['hit', 'landed', 'rest']) {
    logOn[`physics:${ev}:${id}`] = [{ id: `log-${ev}-${id}`, actions: [{ id: `a-${ev}-${id}`, set: 'log', to: ev === 'rest' ? `log + 'rest:${id}: '` : `log + '${ev}:${id}:' + event.other + ' '` }] }];
  }
  return new Player({
    doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', needs: ['physics'], story: { start: 'a', scenes: { a: 'a.json' } } },
    words: { en: {} }, data: {}, blocks: {},
    scenes: { a: { file: 'a.json', doc: { format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg', values: { log: { type: 'string', initial: '' }, ...(extra.values || {}) },
      addons: { physics: { bodies } }, on: { ...logOn, ...(extra.on || {}) }, machines: extra.machines }, drawings: { main: { file: 'a.svg', text: svg(parts) } }, words: {} } },
  });
};
const hop = { target: 'bike', shape: { kind: 'box', width: 700, height: 300 }, origin: [400, 500], rest: [0, 0], gravity: [0, 1800], bounce: 0.45, friction: 1, floor: 650 };
const bike = '<g id="bike" data-hsvg-motion="move-x -20..20; move-y -400..0"><rect width="10" height="10"/></g>';
const throwUp = { 'press:go': [{ id: 'go', actions: [{ id: 't', call: 'physics.throw', with: { body: "'hop'", vx: 0, vy: -720 } }] }] };

export const tests = {
  'motion ranges: translate-x, translate-y and translate(r) give both axes (6.2.1)'() {
    eq(motionRanges(svg(bike), 'bike'), { 'translate-x': [-20, 20], 'translate-y': [-400, 0] });
    eq(motionRanges('<g id="p" data-hsvg-motion="move-x -1.5..1.5; move-y -1.5..1.5"/>', 'p'), { 'translate-x': [-1.5, 1.5], 'translate-y': [-1.5, 1.5] });
    eq(motionRanges('<g id="p" data-hsvg-motion="move-y 0..4"/>', 'p'), null, 'one axis is not enough');
  },
  'a thrown body rises, falls, reports each contact once on entry and rests; bodies start asleep'() {
    const p = world({ hop }, bike, { on: throwUp });
    ok(p.start().ok);
    const w = () => p.state.blocks.a.physics;
    eq([w().bodies.hop.sleeping, w().next], [true, null], 'asleep, no ticks');
    p.advance(1000); eq(w().tick, 0, 'a sleeping world does not tick');
    ok(p.send('a', 'press:go').ok);
    let top = 0;
    for (let i = 0; i < 40 && !p.read('a', 'log').includes('rest'); i++) { p.advance(100); top = Math.min(top, w().bodies.hop.y); }
    const log = p.read('a', 'log');
    ok(top < -100 && top > -144, `rises under 720^2/(2*1800) = 144 (drag), rose ${-top}`);
    // The floor is at the bottom of the y range here (as in a bike hop), so each bounce touches y:max and floor; both report (as in 0.1).
    ok(log.startsWith('hit:hop:y:max landed:hop:y:max hit:hop:floor landed:hop:floor '), log);
    const n = (s) => log.split(s).length - 1;
    ok(n('landed:hop:floor') >= 2 && n('landed:hop:floor') === n('hit:hop:floor'), 'one report per bounce');
    ok(log.trim().endsWith('rest:hop:'), log);
    eq(w().bodies.hop.y, 0, 'rests on the floor');
    eq(w().next, null, 'no ticks after rest');
  },
  'the same configuration and commands give the same motion'() {
    const run = () => { const p = world({ hop }, bike, { on: throwUp }); p.start(); p.send('a', 'press:go'); const ys = []; for (let i = 0; i < 20; i++) { p.advance(37); ys.push(p.state.blocks.a.physics.bodies.hop.y); } return [ys, p.read('a', 'log')]; };
    eq(run(), run());
  },
  'one large advance runs every 120 Hz step it covers (9.4)'() {
    const p = world({ hop }, bike, { on: throwUp });
    p.start(); p.send('a', 'press:go');
    p.advance(500);
    eq(p.state.blocks.a.physics.tick, 60, '500 ms is 60 steps, none dropped');
    p.advance(50);
    eq(p.state.blocks.a.physics.tick, 66, '50 ms is 6 steps');
  },
  'one advance of 20 s equals many small advances: the same world, events and log (9.4)'() {
    const run = (sizes) => {
      const p = world({ hop }, bike, { on: throwUp });
      p.start(); p.send('a', 'press:go');
      let left = 20000; let i = 0;
      while (left > 0) { const ms = Math.min(left, sizes[i++ % sizes.length]); p.advance(ms); left -= ms; }
      const w = p.state.blocks.a.physics;
      return { log: p.read('a', 'log'), tick: w.tick, next: w.next, bodies: w.bodies, time: p.state.time ?? null };
    };
    const one = run([20000]);
    ok(one.log.trim().endsWith('rest:hop:'), `lands and rests in one advance: ${one.log}`);
    eq(one.next, null, 'asleep after the advance');
    eq(run([100]), one, 'steps of 100 ms');
    eq(run([16]), one, 'steps of 16 ms');
    eq(run([7, 333, 1]), one, 'uneven steps');
  },
  'a static body cannot be thrown; an unknown body is a fault; the step rolls back'() {
    const p = world({ wall: { target: 'bike', shape: { kind: 'box', width: 10, height: 10 }, rest: [0, 0], mass: 0 } }, bike, {
      values: { n: { type: 'number', initial: 0 } },
      on: { 'press:w': [{ id: 'w', actions: [{ id: 'n1', set: 'n', to: 'n + 1' }, { id: 't', call: 'physics.throw', with: { body: "'wall'", vx: 1, vy: 1 } }] }], 'press:u': [{ id: 'u', actions: [{ id: 't2', call: 'physics.kick', with: { body: "'ghost'", vx: 1, vy: 1 } }] }] },
    });
    ok(p.start().ok);
    const r = p.send('a', 'press:w'); eq([r.ok, r.fault?.code, p.read('a', 'n')], [false, 'E-RANGE', 0]);
    p.stopped = null; // a control fault stops play (X3): the next case on the same engine
    eq(p.send('a', 'press:u').fault?.code, 'E-REF-UNKNOWN');
  },
  'a body whose target has no translate ranges is refused at mount (E-MOTION-RANGE)'() {
    const p = world({ hop }, '<g id="bike"/>');
    const r = p.start();
    eq([r.ok, r.fault?.code], [false, 'E-MOTION-RANGE']);
  },
  'a moving body hits a peer: both report hit, with the other id; contacts filter what is reported'() {
    const left = { target: 'l', shape: { kind: 'circle', radius: 10 }, origin: [100, 100], rest: [0, 0], gravity: [0, 0], friction: 0 };
    const right = { target: 'r', shape: { kind: 'circle', radius: 10 }, origin: [200, 100], rest: [0, 0], gravity: [0, 0], friction: 0, contacts: ['x:max'] };
    const parts = '<g id="l" data-hsvg-motion="move-x 0..300; move-y 0..0"/><g id="r" data-hsvg-motion="move-x -300..300; move-y 0..0"/>';
    const p = world({ left, right }, parts, { on: { 'press:go': [{ id: 'go', actions: [{ id: 't', call: 'physics.throw', with: { body: "'left'", vx: 400, vy: 0 } }] }] } });
    ok(p.start().ok); p.send('a', 'press:go');
    for (let i = 0; i < 10; i++) p.advance(100);
    const log = p.read('a', 'log');
    ok(log.includes('hit:left:right'), log);
    ok(!log.includes('hit:right:left'), `right lists only x:max: ${log}`);
    ok(p.state.blocks.a.physics.bodies.right.x > 0, 'the peer woke and moved');
  },
  'a deadline at the same time goes before a physics tick; events run as their own step'() {
    const p = world({ hop }, bike, {
      on: throwUp,
      machines: { m: { initial: 'idle', states: { idle: { on: { 'press:go': [{ id: 'arm', target: 'wait' }] } }, wait: { after: [{ id: 'later', delayMs: 25, target: 'done', actions: [{ id: 'mark', set: 'log', to: "log + 'timer '" }] }] }, done: {} } } },
    });
    ok(p.start().ok); ok(p.send('a', 'press:go').ok);
    const rs = p.advance(1000);
    ok(rs.every(r => r.ok), rs.find(r => !r.ok)?.fault?.message);
    ok(p.read('a', 'log').startsWith('timer '), p.read('a', 'log'));
  },
  'reduced motion: the simulation runs and its events fire; the body is drawn at rest'() {
    const p = world({ hop }, bike, { on: throwUp });
    p.start(); p.state.ambient.reducedMotion = true; p.send('a', 'press:go');
    for (let i = 0; i < 40; i++) p.advance(100);
    ok(p.read('a', 'log').includes('landed:hop:floor'), 'events fire');
  },
};
