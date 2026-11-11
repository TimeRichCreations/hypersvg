// Functions test.mjs runs inside the packed page (page.evaluate). Each is self-contained: it reads the page through
// its test hooks (window.hsvg, a page packed with --test) and the DOM, and returns plain data. Nothing here changes
// what the page shows, except patchActivate (which records control uses and keeps them from running) and its undo.

// What a person can see and use in the scene now: texts, controls, fitted texts, the scene's state.
// o: {layout, words: the wanted shown-words check (true)}.
export function measureScene() {
  const h = window.hsvg; const p = h.player;
  const stage = document.getElementById('stage');
  const r2 = (v) => Math.round(v * 2) / 2;
  const box = (el) => { const b = el.getBoundingClientRect(); return { x: r2(b.x), y: r2(b.y), w: r2(b.width), h: r2(b.height) }; };
  const hidden = new Map();
  const isShown = (el) => {
    if (!el?.isConnected) return false;
    for (let n = el; n && n !== stage.parentElement; n = n.parentElement) {
      if (hidden.has(n)) { if (hidden.get(n)) return false; continue; }
      const s = getComputedStyle(n);
      const off = s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse' || Number(s.opacity) === 0;
      hidden.set(n, off);
      if (off) return false;
    }
    const b = el.getBoundingClientRect();
    return b.width > 0 && b.height > 0;
  };
  const scaleOf = (el) => { const m = el.getScreenCTM?.(); return m ? Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) : 1; };
  // A page id without the player's mount prefix (hsvg1__, 2.12 rule 6): the names the drawing's author knows.
  const idOf = (el) => { for (let n = el; n && n !== stage; n = n.parentElement) if (n.id) return (n === el ? n.id : `${n.id} > ${el.tagName.toLowerCase()}`).replace(/^hsvg\d+__/, ''); return el.tagName.toLowerCase(); };
  // A switch's own state words (drawn in its track) are its state, not its label.
  const STATE_WORDS = new Set(['on', 'off', 'yes', 'no', 'an', 'aus', 'oui', 'non', 'sí', 'si']);
  const norm = (s) => String(s || '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  // Texts: each <text> with words (and each <tspan> with its own font size), its size in CSS px and its box.
  const texts = [];
  for (const el of stage.querySelectorAll('text, tspan')) {
    const words = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!words) continue;
    if (el.tagName.toLowerCase() === 'tspan' && getComputedStyle(el).fontSize === getComputedStyle(el.parentElement).fontSize) continue;
    if (!isShown(el)) continue;
    const px = parseFloat(getComputedStyle(el).fontSize) * scaleOf(el);
    texts.push({ id: idOf(el), text: words.slice(0, 80), px: Math.round(px * 100) / 100, box: box(el), el });
  }
  // Controls: the player's items joined with what the page says of them.
  const items = h.input.items();
  const controls = [];
  for (const it of items) {
    const el = it.id ? document.getElementById(it.id) : null;
    if (!el) continue;
    const shown = isShown(el);
    let enabled = false; try { enabled = p.controlEnabled(it.addr, it.cid, it.option); } catch { enabled = false; }
    const c = p.def(it.addr)?.controls?.[it.cid] || {};
    const role = el.getAttribute('role') || '';
    const name = (el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(i => document.getElementById(i)?.textContent || '').join(' ') || el.textContent || '').replace(/\s+/g, ' ').trim();
    // The words drawn in the control as shown now (looks that are hidden are left out).
    const seen = [];
    if (shown) for (const t of el.querySelectorAll('text')) { const w = (t.textContent || '').replace(/\s+/g, ' ').trim(); if (w && /\p{L}/u.test(w) && norm(w).length > 1 && isShown(t)) seen.push(w); }
    const inert = !!el.closest('[inert]');
    const img = el.parentElement?.closest('[role=img], [role=image]');
    const group = role === 'radio' ? (el.closest('[role=radiogroup]') || (it.id && document.querySelector(`[role=radiogroup][aria-owns~="${CSS.escape(it.id)}"]`))) : null;
    controls.push({
      addr: it.addr, cid: it.cid, option: it.option, id: it.id, kind: c.kind || '', role, name, shown, enabled, inert,
      tabindex: el.getAttribute('tabindex'), disabled: it.disabled,
      value: el.getAttribute('aria-valuenow'), valueText: el.getAttribute('aria-valuetext'), checked: el.getAttribute('aria-checked'), pressed: el.getAttribute('aria-pressed'),
      box: shown ? box(el) : null, seen, nameHides: role !== 'slider' && seen.filter(w => !` ${norm(name)} `.includes(` ${norm(w)} `) && !((role === 'checkbox' || role === 'switch') && STATE_WORDS.has(norm(w)))),
      inImg: img ? (img.id || img.tagName.toLowerCase()) : null, radioGroup: role === 'radio' ? !!group : null,
    });
  }
  // Fitted texts (7.6): each binding with a fit region, and the current layout's fit map, against the region drawn.
  const fits = [];
  for (const [addr, f] of Object.entries(h.drawing?.frames || {})) {
    const def = p.def(addr); if (!def) continue;
    const layoutFit = (def.layouts || []).find(l => l.id === f.layout)?.fit || {};
    for (const b of def.bindings || []) {
      const fit = (b.id && layoutFit[b.id]) || b.fit;
      if (!fit?.box || !b.target) continue;
      const t = f.byLocal.get(b.target)?.dom; const rg = f.byLocal.get(fit.box)?.dom;
      if (!t || !rg || !isShown(t) || !(t.textContent || '').trim()) continue;
      const a = t.getBoundingClientRect(); const z = rg.getBoundingClientRect();
      const r1 = (v) => Math.round(v * 10) / 10;
      fits.push({ addr, target: b.target, region: fit.box, x: r1(Math.max(z.left - a.left, a.right - z.right)), y: r1(Math.max(z.top - a.top, a.bottom - z.bottom)), px: parseFloat(getComputedStyle(t).fontSize) * scaleOf(t), id: t.id });
    }
  }
  // Texts that overlap each other (another font can push a label onto its value). Same words (a shadow) do not count.
  const overlaps = [];
  for (let i = 0; i < texts.length && overlaps.length < 20; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i]; const b = texts[j];
      if (a.text === b.text || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.box.x + a.box.w, b.box.x + b.box.w) - Math.max(a.box.x, b.box.x);
      const hh = Math.min(a.box.y + a.box.h, b.box.y + b.box.h) - Math.max(a.box.y, b.box.y);
      if (w > 2 && hh > 0.35 * Math.min(a.box.h, b.box.h)) overlaps.push({ a: a.id, b: b.id, w: Math.round(w * 10) / 10, aText: a.text.slice(0, 30), bText: b.text.slice(0, 30) });
    }
  }
  const values = {};
  for (const [addr, b] of Object.entries(p.state.blocks).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))) values[addr] = JSON.parse(JSON.stringify({ values: b.values || {}, inputs: b.inputs || {} }, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? String(v) : v)));
  const sb = stage.getBoundingClientRect();
  return {
    scene: p.scene, layout: h.drawing?.frames?.[p.scene]?.layout ?? null, stage: { w: r2(sb.width), h: r2(sb.height) },
    texts: texts.map(({ el, ...t }) => t), controls, fits, overlaps, values,
    errors: [...(h.errors || []).map(e => `${e.code || ''} ${e.message || e}`), ...(h.stopped ? [`${h.stopped.code || 'fault'}: ${h.stopped.message}`] : [])],
    dialogs: (p.openDialogs?.() || []).map(d => d.id),
    pageScroll: { w: document.documentElement.scrollWidth, vw: innerWidth },
  };
}

