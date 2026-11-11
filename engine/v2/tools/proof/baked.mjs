// The baked pages measured in a browser (A7.1). The packer bakes each declared size with the solver's pinned text
// estimate; a browser draws with real fonts. This opens the packed page at each baked size of its start scene and
// fails a text that leaves its cell (its fit region) or is drawn below its floor (the readable floor, 7.6 rule 3).
// Run through proof.mjs: node engine/v2/tools/proof/proof.mjs baked <experience folder> <out folder>
import { pathToFileURL } from 'node:url';
import { verifyBuild } from './build.mjs';


// What to measure, read in the packed page from its loaded experience (window.hsvg.player.exp): the start scene's
// baked sizes ([WxH] of its derived layouts) and every text binding with a fit region in its scenes and blocks
// ([{target, region}]); floor: the readable floor in CSS px (the host's 12, or a readable rule's minTextPx if higher).
export function bakedPlanIn(exp) {
  const scenes = Object.values(exp.scenes || {}); const start = exp.scenes?.[exp.doc?.story?.start] ?? scenes[0];
  const docs = [start, ...scenes.filter(s => s !== start), ...Object.values(exp.blocks || {})].map(x => x?.doc).filter(Boolean);
  const sizes = [...new Set((start?.doc?.layouts || []).map(l => l?.size).filter(s => /^\d+x\d+$/.test(s || '')))];
  const texts = [];
  for (const d of docs) for (const b of Array.isArray(d.bindings) ? d.bindings : []) if (typeof b?.target === 'string' && typeof b?.fit?.box === 'string') texts.push({ target: b.target, region: b.fit.box });
  let floor = 12;
  for (const r of [exp.doc, ...docs].flatMap(d => (Array.isArray(d?.rules) ? d.rules : []))) if (r?.kind === 'readable' && typeof r.minTextPx === 'number') floor = Math.max(floor, r.minTextPx);
  return { sizes, texts, floor };
}

// Measures one page as it is drawn now: [{text, problem}] for each shown text that leaves its region or is below floor.
export async function measureTexts(page, texts, floor) {
  return page.evaluate(({ texts, floor }) => {
    const out = [];
    const shown = (el) => { for (let x = el; x && x.nodeType === 1; x = x.parentNode) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || x.getAttribute?.('display') === 'none') return false; } return true; };
    for (const { target, region } of texts) {
      const els = [...document.querySelectorAll(`[id="${target}"], [id$="__${target}"]`)];
      for (const el of els) {
        if (el.tagName.toLowerCase() !== 'text' || !shown(el) || !(el.textContent || '').trim()) continue;
        const prefix = el.id.slice(0, el.id.length - target.length);
        const reg = document.getElementById(prefix + region);
        const px = parseFloat(getComputedStyle(el).fontSize) * Math.abs(el.getScreenCTM()?.a || 1);
        if (px < floor - 0.01) out.push({ text: el.id, problem: `drawn at ${Math.round(px * 100) / 100} px, below the floor ${floor} px` });
        if (!reg) continue;
        const a = el.getBoundingClientRect(); const b = reg.getBoundingClientRect();
        const t = 1;
        if (a.x < b.x - t || a.y < b.y - t || a.x + a.width > b.x + b.width + t || a.y + a.height > b.y + b.height + t) {
          out.push({ text: el.id, problem: `leaves its cell ${reg.id}: [${[a.x, a.y, a.width, a.height].map(Math.round)}] outside [${[b.x, b.y, b.width, b.height].map(Math.round)}]` });
        }
      }
    }
    return out;
  }, { texts, floor });
}

// build: a buildProduct result. Returns {result: pass | fail | not-applicable, sizes: [{size, problems}]}.
export async function measureBaked(browser, build) {
  verifyBuild(build);
  const open = async (viewport) => {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(pathToFileURL(build.file).href);
    await page.waitForFunction(() => window.hsvgReady === true || window.hsvgError, null, { timeout: 30000 });
    return { context, page };
  };
  const first = await open({ width: 960, height: 600 });
  const plan = await first.page.evaluate(`(${bakedPlanIn.toString()})(window.hsvg.player.exp)`);
  await first.context.close();
  if (!plan.sizes.length || !plan.texts.length) return { result: 'not-applicable', sizes: [], floor: plan.floor };
  const rows = [];
  for (const size of plan.sizes) {
    const [width, height] = size.split('x').map(Number);
    const problems = [];
    let s = null;
    try {
      s = await open({ width, height });
      await s.page.waitForTimeout(100);
      problems.push(...await measureTexts(s.page, plan.texts, plan.floor));
    } catch (e) { problems.push({ text: '', problem: `the page did not draw: ${e.message}` }); }
    await s?.context.close();
    rows.push({ size, problems });
  }
  return { result: rows.some(r => r.problems.length) ? 'fail' : 'pass', sizes: rows, floor: plan.floor };
}
