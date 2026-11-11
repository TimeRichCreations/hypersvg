// The add-on door (D23, spec chapter 12 "Writing an add-on"), door 2 (door 1 still opens). One rule for three kinds: an add-on is a folder
// named by its id, with manifest.json and its files.
//   manifest: {door: 2, id, version, kind: "preset" | "module" | "capability", title, description?, adds}
//   - a built-in add-on (the engine's own, engine/v2/addons/<name>) has a bare name: wobble
//   - an outside add-on is owner.name (example.noughts); a bare name in an outside folder is refused
//   - an experience names a module or capability in needs (example.noughts@1.0.0), a preset in a document's presets
//     ({"use": "example.shake@1.0.0", "as": "logo-shake", "with": {...}}), and pins every outside add-on it uses in
//     its about.trust.pins with the folder's digest (tools/addons.mjs addonDigest)
// This module is pure (no files, no clock): names, the manifest check and the preset expansion, which the loader
// (src/load.mjs) runs before a document is checked, and the packer runs before it packs. A packed page never expands a
// preset: it carries the expanded documents. Nothing here reaches a packed page's bundle.

// Door 2 (D31.5) adds draws, humanOnly calls, contentTypes, grants, writes (door 1's channels) and events with a
// subject. A door 1 manifest keeps working: its channels are read as writes, and it may not use door 2's words.
export const DOOR = 2;
export const DOORS = Object.freeze([1, 2]);
export const KINDS = Object.freeze(['preset', 'module', 'capability']);
const WORD = '[a-z][a-z0-9]*(-[a-z0-9]+)*';
export const BARE_RE = new RegExp(`^${WORD}$`);
export const OUTSIDE_RE = new RegExp(`^${WORD}\\.${WORD}$`);
// The core's event prefixes (12.5): no add-on may take one as its name.
export const CORE_EVENT_PREFIXES = Object.freeze(['press', 'changed', 'ended', 'key', 'keyUp', 'signal', 'save', 'audio', 'hsvg']);
export const VERSION_RE = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const ID_RE = /^[a-z][a-zA-Z0-9]*$/; // an input name: a value name (2.9)
const AS_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/; // an `as` name: an id (2.9) of at most 32 characters, so "{{as}}-drop" is one
const EVENT_RE = /^[a-z][a-zA-Z0-9]*(:<subject>)?$/;
// The grant kinds of 10.5 an add-on may say it uses.
export const GRANT_KINDS = Object.freeze(['storage', 'network', 'fillers', 'signals', 'pageActions', 'hooks', 'widgets', 'openUrl', 'ai']);
export const isOutside = (id) => typeof id === 'string' && OUTSIDE_RE.test(id);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const own = (o, k) => isObj(o) && Object.prototype.hasOwnProperty.call(o, k);

// "example.noughts@1.0.0" -> {id: "example.noughts", version: "1.0.0"}; "wobble" -> {id: "wobble", version: null}.
// null when the text is not a name.
export function parseName(text) {
  if (typeof text !== 'string') return null;
  const at = text.indexOf('@');
  const id = at < 0 ? text : text.slice(0, at);
  const version = at < 0 ? null : text.slice(at + 1);
  if (!BARE_RE.test(id) && !OUTSIDE_RE.test(id)) return null;
  return { id, version };
}

// The keys a preset may provide (D23): clips, built-in add-on settings (addons: physics bodies, particle effects), motion
// curves and themes (themes), layout plans (layouts), rule sets (rules), the needs they bring, and the entry and on
// lists that start them. Everything else is grammar a preset cannot add (E-CAPABILITY-GRAMMAR).
export const PRESET_KEYS = Object.freeze(['clips', 'addons', 'themes', 'layouts', 'rules', 'needs', 'entry', 'on']);
// The input types of a preset (typed and range-checked).
export const INPUT_TYPES = Object.freeze(['number', 'integer', 'boolean', 'string', 'color', 'part', 'role']);
const MANIFEST_KEYS = ['door', 'id', 'version', 'kind', 'title', 'description', 'adds'];
const ADDS_KEYS = { preset: ['inputs', 'provides'], module: ['exports'], capability: ['keys', 'calls', 'events', 'writes', 'draws', 'contentTypes', 'grants', 'controls', 'paints'] };
// Door 1's capability words: channels was renamed writes in door 2.
const ADDS_KEYS_1 = { ...ADDS_KEYS, capability: ['keys', 'calls', 'events', 'channels'] };

