// Stage 3: the story (section 3). Start, links on events, timed links, choice links, bounded counts, visits and
// returns, resume and endings, and chapters. One stage slot ("stage"); split screen is a 2.1 draft (spec/2.0/drafts/structure-2.1.md).
import { Engine, EngineFault, OFF } from './runtime.mjs';
import { FORMAT } from './limits.mjs';
import { endsOf } from './ends.mjs';
export { endsOf };

const fault = (code, msg, addr) => { throw new EngineFault(code, msg, addr); };

export class Player extends Engine {
  constructor(experience, opts = {}) {
    super(experience, opts);
    const story = experience.doc.story || {};
    this.story = story;
    // A link without an id is keyed by its place in the list (D29): links[2]. Choice links and links with max have ids.
    this.links = [...(story.links || []).map((l, i) => (l.id === undefined ? { ...l, id: `links[${i}]` } : l)), ...this.chapterLinks(story.chapters || [])];
    this.shellId = experience.shell?.doc?.id || null;
    this.ends = endsOf(story, this.links, this.shellId);
    this.resetStory();
    this.onOutcome = (scene, name, payload) => this.outcome(scene, name, payload);
    this.onTimedLink = (t) => this.timedLink(t);
    this.outputsLog = [];
    this.on(({ outputs }) => { for (const o of outputs) this.outputsLog.push(o); });
  }

  // The story's state for a fresh run; the graph's memory survives with its lifetime (3.8), and a resume scene that
  // is no longer a scene is ignored.
  resetStory() {
    this.state.story = { current: null, stack: [], counts: {}, visits: {}, resume: null, painted: {}, held: [], endedReported: {} };
    const g = this.stored.graph(this.story.lifetime);
    if (g) {
      const counts = (o) => (o && typeof o === 'object' && !Array.isArray(o) && Object.values(o).every(n => Number.isInteger(n) && n >= 0) ? o : {});
      this.state.story.counts = counts(g.counts);
      this.state.story.visits = counts(g.visits);
      this.state.story.resume = typeof g.resume === 'string' && this.exp.scenes[g.resume] ? g.resume : null;
      this.caps.restoreKept(this.state.blocks.experience, g.capabilities); // a capability's run state (the seats' turn)
    }
  }
  // A new run (10.6): run values reset, stored values and the graph's memory read again, the start (or resume) entered.
  // Inputs keep their values (the host's content and the person's knobs).
  restart() {
    const inputs = structuredClone(this.state.blocks.experience.inputs);
    this.resetEngine();
    Object.assign(this.state.blocks.experience.inputs, inputs);
    this.resetStory();
    return this.start();
  }

