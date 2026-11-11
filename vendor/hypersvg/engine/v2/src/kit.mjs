// Kits (4.8, 4.9). A kit experience pins one kit version. Its scenes and shell are uses of the kit's definitions, and
// its top-level `with` sets the kit's inputs. The loader reads the kit (load.mjs); this module turns the kit experience
// into the form the player already plays: the kit's blocks become the experience's blocks, each scene use becomes a
// scene, and the kit's inputs, themes, roles, rights, axes, rules and needs join the experience document.
// The engine never knows a kit by name: it reads what the files declare.
//
// Where a kit lives: in a package, at `kits/<id>/` beside experience.json (10.8). While authoring, the same path: a
// folder source also finds `kits/<id>/` in a parent folder (load.mjs, folderSource).
import { parse, oneName, slotFormula } from './formula.mjs';
import { parseStrict } from '../schema/json-strict.mjs';
import { parseCsv } from './read.mjs';
export { oneName };

// The folder a kit's files are read from, inside the experience's source.
export const kitRoot = (id) => `kits/${id}`;

// The pin of a kit experience: {id, version, digest?}, or null.
// The inputs a use or a with may set (F1a item 6), for a message: "; its inputs are a, b" (the first 30).
const inputNames = (names) => (names.length ? `; its inputs are ${names.slice(0, 30).join(', ')}${names.length > 30 ? ` and ${names.length - 30} more` : ''}` : '; it has no inputs');

export function kitPin(doc) {
  const k = doc?.kit;
  return k && typeof k === 'object' && !Array.isArray(k) && typeof k.id === 'string' && typeof k.version === 'string' ? k : null;
}

// Reads the pinned kit from kits/<id>/ with the reader's own helpers (read.mjs readExperience): its document, data
// tables and blocks, each checked as the reader checks. Returns the kit, or null with E-KIT-PIN.
// at: the pin's address in experience.json ('/kit', or '/picks/<n>' for a library an experience picks from).
// withCatalogue: also read the kit's catalogue (pick-and-use needs it): kit.catalogue = {file, doc}.
export function readKit({ source, add, named, readDoc, readDrawings, words, join, needs, coveredBy }, p, at = '/kit', withCatalogue = false) {
  const root = kitRoot(p.id);
  const file = `${root}/kit.json`;
  const text = source.read(file);
  if (text == null) { add('experience.json', [{ code: 'E-KIT-PIN', path: at, message: `kit ${p.id} ${p.version} is not found (looked for ${file}; put the kit at kits/${p.id}/ beside the experience or in a parent folder)` }]); return null; }
  const k = readDoc(file, needs, 'experience.json', at);
  if (!k) return null;
  if (k.doc.kind !== 'kit' || k.doc.id !== p.id) { add('experience.json', [{ code: 'E-KIT-PIN', path: `${at}/id`, message: `${file} is ${k.doc.kind} ${k.doc.id}, not kit ${p.id}` }]); return null; }
  if (k.doc.about?.version !== p.version) { add('experience.json', [{ code: 'E-KIT-PIN', path: `${at}/version`, message: `kit ${p.id} is version ${k.doc.about?.version}, not the pinned ${p.version}` }]); return null; }
  const kitNeeds = [...needs, ...(k.doc.needs || []).filter(n => !needs.includes(n))];
  const kit = { file, root, doc: k.doc, needs: kitNeeds, words: words(file, k.doc), data: {}, blocks: {} };
  if (withCatalogue) {
    const cf = typeof k.doc.catalogue === 'string' ? named(root, k.doc.catalogue, file, 'catalogue') : null;
    const ct = cf ? source.read(cf) : null;
    if (ct == null) add('experience.json', [{ code: 'E-CATALOGUE', path: at, message: `kit ${p.id} has ${cf ? `no file ${cf}` : 'no catalogue'}; pick-and-use names items of a kit's catalogue (kit.json "catalogue": "catalogue.json")` }]);
    else try { kit.catalogue = { file: cf, doc: parseStrict(ct) }; } catch (e) { add(cf, [{ code: 'E-JSON', path: '', message: e.message }]); }
  }
  for (const [name, t] of Object.entries(k.doc.data || {})) {
    const res = k.doc.resources?.[t.resource];
    if (!res) { add(file, [{ code: 'E-REF-UNKNOWN', path: `data.${name}`, message: `resource ${t.resource} is not declared` }]); continue; }
    const f = named(root, res.file, file, `resources.${t.resource}.file`);
    if (f === null) continue;
    const dt = source.read(f);
    if (dt == null) { add(file, [{ code: 'E-FILE-MISSING', path: res.file, message: 'data file not found' }]); continue; }
    try { kit.data[name] = f.endsWith('.json') ? parseStrict(`{"rows":${dt}}`).rows : parseCsv(dt, t.columns); } catch (e) { add(f, [{ code: 'E-DATA', path: f, message: e.message }]); }
  }
  // kit.block(id) reads one definition the first time it is asked for. A kit experience reads them all; a library an
  // experience picks from reads only what its items reach, so the package carries only those files.
  const tried = new Set();
  const block = (id) => {
    if (!tried.has(id)) {
      tried.add(id);
      const rel = Object.hasOwn(k.doc.blocks || {}, id) ? k.doc.blocks[id] : null;
      if (typeof rel === 'string') {
        const at = join(root, rel);
        const b = readDoc(rel, coveredBy(kitNeeds), file, `blocks.${id}`, root);
        if (b) kit.blocks[id] = { file: at, doc: b.doc, drawings: readDrawings(at, b.doc), words: words(at, b.doc), kit: p.id };
      }
    }
    return kit.blocks[id] || null;
  };
  Object.defineProperty(kit, 'block', { value: block, enumerable: false }); // not cloned or serialized with the kit
  if (!withCatalogue) for (const id of Object.keys(k.doc.blocks || {})) kit.block(id);
  return kit;
}

