// The host API (10.6): the one small door a host has to a mounted experience. It reaches only the experience's
// faces, never its body (decision 1): inputs it may set, triggers it may fire, output results and inputs it may read,
// output events and records it may hear, plus pause, restart and storage. A refused call throws {code, message}.
// - set: a declared input (content field or knob) as one change from the host; type and bounds checked, never clamped.
// - emit: a declared trigger input, with a payload only when it declares one.
// - read: an output result or an input; body values and freeText fields are E-HOST-PRIVATE.
// - on: declared output events and records of the experience, and entered, ended, openUrl, firstInput, hookHealth;
//   hsvg.changed hears every change of an input, whoever made it: {name, value, by} (D45).
//   The callback gets a frozen {name, detail} after the step's reactions; a throwing listener goes to onError, and
//   so does any failure in the engine's deliver phase (9.2).
// - A state-changing call made while listeners run waits until that step is over (9.2).
// - test mode (A8.5) also gives `internal`, the engine itself, for test tools.
// - aiPort: the host port for AI sources (A5.1, 10.7). A host gives it as the ai capability of mount():
//   mount(el, pkg, {capabilities: {ai: aiPort({'browser-ai': async (request, signal) => text})}}). The ai grant decides
//   which sources content may use; the engine checks every answer before any write (src/ai.mjs).
// - pagePort: the host port of the page capability (A3.1, 10.7). A host on someone else's page gives it as the page
//   capability of mount(): mount(overlay, pkg, {capabilities: {page: pagePort(document)}}). Without it the page part
//   reaches nothing: every hook reads missing (closed by default, principle 7). It finds hooks by their marks only.
// - hookHealth: on() hears it when the page capability reports a change of hook status (A3.1).
// - modulePort: the host port of logic modules (10.7, A9.3). A host gives one per module it serves, as that module's
//   capability of mount(): mount(el, pkg, {capabilities: {chess: modulePort({lock: {'chess@0.1.0': 'sha256:...'}})}}).
//   lock is the host's reviewed lock; the port runs each module in a confined executor (src/modules.mjs). The host
//   also imports the module's code (engine/v2/modules/<name>/index.mjs), which registers it.
// Split screen is a 2.1 draft (spec/2.0/drafts/structure-2.1.md).
import { checkValue, checkContent } from './runtime.mjs';
import { FORMAT } from './limits.mjs';

// ---- host pictures (10.6, D40) ----
// The data: address of a picture a host hands in, after its checks: PNG, JPEG or WebP, as the bytes show (never SVG,
// never code), at most limits.imageBytesEach bytes and limits.imagePixelsEach decoded pixels. Else E-HOST-PICTURE.
export function hostPicture(b, type, limits) {
  const no = (m) => refuse('E-HOST-PICTURE', `the picture ${m}`);
  if (!(b instanceof Uint8Array)) no('is bytes: give a Uint8Array');
  if (b.length > limits.imageBytesEach) no(`is ${b.length} bytes, over imageBytesEach ${limits.imageBytesEach}`);
  const at = (i) => b[i] ?? 0; const be = (i) => at(i) * 256 + at(i + 1); const le = (i, n) => { let v = 0; for (let k = n - 1; k >= 0; k--) v = v * 256 + at(i + k); return v; };
  const tag = (i, t) => String.fromCharCode(at(i), at(i + 1), at(i + 2), at(i + 3)) === t;
  let shows = null; let w = 0; let h = 0;
  if (at(0) === 137 && tag(1, 'PNG\r') && tag(12, 'IHDR')) { shows = 'image/png'; w = be(16) * 65536 + be(18); h = be(20) * 65536 + be(22); }
  else if (at(0) === 255 && at(1) === 216) {
    shows = 'image/jpeg';
    for (let i = 2; i + 8 < b.length && at(i) === 255;) {
      const m = at(i + 1);
      if (m === 255) { i++; continue; }
      if (m >= 192 && m <= 207 && m !== 196 && m !== 200 && m !== 204) { h = be(i + 5); w = be(i + 7); break; }
      i += m === 1 || (m >= 208 && m <= 216) ? 2 : 2 + be(i + 2);
    }
  } else if (tag(0, 'RIFF') && tag(8, 'WEBP')) {
    shows = 'image/webp';
    if (tag(12, 'VP8X')) { w = 1 + le(24, 3); h = 1 + le(27, 3); }
    else if (tag(12, 'VP8L')) { w = 1 + (le(21, 2) & 16383); h = 1 + (le(22, 4) >> 6 & 16383); }
    else if (tag(12, 'VP8 ')) { w = le(26, 2) & 16383; h = le(28, 2) & 16383; }
  }
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(type)) no(`type ${JSON.stringify(String(type)).slice(0, 40)} is not image/png, image/jpeg or image/webp (never SVG or code)`);
  if (shows !== type) no(`bytes are ${shows ?? 'no PNG, JPEG or WebP'}, not ${type}`);
  if (!(w > 0 && h > 0)) no('bytes give no width and height');
  if (w * h > limits.imagePixelsEach) no(`is ${w} x ${h} pixels, over imagePixelsEach ${limits.imagePixelsEach}`);
  let t = '';
  for (let i = 0; i < b.length; i += 32768) t += String.fromCharCode.apply(null, b.subarray(i, i + 32768));
  return `data:${type};base64,${btoa(t)}`;
}

