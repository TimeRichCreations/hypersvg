// The formula language of HyperSVG 2.0 (5.6) and templates (5.7). Parse once, evaluate many times.
// Faults are thrown as { code, message }: E-FORMULA for a bad formula or a runtime fault, E-RANGE for a budget.
import { FORMAT } from './limits.mjs';

export class FormulaError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const fault = (m, code = 'E-FORMULA') => { throw new FormulaError(code, m); };
const UNSAFE = new Set(['__proto__', 'prototype', 'constructor']);
const RESERVED = new Set(['and', 'or', 'not']);
const PREC = { '||': 2, '&&': 3, '===': 4, '!==': 4, '<': 5, '<=': 5, '>': 5, '>=': 5, '+': 6, '-': 6, '*': 7, '/': 7, '%': 7 };
export const FUNCTIONS = {
  min: [1, 32], max: [1, 32], clamp: [3, 3], floor: [1, 1], ceil: [1, 1], round: [1, 1], pow: [2, 2], sqrt: [1, 1], exp: [1, 1], log: [1, 1], sin: [1, 1], cos: [1, 1], length: [1, 1],
  at: [3, 3], includes: [2, 2], lookup: [4, 4], append: [3, 3], filter: [2, 2], count: [2, 2], sum: [2, 2],
  minBy: [2, 2], pick: [2, 2], shuffle: [2, 2], random: [3, 3], active: [1, 1], numberText: [2, 2],
  formatNumber: [3, 3], plural: [2, 2], sort: [2, 3], range: [1, 1], fold: [3, 3],
};
const ROW_FUNCTIONS = new Set(['filter', 'count', 'sum', 'minBy', 'sort', 'fold']);
// The root of the built-in names (D22, 5.9): `hsvg.now` always reads the built-in `now`, even where an author's own
// value is named `now`. A word followed by `(` is a function, so a value may share a function's name.
export const BUILTIN_ROOT = 'hsvg';

// ---------- tokens ----------
function tokenize(src) {
  if (typeof src !== 'string') fault('a formula is a string');
  if (src.length > FORMAT.formulaSource) fault(`formula source over ${FORMAT.formulaSource} units`, 'E-RANGE');
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    const start = i;
    if (c === '"' || c === "'") {
      i++;
      let v = '';
      for (;;) {
        if (i >= src.length) fault('unterminated string');
        const ch = src[i++];
        if (ch === c) break;
        if (ch < ' ') fault('raw control character in a string');
        if (ch === '\\') {
          const e = src[i++];
          const map = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '\\': '\\', '"': '"', '/': '/' };
          if (e === 'u') { const h = src.slice(i, i + 4); if (!/^[0-9a-fA-F]{4}$/.test(h)) fault('bad \\u escape'); v += String.fromCharCode(parseInt(h, 16)); i += 4; } else if (e === "'" && c === "'") v += "'";
          else if (e in map) v += map[e];
          else fault('bad escape');
        } else v += ch;
      }
      out.push({ t: 'lit', v, start });
    } else if (/[0-9]/.test(c)) {
      const m = /^[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?/.exec(src.slice(i));
      i += m[0].length;
      const n = Number(m[0]);
      if (!Number.isFinite(n)) fault('number not finite');
      out.push({ t: 'lit', v: n, start });
    } else if (/[A-Za-z_$]/.test(c)) {
      const m = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(src.slice(i));
      const w = m[0];
      i += w.length;
      if (w === 'true' || w === 'false') out.push({ t: 'lit', v: w === 'true', start });
      else if (w === 'null') out.push({ t: 'lit', v: null, start });
      else {
        if (!/^[a-z][A-Za-z0-9]*$/.test(w)) fault(`${w} is not a name`);
        if (RESERVED.has(w)) fault(`${w} is reserved`);
        if (UNSAFE.has(w)) fault(`${w} is refused`);
        out.push({ t: 'name', v: w, start });
      }
    } else {
      const m = /^(===|!==|&&|\|\||<=|>=|[+\-*/%<>!()[\]{}.,?:])/.exec(src.slice(i));
      if (!m) fault(c === '=' ? equalsMessage(src, i) : `unexpected character ${c} at ${i}`);
      if (src.startsWith('==', i) && !src.startsWith('===', i)) fault('== is not an operator; use ===');
      if (src.startsWith('!=', i) && !src.startsWith('!==', i)) fault('!= is not an operator; use !==');
      i += m[0].length;
      out.push({ t: m[0], start });
    }
    if (out.length > FORMAT.formulaTokens) fault(`more than ${FORMAT.formulaTokens} tokens`, 'E-RANGE');
  }
  out.push({ t: 'end', start: i });
  return out;
}

