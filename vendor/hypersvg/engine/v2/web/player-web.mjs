// The 2.0 engine in a browser page: loads an experience from a file map, mounts the current scene's frame as inline
// SVG, runs pointer and keyboard input on controls (input-web.mjs), plays sound (audio-web.mjs), and runs the clock
// with requestAnimationFrame. Capabilities (src/capabilities.mjs) attach their page parts only when the experience's
// needs names them: the shell's widgets, the snapshot's PNG.
// - boot(container, options): fetches files and schemas from a server (or takes embedded ones) and plays; for test
//   pages and the packed page.
// - mount(container, package, options), the host API of 10.6, is in mount-web.mjs: it checks the package first, so it
//   carries the checkers, which a packed page does not (D19).
// Plain ES modules, served as files; no network beyond the page's own origin.
import { readExperience } from '../src/read.mjs';
import { Player } from '../src/story.mjs';
import { checkSetting } from '../src/runtime.mjs';
import { Drawing, narrowLayouts } from '../src/drawing.mjs';
import { hostApi } from '../src/host.mjs';
import { attachAudio } from './audio-web.mjs';
import { attachInput } from './input-web.mjs';
import { packageMeasures, experienceResources } from '../src/host-profile.mjs';
import { chooseLayout, shapeMapsOf, aspectsOf, directionOf, inputPicks, picksFor, pickedLayout, trueSizes, nearestSize, activeShape } from '../src/layout.mjs';

// Did a block, or a use inside it, take give-way steps in this drawing (8.4)? Its rules used a step, or a text gave way.
// A baked frame's steps (the packer's, read from the frame) do not count: the frame is drawn for its size.
export function reducedUnder(d, addr) {
  for (const [a, r] of Object.entries(d?.ladder || {})) {
    if (r.baked || (a !== addr && !a.startsWith(`${addr}/`))) continue;
    if (r.steps?.length || r.texts?.some(t => t.outcome === 'given-way')) return true;
  }
  return false;
}

// The layout of a scene or a shell for a space (7.1, 7.4): the current one while it applies and fits, else the first
// in list order that applies and fits. A layout in unfit (a text fit of its own came out incomplete) or in reduced (it
// fit only after give-way steps) does not count as fitting; when none fits unreduced, the first that applies takes
// the steps. unfit, reduced: Sets of layout ids, or null. Returns chooseLayout's {id, why}.
export function chooseFrame(layouts, space, { input = null, current = null, unfit = null, reduced = null, aspectOf, maps } = {}) {
  const notUnfit = (id) => (unfit?.has(id) ? false : undefined);
  const c = chooseLayout(layouts, space, { input, current, fits: (id) => (reduced?.has(id) ? false : notUnfit(id)), aspectOf, maps });
  if (c.why !== 'incomplete' || !reduced?.size) return c;
  const r = chooseLayout(layouts, space, { input, current: null, fits: notUnfit, aspectOf, maps });
  return r.why === 'order' ? { id: r.id, why: 'reduced' } : r;
}

// The blocks that did not fit unreduced in this drawing (7.4, 8.4), and every block around them: a give-way step, or a
// text that gave way or came out incomplete. A baked frame's steps do not count. Returns a Set of addresses.
const upFrom = (a) => (a.includes('/') ? a.slice(0, a.lastIndexOf('/')) : null);
function reducedBlocks(d) {
  const out = new Set();
  const mark = (a) => { for (let x = a; x && !out.has(x); x = upFrom(x)) out.add(x); };
  for (const [a, r] of Object.entries(d?.ladder || {})) if (!r.baked && (r.steps?.length || r.texts?.some(t => t.outcome === 'given-way'))) mark(a);
  for (const [key, outcome] of Object.entries(d?.fits || {})) if (outcome === 'incomplete' || outcome === 'given-way') mark(key.slice(0, key.lastIndexOf('#')));
  return out;
}

// What a painted drawing says about the layouts the page chose (7.1, 7.4), learned into the page's memory:
// {layouts, unfit, reduced} (address -> the layout shown last; address -> Set of the layouts that did not fit, or fit
// only after give-way steps, at this space). roots: the scene's and the shell's addresses. Returns {again, forgot}:
// again is true when the page must choose again; forgot lists the uses whose kept layout was forgotten.
// - A layout of the scene or shell whose own text fit came out incomplete does not fit at this space.
// - A use keeps its current layout (7.3) only while it applies and fits unreduced (7.4). A use that kept it and took
//   give-way steps, or whose text came out incomplete, forgets it: it chooses in list order again, as a fresh drawing
//   at this space does. The deepest such use goes first, since the use around it may fit once it has chosen again;
//   the scene and shell wait until no use forgets.
// - A layout of the scene or shell that fits only after give-way steps (its own or a use's inside it) does not count
//   as fitting: the next layout that applies is tried unreduced.
export function learnFits(d, roots, memory) {
  const out = { again: false, forgot: [] };
  if (!d?.fits) return out;
  const { layouts, unfit, reduced } = memory;
  for (const [key, outcome] of Object.entries(d.fits)) {
    if (outcome !== 'incomplete') continue;
    const addr = key.slice(0, key.lastIndexOf('#'));
    if (!roots.includes(addr)) continue;
    const id = d.frames[addr]?.layout;
    if (id == null || unfit[addr]?.has(id)) continue;
    (unfit[addr] ??= new Set()).add(id);
    out.again = true;
  }
  const bad = reducedBlocks(d);
  const kept = bad.size ? Object.entries(d.choices || {}).filter(([a, c]) => c.why === 'current' && layouts[a] != null && bad.has(a)).map(([a]) => a) : [];
  const above = new Set(); // the blocks around a kept one
  for (const a of kept) for (let x = upFrom(a); x && !above.has(x); x = upFrom(x)) above.add(x);
  out.forgot = kept.filter(a => !above.has(a));
  for (const a of out.forgot) delete layouts[a];
  if (out.forgot.length) { out.again = true; return out; }
  for (const addr of roots) {
    const id = d.frames[addr]?.layout;
    if (addr == null || id == null || reduced[addr]?.has(id) || unfit[addr]?.has(id)) continue;
    if (!reducedUnder(d, addr)) continue;
    (reduced[addr] ??= new Set()).add(id);
    out.again = true;
  }
  return out;
}