  // Chapters (3.12): built links after the experience's own, resolved when they fire.
  chapterLinks(chapters) {
    const out = [];
    for (const c of chapters) {
      if (!c.next) continue;
      // The chapter's transition, its length and its slide side go onto every link it builds (3.12).
      const look = () => (c.transition ? { transition: c.transition, transitionMs: c.transitionMs, ...(c.slideFrom ? { slideFrom: c.slideFrom } : {}) } : {});
      c.scenes.forEach((s, i) => {
        const scene = typeof s === 'string' ? s : s.scene;
        out.push({ id: `${c.id}-next-${i + 1}`, from: scene, on: c.next, chapter: c.id, step: i, dir: 1, ...look() });
        if (c.back) out.push({ id: `${c.id}-back-${i + 1}`, from: scene, on: c.back, chapter: c.id, step: i, dir: -1, ...look() });
      });
    }
    return out;
  }
  chapter(id) { return (this.story.chapters || []).find(c => c.id === id); }
  presentStep(c, from, dir) {
    for (let i = from; i >= 0 && i < c.scenes.length; i += dir) {
      const s = c.scenes[i];
      if (typeof s === 'object' && s.skipWhen && this.eval('experience', s.skipWhen) === true) continue;
      return typeof s === 'string' ? s : s.scene;
    }
    return null;
  }
  // The chapter ambient input (3.12, 5.5): {id, index, count} of the chapter that holds the scene on the stage.
  // index counts from 0, as every index in a formula does (5.6). In an ordered chapter only present steps count: a
  // skipped step is left out of index and count. A scene in no chapter gives {id: '', index: 0, count: 0}.
  chapterNow() {
    const id = this.state.story?.current;
    const c = id && (this.story.chapters || []).find(x => x.scenes.some(s => (typeof s === 'string' ? s : s.scene) === id));
    if (!c) return super.chapterNow();
    const name = (s) => (typeof s === 'string' ? s : s.scene);
    const steps = c.next ? c.scenes.filter(s => name(s) === id || !(typeof s === 'object' && s.skipWhen && this.eval('experience', s.skipWhen) === true)) : c.scenes;
    return { id: c.id, index: steps.findIndex(s => name(s) === id), count: steps.length };
  }
  // changed:chapter (5.5) for every block when the chapter value differs after a scene is entered.
  noteChapter() {
    const now = this.chapterNow();
    const s = this.state.story;
    const differs = !!s.chapterSeen && (s.chapterSeen.id !== now.id || s.chapterSeen.index !== now.index || s.chapterSeen.count !== now.count);
    if (differs) this.queueAll('changed:chapter');
    s.chapterSeen = now;
    return differs;
  }
  // A skipWhen that turns true or false while a step is on the stage changes the count: after the queue is empty,
  // the chapter value is read again, and a change is heard as changed:chapter in the same transaction (5.5).
  drain() {
    super.drain();
    if (!this.story.chapters?.length || !this.state.story?.chapterSeen) return;
    // Each round drains the events a change caused; the event limit of 9.2 stops a loop of changes.
    while (this.noteChapter()) super.drain();
  }
  resolveTo(to) {
    const c = this.chapter(to);
    if (!c) return to;
    return this.presentStep(c, 0, 1) ?? this.resolveTo(c.after);
  }

