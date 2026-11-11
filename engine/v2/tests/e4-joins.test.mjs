// The joins batch 2 asked for. One test or more per item.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repo, eq, ok, addonCode } from './helpers.mjs';
import { engineSizes, sizeFindings } from '../tools/pack.mjs';
import { FORMAT } from '../src/limits.mjs';

const readJson = (...p) => JSON.parse(fs.readFileSync(path.join(repo, ...p), 'utf8'));

export const tests = {
  // ---- item 2: size ----
  'size: an engine over its limit is E-ENGINE-SIZE, naming the limit (10.11)'() {
    const f = sizeFindings({ core: { gzip9: 1, max: 0, over: true }, capabilities: [{ id: 'fit', gzip9: 10001, max: 10000, over: true }], modules: [{ id: 'chess@0.1.0', gzip9: 10001, max: 10000, over: true }] });
    eq(f.map(d => [d.code, d.limit, d.path]), [['E-ENGINE-SIZE', 'coreBundleBytes', 'core'], ['E-ENGINE-SIZE', 'capabilityBundleBytes', 'capabilities/fit'], ['E-ENGINE-SIZE', 'capabilityBundleBytes', 'modules/chess@0.1.0']]);
    const code = readJson('spec', '2.0', 'errors.json').codes.find(c => c.code === 'E-ENGINE-SIZE');
    ok(code && code.where.includes('10.11'), 'E-ENGINE-SIZE is in errors.json, at 10.11');
  },
  'size: each logic module is measured against capabilityBundleBytes'() {
    const s = engineSizes([], ['chess@0.1.0', 'chess-opponent@0.1.0']);
    eq(s.modules.map(m => m.id), ['chess-opponent@0.1.0', 'chess@0.1.0']);
    for (const m of s.modules) ok(m.max === FORMAT.capabilityBundleBytes && m.gzip9 > 0 && !m.over, `${m.id}: ${m.gzip9}`);
  },
};

// ---- item 3: modules and seats ----
import { loadExperience, folderSource } from '../src/load.mjs';
import { Player as BasePlayer } from '../src/story.mjs';
import { granting } from './helpers.mjs';
const Player = granting(BasePlayer); // a host that gives what the experience asks (D31: no profile, no grant)
import { modulePort } from '../src/host.mjs';
import { hostLock } from '../src/modules.mjs';
import { schemas } from './helpers.mjs';
import '../src/capabilities/all.mjs';
await addonCode('../modules/chess/index.mjs', import.meta.url);
await addonCode('../modules/chess-opponent/index.mjs', import.meta.url);
const { folder: boardFolder } = await addonCode('./board-game-make.mjs', import.meta.url) ?? {}; // an add-on test helper
import { agentDoor } from '../tools/change/play.mjs';
import { pack, seatPrograms } from '../tools/pack.mjs';

