// Polish checks in a real browser. Run alone (it starts a browser):
//   node engine/v2/tests/browser/k2g-polish-browser.mjs
// - A2: a control's accessible name follows 10.13 on the page: its `label`, else its target's data-hsvg-label, else
//   the words drawn in it. Packed pages of the guide's lamp (docs/guide/examples/lamp), changed in a temp folder.
// - A5: test.mjs --min-width <px> runs the phone pass at that width, and its touch and text rules apply there.
// Playwright must already be installed (PW_PATH, or a global install). It is never a dependency.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const { pack } = await import(pathToFileURL(path.join(repo, 'engine', 'v2', 'tools', 'pack.mjs')).href);
const { testOne } = await import(pathToFileURL(path.join(repo, 'engine', 'v2', 'tools', 'test.mjs')).href);
const { launchBrowser } = await import(pathToFileURL(path.join(repo, 'engine', 'v2', 'tools', 'proof', 'browser.mjs')).href);
const lamp = path.join(repo, 'docs', 'guide', 'examples', 'lamp');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-k2g-'));

const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };

// A copy of the lamp: words(true) keeps the switch's drawn words; partLabel puts data-hsvg-label on the switch part;
// label gives the control a label.
function variantOfLamp(name, { words = true, partLabel = null, label = null }) {
  const dir = path.join(tmp, name);
  fs.cpSync(lamp, dir, { recursive: true });
  let svg = fs.readFileSync(path.join(dir, 'lamp.svg'), 'utf8');
  if (!words) svg = svg.replace(/\s*<text id="switch-words"[^>]*>[^<]*<\/text>/, '');
  if (partLabel) svg = svg.replace('<g id="switch" data-hsvg-kind="part"', `<g id="switch" data-hsvg-kind="part" data-hsvg-label="${partLabel}"`);
  fs.writeFileSync(path.join(dir, 'lamp.svg'), svg);
  const scene = JSON.parse(fs.readFileSync(path.join(dir, 'lamp.json'), 'utf8'));
  if (!words) scene.bindings = scene.bindings.filter(b => b.target !== 'switch-words');
  if (label) scene.controls.switch.label = label;
  fs.writeFileSync(path.join(dir, 'lamp.json'), JSON.stringify(scene, null, 1));
  return dir;
}

const browser = await launchBrowser();
async function nameOf(dir) {
  const out = path.join(dir, 'out');
  const k = await pack(dir, out, { test: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto(pathToFileURL(k.htmlPath).href);
  await page.waitForFunction(() => document.querySelector('[id$="lamp__switch"]')?.getAttribute('role') === 'checkbox', null, { timeout: 15000 });
  const r = await page.evaluate(() => { const e = document.querySelector('[id$="lamp__switch"]'); return { label: e.getAttribute('aria-label'), text: e.textContent.replace(/\s+/g, ' ').trim() }; });
  await page.close();
  return { ...r, errors };
}

try {
  let r = await nameOf(variantOfLamp('part-label', { words: false, partLabel: 'Light switch' }));
  want(r.label === 'Light switch' && !r.errors.length, `no label and no words: the part's data-hsvg-label names the control (${JSON.stringify(r)})`);
  r = await nameOf(variantOfLamp('both', { words: false, partLabel: 'Light switch', label: 'Lamp power' }));
  want(r.label === 'Lamp power', `the control's label wins over the part's data-hsvg-label (${JSON.stringify(r)})`);
  r = await nameOf(variantOfLamp('words', {}));
  want(r.label === null && r.text === 'Turn on', `no label and no data-hsvg-label: no aria-label, the drawn words name it (${JSON.stringify(r)})`);
  // A5: the lamp is clean at 390 px; at 140 px its words and its switch are too small.
  const at = async (w) => testOne(lamp, { kits: {}, allow: [], thresholds: {}, browsers: ['chromium'], shots: false, quick: true, minWidth: w, out: path.join(tmp, `w${w}`) }, { chromium: browser });
  let rep = await at(390);
  want(rep.phoneWidth === 390 && Object.keys(rep.browsers.chromium).join() === 'wide,phone' && !rep.findings.length, `--min-width 390 with --quick: a phone pass, clean (${JSON.stringify(rep.findings)})`);
  rep = await at(140);
  const phone = rep.findings.filter(f => f.layout === 'phone').map(f => f.code).sort();
  want(phone.includes('T-TEXT-SMALL') && phone.includes('T-HIT-SMALL') && !rep.findings.some(f => f.layout === 'wide'), `--min-width 140: the phone pass at 140 px finds small words and a small switch (${phone.join(', ')})`);
} finally {
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(problems.length ? `${problems.length} problem(s)` : 'k2g polish browser: all ok');
process.exit(problems.length ? 1 : 0);