// A lone = or == (F1a item 4): say what equality is, since most readers write == first.
function equalsMessage(src, i) {
  const op = src.startsWith('==', i) ? '==' : '=';
  return `${op} at ${i} is not an operator: equality is === (and !==)`;
}

// ---------- parse ----------
const cache = new Map();
export function parse(src) {
  if (cache.has(src)) return cache.get(src);
  const tk = tokenize(src);
  let p = 0;
  let depth = 0;
  const peek = () => tk[p].t;
  const take = (t) => { if (tk[p].t !== t) fault(`expected ${t} at ${tk[p].start} in ${src}`); return tk[p++]; };
  const deeper = () => { if (++depth > FORMAT.formulaDepth) fault(`nesting deeper than ${FORMAT.formulaDepth}`, 'E-RANGE'); };
  function formula() {
    deeper();
    let n = binary(1);
    if (peek() === '?') { p++; const yes = formula(); take(':'); const no = formula(); n = { k: 'if', c: n, a: yes, b: no }; }
    depth--;
    return n;
  }
  function binary(min) {
    let left = unary();
    for (;;) {
      const op = peek();
      const pr = PREC[op];
      if (!pr || pr < min) return left;
      p++;
      const right = binary(pr + 1);
      left = { k: 'bin', op, l: left, r: right };
    }
  }
  function unary() {
    const t = peek();
    if (t === '!' || t === '-' || t === '+') { p++; deeper(); const n = { k: 'un', op: t, v: unary() }; depth--; return n; }
    return member();
  }
  function member() {
    let n = primary();
    for (;;) {
      if (peek() === '.') { p++; const nm = take('name'); n = { k: 'mem', o: n, key: { k: 'lit', v: nm.v } }; } else if (peek() === '[') { p++; const key = formula(); take(']'); n = { k: 'mem', o: n, key }; } else return n;
    }
  }
  function args(close) {
    const out = [];
    if (peek() === close) { p++; return out; }
    for (;;) { out.push(formula()); if (peek() === ',') { p++; continue; } take(close); return out; }
  }
  function primary() {
    const t = tk[p++];
    switch (t.t) {
      case 'lit': return { k: 'lit', v: t.v };
      case 'name':
        if (t.v === BUILTIN_ROOT && peek() !== '(') {
          if (peek() !== '.') fault(`${BUILTIN_ROOT} is read as ${BUILTIN_ROOT}.<name> (5.9)`);
          p++;
          return { k: 'name', v: take('name').v, hsvg: true };
        }
        if (peek() === '(') {
          if (!FUNCTIONS[t.v]) fault(`unknown function ${t.v}`);
          p++;
          const a = args(')');
          const [lo, hi] = FUNCTIONS[t.v];
          if (a.length < lo || a.length > hi) fault(`${t.v} takes ${lo === hi ? lo : `${lo} to ${hi}`} arguments`);
          return { k: 'call', f: t.v, a };
        }
        return { k: 'name', v: t.v };
      case '(': { const n = formula(); take(')'); return n; }
      case '[': return { k: 'arr', a: args(']') };
      case '{': {
        const e = [];
        if (peek() === '}') { p++; return { k: 'obj', e }; }
        for (;;) {
          const key = take('lit');
          if (typeof key.v !== 'string' || UNSAFE.has(key.v)) fault('bad object key');
          take(':');
          e.push([key.v, formula()]);
          if (peek() === ',') { p++; continue; }
          take('}');
          return { k: 'obj', e };
        }
      }
      default: fault(`unexpected ${t.t} at ${t.start} in ${src}`);
    }
  }
  const tree = formula();
  take('end');
  if (cache.size > 20000) cache.clear();
  cache.set(src, tree);
  return tree;
}

