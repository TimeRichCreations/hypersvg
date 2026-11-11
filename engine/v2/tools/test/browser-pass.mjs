// The browser part of test.mjs: the packed page opened from file: in Chromium (and Firefox and WebKit with
// --browsers all), wide and phone, scene by scene. Playwright is a test tool only: found with PW_PATH (a folder that
// holds node_modules/playwright), PW_CHANNEL (an installed Chrome) and PW_BROWSER, as the engine's browser tests do.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPlaywright } from '../proof/browser.mjs';
import * as P from './page.mjs';
import { SETTLE_MS, WAIT_MS } from './node-play.mjs';

export const LAYOUTS = {
  wide: { viewport: { width: 1280, height: 800 }, touch: false },
  phone: { viewport: { width: 390, height: 844 }, touch: true },
};
export const FIXED_DATE = '2026-01-01T09:00:00Z';
export const DEFAULTS = Object.freeze({ textError: 12, textWarn: 14, hitError: 24, hitWarn: 44, fps: 30, longTask: 200, fitTolerance: 1.5, speedMs: 5000, cpu: 4, shotScale: 2 });

export function playwright() { try { return loadPlaywright(); } catch { return null; } }
export async function launch(pw, name) {
  const type = pw[name];
  if (!type) throw new Error(`Playwright has no browser ${name}`);
  // PW_EXECUTABLE_PATH: a browser binary of that kind (a system Chromium), as release/browser-smoke.mjs takes it.
  return type.launch({ headless: true, ...(name === 'chromium' && process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}), ...(name === 'chromium' && process.env.PW_EXECUTABLE_PATH ? { executablePath: process.env.PW_EXECUTABLE_PATH } : {}) });
}

const finding = (list, f) => { list.push(f); return f; };
// A browser context that reaches nothing outside the file (the page is offline; a request out is blocked).
async function newContext(browser, opts) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', ...opts });
  await ctx.addInitScript(P.watchSound);
  await ctx.route('**/*', (route) => (/^(file:|data:|blob:|about:)/.test(route.request().url()) ? route.continue() : route.abort()));
  return ctx;
}

// Opens the page at the start, with the manual clock, and replays a path. Returns {page, errors, scene, replay}.
async function openAt(ctx, file, actions, { manual = true } = {}) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(`page error: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`); });
  page.setDefaultTimeout(15000);
  // With the manual clock the date is fixed too, so a seed or a date read from the wall clock is the same on every
  // run (--baseline and --compare). Timers and frames keep running.
  if (manual && page.clock?.setFixedTime) await page.clock.setFixedTime(new Date(FIXED_DATE));
  await page.goto(pathToFileURL(file).href + (manual ? '?clock=manual' : ''));
  await page.waitForFunction(() => window.hsvgReady === true || window.hsvgError, null, { timeout: 30000 });
  const startError = await page.evaluate(() => window.hsvgError || (window.hsvg?.stopped && !window.hsvg.drawing ? `${window.hsvg.stopped.code}: ${window.hsvg.stopped.message}` : null));
  if (startError) return { page, errors: [...errors, `start: ${startError}`], scene: null };
  if (!(await page.evaluate(() => !!window.hsvg?.player))) return { page, errors: [...errors, 'the page has no test hooks: pack it with --test'], scene: null };
  const replay = await page.evaluate(P.replayActions, [actions, SETTLE_MS]);
  return { page, errors, scene: replay.scene, replay };
}

// Walks a packed page alone (no folder, so no Node walk): the same actions as the Node walk, by the test hooks.
export async function walkPage(browser, file, { budget = 400 } = {}) {
  const ctx = await newContext(browser, { viewport: LAYOUTS.wide.viewport });
  const scenes = new Map(); const queue = []; let steps = 0;
  const reach = async (pathTo) => { const o = await openAt(ctx, file, pathTo); return o; };
  let o = await reach([]);
  if (!o.scene) { await ctx.close(); return { scenes: [], errors: o.errors }; }
  scenes.set(o.scene, []); queue.push(o.scene); await o.page.close();
  while (queue.length && steps < budget) {
    const id = queue.shift();
    o = await reach(scenes.get(id));
    const done = new Set(); let since = [];
    for (let round = 0; round < 50 && steps < budget; round++) {
      const next = (await o.page.evaluate(P.pageActions, WAIT_MS)).find(a => !done.has(`${a.t}|${a.addr}|${a.cid}|${a.arg}|${a.link || a.dialog}`));
      if (!next) break;
      done.add(`${next.t}|${next.addr}|${next.cid}|${next.arg}|${next.link || next.dialog}`);
      const r = await o.page.evaluate(P.replayActions, [[next], SETTLE_MS]); steps++; since.push(next);
      if (r.scene !== id) {
        if (!scenes.has(r.scene)) { scenes.set(r.scene, [...scenes.get(id), ...since]); queue.push(r.scene); }
        await o.page.close(); o = await reach(scenes.get(id)); since = [];
      }
    }
    await o.page.close();
  }
  await ctx.close();
  return { scenes: [...scenes].map(([id, p]) => ({ id, actions: p })), errors: [] };
}

