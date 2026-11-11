// Rich text in a real browser (6.8.1, 5.3.1, 7.7), on the fixture in tests/richtext-fixture/files.mjs.
// Run alone (it starts a browser): node engine/v2/tests/browser/richtext-browser.mjs
// Checks, at three sizes (tall 300x600, square 400x400, strip 728x90):
// - the headline "RAIN? ↵ Bring it on." is one field: the accent run draws in its style; it flows into two linked
//   parts in the tall and square frames and fits in the one part the strip draws; every line sits inside its region
//   with 2% free; the accessible name is the whole text once, on the first part, and the other part is hidden;
// - the price keeps its was-price run where there is room and leaves it out first in the strip (the remove step);
// - a press on the sale button lights the price run (a highlight by value); legal text is in its own style.
// Then the shell version: the form edits the headline as one line; a style picked for selected words and a line
// break mark change the drawn text. Playwright must already be installed (PW_PATH; PW_CHANNEL).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadSchemas } from '../../schema/load.mjs';
import { files as fixture, formFiles } from '../richtext-fixture/files.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];
const asJson = (f) => JSON.stringify(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])));
const served = { '/files.json': asJson(fixture), '/form-files.json': asJson(formFiles), '/schemas.json': JSON.stringify(loadSchemas(path.join(repo, 'spec', '2.0'))) };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (served[url.pathname]) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(served[url.pathname]); }
  const p = path.join(repo, ...url.pathname.split('/').filter(Boolean).map(decodeURIComponent));
  if (!p.startsWith(repo) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': p.endsWith('.mjs') ? 'text/javascript' : 'text/html' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/engine/v2/web/index.html`;
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const problems = [];
const pageErrors = [];
const log = (m) => console.log(m);
const want = (cond, msg) => { if (!cond) problems.push(msg); };

// What the page shows of one text part and its region.
const read = (page) => page.evaluate(() => {
  const part = (id) => {
    const t = document.querySelector(`[id$="ad__${id}"]`);
    if (!t) return null;
    const box = document.querySelector(`[id$="ad__${id}-box"]`)?.getBBox();
    const lines = [...t.children].filter(c => c.tagName === 'tspan' && c.hasAttribute('x'));
    const ink = lines.map(l => l.getBBox());
    return { lines: lines.map(l => l.textContent), label: t.getAttribute('aria-label'), hidden: t.getAttribute('aria-hidden'), fit: t.getAttribute('data-hsvg-fitted'), px: parseFloat(getComputedStyle(t).fontSize),
      inside: !box || ink.every(b => b.width === 0 || (b.x >= box.x - 0.5 && b.x + b.width <= box.x + box.width + 0.5 && b.y >= box.y - 0.5 && b.y + b.height <= box.y + box.height + 0.5)),
      widest: Math.max(0, ...lines.map(l => l.getComputedTextLength())), room: box ? box.width * 0.98 : Infinity,
      styled: [...t.querySelectorAll('tspan tspan')].map(s => ({ text: s.textContent, weight: getComputedStyle(s).fontWeight, fill: getComputedStyle(s).fill, style: getComputedStyle(s).fontStyle, deco: getComputedStyle(s).textDecorationLine, lit: s.getAttribute('data-hsvg-lit'), stroke: s.getAttribute('stroke') })) };
  };
  const h = window.hsvg;
  return { layout: h.layouts?.ad, head1: part('head-1'), head2: part('head-2'), price: part('price'), legal: part('legal'), fits: h.drawing.fits, errors: [...h.errors, ...h.drawing.faults.map(f => f.message)] };
});

try {
  const page = await browser.newPage({ viewport: { width: 300, height: 600 } });
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto(`${base}?clock=manual`);
  await page.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
  for (const [w, h, layout] of [[300, 600, 'tall'], [400, 400, 'square'], [728, 90, 'strip']]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForFunction((l) => window.hsvg.layouts?.ad === l && document.querySelector('[id$="ad__head-1"]')?.getAttribute('data-hsvg-fitted'), layout, { timeout: 10000 });
    await page.evaluate(() => window.hsvg.press && window.hsvg.player.advance(0));
    const s = await read(page);
    log(`${layout}: head-1 ${JSON.stringify(s.head1.lines)} at ${s.head1.px}px (${s.head1.fit}); head-2 ${JSON.stringify(s.head2?.lines ?? null)}; price ${JSON.stringify(s.price.lines)} (${s.price.fit})`);
    want(s.head1.fit === 'fitted' && s.head1.inside && s.head1.widest <= s.head1.room + 0.01, `${layout}: the headline should fit inside its region with 2% free`);
    want(s.head1.label === 'RAIN? Bring it on.' && s.head1.hidden === null, `${layout}: the accessible name should be the whole text once, on the first part`);
    const rain = s.head1.styled.find(x => x.text === 'RAIN?');
    want(rain && rain.weight === '800' && rain.fill === 'rgb(179, 38, 30)', `${layout}: RAIN? should be drawn in the accent style: ${JSON.stringify(rain)}`);
    if (layout === 'strip') {
      want(!s.head2, 'the strip draws one part');
      want(s.head1.lines.join(' ') === 'RAIN? Bring it on.' && s.head1.lines.length >= 2, 'the strip should hold the whole headline, the break kept');
      want(s.price.fit === 'fitted' && s.price.lines.join('') === 'now $29', `the strip should leave the optional was-price run out first: ${JSON.stringify(s.price)}`);
    } else {
      want(s.head1.lines.join(' ') === 'RAIN?', `${layout}: the first part should end at the line break`);
      want(s.head2.lines.join(' ') === 'Bring it on.' && s.head2.hidden === 'true' && s.head2.label === null && s.head2.inside, `${layout}: the rest should flow into the second part, hidden from assistive technology`);
      want(s.head2.px === s.head1.px, `${layout}: the linked parts should share one size`);
      want(s.price.fit === 'fitted' && s.price.lines.join('') === 'was $40 now $29', `${layout}: the price should keep the was-price run`);
      const was = s.price.styled.find(x => x.text === 'was $40');
      want(was && was.deco === 'line-through', `${layout}: was-price should be struck through`);
    }
    want(s.legal.styled.some(x => x.style === 'italic' && x.fill === 'rgb(79, 91, 98)'), `${layout}: legal text in its own style`);
    want(!s.errors.length, `${layout}: errors ${s.errors.join('; ')}`);
  }
  // A word lit by a value: press the sale button with the mouse (strip layout).
  const btn = await page.locator('[id$="ad__sale-btn"] rect').boundingBox();
  await page.mouse.click(btn.x + btn.width / 2, btn.y + btn.height / 2);
  await page.evaluate(() => window.hsvg.player.advance(0));
  let s = await read(page);
  const now = s.price.styled.find(x => x.text === 'now $29');
  log(`after sale: ${JSON.stringify(now)}`);
  want(now?.lit === 'true' && now.stroke === '#ffd84d', 'the sale press should light the price run with its highlight role');
  await page.close();

  // The form: the headline as one line with a run editor.
  const form = await browser.newPage({ viewport: { width: 800, height: 600 } });
  form.on('pageerror', e => pageErrors.push(e.message));
  await form.goto(`${base}?clock=manual&files=/form-files.json`);
  await form.waitForFunction(() => window.hsvgReady === true && document.querySelector('[data-player-richtext] input'), null, { timeout: 30000 });
  const field = form.locator('[data-player-richtext] input');
  const value = await field.inputValue();
  log(`form field: ${JSON.stringify(value)}`);
  want(value === 'RAIN?↵Bring it on.', 'the form should show the headline as one line with a break mark');
  const offered = await form.locator('[data-player-richtext] [data-player-style]').evaluateAll(bs => bs.map(b => b.getAttribute('data-player-style')));
  want(JSON.stringify(offered) === JSON.stringify(['accent', 'strong', 'emphasis', 'line-break']), `only the field's styles (and a break) should be offered: ${offered}`);
  // Select "Bring" and make it emphasis, by real mouse on the button.
  await field.click();
  await field.evaluate((el) => el.setSelectionRange(6, 11));
  await form.locator('[data-player-style="emphasis"]').click();
  const headline = () => form.evaluate(() => window.hsvg.player.state.blocks.experience.inputs.headline);
  let h = await headline();
  log(`after emphasis: ${JSON.stringify(h)}`);
  want(JSON.stringify(h) === JSON.stringify([{ text: 'RAIN?', style: 'accent' }, { text: '\n', style: 'strong' }, { text: 'Bring', style: 'emphasis' }, { text: ' it on.', style: 'strong' }]), 'the selected word should take the picked style');
  // Type at the end: the new letters take the style before them; then a line break mark before "it".
  await field.press('End');
  await form.keyboard.type('!!');
  await field.evaluate((el) => el.setSelectionRange(12, 12));
  await form.locator('[data-player-style="line-break"]').click();
  h = await headline();
  log(`after typing and a break: ${JSON.stringify(h)}`);
  want(h.map(r => r.text).join('') === 'RAIN?\nBring \nit on.!!' && h.at(-1).style === 'strong', 'typing and the break mark should edit the runs');
  await form.evaluate(() => window.hsvg.player.advance(0));
  const drawn = await form.evaluate(() => ({ one: document.querySelector('[id$="ad__head-1"]')?.getAttribute('aria-label'), em: [...document.querySelectorAll('[id$="ad__head-2"] tspan tspan')].find(t => t.textContent === 'Bring')?.getAttribute('font-style') }));
  log(`drawn after the edit: ${JSON.stringify(drawn)}`);
  want(drawn.one === 'RAIN? Bring it on.!!' && drawn.em === 'italic', 'the drawing should follow the edit');
  const errs = await form.evaluate(() => [...window.hsvg.errors, ...window.hsvg.drawing.faults.map(f => f.message)]);
  want(!errs.length, `form errors: ${errs.join('; ')}`);
} catch (e) { problems.push(e.stack || e.message); } finally { await browser.close(); server.close(); }
if (pageErrors.length) problems.push(`page errors: ${pageErrors.join('; ')}`);
for (const p of problems) log(`problem: ${p}`);
log(problems.length ? 'richtext browser run: FAIL' : 'richtext browser run: pass');
process.exit(problems.length ? 1 : 0);
