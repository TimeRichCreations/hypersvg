// Layout plans live and baked (7.4, 7.5, A7.1, 6.6). The proof fixture (tests/plan-fixture): an ad scene
// whose plan-only layout holds an offer compound with a plan (a title, a photo share 30 to 70, copy), right at
// 300x250, 728x90, 160x600, 320x50 and 970x250. Live (the solver at play) and baked (the packer's derived frames,
// shown by a player without the fit capability) give the same boxes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadExperience, folderSource } from '../src/load.mjs';
import { Player } from '../src/story.mjs';
import { Drawing } from '../src/drawing.mjs';
import { chooseLayout, aspectsOf, shapeMapsOf, parseSize } from '../src/layout.mjs';
import { installCapabilities, registered } from '../src/capabilities.mjs';
import * as P from '../src/plan.mjs';
import { bakePlans, pack, capabilityModules } from '../tools/pack.mjs';
import { checkExperience } from '../check/index.mjs';
import { makeDocumentChecker } from '../schema/check-document.mjs';
import zlib from 'node:zlib';
import { FORMAT } from '../src/limits.mjs';
import { repo, schemas, mapSource, eq, ok } from './helpers.mjs';
import { recordOf } from '../src/marks.mjs';

const FIXTURE = path.join(repo, 'engine', 'v2', 'tests', 'plan-fixture');
export const SIZES = ['300x250', '728x90', '160x600', '320x50', '970x250'];
const ITEMS = ['ad__offer__offer-title', 'ad__offer__offer-copy', 'ad__offer__photo'];

// The fixture's files as {member: text}.
export function fixtureFiles(dir = FIXTURE) {
  const out = {};
  const walk = (d, pre) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) walk(path.join(d, e.name), `${pre}${e.name}/`); else out[pre + e.name] = fs.readFileSync(path.join(d, e.name), 'utf8'); } };
  walk(dir, '');
  return out;
}
const load = (files) => { const l = loadExperience(mapSource(files), schemas()); ok(l.experience, JSON.stringify(l.diags.slice(0, 3))); return l.experience; };
const baseExperience = async () => loadExperience(await folderSource(FIXTURE), schemas()).experience;