// One layout in one browser: every scene measured. Returns {findings, measures: {scene: measure}, shots, prints}.
// scenes: [{id, actions (the path), uses (the scene's own actions, for --baseline)}].
export async function layoutPass(browser, browserName, file, scenes, layoutName, o) {
  const t = { ...DEFAULTS, ...o.thresholds };
  // --min-width: the phone pass at the narrowest width the experience or asset is meant for.
  const L = layoutName === 'phone' && o.minWidth ? { ...LAYOUTS.phone, viewport: { ...LAYOUTS.phone.viewport, width: o.minWidth } } : LAYOUTS[layoutName];
  const findings = []; const measures = {}; const prints = {}; const shots = [];
  const counts = { scenes: 0, texts: 0, controls: 0, tabStops: 0, keyed: 0, pointed: 0, presses: 0, dialogs: 0, panels: 0 };
  const isMobile = L.touch && browserName !== 'firefox';
  const ctx = await newContext(browser, { viewport: L.viewport, deviceScaleFactor: o.shots ? t.shotScale : 1, hasTouch: L.touch, isMobile, reducedMotion: 'no-preference' });
  const tag = { browser: browserName, layout: layoutName };
  const add = (scene, code, severity, element, value, message) => finding(findings, { code, severity, scene, ...tag, element, value, message });
  try {
    for (const sc of scenes) {
      const op = await openAt(ctx, file, sc.actions);
      const { page } = op;
      try {
        if (!op.scene) { add(sc.id, 'T-PAGE-ERROR', 'error', 'page', null, op.errors.join(' | ')); continue; }
        if (op.scene !== sc.id) { add(sc.id, 'T-PATH', 'warning', 'path', null, `the path ends in ${op.scene}, not ${sc.id}`); continue; }
        for (const e of op.replay.errors) add(sc.id, 'T-PAGE-ERROR', 'error', 'path', null, e);
        const m = await page.evaluate(P.measureScene);
        measures[sc.id] = m; counts.scenes++; counts.texts += m.texts.length; counts.controls += m.controls.filter(c => c.shown).length;
        for (const e of [...op.errors, ...m.errors]) add(sc.id, 'T-PAGE-ERROR', 'error', 'page', null, e);
        // Text sizes: the smallest, and every text under the thresholds.
        const small = m.texts.filter(x => x.px < (layoutName === 'phone' ? t.textWarn : t.textError)).sort((a, b) => a.px - b.px);
        for (const x of small.slice(0, 12)) {
          const err = x.px < t.textError;
          add(sc.id, 'T-TEXT-SMALL', err ? 'error' : 'warning', x.id, x.px, `"${x.text.slice(0, 40)}" at ${x.px} px (${err ? `error under ${t.textError}` : `warning under ${t.textWarn}`})`);
        }
        if (small.length > 12) add(sc.id, 'T-TEXT-SMALL', 'warning', '...', small.length, `${small.length - 12} more texts under the thresholds`);
        // Controls.
        for (const c of m.controls) {
          if (!c.shown) continue;
          const el = `${c.addr}#${c.cid}${c.option !== undefined ? `.${c.option}` : ''} (${c.id})`;
          if (!c.name) add(sc.id, 'T-NO-NAME', 'error', el, null, `a ${c.role || c.kind} with no name`);
          if (c.enabled && c.box) {
            const s = Math.min(c.box.w, c.box.h);
            if (s < t.hitError) add(sc.id, 'T-HIT-SMALL', 'error', el, `${c.box.w}x${c.box.h}`, `"${c.name}" hit area ${c.box.w} x ${c.box.h} px, under ${t.hitError} x ${t.hitError}`);
            else if (layoutName === 'phone' && s < t.hitWarn) add(sc.id, 'T-HIT-SMALL', 'warning', el, `${c.box.w}x${c.box.h}`, `"${c.name}" hit area ${c.box.w} x ${c.box.h} px, under ${t.hitWarn} x ${t.hitWarn} on the phone${o.minWidth ? ` (${o.minWidth} px wide)` : ''}`);
          }
          // The visible words must be in the name as one run (WCAG 2.5.3, as axe tests it; series rule 10: at its start).
          if (c.nameHides?.length && c.name) {
            const words = (x) => x.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);
            const n = words(c.name); let i = 0;
            const inOrder = c.nameHides.every(w => words(w).every(x => { const j = n.indexOf(x, i); if (j < 0) return false; i = j + 1; return true; }));
            add(sc.id, 'T-NAME-HIDES-LABEL', 'error', el, null, `shows "${c.nameHides.join('", "')}" but is named "${c.name}"${inOrder ? ' (the words are there, with others between)' : ''} (WCAG 2.5.3)`);
          }
          if (c.role === 'slider' && !c.valueText) add(sc.id, 'T-NO-VALUETEXT', 'warning', el, c.value, `slider "${c.name}" says only the number ${c.value}: give it valueText with the unit`);
          if (c.inImg) add(sc.id, 'T-IMG-HOLDS-CONTROLS', 'error', el, c.inImg, `"${c.name}" is inside ${c.inImg}, which is role="img": its controls are hidden from the tree (WCAG 4.1.2)`);
          if (c.role === 'radio' && !c.radioGroup) add(sc.id, 'T-NO-RADIOGROUP', 'error', el, null, `option "${c.name}" is a radio outside a radiogroup`);
        }
        // A glyph box is taller than its line: across the line a text may pass its region by a quarter of its size.
        for (const f of m.fits) {
          const over = Math.max(f.x - t.fitTolerance, f.y - Math.max(t.fitTolerance, 0.25 * f.px));
          if (over > 0) add(sc.id, 'T-FIT-OVERFLOW', 'error', `${f.addr} ${f.target}`, Math.max(f.x, f.y), `fitted text leaves its region ${f.region} by ${f.x > 0 ? `${f.x} px across` : ''}${f.x > 0 && f.y > 0 ? ' and ' : ''}${f.y > 0 ? `${f.y} px up or down` : ''}`);
        }
        for (const x of m.overlaps) add(sc.id, 'T-TEXT-OVERLAP', 'warning', `${x.a} / ${x.b}`, x.w, `"${x.aText}" and "${x.bText}" overlap by ${x.w} px`);
        if (m.pageScroll.w > m.pageScroll.vw + 1) add(sc.id, 'T-PAGE-SCROLL', 'warning', 'page', m.pageScroll.w, `the page is ${m.pageScroll.w} px wide in a ${m.pageScroll.vw} px window: it scrolls sideways`);
        if (o.shots) {
          const f = path.join(o.shots, `${o.name}--${sc.id}--${layoutName}--${browserName}.jpg`);
          await page.screenshot({ path: f, type: 'jpeg', quality: 80 });
          shots.push(f);
        }
        if (o.baseline || o.compare) prints[sc.id] = [{ after: 'arrive', ...(await page.evaluate(P.fingerprint)) }];
        // --quick: the measures only.
        if (!o.quickOnly) {
          // Motion first, on the scene as it arrived; then the checks that move focus and the pointer.
          if (browserName === 'chromium') await motionCheck(page, sc.id, add).catch(e => add(sc.id, 'T-TOOL', 'warning', 'motion', null, `the motion check stopped: ${String(e.message).split('\n')[0].slice(0, 200)}`));
          for (const [name, run] of [['tab', async () => { counts.tabStops += await tabCheck(page, m, sc.id, add); }], ['keys', async () => { counts.keyed += await keyCheck(page, m, sc.id, add); }], ['pointer', async () => { counts.pointed += await pointerCheck(page, m, sc.id, add, L.touch); }]]) {
            try { await run(); } catch (e) { add(sc.id, 'T-TOOL', 'warning', name, null, `the ${name} check stopped: ${String(e.message).split('\n')[0].slice(0, 200)}`); }
          }
        }
        // Text cut off at the drawing's edge, once the scene has settled (3 s on the page's clock): T-TEXT-CLIPPED.
        try {
          await page.evaluate(() => { for (let i = 0; i < 30; i++) window.hsvg.advance(100); });
          for (const x of await page.evaluate(P.clippedTexts)) add(sc.id, 'T-TEXT-CLIPPED', 'error', x.id, x.over, `"${x.text}" leaves its drawing's view box by ${x.over} px: it is cut off. Move it in, shorten it, or fit it in a box (data-hsvg-fit)`);
        } catch (e) { add(sc.id, 'T-TOOL', 'warning', 'clipped', null, `the clipped-text check stopped: ${String(e.message).split('\n')[0].slice(0, 200)}`); }
      } finally { await page.close().catch(() => {}); }
      // Presses that open something: a dialog must be a dialog; a panel over the scene with controls should be one.
      if (!o.quickOnly) { const pr = await pressProbe(ctx, file, sc, measures[sc.id], add).catch(e => { add(sc.id, 'T-TOOL', 'warning', 'presses', null, `the press check stopped: ${String(e.message).split('\n')[0].slice(0, 200)}`); return { presses: 0, dialogs: 0, panels: 0 }; }); counts.presses += pr.presses; counts.dialogs += pr.dialogs; counts.panels += pr.panels; }
      // The fingerprint after each of the scene's own actions (--baseline, --compare): replayed from the arrival.
      if ((o.baseline || o.compare) && sc.uses?.length) {
        const op2 = await openAt(ctx, file, sc.actions);
        try {
          for (const a of sc.uses) {
            if (op2.page.isClosed()) break;
            const r = await op2.page.evaluate(P.replayActions, [[a], SETTLE_MS]);
            prints[sc.id].push({ after: a.what, ...(await op2.page.evaluate(P.fingerprint)), ...(r.errors.length ? { errors: r.errors } : {}) });
            if (r.scene !== sc.id) { await op2.page.close(); Object.assign(op2, await openAt(ctx, file, sc.actions)); }
          }
        } finally { await op2.page.close().catch(() => {}); }
      }
    }
  } finally { await ctx.close(); }
  return { findings, measures, prints, shots, counts };
}

