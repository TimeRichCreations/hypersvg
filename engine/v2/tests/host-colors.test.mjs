// Host colours (7.7.1, 10.6; experimental): the contrast check at mount, all or nothing, and the drawing that takes a
// checked set on top of the active theme. Parts without a colour role keep their drawn paint.
import { Player } from '../src/story.mjs';
import { Drawing } from '../src/drawing.mjs';
import { hostColors, contrast, themeRoles } from '../src/host-colors.mjs';
import { colorsText } from '../web/asset-lean.mjs';
import { eq, ok } from './helpers.mjs';

const DAY = { surface: '#fff4d8', ink: '#153b4b', accent: '#e6af42', 'accent-2': '#168e91', muted: '#4f6b73', success: '#2e7d4f', warning: '#8a5a00', danger: '#b3261e', 'on-accent': '#1d2238' };
const NIGHT = { surface: '#10212b', ink: '#fff4d8', muted: '#bfe4de', success: '#6fcf97', warning: '#f2c94c', danger: '#ff8a80' };
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" data-hsvg-version="2.0" data-hsvg-kind="screen">
  <rect id="ground" width="200" height="100" data-hsvg-color="surface" fill="#000000"/>
  <rect id="badge" data-hsvg-kind="part" width="40" height="20" data-hsvg-color="accent" fill="#000000"/>
  <text id="label" data-hsvg-kind="part" x="4" y="14" data-hsvg-color="on-accent" fill="#000000">Go</text>
  <path id="logo" data-hsvg-kind="part" d="M0 0h10v10z" fill="#e30613"/>
