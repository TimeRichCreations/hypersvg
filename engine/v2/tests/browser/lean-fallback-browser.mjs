// The lean player's fallback to the full one-file player (added after 2.0.0-next.1), in a real browser. Run alone (it starts a browser):
//   node engine/v2/tests/browser/lean-fallback-browser.mjs
// Checks, with the module-tree asset-lean.mjs and fullPlayer pointing at the committed full one-file player:
// - a file without integrity plays through the full player, with no schemas given: the full player is fetched once,
//   with the query string given, and no schema file and no checker module is fetched;
// - a full player of another version, and an address that fails, refuse with E-ASSET; nothing of the file shows;
// - every option reaches the mount: colors, nonce, clock, onMove and onError are seen in the played piece, the same
//   as on the lean mount of a file with integrity;
// - the element without integrity plays the same way (FULL_PLAYER set, as the lean one-file player sets it);
// - under a typical and a strict content security policy, both paths play with no policy violation;
// - with the lean one-file player (hypersvg-asset-lean.js) where it is built: the same, with the default address of
//   the full player, which carries the lean file's own query string.
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
import { VERSION } from '../../src/version.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const engine = pw[process.env.PW_BROWSER || 'chromium'];

const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const sri = (text) => `sha256-${crypto.createHash('sha256').update(text, 'utf8').digest('base64')}`;
const web = (f) => path.join(repo, 'engine', 'v2', 'web', f);

// ---------- the lamp, with colour roles on its surface and switch ----------
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'lean-fallback-'));
const plain = fs.readFileSync((await packAsset(path.join(repo, 'engine', 'v2', 'tests', 'k2f-fixture'), out)).svgPath, 'utf8');
fs.rmSync(out, { recursive: true, force: true });
const a = readAsset(plain);
const files = { ...a.files };
files[a.drawing] = files[a.drawing].replace('<circle cx="268" cy="68" r="20" fill="#2563eb"/>', '<circle cx="268" cy="68" r="20" fill="#2563eb" data-hsvg-color="accent"/>');
const lamp = makeAsset({ id: a.id, drawing: a.drawing, files });
const PASS = { surface: '#0f172a', ink: '#f8fafc', accent: '#38bdf8', sun: '#facc15' };
const FAIL = { surface: '#0f172a', ink: '#334155', accent: '#38bdf8', sun: '#facc15' };
const NONCE = 'n2bN0nce';

// ---------- the files served ----------
const FULL = '/engine/v2/web/hypersvg-asset.js';
const LEAN_FILE = '/engine/v2/web/hypersvg-asset-lean.js';
const haveLeanFile = fs.existsSync(web('hypersvg-asset-lean.js'));
const fullText = fs.readFileSync(web('hypersvg-asset.js'), 'utf8');
const oldFull = fullText.split(`'${VERSION}'`).join("'2.0.0-old.0'");
// /fp/ serves the repository with FULL_PLAYER set in asset-schemas.mjs, as the lean one-file player sets it.
const schemasModule = fs.readFileSync(web('asset-schemas.mjs'), 'utf8').replace(/^export const FULL_PLAYER = .*$/m, '');
const fpSchemas = `${schemasModule}\nexport const FULL_PLAYER = new URL('./hypersvg-asset.js?ver=fp1', import.meta.url);\n`;