// Checks a manifest. folder: the folder's name (the id it must carry); builtIn: the engine's own folder. Returns
// [{code, path, message}], each message saying the fix. E-CAPABILITY-FORMAT: another door; E-CAPABILITY-GRAMMAR: a bare
// name outside the engine, or grammar the door does not open; E-ADDON: anything else.
export function checkManifest(m, { folder = null, builtIn = false } = {}) {
  const out = [];
  const bad = (code, p, message) => out.push({ code, path: p, message });
  if (!isObj(m)) { bad('E-ADDON', '', 'manifest.json is one JSON object: {"door": 2, "id": "owner.name", "version": "1.0.0", "kind": "preset", "title": "...", "adds": {...}}'); return out; }
  if (!DOORS.includes(m.door)) { bad('E-CAPABILITY-FORMAT', 'door', `this add-on is written for door ${JSON.stringify(m.door)}; this engine opens doors ${DOORS.join(' and ')}: write "door": ${DOOR}`); return out; }
  const addsKeys = m.door === 1 ? ADDS_KEYS_1 : ADDS_KEYS;
  for (const k of Object.keys(m)) if (!MANIFEST_KEYS.includes(k)) bad('E-ADDON', k, `${k} is not a manifest key; a manifest holds ${MANIFEST_KEYS.join(', ')}`);
  if (typeof m.id !== 'string' || !(BARE_RE.test(m.id) || OUTSIDE_RE.test(m.id))) bad('E-ADDON', 'id', `id ${JSON.stringify(m.id)} is not a name: write owner.name in lower case, for example "acme.wobble"`);
  else if (builtIn && !BARE_RE.test(m.id)) bad('E-ADDON', 'id', `a built-in add-on has a bare name: write "${m.id.split('.').pop()}"`);
  else if (!builtIn && !OUTSIDE_RE.test(m.id)) bad('E-CAPABILITY-GRAMMAR', 'id', `"${m.id}" is a bare name, and bare names are the engine's own: name an outside add-on owner.name, for example "acme.${m.id}", and its folder the same`);
  // The core's event prefixes are reserved (12.5): an add-on whose name is one would read as a core event.
  const named = typeof m.id === 'string' ? m.id.split('.').pop() : null;
  if (named !== null && CORE_EVENT_PREFIXES.includes(named)) bad('E-ADDON', 'id', `${named} is a core event prefix (${CORE_EVENT_PREFIXES.join(', ')}), so no add-on may take it as its name (12.5): choose another name`);
  if (folder !== null && typeof m.id === 'string' && m.id !== folder) bad('E-ADDON', 'id', `the folder is ${folder} but the id is ${m.id}: name the folder after the id`);
  if (typeof m.version !== 'string' || !VERSION_RE.test(m.version)) bad('E-ADDON', 'version', `version ${JSON.stringify(m.version)} is not major.minor.patch: write for example "1.0.0"`);
  if (!KINDS.includes(m.kind)) { bad('E-ADDON', 'kind', `kind ${JSON.stringify(m.kind)} is not one of ${KINDS.join(', ')}`); return out; }
  if (typeof m.title !== 'string' || !m.title.trim() || m.title.length > 80) bad('E-ADDON', 'title', 'title is a short name for people, 1 to 80 characters');
  if (m.description !== undefined && (typeof m.description !== 'string' || m.description.length > 400)) bad('E-ADDON', 'description', 'description is plain text, at most 400 characters');
  if (!isObj(m.adds)) { bad('E-ADDON', 'adds', `adds is an object: for a ${m.kind}, {${addsKeys[m.kind].map(k => `"${k}": ...`).join(', ')}}`); return out; }
  for (const k of Object.keys(m.adds)) {
    if (addsKeys[m.kind].includes(k)) continue;
    if (m.door === 1 && ADDS_KEYS[m.kind].includes(k)) bad('E-CAPABILITY-FORMAT', `adds.${k}`, `${k} is a door 2 word: write "door": 2${m.adds.channels !== undefined ? ' and rename channels to writes' : ''}`);
    else if (m.door === 2 && k === 'channels') bad('E-CAPABILITY-GRAMMAR', 'adds.channels', 'door 2 calls channels writes: rename channels to writes');
    else bad('E-CAPABILITY-GRAMMAR', `adds.${k}`, `a ${m.kind} adds only ${addsKeys[m.kind].join(', ')}; remove ${k}`);
  }
  if (m.kind === 'preset') checkPreset(m.adds, bad);
  if (m.kind === 'module') checkModule(m.adds, bad);
  if (m.kind === 'capability') checkCapability(m.adds, bad);
  return out;
}

