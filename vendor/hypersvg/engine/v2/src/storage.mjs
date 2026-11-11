// Stored values (5.1.2): the session and saved lifetimes, knobs with those lifetimes, and the story graph's memory
// (3.8). The host gives two stores ({get, set, remove} over strings: in a browser sessionStorage and localStorage), the
// page path and a partition (10.6). A scope is used only when the experience has the storage grant for it (10.5) and
// the host gives a store; otherwise its values last for the run and the engine emits save:unavailable once.
// - One record per scope: {stamp, writtenAt, values: {"<address>#<name>": v}, knobs: {name: v}, graph}, keyed by
//   page path, experience id, partition and scope.
// - Restored before entry actions; a stored value of the wrong type or out of bounds takes its initial value, and the
//   engine emits save:invalid. A record with another saveStamp is dropped whole (save:invalid).
// - Written after each committed transaction, only when something stored changed.
// Not built yet: the site scope, setPartition.
import { checkValue } from './runtime.mjs';
import { storageGrant, restoredRecord } from './limits-runtime.mjs';

const SCOPES = ['session', 'saved'];
const clone = (v) => (v === undefined ? undefined : structuredClone(v));
const PARTITION = /^[A-Za-z0-9._-]{1,128}$/;

export class Stored {
  constructor(doc, host = null) {
    this.doc = doc;
    this.notices = new Set();
    this.stores = {};
    this.data = {};
    this.written = {};
    const granted = storageGrant(doc, host); // the host's effective grant (10.5)
    const partition = host?.partition ?? 'device';
    if (!PARTITION.test(partition)) throw Object.assign(new Error(`partition ${partition} is not 1 to 128 of A-Z a-z 0-9 . _ -`), { code: 'E-RANGE' });
    const page = String(host?.page ?? '').replace(/[?#].*$/, '').replace(/\/$/, '');
    for (const scope of SCOPES) {
      const store = host?.[scope];
      if (!store || !granted.includes(scope)) continue;
      this.stores[scope] = { store, key: `hsvg/2.0|${page}|${doc.id}|${partition}|${scope}` };
      let rec = null; let t = null;
      try { t = store.get(this.stores[scope].key); rec = t ? JSON.parse(t) : null; } catch { rec = null; this.notices.add('save:invalid'); }
      rec = restoredRecord(t, rec, scope, host, this.notices); // stored-data limit and retention days (9.8, 5.1.2)
      if (rec && (typeof rec !== 'object' || rec.stamp !== (doc.saveStamp ?? ''))) { rec = null; this.notices.add('save:invalid'); }
      this.data[scope] = { values: { ...(rec?.values || {}) }, knobs: { ...(rec?.knobs || {}) }, graph: rec?.graph ?? null };
      this.written[scope] = rec ? JSON.stringify({ values: rec.values || {}, knobs: rec.knobs || {}, graph: rec.graph ?? null }) : null;
    }
    this.now = host?.now || (() => Date.now());
  }
  usable(scope) { return !!this.stores[scope]; }
  // A value's start: the stored one when its scope is usable and it checks, else its initial.
  value(address, name, decl) {
    const scope = decl.lifetime;
    if (!SCOPES.includes(scope)) return clone(decl.initial);
    if (!this.usable(scope)) { this.notices.add('save:unavailable'); return clone(decl.initial); }
    const key = `${address}#${name}`;
    const map = this.data[scope].values;
    if (!(key in map)) return clone(decl.initial);
    if (checkValue(decl, map[key])) { delete map[key]; this.notices.add('save:invalid'); return clone(decl.initial); }
    return clone(map[key]);
  }
  knob(name, decl) {
    const scope = decl.lifetime;
    if (!SCOPES.includes(scope)) return clone(decl.initial);
    if (!this.usable(scope)) { this.notices.add('save:unavailable'); return clone(decl.initial); }
    const map = this.data[scope].knobs;
    if (!(name in map)) return clone(decl.initial);
    if (checkValue(decl, map[name])) { delete map[name]; this.notices.add('save:invalid'); return clone(decl.initial); }
    return clone(map[name]);
  }
  // The story graph's memory {counts, visits, resume} for its lifetime, or null.
  graph(lifetime) {
    if (!SCOPES.includes(lifetime)) return null;
    if (!this.usable(lifetime)) { this.notices.add('save:unavailable'); return null; }
    return clone(this.data[lifetime].graph);
  }
  takeNotices() { const n = [...this.notices]; this.notices.clear(); return n; }

  // Writes what changed, after a committed transaction. engine: the Engine (blocks, defs); graph: {counts, visits, resume}.
  persist(engine, graph = null, graphLifetime = null) {
    for (const scope of Object.keys(this.stores)) {
      const d = this.data[scope];
      for (const [address, b] of Object.entries(engine.state.blocks)) {
        const doc = engine.def(address);
        for (const [k, decl] of Object.entries(doc?.values || {})) if (decl.lifetime === scope) d.values[`${address}#${k}`] = clone(b.values[k]);
      }
      const exp = engine.exp.doc;
      for (const [k, decl] of Object.entries(exp.inputs || {})) if (decl.kind === 'knob' && decl.lifetime === scope) d.knobs[k] = clone(engine.state.blocks.experience.inputs[k]);
      if (graphLifetime === scope && graph) d.graph = clone(graph);
      const body = JSON.stringify({ values: d.values, knobs: d.knobs, graph: d.graph });
      if (body === this.written[scope]) continue;
      try {
        this.stores[scope].store.set(this.stores[scope].key, JSON.stringify({ stamp: exp.saveStamp ?? '', writtenAt: this.now(), values: d.values, knobs: d.knobs, graph: d.graph }));
        this.written[scope] = body;
      } catch {
        // Storage failed: from now on this scope lasts for the run (5.1.2).
        delete this.stores[scope];
        this.notices.add('save:unavailable');
      }
    }
  }
  // resetSaved (5.15.1): stored values and the graph memory go; knobs only with settings.
  reset(settings) {
    for (const scope of Object.keys(this.data)) {
      this.data[scope].values = {};
      this.data[scope].graph = null;
      if (settings) this.data[scope].knobs = {};
    }
  }
  // player.clearStorage() (10.6): the partition's stored data goes.
  clear() {
    for (const [scope, s] of Object.entries(this.stores)) {
      try { s.store.remove(s.key); } catch { /* nothing to remove */ }
      this.data[scope] = { values: {}, knobs: {}, graph: null };
      this.written[scope] = null;
    }
  }
}