// The fingerprint of the scene now (test.mjs --baseline): values, drawn texts, boxes of elements with ids (0.5 px)
// and the accessibility names and values of the controls.
export function fingerprint() {
  const h = window.hsvg; const p = h.player;
  const stage = document.getElementById('stage');
  const r2 = (v) => Math.round(v * 2) / 2;
  const boxes = {}; const texts = {};
  for (const el of stage.querySelectorAll('[id]')) {
    if (el.closest('[data-hsvg-ring-copy]')) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none') continue;
    const b = el.getBoundingClientRect();
    if (!(b.width > 0 || b.height > 0)) continue;
    boxes[el.id.replace(/^hsvg\d+__/, '')] = [r2(b.x), r2(b.y), r2(b.width), r2(b.height)];
  }
  // Every drawn text, with or without an id: keyed by its id, else its nearest id'd parent and its place there.
  const count = new Map();
  for (const el of stage.querySelectorAll('text')) {
    if (el.closest('[data-hsvg-ring-copy]') || getComputedStyle(el).display === 'none') continue;
    // keyed without the player's mount prefix (hsvg1__), as boxes() is
    let key = el.id.replace(/^hsvg\d+__/, '');
    if (!key) { const up = el.parentElement?.closest('[id]'); const base = up?.id.replace(/^hsvg\d+__/, '') || 'stage'; const n = (count.get(base) || 0) + 1; count.set(base, n); key = `${base} text ${n}`; }
    texts[key] = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!el.id) { const b = el.getBoundingClientRect(); boxes[key] = [r2(b.x), r2(b.y), r2(b.width), r2(b.height)]; }
  }
  const values = {};
  for (const [addr, b] of Object.entries(p.state.blocks).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))) values[addr] = JSON.parse(JSON.stringify({ values: b.values || {}, inputs: b.inputs || {} }, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? String(v) : v)));
  const names = h.input.items().map(i => { const el = document.getElementById(i.id); return [i.id.replace(/^hsvg\d+__/, ''), i.role, i.label, el?.getAttribute('aria-valuetext') ?? null, el?.getAttribute('aria-checked') ?? null, i.disabled]; });
  return { scene: p.scene, values, texts, boxes, names };
}

