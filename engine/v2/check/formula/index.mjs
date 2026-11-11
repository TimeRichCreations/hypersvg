// Formula proofs (5.1.3, 5.6, 5.6.7): parse every formula and template, resolve every name in its scope, infer its type,
// refuse a type that does not fit the field, and prove the ranges the fields need.
// Codes: E-FORMULA, E-REF-UNKNOWN, E-REF-PRIVATE, E-NAME-SHADOW, E-CYCLE, E-TYPE, E-RANGE, E-MOTION-RANGE, E-CLOCK-SPEED.
import { parse, parseTemplate, textSlot } from '../../src/formula.mjs';
import { walkBehaviour } from '../refs/walk.mjs';
import { infer, fromDecl, misfit, T } from './infer.mjs';
import { blockSites, declsFor } from './sites.mjs';
import { motionFrames } from './motion.mjs';
import { repeatSlots } from '../story/graph.mjs';
import { FORMAT } from '../../src/limits.mjs';
import { motionChannels } from './motion.mjs';
import { markChannel } from '../../src/physics.mjs';
import { growthOf } from '../builtins.mjs';
const CHANNELS = motionChannels();

const CODE = { unknown: 'E-REF-UNKNOWN', private: 'E-REF-PRIVATE', type: 'E-TYPE', formula: 'E-FORMULA', shadow: 'E-NAME-SHADOW', cycle: 'E-CYCLE', range: 'E-RANGE' };
// A null-prototype map (5.9): toString, valueOf and the other Object.prototype names are never built-ins.
export const AMBIENT = Object.assign(Object.create(null), {
  now: T.num(), elapsed: T.num(), reducedMotion: T.bool(), timeLimits: T.num(), inputMode: T.str(['keyboard', 'pointer', 'touch']), language: T.str(),
  size: T.obj({ shape: T.str(), width: T.num(), height: T.num() }), muted: T.bool(), volume: T.num(0, 1), voice: T.bool(),
  spoken: T.obj({ line: T.str(), text: T.str(), word: T.num() }), canReturn: T.bool(), chapter: T.obj({ id: T.str(), index: T.num(), count: T.num() }), hooks: T.obj(null),
  layout: T.obj(null), // per block on screen: {frame, tier, steps} (7.1); the player writes it
});
// D22, 5.9: the built-in value names an author's own name may hide (with W-NAME-HIDES), and the names nobody may
// declare (computed values are not covered by the schemas, so the checker refuses them here).
export const BUILT_IN_VALUES = new Set([...Object.keys(AMBIENT), 'visits', 'item', 'index', 'acc']);
export const RESERVED_NAMES = new Set(['true', 'false', 'null', 'and', 'or', 'not', 'hsvg', 'data', 'words', 'uses', 'event',
  'entered', 'ended', 'openUrl', 'hookHealth', 'firstInput', '__proto__', 'prototype', 'constructor']);
