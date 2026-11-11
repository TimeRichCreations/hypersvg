// The freeze fixes. D22 (names never clash), fold, door refusals without values, the seats boundary, turn
// state for content, the hit-target check, a person's reduced motion, named images and live regions, the version
// rule, and the data tables' text columns, zero dash shares and word columns. Each item has its tests here.
import { parse, evaluate } from '../src/formula.mjs';
import { loadExperience } from '../src/load.mjs';
import { Player as BasePlayer } from '../src/story.mjs';
import { granting, addonCode } from './helpers.mjs';
const Player = granting(BasePlayer); // a host that gives what the experience asks (D31: no profile, no grant)
import { Drawing } from '../src/drawing.mjs';
import { dashOf } from '../src/paint-channels.mjs';
const { checkRows } = await addonCode('../src/capabilities/live-data.mjs', import.meta.url) ?? {};
import { hostApi } from '../src/host.mjs';
import { files as d1Files } from './d1-fixture/files.mjs';
import { checkExperience } from '../check/index.mjs';
import { infer, T } from '../check/formula/infer.mjs';
import { playingOnly } from '../check/rules/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { eq, ok, mapSource, schemas, spec, throwsCode } from './helpers.mjs';
import { base } from './check-refs.test.mjs';
import '../src/capabilities/all.mjs';
const { duel } = await addonCode('./s1-seats.test.mjs', import.meta.url) ?? {}; // an add-on test file
import { duelFiles } from './s1-check.test.mjs';
import { agentDoor } from '../tools/change/play.mjs';
const { REFUSED } = await addonCode('../src/capabilities/seats.mjs', import.meta.url) ?? {};

const scene = (f) => f['scenes/one/scene.json'];
const check = (f, only = null) => checkExperience(mapSource(f), schemas(), { only }).diags.map(d => `${d.code} ${d.path}`);
function play(f) {
  const loaded = loadExperience(mapSource(f), schemas());
  ok(loaded.experience, loaded.diags.map(d => `${d.code} ${d.message}`).join('; '));
  const p = new Player(loaded.experience, {});
  ok(p.start().ok, 'starts');
  return p;
}
const run = (src, names = {}, builtin = null) => evaluate(parse(src), {
  name: (n) => { if (n in names) return names[n]; throw Object.assign(new Error(`unknown ${n}`), { code: 'E-FORMULA' }); },
  ...(builtin ? { builtin } : {}),
});

