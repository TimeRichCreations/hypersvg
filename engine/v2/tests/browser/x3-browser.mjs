// In a real browser: a faulting key: reaction stops play before the same keydown presses a shortcut, and the
// host is then refused (9.2, 10.6); the ambient size at mount and on resize, with changed:size (5.5); destroy leaves
// no listener, style or key ownership behind, so a second player hears keys (10.6).
// Fixture: x3-fixture/files.mjs. Run alone (it starts a browser):
//   node engine/v2/tests/browser/x3-browser.mjs
// Playwright must already be installed (PW_PATH; PW_CHANNEL=chrome uses the installed browser).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadSchemas } from '../../schema/load.mjs';
import { files as fixture } from './x3-fixture/files.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];
const files = Object.fromEntries(Object.entries(fixture).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
const schemas = JSON.stringify(loadSchemas(path.join(repo, 'spec', '2.0')));
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/files.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(files)); }
  if (url.pathname === '/schemas.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(schemas); }
  const p = path.join(repo, ...url.pathname.split('/').filter(Boolean).map(decodeURIComponent));
  if (!p.startsWith(repo) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': p.endsWith('.mjs') ? 'text/javascript' : 'text/html' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const read = (n) => page.evaluate((n) => window.hsvg.player.read('one', n), n);
const box = () => page.evaluate(() => window.hsvg.player.eval('one', 'box'));
const fresh = async () => {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(`http://127.0.0.1:${server.address().port}/engine/v2/web/index.html?clock=manual`);
  await page.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
};
try {
  // A. The key: reaction faults: play stops, and the same keydown never presses the shortcut Go.
  await fresh();
  await page.mouse.click(700, 500);
  await page.keyboard.press('KeyG');
  const stopped = await page.evaluate(() => window.hsvg.stopped);
  want(stopped?.code === 'E-RANGE', `a faulting key reaction stops play: ${JSON.stringify(stopped)}`);
  want(await read('n') === 0, 'the same keydown did not press Go after the stop');
  want(await page.evaluate(() => document.querySelectorAll('[data-hsvg-fault]').length) === 1, 'one fault message');
  want(await page.evaluate(() => window.hsvg.player.stopped?.code) === 'E-RANGE', 'the engine holds the stop');
  const hostCode = await page.evaluate(() => { try { window.hsvg.host.read('n'); return null; } catch (e) { return e.code; } });
  want(hostCode === 'E-HOST-CLOSED', `the host is refused after the stop: ${hostCode}`);

  // B. The ambient size: the player box and its shape from mount; changed:size on a resize, none for the same size.
  await fresh();
  want(await box() === 'landscape 800x600' && await read('sizes') === 0, `size at mount: ${await box()}, events ${await read('sizes')}`);
  await page.setViewportSize({ width: 300, height: 600 });
  await page.waitForFunction(() => window.hsvg.player.eval('one', 'box') === 'tall 300x600', null, { timeout: 5000 }).catch(() => {});
  const after = [await box(), await read('sizes')];
  want(after[0] === 'tall 300x600' && after[1] === 1, `a resize writes size once, with changed:size: ${JSON.stringify(after)}`);
  await page.setViewportSize({ width: 300, height: 600 });
  await page.waitForTimeout(200);
  want(await read('sizes') === 1, 'the same size again is no change');

  // C. destroy leaves nothing behind; a second player in another container then hears the keys.
  await fresh();
  const c = await page.evaluate(async () => {
    const styles = () => document.head.querySelectorAll('style').length;
    const before = styles();
    const div = document.createElement('div'); div.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:150px'; document.body.appendChild(div);
    const { boot } = await import('/engine/v2/web/player-web.mjs');
    const b = await boot(div, { filesUrl: '/files.json', schemasUrl: '/schemas.json', manualClock: true });
    const withTwo = styles();
    window.hsvg.host.destroy();
    window.second = b;
    return { before, withTwo, afterDestroy: styles(), emptied: document.getElementById('stage').childElementCount };
  });
  want(c.withTwo === c.before + 1 && c.afterDestroy === c.before, `destroy removes its style: ${JSON.stringify(c)}`);
  want(c.emptied === 0, 'destroy empties its container');
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('KeyG');
  const second = await page.evaluate(() => window.second.stopped?.code ?? null);
  want(second === 'E-RANGE', `after the first player is destroyed, the second hears the keys: ${second}`);
  want(!pageErrors.length, `no page errors ${pageErrors.join('; ')}`);
} finally {
  await browser.close();
  server.close();
}
console.log(problems.length ? `${problems.length} problems` : 'x3-browser: all ok');
process.exit(problems.length ? 1 : 0);
