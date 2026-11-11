// Cross-file rules: references and ids (2.6, 2.7, 2.9, 4.3, 5.11, 5.12, 5.15, 6.2.4, 6.7, 6.8).
// The schemas check each file alone; this checks what only shows across files: a use against its definition, a
// target against every frame of the drawing, a name against its scope. Each rule uses the code its section gives.
// The lines of a block: its lines add-on's pocket (D31), read here without the add-on's code.
const linesOf = (doc) => doc?.addons?.lines?.lines || {};
import { channelOf } from '../src/binding-words.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { framesOf } from './refs/drawn.mjs';
import { ROLE_PREFIXES } from './formula/infer.mjs';
import { walkBehaviour, resultLiterals, wordKeys, eachString, ptr } from './refs/walk.mjs';
import { reservedEvents } from './refs/events.mjs';
import { settingsOf } from '../src/widgets-of.mjs';

const AMBIENT = new Set(['now', 'elapsed', 'reducedMotion', 'timeLimits', 'inputMode', 'language', 'size', 'muted', 'volume', 'voice',
  'spoken', 'visits', 'canReturn', 'chapter', 'hooks', 'layout']);
const SETTABLE_AMBIENT = new Set(['muted', 'volume', 'voice', 'reducedMotion', 'timeLimits']);
const KEYS = /^(Key[A-Z]|Digit[0-9]|Space|Enter|ArrowLeft|ArrowRight|ArrowUp|ArrowDown|ShiftLeft|ShiftRight)$/;
const BUILT_IN_EVENTS = new Set(['save:invalid', 'save:unavailable', 'audio:started', 'audio:ended', 'returned', 'paused', 'resumed']); // seats:ended is the seats add-on's (its manifest)
// The capabilities and the events each owns, from the registry (10.11): a key <capability>:... must match one of its
// owner's patterns (physics:hit:<body>), else no handler can ever fire.
const REGISTRY = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'spec', '2.0', 'capabilities.json'), 'utf8'));
const CAP_EVENTS = new Map(REGISTRY.capabilities.map(c => [c.name, (c.owns?.events || []).filter(e => e.startsWith(`${c.name}:`)).map(e => {
  const parts = e.split(':');
  return { text: e, parts: parts.map(x => (/^<[^>]+>$/.test(x) ? { hole: x.slice(1, -1) } : x)) };
})]));
// Own names only (5.9): toString, valueOf and the other Object.prototype names are never declared names.
const hasOwn = (o, k) => o != null && typeof o === 'object' && Object.hasOwn(o, k);
const stripForm = (id) => id.replace(/\.(zero|one|two|few|many|other)$/, '');

// An event named for the start of a scene (F1a item 3): the actions that run when a scene starts go in its entry list.
const START_WORDS = new Set(['entered', 'start', 'enter', 'begin', 'ready']);
function startHint(key) {
  if (!START_WORDS.has(key)) return '';
  return `. To act when the scene starts, list the actions in the scene's entry instead of on: "entry": [{"play": "intro"}] (5.13)`;
}
// The inputs a use or a with may set (F1a item 6), for a message: "; its inputs are a, b" (the first 30).
const inputNames = (names) => (names.length ? `; its inputs are ${names.slice(0, 30).join(', ')}${names.length > 30 ? ` and ${names.length - 30} more` : ''}` : '; it has no inputs');

