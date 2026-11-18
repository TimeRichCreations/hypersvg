// The HyperSVG in a page, the lean entry (D45, D56, 10.14): the <hypersvg-asset> element and mountAsync. A page that
// places its HyperSVGs with integrity loads this module instead of asset-web.mjs; it then downloads no schemas and no
// validation code (schema/validate, check-document, drawing-check, drafts), and no kit or add-on machinery
// (src/kit.mjs, src/addons.mjs). Those come in by a dynamic import, only for a file placed without integrity.
// The package's ./asset-lean (D58). asset-web.mjs (the package's ./asset) re-exports all of this, with the synchronous
// mount() beside it.
//
//   <script type="module" src=".../engine/v2/web/asset-lean.mjs"></script>
//   <hypersvg-asset src="car.svg" integrity="sha256-..." length="1.4"></hypersvg-asset>
//
//   import { mountAsync } from '.../engine/v2/web/asset-lean.mjs';
//   const car = await mountAsync(element, svgBytes, { length: 1.4 }, { integrity: 'sha256-...' });
//
// - integrity (added after 2.0.0-next.0, D56): "sha256-" and the base64 SHA-256 of the file's exact bytes, as the
//   browser's Subresource Integrity. pack --asset prints it. The host stores it on its server after the full checker
//   passed the file once. A match skips the schema check; a mismatch is E-ASSET-INTEGRITY, nothing plays and nothing
//   of the file shows (D58). A digest inside the file is never a trust anchor: whoever edits the file can make those
//   again.
// - Without Web Crypto (a page not served over HTTPS or from localhost) the player hashes with a plain JavaScript
//   SHA-256. It gives the same value, so a match skips the schema check there too (D58).
// - The safety pass (src/asset-safety.mjs) always runs, with or without integrity, before anything plays: no script,
//   no foreign content, no event handler, no javascript: or outside address.
// - A pinned capability (D55, added after 2.0.0-next.0): a HyperSVG may name effects or physics in needs, pinned by
//   version and digest in about.trust.pins. It never carries the code. mountAsync and the element load the module from
//   the add-on address (addonBase, the attribute addon-base; by default the package's engine/v2/web/addons/), check
//   its digest, then play (on-demand-web.mjs). A missing module is E-ADDON-MISSING, a different digest E-ADDON-DIGEST;
//   nothing plays and the element shows what it holds (the rest pose of an <img>). The synchronous mount() cannot
//   load code, so it refuses such a file (E-ASSET).
// API labels (spec 10.16, D63), as the package's ./asset-lean: mountAsync, HyperSvgAsset, useSchemas, sharedSchemas,
// VERSION and elementVersion are stable; place, leanLoad and bundleCheck are internal. Options: schemas, partition,
// onError, timeLimits, integrity, faultBox, nonce, clock and onMove are stable; theme, options, hostWords and
// addonBase are experimental; test and modules are internal. The element: src, integrity and fault-box, the nonce
// property, input attributes, ready, host, inputs(), read(), set(), on(), the static version and the events
// hsvg:changed, hsvg:<output> and hsvg:error are stable; the attributes theme, addon-base and partition are
// experimental.
import { play } from './player-web.mjs';
import { readAsset, assetPackage } from '../src/asset.mjs';
import { readExperience } from '../src/read.mjs';
import { withUsedGrants } from '../src/grants-asked.mjs';
import { checkValue, checkContent } from '../src/runtime.mjs';
import { FORMAT } from '../src/limits.mjs';
import { assetSafety } from '../src/asset-safety.mjs';
import { verifyIntegrity } from '../src/integrity.mjs';
import { VERSION } from '../src/version.mjs';
import { addPlace } from './place-web.mjs';
import { errorDetail } from '../src/error-detail.mjs';
import { SCHEMAS_BASE, SCHEMAS, ADDONS_BASE } from './asset-schemas.mjs';
import { applyHostWords } from '../src/host-words.mjs';
import { hostColors } from '../src/host-colors.mjs';
import { assetNeeds, assetAddons, assetUsesSound } from '../src/on-demand.mjs';
import { loadAddons } from './on-demand-web.mjs';

