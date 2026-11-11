// The seats checks on files (check/seats.mjs, A4.1): inputs, views, turns, the end, legal lists, programs.
import { checkExperience } from '../check/index.mjs';
import { schemas, mapSource, eq, ok } from './helpers.mjs';

const PROGRAM = { 'chess-opponent@0.1.0': 'sha256:9c522f90df5ef002afc19f3d27e7cce721c7178602d56074651077c0a06408f0' };
const SVG = (parts) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" data-hsvg-version="2.0" data-hsvg-kind="screen">
  <title>Duel</title>
  <g id="content" data-hsvg-layer="content">
${parts}
  </g>
</svg>
`;
// The duel of s1-seats.test.mjs as files. fn(experience, sceneA) changes them.
export function duelFiles(fn = () => {}) {
  const view = ['turn', 'open', 'taps'];
  const inputs = ['mark', 'a/tap', 'ping'];
  const e = {
    format: 'hsvg/2.0', kind: 'experience', id: 'duel', language: 'en', needs: ['seats', 'chess-opponent@0.1.0'], about: { title: 'Duel', trust: { pins: { ...PROGRAM } } },
    grants: { fillers: ['agent', 'program'] },
    inputs: {
      mark: { kind: 'trigger', payload: { type: 'object', properties: { cell: { type: 'number', minimum: 0, maximum: 15 } }, required: ['cell'], additionalProperties: false } },
      ping: { kind: 'trigger' },
    },
    story: { start: 'a', scenes: { a: 'scenes/a/scene.json', b: 'scenes/b/scene.json' }, links: [{ id: 'away', from: 'a', to: 'b', on: 'finished' }], ends: ['b'] },
    addons: { seats: {
      seats: {
        x: { kind: 'player', fillers: ['human', 'agent'], inputs, view, timeoutMs: 30000 },
        o: { kind: 'player', fillers: ['agent', 'program', 'human'], program: 'chess-opponent', inputs, view, timeoutMs: 30000, fallback: { retry: true, then: 'draw' } },
      },
      turns: { kind: 'strict', value: 'turn', values: { x: 'x', o: 'o' } },
      end: { done: 'done', winner: 'winner', maxMoves: 50 },
      legal: { mark: 'open' },
      public: ['taps'],
      agentScores: 'exclude',
    } },
  };
  const a = {
    format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg',
    values: {
      turn: { type: 'string', maxLength: 1, enum: ['x', 'o'], initial: 'x' },
      open: { type: 'array', maxItems: 16, items: { type: 'object', properties: { cell: { type: 'number', minimum: 0, maximum: 15 } }, required: ['cell'], additionalProperties: false }, initial: [{ cell: 0 }] },
      taps: { type: 'number', minimum: 0, maximum: 100, initial: 0 },
      done: { type: 'boolean', initial: false },
      winner: { type: 'string', maxLength: 5, enum: ['', 'x', 'o', 'draw'], initial: '' },
    },
    outputs: { finished: { kind: 'event' } },
    controls: { tap: { kind: 'button', target: 'tap', event: 'tapped', label: 'Tap' } },
    on: {
      tapped: [{ id: 'tp', actions: [{ id: 'n', set: 'taps', to: 'taps + 1' }, { id: 'next-tap', set: 'turn', to: "turn === 'x' ? 'o' : 'x'" }, { id: 'end', if: 'taps > 9', then: [{ id: 'w', set: 'winner', to: "'x'" }, { id: 'd', set: 'done', to: true }], else: [] }] }],
      mark: [{ id: 'm', actions: [{ id: 'shut', set: 'open', to: 'filter(open, item.cell !== event.cell)' }, { id: 'next-mark', set: 'turn', to: "turn === 'x' ? 'o' : 'x'" }] }],
      ping: [{ id: 'pg', actions: [{ id: 'next-ping', set: 'turn', to: "turn === 'x' ? 'o' : 'x'" }] }],
      'seats:ended': [{ id: 'pe', actions: [{ id: 'out', emit: 'finished' }] }],
    },
  };
  const b = { format: 'hsvg/2.0', kind: 'scene', id: 'b', drawing: 'b.svg' };
  fn(e, a);
  return {
    'experience.json': JSON.stringify(e),
    'scenes/a/scene.json': JSON.stringify(a),
    'scenes/a/a.svg': SVG('    <g id="tap" data-hsvg-kind="part" data-hsvg-role="action"><rect x="10" y="10" width="100" height="60" fill="#334"/></g>'),
    'scenes/b/scene.json': JSON.stringify(b),
    'scenes/b/b.svg': SVG('    <rect x="10" y="10" width="100" height="60" fill="#334"/>'),
  };
}
const diags = (fn) => checkExperience(mapSource(duelFiles(fn)), schemas()).diags;
const codes = (fn) => diags(fn).map(d => `${d.code} ${d.path}`);

export const tests = {
  'the duel checks with 0 findings'() { eq(codes(), []); },
  'a seat input is a trigger, <scene>/<control id> or a choice link (E-SEAT-INPUT)'() {
    eq(codes(e => { e.addons.seats.seats.x.inputs = ['mark', 'a/nothing', 'b/tap', 'nowhere', 'a/tap']; }), ['E-SEAT-INPUT addons.seats.seats.x.inputs[1]', 'E-SEAT-INPUT addons.seats.seats.x.inputs[2]', 'E-SEAT-INPUT addons.seats.seats.x.inputs[3]']);
    // A choice link id is an input (its place is the story's own check).
    eq(codes(e => { e.story.links.push({ id: 'leave', from: 'a', to: 'b', choice: 'Leave' }); e.addons.seats.seats.x.inputs.push('leave'); }).filter(c => !c.startsWith('E-STORY-CHOICE-PLACE')), []);
  },
  'views and public values name values of the experience or a scene (E-REF-UNKNOWN)'() {
    eq(codes(e => { e.addons.seats.seats.o.view = ['turn', 'secret']; e.addons.seats.public = ['taps', 'nope']; }), ['E-REF-UNKNOWN addons.seats.seats.o.view[1]', 'E-REF-UNKNOWN addons.seats.public[1]']);
    eq(codes(e => { e.values = { score: { type: 'number', initial: 0 } }; e.addons.seats.public = ['score']; }).filter(c => c.startsWith('E-REF')), [], 'an experience value');
  },
  'a strict turn: a string value, a value for every player seat, no other seat, values the turn can hold'() {
    eq(codes(e => { e.addons.seats.turns.value = 'taps'; }), ['E-TYPE addons.seats.turns.value']);
    eq(codes(e => { e.addons.seats.turns.value = 'whose'; }), ['E-REF-UNKNOWN addons.seats.turns.value']);
    eq(codes(e => { delete e.addons.seats.turns.values.o; }), ['E-TYPE addons.seats.turns.values']);
    eq(codes(e => { e.addons.seats.turns.values.z = 'x'; }), ['E-REF-UNKNOWN addons.seats.turns.values.z']);
    eq(codes(e => { e.addons.seats.turns.values.o = 'q'; }), ['E-TYPE addons.seats.turns.values.o']);
    eq(codes(e => { delete e.addons.seats.turns.values; }), [], 'without values the turn value holds the seat ids');
    eq(codes((e, a) => { delete e.addons.seats.turns.values; a.values.turn.enum = ['x', 'y']; a.values.turn.initial = 'x'; }).filter(c => c.startsWith('E-TYPE')), ['E-TYPE addons.seats.turns']);
  },
  'alternating and simultaneous turns list player seats in order'() {
    eq(codes(e => { e.addons.seats.turns = { kind: 'alternating', order: ['x', 'o'] }; }), []);
    eq(codes(e => { e.addons.seats.turns = { kind: 'alternating' }; }), ['E-TYPE addons.seats.turns']);
    eq(codes(e => { e.addons.seats.turns = { kind: 'simultaneous', order: ['x', 'z'] }; }), ['E-REF-UNKNOWN addons.seats.turns.order[1]']);
  },
  'end: done is a boolean, winner a string that can hold what a draw or a forfeit writes (E-TYPE)'() {
    eq(codes(e => { e.addons.seats.end.done = 'taps'; }), ['E-TYPE addons.seats.end.done']);
    eq(codes(e => { e.addons.seats.end.winner = 'gone'; }), ['E-REF-UNKNOWN addons.seats.end.winner']);
    eq(codes((e, a) => { a.values.winner.enum = ['', 'x', 'o']; }), ['E-TYPE addons.seats.end.winner'], 'maxMoves can end in a draw');
    eq(codes((e, a) => { a.values.winner.enum = ['', 'draw']; e.addons.seats.seats.x.fallback = 'forfeit'; }).filter(c => c.startsWith('E-TYPE')), ['E-TYPE addons.seats.end.winner', 'E-TYPE addons.seats.end.winner'], 'a forfeit writes a seat\'s id: x and o');
  },
  'legal maps a listed trigger to an array of its payloads'() {
    eq(codes(e => { e.addons.seats.legal = { ping2: 'open' }; }), ['E-REF-UNKNOWN addons.seats.legal.ping2']);
    eq(codes(e => { e.addons.seats.seats.x.inputs = ['a/tap']; e.addons.seats.seats.o.inputs = ['a/tap']; }), ['E-REF-UNKNOWN addons.seats.legal.mark']);
    eq(codes(e => { e.addons.seats.legal = { mark: 'taps' }; }), ['E-TYPE addons.seats.legal.mark']);
    eq(codes((e, a) => { a.values.cells = { type: 'array', maxItems: 4, items: { type: 'number', minimum: 0, maximum: 9 }, initial: [] }; e.addons.seats.legal = { mark: 'cells' }; }).filter(c => c.includes('addons.seats.')), ['E-TYPE addons.seats.legal.mark']);
  },
  'a program filler names a program, pinned to the reviewed digest (E-REF-UNKNOWN, E-MODULE-REVIEW)'() {
    eq(codes(e => { delete e.addons.seats.seats.o.program; e.needs = ['seats']; }), ['E-REF-UNKNOWN addons.seats.seats.o']);
    eq(codes(e => { e.needs = ['seats']; }), ['E-NEEDS-MISSING addons.seats.seats.o.program'], 'a seat\'s program is a module: needs names it (10.7, A4.1)');
    eq(codes(e => { e.about.trust.pins = {}; }), ['E-MODULE-REVIEW about.trust.pins', 'E-MODULE-REVIEW addons.seats.seats.o.program'], 'the need and the seat each say it');
    eq(codes(e => { e.about.trust.pins = { 'chess-opponent@0.1.0': 'sha256:' + '0'.repeat(64) }; }).filter(c => c.includes('addons.seats.')), ['E-MODULE-REVIEW addons.seats.seats.o.program']);
    eq(codes(e => { e.about.trust.pins = { 'chess-opponent@9.0.0': PROGRAM['chess-opponent@0.1.0'] }; }).filter(c => c.includes('addons.seats.')), ['E-MODULE-REVIEW addons.seats.seats.o.program']);
    eq(codes(e => { e.addons.seats.seats.x.fallback = { then: 'program' }; }), ['E-REF-UNKNOWN addons.seats.seats.x'], 'a program fallback names its program');
    eq(codes(e => { e.addons.seats.seats.x.fallback = { then: 'program', program: 'chess-opponent' }; }), []);
  },
  'a seat an agent or program may fill, whose input reaches a human-only action: W-HUMAN-ONLY-PATH'() {
    const buy = (fillers) => (e, a) => {
      e.inputs.buy = { kind: 'trigger' }; e.inputs.shop = { kind: 'content', type: 'string', contentType: 'url', maxLength: 100, initial: 'https://example.com/' };
      e.grants.openUrl = true; e.addons.seats.seats.x.inputs = [...e.addons.seats.seats.x.inputs, 'buy']; e.addons.seats.seats.x.fillers = fillers;
      a.on.buy = [{ id: 'by', actions: [{ id: 'relay', emit: 'pay' }] }];
      a.on.pay = [{ id: 'py', actions: [{ id: 'gate', if: 'taps > 0', then: [{ id: 'go', call: 'player.openUrl', with: {field: "'shop'"} }], else: [] }] }];
    };
    eq(codes(buy(['human', 'agent'])), ['W-HUMAN-ONLY-PATH /on/pay/0/actions/0/then/0'], 'through an emitted event and an if');
    eq(codes(buy(['human'])), [], 'a seat only a person fills: no warning');
  },
  'without the seats need, play.seats is E-NEEDS-MISSING; a fillers grant is asked for (E-GRANT)'() {
    ok(codes(e => { e.needs = []; }).some(c => c.startsWith('E-NEEDS-MISSING')));
    ok(codes(e => { e.grants = { fillers: ['agent'] }; }).some(c => c.startsWith('E-GRANT')));
  },
};
