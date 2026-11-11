// Old words and common wrong guesses (D33, K2): each is E-WORD-RENAMED with a hint that names the final form. There
// is no alias: the player reads only the final words, and the checker says what to write instead.
// Runs on the loader's documents before the rule families. Every finding of the loader about a node that holds an old
// word is dropped (the schema's "must be" would only repeat it), and when any old word is found the rule families do
// not run: their findings would be about words that change.
import { allDocs } from './story/model.mjs';
import { growthSites, growthOf } from './builtins.mjs';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const q = (v) => JSON.stringify(v);

// A control written with an old kind, or a common wrong guess at one: the message, else null.
function controlWord(c) {
  if (!isObj(c)) return null;
  if (c.kind === 'press') return 'checked' in c
    ? `"kind": "press" with "checked" is now "kind": "toggle", and "checked" is its "value": {"kind": "toggle", "target": ${q(c.target ?? '<part>')}, "value": ${q(c.checked)}} (D33)`
    : `"kind": "press" is now "kind": "button" (D33)`;
  if (c.kind === 'option') return `"kind": "option" is now "kind": "choice" (D33)`;
  if (c.kind === 'slider' && c.axis === 'angle') return `a slider with "axis": "angle" is now "kind": "dial", with no axis (D33)`;
  if (c.kind === 'knob' || c.kind === 'wheel') return `"kind": ${q(c.kind)} is written "kind": "dial": a dial turns its target about its pivot (D33)`;
  if (c.kind === undefined && typeof c.type === 'string') return `a control names its sort with "kind", not "type": "kind": ${q(['press', 'option', 'knob', 'wheel'].includes(c.type) ? { press: 'button', option: 'choice', knob: 'dial', wheel: 'dial' }[c.type] : c.type)} (D33)`;
  if (c.kind === undefined && isObj(c.options)) return `a control with "options" is "kind": "choice" (D33)`;
  return null;
}

// An action written with an old verb: the message, else null.
const LISTS = new Set(['entry', 'exit', 'actions', 'then', 'else']);
function actionWord(a) {
  if (!isObj(a)) return null;
  if ('add' in a) return `"add" is now "set" with a formula: {"set": ${q(a.add)}, "to": ${q(`${a.add} + ${a.by ?? 1}`)}} (D33)`;
  if ('toggle' in a) return `"toggle" is now "set" with a formula: {"set": ${q(a.toggle)}, "to": ${q(`!${a.toggle}`)}} (D33)`;
  if ('trigger' in a) return `"trigger" is now "emit" as a trigger: {"emit": ${q(a.trigger)}, "as": "trigger"} (D33)`;
  if ('record' in a) return `"record" is now "emit" as a record: {"emit": ${q(a.record)}, "as": "record", "with": {...}} (D33)`;
  if ('sound' in a) return `"sound" is now "play" as a sound, and "gain" is "volume": {"play": ${q(a.sound)}, "as": "sound"} (D33)`;
  if ('attach' in a) return `"attach" is now the player's call: {"call": "player.attach", "with": {"part": ${q(`'${a.attach}'`)}, "to": ${q(`'${a.to}'`)}}} (D33)`;
  if ('detach' in a) return `"detach" is now the player's call with "to" null: {"call": "player.attach", "with": {"part": ${q(`'${a.detach}'`)}, "to": "null"}} (D33)`;
  if ('openUrl' in a) return `"openUrl" is now the player's call: {"call": "player.openUrl", "with": {"field": ${q(`'${a.openUrl}'`)}}} (D33)`;
  if ('setting' in a) return `"setting" is now the player's call: {"call": "player.setting", "with": {${q(a.setting)}: ${q(a.to)}}} (D33)`;
  if ('resetSaved' in a) return `"resetSaved" is now the player's call: {"call": "player.resetSaved"${a.settings ? ', "with": {"settings": true}' : ''}} (D33)`;
  if ('play' in a && 'gain' in a) return `a sound's loudness is "volume", with "as": "sound" (D33)`;
  return null;
}