export function check(ctx) {
  const exp = ctx.experience;
  // A capability add-on's events (chapter 12, door 2): <id>:<name>, or <id>:<name>:<subject> for name:<subject>.
  const ADDON_EVENTS = new Map(Object.entries(exp.addons || {}).filter(([, a]) => a.manifest.kind === 'capability')
    .map(([id, a]) => [id, (a.manifest.adds.events || []).map(e => ({ text: `${id}:${e}`, parts: [id, ...String(e).split(':').map(x => (x === '<subject>' ? { hole: 'subject' } : x))] }))]));
  const kitPinned = exp.doc.kit !== undefined;
  const owners = [];
  for (const [id, s] of Object.entries(exp.scenes)) owners.push(makeOwner('scene', id, s, true));
  for (const [id, b] of Object.entries(exp.blocks)) owners.push(makeOwner(b.doc.kind || 'component', id, b, false));
  if (exp.shell) owners.push(makeOwner('shell', exp.shell.doc.id, exp.shell, true));
  const expOwner = { id: exp.doc.id, file: exp.file, doc: exp.doc, words: exp.words, inputs: new Map(Object.entries(exp.doc.inputs || {})) };

  // D22 for events: the bare built-in events are reserved as event names in every document (check/refs/events.mjs).
  const reserved = (file) => (path, n) => ctx.report('E-NAME-RESERVED', file, path, `${n} is a built-in event (5.12): it cannot be an author's event, trigger or output event; choose another name (5.9)`);
  reservedEvents(exp.doc, reserved(exp.file));
  for (const o of owners) {
    const r = (code, path, message, file = o.file) => ctx.report(code, file, path, message);
    reservedEvents(o.doc, reserved(o.file));
    checkUses(o, r);
    checkTargets(o, r);
    checkLooks(o, r);
    checkActions(o, r);
    checkReactionKeys(o, r);
    checkResources(o, r);
    checkIds(o, r);
  }
  const rx = (code, path, message) => ctx.report(code, exp.file, path, message);
  checkResourceTwice(expOwner, rx);
  checkIds(expOwner, rx);
  for (const o of [...owners, expOwner]) checkWords(o, (code, path, message) => ctx.report(code, o.file, path, message));

  // ---------- owners and scope ----------
  function makeOwner(kind, id, entry, outer) {
    const doc = entry.doc;
    const inputs = new Map(Object.entries(doc.inputs || {}));
    for (const p of doc.promote || []) {
      const name = p.as || String(p.from || '').split('/').pop();
      if (name && !inputs.has(name)) inputs.set(name, { kind: 'content' });
    }
    return { id, kind, file: entry.file, doc, drawings: entry.drawings, words: entry.words, outer, inputs, frames: framesOf({ doc, drawings: entry.drawings }) };
  }
  // The experience's own names that a scene or the shell shares (5.1.3).
  function expNames() {
    const inputs = new Set(Object.keys(exp.doc.inputs || {}));
    for (const p of exp.doc.promote || []) inputs.add(p.as || String(p.from || '').split('/').pop());
    return { values: new Set(Object.keys(exp.doc.values || {})), computed: new Set(Object.keys(exp.doc.computed || {})), inputs };
  }

  // ---------- 1. uses (4.3, 4.5) ----------
  function checkUses(o, r) {
    (o.doc.uses || []).forEach((u, i) => {
      const at = ptr('uses', i);
      if (typeof u.use !== 'string') return; // a declared or custom widget in a shell
      const names = [u.use, ...(Array.isArray(u.choices) ? u.choices : [])];
      names.forEach((n, k) => {
        if (hasOwn(exp.doc.blocks, n) || kitPinned || exp.blocks[n]?.kit !== undefined) return; // a kit's, or picked (4.8)
        r('E-REF-UNKNOWN', k === 0 ? `${at}/use` : `${at}/choices/${k - 1}`, `use ${u.id}: no block "${n}" in the experience's blocks`);
      });
      const def = exp.blocks[u.use];
      if (def) {
        const inputs = def.doc.inputs || {};
        const promoted = new Set((def.doc.promote || []).map(p => p.as || String(p.from || '').split('/').pop()));
        for (const key of Object.keys(u.with || {})) {
          if (!hasOwn(inputs, key) && !promoted.has(key)) r('E-REF-UNKNOWN', `${at}/with/${key}`, `use ${u.id}: "${key}" is not an input of ${u.use} (${def.file})${inputNames([...Object.keys(inputs).filter(n => inputs[n]?.kind !== 'trigger'), ...[...promoted].filter(n => !hasOwn(inputs, n))])}`);
        }
        for (const [name, decl] of Object.entries(inputs)) {
          if (decl.kind === 'trigger' || 'initial' in decl || decl.required === false) continue;
          if (!hasOwn(u.with, name)) r('E-KEY-REQUIRED', `${at}/with`, `use ${u.id}: input "${name}" of ${u.use} has no initial and is not supplied (${def.file})`);
        }
      }
      if (typeof u.into === 'string' && o.frames.length) {
        const miss = o.frames.filter(f => !(f.slots.has(u.into) || f.regions.has(u.into)));
        if (miss.length === o.frames.length) r('E-REF-UNKNOWN', `${at}/into`, `use ${u.id}: no slot or repeat group "${u.into}" is drawn in ${o.id}`);
        else for (const f of miss) r('E-LAYOUT-MISSING', `${at}/into`, `use ${u.id}: slot or repeat group "${u.into}" is not drawn in layout ${f.layout}`, f.file);
      }
    });
  }

  // ---------- 2. targets (5.11, 6.7, 6.8) ----------
  // A drawn id one or two letters away from a missing one (K2e): "; did you mean recycle-bin?".
  function nearId(o, name) {
    const ids = new Set(o.frames.flatMap(f => [...f.ids]));
    let best = null; let bestD = 3;
    for (const id of ids) { const d = editDistance(name, id, bestD); if (d < bestD) { best = id; bestD = d; } }
    return best ? `; did you mean ${best}?` : '';
  }
  function checkTarget(o, r, path, target, what) {
    if (typeof target !== 'string' || !o.frames.length) return;
    const miss = o.frames.filter(f => !f.ids.has(target));
    if (miss.length === o.frames.length) r('E-REF-UNKNOWN', path, `${what} "${target}" is not drawn in ${o.id}${nearId(o, target)}`);
    else for (const f of miss) r('E-LAYOUT-MISSING', path, `${what} "${target}" is not drawn in layout ${f.layout}`, f.file);
  }
  function checkTargets(o, r) {
    const d = o.doc;
    for (const [id, c] of Object.entries(d.controls || {})) {
      if (c.target !== undefined) checkTarget(o, r, ptr('controls', id, 'target'), c.target, `control ${id}: target`);
      for (const [oid, opt] of Object.entries(c.options || {})) checkTarget(o, r, ptr('controls', id, 'options', oid, 'target'), opt?.target, `control ${id}, option ${oid}: target`);
      // A drag's drops are parts of the same drawing (5.11): a typo such as "paper-bn" never lands (stress test B).
      if (Array.isArray(c.drops)) c.drops.forEach((x, k) => checkTarget(o, r, ptr('controls', id, 'drops', k), x, `control ${id}: drop`));
    }
    (d.bindings || []).forEach((b, i) => checkTarget(o, r, ptr('bindings', i, 'target'), b.target, `binding ${b.id ?? `#${i}`}: target`));
    for (const [cid, clip] of Object.entries(d.clips || {})) {
      (clip.tracks || []).forEach((t, i) => {
        checkTarget(o, r, ptr('clips', cid, 'tracks', i, 'target'), t.target, `clip ${cid}, track ${t.id ?? `#${i}`}: target`);
        (t.stagger?.targets || []).forEach((x, k) => checkTarget(o, r, ptr('clips', cid, 'tracks', i, 'stagger', 'targets', k), x, `clip ${cid}, track ${t.id ?? `#${i}`}: stagger target`));
      });
    }
    if (d.mouth?.target !== undefined) checkTarget(o, r, '/mouth/target', d.mouth.target, 'mouth target');
  }

  // ---------- 3. looks (6.2.4, 6.7, 6.8) ----------
  function checkLookNames(o, r, path, target, names) {
    if (typeof target !== 'string' || !names) return;
    for (const f of o.frames) {
      if (!f.ids.has(target)) continue; // the target check reports a missing part
      const have = f.looks.get(target) || new Set();
      for (const n of new Set(names)) {
        if (!have.has(n)) r('E-LOOK-NOT-DRAWN', path, `variant "${n}" of ${target} is not drawn in layout ${f.layout}`, f.file);
      }
    }
  }
  function checkLooks(o, r) {
    const d = o.doc;
    (d.bindings || []).forEach((b, i) => {
      if (typeof b.variant === 'string' && (b.as ?? 'drawn') === 'drawn') checkLookNames(o, r, ptr('bindings', i, 'variant'), b.target, resultLiterals(b.variant));
      // An icon by id (6.2.2) shows in an icon place: a nested <svg> part with role icon, in every layout.
      if (b.as === 'icon' && typeof b.target === 'string') for (const f of o.frames) if (f.ids.has(b.target) && !f.icons.has(b.target)) r('E-PLACE', ptr('bindings', i, 'target'), `binding ${b.id ?? `#${i}`}: an icon shows in an icon place, a nested <svg> part with data-hsvg-role="icon"; ${b.target} is not one in layout ${f.layout} (6.2.2)`, f.file);
    });
    for (const [cid, clip] of Object.entries(d.clips || {})) {
      (clip.tracks || []).forEach((t, i) => {
        if (channelOf(t) !== 'look') return;
        const names = [];
        (t.keys || []).forEach((k) => { const lits = resultLiterals(k[1]); if (lits) names.push(...lits); });
        checkLookNames(o, r, ptr('clips', cid, 'tracks', i, 'keys'), t.target, names);
        (t.stagger?.targets || []).forEach(x => checkLookNames(o, r, ptr('clips', cid, 'tracks', i, 'keys'), x, names));
      });
    }
    if (d.mouth?.target && d.mouth.cues) checkLookNames(o, r, '/mouth/cues', d.mouth.target, Object.values(d.mouth.cues).filter(x => typeof x === 'string'));
  }

  // ---------- 4. actions (5.15.1) ----------
  function writableCheck(o, r, a, p) {
    const e = expNames();
    const own = o.doc;
    const classify = (name) => {
      if (hasOwn(own.values, name)) return 'ok';
      if (o.inputs.has(name) || hasOwn(own.computed, name) || hasOwn(own.outputs, name)) return 'input';
      if (o.outer) {
        if (e.values.has(name)) return 'ok';
        if (e.inputs.has(name) || e.computed.has(name)) return 'input';
      }
      // a built-in no visible name hides (D22)
      if (AMBIENT.has(name)) return 'input';
      if (!o.outer && (e.values.has(name) || e.inputs.has(name) || e.computed.has(name))) return 'private';
      return 'unknown';
    };
    for (const op of ['set']) {
      if (typeof a[op] !== 'string') continue;
      const c = classify(a[op]);
      if (c === 'input') r('E-WRITE-INPUT', `${p}/${op}`, `${a[op]} is an input, a computed value, an output or an ambient input: only its source writes it. Declare a value under "values" (for example "values": {"${a[op]}Now": {"type": "number", "initial": 0}}) and set that; a control may write a knob directly with "value"`);
      else if (c === 'private') r('E-REF-PRIVATE', `${p}/${op}`, `${a[op]} belongs to the experience; ${o.id} sees nothing outside itself`);
      else if (c === 'unknown') r('E-REF-UNKNOWN', `${p}/${op}`, `${a[op]} is not a value of ${o.id}`);
    }
    const setName = a.call === 'player.setting' && a.with && typeof a.with === 'object' ? Object.keys(a.with)[0] : undefined;
    if (typeof setName === 'string') {
      const name = setName;
      const items = (settingsOf(exp.doc)?.items || []);
      // the knobs of the experience's audio mix (6.10) are listed by the settings form too
      const mix = [...Object.values(exp.doc.audio?.groups || {}), ...Object.values(exp.doc.audio?.mutes || {})];
      if (SETTABLE_AMBIENT.has(name) || mix.includes(name) || items.some(it => it.knob === name && it.when === 'play')) return;
      const known = e.inputs.has(name) || o.inputs.has(name) || hasOwn(own.values, name);
      r(known ? 'E-WRITE-INPUT' : 'E-REF-UNKNOWN', `${p}/with/${name}`, known
        ? `${name} is not a knob that a settings item with when "play" names`
        : `${name} is not a knob or an ambient setting`);
    }
  }
  // A formula that is one quoted text: the text, else null.
  function quoted(f) { const m = typeof f === 'string' ? /^\s*'([^'\\]*)'\s*$/.exec(f) : null; return m ? m[1] : null; }
  function resolveSound(o, id) {
    const res = o.doc.resources?.[id] || exp.doc.resources?.[id];
    if (res) return res.kind === 'sound';
    return hasOwn(exp.doc.audioSynths, id);
  }
  function checkActions(o, r) {
    const d = o.doc;
    const uses = new Map((d.uses || []).map(u => [u.id, u]));
    const playable = new Set(Object.keys(d.clips || {}));
    const localPart = (id) => o.frames.length > 0 && o.frames.every(f => f.ids.has(id));
    walkBehaviour(d, {
      action(a, p) {
        writableCheck(o, r, a, p);
        for (const op of ['play', 'stop']) {
          if (op === 'play' && a.as === 'sound') continue;
          if (typeof a[op] === 'string' && !playable.has(a[op])) r('E-REF-UNKNOWN', `${p}/${op}`, `no clip or effect "${a[op]}" in ${o.id}`);
        }
        if (typeof a.emit === 'string' && a.as === 'trigger') {
          const [uid, ...rest] = a.emit.split('.');
          const name = rest.join('.');
          const u = uses.get(uid);
          const def = u && exp.blocks[u.use];
          if (!u) r('E-REF-UNKNOWN', `${p}/emit`, `no use "${uid}" in ${o.id}`);
          else if (def && def.doc.inputs?.[name]?.kind !== 'trigger') r('E-REF-UNKNOWN', `${p}/emit`, `${u.use} (${def.file}) has no trigger input "${name}"`);
        }
        // player.attach (6.9, D33): a quoted use of this block, and a quoted slot or null. An attach point is a slot: an
        // empty <g data-hsvg-slot> of this block, or of a use ('bike.basket-point'), which that block lists in places.
        const att = a.call === 'player.attach' && a.with && typeof a.with === 'object' ? a.with : null;
        const part = att ? quoted(att.part) : null; const dest = att ? quoted(att.to) : null;
        if (att && part !== null && !uses.has(part)) r('E-REF-UNKNOWN', `${p}/with/part`, `"${part}" is not a use of ${o.id}: player.attach moves a use onto a slot${localPart(part) ? ' (a drawn part moves with its parent, or follows a leader, 6.2.1)' : ''}`);
        if (dest !== null) {
          const [first, ...rest] = dest.split('.');
          const name = rest.join('.');
          if (rest.length) {
            const u = uses.get(first);
            const def = u && exp.blocks[u.use];
            const drawn = def && framesOf({ doc: def.doc, drawings: def.drawings }).every(f => f.slots.has(name));
            if (!u) r('E-REF-UNKNOWN', `${p}/with/to`, `no use "${first}" in ${o.id}`);
            else if (def && !drawn) r('E-REF-UNKNOWN', `${p}/with/to`, `${u.use} (${def.file}) draws no slot "${name}" in every frame: an attach point is an empty <g data-hsvg-slot="${name}"> inside the part it rides on (6.9)`);
            else if (def && def.doc.places?.[name]?.kind !== 'slot') r('E-REF-UNKNOWN', `${p}/with/to`, `${u.use} (${def.file}) does not expose the slot "${name}": list it in places, as "places": {"${name}": {"kind": "slot"}} (4.3)`);
          } else if (o.frames.length && !o.frames.every(f => f.slots.has(first))) r('E-REF-UNKNOWN', `${p}/with/to`, `slot "${first}" is not drawn in every frame of ${o.id} (an attach point is a slot, 6.9)`);
        }
        if (a.play !== undefined && a.as === 'sound') {
          for (const id of resultLiterals(a.play) || []) if (!resolveSound(o, id)) r('E-REF-UNKNOWN', `${p}/play`, `no sound "${id}" in ${o.id} or the experience`);
        }
      },
    });
  }

  // ---------- 5. reaction keys (5.12, 5.13) ----------
  function producers(o) {
    const d = o.doc;
    const ev = new Set();
    for (const [k, i] of o.inputs) if (i.kind === 'trigger') ev.add(k);
    if (o.outer) for (const [k, i] of Object.entries(exp.doc.inputs || {})) if (i.kind === 'trigger') ev.add(k);
    const press = new Set();
    for (const c of Object.values(d.controls || {})) {
      if (c.event) ev.add(c.event); else if ((c.kind === 'button' || c.kind === 'toggle') && c.target) press.add(c.target);
      if (c.missEvent) ev.add(c.missEvent);
      for (const opt of Object.values(c.options || {})) if (opt?.event) ev.add(opt.event);
    }
    for (const clip of Object.values(d.clips || {})) for (const m of clip.markers || []) if (m.event) ev.add(m.event);
    // A media binding's markers (A2.1) fire their events like clip markers.
    for (const b of Array.isArray(d.bindings) ? d.bindings : []) if (b && typeof b.media?.video === 'string') for (const m of Array.isArray(b.media.markers) ? b.media.markers : []) if (m?.event) ev.add(m.event);
    for (const line of Object.values(linesOf(d))) {
      for (const v of Object.values(line.voices || {})) for (const w of v.words || []) if (w.event) ev.add(w.event);
    }
    const actionIds = new Set();
    const marks = [];
    walkBehaviour(d, {
      action(a) {
        if (typeof a.emit === 'string' && (a.as ?? 'event') === 'event') ev.add(a.emit);
        if (typeof a.event === 'string') ev.add(a.event);
        if (a.id) actionIds.add(a.id);
        if (a.id && (a.call === 'page.point' || a.call === 'page.highlight')) marks.push(a.id);
      },
    });
    return { ev, press, actionIds, marks };
  }
  function checkReactionKeys(o, r) {
    const d = o.doc;
    const p = producers(o);
    const e = expNames();
    const uses = new Map((d.uses || []).map(u => [u.id, u]));
    const ended = new Set([...Object.keys(d.clips || {}), ...p.actionIds]);
    const changeable = (name) => hasOwn(d.values, name) || o.inputs.has(name) || AMBIENT.has(name)
      || (o.outer && (e.values.has(name) || e.inputs.has(name)));
    // A capability event (10.11): its key matches one of the owner's patterns; a <body> is a physics body of this
    // block, an <effect> one of its particle effects, a <line> one of its spoken lines, a <hook> a page hook of the
    // experience, a <mark> the id of a page.point or page.highlight call, a <place> the target of one of its video bindings.
    const holes = {
      line: () => Object.keys(linesOf(d)),
      hook: () => Object.keys(exp.doc.addons?.page?.hooks || {}),
      mark: () => p.marks,
      body: () => Object.keys(d.addons?.physics?.bodies || {}),
      effect: () => Object.keys(d.addons?.effects?.particles || {}),
      place: () => (Array.isArray(d.bindings) ? d.bindings : []).filter(b => b && b.media?.video !== undefined && typeof b.target === 'string').map(b => b.target),
    };
    const capabilityEvent = (key, head, bad) => {
      const given = key.split(':');
      const patterns = CAP_EVENTS.get(head) ?? ADDON_EVENTS.get(head);
      const shaped = patterns.filter(pt => pt.parts.length === given.length && pt.parts.every((x, i) => typeof x !== 'string' || x === given[i]));
      if (!shaped.length) { bad(patterns.length ? `is not an event of the capability ${head}: it gives ${patterns.map(x => x.text).join(', ')}` : `is not an event: the capability ${head} gives none`); return; }
      for (const pt of shaped) {
        const miss = pt.parts.map((x, i) => (typeof x === 'string' || !holes[x.hole] || holes[x.hole]().includes(given[i]) ? null : `${x.hole} ${given[i]}`)).find(Boolean);
        if (!miss) return;
        bad(`names no ${miss} in ${o.id}, so it never fires (${pt.text})`);
        return;
      }
    };
    walkBehaviour(d, {
      onKey(key, path) {
        const bad = (why) => r('E-REF-UNKNOWN', path, `"${key}" ${why}`);
        if (p.ev.has(key) || BUILT_IN_EVENTS.has(key)) return;
        const colon = key.indexOf(':');
        const head = colon < 0 ? key : key.slice(0, colon);
        const tail = colon < 0 ? '' : key.slice(colon + 1);
        if (head === 'press') { if (!p.press.has(tail)) bad(`is not the event of a button or toggle without its own event in ${o.id}`); return; }
        if (head === 'changed' && tail.startsWith('hsvg.')) { if (!AMBIENT.has(tail.slice(5))) bad(`names no built-in value: changed:hsvg.<name> hears a built-in such as now, language or size (5.9)`); return; }
        if (head === 'changed') { if (!changeable(tail)) bad(`names no value or input of ${o.id} (computed values emit no changed event)`); return; }
        if (head === 'ended') { if (!ended.has(tail)) bad(`names no clip, effect, line or action of ${o.id}`); return; }
        if (head === 'key' || head === 'keyUp') { if (!KEYS.test(tail)) bad('is not a key of the fixed set'); return; }
        if (head === 'page' && !tail.startsWith('ended:')) return; // page signals are the page family's (check/page.mjs)
        if (colon >= 0 && (CAP_EVENTS.has(head) || ADDON_EVENTS.has(head))) { capabilityEvent(key, head, bad); return; }
        if (colon >= 0 && /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(head)) { bad(`names no capability add-on this experience pins (${head}): pin it in about.trust.pins (chapter 12)`); return; }
        const dot = key.indexOf('.');
        if (dot > 0) {
          const u = uses.get(key.slice(0, dot));
          const def = u && exp.blocks[u.use];
          const name = key.slice(dot + 1);
          if (!u) bad(`names no use "${key.slice(0, dot)}" in ${o.id}`);
          else if (def && !(hasOwn(def.doc.outputs, name) && ['event', 'record'].includes(def.doc.outputs[name].kind))) {
            bad(`is not an output event or record of ${u.use} (${def.file})`);
          }
          return;
        }
        bad(`has no producer in ${o.id}: no emit, control, marker, trigger input or built-in event gives it${startHint(key)}`);
      },
    });
  }

  // ---------- 6. resources (2.6) ----------
  function checkResourceTwice(o, r) {
    const byFile = new Map();
    const byDigest = new Map();
    for (const [id, res] of Object.entries(o.doc.resources || {})) {
      if (res.file !== undefined && byFile.has(res.file)) {
        r('E-RESOURCE-TWICE', ptr('resources', id), `${id} and ${byFile.get(res.file)} declare the file ${res.file}`);
        continue;
      }
      if (res.file !== undefined) byFile.set(res.file, id);
      if (res.digest !== undefined && byDigest.has(res.digest)) {
        r('E-RESOURCE-TWICE', ptr('resources', id), `${id} and ${byDigest.get(res.digest)} have equal digests`);
      } else if (res.digest !== undefined) byDigest.set(res.digest, id);
    }
  }
  function checkResources(o, r) {
    checkResourceTwice(o, r);
    // A words file is never named by its id, so two levels may each declare one (2.7: the owner's words win).
    for (const [id, res] of Object.entries(o.doc.resources || {})) {
      if (res.kind !== 'words' && hasOwn(exp.doc.resources, id)) r('E-NAME-SHADOW', ptr('resources', id), `resource ${id} is also declared by the experience (${exp.file})`);
    }
    if (o.doc.music?.sound !== undefined && !resolveSound(o, o.doc.music.sound)) {
      r('E-REF-UNKNOWN', '/music/sound', `no sound "${o.doc.music.sound}" in ${o.id} or the experience`);
    }
    if (o.outer) {
      const e = expNames();
      for (const group of ['values', 'computed', 'inputs']) {
        for (const n of Object.keys(o.doc[group] || {})) {
          if (e.values.has(n) || e.computed.has(n) || e.inputs.has(n)) r('E-NAME-SHADOW', ptr(group, n), `${n} hides a name of the experience (${exp.file})`);
        }
      }
    }
  }

  // ---------- 7. words (2.7, 5.7) ----------
  function checkWords(o, r) {
    const lang = exp.doc.language;
    if (!lang) return;
    // a translation adds no word the default language lacks (2.7)
    const base = new Set(Object.keys(o.words?.[lang] || {}).map(stripForm));
    for (const [l, words] of Object.entries(o.words || {})) {
      if (l === lang) continue;
      for (const id of Object.keys(words)) if (!base.has(stripForm(id))) r('E-WORDS-UNKNOWN', '/resources', `${l} adds the word "${id}" that ${lang} does not have in ${o.id}`);
    }
    const have = (key) => [o.words?.[lang], exp.words?.[lang]].some(w => w && (hasOwn(w, key) || hasOwn(w, `${key}.other`)));
    const seen = new Set();
    const scan = (src, path, isTemplate) => {
      for (const key of wordKeys(src, isTemplate)) {
        const sig = `${path}|${key}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        if (!have(key)) r('E-REF-UNKNOWN', path, `word "${key}" is in no ${lang} words file of ${o.id} or the experience`);
      }
    };
    eachString(o.doc, (s, path) => { if (s.includes('{{')) scan(s, path, true); });
    for (const [name, f] of Object.entries(o.doc.computed || {})) if (typeof f === 'string') scan(f, ptr('computed', name), false);
  }

  // ---------- 8. ids (2.9, 5.3) ----------
  function checkIds(o, r) {
    const d = o.doc;
    // inputs, values and computed values share one namespace
    const names = new Map();
    for (const group of ['inputs', 'values', 'computed']) {
      for (const n of Object.keys(d[group] || {})) {
        if (names.has(n)) r('E-ID-DUPLICATE', ptr(group, n), `${n} is already a ${names.get(n)} of ${o.id}`);
        else names.set(n, group);
      }
    }
    // A dot joins only a role prefix and a field of that role (5.3.1): any other dotted name would read as a member of
    // a name that does not exist, so the checker and the engine would read it differently.
    for (const group of ['inputs', 'values', 'computed']) {
      for (const n of Object.keys(d[group] || {})) {
        const dot = n.indexOf('.');
        if (dot >= 0 && !ROLE_PREFIXES.has(n.slice(0, dot))) r('E-NAME-SHAPE', ptr(group, n), `${n}: only a role prefix (${[...ROLE_PREFIXES].slice(0, 3).join(', ')}, ...) joins a field with a dot; write it in camelCase (5.3.1)`);
      }
    }
    // The host and a parent reach a block by one name: one name is not both an input and an output (5.4, 10.6), or
    // the host's set writes the input while read returns the output.
    for (const n of Object.keys(d.outputs || {})) {
      if (Object.hasOwn(d.inputs || {}, n)) r('E-ID-DUPLICATE', ptr('outputs', n), `${n} is both an input and an output of ${o.id}; set would write the input and read would return the output: rename one (5.4)`);
    }
    for (const [i, u] of (d.uses || []).entries()) {
      if (u.id !== undefined && names.has(u.id)) r('E-ID-DUPLICATE', ptr('uses', i, 'id'), `use id ${u.id} equals a ${names.get(u.id)} of ${o.id}`);
    }
    // JSON ids are unique across kinds in one document
    const ids = new Map();
    const take = (id, path, kind) => {
      if (typeof id !== 'string') return;
      if (ids.has(id)) r('E-ID-DUPLICATE', path, `id ${id} is used twice in ${o.id}: ${ids.get(id)} and ${kind}`);
      else ids.set(id, `${kind} at ${path}`);
    };
    (d.layouts || []).forEach((l, i) => take(l.id, ptr('layouts', i, 'id'), 'layout'));
    (d.uses || []).forEach((u, i) => take(u.id, ptr('uses', i, 'id'), 'use'));
    for (const k of Object.keys(d.controls || {})) take(k, ptr('controls', k), 'control');
    (d.bindings || []).forEach((b, i) => take(b.id, ptr('bindings', i, 'id'), 'binding'));
    for (const [k, clip] of Object.entries(d.clips || {})) {
      take(k, ptr('clips', k), 'clip');
      const local = new Set();
      const own = (id, path) => {
        if (typeof id !== 'string') return;
        if (local.has(id)) r('E-ID-DUPLICATE', path, `id ${id} is used twice in clip ${k}`);
        else local.add(id);
      };
      (clip.tracks || []).forEach((t, i) => own(t.id, ptr('clips', k, 'tracks', i, 'id')));
      (clip.markers || []).forEach((m, i) => own(m.id, ptr('clips', k, 'markers', i, 'id')));
    }
    for (const k of Object.keys(d.addons?.effects?.particles || {})) take(k, ptr('addons', 'effects', 'particles', k), 'effect');
    for (const k of Object.keys(linesOf(d))) take(k, ptr('addons', 'lines', 'lines', k), 'line');
    (Array.isArray(d.rules) ? d.rules : []).forEach((x, i) => take(x.id, ptr('rules', i, 'id'), 'rule'));
    walkBehaviour(d, {
      machine: (k, p) => take(k, p, 'machine'),
      reaction: (x, p) => take(x.id, `${p}/id`, 'reaction'),
      action: (x, p) => take(x.id, `${p}/id`, 'action'),
    });
    // machine states are unique inside their machine
    for (const [mk, m] of Object.entries(d.machines || {})) {
      const states = new Set();
      const go = (n, path) => {
        for (const sk of Object.keys(n.states || {})) {
          if (states.has(sk)) r('E-ID-DUPLICATE', `${path}/states/${sk}`, `machine state ${sk} is used twice in machine ${mk}`);
          states.add(sk);
          go(n.states[sk], `${path}/states/${sk}`);
        }
      };
      go(m, ptr('machines', mk));
      // A transition's target is a state of its machine, and a state with states has one of them as initial
      // (5.14), as the engine faults at play: E-MACHINE-TARGET, E-MACHINE-INITIAL.
      const targets = (n, path) => {
        if (!n || typeof n !== 'object') return;
        if (n.states && typeof n.states === 'object' && !(typeof n.initial === 'string' && Object.hasOwn(n.states, n.initial))) r('E-MACHINE-INITIAL', `${path}/initial`, `machine ${mk}: ${n.initial === undefined ? 'no initial' : `initial ${n.initial} is not one of its states`} (5.14)`);
        const check = (t, at) => { if (t && typeof t.target === 'string' && !states.has(t.target)) r('E-MACHINE-TARGET', `${at}/target`, `machine ${mk}: ${t.target} is not a state of the machine (5.14)`); };
        (Array.isArray(n.after) ? n.after : []).forEach((t, i) => check(t, `${path}/after/${i}`));
        for (const [ev, list] of Object.entries(n.on && typeof n.on === 'object' ? n.on : {})) (Array.isArray(list) ? list : [list]).forEach((t, i) => check(t, `${path}/on/${ev}/${i}`));
        for (const sk of Object.keys(n.states || {})) targets(n.states[sk], `${path}/states/${sk}`);
      };
      targets(m, ptr('machines', mk));
    }
  }
}

// The edit distance of two names, or `cap` once it is clear the distance is at least cap.
function editDistance(a, b, cap) {
  if (Math.abs(a.length - b.length) >= cap) return cap;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (Math.min(...cur) >= cap) return cap;
    prev = cur;
  }
  return Math.min(prev[b.length], cap);
}