// Tab from the top: each usable control's stop once, in reading order, with its focus mark showing.
async function tabCheck(page, m, scene, add) {
  const stops = m.controls.filter(c => c.shown && c.enabled && !c.inert && c.tabindex === '0').map(c => c.id);
  if (!stops.length) return 0;
  await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
  // A blur leaves the browser's Tab starting point where focus was, so the walk may start part way: it goes round
  // once (past the page's end) and stops at the first stop it sees twice. The order is read from the first stop
  // after the page's start.
  let seen = []; const hidden = []; let wrapped = -1;
  for (let i = 0; i < stops.length * 3 + 8; i++) {
    await page.keyboard.press('Tab');
    const f = await page.evaluate(P.focusNow);
    if (!f.inStage || !f.id) { if (seen.length && wrapped < 0) wrapped = seen.length; continue; }
    if (seen.includes(f.id)) break;
    seen.push(f.id);
    if (!f.ringed) hidden.push(f.id);
  }
  if (wrapped > 0) seen = [...seen.slice(wrapped), ...seen.slice(0, wrapped)];
  const missing = stops.filter(s => !seen.includes(s));
  if (missing.length) add(scene, 'T-TAB-ORDER', 'error', missing.slice(0, 5).join(', '), missing.length, `Tab does not reach ${missing.length} of ${stops.length} controls`);
  if (hidden.length) add(scene, 'T-FOCUS-HIDDEN', 'error', hidden.slice(0, 5).join(', '), hidden.length, `${hidden.length} controls show no focus mark when Tab reaches them`);
  // Reading order: a move to the left on the same row, or up and to the left, is out of order.
  const boxOf = new Map(m.controls.filter(c => c.box).map(c => [c.id, c.box]));
  const back = [];
  for (let i = 1; i < seen.length; i++) {
    const a = boxOf.get(seen[i - 1]); const b = boxOf.get(seen[i]);
    if (!a || !b) continue;
    const sameRow = Math.abs((a.y + a.h / 2) - (b.y + b.h / 2)) < Math.min(a.h, b.h) / 2;
    const left = b.x + b.w <= a.x + 1;
    if ((sameRow && left) || (b.y + b.h <= a.y + 1 && left)) back.push(`${seen[i - 1]} -> ${seen[i]}`);
  }
  if (back.length) add(scene, 'T-TAB-ORDER', 'warning', back.slice(0, 3).join('; '), back.length, `Tab goes back against the reading order ${back.length} times`);
  return seen.length;
}