// Today's channels as a final word with its settings (D33).
const CHANNEL = { 'translate-x': '"move": ..., "axis": "x"', 'translate-y': '"move": ..., "axis": "y"', route: '"move": ..., "axis": "route"',
  rotate: '"rotate": ...', skew: '"rotate": ..., "as": "lean"', scale: '"scale": ...', 'scale-x': '"scale": ..., "axis": "x"',
  'scale-y': '"scale": ..., "axis": "y"', 'stroke-width': '"scale": ..., "as": "line"', opacity: '"opacity": ...', fill: '"color": ..., "as": "fill"',
  stroke: '"color": ..., "as": "stroke"', dash: '"draw": ...', draw: '"draw": ...', wipe: '"draw": ..., "as": "wipe"', look: '"variant": ...', morph: '"motion.morph": ...' };
const TRACK = (w) => w.replace(/^"([^"]+)": \.\.\./, '"channel": "$1"');
const WORDS = ['text', 'label', 'visible', 'variant', 'color', 'move', 'rotate', 'scale', 'opacity', 'draw'];
// A binding written with an old key: the message, else null.
function bindingWord(b) {
  if (!isObj(b)) return null;
  if ('channel' in b) return CHANNEL[b.channel] ? `a binding names its word as its key: "channel": ${q(b.channel)} with "value" is now {${CHANNEL[b.channel].replace('...', q(b.value ?? '<formula>'))}} (D33)` : `a binding names its word as its key, not "channel": one of ${WORDS.join(', ')} (D33)`;
  if ('look' in b) return `"look" is now "variant": {"target": ${q(b.target)}, "variant": ${q(b.look)}} (D33)`;
  if ('picture' in b) return `"picture" is now "variant" with "as": "picture" (D33)`;
  if ('icon' in b) return `"icon" is now "variant" with "as": "icon" (D33)`;
  if ('size' in b) return `"size" is now "scale" with "as": "box" (D33)`;
  if ('points' in b) return `"points" is now "draw" with "as": "points" (D33)`;
  if ('face' in b) return `"face" is now "scale" on "axis": "x": -1 faces left, 1 faces right, such as {"target": ${q(b.target)}, "scale": "<test> ? -1 : 1", "axis": "x"} (D33)`;
  if ('label' in b && WORDS.some(w => w !== 'label' && w in b)) return `"label" is its own binding: {"target": ${q(b.target)}, "label": ${q(b.label)}}, next to the binding that shows (D33)`;
  if (isObj(b.fit) && 'region' in b.fit) return `a text's fit names its drawn box with "box", not "region": "fit": {"box": ${q(b.fit.region)}, ...} (D33)`;
  return null;
}

// Every old word of one document: [{path, message}], paths written as the loader writes them (a.b[0].c).
export function oldWords(doc) {
  const out = [];
  const join = (p, k) => (typeof k === 'number' ? `${p}[${k}]` : p ? `${p}.${k}` : String(k));
  if (isObj(doc?.controls)) for (const [id, c] of Object.entries(doc.controls)) {
    const m = controlWord(c);
    if (m) out.push({ path: join('controls', id), message: m });
  }
  (Array.isArray(doc?.bindings) ? doc.bindings : []).forEach((b, i) => { const m = bindingWord(b); if (m) out.push({ path: join('bindings', i), message: m }); });
  if (isObj(doc?.clips)) for (const [cid, c] of Object.entries(doc.clips)) (Array.isArray(c?.tracks) ? c.tracks : []).forEach((t, i) => {
    if (isObj(t) && CHANNEL[t.channel] && !['rotate', 'scale', 'opacity', 'draw'].includes(t.channel)) out.push({ path: join(join(join(join('clips', cid), 'tracks'), i), 'channel'), message: `a track's channel is a word: ${q(t.channel)} is now {${TRACK(CHANNEL[t.channel])}} (D33)` });
  });
  (Array.isArray(doc?.layouts) ? doc.layouts : []).forEach((l, i) => { if (isObj(l?.fit)) for (const [bid, f] of Object.entries(l.fit)) if (isObj(f) && 'region' in f) out.push({ path: join(join(join(join('layouts', i), 'fit'), bid), 'region'), message: `a fit names its drawn box with "box", not "region" (D33)` }); });
  // Action lists, wherever they sit (reactions, entry and exit, machine states and timers, if branches).
  const walk = (v, p) => {
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, join(p, i))); return; }
    if (!isObj(v)) return;
    for (const [k, x] of Object.entries(v)) {
      const at = join(p, k);
      if (LISTS.has(k) && Array.isArray(x)) x.forEach((a, i) => { const m = actionWord(a); if (m) out.push({ path: join(at, i), message: m }); });
      if (x && typeof x === 'object' && k !== 'controls') walk(x, at);
    }
  };
  walk(doc, '');
  return out;
}