  // ---------- start ----------
  start() {
    const r = this.transaction('host', () => {
      const s = this.state.story;
      let to = s.resume;
      if (!to) {
        const st = this.story.start;
        if (typeof st === 'string') to = st;
        else if (Array.isArray(st)) to = st.find(e => e.when === undefined || this.eval('experience', e.when) === true)?.to;
        else fault('E-STORY-FALLBACK', 'no start', 'experience');
      }
      // The shell mounts once, before the start scene, and stays (10.1).
      if (this.shellId && !this.state.blocks[this.shellId]) this.mount(this.shellId, 'shell', this.shellId);
      this.enter(this.resolveTo(to), '', {});
      for (const n of this.stored.takeNotices()) this.queueAll(n);
    });
    this.afterCommit();
    return r;
  }
  // ---------- pauses (3.10) ----------
  // Pause reasons add up: a dialog with pauses (10.1), and the host's reasons (host, hidden) given by setPause.
  pauseReasons() { return [...(this.openDialogs().some(d => d.pauses) ? ['dialog'] : []), ...(this.hostPauses || [])]; }
  // The stage keeps its own time while any reason holds.
  pausedStage() { return this.pauseReasons().length ? this.scene : null; }
  setPause(reason, on) {
    this.hostPauses = (this.hostPauses || []).filter(r => r !== reason).concat(on ? [reason] : []);
    this.updatePause();
  }
  // A block hears paused when the first reason that holds its clock starts and resumed when the last clears, with
  // {reason} (3.10, 5.12): the stage's reasons for the stage's scene and its components, and authored for a block
  // whose clock, or an owner's, is paused by its formula. A block mounted while held hears no paused.
  updatePause() {
    if (this.pausing || this.stopped || !this.state.story?.current) return;
    const stage = this.pauseReasons();
    const scene = this.scene;
    const st = this.clockStates();
    if (this.stopped) return;
    const was = this.state.story.heldBy || {};
    const now = {};
    for (const a of Object.keys(this.state.blocks)) {
      const r = [...(a === scene || a.startsWith(scene + '/') ? stage : []), ...(st?.get(a)?.authored ? ['authored'] : [])];
      if (r.length) now[a] = r;
    }
    const heard = new Map(); // "name reason" -> addresses
    for (const a of Object.keys(this.state.blocks)) {
      if (!(a in was) && !this.state.story.heldSeen?.[a]) continue; // mounted since: it hears the next change
      const w = was[a] || []; const n = now[a] || [];
      if (!!w.length === !!n.length) continue;
      const key = n.length ? `paused ${n[0]}` : `resumed ${w[w.length - 1]}`;
      if (!heard.has(key)) heard.set(key, []);
      heard.get(key).push(a);
    }
    const seen = Object.fromEntries(Object.keys(this.state.blocks).map(a => [a, true]));
    const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
    if (!heard.size) { if (!same(was, now)) this.state.story.heldBy = now; this.state.story.heldSeen = seen; this.state.story.pausedBy = stage; return; }
    this.pausing = true;
    let r;
    try {
      r = this.transaction('host', () => {
        this.state.story.pausedBy = stage;
        this.state.story.heldBy = now;
        this.state.story.heldSeen = seen;
        for (const [key, list] of heard) { const [name, reason] = key.split(' '); this.fanOut(list, name, { reason }); }
      });
    } finally { this.pausing = false; }
    // A faulting paused or resumed reaction is the author's, not the host's: it stops play once, never runs again.
    if (!r.ok) { this.stop(r.fault, 'pause'); return; }
    this.afterCommit();
  }
  graphMemory() {
    const s = this.state.story;
    if (!s) return null;
    const kept = this.caps.kept(this.state.blocks.experience);
    return { counts: s.counts, visits: s.visits, resume: s.resume, ...(Object.keys(kept).length ? { capabilities: kept } : {}) };
  }
  resetSaved(settings) {
    super.resetSaved(settings);
    const s = this.state.story;
    s.counts = {}; s.visits = {}; s.resume = null;
  }
  // player.clearStorage() (10.6): the partition's stored data goes; the host restarts the player.
  clearStorage() { this.stored.clear(); }
  get scene() { return this.state.story.current; }
  // The music wanted now (6.10): {sound, fadeMs, gain} or null. A scene's music wins over the shell's while that
  // scene is on the stage; a scene without music lets the shell's play. Components have no music. A scene music
  // whose whilePaused is pause also gives owner: the scene, so the mixer pauses it while the scene is paused. The
  // shell's music has no owner: it goes on while a scene is paused.
  music() {
    const id = this.scene;
    const scene = id && this.exp.scenes[id]?.doc.music;
    const shell = this.shellId && this.state.blocks[this.shellId] ? this.exp.shell?.doc?.music : null;
    const m = scene || shell;
    if (!m) return null;
    return { sound: m.sound, fadeMs: m.fadeMs ?? this.exp.doc.audio?.fadeMs ?? 400, gain: m.gain ?? 1, ...(scene && m.whilePaused === 'pause' ? { owner: id } : {}) };
  }

