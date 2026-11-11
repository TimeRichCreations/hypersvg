// The grant requests written from use (10.5, D31.4): openUrl when a scene or the shell (or the experience) has an
// openUrl action; storage for each lifetime (session, saved) a value, a knob or the story graph keeps.
// Only these two kinds are derived; page, AI and seat grants stay written. The host still decides (host-profile.mjs).
const LISTS = ['entry', 'exit', 'actions', 'then', 'else'];
const SCOPES = ['session', 'saved'];
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// {openUrl?: true, storage?: [scope]} for one experience: {doc, scenes: {id: {doc}}, shell?: {doc}}.
export function usedGrants(exp) {
  const docs = [exp.doc, ...Object.values(exp.scenes || {}).map(s => s.doc), ...(exp.shell ? [exp.shell.doc] : [])].filter(isObj);
  const blocks = Object.values(exp.blocks || {}).map(b => b.doc).filter(isObj);
  let openUrl = false;
  const storage = new Set();
  const walk = (n) => {
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (!isObj(n)) return;
    for (const k of LISTS) if (Array.isArray(n[k])) for (const a of n[k]) if (isObj(a) && a.call === 'player.openUrl') openUrl = true;
    for (const v of Object.values(n)) if (v && typeof v === 'object') walk(v);
  };
  docs.forEach(walk);
  for (const d of [...docs, ...blocks]) for (const v of Object.values(isObj(d.values) ? d.values : {})) if (SCOPES.includes(v?.lifetime)) storage.add(v.lifetime);
  for (const v of Object.values(isObj(exp.doc?.inputs) ? exp.doc.inputs : {})) if (v?.kind === 'knob' && SCOPES.includes(v.lifetime)) storage.add(v.lifetime);
  if (SCOPES.includes(exp.doc?.story?.lifetime)) storage.add(exp.doc.story.lifetime);
  return { ...(openUrl ? { openUrl: true } : {}), ...(storage.size ? { storage: SCOPES.filter(s => storage.has(s)) } : {}) };
}

// The experience's grants with the derived requests added: {grants, derived}, derived being what was added. A written
// openUrl (true or false) is kept as it is.
export function withUsedGrants(exp) {
  const written = isObj(exp.doc?.grants) ? exp.doc.grants : {};
  const used = usedGrants(exp);
  const derived = {};
  if (used.openUrl && written.openUrl === undefined) derived.openUrl = true;
  const have = Array.isArray(written.storage) ? written.storage : [];
  const more = (used.storage || []).filter(s => !have.includes(s));
  if (more.length) derived.storage = more;
  if (!Object.keys(derived).length) return { grants: exp.doc?.grants, derived };
  return { grants: { ...written, ...(derived.openUrl ? { openUrl: true } : {}), ...(more.length ? { storage: [...have, ...more] } : {}) }, derived };
}
