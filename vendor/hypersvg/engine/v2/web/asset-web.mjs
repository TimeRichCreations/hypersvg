// The HyperSVG in a page (D45, 10.14): mount(element, assetSvg, inputs) and the <hypersvg-asset> element.
// The npm package exports it as ./asset. It is not part of the core bundle a packed page carries.
//
//   import { mount } from '@hypersvg/core/asset';
//   const car = mount(document.querySelector('#car'), svgText, { length: 1.4, colour: 'ocean' }, { schemas });
//   car.on('hsvg.changed', (e) => console.log(e.detail));   // {name, value, by}
//
//   <script type="module" src=".../engine/v2/web/asset-web.mjs"></script>
//   <hypersvg-asset src="car.svg" length="1.4" colour="ocean"></hypersvg-asset>
//
// - The player checks what it is handed before anything plays: the asset record and every member's digest
//   (src/asset.mjs: a changed file is E-PACKAGE-DIGEST), then every document and drawing with the schemas, as mount
//   checks a package (10.12). A HyperSVG with anything an asset cannot hold (a need, a file that is not text) is
//   E-ASSET. Nothing is fetched by mount itself.
// - inputs: {name: value} for the asset's declared inputs (knobs and content fields), each checked by type and bounds.
//   They are the inputs' values at the start. Later changes go through set; a person's drawn control changes the
//   same knob; the latest change wins (5.11, D45).
// - The result is the host API (10.6) plus inputs(): each input's name, kind, type, bounds and value, so any panel
//   can build itself.
// - Many assets on one page share one player: this module, the engine's code and one copy of the schemas. Each
//   placed asset is its own experience with its own state.
import { mount as mountPackage } from './mount-web.mjs';
import { readAsset, assetPackage } from '../src/asset.mjs';
import { checkValue, checkContent } from '../src/runtime.mjs';
import { FORMAT } from '../src/limits.mjs';

const fault = (code, message) => Object.assign(new Error(message), { code });
const TEXT = /\.(json|svg|csv|txt|vtt)$/;
const BOUNDS = ['type', 'minimum', 'maximum', 'step', 'enum', 'maxLength', 'contentType'];

// Places a HyperSVG (its text) in element and plays it. options: schemas (required, as for mount), partition (default
// asset-<id>), onError, test, timeLimits. Throws {code, message} and plays nothing when the asset is refused.
export function mount(element, assetSvg, inputs = {}, options = {}) {
  return place(element, readAsset(assetSvg, { maxBytes: FORMAT.dataBytesEach }), inputs, options);
}