// ---------- evaluate ----------
// scope: { name(n) -> value (throws if unknown), active(id) -> boolean, words: {id: text}, language, plural(n) }
const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
const num = (v, what) => { if (typeof v !== 'number' || !Number.isFinite(v)) fault(`${what} needs a number, found ${typeOf(v)}`); return v; };
const bool = (v, what) => { if (typeof v !== 'boolean') fault(`${what} needs a boolean, found ${typeOf(v)}`); return v; };
const arr = (v, what) => { if (!Array.isArray(v)) fault(`${what} needs an array, found ${typeOf(v)}`); if (v.length > FORMAT.formulaArrayItems) fault(`array over ${FORMAT.formulaArrayItems} items`, 'E-RANGE'); return v; };
export const deepEqual = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
function canon(v) { if (Array.isArray(v)) return v.map(canon); if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])); return v; }
const finite = (n) => { if (!Number.isFinite(n)) fault('the result is not finite'); return n; };

export function mix(seed) {
  let x = Math.trunc(seed) % 4294967296;
  if (x < 0) x += 4294967296;
  x >>>= 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

// The plural form of a count in a language (2.7): the platform's CLDR cardinal rule (Intl.PluralRules). Where the
// platform has no Intl or does not know the language, the fixed fallback: `one` for 1, else `other`.
const PLURAL_RULES = new Map();
export function pluralForm(count, language) {
  const fallback = count === 1 ? 'one' : 'other';
  const I = globalThis.Intl;
  if (typeof language !== 'string' || !language || typeof I?.PluralRules !== 'function') return fallback;
  if (!PLURAL_RULES.has(language)) {
    let r = null;
    try { if (I.PluralRules.supportedLocalesOf([language]).length) r = new I.PluralRules(language, { type: 'cardinal' }); } catch { r = null; }
    PLURAL_RULES.set(language, r);
  }
  const r = PLURAL_RULES.get(language);
  return r && I === globalThis.Intl ? r.select(count) : fallback;
}
// The work budget of one evaluation (5.6.6): formulaSteps work steps. A step is one node evaluated (a call, operator,
// name, member access or literal), one row a row function visits, one item it sorts and one value an equality
// visits; and every 16 items an array function copies or 16 characters a string operator builds or reads (a copy
// costs a sixteenth of a node, measured). So no formula can freeze or exhaust the page: the cost of every step is
// bounded. budget.charge(n), when present, also charges the transaction (runtime.mjs meter).
// Two strings in code point order (5.6.4), not by UTF-16 units: at the first unit that differs, a surrogate (a
// character above U+FFFF) sorts after every other unit, as its code point does.
export function pointOrder(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    let x = a.charCodeAt(i); let y = b.charCodeAt(i);
    if (x === y) continue;
    if (x >= 0xd800) x += x >= 0xe000 ? -0x800 : 0x2000;
    if (y >= 0xd800) y += y >= 0xe000 ? -0x800 : 0x2000;
    return x < y ? -1 : 1;
  }
  return a.length - b.length < 0 ? -1 : a.length > b.length ? 1 : 0;
}
const QUARTERS = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // sin and cos at 0, 90, 180 and 270 degrees
export function evaluate(tree, scope, budget = { steps: 0 }) {
  // A meter's charge returns its steps then (runtime.mjs meter), so a step reads no getter.
  const work = (n) => {
    if ((budget.charge ? budget.charge(n) : (budget.steps += n)) > FORMAT.formulaSteps) fault(`more than ${FORMAT.formulaSteps} evaluation steps`, 'E-RANGE');
  };
  const step = () => work(1);
  const bulk = (n) => work(Math.ceil(n / 16));
  // The code point at index k of a string (k < 0: their count), read in one pass with no array built.
  const points = (str, k = -1) => {
    bulk(str.length);
    let n = 0;
    for (let i = 0; i < str.length; i++, n++) {
      const c = str.charCodeAt(i);
      const pair = c >= 0xd800 && c <= 0xdbff && i + 1 < str.length && (str.charCodeAt(i + 1) & 0xfc00) === 0xdc00;
      if (n === k) return str.slice(i, pair ? i + 2 : i + 1);
      if (pair) i++;
    }
    return k < 0 ? n : undefined;
  };
  // Deep JSON equality (5.6.2), each value visited charged; scalars compare at once.
  const same = (a, b) => {
    work(1);
    if (a === b) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!same(a[i], b[i])) return false; return true; }
    const ka = Object.keys(a); if (ka.length !== Object.keys(b).length) return false;
    for (const k of ka) if (!Object.prototype.hasOwnProperty.call(b, k) || !same(a[k], b[k])) return false;
    return true;
  };
  const rows = [];
  const ev = (n) => {
    step();
    switch (n.k) {
      case 'lit': return n.v;
      case 'name': {
        // Row names (item, index, and acc in fold) exist only inside their function's brackets; the nearest wins.
        if (n.hsvg) return scope.builtin ? scope.builtin(n.v) : scope.name(n.v);
        for (let i = rows.length - 1; i >= 0; i--) if (Object.hasOwn(rows[i], n.v)) return rows[i][n.v];
        return scope.name(n.v);
      }
      case 'mem': {
        // A role-prefixed field (action.text) is one declared name, read before member access (5.3.1), as the
        // checker reads it. The scope says which names it declares (has).
        if (n.o.k === 'name' && !n.o.hsvg && n.key.k === 'lit' && typeof n.key.v === 'string' && scope.has?.(`${n.o.v}.${n.key.v}`)) return scope.name(`${n.o.v}.${n.key.v}`);
        const o = ev(n.o);
        const key = ev(n.key);
        if (typeof key === 'string' && UNSAFE.has(key)) fault('refused member');
        if (typeof o === 'string' && Number.isInteger(key) && key >= 0) { const c = points(o, key); if (c !== undefined) return c; }
        if (Array.isArray(o) && typeof key === 'number') { const i = Math.trunc(key); if (i >= 0 && i < o.length && Number.isInteger(key)) return o[i]; fault(`index ${key} is outside the array`); }
        if (o && typeof o === 'object' && !Array.isArray(o) && typeof key === 'string' && Object.prototype.hasOwnProperty.call(o, key)) return o[key];
        fault(`missing member ${String(key)}`);
        break;
      }
      case 'un': {
        const v = ev(n.v);
        if (n.op === '!') return !bool(v, '!');
        return n.op === '-' ? -num(v, 'unary -') : num(v, 'unary +');
      }
      case 'bin': {
        if (n.op === '&&') return bool(ev(n.l), '&&') ? bool(ev(n.r), '&&') : false;
        if (n.op === '||') return bool(ev(n.l), '||') ? true : bool(ev(n.r), '||');
        const a = ev(n.l); const b = ev(n.r);
        switch (n.op) {
          case '===': return same(a, b);
          case '!==': return !same(a, b);
          case '<': return num(a, '<') < num(b, '<');
          case '<=': return num(a, '<=') <= num(b, '<=');
          case '>': return num(a, '>') > num(b, '>');
          case '>=': return num(a, '>=') >= num(b, '>=');
          case '+':
            // + joins text; a number beside text is printed as a template prints it (D36).
            if ((typeof a === 'string' && (typeof b === 'string' || typeof b === 'number')) || (typeof b === 'string' && typeof a === 'number')) {
              const x = typeof a === 'number' ? printNumber(a) : a; const y = typeof b === 'number' ? printNumber(b) : b;
              // A string over the result size can never be a result (5.6.6): it faults before it is built.
              if (x.length + y.length > FORMAT.formulaResultUnits) fault(`a string over ${FORMAT.formulaResultUnits} UTF-16 units`, 'E-RANGE');
              bulk(x.length + y.length);
              return x + y;
            }
            return finite(num(a, '+') + num(b, '+'));
          case '-': return finite(num(a, '-') - num(b, '-'));
          case '*': return finite(num(a, '*') * num(b, '*'));
          case '/': if (num(b, '/') === 0) fault('division by zero'); return finite(num(a, '/') / b);
          case '%': if (num(b, '%') === 0) fault('remainder by zero'); return finite(num(a, '%') % b);
        }
        break;
      }
      case 'if': return bool(ev(n.c), 'the condition of ? :') ? ev(n.a) : ev(n.b);
      case 'arr': { const v = n.a.map(ev); return arr(v, 'an array'); }
      case 'obj': return Object.fromEntries(n.e.map(([k, x]) => [k, ev(x)]));
      case 'call': return call(n);
    }
    fault(`bad node ${n.k}`);
  };
  const rowFn = (n, each) => {
    const list = arr(ev(n.a[0]), n.f);
    work(list.length);
    const out = [];
    list.forEach((item, index) => { rows.push({ item, index }); try { out.push(each(ev(n.a[1]), item)); } finally { rows.pop(); } });
    return out;
  };
  const call = (n) => {
    const f = n.f;
    if (ROW_FUNCTIONS.has(f)) {
      // fold (5.6.4): acc starts as the second argument; the third is evaluated once per row with acc, item and index
      // bound, and its result is the next acc. The result is the last acc (start for an empty list).
      if (f === 'fold') {
        const list = arr(ev(n.a[0]), 'fold');
        work(list.length);
        let acc = ev(n.a[1]);
        list.forEach((item, index) => { rows.push({ item, index, acc }); try { acc = ev(n.a[2]); } finally { rows.pop(); } });
        return acc;
      }
      if (f === 'filter') return rowFn(n, (keep, item) => [bool(keep, 'filter'), item]).filter(([k]) => k).map(([, item]) => item);
      if (f === 'count') return rowFn(n, (keep) => bool(keep, 'count')).filter(Boolean).length;
      if (f === 'sum') return finite(rowFn(n, (v) => num(v, 'sum')).reduce((a, b) => a + b, 0));
      if (f === 'minBy') {
        const list = arr(ev(n.a[0]), 'minBy');
        if (!list.length) fault('minBy needs a non-empty array');
        const keys = rowFn(n, (v) => num(v, 'minBy'));
        let best = 0; keys.forEach((k, i) => { if (k < keys[best]) best = i; });
        return list[best];
      }
      // sort (5.6.4): a new array in the order of a row key, stable; the keys are all numbers or all strings (code
      // point order). A third argument true sorts high to low, still keeping equal rows in their order.
      if (f === 'sort') {
        const list = arr(ev(n.a[0]), 'sort');
        const keys = rowFn(n, (v) => v);
        const kind = typeof keys[0];
        if (!keys.every(k => (typeof k === 'number' && Number.isFinite(k)) || typeof k === 'string') || keys.some(k => typeof k !== kind)) fault('sort needs row keys that are all numbers or all strings');
        const down = n.a.length > 2 ? bool(ev(n.a[2]), 'sort') : false;
        const cmp = kind === 'string' ? pointOrder : (a, b) => (a < b ? -1 : a > b ? 1 : 0);
        work(list.length * Math.ceil(Math.log2(list.length + 1)));
        return list.map((item, i) => i).sort((i, j) => (down ? cmp(keys[j], keys[i]) : cmp(keys[i], keys[j])) || i - j).map(i => list[i]);
      }
    }
    if (f === 'active') { const id = ev(n.a[0]); if (typeof id !== 'string') fault('active needs a state id'); return scope.active(id); }
    const a = new Array(n.a.length);
    for (let i = 0; i < a.length; i++) a[i] = ev(n.a[i]);
    switch (f) {
      case 'min': case 'max': { let m = f === 'min' ? Infinity : -Infinity; for (const x of a) { const v = num(x, f); m = f === 'min' ? Math.min(m, v) : Math.max(m, v); } return m; }
      case 'clamp': { const [v, lo, hi] = a.map(x => num(x, 'clamp')); if (lo > hi) fault('clamp low is above high'); return Math.min(hi, Math.max(lo, v)); }
      case 'floor': return Math.floor(num(a[0], 'floor'));
      case 'ceil': return Math.ceil(num(a[0], 'ceil'));
      case 'round': return Math.floor(num(a[0], 'round') + 0.5);
      case 'pow': return finite(Math.pow(num(a[0], 'pow'), num(a[1], 'pow')));
      case 'sqrt': { const v = num(a[0], 'sqrt'); if (v < 0) fault('sqrt needs a number 0 or more'); return Math.sqrt(v); }
      case 'exp': return finite(Math.exp(num(a[0], 'exp')));
      case 'log': { const v = num(a[0], 'log'); if (v <= 0) fault('log needs a number above 0'); return Math.log(v); }
      // Angles in degrees (5.6.4). Exact at whole multiples of 90, so sin(180) is 0, not a tiny remainder.
      case 'sin': case 'cos': { const d = num(a[0], f); const q = ((d % 360) + 360) % 360; if (q % 90 === 0) return QUARTERS[q / 90][f === 'sin' ? 0 : 1]; return (f === 'sin' ? Math.sin : Math.cos)(d * Math.PI / 180); }
      case 'length': if (typeof a[0] === 'string') return points(a[0]); return arr(a[0], 'length').length;
      case 'at': {
        if (Array.isArray(a[0])) { const i = Math.trunc(num(a[1], 'at')); return i >= 0 && i < a[0].length ? a[0][i] : a[2]; }
        if (a[0] && typeof a[0] === 'object') { const k = a[1]; if (typeof k !== 'string') fault('at on an object needs a string key'); return Object.prototype.hasOwnProperty.call(a[0], k) && !UNSAFE.has(k) ? a[0][k] : a[2]; }
        fault('at needs an array or an object');
        break;
      }
      case 'includes': return arr(a[0], 'includes').some(x => same(x, a[1]));
      case 'lookup': {
        const rowsList = arr(a[0], 'lookup');
        if (typeof a[1] !== 'string') fault('lookup needs a column name');
        for (const r of rowsList) { work(1); if (r && typeof r === 'object' && Object.prototype.hasOwnProperty.call(r, a[1]) && same(r[a[1]], a[2])) return r; }
        return a[3];
      }
      case 'append': { const max = num(a[2], 'append'); if (max < 1 || max > FORMAT.listItems) fault(`append maximum is 1..${FORMAT.listItems}`); const from = arr(a[0], 'append'); bulk(from.length + 1); const out = [...from, a[1]]; return out.slice(Math.max(0, out.length - max)); }
      case 'pick': { const list = arr(a[0], 'pick'); if (!list.length) fault('pick needs a non-empty array'); return list[mix(num(a[1], 'pick')) % list.length]; }
      case 'shuffle': {
        const list = [...arr(a[0], 'shuffle')]; work(list.length); const seed = num(a[1], 'shuffle'); const len = list.length;
        for (let i = len - 1; i >= 1; i--) { const j = mix(seed + (len - 1 - i)) % (i + 1); [list[i], list[j]] = [list[j], list[i]]; }
        return list;
      }
      case 'random': { const [lo, hi, seed] = a.map(x => num(x, 'random')); return lo + ((hi - lo) * mix(seed)) / 4294967296; }
      // range (5.6.4): the whole numbers 0 to n - 1 (n truncated toward zero), at most formulaArrayItems of them.
      case 'range': {
        const c = Math.trunc(num(a[0], 'range'));
        if (c < 0 || c > FORMAT.formulaArrayItems) fault(`range takes 0..${FORMAT.formulaArrayItems}, found ${c}`, 'E-RANGE');
        bulk(c);
        const out = new Array(c);
        for (let i = 0; i < c; i++) out[i] = i;
        return out;
      }
      case 'numberText': return numberText(num(a[0], 'numberText'), num(a[1], 'numberText'));
      case 'formatNumber': {
        const s = numberText(num(a[0], 'formatNumber'), num(a[1], 'formatNumber'));
        const dec = scope.words?.decimalMark ?? '.'; const grp = scope.words?.groupMark ?? ',';
        let [i, d] = s.replace('-', '').split('.');
        if (bool(a[2], 'formatNumber')) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, grp);
        return (s.startsWith('-') ? '-' : '') + i + (d ? dec + d : '');
      }
      case 'plural': {
        const count = num(a[0], 'plural'); const id = a[1];
        if (typeof id !== 'string') fault('plural needs a word id');
        const form = pluralForm(count, scope.language);
        const key = scope.words?.[`${id}.${form}`] !== undefined ? `${id}.${form}` : `${id}.other`;
        const w = scope.words?.[key];
        if (w === undefined) fault(`no word ${id}.${form}`);
        return scope.template ? scope.template(w, key) : w;
      }
    }
    fault(`unknown function ${f}`);
  };
  const v = ev(tree);
  return v;
}

