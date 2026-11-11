// The focus mark that follows the part (WCAG 2.4.13). The plan and the filter are plain data, so they are
// checked here without a browser; engine/v2/tests/browser/input-browser.mjs checks the ring on a real part.
import { RING, focusRing, focusColour, ringFilter, contrastOf } from '../web/input-web.mjs';
import { eq, ok } from './helpers.mjs';

const find = (node, name, out = []) => { if (node[0] === name) out.push(node); for (const k of node[2] || []) find(k, name, out); return out; };

export const tests = {
  'the focus colour is the theme accent-2, else accent, else the player blue'() {
    eq(focusColour({ colorRoles: { 'accent-2': '#AA3300', accent: '#00ff00' } }), '#aa3300');
    eq(focusColour({ colorRoles: { accent: '#0a0' } }), '#00aa00');
    eq(focusColour({ colorRoles: { accent: 'red' } }), RING.FALLBACK);
    eq(focusColour(undefined), RING.FALLBACK);
  },
  'the band is at least 2 CSS pixels thick, and 3:1 against its halo, for any focus colour'() {
    ok(RING.RING_PX >= 2, 'band thickness');
    for (const c of ['#1a5fb4', '#ffd34d', '#ffffff', '#000000', '#777777', '#e6af42', '#2a9d8f', '#ff00ff']) {
      const p = focusRing(c, 1);
      ok(contrastOf(p.focus, p.halo) >= 3, `${c} on ${p.halo}: ${contrastOf(p.focus, p.halo).toFixed(2)}`);
      eq(p.contrast, contrastOf(p.focus, p.halo));
    }
    eq(focusRing('#1a5fb4', 1).halo, '#ffffff');
    eq(focusRing('#ffd34d', 1).halo, '#111111');
    eq(focusRing('#1f8a8a', 1).halo, '#ffffff'); // 3:1 on white: white, though near-black stands a little further
  },
  'the radii are CSS pixels turned into the part\'s user units'() {
    const one = focusRing('#1a5fb4', 1);
    eq(one.radii, [RING.GAP_PX, RING.GAP_PX + RING.RING_PX, RING.GAP_PX + RING.RING_PX + RING.HALO_PX]);
    const half = focusRing('#1a5fb4', 0.5); // a drawing shown at half size: twice the units for the same pixels
    eq(half.radii, one.radii.map(r => r * 2));
    ok(half.margin > half.radii[2], 'the filter region holds the halo');
    eq(focusRing('nope', 1).focus, RING.FALLBACK);
  },
  'the filter grows the alpha three times, each a blur and a threshold, and draws halo, band and part in that order'() {
    const plan = focusRing('#1a5fb4', 2);
    const f = ringFilter('hsvg-focus-1', plan, { x: 10, y: 20, width: 100, height: 50 });
    eq(f[0], 'filter');
    eq(f[1].id, 'hsvg-focus-1');
    eq(f[1].filterUnits, 'userSpaceOnUse');
    eq([f[1].x, f[1].y, f[1].width, f[1].height].map(Number), [10 - plan.margin, 20 - plan.margin, 100 + 2 * plan.margin, 50 + 2 * plan.margin]);
    // Each growth is round (E1 item 5): a blur whose 10% line lies the step's width out, then a threshold there.
    eq(find(f, 'feMorphology'), []);
    const widths = [plan.radii[0], plan.radii[1] - plan.radii[0], plan.radii[2] - plan.radii[1]];
    find(f, 'feGaussianBlur').forEach((b, i) => ok(Math.abs(Number(b[1].stdDeviation) * 1.2816 - widths[i]) < 0.002, `growth ${i}: ${b[1].stdDeviation}`));
    eq(find(f, 'feGaussianBlur').map(b => b[1].in), ['a', 'd1', 'd2'], 'each grows from the last');
    for (const t of find(f, 'feFuncA').slice(1)) ok(Math.abs(Number(t[1].slope) * 0.1 + Number(t[1].intercept) - 0.5) < 0.002, 'the threshold is at 10%');
    eq(find(ringFilter('x', plan, { x: 0, y: 0, width: 1, height: 1 }, false), 'feMergeNode').map(x => x[1].in), ['halo', 'band'], 'a copy leaves the part out');
    eq(find(f, 'feFlood').map(x => x[1]['flood-color']), [plan.halo, plan.focus]);
    eq(find(f, 'feMergeNode').map(x => x[1].in), ['halo', 'band', 'SourceGraphic']);
    // Faint paint (a hit area at 1%) counts as the outline: alpha is scaled up and clamped.
    ok(Number(find(f, 'feFuncA')[0][1].slope) >= 100, 'faint fills count');
    // Only engine-owned names and numbers: no markup is built from text.
    ok(!JSON.stringify(f).includes('<'), 'plain data');
  },
};
