// Without a browser: the form widgets' look from the theme (widgetCss, widgetLook), and the
// drawing's ambient `layout` value (layoutValue). The browser parts are in tests/browser/q1-player-browser.mjs.
import path from 'node:path';
const { widgetCss, widgetLook, experienceTheme, contrast } = await addonCode('../web/widgets-web.mjs', import.meta.url) ?? {};
import { loadExperience, folderSource } from '../src/load.mjs';
import { Player } from '../src/story.mjs';
import { Drawing } from '../src/drawing.mjs';
import { chooseLayout, aspectsOf, shapeMapsOf, parseSize } from '../src/layout.mjs';
import * as P from '../src/plan.mjs';
import { repo, schemas, eq, ok, addonCode } from './helpers.mjs';

const THEME = {
  colorRoles: { surface: '#fff4d8', ink: '#153b4b', accent: '#e6af42', 'accent-2': '#168e91', muted: '#4f6b73' },
  typeRoles: { heading: { font: 'bitter-700', fallback: 'Georgia, serif' }, body: { font: 'inter-400', fallback: 'Arial, sans-serif' } },
  spacing: { gap: { minimum: 8, initial: 16, maximum: 24 } },
  outline: { control: 'rounded', radius: { minimum: 4, initial: 12, maximum: 20 }, border: { width: 2, style: 'solid' } },
};

export const tests = {
  'widgets: no theme keeps the browser look (no CSS)'() {
    eq(widgetCss(null, '[s]'), '');
    eq(widgetCss({}, '[s]'), '');
    eq(widgetCss({ about: { family: 'x' }, icons: 'set' }, '[s]'), '', 'a theme with nothing for widgets gives nothing');
    eq(widgetLook({ motion: { durationMs: 200 } }), null);
  },
  'widgets: colours by role, type roles, radius and border from the theme'() {
    const L = widgetLook(THEME);
    eq([L.surface, L.ink, L.accent, L.focus, L.muted], ['#fff4d8', '#153b4b', '#e6af42', '#168e91', '#4f6b73']);
    eq(L.radius, 12, 'a knob takes its initial');
    eq(L.border, 2);
    ok(L.text.startsWith('"inter-400", Arial'), L.text);
    ok(L.display.startsWith('"bitter-700", Georgia'), L.display);
    ok(contrast(L.onAccent, L.accent) >= 4.5, `the label on the accent reads (${L.onAccent} on ${L.accent})`);
    const css = widgetCss(THEME, '[data-player-widgets="1"]');
    for (const want of ['background:#e6af42', 'color:#153b4b', 'border-radius:12px', 'outline:3px solid #168e91', 'Georgia, serif', 'Arial, sans-serif'])
      ok(css.includes(want), `the CSS has ${want}`);
    ok(css.split('\n').every(r => r.startsWith('[data-player-widgets="1"] ')), 'every rule is scoped to the layer');
  },
  'widgets: every gap and padding is a multiple of 8 units'() {
    const css = widgetCss(THEME, '[s]');
    const px = [...css.matchAll(/(?:gap|padding|padding-top):([^;}]+)/g)].flatMap(m => m[1].trim().split(/\s+/)).map(v => parseFloat(v)).filter(n => !Number.isNaN(n));
    ok(px.length > 5, 'spacing is set');
    eq(px.filter(n => n % 8 !== 0), [], 'all multiples of 8');
    eq(widgetLook({ ...THEME, spacing: { gap: 13 } }).gap, 16, 'a theme gap rounds to the 8-unit grid');
  },
  'widgets: outline shapes give the corner radius; extends applies'() {
    eq(widgetLook({ outline: { control: 'square' } }).radius, 0);
    eq(widgetLook({ outline: { control: 'pill' } }).control, 999);
    eq(widgetLook({ colorRoles: { ink: '#000000' } }).radius, 8);
    const t = experienceTheme({ theme: 'night', themes: { day: THEME, night: { extends: 'day', colorRoles: { surface: '#10212b', ink: '#fff4d8' } } } });
    eq([t.colorRoles.surface, t.colorRoles.accent, t.typeRoles.body.font], ['#10212b', '#e6af42', 'inter-400']);
    eq(experienceTheme({}), null);
  },
  'layout value: each block on screen with its frame, tier and steps'() {
    return (async () => {
      const dir = path.join(repo, 'engine', 'v2', 'tests', 'plan-fixture');
      const exp = loadExperience(await folderSource(dir), schemas()).experience;
      const p = new Player(exp); ok(p.start().ok);
      for (const size of ['300x250', '728x90']) {
        const space = parseSize(size);
        const sc = exp.scenes.ad;
        const pick = chooseLayout(sc.doc.layouts, space, { aspectOf: aspectsOf(sc), maps: shapeMapsOf(sc.doc, exp.doc) });
        const d = new Drawing(p, { layouts: {}, planSolver: P });
        d.mountScene('ad', pick.id, space);
        const v = d.layoutValue();
        eq(Object.keys(v), Object.keys(d.frames).sort(), 'one entry per block on screen');
        eq(v['ad/offer'].frame, size === '300x250' ? 'stacked' : 'row', `${size}: the offer's frame`);
        ok(['short', 'medium', 'rich'].includes(v.ad.tier), 'a tier');
        ok(Array.isArray(v.ad.steps), 'steps are a list');
        eq(JSON.stringify(d.layoutValue()), JSON.stringify(v), 'same drawing, same value');
      }
    })();
  },
};
