// The 15 final drawing marks (D33 to D38). Each old mark, old motion channel and common wrong guess
// is E-WORD-RENAMED with the final form; the final marks check clean.
import { checkDrawing } from '../schema/drawing-check.mjs';
import { schemas, eq, ok } from './helpers.mjs';
import { roleOf, sideOf, keepOf, boxOf } from '../src/marks.mjs';
import { Player } from '../src/story.mjs';
import { Drawing } from '../src/drawing.mjs';
import { checkExperience } from '../check/index.mjs';
import { mapSource } from './helpers.mjs';
import { base } from './check-refs.test.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { repo } from './helpers.mjs';
import os from 'node:os';
import { pack } from '../tools/pack.mjs';
import { recordOf } from '../src/marks.mjs';
import { parseXml } from '../schema/xml.mjs';
import { pivotsOutside } from '../check/pivots.mjs';

// The K2b fixture (icons, attach) as an in-memory map, so a test can change one file.
const FIXTURE = path.join(repo, 'engine', 'v2', 'tests', 'k2b-fixture');
const fixture = () => {
  const out = {};
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else { const rel = path.relative(FIXTURE, f).split(path.sep).join('/'); const t = fs.readFileSync(f, 'utf8'); out[rel] = rel.endsWith('.json') ? JSON.parse(t) : t; } } };
  walk(FIXTURE);
  return out;
};
const fixtureCodes = (change) => { const f = fixture(); change?.(f); return checkExperience(mapSource(f), schemas(), {}).diags.map(d => `${d.code} ${d.message}`); };

// An icon set (2.6): <symbol data-hsvg-role="icon"> elements named by their ids.
const ICONS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" data-hsvg-version="2.0">
  <symbol id="clock" data-hsvg-role="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#000"/></symbol>
  <symbol id="star" data-hsvg-role="icon" viewBox="0 0 10 10"><path id="tip" d="M5 0L6 4H10L7 6L8 10L5 8L2 10L3 6L0 4H4Z"/></symbol>
</svg>`;
// A scene with an icon place (a nested <svg> part with role icon) and a variant binding as icon.
const ICON_SCENE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" data-hsvg-version="2.0" data-hsvg-kind="screen">
  <svg id="badge" data-hsvg-kind="part" data-hsvg-role="icon" x="10" y="10" width="24" height="24" viewBox="0 0 20 20"><rect width="20" height="20"/></svg>
</svg>`;
const iconPlayer = () => {
  const p = new Player({
    doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', story: { start: 'one', scenes: { one: 'one.json' } } },
    words: { en: {} }, data: {}, blocks: {}, iconSets: { set: ICONS },
    scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg', values: { status: { type: 'string', initial: 'clock' } },
      bindings: [{ id: 'show', target: 'badge', variant: 'status', as: 'icon' }] }, drawings: { main: { text: ICON_SCENE } }, words: {} } },
  });
  if (!p.start().ok) throw new Error('did not start');
  const d = new Drawing(p); d.mountScene('one');
  return { p, d };
};