</svg>`;

function expOf(extra = {}) {
  return {
    doc: { format: 'hsvg/2.0', kind: 'experience', id: 't', language: 'en', theme: 'day', themes: { day: { colorRoles: { ...DAY } }, night: { extends: 'day', colorRoles: { ...NIGHT } } }, story: { start: 'one', scenes: { one: 'one.json' } }, ...extra },
    words: { en: {} }, data: {},
    scenes: { one: { doc: { format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg' }, drawings: { main: { text: SVG } }, words: {} } },
    blocks: {},
  };
}
function drawn(opts, extra) {
  const p = new Player(expOf(extra));
  ok(p.start().ok);
  const d = new Drawing(p, opts);
  d.mountScene('one');
  return (local) => d.frames.one.byLocal.get(local).attrs.fill;
}
const one = (r) => { eq(r.warnings.length, 1, JSON.stringify(r.warnings)); return r.warnings[0]; };

export const tests = {
  'contrast is the WCAG 2.2 ratio of two six-digit hex colours; anything else is null'() {
    eq(Math.round(contrast('#000000', '#ffffff') * 100) / 100, 21);
    eq(contrast('#777777', '#777777'), 1);
    eq(contrast('#fff', '#000000'), null);
    eq(contrast('red', '#000000'), null);
  },
  'themeRoles follows extends (7.7)'() {
    const r = themeRoles(expOf().doc, 'night');
    eq(r.accent, DAY.accent); eq(r.surface, NIGHT.surface);
    eq(themeRoles(expOf().doc, 'none'), null);
  },
  'a passing set is accepted whole, with no warning'() {
    const r = hostColors(expOf(), { accent: '#bf360c', 'on-accent': '#ffffff' }, 'day');
    eq(r.warnings, []);
    eq(r.roles, { accent: '#bf360c', 'on-accent': '#ffffff' });
    // The same brand orange one shade lighter is 4.44:1 under white: refused.
    eq(one(hostColors(expOf(), { accent: '#d84315', 'on-accent': '#ffffff' }, 'day')).pair, 'on-accent on accent');
  },
  'a failing pair refuses the whole set: W-HOST-COLOR-CONTRAST names the pair, the theme and the ratio'() {
    const r = hostColors(expOf(), { accent: '#d84315', ink: '#999999' }, 'day');
    eq(r.roles, null, 'never a half-applied set: the good accent is not taken either');
    const w = one(r);
    eq(w.code, 'W-HOST-COLOR-CONTRAST'); eq(w.source, 'host');
    eq(w.pair, 'ink on surface'); eq(w.theme, 'day'); eq(w.need, 4.5);
    ok(w.ratio < 4.5 && w.ratio > 2, String(w.ratio));
    ok(w.message.includes('ink on surface') && w.message.includes(`${w.ratio.toFixed(2)}:1`) && w.message.includes('4.5:1'), w.message);
  },
  'a partial set is checked against the theme it lands on: a new surface must suit the author\'s ink'() {
    const w = one(hostColors(expOf(), { surface: '#203040' }, 'day'));
    eq(w.code, 'W-HOST-COLOR-CONTRAST'); eq(w.pair, 'ink on surface');
    ok(w.pairs.length > 1, 'every failing pair is listed');
    ok(w.message.includes('more'), w.message);
  },
  'only pairs with a host colour are checked: the author\'s own pairs are the checker\'s'() {
    const exp = expOf();
    exp.doc.themes.day.colorRoles.muted = '#bbbbbb'; // the author's own weak pair
    eq(hostColors(exp, { accent: '#f0a030' }, 'day').warnings, []);
  },
  'the focus colour needs 3:1 on surface, not 4.5:1'() {
    eq(hostColors(expOf(), { 'accent-2': '#c26a00' }, 'day').warnings, []); // about 3.2:1 on #fff4d8
    const w = one(hostColors(expOf(), { 'accent-2': '#e09030' }, 'day'));
    eq([w.pair, w.need], ['accent-2 on surface', 3]);
  },
  'on-<role> on <role> needs 4.5:1, from either side'() {
    const w = one(hostColors(expOf(), { accent: '#3a3f60' }, 'day'));
    eq([w.pair, w.need], ['on-accent on accent', 4.5]);
    eq(one(hostColors(expOf(), { 'on-accent': '#c08a30' }, 'day')).pair, 'on-accent on accent');
  },
  'without a host theme pick, every declared theme is checked (an input may switch them at play)'() {
    const set = { 'accent-2': '#0b4f52' }; // fine on the day surface, too dark on the night surface
    eq(hostColors(expOf(), set, 'day').warnings, []);
    const w = one(hostColors(expOf(), set, undefined));
    eq([w.pair, w.theme], ['accent-2 on surface', 'night']);
  },
  'a host theme pick comes first: the set is checked against that theme only'() {
    const set = { surface: '#000000', ink: '#ffffff', muted: '#cccccc', success: '#6fcf97', warning: '#f2c94c', danger: '#ff8a80', 'accent-2': '#40c0c0' };
    eq(hostColors(expOf(), set, 'night').warnings, []);
    eq(hostColors(expOf(), set, undefined).warnings, [], 'the set covers every pair, so both themes pass');
  },
  'text styles: colour on surface and text on highlight at the strictest contrast rule (8.9)'() {
    const exp = expOf({ addons: { 'rich-text': { styles: { mark: { colorRole: 'ink', highlightRole: 'accent' } } } } });
    const w = one(hostColors(exp, { accent: '#7090b0' }, 'day')); // on-accent passes on it (4.71:1); ink does not
    eq(w.pair, 'ink on accent');
    const strict = expOf({ rules: [{ id: 'aaa', kind: 'contrast', ratio: 7 }] });
    const s = one(hostColors(strict, { ink: '#3d5a66' }, 'day')); // about 6:1 on the day surface
    eq([s.pair, s.need], ['ink on surface', 7]);
  },
  'a document\'s own contrast rule on two roles is kept'() {
    const exp = expOf({ rules: [{ id: 'own', kind: 'contrast', subject: 'color:accent', against: 'surface', ratio: 3 }] });
    const w = one(hostColors(exp, { accent: '#f0d080' }, 'day'));
    eq([w.pair, w.need], ['accent on surface', 3]);
  },
  'an invalid value refuses the set: W-HOST-COLOR-VALUE names the role and the value'() {
    for (const bad of ['#fff', 'red', 'rgb(1,2,3)', '#12345g', '', 7, null]) {
      const r = hostColors(expOf(), { accent: '#d84315', ink: bad }, 'day');
      eq(r.roles, null);
      const w = one(r);
      eq(w.code, 'W-HOST-COLOR-VALUE'); eq(w.role, 'ink');
      ok(w.message.includes('six-digit hex'), w.message);
    }
  },
  'a role the experience does not have, or a set that is not an object, is W-HOST-COLOR-VALUE'() {
    const w = one(hostColors(expOf(), { brand: '#d84315' }, 'day'));
    eq([w.code, w.role], ['W-HOST-COLOR-VALUE', 'brand']);
    ok(w.message.includes('not one of the experience\'s colour roles'), w.message);
    for (const v of ['accent: #d84315', ['#d84315'], 3]) eq(one(hostColors(expOf(), v, 'day')).code, 'W-HOST-COLOR-VALUE');
    const plain = expOf(); delete plain.doc.themes; delete plain.doc.theme;
    ok(one(hostColors(plain, { accent: '#d84315' })).message.includes('it has none'), 'no themes: no roles to set');
  },
  'the drawing takes a checked set on top of the active theme; parts without a colour role stay as drawn'() {
    const fill = drawn({ colors: { accent: '#bf360c', 'on-accent': '#ffffff' } });
    eq(fill('badge'), '#bf360c');
    eq(fill('label'), '#ffffff');
    eq(fill('ground'), DAY.surface, 'a role the host did not set keeps the theme colour');
    eq(fill('logo'), '#e30613', 'a brand part with no colour role never takes a host colour');
  },
  'the theme first, then the colours: a host pick of night with a host accent'() {
    const fill = drawn({ theme: 'night', colors: { accent: '#ffb74d' } });
    eq(fill('ground'), NIGHT.surface);
    eq(fill('badge'), '#ffb74d');
  },
  'without colours the drawing is as before'() {
    const fill = drawn({});
    eq([fill('badge'), fill('ground'), fill('logo')], [DAY.accent, DAY.surface, '#e30613']);
  },
  'the element\'s colors text reads as an object; a malformed entry keeps an empty value for the check to name'() {
    eq(colorsText('accent: #d84315; surface:#ffffff;'), { accent: '#d84315', surface: '#ffffff' });
    eq(colorsText(' accent '), { accent: '' });
    eq(colorsText(null), null);
    eq(one(hostColors(expOf(), colorsText('accent #d84315'), 'day')).code, 'W-HOST-COLOR-VALUE');
  },
};