  // ---------- entering and leaving ----------
  enter(id, linkId, carry) {
    if (!this.exp.scenes[id]) fault('E-REF-UNKNOWN', `no scene ${id}`, 'experience');
    const s = this.state.story;
    this.mount(id, 'scene', id, null, carry);
    s.current = id;
    s.visits[id] = (s.visits[id] || 0) + 1;
    s.painted[id] = false;
    if ((this.story.resumeAt || []).includes(id)) s.resume = id;
    this.noteChapter();
    this.state.outputs.push({ name: 'entered', slot: 'stage', scene: id, link: linkId });
    // Timed links from this scene start on its local clock (3.4).
    let timed = 0;
    for (const l of this.links) {
      if (l.from !== id || l.afterMs === undefined) continue;
      const ms = this.linkEval(id, l.afterMs, {});
      if (typeof ms !== 'number' || ms < 1 || ms > 3600000) fault('E-RANGE', `afterMs ${ms} of ${l.id} is outside 1..3600000`, id);
      this.state.timers.push({ ...this.personTimer(ms), seq: this.state.seq++, owner: id, link: l.id, late: true }); // timeLimits (10.13)
      timed++;
    }
    if (this.ends.includes(id)) {
      s.resume = null;
      if (!timed) this.reportEnded(id);
    }
  }
  reportEnded(id) { if (this.state.story.endedReported[id] !== this.state.story.visits[id]) { this.state.story.endedReported[id] = this.state.story.visits[id]; this.state.outputs.push({ name: 'ended', scene: id }); } }
  // Ends a block and its uses: machines exit in reverse declaration order, then the root exit (5.15.1).
  leave(address) {
    const doc = this.def(address);
    if (!doc) return;
    const b = this.state.blocks[address];
    for (const u of [...b.uses].reverse()) {
      if (u.keys) for (const k of [...u.keys].reverse()) this.leave(`${address}/${u.id}[${k}]`);
      else this.leave(`${address}/${u.id}`);
    }
    for (const mid of Object.keys(doc.machines || {}).reverse()) if (b.machines[mid]) this.exitTo(address, mid, 0);
    this.runActions(address, doc.exit, 'exit');
    this.unmount(address);
    this.queue = this.queue.filter(e => !(e.address === address || e.address.startsWith(address + '/')));
  }