// A `with` formula that is a literal: {value} for a string, number, boolean or a negated number; else null.
// A use's `with` may also hold a literal object or list (a language or tier object, rows): those pass as they are.
export function literalOf(src) {
  if (src !== null && typeof src === 'object') return { value: src };
  if (typeof src === 'number' || typeof src === 'boolean') return { value: src };
  if (typeof src !== 'string') return null;
  let tree;
  try { tree = parse(src); } catch { return null; }
  if (tree.k === 'lit' && tree.v !== null) return { value: tree.v };
  if (tree.k === 'un' && tree.op === '-' && tree.v.k === 'lit' && typeof tree.v.v === 'number') return { value: -tree.v.v };
  return null;
}

// Joins words maps by language: later maps win for the same id (an owner's words win, 2.7).
function mergeWords(...maps) {
  const out = {};
  for (const m of maps) for (const [lang, w] of Object.entries(m || {})) out[lang] = { ...(out[lang] || {}), ...w };
  return out;
}

const SCENE_KINDS = new Set(['scene']);
const SHELL_KINDS = new Set(['shell']);

// One use of a kit definition as a scene or the shell: a copy of the definition's document whose inputs take the use's
// `with`. A literal becomes the input's `initial`. A formula of one name (`"cta"`) passes the named input through: the
// input keeps its declaration (its tiers, `required`, `optional`), marked `from: <name>`, and the engine feeds it the
// named value as it is, tier or language object included (7.9), so the ladder and the checker see it. Any other formula
// becomes a computed value of the same name, read in the scene's scope, which sees the kit experience's inputs (the
// kit's inputs face) and words, as the use's parent scope would (5.3). The definition's file, drawings and words are
// shared.
export function useOfDefinition(def, use) {
  const doc = structuredClone(def.doc);
  for (let [k, f] of Object.entries(use.with || {})) {
    const decl = doc.inputs?.[k];
    if (!decl || decl.kind === 'trigger') continue; // the checker reports it (E-TYPE, E-SEAL)
    // A text input takes plain words or one {{ formula }} (D31.1); words around {{ }} are refused by the checker.
    f = slotFormula(decl, f);
    if (f === null) continue;
    const lit = literalOf(f);
    if (lit) { doc.inputs[k] = { ...decl, initial: lit.value }; continue; }
    const one = oneName(f);
    if (one) { doc.inputs[k] = { ...decl, from: one }; continue; }
    delete doc.inputs[k];
    doc.computed = { ...(doc.computed || {}), [k]: f };
  }
  return doc;
}

