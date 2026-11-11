// Checks one HyperSVG 2.0 JSON document against the generated schemas: strict JSON (2.1), the header (2.2, 2.3),
// the kind's closed key set with the grammar of every capability its needs names (2.1, 10.11), and the id against
// its file name (2.2). Plain ES module with no imports outside this folder; give it the schema objects.
import { parseStrict } from './json-strict.mjs';
import { Validator } from './validate.mjs';
import { DRAFT_KINDS, draftUses, withoutCovered } from './drafts.mjs';

const clone = (o) => JSON.parse(JSON.stringify(o));

// A pinned preset named in needs: a preset is expanded into content, so it goes in a document's presets list.
function presetInNeeds(n, name) {
  return `${n} is a preset: a preset goes in presets, not needs. Remove it from needs and use it as {"presets": [{"use": "${name}@<version>", "as": "<id>", "with": {...}}]} (12.3)`;
}

export function makeDocumentChecker(schemas) {
  // schemas: { kinds: {name: schema}, capabilities: {name: schema} }
  const capNames = new Set(Object.keys(schemas.capabilities));
  const presetNames = new Set(schemas.presetAddons || []); // pinned outside presets (src/load.mjs withPresetNames)
  const headerKinds = new Set(Object.entries(schemas.kinds).filter(([, s]) => !s['x-hsvg-headerKind']).map(([k]) => k));

  function compose(kindName, needs) {
    const s = clone(schemas.kinds[kindName]);
    const fills = {};
    for (const c of needs) Object.assign(fills, schemas.capabilities[c]?.['x-hsvg-fills'] || {});
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      const f = node['x-hsvg-fill'];
      if (f && fills[f]) {
        const keep = { 'x-hsvg-owner': node['x-hsvg-owner'], 'x-hsvg-section': node['x-hsvg-section'] };
        for (const k of Object.keys(node)) delete node[k];
        Object.assign(node, clone(fills[f]));
        for (const [k, v] of Object.entries(keep)) if (v !== undefined) node[k] = v;
        return;
      }
      for (const v of Object.values(node)) walk(v);
    };
    walk(s);
    return s;
  }

  // needsOf: the capability names a needs list names (module@version counts by module name; font: is not a capability).
  function needsOf(list, out) {
    const unknown = [];
    for (const n of Array.isArray(list) ? list : []) {
      if (typeof n !== 'string') continue;
      if (n.startsWith('font:')) continue;
      const name = n.includes('@') ? n.slice(0, n.indexOf('@')) : n;
      // Only a module carries a version (10.11 rule 5): physics@2.0.0 names nothing.
      const kind = schemas.capabilities[name]?.['x-hsvg-kind'];
      if (n.includes('@') && capNames.has(name) && kind !== 'module' && kind !== 'addon') unknown.push(n);
      // An outside add-on (owner.name, chapter 12) is named with its version, as a module is.
      else if (!n.includes('@') && kind === 'addon') unknown.push(n);
      else if (capNames.has(name)) out.add(name); else unknown.push(n);
    }
    return unknown;
  }

  // ctx: { needs: inherited capability names (or kind => names), file: 'scenes/stop-harbour/scene.json' (forward slashes) }
  function check(input, ctx = {}) {
    const diags = [];
    let doc = input;
    if (typeof input === 'string') {
      try { doc = parseStrict(input); } catch (e) { return { doc: null, diags: [{ code: 'E-JSON', path: '(file)', message: e.message }] }; }
    }
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { doc, diags: [{ code: 'E-JSON', path: '(file)', message: 'a document is one JSON object' }] };
    // A later minor version (hsvg/2.1) is refused with its own code, so a person knows to use a newer engine (2.2).
    const minor = /^hsvg\/2\.([1-9][0-9]*)$/.exec(typeof doc.format === 'string' ? doc.format : '');
    if (minor) return { doc, diags: [{ code: 'E-VERSION-NEWER', path: 'format', message: `this file is ${doc.format}, newer than this engine (hsvg/2.0): play it with an engine of that version` }] };
    if (doc.format !== 'hsvg/2.0') return { doc, diags: [{ code: 'E-HEADER', path: 'format', message: `format must be hsvg/2.0, found ${JSON.stringify(doc.format)}` }] };
    if (DRAFT_KINDS[doc.kind]) return { doc, diags: [{ code: 'E-DRAFT', path: 'kind', message: `kind ${doc.kind} is not in 2.0; a 2.1 draft (spec/2.0/drafts/${DRAFT_KINDS[doc.kind]})` }] };
    if (!headerKinds.has(doc.kind)) return { doc, diags: [{ code: 'E-HEADER', path: 'kind', message: `kind ${JSON.stringify(doc.kind)} is not a document kind` }] };
    // ctx.needs may be a function of the document's kind: whose needs cover it (10.11 rule 1).
    const needs = new Set((typeof ctx.needs === 'function' ? ctx.needs(doc.kind) : ctx.needs) || []);
    const unknownWhy = (n) => {
      const name = n.includes('@') ? n.slice(0, n.indexOf('@')) : n;
      if (n.includes('@') && capNames.has(name)) return `${n}: only a module carries a version; write ${name} (10.11)`;
      if (capNames.has(name)) return `${n}: an outside add-on is named with its version; write ${name}@<version>, the version your about.trust.pins gives (12)`;
      if (presetNames.has(name)) return presetInNeeds(n, name);
      if (/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(name)) return `${n} names no add-on this experience pins: pin it in about.trust.pins as ${name}@<version> with its digest, and put its folder at addons/${name}/ (12)`;
      return `${n} names no capability`;
    };
    for (const n of needsOf(doc.needs, needs)) diags.push({ code: 'E-NEEDS-UNKNOWN', path: 'needs', message: unknownWhy(n) });
    for (const c of needs) for (const d of schemas.capabilities[c]?.['x-hsvg-dependsOn'] || []) {
      if (!needs.has(d)) diags.push({ code: 'E-NEEDS-MISSING', path: 'needs', message: `${c} depends on ${d}, which needs does not name` });
    }
    const schema = compose(doc.kind, needs);
    // Grammar moved to a 2.1 draft is refused by name (E-DRAFT), not as an unknown key.
    const drafts = draftUses(doc);
    diags.push(...drafts, ...withoutCovered(new Validator().validate(schema, doc, { needs }), drafts));
    if (ctx.file && typeof doc.id === 'string') {
      const parts = ctx.file.split('/');
      const base = parts[parts.length - 1].replace(/\.json$/, '');
      const folder = parts.length > 1 ? parts[parts.length - 2] : null;
      const how = schema['x-hsvg-idFromFile'];
      const ok = how === 'folder' ? (folder === doc.id || parts.length === 1)
        : how === 'flat-file' ? base === doc.id
          : how === 'folder-or-flat-file' ? (base === doc.id || folder === doc.id)
            : true;
      if (!ok) diags.push({ code: 'E-ID-FILE', path: 'id', message: `id ${doc.id} does not match ${ctx.file} (${how})` });
    }
    return { doc, diags, needs };
  }

  return { check, compose, needsOf };
}
