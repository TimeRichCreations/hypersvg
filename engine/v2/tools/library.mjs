// Libraries and templates (D24; spec 4.8 and 4.10). A library is a kit with a catalogue; a template is a starter
// experience. Node's standard library only; paths are joined with `path`, so this runs on Windows and Linux.
//
//   node engine/v2/tools/library.mjs new <name> --from <template> [--in <folder>]
//        Copies the template (a folder with experience.json, or the name of a starter template) to <folder>/<name>,
//        which must not exist; gives it the id <name>; records about.derivedFrom; brings the kit if the new folder
//        cannot find it; checks the result. This is the `instantiate` of 4.10.
//   node engine/v2/tools/library.mjs add <library> <item> [--to <experience folder>]
//        Picks one catalogue item of a library (a kit folder, or a kit id found from the experience) for the
//        experience: adds it to `picks`, pinned to the library's version, brings the kit if needed, and checks.
//   node engine/v2/tools/library.mjs list <library> [words ...]
//        Lists the catalogue's items, or those whose id, type, title, line or tags hold every word.
//   node engine/v2/tools/library.mjs check <kit folder>
//        Checks a kit alone: kit.json against the schema and its catalogue (E-CATALOGUE).
//   node engine/v2/tools/library.mjs templates
//        Lists the starter templates.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { folderSource } from '../src/load.mjs';
import { checkExperience } from '../check/index.mjs';
import { checkCatalogue, findItems } from '../check/catalogue.mjs';
import { digestOf } from '../check/digest.mjs';
import { kitDigest } from '../check/kits.mjs';
import { loadSchemas } from '../schema/load.mjs';
import { makeDocumentChecker } from '../schema/check-document.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..');
// Where the starter templates are, in the repository and in the tester kit (the same layout).
export const TEMPLATES = path.join(repo, 'library', '2.0', 'templates');
const ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, v) => fs.writeFileSync(file, JSON.stringify(v, null, 2) + '\n');
let schemasCache = null;
const schemas = () => (schemasCache ??= loadSchemas(path.join(repo, 'spec', '2.0')));

export class LibraryError extends Error {}

// The files of a folder, relative with '/', hidden files and folders left out. skip(rel) leaves out more.
function listFiles(dir, skip = () => false, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    const rel = path.relative(base, p).split(path.sep).join('/');
    if (skip(rel)) continue;
    if (e.isDirectory()) out.push(...listFiles(p, skip, base)); else out.push(rel);
  }
  return out;
}
function copyFolder(from, to, skip = () => false) {
  for (const rel of listFiles(from, skip)) {
    const dst = path.join(to, ...rel.split('/'));
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(from, ...rel.split('/')), dst);
  }
}
// A kit's files that go with an experience: everything but the kit's build tools and notes.
const KIT_SKIP = (rel) => rel === 'tools' || rel === 'QUALITY.md' || rel === 'samples' || rel === 'evidence';

// ---------- a kit alone ----------
// Findings for a kit folder: kit.json against the kit schema, then the catalogue (check/catalogue.mjs).
export function checkKitFolder(dir, sch = schemas()) {
  const out = [];
  const kitFile = path.join(dir, 'kit.json');
  const r = makeDocumentChecker(sch).check(fs.readFileSync(kitFile, 'utf8'), { needs: [], file: 'kit.json' });
  for (const d of r.diags) out.push({ file: 'kit.json', ...d });
  const kit = r.doc;
  if (!kit) return out;
  if (typeof kit.catalogue !== 'string') { out.push({ code: 'E-CATALOGUE', file: 'kit.json', path: '/catalogue', message: 'a library names its catalogue: add "catalogue": "catalogue.json" and write the file (spec 4.8)' }); return out; }
  const catFile = path.join(dir, ...kit.catalogue.split('/'));
  if (!fs.existsSync(catFile)) { out.push({ code: 'E-FILE-MISSING', file: 'kit.json', path: '/catalogue', message: `${kit.catalogue} is not found` }); return out; }
  let cat;
  try { cat = readJson(catFile); } catch (e) { out.push({ code: 'E-JSON', file: kit.catalogue, path: '', message: e.message }); return out; }
  const blockKind = (id) => {
    const rel = Object.hasOwn(kit.blocks || {}, id) ? kit.blocks[id] : null;
    if (typeof rel !== 'string') return null;
    try { return readJson(path.join(dir, ...rel.split('/'))).kind ?? null; } catch { return null; }
  };
  const exists = (rel) => fs.existsSync(path.join(dir, ...rel.split('/')));
  for (const d of checkCatalogue(cat, kit, { blockKind, exists })) out.push({ file: kit.catalogue, ...d });
  return out;
}

