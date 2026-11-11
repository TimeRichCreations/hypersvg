// Speed and the formula budget (R2 speed 1 to 5, security 2, power 2). Each test failed before its fix.
import '../src/capabilities/all.mjs';
import { Player } from '../src/story.mjs';
import { hostApi } from '../src/host.mjs';
import { eq, ok, throwsCode } from './helpers.mjs';
import { parse, evaluate } from '../src/formula.mjs';
import { jsonUnits } from '../src/limits-runtime.mjs';
import { FORMAT } from '../src/limits.mjs';
import path from 'node:path';
import { Drawing } from '../src/drawing.mjs';
import { loadExperience, folderSource } from '../src/load.mjs';
import { repo, schemas } from './helpers.mjs';

// A DOM stand-in that counts the attribute writes a paint makes.
const fakeDocument = (count) => {
  const el = () => ({ attrs: {}, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }, setAttribute(k, v) { count.set++; this.attrs[k] = v; }, setAttributeNS(ns, k, v) { this.attrs[k] = v; }, removeAttribute(k) { count.remove++; delete this.attrs[k]; }, appendChild() {}, set textContent(t) { count.text++; } });
  return { createElementNS: el, createTextNode: () => ({}) };
};
const drawn = (p, scene) => {
  const count = { set: 0, remove: 0, text: 0 };
  const d = new Drawing(p, { layouts: {} });
  d.mountScene(scene, null, { width: 1000, height: 800 });
  d.toDom(fakeDocument(count));
  return { d, count };
};
// Counts the formula evaluations (bindings, templates) a function makes.
const evaluations = (p, fn) => {
  let n = 0; const ev = p.eval; const tp = p.template;
  p.eval = function (...a) { n++; return ev.apply(this, a); }; p.template = function (...a) { n++; return tp.apply(this, a); };
  try { fn(); } finally { p.eval = ev; p.template = tp; }
  return n;
};
const lineChart = async () => { const l = loadExperience(await folderSource(path.join(repo, 'skill', '2.0', 'examples', 'recipes', 'line-chart')), schemas()); const p = new Player(l.experience); p.start(); return p; };
import { loadDashboard, dashboardHost, rows } from './x2-dashboard.mjs';

const dashboard = (n, opts) => { const p = new Player(loadDashboard(n, opts), { host: dashboardHost(n) }); p.start(); return { p, h: hostApi(p) }; };
const feed = (h, list) => { try { h.set('readings', list); return 'ok'; } catch (e) { return e.code; } };