// A booted page is the whole page (true size, 7.3) unless it sits in a frame: a frame is a host's slot.
export async function boot(container, { filesUrl, files: givenFiles = null, schemasUrl, checked = false, ...rest } = {}) {
  let framed = false;
  try { framed = window.top !== window.self; } catch { framed = true; }
  // Files and schemas come from the page (packed: files embedded, checked by the packer) or from a server.
  const files = givenFiles || await fetch(filesUrl).then(r => r.json());
  const schemas = checked ? null : await fetch(schemasUrl).then(r => r.json());
  // The dev player (served, unpacked) loads every built capability; the engine installs only those in needs. A packed
  // page registers the ones its needs names before it boots. The dev player checks every file (src/load.mjs, with the
  // checkers and the kit loader); a packed page only parses what the packer checked and flattened.
  if (!checked && !rest.modules) await import('../src/capabilities/all.mjs');
  const load = checked ? null : (await import('../src/load.mjs')).loadExperience;
  return play(container, { files, schemas, test: true, wholePage: !framed, ...(load ? { load } : {}), ...rest });
}

// A flattened kit experience (pack.mjs flattenKit) with each drawing's text read again from the packed files.
function unflatten(flat, files) {
  const e = structuredClone(flat);
  for (const b of [e.shell, ...Object.values(e.scenes || {}), ...Object.values(e.blocks || {})]) for (const d of Object.values(b?.drawings || {})) d.text = files[d.file];
  return e;
}

// Loads, starts and shows the experience; returns the page state (player, drawing, host, test hooks).
// wholePage: the experience is the whole page on its own (boot), so an experience made only in exact sizes shows at
// true size (7.3); a host's mount gives it the container's size instead.
// load(source, schemas): the loader (src/load.mjs loadExperience checks and reads kits); by default the player's reader,
// which only parses (src/read.mjs). kitted: a kit experience the packer flattened (pack.mjs flattenKit): it plays as it
// is, its drawings' texts taken from files.
// A link button with no host (10.5). A page opened alone has no host profile, so it opens no link: the engine refuses
// the use (E-GRANT) or, granted but heard by no listener, nobody opens it. Either way the page logs one plain line, so
// the author sees what happened; the dev player (a preview host) shows the same line as a notice. The address named
// is the experience's url input (or inputs) as it is now.
function linkAddresses(player, field) {
  const inputs = player?.exp?.doc?.inputs || {};
  const now = player?.state?.blocks?.experience?.inputs || {};
  const names = field != null ? [field] : Object.keys(inputs).filter(n => inputs[n]?.contentType === 'url');
  const urls = names.map(n => now[n] ?? inputs[n]?.initial).filter(u => typeof u === 'string' && u);
  return urls.length ? urls.join(' or ') : 'its link';
}
export function linkWithoutHostLine(player, { field = null, preview = false } = {}) {
  const where = preview ? 'the dev player opens no link' : 'this page has no host';
  return `openUrl refused: ${where}; a host would open ${linkAddresses(player, field)}`;
}
function linkWithoutHost(state, container, host) {
  const preview = host?.preview === true;
  let listeners = 0;
  const on = state.host.on;
  state.host.on = (name, fn) => {
    const off = on(name, fn);
    if (name !== 'openUrl' && name !== 'hsvg.openUrl') return off;
    listeners++;
    let gone = false;
    return () => { if (!gone) { gone = true; listeners--; } return off(); };
  };
  const tell = (line) => {
    console.log(line);
    state.linkNotices = [...(state.linkNotices || []), line];
    if (!preview) return;
    let box = container.querySelector('[data-hsvg-notice="openUrl"]');
    if (!box) {
      box = document.createElement('div');
      box.setAttribute('role', 'status');
      box.setAttribute('data-hsvg-notice', 'openUrl');
      box.setAttribute('style', 'position:absolute;left:0;right:0;top:0;padding:8px 12px;background:#1f3a5f;color:#fff;font:14px/1.4 system-ui,sans-serif;z-index:9');
      if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
      container.appendChild(box);
    }
    box.textContent = line;
  };
  // A refused openUrl (no grant, 10.5) does nothing and leaves a grant note: the same line, once per refused press.
  let seenNotes = 0;
  state.player.on(({ outputs }) => {
    for (const o of outputs) if (o.name === 'openUrl' && (host == null || preview) && listeners === 0) tell(linkWithoutHostLine(state.player, { field: o.field, preview }));
    const notes = state.player.notes || [];
    for (; seenNotes < notes.length; seenNotes++) {
      const n = notes[seenNotes];
      if (n?.kind === 'grant' && /openUrl/.test(String(n.message ?? '')) && (host == null || preview) && listeners === 0) tell(linkWithoutHostLine(state.player, { preview }));
    }
  });
  // The engine refuses openUrl without its grant (E-GRANT): the same line, before the stop message.
  return (f) => { if (f?.code === 'E-GRANT' && /openUrl/.test(String(f?.message ?? ''))) tell(linkWithoutHostLine(state.player)); };
}

