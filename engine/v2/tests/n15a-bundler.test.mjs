// The bundler's on-demand loads, the two one-file players and the module list (added for 2.0.0-next.2).
// Each test fails without its addition.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq, ok } from './helpers.mjs';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { moduleList } from '../tools/module-list.mjs';
import { bundle } from '../tools/pack.mjs';
import { bundleAsset, BUNDLE, LEAN, assetSchemas } from '../tools/bundle-asset.mjs';
import { VERSION } from '../src/version.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..');
const web = path.join(repo, 'engine', 'v2', 'web');

// A small module tree: a.mjs imports b.mjs; it loads b.mjs, c.mjs (lazy, which imports e.mjs), d.mjs (not in the
// build) and a computed address on demand.
function tree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-n15a-'));
  const put = (f, t) => fs.writeFileSync(path.join(dir, f), t);
  put('a.mjs', [
    "import { b } from './b.mjs';",
    "const where = 'x' + '.mjs';",
    "export async function run() {",
    "  const out = { b: (await import('./b.mjs')).b === b };",
    "  const c1 = await import('./c.mjs'); const c2 = await import(\"./c.mjs\");",
    "  out.c = c1 === c2 && c1.c() === 'c+e';",
    "  try { await import('./d.mjs'); out.d = 'loaded'; } catch (e) { out.d = [e.code, e.message, e instanceof Error]; }",
    "  out.computed = String(run).includes('import(where)');",
    "  return out;",
    "}",
    "export function computed() { return import(where); }",
    '',
  ].join('\n'));
  put('b.mjs', "export const b = { name: 'b' };\n");
  put('c.mjs', "import { e } from './e.mjs';\nexport function c() { return 'c+' + e; }\n");
  put('e.mjs', "export const e = 'e';\n");
  return dir;
}
async function runBuilt(b, dir) {
  const file = path.join(dir, `built-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(file, `const defs = {}; const cache = {};\nfunction req(n) { if (n in cache) return cache[n]; const exp = cache[n] = {}; defs[n](exp); return exp; }\n${b.defs}\nexport const { run, computed } = req(${b.entry});\n`);
  return import(pathToFileURL(file));
}

export const tests = {
  'the bundler without dynamic: an import() stays as it is'() {
    const dir = tree();
    const b = bundle(path.join(dir, 'a.mjs'));
    ok(b.defs.includes("import('./b.mjs')") && b.defs.includes("import('./c.mjs')") && b.defs.includes("import('./d.mjs')"), 'the loads stay');
    eq(b.files.length, 2);
  },
  async 'the bundler with dynamic: in the build, the same instance; lazy adds a file and its imports; else E-ASSET; import(x) stays'() {
    const dir = tree();
    const b = bundle(path.join(dir, 'a.mjs'), [], { dynamic: { lazy: [path.join(dir, 'c.mjs')] } });
    eq(b.files.length, 4, 'a, b, c and e');
    ok(!/import\(\s*['"]/.test(b.defs), 'no relative import( is left');
    ok(b.defs.includes('import(where)'), 'the computed load stays');
    const m = await runBuilt(b, dir);
    const out = await m.run();
    eq(out.b, true, 'a load of a module in the build is the build\'s own instance');
    eq(out.c, true, 'a lazy module is in the build, once, with its imports');
    eq(out.d[0], 'E-ASSET');
    ok(out.d[2] && /d\.mjs/.test(out.d[1]) && /not part of this one-file build/.test(out.d[1]), out.d[1]);
    eq(out.computed, true);
    let err = null; try { await m.computed(); } catch (e) { err = e; }
    ok(err && err.code !== 'E-ASSET', 'import(x) is the language\'s own load');
  },
  'the one-file players are current'() {
    eq(fs.readFileSync(BUNDLE, 'utf8'), bundleAsset('full').text, 'run node engine/v2/tools/bundle-asset.mjs');
    eq(fs.readFileSync(LEAN, 'utf8'), bundleAsset('lean').text, 'run node engine/v2/tools/bundle-asset.mjs');
  },
  'the one-file players: no static import, import.meta only in the wrapper, no load of a module beside the file'() {
    for (const file of [BUNDLE, LEAN]) {
      const text = fs.readFileSync(file, 'utf8');
      const name = path.basename(file);
      ok(!/^\s*import[\s{*'"]/m.test(text), `${name} imports nothing`);
      eq(text.match(/\bimport\.meta\b/g).length, 1, `${name}: import.meta once`);
      ok(/^const __hsvgHere = import\.meta\.url;/m.test(text), `${name}: in the wrapper`);
      ok(!/\bimport\s*\(\s*['"`]/.test(text), `${name} has no import('...')`);
      eq(text.match(/\bimport\s*\(/g), ['import(', 'import('], `${name}: only the add-on loader's import(url) and the lean player's import of the full player`);
    }
  },
  'the full one-file player: every load on demand is the build\'s own or refused; it exports checkedParts'() {
    const text = fs.readFileSync(BUNDLE, 'utf8');
    ok(/^export const \{ mount, mountAsync, useSchemas, sharedSchemas, HyperSvgAsset, VERSION, elementVersion, repack, readAsset, checkedParts, logicPort \} = __hsvg;$/m.test(text));
    ok(text.includes('// engine/v2/web/audio-web.mjs\n'), 'it holds the sound');
    ok(/^const FULL_PLAYER = null;$/m.test(text), 'FULL_PLAYER is null');
    const refused = [...text.matchAll(/"([\w/.-]+) \(loaded on demand by [\w/.-]+\) is not part of this one-file build"/g)].map(m => m[1]).sort();
    eq(refused, ['engine/v2/src/capabilities/all.mjs', 'engine/v2/src/load.mjs'], 'only the dev player\'s loads, never taken here, are refused');
  },
  'the lean one-file player: its exports, no schemas, the sound inside and taken lazily, FULL_PLAYER beside it'() {
    const text = fs.readFileSync(LEAN, 'utf8');
    ok(/^export const \{ mountAsync, HyperSvgAsset, useSchemas, sharedSchemas, VERSION, elementVersion, logicPort \} = __hsvg;$/m.test(text), 'it exports exactly its list');
    eq(text.match(/^export\b.*$/gm).length, 1, 'one export line');
    ok(!text.includes(JSON.stringify(assetSchemas().document).slice(0, 200)), 'it holds no schemas');
    ok(/^const SCHEMAS = null;$/m.test(text));
    const audio = text.match(/^defs\[(\d+)\] = function \(exp\) \{ 'use strict'; \/\/ engine\/v2\/web\/audio-web\.mjs$/m);
    ok(audio, 'it holds audio-web.mjs');
    ok(text.includes(`Promise.resolve().then(() => req(${audio[1]}))`), 'the sound is loaded from the build itself');
    for (const m of ['web/mount-checked.mjs', 'src/load-asset.mjs', 'src/load.mjs', 'schema/validate.mjs']) ok(!text.includes(`// engine/v2/${m}\n`), `it does not carry ${m}`);
    ok(text.includes('engine/v2/web/mount-checked.mjs (loaded on demand by engine/v2/web/asset-lean.mjs) is not part of this one-file build'), 'the checked mount is refused');
    ok(text.includes("\nconst FULL_PLAYER = new URL('./hypersvg-asset.js' + new URL(__hsvgHere).search, __hsvgHere);"), 'FULL_PLAYER carries the query');
  },
  'the one-file players: the first line names the engine version'() {
    for (const [file, kind] of [[BUNDLE, 'full'], [LEAN, 'lean']]) {
      const first = fs.readFileSync(file, 'utf8').split('\n')[0];
      ok(first.startsWith(`/*! HyperSVG one-file player (${kind}), engine ${VERSION}. `) && first.includes(`engine ${VERSION}`) && first.endsWith('*/'), first.slice(0, 80));
    }
  },
  'the module list: the README section names exactly the files the tool lists for asset-web.mjs'() {
    const readme = fs.readFileSync(path.join(repo, 'engine', 'v2', 'README.md'), 'utf8');
    const at = readme.indexOf('## Files a host copies for the module player');
    ok(at >= 0, 'the README has the section');
    const block = readme.slice(at).match(/```text\n([\s\S]*?)```/);
    ok(block, 'the section has the list');
    eq(block[1].trim().split('\n'), moduleList([path.join(web, 'asset-web.mjs')], { core: true }));
  },
  'the module list: static imports, re-exports and relative dynamic imports, not import(x) or comments'() {
    const list = moduleList([path.join(web, 'asset-web.mjs')]);
    for (const f of ['engine/v2/web/asset-web.mjs', 'engine/v2/web/asset-schemas.mjs', 'engine/v2/web/mount-checked.mjs', 'engine/v2/src/load-asset.mjs', 'engine/v2/web/audio-web.mjs', 'engine/v2/src/capabilities/all.mjs']) ok(list.includes(f), `it lists ${f}`);
    eq([...list].sort(), list);
    eq(new Set(list).size, list.length);
    ok(list.every(f => f.endsWith('.mjs') && !f.includes('\\')), 'repository paths with "/"');
    const core = moduleList([path.join(web, 'asset-web.mjs')], { core: true });
    ok(core.includes('engine/v2/src/capabilities/all.mjs') && core.every(f => list.includes(f)), '--core lists a part of it, with all.mjs');
    ok(!core.some(f => /src\/capabilities\/(?!all\.mjs)/.test(f)), '--core does not follow all.mjs');
  },
};
