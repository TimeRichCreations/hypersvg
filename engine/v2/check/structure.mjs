// Structure rules that files can prove: E-KEY-CONFLICT (3.2, 7.4), E-REPEAT-NESTED (4.5),
// E-WAIVER-REASON (8.5), E-WORDS-PATH and W-WORDS-MISSING (2.7, 5.7), E-PROMOTE (4.7), E-PRIVATE-LEAK for private
// licences (A10.1).
const stripForm = (id) => id.replace(/\.(zero|one|two|few|many|other)$/, '');

// The names a word's templates read: each identifier path inside {{ }}, outside string literals.
export function namesRead(text) {
  const out = new Set();
  for (const m of String(text).matchAll(/\{\{([\s\S]*?)\}\}/g)) {
    const code = m[1].replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, '""');
    for (const n of code.matchAll(/(?<![\w.$])([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)(?!\s*\()/g)) out.add(n[1]);
  }
  return out;
}

export function check(ctx) {
  const exp = ctx.experience;
  const lang = exp.doc.language;
  const owners = [{ id: exp.doc.id, file: exp.file, doc: exp.doc, words: exp.words }];
  for (const s of Object.values(exp.scenes)) owners.push({ id: s.doc.id, ...s });
  for (const b of Object.values(exp.blocks)) owners.push({ id: b.doc.id, ...b });
  if (exp.shell) owners.push({ id: exp.shell.doc.id, ...exp.shell });

  // E-KEY-CONFLICT: links (3.2).
  (exp.doc.story?.links || []).forEach((l, i) => {
    if (!l || typeof l !== 'object') return;
    const r = (msg) => ctx.report('E-KEY-CONFLICT', exp.file, `/story/links/${i}`, `link ${l.id ?? i}: ${msg}`);
    const triggers = ['on', 'afterMs', 'choice'].filter(k => l[k] !== undefined);
    if (triggers.length > 1) r(`${triggers.join(' and ')} cannot be on one link`);
    if (l.to !== undefined && l.return !== undefined) r('`to` and `return` cannot be on one link');
    if (l.return !== undefined && l.visit !== undefined) r('`visit` and `return` cannot be on one link');
    if (l.return !== undefined && l.carry !== undefined) r('`carry` and `return` cannot be on one link');
  });
  for (const o of owners) {
    // E-KEY-CONFLICT: a layout has `size` or `shape`, not both (7.4).
    (o.doc.layouts || []).forEach((l, i) => {
      if (l && l.size !== undefined && l.shape !== undefined) ctx.report('E-KEY-CONFLICT', o.file, `/layouts/${i}`, `layout ${l.id ?? i}: \`size\` and \`shape\` cannot both be given`);
    });
    // E-PROMOTE (4.7 rules 3 and 4): a promoted name is new, and has one source.
    const promoted = new Map();
    (o.doc.promote || []).forEach((p, i) => {
      if (!p || typeof p !== 'object') return;
      const name = p.as || String(p.from || '').split('/').pop();
      if (name in (o.doc.inputs || {})) ctx.report('E-PROMOTE', o.file, `/promote/${i}`, `promoted name ${name} is already an input of ${o.id}`);
      else if (promoted.has(name)) ctx.report('E-PROMOTE', o.file, `/promote/${i}`, `promoted name ${name} is promoted twice`);
      promoted.set(name, i);
      const [useId, inner] = String(p.from || '').split('/');
      const use = (o.doc.uses || []).find(u => u && u.id === useId);
      if (use && inner && use.with && inner in use.with) ctx.report('E-PROMOTE', o.file, `/promote/${i}`, `${p.from} is promoted and also given in the with of use ${useId}`);
    });
    // A10.1 rule 6: a private licence never leaves.
    for (const [k, res] of Object.entries(o.doc.resources || {})) {
      if (res && typeof res.license === 'string' && /^LicenseRef-Private(-|$)/.test(res.license)) ctx.report('E-PRIVATE-LEAK', o.file, `/resources/${k}/license`, `resource ${k} has the private licence ${res.license}`);
    }
    // E-WAIVER-REASON (8.5)
    (o.doc.waivers || []).forEach((w, i) => {
      if (!w || typeof w !== 'object') return;
      if (typeof w.reason !== 'string' || !w.reason.trim()) ctx.report('E-WAIVER-REASON', o.file, `/waivers/${i}`, `waiver of ${w.rule ?? i} has no reason`);
    });
    // E-REPEAT-NESTED (4.5): a repeated use of a block that itself holds a repeated use.
    (o.doc.uses || []).forEach((u, i) => {
      if (!u || u.items === undefined || typeof u.use !== 'string') return;
      const inner = exp.blocks[u.use];
      if ((inner?.doc.uses || []).some(x => x && x.items !== undefined)) ctx.report('E-REPEAT-NESTED', o.file, `/uses/${i}`, `use ${u.id} repeats ${u.use}, which holds a repeated use`);
    });
    // W-WORDS-MISSING and E-WORDS-PATH (2.7, 5.7)
    if (!lang || !o.words || !o.words[lang]) continue;
    const base = o.words[lang];
    for (const [l, words] of Object.entries(o.words)) {
      if (l === lang) continue;
      const have = new Set(Object.keys(words).map(stripForm));
      for (const id of new Set(Object.keys(base).map(stripForm))) if (!have.has(id)) ctx.report('W-WORDS-MISSING', o.file, `/words/${l}/${id}`, `${l} has no word "${id}"; the ${lang} word shows`);
      for (const [id, text] of Object.entries(words)) {
        if (!(id in base)) continue;
        const allowed = namesRead(base[id]);
        for (const n of namesRead(text)) if (!allowed.has(n)) ctx.report('E-WORDS-PATH', o.file, `/words/${l}/${id}`, `${l} word "${id}" reads ${n}, which the ${lang} word does not read`);
      }
    }
  }
}
