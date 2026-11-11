// The quiz template's focus after "Next" (F1a item 5). Run alone (it starts a browser):
//   PW_PATH=<folder with node_modules/playwright> node engine/v2/tests/browser/f1a-quiz-focus-browser.mjs
// It makes the quiz template with `hsvg new` (tools/library.mjs) in a temp folder, packs it and plays it by keyboard
// only: Tab to the answers, an arrow to answer D, Space, Tab to "Next", Enter. The answers are one tab stop (5.11), so
// focus must land on the group's stop (answer A, nothing is checked), not on the last answer. Then the same once more.
// Playwright must already be installed (it is never a dependency).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pack } from '../../tools/pack.mjs';
import { newFromTemplate } from '../../tools/library.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-f1a-quiz-'));
const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
let browser;
try {
  const made = await newFromTemplate('my-quiz', 'quiz', work);
  const r = await pack(made.dir, path.join(work, 'out'), {});
  browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  const page = await browser.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(r.htmlPath).href);
  await page.waitForFunction(() => window.hsvgReady === true || window.hsvgError, null, { timeout: 60000 });
  const focused = () => page.evaluate(() => { const a = document.activeElement; return a ? { role: a.getAttribute('role'), label: a.getAttribute('aria-label') || a.textContent.trim(), id: a.id } : null; });
  const key = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(150); };
  // Tab until focus is on a radio.
  for (let i = 0; i < 6; i++) { await key('Tab'); if ((await focused())?.role === 'radio') break; }
  const first = await focused();
  want(first?.role === 'radio', `Tab reaches the answers: ${JSON.stringify(first)}`);
  for (const round of [1, 2]) {
    await key('End'); // answer D, the last
    await key('Space');
    for (let i = 0; i < 6; i++) { await key('Tab'); const f = await focused(); if (f?.role === 'button') break; }
    const next = await focused();
    want(next?.role === 'button' && /next/i.test(next.label), `round ${round}: Tab reaches Next: ${JSON.stringify(next)}`);
    await key('Enter');
    const after = await focused();
    want(after?.role === 'radio' && after.id === first.id, `round ${round}: after Next, focus is on the first answer (${first.id}), not the last: ${JSON.stringify(after)}`);
  }
  want(!errors.length, `no page errors (${errors.join(' | ')})`);
} catch (e) {
  problems.push(String(e?.stack || e));
  console.log(e);
} finally {
  await browser?.close();
  fs.rmSync(work, { recursive: true, force: true });
}
console.log(problems.length ? `f1a-quiz-focus-browser: FAIL (${problems.length})` : 'f1a-quiz-focus-browser: ok');
process.exit(problems.length ? 1 : 0);
