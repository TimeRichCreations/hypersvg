// Finds every formula and template in one document (5.6.1) and says what its field needs.
// A site is { path, src, mode, expect, range, eventOk, itemOk, motion, link, from }.
//   mode: 'formula', 'template', or 'text' (a text slot: plain words, or {{ }} for a formula, D31.1).
//   expect: 'any', 'boolean', 'number', 'string', 'array', or { decl: <name of a value or input> } or { input: [useId or 'dest', name] }.
//   range: { lo, hi, code, what } when the field needs a proven range (5.6.7).
//   motion: { target, channel } when the value must lie inside the target part's motion range (6.7).
import { walkBehaviour } from '../refs/walk.mjs';
import { EFFECT_PARAMS, PHYSICS_BODY_PARAMS } from './params.mjs';
import { builtinCall, callInputDecl, callName } from '../builtins.mjs';
import { channelOf, wordOf, valueOf, isMirror } from '../../src/binding-words.mjs';
import { isTextDecl, textSlot } from '../../src/formula.mjs';
import { settingsOf } from '../../src/widgets-of.mjs';

// The ambient settings player.setting writes (src/runtime.mjs AMBIENT_SETTINGS).
const SETTINGS = { muted: { type: 'boolean' }, volume: { type: 'number' }, voice: { type: 'boolean' }, reducedMotion: { type: 'boolean' }, timeLimits: { type: 'number' } };
// The declaration a site's value fills, where it can be found: a set target, a use's input, a link's carry into its
// scene's input, a setting. exp (a loaded experience) is optional; without it only the document's own names are
// known. A text declaration makes the site a text slot (D31.1).
export function declsFor(doc, exp = null) {
  const shared = doc?.kind === 'scene' || doc?.kind === 'shell';
  const top = exp?.doc;
  return (e, site) => {
    if (!e || typeof e !== 'object') return undefined;
    if (typeof e.decl === 'string') return doc.values?.[e.decl] ?? (shared ? top?.values?.[e.decl] : undefined);
    if (typeof e.setting === 'string') return SETTINGS[e.setting] ?? top?.inputs?.[e.setting] ?? (doc.kind === 'experience' ? doc.inputs?.[e.setting] : undefined);
    if (Array.isArray(e.callInput)) return callInputDecl(exp, ...e.callInput); // a call's input: its add-on's manifest
    if (Array.isArray(e.input)) {
      const [useId, name] = e.input;
      if (useId === 'dest') return exp?.scenes?.[site.to]?.doc?.inputs?.[name];
      const u = (doc.uses || []).find(x => x && x.id === useId);
      return u && typeof u.use === 'string' ? exp?.blocks?.[u.use]?.doc?.inputs?.[name] : undefined;
    }
    return undefined;
  };
}

