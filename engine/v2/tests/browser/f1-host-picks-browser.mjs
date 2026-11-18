// The host's picks on the language and theme axes (7.1, 10.6), in a real browser. Run alone (it starts a browser):
//   node engine/v2/tests/browser/f1-host-picks-browser.mjs
// Checks, on the checked mount and on the lean mount (integrity):
// - a host's pick in options on a host-selected theme axis colours the drawing;
// - a host's pick in options on a host-selected language axis is the ambient language: the drawing shows its words;
// - the host's theme (mount's theme option) wins over a theme the HyperSVG picks by input, and an input change does
//   not undo it; without the host's theme, the input still picks;
// - a host-selected theme axis whose default the host does not override still lets the drawing play;
// - a host theme pick the experience does not declare is refused (E-AXIS-INPUT).
// Playwright must already be installed (PW_PATH; PW_CHANNEL=chrome uses the installed browser).
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
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
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'f1-picks-'));

// ---------- the lamp and its variants ----------
const out = temp();
const lamp = fs.readFileSync((await packAsset(path.join(repo, 'engine', 'v2', 'tests', 'k2f-fixture'), out)).svgPath, 'utf8');
fs.rmSync(out, { recursive: true, force: true });
const variant = (change) => {
  const a = readAsset(lamp);
  const files = { ...a.files };
  const doc = JSON.parse(files['experience.json']);
  const scene = JSON.parse(files['scenes/lamp/scene.json']);
  change({ doc, scene, files });
  files['experience.json'] = JSON.stringify(doc);
  files['scenes/lamp/scene.json'] = JSON.stringify(scene);
  return makeAsset({ id: a.id, drawing: a.drawing, files });
};
const DAY_SUN = '#f59e0b';
const NIGHT_SUN = '#b45309';
const withNight = (doc) => { doc.themes.night = { colorRoles: { surface: '#111827', ink: '#f9fafb', accent: '#93c5fd', sun: NIGHT_SUN, sky: '#0369a1' } }; };
// A theme picked by input: the knob mood, whose choices are the two themes.
const byInput = variant(({ doc }) => {
  withNight(doc);
  doc.inputs.mood = { kind: 'knob', type: 'string', enum: ['lamp', 'night'], maxLength: 5, initial: 'lamp' };
  doc.axes = [{ axis: 'theme', select: 'input', value: 'mood' }];
});
// A theme the host picks.
const hostTheme = variant(({ doc }) => { withNight(doc); doc.axes = [{ axis: 'theme', select: 'host', options: ['lamp', 'night'] }]; });
// A language the host picks: English and German words for the state text.
const words = (rows) => `id,text\n${rows.map(r => r.join(',')).join('\n')}\n`;
const EN = words([['on', 'On'], ['off', 'Off']]);
const DE = words([['on', 'An'], ['off', 'Aus']]);
const digest = (t) => `sha256:${crypto.createHash('sha256').update(t).digest('hex')}`;
const hostLanguage = variant(({ doc, scene, files }) => {
  files['words/en.csv'] = EN;
  files['words/de.csv'] = DE;
  doc.resources = {
    'words-en': { kind: 'words', file: 'words/en.csv', language: 'en', digest: digest(EN) },
    'words-de': { kind: 'words', file: 'words/de.csv', language: 'de', digest: digest(DE) },
  };
  doc.axes = [{ axis: 'language', select: 'host', options: { en: {}, de: {} } }];
  scene.bindings = scene.bindings.map(b => (b.target === 'state' ? { ...b, text: '{{ on ? words.on : words.off }}' } : b));
});
const sri = (t) => `sha256-${crypto.createHash('sha256').update(t).digest('base64')}`;