// Shortest decimal, never in exponent form (5.7).
export function printNumber(n) {
  if (Object.is(n, -0)) return '0';
  const s = String(n);
  if (!/e/i.test(s)) return s;
  const [m, e] = s.split(/e/i);
  const exp = Number(e);
  const neg = m.startsWith('-');
  let [ip, fp = ''] = m.replace('-', '').split('.');
  let digits = ip + fp;
  let point = ip.length + exp;
  if (point <= 0) return (neg ? '-' : '') + '0.' + '0'.repeat(-point) + digits;
  if (point >= digits.length) return (neg ? '-' : '') + digits + '0'.repeat(point - digits.length);
  return (neg ? '-' : '') + digits.slice(0, point) + '.' + digits.slice(point);
}
// numberText: round the shortest decimal half toward +infinity to d places (5.7).
export function numberText(n, d) {
  d = Math.trunc(d);
  if (d < 0 || d > 8) fault('decimals are 0..8');
  const s = printNumber(n);
  const neg = s.startsWith('-');
  let [ip, fp = ''] = s.replace('-', '').split('.');
  if (fp.length <= d) return (neg && /[1-9]/.test(ip + fp) ? '-' : '') + ip + (d ? '.' + fp.padEnd(d, '0') : '');
  const keep = fp.slice(0, d);
  const rest = fp.slice(d);
  const half = rest[0] >= '5';
  const exactHalf = rest === '5' || /^50*$/.test(rest);
  // toward +infinity: positive rounds up on half or more; negative rounds away (up in magnitude) only above half
  const up = neg ? (half && !exactHalf) : half;
  let digits = (ip + keep).split('').map(Number);
  if (up) { let i = digits.length - 1; for (; i >= 0; i--) { if (digits[i] === 9) digits[i] = 0; else { digits[i]++; break; } } if (i < 0) digits.unshift(1); }
  const all = digits.join('');
  const intLen = all.length - d;
  const out = d ? all.slice(0, intLen) + '.' + all.slice(intLen) : all;
  const clean = out.replace(/^0+(?=\d)/, '');
  return (neg && /[1-9]/.test(clean) ? '-' : '') + clean;
}

