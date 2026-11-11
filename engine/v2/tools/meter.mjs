// The loop meter (Q1c finding 6): before a logic module runs, its loader adds a time check, __hsvgTick(), to every
// loop and every function body, so a module that never calls step() still stops at its time budget on the page's
// thread (src/modules.mjs moduleTick). Node standard library only; it reads the code as JavaScript does (strings,
// template literals, regular expressions and comments are kept as written) and changes nothing else:
// - while (c) and do ... while (c): the condition becomes __hsvgTick() && (c);
// - for (a; c; b): c becomes __hsvgTick() && (c), or __hsvgTick() when it is empty (for (;;));
//   for (x of y) and for (x in y) end with y, and a generator they read is metered in its own body;
// - a function's block body (a declaration, an expression, a method, a getter or setter, an arrow) starts with
//   __hsvgTick();, and an arrow's expression body x => e becomes x => { __hsvgTick(); return e; }, so recursion is
//   metered too.
// metered(src) returns the new text, or throws an Error that says what it could not read.
const PUNCT = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=', '=>', '==', '!=', '<=', '>=', '&&', '||',
  '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>'];
const REGEX_AFTER = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^', '${',
  ...PUNCT.filter(p => p !== '++' && p !== '--' && p !== '?.')]);
const REGEX_WORDS = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await', 'instanceof']);
const ID = /[A-Za-z0-9_$\u0080-\uffff\\]/;
const OPEN = new Set(['(', '[', '{', '${']);
const CLOSE = { ')': '(', ']': '[', '}': '{' };
const CONTROL = new Set(['if', 'for', 'while', 'switch', 'catch', 'with']);
// A word that cannot go on an expression at the start of a new line, so the line before ends there (automatic
// semicolons): any identifier, literal or keyword but the binary keywords.
const CONTINUES = new Set(['in', 'instanceof', 'of']);

// The tokens of src: {v, k (id num str tpl rx p), s, e, nl (a line break before it)}; brackets carry .match and every
// token .parent (the index of its innermost open bracket, or -1).
export function tokens(src) {
  const out = [];
  const n = src.length;
  let i = 0; let nl = false;
  const stack = []; // indexes of open brackets in out
  const fail = (why) => { throw new Error(`${why} at character ${i}`); };
  const push = (t) => { t.nl = nl; nl = false; t.parent = stack.length ? stack[stack.length - 1] : -1; out.push(t); return t; };
  const prev = () => out[out.length - 1];
  const regexOk = () => { const p = prev(); return !p || (p.k === 'p' && REGEX_AFTER.has(p.v)) || (p.k === 'id' && REGEX_WORDS.has(p.v)); };
  // From after a backtick or a template's closing brace to the next ${ or closing backtick.
  const template = (start) => {
    for (;;) {
      if (i >= n) fail('an unclosed template literal');
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { i++; push({ v: src.slice(start, i), k: 'tpl', s: start, e: i }); return; }
      if (c === '$' && src[i + 1] === '{') { push({ v: src.slice(start, i), k: 'tpl', s: start, e: i }); const t = push({ v: '${', k: 'p', s: i, e: i + 2 }); stack.push(out.length - 1); void t; i += 2; return; }
      i++;
    }
  };
  while (i < n) {
    const c = src[i]; const d = src[i + 1];
    if (c === '\n' || c === '\r' || c === '\u2028' || c === '\u2029') { nl = true; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n' && src[i] !== '\r') i++; continue; }
    if (c === '/' && d === '*') { const j = src.indexOf('*/', i + 2); if (j < 0) fail('an unclosed comment'); if (/[\n\r\u2028\u2029]/.test(src.slice(i, j))) nl = true; i = j + 2; continue; }
    const s = i;
    if (c === '"' || c === "'") {
      i++;
      while (i < n && src[i] !== c) { if (src[i] === '\\') i++; else if (src[i] === '\n') fail('a line break in a string'); i++; }
      if (i >= n) fail('an unclosed string');
      i++; push({ v: src.slice(s, i), k: 'str', s, e: i }); continue;
    }
    if (c === '`') { i++; template(s); continue; }
    if (c === '/' && regexOk()) {
      i++; let cls = false;
      while (i < n) { const x = src[i]; if (x === '\\') { i += 2; continue; } if (x === '\n') fail('a line break in a regular expression'); if (x === '[') cls = true; else if (x === ']') cls = false; else if (x === '/' && !cls) break; i++; }
      if (i >= n) fail('an unclosed regular expression');
      i++; while (i < n && /[A-Za-z]/.test(src[i])) i++;
      push({ v: src.slice(s, i), k: 'rx', s, e: i }); continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(d))) { i++; while (i < n && /[0-9A-Za-z_.]/.test(src[i])) { if ((src[i] === 'e' || src[i] === 'E') && (src[i + 1] === '+' || src[i + 1] === '-')) i++; i++; } push({ v: src.slice(s, i), k: 'num', s, e: i }); continue; }
    if (ID.test(c) || c === '#') { i++; while (i < n && ID.test(src[i])) { if (src[i] === '\\') i++; i++; } push({ v: src.slice(s, i), k: 'id', s, e: i }); continue; }
    if (c === '}' && stack.length && out[stack[stack.length - 1]].v === '${') {
      const open = stack.pop(); const t = push({ v: '}', k: 'p', s, e: i + 1 }); t.parent = out[open].parent; t.match = open; out[open].match = out.length - 1;
      i++; template(i); continue;
    }
    const p = PUNCT.find(x => src.startsWith(x, i)) || c;
    i += p.length;
    const t = push({ v: p, k: 'p', s, e: i });
    if (OPEN.has(p)) stack.push(out.length - 1);
    else if (CLOSE[p]) {
      const open = stack.pop();
      if (open === undefined || out[open].v !== CLOSE[p]) fail(`an unmatched ${p}`);
      t.parent = out[open].parent; t.match = open; out[open].match = out.length - 1;
    }
  }
  if (stack.length) throw new Error(`an unclosed ${out[stack[stack.length - 1]].v}`);
  return out;
}

