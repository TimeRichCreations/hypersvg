// The proof formats: canonical JSON, digests, and the checks on a trace (proof-trace/2.0).
// Pure functions. No browser, no files.
import { createHash } from 'node:crypto';

export const TRACE = 'proof-trace/2.0';
export const CERTIFICATE = 'proof-certificate/2.0';
export const GUIDE = 'proof-guide/2.0';

// Object keys sorted; arrays keep their order; numbers keep full precision. Non-finite numbers are refused.
export function canonical(value) {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('canonical: expected a finite number');
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().filter(k => value[k] !== undefined)
      .map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  }
  const s = JSON.stringify(value);
  if (s === undefined) throw new Error('canonical: expected JSON data');
  return s;
}
export const digest = (text) => 'sha256:' + createHash('sha256').update(text).digest('hex');
export const digestOf = (value) => digest(canonical(value));
export const same = (a, b) => canonical(a) === canonical(b);

// A control's identity: where it is mounted (addr), its control id (cid), its option when it is one option of an
// option control, the DOM id, the accessible role and name. Widgets (the shell's HTML, A6.1) have no addr or cid.
export const controlKey = (c) => c.widget ? `widget:${c.role}:${c.name}` : `${c.addr}#${c.cid}${c.option !== undefined && c.option !== null ? '=' + c.option : ''}`;
export const identity = (c) => {
  const out = { role: c.role, name: c.name, id: c.id || '' };
  if (c.widget) out.widget = true; else { out.addr = c.addr; out.cid = c.cid; if (c.option !== undefined && c.option !== null) out.option = c.option; }
  return out;
};

const ACTS = ['activate', 'key', 'drag', 'advance'];
// One input. t is the absolute engine time in ms; inputs are in time order; one step moves at most an hour.
export function validateInput(input, previous = 0) {
  if (!input || typeof input !== 'object') throw new Error('an input is an object');
  if (!Number.isInteger(input.t) || input.t < previous || input.t - previous > 3600000) throw new Error('input times are whole ms, in order, at most an hour apart');
  if (!ACTS.includes(input.act)) throw new Error(`unknown input act ${input.act}`);
  if (input.act === 'activate' || input.act === 'drag') {
    const c = input.control;
    if (!c || typeof c.role !== 'string' || !c.role || typeof c.name !== 'string') throw new Error('a control needs a role and an accessible name');
    if (!c.widget && (typeof c.addr !== 'string' || typeof c.cid !== 'string')) throw new Error('an engine control needs addr and cid');
    if (!['keyboard', 'pointer'].includes(input.via)) throw new Error('an activation is by keyboard or pointer');
  }
  if (input.act === 'drag' && (typeof input.drop !== 'string' || !input.drop)) throw new Error('a drag names its drop');
  if (input.act === 'key' && (typeof input.key !== 'string' || !input.key)) throw new Error('a key input names its key');
  if (input.key !== undefined && typeof input.key !== 'string') throw new Error('key is a string');
  canonical(input);
  return input;
}

export function validateTrace(trace) {
  if (trace?.format !== TRACE) throw new Error(`expected a ${TRACE} trace`);
  if (typeof trace.product?.id !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(trace.fingerprint || '')) throw new Error('a trace names its product and the packed page digest');
  if (!trace.start || !trace.start.viewport || !Array.isArray(trace.acts) || !Array.isArray(trace.checkpoints) || !trace.expect) throw new Error('a trace needs start, acts, checkpoints and expect');
  let t = 0;
  for (const input of trace.acts) { validateInput(input, t); t = input.t; }
  if (trace.checkpoints.length !== trace.acts.length + 1) throw new Error('a trace has one checkpoint at mount and one after each input');
  const e = trace.expect;
  if (typeof e.scene !== 'string' || !Number.isInteger(e.time) || typeof e.values !== 'object' || !Array.isArray(e.visitedScenes)) throw new Error('expect needs scene, time, values and visitedScenes');
  canonical(trace);
  return trace;
}

// A guide (proof-guide/2.0): areas the explorer plays from the start before its own search, so a large experience
// reaches every scene. An area has steps (short inputs, below) or a trace (a proof-trace/2.0 file, its acts played as
// recorded). A step is one of:
//   {"use": "<control key>"}               the control's keyboard use (as the explorer makes it), then settle
//   {"use": "<control key>", "drop": "d"}  a drag control to one drop
//   {"use": "<control key>", "key": "K"}   the control focused by Tab, then key K (a slider step, Space)
//   "optional": true on a use step         skipped when the control is not shown or not usable now
//   {"key": "K"}                           one key press on the page, then settle
//   {"wait": ms}                           the clock moves on
// A control key is addr#cid, addr#cid=option, or widget:<role>:<name> (format.mjs controlKey).
export function validateGuide(guide) {
  if (guide?.format !== GUIDE) throw new Error(`expected a ${GUIDE} guide`);
  if (!Array.isArray(guide.areas) || !guide.areas.length) throw new Error('a guide has areas');
  const names = new Set();
  for (const a of guide.areas) {
    if (typeof a?.name !== 'string' || !a.name || names.has(a.name)) throw new Error('each area has its own name');
    names.add(a.name);
    if (!!a.steps === !!a.trace) throw new Error(`area ${a.name}: steps or a trace, not both`);
    if (a.trace !== undefined && typeof a.trace !== 'string') throw new Error(`area ${a.name}: trace names a file`);
    for (const [i, st] of (a.steps || []).entries()) {
      const where = `area ${a.name} step ${i + 1}`;
      const kinds = ['use', 'key', 'wait'].filter(k => st?.[k] !== undefined);
      if (st?.use !== undefined ? typeof st.use !== 'string' || !st.use : kinds.length !== 1) throw new Error(`${where}: one of use, key or wait`);
      if (st.wait !== undefined && (st.use !== undefined || !Number.isInteger(st.wait) || st.wait < 0 || st.wait > 3600000)) throw new Error(`${where}: wait is whole ms, at most an hour`);
      if (st.key !== undefined && (typeof st.key !== 'string' || !st.key)) throw new Error(`${where}: key names a key`);
      if (st.optional !== undefined && (st.use === undefined || typeof st.optional !== 'boolean')) throw new Error(`${where}: optional goes with use`);
      if (st.drop !== undefined && (st.use === undefined || typeof st.drop !== 'string' || !st.drop)) throw new Error(`${where}: drop goes with use`);
    }
  }
  canonical(guide);
  return guide;
}
