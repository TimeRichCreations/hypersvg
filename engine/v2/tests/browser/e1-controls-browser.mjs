// How controls reach people. Packed pages played in a real browser. Run alone (it starts a browser):
//   node engine/v2/tests/browser/e1-controls-browser.mjs [part ...] [--drag <experience folder> [--drag-kit <kit folder>]]
//   [--choices <experience folder> [--choices-kit <kit folder>]] [--shots <folder>]
// Parts: touch, names, keys, ring, drag (default: all).
// - touch (item 0): a finger drag (real touch events through CDP) on a drag control: the item follows the finger,
//   drops on the drop place under it, and the page does not scroll; a tap still picks up and a second tap drops; a
//   finger tap on an option still chooses it. On the drag-sort recipe, the noughts example, and an outside
//   drag-and-drop catalog given with --drag (and its kit with --drag-kit).
// - names (items 1 and 2): no control sits inside an `img` in the accessibility tree; each option control is a
//   `radiogroup` named by its label, with its radios inside (the e1 and k1 fixtures, noughts, the quiz recipe, and an
//   outside choices catalog given with --choices).
// - keys (item 4): Page Up and Page Down move a slider one tenth of its travel (whole stops with positions).
// - ring (item 5): the focus ring on a round thumb, a pill and a segment inside a clipped pill, at 100% and 200%;
//   light, dark and forced colours. --shots <folder> keeps the pictures.
// - drag (item 6): a hidden drop is no keyboard stop; aria-pressed and the held look follow at once (a tap, Escape);
//   while a held item moves by arrows a polite live region names the drop it is over.
// Playwright must already be installed (PW_PATH, or a global install). It is never a dependency.
import fs from 'node:fs';
import zlib from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..', '..');
const { pack } = await import(pathToFileURL(path.join(repo, 'engine', 'v2', 'tools', 'pack.mjs')).href);
const { launchBrowser } = await import(pathToFileURL(path.join(repo, 'engine', 'v2', 'tools', 'proof', 'browser.mjs')).href);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-e1-'));

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return path.resolve(v); };
const dragDir = opt('--drag');
const choicesDir = opt('--choices');
const dragKit = opt('--drag-kit');
const choicesKit = opt('--choices-kit');
const shotsDir = opt('--shots');
const PARTS = ['touch', 'names', 'keys', 'ring', 'drag'];
const parts = args.length ? args : PARTS;

const problems = [];
const want = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
const lerp = (p, q, f) => ({ x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f });
const recipe = (name) => path.join(repo, 'skill', '2.0', 'examples', 'recipes', name);
const fixture = (name) => path.join(repo, 'engine', 'v2', 'tests', name);