// A drawing of the start scene at a size, as the player builds one.
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
// Every mounted node by its id.
function byId(root) {
  const m = new Map();
  const walk = (n, parent) => { if (!n.name) return; n.parent = parent; if (n.attrs.id) m.set(n.attrs.id, n); n.children.forEach(c => walk(c, n)); };
  walk(root, null);
  return m;
}
// A node's box in CSS pixels of the output: its drawing-coordinate box mapped by the root's viewBox (meet, centred).
// A nested <svg> (a mounted use) shows only its viewBox when its own clip says so; here the plan's clip groups are
// applied: the box is cut to every clip-path rectangle above it.
export function screenBox(root, n, space) {
  let b = P.measure(n);
  if (!b) return null;
  for (let x = n.parent; x; x = x.parent) {
    const ref = /url\(#([^)]+)\)/.exec(x.attrs?.['clip-path'] || '')?.[1];
    if (!ref) continue;
    const cp = byId(root).get(ref);
    const r = cp?.children.find(c => c.name === 'rect');
    if (!r) continue;
    const c = P.mapBox(P.worldOf(x), { x: +r.attrs.x, y: +r.attrs.y, width: +r.attrs.width, height: +r.attrs.height });
    const x0 = Math.max(b.x, c.x); const y0 = Math.max(b.y, c.y);
    b = { x: x0, y: y0, width: Math.max(0, Math.min(b.x + b.width, c.x + c.width) - x0), height: Math.max(0, Math.min(b.y + b.height, c.y + c.height) - y0) };
  }
  const vb = P.viewBoxOf(root);
  const k = Math.min(space.width / vb.width, space.height / vb.height);
  const ox = (space.width - vb.width * k) / 2 - vb.x * k; const oy = (space.height - vb.height * k) / 2 - vb.y * k;
  return { x: b.x * k + ox, y: b.y * k + oy, width: b.width * k, height: b.height * k };
}
const near = (a, b, tol, msg) => {
  for (const k of ['x', 'y', 'width', 'height']) if (Math.abs(a[k] - b[k]) > tol) throw new Error(`${msg}: ${k} ${a[k]} against ${b[k]} (tolerance ${tol})`);
};
const bakedExperience = async () => {
  const base = await baseExperience();
  const out = bakePlans(base, { date: '2026-11-07T00:00:00Z' });
  return { files: { ...fixtureFiles(), ...out.texts }, out };
};

export const tests = {
  'live: the offer is right at the five sizes (complete, items inside their root, shares in bounds)'() {
    return (async () => {
      const exp = await baseExperience();
      for (const size of SIZES) {
        const { d } = drawAt(exp, size, { planSolver: P });
        const offer = d.plans['ad/offer'];
        ok(offer, `${size}: the offer's plan is solved`);
        eq(offer.status, 'complete', `${size}: ${JSON.stringify(offer.unmet)}`);
        eq(offer.layout, parseSize(size).width / parseSize(size).height >= 1.6 ? 'row' : 'stacked', `${size}: the layout follows the shape`);
        const root = { x: offer.viewBox.x, y: offer.viewBox.y, width: offer.viewBox.width, height: offer.viewBox.height };
        for (const b of offer.boxes) ok(P.inside(b.shown, root), `${size}: ${b.item} inside the root place`);
        for (const s of offer.shares) ok(s.effective >= 30 && s.effective <= 70, `${size}: share ${s.id} in bounds`);
        // Items do not overlap (in the screen's pixels).
        const ids = byId(d.root);
        const boxes = ['ad__offer__offer-title', 'ad__offer__offer-copy', 'ad__offer__photo'].map(id => screenBox(d.root, ids.get(id), parseSize(size)));
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]; const b = boxes[j];
          ok(a.x + a.width <= b.x + 0.01 || b.x + b.width <= a.x + 0.01 || a.y + a.height <= b.y + 0.01 || b.y + b.height <= a.y + 0.01, `${size}: items ${i} and ${j} overlap`);
        }
        // Everything stays inside the output.
        for (const id of ITEMS) { const b = screenBox(d.root, ids.get(id), parseSize(size)); ok(b.x >= -0.5 && b.y >= -0.5 && b.x + b.width <= parseSize(size).width + 0.5 && b.y + b.height <= parseSize(size).height + 0.5, `${size}: ${id} inside the output ${JSON.stringify(b)}`); }
      }
    })();
  },
  'live: same inputs, same output'() {
    return (async () => {
      const exp = await baseExperience();
      const a = drawAt(exp, '728x90', { planSolver: P }).d; const b = drawAt(exp, '728x90', { planSolver: P }).d;
      eq(a.serialize(), b.serialize());
    })();
  },
  'plan-only: the viewBox grows about its centre, the root place edge to edge grows with it'() {
    return (async () => {
      const { d } = drawAt(await baseExperience(), '728x90', { planSolver: P });
      eq(d.plans.ad.viewBox, { x: -861.111111, y: 0, width: 2022.222222, height: 250 });
      const place = byId(d.root).get('ad__ad-box');
      eq([place.attrs.x, place.attrs.width], ['-861.111111', '2022.222222']);
      eq(d.frames.ad.scale, 90 / 250, 'the design scale is the space over the grown viewBox');
    })();
  },
  'a use item: its slot takes the solved box before the use mounts; cover is clipped to its cell'() {
    return (async () => {
      const { d } = drawAt(await baseExperience(), '300x250', { planSolver: P });
      const photo = d.plans['ad/offer'].boxes.find(b => b.item === 'use:photo');
      ok(photo.clip && photo.box.height > photo.clip.height, 'the photo covers its cell and is cut to it');
      const slot = byId(d.root).get('ad__offer__photo-slot');
      ok(slot.parent.attrs['clip-path'], 'the slot sits in a clipped group');
      eq(d.choices['ad/offer'], { id: 'stacked', why: 'order' });
    })();
  },
  'baked: one derived frame per block and size, each with a fit receipt; the files pass the checker'() {
    return (async () => {
      const { files, out } = await bakedExperience();
      eq(out.receipts.filter(r => r.subject === 'scene:ad').map(r => r.selected.size).sort(), [...SIZES].sort());
      eq(out.receipts.filter(r => r.subject === 'document:offer').length, 5);
      ok(out.receipts.every(r => r.status === 'pass' && r.run === 'fit'), 'every size passes');
      const scene = JSON.parse(files['scenes/ad/scene.json']);
      const derived = scene.layouts.filter(l => l.size);
      eq(derived.length, 5);
      ok(derived.every(l => JSON.stringify(l.layoutPlan) === JSON.stringify(scene.layouts[0].layoutPlan)), 'a derived layout keeps its plan');
      ok(/<metadata>\{"derived":"derived"/.test(files[`scenes/ad/${derived[0].drawing}`]));
      const checked = checkExperience(mapSource(files), schemas());
      eq(checked.diags.filter(d => d.code !== 'W-PLAN-SCALE').map(x => `${x.code} ${x.file} ${x.message}`), [], 'the baked files pass the checker (the fixture\'s W-PLAN-SCALE aside)');
      const dc = makeDocumentChecker(schemas());
      for (const r of out.receipts) { const res = dc.check(JSON.stringify(r), { needs: [], file: r.id }); eq(res.diags.filter(x => x.code.startsWith('E-')).map(x => `${x.code} ${x.path} ${x.message}`), [], `receipt ${r.id}`); }
    })();
  },
  'live and baked at the same size give the same boxes'() {
    return (async () => {
      const exp = await baseExperience();
      const { files } = await bakedExperience();
      const bakedExp = load(files);
      for (const size of SIZES) {
        const live = drawAt(exp, size, { planSolver: P });
        const baked = drawAt(bakedExp, size);
        ok(/-\d+x\d+$/.test(baked.pick.id) && baked.pick.why === 'size', `${size}: the baked page shows the derived frame (${baked.pick.id})`);
        ok(!baked.d.plans?.ad, `${size}: nothing is solved on the baked page`);
        const li = byId(live.d.root); const bi = byId(baked.d.root);
        for (const id of ITEMS) near(screenBox(baked.d.root, bi.get(id), live.space), screenBox(live.d.root, li.get(id), live.space), 0.5, `${size} ${id}`);
      }
    })();
  },
  'baked, at a size not declared: the nearest derived frame by aspect, scaled uniformly'() {
    return (async () => {
      const { files } = await bakedExperience();
      const { d, pick } = drawAt(load(files), '600x500');
      eq(pick.id, 'fill', 'the plan-only layout applies by shape');
      const root = d.frames.ad.root;
      ok(recordOf(root).derived === 'derived' && root.attrs.viewBox === '0 0 300 250', 'the 300x250 frame is nearest by aspect');
      eq(d.frames.ad.scale, 2);
    })();
  },
  'a page that needs fit solves live; one that does not carries no solver'() {
    return (async () => {
      eq(capabilityModules(['fit']).map(c => c.id), ['fit']);
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-a1-'));
      try {
        const plain = await pack(FIXTURE, path.join(tmp, 'baked'), { date: '2026-11-07T00:00:00Z' });
        ok(!plain.files.some(f => f.endsWith('src/plan.mjs')) && !plain.capabilities.includes('fit'), 'no solver in a baked page');
        eq(plain.baked.receipts.length, 10);
        ok(fs.existsSync(path.join(tmp, 'baked', 'evidence', 'index.json')), 'the receipts are written beside the page');
        const live = path.join(tmp, 'live-src');
        fs.cpSync(FIXTURE, live, { recursive: true });
        const e = JSON.parse(fs.readFileSync(path.join(live, 'experience.json'), 'utf8')); e.needs = ['fit'];
        fs.writeFileSync(path.join(live, 'experience.json'), JSON.stringify(e, null, 2));
        const lp = await pack(live, path.join(tmp, 'live'));
        ok(lp.files.some(f => f.endsWith('src/plan.mjs')) && lp.capabilities.includes('fit'), 'the solver is in a live page');
        eq(lp.baked.receipts.length, 0, 'a live block is not baked');
        // In the engine: fit installs only when needs names it, and the drawing then solves.
        const l = loadExperience(await folderSource(live), schemas()).experience;
        const p = new Player(l); ok(p.start().ok);
        ok(p.planSolver && typeof p.planSolver.solve === 'function', 'the fit capability exposes the solver');
        const d = new Drawing(p, { layouts: {} }); d.mountScene('ad', 'fill', { width: 728, height: 90 });
        eq(d.plans['ad/offer'].status, 'complete');
        const q = new Player(await baseExperience()); ok(q.start().ok);
        ok(!q.planSolver, 'no fit, no solver');
        ok(registered().has('fit') && installCapabilities, 'the module registers itself');
      } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
    })();
  },
  'a repeated use under a plan fills cells, capacity the list, not drawn slots'() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" data-hsvg-version="2.0" data-hsvg-kind="screen"><rect id="answers-box" data-hsvg-kind="part" data-hsvg-fit="" x="0" y="0" width="200" height="100" fill="none"/></svg>`;
    const card = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" data-hsvg-version="2.0"><g id="card" data-hsvg-kind="component"><rect id="card__face" data-hsvg-kind="part" width="50" height="50"/></g></svg>`;
    const exp = {
      doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', needs: ['fit'], story: { start: 'one', scenes: { one: 'one.json' } } },
      words: { en: {} }, data: {},
      scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg',
        values: { rows: { type: 'array', initial: ['a', 'b', 'c'], maxItems: 8, items: { type: 'string' } } },
        layouts: [{ id: 'grid', shape: { minAspect: 0 }, layoutPlan: { place: 'answers-box', kind: 'grid', columns: 2, gap: 0, repeat: 'answers' } }],
        uses: [{ id: 'answers', use: 'card', into: 'answers-box', items: 'rows', key: 'item' }] },
      drawings: { main: { text: svg } }, words: {} } },
      blocks: { card: { doc: { format: 'hsvg/2.0', kind: 'component', id: 'card', drawing: 'card.svg' }, drawings: { main: { text: card } }, words: {} } },
    };
    const p = new Player(exp);
    const r = p.start();
    ok(r.ok, JSON.stringify(r.fault));
    const d = new Drawing(p, { planSolver: P });
    d.mountScene('one', 'grid', { width: 200, height: 100 });
    const keys = p.state.blocks.one.uses.find(u => u.id === 'answers').keys;
    eq(d.plans.one.boxes.map(b => b.item), keys.map(k => `use:answers[${k}]`));
    eq(d.plans.one.boxes.map(b => b.cell), [{ x: 0, y: 0, width: 100, height: 50 }, { x: 100, y: 0, width: 100, height: 50 }, { x: 0, y: 50, width: 100, height: 50 }]);
    eq(d.faults, [], 'no capacity fault: the plan makes a cell for each row');
    ok(keys.every(k => d.frames[`one/answers[${k}]`]), 'each row is mounted');
  },
  "the fit capability's code (the module and the solver) is within capabilityBundleBytes, gzip level 9 (10.11)"() {
    const text = ['capabilities/fit.mjs', 'plan.mjs'].map(f => fs.readFileSync(path.join(repo, 'engine', 'v2', 'src', ...f.split('/')), 'utf8')).join('\n');
    const n = zlib.gzipSync(Buffer.from(text), { level: 9 }).length;
    ok(n <= FORMAT.capabilityBundleBytes, `fit: ${n} bytes gzip -9, over ${FORMAT.capabilityBundleBytes}`);
  },
};
