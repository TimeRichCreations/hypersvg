// The one-file HyperSVG players for a CDN (added after 2.0.0-next.0; the lean one for 2.0.0-next.2): each is one ES
// module, so a page makes one request for the player instead of about fifty.
//   node engine/v2/tools/bundle-asset.mjs            # writes engine/v2/web/hypersvg-asset.js and hypersvg-asset-lean.js
//   node engine/v2/tools/bundle-asset.mjs --check    # exit 1 when a committed file is not what the engine makes now
//   node engine/v2/tools/bundle-asset.mjs <out folder>
// - hypersvg-asset.js (full), from web/asset-bundle-entry.mjs: the whole player, its full check and the core schemas.
//   It exports what asset-web.mjs exports (mount, mountAsync, useSchemas, sharedSchemas, HyperSvgAsset, VERSION,
//   elementVersion, repack, readAsset), the internal checkedParts, the checked mount the lean file borrows, and the
//   internal logicPort.
// - hypersvg-asset-lean.js (lean), from web/asset-lean.mjs: plays a file placed with integrity; no schemas inside. It
//   exports mountAsync, HyperSvgAsset, useSchemas, sharedSchemas, VERSION, elementVersion and the internal logicPort.
//   Its FULL_PLAYER is the
//   full file beside it, with the lean file's own query string.
// It uses the packer's bundler (pack.mjs bundle) with dynamic: a load on demand of a module in the build takes the
// build's own copy; any other is refused with E-ASSET. So neither file fetches a module. The first line of each file
// names the engine version. web/asset-schemas.mjs is replaced by a text that uses the file's own address.
// No dependencies; Node's standard library only. Run it after an engine change, before a release.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { bundle, PLAYER_NOTICE } from './pack.mjs';
import { VERSION } from '../src/version.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..');
const web = path.join(repo, 'engine', 'v2', 'web');
const posix = (p) => p.split(path.sep).join('/');
export const BUNDLE = path.join(web, 'hypersvg-asset.js');
export const LEAN = path.join(web, 'hypersvg-asset-lean.js');
const SCHEMAS_FILE = path.join(web, 'asset-schemas.mjs');
const BUILDS = {
  full: { out: BUNDLE, entry: path.join(web, 'asset-bundle-entry.mjs'), lazy: [],
    exports: ['mount', 'mountAsync', 'useSchemas', 'sharedSchemas', 'HyperSvgAsset', 'VERSION', 'elementVersion', 'repack', 'readAsset', 'checkedParts', 'logicPort'] },
  lean: { out: LEAN, entry: path.join(web, 'asset-lean.mjs'), lazy: [path.join(web, 'audio-web.mjs')],
    exports: ['mountAsync', 'HyperSvgAsset', 'useSchemas', 'sharedSchemas', 'VERSION', 'elementVersion', 'logicPort'] },
};
const KINDS = ['experience', 'scene', 'component', 'shell'];

// The core schemas an asset is checked with, as sharedSchemas gives them.
export function assetSchemas(root = repo) {
  const read = (f) => JSON.parse(fs.readFileSync(path.join(root, 'spec', '2.0', 'schemas', 'core', f), 'utf8'));
  return { kinds: Object.fromEntries(KINDS.map(k => [k, read(`${k}.schema.json`)])), document: read('document.schema.json'), drawing: read('drawing.rules.json'), capabilities: {}, addons: {} };
}

// The text that stands for web/asset-schemas.mjs in a build.
export function schemasText(kind) { // internal
  const schemas = kind === 'full' ? JSON.stringify(assetSchemas()).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029') : 'null';
  const full = kind === 'full' ? 'null' : "new URL('./hypersvg-asset.js' + new URL(__hsvgHere).search, __hsvgHere)";
  return `export const SCHEMAS_BASE = new URL('../../../spec/2.0/schemas/core/', __hsvgHere);\nexport const SCHEMAS = ${schemas};\nexport const ADDONS_BASE = new URL('./addons/', __hsvgHere);\nexport const FULL_PLAYER = ${full};\n`;
}

// A build's text: kind 'full' (the default) or 'lean'. Returns {text, modules, files}.
export function bundleAsset(kind = 'full') {
  const build = BUILDS[kind];
  if (!build) throw new Error(`no one-file build "${kind}"`);
  const b = bundle(build.entry, [], { texts: { [SCHEMAS_FILE]: schemasText(kind) }, labels: { [SCHEMAS_FILE]: `engine/v2/web/asset-schemas.mjs (${kind === 'full' ? 'the schemas' : 'the addresses'})` }, dynamic: { lazy: build.lazy } });
  const from = posix(path.relative(repo, build.entry));
  const text = [
    `/*! HyperSVG one-file player (${kind}), engine ${VERSION}. ${PLAYER_NOTICE} */`,
    `// The HyperSVG player in one module, made by engine/v2/tools/bundle-asset.mjs from ${from}.`,
    kind === 'full' ? '// Experimental (spec 10.16): this file and its exports, the same names as ./asset; checkedParts and logicPort are internal.'
      : '// Experimental (spec 10.16): this file and its exports. It plays a file placed with integrity and holds no schemas; logicPort is internal.',
    'const defs = {}; const cache = {};',
    'const __hsvgHere = import.meta.url; // the add-on modules and a pinned capability\'s schema (D55) are fetched from the package beside it',
    'function req(n) { if (n in cache) return cache[n]; const exp = cache[n] = {}; defs[n](exp); return exp; }',
    b.defs,
    `const __hsvg = req(${b.entry});`,
    `export const { ${build.exports.join(', ')} } = __hsvg;`,
    '',
  ].join('\n');
  // It must parse as a module: vm.SourceTextModule is behind a flag, so check the body as a function.
  new vm.Script(`(function () {\n${text.replace(/^export const \{[^}]*\} = __hsvg;$/m, '').replace('import.meta.url', "''")}\n})`, { filename: path.basename(build.out) });
  return { text, modules: b.files.length, files: b.files };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const { gzipSync } = await import('node:zlib');
  let failed = false;
  for (const kind of Object.keys(BUILDS)) {
    const { text, modules } = bundleAsset(kind);
    const file = BUILDS[kind].out;
    const size = `${modules} modules, ${Buffer.byteLength(text)} bytes, ${gzipSync(text, { level: 9 }).length} bytes gzip 9`;
    if (args[0] === '--check') {
      const now = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      if (now === text) { console.log(`${posix(path.relative(repo, file))} is current (${size})`); continue; }
      console.log(`${posix(path.relative(repo, file))} is ${now === null ? 'missing' : 'not current'}: run node engine/v2/tools/bundle-asset.mjs`);
      failed = true; continue;
    }
    const out = args[0] ? path.join(path.resolve(args[0]), path.basename(file)) : file;
    fs.writeFileSync(out, text);
    console.log(`wrote ${posix(path.relative(process.cwd(), out))}: ${size}`);
  }
  process.exit(failed ? 1 : 0);
}
