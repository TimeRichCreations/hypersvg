// The explorer: walks a packed page from the start by keyboard alone, within a step budget and a time budget, and
// records the scenes, endings and controls it reached. Then a pointer pass uses each control it reached by the
// pointer, and the first path to each ending is recorded and replayed (9.6).
//
// What it is: bounded observation. Each path starts a fresh page (empty storage) and plays its inputs from the
// start. A state is the scene, every block's values and inputs, and the usable controls with their names. Hidden
// timers, motion and capability state are not part of it, so a drained frontier is not proof that nothing else is
// reachable.
import { openSession, defaultStart, record, replay } from './browser.mjs';
import { canonical, digestOf, controlKey, identity, validateGuide } from './format.mjs';

export const defaults = Object.freeze({ stepBudget: 150, timeBudgetMs: 120000, pointerBudget: 40, waitMs: 3000, settleMs: 500 });

// The keyboard inputs that use one control from a state at time t: one candidate per option and per drop.
export function candidatesFor(control, t, settleMs) {
  const c = identity(control);
  const settle = { t: t + settleMs, act: 'advance' };
  const act = (extra) => [{ t, act: 'activate', control: c, via: 'keyboard', ...extra }, settle];
  switch (control.kind) {
    case 'button': case 'toggle': case 'snapshot': case 'choice': case 'widget-press': case 'widget-option': return [act({})];
    case 'widget-check': return [act({ key: 'Space' })];
    case 'slider': case 'dial': case 'widget-slider': return [act({ key: control.role === 'spinbutton' ? 'ArrowUp' : 'ArrowRight' })];
    case 'drag': return (control.drops || []).map(drop => [{ t, act: 'drag', control: c, drop, via: 'keyboard' }, settle]);
    default: return null; // text entry and unknown kinds are not explored (listed as failures)
  }
}
// The inputs of one guide step (format.mjs validateGuide) at time t, given the controls shown now. Throws with the
// reason when the step cannot be made: the control is not shown, or not usable, or the drop is not shown.
export function guideInputs(step, controls, t, settleMs) {
  const settle = { t: t + settleMs, act: 'advance' };
  if (step.wait !== undefined) return [{ t: t + step.wait, act: 'advance' }];
  if (step.use === undefined) return [{ t, act: 'key', key: step.key }, settle];
  const c = controls.find(x => controlKey(x) === step.use);
  if (step.optional && !c?.enabled) return [];
  if (!c) throw new Error(`${step.use} is not shown`);
  if (!c.enabled) throw new Error(`${step.use} is not usable`);
  if (step.key) return [{ t, act: 'activate', control: identity(c), via: 'keyboard', key: step.key }, settle];
  if (c.kind === 'drag') {
    if (!(c.drops || []).includes(step.drop)) throw new Error(`${step.use}: drop ${step.drop} is not shown`);
    return [{ t, act: 'drag', control: identity(c), drop: step.drop, via: 'keyboard' }, settle];
  }
  const list = candidatesFor(c, t, settleMs);
  if (!list) throw new Error(`${step.use}: ${c.kind} controls are not played`);
  return list[0];
}

// The same use by pointer: a click at the control's centre, or a drag to the drop's centre.
export function pointerFor(inputs) {
  return inputs.map(i => (i.act === 'activate' ? { t: i.t, act: 'activate', control: i.control, via: 'pointer' } : i.act === 'drag' ? { ...i, via: 'pointer' } : i));
}

