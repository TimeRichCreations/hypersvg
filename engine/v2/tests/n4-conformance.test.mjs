// The HyperSVG conformance files (10.15, spec/2.0/conformance/hypersvg): the engine's reader and checker give what
// expected.json says for every file, valid files re-pack to the same bytes, and the packer gives the expected file or
// refusal for every folder. The files are what make-conformance.mjs makes from the folders.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readAsset, makeAsset } from '../src/asset.mjs';
import { checkExperience } from '../check/index.mjs';
import { FORMAT } from '../src/limits.mjs';
import { packAsset } from '../tools/pack.mjs';
import { folder, conformanceFiles } from '../tools/make-conformance.mjs';
import { schemas, mapSource, eq, ok } from './helpers.mjs';

const expected = () => JSON.parse(fs.readFileSync(path.join(folder, 'expected.json'), 'utf8'));
const text = (name) => fs.readFileSync(path.join(folder, name), 'utf8');
const errorCodes = (files) => [...new Set(checkExperience(mapSource(files), schemas()).diags.map(d => d.code).filter(c => c.startsWith('E-')))].sort();

export const tests = {
  '10.15: every conformance file reads and checks as expected.json says'() {
    const cases = expected().cases.filter(c => c.file);
    ok(cases.length >= 20, `${cases.length} cases`);
    const wrong = [];
    for (const c of cases) {
      let got;
      try {
        const a = readAsset(text(c.file), { maxBytes: c.maxBytes ?? FORMAT.dataBytesEach });
        got = { read: 'ok', check: errorCodes(a.files) };
        if (c.repack) got.repack = makeAsset({ id: a.id, drawing: a.drawing, files: a.files }) === text(c.file);
      } catch (e) {
        if (!e.code) throw e;
        got = { read: e.code };
      }
      const want = { read: c.read, ...(c.check ? { check: c.check } : {}), ...(c.repack ? { repack: true } : {}) };
      if (JSON.stringify(got) !== JSON.stringify(want)) wrong.push(`${c.file}${c.maxBytes ? ` (maxBytes ${c.maxBytes})` : ''}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
    }
    eq(wrong, []);
  },
  '10.15: every .svg in the folder has a case, and every case names a file there'() {
    const named = new Set(expected().cases.filter(c => c.file).map(c => c.file));
    const there = fs.readdirSync(folder).filter(f => f.endsWith('.svg'));
    eq(there.filter(f => !named.has(f)), [], 'files with no case');
    eq([...named].filter(f => !there.includes(f)), [], 'cases with no file');
  },
  async '10.15: the packer gives the expected file, or refuses, for every folder'() {
    for (const c of expected().cases.filter(c => c.folder)) {
      const out = fs.mkdtempSync(path.join(os.tmpdir(), 'n4-'));
      try {
        let got;
        try { got = fs.readFileSync((await packAsset(path.join(folder, ...c.folder.split('/')), out)).svgPath, 'utf8'); } catch (e) { got = e.diags?.[0]?.code ?? e.code ?? e.message; }
        if (c.pack.endsWith('.svg')) ok(got === text(c.pack), `${c.folder} packs to ${c.pack}`);
        else eq(got, c.pack, c.folder);
      } finally { fs.rmSync(out, { recursive: true, force: true }); }
    }
  },
  async '10.15: the conformance files are what make-conformance.mjs makes'() {
    const made = await conformanceFiles();
    eq(Object.entries(made).filter(([name, t]) => !fs.existsSync(path.join(folder, name)) || text(name) !== t).map(([name]) => name), []);
  },
};