// A library: {dir, kit, catalogue} from a kit folder, or from a kit id found as the experience finds kits.
export async function openLibrary(library, fromDir = process.cwd()) {
  let dir = null;
  if (fs.existsSync(path.join(path.resolve(library), 'kit.json'))) dir = path.resolve(library);
  else if (ID.test(library)) dir = (await folderSource(fromDir)).kitDir(library);
  if (!dir) throw new LibraryError(`no library ${library}: give the folder of a kit (it holds kit.json), or put the kit at kits/${library}/ beside the experience`);
  const kit = readJson(path.join(dir, 'kit.json'));
  if (kit.kind !== 'kit') throw new LibraryError(`${library}: kit.json is not a kit`);
  if (typeof kit.catalogue !== 'string' || !fs.existsSync(path.join(dir, ...kit.catalogue.split('/')))) throw new LibraryError(`kit ${kit.id} has no catalogue, so it is not a library yet (spec 4.8: kit.json "catalogue")`);
  return { dir, kit, catalogue: readJson(path.join(dir, ...kit.catalogue.split('/'))) };
}

// ---------- check an experience folder ----------
export async function checkFolder(dir, kits = {}) {
  const source = await folderSource(dir, { kits });
  const r = checkExperience(source, schemas());
  return r.diags;
}
const errorsOf = (diags) => diags.filter(d => d.code?.startsWith('E-'));

// Brings each kit the experience pins or picks from that its folder cannot find, into <dir>/kits/<id>/ (the package
// layout, 10.8). from: the folder to find the kits from (the template's). Returns the kit ids copied.
async function bringKits(dir, doc, from) {
  const ids = [...(doc.kit && typeof doc.kit === 'object' ? [doc.kit.id] : []), ...(Array.isArray(doc.picks) ? doc.picks.map(p => p?.id) : [])].filter(x => typeof x === 'string');
  const copied = [];
  if (!ids.length) return copied;
  const here = await folderSource(dir);
  const there = await folderSource(from);
  for (const id of new Set(ids)) {
    if (here.kitDir(id)) continue;
    const k = there.kitDir(id);
    if (!k) continue; // the checker says it is missing (E-KIT-PIN)
    copyFolder(k, path.join(dir, 'kits', id), KIT_SKIP);
    copied.push(id);
  }
  return copied;
}

// Writes each kit's digest into the experience's pins (A9.3): the kit pin of a kit experience and the pick of each
// library it picks from, so a changed kit file is found (E-KIT-PIN). Only a kit the folder finds and reads gets one.
async function pinKitDigests(dir) {
  const file = path.join(dir, 'experience.json');
  const source = await folderSource(dir);
  const exp = checkExperience(source, schemas()).experience;
  const doc = readJson(file);
  let changed = false;
  const kit = exp?.kit;
  if (kit && doc.kit && typeof doc.kit === 'object' && doc.kit.id === kit.doc.id) { doc.kit = { ...doc.kit, digest: kitDigest(source, kit) }; changed = true; }
  for (const p of Array.isArray(doc.picks) ? doc.picks : []) {
    const k = exp?.picked?.kits?.[p?.id];
    if (k) { p.digest = kitDigest(source, k); changed = true; }
  }
  if (changed) writeJson(file, doc);
  return doc;
}

// ---------- hsvg new <name> --from <template> ----------
// Starter templates that the core release does not hold (D30; release/core-examples.json, "addons"). Where one is
// absent, hsvg new and hsvg templates say where it comes from.
export const ADDON_TEMPLATES = Object.freeze({ ad: 'the hypersvg-addons release' });
export function addonTemplatesNote() {
  const away = Object.keys(ADDON_TEMPLATES).filter(t => !starterTemplates().includes(t));
  return away.map(t => `The ${t} template comes with ${ADDON_TEMPLATES[t]}, not with this release.`).join('\n');
}
// The template's folder: a folder with experience.json, else a starter template's name.
export function templateDir(from) {
  const p = path.resolve(from);
  if (fs.existsSync(path.join(p, 'experience.json'))) return p;
  if (ID.test(from) && fs.existsSync(path.join(TEMPLATES, from, 'experience.json'))) return path.join(TEMPLATES, from);
  if (ADDON_TEMPLATES[from]) throw new LibraryError(`no template ${from} here: the ${from} template comes with ${ADDON_TEMPLATES[from]}, not with this release. The starter templates here: ${starterTemplates().join(', ')}`);
  throw new LibraryError(`no template ${from}: give a folder with experience.json, or one of the starter templates: ${starterTemplates().join(', ')}`);
}
// The starter templates: [name], the folders of library/2.0/templates with an experience (showcases start with _).
export function starterTemplates() {
  if (!fs.existsSync(TEMPLATES)) return [];
  return fs.readdirSync(TEMPLATES, { withFileTypes: true }).filter(e => e.isDirectory() && ID.test(e.name) && fs.existsSync(path.join(TEMPLATES, e.name, 'experience.json'))).map(e => e.name).sort();
}