const browser = await launchBrowser();
const packed = new Map();
// The kit folder an outside catalog is packed with, by its id.
const kitsOf = (k) => (k ? { [JSON.parse(fs.readFileSync(path.join(k, 'kit.json'), 'utf8')).id]: k } : {});
async function pageFile(dir) {
  if (packed.has(dir)) return packed.get(dir);
  const out = path.join(tmp, `out-${packed.size}`);
  const kits = kitsOf(dir === dragDir ? dragKit : dir === choicesDir ? choicesKit : null);
  await pack(dir, out, { test: true, kits, allow: ['example.glow', 'example.noughts'] });
  const html = fs.readdirSync(out).find(f => f.endsWith('.html'));
  packed.set(dir, path.join(out, html));
  return packed.get(dir);
}
async function open(dir, { viewport = { width: 960, height: 600 }, touch = false, scheme = 'light', forced = 'none', zoom = 1, query = '' } = {}) {
  const file = await pageFile(dir);
  const ctx = await browser.newContext({ viewport, hasTouch: touch, deviceScaleFactor: zoom, colorScheme: scheme, forcedColors: forced });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(file).href + query);
  await page.waitForFunction(() => window.hsvg?.input?.items, null, { timeout: 20000 });
  await page.waitForTimeout(500);
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp, errors, wait: (ms = 400) => page.waitForTimeout(ms) };
}
const noErrors = async (tag, o) => want(!o.errors.length && !(await o.page.evaluate(() => window.hsvg.errors?.length || 0)), `${tag}: no page or engine error ${o.errors.join(' | ')}`);
// The centre of an element on screen.
const centre = (page, id) => page.evaluate((id) => { const b = document.getElementById(id).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, id);
// The live drag items of the page and their drops: [{id, addr, cid, drops: [ids of shown drops]}].
const dragItems = (page) => page.evaluate(() => window.hsvg.input.items().filter(i => i.role === 'button' && !i.disabled && document.getElementById(i.id)?.getAttribute('aria-roledescription') === 'draggable').map(i => {
  const f = window.hsvg.drawing.frames[i.addr];
  const drops = (window.hsvg.player.def(i.addr).controls[i.cid].drops || []).map(d => f.byLocal.get(d)?.dom).filter(e => e && e.getBoundingClientRect().width > 0).map(e => e.id);
  const b = document.getElementById(i.id).getBoundingClientRect();
  return { id: i.id, addr: i.addr, cid: i.cid, drops, shown: b.width > 0 && b.height > 0 };
}).filter(x => x.shown));

// ---------- item 0: touch ----------
// A finger drag from `from` to `to` in `steps` moves; at the step before the last, `mid` reads the page.
async function fingerDrag(o, from, to, steps, mid) {
  await o.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
  let seen = null;
  for (let i = 1; i <= steps; i++) {
    const p = lerp(from, to, i / steps);
    await o.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y }] });
    if (i === steps && mid) seen = await mid();
  }
  await o.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await o.wait();
  return seen;
}
const tap = async (o, p) => { await o.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] }); await o.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await o.wait(); };
// Lets the page scroll (a spacer under the stage), so a drag that scrolls it would show.
const scrollable = (page) => page.evaluate(() => { const d = document.createElement('div'); d.style.height = '2000px'; document.body.appendChild(d); scrollTo(0, 40); return [scrollX, scrollY]; });

