// Loads the capabilities a placed HyperSVG pins (D55, 2.13, added after 2.0.0-next.0). For each one: fetch its module
// file from the add-on address, hash the exact bytes, compare with the pin, then import those same bytes from a blob
// (a data: address where there is no Blob URL, as in Node). The module never comes from the network a second time,
// so what runs is what was checked. Its default export is the capability record; the player hands it to the engine
// (play's modules) and never registers it in the page.
// - A file that cannot be fetched, or that the page does not let run, is E-ADDON-MISSING. Bytes that do not match the
//   pin are E-ADDON-DIGEST; so is a module that is not the capability it should be (another id, a page part, no
//   install): it is not the reviewed code. Nothing plays then.
// - One load per address and digest per page: many HyperSVGs that pin the same version share one module.
// - The add-on address (addonBase) defaults to the package's own engine/v2/web/addons/ (asset-schemas.mjs). A host
//   that serves the files elsewhere gives its base address.
// - A page with a Content Security Policy allows blob: in script-src for this import.
import { sha256 } from '../src/members.mjs';
import { addonFile } from '../src/on-demand.mjs';

const fault = (code, message) => Object.assign(new Error(message), { code });
const loaded = new Map();

const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function digestOf(bytes) {
  const subtle = globalThis.crypto?.subtle;
  return subtle ? `sha256:${hex(await subtle.digest('SHA-256', bytes))}` : sha256(bytes);
}
async function importBytes(bytes) {
  const blob = typeof Blob === 'function' && typeof URL.createObjectURL === 'function' && typeof document !== 'undefined';
  let url;
  if (blob) url = URL.createObjectURL(new Blob([bytes], { type: 'text/javascript' }));
  else { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); url = `data:text/javascript;base64,${btoa(s)}`; }
  try { return await import(url); } finally { if (blob) URL.revokeObjectURL(url); }
}

async function loadOne({ id, version, pinned, digest }, base) {
  let url;
  try { url = new URL(addonFile(id, version), base); } catch { throw fault('E-ADDON-MISSING', `the add-on address ${String(base)} is not an address`); }
  let bytes;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status}`);
    bytes = new Uint8Array(await r.arrayBuffer());
  } catch (e) {
    throw fault('E-ADDON-MISSING', `the HyperSVG needs ${pinned}, but its module cannot be loaded from ${url.href} (${e.message}): serve ${addonFile(id, version)} at the add-on address`);
  }
  const got = await digestOf(bytes);
  if (got !== digest) throw fault('E-ADDON-DIGEST', `the module ${url.href} is ${got}, not the pinned ${pinned} ${digest}: serve the reviewed file, or pack the HyperSVG again against the module the page serves`);
  let rec;
  try { rec = (await importBytes(bytes)).default; } catch (e) { throw fault('E-ADDON-MISSING', `the module of ${pinned} matched its pin, but the page does not let it run (${e.message}): a page with a Content Security Policy allows blob: in script-src`); }
  if (!rec || rec.id !== id || typeof rec.install !== 'function' || rec.attach !== undefined) throw fault('E-ADDON-DIGEST', `the module of ${pinned} is not the ${id} capability (a capability loaded on demand has an install and no page part)`);
  return rec;
}

// The capability records of a list of pins ([{id, version, pinned, digest}], src/on-demand.mjs assetAddons), loaded
// from base. Resolves to [record]; rejects with E-ADDON-MISSING or E-ADDON-DIGEST.
export function loadAddons(list, base) {
  return Promise.all(list.map((a) => {
    const key = `${String(base)}\n${a.pinned}\n${a.digest}`;
    if (!loaded.has(key)) loaded.set(key, loadOne(a, base).catch((e) => { loaded.delete(key); throw e; }));
    return loaded.get(key);
  }));
}
