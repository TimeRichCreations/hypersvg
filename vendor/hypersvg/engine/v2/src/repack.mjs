// repack(files): makes a HyperSVG again from its files (added after 2.0.0-next.0). The documented way to re-make the
// file after an edit, for example after a host cleaned a drawing. It gives the same bytes as pack --asset for the
// same files. asset-web.mjs exports it; it runs in a browser and in Node.
//   import { readAsset } from '.../src/asset.mjs';
//   const { files } = readAsset(svgText);
//   files['scenes/drive/car.svg'] = cleaned;
//   const svg = repack(files);
// files: {<path>: text}, every member: experience.json and what it names (readAsset's files, or an unpacked folder's
// reached text files). The id is the experience's id and the drawing shown is the start scene's drawing, as the packer
// takes them. repack makes the record and its digests; it does not check the documents. The record's digests catch
// accidents, not edits: place the result with the full check (no integrity), or check the files first, and store its
// new integrity value only after that check passed. Throws {code: 'E-ASSET', message}.
import { makeAsset } from './asset.mjs';
import { FORMAT } from './limits.mjs';

const no = (message) => { const e = new Error(`repack: ${message}`); e.code = 'E-ASSET'; throw e; };
const normal = (p) => { const out = []; for (const s of p.split('/')) { if (s === '..') out.pop(); else if (s && s !== '.') out.push(s); } return out.join('/'); };

export function repack(files) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) no('files maps each member path to its text');
  for (const [p, t] of Object.entries(files)) if (typeof t !== 'string') no(`${p} is not text`);
  let doc;
  try { doc = JSON.parse(files['experience.json']); } catch { no('there is no experience.json, or it is not JSON'); }
  const id = doc?.id;
  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) no(`the experience id ${JSON.stringify(id)} cannot name a file`);
  const sceneFile = doc.story?.scenes?.[doc.story?.start];
  let scene = null;
  try { scene = typeof sceneFile === 'string' ? JSON.parse(files[normal(sceneFile)]) : null; } catch { /* below */ }
  if (typeof scene?.drawing !== 'string') no('its start scene has no drawing to show');
  const dir = normal(sceneFile).split('/').slice(0, -1).join('/');
  const drawing = normal(dir ? `${dir}/${scene.drawing}` : scene.drawing);
  const sorted = Object.fromEntries(Object.keys(files).sort().map(p => [p, files[p]]));
  const svg = makeAsset({ id, drawing, files: sorted });
  const bytes = new TextEncoder().encode(svg).length;
  if (bytes > FORMAT.dataBytesEach) no(`the HyperSVG would be ${bytes} bytes, more than dataBytesEach (${FORMAT.dataBytesEach})`);
  return svg;
}
