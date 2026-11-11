// F1b item 2: the worked door 2 example of chapter 12. The example.tint capability declares keys, draws and
// contentTypes; the lamp experience uses all three. Copied to a folder outside the engine, it is pinned, checked,
// played and packed. tests/browser/f1b-tint-browser.mjs plays the packed page and reads the painted bulb.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { folderSource } from '../src/load.mjs';
import { checkExperience } from '../check/index.mjs';
import { Player } from '../src/story.mjs';
import { modulePort } from '../src/host.mjs';
import { unregister, registered } from '../src/capabilities.mjs';
import { registerAddon } from '../src/addon-door.mjs';
import { loadAddons, scanCode } from '../tools/addons.mjs';
import { checkFolder, pin } from '../tools/addon.mjs';
import { pack } from '../tools/pack.mjs';
import { describe } from '../check/diagnostics.mjs';
import { repo, schemas, eq, ok } from './helpers.mjs';

const EXAMPLES = path.join(repo, 'engine', 'v2', 'addons', 'examples');
const said = (list) => list.map(d => `${d.code} ${d.path} ${d.message}`).join(' | ');

async function outside() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-f1b-'));
  fs.cpSync(path.join(EXAMPLES, 'addons'), path.join(dir, 'addons'), { recursive: true });
  fs.cpSync(path.join(EXAMPLES, 'lamp'), path.join(dir, 'lamp'), { recursive: true });
  await pin(path.join(dir, 'lamp'));
  return { dir, exp: path.join(dir, 'lamp') };
}
const check = async (dir) => checkExperience(await folderSource(dir), schemas());

