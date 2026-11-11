// Rules of section 8, as far as files can prove them: subjects (8.2), strengths and proof kinds (8.1, 8.4, 8.8), kind
// parameters (8.9, A10.3, A11.1), combining (8.6), waivers (8.5) and the budgets that files can measure (A10.3).
// Codes: E-RULE, E-RULE-SUBJECT, E-RULE-CONFLICT, E-RIGHTS, E-REF-UNKNOWN, E-KEY-REQUIRED.
// What only play can prove is listed by playingOnly(experience) (see playing.mjs).
import { parseXml } from '../../schema/xml.mjs';
import { PROOFS, BUDGET_MEASURES, ADDRESS } from './tables.mjs';
import { combine } from './combine.mjs';
import { roleOf, boxOf, keepOf } from '../../src/marks.mjs';

export { playingOnly } from './playing.mjs';

const dirOf = (rel) => rel.split('/').slice(0, -1).join('/');
const join = (dir, rel) => {
  const out = [];
  for (const p of [...(dir ? dir.split('/') : []), ...rel.split('/')]) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); }
  return out.join('/');
};

// What a document draws: part ids, roles and places, across its frames.
function drawnFacts(entry) {
  const facts = { ids: new Set(), roles: new Set(), places: new Set() };
  const ns = entry.doc.id;
  const local = (id) => (id === ns ? id : id.startsWith(`${ns}__`) ? id.slice(ns.length + 2) : id);
  for (const d of Object.values(entry.drawings || {})) {
    let root;
    try { root = parseXml(d.text); } catch { continue; }
    const walk = (n) => {
      if (!n.name) return;
      const a = n.attrs;
      if (a.id) facts.ids.add(local(a.id));
      if (roleOf(a)) facts.roles.add(roleOf(a));
      if (a.id && (a['data-hsvg-slot'] !== undefined || a['data-hsvg-route'] !== undefined || boxOf(a) !== null || keepOf(a) !== null)) facts.places.add(local(a.id));
      if (a['data-hsvg-slot']) facts.places.add(a['data-hsvg-slot']);
      n.children.forEach(walk);
    };
    walk(root);
  }
  return facts;
}