export { VERSION };

const fault = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });
const TEXT = /\.(json|svg|csv|txt|vtt)$/;
const BOUNDS = ['type', 'minimum', 'maximum', 'step', 'enum', 'maxLength', 'contentType'];
const MAX = { maxBytes: FORMAT.dataBytesEach };

// Places a read asset ({id, drawing, files}) in element and plays it with mountPackage(element, pkg, options), the
// checked mount (mount-checked.mjs) or the lean one below. options: partition (default asset-<id>), onError, test,
// timeLimits; added after 2.0.0-next.0: theme (one of the asset's themes), options (host axes, 10.6), faultBox
// (false: no fault message), nonce (a strict CSP page), hostWords (src/host-words.mjs), clock and onMove (mount-web.mjs,
// 9.6); colors (experimental, the host's colours, 7.7.1; mount-web.mjs). Throws {code, message} and
// plays nothing when the asset is refused. The host API it returns has place(name) too (place-web.mjs).
// modules (internal): the capability records loaded for the asset's needs (D55); without them a need is refused.
export function place(element, asset, inputs, { partition = null, onError = null, test = false, timeLimits = null, faultBox = true, nonce = null, theme = null, options = {}, hostWords = null, clock = null, onMove = null, modules = null, colors = null } = {}, mountPackage) {
  const bad = Object.keys(asset.files).filter(p => !TEXT.test(p));
  if (bad.length) throw fault('E-ASSET', `an asset holds only its documents and drawings, not ${bad.join(', ')}`);
  let doc;
  try { doc = JSON.parse(asset.files['experience.json']); } catch { throw fault('E-ASSET', 'the asset has no experience.json'); }
  const needs = assetNeeds(asset.files);
  if (needs.length && !modules) throw fault('E-ASSET', `an asset needs no add-on or capability here; this one needs ${needs.join(', ')}: place it with mountAsync or <hypersvg-asset>, which load a pinned capability (D55)`);
  // The safety pass (D56): with or without integrity, before any markup reaches the page.
  const unsafe = assetSafety(asset.files);
  if (unsafe.length) throw fault(unsafe[0].code, unsafe.map(d => `${d.code} ${d.file} ${d.path}: ${d.message}`).join('; '), { diagnostics: unsafe });
  const decls = doc?.inputs && typeof doc.inputs === 'object' ? doc.inputs : {};
  // The host's values are the inputs' values at the start: checked here, written as their initial in this copy.
  const given = {};
  for (const [name, v] of Object.entries(inputs || {})) {
    const d = Object.hasOwn(decls, name) ? decls[name] : null;
    if (!d || d.kind === 'trigger') throw fault('E-REF-UNKNOWN', `${name} is not a knob or content field of the asset (${Object.keys(decls).join(', ') || 'it has none'})`);
    const wrong = d.kind === 'content' ? checkContent(d, v) : checkValue(d, v);
    if (wrong) throw fault(wrong[0], `${name}: ${wrong[1]}`);
    given[name] = structuredClone(v);
  }
  // The host's theme (7.1 host selector, added after 2.0.0-next.0): one of the themes the HyperSVG declares, each
  // contrast-checked by its author. It is written as the theme of this copy, and the player takes it as the host's pick,
  // so it wins over a theme the HyperSVG picks by input (7.1).
  if (theme !== null && theme !== undefined && !(typeof theme === 'string' && Object.hasOwn(doc?.themes || {}, theme))) {
    throw fault('E-AXIS-INPUT', `theme ${JSON.stringify(theme)} is not one of the HyperSVG's themes (${Object.keys(doc?.themes || {}).join(', ') || 'it declares none'})`);
  }
  const files = { ...asset.files };
  if (Object.keys(given).length || theme != null) {
    const copy = structuredClone(doc);
    if (theme != null) copy.theme = theme;
    for (const [name, v] of Object.entries(given)) copy.inputs[name].initial = v;
    files['experience.json'] = JSON.stringify(copy);
  }
  const host = mountPackage(element, assetPackage({ id: asset.id, files }), { partition: partition ?? `asset-${asset.id}`, onError, test, timeLimits, faultBox, nonce, options, hostWords, clock, onMove, modules, theme, colors });
  // A stored knob comes back after its initial (5.3.2); the host's value is the later change.
  for (const [name, v] of Object.entries(given)) if (JSON.stringify(host.read(name)) !== JSON.stringify(v)) host.set(name, v);
  host.inputs = () => Object.entries(decls).map(([name, d]) => ({
    name, kind: d.kind, ...Object.fromEntries(BOUNDS.filter(k => d[k] !== undefined).map(k => [k, structuredClone(d[k])])),
    ...(d.initial !== undefined ? { initial: structuredClone(d.initial) } : {}),
    ...(d.kind !== 'trigger' && d.contentType !== 'freeText' ? { value: host.read(name) } : {}),
  }));
  host.outputs = () => Object.entries(doc.outputs || {}).filter(([, o]) => o?.kind === 'event' || o?.kind === 'record').map(([name, o]) => ({ name, kind: o.kind }));
  return host;
}

