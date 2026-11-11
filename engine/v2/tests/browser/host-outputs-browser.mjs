// The host hears outputs on a packed page (10.6, 5.16; C1 gap 8). Run alone (it starts a browser):
//   PW_PATH=<folder with node_modules/playwright> node engine/v2/tests/browser/host-outputs-browser.mjs
// It packs tests/host-fixture into a temp folder, with a host profile that grants openUrl, opens it from file://, listens with window.hsvg.player.on(name, fn)
// and with the host API's on (window.hsvg.host), clicks Order with the real mouse, and checks that both hear
// openUrl ({field, with}) and the experience record a scene adds, and that the page makes no request of its own.
// Playwright must already be installed (it is never a dependency).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pack } from '../../tools/pack.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-host-outputs-'));
const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
let browser;
try {
  // The person packing is the page's host (--host): it gives openUrl, which a page with no host profile never has (10.5).
  const host = JSON.stringify({ format: 'hsvg/2.0', kind: 'host-profile', id: 'test-host', grants: { openUrl: true } });
  const r = await pack(path.join(here, '..', 'host-fixture'), out, { test: true, host });
  browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  const pageErrors = []; const requests = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('request', q => requests.push(q.url()));
  await page.goto(pathToFileURL(r.htmlPath).href + '?clock=manual');
  await page.waitForFunction(() => window.hsvgReady === true || window.hsvgError, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.hsvgError || null);
  want(!err, `the packed page starts${err ? `: ${err}` : ''}`);
  await page.evaluate(() => {
    window.heard = { player: [], host: [] };
    for (const n of ['openUrl', 'orders', 'entered']) {
      window.hsvg.player.on(n, (e) => window.heard.player.push(JSON.parse(JSON.stringify(e))));
      window.hsvg.host.on(n, (e) => window.heard.host.push(JSON.parse(JSON.stringify(e))));
    }
  });
  await page.click('[id$="one__button"]');
  await page.evaluate(() => window.hsvg.advance(0));
  const heard = await page.evaluate(() => window.heard);
  console.log(`player heard: ${JSON.stringify(heard.player)}`);
  console.log(`host heard: ${JSON.stringify(heard.host)}`);
  for (const who of ['player', 'host']) {
    const list = heard[who];
    const open = list.find(e => e.name === 'openUrl');
    const row = list.find(e => e.name === 'orders');
    want(open && open.detail.field === 'clickUrl' && open.detail.with?.from === 'fixture', `${who}.on('openUrl') hears {field, with}`);
    want(row && row.detail.row?.item === 'bread' && row.detail.filler === 'human' && typeof row.detail.atMs === 'number', `${who}.on('orders') hears the row a scene adds`);
    want(list.length === 2, `${who} hears each output once (${list.length})`);
  }
  // The page reports openUrl to its host; it does not open the address itself.
  want(requests.every(u => /^(file|data|blob):/i.test(u)), `no request outside file:, data: and blob: (${requests.filter(u => !/^(file|data|blob):/i.test(u)).join(', ')})`);
  want(!pageErrors.length, `no page errors (${pageErrors.join(' | ')})`);
  const errors = await page.evaluate(() => window.hsvg.errors.slice());
  want(!errors.length, `no engine errors (${errors.join(' | ')})`);
} catch (e) {
  problems.push(String(e?.stack || e));
  console.log(e);
} finally {
  await browser?.close();
  fs.rmSync(out, { recursive: true, force: true });
}
console.log(problems.length ? `host outputs browser run: FAIL (${problems.length})` : 'host outputs browser run: pass');
process.exit(problems.length ? 1 : 0);