export function play(container, { files, schemas = null, assets = null, assetsUrl = './', capabilities = {}, manualClock = false, start = null, partition = 'device', onError = null, test = false, widgets = {}, host = null, options = {}, members = null, modules = null, wholePage = false, load = readExperience, kitted = null, previewHost = false, timeLimits = null }) {
  // Shared across separately imported player copies in the same page; stable across this mount's redraws.
  const sequence = Symbol.for('hypersvg.mountSequence');
  const namespace = `hsvg${globalThis[sequence] = (globalThis[sequence] || 0) + 1}__`;
  const source = { read: (rel) => (rel in files ? files[rel] : null) };
  let loaded = kitted ? { experience: unflatten(kitted, files), diags: [] } : load(source, schemas);
  if (!loaded.experience) { const e = new Error(loaded.diags.map(d => `${d.code} ${d.file}: ${d.message}`).join('; ')); e.code = loaded.diags[0]?.code; throw e; }
  // previewHost (the dev player only, web/index.html): the author previewing is the page's host and gives the grants the
  // experience asks for. A page with no host profile is given none (10.5, D31); a packed page never previews.
  if (host == null && previewHost) host = { preview: true, grants: structuredClone(loaded.experience.doc.grants || {}) };
  // For tests: start at a named scene instead of the story's start.
  if (start) {
    const exp = loaded.experience;
    loaded = { ...loaded, experience: { ...exp, doc: { ...exp.doc, story: { ...exp.doc.story, start } } } };
  }
  // Stored values (5.1.2): sessionStorage and localStorage of this page, when the browser allows them.
  // Reading the store itself throws in a sandboxed frame without allow-same-origin (the frame link, 10.6): no store.
  const wrap = (get) => { try { const s = get(); s.setItem('hsvg-probe', '1'); s.removeItem('hsvg-probe'); return { get: (k) => s.getItem(k), set: (k, v) => s.setItem(k, v), remove: (k) => s.removeItem(k) }; } catch { return null; } };
  const storage = { session: wrap(() => window.sessionStorage), saved: wrap(() => window.localStorage), page: window.location.pathname, partition };
  const measures = members ? packageMeasures(members, experienceResources(loaded.experience)) : undefined; // host budget rules (A10.3)
  // A capability or module that cannot install (E-MODULE-REVIEW, E-NEEDS-MISSING and the rest) faults the engine as
  // it is made. The page then stops with that code and message, as any other fault does (9.2), and plays nothing.
  let player = null;
  let made = null;
  // The page's wall clock gives the ambient now (5.5); a test or replay sets a fixed epochMs instead.
  try { player = new Player(loaded.experience, { capabilities, storage, host, options, measures, modules, wallClock: () => Date.now() }); } catch (e) { if (!e?.code) throw e; made = e; }
  const state = { player, namespace, drawing: null, scene: null, loaded, errors: [], stopped: null };
  // A fault from a control, a timer, a marker, an effect or the start stops the experience with a visible message
  // naming the code and the owner's address (9.2). Every path (a real press, a key, the test hook, the clock) comes
  // here. After it, the clock stops and input is ignored.
  let running = true;
  let linkRefused = null; // set once the host API exists (linkWithoutHost)
  const halt = (f, source) => {
    const code = f?.code || null;
    const address = f?.address || null;
    const message = String(f?.message ?? f);
    state.errors.push(message);
    if (state.stopped) return;
    linkRefused?.(f);
    state.stopped = { code, address, message, source };
    running = false;
    player?.stop?.(f, source); // the engine's one stopped state: no later transaction, clock tick or host call
    onError?.({ code, address, message, source });
    try { state.audio?.destroy(); } catch { /* nothing sounds */ } // audio, music and spoken recordings stop for good
    const box = document.createElement('div');
    box.setAttribute('role', 'alert');
    box.setAttribute('data-hsvg-fault', code || 'fault');
    box.setAttribute('style', 'position:absolute;left:0;right:0;bottom:0;padding:12px 16px;background:#7a1010;color:#fff;font:15px/1.4 system-ui,sans-serif;z-index:10');
    box.textContent = `This experience stopped: ${code || 'fault'} in ${address || 'the experience'}. ${message}`;
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.appendChild(box);
  };
  // r: a transaction result. A fault stops (halt); returns r.
  state.fault = (r, source = 'engine') => { if (r && r.ok === false) halt(r.fault, source); return r; };
  // Stopped before any scene was entered: the message shows, and nothing is drawn, run or listened to. The test hooks
  // and the host API do nothing (mount throws the fault).
  const stoppedAtStart = () => {
    state.advance = () => {};
    state.press = () => ({ ok: false, fault: state.stopped, ignored: 'stopped' });
    state.relayout = () => {};
    return state;
  };
  if (made) { halt(made, 'start'); return stoppedAtStart(); }
  // The engine stops itself on a fatal fault (9.2), from any path (a held outcome, a deadline, a capability): the page
  // shows it at once. A person's control is the page's `control` source.
  player.onStop = (f, source) => halt(f, source === 'person' ? 'control' : source);
  // Player-side deliver failures (a listener that throws) are reported until the host API takes them (9.2).
  player.onDeliveryError = (d) => { if (onError) onError(d); else console.error(d); };
  // A sound the browser cannot fetch or decode (6.10): each file is reported once through the host error callback,
  // and the first one once to the console. The spec has no code for it yet (code null; see the W-E report).
  let soundWarned = false;
  const soundFailed = (path, err) => {
    const d = { code: 'W-SOUND-UNPLAYABLE', message: `this browser cannot play the sound ${path}${err?.message ? ` (${err.message})` : ''}`, source: 'audio', path };
    state.errors.push(d.message);
    if (!soundWarned) { soundWarned = true; console.warn(`hsvg: ${d.message}`); }
    onError?.(d);
  };
  state.audio = attachAudio(player, window, { assetsUrl, assets, onFail: soundFailed });
  // Reduced motion (5.5, 6.7): the person's prefers-reduced-motion is the ambient reducedMotion from the start.
  const motionQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  if (motionQuery) { player.state.ambient.motionSystem = motionQuery.matches === true; player.state.ambient.reducedMotion = motionQuery.matches === true || player.state.ambient.motionChosen === true; }
  // The ambient size (5.5): the player box and its active shape, written before the start and on every resize.
  const sizeNow = () => { const b = container.getBoundingClientRect(); const sp = { width: b.width, height: b.height }; return { ...sp, shape: activeShape({ ...sp, direction: directionOf(player.exp.doc, player.state.ambient?.language) }, shapeMapsOf(null, player.exp.doc)) }; };
  // A person's time limits (10.13) from the start, so the first scene's timers have them too: 0 (off) or 1..10.
  if (timeLimits !== null && timeLimits !== undefined) {
    const bad = checkSetting('timeLimits', timeLimits);
    if (bad) { halt({ code: bad[0], address: 'experience', message: `timeLimits: ${bad[1]}` }, 'start'); return stoppedAtStart(); }
    player.state.ambient.timeLimits = timeLimits;
  }
  player.setSize(sizeNow());
  state.fault(player.start(), 'start');
  // A fault while the start scene was made (a missing module or capability, 9.2) leaves no scene to draw.
  if (state.stopped && !player.scene) { state.host = hostApi(player, { onError, test }); return stoppedAtStart(); }

  // Layouts (7.3, 7.4), chosen by what each declares (src/layout.mjs): a scene or a shell by the output size (the
  // container's box in CSS pixels), a scene in a shell by the stage slot's box, a use by its slot's box (drawing.mjs).
  // state.layouts holds the layout shown now for each address, so a resize keeps it while it still applies.
  // "Fits": nothing is measured before a layout is drawn, so a layout counts as fitting until a text fit (7.6) in the
  // block's own bindings comes out incomplete; then that layout does not fit at this space and the next that applies
  // is tried (state.unfit; cleared when the space or the scene changes).
  state.layouts = {};
  state.unfit = {};
  // Layouts that fit only after give-way steps (8.4): every layout that applies is tried unreduced first, and the steps
  // run on the first one only when none fits unreduced (7.1). state.reduced: address -> Set of layout ids.
  state.reduced = {};
  state.choices = {};
  // True size (7.3, D3): an experience made only in exact sizes, shown as the whole page, is drawn at the size nearest
  // the window, one drawing unit per CSS pixel, centred; scaled down only when the window is smaller, never up.
  // state.trueSize: {width, height, scale} while it applies.
  // With a shell, true size applies to the stage only: the shell keeps its own size around it (B7, batch 2).
  const allSizes = wholePage ? trueSizes(player.exp.doc) : null;
  const sizes = player.shellId ? null : allSizes;
  const stageSizes = player.shellId ? allSizes : null;
  // The space a scene in the stage chooses its layout by: its true size when it has one, else the stage's box.
  const stageChoice = (st) => { if (!stageSizes || !st) return st; const t = nearestSize(stageSizes, st); return { width: t.width, height: t.height }; };
  const winSpace = () => { const b = container.getBoundingClientRect(); return { width: b.width, height: b.height }; };
  const outSpace = () => {
    const win = winSpace();
    if (!sizes) return win;
    state.trueSize = nearestSize(sizes, win);
    return { width: state.trueSize.width, height: state.trueSize.height };
  };
  const placeTrue = (svg) => {
    const t = state.trueSize;
    if (!t || !svg) return;
    svg.setAttribute('width', String(t.width * t.scale));
    svg.setAttribute('height', String(t.height * t.scale));
    svg.setAttribute('data-player-true-size', `${t.width}x${t.height}`);
    Object.assign(svg.style, { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' });
  };
  if (sizes && getComputedStyle(container).position === 'static') container.style.position = 'relative';
  const spaceKey = (sp) => `${Math.round(sp.width)}x${Math.round(sp.height)}`;
  // Picking by input (7.1): what the input selectors pick now, from the mounted blocks' axes (layout.mjs).
  const readPicks = () => {
    const blocks = Object.keys(player.state.blocks).map(a => [a, player.def(a)]).filter(([, d]) => d?.axes);
    return inputPicks(blocks, (a, n) => player.read(a, n));
  };
  state.picks = readPicks();
  // A language picked by input applies from boot, as on a change (B7, batch 2): one transaction before the first
  // drawing, so every block hears changed:language and the first frame is in that language.
  const bootLanguage = state.picks.experience.language;
  if (bootLanguage && bootLanguage !== player.state.ambient.language && !state.picks.bad.length) {
    const r = player.transaction('host', () => { player.state.ambient.language = bootLanguage; player.queueAll('changed:language'); });
    player.afterCommit?.();
    state.fault(r, 'start');
    if (state.stopped) { state.host = hostApi(player, { onError, test }); return stoppedAtStart(); }
    state.picks = readPicks();
  }
  const choose = (memory, address, block, space) => {
    const sp = space && { ...space, direction: directionOf(player.exp.doc, player.state.ambient?.language) };
    const maps = shapeMapsOf(block?.doc, player.exp.doc);
    const layouts = narrowLayouts(block?.doc?.layouts, player.exp.doc, block?.doc); // an inner shape entry narrows (7.1)
    const input = pickedLayout(layouts, picksFor(state.picks, address), maps);
    const c = chooseFrame(layouts, sp, { input, current: memory[address] ?? null, unfit: state.unfit[address], reduced: state.reduced[address], aspectOf: aspectsOf(block), maps });
    if (c.id != null) memory[address] = c.id;
    state.choices[address] = c;
    return c.id;
  };
  const shellId = player.shellId;
  const blockOf = (address) => (address === shellId ? player.exp.shell : player.exp.scenes[address]);
  // A whole drawing for the space: the shell and its stage's scene, or the scene alone. memory: address -> layout.
  const build = (memory, space) => {
    const d = new Drawing(player, { namespace, layouts: memory, picks: state.picks, theme: state.picks.experience.theme, stageSizes });
    if (shellId) {
      d.mountShell(shellId, choose(memory, shellId, blockOf(shellId), space), space);
      const st = d.stageSpace();
      d.mountStage(player.scene, choose(memory, player.scene, blockOf(player.scene), stageChoice(st) || space), null, st);
    } else d.mountScene(player.scene, choose(memory, player.scene, blockOf(player.scene), space), space);
    return d;
  };
  const attach = (d) => {
    const svg = d.toDom(document);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    placeTrue(svg);
    // Replace only the drawing: the shell's widget layer and a fault message stay.
    const old = state.drawing?.root?.dom;
    if (old && old.parentNode === container) old.replaceWith(svg); else container.replaceChildren(svg, ...container.querySelectorAll('[data-hsvg-fault],[data-hsvg-announce]'));
    state.drawing = d;
  };
  // A new scene forgets the old scene's layouts (only the shell's stay current).
  const forgetScene = () => {
    for (const k of Object.keys(state.layouts)) if (!shellId || (k !== shellId && !k.startsWith(shellId + '/'))) delete state.layouts[k];
    for (const k of Object.keys(state.unfit)) if (k !== shellId) delete state.unfit[k];
    for (const k of Object.keys(state.reduced)) if (k !== shellId) delete state.reduced[k];
  };
  let lastSpace = null;
  const show = () => {
    const space = outSpace();
    lastSpace = state.space = spaceKey(winSpace());
    const changed = player.scene !== state.scene;
    if (changed) forgetScene();
    const slide = changed && state.scene !== null ? slideFor() : null;
    endSlide();
    const leaving = slide ? (shellId ? state.drawing?.stage?.holder?.dom?.firstElementChild : state.drawing?.root?.dom) : null;
    if (shellId && state.drawing) {
      // The shell is drawn once; a new scene only replaces what its stage slot holds (10.1).
      const d = state.drawing;
      const st = d.stageSpace();
      d.mountStage(player.scene, choose(state.layouts, player.scene, blockOf(player.scene), stageChoice(st) || space), document, st);
    } else attach(build(state.layouts, space));
    if (slide && leaving) startSlide(slide, leaving);
    const entered = changed && state.scene !== null;
    state.scene = player.scene;
    if (entered) announce(titleOf(state.drawing?.frames[player.scene]?.root));
    paint();
  };
  // ---------- scene changes announced (10.13) ----------
  // When a link enters a new scene, its drawing's <title> is read once in a polite live region. The first scene is
  // not announced: the page itself is read then. The same title twice in a row is still read (a no-break space
  // makes the text differ). state.announced: the last text, for tests.
  const titleOf = (root) => {
    const t = root?.children?.find(c => c.name === 'title');
    const text = (n) => (n.name ? n.children.map(text).join('') : n.text || '');
    return t ? text(t).replace(/\s+/g, ' ').trim() : '';
  };
  const announcer = document.createElement('div');
  announcer.setAttribute('data-hsvg-announce', '');
  announcer.setAttribute('role', 'status');
  announcer.setAttribute('aria-live', 'polite');
  announcer.setAttribute('style', 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0');
  const announce = (text) => {
    if (!text) return;
    if (!announcer.isConnected) container.appendChild(announcer);
    announcer.textContent = announcer.textContent === text ? `${text}\u00a0` : text;
    state.announced = text;
  };
  state.announce = announce; // the input layer names the drop a held item is over (5.11)
  // ---------- the slide and fade link transitions (3.2) ----------
  // A link with transition fade fades the old scene out over the new one, which fades in, in place. A link with
  // transition slide moves the new scene in from the end side (the right in a left-to-right language) and the old
  // one out, over transitionMs on the engine's clock; slideFrom "start" reverses it. Under reduced motion every
  // transition is a cut, a fade too (10.13). The leaving scene is a still copy: it takes no input (inert), is hidden
  // from assistive technology and runs nothing; the new scene plays and takes input from the start. In a shell, both
  // move inside the stage slot's box, clipped to it.
  // state.slide: {link, kind, from, atMs, ms, progress} while one runs (for tests).
  player.on(({ outputs }) => { for (const o of outputs) if (o.name === 'entered' && o.slot === 'stage') state.enteredBy = { link: o.link, atMs: player.state.now }; });
  const slideFor = () => {
    const by = state.enteredBy;
    const l = by && player.links.find(x => x.id === by.link);
    if ((l?.transition !== 'slide' && l?.transition !== 'fade') || !(l.transitionMs > 0) || player.state.ambient.reducedMotion === true) return null;
    // fade (3.2): the old scene fades out over the new one, which fades in, in place.
    if (l.transition === 'fade') return { kind: 'fade', link: l.id, atMs: by.atMs, ms: l.transitionMs };
    const rtl = directionOf(player.exp.doc, player.state.ambient?.language) === 'rtl';
    // +1: the new scene comes in from the right.
    const sign = (rtl ? -1 : 1) * (l.slideFrom === 'start' ? -1 : 1);
    return { kind: 'slide', link: l.id, from: l.slideFrom === 'start' ? 'start' : 'end', sign, atMs: by.atMs, ms: l.transitionMs };
  };
  const SVGNS = 'http://www.w3.org/2000/svg';
  const startSlide = (slide, leaving) => {
    leaving.setAttribute('aria-hidden', 'true');
    leaving.setAttribute('inert', '');
    leaving.setAttribute('data-player-leaving', slide.link);
    leaving.style.pointerEvents = 'none';
    for (const el of leaving.querySelectorAll('[tabindex]')) el.setAttribute('tabindex', '-1');
    if (shellId) {
      const d = state.drawing; const holder = d.stage.holder.dom; const b = d.stage.box;
      const entering = holder.firstElementChild;
      const clipId = `${namespace}hsvg-slide-${shellId}`;
      const clip = document.createElementNS(SVGNS, 'clipPath'); clip.setAttribute('id', clipId);
      const r = document.createElementNS(SVGNS, 'rect');
      for (const [k, v] of Object.entries({ x: b.x, y: b.y, width: b.width, height: b.height })) r.setAttribute(k, String(v));
      clip.appendChild(r);
      const out = document.createElementNS(SVGNS, 'g'); out.appendChild(leaving);
      const inn = document.createElementNS(SVGNS, 'g'); if (entering) inn.appendChild(entering);
      holder.replaceChildren(clip, out, inn);
      holder.setAttribute('clip-path', `url(#${clipId})`);
      slide.place = slide.kind === 'fade'
        ? (p) => { out.setAttribute('opacity', String(1 - p)); inn.setAttribute('opacity', String(p)); }
        : (p) => { out.setAttribute('transform', `translate(${-slide.sign * p * b.width} 0)`); inn.setAttribute('transform', `translate(${slide.sign * (1 - p) * b.width} 0)`); };
      if (slide.kind === 'fade') holder.replaceChildren(clip, inn, out); // the leaving copy fades out on top
      slide.done = () => { holder.removeAttribute('clip-path'); if (entering && entering.parentNode === inn) holder.replaceChildren(entering); else { clip.remove(); out.remove(); } };
    } else {
      const entering = state.drawing.root.dom;
      if (getComputedStyle(container).position === 'static') { slide.position = container.style.position; container.style.position = 'relative'; }
      slide.overflow = container.style.overflow;
      container.style.overflow = 'hidden';
      Object.assign(leaving.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%' });
      container.insertBefore(leaving, entering);
      if (slide.kind === 'fade') container.insertBefore(entering, leaving); // the leaving copy fades out on top
      slide.place = slide.kind === 'fade'
        ? (p) => { leaving.style.opacity = String(1 - p); entering.style.opacity = p >= 1 ? '' : String(p); }
        : (p) => { leaving.style.transform = `translateX(${-slide.sign * p * 100}%)`; entering.style.transform = p >= 1 ? '' : `translateX(${slide.sign * (1 - p) * 100}%)`; };
      slide.done = () => { leaving.remove(); entering.style.transform = ''; entering.style.opacity = ''; container.style.overflow = slide.overflow; if (slide.position !== undefined) container.style.position = slide.position; };
    }
    state.slide = slide;
    stepSlide();
  };
  const stepSlide = () => {
    const sl = state.slide;
    if (!sl) return;
    sl.progress = Math.max(0, Math.min(1, (player.state.now - sl.atMs) / sl.ms));
    sl.place(sl.progress);
    if (sl.progress >= 1) endSlide();
  };
  const endSlide = () => { const sl = state.slide; if (!sl) return; state.slide = null; sl.place(1); sl.done(); state.slid = { link: sl.link, from: sl.from, kind: sl.kind }; };
  // The layouts each frame of a drawing shows, and the boxes of each plan solved while playing (7.5): a plan solved
  // again for a new space draws again even when its layout stays.
  const shown = (d) => JSON.stringify(Object.entries(d.frames).map(([a, f]) => [a, f.layout ?? null, f.plan?.key ?? null]).sort());
  // Draws again for the space when a choice changes. Values, machine states, the visit stack and clip time live in
  // the player and are kept; focus goes back to the control of the same id (7.3).
  // rebuild: draw again even when every layout stays (a theme picked by input).
  const relayout = (force = false, rebuild = false) => {
    if (state.destroyed || state.stopped || !state.drawing) return;
    const win = winSpace();
    if (!(win.width > 0 && win.height > 0)) return;
    const space = outSpace();
    placeTrue(state.drawing.root?.dom);
    const key = spaceKey(win);
    if (key !== lastSpace) { state.unfit = {}; state.reduced = {}; lastSpace = state.space = key; } else if (!force) return;
    const memory = { ...state.layouts };
    const next = build(memory, space);
    if (!rebuild && shown(next) === shown(state.drawing)) return;
    const focused = container.contains(document.activeElement) ? document.activeElement.id : null;
    endSlide(); // a new drawing ends a slide: the new scene shows at once
    state.layouts = memory;
    attach(next);
    paint();
    state.input?.sync(true);
    state.widgets?.sync();
    if (focused) document.getElementById(focused)?.focus({ preventScroll: true });
  };
  state.relayout = relayout;
  // What the painted drawing says about the layouts chosen (learnFits); choose again when it says something new.
  const checkFits = () => {
    const d = state.drawing;
    const { again, forgot } = learnFits(d, [player.scene, shellId], state);
    if (!again) return;
    // The new drawing is checked again at once; so is this one when the uses that forgot their layout chose the same
    // again (the sets only grow and a forgotten layout stays forgotten, so this ends).
    relayout(true);
    if (state.drawing !== d || forgot.length) checkFits();
  };
  // Bindings repaint with the binding phase's budget of formula steps (9.2 step 6, 9.8); going over it stops.
  // changed: paint only the blocks the transactions since the last paint changed (and those that read time); else
  // everything (a new drawing, a relayout).
  let painted = { revision: -1, now: -1 };
  const paint = (changed = false) => {
    const d = state.drawing;
    const had = d.faults.length;
    const dirty = player.takeDirty();
    painted = { revision: player.state.revision, now: player.state.now };
    player.bindingPhase(() => d.paint(changed ? dirty : null));
    stepSlide();
    const over = d.faults.slice(had).find(f => f.code === 'E-EVENT-LOOP');
    if (over) halt(over, 'binding');
    if (!state.stopped) writeLayout(d);
    if (!checking) { checking = true; try { checkPicks() || checkResized() || checkFits(); } finally { checking = false; } }
  };
  // A size binding changed a slot or region's box (6.8, D1): what is placed in it chooses again (its frame, its
  // layout), with every value kept. The box itself has moved already.
  const checkResized = () => {
    const d = state.drawing;
    if (!d?.resized?.length) return false;
    state.resizedAt = d.resized.map(r => ({ ...r }));
    state.unfit = {}; state.reduced = {};
    relayout(true);
    state.widgets?.sync();
    return true;
  };
  // An input selector's value changed (7.1): pick again at once. A language pick sets the ambient language (one
  // transaction: every block hears changed:language); any change draws again. A pick outside the axis's options stops
  // with E-AXIS-INPUT.
  const checkPicks = () => {
    const next = readPicks();
    if (next.bad.length) { const b = next.bad[0]; halt({ code: 'E-AXIS-INPUT', address: b.address, message: `axis ${b.id}: ${JSON.stringify(b.value)} is not one of its options (${b.options.join(', ')})` }, 'binding'); return true; }
    if (JSON.stringify(next) === JSON.stringify(state.picks)) return false;
    state.picks = next;
    const lang = next.experience.language;
    if (lang && lang !== player.state.ambient.language) {
      const r = player.transaction('host', () => { player.state.ambient.language = lang; player.queueAll('changed:language'); });
      player.afterCommit?.();
      state.fault(r, 'host');
      if (state.stopped) return true;
    }
    relayout(true, true);
    return true;
  };
  let checking = false;
  // The ambient `layout` value (B7, batch 2): each block on screen with its frame, tier and steps, read-only. The page
  // writes it after a paint; when it changed, the drawing paints once more so a binding that reads it is current.
  let layoutKey = null; let relaying = false;
  const writeLayout = (d) => {
    const v = d.layoutValue();
    const key = JSON.stringify(v);
    if (key === layoutKey) return;
    layoutKey = key;
    player.state.ambient.layout = Object.freeze(v);
    if (relaying) return;
    relaying = true;
    try { player.bindingPhase(() => d.paint()); } finally { relaying = false; }
  };
  show();

  // Controls: pointer and keyboard (5.11), with their roles, tab stops and names.
  const input = attachInput(player, state, container, window);
  // A changed list of a repeated use (4.5, player.state.lists) draws the uses again in their new slots; focus stays on
  // the control of the same id.
  const redrawLists = () => {
    const focused = container.contains(document.activeElement) ? document.activeElement.id : null;
    attach(build(state.layouts, outSpace()));
    paint();
    input.sync(true);
    if (focused) document.getElementById(focused)?.focus({ preventScroll: true });
  };
  state.lists = player.state.lists || 0;
  const after = () => {
    if (state.destroyed || state.stopped) return; // a stopped page is never drawn again (9.2)
    const lists = player.state.lists || 0;
    // Paint only when something changed: a committed transaction (also while paused), or engine time moved while a
    // block reads time (a clip, particles, physics, a mouth, `elapsed`). Nothing changed: nothing is painted.
    if (player.scene !== state.scene) { show(); input.sync(true); } else if (lists !== state.lists) redrawLists();
    else if (player.state.revision !== painted.revision || state.slide || (state.drawing?.live?.size && player.state.now !== painted.now) || player.mouthLooks?.length) { paint(true); input.sync(); }
    state.lists = lists;
    for (const part of Object.values(state.caps || {})) part.sync?.();
  };
  state.after = after;
  // A held slider's handle follows the pointer between transactions (5.11): paint the drawing's hold now.
  state.repaint = () => { if (!state.destroyed && !state.stopped && state.drawing) paint(true); };
  state.input = input;
  input.sync(true);
  // The page parts of the installed capabilities (src/capabilities.mjs): the shell's HTML widgets over their slots
  // (A6.1), the snapshot's PNG. Each is drawn at once, not on the first clock tick.
  state.caps = player.caps.attach({ player, state, container, win: window, options: { widgets, onError, assets, assetsUrl, test } });
  state.widgets = state.caps.shell || null;
  for (const part of Object.values(state.caps)) part.sync?.();
  // Captions of spoken lines (6.11) are the lines capability's page part (captions-web.mjs).
  state.captions = state.caps.lines || null;
  // The host API; a restart shows the new run's scene.
  state.host = hostApi(player, { onError, test, onRestart: () => { state.scene = null; after(); } });
  linkRefused = linkWithoutHost(state, container, host);
  // The ladder's read-out (8.4), for a studio: per block address, its tier, the steps its rules used and its texts
  // ({binding, field, text, px, lines, outcome}). A copy; {} when no block needs fit.
  state.ladder = () => structuredClone(state.drawing?.ladder ?? {});
  state.host.ladder = state.ladder;
  let last = null;
  const tick = (t) => {
    if (!running) return;
    if (last !== null) state.audio.advance(Math.min(100, t - last));
    if (last !== null && !manualClock && !state.host.paused) {
      const results = player.advance(Math.min(100, Math.round(t - last)));
      for (const r of results) state.fault(r, 'timer');
    }
    // after() paints only what changed, so it runs every frame: a host change committed while paused or under a
    // manual clock is painted too.
    if (last !== null && running && !state.stopped) after();
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  // A resize (or a rotated phone) chooses again (7.3); the current layout stays while it still applies.
  // The ambient size follows (5.5): a new box or shape is one host transaction with changed:size, then a paint.
  const writeSize = () => {
    if (state.destroyed || state.stopped) return;
    const r = player.setSize(sizeNow());
    if (!r) return;
    state.fault(r, 'host');
    if (!state.stopped) after();
  };
  state.writeSize = writeSize;
  if (typeof ResizeObserver === 'function') { state.resizer = new ResizeObserver(() => { relayout(); writeSize(); }); state.resizer.observe(container); }
  // A change of the person's reduced-motion preference: one transaction, and every block hears changed:reducedMotion.
  const motionChanged = (ev) => {
    if (state.destroyed || state.stopped) return;
    const on = ev.matches === true;
    if (player.state.ambient.motionSystem === on) return;
    const r = player.transaction('host', () => player.motionPreference(on));
    player.afterCommit?.();
    state.fault(r, 'host');
    if (!state.stopped) after();
  };
  motionQuery?.addEventListener?.('change', motionChanged);
  // A hidden page is a pause reason (3.10): the stage's scene hears paused and resumed.
  const visibility = () => { if (state.destroyed) return; player.setPause('hidden', document.hidden); after(); };
  document.addEventListener('visibilitychange', visibility);
  // One cleanup list per mount (10.6): destroy runs it once, last in first out. Every page part (audio, input, the
  // capabilities' parts: captions, widgets, media, page) gives its own destroy.
  const cleanups = [
    () => state.resizer?.disconnect(),
    () => motionQuery?.removeEventListener?.('change', motionChanged),
    () => document.removeEventListener('visibilitychange', visibility),
    () => state.audio.destroy(),
    () => input.destroy(),
    ...Object.values(state.caps || {}).map(part => () => part.destroy?.()),
  ];
  const destroy = state.host.destroy;
  state.host.destroy = () => {
    if (state.destroyed) return;
    running = false; state.destroyed = true;
    for (const c of cleanups.splice(0).reverse()) { try { c(); } catch (e) { onError?.({ code: e?.code || null, message: String(e?.message ?? e), source: 'destroy' }); } }
    destroy();
    container.replaceChildren();
  };
  // For tests: advance a manual clock, press a control by id.
  // Both follow the same fault path as the real clock and a real press; after a stop they do nothing.
  state.advance = (ms) => { if (state.stopped) return; const rs = player.advance(ms); for (const r of rs) state.fault(r, 'timer'); if (!state.stopped) after(); };
  state.press = (addr, cid, arg) => { if (state.stopped) return { ok: false, fault: state.stopped, ignored: 'stopped' }; const r = player.activate(addr, cid, arg); state.fault(r, 'control'); if (!state.stopped) after(); return r; };
  // For tests: play or stop a clip as the play and stop actions do (5.15), in one transaction, then paint. The address
  // is a block's (a scene, a use); with none, the scene on the stage. A clip unknown there is the action's own fault.
  const clipHook = (word) => (addr, clip) => {
    if (state.stopped) return { ok: false, fault: state.stopped, ignored: 'stopped' };
    const r = player.transaction('test', () => player.runActions(addr || player.scene, [{ [word]: clip }], `test ${word}`));
    state.fault(r, 'test');
    if (!state.stopped) after();
    return r;
  };
  state.play = clipHook('play');
  state.stop = clipHook('stop');
  // For tests: each part's painted box in page pixels from the stage's top left, as drawn now (clips, glides and
  // bindings applied). Keyed by the part's id in the page without the player's mount prefix (<scene>__<id>); `shown`
  // is false for a part that is not displayed, is hidden or has no size.
  state.boxes = () => {
    const o = container.getBoundingClientRect(); const out = {};
    for (const el of container.querySelectorAll('[data-hsvg-kind="part"][id]')) {
      const b = el.getBoundingClientRect(); const css = window.getComputedStyle(el);
      out[el.id.slice(namespace.length)] = { x: b.left - o.left, y: b.top - o.top, width: b.width, height: b.height, shown: b.width > 0 && b.height > 0 && css.display !== 'none' && css.visibility !== 'hidden' };
    }
    return out;
  };
  return state;
}
