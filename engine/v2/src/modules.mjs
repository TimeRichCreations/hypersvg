// Logic modules (10.7, 10.11, A9.3): the call action, admission and the confined executor. The full account is in
// engine/v2/modules/README.md. A module record is {name, version, digest, exports, make(step)}; registerModule
// registers it as a capability. It installs only when needs names it, and only if: the experience's about.trust.pins
// pins <name>@<version> to its digest, the host's reviewed lock lists that digest (E-MODULE-REVIEW), and the host's
// port was made by modulePort (src/host.mjs), so the executor is made here (E-MODULE-CONFINEMENT). A failure faults
// the mount. A call checks its inputs, the result and every target before any write (E-MODULE-CALL, E-MODULE-RESULT).
import { register } from './capabilities.mjs';
import { checkValue } from './runtime.mjs';
import { modulePort, isModulePort } from './host.mjs';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const deepFreeze = (x) => { if (x && typeof x === 'object' && !Object.isFrozen(x)) { Object.freeze(x); for (const v of Object.values(x)) deepFreeze(v); } return x; };
export const MAX_BUDGET_MS = 1000;
export const MAX_BUDGET_STEPS = 10000000;
export const DEFAULT_BUDGET_STEPS = 10000000;

// ---- the confined executor ----
// The module gets only step(). Inputs go in as frozen copies; the result comes out as a copy. step() throws once the
// step or time budget is spent, and keeps throwing; a stopped call's result is thrown away. The clock is the executor's.
const defaultClock = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

export class ModuleStop extends Error {}
// The loop meter's check (tools/meter.mjs, Q1c finding 6): the loader puts __hsvgTick() in every loop and function
// body of a module, so the call's time budget holds even when the module never calls step(). It counts no step; it
// reads the clock every 1024 ticks and throws once the running call is over its time, as step() does.
let ticking = null; // the running call's check, or null
export function moduleTick() { if (ticking) ticking(); return true; }

export function confinedExecutor({ clock = defaultClock, maxMs = MAX_BUDGET_MS, maxSteps = MAX_BUDGET_STEPS } = {}) {
  const executor = Object.freeze({
    kind: 'confined-executor',
    maxMs, maxSteps,
    // Loads a module record. Returns {call(exportName, input, {ms, steps})} -> {ok, value} | {ok: false, why}.
    load(record) {
      let count = 0; let left = 0; let deadline = 0; let stopped = ''; let ticks = 0;
      const tick = () => {
        if (stopped) throw new ModuleStop(stopped);
        if ((++ticks & 1023) === 0 && clock() > deadline) { stopped = 'over its time budget'; throw new ModuleStop(stopped); }
      };
      const step = () => {
        if (stopped) throw new ModuleStop(stopped);
        count++;
        if (count > left) { stopped = left === 0 ? 'the module did work outside a call' : `over its step budget of ${left}`; throw new ModuleStop(stopped); }
        if ((count & 1023) === 0 && clock() > deadline) { stopped = 'over its time budget'; throw new ModuleStop(stopped); }
      };
      // make() runs metered too, with the executor's longest time.
      deadline = clock() + maxMs;
      const before = ticking; ticking = tick;
      let api;
      try { api = record.make(step); } finally { ticking = before; stopped = ''; }
      if (!isObj(api)) throw new Error(`module ${record.name} made no exports`);
      Object.freeze(api);
      return Object.freeze({
        call(name, input, budget) {
          const fn = Object.prototype.hasOwnProperty.call(api, name) ? api[name] : undefined;
          if (typeof fn !== 'function') return { ok: false, why: `${record.name} has no export ${name}` };
          count = 0; stopped = '';
          left = Math.min(budget.steps, maxSteps);
          const ms = Math.min(budget.ms, maxMs);
          const start = clock();
          deadline = start + ms;
          const before = ticking; ticking = tick; ticks = 0;
          try {
            const raw = fn(deepFreeze(structuredClone(input)));
            if (stopped) return { ok: false, why: stopped, steps: count };
            if (clock() > deadline) return { ok: false, why: 'over its time budget', steps: count };
            return { ok: true, value: structuredClone(raw), steps: count };
          } catch (e) {
            return { ok: false, why: stopped || (e && e.message) || String(e), steps: count };
          } finally { left = 0; ticking = before; }
        },
      });
    },
  });
  return executor;
}

