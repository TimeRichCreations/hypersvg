// In a real browser: the player's looks and fixes. Run alone (it starts a browser):
//   node engine/v2/tests/browser/q1-player-browser.mjs
// On a fixture made from the stage fixture (a shell with a stage; the scene made only in exact sizes):
// - item 2: an option, a slider and a press each show their drawn `pressed` look while the mouse holds them, and an
//   option while Enter holds it; each goes back to rest when let go;
// - item 5: true size applies to the stage (the shell fills the page; the scene is 300x250 CSS pixels, never scaled
//   up); a language picked by input applies from boot; the shell's declared output event reaches the host's
//   on(name); the ambient `layout` value lists each block on screen with its frame, tier and steps.
// On the skill's examples, packed and opened from file:
// - item 3: the settings form takes its look from the theme (the Apply button's colour, the field group's corners);
// - item 4: the chat's quick-reply form prints no answer, because the drawn bubble shows it.
// Playwright must already be installed (PW_PATH; PW_CHANNEL=chrome uses the installed browser).
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadSchemas } from '../../schema/load.mjs';
import { files as stage } from './stage-fixture/files.mjs';
import { pack } from '../../tools/pack.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];

// The fixture: exact sizes only (true size), the language knob starting at de, drawn looks on three controls, and
// the harbour scene as one drawing (the shape names went with the shapes).
const fx = structuredClone(stage);
fx['experience.json'].axes = [
  { axis: 'shape', select: 'space', sizes: { '300x250': 'must', '160x600': 'must' } },
  ...fx['experience.json'].axes.filter(a => a.axis !== 'shape'),
];
fx['experience.json'].values.lang.initial = 'de';
const sh = fx['shell/frame.json'];
sh.controls.turn.label = 'Turn';
const look = (inner, pressedFill) => `<g data-hsvg-variant="idle">${inner}</g><g data-hsvg-variant="pressed" display="none">${inner.replace(/fill="[^"]*"/, `fill="${pressedFill}"`)}</g>`;
fx['shell/frame.svg'] = fx['shell/frame.svg']
  .replace(/<g id="de-btn" data-hsvg-kind="part">(.*?)<\/g>/, (m, inner) => `<g id="de-btn" data-hsvg-kind="part">${look(inner, '#a40')}</g>`)
  .replace(/<g id="turn-btn" data-hsvg-kind="part">(.*?)<\/g>/, (m, inner) => `<g id="turn-btn" data-hsvg-kind="part">${look(inner, '#840')}</g>`)
  .replace(/(<g id="width-handle"[^>]*>)(<rect[^>]*\/>)<\/g>/, (m, open, inner) => `${open}${look(inner, '#f00')}</g>`);
