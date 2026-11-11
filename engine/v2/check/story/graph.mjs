// The story graph rules (section 3): start, links, outcomes, choices, visits and returns, chapters, graph validity.
import { parseXml } from '../../schema/xml.mjs';
import { walk, isObj, entryTargets, chapterEdges, linkKind, ID } from './model.mjs';
import { FORMAT } from '../../src/limits.mjs';
import { endsOf } from '../../src/ends.mjs';
import { addonEventKnown } from '../builtins.mjs';
import { declaredWidgets } from '../../src/widgets-of.mjs';
import { boxOf } from '../../src/marks.mjs';

const MAX_VISIT_CHAIN = FORMAT.visitStack;

export function checkGraph(ctx, m) {
  // A host may let the experience raise how many choice links a scene has (9.8.1).
  const MAX_CHOICES = ctx.experience.limits?.choiceLinksPerScene ?? FORMAT.choiceLinksPerScene;
  const R = ctx.report;
  const F = m.file;
  // One cause, one finding (F0b): a missing link makes dead ends, unreachable scenes and scenes with no ending; these
  // are held and folded at the end into the finding of their cause.
  const held = [];
  const FOLD = new Set(['E-STORY-DEAD-END', 'E-STORY-UNREACHABLE', 'E-STORY-NO-END']);
  const rep = (code, path, msg) => (FOLD.has(code) ? held.push({ code, path, msg }) : R(code, F, path, msg));
  const shellEdgesOnly = (l) => m.shellId && l.from === m.shellId && !m.sceneSet.has(l.from);

  // ---------- what a scene or the shell shows to the graph ----------
  const infoCache = new Map();
  const info = (id) => {
    if (infoCache.has(id)) return infoCache.get(id);
    let doc = null;
    if (m.sceneSet.has(id)) doc = m.scene(id)?.doc || null;
    else if (m.shellId && id === m.shellId) doc = m.shellDoc;
    let r = { known: false, events: new Set(), emitted: new Set(), inputs: {} };
    if (doc) {
      const events = Object.entries(isObj(doc.outputs) ? doc.outputs : {}).filter(([, v]) => v && v.kind === 'event').map(([k]) => k);
      const emitted = new Set();
      walk(doc, (n) => {
        if (!isObj(n)) return;
        for (const k of ['emit', 'event', 'missEvent']) if (typeof n[k] === 'string' && !(k === 'emit' && (n.as ?? 'event') !== 'event')) emitted.add(n[k]);
      });
      r = { known: true, events: new Set(events), emitted, inputs: isObj(doc.inputs) ? doc.inputs : {} };
    }
    infoCache.set(id, r);
    return r;
  };
  const isNode = (id) => m.sceneSet.has(id) || (m.shellId && id === m.shellId);

  // 3.3: what an `on` name can be. Returns null when fine, else {code, message}.
  const resolveOn = (name, from) => {
    if (typeof name !== 'string') return null;
    if (name.startsWith('signal:')) return null; // the core signals (signal:self:<hook>) are the grants check's (10.5)
    // A link may hear an add-on's event of its from scene (D31.5): <addon>:<event> or <addon>:<event>:<subject>.
    const heard = addonEventKnown(ctx.experience, name);
    if (heard === true) return null;
    if (heard === false) return { code: 'E-REF-UNKNOWN', message: `${name} is not an event its add-on gives: its manifest lists its events` };
    const isTrigger = m.triggers.has(name);
    if (name.startsWith('shell.') && !isTrigger) {
      if (m.shellId && from === m.shellId && !m.sceneSet.has(from)) return { code: 'E-REF-UNKNOWN', message: `${name}: the shell's own links name its events without "shell."` };
      if (!m.hasShell) return { code: 'E-REF-UNKNOWN', message: `${name}: the experience has no shell` };
      if (!m.shellDoc) return null;
      const ev = name.slice(6);
      const si = info(m.shellId);
      if (!si.events.has(ev)) return { code: 'E-REF-UNKNOWN', message: `${name}: the shell declares no output event ${ev}` };
      if (!si.emitted.has(ev)) return { code: 'E-REF-UNKNOWN', message: `${name}: nothing in the shell emits ${ev}` };
      return null;
    }
    const i = info(from);
    if (!i.known) return null; // a kit definition or a missing file: the loader or the refs check speaks
    const isOut = i.events.has(name);
    if (isOut && isTrigger) return { code: 'E-NAME-SHADOW', message: `${name} is both an output event of ${from} and an experience trigger` };
    if (isOut) return i.emitted.has(name) ? null : { code: 'E-REF-UNKNOWN', message: `${from} declares the output event ${name}, but no action or control emits it` };
    if (isTrigger) return null;
    // An event the scene sends (a control's event or an emit) is an output event of the scene when a link hears it
    // (D31.4): no outputs entry is needed. A component still declares its outputs; its parent hears them.
    if (i.emitted.has(name) && !name.includes(':')) return null;
    // Say how to fix it (R2 newcomer F4): a link hears only declared output events.
    const fix = `send it from ${from} with a control's "event" or an emit action ({"emit": "${name}"}), or declare ${name} as an experience trigger`;
    return { code: 'E-REF-UNKNOWN', message: `${name} is not an output event of ${from}, a trigger or a granted signal; ${fix} (3.3, 5.4)` };
  };

  // ---------- 3.1, 3.8: ids, start, ends, resumeAt ----------
  const startEntries = [];
  const start = m.story.start;
  const pushList = (list, path) => {
    if (typeof list === 'string') { startEntries.push({ to: list, path }); return; }
    if (!Array.isArray(list)) return;
    list.forEach((e, i) => { if (isObj(e)) startEntries.push({ to: e.to, path: `${path}[${i}]` }); });
    const last = list[list.length - 1];
    if (isObj(last) && last.when !== undefined) rep('E-STORY-FALLBACK', `${path}[${list.length - 1}]`, 'the last entry of a start list must have no when');
  };
  if (isObj(start)) for (const [slot, v] of Object.entries(start)) pushList(v, `story.start.${slot}`);
  else pushList(start, 'story.start');
  for (const e of startEntries) {
    if (typeof e.to !== 'string') continue;
    if (!m.sceneSet.has(e.to) && !m.isOrdered(e.to)) rep('E-REF-UNKNOWN', e.path, `start names ${e.to}, which is no scene or ordered chapter`);
  }
  for (const key of ['ends', 'resumeAt']) {
    (Array.isArray(m.story[key]) ? m.story[key] : []).forEach((id, i) => {
      if (!m.sceneSet.has(id)) rep('E-REF-UNKNOWN', `story.${key}[${i}]`, `${key} names ${id}, which is no scene`);
    });
  }

  // firstFocus names a control of its scene (3.7).
  for (const id of m.sceneIds) {
    const s = m.scene(id);
    const ff = s?.doc?.firstFocus;
    if (typeof ff === 'string' && !(isObj(s.doc.controls) && ff in s.doc.controls)) R('E-REF-UNKNOWN', s.file, 'firstFocus', `firstFocus names ${ff}, which is no control of ${id}; its controls are ${Object.keys(isObj(s.doc.controls) ? s.doc.controls : {}).join(', ') || 'none'}`);
  }
  // Scene ids, chapter ids and the shell id share one namespace (3.1, 3.12).
  const seenIds = new Map(m.sceneIds.map(id => [id, 'scene']));
  if (m.shellId && !seenIds.has(m.shellId)) seenIds.set(m.shellId, 'shell');
  else if (m.shellId) rep('E-ID-DUPLICATE', 'shell', `the shell id ${m.shellId} is also a scene id`);
  m.chapters.forEach((c, i) => {
    if (!c || typeof c.id !== 'string') return;
    if (seenIds.has(c.id)) rep('E-ID-DUPLICATE', `story.chapters[${i}].id`, `chapter id ${c.id} is already a ${seenIds.get(c.id)} id`);
    else seenIds.set(c.id, 'chapter');
  });
  const linkIds = new Set();
  for (const l of m.links) {
    // An id is optional on a link (D29, D31), except where something outside the list names it (P1 "Optional ids").
    if (l.id === undefined && l.choice !== undefined) rep('E-KEY-REQUIRED', l._path, `this link needs an id because it is a choice: a seat or the host picks it by its id (3.5)`);
    else if (l.id === undefined && l.max !== undefined) rep('E-KEY-REQUIRED', l._path, `this link needs an id because it has max: its count is saved by its id, and a position would shift when links move (3.6)`);
    if (typeof l.id !== 'string') continue;
    if (linkIds.has(l.id)) rep('E-ID-DUPLICATE', `${l._path}.id`, `link id ${l.id} is used twice`);
    linkIds.add(l.id);
  }

  // ---------- 3.2: links ----------
  for (const l of m.links) {
    if (typeof l.from === 'string' && !isNode(l.from)) rep('E-REF-UNKNOWN', `${l._path}.from`, `from names ${l.from}, which is no scene or the shell`);
    if (typeof l.to === 'string' && !m.sceneSet.has(l.to) && !m.isOrdered(l.to)) rep('E-REF-UNKNOWN', `${l._path}.to`, `to names ${l.to}, which is no scene or ordered chapter`);
    if (typeof l.on === 'string' && isNode(l.from)) {
      const bad = resolveOn(l.on, l.from);
      if (bad) rep(bad.code, `${l._path}.on`, bad.message);
    }
    // carry: names are inputs of the destination (the text gives no code of its own; E-REF-UNKNOWN is the general one)
    if (isObj(l.carry) && typeof l.to === 'string' && m.sceneSet.has(l.to)) {
      const di = info(l.to);
      if (di.known) for (const k of Object.keys(l.carry)) {
        const head = k.split('.')[0];
        if (!(head in di.inputs)) rep('E-REF-UNKNOWN', `${l._path}.carry.${k}`, `carry names ${k}, which is no input of ${l.to}: a carry gives a value to an input of the scene it enters. To keep a value across scenes (a score), declare it in the experience's values instead; every scene reads and writes it`);
      }
    }
  }

  // Fallback: among links sharing one from and one on, the last has no when and no max.
  const chapEdges = chapterEdges(m);
  const groups = new Map();
  m.links.forEach(l => {
    if (l.on === undefined || typeof l.from !== 'string') return;
    const key = `${l.from}\u0000${l.on}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  });
  for (const list of groups.values()) {
    const last = list[list.length - 1];
    // Built chapter links come after the experience's own links and have no when and no max.
    const chapterFollows = chapEdges.some(e => e.from === last.from && e.on === last.on);
    if (!chapterFollows && (last.when !== undefined || last.max !== undefined)) {
      rep('E-STORY-FALLBACK', last._path, `the last link from ${last.from} on ${last.on} must have no when and no max`);
    }
  }

  // ---------- 3.5: choice links ----------
  const choiceByScene = new Map();
  for (const l of m.links) if (l.choice !== undefined && m.sceneSet.has(l.from)) {
    if (!choiceByScene.has(l.from)) choiceByScene.set(l.from, []);
    choiceByScene.get(l.from).push(l);
  }
  for (const [sid, list] of choiceByScene) {
    const s = m.scene(sid);
    if (list.length > MAX_CHOICES) rep('E-RANGE', list[MAX_CHOICES]._path, `${sid} has ${list.length} choice links; at most ${MAX_CHOICES}`);
    // A choice is shown by the shell's choices widget (choiceRegion and choicesAtMs are a 2.1 draft, D31).
    if (s?.doc) {
      const shellChoices = m.shellDoc ? declaredWidgets(m.shellDoc).some(u => u.declared === 'choices') : m.hasShell;
      if (!shellChoices) rep('E-STORY-CHOICE-PLACE', list[0]._path, `${sid} has choice links but the shell has no choices widget to show them`);
    }
    const fromS = m.links.filter(l => l.from === sid);
    const hasWayOn = fromS.some(l => (l.choice !== undefined && l.when === undefined && l.max === undefined) || l.on !== undefined || l.afterMs !== undefined)
      || chapEdges.some(e => e.from === sid);
    if (!hasWayOn) rep('E-STORY-CHOICE-FALLBACK', list[0]._path, `${sid} has choice links but nothing to take when none is eligible`);
  }

  // ---------- 3.12: chapters ----------
  const inChapter = new Map();
  m.chapters.forEach((c, ci) => {
    if (!c) return;
    const base = `story.chapters[${ci}]`;
    (Array.isArray(c.scenes) ? c.scenes : []).forEach((s, si) => {
      const id = m.stepId(s);
      if (!m.sceneSet.has(id)) { rep('E-REF-UNKNOWN', `${base}.scenes[${si}]`, `chapter ${c.id} lists ${id}, which is no scene`); return; }
      if (inChapter.has(id)) rep('E-ID-DUPLICATE', `${base}.scenes[${si}]`, `scene ${id} is already in chapter ${inChapter.get(id)}`);
      else inChapter.set(id, c.id);
    });
    for (const f of ['after', 'before']) {
      if (typeof c[f] === 'string' && !m.sceneSet.has(c[f]) && !m.isOrdered(c[f])) rep('E-REF-UNKNOWN', `${base}.${f}`, `${f} names ${c[f]}, which is no scene or ordered chapter`);
    }
    for (const f of ['next', 'back']) {
      if (typeof c[f] !== 'string') continue;
      const bad = (c.scenes || []).map(s => m.stepId(s)).filter(id => m.sceneSet.has(id)).map(id => ({ id, r: resolveOn(c[f], id) })).find(x => x.r);
      if (bad) rep(bad.r.code, `${base}.${f}`, `step ${bad.id}: ${bad.r.message}`);
    }
  });

  // ---------- the graph (3.7, 3.9) ----------
  const callers = (x) => {
    const out = new Set();
    for (const l of m.links) if (l.visit && !l.return && m.sceneSet.has(l.from) && typeof l.to === 'string' && entryTargets(m, l.to).includes(x)) out.add(l.from);
    return [...out];
  };
  const edges = [];
  for (const l of m.links) {
    if (!isNode(l.from)) continue;
    const tos = l.return ? callers(l.from) : (typeof l.to === 'string' ? entryTargets(m, l.to) : []);
    for (const t of tos) edges.push({ from: l.from, to: t, kind: linkKind(l), max: l.max !== undefined, visit: !!l.visit && !l.return, ret: !!l.return, link: l });
  }
  for (const e of chapEdges) for (const t of e.tos) edges.push({ from: e.from, to: t, kind: 'on', max: false, visit: false, ret: false, link: null });
  const shellEdges = edges.filter(e => !m.sceneSet.has(e.from));
  const sceneEdges = edges.filter(e => m.sceneSet.has(e.from));

  // 3.7: a return link needs a way back.
  const entryWithoutLink = new Set();
  for (const e of startEntries) if (typeof e.to === 'string') entryTargets(m, e.to).forEach(x => entryWithoutLink.add(x));
  (Array.isArray(m.story.resumeAt) ? m.story.resumeAt : []).forEach(x => entryWithoutLink.add(x));
  for (const l of m.links) {
    if (!l.return || !m.sceneSet.has(l.from)) continue;
    const x = l.from;
    const inbound = m.links.filter(k => !k.return && typeof k.to === 'string' && entryTargets(m, k.to).includes(x));
    const chapterIn = chapEdges.some(e => e.tos.includes(x));
    const allVisits = !entryWithoutLink.has(x) && !chapterIn && inbound.length > 0 && inbound.every(k => k.visit);
    if (allVisits) continue;
    const sameTrigger = (k) => (l.on !== undefined ? k.on === l.on : linkKind(k) === linkKind(l));
    const fallback = m.links.some(k => k !== l && k.from === x && !k.return && sameTrigger(k) && k.when === undefined && k.max === undefined);
    if (!fallback) rep('E-STORY-RETURN', l._path, `the return link from ${x} has no fallback link from the same scene and event, and not every way into ${x} is a visit`);
  }

  // Visit cycles and chains.
  const visitAdj = new Map();
  for (const e of sceneEdges) if (e.visit) { if (!visitAdj.has(e.from)) visitAdj.set(e.from, []); visitAdj.get(e.from).push(e); }
  const cycle = findCycle(m.sceneIds, visitAdj);
  if (cycle) rep('E-STORY-VISIT-CYCLE', cycle.link._path, `visit links make a cycle through ${cycle.link.from}`);
  else {
    const memo = new Map();
    const depth = (n) => {
      if (memo.has(n)) return memo.get(n);
      let best = 0;
      for (const e of visitAdj.get(n) || []) best = Math.max(best, 1 + depth(e.to));
      memo.set(n, best);
      return best;
    };
    let worst = null;
    for (const id of m.sceneIds) { const d = depth(id); if (d > MAX_VISIT_CHAIN && (!worst || d > worst.d)) worst = { d, id }; }
    if (worst) rep('E-STORY-VISIT-CYCLE', `story.scenes.${worst.id}`, `a chain of ${worst.d} visit links starts at ${worst.id}; at most ${MAX_VISIT_CHAIN}`);
  }

  // 3.9: reachable, dead ends, endings, bounded timed loops.
  // ends is optional (D31.4): without it, every scene with no way out is an ending (src/ends.mjs).
  const declaredEnds = Array.isArray(m.story.ends);
  const ends = new Set(endsOf({ ...m.story, scenes: Object.fromEntries(m.sceneIds.map(id => [id, true])) }, [...m.links, ...chapEdges], m.shellId));
  const adj = new Map();
  for (const e of sceneEdges) { if (!adj.has(e.from)) adj.set(e.from, []); adj.get(e.from).push(e.to); }
  const seen = new Set();
  const queue = [...entryWithoutLinkStart(m, startEntries), ...shellEdges.map(e => e.to)];
  while (queue.length) {
    const n = queue.pop();
    if (seen.has(n) || !m.sceneSet.has(n)) continue;
    seen.add(n);
    queue.push(...(adj.get(n) || []));
  }
  for (const id of m.sceneIds) {
    if (!seen.has(id)) rep('E-STORY-UNREACHABLE', `story.scenes.${id}`, `no start entry reaches ${id} through links`);
  }
  const shellLinkCount = m.links.filter(shellEdgesOnly).length;
  for (const id of m.sceneIds) {
    const out = m.links.some(l => l.from === id) || chapEdges.some(e => e.from === id) || shellLinkCount > 0;
    if (!out && !ends.has(id) && !m.story.endless) rep('E-STORY-DEAD-END', `story.scenes.${id}`, `${id} has no outgoing link and is not in ends; add a link from ${id}, or add ${id} to story.ends (or leave ends out: then every scene with no way out is an ending)`);
    // An inferred ending that sends an event nothing hears is likely a missing link (D31.4).
    if (!out && !declaredEnds && !m.story.endless) {
      const doc = m.scene(id)?.doc;
      const heardHere = new Set(Object.keys(isObj(doc?.on) ? doc.on : {}));
      walk(doc || {}, (n) => { if (isObj(n) && isObj(n.on)) for (const k of Object.keys(n.on)) heardHere.add(k); });
      const lost = [...info(id).emitted].filter(e => !e.includes(':') && !heardHere.has(e) && !m.triggers.has(e)).sort();
      if (lost.length) rep('W-STORY-UNHEARD', `story.scenes.${id}`, `${id} has no way out, so it is an ending, but it sends ${lost.join(', ')}, which no link hears; add a link {"from": "${id}", "on": "${lost[0]}", "to": "<scene>"} if it should go on`);
    }
  }
  if (!m.story.endless) {
    if (ends.size === 0) rep('E-STORY-NO-END', 'story.ends', declaredEnds ? 'ends is empty and the story is not endless' : 'every scene has a way out, so no scene is an ending: list the endings in story.ends, or mark the story endless');
    else {
      // Scenes from which an ending is reachable through links without max.
      const good = new Set(ends);
      let changed = true;
      const free = edges.filter(e => !e.max);
      while (changed) {
        changed = false;
        for (const e of free) {
          if (!good.has(e.to)) continue;
          if (m.sceneSet.has(e.from)) { if (!good.has(e.from)) { good.add(e.from); changed = true; } }
          else for (const id of m.sceneIds) if (!good.has(id)) { good.add(id); changed = true; } // a shell link leaves every scene
        }
      }
      for (const id of m.sceneIds) if (!good.has(id)) rep('E-STORY-NO-END', `story.scenes.${id}`, `no ending is reachable from ${id} through links without max`);
    }
  }
  const timedAdj = new Map();
  for (const e of sceneEdges) if (e.kind === 'timed' && !e.max) { if (!timedAdj.has(e.from)) timedAdj.set(e.from, []); timedAdj.get(e.from).push(e); }
  const loop = findCycle(m.sceneIds, timedAdj);
  if (loop) rep('E-STORY-LOOP', loop.link._path, `a cycle of timed links through ${loop.link.from} has no link with max`);

  // 3.2 carry: an input without initial must be carried; a scene entered without a link gives every input an initial.
  const required = (id) => {
    const i = info(id);
    const withKeys = new Set(Object.keys(isObj(m.scene(id)?.use?.with) ? m.scene(id).use.with : {}));
    return Object.entries(i.inputs).filter(([k, v]) => isObj(v) && v.kind !== 'trigger' && v.initial === undefined && !v.live && !withKeys.has(k)).map(([k]) => k);
  };
  const noLink = new Set(entryWithoutLink);
  for (const e of chapEdges) { noLink.add(e.from); }
  m.chapters.forEach(c => { if (c && c.next) (c.scenes || []).forEach(s => noLink.add(m.stepId(s))); });
  for (const id of noLink) {
    const s = m.sceneSet.has(id) ? m.scene(id) : null;
    if (!s || !info(id).known) continue;
    for (const k of required(id)) R('E-KEY-REQUIRED', s.file, `inputs.${k}`, `${id} can be entered without a link, so input ${k} needs an initial`);
  }
  for (const l of m.links) {
    if (l.return || typeof l.to !== 'string' || !m.sceneSet.has(l.to) || !info(l.to).known) continue;
    const carried = new Set(Object.keys(isObj(l.carry) ? l.carry : {}).map(k => k.split('.')[0]));
    for (const k of required(l.to)) if (!carried.has(k)) rep('E-KEY-REQUIRED', l._path, `the link into ${l.to} must carry input ${k}, which has no initial`);
  }

  // 3.3: an exit action list may not emit an outcome.
  const exitDocs = [...Object.values(m.exp.scenes || {}), ...(m.exp.shell ? [m.exp.shell] : [])];
  for (const d of exitDocs) {
    const outs = new Set(Object.entries(isObj(d.doc.outputs) ? d.doc.outputs : {}).filter(([, v]) => v && v.kind === 'event').map(([k]) => k));
    if (!outs.size) continue;
    walk(d.doc, (n, path) => {
      if (!isObj(n) || !Array.isArray(n.exit)) return;
      walk(n.exit, (a, p) => {
        if (isObj(a) && typeof a.emit === 'string' && (a.as ?? 'event') === 'event' && outs.has(a.emit)) R('E-NAVIGATION', d.file, [...path, 'exit', ...p].map((k, i) => (typeof k === 'number' ? `[${k}]` : (i ? '.' : '') + k)).join(''), `an exit action emits the outcome ${a.emit}`);
      });
    });
  }
  foldStory(held, (code, path, msg) => R(code, F, path, msg), m.links.length === 0);
}

// The story findings of one cause, folded (F0b): every dead end is reported (each is a missing link), and the scenes
// that cannot be reached, and those from which no ending is reachable, are said once, in the first dead end's message.
// Without dead ends, the unreachable scenes are one finding and the scenes with no ending another.
export function foldStory(held, report, noLinks = false) {
  const of = (code) => held.filter(h => h.code === code);
  const names = (list) => list.map(h => h.path.replace(/^story\.scenes\./, ''));
  const dead = of('E-STORY-DEAD-END'); const lost = of('E-STORY-UNREACHABLE'); const stuck = of('E-STORY-NO-END');
  const whole = stuck.find(h => h.path === 'story.ends');
  const scenesStuck = stuck.filter(h => h !== whole);
  if (dead.length) {
    const then = [];
    if (lost.length) then.push(`${names(lost).join(', ')} ${lost.length === 1 ? 'is' : 'are'} never reached`);
    if (scenesStuck.length) then.push(`no ending is reachable from ${names(scenesStuck).join(', ')}`);
    dead.forEach((h, i) => {
      const fold = i === 0 && then.length ? `; so ${then.join(', and ')}` : '';
      const lead = i === 0 && noLinks ? 'the story has no links: ' : '';
      report(h.code, h.path, `${lead}${h.msg}${fold}. A link goes from a scene on an event to the next: {"from": "${names([h])[0]}", "on": "<event>", "to": "<scene>"} in story.links (3.2)`);
    });
    if (whole) report(whole.code, whole.path, whole.msg);
    return;
  }
  if (lost.length) report('E-STORY-UNREACHABLE', lost[0].path, lost.length === 1 ? lost[0].msg : `no start entry reaches ${names(lost).join(', ')} through links`);
  if (whole) report(whole.code, whole.path, whole.msg);
  if (scenesStuck.length) report('E-STORY-NO-END', scenesStuck[0].path, scenesStuck.length === 1 ? scenesStuck[0].msg : `no ending is reachable from ${names(scenesStuck).join(', ')} through links without max`);
}

// Scenes the start entries enter.
function entryWithoutLinkStart(m, startEntries) {
  const out = [];
  for (const e of startEntries) if (typeof e.to === 'string') out.push(...entryTargets(m, e.to));
  return out;
}

// A depth-first search for one cycle. adj: node -> [edge {to, link}]. Returns the closing edge or null.
function findCycle(nodes, adj) {
  const state = new Map(); // 1 on the stack, 2 done
  let found = null;
  const dfs = (n) => {
    state.set(n, 1);
    for (const e of adj.get(n) || []) {
      if (found) return;
      const s = state.get(e.to);
      if (s === 1) { found = e; return; }
      if (!s) dfs(e.to);
    }
    state.set(n, 2);
  };
  for (const n of nodes) { if (found) break; if (!state.get(n)) dfs(n); }
  return found;
}

// The number of option slots (direct children with data-hsvg-slot) of the repeat region with this id, or null.
export function repeatSlots(text, regionId) {
  let root;
  try { root = parseXml(text); } catch { return null; }
  let result = null;
  const visit = (el) => {
    if (!el || !el.attrs) return;
    if (el.attrs.id === regionId && boxOf(el.attrs) === 'repeat') {
      result = (el.children || []).filter(c => c.attrs && c.attrs['data-hsvg-slot'] !== undefined).length;
      return;
    }
    for (const c of el.children || []) visit(c);
  };
  visit(root);
  return result;
}

export { ID };
