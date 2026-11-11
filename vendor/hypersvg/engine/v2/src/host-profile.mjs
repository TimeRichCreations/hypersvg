// Host profiles (A10.1): what one host runs, grants and limits. The engine reads them at mount.
// - capabilities (A10.1): what the host runs; a package that needs another is refused (E-HOST-RUNS).
// - grants (10.5): the effective grant is the experience's ask and the host's gift, intersected by exact name.
//   A kind the experience asks for and the host does not give refuses the mount (E-GRANT), unless it is optional.
// - budgets (A10.3): the value of a budget rule whose maximum is "host"; no value makes the rule not-run.
// - rules (8.2): host rules; budget rules are measured where the package bytes are known.
// - retention (5.1.2): days to keep stored data. audience (A5.1): children refuses open AI steering.
// - readable (8.9): the readable floor, 12 when absent. options (10.6, 7.1): defaults for host-selected axes.
// The limits key is read by src/limits.mjs (9.8.1). A host without a profile (null) gives no grant (closed by default,
// 10.5, D31): every kind the experience asks for is refused, and treated as optional, since no host is there to
// refuse the mount. A use of one fails at that use.

export const STEERING = ['none', 'ask', 'guided', 'open'];
export const READABLE_DEFAULT = 12;
const LIST_KINDS = ['storage', 'network', 'fillers', 'signals', 'pageActions', 'hooks'];
const KINDS = [...LIST_KINDS, 'ai', 'widgets', 'openUrl'];
const WIDGET_LISTS = ['set', 'emit', 'read', 'listen'];
const MEASURES = ['archiveBytes', 'unpackedBytes', 'files', 'fontBytes', 'soundBytes', 'videoBytes', 'lengthMs', 'tableRows', 'repeatItems', 'pathsRewritten', 'suspendChars'];
const DAY_MS = 86400000;

const refuse = (code, message) => { const e = new Error(`${code} host: ${message}`); e.code = code; e.address = 'host'; throw e; };
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// The checks a host profile needs before the engine reads it, without the schemas (a page has none).
// Returns [{code, path, message}]. The checker validates the whole profile against its schema as well.
export function profileProblems(p) {
  const out = [];
  const bad = (code, path, message) => out.push({ code, path, message });
  if (!isObj(p)) { bad('E-TYPE', '', 'a host profile is an object'); return out; }
  if (p.retention !== undefined && !(Number.isInteger(p.retention) && p.retention >= 1)) bad('E-RANGE', 'retention', `retention is an integer of 1 or more, not ${JSON.stringify(p.retention)}`);
  if (p.audience !== undefined && !['any', 'children'].includes(p.audience)) bad('E-TYPE', 'audience', `audience is any or children, not ${JSON.stringify(p.audience)}`);
  if (p.readable !== undefined && !(typeof p.readable === 'number' && p.readable > 0)) bad('E-TYPE', 'readable', 'readable is a number of CSS pixels above 0');
  if (p.options !== undefined && !isObj(p.options)) bad('E-TYPE', 'options', 'options maps an axis id to an option');
  if (p.grants !== undefined && !isObj(p.grants)) bad('E-TYPE', 'grants', 'grants has the shape of 10.5');
  if (p.capabilities !== undefined && !(Array.isArray(p.capabilities) && p.capabilities.every(c => typeof c === 'string'))) bad('E-TYPE', 'capabilities', 'capabilities is a list of capability names');
  if (p.budgets !== undefined) {
    const list = Array.isArray(p.budgets) ? p.budgets : isObj(p.budgets) ? Object.entries(p.budgets).map(([measure, maximum]) => ({ measure, maximum })) : null;
    if (!list) bad('E-TYPE', 'budgets', 'budgets is a map from measure to number, or a list of {measure, on, maximum}');
    else list.forEach((b, i) => {
      if (!MEASURES.includes(b?.measure)) bad('E-RULE', `budgets.${b?.measure ?? i}`, `unknown budget measure ${b?.measure}`);
      else if (typeof b.maximum !== 'number' || b.maximum < 0) bad('E-TYPE', `budgets.${b.measure}`, 'a budget value is a number of 0 or more');
    });
  }
  if (p.rules !== undefined && !Array.isArray(p.rules)) bad('E-TYPE', 'rules', 'rules is a list (8.1)');
  for (const [i, r] of (Array.isArray(p.rules) ? p.rules : []).entries()) {
    if (r?.kind === 'budget' && !MEASURES.includes(r.measure)) bad('E-RULE', `rules.${i}`, `rule ${r.id}: unknown budget measure ${r.measure}`);
  }
  return out;
}

// Whether a grant value asks for (or gives) anything.
const asks = (kind, v) => (kind === 'openUrl' ? v === true : kind === 'ai' || kind === 'widgets' ? isObj(v) && Object.keys(v).length > 0 : Array.isArray(v) && v.length > 0);

