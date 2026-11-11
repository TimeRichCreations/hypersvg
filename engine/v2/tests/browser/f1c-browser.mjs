// In a real browser, from file://: inputs of the Q1c review that
// froze or broke a packed page now stop with a visible fault message, and the page stays responsive.
// Run alone (it starts a browser):
//   node engine/v2/tests/browser/f1c-browser.mjs
// Playwright must already be installed (PW_PATH; PW_CHANNEL=chrome uses the installed browser). It is never a dependency.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pack } from '../../tools/pack.mjs';
import { pin } from '../../tools/addon.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];
const sha = (t) => `sha256:${crypto.createHash('sha256').update(t).digest('hex')}`;

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" data-hsvg-version="2.0" data-hsvg-kind="screen">
  <title>Proof</title>
  <rect id="sky" data-hsvg-layer="backdrop" x="0" y="0" width="400" height="300" fill="#fff4d8"/>
  <text id="count" data-hsvg-kind="part" x="200" y="215" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#153b4b">0</text>
  <g id="button" data-hsvg-kind="part" data-hsvg-role="action">
    <rect x="125" y="235" width="150" height="50" rx="25" fill="#168e91"/>
    <text x="200" y="267" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#ffffff">Go</text>
  </g>
</svg>`;
// One scene with a press `go` that sends `added`; scene is merged over it, words (CSV text) are the experience's.
function experience({ scene = {}, words = null }) {
  const exp = { format: 'hsvg/2.0', kind: 'experience', id: 'proof', about: { title: 'Proof' }, story: { start: 'hello', scenes: { hello: 'scenes/hello/scene.json' } } };
  const files = { 'scenes/hello/hello.svg': SVG };
  if (words) { files['words/en.csv'] = words; exp.language = 'en'; exp.resources = { 'words-en': { kind: 'words', file: 'words/en.csv', language: 'en', digest: sha(words) } }; }
  files['experience.json'] = JSON.stringify(exp, null, 2);
  files['scenes/hello/scene.json'] = JSON.stringify({ format: 'hsvg/2.0', kind: 'scene', id: 'hello', drawing: 'hello.svg', controls: { go: { kind: 'button', target: 'button', event: 'added' } }, ...scene }, null, 2);
  return files;
}
const write = (dir, files) => { for (const [k, v] of Object.entries(files)) { const p = path.join(dir, ...k.split('/')); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, v); } };

const doubling = (() => { let s = 'id,text\n'; for (let i = 0; i < 26; i++) s += `w${i},"{{ words.w${i + 1} }}{{ words.w${i + 1} }}"\n`; return s + 'w26,x\n'; })();
const CASES = [
  { name: 'finding 1 B: 27 doubling words in a binding', files: experience({ words: doubling, scene: { bindings: [{ target: 'count', text: '{{ length(words.w0) > 0 ? "ok" : "no" }}' }] } }), atLoad: 'E-EVENT-LOOP' },
  { name: 'finding 5: a 10,000-deep value from fold, set by a press', press: 'E-TYPE', files: experience({ scene: {
    values: { deep: { type: 'array', initial: [], maxItems: 4, items: { type: 'array', maxItems: 4, items: { type: 'number', minimum: 0, maximum: 1 } } } },
    on: { added: [{ actions: [{ set: 'deep', to: 'fold(range(1000), [], fold(range(10), acc, [acc]))' }] }] } } }) },
  // Finding 6: the noughts example with an outside module that loops and never calls step(); a press runs it.
  { name: 'finding 6: an outside module with for (;;) and no step()', module: true, press: 'E-MODULE-RESULT' },
];
const LOOPING = `// It never calls step().
export function make(step) {
  return { turn({ board }) { let n = 0; for (;;) n++; return { board, winner: '', reply: -1 }; } };
}
`;
async function loopingNoughts(dir) {
  const ex = path.join(repo, 'engine', 'v2', 'addons', 'examples');
  fs.cpSync(path.join(ex, 'addons'), path.join(dir, 'addons'), { recursive: true });
  fs.cpSync(path.join(ex, 'noughts'), path.join(dir, 'noughts'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'addons', 'example.noughts', 'index.mjs'), LOOPING);
  await pin(path.join(dir, 'noughts'));
  return path.join(dir, 'noughts');
}

const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-f1c-'));
let browser;
try {
  browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  for (const c of CASES) {
    const src = path.join(tmp, `src-${CASES.indexOf(c)}`); const out = path.join(tmp, `out-${CASES.indexOf(c)}`);
    const r = c.module
      ? await pack(await loopingNoughts(src), out, { test: true, allow: ['example.glow', 'example.noughts'] })
      : (write(src, c.files), await pack(src, out, { test: true }));
    const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const t0 = Date.now();
    await page.goto(pathToFileURL(r.htmlPath).href + '?clock=manual', { timeout: 20000 });
    await page.waitForFunction(() => window.hsvgReady === true || window.hsvgError || window.hsvg?.stopped, null, { timeout: 20000 });
    if (c.module) {
      await page.evaluate(() => { const p = window.hsvg.player; p.activate('pick', 'levels', 'easy'); p.activate('pick', 'go'); window.hsvg.advance(600); });
      await page.evaluate(() => window.hsvg.player.activate('game', 'cells', 'c0'));
      await page.evaluate(() => window.hsvg.advance(50));
    } else if (c.press) await page.evaluate(() => window.hsvg.press('hello', 'go'));
    const stopped = await page.evaluate(() => window.hsvg?.stopped || null);
    const notice = await page.evaluate(() => document.querySelector('[role="alert"][data-hsvg-fault]')?.getAttribute('data-hsvg-fault') || null);
    const code = c.atLoad || c.press;
    want(stopped?.code === code && notice === code, `${c.name}: stops with ${code} and its message (${JSON.stringify(stopped)}, notice ${notice}) in ${Date.now() - t0} ms`);
    want(!errors.length, `${c.name}: no page error (${errors.join('; ')})`);
    want(await page.evaluate(() => 1 + 1) === 2, `${c.name}: the page still answers`);
    await page.close();
  }
} catch (e) { want(false, `the run failed: ${e.stack || e}`); } finally {
  await browser?.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(problems.length ? `${problems.length} problem(s)` : 'f1c browser: all ok');
process.exit(problems.length ? 1 : 0);