export const tests = {
  // ---------- item 1: a live feed never faults with E-EVENT-LOOP at a row count the format allows ----------
  'item 1: the valid 60-row dashboard takes a feed that changes every row (was E-EVENT-LOOP from 50 rows)'() {
    const { p, h } = dashboard(60);
    eq(feed(h, rows(60, 1)), 'ok');
    eq(feed(h, rows(60, 2)), 'ok', 'the same keys, new temp and rain');
    const last = rows(60, 2)[59]; eq(p.state.blocks[`board/hours[${last.id}]`].inputs.temp, last.temp);
    eq(p.state.blocks.board.values.fed, true);
  },
  'item 1: 1024 rows (dataTableRows) take a feed that changes every row, and one with all new keys'() {
    const { p, h } = dashboard(1024);
    eq(feed(h, rows(1024, 1)), 'ok');
    eq(feed(h, rows(1024, 2)), 'ok');
    eq(feed(h, rows(1024, 3, 1024)), 'ok');
    eq(Object.keys(p.state.blocks).filter(a => a.startsWith('board/hours[')).length, 1024);
  },
  'item 1: a key press and an ambient change with more than 100 live blocks do not fault'() {
    const { p, h } = dashboard(200);
    eq(feed(h, rows(200, 1)), 'ok');
    eq(p.key('KeyA').ok, true);
    eq(p.transaction('person', () => p.setAmbient('muted', true)).ok, true);
  },
  'item 1: a real loop still faults; a fan-out counts once per cause, not once per block'() {
    const { p } = dashboard(6, { scene: (s) => { s.on.ping = [{ id: 'again', actions: [{ id: 'e', emit: 'ping' }] }]; } });
    const r = p.send('board', 'ping');
    eq([r.ok, r.fault?.code], [false, 'E-EVENT-LOOP']);
  },
  // ---------- item 5: mount admission is linear in live blocks ----------
  'item 5: admitting and removing 512 repeated uses walks the live blocks a fixed number of times, not once per mount'() {
    const { p, h } = dashboard(512);
    eq(feed(h, rows(512, 1)), 'ok');
    let walks = 0;
    p.state.blocks = new Proxy(p.state.blocks, { ownKeys: (t) => { walks++; return Reflect.ownKeys(t); } });
    eq(feed(h, rows(512, 2, 512)), 'ok', 'all new keys: 512 unmounts and 512 mounts');
    eq(Object.keys(p.state.blocks).filter(a => a.startsWith('board/hours[')).length, 512);
    ok(walks < 40, `the blocks were walked ${walks} times for 1024 mounts and unmounts`);
  },
  'item 5: the running counts still refuse the use over liveRepeatedUses, after a rollback too'() {
    const { h } = dashboard(300, { limit: 290 });
    eq(feed(h, rows(290, 1)), 'ok');
    eq(feed(h, rows(291, 2, 290)), 'E-REPEAT-CAPACITY');
    eq(feed(h, rows(290, 2, 290)), 'ok', 'after the rollback the counts are taken again');
    eq(feed(h, rows(291, 3, 600)), 'E-REPEAT-CAPACITY');
  },
  // ---------- item 4: the formula budget counts work, and fits the 1024 rows the format allows ----------
  'item 4 (power 2, speed 4): row formulas read all 1024 rows of the largest table'() {
    const rows = Array.from({ length: FORMAT.dataTableRows }, (_, i) => ({ id: `r${i}`, v: i % 10, w: (i * 7) % 13 }));
    const run = (f) => evaluate(parse(f), { name: (n) => ({ rows })[n], active: () => false });
    eq(run('count(rows, item.v > 5)'), 408);
    eq(run('sum(filter(rows, item.v > 5), item.v)'), 3060);
    eq(run('length(filter(rows, item.v > 2 && item.w < 30))'), 715);
    eq(run('length(filter(rows, item.v >= 0 && item.w >= 0 && item.v < 99))'), 1024);
    eq(run('length(fold(rows, [], append(acc, item.v, 1024)))'), 1024, 'the map pattern of a points line');
    eq(run('sort(rows, item.w, true)[0].w'), 12);
    eq(run("lookup(rows, 'id', 'r1023', null).v"), 3);
  },
  'item 4 (security 2): building a string counts its characters; a string over the result size faults before it is built'() {
    const run = (f) => evaluate(parse(f), { name: () => { throw new Error('none'); }, active: () => false });
    eq(run('length(fold(range(14), "ab", acc + acc))'), 32768);
    const t = Date.now();
    throwsCode(() => run('length(fold(range(20), "ab", acc + acc))'), 'E-RANGE');
    throwsCode(() => run('length(fold(range(26), "ab", acc + acc))'), 'E-RANGE');
    throwsCode(() => run('fold(range(1024), 0, acc + length(fold(range(15), "ab", acc + acc)))'), 'E-RANGE');
    ok(Date.now() - t < 1000, 'and fast');
  },
  'item 4 (security 2): an equality over a shared tree counts every value it visits'() {
    const run = (f) => evaluate(parse(f), { name: () => { throw new Error('none'); }, active: () => false });
    eq(run('fold(range(8), [], [acc, acc]) === fold(range(8), [], [acc, acc])'), true);
    const t = Date.now();
    throwsCode(() => run('fold(range(22), [], [acc, acc]) === fold(range(22), [], [acc, acc])'), 'E-RANGE');
    throwsCode(() => run('includes([fold(range(22), [], [acc, acc])], fold(range(22), [], [acc, acc]))'), 'E-RANGE');
    ok(Date.now() - t < 1000, `and fast: ${Date.now() - t} ms`);
  },
  'item 4 (security 2): the size of a result is counted as JSON prints it, and stops at the limit'() {
    for (const v of [[], {}, [1, 'a"b', null, true, { x: [1, 2, {}] }], { a: 1, b: [{ é: '\u2028' }] }, 'text', 3]) eq(jsonUnits(v, 1e9), typeof v === 'string' ? v.length : typeof v === 'object' ? JSON.stringify(v).length : 0);
    let tree = []; for (let i = 0; i < 40; i++) tree = [tree, tree];
    const t = Date.now();
    ok(jsonUnits(tree, 65536) > 65536);
    ok(Date.now() - t < 100, 'a tree of 2^40 leaves is not walked whole');
  },
  // ---------- item 3: no restore-then-write; only changed values reach the DOM ----------
  'item 3: a paint that changes nothing writes no attribute (the line chart after its clip ended)'() {
    return lineChart().then((p) => {
      p.advance(2000);
      const { d, count } = drawn(p, p.scene);
      d.paint();
      count.set = 0; count.remove = 0;
      d.paint();
      eq([count.set, count.remove], [0, 0], 'a whole paint again');
    });
  },
  'item 3: a moving clip writes only the attributes whose value changed'() {
    return lineChart().then((p) => {
      p.advance(400);
      const { d, count } = drawn(p, p.scene);
      d.paint();
      count.set = 0; count.remove = 0;
      p.advance(16);
      d.paint();
      ok(count.set > 0, 'the clip moved something');
      eq(count.remove, 0, 'nothing is reset to its drawn state and written again');
    });
  },
  // ---------- item 2: paint only what changed, nothing when nothing changed ----------
  'item 2: with nothing changed, a paint evaluates no binding; idle, no block reads time'() {
    const { p, h } = dashboard(256);
    eq(feed(h, rows(256, 1)), 'ok');
    const { d, count } = drawn(p, 'board');
    d.paint(p.takeDirty());
    eq(d.live.size, 0, 'nothing moves');
    count.set = 0; count.text = 0;
    eq(evaluations(p, () => d.paint(p.takeDirty())), 0);
    eq([count.set, count.text], [0, 0]);
  },
  'item 2: a change paints the changed rows and their scene only, and draws what a whole paint draws'() {
    const { p, h } = dashboard(256);
    eq(feed(h, rows(256, 1)), 'ok');
    const { d } = drawn(p, 'board');
    d.paint(p.takeDirty());
    const next = rows(256, 1); next[7] = { ...next[7], rain: 3.9, temp: 33 };
    eq(feed(h, next), 'ok');
    const dirty = p.takeDirty();
    eq([...dirty].filter(a => a.startsWith('board/hours[')), [`board/hours[${next[7].id}]`]);
    const n = evaluations(p, () => d.paint(dirty));
    ok(n > 0 && n < 40, `one row and the scene: ${n} evaluations`);
    // The changed row glides to its new values (6.8): once the glides end, it draws what a whole paint draws.
    p.advance(1000); d.paint(p.takeDirty());
    const whole = drawn(p, 'board').d; whole.paint();
    eq(d.serialize(), whole.serialize(), 'the same drawing as a whole paint');
  },
  'item 2: a running clip keeps its block live; it holds still once the clip ends'() {
    return lineChart().then((p) => {
      p.advance(100);
      const { d } = drawn(p, p.scene);
      d.paint(p.takeDirty());
      ok(d.live.size > 0, 'the clip runs');
      p.advance(3000);
      d.paint(p.takeDirty());
      eq(d.live.size, 0, 'the clip ended');
    });
  },
  'item 2: a binding that reads elapsed keeps its block live'() {
    const { p } = dashboard(6, { scene: (s) => { s.bindings.push({ id: 'tick', target: 'status', label: '{{ numberText(elapsed, 0) }}' }); } });
    const { d } = drawn(p, 'board');
    d.paint(p.takeDirty());
    eq([...d.live], ['board']);
  },
};