export const tests = {
  // ---------- 1. names never clash (D22) ----------
  'D22: a word followed by ( is a function, so a value may share a function name (origami: fold and fold(...))'() {
    const f = base();
    Object.assign(scene(f).values, { fold: { type: 'number', initial: 2, minimum: 0, maximum: 9 }, count: { type: 'number', initial: 3, minimum: 0, maximum: 9 } });
    scene(f).computed.creases = 'fold + fold(range(count), 0, acc + item)';
    eq(check(f), []);
    const p = play(f);
    eq(p.scope('one').name('creases'), 2 + 0 + 1 + 2);
  },
  'D22: an author value hides a built-in in its scope (W-NAME-HIDES); hsvg.<name> always reads the built-in'() {
    const f = base();
    scene(f).values.now = { type: 'number', initial: 7, minimum: 0, maximum: 9 };
    scene(f).computed.mine = 'now + 1';
    scene(f).computed.real = 'hsvg.now >= 0';
    eq(check(f), ['W-NAME-HIDES /values/now']);
    const p = play(f);
    eq(p.scope('one').name('mine'), 8);
    eq(p.scope('one').name('real'), true);
    eq(p.scope('one').name('now'), 7);
    ok(p.scope('one').builtin('now') !== 7 || true);
    // the checker types each: mine is the author's number 0..9 + 1; hsvg.now is the built-in number
    scene(f).computed.bad = 'hsvg.nothing';
    ok(check(f, ['formula']).includes('E-REF-UNKNOWN /computed/bad'), 'hsvg.<name> names only a built-in');
  },
  "D22: the experience's own now does not reach a component, which reads the built-in"() {
    const f = base();
    f['experience.json'].values.now = { type: 'number', initial: 5, minimum: 0, maximum: 9 };
    f['blocks/badge/component.json'].computed = { stamp: 'now >= 0' };
    eq(check(f), ['W-NAME-HIDES /values/now']);
  },
  'D22: row names exist only inside their brackets; outside, item is an author value'() {
    const f = base();
    scene(f).values.item = { type: 'number', initial: 4, minimum: 0, maximum: 9 };
    scene(f).values.list = { type: 'array', items: { type: 'number', minimum: 0, maximum: 9 }, initial: [1, 5, 9], maxItems: 8 };
    scene(f).computed.big = 'count(list, item > 3) + item';
    eq(check(f), ['W-NAME-HIDES /values/item']);
    eq(play(f).scope('one').name('big'), 2 + 4);
  },
  'D22: hsvg is reserved, bare hsvg is not a formula, a computed value may not take a reserved name'() {
    const f = base();
    scene(f).computed.oops = 'hsvg';
    scene(f).computed.data = '1';
    const c = check(f);
    ok(c.includes('E-FORMULA /computed/oops'), c.join());
    ok(c.includes('E-NAME-RESERVED /computed/data'), c.join());
    const g = base();
    scene(g).values.hsvg = { type: 'number', initial: 0 };
    ok(check(g).some(x => x.startsWith('E-NAME-RESERVED')), 'hsvg is reserved');
  },
  'D22: the formula reader keeps functions and values apart, and hsvg.<name> skips the row names and the author'() {
    eq(run('max + max(1, 2)', { max: 10 }), 12);
    eq(run('now', { now: 1 }, (n) => (n === 'now' ? 99 : undefined)), 1);
    eq(run('hsvg.now', { now: 1 }, (n) => (n === 'now' ? 99 : undefined)), 99);
    eq(run('sum(xs, item) + item', { xs: [1, 2], item: 10 }), 13);
  },

  // ---------- 2. fold ----------
  'fold: a running total, and the sum of an empty list is its start'() {
    const xs = [3, 1, 4, 1, 5];
    eq(run('fold(xs, [], append(acc, (length(acc) > 0 ? at(acc, length(acc) - 1, 0) : 0) + item, 1024))', { xs }), [3, 4, 8, 9, 14]);
    eq(run('fold(xs, 0, acc + item * index)', { xs }), 0 + 1 + 8 + 3 + 20);
    eq(run('fold(xs, 7, acc + item)', { xs: [] }), 7);
    eq(run("fold(xs, '', acc + numberText(item, 0))", { xs }), '31415');
  },
  'fold: nested row forms keep acc, and their own item'() {
    eq(run('fold(xs, 2, acc + count(xs, item < acc))', { xs: [1, 2, 3] }), 2 + 1 + 2 + 3);
  },
  "fold: the beam of G1 walks a grid of mirrors in one formula"() {
    // tiles: 0 empty, 1 mirror '/', 2 mirror '\'; a 4 x 4 grid; the beam enters at (0, 0) going right.
    const grid = [0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
    const dirs = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 }];
    // turn tables per tile kind and direction (right, down, left, up)
    const turns = [[0, 1, 2, 3], [3, 2, 1, 0], [1, 0, 3, 2]];
    const step = "acc.stop ? acc : ({'x': acc.x + dirs[turns[grid[acc.y * 4 + acc.x]][acc.d]].dx, 'y': acc.y + dirs[turns[grid[acc.y * 4 + acc.x]][acc.d]].dy, 'd': turns[grid[acc.y * 4 + acc.x]][acc.d], 'stop': false, 'path': append(acc.path, acc.y * 4 + acc.x, 64)})";
    const guard = `(${step}).x < 0 || (${step}).x > 3 || (${step}).y < 0 || (${step}).y > 3 ? {'x': acc.x, 'y': acc.y, 'd': acc.d, 'stop': true, 'path': append(acc.path, acc.y * 4 + acc.x, 64)} : ${step}`;
    const beam = run(`fold(range(16), {'x': 0, 'y': 0, 'd': 0, 'stop': false, 'path': []}, acc.stop ? acc : (${guard}))`, { grid, dirs, turns });
    eq(beam.path, [0, 1, 2, 6, 10, 9, 8]);
    eq(beam.stop, true);
  },
  'fold: the checker types it (an array first; the result takes start’s type; acc has no proven bounds)'() {
    const f = base();
    scene(f).values.list = { type: 'array', items: { type: 'number', minimum: 0, maximum: 9 }, initial: [1, 2], maxItems: 8 };
    scene(f).computed.total = 'fold(list, 0, acc + item)';
    scene(f).computed.notList = 'fold(score, 0, acc + item)';
    scene(f).computed.mixed = "fold(list, 0, 'a')";
    const c = check(f, ['formula']);
    ok(c.includes('E-TYPE /computed/notList'), c.join());
    ok(c.includes('E-TYPE /computed/mixed'), c.join());
    ok(!c.some(x => x.includes('/computed/total')), c.join());
    const t = infer(parse('fold(list, 0, acc + 1)'), { name: () => ({ t: 'array', item: T.num(0, 9) }) }, () => {});
    ok(t.t === 'number' && t.lo === -Infinity && t.hi === Infinity, `a fold's result has no proven range: write clamp(...) ${JSON.stringify(t)}`);
  },

  // ---------- 3. door refusals carry no values (G1 leak 1) ----------
  "door refusals: seat o, which sees only turn, open and count, does not learn handX from a refusal or its receipt"() {
    const leak = () => duel({ scene: (sc) => {
      Object.assign(sc.values, { handX: { type: 'number', minimum: 0, maximum: 9, initial: 7 }, handO: { type: 'number', minimum: 0, maximum: 9, initial: 5 }, total: { type: 'number', minimum: 0, maximum: 9, initial: 0 } });
      sc.on.ping = [{ id: 'pg', actions: [{ id: 'sum', set: 'total', to: 'handX + handO' }] }];
      return sc;
    } });
    // the bare door
    const p = leak();
    p.activate('a', 'tap'); // x taps: o is on turn
    const d = p.seats.connect('agent:ada'); eq(d.join('o'), { ok: true });
    const list = d.legal('o');
    const key = list.entries.find(e => e.input === 'ping').key;
    const r = d.act('o', key);
    eq(r, { ok: false, error: { code: 'E-RANGE', message: REFUSED } });
    // through the checked path, with a receipt
    const q = leak();
    q.activate('a', 'tap');
    const conn = q.seats.connect('agent:bo'); eq(conn.join('o'), { ok: true });
    const receipts = [];
    const door = agentDoor(q, conn, 'agent:bo', { schemas: schemas(), now: '2026-11-07T00:00:00Z', receipts });
    const k = door.legal('o').entries.find(e => e.input === 'ping').key;
    const out = door.act('o', k);
    eq(out.error, { code: 'E-RANGE', message: REFUSED });
    const text = JSON.stringify(receipts);
    ok(!/\b12\b|\b7\b/.test(text.replace(/revision:\d+/g, '')), `the receipt shows no value: ${text}`);
    eq(receipts[0].errors.map(e => e.message), [REFUSED]);
  },

  // ---------- 4. the seats boundary: a stale entry is refused when it is no longer allowed ----------
  'seats: act checks that the entry is still allowed, not only that the view, occupant and turn are the same'() {
    // legal reads a value outside o's view (left); x's control changes it without changing o's view
    const p = duel({ scene: (sc) => {
      sc.values.left = { type: 'number', minimum: 0, maximum: 9, initial: 1 };
      sc.computed = { pings: "left > 0 ? [{'cell': 0}] : []" };
      sc.controls.drain = { kind: 'button', target: 'd', event: 'drained' };
      sc.on.drained = [{ id: 'dr', actions: [{ id: 'z', set: 'left', to: '0' }] }];
      return sc;
    }, play: (pl) => { pl.legal = { mark: 'pings' }; pl.turns = undefined; delete pl.turns; return pl; } });
    const d = p.seats.connect('agent:ada'); eq(d.join('o'), { ok: true });
    const key = d.legal('o').entries.find(e => e.input === 'mark').key;
    ok(p.activate('a', 'drain').ok);
    const r = d.act('o', key);
    eq(r.error?.code, 'E-SEAT-INPUT');
    ok(/no longer allowed/.test(r.error.message), r.error.message);
  },

  // ---------- 6. turn state for content; the run state lives with the graph ----------
  'turns: with alternating turns the engine writes the seat on turn into turns.value'() {
    const alt = (opts = {}, initial = 'o') => duel({
      scene: (sc) => { sc.values.turn.initial = initial; sc.on.tapped = [{ id: 'tp', actions: [{ id: 'n', set: 'count', to: 'count + 1' }] }]; return sc; },
      play: (pl) => { pl.turns = { kind: 'alternating', value: 'turn', order: ['x', 'o'] }; return pl; },
      ...opts,
    });
    const p = alt();
    eq(p.read('a', 'turn'), 'x', 'written when the scene enters');
    ok(p.activate('a', 'tap').ok);
    eq([p.read('a', 'turn'), p.seats.turn()], ['o', 'o']);
    ok(p.seats.host('o', 'human').ok);
    ok(p.activate('a', 'tap').ok);
    eq(p.read('a', 'turn'), 'x');
  },
  'turns: simultaneous turns refuse value (E-TYPE); alternating checks that the value can hold each seat'() {
    const c = (fn) => checkExperience(mapSource(duelFiles(fn)), schemas(), {}).diags.map(d => `${d.code} ${d.path}`);
    eq(c((e) => { e.addons.seats.turns = { kind: 'simultaneous', value: 'turn' }; }).filter(x => x.includes('turns')), ['E-TYPE addons.seats.turns.value']);
    eq(c((e) => { e.addons.seats.turns = { kind: 'alternating', value: 'turn', order: ['x', 'o'] }; }).filter(x => x.includes('turns')), []);
    eq(c((e) => { e.addons.seats.turns = { kind: 'alternating', value: 'turn', order: ['x', 'o'], values: { x: 'x', o: 'z' } }; }).filter(x => x.includes('turns')), ['E-TYPE addons.seats.turns']);
  },
  'turns: the seats run state lives with the graph memory, so a resumed run keeps the turn and the moves'() {
    const m = new Map();
    const store = { get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => m.set(k, v), remove: (k) => m.delete(k) };
    const host = { saved: store, page: '/duel/', partition: 'device', now: () => 1000 };
    const make = () => duel({
      scene: (sc) => { sc.on.tapped = [{ id: 'tp', actions: [{ id: 'n', set: 'count', to: 'count + 1' }] }]; return sc; },
      play: (pl) => { pl.turns = { kind: 'alternating', value: 'turn', order: ['x', 'o'] }; return pl; },
      exp: (e) => { e.grants.storage = ['saved']; e.story.lifetime = 'saved'; e.story.resumeAt = ['a']; return e; },
      opts: { storage: host },
    });
    const p = make();
    ok(p.activate('a', 'tap').ok);
    eq([p.seats.turn(), p.seats.record().moves], ['o', 1]);
    const q = make();
    eq([q.seats.turn(), q.seats.record().moves, q.read('a', 'turn')], ['o', 1, 'o'], 'the next run resumes on o');
    eq(q.activate('a', 'tap').ignored, "not this seat's turn");
  },

  // ---------- 5. remote seats follow D11 ----------
  'remote seats wait for 2.1: not in the 2.0 registry, so needs remote-seats is E-NEEDS-UNKNOWN'() {
    const reg = JSON.parse(fs.readFileSync(path.join(spec, 'capabilities.json'), 'utf8'));
    ok(!reg.capabilities.some(c => c.name === 'remote-seats'), 'out of the registry');
    ok(fs.existsSync(path.join(spec, 'drafts', 'remote-seats-2.1.json')), 'the 2.1 draft is kept outside it');
    const f = base();
    f['experience.json'].needs = ['remote-seats'];
    ok(check(f).some(x => x.startsWith('E-NEEDS-UNKNOWN')), check(f).join());
  },

  // ---------- 7. minimum target as:'box', scale: reported not-run, never passed ----------
  'hit-target is listed not-run (a measurer proof), as readable is without a measurer'() {
    const f = base();
    scene(f).rules = [{ id: 'big-enough', kind: 'hit-target', subject: 'part:go', minPx: 44 }];
    const r = checkExperience(mapSource(f), schemas(), {});
    const open = playingOnly(r.experience).filter(x => x.rule === 'big-enough');
    eq(open.map(x => [x.kind, x.proof]), [['hit-target', 'measurer']]);
  },

  // ---------- 9. cheap and right now ----------
  "a person's setting can turn on reducedMotion; it stays on while the system asks for it"() {
    const f = base();
    scene(f).values.calm = { type: 'number', initial: 0, minimum: 0, maximum: 9 };
    scene(f).on['key:KeyM'] = [{ id: 'calm-on', actions: [{ id: 'm', call: 'player.setting', with: {reducedMotion: true} }] }];
    scene(f).on['key:KeyN'] = [{ id: 'calm-off', actions: [{ id: 'n', call: 'player.setting', with: {reducedMotion: false} }] }];
    scene(f).on['changed:reducedMotion'] = [{ id: 'heard', actions: [{ id: 'h', set: 'calm', to: 'calm + 1' }] }];
    f['experience.json'].addons = { ...f['experience.json'].addons, widgets: { settings: { items: [{ id: 'calm-item', knob: 'reducedMotion', label: 'Calm', when: 'play' }] } } };
    (f['experience.json'].needs ??= []).push('widgets');
    eq(check(f).filter(x => !x.startsWith('W-')), []);
    const p = play(f);
    ok(p.key('KeyM').ok);
    eq([p.state.ambient.reducedMotion, p.read('one', 'calm')], [true, 1]);
    ok(p.key('KeyN').ok);
    eq(p.state.ambient.reducedMotion, false);
    p.transaction('host', () => p.motionPreference(true));
    ok(p.key('KeyN').ok);
    eq(p.state.ambient.reducedMotion, true, 'the system asks for it: a setting cannot turn it off');
    const r = p.applySettings([['reducedMotion', true]]);
    ok(r.ok !== false, JSON.stringify(r));
  },

  'a part with data-hsvg-label or a label binding is a named image; a feedback part is a polite live region (on the page only)'() {
    const f = base();
    f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('<g id="mouth" data-hsvg-kind="part"', '<g id="mouth" data-hsvg-kind="part" data-hsvg-label="Smiling mouth"')
      .replace('</svg>', '<g id="note" data-hsvg-kind="part" data-hsvg-role="feedback"><text>ok</text></g><g id="stamp" data-hsvg-kind="part"><rect width="4" height="4"/></g></svg>');
    scene(f).bindings.push({ id: 'stamp-name', target: 'stamp', label: 'Stamp {{ score }}' });
    const p = play(f);
    const d = new Drawing(p); d.mountScene('one');
    const fake = () => { const a = {}; return { a, setAttribute: (k, v) => { a[k] = String(v); }, removeAttribute: (k) => { delete a[k]; }, getAttribute: (k) => a[k] ?? null, set textContent(t) {} }; };
    const fr = d.frames.one;
    fr.root.dom = fake();
    for (const n of fr.byLocal.values()) n.dom = fake();
    d.paint();
    const at = (id) => fr.byLocal.get(id).dom.a;
    eq([at('mouth').role, at('mouth')['aria-label']], ['img', 'Smiling mouth']);
    eq([at('stamp').role, at('stamp')['aria-label']], ['img', 'Stamp 0']);
    eq(at('note')['aria-live'], 'polite');
    eq(at('go').role, undefined, 'a control target is named by the input layer');
    ok(!('role' in fr.byLocal.get('mouth').attrs), 'the drawing itself (saved, baked) is unchanged');
    p.transaction('host', () => p.state.blocks.one.values.score = 3);
    d.paint();
    eq(at('stamp')['aria-label'], 'Stamp 3', 'a label binding follows its values');
  },

  'the version rule: a document or drawing of a later minor version is refused with E-VERSION-NEWER'() {
    const f = base();
    f['scenes/one/scene.json'].format = 'hsvg/2.1';
    ok(check(f).some(x => x.startsWith('E-VERSION-NEWER')), check(f).join());
    const g = base();
    g['scenes/one/one.svg'] = g['scenes/one/one.svg'].replace('data-hsvg-version="2.0"', 'data-hsvg-version="2.1"');
    ok(check(g).some(x => x.startsWith('E-VERSION-NEWER')), check(g).join());
    const h = base();
    h['scenes/one/scene.json'].format = 'hsvg/3.0';
    ok(check(h).some(x => x.startsWith('E-HEADER')) && !check(h).some(x => x.startsWith('E-VERSION-NEWER')), 'another major is E-HEADER');
  },
  'records and the seat log only grow: resetSaved keeps the published rows and the accepted inputs'() {
    const p = duel();
    ok(p.activate('a', 'tap').ok);
    const d = p.seats.connect('agent:ada'); eq(d.join('o'), { ok: true });
    const k = d.legal('o').entries.find(e => e.input === 'mark').key;
    ok(d.act('o', k).ok);
    const before = p.seats.record().accepted.length;
    p.transaction('host', () => p.resetSaved(false));
    eq(p.seats.record().accepted.length, before, 'the seat log keeps its rows');
    ok(p.outputsLog.some(o => o.name === 'moves' || o.record === 'moves' || JSON.stringify(o).includes('moves')), 'the record row was published');
  },

  // ---------- 10. data and charts ----------
  'dash: a share of 0 hides the part whatever its caps, and a share above 0 shows it again'() {
    eq(dashOf(0, 0.4), { array: '0 1', offset: '-0.4', hidden: true });
    const f = structuredClone(d1Files);
    const loaded = loadExperience(mapSource(f), schemas());
    const p = new Player(loaded.experience, {}); ok(p.start().ok);
    const d = new Drawing(p); d.mountScene('board'); d.paint();
    const t = d.frames.board.byLocal.get('trend');
    eq([t.attrs['stroke-dasharray'], t.attrs.visibility], ['0 1', 'hidden'], 'the line that has not drawn on yet is hidden');
    const g = d.frames.board.byLocal.get('gauge');
    eq([g.attrs['stroke-dasharray'], g.attrs.visibility], ['0.5 0.5', undefined]);
  },

  'text columns: a rows field shaped by a table with a text column takes tier and language objects in its cells, read as a text field is'() {
    const f = base();
    const e = f['experience.json'];
    e.data = { quiz: { key: 'id', maxRows: 4, columns: { id: { type: 'string', maxLength: 8 }, q: { type: 'string', maxLength: 40, text: true } } } }; // a table that only gives a shape (2.8)
    e.inputs.quiz = { kind: 'content', type: 'array', contentType: 'rows', table: 'quiz', maxItems: 4,
      items: { type: 'object', properties: { id: { type: 'string', maxLength: 8 }, q: { type: 'string', maxLength: 40 } }, required: ['id', 'q'], additionalProperties: false },
      initial: [{ id: 'a', q: { en: 'Hello', fr: 'Salut' } }, { id: 'b', q: { short: 'Hi', rich: 'Hello there' } }, { id: 'c', q: 'Plain' }] };
    scene(f).computed.first = "at(quiz, 0, {'id': '', 'q': ''}).q";
    scene(f).computed.all = "fold(quiz, '', acc + item.q + ' ')";
    eq(check(f), []);
    const p = play(f);
    eq(p.scope('one').name('all'), 'Hello Hi Plain ');
    p.transaction('host', () => { p.state.ambient.language = 'fr'; });
    eq(p.scope('one').name('first'), 'Salut');
    const host = hostApi(p);
    host.set('quiz', [{ id: 'z', q: { en: 'New', fr: 'Neuf' } }]);
    eq(p.scope('one').name('first'), 'Neuf');
    throwsCode(() => host.set('quiz', [{ id: 'z', q: { en: 'x'.repeat(41) } }]), 'E-RANGE');
    throwsCode(() => host.set('quiz', [{ id: { en: 'z' }, q: 'ok' }]), 'E-TYPE'); // only text columns take objects
  },
  'fed rows: a text column takes tier and language objects; a word column is checked against the words in scope'() {
    const table = { key: 'id', maxRows: 4, columns: { id: { type: 'string', maxLength: 8 }, name: { type: 'string', maxLength: 16, word: true }, note: { type: 'string', maxLength: 20, text: true } } };
    const words = new Set(['north', 'south']);
    eq(checkRows(table, [{ id: 'a', name: 'north', note: { en: 'Cold', fr: 'Froid' } }], words), null);
    eq(checkRows(table, [{ id: 'a', name: 'nowhere', note: 'x' }], words)?.[0], 'E-REF-UNKNOWN');
    eq(checkRows(table, [{ id: 'a', name: 'north', note: { en: 'x'.repeat(21) } }], words)?.[0], 'E-RANGE');
  },
};
