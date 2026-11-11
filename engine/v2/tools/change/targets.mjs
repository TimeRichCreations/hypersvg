// Check 4 (reach, A9.2): what each address of an edit-time change names, its current value (for check 3) and where
// a new value is written (4.7 rule 8). The five targets: an exposed input (`@<tag>` for one language of a text
// field), a waiver (`<document id>/waivers`), a review (`<document id>/review`), a kit experience's kit pin
// (`<experience id>/kit`) and a document path with a JSON pointer (`blocks/ride-out.json#/inputs/windStrength`).
import { literalOf, kitPin } from '../../src/kit.mjs';
import { isTextDecl, slotFormula } from '../../src/formula.mjs';
import { faceOf, promoted } from './rights.mjs';
import { join, dirOf, readWords } from './folder.mjs';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const TAG = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/;
const diag = (code, address, message) => ({ code, address, message });
const ABSENT = Symbol('absent');
export { ABSENT };

// A string as a formula literal: single quotes, with \\ and \' escaped (5.6.1).
export const quote = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}'`;
// A literal value as it is written into a `with`: numbers and booleans as JSON, objects as they are, and a string as
// a formula literal, quoted (D36).
export const withForm = (v) => (typeof v !== 'string' ? v : quote(v));
const WORD = /^\s*words\.([A-Za-z][A-Za-z0-9]*)\s*$/;

// JSON pointers (RFC 6901).
export function pointerTokens(p) {
  if (p === '') return [];
  if (!p.startsWith('/')) return null;
  return p.slice(1).split('/').map(t => t.replace(/~1/g, '/').replace(/~0/g, '~'));
}
export function getAt(root, path) {
  let x = root;
  for (const k of path) {
    if (Array.isArray(x)) { if (!/^(0|[1-9][0-9]*)$/.test(k) || +k >= x.length) return ABSENT; x = x[+k]; } else if (isObj(x)) { if (!Object.hasOwn(x, k)) return ABSENT; x = x[k]; } else return ABSENT;
  }
  return x;
}
// Sets (or, with ABSENT, removes) the value at path, making missing objects on the way.
export function setAt(root, path, v) {
  let x = root;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    if (Array.isArray(x)) x = x[+k];
    else { if (!isObj(x[k]) && !Array.isArray(x[k])) x[k] = {}; x = x[k]; }
  }
  const last = path[path.length - 1];
  if (Array.isArray(x)) {
    if (v === ABSENT) x.splice(+last, 1); else if (last === '-' || +last === x.length) x.push(v); else x[+last] = v;
  } else if (v === ABSENT) delete x[last]; else x[last] = v;
}

// ctx: {files, read(rel) -> text|null, rel, doc (the target document as in the file), exp (the loaded experience, or
// null for a kit folder), kitFolder, language}.
// Returns {target} or {diag}. A target has kind, rightsKey (inputs), current (ABSENT when there is none) and the
// facts check 5, 6 and 8 need.
export function resolve(change, ctx) {
  const address = change.address;
  if (address.includes('#')) return pointer(change, ctx);
  const at = address.indexOf('@');
  const tag = at >= 0 ? address.slice(at + 1) : null;
  const plain = at >= 0 ? address.slice(0, at) : address;
  if (tag !== null && !TAG.test(tag)) return { diag: diag('E-REF-UNKNOWN', address, `@${tag} is not a language tag`) };
  const segs = plain.split('/');
  const { doc } = ctx;
  if (segs[0] !== doc.id) return { diag: diag('E-REF-UNKNOWN', address, `the address starts with ${segs[0]}, not the target ${doc.id}`) };
  if (segs.length === 2 && tag === null) {
    if (segs[1] === 'waivers') return { target: { kind: 'waiver', current: waiverCurrent(change, doc) } };
    if (segs[1] === 'review') return { target: { kind: 'review', current: ABSENT } };
    if (segs[1] === 'kit' && kitPin(doc)) return { target: { kind: 'kit', current: doc.kit } };
  }
  if (segs.length === 2) return inputOf(change, ctx, segs[1], tag, plain);
  if (segs.length === 3) return innerInput(change, ctx, segs[1], segs[2], tag, plain);
  if (segs.length > 3 && isPathStart(ctx, segs[1])) return { diag: diag('E-SEAL', address, `${plain} reaches inside a sealed use; change it through the input its container exposes`) };
  return { diag: diag('E-REF-UNKNOWN', address, `${plain} names no input, waiver, review, kit pin or pointer of ${doc.id}`) };
}
const isPathStart = (ctx, s) => (ctx.doc.uses || []).some(u => u?.id === s) || isObj(ctx.doc.story?.scenes) && s in ctx.doc.story.scenes;

// The definitions promotions resolve against; an experience made without a kit promotes from its scenes (4.7).
const defsOf = (ctx) => {
  const defs = { ...(ctx.exp?.kit?.blocks || {}), ...(ctx.exp?.blocks || {}) };
  if (ctx.exp && !ctx.exp.kit) for (const [id, s] of Object.entries(ctx.exp.scenes || {})) defs[`scene:${id}`] = s;
  return defs;
};

