// Player seats on files (A4.1, 10.7). The schemas check the shape of addons.seats; this family checks what it names.
// - A seat input is a trigger of the experience, <scene>/<control id> of a scene of the story, or a choice link id
//   (E-SEAT-INPUT). A seat's view, the public values, a strict turn's value and the end's values name values of the
//   experience or of a scene (E-REF-UNKNOWN), of the right type (E-TYPE).
// - A strict turn's values give a string for every player seat and name no other (E-TYPE, E-REF-UNKNOWN); an
//   alternating or simultaneous turn's order lists player seats (E-REF-UNKNOWN), and alternating needs one (E-TYPE).
// - end.done is a boolean value; end.winner a string value whose type admits "draw" when maxMoves or a draw fallback can
//   end play, and the seat ids when a forfeit can (E-TYPE).
// - addons.seats.legal maps a trigger a seat lists to an array value (E-REF-UNKNOWN, E-TYPE).
// - A program filler or fallback names its program (E-REF-UNKNOWN); the program is a module pinned in
//   about.trust.pins to the digest this engine's reviewed lock lists (E-MODULE-REVIEW).
// - W-HUMAN-ONLY-PATH: an input of a seat an agent or a program may fill reaches a human-only action.
// Character seats are the ai family's (ai.mjs).
import { reviewedLock } from './modules.mjs';
import { humanOnlyCall } from './builtins.mjs';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v : []);

export function check(ctx) {
  const exp = ctx.experience;
  doorExp = exp;
  const play = exp.doc.addons?.seats; // the settings: addons.seats (D31)
  if (!isObj(play) || !isObj(play.seats)) return;
  const file = exp.file || 'experience.json';
  const report = (code, at, msg) => ctx.report(code, file, at, msg);
  const scenes = Object.values(exp.scenes || {});
  const sceneById = new Map(scenes.map(s => [s.doc?.id, s.doc]));
  const decl = (name) => {
    for (const d of [exp.doc, ...scenes.map(s => s.doc)]) {
      const v = d?.values?.[name] ?? d?.computed?.[name];
      if (v) return v;
    }
    return null;
  };
  const value = (name, at, what, type) => {
    const d = typeof name === 'string' ? decl(name) : null;
    if (!d) { report('E-REF-UNKNOWN', at, `${what} names no value ${name} of the experience or a scene`); return null; }
    if (type && d.type && d.type !== type) report('E-TYPE', at, `${what} names ${name}, a ${d.type}; it must be a ${type}`);
    return d;
  };
  const inputs = isObj(exp.doc.inputs) ? exp.doc.inputs : {};
  const isTrigger = (n) => inputs[n]?.kind === 'trigger';
  const isChoice = (n) => list(exp.doc.story?.links).some(l => isObj(l) && l.id === n && l.choice !== undefined);
  const isControl = (n) => {
    const i = n.indexOf('/');
    return i > 0 && isObj(sceneById.get(n.slice(0, i))?.controls?.[n.slice(i + 1)]);
  };
  const players = Object.keys(play.seats).filter(id => play.seats[id]?.kind === 'player');
  const listed = new Set();
  const pins = isObj(exp.doc.about?.trust?.pins) ? exp.doc.about.trust.pins : {};
  const lock = reviewedLock();
  let draws = play.end?.maxMoves !== undefined; let forfeits = false;

  for (const id of players) {
    const s = play.seats[id]; const at = `addons.seats.seats.${id}`;
    list(s.inputs).forEach((n, i) => {
      listed.add(n);
      if (!isTrigger(n) && !isControl(n) && !isChoice(n)) report('E-SEAT-INPUT', `${at}.inputs[${i}]`, `${n} is not a trigger of the experience, a <scene>/<control id> or a choice link`);
    });
    list(s.view).forEach((n, i) => value(n, `${at}.view[${i}]`, `the view of seat ${id}`));
    const fb = s.fallback;
    const then = isObj(fb) ? fb.then : fb;
    if (then === 'draw') draws = true;
    if (then === 'forfeit' || (s.timeoutMs !== undefined && fb === undefined)) forfeits = true;
    const name = (isObj(fb) && fb.program) || s.program;
    const wantsProgram = list(s.fillers).includes('program') || then === 'program';
    if (wantsProgram && typeof name !== 'string') report('E-REF-UNKNOWN', at, `seat ${id} can be filled by a program but names none (program, or fallback.program)`);
    for (const [n, where] of [[s.program, `${at}.program`], [isObj(fb) ? fb.program : undefined, `${at}.fallback.program`]]) {
      if (typeof n !== 'string') continue;
      const pinned = Object.keys(pins).find(k => k.startsWith(`${n}@`));
      if (!pinned) report('E-MODULE-REVIEW', where, `the program ${n} is not pinned in about.trust.pins`);
      else if (!lock[pinned]) report('E-MODULE-REVIEW', where, `${pinned} is not in this engine's reviewed lock`);
      else if (lock[pinned] !== pins[pinned]) report('E-MODULE-REVIEW', where, `the pin ${pins[pinned]} of ${pinned} is not the reviewed digest ${lock[pinned]}`);
    }
  }

  const t = play.turns;
  if (isObj(t)) {
    if (t.kind === 'strict') {
      const d = value(t.value, 'addons.seats.turns.value', 'the strict turn', 'string');
      const vals = isObj(t.values) ? t.values : {};
      for (const id of players) if (!(id in vals) && isObj(t.values)) report('E-TYPE', 'addons.seats.turns.values', `the strict turn gives no value for seat ${id}`);
      if (!isObj(t.values) && d?.enum) for (const id of players) if (!d.enum.includes(id)) report('E-TYPE', 'addons.seats.turns', `the turn value ${t.value} cannot name seat ${id}; give play.turns.values`);
      for (const [id, v] of Object.entries(vals)) {
        if (!players.includes(id)) report('E-REF-UNKNOWN', `addons.seats.turns.values.${id}`, `${id} is not a player seat`);
        else if (d?.enum && !d.enum.includes(v)) report('E-TYPE', `addons.seats.turns.values.${id}`, `${JSON.stringify(v)} is not a value ${t.value} can hold`);
      }
    } else {
      if (t.kind === 'alternating' && !Array.isArray(t.order)) report('E-TYPE', 'addons.seats.turns', 'alternating turns list the seats in order');
      // Simultaneous turns have no seat on turn, so no value to write (A4.1); alternating turns write it.
      if (t.kind === 'simultaneous' && t.value !== undefined) report('E-TYPE', 'addons.seats.turns.value', 'simultaneous turns have no seat on turn: remove value');
      if (t.kind === 'alternating' && t.value !== undefined) {
        const d = value(t.value, 'addons.seats.turns.value', 'the alternating turn', 'string');
        const vals = isObj(t.values) ? t.values : {};
        for (const id of players) {
          const v = id in vals ? vals[id] : id;
          if (d?.enum && !d.enum.includes(v)) report('E-TYPE', 'addons.seats.turns', `the turn value ${t.value} cannot hold ${JSON.stringify(v)} for seat ${id}`);
        }
      }
      list(t.order).forEach((id, i) => { if (!players.includes(id)) report('E-REF-UNKNOWN', `addons.seats.turns.order[${i}]`, `${id} is not a player seat`); });
    }
  }

  const e = play.end;
  if (isObj(e)) {
    value(e.done, 'addons.seats.end.done', 'end.done', 'boolean');
    const w = value(e.winner, 'addons.seats.end.winner', 'end.winner', 'string');
    const must = [...(draws ? ['draw'] : []), ...(forfeits ? players : [])];
    for (const v of must) {
      if (!w || w.type !== 'string') break;
      if ((w.enum && !w.enum.includes(v)) || (w.maxLength !== undefined && v.length > w.maxLength)) report('E-TYPE', 'addons.seats.end.winner', `${e.winner} cannot hold ${JSON.stringify(v)}, which ${v === 'draw' ? 'a draw' : 'a forfeit'} writes`);
    }
  }

  for (const [trigger, name] of Object.entries(isObj(play.legal) ? play.legal : {})) {
    const at = `addons.seats.legal.${trigger}`;
    if (!isTrigger(trigger)) report('E-REF-UNKNOWN', at, `${trigger} is not a trigger of the experience`);
    else if (!listed.has(trigger)) report('E-REF-UNKNOWN', at, `no seat lists the trigger ${trigger} in its inputs`);
    const d = value(name, at, `the legal list of ${trigger}`, 'array');
    if (d?.items && inputs[trigger]?.payload && d.items.type !== 'object') report('E-TYPE', at, `${name} holds ${d.items.type}s; a legal list holds the trigger's payloads (objects)`);
  }
  list(play.public).forEach((n, i) => value(n, `addons.seats.public[${i}]`, 'the public values'));
  humanOnlyPaths(ctx, exp, play, players, sceneById);
}