const fmt = (n) => (n === Infinity ? 'unbounded above' : n === -Infinity ? 'unbounded below' : String(n));
const showRange = (t) => (t.t === 'number' ? `${t.lo === -Infinity ? '-inf' : t.lo}..${t.hi === Infinity ? 'inf' : t.hi}` : t.t);
const noop = () => {};
const esc = (k) => String(k).replace(/~/g, '~0').replace(/\//g, '~1');

// What a document declares: a scope that answers names (own, then the experience's, then ambient).
function makeScope(entry, parent, label) {
  const doc = entry.doc;
  const names = new Map();
  for (const [k, d] of Object.entries(doc.values || {})) names.set(k, { kind: 'value', t: fromDecl(d) });
  for (const [k, d] of Object.entries(doc.inputs || {})) names.set(k, { kind: 'input', t: d?.type ? fromDecl(d) : T.any() });
  for (const p of doc.promote || []) { const n = p.as || String(p.from || '').split('/').pop(); if (n && !names.has(n)) names.set(n, { kind: 'input', t: T.any() }); }
  const computed = new Map(Object.entries(doc.computed || {}));
  const states = new Set();
  walkBehaviour(doc, { state: (k) => states.add(k) });
  const scope = { entry, doc, parent, label, names, computed, states, memo: new Map(), busy: new Set(), cycles: new Set() };
  return scope;
}

export function check(ctx) {
  const { experience: exp, report } = ctx;
  const expEntry = { file: exp.file, doc: exp.doc, drawings: {} };
  const expScope = makeScope(expEntry, null, 'experience');
  const owners = [];
  for (const [id, s] of Object.entries(exp.scenes)) owners.push({ id, kind: 'scene', entry: s });
  for (const [id, b] of Object.entries(exp.blocks)) owners.push({ id, kind: b.doc.kind || 'component', entry: b });
  if (exp.shell) owners.push({ id: exp.shell.doc.id, kind: 'shell', entry: exp.shell });
  for (const o of owners) o.scope = makeScope(o.entry, o.kind === 'scene' || o.kind === 'shell' ? expScope : null, o.kind);
  const byScene = (id) => (id && (exp.scenes[id] || (exp.shell && exp.shell.doc.id === id ? exp.shell : null))) || null;

  // ----- name lookup -----
  function computedType(scope, name) {
    if (scope.memo.has(name)) return scope.memo.get(name);
    if (scope.busy.has(name)) return T.any(); // a loop is reported once, by cycleOf
    scope.busy.add(name);
    let t = T.any();
    const src = scope.computed.get(name);
    if (typeof src === 'number') t = T.num(src, src);
    else if (typeof src === 'boolean') t = T.bool();
    else if (typeof src === 'string') {
      try {
        t = infer(parse(src), envFor(scope, { eventOk: false }), noop);
        if (t.opt) { t = { ...t }; delete t.opt; } // the computed value's own site reports the null (5.6.2)
      } catch { t = T.any(); }
    }
    scope.busy.delete(name);
    scope.memo.set(name, t);
    return t;
  }
  function findIn(scope, n) {
    if (scope.names.has(n)) return scope.names.get(n).t;
    if (scope.computed.has(n)) return computedType(scope, n);
    return undefined;
  }
  function lookup(scope, n, extra) {
    const own = findIn(scope, n);
    if (own) return own;
    if (scope.parent) {
      const up = findIn(scope.parent, n);
      if (up) return up;
    }
    // A built-in that no visible name hides (D22): the experience's own `now` does not reach a component.
    if (AMBIENT[n]) return AMBIENT[n];
    if (!scope.parent && scope.label !== 'experience') {
      const up = findIn(expScope, n);
      if (up) return { err: 'private', message: `${n} belongs to the experience; a ${scope.label} sees nothing outside itself (5.1.3)` };
    }
    if (extra && Object.hasOwn(extra, n) && extra[n]) return extra[n];
    return undefined;
  }

  function usesOf(o) {
    return (id) => {
      const u = (o.scope.doc.uses || []).find(x => x.id === id);
      if (!u) return undefined;
      const def = typeof u.use === 'string' ? exp.blocks[u.use] : null;
      if (!def) return { repeated: u.items !== undefined, outputs: null, others: null };
      const outputs = new Map(); const others = new Set();
      for (const [k, d] of Object.entries(def.doc.outputs || {})) { if (d?.kind === 'result') outputs.set(k, fromDecl(d)); else others.add(k); }
      for (const k of [...Object.keys(def.doc.inputs || {}), ...Object.keys(def.doc.values || {}), ...Object.keys(def.doc.computed || {})]) others.add(k);
      return { repeated: u.items !== undefined, outputs, others };
    };
  }
  function tableOf(scope) {
    return (name) => {
      // a table holds at most its maxRows rows (2.6), the list's maxItems (4.5); own names only (5.9)
      for (let s = scope; s; s = s.parent) if (Object.hasOwn(s.doc.data || {}, name)) { const m = s.doc.data[name]?.maxRows; return typeof m === 'number' ? { ...T.arr(), max: m } : T.arr(); }
      if (Object.hasOwn(exp.doc.data || {}, name)) return { err: 'private', message: `data.${name} is a table of the experience; a ${scope.label} sees nothing outside itself (5.1.3)` };
      return undefined;
    };
  }
  // Does the author declare n where this scope can see it (its own names, then a scene's or shell's experience)?
  const has = (scope, n) => !!scope && (scope.names.has(n) || scope.computed.has(n));
  const declaredIn = (scope) => (n) => has(scope, n) || has(scope.parent, n);
  const builtin = (n) => AMBIENT[n];
  function envFor(scope, { eventOk = false, itemOk = false, extra, uses, states } = {}) {
    return {
      // A repeated use's item and index are row names of its fields (4.5): they hide an author's own item.
      declared: (n) => !(itemOk && (n === 'item' || n === 'index')) && declaredIn(scope)(n),
      builtin,
      eventOk,
      states: states || scope.states,
      uses: uses || usesOf({ scope }),
      table: tableOf(scope),
      name: (n) => {
        if ((n === 'item' || n === 'index') && itemOk) return n === 'item' ? T.any() : T.num(0, 1023);
        return lookup(scope, n, extra);
      },
    };
  }

  // The spans of a template, each checked as a printable formula; false when it does not parse.
  function templateSpans(v, at, env, sink) {
    let spans;
    try { spans = parseTemplate(v); } catch (e) { at(e.code || 'E-FORMULA', `template: ${e.message}`); return false; }
    for (const s of spans) {
      if (typeof s === 'string') continue;
      const st = infer(s.f, env, sink);
      if (st.opt) at('E-TYPE', 'a template span may print null; narrow it first (5.6.2)');
      else if (['array', 'object', 'null'].includes(st.t)) at('E-TYPE', `a template span cannot print ${st.t} (5.7)`);
    }
    return true;
  }
  const missingRange = new Map();
  // A result that can never fit a declared value: a number range wholly outside its bounds, or texts all longer
  // than its maxLength. say(message) reports it.
  function outOfBounds(t, want, say) {
    if (t.t === 'number' && want.t === 'number' && (t.hi < want.lo || t.lo > want.hi)) say(`the formula is ${showRange(t)}, outside ${showRange(want)}`);
    else if (t.t === 'string' && want.t === 'string' && typeof want.maxLength === 'number' && t.lits?.length && t.lits.every(x => [...x].length > want.maxLength)) say(`the text ${JSON.stringify(t.lits[0])} is longer than maxLength ${want.maxLength}`);
  }
  // ----- one site -----
  function runSite(o, scope, site, rep, env) {
    const at = (code, message) => rep(code, site.path, message);
    // A link's formula reads a small scope: say what it reads (F0b), and where a score across scenes lives.
    const linkWhy = site.scope === 'link' ? `; a link's when and carry read the event (event.<field>), the inputs and result outputs of ${site.from}, and the experience's names. A score kept across scenes is a value of the experience ("values" in experience.json)` : '';
    // An unquoted sound name ("play": "bell") reads a value named bell, which is not there (D36): say the quoted form.
    const bare = site.sound && typeof site.src === 'string' && /^\s*[a-z][a-z0-9]*(-[a-z0-9]+)*\s*$/i.test(site.src) ? site.src.trim() : null;
    let saidBare = false; // then the type of what the unquoted words compute (ship - bell, a number) is not said too
    const sink = (kind, message) => at(CODE[kind] || 'E-FORMULA', kind === 'unknown' && bare !== null && (saidBare = true)
      ? `sound ${bare}: a sound's name is a formula, so ${bare} reads a value and none has that name; write the name in single quotes: "play": "'${bare}'" (D36)`
      : kind === 'unknown' && linkWhy ? `${message}${linkWhy}` : message);
    let t;
    const v = site.src;
    if (typeof v === 'number') t = T.num(v, v);
    else if (typeof v === 'boolean') t = T.bool();
    else if (typeof v !== 'string') return;
    else if (site.mode === 'text') {
      // A text slot (D31.1): plain words are text; one {{ f }} is the formula f; words with {{ }} inside are a template.
      let slot;
      try { slot = textSlot(v); } catch (e) { at(e.code || 'E-FORMULA', `text: ${e.message}`); return; }
      if (slot.text !== undefined) t = T.str([slot.text]);
      else if (slot.template !== undefined) { if (!templateSpans(v, at, env, sink)) return; t = T.str(); } else {
        let tree;
        try { tree = parse(slot.formula); } catch (e) { at(e.code || 'E-FORMULA', e.message); return; }
        t = infer(tree, env, sink);
        if (t.opt) at('E-TYPE', 'the result may be null; null is never stored, passed or printed, so narrow it with r === null ? a : f(r) or give a real row as the fallback (5.6.2)');
      }
    } else if (site.mode === 'template') {
      let spans;
      try { spans = parseTemplate(v); } catch (e) { at(e.code || 'E-FORMULA', `template: ${e.message}`); return; }
      // Words a person reads are plain words with {{ }} around a formula (D36). Two quote marks, or a bare name of the
      // block's own, show as they are written: the common slips of the formula rule.
      if (/\/(text|label)$/.test(site.path) && spans.every(x => typeof x === 'string')) {
        const w = spans.join('').trim();
        if (w === "''" || w === '""') rep('W-TEXT-LITERAL', site.path, `this shows the two quote marks ${w}: the words a person reads are plain words, so an empty text is "" (D36)`);
        else if (/^[a-z][A-Za-z0-9]*$/.test(w) && env.declared(w)) rep('W-TEXT-LITERAL', site.path, `this shows the word ${w}, not the value ${w}: write {{ ${w} }} to show the value (D36)`);
        else {
          // Words that name a value of the block, written as it is spelt ("Score: score"), show the name, not the
          // value (stress test B, K2e). A plain word is also an everyday word ("Try another ending"), so it counts only
          // after a colon or an equals sign; a name no word is spelt like (bestScore, level2, apple_in) counts anywhere.
          // The message gives the words with {{ }} around each name.
          const text = spans.join('');
          const named = (n, i) => /^[a-z]/.test(n) && env.declared(n) && (/[A-Z0-9_]/.test(n) || /[:=]\s*$/.test(text.slice(0, i)));
          const names = [...new Set([...text.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)].filter(m => named(m[0], m.index)).map(m => m[0]))];
          if (names.length) {
            const fixed = text.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (n, i) => (named(n, i) ? `{{ ${n} }}` : n));
            rep('W-TEXT-LITERAL', site.path, `this shows the word${names.length > 1 ? 's' : ''} ${names.join(', ')}, not the value${names.length > 1 ? 's' : ''}: write "${fixed}" to show ${names.length > 1 ? 'them' : 'it'} (D36)`);
          }
        }
      }
      for (const s of spans) {
        if (typeof s === 'string') continue;
        const st = infer(s.f, env, sink);
        if (st.opt) at('E-TYPE', 'a template span may print null; narrow it first (5.6.2)');
        else if (['array', 'object', 'null'].includes(st.t)) at('E-TYPE', `a template span cannot print ${st.t} (5.7)`);
      }
      return;
    } else {
      let tree;
      try { tree = parse(v); } catch (e) {
        // Every value slot holds a formula, text in single quotes (D36). {{ }} marks a formula only in words a person
        // reads (a text or label binding, a text slot in content).
        const one = /^\s*\{\{([\s\S]*?)\}\}\s*$/.exec(v);
        if (one && !one[1].includes('{{')) at(e.code || 'E-FORMULA', `this field holds a formula, not text: write ${one[1].trim() === "''" ? "'' (two single quotes, the empty text)" : one[1].trim()} without {{ }} (D36, 5.6.1)`);
        else if (v.includes('{{')) at(e.code || 'E-FORMULA', `this field holds a formula, not a template: join text and values with +, as 'Score ' + score, with text in single quotes (D36, 5.6.1)`);
        else if (v.trim() === '') at(e.code || 'E-FORMULA', `an empty field is no formula: the empty text is '' (two single quotes) (D36, 5.6.1)`);
        else if (/^[^'"]*\s[^'"]*$/.test(v.trim()) || /[A-Za-z]{2,}[!?.,]$/.test(v.trim())) at(e.code || 'E-FORMULA', `${e.message}; text in a formula is in single quotes: '${v.trim().replace(/'/g, "\\'")}' (D36, 5.6.1)`);
        else at(e.code || 'E-FORMULA', e.message);
        return;
      }
      t = infer(tree, env, sink);
      if (t.opt) at('E-TYPE', 'the result may be null; null is never stored, passed or printed, so narrow it with r === null ? a : f(r) or give a real row as the fallback (5.6.2)');
    }
    // the type must fit the field
    const e = site.expect;
    let want = null; let what = 'the formula';
    if (typeof e === 'string' && e !== 'any') want = e === 'number' ? T.num() : e === 'string' ? T.str() : e === 'boolean' ? T.bool() : T.arr();
    else if (e && e.decl) { const d = lookup(scope, e.decl); if (d && !d.err) want = d; what = `the value ${e.decl}`; } else if (e && e.output) want = fromDecl(scope.doc.outputs?.[e.output]);
    else if (e && e.setting) { const d = declsFor(scope.doc, exp)(e, site); if (d?.type) { want = fromDecl(d); what = `the setting ${e.setting}`; } }
    else if (e && e.input) {
      const [useId, name] = e.input;
      let decls = null;
      if (useId === 'dest') decls = byScene(site.to)?.doc.inputs;
      else { const u = (scope.doc.uses || []).find(x => x.id === useId); decls = u && typeof u.use === 'string' ? exp.blocks[u.use]?.doc.inputs : null; }
      if (decls && decls[name]?.type) { want = fromDecl(decls[name]); what = `input ${name}`; }
    }
    if (want && !saidBare) {
      const m = misfit(t, want, 'the formula');
      if (m) at(m.includes(', outside ') ? 'E-RANGE' : 'E-TYPE', `${what}: ${m}`);
      // A write whose every result is out of the value's bounds always faults (5.1, 9.2): `set score to 5` with
      // maximum 3, or a text longer than maxLength (stress test B, K2e). A formula that may fit is the player's to test.
      else if (e && e.decl) outOfBounds(t, want, (msg) => at('E-RANGE', `${what}: ${msg}; every write is checked against the bounds and a failing one faults (5.1)`));
    }
    // the range the field needs
    if (site.range) {
      const r = site.range;
      const have = t.t === 'number' ? t : T.num();
      if (!(have.lo >= r.lo && have.hi <= r.hi)) {
        const why = have.why ? ` (${have.why})` : '';
        at(r.code, `${r.what}: the proven range ${showRange(have)}${why} is not inside ${r.lo}..${r.hi}; write clamp(...) (5.6.7)`);
      }
    }
    if (site.repeat) repeatCapacity(o, site, t, at);
    if (site.motion) {
      const have = t.t === 'number' ? t : T.num();
      const { targets, channel, what: w } = site.motion;
      for (const target of targets) {
        for (const f of o.frames) {
          if (!f.motion.has(target)) continue;
          const ranges = f.motion.get(target);
          const r = ranges[channel];
          if (!r && site.motion.mirror) continue; // a mirror (-1 or 1 on x) needs no motion range (6.8)
          // The layout is named only when the file writes layouts (one drawing has the layout main without saying so).
          const place = o.entry.doc.layouts ? ` in layout ${f.layout}` : '';
          if (!r) {
            // One cause, one finding (F0b): a channel that is no channel word is the schema's E-TYPE alone; a part
            // with no range for a channel is said once per part and channel, with the form to add.
            if (!CHANNELS.has(channel)) break;
            const once = `${o.id}|${target}|${channel}`;
            if (missingRange.has(once)) { missingRange.get(once).n++; break; }
            missingRange.set(once, { n: 1 });
            at('E-MOTION-RANGE', `${w}: part ${target} has no motion range for ${markChannel(channel)}${place}; add it to the part's data-hsvg-motion, as "${markChannel(channel)} ${channel.startsWith('scale') ? '1..1.2' : channel === 'rotate' ? '-15..15' : channel === 'opacity' ? '0..1' : '-60..0'}" (6.2.1)`);
            break;
          }
          if (r === 'free') continue;
          if (!(have.lo >= r.lo && have.hi <= r.hi)) {
            // A plain number (a clip key, a literal value) is not a formula: clamp(...) is no help there (R2 newcomer F6).
            if (typeof v === 'number') { const what = /\/keys\//.test(site.path) ? 'key' : 'value'; at('E-MOTION-RANGE', `${w}: the ${what} is ${v}, outside the motion range ${r.lo}..${r.hi} of ${target} for ${markChannel(channel)}${place}; widen data-hsvg-motion on ${target} or change the ${what} (6.2.1)`); break; }
            at('E-MOTION-RANGE', `${w}: ${markChannel(channel)} of ${target} has the proven range ${showRange(have)}${have.why ? ` (${have.why})` : ''}, outside its motion range ${r.lo}..${r.hi}${place}; write clamp(...) (5.6.7)`); break;
          }
        }
      }
    }
  }

  // A repeated use's list must fit its repeat region's slots in every frame, and stay within the live repeated uses
  // (4.5, E-REPEAT-CAPACITY [files]). The bound is the list's maxItems (an array input's, a table's maxRows); a list
  // with no known bound is left to play.
  function repeatCapacity(o, site, t, at) {
    const u = site.repeat.use;
    const max = t.t === 'array' && typeof t.max === 'number' ? t.max : null;
    if (max === null) return;
    // The format value, raised where the experience asks (9.8.1): the value the engine plays with, once a host admits it.
    const live = exp.limits?.liveRepeatedUses ?? FORMAT.liveRepeatedUses;
    if (max > live) at('E-REPEAT-CAPACITY', `use ${u.id} may have ${max} rows (its list's maxItems), more than the ${live} live repeated uses (4.5, 9.8)`);
    if (typeof u.into !== 'string') return;
    for (const d of Object.values(o.entry.drawings || {})) {
      const slots = typeof d?.text === 'string' ? repeatSlots(d.text, u.into) : null;
      if (slots !== null && slots < max) at('E-REPEAT-CAPACITY', `use ${u.id} may have ${max} rows (its list's maxItems), but the repeat group ${u.into} in ${d.file} draws ${slots} slots; give the list maxItems ${slots} or draw more slots (4.5)`);
    }
  }

  // ----- every owner -----
  const all = [...owners, { id: exp.doc.id, kind: 'experience', entry: expEntry, scope: expScope }];
  for (const o of all) {
    o.frames = o.kind === 'experience' ? [] : motionFrames({ doc: o.entry.doc, drawings: o.entry.drawings });
    const said = new Set();
    // A use of a kit or picked scene or shell definition (4.9, src/kit.mjs useOfDefinition) turns each formula of its
    // `with` into a computed value of the same name: its findings belong to the author's `with`, not the library's file.
    const withAt = withPaths(o);
    const rep = (code, path, message) => {
      const k = `${code} ${path} ${message}`;
      if (said.has(k)) return;
      said.add(k);
      const m = withAt && /^\/computed\/([^/]+)(\/.*)?$/.exec(path);
      if (m && withAt.has(m[1])) report(code, exp.file, withAt.get(m[1]) + (m[2] || ''), `${message} (the with of ${o.kind} ${o.id})`);
      else report(code, o.entry.file, path, message);
    };
    if (withAt) passThroughs(o, withAt);
    const videoMs = (id) => { const r = o.entry.doc.resources?.[id] ?? exp.doc.resources?.[id]; return r?.kind === 'video' && typeof r.durationMs === 'number' ? r.durationMs : undefined; };
    videoMs.all = () => Object.keys(exp.doc.resources || {});
    for (const group of ['values', 'computed', 'inputs']) {
      for (const n of Object.keys(o.entry.doc[group] || {})) {
        if (group === 'computed' && RESERVED_NAMES.has(n)) rep('E-NAME-RESERVED', `/computed/${n}`, `${n} is a reserved name (5.9)`);
        else if (BUILT_IN_VALUES.has(n)) rep('W-NAME-HIDES', `/${group}/${n}`, `${n} hides the built-in ${n} in this scope; the bare name reads this ${group === 'computed' ? 'computed value' : group.slice(0, -1)}, and hsvg.${n} still reads the built-in; changed:hsvg.${n} hears the built-in's change (5.9)`);
      }
    }
    const sites = blockSites(o.entry.doc, { experience: o.kind === 'experience', videoMs, decls: declsFor(o.entry.doc, exp), growth: (v) => growthOf(exp, v, 'paints').decl });
    const usesFn = usesOf(o);
    for (const site of sites) {
      let env;
      if (site.scope === 'link' || site.scope === 'start') {
        env = linkEnv(o, site);
      } else {
        env = envFor(o.scope, { eventOk: site.eventOk, itemOk: site.itemOk, uses: usesFn });
      }
      runSite(o, o.scope, site, rep, env);
    }
    // a computed value in a cycle (5.2)
    for (const name of o.scope.computed.keys()) {
      const trail = cycleOf(o.scope, name);
      if (trail) rep('E-CYCLE', `/computed/${name}`, `computed values read each other in a loop: ${trail.join(' -> ')} (5.2)`);
    }
  }

  // The authored path of each formula in a definition use's `with`: {name -> /story/scenes/<id>/with/<name>}, or null.
  function withPaths(o) {
    if ((o.kind !== 'scene' && o.kind !== 'shell') || !o.entry.with || typeof o.entry.with !== 'object' || o.entry.use === undefined) return null;
    const base = o.kind === 'shell' ? '/shell/with' : `/story/scenes/${esc(o.id)}/with`;
    return new Map(Object.keys(o.entry.with).map(k => [k, `${base}/${esc(k)}`]));
  }
  // A `with` formula of one name passes the experience's value of that name through (src/kit.mjs): the name must be
  // one the experience (or the built-ins) has, and its type must fit the input. Else the player stops on launch.
  function passThroughs(o, withAt) {
    for (const [k, decl] of Object.entries(o.entry.doc.inputs || {})) {
      if (typeof decl?.from !== 'string' || !withAt.has(k)) continue;
      const n = decl.from;
      const t = findIn(expScope, n) ?? AMBIENT[n];
      const at = withAt.get(k);
      if (!t) { report('E-REF-UNKNOWN', exp.file, at, `${n} is not a name of the experience; a with formula reads the experience's names. For text, quote it: "'${n}'" (5.6)`); continue; }
      if (decl.type) { const m = misfit(t, fromDecl(decl), `the value ${n}`); if (m) report(m.includes(', outside ') ? 'E-RANGE' : 'E-TYPE', exp.file, at, `input ${k}: ${m}`); }
    }
  }

  // The names a link formula reads: the event, the from scene's interface, the experience's names, ambient (3.2).
  function linkEnv(o, site) {
    const scope = o.scope;
    if (site.scope === 'start') return { builtin, declared: declaredIn(scope), eventOk: false, states: new Set(), uses: () => undefined, table: tableOf(scope), name: (n) => lookup(scope, n) };
    const from = byScene(site.from);
    const iface = new Map();
    if (from) {
      for (const [k, d] of Object.entries(from.doc.inputs || {})) iface.set(k, d?.type ? fromDecl(d) : T.any());
      for (const [k, d] of Object.entries(from.doc.outputs || {})) if (d?.kind === 'result') iface.set(k, fromDecl(d));
    }
    return {
      builtin, declared: (n) => iface.has(n) || declaredIn(scope)(n),
      eventOk: site.eventOk, states: new Set(), uses: () => undefined, table: tableOf(scope),
      name: (n) => {
        const a = iface.get(n); const b = findIn(expScope, n);
        if (a && b) return { err: 'shadow', message: `${n} is found in the interface of ${site.from} and in the experience (3.2)` };
        return a || lookup(scope, n);
      },
    };
  }
}

// The chain of computed names that returns to `start`, or null. Reads are found from the parsed formulas.
function cycleOf(scope, start) {
  const reads = (name) => {
    const src = scope.computed.get(name);
    if (typeof src !== 'string') return [];
    const out = new Set();
    const go = (n) => {
      if (!n || typeof n !== 'object') return;
      if (n.k === 'name' && !n.hsvg && scope.computed.has(n.v)) out.add(n.v);
      for (const x of [n.c, n.a, n.b, n.l, n.r, n.v, n.o, n.key]) if (x && typeof x === 'object') (Array.isArray(x) ? x : [x]).forEach(go);
      if (Array.isArray(n.e)) n.e.forEach(([, x]) => go(x));
    };
    try { go(parse(src)); } catch { /* reported as a bad formula */ }
    return [...out];
  };
  const seen = new Set();
  const dfs = (name, trail) => {
    for (const r of reads(name)) {
      if (r === start) return [...trail, r];
      if (seen.has(r)) continue;
      seen.add(r);
      const t = dfs(r, [...trail, r]);
      if (t) return t;
    }
    return null;
  };
  const t = dfs(start, [start]);
  // report each loop once: only from its smallest name
  return t && t.slice(0, -1).every(n => n >= start) ? t : null;
}
