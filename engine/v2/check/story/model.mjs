// The story model shared by the story checks: ids, links, chapters and what each scene shows to the graph.
export const ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

// Visits every node of a JSON value. fn(node, path) where path is a list of keys and indexes.
export function walk(node, fn, path = []) {
  fn(node, path);
  if (Array.isArray(node)) node.forEach((v, i) => walk(v, fn, [...path, i]));
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, fn, [...path, k]);
}
export const pathStr = (p) => p.map((k, i) => (typeof k === 'number' ? `[${k}]` : (i ? '.' : '') + k)).join('');
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
export { isObj };

// The capability names of a needs list: modules lose their version, font: entries are not capabilities.
export const needNames = (list) => (Array.isArray(list) ? list : []).filter(n => typeof n === 'string' && !n.startsWith('font:')).map(n => (n.includes('@') ? n.slice(0, n.indexOf('@')) : n));

// Every document of the experience: {file, doc, kind, id}.
export function allDocs(exp) {
  const out = [{ file: exp.file || 'experience.json', doc: exp.doc, kind: 'experience', id: exp.doc.id }];
  for (const [id, s] of Object.entries(exp.scenes || {})) out.push({ file: s.file, doc: s.doc, kind: 'scene', id });
  for (const [id, b] of Object.entries(exp.blocks || {})) out.push({ file: b.file, doc: b.doc, kind: 'block', id });
  if (exp.shell) out.push({ file: exp.shell.file, doc: exp.shell.doc, kind: 'shell', id: exp.shell.doc.id });
  return out;
}

// Builds the model. Everything is read from the loaded experience; nothing is changed.
export function buildModel(ctx) {
  const exp = ctx.experience;
  const doc = exp.doc;
  const story = isObj(doc.story) ? doc.story : {};
  const m = { exp, doc, story, file: exp.file || 'experience.json' };
  m.sceneIds = Object.keys(isObj(story.scenes) ? story.scenes : {});
  m.sceneSet = new Set(m.sceneIds);
  m.chapters = Array.isArray(story.chapters) ? story.chapters : [];
  m.chapterById = new Map();
  m.chapters.forEach((c, i) => { if (c && typeof c.id === 'string' && !m.chapterById.has(c.id)) m.chapterById.set(c.id, { c, i }); });
  m.hasShell = typeof doc.shell === 'string';
  m.shellId = exp.shell?.doc?.id ?? (m.hasShell ? doc.shell.split('/').pop().replace(/\.json$/, '') : null);
  m.shellDoc = exp.shell?.doc || null;
  m.links = (Array.isArray(story.links) ? story.links : []).map((l, i) => ({ ...l, _i: i, _path: `story.links[${i}]` }));
  m.triggers = new Set(Object.entries(isObj(doc.inputs) ? doc.inputs : {}).filter(([, v]) => v && v.kind === 'trigger').map(([k]) => k));

  // The block a scene is: its own document, or the definition it is a use of (4.9).
  m.scene = (id) => {
    const s = isObj(story.scenes) ? story.scenes[id] : undefined;
    if (typeof s === 'string') return exp.scenes?.[id] ? { id, doc: exp.scenes[id].doc, file: exp.scenes[id].file, drawings: exp.scenes[id].drawings || {}, use: null } : null;
    if (isObj(s)) {
      const b = exp.blocks?.[s.use];
      return b ? { id, doc: b.doc, file: b.file, drawings: b.drawings || {}, use: s } : { id, doc: null, file: m.file, drawings: {}, use: s };
    }
    return null;
  };
  m.isChapter = (id) => m.chapterById.has(id);
  m.isOrdered = (id) => !!m.chapterById.get(id)?.c.next;
  m.stepId = (s) => (typeof s === 'string' ? s : s?.scene);
  m.stepSkippable = (s) => isObj(s) && s.skipWhen !== undefined;
  return m;
}

// The scenes a link or start entry to `to` can enter (a chapter enters one of its first present steps, or `after`).
export function entryTargets(m, to) {
  if (m.sceneSet.has(to)) return [to];
  const ch = m.chapterById.get(to)?.c;
  if (!ch || !ch.next) return [];
  const steps = Array.isArray(ch.scenes) ? ch.scenes : [];
  const out = [];
  let allSkippable = true;
  for (const s of steps) {
    const id = m.stepId(s);
    if (!m.sceneSet.has(id)) continue; // an unknown step is reported where it is listed
    out.push(id);
    if (!m.stepSkippable(s)) { allSkippable = false; break; }
  }
  if (allSkippable && ch.after) out.push(...entryTargets(m, ch.after).filter(x => !out.includes(x)));
  return out;
}

// The links the engine builds for ordered chapters (3.12), as plain edges.
export function chapterEdges(m) {
  const out = [];
  m.chapters.forEach((ch, ci) => {
    if (!ch || !ch.next || !Array.isArray(ch.scenes)) return;
    const steps = ch.scenes;
    steps.forEach((s, i) => {
      const from = m.stepId(s);
      if (!m.sceneSet.has(from)) return;
      // Next goes to the next present step; skipped steps are passed over.
      const nexts = [];
      let skippable = true;
      for (let j = i + 1; j < steps.length; j++) {
        const id = m.stepId(steps[j]);
        if (!m.sceneSet.has(id)) continue;
        nexts.push(id);
        if (!m.stepSkippable(steps[j])) { skippable = false; break; }
      }
      if (skippable && ch.after) nexts.push(...entryTargets(m, ch.after));
      out.push({ from, on: ch.next, kind: 'on', tos: nexts, chapter: ci, field: 'next', id: `${ch.id}-next-${i + 1}` });
      if (ch.back) {
        const backs = [];
        let sk = true;
        for (let j = i - 1; j >= 0; j--) {
          const id = m.stepId(steps[j]);
          if (!m.sceneSet.has(id)) continue;
          backs.push(id);
          if (!m.stepSkippable(steps[j])) { sk = false; break; }
        }
        if (sk && ch.before) backs.push(...entryTargets(m, ch.before));
        out.push({ from, on: ch.back, kind: 'on', tos: backs, chapter: ci, field: 'back', id: `${ch.id}-back-${i + 1}` });
      }
    });
  });
  return out;
}

export const linkKind = (l) => (l.on !== undefined ? 'on' : l.afterMs !== undefined ? 'timed' : l.choice !== undefined ? 'choice' : 'other');
