// The packer: turns a checked 2.0 experience folder into ONE offline HTML file (10.9) and its package.json (10.8).
// Usage: node engine/v2/tools/pack.mjs <experience folder> <out folder> [--host <host-profile.json>] [--test] [--allow <add-on id>] [--kit <kit folder>] [--verbose]
//        node engine/v2/tools/pack.mjs --asset <asset folder> <out folder>    (one HyperSVG, <out>/<id>.svg; D45, packAsset)
// Writes <out>/<id>.html and <out>/package.json (a second experience packed into the same folder replaces its
// package.json, and the packer says so). --verbose names the files left out (not reached); without it, they are
// counted. Refuses (exit 1) when the checker finds an error (E-); warnings (W-) are printed and do not stop it. --accept-findings packs a folder with known errors anyway and lists them (for
// tests of content whose faults a person has not decided yet; never for publishing).
// Size limits (10.11, limits.json): the core player's bundle is at most coreBundleBytes and each capability module it
// carries adds at most capabilityBundleBytes, gzip level 9; so does each logic module it carries (a seat's program, the
// chess module). The sizes are those of the built bundle: the engine's modules without their comments (strip.mjs); a
// logic module as its reviewed file. Over a limit the packer refuses with E-ENGINE-SIZE, as for a checker error;
// --accept-findings packs and lists it.
// --test keeps the test hooks in the page (?clock=manual, ?start=, ?partition=, the engine on window.hsvg) for test
// tools and browser tests; a page without it is the one to publish (web/packed-entry.mjs).
// --host names the host profile (A10.1) of the page: the person packing is its host. The page admits the experience
// only if that profile allows every limit it raises (9.8.1, E-HOST-LIMIT); without --host it allows only the format
// values. The packer refuses at once when the profile does not allow them.
//
// A kit experience's pinned kit (found as the checker finds it: kits/<id>/ in the folder or a parent folder) is packed
// at kits/<id>/, and package.json lists it under kits (10.8). The page plays the kit experience flattened (flattenKit):
// it carries no kit loader (D19).
//
// The page holds: the core player (every module reachable from web/packed-entry.mjs, joined by the small bundler
// below), the capability modules the experience's needs names (src/capabilities/<id>.mjs, and what they import;
// 1.1 principle 8), the logic modules it pins (engine/v2/modules/<name>/index.mjs, only for a needs entry
// <name>@<version>, with the engine's reviewed lock for them; 10.7, A9.3), the text files of the experience, and the
// sound/image/font/video/captions files as base64. Nothing is fetched. Node standard library only.
// The descriptor's about is the experience's, so about.trust.pins carries each module's pinned digest.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { folderSource, loadExperience } from '../src/load.mjs';
import { checkExperience } from '../check/index.mjs';
import { refusedLimits, refusalMessage, FORMAT } from '../src/limits.mjs';
import { packageNeeds, capabilityNames } from '../src/capabilities.mjs';
import { experienceResources } from '../src/host-profile.mjs';
import { makeDocumentChecker } from '../schema/check-document.mjs';
import { loadSchemas } from '../schema/load.mjs';
import * as planSolver from '../src/plan.mjs';
import { Player } from '../src/story.mjs';
import '../src/capabilities/all.mjs'; // the bake plays the experience with the capabilities its needs names, as a page does
import { Drawing } from '../src/drawing.mjs';
import { chooseLayout, shapeMapsOf, aspectsOf, parseSize, directionOf } from '../src/layout.mjs';
import { runLadder, readableFloor, textFloor, textStart, textStep, textLayout, BAKE_LINE_EM } from '../src/ladder.mjs';
import { parseXml } from '../schema/xml.mjs';
import { stripComments } from './strip.mjs';
import { metered } from './meter.mjs';
import { moduleDigest } from '../modules/make-lock.mjs';
import { addonSnapshot, importGraph, IMPORT_RE, EXPORT_DECL_RE, EXPORT_LIST_RE } from './addons.mjs';
import { roleOf } from '../src/marks.mjs';
import { makeAsset } from '../src/asset.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..');
const ENTRY = path.join(repo, 'engine', 'v2', 'web', 'packed-entry.mjs');
const CAPABILITIES = path.join(repo, 'engine', 'v2', 'src', 'capabilities');
const MODULES_DIR = path.join(repo, 'engine', 'v2', 'modules');
const MODULE_PORT = path.join(repo, 'engine', 'v2', 'src', 'modules.mjs');
const ADDON_DOOR = path.join(repo, 'engine', 'v2', 'src', 'addon-door.mjs');
const ENGINE_DIR = path.join(repo, 'engine', 'v2');
const ADDONS_DIR = path.join(repo, 'engine', 'v2', 'addons');

// The logic modules a list of needs selects: [{name, pinned, file, digest}] for each entry <name>@<version> that the
// engine's reviewed lock (engine/v2/modules/lock.json) lists and whose code is engine/v2/modules/<name>/index.mjs. A
// module named without a version, or at a version the lock does not list, adds no code: the checker refuses it
// (E-MODULE-REVIEW) and the page would refuse it at mount.
// The notice a packed page carries for the engine code inside it (Apache-2.0 asks that the licence travels with the
// code). A HyperSVG (pack --asset) holds no engine code, so it carries none.
export const PLAYER_NOTICE = 'HyperSVG player, licensed under the Apache License 2.0 (https://www.apache.org/licenses/LICENSE-2.0). Copyright 2026 TimeRich Creations.';

export function logicModules(needs = []) {
  const lock = JSON.parse(fs.readFileSync(path.join(MODULES_DIR, 'lock.json'), 'utf8'));
  const out = [];
  for (const n of [...new Set(needs)].sort()) {
    const at = n.indexOf('@');
    if (at < 1 || n.startsWith('font:')) continue;
    const name = n.slice(0, at);
    if (!/^[a-z][a-z0-9-]*$/.test(name) || !(n in lock)) continue;
    const file = path.join(MODULES_DIR, name, 'index.mjs');
    if (fs.existsSync(file)) out.push({ name, pinned: n, file, digest: lock[n] });
  }
  return out;
}

// The reviewed lock covers the module's bytes (modules/make-lock.mjs): each module the page would carry is hashed again
// here, and one whose files differ from its lock.json digest is E-MODULE-REVIEW (a changed module was not reviewed).
// mods: logicModules(...). Returns findings shaped as the checker's.
export function checkModuleBytes(mods) {
  const out = [];
  for (const m of mods) {
    const d = moduleDigest({ index: path.join(MODULES_DIR, m.name, 'index.mjs') });
    if (d !== m.digest) out.push({ code: 'E-MODULE-REVIEW', file: 'engine', path: `modules/${m.name}`, message: `the files of ${m.pinned} hash to ${d}, not the reviewed lock's ${m.digest}: review the change and run node engine/v2/modules/make-lock.mjs` });
  }
  return out;
}

// The programs a document's seats name (addons.seats.seats.*.program, fallback.program), as their pinned names
// (<name>@<version>, from about.trust.pins). A program without a pin adds nothing: the checker refuses it.
export function seatPrograms(doc) {
  const seats = doc?.addons?.seats?.seats;
  const pins = doc?.about?.trust?.pins;
  if (!seats || typeof seats !== 'object' || !pins || typeof pins !== 'object') return [];
  const out = [];
  for (const s of Object.values(seats)) {
    for (const n of [s?.program, s?.fallback?.program]) {
      if (typeof n !== 'string') continue;
      for (const k of Object.keys(pins)) if (k.startsWith(`${n}@`) && !out.includes(k)) out.push(k);
    }
  }
  return out;
}

// The capability modules a list of needs selects: [{id, file}] for each need with a module src/capabilities/<id>.mjs.
// A need without a module (synth, seats, fit, a font, a pinned module) adds no code here.
export function capabilityModules(needs = []) {
  const out = [];
  for (const id of [...new Set(needs)].sort()) {
    if (!/^[a-z][a-z0-9-]*$/.test(id) || id === 'all') continue;
    const file = path.join(CAPABILITIES, `${id}.mjs`);
    if (fs.existsSync(file)) out.push({ id, file });
  }
  return out;
}

// The engine's sizes (10.11), on the built bundle (comments removed, as the page carries it): the core player's bundle
// (web/packed-entry.mjs and what it imports), and each capability
// module's own cost: the gzip level 9 size of the bundle with the module, less the bundle without it. ids: capability
// ids with a module. pinned: logic modules' pinned names (chess@0.1.0); each counts as a capability bundle (10.11).
// Each row carries its limit from limits.json (FORMAT) and whether it is over.
const gz9 = (text) => gzipSync(Buffer.from(text), { level: 9 }).length;
// source: measure the modules as written, comments included (for comparison; the limits apply to the built bundle).
const coreSizes = {};
export function engineSizes(ids = [], pinned = [], { source = false, addons = [] } = {}) {
  const strip = !source;
  const coreSize = (coreSizes[strip] ??= gz9(bundle(ENTRY, [], { strip }).defs));
  const core = { gzip9: coreSize, max: FORMAT.coreBundleBytes, over: coreSize > FORMAT.coreBundleBytes };
  const row = (id, file) => {
    const gzip9 = gz9(bundle(ENTRY, [file], { strip }).defs) - coreSize;
    return { id, gzip9, max: FORMAT.capabilityBundleBytes, over: gzip9 > FORMAT.capabilityBundleBytes };
  };
  const capabilities = capabilityModules(ids).map(({ id, file }) => row(id, file));
  const modules = logicModules(pinned).map(({ pinned: id, file }) => row(id, file));
  // An outside add-on's code (chapter 12): its own cost, each at most capabilityBundleBytes.
  const addonRows = addons.map(({ pinned: id, file, texts }) => {
    const gzip9 = gz9(bundle(ENTRY, [file], { strip, texts }).defs) - coreSize;
    return { id, gzip9, max: FORMAT.capabilityBundleBytes, over: gzip9 > FORMAT.capabilityBundleBytes };
  });
  return { core, capabilities, modules, addons: addonRows };
}
// The findings for sizes over their limits, shaped as the checker's: code E-ENGINE-SIZE (10.11), and `limit`, the
// limit's id in limits.json.
export function sizeFindings(sizes) {
  const out = [];
  if (sizes.core.over) out.push({ code: 'E-ENGINE-SIZE', limit: 'coreBundleBytes', file: 'engine', path: 'core', message: `the core player's bundle is ${sizes.core.gzip9} bytes gzip 9, over coreBundleBytes ${sizes.core.max} (10.11)` });
  for (const c of sizes.capabilities) if (c.over) out.push({ code: 'E-ENGINE-SIZE', limit: 'capabilityBundleBytes', file: 'engine', path: `capabilities/${c.id}`, message: `the ${c.id} capability module adds ${c.gzip9} bytes gzip 9, over capabilityBundleBytes ${c.max} (10.11)` });
  for (const a of sizes.addons || []) if (a.over) out.push({ code: 'E-ENGINE-SIZE', limit: 'capabilityBundleBytes', file: 'engine', path: `addons/${a.id}`, message: `the add-on ${a.id} adds ${a.gzip9} bytes gzip 9, over capabilityBundleBytes ${a.max} (10.11, 12): make its code smaller` });
  for (const m of sizes.modules || []) if (m.over) out.push({ code: 'E-ENGINE-SIZE', limit: 'capabilityBundleBytes', file: 'engine', path: `modules/${m.id}`, message: `the logic module ${m.id} adds ${m.gzip9} bytes gzip 9, over capabilityBundleBytes ${m.max} (10.11)` });
  return out;
}