const LOCK = readJson('engine', 'v2', 'modules', 'lock.json');
let board;
async function boardGame(change = () => {}, capabilities = { chess: modulePort({ lock: LOCK }), 'chess-opponent': modulePort({ lock: LOCK }), seats: modulePort({ lock: LOCK }) }) {
  board ??= loadExperience(await folderSource(boardFolder), schemas());
  const exp = structuredClone(board.experience);
  change(exp.doc);
  return new Player(exp, { capabilities });
}
Object.assign(tests, {
  async 'modules: a module needs names that no package or host carries is E-MODULE-REVIEW at mount'() {
    let e = null;
    try { await boardGame(d => { d.needs = [...d.needs, 'ghost@1.0.0']; }); } catch (x) { e = x; }
    ok(e && e.code === 'E-MODULE-REVIEW' && /ghost@1\.0\.0/.test(e.message), `mount refuses: ${e && e.message}`);
  },
  'modules: chess-opponent is a registered module with its manifest; the board game names it in needs'() {
    const reg = readJson('spec', '2.0', 'capabilities.json').capabilities.find(c => c.name === 'chess-opponent');
    eq([reg.kind, reg.contract, reg.needs, reg.exports, reg.manifest], ['module', 'module', 'chess-opponent@0.1.0', ['chess-opponent.choose'], 'capabilities/chess-opponent.json']);
    const man = readJson('spec', '2.0', 'capabilities', 'chess-opponent.json');
    eq(Object.keys(man.grammar.exports), ['choose']);
    const exp = readJson('examples', '2.0-board-game', 'experience.json');
    ok(exp.needs.includes('chess-opponent@0.1.0'), 'needs names the program');
    eq(exp.addons.seats.seats.black.fillers, ['program', 'human', 'agent']);
  },
  async 'seats: with the page\'s own lock, the black seat starts with its program and plays (a packed page)'() {
    hostLock(LOCK);
    try {
      const p = await boardGame(() => {}, { chess: modulePort({ lock: LOCK }) });
      const r = p.start(); ok(r.ok, JSON.stringify(r));
      eq(p.seats.occupant('black'), { filler: 'program', who: 'program:chess-opponent' });
      for (const sq of ['e2', 'e4']) ok(p.activate('game', 'board', sq).ok);
      p.advance(1000);
      eq(p.read('game', 'turn'), 'white', 'the program moved black with the page\'s lock');
    } finally { hostLock(null); }
  },
  'seats: the packer carries the modules its seats name'() {
    eq(seatPrograms({ addons: { seats: { seats: { b: { program: 'chess-opponent' }, w: { fallback: { program: 'chess-opponent' } } } } }, about: { trust: { pins: { 'chess-opponent@0.1.0': 'x' } } } }), ['chess-opponent@0.1.0']);
    eq(seatPrograms({ addons: { seats: { seats: { b: { program: 'nobody' } } } }, about: { trust: { pins: {} } } }), []);
  },
  async 'seats: an input from the agent door goes through requestAtPlay and leaves a receipt'() {
    const p = await boardGame();
    ok(p.start().ok);
    ok(p.seats.host('white', 'agent').ok);
    const conn = p.seats.connect('agent:ada');
    const receipts = [];
    const d = agentDoor(p, conn, 'agent:ada', { schemas: schemas(), receipts, now: '2026-11-07T00:00:00Z' });
    eq(d.join('white'), { ok: true });
    for (const sq of ['e2', 'e4']) {
      const e = d.legal('white').entries.find(x => x.payload?.option === sq);
      const r = d.act('white', e.key);
      ok(r.ok, JSON.stringify(r));
    }
    eq(p.read('game', 'lastMove'), 'e2e4');
    eq(receipts.map(r => [r.run, r.status, r.subject, r.by.source, r.by.right, r.changes[0].address]), [
      ['change', 'pass', 'document:board-game', 'seat', 'white', 'board-game/game/board'],
      ['change', 'pass', 'document:board-game', 'seat', 'white', 'board-game/game/board']]);
    ok(/^revision:\d+$/.test(receipts[1].digest) && /^revision:\d+$/.test(receipts[1].previous), 'a play receipt names revision:<n>');
    // A key from no list: refused at reach, nothing runs.
    const bad = d.act('white', 'l99:1');
    eq([bad.ok, bad.receipt.status, bad.receipt.verdicts.reach], [false, 'fail', 'fail']);
    // Black's input on white's connection: refused (rights, E-SEAT-INPUT).
    const other = d.act('black', 'l1:1');
    eq(other.ok, false);
  },
});

