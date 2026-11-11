// A small experience for the fit browser run: one text bound to a value, fitted into a 300 x 90 region.
// A second text, the note, is drawn with a long sample that runs past its 300 x 60 region; its value is that sample.
// Six more texts wrap one long value in 300 x 70 regions: start, middle and end anchors, left to right
// and right to left; the middle one is a feedback part (a polite live region).
// Presses set the value to the drawn text, a short text, a long text, a text with a line feed and an unbreakable word.
const TEXTS = {
  drawn: 'Hello there',
  short: 'Hi',
  long: 'Robin rides the long way round the harbour to deliver every parcel on time',
  lines: 'First line\nSecond line\nThird line',
  huge: 'Supercalifragilisticexpialidocious-and-then-some-more-letters',
};
const WRAP = 'Both ammeters agree: the current flows into the page and the voltage reverses';
const WRAP_RTL = 'שני המדים מסכימים: הזרם זורם אל תוך הדף והמתח מתהפך';
const WRAPS = [['start', 'ltr'], ['middle', 'ltr'], ['end', 'ltr'], ['start', 'rtl'], ['middle', 'rtl'], ['end', 'rtl']];
const wx = (a) => (a === 'start' ? 50 : a === 'middle' ? 200 : 350);
// A text as a formula literal (D36): single quotes, with a line feed escaped.
const quote = (t) => `'${t.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
const NOTE = 'The lake is the deepest in the valley and it is fed by three cold rivers';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 1000" data-hsvg-version="2.0" data-hsvg-kind="screen">
<rect id="box" x="50" y="40" width="300" height="90" fill="none" stroke="#999" data-hsvg-layer="decoration"/>
<text id="label" data-hsvg-kind="part" x="200" y="80" text-anchor="middle" font-family="sans-serif" font-size="40">Hello there</text>
<rect id="note-box" x="50" y="150" width="300" height="60" fill="none" stroke="#999" data-hsvg-layer="decoration"/>
<text id="note" data-hsvg-kind="part" x="50" y="180" font-family="sans-serif" font-size="24">${NOTE}</text>
${WRAPS.map(([a, d], i) => `<rect id="wb-${a}-${d}" x="50" y="${300 + i * 110}" width="300" height="70" fill="none" stroke="#999" data-hsvg-layer="decoration"/>
<text id="w-${a}-${d}" data-hsvg-kind="part"${a === 'middle' && d === 'ltr' ? ' data-hsvg-role="feedback"' : ''} x="${d === 'rtl' ? 400 - wx(a) : wx(a)}" y="${325 + i * 110}" text-anchor="${a}" direction="${d}" font-family="sans-serif" font-size="22">Wrap</text>`).join('\n')}
${Object.keys(TEXTS).map((k, i) => `<g id="b-${k}" data-hsvg-kind="part"><rect x="${10 + i * 78}" y="240" width="70" height="40" fill="#ddd"/></g>`).join('\n')}
</svg>`;
export const files = {
  'experience.json': { format: 'hsvg/2.0', kind: 'experience', id: 'fit-run', story: { start: 'one', scenes: { one: 'scenes/one/scene.json' }, ends: ['one'] } },
  'scenes/one/scene.json': {
    format: 'hsvg/2.0', kind: 'scene', id: 'one', drawing: 'one.svg',
    values: { wrap: { type: 'string', initial: WRAP, maxLength: 200 }, wrapRtl: { type: 'string', initial: WRAP_RTL, maxLength: 200 }, msg: { type: 'string', initial: TEXTS.drawn, maxLength: 200 }, note: { type: 'string', initial: NOTE, maxLength: 200 } },
    controls: Object.fromEntries(Object.keys(TEXTS).map(k => [`c-${k}`, { kind: 'button', target: `b-${k}`, label: k }])),
    on: Object.fromEntries(Object.entries(TEXTS).map(([k, t]) => [`press:b-${k}`, [{ id: `r-${k}`, actions: [{ id: `s-${k}`, set: 'msg', to: quote(t) }] }]])),
    bindings: [{ id: 'label-text', target: 'label', text: '{{ msg }}', fit: { box: 'box', fontPx: 40, minFontPx: 12, maxLines: 2 } },
      { id: 'note-text', target: 'note', text: '{{ note }}', fit: { box: 'note-box', minFontPx: 10, maxLines: 2 } },
      ...WRAPS.map(([a, d]) => ({ id: `w-${a}-${d}-text`, target: `w-${a}-${d}`, text: d === 'rtl' ? '{{ wrapRtl }}' : '{{ wrap }}', fit: { box: `wb-${a}-${d}`, fontPx: 22, minFontPx: 22, maxLines: 3 } }))],
  },
  'scenes/one/one.svg': svg,
};
export { TEXTS, NOTE, WRAP, WRAP_RTL, WRAPS };