export const tests = {
  'the door 2 example add-on passes addon.mjs check, and the lamp checks clean in place'() {
    eq(checkFolder(path.join(EXAMPLES, 'addons', 'example.tint')), []);
    const m = JSON.parse(fs.readFileSync(path.join(EXAMPLES, 'addons', 'example.tint', 'manifest.json'), 'utf8'));
    eq(m.door, 2);
    ok(m.adds.draws.binding && m.adds.contentTypes.shade, 'it declares draws and a content type');
    return check(path.join(EXAMPLES, 'lamp')).then(r => eq(said(r.diags), ''));
  },
  async 'the lamp, from a folder outside the engine, checks clean, plays and packs with --allow example.tint'() {
    const { dir, exp } = await outside();
    const r = await check(exp);
    eq(said(r.diags), '');
    const loaded = await loadAddons(await folderSource(exp), r.experience, { allow: Object.keys(r.experience.addons || {}) });
    const lock = Object.fromEntries(loaded.map(a => [a.pinned, a.digest]));
    // loadAddons registers the capability for this process: unregister it after, so later test files see only the
    // engine's own capabilities.
    try {
      const p = new Player(r.experience, { capabilities: Object.fromEntries(loaded.map(a => [a.id, modulePort({ lock })])) });
      ok(p.start().ok);
      eq(p.read('room', 'bulbColor'), '#3a3a48', 'the bulb starts dark');
      ok(p.activate('room', 'switch').ok);
      eq(p.read('room', 'lit'), true);
      eq(p.read('room', 'bulbColor'), '#ffcc33', 'the value the binding names now holds the shade input');
    } finally { unregister('example.tint'); }
    let refused = null;
    try { await pack(exp, path.join(dir, 'out')); } catch (e) { refused = e; }
    ok(refused?.diags?.some(f => f.message.includes('--allow example.tint')), `${refused?.message}`);
    const out = await pack(exp, path.join(dir, 'out'), { allow: ['example.tint'] });
    ok(fs.readFileSync(out.htmlPath, 'utf8').includes('// addons/example.tint/index.mjs'), 'the page carries the add-on');
  },
  async 'item 3: a built-in preset this release does not hold says it comes with the add-ons release'() {
    const { exp } = await outside();
    const f = path.join(exp, 'scenes', 'room', 'scene.json');
    const s = JSON.parse(fs.readFileSync(f, 'utf8'));
    s.presets = [{ use: 'fireworks', with: {} }];
    fs.writeFileSync(f, JSON.stringify(s));
    const d = (await check(exp)).diags;
    ok(d.some(x => x.code === 'E-ADDON' && x.message.includes('fireworks is not a built-in preset in this release') && x.message.includes('comes with the hypersvg-addons release')), said(d));
  },
  'item 5: a finding\'s JSON Pointer keeps an add-on id with a dot as one token'() {
    const text = JSON.stringify({ values: { n: { initial: 1 } }, addons: { 'example.glow': { color: 1 } }, on: { 'example.glow:faded': [] }, bindings: [{ target: 'b', 'example.tint': { color: 'c' } }], inputs: { 'message.headline': { kind: 'content' } } }, null, 2);
    const at = (p) => describe([{ code: 'E-ADDON', file: 's.json', path: p, message: 'm' }], { read: () => text })[0];
    eq(at('addons.example.glow.color').pointer, '/addons/example.glow/color');
    eq(at('on.example.glow:faded').pointer, '/on/example.glow:faded');
    eq(at('bindings[0].example.tint.color').pointer, '/bindings/0/example.tint/color');
    eq(at('inputs.message.headline').pointer, '/inputs/message.headline');
    eq(at('values.n.initial').pointer, '/values/n/initial');
    eq(at('values.gone.initial').pointer, '/values/gone/initial', 'a place the file does not hold keeps one word per token');
    const lineOf = (needle) => text.slice(0, text.indexOf(needle)).split('\n').length;
    eq(at('on.example.glow:faded').line, lineOf('"example.glow:faded"'), 'the line is the key\'s');
  },
  async 'item 7: a pinned preset named in needs is told that a preset goes in presets, not needs'() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-f1b-'));
    fs.cpSync(path.join(EXAMPLES, 'addons'), path.join(dir, 'addons'), { recursive: true });
    fs.cpSync(path.join(EXAMPLES, 'noughts'), path.join(dir, 'noughts'), { recursive: true });
    const f = path.join(dir, 'noughts', 'experience.json');
    const e = JSON.parse(fs.readFileSync(f, 'utf8'));
    e.needs.push('example.shake@1.0.0');
    fs.writeFileSync(f, JSON.stringify(e, null, 2));
    await pin(path.join(dir, 'noughts'));
    const d = (await check(path.join(dir, 'noughts'))).diags;
    ok(d.some(x => x.code === 'E-NEEDS-UNKNOWN' && x.message.includes('a preset goes in presets, not needs')), said(d));
    ok(!d.some(x => x.message.includes('put its folder at addons/example.shake/')), 'it does not send the reader to pin it again');
  },
  'item 8: chapter 12 lists exactly the words the module and capability scans refuse, strings included'() {
    const text = fs.readFileSync(path.join(repo, 'spec', '2.0', '12-writing-an-addon.md'), 'utf8').replace(/\r\n/g, '\n');
    const code = fs.readFileSync(path.join(repo, 'engine', 'v2', 'tools', 'addons.mjs'), 'utf8');
    const listed = (start, end) => { const t = text.slice(text.indexOf(start)); return [...t.slice(0, t.indexOf(end)).matchAll(/`([A-Za-z_$]+)`/g)].map(m => m[1]); };
    const inCode = (name) => [...code.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`))[1].replace(/\/\/[^\n]*/g, '').matchAll(/'([^']+)'/g)].map(m => m[1]);
    eq(listed('The checker scans the code for these words:', '. The scan').sort(), inCode('MODULE_BANNED').filter(w => w !== 'import').sort(), 'the module list');
    eq(listed('The checker scans its code for these words:', '. It also').sort(), inCode('CAPABILITY_BANNED').sort(), 'the capability list');
    ok(scanCode("export function make(step) { return { f() { return 'top'; } }; }", 'module').join(' ').includes('"top"'), 'a string counts');
    ok(scanCode("export function install(door) { return {}; } const mouth = 'open';", 'capability').join(' ').includes('"open"'), 'a string counts');
    ok(scanCode('export default function install(door) { return {}; }', 'capability').join(' ').includes('export default'), 'export default');
    ok(scanCode("export * from './x.mjs';", 'module').join(' ').includes('export *'), 'export *');
  },
  'item 9: a style handle refuses a value that loads a file, holds markup or a backslash, and says why in a test page'() {
    const manifest = JSON.parse(fs.readFileSync(path.join(EXAMPLES, 'addons', 'example.tint', 'manifest.json'), 'utf8'));
    manifest.id = 'acme.paint';
    let handle = null;
    registerAddon({ manifest, digest: 'sha256:x', code: { install: () => ({}), attach: ({ door }) => { handle = door.part('room', 'bulb'); } } });
    try {
      const rec = registered().get('acme.paint');
      const el = { style: {} };
      const said = [];
      const warn = console.warn; console.warn = (m) => said.push(String(m));
      const ctx = (test) => ({ player: { def: () => ({}), state: { blocks: {} } }, door: { id: 'acme.paint', part: () => el, slot: () => null }, options: { test } });
      try {
        rec.attach(ctx(true));
        handle.style.fill = '#123456';
        eq(el.style.fill, '#123456', 'a plain value is set');
        for (const bad of ['url(#x)', 'red\\;', '<b>', 'image-set(a)', 'expression(1)']) handle.style.fill = bad;
        eq(el.style.fill, '#123456', 'every bad value is refused');
        eq(said.length, 5, said.join(' | '));
        ok(said[0].includes('acme.paint') && said[0].includes('style.fill') && said[0].includes('url(...)'), said[0]);
        ok(said[1].includes('backslash'), said[1]);
        said.length = 0;
        rec.attach(ctx(false));
        handle.style.fill = 'url(#y)';
        eq(said, [], 'a published page refuses without a word');
        eq(el.style.fill, '#123456');
      } finally { console.warn = warn; }
    } finally { unregister('acme.paint'); }
  },
  async 'content names the add-on\'s content type as <owner.name>.<type>; another name is refused'() {
    const { exp } = await outside();
    const f = path.join(exp, 'scenes', 'room', 'scene.json');
    const s = JSON.parse(fs.readFileSync(f, 'utf8'));
    s.inputs.shade.contentType = 'example.tint.hue';
    fs.writeFileSync(f, JSON.stringify(s));
    const d = (await check(exp)).diags;
    ok(d.some(x => x.path === 'inputs.shade.contentType' && x.message.includes('declares shade')), said(d));
  },
};
