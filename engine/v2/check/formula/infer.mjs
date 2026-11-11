// Type and range inference over a parsed formula (5.6.3, 5.6.7). No evaluation: only types and intervals.
// A type is { t, lo, hi, item, props, opt, lits, why }. t is number, string, boolean, array, object, null, uses, use,
// visits or any. `any` fits everything (the checker does not know). `opt` marks a lookup that may give `null`
// (5.6.2): it must be narrowed before use. lo..hi is the proven interval of a number; infinite means unbounded.
// `why` says what made an interval unbounded (a divisor that spans zero).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORMAT } from '../../src/limits.mjs';

// The role prefixes of the registry (6.3, vocabularies.json): `action.text` is one name (5.3.1).
const here = path.dirname(fileURLToPath(import.meta.url));
export const ROLE_PREFIXES = new Set(JSON.parse(fs.readFileSync(path.join(here, '..', '..', '..', '..', 'spec', '2.0', 'vocabularies.json'), 'utf8')).roles.map(r => r.prefix).filter(Boolean));

const INF = Infinity;
export const T = {
  any: (extra = {}) => ({ t: 'any', ...extra }),
  num: (lo = -INF, hi = INF, extra = {}) => ({ t: 'number', lo, hi, ...extra }),
  str: (lits) => ({ t: 'string', ...(lits ? { lits } : {}) }),
  bool: () => ({ t: 'boolean' }),
  arr: (item = { t: 'any' }) => ({ t: 'array', item }),
  obj: (props) => ({ t: 'object', props }),
  nul: () => ({ t: 'null' }),
};
const unbounded = (why) => T.num(-INF, INF, why ? { why } : {});

// The type a declaration (value, input, output, table column) states. Unknown shapes give `any`.
export function fromDecl(d) {
  if (!d || typeof d !== 'object') return T.any();
  switch (d.type) {
    case 'number': case 'integer': return T.num(typeof d.minimum === 'number' ? d.minimum : -INF, typeof d.maximum === 'number' ? d.maximum : INF);
    case 'string': { const t = T.str(Array.isArray(d.enum) ? d.enum.slice() : undefined); if (typeof d.maxLength === 'number') t.maxLength = d.maxLength; return t; }
    case 'boolean': return T.bool();
    case 'array': return { t: 'array', item: fromDecl(d.items), max: d.maxItems };
    case 'object': {
      if (!d.properties) return T.obj(null);
      return T.obj(Object.fromEntries(Object.entries(d.properties).map(([k, v]) => [k, fromDecl(v)])));
    }
    default: return T.any();
  }
}

const same = (a, b) => a.t === b.t;
// The type that holds either of two results (a conditional, an array's items).
export function join(a, b) {
  if (a.t === 'null' && b.t === 'null') return a;
  if (a.t === 'null') return { ...b, opt: true };
  if (b.t === 'null') return { ...a, opt: true };
  const opt = a.opt || b.opt;
  if (!same(a, b)) return T.any(opt ? { opt } : {});
  const out = { ...a, ...(opt ? { opt } : {}) };
  if (a.t === 'number') { out.lo = Math.min(a.lo, b.lo); out.hi = Math.max(a.hi, b.hi); const why = a.why || b.why; if (why) out.why = why; else delete out.why; }
  if (a.t === 'string') {
    if (a.lits && b.lits) out.lits = [...new Set([...a.lits, ...b.lits])]; else delete out.lits;
    if (typeof a.maxLength === 'number' && typeof b.maxLength === 'number') out.maxLength = Math.max(a.maxLength, b.maxLength); else delete out.maxLength;
  }
  if (a.t === 'array') out.item = join(a.item || T.any(), b.item || T.any());
  if (a.t === 'object') {
    if (a.props && b.props) { const keys = Object.keys(a.props).filter(k => Object.hasOwn(b.props, k)); out.props = Object.fromEntries(keys.map(k => [k, join(a.props[k], b.props[k])])); } else out.props = null;
  }
  return out;
}

// A fold's accumulator (5.6.4): start's type with no proven bounds, since each step may change it.
function widen(t) {
  if (t.t === 'number') return T.num(-Infinity, Infinity, { why: "a fold's accumulator" });
  if (t.t === 'string') return T.str();
  if (t.t === 'array') return { t: 'array', item: t.item ? widen(t.item) : T.any() };
  if (t.t === 'object' && t.props) return { ...t, props: Object.fromEntries(Object.entries(t.props).map(([k, v]) => [k, widen(v)])) };
  return t;
}