// ---- item 4: tiers and content ----
const { resolveRuns } = await addonCode('../src/richtext.mjs', import.meta.url) ?? {};
import { wordingAt } from '../src/ladder.mjs';
Object.assign(tests, {
  'tiers: resolveRuns takes the nearest longer tier, else the nearer shorter, as wordingAt does (7.9)'() {
    const s = [{ text: 's' }]; const m = [{ text: 'm' }]; const r = [{ text: 'r' }];
    for (const [v, tier] of [[{ short: s, rich: r }, 'medium'], [{ short: s, medium: m }, 'rich'], [{ medium: m }, 'short'], [{ short: s, medium: m, rich: r }, 'medium']]) {
      eq(resolveRuns(v, { tier }), wordingAt(v, tier), `${JSON.stringify(v)} at ${tier}`);
    }
    eq(resolveRuns({ short: s, rich: r }, { tier: 'medium' }), r);
  },
});
import { hostApi } from '../src/host.mjs';
async function lines() {
  const r = loadExperience(await folderSource(path.join(repo, 'engine', 'v2', 'tests', 'lines-fixture')), schemas());
  return structuredClone(r.experience);
}
Object.assign(tests, {
  async 'tiers: a component\'s initial takes a tier object; the block reads its tier\'s wording'() {
    const exp = await lines();
    const key = Object.keys(exp.blocks).find(k => exp.blocks[k].doc.id === 'parrot');
    exp.blocks[key].doc.inputs.greeting.initial = { short: 'hi', rich: 'hello there' };
    const p = new Player(exp, {});
    const r = p.start(); ok(r.ok, JSON.stringify(r));
    const at = Object.keys(p.state.blocks).find(a => a.endsWith('/polly'));
    eq(p.state.blocks[at].inputs.greeting, { short: 'hi', rich: 'hello there' }, 'the block keeps the object');
    ok(['hi', 'hello there'].includes(p.scope(at).name('greeting')), 'a read gives one wording');
    exp.blocks[key].doc.inputs.greeting.initial = { short: 'x'.repeat(60) };
    const bad = new Player(structuredClone(exp), {}).start();
    eq(bad.fault?.code, 'E-RANGE', 'each wording is checked');
  },
  async 'tiers: host.set accepts a tier or language object on a content field, each wording checked (10.6)'() {
    const exp = await lines();
    exp.doc.inputs = { ...(exp.doc.inputs || {}), headline: { kind: 'content', type: 'string', contentType: 'text', maxLength: 20, initial: 'Hi' } };
    const p = new Player(exp, {}); ok(p.start().ok);
    const h = hostApi(p);
    h.set('headline', { short: 'Hi', rich: 'Hello there' });
    eq(h.read('headline'), { short: 'Hi', rich: 'Hello there' }, 'read returns the stored value');
    h.set('headline', { en: 'Hello', es: 'Hola' });
    let e = null; try { h.set('headline', { short: 'x'.repeat(30) }); } catch (x) { e = x; }
    eq(e?.code, 'E-RANGE');
    e = null; try { h.set('headline', { nope: 'x' }); } catch (x) { e = x; }
    eq(e?.code, 'E-TYPE', 'an object that is neither is refused');
  },
  async 'spoken holds line, text and word when idle: "", "" and -1 (5.5)'() {
    const p = new Player(await lines(), {}); ok(p.start().ok);
    const at = Object.keys(p.state.blocks).find(a => a.endsWith('/polly'));
    eq(p.scope(at).name('spoken'), { line: '', text: '', word: -1 });
  },
});
import { checkExperience } from '../check/index.mjs';
import { mapSource } from './helpers.mjs';
// A fixture folder as a map of files (text), changed by fn(map of parsed JSON by path).
export function folderMap(dir, fn = () => {}) {
  const out = {};
  const walk = (d, rel) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); const r = rel ? `${rel}/${e.name}` : e.name; if (e.isDirectory()) walk(p, r); else if (/\.(json|svg|csv)$/.test(e.name)) out[r] = fs.readFileSync(p, 'utf8'); } };
  walk(dir, '');
  const json = Object.fromEntries(Object.entries(out).filter(([k]) => k.endsWith('.json')).map(([k, v]) => [k, JSON.parse(v)]));
  fn(json);
  for (const [k, v] of Object.entries(json)) out[k] = JSON.stringify(v);
  return out;
}
const checkCodes = (files) => checkExperience(mapSource(files), schemas()).diags.map(d => `${d.code} ${d.path}`);
Object.assign(tests, {
  'tiers: an empty initial of a required text field is E-CONTENT-REQUIRED; required: false is fine'() {
    const dir = path.join(repo, 'engine', 'v2', 'tests', 'lines-fixture');
    const set = (decl) => (j) => { Object.assign(j['components/parrot/component.json'].inputs.greeting, decl); };
    eq(checkCodes(folderMap(dir)).filter(c => c.startsWith('E-')), []);
    eq(checkCodes(folderMap(dir, set({ initial: '' }))).filter(c => c.startsWith('E-CONTENT')), ['E-CONTENT-REQUIRED /inputs/greeting/initial']);
    eq(checkCodes(folderMap(dir, set({ initial: '', required: false }))).filter(c => c.startsWith('E-CONTENT')), []);
  },
  // The upgrade's half (it writes an empty required field required: false) is tested beside the upgrade tool:
  // docs/spec-2.0-work/tools/upgrade/empty-required.test.mjs (only the upgrade tests reach docs/ from here).
});
// The ad studio's sample ad (a kit experience) as a map of files, its kit under kits/, changed by fn(json by path).
function studioAd(fn = () => {}) {
  const root = path.join(repo, 'examples', '2.0-ad-studio');
  const a = folderMap(path.join(root, 'ad'));
  const k = folderMap(path.join(root, 'kits'));
  const files = { ...a, ...Object.fromEntries(Object.entries(k).map(([p, v]) => [`kits/${p}`, v])) };
  const json = Object.fromEntries(Object.entries(files).filter(([p]) => p.endsWith('.json')).map(([p, v]) => [p, JSON.parse(v)]));
  fn(json);
  for (const [p, v] of Object.entries(json)) files[p] = JSON.stringify(v);
  return files;
}
Object.assign(tests, {
  async 'kits: a one-name formula with keeps the input\'s declaration; the block holds the tier object (A4 Request 1)'() {
    const l = loadExperience(mapSource(studioAd()), schemas());
    const d = l.experience.scenes.ad.doc;
    eq([d.inputs.legalText.from, d.inputs.legalText.required, d.inputs.bodyText.from], ['legal', false, 'body']);
    ok(!d.computed || !('legalText' in d.computed), 'not a computed value');
    const p = new Player(structuredClone(l.experience), {});
    const r = p.start(); ok(r.ok, JSON.stringify(r));
    const sc = p.state.blocks.ad;
    eq(Object.keys(sc.inputs.legalText).sort(), ['rich', 'short'], 'the scene holds the tier object');
    // A host change of the kit input reaches the scene's input, heard as changed:legalText.
    p.setInput('legal', { short: { en: 'Ends Sunday.' } });
    eq(p.state.blocks.ad.inputs.legalText, { short: { en: 'Ends Sunday.' } });
    // A component use's one-name with passes a tiered field through whole (the button's label).
    const cta = Object.keys(p.state.blocks).find(a => a.endsWith('/cta'));
    const label = p.state.blocks[cta].inputs.label;
    const ctaKit = l.experience.doc.inputs.cta.initial;
    if (ctaKit !== null && typeof ctaKit === 'object') eq(label, ctaKit, 'the label keeps the tier object');
  },
  'kits: the checker sees the declaration: field:<name> resolves for a fed input'() {
    const rule = (subject) => (j) => { j['kits/studio-ad/scenes/ad/scene.json'].rules.push({ id: 'legal-fits-2', kind: 'fits', subject, strength: 'give-way', priority: 0.1, steps: ['short', 'remove'], floor: { minTextPx: 12 } }); };
    eq(checkCodes(studioAd(rule('field:legalText'))).filter(c => /E-RULE-SUBJECT|E-REF/.test(c)), []);
    ok(checkCodes(studioAd(rule('field:nothingHere'))).some(c => c.startsWith('E-RULE-SUBJECT')), 'an unknown field still fails');
  },
});
import { textStart, textLayout } from '../src/ladder.mjs';
Object.assign(tests, {
  'ladder: a size below the floor never fits, so an optional text below its floor is removed (8.4)'() {
    const measure = () => (s) => s.length; // narrow enough to fit any box
    let st = textStart({ wordings: ['Offer ends Sunday.'], fit: { minFontPx: 12, maxLines: 3 }, drawnPx: 2, floorUnits: 12, optional: true, steps: ['short', 'remove'] });
    eq(textLayout(st, measure, 1000, 1000).fits, false, 'drawn at 2 with a floor of 12');
    st = { ...st, removed: true };
    eq(textLayout(st, measure, 1000, 1000).fits, true, 'removed, it holds');
    const big = textStart({ wordings: ['Offer'], fit: { minFontPx: 12, maxLines: 1 }, drawnPx: 16, floorUnits: 12, steps: [] });
    eq(textLayout(big, measure, 1000, 1000).fits, true);
  },
});

