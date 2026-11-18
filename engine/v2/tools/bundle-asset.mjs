// The one-file HyperSVG player for a CDN (added after 2.0.0-next.0): one ES module with the whole player, its full
// check and the core schemas, so a page makes one request for the player instead of about fifty.
//   node engine/v2/tools/bundle-asset.mjs            # writes engine/v2/web/hypersvg-asset.js
//   node engine/v2/tools/bundle-asset.mjs --check    # exit 1 when the committed file is not what the engine makes now
//   node engine/v2/tools/bundle-asset.mjs <out file>
// It uses the packer's bundler (pack.mjs bundle): the engine's modules without their comments, joined in one scope.
// web/asset-schemas.mjs is replaced by a module that holds the schemas. The module exports what asset-web.mjs
// exports (mount, mountAsync, useSchemas, sharedSchemas, HyperSvgAsset, VERSION, elementVersion, repack, readAsset).
// No dependencies; Node's standard library only. Run it after an engine change, before a release.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { bundle, PLAYER_NOTICE } from './pack.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..');
const web = path.join(repo, 'engine', 'v2', 'web');
export const BUNDLE = path.join(web, 'hypersvg-asset.js');
const ENTRY = path.join(web, 'asset-bundle-entry.mjs');
const EXPORTS = ['mount', 'mountAsync', 'useSchemas', 'sharedSchemas', 'HyperSvgAsset', 'VERSION', 'elementVersion', 'repack', 'readAsset'];
const KINDS = ['experience', 'scene', 'component', 'shell'];

// The core schemas an asset is checked with, as sharedSchemas gives them.
export function assetSchemas(root = repo) {
  const read = (f) => JSON.parse(fs.readFileSync(path.join(root, 'spec', '2.0', 'schemas', 'core', f), 'utf8'));
  return { kinds: Object.fromEntries(KINDS.map(k => [k, read(`${k}.schema.json`)])), document: read('document.schema.json'), drawing: read('drawing.rules.json'), capabilities: {}, addons: {} };
}

// The module's text.
export function bundleAsset() {
  const schemas = JSON.stringify(assetSchemas()).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const texts = { [path.join(web, 'asset-schemas.mjs')]: `export const SCHEMAS_BASE = new URL('../../../spec/2.0/schemas/core/', __hsvgHere);\nexport const SCHEMAS = ${schemas};\nexport const ADDONS_BASE = new URL('./addons/', __hsvgHere);\n` };
  const b = bundle(ENTRY, [], { texts, labels: { [path.join(web, 'asset-schemas.mjs')]: 'engine/v2/web/asset-schemas.mjs (the schemas)' } });
  const text = [
    `/*! ${PLAYER_NOTICE} */`,
    '// The HyperSVG player in one module, made by engine/v2/tools/bundle-asset.mjs from engine/v2/web/asset-bundle-entry.mjs.',
    '// Experimental (spec 10.16): this file and its exports, the same names as ./asset.',
    'const defs = {}; const cache = {};',
    'const __hsvgHere = import.meta.url; // the add-on modules and a pinned capability\'s schema (D55) are fetched from the package beside it',
    'function req(n) { if (n in cache) return cache[n]; const exp = cache[n] = {}; defs[n](exp); return exp; }',
    b.defs,
    `const __hsvg = req(${b.entry});`,
    `export const { ${EXPORTS.join(', ')} } = __hsvg;`,
    '',
  ].join('\n');
  // It must parse as a module: vm.SourceTextModule is behind a flag, so check the body as a function.
  new vm.Script(`(function () {\n${text.replace(/^export const \{[^}]*\} = __hsvg;$/m, '').replace('import.meta.url', "''")}\n})`, { filename: 'hypersvg-asset.js' });
  return { text, modules: b.files.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const { text, modules } = bundleAsset();
  if (args[0] === '--check') {
    const now = fs.existsSync(BUNDLE) ? fs.readFileSync(BUNDLE, 'utf8') : null;
    if (now === text) { console.log(`${path.relative(repo, BUNDLE)} is current`); process.exit(0); }
    console.log(`${path.relative(repo, BUNDLE)} is ${now === null ? 'missing' : 'not current'}: run node engine/v2/tools/bundle-asset.mjs`);
    process.exit(1);
  }
  const out = args[0] ? path.resolve(args[0]) : BUNDLE;
  fs.writeFileSync(out, text);
  const { gzipSync } = await import('node:zlib');
  console.log(`wrote ${path.relative(process.cwd(), out)}: ${modules} modules, ${Buffer.byteLength(text)} bytes, ${gzipSync(text, { level: 9 }).length} bytes gzip 9`);
}
