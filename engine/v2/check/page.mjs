// The page capability's checks (A3.1, 10.5), on files. Its words are on the door (D31): the settings are addons.page of
// the experience, the page actions are the calls page.point, page.highlight, page.scroll, page.focus and page.invoke
// with {hook}, and the signals are heard as page:<signal>. Needs are checked by story/needs.mjs (E-NEEDS-MISSING).
// This family checks:
// - the settings: `dock` is reserved and cannot name a hook (E-NAME-RESERVED); a hook name is a kebab-case word, as
//   a page mark writes it (E-NAME-SHAPE); floor, anchorX, edgeMarginPx, bodyClearancePx and priority belong to
//   spots only (E-KEY-CONFLICT); spots and surfaces need `feet` (E-KEY-REQUIRED);
// - page calls: a quoted hook is declared in addons.page.hooks and has the kind the call needs (target for point,
//   highlight, scroll and focus; control for invoke), else E-REF-UNKNOWN; 'input:<name>' names a hook input of the
//   block (E-REF-UNKNOWN), and its initial value is checked against the grants (E-GRANT);
// - signals: page:<kind>:<hook> names a known kind and a declared target hook; the plain kinds take no hook
//   (E-REF-UNKNOWN), in `on` keys, links and the signals grant;
// - grants (10.5, 5.15.2): a signal heard, and a page call with a quoted hook, are asked for in grants (E-GRANT).
//   Scenes and the shell have the experience's grants; a block has only what each use of it passes down.
// checkHostPage(html, experienceDoc) checks a host page: bad marks (E-HOOK-MARK, by lintHooks in packages.mjs) and
// declared hooks that are not marked exactly once (W-HOOK-MISSING; obstacles may be marked any number of times).
import { walkBehaviour } from './refs/walk.mjs';
import { allDocs, walk, pathStr } from './story/model.mjs';
import { lintHooks } from './packages.mjs';
import { callFormula, quotedText } from './builtins.mjs';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v : []);
const HOOK_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const SPOT_ONLY = ['floor', 'anchorX', 'edgeMarginPx', 'bodyClearancePx', 'priority'];
export const ACTION_KIND = Object.freeze({ point: 'target', highlight: 'target', scroll: 'target', focus: 'target', invoke: 'control' });
const WITH_HOOK = ['visible', 'hidden', 'clicked', 'invalid'];
const PLAIN = ['scrollEnd', 'idle', 'exitIntent', 'scroll'];
// A hook named as words (with.hook is a text slot, D31.1; an old quoted literal reads the same): [source, name] or null.
const named = (f) => { const t = quotedText(f); return t === null ? null : [f, t]; };
// The hooks of an experience document: addons.page.hooks.
export const pageHooks = (doc) => (isObj(doc?.addons?.page?.hooks) ? doc.addons.page.hooks : {});
// The signal an event name hears (page:<signal>), or null; page:ended:<mark> is no signal.
export const signalOf = (ev) => (typeof ev === 'string' && ev.startsWith('page:') && !ev.startsWith('page:ended:') ? ev.slice(5) : null);
// The page call of an action: {op, ref} (ref: the formula with.hook stands for; null for words with {{ }} inside), or null.
export function pageCall(a) {
  if (!isObj(a) || typeof a.call !== 'string' || !a.call.startsWith('page.')) return null;
  const op = a.call.slice(5);
  return Object.hasOwn(ACTION_KIND, op) ? { op, ref: callFormula(null, a, 'hook') } : null;
}

// Why a signal name (after `page:`) is wrong, or null. hooks: the settings' hooks.
export function signalProblem(name, hooks) {
  const [kind, hook, ...rest] = String(name).split(':');
  if (rest.length) return `${name} has too many parts`;
  if (kind === 'self') return hook === 'visible' || hook === 'hidden' ? null : `self takes visible or hidden, not ${hook}`;
  if (PLAIN.includes(kind)) return hook === undefined ? null : `${kind} takes no hook`;
  if (!WITH_HOOK.includes(kind)) return `${kind} is not a page signal`;
  if (hook === undefined) return `${kind} needs a hook`;
  if (!isObj(hooks[hook])) return `${hook} is not a hook of addons.page`;
  if (hooks[hook].kind !== 'target') return `${hook} is a ${hooks[hook].kind} hook; ${kind} needs a target hook`;
  return null;
}