// ---- item 5: baking ----
import { bakePlans } from '../tools/pack.mjs';
const planDir = path.join(repo, 'engine', 'v2', 'tests', 'plan-fixture');
const bakedSizes = (files) => {
  const { experience } = loadExperience(mapSource(files), schemas());
  return [...new Set(bakePlans(experience, { date: '2026-11-07T00:00:00Z' }).receipts.filter(r => r.subject.startsWith('scene:')).map(r => r.selected.size))].sort();
};
Object.assign(tests, {
  'bake: an experience\'s own sizes narrow the bake; without them, every size of its scenes\' axes (A7.1)'() {
    const SC = 'scenes/ad/scene.json'; const EXP = 'experience.json';
    const scenes5 = (j) => { j[SC].axes = structuredClone(j[EXP].axes); };
    eq(bakedSizes(folderMap(planDir, scenes5)), ['160x600', '300x250', '320x50', '728x90', '970x250']);
    eq(bakedSizes(folderMap(planDir, (j) => { scenes5(j); j[EXP].axes[0].sizes = { '300x250': 'must' }; })), ['300x250'], 'the experience names one size');
    eq(bakedSizes(folderMap(planDir, (j) => { scenes5(j); delete j[EXP].axes; })), ['160x600', '300x250', '320x50', '728x90', '970x250'], 'no sizes of its own: the scenes\'');
  },
});
import * as P from '../src/plan.mjs';
const { planSolver: fitSolver } = await addonCode('../src/capabilities/fit.mjs', import.meta.url) ?? {};
const textItem = (w, h) => () => ({ box: { x: 0, y: 0, width: w, height: h }, text: true });
const rowPlan = { place: 'box', kind: 'row', gap: 0, children: [
  { share: { id: 'a', minimum: 20, initial: 50, maximum: 80 }, node: { item: 'part:a' } },
  { share: { id: 'b', minimum: 20, initial: 50, maximum: 80 }, node: { item: 'part:b' } }] };
