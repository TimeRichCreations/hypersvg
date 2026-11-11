// Stage 2: the core of the 2.0 engine. Values (5.1), computed values (5.2), inputs (5.3), outputs (5.4), events
// (5.12), reactions (5.13), machines (5.14), actions (5.15), uses (4.3, 4.5), and transactions (9.2).
// All mutable state is one plain object (this.state), so a fault rolls back by restoring a snapshot (snapshot()).
import { channelOf } from './binding-words.mjs';
import { parse, evaluate, renderTemplate, deepEqual, FormulaError, oneName, slotFormula } from './formula.mjs';
import { Stored } from './storage.mjs';
import { FORMAT, raisedLimits, activeLimits, refusedLimits, refusalMessage } from './limits.mjs';
import { installLimits } from './limits-runtime.mjs';
import { installCapabilities, packageNeeds, needsGap, capabilityNames, registered } from './capabilities.mjs';
import { isTierObject, wordingAt, fieldShown, giveWayRules } from './tiers.mjs';
import { entryKey } from './entry-key.mjs';

// Sources whose fault is refused and play goes on (9.2): the host, a seat's host port and the settings form (a change,
// 5.3.2 and 9.10). Any other fault stops.
const REFUSED_ONLY = new Set(['host', 'seat', 'widget']);
const WHOLE_FIELD = /^\s*\{\{\s*[A-Za-z_][\w.]*\s*\}\}\s*$/; // a text binding that shows one field (tiers, 7.9)
// The earlier of two clock steps ({due, run}), the first on a tie.
// A deadline that runs on its owner's speed (3.10): every one but a line's and a capability's (they keep their rate).
const scaled = (t) => t.lineRun === undefined && t.cap === undefined;
const earlier = (a, b) => (!a ? b : !b ? a : b.due < a.due ? b : a);
export class EngineFault extends Error {
  constructor(code, message, address) { super(`${code} ${address || ''}: ${message}`); this.code = code; this.address = address; }
}
const fault = (code, msg, addr) => { throw new EngineFault(code, msg, addr); };
// An error the stack or memory throws (a RangeError such as a stack overflow; Firefox's InternalError) is a budget
// passed (9.2): a fault with a code, E-EVENT-LOOP, so it rolls back and stops like any other. Anything else is unchanged.
export function overflowFault(e, address) {
  if (e instanceof EngineFault || !(e instanceof RangeError || e?.name === 'InternalError')) return e;
  return new EngineFault('E-EVENT-LOOP', `the evaluation went too deep or too large (${String(e.message).slice(0, 80)})`, address);
}
const clone = (v) => (v === undefined ? undefined : structuredClone(v));
// The fixed key set of 5.12.
const KEY_CODE = /^(Key[A-Z]|Digit[0-9]|Space|Enter|Arrow(Left|Right|Up|Down)|Shift(Left|Right))$/;
// The ambient inputs a person's own setting may write (5.5, 5.15 setting), with their types and bounds.
export const AMBIENT_SETTINGS = Object.freeze({ muted: { type: 'boolean' }, volume: { type: 'number', minimum: 0, maximum: 1 }, voice: { type: 'boolean' }, reducedMotion: { type: 'boolean' }, timeLimits: { type: 'number', minimum: 0, maximum: 10 } });
// A person's setting checked like any value (principle 4): type and bounds, never clamped. timeLimits is 0 (off) or
// 1..10 (a multiplier): a setting never shortens a time limit.
export function checkSetting(name, v) {
  const bad = checkValue(AMBIENT_SETTINGS[name], v);
  if (bad) return bad;
  if (name === 'timeLimits' && v > 0 && v < 1) return ['E-RANGE', `${v} is between 0 (off) and 1; a time limit is never shortened`];
  return null;
}
// A person's time limits (10.13, WCAG 2.2.1): the ambient timeLimits multiplies the timers a person may need more
// time for (timed links and machine timers), or turns them off (0). An off timer waits at OFF with its written
// remaining time in `rest`. Clips, markers, line words, transitions and effects keep their own time: motion is not a
// time limit.
export const OFF = Number.MAX_SAFE_INTEGER;
// reducedMotion is the system preference or the person's own setting (5.5): a setting can turn it on, never off while
// the system asks for it. The host writes the system side with motionPreference.
const motionOf = (a) => a.motionSystem === true || a.motionChosen === true;
// The built-in experience outputs a host hears (5.12, 10.6).
// A stable id an openUrl parameter may carry (10.4): lower-case, starting with a letter, at most 64 characters.
const URL_PARAM_ID = /^[a-z][a-z0-9-]{0,63}$/;
export const HOST_OUTPUTS = Object.freeze(['entered', 'ended', 'openUrl', 'firstInput', 'hookHealth']);
// The state outside the blocks that painting never reads, or reads through the blocks (9.1).
const SKIP_TOP = new Set(['now', 'seq', 'revision', 'blocks', 'records', 'timers', 'outputs', 'deliveries']);
const AMBIENT = ['now', 'elapsed', 'reducedMotion', 'timeLimits', 'inputMode', 'language', 'size', 'muted', 'volume', 'voice', 'spoken', 'visits', 'canReturn', 'chapter', 'hooks', 'layout'];

