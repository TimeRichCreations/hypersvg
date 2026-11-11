// D29: an action, a reaction, a binding or a clip track may leave out its id. The engine then keys the entry by its
// position inside its owner (the block definition that holds it), as a path: `bindings[2]`, `clips.walk.tracks[0]`,
// `on.picked[0]`, `on.picked[0].actions[1]`. An id always starts with a letter and has no dot or bracket, so a
// position never equals an id. The paths are found once per owner and kept.
const known = new WeakMap();
function walk(node, at, map) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((x, i) => walk(x, `${at}[${i}]`, map)); return; }
  if (at && !map.has(node)) map.set(node, at);
  for (const k of Object.keys(node)) walk(node[k], at ? `${at}.${k}` : k, map);
}
export function entryKey(owner, entry) {
  if (typeof entry?.id === 'string') return entry.id;
  if (!owner || typeof owner !== 'object') return '(no id)';
  let map = known.get(owner);
  if (!map) { map = new Map(); walk(owner, '', map); known.set(owner, map); }
  return map.get(entry) ?? '(no id)';
}
