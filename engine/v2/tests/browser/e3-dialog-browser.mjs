// A shell dialog is a real dialog (10.3), on e3-dialog-fixture/files.mjs.
// Run alone: node engine/v2/tests/browser/e3-dialog-browser.mjs   (PW_BROWSER=webkit for WebKit)
// Checks, opened by a press and by the keys: role dialog, aria-modal and the name; inert on the rest, and the
// accessibility tree no longer lists the controls behind; Tab and Shift+Tab cycle inside; Escape closes; focus returns
// to the opener; inert and the dialog's attributes are gone after closing.
// Playwright must already be installed (PW_PATH; PW_CHANNEL=chrome uses the installed browser).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadSchemas } from '../../schema/load.mjs';
import { files as fixture } from './e3-dialog-fixture/files.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const engine = pw[process.env.PW_BROWSER || 'chromium'];
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
const browser = await engine.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const focused = () => page.evaluate(() => document.activeElement?.id?.replace(/^hsvg\d+__/, '') || document.activeElement?.tagName);
const attrs = () => page.evaluate(() => { const d = document.querySelector('[data-hsvg-slot="conv"]'); return { role: d.getAttribute('role'), modal: d.getAttribute('aria-modal'), name: d.getAttribute('aria-label') }; });
const inerts = () => page.evaluate(() => ({ stage: !!document.querySelector('[data-player-stage]')?.closest('[inert]'), go: !!document.querySelector('[id$="a__go"]').closest('[inert]'), card: !!document.querySelector('[data-hsvg-slot="conv"]').closest('[inert]'), any: document.querySelectorAll('[inert]').length }));
// The accessibility tree: the browser's own in Chromium (CDP, as `button "Name"` lines), else Playwright's aria snapshot.
let cdp = null;
let hiddenBefore = 0;
const tree = async () => {
  if ((process.env.PW_BROWSER || 'chromium') === 'chromium') {
    cdp ??= await page.context().newCDPSession(page);
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    return nodes.filter(n => !n.ignored && n.name?.value).map(n => `${n.role.value} "${n.name.value}"`).join('\n');
  }
  return page.locator('body').ariaSnapshot();
};
const opened = async (how) => {
  await page.waitForTimeout(50);
  const a = await attrs();
  want(a.role === 'dialog' && a.modal === 'true' && a.name === 'Conventions', `${how}: the open slot is a dialog, aria-modal, named Conventions (${JSON.stringify(a)})`);
  const i = await inerts();
  want(i.stage && i.go && !i.card, `${how}: the stage is inert, the dialog is not (${JSON.stringify(i)})`);
  const t = await tree();
  if (process.env.E3_TREE) console.log(t);
  want(/dialog "Conventions"/.test(t) && /button "Close"/.test(t) && /button "Other"/.test(t) && !/button "Go"/.test(t) && !/button "Info"/.test(t), `${how}: the accessibility tree lists the dialog's controls only`);
  const f = await focused();
  want(/other$/.test(f), `${how}: focus is on the dialog's first control (${f})`);
  await page.keyboard.press('Tab'); const f1 = await focused();
  await page.keyboard.press('Tab'); const f2 = await focused();
  want(/close$/.test(f1) && /other$/.test(f2), `${how}: Tab goes Other, Close, Other (${f1}, ${f2})`);
  await page.focus('[data-hsvg-slot="conv"] [id$="__other"]'); // start at the first, whatever Tab did
  await page.keyboard.press('Shift+Tab'); const b1 = await focused();
  await page.keyboard.press('Shift+Tab'); const b2 = await focused();
  want(/close$/.test(b1) && /other$/.test(b2), `${how}: Shift+Tab goes back round: Close, Other (${b1}, ${b2})`);
};
const closed = async (how, opener) => {
  await page.waitForTimeout(50);
  const a = await attrs();
  want(a.role === null && a.modal === null && a.name === null, `${how}: the dialog's role, aria-modal and name are gone (${JSON.stringify(a)})`);
  const i = await inerts();
  want(i.any === 0, `${how}: no inert is left (${JSON.stringify(i)})`);
  const hidden = await page.evaluate(() => document.querySelectorAll('[aria-hidden]:not([data-hsvg-ring])').length);
  want(hidden === hiddenBefore, `${how}: aria-hidden is as it was before the dialog (${hidden}, ${hiddenBefore})`);
  const f = await focused();
  want(f === opener, `${how}: focus returns to the opener (${f})`);
  const t = await tree();
  want(/button "Go"/.test(t) && /button "Info"/.test(t), `${how}: the stage's controls are back in the tree`);
};
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/engine/v2/web/index.html?clock=manual`);
  await page.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
  want((await attrs()).role !== 'dialog', 'closed, the slot is no dialog');
  want((await inerts()).any === 0, 'closed, nothing is inert');
  hiddenBefore = await page.evaluate(() => document.querySelectorAll('[aria-hidden]:not([data-hsvg-ring])').length);
  const root = await page.evaluate(() => document.querySelector('[data-hsvg-slot="conv"] [id$="close"]')?.closest('svg')?.getAttribute('role'));
  want(root !== 'img', `the card's root is not an image while it holds controls (${root})`);

  // By the keys: focus Info, Enter.
  await page.focus('[id$="a__info"]'); await page.keyboard.press('Enter');
  await opened('keys');
  await page.keyboard.press('Escape');
  await closed('Escape', 'a__info');

  // By a press: click Info; Close by a press.
  await page.click('[id$="a__info"]');
  await opened('press');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await closed('Close', 'a__info');
} finally {
  await browser.close();
  server.close();
}
want(pageErrors.length === 0, `no page errors ${pageErrors.join('; ')}`);
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nall passed');
process.exit(problems.length ? 1 : 0);