const page = `<!doctype html><meta charset="utf-8"><style>div{width:300px;height:220px}</style>
<div id="inputOnly"></div><div id="inputHost"></div><div id="inputHostLean"></div>
<div id="axisNone"></div><div id="axisNight"></div><div id="axisNightLean"></div>
<div id="langNone"></div><div id="langDe"></div><div id="langDeLean"></div>
<script type="module">
import { mount, mountAsync, sharedSchemas } from '/engine/v2/web/asset-web.mjs';
const schemas = await sharedSchemas();
const text = (p) => fetch(p).then(r => r.text());
const [byInput, hostTheme, hostLanguage] = await Promise.all(['/by-input.svg', '/host-theme.svg', '/host-language.svg'].map(text));
const el = (id) => document.getElementById(id);
window.players = {
  inputOnly: mount(el('inputOnly'), byInput, { mood: 'night' }, { schemas }),
  inputHost: mount(el('inputHost'), byInput, {}, { schemas, theme: 'night' }),
  inputHostLean: await mountAsync(el('inputHostLean'), byInput, {}, { integrity: '${sri(byInput)}', theme: 'night' }),
  axisNone: mount(el('axisNone'), hostTheme, {}, { schemas }),
  axisNight: mount(el('axisNight'), hostTheme, {}, { schemas, options: { theme: 'night' } }),
  axisNightLean: await mountAsync(el('axisNightLean'), hostTheme, {}, { integrity: '${sri(hostTheme)}', options: { theme: 'night' } }),
  langNone: mount(el('langNone'), hostLanguage, { on: true }, { schemas }),
  langDe: mount(el('langDe'), hostLanguage, { on: true }, { schemas, options: { language: 'de' } }),
  langDeLean: await mountAsync(el('langDeLean'), hostLanguage, { on: true }, { integrity: '${sri(hostLanguage)}', options: { language: 'de' } }),
};
const refused = (o) => { try { mount(document.createElement('div'), hostTheme, {}, { schemas, ...o }); return 'none'; } catch (e) { return e.code; } };
window.refused = [refused({ theme: 'dusk' }), refused({ options: { theme: 'dusk' } })];
window.ready = true;
</script>`;

const virtual = {
  '/by-input.svg': ['image/svg+xml', byInput],
  '/host-theme.svg': ['image/svg+xml', hostTheme],
  '/host-language.svg': ['image/svg+xml', hostLanguage],
  '/picks.html': ['text/html', page],
};
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
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

try {
  const tab = await browser.newPage({ viewport: { width: 1000, height: 1000 }, deviceScaleFactor: 1 });
  tab.on('pageerror', e => pageErrors.push(e.message));
  await tab.goto(`${base}/picks.html`);
  await tab.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  const seen = () => tab.evaluate(() => {
    const out = {};
    for (const id of Object.keys(window.players)) {
      out[id] = { fill: document.querySelector(`#${id} [id$="__bulb"] circle`)?.getAttribute('fill'), text: document.querySelector(`#${id} [id$="__state"]`)?.textContent, language: document.querySelector(`#${id} svg`)?.getAttribute('lang') };
    }
    return out;
  });
  const r = await seen();
  want(r.inputOnly.fill === NIGHT_SUN, `without a host theme, the input picks the theme (${r.inputOnly.fill})`);
  want(r.inputHost.fill === NIGHT_SUN && r.inputHostLean.fill === NIGHT_SUN, `the host's theme wins over the input's pick, on both mounts (${r.inputHost.fill}, ${r.inputHostLean.fill}; the input picks lamp)`);
  want(r.axisNone.fill === DAY_SUN, `a host-selected theme axis without a pick keeps the author's theme (${r.axisNone.fill})`);
  want(r.axisNight.fill === NIGHT_SUN && r.axisNightLean.fill === NIGHT_SUN, `the host's pick on a host-selected theme axis colours the drawing, on both mounts (${r.axisNight.fill}, ${r.axisNightLean.fill})`);
  want(r.langNone.text === 'On', `a host-selected language axis without a pick shows the default language (${r.langNone.text})`);
  want(r.langDe.text === 'An' && r.langDeLean.text === 'An', `the host's pick on a host-selected language axis is the ambient language, on both mounts (${r.langDe.text}, ${r.langDeLean.text})`);
  const refusedCodes = await tab.evaluate(() => window.refused);
  want(JSON.stringify(refusedCodes) === JSON.stringify(['E-AXIS-INPUT', 'E-AXIS-INPUT']), `a host theme the experience does not declare is refused (${refusedCodes.join(', ')})`);
  // An input change after the start does not undo the host's pick.
  await tab.evaluate(() => { window.players.inputHost.set('mood', 'lamp'); window.players.inputOnly.set('mood', 'lamp'); });
  await tab.waitForTimeout(100);
  const after = await seen();
  want(after.inputHost.fill === NIGHT_SUN, `an input change keeps the host's theme (${after.inputHost.fill})`);
  want(after.inputOnly.fill === DAY_SUN, `without a host theme, an input change picks again (${after.inputOnly.fill})`);
  want(pageErrors.length === 0, `no page errors (${pageErrors.join('; ') || 'none'})`);
} catch (e) {
  problems.push(e.stack || String(e));
  console.log(e.stack || e);
} finally {
  await browser.close();
  server.close();
}
console.log(problems.length ? `${problems.length} problem(s)` : 'all ok');
process.exit(problems.length ? 1 : 0);