function checkInputs(inputs, bad) {
  if (inputs === undefined) return {};
  if (!isObj(inputs)) { bad('E-ADDON', 'adds.inputs', 'inputs is an object: {"amount": {"type": "number", "minimum": 0, "maximum": 30, "initial": 8}}'); return {}; }
  for (const [name, d] of Object.entries(inputs)) {
    const at = `adds.inputs.${name}`;
    if (!ID_RE.test(name) || name === 'as') { bad('E-ADDON', at, `the input name ${name} is not a value name (or is "as", which every use has): letters and digits, starting with a small letter`); continue; }
    if (!isObj(d) || !INPUT_TYPES.includes(d.type)) { bad('E-ADDON', at, `the input ${name} needs a type: one of ${INPUT_TYPES.join(', ')}`); continue; }
    if (d.type === 'number' || d.type === 'integer') {
      if (typeof d.minimum !== 'number' || typeof d.maximum !== 'number' || !(d.minimum <= d.maximum)) bad('E-ADDON', at, `a ${d.type} input is range-checked: give it "minimum" and "maximum", minimum not above maximum`);
    }
    if (d.type === 'string' && d.enum === undefined && !(Number.isInteger(d.maxLength) && d.maxLength >= 1 && d.maxLength <= 4096)) bad('E-ADDON', at, 'a string input gives "maxLength" (1..4096) or an "enum" list');
    if (d.enum !== undefined && !(Array.isArray(d.enum) && d.enum.length && d.enum.every(x => typeof x === 'string'))) bad('E-ADDON', at, 'enum is a list of strings');
    for (const k of Object.keys(d)) if (!['type', 'minimum', 'maximum', 'maxLength', 'enum', 'initial', 'description'].includes(k)) bad('E-ADDON', `${at}.${k}`, `${k} is not an input key; an input holds type, minimum, maximum, maxLength, enum, initial and description`);
    if (d.initial !== undefined) { const why = inputProblem(d, d.initial); if (why) bad('E-ADDON', `${at}.initial`, `the initial value ${JSON.stringify(d.initial)} does not fit: ${why}`); }
  }
  return inputs;
}

function checkPreset(adds, bad) {
  const inputs = checkInputs(adds.inputs, bad);
  if (!isObj(adds.provides) || !Object.keys(adds.provides).length) { bad('E-ADDON', 'adds.provides', `provides holds the content the preset adds, with keys from ${PRESET_KEYS.join(', ')}`); return; }
  for (const k of Object.keys(adds.provides)) if (!PRESET_KEYS.includes(k)) bad('E-CAPABILITY-GRAMMAR', `adds.provides.${k}`, `a preset provides only ${PRESET_KEYS.join(', ')}; ${k} is grammar a preset cannot add (a capability add-on owns keys)`);
  // Every placeholder names an input or "as".
  const names = new Set(['as', ...Object.keys(inputs)]);
  walkStrings(adds.provides, (s, p) => {
    for (const x of s.matchAll(/\{\{\s*([^}\s]*)\s*\}\}/g)) if (!names.has(x[1])) bad('E-ADDON', `adds.provides${p}`, `{{${x[1]}}} names no input: declare it in adds.inputs, or use {{as}}`);
  });
}