// W-HUMAN-ONLY-PATH (5.15.4, A4.1): a seat that an agent or a program may fill lists an input whose reactions (and
// the events they emit, in the same block) reach a human-only action. Seats never get person authority.
let doorExp = null; // the experience whose add-ons' humanOnly calls count (door 2)
const isHumanOnly = (a) => a.invoke !== undefined || a.call === 'player.openUrl' || (a.call === 'player.setting' && !(isObj(a.with) && a.with.voice === false)) || humanOnlyCall(doorExp, a);
function humanOnlyPaths(ctx, exp, play, players, sceneById) {
  const docs = [{ file: exp.file || 'experience.json', doc: exp.doc, scene: null },
    ...Object.values(exp.scenes || {}).map(s => ({ file: s.file, doc: s.doc, scene: s.doc?.id })),
    ...(exp.shell ? [{ file: exp.shell.file, doc: exp.shell.doc, scene: null }] : [])];
  const said = new Set();
  for (const id of players) {
    const s = play.seats[id];
    if (!list(s.fillers).some(f => f === 'agent' || f === 'program')) continue;
    for (const input of list(s.inputs)) {
      const slash = input.indexOf('/');
      // The events an input starts: a trigger's name in every block, or a control's event in its scene.
      const starts = slash > 0
        ? docs.filter(d => d.scene === input.slice(0, slash)).map(d => { const c = d.doc?.controls?.[input.slice(slash + 1)]; return [d, c ? [c.event || `press:${c.target}`] : []]; })
        : docs.map(d => [d, [input]]);
      for (const [d, first] of starts) {
        const events = new Set(first); const queue = [...first];
        while (queue.length && events.size < 64) {
          const ev = queue.shift();
          const walk = (arr, path) => list(arr).forEach((a, i) => {
            if (!isObj(a)) return;
            const at = `${path}/${i}`;
            if (isHumanOnly(a) && !said.has(`${d.file}|${at}`)) { said.add(`${d.file}|${at}`); ctx.report('W-HUMAN-ONLY-PATH', d.file, at, `seat ${id} may be filled by an agent or a program, and its input ${input} reaches this human-only action (5.15.4)`); }
            if (typeof a.emit === 'string' && (a.as ?? 'event') === 'event' && !events.has(a.emit)) { events.add(a.emit); queue.push(a.emit); }
            walk(a.then, `${at}/then`); walk(a.else, `${at}/else`);
          });
          list(d.doc?.on?.[ev]).forEach((r, i) => { if (isObj(r)) walk(r.actions, `/on/${ev}/${i}/actions`); });
        }
      }
    }
  }
}
