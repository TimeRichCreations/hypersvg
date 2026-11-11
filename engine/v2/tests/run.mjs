// Runs the 2.0 engine's tests: every *.test.mjs in this folder, in name order, then the showcase tests and the examples'
// fast tests (EXTRA).
// Fast: no browser.
// Usage: node engine/v2/tests/run.mjs [filter]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import '../src/capabilities/all.mjs'; // every built capability, as the dev player has them

const here = path.dirname(fileURLToPath(import.meta.url));
const filter = process.argv[2] || '';
// The examples' own fast tests run here too (they export `tests` as these files do).
const EXTRA = [path.join('..', '..', '..', 'examples', '2.0-ad-studio', 'tests', 'studio.test.mjs')];
// The showcase tests (showcases/) play experiences/2.0, which only the authors' repository holds; they run where the
// folder is there. An EXTRA file that is not there is skipped.
const SHOWCASES = path.join(here, 'showcases');
const showcases = fs.existsSync(SHOWCASES) ? fs.readdirSync(SHOWCASES).filter(f => f.endsWith('.test.mjs')).sort().map(f => path.join('showcases', f)) : [];
const files = [...fs.readdirSync(here).filter(f => f.endsWith('.test.mjs')).sort(), ...showcases, ...EXTRA.filter(f => fs.existsSync(path.join(here, f)))].filter(f => path.basename(f).includes(filter) || f.includes(filter));
let pass = 0; let fail = 0;
const started = Date.now();
for (const f of files) {
  const mod = await import(pathToFileURL(path.join(here, f)));
  for (const [name, fn] of Object.entries(mod.tests || {})) {
    try { await fn(); pass++; } catch (e) { fail++; console.log(`FAIL ${f} :: ${name}\n  ${e.stack?.split('\n').slice(0, 3).join('\n  ') || e}`); }
  }
}
console.log(`${pass} passed, ${fail} failed, ${files.length} files, ${Date.now() - started} ms`);
process.exit(fail ? 1 : 0);
