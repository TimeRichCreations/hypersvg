// Cycles across uses (5.2, 4.3): a parent's `with` reads a use's output, and that output reads (through the use's
// computed values) the input the `with` fills. The engine would read the input to make the output that makes the
// input: E-CYCLE. Seen across any number of uses of one parent, and through the parent's own computed values. A
// cycle the files cannot show (a formula that names the use by a value) is not found here.
import { parse, parseTemplate, textSlot, isTextDecl } from '../src/formula.mjs';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const esc = (s) => String(s).replace(/~/g, '~0').replace(/\//g, '~1');

// The parsed trees a source holds: a formula, or the {{ }} spans of a text slot's words.
function trees(src, decl) {
  if (typeof src !== 'string') return [];
  try {
    return [parse(src)];
  } catch { return []; }
}
// What a tree reads: {names: Set, outputs: [[useId, output]]} (uses['v'].o, uses.v.o, uses['v'][key].o).
function reads(list) {
  const names = new Set(); const outputs = [];
  const go = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(go); return; }
    if (n.k === 'mem') {
      const lits = []; let o = n;
      while (o?.k === 'mem') { lits.unshift(o.key?.k === 'lit' ? o.key.v : null); if (o.key?.k !== 'lit') go(o.key); o = o.o; }
      if (o?.k === 'name' && o.v === 'uses' && !o.hsvg) { if (typeof lits[0] === 'string' && lits.length >= 2 && typeof lits[lits.length - 1] === 'string') outputs.push([lits[0], lits[lits.length - 1]]); return; }
      go(o); return;
    }
    if (n.k === 'name') { if (!n.hsvg) names.add(n.v); return; }
    for (const v of Object.values(n)) if (v && typeof v === 'object') go(v);
  };
  list.forEach(go);
  return { names, outputs };
}
// A definition's computed values closed over: the names a formula reaches through them, and the use outputs.
function closure(doc, start) {
  const names = new Set(); const outputs = [];
  const seen = new Set();
  const visit = (r) => {
    for (const n of r.names) {
      names.add(n);
      if (isObj(doc.computed) && typeof doc.computed[n] === 'string' && !seen.has(n)) { seen.add(n); visit(reads(trees(doc.computed[n]))); }
    }
    outputs.push(...r.outputs);
  };
  visit(start);
  return { names, outputs };
}

export function check(ctx) {
  const exp = ctx.experience;
  const owners = [...Object.values(exp.scenes || {}), ...Object.values(exp.blocks || {}), ...(exp.shell ? [exp.shell] : [])];
  for (const o of owners) {
    const doc = o?.doc;
    if (!isObj(doc) || !Array.isArray(doc.uses)) continue;
    const uses = new Map(doc.uses.filter(u => isObj(u) && typeof u.id === 'string' && typeof u.use === 'string').map(u => [u.id, u]));
    const defOf = (id) => exp.blocks?.[uses.get(id)?.use]?.doc;
    // in(u, k) -> out(v, o): u's with k reads v's output o (directly or through the parent's computed values).
    // out(v, o) -> in(v, i): v's output o reads v's input i (through v's computed values).
    const edges = new Map();
    const add = (a, b) => { if (!edges.has(a)) edges.set(a, []); edges.get(a).push(b); };
    for (const [id, u] of uses) {
      const def = defOf(id);
      for (const [k, src] of Object.entries(isObj(u.with) ? u.with : {})) {
        const r = closure(doc, reads(trees(src, def?.inputs?.[k])));
        for (const [v, out] of r.outputs) add(`in ${id} ${k}`, `out ${v} ${out}`);
      }
    }
    for (const id of uses.keys()) {
      const def = defOf(id);
      for (const [out, decl] of Object.entries(isObj(def?.outputs) ? def.outputs : {})) {
        if (decl?.kind !== 'result') continue;
        const r = closure(def, reads(trees(decl.value)));
        for (const n of r.names) if (isObj(def.inputs) && n in def.inputs) add(`out ${id} ${out}`, `in ${id} ${n}`);
      }
    }
    // Each with that starts a cycle is reported once, at its own path.
    const said = new Set();
    for (const start of edges.keys()) {
      if (!start.startsWith('in ') || said.has(start)) continue;
      const path = [start]; const on = new Set([start]);
      const found = (function dfs(n) {
        for (const m of edges.get(n) || []) {
          if (m === start) return true;
          if (on.has(m)) continue;
          on.add(m); path.push(m);
          if (dfs(m)) return true;
          path.pop();
        }
        return false;
      })(start);
      if (!found) continue;
      for (const p of path) if (p.startsWith('in ')) said.add(p);
      const [, id, k] = start.split(' ');
      const i = doc.uses.indexOf(uses.get(id));
      const trail = [...path, start].map(p => { const [kind, u, n] = p.split(' '); return kind === 'in' ? `${u}.with.${n}` : `uses['${u}'].${n}`; });
      ctx.report('E-CYCLE', o.file, `/uses/${i}/with/${esc(k)}`, `the uses read each other in a loop: ${trail.join(' -> ')}; an input cannot be made from an output that reads it (5.2)`);
    }
  }
}