// Replays actions from the Node walk with the test hooks: a control use (hsvg.press), a choice, a wait. The clock is
// manual: each action is followed by its settle time in steps of 100 ms, as the page's own clock moves.
export async function replayActions([actions, settleMs]) {
  const h = window.hsvg; const p = h.player;
  const tick = (ms) => { for (let left = ms; left > 0; left -= 100) h.advance(Math.min(100, left)); };
  const out = [];
  for (const a of actions) {
    try {
      if (a.t === 'use') h.press(a.addr, a.cid, a.arg === null ? undefined : a.arg);
      else if (a.t === 'pick') { p.pick(a.link); h.advance(0); }
      else if (a.t === 'close') { p.transaction('person', () => p.dialog(a.dialog, false)); p.afterCommit?.(); h.advance(0); }
      tick(a.t === 'wait' ? a.ms : settleMs);
      // A page part may write back as a step of its own (a snapshot's status): let it run, then paint.
      await new Promise(r => setTimeout(r, 0)); await new Promise(r => requestAnimationFrame(() => r()));
      if (!h.stopped) h.advance(0);
    } catch (e) { out.push(`${a.what}: ${e.message}`); }
    if (h.stopped) { out.push(`${a.what}: ${h.stopped.code || 'fault'} ${h.stopped.message}`); break; }
  }
  return { scene: p.scene, errors: out };
}

// Records every control use from now on and keeps it from running (so a key test changes nothing).
export function patchActivate() {
  const p = window.hsvg.player;
  window.__t1uses = [];
  p.activate = (addr, cid, arg) => { window.__t1uses.push({ addr, cid, arg: arg === undefined ? null : arg }); return { ok: true }; };
  return true;
}
export function unpatchActivate() { delete window.hsvg.player.activate; return true; }
export function takeUses() { const u = window.__t1uses || []; window.__t1uses = []; return u; }

// The element that has focus now: its id, whether it is a player control, and whether its focus mark shows.
export function focusNow() {
  const el = document.activeElement;
  const stage = document.getElementById('stage');
  if (!el || el === document.body || !stage.contains(el)) return { id: null, inStage: false };
  const it = window.hsvg.input.items().find(i => i.id === el.id);
  const s = getComputedStyle(el);
  const ringed = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.filter && s.filter !== 'none') || !!stage.querySelector('[data-hsvg-ring-copy] *')
    || [...el.querySelectorAll('[data-hsvg-variant=focus]')].some(g => getComputedStyle(g).display !== 'none');
  return { id: el.id || null, inStage: true, item: it ? `${it.addr}#${it.cid}${it.option !== undefined ? `.${it.option}` : ''}` : null, ringed, inDialog: !!el.closest('[role=dialog]') };
}

// The dialog shown now: role, aria-modal, name, and the usable controls outside it that are not inert.
export function dialogNow() {
  const stage = document.getElementById('stage');
  const d = [...stage.querySelectorAll('[role=dialog]')].filter(x => getComputedStyle(x).display !== 'none').at(-1) || null;
  const outside = window.hsvg.input.items().filter(i => { const el = document.getElementById(i.id); if (!el || (d && d.contains(el))) return false; if (el.closest('[inert]') || el.closest('[aria-hidden=true]')) return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== 'hidden'; }).map(i => i.id);
  return { found: !!d, id: d?.id || null, modal: d?.getAttribute('aria-modal') === 'true', name: d?.getAttribute('aria-label') || '', outside };
}