// Applies a loaded kit to a loaded kit experience, in place. kit: {file, root, doc, blocks: {id: entry}, words, data}.
// report(code, file, path, message). Returns the experience.
export function applyKit(experience, kit, report = () => {}) {
  const own = experience.doc;
  const k = kit.doc;
  const doc = structuredClone(own);
  // The kit's inputs face is the kit experience's (4.2). Its top-level `with` gives literal values; a formula there
  // reads only words and data, so it is worked out once here, in the default language.
  const inputs = structuredClone(k.inputs || {});
  for (const [name, f] of Object.entries(own.with || {})) {
    if (!inputs[name]) { report('E-TYPE', experience.file, `/with/${name}`, `${name} is not an input of kit ${k.id}${inputNames(Object.keys(inputs))}`); continue; }
    const src = slotFormula(inputs[name], f); // a text input: plain words, or {{ words.x }} (D31.1)
    const lit = (src === null ? null : literalOf(src) ?? wordsLiteral(src, experience, kit));
    if (lit) inputs[name] = { ...inputs[name], initial: lit.value };
    else report('E-KIT-BODY', experience.file, `/with/${name}`, `the kit input ${name} takes ${src === null || typeof f === 'string' && inputs[name].type === 'string' ? 'plain words or one word, as "{{ words.<id> }}"' : 'a literal or a word'}, not ${JSON.stringify(f)}`);
  }
  if (Object.keys(inputs).length) doc.inputs = inputs;
  delete doc.with;
  // Themes, roles and rights are the kit's. The kit experience's `theme` selects among the kit's themes (7.7).
  if (k.themes) doc.themes = structuredClone(k.themes);
  // The kit's built-in settings (addons, such as rich-text styles) are the experience's (4.9, D31).
  if (k.addons) doc.addons = { ...structuredClone(k.addons), ...(own.addons || {}) };
  if (own.theme === undefined && k.theme !== undefined) doc.theme = k.theme;
  if (k.roles) doc.roles = structuredClone(k.roles);
  if (k.rights) doc.rights = structuredClone(k.rights);
  if (own.language === undefined && k.language !== undefined) doc.language = k.language;
  // Axes: the kit's entries, then the kit experience's, which narrow them (7.1). Rules and packs: the kit's, then the
  // kit experience's stricter ones (8.6). Needs: the union (10.11).
  for (const key of ['axes', 'rules', 'rulePacks', 'waivers']) {
    if (Array.isArray(k[key]) || Array.isArray(own[key])) doc[key] = [...structuredClone(k[key] || []), ...structuredClone(own[key] || [])];
  }
  const needs = [...(k.needs || [])];
  for (const n of own.needs || []) if (!needs.includes(n)) needs.push(n);
  if (needs.length) doc.needs = needs;
  experience.needs = needs;

  // The kit's components and compounds are used like the experience's own (the brief's "blocks").
  const kitWords = kit.words || {};
  for (const [id, b] of Object.entries(kit.blocks)) {
    if (SCENE_KINDS.has(b.doc.kind) || SHELL_KINDS.has(b.doc.kind)) continue;
    experience.blocks[id] = { ...b, words: mergeWords(kitWords, b.words), kit: k.id };
  }
  // Scenes: each scene use becomes a scene. The story names the definition's file, so references and paths resolve.
  const scenes = {};
  for (const [id, entry] of Object.entries(own.story?.scenes || {})) {
    if (typeof entry === 'string') { report('E-KIT-BODY', experience.file, `/story/scenes/${id}`, `scene ${id} is a file; a kit experience's scenes are uses of kit definitions`); continue; }
    const def = kit.blocks[entry?.use];
    if (!def || !SCENE_KINDS.has(def.doc.kind)) { report('E-REF-UNKNOWN', experience.file, `/story/scenes/${id}/use`, `kit ${k.id} has no scene definition ${entry?.use}`); continue; }
    experience.scenes[id] = { file: def.file, doc: useOfDefinition(def, entry), drawings: def.drawings, words: mergeWords(kitWords, def.words), kit: k.id, use: entry.use, with: entry.with || {} };
    scenes[id] = def.file;
  }
  if (doc.story) doc.story = { ...doc.story, scenes };
  // The shell: a use of a kit shell definition (10.1).
  if (own.shell && typeof own.shell === 'object') {
    const def = kit.blocks[own.shell.use];
    if (!def || !SHELL_KINDS.has(def.doc.kind)) report('E-REF-UNKNOWN', experience.file, '/shell/use', `kit ${k.id} has no shell definition ${own.shell.use}`);
    else experience.shell = { file: def.file, doc: useOfDefinition(def, own.shell), drawings: def.drawings, words: mergeWords(kitWords, def.words), kit: k.id, use: own.shell.use, with: own.shell.with || {} };
    delete doc.shell;
  }
  // Data tables of the kit join the experience's (2.8); the experience's own win.
  experience.data = { ...(kit.data || {}), ...(experience.data || {}) };
  experience.own = own;
  experience.kit = kit;
  experience.doc = doc;
  return experience;
}

