// The add-on door's file side (D23, spec chapter 12), for the checker, the packer, the add-on tool and hosts in Node.
// Node standard library only. The pure part (names, manifests, presets) is src/addons.mjs.
// - addonFiles(dir), addonDigest(dir): what an add-on's pin covers. The digest is sha256 over every file of the folder
//   except hidden ones (a segment that starts with ".") and the tests/ folder, sorted by path, each as
//   "<path>\n<text>\n" with LF line ends, so Windows and Linux agree. It is the X1 lock rule for a folder.
// - scanCode(text, kind): the door's review of an add-on's code. A logic module may name no global, no clock, no
//   random source, no page and no network, and may not catch (so the executor's stop cannot be swallowed). A
//   capability may not reach the network, evaluate text or import from outside its folder.
// - loadAddons(source, experience, {allow}): checks, then imports the code of every module and capability add-on the
//   experience pins and registers it (src/addon-door.mjs registerAddon) with the digest of its files. It imports only
//   bytes whose digest is the pin, from a snapshot of exactly those bytes (Y1). A host then allows a capability with
//   its reviewed lock: mount(..., {capabilities: {'<id>': modulePort({lock: {'<id>@<version>': '<digest>'}})}}).
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { registerAddon } from '../src/addon-door.mjs';
import { FORMAT } from '../src/limits.mjs';
import { stripComments } from './strip.mjs';
import { metered } from './meter.mjs';

export const TEXT_EXT = new Set(['.json', '.mjs', '.svg', '.csv', '.md', '.txt']);
const lf = (t) => t.replace(/\r\n/g, '\n');

// The files an add-on's digest covers, as forward-slash paths, sorted.
export function addonFiles(dir) {
  const out = [];
  (function walk(d, rel) {
    for (const name of fs.readdirSync(d).sort()) {
      if (name.startsWith('.')) continue;
      if (!rel && name === 'tests') continue;
      const p = path.join(d, name);
      const r = rel ? `${rel}/${name}` : name;
      if (fs.statSync(p).isDirectory()) walk(p, r); else out.push(r);
    }
  })(dir, '');
  return out.sort();
}
// The folder's files that are not text (only text files may be in an add-on: .json .mjs .svg .csv .md .txt).
export const notText = (dir) => addonFiles(dir).filter(f => !TEXT_EXT.has(path.posix.extname(f)));

// The digest of a folder's covered texts, {rel: text}: sha256 over "<path>\n<text>\n" (LF), sorted by path.
const digestOf = (texts) => {
  const h = crypto.createHash('sha256');
  for (const rel of Object.keys(texts).sort()) h.update(`${rel}\n${lf(texts[rel])}\n`, 'utf8');
  return 'sha256:' + h.digest('hex');
};
export function addonDigest(dir) { return addonSnapshot(dir).digest; }

// One read of an add-on's folder (Y1, D26): {digest, texts: {rel: text}, links: [rel]}. Every covered file is read
// once; the digest is of exactly these texts, so a loader or packer that runs `texts` runs what the pin hashed.
// links: the covered paths that are symbolic links (refused: an add-on's code is its own files).
export function addonSnapshot(dir) {
  const texts = {}; const links = [];
  for (const rel of addonFiles(dir)) {
    const p = path.join(dir, ...rel.split('/'));
    if (fs.lstatSync(p).isSymbolicLink()) links.push(rel);
    texts[rel] = fs.readFileSync(p, 'utf8');
  }
  return { digest: digestOf(texts), texts, links };
}

