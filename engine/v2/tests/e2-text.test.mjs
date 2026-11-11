// Wrapped text keeps its spaces (7.6). Each line is its own tspan; between two lines stands a space at
// font size 0, so the element's text (screen readers, live regions, copy, find) reads the words with single spaces
// and no line moves. drawFit (fit.mjs, used by the fit and the ladder) on a small stand-in DOM, then the rich-text
// fixture played in Node. Where the lines sit on screen is measured in tests/browser/fit-browser.mjs.
import { drawFit, searchFit, gap } from '../src/fit.mjs';
import { loadExperience } from '../src/load.mjs';
import { Player } from '../src/story.mjs';
import { Drawing } from '../src/drawing.mjs';
import { files } from './richtext-fixture/files.mjs';
import { eq, ok, mapSource, schemas } from './helpers.mjs';

// A stand-in for the few DOM calls drawFit makes.
function fakeText(anchor = 'start') {
  const make = (name) => {
    const el = {
      localName: name, attrs: {}, children: [], style: {},
      setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
      replaceChildren(...kids) { this.children = kids; },
      get textContent() { return this.text ?? this.children.map(c => c.textContent).join(''); },
      set textContent(v) { this.text = v; this.children = []; },
      getBBox() { return { x: 0, y: 10, width: 50, height: 10 }; },
    };
    el.ownerDocument = doc;
    return el;
  };
  const doc = { createElementNS: (ns, name) => make(name), defaultView: { getComputedStyle: () => ({ textAnchor: anchor }) } };
  return make('text');
}
const lay = (value, anchor) => {
  const t = fakeText(anchor);
  const m = () => (s) => s.length * 10;
  const chosen = searchFit(value, { maxLines: 4 }, 20, m, 100, 200);
  drawFit(t, chosen, { rx: 0, ry: 0, rw: 100, rh: 200 }, { baseline: null }, 1.2);
  return { t, chosen };
};

export const tests = {
  'a wrapped slot reads its words with single spaces; each line is still its own placed tspan'() {
    for (const anchor of ['start', 'middle', 'end']) {
      const { t, chosen } = lay('Both ammeters agree on the current', anchor);
      ok(chosen.lines.length > 1, `it wraps: ${JSON.stringify(chosen.lines)}`);
      eq(t.textContent, 'Both ammeters agree on the current', anchor);
      const lines = t.children.filter(c => c.getAttribute('x') !== null);
      eq(lines.map(c => c.textContent), chosen.lines, 'one placed tspan per line, holding only its line');
      const gaps = t.children.filter(c => c.getAttribute('x') === null);
      eq(gaps.length, chosen.lines.length - 1, 'one gap between each two lines');
      ok(gaps.every(g => g.getAttribute('font-size') === '0' && g.textContent === ' ' && g.getAttribute('y') === null), 'a gap is a space at size 0, placed by nothing');
    }
  },
  'a line feed and an empty line give one space; one line gives no gap'() {
    eq(lay('Turns\nreverse').t.textContent, 'Turns reverse');
    eq(lay('aa\n\nbb').t.textContent, 'aa bb');
    const one = lay('Short');
    eq([one.t.children.length, one.t.textContent], [1, 'Short']);
  },
  'gap: a tspan of one space at font size 0'() {
    const t = fakeText();
    const g = gap(t.ownerDocument);
    eq([g.localName, g.getAttribute('font-size'), g.textContent], ['tspan', '0', ' ']);
  },
  'rich text: lines in one part are kept apart by a space at size 0 (6.8.1)'() {
    const { experience, diags } = loadExperience(mapSource(files), schemas());
    ok(experience, JSON.stringify(diags));
    const p = new Player(experience); ok(p.start().ok);
    const d = new Drawing(p); d.mountScene('ad', 'strip'); d.paint();
    const h1 = d.frames.ad.byLocal.get('head-1');
    const s = d.serialize(h1);
    eq((s.match(/<tspan x=/g) || []).length, 2, 'two lines in one part');
    ok(s.includes('<tspan font-size="0"> </tspan>'), s);
    const plain = s.replace(/<[^>]+>/g, '');
    eq(plain, 'RAIN? Bring it on.');
  },
};
