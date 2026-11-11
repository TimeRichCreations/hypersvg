// The test tool's browser part on a fixture with planted problems. Run alone (it starts a browser):
//   node engine/v2/tests/browser/t1-test-browser.mjs [--browsers all]
// The fixture (engine/v2/tests/t1-fixture) has: a Next press that shows "Go on" but is named "Continue"; a slider with
// no valueText; a 7-unit note; a 640 x 400 drawing only, so on a 390 x 844 phone its 18-unit option words are small.
// The tool must find each of these and nothing that is not there (no page error, every key and Tab stop works).
// Playwright must already be installed (PW_PATH, or a global install). It is never a dependency.
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const T = await import(pathToFileURL(path.join(repo, 'engine', 'v2', 'tools', 'test.mjs')).href);
const fixture = path.join(repo, 'engine', 'v2', 'tests', 't1-fixture');
const all = process.argv.includes('--browsers') && process.argv[process.argv.indexOf('--browsers') + 1] === 'all';

let fails = 0;
const want = (cond, msg) => { if (!cond) fails++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const t0 = Date.now();
const out = fs.mkdtempSync(path.join(os.tmpdir(), 't1-browser-'));
const o = T.parseArgs([fixture, '--out', out]);
const { browsers, note } = await T.openBrowsers({ ...o, browsers: ['chromium'] });
if (!browsers.chromium) { console.log(`FAIL ${note}`); process.exit(1); }
const rep = await T.testOne(fixture, o, browsers);
await browsers.chromium.close();
const has = (code, scene, layout, element, severity) => rep.findings.some(f => f.code === code && f.scene === scene && (!layout || f.layout === layout) && (!element || String(f.element).includes(element)) && (!severity || f.severity === severity));
const codes = [...new Set(rep.findings.map(f => f.code))].sort();
console.log(`     findings: ${codes.join(', ')}`);

want(rep.scenes?.join() === 'a,b', `both scenes measured (${rep.scenes})`);
want(has('T-NAME-HIDES-LABEL', 'a', 'wide', 'a#next', 'error'), 'Next shows "Go on" but is named "Continue": T-NAME-HIDES-LABEL');
want(!has('T-NAME-HIDES-LABEL', 'b'), 'Back shows "Back" and is named "Back to scene A": no finding');
want(has('T-NO-VALUETEXT', 'a', 'wide', 'a#level'), 'the slider without valueText: T-NO-VALUETEXT');
want(has('T-TEXT-SMALL', 'a', 'phone', 'tiny', 'error'), 'the 7-unit note on the phone: T-TEXT-SMALL error');
want(!has('T-TEXT-SMALL', 'a', 'wide', 'tiny'), 'the same note on the wide page is 14 px: no finding');
want(has('T-TEXT-SMALL', 'a', 'phone', null, 'error') && rep.findings.some(f => f.code === 'T-TEXT-SMALL' && f.layout === 'phone' && /Left|Right/.test(f.message)), 'the option words at 18 units are under 12 px on the phone');
want(has('T-HIT-SMALL', 'a', 'phone', 'a#next', 'warning') && !has('T-HIT-SMALL', 'a', 'wide'), 'Next is under 44 px tall on the phone only (a warning)');
for (const code of ['T-PAGE-ERROR', 'T-KEYS', 'T-TAB-ORDER', 'T-FOCUS-HIDDEN', 'T-NO-RADIOGROUP', 'T-IMG-HOLDS-CONTROLS', 'T-POINTER', 'T-DIALOG', 'T-MOVES', 'T-TOOL', 'T-NO-NAME']) want(!rep.findings.some(f => f.code === code), `no ${code}`);
const c = rep.checked?.['chromium wide'] || {};
want(c.tabStops >= 4 && c.keyed >= 4 && c.pointed >= 3, `Tab, keys and pointer ran (${JSON.stringify(c)})`);
want((rep.shots || []).length === 4 && rep.shots.every(s => fs.existsSync(path.join(out, s))), `a JPEG per scene and layout (${(rep.shots || []).length})`);
want(rep.errors > 0, 'the planted errors make the run fail (exit 1)');

if (all) {
  for (const bn of ['firefox', 'webkit']) {
    const { browsers: b, note: n } = await T.openBrowsers({ ...o, browsers: [bn] });
    if (!b[bn]) { console.log(`skip ${bn}: ${n}`); continue; }
    const r = await T.testOne(fixture, o, b);
    await b[bn].close();
    want(r.findings.some(f => f.code === 'T-NAME-HIDES-LABEL' && f.browser === bn), `${bn}: the same name finding`);
    want(!r.findings.some(f => f.code === 'T-PAGE-ERROR'), `${bn}: no page error`);
  }
}
console.log(`${fails ? 'FAIL' : 'PASS'} t1-test-browser: ${fails} failed, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(fails ? 1 : 0);
