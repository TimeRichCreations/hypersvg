// D56: a HyperSVG placed with integrity, in a real browser. Run alone (it starts a browser):
//   node engine/v2/tests/browser/asset-integrity-browser.mjs
// Checks:
// - the lean entry (web/asset-lean.mjs): <hypersvg-asset integrity="sha256-..."> with the right value plays, and its
//   attributes set its inputs; the network log shows no schema file and no validation, kit or add-on module fetched;
// - a wrong value is refused (E-ASSET-INTEGRITY): nothing plays and nothing of the file shows (D58); with no fallback
//   the element stays empty, with a fallback it keeps the fallback;
// - hostile files the host approved by mistake (their own integrity): a script, an event handler, a javascript:
//   link, an outside picture. Each is refused by the safety pass; no SVG node from a refused file ever enters the
//   page (a MutationObserver watches from the start); no script runs;
// - mountAsync with and without a match; an element without integrity on the lean page loads the checker then, and
//   the schemas;
// - asset-web.mjs takes integrity too.
// Playwright must already be installed (PW_PATH; PW_CHANNEL=chrome uses the installed browser).
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { packAsset } from '../../tools/pack.mjs';
import { readAsset, makeAsset } from '../../src/asset.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const engine = pw[process.env.PW_BROWSER || 'chromium'];

const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'd56-'));
const sri = (text) => `sha256-${crypto.createHash('sha256').update(text, 'utf8').digest('base64')}`;

// ---------- Node side: the files the pages are given ----------
const fixture = path.join(repo, 'engine', 'v2', 'tests', 'k2f-fixture');
const lamp = fs.readFileSync((await packAsset(fixture, temp())).svgPath, 'utf8');
const resealed = (edit, rel = null) => {
  const a = readAsset(lamp);
  rel ??= a.drawing;
  return makeAsset({ id: a.id, drawing: a.drawing, files: { ...a.files, [rel]: edit(a.files[rel]) } });
};
const changed = resealed((t) => t.replace('"label": "Brightness"', '"label": "Dimmer"'), 'scenes/lamp/scene.json');
const HOSTILE = {
  script: resealed((t) => t.replace('</svg>', '<script>window.hacked = "script"</script></svg>')),
  handler: resealed((t) => t.replace('<title>', '<rect width="400" height="400" onmouseover="window.hacked = \'handler\'" onload="window.hacked = \'load\'"/><title>')),
  link: resealed((t) => t.replace('</svg>', '<a href="javascript:window.hacked=\'link\'"><rect width="400" height="400"/></a></svg>')),
  outside: resealed((t) => t.replace('</svg>', '<image href="/outside.png" width="9" height="9"/></svg>')),
};
const LEAN = '/engine/v2/web/asset-lean.mjs';
const watch = `<script>
window.leaked = [];
new MutationObserver((records) => { for (const r of records) for (const n of r.addedNodes) {
  const all = n.nodeType === 1 ? [n, ...n.querySelectorAll('*')] : [];
  for (const el of all) { const host = el.closest('hypersvg-asset'); if (host && host.dataset.hostile !== undefined && el.namespaceURI === 'http://www.w3.org/2000/svg') window.leaked.push(host.id + ':' + el.localName); }
} }).observe(document.documentElement, { childList: true, subtree: true });
</script>`;
const box = '<style>hypersvg-asset{display:block;width:400px;height:300px}</style>';

