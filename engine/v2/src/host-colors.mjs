// Host colours (7.7.1, 10.6; experimental, added after 2.0.0-next.0): a host passes colours for some or all of the
// experience's colour roles at mount. They are checked here, before the first paint, against the contrast rules every
// declared theme keeps (7.7). All or nothing: when the set passes, the drawing takes it on top of the active theme;
// when anything is wrong, the author's theme stays as it is and the host hears one warning.
// Pure functions: no DOM.
//
// hostColors(exp, colors, theme) -> {roles, warnings}
//   exp: the experience as the player holds it ({doc, scenes, blocks, shell}); colors: {role: '#rrggbb'};
//   theme: the host's theme pick, or undefined (then every declared theme with colour roles is checked, since an
//   input may switch between them at play).
//   roles: the accepted colours, or null; warnings: [{code, message, source: 'host', ...}].
//   - W-HOST-COLOR-VALUE: colors is not an object of roles, a role is not one of the experience's colour roles, or a
//     value is not a six-digit hex colour. Names the role and the value.
//   - W-HOST-COLOR-CONTRAST: a pair is under its ratio in a theme. Names the pair, the theme, the ratio and the needed
//     ratio (the first failing pair; `pairs` lists every one).
// The pairs (7.7): ink, muted, success, warning and danger on surface 4.5:1; accent-2 on surface 3:1; every role
// on-<role> on <role> 4.5:1; each text style's colour on surface and its text on its highlight at the text ratio
// (8.9: the strictest `contrast` rule without `against`, else 4.5:1); and each of the documents' own `contrast` rules
// whose subject is `color:<role>` against a role. Only pairs with a host colour on one side are checked: the others
// are the author's, proven by the checker.

const HEX = /^#[0-9a-fA-F]{6}$/;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const own = (o, k) => isObj(o) && Object.hasOwn(o, k);
const BASE = [['ink', 'surface', 4.5], ['muted', 'surface', 4.5], ['success', 'surface', 4.5], ['warning', 'surface', 4.5], ['danger', 'surface', 4.5], ['accent-2', 'surface', 3]];

// WCAG 2.2 contrast of two six-digit hex colours (8.9); null when either is not one.
export function contrast(a, b) {
  const lum = (hex) => {
    if (!HEX.test(String(hex))) return null;
    const c = [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const x = lum(a); const y = lum(b);
  return x === null || y === null ? null : (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// A theme's colour roles, with `extends` (7.7), or null when it has none.
export function themeRoles(doc, name) {
  const t = doc?.themes?.[name];
  if (!isObj(t)) return null;
  const base = t.extends && isObj(doc.themes[t.extends]) ? doc.themes[t.extends].colorRoles : null;
  return isObj(t.colorRoles) || isObj(base) ? { ...(isObj(base) ? base : {}), ...(isObj(t.colorRoles) ? t.colorRoles : {}) } : null;
}

// The pairs every theme keeps, for the roles given: [[text, ground, ratio]].
function pairsOf(exp, roles) {
  const docs = [exp?.doc, ...Object.values(exp?.scenes || {}).map(s => s?.doc), ...Object.values(exp?.blocks || {}).map(b => b?.doc), exp?.shell?.doc];
  const rules = docs.flatMap(d => (Array.isArray(d?.rules) ? d.rules : [])).filter(r => r?.kind === 'contrast' && typeof r.ratio === 'number' && r.ratio > 0);
  const text = Math.max(4.5, ...rules.filter(r => r.against === undefined).map(r => r.ratio));
  const out = [...BASE];
  for (const r of Object.keys(roles)) if (r.startsWith('on-') && own(roles, r.slice(3))) out.push([r, r.slice(3), 4.5]);
  const styles = { strong: {}, emphasis: {}, ...(isObj(exp?.doc?.addons?.['rich-text']?.styles) ? exp.doc.addons['rich-text'].styles : {}) };
  for (const s of Object.values(styles)) {
    const ink = typeof s?.colorRole === 'string' ? s.colorRole : 'ink';
    out.push([ink, 'surface', text]);
    if (typeof s?.highlightRole === 'string') out.push([ink, s.highlightRole, text]);
  }
  for (const r of rules) {
    const m = /^color:(.+)$/.exec(typeof r.subject === 'string' ? r.subject : '');
    if (m && typeof r.against === 'string') out.push([m[1], r.against.replace(/^color:/, ''), r.ratio]);
  }
  const most = new Map(); // one entry per pair, at its highest ratio
  for (const [a, b, n] of out) most.set(`${a}\n${b}`, Math.max(n, most.get(`${a}\n${b}`) ?? 0));
  return [...most].map(([k, n]) => [...k.split('\n'), n]);
}

export function hostColors(exp, colors, theme) {
  const doc = exp?.doc || {};
  const warn = (code, message, extra = {}) => ({ roles: null, warnings: [{ code, message, source: 'host', ...extra }] });
  if (!isObj(colors)) return warn('W-HOST-COLOR-VALUE', `colors is an object of colour roles, such as {accent: '#d84315'}; it is ${colors === null ? 'null' : Array.isArray(colors) ? 'a list' : typeof colors}. The author's colours stay.`);
  const names = theme !== undefined && theme !== null ? [theme] : Object.keys(isObj(doc.themes) ? doc.themes : {});
  const themes = names.map(n => [n, themeRoles(doc, n)]).filter(([, r]) => r);
  const known = new Set(themes.flatMap(([, r]) => Object.keys(r)));
  for (const [role, value] of Object.entries(colors)) {
    if (!known.has(role)) return warn('W-HOST-COLOR-VALUE', `${JSON.stringify(role)} is not one of the experience's colour roles (${[...known].join(', ') || 'it has none'}). The author's colours stay.`, { role });
    if (typeof value !== 'string' || !HEX.test(value)) return warn('W-HOST-COLOR-VALUE', `${role}: ${JSON.stringify(value)} is not a six-digit hex colour such as #d84315. The author's colours stay.`, { role, value });
  }
  const failing = [];
  for (const [name, roles] of themes) {
    const merged = { ...roles, ...colors };
    for (const [a, b, need] of pairsOf(exp, merged)) {
      if (!own(colors, a) && !own(colors, b)) continue;
      const ratio = contrast(merged[a], merged[b]);
      if (ratio !== null && ratio < need) failing.push({ pair: `${a} on ${b}`, theme: name, ratio: Math.floor(ratio * 100) / 100, need });
    }
  }
  if (failing.length) {
    const f = failing[0];
    return warn('W-HOST-COLOR-CONTRAST', `${f.pair} is ${f.ratio.toFixed(2)}:1 in theme ${f.theme}, under ${f.need}:1 (7.7)${failing.length > 1 ? `, and ${failing.length - 1} more` : ''}. The author's colours stay.`, { ...f, pairs: failing });
  }
  return { roles: { ...colors }, warnings: [] };
}