const inside = (steps, priority) => ({ id: 'kept-inside', kind: 'inside', subject: 'part:a', strength: 'give-way', steps, ...(priority !== undefined ? { priority } : {}) });
Object.assign(tests, {
  'plan steps: column re-solves a row as a column, through the solver (8.4)'() {
    const ctx = { root: { x: 0, y: 0, width: 200, height: 100 }, item: textItem(150, 20) };
    eq(P.solve(rowPlan, ctx).status, 'incomplete', 'side by side, the texts do not fit');
    const r = P.solveGivingWay(rowPlan, ctx, [inside(['column'])]);
    eq([r.status, r.givenWay, r.plan.kind, rowPlan.kind], ['complete', [{ rule: 'kept-inside', step: 'column', times: 1 }], 'column', 'row']);
    eq(r.boxes.map(b => [b.cell.width, b.cell.height]), [[200, 50], [200, 50]]);
    const none = P.solveGivingWay(rowPlan, ctx, []);
    eq([none.status, none.givenWay], ['incomplete', []], 'no rule, no step');
  },
  'plan steps: minimum-share gives a picture its smallest share; crop crops further about the focal point'() {
    const plan = { place: 'box', kind: 'row', children: [
      { share: { id: 'pic', minimum: 20, initial: 60, maximum: 80 }, node: { item: 'use:photo', fit: 'cover', focal: [0.5, 0.5] } },
      { share: { id: 'txt', minimum: 20, initial: 40, maximum: 80 }, node: { item: 'part:t' } }] };
    const item = (a) => (a === 'part:t' ? { box: { x: 0, y: 0, width: 120, height: 10 }, text: true } : { box: { x: 0, y: 0, width: 100, height: 100 }, picture: true });
    const ctx = { root: { x: 0, y: 0, width: 200, height: 100 }, item, shares: { pic: { value: 70 } } };
    eq(P.solve(plan, ctx).status, 'incomplete');
    const r = P.solveGivingWay(plan, ctx, [inside(['minimum-share'])]);
    eq([r.status, r.plan.children[0].share.initial, r.givenWay[0].step], ['complete', 20, 'minimum-share'], 'the editor\'s 70 no longer applies');
    const locked = P.solveGivingWay(plan, { ...ctx, shares: { pic: { value: 70, locked: true } } }, [inside(['minimum-share'])]);
    eq(locked.givenWay, [], 'a locked share never moves');
    const c = P.planStep(plan, 'crop');
    eq([c.moved, c.plan.children[0].node.crop], [true, [0.1, 0.1, 0.8, 0.8]]);
    let p = plan; for (let i = 0; i < 6; i++) p = P.planStep(p, 'crop').plan;
    eq(p.children[0].node.crop.slice(2), [0.5, 0.5], 'never below half the picture');
    eq(P.planStep(p, 'crop').moved, false);
  },
  'plan steps live: the fit capability\'s solver applies the block\'s rules'() {
    // The capability exposes the solver with the block's rules (install/mount); the plain solver export stays pure.
    eq(typeof fitSolver.solveGivingWay, 'function');
    eq(P.planRules([inside(['column']), { ...inside(['shrink']), id: 'x' }, { ...inside(['column']), strength: 'must' }]).map(r => r.id), ['kept-inside']);
  },
});
import { Drawing } from '../src/drawing.mjs';
import { parseSize } from '../src/layout.mjs';
// The plan fixture with a plan that gives way: a long title in the offer's row layout does not fit beside the photo;
// an inside rule lets the row become a column.
function givingWayFiles(live) {
  return folderMap(planDir, (j) => {
    const o = j['components/offer/component.json'];
    o.rules = [{ id: 'title-inside', kind: 'inside', subject: 'part:offer-title', strength: 'give-way', steps: ['column'] }];
    if (live) j['experience.json'].needs = ['fit'];
  });
}
const longTitle = (files) => { files['components/offer/offer.svg'] = files['components/offer/offer.svg'].replace('>Summer sale<', '>Summer sale today on every rain jacket, coat and boot in the shop<'); return files; };
Object.assign(tests, {
  'plan steps at bake: a plan that gives way bakes with the column step in its receipt (A7.1)'() {
    const files = longTitle(givingWayFiles(false));
    const { experience } = loadExperience(mapSource(files), schemas());
    const out = bakePlans(experience, { date: '2026-11-07T00:00:00Z' });
    const row = out.receipts.find(r => r.id === 'offer-row-962x242-fit');
    ok(row, out.receipts.map(r => r.id).join(', '));
    eq([row.status, row.steps], ['reduced', [{ kind: 'give-way', rule: 'title-inside', subject: 'part:offer-title', step: 'column' }]]);
    // Without the rule, the same bake is incomplete there.
    const plain = longTitle(folderMap(planDir));
    const b2 = bakePlans(loadExperience(mapSource(plain), schemas()).experience, { date: '2026-11-07T00:00:00Z' });
    eq(b2.receipts.find(r => r.id === 'offer-row-962x242-fit')?.status, 'incomplete');
  },
  'plan steps live: with fit, the drawing re-solves the plan as a column'() {
    const files = longTitle(givingWayFiles(true));
    const { experience } = loadExperience(mapSource(files), schemas());
    const p = new Player(experience); ok(p.start().ok);
    const d = new Drawing(p);
    d.mountScene('ad', 'fill', parseSize('970x250'));
    const rec = d.plans['ad/offer'];
    eq([rec.layout, rec.status], ['row', 'complete']);
    const title = rec.boxes.find(b => b.item === 'part:offer-title');
    const photo = rec.boxes.find(b => b.item === 'use:photo');
    ok(photo.cell.y + photo.cell.height <= title.cell.y + 0.01 || title.cell.y + title.cell.height <= photo.cell.y + 0.01, 'stacked, not side by side');
  },
});