function checkSchema(s, at, bad, what) {
  if (!isObj(s) || s.type !== 'object' || !isObj(s.properties)) bad('E-ADDON', at, `${what} is a JSON schema of an object: {"type": "object", "properties": {...}, "required": [...], "additionalProperties": false}`);
  else if (s.additionalProperties !== false) bad('E-ADDON', at, `${what} is closed: add "additionalProperties": false`);
  else contentTypes(s, at, bad);
}
// A module's or capability's values are content's values (5.1): number (with step for whole numbers), string,
// boolean, array and object. Returns nothing; reports each other type with its fix.
const VALUE_TYPES = ['number', 'string', 'boolean', 'array', 'object'];
function contentTypes(s, at, bad) {
  if (!isObj(s)) return;
  if (s.type === 'integer') bad('E-ADDON', at, 'content values have no integer type: write "type": "number", "step": 1 (with minimum and maximum)');
  else if (s.type !== undefined && !VALUE_TYPES.includes(s.type)) bad('E-ADDON', at, `the type ${JSON.stringify(s.type)} is not a content value type: use one of ${VALUE_TYPES.join(', ')}`);
  if (s.type === 'string' && s.enum === undefined && s.maxLength === undefined) bad('E-ADDON', at, 'a string gives "maxLength" or an "enum" list, as a content value does');
  for (const [k, v] of Object.entries(isObj(s.properties) ? s.properties : {})) contentTypes(v, `${at}.properties.${k}`, bad);
  if (s.items) contentTypes(s.items, `${at}.items`, bad);
}

function checkModule(adds, bad) {
  if (!isObj(adds.exports) || !Object.keys(adds.exports).length) { bad('E-ADDON', 'adds.exports', 'a module adds at least one export: {"exports": {"move": {"with": {...}, "returns": {...}, "budgetMs": 50}}}'); return; }
  for (const [n, ex] of Object.entries(adds.exports)) {
    const at = `adds.exports.${n}`;
    if (!/^[a-z][a-zA-Z0-9]*$/.test(n)) bad('E-ADDON', at, `the export name ${n} is a camelCase word`);
    if (!isObj(ex)) { bad('E-ADDON', at, 'an export holds with, returns and budgetMs'); continue; }
    checkSchema(ex.with, `${at}.with`, bad, 'with');
    checkSchema(ex.returns, `${at}.returns`, bad, 'returns');
    if (!(Number.isInteger(ex.budgetMs) && ex.budgetMs >= 1 && ex.budgetMs <= 1000)) bad('E-ADDON', `${at}.budgetMs`, 'budgetMs is the time limit of one call: an integer 1..1000');
    if (ex.budgetSteps !== undefined && !(Number.isInteger(ex.budgetSteps) && ex.budgetSteps >= 1 && ex.budgetSteps <= 10000000)) bad('E-ADDON', `${at}.budgetSteps`, 'budgetSteps is an integer 1..10,000,000');
    for (const k of Object.keys(ex)) if (!['with', 'returns', 'budgetMs', 'budgetSteps', 'description'].includes(k)) bad('E-ADDON', `${at}.${k}`, `${k} is not an export key; an export holds with, returns, budgetMs, budgetSteps and description`);
  }
}