function place(element, asset, inputs, { schemas = null, partition = null, onError = null, test = false, timeLimits = null } = {}) {
  if (!schemas || typeof schemas !== 'object' || !schemas.kinds) throw new TypeError('mount needs options.schemas (spec/2.0/schemas): an asset is checked before it plays');
  const bad = Object.keys(asset.files).filter(p => !TEXT.test(p));
  if (bad.length) throw fault('E-ASSET', `an asset holds only its documents and drawings, not ${bad.join(', ')}`);
  let doc;
  try { doc = JSON.parse(asset.files['experience.json']); } catch { throw fault('E-ASSET', 'the asset has no experience.json'); }
  if (Array.isArray(doc?.needs) && doc.needs.length) throw fault('E-ASSET', `an asset needs no add-on or capability; this one needs ${doc.needs.join(', ')}`);
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
  const files = { ...asset.files };
  if (Object.keys(given).length) {
    const copy = structuredClone(doc);
    for (const [name, v] of Object.entries(given)) copy.inputs[name].initial = v;
    files['experience.json'] = JSON.stringify(copy);
  }
  const host = mountPackage(element, assetPackage({ id: asset.id, files }), { schemas, partition: partition ?? `asset-${asset.id}`, onError, test, timeLimits });
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

// ---------- one copy of the schemas for the page ----------
// The checker's schemas for an asset (the core document kinds an asset may hold, the document envelope and the drawing
// rules), fetched once from the package's own spec/2.0/schemas, or given by the host with useSchemas.
let shared = null;
const KINDS = ['experience', 'scene', 'component', 'shell'];
export function useSchemas(schemas) { shared = Promise.resolve(schemas); }
export function sharedSchemas(base = new URL('../../../spec/2.0/schemas/core/', import.meta.url)) {
  const get = (file) => fetch(new URL(file, base)).then((r) => { if (!r.ok) throw fault('E-ASSET', `cannot load the schema ${file} (${r.status})`); return r.json(); });
  return (shared ??= Promise.all([...KINDS.map(k => get(`${k}.schema.json`)), get('document.schema.json'), get('drawing.rules.json')])
    .then((all) => ({ kinds: Object.fromEntries(KINDS.map((k, i) => [k, all[i]])), document: all[KINDS.length], drawing: all[KINDS.length + 1], capabilities: {}, addons: {} })));
}

// ---------- <hypersvg-asset src="car.svg" length="1.4" colour="ocean"> ----------
// Attributes set the declared inputs by name (case does not matter; roof-open or roofopen sets roofOpen): a number
// is read as a number, a boolean is true when present (unless "false"), text is as written. A change of attribute
// sets the input again, so the latest change wins; removing it gives back the declared initial value. The element:
// - ready: a promise of the host API; inputs() lists the inputs (empty until ready); set(name, value), read(name);
//   on(name, fn), as the host API's on (waits until ready);
// - sends each change of an input as the DOM event hsvg:changed ({name, value, by}) and each of the asset's output
//   events and records as hsvg:<name>; a refusal as hsvg:error ({code, message}), with data-hsvg-refused on the element.
// Until it plays, the element shows what it holds (an <img> of the same SVG shows the rest pose).
const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const attrsOf = (name) => [...new Set([name.toLowerCase(), kebab(name)])];
function parsed(d, raw) {
  if (d.type === 'number') return Number(raw);
  if (d.type === 'boolean') return raw !== 'false';
  return raw;
}

const Base = typeof HTMLElement === 'function' ? HTMLElement : class {};
export class HyperSvgAsset extends Base {
  constructor() { super(); this._host = null; this._decls = {}; this._waiting = []; this._run = 0; this.ready = null; }
  connectedCallback() { if (!this._host && !this._loading) this._start(); }
  disconnectedCallback() { queueMicrotask(() => { if (!this.isConnected) this._stop(); }); }
  get host() { return this._host; }
  inputs() { return this._host ? this._host.inputs() : []; }
  read(name) { if (!this._host) throw fault('E-HOST-CLOSED', 'the asset is not playing yet; await element.ready'); return this._host.read(name); }
  set(name, value) { if (!this._host) throw fault('E-HOST-CLOSED', 'the asset is not playing yet; await element.ready'); return this._host.set(name, value); }
  on(name, fn) {
    if (this._host) return this._host.on(name, fn);
    const w = { name, fn, off: null }; this._waiting.push(w);
    return () => { w.fn = null; w.off?.(); };
  }
  _attrInputs() {
    const out = {};
    for (const [name, d] of Object.entries(this._decls)) {
      if (d.kind === 'trigger') continue;
      const a = attrsOf(name).find(x => this.hasAttribute(x));
      if (a !== undefined) out[name] = parsed(d, this.getAttribute(a));
    }
    return out;
  }
  _start() {
    const run = ++this._run;
    this._loading = true;
    this.removeAttribute('data-hsvg-refused');
    this.ready = (async () => {
      const src = this.getAttribute('src');
      if (!src) throw fault('E-ASSET', '<hypersvg-asset> needs src, the address of a HyperSVG');
      const [text, schemas] = await Promise.all([fetch(new URL(src, document.baseURI)).then((r) => { if (!r.ok) throw fault('E-ASSET', `cannot load ${src} (${r.status})`); return r.text(); }), sharedSchemas()]);
      if (run !== this._run) return null;
      const asset = readAsset(text, { maxBytes: FORMAT.dataBytesEach });
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
      try { host = place(stage, asset, this._attrInputs(), { schemas, onError: (d) => this._send('error', d) }); } catch (e) { this.replaceChildren(...fallback); throw e; }
      this._host = host;
      host.on('hsvg.changed', (e) => this._send('changed', e.detail));
      for (const o of host.outputs()) host.on(o.name, (e) => this._send(o.name, e.detail));
      for (const w of this._waiting.splice(0)) if (w.fn) w.off = host.on(w.name, w.fn);
      this._watch = new MutationObserver((records) => this._changed(records));
      this._watch.observe(this, { attributes: true });
      return host;
    })().catch((e) => {
      if (run === this._run) { this.setAttribute('data-hsvg-refused', e.code || 'error'); this._send('error', { code: e.code || null, message: e.message }); }
      throw e;
    }).finally(() => { if (run === this._run) this._loading = false; });
    this.ready.catch(() => {}); // a refusal is reported as hsvg:error; awaiting ready still sees it
  }
  _changed(records) {
    for (const r of records) {
      if (r.attributeName === 'src') { this._stop(); this._start(); return; }
      const name = Object.keys(this._decls).find(n => this._decls[n].kind !== 'trigger' && attrsOf(n).includes(r.attributeName));
      if (!name) continue;
      const d = this._decls[name];
      const raw = this.getAttribute(r.attributeName);
      try { this._host.set(name, raw === null ? structuredClone(d.initial) : parsed(d, raw)); } catch (e) { this._send('error', { code: e.code || null, message: e.message }); }
    }
  }
  _send(name, detail) { this.dispatchEvent(new CustomEvent(`hsvg:${name}`, { detail })); }
  _stop() {
    this._run++;
    this._watch?.disconnect(); this._watch = null;
    try { this._host?.destroy(); } catch { /* already closed */ }
    this._host = null; this._loading = false;
    this.replaceChildren();
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('hypersvg-asset')) customElements.define('hypersvg-asset', HyperSvgAsset);
