// Review findings that files can decide (T1 item 3). Hands-on reviews found these by hand; the checker now
// warns in seconds.
// - W-NAME-HIDES-LABEL (WCAG 2.5.3, 5.11): a button, a toggle or an option whose spoken name (its label, else its
//   target's data-hsvg-label, 10.13) does not contain the words drawn in its target. Only names and texts that are plain words or word lookups ({{ words.id }}, and a ? b : c of them) are
//   compared; any other formula is left to the browser test (test.mjs, T-NAME-HIDES-LABEL).
// - W-TEXT-SMALL (7.3, 8.4): a text drawn under the readable floor at a size where the layout's scale is known. The
//   sizes are the declared sizes of the shape axes; with none declared, the two sizes the browser test uses (1280x800
//   wide and 390x844 phone), but only where a layout's own size or shape applies there (the author drew it for that
//   space; a drawing that is merely the nearest is not). The scale is the frame fitted into the space (a shell's stage
//   slot too). Layouts with a
//   layout plan are W-PLAN-SCALE's (plans.mjs). A text that a fit rule may shrink is measured by the browser test.
import { parseXml } from '../schema/xml.mjs';
import { parseTemplate } from '../src/formula.mjs';
import { chooseLayout, shapeMapsOf, parseSize, applies } from '../src/layout.mjs';
import { viewBoxOf, worldOf, measure } from '../src/plan.mjs';
import { readableFloor } from '../src/ladder.mjs';
import { roleOf } from '../src/marks.mjs';

export const REFERENCE_SIZES = ['1280x800', '390x844'];
const MAX_CHOICES = 16; // a template with more possible texts than this is not compared

const parse = (text) => {
  let root; try { root = parseXml(text); } catch { return null; }
  const byId = new Map();
  const walk = (n, parent) => { if (!n.name) return; n.parent = parent; if (n.attrs.id) byId.set(n.attrs.id, n); n.children.forEach(c => walk(c, n)); };
  walk(root, null);
  return { root, byId };
};
const textOf = (n) => (n.name ? n.children.map(textOf).join('') : n.text || '');
// Lower case words and numbers only: "Next ›" and "next" compare the same.
export const norm = (s) => String(s).toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// The texts a template can show, as a list, when it is plain words and word lookups (a ? b : c of them); else null.
// words: id -> text (the block's words over the experience's, one language).
export function templateTexts(src, words, depth = 0) {
  if (typeof src !== 'string') return null;
  if (!src.includes('{{')) return [src];
  if (depth > 4) return null;
  let spans; try { spans = parseTemplate(src); } catch { return null; }
  const of = (f) => {
    if (f.k === 'lit' && (typeof f.v === 'string' || typeof f.v === 'number')) return [String(f.v)];
    if (f.k === 'mem' && f.o?.k === 'name' && f.o.v === 'words' && !f.o.hsvg && f.key?.k === 'lit' && typeof words[f.key.v] === 'string') return templateTexts(words[f.key.v], words, depth + 1);
    if (f.k === 'if') { const a = of(f.a); const b = of(f.b); return a && b ? [...a, ...b] : null; }
    return null;
  };
  let out = [''];
  for (const s of spans) {
    const opts = typeof s === 'string' ? [s] : of(s.f);
    if (!opts) return null;
    out = out.flatMap(x => opts.map(o => x + o));
    if (out.length > MAX_CHOICES) return null;
  }
  return out;
}

// The words a block reads, in the experience's language: its own over the experience's (runtime.mjs words()).
function wordsOf(exp, owner) {
  const lang = exp.doc.language || 'en';
  const pick = (w) => w?.[lang] || w?.[lang.split('-')[0]] || Object.values(w || {})[0] || {};
  return { ...pick(exp.words), ...pick(owner.words) };
}
// The drawn texts of a control target as a person sees it with no pointer: a look other than idle is left out, and so
// is a part hidden from the start (display="none"). Each text: {node, texts (the possible strings) or null}.
function drawnTexts(target, bindings, words) {
  const out = [];
  const walk = (n) => {
    if (!n.name) return;
    const look = n.attrs['data-hsvg-variant'];
    if (look && look !== 'idle') return;
    if (!look && n.attrs.display === 'none') return;
    if (n.name === 'text') {
      const b = bindings.find(x => x?.target === n.attrs.id && typeof x.text === 'string');
      out.push({ node: n, texts: b ? templateTexts(b.text, words) : [textOf(n)] });
      return;
    }
    n.children.forEach(walk);
  };
  walk(target);
  return out;
}