function checkCapability(adds, bad) {
  if (adds.keys !== undefined) checkSchema(adds.keys, 'adds.keys', bad, 'keys (the settings a block gives under addons.<id>)');
  const calls = adds.calls ?? {};
  if (!isObj(calls)) bad('E-ADDON', 'adds.calls', 'calls is an object: {"start": {"with": {...}}}');
  else for (const [n, c] of Object.entries(calls)) {
    if (!/^[a-z][a-zA-Z0-9]*$/.test(n)) bad('E-ADDON', `adds.calls.${n}`, `the call name ${n} is a camelCase word`);
    if (!isObj(c)) { bad('E-ADDON', `adds.calls.${n}`, 'a call holds with'); continue; }
    checkSchema(c.with, `adds.calls.${n}.with`, bad, 'with');
    for (const k of Object.keys(c)) if (!['with', 'humanOnly', 'description'].includes(k)) bad('E-ADDON', `adds.calls.${n}.${k}`, `${k} is not a call key; a call holds with, humanOnly and description`);
    if (c.humanOnly !== undefined && typeof c.humanOnly !== 'boolean') bad('E-ADDON', `adds.calls.${n}.humanOnly`, 'humanOnly is true or false: true means only a person\'s press may cause the call (10.5)');
  }
  if (adds.events !== undefined && !(Array.isArray(adds.events) && adds.events.every(e => typeof e === 'string' && EVENT_RE.test(e)))) bad('E-ADDON', 'adds.events', 'events is a list of camelCase names, each with ":<subject>" when it is about one thing; content hears each as <id>:<name> or <id>:<name>:<subject>');
  const wk = adds.writes !== undefined ? 'writes' : 'channels';
  const writes = adds[wk];
  if (writes !== undefined) {
    if (!Array.isArray(writes)) bad('E-ADDON', `adds.${wk}`, `${wk} is a list of key names: the keys whose value names a body value the add-on writes`);
    else for (const c of writes) if (adds.keys?.properties?.[c]?.type !== 'string') bad('E-ADDON', `adds.${wk}`, `${c} is not a string property of keys: each entry of ${wk} names a key whose value names the body value the add-on writes`);
  }
  if (adds.draws !== undefined) {
    if (!isObj(adds.draws)) bad('E-ADDON', 'adds.draws', 'draws is {"binding": {schema}, "text": false}: the object a binding gives under the add-on\'s id, which the add-on paints on its target');
    else {
      checkSchema(adds.draws.binding, 'adds.draws.binding', bad, 'draws.binding');
      if (adds.draws.text !== undefined && typeof adds.draws.text !== 'boolean') bad('E-ADDON', 'adds.draws.text', 'text is true when the add-on paints text, so fitting and the ladder measure it as text');
      for (const k of Object.keys(adds.draws)) if (!['binding', 'text', 'description'].includes(k)) bad('E-ADDON', `adds.draws.${k}`, `${k} is not a draws key; draws holds binding, text and description`);
    }
  }
  if (adds.contentTypes !== undefined) {
    if (!isObj(adds.contentTypes)) bad('E-ADDON', 'adds.contentTypes', 'contentTypes is an object: {"ramp": {"type": "string", "maxLength": 200, "description": "..."}}');
    else for (const [n, d] of Object.entries(adds.contentTypes)) {
      if (!/^[a-z][a-zA-Z0-9]*$/.test(n)) bad('E-ADDON', `adds.contentTypes.${n}`, `the content type ${n} is a camelCase word; content names it <id>.${n}`);
      if (!isObj(d) || !VALUE_TYPES.includes(d.type)) bad('E-ADDON', `adds.contentTypes.${n}`, `a content type gives the value type it holds: one of ${VALUE_TYPES.join(', ')}`);
      else contentTypes(d, `adds.contentTypes.${n}`, bad);
    }
  }
  if (adds.grants !== undefined && !(Array.isArray(adds.grants) && adds.grants.every(g => GRANT_KINDS.includes(g)))) bad('E-ADDON', 'adds.grants', `grants lists the grant kinds the add-on uses (10.5): ${GRANT_KINDS.join(', ')}`);
  growthSlots(adds, bad);
  if (!Object.keys(calls).length && adds.keys === undefined && adds.controls === undefined && adds.paints === undefined) bad('E-ADDON', 'adds', 'a capability adds calls, keys, controls or paints; with none, content cannot use it');
}