// ---- the host's module port ----
// The port is modulePort of src/host.mjs: {lock, limits, clock}. It holds no code.
let pagePort = null;
// The page's own port: a packed page is its own host (tools/pack.mjs). Used when mount() gives no port.
export function hostLock(lock) { pagePort = lock ? modulePort({ lock }) : null; return pagePort; }
// The page's own port, or null: a capability that runs modules itself (the seats capability runs a seat's program)
// uses it when the host gives none. It is a modulePort: a lock and limits, never code.
export function pageModulePort() { return pagePort; }

// ---- admission (A9.3) ----
// door: the module's capability door. Returns the loaded module, or throws an EngineFault.
function admit(record, door) {
  const pinned = `${record.name}@${record.version}`;
  const review = (msg) => door.fault('E-MODULE-REVIEW', `${pinned}: ${msg}`, 'experience');
  const pins = door.experience?.about?.trust?.pins;
  const named = Object.keys(isObj(pins) ? pins : {}).filter(k => k.startsWith(`${record.name}@`));
  if (!named.length) review('about.trust.pins does not pin it');
  if (!named.includes(pinned)) review(`the pin names ${named.join(', ')}, but this host's module is version ${record.version}`);
  if (pins[pinned] !== record.digest) review(`the pinned digest ${pins[pinned]} is not the module's digest`);
  const given = door.port;
  const port = given ?? pagePort;
  if (!port) review('the host gives no module port, so no reviewed lock lists it');
  if (!isModulePort(port)) door.fault('E-MODULE-CONFINEMENT', `${pinned}: the host's module port was not made by modulePort, so nothing confines the module`, 'experience');
  if (port.lock[pinned] !== record.digest) review(port.lock[pinned] ? 'the host\'s reviewed lock lists another digest' : 'the host\'s reviewed lock does not list it');
  const executor = confinedExecutor({ ...port.limits, ...(port.clock ? { clock: port.clock } : {}) });
  try { return executor.load(record); } catch (e) { return door.fault('E-MODULE-CONFINEMENT', `${pinned}: the module did not load in the executor: ${e.message}`, 'experience'); }
}

// ---- the call action ----
// Modules installed on one engine, by name. Keyed by the engine's scope (door.scope), an opaque token every door of
// that engine shares and no other engine has, so each player keeps its own executors and limits (Y1). The frozen
// experience document is no key: players of one loaded experience share it. The first module in needs owns the `call` key (Installed.action), so it
// runs the calls of every module of that engine.
const GROUPS = new WeakMap();

// The value a `to` entry writes, as a set action of the block would: the block's own body value, or the
// experience's for a scene or shell (5.1.3). Returns its declaration, or null.
function targetDecl(door, address, name) {
  const own = door.def(address)?.values?.[name];
  if (own) return own;
  const kind = door.block(address)?.kind;
  if (kind === 'scene' || kind === 'shell' || address === 'experience') return door.experience.values?.[name] ?? null;
  return null;
}

