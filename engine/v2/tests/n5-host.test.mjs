// Small host additions (added after 2.0.0-next.0): emit's promise, the version, host words and the repack helper.
// Each test fails without its addition.
import { Player as BasePlayer } from '../src/story.mjs';
import { granting } from './helpers.mjs';
import { hostApi } from '../src/host.mjs';
import { eq, ok } from './helpers.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..');

const Player = granting(BasePlayer);
const exp = () => ({
  doc: { format: 'hsvg/2.0', kind: 'experience', id: 'x', language: 'en',
    inputs: { start: { kind: 'trigger' }, quiet: { kind: 'trigger' } },
    values: { best: { type: 'number', initial: 0, minimum: 0, maximum: 99 } },
    outputs: { won: { kind: 'event' }, bestScore: { kind: 'result', type: 'number', minimum: 0, maximum: 99, value: 'best' } },
    on: { start: [{ id: 's', actions: [{ id: 's1', set: 'best', to: 'best + 1' }, { id: 's2', emit: 'won' }] }] },
    story: { start: 'a', scenes: { a: 'a.json' } } },
  words: { en: {} }, data: {}, blocks: {},
  scenes: { a: { file: 'a.json', doc: { format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg' }, drawings: {}, words: {} } },
});
const make = (opts = {}) => { const p = new Player(exp(), {}); p.start(); return { p, h: hostApi(p, opts) }; };
const code = (fn) => { try { fn(); } catch (e) { return e.code; } return 'none'; };

export const tests = {
  async 'emit returns a promise of the step: it resolves after the reactions and listeners, with what was sent'() {
    const { h } = make();
    const heard = [];
    h.on('won', () => heard.push('won'));
    const p = h.emit('start');
    ok(p instanceof Promise, 'emit returns a promise');
    const r = await p;
    eq(heard, ['won']);
    eq(r, { name: 'start', payload: {}, outputs: [{ name: 'won', detail: {} }] });
    ok(Object.isFrozen(r));
    eq(h.read('bestScore'), 1);
    eq((await h.emit('quiet')).outputs, []);
  },
  async 'emit called from a listener waits for the step to end; its promise resolves when its own step ran'() {
    const { h } = make();
    let inner = null;
    let off = null;
    off = h.on('won', () => { off(); inner = h.emit('start'); });
    h.emit('start');
    ok(inner instanceof Promise, 'the waiting call returns a promise too');
    eq(h.read('bestScore'), 1, 'the waiting emit has not run yet');
    const r = await inner;
    eq([r.outputs.length, h.read('bestScore')], [1, 2]);
  },
  'a refused emit still throws at the call'() {
    const { h } = make();
    eq([code(() => h.emit('nothing')), code(() => h.emit('start', { x: 1 }))], ['E-REF-UNKNOWN', 'E-TYPE']);
  },
  async 'the version: the web entries export the engine version, the npm package version'() {
    // The npm package's file is release/npm-package.json here, and package.json in an exported base.
    const file = [path.join(repo, 'release', 'npm-package.json'), path.join(repo, 'package.json')].find(f => fs.existsSync(f) && JSON.parse(fs.readFileSync(f, 'utf8')).name === '@hypersvg/core');
    ok(file, 'the npm package file is here');
    const npm = JSON.parse(fs.readFileSync(file, 'utf8')).version;
    const entries = ['player-web', 'mount-web', 'asset-web', 'asset-lean'];
    const got = await Promise.all(entries.map(e => import(`../web/${e}.mjs`).then(m => m.VERSION)));
    eq(got, entries.map(() => npm));
    const { HyperSvgAsset } = await import('../web/asset-web.mjs');
    eq(HyperSvgAsset.version, npm);
  },
  async 'the version: a second copy that finds <hypersvg-asset> defined reads the version that defined it'() {
    const defined = new Map();
    const warned = [];
    const saved = { ce: globalThis.customElements, warn: console.warn };
    globalThis.customElements = { get: (n) => defined.get(n), define: (n, c) => defined.set(n, c) };
    console.warn = (m) => warned.push(m);
    try {
      defined.set('hypersvg-asset', class { static version = '2.0.0-next.9'; });
      const copy = await import('../web/asset-lean.mjs?second-copy');
      eq(copy.elementVersion(), '2.0.0-next.9');
      ok(warned.length === 1 && /already defined by player 2\.0\.0-next\.9/.test(warned[0]), `one plain warning (${warned.join(' | ')})`);
      defined.clear();
      const first = await import('../web/asset-lean.mjs?first-copy');
      eq([first.elementVersion(), defined.get('hypersvg-asset') === first.HyperSvgAsset], [first.VERSION, true]);
    } finally { globalThis.customElements = saved.ce; console.warn = saved.warn; }
  },
  async 'the host picks a theme the HyperSVG declares; any other is refused'() {
    const { place } = await import('../web/asset-lean.mjs');
    const { packAsset } = await import('../tools/pack.mjs');
    const { readAsset } = await import('../src/asset.mjs');
    const out = fs.mkdtempSync(path.join((await import('node:os')).tmpdir(), 'n5-theme-'));
    const a = readAsset(fs.readFileSync((await packAsset(path.join(here, 'k2f-fixture'), out)).svgPath, 'utf8'));
    const doc = JSON.parse(a.files['experience.json']);
    doc.themes.night = { colorRoles: { ...doc.themes.lamp.colorRoles, sun: '#b45309' } };
    const asset = { ...a, files: { ...a.files, 'experience.json': JSON.stringify(doc) } };
    let given = null;
    const fake = (el, pkg, o) => { given = { doc: JSON.parse(new TextDecoder().decode(pkg['experience.json'])), o }; return { read: () => undefined, set() {} }; };
    place({}, asset, {}, { theme: 'night', options: { language: 'en' } }, fake);
    eq([given.doc.theme, given.o.options], ['night', { language: 'en' }]);
    place({}, asset, {}, {}, fake);
    eq(given.doc.theme, 'lamp');
    eq([code(() => place({}, asset, {}, { theme: 'dusk' }, fake)), code(() => place({}, asset, {}, { theme: 3 }, fake))], ['E-AXIS-INPUT', 'E-AXIS-INPUT']);
  },
  async 'host words: a language the package lacks, checked as text, given to every owner of words'() {
    const { applyHostWords } = await import('../src/host-words.mjs');
    const e = () => ({ doc: { language: 'en' }, words: { en: { power: 'Lamp on', on: 'On', off: 'Off' }, de: { power: 'Lampe an' } }, scenes: { a: { words: { en: { on: 'Lit' } } } }, blocks: {} });
    const x = e();
    eq(applyHostWords(x, { language: 'fr', words: { power: 'Lampe allumée', on: 'Allumée' } }), 'fr');
    eq({ ...x.words.fr }, { power: 'Lampe allumée', on: 'Allumée', off: 'Off' });
    eq({ ...x.scenes.a.words.fr }, { on: 'Allumée' });
    eq(applyHostWords(e(), null), null);
    const bad = (w) => code(() => applyHostWords(e(), w));
    eq([
      bad({ language: 'de', words: {} }), bad({ language: 'en', words: {} }), bad({ language: 'French', words: {} }),
      bad({ language: 'fr', words: { nope: 'x' } }), bad({ language: 'fr', words: { on: 3 } }),
      bad({ language: 'fr', words: { on: 'a\u0007b' } }), bad({ language: 'fr', words: { on: 'x'.repeat(25) } }), bad({ language: 'fr', words: [] }),
    ], ['E-WORDS', 'E-WORDS', 'E-WORDS', 'E-WORDS', 'E-WORDS', 'E-WORDS', 'E-WORDS', 'E-WORDS']);
    eq(bad({ language: 'fr', words: { on: 'x'.repeat(24) } }), 'none', 'a short word may take up to 24 characters');
  },
  'host words: the player reads them in the host language'() {
    const x = exp();
    x.words = { en: { hi: 'Hello' } };
    x.scenes.a.words = { en: { hi: 'Hello there' } };
    return import('../src/host-words.mjs').then(({ applyHostWords }) => {
      const lang = applyHostWords(x, { language: 'fr', words: { hi: 'Bonjour' } });
      const p = new Player(x, {});
      p.state.ambient.language = lang;
      p.start();
      eq([p.words('experience').hi, p.words('a').hi], ['Bonjour', 'Bonjour']);
    });
  },
  async 'repack(files) gives the same bytes as pack --asset for the same files, also after an edit'() {
    const { repack } = await import('../src/repack.mjs');
    const { packAsset } = await import('../tools/pack.mjs');
    const { readAsset } = await import('../src/asset.mjs');
    const os = await import('node:os');
    const tmp = (n) => fs.mkdtempSync(path.join(os.tmpdir(), n));
    const packed = fs.readFileSync((await packAsset(path.join(here, 'k2f-fixture'), tmp('n5-rp-'))).svgPath, 'utf8');
    const files = readAsset(packed).files;
    eq(repack(files), packed, 'the lamp');
    const web = await import('../web/asset-web.mjs');
    eq(web.repack(web.readAsset(packed).files), packed, 'asset-web.mjs exports repack and readAsset');
    // A host cleans the drawing (drops its <desc>); the folder with the cleaned file packs to the same bytes.
    const drawing = 'scenes/lamp/lamp.svg';
    const cleaned = { ...files, [drawing]: files[drawing].replace(/<desc>[^<]*<\/desc>\n/, '') };
    ok(cleaned[drawing] !== files[drawing]);
    const dir = tmp('n5-rp-dir-');
    for (const [p, t] of Object.entries(cleaned)) { fs.mkdirSync(path.join(dir, ...p.split('/').slice(0, -1)), { recursive: true }); fs.writeFileSync(path.join(dir, ...p.split('/')), t); }
    const again = fs.readFileSync((await packAsset(dir, tmp('n5-rp-out-'))).svgPath, 'utf8');
    eq(repack(cleaned), again, 'the cleaned lamp');
    eq(readAsset(repack(cleaned)).files[drawing], cleaned[drawing]);
    // The car showcase, where it is here (not in the lean base).
    const car = path.join(repo, 'examples', '2.0-asset-car', 'car.svg');
    if (fs.existsSync(car)) { const t = fs.readFileSync(car, 'utf8'); eq(repack(readAsset(t).files), t, 'the car'); }
    const bad = (f) => { try { repack(f); return 'none'; } catch (e) { return e.code; } };
    eq([bad(null), bad({}), bad({ ...files, 'experience.json': '{"id": "../x"}' }), bad({ ...files, [drawing]: 3 })], ['E-ASSET', 'E-ASSET', 'E-ASSET', 'E-ASSET']);
  },
  'no kit or add-on code in a HyperSVG load, on either path (static and dynamic imports)'() {
    const graph = (file) => {
      const seen = new Set();
      const walk = (f) => {
        if (seen.has(f)) return;
        seen.add(f);
        const t = fs.readFileSync(f, 'utf8');
        // Dynamic imports are followed from the HyperSVG entries (their checked mount); player-web.mjs's are boot's,
        // the dev player's, which a placed HyperSVG never calls.
        const dynamic = /asset-(web|lean)\.mjs$/.test(f) ? '|\\bimport\\(\\s*' : '';
        for (const m of t.matchAll(new RegExp(`(?:^\\s*(?:import|export)\\s[^'"\`;]*?from\\s*|^\\s*import\\s*${dynamic})['"]([^'"]+)['"]`, 'gm'))) if (m[1].startsWith('.')) walk(path.resolve(path.dirname(f), m[1]));
      };
      walk(path.join(here, '..', ...file.split('/')));
      return [...seen].map(f => path.relative(path.join(here, '..'), f).split(path.sep).join('/'));
    };
    for (const entry of ['web/asset-web.mjs', 'web/asset-lean.mjs']) {
      const g = graph(entry);
      for (const m of ['src/kit.mjs', 'src/addons.mjs', 'src/load.mjs', 'web/mount-web.mjs']) ok(!g.includes(m), `${entry} reaches ${m}`);
      for (const m of ['web/mount-checked.mjs', 'src/load-asset.mjs', 'schema/check-document.mjs']) ok(g.includes(m), `${entry} lacks ${m} (the full check)`);
    }
    ok(graph('web/mount-web.mjs').includes('src/kit.mjs'), 'a package mount keeps the kit loader');
  },
  async 'the HyperSVG full check finds what loadExperience finds, and refuses a kit, a preset and an add-on pin'() {
    const { loadAsset } = await import('../src/load-asset.mjs');
    const { loadExperience } = await import('../src/load.mjs');
    const { loadSchemas } = await import('../schema/load.mjs');
    const { packAsset } = await import('../tools/pack.mjs');
    const { readAsset } = await import('../src/asset.mjs');
    const os = await import('node:os');
    const schemas = loadSchemas(path.join(repo, 'spec', '2.0'));
    const a = readAsset(fs.readFileSync((await packAsset(path.join(here, 'k2f-fixture'), fs.mkdtempSync(path.join(os.tmpdir(), 'n5-la-')))).svgPath, 'utf8'));
    const src = (files) => ({ read: (r) => (r in files ? files[r] : null) });
    const strip = (r) => JSON.stringify({ ok: r.ok, diags: r.diags, doc: r.experience?.doc, scenes: r.experience?.scenes });
    eq(strip(loadAsset(src(a.files), schemas)), strip(loadExperience(src(a.files), schemas)));
    const bad = { ...a.files, 'scenes/lamp/scene.json': a.files['scenes/lamp/scene.json'].replace('"kind": "scene"', '"kind": "scene", "nope": 1') };
    eq(loadAsset(src(bad), schemas).diags.map(d => d.code), loadExperience(src(bad), schemas).diags.map(d => d.code));
    const exp = JSON.parse(a.files['experience.json']);
    const withDoc = (d) => ({ ...a.files, 'experience.json': JSON.stringify(d) });
    const codes = (files) => loadAsset(src(files), schemas).diags.map(d => d.code).filter(c => c.startsWith('E-'));
    ok(codes(withDoc({ ...exp, kit: { id: 'k', version: '1.0.0' } })).length > 0, 'a kit pin is refused');
    ok(codes(withDoc({ ...exp, about: { ...exp.about, trust: { pins: { 'acme.glow@1.0.0': 'sha256:' + '0'.repeat(64) } } } })).includes('E-ASSET'), 'an outside add-on pin is refused');
    ok(codes(withDoc({ ...exp, presets: [] })).includes('E-ASSET'), 'a preset is refused');
  },
  async 'the one-file player: one module, the schemas inside, no kit or add-on code'() {
    const { bundleAsset, assetSchemas } = await import('../tools/bundle-asset.mjs');
    const { text, modules } = bundleAsset();
    ok(modules > 30, `${modules} modules`);
    ok(/^export const \{ mount, mountAsync, useSchemas, sharedSchemas, HyperSvgAsset, VERSION, elementVersion, repack, readAsset, checkedParts, logicPort \} = __hsvg;$/m.test(text), 'it exports what asset-web.mjs exports, and checkedParts');
    ok(!/^\s*import\s/m.test(text), 'it imports nothing');
    ok(text.includes(JSON.stringify(assetSchemas().document).slice(0, 200)), 'it holds the schemas');
    for (const m of ['src/kit.mjs', 'src/addons.mjs', 'src/load.mjs', 'web/mount-web.mjs']) ok(!text.includes(`// engine/v2/${m}\n`), `it carries ${m}`);
    ok(text.includes('// engine/v2/src/load-asset.mjs\n') && text.includes('// engine/v2/web/mount-checked.mjs\n'), 'it carries the full check');
  },
};