// Does a type fit a declared type? Returns null when it fits, else a short reason.
export function misfit(actual, want, label = 'it') {
  if (actual.opt) return `${label} may be null; test it first (5.6.2)`;
  if (!want || want.t === 'any' || actual.t === 'any') return null;
  if (actual.t !== want.t) return `${label} is ${actual.t}, the field needs ${want.t}`;
  if (want.t === 'string' && want.lits && actual.lits) {
    const bad = actual.lits.filter(x => !want.lits.includes(x));
    if (bad.length) return `${label} can be ${JSON.stringify(bad[0])}, outside ${JSON.stringify(want.lits)}`;
  }
  if (want.t === 'array' && actual.item && want.item) return misfit(actual.item, want.item, `${label}'s items`);
  if (want.t === 'object' && actual.props && want.props) {
    for (const [k, w] of Object.entries(want.props)) if (Object.hasOwn(actual.props, k)) { const m = misfit(actual.props[k], w, `${label}.${k}`); if (m) return m; }
  }
  return null;
}

// ---------- intervals ----------
const mulC = (a, b) => (a === 0 || b === 0 ? 0 : a * b);
const corners = (a, b, f) => { const v = [f(a.lo, b.lo), f(a.lo, b.hi), f(a.hi, b.lo), f(a.hi, b.hi)]; return T.num(Math.min(...v), Math.max(...v)); };
const spansZero = (r) => r.lo <= 0 && r.hi >= 0;
function powRange(a, n) {
  // n is a literal number: a.lo..a.hi to the power n (5.6.7)
  if (n === 0) return T.num(1, 1);
  if (Number.isInteger(n)) {
    if (n > 0) {
      const lo = a.lo ** n; const hi = a.hi ** n;
      if (n % 2 === 1) return T.num(lo, hi);
      if (a.lo <= 0 && a.hi >= 0) return T.num(0, Math.max(lo, hi));
      return T.num(Math.min(lo, hi), Math.max(lo, hi));
    }
    if (a.lo > 0 || a.hi < 0) { const v = [a.lo ** n, a.hi ** n]; return T.num(Math.min(...v), Math.max(...v)); }
    return unbounded('a negative power of a range that spans zero');
  }
  if (a.lo >= 0) return T.num(Math.min(a.lo ** n, a.hi ** n), Math.max(a.lo ** n, a.hi ** n));
  return unbounded('a fractional power of a range that may be negative');
}
function powAny(base, exp) {
  const lit = (r) => (r.lo === r.hi && Number.isFinite(r.lo) ? r.lo : null);
  if (lit(exp) !== null) return powRange(base, lit(exp));
  const a = lit(base);
  if (a !== null && a > 0 && Number.isFinite(exp.lo) && Number.isFinite(exp.hi)) {
    if (a === 1) return T.num(1, 1);
    const v = [a ** exp.lo, a ** exp.hi];
    return T.num(Math.min(...v), Math.max(...v));
  }
  return unbounded('a power with no proven exponent range');
}

// The signature table: argument kinds. n number, s string, b boolean, a array, x anything, r row formula.
const MAXITEMS = FORMAT.formulaArrayItems;