const TEXT_EXT = new Set(['.json', '.svg', '.csv']);
const SKIP_DIRS = new Set(['evidence', 'tests', 'node_modules', '.git']); // a package never carries these (10.8)
// Videos and their WebVTT captions (A2.1) travel as embedded bytes too: the page plays them from blob: URLs.

export class PackError extends Error {
  constructor(message, diags = []) { super(message); this.diags = diags; }
}

const sha256hex = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const posix = (p) => p.split(path.sep).join('/');

// ---------------------------------------------------------------------------------------------------------------
// The bundler. Each module becomes a function with its own scope that returns its exports. Imports become
// `const {a} = req(n)` at the same place. Supported: named, namespace and default imports of relative files;
// `export function|async function|class|const|let|var`, `export { a, b as c }` and `export { a, b as c } from './x.mjs'`.
// A trailing comment may follow a statement. Anything else is refused,
// as are import.meta, imports from outside (node: modules) and import cycles that need a non-function export.
// ---------------------------------------------------------------------------------------------------------------
// The forms (IMPORT_RE, EXPORT_DECL_RE, EXPORT_LIST_RE) are shared with the add-on checker: tools/addons.mjs.

function importLines(clause, id) {
  // clause: "{ a, b as c }", "* as ns", "name", "name, { a }" or "name, * as ns". Comments inside it are dropped.
  const out = [];
  let rest = clause.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ').trim();
  const star = rest.match(/\*\s+as\s+([\w$]+)\s*$/);
  if (star) { out.push(`const ${star[1]} = ${id};`); rest = rest.slice(0, star.index).replace(/,\s*$/, '').trim(); }
  const named = rest.match(/\{([^}]*)\}\s*$/);
  if (named) {
    const items = named[1].split(',').map(s => s.trim()).filter(Boolean)
      .map(s => { const m = s.match(/^([\w$]+)(?:\s+as\s+([\w$]+))?$/); if (!m) throw new PackError(`cannot read import item "${s}"`); return m[2] ? `${m[1]}: ${m[2]}` : m[1]; });
    if (items.length) out.push(`const { ${items.join(', ')} } = ${id};`);
    rest = rest.slice(0, named.index).replace(/,\s*$/, '').trim();
  }
  if (rest) out.push(`const ${rest} = ${id}.default;`);
  return out.join(' ');
}

// Names a clause imports from a module ("*" for a namespace).
function importedNames(clause) {
  const names = [];
  const named = clause.match(/\{([^}]*)\}/);
  if (named) for (const s of named[1].split(',').map(x => x.trim()).filter(Boolean)) names.push(s.split(/\s+as\s+/)[0]);
  if (/\*\s+as\s/.test(clause)) names.push('*');
  const lead = clause.replace(/\{[^}]*\}/, '').replace(/\*\s+as\s+[\w$]+/, '').replace(/,/g, '').trim();
  if (lead) names.push('default');
  return names;
}

// Numbers are assigned when a module is first reached: the entry's graph first, then each extra module's (the
// capability modules, which register themselves when run). Returns {entry, extras, defs, files}.
// strip (default true): the production build, each engine module's comments removed (strip.mjs); a logic module
// (engine/v2/modules) is carried exactly as its reviewed file. strip false gives the source as written.
// A module runs as `defs[n](exp)`: `exp` is its exports object. Function declarations are hoisted, so they are put
// on `exp` before the module's imports run; that is what lets two modules import each other's functions (the engine
// has one such pair). Other exports (const, class) are put on `exp` at the end, so a cycle that needs one is refused.
// confined: files of outside logic modules (chapter 12, D26). Each runs inside `with (__hsvgConfined)`, a scope that
// answers every free name the module does not declare itself: the language's plain objects (Math, JSON, Object, Array,
// Number, String, ...) and nothing else, so page names (top, parent, document, location, fetch, Date, an element id)
// read as undefined and cannot be written. Its code runs in strict mode (no global `this`), and its imports reach only
// the files it imports. It is a guard for reviewed code, not a sandbox: the host's review is what admits a module.
// labels: {file: name} for the comment on a module's line (an outside add-on is labelled addons/<id>/<file>, never by
// its path on the disk of the person packing).
// texts: {file: text}, the outside add-ons' files as their pin hashed them (tools/addons.mjs addonSnapshot). Such a file
// is bundled from this text, never read again, and may import only another file of `texts` (Y1: a page carries
// exactly what was hashed).
// The names a confined module reads from the language (the values of these globals); every other free name is undefined.
const CONFINED_OPEN = ['Math', 'JSON', 'Object', 'Array', 'Number', 'String', 'Boolean', 'Symbol', 'Map', 'Set', 'WeakMap', 'WeakSet',
  'BigInt', 'Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'URIError', 'EvalError', 'ArrayBuffer', 'DataView',
  'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array',
  'Float64Array', 'BigInt64Array', 'BigUint64Array', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent',
  'decodeURIComponent', 'Infinity', 'NaN', 'undefined'];
