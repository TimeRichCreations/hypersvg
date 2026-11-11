// Two flow rules that files can prove, both conservative and local to what the files show:
//
// E-WORDS-DECIDE (2.5, 5.8): text a person reads never decides behaviour.
//   Sources: `words`, the ambient `language`, `size` and `spoken`, the functions formatNumber and plural, and the
//   content fields of contentType text (a string without `enum` and without another contentType is text).
//   Data flow: a computed value, or a value written by set, add or toggle from a formula that reads a source, is
//   derived from words (to a fixed point, per block; a scene or shell also sees the experience's names).
//   Sinks: an action `if`, a reaction `guard`, a rule `when`, a link `when` or `carry`, a start `when`, a chapter
//   `skipWhen`, an output result `value`, the `with` of record and call, and a `session` or `saved`
//   value written from words. Presentation may still flow into bindings, templates and moment or run values read
//   only by bindings. A freeText field is the AI flow rule's (ai.mjs).
//
// W-HUMAN-ONLY-PATH (5.15.4, A4.1): a path from a source other than a person to a human-only action.
//   Human-only actions: invoke, openUrl and setting (except turning voice off). Sources other than a person: a timer
//   (`after`), a reaction to a clip marker's event, a reaction to an event emitted from such a source, and the entry
//   and exit actions of a scene that a timed link or a marker-event link enters. Paths through uses and machines
//   across blocks are not followed.
import { parse, parseTemplate } from '../src/formula.mjs';
import { blockSites, declsFor, siteFormula } from './formula/sites.mjs';
import { humanOnlyCall, callFormula } from './builtins.mjs';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const esc = (s) => String(s).replace(/~/g, '~0').replace(/\//g, '~1');
const AMBIENT_WORDS = new Set(['language', 'size', 'spoken', 'words']);
const WORD_FUNCTIONS = new Set(['formatNumber', 'plural']);

// Names and function names a formula or template reads.
function reads(src, template = false) {
  const names = new Set(); const fns = new Set();
  if (typeof src !== 'string') return { names, fns };
  let trees;
  try { trees = template ? parseTemplate(src).filter(p => typeof p !== 'string').map(p => p.f) : [parse(src)]; } catch { return { names, fns }; }
  const go = (n) => {
    if (Array.isArray(n)) { n.forEach(go); return; }
    if (!isObj(n)) return;
    if (n.k === 'name') names.add(n.hsvg ? `hsvg.${n.v}` : n.v); // hsvg.<name> is always the built-in (D22)
    if (n.k === 'call') fns.add(n.f);
    for (const [k, v] of Object.entries(n)) if (k !== 'k' && k !== 'v' && typeof v === 'object') go(v);
  };
  trees.forEach(go);
  return { names, fns };
}

// Visits every action with the path of its reaction context: visit(action, path, {timer, event}).
function walkActions(doc, visit) {
  const list = (arr, path, c) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((a, i) => {
      if (!isObj(a)) return;
      visit(a, `${path}/${i}`, c);
      list(a.then, `${path}/${i}/then`, c);
      list(a.else, `${path}/${i}/else`, c);
    });
  };
  const node = (n, path, c) => {
    list(n.entry, `${path}/entry`, { ...c, phase: 'entry' });
    list(n.exit, `${path}/exit`, { ...c, phase: 'exit' });
    for (const [ev, rs] of Object.entries(isObj(n.on) ? n.on : {})) {
      (Array.isArray(rs) ? rs : []).forEach((r, i) => { if (isObj(r)) list(r.actions, `${path}/on/${esc(ev)}/${i}/actions`, { ...c, event: ev, reaction: r, phase: null }); });
    }
    (Array.isArray(n.after) ? n.after : []).forEach((t, i) => { if (isObj(t)) list(t.actions, `${path}/after/${i}/actions`, { ...c, timer: true, reaction: t, phase: null }); });
    for (const [k, s] of Object.entries(isObj(n.states) ? n.states : {})) if (isObj(s)) node(s, `${path}/states/${esc(k)}`, c);
  };
  node({ entry: doc.entry, exit: doc.exit, on: doc.on }, '', {});
  for (const [k, m] of Object.entries(isObj(doc.machines) ? doc.machines : {})) if (isObj(m)) node(m, `/machines/${esc(k)}`, {});
}

