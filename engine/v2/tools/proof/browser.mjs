// The packed page in a real browser: open it, observe it, drive it by keyboard and pointer, record and replay.
// The page is opened from file: exactly as packed, with its own CSP. The proof uses only the packed page's test
// hooks (window.hsvg: ?clock=manual, advance, the player's scene, values, controls and outputs) and real browser
// input (Tab, keys, the mouse). It never calls a control's handler directly and never dispatches synthetic events.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { verifyBuild } from './build.mjs';
import { TRACE, canonical, digestOf, identity, controlKey, validateInput, validateTrace } from './format.mjs';

// Playwright is never a dependency. PW_PATH names a folder that holds node_modules/playwright (as the engine's
// browser tests read it), or the playwright package folder itself; else Node resolves 'playwright'.
export function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const tries = [];
  if (process.env.PW_PATH) tries.push(path.join(process.env.PW_PATH, 'node_modules', 'playwright'), process.env.PW_PATH);
  tries.push('playwright');
  for (const t of tries) {
    if (t !== 'playwright' && !fs.existsSync(t)) continue;
    try { return require(t); } catch { /* the next */ }
  }
  throw new Error('Playwright is not installed: set PW_PATH to a folder holding node_modules/playwright');
}
export async function launchBrowser() {
  const pw = loadPlaywright();
  return pw.chromium.launch({ headless: true, ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}) });
}

// stepMs: the clock moves in steps of at most this many ms, as the page's own clock does (player-web.mjs moves at most
// 100 ms a frame). 9.4 says one large step and many small ones give the same result; physics does not yet (Requests).
export const defaultStart = Object.freeze({ viewport: { width: 960, height: 600 }, reducedMotion: true, storage: 'empty', stepMs: 100 });
const ROLES = new Set(['button', 'radio', 'slider', 'checkbox', 'switch', 'textbox', 'searchbox', 'combobox', 'spinbutton', 'link', 'menuitem', 'tab', 'option']);
const OUTSIDE = /^(?!file:|data:|blob:|about:|chrome-error:)[a-z][a-z0-9+.-]*:/i;