async function touchDragSort() {
  for (const [layout, viewport] of Object.entries({ phone: { width: 390, height: 844 }, wide: { width: 960, height: 600 } })) {
    const tag = `drag-sort ${layout}`;
    const o = await open(recipe('drag-sort'), { viewport, touch: true });
    const s0 = await scrollable(o.page);
    const read = (n) => o.page.evaluate((n) => window.hsvg.player.read('sort', n), n);
    // A slow finger drag of the apple onto the compost bin (8 moves), and the can onto the recycling bin (3 moves).
    for (const [item, bin, flag, steps] of [['apple', 'compost-bin', 'appleIn', 8], ['can', 'recycle-bin', 'canIn', 3]]) {
      const id = await o.page.evaluate((t) => window.hsvg.drawing.frames.sort.byLocal.get(t).dom.id, item);
      const binId = await o.page.evaluate((t) => window.hsvg.drawing.frames.sort.byLocal.get(t).dom.id, bin);
      const A = await centre(o.page, id); const B = await centre(o.page, binId);
      const midPlace = await fingerDrag(o, A, B, steps, () => centre(o.page, id));
      const off = Math.hypot(midPlace.x - B.x, midPlace.y - B.y);
      want(off < 3, `${tag}: the ${item} follows the finger (${off.toFixed(1)} px off at the last move)`);
      want(await read(flag) === true, `${tag}: a finger drag drops the ${item} on the ${bin} (${flag} ${await read(flag)})`);
      const s1 = await o.page.evaluate(() => [scrollX, scrollY]);
      want(s1.join() === s0.join(), `${tag}: the page does not scroll during the ${item} drag (${s0} -> ${s1})`);
    }
    // A wrong drop goes home: the bottle onto the compost bin counts a miss.
    const miss0 = await read('misses');
    const bottle = await o.page.evaluate(() => window.hsvg.drawing.frames.sort.byLocal.get('bottle').dom.id);
    const compost = await o.page.evaluate(() => window.hsvg.drawing.frames.sort.byLocal.get('compost-bin').dom.id);
    const home = await centre(o.page, bottle);
    await fingerDrag(o, home, await centre(o.page, compost), 6);
    want(await read('misses') === miss0 + 1 && await read('bottleIn') === false, `${tag}: a wrong finger drop is a miss and places nothing`);
    // A tap picks the paper up (it stays where it is); a tap on its bin drops it there.
    const paper = await o.page.evaluate(() => window.hsvg.drawing.frames.sort.byLocal.get('paper').dom.id);
    await tap(o, await centre(o.page, paper));
    await tap(o, await centre(o.page, compost));
    want(await read('paperIn') === true, `${tag}: a tap picks the paper up and a second tap drops it on its bin`);
    const s2 = await o.page.evaluate(() => [scrollX, scrollY]);
    want(s2.join() === s0.join(), `${tag}: the page did not scroll`);
    // A finger on the page outside a control still scrolls it: the touch is kept only while an item is held.
    await o.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 5, y: viewport.height - 20 }] });
    for (let i = 1; i <= 6; i++) await o.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 5, y: viewport.height - 20 - i * 30 }] });
    await o.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await o.wait();
    const s3 = await o.page.evaluate(() => [scrollX, scrollY]);
    want(s3[1] > s0[1], `${tag}: a finger drag outside the controls still scrolls the page (${s0[1]} -> ${s3[1]})`);
    await noErrors(tag, o);
    await o.ctx.close();
  }
}
async function touchNoughts() {
  const tag = 'noughts phone';
  const o = await open(path.join(repo, 'engine', 'v2', 'addons', 'examples', 'noughts'), { viewport: { width: 390, height: 844 }, touch: true });
  const opts = await o.page.evaluate(() => window.hsvg.input.items().filter(i => i.role === 'radio' && !i.disabled).map(i => ({ id: i.id, addr: i.addr, cid: i.cid })));
  want(opts.length > 0, `${tag}: ${opts.length} option(s) to tap`);
  if (opts.length) {
    const first = opts[0];
    await tap(o, await centre(o.page, first.id));
    const checked = await o.page.evaluate((id) => document.getElementById(id)?.getAttribute('aria-checked'), first.id);
    const rev = await o.page.evaluate(() => window.hsvg.player.state.revision);
    want(checked === 'true' || rev > 0, `${tag}: a finger tap on an option chooses it (aria-checked ${checked})`);
  }
  await noErrors(tag, o);
  await o.ctx.close();
}
// An outside drag-and-drop catalog (--drag): each tab's first drag item, dragged by a finger to each of its drops in
// turn until one takes it: it follows the finger, the drop is answered, and the page does not scroll.
async function touchCatalog() {
  if (!dragDir) { console.log('skip touch catalog: no --drag folder'); return; }
  const tag = `catalog ${path.basename(dragDir)} phone`;
  const o = await open(dragDir, { viewport: { width: 390, height: 844 }, touch: true });
  const s0 = await scrollable(o.page);
  const items = await dragItems(o.page);
  want(items.length > 0, `${tag}: ${items.length} drag item(s) shown`);
  let followed = 0; let answered = 0; let tried = 0;
  for (const it of items.slice(0, 6)) {
    for (const drop of it.drops.slice(0, 3)) {
      const live = await o.page.evaluate((id) => !!document.getElementById(id) && document.getElementById(id).getAttribute('aria-disabled') !== 'true', it.id);
      if (!live) break;
      tried++;
      const A = await centre(o.page, it.id); const B = await centre(o.page, drop);
      const mid = await fingerDrag(o, A, B, 8, async () => ({ ...(await centre(o.page, it.id)), rev: await o.page.evaluate(() => window.hsvg.player.state.revision) }));
      if (Math.hypot(mid.x - B.x, mid.y - B.y) < 3) followed++;
      if (await o.page.evaluate(() => window.hsvg.player.state.revision) > mid.rev) answered++; // the drop's own change, after the hold
      break;
    }
  }
  want(tried > 0 && followed === tried, `${tag}: the item follows the finger in ${followed} of ${tried} drags`);
  want(tried > 0 && answered === tried, `${tag}: the drop is answered in ${answered} of ${tried} drags`);
  const s1 = await o.page.evaluate(() => [scrollX, scrollY]);
  want(s1.join() === s0.join(), `${tag}: the page does not scroll (${s0} -> ${s1})`);
  if (shotsDir) await o.page.screenshot({ path: path.join(shotsDir, 'touch-catalog-after.png') });
  await noErrors(tag, o);
  await o.ctx.close();
}