// The scope object, made once per page before the first confined module. `exp` and `req` pass to the module's own
// function (its exports and its imports), and `__hsvgTick` to the loop meter's checks; every other name stops here.
const CONFINE_HELPER = `const __hsvgReq = req;
const __hsvgConfined = (function () {
  'use strict';
  const open = Object.freeze({ __proto__: null, ${CONFINED_OPEN.map(n => `${n}: ${n === 'undefined' ? 'void 0' : n}`).join(', ')} });
  const own = (k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(open, k);
  return new Proxy(Object.create(null), {
    has: (t, k) => k !== 'exp' && k !== 'req' && k !== '__hsvgTick',
    get: (t, k) => (own(k) ? open[k] : undefined),
    set: () => false, defineProperty: () => false, deleteProperty: () => false, getOwnPropertyDescriptor: () => undefined,
    ownKeys: () => [], getPrototypeOf: () => null, setPrototypeOf: () => false, preventExtensions: () => false, isExtensible: () => true,
  });
})();`;
export function bundle(entryFile, extraFiles = [], { strip = true, confined = [], labels = {}, texts = {} } = {}) {
  const shut = new Set(confined.map(f => path.resolve(f)));
  const given = new Map(Object.entries(texts).map(([f, t]) => [path.resolve(f), t]));
  const mods = new Map();
  const stack = [];
  let counter = 0;
  const load = (file) => {
    const found = mods.get(file);
    if (found) return found;
    const rel = labels[file] ?? posix(path.relative(repo, file));
    const mod = { file, rel, n: counter++, done: false, body: '', names: [], deps: new Set(), shut: shut.has(path.resolve(file)) };
    mods.set(file, mod);
    stack.push(file);
    const sealed = given.has(path.resolve(file));
    let src = sealed ? given.get(path.resolve(file)) : fs.readFileSync(file, 'utf8');
    // The production build (10.11): the engine's comments stay in its source files; a logic module ships as reviewed.
    if (strip && file.startsWith(ENGINE_DIR + path.sep) && !file.startsWith(MODULES_DIR + path.sep) && !file.startsWith(ADDONS_DIR + path.sep)) {
      try { src = stripComments(src); } catch (e) { throw new PackError(`${rel}: ${e.message}`); }
    }
    // A logic module's loops and function bodies are metered (tools/meter.mjs, Q1c finding 6): its time budget holds
    // even if it never calls step(). Its reviewed text is otherwise carried as it is.
    if (mod.shut || file.startsWith(MODULES_DIR + path.sep)) {
      mod.metered = true;
      try { src = metered(src); } catch (e) { throw new PackError(`${rel}: the loader cannot meter its loops: ${e.message}`); }
    }
    if (/\bimport\.meta\b/.test(src)) throw new PackError(`${rel}: import.meta cannot be bundled`);
    if (/^export\s+default\b/m.test(src) || /^export\s*\*/m.test(src)) throw new PackError(`${rel}: "export default" and "export *" are not supported`);
    // Exports first, so a module that is reached again through a cycle already shows its names.
    let reexports = 0;
    const noComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    src = src.replace(EXPORT_LIST_RE, (whole, list, _q, spec) => {
      // A named re-export (Y1): export { a, b as c } from './x.mjs' reads the names from x's exports object.
      let from = null; let dep = null;
      if (spec) {
        if (!spec.startsWith('.')) throw new PackError(`${rel}: cannot bundle export from "${spec}"`);
        const depFile = path.resolve(path.dirname(file), spec);
        if (sealed && !given.has(depFile)) throw new PackError(`${rel}: exports from "${spec}", which is not a file its pin hashed: an add-on imports only files of its own folder`);
        dep = load(depFile);
        from = `__reexport${dep.n}_${reexports++}`;
        mod.deps.add(dep.n);
      }
      for (const item of noComments(list).split(',').map(s => s.trim()).filter(Boolean)) {
        const m = item.match(/^([\w$]+)(?:\s+as\s+([\w$]+))?$/);
        if (!m) throw new PackError(`${rel}: cannot read export item "${item}"`);
        if (dep && !dep.done && !dep.names.find(x => x.exported === m[1])?.hoisted) throw new PackError(`import cycle through ${rel}: it re-exports "${m[1]}", which is not a function declaration`);
        mod.names.push(from ? { exported: m[2] || m[1], local: `${from}.${m[1]}`, hoisted: false }
          : { exported: m[2] || m[1], local: m[1], hoisted: new RegExp(String.raw`^(?:async\s+)?function\s*\*?\s*${m[1]}\b`, 'm').test(src) });
      }
      return from ? `const ${from} = req(${dep.n});` : '';
    });
    src = src.replace(EXPORT_DECL_RE, (whole, kind, name) => { mod.names.push({ exported: name, local: name, hoisted: /function/.test(kind) }); return whole.replace(/^export\s+/, ''); });
    if (/^export\b/m.test(src)) throw new PackError(`${rel}: an export form is not supported`);
    src = src.replace(IMPORT_RE, (whole, clause, _q, spec) => {
      if (!spec.startsWith('.')) throw new PackError(`${rel}: cannot bundle import of "${spec}"`);
      const depFile = path.resolve(path.dirname(file), spec);
      if (sealed && !given.has(depFile)) throw new PackError(`${rel}: imports "${spec}", which is not a file its pin hashed: an add-on imports only files of its own folder`);
      const dep = load(depFile);
      mod.deps.add(dep.n);
      if (!dep.done && clause) { // a cycle edge: only hoisted functions (or the whole namespace) are there in time
        for (const name of importedNames(clause)) {
          if (name === '*') continue;
          const hit = dep.names.find(x => x.exported === name);
          if (!hit || !hit.hoisted) throw new PackError(`import cycle ${[...stack, depFile].map(f => posix(path.relative(repo, f))).join(' -> ')}: ${rel} needs "${name}", which is not a function declaration`);
        }
      }
      return clause ? importLines(clause, `req(${dep.n})`) : `req(${dep.n});`;
    });
    mod.body = src;
    stack.pop();
    mod.done = true;
    return mod;
  };
  const entry = load(entryFile);
  const extras = extraFiles.map(f => load(f).n);
  // The meter's check: moduleTick of src/modules.mjs, read when first called (no module of a page runs without it).
  const port = mods.get(MODULE_PORT)?.n;
  const tickLine = (r) => `const __hsvgTick = () => ${port === undefined ? 'true' : `${r}(${port}).moduleTick()`};`;
  const defs = [...mods.values()].sort((a, b) => a.n - b.n).map(m => {
    const first = m.names.filter(x => x.hoisted).map(x => `exp.${x.exported} = ${x.local};`).join(' ');
    const last = m.names.filter(x => !x.hoisted).map(x => `exp.${x.exported} = ${x.local};`).join(' ');
    if (!m.shut) return `defs[${m.n}] = function (exp) { 'use strict'; // ${m.rel}\n${m.metered ? tickLine('req') : ''}${first}\n${m.body}\n${last}\n};`;
    const deps = JSON.stringify([...m.deps].sort((a, b) => a - b));
    return `defs[${m.n}] = function (exp) { // ${m.rel} (confined)\nconst req = (n) => (${deps}.includes(n) ? __hsvgReq(n) : undefined); ${tickLine('__hsvgReq')}\nwith (__hsvgConfined) (function () { 'use strict';\n${first}\n${m.body}\n${last}\n}).call(undefined);\n};`;
  });
  const helper = [...mods.values()].some(m => m.shut) ? [CONFINE_HELPER] : [];
  return { entry: entry.n, extras, defs: [...helper, ...defs].join('\n'), files: [...mods.values()].map(m => m.rel) };
}

// ---------------------------------------------------------------------------------------------------------------
// The experience folder: text members, referenced binary members.
// ---------------------------------------------------------------------------------------------------------------
function listFiles(dir) {
  const out = [];
  const walk = (d, prefix) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isSymbolicLink()) continue; // never follow links
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(d, e.name), prefix + e.name + '/'); } else out.push(prefix + e.name);
    }
  };
  walk(dir, '');
  return out.sort();
}

