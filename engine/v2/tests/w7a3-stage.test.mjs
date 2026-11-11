// Resizable slots (6.8 size and anchor, 5.10, D1), picking by input (7.1) and true size (7.3).
// No browser: the drawing tree is checked in Node.
import { Player } from '../src/story.mjs';
import { Drawing } from '../src/drawing.mjs';
import { resizedBox, sizeValue, trueSizes, nearestSize, inputPicks, pickedLayout, axisOptions, chooseLayout } from '../src/layout.mjs';
import { checkExperience } from '../check/index.mjs';
import { eq, ok, throwsCode, schemas, mapSource } from './helpers.mjs';
import { files as stageFiles } from './browser/stage-fixture/files.mjs';
import { preview, previewSizes } from '../tools/preview.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repo } from './helpers.mjs';

// The stage fixture as text files, with one change made by edit(files).
const stage = (edit = () => {}) => { const f = structuredClone(stageFiles); edit(f); return mapSource(f); };
const codes = (src) => checkExperience(src, schemas()).diags.map(d => d.code);

const card = (mark, w, h) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" data-hsvg-version="2.0"><g id="card" data-hsvg-kind="component"><rect id="${mark}-mark" width="${w}" height="${h}"/></g></svg>`;
const cardBlock = { doc: { format: 'hsvg/2.0', kind: 'component', id: 'card',
  layouts: [{ id: 'row', shape: { minAspect: 1.3 }, drawing: 'row.svg' }, { id: 'stacked', shape: { maxAspect: 1.3 }, drawing: 'stacked.svg' }] },
drawings: { row: { text: card('row', 300, 100) }, stacked: { text: card('stacked', 80, 100) } }, words: {} };