// What moves: a digest of each element's drawn attributes, to compare after a wait.
export function drawnState() {
  const stage = document.getElementById('stage');
  const keys = ['transform', 'x', 'y', 'cx', 'cy', 'r', 'd', 'points', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'opacity', 'display', 'style', 'fill', 'stroke', 'stroke-dashoffset', 'offset'];
  const out = {};
  let n = 0;
  for (const el of stage.querySelectorAll('*')) {
    n++;
    if (el.closest('[data-hsvg-ring-copy]')) continue;
    const parts = [];
    for (const k of keys) { const v = el.getAttribute(k); if (v !== null) parts.push(`${k}=${v}`); }
    if (el.children.length === 0 && el.textContent) parts.push(`#${el.textContent}`);
    out[el.id || `${el.tagName}:${n}`] = parts.join(';');
  }
  return out;
}
export function clocksRunning() {
  const p = window.hsvg.player;
  try { const s = p.clockStates?.(); if (!s) return 0; let k = 0; for (const v of s.values()) if (v?.rate !== 0) k++; return k; } catch { return 0; }
}

// The actions to try in the scene now, as node-play.mjs actionsNow lists them (for a packed page given alone).
export function pageActions(waitMs) {
  const p = window.hsvg.player;
  const out = [];
  // While a shell dialog is open only what is inside the top one is usable (10.3), and Escape closes it.
  const open = p.openDialogs?.() || [];
  const inside = open.length ? (p.exp.shell?.doc?.uses || []).filter(u => u?.into === open.at(-1).id).map(u => `${p.shellId}/${u.id}`) : null;
  if (open.length) out.push({ t: 'close', dialog: open.at(-1).id, what: `Escape (close ${open.at(-1).id})` });
  // What is drawn in a closed dialog slot is inert on the page: not usable.
  const shut = (p.exp.shell?.doc?.uses || []).filter(u => { const sl = p.exp.shell.doc.slots?.[u?.into]; return sl?.kind === 'dialog' && !open.some(d => d.id === u.into); }).map(u => `${p.shellId}/${u.id}`);
  for (const addr of Object.keys(p.state.blocks)) {
    if (addr === 'experience') continue;
    if (inside && !inside.some(a => addr === a || addr.startsWith(`${a}/`))) continue;
    if (shut.some(a => addr === a || addr.startsWith(`${a}/`))) continue;
    for (const [cid, c] of Object.entries(p.def(addr)?.controls || {})) {
      if (!c || typeof c !== 'object') continue;
      const use = (arg, what) => out.push({ t: 'use', addr, cid, arg: arg === undefined ? null : arg, what: `${addr}#${cid}${what ? ` ${what}` : ''}`, kind: c.kind });
      if (c.kind === 'choice') { for (const o of Object.keys(c.options || {})) if (p.controlEnabled(addr, cid, o)) use(o, `option ${o}`); continue; }
      if (!p.controlEnabled(addr, cid)) continue;
      if (c.kind === 'button' || c.kind === 'toggle') use(undefined, 'press'); // the step names stay as the baseline wrote them
      else if (c.kind === 'slider' || c.kind === 'dial') {
        const lo = p.sliderValueAt(addr, cid, 0); const hi = p.sliderValueAt(addr, cid, 1);
        if (lo === null) { use(undefined, 'slider'); continue; }
        const now = Number(p.controlValue(addr, cid)); const step = p.sliderStep(addr, cid);
        const one = Number.isFinite(now) ? Math.min(hi, Math.max(lo, +(now + step).toFixed(10))) : lo;
        use(lo, `Home ${lo}`); use(hi, `End ${hi}`); use(one >= hi ? Math.max(lo, +(hi - step).toFixed(10)) : one, 'one step');
      } else if (c.kind === 'drag') { for (const d of c.drops || []) use(d, `drop ${d}`); use('', 'no drop'); }
      else use(undefined, c.kind);
    }
  }
  if (inside) return out;
  for (const ch of p.choices?.() || []) out.push({ t: 'pick', link: ch.id, what: `choice ${ch.id}` });
  for (const ms of [waitMs, 15000, 60000]) out.push({ t: 'wait', ms, what: `wait ${ms} ms` });
  return out;
}
// One slider's expected values for the keys (5.11): {min, max, now, step, page}.
export function sliderFacts(addr, cid) {
  const p = window.hsvg.player;
  return { min: p.sliderValueAt(addr, cid, 0), max: p.sliderValueAt(addr, cid, 1), now: Number(p.controlValue(addr, cid)), step: p.sliderStep(addr, cid), page: p.sliderPage(addr, cid), positions: p.controlPositions(addr, cid) ?? null };
}