// Makes a new experience from a template (4.10 instantiate). Returns {dir, doc, derivedFrom, kitsCopied, diags}.
// The copy keeps the template's internal ids (they are scoped, 4.10); its document id is <name>; reviews are not
// copied; about.derivedFrom names the template: its id, its version (about.version, else the version of the kit it
// pins) and its digest (A9.3).
export async function newFromTemplate(name, from, into = process.cwd()) {
  if (!ID.test(name) || name.length > 48) throw new LibraryError(`"${name}" cannot be an experience id: use lower-case words joined by "-", at most 48 characters (for example my-quiz)`);
  const src = templateDir(from);
  const dir = path.resolve(into, name);
  if (fs.existsSync(dir)) throw new LibraryError(`${dir} already exists: choose a new name or another folder (hsvg new never writes into a folder that exists)`);
  const tdoc = readJson(path.join(src, 'experience.json'));
  const version = tdoc.about?.version ?? (tdoc.kit && typeof tdoc.kit === 'object' ? tdoc.kit.version : '1.0.0');
  const digest = digestOf(await folderSource(src), 'experience.json', tdoc);
  copyFolder(src, dir, (rel) => rel === 'package.json');
  const doc = structuredClone(tdoc);
  doc.id = name;
  const derivedFrom = { id: tdoc.id, version, digest };
  doc.about = { ...(doc.about || {}), derivedFrom };
  if (doc.about.trust) { delete doc.about.trust.review; delete doc.about.trust.signature; delete doc.about.trust.digest; if (!Object.keys(doc.about.trust).length) delete doc.about.trust; }
  delete doc.about.template;
  writeJson(path.join(dir, 'experience.json'), doc);
  const kitsCopied = await bringKits(dir, doc, src);
  const pinned = await pinKitDigests(dir);
  const diags = await checkFolder(dir);
  return { dir, doc: pinned, derivedFrom, kitsCopied, diags };
}

// ---------- hsvg add <library> <item> ----------
// How to use a picked item, as a line for the person.
export function howToUse(id, entry, kind) {
  if (entry.theme) return `select it with "theme": "${entry.theme}"`;
  if (entry.resource) return `it is declared as resources.${entry.resource}`;
  if (kind === 'scene') return `use it as a scene: "story": {"scenes": {"<scene id>": {"use": "${entry.block}", "with": {...}}}}`;
  if (kind === 'shell') return `use it as the shell: "shell": {"use": "${entry.block}"}`;
  return `use it in a scene: "uses": [{"id": "<use id>", "use": "${entry.block}", "into": "<slot>", "with": {...}}]`;
}

// Picks one item of a library for an experience. Returns {changed, message, kitsCopied, diags}.
export async function addItem(library, item, expDir = process.cwd()) {
  expDir = path.resolve(expDir);
  const file = path.join(expDir, 'experience.json');
  if (!fs.existsSync(file)) throw new LibraryError(`${expDir} holds no experience.json: give the experience with --to <folder>`);
  const lib = await openLibrary(library, expDir);
  const entry = lib.catalogue.items?.[item];
  if (!entry) {
    const near = nearIds(item, Object.keys(lib.catalogue.items || {}));
    throw new LibraryError(`library ${lib.kit.id} has no item ${item}${near.length ? `; near: ${near.join(', ')}` : ''} (hsvg add --list ${library} lists them)`);
  }
  const doc = readJson(file);
  const kitId = lib.kit.id;
  const version = lib.kit.about?.version;
  if (doc.kit && typeof doc.kit === 'object') {
    if (doc.kit.id === kitId) return { changed: false, message: `${doc.id} is a kit experience of ${kitId}: every item of its kit is already there; ${howToUse(item, entry, kindOf(lib, entry))}`, kitsCopied: [], diags: [] };
    throw new LibraryError(`${doc.id} is a kit experience of ${doc.kit.id}: it uses only its own kit (4.9). Add ${item} to that kit as a new kit version, or pick it in an experience without a kit pin`);
  }
  if (entry.preset !== undefined) return { changed: false, message: `${item} is a preset: name it in "presets" (chapter 12), for example {"use": "${entry.preset}", "as": "<name>", "with": {...}}`, kitsCopied: [], diags: [] };
  if (entry.rulePack !== undefined) return { changed: false, message: `${item} is a rule pack: name it in "rulePacks" (8.3), {"use": "${entry.rulePack}"}`, kitsCopied: [], diags: [] };
  const picks = Array.isArray(doc.picks) ? doc.picks : [];
  let pick = picks.find(p => p?.id === kitId);
  if (pick && pick.version !== version) throw new LibraryError(`${doc.id} picks from ${kitId} ${pick.version}, and this library is ${version}: one experience pins one version of a library. Move the pin first (change "version" in picks, then check)`);
  if (pick?.items?.includes(item)) return { changed: false, message: `${item} is already picked; ${howToUse(item, entry, kindOf(lib, entry))}`, kitsCopied: [], diags: [] };
  if (!pick) { pick = { id: kitId, version, items: [] }; picks.push(pick); }
  pick.items.push(item);
  doc.picks = picks;
  writeJson(file, doc);
  const kitsCopied = (await folderSource(expDir)).kitDir(kitId) ? [] : (copyFolder(lib.dir, path.join(expDir, 'kits', kitId), KIT_SKIP), [kitId]);
  await pinKitDigests(expDir);
  const diags = await checkFolder(expDir);
  return { changed: true, message: `picked ${item} (${entry.type}) from ${kitId} ${version}; ${howToUse(item, entry, kindOf(lib, entry))}`, kitsCopied, diags };
}
// The item ids closest to a mistyped one: within two edits, or sharing its first word.
function nearIds(id, ids) {
  const dist = (a, b) => {
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  };
  const close = ids.map(x => [x, dist(id, x)]).filter(([, d]) => d <= 2).sort((a, b) => a[1] - b[1]).map(([x]) => x);
  const first = id.split('-')[0];
  return [...new Set([...close, ...ids.filter(x => x.split('-')[0] === first)])].slice(0, 8);
}
function kindOf(lib, entry) {
  const rel = entry.block && lib.kit.blocks?.[entry.block];
  if (typeof rel !== 'string') return null;
  try { return readJson(path.join(lib.dir, ...rel.split('/'))).kind; } catch { return null; }
}