// Keys on each control, with its uses recorded and kept from running (so nothing changes): Enter and Space on a
// press and an option, the arrows between options, Home, End, the arrows and Page Up and Page Down on a slider,
// Enter, an arrow and Enter on a drag.
async function keyCheck(page, m, scene, add) {
  await page.evaluate(P.patchActivate);
  let n = 0;
  try {
    const groups = new Set();
    for (const c of m.controls) {
      if (!c.shown || !c.enabled || c.inert) continue;
      const el = `${c.addr}#${c.cid}${c.option !== undefined ? `.${c.option}` : ''} (${c.id})`;
      const focus = () => page.evaluate((id) => { const e = document.getElementById(id); e?.focus({ preventScroll: true }); return document.activeElement === e; }, c.id);
      const press = async (key) => { await page.keyboard.press(key); return page.evaluate(P.takeUses); };
      if (!(await focus())) { add(scene, 'T-KEYS', 'error', el, null, `"${c.name}" takes no focus`); continue; }
      await page.evaluate(P.takeUses);
      const bad = [];
      if (c.kind === 'button' || c.kind === 'toggle' || c.kind === 'snapshot') {
        for (const k of ['Enter', 'Space']) { await focus(); const u = await press(k); if (!u.some(x => x.addr === c.addr && x.cid === c.cid)) bad.push(k); }
      } else if (c.kind === 'choice') {
        for (const k of ['Enter', 'Space']) { await focus(); const u = await press(k); if (!u.some(x => x.addr === c.addr && x.cid === c.cid && x.arg === c.option)) bad.push(k); }
        const g = `${c.addr}#${c.cid}`;
        const peers = m.controls.filter(x => `${x.addr}#${x.cid}` === g && x.shown && x.enabled);
        if (!groups.has(g) && peers.length > 1) {
          groups.add(g); await focus(); await page.keyboard.press('ArrowRight');
          const f = await page.evaluate(P.focusNow);
          if (f.id === c.id || !peers.some(x => x.id === f.id)) bad.push('ArrowRight (focus stays)');
          await page.evaluate(P.takeUses);
        }
      } else if (c.kind === 'slider' || c.kind === 'dial') {
        // An older page's engine may lack sliderPage: then Page Up and Page Down need only move the right way.
        const s = await page.evaluate(([a, b]) => { const p = window.hsvg.player; const f = (n, ...x) => (typeof p[n] === 'function' ? p[n](a, b, ...x) : null); return { min: f('sliderValueAt', 0), max: f('sliderValueAt', 1), now: Number(p.controlValue(a, b)), step: f('sliderStep'), page: f('sliderPage') }; }, [c.addr, c.cid]);
        if (s.min === null || s.min === undefined || s.step === null) continue;
        const clamp = (v) => Math.max(s.min, Math.min(s.max, v));
        const want = { Home: s.min, End: s.max, ArrowRight: clamp(s.now + s.step), ArrowUp: clamp(s.now + s.step), ArrowLeft: clamp(s.now - s.step), ArrowDown: clamp(s.now - s.step), PageUp: s.page === null ? 'up' : clamp(s.now + s.page), PageDown: s.page === null ? 'down' : clamp(s.now - s.page) };
        for (const [k, v] of Object.entries(want)) {
          await focus();
          const u = (await press(k)).filter(x => x.addr === c.addr && x.cid === c.cid);
          const got = u.at(-1)?.arg;
          if (typeof v === 'string') { const edge = v === 'up' ? s.now >= s.max : s.now <= s.min; if (!edge && !(u.length && (v === 'up' ? got > s.now : got < s.now))) bad.push(`${k} (${u.length ? got : 'nothing'})`); continue; }
          const same = Math.abs(v - s.now) < 1e-9;
          if (same ? u.length && Math.abs(got - v) > 1e-6 : !u.length || Math.abs(got - v) > Math.max(1e-6, Math.abs(s.step) * 0.01)) bad.push(`${k} (${u.length ? got : 'nothing'}, wanted ${+v.toFixed(6)})`);
        }
      } else if (c.kind === 'drag') {
        await focus(); await page.keyboard.press('Enter'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
        const u = (await page.evaluate(P.takeUses)).filter(x => x.addr === c.addr && x.cid === c.cid);
        if (!u.length) bad.push('Enter, ArrowRight, Enter (no drop)');
        await page.keyboard.press('Escape');
      }
      n++;
      if (bad.length) add(scene, 'T-KEYS', 'error', el, bad.length, `"${c.name}": ${bad.join(', ')} did nothing`);
    }
  } finally { await page.evaluate(P.unpatchActivate); await page.evaluate(P.takeUses); }
  return n;
}

// A click (a tap on the phone) at the centre of each press and option reaches it (a lost click is X1-01's fault).
async function pointerCheck(page, m, scene, add, touch) {
  await page.evaluate(P.patchActivate);
  let n = 0;
  try {
    for (const c of m.controls) {
      if (!c.shown || !c.enabled || c.inert || !c.box || !['button', 'toggle', 'choice', 'snapshot'].includes(c.kind)) continue;
      const b = await page.evaluate((id) => { const e = document.getElementById(id); if (!e) return { inView: false }; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, inView: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth }; }, c.id);
      if (!b.inView) continue;
      const hit = await page.evaluate(([x, y, id]) => { const e = document.elementFromPoint(x, y); const t = document.getElementById(id); return !!e && (t === e || t.contains(e)); }, [b.x, b.y, c.id]);
      if (touch) await page.touchscreen.tap(b.x, b.y); else await page.mouse.click(b.x, b.y);
      n++;
      await page.waitForTimeout(30);
      const u = (await page.evaluate(P.takeUses)).filter(x => x.addr === c.addr && x.cid === c.cid);
      if (!u.length) add(scene, 'T-POINTER', 'error', `${c.addr}#${c.cid}${c.option !== undefined ? `.${c.option}` : ''} (${c.id})`, null, `a ${touch ? 'tap' : 'click'} at the centre of "${c.name}" did nothing${hit ? '' : ' (another element is on top there)'}`);
    }
  } finally { await page.evaluate(P.unpatchActivate); await page.evaluate(P.takeUses); }
  return n;
}