// ---------- items 1 and 2: names ----------
// The accessibility tree as Playwright's ariaSnapshot writes it, read into nodes {role, name, flags, kids}.
async function tree(page) {
  const text = await page.locator('body').ariaSnapshot();
  const root = { role: 'root', kids: [], depth: -1 };
  const stack = [root];
  for (const line of text.split('\n')) {
    const m = /^(\s*)- '?([a-z]+)(?: "((?:[^"\\]|\\.)*)")?((?: \[[^\]]+\])*)/.exec(line);
    if (!m) continue;
    const node = { role: m[2], name: m[3] ?? '', flags: m[4] || '', kids: [], depth: m[1].length / 2 };
    while (stack.at(-1).depth >= node.depth) stack.pop();
    stack.at(-1).kids.push(node); node.up = stack.at(-1);
    stack.push(node);
  }
  return { root, text };
}
const walk = (n, fn) => { fn(n); for (const k of n.kids) walk(k, fn); };
const CONTROL = new Set(['button', 'radio', 'slider', 'checkbox', 'radiogroup']);
// Every option control's label and its shown options: [{key, label, count}].
const optionGroups = (page) => page.evaluate(() => {
  const out = new Map();
  for (const i of window.hsvg.input.items()) {
    if (i.role !== 'radio') continue;
    const el = document.getElementById(i.id); const b = el.getBoundingClientRect();
    const key = `${i.addr}#${i.cid}`;
    if (!out.has(key)) { let label = ''; try { label = String(window.hsvg.player.template(i.addr, window.hsvg.player.def(i.addr).controls[i.cid].label || '')); } catch { label = ''; } out.set(key, { key, label, count: 0 }); }
    if (b.width > 0 && b.height > 0) out.get(key).count++;
  }
  return [...out.values()];
});
async function namesOf(tag, o) {
  const { root, text } = await tree(o.page);
  const inImg = [];
  walk(root, (n) => { if (CONTROL.has(n.role)) { for (let u = n.up; u; u = u.up) if (u.role === 'img') { inImg.push(`${n.role} "${n.name}" in img "${u.name}"`); break; } } });
  want(!inImg.length, `${tag}: no control sits inside an img${inImg.length ? ': ' + inImg.slice(0, 4).join('; ') : ''}`);
  const groups = await optionGroups(o.page);
  for (const g of groups.filter(x => x.count > 0)) { // a group with no shown option is not in the tree
    const found = []; walk(root, (n) => { if (n.role === 'radiogroup' && n.name === g.label) found.push(n); });
    const radios = found[0] ? found[0].kids.filter(k => k.role === 'radio').length : 0;
    want(found.length === 1 && radios === g.count, `${tag}: option control ${g.key} is radiogroup "${g.label}" with its ${g.count} radios inside (found ${found.length}, ${radios} radios)`);
  }
  return { root, text, groups };
}
async function names() {
  for (const [name, dir] of [['e1-fixture', fixture('e1-fixture')], ['k1-fixture', fixture('k1-fixture')], ['noughts', path.join(repo, 'engine', 'v2', 'addons', 'examples', 'noughts')], ['quiz', recipe('quiz')], ...(choicesDir ? [['choices', choicesDir]] : [])]) {
    const o = await open(dir, { viewport: { width: 1280, height: 800 } });
    const { root, text, groups } = await namesOf(name, o);
    want(groups.length > 0 || name === 'quiz', `${name}: ${groups.length} option control(s)`);
    if (name === 'e1-fixture') {
      const find = (role, nm) => { let f = null; walk(root, (n) => { if (!f && n.role === role && n.name === nm) f = n; }); return f; };
      want(!!find('img', 'A sun'), 'e1-fixture: a named part with no control is still img "A sun"');
      const panel = find('group', 'Size panel');
      want(!!panel, 'e1-fixture: a named part that holds options is group "Size panel"');
      let inside = false; if (panel) walk(panel, (n) => { if (n.role === 'radiogroup' && n.name === 'Size') inside = true; });
      want(inside, 'e1-fixture: radiogroup "Size" sits inside group "Size panel"');
      const owns = await o.page.evaluate(() => { const g = document.querySelector('[role=radiogroup][aria-label=Mood]'); return g ? [g.localName, g.getAttribute('aria-owns')?.split(' ').length || 0] : null; });
      want(owns && owns[1] === 2, `e1-fixture: the Mood options share their parent with a press, so an engine-made group owns them (${owns})`);
      await o.page.evaluate(() => document.querySelector('[aria-label="Mood on or off"]').focus()); await o.page.keyboard.press('Enter'); await o.wait();
      const t2 = await tree(o.page);
      want(/radiogroup "Mood" \[disabled\]/.test(t2.text), 'e1-fixture: a disabled option control is a disabled radiogroup');
      await o.page.keyboard.press('Enter'); await o.wait();
      want(/radiogroup "Mood":/.test((await tree(o.page)).text), 'e1-fixture: enabled again, it is no longer disabled');
      // Arrows still move focus and do not choose; Space chooses (the brief keeps today's keys).
      await o.page.evaluate(() => document.querySelector('[role=radio][aria-label=Medium]').focus());
      await o.page.keyboard.press('ArrowRight'); await o.wait(200);
      const st = await o.page.evaluate(() => [document.activeElement.getAttribute('aria-label'), window.hsvg.player.read('s', 'fit')]);
      want(st.join() === 'Large,m', `e1-fixture: an arrow moves focus to Large and chooses nothing (${st})`);
      await o.page.keyboard.press('Space'); await o.wait(200);
      want(await o.page.evaluate(() => window.hsvg.player.read('s', 'fit')) === 'l', 'e1-fixture: Space chooses the focused option');
    }
    if (shotsDir) fs.writeFileSync(path.join(shotsDir, `tree-${name}.txt`), text);
    await noErrors(name, o);
    await o.ctx.close();
  }
}

