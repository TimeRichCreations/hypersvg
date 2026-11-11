// Stage 1: load and check 2.0 files against the schemas.
import path from 'node:path';
import { loadExperience, folderSource, parseWords } from '../src/load.mjs';
import { repo, schemas, eq, ok, mapSource } from './helpers.mjs';

const svg = (body = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-hsvg-version="2.0" data-hsvg-kind="screen">${body}</svg>`;
const tiny = (extra = {}) => ({
  'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'tiny', story: { start: 'one', scenes: { one: 'scenes/one/scene.json' }, ends: ['one'] }, ...extra },
  'scenes/one/scene.json': { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg' },
  'scenes/one/one.svg': svg('<rect id="r" width="1" height="1"/>'),
});

import fs from 'node:fs';
export const tests = {
  'every code the engine raises is in errors.json (one list of codes)'() {
    const known = new Set(JSON.parse(fs.readFileSync(path.join(repo, 'spec', '2.0', 'errors.json'), 'utf8')).codes.map(c => c.code));
    const dir = path.join(repo, 'engine', 'v2', 'src');
    const used = new Set();
    for (const f of fs.readdirSync(dir, { recursive: true }).map(String).filter(f => f.endsWith('.mjs'))) for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/'([EW]-[A-Z][A-Z0-9-]+)'/g)) used.add(m[1]);
    eq([...used].filter(c => !known.has(c)), []);
  },
  'checked mode (a packed page): with no schemas, files are only parsed (10.9)'() {
    const files = tiny({ notAKey: true });
    eq(loadExperience(mapSource(files), schemas()).diags.length > 0, true, 'the schema check refuses the unknown key');
    const r = loadExperience(mapSource(files), null);
    eq([r.diags, Object.keys(r.experience.scenes)], [[], ['one']]);
    files['scenes/one/scene.json'] = '{"broken"';
    eq(loadExperience(mapSource(files), null).diags.map(d => d.code), ['E-JSON']);
  },
  'a tiny experience loads with no diagnostics'() {
    const r = loadExperience(mapSource(tiny()), schemas());
    eq(r.diags, []);
    ok(r.ok);
    eq(Object.keys(r.experience.scenes), ['one']);
    ok(r.experience.scenes.one.drawings.main.text.startsWith('<svg'));
  },
  'a missing scene file is E-FILE-MISSING'() {
    const files = tiny(); delete files['scenes/one/scene.json'];
    const r = loadExperience(mapSource(files), schemas());
    ok(!r.ok); eq(r.diags.map(d => d.code), ['E-FILE-MISSING']);
  },
  'a bad drawing stops the load with its code'() {
    const files = tiny(); files['scenes/one/one.svg'] = svg('<script>x()</script>');
    const r = loadExperience(mapSource(files), schemas());
    ok(!r.ok); eq(r.diags.map(d => d.code), ['E-SVG-UNSAFE']);
  },
  'a scene inherits the experience needs (2.1)'() {
    const files = tiny({ needs: ['physics'] });
    files['scenes/one/scene.json'].addons = { physics: { bodies: { b: { target: 'r', shape: { kind: 'circle', radius: 1 }, rest: [0, 0] } } } };
    eq(loadExperience(mapSource(files), schemas()).diags, []);
    delete files['experience.json'].needs;
    eq(loadExperience(mapSource(files), schemas()).diags.map(d => d.code), ['E-NEEDS-MISSING']);
  },
  'a repeated key is E-JSON before anything else'() {
    const files = tiny(); files['scenes/one/scene.json'] = '{"format":"hsvg/2.0","kind":"scene","id":"one","id":"two","drawing":"one.svg"}';
    eq(loadExperience(mapSource(files), schemas()).diags.map(d => d.code), ['E-JSON']);
  },
  'words files are read (2.7)'() {
    eq(parseWords('id,text\nonward,Onward\nmany,"a, b"\n'), { onward: 'Onward', many: 'a, b' });
  },
};
