// Pause, clock and changes from the host. Each test reproduces an R3 finding.
import { Player } from '../src/story.mjs';
import { hostApi } from '../src/host.mjs';
import { eq, ok } from './helpers.mjs';

// A shell whose machine opens a pausing dialog at 100 ms; the stage's scene a has a timed link to b at 500 ms.
const pausingShell = {
  format: 'hsvg/2.0', kind: 'shell', id: 'frame', needs: ['shell'], drawing: 'frame.svg',
  slots: { stage: { kind: 'stage', label: 'Stage' }, settings: { kind: 'dialog', label: 'Settings', openValue: 'settingsOpen', pauses: true } },
  values: { settingsOpen: { type: 'boolean', initial: false } },
  machines: { m: { after: [{ id: 'op', delayMs: '100', actions: [{ id: 'o1', open: 'settings' }] }] } },
};
const scene = (id, extra = {}) => ({ file: `${id}.json`, doc: { format: 'hsvg/2.0', kind: 'scene', id, drawing: `${id}.svg`, ...extra }, drawings: {}, words: {} });
const pausing = () => new Player({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', needs: ['shell'], shell: 'frame.json',
    story: { start: 'a', scenes: { a: 'a.json', b: 'b.json' }, links: [{ id: 'a-b', from: 'a', afterMs: 500, to: 'b' }] } },
  words: { en: {} }, data: {}, blocks: {}, shell: { file: 'frame.json', doc: pausingShell, drawings: {}, words: {} },
  scenes: { a: scene('a'), b: scene('b') },
});
// A shell that hears changed:level, emits its output noticed, then faults on 10 / level when level is 0.
const noticing = () => new Player({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', needs: ['shell'], shell: 'frame.json',
    inputs: { level: { kind: 'knob', type: 'number', minimum: 0, maximum: 3, initial: 1 }, ok: { kind: 'knob', type: 'boolean', initial: false } },
    story: { start: 'a', scenes: { a: 'a.json' } } },
  words: { en: {} }, data: {}, blocks: {}, scenes: { a: scene('a') },
  shell: { file: 'frame.json', drawings: {}, words: {}, doc: { format: 'hsvg/2.0', kind: 'shell', id: 'frame', needs: ['shell'], drawing: 'frame.svg',
    slots: { stage: { kind: 'stage', label: 'Stage' } }, values: { share: { type: 'number', initial: 0 } }, outputs: { noticed: { kind: 'event' } },
    on: { 'changed:level': [{ id: 'n', actions: [{ id: 'n1', emit: 'noticed' }, { id: 'n2', emit: 'applyLevel' }] }],
      applyLevel: [{ id: 'l', actions: [{ id: 'l1', set: 'share', to: '10 / level' }] }] } } },
});
const trace = (p) => ({ scene: p.scene, now: p.state.now, open: p.read('frame', 'settingsOpen'), elapsed: p.read(p.scene, 'elapsed'),
  timers: p.state.timers.map(t => [t.owner, t.due]) });

