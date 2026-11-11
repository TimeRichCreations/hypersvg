// The Node part of test.mjs: plays an experience in the engine's own player, with a drawing painted after every step
// (so bindings run), and walks the story. From each scene it reaches it uses every control: each press, each option,
// each slider at Home, End and one step, each drag on each drop and on none, every choice link, and a wait (timed
// links). A use that moves to another scene adds that scene and the path to it. A fault (ok: false), a drawing
// fault or a thrown error is a finding with its E- code. No browser.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { folderSource } from '../../src/load.mjs';
import { checkExperience } from '../../check/index.mjs';
import { Player } from '../../src/story.mjs';
import { Drawing } from '../../src/drawing.mjs';
import { modulePort } from '../../src/host.mjs';
import { loadSchemas } from '../../schema/load.mjs';
import '../../src/capabilities/all.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const v2 = path.resolve(here, '..', '..');
const repo = path.resolve(v2, '..', '..');
// The reviewed logic modules (10.7): a module runs only if the lock names it. Each one this engine holds is
// registered (chess and the chess opponent are add-ons, D30: the core release holds none).
const LOCK = JSON.parse(fs.readFileSync(path.join(v2, 'modules', 'lock.json'), 'utf8'));
const MODULES = [...new Set(Object.keys(LOCK).map(k => k.replace(/@.*$/, '')))];
for (const m of MODULES) { const f = path.join(v2, 'modules', m, 'index.mjs'); if (fs.existsSync(f)) await import(pathToFileURL(f).href); }
// The host's ports: the reviewed modules, seats, and each add-on this run imported (its own pin, as a host in Node
// gives it after review, tests/x6-addons.test.mjs).
const ports = (loadedAddons) => {
  const addonLock = Object.fromEntries([...loadedAddons.values()].map(a => [a.pinned, a.digest]));
  return Object.fromEntries([...[...MODULES, 'seats'].map(m => [m, modulePort({ lock: LOCK })]), ...[...loadedAddons.keys()].map(id => [id, modulePort({ lock: addonLock })])]);
};
let schemas;
export const getSchemas = () => (schemas ??= loadSchemas(path.join(repo, 'spec', '2.0')));

export const SETTLE_MS = 500;
export const WAIT_MS = 3000;
// The waits tried in each scene, after every use: a timed link or a run that ends by itself (a race, a countdown).
export const WAITS = [WAIT_MS, 15000, 60000];
export const PASSES = 2;

class Fault extends Error { constructor(code, message) { super(`${code}: ${message}`); this.code = code; } }
const faultOf = (r) => { const f = r?.fault || r?.stopped || r; return new Fault(f?.code || 'E-FAULT', f?.message || JSON.stringify(r)); };

// A fresh player on the loaded experience, at its start, painted. Throws a Fault.
function start(experience, layout, loadedAddons) {
  const p = new Player(experience, { capabilities: ports(loadedAddons) });
  const r = p.start();
  if (!r?.ok) throw faultOf(r);
  let d = null; let shown = null;
  const lay = (doc) => (layout && doc.layouts?.some(l => l.id === layout) ? layout : doc.layouts?.[0]?.id || 'main');
  const paint = () => {
    if (p.stopped) throw faultOf(p.stopped);
    if (shown !== p.scene) {
      const sc = experience.scenes[p.scene];
      if (p.shellId) { if (!d) { d = new Drawing(p); d.mountShell(p.shellId, lay(experience.shell.doc)); } d.mountStage(p.scene, lay(sc.doc)); } else { d = new Drawing(p); d.mountScene(p.scene, lay(sc.doc)); }
      shown = p.scene;
    }
    d.paint();
    if (d.faults.length) { const f = d.faults[0]; d.faults.length = 0; throw new Fault(f.code || 'E-DRAWING', `${f.address || ''} ${f.message}`); }
  };
  paint();
  const check = (x) => { for (const r of [].concat(x ?? [])) if (r && r.ok === false) throw faultOf(r); };
  // One action: use a control, pick a choice, or wait. Then the clock moves SETTLE_MS (a wait: its own time).
  const act = (a) => {
    if (a.t === 'use') check(p.activate(a.addr, a.cid, a.arg));
    else if (a.t === 'pick') check(p.pick(a.link));
    else if (a.t === 'close') { check(p.transaction('person', () => p.dialog(a.dialog, false))); p.afterCommit?.(); }
    if (p.stopped) throw faultOf(p.stopped);
    paint();
    check(p.advance(a.t === 'wait' ? a.ms : SETTLE_MS));
    paint();
  };
  return { p, act };
}