// The binary members (10.8): the file of every declared resource (2.6) of the experience and its blocks (sounds,
// images, fonts, videos, captions), and the relative <image href> of a drawing (beside the drawing). Taken from the
// declarations, never by a pattern over the text, so any portable file name works (U+00C0-00FF, Greek).
function referencedBinaries(experience, all, texts) {
  const exists = new Set(all);
  const found = new Set();
  for (const r of experience ? experienceResources(experience) : []) {
    const norm = path.posix.normalize(r.path);
    if (exists.has(norm) && !TEXT_EXT.has(path.posix.extname(norm))) found.add(norm);
  }
  for (const [rel, text] of Object.entries(texts)) {
    if (path.posix.extname(rel) !== '.svg') continue;
    const base = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/') + 1) : '';
    for (const m of text.matchAll(/<image\b[^>]*?\s(?:xlink:)?href\s*=\s*(["'])([^"'#]+)\1/g)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(m[2])) continue; // data: (embedded); the drawing check refuses other schemes
      const norm = path.posix.normalize(base + m[2]);
      if (exists.has(norm) && !TEXT_EXT.has(path.posix.extname(norm))) found.add(norm);
    }
  }
  return [...found].sort();
}
// A path with a segment that starts with '.' (a hidden file or folder, or a climb) is never a member.
const hidden = (rel) => rel.split('/').some(p => p.startsWith('.'));

// The Content Security Policy of a packed page. Every directive is the least that works:
//  - default-src 'none' and connect-src 'none': no network of any kind. frame-src, worker-src, object-src and
//    media-src are written out as 'none' too, so the policy says it, not only the fallback.
//  - script-src 'sha256-...': only the one inline script, by hash. No 'unsafe-inline', no 'unsafe-eval'.
//  - style-src 'unsafe-inline': the drawings are inline SVG that carry style attributes and <style> elements, the
//    page has one small <style>, and the player writes style attributes (the fault message, the findings notice). A
//    hash cannot cover a style attribute, so styles need this; scripts do not.
//  - img-src data: blob: : SVG <image> parts may be data URLs, and the snapshot capability draws its picture from a
//    data: SVG and offers the PNG as a blob: download.
//  - font-src data: only when the package carries font files.
//  - base-uri 'none', form-action 'none': the page can re-base nothing and submit nothing (the shell's form widget
//    never submits; A6.1).
// What each capability in `needs` adds is in CAPABILITY_CSP. Sound needs nothing: it is decoded with Web Audio from
// the embedded bytes, not loaded by URL.
export const CAPABILITY_CSP = {
  synth: {}, snapshot: {}, widgets: {}, fit: {}, ladder: {}, lines: {}, 'rich-text': {}, physics: {}, effects: {}, motion: {}, page: {}, seats: {}, chess: {}, 'chess-opponent': {},
  // Recorded video (A2.1) plays from the embedded bytes, as a blob: URL (web/media-web.mjs); its captions track and
  // poster load the same way.
  media: { 'media-src': 'blob: data:' },
};
export function contentSecurityPolicy(scriptHash, { fonts = false, needs = [] } = {}) {
  const extra = {};
  for (const n of needs) for (const [k, v] of Object.entries(CAPABILITY_CSP[n] || {})) extra[k] = v;
  return ["default-src 'none'", `script-src 'sha256-${scriptHash}'`, "style-src 'unsafe-inline'", 'img-src data: blob:',
    ...(fonts ? ['font-src data:'] : []), `media-src ${extra['media-src'] || "'none'"}`, "frame-src 'none'", "worker-src 'none'",
    "object-src 'none'", "connect-src 'none'", "base-uri 'none'", "form-action 'none'"].join('; ');
}

// ---------------------------------------------------------------------------------------------------------------
// Baking layout plans (7.5, A7.1, 6.6). A block with a layout plan that does not solve while playing (fit is not in
// its needs or the experience's) gets a derived frame for each declared size: the solver runs at that size with the
// engine's own drawing, and the solved frame is written beside the block's document as
// <layout>-<W>x<H>.derived.svg, its tool record (<metadata>, 6.6) saying derived. The block's document lists it as a layout
// with that `size`, the same `layoutPlan` and that `drawing`. Each derived frame has a fit receipt (A8.1, A8.3). The
// declared sizes are the keys of the experience's own shape `sizes`; without them, those of every shape axis (the kit's,
// the experience's and each scene's). A component is baked
// at the size of the slot the plan of its scene gives it, and takes that size's class. A must size whose solve is
// incomplete stops the pack, nested components included.
// Not baked: a plan that repeats a list (its cells follow the live list), a block that is not drawn in some scene.
// ---------------------------------------------------------------------------------------------------------------
const solvesLive = (doc, exp) => (Array.isArray(doc?.needs) && doc.needs.includes('fit')) || (Array.isArray(exp?.doc?.needs) && exp.doc.needs.includes('fit'));
const hasPlan = (doc) => (doc?.layouts || []).some(l => l?.layoutPlan);
const MAX_LAYOUTS = 12;

// Returns {texts: {member: text} (new and changed members), receipts: [receipt], skipped: [{subject, size, reason}],
// incompleteMust: [{subject, size}]}. date: the receipts' date (ISO 8601, UTC).
// measure: the text measurer of the ladder, measure(px)(text) -> width in the text's own units. The default is the
// solver's pinned estimate (plan.mjs TEXT_MEASURER); a tool with a browser may pass the browser's.
export function bakePlans(experience, { date = new Date().toISOString().replace(/\.\d+Z$/, 'Z'), measure = estimateMeasure } = {}) {
  const out = { texts: {}, receipts: [], skipped: [], incompleteMust: [] };
  const owners = [...Object.values(experience.scenes), ...Object.values(experience.blocks)];
  if (experience.shell) owners.push(experience.shell);
  if (!owners.some(o => hasPlan(o.doc) && !solvesLive(o.doc, experience))) return out;
  if (experience.shell) { out.skipped.push({ subject: `document:${experience.shell.doc.id}`, size: '*', reason: 'baking an experience with a shell is not built yet' }); return out; }
  const classes = {}; // size -> must | should
  const addSizes = (doc) => { for (const a of doc?.axes || []) if (a?.axis === 'shape' && a.sizes) for (const [sz, c] of Object.entries(a.sizes)) classes[sz] ??= c; };
  // An experience that declares sizes of its own bakes only those (A7.1); else every size of the kit's and its scenes'
  // shape axes. A kit experience's own document is experience.own (kit.mjs); the kit's axes join experience.doc.
  addSizes(experience.own ?? experience.doc);
  if (!Object.keys(classes).length) {
    addSizes(experience.doc);
    for (const sc of Object.values(experience.scenes)) addSizes(sc.doc);
  }
  const entries = new Map(); // owner file | layout | size -> entry
  for (const [sceneId, sc] of Object.entries(experience.scenes)) {
    for (const sz of Object.keys(classes).sort()) {
      const size = parseSize(sz);
      if (!size) continue;
      const p = new Player(experience);
      p.state.story.resume = sceneId;
      if (!p.start().ok || p.scene !== sceneId) { out.skipped.push({ subject: `scene:${sceneId}`, size: sz, reason: 'the scene does not start on its own' }); break; }
      const space = { ...size, direction: directionOf(experience.doc, p.state.ambient?.language) };
      const pick = chooseLayout(sc.doc.layouts, space, { aspectOf: aspectsOf(sc), maps: shapeMapsOf(sc.doc, experience.doc) });
      const bake = [];
      const given = new Map(); // plan object -> the give-way steps its last solve took (8.4)
      const d = new Drawing(p, { planSolver: givingWay(experience, given), bake, layouts: {} });
      d.mountScene(sceneId, pick.id, size);
      for (const b of bake) {
        if (solvesLive(b.block.doc, experience)) continue;
        const W = Math.round(b.space.width); const H = Math.round(b.space.height);
        const key = `${b.block.file}|${b.layoutId}|${W}x${H}`;
        const planSteps = given.get(b.block.doc.layouts?.find(l => l.id === b.layoutId)?.layoutPlan) || [];
        // A nested block drawn at a size takes that size's class (must or should), and a placement shared by several
        // sizes keeps the strongest: a required nested text that cannot fit at a must size stops the pack (7.2).
        const cls = classes[sz] === 'must' ? 'must' : 'should';
        if (!entries.has(key)) entries.set(key, { ...b, ...bakeLadder(d, b, measure), planSteps, planRules: planSolver.planRules(b.block.doc.rules), size: `${W}x${H}`, cls, at: sz });
        else if (cls === 'must') entries.get(key).cls = 'must';
      }
    }
  }
  const docs = new Map(); // owner file -> doc copy
  for (const e of entries.values()) {
    const owner = e.block;
    const kind = Object.values(experience.scenes).includes(owner) ? 'scene' : 'document';
    const subject = `${kind}:${owner.doc.id}`;
    const layout = owner.doc.layouts.find(l => l.id === e.layoutId);
    if (planRepeatsOf(layout.layoutPlan)) { out.skipped.push({ subject, size: e.size, reason: 'a plan that repeats a list is solved while playing only' }); continue; }
    const doc = docs.get(owner.file) ?? structuredClone(owner.doc);
    docs.set(owner.file, doc);
    const id = `${e.layoutId}-${e.size}`;
    if (doc.layouts.some(l => l.size === e.size || l.id === id)) { out.skipped.push({ subject, size: e.size, reason: 'the block already has a layout for this size' }); continue; }
    if (doc.layouts.length >= MAX_LAYOUTS) { out.skipped.push({ subject, size: e.size, reason: `the block has ${MAX_LAYOUTS} layouts (7.5)` }); continue; }
    const dir = path.posix.dirname(owner.file);
    const file = `${id}.derived.svg`;
    const member = dir === '.' ? file : `${dir}/${file}`;
    // The text steps the bake's ladder took go in the frame's tool record (<metadata>, 6.6): a baked page reads them at
    // play, as the live ladder reports them (drawing.ladder, the ambient layout). The plan's steps are in the receipt.
    const stepRows = (e.ladder?.steps || []).map(r => `${r.rule}:${r.step}`);
    const derivedText = stepRows.length ? e.text.replace('<metadata>{"derived":"derived"}</metadata>', `<metadata>${JSON.stringify({ derived: 'derived', steps: stepRows.join(' ') })}</metadata>`) : e.text;
    out.texts[member] = derivedText + '\n';
    doc.layouts.push({ id, size: e.size, drawing: file, layoutPlan: structuredClone(layout.layoutPlan), label: `Derived from ${e.layoutId} at ${e.size}` });
    const reducedPlan = e.planSteps.length > 0;
    const status = e.record.status !== 'complete' || e.ladder?.outcome === 'incomplete' ? 'incomplete' : e.ladder?.outcome === 'reduced' || reducedPlan ? 'reduced' : 'pass';
    const ruleOf = (id) => e.planRules.find(r => r.id === id);
    const planStepRows = e.planSteps.flatMap(u => Array.from({ length: u.times }, () => ({ kind: 'give-way', rule: u.rule, subject: [].concat(ruleOf(u.rule)?.subject ?? []).join(' '), step: u.step })));
    if (status === 'incomplete' && e.cls === 'must') out.incompleteMust.push({ subject, size: e.size, unmet: e.record.unmet });
    out.receipts.push({
      format: 'hsvg/2.0', kind: 'receipt', id: `${owner.doc.id}-${id}-fit`, run: 'fit', subject,
      digest: 'sha256:' + sha256hex(Buffer.from(out.texts[member], 'utf8')), date, status,
      verdicts: { geometry: e.record.status === 'complete' ? 'pass' : 'fail', content: e.ladder?.outcome === 'reduced' ? 'reduced' : 'complete', layout: 'changed', reference: 'not-run', review: 'not-run' },
      selected: { size: e.size, layouts: { [subject]: e.layoutId }, ...(e.ladder?.tier ? { tiers: e.ladder.tier } : {}) },
      shares: e.record.shares, steps: [...planStepRows, ...(e.ladder?.steps || [])],
      rules: [...e.planRules.map(r => ({ rule: r.id, result: e.record.status === 'complete' ? 'pass' : 'fail', proof: 'files' })), ...(e.ladder?.rules || [])], unmet: [...e.record.unmet.map(u => ({ subject: u.subject, reason: u.reason })), ...(e.ladder?.unmet || [])],
      authority: { checker: 'hsvg-pack 2.0', measurer: e.record.measurer, ...(e.ladder ? { textMeasurer: measure === estimateMeasure ? planSolver.TEXT_MEASURER.id : 'given' } : {}) },
    });
  }
  for (const [file, doc] of docs) out.texts[file] = JSON.stringify(doc, null, 2) + '\n';
  return out;
}
const planRepeatsOf = (plan) => planSolver.planRepeats(plan).length > 0;
// The bake's solver: the plan solver with the plan steps of each block's inside and relation give-way rules (8.4), as
// the fit capability solves while playing. given: a Map the steps each plan's last solve took are written to.
function givingWay(experience, given) {
  const owners = [...Object.values(experience.scenes), ...Object.values(experience.blocks)];
  const outer = planSolver.planRules(experience.doc.rules);
  const rulesOf = new Map();
  for (const o of owners) for (const l of o.doc.layouts || []) if (l?.layoutPlan) rulesOf.set(l.layoutPlan, [...outer, ...planSolver.planRules(o.doc.rules)]);
  return Object.freeze({ ...planSolver, solve(plan, ctx) { const r = planSolver.solveGivingWay(plan, ctx, rulesOf.get(plan) ?? outer); given.set(plan, r.givenWay); return r; } });
}

// The solver's pinned estimate as a text measurer (A7.1): every character is 0.55 em wide.
export const estimateMeasure = (px) => (t) => [...String(t)].length * px * planSolver.TEXT_MEASURER.advance;

// The give-way ladder (8.4) on one baked frame: the text bindings of the frame's block under give-way fits and limit
// rules, with the same text steps (fit.mjs textStart, textStep, textLayout), order, priorities and floors as at play
// (drawing.mjs giveWay), measured by `measure` in the text's own units. The result goes into the derived frame: each
// text gets its wording and font size, and a removed text `display="none"`; the steps go in the receipt (A8.3).
// Keep rules (8.4) are baked as play takes them: a keep rule of the block on a part or a role of this frame holds
// while every text inside its subject fits (the texts under fits and limit rules, and the fitted texts, each measured
// with the same estimate at its smallest size); `shrink` shrinks those texts, `simplify` hides the subject's decoration
// paint (6.4) and `mark-only` its texts (display="none"). A keep rule's minSize and a `use:` subject are judged at play
// only. Returns {text, ladder} or {}.
// d: the bake's drawing; b: the bake entry {address, block, text, space}.
export function bakeLadder(d, b, measure = estimateMeasure) {
  const doc = b.block.doc;
  const frame = d.frames[b.address];
  if (!frame) return {};
  const all = d.giveWayAll().filter(({ rule }) => ['fits', 'limit'].includes(rule.kind));
  const keepRules = d.giveWayAll().filter(({ rule, at }) => rule.kind === 'keep' && at === b.address);
  if (!all.length && !keepRules.length) return {};
  let root;
  try { root = parseXml(b.text); } catch { return {}; }
  const byId = new Map();
  (function walk(n, parent) { if (!n.name) return; n.parent = parent; if (n.attrs.id) byId.set(n.attrs.id, n); n.children.forEach(c => walk(c, n)); })(root, null);
  const isScene = Object.values(d.engine.exp.scenes).some(sc => sc.doc === doc);
  const idOf = (local) => (isScene ? local : `${doc.id}__${local}`);
  const e = d.engine;
  const items = [];
  const fitted = []; // the fitted texts without a give-way rule: {t, fits}
  for (const bd of doc.bindings || []) {
    if (!('text' in bd) || !bd.fit || bd.flow) continue;
    const n = frame.byLocal.get(bd.target);
    const rules = n ? all.filter(({ rule, at }) => [].concat(rule.subject ?? []).some(x => typeof x === 'string' && d.namesText(x, at, b.address, bd, n))) : [];
    if (!rules.length) { if (keepRules.length && n) { const f = fittedText(d, b, bd, byId.get(idOf(bd.target)), byId.get(idOf(bd.fit.box)), measure); if (f) fitted.push(f); } continue; }
    const t = byId.get(idOf(bd.target)); const r = byId.get(idOf(bd.fit.box));
    if (!t || !r) continue;
    const tw = planSolver.worldOf(t);
    const inv = planSolver.invert(tw);
    if (!inv) continue;
    const box = planSolver.mapBox(inv, planSolver.mapBox(planSolver.worldOf(r), { x: +r.attrs.x || 0, y: +r.attrs.y || 0, width: +r.attrs.width || 0, height: +r.attrs.height || 0 }));
    const unit = Math.sqrt(Math.abs(tw[0] * tw[3] - tw[1] * tw[2])) || 1; // CSS px per text unit: the frame is drawn at its size
    const tt = d.tierText(b.address, bd);
    const wordings = tt ? tt.wordings : [e.template(b.address, bd.text)];
    let role = null; for (let x = n; x && !role; x = x.parent) role = roleOf(x.attrs);
    const readable = readableFloor(d.docsUp(b.address), role, e.host?.readable ?? 12);
    const floorPx = Math.max(...rules.map(({ rule }) => textFloor(rule, readable)));
    const drawnPx = Number(t.attrs['font-size']) || 16;
    const state = textStart({ wordings, fit: bd.fit, drawnPx, floorUnits: floorPx / unit, optional: tt ? tt.optional && !rules.some(({ rule }) => rule.floor?.keep === true) : false, steps: rules.flatMap(({ rule }) => rule.steps) });
    const it = { bd, rules, t, state, moved: false, room: box.width * 0.98, height: box.height, field: tt?.field ?? null };
    it.layout = () => textLayout(it.state, measure, it.room, it.height, BAKE_LINE_EM);
    items.push(it);
  }
  // Keep rules: their subject's elements in this frame, and the texts inside them.
  const inside = (subj, t) => { for (let x = t; x; x = x.parent) if (subj.includes(x)) return true; return false; };
  const keepState = new Map();
  for (const { rule } of keepRules) {
    const subj = [];
    for (const sj of [].concat(rule.subject ?? [])) {
      if (typeof sj !== 'string') continue;
      const form = sj.slice(0, sj.indexOf(':')); const name = sj.slice(sj.indexOf(':') + 1);
      if (form === 'part' && byId.get(idOf(name))) subj.push(byId.get(idOf(name)));
      if (form === 'role') (function walk(n) { if (!n.name) return; if (roleOf(n.attrs) === name) subj.push(n); n.children.forEach(walk); })(root);
    }
    if (!subj.length) continue;
    const decorations = [];
    for (const sn of subj) (function walk(n) { if (!n.name) return; if (n.attrs['data-hsvg-layer'] === 'decoration') decorations.push(n); n.children.forEach(walk); })(sn);
    keepState.set(rule, { subj, markOnly: false, simplified: false, texts: items.filter(it => inside(subj, it.t)), fitted: fitted.filter(f => !f.fits && inside(subj, f.t)), decorations });
  }
  if (!items.length && !keepState.size) return {};
  const ruleItems = new Map();
  for (const it of items) for (const { rule } of it.rules) { if (!ruleItems.has(rule)) ruleItems.set(rule, []); ruleItems.get(rule).push(it); }
  const textHolds = (it, rule) => {
    const l = it.layout();
    if (!l.fits) return false;
    if (rule.kind === 'limit') {
      if (typeof rule.maxLength === 'number' && [...l.text].length > rule.maxLength) return false;
      if (typeof rule.maxLines === 'number' && l.lines.length > rule.maxLines) return false;
    }
    return true;
  };
  const holds = (rule) => {
    const k = keepState.get(rule);
    if (k) return k.markOnly || (k.texts.every(it => textHolds(it, rule)) && !k.fitted.length);
    return (ruleItems.get(rule) || []).every(it => textHolds(it, rule));
  };
  const apply = (rule, step) => {
    const k = keepState.get(rule);
    if (k) {
      if (step === 'shrink') return k.texts.some(it => { const nx = textStep(it.state, 'shrink'); if (!nx) return false; it.state = nx; it.moved = true; return true; });
      if (step === 'mark-only') { if (k.markOnly || (!k.texts.length && !k.fitted.length)) return false; k.markOnly = true; return true; }
      if (step === 'simplify') { if (k.simplified || !k.decorations.length) return false; k.simplified = true; return true; }
      return false;
    }
    let any = false;
    for (const it of ruleItems.get(rule) || []) {
      if (textHolds(it, rule)) continue;
      const nx = textStep(it.state, step);
      if (nx) { it.state = nx; it.moved = true; any = true; }
    }
    return any;
  };
  const run = runLadder([...new Set([...ruleItems.keys(), ...keepState.keys()])], { holds, apply });
  // Write the result into the frame: the wording and size, or display="none" for a removed text.
  let text = b.text;
  const results = [];
  for (const it of items) {
    const l = it.layout();
    results.push({ binding: it.bd.id, field: it.field, text: l.text, px: l.px, lines: l.lines.length, outcome: l.removed ? 'removed' : !l.fits ? 'incomplete' : it.moved ? 'given-way' : 'fitted' });
    if (!it.moved) continue;
    const id = it.t.attrs.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(<text\\b[^>]*\\bid="${id}"[^>]*?)(\\s*/>|>[\\s\\S]*?</text>)`);
    text = text.replace(re, (all, open) => {
      let o = open.replace(/\sfont-size="[^"]*"/, '').replace(/\sdisplay="[^"]*"/, '');
      o += ` font-size="${+l.px.toFixed(3)}"`;
      if (l.removed) return `${o} display="none"/>`;
      return `${o}>${l.text.replace(/\n/g, ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
    });
  }
  // A kept subject's hidden parts: mark-only hides its texts, simplify its decoration paint.
  const hidden = [];
  for (const k of keepState.values()) {
    if (k.markOnly) for (const sn of k.subj) (function walk(n) { if (!n.name) return; if (n.name === 'text') hidden.push(n); n.children.forEach(walk); })(sn);
    if (k.simplified) hidden.push(...k.decorations);
  }
  text = hideElements(text, root, hidden);
  for (const it of items) { const r = results.find(x => x.binding === it.bd.id); if (r && hidden.includes(it.t) && r.outcome !== 'removed') r.outcome = 'given-way'; }
  const subjectOf = (rule) => [].concat(rule.subject ?? []).find(x => typeof x === 'string') ?? '';
  const rules = [...new Set([...ruleItems.keys(), ...keepState.keys()])];
  const steps = run.used.flatMap(u => { const rule = rules.find(x => x.id === u.rule); return Array.from({ length: u.times }, () => ({ kind: 'give-way', rule: u.rule, subject: subjectOf(rule), step: u.step })); });
  const tier = d.tierOf(b.address);
  const tiers = {};
  for (const r of results) if (r.field) tiers[r.field] = tier.tier;
  return {
    text,
    ladder: {
      outcome: run.outcome, steps, texts: results, tier: Object.keys(tiers).length ? tiers : null,
      rules: rules.map(rule => ({ rule: rule.id, result: holds(rule) ? 'pass' : 'fail', proof: 'files' })),
      unmet: results.filter(r => r.outcome === 'incomplete').map(r => ({ subject: r.field ? `field:${r.field}` : `binding:${r.binding}`, reason: 'the text does not fit at its floor' })),
    },
  };
}

// A fitted text without a give-way rule, as the bake measures it (the estimate): {t, fits} where fits says whether it
// fits its region at some size of its fit's search (7.6), or null. A keep step hides content, so a text overflows a
// kept subject only when it overflows by more than the estimate's tolerance (KEEP_TOLERANCE: real fonts run up to 10%
// narrower than the 0.55 em mean advance); a text the estimate puts just over its box keeps its subject whole, as play
// with the real font does.
export const KEEP_TOLERANCE = 0.9;
function fittedText(d, b, bd, t, r, measure0) {
  const measure = (px) => { const m = measure0(px); return (x) => m(x) * KEEP_TOLERANCE; };
  if (!t || !r) return null;
  const tw = planSolver.worldOf(t);
  const inv = planSolver.invert(tw);
  if (!inv) return null;
  const box = planSolver.mapBox(inv, planSolver.mapBox(planSolver.worldOf(r), { x: +r.attrs.x || 0, y: +r.attrs.y || 0, width: +r.attrs.width || 0, height: +r.attrs.height || 0 }));
  const tt = d.tierText(b.address, bd);
  let st = textStart({ wordings: tt ? tt.wordings.slice(0, 1) : [d.engine.template(b.address, bd.text)], fit: bd.fit, drawnPx: Number(t.attrs['font-size']) || 16, steps: ['shrink'] });
  for (;;) {
    if (textLayout(st, measure, box.width * 0.98, box.height, BAKE_LINE_EM).fits) return { t, fits: true };
    const nx = textStep(st, 'shrink');
    if (!nx) return { t, fits: false };
    st = nx;
  }
}
// The frame's text with display="none" on the given elements of its parsed tree (root), found in document order.
function hideElements(text, root, hidden) {
  if (!hidden.length) return text;
  const order = [];
  (function walk(n) { if (!n.name) return; order.push(n); n.children.forEach(walk); })(root);
  const want = new Set(hidden.map(n => order.indexOf(n)).filter(i => i >= 0));
  let i = -1;
  // Every element's start tag, in document order (comments, CDATA and declarations are skipped).
  return text.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<([A-Za-z][\w:.-]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)(\s*\/?)>/g, (all, name, attrs, end) => {
    if (!name) return all;
    i++;
    if (!want.has(i)) return all;
    return `<${name}${attrs.replace(/\sdisplay\s*=\s*("[^"]*"|'[^']*')/, '')} display="none"${end}>`;
  });
}

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// The small notice of a page packed with accepted findings: always on top, never in the way of a click.
const findingsNotice = (list) => {
  const codes = [...new Set(list.map(d => d.code))].sort();
  return `<div id="hsvg-findings" role="note" data-hsvg-findings="${list.length}" style="position:fixed;top:0;right:0;z-index:20;pointer-events:none;padding:2px 8px;background:#7a1010;color:#fff;font:12px/1.4 system-ui,sans-serif;opacity:.85">Not for publishing: packed with ${list.length} checker ${list.length === 1 ? 'error' : 'errors'} (${escapeHtml(codes.join(', '))})</div>`;
};
// JSON that is safe inside a <script> element: no "<" so "</script" and "<!--" cannot occur.
const scriptJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

// A kit experience flattened at pack time (4.8, 4.9, D19): the files as packed (texts: member path -> text, the kit's
// at kits/<id>/ and the baked frames included) loaded with the kit loader (src/kit.mjs, as the dev player does), so
// every kit check, pin, seal and right it makes at load runs here; the checker has already proved the rest. The
// result is the experience the player plays, as plain data: each drawing keeps its file and drops its text, which the
// page reads again from its files (web/player-web.mjs unflatten). A kit finding stops the pack.
export function flattenKit(texts) {
  const r = loadExperience({ read: (rel) => (rel in texts ? texts[rel] : null) }, null);
  const bad = r.diags.filter(d => d.code.startsWith('E-'));
  if (bad.length || !r.experience) throw new PackError('refusing to pack: the kit experience does not load', bad);
  const { own, kit, ...e } = r.experience;
  const lean = (b) => (b ? { ...b, drawings: Object.fromEntries(Object.entries(b.drawings || {}).map(([k, d]) => [k, { file: d.file }])) } : b);
  return JSON.parse(JSON.stringify({ ...e, shell: lean(e.shell), scenes: Object.fromEntries(Object.entries(e.scenes).map(([k, b]) => [k, lean(b)])), blocks: Object.fromEntries(Object.entries(e.blocks).map(([k, b]) => [k, lean(b)])) }));
}

// The code of the outside add-ons a package carries (chapter 12): each module or capability add-on that the
// experience pins and the package's needs names. Its files are hashed again (they must be the pin, the X1 rule), and a
// module or capability must be allowed by the person packing. Returns {list: [{id, pinned, kind, manifest, digest, file, files,
// labels}], refused: [finding]}.
export function addonCode(experience, source, needs, allow = []) {
  const list = []; const refused = [];
  const named = new Set(capabilityNames(needs));
  for (const [id, a] of Object.entries(experience?.addons || {})) {
    if (a.manifest.kind === 'preset' || !named.has(id)) continue;
    const dir = source.addonDir?.(id);
    const no = (message) => refused.push({ code: 'E-ADDON', file: 'experience.json', path: `about.trust.pins.${a.pinned}`, message });
    if (!dir) { no(`no folder for ${id}: put it at addons/${id}/`); continue; }
    // One read (Y1): the digest is of these texts, and the page carries these texts, nothing read again.
    const snap = addonSnapshot(dir);
    const digest = snap.digest;
    if (digest !== a.digest) { no(`the files of ${a.pinned} hash to ${digest}, not the pinned ${a.digest}: review the change, then pin the new digest`); continue; }
    const graph = importGraph(snap);
    const wrong = [...snap.links.map(f => `${f} is a link`), ...graph.problems.map(p => p.message)];
    if (wrong.length) { no(`${a.pinned}: ${wrong.join('; ')}`); continue; }
    // Code in the page needs the host's yes (D26): the person packing is the page's host and allows each add-on.
    if (!allow.includes(id) && !allow.includes(a.pinned)) { no(`${a.pinned} is a ${a.manifest.kind === 'module' ? 'logic module' : 'capability'} add-on: its code runs in the page, so the person packing reviews it and allows it as the page's host (pack ... --allow ${id})`); continue; }
    const at = (f) => path.join(dir, ...f.split('/'));
    list.push({ id, pinned: a.pinned, kind: a.manifest.kind, manifest: a.manifest, digest, file: at('index.mjs'), files: graph.files.map(at),
      texts: Object.fromEntries(graph.files.map(f => [at(f), snap.texts[f]])),
      labels: graph.files.map(f => [at(f), `addons/${id}/${f}`]) });
  }
  return { list, refused };
}

// Packs the folder. Returns {htmlPath, packagePath, bytes, members, id, csp}. Throws PackError when the check fails.
// host: the text of a host profile document, or null.
// date: the date of the fit receipts of baked plans (default now). sizes: the engine's sizes to judge instead of
// measuring them (tests of the refusal only).
// allow: the module and capability add-ons (ids, or id@version) the person packing allows as the page's host
// (chapter 12, D26); an outside add-on with code that is not allowed refuses the pack (E-ADDON). The page's reviewed
// lock then lists what the experience pins and the packer has hashed.
export async function pack(expDir, outDir, { acceptFindings = false, host = null, date, sizes: givenSizes = null, test = false, allow = [], kits: kitFolders = {} } = {}) {
  expDir = path.resolve(expDir);
  const schemas = loadSchemas(path.join(repo, 'spec', '2.0'));
  let hostProfile = null;
  if (host != null) {
    const r = makeDocumentChecker(schemas).check(host, { needs: [], file: 'host-profile' });
    const bad = r.diags.filter(d => d.code.startsWith('E-'));
    if (bad.length || r.doc?.kind !== 'host-profile') throw new PackError('the --host file is not a valid host profile', bad.map(d => ({ file: 'host-profile', ...d })));
    hostProfile = r.doc;
  }
  // The text members are the files the checker's loader reads (every document, drawing, words and data file the
  // entry reaches, 10.8 Integrity), never every file in the folder.
  const folder = await folderSource(expDir, { kits: kitFolders });
  const reached = new Set();
  const source = { ...folder, read(rel) { const t = folder.read(rel); if (t !== null) reached.add(path.posix.normalize(String(rel))); return t; } };
  const result = checkExperience(source, schemas);
  // A known add-on this release does not hold (W-ADDON-ABSENT, D30): its code is not here to pack.
  const absent = result.diags.filter(d => d.code === 'W-ADDON-ABSENT');
  if (absent.length) throw new PackError(`refusing to pack: ${absent.map(d => d.message.slice(6, d.message.indexOf(':'))).join(', ')} not in this release; pack with the hypersvg-addons release (W-ADDON-ABSENT)`, absent);
  const errors = result.diags.filter(d => d.code?.startsWith('E-'));
  if (errors.length && !acceptFindings) throw new PackError(`refusing to pack: ${errors.length} errors`, errors);
  // Errors packed with --accept-findings are written into the page and the descriptor, so the page never passes
  // for a clean one: package.json "findings", <html data-hsvg-findings> and a small visible notice.
  const accepted = errors.map(d => ({ code: d.code, file: d.file ?? '', path: d.path ?? '' }));
  const refused = result.experience ? refusedLimits(result.experience.raised, hostProfile) : [];
  if (refused.length) throw new PackError(`refusing to pack: the host does not allow the limits this experience raises (E-HOST-LIMIT): ${refusalMessage(refused)}`);
  const doc = JSON.parse(fs.readFileSync(path.join(expDir, 'experience.json'), 'utf8'));
  const id = doc.id;
  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) throw new PackError(`the experience id "${id}" cannot name a file`);

  // A kit experience's package carries its pinned kit at kits/<id>/ (10.8), with a digest for every member. The kit's
  // evidence/, tests/ and sample kit experiences are never members.
  const own = listFiles(expDir).filter(f => f !== 'package.json');
  const kitAt = {}; // member path -> file on disk, for kit files found outside the experience folder
  const kits = {};
  const kit = result.experience?.kit;
  // A library an experience picks items from (pick-and-use, 4.8) is carried the same way: only the files the loader
  // reached become members, so a package holds the picked items and what they use, not the whole library.
  const picked = Object.values(result.experience?.picked?.kits || {});
  for (const k of [...(kit ? [kit] : []), ...picked]) {
    const kid = k.doc.id;
    kits[kid] = { version: k.doc.about?.version, path: `kits/${kid}/kit.json` };
    const dir = source.kitDir(kid);
    const inside = own.some(f => f.startsWith(`kits/${kid}/`));
    const samples = Object.values(k.doc.samples || {}).map(f => path.posix.dirname(path.posix.normalize(f)) + '/');
    if (dir && !inside) {
      for (const rel of listFiles(dir)) {
        if (rel.startsWith('samples/') || samples.some(s => s !== './' && rel.startsWith(s))) continue;
        kitAt[`kits/${kid}/${rel}`] = path.join(dir, ...rel.split('/'));
      }
    }
  }
  const all = [...own, ...Object.keys(kitAt)].sort();
  const bytesOf = (rel) => fs.readFileSync(kitAt[rel] ?? path.join(expDir, ...rel.split('/')));
  const hiddenReached = [...reached].filter(hidden).sort();
  if (hiddenReached.length) throw new PackError(`refusing to pack: the experience reaches hidden files (a segment that starts with "."): ${hiddenReached.join(', ')}`);
  const texts = {};
  // An add-on's manifest is read by the loader but is no member: the page carries the expanded presets and the code.
  // A kit's catalogue is for finding items (4.8): a kit experience's page never needs it; a page that picks items
  // carries it, since the loader maps each item through it.
  const catalogues = new Set(kit && typeof kit.doc.catalogue === 'string' ? [path.posix.join(kit.root, kit.doc.catalogue)] : []);
  for (const rel of all) if (TEXT_EXT.has(path.posix.extname(rel)) && reached.has(rel) && !rel.startsWith('addons/') && !catalogues.has(rel)) texts[rel] = bytesOf(rel).toString('utf8');
  // The tool record (<metadata>, 6.6) is for tools: the page keeps it in a derived frame, whose steps the player reads,
  // and strips it from every other drawing (a declared resource keeps its bytes, as its digest says).
  const resourceFiles = new Set((result.experience ? experienceResources(result.experience) : []).map(r => path.posix.normalize(r.path)));
  for (const rel of Object.keys(texts)) if (rel.endsWith('.svg') && !resourceFiles.has(rel) && texts[rel].includes('<metadata') && !/<metadata>[^<]*"derived"\s*:\s*"derived"/.test(texts[rel])) texts[rel] = texts[rel].replace(/[ \t]*<metadata\b[^>]*(?:\/>|>[\s\S]*?<\/metadata\s*>)\r?\n?/, '');
  // Presets are expanded at pack (D23): a document that names presets is carried as the loader expanded it.
  for (const [rel, d] of Object.entries(result.experience?.presetExpanded || {})) if (rel in texts) texts[rel] = JSON.stringify(d, null, 2) + '\n';
  // Layout plans that do not solve while playing are baked into derived frames (7.5, A7.1).
  const baked = result.experience ? bakePlans(result.experience, { date }) : { texts: {}, receipts: [], skipped: [], incompleteMust: [] };
  if (baked.incompleteMust.length && !acceptFindings) throw new PackError(`refusing to pack: a layout plan is incomplete at a must size: ${baked.incompleteMust.map(x => `${x.subject} at ${x.size} (${x.unmet.length ? x.unmet.map(u => `${u.subject}: ${u.reason}`).join('; ') : 'the give-way ladder cannot fit its texts'})`).join(', ')}`);
  Object.assign(texts, baked.texts);
  const binaries = referencedBinaries(result.experience, all.filter(f => !hidden(f)), texts);
  // The files of the folder the page leaves out (unreferenced, hidden, or a sample), for the person packing.
  const leftOut = all.filter(f => !(f in texts) && !binaries.includes(f));
  const members = {};
  const binaryB64 = {};
  for (const rel of Object.keys(texts)) members[rel] = 'sha256:' + sha256hex(Buffer.from(texts[rel], 'utf8'));
  for (const rel of binaries) { const b = bytesOf(rel); members[rel] = 'sha256:' + sha256hex(b); binaryB64[rel] = b.toString('base64'); }
  const sortedMembers = Object.fromEntries(Object.entries(members).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

  // The package's needs: the union of its documents' needs (10.11), as the engine installs them.
  const needs = result.experience ? packageNeeds(result.experience) : (doc.needs || []);
  const caps = capabilityModules(capabilityNames(needs));
  // The logic modules: those needs pins, and the programs its seats name (A4.1), pinned in about.trust.pins.
  const logic = logicModules([...needs, ...seatPrograms(doc)]);
  const unreviewed = checkModuleBytes(logic);
  if (unreviewed.length) throw new PackError('refusing to pack: a logic module is not the reviewed one (E-MODULE-REVIEW)', unreviewed);
  // The outside add-ons with code (chapter 12): each pinned one the package's needs names, hashed again here.
  const outside = addonCode(result.experience, source, needs, allow);
  if (outside.refused.length) throw new PackError('refusing to pack: an add-on cannot be carried (E-ADDON)', outside.refused);
  // The engine's size limits (10.11), on the core and the capability modules this page carries.
  const sizes = givenSizes ?? engineSizes(caps.map(c => c.id), logic.map(m => m.pinned), { addons: outside.list }); // sizes: given by a test only
  const oversize = sizeFindings(sizes);
  // The core, a capability or a module over its cap refuses (D18, D19: the core's cap is a refusal again).
  if (oversize.length && !acceptFindings) throw new PackError(`refusing to pack: the engine is over its size limits (10.11)`, oversize);
  accepted.push(...oversize.map(d => ({ code: d.code, file: d.file, path: d.path })));
  // A kit experience is flattened into the form the player plays (D19): the page carries no kit loader.
  const kitted = kit || picked.length ? flattenKit(texts) : null;
  const withDoor = outside.list.length > 0;
  const extra = [...caps.map(c => c.file), ...logic.map(m => m.file), ...outside.list.map(a => a.file), ...(withDoor ? [ADDON_DOOR] : []), ...(logic.length || withDoor ? [MODULE_PORT] : [])];
  const bundled = bundle(ENTRY, extra, { confined: outside.list.filter(a => a.kind === 'module').flatMap(a => a.files), labels: Object.fromEntries(outside.list.flatMap(a => a.labels)), texts: Object.assign({}, ...outside.list.map(a => a.texts)) });
  const nOf = (file) => bundled.extras[extra.indexOf(file)];
  // Each outside add-on registers with the digest the packer hashed (src/addon-door.mjs).
  const addonLines = outside.list.map(a => `req(${nOf(ADDON_DOOR)}).registerAddon({ manifest: ${scriptJson(a.manifest)}, digest: ${scriptJson(a.digest)}, code: req(${nOf(a.file)}) });`);
  // The page is the modules' host: its reviewed lock lists exactly the modules it carries, and the capability add-ons
  // the person packing allowed.
  const pageLock = { ...Object.fromEntries(logic.map(m => [m.pinned, m.digest])), ...Object.fromEntries(outside.list.map(a => [a.pinned, a.digest])) };
  const lockLine = Object.keys(pageLock).length ? [...addonLines, `req(${nOf(MODULE_PORT)}).hostLock(${scriptJson(pageLock)});`] : [];
  const script = [
    // The licence notice travels with the engine code (R01): the build strips every other comment.
    `/*! ${PLAYER_NOTICE} */`,
    // Strict mode is per module (bundle): a confined module's scope (`with`) needs a sloppy frame around its code.
    '(function () {',
    'const defs = {}; const cache = {};',
    'function req(n) { if (n in cache) return cache[n]; const exp = cache[n] = {}; defs[n](exp); return exp; }',
    bundled.defs,
    `const pack = { files: ${scriptJson(texts)}, binaries: ${scriptJson(binaryB64)}, host: ${scriptJson(hostProfile)}${kitted ? `, kitted: ${scriptJson(kitted)}` : ''}${test ? ', test: true' : ''} };`,
    ...bundled.extras.map(n => `req(${n});`), // the capability modules register themselves before the player boots
    ...lockLine,
    `req(${bundled.entry}).run(pack);`,
    '})();',
  ].join('\n');
  try { new vm.Script(script, { filename: 'packed-script' }); } catch (e) { throw new PackError(`the bundled script does not parse: ${e.message}`); }
  const scriptHash = crypto.createHash('sha256').update(script, 'utf8').digest('base64');
  const csp = contentSecurityPolicy(scriptHash, { fonts: binaries.some(b => /\.(woff2?|ttf|otf)$/i.test(b)), needs: capabilityNames(needs) });

  const html = `<!doctype html>
<html lang="${escapeHtml(doc.language || 'en')}"${accepted.length ? ` data-hsvg-findings="${accepted.length}"` : ''}${test ? ' data-hsvg-test=""' : ''}>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(doc.about?.title || id)}</title>
<style>html, body { margin: 0; height: 100%; background: #fff4d8; } #stage { position: fixed; inset: 0; }</style>
</head>
<body>
<div id="stage"></div>
${accepted.length ? `${findingsNotice(accepted)}\n` : ''}<script>${script}</script>
</body>
</html>
`;
  // Another experience's package.json in the folder: refused before anything is written (its page would lose its
  // descriptor). Each experience packs into its own folder.
  const other = otherPackage(path.join(outDir, 'package.json'), id);
  if (other) throw new PackError(`refusing to pack: ${path.join(outDir, 'package.json')} is the package file of ${other}. Pack each experience into its own folder (for example ${path.join(outDir, id)}), or empty this one first`);
  fs.mkdirSync(outDir, { recursive: true });
  const htmlPath = path.join(outDir, `${id}.html`);
  fs.writeFileSync(htmlPath, html);

  const descriptor = {
    format: 'hsvg/2.0', kind: 'package', id,
    // The page carries the player's code, so its notice goes with it (R01), after the experience's own credits.
    about: { ...(doc.about || { title: id }), credits: [...(doc.about?.credits || []), PLAYER_NOTICE] },
    experience: 'experience.json',
    ...(Object.keys(kits).length ? { kits } : {}),
    needs,
    // The grants it asks for (10.5): as written, with openUrl and storage requested from use (D31.4). The host decides.
    ...(result.experience?.doc?.grants && Object.keys(result.experience.doc.grants).length ? { grants: result.experience.doc.grants } : {}),
    ...(Object.keys(result.experience?.addons || {}).length ? { addons: Object.fromEntries(Object.entries(result.experience.addons).map(([id, a]) => [id, { version: a.manifest.version, kind: a.manifest.kind, digest: a.digest }])) } : {}),
    members: sortedMembers,
    ...(accepted.length ? { findings: accepted } : {}),
  };
  const packagePath = path.join(outDir, 'package.json');
  const replacedPackage = null; // another experience's package.json is refused above
  fs.writeFileSync(packagePath, JSON.stringify(descriptor, null, 2) + '\n');
  // The fit receipts of baked plans, beside the page (a package never carries evidence/, 10.8).
  if (baked.receipts.length) {
    const ev = path.join(outDir, 'evidence');
    fs.mkdirSync(ev, { recursive: true });
    for (const r of baked.receipts) fs.writeFileSync(path.join(ev, `${r.id}.json`), JSON.stringify(r, null, 2) + '\n');
    fs.writeFileSync(path.join(ev, 'index.json'), JSON.stringify({ receipts: baked.receipts.map(r => ({ id: r.id, run: r.run, subject: r.subject, digest: r.digest, status: r.status })) }, null, 2) + '\n');
  }
  return { htmlPath, packagePath, bytes: Buffer.byteLength(html), engineBytes: Buffer.byteLength(bundled.defs), members: Object.keys(members).length, id, csp,
    modules: bundled.files.length, files: bundled.files, capabilities: caps.map(c => c.id), logicModules: logic.map(m => m.pinned), addons: outside.list.map(a => a.pinned), sizes, findings: [...result.diags, ...oversize], accepted,
    baked: { members: Object.keys(baked.texts).sort(), receipts: baked.receipts, skipped: baked.skipped }, kitted: !!kitted, leftOut, replacedPackage };
}

// A reusable asset as one HyperSVG (D45, 10.14): pack --asset <folder> <out> writes <out>/<id>.svg, the start scene's
// drawing with the asset's other files in its tool record as data (src/asset.mjs). The checker runs first, as for any
// pack, and refuses on any error. An asset holds only what the shared player can check and play from text: its
// documents and drawings. So it refuses a kit, an add-on or capability (any need), a file that is not text (a picture,
// a sound, a font), and a drawing with a tool record of its own. The file is at most dataBytesEach bytes.
export async function packAsset(expDir, outDir) {
  expDir = path.resolve(expDir);
  const schemas = loadSchemas(path.join(repo, 'spec', '2.0'));
  const folder = await folderSource(expDir, {});
  const reached = new Set();
  const source = { ...folder, read(rel) { const t = folder.read(rel); if (t !== null) reached.add(path.posix.normalize(String(rel))); return t; } };
  const result = checkExperience(source, schemas);
  const errors = result.diags.filter(d => d.code?.startsWith('E-') || d.code === 'W-ADDON-ABSENT');
  if (errors.length) throw new PackError(`refusing to pack the asset: ${errors.length} errors`, errors);
  const exp = result.experience;
  const refuse = (why) => { throw new PackError(`refusing to pack the asset (E-ASSET): ${why}`, [{ code: 'E-ASSET', file: '', path: '', message: why }]); };
  const id = exp.doc.id;
  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) refuse(`the experience id "${id}" cannot name a file`);
  if (exp.kit || Object.keys(exp.picked?.kits || {}).length) refuse('an asset uses no kit or library; pack it as an experience');
  const needs = packageNeeds(exp);
  if (needs.length) refuse(`an asset needs no add-on or capability, and this one needs ${needs.join(', ')}; pack it as an experience`);
  const all = listFiles(expDir).filter(f => f !== 'package.json');
  const hiddenReached = [...reached].filter(hidden);
  if (hiddenReached.length) refuse(`it reaches hidden files: ${hiddenReached.sort().join(', ')}`);
  const texts = {};
  for (const rel of [...reached].sort()) if (TEXT_EXT.has(path.posix.extname(rel)) && all.includes(rel)) texts[rel] = fs.readFileSync(path.join(expDir, ...rel.split('/')), 'utf8');
  const binaries = referencedBinaries(exp, all.filter(f => !hidden(f)), texts);
  if (binaries.length) refuse(`an asset holds only text: its documents and drawings; it uses ${binaries.join(', ')}`);
  // The drawing it shows: the start scene's drawing.
  const start = exp.doc.story?.start;
  const sceneFile = exp.doc.story?.scenes?.[start];
  const sceneDoc = exp.scenes?.[start]?.doc;
  if (typeof sceneFile !== 'string' || typeof sceneDoc?.drawing !== 'string') refuse('its start scene has no drawing to show');
  const drawing = path.posix.normalize(path.posix.join(path.posix.dirname(sceneFile), sceneDoc.drawing));
  if (!(drawing in texts)) refuse(`its drawing ${drawing} is not a file of the folder`);
  let svg;
  try { svg = makeAsset({ id, drawing, files: texts }); } catch (e) { refuse(e.message); }
  const bytes = Buffer.byteLength(svg);
  if (bytes > FORMAT.dataBytesEach) refuse(`the HyperSVG would be ${bytes} bytes, more than dataBytesEach (${FORMAT.dataBytesEach})`);
  fs.mkdirSync(outDir, { recursive: true });
  const svgPath = path.join(outDir, `${id}.svg`);
  fs.writeFileSync(svgPath, svg);
  const leftOut = all.filter(f => !(f in texts));
  return { svgPath, bytes, id, drawing, members: Object.keys(texts).length, findings: result.diags, leftOut };
}

// The id of another experience whose package.json is in the out folder (F1a item 7): a second pack into one folder
// replaces it, and the packer says so. The descriptor keeps its name, package.json (10.8): hosts and mount read it.
function otherPackage(file, id) {
  try { const old = JSON.parse(fs.readFileSync(file, 'utf8')); return old?.kind === 'package' && typeof old.id === 'string' && old.id !== id ? old.id : null; } catch { return null; }
}
// The packer's closing lines (F1a item 7): the files left out, counted (named with --verbose), and a replaced
// package.json.
export function packNotes(r, verbose = false) {
  const out = [];
  const n = r.leftOut?.length || 0;
  if (n) out.push(verbose ? `left out (not reached by the experience): ${r.leftOut.join(', ')}` : `left out: ${n} file${n === 1 ? '' : 's'} not reached by the experience (--verbose names them)`);
  if (r.replacedPackage) out.push(`replaced ${r.packagePath}: it was the package file of ${r.replacedPackage}. Pack each experience into its own folder to keep both`);
  return out;
}

// Command line.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const hi = args.indexOf('--host');
  const hostFile = hi >= 0 ? args.splice(hi, 2)[1] : null;
  const allow = [];
  for (let ai = args.indexOf('--allow'); ai >= 0; ai = args.indexOf('--allow')) allow.push(args.splice(ai, 2)[1]);
  // --kit <kit folder> (may repeat): where a kit the experience pins or picks from is (src/load.mjs folderSource).
  const kits = {};
  for (let ki = args.indexOf('--kit'); ki >= 0; ki = args.indexOf('--kit')) { const k = path.resolve(args.splice(ki, 2)[1] ?? ''); try { kits[JSON.parse(fs.readFileSync(path.join(k, 'kit.json'), 'utf8')).id] = k; } catch { console.log(`${k} holds no kit.json`); process.exit(2); } }
  const [exp, out] = args.filter(a => !a.startsWith('--'));
  // --asset: one HyperSVG, <out>/<id>.svg (D45); unpack.mjs gives the folder back.
  if (args.includes('--asset')) {
    if (!exp || !out) { console.log('usage: node engine/v2/tools/pack.mjs --asset <asset folder> <out folder>'); process.exit(2); }
    try {
      const r = await packAsset(exp, path.resolve(out));
      for (const d of r.findings) console.log(`${d.code} ${d.file} ${d.path}: ${d.message}`);
      console.log(`wrote ${r.svgPath}`);
      console.log(`${r.bytes} bytes, ${r.members} members; it shows ${r.drawing}`);
      if (r.leftOut.length) console.log(`left out: ${r.leftOut.length} file${r.leftOut.length === 1 ? '' : 's'} not reached by the asset${args.includes('--verbose') ? `: ${r.leftOut.join(', ')}` : ' (--verbose names them)'}`);
    } catch (e) {
      if (!(e instanceof PackError)) throw e;
      for (const d of e.diags.slice(0, 200)) console.log(`${d.code} ${d.file} ${d.path}: ${d.message}`);
      console.log(e.message);
      process.exit(1);
    }
    process.exit(0);
  }
  const acceptFindings = args.includes('--accept-findings');
  const test = args.includes('--test');
  if (!exp || !out || (hi >= 0 && !hostFile)) { console.log('usage: node engine/v2/tools/pack.mjs <experience folder> <out folder> [--host <host-profile.json>] [--test] [--allow <add-on id>] [--kit <kit folder>] [--verbose]\n       node engine/v2/tools/pack.mjs --asset <asset folder> <out folder>'); process.exit(2); }
  try {
    const r = await pack(exp, path.resolve(out), { acceptFindings, test, allow, kits, host: hostFile ? fs.readFileSync(path.resolve(hostFile), 'utf8') : null });
    for (const d of r.findings) console.log(`${d.code} ${d.file} ${d.path}: ${d.message}`);
    console.log(`wrote ${r.htmlPath}`);
    console.log(`wrote ${r.packagePath}`);
    console.log(`${r.bytes} bytes (${(r.bytes / 1048576).toFixed(2)} MiB), ${r.members} members, ${r.modules} engine modules (${r.engineBytes} bytes)`);
    console.log(`capability modules: ${r.capabilities.join(', ') || 'none'}`);
    console.log(`engine sizes, gzip 9: core ${r.sizes.core.gzip9} of ${r.sizes.core.max}${r.sizes.capabilities.map(c => `; ${c.id} ${c.gzip9} of ${c.max}`).join('')}`);
    if (r.logicModules.length) console.log(`logic modules: ${r.logicModules.join(', ')}`);
    if (r.addons.length) console.log(`add-ons: ${r.addons.join(', ')}${r.sizes.addons?.length ? ` (gzip 9: ${r.sizes.addons.map(a => `${a.id} ${a.gzip9} of ${a.max}`).join('; ')})` : ''}`);
    if (r.baked.receipts.length) console.log(`baked layout plans: ${r.baked.receipts.map(x => `${x.subject} ${x.selected.size} ${x.status}`).join(', ')}`);
    for (const x of r.baked.skipped) console.log(`not baked: ${x.subject} ${x.size}: ${x.reason}`);
    for (const line of packNotes(r, args.includes('--verbose'))) console.log(line);
  } catch (e) {
    if (!(e instanceof PackError)) throw e;
    for (const d of e.diags.slice(0, 200)) console.log(`${d.code} ${d.file} ${d.path}: ${d.message}`);
    console.log(e.message);
    process.exit(1);
  }
}