// Under reduced motion nothing keeps moving after 2 s, unless a clock the content declares drives it. The drawing is
// sampled at 2, 2.5, 3, 3.5 and 4 s after reduced motion is turned on: an element that changes in two or more of the
// four steps keeps moving (an error, or a warning when a declared clock runs); one that changes once settles late.
export async function motionCheck(page, scene, add) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  try {
    // The page hears the change a moment later (a media query change event): measure only once the player has it,
    // else the first steps still move and a settle looks late (the car showed this).
    await page.waitForFunction(() => window.hsvg?.player?.state?.ambient?.reducedMotion === true, null, { timeout: 2000 }).catch(() => {});
    await page.evaluate(() => { for (let i = 0; i < 20; i++) window.hsvg.advance(100); });
    const samples = [await page.evaluate(P.drawnState)];
    for (let k = 0; k < 4; k++) { await page.evaluate(() => { for (let i = 0; i < 5; i++) window.hsvg.advance(100); }); samples.push(await page.evaluate(P.drawnState)); }
    const count = {};
    for (let k = 1; k < samples.length; k++) for (const id of Object.keys(samples[k])) if (samples[k - 1][id] !== undefined && samples[k - 1][id] !== samples[k][id]) count[id] = (count[id] || 0) + 1;
    const moving = Object.keys(count).filter(id => count[id] >= 2); const late = Object.keys(count).filter(id => count[id] === 1);
    if (moving.length) {
      const clocks = await page.evaluate(P.clocksRunning);
      add(scene, 'T-MOVES', clocks ? 'warning' : 'error', moving.slice(0, 5).join(', '), moving.length, `under reduced motion ${moving.length} elements keep changing after 2 s${clocks ? ` (${clocks} declared clocks run: check they are meaning, not decoration)` : ''}`);
    }
    if (late.length) add(scene, 'T-MOVES', 'warning', late.slice(0, 5).join(', '), late.length, `after reduced motion is turned on, ${late.length} elements change once more later than 2 s (a late settle)`);
  } finally { await page.emulateMedia({ reducedMotion: 'no-preference' }); }
}