// `<document>/<input>`: a kit input of a kit experience, written in its top-level `with`; or the document's own input
// (its `initial`) or promoted input (the promote entry's `initial`).
function inputOf(change, ctx, name, tag, plain) {
  const { doc, exp } = ctx;
  const kit = exp?.kit && kitPin(doc) ? exp.kit : null;
  if (kit) {
    const decl = kit.doc.inputs?.[name];
    if (!decl) return { diag: diag('E-REF-UNKNOWN', change.address, `${name} is not an input of kit ${kit.doc.id}`) };
    return withTarget(change, ctx, plain, decl, ['with', name], doc.with?.[name], decl.initial, tag);
  }
  const face = faceOf(doc, defsOf(ctx));
  const f = face[name];
  if (f) {
    if (f.where === 'own') return valueTarget(change, ctx, plain, f.decl, ['inputs', name, 'initial'], tag);
    const p = doc.promote[f.promote];
    return valueTarget(change, ctx, plain, f.decl, ['promote', String(f.promote), 'initial'], tag, p.initial === undefined ? f.decl.initial : undefined);
  }
  const sealed = doc.seal === 'sealed' || (ctx.kitFolder && doc.kind !== 'kit' && doc.seal === undefined);
  if (isObj(doc.values?.[name]) || isObj(doc.computed?.[name]) || doc.computed?.[name] !== undefined) {
    if (sealed) return { diag: diag('E-SEAL', change.address, `${name} is a body value of the sealed ${doc.id}; only its inputs are reachable, except by a kit change`) };
    if (!isObj(doc.values?.[name])) return { diag: diag('E-REF-UNKNOWN', change.address, `${name} is computed; it has no stored value to change`) };
    return { target: { kind: 'value', rightsKey: plain, decl: doc.values[name], path: ['values', name, 'initial'], current: getAt(doc, ['values', name, 'initial']) } };
  }
  return { diag: diag('E-REF-UNKNOWN', change.address, `${doc.id} has no input ${name}`) };
}

// `<document>/<scene key or use id>/<input>`: in a kit experience, a scene use's input, written in its `with`.
// Anywhere else an inner input is reached only through the promoted address (E-SEAL, 4.7 rule 6).
function innerInput(change, ctx, key, name, tag, plain) {
  const { doc, exp } = ctx;
  const kit = exp?.kit && kitPin(doc) ? exp.kit : null;
  const scene = doc.story?.scenes?.[key];
  if (kit && isObj(scene)) {
    const def = kit.blocks[scene.use];
    if (!def) return { diag: diag('E-REF-UNKNOWN', change.address, `scene ${key} uses ${scene.use}, which kit ${kit.doc.id} does not define`) };
    const f = faceOf(def.doc, defsOf(ctx))[name];
    if (!f) {
      if (def.doc.values?.[name] !== undefined || def.doc.computed?.[name] !== undefined) return { diag: diag('E-SEAL', change.address, `${name} is a body value of ${scene.use}; only its inputs are reachable, except by a kit change`) };
      return { diag: diag('E-REF-UNKNOWN', change.address, `${scene.use} has no input ${name}`) };
    }
    return withTarget(change, ctx, plain, f.decl, ['story', 'scenes', key, 'with', name], scene.with?.[name], f.decl.initial, tag);
  }
  const use = (doc.uses || []).find(u => u?.id === key);
  const promotedAs = (doc.promote || []).find(p => p?.from === `${key}/${name}`);
  if (promotedAs) return { diag: diag('E-SEAL', change.address, `${key}/${name} is promoted; address it as ${doc.id}/${promotedAs.as || name}`) };
  if (use || (!kit && scene !== undefined)) return { diag: diag('E-SEAL', change.address, `${key}/${name} is not exposed by ${doc.id}; no container promotes it, so only a kit change can change it (4.7)`) };
  return { diag: diag('E-REF-UNKNOWN', change.address, `${doc.id} has no scene or use ${key}`) };
}

// An input whose value is in a `with`: a literal (written back quoted), a language object, or one word.
function withTarget(change, ctx, plain, decl, path, raw, initial, tag) {
  const base = { kind: 'input', rightsKey: plain, decl, tag, path, form: 'with' };
  if (raw === undefined) {
    if (tag !== null && tag !== ctx.language) return { diag: diag('E-REF-UNKNOWN', change.address, `${plain} has no wording in ${tag} here; give the input a language object first`) };
    const cur = isObj(initial) && tag !== null ? (initial[tag] ?? ABSENT) : initial === undefined ? ABSENT : initial;
    return { target: { ...base, current: cur } };
  }
  if (isObj(raw)) {
    if (tag === null) return { target: { ...base, current: raw } };
    return { target: { ...base, path: [...path, tag], form: 'literal', current: raw[tag] ?? ABSENT } };
  }
  const src = slotFormula(decl, raw); // a text input's plain words (D31.1)
  const lit = src === null ? null : literalOf(src);
  if (lit) {
    if (tag !== null && tag !== ctx.language) return { diag: diag('E-REF-UNKNOWN', change.address, `${plain} has one wording, in ${ctx.language}; ${tag} comes from words`) };
    return { target: { ...base, current: lit.value } };
  }
  const word = WORD.exec(String(src));
  if (word && tag !== null) return wordsTarget(change, ctx, plain, decl, word[1], tag);
  // Not a literal: 4.7 rule 8 refuses the edit at check 6 (E-RIGHTS).
  return { target: { ...base, current: ABSENT, notLiteral: String(raw) } };
}

