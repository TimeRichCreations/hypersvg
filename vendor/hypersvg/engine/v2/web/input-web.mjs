// Controls in a browser (5.11, 5.12, 10.3): pointer and keyboard share one path into the engine.
// - Semantics: each control target gets its role, tab stop, accessible name and ARIA state, written by the engine
//   (authors write none): press -> button; option -> radio (one tab stop per control, roving) inside a radiogroup named by the control's label; slider -> slider;
//   drag -> a grabbable button; disabled -> aria-disabled with the disabledLabel; hidden or disabled -> no tab stop.
// - Press: pointer, Enter, Space and its keys; `held` is true while held. Option: arrows move and wrap, Home and End
//   jump, Enter and Space select, its keys select. Slider: pointer along its path (the band its handle sweeps; a
//   press there moves the handle under the pointer, a press on the handle grabs it where it is; the handle follows
//   while held and settles on its value's place), arrows, Page Up and Page Down (a tenth), Home, End. Drag: pointer, or
//   Enter/Space to pick up and drop, arrows between the drops, Escape cancels (no event); `picked` while held. One
//   pointer without dragging (WCAG 2.5.7, 10.13): a tap (down and up within TAP_PX) picks the item up and holds it as
//   Enter does; the next tap drops it on the drop place under it, or on none, with the same accept, events and
//   checks as a drag. That tap does nothing else: it presses no control under it.
// - Keys of the fixed set reach the blocks as key:<code> and keyUp:<code>, never repeated.
// - Focus order is document order (the browser's Tab over tab stops in the drawing). Focus stays on a control that
//   becomes disabled; when its target is hidden or removed, focus moves to the next usable control, else the previous.
//   The player never takes focus the person has not given it.
// - Control looks: a target with looks named idle, hover, pressed, selected, focus, disabled shows them in that
//   priority (disabled, pressed, selected, focus, hover, idle); selected is an option that is the chosen one. Every kind is `pressed` while it is held: by the pointer, by Enter or
//   Space (press, option), by an arrow, Home or End (slider), or while it is picked up (drag).
// - Shell dialogs (10.1, 10.3): an open one is a named modal `dialog`; while one is open everything else of the shell is
//   `inert` and Tab cycles inside the top one; one a person opens takes focus; Escape closes the top one; closing
//   returns focus to the control that opened it.
// Keys reach a player when focus is inside it, or when nothing has focus (the page body) and it is the player the
// person last pointed at (the first one mounted, until then). Clicking a picture leaves focus on the body.
const keyOwner = new WeakMap(); // document -> container
const TAP_PX = 10; // a pointer that moves at most this far (CSS pixels) between down and up taps (10.13)
const mountedIn = new WeakMap(); // document -> the live players' containers, in mount order
const SVGNS = 'http://www.w3.org/2000/svg';
let ringCount = 0; // each player's ring filter has its own id
// A button or a toggle: pressed, with a default event press:<target> (5.11).
const isPress = (k) => k === 'button' || k === 'toggle';
// The gestures an add-on control kind takes (D39: press, up, down), or null for a core kind.
const gestures = (it) => (it?.c.kind.includes('.') ? it.player.controlAccess(it.addr, it.cid)?.gestures ?? [] : null);

// An option group is one tab stop (5.11): focus that moves to a group lands on its stop (the checked option, else the
// first), never on whichever option stands next in document order (F1a item 5: after Next, the quiz's answer A).
function groupStop(it, order) {
  if (it?.c?.kind !== 'choice') return it;
  const peers = order.filter(x => x.addr === it.addr && x.cid === it.cid);
  return peers.find(x => x.el.getAttribute('tabindex') === '0') || peers[0] || it;
}