// Each press of the scene, by Enter: if a shell dialog opens it must be a named modal dialog with the rest inert, take
// focus, close on Escape and give focus back; a press that shows new controls over controls that stay usable is a
// panel that should be a dialog (series rule 9).
async function pressProbe(ctx, file, sc, m, add) {
  const n = { presses: 0, dialogs: 0, panels: 0 };
  if (!m) return n;
  const presses = m.controls.filter(c => c.shown && c.enabled && !c.inert && c.kind === 'button' && c.role === 'button');
  let op = null;
  try {
    for (const c of presses) {
      if (!op) op = await openAt(ctx, file, sc.actions);
      const { page } = op;
      const before = m.controls.filter(x => x.shown && x.enabled && !x.inert).map(x => x.id);
      const ok = await page.evaluate((id) => { const e = document.getElementById(id); e?.focus({ preventScroll: true }); return document.activeElement === e; }, c.id);
      if (!ok) continue;
      await page.keyboard.press('Enter'); n.presses++;
      await page.evaluate(() => { for (let i = 0; i < 5; i++) window.hsvg.advance(100); });
      // A sound the press played must really start (T-SOUND-SILENT): a node made and never started stays silent.
      const snd = await page.evaluate(P.soundNow);
      if (snd.silent) add(sc.id, 'T-SOUND-SILENT', 'error', `${c.addr}#${c.cid} (${c.id})`, snd.silent, `"${c.name}" plays a sound that never starts: ${snd.made} sound nodes made, ${snd.started} started${snd.stopBeforeStart ? `, ${snd.stopBeforeStart} stopped before their start (Web Audio refuses that)` : ''}`);
      const now = await page.evaluate(() => ({ scene: window.hsvg.player.scene, dialogs: (window.hsvg.player.openDialogs?.() || []).map(d => d.id) }));
      const el = `${c.addr}#${c.cid} (${c.id})`;
      let changed = now.scene !== sc.id;
      if (!changed && now.dialogs.length) {
        changed = true; n.dialogs++;
        const d = await page.evaluate(P.dialogNow);
        const f = await page.evaluate(P.focusNow);
        const bad = [];
        if (!d.found) bad.push('no element has role="dialog"');
        else { if (!d.modal) bad.push('no aria-modal="true"'); if (!d.name) bad.push('no name'); }
        if (d.outside.length) bad.push(`${d.outside.length} controls outside it are not inert (${d.outside.slice(0, 3).join(', ')})`);
        if (!f.inDialog) bad.push('focus did not move into it');
        await page.keyboard.press('Escape');
        await page.evaluate(() => window.hsvg.advance(100));
        const after = await page.evaluate(() => ({ open: (window.hsvg.player.openDialogs?.() || []).length, focus: document.activeElement?.id || null }));
        if (after.open) bad.push('Escape does not close it');
        else if (after.focus !== c.id) bad.push(`focus goes to ${after.focus || 'the page'}, not back to the press`);
        if (bad.length) add(sc.id, 'T-DIALOG', 'error', el, bad.length, `"${c.name}" opens dialog ${now.dialogs.join(', ')}: ${bad.join('; ')}`);
      } else if (!changed) {
        const shown = await page.evaluate(P.measureScene);
        const fresh = shown.controls.filter(x => x.shown && x.enabled && !x.inert && !before.includes(x.id));
        if (fresh.length) {
          changed = true;
          const cover = await page.evaluate((ids) => {
            const els = ids.map(i => document.getElementById(i)).filter(Boolean);
            let a = els[0]?.parentElement; while (a && !els.every(e => a.contains(e))) a = a.parentElement;
            if (!a) return null; const b = a.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, id: a.id };
          }, fresh.map(x => x.id));
          const under = cover ? shown.controls.filter(x => x.shown && x.enabled && !x.inert && before.includes(x.id) && x.id !== c.id && x.box && x.box.x + x.box.w / 2 > cover.x && x.box.x + x.box.w / 2 < cover.x + cover.w && x.box.y + x.box.h / 2 > cover.y && x.box.y + x.box.h / 2 < cover.y + cover.h) : [];
          if (under.length) n.panels++;
          if (under.length) add(sc.id, 'T-DIALOG', 'warning', el, under.length, `"${c.name}" shows a panel (${cover.id || 'no id'}) with ${fresh.length} controls over ${under.length} controls that stay usable: a card over the scene should be a shell dialog (rule 9)`);
        }
      }
      if (changed) { await page.close(); op = null; }
    }
  } finally { if (op) await op.page.close().catch(() => {}); }
  return n;
}