// ---- the module port (10.7, A9.3) ----
// lock: {"<name>@<version>": "sha256:<hex>"}, the host's reviewed lock. maxMs and maxSteps: a host may set less than
// an export's budgets (10.11), never more. clock: the executor's clock (default performance.now). The port holds no
// code: src/modules.mjs runs each module in its own confined executor under these limits, so a host cannot hand in an
// executor that does not confine. The module code is not in the core: only a page that needs a module carries it.
const MODULE_PORTS = new WeakSet();
export function modulePort({ lock, maxMs, maxSteps, clock } = {}) {
  if (!lock || typeof lock !== 'object' || Array.isArray(lock)) refuse('E-TYPE', 'modulePort takes {lock: {"<name>@<version>": "sha256:..."}}');
  for (const [k, v] of Object.entries(lock)) if (!/^([a-z][a-z0-9]*(-[a-z0-9]+)*\.)?[a-z][a-z0-9]*(-[a-z0-9]+)*@.+$/.test(k) || !/^sha256:[0-9a-f]{64}$/.test(String(v))) refuse('E-TYPE', `lock entry ${k} is not <name>@<version>: sha256:<hex>`);
  const limits = {};
  if (maxMs !== undefined) { if (!(maxMs >= 1 && maxMs <= 1000)) refuse('E-RANGE', 'maxMs is 1..1000'); limits.maxMs = maxMs; }
  if (maxSteps !== undefined) { if (!(Number.isInteger(maxSteps) && maxSteps >= 1 && maxSteps <= 10000000)) refuse('E-RANGE', 'maxSteps is 1..10,000,000'); limits.maxSteps = maxSteps; }
  if (clock !== undefined && typeof clock !== 'function') refuse('E-TYPE', 'clock is a function');
  const port = Object.freeze({ kind: 'module-port', lock: Object.freeze({ ...lock }), limits: Object.freeze(limits), clock: clock ?? null });
  MODULE_PORTS.add(port);
  return port;
}
// Whether p is a port modulePort made.
export const isModulePort = (p) => MODULE_PORTS.has(p);

// ---- the page port (A3.1) ----
export const HOOK_KINDS = Object.freeze(['spot', 'surface', 'target', 'control', 'grab', 'obstacle']);
const HOOK_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

// The tokens of one data-hsvg-hook value: {hooks: [{kind, name}], bad: [token]}. A bad token is ignored (E-HOOK-MARK).
export function parseHookMark(value) {
  const hooks = []; const bad = [];
  const tokens = String(value ?? '').split(/\s+/).filter(Boolean);
  if (!tokens.length) bad.push('');
  for (const t of tokens) {
    const parts = t.split(':');
    if (parts.length === 2 && HOOK_KINDS.includes(parts[0]) && HOOK_NAME.test(parts[1])) hooks.push({ kind: parts[0], name: parts[1] });
    else bad.push(t);
  }
  return { hooks, bad };
}

// The marks of one element: [{kind, name}], from data-hsvg-hook. The earlier marks (data-hsvg-target and the rest)
// are converted at import (the upgrade tool's page-marks step); the reader no longer knows them.
export function marksOf(el) {
  const v = el.getAttribute?.('data-hsvg-hook');
  return v != null ? parseHookMark(v).hooks : [];
}

