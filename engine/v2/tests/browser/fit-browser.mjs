// Text fitting (7.6) in a real browser, on a small experience (fit-fixture/files.mjs). Run alone (it starts a browser):
//   node engine/v2/tests/browser/fit-browser.mjs
// Checks: a short text fits at the largest size; a long one shrinks and wraps within maxLines, leaving 2% free on
// every line, inside the region; a line feed counts toward maxLines; an unbreakable word is drawn whole and reported
// incomplete; the drawn text comes back exactly as drawn; a value equal to a drawn sample that runs past its region is
// fitted, not left running off the edge (C1 gap 1). Playwright must already be installed (PW_PATH; PW_CHANNEL).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadSchemas } from '../../schema/load.mjs';
import { files as fixture, NOTE, WRAP, WRAP_RTL, WRAPS } from './fit-fixture/files.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium']; // PW_BROWSER: chromium (default), firefox or webkit
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
const page = await browser.newPage({ viewport: { width: 800, height: 2000 } }); // the drawing at scale 2, as before the fixture grew to 1000 tall (Chrome on Windows rounds glyph boxes to device pixels)
const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
const problems = [];
const log = (m) => console.log(m);
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/engine/v2/web/index.html?clock=manual`);
  await page.waitForFunction(() => window.hsvgReady === true, null, { timeout: 30000 });
  const look = (k) => page.evaluate((k) => {
    const h = window.hsvg; if (k) h.press('one', `c-${k}`); else h.advance(0);
    const t = document.querySelector('[id$="one__label"]'); const box = document.querySelector('[id$="one__box"]').getBBox();
    const spans = [...t.querySelectorAll('tspan[x]')]; const ink = t.getBBox();
    return { fit: t.getAttribute('data-hsvg-fitted'), px: parseFloat(getComputedStyle(t).fontSize), text: t.textContent, lines: spans.length ? spans.map(s => s.textContent) : [t.textContent],
      widest: Math.max(0, ...spans.map(s => s.getComputedTextLength())), room: box.width * 0.98, inside: ink.y >= box.y - 0.5 && ink.y + ink.height <= box.y + box.height + 0.5,
      style: t.style.fontSize, outcome: h.drawing.fits?.['one#label-text'] };
  }, k);
  const want = (cond, msg) => { if (!cond) problems.push(msg); };
  let s = await look(null);
  log(`start: ${JSON.stringify(s)}`);
  want(s.text === 'Hello there' && !s.fit && s.px === 40, 'the drawn text is not shown as drawn at start');
  const note = await page.evaluate(() => {
    const t = document.querySelector('[id$="one__note"]'); const box = document.querySelector('[id$="one__note-box"]').getBBox(); const ink = t.getBBox();
    const spans = [...t.querySelectorAll('tspan[x]')];
    return { fit: t.getAttribute('data-hsvg-fitted'), lines: spans.map(x => x.textContent), widest: Math.max(0, ...spans.map(x => x.getComputedTextLength())), room: box.width * 0.98,
      inside: ink.x >= box.x - 0.5 && ink.x + ink.width <= box.x + box.width + 0.5 && ink.y >= box.y - 0.5 && ink.y + ink.height <= box.y + box.height + 0.5, outcome: window.hsvg.drawing.fits?.['one#note-text'] };
  });
  log(`note (value = drawn sample, drawn past its region): ${JSON.stringify(note)}`);
  want(note.fit === 'fitted' && note.outcome === 'fitted' && note.lines.length === 2 && note.widest <= note.room + 0.01 && note.inside, 'a value equal to a drawn sample that runs past its region should be fitted inside it');
  want(note.lines.join(' ') === NOTE, 'the note lost or split words');
  // A wrapped text keeps its spaces in the DOM text, and no line moves. Each line's box is measured
  // with the gaps (as drawn) and without them (as the engine drew it before), at start, middle and end, left to right
  // and right to left; they must agree to 0.5 px. The live region (the feedback part) reads the words with spaces.
  const wraps = await page.evaluate((ids) => ids.map((id) => {
    const t = document.querySelector(`[id$="one__${id}"]`);
    const boxes = () => [...t.querySelectorAll('tspan[x]')].map(x => { const r = x.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(v => Math.round(v * 100) / 100); });
    const gaps = [...t.children].filter(c => !c.hasAttribute('x'));
    const after = boxes();
    const kept = gaps.map(g => [g, g.nextSibling]);
    for (const [g] of kept) g.remove();
    const before = boxes();
    for (const [g, next] of kept) t.insertBefore(g, next);
    return { id, fit: t.getAttribute('data-hsvg-fitted'), text: t.textContent, lines: [...t.querySelectorAll('tspan[x]')].map(x => x.textContent), gaps: gaps.length, gapSizes: gaps.map(g => getComputedStyle(g).fontSize), before, after, live: t.getAttribute('aria-live') };
  }), WRAPS.map(([a, d]) => `w-${a}-${d}`));
  for (const w of wraps) {
    const value = w.id.endsWith('rtl') ? WRAP_RTL : WRAP;
    log(`${w.id}: ${w.lines.length} lines, ${w.gaps} gaps at ${[...new Set(w.gapSizes)].join(',')}; text ${JSON.stringify(w.text)}`);
    log(`  line boxes (left, top, width, height) before ${JSON.stringify(w.before)}`);
    log(`  line boxes (left, top, width, height) after  ${JSON.stringify(w.after)}`);
    want(w.lines.length > 1, `${w.id} should wrap`);
    want(w.text === value, `${w.id}: its text should be the words with single spaces, got ${JSON.stringify(w.text)}`);
    want(w.lines.join(' ') === value, `${w.id}: words were lost or split`);
    const moved = Math.max(0, ...w.after.flatMap((b, i) => b.map((v, k) => Math.abs(v - (w.before[i]?.[k] ?? Infinity)))));
    log(`  largest move ${moved} px`);
    want(w.before.length === w.after.length && moved <= 0.5, `${w.id}: a line moved by ${moved} px`);
  }
  const liveId = 'w-middle-ltr';
  want(wraps.find(w => w.id === liveId)?.live === 'polite', 'the feedback text should be a polite live region');
  const tree = await page.locator(`[id$="one__${liveId}"]`).ariaSnapshot().catch(e => `(${e.message})`);
  log(`live region in the accessibility tree: ${tree.replace(/\n/g, ' | ')}`);
  want(tree.includes('the current flows into the page') && !/agree:the|ammetersagree|pageand|thepage|voltagereverses/.test(tree), 'the live region should read the words with their spaces');
  s = await look('short'); log(`short: ${s.fit} ${s.px}px ${JSON.stringify(s.lines)}`);
  want(s.fit === 'fitted' && s.px === 40 && s.lines.length === 1 && s.inside, 'a short text should fit at 40px on one line');
  s = await look('long'); log(`long: ${s.fit} ${s.px}px ${JSON.stringify(s.lines)} widest ${s.widest.toFixed(1)} of ${s.room.toFixed(1)}`);
  want(s.fit === 'fitted' && s.px < 40 && s.px >= 12 && s.lines.length === 2 && s.widest <= s.room + 0.01 && s.inside, 'a long text should shrink into two lines inside the region with 2% free');
  want(s.lines.join(' ') === 'Robin rides the long way round the harbour to deliver every parcel on time', 'words were lost or split');
  s = await look('lines'); log(`lines: ${s.fit} ${s.px}px ${JSON.stringify(s.lines)}`);
  want(s.fit === 'incomplete' && s.lines.length === 3, 'three forced lines with maxLines 2 should be incomplete, drawn whole');
  s = await look('huge'); log(`huge: ${s.fit} ${s.px}px ${JSON.stringify(s.lines)} widest ${s.widest.toFixed(1)} of ${s.room.toFixed(1)}`);
  want(s.fit === 'incomplete' && s.px === 12 && s.lines.length === 1, 'an unbreakable word should be whole at minFontPx and incomplete');
  s = await look('drawn'); log(`drawn again: ${JSON.stringify(s)}`);
  want(s.text === 'Hello there' && !s.fit && s.px === 40 && !s.style, 'the drawn text should come back exactly as drawn');
  const errors = await page.evaluate(() => [...window.hsvg.errors, ...window.hsvg.drawing.faults.map(f => f.message)]);
  if (errors.length) problems.push(`errors: ${errors.join('; ')}`);
} catch (e) { problems.push(e.message); } finally { await browser.close(); server.close(); }
if (pageErrors.length) problems.push(`page errors: ${pageErrors.join('; ')}`);
for (const p of problems) log(`problem: ${p}`);
log(problems.length ? 'fit browser run: FAIL' : 'fit browser run: pass');
process.exit(problems.length ? 1 : 0);