// Speed (--speed, Chromium): each scene runs speedMs on the real clock with the CPU slowed (CDP); frames a second
// and long tasks.
export async function speedPass(browser, file, scenes, o) {
  const t = { ...DEFAULTS, ...o.thresholds };
  const findings = []; const rows = [];
  const ctx = await newContext(browser, { viewport: LAYOUTS.wide.viewport, reducedMotion: 'no-preference' });
  try {
    for (const sc of scenes) {
      const op = await openAt(ctx, file, sc.actions, { manual: false });
      try {
        if (op.scene !== sc.id) continue;
        await op.page.evaluate(() => { window.__t1long = []; try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__t1long.push(e.duration); }).observe({ type: 'longtask', buffered: false }); } catch { /* none */ } });
        const cdp = await ctx.newCDPSession(op.page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: t.cpu });
        // While it runs, the scene is used: its first slider moves by a key every 250 ms (a person dragging), else
        // the scene runs on its own.
        const slider = await op.page.evaluate(() => { const it = window.hsvg.input.items().find(i => i.role === 'slider' && !i.disabled && i.tabindex === '0'); const el = it && document.getElementById(it.id); if (!el) return null; el.focus({ preventScroll: true }); return it.id; });
        const frames = op.page.evaluate((ms) => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else res({ frames: n, ms: performance.now() - t0, long: window.__t1long }); }; requestAnimationFrame(f); }), t.speedMs);
        if (slider) { const end = Date.now() + t.speedMs - 300; for (let k = 0; Date.now() < end; k++) { await op.page.keyboard.press(k % 8 < 4 ? 'ArrowRight' : 'ArrowLeft').catch(() => {}); await op.page.waitForTimeout(250); } }
        const r = await frames;
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        const fps = Math.round(r.frames / (r.ms / 1000) * 10) / 10;
        const worst = r.long.length ? Math.round(Math.max(...r.long)) : 0;
        rows.push({ scene: sc.id, fps, longTasks: r.long.length, worstMs: worst, used: slider ? 'slider by keys' : 'idle' });
        const tag = { browser: 'chromium', layout: 'wide' };
        if (fps < t.fps) findings.push({ code: 'T-SLOW', severity: 'error', scene: sc.id, ...tag, element: 'page', value: fps, message: `${fps} frames a second with the CPU ${t.cpu}x slower${slider ? ', a slider moved by keys' : ''} (under ${t.fps})` });
        if (worst > t.longTask) findings.push({ code: 'T-LONG-TASK', severity: 'warning', scene: sc.id, ...tag, element: 'page', value: worst, message: `${r.long.length} long tasks, the worst ${worst} ms at ${t.cpu}x (over ${t.longTask})` });
      } finally { await op.page.close().catch(() => {}); }
    }
  } finally { await ctx.close(); }
  return { findings, rows };
}

