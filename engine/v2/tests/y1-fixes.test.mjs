// Add-on safety, names and drafts. Each test reproduces an R3 finding; it failed on engine-2.0
// before the fix. Fast: no browser.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { repo, schemas, eq, ok } from './helpers.mjs';
import { folderSource } from '../src/load.mjs';
import { checkExperience } from '../check/index.mjs';
import { pin } from '../tools/addon.mjs';
import { pack, addonCode, bundle } from '../tools/pack.mjs';
import { addonDigest, loadAddons, checkAddonFiles, addonSnapshot } from '../tools/addons.mjs';
import { Player } from '../src/story.mjs';
import { modulePort } from '../src/host.mjs';
import { Engine } from '../src/runtime.mjs';
import { FORMAT } from '../src/limits.mjs';
import { makeDocumentChecker } from '../schema/check-document.mjs';
import { registerAddon } from '../src/addon-door.mjs';
import { registered, makePageDoor } from '../src/capabilities.mjs';

const EXAMPLES = path.join(repo, 'engine', 'v2', 'addons', 'examples');
const tmp = (name) => fs.mkdtempSync(path.join(os.tmpdir(), `hsvg-y1-${name}-`));
const check = async (dir) => checkExperience(await folderSource(dir), schemas());
const has = (list, code, words) => list.some(d => d.code === code && d.message.includes(words));
const said = (list) => list.map(d => `${d.code} ${d.message}`).join(' | ');
// The noughts example and its add-ons in a temp folder outside the engine. edit(dir) changes files before the pin.
async function noughts(edit = () => {}) {
  const dir = tmp('noughts');
  fs.cpSync(path.join(EXAMPLES, 'addons'), path.join(dir, 'addons'), { recursive: true });
  fs.cpSync(path.join(EXAMPLES, 'noughts'), path.join(dir, 'noughts'), { recursive: true });
  edit(dir);
  await pin(path.join(dir, 'noughts'));
  return { dir, exp: path.join(dir, 'noughts'), mod: path.join(dir, 'addons', 'example.noughts') };
}
const prepend = (file, text) => fs.writeFileSync(file, text + fs.readFileSync(file, 'utf8'));
async function packs(exp, out) {
  try { return { r: await pack(exp, out, { allow: ['example.glow', 'example.noughts'] }) }; } catch (e) { return { e }; }
}

// A tiny engine experience: scene "one" with the given keys (as x3-correctness).
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hsvg-version="2.0"><rect id="x" width="1" height="1"/></svg>';
const tiny = (scene, exp = {}) => ({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', story: { start: 'one', scenes: { one: 'one.json' } }, ...exp },
  words: { en: {} }, data: {},
  scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg', ...scene }, words: {}, drawings: { main: { text: svg } } } },
  blocks: {}, limits: { ...FORMAT },
});
const num = (initial = 0) => ({ type: 'number', initial, minimum: 0, maximum: 1e9 });
const read = (...p) => fs.readFileSync(path.join(repo, ...p), 'utf8').replace(/\r\n/g, '\n');

