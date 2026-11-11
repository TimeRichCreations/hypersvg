// The proof tool's baked-page measure (A7.1): the Ad Studio's exported pages, each opened at its baked size
// in a real browser. A text that leaves its cell or is drawn below the floor fails; the measure itself is shown to
// catch both on a moved and on a small text. Run alone (it starts a browser):
//   node engine/v2/tests/browser/baked-browser.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
process.env.HSVG_REPO = repo;
const { exportAds } = await import(pathToFileURL(path.join(repo, 'examples', '2.0-ad-studio', 'export.mjs')).href);
const { buildProduct } = await import(pathToFileURL(path.join(repo, 'engine', 'v2', 'tools', 'proof', 'build.mjs')).href);
const { launchBrowser } = await import(pathToFileURL(path.join(repo, 'engine', 'v2', 'tools', 'proof', 'browser.mjs')).href);
const { measureBaked, measureTexts } = await import(pathToFileURL(path.join(repo, 'engine', 'v2', 'tools', 'proof', 'baked.mjs')).href);

const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-baked-'));
const browser = await launchBrowser();
try {
  const sizes = ['300x250', '728x90', '160x600'];
  await exportAds({ sizes }, path.join(tmp, 'export'), { date: '2026-11-07T00:00:00Z' });
  for (const size of sizes) {
    const build = await buildProduct(path.join(tmp, 'export', size, 'source'), path.join(tmp, 'packed', size));
    const r = await measureBaked(browser, build);
    want(r.result === 'pass' && r.sizes.length === 1 && r.sizes[0].size === size, `${size}: each text inside its cell, at or above ${r.floor} px${r.result !== 'pass' ? `: ${JSON.stringify(r.sizes)}` : ''}`);
  }
  // The measure fails a text moved out of its cell, and a text below the floor.
  const build = await buildProduct(path.join(tmp, 'export', '300x250', 'source'), path.join(tmp, 'packed', 'moved'));
  const context = await browser.newContext({ viewport: { width: 300, height: 250 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(pathToFileURL(build.file).href);
  await page.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
  const texts = [{ target: 'body', region: 'body-box' }];
  want((await measureTexts(page, texts, 12)).length === 0, 'the body text is measured inside its cell');
  await page.evaluate(() => { const el = document.querySelector('[id$="__body"]'); el.setAttribute('transform', `${el.getAttribute('transform') || ''} translate(0 400)`); });
  const moved = await measureTexts(page, texts, 12);
  want(moved.some(p => /leaves its cell/.test(p.problem)), `a moved text leaves its cell: ${JSON.stringify(moved)}`);
  const small = await measureTexts(page, texts, 200);
  want(small.some(p => /below the floor/.test(p.problem)), 'a text below the floor fails');
  await context.close();
} finally { await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
if (problems.length) { console.log(`\n${problems.length} problem(s)`); process.exit(1); }
console.log('baked browser run: pass');