const virtual = {
  '/lamp.svg': ['image/svg+xml', lamp],
  '/changed.svg': ['image/svg+xml', changed],
  ...Object.fromEntries(Object.entries(HOSTILE).map(([k, v]) => [`/hostile-${k}.svg`, ['image/svg+xml', v]])),
  '/lean.html': ['text/html', `<!doctype html><meta charset="utf-8">${watch}${box}
<script type="module" src="${LEAN}"></script>
<hypersvg-asset id="good" src="/lamp.svg" integrity="${sri(lamp)}" bright="0.25"></hypersvg-asset>
<hypersvg-asset id="bad" src="/changed.svg" integrity="${sri(lamp)}"></hypersvg-asset>
<hypersvg-asset id="badfb" src="/changed.svg" integrity="${sri(lamp)}"><img src="/lamp.svg" alt="fallback"></hypersvg-asset>
${Object.entries(HOSTILE).map(([k, v]) => `<hypersvg-asset id="${k}" data-hostile src="/hostile-${k}.svg" integrity="${sri(v)}"></hypersvg-asset>`).join('\n')}`],
  '/mount.html': ['text/html', `<!doctype html><meta charset="utf-8"><div id="a" style="width:400px;height:300px"></div>
<script type="module">
import { mountAsync } from '${LEAN}';
const bytes = new Uint8Array(await fetch('/lamp.svg').then(r => r.arrayBuffer()));
const out = {};
try { const h = await mountAsync(document.getElementById('a'), bytes, { on: true }, { integrity: '${sri(lamp)}' }); out.on = h.read('on'); out.svg = document.querySelectorAll('#a svg').length; } catch (e) { out.error = e.code + ' ' + e.message; }
try { await mountAsync(document.createElement('div'), bytes, {}, { integrity: '${sri(changed)}' }); out.bad = 'played'; } catch (e) { out.bad = e.code; }
window.result = out;
</script>`],
  '/mixed.html': ['text/html', `<!doctype html><meta charset="utf-8">${box}
<script type="module" src="${LEAN}"></script>
<hypersvg-asset id="plain" src="/lamp.svg"></hypersvg-asset>`],
  '/web.html': ['text/html', `<!doctype html><meta charset="utf-8">${box}
<script type="module" src="/engine/v2/web/asset-web.mjs"></script>
<hypersvg-asset id="sri" src="/lamp.svg" integrity="${sri(lamp)}"></hypersvg-asset>
<hypersvg-asset id="wrong" src="/changed.svg" integrity="${sri(lamp)}"></hypersvg-asset>`],
};