export function check(ctx) {
  const { experience: exp, report } = ctx;
  doorExp = exp;
  const blocks = [{ id: 'experience', kind: 'experience', file: exp.file, doc: exp.doc }];
  for (const [id, s] of Object.entries(exp.scenes || {})) blocks.push({ id, kind: 'scene', file: s.file, doc: s.doc });
  if (exp.shell) blocks.push({ id: exp.shell.doc.id, kind: 'shell', file: exp.shell.file, doc: exp.shell.doc });
  for (const [id, b] of Object.entries(exp.blocks || {})) blocks.push({ id, kind: b.doc?.kind || 'component', file: b.file, doc: b.doc });
  wordsDecide(blocks, exp, report);
  humanOnly(blocks, exp, report);
}

function wordsDecide(blocks, exp, report) {
  const shared = (b) => b.kind === 'scene' || b.kind === 'shell';
  const owner = (b, n) => {
    const d = b.doc;
    if (n in (d.values || {}) || n in (d.computed || {}) || n in (d.inputs || {})) return b.id;
    if (shared(b) && (n in (exp.doc.values || {}) || n in (exp.doc.computed || {}) || n in (exp.doc.inputs || {}))) return 'experience';
    return null;
  };
  const isText = (d) => isObj(d) && d.kind === 'content' && (d.contentType === 'text' || (d.contentType === undefined && d.type === 'string' && d.enum === undefined));
  const tainted = new Set(); // "<owner>:<name>"
  for (const b of blocks) for (const [k, d] of Object.entries(b.doc.inputs || {})) if (isText(d)) tainted.add(`${b.id}:${k}`);
  const derived = (b, src, template = false) => {
    if (template) return true; // the result of a template is words
    const r = reads(src, false);
    for (const f of r.fns) if (WORD_FUNCTIONS.has(f)) return true;
    for (const n of r.names) {
      if (n.startsWith('hsvg.') ? AMBIENT_WORDS.has(n.slice(5)) : AMBIENT_WORDS.has(n) && !owner(b, n)) return true;
      const o = owner(b, n);
      if (o && tainted.has(`${o}:${n}`)) return true;
    }
    return false;
  };
  const lifetimeOf = (b, name) => {
    const o = owner(b, name);
    const ob = blocks.find(x => x.id === o);
    const decl = ob?.doc.values?.[name];
    return decl ? (decl.lifetime ?? (['experience', 'shell'].includes(ob.kind) ? 'run' : 'moment')) : null;
  };
  // taint to a fixed point: computed values and values written from words
  for (let round = 0, grew = true; grew && round < 32; round++) {
    grew = false;
    const add = (k) => { if (!tainted.has(k)) { tainted.add(k); grew = true; } };
    for (const b of blocks) {
      for (const [k, src] of Object.entries(b.doc.computed || {})) if (derived(b, src)) add(`${b.id}:${k}`);
      walkActions(b.doc, (a) => {
        for (const op of ['set']) {
          if (typeof a[op] !== 'string') continue;
          const src = a.to;
          if (typeof src === 'string' && derived(b, src)) { const o = owner(b, a[op]); if (o) add(`${o}:${a[op]}`); }
        }
      });
    }
  }
  const said = new Set();
  const say = (b, path, msg) => { const k = `${b.file}|${path}`; if (!said.has(k)) { said.add(k); report('E-WORDS-DECIDE', b.file, path, `${msg}: text a person reads must not decide behaviour; use a stable id, a choice field, a data column of ids or a knob (5.8)`); } };
  for (const b of blocks) {
    const bad = (src) => typeof src === 'string' && derived(b, src);
    // A call's text input (D31.1): its {{ }} formula is read; words with {{ }} inside are words.
    const callBad = (a, k, v) => { const f = callFormula(exp, a, k); return typeof v === 'string' && (f === null ? derived(b, v, true) : bad(f)); };
    walkActions(b.doc, (a, path, c) => {
      if (bad(a.if)) say(b, `${path}/if`, 'this condition reads words');
      if (c.reaction && bad(c.reaction.guard) && path.endsWith('/0')) say(b, path.replace(/\/actions\/0$/, '/guard'), 'this guard reads words');
      // An emit or trigger payload is not a decision: words may travel to a block that only binds them.
      // openUrl's with goes onto the click address: ids and numbers only (10.4). A question to a character seat
      // (ai.ask's question) is words by nature, as the ask action's with was: the ai family checks its flow.
      // emit as a record keeps rows; player.openUrl's with goes onto the click address (field names the input).
      const key = a.emit !== undefined && a.as === 'record' ? 'emit as record' : a.call === 'player.openUrl' ? 'call player.openUrl' : a.call !== undefined && !String(a.call).startsWith('player.') ? 'call' : null;
      if (key && isObj(a.with)) for (const [k, v] of Object.entries(a.with)) if (!(key === 'call player.openUrl' && k === 'field') && (key === 'call' ? callBad(a, k, v) : bad(v)) && !(a.call === 'ai.ask' && k === 'question')) say(b, `${path}/with/${esc(k)}`, `${key} sends words in "${k}"`);
      for (const op of ['set']) {
        const src = a.to;
        if (typeof a[op] === 'string' && bad(src)) { const lt = lifetimeOf(b, a[op]); if (lt === 'session' || lt === 'saved') say(b, `${path}/to`, `a ${lt} value (${a[op]}) is written from words`); }
      }
    });
    for (const s of blockSites(b.doc, { experience: b.kind === 'experience', decls: declsFor(b.doc, exp) })) {
      const p = s.path;
      const sink = /^\/rules\/\d+\/when$/.test(p) ? 'this rule condition' : /^\/outputs\/[^/]+\/value$/.test(p) ? 'this output' : /^\/story\/links\/\d+\/(when|carry\/)/.test(p) ? 'this link' : /^\/story\/start.*\/when$/.test(p) || /skipWhen$/.test(p) ? 'this start condition' : null;
      if (sink && bad(siteFormula(s))) say(b, p, `${sink} reads words`);
    }
    for (const [k, reaction] of reactionsOf(b.doc)) if (bad(reaction.guard)) say(b, k, 'this guard reads words');
  }
}

