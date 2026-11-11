// Paths that climb above the experience's folder are refused at load with E-PATH (2.1 rule 6; review
// finding 12). The engine stands alone: nothing it runs imports from outside engine/v2, and a
// test proves it (W3-R finding 6). No browser.
import fs from 'node:fs';
import path from 'node:path';
import { loadExperience } from '../src/load.mjs';
import { repo, schemas, mapSource, eq, ok } from './helpers.mjs';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>t</title></svg>';
const files = (scene = {}, exp = {}) => ({
  'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'p', story: { start: 'one', scenes: { one: 'scenes/one/scene.json' }, ends: ['one'] }, ...exp },
  'scenes/one/scene.json': { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg', ...scene },
  'scenes/one/one.svg': svg,
  'one.svg': svg,
  'x.svg': svg,
});
const codes = (r) => r.diags.map(d => `${d.code} ${d.file} ${d.path}`);

export const tests = {
  'path: a drawing path that climbs above the experience folder is E-PATH, not flattened'() {
    const r = loadExperience(mapSource(files({ drawing: '../../../x.svg' })), schemas());
    ok(!r.ok);
    eq(codes(r), ['E-PATH scenes/one/scene.json drawing']);
    ok(!r.experience.scenes.one.drawings.main, 'nothing was read for it');
  },
  'path: climbing exactly to the root stays inside and loads'() {
    const r = loadExperience(mapSource(files({ drawing: '../../one.svg' })), schemas());
    eq(codes(r), []);
    eq(r.experience.scenes.one.drawings.main.file, 'one.svg');
    const r2 = loadExperience(mapSource(files({ drawing: '../one/one.svg' })), schemas());
    eq(r2.experience.scenes.one.drawings.main.file, 'scenes/one/one.svg');
  },
  'path: a scene, block or shell path from the experience that climbs is E-PATH'() {
    const f = files();
    f['experience.json'].story.scenes.two = '../scenes/one/scene.json';
    const r = loadExperience(mapSource(f), schemas());
    ok(codes(r).includes('E-PATH experience.json story.scenes.two'), codes(r).join('; '));
    ok(!r.experience.scenes.two);
  },
  'path: a words file that climbs is E-PATH'() {
    const r = loadExperience(mapSource(files({ resources: { w: { kind: 'words', language: 'en', file: '../../../words.csv' } } })), schemas());
    ok(codes(r).includes('E-PATH scenes/one/scene.json resources.w.file'), codes(r).join('; '));
  },
  'stands alone: the engine, checker, tools and schema tools import nothing outside engine/v2 (W3-R finding 6)'() {
    const root = path.join(repo, 'engine', 'v2');
    const outside = new Set(); const seen = new Set();
    const walk = (file) => {
      if (seen.has(file)) return; seen.add(file);
      for (const spec of importsOf(file)) {
        if (!spec.startsWith('.')) { if (!spec.startsWith('node:')) outside.add(`${rel(file)} -> ${spec}`); continue; }
        const to = path.resolve(path.dirname(file), spec);
        if (!to.startsWith(root + path.sep)) { outside.add(`${rel(file)} -> ${rel(to)}`); continue; }
        walk(to);
      }
    };
    for (const dir of SHIPPED) for (const f of mjs(path.join(root, dir))) walk(f);
    eq([...outside].sort(), []);
    ok(seen.size > 60, `walked ${seen.size} modules`);
  },
  'stands alone: the seven schema tools are in engine/v2/schema'() {
    const have = fs.readdirSync(path.join(repo, 'engine', 'v2', 'schema')).filter(f => f.endsWith('.mjs')).sort();
    eq(have, SCHEMA_FILES);
  },
  'stands alone: only the upgrade tool tests reach docs/ from engine/v2/tests (the tests of a work tool)'() {
    const docs = path.join(repo, 'docs');
    const from = new Set();
    for (const f of mjs(path.join(repo, 'engine', 'v2', 'tests'))) for (const spec of importsOf(f)) {
      if (spec.startsWith('.') && path.resolve(path.dirname(f), spec).startsWith(docs + path.sep)) from.add(rel(f));
    }
    eq([...from].sort(), ['engine/v2/tests/w4u-upgrade.test.mjs', 'engine/v2/tests/w5m-upgrade.test.mjs']);
  },
};
// The folders whose modules ship or run as the engine (a packed page, the player, the checker, the CLI tools).
const SHIPPED = ['src', 'web', 'check', 'tools', 'schema'];
const SCHEMA_FILES = ['check-document.mjs', 'drafts.mjs', 'drawing-check.mjs', 'json-strict.mjs', 'load.mjs', 'validate.mjs', 'xml.mjs'];
const IMPORT = /^\s*(?:import|export)\s[^'"]*?\bfrom\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/gm;
const importsOf = (file) => [...fs.readFileSync(file, 'utf8').matchAll(IMPORT)].map(m => m[1] || m[2] || m[3]);
const mjs = (dir) => fs.readdirSync(dir, { recursive: true }).map(String).filter(f => f.endsWith('.mjs')).map(f => path.join(dir, f));
const rel = (f) => path.relative(repo, f).split(path.sep).join('/');