export const tests = {
  // ---- item 1: D26 in the docs ----
  'item 1: chapter 12, the modules README and A9.3 say modules are trusted code, not a sandbox (D26)'() {
    const ch12 = read('spec', '2.0', '12-writing-an-addon.md');
    const readme = read('engine', 'v2', 'modules', 'README.md');
    const a9 = read('spec', '2.0', 'addons', 'a09-trust.md');
    for (const [name, text] of [['chapter 12', ch12], ['modules README', readme], ['A9.3', a9]]) {
      ok(/trusted code, not a sandbox/i.test(text), `${name} says trusted code, not a sandbox`);
      ok(/2\.1/.test(text) && /isolation/i.test(text), `${name} says isolation is planned for 2.1`);
      ok(/fingerprint/.test(text) && /grant/.test(text), `${name} says admitted by fingerprint and grant`);
    }
    ok(!/runs sandboxed/i.test(ch12) && !/\*\*Sandboxed\.\*\*/.test(ch12), 'chapter 12 no longer promises a sandbox');
    ok(/step budget[^.]*per player/i.test(ch12) && /per player/i.test(readme), 'a step budget per player');
    ok(!/What a production host must add/.test(readme), 'the README does not present isolation as a host\'s job in 2.0');
  },

  // ---- item 2: the fingerprint covers every byte that runs ----
  async 'item 2: an import outside the add-on folder is refused at check and pack, and never runs unpinned'() {
    const { dir, exp, mod } = await noughts((d) => {
      prepend(path.join(d, 'addons', 'example.noughts', 'index.mjs'), 'import "./../outside.mjs";\n');
      fs.writeFileSync(path.join(d, 'addons', 'outside.mjs'), 'export const marker = "OUTSIDE-2";\n');
    });
    const r = await check(exp);
    ok(has(r.diags, 'E-ADDON', 'outside its folder'), `check refuses the escape: ${said(r.diags)}`);
    const p = await packs(exp, path.join(dir, 'out'));
    ok(p.e && !fs.existsSync(path.join(dir, 'out', 'noughts.html')), 'pack refuses');
    ok(p.e.diags?.some(d => d.message.includes('outside its folder')), `pack says why: ${p.e?.message}`);
    // The packer refuses on its own, not only through the checker.
    const own = addonCode(r.experience, await folderSource(exp), ['example.noughts']);
    eq(own.list.length, 0);
    ok(own.refused.some(d => d.message.includes('outside its folder')), JSON.stringify(own.refused));
    ok(addonDigest(mod).startsWith('sha256:'));
  },
  async 'item 2: an import of a file the digest leaves out (tests/, hidden) is refused'() {
    for (const [file, spec] of [['tests/helper.mjs', './tests/helper.mjs'], ['.hidden.mjs', './.hidden.mjs']]) {
      const { dir, exp } = await noughts((d) => {
        const m = path.join(d, 'addons', 'example.noughts');
        prepend(path.join(m, 'index.mjs'), `import { extra } from '${spec}';\n`);
        fs.mkdirSync(path.dirname(path.join(m, file)), { recursive: true });
        fs.writeFileSync(path.join(m, file), 'export function extra() { return 1; }\n');
      });
      const r = await check(exp);
      ok(has(r.diags, 'E-ADDON', 'not covered by its digest'), `${file}: ${said(r.diags)}`);
      const p = await packs(exp, path.join(dir, 'out'));
      ok(p.e, `${file}: pack refuses`);
    }
  },
  async 'item 2: a page carries exactly the files the pin hashed, and an in-folder import still packs'() {
    const { dir, exp } = await noughts((d) => {
      const m = path.join(d, 'addons', 'example.noughts');
      prepend(path.join(m, 'index.mjs'), 'import { tag } from "./lib/tag.mjs";\n');
      fs.mkdirSync(path.join(m, 'lib'));
      fs.writeFileSync(path.join(m, 'lib', 'tag.mjs'), 'export function tag() { return "IN-FOLDER-TAG"; }\n');
    });
    eq((await check(exp)).diags, []);
    const p = await packs(exp, path.join(dir, 'out'));
    ok(p.r, `${p.e?.message} ${said(p.e?.diags || [])}`);
    const html = fs.readFileSync(p.r.htmlPath, 'utf8');
    ok(html.includes('IN-FOLDER-TAG') && html.includes('// addons/example.noughts/lib/tag.mjs'), 'the in-folder import is carried, labelled');
    ok(/defs\[\d+\] = function \(exp\) \{ \/\/ addons\/example\.noughts\/lib\/tag\.mjs \(confined\)\n/.test(html), 'it runs confined as the module does');
  },

  // ---- item 3: the Node loader runs only the pinned bytes ----
  async 'item 3: after an edit and a new pin, the Node loader runs the new bytes, not a cached old module'() {
    const { exp, mod } = await noughts();
    const playEasy = async () => {
      const r = await check(exp);
      eq(r.diags, [], 'checks clean');
      const loaded = await loadAddons(await folderSource(exp), r.experience, { allow: Object.keys(r.experience.addons || {}) });
      const lock = Object.fromEntries(loaded.map(a => [a.pinned, a.digest]));
      const p = new Player(r.experience, { capabilities: Object.fromEntries(loaded.map(a => [a.id, modulePort({ lock })])) });
      ok(p.start().ok);
      p.activate('pick', 'levels', 'easy');
      p.activate('pick', 'go'); p.advance(600);
      p.activate('game', 'cells', 'c0');
      return p.read('game', 'board').map(c => c || '-').join('');
    };
    eq(await playEasy(), 'X---O----', 'level 1 takes the centre');
    const f = path.join(mod, 'index.mjs');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('const ORDER = [4, 0, 2, 6, 8, 1, 3, 5, 7]', 'const ORDER = [8, 0, 2, 6, 4, 1, 3, 5, 7]'));
    await pin(exp);
    eq(await playEasy(), 'X-------O', 'the edited, re-pinned module runs');
  },
  async 'item 3: the Node loader checks the pin and the import graph before it imports anything'() {
    const { exp, mod } = await noughts();
    const r = await check(exp);
    delete globalThis.__hsvgY1Ran;
    prepend(path.join(mod, 'index.mjs'), 'globalThis.__hsvgY1Ran = true;\n'); // changed after the pin
    let err = null;
    try { await loadAddons(await folderSource(exp), r.experience, { allow: Object.keys(r.experience.addons || {}) }); } catch (e) { err = e; }
    ok(err && /not the pinned/.test(err.message), `refused: ${err?.message}`);
    eq(globalThis.__hsvgY1Ran, undefined, 'the changed code never ran');
    // An escaping import, pinned: refused before import too.
    const b = await noughts((d) => {
      prepend(path.join(d, 'addons', 'example.noughts', 'index.mjs'), 'import "./../outside.mjs";\n');
      fs.writeFileSync(path.join(d, 'addons', 'outside.mjs'), 'globalThis.__hsvgY1Ran = "outside";\n');
    });
    const rb = await check(b.exp);
    err = null;
    try { await loadAddons(await folderSource(b.exp), rb.experience, { allow: Object.keys(rb.experience.addons || {}) }); } catch (e) { err = e; }
    ok(err && /outside its folder/.test(err.message), `refused: ${err?.message}`);
    eq(globalThis.__hsvgY1Ran, undefined, 'the outside file never ran');
  },

  // ---- item 4: every module shape the checker accepts packs into code that runs ----
  async 'item 4: a named re-export, an aliased one and an import with a trailing comment bundle into code that boots'() {
    const dir = tmp('shapes');
    const files = {
      'index.mjs': "import { choose } from './strategy.mjs'; // the strategy\nimport { pick as twice } from './strategy.mjs';\nexport function make(step) { return { go({ n }) { step(); return { n: choose(n), m: twice(n) }; } }; }\n",
      'strategy.mjs': "export { choose } from './decision.mjs';\nexport { double as pick } from './decision.mjs'; /* forwarded */\n",
      'decision.mjs': 'export function choose(n) { return n + 1; }\nexport const double = (n) => n * 2;\n',
    };
    for (const [f, t] of Object.entries(files)) fs.writeFileSync(path.join(dir, f), t);
    eq(checkAddonFiles(dir, 'module').map(f => f.message), [], 'the checker accepts it');
    const texts = Object.fromEntries(Object.entries(addonSnapshot(dir).texts).map(([f, t]) => [path.join(dir, f), t]));
    for (const opts of [{ strip: false }, { strip: false, texts, confined: Object.keys(texts) }]) {
      const b = bundle(path.join(dir, 'index.mjs'), [], opts);
      // eslint-disable-next-line no-new-func
      const entry = new Function(`const defs = []; const cache = {}; function req(n) { if (n in cache) return cache[n]; const exp = cache[n] = {}; defs[n](exp); return exp; }\n${b.defs}\nreturn req(${b.entry});`)();
      eq(entry.make(() => {}).go({ n: 3 }), { n: 4, m: 6 }, 'the bundled module runs as Node runs it');
    }
  },
  'item 4: an import or export the packer cannot read is refused at check with a clear message'() {
    const dir = tmp('forms');
    fs.writeFileSync(path.join(dir, 'b.mjs'), 'export function b() { return 1; }\n');
    for (const body of ["  import { b } from './b.mjs';\nexport function make(step) { return { f() { return b(); } }; }\n",
      "import { b } from './b.mjs'; const c = 1;\nexport function make(step) { return { f() { return b() + c; } }; }\n"]) {
      fs.writeFileSync(path.join(dir, 'index.mjs'), body);
      const found = checkAddonFiles(dir, 'module').map(f => f.message).join(' | ');
      ok(found.includes('one import or export per line'), `refused at check: ${found}`);
    }
  },

  // ---- item 5: a capability's page door is visual-only ----
  'item 5: an outside capability\'s attach door cannot write values, send, fire or pick'() {
    const value = { x: 1 };
    const calls = [];
    const player = {
      exp: { doc: {}, scenes: {} }, state: { blocks: { experience: { inputs: value } }, ambient: {}, revision: 3 },
      def: () => ({ addons: { 'acme.paint': { part: 'p' } } }), read: (a, n) => value[n], eval: () => 1, words: () => ({}), template: (a, t) => t,
      setInput: (n, v) => { value[n] = v; calls.push('setInput'); return { ok: true }; },
      applySettings: () => { calls.push('applySettings'); return { ok: true }; },
      send: () => { calls.push('send'); return { ok: true }; },
      transaction: () => { calls.push('fire'); return { ok: true }; }, emit() {}, queueAll() {},
      pick: () => { calls.push('pick'); return { ok: true }; },
      on: () => () => {},
    };
    const door = makePageDoor(player, 'acme.paint', { errors: [] });
    let seen = null;
    registerAddon({ manifest: { door: 1, id: 'acme.paint', version: '1.0.0', kind: 'capability', adds: {} }, digest: 'sha256:' + '0'.repeat(64),
      code: { install: () => ({}), attach: ({ door: d }) => { seen = d; } } });
    registered().get('acme.paint').attach({ player, door, container: null, win: null, options: {} });
    ok(seen, 'attach ran');
    eq(seen.read('experience', 'x'), 1, 'it reads');
    eq(seen.settings('experience'), { part: 'p' }, 'it reads its settings');
    for (const m of ['setInput', 'applySettings', 'send', 'fire', 'pick', 'closeDialog']) {
      let threw = false;
      try { if (typeof seen[m] === 'function') seen[m]('x', 7); else threw = true; } catch { threw = true; }
      ok(threw || seen[m] === undefined, `${m} is not on the visual-only door`);
    }
    eq(value.x, 1, 'no value was written');
    eq(calls, [], 'nothing was sent');
  },

  // ---- item 6: module limits per player ----
  async 'item 6: two players of one loaded experience keep their own module limits, in both mount orders'() {
    const { exp } = await noughts();
    const r = await check(exp);
    const loaded = await loadAddons(await folderSource(exp), r.experience, { allow: Object.keys(r.experience.addons || {}) });
    const lock = Object.fromEntries(loaded.map(a => [a.pinned, a.digest]));
    const mount = (limits) => {
      const p = new Player(r.experience, { capabilities: Object.fromEntries(loaded.map(a => [a.id, modulePort({ lock, ...limits })])) });
      ok(p.start().ok);
      p.activate('pick', 'levels', 'easy');
      p.activate('pick', 'go'); p.advance(600);
      return p;
    };
    const move = (p) => p.activate('game', 'cells', 'c0');
    // Strict first, then a normal player mounts the same experience object.
    const strict = mount({ maxSteps: 1 });
    const normal = mount({});
    eq(move(strict).ok, false, 'the strict player still faults after another player mounts');
    eq(move(normal).ok, true, 'the normal player moves');
    // Normal first, then strict.
    const normal2 = mount({});
    const strict2 = mount({ maxSteps: 1 });
    eq(move(normal2).ok, true, 'the normal player keeps its limits after a strict player mounts');
    eq(move(strict2).ok, false, 'the strict player faults');
  },

  // ---- item 7: names (D22) for changed: events and reserved events ----
  'item 7: an author\'s name hides the built-in\'s changed: event; changed:hsvg.<name> reaches the built-in'() {
    const on = (key) => ({ [key]: [{ id: 'c', actions: [{ id: 'a', set: 'score', to: 'score + 1' }] }] });
    // The author's now hides the built-in: the clock's tick is not its change.
    const shadowed = new Engine(tiny({ values: { now: num(40), score: num() }, on: on('changed:now') }), { epochMs: 0 });
    ok(shadowed.transaction('host', () => shadowed.mount('one', 'scene', 'one')).ok);
    shadowed.advance(3000);
    eq([shadowed.read('one', 'now'), shadowed.read('one', 'score')], [40, 0], 'the author\'s now did not change: no changed:now');
    // A write of the author's now is its change.
    const own = new Engine(tiny({ values: { now: num(40), score: num() }, on: { ...on('changed:now'), poke: [{ id: 'p', actions: [{ id: 's', set: 'now', to: '41' }] }] } }), { epochMs: 0 });
    ok(own.transaction('host', () => own.mount('one', 'scene', 'one')).ok);
    ok(own.transaction('host', () => own.emit('one', 'poke')).ok);
    eq(own.read('one', 'score'), 1, 'the author\'s write is heard');
    // changed:hsvg.now reaches the built-in clock even when shadowed.
    const builtin = new Engine(tiny({ values: { now: num(40), score: num() }, on: on('changed:hsvg.now') }), { epochMs: 0 });
    ok(builtin.transaction('host', () => builtin.mount('one', 'scene', 'one')).ok);
    builtin.advance(3000);
    eq(builtin.read('one', 'score'), 3, 'changed:hsvg.now heard once a second');
    // Unshadowed, the bare form still hears the built-in.
    const bare = new Engine(tiny({ values: { score: num() }, on: on('changed:now') }), { epochMs: 0 });
    ok(bare.transaction('host', () => bare.mount('one', 'scene', 'one')).ok);
    bare.advance(3000);
    eq(bare.read('one', 'score'), 3);
    // Another ambient producer: the person's muted setting, shadowed by an experience value named muted.
    const muted = new Engine(tiny({ values: { score: num() }, on: on('changed:muted') }, { values: { muted: { type: 'boolean', initial: false } } }), { epochMs: 0 });
    ok(muted.transaction('host', () => muted.mount('one', 'scene', 'one')).ok);
    ok(muted.transaction('widget', () => muted.setAmbient('muted', true)).ok);
    eq(muted.read('one', 'score'), 0, 'the ambient muted change does not reach the author\'s changed:muted');
  },
  async 'item 7: a reserved event name is refused as an emitted event, as in every author-chosen producer'() {
    const dir = tmp('ai');
    fs.cpSync(path.join(repo, 'engine', 'v2', 'tests', 'ai-fixture'), dir, { recursive: true });
    const f = path.join(dir, 'scenes', 'desk', 'scene.json');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('"emit": "guideAnswered"', '"emit": "paused"'));
    const r = await check(dir);
    ok(r.diags.some(d => d.code === 'E-NAME-RESERVED' && /emit$/.test(d.path || '')), said(r.diags));
  },
  async 'item 7: the checker accepts changed:hsvg.<name> for a built-in value and refuses it for an unknown one'() {
    const dir = tmp('ai2');
    fs.cpSync(path.join(repo, 'engine', 'v2', 'tests', 'ai-fixture'), dir, { recursive: true });
    const f = path.join(dir, 'scenes', 'desk', 'scene.json');
    const doc = JSON.parse(fs.readFileSync(f, 'utf8'));
    doc.on = { ...(doc.on || {}), 'changed:hsvg.language': [{ id: 'lang', actions: [] }] };
    fs.writeFileSync(f, JSON.stringify(doc));
    eq((await check(dir)).diags.filter(d => d.severity !== 'warning' && !/^W-/.test(d.code)).map(d => `${d.code} ${d.path} ${d.message}`), [], 'changed:hsvg.language is a built-in change event');
    doc.on = { 'changed:hsvg.nothing': [{ id: 'x', actions: [] }] };
    fs.writeFileSync(f, JSON.stringify(doc));
    ok((await check(dir)).diags.some(d => d.path?.includes('changed:hsvg.nothing')), 'an unknown built-in is refused');
  },

  // ---- item 8: drafts at real grammar positions, kit overrides included ----
  'item 8: E-DRAFT looks only at action positions: data rows with goSpot, grab, carryTo or giveBack fields pass'() {
    const checker = makeDocumentChecker(schemas());
    const diags = (doc, file = 'scenes/one/scene.json') => checker.check(JSON.stringify(doc), { file }).diags;
    const scene = (extra) => ({ format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg', ...extra });
    for (const k of ['goSpot', 'grab', 'carryTo', 'giveBack']) {
      const rows = { type: 'array', maxItems: 4, items: { type: 'object', properties: { [k]: { type: 'string', maxLength: 20 } }, additionalProperties: false }, initial: [{ [k]: 'north' }] };
      const d = diags(scene({ values: { rows } }));
      ok(!d.some(x => x.code === 'E-DRAFT'), `${k} as a data field is not a draft: ${said(d)}`);
      // As an action it is still a draft, at the root, in a machine and in a branch.
      const act = { id: 'a', [k]: 'x' };
      ok(diags(scene({ on: { go: [{ id: 'r', actions: [act] }] } })).some(x => x.code === 'E-DRAFT' && x.path === 'on.go[0].actions[0]'), `${k} in a reaction`);
      ok(diags(scene({ entry: [{ id: 'w', when: 'true', then: [act] }] })).some(x => x.code === 'E-DRAFT' && x.path === 'entry[0].then[0]'), `${k} in a branch`);
      ok(diags(scene({ machines: { m: { initial: 's', states: { s: { entry: [act] } } } } })).some(x => x.code === 'E-DRAFT' && x.path === 'machines.m.states.s.entry[0]'), `${k} in a machine state`);
    }
  },
  'item 8: content options in a kit experience\'s scene and shell overrides are a draft'() {
    const checker = makeDocumentChecker(schemas());
    const opt = { options: { fresh: { short: 'Fresh' } } };
    const doc = { format: 'hsvg/2.0', kind: 'experience', id: 'x', kit: { id: 'k', version: '1.0.0' },
      shell: { use: 'frame', with: { title: opt } },
      story: { start: 'one', scenes: { one: { use: 'page', with: { title: opt } } }, ends: ['one'] } };
    const d = checker.check(JSON.stringify(doc), { file: 'x/experience.json' }).diags;
    ok(d.some(x => x.code === 'E-DRAFT' && x.path === 'story.scenes.one.with.title'), `the scene override: ${said(d)}`);
    ok(d.some(x => x.code === 'E-DRAFT' && x.path === 'shell.with.title'), `the shell override: ${said(d)}`);
    // A component use's override names its use.
    const comp = { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg', uses: [{ id: 'u', block: 'b', slot: 's', with: { headline: opt } }] };
    const c = checker.check(JSON.stringify(comp), { file: 'scenes/one/scene.json' }).diags;
    ok(c.some(x => x.code === 'E-DRAFT' && x.path === 'uses[0].with.headline'), `the use's override names its index: ${said(c)}`);
  },
};
