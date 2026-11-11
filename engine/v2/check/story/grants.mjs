// Grants (10.5, 5.15.2): every crossing the content uses names something the experience asked for (E-GRANT).
// Scenes and the shell have the experience's grants. A block has only what each use of it passes down in `grants`.
// Storage: 5.1.2 and 10.5 describe what happens at play time when a session or saved value has no storage grant (the
// value lasts for the run and save:unavailable is emitted), so no file error is reported for it.
// The core signals (signal:self:<hook>) are checked here; the page's (page:<signal>, page calls and their hooks) by the
// page family (check/page.mjs).
import { walk, isObj, allDocs, pathStr } from './model.mjs';

const list = (v) => (Array.isArray(v) ? v : []);

export function checkGrants(ctx, m) {
  const exp = m.exp;
  const docs = allDocs(exp);
  const expGrants = isObj(exp.doc.grants) ? exp.doc.grants : {};

  // What each use of a block passes down.
  const passes = new Map();
  for (const d of docs) walk(d.doc, (n) => {
    if (isObj(n) && typeof n.use === 'string' && typeof n.id === 'string') {
      if (!passes.has(n.use)) passes.set(n.use, []);
      passes.get(n.use).push(isObj(n.grants) ? n.grants : {});
    }
  });

  const has = {
    signal: (g, name) => list(g.signals).includes(name),
    widget: (g, name) => isObj(g.widgets) && name in g.widgets,
    filler: (g, name) => list(g.fillers).includes(name),
    ai: (g, name) => isObj(g.ai) && name in g.ai,
    openUrl: (g) => g.openUrl === true,
  };

  for (const d of docs) {
    // The grant sets that apply here: one for the experience, its scenes and the shell; one per use for a block.
    const sets = d.kind === 'block' ? (passes.get(d.id) || []) : [expGrants];
    if (!sets.length) continue;
    const need = (kind, name, p, what) => {
      if (!sets.every(g => has[kind](g, name))) ctx.report('E-GRANT', d.file, pathStr(p), `${what} is not asked for in grants`);
    };

    walk(d.doc, (n, p) => {
      if (!isObj(n)) return;
      if (isObj(n.on)) for (const ev of Object.keys(n.on)) if (ev.startsWith('signal:')) need('signal', ev.slice(7), [...p, 'on', ev], `the signal ${ev}`);
      for (const k of ['entry', 'exit', 'actions', 'then', 'else']) {
        if (!Array.isArray(n[k])) continue;
        n[k].forEach((a, i) => {
          if (!isObj(a)) return; // ids are optional (D29): an action without one is checked too
          const ap = [...p, k, i];
          if (a.call === 'player.openUrl') need('openUrl', null, ap, 'player.openUrl (grants.openUrl must be true)');
        });
      }
      if (typeof n.custom === 'string' && typeof n.id === 'string') need('widget', n.custom, p, `the custom widget ${n.custom}`);
    });

    if (d.kind === 'experience') {
      const doc = d.doc;
      for (const [i, l] of list(doc.story?.links).entries()) {
        if (typeof l.on === 'string' && l.on.startsWith('signal:')) need('signal', l.on.slice(7), ['story', 'links', i, 'on'], `the signal ${l.on}`);
      }
      for (const [i, c] of list(doc.story?.chapters).entries()) {
        for (const f of ['next', 'back']) if (typeof c[f] === 'string' && c[f].startsWith('signal:')) need('signal', c[f].slice(7), ['story', 'chapters', i, f], `the signal ${c[f]}`);
      }
      for (const [id, seat] of Object.entries(isObj(doc.addons?.seats?.seats) ? doc.addons.seats.seats : {})) {
        if (isObj(seat)) for (const f of list(seat.fillers)) if (f !== 'human') need('filler', f, ['addons', 'seats', 'seats', id, 'fillers'], `the filler ${f} of seat ${id}`);
      }
      for (const [id, seat] of Object.entries(isObj(doc.addons?.ai?.seats) ? doc.addons.ai.seats : {})) {
        if (isObj(seat) && typeof seat.source === 'string') need('ai', seat.source, ['addons', 'ai', 'seats', id, 'source'], `the AI source ${seat.source} of seat ${id}`);
      }
    }
  }
}