// The state an observation stands for. Time is not part of it; the deadlines still to come (time left) are, so
// waiting on a timed link is a new state; so are physics bodies still moving (coarse position).
export function stateKey(snap, controls) {
  return digestOf({ scene: snap.scene, values: snap.values, controls: shown(controls), pending: snap.pending || [], moving: snap.moving || [] });
}
const shown = (controls) => controls.map(c => [controlKey(c), c.name, c.enabled, c.state ?? null]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
// A use has an effect when an output was heard, or the scene, a value, or what the controls show changed.
export const effectOf = (before, after) => after.outputs.length > 0 || after.scene !== before.scene || canonical(after.values) !== canonical(before.values)
  || canonical(shown(before.controls || [])) !== canonical(shown(after.controls || []));

// Which state to expand next: a state in a scene not yet expanded first; then, turn about, the newest (deep paths:
// a sort or a quiz needs several right moves in a row) and the oldest (short paths: every scene's first controls).
export function pickNext(states, expanded, turn) {
  const open = states.filter(s => !expanded.has(s.id) && !s.error);
  if (!open.length) return null;
  const doneScenes = new Set(states.filter(s => expanded.has(s.id)).map(s => s.scene));
  const fresh = open.find(s => !doneScenes.has(s.scene));
  if (fresh) return fresh;
  return turn % 2 ? open[open.length - 1] : open[0];
}

// Declared controls of the scenes and the shell (5.11), from the loaded experience in the page; component controls
// are found while playing.
async function declared(session) {
  if (session.startError) return [];
  return session.page.evaluate(() => {
    const p = window.hsvg.player; const out = [];
    const add = (addr, controls) => {
      for (const [cid, c] of Object.entries(controls || {})) {
        if (c.kind === 'choice') for (const option of Object.keys(c.options || {})) out.push({ addr, cid, option, kind: c.kind });
        else out.push({ addr, cid, kind: c.kind });
      }
    };
    for (const [id, s] of Object.entries(p.exp.scenes || {})) add(id, s.doc?.controls);
    if (p.shellId) add(p.shellId, p.exp.shell?.doc?.controls);
    return out;
  });
}

export async function explore(browser, build, opts = {}) {
  const o = { ...defaults, ...opts };
  const start = o.start || defaultStart;
  const ends = build.story?.ends || [];
  const began = Date.now();
  // o.progress(line): told when each pass starts and every progressMs while the keyboard pass runs, so a long run
  // is not silent (R2 newcomer F5). Optional.
  const say = typeof o.progress === 'function' ? o.progress : () => {};
  let saidAt = began;
  const tick = (what) => { const now = Date.now(); if (now - saidAt >= (o.progressMs ?? 10000)) { saidAt = now; say(what()); } };
  const states = []; const edges = []; const failures = []; const network = []; const errors = [];
  const byKey = new Map(); const inventory = new Map(); const scenes = new Set(); const witnesses = new Map();
  const measures = { elements: 0, blocks: 0, depth: 0, timers: 0, savedBytes: 0, sessionBytes: 0 };
  const sceneElements = {};
  const keep = (session) => { for (const n of session.network) if (!network.some(m => m.url === n.url && m.kind === n.kind)) network.push(n); };
  const measure = (snap) => {
    if (!snap.measures) return;
    for (const k of Object.keys(measures)) if (snap.measures[k] !== null && snap.measures[k] > measures[k]) measures[k] = snap.measures[k];
    sceneElements[snap.scene] = Math.max(sceneElements[snap.scene] || 0, snap.measures.elements);
  };
  const entry = (c, declaredKind) => {
    const k = controlKey(c);
    if (!inventory.has(k)) inventory.set(k, { key: k, role: c.role ?? null, addr: c.addr ?? null, cid: c.cid ?? null, option: c.option ?? null, widget: !!c.widget, kind: c.kind || declaredKind, names: [], reached: false, enabled: false, keyboard: null, pointer: null });
    return inventory.get(k);
  };
  function observe(snap, controls, acts, endedHeard) {
    for (const s of snap.visited) scenes.add(s);
    if (snap.scene) scenes.add(snap.scene);
    measure(snap);
    if (snap.error && !errors.includes(snap.error)) errors.push(snap.error);
    for (const c of controls) {
      const it = entry(c);
      it.reached = true; it.enabled ||= c.enabled; it.role ??= c.role;
      if (c.name && !it.names.includes(c.name)) it.names.push(c.name);
    }
    const key = stateKey(snap, controls);
    if (!byKey.has(key)) {
      const st = { id: states.length, scene: snap.scene, time: snap.time, values: snap.values, controls, acts, error: snap.error };
      byKey.set(key, st.id); states.push(st);
      const ended = ends.includes(snap.scene) || endedHeard;
      if (ended && snap.scene && !witnesses.has(snap.scene) && !snap.error) witnesses.set(snap.scene, acts);
    }
    return states[byKey.get(key)];
  }

  // The start.
  let session = await openSession(browser, build, start);
  let startError = session.startError;
  try {
    for (const d of await declared(session)) entry(d, d.kind);
    const snap = await session.snapshot('mount');
    observe(snap, await session.controls(), [], snap.outputs.some(x => x.name === 'ended'));
    keep(session);
  } finally { await session.close(); }

  // The guide (optional): each area played from the start, one fresh page each. Every input is a keyboard input, so
  // what it reaches counts as reached by keyboard; each state on the way joins the frontier of the search below.
  const guided = [];
  const guide = o.guide ? validateGuide(o.guide) : null;
  for (const area of startError ? [] : guide?.areas || []) {
    const row = { area: area.name, inputs: 0, scenes: [], failed: null };
    guided.push(row);
    session = await openSession(browser, build, start);
    try {
      let snap = await session.snapshot('mount');
      let ctrls = await session.controls();
      const steps = area.trace ? area.acts.map(a => ({ acts: [a] })) : area.steps.map(st => ({ step: st }));
      for (const [i, st] of steps.entries()) {
        const before = { ...snap, controls: ctrls };
        let inputs;
        try { inputs = st.acts ?? guideInputs(st.step, ctrls, snap.time, o.settleMs); } catch (e) { row.failed = `step ${i + 1}: ${e.message}`; break; }
        if (!inputs.length) continue; // an optional step whose control is not usable now
        const outputs = [];
        for (const input of inputs) { snap = await session.apply(input); outputs.push(...snap.outputs); row.inputs++; }
        ctrls = await session.controls();
        const to = observe({ ...snap, outputs }, ctrls, session.acts, outputs.some(x => x.name === 'ended'));
        if (!row.scenes.includes(to.scene)) row.scenes.push(to.scene);
        const used = inputs.find(x => x.control);
        if (used) {
          const it = entry(before.controls.find(c => controlKey(c) === controlKey(used.control)) || used.control);
          if (effectOf({ ...before, outputs: [] }, { ...snap, outputs, controls: ctrls })) it.keyboard ??= { from: byKey.get(stateKey(before, before.controls)) ?? 0, acts: session.acts };
        }
        if (snap.error) { row.failed = `step ${i + 1}: ${snap.error}`; break; }
      }
    } catch (e) {
      row.failed = e.message.split('\n')[0];
    } finally { keep(session); await session.close(); }
  }

  // Keyboard exploration.
  let steps = 0; let turn = 0; let stopped = null;
  say(`keyboard pass: up to ${o.stepBudget} steps and ${Math.round(o.timeBudgetMs / 1000)} s`);
  const expanded = new Set();
  while (!startError) {
    const state = pickNext(states, expanded, turn++);
    if (!state) break;
    const cands = [];
    for (const c of state.controls.filter(x => x.enabled).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : controlKey(a) < controlKey(b) ? -1 : 1))) {
      const list = candidatesFor(c, state.time, o.settleMs);
      if (!list) { failures.push({ state: state.id, control: controlKey(c), reason: `${c.kind} controls are not explored (text entry or unknown kind)` }); continue; }
      for (const inputs of list) cands.push({ control: c, inputs });
    }
    cands.push({ control: null, inputs: [{ t: state.time + o.waitMs, act: 'advance' }] });
    let done = true;
    for (let i = 0; i < cands.length; i++) {
      if (steps >= o.stepBudget) { stopped = 'steps'; done = false; break; }
      if (Date.now() - began > o.timeBudgetMs) { stopped = 'time'; done = false; break; }
      const { control, inputs } = cands[i];
      steps++;
      tick(() => `keyboard pass: ${steps} steps, ${states.length} states, ${Math.round((Date.now() - began) / 1000)} of ${Math.round(o.timeBudgetMs / 1000)} s`);
      session = await openSession(browser, build, start);
      try {
        for (const input of state.acts) await session.apply(input);
        let snap; const outputs = [];
        for (const input of inputs) { snap = await session.apply(input); outputs.push(...snap.outputs); }
        const ctrls = await session.controls();
        const acts = session.acts;
        const to = observe({ ...snap, outputs }, ctrls, acts, outputs.some(x => x.name === 'ended'));
        edges.push({ from: state.id, to: to.id, control: control ? controlKey(control) : null, drop: inputs[0].drop ?? null, outputs: outputs.map(x => x.name), error: snap.error });
        if (control) {
          const it = entry(control);
          if (effectOf({ ...state, outputs: [] }, { ...snap, outputs, controls: ctrls })) it.keyboard ??= { from: state.id, acts };
          else failures.push({ state: state.id, control: controlKey(control), reason: 'the keyboard use showed no event, value or scene change' });
        }
      } catch (e) {
        failures.push({ state: state.id, control: control ? controlKey(control) : null, reason: e.message.split('\n')[0] });
      } finally { keep(session); await session.close(); }
    }
    if (done) expanded.add(state.id); else break;
  }
  const pendingStates = states.filter(s => !expanded.has(s.id) && !s.error).length;

  // The pointer pass: each control with a keyboard witness, used once by the pointer from the same state.
  let pointerSteps = 0; let pointerStopped = null;
  const pointerBegan = Date.now();
  say(`pointer pass: up to ${o.pointerBudget} uses and ${Math.round(o.timeBudgetMs / 2000)} s`);
  for (const it of inventory.values()) {
    if (!it.keyboard) continue;
    if (['spinbutton', 'textbox', 'searchbox', 'combobox'].includes(it.role)) { it.pointer = { skipped: `a ${it.role} has no pointer use the tool tries` }; continue; }
    if (pointerSteps >= o.pointerBudget) { pointerStopped = 'steps'; break; }
    if (Date.now() - pointerBegan > o.timeBudgetMs / 2) { pointerStopped = 'time'; break; }
    pointerSteps++;
    const from = states[it.keyboard.from];
    const own = it.keyboard.acts.slice(from.acts.length);
    session = await openSession(browser, build, start);
    try {
      for (const input of from.acts) await session.apply(input);
      const before = { ...await session.snapshot('before'), controls: await session.controls() };
      let snap; const outputs = [];
      for (const input of pointerFor(own)) { snap = await session.apply(input); outputs.push(...snap.outputs); }
      it.pointer = effectOf({ ...before, outputs: [] }, { ...snap, outputs, controls: await session.controls() }) ? { from: from.id, acts: session.acts } : { from: from.id, failed: 'the pointer use showed no event, value or scene change' };
      measure(snap);
    } catch (e) { it.pointer = { from: from.id, failed: e.message.split('\n')[0] }; } finally { keep(session); await session.close(); }
  }

  // Record and replay the first keyboard path to each ending; with no ending, the longest path explored.
  const traces = [];
  const recordAndReplay = async (scene, acts, why) => {
    const trace = await record(browser, build, acts, { start });
    const again = await replay(browser, build, trace);
    for (const n of [...trace.network, ...again.actual.network]) if (!network.some(m => m.url === n.url && m.kind === n.kind)) network.push(n);
    traces.push({ why, scene, reached: trace.expect.scene, trace, replay: { pass: again.pass, differences: again.differences } });
  };
  if (!startError && o.record !== false) {
    for (const [scene, acts] of witnesses) await recordAndReplay(scene, acts, 'ending');
    if (!witnesses.size) {
      const longest = states.filter(s => !s.error).sort((a, b) => b.acts.length - a.acts.length)[0];
      if (longest?.acts.length) await recordAndReplay(longest.scene, longest.acts, 'longest');
    }
  }

  return {
    mode: 'bounded-browser-observation', start, policy: { ...Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'progress' && k !== 'progressMs')), guide: guide ? guide.areas.map(a => a.name) : undefined }, ms: Date.now() - began, startError,
    steps, stopped, pendingStates, pointerSteps, pointerStopped, guided,
    states: states.map(s => ({ id: s.id, scene: s.scene, time: s.time, depth: s.acts.length, values: digestOf(s.values), controls: s.controls.filter(c => c.enabled).length, error: s.error })),
    edges, scenes: [...scenes].sort(), controls: [...inventory.values()], failures, network, errors,
    measures, sceneElements, endings: ends, traces,
  };
}