const esc = (s) => String(s).replace(/~/g, '~0').replace(/\//g, '~1');
const BASE = 3600000;

// What a channel's value needs (6.7): a look name; a motion capability colour (#rrggbb, a string); route and morph
// progress, 0..1 with no drawn range (6.2.1 lists none for them); any other channel, a number inside the part's motion
// range (stroke-width included).
// A dash's start (6.7, the motion capability): a share of the length, 0..1.
const dashStart = (what) => ({ expect: 'number', range: { lo: 0, hi: 1, code: 'E-RANGE', what: `${what} draw start` } });
function channelNeeds(channel, targets, what, mirror = false) {
  if (channel === 'look' || channel === 'fill' || channel === 'stroke') return { expect: 'string' };
  if (channel === 'route' || channel === 'morph') return { expect: 'number', range: { lo: 0, hi: 1, code: 'E-RANGE', what: `${what} ${channel} progress` } };
  return { expect: 'number', motion: { targets, channel, what, ...(mirror ? { mirror: true } : {}) } };
}

// videoMs(id): the durationMs of a video resource the block can name, or undefined (the media capability, A2.1); without
// it a media.seek atMs is proven against the longest video the block itself declares, else 24 hours.
// growth(value): the paints.<name> declaration of an add-on channel <id>.<name> (D39), or null; its value range is
// what a binding's formula or a track's keys must be proven inside.
export function blockSites(doc, { experience = false, videoMs = null, decls = declsFor(doc), growth = null } = {}) {
  const grown = (v, what) => { const d = typeof v === 'string' && v.includes('.') ? growth?.(v) : null; return d ? { expect: 'number', range: { lo: d.value.minimum, hi: d.value.maximum, code: 'E-RANGE', what: `${what} ${v}` } } : null; };
  const sites = [];
  const push = (path, src, extra = {}) => {
    if (src === undefined || src === null) return;
    sites.push({ path, src, mode: 'formula', expect: 'any', eventOk: false, itemOk: false, ...extra });
  };
  const tmpl = (path, src, extra = {}) => {
    if (typeof src === 'string') sites.push({ path, src, mode: 'template', expect: 'string', eventOk: false, itemOk: false, ...extra });
  };

  // ----- computed values and outputs (5.2, 5.4) -----
  for (const [k, src] of Object.entries(doc.computed || {})) push(`/computed/${esc(k)}`, src, { computed: k });
  for (const [k, o] of Object.entries(doc.outputs || {})) {
    if (!o || typeof o !== 'object' || o.kind !== 'result' || o.value === undefined) continue;
    const range = o.type === 'number' && (typeof o.minimum === 'number' || typeof o.maximum === 'number')
      ? { lo: typeof o.minimum === 'number' ? o.minimum : -Infinity, hi: typeof o.maximum === 'number' ? o.maximum : Infinity, code: 'E-RANGE', what: `output ${k}` } : null;
    push(`/outputs/${esc(k)}/value`, o.value, { expect: { output: k }, range });
  }

  // The longest video a place can show: a literal id names one; a formula may give any video in scope.
  const seekLimit = (place) => {
    const bd = (Array.isArray(doc.bindings) ? doc.bindings : []).find(b => b && b.target === place && typeof b.media?.video === 'string');
    const m = bd && /^\s*'([^']*)'\s*$/.exec(bd.media.video);
    const len = (id) => videoMs?.(id) ?? (doc.resources?.[id]?.kind === 'video' ? doc.resources[id].durationMs : undefined);
    if (m && typeof len(m[1]) === 'number') return len(m[1]);
    const all = Object.keys(doc.resources || {}).concat(videoMs?.all?.() || []).map(len).filter(x => typeof x === 'number');
    return all.length ? Math.max(...all) : 86400000;
  };
  // ----- behaviour: guards, timers and actions (5.13, 5.14, 5.15) -----
  const action = (a, path) => {
    const eventOk = path.includes('/on/') && !path.includes('/after/');
    if (a.if !== undefined) push(`${path}/if`, a.if, { expect: 'boolean', eventOk });
    if (typeof a.set === 'string' && 'to' in a) push(`${path}/to`, a.to, { expect: { decl: a.set }, eventOk });
    // A built-in capability's call (D28): an input its manifest types as a number is proven a number in its range.
    const bc = typeof a.call === 'string' ? builtinCall(a.call) : null;
    const built = bc?.call?.with?.properties ?? null;
    // The player's calls (D33): player.setting's value has the setting's type; resetSaved's settings is a boolean.
    const player = typeof a.call === 'string' && a.call.startsWith('player.');
    if (player && a.with && typeof a.with === 'object') for (const [k, v] of Object.entries(a.with)) {
      push(`${path}/with/${esc(k)}`, v, a.call === 'player.setting' ? { expect: { setting: k }, eventOk } : a.call === 'player.resetSaved' && k === 'settings' ? { expect: 'boolean', eventOk } : { eventOk });
    }
    for (const key of ['emit', 'call']) {
      if (a[key] !== undefined && !player && a.with && typeof a.with === 'object') for (const [k, v] of Object.entries(a.with)) {
        const q = key === 'call' ? built?.[k] : null;
        if (key === 'call' && bc && !q) continue; // no such input of a built-in's call: check/modules.mjs says so (E-ADDON)
        const p = q?.type === 'number' ? q : (Array.isArray(q?.oneOf) ? q.oneOf.find(x => x?.type === 'number') : null); // a number, or a formula giving one
        // media.seek's atMs: a time in the longest video its place can show (A2.1).
        const seek = a.call === 'media.seek' && k === 'atMs';
        if (seek && typeof v !== 'string') continue; // a literal time is checked against its video by check/media.mjs
        const range = seek ? { lo: 0, hi: seekLimit(callName(null, a, 'place')), code: 'E-RANGE', what: `${a.id} atMs` }
          : (p && typeof p.minimum === 'number' && typeof p.maximum === 'number' ? { lo: p.minimum, hi: p.maximum, code: 'E-RANGE', what: `${a.call} ${k}` } : null);
        // An input its add-on's manifest types as a string is a text slot (D31.1): words, or {{ }} for a formula.
        push(`${path}/with/${esc(k)}`, v, p?.type === 'number' ? { expect: 'number', eventOk, ...(range ? { range } : {}) } : key === 'call' ? { expect: { callInput: [a.call, k] }, eventOk } : { eventOk });
      }
    }
    // A trigger on a repeated use reaches one row with itemKey (4.5).
    if (a.as === 'trigger' && a.itemKey !== undefined) push(`${path}/itemKey`, a.itemKey, { eventOk });
    if (a.as === 'sound' && a.volume !== undefined) push(`${path}/volume`, a.volume, { expect: 'number', eventOk });
    // A sound's name is a formula (D36): a bare name is a value's name, so a sound's id is quoted ('bell').
    if (a.as === 'sound' && a.play !== undefined) push(`${path}/play`, a.play, { expect: 'string', eventOk, sound: true });
  };
  // a numeric parameter that is a number or a formula, with the range it needs (effects, physics)
  const param = (base, obj, table, what, eventOk = false) => {
    for (const [key, spec] of Object.entries(table)) {
      const v = obj?.[key];
      if (v === undefined) continue;
      if (spec.each) { if (Array.isArray(v)) v.forEach((x, i) => push(`${base}/${key}/${i}`, x, { expect: 'number', eventOk, range: { lo: spec.each[0], hi: spec.each[1], code: 'E-RANGE', what: `${what} ${key}` } })); } else if (typeof v === 'string') push(`${base}/${key}`, v, { expect: 'number', eventOk, range: { lo: spec.range[0], hi: spec.range[1], code: 'E-RANGE', what: `${what} ${key}` } });
    }
  };
  for (const [id, fx] of Object.entries(doc.addons?.effects?.particles || {})) {
    if (fx && typeof fx === 'object') param(`/addons/effects/particles/${esc(id)}`, fx, EFFECT_PARAMS.particles, `effect ${id}`);
  }
  for (const [id, body] of Object.entries(doc.addons?.physics?.bodies || {})) if (body && typeof body === 'object') param(`/addons/physics/bodies/${esc(id)}`, body, PHYSICS_BODY_PARAMS, `body ${id}`);
  const reaction = (r, path) => {
    const eventOk = path.includes('/on/') && !path.includes('/after/');
    if (r.guard !== undefined) push(`${path}/guard`, r.guard, { expect: 'boolean', eventOk });
    if (path.includes('/after/') && r.delayMs !== undefined) push(`${path}/delayMs`, r.delayMs, { expect: 'number', range: { lo: 1, hi: BASE, code: 'E-RANGE', what: 'delayMs' } });
  };
  walkBehaviour(doc, { action, reaction });

  // ----- controls (5.11) -----
  for (const [id, c] of Object.entries(doc.controls || {})) {
    if (!c || typeof c !== 'object') continue;
    push(`/controls/${esc(id)}/enabled`, c.enabled, { expect: 'boolean' });
    tmpl(`/controls/${esc(id)}/label`, c.label);
    tmpl(`/controls/${esc(id)}/disabledLabel`, c.disabledLabel);
    tmpl(`/controls/${esc(id)}/valueText`, c.valueText);
    // positions as a formula (K1): proven to lie in 2..1000 (5.6.7), as clamp(round(span / step) + 1, 2, 1000) is.
    if (typeof c.positions === 'string') push(`/controls/${esc(id)}/positions`, c.positions, { expect: 'number', range: { lo: 2, hi: 1000, code: 'E-RANGE', what: `control ${id} positions` } });
    for (const [oid, o] of Object.entries(c.options || {})) {
      if (!o || typeof o !== 'object') continue;
      push(`/controls/${esc(id)}/options/${esc(oid)}/enabled`, o.enabled, { expect: 'boolean' });
      // an option's value fills the control's value (a text value takes words, D31.1)
      if (typeof c.value === 'string' && o.value !== undefined) push(`/controls/${esc(id)}/options/${esc(oid)}/value`, o.value, { expect: { decl: c.value } });
      tmpl(`/controls/${esc(id)}/options/${esc(oid)}/label`, o.label);
    }
  }

  // ----- bindings (6.8) -----
  (doc.bindings || []).forEach((b, i) => {
    if (!b || typeof b !== 'object') return;
    const p = `/bindings/${i}`;
    const ch = channelOf(b); const word = wordOf(b);
    push(`${p}/visible`, b.visible, { expect: 'boolean' });
    push(`${p}/variant`, b.variant, { expect: 'string' });
    if ((b.as ?? 'marked') === 'marked') push(`${p}/color`, b.color, { expect: 'string' });
    if (b.media && typeof b.media === 'object') push(`${p}/media/video`, b.media.video, { expect: 'string' });
    tmpl(`${p}/text`, b.text);
    tmpl(`${p}/label`, b.label);
    // rich text (6.8.1, a rich-text binding): each literal run's text is a template, its highlight a boolean formula
    // ("spoken" is read-along); a flowing text is a template
    const rb = b['rich-text'] && typeof b['rich-text'] === 'object' ? b['rich-text'] : {};
    const rp = `${p}/rich-text`;
    if (Array.isArray(rb.runs)) rb.runs.forEach((r, k) => {
      if (!r || typeof r !== 'object') return;
      tmpl(`${rp}/runs/${k}/text`, r.text);
      if (typeof r.highlight === 'string' && r.highlight !== 'spoken') push(`${rp}/runs/${k}/highlight`, r.highlight, { expect: 'boolean' });
    });
    else if (typeof rb.runs === 'string') push(`${rp}/runs`, rb.runs, { expect: 'array' });
    tmpl(`${rp}/text`, rb.text);
    if (word === 'draw' && b.as === 'points') push(`${p}/draw`, b.draw, { expect: 'array' });
    if (!ch && grown(word, '')) push(`${p}/${esc(word)}`, valueOf(b), grown(word, `binding ${b.id ?? p}`));
    if (ch && ch !== 'look' && valueOf(b) !== undefined) push(`${p}/${esc(word)}`, valueOf(b), channelNeeds(ch, [b.target], `binding ${b.id ?? p}`, isMirror(b)));
    if (ch === 'dash') push(`${p}/start`, b.start, dashStart(`binding ${b.id ?? p}`));
  });

  // ----- clips (6.7) -----
  for (const [cid, clip] of Object.entries(doc.clips || {})) {
    if (!clip || typeof clip !== 'object') continue;
    push(`/clips/${esc(cid)}/speed`, clip.speed, { expect: 'number', range: { lo: 0.01, hi: 100, code: 'E-RANGE', what: `clip ${cid} speed` } });
    (clip.tracks || []).forEach((t, i) => {
      if (!t || typeof t !== 'object') return;
      (t.keys || []).forEach((k, j) => {
        if (!Array.isArray(k) || k.length < 2) return;
        const p = `/clips/${esc(cid)}/tracks/${i}/keys/${j}/1`;
        push(p, k[1], grown(t.channel, `clip ${cid}, track ${t.id ?? `#${i}`}`) ?? channelNeeds(channelOf(t), [t.target, ...(t.stagger?.targets || [])], `clip ${cid}, track ${t.id ?? `#${i}`}`));
      });
      if (channelOf(t) === 'dash') push(`/clips/${esc(cid)}/tracks/${i}/start`, t.start, dashStart(`clip ${cid}, track ${t.id ?? `#${i}`}`));
    });
  }

  // ----- uses (4.3, 4.5) and clocks (3.10) -----
  (doc.uses || []).forEach((u, i) => {
    if (!u || typeof u !== 'object') return;
    const p = `/uses/${i}`;
    // A declared or custom widget's `items` is its list of input names (A6.1), not a repeat formula.
    const widget = u.declared !== undefined || u.custom !== undefined;
    const repeat = !widget && u.items !== undefined;
    if (!widget) {
      push(`${p}/items`, u.items, { expect: 'array', ...(repeat ? { repeat: { use: u } } : {}) });
      push(`${p}/key`, u.key, { itemOk: repeat });
    }
    for (const [k, v] of Object.entries(u.with || {})) push(`${p}/with/${esc(k)}`, v, { expect: { input: [u.id, k] }, itemOk: repeat });
    if (u.clock && typeof u.clock === 'object') {
      push(`${p}/clock/speed`, u.clock.speed, { expect: 'number', itemOk: repeat, range: { lo: 0.01, hi: 100, code: 'E-CLOCK-SPEED', what: `use ${u.id} clock speed` } });
      push(`${p}/clock/paused`, u.clock.paused, { expect: 'boolean', itemOk: repeat });
    }
  });
  // a scene's own clock (3.10), read in the scene's scope
  if (doc.kind === 'scene' && doc.clock && typeof doc.clock === 'object') {
    push('/clock/speed', doc.clock.speed, { expect: 'number', range: { lo: 0.01, hi: 100, code: 'E-CLOCK-SPEED', what: `scene ${doc.id} clock speed` } });
    push('/clock/paused', doc.clock.paused, { expect: 'boolean' });
  }

  // ----- spoken lines (6.11), rules (8.1) -----
  const lines = doc.addons?.lines?.lines;
  for (const [id, l] of Object.entries(lines && typeof lines === 'object' ? lines : {})) if (l && typeof l === 'object') tmpl(`/addons/lines/lines/${esc(id)}/text`, l.text);
  // a rule's `when`, and its numeric parameters when they are formulas (8.1); "host" is a word, read before formulas (8.9, A10.3)
  const NUMERIC = ['minimum', 'maximum', 'minLength', 'maxLength', 'maxLines', 'minTextPx', 'ratio', 'largeRatio', 'minPx', 'minMs', 'count', 'windowMs', 'tolerance', 'withinMs', 'minShowMs'];
  (doc.rules || []).forEach((r, i) => {
    if (!r || typeof r !== 'object') return;
    push(`/rules/${i}/when`, r.when, { expect: 'boolean' });
    for (const k of NUMERIC) if (typeof r[k] === 'string' && !(r[k] === 'host')) push(`/rules/${i}/${k}`, r[k], { expect: 'number' });
  });

  if (experience) experienceSites(doc, push, tmpl);
  // Every value slot holds a formula, text in single quotes (D36): no site is a text slot.
  return sites;
}

// The experience's own fields: links (3.2), start (3.8), chapters (3.12) and settings (5.3.2).
function experienceSites(doc, push, tmpl) {
  const st = settingsOf(doc); const sp = '/addons/widgets/settings'; // the settings (5.3.2) are the widgets add-on's (D31)
  for (const [id, g] of Object.entries(st?.groups || {})) {
    if (typeof g === 'string') tmpl(`${sp}/groups/${esc(id)}`, g);
    else if (g && typeof g === 'object') { tmpl(`${sp}/groups/${esc(id)}/label`, g.label); tmpl(`${sp}/groups/${esc(id)}/description`, g.description); }
  }
  (st?.items || []).forEach((it, i) => { if (it && typeof it === 'object') { tmpl(`${sp}/items/${i}/label`, it.label); tmpl(`${sp}/items/${i}/description`, it.description); } });
  const story = doc.story;
  if (!story || typeof story !== 'object') return;
  const startEntry = (list, path) => Array.isArray(list) && list.forEach((e, i) => { if (e && typeof e === 'object') push(`${path}/${i}/when`, e.when, { expect: 'boolean', scope: 'start' }); });
  if (Array.isArray(story.start)) startEntry(story.start, '/story/start');
  else if (story.start && typeof story.start === 'object') for (const [slot, v] of Object.entries(story.start)) startEntry(v, `/story/start/${esc(slot)}`);
  (story.links || []).forEach((l, i) => {
    if (!l || typeof l !== 'object') return;
    const p = `/story/links/${i}`;
    const at = { scope: 'link', from: l.from, to: l.to, eventOk: true };
    push(`${p}/when`, l.when, { ...at, expect: 'boolean' });
    for (const [k, v] of Object.entries(l.carry || {})) push(`${p}/carry/${esc(k)}`, v, { ...at, expect: { input: ['dest', k] } });
    if (typeof l.afterMs === 'string') push(`${p}/afterMs`, l.afterMs, { ...at, eventOk: false, expect: 'number', range: { lo: 1, hi: BASE, code: 'E-RANGE', what: `link ${l.id ?? `#${i}`} afterMs` } });
    tmpl(`${p}/choice`, l.choice, at);
  });
  (story.chapters || []).forEach((c, ci) => {
    (c.scenes || []).forEach((s, si) => { if (s && typeof s === 'object') push(`/story/chapters/${ci}/scenes/${si}/skipWhen`, s.skipWhen, { expect: 'boolean', scope: 'start' }); });
  });
}

// The formula a site holds: a formula site's source, a text slot's one {{ f }}, else null (words, or a template).
export function siteFormula(site) {
  if (site.mode === 'formula') return site.src;
  if (site.mode !== 'text') return null;
  try { return textSlot(site.src).formula ?? null; } catch { return null; }
}