function nameChecks(ctx, owner, frames) {
  const { experience: exp, report } = ctx;
  const words = wordsOf(exp, owner);
  const bindings = Array.isArray(owner.doc.bindings) ? owner.doc.bindings : [];
  const ns = owner.ns;
  const seen = new Set();
  const look = (frame, id) => frame.byId.get(id) || (ns ? frame.byId.get(`${ns}__${id}`) : null);
  // The names a control can have: its label, and its disabledLabel while it cannot be used (the words shown then).
  // Without a label the target's data-hsvg-label names it (10.13); its words in braces are plain text.
  const one = (path, target, label, what, disabledLabel) => {
    if (typeof target !== 'string' || seen.has(path)) return;
    if (typeof label !== 'string') {
      label = frames.map(f => look(f, target)?.attrs['data-hsvg-label']).find(x => typeof x === 'string');
      if (typeof label !== 'string') return;
      label = label.replace(/\{\{/g, '{ {');
      what = `${what} (named by its data-hsvg-label)`;
    }
    const names = templateTexts(label, words);
    if (!names) return;
    if (typeof disabledLabel === 'string') { const d = templateTexts(disabledLabel, words); if (!d) return; names.push(...d); }
    for (const frame of frames) {
      const t = look(frame, target);
      if (!t) continue;
      for (const d of drawnTexts(t, bindings, words)) {
        if (!d.texts) continue;
        for (const shown of d.texts) {
          const v = norm(shown);
          if (!/\p{L}/u.test(v) || v.length < 2) continue; // a sign, an icon or one letter (S for Small): no words to speak
          if (names.some(n => ` ${norm(n)} `.includes(` ${v} `))) continue;
          seen.add(path);
          report('W-NAME-HIDES-LABEL', owner.file, path, `${what} ${target} shows "${shown.trim()}" but is named "${names.join('" or "')}": the spoken name must contain the visible words, best at its start (WCAG 2.5.3)`);
          return;
        }
      }
    }
  };
  for (const [cid, c] of Object.entries(owner.doc.controls || {})) {
    if (!c || typeof c !== 'object') continue;
    if (c.kind === 'button' || c.kind === 'toggle') one(`/controls/${cid}/label`, c.target, c.label, `${c.kind} ${cid}: its target`, c.disabledLabel);
    if (c.kind === 'choice') for (const [oid, o] of Object.entries(c.options || {})) one(`/controls/${cid}/options/${oid}/label`, o?.target, o?.label, `choice ${cid}, option ${oid}: its target`);
  }
}

// font-size in drawing units: the attribute or the style, inherited; 16 without one.
function fontSize(n) {
  for (let x = n; x; x = x.parent) {
    const s = /(?:^|;)\s*font-size\s*:\s*([\d.]+)(px)?\s*(?:;|$)/.exec(x.attrs?.style || '');
    const v = s ? Number(s[1]) : x.attrs?.['font-size'] !== undefined ? Number(String(x.attrs['font-size']).replace(/px$/, '')) : NaN;
    if (Number.isFinite(v) && v > 0) return v;
  }
  return 16;
}
const scaleOf = (m) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
const roleUp = (n) => { for (let x = n; x; x = x.parent) if (roleOf(x.attrs)) return roleOf(x.attrs); return null; };

// The frame a block draws at a space: its chosen layout's drawing (else its main drawing), parsed. {layout, index, frame, file}.
function frameAt(owner, exp, space) {
  const layouts = Array.isArray(owner.doc.layouts) ? owner.doc.layouts : [];
  let l = null;
  let meant = false; // the chosen layout's own size or shape applies to the space: the author drew it for that space
  if (layouts.length) { try { const maps = shapeMapsOf(owner.doc, exp.doc); const id = chooseLayout(layouts, space, { maps })?.id; l = layouts.find(x => x?.id === id) || null; meant = !!l && applies(l, space, maps); } catch { l = null; } }
  const d = (l?.drawing ? owner.drawings?.[l.id] : null) || owner.drawings?.main || Object.values(owner.drawings || {})[0];
  if (!d?.text) return null;
  const frame = parse(d.text);
  if (!frame) return null;
  const vb = viewBoxOf(frame.root);
  return vb ? { layout: l, index: l ? layouts.indexOf(l) : -1, frame, vb, file: d.file || owner.file, meant } : null;
}

// The smallest text a frame draws at scale k, and in the components it mounts into rect slots (one level).
function smallest(exp, owner, at, k, depth = 0) {
  let best = null;
  const consider = (n, px, where) => { if (!/\S/.test(textOf(n)) && !n.attrs.id) return; if (!best || px < best.px) best = { px, node: n, where, role: roleUp(n), owner }; };
  const walk = (n) => {
    if (!n.name || n.name === 'defs' || n.name === 'clipPath' || n.name === 'mask' || n.name === 'symbol') return;
    if (n.name === 'text' || n.name === 'tspan') consider(n, fontSize(n) * scaleOf(worldOf(n)) * k, at.file);
    n.children.forEach(walk);
  };
  walk(at.frame.root);
  if (depth > 0) return best;
  for (const u of Array.isArray(owner.doc.uses) ? owner.doc.uses : []) {
    const def = u && exp.blocks?.[u.use];
    const slot = def && [...at.frame.byId.values()].find(n => n.attrs['data-hsvg-slot'] === u.into);
    if (!slot || slot.name !== 'rect') continue;
    const box = measure(slot);
    if (!box || !(box.width > 0 && box.height > 0)) continue;
    const s = k * scaleOf(worldOf(slot));
    const inner = frameAt(def, exp, { width: Math.round(box.width * s), height: Math.round(box.height * s) });
    if (!inner) continue;
    const r = smallest(exp, def, inner, s * Math.min(box.width / inner.vb.width, box.height / inner.vb.height), depth + 1);
    if (r && (!best || r.px < best.px)) best = r;
  }
  return best;
}

function sizeChecks(ctx) {
  const { experience: exp, report } = ctx;
  const declared = [];
  const add = (doc) => { for (const a of doc?.axes || []) if (a?.axis === 'shape' && a.sizes) for (const sz of Object.keys(a.sizes)) if (parseSize(sz) && !declared.includes(sz)) declared.push(sz); };
  add(exp.doc);
  for (const sc of Object.values(exp.scenes)) add(sc.doc);
  const sizes = declared.length ? declared : REFERENCE_SIZES;
  const findings = new Map(); // file|pointer -> {owner, path, list}
  for (const [sid, sc] of Object.entries(exp.scenes)) {
    for (const sz of sizes) {
      const space = parseSize(sz);
      let k0 = 1; let sceneSpace = space;
      if (exp.shell) {
        const sh = frameAt(exp.shell, exp, space);
        if (sh) {
          const ks = Math.min(space.width / sh.vb.width, space.height / sh.vb.height);
          const slot = [...sh.frame.byId.values()].find(n => n.attrs['data-hsvg-slot'] && exp.shell.doc.slots?.[n.attrs['data-hsvg-slot']]?.kind === 'stage');
          const box = slot && slot.name === 'rect' ? measure(slot) : null;
          if (box && box.width > 0 && box.height > 0) { k0 = ks * scaleOf(worldOf(slot)); sceneSpace = { width: Math.round(box.width * k0), height: Math.round(box.height * k0) }; }
          if (sid === Object.keys(exp.scenes)[0] && !(sh.layout?.layoutPlan) && (declared.length || sh.meant)) note(exp.shell, sh, ks, sz);
        }
      }
      const at = frameAt(sc, exp, sceneSpace);
      if (!at || at.layout?.layoutPlan) continue;
      // At a reference size (none declared) only a layout meant for that space counts: its scale is known.
      if (!declared.length && !at.meant) continue;
      note(sc, at, k0 * Math.min(sceneSpace.width / at.vb.width, sceneSpace.height / at.vb.height), sz);
    }
  }
  function note(owner, at, k, sz) {
    const s = smallest(exp, owner, at, k);
    if (!s) return;
    const floor = readableFloor([exp.doc, s.owner.doc], s.role, exp.host?.readable ?? 12);
    if (s.px >= floor - 0.01) return;
    const path = at.index >= 0 ? `/layouts/${at.index}` : '';
    const key = `${owner.file}|${path}`;
    const f = findings.get(key) || { owner, path, list: [] };
    if (!f.list.some(x => x.startsWith(`${sz}:`))) f.list.push(`${sz}: ${s.node.attrs.id || '<text>'}${s.owner !== owner ? ` (in ${s.owner.doc.id})` : ''} at ${Math.round(s.px * 100) / 100} px, floor ${floor}`);
    findings.set(key, f);
  }
  for (const f of findings.values()) report('W-TEXT-SMALL', f.owner.file, f.path, `text under the readable floor where this ${f.path ? 'layout' : 'drawing'} is shown: ${f.list.join('; ')}. Draw a frame for that size (a phone layout at 390 x 844 units), or give the text a larger size (rule 8)`);
}

export function check(ctx) {
  const exp = ctx.experience;
  const owners = [...Object.values(exp.scenes).map(o => ({ o, ns: null })), ...Object.entries(exp.blocks || {}).map(([id, o]) => ({ o, ns: o.doc?.id || id }))];
  if (exp.shell) owners.push({ o: exp.shell, ns: null });
  for (const { o, ns } of owners) {
    if (!o?.doc?.controls) continue;
    const frames = Object.values(o.drawings || {}).map(d => d?.text && parse(d.text)).filter(Boolean);
    nameChecks(ctx, { ...o, doc: o.doc, words: o.words, file: o.file, ns }, frames);
  }
  sizeChecks(ctx);
}
