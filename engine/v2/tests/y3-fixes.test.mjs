// Check and pack tell the truth, the frame link, and security. Each test reproduces an R3 finding
// (or a finding of the two security reviews); it failed on engine-2.0 before the fix. Fast: no browser.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { repo, schemas, eq, ok, granting } from './helpers.mjs';
import { folderSource } from '../src/load.mjs';
import { checkExperience } from '../check/index.mjs';
import { pack, bakePlans, bundle } from '../tools/pack.mjs';
import { addonSnapshot, scanCode } from '../tools/addons.mjs';
import { pin } from '../tools/addon.mjs';
import { checkDrawing } from '../schema/drawing-check.mjs';
import { expandPresets, fill } from '../src/addons.mjs';
import { spawnSync } from 'node:child_process';
import { readFolder, memorySource, digestAt } from '../tools/change/folder.mjs';
import { newFromTemplate, addItem } from '../tools/library.mjs';
import { Player } from '../src/story.mjs';
import { mapSource } from './helpers.mjs';
import { dashboardFiles, dashboardHost } from './x2-dashboard.mjs';
import { refusedLimits, raisedLimits } from '../src/limits.mjs';
import { hostApi } from '../src/host.mjs';
import { frameLink } from '../web/frame-link.mjs';
import { connectFrame } from '../web/frame-host.mjs';

const tmp = (name) => fs.mkdtempSync(path.join(os.tmpdir(), `hsvg-y3-${name}-`));
const check = async (dir) => checkExperience(await folderSource(dir), schemas());
const said = (list) => list.map(d => `${d.code} ${d.message}`).join(' | ');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, v) => fs.writeFileSync(file, JSON.stringify(v, null, 2) + '\n');
const edit = (file, fn) => { const v = readJson(file); fn(v); writeJson(file, v); };
async function packs(exp, out, opts = {}) {
  try { return { r: await pack(exp, out, opts) }; } catch (e) { return { e }; }
}

// The adaptive-ad recipe in a temp folder, fully baked: no `needs` at the experience or the offer.
const AD = path.join(repo, 'skill', '2.0', 'examples', 'recipes', 'adaptive-ad');
function bakedAd(change = () => {}) {
  const dir = path.join(tmp('ad'), 'ad');
  fs.cpSync(AD, dir, { recursive: true });
  edit(path.join(dir, 'experience.json'), (e) => { delete e.needs; });
  edit(path.join(dir, 'components', 'offer', 'component.json'), (c) => { delete c.needs; });
  change(dir);
  return dir;
}

// The noughts example and its add-ons (a module, a capability, a preset) in a temp folder outside the engine, pinned.
const EXAMPLES = path.join(repo, 'engine', 'v2', 'addons', 'examples');
async function noughts(change = () => {}) {
  const dir = tmp('noughts');
  fs.cpSync(path.join(EXAMPLES, 'addons'), path.join(dir, 'addons'), { recursive: true });
  fs.cpSync(path.join(EXAMPLES, 'noughts'), path.join(dir, 'noughts'), { recursive: true });
  change(dir);
  await pin(path.join(dir, 'noughts'));
  return { dir, exp: path.join(dir, 'noughts'), mod: path.join(dir, 'addons', 'example.noughts') };
}

// A story made from the starter template by `hsvg new`, in a temp folder.
async function story() {
  const parent = tmp('story');
  await newFromTemplate('probe', 'story', parent);
  return path.join(parent, 'probe');
}

