// Play-time change requests (`"at": "play"`, 9.10): the same request shape, the same checks in the same order as at
// edit time (request.mjs is shared), applied to a running experience's store in one transaction (9.2). The store
// revision is the engine's (it rises by one at each committed transaction). This module reaches the engine only
// through what the host side already uses: its experience inputs, `transaction`, and `send` for a trigger.
import { checkShape, checkReplay, checkInputValue, same } from './request.mjs';
import { CHECKS, TOOL } from './apply.mjs';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
// First receipts per engine, by target and id (a host keeps them as its audit trail; the trail is outside the format).
const LEDGERS = new WeakMap();

// player: a started Player (src/story.mjs). opts: {schemas, by (the authenticated by), now, seatAct}.
// seatAct: for a request with source seat (A4.1), the agent door's own act for the one entry the change names
// (agentDoor below); a seat's change is `<experience>/<seat input>` with the entry's payload as `new`.
// Returns the receipt. A refusal changes nothing.
export function requestAtPlay(player, req, opts = {}) {
  if (opts.by) req = { ...req, by: { ...opts.by } };
  const ledger = LEDGERS.get(player) ?? new Map();
  LEDGERS.set(player, ledger);
  const verdicts = {};
  const doc = player.exp.doc;
  const revision = () => player.state.revision;
  const finish = (status, extra = {}) => {
    for (const c of CHECKS) verdicts[c] ??= 'not-run';
    const r = { format: 'hsvg/2.0', kind: 'receipt', id: isObj(req) && typeof req.id === 'string' ? req.id : 'change-refused', run: 'change', subject: `document:${doc.id}`,
      digest: `revision:${revision()}`, date: (opts.now ?? new Date().toISOString()).replace(/\.\d{3}Z$/, 'Z'), status, rules: [], verdicts, authority: { checker: TOOL }, ...extra };
    if (isObj(req?.by)) r.by = req.by;
    if (Array.isArray(req?.changes)) r.changes = req.changes;
    return r;
  };
  const refuse = (check, errors) => {
    verdicts[check] = 'fail';
    const r = finish('fail', { previous: `revision:${revision()}`, errors: errors.map(e => ({ code: e.code, severity: 'error', ...(e.address ? { address: e.address } : {}), pointer: e.path ?? '', message: e.message })) });
    if (verdicts.shape === 'pass' && check !== 'replay') ledger.set(`${req.target}|${req.id}`, r);
    return r;
  };

  // 1. Shape.
  const shape = checkShape(req, opts.schemas);
  if (isObj(req) && req.at === 'edit') shape.push({ code: 'E-CHANGE-SHAPE', path: '/at', message: 'an edit-time change goes to the change tool, not to a running experience' });
  if (shape.length) return refuse('shape', shape);
  verdicts.shape = 'pass';
  // 2. Replay.
  const replay = checkReplay(req, ledger.get(`${req.target}|${req.id}`) ?? null);
  if (replay?.receipt) return replay.receipt;
  if (replay?.diag) return refuse('replay', [replay.diag]);
  verdicts.replay = 'pass';
  // 3. Revision, after resolving each address.
  if (req.target !== doc.id) return refuse('revision', [{ code: 'E-REF-UNKNOWN', path: '/target', message: `the running experience is ${doc.id}, not ${req.target}` }]);
  const inputs = player.state.blocks.experience.inputs;
  const seat = seatOf(doc, req.by);
  if (req.by?.source === 'seat' && req.changes.length !== 1) return refuse('revision', [{ code: 'E-CHANGE-SHAPE', path: '/changes', message: 'a seat sends one input at a time' }]);
  const targets = req.changes.map(c => (seat && seatTarget(c, doc, seat)) || reach(c, doc, inputs));
  const stale = [];
  if (req.expected !== undefined && Number(req.expected) !== revision()) stale.push({ code: 'E-CHANGE-STALE', path: '/expected', message: `expected revision ${req.expected}, but the store is at ${revision()}` });
  req.changes.forEach((c, i) => {
    const t = targets[i].target;
    if (!t || t.trigger || t.seat) return;
    if (!('old' in c)) stale.push({ code: 'E-CHANGE-STALE', path: `/changes/${i}/old`, address: c.address, message: `old is required; ${c.address} is now ${JSON.stringify(t.current)}` });
    else if (!same(c.old, t.current)) stale.push({ code: 'E-CHANGE-STALE', path: `/changes/${i}/old`, address: c.address, message: `old is ${JSON.stringify(c.old)}, but ${c.address} is now ${JSON.stringify(t.current)}` });
  });
  if (stale.length) return refuse('revision', stale);
  verdicts.revision = 'pass';
  // 4. Reach.
  const reachDiags = targets.map((t, i) => (t.diag ? { ...t.diag, path: `/changes/${i}/address` } : null)).filter(Boolean);
  if (reachDiags.length) return refuse('reach', reachDiags);
  verdicts.reach = 'pass';
  // 5. Type and bounds, never clamped.
  const typeDiags = [];
  req.changes.forEach((c, i) => {
    const t = targets[i].target;
    if (t.seat) return; // the engine checks a seat input's payload against its legal list (A4.1)
    if (t.trigger) { if (c.new !== null || 'old' in c) typeDiags.push({ code: 'E-TYPE', path: `/changes/${i}/new`, address: c.address, message: 'firing a trigger has new null and no old' }); return; }
    const r = checkInputValue(t.decl, c.new);
    if (r) typeDiags.push({ code: r[0], path: `/changes/${i}/new`, address: c.address, message: `${c.address}: ${r[1]}` });
  });
  if (typeDiags.length) return refuse('type', typeDiags);
  verdicts.type = 'pass';
  // 6. Rights: a seat's inputs (A4.1); the host is checked by its grants (10.6), which a set does not need.
  if (req.by?.right !== undefined) {
    const seats = doc.addons?.seats?.seats;
    const seat = Array.isArray(seats) ? seats.find(s => s?.id === req.by.right) : isObj(seats) ? seats[req.by.right] : null;
    const allowed = Array.isArray(seat?.inputs) ? seat.inputs : [];
    const no = req.changes.map((c, i) => (allowed.includes(targets[i].target.name) ? null : { code: 'E-SEAT-INPUT', path: `/changes/${i}`, address: c.address, message: seat ? `seat ${req.by.right} may not send ${targets[i].target.name}` : `${req.by.right} is not a seat of ${doc.id}` })).filter(Boolean);
    if (no.length) return refuse('rights', no);
  }
  verdicts.rights = 'pass';
  // 7. Rules: the engine checks its own rules in the transaction; the files proofs belong to edit time.
  verdicts.rules = 'pass';
  // 8. Apply: one transaction; a fault rolls everything back. A seat's input runs through the seat's own path (turns,
  // its legal list), which is one transaction too.
  const previous = revision();
  if (targets[0]?.target?.seat) {
    const done = typeof opts.seatAct === 'function' ? opts.seatAct() : { ok: false, error: { code: 'E-SEAT-INPUT', message: 'no seat connection runs this input' } };
    if (!done?.ok) return refuse('apply', [{ code: done?.error?.code ?? 'E-SEAT-INPUT', path: '/changes/0', address: req.changes[0].address, message: done?.error?.message ?? 'the seat refused the input' }]);
    verdicts.apply = 'pass';
    const receipt = finish('pass', { previous: `revision:${previous}` });
    ledger.set(`${req.target}|${req.id}`, receipt);
    return receipt;
  }
  const r = player.transaction(req.by?.source ?? 'host', () => {
    req.changes.forEach((c, i) => {
      const t = targets[i].target;
      if (t.trigger) { player.emit('experience', t.name, {}); return; }
      if (!same(player.state.blocks.experience.inputs[t.name], c.new)) {
        player.state.blocks.experience.inputs[t.name] = structuredClone(c.new);
        player.queueAll(`changed:${t.name}`);
      }
    });
  });
  player.afterCommit?.();
  if (r && r.ok === false) return refuse('apply', [{ code: r.fault.code, path: '', message: r.fault.message }]);
  verdicts.apply = 'pass';
  const receipt = finish('pass', { previous: `revision:${previous}` });
  ledger.set(`${req.target}|${req.id}`, receipt);
  return receipt;
}