const TICK = '__hsvgTick()';
// The index of the last token of the arrow body that starts at token b (an expression, not a block).
function bodyEnd(T, b) {
  const parent = T[b].parent;
  let last = b;
  for (let j = b; j < T.length; j++) {
    const t = T[j];
    if (t.parent !== parent) { if (t.parent === -1 || t.parent < parent || (T[t.parent] && T[t.parent].match < j)) break; continue; } // inside a nested bracket
    if (j > b && t.k === 'p' && [',', ';', ')', ']', '}'].includes(t.v)) break;
    if (j > b && t.nl) {
      const p = T[last];
      const ends = p.k !== 'p' || [')', ']', '}', '++', '--'].includes(p.v);
      const starts = (t.k !== 'p' && !(t.k === 'id' && CONTINUES.has(t.v)) && t.k !== 'tpl') || t.v === '{' || t.v === '++' || t.v === '--';
      if (ends && starts) break;
    }
    if (OPEN.has(t.v) && t.match !== undefined) { last = t.match; j = t.match; continue; }
    last = j;
  }
  return last;
}

export function metered(src) {
  const T = tokens(src);
  const adds = []; // [at, text]
  const word = (j, ...w) => T[j] && T[j].k === 'id' && w.includes(T[j].v) && !(T[j - 1] && T[j - 1].k === 'p' && (T[j - 1].v === '.' || T[j - 1].v === '?.'));
  for (let j = 0; j < T.length; j++) {
    const t = T[j];
    // Loops: the condition.
    if (word(j, 'while') && T[j + 1]?.v === '(') {
      const o = j + 1; const c = T[o].match;
      adds.push([T[o].e, `${TICK} && (`], [T[c].s, ')']);
      continue;
    }
    if (word(j, 'for') && T[j + 1]?.v === '(') {
      const o = j + 1; const c = T[o].match;
      const semis = [];
      for (let k = o + 1; k < c; k++) if (T[k].parent === o && T[k].v === ';') semis.push(k);
      if (semis.length === 2) {
        const [a, b] = semis;
        if (b === a + 1) adds.push([T[a].e, ` ${TICK}`]);
        else adds.push([T[a].e, ` ${TICK} && (`], [T[b].s, ')']);
      }
      continue;
    }
    // Function bodies: a block after a parameter list, or after an arrow.
    if (t.v === '{' && T[j - 1]?.v === ')') {
      const o = T[j - 1].match;
      if (!word(o - 1, ...CONTROL)) adds.push([t.e, ` ${TICK};`]);
      continue;
    }
    if (t.v === '=>') {
      const b = j + 1;
      if (!T[b]) throw new Error('an arrow with no body');
      if (T[b].v === '{') { adds.push([T[b].e, ` ${TICK};`]); continue; }
      const end = bodyEnd(T, b);
      adds.push([T[b].s, `{ ${TICK}; return (`], [T[end].e, '); }']);
    }
  }
  // Apply from the end; at one place, a later add (an inner arrow's end) goes before an earlier one.
  const order = adds.map((a, k) => [...a, k]).sort((x, y) => y[0] - x[0] || x[2] - y[2]);
  let out = src;
  for (const [at, text] of order) out = out.slice(0, at) + text + out.slice(at);
  return out;
}