// Finds hooks on a page. wanted: [{name, kind}], the hooks the experience declares and the host grants; no other
// element is looked at twice or returned. Returns {name: {status, elements}}: status found (exactly one element, or
// any number of obstacles, zero included), missing or ambiguous. A mark of another kind does not count.
export function findHooks(root, wanted) {
  const selector = '[data-hsvg-hook]';
  const byName = new Map(wanted.map(w => [w.name, { kind: w.kind, elements: [] }]));
  for (const el of root.querySelectorAll(selector)) {
    for (const m of marksOf(el)) {
      const w = byName.get(m.name);
      if (w && w.kind === m.kind && !w.elements.includes(el)) w.elements.push(el);
    }
  }
  const out = {};
  for (const [name, w] of byName) {
    const n = w.elements.length;
    const status = w.kind === 'obstacle' ? 'found' : n === 1 ? 'found' : n === 0 ? 'missing' : 'ambiguous';
    out[name] = { status, elements: status === 'found' ? w.elements : [] };
  }
  return out;
}

// The host's page port. doc: the host page's document; root (optional): the element whose marks count (default the
// whole document). The page part gets elements only from find(); content never sees them.
export function pagePort(doc, { root = null } = {}) {
  if (!doc || typeof doc.querySelectorAll !== 'function') refuse('E-TYPE', 'pagePort takes the host page\'s document');
  const scope = root || doc;
  return Object.freeze({
    kind: 'page-port',
    document: doc,
    root: scope,
    find: (wanted) => findHooks(scope, wanted),
  });
}

// The AI source port. sources: {name: async (request, signal) => answer}. A source gets one frozen request:
// {seat, label, persona, facts, question, visitorText, steering, answerType, language}. The persona is creator text,
// facts are the seat's view values, visitorText is the visitor's own words (null unless steering allows them); they
// are separate fields, and a source must never join them into one instruction (A5.1, Separation). The signal aborts
// when the time limit passes or the ask is cancelled. The answer is plain text, or one of answerType.options.
const SOURCE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
export function aiPort(sources = {}) {
  if (sources === null || typeof sources !== 'object' || Array.isArray(sources)) refuse('E-TYPE', 'aiPort takes {name: async function}');
  const own = new Map();
  for (const [name, fn] of Object.entries(sources)) {
    if (!SOURCE.test(name) || name.length > 48) refuse('E-NAME-SHAPE', `${name} is not an AI source name`);
    if (typeof fn !== 'function') refuse('E-TYPE', `the AI source ${name} is not a function`);
    own.set(name, fn);
  }
  return Object.freeze({
    kind: 'ai-port',
    names: () => [...own.keys()],
    has: (name) => own.has(name),
    // Calls a source with a frozen copy of the request; a throw becomes a rejected promise.
    call(name, request, signal) {
      const fn = own.get(name);
      if (!fn) return Promise.reject(Object.assign(new Error(`no AI source ${name}`), { code: 'E-REF-UNKNOWN' }));
      const deep = (x) => { if (x && typeof x === 'object') { for (const v of Object.values(x)) deep(v); Object.freeze(x); } return x; };
      try { return Promise.resolve(fn(deep(structuredClone(request)), signal)); } catch (e) { return Promise.reject(e); }
    },
  });
}

const BUILT_IN = ['entered', 'ended', 'openUrl', 'firstInput', 'hookHealth'];
// Built-in outputs heard only as hsvg.<name> (D22): changed, every change of an input (D45).
const PREFIXED = ['changed'];
const PARTITION = /^[A-Za-z0-9._-]{1,128}$/;
const refuse = (code, message) => { const e = new Error(message); e.code = code; throw e; };
const frozen = (x) => Object.freeze(structuredClone(x));
// The host's own copy of a value it gives; a value that cannot be copied (a function) is no JSON value.
const own = (x, name) => { try { return structuredClone(x); } catch { return refuse('E-TYPE', `${name}: not a JSON value`); } };