function runCall(group, door, address, a, E) {
  const fault = (code, msg) => door.fault(code, `call ${a.call}: ${msg}`, address);
  // <module>.<export>: the module is everything before the last dot, so an outside module (owner.name) is called as
  // owner.name.export (chapter 12).
  const dot = typeof a.call === 'string' ? a.call.lastIndexOf('.') : -1;
  const modName = dot > 0 ? a.call.slice(0, dot) : '';
  const exportName = dot > 0 ? a.call.slice(dot + 1) : '';
  if (!modName || !exportName || modName.split('.').length > 2) fault('E-MODULE-CALL', 'a call names <module>.<export>');
  const mod = group.get(modName);
  if (!mod) fault('E-MODULE-REVIEW', `the module ${modName} is not installed: needs does not name it`);
  const ex = mod.record.exports[exportName];
  if (!ex) fault('E-MODULE-CALL', `${modName} has no export ${exportName}`);
  const ins = Object.keys(ex.with.properties || {});
  const outs = Object.keys(ex.returns.properties || {});
  const withKeys = Object.keys(a.with || {});
  const toKeys = Object.keys(a.to || {});
  const same = (x, y) => x.length === y.length && x.every(k => y.includes(k));
  if (!same(withKeys, ins)) fault('E-MODULE-CALL', `with gives ${withKeys.join(', ') || 'nothing'}; the export takes ${ins.join(', ')}`);
  if (!same(toKeys, outs)) fault('E-MODULE-CALL', `to maps ${toKeys.join(', ') || 'nothing'}; the export returns ${outs.join(', ')}`);
  const targets = toKeys.map(k => a.to[k]);
  if (new Set(targets).size !== targets.length) fault('E-MODULE-CALL', 'to maps two outputs to one value');
  // The inputs: each formula evaluated, then checked against the export's with schema.
  const input = {};
  for (const k of ins) input[k] = E(a.with[k]);
  const badIn = checkValue(ex.with, input);
  if (badIn) fault('E-MODULE-RESULT', `the inputs do not fit the export: ${badIn[1]}`);
  const r = mod.loaded.call(exportName, input, { ms: Math.min(ex.budgetMs ?? MAX_BUDGET_MS, MAX_BUDGET_MS), steps: ex.budgetSteps ?? DEFAULT_BUDGET_STEPS });
  if (!r.ok) fault('E-MODULE-RESULT', r.why);
  // Every check before any write.
  const badOut = isObj(r.value) ? checkValue(ex.returns, r.value) : ['E-TYPE', 'the result is not an object'];
  if (badOut) fault('E-MODULE-RESULT', `the result does not fit the manifest: ${badOut[1]}`);
  for (const k of outs) {
    const decl = targetDecl(door, address, a.to[k]);
    if (!decl) fault('E-MODULE-CALL', `${a.to[k]} is not a body value this block may write`);
    const bad = checkValue(decl, r.value[k]);
    if (bad) fault('E-MODULE-RESULT', `${k} does not fit ${a.to[k]}: ${bad[1]}`);
  }
  for (const k of outs) door.write(address, a.to[k], r.value[k]);
}

// Registers a module record as a capability under its name.
export function registerModule(record) {
  for (const k of ['name', 'version', 'digest']) if (typeof record?.[k] !== 'string') throw new TypeError(`a module record needs ${k}`);
  if (typeof record.make !== 'function' || !isObj(record.exports)) throw new TypeError('a module record needs make and exports');
  for (const [n, ex] of Object.entries(record.exports)) {
    if (!(ex.budgetMs >= 1 && ex.budgetMs <= MAX_BUDGET_MS)) throw new RangeError(`${record.name}.${n}: budgetMs is 1..${MAX_BUDGET_MS}`);
    if (ex.budgetSteps !== undefined && !(Number.isInteger(ex.budgetSteps) && ex.budgetSteps >= 1 && ex.budgetSteps <= MAX_BUDGET_STEPS)) throw new RangeError(`${record.name}.${n}: budgetSteps is 1..${MAX_BUDGET_STEPS}`);
  }
  const frozen = Object.freeze({ ...record, exports: deepFreeze(structuredClone(record.exports)) });
  return register({
    id: record.name,
    module: frozen,
    install(door) {
      const loaded = admit(frozen, door);
      const key = door.scope;
      const group = GROUPS.get(key) ?? new Map();
      GROUPS.set(key, group);
      group.set(frozen.name, { record: frozen, loaded });
      return { actions: { call: (address, a, E) => runCall(group, door, address, a, E) } };
    },
  });
}
