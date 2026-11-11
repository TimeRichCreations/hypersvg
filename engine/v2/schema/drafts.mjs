// Grammar that is not in 2.0 but is a 2.1 draft (spec/2.0/drafts/). The document checker refuses it with one code,
// E-DRAFT, and a message that names the draft, before the schemas would call it an unknown key or kind.
// Plain ES module, no imports; the engine and the checker share it.
const DIR = 'spec/2.0/drafts/';
// The words D31 moved to 2.1 drafts wait in the work area until the spec's drafts folder lists them.
const B1C = 'spec/2.0/drafts/'; // B1c's grammar drafts (D31), with the prose drafts
const LATER_EFFECTS = new Set(['spring', 'aim', 'follow', 'limit', 'dynamics']);
const LATER_ACTIONS = ['goSpot', 'grab', 'carryTo', 'giveBack'];
// Document kinds that are drafts: the header check asks this before E-HEADER.
export const DRAFT_KINDS = Object.freeze({ 'logical-block': 'structure-2.1.md' });
const at = (p, k) => (p ? `${p}.${k}` : k);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// Returns [{code: 'E-DRAFT', path, message}] for every draft use in one parsed document.
export function draftUses(doc) {
  const out = [];
  const add = (path, what, file) => out.push({ code: 'E-DRAFT', path, message: `${what} is not in 2.0; a 2.1 draft (${file.startsWith('b1c/') ? `${B1C}${file.slice(4)}` : `${DIR}${file}`})` });
  if (!isObj(doc)) return out;
  if (doc.kind === 'experience' && own(doc, 'experiences')) add('experiences', 'nested experiences (experiences)', 'structure-2.1.md');
  // Grants that are 2.1 drafts (B2): the network grant and the site storage scope (delivery-2.1.md), and the widgets
  // grant of custom HTML widgets (custom-widgets-2.1.md), also as kinds a document lists as optional.
  if (isObj(doc.grants)) {
    const g = doc.grants;
    if (own(g, 'network')) add('grants.network', 'the network grant', 'delivery-2.1.md');
    if (own(g, 'widgets')) add('grants.widgets', 'the widgets grant (custom HTML widgets)', 'custom-widgets-2.1.md');
    (Array.isArray(g.storage) ? g.storage : []).forEach((x, i) => { if (x === 'site') add(`grants.storage[${i}]`, 'the site storage scope', 'delivery-2.1.md'); });
    (Array.isArray(g.optional) ? g.optional : []).forEach((x, i) => {
      if (x === 'network') add(`grants.optional[${i}]`, 'the network grant', 'delivery-2.1.md');
      if (x === 'widgets') add(`grants.optional[${i}]`, 'the widgets grant (custom HTML widgets)', 'custom-widgets-2.1.md');
    });
  }
  if (doc.kind === 'shell' && isObj(doc.slots) && Object.values(doc.slots).filter(x => isObj(x) && x.kind === 'stage').length > 1) add('slots', 'split screen (two or more stage slots)', 'structure-2.1.md');
  (Array.isArray(doc.uses) ? doc.uses : []).forEach((u, i) => { if (isObj(u) && own(u, 'places')) add(`uses[${i}].places`, 'a use of a logical block (places on a use)', 'structure-2.1.md'); });
  const story = doc.story;
  if (isObj(story)) {
    if (isObj(story.start)) add('story.start', 'split screen (a start per stage slot)', 'structure-2.1.md');
    (Array.isArray(story.links) ? story.links : []).forEach((l, i) => { if (isObj(l) && own(l, 'slot')) add(`story.links[${i}].slot`, 'split screen (a link into another stage slot)', 'structure-2.1.md'); });
  }
  (Array.isArray(doc.axes) ? doc.axes : []).forEach((a, i) => { if (isObj(a) && a.select === 'seed') add(`axes[${i}].select`, 'the seed selector', 'content-options-2.1.md'); });
  if (isObj(doc.effects)) for (const [id, e] of Object.entries(doc.effects)) if (isObj(e) && LATER_EFFECTS.has(e.kind)) add(at('effects', id), `the effect kind ${e.kind}`, 'effect-kinds-2.1.json');
  // Content options: a content value written as {options: {...}} where a field's value goes.
  const optionValue = (v, path) => { if (isObj(v) && isObj(v.options)) add(path, 'content options', 'content-options-2.1.md'); };
  if (isObj(doc.inputs)) for (const [n, d] of Object.entries(doc.inputs)) if (isObj(d)) optionValue(d.initial, at(at('inputs', n), 'initial'));
  // Every with map that sets content (Y1): the experience's own, a use's (uses[i].with), and a kit experience's scene
  // and shell overrides (story.scenes.<id>.with, shell.with, 4.9), each reported at its authored path.
  const withMaps = [[doc.with, 'with'], ...(Array.isArray(doc.uses) ? doc.uses.map((u, i) => [u?.with, `uses[${i}].with`]) : []),
    ...(isObj(story?.scenes) ? Object.entries(story.scenes).map(([id, sc]) => [isObj(sc) ? sc.with : undefined, `story.scenes.${id}.with`]) : []),
    [isObj(doc.shell) ? doc.shell.with : undefined, 'shell.with']];
  for (const [w, path] of withMaps) if (isObj(w)) for (const [n, v] of Object.entries(w)) optionValue(v, at(path, n));
  // Page actions: only where the grammar has an action list (Y1): entry and exit, a reaction's actions, a machine
  // state's entry, exit, transitions and timers, and a branch's then and else. Data (a value's initial rows, a
  // table) is never an action, whatever its fields are called.
  const list = (arr, path) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((a, i) => {
      if (!isObj(a)) return;
      const p = `${path}[${i}]`;
      for (const k of LATER_ACTIONS) if (own(a, k)) add(p, `the page action ${k}`, 'page-actions-2.1.json');
      list(a.then, `${p}.then`);
      list(a.else, `${p}.else`);
    });
  };
  const reactions = (on, path) => {
    if (isObj(on)) for (const [ev, rs] of Object.entries(on)) if (Array.isArray(rs)) rs.forEach((r, i) => { if (isObj(r)) list(r.actions, `${path}.${ev}[${i}].actions`); });
  };
  const node = (n, path) => {
    list(n.entry, at(path, 'entry'));
    list(n.exit, at(path, 'exit'));
    reactions(n.on, at(path, 'on'));
    (Array.isArray(n.after) ? n.after : []).forEach((t, i) => { if (isObj(t)) list(t.actions, `${at(path, 'after')}[${i}].actions`); });
    if (isObj(n.states)) for (const [k, st] of Object.entries(n.states)) if (isObj(st)) node(st, at(at(path, 'states'), k));
  };
  node({ entry: doc.entry, exit: doc.exit, on: doc.on }, '');
  if (isObj(doc.machines)) for (const [k, m] of Object.entries(doc.machines)) if (isObj(m)) node(m, at('machines', k));
  // Words that looked built but were not (D31, P1 "Words that look built but are not"): the export adapters' words
  //, the scene's choice timing, and the clip extras.
  if (doc.kind === 'experience') for (const k of ['report', 'clickArea']) if (own(doc, k)) add(k, `${k} (an export adapter's word)`, 'b1c/delivery-2.1.json');
  if (doc.kind === 'scene') {
    if (own(doc, 'endHoldMs')) add('endHoldMs', 'endHoldMs (an export adapter\'s word)', 'b1c/delivery-2.1.json');
    for (const k of ['choiceRegion', 'choicesAtMs']) if (own(doc, k)) add(k, k, 'b1c/choices-2.1.json');
  }
  // The scroll clock source (3.10), never built: a clock's source and spanMs, on a scene, a use or a shell slot.
  const clock = (c, path) => { if (isObj(c)) for (const k of ['source', 'spanMs']) if (own(c, k)) add(`${path}.${k}`, `the scroll clock source (clock ${k})`, 'scroll-clock-2.1.json'); };
  clock(doc.clock, 'clock');
  (Array.isArray(doc.uses) ? doc.uses : []).forEach((u, i) => { if (isObj(u)) clock(u.clock, `uses[${i}].clock`); });
  if (doc.kind === 'shell' && isObj(doc.slots)) for (const [k, sl] of Object.entries(doc.slots)) if (isObj(sl)) clock(sl.clock, `slots.${k}.clock`);
  if (isObj(doc.clips)) for (const [id, c] of Object.entries(doc.clips)) {
    if (!isObj(c)) continue;
    for (const k of CLIP_EXTRAS) if (own(c, k)) add(`clips.${id}.${k}`, `the clip word ${k}`, 'b1c/clip-extras-2.1.json');
    (Array.isArray(c.tracks) ? c.tracks : []).forEach((t, i) => { if (isObj(t)) for (const k of TRACK_EXTRAS) if (own(t, k)) add(`clips.${id}.tracks[${i}].${k}`, `the track word ${k}`, 'b1c/clip-extras-2.1.json'); });
  }
  return out;
}
const CLIP_EXTRAS = ['timeRemap', 'frameRate', 'holdFrames', 'blendMs'];
const TRACK_EXTRAS = ['wiggle', 'composite'];

// Drops the schema's own findings at or under a path a draft finding already names, so one cause gives one code.
export function withoutCovered(diags, drafts) {
  if (!drafts.length) return diags;
  const roots = drafts.map(d => d.path);
  return diags.filter(d => !roots.some(r => d.path === r || d.path.startsWith(`${r}.`) || d.path.startsWith(`${r}[`)));
}