fx['scenes/harbour/scene.json'] = { ...fx['scenes/harbour/scene.json'], layouts: undefined, drawing: 'harbour-wide.svg' };
delete fx['scenes/harbour/scene.json'].layouts;
const files = Object.fromEntries(Object.entries(fx).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
const schemas = JSON.stringify(loadSchemas(path.join(repo, 'spec', '2.0')));
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/files.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(files)); }
  if (url.pathname === '/schemas.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(schemas); }
  if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
  const p = path.join(repo, ...url.pathname.split('/').filter(Boolean).map(decodeURIComponent));
  if (!p.startsWith(repo) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': p.endsWith('.mjs') ? 'text/javascript' : 'text/html' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-q1-'));
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1200 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/engine/v2/web/index.html?clock=manual`);
  await page.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
  const shown = (id, lk) => page.evaluate(([id, lk]) => { const g = document.querySelector(`[id$="${id}"] [data-hsvg-variant="${lk}"]`); return !!g && getComputedStyle(g).display !== 'none'; }, [id, lk]);
  const centre = (id) => page.evaluate((id) => { const b = document.querySelector(`[id$="${id}"]`).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, id);

  // Item 5: true size in the stage; the shell keeps its own size.
  const sizes = await page.evaluate(() => {
    const root = document.querySelector('svg'); const scene = root.querySelector('svg[data-player-scene]');
    const r = root.getBoundingClientRect(); const s = scene.getBoundingClientRect();
    return { root: [r.width, r.height], rootTrue: root.getAttribute('data-player-true-size'), scene: [s.width, s.height], sceneTrue: scene.getAttribute('data-player-true-size') };
  });
  want(sizes.rootTrue === null && sizes.root[0] > 1400, `the shell keeps its own size (${sizes.root.join('x')}, no true size on it)`);
  want(sizes.sceneTrue === '300x250' && Math.abs(sizes.scene[0] - 300) < 1 && Math.abs(sizes.scene[1] - 250) < 1, `the scene shows at true size 300x250 in a larger stage (${sizes.scene.map(Math.round).join('x')}, ${sizes.sceneTrue})`);

  // Item 5: the language picked by input applies from boot.
  const greeting = await page.evaluate(() => document.querySelector('[id$="greeting"]').textContent);
  want(greeting === 'Hallo', `a language knob that starts at de shows German from boot (${greeting})`);
  want(await page.evaluate(() => window.hsvg.player.state.ambient.language) === 'de', 'the ambient language is de from boot');

  // Item 5: the ambient layout value.
  const layout = await page.evaluate(() => window.hsvg.player.state.ambient.layout);
  want(layout && layout.frame && layout.ad && 'frame' in layout.ad && typeof layout.ad.tier === 'string' && Array.isArray(layout.ad.steps), `the ambient layout lists the shell and the scene (${JSON.stringify(layout)})`);
  want(await page.evaluate(() => Object.isFrozen(window.hsvg.player.state.ambient.layout)), 'the layout value is read-only');

  // Item 2: pressed while held, for an option, a slider and a press.
  for (const id of ['de-btn', 'width-handle', 'turn-btn']) {
    const c = await centre(id);
    await page.mouse.move(c.x, c.y); await page.mouse.down();
    const down = await shown(id, 'pressed');
    await page.mouse.up(); await page.mouse.move(5, 5);
    const up = await shown(id, 'pressed');
    want(down && !up, `${id}: the pressed look shows while the mouse holds it, and goes when let go (${down}, ${up})`);
  }
  await page.focus('[id$="de-btn"]');
  await page.keyboard.down('Enter');
  const held = await shown('de-btn', 'pressed');
  await page.keyboard.up('Enter');
  want(held && !(await shown('de-btn', 'pressed')), 'an option is pressed while Enter holds it');

  // Item 5: the shell's declared output event reaches the host's on(name).
  await page.evaluate(() => { window.heard = []; window.hsvg.host.on('next', (e) => window.heard.push(e.name)); });
  await page.evaluate(() => window.hsvg.press('frame', 'next'));
  const heard = await page.evaluate(() => window.heard);
  want(heard.length === 1 && heard[0] === 'next', `the host heard the shell's next once (${JSON.stringify(heard)})`);
  want(await page.evaluate(() => window.hsvg.player.scene) === 'harbour', 'the shell event still moves the story');
  want(!errors.length, `no page errors (${errors.join('; ')})`);
  await page.close();

  // Items 3 and 4: the skill's settings and chat examples, packed, from file:.
  const open = async (name, size) => {
    const dir = path.join(tmp, name.replace(/\W/g, '-'));
    const r = await pack(path.join(repo, 'skill', '2.0', 'examples', ...name.split('/')), dir, { test: true });
    const p = await browser.newPage({ viewport: size });
    await p.route('**/*', (route) => (/^(file|data|blob):/.test(route.request().url()) ? route.continue() : route.abort()));
    await p.goto(pathToFileURL(r.htmlPath).href);
    await p.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
    return p;
  };
  const settings = await open('kinds/settings', { width: 960, height: 600 });
  await settings.keyboard.press('KeyS'); await settings.waitForTimeout(300);
  const st = await settings.evaluate(() => {
    const css = (sel, k) => { const el = document.querySelector(`[data-player-widgets] ${sel}`); return el ? getComputedStyle(el)[k] : null; };
    const theme = window.hsvg.player.exp.doc.themes?.[window.hsvg.player.exp.doc.theme];
    return { themed: !!theme, accent: theme?.colorRoles?.accent, apply: css('[data-player-button=settingsApply]', 'backgroundColor'), radius: css('fieldset', 'borderTopLeftRadius'), font: css('legend', 'fontFamily'), button: css('[data-player-button=settingsApply]', 'minHeight') };
  });
  const rgb = (h) => (h ? `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})` : null);
  want(st.themed && st.apply === rgb(st.accent), `the settings Apply button takes the theme's accent (${st.apply} against ${st.accent})`);
  want(st.radius && st.radius !== '0px', `the field group has the theme's corners (${st.radius})`);
  want(st.button === '44px', `buttons stay 44 px touch targets (${st.button})`);
  await settings.close();

  const chat = await open('kinds/chat', { width: 960, height: 600 });
  await chat.keyboard.press('KeyQ'); await chat.waitForTimeout(300);
  await chat.evaluate(() => document.querySelector('[data-quick-reply]')?.click()); await chat.waitForTimeout(300);
  const ch = await chat.evaluate(() => ({ printed: document.querySelectorAll('[data-player-answer]').length, bubble: document.querySelector('[id$="answer-line"]')?.textContent || '' }));
  want(ch.printed === 0 && ch.bubble.length > 10, `the answer has one owner: the bubble shows it, the form prints none (${ch.printed}, "${ch.bubble.slice(0, 40)}")`);
  await chat.close();
} finally {
  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(problems.length ? `q1 player browser run: ${problems.length} failed` : 'q1 player browser run: pass');
process.exit(problems.length ? 1 : 0);