// Differences of another browser against Chromium: text boxes (by id) and control values.
export function compareBrowsers(base, other, browserName, layoutName) {
  const out = [];
  for (const [scene, a] of Object.entries(base)) {
    const b = other[scene]; if (!b) continue;
    const bt = new Map(b.texts.map(x => [x.id, x]));
    const diffs = [];
    for (const x of a.texts) { const y = bt.get(x.id); if (!y || x.text !== y.text) continue; const d = Math.max(Math.abs(x.box.w - y.box.w), Math.abs(x.box.h - y.box.h)); if (d > Math.max(2, 0.06 * x.box.w)) diffs.push([d, x.id, x.box.w, y.box.w]); }
    diffs.sort((p, q) => q[0] - p[0]);
    if (diffs.length) out.push({ code: 'T-BROWSER-TEXT', severity: 'warning', scene, browser: browserName, layout: layoutName, element: diffs.slice(0, 3).map(d => d[1]).join(', '), value: diffs[0][0], message: `${diffs.length} texts differ from Chromium by more than 2 px; the most: ${diffs.slice(0, 3).map(d => `${d[1]} ${d[2]} -> ${d[3]} px wide`).join('; ')}` });
    const bc = new Map(b.controls.map(c => [c.id, c]));
    for (const c of a.controls) { const d = bc.get(c.id); if (d && (c.value !== d.value || c.valueText !== d.valueText || c.name !== d.name)) out.push({ code: 'T-BROWSER-VALUE', severity: 'warning', scene, browser: browserName, layout: layoutName, element: c.id, value: null, message: `"${c.name}" ${c.valueText ?? c.value} in Chromium, "${d.name}" ${d.valueText ?? d.value} here` }); }
  }
  return out;
}

export const fileExists = (f) => { try { return fs.statSync(f).isFile(); } catch { return false; } };