export function check(ctx) {
  const exp = ctx.experience;
  const doc = exp.doc;
  const file = exp.file || 'experience.json';
  const hooks = pageHooks(doc);
  const grants = isObj(doc.grants) ? doc.grants : {};

  // The settings.
  let needsFeet = false;
  for (const [name, h] of Object.entries(hooks)) {
    const p = `/addons/page/hooks/${name}`;
    if (name === 'dock') ctx.report('E-NAME-RESERVED', file, p, 'dock is reserved for the dock and cannot name a hook');
    else if (!HOOK_NAME.test(name)) ctx.report('E-NAME-SHAPE', file, p, `the hook name ${name} is not a kebab-case word, so no page mark can name it`);
    if (!isObj(h)) continue;
    if (h.kind !== 'spot') for (const k of SPOT_ONLY) if (h[k] !== undefined) ctx.report('E-KEY-CONFLICT', file, `${p}/${k}`, `${k} belongs to spot hooks; ${name} is a ${h.kind} hook`);
    if (h.kind === 'spot' || h.kind === 'surface') needsFeet = true;
  }
  if (needsFeet && doc.addons?.page?.feet === undefined) ctx.report('E-KEY-REQUIRED', file, '/addons/page', 'spots and surfaces need feet: the contact anchor in the actor\'s drawing');

  // The signals grant names real signals.
  list(grants.signals).forEach((s, i) => { const why = signalProblem(s, hooks); if (why) ctx.report('E-REF-UNKNOWN', file, `/grants/signals/${i}`, why); });
  // Links on signals.
  list(doc.story?.links).forEach((l, i) => {
    const sig = signalOf(l?.on);
    if (sig !== null) { const why = signalProblem(sig, hooks); if (why) ctx.report('E-REF-UNKNOWN', file, `/story/links/${i}/on`, why); }
  });

  for (const d of allDocs(exp)) {
    if (!isObj(d.doc)) continue;
    const inputs = isObj(d.doc.inputs) ? d.doc.inputs : {};
    walkBehaviour(d.doc, {
      onKey(ev, p) {
        const sig = signalOf(ev);
        if (sig === null) return;
        const why = signalProblem(sig, hooks);
        if (why) ctx.report('E-REF-UNKNOWN', d.file, p, why);
      },
      action(a, p) {
        const pc = pageCall(a);
        if (!pc || typeof pc.ref !== 'string') return;
        const { op } = pc; const kind = ACTION_KIND[op];
        const at = `${p}/with/hook`;
        let hook;
        const lit = named(pc.ref);
        if (lit && lit[1].startsWith('input:')) {
          const name = lit[1].slice(6);
          const decl = inputs[name];
          if (decl?.contentType !== 'hook') { ctx.report('E-REF-UNKNOWN', d.file, at, `${name} is not a hook input of ${d.id}`); return; }
          if (typeof decl.initial !== 'string') return;
          hook = decl.initial;
          // The value the input starts with is checked against the grants (5.15.2); the experience's grants apply
          // to scenes and the shell, and a block's uses are checked by the grants below.
          if (d.kind !== 'block' && (!list(grants.pageActions).includes(`${op}:${hook}`) || !(list(grants.hooks).includes(hook) || hook in hooks))) {
            ctx.report('E-GRANT', d.file, at, `the hook input ${name} starts as ${hook}, and ${op}:${hook} is not asked for in grants`);
          }
        } else if (lit) hook = lit[1];
        else return; // a formula: its hook is checked when the call runs
        if (!isObj(hooks[hook])) ctx.report('E-REF-UNKNOWN', d.file, at, `${hook} is not a hook of addons.page`);
        else if (hooks[hook].kind !== kind) ctx.report('E-REF-UNKNOWN', d.file, at, `${hook} is a ${hooks[hook].kind} hook; page.${op} needs a ${kind} hook`);
      },
    });
  }
  checkPageGrants(ctx, exp, hooks);
}

