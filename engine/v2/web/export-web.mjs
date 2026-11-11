// A studio's "save changes" export (9.10): the edited values of a running experience, as a change draft the change
// tool turns into a request (`node engine/v2/tools/change.mjs make <folder> <draft.json> --id <id> ...`), which fills
// each `old` and `expected` from the folder. A page never writes files itself: it hands the person a JSON file.
// Plain ES module with no imports, for the page and for Node tests.

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// The experience's own input values: {"<experience id>/<input>": value}. Triggers have no value; free text a person
// typed is private (5.3.1) and never exported.
export function inputValues(player) {
  const doc = player.exp.doc;
  const now = player.state.blocks.experience.inputs;
  const out = {};
  for (const [name, d] of Object.entries(doc.inputs || {})) {
    if (!isObj(d) || d.kind === 'trigger' || d.contentType === 'freeText') continue;
    if (name in now) out[`${doc.id}/${name}`] = structuredClone(now[name]);
  }
  return out;
}

// The addresses whose values differ: {address: new value}.
export function editedValues(before, after) {
  const out = {};
  for (const [address, v] of Object.entries(after)) if (address in before && !same(before[address], v)) out[address] = v;
  return out;
}

// A change draft: the request's shape without `expected`, `old` and `by`, which the change tool and whoever
// authenticates the source fill in. Returns null when nothing changed.
export function changeDraft({ target, edits, reason }) {
  const changes = Object.entries(edits).map(([address, v]) => ({ address, new: v }));
  if (!changes.length) return null;
  return { format: 'hsvg/2.0', kind: 'change', at: 'edit', target, reason: String(reason || 'Edited values').slice(0, 500), changes };
}

// Hands the person the draft as a file: doc is the page's document. Returns the file name.
export function downloadDraft(doc, draft, name = `${draft.target}-changes.json`) {
  const url = doc.defaultView.URL.createObjectURL(new doc.defaultView.Blob([`${JSON.stringify(draft, null, 2)}\n`], { type: 'application/json' }));
  const a = doc.createElement('a');
  a.href = url; a.download = name;
  doc.body.appendChild(a); a.click(); a.remove();
  doc.defaultView.setTimeout(() => doc.defaultView.URL.revokeObjectURL(url), 0);
  return name;
}
