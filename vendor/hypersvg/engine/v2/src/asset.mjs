// The HyperSVG (D45, 2.13, 10.14): one SVG file that is the asset's drawing, with the asset's other files inside
// its tool record (<metadata>, 6.6) as data, never as script. The packer writes it (tools/pack.mjs --asset), unpack
// splits it (tools/unpack.mjs), and the asset player reads it (web/asset-web.mjs). Plain JavaScript, synchronous, no
// platform crypto and no DOM, so Node and the browser share one reading. Not part of the core bundle.
//
// The file: the drawing exactly as it is in the folder, with one line put right after the root <svg> start tag:
//   <metadata>{"asset":{"format":"hsvg/2.0","id":...,"drawing":<path>,"members":{...},"files":{...}}}</metadata>
// - drawing: the folder path of the drawing the file shows (the start scene's drawing);
// - members: every file of the folder the asset holds, the drawing too, with the SHA-256 of its exact bytes (as a
//   package's members, 10.8);
// - files: every member but the drawing, as text.
// The JSON writes <, > and & as \u escapes, so the record holds no markup and needs no XML escaping. Taking the line out
// gives the drawing's bytes back, so pack, unpack and pack again give the same bytes.
import { sha256, memberFindings } from './members.mjs';

export const ASSET_FORMAT = 'hsvg/2.0';
const enc = new TextEncoder();
const NO_MARKUP = (json) => json.replace(/[<>&]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
const fault = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });
const sorted = (o) => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));

// The end of the root <svg> start tag, after an optional XML declaration and comments: the index just past its '>'.
function rootTagEnd(text) {
  const m = /^(?:﻿)?(?:<\?xml[^?]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg\b(?:[^>"']|"[^"]*"|'[^']*')*>/.exec(text);
  return m ? m[0].length : -1;
}
const META = /^\r?\n<metadata>([^<]*)<\/metadata>/;

// The HyperSVG for a folder's text files: files maps each member path to its text, drawing names the one shown.
// Throws E-ASSET when the drawing cannot carry the record.
export function makeAsset({ id, drawing, files }) {
  const text = files[drawing];
  if (typeof text !== 'string') throw fault('E-ASSET', `the asset's drawing ${drawing} is not one of its files`);
  const at = rootTagEnd(text);
  if (at < 0) throw fault('E-ASSET', `${drawing} does not start with an <svg> root element`);
  if (/<metadata\b/.test(text)) throw fault('E-ASSET', `${drawing} already has a tool record (<metadata>); the drawing of an asset carries none, the packer writes it`);
  const members = sorted(Object.fromEntries(Object.entries(files).map(([p, t]) => [p, sha256(enc.encode(t))])));
  const rest = sorted(Object.fromEntries(Object.entries(files).filter(([p]) => p !== drawing)));
  const record = { asset: { format: ASSET_FORMAT, id, drawing, members, files: rest } };
  const nl = text.slice(at).startsWith('\r\n') ? '\r\n' : '\n';
  return `${text.slice(0, at)}${nl}<metadata>${NO_MARKUP(JSON.stringify(record))}</metadata>${text.slice(at)}`;
}

// Reads a HyperSVG: {id, drawing, files} with every member's text (the drawing too), after the member check. Throws
// E-ASSET for a file that is no HyperSVG, E-PACKAGE-MEMBER or E-PACKAGE-DIGEST for a file that was changed after
// packing (a tampered asset). maxBytes: the size limit (the asset limit of the host, dataBytesEach by default).
export function readAsset(svg, { maxBytes = Infinity } = {}) {
  if (typeof svg !== 'string') throw fault('E-ASSET', 'a HyperSVG is text');
  const bytes = enc.encode(svg).length;
  if (bytes > maxBytes) throw fault('E-ASSET', `the HyperSVG is ${bytes} bytes, more than ${maxBytes}`);
  const at = rootTagEnd(svg);
  const m = at < 0 ? null : META.exec(svg.slice(at));
  if (!m) throw fault('E-ASSET', 'this SVG holds no asset record: a HyperSVG has <metadata>{"asset": ...}</metadata> right after its <svg> start tag (pack --asset writes it)');
  let record = null;
  try { record = JSON.parse(m[1]); } catch { /* below */ }
  const a = record?.asset;
  if (!a || typeof a !== 'object' || Array.isArray(a) || Object.keys(record).length !== 1) throw fault('E-ASSET', 'the asset record is not one JSON object {"asset": {...}}');
  const extra = Object.keys(a).filter(k => !['format', 'id', 'drawing', 'members', 'files'].includes(k));
  if (extra.length) throw fault('E-ASSET', `the asset record holds ${extra.join(', ')}, which an asset cannot hold`);
  if (a.format !== ASSET_FORMAT) throw fault('E-ASSET', `the asset's format is ${JSON.stringify(a.format)}, not ${ASSET_FORMAT}`);
  if (typeof a.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(a.id)) throw fault('E-ASSET', 'the asset has no id');
  if (typeof a.drawing !== 'string' || !a.files || typeof a.files !== 'object' || Array.isArray(a.files) || !a.members || typeof a.members !== 'object') throw fault('E-ASSET', 'the asset record needs drawing, members and files');
  if (Object.hasOwn(a.files, a.drawing)) throw fault('E-ASSET', `the drawing ${a.drawing} is the SVG itself, not one of the files`);
  const files = {};
  for (const [p, t] of Object.entries(a.files)) {
    if (typeof t !== 'string') throw fault('E-ASSET', `${p} is not text`);
    if (!/^[A-Za-z0-9_][A-Za-z0-9._-]*(\/[A-Za-z0-9_][A-Za-z0-9._-]*)*$/.test(p) || p.split('/').includes('..')) throw fault('E-ASSET', `${p} is not a plain relative path`);
    files[p] = t;
  }
  const meta = m[0];
  files[a.drawing] = svg.slice(0, at) + svg.slice(at + meta.length);
  const bad = memberFindings(a.members, Object.keys(files), (p) => sha256(enc.encode(files[p])));
  if (bad.length) throw fault(bad[0].code, `the asset was changed after it was packed: ${bad.map(d => d.message).join('; ')}`, { diagnostics: bad });
  return { id: a.id, drawing: a.drawing, files };
}

// The package mount() takes (10.6, web/mount-web.mjs) for an asset's files: each member's bytes and a package.json
// listing them, as the packer would.
export function assetPackage({ id, files }) {
  const pkg = {};
  for (const [p, t] of Object.entries(files)) pkg[p] = enc.encode(t);
  const members = sorted(Object.fromEntries(Object.entries(pkg).map(([p, b]) => [p, sha256(b)])));
  pkg['package.json'] = enc.encode(JSON.stringify({ format: ASSET_FORMAT, kind: 'package', id, experience: 'experience.json', needs: [], members }));
  return pkg;
}