// The script of a test page: mounts by mountAsync (a file without integrity through the full player, and the same file
// with integrity on the lean mount, each with every option), then the element; it writes what it saw to window.out.
const script = (entry, { fullPlayer = null, element = true } = {}) => `
import { mountAsync } from '${entry}';
const out = window.out = { errors: {}, moves: {}, clock: {}, played: {}, refused: {} };
const lamp = await fetch('/lamp.svg').then(r => r.text());
const el = (id) => document.getElementById(id);
const opts = (id, colors = ${JSON.stringify(PASS)}) => ({
  colors, nonce: '${NONCE}', faultBox: false,
  clock: (ms) => { out.clock[id] = (out.clock[id] || 0) + 1; return 1700000000000 + ms; },
  onMove: (m) => { (out.moves[id] ??= []).push(m.source); },
  onError: (d) => { (out.errors[id] ??= []).push(d.code); },
});
const run = async (id, fn) => { try { out.played[id] = !!(await fn()); } catch (e) { out.refused[id] = [e.code || null, e.message]; } };
await run('full', () => mountAsync(el('full'), lamp, {}, { ...opts('full'), ${fullPlayer ? `fullPlayer: '${fullPlayer}'` : ''} }));
await run('fullFail', () => mountAsync(el('fullFail'), lamp, {}, { ...opts('fullFail', ${JSON.stringify(FAIL)}), ${fullPlayer ? `fullPlayer: '${fullPlayer}'` : ''} }));
await run('lean', () => mountAsync(el('lean'), lamp, {}, { ...opts('lean'), integrity: '${sri(lamp)}' }));
await run('leanFail', () => mountAsync(el('leanFail'), lamp, {}, { ...opts('leanFail', ${JSON.stringify(FAIL)}), integrity: '${sri(lamp)}' }));
${element ? `await customElements.whenDefined('hypersvg-asset');
out.element = await el('x').ready.then(() => 'ready', (e) => e.code || e.message);` : ''}
window.ready = true;
`;
const body = (element = true) => `<div class="p" id="full"></div><div class="p" id="fullFail"></div><div class="p" id="lean"></div><div class="p" id="leanFail"></div>
${element ? `<hypersvg-asset id="x" src="/lamp.svg" nonce="${NONCE}" colors="accent: #38bdf8; surface: #0f172a; ink: #f8fafc; sun: #facc15"></hypersvg-asset>` : ''}`;
const POLICIES = {
  none: null,
  typical: `script-src 'self'; style-src 'self' 'nonce-${NONCE}'`,
  strict: `script-src 'nonce-${NONCE}' 'strict-dynamic'; style-src 'nonce-${NONCE}'`,
};
// A page: its script is a file for the typical policy (no inline script there) and an inline script with the nonce
// otherwise.
const pages = {};
const scripts = {};
function addPage(name, entry, opt, policy) {
  const js = script(entry, opt);
  const src = `/t/${name}.js`;
  scripts[src] = js;
  const tag = policy === 'typical' ? `<script type="module" src="${src}"></script>` : `<script type="module" nonce="${NONCE}">${js}</script>`;
  pages[`/t/${name}.html`] = { policy: POLICIES[policy], html: `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/t/page.css" nonce="${NONCE}">${body(opt.element !== false)}${tag}` };
}
for (const policy of Object.keys(POLICIES)) {
  addPage(`modules-${policy}`, '/fp/engine/v2/web/asset-lean.mjs', { fullPlayer: `${FULL}?ver=given7` }, policy);
  if (haveLeanFile) addPage(`onefile-${policy}`, `${LEAN_FILE}?ver=L9`, {}, policy);
}
// The visibility check (input-web.mjs): with Element.checkVisibility() the player reads no computed style per control
// and ancestor; without it (taken away before the page runs) it walks them as before. The same controls are usable.
pages['/t/vis.html'] = { policy: null, html: `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/t/page.css"><div class="p" id="lean"></div><div class="p" id="full"></div>
<script type="module">
import { mountAsync } from '/engine/v2/web/asset-lean.mjs';
const lamp = await fetch('/lamp.svg').then(r => r.text());
const count = () => window.__styles;
const before = count();
const which = new URLSearchParams(location.search).get('which');
if (which === 'lean') await mountAsync(document.getElementById('lean'), lamp, {}, { integrity: '${sri(lamp)}' });
else await mountAsync(document.getElementById('full'), lamp, {}, { fullPlayer: '${FULL}' });
await new Promise(r => setTimeout(r, 100));
window.out = { styles: count() - before, controls: [...document.querySelectorAll('#lean svg *, #full svg *')].filter(e => e.hasAttribute('tabindex')).map(e => e.id + ':' + e.getAttribute('tabindex') + ':' + (e.getAttribute('aria-disabled') || '')) };
window.ready = true;
</script>` };
addPage('old', '/engine/v2/web/asset-lean.mjs', { fullPlayer: '/old/hypersvg-asset.js', element: false }, 'none');
addPage('gone', '/engine/v2/web/asset-lean.mjs', { fullPlayer: '/nowhere/hypersvg-asset.js', element: false }, 'none');