const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const v = virtual[url.pathname];
  if (v) { res.writeHead(200, { 'content-type': v[0] }); return res.end(v[1]); }
  const p = path.join(repo, ...url.pathname.split('/').filter(Boolean).map(decodeURIComponent));
  if (!p.startsWith(repo) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await engine.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const pageErrors = [];
const open = async (url) => {
  const tab = await browser.newPage({ viewport: { width: 1000, height: 1400 }, deviceScaleFactor: 1 });
  const requests = [];
  tab.on('request', (r) => requests.push(new URL(r.url()).pathname));
  tab.on('pageerror', e => pageErrors.push(`${url}: ${e.message}`));
  tab.on('dialog', (d) => { pageErrors.push(`${url}: a dialog opened`); d.dismiss(); });
  await tab.goto(base + url);
  return { tab, requests };
};
const readyAll = (tab, ids) => tab.evaluate(async (ids) => {
  await customElements.whenDefined('hypersvg-asset');
  return Promise.all(ids.map(id => document.getElementById(id).ready.then(() => 'ready', e => e.code || e.message)));
}, ids);
const CHECKER = ['/spec/2.0/schemas/', 'schema/validate.mjs', 'schema/check-document.mjs', 'schema/drawing-check.mjs', 'schema/drafts.mjs', 'src/kit.mjs', 'src/addons.mjs', 'src/load.mjs', 'web/mount-web.mjs'];
const checkerIn = (requests) => requests.filter(r => CHECKER.some(c => r.includes(c)));

try {
  // ---------- the lean page: good, wrong and hostile values ----------
  {
    const { tab, requests } = await open('/lean.html');
    const ids = ['good', 'bad', 'badfb', ...Object.keys(HOSTILE)];
    const s = Object.fromEntries((await readyAll(tab, ids)).map((v, i) => [ids[i], v]));
    want(s.good === 'ready', `a matching integrity plays (${s.good})`);
    const good = await tab.evaluate(async () => {
      const el = document.getElementById('good');
      const before = el.read('bright');
      el.setAttribute('on', '');
      await new Promise(r => setTimeout(r, 50));
      return { svg: el.querySelectorAll('svg').length, before, on: el.read('on'), inputs: el.inputs().map(i => i.name).join(',') };
    });
    want(good.svg >= 1 && good.before === 0.25 && good.on === true && good.inputs === 'on,bright,shade', `the element plays and its attributes set its inputs: ${JSON.stringify(good)}`);
    want(s.bad === 'E-ASSET-INTEGRITY' && s.badfb === 'E-ASSET-INTEGRITY', `a wrong value is refused (${s.bad}, ${s.badfb})`);
    const still = await tab.evaluate(async () => {
      const el = document.getElementById('bad');
      const img = el.querySelector('img[data-hsvg-still]');
      if (img && !img.complete) await new Promise(r => { img.onload = img.onerror = r; });
      const fb = document.getElementById('badfb');
      return { mark: el.getAttribute('data-hsvg-refused'), kids: el.children.length, src: img?.src || '', width: img?.naturalWidth || 0, svg: el.querySelectorAll('svg').length,
        fb: fb.querySelectorAll('img').length, fbStill: fb.querySelectorAll('img[data-hsvg-still]').length, fbSvg: fb.querySelectorAll('svg').length };
    });
    want(still.mark === 'E-ASSET-INTEGRITY' && still.kids === 0 && still.src === '' && still.svg === 0, `a file that does not match shows nothing of itself (D58): ${JSON.stringify(still)}`);
    want(still.fb === 1 && still.fbStill === 0 && still.fbSvg === 0, 'a refused file with a fallback keeps the fallback');
    for (const k of Object.keys(HOSTILE)) want(s[k] === 'E-SVG-UNSAFE', `hostile ${k}, approved by its own integrity: refused by the safety pass (${s[k]})`);
    // Move the pointer over every element and click each one: a handler or a link would run now if it were there.
    for (const k of Object.keys(HOSTILE)) { const el = await tab.$(`#${k}`); await el.hover().catch(() => {}); await el.click().catch(() => {}); }
    await tab.waitForTimeout(200);
    const after = await tab.evaluate(() => ({
      leaked: window.leaked, hacked: window.hacked ?? null,
      svgs: [...document.querySelectorAll('hypersvg-asset[data-hostile]')].map(el => el.querySelectorAll('svg, script, a, image').length),
      handlers: [...document.querySelectorAll('*')].filter(el => [...el.attributes].some(a => /^on./i.test(a.name))).map(el => `${el.localName}#${el.id} ${[...el.attributes].map(a => a.name).join(' ')}`),
    }));
    want(after.leaked.length === 0, `no SVG node from a refused file ever entered the page: ${after.leaked.join(', ') || 'none'}`);
    want(after.hacked === null && after.handlers.length === 0 && after.svgs.every(n => n === 0), `no script ran, no handler is in the page: ${JSON.stringify(after)}`);
    want(!requests.includes('/outside.png'), 'the outside picture was never fetched');
    want(checkerIn(requests).length === 0, `with integrity, no schema and no checker module is fetched: ${checkerIn(requests).join(', ') || 'none'}`);
    want(requests.includes('/engine/v2/src/asset-safety.mjs') && requests.includes('/engine/v2/web/player-web.mjs'), 'the safety pass and the player are fetched');
    await tab.close();
  }

  // ---------- mountAsync ----------
  {
    const { tab, requests } = await open('/mount.html');
    await tab.waitForFunction(() => window.result);
    const r = await tab.evaluate(() => window.result);
    want(r.on === true && r.svg >= 1 && !r.error, `mountAsync with a match plays, inputs checked: ${JSON.stringify(r)}`);
    want(r.bad === 'E-ASSET-INTEGRITY', `mountAsync with a wrong value is refused (${r.bad})`);
    want(checkerIn(requests).length === 0, `mountAsync with integrity fetches no schema and no checker: ${checkerIn(requests).join(', ') || 'none'}`);
    await tab.close();
  }

  // ---------- the lean page with an element without integrity: the full check, loaded then ----------
  {
    const { tab, requests } = await open('/mixed.html');
    const [s] = await readyAll(tab, ['plain']);
    want(s === 'ready', `without integrity the lean page loads the checker and plays (${s})`);
    want(requests.includes('/engine/v2/web/mount-checked.mjs') && requests.includes('/engine/v2/schema/check-document.mjs') && requests.some(r => r.includes('/spec/2.0/schemas/core/')), 'the checker and the schemas are fetched then');
    // N5: the full check of a HyperSVG carries no kit or add-on code either (src/load-asset.mjs).
    const kitCode = requests.filter(r => ['src/kit.mjs', 'src/addons.mjs', 'src/load.mjs', 'web/mount-web.mjs'].some(m => r.endsWith(m)));
    want(kitCode.length === 0, `the full check fetches no kit or add-on code: ${kitCode.join(', ') || 'none'}`);
    await tab.close();
  }

  // ---------- asset-web.mjs takes integrity too ----------
  {
    const { tab } = await open('/web.html');
    const s = await readyAll(tab, ['sri', 'wrong']);
    want(s[0] === 'ready' && s[1] === 'E-ASSET-INTEGRITY', `asset-web.mjs: a match plays, a wrong value is refused (${s.join(', ')})`);
    await tab.close();
  }
  want(pageErrors.length === 0, `no page errors${pageErrors.length ? `: ${pageErrors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  server.close();
}
console.log(problems.length ? `${problems.length} problems` : 'asset integrity browser: all checks pass');
process.exit(problems.length ? 1 : 0);