// The actions to try in the player's state now: every usable control of every mounted block, every choice, a wait.
export function actionsNow(p) {
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
    const controls = p.def(addr)?.controls || {};
    for (const [cid, c] of Object.entries(controls)) {
      if (!c || typeof c !== 'object') continue;
      const use = (arg, what) => out.push({ t: 'use', addr, cid, arg, what: `${addr}#${cid}${what ? ` ${what}` : ''}`, kind: c.kind });
      if (c.kind === 'choice') { for (const o of Object.keys(c.options || {})) if (p.controlEnabled(addr, cid, o)) use(o, `option ${o}`); continue; }
      if (!p.controlEnabled(addr, cid)) continue;
      if (c.kind === 'button' || c.kind === 'toggle') use(undefined, 'press'); // the step names stay as the baseline wrote them
      else if (c.kind === 'slider' || c.kind === 'dial') {
        const lo = p.sliderValueAt(addr, cid, 0); const hi = p.sliderValueAt(addr, cid, 1);
        if (lo === null) { use(undefined, 'slider'); continue; }
        const now = Number(p.controlValue(addr, cid));
        const step = p.sliderStep(addr, cid);
        const one = Number.isFinite(now) ? Math.min(hi, Math.max(lo, +(now + step).toFixed(10))) : lo;
        use(lo, `Home ${lo}`); use(hi, `End ${hi}`); use(one >= hi ? Math.max(lo, +(hi - step).toFixed(10)) : one, 'one step');
      } else if (c.kind === 'drag') { for (const d of c.drops || []) use(d, `drop ${d}`); use('', 'no drop'); }
      else {
        // An add-on's control kind (D39): each gesture its manifest lists (press, up, down), as the page sends them.
        const gestures = p.controlAccess?.(addr, cid)?.gestures;
        if (gestures?.length) for (const g of gestures) use(g, `${c.kind} ${g}`);
        else use(undefined, c.kind);
      }
    }
  }
  if (inside) return out;
  for (const ch of p.choices?.() || []) out.push({ t: 'pick', link: ch.id, what: `choice ${ch.id}` });
  for (const ms of WAITS) out.push({ t: 'wait', ms, what: `wait ${ms} ms` });
  return out;
}
const keyOf = (a) => `${a.t}|${a.addr || ''}|${a.cid || ''}|${a.arg ?? ''}|${a.link || a.dialog || ''}`;

