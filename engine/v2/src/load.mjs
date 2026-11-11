// Stage 1: load a HyperSVG 2.0 experience and check its files against the schemas (2.1, 2.2, 2.10, 2.11), for the dev
// player, the host API's mount and the tools. It passes the checkers and the kit loader to the player's reader
// (read.mjs), which only parses. The schemas are the objects in spec/2.0/schemas, given by the host or the packer.
// The checking code is the engine's schema tools (engine/v2/schema), which the spec's tools use too, so they agree.
// With schemas null files are only parsed (and a kit is still read and applied).
import { makeDocumentChecker } from '../schema/check-document.mjs';
import { withUsedGrants } from './grants-asked.mjs';
import { experienceResources } from './host-profile.mjs';
import { checkDrawing } from '../schema/drawing-check.mjs';
import { parseStrict } from '../schema/json-strict.mjs';
import { raisedLimits, SVG_LIMIT } from './limits.mjs';
import { kitPin, applyKit, readKit, readPicks } from './kit.mjs';
import { readExperience, UPGRADE_TOOL, parseWords, parseCsv } from './read.mjs';
import { checkValue } from './runtime.mjs';
import { checkManifest, expandPresets, namePresets, parseName, isOutside } from './addons.mjs';

export { UPGRADE_TOOL, parseWords, parseCsv };
const CHECKERS = Object.freeze({ makeDocumentChecker, checkDrawing, checkCells });
const KITS = Object.freeze({ kitPin, applyKit, readKit, readPicks });

const LIMIT_KEYWORDS = ['maxItems', 'maxLength', 'maxProperties', 'maximum'];
// The schemas with the capacity limits a package raises (9.8.1): every node marked x-hsvg-limit with a raised id, and
// the drawing rules' limits. Returns the schemas unchanged when nothing is raised.
export function raiseSchemas(schemas, raised) {
  if (!schemas || !Object.keys(raised).length) return schemas;
  const out = structuredClone(schemas);
  (function walk(node) {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== 'object') return;
    const id = node['x-hsvg-limit'];
    if (id in raised) for (const k of LIMIT_KEYWORDS) if (typeof node[k] === 'number') node[k] = raised[id];
    Object.values(node).forEach(walk);
  })(out);
  for (const [id, v] of Object.entries(raised)) if (SVG_LIMIT[id] && out.drawing?.limits) out.drawing.limits[SVG_LIMIT[id]] = v;
  return out;
}

// Returns { ok, diags: [{file, code, path, message}], experience } where experience holds parsed documents and
// drawing texts: { doc, scenes: {id: {file, doc, drawings: {layoutId|'main': {file, text}}}}, blocks: {id: {...}} }.
// With schemas, every document and drawing is checked; the limits the experience raises apply to every file it holds,
// so they are read before anything is checked.
export function loadExperience(source, schemas, opts = {}) {
  let raised = {};
  let top = null;
  try { top = parseStrict(source.read('experience.json') ?? '{}'); raised = raisedLimits([top]); } catch { /* the reader reports it */ }
  const door = openDoor(source, top);
  const r = readExperience(source, door.schemas(raiseSchemas(schemas, raised)), { ...opts, checkers: CHECKERS, kits: KITS, presets: door.presets });
  const diags = namePresets([...door.diags, ...r.diags, ...(schemas && r.experience ? undeclaredImages(r.experience) : [])], door.origins);
  if (r.experience) { r.experience.addons = door.addons; r.experience.presetOrigins = door.origins; r.experience.presetExpanded = door.expanded; }
  // The openUrl and storage requests come from use (10.5, D31.4): the experience asks for them as if written.
  if (r.experience?.doc) { const g = withUsedGrants(r.experience); r.experience.derivedGrants = g.derived; if (Object.keys(g.derived).length) r.experience.doc.grants = g.grants; }
  return { ...r, ok: !diags.some(d => d.code.startsWith('E-')), diags };
}

