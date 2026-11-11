// The add-on door (D23, spec chapter 12): three kinds, one rule. Fast: no browser (x6-addons-browser.mjs plays the
// packed page). Each outside add-on is used from a temp folder outside the engine: checked, pinned, played and packed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkManifest, expandPresets } from '../src/addons.mjs';
import { folderSource } from '../src/load.mjs';
import { checkExperience } from '../check/index.mjs';
import { Player } from '../src/story.mjs';
import { modulePort } from '../src/host.mjs';
import { loadAddons, scanCode, addonDigest } from '../tools/addons.mjs';
import { create, checkFolder, pin } from '../tools/addon.mjs';
import { pack } from '../tools/pack.mjs';
import { repo, schemas, eq, ok } from './helpers.mjs';

const ADDONS = path.join(repo, 'engine', 'v2', 'addons');
const EXAMPLES = path.join(ADDONS, 'examples');
const STARTERS = ['bouncy-ball', 'breathe', 'confetti', 'gentle-motion', 'pop-in', 'snowfall', 'sparkle', 'wobble'];
const tmp = (name) => fs.mkdtempSync(path.join(os.tmpdir(), `hsvg-x6-${name}-`));
const codes = (list) => list.map(d => d.code);
const has = (list, code, words) => list.some(d => d.code === code && d.message.includes(words));

// The noughts example and its three add-ons, copied to a temp folder outside the engine and pinned there.
async function outside() {
  const dir = tmp('outside');
  fs.cpSync(path.join(EXAMPLES, 'addons'), path.join(dir, 'addons'), { recursive: true });
  fs.cpSync(path.join(EXAMPLES, 'noughts'), path.join(dir, 'noughts'), { recursive: true });
  await pin(path.join(dir, 'noughts'));
  return { dir, exp: path.join(dir, 'noughts') };
}
const check = async (dir) => checkExperience(await folderSource(dir), schemas());
// A player of a checked experience whose outside code is loaded as a host in Node does: the host's lock lists what it
// reviewed. lock: override the lock (a host that has not allowed an add-on).
async function play(dir, { lock } = {}) {
  const src = await folderSource(dir);
  const r = await check(dir);
  const loaded = await loadAddons(src, r.experience, { allow: Object.keys(r.experience.addons || {}) });
  const given = lock ?? Object.fromEntries(loaded.map(a => [a.pinned, a.digest]));
  const caps = Object.fromEntries(loaded.map(a => [a.id, modulePort({ lock: given })]));
  let p;
  try { p = new Player(r.experience, { capabilities: caps }); } catch (e) { return { started: { ok: false, fault: e }, r }; } // a mount fault
  return { p, started: p.start(), r };
}
const board = (p) => p.read('game', 'board').map(c => c || '-').join('');
// The game starts on the level picker: pick a level, press Play, and let the slide finish. After each move Bolt thinks,
// reaches and draws, so a test waits for it (a few seconds covers the longest wait).
const startGame = (p, level) => { ok(p.activate('pick', 'levels', level).ok); ok(p.activate('pick', 'go').ok); p.advance(600); };
const wait = (p) => p.advance(3500);

