// Frames a second and the longest task of packed pages in Chromium with the CPU slowed (CDP throttling, about a
// mid-range phone at 4x), while the step is used: the first slider (else the first radio) is focused and stepped by
// arrow keys every 120 ms for 5 s. A step with neither is measured while it plays on its own.
// Run alone: node engine/v2/tests/bench/speed-browser.mjs <packed page.html> <scene id[,scene id...]> [--cpu 4]
// The page must be packed with --test (?start= is a test hook). Playwright must be installed (PW_PATH); never a
// dependency. One browser, one page at a time.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const { loadPlaywright } = await import(pathToFileURL(path.join(repo, 'engine', 'v2', 'tools', 'proof', 'browser.mjs')).href);

export async function measure(file, scenes, { cpu = 4, ms = 5000 } = {}) {
  const browser = await loadPlaywright().chromium.launch({ headless: true });
  const out = [];
  try {
    for (const scene of scenes) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        window.__long = [];
        try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(e.duration); }).observe({ type: 'longtask', buffered: true }); } catch { /* no long tasks */ }
      });
      await page.goto(`${pathToFileURL(file).href}?start=${encodeURIComponent(scene)}`);
      await page.waitForFunction(() => window.hsvgReady === true || window.hsvgError, null, { timeout: 60000 });
      await page.waitForTimeout(500);
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
      const used = await page.evaluate(() => {
        const el = document.querySelector('[role=slider]') || document.querySelector('[role=radio]');
        if (!el) return 'plays';
        el.focus();
        return el.getAttribute('role');
      });
      await page.evaluate(() => { window.__long = []; window.__frames = 0; const f = () => { window.__frames++; requestAnimationFrame(f); }; requestAnimationFrame(f); window.__t0 = performance.now(); });
      const end = Date.now() + ms;
      let k = 0;
      while (Date.now() < end) {
        if (used !== 'plays') await page.keyboard.press(k++ % 20 < 10 ? 'ArrowRight' : 'ArrowLeft');
        await page.waitForTimeout(120);
      }
      const r = await page.evaluate(() => ({ fps: window.__frames * 1000 / (performance.now() - window.__t0), longest: Math.max(0, ...window.__long), longCount: window.__long.length, error: window.hsvgError ? String(window.hsvgError.code || window.hsvgError) : null }));
      out.push({ scene, used, ...r });
      await ctx.close();
    }
  } finally { await browser.close(); }
  return out;
}

if (process.argv[1]?.endsWith('speed-browser.mjs')) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--cpu');
  const cpu = i >= 0 ? Number(args.splice(i, 2)[1]) : 4;
  const [file, scenes] = args;
  for (const r of await measure(path.resolve(file), scenes.split(','), { cpu })) console.log(`${path.basename(file)} ${r.scene} (${r.used}): ${r.fps.toFixed(1)} fps, longest task ${Math.round(r.longest)} ms (${r.longCount} long)${r.error ? `, error ${r.error}` : ''}`);
}
