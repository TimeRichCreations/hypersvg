// The logic core (9.6): logic() for an experience already read, and the state fingerprint (9.6.1). It imports no
// checker (load.mjs, the schema modules), directly or through another module, so a page player that already holds the
// engine can give it to the replay recorder without the checker (web/logic-port.mjs). src/logic.mjs (the package's
// ./logic) adds the checked load of a package on top of it and is the public entry; this file is internal.
import { Player } from './story.mjs';
import { hostApi } from './host.mjs';
import { errorDetail } from './error-detail.mjs';
import { MOVES } from './runtime.mjs';
import { sha256 } from './members.mjs';

const refuse = (code, message) => { const e = new Error(message); e.code = code; throw e; };
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const BUILT_IN = ['entered', 'ended', 'openUrl', 'firstInput', 'hookHealth'];

// ---------- the state fingerprint (9.6.1) ----------
// The canonical JSON of a value (RFC 8785, the JSON Canonicalization Scheme): object keys sorted by UTF-16 code
// units, no white space, numbers in the ECMAScript form, strings escaped as JSON.stringify escapes them. An undefined
// member of an object is left out; an undefined item of an array is null.
export function canonicalJson(v) {
  if (v === null || typeof v !== 'object') return v === undefined ? 'null' : JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(',')}}`;
}

// The state document of a player (9.6.1): the logic state the next step depends on. In: the engine time, the timer
// sequence, every mounted block, the timers, the records, the ambient values but layout, the story, the host's pause
// reasons, whether firstInput was reported, and the stop. Out: revision, the last step's outputs and deliveries, the list counter (they count or carry
// what happened; the next step does not read them) and the ambient layout (a page measure). A freeText value is
// written as {freeText: its length}.
export function stateDocument(player) {
  const s = player.state;
  const free = Object.keys(player.exp.doc.inputs || {}).filter(n => player.exp.doc.inputs[n]?.contentType === 'freeText');
  const blocks = { ...s.blocks };
  if (free.length && blocks.experience) {
    const inputs = { ...blocks.experience.inputs };
    for (const n of free) if (typeof inputs[n] === 'string') inputs[n] = { freeText: inputs[n].length };
    blocks.experience = { ...blocks.experience, inputs };
  }
  const { layout, ...ambient } = s.ambient;
  void layout;
  const doc = { now: s.now, seq: s.seq, blocks, timers: s.timers, records: s.records, ambient, story: s.story, pauses: player.hostPauses || [] };
  if (s.firstInput) doc.firstInput = true; // only once reported, so a state before it keeps its fingerprint
  if (player.stopped) doc.stopped = player.stopped.code || 'fault';
  return JSON.parse(JSON.stringify(doc));
}

// The state fingerprint: "sha256:" and the 64 lowercase hex digits of the SHA-256 of the state document's canonical
// JSON as UTF-8.
export const fingerprintOf = (doc) => sha256(new TextEncoder().encode(canonicalJson(doc)));
export const fingerprint = (player) => fingerprintOf(stateDocument(player));

// ---------- the entry ----------
// logic(experience, options): as ./logic's logic() for an experience already read (loadExperience(...).experience, or
// what the lean mount reads). A package refuses with E-TYPE here: ./logic checks it first.
export function logic(source, { clock = null, epochMs = null, onMove = null, host = null, options = {}, capabilities = {}, modules = null, storage = undefined, onError = null } = {}) {
  if (clock !== null && typeof clock !== 'function') refuse('E-TYPE', 'clock is a function (engineMs) -> UTC ms');
  if (onMove !== null && typeof onMove !== 'function') refuse('E-TYPE', 'onMove is a function');
  if (source && source['package.json'] instanceof Uint8Array) refuse('E-TYPE', 'the logic core takes an experience already read: give a package to ./logic, which checks it');
  const experience = source;
  if (!experience?.doc) refuse('E-TYPE', 'logic takes a package or a checked experience');
  const player = new Player(experience, { capabilities, host, options, modules, storage, ...(typeof epochMs === 'number' ? { epochMs } : { wallClock: clock || (() => Date.now()) }), ...(onMove ? { onMove } : {}) });
  const api = hostApi(player, { onError: onError && ((d) => onError(errorDetail(d))), test: true });
  const outs = experience.doc.outputs || {};
  const heard = [];
  player.on(({ outputs }) => { for (const { name, ...detail } of outputs) if (BUILT_IN.includes(name) || outs[name]?.kind === 'event' || outs[name]?.kind === 'record') heard.push(JSON.parse(JSON.stringify({ t: player.state.now, name, detail }))); });
  const advance = (ms) => {
    if (!(typeof ms === 'number' && ms >= 0 && Number.isFinite(ms))) refuse('E-RANGE', 'advance takes a number of ms, 0 or more');
    return player.advance(ms);
  };
  // Feeds one move: the clock advances to its engine time, then the input runs as it did on the page.
  const feed = (move) => {
    if (!isObj(move) || typeof move.t !== 'number' || typeof move.source !== 'string' || !Array.isArray(move.payload)) refuse('E-TYPE', 'a move is {t, source, payload}: a number, a string and an array');
    player.fed = true; // the add-ons start no page step of their own now (door.fed())
    if (move.t < player.state.now) refuse('E-RANGE', `a move at ${move.t} ms comes after engine time ${player.state.now} ms: feed moves in their order`);
    if (move.t > player.state.now) advance(move.t - player.state.now);
    const args = move.payload.map(x => (x === null ? undefined : structuredClone(x)));
    const { source: s } = move;
    // A freeText value was heard by its length only (5.3.1): it is fed as that many x.
    if (s === 'setInput' && isObj(args[1]) && Number.isInteger(args[1].freeText)) args[1] = 'x'.repeat(args[1].freeText);
    if (s !== 'advance' && MOVES.includes(s)) return player[s](...args);
    if (s === 'door') return { ok: true, ignored: 'needs a page' };
    // An add-on's move <add-on>.<name> (9.6): the method <name> of what the add-on exposes on the player as <add-on>,
    // else its exposed function <add-on><Name> (the snapshot's snapshotStatus: the player has a method snapshot).
    const [cap, fn, ...more] = s.split('.');
    const whole = fn ? cap + fn[0].toUpperCase() + fn.slice(1) : '';
    if (!more.length && player.exposedNames?.has(cap) && typeof player[cap]?.[fn] === 'function') return player[cap][fn](...args) ?? { ok: true };
    if (!more.length && player.exposedNames?.has(whole) && typeof player[whole] === 'function') return player[whole](...args) ?? { ok: true };
    return refuse('E-REF-UNKNOWN', `${s} is not a move this player takes`);
  };
  return {
    feed,
    start: () => player.start(),
    advance,
    read: (name) => api.read(name),
    heard,
    fingerprint: () => fingerprint(player),
    state: () => stateDocument(player),
    get now() { return player.state.now; },
    host: api,
    player,
  };
}