export function attachInput(player, state, container, win) {
  const doc = win.document;
  // Every listener goes on one cleanup list, so destroy() leaves nothing behind (10.6).
  const cleanups = [];
  const listen = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); cleanups.push(() => target.removeEventListener(type, fn, opts)); };
  if (!mountedIn.has(doc)) mountedIn.set(doc, []);
  mountedIn.get(doc).push(container);
  if (!keyOwner.has(doc)) keyOwner.set(doc, container);
  listen(container, 'pointerdown', () => keyOwner.set(doc, container), true);
  // The player that hears keys on the page body: the one last pointed at while it lives, else the first live one.
  const owner = () => { const live = mountedIn.get(doc) || []; const o = keyOwner.get(doc); return live.includes(o) ? o : live[0]; };
  const forMe = (ev) => {
    if (state.destroyed || !container.isConnected) return false;
    if (container.contains(ev.target)) return true;
    const a = doc.activeElement;
    return (!a || a === doc.body || a === doc.documentElement) && owner() === container;
  };
  const KEY = /^(Key[A-Z]|Digit[0-9]|Space|Enter|Arrow(Left|Right|Up|Down)|Shift(Left|Right))$/;
  const LOOKS = ['disabled', 'pressed', 'selected', 'focus', 'hover', 'idle'];
  let items = [];            // [{addr, cid, c, option, node, el}] in document order
  const byEl = new Map();    // target element -> item
  let drag = null;           // {item, base, start, keyboard, dropIndex}
  let slide = null;          // {item, geo, grab, pointerId}: a slider the pointer holds
  const bands = new Map();   // band element -> its slider item: the path each slider's handle sweeps (5.11)
  const pressed = new Set(); // elements held down
  const heldKeys = new Map(); // key code -> the held press control its shortcut holds
  let hover = null;

  // The focus mark (WCAG 2.4.13): a ring that follows the part's own outline, drawn by an engine-owned SVG filter that
  // grows the part's alpha (focusRing below). A part inside a clip path (a segment in a pill) would have its ring cut
  // by the clip: its ring is drawn on a copy instead (an engine-made <g>, just after the outermost clipping ancestor,
  // that holds the same clips and a <use> of the part), so the ring follows the clipped shape and the clip does not cut
  // it. Where it cannot be drawn (forced colours, a part with its own filter, a part with no paint, no SVG geometry) the
  // plain outline stays. Both use the theme's focus colour.
  const ringId = `${state.namespace || ''}hsvg-focus-${++ringCount}`;
  const style = doc.createElement('style');
  cleanups.push(() => style.remove());
  doc.head.appendChild(style);
  let ringDefs = null; // the hidden <div data-hsvg-ring> whose <svg> holds this player's ring filter
  let ringOn = null;   // the element the ring is drawn on now
  let ringKey = '';
  let ringCopy = null; // the <g data-hsvg-ring-copy> of a clipped part
  let copyKey = '';
  cleanups.push(() => ringCopy?.remove());
  const ringColour = () => focusColour(state.drawing?.theme);
  // The ring shows as :focus-visible says (5.11): when focus came from the keyboard, not after a mouse or touch press,
  // also when the engine moves focus after a press (a new step's first control). The player keeps that rule itself:
  // its container holds data-player-keys while the person's last input was a key (any key but a lone modifier or a
  // shortcut with Ctrl, Alt or Meta), and loses it at a pointer press. Until either, it holds it.
  const fv = (sel) => `[data-player-keys] ${sel}:focus`;
  const styleFor = (c) => `[data-player-control]:focus{outline:none}${fv('[data-player-control]')}{outline:3px solid ${c};outline-offset:2px}[data-player-control]{cursor:pointer}[data-player-control][aria-disabled=true]{cursor:default}[data-player-control][role=slider],[data-player-control][aria-roledescription=draggable]{touch-action:none}`
    + `${fv(`[data-player-ring="${ringId}"]`)}{outline:none;filter:url(#${ringId})}`
    + `@media (forced-colors:active){${fv('[data-player-control]')},${fv(`[data-player-ring="${ringId}"]`)}{filter:none;outline:3px solid Highlight;outline-offset:2px}}`
    + `${fv(`[data-player-ring="${ringId}-copy"]`)}{outline:none}[data-hsvg-ring-copy=forced]{outline:3px solid Highlight;outline-offset:2px}`;
  style.textContent = styleFor(ringColour());
  const mat = (m) => `matrix(${[m.a, m.b, m.c, m.d, m.e, m.f].map(v => Math.round(v * 1e4) / 1e4).join(' ')})`;
  // The clip paths above a part, outermost first: [[element, its clip-path]].
  const clipsOf = (el) => { const out = []; for (let n = el.parentNode; n && n !== container && n.nodeType === 1; n = n.parentNode) { const cp = win.getComputedStyle(n).clipPath; if (cp && cp !== 'none') out.unshift([n, cp]); } return out; };
  function ring() {
    const el = doc.activeElement;
    const want = el && byEl.has(el) ? el : null;
    if (ringOn && ringOn !== want) { ringOn.removeAttribute('data-player-ring'); ringOn = null; }
    const c = ringColour();
    const css = styleFor(c);
    if (style.textContent !== css) style.textContent = css;
    const forced = !!win.matchMedia?.('(forced-colors: active)').matches;
    const clips = want && want.id && (forced || canRing(want, win)) ? clipsOf(want) : [];
    const shown = clips.length && keyed;
    if (!shown && ringCopy) { ringCopy.remove(); ringCopy = null; copyKey = ''; }
    if (!want || (!clips.length && (forced || !canRing(want, win)))) { if (want) want.removeAttribute('data-player-ring'); return; }
    // The element the filter is on: the part, or the copy of a clipped part. Under forced colours the copy shows the
    // plain outline instead, which the clip would cut on the part.
    let on = want;
    if (clips.length) {
      set(want, 'data-player-ring', `${ringId}-copy`); ringOn = want;
      if (!shown) return;
      const top = clips[0][0];
      ringCopy ??= build(['g', { 'data-hsvg-ring-copy': '', 'aria-hidden': 'true', 'pointer-events': 'none' }]);
      set(ringCopy, 'data-hsvg-ring-copy', forced ? 'forced' : '');
      set(ringCopy, 'filter', forced ? null : `url(#${ringId})`);
      if (ringCopy.parentNode !== top.parentNode || ringCopy.previousSibling !== top) top.parentNode.insertBefore(ringCopy, top.nextSibling);
      // Each clip in its element's own user space, then the part where its parent puts it.
      let prev = top.parentNode.getScreenCTM?.();
      if (!prev) return;
      const layers = [];
      for (const [n, cp] of clips) { const m = n.getScreenCTM(); layers.push(['g', { transform: mat(prev.inverse().multiply(m)), 'clip-path': cp }]); prev = m; }
      layers.push(['use', { href: `#${want.id}`, transform: mat(prev.inverse().multiply(want.parentNode.getScreenCTM())) }]);
      const k = JSON.stringify(layers);
      if (k !== copyKey) { copyKey = k; let tree = layers.at(-1); for (let i = layers.length - 2; i >= 0; i--) tree = [...layers[i], [tree]]; ringCopy.replaceChildren(build(tree)); }
      if (forced) return;
      on = ringCopy;
    }
    const m = on.getScreenCTM?.();
    let box = null; try { box = on.getBBox(); } catch { /* not drawn */ }
    const scale = m ? Math.hypot(m.a, m.b) : 0;
    if (!(scale > 0) || !box || !(box.width > 0 || box.height > 0)) { want.removeAttribute('data-player-ring'); return; }
    const plan = focusRing(c, scale);
    const key = `${on === want}|${plan.focus}|${plan.halo}|${plan.radii.join(',')}|${box.x},${box.y},${box.width},${box.height}`;
    if (!ringDefs) {
      // The filter's <svg> sits in a <div>, never as an <svg> child of the container: those are the drawings, which the
      // slide and fade, the page actor and hosts (`#stage > svg`) find by that.
      ringDefs = doc.createElement('div');
      ringDefs.setAttribute('data-hsvg-ring', '');
      ringDefs.setAttribute('aria-hidden', 'true');
      ringDefs.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
      ringDefs.appendChild(build(['svg', { width: '0', height: '0' }]));
      cleanups.push(() => ringDefs.remove());
    }
    if (!ringDefs.isConnected) container.appendChild(ringDefs); // after the drawing; again if a redraw cleared the container
    if (key !== ringKey) { ringKey = key; ringDefs.firstChild.replaceChildren(build(ringFilter(ringId, plan, box, on === want))); }
    set(want, 'data-player-ring', on === want ? ringId : `${ringId}-copy`);
    ringOn = want;
  }
  const build = ([name, attrs, kids = []]) => { const e = doc.createElementNS(SVGNS, name); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); for (const k of kids) e.appendChild(build(k)); return e; };
  listen(win, 'resize', () => { if (!state.destroyed) ring(); });

  const visible = (el) => {
    if (!el || !el.isConnected) return false;
    for (let n = el; n && n !== container; n = n.parentElement) {
      const s = win.getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return false;
    }
    const b = el.getBoundingClientRect();
    return b.width > 0 && b.height > 0;
  };
  // The open dialogs' drawn slots; while any is open, only controls inside the top one are usable.
  const dialogEls = () => player.openDialogs?.().map(d => state.drawing?.slots?.[d.id]?.dom).filter(Boolean) || [];
  const inDialog = (el) => { const ds = dialogEls(); return !ds.length || ds[ds.length - 1].contains(el); };
  const live = (it) => visible(it.el) && inDialog(it.el) && player.controlEnabled(it.addr, it.cid, it.option);
  // A dialog is a real dialog (10.3): each open dialog slot is a named modal `dialog`; everything else of the shell
  // (other slots, the stage, the widgets of other slots) is `inert`, so only the top dialog is in the tree and in Tab.
  // Browsers apply `inert` to HTML elements only, so an SVG element behind also gets aria-hidden (its controls already
  // have tabindex -1 and take no press). Only what the engine set here is undone when the dialogs close.
  const modalSet = new Map(); // element -> the attributes the engine set on it
  // The top dialog: its slot, and every widget over it or over a slot drawn inside it (a form in its own slot).
  const tops = () => {
    const t = (player.openDialogs?.() || []).at(-1); const el = t && state.drawing?.slots?.[t.id]?.dom;
    if (!t) return [];
    const inTop = (w) => { const into = w.getAttribute('data-player-into'); if (into === t.id) return true; const s = state.drawing?.slots?.[into]?.dom; return !!(el && s && el.contains(s)); };
    return [el, ...[...container.querySelectorAll('[data-player-into]')].filter(inTop)].filter(Boolean);
  };
  function modal() {
    const want = new Map();
    const put = (el, k, v) => { if (!want.has(el)) want.set(el, {}); want.get(el)[k] = v; if (k === 'inert' && el.namespaceURI === SVGNS) want.get(el)['aria-hidden'] = 'true'; };
    const ds = player.openDialogs?.() || [];
    const top = tops();
    for (const d of ds) {
      const el = state.drawing?.slots?.[d.id]?.dom;
      if (!el) continue;
      // A widget over the slot (a form) is the dialog then; else the slot's drawn element.
      const ws = [...container.querySelectorAll(`[data-player-into="${d.id}"]`)];
      for (const x of ws.length ? ws : [el]) { put(x, 'role', 'dialog'); put(x, 'aria-modal', 'true'); put(x, 'aria-label', tpl(player.shellId, d.label) || null); }
    }
    const root = state.drawing?.root?.dom;
    if (top.length && root) {
      // Each element beside the top dialog's path, up to the drawing's root, and each other widget, is inert.
      const keep = (el) => top.some(t => t === el || el.contains(t) || t.contains(el));
      for (const t of top) for (let n = t; n && n !== root && n.parentElement && root.contains(n); n = n.parentElement) for (const s of n.parentElement.children) if (!keep(s)) put(s, 'inert', '');
      if (!top.some(t => root.contains(t))) put(root, 'inert', '');
      for (const w of container.querySelectorAll('[data-player-widget]')) if (!keep(w)) put(w, 'inert', '');
    }
    for (const [el, had] of modalSet) for (const k of Object.keys(had)) if (!want.get(el) || !(k in want.get(el))) { if (had[k] === null) el.removeAttribute(k); else el.setAttribute(k, had[k]); delete had[k]; }
    for (const [el, ks] of want) {
      const had = modalSet.get(el) || {};
      for (const [k, v] of Object.entries(ks)) { if (!(k in had)) { if (k === 'inert' && el.hasAttribute('inert')) continue; had[k] = el.getAttribute(k); } set(el, k, v); }
      modalSet.set(el, had);
    }
    for (const [el, had] of modalSet) if (!Object.keys(had).length) modalSet.delete(el);
  }
  const tpl = (addr, t) => { try { return t ? String(player.template(addr, t)) : ''; } catch { return ''; } };
  const set = (el, k, v) => { if (v === null || v === undefined) el.removeAttribute(k); else if (el.getAttribute(k) !== String(v)) el.setAttribute(k, String(v)); };
  // How the person's focus came: by a key (the ring and the `focus` look show) or by a pointer press (they do not).
  let keyed = true;
  const modality = (k) => { if (k === keyed || state.destroyed) return; keyed = k; set(container, 'data-player-keys', k ? '' : null); if (state.drawing && !state.stopped) looks(); };
  set(container, 'data-player-keys', '');
  cleanups.push(() => container.removeAttribute('data-player-keys'));
  listen(doc, 'keydown', (ev) => { if (!ev.ctrlKey && !ev.altKey && !ev.metaKey && !/^(Shift|Control|Alt|Meta|AltGraph|CapsLock|Fn|OS)$/.test(ev.key)) modality(true); }, true);
  listen(doc, 'pointerdown', () => modality(false), true);

  // ---------- semantics, after each paint ----------
  function collect() {
    const list = [];
    for (const [addr, f] of Object.entries(state.drawing.frames)) {
      for (const [cid, c] of Object.entries(player.def(addr)?.controls || {})) {
        const targets = c.kind === 'choice' ? Object.entries(c.options || {}).map(([o, x]) => [x.target, o]) : [[c.target, undefined]];
        for (const [t, option] of targets) {
          const node = f.byLocal.get(t);
          if (node?.dom) list.push({ addr, cid, c, option, node, el: node.dom, player });
        }
      }
    }
    list.sort((a, b) => (a.el === b.el ? 0 : a.el.compareDocumentPosition(b.el) & 4 ? -1 : 1));
    return list;
  }
  let seen = -1;
  let stageFrame = null; // the stage scene's frame at the last sync; a new one means the stage was remounted
  const shellAddr = (addr) => !!player.shellId && (addr === player.shellId || addr.startsWith(player.shellId + '/'));
  function sync(force = false) {
    if (!state.drawing) return;
    modal();
    const rev = `${player.state.revision}|${player.scene}`;
    if (!force && rev === seen) { looks(); return; }
    seen = rev;
    // The focused control. A remount (a restart or a new scene) removes it, and the browser moves focus to the body
    // before we look: then the control the person last focused is the one that had focus.
    const a = doc.activeElement;
    const lost = (!a || a === doc.body || a === doc.documentElement) && lastFocus && (!lastFocus.isConnected || leaving(lastFocus));
    const had = a && byEl.has(a) ? byEl.get(a) : lost ? byEl.get(lastFocus) || null : null;
    const before = items;
    const shownStage = stageFrame;
    stageFrame = state.drawing.frames[player.scene] || null;
    items = collect();
    byEl.clear();
    for (const it of items) byEl.set(it.el, it);
    // A drag in progress ends when its item is removed (a restart or a new scene): cancelled, with no event (5.11).
    if (drag && (!drag.item.el.isConnected || !byEl.has(drag.item.el))) drag = null;
    const groups = new Map(); // option control -> its live options, for the roving tab stop
    for (const it of items) {
      const { el, c, addr } = it;
      const on = player.controlEnabled(addr, it.cid, it.option);
      const shown = visible(el) && inDialog(el);
      set(el, 'data-player-control', '');
      const optionLabel = it.option !== undefined ? tpl(addr, c.options[it.option].label) : '';
      // 10.13: the control's label, else its target's data-hsvg-label (the drawn words name it by themselves).
      const name = !on && c.disabledLabel ? tpl(addr, c.disabledLabel) : (optionLabel || tpl(addr, c.label) || it.node.attrs?.['data-hsvg-label']);
      set(el, 'aria-label', name || null);
      set(el, 'aria-disabled', on ? null : 'true');
      if (isPress(c.kind) || c.kind === 'snapshot') { set(el, 'role', c.kind === 'toggle' ? 'checkbox' : 'button'); set(el, 'tabindex', shown && on ? 0 : -1); }
      // A toggle is a checkbox: its value is aria-checked, and it shows its `selected` look while true.
      if (c.kind === 'toggle') { let v = false; try { v = player.read(addr, c.value) === true; } catch { v = false; } set(el, 'aria-checked', v ? 'true' : 'false'); }
      if (c.kind === 'drag') {
        set(el, 'role', 'button'); set(el, 'aria-roledescription', 'draggable');
        set(el, 'aria-pressed', drag?.item.el === el ? 'true' : 'false'); set(el, 'tabindex', shown && on ? 0 : -1);
      }
      if (c.kind === 'slider' || c.kind === 'dial') {
        const d = player.controlValueDecl(addr, it.cid);
        set(el, 'role', 'slider'); set(el, 'tabindex', shown && on ? 0 : -1);
        set(el, 'aria-valuemin', d?.minimum); set(el, 'aria-valuemax', d?.maximum); set(el, 'aria-valuenow', player.controlValue(addr, it.cid));
        set(el, 'aria-valuetext', c.valueText ? tpl(addr, c.valueText) : null);
        set(el, 'aria-orientation', c.kind === 'dial' ? null : c.axis === 'y' ? 'vertical' : 'horizontal');
      }
      // An add-on's control kind (D39): the role, value text and gestures its manifest and access hook give.
      const ax = gestures(it) && player.controlAccess(addr, it.cid);
      if (ax) {
        const num = ax.role === 'slider' || ax.role === 'spinbutton'; const on2 = ax.role === 'checkbox' || ax.role === 'switch';
        set(el, 'role', ax.role); set(el, 'tabindex', shown && on ? 0 : -1); set(el, 'aria-valuetext', ax.valueText);
        set(el, 'aria-valuenow', num ? ax.valueNow : null); set(el, 'aria-valuemin', num ? ax.valueMin : null); set(el, 'aria-valuemax', num ? ax.valueMax : null);
        set(el, 'aria-checked', on2 ? String(ax.valueNow === true) : null);
      }
      if (c.kind === 'choice') {
        set(el, 'role', 'radio');
        let checked = false;
        try { checked = JSON.stringify(player.optionValue(addr, c, c.options[it.option])) === JSON.stringify(player.controlValue(addr, it.cid)); } catch { checked = false; }
        set(el, 'aria-checked', checked ? 'true' : 'false');
        const key = `${addr}#${it.cid}`;
        if (!groups.has(key)) groups.set(key, []);
        if (shown && on) groups.get(key).push({ it, checked });
        set(el, 'tabindex', -1);
      }
    }
    bandsFor(items);
    radioGroups(items);
    roving(groups);
    // Focus moves only when its target is hidden or removed (5.11): to the next usable control in document order,
    // else the previous one, else the stage scene's first. A removed target is placed by the controls that stood
    // around it before, those still drawn.
    if (had && (!had.el.isConnected || leaving(had.el) || !visible(had.el))) {
      const order = items.filter(x => visible(x.el) && player.controlEnabled(x.addr, x.cid, x.option));
      const usable = new Set(order.map(x => x.el));
      let next = null;
      if (had.el.isConnected && !leaving(had.el)) {
        next = order.find(x => had.el.compareDocumentPosition(x.el) & 4) || [...order].reverse().find(x => had.el.compareDocumentPosition(x.el) & 2);
      } else if (stageFrame !== shownStage && !shellAddr(had.addr)) {
        // The stage was remounted (a restart or a new scene): the new scene's controls stand where the removed one
        // stood, so the next usable control is the stage scene's first.
        next = null;
      } else {
        const i = before.findIndex(x => x.el === had.el);
        const pick = (list) => list.find(x => usable.has(x.el));
        next = i < 0 ? null : (pick(before.slice(i + 1)) || pick(before.slice(0, i).reverse()));
        if (next) next = byEl.get(next.el);
      }
      const stage = player.scene;
      next ??= stageFocus(order, stage, stageFrame !== shownStage ? player.def(stage)?.firstFocus : undefined);
      next = groupStop(next, order);
      next?.el.focus({ preventScroll: true });
    }
    looks();
  }
  // Each option control is one radiogroup named by its label (5.11): the nearest element that holds all its options
  // and no other control target; else an engine-made <g> just before its first option that owns them (aria-owns).
  // aria-disabled while the control is not enabled. data-hsvg-group marks it, so the drawing leaves its role alone.
  const radios = new Map(); // control key -> {el, made}
  function radioGroups(list) {
    const want = new Map();
    for (const it of list) if (it.c.kind === 'choice') { const k = `${it.addr}#${it.cid}`; if (!want.has(k)) want.set(k, []); want.get(k).push(it); }
    for (const [k, opts] of want) {
      const els = opts.map(x => x.el);
      let g = els[0].parentNode;
      while (g && g !== container && !els.every(e => g.contains(e))) g = g.parentNode;
      if (!g || g === container || !container.contains(g) || list.some(x => !els.includes(x.el) && g.contains(x.el))) g = null;
      let r = radios.get(k);
      if (r && (g ? r.el !== g : !r.made || r.el.nextSibling !== els[0])) { unGroup(r); r = null; }
      if (!r) {
        r = g ? { el: g, made: false } : { el: build(['g', { 'data-hsvg-made': '' }]), made: true };
        if (r.made) { els[0].parentNode.insertBefore(r.el, els[0]); const el = r.el; cleanups.push(() => el.remove()); }
        radios.set(k, r);
      }
      const { addr, cid, c } = opts[0];
      set(r.el, 'data-hsvg-group', '');
      set(r.el, 'role', 'radiogroup');
      set(r.el, 'aria-label', tpl(addr, c.label) || null);
      set(r.el, 'aria-disabled', player.controlEnabled(addr, cid) ? null : 'true');
      set(r.el, 'aria-owns', r.made ? els.map(e => e.id).join(' ') : null);
    }
    for (const [k, r] of radios) if (!want.has(k)) { unGroup(r); radios.delete(k); }
  }
  function unGroup(r) {
    if (r.made) { r.el.remove(); return; }
    for (const a of ['data-hsvg-group', 'role', 'aria-label', 'aria-disabled', 'aria-owns']) r.el.removeAttribute(a);
  }
  // One tab stop per option control (5.11): while focus is inside the group, the focused option holds it (so Tab goes
  // on to the next control); else the checked option, else the first usable one. groups: control -> its live options
  // [{it, checked}]; without it they are read again from the targets.
  function roving(groups) {
    if (!groups) {
      groups = new Map();
      for (const it of items) {
        if (it.c.kind !== 'choice') continue;
        const key = `${it.addr}#${it.cid}`;
        if (!groups.has(key)) groups.set(key, []);
        if (live(it)) groups.get(key).push({ it, checked: it.el.getAttribute('aria-checked') === 'true' });
      }
    }
    const a = doc.activeElement;
    for (const opts of groups.values()) {
      const stop = opts.find(o => o.it.el === a) || opts.find(o => o.checked) || opts[0];
      for (const o of opts) set(o.it.el, 'tabindex', o === stop ? 0 : -1);
    }
  }
  // Control looks (5.11), from the person's pointer, keyboard focus and the control's state.
  function looks() {
    for (const it of items) {
      // A drag item is pressed while it is held, at once: picked up by a tap or a key, and let go by Escape (5.11).
      if (it.c.kind === 'drag') set(it.el, 'aria-pressed', drag?.item.el === it.el ? 'true' : 'false');
      const lk = it.node.children.filter(n => n.name && 'data-hsvg-variant' in n.attrs && LOOKS.includes(n.attrs['data-hsvg-variant']));
      if (!lk.length) continue;
      const has = new Set(lk.map(n => n.attrs['data-hsvg-variant']));
      const on = player.controlEnabled(it.addr, it.cid, it.option);
      const want = { disabled: !on, pressed: pressed.has(it.el) || drag?.item.el === it.el, selected: (it.c.kind === 'choice' || it.c.kind === 'toggle') && it.el.getAttribute('aria-checked') === 'true', focus: keyed && doc.activeElement === it.el, hover: hover === it.el, idle: true };
      const pick = LOOKS.find(l => want[l] && has.has(l)) || 'idle';
      for (const n of lk) state.drawing.set(n, 'display', n.attrs['data-hsvg-variant'] === pick ? undefined : 'none');
    }
    ring();
  }

  // A dialog a person opens takes focus at its first usable control; closing returns focus to the opener (10.3).
  let opener = null;
  player.listeners.push(({ deliveries }) => {
    for (const d of deliveries) {
      if (d.kind === 'open' && player.source === 'person') { opener = doc.activeElement; win.queueMicrotask(() => { sync(true); const first = items.find(x => live(x) && dialogEls().at(-1)?.contains(x.el)); first?.el.focus({ preventScroll: true }); }); }
      if (d.kind === 'close') win.queueMicrotask(() => { sync(true); const back = opener && byEl.get(opener); if (back && live(back)) opener.focus({ preventScroll: true }); else items.find(live)?.el.focus({ preventScroll: true }); opener = null; });
    }
  });

  // ---------- helpers ----------
  // A fault from a control stops the experience with a visible message, the same path as the player's own press
  // (player-web.mjs state.fault, 9.2).
  const report = (r) => { if (r && r.ok === false) { if (state.fault) state.fault(r, 'control'); else state.errors.push(r.fault.message); } };
  const after = () => state.after();
  const itemAt = (target) => { for (let n = target; n && n !== container; n = n.parentNode) if (byEl.has(n)) return byEl.get(n); return null; };
  // The control a pointer is on: a target, else a slider's band (its path; a control drawn above it is hit first).
  // A drawing that paints over the band (a label, a tick) does not stop it, and a band never hides a control target
  // under it (another slider's handle): the topmost control target at the point answers, else the topmost band.
  const bandOf = (el) => { const b = bands.get(el); return b && byEl.get(b.el) === b && live(b) ? b : null; };
  const hitAt = (target, x, y) => {
    const it = itemAt(target);
    if (it) return { it, onTarget: true };
    if (!bands.size || x === undefined || !doc.elementsFromPoint) return { it: bandOf(target), onTarget: false };
    // A band paints nothing, so it never hides a control: a target anywhere under the point wins over a band.
    let band = null;
    for (const el of doc.elementsFromPoint(x, y)) {
      if (!container.contains(el)) break;
      const t = itemAt(el);
      if (t) return band ? { it: t, onTarget: true } : { it: null }; // under a band: that control; under a decoration: none
      band ??= bandOf(el);
    }
    return { it: band, onTarget: false };
  };
  const activate = (it, arg, trusted) => {
    state.trustedActivation = !!trusted;
    try { report(player.activate(it.addr, it.cid, arg)); } finally { state.trustedActivation = false; }
    after();
  };
  const toParent = (el, x, y) => { const m = el.parentNode.getScreenCTM(); return m ? new win.DOMPoint(x, y).matrixTransform(m.inverse()) : { x, y }; };

  // ---------- drag ----------
  // The drops shown now: a hidden drop is no place to land and no keyboard stop (5.11).
  const dropEls = (it) => (it.c.drops || []).map(d => [d, state.drawing.frames[it.addr]?.byLocal.get(d)?.dom]).filter(([, e]) => e && visible(e));
  // A drop's spoken name: its accessible name (data-hsvg-label or a label binding), else its text.
  const dropName = (e) => (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim();
  function moveTo(dx, dy) { drag.item.el.setAttribute('transform', `${drag.base ? drag.base + ' ' : ''}translate(${dx} ${dy})`); }
  function pickUp(it, keyboard, x = 0, y = 0) {
    drag = { item: it, base: it.el.getAttribute('transform') || '', start: keyboard ? null : toParent(it.el, x, y), keyboard, dropIndex: -1 };
    const unsnapped = it.c.snap === true && unsnap(it);
    report(player.hold(it.addr, it.cid, true)); after();
    if (unsnapped && drag?.item === it) moveTo(0, 0); // picked up where it rested
    looks();
  }
  function release(drop) {
    const it = drag.item;
    if (it.c.snap === true) { const t = it.node.attrs.transform; if (t) it.el.setAttribute('transform', t); else it.el.removeAttribute('transform'); }
    else if (drag.base) it.el.setAttribute('transform', drag.base); else it.el.removeAttribute('transform');
    drag = null;
    report(player.hold(it.addr, it.cid, false));
    if (drop !== null && it.c.snap === true) snapDrop(it, drop);
    else if (drop !== null) activate(it, drop, true); else after();
    looks();
  }
  // Snap (5.11): an accepted drop of a drag with `snap: true` rests on its drop (block.snaps, painted by
  // drawing.mjs) until it is picked up again. accept is read as the engine reads it at release, before the drop's
  // own transaction; the rest is written right after that transaction commits.
  function snapDrop(it, drop) {
    let accepted = false;
    try { accepted = drop !== '' && (it.c.drops || []).includes(drop) && (it.c.accept === undefined || player.eval(it.addr, it.c.accept, { event: { drop } }) === true); } catch { accepted = false; }
    state.trustedActivation = true;
    let r;
    try { r = player.activate(it.addr, it.cid, drop); report(r); } finally { state.trustedActivation = false; }
    if (accepted && r?.ok && !r.ignored && !state.stopped && player.state.blocks[it.addr]) {
      report(player.transaction('person', () => { const b = player.state.blocks[it.addr]; b.snaps = { ...(b.snaps || {}), [it.cid]: drop }; })); player.afterCommit?.();
    }
    after();
  }
  function unsnap(it) {
    if (player.state.blocks[it.addr]?.snaps?.[it.cid] === undefined) return false;
    report(player.transaction('person', () => { const b = player.state.blocks[it.addr]; const s = { ...b.snaps }; delete s[it.cid]; b.snaps = s; })); player.afterCommit?.();
    return true;
  }
  function keyboardDropMove(dir) {
    const drops = dropEls(drag.item);
    if (!drops.length) return;
    drag.dropIndex = (drag.dropIndex + dir + drops.length + (drag.dropIndex < 0 && dir < 0 ? 1 : 0)) % drops.length;
    const [, target] = drops[drag.dropIndex];
    const a = drag.item.el.getBoundingClientRect(); const b = target.getBoundingClientRect();
    if (!(b.width > 0 || b.height > 0)) return; // never to a place that is not drawn
    // A polite live region names the drop the item is over now (the drop's label, else its text).
    const said = dropName(target);
    if (said) state.announce?.(said);
    const p0 = toParent(drag.item.el, a.x + a.width / 2, a.y + a.height / 2); const p1 = toParent(drag.item.el, b.x + b.width / 2, b.y + b.height / 2);
    const cur = /translate\(([-\d.e]+) ([-\d.e]+)\)$/.exec(drag.item.el.getAttribute('transform') || '');
    moveTo((cur ? +cur[1] : 0) + p1.x - p0.x, (cur ? +cur[2] : 0) + p1.y - p0.y);
  }

  // ---------- slider ----------
  // A slider's range is its handle's travel from where it is drawn, along its axis, in the handle's parent units
  // (5.11): [0, 256] is "from its drawn place to 256 units along x". It reads the same in every layout, at every size
  // and inside a shell's stage. geo(it): the handle's box centre (own units), its drawn place and its place now (the
  // parent's units), measured once at a press.
  const at = (p, axis) => (axis === 'y' ? p.y : p.x);
  const matrixOf = (s) => { if (!s) return null; const g = doc.createElementNS(SVGNS, 'g'); g.setAttribute('transform', s); return g.transform.baseVal.consolidate()?.matrix || null; };
  function geo(it) {
    let box; try { box = it.el.getBBox(); } catch { return null; }
    const c = new win.DOMPoint(box.x + box.width / 2, box.y + box.height / 2);
    const base = matrixOf(it.node.base?.transform);
    const drawn = base ? c.matrixTransform(base) : c;
    const pm = it.el.parentNode?.getScreenCTM?.(); const em = it.el.getScreenCTM?.();
    const now = pm && em ? c.matrixTransform(pm.inverse().multiply(em)) : drawn;
    return { box, centre: c, drawn, now };
  }
  // The share of the travel (0..1, unclamped) for a handle centre `place` along the axis, in the parent's units.
  const shareAt = (it, g, place) => { const [a, b] = it.c.range || [0, 1]; return (place - at(g.drawn, it.c.axis) - a) / (b - a || 1); };
  // An angle slider (axis angle, 5.11): the target turns about its pivot. turnGeo(it): the pivot where it is drawn
  // (P, the parent's units) and where it is now (c, on screen), the disc's radius (R: the farthest corner of the drawn
  // box from the pivot, at least 22 CSS px), the parent's scale, the screen direction of the drawn angle (dir, degrees:
  // from the pivot to the box centre, or up for a part centred on its pivot) and the part's turn now (degrees from its
  // drawn angle, the representation nearest its value's angle).
  const deg = (y, x) => Math.atan2(y, x) * 180 / Math.PI;
  const wrap = (a) => ((a % 360) + 540) % 360 - 180;
  function turnGeo(it) {
    const [px, py] = (it.node.attrs['data-hsvg-pivot'] || '0 0').split(/[\s,]+/).map(Number);
    const em = it.el.getScreenCTM?.(); const pm = it.el.parentNode?.getScreenCTM?.();
    let box; try { box = it.el.getBBox(); } catch { return null; }
    if (!em || !pm) return null;
    const base = matrixOf(it.node.base?.transform) || new win.DOMMatrix();
    const P = new win.DOMPoint(px, py).matrixTransform(base);
    const C = new win.DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(base);
    const R0 = Math.max(...[[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]].map(([x, y]) => { const q = new win.DOMPoint(x, y).matrixTransform(base); return Math.hypot(q.x - P.x, q.y - P.y); }));
    const scale = Math.hypot(pm.a, pm.b) || 1;
    const R = Math.max(R0, 22 / scale);
    const [dx, dy] = Math.hypot(C.x - P.x, C.y - P.y) > 0.1 * R0 ? [C.x - P.x, C.y - P.y] : [0, -1];
    const rel = base.inverse().multiply(pm.inverse().multiply(em));
    const [a, b] = it.c.range || [0, 1];
    const d = player.controlValueDecl(it.addr, it.cid);
    const v = player.controlValue(it.addr, it.cid);
    const want = d && typeof v === 'number' ? a + (v - d.minimum) / (d.maximum - d.minimum || 1) * (b - a) : 0;
    return { P, R, scale, c: new win.DOMPoint(px, py).matrixTransform(em), dir: deg(pm.b * dx + pm.d * dy, pm.a * dx + pm.c * dy), turn: want + wrap(deg(rel.b, rel.a) - want) };
  }
  // The turn under a pointer that has moved (CSS px): the turn at the press plus how far the pointer has gone round the
  // pivot since, unwrapped (the small changes added up, so crossing 180° or a travel's gap never jumps), clamped to
  // the travel. Within 8 CSS px of the pivot the angle is not defined: the move is ignored.
  function turnTo(it, x, y) {
    const t = slide.turn;
    if (Math.hypot(x - t.c.x, y - t.c.y) < 8) return;
    const a = deg(y - t.c.y, x - t.c.x);
    if (t.last !== undefined) t.sum += wrap(a - t.last);
    t.last = a;
    const [from, to] = it.c.range || [0, 1];
    const turn = Math.max(Math.min(from, to), Math.min(Math.max(from, to), t.turn + t.sum));
    state.drawing?.hold?.(it.node, { addr: it.addr, axis: 'angle', at: turn });
    const v = player.sliderValueAt(it.addr, it.cid, (turn - from) / (to - from || 1));
    if (v !== null && v !== player.controlValue(it.addr, it.cid)) activate(it, v, true);
    else state.repaint?.();
  }
  // A tap (5.11): down and up within 300 ms and 4 CSS px, outside the inner 40% of the disc, at an angle inside the
  // travel: the value goes to that angle (the nearest stop with positions).
  function turnTap(it, ev) {
    const t = slide.turn;
    if (performance.now() - t.at > 300 || Math.hypot(ev.clientX - t.down.x, ev.clientY - t.down.y) > 4) return;
    if (Math.hypot(ev.clientX - t.c.x, ev.clientY - t.c.y) < 0.4 * t.R * t.scale) return;
    const [from, to] = it.c.range || [0, 1];
    const lo = Math.min(from, to); const hi = Math.max(from, to);
    const a0 = wrap(deg(ev.clientY - t.c.y, ev.clientX - t.c.x) - t.dir);
    const a = [a0, a0 - 360, a0 + 360].find(x => x >= lo - 1e-9 && x <= hi + 1e-9);
    if (a === undefined) return;
    const v = player.sliderValueAt(it.addr, it.cid, (a - from) / (to - from || 1));
    if (v !== null && v !== player.controlValue(it.addr, it.cid)) activate(it, v, true);
  }
  // The band (5.11): the handle's drawn box stretched along the axis over the travel, an engine-owned rect drawn just
  // under the handle, in its parent. A drawn bar under the handle answers through it, with no new word; anything drawn
  // above it (another control) is hit first. It paints nothing, and takes the pointer cursor and touch-action none.
  // While its slider is hidden or not enabled the band is not drawn, so it shows no pointer and takes no press.
  function bandsFor(list) {
    const want = new Set();
    for (const it of list) {
      if ((it.c.kind !== 'slider' && it.c.kind !== 'dial') || !Array.isArray(it.c.range) || !it.el.parentNode) continue;
      let band = [...bands].find(([, x]) => x.el === it.el)?.[0];
      if (it.c.kind === 'dial') {
        // An angle slider's disc: the circle the target sweeps about its pivot, at least 22 CSS px in radius.
        const t = turnGeo(it);
        if (!t) continue;
        if (band && band.parentNode !== it.el.parentNode) { band.remove(); bands.delete(band); band = null; }
        if (!band) {
          band = build(['circle', { fill: 'none', 'pointer-events': 'all', 'aria-hidden': 'true', 'data-hsvg-band': '', style: 'cursor:pointer;touch-action:none' }]);
          it.el.parentNode.insertBefore(band, it.el);
          cleanups.push(() => band.remove());
        }
        set(band, 'cx', t.P.x); set(band, 'cy', t.P.y); set(band, 'r', t.R);
      } else if (!band || band.parentNode !== it.el.parentNode) {
        const g = geo(it);
        if (!g) continue;
        if (band) { band.remove(); bands.delete(band); }
        const base = matrixOf(it.node.base?.transform);
        const { x, y, width: w, height: h } = g.box;
        const pts = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([px, py]) => { const q = new win.DOMPoint(px, py); return base ? q.matrixTransform(base) : q; });
        const [a, b] = it.c.range; const lo = Math.min(a, b); const hi = Math.max(a, b);
        let x0 = Math.min(...pts.map(q => q.x)); let x1 = Math.max(...pts.map(q => q.x)); let y0 = Math.min(...pts.map(q => q.y)); let y1 = Math.max(...pts.map(q => q.y));
        if (it.c.axis === 'y') { y0 += lo; y1 += hi; } else { x0 += lo; x1 += hi; }
        band = build(['rect', { x: String(x0), y: String(y0), width: String(Math.max(0, x1 - x0)), height: String(Math.max(0, y1 - y0)), fill: 'none', 'pointer-events': 'all', 'aria-hidden': 'true', 'data-hsvg-band': '', style: 'cursor:pointer;touch-action:none' }]);
        it.el.parentNode.insertBefore(band, it.el);
        cleanups.push(() => band.remove());
      }
      bands.set(band, it);
      want.add(band);
      const on = visible(it.el) && inDialog(it.el) && player.controlEnabled(it.addr, it.cid);
      set(band, 'display', on ? null : 'none');
    }
    for (const band of [...bands.keys()]) if (!want.has(band)) { band.remove(); bands.delete(band); }
  }
  // The slider the pointer holds, as drawn now (a relayout draws it afresh: the same control, a new element).
  function held() {
    if (!slide) return null;
    const it = byEl.get(slide.item.el) || items.find(x => x.addr === slide.item.addr && x.cid === slide.item.cid);
    if (!it) return null;
    if (it.el !== slide.item.el) {
      const g = slide.turn ? turnGeo(it) : geo(it);
      if (!g) return null;
      slide.item = it;
      if (slide.turn) Object.assign(slide.turn, { c: g.c, R: g.R, scale: g.scale, dir: g.dir, last: undefined }); else slide.geo = g;
    }
    return it;
  }
  // The handle follows the pointer along its travel (clamped to it); the value is the one under the handle's centre:
  // the nearest stop with positions, else any number. setValue false: a grab, which does not move the value.
  function follow(it, x, y, setValue = true) {
    const g = slide.geo;
    const [a, b] = it.c.range || [0, 1];
    const p = toParent(it.el, x, y);
    const place = Math.max(Math.min(a, b), Math.min(Math.max(a, b), at(p, it.c.axis) - slide.grab - at(g.drawn, it.c.axis)));
    state.drawing?.hold?.(it.node, { addr: it.addr, axis: it.c.axis === 'y' ? 'y' : 'x', at: place });
    const v = setValue ? player.sliderValueAt(it.addr, it.cid, (place - a) / (b - a || 1)) : null;
    if (v !== null && v !== player.controlValue(it.addr, it.cid)) activate(it, v, true);
    else state.repaint?.();
  }
  // Lets go of the held slider: the handle settles on its value's place (the drawing glides the hold away).
  function letSlide() {
    const it = held();
    if (it) { state.drawing?.hold?.(it.node, null); state.repaint?.(); }
    if (slide?.item.c.held) { report(player.hold(slide.item.addr, slide.item.cid, false)); after(); }
    slide = null;
  }
  function slideBy(it, dir, end, page) {
    const d = player.controlValueDecl(it.addr, it.cid);
    if (!d) return;
    const cur = player.controlValue(it.addr, it.cid);
    const v = end ? (dir < 0 ? d.minimum : d.maximum) : Math.max(d.minimum, Math.min(d.maximum, +(cur + dir * (page ? player.sliderPage : player.sliderStep).call(player, it.addr, it.cid)).toFixed(10)));
    const snapped = player.sliderValueAt(it.addr, it.cid, (v - d.minimum) / (d.maximum - d.minimum || 1));
    if (snapped !== null && snapped !== cur) activate(it, snapped, true);
  }

  // ---------- pointer ----------
  let tapDropped = false; // the click after a tap that dropped a held item is not a press (10.13)
  // A press, option or snapshot is pressed by a mouse or pen that goes down and comes up on it within TAP_PX: on the
  // up, whether or not the browser fires a click (Firefox fires none when the pressed look swaps the part under the
  // pointer). A finger keeps the click where the browser sends touch events: its mouse events come after the up, and a
  // press that moved focus on the up would lose it to them. Firefox sends no touchstart, touchend or click for a touch
  // whose part the pressed look hid on pointerdown while a control had focus: with no touchstart the tap presses on
  // the up. With one, a tap whose click has not come 800 ms after the up, or by the next pointerdown, presses then.
  // The click that may follow within a second is then not a second press. A click with no such up (assistive tech)
  // presses.
  const PRESSING = ['button', 'toggle', 'choice', 'snapshot'];
  let tapDown = null; let tapTaken = null; let tapLate = null;
  const tapNow = (it) => { tapTaken = performance.now(); activate(it, it.option, true); };
  const lateTap = (fire) => { if (!tapLate) return; const { it, timer } = tapLate; tapLate = null; win.clearTimeout(timer); if (fire && !state.stopped && live(it)) tapNow(it); };
  listen(container, 'touchstart', () => { if (tapDown?.touch) tapDown.seen = true; }, true);
  const dropAt = (x, y) => dropEls(drag.item).find(([, e]) => { const b = e.getBoundingClientRect(); return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom; });
  listen(container, 'pointerdown', (ev) => {
    if (state.stopped) return;
    tapDropped = false;
    // An item held by a tap or by the keyboard: this tap drops it where it lands (a drop place, or none).
    if (drag?.keyboard && ev.button === 0) { const hit = dropAt(ev.clientX, ev.clientY); tapDropped = true; release(hit ? hit[0] : ''); ev.preventDefault(); return; }
    const { it, onTarget } = hitAt(ev.target, ev.clientX, ev.clientY);
    lateTap(true);
    tapTaken = null;
    if (!it || !live(it) || ev.button !== 0) { tapDown = null; return; }
    tapDown = PRESSING.includes(it.c.kind) ? { el: it.el, x: ev.clientX, y: ev.clientY, id: ev.pointerId, touch: ev.pointerType === 'touch', seen: false } : null;
    // A slider's handle is measured before its pressed look shows (a look may be drawn a little apart).
    const turning = it.c.kind === 'dial';
    const g0 = it.c.kind === 'slider' || turning ? (turning ? turnGeo(it) : geo(it)) : null;
    // Every control kind shows its drawn `pressed` look while the pointer holds it; a press and a slider report `held`.
    pressed.add(it.el);
    if (isPress(it.c.kind)) { report(player.hold(it.addr, it.cid, true)); after(); } else looks();
    // A slider's `held` is true from the pointer's press to its release (never from keys).
    if (g0 && it.c.held) { report(player.hold(it.addr, it.cid, true)); after(); }
    if (turning && g0) {
      // An angle slider: a press anywhere on its disc grabs the part where it is (no jump) and takes focus.
      slide = { item: it, geo: null, turn: { ...g0, sum: 0, last: undefined, at: performance.now(), down: { x: ev.clientX, y: ev.clientY } }, pointerId: ev.pointerId };
      ev.target.setPointerCapture?.(ev.pointerId);
      if (doc.activeElement !== it.el) it.el.focus({ preventScroll: true });
      state.drawing?.hold?.(it.node, { addr: it.addr, axis: 'angle', at: g0.turn });
      turnTo(it, ev.clientX, ev.clientY);
      ev.preventDefault();
    } else if (g0) {
      // On the handle: grabbed where it is, at the pointer's offset from its centre (no jump). On the band: the
      // handle's centre comes under the pointer, and the value with it. Either way the slider takes focus and keeps
      // the pointer while held.
      const p = toParent(it.el, ev.clientX, ev.clientY);
      slide = { item: it, geo: g0, grab: onTarget ? at(p, it.c.axis) - at(g0.now, it.c.axis) : 0, pointerId: ev.pointerId };
      ev.target.setPointerCapture?.(ev.pointerId);
      if (doc.activeElement !== it.el) it.el.focus({ preventScroll: true });
      follow(it, ev.clientX, ev.clientY, !onTarget);
      ev.preventDefault();
    }
    if (it.c.kind === 'drag') { pickUp(it, false, ev.clientX, ev.clientY); if (drag) drag.down = { x: ev.clientX, y: ev.clientY }; it.el.setPointerCapture?.(ev.pointerId); ev.preventDefault(); }
  });
  listen(container, 'pointermove', (ev) => {
    if (state.stopped) return;
    const { it } = slide ? { it: slide.item } : hitAt(ev.target);
    if (it?.el !== hover) { hover = it?.el || null; looks(); }
    if (slide && ev.pointerId === slide.pointerId) { const s = held(); if (s) (slide.turn ? turnTo : follow)(s, ev.clientX, ev.clientY); }
    if (drag && !drag.keyboard) { const p = toParent(drag.item.el, ev.clientX, ev.clientY); moveTo(p.x - drag.start.x, p.y - drag.start.y); }
  });
  const up = (ev) => {
    if (state.stopped) return;
    const down = tapDown; tapDown = null;
    letGo();
    const near = down && ev.pointerId === down.id && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) <= TAP_PX;
    if (down?.touch && !near) tapTaken = performance.now(); // a finger that moved past TAP_PX: its click is no press
    if (near && !state.stopped) {
      const bandHit = bands.has(ev.target);
      const it = bandHit ? hitAt(ev.target, ev.clientX, ev.clientY).it : itemAt(ev.target);
      if (it && it.el === down.el && live(it)) {
        if (!down.touch || !down.seen) { tapTaken = performance.now(); activate(it, it.option, ev.isTrusted); }
        else tapLate = { it, timer: win.setTimeout(() => lateTap(true), 800) };
      }
    }
    if (slide?.turn && ev.pointerId === slide.pointerId) { const s = held(); if (s) turnTap(s, ev); }
    if (slide) letSlide();
    if (drag && !drag.keyboard) {
      // A tap, not a drag: the item stays picked up, at rest, until the next tap drops it.
      if (drag.down && Math.hypot(ev.clientX - drag.down.x, ev.clientY - drag.down.y) <= TAP_PX) { drag.keyboard = true; drag.tap = true; moveTo(0, 0); looks(); return; }
      const hit = dropAt(ev.clientX, ev.clientY);
      release(hit ? hit[0] : '');
    }
  };
  listen(container, 'pointerup', up);
  // A finger on a slider or a drag item does not scroll the page (5.11). Chrome reads touch-action only on the <svg>
  // box, never on a part inside it, so the touch that a pointerdown took (it comes first) is kept from scrolling here;
  // else Chrome cancels the pointer after one move and scrolls.
  const keep = (ev) => { if (slide || (drag && !drag.keyboard)) ev.preventDefault(); };
  listen(container, 'touchstart', keep, { passive: false });
  listen(container, 'touchmove', keep, { passive: false });
  // Lets go of every held control: a press reports `held` false; every kind drops its `pressed` look.
  function letGo() {
    if (!pressed.size) return;
    for (const el of pressed) { const it = byEl.get(el); if (isPress(it?.c.kind)) report(player.hold(it.addr, it.cid, false)); }
    pressed.clear(); after();
  }
  listen(container, 'pointercancel', () => { if (state.stopped) return; tapDown = null; letGo(); if (slide) letSlide(); if (drag && !drag.keyboard) release(null); });
  listen(container, 'click', (ev) => {
    if (state.stopped) return;
    if (tapDropped) { tapDropped = false; return; }
    lateTap(false);
    if (tapTaken !== null && performance.now() - tapTaken < 1000) { tapTaken = null; return; } // pressed on the pointer's up already
    tapTaken = null;
    const it = bands.has(ev.target) ? hitAt(ev.target, ev.clientX, ev.clientY).it : itemAt(ev.target);
    const g = gestures(it);
    if (!it || !(PRESSING.includes(it.c.kind) || g?.includes('press'))) return;
    if (!live(it)) return;
    activate(it, g ? 'press' : it.option, ev.isTrusted);
  });

  // ---------- keyboard ----------
  listen(doc, 'keydown', (ev) => {
    if (state.stopped || !forMe(ev)) return;
    const it = byEl.get(doc.activeElement);
    const code = ev.code;
    if (!ev.repeat && KEY.test(code)) report(player.key(code));
    if (code === 'Escape' && drag) { release(null); ev.preventDefault(); return; }
    // Tab stays inside the top dialog (10.3): from its last stop to its first, and back with Shift.
    if (code === 'Tab' && player.openDialogs?.().length) {
      const stops = tops().flatMap(t => [...t.querySelectorAll('[tabindex],button,input,select,textarea,a[href]')]).filter(e => e.tabIndex >= 0 && !e.disabled && !e.closest('[inert]') && visible(e));
      const a = doc.activeElement; const i = stops.indexOf(a);
      const to = !stops.length ? null : i < 0 ? stops[ev.shiftKey ? stops.length - 1 : 0] : ev.shiftKey && i === 0 ? stops.at(-1) : !ev.shiftKey && i === stops.length - 1 ? stops[0] : null;
      if (to || !stops.length) { to?.focus({ preventScroll: true }); ev.preventDefault(); return; }
    }
    if (code === 'Escape' && player.openDialogs?.().length) {
      const top = player.openDialogs().at(-1);
      report(player.transaction('person', () => player.dialog(top.id, false))); player.afterCommit?.(); after(); ev.preventDefault(); return;
    }
    if (drag?.keyboard) {
      if (/^Arrow/.test(code)) { keyboardDropMove(code === 'ArrowLeft' || code === 'ArrowUp' ? -1 : 1); ev.preventDefault(); return; }
      if (code === 'Enter' || code === 'Space') { const drops = dropEls(drag.item); release(drag.dropIndex >= 0 ? drops[drag.dropIndex][0] : ''); ev.preventDefault(); return; }
    }
    if (it && live(it) && !ev.repeat) {
      const k = it.c.kind;
      const g = code === 'Enter' || code === 'Space' ? 'press' : code === 'ArrowUp' || code === 'ArrowRight' ? 'up' : code === 'ArrowDown' || code === 'ArrowLeft' ? 'down' : null;
      if (g && gestures(it)?.includes(g)) { activate(it, g, ev.isTrusted); ev.preventDefault(); return; }
      if ((code === 'Enter' || code === 'Space') && (isPress(k) || k === 'snapshot')) {
        if (isPress(k) && it.c.held) { pressed.add(it.el); report(player.hold(it.addr, it.cid, true)); }
        activate(it, undefined, ev.isTrusted); ev.preventDefault(); return;
      }
      if ((code === 'Enter' || code === 'Space') && k === 'choice') { pressed.add(it.el); activate(it, it.option, ev.isTrusted); looks(); ev.preventDefault(); return; }
      if ((code === 'Enter' || code === 'Space') && k === 'drag') { pickUp(it, true); ev.preventDefault(); return; }
      if (k === 'choice' && /^(Arrow|Home$|End$)/.test(code)) {
        const peers = items.filter(x => x.addr === it.addr && x.cid === it.cid && live(x));
        const i = peers.indexOf(it);
        const j = code === 'Home' ? 0 : code === 'End' ? peers.length - 1 : (i + (code === 'ArrowLeft' || code === 'ArrowUp' ? -1 : 1) + peers.length) % peers.length;
        peers[j]?.el.focus({ preventScroll: true }); looks(); ev.preventDefault(); return;
      }
      if ((k === 'slider' || k === 'dial') && /^(Arrow|Home$|End$|Page)/.test(code)) {
        const dir = code === 'ArrowLeft' || code === 'ArrowDown' || code === 'Home' || code === 'PageDown' ? -1 : 1;
        pressed.add(it.el); slideBy(it, dir, code === 'Home' || code === 'End', /^Page/.test(code)); looks(); ev.preventDefault(); return;
      }
    }
    // Shortcut keys of live controls (5.11): a press activates; an option's key selects it. A held press control
    // (`held`) stays held while its key is down, as with Enter or Space on it.
    if (ev.repeat && heldKeys.has(code)) { ev.preventDefault(); return; }
    if (!ev.repeat) for (const x of items) {
      if (!live(x)) continue;
      const keys = x.option !== undefined ? x.c.options[x.option].keys : x.c.keys;
      if (!keys?.includes(code)) continue;
      if (isPress(x.c.kind) && x.c.held) { heldKeys.set(code, x); report(player.hold(x.addr, x.cid, true)); }
      activate(x, x.option, ev.isTrusted); ev.preventDefault(); return;
    }
  });
  listen(doc, 'keyup', (ev) => {
    if (state.stopped) return;
    if (!forMe(ev) && !heldKeys.has(ev.code)) return;
    if (KEY.test(ev.code)) report(player.key(ev.code, true));
    const hk = heldKeys.get(ev.code);
    if (hk) { heldKeys.delete(ev.code); report(player.hold(hk.addr, hk.cid, false)); after(); }
    const it = byEl.get(doc.activeElement);
    if (it && pressed.has(it.el) && (ev.code === 'Enter' || ev.code === 'Space' || /^(Arrow|Home$|End$|Page)/.test(ev.code))) { pressed.delete(it.el); if (isPress(it.c.kind)) report(player.hold(it.addr, it.cid, false)); after(); }
  });
  // A key released while the page is in the background never sends keyup: let go of what its shortcut held.
  listen(win, 'blur', () => { if (state.stopped) return; letGo(); for (const [code, hk] of heldKeys) { heldKeys.delete(code); report(player.hold(hk.addr, hk.cid, false)); } after(); });
  // The control the person last focused, kept while it is removed from the page, so a remount can move focus on.
  let lastFocus = null;
  const leaving = (el) => !!el.closest?.('[data-player-leaving]');
  listen(container, 'focusin', (ev) => { lastFocus = byEl.has(ev.target) ? ev.target : null; if (byEl.get(ev.target)?.c.kind === 'choice') roving(); looks(); });
  listen(container, 'focusout', (ev) => {
    // Focus the person moved away (to the page, or out of the player) is theirs: forget it. A removed target keeps it.
    // A control in the leaving copy of a fade or slide is removed in effect: it keeps the focus to move on.
    win.queueMicrotask(() => {
      if (lastFocus === ev.target && ev.target.isConnected && !leaving(ev.target) && !container.contains(doc.activeElement)) lastFocus = null;
      if (byEl.get(ev.target)?.c.kind === 'choice' && !state.stopped) roving(); // the stop goes back to the checked option
    });
    looks();
  });

  // Removes every listener and the style, and gives the keys back when this player holds them (10.6).
  const destroy = () => {
    lateTap(false);
    for (const c of cleanups.splice(0)) { try { c(); } catch { /* gone */ } }
    const live = mountedIn.get(doc) || [];
    const i = live.indexOf(container); if (i >= 0) live.splice(i, 1);
    if (keyOwner.get(doc) === container) keyOwner.delete(doc);
  };
  return { sync, destroy, items: () => items.map(({ addr, cid, option, el }) => ({ addr, cid, option, id: el.id, role: el.getAttribute('role'), tabindex: el.getAttribute('tabindex'), label: el.getAttribute('aria-label'), disabled: el.getAttribute('aria-disabled') === 'true' })) };
}

