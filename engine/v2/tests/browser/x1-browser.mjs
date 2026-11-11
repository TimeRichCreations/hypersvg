// Security fixes in a real browser, from file://. Run alone (it starts a browser):
//   node engine/v2/tests/browser/x1-browser.mjs
// A published packed page carries no test hooks: ?start= and ?clock=manual do nothing, and window.hsvg is the host
// API only (no player, no internal). A page packed with --test keeps the hooks.
// Playwright must already be installed (it is never a dependency).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pack } from '../../tools/pack.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-x1-'));
const problems = [];
const want = (c, m) => { console.log(`  ${c ? 'ok' : 'problem'}: ${m}`); if (!c) problems.push(m); };
let browser;
try {
  const game = path.join(repo, 'skill', '2.0', 'examples', 'kinds', 'game');
  const pub = await pack(game, path.join(out, 'pub'));
  const tst = await pack(game, path.join(out, 'test'), { test: true });
  browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  const open = async (file, query) => {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(file).href + query);
    await page.waitForFunction(() => window.hsvgReady === true || window.hsvgError, null, { timeout: 60000 });
    await page.waitForTimeout(300);
    const s = await page.evaluate(() => ({ err: window.hsvgError ?? null, scene: window.hsvg.player ? window.hsvg.player.scene : window.hsvg.scene('stage'), player: typeof window.hsvg.player, internal: typeof (window.hsvg.internal ?? window.hsvg.host?.internal), advance: typeof window.hsvg.advance, read: typeof window.hsvg.read }));
    await page.close();
    return { ...s, errors };
  };
  const a = await open(pub.htmlPath, '');
  want(!a.err && a.scene === 'play' && a.player === 'undefined' && a.internal === 'undefined' && a.advance === 'undefined' && a.read === 'function', `published, plain: the start scene and the host API only ${JSON.stringify(a)}`);
  const b = await open(pub.htmlPath, '?start=result&clock=manual');
  want(!b.err && b.scene === 'play' && b.player === 'undefined', `published, ?start=result: still the story's start ${JSON.stringify(b)}`);
  const c = await open(pub.htmlPath, '?start=nosuchscene');
  want(!c.err && c.scene === 'play', `published, ?start=nosuchscene: still the story's start ${JSON.stringify(c)}`);
  const d = await open(tst.htmlPath, '?start=result&clock=manual');
  want(!d.err && d.scene === 'result' && d.player === 'object' && d.internal === 'object' && d.advance === 'function', `--test page: the hooks work ${JSON.stringify(d)}`);
  for (const [n, r] of [['a', a], ['b', b], ['c', c], ['d', d]]) want(r.errors.length === 0, `no page errors (${n}): ${r.errors.join('; ')}`);
} catch (e) {
  problems.push(String(e.stack || e));
  console.log(e);
} finally {
  await browser?.close();
  fs.rmSync(out, { recursive: true, force: true });
}
console.log(problems.length ? `FAILED: ${problems.length} problems` : 'x1 browser: all good');
process.exit(problems.length ? 1 : 0);