// A scene with one <rect> slot whose size follows the values w and h, holding a card with a row and a stacked layout,
// and a fit region sized the same way.
function sizedScene({ anchor, size = '[w, h]', target = 'box', extra = '' } = {}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" data-hsvg-version="2.0" data-hsvg-kind="screen">
  <rect id="box" data-hsvg-kind="part" data-hsvg-slot="box" x="100" y="100" width="200" height="100" fill="none"/>
  <rect id="plain" data-hsvg-kind="part" x="0" y="0" width="10" height="10" fill="#000"/>${extra}
</svg>`;
  const exp = {
    doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', story: { start: 'one', scenes: { one: 'one.json' } } },
    words: { en: {} }, data: {},
    scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg',
      values: { w: { type: 'number', initial: 200, minimum: 0, maximum: 400 }, h: { type: 'number', initial: 100, minimum: 0, maximum: 400 } },
      uses: [{ id: 'c', use: 'card', into: 'box' }],
      bindings: [{ id: 'box-size', target, scale: size, as: 'box', ...(anchor ? { anchor } : {}) }] },
    drawings: { main: { text: svg } }, words: {} } },
    blocks: { card: cardBlock },
  };
  const p = new Player(exp);
  ok(p.start().ok);
  return p;
}
const set = (p, vals) => { const r = p.transaction('host', () => { for (const [k, v] of Object.entries(vals)) p.state.blocks.one.values[k] = v; }); ok(r.ok, JSON.stringify(r.fault)); };
const box = (n) => ['x', 'y', 'width', 'height'].map(k => Number(n.attrs[k]));

export const tests = {
  'size: the box grows about its anchor (default the middle)'() {
    const d = { x: 100, y: 100, width: 200, height: 100 };
    eq(resizedBox(d, [100, 50]), { x: 150, y: 125, width: 100, height: 50 });
    eq(resizedBox(d, [100, 50], ['start', 'start']), { x: 100, y: 100, width: 100, height: 50 });
    eq(resizedBox(d, [100, 50], ['end', 'middle']), { x: 200, y: 125, width: 100, height: 50 });
    eq(sizeValue([1, 1]), [1, 1]);
    throwsCode(() => sizeValue([0, 10]), 'E-RANGE');
    throwsCode(() => sizeValue(['a', 10]), 'E-TYPE');
    throwsCode(() => sizeValue([10]), 'E-TYPE');
  },
  'size: at mount the slot takes the size, and what sits in it chooses for that space'() {
    const p = sizedScene({ anchor: ['start', 'start'] });
    const d = new Drawing(p);
    d.mountScene('one', 'main', { width: 400, height: 400 });
    eq(box(d.frames.one.byLocal.get('box')), [100, 100, 200, 100]);
    eq(d.frames['one/c'].layout, 'row', '200x100 is row');
    set(p, { w: 80, h: 160 });
    const d2 = new Drawing(p);
    d2.mountScene('one', 'main', { width: 400, height: 400 });
    eq(box(d2.frames.one.byLocal.get('box')), [100, 100, 80, 160], 'the start anchor keeps x and y');
    eq(d2.frames['one/c'].layout, 'stacked', '80x160 is stacked: the card chose again');
    eq(d2.faults, []);
  },
  'size: a paint moves the box and what is placed in it, and lists the change'() {
    const p = sizedScene();
    const spaces = [];
    const d = new Drawing(p, { onSpace: (a, t, b) => spaces.push([a, t, b.width, b.height]) });
    d.mountScene('one', 'main', { width: 400, height: 400 });
    d.paint();
    eq(d.resized, [], 'an unchanged size writes nothing');
    set(p, { w: 100, h: 50 });
    d.paint();
    eq(d.resized.map(r => [r.target, r.box]), [['box', { x: 150, y: 125, width: 100, height: 50 }]]);
    const placed = d.frames.one.byLocal.get('box').parent.children.find(x => x.slotOf === d.frames.one.byLocal.get('box'));
    eq(box(placed), [150, 125, 100, 50], "the card's drawing moves with its slot");
    eq(spaces, [['one', 'box', 200, 100], ['one', 'box', 100, 50]], 'onSpace hears the mount and the change');
    d.paint();
    eq(d.resized, [], 'painted once');
  },
  'size: only a <rect> slot or region; a bad value is a fault'() {
    const p = sizedScene({ target: 'plain' });
    const d = new Drawing(p);
    d.mountScene('one', 'main', { width: 400, height: 400 });
    ok(d.faults.some(f => f.code === 'E-PLACE'), 'a rect with no place mark');
    const p2 = sizedScene({ size: '[w, 0]' });
    const d2 = new Drawing(p2);
    d2.mountScene('one', 'main', { width: 400, height: 400 });
    ok(d2.faults.some(f => f.code === 'E-RANGE'), 'a zero height');
  },
  'size: a shell stage slot follows values, and the stage space with it'() {
    const shellSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" data-hsvg-version="2.0" data-hsvg-kind="screen">
<rect id="stage-box" data-hsvg-kind="part" data-hsvg-slot="stage" x="0" y="0" width="800" height="450" fill="none"/></svg>`;
    const sceneSvg = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" data-hsvg-version="2.0" data-hsvg-kind="screen"><rect width="${w}" height="${h}" fill="#ccc" data-hsvg-layer="backdrop"/></svg>`;
    const exp = {
      doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', needs: ['shell'], shell: 'shell.json',
        story: { start: 'one', scenes: { one: 'one.json' } } },
      words: { en: {} }, data: {},
      shell: { doc: { format: 'hsvg/2.0', kind: 'shell', id: 'frame', needs: ['shell'], slots: { stage: { kind: 'stage', label: 'Stage' } },
        values: { tall: { type: 'boolean', initial: false } },
        bindings: [{ id: 'stage-size', target: 'stage-box', as: 'box', scale: 'tall ? [450, 800] : [800, 450]', anchor: ['start', 'start'] }] },
      drawings: { main: { text: shellSvg } }, words: {} },
      scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one',
        layouts: [{ id: 'wide', shape: { minAspect: 1 }, drawing: 'wide.svg' }, { id: 'tall', shape: { maxAspect: 1 }, drawing: 'tall.svg' }] },
      drawings: { wide: { text: sceneSvg(160, 90) }, tall: { text: sceneSvg(90, 160) } }, words: {} } },
      blocks: {},
    };
    const p = new Player(exp);
    ok(p.start().ok);
    const d = new Drawing(p);
    d.mountShell(p.shellId, 'main', { width: 1000, height: 1000 });
    eq(d.stageSpace(), { width: 800, height: 450 });
    const r = p.transaction('host', () => { p.state.blocks[p.shellId].values.tall = true; });
    ok(r.ok);
    d.mountStage('one', 'wide', null, d.stageSpace());
    d.paint();
    eq(d.stage.box, { x: 0, y: 0, width: 450, height: 800 }, 'the stage box follows');
    eq(d.stageSpace(), { width: 450, height: 800 });
    eq(box(d.stage.holder.children[0]), [0, 0, 450, 800], "the stage's scene is placed in the new box");
    ok(d.resized.length === 1);
  },
  'check: the stage fixture is clean'() {
    eq(codes(stage()), []);
  },
  'check: a size binding on a part that is not a <rect> slot or region is E-PLACE'() {
    eq(codes(stage(f => { f['shell/frame.json'].bindings[0].target = 'greeting'; })), ['E-PLACE']);
    eq(codes(stage(f => { f['shell/frame.svg'] = f['shell/frame.svg'].replace(' data-hsvg-slot="stage"', ''); })).includes('E-PLACE'), true);
    eq(codes(stage(f => { f['shell/frame.json'].bindings.push({ id: 'again', target: 'stage-box', as: 'box', scale: '[w, w]' }); })), ['E-WRITER']);
  },
  'check: an input selector names a choice whose options are exactly the axis options (E-AXIS-INPUT)'() {
    eq(codes(stage(f => { f['experience.json'].axes[1].value = 'nothing'; })), ['E-AXIS-INPUT']);
    eq(codes(stage(f => { f['experience.json'].values.colourway.enum = ['day', 'dusk']; f['experience.json'].values.colourway.initial = 'day'; })), ['E-RANGE', 'E-AXIS-INPUT'], 'the night option is outside the enum too');
    eq(codes(stage(f => { f['experience.json'].axes[2].options = { en: {}, de: {}, fr: {} }; })), ['E-AXIS-INPUT']);
    eq(codes(stage(f => { delete f['experience.json'].axes[1].value; })), ['E-KEY-REQUIRED'], 'value is required with input (the schema)');
  },
  'input: the options of each axis'() {
    eq(axisOptions({ axis: 'shape', sizes: { '300x250': 'must' }, shapes: { wide: {} } }), ['300x250', 'wide']);
    eq(axisOptions({ axis: 'content', tiers: [{ tier: 'short' }, { tier: 'rich' }] }), ['short', 'rich']);
    eq(axisOptions({ axis: 'language', options: { en: {}, de: {} } }), ['en', 'de']);
    eq(axisOptions({ axis: 'layout' }, { layouts: [{ id: 'row' }, { id: 'stacked' }] }), ['row', 'stacked']);
    eq(axisOptions({ axis: 'theme' }, { themes: { day: {}, night: {} } }), ['day', 'night']);
  },
  'input: picks are read from each block, a block own entry wins, a bad pick is listed'() {
    const exp = { axes: [{ axis: 'theme', select: 'input', value: 'colourway', options: ['day', 'night'] }, { axis: 'language', select: 'input', value: 'lang', options: { en: {}, de: {} } }, { axis: 'shape', select: 'space' }] };
    const scene = { axes: [{ axis: 'layout', select: 'input', value: 'arrangement', options: ['row', 'stacked'] }, { axis: 'look', select: 'input', value: 'x' }] };
    const vals = { experience: { colourway: 'night', lang: 'de' }, one: { arrangement: 'stacked' } };
    const p = inputPicks([['experience', exp], ['one', scene]], (a, n) => vals[a][n]);
    eq(p, { experience: { theme: 'night', language: 'de' }, blocks: { one: { layout: 'stacked' } }, bad: [] });
    vals.one.arrangement = 'grid';
    eq(inputPicks([['one', scene]], (a, n) => vals[a][n]).bad, [{ address: 'one', id: 'layout', value: 'grid', options: ['row', 'stacked'] }]);
  },
  'input: a picked layout or shape comes before the space'() {
    const layouts = [{ id: 'rect', size: '300x250' }, { id: 'wide', shape: 'wide' }, { id: 'tall', shape: { maxAspect: 1 } }];
    eq(pickedLayout(layouts, { layout: 'tall' }), 'tall');
    eq(pickedLayout(layouts, { shape: '300x250' }), 'rect');
    eq(pickedLayout(layouts, { shape: 'wide' }), 'wide');
    eq(pickedLayout(layouts, { shape: 'tall' }, [{ tall: { maxAspect: 1 } }]), 'tall', 'a shape name whose range a layout writes inline');
    eq(pickedLayout(layouts, { shape: 'nope' }), null);
    eq(chooseLayout(layouts, { width: 300, height: 250 }, { input: 'tall' }), { id: 'tall', why: 'input' });
    eq(chooseLayout(layouts, { width: 300, height: 250 }, { forced: 'wide', input: 'tall' }).id, 'wide', "a use's layout map still decides first");
  },
  'input: a drawing takes the picked theme and the picked layout of a use'() {
    const p = sizedScene();
    p.exp.doc.themes = { day: { colorRoles: { ink: '#000000' } }, night: { colorRoles: { ink: '#ffffff' } } };
    p.exp.doc.theme = 'day';
    const d = new Drawing(p, { picks: { experience: {}, blocks: { 'one/c': { layout: 'stacked' } } }, theme: 'night' });
    d.mountScene('one', 'main', { width: 400, height: 400 });
    eq(d.theme.colorRoles.ink, '#ffffff');
    eq(d.choices['one/c'], { id: 'stacked', why: 'input' }, 'a 200x100 box would be row by its space');
  },
  'true size: only an experience whose shape axis lists only exact sizes'() {
    eq(trueSizes({ axes: [{ axis: 'shape', sizes: { '300x250': 'must', '728x90': 'should' } }] }), [{ width: 300, height: 250 }, { width: 728, height: 90 }]);
    eq(trueSizes({ axes: [{ axis: 'shape', shapes: { wide: { minAspect: 1 } } }] }), null);
    eq(trueSizes({ axes: [{ axis: 'shape', sizes: { '300x250': 'must' }, shapes: { wide: {} } }] }), null);
    eq(trueSizes({}), null);
    eq(trueSizes({ axes: [{ axis: 'shape', sizes: { '300x250': 'must', '728x90': 'must' } }, { axis: 'shape', sizes: { '728x90': 'must' } }] }), [{ width: 728, height: 90 }], "the experience's entry narrows its kit's");
  },
  'true size: the size nearest the window, never scaled up'() {
    const sizes = [{ width: 300, height: 250 }, { width: 728, height: 90 }, { width: 160, height: 600 }];
    eq(nearestSize(sizes, { width: 1280, height: 720 }), { width: 300, height: 250, scale: 1 });
    eq(nearestSize(sizes, { width: 1280, height: 150 }), { width: 728, height: 90, scale: 1 });
    eq(nearestSize(sizes, { width: 80, height: 300 }), { width: 160, height: 600, scale: 0.5 }, 'a smaller window scales it down');
    eq(nearestSize([{ width: 300, height: 250 }], { width: 2000, height: 2000 }).scale, 1);
  },
  async 'preview: one page with every declared size, each packed page beside it'() {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-a3-preview-'));
    try {
      const r = await preview([path.join(repo, 'engine', 'v2', 'tests', 'layout-fixture')], out);
      eq(r.members.map(m => [m.id, m.sizes.map(s => `${s.width}x${s.height}`), m.page]), [['layout-fixture', ['300x250', '160x600', '728x90', '320x50'], 'pages/layout-fixture.html']]);
      const html = fs.readFileSync(r.htmlPath, 'utf8');
      eq([...html.matchAll(/data-size="([^"]+)"/g)].map(m => m[1]), ['300x250', '160x600', '728x90', '320x50']);
      ok(/id="handle" role="slider" tabindex="0"/.test(html), 'a drag handle that takes the keyboard');
      ok(!/https?:\/\//.test(html.replace('http://www.w3.org/2000/svg', '')), 'no network address');
      ok(fs.existsSync(path.join(out, 'pages', 'layout-fixture.html')));
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  },
  'preview: a shape-only experience shows each frame at its viewBox size'() {
    const exp = { doc: { axes: [{ axis: 'shape', shapes: { wide: {} } }], story: { start: 'a' } },
      scenes: { a: { drawings: { wide: { text: '<svg viewBox="0 0 1200 800"/>' }, tall: { text: '<svg viewBox="0 0 420 900"/>' } } } } };
    eq(previewSizes(exp), [{ width: 1200, height: 800 }, { width: 420, height: 900 }]);
  },
};