// ---------- the command ----------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const value = (n) => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1] ?? null; };
  const plain = args.filter((a, i) => !a.startsWith('--') && !['--from', '--in', '--to'].includes(args[i - 1]));
  const usage = `usage:
  hsvg new <name> --from <template> [--in <folder>]
  hsvg add <library> <item> [--to <experience folder>]
  hsvg add --list <library> [words ...]
  hsvg templates
  node engine/v2/tools/library.mjs check <kit folder>`;
  const show = (diags) => {
    for (const d of diags.slice(0, 60)) console.log(`${d.code} ${d.file ?? ''} ${d.path ?? ''}: ${d.message}`);
    const by = {}; for (const d of diags) by[d.code] = (by[d.code] || 0) + 1;
    console.log(`${diags.length} findings ${JSON.stringify(by)}`);
  };
  try {
    const [cmd, a, b] = plain;
    if (cmd === 'new' && a && value('--from')) {
      const r = await newFromTemplate(a, value('--from'), value('--in') ?? process.cwd());
      console.log(`made ${r.dir} from ${r.derivedFrom.id} ${r.derivedFrom.version}${r.kitsCopied.length ? `; brought the kit ${r.kitsCopied.join(', ')} into kits/` : ''}`);
      show(r.diags);
      process.exit(errorsOf(r.diags).length ? 1 : 0);
    } else if (cmd === 'add' && args.includes('--list') && a) {
      const lib = await openLibrary(a, value('--to') ?? process.cwd());
      const found = findItems(lib.catalogue, plain.slice(2));
      for (const it of found) console.log(`${it.id.padEnd(22)} ${it.type.padEnd(10)} ${it.line}`);
      console.log(`${found.length} of ${Object.keys(lib.catalogue.items).length} items in ${lib.kit.id} ${lib.kit.about?.version}`);
    } else if (cmd === 'add' && a && b) {
      const r = await addItem(a, b, value('--to') ?? process.cwd());
      console.log(r.message);
      if (r.kitsCopied.length) console.log(`brought the kit ${r.kitsCopied.join(', ')} into kits/`);
      if (r.changed) show(r.diags);
      process.exit(errorsOf(r.diags).length ? 1 : 0);
    } else if (cmd === 'list' && a) {
      const lib = await openLibrary(a);
      for (const it of findItems(lib.catalogue, plain.slice(2))) console.log(`${it.id.padEnd(22)} ${it.type.padEnd(10)} ${it.line}`);
    } else if (cmd === 'check' && a) {
      const diags = checkKitFolder(path.resolve(a));
      show(diags);
      process.exit(errorsOf(diags).length ? 1 : 0);
    } else if (cmd === 'templates') {
      for (const t of starterTemplates()) { const d = readJson(path.join(TEMPLATES, t, 'experience.json')); console.log(`${t.padEnd(12)} ${d.about?.description ?? d.about?.title ?? ''}`); }
      const note = addonTemplatesNote(); if (note) console.log(note);
    } else { console.error(usage); process.exit(2); }
  } catch (e) {
    if (e instanceof LibraryError) { console.error(e.message); process.exit(1); }
    throw e;
  }
}