export const tests = {
  // ---- the chapter ----
  'the chapter "Writing an add-on" shows each worked example exactly as its file'() {
    const text = fs.readFileSync(path.join(repo, 'spec', '2.0', '12-writing-an-addon.md'), 'utf8').replace(/\r\n/g, '\n');
    const blocks = [...text.matchAll(/<!-- file: (\S+) -->\n```\w*\n([\s\S]*?)\n```/g)];
    eq(blocks.length, 11, 'eleven embedded files (the door 2 tint, stepper and swing are two each)');
    for (const [, file, body] of blocks) eq(body, fs.readFileSync(path.join(repo, ...file.split('/')), 'utf8').replace(/\r\n/g, '\n').replace(/\n$/, ''), `${file}: copy the file into the chapter`);
  },
  // ---- item 1: one rule; names ----
  'a manifest with each mistake gets a finding that says the fix'() {
    const base = { door: 1, id: 'acme.shake', version: '1.0.0', kind: 'preset', title: 'Shake', adds: { provides: { clips: {} } } };
    eq(codes(checkManifest(base, { folder: 'acme.shake' })), []);
    ok(has(checkManifest({ ...base, door: 3 }), 'E-CAPABILITY-FORMAT', 'write "door": 2'));
    ok(has(checkManifest({ ...base, id: 'shake' }, { folder: 'shake' }), 'E-CAPABILITY-GRAMMAR', 'name an outside add-on owner.name'));
    ok(has(checkManifest(base, { folder: 'acme.other' }), 'E-ADDON', 'name the folder after the id'));
    ok(has(checkManifest({ ...base, version: '1.0' }), 'E-ADDON', 'write for example "1.0.0"'));
    ok(has(checkManifest({ ...base, kind: 'widget' }), 'E-ADDON', 'is not one of preset, module, capability'));
    ok(has(checkManifest({ ...base, adds: { provides: { scenes: {} } } }), 'E-CAPABILITY-GRAMMAR', 'a preset provides only'));
    ok(has(checkManifest({ ...base, adds: { inputs: { n: { type: 'number' } }, provides: { clips: {} } } }), 'E-ADDON', 'give it "minimum" and "maximum"'));
    ok(has(checkManifest({ ...base, adds: { provides: { clips: { '{{size}}': {} } } } }), 'E-ADDON', 'declare it in adds.inputs'));
    const mod = { ...base, kind: 'module', adds: { exports: { go: { with: { type: 'object', properties: { n: { type: 'integer' } }, additionalProperties: false }, returns: { type: 'object', properties: {} }, budgetMs: 5000 } } } };
    const found = checkManifest(mod);
    ok(has(found, 'E-ADDON', 'write "type": "number", "step": 1'), 'integer is not a content type');
    ok(has(found, 'E-ADDON', 'add "additionalProperties": false'), 'returns is closed');
    ok(has(found, 'E-ADDON', 'an integer 1..1000'), 'budgetMs');
    const cap = { ...base, kind: 'capability', adds: { events: ['Bad name'] } };
    ok(has(checkManifest(cap), 'E-ADDON', 'calls, keys, controls or paints'));
    ok(has(checkManifest(cap), 'E-ADDON', 'camelCase'));
  },
  'every add-on the engine ships checks clean: the eight starters and the three examples'() {
    for (const s of STARTERS) eq(checkFolder(path.join(ADDONS, s)), [], s);
    for (const e of ['example.noughts', 'example.glow', 'example.shake']) eq(checkFolder(path.join(EXAMPLES, 'addons', e)), [], e);
    // A starter's folder is built-in: a bare name. Copied outside the engine, the same folder is refused.
    const dir = tmp('bare');
    fs.cpSync(path.join(ADDONS, 'wobble'), path.join(dir, 'wobble'), { recursive: true });
    ok(has(checkFolder(path.join(dir, 'wobble')), 'E-CAPABILITY-GRAMMAR', 'acme.wobble'));
  },

  // ---- item 2: presets ----
  'the eight starter presets expand into content that checks with no finding'() {
    const dir = tmp('starters');
    fs.mkdirSync(path.join(dir, 'scenes', 'a'), { recursive: true });
    const m = 'move-x -400..400; move-y -400..400; rotate -360..360; scale 0..2; opacity 0..1';
    fs.writeFileSync(path.join(dir, 'scenes', 'a', 'a.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>Starters</title><g id="content" data-hsvg-layer="content">
<g id="ball" data-hsvg-kind="part" data-hsvg-pivot="200 100" data-hsvg-motion="${m}"><circle cx="200" cy="100" r="20" fill="#e33"/></g>
<g id="logo" data-hsvg-kind="part" data-hsvg-pivot="200 280" data-hsvg-motion="${m}"><rect x="150" y="250" width="100" height="60" fill="#36c"/></g>
<g id="spot" data-hsvg-kind="part" data-hsvg-pivot="200 200" data-hsvg-motion="${m}"><circle cx="200" cy="200" r="4" fill="#fc0"/></g>
<g id="sky" data-hsvg-kind="part"><rect x="0" y="0" width="400" height="10" fill="none"/></g></g></svg>\n`);
    const scene = { format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg',
      presets: [
        { use: 'bouncy-ball', as: 'ball-body', with: { target: 'ball' } }, { use: 'breathe', as: 'logo-breathe', with: { target: 'logo' } },
        { use: 'pop-in', as: 'spot-pop', with: { target: 'spot' } }, { use: 'wobble', as: 'logo-wobble', with: { target: 'logo', amount: 12 } },
        { use: 'confetti', as: 'party', with: { target: 'sky', source: 'spot' } }, { use: 'sparkle', as: 'glints', with: { target: 'sky', source: 'spot' } },
        { use: 'snowfall', as: 'snow', with: { target: 'sky', source: 'spot' } },
      ],
      controls: { go: { kind: 'button', target: 'logo', event: 'go', label: 'Go' } },
      on: { go: [{ id: 'went', actions: [{ id: 'wob', play: 'logo-wobble' }, { id: 'c', call: 'effects.play', with: { effect: "'party'" } }, { id: 's', call: 'effects.play', with: { effect: "'glints'" } }] }] } };
    fs.writeFileSync(path.join(dir, 'scenes', 'a', 'scene.json'), JSON.stringify(scene));
    fs.writeFileSync(path.join(dir, 'experience.json'), JSON.stringify({ format: 'hsvg/2.0', kind: 'experience', id: 'starters', language: 'en', about: { title: 'Starters' },
      presets: [{ use: 'gentle-motion', as: 'soft' }], story: { start: 'a', scenes: { a: 'scenes/a/scene.json' }, ends: ['a'] } }));
    return check(dir).then(r => {
      eq(r.diags.map(d => `${d.code} ${d.message}`), []);
      const a = r.experience.scenes.a.doc;
      ok(a.clips['logo-wobble'] && a.clips['spot-pop'] && a.clips['logo-breathe'], 'the clips are added under their as names');
      ok(a.addons.effects.particles.party && a.addons.effects.particles.glints && a.addons.effects.particles.snow, 'the particle emitters are added under addons.effects (D31)');
      ok(a.addons?.physics?.bodies, 'the body settings are added under addons.physics (D28)');
      ok(r.experience.doc.themes.soft, 'the theme is added to the experience');
      eq(a.presets, undefined, 'the presets key is gone after expansion');
    });
  },
  'a preset use with a bad input is refused with the input, and a finding in what it added names the preset'() {
    const wobble = JSON.parse(fs.readFileSync(path.join(ADDONS, 'wobble', 'manifest.json'), 'utf8'));
    const of = () => ({ manifest: wobble });
    let x = expandPresets({ presets: [{ use: 'wobble', with: { target: 'logo', amount: 90 } }] }, of);
    ok(has(x.diags, 'E-ADDON-INPUT', 'it is 1..45'), JSON.stringify(x.diags));
    x = expandPresets({ presets: [{ use: 'wobble', with: {} }] }, of);
    ok(has(x.diags, 'E-ADDON-INPUT', 'add "target" to with'));
    x = expandPresets({ presets: [{ use: 'wobble', with: { target: 'logo', speed: 2 } }] }, of);
    ok(has(x.diags, 'E-ADDON-INPUT', 'it takes target, amount, durationMs'));
    x = expandPresets({ clips: { wobble: { durationMs: 1, tracks: [] } }, presets: [{ use: 'wobble', with: { target: 'logo' } }] }, of);
    ok(has(x.diags, 'E-ADDON', 'give the use another "as"'));
    // The checker names the preset: the shake preset aimed at a part that is not drawn.
    return outside().then(async ({ exp }) => {
      const f = path.join(exp, 'scenes', 'game', 'scene.json');
      const s = JSON.parse(fs.readFileSync(f, 'utf8'));
      s.presets[0].with.target = 'nowhere';
      fs.writeFileSync(f, JSON.stringify(s));
      const r = await check(exp);
      ok(r.diags.some(d => d.message.includes('(from the preset example.shake, used as nope)')), r.diags.map(d => d.message).join(' | '));
    });
  },

  // ---- item 3: logic modules ----
  'a logic module may not reach the page, the network, a clock or a random source'() {
    const bad = (src) => scanCode(src, 'module').join(' ');
    ok(bad('export function make(step) { return { f() { return Date.now(); } }; }').includes('"Date"'));
    ok(bad('export function make(step) { return { f() { return Math.random(); } }; }').includes('"random"'));
    ok(bad('export function make(step) { return { f() { return fetch("x"); } }; }').includes('"fetch"'));
    ok(bad('export function make(step) { return { f() { try { step(); } catch (e) {} } }; }').includes('"try"'));
    ok(bad('import x from "../engine.mjs"; export function make(step) {}').includes('only files of its own folder'));
    eq(bad('import { rules } from "./rules.mjs"; export function make(step) { return { f() { step(); return rules(); } }; }'), '');
    ok(scanCode('export function install(door) { fetch("https://x"); }', 'capability').join(' ').includes('"fetch"'), 'a capability may not reach the network');
  },
  async 'the outside module plays from a folder outside the engine, at each level, with its budget'() {
    const { exp } = await outside();
    const { p, started } = await play(exp);
    ok(started.ok, JSON.stringify(started.fault));
    startGame(p, 'easy');
    ok(p.activate('game', 'cells', 'c0').ok);
    eq(board(p), 'X---O----', 'level 1 takes the centre');
    wait(p);
    ok(p.activate('game', 'change-level').ok);
    p.advance(600);
    startGame(p, 'hard');
    for (const c of ['c4', 'c8', 'c1']) { p.activate('game', 'cells', c); wait(p); }
    ok(p.read('game', 'winner') !== 'X', 'level 3 does not lose');
  },
  async 'a module whose files changed after the pin is refused by the checker, which gives the digest to pin'() {
    const { exp, dir } = await outside();
    fs.appendFileSync(path.join(dir, 'addons', 'example.noughts', 'index.mjs'), '\n// changed\n');
    const r = await check(exp);
    ok(has(r.diags, 'E-ADDON', `pin "example.noughts@1.0.0": "${addonDigest(path.join(dir, 'addons', 'example.noughts'))}"`), r.diags.map(d => d.message).join(' | '));
  },
  async 'a host whose lock does not list the module does not run it'() {
    const { exp } = await outside();
    const { started } = await play(exp, { lock: { 'example.glow@1.0.0': 'sha256:' + '0'.repeat(64) } });
    eq(started.ok, false);
    ok(['E-MODULE-REVIEW', 'E-ADDON'].includes(started.fault.code), started.fault.code);
  },

  // ---- item 4: capabilities ----
  async 'the outside capability writes only its channel, emits its own event, and starts only when the host allows it'() {
    const { exp } = await outside();
    const { p } = await play(exp);
    startGame(p, 'easy');
    for (const c of ['c0', 'c3']) { ok(p.activate('game', 'cells', c).ok); wait(p); }
    ok(p.activate('game', 'cells', 'c6').ok); // the winning move: no reply, the glow starts at once
    eq(p.read('game', 'winner'), 'X');
    const seen = [];
    for (let i = 0; i < 8; i++) { p.advance(200); seen.push(p.read('game', 'glow')); }
    ok(seen.includes(1) && seen[seen.length - 1] === 0, `the glow pulses then fades: ${seen}`);
    eq(p.read('game', 'cheered'), true, 'content heard example.glow:faded');
    // Not in the host's lock: the mount faults with the grant to give.
    const glowOnly = { 'example.noughts@1.0.0': JSON.parse(fs.readFileSync(path.join(exp, 'experience.json'), 'utf8')).about.trust.pins['example.noughts@1.0.0'] };
    const refused = await play(exp, { lock: glowOnly });
    eq(refused.started.ok, false);
    ok(refused.started.fault.message.includes('the host has not allowed this capability'), refused.started.fault.message);
  },
  async 'a block\'s settings for a capability are checked against its keys and channels'() {
    const { exp } = await outside();
    const f = path.join(exp, 'scenes', 'game', 'scene.json');
    const s = JSON.parse(fs.readFileSync(f, 'utf8'));
    s.addons['example.glow'] = { part: 'board', color: 'gold', level: 'shine' };
    fs.writeFileSync(f, JSON.stringify(s));
    const r = await check(exp);
    ok(r.diags.some(d => d.path?.includes('addons.example.glow.color')), r.diags.map(d => `${d.path} ${d.message}`).join(' | '));
    ok(has(r.diags, 'E-ADDON', 'writes the value shine, which game does not declare'));
  },

  // ---- item 6: from a folder outside the engine, packed ----
  async 'each kind from a folder outside the engine checks clean and packs; a capability needs --allow'() {
    const { exp, dir } = await outside();
    eq((await check(exp)).diags, []);
    let refused = null;
    try { await pack(exp, path.join(dir, 'out')); } catch (e) { refused = e; }
    ok(refused && refused.diags?.some(f => f.message.includes('--allow example.glow')), `${refused?.message}`);
    const r = await pack(exp, path.join(dir, 'out'), { allow: ['example.glow', 'example.noughts'] });
    const html = fs.readFileSync(r.htmlPath, 'utf8');
    ok(html.includes('// addons/example.noughts/index.mjs') && html.includes('// addons/example.glow/index.mjs'), 'the page carries both add-ons, labelled by their ids');
    ok(!html.includes(dir) && !html.includes(os.tmpdir()), 'never the packing person\'s paths');
    ok(/defs\[\d+\] = function \(exp\) \{ \/\/ addons\/example\.noughts\/index\.mjs \(confined\)\nconst req = [^\n]*\nwith \(__hsvgConfined\)/.test(html), 'the module runs with the page\'s globals shut out (Y3: every name but the language\'s own)');
    ok(!/\\?"use\\?":\s*\\?"example\.shake/.test(html), 'presets are expanded at pack: no use is left');
    ok(html.includes('nope-x'), 'the shake preset\'s track is in the page');
  },

  // ---- item 5: the template ----
  'hsvg addon new writes a working add-on of each kind, whose own test passes and which checks clean'() {
    const dir = tmp('new');
    for (const kind of ['preset', 'module', 'capability']) {
      const id = `acme.first-${kind}`;
      const at = create(kind, id, dir);
      eq(checkFolder(at), [], kind);
      const t = spawnSync(process.execPath, [path.join(at, 'tests', `first-${kind}.test.mjs`)], { encoding: 'utf8' });
      eq(t.status, 0, `${kind}: ${t.stdout}${t.stderr}`);
      let again = null;
      try { create(kind, id, dir); } catch (e) { again = e.message; }
      ok(again?.includes('exists'), 'never overwrites');
    }
    let bare = null;
    try { create('preset', 'shake', dir); } catch (e) { bare = e.message; }
    ok(bare?.includes('owner.name'), bare);
  },
};