const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>t</title>${inner}</svg>`;
const diags = (inner) => checkDrawing(svg(inner), schemas().drawing).diags;
const renamed = (inner) => diags(inner).filter(d => d.code === 'E-WORD-RENAMED').map(d => d.message);
const errors = (inner) => diags(inner).filter(d => d.code.startsWith('E-')).map(d => `${d.code}: ${d.message}`);

export const tests = {
  'group 1: follow, variant, color, text-style and layer check clean'() {
    eq(errors(`<g id="sky" data-hsvg-layer="backdrop"><rect width="200" height="200" fill="#9cf"/></g>
      <g id="glow" data-hsvg-layer="decoration"><circle cx="20" cy="20" r="5" fill="#ff0"/></g>
      <g id="owl" data-hsvg-kind="part" data-hsvg-motion="move-y -20..0"><rect width="10" height="10" data-hsvg-color="fill:accent stroke:ink" fill="#f00" stroke="#000"/></g>
      <g id="tail" data-hsvg-kind="part" data-hsvg-follow="owl" data-hsvg-pivot="5 5" data-hsvg-motion="rotate -4..4; lean -10..10"><rect width="4" height="4"/></g>
      <path id="wire" data-hsvg-kind="part" pathLength="1" d="M0 0H100" stroke="#000" data-hsvg-motion="draw 0..1; line 1..4"/>
      <text id="title" data-hsvg-kind="part" data-hsvg-text-style="heading" x="10" y="40" font-family="Bitter, serif">Hi</text>
      <g id="mouth" data-hsvg-kind="part"><g data-hsvg-variant="closed"><rect width="1" height="1"/></g><g data-hsvg-variant="open" display="none"><rect width="2" height="2"/></g></g>`), []);
  },
  'group 1: each old mark is E-WORD-RENAMED with the final form'() {
    eq(renamed('<g id="a" data-hsvg-paint="decoration"><rect width="1" height="1"/></g>'), ['data-hsvg-paint is now data-hsvg-layer="decoration" (D33)']);
    eq(renamed('<rect id="b" data-hsvg-kind="part" data-hsvg-color-role="accent" width="1" height="1"/>'), ['data-hsvg-color-role is now data-hsvg-color (D33)']);
    eq(renamed('<text id="c" data-hsvg-kind="part" data-hsvg-type-role="display">x</text>'), ['data-hsvg-type-role is now data-hsvg-text-style="heading" (D33)']);
    eq(renamed('<g id="d" data-hsvg-kind="part" data-hsvg-follows="b"><rect width="1" height="1"/></g><rect id="b" data-hsvg-kind="part" width="1" height="1"/>'), ['data-hsvg-follows is now data-hsvg-follow (D33)']);
    eq(renamed('<g id="e" data-hsvg-kind="part"><g data-hsvg-look="a"><rect width="1" height="1"/></g><g data-hsvg-variant="b" display="none"/></g>'), ['data-hsvg-look is now data-hsvg-variant (D33)']);
  },
  'group 1: the common wrong guesses name the right mark'() {
    eq(renamed('<rect id="f" data-hsvg-part="" width="1" height="1"/>'), ['data-hsvg-part is now data-hsvg-kind="part" (D33)']);
    eq(renamed('<rect id="g" data-hsvg-kind="part" data-hsvg-name="Go" width="1" height="1"/>'), ['data-hsvg-name is now data-hsvg-label (D33)']);
  },
  'group 1: old motion channels are E-WORD-RENAMED; the old spelling shows the final names'() {
    const m = (v) => diags(`<g id="h" data-hsvg-kind="part" data-hsvg-pivot="0 0" data-hsvg-motion="${v}"><rect width="1" height="1"/></g>`);
    eq(m('translate-y -60..0').map(d => d.message), ['the motion channel translate-y is now move-y (D33)']);
    eq(m('skew -5..5').map(d => d.message), ['the motion channel skew is now lean (D33)']);
    eq(m('stroke-width 1..2').map(d => d.message), ['the motion channel stroke-width is now line (D33)']);
    ok(m('translate(60)').some(d => d.code === 'E-MARK-VALUE' && d.message.includes('"move-x -60..60; move-y -60..60"')), 'the old spelling names move-x and move-y');
  },
  'D37: text styles heading, body and caption; display and text are renamed'() {
    for (const s of ['heading', 'body', 'caption']) eq(errors(`<text id="t" data-hsvg-kind="part" data-hsvg-text-style="${s}">x</text>`), []);
    eq(schemas().drawing.typeRoles.core, ['heading', 'body', 'caption']);
  },
  'group 2: fit (text, items, video; a painted text box, D38), repeat, sides and protected areas check clean'() {
    eq(errors(`<rect id="bar" data-hsvg-kind="part" data-hsvg-fit="" x="0" y="0" width="50" height="10" fill="#2e7d4f"/>
      <rect id="b2" data-hsvg-kind="part" data-hsvg-fit="text" width="5" height="5" fill="none"/>
      <rect id="b3" data-hsvg-kind="part" data-hsvg-fit="items" width="5" height="5" fill="none"/>
      <rect id="b4" data-hsvg-kind="part" data-hsvg-fit="video" width="5" height="5" fill="none"/>
      <g id="rows" data-hsvg-kind="part" data-hsvg-repeat="list"><g id="r1" data-hsvg-kind="part" data-hsvg-slot="r1"/></g>
      <g id="hand" data-hsvg-kind="part" data-hsvg-role="hand left"><rect width="1" height="1"/></g>
      <rect id="face" data-hsvg-kind="part" data-hsvg-role="keep-inside keep-clear" width="9" height="9" fill="none"/>`), []);
  },
  'group 2: region, side and safe-area are E-WORD-RENAMED; wrong role words and a painted protected area are refused'() {
    eq(renamed('<rect id="a" data-hsvg-kind="part" data-hsvg-region="fit" width="1" height="1" fill="none"/>'), ['data-hsvg-region is now data-hsvg-fit (D33)']);
    eq(renamed('<rect id="a" data-hsvg-kind="part" data-hsvg-region="layout-plan" width="1" height="1" fill="none"/>'), ['data-hsvg-region is now data-hsvg-fit="items" (D33)']);
    eq(renamed('<g id="a" data-hsvg-kind="part" data-hsvg-region="repeat"/>'), ['data-hsvg-region is now data-hsvg-repeat (D33)']);
    eq(renamed('<g id="a" data-hsvg-kind="part" data-hsvg-role="hand" data-hsvg-side="left"/>'), ['data-hsvg-side is now the side as a role word, as data-hsvg-role="hand left" (D33)']);
    eq(renamed('<rect id="a" data-hsvg-kind="part" data-hsvg-safe-area="keep-clear" width="1" height="1" fill="none"/>'), ['data-hsvg-safe-area is now data-hsvg-role="keep-clear" on the unpainted <rect> (D33)']);
    ok(errors('<g id="a" data-hsvg-kind="part" data-hsvg-role="hand wing"/>').some(m => m.startsWith('E-MARK-VALUE') && m.includes('one role word')));
    ok(errors('<g id="a" data-hsvg-kind="part" data-hsvg-role="hand left right"/>').some(m => m.startsWith('E-MARK-VALUE') && m.includes('one side word')));
    ok(errors('<rect id="a" data-hsvg-kind="part" data-hsvg-role="keep-clear" width="1" height="1" fill="#000"/>').some(m => m.startsWith('E-PLACE')));
    ok(errors('<g id="a" data-hsvg-kind="part" data-hsvg-role="keep-clear"/>').some(m => m.startsWith('E-PLACE')));
    ok(errors('<rect id="a" data-hsvg-kind="part" data-hsvg-fit="zone" width="1" height="1"/>').some(m => m.startsWith('E-MARK-VALUE') && m.includes('(no value), text, items, video')));
  },
  'group 2: the player and the checker read a role word, a side, a protected area and a box through src/marks.mjs'() {
    const a = { 'data-hsvg-role': 'hand left' };
    eq([roleOf(a), sideOf(a), keepOf(a)], ['hand', 'left', null]);
    eq(keepOf({ 'data-hsvg-role': 'keep-clear keep-inside' }), 'keep-inside keep-clear');
    eq(roleOf({ 'data-hsvg-role': 'keep-clear' }), null);
    eq([boxOf({ 'data-hsvg-fit': '' }), boxOf({ 'data-hsvg-fit': 'items' }), boxOf({ 'data-hsvg-repeat': 'x' }), boxOf({})], ['text', 'items', 'repeat', null]);
  },
  'group 3: the player draws an icon by id in an icon place; an unknown id keeps the drawn icon'() {
    const { p, d } = iconPlayer();
    const place = () => d.frames.one.byLocal.get('badge');
    const drawn = (n) => n.children.filter(c => c.name).map(c => c.name).join(' ');
    d.paint();
    eq([place().attrs.viewBox, drawn(place())], ['0 0 24 24', 'circle'], 'clock');
    p.state.blocks.one.values.status = 'star'; d.paint();
    eq([place().attrs.viewBox, drawn(place())], ['0 0 10 10', 'path'], 'star');
    ok(place().children.find(c => c.name === 'path').attrs.id === undefined, 'the copy carries no ids');
    p.state.blocks.one.values.status = 'nothing'; d.paint();
    eq([place().attrs.viewBox, drawn(place())], ['0 0 20 20', 'rect'], 'no match: the drawn icon');
  },
  'group 3: an icon set checks clean; an icon needs an id and a viewBox; data-hsvg-icon is E-WORD-RENAMED'() {
    eq(checkDrawing(ICONS, schemas().drawing, { iconSet: true }).diags.filter(d => d.code.startsWith('E-')), []);
    const bad = ICONS.replace(' viewBox="0 0 10 10"', '').replace('id="clock"', 'id="Clock"');
    eq(checkDrawing(bad, schemas().drawing, { iconSet: true }).diags.map(d => d.code).sort(), ['E-ID-SHAPE', 'E-PLACE']);
    eq(renamed('<svg id="i" data-hsvg-kind="part" data-hsvg-icon="action.next" viewBox="0 0 1 1"/>'), ['data-hsvg-icon is now data-hsvg-role="icon": an icon is a <symbol> named by its id; an icon place is a part with role icon (D33)']);
  },
  'group 3: an icon binding targets an icon place (E-PLACE); the icon set resource is read and checked'() {
    const f = base();
    f['experience.json'].resources.icons = { kind: 'icon-set', file: 'icons.svg', digest: 'sha256:' + '0'.repeat(64) };
    f['icons.svg'] = ICONS;
    f['scenes/one/scene.json'].values.status = { type: 'string', initial: 'clock' };
    f['scenes/one/scene.json'].bindings.push({ id: 'show', target: 'go', variant: 'status', as: 'icon' });
    const codes = checkExperience(mapSource(f), schemas(), {}).diags.filter(d => d.path?.includes?.('show') || /icon/.test(d.message)).map(d => d.code);
    ok(codes.includes('E-PLACE'), codes.join());
  },
  'group 4: player.attach names a use and a slot; the fixture checks clean'() {
    eq(fixtureCodes().filter(c => c.startsWith('E-') || c.startsWith('W-')), []);
    const attach = (to, part = "'parcel'") => (f) => { f['scenes/s/scene.json'].on['press:load'][0].actions[0].with = { part, to }; };
    ok(fixtureCodes(attach("'bike.basket'")).some(c => c.startsWith('E-REF-UNKNOWN') && c.includes('draws no slot "basket"')), 'a typo in the slot');
    ok(fixtureCodes((f) => { attach("'bike.basket-point'")(f); delete f['components/bike/component.json'].places; }).some(c => c.startsWith('E-REF-UNKNOWN') && c.includes('list it in places')), 'a slot the use does not expose');
    ok(fixtureCodes(attach("'parcel-home'", "'next'")).some(c => c.startsWith('E-REF-UNKNOWN') && c.includes('is not a use')), 'a drawn part is not attached');
    ok(fixtureCodes(attach("'nowhere'")).some(c => c.startsWith('E-REF-UNKNOWN') && c.includes('slot "nowhere" is not drawn')), 'an own slot that is not drawn');
    eq(fixtureCodes(attach("'parcel-home'")).filter(c => c.startsWith('E-')), [], 'back to its own home slot is clean');
  },
  'group 4: the drawing moves the use onto the slot and back; data-hsvg-anchor is E-WORD-RENAMED'() {
    const p = new Player(fixturePlayer()); ok(p.start().ok);
    const d = new Drawing(p); d.mountScene('s'); d.paint();
    const svg = d.frames['s/parcel'].root; const home = svg.mountedIn;
    eq(home.attrs['data-hsvg-slot'], 'parcel-home');
    p.state.blocks.s.attach.parcel = 'bike.basket-point'; d.paint();
    eq(svg.mountedIn.attrs['data-hsvg-slot'], 'basket-point');
    ok(!home.children.includes(svg) && svg.mountedIn.children.includes(svg), 'moved in the node tree');
    p.state.blocks.s.attach.parcel = 'parcel-home'; d.paint();
    ok(svg.mountedIn === home, 'its home slot');
    p.state.blocks.s.attach.parcel = 'bike.basket-point'; d.paint(); delete p.state.blocks.s.attach.parcel; d.paint();
    ok(svg.mountedIn === home, 'null');
    eq(renamed('<g id="a" data-hsvg-kind="part" data-hsvg-anchor="0 0"/>'), ['data-hsvg-anchor is now an empty <g data-hsvg-slot="<name>"> inside the part, placed at the point (player.attach names the slot) (D33)']);
  },
  'group 5: the tool record is one JSON object in <metadata>; derived and steps are E-WORD-RENAMED'() {
    const rec = (m, inner = '<g id="a" data-hsvg-kind="part"/>') => checkDrawing(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" data-hsvg-version="2.0" data-hsvg-kind="screen">${m}${inner}</svg>`, schemas().drawing).diags.map(d => `${d.code}: ${d.message}`);
    eq(rec('<metadata>{"derived": "derived", "steps": "fits-title:shrink fits-title:shrink"}</metadata>'), []);
    eq(rec('<metadata>{"derived": "edited"}</metadata>'), []);
    ok(rec('<metadata>derived</metadata>').some(m => m.startsWith('E-MARK-VALUE') && m.includes('one JSON object')));
    ok(rec('<metadata>{"derived": "maybe"}</metadata>').some(m => m.startsWith('E-MARK-VALUE')));
    ok(rec('<metadata>{"author": "me"}</metadata>').some(m => m.includes('not author')));
    ok(rec('<metadata>{}</metadata><metadata>{}</metadata>').some(m => m.includes('one <metadata>')));
    ok(rec('', '<g id="a" data-hsvg-kind="part"><metadata>{}</metadata></g>').some(m => m.includes('direct child of the root')));
    const root = parseXml('<svg><metadata>{"derived":"derived","steps":"a:b"}</metadata></svg>');
    eq(recordOf(root), { derived: 'derived', steps: 'a:b' });
    eq(renamed('<g id="a" data-hsvg-kind="part"/>').length, 0);
    ok(checkDrawing('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" data-hsvg-version="2.0" data-hsvg-kind="screen" data-hsvg-derived="derived"><title>t</title></svg>', schemas().drawing).diags.some(d => d.code === 'E-WORD-RENAMED' && d.message.includes('<metadata>')));
  },
  async 'group 5: the packer strips a tool record the player does not read'() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-k2b-meta-'));
    fs.cpSync(FIXTURE, path.join(dir, 'src'), { recursive: true });
    const svgFile = path.join(dir, 'src', 'scenes', 's', 's.svg');
    fs.writeFileSync(svgFile, fs.readFileSync(svgFile, 'utf8').replace('<title>', '<metadata>{"derived":"edited","steps":"zz-marker:shrink"}</metadata>\n<title>'));
    await pack(path.join(dir, 'src'), path.join(dir, 'out'), {});
    const html = fs.readFileSync(path.join(dir, 'out', fs.readdirSync(path.join(dir, 'out')).find(f => f.endsWith('.html'))), 'utf8');
    ok(!html.includes('zz-marker') && html.includes('badge'), 'the page carries the drawing without its tool record');
    fs.rmSync(dir, { recursive: true, force: true });
  },
  'group 6: W-PIVOT-OUTSIDE when a part that turns has its pivot away from what it draws'() {
    const out = (inner) => pivotsOutside(parseXml(svg(inner))).map(p => p.id);
    eq(out('<g id="arm" data-hsvg-kind="part" data-hsvg-pivot="10 10" data-hsvg-motion="rotate -20..20"><rect x="0" y="0" width="80" height="20"/></g>'), [], 'a hinge at its end');
    eq(out('<g id="arm" data-hsvg-kind="part" data-hsvg-pivot="10 150" data-hsvg-motion="rotate -20..20"><rect x="0" y="0" width="80" height="20"/></g>'), ['arm'], 'the art moved, the pivot stayed');
    eq(out('<g id="arm" data-hsvg-kind="part" data-hsvg-pivot="10 150" data-hsvg-motion="move-x 0..20"><rect x="0" y="0" width="80" height="20"/></g>'), [], 'a part that only moves');
    eq(out('<g id="arm" data-hsvg-kind="part" data-hsvg-pivot="10 150" data-hsvg-motion="rotate *"><rect x="0" y="0" width="80" height="20"/></g>'), [], 'rotate * spins freely');
    eq(out('<g id="t1" data-hsvg-kind="part" data-hsvg-pivot="100 100" data-hsvg-motion="scale 1..2"><rect x="99" y="10" width="2" height="6"/></g><g id="t2" data-hsvg-kind="part" data-hsvg-pivot="100 100" data-hsvg-motion="scale 1..2"><rect x="150" y="99" width="6" height="2"/></g>'), [], 'a shared centre');
    eq(out('<g id="arm" data-hsvg-kind="part" data-hsvg-pivot="10 150" data-hsvg-motion="rotate -20..20"><g transform="translate(0 140)"><rect x="0" y="0" width="80" height="20"/></g></g>'), [], 'inner transforms count');
    const codes = fixtureCodes((f) => { f['components/bike/bike.svg'] = f['components/bike/bike.svg'].replace('data-hsvg-motion="move-x 0..100"', 'data-hsvg-motion="move-x 0..100; rotate -5..5" data-hsvg-pivot="400 400"'); });
    ok(codes.some(c => c.startsWith('W-PIVOT-OUTSIDE') && c.includes('bike__frame')), codes.join('; '));
  },
};
// The fixture as a Player's experience (what the reader gives), for drawing tests.
function fixturePlayer() {
  const f = fixture();
  const blk = (dir, id) => ({ doc: f[`${dir}/component.json`], drawings: { main: { text: f[`${dir}/${id}.svg`] } }, words: {} });
  return { doc: f['experience.json'], words: { en: {} }, data: {}, iconSets: { icons: f['resources/icons.svg'] },
    blocks: { bike: blk('components/bike', 'bike'), parcel: blk('components/parcel', 'parcel') },
    scenes: { s: { doc: f['scenes/s/scene.json'], drawings: { main: { text: f['scenes/s/s.svg'] } }, words: {} } } };
}