// ---------- item 4: Page Up and Page Down ----------
async function keys() {
  const o = await open(fixture('e1-fixture'));
  const s0 = await scrollable(o.page);
  const now = (label) => o.page.evaluate((l) => Number(document.querySelector(`[role=slider][aria-label="${l}"]`).getAttribute('aria-valuenow')), label);
  const press = async (label, k) => { await o.page.evaluate((l) => document.querySelector(`[role=slider][aria-label="${l}"]`).focus(), label); await o.page.keyboard.press(k); await o.wait(150); return now(label); };
  for (const [label, page, max] of [['Volume', 10, 100], ['Spice', 1, 3], ['Temperature', 2, 20]]) {
    const seen = [await press(label, 'Home'), await press(label, 'PageUp'), await press(label, 'PageUp'), await press(label, 'PageDown'), await press(label, 'ArrowRight'), await press(label, 'End'), await press(label, 'PageUp'), await press(label, 'PageDown')];
    const wantSeen = [0, page, 2 * page, page, page + (label === 'Volume' ? 10 : 1), max, max, max - page];
    want(seen.join() === wantSeen.join(), `${label}: Home, PageUp, PageUp, PageDown, ArrowRight, End, PageUp, PageDown give ${seen} (want ${wantSeen})`);
  }
  const scroll = await o.page.evaluate(() => [scrollX, scrollY]);
  want(scroll.join() === s0.join(), `Page keys on a slider do not scroll the page (${s0} -> ${scroll})`);
  await noErrors('keys', o);
  await o.ctx.close();
}

