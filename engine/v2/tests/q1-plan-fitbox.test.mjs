// A layout plan moves a text part's fit box (the region of the fit on the binding that shows it)
// with the part, by the same move, so fitted text sits where the plan puts it, live and baked (B7 Request 1).
// The fixture is tests/plan-fixture with a fit region drawn behind the title and a fit binding on it.
import { loadExperience } from '../src/load.mjs';
import { Player } from '../src/story.mjs';
import { Drawing } from '../src/drawing.mjs';
import { chooseLayout, aspectsOf, shapeMapsOf, parseSize } from '../src/layout.mjs';
import * as P from '../src/plan.mjs';
import { bakePlans } from '../tools/pack.mjs';
import { fixtureFiles, SIZES, screenBox } from './a1-fit.test.mjs';
import { schemas, mapSource, eq, ok } from './helpers.mjs';

function withRegion() {
  const files = fixtureFiles();
  files['components/offer/offer.svg'] = files['components/offer/offer.svg'].replace('<text id="offer__offer-title"',
    '<rect id="offer__title-box" data-hsvg-kind="part" data-hsvg-fit="" x="10" y="14" width="280" height="36" fill="none"/>\n<text id="offer__offer-title"');
  const c = JSON.parse(files['components/offer/component.json']);
  c.inputs = { ...(c.inputs || {}), headline: { kind: 'content', contentType: 'text', type: 'string', maxLength: 60, initial: 'Summer sale' } };
  c.bindings = [...(c.bindings || []), { id: 'title-text', target: 'offer-title', text: '{{ headline }}', fit: { box: 'title-box', minFontPx: 10, maxLines: 2 } }];
  c.needs = [...new Set([...(c.needs || []), 'fit'])];
  files['components/offer/component.json'] = JSON.stringify(c);
  return files;
}
const load = (files) => { const l = loadExperience(mapSource(files), schemas()); ok(l.experience, JSON.stringify(l.diags.slice(0, 3))); return l.experience; };
function drawAt(experience, size, opts = {}) {
  const p = new Player(experience);
  ok(p.start().ok);
  const space = parseSize(size);
  const sc = experience.scenes.ad;
  const pick = chooseLayout(sc.doc.layouts, space, { aspectOf: aspectsOf(sc), maps: shapeMapsOf(sc.doc, experience.doc) });
  const d = new Drawing(p, { layouts: {}, ...opts });
  d.mountScene('ad', pick.id, space);
  return { d, pick, space };
}
function byId(root) {
  const m = new Map();
  const walk = (n, parent) => { if (!n.name) return; n.parent = parent; if (n.attrs.id) m.set(n.attrs.id, n); n.children.forEach(c => walk(c, n)); };
  walk(root, null);
  return m;
}
const TITLE = 'ad__offer__offer-title';
const REGION = 'ad__offer__title-box';
// The region keeps its place against the title: the same offset, scaled by the plan's move, at every size.
function regionFollows(d, size, label) {
  const ids = byId(d.root);
  const t = ids.get(TITLE); const r = ids.get(REGION);
  ok(t && r, `${label} ${size}: the title and its region are drawn`);
  eq(r.attrs.transform, t.attrs.transform, `${label} ${size}: the region takes the title's move`);
  const tb = screenBox(d.root, t, parseSize(size)); const rb = screenBox(d.root, r, parseSize(size));
  ok(rb.x <= tb.x + 0.5 && rb.x + rb.width >= tb.x - 0.5, `${label} ${size}: the region's left edge sits at the text's start (${JSON.stringify(rb)} against ${JSON.stringify(tb)})`);
  ok(rb.y < tb.y + tb.height && rb.y + rb.height > tb.y, `${label} ${size}: the region and the text share their height`);
}

export const tests = {
  'live: the plan moves the title fit region with the title, at the five sizes'() {
    const exp = load(withRegion());
    for (const size of SIZES) {
      const { d } = drawAt(exp, size, { planSolver: P });
      eq(d.plans['ad/offer'].status, 'complete', `${size}: ${JSON.stringify(d.plans['ad/offer'].unmet)}`);
      regionFollows(d, size, 'live');
    }
  },
  'baked: the derived frames carry the moved region; a baked page shows it where the live one does'() {
    const files = withRegion();
    const out = bakePlans(load(files), { date: '2026-11-07T00:00:00Z' });
    const baked = load({ ...files, ...out.texts });
    const live = load(files);
    for (const size of SIZES) {
      const b = drawAt(baked, size); const l = drawAt(live, size, { planSolver: P });
      regionFollows(b.d, size, 'baked');
      const bb = screenBox(b.d.root, byId(b.d.root).get(REGION), b.space); const lb = screenBox(l.d.root, byId(l.d.root).get(REGION), l.space);
      for (const k of ['x', 'y', 'width', 'height']) ok(Math.abs(bb[k] - lb[k]) < 0.5, `${size}: the baked region ${k} ${bb[k]} against live ${lb[k]}`);
    }
  },
  'a region that is itself an item of the plan keeps its own box'() {
    const files = withRegion();
    const c = JSON.parse(files['components/offer/component.json']);
    // Put the region in the title's place in both layouts, as an item, so it is solved itself.
    const s = JSON.stringify(c).replaceAll('"item":"part:offer-title"', '"item":"part:title-box"');
    ok(s !== JSON.stringify(c), 'the fixture names the title as an item');
    files['components/offer/component.json'] = s;
    const { d } = drawAt(load(files), '300x250', { planSolver: P });
    const ids = byId(d.root);
    ok(ids.get(REGION).attrs.transform, 'the region is solved as its own item');
    eq(ids.get(TITLE).attrs.transform, undefined, 'the title, not an item now, is not moved by the plan');
  },
};
