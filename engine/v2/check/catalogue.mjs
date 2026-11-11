// A kit's catalogue (4.8, D24): what a library offers, one entry per item, so a person or a tool can find an item
// and pick it (pick-and-use, src/kit.mjs applyPicks). kit.json names the file in `catalogue`. The checker validates it
// here (E-CATALOGUE); the kits family runs it for every kit an experience pins or picks from, and
// `check.mjs <kit folder>` runs it on a kit alone.
//
// {
//   "format": "hsvg/2.0", "kind": "catalogue", "kit": "<kit id>", "version": "<kit version>",
//   "items": {"<item id>": {"type": "icon", "title": "Star icon", "tags": ["icon"], "line": "One line.",
//                           "preview": "previews/icon-star.svg", "block": "icon-star"}}
// }
//
// Each item names exactly one thing of the kit: a `block` (a definition the kit lists), a `resource`, a `theme`, or a
// `preset` (an add-on preset's name, chapter 12) or `rulePack` (a rule pack use the kit lists). Its type says what it
// is, and must fit what it names.

// Type -> what it names and, for a block or resource, the kinds it may be.
export const CATALOGUE_TYPES = Object.freeze({
  background: { names: 'resource', kinds: ['image'] },
  icon: { names: 'block', kinds: ['component'] },
  image: { names: 'resource', kinds: ['image'] },
  video: { names: 'resource', kinds: ['video'] },
  sound: { names: 'resource', kinds: ['sound', 'audio'] },
  font: { names: 'resource', kinds: ['font'] },
  character: { names: 'block', kinds: ['component'] },
  control: { names: 'block', kinds: ['component'] },
  shell: { names: 'block', kinds: ['shell'] },
  layout: { names: 'block', kinds: ['scene'] },
  preset: { names: 'preset' },
  theme: { names: 'theme' },
  'rule-pack': { names: 'rulePack' },
});
export const TARGET_KEYS = ['block', 'resource', 'theme', 'preset', 'rulePack'];
const ITEM_KEYS = new Set(['type', 'title', 'tags', 'line', 'preview', ...TARGET_KEYS]);
const ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const TAG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PRESET = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)?(@(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*))?$/;
const PREVIEW = /\.(svg|png|jpe?g|webp)$/i;
const esc = (s) => String(s).replace(/~/g, '~0').replace(/\//g, '~1');

// The catalogue's findings: [{code, path, message}], each message ending with the fix.
// kit: the kit's document. blockKind(id): the kind of the kit's definition id, null when the kit has none, or
// undefined when it is listed but not read (its kind is then not compared).
// exists(rel): whether a file of the kit exists (rel is relative to the kit's folder).
export function checkCatalogue(cat, kit, { blockKind = () => null, exists = () => true } = {}) {
  const out = [];
  const bad = (path, message) => out.push({ code: 'E-CATALOGUE', path, message });
  if (!cat || typeof cat !== 'object' || Array.isArray(cat)) { bad('', 'a catalogue is a JSON object: {"format": "hsvg/2.0", "kind": "catalogue", "kit", "version", "items"}'); return out; }
  for (const k of Object.keys(cat)) if (!['format', 'kind', 'kit', 'version', 'items', 'about'].includes(k)) bad(`/${esc(k)}`, `${k} is not a catalogue key: keep format, kind, kit, version, items (and about)`);
  if (cat.format !== 'hsvg/2.0') bad('/format', 'write "format": "hsvg/2.0"');
  if (cat.kind !== 'catalogue') bad('/kind', 'write "kind": "catalogue"');
  if (cat.kit !== kit?.id) bad('/kit', `the catalogue says kit ${JSON.stringify(cat.kit)}; write "kit": ${JSON.stringify(kit?.id)}, the id in kit.json`);
  if (cat.version !== kit?.about?.version) bad('/version', `the catalogue says version ${JSON.stringify(cat.version)}; write "version": ${JSON.stringify(kit?.about?.version)}, the kit's about.version (a new kit version updates its catalogue)`);
  const items = cat.items;
  if (!items || typeof items !== 'object' || Array.isArray(items) || !Object.keys(items).length) { bad('/items', 'items is an object of item id to entry, with at least one item'); return out; }
  for (const [id, it] of Object.entries(items)) {
    const at = `/items/${esc(id)}`;
    if (!ID.test(id) || id.length > 48) bad(at, `item id ${JSON.stringify(id)}: use lower-case words joined by "-", at most 48 characters`);
    if (!it || typeof it !== 'object' || Array.isArray(it)) { bad(at, 'an item is an object {type, title, tags, line, preview, and what it names}'); continue; }
    for (const k of Object.keys(it)) if (!ITEM_KEYS.has(k)) bad(`${at}/${esc(k)}`, `${k} is not an item key: keep type, title, tags, line, preview and one of ${TARGET_KEYS.join(', ')}`);
    const type = CATALOGUE_TYPES[it.type];
    if (!type) bad(`${at}/type`, `type ${JSON.stringify(it.type)} is not known: use one of ${Object.keys(CATALOGUE_TYPES).join(', ')}`);
    if (typeof it.title !== 'string' || !it.title.trim() || it.title.length > 60) bad(`${at}/title`, 'give a title: a short name of at most 60 characters');
    if (!Array.isArray(it.tags) || it.tags.length < 1 || it.tags.length > 8 || it.tags.some(t => typeof t !== 'string' || !TAG.test(t)) || new Set(it.tags).size !== it.tags.length) bad(`${at}/tags`, 'give 1 to 8 different tags, each lower-case words joined by "-" (for example "dashboard")');
    if (typeof it.line !== 'string' || !it.line.trim() || it.line.length > 140 || /[\r\n]/.test(it.line)) bad(`${at}/line`, 'give a line: one sentence of at most 140 characters that says what the item is');
    if (typeof it.preview !== 'string' || !PREVIEW.test(it.preview) || it.preview.split('/').includes('..') || it.preview.startsWith('/')) bad(`${at}/preview`, 'give a preview: a path inside the kit to an .svg, .png, .jpg or .webp image (for example "previews/<item>.svg")');
    else if (!exists(it.preview)) bad(`${at}/preview`, `the preview ${it.preview} is not in the kit: add the image or fix the path`);
    const named = TARGET_KEYS.filter(k => it[k] !== undefined);
    if (named.length !== 1) { bad(at, `an item names exactly one thing: give one of ${TARGET_KEYS.join(', ')}${named.length ? ` (it gives ${named.join(' and ')})` : ''}`); continue; }
    const key = named[0];
    const target = it[key];
    if (type && type.names !== key) { bad(`${at}/${key}`, `a ${it.type} item names a ${type.names}, not a ${key}: write "${type.names}": "<id>"`); continue; }
    if (typeof target !== 'string') { bad(`${at}/${key}`, `${key} is the id of the thing it names, a string`); continue; }
    if (key === 'block') {
      const kind = blockKind(target);
      if (kind === null) bad(`${at}/block`, `kit ${kit?.id} lists no definition ${target} in blocks: add it to kit.json blocks or fix the id`);
      else if (kind !== undefined && type && !type.kinds.includes(kind)) bad(`${at}/type`, `${target} is a ${kind}; a ${it.type} item names a ${type.kinds.join(' or ')}: choose the type that fits (${Object.entries(CATALOGUE_TYPES).filter(([, t]) => t.kinds?.includes(kind)).map(([n]) => n).join(', ')})`);
    } else if (key === 'resource') {
      const r = kit?.resources?.[target];
      if (!r) bad(`${at}/resource`, `kit ${kit?.id} declares no resource ${target}: add it to kit.json resources or fix the id`);
      else if (type && !type.kinds.includes(r.kind)) bad(`${at}/type`, `${target} is a ${r.kind} resource; a ${it.type} item names a ${type.kinds.join(' or ')} resource: choose the type that fits`);
    } else if (key === 'theme') {
      if (!kit?.themes?.[target]) bad(`${at}/theme`, `kit ${kit?.id} has no theme ${target}: add it to kit.json themes or fix the id`);
    } else if (key === 'preset') {
      if (!PRESET.test(target)) bad(`${at}/preset`, `${target} is not a preset name: a built-in preset is a bare name (pop-in), an outside one owner.name@version (chapter 12)`);
    } else if (key === 'rulePack') {
      const uses = (kit?.rulePacks || []).map(u => (typeof u === 'string' ? u : u?.use));
      if (!uses.includes(target)) bad(`${at}/rulePack`, `kit ${kit?.id} lists no rule pack ${target} in rulePacks: add it there or fix the name`);
    }
  }
  return out;
}

// The items a search finds: every item whose id, type, title, line or tags hold each word. For tools (hsvg add --list).
export function findItems(cat, words = []) {
  const w = words.map(s => String(s).toLowerCase());
  return Object.entries(cat?.items || {}).filter(([id, it]) => {
    const text = [id, it.type, it.title, it.line, ...(it.tags || [])].join(' ').toLowerCase();
    return w.every(x => text.includes(x));
  }).map(([id, it]) => ({ id, ...it }));
}