// ---------- item 5: the focus ring ----------
// A PNG as {width, height, px(x, y) -> [r, g, b]} (8-bit RGB or RGBA, not interlaced: what Chrome writes).
function readPng(buf) {
  const width = buf.readUInt32BE(16); const height = buf.readUInt32BE(20); const type = buf[25]; const bpp = type === 6 ? 4 : 3;
  const chunks = []; for (let i = 8; i < buf.length;) { const len = buf.readUInt32BE(i); const t = buf.toString('ascii', i + 4, i + 8); if (t === 'IDAT') chunks.push(buf.subarray(i + 8, i + 8 + len)); i += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(chunks)); const row = width * bpp; const out = Buffer.alloc(row * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (row + 1)]; const src = raw.subarray(y * (row + 1) + 1, (y + 1) * (row + 1));
    for (let x = 0; x < row; x++) {
      const a = x >= bpp ? out[y * row + x - bpp] : 0; const b = y ? out[(y - 1) * row + x] : 0; const c = x >= bpp && y ? out[(y - 1) * row + x - bpp] : 0;
      const p = a + b - c; const pr = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
      out[y * row + x] = (src[x] + [0, a, b, (a + b) >> 1, pr][f]) & 255;
    }
  }
  return { width, height, px: (x, y) => { const i = Math.floor(y) * row + Math.floor(x) * bpp; return [out[i], out[i + 1], out[i + 2]]; } };
}
const hexRgb = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const near3 = (p, q, d = 60) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) <= d;
// The middle of the focus band along a ray from (cx, cy) at angle a (degrees), from `from` to `to` CSS px: the mean
// distance of the pixels of the focus colour, or null when there are none.
function bandAt(img, zoom, focus, cx, cy, a, from, to) {
  const hits = [];
  for (let d = from; d <= to; d += 0.25) { const x = (cx + d * Math.cos(a * Math.PI / 180)) * zoom; const y = (cy + d * Math.sin(a * Math.PI / 180)) * zoom; if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue; if (near3(img.px(x, y), focus)) hits.push(d); }
  return hits.length ? hits.reduce((x, y) => x + y, 0) / hits.length : null;
}
// The e1 fixture with a dark theme of its own (a copy in tmp).
function darkFixture() {
  const dir = path.join(tmp, 'e1-dark');
  fs.cpSync(fixture('e1-fixture'), dir, { recursive: true });
  const e = JSON.parse(fs.readFileSync(path.join(dir, 'experience.json'), 'utf8'));
  e.themes = { night: { colorRoles: { surface: '#111827', ink: '#f9fafb', accent: '#60a5fa', 'accent-2': '#5eead4', muted: '#9ca3af', success: '#34d399', warning: '#fbbf24', danger: '#f87171' } } };
  e.theme = 'night';
  fs.writeFileSync(path.join(dir, 'experience.json'), JSON.stringify(e, null, 2));
  return dir;
}
async function ringPart() {
  const dark = darkFixture();
  for (const [scheme, dir] of [['light', fixture('e1-fixture')], ['dark', dark]]) {
    for (const zoom of [1, 2]) {
      for (const forced of ['none', 'active']) {
        if (forced === 'active' && scheme === 'dark') continue;
        const tag = `ring ${scheme} ${zoom * 100}%${forced === 'active' ? ' forced colours' : ''}`;
        const o = await open(dir, { viewport: { width: 640, height: 560 }, zoom, forced });
        const focus = hexRgb(await o.page.evaluate(() => { const r = window.hsvg.drawing.theme?.colorRoles || {}; return r['accent-2'] || r.accent || '#1a5fb4'; }));
        await o.page.keyboard.press('Tab'); await o.wait(100); // keyboard first, so focus() shows focus-visible
        for (const [what, sel, shape] of [['round thumb', '[role=slider][aria-label=Volume]', 'round'], ['pill cap', '[role=slider][aria-label=Spice]', 'pill'], ['segment in a clipped pill', '[role=radio][aria-label=Small]', 'end'], ['pill press', '[role=button][aria-label=Go]', 'pill'], ['round option', '[role=radio][aria-label=Calm]', 'round']]) {
          await o.page.evaluate((s) => document.querySelector(s).focus(), sel); await o.wait(250);
          const b = await o.page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, sel);
          const png = await o.page.screenshot({ clip: { x: Math.max(0, b.x - 16), y: Math.max(0, b.y - 16), width: b.w + 32, height: b.h + 32 } });
          if (shotsDir) fs.writeFileSync(path.join(shotsDir, `ring-${scheme}-${zoom * 100}${forced === 'active' ? '-forced' : ''}-${what.replace(/ /g, '-')}.png`), png);
          if (forced === 'active') {
            // The plain outline, on the part, or on its copy outside the clip (a clipped part's own would be cut).
            const st = await o.page.evaluate((s) => { const e = document.querySelector(s); const copy = document.querySelector('[data-hsvg-ring-copy]'); const c = getComputedStyle(copy || e); return [c.outlineStyle, getComputedStyle(e).filter, copy ? 'copy' : 'part']; }, sel);
            want(st[0] === 'solid' && st[1] === 'none' && st[2] === (shape === 'end' ? 'copy' : 'part'), `${tag} ${what}: forced colours show the plain outline (${st})`);
            continue;
          }
          const img = readPng(png);
          const ox = Math.max(0, b.x - 16); const oy = Math.max(0, b.y - 16);
          const cx = b.x + b.w / 2 - ox; const cy = b.y + b.h / 2 - oy;
          if (shape === 'round') {
            const r = b.w / 2;
            const at = [0, 45, 90, 135, 180, 225, 270, 315].map(a => bandAt(img, zoom, focus, cx, cy, a, r, r + 12));
            const got = at.filter(x => x !== null).map(x => x - r);
            const spread = got.length ? Math.max(...got) - Math.min(...got) : Infinity;
            want(got.length === 8 && spread <= 1, `${tag} ${what}: the band is a circle (its middle ${got.map(x => x.toFixed(1)).join(', ')} px out, spread ${spread.toFixed(2)})`);
          } else if (shape === 'pill') {
            const r = b.h / 2; const ex = cx + b.w / 2 - r; // the centre of the right end's half circle
            const at = [-90, -45, 0, 45, 90].map(a => bandAt(img, zoom, focus, ex, cy, a, r, r + 12));
            const got = at.filter(x => x !== null).map(x => x - r);
            const spread = got.length ? Math.max(...got) - Math.min(...got) : Infinity;
            want(got.length === 5 && spread <= 1, `${tag} ${what}: the band follows the round end (${got.map(x => x.toFixed(1)).join(', ')} px out, spread ${spread.toFixed(2)})`);
          } else {
            // The first segment is clipped by the pill: its left end is the pill's round end. The band shows outside it.
            const left = bandAt(img, zoom, focus, b.x - ox + 30, cy, 180, 30, 30 + 12);
            const top = bandAt(img, zoom, focus, cx, b.y - oy + b.h / 2, -90, b.h / 2, b.h / 2 + 12);
            want(left !== null && top !== null, `${tag} ${what}: the band shows beyond the clipping pill, left and top (${left?.toFixed(1)}, ${top?.toFixed(1)})`);
          }
        }
        await noErrors(tag, o);
        await o.ctx.close();
      }
    }
  }
}