// An <image> in a drawing holds a data: URI or names a declared image resource by its path from the drawing
// (vocabularies.json svgLimits.addresses, 2.6). Anything else would make a mounted page ask its server for an address
// nobody declared or checked: E-REF-UNKNOWN, so neither the checker nor mount lets it play.
const IMAGE_HREF = /<image\b[^>]*?\s(?:xlink:)?href\s*=\s*(["'])([^"']*)\1/g;
function undeclaredImages(e) {
  const declared = new Set(experienceResources(e).filter(r => r.kind === 'image').map(r => r.path));
  const out = [];
  const seen = new Set();
  for (const owner of [e.shell, ...Object.values(e.scenes || {}), ...Object.values(e.blocks || {})]) {
    for (const d of Object.values(owner?.drawings || {})) {
      if (!d?.text || seen.has(d.file)) continue;
      seen.add(d.file);
      const dir = String(d.file || '').split('/').slice(0, -1);
      for (const [, , href] of d.text.matchAll(IMAGE_HREF)) {
        if (/^data:/i.test(href.trim()) || href.startsWith('#')) continue;
        const parts = [...dir];
        for (const p of href.split('/')) { if (p === '..') parts.pop(); else if (p && p !== '.') parts.push(p); }
        if (!declared.has(parts.join('/'))) out.push({ code: 'E-REF-UNKNOWN', file: d.file, path: `<image href="${href}">`, message: `the image ${href} is not a declared image resource: declare it in resources ({"kind": "image", "file": "..."}) or embed it as a data: URI` });
      }
    }
  }
  return out;
}

// The add-on door (D23, chapter 12; src/addons.mjs). The outside add-ons a package uses are the ones its experience
// pins in about.trust.pins under owner.name@version: each is read from addons/<id>/manifest.json of the source (a
// folder source finds addons/<id>/ in the experience's folder or a parent folder, tools/addons.mjs) and its manifest
// checked. A module or capability add-on joins the schemas' capability names, so needs may name it; a preset is
// expanded by the reader. A built-in preset (a bare name) is read from addons/<name>/ too: a folder source gives the
// engine's own (engine/v2/addons). Returns {addons: {id: {manifest, pinned, digest}}, diags, origins, expanded (each
// document with presets, as expanded, for the packer), schemas(s), presets}. The digest of each folder is checked by the checker and the packer (check/addons.mjs), which read files.
// The message for a bare preset name whose folder this release does not hold (D30, as absent.mjs says for a
// capability): the built-in presets that need a built-in capability come with the hypersvg-addons release.
// The pinned outside presets, given to the document checker so that one named in needs is told it goes in presets
// schemas.presetAddons: their ids.
function withPresetNames(s, addons) {
  const ids = Object.entries(addons).filter(([, a]) => a.manifest.kind === 'preset').map(([id]) => id);
  return s && ids.length ? { ...s, presetAddons: ids } : s;
}
function builtInPresetMissing(id) {
  return `${id} is not a built-in preset in this release; if it is one of the built-in presets that need a built-in capability (bouncy-ball, confetti, snowfall, sparkle), it comes with the hypersvg-addons release. Remove the use, or name an outside preset owner.name@version (D30)`;
}
function openDoor(source, top) {
  const diags = []; const addons = {}; const origins = {};
  const pins = top?.about?.trust?.pins;
  const readManifest = (id) => {
    const file = `addons/${id}/manifest.json`;
    const text = source.read(file);
    if (text == null) return { file, problem: ['E-ADDON', `no add-on ${id}: put its folder at addons/${id}/ beside the experience (or in a parent folder), with its manifest.json`] };
    let m;
    try { m = parseStrict(text); } catch (e) { return { file, problem: ['E-ADDON', `addons/${id}/manifest.json is not strict JSON: ${e.message}`] }; }
    const bad = checkManifest(m, { folder: id, builtIn: !isOutside(id) });
    return { file, manifest: m, bad };
  };
  if (pins && typeof pins === 'object' && !Array.isArray(pins)) {
    for (const [pinned, digest] of Object.entries(pins)) {
      const n = parseName(pinned);
      if (!n || !isOutside(n.id)) continue; // engine modules (chess@0.1.0) are pinned too: modules.mjs reviews them
      const r = readManifest(n.id);
      if (r.problem) { diags.push({ file: 'experience.json', code: r.problem[0], path: `about.trust.pins.${pinned}`, message: r.problem[1] }); continue; }
      for (const d of r.bad) diags.push({ file: r.file, ...d });
      if (r.bad.some(d => d.code.startsWith('E-'))) continue;
      if (r.manifest.version !== n.version) { diags.push({ file: 'experience.json', code: 'E-ADDON', path: `about.trust.pins.${pinned}`, message: `${pinned} is pinned, but addons/${n.id}/manifest.json is version ${r.manifest.version}: pin ${n.id}@${r.manifest.version} with its digest` }); continue; }
      addons[n.id] = { manifest: r.manifest, pinned, digest };
    }
  }
  const builtIn = new Map();
  const manifestOf = (use) => {
    const n = parseName(use);
    if (isOutside(n.id)) {
      if (!addons[n.id]) return { problem: ['E-ADDON', `${use} is not pinned: add "${use}": "<its digest>" to the experience's about.trust.pins (node engine/v2/tools/addon.mjs digest <its folder> prints it)`] };
      return { manifest: addons[n.id].manifest };
    }
    if (!builtIn.has(n.id)) {
      const r = readManifest(n.id);
      builtIn.set(n.id, r.problem ? { problem: [r.problem[0], builtInPresetMissing(n.id)] }
        : r.bad.length ? { problem: [r.bad[0].code, `the built-in preset ${n.id}: ${r.bad[0].message}`] } : { manifest: r.manifest });
    }
    return builtIn.get(n.id);
  };
  const expanded = {};
  const presets = { expand(doc, file) { const x = expandPresets(doc, manifestOf); if (x.origins.length) origins[file] = x.origins; expanded[file] = x.doc; return x; } };
  // A module or capability add-on is a name needs may carry (with its version, as a module's).
  const schemas = (s) => {
    const code = Object.entries(addons).filter(([, a]) => a.manifest.kind !== 'preset');
    s = withPresetNames(s, addons);
    if (!s || !code.length) return s;
    return { ...s, capabilities: { ...s.capabilities, ...Object.fromEntries(code.map(([id, a]) => [id, { 'x-hsvg-kind': 'addon', 'x-hsvg-addon-kind': a.manifest.kind }])) } };
  };
  return { addons, diags, origins, expanded, presets, schemas };
}

// Every cell is checked against its column before play (2.8): its type and bounds (minimum, maximum, step, maxLength,
// enum, and the rest of 5.1.1), as a value is. JSON rows are closed objects with every column. A broken rule throws
// (the loader gives E-DATA).
export function checkCells(rows, columns, json = true) {
  if (!Array.isArray(rows)) throw new Error('a data table is an array of rows');
  const names = Object.keys(columns);
  rows.forEach((row, ri) => {
    const where = `row ${ri + 1}`;
    if (row === null || typeof row !== 'object' || Array.isArray(row)) throw new Error(`${where}: a row is an object`);
    if (json) {
      const extra = Object.keys(row).filter(k => !(k in columns));
      const missing = names.filter(k => !(k in row));
      if (extra.length || missing.length) throw new Error(`${where}: a row has exactly the declared columns${missing.length ? `; missing ${missing.join(', ')}` : ''}${extra.length ? `; not declared ${extra.join(', ')}` : ''}`);
    }
    for (const c of names) {
      const bad = checkValue(columns[c], row[c]);
      if (bad) throw new Error(`${where}, column ${c}: ${bad[1]} (${bad[0]})`);
    }
  });
  return rows;
}
// A source over a folder on disk (Node only; the browser uses a packed map). bytes(rel) gives a file's bytes, for the
// resource checks. A kit's files are read as `kits/<id>/<path>` (the package layout, 10.8): from the folder's own
// `kits/<id>/`, else from the nearest parent folder that has `kits/<id>/kit.json` or `<id>/kit.json` (a kit beside
// the experiences that pin it, while authoring: library/2.0/hsvg-starter beside library/2.0/templates). kitDir(id)
// gives that folder, or null. opts.kits maps a kit id to a folder, first of all.
export async function folderSource(dir, opts = {}) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const kitDirs = new Map();
  const kitDir = (id) => {
    if (kitDirs.has(id)) return kitDirs.get(id);
    let found = opts.kits?.[id] ? path.resolve(opts.kits[id]) : null;
    for (let d = path.resolve(dir); !found; d = path.dirname(d)) {
      for (const k of [path.join(d, 'kits', id), ...(d === path.resolve(dir) ? [] : [path.join(d, id)])]) {
        if (!found && fs.existsSync(path.join(k, 'kit.json'))) found = k;
      }
      if (path.dirname(d) === d) break;
    }
    kitDirs.set(id, found);
    return found;
  };
  // An add-on's files are read as addons/<id>/<path> (chapter 12): a bare id is the engine's own (engine/v2/addons/<id>,
  // never the experience's); an outside id (owner.name) is found as a kit is, in the folder's own addons/<id>/, else
  // in the nearest parent folder that has one. opts.addons maps an id to a folder, first of all. addonDir(id) gives it.
  const addonDirs = new Map();
  const engineAddons = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'addons');
  const addonDir = (id) => {
    if (addonDirs.has(id)) return addonDirs.get(id);
    let found = null;
    if (/^[a-z][a-z0-9-]*$/.test(id)) found = fs.existsSync(path.join(engineAddons, id, 'manifest.json')) ? path.join(engineAddons, id) : null;
    else if (/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(id)) {
      found = opts.addons?.[id] ? path.resolve(opts.addons[id]) : null;
      for (let d = path.resolve(dir); !found; d = path.dirname(d)) {
        const k = path.join(d, 'addons', id);
        if (fs.existsSync(path.join(k, 'manifest.json'))) found = k;
        if (path.dirname(d) === d) break;
      }
    }
    addonDirs.set(id, found);
    return found;
  };
  const at = (rel) => {
    const a = /^addons\/([^/]+)\/(.+)$/.exec(rel);
    if (a) { const k = addonDir(a[1]); return k ? path.join(k, ...a[2].split('/')) : path.join(dir, ...rel.split('/')); }
    const m = /^kits\/([^/]+)\/(.+)$/.exec(rel);
    const own = path.join(dir, ...rel.split('/'));
    if (!m || fs.existsSync(own)) return own;
    const k = kitDir(m[1]);
    return k ? path.join(k, ...m[2].split('/')) : own;
  };
  // A link is never followed (R03): a file reached through a symbolic link reads as missing, and links() names every
  // link in the folder, so the checker refuses it (E-PATH) and the packer never ships a page without it.
  const lstat = (p) => { try { return fs.lstatSync(p); } catch { return null; } };
  const linked = (p) => {
    const roots = [dir, ...kitDirs.values(), ...addonDirs.values()].filter(Boolean).map(r => path.resolve(r));
    const full = path.resolve(p);
    const root = roots.filter(r => full === r || full.startsWith(r + path.sep)).sort((x, y) => y.length - x.length)[0];
    if (!root) return false;
    let cur = root;
    for (const part of path.relative(root, full).split(path.sep).filter(Boolean)) { cur = path.join(cur, part); if (lstat(cur)?.isSymbolicLink()) return true; }
    return false;
  };
  const links = () => {
    const out = [];
    const walk = (d, pre) => {
      let list = [];
      try { list = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of list) {
        if (e.isSymbolicLink()) out.push(pre + e.name);
        else if (e.isDirectory() && !['node_modules', '.git', 'evidence', 'tests'].includes(e.name)) walk(path.join(d, e.name), pre + e.name + '/');
      }
    };
    walk(path.resolve(dir), '');
    return out.sort();
  };
  return {
    read(rel) { const p = at(rel); return fs.existsSync(p) && !linked(p) ? fs.readFileSync(p, 'utf8') : null; },
    bytes(rel) { const p = at(rel); return fs.existsSync(p) && !linked(p) && fs.statSync(p).isFile() ? new Uint8Array(fs.readFileSync(p)) : null; },
    links,
    kitDir,
    addonDir,
  };
}