// D39's growth slots (door 2): control kinds and channels, each named <id>.<name> in content.
// controls.<kind>: {role, gestures, description}. role is what a screen reader announces; gestures are what the page
// passes to the add-on's input hook (press: a click, Enter or Space; up and down: the arrow keys).
// paints.<name>: {value, onto, description}. value is the number range a binding or track gives (the checker proves it,
// the engine checks it); onto lists the part channels the add-on's writer may set.
export const CONTROL_ROLES = Object.freeze(['button', 'checkbox', 'switch', 'slider', 'spinbutton']);
export const GESTURES = Object.freeze(['press', 'up', 'down']);
export const ONTO = Object.freeze(['x', 'y', 'rotate', 'scale', 'opacity']);
const SLOT_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
function growthSlots(adds, bad) {
  const each = (key, fix, fn) => {
    if (adds[key] === undefined) return;
    if (!isObj(adds[key]) || !Object.keys(adds[key]).length) { bad('E-ADDON', `adds.${key}`, fix); return; }
    for (const [n, d] of Object.entries(adds[key])) {
      const at = `adds.${key}.${n}`;
      if (!SLOT_NAME.test(n)) bad('E-ADDON', at, `${n} is not a name: small letters, digits and dashes, starting with a letter (content writes <id>.${n.toLowerCase()})`);
      if (!isObj(d)) { bad('E-ADDON', at, fix); continue; }
      fn(d, at);
      if (d.description !== undefined && (typeof d.description !== 'string' || d.description.length > 400)) bad('E-ADDON', `${at}.description`, 'description is plain text, at most 400 characters');
    }
  };
  each('controls', 'controls is an object of control kinds: {"stepper": {"role": "spinbutton", "gestures": ["press", "up", "down"]}}', (d, at) => {
    if (!CONTROL_ROLES.includes(d.role)) bad('E-ADDON', `${at}.role`, `role is what a screen reader announces: one of ${CONTROL_ROLES.join(', ')}`);
    if (!(Array.isArray(d.gestures) && d.gestures.length && d.gestures.every(g => GESTURES.includes(g)))) bad('E-ADDON', `${at}.gestures`, `gestures lists what the page passes to the add-on's input hook, from ${GESTURES.join(', ')}`);
    for (const k of Object.keys(d)) if (!['role', 'gestures', 'description'].includes(k)) bad('E-ADDON', `${at}.${k}`, `${k} is not a control kind key; it holds role, gestures and description`);
  });
  each('paints', 'paints is an object of channels: {"swing": {"value": {"type": "number", "minimum": -1, "maximum": 1}, "onto": ["rotate"]}}', (d, at) => {
    const v = d.value;
    if (!(isObj(v) && v.type === 'number' && typeof v.minimum === 'number' && typeof v.maximum === 'number' && v.minimum <= v.maximum && Object.keys(v).every(k => ['type', 'minimum', 'maximum', 'description'].includes(k)))) bad('E-ADDON', `${at}.value`, 'value is the number a binding or track gives: {"type": "number", "minimum": ..., "maximum": ...}, so the checker can prove it');
    if (!(Array.isArray(d.onto) && d.onto.length && d.onto.every(o => ONTO.includes(o)))) bad('E-ADDON', `${at}.onto`, `onto lists the part channels the writer may set, from ${ONTO.join(', ')}`);
    for (const k of Object.keys(d)) if (!['value', 'onto', 'description'].includes(k)) bad('E-ADDON', `${at}.${k}`, `${k} is not a channel key; it holds value, onto and description`);
  });
}

// Why a preset input's value does not fit its declaration, or null.
export function inputProblem(d, v) {
  switch (d.type) {
    case 'number': if (typeof v !== 'number' || !Number.isFinite(v)) return 'it is a number'; break;
    case 'integer': if (!Number.isInteger(v)) return 'it is a whole number'; break;
    case 'boolean': return typeof v === 'boolean' ? null : 'it is true or false';
    case 'string': if (typeof v !== 'string') return 'it is a string'; if (d.maxLength !== undefined && v.length > d.maxLength) return `it is at most ${d.maxLength} characters`; break;
    case 'color': return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? null : 'it is a colour #rrggbb';
    case 'part': return typeof v === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,47}$/.test(v) ? null : 'it is the id of a drawn part';
    case 'role': return typeof v === 'string' && /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(v) ? null : 'it is a role name';
    default: return `the type ${d.type} is unknown`;
  }
  if (d.enum && !d.enum.includes(v)) return `it is one of ${d.enum.join(', ')}`;
  if (typeof v === 'number' && ((d.minimum !== undefined && v < d.minimum) || (d.maximum !== undefined && v > d.maximum))) return `it is ${d.minimum}..${d.maximum}`;
  return null;
}

function walkStrings(node, fn, p = '') {
  if (typeof node === 'string') { fn(node, p); return; }
  if (Array.isArray(node)) { node.forEach((v, i) => walkStrings(v, fn, `${p}[${i}]`)); return; }
  if (isObj(node)) for (const [k, v] of Object.entries(node)) { fn(k, `${p}.${k}`); walkStrings(v, fn, `${p}.${k}`); }
}