// ---------- item 6: the drag control ----------
async function dragPart() {
  const o = await open(fixture('e1-fixture'));
  const card = await o.page.evaluate(() => window.hsvg.drawing.frames.s.byLocal.get('card').dom.id);
  const st = () => o.page.evaluate((id) => { const e = document.getElementById(id); const look = (n) => [...e.querySelectorAll('[data-hsvg-variant]')].find(x => x.getAttribute('data-hsvg-variant') === n); const b = e.getBoundingClientRect();
    return { pressed: e.getAttribute('aria-pressed'), look: look('pressed')?.getAttribute('display') !== 'none' ? 'pressed' : 'idle', picked: window.hsvg.player.read('s', 'picked'), x: b.x + b.width / 2, y: b.y + b.height / 2, said: window.hsvg.announced || '', drops: window.hsvg.player.read('s', 'drops') }; }, card);
  const centreOf = (local) => o.page.evaluate((l) => { const b = window.hsvg.drawing.frames.s.byLocal.get(l).dom.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, local);
  const at = (p, q) => Math.hypot(p.x - q.x, p.y - q.y) < 2;
  // Keys: Enter picks up (aria-pressed, the pressed look and picked at once); arrows stop only on shown drops, each
  // named in the live region; Escape lets go (aria-pressed false and the idle look at once).
  await o.page.evaluate((id) => document.getElementById(id).focus(), card);
  await o.page.keyboard.press('Enter'); await o.wait(50);
  let s1 = await st();
  want(s1.pressed === 'true' && s1.look === 'pressed' && s1.picked === true, `Enter picks the card up: aria-pressed ${s1.pressed}, look ${s1.look}, picked ${s1.picked}`);
  const A = await centreOf('bin-a'); const B = await centreOf('bin-b');
  const stops = [];
  for (let i = 0; i < 4; i++) { await o.page.keyboard.press('ArrowRight'); await o.wait(50); const x = await st(); stops.push([at(x, A) ? 'Red box' : at(x, B) ? 'Blue box' : `(${Math.round(x.x)}, ${Math.round(x.y)})`, x.said]); }
  want(stops.map(x => x[0]).join() === 'Red box,Blue box,Red box,Blue box', `arrows stop on the shown drops only, never on the hidden one or at (0, 0): ${stops.map(x => x[0]).join(', ')}`);
  want(stops.every(([where, said]) => said.replace(' ', '') === where), `the live region names each drop: ${stops.map(x => x[1]).join(', ')}`);
  const region = await o.page.evaluate(() => { const r = document.querySelector('[data-hsvg-announce]'); return r ? [r.getAttribute('aria-live'), r.textContent] : null; });
  want(region && region[0] === 'polite', `the live region is polite (${region})`);
  await o.page.keyboard.press('Escape'); await o.wait(50);
  s1 = await st();
  want(s1.pressed === 'false' && s1.look === 'idle' && s1.picked === false, `Escape lets go at once: aria-pressed ${s1.pressed}, look ${s1.look}, picked ${s1.picked}`);
  // Shown again, the hidden drop is a stop.
  await o.page.evaluate(() => window.hsvg.player.transaction('host', () => { window.hsvg.player.state.blocks.s.values.showC = true; }));
  await o.page.evaluate(() => window.hsvg.after?.()); await o.wait(200);
  await o.page.evaluate((id) => document.getElementById(id).focus(), card);
  await o.page.keyboard.press('Enter'); await o.page.keyboard.press('ArrowRight'); await o.page.keyboard.press('ArrowRight'); await o.wait(50);
  const C = await centreOf('bin-c'); s1 = await st();
  want(at(s1, C) && s1.said.replace(' ', '') === 'Hidden box', `a drop shown again is a stop (${s1.said})`);
  await o.page.keyboard.press('Enter'); await o.wait(100);
  s1 = await st();
  want(s1.drops === 1 && s1.pressed === 'false', `Enter drops it there (${s1.drops} drop, aria-pressed ${s1.pressed})`);
  // A tap picks up: aria-pressed and the pressed look at once; a tap on a drop drops it.
  const home = await centreOf('card');
  await o.page.mouse.click(home.x, home.y); await o.wait(50);
  s1 = await st();
  want(s1.pressed === 'true' && s1.look === 'pressed' && s1.picked === true, `a tap picks the card up: aria-pressed ${s1.pressed}, look ${s1.look}, picked ${s1.picked}`);
  if (shotsDir) await o.page.screenshot({ path: path.join(shotsDir, 'drag-held-by-tap.png'), clip: { x: 20, y: 380, width: 600, height: 140 } });
  await o.page.mouse.click(B.x, B.y); await o.wait(100);
  s1 = await st();
  want(s1.drops === 2 && s1.pressed === 'false' && s1.look === 'idle', `a second tap drops it on the drop (${s1.drops} drops, aria-pressed ${s1.pressed}, look ${s1.look})`);
  // A tap on nothing after a tap pick-up: home, not pressed.
  await o.page.mouse.click(home.x, home.y); await o.page.mouse.click(10, 10); await o.wait(100);
  s1 = await st();
  want(s1.pressed === 'false' && s1.look === 'idle' && s1.drops === 2, `a tap on nothing lets it go home (${s1.pressed}, ${s1.look}, ${s1.drops})`);
  await noErrors('drag', o);
  await o.ctx.close();
  // A drag with no `picked` value (drag-sort): no paint follows a pick-up or a cancel, and aria-pressed still follows.
  const q = await open(recipe('drag-sort'));
  const apple = await q.page.evaluate(() => window.hsvg.drawing.frames.sort.byLocal.get('apple').dom.id);
  const pressedNow = () => q.page.evaluate((id) => document.getElementById(id).getAttribute('aria-pressed'), apple);
  await q.page.evaluate((id) => document.getElementById(id).focus(), apple);
  await q.page.keyboard.press('Enter'); await q.wait(50); const p1 = await pressedNow();
  await q.page.keyboard.press('Escape'); await q.wait(50); const p2 = await pressedNow();
  const c = await centre(q.page, apple);
  await q.page.mouse.click(c.x, c.y); await q.wait(50); const p3 = await pressedNow();
  await q.page.keyboard.press('Escape'); await q.wait(50); const p4 = await pressedNow();
  want([p1, p2, p3, p4].join() === 'true,false,true,false', `drag-sort: aria-pressed after Enter, Escape, a tap, Escape: ${[p1, p2, p3, p4]}`);
  await noErrors('drag-sort keys', q);
  await q.ctx.close();
}

try {
  if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
  for (const part of parts) {
    if (part === 'touch') { await touchDragSort(); await touchNoughts(); await touchCatalog(); } else if (part === 'names') await names(); else if (part === 'keys') await keys(); else if (part === 'ring') await ringPart(); else if (part === 'drag') await dragPart(); else if (!PARTS.includes(part)) want(false, `no part ${part}`);
  }
} finally {
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
if (problems.length) { console.log(`e1-controls-browser: ${problems.length} problem(s)`); process.exit(1); }
console.log('e1-controls-browser: all passed');
