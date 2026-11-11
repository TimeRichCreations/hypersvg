// Unpack: turns a HyperSVG (D45, 10.14) back into its asset folder. Pack it again and you get the same bytes.
// Usage: node engine/v2/tools/unpack.mjs <id>.svg <folder> [--force]
// Writes every member of the asset at its path in the folder: the drawing the file shows (the SVG without its asset
// record) and the files inside the record (src/asset.mjs). It checks every member's digest first, so a changed
// (tampered) file is refused (E-PACKAGE-DIGEST or E-PACKAGE-MEMBER) and nothing is written. It refuses a folder that
// holds other files unless --force, and it never writes outside the folder. Node standard library only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAsset } from '../src/asset.mjs';
import { FORMAT } from '../src/limits.mjs';

// Reads the HyperSVG at file and writes its folder. Returns {id, drawing, written: [paths]}. Throws {code, message}.
export function unpack(file, outDir, { force = false } = {}) {
  const asset = readAsset(fs.readFileSync(file, 'utf8'), { maxBytes: FORMAT.dataBytesEach });
  outDir = path.resolve(outDir);
  if (fs.existsSync(outDir) && fs.readdirSync(outDir).length && !force) {
    throw Object.assign(new Error(`${outDir} is not empty; unpack into an empty folder, or add --force to write over it`), { code: 'E-ASSET' });
  }
  const written = [];
  for (const rel of Object.keys(asset.files).sort()) {
    const to = path.resolve(outDir, ...rel.split('/'));
    if (path.relative(outDir, to).startsWith('..') || path.isAbsolute(path.relative(outDir, to))) throw Object.assign(new Error(`${rel} is outside the folder`), { code: 'E-ASSET' });
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, asset.files[rel]);
    written.push(rel);
  }
  return { id: asset.id, drawing: asset.drawing, written };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const [file, out] = args.filter(a => !a.startsWith('--'));
  if (!file || !out) { console.log('usage: node engine/v2/tools/unpack.mjs <id>.svg <folder> [--force]'); process.exit(2); }
  try {
    const r = unpack(path.resolve(file), out, { force: args.includes('--force') });
    console.log(`unpacked ${r.id}: ${r.written.length} files into ${path.resolve(out)}; the drawing it shows is ${r.drawing}`);
  } catch (e) {
    if (!e.code) throw e;
    console.log(`${e.code}: ${e.message}`);
    process.exit(1);
  }
}