// The provides of a preset with its inputs put in. A string that is exactly {{name}} becomes the value, keeping its
// type; {{name}} inside a longer string becomes its text. Keys are filled too, so {{as}} names what a use adds.
export function fill(node, values) {
  const one = (s) => {
    const whole = /^\{\{\s*([^}\s]+)\s*\}\}$/.exec(s);
    if (whole && own(values, whole[1])) return values[whole[1]];
    return s.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (m, n) => (own(values, n) ? String(values[n]) : m));
  };
  if (typeof node === 'string') return one(node);
  if (Array.isArray(node)) return node.map(v => fill(v, values));
  if (isObj(node)) return Object.fromEntries(Object.entries(node).map(([k, v]) => [String(one(k)), fill(v, values)]));
  return node;
}

// Expands a document's presets (D23): each use's provides, filled with its inputs, is merged into the document, and
// the presets key goes. Objects merge key by key; lists append (needs once each); a key the document already has is
// a conflict (E-ADDON). manifestOf(name): {manifest} for a use's name ("wobble" or "example.shake@1.0.0"), or
// {problem: [code, message]}. Returns {doc, diags: [{code, path, message}], origins: [{path: [tokens], use}]}: origins
// say which parts of the document each use added, so the checker can name the preset in its findings.
export function expandPresets(doc, manifestOf) {
  if (!isObj(doc) || doc.presets === undefined) return { doc, diags: [], origins: [] };
  const diags = []; const origins = [];
  const bad = (code, p, message) => diags.push({ code, path: p, message });
  const { presets, ...rest } = doc;
  const out = structuredClone(rest);
  if (!Array.isArray(presets)) { bad('E-ADDON', 'presets', 'presets is a list of uses: [{"use": "wobble", "as": "logo-wobble", "with": {"target": "logo"}}]'); return { doc: out, diags, origins }; }
  const seen = new Set();
  presets.forEach((u, i) => {
    const at = `presets[${i}]`;
    if (!isObj(u) || typeof u.use !== 'string') { bad('E-ADDON', at, 'a preset use is {"use": "<name>", "as": "<id>", "with": {...}}'); return; }
    for (const k of Object.keys(u)) if (!['use', 'as', 'with'].includes(k)) bad('E-ADDON', `${at}.${k}`, `${k} is not a key of a preset use; a use holds use, as and with`);
    const name = parseName(u.use);
    if (!name) { bad('E-ADDON', `${at}.use`, `${u.use} is not an add-on name: a built-in preset is bare (wobble), an outside one owner.name@version (acme.shake@1.0.0)`); return; }
    if (isOutside(name.id) && !name.version) { bad('E-ADDON', `${at}.use`, `an outside preset is named with its version: write "${name.id}@<version>", the version its manifest and your about.trust.pins give`); return; }
    if (!isOutside(name.id) && name.version) { bad('E-ADDON', `${at}.use`, `a built-in preset is named without a version: write "${name.id}"`); return; }
    const found = manifestOf(u.use);
    if (!found || found.problem) { const [code, message] = found?.problem ?? ['E-ADDON', `no preset ${u.use}`]; bad(code, `${at}.use`, message); return; }
    const m = found.manifest;
    if (m.kind !== 'preset') { bad('E-ADDON', `${at}.use`, `${name.id} is a ${m.kind}, not a preset: name a ${m.kind} in needs`); return; }
    if (name.version && m.version !== name.version) { bad('E-ADDON', `${at}.use`, `${u.use}: the add-on's manifest is version ${m.version}; write ${name.id}@${m.version}`); return; }
    const as = u.as ?? name.id.split('.').pop();
    if (typeof as !== 'string' || !AS_RE.test(as) || as.length > 32) { bad('E-ADDON', `${at}.as`, `as ${JSON.stringify(as)} is not an id of at most 32 characters: it names what this use adds, for example "logo-wobble"`); return; }
    if (seen.has(as)) { bad('E-ID-DUPLICATE', `${at}.as`, `two preset uses are called ${as}: give each its own "as"`); return; }
    seen.add(as);
    const given = u.with ?? {};
    if (!isObj(given)) { bad('E-ADDON-INPUT', `${at}.with`, 'with is an object of the preset\'s inputs'); return; }
    const inputs = m.adds?.inputs ?? {};
    const values = { as };
    let ok = true;
    for (const k of Object.keys(given)) if (!own(inputs, k)) { ok = false; bad('E-ADDON-INPUT', `${at}.with.${k}`, `the preset ${name.id} has no input ${k}; it takes ${Object.keys(inputs).join(', ') || 'none'}`); }
    for (const [k, d] of Object.entries(inputs)) {
      const v = own(given, k) ? given[k] : d.initial;
      if (v === undefined) { ok = false; bad('E-ADDON-INPUT', `${at}.with`, `the preset ${name.id} needs the input ${k} (${d.type}${d.description ? `: ${d.description}` : ''}): add "${k}" to with`); continue; }
      const why = inputProblem(d, v);
      if (why) { ok = false; bad('E-ADDON-INPUT', `${at}.with.${k}`, `the preset ${name.id}'s input ${k} is ${JSON.stringify(v)}, but ${why}`); continue; }
      values[k] = v;
    }
    if (!ok) return;
    const provided = fill(m.adds.provides, values);
    const use = { preset: name.id, as, index: i };
    for (const [key, v] of Object.entries(provided)) merge(out, key, v, [key], use, bad, origins, at);
  });
  return { doc: out, diags, origins };
}

