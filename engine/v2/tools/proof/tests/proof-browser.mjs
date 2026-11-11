// The proof tools in a real browser. Run alone (it starts one browser):
//   PW_PATH=<folder with node_modules/playwright> node engine/v2/tools/proof/tests/proof-browser.mjs
// On the skill's drag-sort recipe (small, with an ending): a keyboard path is recorded and replays the same; a changed
// trace and another page's trace are refused; a pointer press and a pointer drag work; the explorer, with a small
// budget, reaches the ending by keyboard alone and the certificate says so.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildProduct, repo } from '../build.mjs';
import { launchBrowser, openSession, record, replay } from '../browser.mjs';
import { explore } from '../explore.mjs';
import { certify } from '../certificate.mjs';
import { identity } from '../format.mjs';

const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-proof-browser-'));
const start = { viewport: { width: 800, height: 500 }, reducedMotion: true, storage: 'empty' };
let browser;
try {
  const build = await buildProduct(path.join(repo, 'skill', '2.0', 'examples', 'recipes', 'drag-sort'), out);
  browser = await launchBrowser();

  // The controls the page shows, as Chromium names them.
  const s = await openSession(browser, build, start);
  const controls = await s.controls();
  await s.close();
  want(controls.length === 4 && controls.every(c => c.kind === 'drag' && c.drops.length === 2), `four drag controls with two drops each (${controls.map(c => c.name).join(', ')})`);
  const by = Object.fromEntries(controls.map(c => [c.cid, identity(c)]));

  // A keyboard path to the ending: each item to its bin.
  const bins = { apple: 'compost-bin', paper: 'compost-bin', bottle: 'recycle-bin', can: 'recycle-bin' };
  const acts = []; let t = 0;
  for (const [cid, drop] of Object.entries(bins)) { acts.push({ t, act: 'drag', control: by[cid], drop, via: 'keyboard' }); t += 500; acts.push({ t, act: 'advance' }); }
  const trace = await record(browser, build, acts, { start });
  want(trace.expect.scene === 'done' && trace.expect.error === null, `the keyboard path reaches done (${trace.expect.scene}, ${trace.expect.error})`);
  want(trace.expect.visitedScenes.join(',') === 'sort,done', `visited sort then done (${trace.expect.visitedScenes})`);
  want(trace.checkpoints.length === acts.length + 1, 'one checkpoint at mount and one per input');
  const again = await replay(browser, build, trace);
  want(again.pass, `the trace replays the same (${again.differences.join(', ')})`);

  // A changed expectation is a difference; another page's trace is refused before playing.
  const bent = structuredClone(trace); bent.expect.values.experience = { values: { sorted: 99 }, inputs: {} };
  const bentResult = await replay(browser, build, bent);
  want(!bentResult.pass && bentResult.differences.includes('expect values'), `a changed value is found (${bentResult.differences})`);
  let refused = null;
  try { await replay(browser, build, { ...trace, fingerprint: 'sha256:' + '0'.repeat(64) }); } catch (e) { refused = e.message; }
  want(/another packed page/.test(refused || ''), `another page's trace is refused (${refused})`);

  // The pointer: a drag by mouse into the right bin, and a wrong bin.
  const ptr = await record(browser, build, [{ t: 0, act: 'drag', control: by.apple, drop: 'compost-bin', via: 'pointer' }, { t: 500, act: 'advance' }], { start });
  want(ptr.expect.values.sort.values.appleIn === true, `a pointer drag sorts the apple (${JSON.stringify(ptr.expect.values.sort.values)})`);
  const wrong = await record(browser, build, [{ t: 0, act: 'drag', control: by.apple, drop: 'recycle-bin', via: 'pointer' }, { t: 500, act: 'advance' }], { start });
  want(wrong.expect.values.sort.values.appleIn === false, 'a pointer drag to the wrong bin does not sort it');

  // The explorer and the certificate, with a small budget.
  const said = []; // the explorer's progress lines (R2 newcomer F5): each pass says its budget, and a long pass ticks
  const ex = await explore(browser, build, { start, stepBudget: 150, pointerBudget: 6, timeBudgetMs: 120000, progress: (l) => said.push(l), progressMs: 0 });
  want(said[0] === 'keyboard pass: up to 150 steps and 120 s' && said.some(l => /^keyboard pass: \d+ steps, \d+ states, \d+ of 120 s$/.test(l)) && said.includes('pointer pass: up to 6 uses and 60 s'), `the explorer tells its budget and progress (${said.length} lines: ${said[0]} ... ${said[said.length - 1]})`);
  want(!('progress' in ex.policy), 'the progress hook is not in the exploration record');
  const c = certify(build, ex);
  want(c.properties.finishable.result === 'pass', `finishable by keyboard (${c.properties.finishable.meaning})`);
  want(c.properties.keyboard.result === 'pass' && c.properties.keyboard.used >= 4, `every control used by keyboard (${c.properties.keyboard.used}/${c.properties.keyboard.seen})`);
  want(c.properties.pointer.result === 'pass', `every control used by pointer (${c.properties.pointer.used}, ${JSON.stringify(c.properties.pointer.failures)})`);
  want(c.properties.network.result === 'pass-observed' && c.properties.errors.result === 'pass-observed', 'no network request, no page error');
  want(c.properties.replay.result === 'pass', 'the ending trace replays the same');
  want(c.receipt.run === 'play-test' && c.receipt.digest === build.fingerprint, 'the receipt names the packed page');
} catch (e) {
  problems.push(e.stack || e.message); console.log(e.stack || e.message);
} finally {
  await browser?.close();
  fs.rmSync(out, { recursive: true, force: true });
}
console.log(problems.length ? `proof browser run: FAIL (${problems.length})` : 'proof browser run: pass');
process.exit(problems.length ? 1 : 0);
