// The layout-plan solver (7.5, A7.1): nodes, sizes, shares, weights, gaps, padding, scale, repeats and
// items' fit, align, focal, maxSize and crop. Same inputs, same output; a bounded search.
import { solve, scaleFactor, effectiveShares, planStats, grownViewBox, grownPlace, measure, resolveItem, inside, PLAN_LIMITS } from '../src/plan.mjs';
import { parseXml } from '../schema/xml.mjs';
import { eq, ok } from './helpers.mjs';

const R = (x, y, width, height) => ({ x, y, width, height });
// Items: every address is a 100x100 picture unless listed.
const ctxOf = (root, extra = {}) => ({
  root, item: (a) => (extra.items?.[a] ?? { box: R(0, 0, 100, 100) }), ...extra,
});
const at = (r, item) => r.boxes.find(b => b.item === item);

export const tests = {
  'column: a fixed size, two shares and a gap, scaled by the root'() {
    const plan = { place: 'p', kind: 'column', gap: 10, children: [
      { size: 40, node: { item: 'part:title', fit: 'stretch' } },
      { share: { id: 'media', minimum: 30, initial: 60, maximum: 70 }, node: { item: 'part:photo', fit: 'stretch' } },
      { share: { id: 'copy', minimum: 30, initial: 40, maximum: 70 }, node: { item: 'part:copy', fit: 'stretch' } }] };
    const r = solve(plan, ctxOf(R(0, 0, 200, 300)));
    eq(r.status, 'complete');
    eq(at(r, 'part:title').box, R(0, 0, 200, 40));
    eq(at(r, 'part:photo').box, R(0, 50, 200, 144), '60% of 240 usable');
    eq(at(r, 'part:copy').box, R(0, 204, 200, 96));
    eq(r.shares, [{ id: 'media', requested: 60, effective: 60, actual: 60 }, { id: 'copy', requested: 40, effective: 40, actual: 40 }]);
  },
  'row: weights take what sizes and shares leave; padding'() {
    const plan = { place: 'p', kind: 'row', padding: 5, gap: 0, children: [
      { size: 20, node: { item: 'part:a', fit: 'stretch' } },
      { share: { id: 's', minimum: 10, initial: 20, maximum: 50 }, node: { item: 'part:b', fit: 'stretch' } },
      { weight: 3, node: { item: 'part:c', fit: 'stretch' } }, { node: { item: 'part:d', fit: 'stretch' } }] };
    const r = solve(plan, ctxOf(R(0, 0, 130, 50)));
    // usable 120 - 20 = 100: the share takes 20, weights 3:1 split 80.
    eq([at(r, 'part:a').box.width, at(r, 'part:b').box.width, at(r, 'part:c').box.width, at(r, 'part:d').box.width], [20, 20, 60, 20]);
    eq(at(r, 'part:a').box, R(5, 5, 20, 40));
  },
  'scale: clamp(min(width, height) / reference, minimum, maximum) on gaps, padding and sizes'() {
    const s = { reference: 100, minimum: 0.5, maximum: 2 };
    eq(scaleFactor({ scale: s }, R(0, 0, 400, 150)), 1.5);
    eq(scaleFactor({ scale: s }, R(0, 0, 40, 400)), 0.5);
    eq(scaleFactor({ scale: s }, R(0, 0, 900, 900)), 2);
    eq(scaleFactor({}, R(0, 0, 900, 900)), 1);
    const r = solve({ place: 'p', kind: 'row', gap: 10, scale: s, children: [{ size: 20, node: { item: 'part:a', fit: 'stretch' } }, { node: { item: 'part:b', fit: 'stretch' } }] }, ctxOf(R(0, 0, 400, 200)));
    eq(at(r, 'part:a').box.width, 40); eq(at(r, 'part:b').box.x, 60);
  },
  'spacing names take the theme value'() {
    const r = solve({ place: 'p', kind: 'row', gap: 'gap', children: [{ node: { item: 'part:a', fit: 'stretch' } }, { node: { item: 'part:b', fit: 'stretch' } }] },
      ctxOf(R(0, 0, 216, 10), { spacing: { gap: { minimum: 8, initial: 16, maximum: 24 } } }));
    eq(at(r, 'part:b').box.x, 116);
    const bad = solve({ place: 'p', kind: 'row', gap: 'nope', children: [{ node: { item: 'part:a' } }] }, ctxOf(R(0, 0, 10, 10)));
    eq(bad.status, 'incomplete');
  },
  'shares: bounded, moved within bounds to total 100, locks kept'() {
    const sh = [{ minimum: 30, maximum: 70 }, { minimum: 30, maximum: 70 }];
    const n = () => {};
    eq(effectiveShares(sh, [80, 50], [false, false], 100, n), { values: [60, 40], met: true }, 'bounded to 70, then the rest moves evenly');
    eq(effectiveShares(sh, [80, 50], [false, true], 100, n), { values: [50, 50], met: true }, 'the locked one stays');
    eq(effectiveShares(sh, [80, 50], [false, false], 100, n, [true, false]), { values: [70, 30], met: true }, 'the one an editor set moves last');
    eq(effectiveShares(sh, [40, 20], [false, true], 100, n).met, false, 'a locked share outside its bounds is never met');
    eq(effectiveShares(sh, [70, 50], [true, true], 100, n).met, false, 'two locks that do not total 100');
    const plan = { place: 'p', kind: 'column', children: [
      { share: { id: 'media', minimum: 30, initial: 50, maximum: 70 }, node: { item: 'part:a', fit: 'stretch' } },
      { share: { id: 'copy', minimum: 30, initial: 50, maximum: 70 }, node: { item: 'part:b', fit: 'stretch' } }] };
    const r = solve(plan, ctxOf(R(0, 0, 100, 100), { shares: { media: { value: 90 } } }));
    eq(r.shares, [{ id: 'media', requested: 90, effective: 70, actual: 70 }, { id: 'copy', requested: 50, effective: 30, actual: 30 }]);
    eq(solve(plan, ctxOf(R(0, 0, 100, 100), { shares: { media: { value: 90, locked: true } } })).status, 'incomplete');
  },
  'actual share: measured from the placed boxes'() {
    const plan = { place: 'p', kind: 'row', children: [
      { share: { id: 'a', minimum: 0, initial: 50, maximum: 100 }, node: { item: 'part:a' } },
      { share: { id: 'b', minimum: 0, initial: 50, maximum: 100 }, node: { item: 'part:b' } }] };
    // a 100x100 picture contained in a 100x50 cell is 50 wide: 25% of the 200 row.
    const r = solve(plan, ctxOf(R(0, 0, 200, 50)));
    eq(r.shares.map(s => s.actual), [25, 25]);
  },
  'grid: equal cells in columns, rows as many as the items need; repeats'() {
    const rows = ['use:answers[a]', 'use:answers[b]', 'use:answers[c]'];
    const r = solve({ place: 'p', kind: 'grid', columns: 2, gap: 10, repeat: 'answers' }, ctxOf(R(0, 0, 210, 210), { repeat: () => rows, items: Object.fromEntries(rows.map(a => [a, { box: R(0, 0, 50, 50) }])) }));
    eq(r.boxes.map(b => b.cell), [R(0, 0, 100, 100), R(110, 0, 100, 100), R(0, 110, 100, 100)]);
    const one = solve({ place: 'p', kind: 'column', gap: 0, repeat: 'answers' }, ctxOf(R(0, 0, 100, 300), { repeat: () => rows }));
    eq(one.boxes.map(b => b.cell.y), [0, 100, 200], 'a column repeat: one weight each');
  },
  'free: children at fractions of the parent; never reflows'() {
    const r = solve({ place: 'p', kind: 'free', children: [{ box: [0.5, 0, 0.5, 0.5], node: { item: 'part:a', fit: 'stretch' } }] }, ctxOf(R(10, 10, 200, 100)));
    eq(at(r, 'part:a').box, R(110, 10, 100, 50));
  },
  'items: contain and align, cover and focal, stretch, maxSize, crop'() {
    const cell = (node, item = { box: R(0, 0, 200, 100) }) => at(solve({ place: 'p', kind: 'free', children: [{ box: [0, 0, 1, 1], node: { item: 'part:x', ...node } }] }, ctxOf(R(0, 0, 100, 100), { items: { 'part:x': item } })), 'part:x');
    eq(cell({}).box, R(0, 25, 100, 50), 'contain, middle');
    eq(cell({ align: 'start' }).box, R(0, 0, 100, 50));
    eq(cell({ align: ['middle', 'end'] }).box, R(0, 50, 100, 50));
    eq(cell({ fit: 'cover' }).box, R(-50, 0, 200, 100), 'cover, centred');
    eq(cell({ fit: 'cover' }).clip, R(0, 0, 100, 100));
    eq(cell({ fit: 'cover', focal: [0, 0.5] }).box.x, 0, 'the focal point stays in view');
    eq(cell({ fit: 'cover', focal: [1, 0.5] }).box.x, -100);
    eq(cell({ fit: 'stretch' }).scale, [0.5, 1]);
    eq(cell({ maxSize: [40, 40] }).box, R(30, 40, 40, 20), 'maxSize caps the box, aligned in the cell');
    const c = cell({ crop: [0.5, 0, 0.5, 1] });
    eq(c.clip, R(0, 0, 100, 100), 'the right half of the picture fills the cell');
    eq(c.box, R(-100, 0, 200, 100), 'the whole picture moves with its crop');
  },
  'text is moved, never scaled; too large is incomplete'() {
    const items = { 'part:t': { box: R(5, 5, 80, 20), text: true } };
    const r = solve({ place: 'p', kind: 'free', children: [{ box: [0, 0, 1, 1], node: { item: 'part:t', align: 'start', fit: 'stretch' } }] }, ctxOf(R(100, 100, 200, 50), { items }));
    eq(at(r, 'part:t').box, R(100, 100, 80, 20)); eq(at(r, 'part:t').scale, [1, 1]); eq(r.status, 'complete');
    eq(solve({ place: 'p', kind: 'free', children: [{ node: { item: 'part:t' } }] }, ctxOf(R(0, 0, 50, 50), { items })).status, 'incomplete');
  },
  'rtl: a row starts on the right; start alignment mirrors'() {
    const r = solve({ place: 'p', kind: 'row', children: [{ size: 30, node: { item: 'part:a', fit: 'stretch' } }, { node: { item: 'part:b', fit: 'stretch' } }] }, ctxOf(R(0, 0, 100, 10), { direction: 'rtl' }));
    eq(at(r, 'part:a').box.x, 70); eq(at(r, 'part:b').box.x, 0);
  },
  'fixed sizes that do not fit: incomplete, and the boxes leave the root'() {
    const r = solve({ place: 'p', kind: 'row', children: [{ size: 80, node: { item: 'part:a', fit: 'stretch' } }, { size: 80, node: { item: 'part:b', fit: 'stretch' } }] }, ctxOf(R(0, 0, 100, 10)));
    eq(r.status, 'incomplete');
    ok(!inside(at(r, 'part:b').box, R(0, 0, 100, 10)));
  },
  'same inputs, same output; a bounded search'() {
    const plan = { place: 'p', kind: 'grid', columns: 3, repeat: 'r' };
    const rows = Array.from({ length: 50 }, (_, i) => `use:r[k${i}]`);
    const a = solve(plan, ctxOf(R(0, 0, 300, 300), { repeat: () => rows }));
    const b = solve(plan, ctxOf(R(0, 0, 300, 300), { repeat: () => rows }));
    eq(a, b);
    const cut = solve(plan, ctxOf(R(0, 0, 300, 300), { repeat: () => rows, budget: 20 }));
    eq(cut.status, 'incomplete'); eq(cut.unmet.at(-1).reason, 'budget');
    let deep = { item: 'part:a' };
    for (let i = 0; i < PLAN_LIMITS.depth; i++) deep = { kind: 'row', children: [{ node: deep }] };
    eq(planStats({ place: 'p', ...deep }).depth, PLAN_LIMITS.depth + 1);
    eq(solve({ place: 'p', ...deep }, ctxOf(R(0, 0, 1, 1))).status, 'incomplete');
  },
  'plan-only: the viewBox grows about its centre; a root place edge to edge grows with it'() {
    const vb = R(0, 0, 300, 250);
    eq(grownViewBox(vb, { width: 728, height: 90 }), R(-861.111111, 0, 2022.222222, 250));
    const g = grownViewBox(vb, { width: 600, height: 250 });
    eq(g, R(-150, 0, 600, 250));
    eq(grownViewBox(vb, { width: 300, height: 500 }), R(0, -125, 300, 500));
    eq(grownPlace(R(0, 0, 300, 250), vb, g), R(-150, 0, 600, 250));
    eq(grownPlace(R(10, 0, 280, 250), vb, g), R(10, 0, 280, 250), 'not on the side edges: only its height would grow');
  },
  'the reference measurer: shapes, paths, groups with transforms, text estimate'() {
    const svg = parseXml(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g id="g" transform="translate(10 20) scale(2)"><rect id="r" x="1" y="2" width="3" height="4"/><circle cx="10" cy="10" r="2"/></g><path id="p" d="M0 0 L10 0 l0 10 h-5 z"/><text id="t" x="0" y="20" font-size="10">abcd</text></svg>`);
    const by = new Map(); const walk = (n, parent) => { if (!n.name) return; n.parent = parent; if (n.attrs.id) by.set(n.attrs.id, n); n.children.forEach(c => walk(c, n)); }; walk(svg, null);
    eq(measure(by.get('r')), R(12, 24, 6, 8));
    eq(measure(by.get('g')), R(12, 24, 22, 20));
    eq(measure(by.get('p')), R(0, 0, 10, 10));
    eq(measure(by.get('t')), R(0, 12, 22, 10));
    const doc = { uses: [{ id: 'photo', use: 'pic', into: 'photo' }], bindings: [{ id: 'b', target: 't', text: '{{ headline }}' }] };
    ok(resolveItem('field:headline', { byLocal: by, doc }).node === by.get('t'));
    eq(resolveItem('use:photo', { byLocal: by, doc }).use.id, 'photo');
    eq(resolveItem('part:nope', { byLocal: by, doc }), null);
  },
};
