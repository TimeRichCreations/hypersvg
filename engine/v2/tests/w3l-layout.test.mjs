// Choosing a layout by what it declares (7.1 to 7.4), never by its name.
import { inRange, rangeOf, applies, chooseLayout, shapeMapsOf, viewBoxAspect, directionOf, STANDARD_SHAPES } from '../src/layout.mjs';
import { Player } from '../src/story.mjs';
import { Drawing } from '../src/drawing.mjs';
import { eq, ok } from './helpers.mjs';

const sz = (width, height, direction) => ({ width, height, direction });

export const tests = {
  'shape ranges: minimums inclusive, maximums exclusive'() {
    ok(inRange({ minAspect: 1 }, sz(100, 100)), 'minAspect 1 holds at aspect 1');
    ok(!inRange({ maxAspect: 1 }, sz(100, 100)), 'maxAspect 1 fails at aspect 1');
    ok(inRange({ minWidth: 300, maxWidth: 301 }, sz(300, 10)));
    ok(!inRange({ maxHeight: 120 }, sz(10, 120)));
    ok(inRange({ minPixels: 90000 }, sz(300, 300)) && !inRange({ maxPixels: 90000 }, sz(300, 300)));
    ok(inRange({ minAspect: 1.3, maxHeight: 200 }, sz(400, 100)) && !inRange({ minAspect: 1.3, maxHeight: 200 }, sz(800, 300)), 'every key must hold');
    ok(inRange({ direction: 'rtl' }, sz(1, 1, 'rtl')) && !inRange({ direction: 'rtl' }, sz(1, 1)), 'direction defaults to ltr');
    ok(!inRange({ minAspect: 1 }, sz(0, 0)), 'an empty space is in no range');
  },
  'shape names: the axes maps first, then the standard shapes'() {
    eq(rangeOf('strip'), STANDARD_SHAPES.strip);
    ok(applies({ id: 'x', shape: 'strip' }, sz(728, 90)) && !applies({ id: 'x', shape: 'strip' }, sz(300, 250)));
    ok(applies({ id: 'x', shape: 'square' }, sz(300, 250)), '300x250 is square');
    ok(applies({ id: 'x', shape: 'skyscraper' }, sz(160, 600)));
    const exp = { axes: [{ axis: 'shape', select: 'space', shapes: { wide: { minAspect: 1 }, tall: { maxAspect: 1 } } }] };
    const maps = shapeMapsOf(null, exp);
    ok(applies({ id: 'a', shape: 'tall' }, sz(420, 900), maps) && applies({ id: 'a', shape: 'tall' }, sz(300, 900), maps), "the experience's tall replaces the standard tall");
    const scene = { axes: [{ axis: 'shape', shapes: { tall: { maxAspect: 0.5 } } }] };
    ok(!applies({ id: 'a', shape: 'tall' }, sz(600, 900), shapeMapsOf(scene, exp)), "the block's own map comes first");
    eq(rangeOf('nope', maps), null);
    ok(!applies({ id: 'a', shape: 'nope' }, sz(1, 1), maps), 'an unknown name applies nowhere');
    ok(applies({ id: 'a', shape: { maxAspect: 0.9 } }, sz(100, 200)), 'an inline range');
  },
  'names never decide: a layout called wide with a tall shape'() {
    const layouts = [{ id: 'wide', shape: { maxAspect: 1 } }, { id: 'tall', shape: { minAspect: 1 } }];
    eq(chooseLayout(layouts, sz(1200, 800)).id, 'tall');
    eq(chooseLayout(layouts, sz(420, 900)).id, 'wide');
  },
  'list order decides overlaps'() {
    const layouts = [{ id: 'a', shape: { minAspect: 1 } }, { id: 'b', shape: { minAspect: 0.5 } }];
    eq(chooseLayout(layouts, sz(200, 100)), { id: 'a', why: 'order' });
    eq(chooseLayout([...layouts].reverse(), sz(200, 100)), { id: 'b', why: 'order' });
    eq(chooseLayout(layouts, sz(80, 100)), { id: 'b', why: 'order' });
  },
  'the exact size comes first, wherever it is listed'() {
    const layouts = [{ id: 'any', shape: { minAspect: 0 } }, { id: 'rect', size: '300x250' }];
    eq(chooseLayout(layouts, sz(300, 250)), { id: 'rect', why: 'size' });
    eq(chooseLayout(layouts, sz(300.4, 249.6)).id, 'rect', 'whole CSS pixels');
    eq(chooseLayout(layouts, sz(301, 250)).id, 'any');
  },
  'the current layout is kept while it still applies'() {
    const layouts = [{ id: 'a', shape: { minAspect: 1 } }, { id: 'b', shape: { minAspect: 0.8 } }];
    eq(chooseLayout(layouts, sz(120, 100), { current: 'b' }), { id: 'b', why: 'current' });
    eq(chooseLayout(layouts, sz(120, 100), { current: 'a' }), { id: 'a', why: 'current' });
    eq(chooseLayout(layouts, sz(85, 100), { current: 'a' }), { id: 'b', why: 'order' }, 'a no longer applies');
    eq(chooseLayout([{ id: 's', size: '120x100' }, ...layouts], sz(120, 100), { current: 'b' }).id, 's', 'the exact size beats the current one');
  },
  'fits: a layout that does not fit is passed over; none fits gives the first that applies'() {
    const layouts = [{ id: 'a', shape: { minAspect: 1 } }, { id: 'b', shape: { minAspect: 0.8 } }, { id: 'c', shape: { maxAspect: 0.8 } }];
    eq(chooseLayout(layouts, sz(120, 100), { fits: (id) => id !== 'a' }), { id: 'b', why: 'order' });
    eq(chooseLayout(layouts, sz(120, 100), { current: 'a', fits: (id) => id !== 'a' }), { id: 'b', why: 'order' }, 'the current one must fit too');
    eq(chooseLayout(layouts, sz(120, 100), { fits: () => false }), { id: 'a', why: 'incomplete' });
    eq(chooseLayout(layouts, sz(120, 100), { fits: () => undefined }).id, 'a', 'not measured counts as fitting');
  },
  "a use's layout map decides first"() {
    const layouts = [{ id: 'row', shape: { minAspect: 1.3 } }, { id: 'stacked', shape: { maxAspect: 1.3 } }];
    eq(chooseLayout(layouts, sz(500, 100), { forced: 'stacked' }), { id: 'stacked', why: 'use' });
    eq(chooseLayout(layouts, sz(500, 100), { forced: 'missing' }).id, 'row', 'a name the block lacks is ignored (the checker reports it)');
  },
  'none applies: the nearest by aspect, ties to list order'() {
    const layouts = [{ id: 'r', size: '300x250' }, { id: 's', size: '160x600' }, { id: 'l', size: '728x90' }, { id: 'p', size: '320x50' }];
    const aspects = { r: 300 / 250, s: 160 / 600, l: 728 / 90, p: 320 / 50 };
    const near = (w, h) => chooseLayout(layouts, sz(w, h), { aspectOf: (id) => aspects[id] });
    eq(near(310, 260), { id: 'r', why: 'nearest' });
    eq(near(200, 800).id, 's');
    eq(near(970, 90).id, 'l');
    eq(near(640, 100).id, 'p');
    eq(chooseLayout([{ id: 'x', size: '100x100' }, { id: 'y', size: '200x200' }], sz(50, 51), { aspectOf: () => 1 }).id, 'x', 'a tie goes to list order');
  },
  'no box (an empty <g> slot): the first layout'() {
    eq(chooseLayout([{ id: 'a', size: '1x1' }, { id: 'b', size: '2x2' }], null), { id: 'a', why: 'first' });
    eq(chooseLayout([], sz(1, 1)), { id: null, why: 'none' });
  },
  'viewBox aspect and language direction'() {
    eq(viewBoxAspect('<svg xmlns="x" viewBox="0 0 728 90">'), 728 / 90);
    eq(viewBoxAspect('<svg/>'), null);
    const exp = { axes: [{ axis: 'language', select: 'host', options: { en: {}, ar: { direction: 'rtl' } } }] };
    eq(directionOf(exp, 'ar'), 'rtl');
    eq(directionOf(exp, 'en'), 'ltr');
  },
  'a component in slots of two sizes takes a layout for each'() {
    const { d, p } = componentSetup();
    d.mountScene('one', 'only', { width: 400, height: 200 });
    eq(d.frames['one/big'].layout, 'row', 'a 300x100 box at scale 1 is row');
    eq(d.frames['one/small'].layout, 'stacked', 'an 80x100 box is stacked');
    eq(d.frames['one/pinned'].layout, 'stacked', "the use's layout map names stacked for the scene's layout only");
    eq(d.frames['one/loose'].layout, 'row', 'an empty <g> slot has no box: the first layout');
    ok(d.choices['one/small'].why === 'order' && d.choices['one/pinned'].why === 'use' && d.choices['one/loose'].why === 'first');
    const ids = [];
    const walk = (n) => { if (n.name) { if (n.attrs.id) ids.push(n.attrs.id); n.children.forEach(walk); } };
    walk(d.root);
    ok(ids.includes('one__big__row-mark') && ids.includes('one__small__stacked-mark'), 'each use shows its own drawing');
    // At half the output size, the 300x100 box is 150x50 CSS pixels: still row by aspect, and an exact size wins.
    const d2 = new Drawing(p);
    d2.mountScene('one', 'only', { width: 200, height: 100 });
    eq(d2.frames['one/big'].layout, 'exact', 'the slot box is measured at the design scale: 150x50 is the exact size');
  },
  'a component keeps its current layout across drawings while it applies'() {
    const { p } = componentSetup();
    const layouts = { 'one/small': 'row' };
    const d = new Drawing(p, { layouts });
    d.mountScene('one', 'only', { width: 400, height: 200 });
    eq(d.frames['one/small'].layout, 'stacked', 'row does not apply to an 80x100 box');
    eq(layouts['one/small'], 'stacked', 'the choice is remembered');
  },
};