const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (type, text, extra = {}) => { res.writeHead(200, { 'content-type': type, ...extra }); res.end(text); };
  if (url.pathname === '/lamp.svg') return send('image/svg+xml', lamp);
  if (url.pathname === '/t/page.css') return send('text/css', 'body{margin:0}div.p,hypersvg-asset{display:block;width:300px;height:200px}');
  if (url.pathname === '/old/hypersvg-asset.js') return send('text/javascript', oldFull);
  if (scripts[url.pathname]) return send('text/javascript', scripts[url.pathname]);
  if (pages[url.pathname]) return send('text/html', pages[url.pathname].html, pages[url.pathname].policy ? { 'content-security-policy': pages[url.pathname].policy } : {});
  if (url.pathname === '/fp/engine/v2/web/asset-schemas.mjs') return send('text/javascript', fpSchemas);
  const rel = url.pathname.replace(/^\/fp\//, '/');
  const p = path.join(repo, ...rel.split('/').filter(Boolean).map(decodeURIComponent));
  if (!p.startsWith(repo) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await engine.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const pageErrors = [];

async function open(url, { noCheckVisibility = false } = {}) {
  const tab = await browser.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1 });
  const requests = [];
  tab.on('request', (r) => { const u = new URL(r.url()); requests.push(u.pathname + u.search); });
  tab.on('pageerror', e => pageErrors.push(`${url}: ${e.message}`));
  if (noCheckVisibility) await tab.addInitScript(() => { delete Element.prototype.checkVisibility; });
  await tab.addInitScript(() => {
    window.__styles = 0;
    const gcs = window.getComputedStyle;
    window.getComputedStyle = function (...a) { window.__styles++; return gcs.apply(this, a); };
    window.__violations = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__violations.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await tab.goto(base + url);
  await tab.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  return { tab, requests };
}
// What each placed piece shows: its surface colour and whether it holds markup; and the styles the players added to
// the page's head (one per player, each with the page's nonce when it is given).
const seen = (tab) => tab.evaluate((ids) => ({
  ...Object.fromEntries(ids.map((id) => {
    const root = document.getElementById(id);
    return [id, {
      surface: root?.querySelector('svg > rect[data-hsvg-color="surface"]')?.getAttribute('fill') ?? null,
      accent: root?.querySelector('circle[data-hsvg-color="accent"]')?.getAttribute('fill') ?? null,
      markup: !!root?.querySelector('svg'),
    }];
  })),
  styles: [...document.head.querySelectorAll('style')].map(s => s.nonce),
}), ['full', 'fullFail', 'lean', 'leanFail', 'x']);
async function pressSwitch(tab, id) {
  const sw = await tab.$(`#${id} svg [id$="switch"]`);
  if (!sw) return false;
  const b = await sw.boundingBox();
  await tab.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await tab.waitForTimeout(100);
  return true;
}

async function playsThroughFull(name, what, fullRequest) {
  const { tab, requests } = await open(`/t/${name}.html`);
  const out = await tab.evaluate(() => window.out);
  want(out.played.full && out.played.lean, `${what}: a file without integrity plays through the full player, with no schemas given; with integrity on the lean mount (${JSON.stringify(out.refused)})`);
  const fulls = requests.filter(r => r.startsWith(FULL));
  want(fulls.length === 1 && fulls[0] === fullRequest, `${what}: the full player is fetched once, as ${fullRequest} (${fulls.join(', ') || 'never'})`);
  const extra = requests.filter(r => /\/spec\/2\.0\/schemas\/|mount-checked\.mjs|load-asset\.mjs|schema\/(validate|check-document|drawing-check)\.mjs/.test(r));
  want(!extra.length, `${what}: no schema file and no checker module is fetched (${extra.join(', ') || 'none'})`);
  const s = await seen(tab);
  want(s.full.surface === PASS.surface && s.lean.surface === PASS.surface && s.full.accent === PASS.accent, `${what}: colors reach both mounts (${s.full.surface}, ${s.lean.surface})`);
  const players = out.element !== undefined ? 5 : 4;
  want(s.styles.length >= players && s.styles.every(n => n === NONCE), `${what}: the nonce is on every style the players add, through both mounts and the element (${s.styles.filter(n => n === NONCE).length} of ${s.styles.length}, ${players} players)`);
  want((out.errors.fullFail || []).includes('W-HOST-COLOR-CONTRAST') && (out.errors.leanFail || []).includes('W-HOST-COLOR-CONTRAST'), `${what}: onError hears the refused colours on both mounts (${JSON.stringify(out.errors)})`);
  want(s.fullFail.surface !== FAIL.surface, `${what}: the refused colours do not apply`);
  // A press: onMove hears it and the host clock is read, on both mounts.
  for (const id of ['full', 'lean']) await pressSwitch(tab, id);
  const after = await tab.evaluate(() => window.out);
  want((after.moves.full || []).includes('activate') && (after.moves.lean || []).includes('activate'), `${what}: onMove hears the press on both mounts (${JSON.stringify(after.moves)})`);
  want((after.clock.full || 0) > 0 && (after.clock.lean || 0) > 0, `${what}: the host clock is read on both mounts (${after.clock.full || 0}, ${after.clock.lean || 0})`);
  if (out.element !== undefined) {
    want(out.element === 'ready' && s.x.surface === PASS.surface, `${what}: the element without integrity plays the same way (${out.element}, ${s.x.surface})`);
  }
  const v = await tab.evaluate(() => window.__violations);
  want(!v.length, `${what}: no policy violation (${v.join(' | ') || 'none'})`);
  await tab.close();
}

try {
  want(/checkedParts/.test(fullText), 'the committed full one-file player exports checkedParts');
  for (const policy of Object.keys(POLICIES)) await playsThroughFull(`modules-${policy}`, `modules, policy ${policy}`, `${FULL}?ver=given7`);
  {
    const { tab, requests } = await open('/t/old.html');
    const out = await tab.evaluate(() => window.out);
    const [c, m] = out.refused.full || [];
    want(c === 'E-ASSET' && m.includes('2.0.0-old.0') && m.includes(VERSION), `a full player of another version refuses with E-ASSET naming both versions (${c}: ${m})`);
    want(out.played.lean, 'a file with integrity still plays on that page');
    want(requests.filter(r => r.startsWith('/old/')).length === 1, 'the refused full player was fetched once for two mounts');
    want(!(await seen(tab)).full.markup, 'nothing of the refused file shows');
    await tab.close();
  }
  {
    const { tab } = await open('/t/gone.html');
    const out = await tab.evaluate(() => window.out);
    const [c, m] = out.refused.full || [];
    want(c === 'E-ASSET' && m.includes('/nowhere/hypersvg-asset.js'), `a full player that cannot load refuses with E-ASSET naming the address (${c}: ${m})`);
    await tab.close();
  }
  for (const which of ['lean', 'full']) {
    const native = await open(`/t/vis.html?which=${which}`);
    const walk = await open(`/t/vis.html?which=${which}`, { noCheckVisibility: true });
    const [n, w] = await Promise.all([native.tab.evaluate(() => window.out), walk.tab.evaluate(() => window.out)]);
    want(n.controls.length > 0 && JSON.stringify(n.controls) === JSON.stringify(w.controls), `the visibility check, ${which} mount: the same usable controls with checkVisibility() and with the walk (${n.controls.length})`);
    want(n.styles < w.styles, `the visibility check, ${which} mount: fewer computed-style reads with checkVisibility() (${n.styles} against ${w.styles})`);
    await native.tab.close(); await walk.tab.close();
  }
  if (haveLeanFile) {
    for (const policy of Object.keys(POLICIES)) await playsThroughFull(`onefile-${policy}`, `the lean one-file player, policy ${policy}`, `${FULL}?ver=L9`);
  } else {
    console.log('skip the lean one-file player is not built here (engine/v2/web/hypersvg-asset-lean.js)');
  }
  want(pageErrors.length === 0, `no page errors${pageErrors.length ? `: ${pageErrors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  server.close();
}
console.log(problems.length ? `${problems.length} problems` : 'lean fallback browser: all checks pass');
process.exit(problems.length ? 1 : 0);
