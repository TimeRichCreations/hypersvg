// The widgets add-on's words (A6.1, 5.3.2, D31): addons.widgets of a shell holds a declared HTML widget per slot,
// {"<slot>": {"form": {...}}}; addons.widgets.settings of the experience holds its settings (groups and items).
// Pure: the page part, the checker and the reset of settings read them here.
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const KINDS = ['form', 'table', 'choices'];
const kindOf = (w) => (isObj(w) ? KINDS.find(k => k in w) ?? null : null);

// A shell's declared widgets as use-like entries: {id, declared, into, <the kind's fields>}; the id is the slot's.
export function declaredWidgets(doc) {
  const p = doc?.addons?.widgets;
  if (!isObj(p)) return [];
  const out = [];
  for (const [slot, w] of Object.entries(p)) {
    const kind = kindOf(w);
    if (kind) out.push({ ...(isObj(w[kind]) ? w[kind] : {}), id: slot, declared: kind, into: slot });
  }
  return out;
}

// The experience's settings ({groups, items}), or null.
export function settingsOf(doc) {
  const s = doc?.addons?.widgets?.settings;
  return isObj(s) && !kindOf(s) ? s : null;
}