// A scene with four uses of one component that has three layouts: two drawn by shape, one by exact size.
function componentSetup() {
  const sceneSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" data-hsvg-version="2.0" data-hsvg-kind="screen">
  <rect id="big-slot" data-hsvg-kind="part" data-hsvg-slot="big" x="0" y="0" width="300" height="100" fill="none"/>
  <g transform="translate(300 0) scale(0.5)"><rect id="small-slot" data-hsvg-kind="part" data-hsvg-slot="small" width="160" height="200" fill="none"/></g>
  <rect id="pinned-slot" data-hsvg-kind="part" data-hsvg-slot="pinned" x="0" y="100" width="300" height="100" fill="none"/>
  <g id="loose-slot" data-hsvg-kind="part" data-hsvg-slot="loose" transform="translate(300 150)"/>
</svg>`;
  const card = (mark, w, h) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" data-hsvg-version="2.0"><g id="card" data-hsvg-kind="component"><rect id="${mark}-mark" width="${w}" height="${h}"/></g></svg>`;
  const exp = {
    doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', story: { start: 'one', scenes: { one: 'one.json' } } },
    words: { en: {} }, data: {},
    scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', layouts: [{ id: 'only', shape: { minAspect: 0 }, drawing: 'one.svg' }],
      uses: [{ id: 'big', use: 'card', into: 'big' }, { id: 'small', use: 'card', into: 'small' },
        { id: 'pinned', use: 'card', into: 'pinned', layout: { only: 'stacked' } }, { id: 'loose', use: 'card', into: 'loose' }] },
    drawings: { only: { text: sceneSvg } }, words: {} } },
    blocks: { card: { doc: { format: 'hsvg/2.0', kind: 'component', id: 'card',
      layouts: [{ id: 'row', shape: { minAspect: 1.3 }, drawing: 'row.svg' }, { id: 'exact', size: '150x50', drawing: 'exact.svg' }, { id: 'stacked', shape: { maxAspect: 1.3 }, drawing: 'stacked.svg' }] },
    drawings: { row: { text: card('row', 300, 100) }, exact: { text: card('exact', 150, 50) }, stacked: { text: card('stacked', 80, 100) } }, words: {} } },
  };
  const p = new Player(exp);
  ok(p.start().ok);
  return { p, d: new Drawing(p) };
}