// Where focus goes in a scene the stage shows now (3.7): its firstFocus control when it names a usable one (a new
// scene), else the scene's first usable control. order: the usable controls [{addr, cid}], in document order.
export function stageFocus(order, stage, firstFocus) {
  const inStage = (x) => x.addr === stage || x.addr.startsWith(stage + '/');
  return (typeof firstFocus === 'string' && order.find(x => x.addr === stage && x.cid === firstFocus)) || order.find(inStage);
}

// ---------- the focus ring (WCAG 2.4.13) ----------
// The ring, in CSS pixels: a band of the focus colour RING_PX thick, GAP_PX outside the part's outline, with a halo of
// the contrasting colour on both sides of it (from the outline to HALO_PX past the band), so the band meets 3:1 against
// whatever is next to it. Any paint of at least 1% alpha counts as the part's outline, so a faint hit area (a rect
// filled at 1% to 15%, as hit areas and focus looks are drawn) gives the ring its shape, not the strokes inside it.
export const RING = Object.freeze({ GAP_PX: 2, RING_PX: 3, HALO_PX: 2, FALLBACK: '#1a5fb4' });
const hexOf = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c.toLowerCase() : /^#[0-9a-f]{3}$/i.test(c || '') ? '#' + [...c.slice(1)].map(x => x + x).join('').toLowerCase() : null);
const lumOf = (c) => { const v = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
export function contrastOf(a, b) { const [x, y] = [lumOf(a), lumOf(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }
// The theme's focus colour (7.7): accent-2, else accent, else the player's blue.
export function focusColour(theme) {
  const r = theme?.colorRoles || {};
  return hexOf(r['accent-2']) || hexOf(r.accent) || RING.FALLBACK;
}
// The ring's plan for a focus colour and a scale (CSS pixels per user unit of the part): the colours, the three
// offsets in user units (the gap, the band's outer edge, the halo's outer edge), one CSS pixel in user units (the soft
// edge) and the margin of the filter region. The halo is white when the focus colour stands 3:1 on white, else
// whichever of white and near-black stands further from it.
export function focusRing(colour, scale) {
  const focus = hexOf(colour) || RING.FALLBACK;
  const halo = contrastOf(focus, '#ffffff') >= 3 || contrastOf(focus, '#ffffff') >= contrastOf(focus, '#111111') ? '#ffffff' : '#111111';
  const u = (px) => Math.round((px / scale) * 1000) / 1000;
  const radii = [u(RING.GAP_PX), u(RING.GAP_PX + RING.RING_PX), u(RING.GAP_PX + RING.RING_PX + RING.HALO_PX)];
  return { focus, halo, radii, px: u(1), margin: u(RING.GAP_PX + RING.RING_PX + RING.HALO_PX + 4), contrast: contrastOf(focus, halo) };
}
// The filter, as plain data ([name, attributes, children]): the part's alpha (1% and over, as solid) grown three
// times, each from the last; the halo is the largest less the part, the band the middle one less the smallest; the
// part is drawn on top, unchanged (withPart; a ring drawn on a copy leaves the part out). Each growth is a blur and a
// threshold, so it is round (a dilate grows a circle into a rounded square): a Gaussian blur of a solid edge is 10% at
// 1.2816 sigma outside it, and the threshold ramps over one CSS pixel there, so the edge is smooth at every zoom.
// box: the region's bounding box in the filtered element's own user units.
export function ringFilter(id, plan, box, withPart = true) {
  const [r1, r2, r3] = plan.radii; const m = plan.margin;
  const n = (v) => String(Math.round(v * 1000) / 1000);
  const grow = (from, r, name) => {
    const sd = r / 1.2816; const k = Math.max(1, sd / (0.1755 * (plan.px || 1)));
    return [['feGaussianBlur', { in: from, stdDeviation: n(sd), result: name + 'b' }], ['feComponentTransfer', { in: name + 'b', result: name }, [['feFuncA', { type: 'linear', slope: n(k), intercept: n(0.5 - 0.1 * k) }]]]];
  };
  const flood = (colour, d, cut, name) => [['feFlood', { 'flood-color': colour, result: name + '0' }], ['feComposite', { in: name + '0', in2: d, operator: 'in', result: name + '1' }], ['feComposite', { in: name + '1', in2: cut, operator: 'out', result: name }]];
  return ['filter', { id, filterUnits: 'userSpaceOnUse', x: n(box.x - m), y: n(box.y - m), width: n(box.width + 2 * m), height: n(box.height + 2 * m), 'color-interpolation-filters': 'sRGB' }, [
    ['feComponentTransfer', { in: 'SourceAlpha', result: 'a' }, [['feFuncA', { type: 'linear', slope: '100', intercept: '0' }]]],
    ...grow('a', r1, 'd1'), ...grow('d1', r2 - r1, 'd2'), ...grow('d2', r3 - r2, 'd3'),
    ...flood(plan.halo, 'd3', 'a', 'halo'),
    ...flood(plan.focus, 'd2', 'd1', 'band'),
    ['feMerge', {}, [['feMergeNode', { in: 'halo' }], ['feMergeNode', { in: 'band' }], ...(withPart ? [['feMergeNode', { in: 'SourceGraphic' }]] : [])]]]];
}
// Whether the ring can be drawn on a control's target: an SVG element with no filter of its own (a CSS filter would
// replace it) and some paint (a part that is only an invisible hit area has no outline to follow).
export function canRing(el, win) {
  if (!el || el.namespaceURI !== SVGNS || typeof el.getBBox !== 'function') return false;
  const own = (x) => (x.getAttribute('filter') && x.getAttribute('filter') !== 'none') || /(^|;)\s*filter\s*:(?!\s*none)/.test(x.getAttribute('style') || '');
  if (own(el)) return false;
  const shapes = el.matches('rect,circle,ellipse,path,polygon,polyline,line,text,use,image') ? [el] : [...el.querySelectorAll('rect,circle,ellipse,path,polygon,polyline,line,text,use,image')].slice(0, 400);
  return shapes.some(x => {
    const s = win.getComputedStyle(x);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    if (x.localName === 'image' || x.localName === 'use') return true;
    const fill = s.fill && s.fill !== 'none' && !/rgba\([^)]*,\s*0\)$/.test(s.fill) && Number(s.fillOpacity) > 0;
    const stroke = s.stroke && s.stroke !== 'none' && !/rgba\([^)]*,\s*0\)$/.test(s.stroke) && Number(s.strokeOpacity) > 0 && parseFloat(s.strokeWidth) > 0;
    return fill || stroke;
  });
}