// A top-level `with` that reads one word (`words.brandName`): its text in the default language.
function wordsLiteral(f, experience, kit) {
  const m = typeof f === 'string' && /^\s*words\.([A-Za-z][A-Za-z0-9]*)\s*$/.exec(f);
  if (!m) return null;
  const lang = experience.doc.language || kit.doc.language || 'en';
  const text = experience.words?.[lang]?.[m[1]] ?? kit.words?.[lang]?.[m[1]];
  return typeof text === 'string' ? { value: text } : null;
}

// ---------- pick-and-use (4.8, D24) ----------
// The libraries an experience picks from: [{id, version, digest?, items}], or [].
export const picksOf = (doc) => (Array.isArray(doc?.picks) ? doc.picks.filter(p => p && typeof p.id === 'string' && typeof p.version === 'string' && Array.isArray(p.items)) : []);

// Reads every library an experience (not a kit experience) picks from, with its catalogue, and applies the picks.
// ctx: the reader's helpers (read.mjs), as for readKit.
export function readPicks(ctx, experience) {
  const picks = picksOf(experience.doc);
  if (!picks.length) return;
  const report = (code, file, path, message) => ctx.add(file, [{ code, path, message }]);
  picks.forEach((p, n) => {
    const kit = readKit(ctx, p, `/picks/${n}`, true);
    if (kit) applyPicks(experience, kit, p, n, report);
  });
  usePicked(experience, report);
}

// The kit definitions a definition uses, all the way down (its `use` names that are kit blocks), itself first.
function withDependencies(kit, id) {
  const out = []; const todo = [id];
  while (todo.length) {
    const x = todo.shift();
    if (out.includes(x) || !kit.block(x)) continue;
    out.push(x);
    (function walk(v) {
      if (Array.isArray(v)) { v.forEach(walk); return; }
      if (!v || typeof v !== 'object') return;
      if (typeof v.use === 'string' && Object.hasOwn(kit.doc.blocks || {}, v.use)) todo.push(v.use);
      Object.values(v).forEach(walk);
    })(kit.blocks[x].doc);
  }
  return out;
}

// Applies the items an experience picks from one library (a loaded kit with its catalogue), in place. The rule: each
// item names one thing of the kit (its catalogue entry); that thing joins the experience under its own id, as the
// kit has it, sealed, with the definitions it uses: a component, compound or logical block joins `blocks` (a scene's
// `uses` may use it); a scene or a shell may be used as a story scene or the shell, {"use", "with"} as in a kit
// experience; a resource joins `resources` (its file read from the kit); a theme joins `themes`. The kit's rights join
// the experience's (an editableBy names them). A preset or a rule pack is used by its own door (`presets`,
// `rulePacks`), so it is never picked. An id the experience already uses is refused (E-ID-DUPLICATE).
// pick: the entry of `picks`; n: its index. report(code, file, path, message).
export function applyPicks(experience, kit, pick, n, report = () => {}) {
  const at = `/picks/${n}`;
  const k = kit.doc;
  const doc = experience.doc;
  const items = kit.catalogue?.doc?.items;
  if (!items) return experience;
  const picked = experience.picked || (experience.picked = { kits: {}, blocks: {}, from: {}, own: structuredClone(doc) });
  picked.kits[k.id] = kit;
  const kitWords = kit.words || {};
  const taken = (id, where) => {
    const from = picked.from[`${where}:${id}`];
    if (from === k.id) return 'same';
    return from || (where === 'block' ? experience.blocks[id] : doc[where]?.[id]) ? 'taken' : null;
  };
  pick.items.forEach((item, j) => {
    const ia = `${at}/items/${j}`;
    const e = items[item];
    if (!e || typeof e !== 'object') { report('E-REF-UNKNOWN', experience.file, ia, `kit ${k.id} ${k.about?.version} has no catalogue item ${item} (see ${kit.catalogue.file})`); return; }
    if (typeof e.block === 'string') {
      if (!kit.block(e.block)) { report('E-REF-UNKNOWN', experience.file, ia, `catalogue item ${item} names ${e.block}, which kit ${k.id} does not list`); return; }
      for (const id of withDependencies(kit, e.block)) {
        const t = taken(id, 'block');
        if (t === 'same') continue;
        if (t) { report('E-ID-DUPLICATE', experience.file, ia, `${id} (from kit ${k.id}) is already a block of this experience or of another library: rename yours, or pick only one`); continue; }
        const b = kit.blocks[id];
        picked.from[`block:${id}`] = k.id;
        const entry = { ...b, words: mergeWords(kitWords, b.words), kit: k.id };
        if (SCENE_KINDS.has(b.doc.kind) || SHELL_KINDS.has(b.doc.kind)) picked.blocks[id] = entry;
        else experience.blocks[id] = entry;
      }
    } else if (typeof e.resource === 'string') {
      const r = k.resources?.[e.resource];
      if (!r) { report('E-REF-UNKNOWN', experience.file, ia, `catalogue item ${item} names resource ${e.resource}, which kit ${k.id} does not declare`); return; }
      const t = taken(e.resource, 'resources');
      if (t === 'taken') { report('E-ID-DUPLICATE', experience.file, ia, `resource ${e.resource} is already declared: rename yours, or pick only one`); return; }
      picked.from[`resources:${e.resource}`] = k.id;
      doc.resources = { ...(doc.resources || {}), [e.resource]: { ...r, ...(typeof r.file === 'string' ? { file: `${kit.root}/${r.file}` } : {}) } };
    } else if (typeof e.theme === 'string') {
      // A theme brings the themes it extends.
      for (let id = e.theme; id && k.themes?.[id]; id = k.themes[id].extends) {
        const t = taken(id, 'themes');
        if (t === 'same') continue;
        if (t) { report('E-ID-DUPLICATE', experience.file, ia, `theme ${id} is already declared: rename yours, or pick only one`); break; }
        picked.from[`themes:${id}`] = k.id;
        doc.themes = { ...(doc.themes || {}), [id]: structuredClone(k.themes[id]) };
      }
    } else report('E-REF-UNKNOWN', experience.file, ia, `catalogue item ${item} is a ${e.type}: use it by its own door (${e.preset !== undefined ? '"presets", chapter 12' : '"rulePacks", 8.3'}), not by picks`);
  });
  // The kit's rights, so the picked definitions' editableBy names a right this experience has (9.9).
  for (const [id, r] of Object.entries(k.rights || {})) if (!doc.rights?.[id]) doc.rights = { ...(doc.rights || {}), [id]: structuredClone(r) };
  experience.data = { ...(kit.data || {}), ...(experience.data || {}) };
  return experience;
}