  // ---------- links ----------
  linkEval(sceneId, f, payload, decl) {
    // when and carry read: the event payload, the from scene's interface, the experience's values, the ambient inputs.
    const scene = this.state.blocks[sceneId];
    const doc = this.def(sceneId);
    const results = {};
    for (const [k, o] of Object.entries(doc?.outputs || {})) if (o.kind === 'result') Object.defineProperty(results, k, { enumerable: true, get: () => this.eval(sceneId, o.value) });
    return this.slot('experience', decl, f, { event: payload, ...(scene?.inputs || {}), ...results });
  }
  eligible(l, payload) {
    const s = this.state.story;
    if (l.max !== undefined && (s.counts[l.id] || 0) >= l.max) return false;
    if (l.return && !s.stack.length) return false;
    if (l.when !== undefined && this.linkEval(l.from, l.when, payload) !== true) return false;
    return true;
  }
  // Does a story link from this scene hear the event (D31.4: then it needs no outputs entry)?
  linkHears(scene, name) { return this.links.some(l => l.from === scene && l.on === name); }
  outcome(scene, name, payload) {
    const s = this.state.story;
    // The scene on the stage reports outcomes; so does the shell, whose links replace the stage's scene (10.1).
    const fromShell = scene === this.shellId;
    if (scene !== s.current && !fromShell) return;
    const link = this.links.find(l => l.from === scene && l.on === name && l.afterMs === undefined && l.choice === undefined && this.eligible(l, payload));
    if (!link) return;
    if (!fromShell && !s.painted[scene]) { s.held.push({ scene, name, payload }); return; } // a scene is always shown (3.2)
    this.fireLink(link, payload);
  }
  fireLink(l, payload) {
    const s = this.state.story;
    const from = s.current;
    const carry = {};
    // A carry into a text input reads plain words as text (D31.1).
    for (const [k, f] of Object.entries(l.carry || {})) carry[k] = this.linkEval(from, f, payload, this.exp.scenes[l.to]?.doc?.inputs?.[k]);
    s.counts[l.id] = (s.counts[l.id] || 0) + 1;
    if (l.return) {
      const caller = s.stack.pop();
      this.leave(from);
      s.current = caller.scene;
      // The caller's local clock stood still while it was suspended (3.7): its elapsed, clips, lines and capability
      // runs move on by the visit's length (holdTime, as a pause does), and its timers come back with their remaining time.
      if (caller.suspendedAt !== undefined) this.holdTime(caller.scene, this.state.now - caller.suspendedAt);
      for (const t of caller.timers) { const { remaining, ...rest } = t; this.state.timers.push({ ...rest, due: t.scale === 0 ? OFF : this.state.now + remaining, seq: this.state.seq++ }); } // an off timer stays off (timeLimits 0)
      this.state.outputs.push({ name: 'entered', slot: 'stage', scene: caller.scene, link: l.id });
      this.queue.push({ address: caller.scene, name: 'returned', payload: { scene: from } });
      this.noteChapter();
      return;
    }
    let to = l.to;
    if (l.chapter) {
      const c = this.chapter(l.chapter);
      const next = this.presentStep(c, l.step + l.dir, l.dir);
      to = next ?? (l.dir > 0 ? c.after : c.before);
      if (!to) return;
    }
    to = this.resolveTo(to);
    if (l.visit) {
      if (s.stack.length >= FORMAT.visitStack) fault('E-RETURN', `the visit stack would hold ${FORMAT.visitStack + 1} scenes`, from);
      const mine = (t) => t.owner === from || t.owner.startsWith(from + '/');
      const timers = this.state.timers.filter(mine).map(t => ({ ...t, remaining: t.scale === 0 ? 0 : t.due - this.state.now }));
      this.state.timers = this.state.timers.filter(t => !mine(t));
      s.stack.push({ scene: from, timers, suspendedAt: this.state.now });
    } else {
      this.leave(from);
      while (s.stack.length) this.leave(s.stack.pop().scene);
    }
    this.enter(to, l.id, carry);
  }
  timedLink(t) {
    const s = this.state.story;
    const l = this.links.find(x => x.id === t.link);
    if (!l || s.current !== t.owner) return;
    if (this.eligible(l, {})) this.fireLink(l, {});
    if (this.ends.includes(t.owner) && !this.state.timers.some(x => x.owner === t.owner && x.link)) this.reportEnded(t.owner);
  }

  // ---------- choices (3.5) ----------
  choices() {
    const s = this.state.story;
    return this.links.filter(l => l.from === s.current && l.choice !== undefined && this.eligible(l, {})).map(l => ({ id: l.id, label: this.template(s.current, l.choice) }));
  }
  pick(linkId) {
    const r = this.transaction('person', () => {
      const l = this.links.find(x => x.id === linkId && x.choice !== undefined && x.from === this.state.story.current);
      if (!l || !this.eligible(l, {})) fault('E-STORY-CHOICE-PLACE', `${linkId} is not an eligible choice`, this.state.story.current);
      this.fireLink(l, {});
    });
    this.afterCommit();
    return r;
  }

  // ---------- after each commit: the first paint, then held outcomes (3.2) ----------
  afterCommit() {
    if (this.stopped) return { ok: false, fault: this.stopped, stopped: true };
    const s = this.state.story;
    if (s.current && !s.painted[s.current]) s.painted[s.current] = true;
    while (s.held.length) {
      const h = s.held.shift();
      const r = this.transaction('link', () => this.outcome(h.scene, h.name, h.payload));
      if (s.current && !s.painted[s.current]) s.painted[s.current] = true;
      if (!r.ok) return r;
    }
    this.updatePause();
    return null;
  }
  send(address, name, payload = {}, source = 'person') { const r = super.send(address, name, payload, source); this.afterCommit(); return r; }
  // Timed links run after other deadlines at the same engine time (3.10); the clock loop is the engine's.
  timerOrder(a, b) { return a.due - b.due || (a.late ? 1 : 0) - (b.late ? 1 : 0) || a.seq - b.seq; }
}