// Watches the page's Web Audio (a context init script, before the page runs): every source node made (an oscillator
// or a buffer source: made sounds, sound files) and whether its start() came, and any stop() before its start().
export function watchSound() {
  const C = window.AudioContext || window.webkitAudioContext;
  const S = window.AudioScheduledSourceNode;
  if (!C || !S || window.__hsvgSound) return;
  const seen = window.__hsvgSound = { made: 0, started: 0, stopBeforeStart: 0, pending: new Set() };
  // A buffer source has its own start (with an offset); an oscillator uses its parent's.
  for (const proto of [S.prototype, window.AudioBufferSourceNode?.prototype]) {
    if (!proto || !Object.hasOwn(proto, 'start')) continue;
    const start = proto.start; const stop = proto.stop;
    proto.start = function (...a) { if (seen.pending.delete(this)) seen.started++; this.__hsvgStarted = true; return start.apply(this, a); };
    if (Object.hasOwn(proto, 'stop')) proto.stop = function (...a) { if (!this.__hsvgStarted) seen.stopBeforeStart++; return stop.apply(this, a); };
  }
  for (const m of ['createOscillator', 'createBufferSource']) {
    const make = C.prototype[m];
    C.prototype[m] = function (...a) { const n = make.apply(this, a); seen.made++; seen.pending.add(n); return n; };
  }
}
// The sounds since the last call: {made, started, stopBeforeStart, silent: nodes that never started}. Resets.
export function soundNow() {
  const s = window.__hsvgSound;
  if (!s) return { made: 0, started: 0, stopBeforeStart: 0, silent: 0 };
  const out = { made: s.made, started: s.started, stopBeforeStart: s.stopBeforeStart, silent: s.pending.size + s.stopBeforeStart };
  s.made = 0; s.started = 0; s.stopBeforeStart = 0; s.pending.clear();
  return out;
}

// Texts that leave their drawing (T-TEXT-CLIPPED), measured once the scene has settled (test.mjs advances the clock
// first, so a headline that slides in is measured where it stops). A text's painted box past the view box of the
// nearest <svg> around it that has one, in page pixels: past it, the words are cut off at another size or in another
// host. Returns [{id, text, over}].
export function clippedTexts() {
  const stage = document.getElementById('stage');
  const idOf = (el) => { for (let n = el; n && n !== stage; n = n.parentElement) if (n.id) return (n === el ? n.id : `${n.id} > ${el.tagName.toLowerCase()}`).replace(/^hsvg\d+__/, ''); return el.tagName.toLowerCase(); };
  const shown = (el) => { for (let n = el; n && n !== stage.parentElement; n = n.parentElement) { const st = getComputedStyle(n); if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false; } const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const scaleOf = (el) => { const m = el.getScreenCTM?.(); return m ? Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) : 1; };
  const clipped = [];
  for (const el of stage.querySelectorAll('text')) {
    const words = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!words || el.closest('[data-hsvg-ring-copy]') || !shown(el)) continue;
    const t = { el, id: idOf(el), text: words, px: parseFloat(getComputedStyle(el).fontSize) * scaleOf(el) };
    let svg = t.el.ownerSVGElement;
    while (svg && !svg.getAttribute('viewBox')) svg = svg.ownerSVGElement;
    const m = svg?.getScreenCTM?.(); const vb = svg?.viewBox?.baseVal;
    if (!m || !vb || !(vb.width > 0) || !(vb.height > 0)) continue;
    const xs = [vb.x, vb.x + vb.width].flatMap(x => [vb.y, vb.y + vb.height].map(y => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]));
    const left = Math.min(...xs.map(q => q[0])); const right = Math.max(...xs.map(q => q[0]));
    const top = Math.min(...xs.map(q => q[1])); const bottom = Math.max(...xs.map(q => q[1]));
    // A text the author clips on purpose (a rolling digit strip under a clip-path or a mask) shows only its clip.
    let clippedOnPurpose = false;
    for (let n = t.el; n && n !== svg; n = n.parentElement) { const cs = getComputedStyle(n); if ((cs.clipPath && cs.clipPath !== 'none') || (cs.mask && cs.mask !== 'none') || n.hasAttribute('clip-path') || n.hasAttribute('mask')) { clippedOnPurpose = true; break; } }
    if (clippedOnPurpose) continue;
    // A glyph box is taller than its ink: up and down a text may pass by a quarter of its size (as T-FIT-OVERFLOW).
    const a = t.el.getBoundingClientRect();
    const across = Math.max(left - a.left, a.right - right); const upDown = Math.max(top - a.top, a.bottom - bottom);
    const over = Math.max(across - 1.5, upDown - Math.max(1.5, 0.25 * t.px));
    if (over > 0) clipped.push({ id: t.id, text: t.text.slice(0, 40), over: Math.round(Math.max(across, upDown) * 10) / 10 });
  }
  return clipped;
}