// The effective grants (10.5): {grants, refused: [kind], optional: [kind]}. asked: the experience's grants; given:
// the host profile's (absent: nothing given). A kind is refused when it is asked and nothing of it is given.
export function effectiveGrants(asked = {}, given = {}) {
  const grants = {};
  const refused = [];
  for (const kind of KINDS) {
    const a = asked?.[kind];
    if (!asks(kind, a)) continue;
    const g = given?.[kind];
    let eff;
    if (LIST_KINDS.includes(kind)) eff = Array.isArray(g) ? a.filter(n => g.includes(n)) : [];
    else if (kind === 'openUrl') eff = g === true;
    else if (kind === 'ai') {
      eff = {};
      for (const [src, ceiling] of Object.entries(a)) if (isObj(g) && src in g) eff[src] = STEERING[Math.min(STEERING.indexOf(ceiling), STEERING.indexOf(g[src]))] ?? 'none';
    } else {
      eff = {};
      for (const [w, lists] of Object.entries(a)) {
        if (!isObj(g) || !isObj(g[w])) continue;
        eff[w] = {};
        for (const k of WIDGET_LISTS) if (Array.isArray(lists?.[k])) eff[w][k] = lists[k].filter(n => (g[w][k] || []).includes(n));
      }
    }
    if (!asks(kind, eff)) refused.push(kind);
    grants[kind] = eff;
  }
  const optional = Array.isArray(asked?.optional) ? asked.optional : [];
  return { grants, refused, optional };
}

// The steering ceiling of an AI request (A5.1): the lowest of the seat's steer (default none) and the source's
// grant. open is refused when the host's audience is children: {ceiling, refused}. Used by AI seats.
export function steeringCeiling(seatSteer = 'none', granted = 'none', audience = 'any') {
  const ceiling = STEERING[Math.min(STEERING.indexOf(seatSteer), STEERING.indexOf(granted))] ?? 'none';
  return { ceiling, refused: ceiling === 'open' && audience === 'children' };
}

// The readable floor for a readable rule's minTextPx (8.9): a number as written; "host" takes the profile's readable.
export function readableFloor(minTextPx, profile) {
  if (minTextPx === 'host') return typeof profile?.readable === 'number' ? profile.readable : READABLE_DEFAULT;
  return minTextPx;
}

// The host's value for a budget measure (A10.1): from a map, or from a list entry whose on matches. null when none.
export function hostBudget(profile, measure, on) {
  const b = profile?.budgets;
  if (Array.isArray(b)) {
    const hit = b.find(x => x?.measure === measure && (x.on ?? null) === (on ?? null)) ?? (on == null ? null : b.find(x => x?.measure === measure && x.on == null));
    return typeof hit?.maximum === 'number' ? hit.maximum : null;
  }
  return isObj(b) && typeof b[measure] === 'number' ? b[measure] : null;
}

// Budget rules against measured values (A10.3). rules: [{rule, from}] where from names the document; measures:
// {measure: number | {on: number}} from the actual bytes, absent when not measured. A maximum of "host" takes the
// host's value; a number in content may only be stricter, so the smaller of the two applies (8.6). No value, or no
// measurement, is not-run, never a pass. Returns [{id, from, measure, on, maximum, measured, status, strength}].
export function budgetResults(rules, profile, measures = {}) {
  const out = [];
  for (const { rule: r, from } of rules) {
    if (r?.kind !== 'budget') continue;
    const host = hostBudget(profile, r.measure, r.on);
    let maximum = null;
    if (r.maximum === 'host') maximum = host;
    else if (typeof r.maximum === 'number') maximum = host == null ? r.maximum : Math.min(r.maximum, host);
    const m = measures[r.measure];
    const measured = typeof m === 'number' ? m : isObj(m) ? (m[r.on ?? ''] ?? null) : null;
    const status = maximum == null || measured == null ? 'not-run' : measured <= maximum ? 'pass' : 'fail';
    out.push({ id: r.id, from, measure: r.measure, on: r.on ?? null, maximum, measured, status, strength: r.strength || 'must' });
  }
  return out;
}

// What can be measured from the package bytes (A10.3): unpackedBytes (all, and per member), files, soundBytes,
// videoBytes, fontBytes (all as "resources", and per "resource:<id>"). members: {path: Uint8Array};
// resources: [{id, kind, path}] with paths as members name them. The rest (archiveBytes, lengthMs, ...) is not here.
export function packageMeasures(members, resources = []) {
  const unpacked = { '': 0 };
  let files = 0;
  for (const [p, b] of Object.entries(members)) { files++; unpacked[''] += b.length; unpacked[p] = b.length; }
  const sum = (kind) => { let n = 0; const seen = new Set(); for (const r of resources) if (r.kind === kind && members[r.path] && !seen.has(r.path)) { seen.add(r.path); n += members[r.path].length; } return n; };
  const fonts = { resources: sum('font') };
  for (const r of resources) if (r.kind === 'font' && members[r.path]) fonts[`resource:${r.id}`] = members[r.path].length;
  return { unpackedBytes: unpacked, files, soundBytes: sum('sound'), videoBytes: sum('video'), fontBytes: fonts };
}