export function hostApi(player, { onError = null, test = false, onRestart = null } = {}) {
  const doc = player.exp.doc;
  const inputs = doc.inputs || {};
  const outputs = doc.outputs || {};
  const subs = new Map();
  const pauses = new Set();
  let delivering = false;
  let destroyed = false;
  const pending = [];
  const alive = () => {
    if (destroyed) refuse('E-HOST-CLOSED', 'the player is destroyed');
    if (player.stopped) refuse('E-HOST-CLOSED', `the player stopped: ${player.stopped.code || 'fault'} ${player.stopped.message}`);
  };
  const error = (e, source) => { const d = { code: e.code || null, message: e.message, source }; if (onError) onError(d); else console.error(d); };
  // Calls that change state wait while listeners run (9.2); otherwise they run now.
  const change = (fn) => { alive(); if (delivering) { pending.push(fn); return undefined; } return fn(); };
  const check = (r) => { if (r && r.ok === false) refuse(r.fault.code, r.fault.message); return r; };
  // A failure in the deliver phase (a listener that throws, 9.2) goes to the same error callback.
  player.onDeliveryError = (d) => { if (onError) onError(d); else console.error(d); };
  // A shell's declared output events reach on(name), as the experience's do (10.6; B7, batch 2), so every host hears
  // them. The shell's event still goes to the story graph; the host hears it after the commit, with its payload, once
  // per event. A name the experience declares too is the experience's. Each heard event is tied to its transaction's
  // own output list (state.outputs, new in every transaction): only the committed transaction's are delivered, so a
  // rolled-back transaction delivers nothing (9.2).
  const shellOuts = Object.entries(player.exp.shell?.doc?.outputs || {}).filter(([n, o]) => o?.kind === 'event' && !outputs[n]).map(([n]) => n);
  const heard = [];
  if (shellOuts.length && typeof player.onOutcome === 'function') {
    const onOutcome = player.onOutcome.bind(player);
    player.onOutcome = (address, name, payload) => { if (address === player.shellId && shellOuts.includes(name)) heard.push([player.state.outputs, name, { ...(payload ?? {}) }]); return onOutcome(address, name, payload); };
  }

  player.on(({ outputs: outs, deliveries = [] }) => {
    delivering = true;
    try {
      // The page capability's hook health (A3.1) is the built-in output hookHealth: {<hook>: status}.
      const health = deliveries.filter(d => d.kind === 'page' && d.op === 'health').map(d => ['hookHealth', d.status]);
      // Every change of an input (D45), the host's, a control's or a setting's: hsvg.changed {name, value, by}. Free
      // text a person typed stays private, as read keeps it.
      const changed = deliveries.filter(d => d.kind === 'input' && inputs[d.name]?.contentType !== 'freeText').map(d => ['hsvg.changed', { name: d.name, value: d.value, by: d.source }]);
      for (const [name, detail] of [...outs.map(({ name: n, ...rest }) => [n, rest]), ...heard.splice(0).filter(([tx]) => tx === outs).map(([, n, d]) => [n, d]), ...health, ...changed]) {
        for (const fn of subs.get(name) || []) {
          try { fn({ name, detail: frozen(detail) }); } catch (e) { error(e, 'listener'); }
        }
      }
    } finally { delivering = false; }
    if (pending.length) queueMicrotask(() => { while (pending.length) { const fn = pending.shift(); try { fn(); } catch (e) { error(e, 'host'); } } });
  });

  const api = {
    on(name, fn) {
      alive();
      // A built-in output is heard by its bare name or as hsvg.<name> (D22, 5.9): a built-in output added after 2.0
      // exists only as hsvg.<name>, so it never meets an author's output of the same name.
      if (typeof name === 'string' && name.startsWith('hsvg.')) {
        const bare = name.slice(5);
        if (PREFIXED.includes(bare)) { if (!subs.has(name)) subs.set(name, new Set()); subs.get(name).add(fn); return () => subs.get(name)?.delete(fn); }
        if (!BUILT_IN.includes(bare)) refuse('E-REF-UNKNOWN', `${name} is not a built-in output (${[...BUILT_IN, ...PREFIXED].join(', ')})`);
        name = bare;
      }
      const out = outputs[name];
      if (!BUILT_IN.includes(name) && !shellOuts.includes(name) && !(out && (out.kind === 'event' || out.kind === 'record'))) refuse('E-REF-UNKNOWN', `${name} is not an output event or record of the experience or its shell`);
      if (!subs.has(name)) subs.set(name, new Set());
      subs.get(name).add(fn);
      return () => subs.get(name)?.delete(fn);
    },
    read(name) {
      alive();
      const out = outputs[name];
      if (out?.kind === 'result') return structuredClone(player.eval('experience', out.value));
      const inp = inputs[name];
      if (inp && inp.kind !== 'trigger') {
        if (inp.contentType === 'freeText') refuse('E-HOST-PRIVATE', `${name} is free text a person typed`);
        return structuredClone(player.state.blocks.experience.inputs[name]);
      }
      if (doc.values?.[name] || doc.computed?.[name]) refuse('E-HOST-PRIVATE', `${name} is inside the experience`);
      refuse('E-REF-UNKNOWN', `${name} is not an output or input of the experience`);
      return undefined;
    },
    // set and emit copy the caller's value once, at the call, and check and play that copy: a call that waits (a
    // listener is running) cannot be changed by its caller afterwards.
    set(name, given) {
      alive();
      const inp = inputs[name];
      if (!inp || inp.kind === 'trigger') refuse(inp ? 'E-TYPE' : 'E-REF-UNKNOWN', `${name} is not a content field or knob of the experience`);
      const value = own(given, name);
      if (inp.contentType === 'picture' && /^host:/.test(value)) refuse('E-TYPE', `${name}: only player.picture names a host picture`);
      // A content field takes a tier or language object, each wording checked (7.9, 10.6); a knob its plain value.
      const bad = inp.kind === 'content' ? checkContent(inp, value) : checkValue(inp, value);
      // A refused feed of a live field still goes through setInput, which leaves the fallback rows (live-data, 10.7).
      if (bad) { if (player.caps?.inputHook('refused', name, inp, player.dataView()) !== undefined) change(() => player.setInput(name, value, 'host')); refuse(bad[0], `${name}: ${bad[1]}`); }
      return change(() => check(player.setInput(name, value, 'host')));
    },
    emit(name, given = {}) {
      alive();
      const inp = inputs[name];
      if (inp?.kind !== 'trigger') refuse('E-REF-UNKNOWN', `${name} is not a trigger of the experience`);
      const payload = own(given, name);
      if (Object.keys(payload).length && !inp.payload) refuse('E-TYPE', `the trigger ${name} takes no payload`);
      if (inp.payload) { const bad = checkValue(inp.payload, payload); if (bad) refuse(bad[0], `${name}: ${bad[1]}`); }
      return change(() => check(player.trigger(name, payload, 'host')));
    },
    // A picture for a picture place (10.6, D40): name is a content input of the experience whose contentType is
    // picture; bytes a Uint8Array (copied now); type image/png, image/jpeg or image/webp. The engine checks the type
    // against what the bytes show, the bytes and the decoded size (hostPicture); the input then names it as
    // host:<name>, and a picture place bound to it shows it. Never SVG or code.
    picture(name, bytes, type) {
      alive();
      const inp = inputs[name];
      if (!inp || inp.kind !== 'content') refuse('E-REF-UNKNOWN', `${name} is not a content field of the experience`);
      if (inp.contentType !== 'picture') refuse('E-TYPE', `${name} holds ${inp.contentType ?? inp.type}, not a picture`);
      const uri = hostPicture(ArrayBuffer.isView(bytes) ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength).slice() : bytes, type, player.limits || FORMAT);
      return change(() => check(player.hostPicture(name, uri)));
    },
    // A person's time limits (10.13): 1 as written, 2..10 multiplies timed links and machine timers, 0 turns them off.
    timeLimits(factor) { return change(() => check(player.applySettings([['timeLimits', factor]], 'host'))); },
    pause(reason) { alive(); pauses.add(String(reason)); change(() => player.setPause('host', true)); },
    resume(reason) { alive(); pauses.delete(String(reason)); if (!pauses.size) change(() => player.setPause('host', false)); },
    get paused() { return pauses.size > 0; },
    scene(slot = 'stage') { alive(); if (slot !== 'stage') refuse('E-REF-UNKNOWN', `no stage slot ${slot}`); return player.scene; },
    // The trusted host port of A4.1 (10.6): fill or replace a seat's occupant (S1 Request 3). Without the seats
    // capability there are no seats to give.
    seat(seatId, filler) {
      alive();
      if (!player.seats) refuse('E-NEEDS-MISSING', 'seats need the seats capability, which is not installed');
      return change(() => { const r = player.seats.host(String(seatId), String(filler)); if (!r.ok) refuse(r.error.code, r.error.message); return r; });
    },
    restart() { return change(() => { const r = check(player.restart()); onRestart?.(); return r; }); },
    clearStorage() { return change(() => { player.clearStorage(); const r = check(player.restart()); onRestart?.(); return r; }); },
    setPartition(id) {
      alive();
      if (typeof id !== 'string' || !PARTITION.test(id)) refuse('E-RANGE', 'a partition is 1 to 128 of A-Z a-z 0-9 . _ -');
      return change(() => { player.opts.storage = { ...(player.opts.storage || {}), partition: id }; const r = check(player.restart()); onRestart?.(); return r; });
    },
    destroy() { destroyed = true; subs.clear(); pending.length = 0; },
  };
  if (test) api.internal = player;
  return api;
}
