// Writes the HyperSVG conformance files (spec/2.0/conformance/hypersvg/, 10.15) from the folders beside them: each
// file is a packed asset, or a packed asset changed the way the case says. The expected results are in expected.json
// there, written by hand; tests/n4-conformance.test.mjs reads every file with the engine and compares.
// Usage: node engine/v2/tools/make-conformance.mjs [--check]
//   --check  write nothing; exit 1 when a file differs from what this tool makes
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeAsset, readAsset } from '../src/asset.mjs';
import { sha256 } from '../src/members.mjs';
import { packAsset } from './pack.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..');
export const folder = path.join(repo, 'spec', '2.0', 'conformance', 'hypersvg');

// The drawing a HyperSVG shows, without its record line: what a re-pack starts from.
const bare = (a) => ({ ...a.files });
// A re-pack (10.15): the same id and drawing, every digest made again from the files as they are now.
const repack = (a, files) => makeAsset({ id: a.id, drawing: a.drawing, files });
// Puts a changed record back in place of the old one, with no new digests.
const swapRecord = (svg, edit) => svg.replace(/<metadata>([^<]*)<\/metadata>/, (m, json) => `<metadata>${JSON.stringify(edit(JSON.parse(json)))
  .replace(/[<>&]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)}</metadata>`);

// A record line made by hand, as makeAsset makes it but without its refusals: for a drawing the packer refuses.
function handMade(a, files) {
  const sorted = (o) => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
  const members = sorted(Object.fromEntries(Object.entries(files).map(([p, t]) => [p, sha256(new TextEncoder().encode(t))])));
  const rest = sorted(Object.fromEntries(Object.entries(files).filter(([p]) => p !== a.drawing)));
  const json = JSON.stringify({ asset: { format: 'hsvg/2.0', id: a.id, drawing: a.drawing, members, files: rest } }).replace(/[<>&]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  return files[a.drawing].replace(/^(<svg[^>]*>)/, `$1\n<metadata>${json}</metadata>`);
}

async function packed(name) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-conf-'));
  try { return fs.readFileSync((await packAsset(path.join(folder, 'folders', name), out)).svgPath, 'utf8'); } finally { fs.rmSync(out, { recursive: true, force: true }); }
}

// Every conformance file: its name and its text.
export async function conformanceFiles() {
  const beacon = await packed('beacon');
  const badge = await packed('badge');
  const a = readAsset(beacon);
  const drawing = a.files[a.drawing];
  const scene = 'scenes/beacon/scene.json';
  const out = {
    'valid-one-scene.svg': beacon,
    'valid-component.svg': badge,
    // Changed after packing, digests left as they were.
    'stale-drawing.svg': beacon.replace('fill="#f59e0b"', 'fill="#dc2626"'),
    'stale-file.svg': beacon.replace('\\"Beacon on\\"}', '\\"Light on\\"}'),
    // Changed, then every digest made again.
    'resealed-valid.svg': repack(a, { ...bare(a), [a.drawing]: drawing.replace('fill="#f59e0b"', 'fill="#dc2626"') }),
    'resealed-script.svg': repack(a, { ...bare(a), [a.drawing]: drawing.replace('</svg>', '<script>alert(1)</script>\n</svg>') }),
    'resealed-broken-ref.svg': repack(a, { ...bare(a), [scene]: a.files[scene].replace('"target": "switch"', '"target": "lever"') }),
    // A cleaner removed an attribute, then the host re-packed it.
    'repacked-cleaned.svg': repack(a, { ...bare(a), [a.drawing]: drawing.replace(' stroke="#92400e" stroke-width="3"', '') }),
    'repacked-cleaned-mark.svg': repack(a, { ...bare(a), [a.drawing]: drawing.replace(' data-hsvg-motion="opacity 0..1"', '') }),
    // Paths that are not plain relative paths (digests made again, so only the path is wrong).
    'path-dot-dot.svg': repack(a, { ...bare(a), '../outside.json': '{}' }),
    'path-absolute.svg': repack(a, { ...bare(a), '/outside.json': '{}' }),
    'path-backslash.svg': repack(a, { ...bare(a), 'scenes\\beacon\\notes.txt': 'notes' }),
    // Members and files that do not match.
    'member-missing.svg': swapRecord(beacon, (r) => ({ asset: { ...r.asset, members: { ...r.asset.members, 'scenes/beacon/notes.txt': 'sha256:' + '0'.repeat(64) } } })),
    'member-unlisted.svg': swapRecord(beacon, (r) => ({ asset: { ...r.asset, files: { ...r.asset.files, 'scenes/beacon/notes.txt': 'notes' } } })),
    // Records the reader refuses.
    'no-record.svg': drawing,
    'record-moved.svg': beacon.replace(/(<svg[^>]*>)(\n<metadata>[^<]*<\/metadata>)(\n<title>Beacon<\/title>)/, '$1$3$2'),
    'record-extra-key.svg': swapRecord(beacon, (r) => ({ asset: { ...r.asset, script: 'x' } })),
    'record-wrong-format.svg': swapRecord(beacon, (r) => ({ asset: { ...r.asset, format: 'hsvg/1.0' } })),
    // A drawing with a tool record of its own, put in by hand (the packer refuses to make it).
    'drawing-has-record.svg': handMade(a, { ...bare(a), [a.drawing]: drawing.replace('<title>Beacon</title>', '<metadata>{"derived": "derived"}</metadata>\n<title>Beacon</title>') }),
  };
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const files = await conformanceFiles();
  let stale = 0;
  for (const [name, text] of Object.entries(files)) {
    const to = path.join(folder, name);
    const now = fs.existsSync(to) ? fs.readFileSync(to, 'utf8') : null;
    if (now === text) continue;
    if (check) { console.log(`stale: ${name}`); stale++; } else { fs.writeFileSync(to, text); console.log(`wrote ${name}`); }
  }
  console.log(check ? `${Object.keys(files).length} files, ${stale} stale` : `${Object.keys(files).length} files`);
  process.exit(stale ? 1 : 0);
}
