// Checks one HyperSVG 2.0 drawing against the generated drawing rules (schemas/core/drawing.rules.json, made from
// vocabularies.json): well-formed XML (E-SVG-PARSE), the root (E-SVG-ROOT), the closed SVG subset and addresses
// (E-SVG-UNSAFE, E-A11Y-OWNED), limits (E-SVG-LIMIT), marks and their values (E-MARK-UNKNOWN, E-MARK-VALUE,
// W-MARK-ALIAS, E-KIND, E-PLACE, E-LOOK, E-PIVOT, E-MOTION-RANGE, E-COLOR-ROLE), and ids (E-ID-DUPLICATE, E-ID-SHAPE).
// Geometry checks (E-PAINT, fit) and checks against the owning document belong to the checker and engine.
// Plain ES module; the only import is the XML reader beside it.
import { parseXml } from './xml.mjs';
import { motionEntries, motionDots } from '../src/physics.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const NUM = /^[+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/;
// Today's 2.0 marks and the common wrong guesses, each with the final form (D33 to D38): E-WORD-RENAMED.
const M = 'data-hsvg-';
const FIT = { fit: '', 'layout-plan': '="items"', video: '="video"' };
const OLD_MARKS = {
  look: () => `${M}variant`, follows: () => `${M}follow`, 'color-role': () => `${M}color`,
  'type-role': (v) => `${M}text-style="${{ display: 'heading', text: 'body' }[v] ?? v}"`, paint: (v) => `${M}layer="${v}"`,
  region: (v) => (v === 'repeat' ? `${M}repeat` : `${M}fit${FIT[v] ?? ''}`), side: (v) => `the side as a role word, as ${M}role="hand ${v}"`,
  'safe-area': (v) => `${M}role="${v}" on the unpainted <rect>`, icon: () => `${M}role="icon": an icon is a <symbol> named by its id; an icon place is a part with role icon`,
  anchor: () => `an empty <g ${M}slot="<name>"> inside the part, placed at the point (player.attach names the slot)`,
  derived: () => 'the tool record in <metadata>, as <metadata>{"derived": "derived"}</metadata>', steps: () => 'the tool record in <metadata>, as <metadata>{"derived": "derived", "steps": "<rule>:<step>"}</metadata>',
  part: () => `${M}kind="part"`, name: () => `${M}label`, type: () => `${M}kind`, place: () => `${M}slot, ${M}fit or ${M}route`,
};
// Today's motion channels (6.2.1): the mark writes the JSON words.
const OLD_CHANNELS = { 'translate-x': 'move-x', 'translate-y': 'move-y', translate: 'move-x and move-y, each with its range', skew: 'lean', dash: 'draw', 'stroke-width': 'line' };