export function check(ctx) {
  const { experience: exp, report, source } = ctx;
  const docs = [];
  const add = (kind, id, entry) => docs.push({ kind, id, entry, file: entry.file, doc: entry.doc, facts: null });
  add('experience', exp.doc.id, { file: exp.file, doc: exp.doc, drawings: {} });
  for (const [id, s] of Object.entries(exp.scenes)) add('scene', id, s);
  if (exp.shell) add('shell', exp.shell.doc.id, exp.shell);
  for (const [id, b] of Object.entries(exp.blocks)) add(b.doc.kind || 'component', id, b);
  const byId = new Map(docs.map(d => [d.id, d]));
  const byBlock = (name) => docs.find(d => d.kind !== 'scene' && d.kind !== 'shell' && d.kind !== 'experience' && d.id === name);
  const facts = (d) => (d.facts ??= drawnFacts(d.entry));

  // The documents inside a document: its used blocks, transitively. The experience holds every scene and the shell.
  const inside = (d) => {
    const seen = new Set();
    const go = (x) => {
      const list = x.kind === 'experience' ? docs.filter(y => y !== x && (y.kind === 'scene' || y.kind === 'shell')) : (x.doc.uses || []).map(u => (typeof u.use === 'string' ? byBlock(u.use) : null)).filter(Boolean);
      for (const y of list) if (!seen.has(y)) { seen.add(y); go(y); }
    };
    go(d);
    return [d, ...seen];
  };

  // ----- 8.2: does a subject match anything in the document or in a block used inside it? -----
  function resolves(d, address) {
    const scope = inside(d);
    const [form, name = ''] = address.includes(':') ? [address.slice(0, address.indexOf(':')), address.slice(address.indexOf(':') + 1)] : [address, ''];
    const has = (f) => scope.some(f);
    switch (form) {
      case 'part': return has(x => facts(x).ids.has(name));
      case 'role': return has(x => facts(x).roles.has(name));
      case 'place': return has(x => facts(x).places.has(name) || facts(x).ids.has(name));
      case 'input': return has(x => name in (x.doc.inputs || {}) || (x.doc.promote || []).some(p => (p.as || String(p.from || '').split('/').pop()) === name)) || (d.kind === 'scene' || d.kind === 'shell' ? name in (exp.doc.inputs || {}) : false);
      case 'value': return has(x => name in (x.doc.values || {})) || (d.kind === 'scene' || d.kind === 'shell' ? name in (exp.doc.values || {}) : false);
      case 'use': return has(x => (x.doc.uses || []).some(u => u.id === name));
      case 'scene': return name in exp.scenes;
      case 'data': return has(x => name in (x.doc.data || {})) || name in (exp.doc.data || {});
      case 'resource': return has(x => name in (x.doc.resources || {})) || name in (exp.doc.resources || {});
      case 'field': {
        // A content field by its own name (5.3.1, a role-prefixed name too), or a part, role or use and a field of it.
        if (has(x => name in (x.doc.inputs || {})) || ((d.kind === 'scene' || d.kind === 'shell') && name in (exp.doc.inputs || {}))) return true;
        const [owner, field] = name.split('.');
        return has(x => facts(x).ids.has(owner) || facts(x).roles.has(owner) || (x.doc.uses || []).some(u => u.id === owner)) && (field === undefined || has(x => field in (x.doc.inputs || {})) || field === 'text' || field === 'label');
      }
      case 'controls': return has(x => Object.keys(x.doc.controls || {}).length > 0);
      case 'graph': return exp.doc.story !== undefined;
      case 'resources': return has(x => Object.keys(x.doc.resources || {}).length > 0) || Object.keys(exp.doc.resources || {}).length > 0;
      case 'color': case 'document': case 'play-test': return true; // themes, documents and play tests are checked with their own files
    }
    return true;
  }

  const addresses = (s) => (s === undefined ? [] : Array.isArray(s) ? s : [s]);
  const kitPacks = new Map(); // id -> { id, rules } read from rulePacks paths

  for (const d of docs) {
    const rep = (code, path, message, file = d.file) => report(code, file, path, message);
    const rules = Array.isArray(d.doc.rules) ? d.doc.rules : [];
    rules.forEach((r, i) => {
      if (!r || typeof r !== 'object') return;
      const p = `/rules/${i}`;
      checkRule(d, r, p, rep);
    });
    checkWaivers(d, rep);
  }

  function checkRule(d, r, p, rep) {
    // subject (8.2)
    for (const a of addresses(r.subject)) {
      if (typeof a !== 'string' || !ADDRESS.test(a)) continue; // the schema reports a bad address
      if (!resolves(d, a)) rep('E-RULE-SUBJECT', `${p}/subject`, `rule ${r.id}: the subject ${a} matches nothing in ${d.id} or in any block used inside it (8.2)`);
    }
    // strength and proof (8.1, 8.4, 8.8)
    // The schema already refuses a give-way kind outside the list of 8.4 and a missing `steps` or `floor`.
    const allowed = PROOFS[r.kind];
    if (allowed) {
      for (const k of Array.isArray(r.proof) ? r.proof : r.proof ? [r.proof] : []) {
        if (k !== 'review' && !allowed.includes(k)) rep('E-RULE', `${p}/proof`, `rule ${r.id}: ${r.kind} cannot be proven by ${k}; it gives ${allowed.join(' or ')} (8.9)`);
      }
    }
    if (r.reviewBy !== undefined) {
      const proofs = Array.isArray(r.proof) ? r.proof : r.proof ? [r.proof] : (allowed || []);
      if (!proofs.includes('review')) rep('E-RULE', `${p}/reviewBy`, `rule ${r.id}: reviewBy belongs to rules with a review proof (8.8)`);
    }
    // layouts must be layouts of the document (8.1)
    if (Array.isArray(r.layouts)) {
      // `layouts` is a list: the ids are those of its entries, plan-only layouts included (7.4).
      const known = new Set((Array.isArray(d.doc.layouts) ? d.doc.layouts : []).map(l => l && l.id).filter(Boolean));
      r.layouts.forEach((l, k) => { if (!known.has(l)) rep('E-REF-UNKNOWN', `${p}/layouts/${k}`, `rule ${r.id}: layout ${l} is not a layout of ${d.id} (8.1)`); });
    }
    // kind parameters
    param(d, r, p, rep);
  }

  function num(v) { return typeof v === 'number' && Number.isFinite(v); }
  function param(d, r, p, rep) {
    const bad = (key, msg) => rep('E-RULE', `${p}/${key}`, `rule ${r.id}: ${msg}`);
    switch (r.kind) {
      case 'limit':
        if (num(r.minimum) && num(r.maximum) && r.minimum > r.maximum) bad('minimum', `minimum ${r.minimum} is above maximum ${r.maximum}`);
        if (num(r.minLength) && num(r.maxLength) && r.minLength > r.maxLength) bad('minLength', `minLength ${r.minLength} is above maxLength ${r.maxLength}`);
        limitOnInput(d, r, p, rep);
        break;
      case 'keep':
        if (r.minSize !== undefined && !(Array.isArray(r.minSize) && r.minSize.length === 2 && r.minSize.every(x => num(x) && x > 0))) bad('minSize', 'minSize is [width, height] in positive CSS pixels');
        break;
      case 'readable': case 'contrast': case 'hit-target': case 'timing':
        break;
      case 'budget': budget(d, r, p, rep); break;
      case 'scoring':
        if (num(r.minimum) && num(r.maximum) && r.minimum >= r.maximum) rep('E-RANGE', `${p}/maximum`, `rule ${r.id}: a scoring maximum is above its minimum (5.16)`);
        break;
    }
    if (r.floor && typeof r.floor === 'object') {
      if (num(r.floor.minShare) && (r.floor.minShare < 0 || r.floor.minShare > 1)) bad('floor/minShare', 'minShare is 0..1');
      if (num(r.floor.minTextPx) && r.floor.minTextPx <= 0) bad('floor/minTextPx', 'minTextPx is a positive number of CSS pixels');
    }
  }

  // A limit on an input (8.7): the declared bounds must lie inside the limit, or the guarantee is not proven for the whole range.
  function limitOnInput(d, r, p, rep) {
    if ((r.strength || 'must') !== 'must') return;
    for (const a of addresses(r.subject)) {
      if (typeof a !== 'string' || !a.startsWith('input:')) continue;
      const decl = d.doc.inputs?.[a.slice(6)];
      if (!decl || decl.type !== 'number') continue;
      if (num(r.minimum) && !(num(decl.minimum) && decl.minimum >= r.minimum)) rep('E-RULE', `${p}/minimum`, `rule ${r.id}: ${a} may go below ${r.minimum}: its declared minimum is ${num(decl.minimum) ? decl.minimum : 'not set'} (8.7)`);
      if (num(r.maximum) && !(num(decl.maximum) && decl.maximum <= r.maximum)) rep('E-RULE', `${p}/maximum`, `rule ${r.id}: ${a} may go above ${r.maximum}: its declared maximum is ${num(decl.maximum) ? decl.maximum : 'not set'} (8.7)`);
    }
  }

  // ----- budgets (A10.3): the ones files can measure -----
  function budget(d, r, p, rep) {
    if (r.measure !== undefined && !BUDGET_MEASURES.has(r.measure)) { rep('E-RULE', `${p}/measure`, `rule ${r.id}: ${r.measure} is not a budget measure (A10.3)`); return; }
    if (!num(r.maximum)) return; // "host" is valued by the host profile: not-run here
    if ((r.strength || 'must') !== 'must' || typeof source.bytes !== 'function') return;
    let total = null; let what = '';
    const resourcesOf = () => {
      const out = [];
      for (const x of docs) for (const [id, res] of Object.entries(x.doc.resources || {})) if (res && typeof res.file === 'string') out.push({ id, kind: res.kind, rel: join(dirOf(x.file), res.file) });
      return out;
    };
    const size = (list) => { let n = 0; for (const x of list) { const b = source.bytes(x.rel); if (b) n += b.length; } return n; };
    if (r.measure === 'soundBytes') { total = size(resourcesOf().filter(x => x.kind === 'sound')); what = 'all sounds'; }
    else if (r.measure === 'videoBytes') { total = size(resourcesOf().filter(x => x.kind === 'video')); what = 'all videos'; }
    else if (r.measure === 'fontBytes') {
      const fonts = resourcesOf().filter(x => x.kind === 'font');
      const one = typeof r.on === 'string' && r.on.startsWith('resource:') ? fonts.filter(x => x.id === r.on.slice(9)) : fonts;
      const each = typeof r.on === 'string' && r.on.startsWith('resource:');
      total = each ? size(one) : size(fonts); what = each ? `font ${r.on.slice(9)}` : 'all fonts';
    } else if (r.measure === 'tableRows') {
      const name = typeof r.on === 'string' && r.on.startsWith('data:') ? r.on.slice(5) : null;
      if (name && exp.data?.[name]) { total = exp.data[name].length; what = `rows of ${name}`; }
    }
    if (total !== null && total > r.maximum) rep('E-RULE', `${p}/maximum`, `rule ${r.id}: ${what} are ${total}, over the budget ${r.maximum} (${r.measure}, A10.3)`);
  }

  // ----- 8.5: waivers -----
  function packOf(d, id) {
    // a rule pack named by path in rulePacks, or the document with that id
    for (const entry of d.doc.rulePacks || []) {
      if (typeof entry !== 'string') continue;
      const rel = join(dirOf(d.file), entry);
      if (kitPacks.has(rel)) { const k = kitPacks.get(rel); if (k?.id === id) return k; continue; }
      let parsed = null;
      try { const text = source.read(rel); parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
      kitPacks.set(rel, parsed);
      if (parsed?.id === id) return parsed;
    }
    return null;
  }
  function checkWaivers(d, rep) {
    (d.doc.waivers || []).forEach((w, i) => {
      if (!w || typeof w !== 'object' || typeof w.rule !== 'string') return;
      const p = `/waivers/${i}`;
      const [owner, ruleId] = w.rule.split('/');
      if (owner === 'hsvg-baseline') { rep('E-RIGHTS', `${p}/rule`, `waiver of ${w.rule}: hsvg-baseline rules cannot be waived in content (8.5)`); return; }
      const holder = byId.get(owner) || packOf(d, owner);
      const usesPack = (d.doc.rulePacks || []).some(e => e && typeof e === 'object' && String(e.use || '').split('@')[0] === owner);
      if (!holder) {
        if (!usesPack) rep('E-REF-UNKNOWN', `${p}/rule`, `waiver of ${w.rule}: no block, scene or rule pack "${owner}" in the experience (8.5)`);
        return; // a shipped or pinned pack: its rules are not in these files
      }
      const rule = (holder.doc ? holder.doc.rules : holder.rules || [])?.find?.(x => x.id === ruleId);
      if (!rule) { rep('E-REF-UNKNOWN', `${p}/rule`, `waiver of ${w.rule}: ${owner} has no rule "${ruleId}" (8.5)`); return; }
      if (!Array.isArray(rule.waivableBy) || rule.waivableBy.length === 0) rep('E-RIGHTS', `${p}/rule`, `waiver of ${w.rule}: the rule has no waivableBy, so it cannot be waived (8.5)`);
      else if (!rule.waivableBy.includes(w.by)) rep('E-RIGHTS', `${p}/by`, `waiver of ${w.rule}: "${w.by}" is not in the rule's waivableBy ${JSON.stringify(rule.waivableBy)} (8.5)`);
    });
  }

  // ----- 8.6: combine the rules that reach one subject; report what cannot hold together -----
  const ancestors = (d) => docs.filter(x => x !== d && inside(x).includes(d));
  const seenConflict = new Set();
  for (const d of docs) {
    const applicable = [d, ...ancestors(d)];
    const groups = new Map();
    for (const x of applicable) {
      (Array.isArray(x.doc.rules) ? x.doc.rules : []).forEach((r, i) => {
        if (!r || typeof r !== 'object') return;
        const subj = addresses(r.subject).slice().sort().join(',');
        const key = `${r.kind}|${r.strength || 'must'}|${subj}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ doc: x, rule: r, path: `/rules/${i}` });
      });
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      for (const c of combine(list.map(x => x.rule))) {
        // every rule that applies must hold; a conflict fails both, each report naming the other (8.6)
        const [a, b] = [list[c.a], list[c.b]];
        const id = [`${a.doc.file}${a.path}`, `${b.doc.file}${b.path}`].sort().join('|'); // one pair of reports per pair of rules
        if (seenConflict.has(id)) continue;
        seenConflict.add(id);
        for (const [x, y] of [[a, b], [b, a]]) report('E-RULE-CONFLICT', x.doc.file, x.path, `rule ${x.rule.id} cannot hold with ${y.rule.id} (${y.doc.file}${y.path}): ${c.what}; both fail (8.6)`);
      }
    }
  }
}
