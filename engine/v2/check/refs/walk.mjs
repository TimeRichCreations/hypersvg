// Walkers over a block document: its actions, reactions and `on` keys, and the formulas and templates in it.
import { parse, parseTemplate } from '../../src/formula.mjs';

const esc = (s) => String(s).replace(/~/g, '~0').replace(/\//g, '~1');
export const ptr = (...parts) => parts.map(p => `/${esc(p)}`).join('');

// Visits the root and every machine state: v.action(a, path), v.reaction(r, path), v.onKey(key, path),
// v.machine(name, path), v.state(name, path).
export function walkBehaviour(doc, v) {
  const list = (arr, path) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((a, i) => {
      if (!a || typeof a !== 'object') return;
      const p = `${path}/${i}`;
      v.action?.(a, p);
      list(a.then, `${p}/then`);
      list(a.else, `${p}/else`);
    });
  };
  const reactions = (on, path) => {
    if (!on || typeof on !== 'object') return;
    for (const [ev, rs] of Object.entries(on)) {
      const ep = `${path}/${esc(ev)}`;
      v.onKey?.(ev, ep);
      if (!Array.isArray(rs)) continue;
      rs.forEach((r, i) => {
        if (!r || typeof r !== 'object') return;
        v.reaction?.(r, `${ep}/${i}`);
        list(r.actions, `${ep}/${i}/actions`);
      });
    }
  };
  const node = (n, path) => {
    list(n.entry, `${path}/entry`);
    list(n.exit, `${path}/exit`);
    reactions(n.on, `${path}/on`);
    (Array.isArray(n.after) ? n.after : []).forEach((t, i) => {
      if (!t || typeof t !== 'object') return;
      v.reaction?.(t, `${path}/after/${i}`);
      list(t.actions, `${path}/after/${i}/actions`);
    });
    for (const [k, s] of Object.entries(n.states || {})) {
      if (!s || typeof s !== 'object') continue;
      v.state?.(k, `${path}/states/${esc(k)}`, path);
      node(s, `${path}/states/${esc(k)}`);
    }
  };
  node({ entry: doc.entry, exit: doc.exit, on: doc.on }, '');
  for (const [k, m] of Object.entries(doc.machines || {})) {
    if (!m || typeof m !== 'object') continue;
    v.machine?.(k, `/machines/${esc(k)}`);
    node(m, `/machines/${esc(k)}`);
  }
}

// The string literals a formula can give as its result: the whole formula, or the branches of a conditional.
// Returns null when the formula does not parse (the formula check reports that).
export function resultLiterals(src) {
  if (typeof src !== 'string') return [];
  let tree;
  try { tree = parse(src); } catch { return null; }
  const out = [];
  const go = (n) => {
    if (n.k === 'lit' && typeof n.v === 'string') out.push(n.v);
    else if (n.k === 'if') { go(n.a); go(n.b); }
  };
  go(tree);
  return out;
}

// Every `words.<key>` with a literal key in a template or formula string.
export function wordKeys(src, isTemplate) {
  const keys = [];
  const visit = (n) => {
    if (!n || typeof n !== 'object') return;
    if (n.k === 'mem' && n.o?.k === 'name' && n.o.v === 'words' && n.key?.k === 'lit' && typeof n.key.v === 'string') keys.push(n.key.v);
    // plural(count, 'id') reads the word id.<form>, falling back to id.other (2.7): id.other must exist.
    if (n.k === 'call' && n.f === 'plural' && n.a?.[1]?.k === 'lit' && typeof n.a[1].v === 'string') keys.push(`${n.a[1].v}.other`);
    for (const x of [n.c, n.a, n.b, n.l, n.r, n.v, n.o, n.key]) if (x && typeof x === 'object' && !Array.isArray(x)) visit(x);
    if (Array.isArray(n.a)) n.a.forEach(visit);
    if (Array.isArray(n.e)) n.e.forEach(([, x]) => visit(x));
  };
  try {
    if (isTemplate) for (const s of parseTemplate(src)) { if (typeof s === 'object') visit(s.f); }
    else visit(parse(src));
  } catch { /* a bad formula is reported elsewhere */ }
  return keys;
}

// Calls fn(string, path) for every string in a JSON value.
export function eachString(value, fn, path = '') {
  if (typeof value === 'string') fn(value, path);
  else if (Array.isArray(value)) value.forEach((x, i) => eachString(x, fn, `${path}/${i}`));
  else if (value && typeof value === 'object') for (const [k, x] of Object.entries(value)) eachString(x, fn, `${path}/${esc(k)}`);
}