// opts: { addons: {13: true} to read the A13 mark aliases, file: name for messages }
export function checkDrawing(text, rules, opts = {}) {
  const diags = [];
  const add = (code, el, message) => diags.push({ code, path: el ? `<${el.name}${el.attrs?.id ? ` id="${el.attrs.id}"` : ''}> line ${el.line}` : '(file)', message });
  const L = rules.limits;
  if (text.length > L.charactersPerDrawing) { add('E-SVG-LIMIT', null, `more than ${L.charactersPerDrawing} characters`); return { diags }; }
  let root;
  try { root = parseXml(text); } catch (e) { add('E-SVG-PARSE', null, e.message); return { diags }; }

  const aliases = opts.addons?.[13] ? (opts.markAliases || null) : null;
  const allowed = new Set(rules.elements.allowed);
  const refused = new Set(rules.elements.refused);
  const A = rules.attributes;
  const common = new Set(A.common);
  const pres = new Set(A.presentation);
  const styleOnly = new Set(A.styleOnly);
  const styleRootOnly = new Set(A.styleRootOnly);
  const toolData = new RegExp(A.toolData);
  const events = new RegExp(A.refusedPatterns.events);
  const owned = new RegExp(A.refusedPatterns.playerOwned);
  const idRe = new RegExp(rules.idGrammar);
  const pageMarks = new Set(rules.pageMarksRefused);

  // Root.
  if (root.name !== 'svg') { add('E-SVG-ROOT', root, 'the root is not <svg>'); return { diags, root }; }
  if (root.attrs.xmlns !== SVG_NS) add('E-SVG-ROOT', root, 'the root is not in the SVG namespace');
  const vb = (root.attrs.viewBox || '').trim().split(/[\s,]+/).map(Number);
  if (vb.length !== 4 || !vb.every(Number.isFinite) || !(vb[2] > 0) || !(vb[3] > 0)) add('E-SVG-ROOT', root, 'the root has no finite viewBox with positive width and height');
  const ver = root.attrs['data-hsvg-version'];
  if (/^2\.[1-9][0-9]*$/.test(String(ver ?? '')) && !rules.version.includes(ver)) add('E-VERSION-NEWER', root, `this drawing is version ${ver}, newer than this engine (2.0): play it with an engine of that version`);
  else if (!rules.version.includes(ver)) add('E-SVG-ROOT', root, `data-hsvg-version must be ${rules.version.join(' or ')}, found ${JSON.stringify(ver)}`);
  if (/\bslice\b/.test(root.attrs.preserveAspectRatio || '')) add('E-SVG-ROOT', root, 'the root uses preserveAspectRatio with slice');
  if ((root.attrs.width !== undefined) !== (root.attrs.height !== undefined)) add('E-SVG-ROOT', root, 'width and height go together');
  if (root.attrs.width !== undefined && vb.length === 4 && (Number(root.attrs.width) !== vb[2] || Number(root.attrs.height) !== vb[3])) add('E-SVG-ROOT', root, 'an exact-size frame sets width and height equal to its viewBox size (6.6)');

  // Walk.
  const all = [];
  const byId = new Map();
  let styleUnits = 0;
  let applications = 0;
  const walk = (el, parent, depth, ctx) => {
    el.parent = parent;
    all.push(el);
    const isRoot = el === root;
    if (el.name.includes(':')) add('E-SVG-UNSAFE', el, `element ${el.name} is in another namespace`);
    else if (refused.has(el.name) || !allowed.has(el.name)) add('E-SVG-UNSAFE', el, `element <${el.name}> is not in the allowed subset`);
    const by = new Set(A.byElement[el.name] || []);
    for (const a of el.attrOrder) {
      const v = el.attrs[a];
      if (a === 'xmlns') { if (v !== SVG_NS) add('E-SVG-UNSAFE', el, `xmlns ${v} is not the SVG namespace`); continue; }
      if (a.startsWith('xmlns:')) { if (a !== 'xmlns:xlink' || v !== XLINK_NS) add('E-SVG-UNSAFE', el, `namespace ${a} is refused`); continue; }
      if (events.test(a)) { add(A.refusedCodes.events, el, `event attribute ${a}`); continue; }
      if (owned.test(a)) { add(A.refusedCodes.playerOwned, el, `${a} is owned by the player`); continue; }
      if (a.startsWith('data-hsvg-')) { mark(el, a, v, isRoot); continue; }
      if (toolData.test(a)) continue;
      if (common.has(a) || a in A.aliases || pres.has(a) || by.has(a)) continue;
      add('E-SVG-UNSAFE', el, `attribute ${a} is not allowed on <${el.name}>`);
    }
    if (el.attrs.id !== undefined) {
      if (byId.has(el.attrs.id)) add('E-ID-DUPLICATE', el, `id ${el.attrs.id} is used twice`);
      else byId.set(el.attrs.id, el);
    }
    if (el.attrs.style !== undefined) { styleUnits += el.attrs.style.length; style(el, el.attrs.style, isRoot); }
    if (el.attrs.filter !== undefined || el.attrs.mask !== undefined) applications++;
    for (const c of el.children) if (c.name) walk(c, el, depth + 1, ctx);
  };

  const motionCodes = (el, v) => {
    const spec = rules.marks['data-hsvg-motion'].value;
    // Ranges with two dots, split by semicolons (D31.3): "scale 1..1.2; rotate -6..6; rotate *".
    const entries = motionEntries(v);
    if (!entries) {
      // The old spelling, shown in the final channel names: translate gives both move axes.
      const dots = motionDots(v)?.split('; ').flatMap(e => { const [c, r] = e.split(' '); return c === 'translate' ? [`move-x ${r}`, `move-y ${r}`] : [`${OLD_CHANNELS[c] ?? c} ${r}`]; }).join('; ') ?? null;
      add('E-MARK-VALUE', el, dots !== null
        ? `data-hsvg-motion ${JSON.stringify(v)} is the old spelling; write "${dots}": each channel, then its range with two dots, split by semicolons (6.2.1)`
        : `data-hsvg-motion ${JSON.stringify(v)} is not a list of channel ranges, as "scale 1..1.2; rotate -6..6; move-y -60..0" (6.2.1)`);
      return;
    }
    const seen = new Set();
    for (const e of entries) {
      const ch = e.channel;
      const t = e.free ? `${ch} *` : `${ch} ${e.lo}..${e.hi}`;
      const c = spec.channels[ch];
      if (!c && OLD_CHANNELS[ch]) { add('E-WORD-RENAMED', el, `the motion channel ${ch} is now ${OLD_CHANNELS[ch]} (D33)`); continue; }
      if (!c) { add('E-MARK-VALUE', el, `unknown motion channel ${ch}; the channels are ${Object.keys(spec.channels).join(', ')} (6.2.1)`); continue; }
      if (seen.has(ch)) add('E-MARK-VALUE', el, `channel ${ch} given twice`);
      seen.add(ch);
      if (e.free) {
        if (!c.forms.some(f => / \*$/.test(f))) { add('E-MARK-VALUE', el, `${t} is not ${c.forms.join(' or ')}`); continue; }
        if (c.needsPivot && el.attrs['data-hsvg-pivot'] === undefined) add('E-PIVOT', el, `${ch} needs a pivot`);
        continue;
      }
      if (e.lo > e.hi) add('E-MOTION-RANGE', el, `${t}: min is above max`);
      if (c.minimum !== undefined && e.lo < c.minimum) add('E-MOTION-RANGE', el, `${t}: below ${c.minimum}`);
      if (c.maximum !== undefined && e.hi > c.maximum) add('E-MOTION-RANGE', el, `${t}: above ${c.maximum}`);
      if (typeof c.contains === 'number' && !(e.lo <= c.contains && c.contains <= e.hi)) add('E-MOTION-RANGE', el, `${t}: the range must contain ${c.contains}, the drawn value`);
      if (c.needsPivot && el.attrs['data-hsvg-pivot'] === undefined) add('E-PIVOT', el, `${ch} needs a pivot`);
      if (c.requires && /pathLength/.test(c.requires) && el.attrs.pathLength !== '1') add('E-MARK-VALUE', el, `${ch} requires pathLength="1"`);
    }
    if (el.attrs.transform !== undefined) add('E-MOVER-TRANSFORM', el, 'a part with data-hsvg-motion carries no transform (6.2.1)');
    for (const x of spec.scaleExcludes || []) if (seen.has('scale') && seen.has(x)) add('E-MARK-VALUE', el, `scale and ${x} together`);
  };

  const mark = (el, a, v, isRoot) => {
    const m = rules.marks[a];
    if (!m) {
      if (aliases && aliases[a]) { add(aliases.code || 'W-MARK-ALIAS', el, `${a} is an earlier mark read as an alias (A13)`); return; }
      const old = OLD_MARKS[a.slice(M.length)];
      if (old) { add('E-WORD-RENAMED', el, `${a} is now ${old(v)} (D33)`); return; }
      add('E-MARK-UNKNOWN', el, pageMarks.has(a) ? `${a} is a page hook mark, never a drawing mark` : `${a} is not a 2.0 mark`);
      return;
    }
    const code0 = m.codes[0];
    const valueCode = m.codes.includes('E-MARK-VALUE') ? 'E-MARK-VALUE' : code0;
    const kinds = m.on.kinds;
    const elOk = m.on.elements.includes('*') || m.on.elements.includes(el.name);
    if (kinds.includes('root') && !isRoot) add(code0, el, `${a} belongs on the root <svg>`);
    else if (!elOk) add(code0, el, `${a} is not allowed on <${el.name}>`);
    const val = m.value;
    switch (val.type) {
      case 'enum': if (!val.values.includes(v)) add(valueCode, el, a === 'data-hsvg-kind' && v === 'compound' ? 'data-hsvg-kind="compound" is now component (D31): write data-hsvg-kind="component"; its top-level parts are its members, as before' : `${a}=${JSON.stringify(v)} is not one of ${val.values.map(x => (x === '' ? '(no value)' : x)).join(', ')}`); break;
      case 'text': if (v.trim().length < (val.minLength || 0)) add(valueCode, el, `${a} is empty`); break;
      case 'channel-ranges': motionCodes(el, v); break;
      case 'role-words': { // one role word, then a side, or protected-area words on an unpainted <rect> (6.3, 5.10)
        if (!new RegExp(val.pattern).test(v) || v.length > val.maxLength) { add(valueCode, el, `${a}=${JSON.stringify(v)} is not well formed: one role word, then a side (${val.sides.join(', ')}) or protected-area words`); break; }
        const w = v.split(' '); const sides = w.filter(x => val.sides.includes(x)); const keeps = val.keeps.filter(x => w.includes(x));
        const roles = w.filter(x => !val.sides.includes(x) && !val.keeps.includes(x));
        if (roles.length > 1) add(valueCode, el, `${a}="${v}": one role word, not ${roles.join(' and ')}; a side (${val.sides.join(', ')}) or protected-area words may follow`);
        if (sides.length > 1) add(valueCode, el, `${a}="${v}": one side word, not ${sides.join(' and ')}`);
        if (keeps.length > 1 && !val.keepPairs.includes(keeps.join(' '))) add(valueCode, el, `${a}="${v}": a protected area is keep-inside, keep-clear, keep-empty, or keep-inside with keep-clear`);
        if (keeps.length && (el.name !== val.keepOn || (el.attrs.fill !== 'none' && !/(^|;)\s*fill\s*:\s*none/.test(el.attrs.style || '')))) add('E-PLACE', el, `a protected area (${keeps.join(' ')}) is an unpainted <rect> (fill="none")`);
        break;
      }
      case 'color-role': {
        const re = new RegExp(val.pattern.replace(/R/g, `(?:${val.patternWhere.R})`));
        if (!re.test(v)) add(code0, el, `${a}=${JSON.stringify(v)} is not a colour role, or fill:/stroke: roles`);
        break;
      }
      default:
        if (val.pattern && !new RegExp(val.pattern).test(v)) add(valueCode, el, `${a}=${JSON.stringify(v)} is not well formed`);
        if (val.maxLength && v.length > val.maxLength) add(valueCode, el, `${a} is longer than ${val.maxLength}`);
    }
    if (m.elementByValue && m.elementByValue[v] && m.elementByValue[v] !== el.name) add(code0, el, `${a}="${v}" goes on <${m.elementByValue[v]}>`);
  };

  const POS = new Set(['position', 'z-index', 'inset', 'top', 'left', 'right', 'bottom']);
  const style = (el, s, isRoot) => {
    if (/@import/i.test(s) || s.includes('/*')) { add('E-SVG-UNSAFE', el, 'style holds @import or a comment'); return; }
    if (!cssPlain(el, 'style', s)) return;
    for (const decl of s.split(';')) {
      if (!decl.trim()) continue;
      const k = decl.indexOf(':');
      if (k < 0) { add('E-SVG-UNSAFE', el, `style declaration ${JSON.stringify(decl.trim())} is not plain`); continue; }
      const prop = decl.slice(0, k).trim().toLowerCase();
      const val = decl.slice(k + 1).trim();
      if (prop.startsWith('--')) add('E-SVG-UNSAFE', el, `custom property ${prop} is refused`);
      else if (POS.has(prop)) add('E-SVG-UNSAFE', el, `positioning property ${prop} is refused`);
      else if (!(pres.has(prop) || styleOnly.has(prop) || (isRoot && styleRootOnly.has(prop)))) add('E-SVG-UNSAFE', el, `style property ${prop} is not allowed`);
      urls(el, val);
    }
  };
  // An allowlist: every url( must open exactly url(#id), url('#id') or url("#id"). Anything else (a remote address,
  // unpaired quotes) is refused, so no quoting trick can hide an address from this test.
  const LOCAL_URL = /^url\(\s*(?:#[^\s'"()\\]+|'#[^\s'"()\\]+'|"#[^\s'"()\\]+")\s*\)/i;
  const urls = (el, v) => {
    for (const m of v.matchAll(/url\(/gi)) {
      if (LOCAL_URL.test(v.slice(m.index))) continue;
      add('E-SVG-UNSAFE', el, `${JSON.stringify(v.slice(m.index, m.index + 60))} is not a local url(#id)`);
    }
  };
  // CSS text (style, presentation attributes) must be plain: CSS decodes a backslash escape before it reads a function
  // name (u\72l( is url(), so a backslash is refused; image functions that take a bare string address are refused too.
  const IMAGE_FN = /(?:^|[^a-z0-9_-])(?:-webkit-|-moz-)?(?:image-set|image|cross-fade|element|src)\s*\(/i;
  const cssPlain = (el, a, v) => {
    if (v.includes('\\')) { add('E-SVG-UNSAFE', el, `${a} holds a backslash (a CSS escape)`); return false; }
    if (IMAGE_FN.test(v)) { add('E-SVG-UNSAFE', el, `${a} holds an image function that can load an address`); return false; }
    return true;
  };

  walk(root, null, 0, {});

  // Attribute addresses and url(...).
  for (const el of all) {
    for (const a of el.attrOrder) {
      const v = el.attrs[a];
      if (a !== 'style' && pres.has(a) && !cssPlain(el, a, v)) continue;
      if (a !== 'style' && /url\(/i.test(v)) urls(el, v);
      if (a === 'href' || a === 'xlink:href') {
        if (el.name === 'image') {
          // As a browser reads an address: tab, CR and LF are removed anywhere, C0 controls and spaces at the ends.
          const v = urlAsRead(el.attrs[a]);
          const dm = /^data:([a-z0-9.+/-]+)[;,]/i.exec(v);
          if (dm) { if (!L.imageDataTypes.includes(dm[1].toLowerCase())) add('E-SVG-UNSAFE', el, `data: type ${dm[1]} is not an image type`); }
          else if (/^[a-z][a-z0-9+.-]*:/i.test(v) || v.startsWith('/') || v.includes('\\') || v.startsWith('//')) add('E-SVG-UNSAFE', el, `image address ${v} is not a data: URI or a relative path`);
        } else if (!/^#.+/.test(v)) add('E-SVG-UNSAFE', el, `${a} ${v} is not a local #id`);
        else if (el.name === 'use' && !byId.has(v.slice(1))) add('E-SVG-UNSAFE', el, `${a} ${v} names no element`);
      }
    }
  }

  // The tool record (6.6): at most one <metadata>, a direct child of the root, holding one JSON object.
  const metas = all.filter(el => el.name === 'metadata');
  const TR = rules.toolRecord;
  if (metas.length > 1) add('E-MARK-VALUE', metas[1], 'a drawing has one <metadata>');
  for (const el of metas) {
    if (el.parent !== root) { add('E-MARK-VALUE', el, '<metadata> is a direct child of the root <svg> (6.6)'); continue; }
    if (el.children.some(c => c.name)) { add('E-MARK-VALUE', el, '<metadata> holds one JSON object, no elements (6.6)'); continue; }
    let j = null; try { j = JSON.parse(el.children.map(c => c.text ?? '').join('')); } catch { /* below */ }
    if (!j || typeof j !== 'object' || Array.isArray(j)) { add('E-MARK-VALUE', el, '<metadata> holds the tool record as one JSON object, as {"derived": "derived", "steps": "<rule>:<step>"} (6.6)'); continue; }
    for (const [k, x] of Object.entries(j)) {
      const spec = TR.keys[k];
      if (!spec) add('E-MARK-VALUE', el, `the tool record holds ${Object.keys(TR.keys).join(' and ')}, not ${k} (6.6)`);
      else if (spec.type === 'object' && (!x || typeof x !== 'object' || Array.isArray(x))) add('E-MARK-VALUE', el, `the tool record's ${k} is one JSON object`);
      else if (spec.enum && !spec.enum.includes(x)) add('E-MARK-VALUE', el, `the tool record's ${k} is ${spec.enum.join(' or ')}, not ${JSON.stringify(x)}`);
      else if (spec.pattern && (typeof x !== 'string' || !new RegExp(spec.pattern).test(x) || x.length > spec.maxLength)) add('E-MARK-VALUE', el, `the tool record's ${k} ${JSON.stringify(x)} is not well formed`);
    }
  }

  // Limits.
  if (all.length > L.elementsPerDrawing) add('E-SVG-LIMIT', root, `${all.length} elements, more than ${L.elementsPerDrawing}`);
  if (styleUnits > L.styleUnits) add('E-SVG-LIMIT', root, `style text over ${L.styleUnits} units`);
  if (applications > L.filterOrMaskApplications) add('E-SVG-LIMIT', root, `${applications} filter or mask applications, more than ${L.filterOrMaskApplications}`);
  const sizeOf = new Map();
  const expand = (el, stack) => {
    if (sizeOf.has(el)) return sizeOf.get(el);
    let n = 1;
    if (el.name === 'use') {
      const t = byId.get((el.attrs.href || el.attrs['xlink:href'] || '').slice(1));
      if (t) {
        if (stack.includes(t) || stack.length >= L.useNesting) { add('E-SVG-LIMIT', el, stack.includes(t) ? '<use> references form a cycle' : `more than ${L.useNesting} nested <use>`); return Infinity; }
        n += expand(t, [...stack, t]);
      }
    }
    for (const c of el.children) if (c.name) n += expand(c, stack);
    sizeOf.set(el, n);
    return n;
  };
  const total = expand(root, []);
  if (Number.isFinite(total) && total > L.expandedElements) add('E-SVG-LIMIT', root, `${total} elements once <use> is expanded, more than ${L.expandedElements}`);
  for (const el of all) {
    if (el.name === 'filter') { const n = el.children.filter(c => c.name && c.name.startsWith('fe')).length; if (n > L.filterPrimitives) add('E-SVG-LIMIT', el, `${n} filter primitives, more than ${L.filterPrimitives}`); }
    const range = (attr, [lo, hi]) => { if (el.attrs[attr] === undefined) return; for (const x of el.attrs[attr].trim().split(/[\s,]+/).map(Number)) if (!(x >= lo && x <= hi)) add('E-SVG-LIMIT', el, `${attr} ${el.attrs[attr]} is outside ${lo}..${hi}`); };
    if (el.name === 'feGaussianBlur' || el.name === 'feDropShadow') range('stdDeviation', L.stdDeviationRange);
    if (el.name === 'feMorphology') range('radius', L.morphologyRadiusRange);
    if (el.name === 'feTurbulence') range('numOctaves', L.numOctavesRange);
  }

  // An icon set (2.6, 6.2.2) is no component or screen: each <symbol data-hsvg-role="icon"> is named by its id and has
  // a viewBox; the drawing form and the namespace rules do not apply.
  if (opts.iconSet) {
    for (const el of all) if (el.name === 'symbol' && /(^| )icon( |$)/.test(el.attrs['data-hsvg-role'] || '')) {
      if (!idRe.test(el.attrs.id || '')) add('E-ID-SHAPE', el, 'an icon is named by its id, in the id grammar (clock, arrow-left)');
      if (el.attrs.viewBox === undefined) add('E-PLACE', el, 'an icon <symbol> has a viewBox');
    }
    return { diags, root, form: 'icon-set' };
  }
  // Drawing form (2.10) and ids (2.12).
  const rootKind = root.attrs['data-hsvg-kind'];
  const form = rootKind === 'screen' ? 'screen' : 'component';
  if (rootKind !== undefined && rootKind !== 'screen') add('E-KIND', root, `the root may carry only data-hsvg-kind="screen", found ${rootKind}`);
  let namespace = null;
  if (form === 'component') {
    const drawn = root.children.filter(c => c.name && !['title', 'desc', 'defs', 'metadata'].includes(c.name));
    const top = drawn[0];
    if (drawn.length !== 1 || top.name !== 'g' || !['component', 'compound'].includes(top.attrs['data-hsvg-kind'])) { // compound: its own finding above
      add('E-KIND', root, 'a component drawing holds exactly one top-level <g> marked component, beside only <title>, <desc>, <metadata> and <defs>');
    } else {
      if (top.attrs.transform !== undefined) add('E-KIND', top, 'the component <g> carries no transform');
      namespace = top.attrs.id;
      if (!namespace || !idRe.test(namespace) || namespace.length > rules.idMaxLength) add('E-ID-SHAPE', top, 'the component root needs an id in the id grammar: its namespace');
    }
    for (const el of all) if (el !== top && el.parent && el.attrs['data-hsvg-kind'] === 'component' && insideOf(el, top)) add('E-KIND', el, 'a component inside another component');
  }
  for (const el of all) {
    const id = el.attrs.id;
    if (id === undefined) continue;
    if (form === 'component' && namespace) {
      if (id === namespace) continue;
      const parts = id.split('__');
      if (parts.length !== 2 || parts[0] !== namespace || !idRe.test(parts[1]) || parts[1].length > rules.idMaxLength) add('E-ID-SHAPE', el, `id ${id} is not ${namespace}__<local>`);
    } else if (form === 'screen') {
      const inCopy = ancestorSvg(el, root);
      if (inCopy) continue;
      if (!idRe.test(id) || id.length > rules.idMaxLength) add('E-ID-SHAPE', el, `id ${id} does not follow the id grammar`);
    }
  }
  // Parts (4.1): a part has an id; a job without the kind is read as a part, with a warning.
  const JOBS = ['data-hsvg-motion', 'data-hsvg-follow', 'data-hsvg-slot', 'data-hsvg-fit', 'data-hsvg-repeat',
    'data-hsvg-route', 'data-hsvg-role', 'data-hsvg-label', 'data-hsvg-text-style'];
  for (const el of all) {
    const k = el.attrs['data-hsvg-kind'];
    if (k === 'part' && el.attrs.id === undefined) add('E-ID-SHAPE', el, 'a part has an id');
    if (k !== undefined || el === root || el.attrs['data-hsvg-variant'] !== undefined) continue;
    const job = JOBS.find(j => el.attrs[j] !== undefined) || (el.attrs['data-hsvg-pivot'] !== undefined ? 'data-hsvg-pivot' : null);
    if (job && !(job === 'data-hsvg-role' && el.name === 'symbol')) add('W-KIND-MISSING', el, `${job} without data-hsvg-kind: read as a part`);
  }
  // Places and looks.
  const slots = new Set();
  for (const el of all) {
    const s = el.attrs['data-hsvg-slot'];
    if (s !== undefined) { if (slots.has(s)) add('E-PLACE', el, `slot ${s} is named twice`); slots.add(s); }
    if (el.attrs['data-hsvg-variant'] !== undefined) {
      const p = el.parent;
      if (!p || p.attrs['data-hsvg-kind'] !== 'part') add('E-LOOK', el, 'a variant is a direct child <g> of a part');
      for (const bad of ['data-hsvg-pivot', 'data-hsvg-motion', 'transform']) if (el.attrs[bad] !== undefined) add('E-LOOK', el, `a variant child carries no ${bad}`);
    }
  }
  for (const el of all) {
    const looks = el.children.filter(c => c.name && c.attrs['data-hsvg-variant'] !== undefined);
    if (!looks.length) continue;
    const names = looks.map(c => c.attrs['data-hsvg-variant']);
    if (looks.length < 2) add('E-LOOK', el, 'a part with variants has at least two');
    if (new Set(names).size !== names.length) add('E-LOOK', el, 'a variant name is repeated');
    const shown = looks.filter(c => c.attrs.display !== 'none');
    if (shown.length !== 1) add('E-LOOK', el, `exactly one variant (the rest variant) is shown without display="none"; found ${shown.length}`);
  }
  return { diags, root, form, namespace };
}

// An address as the URL parser reads it (WHATWG URL: strip leading and trailing C0 controls and spaces, remove every
// tab, CR and LF), so `java&#9;script:` meets the scheme test as `javascript:`.
const urlAsRead = (v) => String(v).replace(/[\t\n\r]/g, '').replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '');
function insideOf(el, top) { for (let p = el.parent; p; p = p.parent) if (p === top) return true; return false; }
function ancestorSvg(el, root) { for (let p = el.parent; p && p !== root; p = p.parent) if (p.name === 'svg') return true; return el !== root && el.name === 'svg'; }