// Walks the experience. Returns {scenes: [{id, path}], uses, findings: [{code, scene, element, message}], ms}.
// budget: the most actions in all (each replayed step counts); layout: the layout id to draw (default the first).
export async function playNode(folder, { kits = {}, budget = 4000, layout = null, allow = [] } = {}) {
  const t0 = Date.now();
  const source = await folderSource(folder, { kits });
  const l = checkExperience(source, getSchemas());
  const findings = [];
  if (!l.experience || l.diags.some(d => d.code.startsWith('E-'))) return { scenes: [], uses: 0, findings: [{ code: 'T-NODE-LOAD', scene: '', element: '', message: `does not load: ${l.diags.slice(0, 3).map(d => d.code).join(', ')}` }], ms: Date.now() - t0 };
  const exp = l.experience;
  // Add-ons the experience pins (chapter 12): their code is imported as a host in Node does (tools/addons.mjs).
  const loadedAddons = new Map();
  try {
    const { loadAddons } = await import('../addons.mjs');
    for (const a of await loadAddons(source, exp, { allow })) loadedAddons.set(a.id, a);
  } catch (e) {
    return { scenes: [], uses: 0, findings: [{ code: e.code || 'E-ADDON', scene: '', element: 'add-ons', message: e.message }], ms: Date.now() - t0, experience: exp };
  }
  let steps = 0; let uses = 0;
  const scenes = new Map(); // id -> path (actions from the start)
  const used = new Map(); // scene -> the actions tried there, in order (replayed for test.mjs --baseline)
  const queue = [];
  let s;
  try { s = start(exp, layout, loadedAddons); } catch (e) {
    // Code the Node player does not carry (an add-on or module no host here registers) is the page's to play.
    const missing = ['E-ADDON', 'E-MODULE-REVIEW', 'E-NEEDS-MISSING'].includes(e.code);
    return { scenes: [], uses: 0, findings: [...findings, { code: missing ? 'T-NODE-SKIP' : e.code || 'T-NODE-FAULT', ...(missing ? { severity: 'warning' } : {}), scene: '', element: 'start', message: missing ? `the Node player cannot start it (${e.message.slice(0, 200)}); the browser walks the page instead` : e.message }], ms: Date.now() - t0, experience: exp };
  }
  scenes.set(s.p.scene, []); queue.push(s.p.scene);
  const reach = (id) => { const r = start(exp, layout, loadedAddons); for (const a of scenes.get(id)) { r.act(a); steps++; } return r; };
  while (queue.length && steps < budget) {
    const id = queue.shift();
    let cur;
    try { cur = reach(id); } catch (e) { findings.push({ code: e.code || 'T-NODE-FAULT', scene: id, element: 'path', message: `replaying the path: ${e.message}` }); continue; }
    if (cur.p.scene !== id) { findings.push({ code: 'T-NODE-PATH', severity: 'warning', scene: id, element: 'path', message: `the path to ${id} now ends in ${cur.p.scene} (the story is not the same on a second play)` }); continue; }
    // Keep using what is usable in this scene until nothing new is left; a use that leaves the scene comes back by
    // replaying the path. Then again, up to PASSES times, while the uses still change the scene's values: a scene may
    // need a sequence (every card tapped, then Continue).
    let since = []; // the uses since the scene was reached: a new scene's path keeps them (a right answer, then Next)
    const digest = () => { try { return JSON.stringify(Object.entries(cur.p.state.blocks).filter(([a]) => a === id || a.startsWith(`${id}/`)).map(([, b]) => b.values)); } catch { return ''; } };
    for (let pass = 0; pass < PASSES && steps < budget; pass++) {
      const done = new Set();
      const before = digest();
      let changed = false;
      for (let round = 0; round < 200 && steps < budget; round++) {
        const next = actionsNow(cur.p).find(a => !done.has(keyOf(a)) && (pass === 0 || a.t !== 'wait' || a.ms === WAIT_MS));
        if (!next) break;
        done.add(keyOf(next));
        if (!used.has(id)) used.set(id, []);
        if (pass === 0) used.get(id).push(next);
        const was = digest();
        try { cur.act(next); steps++; uses++; since.push(next); } catch (e) {
          if (pass === 0) findings.push({ code: e.code || 'T-NODE-FAULT', scene: id, element: next.what, message: e.message });
          try { cur = reach(id); since = []; } catch { break; }
          continue;
        }
        if (cur.p.scene !== id) {
          if (!scenes.has(cur.p.scene)) { scenes.set(cur.p.scene, [...scenes.get(id), ...since]); queue.push(cur.p.scene); }
          try { cur = reach(id); since = []; } catch (e) { findings.push({ code: e.code || 'T-NODE-FAULT', scene: id, element: 'path', message: e.message }); break; }
        } else if (digest() !== was) changed = true;
      }
      if (!changed || digest() === before && pass > 0) break;
    }
  }
  const unreached = Object.keys(exp.scenes).filter(x => !scenes.has(x));
  for (const x of unreached) findings.push({ code: 'T-SCENE-UNREACHED', scene: x, element: '', message: `no Next, Back, link or control use reached scene ${x}${steps >= budget ? ` (the budget of ${budget} actions ran out)` : ''}`, severity: 'warning' });
  return { scenes: [...scenes].map(([id, p]) => ({ id, path: p.map(a => a.what) })), paths: scenes, used, uses, steps, findings, ms: Date.now() - t0, experience: exp };
}