// An input whose value is in the document itself (`initial`, a promote entry's `initial`).
function valueTarget(change, ctx, plain, decl, path, tag, fallback) {
  const raw = getAt(ctx.doc, path);
  const base = { kind: 'input', rightsKey: plain, decl, tag, path, form: 'literal' };
  const cur = raw === ABSENT ? (fallback === undefined ? ABSENT : fallback) : raw;
  if (tag === null) return { target: { ...base, current: cur } };
  if (isObj(cur)) return { target: { ...base, path: [...path, tag], current: cur[tag] ?? ABSENT } };
  if (tag === ctx.language) return { target: { ...base, current: cur } };
  return { diag: diag('E-REF-UNKNOWN', change.address, `${plain} has one wording, in ${ctx.language}; ${tag} comes from words`) };
}

// `@<tag>` on an input that reads one word: the word in the document's own words file for that language.
function wordsTarget(change, ctx, plain, decl, id, tag) {
  const { doc, rel } = ctx;
  const entry = Object.entries(doc.resources || {}).find(([, r]) => r?.kind === 'words' && r.language === tag && typeof r.file === 'string');
  if (!entry) return { diag: diag('E-REF-UNKNOWN', change.address, `${doc.id} has no words file in ${tag} for ${plain}`) };
  const fileRel = join(dirOf(rel), entry[1].file);
  const text = fileRel === null ? null : ctx.read(fileRel);
  const list = text == null ? null : readWords(text);
  if (!list) return { diag: diag('E-REF-UNKNOWN', change.address, `the words file ${entry[1].file} cannot be read`) };
  const row = list.find(([k]) => k === id);
  let current = row ? row[1] : ABSENT;
  if (current === ABSENT) { const kitWord = ctx.exp?.kit?.words?.[tag]?.[id]; if (typeof kitWord === 'string') current = kitWord; }
  return { target: { kind: 'input', rightsKey: plain, decl, tag, form: 'words', words: { resource: entry[0], file: fileRel, id }, current } };
}

// The waiver entry `old` names, or ABSENT when there is none.
// For an addition, the entry that already waives the same rule for the same subject and options, if any.
function waiverCurrent(change, doc) {
  const list = Array.isArray(doc.waivers) ? doc.waivers : [];
  const key = waiverKey('old' in change ? change.old : change.new);
  if (key === null) return ABSENT;
  const found = list.find(w => waiverKey(w) === key);
  return found === undefined ? ABSENT : found;
}
// Two waivers of one rule are told apart by subject, size, language and theme (8.5).
export const waiverKey = (w) => (isObj(w) ? JSON.stringify([w.rule, w.subject ?? null, w.size ?? null, w.language ?? null, w.theme ?? null]) : null);

// `<path>#<pointer>`: a document path relative to the folder and a JSON pointer into it.
function pointer(change, ctx) {
  const [file, ptr] = [change.address.slice(0, change.address.indexOf('#')), change.address.slice(change.address.indexOf('#') + 1)];
  const tokens = pointerTokens(ptr);
  const rel = join('', file);
  if (tokens === null || !tokens.length) return { diag: diag('E-REF-UNKNOWN', change.address, `${ptr} is not a JSON pointer into the document`) };
  if (rel !== ctx.rel) return { diag: diag('E-REF-UNKNOWN', change.address, `${file} is not the target document ${ctx.doc.id} (${ctx.rel}); a request changes one document`) };
  const parent = getAt(ctx.doc, tokens.slice(0, -1));
  if (parent === ABSENT || !(isObj(parent) || Array.isArray(parent))) return { diag: diag('E-REF-UNKNOWN', change.address, `${ptr}: its parent does not exist`) };
  // In a sealed definition only inputs are reachable, except by a kit change (4.6).
  if (!ctx.kitFolder && ctx.doc.seal === 'sealed' && tokens[0] !== 'inputs') return { diag: diag('E-SEAL', change.address, `${ctx.doc.id} is sealed: a pointer change outside its inputs is a kit change`) };
  const last = tokens[tokens.length - 1];
  const current = last === '-' ? ABSENT : getAt(ctx.doc, tokens);
  return { target: { kind: 'pointer', tokens, current, kitChange: ctx.kitFolder, promotes: tokens[0] === 'promote' } };
}

// Whether a promote entry's `from` names a direct child's input (E-PROMOTE otherwise), on the document after the change.
export function promoteOk(doc, entry, defs) { return promoted(doc, entry, defs) !== null; }