// Grants (10.5, 5.15.2): every signal heard and every page call with a quoted hook is asked for (E-GRANT).
function checkPageGrants(ctx, exp, hooks) {
  const docs = allDocs(exp);
  const expGrants = isObj(exp.doc.grants) ? exp.doc.grants : {};
  const passes = new Map();
  for (const d of docs) walk(d.doc, (n) => {
    if (isObj(n) && typeof n.use === 'string' && typeof n.id === 'string') {
      if (!passes.has(n.use)) passes.set(n.use, []);
      passes.get(n.use).push(isObj(n.grants) ? n.grants : {});
    }
  });
  const has = {
    signal: (g, name) => list(g.signals).includes(name),
    pageAction: (g, name) => list(g.pageActions).includes(name),
    hook: (g, name) => list(g.hooks).includes(name) || Object.hasOwn(hooks, name),
  };
  for (const d of docs) {
    const sets = d.kind === 'block' ? (passes.get(d.id) || []) : [expGrants];
    if (!sets.length) continue;
    const need = (kind, name, p, what) => { if (!sets.every(g => has[kind](g, name))) ctx.report('E-GRANT', d.file, pathStr(p), `${what} is not asked for in grants`); };
    walk(d.doc, (n, p) => {
      if (!isObj(n)) return;
      if (isObj(n.on)) for (const ev of Object.keys(n.on)) { const sig = signalOf(ev); if (sig !== null) need('signal', sig, [...p, 'on', ev], `the signal ${ev}`); }
      for (const k of ['entry', 'exit', 'actions', 'then', 'else']) {
        if (!Array.isArray(n[k])) continue;
        n[k].forEach((a, i) => {
          const pc = pageCall(a);
          const lit = pc && typeof pc.ref === 'string' ? named(pc.ref) : null;
          if (!lit || !HOOK_NAME.test(lit[1])) return; // input:<name> hooks are checked where the input is given
          need('pageAction', `${pc.op}:${lit[1]}`, [...p, k, i], `the page action ${pc.op}:${lit[1]}`);
          need('hook', lit[1], [...p, k, i], `the hook ${lit[1]}`);
        });
      }
    });
    if (d.kind === 'experience') {
      for (const [i, l] of list(d.doc.story?.links).entries()) { const sig = signalOf(l?.on); if (sig !== null) need('signal', sig, ['story', 'links', i, 'on'], `the signal ${l.on}`); }
      for (const [i, c] of list(d.doc.story?.chapters).entries()) for (const f of ['next', 'back']) { const sig = signalOf(c?.[f]); if (sig !== null) need('signal', sig, ['story', 'chapters', i, f], `the signal ${c[f]}`); }
    }
  }
}

// A host page's marks, without a DOM: [{kind, name}] for each marked element (data-hsvg-hook). The earlier marks are
// converted at import (docs/spec-2.0-work/tools/upgrade/page-marks.mjs); here they are only named.
const OLD_MARKS = { 'data-hsvg-target': 'target', 'data-hsvg-spot': 'spot', 'data-hsvg-grab': 'grab', 'data-hsvg-action': 'control' };
function marksIn(html) {
  const out = [];
  for (const tag of String(html).matchAll(/<[a-zA-Z][^>]*>/g)) {
    const el = [];
    for (const m of tag[0].matchAll(/(data-hsvg-[a-z]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      const value = m[2] ?? m[3];
      if (m[1] === 'data-hsvg-hook') {
        for (const t of value.split(/\s+/).filter(Boolean)) { const [kind, name, ...rest] = t.split(':'); if (!rest.length && name && HOOK_NAME.test(name)) el.push({ kind, name }); }
      }
    }
    if (el.length) out.push(el);
  }
  return out;
}

// Checks a host page (its HTML text) for an experience document. Returns [{code, hook?, message}].
export function checkHostPage(html, expDoc) {
  const out = lintHooks(html).map(d => ({ code: d.code, message: d.message }));
  for (const m of String(html).matchAll(/(data-hsvg-(?:target|spot|grab|action))\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    out.push({ code: 'E-HOOK-MARK', message: `${m[1]}="${m[2] ?? m[3]}" is an earlier mark the page no longer reads; write data-hsvg-hook="${OLD_MARKS[m[1]]}:${(m[2] ?? m[3]).trim()}", or convert the page with node docs/spec-2.0-work/tools/upgrade/page-marks.mjs <page>` });
  }
  const hooks = pageHooks(expDoc);
  const els = marksIn(html);
  for (const [name, h] of Object.entries(hooks)) {
    if (!isObj(h) || h.optional === true || h.kind === 'obstacle') continue;
    const n = els.filter(marks => marks.some(m => m.name === name && m.kind === h.kind)).length;
    if (n !== 1) out.push({ code: 'W-HOOK-MISSING', hook: name, message: `${name} (${h.kind}) is marked ${n === 0 ? 'nowhere' : `${n} times`} on the page: it reads ${n === 0 ? 'missing' : 'ambiguous'}, and the actor docks` });
  }
  return out;
}