// infer(tree, env, report) -> type.
// env: { name(n) -> type | undefined, eventOk, states: Set, uses(id) -> {repeated, outputs, others} | undefined, narrowed: Set }
// report(kind, message): kind is unknown, private, type, formula, shadow, cycle.
export function infer(tree, env, report) {
  const rows = [];
  const narrowed = new Set(env.narrowed || []);
  const key = (n) => JSON.stringify(n);

  const want = (t, kind, what) => {
    if (t.opt) { report('type', `${what} reads a value that may be null; narrow it with r === null ? a : f(r) (5.6.2)`); return; }
    if (t.t === 'any' || t.t === kind) return;
    report('type', `${what} needs ${kind}, found ${t.t}`);
  };
  const wantAny = (t, kinds, what) => {
    if (t.opt) { report('type', `${what} reads a value that may be null; narrow it first (5.6.2)`); return; }
    if (t.t === 'any' || kinds.includes(t.t)) return;
    report('type', `${what} needs ${kinds.join(' or ')}, found ${t.t}`);
  };

  // A direct null test of an expression: `x === null` or `x !== null`. Returns {sub, equals} or null.
  const nullTest = (c) => {
    if (c.k !== 'bin' || (c.op !== '===' && c.op !== '!==')) return null;
    const isNull = (n) => n.k === 'lit' && n.v === null;
    if (isNull(c.r) && !isNull(c.l)) return { sub: key(c.l), equals: c.op === '===' };
    if (isNull(c.l) && !isNull(c.r)) return { sub: key(c.r), equals: c.op === '===' };
    return null;
  };
  const withNarrow = (k, f) => { const had = narrowed.has(k); narrowed.add(k); try { return f(); } finally { if (!had) narrowed.delete(k); } };

  function go(n) {
    let t = node(n);
    if (t.opt && narrowed.has(key(n))) { t = { ...t }; delete t.opt; }
    return t;
  }

  function node(n) {
    switch (n.k) {
      case 'lit':
        if (typeof n.v === 'number') return T.num(n.v, n.v);
        if (typeof n.v === 'string') return T.str([n.v]);
        if (typeof n.v === 'boolean') return T.bool();
        return T.nul();
      case 'name': return name(n.v, n.hsvg);
      case 'mem': return member(n);
      case 'un': {
        const v = go(n.v);
        if (n.op === '!') { want(v, 'boolean', '!'); return T.bool(); }
        want(v, 'number', `unary ${n.op}`);
        if (v.t !== 'number') return T.num();
        return n.op === '-' ? T.num(-v.hi, -v.lo, v.why ? { why: v.why } : {}) : v;
      }
      case 'bin': return binary(n);
      case 'if': {
        const c = go(n.c);
        want(c, 'boolean', 'the condition of ? :');
        const nt = nullTest(n.c);
        const a = nt ? (nt.equals ? go(n.a) : withNarrow(nt.sub, () => go(n.a))) : go(n.a);
        const b = nt ? (nt.equals ? withNarrow(nt.sub, () => go(n.b)) : go(n.b)) : go(n.b);
        return join(a, b);
      }
      case 'arr': {
        let item = null;
        for (const e of n.a) { const t = go(e); item = item ? join(item, t) : t; }
        return { t: 'array', item: item || T.any(), literal: true, max: n.a.length };
      }
      case 'obj': return T.obj(Object.fromEntries(n.e.map(([k, x]) => [k, go(x)])));
      case 'call': return call(n);
    }
    return T.any();
  }

  function name(v, builtin) {
    // `hsvg.<name>` reads only a built-in (D22); a bare name reads the nearest row name, then the author's names,
    // then a built-in.
    if (builtin) {
      const b = env.builtin ? env.builtin(v) : undefined;
      if (b) return b;
      if (!['event', 'uses', 'visits', 'words', 'data'].includes(v)) { report('unknown', `hsvg.${v} is not a built-in value (5.5, 5.9)`); return T.any(); }
    } else {
      for (let i = rows.length - 1; i >= 0; i--) if (Object.hasOwn(rows[i], v)) return rows[i][v];
      if (env.declared?.(v)) { const own = env.name(v); if (own && !own.err) return own; }
    }
    if (v === 'event') {
      if (!env.eventOk) { report('unknown', 'event is read only while an event is handled (in reactions, transitions and links)'); return T.any(); }
      return T.any();
    }
    if (v === 'uses') return { t: 'uses' };
    if (v === 'visits') return { t: 'visits' };
    if (v === 'words') return { t: 'object', props: null, words: true };
    if (v === 'data') return { t: 'object', props: null, data: true };
    const found = env.name(v);
    if (found && found.err) { report(found.err, found.message); return T.any(); }
    if (!found) { report('unknown', `${v} is not a name in this scope`); return T.any(); }
    return found;
  }

  function member(n) {
    // A role-prefixed content field is matched as one name before member access (5.3.1).
    if (n.o.k === 'name' && !n.o.hsvg && n.key.k === 'lit' && typeof n.key.v === 'string' && ROLE_PREFIXES.has(n.o.v)) {
      const found = env.name(`${n.o.v}.${n.key.v}`);
      if (found && !found.err) return found;
    }
    const o = go(n.o);
    const k = n.key.k === 'lit' ? n.key.v : undefined;
    const keyT = n.key.k === 'lit' ? null : go(n.key);
    if (keyT) { wantAny(keyT, ['number', 'string'], 'a member key'); }
    if (o.t === 'uses') {
      if (typeof k !== 'string') return T.any();
      const u = env.uses(k);
      if (!u) { report('unknown', `uses['${k}']: this block has no use "${k}"`); return T.any(); }
      return { t: 'use', id: k, ...u };
    }
    if (o.t === 'use') {
      if (!o.outputs) return T.any();
      if (o.repeated && !o.row) return { ...o, row: true };
      if (typeof k !== 'string') return T.any();
      const out = o.outputs?.get(k);
      if (out) return out;
      if (o.others?.has(k)) report('private', `${k} of use "${o.id}" is not a declared output value (5.4)`);
      else report('unknown', `use "${o.id}" has no output "${k}"`);
      return T.any();
    }
    if (o.t === 'visits') return T.num();
    if (o.data) {
      if (typeof k !== 'string') return T.arr();
      const tbl = env.table?.(k);
      if (tbl === undefined && env.table) { report('unknown', `data.${k}: no data table "${k}" in this scope`); return T.arr(); }
      if (tbl && tbl.err) { report(tbl.err, tbl.message); return T.arr(); }
      return tbl || T.arr();
    }
    if (o.words) return T.str();
    if (o.opt) { report('type', `a member of a value that may be null; narrow it first (5.6.2)`); return T.any(); }
    if (o.t === 'any') return T.any();
    // As the engine (5.6.1): an array or a string has no named members (write length(x), not x.length), and an
    // index is a whole number.
    const index = (what) => {
      if (typeof k === 'string') { report('type', `${what} has no member "${k}"${k === 'length' ? '; write length(...)' : ''} (5.6.1)`); return false; }
      if (typeof k === 'number' && !Number.isInteger(k)) { report('type', `the index ${k} is not a whole number (5.6.1)`); return false; }
      if (keyT) want(keyT, 'number', `${what === 'an array' ? 'an array' : 'a string'} index`);
      return true;
    };
    if (o.t === 'array') { index('an array'); return o.item || T.any(); }
    if (o.t === 'string') { index('a string'); return T.str(); }
    if (o.t === 'object') {
      if (typeof k === 'string' && o.props) {
        if (Object.hasOwn(o.props, k)) return o.props[k];
        report('unknown', `the object has no member "${k}"`);
      }
      return T.any();
    }
    report('type', `a member of ${o.t}`);
    return T.any();
  }

  function binary(n) {
    const op = n.op;
    if (op === '&&' || op === '||') { want(go(n.l), 'boolean', op); want(go(n.r), 'boolean', op); return T.bool(); }
    const a = go(n.l); const b = go(n.r);
    if (op === '===' || op === '!==') return T.bool();
    if (['<', '<=', '>', '>='].includes(op)) { want(a, 'number', op); want(b, 'number', op); return T.bool(); }
    if (op === '+' && (a.t === 'string' || b.t === 'string') && !a.opt && !b.opt) {
      // + joins text, and prints a number beside text (D36); a true or false, a list or an object is no text.
      const ok = (x) => x.t === 'string' || x.t === 'number' || x.t === 'any';
      if (!ok(a)) report('type', `+ joins text, text and a number, or adds two numbers; found ${a.t} and ${b.t}`);
      else if (!ok(b)) report('type', `+ joins text, text and a number, or adds two numbers; found ${a.t} and ${b.t}`);
      return T.str();
    }
    want(a, 'number', op); want(b, 'number', op);
    if (a.t !== 'number' || b.t !== 'number') return T.num();
    switch (op) {
      case '+': return T.num(a.lo + b.lo, a.hi + b.hi);
      case '-': return T.num(a.lo - b.hi, a.hi - b.lo);
      case '*': return corners(a, b, mulC);
      case '/': {
        if (spansZero(b)) return unbounded('a divisor whose range spans zero');
        if (!Number.isFinite(b.lo) && !Number.isFinite(b.hi)) return unbounded('a divisor with no proven range');
        const inv = T.num(1 / b.hi, 1 / b.lo);
        return corners(a, inv, mulC);
      }
      case '%': {
        const lit = b.lo === b.hi && b.lo > 0 ? b.lo : null;
        if (lit !== null && a.lo >= 0) return T.num(0, lit);
        return unbounded('a remainder whose operands are not proven (a non-negative, n a positive literal)');
      }
    }
    return T.num();
  }

  const sig = {
    min: null, max: null,
  };

  function rowCall(n, kind) {
    const list = go(n.a[0]);
    want(list, 'array', n.f);
    const item = list.t === 'array' ? (list.item || T.any()) : T.any();
    rows.push({ item, index: T.num(0, MAXITEMS - 1) });
    let r;
    try { r = go(n.a[1]); } finally { rows.pop(); }
    if (kind) want(r, kind, `${n.f}'s row formula`);
    return { list, item, r };
  }

  function call(n) {
    const f = n.f;
    const arg = (i) => go(n.a[i]);
    switch (f) {
      case 'min': case 'max': {
        const ts = n.a.map(go);
        ts.forEach(t => want(t, 'number', f));
        const ns = ts.filter(t => t.t === 'number');
        if (ns.length !== ts.length) return T.num();
        const pick = f === 'min' ? Math.min : Math.max;
        return T.num(pick(...ns.map(t => t.lo)), pick(...ns.map(t => t.hi)));
      }
      case 'clamp': {
        const [v, lo, hi] = n.a.map(go);
        [v, lo, hi].forEach(t => want(t, 'number', 'clamp'));
        if ([lo, hi].some(t => t.t !== 'number')) return T.num();
        // A value of unknown type is still bounded by the clamp: anything but a number faults at play.
        const x = v.t === 'number' ? v : T.num();
        const fn = (y, l, h) => Math.min(h, Math.max(l, y));
        return T.num(fn(x.lo, lo.lo, hi.lo), fn(x.hi, lo.hi, hi.hi));
      }
      case 'floor': case 'ceil': case 'round': {
        const v = arg(0); want(v, 'number', f);
        if (v.t !== 'number') return T.num();
        const fn = f === 'floor' ? Math.floor : f === 'ceil' ? Math.ceil : (x) => Math.floor(x + 0.5);
        return T.num(fn(v.lo), fn(v.hi), v.why ? { why: v.why } : {});
      }
      case 'pow': {
        const a = arg(0); const e = arg(1); want(a, 'number', 'pow'); want(e, 'number', 'pow');
        if (a.t !== 'number' || e.t !== 'number') return T.num();
        return powAny(a, e);
      }
      case 'sqrt': case 'exp': case 'log': {
        const v = arg(0); want(v, 'number', f);
        if (v.t !== 'number') return T.num();
        if (f === 'exp') return T.num(Math.exp(v.lo), Math.exp(v.hi));
        if (f === 'sqrt') return v.lo < 0 ? unbounded('sqrt of a range that may be negative') : T.num(Math.sqrt(v.lo), Math.sqrt(v.hi));
        return v.lo <= 0 ? unbounded('log of a range that reaches 0 or below') : T.num(Math.log(v.lo), Math.log(v.hi));
      }
      case 'sin': case 'cos': { const v = arg(0); want(v, 'number', f); return T.num(-1, 1); }
      case 'length': {
        const v = arg(0); wantAny(v, ['array', 'string'], 'length');
        // a string's length is bounded by its maxLength (code points), else by the format's longest string
        if (v.t === 'string') return T.num(0, typeof v.maxLength === 'number' ? v.maxLength : FORMAT.formulaResultUnits);
        return T.num(0, v.t === 'array' && v.max !== undefined ? v.max : MAXITEMS);
      }
      case 'at': {
        const o = arg(0); const k = arg(1); const fb = arg(2);
        wantAny(o, ['array', 'object'], 'at');
        if (o.t === 'array') { want(k, 'number', 'at index'); return join(o.item || T.any(), fb); }
        if (o.t === 'object') { want(k, 'string', 'at key'); return T.any(fb.t === 'null' ? { opt: true } : {}); }
        return T.any(fb.t === 'null' ? { opt: true } : {});
      }
      case 'includes': { const l = arg(0); arg(1); want(l, 'array', 'includes'); return T.bool(); }
      case 'lookup': {
        const l = arg(0); const col = arg(1); arg(2); const fb = arg(3);
        want(l, 'array', 'lookup'); want(col, 'string', 'lookup column');
        const row = l.t === 'array' ? (l.item || T.any()) : T.any();
        return join(row, fb);
      }
      case 'append': {
        const l = arg(0); const it = arg(1); const m = arg(2);
        want(l, 'array', 'append'); want(m, 'number', 'append maximum');
        if (m.t === 'number' && (m.lo < 1 || m.hi > FORMAT.listItems) && Number.isFinite(m.lo) && Number.isFinite(m.hi)) report('formula', `append maximum must be 1..${FORMAT.listItems}, found ${m.lo}..${m.hi}`);
        return { t: 'array', item: l.t === 'array' && l.item ? join(l.item, it) : it };
      }
      case 'fold': {
        const list = go(n.a[0]);
        want(list, 'array', 'fold');
        const start = go(n.a[1]);
        const acc = widen(start);
        rows.push({ item: list.t === 'array' ? (list.item || T.any()) : T.any(), index: T.num(0, MAXITEMS - 1), acc });
        let r;
        try { r = go(n.a[2]); } finally { rows.pop(); }
        if (start.t !== 'any' && r.t !== 'any' && !r.opt && start.t !== 'null' && r.t !== start.t) report('type', `fold's step gives ${r.t}, but its start is ${start.t}; the result takes start's type (5.6.4)`);
        return widen(r.t === start.t ? join(start, r) : start);
      }
      // filter keeps at most the rows it is given: the list's maxItems still bounds it (4.5, 5.6.4)
      case 'filter': { const { list } = rowCall(n, 'boolean'); return list.t === 'array' ? { t: 'array', item: list.item, ...(list.max !== undefined ? { max: list.max } : {}) } : T.arr(); }
      case 'count': rowCall(n, 'boolean'); return T.num(0, MAXITEMS);
      case 'sum': {
        const { list, r } = rowCall(n, 'number');
        const max = list.t === 'array' && list.max !== undefined ? list.max : MAXITEMS;
        if (r.t !== 'number') return T.num();
        return T.num(Math.min(0, mulC(max, r.lo)), Math.max(0, mulC(max, r.hi)));
      }
      case 'minBy': { const { list } = rowCall(n, 'number'); return list.t === 'array' ? list.item || T.any() : T.any(); }
      case 'sort': {
        const { list, r } = rowCall(n, null);
        wantAny(r, ['number', 'string'], "sort's row key");
        if (n.a.length > 2) want(go(n.a[2]), 'boolean', 'sort order');
        return list.t === 'array' ? { ...list } : T.arr();
      }
      case 'range': {
        const c = arg(0); want(c, 'number', 'range');
        if (c.t === 'number' && Number.isFinite(c.lo) && (c.lo < 0 || c.hi > MAXITEMS)) report('range', `range takes 0..${MAXITEMS}, found ${c.lo}..${c.hi}`);
        const hi = c.t === 'number' && Number.isFinite(c.hi) ? Math.max(0, Math.min(MAXITEMS, Math.trunc(c.hi))) : MAXITEMS;
        return { t: 'array', item: T.num(0, Math.max(0, hi - 1)), max: hi };
      }
      case 'pick': { const l = arg(0); const s = arg(1); want(l, 'array', 'pick'); want(s, 'number', 'pick seed'); return l.t === 'array' ? l.item || T.any() : T.any(); }
      case 'shuffle': { const l = arg(0); const s = arg(1); want(l, 'array', 'shuffle'); want(s, 'number', 'shuffle seed'); return l.t === 'array' ? { t: 'array', item: l.item } : T.arr(); }
      case 'random': {
        const [lo, hi, sd] = n.a.map(go);
        [lo, hi, sd].forEach(t => want(t, 'number', 'random'));
        if (lo.t !== 'number' || hi.t !== 'number') return T.num();
        return T.num(Math.min(lo.lo, hi.lo), Math.max(lo.hi, hi.hi));
      }
      case 'active': {
        go(n.a[0]);
        const a = n.a[0];
        if (a.k !== 'lit' || typeof a.v !== 'string') { report('formula', 'active() takes a state id written as a string literal (5.6.4)'); return T.bool(); }
        if (env.states && !env.states.has(a.v)) report('unknown', `active('${a.v}'): this block has no machine state "${a.v}"`);
        return T.bool();
      }
      case 'numberText': { want(arg(0), 'number', 'numberText'); const d = arg(1); want(d, 'number', 'numberText decimals'); if (d.t === 'number' && Number.isFinite(d.lo) && (d.lo < 0 || d.hi > 8)) report('formula', `numberText decimals are 0..8, found ${d.lo}..${d.hi}`); return T.str(); }
      case 'formatNumber': { want(arg(0), 'number', 'formatNumber'); const d = arg(1); want(d, 'number', 'formatNumber decimals'); want(arg(2), 'boolean', 'formatNumber grouping'); if (d.t === 'number' && Number.isFinite(d.lo) && (d.lo < 0 || d.hi > 8)) report('formula', `formatNumber decimals are 0..8, found ${d.lo}..${d.hi}`); return T.str(); }
      case 'plural': {
        want(arg(0), 'number', 'plural');
        arg(1);
        const a = n.a[1];
        if (a.k !== 'lit' || typeof a.v !== 'string') report('formula', 'plural() takes a word id written as a string literal (5.6.4)');
        return T.str();
      }
    }
    return T.any();
  }
  void sig;
  return go(tree);
}