// ---------- templates (5.7) ----------
const tcache = new Map();
export function parseTemplate(src) {
  if (tcache.has(src)) return tcache.get(src);
  if (typeof src !== 'string' || src.length > FORMAT.formulaSource) fault(`template over ${FORMAT.formulaSource} units`, 'E-RANGE');
  const spans = [];
  let lit = '';
  let i = 0;
  while (i < src.length) {
    if (src[i] === '\\' && (src.startsWith('{{', i + 1) || src.startsWith('}}', i + 1))) { lit += src.slice(i + 1, i + 3); i += 3; continue; }
    if (!src.startsWith('{{', i)) { lit += src[i++]; continue; }
    if (lit) { spans.push(lit); lit = ''; }
    let j = i + 2; let q = null; let d = 0;
    for (; j < src.length; j++) {
      const c = src[j];
      if (q) { if (c === '\\') j++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'") q = c;
      else if ('([{'.includes(c)) d++;
      else if (')]}'.includes(c) && !(c === '}' && d === 0)) d--;
      else if (c === '}' && d === 0 && src[j + 1] === '}') break;
    }
    if (j >= src.length) fault('unclosed {{ in a template');
    spans.push({ f: parse(src.slice(i + 2, j)) });
    i = j + 2;
  }
  if (lit) spans.push(lit);
  tcache.set(src, spans);
  return spans;
}
export function renderTemplate(src, scope, budget) {
  return parseTemplate(src).map(s => {
    if (typeof s === 'string') return s;
    const v = evaluate(s.f, scope, budget);
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return printNumber(v);
    if (typeof v === 'boolean') return String(v);
    fault(`a template span cannot print ${typeOf(v)}`);
    return '';
  }).join('');
}

// A `with` formula that is one name (`cta`, not `words.cta` nor `cta + "!"`): the name, else null.
export function oneName(src) {
  if (typeof src !== 'string') return null;
  let tree;
  try { tree = parse(src); } catch { return null; }
  return tree.k === 'name' && !tree.hsvg ? tree.v : null;
}

// ---------- text slots (D31.1) ----------
// A slot whose declaration is text (type string: a text value, input or setting) holds words: a plain string is the
// text, and {{ }} brings in a formula, as a text binding's template does. Numbers, yes/no values, lists and conditions
// stay formulas. Decided by the declaration, never by the string.
export const isTextDecl = (d) => d !== null && typeof d === 'object' && d.type === 'string';
// What a text slot's source holds: {text} (plain words, \{{ read as {{), {formula} (exactly one {{ f }}: its value as
// it is), or {template} (words with {{ }} inside: always text). Faults like a template on an unclosed {{.
export function textSlot(src) {
  const spans = parseTemplate(src);
  if (spans.every(s => typeof s === 'string')) return { text: spans.join('') };
  if (spans.length === 1) return { formula: src.slice(2, -2).trim() };
  return { template: src };
}
// A formula literal of the text s.
export const quoteText = (s) => JSON.stringify(String(s));
// The formula a slot's source stands for. Every value slot holds a formula, text in single quotes (D36): the source as
// it is, whatever the declaration.
export function slotFormula(decl, src) { return src; }
