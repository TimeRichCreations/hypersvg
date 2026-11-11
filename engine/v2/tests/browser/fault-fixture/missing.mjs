// Packed pages whose module or capability is missing (B4 finding 6). Each stops with a coded fault (9.2),
// never a type error. fault-browser.mjs runs them in its browser.
// Three small experiences, packed with their findings accepted into a temp folder:
// - a module named at a version the engine's lock does not list: no code is carried, so the mount refuses it before
//   any call (E-MODULE-REVIEW, 10.7);
// - a module that is carried but not pinned: it does not install, so the engine is not made (E-MODULE-REVIEW);
// - a physics field without physics in needs: the scene is refused at mount (E-NEEDS-MISSING).
// Each page shows the fault message with its code, sets no hsvgError, raises no page error, and ignores input.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { pack } from '../../../tools/pack.mjs';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" data-hsvg-version="2.0" data-hsvg-kind="screen">
<g id="ball" data-hsvg-kind="part" data-hsvg-motion="move-x -50..50; move-y -50..50"><circle cx="200" cy="150" r="20" fill="#8c8"/></g>
<g id="b-go" data-hsvg-kind="part"><rect x="10" y="10" width="80" height="40" fill="#8c8"/></g>
</svg>`;
const scene = (extra) => ({
  format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg',
  values: { moves: { type: 'array', items: { type: 'string', maxLength: 5 }, maxItems: 256, initial: [] }, n: { type: 'number', initial: 0, minimum: 0, maximum: 9 } },
  controls: { go: { kind: 'button', target: 'b-go', event: 'went', keys: ['KeyG'], label: 'Go' } },
  on: { went: [{ id: 'w', actions: [{ id: 'w1', set: 'n', to: 'n + 1' }] }] },
  ...extra,
});
const call = { entry: [{ id: 'find', call: 'chess.legalMoves', with: { position: "'8/8/8/8/8/8/8/K6k w - - 0 1'" }, to: { moves: 'moves' } }] };
const experience = (needs) => ({ format: 'hsvg/2.0', kind: 'experience', id: 'missing', needs, story: { start: 'one', scenes: { one: 'scenes/one/scene.json' }, ends: ['one'] } });
const cases = [
  { name: 'a module at a version the lock does not list', code: 'E-MODULE-REVIEW', exp: experience(['chess@9.9.9']), scene: scene(call) },
  { name: 'a module carried but not pinned', code: 'E-MODULE-REVIEW', exp: experience(['chess@0.1.0']), scene: scene(call) },
  { name: 'physics settings without physics in needs', code: 'E-NEEDS-MISSING', exp: experience([]),
    scene: scene({ addons: { physics: { bodies: { ball: { target: 'ball', shape: { kind: 'circle', radius: 20 }, rest: [0, 0] } } } } }) },
];

// browser: a Playwright browser. want(cond, message) records a check.
export async function missingCases(browser, want) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-missing-'));
  try {
    for (const [i, c] of cases.entries()) {
      const dir = path.join(tmp, `case-${i}`);
      fs.mkdirSync(path.join(dir, 'scenes', 'one'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'experience.json'), JSON.stringify(c.exp, null, 2));
      fs.writeFileSync(path.join(dir, 'scenes', 'one', 'scene.json'), JSON.stringify(c.scene, null, 2));
      fs.writeFileSync(path.join(dir, 'scenes', 'one', 'one.svg'), svg);
      const r = await pack(dir, path.join(tmp, `out-${i}`), { acceptFindings: true, test: true });
      const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
      const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
      await page.goto(pathToFileURL(r.htmlPath).href + '?clock=manual');
      await page.waitForFunction(() => window.hsvgReady === true || window.hsvgError, null, { timeout: 30000 });
      const seen = await page.evaluate(() => {
        const box = document.querySelector('[role="alert"][data-hsvg-fault]');
        return { hsvgError: window.hsvgError || null, stopped: window.hsvg?.stopped || null, drawn: !!window.hsvg?.drawing,
          box: box && box.getBoundingClientRect().height > 0 ? { code: box.getAttribute('data-hsvg-fault'), text: box.textContent } : null };
      });
      want(!seen.hsvgError, `${c.name}: the page started its player (no hsvgError: ${seen.hsvgError})`);
      want(seen.stopped?.code === c.code && seen.stopped.source === 'start', `${c.name}: stopped at start with ${c.code} (${seen.stopped?.code}: ${seen.stopped?.message})`);
      want(seen.box?.code === c.code && seen.box.text.includes(c.code) && !/TypeError|Cannot read/.test(seen.box.text), `${c.name}: the message names the code: ${seen.box?.text}`);
      want(!seen.drawn, `${c.name}: nothing is drawn`);
      await page.keyboard.press('KeyG');
      await page.evaluate(() => { window.hsvg.advance(1000); window.hsvg.press('one', 'go'); });
      want(pageErrors.length === 0, `${c.name}: no page error, after a key, a press and the clock: ${pageErrors.join('; ')}`);
      await page.close();
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