// The seat a request with source seat names (by.right), or null.
function seatOf(doc, by) {
  if (by?.source !== 'seat' || typeof by.right !== 'string') return null;
  const seats = doc.addons?.seats?.seats;
  const s = Array.isArray(seats) ? seats.find(x => x?.id === by.right) : isObj(seats) ? seats[by.right] : null;
  return isObj(s) ? s : null;
}
// A seat's input (A4.1): `<experience>/<input>`, where <input> is one of the seat's inputs (a trigger, a
// <scene>/<control id> or a choice link). Returns {target} or null when the address names none of them.
function seatTarget(c, doc, seat) {
  const a = String(c.address);
  if (!a.startsWith(`${doc.id}/`)) return null;
  const name = a.slice(doc.id.length + 1);
  return (seat.inputs || []).includes(name) ? { target: { name, seat: true } } : null;
}

// The agent door (A4.1) through the checked path: each act is a play-time change request with source seat, checked by
// requestAtPlay (shape, replay, revision, reach, rights; 9.10) before the seat's own path runs it, and it leaves a
// receipt. conn: a connection of the seats capability (player.seats.connect(who)); who: the identity the host
// verified. opts: {schemas, now, receipts (an array the receipts are pushed to)}. The other calls pass through.
export function agentDoor(player, conn, who, opts = {}) {
  const lists = new Map(); let n = 0;
  const doc = player.exp.doc;
  return Object.freeze({
    seats: () => conn.seats(),
    join: (seat) => conn.join(seat),
    view: (seat) => conn.view(seat),
    leave: (seat) => conn.leave(seat),
    legal(seat) { const r = conn.legal(seat); if (r.ok) lists.set(seat, r.entries); return r; },
    act(seat, key) {
      const e = (lists.get(seat) || []).find(x => x.key === key);
      const req = {
        format: 'hsvg/2.0', kind: 'change', id: `seat-${seat}-${++n}`, at: 'play', target: doc.id,
        changes: [{ address: `${doc.id}/${e ? e.input : `?${key}`}`, new: e ? (e.payload ?? null) : null }],
      };
      const receipt = requestAtPlay(player, req, { schemas: opts.schemas, now: opts.now, by: { source: 'seat', right: seat, who }, seatAct: () => conn.act(seat, key) });
      opts.receipts?.push(receipt);
      if (receipt.status === 'pass') return { ok: true, receipt };
      const err = receipt.errors?.[0] ?? { code: 'E-SEAT-INPUT', message: 'refused' };
      return { ok: false, error: { code: err.code, message: err.message }, receipt };
    },
  });
}

