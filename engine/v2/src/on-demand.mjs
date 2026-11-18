// A HyperSVG may name a pinned capability (D55, 2.13, added after 2.0.0-next.0). The file names the capability in
// needs and pins it in about.trust.pins as <id>@<version> with the digest of its module file. It never carries the
// code (D45). The page loads the module only when a placed HyperSVG names it, checks the digest, then plays
// (web/on-demand-web.mjs). Plain ES module; no DOM.
//
// Only a capability that asks for no host port and no grant, and that has a module, may load this way. Two do:
// effects (the confetti, sparkle and snowfall presets) and physics (bouncy-ball). A test keeps this list equal to what
// their manifests (spec/2.0/capabilities/<id>.json) and modules say.
export const ON_DEMAND = Object.freeze(['effects', 'physics']);

// The module file of a capability version, beside the others at the page's add-on address (tools/bundle-addons.mjs
// makes them): effects-2.0.0.mjs.
export const addonFile = (id, version) => `${id}-${version}.mjs`;

const DIGEST = /^sha256:[0-9a-f]{64}$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const fault = (code, message) => Object.assign(new Error(message), { code });

// The needs of every document of an asset ({path: text}): the experience's, its scenes', its shell's and its
// components'. The engine installs their union (10.11), so the page loads the union.
export function assetNeeds(files) {
  const out = new Set();
  for (const [p, text] of Object.entries(files)) {
    if (!p.endsWith('.json')) continue;
    let doc; try { doc = JSON.parse(text); } catch { continue; }
    if (isObj(doc) && Array.isArray(doc.needs)) for (const n of doc.needs) out.add(n);
  }
  return [...out];
}

// The capabilities an asset loads on demand: [{id, version, pinned, digest}], sorted by id. needs: assetNeeds; doc:
// its experience.json. Throws E-ASSET for a need an asset cannot name (a module, an outside add-on, a capability that
// asks for a port or a grant, or one with no module) and for a need that is not pinned exactly once by version and
// digest.
export function assetAddons(needs, doc) {
  const pins = isObj(doc?.about?.trust?.pins) ? doc.about.trust.pins : {};
  const out = [];
  for (const n of [...new Set(needs)].sort()) {
    if (typeof n !== 'string' || !ON_DEMAND.includes(n)) {
      throw fault('E-ASSET', `an asset names in needs only a capability that loads on demand (${ON_DEMAND.join(', ')}); ${JSON.stringify(n)} is not one: it is a module, an outside add-on, or a capability that needs a host port, a grant or code in the core. Pack it as an experience`);
    }
    const named = Object.keys(pins).filter(k => k.startsWith(`${n}@`));
    if (named.length !== 1) throw fault('E-ASSET', named.length ? `about.trust.pins pins ${n} ${named.length} times (${named.join(', ')}): pin one version` : `needs names ${n}, but about.trust.pins does not pin it: pack --asset writes "${n}@<version>": "sha256:..."`);
    const version = named[0].slice(n.length + 1);
    const digest = pins[named[0]];
    if (!VERSION.test(version)) throw fault('E-ASSET', `the pin ${named[0]} has no version major.minor.patch`);
    if (typeof digest !== 'string' || !DIGEST.test(digest)) throw fault('E-ASSET', `the pin ${named[0]} is not "sha256:" and 64 lower-case hex digits`);
    out.push({ id: n, version, pinned: named[0], digest });
  }
  return out;
}

// Whether documents can ask for sound (6.10; added after 2.0.0-next.0): a sound resource or a made sound (audioSynths)
// in any of them. Without one, nothing can sound (a sound, music or a spoken recording names one), so a packed page
// leaves the audio code out and a HyperSVG page does not load it.
export function usesSound(docs) {
  for (const doc of docs) {
    if (!isObj(doc)) continue;
    if (isObj(doc.audioSynths) && Object.keys(doc.audioSynths).length) return true;
    if (isObj(doc.resources) && Object.values(doc.resources).some(r => r?.kind === 'sound')) return true;
  }
  return false;
}
// The same for an asset's files ({path: text}).
export function assetUsesSound(files) {
  const docs = [];
  for (const [p, text] of Object.entries(files)) if (p.endsWith('.json')) { try { docs.push(JSON.parse(text)); } catch { /* the reader reports it */ } }
  return usesSound(docs);
}