// ---- item 8: small ----
Object.assign(tests, {
  'small: START names hsvg preview; the README names proof.mjs guide, the guides folder and the studio\'s browser test; preview speaks of srcdoc; the fast run has the studio test'() {
    const read = (...p) => fs.readFileSync(path.join(repo, ...p), 'utf8');
    const start = read('kit', '2.0', 'START.md');
    ok(/hsvg\.mjs preview/.test(start) && !/not in this kit yet/.test(start), 'START.md names preview');
    const readme = read('engine', 'v2', 'README.md');
    ok(readme.includes('proof.mjs guide') && readme.includes('tools/proof/guides/'), 'README: proof.mjs guide and the guides folder');
    ok(readme.includes('node examples/2.0-ad-studio/tests/studio-browser.mjs'), 'README: the studio browser test');
    ok(/srcdoc frame \(its sounds/.test(read('engine', 'v2', 'tools', 'preview.mjs')), 'preview.mjs: srcdoc');
    ok(read('engine', 'v2', 'tests', 'run.mjs').includes("'studio.test.mjs'"), 'run.mjs runs the studio test');
  },
});

// ---- item 6: checker ----
Object.assign(tests, {
  'checker: limit rules hold on the values in initial, with and words (E-RULE), as the change tool says'() {
    const dir = path.join(repo, 'engine', 'v2', 'tests', 'lines-fixture');
    const P = 'components/parrot/component.json';
    const limit = (max, extra = {}) => (j) => { j[P].rules = [{ id: 'short-greeting', kind: 'limit', subject: 'input:greeting', maxLength: max, ...extra }]; };
    eq(checkCodes(folderMap(dir, limit(10))).filter(c => c.startsWith('E-')), [], 'hello is 5 characters');
    eq(checkCodes(folderMap(dir, limit(3))).filter(c => c.startsWith('E-')), ['E-RULE /rules/0'], 'over 3: the initial breaks it');
    eq(checkCodes(folderMap(dir, limit(3, { strength: 'should' }))).filter(c => c.startsWith('E-')), [], 'a should rule never fails');
    // A use's with that gives it a tier object: each wording counts.
    const withTiers = (j) => { limit(10)(j); const sc = Object.keys(j).find(k => /^scenes\/.*scene\.json$/.test(k)); const u = j[sc].uses.find(x => x.use === 'parrot'); u.with = { ...(u.with || {}), greeting: { short: 'hi', rich: 'hello there, friend' } }; };
    eq(checkCodes(folderMap(dir, withTiers)).filter(c => c.startsWith('E-RULE')), ['E-RULE /rules/0'], 'the rich wording is over 10');
  },
});
Object.assign(tests, {
  'checker: W-PLAN-SCALE when a plan scales a frame\'s text under the readable floor at a declared size (7.5)'() {
    const plans = checkCodes(folderMap(planDir)).filter(c => c.startsWith('W-PLAN-SCALE'));
    eq(plans, ['W-PLAN-SCALE /layouts/0/layoutPlan'], 'one 300x250 drawing scaled into 728x90, 160x600 and 320x50');
    const one = checkCodes(folderMap(planDir, (j) => { j['experience.json'].axes[0].sizes = { '300x250': 'must', '970x250': 'must' }; })).filter(c => c.startsWith('W-PLAN-SCALE'));
    eq(one, [], 'at sizes the drawing keeps its type readable, nothing');
    // Only the sizes where the engine picks this layout: a wide layout listed first takes 728x90 and 320x50.
    const wide = checkExperience(mapSource(folderMap(planDir, (j) => { j['scenes/ad/scene.json'].layouts.unshift({ id: 'wide', shape: { minAspect: 2 } }); })), schemas()).diags.find(d => d.code === 'W-PLAN-SCALE');
    ok(wide && /160x600/.test(wide.message) && !/728x90|320x50/.test(wide.message), wide ? wide.message : 'no W-PLAN-SCALE at 160x600');
    const msg = checkExperience(mapSource(folderMap(planDir)), schemas()).diags.find(d => d.code === 'W-PLAN-SCALE').message;
    ok(/728x90/.test(msg) && /320x50/.test(msg) && /readable floor 12|under the readable floor/.test(msg), msg);
  },
  'checker: W-MOUNT-LIMIT when the estimated filter surface is over the mount limit (9.8)'() {
    const dir = path.join(repo, 'engine', 'v2', 'tests', 'lines-fixture');
    const SVG = Object.keys(folderMap(dir)).find(k => k.endsWith('talk.svg'));
    const blur = (n) => (files) => {
      const rects = Array.from({ length: n }, (_, i) => `<rect id="haze-${i}" width="400" height="300" fill="#fff" filter="url(#soft)" data-hsvg-layer="decoration"/>`).join('');
      files[SVG] = files[SVG].replace('<title>Talk</title>', `<title>Talk</title><defs><filter id="soft"><feGaussianBlur stdDeviation="4"/></filter></defs>${rects}`);
      return files;
    };
    eq(checkCodes(blur(2)(folderMap(dir))).filter(c => c.startsWith('W-MOUNT')), [], 'two full-size blurs: 2.88 times the box');
    eq(checkCodes(blur(3)(folderMap(dir))).filter(c => c.startsWith('W-MOUNT')), ['W-MOUNT-LIMIT svg'], 'three: 4.32 times, over 4');
  },
});

// ---- item 7: changes ----
import { spawnSync } from 'node:child_process';
import { loadPreviousKit } from '../tools/previous-kit.mjs';
const tool = (...a) => spawnSync(process.execPath, [path.join(repo, 'engine', 'v2', 'tools', ...a.slice(0, 1)), ...a.slice(1)], { encoding: 'utf8' });
Object.assign(tests, {
  'changes: check.mjs --rights prints the rights table (A9.1)'() {
    const r = tool('check.mjs', path.join(repo, 'examples', '2.0-ad-studio', 'ad'), '--rights');
    eq(r.status, 0, r.stderr);
    const t = JSON.parse(r.stdout);
    eq(t.kit, { id: 'studio-ad', version: '1.0.0' });
    ok(t.edit['studio-ad-sample/headline'].includes('copywriter'), JSON.stringify(t.edit));
  },
  'changes: --previous-kit gives the checker the kit before a version change (E-KIT-VERSION, 4.8)'() {
    const kitDir = path.join(repo, 'examples', '2.0-ad-studio', 'kits', 'studio-ad');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-e4-kit-'));
    try {
      fs.cpSync(kitDir, tmp, { recursive: true });
      const k = JSON.parse(fs.readFileSync(path.join(tmp, 'kit.json'), 'utf8'));
      k.inputs.brand.maxLength = 40; // the kit before allowed longer brands; 1.0.0 narrowed it with no new version
      fs.writeFileSync(path.join(tmp, 'kit.json'), JSON.stringify(k));
      const prev = loadPreviousKit(tmp, schemas());
      eq([prev?.doc.id, prev?.doc.about.version], ['studio-ad', '1.0.0']);
      const ad = path.join(repo, 'examples', '2.0-ad-studio', 'ad');
      const same = tool('check.mjs', ad, '--previous-kit', kitDir);
      ok(same.status === 0 && /0 findings/.test(same.stdout), same.stdout);
      const bad = tool('check.mjs', ad, '--previous-kit', tmp);
      ok(bad.status === 1 && /E-KIT-VERSION/.test(bad.stdout), bad.stdout);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  },
});
Object.assign(tests, {
  async 'ambient layout: a built-in a formula reads (the player writes it, 7.1, 5.5); a value of the author named layout hides it (D22)'() {
    const exp = await lines();
    const p = new Player(exp, {}); ok(p.start().ok);
    eq(p.scope('experience').name('layout'), {}, 'nothing on screen in Node');
    p.state.ambient.layout = { talk: { frame: 'main', tier: 'rich', steps: [] } };
    eq(p.scope('experience').name('layout').talk.tier, 'rich');
    const dir = path.join(repo, 'engine', 'v2', 'tests', 'lines-fixture');
    const named = checkCodes(folderMap(dir, (j) => { j['experience.json'].values = { ...(j['experience.json'].values || {}), layout: { type: 'number', initial: 0 } }; }));
    ok(named.some(c => c.startsWith('W-NAME-HIDES')) && !named.some(c => c.startsWith('E-NAME-RESERVED')), `layout hides the built-in: ${named}`);
  },
});