// ---------- the lean mount: a file that matched its integrity ----------
// The reader only parses (src/read.mjs); the checker already passed this exact file on the host's side. The grants
// written from use are added as the checked load adds them (src/grants-asked.mjs). A reader error, a kit or an add-on
// preset refuses: an asset uses none (2.13).
export function leanLoad(source) {
  let preset = null;
  const r = readExperience(source, null, { presets: { expand(doc, file) { preset ??= file; return { doc, diags: [] }; } } });
  if (preset) return { experience: null, diags: [{ code: 'E-ASSET', file: preset, message: 'an asset uses no add-on preset' }] };
  const errors = r.diags.filter(d => d.code.startsWith('E-'));
  if (errors.length) return { ...r, experience: null, diags: errors };
  if (r.experience?.doc) { const g = withUsedGrants(r.experience); r.experience.derivedGrants = g.derived; if (Object.keys(g.derived).length) r.experience.doc.grants = g.grants; }
  return r;
}
function leanMount(container, pkg, { partition, onError, test, timeLimits, faultBox, nonce, options, hostWords, clock, onMove, modules, theme = null, colors = null }) {
  const dec = new TextDecoder();
  const files = {};
  for (const [p, b] of Object.entries(pkg)) if (TEXT.test(p) && p !== 'package.json') files[p] = dec.decode(b);
  const assets = (p) => { const b = pkg[p]; if (!b) throw new Error(`no member ${p}`); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
  const loaded = leanLoad({ read: (rel) => (rel in files ? files[rel] : null) });
  const language = loaded.experience ? applyHostWords(loaded.experience, hostWords) : null; // E-WORDS before anything plays
  const state = play(container, { files, schemas: null, assets, partition, onError, test, members: pkg, load: () => loaded, timeLimits, faultBox, nonce, options, language, clock, onMove, modules, theme, colors, checkColors: hostColors });
  if (!state.player) throw fault(state.stopped.code, state.stopped.message, { address: state.stopped.address });
  return addPlace(state);
}
// The checked mount (mount-checked.mjs with src/load-asset.mjs), loaded only when a file is placed without integrity.
// It carries the schema checker but no kit or add-on code, which a HyperSVG cannot use (2.13).
// The one-file player gives both parts at once (asset-bundle-entry.mjs), so it makes no second request.
let bundled = null;
export function bundleCheck(mountChecked, loadAsset) { bundled = [{ mountChecked }, { loadAsset }]; }
async function checkedMount(schemas) {
  const [{ mountChecked }, { loadAsset }] = bundled ?? await Promise.all([import('./mount-checked.mjs'), import('../src/load-asset.mjs')]);
  return (element, pkg, options) => mountChecked(element, pkg, { ...options, schemas }, loadAsset);
}
const needSchemas = (schemas) => { if (!schemas || typeof schemas !== 'object' || !schemas.kinds) throw new TypeError('mount needs options.schemas (spec/2.0/schemas): an asset is checked before it plays'); };
const textOf = (bytes) => new TextDecoder().decode(bytes);

// Places a HyperSVG and plays it; resolves to the host API, as mount() returns it. asset: the file's text, or its exact
// bytes (a Uint8Array or an ArrayBuffer; the integrity is the hash of these bytes, of the text's UTF-8 otherwise).
// options: integrity, schemas, partition, onError, test, timeLimits, and place()'s options above.
// - With integrity: the file is hashed and compared; on a match the safety pass runs and the file plays with no schema
//   check, so schemas are not needed, with or without Web Crypto.
// - Without integrity: as mount(), with the full check; schemas are needed.
// - addonBase (added after 2.0.0-next.0, D55): where the modules of pinned capabilities are served; by default the
//   package's engine/v2/web/addons/.
export async function mountAsync(element, asset, inputs = {}, { integrity = null, schemas = null, addonBase = null, ...options } = {}) {
  const bytes = typeof asset === 'string' ? new TextEncoder().encode(asset) : asset instanceof ArrayBuffer ? new Uint8Array(asset) : asset;
  if (!(bytes instanceof Uint8Array)) throw fault('E-ASSET', 'a HyperSVG is text or its bytes');
  const text = typeof asset === 'string' ? asset : textOf(bytes);
  if (integrity == null) {
    const a = readAsset(text, MAX); needSchemas(schemas);
    const [modules, s] = await Promise.all([addonsOf(a, addonBase), withCapabilities(schemas, assetNeeds(a.files)), soundFor(a)]);
    return place(element, a, inputs, { ...options, modules }, await checkedMount(s));
  }
  await verifyIntegrity(bytes, integrity);
  const a = readAsset(text, MAX);
  const [modules] = await Promise.all([addonsOf(a, addonBase), soundFor(a)]);
  return place(element, a, inputs, { ...options, modules }, leanMount);
}
// The audio code (audio-web.mjs, added after 2.0.0-next.0), loaded only for an asset that uses sound. It gives itself
// to the player before the asset plays, so the first sound plays at the first gesture, as before. The one-file
// player holds it already.
const soundFor = (asset) => (!bundled && assetUsesSound(asset.files) ? import('./audio-web.mjs') : null);
// The capability records an asset pins (D55), loaded and checked; null when it needs none. Throws E-ASSET for a need it
// cannot name, E-ADDON-MISSING or E-ADDON-DIGEST.
async function addonsOf(asset, base) {
  const needs = assetNeeds(asset.files);
  if (!needs.length) return null;
  let doc = null; try { doc = JSON.parse(asset.files['experience.json']); } catch { /* place() refuses it */ }
  let at = ADDONS_BASE;
  if (base != null) { try { at = new URL(base, globalThis.document?.baseURI); } catch { at = String(base); } } // a relative address is the page's
  return loadAddons(assetAddons(needs, doc), at);
}
// The schemas with the grammar of the capabilities an asset names (spec/2.0/schemas/capabilities/<id>.schema.json),
// fetched beside the core schemas when the host's set lacks one.
async function withCapabilities(schemas, ids, base = SCHEMAS_BASE) {
  const missing = ids.filter(id => !schemas.capabilities?.[id]);
  if (!missing.length) return schemas;
  const got = await Promise.all(missing.map(id => fetch(new URL(`../capabilities/${id}.schema.json`, base)).then((r) => { if (!r.ok) throw fault('E-ASSET', `cannot load the schema of ${id} (${r.status})`); return r.json(); })));
  return { ...schemas, capabilities: { ...schemas.capabilities, ...Object.fromEntries(missing.map((id, i) => [id, got[i]])) } };
}

// ---------- one copy of the schemas for the page ----------
// The checker's schemas for an asset (the core document kinds an asset may hold, the document envelope and the drawing
// rules), fetched once from the package's own spec/2.0/schemas, or given by the host with useSchemas. A file placed
// with integrity does not need them.
let shared = SCHEMAS ? Promise.resolve(SCHEMAS) : null; // the one-file player holds them
const KINDS = ['experience', 'scene', 'component', 'shell'];
export function useSchemas(schemas) { shared = Promise.resolve(schemas); }
export function sharedSchemas(base = SCHEMAS_BASE) {
  const get = (file) => fetch(new URL(file, base)).then((r) => { if (!r.ok) throw fault('E-ASSET', `cannot load the schema ${file} (${r.status})`); return r.json(); });
  return (shared ??= Promise.all([...KINDS.map(k => get(`${k}.schema.json`)), get('document.schema.json'), get('drawing.rules.json')])
    .then((all) => ({ kinds: Object.fromEntries(KINDS.map((k, i) => [k, all[i]])), document: all[KINDS.length], drawing: all[KINDS.length + 1], capabilities: {}, addons: {} })));
}

// ---------- <hypersvg-asset src="car.svg" length="1.4" colour="ocean"> ----------
// Attributes set the declared inputs by name (case does not matter; roof-open or roofopen sets roofOpen): a number
// is read as a number, a boolean is true when present (unless "false"), text is as written. A change of attribute
// sets the input again, so the latest change wins; removing it gives back the declared initial value. src,
// integrity and addon-base (D55) are the element's own: a change of one places the file again. The element:
// - ready: a promise of the host API; inputs() lists the inputs (empty until ready); set(name, value), read(name);
//   on(name, fn), as the host API's on (waits until ready);
// - sends each change of an input as the DOM event hsvg:changed ({name, value, by}) and each of the asset's output
//   events and records as hsvg:<name>; a refusal as hsvg:error ({code, message}), with data-hsvg-refused on the element.
// Until it plays, the element shows what it holds (an <img> of the same SVG shows the rest pose). A file that matched
// its integrity but is refused later, and that the element holds nothing for, is shown as a still picture: an
// <img data-hsvg-still> with a blob: address, which runs no script and loads nothing. A file that does not match shows
// nothing: the host never approved it (D58). Markup from a refused file never enters the page.
const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const attrsOf = (name) => [...new Set([name.toLowerCase(), kebab(name)])];
const OWN = ['src', 'integrity', 'addon-base'];
// The element's own options (added after 2.0.0-next.0), unless the HyperSVG has an input of that name, which the
// attribute then sets: theme (one of its themes), fault-box="hidden" (no fault message; hsvg:error still says it),
// partition (experimental, D63): the partition that keys this copy's stored values (10.6), 1 to 128 of A-Z a-z 0-9 .
// _ -. Without it every copy of one HyperSVG on a page uses asset-<id>, so copies share their stored values.
// colors (experimental, 7.7.1): the host's colours as CSS-like text, "accent: #d84315; surface: #ffffff". The colors
// property reads it as an object and sets it from one (null removes it). A change places the file again.
const OPTS = ['theme', 'fault-box', 'colors', 'partition'];
// "role: #rrggbb; ..." as {role: value}. An entry without a colon keeps an empty value, so the check names it.
export function colorsText(text) {
  if (text === null || text === undefined) return null;
  const out = {};
  for (const part of String(text).split(';')) {
    const at = part.indexOf(':');
    const role = (at < 0 ? part : part.slice(0, at)).trim();
    if (role) out[role] = at < 0 ? '' : part.slice(at + 1).trim();
  }
  return out;
}
function parsed(d, raw) {
  if (d.type === 'number') return Number(raw);
  if (d.type === 'boolean') return raw !== 'false';
  return raw;
}
const load = (src) => fetch(new URL(src, document.baseURI)).then((r) => { if (!r.ok) throw fault('E-ASSET', `cannot load ${src} (${r.status})`); return r; });

const Base = typeof HTMLElement === 'function' ? HTMLElement : class {};
export class HyperSvgAsset extends Base {
  static version = VERSION; // the engine version of the copy that defined the element
  constructor() { super(); this._host = null; this._decls = {}; this._waiting = []; this._run = 0; this.ready = null; }
  connectedCallback() { if (!this._host && !this._loading) this._start(); }
  disconnectedCallback() { queueMicrotask(() => { if (!this.isConnected) this._stop(); }); }
  get host() { return this._host; }
  get colors() { return colorsText(this.getAttribute('colors')); }
  set colors(v) { if (v === null || v === undefined) this.removeAttribute('colors'); else this.setAttribute('colors', typeof v === 'string' ? v : Object.entries(v).map(([k, c]) => `${k}: ${c}`).join('; ')); }
  inputs() { return this._host ? this._host.inputs() : []; }
  read(name) { if (!this._host) throw fault('E-HOST-CLOSED', 'the asset is not playing yet; await element.ready'); return this._host.read(name); }
  set(name, value) { if (!this._host) throw fault('E-HOST-CLOSED', 'the asset is not playing yet; await element.ready'); return this._host.set(name, value); }
  on(name, fn) {
    if (this._host) return this._host.on(name, fn);
    const w = { name, fn, off: null }; this._waiting.push(w);
    return () => { w.fn = null; w.off?.(); };
  }
  _isInput(attr) { return Object.keys(this._decls).some(n => this._decls[n].kind !== 'trigger' && attrsOf(n).includes(attr)); }
  _attrInputs() {
    const out = {};
    for (const [name, d] of Object.entries(this._decls)) {
      if (d.kind === 'trigger') continue;
      const a = attrsOf(name).find(x => !OWN.includes(x) && this.hasAttribute(x));
      if (a !== undefined) out[name] = parsed(d, this.getAttribute(a));
    }
    return out;
  }
  _start() {
    const run = ++this._run;
    this._loading = true;
    this.removeAttribute('data-hsvg-refused');
    let bytes = null; let matched = false;
    const integrity = this.getAttribute('integrity');
    this.ready = (async () => {
      const src = this.getAttribute('src');
      if (!src) throw fault('E-ASSET', '<hypersvg-asset> needs src, the address of a HyperSVG');
      let text; let mountPackage; let asset;
      const addonBase = this.getAttribute('addon-base');
      if (integrity === null) {
        let schemas;
        [text, schemas] = await Promise.all([load(src).then(r => r.text()), sharedSchemas()]);
        if (run !== this._run) return null;
        asset = readAsset(text, MAX);
        mountPackage = await checkedMount(await withCapabilities(schemas, assetNeeds(asset.files)));
      } else {
        bytes = new Uint8Array(await (await load(src)).arrayBuffer());
        await verifyIntegrity(bytes, integrity);
        matched = true;
        text = textOf(bytes);
        asset = readAsset(text, MAX);
        mountPackage = leanMount;
      }
      const [modules] = await Promise.all([addonsOf(asset, addonBase), soundFor(asset)]);
      if (run !== this._run) return null;
      try { this._decls = JSON.parse(asset.files['experience.json'])?.inputs || {}; } catch { this._decls = {}; }
      // A box to play in: a block, and the shown drawing's proportions when the page gives it no height.
      if (getComputedStyle(this).display === 'inline') this.style.display = 'block';
      const vb = /\bviewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(asset.files[asset.drawing]);
      if (!this.clientHeight && vb) this.style.aspectRatio = `${vb[1]} / ${vb[2]}`;
      const stage = document.createElement('div');
      stage.style.cssText = 'position:relative;width:100%;height:100%';
      const fallback = [...this.childNodes];
      this.replaceChildren(stage);
      let host;
      const opt = (a) => (this.hasAttribute(a) && !this._isInput(a) ? this.getAttribute(a) : null);
      try { host = place(stage, asset, this._attrInputs(), { onError: (d) => this._error(d), theme: opt('theme'), colors: colorsText(opt('colors')), partition: opt('partition'), faultBox: opt('fault-box') !== 'hidden', nonce: this.nonce || null, modules }, mountPackage); } catch (e) { this.replaceChildren(...fallback); throw e; }
      this._host = host;
      host.on('hsvg.changed', (e) => this._send('changed', e.detail));
      for (const o of host.outputs()) host.on(o.name, (e) => this._send(o.name, e.detail));
      for (const w of this._waiting.splice(0)) if (w.fn) w.off = host.on(w.name, w.fn);
      this._watch = new MutationObserver((records) => this._changed(records));
      this._watch.observe(this, { attributes: true });
      return host;
    })().catch((e) => {
      if (run === this._run) {
        if (matched && !this.children.length) this._still(bytes);
        this.setAttribute('data-hsvg-refused', e.code || 'error'); this._error({ code: e.code || null, message: e.message });
      }
      throw e;
    }).finally(() => { if (run === this._run) this._loading = false; });
    this.ready.catch(() => {}); // a refusal is reported as hsvg:error; awaiting ready still sees it
  }
  // The still picture of a refused file: the browser draws it as an image, which runs no script and loads nothing.
  _still(bytes) {
    try {
      this._stillUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/svg+xml' }));
      const img = document.createElement('img');
      img.src = this._stillUrl; img.alt = ''; img.setAttribute('data-hsvg-still', '');
      img.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain';
      this.replaceChildren(img);
    } catch { /* no picture then */ }
  }
  _changed(records) {
    for (const r of records) {
      if (OWN.includes(r.attributeName) || (OPTS.includes(r.attributeName) && !this._isInput(r.attributeName))) { this._stop(); this._start(); return; }
      const name = Object.keys(this._decls).find(n => this._decls[n].kind !== 'trigger' && attrsOf(n).includes(r.attributeName));
      if (!name) continue;
      const d = this._decls[name];
      const raw = this.getAttribute(r.attributeName);
      try { this._host.set(name, raw === null ? structuredClone(d.initial) : parsed(d, raw)); } catch (e) { this._error({ code: e.code || null, message: e.message }); }
    }
  }
  // hsvg:error's detail always has code and message (D63, errorDetail): a refusal {code, message}; a fault while
  // playing adds source and address; a delivery failure adds source; a sound that cannot play adds source and path.
  _send(name, detail) { this.dispatchEvent(new CustomEvent(`hsvg:${name}`, { detail })); }
  _error(d) { this._send('error', errorDetail(d)); }
  _stop() {
    this._run++;
    this._watch?.disconnect(); this._watch = null;
    try { this._host?.destroy(); } catch { /* already closed */ }
    this._host = null; this._loading = false;
    if (this._stillUrl) { URL.revokeObjectURL(this._stillUrl); this._stillUrl = null; }
    this.replaceChildren();
  }
}
// The version of the player that defined <hypersvg-asset> on this page, or null when none did. A second copy of the
// player finds the element already defined and uses the first copy; it says so once when the versions differ.
export function elementVersion() {
  const c = typeof customElements !== 'undefined' ? customElements.get('hypersvg-asset') : null;
  return c ? (c.version ?? 'unknown') : null;
}
if (typeof customElements !== 'undefined') {
  if (!customElements.get('hypersvg-asset')) customElements.define('hypersvg-asset', HyperSvgAsset);
  else if (elementVersion() !== VERSION) console.warn(`hsvg: <hypersvg-asset> is already defined by player ${elementVersion()}; this copy (${VERSION}) is not used for it`);
}