// The options a host picks (10.6, 7.1): for each axis whose selector is host, the mount's option, else the profile's,
// else the axis default. Each is checked against the axis (E-AXIS-INPUT). Ids that name no host axis are returned
// in ignored. axes: the experience's axes list.
export function hostOptions(axes = [], given = {}, profile = null) {
  const options = {};
  const ignored = [];
  const hostAxes = new Map();
  for (const a of axes || []) {
    const id = a.id ?? a.axis;
    const select = a.select ?? (a.axis === 'language' ? 'host' : null);
    if (select === 'host') hostAxes.set(id, a);
  }
  const choices = (a) => (Array.isArray(a.options) ? a.options : isObj(a.options) ? Object.keys(a.options) : isObj(a.sizes) ? Object.keys(a.sizes) : isObj(a.shapes) ? Object.keys(a.shapes) : Array.isArray(a.tiers) ? a.tiers.map(t => t.tier) : null);
  for (const id of new Set([...Object.keys(profile?.options || {}), ...Object.keys(given || {})])) if (!hostAxes.has(id)) ignored.push(id);
  for (const [id, a] of hostAxes) {
    const pick = given?.[id] ?? profile?.options?.[id] ?? a.default;
    if (pick === undefined) continue;
    const list = choices(a);
    if (list && !list.includes(pick)) refuse('E-AXIS-INPUT', `option ${JSON.stringify(pick)} is not one of axis ${id}'s options (${list.join(', ')})`);
    options[id] = pick;
  }
  return { options, ignored };
}

// Retention (5.1.2): whether a stored record written at writtenAt is past the profile's retention at now.
// A record without writtenAt is kept (the spec does not say; see the A5 report).
export function expired(writtenAt, profile, now) {
  if (!Number.isInteger(profile?.retention) || typeof writtenAt !== 'number') return false;
  return now - writtenAt > profile.retention * DAY_MS;
}

// Admission (A10.1, 10.5): checks the profile and the grants. Returns what the engine keeps:
// {profile, grants, refused, audience, readable, retention, options, ignoredOptions}. Throws E-HOST-RUNS, E-GRANT, E-RANGE,
// E-TYPE, E-RULE or E-AXIS-INPUT with {code, message}.
export function admitHost(doc, profile, { options = {} } = {}) {
  if (profile == null) {
    const { options: picked, ignored } = hostOptions(doc.axes, options, null);
    const { grants, refused } = effectiveGrants(doc.grants || {}, {});
    return { profile: null, grants, refused, audience: 'any', readable: READABLE_DEFAULT, retention: null, options: picked, ignoredOptions: ignored };
  }
  const problems = profileProblems(profile);
  if (problems.length) refuse(problems[0].code, `${problems[0].path}: ${problems[0].message}`);
  // What the host runs (A10.1): a package that needs a capability outside the profile's list is refused at mount.
  if (Array.isArray(profile.capabilities)) {
    const runs = new Set(profile.capabilities);
    const missing = (doc.needs || []).map(n => String(n).split('@')[0]).filter(n => !runs.has(n));
    if (missing.length) refuse('E-HOST-RUNS', `this host runs ${profile.capabilities.join(', ') || 'no capability'}; the package needs ${missing.join(', ')}`);
  }
  const { grants, refused, optional } = effectiveGrants(doc.grants || {}, profile.grants || {});
  const fatal = refused.filter(k => !optional.includes(k));
  if (fatal.length) refuse('E-GRANT', `the host does not give the grants this experience asks for: ${fatal.join(', ')}`);
  const { options: picked, ignored } = hostOptions(doc.axes, options, profile);
  return {
    profile, grants, refused, audience: profile.audience ?? 'any', readable: readableFloor('host', profile),
    retention: profile.retention ?? null, options: picked, ignoredOptions: ignored,
  };
}

// The resources an experience declares, with paths from the experience's folder: [{id, kind, path}].
export function experienceResources(e) {
  const join = (dir, rel) => { const out = []; for (const p of [...(dir ? dir.split('/') : []), ...rel.split('/')]) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); } return out.join('/'); };
  const docs = [[e.file, e.doc], ...[e.shell, ...Object.values(e.scenes || {}), ...Object.values(e.blocks || {})].filter(Boolean).map(b => [b.file, b.doc])];
  const out = [];
  for (const [file, doc] of docs) for (const [id, r] of Object.entries(doc?.resources || {})) if (r && typeof r.file === 'string') out.push({ id, kind: r.kind, path: join(String(file || '').split('/').slice(0, -1).join('/'), r.file) });
  return out;
}