// D34 and D39: an add-on's control kind, binding channel or clip track channel is a value <id>.<name> that its
// manifest declares (controls, paints). A value that names no such slot is one E-ADDON that names what exists.
// [{path, message}] for one document.
const KINDS = 'button, toggle, choice, slider, dial or drag';
const WHAT = { controls: ['control kind', `A control's core kind is ${KINDS}`], paints: ['channel', `A binding's core word is one of ${WORDS.join(', ')}; a track's core channel is one of move, rotate, scale, opacity, color, draw, variant (or motion.morph)`] };
export function addonWords(doc, exp) {
  const out = [];
  const join = (p, k) => (typeof k === 'number' ? `${p}[${k}]` : p ? `${p}.${k}` : String(k));
  for (const g of growthSites(doc)) {
    const { id, name, view, decl } = growthOf(exp, g.value, g.slot);
    if (decl) continue;
    const [what, core] = WHAT[g.slot];
    const has = Object.keys(view?.[g.slot] || {}).map(n => `${id}.${n}`);
    const why = !view ? `${id} is not an add-on this experience pins (an add-on's ${what} is <id>.<name>, and the add-on is pinned and in needs)` : has.length ? `${id} adds no ${what} ${name}; it adds ${has.join(', ')}` : `${id} adds no ${what}: its manifest declares no ${g.slot}`;
    out.push({ path: g.at.reduce(join, ''), message: `${q(g.value)}: ${why}. ${core}. An add-on draws a binding as {"<add-on>": {...}} when its manifest declares draws (D39)` });
  }
  return out;
}
// The loader's schema findings under an add-on word give way to one E-ADDON that says what an add-on cannot add.
export function refineAddonWords(diags, experience) {
  if (!experience) return diags;
  const words = [];
  for (const d of allDocs(experience)) for (const w of addonWords(d.doc, experience)) words.push({ file: d.file, code: 'E-ADDON', path: w.path, message: w.message });
  if (!words.length) return diags;
  const under = (d) => words.some(w => w.file === d.file && (d.path === w.path || d.path.startsWith(`${w.path}.`) || d.path.startsWith(`${w.path}[`)));
  return [...diags.filter(d => !under(d)), ...words];
}

// diags: the loader's findings. Returns {diags, found}: found is true when an old word was found.
export function refineRenamed(diags, experience) {
  if (!experience) return { diags, found: false };
  const words = [];
  for (const d of allDocs(experience)) for (const w of oldWords(d.doc)) words.push({ file: d.file, code: 'E-WORD-RENAMED', path: w.path, message: w.message });
  if (!words.length) return { diags, found: false };
  const under = (d) => words.some(w => w.file === d.file && (d.path === w.path || d.path.startsWith(`${w.path}.`) || d.path.startsWith(`${w.path}[`)));
  return { diags: [...diags.filter(d => !under(d)), ...words], found: true };
}

// Not a rule family: the refinement runs on the loader's findings in index.mjs.
export const check = () => {};