// The import and export forms the packer bundles (tools/pack.mjs bundle), one source for the checker and the packer
// (Y1). Each statement starts a line; a trailing comment may follow it. Named re-exports (export { a } from './b.mjs')
// are bundled; export default and export * are not.
const TAIL = String.raw`[ \t]*;?[ \t]*(?:\/\/[^\n]*|\/\*[^\n]*?\*\/[ \t]*)?$`;
export const IMPORT_RE = new RegExp(String.raw`^import\s+(?:([\s\S]*?)\s+from\s+)?(['"])([^'"\n]+)\2` + TAIL, 'gm');
export const EXPORT_DECL_RE = /^export\s+(async\s+function\s*\*?|function\s*\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
export const EXPORT_LIST_RE = new RegExp(String.raw`^export\s*\{([^}]*)\}(?:\s*from\s*(['"])([^'"\n]+)\2)?` + TAIL, 'gm');
// Problems with a code file's import and export statements: [message]. Every statement the code has must be one the
// packer reads, so a file the checker accepts never packs into a page that does not boot.
export function formProblems(text, file = 'index.mjs') {
  let src;
  try { src = stripComments(text); } catch { return []; } // scanCode reports it
  const rest = src.replace(IMPORT_RE, '').replace(EXPORT_LIST_RE, '').replace(EXPORT_DECL_RE, '');
  const left = rest.match(/(^|[;{}])[ \t]*(import|export)\b(?=\s*[\w{*'"])/m);
  return left ? [`${file} has an ${left[2]} the packer cannot read: write one import or export per line, at the start of the line (import { a } from './a.mjs'; export function f() {}; export { a } from './a.mjs')`] : [];
}

// The specifiers a file's code imports or re-exports statically (on the code with its comments removed).
const SPEC_RE = /(^|[^.\w$])(?:import|export)\s*(?:[^;'"`()]*?\bfrom\s*)?(['"])([^'"\n]+)\2/gm;
export function importSpecs(text) {
  let src;
  try { src = stripComments(text); } catch { return []; }
  return [...src.matchAll(SPEC_RE)].map(m => m[3]);
}

// The import graph of an add-on's code from index.mjs (Y1: the fingerprint covers every byte that runs). snap: an
// addonSnapshot. Returns {files: [rel] (index.mjs first), problems: [{file, message}]}. Each import must name a
// .mjs file of the folder that the digest covers: never outside the folder ("../"), never a hidden file or tests/,
// never a link. So the graph is closed inside the folder and every file of it is hashed by the pin.
export function importGraph(snap) {
  const files = []; const problems = [];
  const linked = new Set(snap.links || []);
  const visit = (rel) => {
    if (files.includes(rel)) return;
    files.push(rel);
    for (const spec of importSpecs(snap.texts[rel])) {
      if (!spec.startsWith('./') && !spec.startsWith('../')) continue; // scanCode reports it
      const to = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec));
      const no = (why) => problems.push({ file: rel, message: `${rel} imports "${spec}", ${why}: an add-on imports only .mjs files of its own folder, which its pin covers` });
      if (to === '..' || to.startsWith('../') || path.posix.isAbsolute(to)) no('which is outside its folder');
      else if (!to.endsWith('.mjs')) no('which is not a .mjs file');
      else if (!(to in snap.texts)) no('a file not covered by its digest (hidden files and tests/ are left out) or not there');
      else if (linked.has(to)) no('which is a link');
      else visit(to);
    }
  };
  if ('index.mjs' in snap.texts) visit('index.mjs');
  return { files, problems };
}

// Words a logic module may not use (D23: no page, no network, deterministic, a time limit; the executor stops it).
// The check is on the code as written, strings included, so a banned word cannot hide in a computed key.
const MODULE_BANNED = ['globalThis', 'window', 'self', 'document', 'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'navigator', 'location',
  'localStorage', 'sessionStorage', 'indexedDB', 'Date', 'performance', 'setTimeout', 'setInterval', 'setImmediate', 'queueMicrotask',
  'requestAnimationFrame', 'eval', 'Function', 'require', 'process', 'constructor', '__proto__', 'prototype', 'Reflect', 'Proxy',
  'WebAssembly', 'Atomics', 'SharedArrayBuffer', 'crypto', 'postMessage', 'importScripts', 'Worker', 'async', 'await', 'Promise',
  'random', 'try', 'catch', 'this', 'import', 'arguments', 'debugger', 'Symbol', 'defineProperty', 'getPrototypeOf', 'setPrototypeOf',
  'parent', 'top', 'frames', 'opener', 'history', 'Image', 'Audio', 'Blob',
  // the loop meter's own name (tools/meter.mjs): the loader adds it
  '__hsvgTick'];
// The word list is a first look for the person reviewing. What holds in a page is the confinement (tools/pack.mjs
// bundle: a module's free names read only the language's plain objects), and the review itself (D26).
const CAPABILITY_BANNED = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon', 'importScripts', 'Worker', 'SharedWorker',
  'eval', 'Function', 'localStorage', 'sessionStorage', 'indexedDB', 'cookie', 'open', 'postMessage', 'RTCPeerConnection',
  // The page itself and the way around the door (D31): a capability reaches the page only through its door's handles.
  'window', 'globalThis', 'self', 'top', 'parent', 'opener', 'frames', 'document', 'location', 'hsvg', 'getPrototypeOf', 'setPrototypeOf', '__proto__',
  // (() => 0).constructor is Function (Q1c finding 2).
  'constructor'];
// The code as JavaScript reads its names (Q1c finding 2): \u0077indow is the identifier window, so \uXXXX, \u{X...}
// and \xXX escapes are decoded before the words are matched, in names and strings alike (strings are scanned too).
// A doubled backslash is decoded as well: a word found by mistake is a false alarm for the reviewer, never a miss.
export function decodeEscapes(src) {
  const ch = (n) => (n <= 0x10ffff ? String.fromCodePoint(n) : '');
  return src.replace(/\\u\{([0-9A-Fa-f]+)\}|\\u([0-9A-Fa-f]{4})|\\x([0-9A-Fa-f]{2})/g, (m, a, b, c) => ch(parseInt(a ?? b ?? c, 16)));
}
// Problems with an add-on's code file: [message]. kind: module or capability. A module's files hold only
// `export function make(step)` at the top (index.mjs) or plain functions, and import only files of its own folder.
export function scanCode(text, kind, file = 'index.mjs') {
  const out = [];
  let src;
  try { src = stripComments(text); } catch (e) { return [`${file} does not read as plain JavaScript: ${e.message}`]; }
  const banned = kind === 'module' ? MODULE_BANNED.filter(w => w !== 'import') : CAPABILITY_BANNED;
  const read = decodeEscapes(src);
  for (const w of banned) {
    const re = new RegExp(`(^|[^A-Za-z0-9_$])${w.replace(/\$/g, '\\$')}($|[^A-Za-z0-9_$])`);
    if (re.test(read)) out.push(`${file} uses "${w}", which a ${kind} add-on may not use${kind === 'module' ? ' (a module gets only its inputs and step: no page, no network, no clock, no random source, no catching the stop)' : ' (no network, no evaluated text, no page or prototype outside its door)'}`);
  }
  for (const m of src.matchAll(/(^|[^.\w$])import\s*(\(|[^;]*?\bfrom\s*['"]([^'"]+)['"]|\s*['"]([^'"]+)['"])/gm)) {
    if (m[2] === '(') { out.push(`${file} imports with import(): an add-on's code is all in its folder, imported statically`); continue; }
    const to = m[3] ?? m[4];
    if (!to || !to.startsWith('./')) out.push(`${file} imports "${to}": an add-on imports only files of its own folder ("./name.mjs")`);
  }
  if (/\bexport\s+default\b|\bexport\s*\*/.test(src)) out.push(`${file} uses export default or export *: export named functions (export function ${kind === 'module' ? 'make(step)' : 'install(door)'})`);
  return out;
}
// The code files of an add-on: index.mjs and every .mjs file of its folder.
export const codeFiles = (dir) => addonFiles(dir).filter(f => f.endsWith('.mjs'));

// The checks on an add-on's files (not its manifest: src/addons.mjs checkManifest): only text files; a module or
// capability has index.mjs with its export; its code passes scanCode; its code is within capabilityBundleBytes
// (gzip 9 of its code files as written; the packer measures the built bundle too). Returns [{code, file, message}],
// file relative to the add-on's folder, each message saying the fix.
export function checkAddonFiles(dir, kind) {
  return checkAddonSnapshot(addonSnapshot(dir), kind);
}

// Review the exact bytes that will be imported, without a second filesystem read.
export function checkAddonSnapshot(snap, kind) {
  const files = Object.keys(snap.texts).sort();
  const code = files.filter(f => f.endsWith('.mjs'));
  const out = [];
  const bad = (file, message) => out.push({ code: 'E-ADDON', file, message });
  for (const f of files.filter(f => !TEXT_EXT.has(path.posix.extname(f)))) bad(f, `an add-on holds text files only (.json .mjs .svg .csv .md .txt): move ${f} out of the folder`);
  if (kind === 'preset') {
    for (const f of code) bad(f, `a preset is JSON only: remove ${f}, or make the add-on a module or capability`);
    return out;
  }
  for (const f of snap.links) bad(f, `${f} is a link: an add-on holds its own files, not links`);
  for (const p of importGraph(snap).problems) bad(p.file, p.message);
  const want = kind === 'module' ? 'make(step)' : 'install(door)';
  if (!code.includes('index.mjs')) { bad('manifest.json', `a ${kind} add-on has its code in index.mjs, which exports function ${want}`); return out; }
  let text = '';
  for (const f of code) {
    const t = snap.texts[f];
    text += t;
    for (const why of [...scanCode(t, kind, f), ...formProblems(t, f)]) bad(f, why);
  }
  const re = kind === 'module' ? /export\s+function\s+make\s*\(/ : /export\s+function\s+install\s*\(/;
  if (!re.test(snap.texts['index.mjs'])) bad('index.mjs', `index.mjs exports function ${want}: write "export function ${want} { ... }"`);
  const size = gzipSync(Buffer.from(text), { level: 9 }).length;
  if (size > FORMAT.capabilityBundleBytes) bad('manifest.json', `its code is ${size} bytes gzip 9, over capabilityBundleBytes ${FORMAT.capabilityBundleBytes}: make it smaller`);
  return out;
}

// Imports and registers the code of every module and capability add-on an experience pins. source: a folder source
// (src/load.mjs folderSource), whose addonDir finds each folder. Returns [{id, pinned, digest, dir, kind}].
// Y1: nothing is imported before it is checked. The folder is read once
// (addonSnapshot); its digest must be the experience's pin and its import graph closed inside the folder, else this
// throws an Error with code E-ADDON and no code of it has run. The graph's files are then written, exactly as hashed,
// to a fresh temporary folder and imported from there, so Node's module cache can never hand back older bytes for a
// new pin: one digest, one module, in this process.
const LOADED = new Map(); // digest -> the imported namespace of those bytes
const refuse = (message) => Object.assign(new Error(message), { code: 'E-ADDON' });
// A logic module's files are written metered (tools/meter.mjs, Q1c finding 6), each with the meter's check imported
// from the engine, so its time budget holds even if it never calls step(); a capability's are written as hashed.
const TICK_FROM = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'modules.mjs')).href;
function written(text, rel, kind) {
  if (kind !== 'module') return text;
  try { return `import { moduleTick as __hsvgTick } from ${JSON.stringify(TICK_FROM)};\n${metered(text)}`; } catch (e) { throw refuse(`${rel}: the loader cannot meter its loops: ${e.message}; nothing was imported`); }
}
async function importPinned(snap, files, kind) {
  const done = LOADED.get(snap.digest);
  if (done) return done;
  const texts = Object.fromEntries(files.map(rel => [rel, written(snap.texts[rel], rel, kind)]));
  const at = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-addon-'));
  try {
    for (const rel of files) {
      const p = path.join(at, ...rel.split('/'));
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, texts[rel]);
    }
    const code = await import(pathToFileURL(path.join(at, 'index.mjs')).href);
    LOADED.set(snap.digest, code);
    return code;
  } finally { fs.rmSync(at, { recursive: true, force: true }); }
}
export async function loadAddons(source, experience, { allow = [] } = {}) {
  const out = [];
  const admitted = [];
  for (const [id, a] of Object.entries(experience?.addons || {})) {
    if (a.manifest.kind === 'preset') continue;
    if (!allow.includes(id) && !allow.includes(a.pinned)) throw refuse(`${a.pinned}: review its code, then allow ${id}; nothing was imported`);
    const dir = source.addonDir?.(id);
    if (!dir) throw new Error(`no folder for the add-on ${id}`);
    const snap = addonSnapshot(dir);
    if (snap.digest !== a.digest) throw refuse(`${a.pinned}: its files hash to ${snap.digest}, not the pinned ${a.digest}: review the change, then pin it; nothing was imported`);
    const graph = importGraph(snap);
    const wrong = checkAddonSnapshot(snap, a.manifest.kind).map(p => p.message);
    if (!graph.files.length) wrong.push(`a ${a.manifest.kind} add-on has index.mjs`);
    if (wrong.length) throw refuse(`${a.pinned}: ${wrong.join('; ')}; nothing was imported`);
    admitted.push({ id, a, dir, snap, graph });
  }
  // Preflight the entire request before importing any add-on. Cached code still requires admission.
  for (const { id, a, dir, snap, graph } of admitted) {
    const code = await importPinned(snap, graph.files, a.manifest.kind);
    registerAddon({ manifest: a.manifest, digest: snap.digest, code });
    out.push({ id, pinned: a.pinned, digest: snap.digest, dir, kind: a.manifest.kind });
  }
  return out;
}