// ---- a fake browser for the frame link: a host window, an iframe, and documents that replace each other ----
// postMessage is asynchronous and goes to the document that is current when it is posted; a message to a document
// that has gone is dropped. The iframe's contentWindow is one object across documents, as a WindowProxy is.
const later = () => new Promise(r => setTimeout(r, 0));
const until = async (fn, ms = 2000) => { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error('timed out'); await new Promise(r => setTimeout(r, 5)); } };
function fakeBrowser() {
  const hostHandlers = new Set();
  const hostWin = {
    addEventListener: (t, fn) => { if (t === 'message') hostHandlers.add(fn); },
    removeEventListener: (t, fn) => { if (t === 'message') hostHandlers.delete(fn); },
  };
  const loadHandlers = new Set();
  let doc = null;
  const proxy = { postMessage: (m) => { const to = doc; const data = structuredClone(m); setTimeout(() => { if (doc === to) for (const fn of [...to.handlers.message || []]) fn({ source: hostWin, data }); }, 0); } };
  hostWin.postMessage = (m) => { const data = structuredClone(m); setTimeout(() => { for (const fn of [...hostHandlers]) fn({ source: proxy, data }); }, 0); };
  const iframe = {
    get contentWindow() { return proxy; },
    addEventListener: (t, fn) => { if (t === 'load') loadHandlers.add(fn); },
    removeEventListener: (t, fn) => { if (t === 'load') loadHandlers.delete(fn); },
  };
  // show(): a new document; its window registers handlers. Returns {win, heard}.
  function show() {
    if (doc) for (const fn of [...doc.handlers.pagehide || []]) fn({});
    const heard = [];
    const d = { handlers: {}, heard };
    d.win = {
      parent: hostWin,
      addEventListener: (t, fn) => { (d.handlers[t] ||= new Set()).add(fn); },
      removeEventListener: (t, fn) => { d.handlers[t]?.delete(fn); },
    };
    (d.handlers.message ||= new Set()).add((e) => heard.push(e.data));
    doc = d;
    return d;
  }
  const load = () => setTimeout(() => { for (const fn of [...loadHandlers]) fn({}); }, 0);
  return { hostWin, iframe, show, load };
}
// A packed page in the current document: the frame link's page side and a player with `entered` heard by the host.
function packedPage(b) {
  const d = b.show();
  const link = frameLink(d.win);
  const p = new Player({
    doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en', inputs: { volume: { kind: 'knob', type: 'number', minimum: 0, maximum: 1, initial: 0.5 } }, story: { start: 'a', scenes: { a: 'a.json' } } },
    words: { en: {} }, data: {}, blocks: {},
    scenes: { a: { file: 'a.json', doc: { format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg' }, drawings: {}, words: {} } },
  });
  p.start();
  const host = hostApi(p);
  link.open(host);
  return { ...d, link, host, p };
}
async function withWindow(hostWin, fn) {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'window');
  globalThis.window = hostWin;
  try { return await fn(); } finally { if (had) Object.defineProperty(globalThis, 'window', had); else delete globalThis.window; }
}
const settled = (promise) => { const s = { state: 'pending' }; promise.then(v => { s.state = 'resolved'; s.value = v; }, e => { s.state = 'rejected'; s.error = e; }); return s; };
const TOKEN_SEEN = (heard, channel) => heard.some(m => JSON.stringify(m).includes(channel));

export const tests = {
  // ---- item 1: required content that fails its fit at a must size does not pack, nested components included ----
  async 'item 1: a nested component whose required text cannot fit at a must size stops the pack'() {
    const dir = bakedAd((d) => {
      edit(path.join(d, 'components', 'offer', 'component.json'), (c) => {
        c.inputs.copy.required = true;
        c.rules.find(r => r.id === 'copy-fits').steps = ['short', 'shrink'];
      });
      edit(path.join(d, 'scenes', 'ad', 'scene.json'), (s) => {
        s.uses[0].with.copy = { rich: 'W'.repeat(96), medium: 'Two loaves for one', short: 'Two for one.' };
      });
    });
    const r = await check(dir);
    eq(r.diags.filter(x => x.code.startsWith('E-')).length, 0, said(r.diags));
    const out = path.join(path.dirname(dir), 'out');
    const p = await packs(dir, out);
    ok(p.e, 'pack refuses');
    ok(/incomplete at a must size/.test(p.e.message) && /document:offer at 962x242/.test(p.e.message), p.e.message);
    ok(!fs.existsSync(path.join(out, 'adaptive-ad.html')), 'no page is written');
    // The nested placement keeps the must class of its outer size in the bake's own result.
    const baked = bakePlans(r.experience);
    ok(baked.incompleteMust.some(x => x.subject === 'document:offer' && x.size === '962x242'), JSON.stringify(baked.incompleteMust));
  },
  async 'item 1: a nested placement shared by a must and a should size keeps the must class'() {
    const dir = bakedAd((d) => {
      edit(path.join(d, 'experience.json'), (e) => { e.axes[0].sizes['970x250'] = 'should'; });
      edit(path.join(d, 'components', 'offer', 'component.json'), (c) => {
        c.inputs.copy.required = true;
        c.rules.find(r => r.id === 'copy-fits').steps = ['short', 'shrink'];
      });
      edit(path.join(d, 'scenes', 'ad', 'scene.json'), (s) => {
        s.uses[0].with.copy = { rich: 'W'.repeat(96), medium: 'Two loaves for one', short: 'Two for one.' };
      });
    });
    const r = await check(dir);
    // 970x250 is only `should` here: its incomplete nested offer is reported, not refused.
    const baked = bakePlans(r.experience);
    ok(!baked.incompleteMust.some(x => x.size === '962x242'), JSON.stringify(baked.incompleteMust));
    ok(baked.receipts.some(x => x.subject === 'document:offer' && x.selected.size === '962x242' && x.status === 'incomplete'), 'the receipt says incomplete');
  },

  // ---- item 2: component field rules apply (field:<block>.<field> inside a component, 8.x and the recipe) ----
  async 'item 2: a component rule on field:<its id>.<field> applies to its own field, as the bare form does'() {
    const receipts = async (change) => {
      const r = await check(bakedAd(change));
      eq(r.diags.filter(x => x.code.startsWith('E-')).length, 0, said(r.diags));
      return bakePlans(r.experience).receipts.filter(x => x.subject === 'document:offer');
    };
    const ruleIds = (list) => [...new Set(list.flatMap(x => x.rules.map(y => y.rule)))].sort();
    const spec = await receipts(() => {});
    eq(spec.length, 5);
    eq(ruleIds(spec), ['copy-fits', 'title-fits'], 'the recipe\'s field:offer.<field> rules reach the offer\'s texts');
    const bare = await receipts((d) => edit(path.join(d, 'components', 'offer', 'component.json'), (c) => {
      for (const r of c.rules) r.subject = r.subject.replace('field:offer.', 'field:');
    }));
    eq(ruleIds(bare), ['copy-fits', 'title-fits'], 'the bare form still applies');
    const shape = (list) => JSON.stringify(list.map(x => [x.status, x.steps.map(y => `${y.rule}:${y.step}`)]));
    eq(shape(spec), shape(bare), 'both spellings bake the same');
  },

  // ---- item 3: a clean check never packs a story that stops on launch ----
  async 'item 3: a kit scene\'s with formula is checked as a formula, at the authored field'() {
    const dir = await story();
    edit(path.join(dir, 'experience.json'), (e) => { e.story.scenes.meadow.with.place = 'dunes'; });
    const r = await check(dir);
    // The player stops on it, so the checker must refuse it, at the author's own field.
    const p = new Player(r.experience);
    const started = (() => { try { return p.start(); } catch (e) { return { ok: false, error: e }; } })();
    ok(!started.ok || p.stopped, 'the player cannot start this story');
    const bad = r.diags.filter(x => x.code.startsWith('E-'));
    ok(bad.some(x => x.code === 'E-REF-UNKNOWN' && x.file === 'experience.json' && x.path === '/story/scenes/meadow/with/place' && /dunes/.test(x.message)), said(r.diags));
    const out = path.join(path.dirname(dir), 'out');
    ok((await packs(dir, out)).e, 'pack refuses');
  },
  async 'item 3: a with formula of several words reports at the authored field, not inside the kit; a valid one passes'() {
    const dir = await story();
    edit(path.join(dir, 'experience.json'), (e) => { e.story.scenes.meadow.with.title = 'Fox at dawn'; });
    const r = await check(dir);
    const bad = r.diags.filter(x => x.code.startsWith('E-'));
    ok(bad.length && bad.every(x => x.file === 'experience.json' && x.path === '/story/scenes/meadow/with/title'), said(r.diags));
    // The good form: quoted text (D36).
    const good = await story();
    edit(path.join(good, 'experience.json'), (e) => { e.story.scenes.meadow.with.title = "'Fox at dawn'"; });
    const g = await check(good);
    eq(g.diags.filter(x => x.code.startsWith('E-')).length, 0, said(g.diags));
  },

  // ---- item 4: the checker and the host agree on live repeated uses ----
  async 'item 4: a declared limits.liveRepeatedUses a host can admit is accepted by the checker; the default still refuses'() {
    const codes = async (files) => (await checkExperience(mapSource(files), schemas())).diags.filter(d => d.code.startsWith('E-'));
    const raised = dashboardFiles(1000);
    const r = await codes(raised);
    eq(r.map(d => `${d.code} ${d.message}`), [], 'the 1,000-row dashboard that raises the limit checks clean');
    // The host that allows it admits it; a host without a profile does not.
    const asks = raisedLimits([JSON.parse(raised['experience.json'])]);
    eq(refusedLimits(asks, dashboardHost(1000)).length, 0);
    eq(refusedLimits(asks, null).length, 1);
    // Without the raise, and above what it raises, the checker still refuses.
    ok((await codes(dashboardFiles(1000, { limit: 256 }))).some(d => d.code === 'E-REPEAT-CAPACITY' && /256 live repeated uses/.test(d.message)), 'the default refuses');
    ok((await codes(dashboardFiles(1000, { limit: 600 }))).some(d => d.code === 'E-REPEAT-CAPACITY' && /600 live repeated uses/.test(d.message)), 'a smaller raise refuses');
  },

  // ---- item 5: the frame link ----
  async 'item 5: a replaced frame ends the link: waiting calls reject with E-HOST-CLOSED, the new document learns nothing, a new link starts'() {
    const b = fakeBrowser();
    await withWindow(b.hostWin, async () => {
      packedPage(b);
      const link = connectFrame(b.iframe, { probe: 200 });
      b.load();
      eq(await link.ready, { v: 1 });
      eq(await link.read('volume'), 0.5);
      // A call posted as the frame's document is replaced never gets its answer: it must not wait forever.
      const before = settled(link.scene());
      const next = b.show(); // a document with its own script: it only listens
      b.load();
      await until(() => before.state !== 'pending');
      eq(before.state, 'rejected');
      eq(before.error.code, 'E-HOST-CLOSED');
      const after = settled(link.set('volume', 0.2));
      await until(() => after.state !== 'pending');
      eq(after.error?.code, 'E-HOST-CLOSED', 'a call after the replacement is refused');
      await later();
      ok(!TOKEN_SEEN(next.heard, link.channel), `the new document never learns the token: ${JSON.stringify(next.heard)}`);
      ok(!next.heard.some(m => m && m.call && m.call !== 'ping'), `the new document sees no host call: ${JSON.stringify(next.heard)}`);
      // A new link to a new packed page works.
      const page = packedPage(b);
      const link2 = connectFrame(b.iframe);
      eq(await link2.ready, { v: 1 });
      eq(await link2.read('volume'), 0.5);
      ok(!TOKEN_SEEN(page.heard, link.channel), 'the new page never hears the old token');
      link2.close();
    });
  },
  async 'item 5: a packed page that goes away says bye, and its link ends at once'() {
    const b = fakeBrowser();
    await withWindow(b.hostWin, async () => {
      const page = packedPage(b);
      const link = connectFrame(b.iframe, { probe: 60000 });
      eq(await link.ready, { v: 1 });
      page.host.destroy();
      const after = settled(link.read('volume'));
      await until(() => after.state !== 'pending', 1000);
      eq(after.error?.code, 'E-HOST-CLOSED');
    });
  },
  async 'item 5: a load of the same page after the hello keeps the link (the page answers the ping)'() {
    const b = fakeBrowser();
    await withWindow(b.hostWin, async () => {
      packedPage(b);
      const link = connectFrame(b.iframe, { probe: 500 });
      eq(await link.ready, { v: 1 });
      b.load(); // the page's own load, heard after it answered the hello
      eq(await link.read('volume'), 0.5);
      await new Promise(r => setTimeout(r, 600));
      eq(await link.read('volume'), 0.5, 'still open after the probe time');
      link.close();
    });
  },
  async 'item 5: entered and hsvg.entered arrive once each, and off of one keeps the other'() {
    const b = fakeBrowser();
    await withWindow(b.hostWin, async () => {
      packedPage(b);
      const link = connectFrame(b.iframe);
      await link.ready;
      const n = { bare: 0, alias: 0 };
      await link.on('entered', () => n.bare++);
      const offAlias = await link.on('hsvg.entered', () => n.alias++);
      await link.restart();
      await until(() => n.bare + n.alias >= 2);
      await new Promise(r => setTimeout(r, 30));
      eq(n, { bare: 1, alias: 1 });
      await offAlias();
      await link.restart();
      await until(() => n.bare >= 2);
      await new Promise(r => setTimeout(r, 30));
      eq(n, { bare: 2, alias: 1 }, 'the bare listener stays after the alias is off');
      // Alias only.
      const b2 = fakeBrowser();
      await withWindow(b2.hostWin, async () => {
        packedPage(b2);
        const l2 = connectFrame(b2.iframe);
        await l2.ready;
        let a = 0;
        await l2.on('hsvg.entered', () => a++);
        await l2.restart();
        await until(() => a >= 1);
        await new Promise(r => setTimeout(r, 30));
        eq(a, 1);
        l2.close();
      });
      link.close();
    });
  },
  'item 5: the 64 KiB frame message limit counts UTF-8 bytes'() {
    const sent = [];
    const parent = { postMessage: (m) => sent.push(m) };
    const handlers = {};
    const win = { parent, addEventListener: (t, fn) => { handlers[t] = fn; }, removeEventListener() {} };
    const link = frameLink(win);
    link.open({ set() {}, on() { return () => {}; } });
    const T = 'abcdefghijklmnopqrstuvwxyz_-0123';
    handlers.message({ source: parent, data: { call: 'hello', channel: T, id: 'h' } });
    handlers.message({ source: parent, data: { channel: T, v: 1, id: 2, call: 'set', args: ['x', '\u20ac'.repeat(30000)] } });
    eq(sent.at(-1).error?.code, 'E-RANGE', '30,000 euro signs are 90,000 bytes');
  },

  // ---- item 6: the two security reviews (D26) ----
  'item 6: confined module code sees only its inputs and step: the top["loca"+"tion"] probe finds nothing'() {
    const PROBED = ['top', 'parent', 'frames', 'opener', 'open', 'location', 'history', 'document', 'window', 'self',
      'globalThis', 'Image', 'Audio', 'Blob', 'fetch', 'XMLHttpRequest', 'navigator', 'localStorage', 'Date', 'setTimeout',
      'console', 'structuredClone', 'Proxy', 'Reflect', 'Function', 'eval', 'Promise', 'stage', 'defs', 'cache', '__hsvgReq', '__hsvgConfined'];
    const dir = tmp('probe');
    const probe = [
      "import { tag } from './lib.mjs';",
      'export function make(step) { return { look() { step(); return look(); } }; }',
      'function look() {',
      '  const seen = {};',
      ...PROBED.map(n => `  seen.${n} = typeof ${n};`),
      '  let leak = null;',
      '  if (typeof top !== "undefined" && top) leak = String(top["loca" + "tion"].href);',
      '  if (typeof parent !== "undefined" && parent) leak = String(parent["doc" + "ument"].title);',
      '  const self2 = (function () { return this; })();',
      '  let wrote = "refused";',
      '  try { location = "https://example.invalid/"; wrote = "wrote"; } catch (e) { wrote = "refused"; }',
      '  let other; try { other = typeof req(5); } catch (e) { other = "threw"; }',
      '  return { seen, leak, other, wrote, self2: typeof self2, math: Math.max(1, 2), json: JSON.stringify([1]), tag: tag(2), arr: Array.isArray([]) };',
      '}',
    ].join('\n') + '\n';
    fs.writeFileSync(path.join(dir, 'index.mjs'), probe);
    fs.writeFileSync(path.join(dir, 'lib.mjs'), 'export function tag(n) { return n * 3; }\n');
    const texts = Object.fromEntries(Object.entries(addonSnapshot(dir).texts).map(([f, t]) => [path.join(dir, f), t]));
    const b = bundle(path.join(dir, 'index.mjs'), [], { strip: false, texts, confined: Object.keys(texts) });
    // A page-like global: every name the probe looks at is there, with a fake location (never a real address).
    const fakes = { top: { location: { href: 'https://example.invalid/leak' } }, parent: { document: { title: 'the whole page' } },
      frames: {}, opener: {}, open() {}, location: { href: 'x' }, history: {}, document: {}, window: {}, self: {}, Image() {},
      Audio() {}, stage: { id: 'stage' } };
    const had = {};
    for (const [k, v] of Object.entries(fakes)) { had[k] = Object.getOwnPropertyDescriptor(globalThis, k); Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true }); }
    let r;
    try {
      // The packed page's prelude (tools/pack.mjs): defs, cache and req.
      // eslint-disable-next-line no-new-func
      r = new Function(`const defs = []; const cache = {}; function req(n) { if (n in cache) return cache[n]; const exp = cache[n] = {}; defs[n](exp); return exp; }\n${b.defs}\nreturn req(${b.entry});`)().make(() => {}).look();
    } finally {
      for (const [k, d] of Object.entries(had)) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; }
    }
    const open = Object.entries(r.seen).filter(([, t]) => t !== 'undefined').map(([n]) => n);
    eq(open, [], `globals the module could see: ${open.join(', ')}`);
    eq(r.leak, null, 'top["loca"+"tion"] and parent["doc"+"ument"] reach nothing');
    eq(r.self2, 'undefined', 'a plain function call gives no global this');
    eq(r.other, 'undefined', 'its imports reach only the files it imports');
    eq(r.wrote, 'refused', 'a module cannot write a global name');
    eq([r.math, r.json, r.tag, r.arr], [2, '[1]', 6, true], 'the language itself still works, and its own imports');
  },

  // F1c item 8 changed the rule: the loader meters a module's loops, so one that never calls step still stops.
  'item 6, as F1c item 8 changed it: chapter 12 and the modules README say a module that never calls step still stops at its time budget'() {
    const ch12 = fs.readFileSync(path.join(repo, 'spec', '2.0', '12-writing-an-addon.md'), 'utf8');
    const readme = fs.readFileSync(path.join(repo, 'engine', 'v2', 'modules', 'README.md'), 'utf8');
    for (const [name, text] of [['chapter 12', ch12], ['modules README', readme]]) {
      ok(/adds a time\s+check/.test(text), `${name} says the loader adds a time check`);
      ok(/never calls `step`/.test(text), `${name} names a module that never calls step`);
      ok(!/is never stopped: it holds the page|A module that never calls `step` is not stopped/.test(text), `${name} no longer says such a module is never stopped`);
    }
  },

  async 'item 6: pack carries an outside logic module only with --allow <id>, as for a capability'() {
    const { dir, exp } = await noughts();
    const without = await packs(exp, path.join(dir, 'a'), { allow: ['example.glow'] });
    ok(without.e, 'a pack without the module\'s allow is refused');
    ok(without.e.diags?.some(d => d.code === 'E-ADDON' && d.message.includes('--allow example.noughts')), `it says how: ${without.e?.message} ${JSON.stringify(without.e?.diags)}`);
    ok(!fs.existsSync(path.join(dir, 'a', 'noughts.html')), 'no page is written');
    const withIt = await packs(exp, path.join(dir, 'b'), { allow: ['example.glow', 'example.noughts@1.0.0'] });
    ok(withIt.r, `allowed by id@version it packs: ${withIt.e?.message}`);
  },

  async 'item 6: an import of tests/ or a hidden file is refused at check and pack (fixed by Y1; this test passed on engine-2.0)'() {
    const { dir, exp } = await noughts((d) => {
      const idx = path.join(d, 'addons', 'example.noughts', 'index.mjs');
      fs.writeFileSync(idx, 'import { extra } from "./tests/extra.mjs";\nimport { extra as x2 } from "./.hidden.mjs";\nexport const _e = [extra, x2];\n' + fs.readFileSync(idx, 'utf8'));
      fs.mkdirSync(path.join(d, 'addons', 'example.noughts', 'tests'), { recursive: true });
      fs.writeFileSync(path.join(d, 'addons', 'example.noughts', 'tests', 'extra.mjs'), 'export function extra() { return 0; }\n');
      fs.writeFileSync(path.join(d, 'addons', 'example.noughts', '.hidden.mjs'), 'export function extra() { return 0; }\n');
    });
    const r = await check(exp);
    ok(r.diags.some(x => x.code === 'E-ADDON'), `check refuses: ${said(r.diags)}`);
    const p = await packs(exp, path.join(dir, 'out'), { allow: ['example.glow', 'example.noughts'] });
    ok(p.e && !fs.existsSync(path.join(dir, 'out', 'noughts.html')), 'pack refuses');
  },

  async 'item 6: change.mjs apply never trusts a request\'s own by; with no --right/--who/--source it is refused'() {
    const d = tmp('change');
    fs.cpSync(path.join(repo, 'examples', '2.0-kit-ads'), d, { recursive: true });
    const ad = path.join(d, 'ads', 'ad-300x250');
    const expected = digestAt(memorySource(readFolder(ad), await folderSource(ad)), 'experience.json');
    // A stranger's request claims a right and a person.
    const req = { format: 'hsvg/2.0', kind: 'change', id: 'from-a-stranger', at: 'edit', target: 'ad-300x250', expected,
      by: { source: 'editor', right: 'copywriter', who: 'person:the-owner' }, reason: 'A test edit',
      changes: [{ address: 'ad-300x250/open/headline@en', old: 'Rain? Bring it on.', new: 'FORGED' }] };
    const file = path.join(d, 'req.json');
    writeJson(file, req);
    const words = () => fs.readFileSync(path.join(ad, 'words', 'en.csv'), 'utf8');
    const tool = path.join(repo, 'engine', 'v2', 'tools', 'change.mjs');
    const run = (...flags) => spawnSync(process.execPath, [tool, 'apply', ad, file, ...flags], { encoding: 'utf8' });
    const a = run();
    ok(a.status !== 0, `refused: ${a.stdout}`);
    ok(!words().includes('FORGED'), 'nothing changed');
    ok(/E-RIGHTS/.test(a.stdout) && /--right/.test(a.stdout), a.stdout);
    ok(!fs.existsSync(path.join(ad, 'evidence', 'changes')) || !fs.readdirSync(path.join(ad, 'evidence', 'changes'), { recursive: true }).some(f => String(f).includes('from-a-stranger')), 'no receipt in evidence/changes');
    // The authenticated by decides: a copywriter may edit the headline, and the receipt names who authenticated.
    writeJson(file, { ...req, id: 'from-a-copywriter' }); // a new request: a retry of one id gives its first receipt
    const b = run('--right', 'copywriter', '--who', 'agent:rio', '--source', 'agent');
    eq(b.status, 0, b.stdout);
    ok(words().includes('FORGED'));
    const receipt = readJson(path.join(d, 'req.receipt.json'));
    eq(receipt.by, { source: 'agent', right: 'copywriter', who: 'agent:rio' });
  },

  'item 6: tab, CR, LF and leading C0 characters are stripped before the scheme test of an image address'() {
    const svgWith = (href) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" data-hsvg-version="2.0"><title>t</title><image id="i" width="1" height="1" href="${href}"/></svg>`;
    const unsafe = (href) => checkDrawing(svgWith(href), schemas().drawing).diags.filter(d => d.code === 'E-SVG-UNSAFE');
    for (const href of ['java&#9;script:alert(1)', 'java&#10;script:x', 'java&#13;script:x', '&#1; javascript:x', ' javascript:x',
      'ht&#9;tps://example.invalid/a.png', 'da&#9;ta:text/html,x', '&#9;data:text/html,x']) {
      ok(unsafe(href).length > 0, `${href} is refused`);
    }
    // Plain good forms still pass.
    eq(unsafe('pictures/a.png').map(d => d.message), []);
    eq(unsafe('data:image/png;base64,iVBORw0KGgo=').map(d => d.message), []);
    // An SVG data image is inert and not parsed, and 2.11 says so (no "4 deep" promise the checker does not keep).
    const s211 = fs.readFileSync(path.join(repo, 'spec', '2.0', '02-files-and-names.md'), 'utf8');
    ok(/`image\/svg\+xml` data URI is not parsed/.test(s211) && !/at most 4\s+deep/.test(s211), '2.11 says an SVG data image is inert and not parsed');
  },

  async 'item 6: openUrl\'s with carries only ids and numbers: the checker refuses words, the engine never sends them'() {
    const dir = path.join(tmp('ad'), 'ad');
    fs.cpSync(path.join(repo, 'examples', '2.0-round1', 'c1', 'ad-300x250'), dir, { recursive: true });
    edit(path.join(dir, 'experience.json'), (e) => {
      e.inputs.headline = { kind: 'content', type: 'string', contentType: 'text', maxLength: 60, initial: 'Typed by an editor' };
    });
    edit(path.join(dir, 'scenes', 'end-card', 'scene.json'), (s) => {
      s.on.order[0].actions[0].with = { h: 'headline', n: '3', c: "'red'" };
    });
    const r = await check(dir);
    ok(r.diags.some(d => d.code.startsWith('E-') && d.path === '/on/order/0/actions/0/with/h'), `the checker refuses words in openUrl's with: ${said(r.diags)}`);
    ok(!r.diags.some(d => /with\/(n|c)$/.test(d.path || '')), 'an id and a number are fine');
    // The engine: a value that is not a number or an id never reaches the address.
    const p = new (granting(Player))(r.experience);
    p.state.story.resume = 'end-card';
    p.start();
    eq(p.scene, 'end-card');
    const heard = [];
    const host = hostApi(p);
    host.on('openUrl', (o) => heard.push(o.detail));
    p.activate('end-card', 'order');
    await later();
    eq(heard.length, 1, 'openUrl is heard');
    eq(heard[0].with, { n: 3, c: 'red' }, `only ids and numbers: ${JSON.stringify(heard[0])}`);
    eq(heard[0].refused, ['h']);
  },

  'item 6: __proto__, constructor and prototype keys are refused in preset filling and merging'() {
    const manifest = (provides, inputs = {}) => () => ({ manifest: { kind: 'preset', id: 'acme.bad', version: '1.0.0', adds: { inputs, provides } } });
    const doc = () => ({ format: 'hsvg/2.0', kind: 'scene', id: 's', clips: { a: { durationMs: 5 } }, presets: [{ use: 'acme.bad@1.0.0', as: 'x' }] });
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      const provides = JSON.parse(`{"clips": {"${key}": {"evil": {"durationMs": 1}}}}`);
      const r = expandPresets(doc(), manifest(provides));
      ok(r.diags.some(d => d.code === 'E-ADDON' && d.message.includes(key)), `${key} is refused: ${JSON.stringify(r.diags)}`);
      eq(Object.getPrototypeOf(r.doc.clips), Object.prototype, `${key}: the clips object keeps its prototype`);
      eq(r.doc.clips.evil, undefined, `${key}: nothing is inherited`);
      eq(Object.keys(r.doc.clips), ['a']);
    }
    // A key made by filling ({{as}}) is refused too.
    const r = expandPresets({ ...doc(), presets: [{ use: 'acme.bad@1.0.0', as: 'x', with: { k: '__proto__' } }] }, manifest(JSON.parse('{"clips": {"{{k}}": {"evil": {"durationMs": 1}}}}'), { k: { type: 'string', maxLength: 20 } }));
    ok(r.diags.some(d => d.code === 'E-ADDON' && d.message.includes('__proto__')), JSON.stringify(r.diags));
    eq(r.doc.clips.evil, undefined);
    eq(Object.getPrototypeOf(fill(JSON.parse('{"__proto__": {"evil": 1}}'), {})), Object.prototype, 'fill never sets a prototype');
    // Inside a new subtree too (the document has no such key yet).
    const deep = expandPresets({ format: 'hsvg/2.0', kind: 'scene', id: 's', presets: [{ use: 'acme.bad@1.0.0', as: 'x' }] }, manifest(JSON.parse('{"clips": {"b": {"__proto__": {"durationMs": 1}}}}')));
    ok(deep.diags.some(d => d.code === 'E-ADDON' && d.message.includes('clips.b.__proto__')), JSON.stringify(deep.diags));
  },

  async 'item 6: hsvg new and hsvg add write the kit\'s digest into the pin, so a changed kit file is found'() {
    const dir = await story();
    const doc = readJson(path.join(dir, 'experience.json'));
    ok(/^sha256:[0-9a-f]{64}$/.test(doc.kit?.digest ?? ''), `new pins the kit's digest: ${JSON.stringify(doc.kit)}`);
    eq((await check(dir)).diags.filter(d => d.code.startsWith('E-')).length, 0, 'it checks clean');
    const drawing = path.join(dir, 'kits', 'hsvg-starter', 'scenes', 'frame-story', 'frame-story.svg');
    const before = fs.readFileSync(drawing, 'utf8');
    fs.writeFileSync(drawing, before.replace(/fill="#[0-9a-fA-F]{3,6}"/, 'fill="#123456"'));
    ok(fs.readFileSync(drawing, 'utf8') !== before, 'the drawing changed');
    ok((await check(dir)).diags.some(d => d.code === 'E-KIT-PIN'), 'a changed kit file is found (E-KIT-PIN)');
    // hsvg add: an experience without a kit picks one item; the pick carries the digest.
    const parent = tmp('add');
    const plain = path.join(parent, 'plain');
    fs.cpSync(path.join(repo, 'skill', '2.0', 'examples', 'recipes', 'quiz'), plain, { recursive: true });
    const r = await addItem(path.join(repo, 'library', '2.0', 'hsvg-starter'), 'icon-star', plain);
    ok(r.changed, r.message);
    const pick = readJson(path.join(plain, 'experience.json')).picks.find(x => x.id === 'hsvg-starter');
    ok(/^sha256:[0-9a-f]{64}$/.test(pick?.digest ?? ''), `add pins the kit's digest: ${JSON.stringify(pick)}`);
    eq(r.diags.filter(d => d.code === 'E-KIT-PIN').length, 0, 'and the pin matches');
  },

  // ---- item 7: newcomer docs ----
  async 'item 7: START says how to build the kit from the source; the template guide\'s first edits check clean'() {
    const start = fs.readFileSync(path.join(repo, 'kit', '2.0', 'START.md'), 'utf8');
    ok(/node kit\/2\.0\/build\.mjs <out folder>/.test(start) && /cd <out folder>\/hsvg-2\.0-kit/.test(start), 'START gives the build and cd commands');
    const guide = fs.readFileSync(path.join(repo, 'kit', '2.0', 'START-FROM-A-TEMPLATE.md'), 'utf8');
    const blocks = [...guide.matchAll(/```json\n([\s\S]*?)```/g)].map(m => JSON.parse(`{${m[1]}}`));
    const storyEdit = blocks.find(b => b.meadow)?.meadow;
    const quizEdit = blocks.find(b => b.quiz)?.quiz;
    ok(storyEdit && quizEdit, 'the guide shows a story edit and a quiz edit');
    ok(/"title": "'Fox at dawn'"/.test(guide) && /"title": "heroName"/.test(guide), 'it shows quoted text, and a name for a value (D36)');
    const dir = await story();
    edit(path.join(dir, 'experience.json'), (e) => { e.story.scenes.meadow = storyEdit; });
    eq((await check(dir)).diags.filter(d => d.code.startsWith('E-')).map(d => `${d.code} ${d.message}`), [], 'the story edit checks clean');
    const parent = tmp('quiz');
    await newFromTemplate('my-quiz', 'quiz', parent);
    const q = path.join(parent, 'my-quiz');
    edit(path.join(q, 'experience.json'), (e) => { e.story.scenes.quiz = quizEdit; });
    eq((await check(q)).diags.filter(d => d.code.startsWith('E-')).map(d => `${d.code} ${d.message}`), [], 'the quiz edit checks clean');
    for (const t of ['story', 'quiz']) {
      const readme = fs.readFileSync(path.join(repo, 'library', '2.0', 'templates', t, 'README.md'), 'utf8');
      ok(/"(?:title|q1)": "'[A-Z][^"']+'"/.test(readme), `the ${t} README shows text quoted (D36)`);
    }
  },
};