// What a play-time address names: an input of the experience (`<experience>/<input>`). Body values are never
// reachable at play (E-HOST-PRIVATE); an inner path reaches inside a use (E-SEAL).
function reach(c, doc, inputs) {
  const segs = String(c.address).split('/');
  const diag = (code, message) => ({ diag: { code, address: c.address, message } });
  if (c.address.includes('#') || c.address.includes('@')) return diag('E-REF-UNKNOWN', `${c.address}: a pointer or a language address is an edit-time change`);
  if (segs[0] !== doc.id) return diag('E-REF-UNKNOWN', `the address starts with ${segs[0]}, not the target ${doc.id}`);
  if (segs.length > 2) return (doc.uses || []).some(u => u?.id === segs[1]) || doc.story?.scenes?.[segs[1]] !== undefined ? diag('E-SEAL', `${c.address} reaches inside ${segs[1]}; change it through an input the experience exposes`) : diag('E-REF-UNKNOWN', `${doc.id} has no scene or use ${segs[1]}`);
  const name = segs[1];
  const decl = doc.inputs?.[name];
  if (decl) return { target: { name, decl, trigger: decl.kind === 'trigger', current: inputs[name] } };
  if (doc.values?.[name] !== undefined || doc.computed?.[name] !== undefined) return diag('E-HOST-PRIVATE', `${name} is a body value; it is never reachable at play`);
  return diag('E-REF-UNKNOWN', `${doc.id} has no input ${name}`);
}