export const tests = {
  'Y2.1 a pause that starts inside an advance takes effect at once: split and whole advances agree'() {
    const whole = pausing(); ok(whole.start().ok); whole.advance(1000);
    const split = pausing(); ok(split.start().ok); split.advance(100); split.advance(900);
    eq(trace(whole), trace(split), 'one advance and two advances end the same');
    eq([whole.scene, whole.read('frame', 'settingsOpen'), whole.read('a', 'elapsed')], ['a', true, 100], 'the stage stopped at 100 ms');
  },
  'Y2.2 a paused advance never shows negative elapsed time and never stops the player'() {
    const mk = (min) => new Player({ doc: { id: 'test', story: { start: 'a' } }, blocks: {},
      scenes: { a: { doc: { id: 'a', values: { seen: { type: 'number', initial: 0, ...(min ? { minimum: 0 } : {}) } },
        on: { 'changed:now': [{ id: 'sample', actions: [{ id: 'save', set: 'seen', to: 'elapsed' }] }] } } } } });
    for (const min of [false, true]) {
      const p = mk(min); p.start(); p.setPause('host', true); p.advance(1500);
      eq([p.read('a', 'seen'), p.read('a', 'elapsed'), !!p.stopped], [0, 0, false], `paused elapsed stays 0 (minimum ${min})`);
      p.setPause('host', false); p.advance(1000);
      eq([p.read('a', 'seen'), p.read('a', 'elapsed')], [500, 1000], 'after resume it counts again');
    }
  },
  'Y2 should-fix: a deadline at a second boundary does not swallow that second\'s changed:now'() {
    const inc = { id: 'inc', set: 'ticks', to: 'ticks + 1' };
    const mk = (timer) => new Player({ doc: { id: 'test', story: { start: 'a' } }, blocks: {}, scenes: { a: { doc: { id: 'a',
      values: { ticks: { type: 'number', initial: 0 } }, on: { 'changed:now': [{ id: 'tick', actions: [inc] }] },
      ...(timer ? { machines: { m: { after: [{ id: 'deadline', delayMs: '1000', actions: [] }] } } } : {}) } } } });
    for (const timer of [false, true]) {
      const p = mk(timer); p.start(); p.advance(1000);
      eq([p.read('a', 'ticks'), p.state.now], [1, 1000], `one tick at 1000 ms (deadline ${timer})`);
      p.advance(1000); eq(p.read('a', 'ticks'), 2, 'and one more a second later, never twice');
    }
  },
  'Y2.4 a rolled-back transaction delivers nothing: a shell output of a failed change never reaches the next one'() {
    const p = noticing(); ok(p.start().ok);
    const h = hostApi(p, { onError: () => {} });
    const heard = []; h.on('noticed', () => heard.push('noticed'));
    let code = null; try { h.set('level', 0); } catch (e) { code = e.code; }
    eq([code, h.read('level'), p.state.revision, heard], ['E-FORMULA', 1, 1, []], 'the change is refused and rolled back');
    h.set('ok', true);
    eq(heard, [], 'the next, unrelated change delivers no phantom output');
    h.set('level', 2);
    eq(heard, ['noticed'], 'a committed change still delivers it once');
  },
  async 'Y2.5 a deferred host event is checked as given: changing the payload after the call changes nothing'() {
    const exp = { doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en',
      inputs: { start: { kind: 'trigger' }, submit: { kind: 'trigger', payload: { type: 'object', properties: { amount: { type: 'number', minimum: 0, maximum: 1 } }, required: ['amount'] } },
        rows: { kind: 'knob', type: 'object', properties: { amount: { type: 'number', minimum: 0, maximum: 1 } }, initial: { amount: 0 } } },
      outputs: { started: { kind: 'event' }, received: { kind: 'event', payload: { type: 'object', properties: { amount: { type: 'number' } } } } },
      on: { start: [{ id: 's', actions: [{ id: 'a', emit: 'started' }] }], submit: [{ id: 's', actions: [{ id: 'a', emit: 'received', with: { amount: 'event.amount' } }] }] },
      story: { start: 'a', scenes: { a: 'a.json' } } }, words: { en: {} }, data: {}, blocks: {}, scenes: { a: scene('a') } };
    const p = new Player(exp); p.start(); const errors = [];
    const h = hostApi(p, { onError: e => errors.push(e) }); const received = []; h.on('received', e => received.push(e.detail));
    let code = null; try { h.emit('submit', { amount: 99 }); } catch (e) { code = e.code; }
    eq(code, 'E-RANGE', 'direct 99 is refused');
    h.on('started', () => { const payload = { amount: 0.5 }; h.emit('submit', payload); payload.amount = 99; const v = { amount: 0.25 }; h.set('rows', v); v.amount = 99; });
    h.emit('start'); await new Promise(r => setTimeout(r, 0));
    eq([received, errors, !!p.stopped, h.read('rows')], [[{ amount: 0.5 }], [], false, { amount: 0.25 }], 'the snapshot taken at the call is what plays');
  },
  'Y2.6 a host trigger reaches the experience, the shell and the active scene, in one transaction (5.3.3)'() {
    const sc = scene('a', { values: { score: { type: 'number', initial: 0 } }, on: { ping: [{ id: 'p', actions: [{ id: 'p1', set: 'score', to: 'event.n' }] }] } });
    const p = new Player({ doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', needs: ['shell'], shell: 'frame.json',
      inputs: { ping: { kind: 'trigger', payload: { type: 'object', properties: { n: { type: 'number' } }, required: ['n'] } } },
      values: { got: { type: 'number', initial: 0 } }, on: { ping: [{ id: 'e', actions: [{ id: 'e1', set: 'got', to: 'got + 1' }] }] },
      story: { start: 'a', scenes: { a: 'a.json' } } }, words: { en: {} }, data: {}, blocks: {}, scenes: { a: sc },
      shell: { file: 'frame.json', drawings: {}, words: {}, doc: { format: 'hsvg/2.0', kind: 'shell', id: 'frame', needs: ['shell'], drawing: 'frame.svg',
        slots: { stage: { kind: 'stage', label: 'Stage' } }, values: { taps: { type: 'number', initial: 0 } }, on: { ping: [{ id: 's', actions: [{ id: 's1', set: 'taps', to: 'taps + 1' }] }] } } } });
    ok(p.start().ok);
    const h = hostApi(p); const rev = p.state.revision;
    h.emit('ping', { n: 7 });
    eq([p.read('experience', 'got'), p.read('frame', 'taps'), p.read('a', 'score'), p.state.revision - rev], [1, 1, 7, 1], 'all three heard it, one revision');
  },
  'Y2.3 a binding fault refuses the host\'s change before commit (9.2 step 6)'() {
    const sc = scene('a', { bindings: [{ id: 'lv', target: 'label', text: 'Level {{ 10 / level }}' }, { id: 'op', target: 'bar', opacity: '1 / level' }] });
    const p = new Player({ doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en',
      inputs: { level: { kind: 'knob', type: 'number', minimum: 0, maximum: 3, initial: 1 } }, story: { start: 'a', scenes: { a: 'a.json' } } },
      words: { en: {} }, data: {}, blocks: {}, scenes: { a: sc } });
    ok(p.start().ok);
    const h = hostApi(p, { onError: () => {} }); const rev = p.state.revision;
    let code = null; try { h.set('level', 0); } catch (e) { code = e.code; }
    eq([code, h.read('level'), p.state.revision, !!p.stopped], ['E-FORMULA', 1, rev, false], 'refused, nothing committed, still playing');
    h.set('level', 2);
    eq([h.read('level'), p.state.revision], [2, rev + 1], 'a good change commits');
  },
};