// Reactions with a guard: [path/guard, reaction].
function reactionsOf(doc) {
  const out = [];
  const node = (n, path) => {
    for (const [ev, rs] of Object.entries(isObj(n.on) ? n.on : {})) (Array.isArray(rs) ? rs : []).forEach((r, i) => { if (isObj(r) && r.guard !== undefined) out.push([`${path}/on/${esc(ev)}/${i}/guard`, r]); });
    (Array.isArray(n.after) ? n.after : []).forEach((t, i) => { if (isObj(t) && t.guard !== undefined) out.push([`${path}/after/${i}/guard`, t]); });
    for (const [k, s] of Object.entries(isObj(n.states) ? n.states : {})) if (isObj(s)) node(s, `${path}/states/${esc(k)}`);
  };
  node({ on: doc.on }, '');
  for (const [k, m] of Object.entries(isObj(doc.machines) ? doc.machines : {})) if (isObj(m)) node(m, `/machines/${esc(k)}`);
  return out;
}

let doorExp = null; // the experience whose add-ons' humanOnly calls count (door 2)
const isHumanOnly = (a) => a.invoke !== undefined || a.call === 'player.openUrl' || (a.call === 'player.setting' && !(isObj(a.with) && a.with.voice === false)) || humanOnlyCall(doorExp, a);

function humanOnly(blocks, exp, report) {
  const events = new Set(); // events that come from no person
  for (const b of blocks) for (const clip of Object.values(b.doc.clips || {})) for (const m of Array.isArray(clip?.markers) ? clip.markers : []) if (typeof m?.event === 'string') events.add(m.event);
  const links = Array.isArray(exp.doc.story?.links) ? exp.doc.story.links : [];
  const said = new Set();
  for (let round = 0, grew = true; grew && round < 8; round++) {
    grew = false;
    // scenes entered by a timed link or by a link that hears such an event
    const timedEntry = new Set(links.filter(l => isObj(l) && typeof l.to === 'string' && (l.afterMs !== undefined || (typeof l.on === 'string' && events.has(l.on)))).map(l => l.to));
    for (const b of blocks) {
      walkActions(b.doc, (a, path, c) => {
        const nonPerson = c.timer || (c.event !== undefined && events.has(c.event)) || (b.kind === 'scene' && timedEntry.has(b.id) && (c.phase === 'entry' || c.phase === 'exit'));
        if (!nonPerson) return;
        if (typeof a.emit === 'string' && (a.as ?? 'event') === 'event' && !events.has(a.emit)) { events.add(a.emit); grew = true; }
        if (isHumanOnly(a)) {
          const kind = a.invoke !== undefined ? 'invoke' : `call ${a.call}`;
          const k = `${b.file}|${path}`;
          if (!said.has(k)) { said.add(k); report('W-HUMAN-ONLY-PATH', b.file, path, `${kind} is human-only (5.15.4) but runs from ${c.timer ? 'a timer' : c.event !== undefined ? `the event ${c.event}, which no person starts` : 'a scene entered by a timer or a marker'}`); }
        }
      });
    }
  }
}