// Own names only (5.9): a name from Object.prototype (toString, valueOf, __proto__) is never a value or a member.
export const own = (o, k) => o != null && typeof o === 'object' && Object.hasOwn(o, k);
// A url value is an absolute https: address of at most 2048 characters (5.3.1). Returns why it is not, or null.
export function urlProblem(v) {
  if ([...v].length > 2048) return 'a url is at most 2048 characters';
  if (!/^https:\/\/[^\s\\]+$/i.test(v)) return `${JSON.stringify(v.slice(0, 40))} is not an absolute https: address`;
  let u; try { u = new URL(v); } catch { u = null; }
  if (!u || u.protocol !== 'https:' || !u.hostname) return `${JSON.stringify(v.slice(0, 40))} is not an absolute https: address`;
  return null;
}
// A formula's rounding (0.1 + 0.2, 224.00000000000003) is not a value out of bounds: a bound allows 1e-9 of itself (at
// least 1e-9), as the step check does, and the value is stored at the bound (onBound).
const slack = (b) => 1e-9 * Math.max(1, Math.abs(b));
export const onBound = (decl, v) => (typeof v !== 'number' || decl?.type !== 'number' ? v : decl.minimum !== undefined && v < decl.minimum ? decl.minimum : decl.maximum !== undefined && v > decl.maximum ? decl.maximum : v);
// Type and bounds check of a whole value (5.1.1). Returns null or a fault code and message.
export function checkValue(decl, v, depth = 0) {
  if (depth > FORMAT.dataDepth) return ['E-RANGE', `nested deeper than ${FORMAT.dataDepth}`];
  const t = decl.type;
  const typeOk = t === 'number' ? typeof v === 'number' && Number.isFinite(v) : t === 'boolean' ? typeof v === 'boolean'
    : t === 'string' ? typeof v === 'string' : t === 'array' ? Array.isArray(v) : t === 'object' ? v !== null && typeof v === 'object' && !Array.isArray(v) : false;
  if (!typeOk) return ['E-TYPE', `expected ${t}, found ${v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v}`];
  if (t === 'number') {
    if (decl.minimum !== undefined && v < decl.minimum - slack(decl.minimum)) return ['E-RANGE', `${v} is below ${decl.minimum}`];
    if (decl.maximum !== undefined && v > decl.maximum + slack(decl.maximum)) return ['E-RANGE', `${v} is above ${decl.maximum}`];
    if (decl.step !== undefined) { const n = (v - (decl.minimum ?? 0)) / decl.step; if (Math.abs(n - Math.round(n)) > 1e-9) return ['E-RANGE', `${v} is off the step ${decl.step}`]; }
  }
  if (t === 'string') {
    if (decl.maxLength !== undefined && [...v].length > decl.maxLength) return ['E-RANGE', `longer than ${decl.maxLength}`];
    if (decl.enum && !decl.enum.includes(v)) return ['E-RANGE', `${JSON.stringify(v)} is not one of the enum`];
    if (decl.contentType === 'url') { const why = urlProblem(v); if (why) return ['E-TYPE', why]; }
  }
  if (t === 'array') {
    if (decl.maxItems !== undefined && v.length > decl.maxItems) return ['E-RANGE', `more than ${decl.maxItems} items`];
    if (decl.items) for (const x of v) { const r = checkValue(decl.items, x, depth + 1); if (r) return r; }
  }
  if (t === 'object' && decl.properties) {
    for (const k of Object.keys(v)) if (!own(decl.properties, k)) return ['E-TYPE', `unknown member ${k}`];
    // `required` lists the members a value must have (a richText run is {text, style?, optional?}, 5.3.1); without
    // it every member is required (5.1).
    const req = Array.isArray(decl.required) ? decl.required : Object.keys(decl.properties);
    for (const [k, d] of Object.entries(decl.properties)) {
      if (!own(v, k)) { if (req.includes(k)) return ['E-TYPE', `missing member ${k}`]; continue; }
      const r = checkValue(d, v[k], depth + 1); if (r) return r;
    }
  }
  return null;
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const LANG_KEY = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const isLanguageObject = (v) => isObj(v) && Object.keys(v).length > 0 && Object.keys(v).every(k => LANG_KEY.test(k) && !['short', 'medium', 'rich'].includes(k));

// A content field's value as one wording (5.3.1, 7.9): a tier object gives the tier's wording (else the nearest
// longer, else the nearest shorter); a language object gives the language's (else its base language, the
// experience's language, the first). Each wording may itself be the other kind of object.
export function wordingOf(v, { tier = 'short', language = 'en', defaultLanguage = 'en' } = {}) {
  for (let i = 0; i < 4 && isObj(v); i++) {
    if (isTierObject(v)) v = wordingAt(v, tier);
    else if (isLanguageObject(v)) v = v[language] ?? v[String(language).split('-')[0]] ?? v[defaultLanguage] ?? v[Object.keys(v)[0]];
    else break;
  }
  return v;
}
// What a field left out at the chosen tier reads (7.9): an empty string, false, an empty list; a number its initial.
function emptyOf(decl) {
  if (decl.type === 'array') return [];
  if (decl.type === 'boolean') return false;
  if (decl.type === 'number') return decl.initial ?? 0;
  if (decl.type === 'object') return decl.initial;
  return '';
}
// The checks of a content value as it is written (5.3.1): each wording of a tier or language object is checked
// as the field's type; a richText value's runs use only the field's `styles`, and no run holds markup. Returns
// [code, reason] or null.
// A content type a capability owns (richText: the rich-text capability) is checked and read by that capability, which
// registers {check(decl, v), read(v, at)} here when its module runs (CONTENT_TYPES). Without it the value is refused.
export const CONTENT_TYPES = {};
const ownedType = (decl) => (decl?.contentType === 'richText' ? CONTENT_TYPES.richText ?? { check: () => ['E-NEEDS-MISSING', 'a richText field needs the rich-text capability, which is not installed'], read: () => [] } : null);
// The text columns of the table that shapes a rows content field (2.8): {decl -> [column]}, marked by the engine when
// it loads the experience (markTextColumns). A cell of a text column may be a tier or language object, checked and
// read as a text field's value is.
const TEXT_COLUMNS = new WeakMap();
export function markTextColumns(decl, table) {
  const cols = Object.entries(table?.columns || {}).filter(([, c]) => c?.text === true).map(([k]) => k);
  if (cols.length && decl && typeof decl === 'object') TEXT_COLUMNS.set(decl, cols);
}
const textCells = (decl, rows, each) => rows.map(r => (isObj(r) ? Object.fromEntries(Object.entries(r).map(([k, x]) => [k, TEXT_COLUMNS.get(decl).includes(k) && isObj(x) ? each(k, x) : x])) : r));
export function checkContent(decl, v) {
  const own = ownedType(decl);
  if (own) return own.check(decl, v, checkValue);
  if (TEXT_COLUMNS.has(decl) && Array.isArray(v)) {
    let bad = null;
    const flat = textCells(decl, v, (k, x) => { bad ??= checkContent(decl.items?.properties?.[k] ?? { type: 'string' }, x); return wordingOf(x); });
    return bad ?? checkValue(decl, flat);
  }
  if (decl?.type === 'string' && isObj(v)) {
    const leaves = []; (function walk(x) { if (isObj(x)) Object.values(x).forEach(walk); else leaves.push(x); })(v);
    if (!(isTierObject(v) || isLanguageObject(v))) return ['E-TYPE', 'expected string, found object'];
    for (const w of leaves) { const bad = checkValue(decl, w); if (bad) return bad; }
    return null;
  }
  return checkValue(decl, v);
}

// A scope's view of its block's words (wordObject): a word reads as its text, rendered in the scope that reads it;
// the view cannot be changed. Its target holds the word ids, built once per map.
class WordView {
  constructor(engine, address, extra, scopeOf, map) { Object.assign(this, { engine, address, extra, scopeOf, map }); }
  get(t, k) { return typeof k === 'string' && own(this.map, k) ? this.engine.wordText(this.address, k, this.map[k], this.extra, this.scopeOf()) : Reflect.get(t, k); }
  getOwnPropertyDescriptor(t, k) { const d = Reflect.getOwnPropertyDescriptor(t, k); if (d) d.value = this.get(t, k); return d; }
  set() { return false; }
  defineProperty() { return false; }
  deleteProperty() { return false; }
}
export class Engine {
  // experience: the result of loadExperience(...).experience
  // opts.host: the host profile (A10.1), or null for a host without one. The package's raised limits must be allowed
  // by it (9.8.1, E-HOST-LIMIT); play then uses the package's values, never the host's.
  constructor(experience, opts = {}) {
    this.exp = experience;
    // A rows content field whose table has text columns (2.8): its cells there may be tier or language objects.
    for (const x of [experience, ...Object.values(experience.scenes || {}), experience.shell, ...Object.values(experience.blocks || {})]) {
      for (const d of Object.values(x?.doc?.inputs || {})) if (d?.kind === 'content' && typeof d.table === 'string') markTextColumns(d, x.doc.data?.[d.table] ?? experience.doc.data?.[d.table]);
    }
    this.opts = opts;
    const raised = experience.raised ?? raisedLimits([experience.doc]);
    const refused = refusedLimits(raised, opts.host ?? null);
    if (refused.length) throw new EngineFault('E-HOST-LIMIT', `the host does not allow the limits this experience raises: ${refusalMessage(refused)}`, 'experience');
    this.limits = experience.limits ?? activeLimits(raised);
    this.defs = Object.fromEntries(Object.entries(experience.blocks || {}).map(([k, b]) => [k, b]));
    this.listeners = [];
    this.capabilities = opts.capabilities || {};
    installLimits(this, EngineFault); // the limits of 9.8 and the host profile (A10.1): limits-runtime.mjs
    // The capabilities in needs that are registered (capabilities.mjs), or those of opts.modules. capabilities is
    // what the host plugs in (its AI port, its own action kinds); caps is the engine's own capability code.
    this.caps = installCapabilities(this, EngineFault, opts.modules ?? null);
    // Whose needs cover a use (10.11 rule 1): a component names its own, so it works in any experience (capabilities.mjs).
    const gap = needsGap(experience, (id) => this.caps.has(id));
    if (gap) throw new EngineFault('E-NEEDS-MISSING', `${gap.field} in ${gap.address} belongs to the capability ${gap.id}, which its needs do not name (10.11)`, gap.address);
    // A logic module that needs names with its version (name@version) but that no package or host carries is refused
    // at mount, not at its first call (10.7, E-MODULE-REVIEW).
    for (const n of packageNeeds(experience)) {
      if (typeof n !== 'string' || n.startsWith('font:') || n.indexOf('@') < 1) continue;
      const name = n.slice(0, n.indexOf('@'));
      if (!this.caps.has(name)) throw new EngineFault(name.includes('.') ? 'E-ADDON' : 'E-MODULE-REVIEW', name.includes('.') ? `needs names the add-on ${n}, but no package or host carries its code (a packed page carries it; a host in Node registers it with tools/addons.mjs loadAddons)` : `needs names the module ${n}, but no package or host carries it`, 'experience');
    }
    // The give-way ladder at play (8.4, D2) is the ladder capability's: a package that needs fit and has a fits, limit
    // or keep give-way rule needs ladder too (10.11).
    if (this.caps.has('fit') && !this.caps.has('ladder')) {
      const docs = [experience.doc, experience.shell?.doc, ...Object.values(experience.scenes || {}).map(s => s.doc), ...Object.values(experience.blocks || {}).map(b => b.doc)];
      if (giveWayRules(docs).some(r => ['fits', 'limit', 'keep'].includes(r.kind))) throw new EngineFault('E-NEEDS-MISSING', 'give-way rules while playing need the ladder capability, which is not installed', 'experience');
    }
    // Seats (A4.1): the seats capability's hook, if installed. It gets seatInput, the checked path for a seat's input.
    this.seatHook = this.caps.list.find(c => c.seatHook)?.seatHook ?? null;
    this.seatHook?.bind(Object.freeze({ input: (actor, name, payload) => this.seatInput(actor, name, payload) }));
    // Spoken lines (6.11): the lines capability's runner, or null; without it spoken stays idle and lines are refused.
    this.lines = this.caps.runner('lines', this, fault);
    this.resetEngine();
  }
  // A fresh run: empty state, stored values read again, the experience block mounted. Listeners stay (10.6 restart).
  resetEngine() {
    const ambient = this.state?.ambient;
    this.state = { now: 0, seq: 0, revision: 0, blocks: {}, timers: [], records: {}, outputs: [], deliveries: [], ambient: ambient ? { ...ambient } : { reducedMotion: false, timeLimits: 1, inputMode: 'pointer', language: this.exp.doc.language || 'en', muted: false, volume: 1, voice: false, canReturn: false, size: { shape: '', width: 0, height: 0 } }, story: null };
    this.queue = [];
    this.computing = new Set();
    this.cache = new WeakMap(); // computed results (5.2), per mounted block object: Map name -> {f, deps, v}
    this.counters = { events: 0, actions: 0 };
    this.source = null;
    // Stored values (5.1.2): opts.storage = {session, saved, page, partition, now} from the host, or none.
    this.stored = new Stored(this.exp.doc, this.opts.storage);
    this.dirty = 'all';
    this.mountRoot();
  }
  // ---------- what changed, for painting (9.2 step 9) ----------
  // After a commit: the blocks whose state the transaction changed (values, inputs, machines, clips, uses and the
  // rest of the block), their ancestors (a parent reads its uses' outputs) and the blocks under a changed experience
  // (its scenes and shell read it). A change outside the blocks (ambient, story, records, any other state) is 'all'.
  // engine.dirty gathers them until the page paints and takes them (takeDirty).
  changedBlocks(snap) {
    const s = this.state;
    for (const k of Object.keys(s)) if (!SKIP_TOP.has(k) && JSON.stringify(s[k]) !== JSON.stringify(snap.top[k])) return 'all';
    for (const [k, list, n] of snap.records) if (s.records[k] !== list || list.length !== n) return 'all';
    if (Object.keys(s.records).length !== snap.records.length) return 'all';
    const out = new Set();
    const rest = (b) => { const r = {}; for (const k of Object.keys(b)) if (k !== 'values' && k !== 'inputs') r[k] = b[k]; return JSON.stringify(r); };
    const differs = (x, y) => { const kx = Object.keys(x); if (kx.length !== Object.keys(y).length) return true; for (const k of kx) if (x[k] !== y[k] || !(k in y)) return true; return false; };
    for (const [a, b] of Object.entries(s.blocks)) {
      const o = snap.blocks[a];
      if (!o || differs(b.values, o.values) || differs(b.inputs, o.inputs) || rest(b) !== JSON.stringify(o.rest)) out.add(a);
    }
    for (const a of Object.keys(snap.blocks)) if (!s.blocks[a]) out.add(a);
    if (out.has('experience')) for (const [a, b] of Object.entries(s.blocks)) if (b.kind === 'scene' || b.kind === 'shell') out.add(a);
    for (const a of [...out]) for (let i = a.lastIndexOf('/'); i > 0; i = a.lastIndexOf('/', i - 1)) out.add(a.slice(0, i));
    return out;
  }
  noteChanged(changed) {
    if (this.dirty === 'all' || changed === 'all') { this.dirty = 'all'; return; }
    for (const a of changed) this.dirty.add(a);
    if (this.dirty.size > FORMAT.liveBlockUses) this.dirty = 'all';
  }
  // The blocks to paint again since the last call: a Set of addresses, or 'all'.
  takeDirty() { const d = this.dirty; this.dirty = new Set(); return d; }

  // ---------- blocks ----------
  mountRoot() {
    const d = this.exp.doc;
    // A content type or a field (an addons pocket) of a capability not installed (richText, addons.live-data).
    const owned = this.caps.missingContentType(d) ?? this.caps.missingField(d);
    if (owned) throw new EngineFault('E-NEEDS-MISSING', `${owned.field} needs the ${owned.id} capability, which is not installed`, 'experience');
    this.checkInitials(d, 'experience', true);
    const values = {};
    for (const [k, v] of Object.entries(d.values || {})) values[k] = this.stored.value('experience', k, v);
    const inputs = {};
    for (const [k, v] of Object.entries(d.inputs || {})) {
      if (v.kind === 'trigger') continue;
      inputs[k] = v.kind === 'knob' ? this.stored.knob(k, v) : this.caps.inputHook('initial', k, v, this.dataView()) ?? clone(v.initial);
    }
    this.state.blocks.experience = { kind: 'experience', values, inputs, machines: {}, uses: [], clips: {}, attach: {}, born: 0 };
  }
  // The experience's data tables (2.8) for a capability's input hooks, frozen once.
  dataView() { return (this.frozenData ??= Object.freeze(structuredClone(this.exp.data || {}))); }
    // Every value's initial, and with inputs every input's initial, must satisfy its type and bounds (5.1, 5.3).
  // A bad one faults at mount, as the checker refuses it on files. A text field's tier or language object (5.3.1)
  // is checked by the wording it gives.
  checkInitials(doc, address, inputs) {
    const lists = [['value', doc.values]];
    if (inputs) lists.push(['input', doc.inputs]);
    for (const [what, decls] of lists) for (const [k, decl] of Object.entries(decls || {})) {
      if (decl.kind === 'trigger' || decl.initial === undefined) continue;
      const bad = checkContent(decl, decl.initial);
      if (bad) fault(bad[0], `the initial of ${what} ${k}: ${bad[1]}`, address);
    }
  }
  def(address) {
    const b = this.state.blocks[address];
    if (!b) return null;
    if (b.kind === 'experience') return this.exp.doc;
    if (b.kind === 'scene') return this.exp.scenes[b.def].doc;
    if (b.kind === 'shell') return this.exp.shell?.doc;
    return this.defs[b.def]?.doc;
  }
  // The words a block reads (2.7): its owner's words over the experience's, in the active language, else the tag
  // without its last subtag, else the default language. One map per (block definition, language), built once and
  // built again only when the language or a words object changes; it is shared, so it is frozen.
  words(address) {
    const b = this.state.blocks[address];
    const lang = this.state.ambient.language;
    const own = b?.kind === 'scene' ? this.exp.scenes[b.def]?.words : b?.kind === 'shell' ? this.exp.shell?.words : b?.kind === 'component' ? this.defs[b.def]?.words : null;
    const expw = this.exp.words || {};
    const base = this.exp.doc.language || 'en';
    const key = b && b.kind !== 'experience' ? `${b.kind} ${b.def}` : '';
    const hit = (this.wordMaps ??= new Map()).get(key);
    if (hit && hit.lang === lang && hit.own === own && hit.expw === expw && hit.base === base) return hit.map;
    const pick = (w) => w?.[lang] || w?.[lang.split('-')[0]] || w?.[base] || {};
    const map = Object.freeze({ ...pick(expw), ...pick(own) });
    this.wordMaps.set(key, { lang, own, expw, base, map });
    (this.wordKeys ??= new WeakMap()).set(map, { ...map }); // a word view's target (wordObject)
    return map;
  }
  // Mounts a block (scene or component use) at address with input formulas evaluated in the parent's scope.
  mount(address, kind, defId, parent = null, inputs = {}) {
    const doc = kind === 'scene' ? this.exp.scenes[defId]?.doc : kind === 'shell' ? this.exp.shell?.doc : this.defs[defId]?.doc;
    if (!doc) fault('E-REF-UNKNOWN', `no ${kind} ${defId}`, address);
    this.checkInitials(doc, address, true);
    const values = {};
    for (const [k, v] of Object.entries(doc.values || {})) values[k] = this.stored.value(address, k, v);
    const ins = {};
    for (const [k, v] of Object.entries(doc.inputs || {})) if (v.kind !== 'trigger') ins[k] = own(inputs, k) ? inputs[k] : v.from !== undefined ? this.fed(v.from) : clone(v.initial);
    for (const [k, v] of Object.entries(ins)) {
      const decl = doc.inputs[k];
      if (v === undefined) fault('E-KEY-REQUIRED', `input ${k} has no initial and the use gives none`, address);
      const bad = checkContent(decl, v); if (bad) fault(bad[0], `input ${k}: ${bad[1]}`, address);
    }
    this.state.blocks[address] = { kind, def: defId, parent, values, inputs: ins, machines: {}, uses: [], clips: {}, attach: {}, born: this.state.now };
    if (kind === 'scene' && this.lines) this.lines.sceneMounted(address); // links on lines:ended wait for their line (3.4)
    const owned = this.caps.missingField(doc);
    if (owned) fault('E-NEEDS-MISSING', `${owned.field} needs the ${owned.id} capability, which is not installed`, address);
    this.caps.phase('mount', address, doc);
    // Uses first (they exist before the parent's entry runs), then entry, then machines (5.15.1).
    for (const u of doc.uses || []) this.mountUse(address, u);
    this.runActions(address, doc.entry, 'entry');
    for (const [mid, m] of Object.entries(doc.machines || {})) this.enterNode(address, mid, [], m);
    this.caps.phase('entered', address, doc);
    return address;
  }
  mountUse(parent, u) {
    // A use whose block is not defined stops play (9.2), as the checker refuses it on files (E-REF-UNKNOWN).
    // A use without `use` is a shell widget (declared or custom, 10.1): the shell's page part draws it.
    if (u.use === undefined) return;
    if (!this.defs[u.use]) fault('E-REF-UNKNOWN', `use ${u.id} names block ${u.use}, which is not defined`, parent);
    if (u.items) {
      const rows = this.listRows(parent, u);
      const entry = { id: u.id, keys: [] };
      this.state.blocks[parent].uses.push(entry);
      for (const r of rows) { this.useClock(this.mount(`${parent}/${u.id}[${r.key}]`, 'component', u.use, parent, this.useInputs(parent, u, r)), u, r); entry.keys.push(r.key); }
      return;
    }
    this.useClock(this.mount(`${parent}/${u.id}`, 'component', u.use, parent, this.useInputs(parent, u)), u);
    this.state.blocks[parent].uses.push({ id: u.id });
  }
  // The rows of a repeated use (4.5): [{item, index, key}] in list order. Duplicate keys fault (E-ID-DUPLICATE).
  listRows(parent, u) {
    const items = this.eval(parent, u.items);
    if (items !== undefined && items !== null && !Array.isArray(items)) fault('E-TYPE', `use ${u.id}: items is not an array`, parent);
    const seen = new Set();
    return (items || []).map((item, index) => {
      const key = String(this.evalWith(parent, u.key, { item, index }));
      if (seen.has(key)) fault('E-ID-DUPLICATE', `use ${u.id}: the key ${key} is given twice`, parent);
      seen.add(key);
      return { item, index, key };
    });
  }
  // A changed list (4.5): uses whose keys remain are kept (their with is read again, with their new item and index,
  // and their place follows the new order); new keys get new uses; gone keys leave after their exit lists. A key
  // removed and added again mounts afresh. state.lists counts the changes of key order, so a page draws again.
  followList(parent, u) {
    const entry = this.state.blocks[parent]?.uses.find(x => x.id === u.id && x.keys);
    if (!entry) return;
    const rows = this.listRows(parent, u);
    const next = rows.map(r => r.key);
    const before = entry.keys;
    if (next.length === before.length && next.every((k, i) => k === before[i])) return;
    // The new order is set first, so a new row's entry actions, which may refresh uses again, see the list done.
    entry.keys = next;
    this.state.lists = (this.state.lists || 0) + 1;
    const kept = new Set(next); const had = new Set(before);
    for (const k of [...before].reverse()) if (!kept.has(k)) this.leaveUse(`${parent}/${u.id}[${k}]`);
    for (const r of rows) if (!had.has(r.key)) this.mount(`${parent}/${u.id}[${r.key}]`, 'component', u.use, parent, this.useInputs(parent, u, r));
    // Each row's clock reads its item and index (3.10), a kept row's its new ones.
    for (const r of rows) this.useClock(`${parent}/${u.id}[${r.key}]`, u, r);
  }
  // A use that goes: its exit lists run (the story's leave), then it is unmounted.
  leaveUse(address) { if (this.leave) this.leave(address); else this.unmount(address); }
  // A kit scene's or shell's input fed by a one-name `with` (kit.mjs, `from`): the experience's value as it is (a tier or
  // language object stays whole, 7.9), else the name read in the experience's scope.
  fed(name) {
    const root = this.state.blocks.experience;
    if (root && own(root.inputs, name)) return clone(root.inputs[name]);
    if (root && own(root.values, name)) return clone(root.values[name]);
    return this.eval('experience', name);
  }
  // After an experience input or value changed: the inputs fed from it follow, and their blocks hear changed:<input>.
  feed(name) {
    for (const [addr, b] of Object.entries(this.state.blocks)) {
      if (b.kind !== 'scene' && b.kind !== 'shell') continue;
      for (const [k, d] of Object.entries(this.def(addr)?.inputs || {})) {
        if (d.from !== name) continue;
        const v = this.fed(name);
        if (deepEqual(v, b.inputs[k])) continue;
        const bad = checkContent(d, v); if (bad) fault(bad[0], `input ${k}: ${bad[1]}`, addr);
        b.inputs[k] = v;
        this.queue.push({ address: addr, name: `changed:${k}`, payload: {} });
      }
    }
  }
  useInputs(parent, u, row) {
    const out = {};
    for (const [k, f] of Object.entries(u.with || {})) {
      // A content field keeps its tier or language object; a read gives the wording (contentRead, 7.9).
      if (f !== null && typeof f === 'object') { out[k] = this.defs[u.use]?.doc?.inputs?.[k]?.kind === 'content' ? clone(f) : this.literalWith(f); continue; }
      // A one-name formula passes a content field through as it is (its tier object too), for a content input (7.9).
      // A text input reads plain words as text and {{ }} as a formula (D31.1).
      const decl = this.defs[u.use]?.doc?.inputs?.[k];
      const raw = !row && decl?.kind === 'content' ? this.rawInput(parent, slotFormula(decl, f)) : undefined;
      if (raw !== undefined) { out[k] = raw; continue; }
      out[k] = this.slot(parent, decl, f, row || undefined);
    }
    return out;
  }
  // What a formula, a visible binding or a template reads from a content field (5.3.1, 7.9): the wording of the
  // block's tier and the active language, and an empty value for a field left out at that tier. The drawing gives
  // the tier (this.tierAt, Drawing.tierOf); with no drawing it is short. Other inputs read as they are.
  contentRead(address, decl, v) {
    if (decl?.kind !== 'content') return v;
    const late = decl.required === false && decl.tier && decl.tier !== 'short';
    if (TEXT_COLUMNS.has(decl) && Array.isArray(v) && !late) {
      const at = { tier: this.tierAt?.(address) ?? 'short', language: this.state.ambient?.language || this.exp.doc.language || 'en', defaultLanguage: this.exp.doc.language || 'en' };
      return textCells(decl, v, (k, x) => wordingOf(x, at));
    }
    if (!late && !isObj(v)) return v;
    const tier = this.tierAt?.(address) ?? 'short';
    if (late && !fieldShown(decl, tier)) return emptyOf(decl);
    if (!isObj(v)) return v;
    const at = { tier, language: this.state.ambient?.language || this.exp.doc.language || 'en', defaultLanguage: this.exp.doc.language || 'en' };
    const own = ownedType(decl);
    if (own) return own.read(v, at);
    return decl.type === 'string' ? wordingOf(v, at) : v;
  }
  // A literal in a use's with (5.6.1): rows for a rows field pass as they are; a language object (5.3.1) gives the
  // wording of the active language, else the first; a tier object (7.9) gives the short wording, else the first.
  // Content tiers are not chosen by the engine yet, so a tier object always shows its smallest tier.
  literalWith(v) {
    if (Array.isArray(v)) return v;
    const lang = this.state.ambient?.language;
    const LANG = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
    const keys = Object.keys(v);
    if (keys.length && keys.every(k => LANG.test(k) && !['short', 'medium', 'rich'].includes(k))) {
      const w = v[lang] ?? v[lang?.split('-')[0]] ?? v[keys[0]];
      return w !== null && typeof w === 'object' ? this.literalWith(w) : w;
    }
    const w = v.short ?? v.medium ?? v.rich ?? v[keys[0]];
    return w !== null && typeof w === 'object' ? this.literalWith(w) : w;
  }
  // Removes a block and the uses under it, found through each block's uses (the only way a block mounts another),
  // so one unmount costs the blocks it removes, not every live block. Returns [address, block] of each removed one.
  unmount(address) {
    const all = this.state.blocks;
    const gone = [];
    const walk = (a) => {
      const b = all[a];
      if (!b) return;
      gone.push([a, b]);
      delete all[a];
      for (const u of b.uses || []) { if (u.keys) for (const k of u.keys) walk(`${a}/${u.id}[${k}]`); else walk(`${a}/${u.id}`); }
    };
    walk(address);
    if (this.state.timers.length) this.state.timers = this.state.timers.filter(t => !(t.owner === address || t.owner.startsWith(address + '/')));
    return gone;
  }

  // ---------- scope ----------
  // deps (a computed's evaluation only): each name the formula reads is noted there with a reader that reads it again
  // (track()), so the cached result can be checked against what it read (computed()).
  scope(address, extra = {}, deps = null) {
    const b = this.state.blocks[address];
    const doc = this.def(address);
    const exp = this.exp.doc;
    const ambient = this.state.ambient;
    const self = this;
    const shared = b.kind === 'scene' || b.kind === 'shell';
    const root = this.state.blocks.experience;
    // A built-in value (5.5, 5.9): what `hsvg.<name>` reads, and what a bare name reads when the author declares
    // no name of its own (D22: an author's name hides a built-in in its scope).
    let wobj = null; let sc = null;
    const builtin = (n) => {
      if (n === 'event' && own(extra, 'event')) return extra.event;
      if (n === 'data') return self.exp.data;
      if (n === 'words') return (wobj ??= self.wordObject(address, extra, () => sc)); // one per scope; its words render in it
      if (n === 'uses') return self.useOutputs(address);
      if (n === 'elapsed' && self.heldElapsed !== undefined) return self.heldElapsed; // a channel binding held still under reduced motion (drawing.mjs, 10.13)
      if (n === 'elapsed' || n === 'now') self.timeRead = true; // the page paints again while a binding reads time
      if (n === 'elapsed') return self.state.now - b.born;
      if (n === 'now') return self.nowValue();
      if (n === 'visits') return self.state.story?.visits || {};
      if (n === 'canReturn') return !!self.state.story?.stack?.length;
      if (n === 'chapter') return self.chapterNow();
      if (n === 'spoken') return self.lines ? self.lines.spoken(address) : { line: '', text: '', word: -1 }; // the line this block is saying (5.5, 6.11)
      if (n === 'layout') return ambient.layout ?? {}; // per block on screen: {frame, tier, steps}; the player writes it (7.1)
      if (AMBIENT.includes(n) && own(ambient, n)) return ambient[n];
      throw new FormulaError('E-FORMULA', `unknown name ${n} in ${address}`);
    };
    sc = {
      get words() { if (deps) self.track(deps, address, 'words', true); return self.words(address); },
      get language() { if (deps) self.track(deps, address, 'language', true); return ambient.language; }, // plural chooses its form in the active language (2.7)
      name(n) {
        if (deps && !own(extra, n)) { const v = sc.find(n); self.track(deps, address, n, false, v); return v; }
        return sc.find(n);
      },
      find(n) {
        if (own(extra, n)) return extra[n];
        if (own(b.inputs, n)) return self.contentRead(address, doc.inputs?.[n], b.inputs[n]);
        if (own(b.values, n)) return b.values[n];
        if (own(doc.computed, n)) return self.computed(address, n);
        if (shared || b.kind === 'experience') {
          if (own(root.inputs, n)) return self.contentRead(address, exp.inputs?.[n], root.inputs[n]);
          if (own(root.values, n)) return root.values[n];
          if (own(exp.computed, n)) return self.computed('experience', n);
        }
        return builtin(n);
      },
      builtin: deps ? (n) => { self.track(deps, address, n, true); return builtin(n); } : builtin,
      // Is n a name this block declares (an input, value or computed, its own or the shared experience's)?
      // A role-prefixed field such as action.text is read as one name (5.3.1).
      has(n) {
        if (own(extra, n) || own(b.inputs, n) || own(b.values, n) || own(doc.computed, n)) return true;
        return (shared || b.kind === 'experience') && (own(root.inputs, n) || own(root.values, n) || own(exp.computed, n));
      },
      active(id) { if (deps) self.depend(deps, `active#${id}`, () => self.isActive(address, id)); return self.isActive(address, id); },
      template(w, id) { return self.wordText(address, id, w, extra, sc); },
    };
    return sc;
  }
  // The `words` value of a scope: each word reads as its text rendered in that same scope (scopeOf()). The keys are
  // built once per (block definition, language) with the map (words()); a scope adds only a small view over them, so
  // a formula that reads one word renders one word, and one that reads none does no word work.
  wordObject(address, extra, scopeOf) {
    const map = this.words(address);
    return new Proxy(this.wordKeys.get(map), new WordView(this, address, extra, scopeOf, map));
  }
  // A word's text (2.7), rendered in the block's scope on the caller's budget (this.meter() charges the phase), never
  // on a fresh one. A word that reads itself, directly or through other words, is E-CYCLE, as a computed is (5.2).
  wordText(address, id, text, extra, scope) {
    if (!text.includes('{{')) return text;
    const key = `${address}#${id}`;
    const reading = (this.wordsReading ??= new Set());
    if (id !== undefined && reading.has(key)) fault('E-CYCLE', `word ${id} reads itself`, address);
    if (id !== undefined) reading.add(key);
    try { return renderTemplate(text, scope || this.scope(address, extra), this.meter()); } finally { if (id !== undefined) reading.delete(key); }
  }
  useOutputs(address) {
    const b = this.state.blocks[address];
    const out = {};
    for (const u of b.uses) {
      const one = (addr) => { const d = this.def(addr); const r = {}; for (const [k, o] of Object.entries(d?.outputs || {})) if (o.kind === 'result') Object.defineProperty(r, k, { enumerable: true, get: () => this.eval(addr, o.value) }); return r; };
      if (u.keys) { out[u.id] = {}; for (const k of u.keys) out[u.id][k] = one(`${address}/${u.id}[${k}]`); } else out[u.id] = one(`${address}/${u.id}`);
    }
    return out;
  }
  // The chapter ambient input (3.12, 5.5); the story (story.mjs) gives it. With no chapter on the stage it is
  // {id: '', index: 0, count: 0}.
  chapterNow() { return { id: '', index: 0, count: 0 }; }
  // A computed value (5.2), cached: its result is kept with each name it read and that name's value then, and is used
  // again while every one of them reads the same (Object.is), so no stale result is ever read, whatever changed the
  // state (a write, a rollback, the language, visits, the host). A block mounted again is a new object: a fresh cache.
  // A computed that reads a name that changes with no write (now, elapsed, uses, spoken, chapter) is not cached. A
  // cached read costs no formula steps; checking it reads names only, and evaluates again a computed it reads that
  // is not cached or no longer fresh (on the caller's budget, as before).
  computed(address, n) {
    const key = `${address}#${n}`;
    if (this.computing.has(key)) fault('E-CYCLE', `computed ${n} reads itself`, address);
    const b = this.state.blocks[address];
    const f = this.def(address).computed[n];
    let mine = this.cache.get(b);
    const hit = mine?.get(n);
    if (hit && hit.f === f && this.fresh(hit.deps)) return hit.v;
    this.computing.add(key);
    try {
      const deps = { seen: new Set(), list: [], live: false };
      const v = this.eval(address, f, undefined, deps);
      mine = this.cache.get(b); // the evaluation may have cached the computeds it read
      if (deps.live || !b) mine?.delete(n);
      else { if (!mine) this.cache.set(b, (mine = new Map())); mine.set(n, { f, deps: deps.list, v }); }
      return v;
    } finally { this.computing.delete(key); }
  }
  // Whether every name a cached result read still reads the same. list: reader, value, reader, value, ...
  fresh(list) {
    for (let i = 0; i < list.length; i += 2) if (!Object.is(list[i](), list[i + 1])) return false;
    return true;
  }
  // Notes, once per evaluation, the reader of a name a computed reads, with its value now.
  depend(deps, id, read, ...was) {
    if (deps.live || deps.seen.has(id)) return;
    deps.seen.add(id);
    deps.list.push(read, was.length ? was[0] : read());
  }
  // The reader of name n as the scope of address resolves it (scope().name, or the built-in when only is true). It
  // looks the block up again at each read. Built-ins that change with no write make the computed live (not cached).
  // v: the value name() returned, kept for a computed (reading it again would evaluate it twice).
  track(deps, address, n, only, v) {
    if (deps.live) return;
    const b = this.state.blocks[address];
    const doc = this.def(address);
    const blocks = () => this.state.blocks;
    if (!only) {
      const shared = b.kind === 'scene' || b.kind === 'shell' || b.kind === 'experience';
      const root = blocks().experience;
      const input = (at, decl) => {
        this.depend(deps, `i#${at}#${n}`, () => blocks()[at].inputs[n]);
        if (decl?.kind === 'content') { this.depend(deps, 'language', () => this.state.ambient.language); this.depend(deps, `tier#${address}`, () => this.tierAt?.(address)); }
      };
      if (own(b.inputs, n)) return input(address, doc.inputs?.[n]);
      if (own(b.values, n)) return this.depend(deps, `v#${address}#${n}`, () => blocks()[address].values[n]);
      if (own(doc.computed, n)) return this.depend(deps, `c#${address}#${n}`, () => this.computed(address, n), v);
      if (shared && own(root.inputs, n)) return input('experience', this.exp.doc.inputs?.[n]);
      if (shared && own(root.values, n)) return this.depend(deps, `v#experience#${n}`, () => blocks().experience.values[n]);
      if (shared && own(this.exp.doc.computed, n)) return this.depend(deps, `c#experience#${n}`, () => this.computed('experience', n), v);
    }
    switch (n) {
      case 'data': return this.depend(deps, 'data', () => this.exp.data);
      case 'words': return this.depend(deps, `words#${address}`, () => this.words(address)); // its texts render in the reading scope, so what they read is noted too
      case 'visits': return this.depend(deps, 'visits', () => JSON.stringify(this.state.story?.visits || {})); // counted in place
      case 'canReturn': return this.depend(deps, 'canReturn', () => !!this.state.story?.stack?.length);
      case 'hooks': return this.depend(deps, 'hooks', () => JSON.stringify(this.state.ambient.hooks ?? null));
      case 'now': case 'elapsed': case 'uses': case 'spoken': case 'chapter': case 'event': deps.live = true; deps.list.length = 0; return;
      default: return this.depend(deps, `a#${n}`, () => this.state.ambient[n]); // ambient inputs are replaced, never changed in place
    }
  }
  // The work meter of one evaluation: formulaSteps work steps (5.6.6), and every step also counts against the budget
  // of the phase (9.2, 9.8), checked at each charge, so a phase stops at its limit and not only between events. The
  // formula code counts with meter.charge(n), which returns the steps; the meter reads as full when the phase has no steps left.
  // A computed's formula is charged when it is evaluated (its first read, or a read after a name it read changed), on
  // the reader's phase budget; a cached read is the reader's one name step (computed()).
  meter() {
    const phase = this.budget;
    if (!phase) return { steps: 0 };
    let own = 0;
    return {
      get steps() { return Math.max(own, FORMAT.formulaSteps - (FORMAT.formulaStepsPerTransaction - phase.steps)); },
      charge(n) { own += n; phase.steps += n; return Math.max(own, FORMAT.formulaSteps - (FORMAT.formulaStepsPerTransaction - phase.steps)); }, // the steps now
    };
  }
  // openUrl needs its grant at each use (10.5): refused and optional, the action does nothing and is reported; refused
  // otherwise (no host profile gives no grant), the use fails with E-GRANT and reaches no host.
  // openUrl without its grant (10.5): the link does nothing, reaches no host, and is reported. A grant the host refuses
  // is optional here: with no host profile every asked kind counts as optional, and a host that refuses a grant that
  // is not optional refuses the mount first, so play never reaches a refused, required openUrl.
  urlGranted(address) {
    if (this.grants?.openUrl === true) return true;
    this.note('grant', address, 'openUrl is not granted: the link does nothing');
    return false;
  }
  // A formula fault from evaluation; a phase over its step budget is E-EVENT-LOOP (9.2).
  formulaFault(e, text, address) {
    if (!(e instanceof FormulaError)) return overflowFault(e, address);
    if (this.budget && this.budget.steps > FORMAT.formulaStepsPerTransaction) return new EngineFault('E-EVENT-LOOP', `more than ${FORMAT.formulaStepsPerTransaction} formula steps in one ${this.budget.phase || 'transaction'} [${text.slice(0, 120)}]`, address);
    return new EngineFault(e.code, `${e.message} [${text.slice(0, 120)}]`, address);
  }
  // An evaluation outside a transaction and the binding phase (host.read of a result output, the frame link's read,
  // the page door's eval, read and template): one budget for the whole call, the same limit as a transaction (9.2),
  // so nested computeds, outputs and words share it and a chain of them faults instead of blocking the thread.
  outside(fn) {
    if (this.budget) return fn();
    this.budget = { steps: 0, phase: 'evaluation' };
    try { return fn(); } finally { this.budget = null; }
  }
  eval(address, f, extra, deps) {
    if (typeof f !== 'string') return f;
    if (!this.budget) return this.outside(() => this.eval(address, f, extra, deps));
    try { return evaluate(parse(f), this.scope(address, extra, deps), this.meter()); } catch (e) { throw this.formulaFault(e, f, address); }
  }
  evalWith(address, f, extra) { return this.eval(address, f, extra); }
  // A slot's value: every value slot holds a formula, text in single quotes (D36), whatever its declaration.
  slot(address, decl, f, extra) { return this.eval(address, f, extra); }
  template(address, t, extra) {
    if (!this.budget) return this.outside(() => this.template(address, t, extra));
    try { return renderTemplate(t, this.scope(address, extra), this.meter()); } catch (e) { throw this.formulaFault(e, t, address); }
  }
  // The binding phase (9.2 step 6, 9.8): fn (a repaint) runs with its own budget of formula steps.
  bindingPhase(fn) {
    const outer = this.budget;
    if (outer) return fn();
    this.budget = { steps: 0, phase: 'binding phase' };
    try { return fn(); } finally { this.budget = outer; }
  }

  // ---------- writes ----------
  // Finds where a body value lives: the block itself, or the experience for a scene or shell (5.1.3).
  owner(address, name) {
    const b = this.state.blocks[address];
    if (own(b.values, name)) return address;
    if ((b.kind === 'scene' || b.kind === 'shell') && own(this.state.blocks.experience.values, name)) return 'experience';
    return null;
  }
  write(address, name, v, how = 'set') {
    const at = this.owner(address, name);
    if (!at) {
      const b = this.state.blocks[address];
      if (own(b.inputs, name) || own(this.state.blocks.experience.inputs, name)) fault('E-WRITE-INPUT', `${name} is an input; ${how} writes body values only`, address);
      fault('E-REF-UNKNOWN', `no value ${name}`, address);
    }
    const decl = (this.def(at).values || {})[name];
    const bad = checkValue(decl, v);
    if (bad) fault(bad[0], `${how} ${name}: ${bad[1]}`, address);
    const store = this.state.blocks[at].values;
    if (!this.written.has(`${at}#${name}`)) this.written.set(`${at}#${name}`, { at, name, before: clone(store[name]) });
    store[name] = onBound(decl, v);
  }
  read(address, name) { return this.scope(address).name(name); }

  // ---------- machines (5.14) ----------
  nodeAt(address, mid, path) {
    let n = this.def(address).machines[mid];
    for (const s of path) n = n.states[s];
    return n;
  }
  isActive(address, id) {
    const b = this.state.blocks[address];
    return Object.values(b.machines).some(path => path.includes(id)) || own(b.machines, id);
  }
  enterNode(address, mid, path, node) {
    const b = this.state.blocks[address];
    b.machines[mid] = [...path];
    this.moved(address);
    this.runActions(address, node.entry, `machine ${mid} entry`);
    (node.after || []).forEach((t, i) => {
      const delay = this.eval(address, t.delayMs);
      if (typeof delay !== 'number' || delay < 1 || delay > 3600000) fault('E-RANGE', `delayMs ${delay} is outside 1..3600000`, address);
      this.state.timers.push({ ...this.personTimer(delay), seq: this.state.seq++, owner: address, mid, path: [...path], index: i });
    });
    if (node.states) {
      if (!node.initial || !node.states[node.initial]) fault('E-MACHINE-INITIAL', `${mid}/${path.join('/')} has no valid initial`, address);
      this.enterNode(address, mid, [...path, node.initial], node.states[node.initial]);
    }
  }
  exitTo(address, mid, keep) {
    // Exit from the active leaf up to, not including, depth `keep`.
    const b = this.state.blocks[address];
    const path = b.machines[mid];
    for (let d = path.length; d > keep; d--) {
      const p = path.slice(0, d);
      this.state.timers = this.state.timers.filter(t => !(t.owner === address && t.mid === mid && t.path.length === p.length && t.path.every((x, i) => x === p[i])));
      this.runActions(address, this.nodeAt(address, mid, p).exit, `machine ${mid} exit`);
    }
    if (path.length > keep) this.moved(address);
    b.machines[mid] = path.slice(0, keep);
  }
  // A machine's state changed in this block. A use's with may read active(...) (5.3): the block's uses are
  // evaluated again before the next event, as after a value write (refreshMoved, from drain).
  moved(address) { (this.movedBlocks ??= new Set()).add(address); }
  refreshMoved() {
    if (!this.movedBlocks?.size) return;
    const parents = this.movedBlocks;
    this.movedBlocks = null;
    this.refreshUses(parents);
  }
  findPath(node, id, path = []) {
    if (!node.states) return null;
    for (const [k, s] of Object.entries(node.states)) {
      if (k === id) return [...path, k];
      const r = this.findPath(s, id, [...path, k]);
      if (r) return r;
    }
    return null;
  }
  transition(address, mid, fromPath, t) {
    const machine = this.def(address).machines[mid];
    if (t.target === undefined) { this.runActions(address, t.actions, `transition ${t.id}`); return; }
    const to = this.findPath(machine, t.target);
    if (!to) fault('E-MACHINE-TARGET', `${t.target} is not a state of ${mid}`, address);
    // least common proper ancestor of the holding state and the target
    let k = 0;
    while (k < fromPath.length && k < to.length && fromPath[k] === to[k]) k++;
    const lca = Math.max(0, Math.min(k, fromPath.length - 1, to.length - 1));
    this.exitTo(address, mid, lca);
    this.runActions(address, t.actions, `transition ${t.id}`);
    // enter toward the target, parent first, then its initial children
    for (let d = lca + 1; d <= to.length; d++) {
      const p = to.slice(0, d);
      const node = this.nodeAt(address, mid, p);
      const b = this.state.blocks[address];
      b.machines[mid] = p;
      this.moved(address);
      if (d < to.length) {
        this.runActions(address, node.entry, `machine ${mid} entry`);
        (node.after || []).forEach((tt, i) => { const delay = this.eval(address, tt.delayMs); this.state.timers.push({ ...this.personTimer(delay), seq: this.state.seq++, owner: address, mid, path: p, index: i }); });
      } else this.enterNode(address, mid, p, node);
    }
  }

  // ---------- events and reactions ----------
  emit(address, name, payload = {}) { this.queue.push({ address, name, payload }); }
  // D22 for change events (5.9, 5.12; Y1): whether a block's scope declares the name n itself (as name() reads it),
  // so its bare changed:<n> means its own value, never the built-in of that name.
  declares(address, n) {
    const b = this.state.blocks[address]; const doc = this.def(address);
    if (own(b?.inputs, n) || own(b?.values, n) || own(doc?.computed, n)) return true;
    if (b?.kind !== 'scene' && b?.kind !== 'shell') return false;
    const root = this.state.blocks.experience;
    return own(root?.inputs, n) || own(root?.values, n) || own(this.exp.doc.computed, n);
  }
  // The on key a built-in change of n reaches in a block: changed:hsvg.<n> always; the bare changed:<n> only when
  // the block declares no n of its own. on: a map of reactions. Returns the key, or null.
  builtinKey(address, on, n) {
    if (on?.[`changed:hsvg.${n}`]) return `changed:hsvg.${n}`;
    return on?.[`changed:${n}`] && !this.declares(address, n) ? `changed:${n}` : null;
  }
  deliver(ev) {
    const { address, payload } = ev;
    const doc = this.def(address);
    const b = this.state.blocks[address];
    if (!doc || !b) return; // the owner is gone (a link ended it)
    // A built-in value's change (ev.builtin) is heard as changed:hsvg.<n>, or as a bare changed:<n> that no author's
    // name hides; an author's own change only as changed:<n>.
    const n = ev.builtin && ev.name.startsWith('changed:') ? ev.name.slice(8) : null;
    const keyIn = (on) => (n === null ? ev.name : this.builtinKey(address, on, n));
    const name = ev.name;
    const extra = { event: payload };
    const passes = (r) => r.guard === undefined || this.eval(address, r.guard, extra) === true;
    for (const [mid, machine] of Object.entries(doc.machines || {})) {
      const path = b.machines[mid];
      if (!path) continue;
      for (let d = path.length; d >= 0; d--) {
        const node = this.nodeAt(address, mid, path.slice(0, d));
        const list = node.on?.[keyIn(node.on)];
        const r = list?.find(passes);
        if (r) { this.withEvent(extra, () => this.transition(address, mid, path.slice(0, d), r)); break; }
      }
    }
    const list = doc.on?.[keyIn(doc.on)];
    const r = list?.find(passes);
    if (r) this.withEvent(extra, () => this.runActions(address, r.actions, `reaction ${entryKey(doc, r)}`));
    // A declared output event goes on to the parent, or to the story graph for a scene (5.12, 3.3). A scene's event that
    // a story link hears needs no outputs entry (D31.4): it is a payload-free output event.
    const out = doc.outputs?.[name];
    const heard = !out && (b.kind === 'scene' || b.kind === 'shell') && !name.includes(':') && this.linkHears?.(address, name);
    if ((out?.kind === 'event' || heard) && !ev.forwarded) {
      if (b.kind === 'component' && b.parent) {
        const m = /\/([^/[]+)(\[([^\]]*)\])?$/.exec(address);
        this.queue.push({ address: b.parent, name: `${m[1]}.${name}`, payload: m[3] !== undefined ? { ...payload, itemKey: m[3] } : payload });
      } else if (b.kind === 'scene' || b.kind === 'shell') this.onOutcome?.(address, name, payload);
      else if (b.kind === 'experience') this.state.outputs.push({ name, ...payload });
    } else if (!out && (b.kind === 'scene' || b.kind === 'shell') && !ev.forwarded && this.caps.has(name.slice(0, Math.max(0, name.indexOf(':'))))) {
      // An installed add-on's event at a scene (<addon>:<event>[:<subject>]) reaches the story graph too (D31.5).
      this.onOutcome?.(address, name, payload);
    }
    // A scene's or the shell's event that the experience declares as an output event also reaches the host, whether
    // the block declares it or not, as a record's row does (5.12, 5.16): an asset's events (D45).
    if ((b.kind === 'scene' || b.kind === 'shell') && !ev.forwarded && !name.includes(':') && this.exp.doc.outputs?.[name]?.kind === 'event') {
      const p = this.exp.doc.outputs[name].payload;
      const bad = p ? checkValue(p, payload) : Object.keys(payload).length ? ['E-TYPE', 'it takes no payload'] : null;
      if (bad) fault(bad[0], `output ${name}: ${bad[1]}`, address);
      this.state.outputs.push({ name, ...payload });
    }
  }
  withEvent(extra, fn) { const prev = this.eventExtra; this.eventExtra = extra; try { fn(); } finally { this.eventExtra = prev; } }

  // ---------- actions (5.15) ----------
  runActions(address, list, where) {
    if (!list || !list.length) return;
    const outer = this.written;
    const mine = !outer;
    if (mine) this.written = new Map();
    for (const a of list) this.action(address, a, where);
    if (mine) {
      const changed = [...this.written.values()].filter(w => !deepEqual(w.before, this.state.blocks[w.at]?.values[w.name]));
      this.written = null;
      for (const w of changed) {
        // An experience value's change is heard by the scenes (and the shell) that share it.
        const hearers = w.at === 'experience' ? Object.keys(this.state.blocks).filter(k => ['scene', 'shell'].includes(this.state.blocks[k].kind)) : [w.at];
        this.fanOut(hearers, `changed:${w.name}`);
        if (w.at === 'experience') this.feed(w.name);
      }
      if (changed.length) this.refreshUses();
    }
  }
  // Every use's with is evaluated again; a changed input is written and heard as changed:<input>. parents (a Set of
  // block addresses) limits it to the uses of those blocks.
  refreshUses(parents = null) {
    // Repeated uses follow their lists first (4.5).
    for (const addr of Object.keys(this.state.blocks)) {
      if (parents && !parents.has(addr)) continue;
      const b = this.state.blocks[addr];
      if (!b) continue;
      for (const u of this.def(addr)?.uses || []) if (u.items && u.use !== undefined) this.followList(addr, u);
    }
    const lists = new Map();
    const fans = new Map(); // one fan-out per input name: the changed: events of one refresh count as one (9.2)
    for (const [addr, b] of Object.entries(this.state.blocks)) {
      if (b.kind !== 'component' || !b.parent || !this.state.blocks[b.parent]) continue;
      if (parents && !parents.has(b.parent)) continue;
      const pdoc = this.def(b.parent);
      const m = /\/([^/[]+)(\[([^\]]*)\])?$/.exec(addr);
      const u = (pdoc.uses || []).find(x => x.id === m[1]);
      if (!u) continue;
      let row;
      if (u.items) {
        // A kept row reads its with again with its item and index in the list as it is now.
        const at = `${b.parent}#${u.id}`;
        if (!lists.has(at)) lists.set(at, new Map(this.listRows(b.parent, u).map(r => [r.key, r])));
        row = lists.get(at).get(m[3]);
        if (!row) continue;
      }
      const next = this.useInputs(b.parent, u, row);
      const doc = this.def(addr);
      const changed = [];
      for (const [k, v] of Object.entries(next)) {
        if (!(k in (doc.inputs || {}))) continue;
        if (!deepEqual(v, b.inputs[k])) {
          const bad = checkContent(doc.inputs[k], v); if (bad) fault(bad[0], `input ${k}: ${bad[1]}`, addr);
          b.inputs[k] = v; changed.push(k);
        }
      }
      for (const k of changed) {
        if (!fans.has(k)) fans.set(k, {});
        this.queue.push({ address: addr, name: `changed:${k}`, payload: {}, fan: fans.get(k) });
      }
    }
  }
  action(address, a, where) {
    if (++this.counters.actions > FORMAT.actionsPerTransaction) fault('E-EVENT-LOOP', `more than ${FORMAT.actionsPerTransaction} actions in one transaction`, address);
    const extra = this.eventExtra;
    const E = (f) => this.eval(address, f, extra);
    // The engine's own writes (a control's value, a capability's write) carry the value itself, never a formula.
    if ('set' in a) { const at = this.owner(address, a.set); return this.write(address, a.set, 'value' in a ? a.value : this.slot(address, at && this.def(at).values?.[a.set], a.to, extra), 'set'); }
    if ('if' in a) { const c = E(a.if); if (typeof c !== 'boolean') fault('E-TYPE', 'if needs a boolean', address); return this.runActions(address, c ? a.then : a.else, where); }
    // emit sends an event up and out; as a trigger it fires a child's trigger input, as a record it adds a row (D33).
    if ('emit' in a) {
      const p = {}; for (const [k, f] of Object.entries(a.with || {})) p[k] = E(f);
      if (a.as === 'trigger') {
        const [use, trig] = a.emit.split('.');
        // A repeated use (4.5): the trigger fires every row, or the one row itemKey names.
        const u = (this.state.blocks[address]?.uses || []).find(x => x.id === use);
        if (!u?.keys) return this.emit(`${address}/${use}`, trig, p);
        const key = a.itemKey !== undefined ? String(E(a.itemKey)) : null;
        for (const k of u.keys) if (key === null || String(k) === key) this.emit(`${address}/${use}[${k}]`, trig, { ...p });
        return;
      }
      if (a.as === 'record') return this.addRow(address, a.emit, p);
      return this.emit(address, a.emit, p);
    }
    // play starts a clip, or as a sound plays a sound (its name a formula) at its volume (D33).
    if ('play' in a && a.as === 'sound') {
      const name = E(a.play); const group = a.group || 'sounds'; const gain = a.volume ?? 1;
      const source = typeof name === 'string' ? this.soundSource(address, name) : null;
      if (!source) fault('E-REF-UNKNOWN', `sound ${JSON.stringify(name)} is no sound resource or made sound (audioSynths) in scope`, address);
      if (!['sounds', 'voice'].includes(group)) fault('E-RANGE', `sound group ${group} is not sounds or voice`, address);
      if (typeof gain !== 'number' || gain < 0 || gain > 1) fault('E-RANGE', `sound volume ${gain} is outside 0..1`, address);
      this.state.deliveries.push({ kind: 'sound', address, sound: name, group, gain, source });
      return;
    }
    if ('play' in a) return this.caps.play(address, a.play) ? undefined : this.playClip(address, a.play);
    if ('stop' in a) return this.caps.stop(address, a.stop, true) ? undefined : a.keep === true ? this.keepClip(address, a.stop) : this.stopClip(address, a.stop, true);
    if ('open' in a || 'close' in a) { this.dialog(a.open ?? a.close, 'open' in a, address); return; }
    if (typeof a.call === 'string' && a.call.startsWith('player.')) return this.playerCall(address, a, E, extra);
    if (this.caps.action(address, a, E, (decl, f) => this.slot(address, decl, f, extra))) return; // the engine's capabilities (capabilities.mjs)
    if ('call' in a) {
      // A bare <name>.<verb> of a registered capability (not a module) is a built-in's call (D28), not installed here.
      const mod = String(a.call).slice(0, Math.max(0, String(a.call).lastIndexOf('.')));
      const rec = mod && !mod.includes('.') ? registered().get(mod) : null;
      const named = capabilityNames(packageNeeds(this.exp)).includes(mod);
      if (rec && !rec.module) fault('E-NEEDS-MISSING', `call ${a.call} needs the ${mod} capability, which ${named ? 'is not installed' : 'its needs do not name'}`, address);
      fault('E-MODULE-CALL', `call ${a.call}: no module is installed in this engine`, address);
    }
    // Capability actions (10.7): handed to the capability, or refused.
    // A host's plug-in gets a door, and only when needs names it (capabilities.mjs).
    for (const [cap, impl] of Object.entries(this.capabilities)) {
      if (!Array.isArray(impl?.actions) || !impl.actions.some(n => n in a)) continue;
      const door = this.caps.plugin(cap);
      if (!door) break;
      impl.run?.(door, address, structuredClone(a)); this.state.deliveries.push({ kind: 'capability', capability: cap, address, action: a }); return;
    }
    fault('E-NEEDS-MISSING', `action ${Object.keys(a).filter(k => k !== 'id').join('+')} needs a capability this engine does not run`, address);
  }
  // emit as a record (5.16): a row, added to the block's own record, or to the experience's for a scene or the shell.
  addRow(address, name, row) {
    // A scene or the shell adds rows to the experience's own record, as it writes the experience's values (5.16,
    // 5.1.3), unless it declares a record of that name itself. The host hears each row (10.6).
    const kind = this.state.blocks[address]?.kind;
    const own = this.def(address)?.outputs?.[name]?.kind === 'record';
    const toExp = this.exp.doc.outputs?.[name]?.kind === 'record' && (address === 'experience' || ((kind === 'scene' || kind === 'shell') && !own));
    const at = toExp ? 'experience' : address;
    if (toExp) this.checkRecordRow(name, row, address);
    (this.state.records[`${at}#${name}`] ??= []).push(row);
    this.state.deliveries.push({ kind: 'record', address, record: name, row });
    if (toExp) this.state.outputs.push({ name, row, atMs: this.state.now, seat: this.actor?.seat ?? null, filler: this.actor?.filler ?? (this.source === 'person' ? 'human' : 'program') });
  }
  // The player's own calls (D33): player.openUrl, player.setting, player.resetSaved and player.attach. Each `with`
  // entry is a formula. The engine's own writes of a setting carry the value itself (a.value), never a formula.
  playerCall(address, a, E, extra) {
    const w = a.with || {};
    if (a.call === 'player.openUrl') {
      this.humanOnly(address, 'openUrl');
      if (!this.urlGranted(address)) return;
      const field = E(w.field);
      // The other with entries go onto the click address (10.4): each value a finite number or a stable id, never
      // words or content text. Any other value is left out, and the output names it in `refused`.
      const out = {}; const refused = [];
      for (const [k, f] of Object.entries(w)) { if (k === 'field') continue; const v = E(f); if ((typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && URL_PARAM_ID.test(v))) out[k] = v; else refused.push(k); }
      this.state.outputs.push({ name: 'openUrl', field, with: out, ...(refused.length ? { refused } : {}) });
      return;
    }
    if (a.call === 'player.resetSaved') { this.resetSaved(E(w.settings ?? false) === true); return; }
    if (a.call === 'player.attach') {
      const part = E(w.part); const to = E(w.to ?? null);
      if (to === null) delete this.state.blocks[address].attach[part]; else this.state.blocks[address].attach[part] = to;
      return;
    }
    if (a.call === 'player.setting') {
      const name = Object.keys(w)[0];
      const v = 'value' in a ? a.value : this.slot(address, own(AMBIENT_SETTINGS, name) ? AMBIENT_SETTINGS[name] : this.exp.doc.inputs?.[name], w[name], extra);
      this.humanOnly(address, 'setting', name === 'voice' && v === false);
      if (own(AMBIENT_SETTINGS, name)) {
        // Checked like any value (principle 4, 9.10): type and bounds, never clamped.
        const bad = checkSetting(name, v); if (bad) fault(bad[0], `setting ${name}: ${bad[1]}`, address);
        this.setAmbient(name, v);
        return;
      }
      const decl = this.exp.doc.inputs?.[name];
      if (!decl || decl.kind !== 'knob') fault('E-SETTING', `${name} is not a knob of the experience`, address);
      const bad = checkValue(decl, v); if (bad) fault(bad[0], `setting ${name}: ${bad[1]}`, address);
      this.writeInput(name, onBound(decl, v));
      return;
    }
    fault('E-REF-UNKNOWN', `${a.call}: the player's calls are player.openUrl, player.setting, player.resetSaved and player.attach`, address);
  }
  // A row of an experience record (5.16): exactly the row's properties, each of its type and bounds, the required ones
  // present; at most maxRows rows in a run. A broken rule faults the transaction.
  checkRecordRow(name, row, address) {
    const out = this.exp.doc.outputs[name];
    const props = out.row?.properties || {};
    for (const k of Object.keys(row)) if (!own(props, k)) fault('E-TYPE', `record ${name}: ${k} is not a property of its row`, address);
    for (const k of out.row?.required || Object.keys(props)) if (!own(row, k)) fault('E-TYPE', `record ${name}: the row has no ${k}`, address);
    for (const [k, v] of Object.entries(row)) { const bad = checkValue(props[k], v); if (bad) fault(bad[0], `record ${name}, ${k}: ${bad[1]}`, address); }
    const n = (this.state.records[`experience#${name}`] || []).length;
    if (out.maxRows !== undefined && n >= out.maxRows) fault('E-RANGE', `record ${name} has its ${out.maxRows} rows already`, address);
  }
  // ---------- the shell's dialogs (10.1) ----------
  // Shows or hides a dialog slot of the shell: the engine writes the slot's openValue (content only reads it).
  dialog(slot, open, address = null) {
    const shell = this.exp.shell?.doc;
    const s = shell?.slots?.[slot];
    if (!s || s.kind !== 'dialog') fault('E-REF-UNKNOWN', `no dialog slot ${slot} in the shell`, address || 'experience');
    const values = this.state.blocks[shell.id]?.values;
    if (!values || values[s.openValue] === open) return;
    values[s.openValue] = open;
    this.queue.push({ address: shell.id, name: `changed:${s.openValue}`, payload: {} });
    this.state.deliveries.push({ kind: open ? 'open' : 'close', address, slot });
  }
  openDialogs() {
    const shell = this.exp.shell?.doc;
    const values = shell && this.state.blocks[shell.id]?.values;
    if (!values) return [];
    return Object.entries(shell.slots || {}).filter(([, s]) => s.kind === 'dialog' && values[s.openValue] === true).map(([id, s]) => ({ id, ...s }));
  }
  // A paused or visiting owner keeps its own time while the engine clock moves: its elapsed, deadlines, clips, lines,
  // effects and physics wait (3.7, 3.10).
  holdTime(prefix, ms) {
    const mine = (a) => a === prefix || a.startsWith(prefix + '/');
    for (const t of this.state.timers) if (mine(t.owner)) t.due += ms;
    for (const [a, b] of Object.entries(this.state.blocks)) {
      if (!mine(a)) continue;
      b.born += ms; // elapsed is the owner's local clock (3.10): it stops too
      for (const run of Object.values(b.clips || {})) { run.startedAt += ms; if (run.keptAt !== undefined) run.keptAt += ms; }
      this.lines?.hold(a, ms);
      this.caps.hold(a, ms);
    }
  }

  // ---------- authored clocks (3.10) ----------
  // A use's clock goes on its block: the use's id, and the row of a repeated use.
  useClock(address, u, r) {
    const b = this.state.blocks[address];
    if (b && u.clock) b.clock = { use: u.id, ...(r ? { row: { item: clone(r.item), index: r.index } } : {}) };
  }
  // A block's own clock: a scene's `clock`, or the `clock` of the use that mounted it, read in the parent's scope
  // (with the row of a repeated use). Returns {speed, paused}, or null for no clock.
  ownClock(address) {
    const b = this.state.blocks[address];
    const c = b?.kind === 'scene' ? this.def(address)?.clock : b?.clock && (this.def(b.parent)?.uses || []).find(u => u?.id === b.clock.use)?.clock;
    if (!c || typeof c !== 'object') return null;
    const at = b.kind === 'scene' ? address : b.parent;
    const row = b.clock?.row;
    const speed = c.speed === undefined ? 1 : this.eval(at, c.speed, row);
    if (typeof speed !== 'number' || !(speed >= 0.01 && speed <= 100)) fault('E-CLOCK-SPEED', `clock speed ${JSON.stringify(speed)} is outside 0.01..100`, address);
    return { speed, paused: c.paused === undefined ? false : this.eval(at, c.paused, row) === true };
  }
  // Each block's clock now: Map address -> {rate, authored}, or null when every block runs at rate 1. rate is the
  // product of the speeds of its clock and its owners' (0 while paused); authored: its clock or an owner's is
  // paused by its formula. The stage slot's pause (pausedStage: a dialog, the host, a hidden page) holds the stage's
  // scene and its components. A clock formula that faults stops play (9.2).
  clockStates() {
    this.clocked ??= [...Object.values(this.exp.scenes || {}).map(s => s.doc), ...Object.values(this.defs || {}).map(d => d.doc), this.exp.shell?.doc]
      .some(d => d?.clock || (d?.uses || []).some(u => u?.clock));
    const frozen = this.pausedStage?.();
    if (!this.clocked && !frozen) return null;
    const out = new Map();
    const of = (a) => {
      if (out.has(a)) return out.get(a);
      const b = this.state.blocks[a];
      const up = b?.parent && this.state.blocks[b.parent] ? of(b.parent) : { rate: a === frozen ? 0 : 1, authored: false };
      const c = this.clocked ? this.ownClock(a) : null;
      const st = { rate: c?.paused ? 0 : up.rate * (c ? c.speed : 1), authored: up.authored || !!c?.paused };
      out.set(a, st);
      return st;
    };
    try { for (const a of Object.keys(this.state.blocks)) of(a); } catch (e) { this.stop(e, 'clock'); return null; }
    return out;
  }
  clockRates() {
    const st = this.clockStates();
    if (!st) return null;
    const out = new Map();
    for (const [a, x] of st) if (x.rate !== 1) out.set(a, x.rate);
    return out.size ? out : null;
  }
  // Whether a block's clock is paused now (its sounds pause with it, 6.10).
  clockHeld(address) { return this.clockStates()?.get(address)?.rate === 0; }
  // Moves each owner that runs at another rate on by ms of engine time: its local time moves rate * ms, so its
  // origin, clips and deadlines move (1 - rate) * ms. A paused owner holds all its time (holdTime); at any other
  // rate, lines and capability timers keep their own rate (sounds keep theirs, 3.10).
  clockStep(rates, ms) {
    for (const [a, r] of rates) {
      const b = this.state.blocks[a];
      if (!b) continue;
      const by = (1 - r) * ms;
      for (const t of this.state.timers) if (t.owner === a && (r === 0 || scaled(t))) t.due += by;
      b.born += by;
      for (const run of Object.values(b.clips || {})) { run.startedAt += by; if (run.keptAt !== undefined) run.keptAt += by; }
      if (r === 0) { this.lines?.hold(a, by); this.caps.hold(a, by); }
    }
  }

  // ---------- effects (A1.1): run by the effects capability (capabilities/effects.mjs) ----------
  // The particle runs a block draws now: none under reduced motion (rest and finish alike); ended still fires.
  particlesNow(address) {
    const b = this.state.blocks[address];
    if (!b?.effects || this.state.ambient.reducedMotion) return [];
    return Object.entries(b.effects).map(([id, run]) => ({ effect: id, run }));
  }

  // ---------- audio (6.10) ----------
  // A sound id resolves in the block's own document, then in the experience (2.6); a made sound (audioSynths, core)
  // is played by name too (A: audio). Returns {resource, path} (path from the experience folder; 2.1 says a path is
  // relative to the document that names it) or {synth}, or null.
  soundSource(address, name) {
    const b = this.state.blocks[address];
    const own = b && b.kind !== 'experience' ? this.def(address)?.resources?.[name] : null;
    if (own?.kind === 'sound') {
      const file = b.kind === 'scene' ? this.exp.scenes[b.def]?.file : this.defs[b.def]?.file;
      const dir = file && file.includes('/') ? file.slice(0, file.lastIndexOf('/') + 1) : '';
      return { resource: own, path: dir + own.file };
    }
    const top = this.exp.doc.resources?.[name];
    if (top?.kind === 'sound') return { resource: top, path: top.file };
    const synth = this.exp.doc.audioSynths?.[name] ?? null; // made sounds are core (D31.2)
    return synth ? { synth } : null;
  }
  // The level of each group: master volume x group knob, 0 when the master or the group is muted (6.10).
  mix() {
    const a = this.exp.doc.audio || {};
    const amb = this.state.ambient;
    const knob = (n) => this.state.blocks.experience.inputs[n] ?? this.state.blocks.experience.values[n];
    const out = {};
    for (const g of ['music', 'sounds', 'voice']) {
      const level = a.groups?.[g] ? knob(a.groups[g]) : 1;
      const muted = amb.muted || (a.mutes?.[g] ? knob(a.mutes[g]) === true : false);
      out[g] = muted ? 0 : (typeof level === 'number' ? level : 1) * amb.volume;
    }
    return out;
  }
  // The raw value of a content input that a one-name formula names in a block's scope, or undefined.
  rawInput(address, f) {
    const n = oneName(f);
    if (!n) return undefined;
    const b = this.state.blocks[address];
    const doc = this.def(address);
    if (b && own(b.inputs, n) && doc?.inputs?.[n]?.kind === 'content') return isObj(b.inputs[n]) ? clone(b.inputs[n]) : undefined;
    const shared = b && (b.kind === 'scene' || b.kind === 'shell');
    const root = this.state.blocks.experience;
    if (shared && !own(b.inputs, n) && !own(b.values, n) && own(root.inputs, n) && this.exp.doc.inputs?.[n]?.kind === 'content') return isObj(root.inputs[n]) ? clone(root.inputs[n]) : undefined;
    return undefined;
  }
  // builtin: a built-in value's change (D22, Y1); by default a changed: of an ambient name is one. An author's
  // experience input passes false.
  queueAll(name, builtin = name.startsWith('changed:') && AMBIENT.includes(name.slice(8))) { if (name.startsWith('changed:')) this.feed(name.slice(8)); this.fanOut(this.broadcastOrder(), name, {}, builtin); }
  // The order one event sent to many blocks is heard in (9.2): the shell, then each stage slot's scene in mount order
  // (a visiting caller before the scene it visits), each block before its uses, and the uses in the order the parent
  // lists them (a repeated use's rows in list order), whenever each was mounted.
  broadcastOrder() {
    const blocks = this.state.blocks;
    const out = []; const seen = new Set();
    const kids = new Map(); // a parent's blocks in mount order: a use still mounting is not yet in its parent's list
    for (const [k, b] of Object.entries(blocks)) if (b.parent && b.kind === 'component') { if (!kids.has(b.parent)) kids.set(b.parent, []); kids.get(b.parent).push(k); }
    const walk = (a) => {
      const b = blocks[a];
      if (!b || seen.has(a)) return;
      seen.add(a); out.push(a);
      for (const u of b.uses || []) { if (u.keys) for (const k of u.keys) walk(`${a}/${u.id}[${k}]`); else walk(`${a}/${u.id}`); }
      for (const k of kids.get(a) || []) walk(k);
    };
    const roots = Object.keys(blocks).filter(k => (blocks[k].kind === 'shell' || blocks[k].kind === 'scene') && !blocks[k].parent);
    for (const k of roots.filter(r => blocks[r].kind === 'shell')) walk(k);
    for (const k of roots.filter(r => blocks[r].kind === 'scene')) walk(k);
    return out;
  }
  // One event sent to many blocks at once (a fan-out): queued for each, counted as one event of the transaction (9.2
  // step 5), so the count follows the chain of causes, not the number of live blocks or rows.
  fanOut(addresses, name, payload = {}, builtin = false) { const fan = {}; for (const address of addresses) this.queue.push({ address, name, payload, fan, ...(builtin ? { builtin } : {}) }); }
  humanOnly(address, what, exempt = false) { if (!exempt && this.source !== 'person') fault('E-HUMAN-ONLY', `${what} needs a person's trusted activation; source is ${this.source}`, address); }
  resetSaved(settings) {
    // Every block's session and saved values take their initials; the stored copies go (5.1.2).
    for (const [address, b] of Object.entries(this.state.blocks)) for (const [k, v] of Object.entries(this.def(address)?.values || {})) if (['session', 'saved'].includes(v.lifetime)) b.values[k] = clone(v.initial);
    this.stored.reset(settings);
    if (settings) for (const item of this.exp.doc.addons?.widgets?.settings?.items || []) { const d = this.exp.doc.inputs?.[item.knob]; if (d) this.state.blocks.experience.inputs[item.knob] = clone(d.initial); }
    this.state.deliveries.push({ kind: 'resetSaved', settings });
  }

  // ---------- clips: timing only here (the drawing is stage 4) ----------
  playClip(address, id) {
    const doc = this.def(address);
    const clip = doc.clips?.[id];
    if (!clip) fault('E-REF-UNKNOWN', `no clip ${id}`, address);
    const b = this.state.blocks[address];
    if (b.clips[id]) this.stopClip(address, id, true);
    if (doc.clips?.[id]) this.yieldKept(address, doc, doc.clips[id]);
    const speed = clip.speed !== undefined ? this.eval(address, clip.speed) : 1;
    b.clips[id] = { startedAt: this.state.now, speed, lane: clip.lane };
    // replace a clip on the same lane
    if (clip.lane) for (const [other, run] of Object.entries(b.clips)) if (other !== id && run.lane === clip.lane) this.stopClip(address, other, true);
    const loop = clip.loop === true ? Infinity : typeof clip.loop === 'number' ? clip.loop : 1;
    const dur = clip.durationMs ?? clip.lifeMs ?? 0;
    if (Number.isFinite(loop) && dur > 0) this.state.timers.push({ due: this.state.now + (dur * loop) / speed, seq: this.state.seq++, owner: address, clip: id, startedAt: this.state.now });
    // One pending crossing per marker (6.7): the next one is armed when it fires, so a long or endless loop never
    // queues a timer per iteration.
    for (const m of clip.markers || []) this.armMarker({ owner: address, clip: id, marker: m.event, atMs: m.atMs, iter: 0, dur, loop: Number.isFinite(loop) ? loop : null, pingPong: clip.loopMode === 'ping-pong', speed, startedAt: this.state.now }, this.state.now);
  }
  // A marker's crossing in iteration t.iter, at clip time `start` of that iteration: forward runs cross at atMs,
  // ping-pong reverse (odd) runs at durationMs - atMs.
  armMarker(t, start) {
    const at = t.pingPong && t.iter % 2 === 1 ? t.dur - t.atMs : t.atMs;
    this.state.timers.push({ ...t, due: start + at / t.speed, seq: this.state.seq++ });
  }
  // After a crossing fires: arm the next iteration's crossing, if the clip loops that far.
  nextMarker(t) {
    if ((t.loop !== null && t.iter + 1 >= t.loop) || !(t.dur > 0)) return;
    const at = t.pingPong && t.iter % 2 === 1 ? t.dur - t.atMs : t.atMs;
    this.armMarker({ ...t, iter: t.iter + 1 }, t.due + (t.dur - at) / t.speed);
  }
  // The natural end (6.7): a clip with loopMode hold keeps its final pose until stop or replace; any other clip
  // releases its pose, as stop does. ended:<id> fires either way.
  clipEnded(address, id) {
    const b = this.state.blocks[address];
    const doc = this.def(address);
    const clip = doc.clips?.[id];
    if (clip?.loopMode === 'hold' && b.clips[id]) b.clips[id].ended = true;
    else delete b.clips[id];
    return this.emit(address, `ended:${id}`, { interrupted: false });
  }
  stopClip(address, id, interrupted) {
    const b = this.state.blocks[address];
    const run = b.clips[id];
    if (!run) return;
    delete b.clips[id];
    this.state.timers = this.state.timers.filter(t => !(t.owner === address && t.clip === id));
    // A held clip that already ended has fired its one ended:<id> (6.7); stop only releases its pose. A kept pose
    // (keepClip) fired its ended:<id> when it was stopped.
    if (!run.ended && run.keptAt === undefined) this.queue.push({ address, name: `ended:${id}`, payload: { interrupted } });
  }
  // stop with keep: true (6.7, 5.15.1): the clip stops (its timers go, ended:<id> fires interrupted) but its parts stay
  // at their value at this moment, until another writer moves them or the block enters afresh. The run stays in the
  // block's clips, frozen at keptAt (the drawing samples it there); it keeps its lane, so a clip played on that lane
  // replaces it. A clip that is not running, or a held pose that already ended, keeps what it shows.
  keepClip(address, id) {
    const b = this.state.blocks[address];
    const run = b.clips[id];
    if (!run || run.keptAt !== undefined) return;
    this.state.timers = this.state.timers.filter(t => !(t.owner === address && t.clip === id));
    b.clips[id] = { ...run, keptAt: this.state.now };
    if (!run.ended) this.queue.push({ address, name: `ended:${id}`, payload: { interrupted: true } });
  }
  // A clip that starts takes over the channels it writes from kept poses (keepClip): those tracks of a kept run stop
  // showing; a kept run with nothing left goes.
  yieldKept(address, doc, clip) {
    const b = this.state.blocks[address];
    const writes = new Set();
    for (const tr of clip.tracks || []) for (const t of [tr.target, ...(tr.stagger?.targets || [])]) writes.add(`${t}|${channelOf(tr)}`);
    for (const [other, run] of Object.entries(b.clips)) {
      if (run.keptAt === undefined) continue;
      const mine = [];
      for (const tr of doc.clips?.[other]?.tracks || []) for (const t of [tr.target, ...(tr.stagger?.targets || [])]) mine.push(`${t}|${channelOf(tr)}`);
      const dropped = [...new Set([...(run.dropped || []), ...mine.filter(k => writes.has(k))])];
      if (dropped.length >= new Set(mine).size) delete b.clips[other];
      else if (dropped.length !== (run.dropped || []).length) b.clips[other] = { ...run, dropped };
    }
  }

  // ---------- transactions (9.2) ----------
  // The rollback snapshot, cheap and exact. Values and inputs are only ever replaced on write, never changed in
  // place, so a shallow copy of each block's values and inputs keeps them; the rest of each block (machines, clips,
  // uses, attach, effects, physics) and the state outside the blocks are small and deep-copied. Records only grow,
  // so their lengths are kept.
  snapshot() {
    const s = this.state;
    const blocks = {};
    for (const [a, b] of Object.entries(s.blocks)) {
      const rest = {};
      for (const k of Object.keys(b)) if (k !== 'values' && k !== 'inputs') rest[k] = b[k];
      blocks[a] = { order: Object.keys(b), values: { ...b.values }, inputs: { ...b.inputs }, rest: structuredClone(rest) };
    }
    const top = {};
    for (const k of Object.keys(s)) if (k !== 'blocks' && k !== 'records') top[k] = s[k];
    return { order: Object.keys(s), top: structuredClone(top), blocks, records: Object.entries(s.records).map(([k, list]) => [k, list, list.length]) };
  }
  restore(snap) {
    const blocks = {};
    for (const [a, k] of Object.entries(snap.blocks)) {
      const b = {};
      for (const key of k.order) b[key] = key === 'values' ? k.values : key === 'inputs' ? k.inputs : k.rest[key];
      blocks[a] = b;
    }
    const records = {};
    for (const [k, list, n] of snap.records) { list.length = n; records[k] = list; }
    const state = {};
    for (const key of snap.order) state[key] = key === 'blocks' ? blocks : key === 'records' ? records : snap.top[key];
    this.state = state;
  }
  // Runs fn as one transaction from a source (9.2). Compute: fn, the queue, every check; a fault rolls everything
  // back and is returned. Commit: the revision rises. Deliver: stored writes, then listener calls; a failure there
  // never rolls back the commit, and goes to the host's error callback (deliveryError).
  transaction(source, fn) {
    // After a fatal stop nothing runs: every later source is refused with the stopping fault (9.2, 10.6).
    if (this.stopped) return { ok: false, fault: this.stopped, stopped: true };
    const snapshot = this.snapshot();
    const queue = this.queue;
    this.queue = [];
    this.source = source;
    this.counters = { events: 0, actions: 0 };
    this.budget = { steps: 0 };
    this.state.deliveries = [];
    this.state.outputs = [];
    try {
      fn();
      this.drain();
      this.checkBindings(this.changedBlocks(snapshot)); // 9.2 step 6, for every source: a binding fault rolls the change back
    } catch (e) {
      this.restore(snapshot);
      this.movedBlocks = null;
      this.queue = queue;
      this.source = null;
      e = overflowFault(e);
      if (!(e instanceof EngineFault)) throw e;
      this.lastFault = e;
      if (!REFUSED_ONLY.has(source)) this.stop(e, source);
      return { ok: false, fault: e };
    } finally {
      this.written = null;
      this.budget = null;
    }
    this.state.revision++;
    this.noteChanged(this.changedBlocks(snapshot));
    const deliveries = this.state.deliveries;
    const outputs = this.state.outputs;
    try {
      try { this.stored.persist(this, this.graphMemory?.(), this.exp.doc.story?.lifetime); } catch (e) { this.deliveryError(e, 'storage'); }
      for (const l of [...this.listeners]) {
        try { l({ revision: this.state.revision, deliveries, outputs }); } catch (e) { this.deliveryError(e, 'listener'); }
      }
    } finally { this.source = null; }
    return { ok: true, deliveries, outputs };
  }
  // 9.2 step 6: the binding formulas of the blocks the change touched (changed: a Set of addresses, or 'all'), on the
  // provisional store and with the binding phase's own budget. A fault throws, so the whole change rolls back and is
  // refused; nothing is committed. The page still paints after commit (step 9). Rich-text runs and tiered whole-field
  // texts are the drawing's to lay out and are not evaluated here.
  checkBindings(changed) {
    const addrs = changed === 'all' ? Object.keys(this.state.blocks) : [...changed].filter(a => this.state.blocks[a]);
    const outer = this.budget;
    this.budget = { steps: 0, phase: 'binding phase' };
    try {
      for (const a of addrs) {
        for (const bd of this.def(a)?.bindings || []) {
          try {
            if (typeof bd.text === 'string' && !WHOLE_FIELD.test(bd.text)) this.template(a, bd.text);
            if (typeof bd.label === 'string') this.template(a, bd.label);
            for (const k of ['visible', 'variant', 'color', 'move', 'rotate', 'scale', 'opacity', 'draw']) if (bd[k] !== undefined) this.eval(a, bd[k]);
          } catch (e) {
            if (e instanceof EngineFault) e.message = `binding ${entryKey(this.def(a), bd)}: ${e.message}`;
            throw e;
          }
        }
      }
    } finally { this.budget = outer; }
  }
  // The one stopped state (9.2): a fault from a control, timer, marker, link, line, effect, page signal or answer
  // stops the experience. From then on every transaction is refused, the clock stops and the host's calls are refused
  // (E-HOST-CLOSED). The page hears it once through onStop(fault, source). A fault the page finds itself (a binding
  // over its budget) stops the engine the same way.
  stop(f, source = 'engine') {
    if (this.stopped) return;
    this.stopped = f;
    this.queue = [];
    try { this.onStop?.(f, source); } catch (e) { this.deliveryError(e, 'listener'); }
  }
  // A failure in the deliver phase (9.2): to the host's error callback (onDeliveryError), else to the console.
  deliveryError(e, source) {
    const d = { code: e?.code || null, message: String(e?.message ?? e), source };
    if (this.onDeliveryError) { try { this.onDeliveryError(d); return; } catch { /* the callback failed too */ } }
    console.error('hsvg deliver phase:', d);
  }
  drain() {
    this.refreshMoved();
    while (this.queue.length) {
      const ev = this.queue.shift();
      if (!ev.fan?.counted && ++this.counters.events > FORMAT.eventsPerTransaction) fault('E-EVENT-LOOP', `more than ${FORMAT.eventsPerTransaction} events in one transaction`);
      if (ev.fan) ev.fan.counted = true;
      if (this.budget && this.budget.steps > FORMAT.formulaStepsPerTransaction) fault('E-EVENT-LOOP', `more than ${FORMAT.formulaStepsPerTransaction} formula steps in one transaction`);
      this.deliver(ev);
      this.refreshMoved();
      this.afterEvent?.();
    }
  }

  // ---------- controls (5.11) ----------
  // Is the control enabled? A control's own enabled formula; an option's enabled narrows it further. A hidden option (a
  // `visible` binding of its target that is not true) cannot activate either (5.11), in every player, as on the page.
  controlEnabled(address, id, option) {
    const def = this.def(address);
    const c = def?.controls?.[id];
    if (!c) return false;
    if (c.enabled !== undefined && this.eval(address, c.enabled) !== true) return false;
    if (option !== undefined && c.options?.[option]?.enabled !== undefined && this.eval(address, c.options[option].enabled) !== true) return false;
    const t = option !== undefined ? c.options?.[option]?.target : null;
    if (t) for (const b of def.bindings || []) if (b?.target === t && b.visible !== undefined && (typeof b.visible === 'boolean' ? b.visible : this.eval(address, b.visible)) !== true) return false;
    return true;
  }
  // A person (or seat) activates a control: press; option (arg: option id); slider (arg: a number in the value's
  // bounds); drag (arg: the drop id, or "" for none). Writes the value first, then queues the event.
  // actor: the seat an input acts for ({seat, filler}, A4.1); with seats installed a person's control asks the hook.
  activate(address, id, arg, source = 'person', actor = null) {
    // A hidden or disabled control cannot activate (5.11): nothing happens, and nothing is a fault.
    const kind = this.def(address)?.controls?.[id]?.kind;
    if (kind && !this.controlEnabled(address, id, kind === 'choice' ? arg : undefined)) return { ok: true, ignored: 'disabled' };
    if (source === 'person' && this.seatHook) { actor = this.seatHook.person(address, id, arg); if (actor === false) return { ok: true, ignored: 'not this seat\'s turn' }; }
    const r = this.asSeat(actor, `${address}/${id}`, source, () => {
      const c = this.def(address)?.controls?.[id];
      if (!c) fault('E-REF-UNKNOWN', `no control ${id}`, address);
      const writeValue = (v) => {
        if (c.value === undefined) return;
        if (this.exp.doc.inputs?.[c.value]?.kind === 'knob') { this.humanOnly(address, 'setting'); this.action(address, { id: `${id}-setting`, call: 'player.setting', with: { [c.value]: null }, value: v }, 'control'); return; }
        this.runActions(address, [{ id: `${id}-value`, set: c.value, value: v }], 'control');
      };
      // A toggle flips its value, then queues its event (5.11): a checkbox or an on and off chip. A button only queues.
      // A control whose value is a knob of the experience writes the knob (D45): the latest change wins, the host's or
      // the person's.
      if (c.kind === 'button' || c.kind === 'toggle') { if (c.kind === 'toggle') { const flip = this.controlValue(address, id) !== true; if (this.exp.doc.inputs?.[c.value]?.kind === 'knob') writeValue(flip); else this.runActions(address, [{ id: `${id}-value`, set: c.value, value: flip }], 'control'); } this.emit(address, c.event || `press:${c.target}`, {}); return; }
      if (c.kind === 'choice') {
        const o = c.options?.[arg];
        if (!o) fault('E-REF-UNKNOWN', `no option ${arg}`, address);
        writeValue(this.optionValue(address, c, o));
        if (c.event) this.emit(address, c.event, {});
        return;
      }
      if (c.kind === 'slider' || c.kind === 'dial') { writeValue(arg); if (c.event) this.emit(address, c.event, {}); return; }
      if (c.kind === 'drag') {
        const drop = arg ?? '';
        const okDrop = drop !== '' && (c.drops || []).includes(drop) && (c.accept === undefined || this.eval(address, c.accept, { event: { drop } }) === true);
        // Snap (5.11): the rest is the control's own state in its block (block.snaps), set in this same step. A drop is
        // a pick-up and a release, so the old rest goes first; an accepted drop of a snap drag rests on its drop.
        if (c.snap === true) this.setSnap(address, id, okDrop ? drop : undefined);
        if (okDrop) { if (c.event) this.emit(address, c.event, { drop }); } else if (c.missEvent) this.emit(address, c.missEvent, { drop });
        return;
      }
      // Control kinds of the engine's capabilities (capabilities.mjs), such as snapshot.
      if (this.caps.control(address, id, c, arg)) return;
      // other capability control kinds, if a host plugs them in
      const [capId, cap] = Object.entries(this.capabilities).find(([, x]) => Array.isArray(x?.controls) && x.controls.includes(c.kind)) || [];
      const door = capId && this.caps.plugin(capId);
      if (!door) fault('E-NEEDS-MISSING', `control kind ${c.kind} needs a capability this engine does not run`, address);
      cap.activate?.(door, address, id, structuredClone(c), arg);
    });
    this.afterCommit?.();
    return r;
  }
  // An add-on control kind's accessibility (D39): its role, gestures and valueText, with the value and its bounds;
  // null for a core kind.
  controlAccess(address, id) {
    const c = this.def(address)?.controls?.[id];
    const a = c && this.caps.access(address, id, c);
    if (!a) return null;
    const d = this.controlValueDecl(address, id); const v = c.value === undefined ? null : this.controlValue(address, id);
    return { role: a.role, valueText: a.valueText, valueNow: v, valueMin: d?.minimum ?? null, valueMax: d?.maximum ?? null, gestures: a.gestures };
  }
  // The value an option writes into its control's value: a formula, text in single quotes (D36).
  optionValue(address, c, o) {
    const at = typeof c.value === 'string' ? this.owner(address, c.value) : null;
    return this.slot(address, at ? this.def(at).values?.[c.value] : this.exp.doc.inputs?.[c.value], o.value);
  }
  // ---------- seats (A4.1): a small hook for the seats capability ----------
  // Runs fn as one transaction; for a seat's input (actor set) the hook runs it, drains its events and keeps the
  // record of play inside the same transaction. this.actor names the seat in record rows (5.16).
  asSeat(actor, name, source, fn) {
    const r = this.transaction(source, () => {
      if (!actor) return fn();
      this.actor = actor;
      this.seatHook.step(actor, name, () => { fn(); this.drain(); });
    });
    this.actor = null;
    return r;
  }
  // A seat's input, with source seat: a control <scene>/<id> (payload {option} or {value}), a trigger of the
  // experience (queued to the experience, the shell and every scene, with its payload, 5.3.3) or a choice link.
  seatInput(actor, name, payload) {
    const slash = name.indexOf('/');
    if (slash > 0) return this.activate(name.slice(0, slash), name.slice(slash + 1), payload?.option ?? payload?.value, 'seat', actor);
    const link = this.links?.find(l => l.id === name && l.choice !== undefined);
    const r = this.asSeat(actor, name, 'seat', () => {
      if (link) {
        if (link.from !== this.state.story.current || !this.eligible(link, {})) fault('E-SEAT-INPUT', `${name} is not an eligible choice`, 'experience');
        return this.fireLink(link, {});
      }
      const decl = this.exp.doc.inputs?.[name];
      if (decl?.kind !== 'trigger') fault('E-SEAT-INPUT', `${name} is not a trigger, a control or a choice link`, 'experience');
      const p = payload ?? {};
      const bad = decl.payload ? checkValue(decl.payload, p) : Object.keys(p).length ? ['E-TYPE', 'the trigger takes no payload'] : null;
      if (bad) fault(bad[0], `${name}: ${bad[1]}`, 'experience');
      this.queueTrigger(name, p);
    });
    this.afterCommit?.();
    return r;
  }
  // A trigger of the experience fired by the host or a seat (5.3.3): queued to the experience, then to the shell and
  // every mounted scene, each with its own copy of the payload, as one fan-out of the transaction.
  queueTrigger(name, payload = {}) {
    this.emit('experience', name, clone(payload));
    const fan = {};
    for (const [k, b] of Object.entries(this.state.blocks)) if (b.kind === 'scene' || b.kind === 'shell') this.queue.push({ address: k, name, payload: clone(payload), fan });
  }
  // The host's trigger (10.6): one transaction. The host API has checked the name and payload.
  trigger(name, payload = {}, source = 'host') {
    const r = this.transaction(source, () => this.queueTrigger(name, payload));
    this.afterCommit?.();
    return r;
  }
  // While a press or a slider is held its `held` value is true (a slider: by pointer or touch only); while a drag item
  // is picked up its `picked` value is true (5.11).
  // Picking up a snapped item clears its rest in the same step (5.11 snap).
  hold(address, id, down, source = 'person') {
    const c = this.def(address)?.controls?.[id];
    const name = ['button', 'toggle', 'slider', 'dial'].includes(c?.kind) ? c.held : c?.kind === 'drag' ? c.picked : undefined;
    const unsnap = !!down && c?.kind === 'drag' && c.snap === true && this.state.blocks[address]?.snaps?.[id] !== undefined;
    if (!name && !unsnap) return { ok: true, ignored: 'nothing to hold' };
    if (down && !this.controlEnabled(address, id)) return { ok: true, ignored: 'disabled' };
    const r = this.transaction(source, () => {
      if (unsnap) this.setSnap(address, id, undefined);
      if (name) this.runActions(address, [{ id: `${id}-${c.kind === 'drag' ? 'picked' : 'held'}`, set: name, value: !!down }], 'control');
    });
    this.afterCommit?.();
    return r;
  }
  // Where a snap drag rests (5.11): block.snaps maps the control id to its drop id. undefined: home. The map is
  // replaced, never changed in place, so a rollback restores it.
  setSnap(address, id, drop) {
    const b = this.state.blocks[address];
    if (!b) return;
    const snaps = { ...(b.snaps || {}) };
    if (drop === undefined) delete snaps[id]; else snaps[id] = drop;
    b.snaps = snaps;
  }
  // A key of the fixed set reaches every block as key:<code>, its release as keyUp:<code> (5.12). The host sends
  // no repeated keydown.
  key(code, up = false, source = 'person') {
    if (!KEY_CODE.test(code)) return { ok: true, ignored: 'not a key of the set' };
    const r = this.transaction(source, () => this.queueAll(`${up ? 'keyUp' : 'key'}:${code}`));
    this.afterCommit?.();
    return r;
  }
  // The declaration of the value a control writes: a body value of its block (or the experience's), or a knob.
  controlValueDecl(address, id) {
    const c = this.def(address)?.controls?.[id];
    if (!c?.value) return null;
    if (this.exp.doc.inputs?.[c.value]?.kind === 'knob') return this.exp.doc.inputs[c.value];
    const at = this.owner(address, c.value);
    return at ? this.def(at).values[c.value] : null;
  }
  // The current value a control shows (an option's choice, a slider's number).
  controlValue(address, id) {
    const c = this.def(address)?.controls?.[id];
    if (!c?.value) return undefined;
    if (this.exp.doc.inputs?.[c.value]?.kind === 'knob') return this.state.blocks.experience.inputs[c.value];
    return this.read(address, c.value);
  }
  // A slider's travel maps onto its value's bounds; with positions the value snaps to that many even steps (5.11).
  // t is the share of the travel, 0..1. Returns the value, or null when the slider has no number value.
  sliderValueAt(address, id, t) {
    const c = this.def(address)?.controls?.[id];
    const d = this.controlValueDecl(address, id);
    if ((c?.kind !== 'slider' && c?.kind !== 'dial') || d?.type !== 'number' || d.minimum === undefined || d.maximum === undefined) return null;
    let s = Math.max(0, Math.min(1, t));
    const n = this.controlPositions(address, id);
    if (n) s = Math.round(s * (n - 1)) / (n - 1);
    let v = d.minimum + s * (d.maximum - d.minimum);
    if (d.step) v = d.minimum + Math.round((v - d.minimum) / d.step) * d.step;
    return Math.max(d.minimum, Math.min(d.maximum, +v.toFixed(10)));
  }
  // One keyboard step of a slider: a position, or a tenth of the range without positions (5.11).
  sliderStep(address, id) {
    const c = this.def(address)?.controls?.[id];
    const d = this.controlValueDecl(address, id);
    if (!d || d.minimum === undefined || !c) return 0;
    const n = this.controlPositions(address, id);
    return (d.maximum - d.minimum) / (n ? n - 1 : 10);
  }
  // A Page Up or Page Down step of a slider (5.11): a tenth of the range, in whole positions (at least one) with
  // positions.
  sliderPage(address, id) {
    const n = this.controlPositions(address, id);
    return n ? Math.max(1, Math.round((n - 1) / 10)) * this.sliderStep(address, id) : this.sliderStep(address, id);
  }
  // A slider's spoken value (5.11): its valueText template, rendered now; undefined without one.
  controlValueText(address, id) {
    const t = this.def(address)?.controls?.[id]?.valueText;
    return typeof t === 'string' ? String(this.template(address, t)) : undefined;
  }
  // A slider's number of stops (5.11): an integer, or a formula read now (so it follows the names it reads), truncated
  // and kept in 2..1000. undefined: no stops.
  controlPositions(address, id) {
    const p = this.def(address)?.controls?.[id]?.positions;
    if (typeof p !== 'string') return p;
    const n = Math.trunc(Number(this.eval(address, p)));
    return Number.isFinite(n) ? Math.max(2, Math.min(1000, n)) : undefined;
  }

  // ---------- the host side ----------
  // A host or widget writes a declared input of the experience (10.6, A6.1): one change, checked, never clamped (only a
  // rounding past a bound is stored at the bound, onBound);
  // every block hears changed:<name> when the value differs.
  setInput(name, value, source = 'host') {
    const decl = this.exp.doc.inputs?.[name];
    const r = this.transaction(source, () => {
      if (!decl || decl.kind === 'trigger') fault('E-REF-UNKNOWN', `${name} is not a content field or knob`, 'experience');
      const bad = checkContent(decl, value) ?? this.caps.inputHook('check', name, decl, value); if (bad) fault(bad[0], `${name}: ${bad[1]}`, 'experience');
      this.writeInput(name, onBound(decl, value));
    });
    // A refused host change may leave a value of a capability's (live-data: the fallback rows), as a change of its own.
    const back = !r.ok && source === 'host' && decl && decl.kind !== 'trigger' ? this.caps.inputHook('refused', name, decl, this.dataView()) : undefined;
    if (back !== undefined) this.transaction(source, () => this.writeInput(name, back));
    this.afterCommit?.();
    return r;
  }
  // A host picture (10.6, D40), already checked: the input names it as host:<name>; every place bound to it paints
  // again, so a new picture under the same name shows too.
  hostPicture(name, uri) {
    (this.hostPictures ??= {})[name] = uri;
    const r = this.transaction('host', () => this.writeInput(name, `host:${name}`));
    this.dirty = 'all';
    this.afterCommit?.();
    return r;
  }
  // Writes an experience input that changed: every block hears changed:<name>, the inputs fed from it follow, and the
  // uses whose with reads it (a repeated use's list too, 4.5) are evaluated again.
  writeInput(name, value) {
    if (deepEqual(this.state.blocks.experience.inputs[name], value)) return;
    this.state.blocks.experience.inputs[name] = clone(value);
    // The host hears every change of an input, whoever made it (hsvg.changed, 10.6, D45).
    this.state.deliveries.push({ kind: 'input', name, value: clone(value), source: this.source });
    this.queueAll(`changed:${name}`, false);
    this.feed(name);
    this.refreshUses();
  }
  // A person's ambient setting (5.15.1): voice, muted, volume or reducedMotion. Only a value that differs is a change
  // (9.2 step 4). Inside a step.
  setAmbient(name, v) {
    const a = this.state.ambient;
    if (name === 'reducedMotion') { a.motionChosen = v; v = motionOf(a); }
    if (name === 'timeLimits' && (a.timeLimits ?? 1) !== v) this.rescaleTimers(v);
    if (a[name] !== v) { a[name] = v; this.queueAll(`changed:${name}`); }
  }
  // A timer a person may need more time for, written `ms` from now: its due time and the factor it was made with.
  personTimer(ms) {
    const f = this.state.ambient.timeLimits ?? 1;
    return f === 0 ? { due: OFF, scale: 0, rest: ms } : { due: this.state.now + ms * f, scale: f };
  }
  // A new timeLimits applies at once to the waiting timers: each keeps the written time it has left, now multiplied
  // by the new factor (0 holds it off; a later factor starts it again). A visiting caller's suspended timers (saved
  // with their `remaining` time on the visit stack) are rescaled the same way, so they come back with the new factor.
  rescaleTimers(g) {
    const now = this.state.now;
    for (const t of this.state.timers) {
      if (t.scale === undefined) continue;
      const left = t.scale === 0 ? t.rest : Math.max(0, t.due - now) / t.scale;
      delete t.rest;
      Object.assign(t, g === 0 ? { due: OFF, scale: 0, rest: left } : { due: now + left * g, scale: g });
    }
    for (const caller of this.state.story?.stack || []) {
      for (const t of caller.timers || []) {
        if (t.scale === undefined) continue;
        const left = t.scale === 0 ? t.rest : Math.max(0, t.remaining) / t.scale;
        delete t.rest;
        Object.assign(t, g === 0 ? { remaining: 0, scale: 0, rest: left } : { remaining: left * g, scale: g });
      }
    }
  }
  // The ambient size (5.5): the player box in whole CSS pixels and its active shape id (7.2). The page writes it at
  // mount, before the start (no event), and on every resize: a change is one host transaction in which every block
  // hears changed:size. The same size again is no change.
  setSize(size) {
    const v = { shape: String(size?.shape ?? ''), width: Math.round(Number(size?.width) || 0), height: Math.round(Number(size?.height) || 0) };
    const a = this.state.ambient;
    if (a.size && a.size.shape === v.shape && a.size.width === v.width && a.size.height === v.height) return null;
    if (Object.keys(this.state.blocks).length <= 1) { a.size = v; return null; }
    const r = this.transaction('host', () => { this.state.ambient.size = v; this.queueAll('changed:size'); });
    this.afterCommit?.();
    return r;
  }
  // The system's reduced-motion preference (the host's, 5.5), inside a step: the ambient reducedMotion is it or the
  // person's own setting.
  motionPreference(on) { this.state.ambient.motionSystem = on === true; this.setAmbient('reducedMotion', this.state.ambient.motionChosen === true); }
  // A settings form's Apply (5.3.2, A6.1): every changed item as one change, all checked, written at once, then the
  // changed: events in item order. changes: [[name, value]] where name is a knob or the ambient voice, muted, volume.
  applySettings(changes, source = 'widget') {
    const r = this.transaction(source, () => {
      const ambient = Object.keys(AMBIENT_SETTINGS);
      for (const [name, v] of changes) {
        if (ambient.includes(name)) {
          const bad = checkSetting(name, v); if (bad) fault(bad[0], `${name}: ${bad[1]}`, 'experience');
          continue;
        }
        const d = this.exp.doc.inputs?.[name];
        if (d?.kind !== 'knob') fault('E-SETTING', `${name} is not a knob of the experience`, 'experience');
        const bad = checkValue(d, v); if (bad) fault(bad[0], `${name}: ${bad[1]}`, 'experience');
      }
      for (const [name, v] of changes) {
        if (own(AMBIENT_SETTINGS, name)) { this.setAmbient(name, v); continue; }
        this.writeInput(name, onBound(this.exp.doc.inputs[name], v));
      }
    });
    this.afterCommit?.();
    return r;
  }
  // A person's or host's event to a block.
  send(address, name, payload = {}, source = 'person') { return this.transaction(source, () => this.emit(address, name, payload)); }
  timerOrder(a, b) { return a.due - b.due || a.seq - b.seq; }
  // Advances the clock, firing deadlines and capability ticks (physics) in order, each as its own transaction
  // (3.10, 9.2). The paused stage is asked again before each step, so a pause that starts inside an advance holds the
  // stage's time from that moment on, and split and whole advances give the same result. The hold moves with the
  // clock, step by step (heldTo), so a paused owner's elapsed never runs ahead of the engine clock.
  advance(ms) {
    if (this.stopped) return [];
    const end = this.state.now + ms;
    const results = [];
    let heldTo = this.state.now;
    const ticked = { to: this.state.now }; // the last second boundary heard (a deadline at a boundary keeps its tick)
    this.caps.clockBegin();
    const base = this.epochBase();
    for (;;) {
      if (heldTo < this.state.now) heldTo = this.state.now;
      // Each owner's rate of local time (3.10): 0 while paused, else its clock's speed times its owners'. Its
      // deadlines are kept as if it ran at rate 1 from heldTo, so a deadline's engine time is heldTo + its remaining
      // local time over the rate, rounded up to a whole millisecond.
      const rates = this.clockRates();
      if (this.stopped) break;
      const due = (x) => {
        const r = rates?.get(x.owner) ?? 1;
        if (r === 1 || (r > 0 && !scaled(x))) return x.due;
        return r === 0 ? Infinity : Math.max(heldTo, heldTo + Math.ceil((x.due - heldTo) / r - 1e-9));
      };
      this.state.timers.sort((a, b) => this.timerOrder(a, b));
      let t = null; let tDue = Infinity;
      for (const x of this.state.timers) { const d = due(x); if (d < tDue) { t = x; tDue = d; } } // a paused owner's deadline waits
      const tick = earlier(this.caps.clockNext(end, this), this.nowTick(end, base, ticked));
      // Owners that run at another rate are moved on to the next step (or the end) before that step runs.
      const next = Math.min(tDue <= end ? tDue : end, tick ? tick.due : end, end);
      if (rates && next > heldTo) { this.clockStep(rates, next - heldTo); heldTo = next; continue; }
      // A deadline goes before a capability tick at the same time.
      if (tick && (!t || tDue > end || tick.due < tDue)) { tick.run(results); if (this.stopped) break; continue; }
      if (!t || tDue > end) break;
      this.state.now = t.due = tDue;
      this.state.timers.splice(this.state.timers.indexOf(t), 1);
      results.push(this.transaction('timer', () => this.fire(t)));
      this.afterCommit?.();
      if (this.stopped) break; // a deadline after a fatal fault never fires (9.2)
    }
    if (!this.stopped) this.state.now = end;
    this.caps.clockEnd(this.state.now);
    return results;
  }
  // ---------- now (5.5) ----------
  // The date and time as UTC milliseconds, rounded down to whole seconds. A fixed epoch (opts.epochMs: the date at
  // engine time 0, as play tests and replays give it) counts on the engine clock; else the page's wall clock
  // (opts.wallClock, a function giving UTC ms) is read; with neither, the epoch is 0.
  epochBase() {
    if (typeof this.opts.epochMs === 'number') return this.opts.epochMs;
    if (typeof this.opts.wallClock === 'function') return this.opts.wallClock() - this.state.now;
    return 0;
  }
  nowValue() { return Math.floor((this.epochBase() + this.state.now) / 1000) * 1000; }
  // changed:now once a second, only in the blocks that hear it (an on changed:now): the next second boundary
  // after the last one heard (ticked.to) and by `end` is a step of the clock, after the deadlines at the same time.
  nowTick(end, base, ticked = { to: this.state.now }) {
    const hearers = Object.keys(this.state.blocks).filter(a => this.builtinKey(a, this.def(a)?.on, 'now'));
    if (!hearers.length) return null;
    const due = (Math.floor((base + ticked.to) / 1000) + 1) * 1000 - base;
    if (!(due >= this.state.now) || due > end) return null;
    return { due, run: (results) => {
      this.state.now = due;
      ticked.to = due;
      results.push(this.transaction('timer', () => { for (const a of hearers) if (this.state.blocks[a]) this.queue.push({ address: a, name: 'changed:now', payload: {}, builtin: true }); }));
      this.afterCommit?.();
    } };
  }
  fire(t) {
    if (!this.state.blocks[t.owner]) return;
    if (t.cap !== undefined) { this.caps.timer(t); return; } // a capability's own timer: only its capability hears it
    if (t.link) return this.onTimedLink?.(t);
    if (t.marker) { this.nextMarker(t); return this.emit(t.owner, t.marker, {}); }
    if (t.clip) return this.clipEnded(t.owner, t.clip);
    if (this.lines?.timer(t)) return; // a spoken line's word, gap or end (6.11)
    const b = this.state.blocks[t.owner];
    const node = this.nodeAt(t.owner, t.mid, t.path);
    const tr = node.after[t.index];
    if (tr.guard !== undefined && this.eval(t.owner, tr.guard) !== true) return; // used up
    // still active? (exits cancel timers, so it is)
    this.transition(t.owner, t.mid, t.path, tr);
    void b;
  }
  // The mouth looks the drawing writes (6.11): a spoken line's cues, merged with the loudness mouths the audio page
  // part sets (audioMouth).
  get mouthLooks() { return this.lines ? this.lines.mouthLooks(this.loudMouths || []) : (this.loudMouths || []); }
  set mouthLooks(v) { this.loudMouths = v; }
  note(kind, address, message) { (this.notes ??= []).push({ kind, address, message }); }
  // on(fn): fn({revision, deliveries, outputs}) after each commit, for the engine's own parts. on(name, fn): the host
  // form of 10.6, so a page's player hears what a host hears: a declared output event or record of the experience,
  // or a built-in output (entered, ended, openUrl, firstInput, hookHealth); fn gets a frozen {name, detail} per output,
  // in the deliver phase. Returns a function that stops listening. Another name hears nothing and is reported once
  // as E-REF-UNKNOWN through the deliver-error path (onError); the host API's on (src/host.mjs) throws instead.
  on(name, fn) {
    if (typeof name === 'function') { const l = name; this.listeners.push(l); return () => { this.listeners = this.listeners.filter(x => x !== l); }; }
    const out = this.exp.doc.outputs?.[name];
    if (typeof fn !== 'function') fault('E-TYPE', `on(${name}) needs a function`, 'experience');
    if (!HOST_OUTPUTS.includes(name) && !(out && (out.kind === 'event' || out.kind === 'record'))) {
      this.deliveryError({ code: 'E-REF-UNKNOWN', message: `${name} is not an output event or record of the experience: nothing to hear` }, 'host');
      return () => {};
    }
    const freeze = (x) => { if (x && typeof x === 'object') { for (const v of Object.values(x)) freeze(v); Object.freeze(x); } return x; };
    return this.on(({ outputs }) => {
      for (const o of outputs) {
        if (o.name !== name) continue;
        const { name: _n, ...detail } = o;
        fn(freeze({ name, detail: structuredClone(detail) }));
      }
    });
  }
}