// Keys that would reach an object's prototype if set by assignment: never merged.
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
// The path of the first unsafe key inside a value, or null.
function unsafeKeyIn(v, p = []) {
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) { const r = unsafeKeyIn(v[i], [...p, i]); if (r) return r; } return null; }
  if (!isObj(v)) return null;
  for (const [k, x] of Object.entries(v)) { if (UNSAFE_KEYS.has(k)) return [...p, k]; const r = unsafeKeyIn(x, [...p, k]); if (r) return r; }
  return null;
}
function merge(target, key, v, p, use, bad, origins, at) {
  if (UNSAFE_KEYS.has(key)) { bad('E-ADDON', at, `the preset ${use.preset} (as ${use.as}) sets the key ${p.join('.')}: __proto__, constructor and prototype are never keys of a document`); return; }
  if (!own(target, key)) {
    const deep = unsafeKeyIn(v);
    if (deep) { bad('E-ADDON', at, `the preset ${use.preset} (as ${use.as}) sets the key ${[...p, ...deep].join('.')}: __proto__, constructor and prototype are never keys of a document`); return; }
    target[key] = structuredClone(v); origins.push({ path: p, use }); return;
  }
  const have = target[key];
  if (Array.isArray(have) && Array.isArray(v)) {
    for (const x of v) {
      if (p.length === 1 && p[0] === 'needs') { if (!have.includes(x)) { have.push(x); origins.push({ path: [...p, have.length - 1], use }); } continue; }
      have.push(structuredClone(x));
      origins.push({ path: [...p, have.length - 1], use });
    }
    return;
  }
  if (isObj(have) && isObj(v)) { for (const [k, x] of Object.entries(v)) merge(have, k, x, [...p, k], use, bad, origins, at); return; }
  bad('E-ADDON', at, `the preset ${use.preset} (as ${use.as}) sets ${p.join('.')}, which the document already has: give the use another "as", or remove the document's own`);
}

// The tokens of a finding's path ("clips/wobble/tracks/0", "clips.wobble.tracks[0]", "/clips/wobble").
export const pathTokens = (p) => String(p ?? '').split(/[/.[\]]+/).filter(Boolean);
// The use a finding at path p lies in, or null. origins: from expandPresets.
export function originOf(origins, p) {
  const t = pathTokens(p);
  let best = null;
  for (const o of origins || []) {
    if (o.path.length <= t.length && o.path.every((x, i) => String(x) === t[i]) && (!best || o.path.length > best.path.length)) best = o;
  }
  return best?.use ?? null;
}
// Findings named after the preset that added what they are about: "... (from the preset wobble, used as logoWobble)".
// origins: {file: origins}.
export function namePresets(diags, origins) {
  if (!origins || !Object.keys(origins).length) return diags;
  return diags.map(d => {
    const use = originOf(origins[d.file], d.path);
    return use ? { ...d, message: `${d.message} (from the preset ${use.preset}, used as ${use.as})`, preset: use.preset } : d;
  });
}
