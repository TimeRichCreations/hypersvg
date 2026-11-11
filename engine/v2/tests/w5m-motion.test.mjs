// The motion capability (6.7), the points binding (6.8), stop with keep (6.7, 5.15.1) and a fit's steps
// order (7.6), on the motion fixture (browser/motion-fixture/files.mjs) and small cases.
import { Player } from '../src/story.mjs';
import { Drawing } from '../src/drawing.mjs';
import { loadExperience } from '../src/load.mjs';
import { searchFit } from '../src/fit.mjs';
import { flatten, pointAt, routeSegments } from '../src/route.mjs';
import { blendHex } from '../src/paint-channels.mjs';
const { morphPath, morphMismatch } = await addonCode('../src/capabilities/motion.mjs', import.meta.url) ?? {};
import { checkExperience } from '../check/index.mjs';
import { pack } from '../tools/pack.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq, ok, mapSource, schemas, addonCode } from './helpers.mjs';
import { files, WIRE } from './browser/motion-fixture/files.mjs';

function setup({ edit = null, modules } = {}) {
  const f = structuredClone(files);
  edit?.(f);
  const loaded = loadExperience(mapSource(f), schemas());
  ok(loaded.experience, loaded.diags.map(d => `${d.code} ${d.message}`).join('; '));
  const p = new Player(loaded.experience, modules ? { modules } : {});
  ok(p.start().ok);
  const d = new Drawing(p);
  d.mountScene('one');
  d.paint();
  return { p, d, n: (id) => d.frames.one.byLocal.get(id) };
}
// A morph (motion's own channel): a blob that blends to a star of the same structure, played on entry. needs: motion.
const MORPH_SVG = '<path id="blob" data-hsvg-kind="part" d="M0 0 L10 0 L10 10 Z" fill="#000"/><path id="star" data-hsvg-kind="part" d="M0 0 L20 0 L20 20 Z" fill="none"/>';
function withMorph(f, need = true) {
  f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('</svg>', `${MORPH_SVG}</svg>`);
  const s = f['scenes/one/scene.json'];
  s.clips.shape = { durationMs: 500, tracks: [{ id: 'blob-shape', target: 'blob', channel: 'motion.morph', to: 'star', keys: [[0, 0], [500, 1]] }] };
  s.entry = [...(s.entry || []), { id: 'play-shape', play: 'shape' }];
  if (need) f['experience.json'].needs = ['motion'];
  return f;
}
const translate = (n) => { const m = /translate\(([-\d.e]+) ([-\d.e]+)\)/.exec(n.attrs.transform || ''); return m ? [Number(m[1]), Number(m[2])] : [0, 0]; };
const scaleOf = (n) => { const m = /scale\(([-\d.e]+) /.exec(n.attrs.transform || ''); return m ? Number(m[1]) : 1; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const codes = (f) => checkExperience(mapSource(f), schemas()).diags.map(d => d.code);

export const tests = {
  // ---------- the maths ----------
  'a route is measured by length: lines, polylines and curves (6.7)'() {
    eq(pointAt(flatten('M0 0 H100 V100'), 0.75), [100, 50]);
    eq(pointAt(routeSegments({ name: 'polyline', attrs: { points: '0,0 10,0 10,10' } }), 0.25), [5, 0]);
    eq(pointAt(routeSegments({ name: 'line', attrs: { x1: '0', y1: '0', x2: '0', y2: '40' } }), 0.5), [0, 20]);
    const c = flatten(WIRE);
    eq(pointAt(c, 0), [100, 260]);
    eq(pointAt(c, 1).map(Math.round), [700, 260]);
    // a symmetric S curve passes its centre at half its length
    eq(pointAt(c, 0.5).map(v => Math.round(v)), [400, 260]);
    // relative commands and a move's further pairs (lines)
    eq(pointAt(flatten('m10 10 10 0 l0 10'), 1), [20, 20]);
    // an arc: a half circle of radius 50 from (0, 0) to (100, 0), through (50, -50) or (50, 50)
    const top = pointAt(flatten('M0 0 A50 50 0 0 1 100 0'), 0.5);
    ok(near(top[0], 50, 0.5) && near(Math.abs(top[1]), 50, 0.5), `arc middle ${top}`);
  },
  'colours blend per red, green and blue, rounded (6.7)'() {
    eq(blendHex('#000000', '#ffffff', 0.5), '#808080');
    eq(blendHex('#153b4b', '#e6af42', 0), '#153b4b');
    eq(blendHex('#153b4b', '#e6af42', 1), '#e6af42');
    eq(blendHex('#000000', '#ff0000', 1.5), '#ff0000', 'an overshoot stays inside 0..255');
  },
  'morph blends paths of the same structure, and refuses others (6.7)'() {
    eq(morphPath('M0 0 L10 0', 'M0 10 L20 10', 0.5), 'M0 5 L15 5');
    eq(morphMismatch('M0 0 L10 0', 'M0 0 L10 0 Z'), '2 commands against 3');
    let code = null;
    try { morphPath('M0 0 L1 1', 'M0 0 C1 1 2 2 3 3', 0.5); } catch (e) { code = e.code; }
    eq(code, 'E-TYPE');
  },

  // ---------- the channels in the fixture ----------
  'route: the dot\'s placement point follows the wire (6.7)'() {
    const { p, d, n } = setup();
    eq(translate(n('dot')), [100, 260], 'at 0 on the wire\'s start');
    p.advance(1000); d.paint();
    const [x, y] = pointAt(flatten(WIRE), 0.5);
    const [tx, ty] = translate(n('dot'));
    ok(near(tx, x, 1e-5) && near(ty, y, 1e-5), `half way: ${tx},${ty} against ${x},${y}`);
    p.advance(900); d.paint();
    const end = pointAt(flatten(WIRE), 0.95);
    ok(near(translate(n('dot'))[0], end[0], 1e-5));
  },
  'fill: the lamp fades through the blend and holds gold (6.7)'() {
    const { p, d, n } = setup();
    eq(n('lamp').attrs.fill, '#153b4b');
    p.advance(500); d.paint();
    eq(n('lamp').attrs.fill, blendHex('#153b4b', '#e6af42', 0.5));
    p.advance(700); d.paint();
    eq(n('lamp').attrs.fill, '#e6af42', 'the held final pose');
  },
  'stroke-width and stroke from bindings (6.7, 6.8)'() {
    const { p, d, n } = setup();
    eq([n('ring').attrs['stroke-width'], n('ring').attrs.stroke], ['2', '#153b4b']);
    for (let i = 0; i < 3; i++) ok(p.activate('one', 'sample').ok);
    d.paint();
    eq([n('ring').attrs['stroke-width'], n('ring').attrs.stroke], ['9.5', '#ed795f']);
  },
  'route is core: the dot travels with no motion module (D31); a morph without it is E-NEEDS-MISSING'() {
    const { p, d, n } = setup({ modules: [] });
    eq(d.faults, [], 'route, fill and dash draw with no capability');
    const at = translate(n('dot'));
    p.advance(500); d.paint();
    ok(JSON.stringify(translate(n('dot'))) !== JSON.stringify(at), 'the dot moved along the wire');
    const m = setup({ modules: [], edit: (f) => withMorph(f) });
    ok(m.d.faults.some(f => f.code === 'E-NEEDS-MISSING' && f.message.includes('morph')), JSON.stringify(m.d.faults));
  },
  'a clip that ends releases a fill as drawn, the theme\'s paint kept'() {
    const { p, d, n } = setup({ edit: (f) => { delete f['scenes/one/scene.json'].clips.glow.loopMode; } });
    p.advance(500); d.paint();
    ok(n('lamp').attrs.fill !== '#153b4b');
    p.advance(600); d.paint();
    eq(n('lamp').attrs.fill, '#153b4b');
  },

  // ---------- the points binding ----------
  'points: the chart line is drawn from the samples in the plot box, y upwards (6.8)'() {
    const { p, d, n } = setup();
    // 4 samples, x 0..3 into 80..400, y 0..1 into 540..380
    eq(n('line').attrs.points, '80,508 186.666667,444 293.333333,476 400,396');
    ok(p.activate('one', 'sample').ok); d.paint();
    eq(n('line').attrs.points.split(' ').length, 5);
    eq(n('line').attrs.points.split(' ')[4], '400,524', 'the new sample, 0.1');
    eq(n('line').attrs.stroke, '#168e91', 'the style is the drawing\'s');
  },
  'points: pairs, a range, values outside it on the edge, and too few points (6.8)'() {
    const { d, n } = setup({ edit: (f) => { const b = f['scenes/one/scene.json'].bindings[0]; b.draw = '[[0, -1], [5, 0.5], [10, 3]]'; b.range = { x: [0, 10], y: [0, 2] }; } });
    eq(n('line').attrs.points, '80,540 240,500 400,380');
    const few = setup({ edit: (f) => { f['scenes/one/scene.json'].bindings[0].draw = '[0.5]'; } });
    ok(few.d.faults.some(x => x.code === 'E-RANGE'), 'one point is too few');
    ok(d.faults.length === 0, JSON.stringify(d.faults));
  },

  // ---------- stop with keep ----------
  'stop with keep leaves the heart at its pose; ended fires once, interrupted (6.7)'() {
    const { p, d, n } = setup();
    p.advance(250); d.paint();
    const at = scaleOf(n('heart'));
    ok(near(at, 1.25), `pulse at 250 ms: ${at}`);
    ok(p.activate('one', 'freeze').ok);
    ok(!p.state.timers.some(t => t.clip === 'pulse'), 'the clip\'s timers go');
    p.advance(400); d.paint();
    eq(scaleOf(n('heart')), at, 'the kept pose');
    p.advance(5000); d.paint();
    eq(scaleOf(n('heart')), at, 'still kept');
  },
  'stop without keep releases the pose (6.7)'() {
    const { p, d, n } = setup({ edit: (f) => { delete f['scenes/one/scene.json'].on.frozen[0].actions[0].keep; } });
    p.advance(250); d.paint();
    ok(p.activate('one', 'freeze').ok); d.paint();
    eq(n('heart').attrs.transform, undefined);
  },
  'a kept pose gives way to another writer and to a fresh entry (6.7)'() {
    const { p, d, n } = setup({ edit: (f) => {
      const s = f['scenes/one/scene.json'];
      s.clips.beat = { durationMs: 200, tracks: [{ id: 'heart-beat', target: 'heart', channel: 'scale', keys: [[0, 1], [200, 1.1]] }] };
      s.on.frozen[0].actions.push({ id: 'play-beat', play: 'beat' });
    } });
    p.advance(250); d.paint();
    ok(p.activate('one', 'freeze').ok);
    ok(!p.state.blocks.one.clips.pulse, 'the kept run gave its only channel to beat');
    p.advance(100); d.paint();
    ok(near(scaleOf(n('heart')), 1.05), `beat writes: ${scaleOf(n('heart'))}`);
    p.advance(200); d.paint();
    eq(n('heart').attrs.transform, undefined, 'beat ended; nothing keeps the old pose');
  },
  'a kept pose waits with its paused owner'() {
    const { p, d, n } = setup();
    p.advance(250);
    ok(p.activate('one', 'freeze').ok);
    p.holdTime('one', 1000);
    d.paint();
    ok(near(scaleOf(n('heart')), 1.25));
  },
  'the ended event of a kept clip says interrupted'() {
    const { p } = setup({ edit: (f) => {
      const s = f['scenes/one/scene.json'];
      s.values.endedHow = { type: 'string', maxLength: 16, initial: '' };
      s.on['ended:pulse'] = [{ id: 'hear-end', actions: [{ id: 'note-end', set: 'endedHow', to: "event.interrupted ? 'interrupted' : 'natural'" }] }];
    } });
    p.advance(250);
    ok(p.activate('one', 'freeze').ok);
    eq(p.state.blocks.one.values.endedHow, 'interrupted');
  },

  // ---------- a fit's steps order (7.6) ----------
  'steps shrink then wrap: sizes on unwrapped lines first, then wrap at the smallest (7.6)'() {
    // Each character is half the font size wide; room 100, height 60; sizes 20 down to 10.
    const measure = (px) => (s) => s.length * px * 0.5;
    const text = 'abcd efgh ijkl'; // 14 characters: one line fits at 14 px (98)
    const wrapFirst = searchFit(text, { fontPx: 20, minFontPx: 10, maxLines: 2 }, 20, measure, 100, 60);
    eq([wrapFirst.px, wrapFirst.lines], [20, ['abcd efgh', 'ijkl']]);
    const shrinkFirst = searchFit(text, { fontPx: 20, minFontPx: 10, maxLines: 2, steps: ['shrink', 'wrap'] }, 20, measure, 100, 60);
    eq([shrinkFirst.px, shrinkFirst.lines, shrinkFirst.outcome], [14, ['abcd efgh ijkl'], 'fitted']);
    // too long for one line at 10 px: wraps at 10 px
    const long = searchFit('abcd efgh ijkl mnop qrst', { fontPx: 20, minFontPx: 10, maxLines: 2, steps: ['shrink', 'wrap'] }, 20, measure, 100, 60);
    eq([long.px, long.lines, long.outcome], [10, ['abcd efgh ijkl mnop', 'qrst'], 'fitted']);
    const none = searchFit('abcdefghijklmnopqrstuvwxyz', { fontPx: 20, minFontPx: 10, steps: ['shrink', 'wrap'] }, 20, measure, 100, 60);
    eq(none.outcome, 'incomplete');
  },

  // ---------- packing ----------
  async 'the packer ships the motion module only when needs names motion (10.11)'() {
    const write = (f, dir) => { for (const [k, v] of Object.entries(f)) { const p = path.join(dir, ...k.split('/')); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof v === 'string' ? v : JSON.stringify(v, null, 1)); } };
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'w5m-'));
    try {
      write(withMorph(structuredClone(files)), path.join(tmp, 'a', 'motion-lab'));
      const page = fs.readFileSync((await pack(path.join(tmp, 'a', 'motion-lab'), path.join(tmp, 'out-with'))).htmlPath, 'utf8');
      ok(page.includes('function morphPath'), 'the motion module is in the page');
      // The fixture itself (route, colour and dash: all core) needs nothing and carries no motion module.
      write(files, path.join(tmp, 'b', 'motion-lab'));
      const bare = (await pack(path.join(tmp, 'b', 'motion-lab'), path.join(tmp, 'out-without')).catch(e => { throw new Error(JSON.stringify(e.diags)); })).htmlPath;
      ok(!fs.readFileSync(bare, 'utf8').includes('function morphPath'), 'no motion module without the need');
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  },

  // ---------- the checker ----------
  'the fixture checks clean'() { eq(codes(files), []); },
  'the checker: a route that is not drawn, a route target with no pivot (6.7)'() {
    eq(codes({ ...files, 'scenes/one/scene.json': { ...files['scenes/one/scene.json'], clips: { ...files['scenes/one/scene.json'].clips, travel: { durationMs: 2000, loop: true, tracks: [{ id: 'dot-travel', target: 'dot', channel: 'move', axis: 'route', route: 'plot', keys: [[0, 0], [2000, 1]] }] } } } }), ['E-REF-UNKNOWN', 'W-PLACE-UNUSED'], 'the wire is now named by nothing (D28)');
    const f = structuredClone(files);
    f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('id="dot" data-hsvg-kind="part" data-hsvg-pivot="0 0"', 'id="dot" data-hsvg-kind="part"');
    eq(codes(f), ['E-PIVOT']);
  },
  'the checker: fill on a part with no fill, a fill that is not a colour, progress over 1 (6.7)'() {
    const f = structuredClone(files);
    f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('r="40" fill="#153b4b"', 'r="40" fill="none" stroke="#000"');
    eq(codes(f), ['E-TYPE']);
    const g = structuredClone(files);
    g['scenes/one/scene.json'].clips.glow.tracks[0].keys[1][1] = "'gold'";
    eq(codes(g), ['E-TYPE']);
    const h = structuredClone(files);
    h['scenes/one/scene.json'].clips.travel.tracks[0].keys[1][1] = 2;
    eq(codes(h), ['E-RANGE']);
  },
  'the checker: morph paths of another structure, points on a rect (6.7, 6.8)'() {
    const f = structuredClone(files);
    f['experience.json'].needs = ['motion'];
    f['scenes/one/one.svg'] = f['scenes/one/one.svg'].replace('</svg>', '<path id="blob" data-hsvg-kind="part" d="M0 0 L10 0 L10 10 Z" fill="#000"/><path id="star" data-hsvg-kind="part" d="M0 0 L10 0 Z" fill="none"/></svg>');
    f['scenes/one/scene.json'].clips.shape = { durationMs: 500, tracks: [{ id: 'blob-shape', target: 'blob', channel: 'motion.morph', to: 'star', keys: [[0, 0], [500, 1]] }] };
    eq(codes(f), ['E-TYPE']);
    const g = structuredClone(files);
    g['scenes/one/scene.json'].bindings[0].target = 'plot';
    eq(codes(g), ['E-PLACE']);
  },
  'the checker: a morph without needs motion is refused; route needs nothing (D31)'() {
    eq(codes(files), [], 'route without needs');
    const f = withMorph(structuredClone(files), false);
    ok(codes(f).includes('E-NEEDS-MISSING'), codes(f).join(' '));
    eq(codes(withMorph(structuredClone(files))), [], 'with needs motion');
  },
};