// Opens one fresh page: its own browser context, so storage starts empty.
export async function openSession(browser, build, start = defaultStart) {
  verifyBuild(build);
  if (start.storage !== 'empty') throw new Error('only empty storage is supported at the start');
  const context = await browser.newContext({ viewport: start.viewport, deviceScaleFactor: 1, reducedMotion: start.reducedMotion ? 'reduce' : 'no-preference', serviceWorkers: 'block', acceptDownloads: false });
  const network = []; const errors = []; const inputs = [];
  const noteNetwork = (url, kind) => { if (!network.some(n => n.url === url && n.kind === kind)) network.push({ url, kind }); };
  // Every connection outside the file is blocked and noted, whatever the CSP says.
  await context.route('**/*', (route) => { const url = route.request().url(); if (OUTSIDE.test(url)) { noteNetwork(url, 'request'); return route.abort(); } return route.continue(); });
  await context.routeWebSocket(/.*/, (ws) => { noteNetwork(ws.url(), 'websocket'); ws.close(); });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on('request', (q) => { if (OUTSIDE.test(q.url())) noteNetwork(q.url(), 'request'); });
  page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy|Refused to/i.test(m.text())) errors.push(`CSP: ${m.text()}`); });
  await page.exposeBinding('__proofViolation', (_, v) => noteNetwork(v.url, `csp:${v.directive}`));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => globalThis.__proofViolation({ url: e.blockedURI || '', directive: e.violatedDirective }));
  });
  let startError = null;
  try {
    await page.goto(pathToFileURL(build.file).href + '?clock=manual');
    await page.waitForFunction(() => window.hsvgReady === true || window.hsvgError, null, { timeout: 30000 });
    // A page that stopped before it drew a scene (a missing module or capability, 9.2) shows its fault: that is the
    // start error, with its code.
    startError = await page.evaluate(() => window.hsvgError || (window.hsvg?.stopped && !window.hsvg.drawing ? `${window.hsvg.stopped.code || 'fault'}: ${window.hsvg.stopped.message}` : null));
    if (!startError) {
      await page.evaluate(() => {
        const h = window.hsvg; const p = h.player;
        window.__proof = { outputs: [], visited: [p.scene] };
        p.on(({ outputs }) => {
          for (const { name, ...detail } of outputs || []) {
            window.__proof.outputs.push({ name, detail: JSON.parse(JSON.stringify(detail ?? null)), time: p.state.now });
            if (name === 'entered' && detail.scene) window.__proof.visited.push(detail.scene);
          }
        });
      });
    }
  } catch (e) { await context.close(); throw e; }
  const cdp = await context.newCDPSession(page);

  // What a person could observe, plus the engine's declared values (read through the test hooks).
  async function snapshot(label = '') {
    if (startError) return { label, scene: null, time: 0, values: {}, outputs: [], error: `start: ${startError}`, visited: [], pending: [], moving: [], measures: null };
    const s = await page.evaluate((label) => {
      const h = window.hsvg; const p = h.player;
      const clean = (x) => JSON.parse(JSON.stringify(x ?? null, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? { number: String(v) } : v)));
      const values = {};
      for (const [addr, b] of Object.entries(p.state.blocks).sort(([a], [c]) => (a < c ? -1 : a > c ? 1 : 0))) values[addr] = clean({ values: b.values || {}, inputs: b.inputs || {} });
      const bytes = (st) => { let n = 0; try { for (let i = 0; i < st.length; i++) { const k = st.key(i); n += new TextEncoder().encode(k + (st.getItem(k) || '')).length; } } catch { return null; } return n; };
      const stage = document.getElementById('stage');
      const addrs = Object.keys(p.state.blocks);
      return {
        label, scene: p.scene, time: p.state.now, values,
        outputs: window.__proof.outputs.splice(0),
        error: h.stopped ? `${h.stopped.code || 'fault'}: ${h.stopped.message}` : null,
        visited: [...window.__proof.visited],
        // The deadlines still to come, by owner and time left: waiting can change what happens next.
        pending: p.state.timers.map(t => [String(t.owner), t.due - p.state.now]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1])),
        // Physics bodies still moving, at a coarse position (10 units): waiting on a moving body is progress.
        moving: Object.entries(p.state.blocks).flatMap(([a, b]) => Object.values(b.physics?.bodies || {}).filter(x => !x.sleeping && (x.vx || x.vy)).map(x => [a, x.id, Math.round(x.x / 10), Math.round(x.y / 10)])).sort(),
        measures: { elements: stage ? stage.querySelectorAll('*').length : 0, blocks: addrs.length, depth: Math.max(1, ...addrs.map(a => a.split('/').length)),
          timers: p.state.timers.length, savedBytes: bytes(window.localStorage), sessionBytes: bytes(window.sessionStorage) },
      };
    }, label);
    if (errors.length) s.error = [s.error, ...errors.splice(0)].filter(Boolean).join('; ');
    return s;
  }

  // The usable controls now: Chromium's accessibility tree (computed role and name) joined with the player's
  // controls (src: web/input-web.mjs items) by DOM id. An interactive node in #stage that is not a player control is
  // a widget (the shell's HTML, A6.1).
  async function controls() {
    if (startError) return [];
    const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: false });
    const nodes = new Map();
    const walk = (n, inStage) => {
      const a = n.attributes || []; const attrs = {};
      for (let i = 0; i < a.length; i += 2) attrs[a[i]] = a[i + 1];
      const here = inStage || attrs.id === 'stage';
      nodes.set(n.backendNodeId, { attrs, inStage: here && attrs.id !== 'stage' });
      for (const c of n.children || []) walk(c, here);
    };
    walk(root, false);
    const { nodes: ax } = await cdp.send('Accessibility.getFullAXTree');
    const items = await page.evaluate(() => {
      const h = window.hsvg; const p = h.player;
      const shown = (el) => { if (!el?.isConnected) return false; for (let n = el; n && n.id !== 'stage'; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden') return false; } const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
      return h.input.items().map((it) => {
        const c = p.def(it.addr)?.controls?.[it.cid] || {};
        const el = document.getElementById(it.id);
        const drops = c.kind === 'drag' ? (c.drops || []).filter(d => h.drawing.frames[it.addr]?.byLocal.get(d)?.dom) : undefined;
        let enabled = false; try { enabled = p.controlEnabled(it.addr, it.cid, it.option); } catch { enabled = false; }
        // A control outside the open dialog, hidden or disabled has no tab stop (input-web.mjs); an option control has one
        // tab stop for the group, so its options count as usable while they are shown and enabled.
        const stop = c.kind === 'choice' || it.tabindex === '0';
        return { addr: it.addr, cid: it.cid, option: it.option, id: it.id, kind: c.kind || 'unknown', enabled: enabled && stop && shown(el), drops };
      });
    });
    const byId = new Map(items.filter(i => i.id).map(i => [i.id, i]));
    const out = []; const seen = new Set();
    for (const n of ax) {
      const role = n.role?.value;
      if (n.ignored || !ROLES.has(role)) continue;
      const dom = nodes.get(n.backendDOMNodeId);
      if (!dom?.inStage) continue;
      const props = Object.fromEntries((n.properties || []).map(q => [q.name, q.value?.value]));
      const name = n.name?.value || '';
      // What a person can see of the control's own state: checked, pressed, expanded, its value.
      const state = [props.checked, props.pressed, props.expanded, n.value?.value].map(v => (v === undefined ? null : v));
      const id = dom.attrs.id || '';
      const item = id ? byId.get(id) : null;
      if (item) {
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({ addr: item.addr, cid: item.cid, option: item.option, id, role, name, kind: item.kind, enabled: item.enabled && !props.disabled, state, ...(item.drops ? { drops: item.drops } : {}) });
      } else {
        const kind = role === 'checkbox' || role === 'switch' ? 'widget-check' : role === 'radio' ? 'widget-option' : role === 'slider' || role === 'spinbutton' ? 'widget-slider' : ['textbox', 'searchbox', 'combobox'].includes(role) ? 'widget-text' : 'widget-press';
        out.push({ widget: true, id, role, name, kind, enabled: !props.disabled && !props.hidden, state });
      }
    }
    return out;
  }

  const byIdSel = (id) => `[id=${JSON.stringify(id)}]`;
  async function locate(control) {
    const loc = control.id ? page.locator(byIdSel(control.id)) : page.locator('#stage').getByRole(control.role, { name: control.name, exact: true });
    const n = await loc.count();
    if (n !== 1) throw new Error(`${n ? 'more than one' : 'no'} control ${control.role} "${control.name}"`);
    const now = (await controls()).find(c => controlKey(c) === controlKey(control) && (!control.id || c.id === control.id));
    if (!now) throw new Error(`control ${control.role} "${control.name}" is not shown now`);
    if (now.role !== control.role || now.name !== control.name) throw new Error(`control identity changed: expected ${control.role} "${control.name}", found ${now.role} "${now.name}"`);
    if (!now.enabled) throw new Error(`control ${control.role} "${control.name}" is not usable`);
    return { loc, now };
  }
  // The radio group of an element: a player option control (addr#cid), a native radio's name, or a radiogroup.
  const groupOf = (el) => {
    if (!el || el === document.body) return null;
    const it = window.hsvg.input.items().find(i => i.id && i.id === el.id);
    if (it) return it.option !== undefined ? `${it.addr}#${it.cid}` : null;
    if (el.matches('input[type=radio]') && el.name) return `native:${el.name}`;
    const g = el.getAttribute('role') === 'radio' ? el.closest('[role=radiogroup]') : null;
    return g ? `group:${[...document.querySelectorAll('[role=radiogroup]')].indexOf(g)}` : null;
  };
  const activeGroup = async () => { const h = await page.evaluateHandle(() => document.activeElement); try { return await h.evaluate(groupOf); } finally { await h.dispose(); } };
  // Focus by Tab only (never element.focus() or a click). An option control has one tab stop; the arrows move to
  // the wanted option.
  async function keyboardFocus(control) {
    const { loc, now } = await locate(control);
    const limit = (await controls()).length * 2 + 10;
    for (let i = 0; i <= limit; i++) {
      if (await loc.evaluate(n => n === document.activeElement)) return now;
      const group = control.role === 'radio' ? await loc.evaluate(groupOf) : null;
      if (group && group === await activeGroup()) {
        for (let k = 0; k < 40; k++) {
          await page.keyboard.press('ArrowRight');
          if (await loc.evaluate(n => n === document.activeElement)) return now;
        }
        throw new Error(`the arrows do not reach option "${control.name}"`);
      }
      await page.keyboard.press('Tab');
    }
    throw new Error(`no Tab path to ${control.role} "${control.name}"`);
  }
  const centre = async (loc) => { const b = await loc.boundingBox(); if (!b) throw new Error('the control has no box to point at'); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

  async function apply(input) {
    input = structuredClone(input);
    if (startError) throw new Error(`the page did not start: ${startError}`);
    const now = await page.evaluate(() => window.hsvg.player.state.now);
    validateInput(input, now);
    await page.evaluate(([ms, step]) => { const h = window.hsvg; if (!step) { h.advance(ms); return; } h.advance(0); for (let left = ms; left > 0; left -= step) h.advance(Math.min(step, left)); }, [input.t - now, start.stepMs || 0]);
    if (input.act === 'key') await page.keyboard.press(input.key);
    if (input.act === 'activate') {
      if (input.via === 'keyboard') {
        const c = await keyboardFocus(input.control);
        input.control = identity(c);
        await page.keyboard.press(input.key || (c.kind === 'widget-check' ? 'Space' : 'Enter'));
      } else {
        const { loc, now: c } = await locate(input.control);
        input.control = identity(c);
        // A slider is clicked four fifths along its axis (its centre may be its value now); anything else at its centre.
        const b = await loc.boundingBox();
        if (!b) throw new Error('the control has no box to point at');
        const along = c.role === 'slider' ? (b.height > b.width ? { x: 0.5, y: 0.2 } : { x: 0.8, y: 0.5 }) : { x: 0.5, y: 0.5 };
        await page.mouse.click(b.x + b.width * along.x, b.y + b.height * along.y);
      }
    }
    if (input.act === 'drag') {
      if (input.via === 'keyboard') {
        const c = await keyboardFocus(input.control);
        input.control = identity(c);
        const index = (c.drops || []).indexOf(input.drop);
        if (index < 0) throw new Error(`drop ${input.drop} is not shown for "${c.name}"`);
        await page.keyboard.press('Enter');
        for (let k = 0; k <= index; k++) await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Enter');
      } else {
        const { loc, now: c } = await locate(input.control);
        input.control = identity(c);
        const from = await centre(loc);
        const to = await page.evaluate(([addr, drop]) => { const el = window.hsvg.drawing.frames[addr]?.byLocal.get(drop)?.dom; const b = el?.getBoundingClientRect(); return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null; }, [c.addr, input.drop]);
        if (!to) throw new Error(`drop ${input.drop} has no box`);
        await page.mouse.move(from.x, from.y); await page.mouse.down();
        try { await page.mouse.move(to.x, to.y, { steps: 8 }); } finally { await page.mouse.up(); }
      }
    }
    inputs.push(input);
    return snapshot(input.act);
  }
  return { page, snapshot, controls, apply, startError, get acts() { return structuredClone(inputs); }, network, errors, close: () => context.close() };
}

// A checkpoint keeps the values as a digest; the final expectation keeps them whole.
const checkpoint = (s) => ({ label: s.label, scene: s.scene, time: s.time, values: digestOf(s.values), outputs: s.outputs, error: s.error });

export async function record(browser, build, acts, { start = defaultStart } = {}) {
  const session = await openSession(browser, build, start);
  try {
    const snaps = [await session.snapshot('mount')];
    for (const input of acts) snaps.push(await session.apply(input));
    const last = snaps.at(-1);
    return {
      format: TRACE, product: build.product, fingerprint: build.fingerprint, start: structuredClone(start),
      acts: session.acts, checkpoints: snaps.map(checkpoint),
      expect: { scene: last.scene, time: last.time, values: last.values, error: last.error, visitedScenes: last.visited },
      network: [...session.network],
    };
  } finally { await session.close(); }
}

// Plays a trace again on the same page bytes and compares every checkpoint and the final state (9.6).
export async function replay(browser, build, trace) {
  validateTrace(trace);
  if (trace.fingerprint !== build.fingerprint) throw new Error('the trace belongs to another packed page');
  const actual = await record(browser, build, trace.acts, { start: trace.start });
  const differences = [];
  trace.checkpoints.forEach((c, i) => { for (const k of Object.keys(c)) if (canonical(c[k]) !== canonical(actual.checkpoints[i]?.[k])) differences.push(`checkpoint ${i} ${k}`); });
  for (const k of Object.keys(trace.expect)) if (canonical(trace.expect[k]) !== canonical(actual.expect[k])) differences.push(`expect ${k}`);
  return { pass: differences.length === 0 && !actual.expect.error, differences, actual };
}