// After every library is applied: the story scenes and the shell that use a picked scene or shell definition become
// scenes and the shell, as in a kit experience. A picked scene's needs are covered by its kit's needs, which join the
// experience's (10.11).
export function usePicked(experience, report = () => {}) {
  const picked = experience.picked;
  if (!picked) return experience;
  const doc = experience.doc;
  const addNeeds = (kitId) => {
    for (const nd of picked.kits[kitId]?.doc.needs || []) if (!experience.needs.includes(nd)) experience.needs.push(nd);
    if (experience.needs.length) doc.needs = [...experience.needs];
  };
  for (const [id, entry] of Object.entries(doc.story?.scenes || {})) {
    if (typeof entry === 'string') continue;
    const def = picked.blocks[entry?.use];
    if (!def || !SCENE_KINDS.has(def.doc.kind)) { report('E-REF-UNKNOWN', experience.file, `/story/scenes/${id}/use`, `no picked scene definition ${entry?.use}: pick it first (picks), or name a scene file`); continue; }
    experience.scenes[id] = { file: def.file, doc: useOfDefinition(def, entry), drawings: def.drawings, words: def.words, kit: def.kit, use: entry.use, with: entry.with || {} };
    doc.story.scenes[id] = def.file;
    addNeeds(def.kit);
  }
  if (doc.shell && typeof doc.shell === 'object') {
    const def = picked.blocks[doc.shell.use];
    if (!def || !SHELL_KINDS.has(def.doc.kind)) report('E-REF-UNKNOWN', experience.file, '/shell/use', `no picked shell definition ${doc.shell.use}: pick it first (picks)`);
    else { experience.shell = { file: def.file, doc: useOfDefinition(def, doc.shell), drawings: def.drawings, words: def.words, kit: def.kit, use: doc.shell.use, with: doc.shell.with || {} }; addNeeds(def.kit); }
    delete doc.shell;
  }
  return experience;
}

// ---------- versions (4.8) ----------
const VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
// {major, minor, patch, pre} or null.
export function parseVersion(v) {
  const m = VERSION.exec(String(v));
  return m ? { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ?? null } : null;
}
// The class of the step from a to b: 'major', 'minor', 'patch', 'same' or 'down' (b is not after a).
export function versionStep(a, b) {
  const x = parseVersion(a); const y = parseVersion(b);
  if (!x || !y) return null;
  if (y.major !== x.major) return y.major > x.major ? 'major' : 'down';
  if (y.minor !== x.minor) return y.minor > x.minor ? 'minor' : 'down';
  if (y.patch !== x.patch) return y.patch > x.patch ? 'patch' : 'down';
  if (x.pre === y.pre) return 'same';
  return 'patch';
}
