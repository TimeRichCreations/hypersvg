// Rich text runs, text styles, linked text parts (6.8.1, 5.3.1, 7.7). The pure functions of
// src/richtext.mjs and searchRunsFit (src/richtext-draw.mjs) with a fake measurer, then the fixture played in Node.
const { DEFAULT_TEXT_STYLES, textStylesOf, resolveRuns, tokens, joinWords, flowLines, optionalSteps, spokenRuns, styleAttrs, plainText, evalRuns, markupIn, runLists } = await addonCode('../src/richtext.mjs', import.meta.url) ?? {};
const { contrast } = await addonCode('../check/richtext.mjs', import.meta.url) ?? {};
import { wordSegments } from '../src/words.mjs';
const { searchRunsFit } = await addonCode('../src/richtext-draw.mjs', import.meta.url) ?? {};
import { loadExperience } from '../src/load.mjs';
import { Player } from '../src/story.mjs';
import { Drawing } from '../src/drawing.mjs';
import { files, THEME, STYLES } from './richtext-fixture/files.mjs';
import { eq, ok, mapSource, schemas, addonCode } from './helpers.mjs';

// A fake measurer: every character is 0.6 px per font px, bold ones 0.7.
const BOLD = new Set(['strong', 'accent', 'price']);
const measureAt = (runs) => (px) => (pieces) => pieces.reduce((w, p) => w + [...p.text].length * px * (p.run !== null && BOLD.has(runs[p.run]?.style) ? 0.7 : 0.6), 0);
const lineText = (line) => line.map(p => p.text).join('');

function play(language = 'en', layout = 'tall') {
  const { experience, diags } = loadExperience(mapSource(files), schemas());
  ok(experience, `the fixture loads: ${JSON.stringify(diags)}`);
  const p = new Player(experience);
  p.state.ambient.language = language;
  ok(p.start().ok, 'the fixture starts');
  const d = new Drawing(p);
  d.mountScene('ad', layout);
  d.paint();
  return { p, d, node: (addr, id) => d.frames[addr].byLocal.get(id), text: (n) => d.serialize(n) };
}

export const tests = {
  'text styles: strong and emphasis by default; addons.rich-text.styles adds and redefines, one list for every theme (7.7)'() {
    eq(textStylesOf({}), { ...DEFAULT_TEXT_STYLES });
    const doc = { addons: { 'rich-text': { styles: { strong: { weight: 900 }, price: { weight: 700 } } } } };
    eq(textStylesOf(doc).strong, { weight: 900 });
    eq(textStylesOf(doc).emphasis, { italic: true });
    eq(textStylesOf(doc).price, { weight: 700 });
  },
  'a style writes weight, italic, decoration, colour and type role; a lit run paints its highlight role behind'() {
    const styles = textStylesOf({ addons: { 'rich-text': { styles: STYLES } } });
    const theme = { ...THEME, typeRoles: { display: { font: 'f', fallback: 'Georgia, serif' } } };
    eq(styleAttrs('accent', styles, theme), { 'font-weight': '800', fill: '#b3261e' });
    eq(styleAttrs('was-price', styles, theme), { 'text-decoration': 'line-through', fill: '#4f5b62' });
    eq(styleAttrs('emphasis', styles, theme), { 'font-style': 'italic' });
    eq(styleAttrs(null, styles, theme), {});
    eq(styleAttrs('x', { x: { typeRole: 'display' } }, theme)['font-family'], 'Georgia, serif');
    const lit = styleAttrs('price', styles, theme, true);
    eq(lit.stroke, '#ffd84d'); eq(lit['paint-order'], 'stroke'); eq(lit['data-hsvg-lit'], 'true');
    eq(styleAttrs('legal', styles, theme, true).stroke, '#b3261e', 'no highlightRole: the accent role');
  },
  'resolveRuns: a list, a language object, a tier object, nested (5.3.1)'() {
    const en = [{ text: 'Hi' }]; const de = [{ text: 'Hallo' }];
    eq(resolveRuns(en), en);
    eq(resolveRuns({ en, de }, { language: 'de' }), de);
    eq(resolveRuns({ en, de }, { language: 'de-AT' }), de);
    eq(resolveRuns({ en, de }, { language: 'fr', defaultLanguage: 'en' }), en);
    eq(resolveRuns({ short: en, rich: de }, { tier: 'rich' }), de);
    eq(resolveRuns({ short: en, rich: de }, { tier: 'medium' }), de, 'a missing tier takes the nearest longer one (7.9)');
    eq(resolveRuns({ short: en, medium: de }, { tier: 'rich' }), de, 'else the nearest shorter one');
    eq(resolveRuns({ medium: de }, { tier: 'short' }), de, 'then the nearest larger one');
    eq(resolveRuns({ en: { short: en, rich: de } }, { language: 'en', tier: 'rich' }), de);
    eq(runLists({ en: { short: en }, de }).map(x => x.at), ['/en/short', '/de']);
  },
  'tokens: words cross runs; a line feed is a forced break; spaces between runs are plain'() {
    const runs = [{ text: 'RAIN?', style: 'accent' }, { text: '\nBring it ' }, { text: 'on', style: 'strong' }, { text: '.' }];
    const t = tokens(runs);
    eq(t.length, 5);
    ok(t[1].br, 'the line feed is a break');
    eq(t[4].pieces, [{ text: 'on', run: 2 }, { text: '.', run: 3 }]);
    eq(joinWords(t.slice(2)), [{ text: 'Bring it', run: 1 }, { text: ' ', run: null }, { text: 'on', run: 2 }, { text: '.', run: 3 }]);
    eq(tokens([{ text: 'rain' }], 'upper')[0].pieces[0].text, 'RAIN');
    eq(plainText(runs), 'RAIN?\nBring it on.');
  },
  'flow: a forced break moves to the next part; a full part passes on; fewer parts take it all (6.8.1)'() {
    const runs = [{ text: 'RAIN?\nBring it on.' }];
    const w = () => (pieces) => lineText(pieces).length;
    let out = flowLines(tokens(runs), [{ width: 100, maxLines: 3 }, { width: 100, maxLines: 3 }], w());
    eq(out.map(ls => ls.map(lineText)), [['RAIN?'], ['Bring it on.']]);
    out = flowLines(tokens(runs), [{ width: 100, maxLines: 3 }], w());
    eq(out.map(ls => ls.map(lineText)), [['RAIN?', 'Bring it on.']], 'one part: the break is a new line');
    out = flowLines(tokens([{ text: 'one two three four five six' }]), [{ width: 9, maxLines: 2 }, { width: 9, maxLines: 2 }], w());
    eq(out.map(ls => ls.map(lineText)), [['one two', 'three'], ['four five', 'six']]);
    out = flowLines(tokens([{ text: 'a\nb\nc' }]), [{ width: 9, maxLines: 9 }, { width: 9, maxLines: 9 }], w());
    eq(out.map(ls => ls.map(lineText)), [['a'], ['b', 'c']], 'the last part takes what is left');
  },
  'searchRunsFit: one size for every part; shrinks to fit; remove leaves optional runs out last first (7.6, 8.4)'() {
    const runs = [{ text: 'RAIN?', style: 'accent' }, { text: '\nBring it on.' }];
    const parts = [{ width: 260 * 0.98, height: 120 }, { width: 260 * 0.98, height: 160 }];
    const r = searchRunsFit(runs, (rs) => tokens(rs), parts, { fontPx: 72, minFontPx: 12, maxLines: 3 }, 72, measureAt(runs));
    eq(r.outcome, 'fitted');
    eq(r.lines[0].map(lineText), ['RAIN?'], 'the forced break ends the first part');
    eq(r.lines[1].map(lineText).join(' '), 'Bring it on.', 'the rest is in the second part, every word kept');
    ok(r.px < 72 && r.px >= 12, `a size was searched: ${r.px}`);
    const price = [{ text: 'was $40 ', style: 'was-price', optional: true }, { text: 'now $29', style: 'price' }];
    const tight = searchRunsFit(price, (rs) => tokens(rs), [{ width: 100, height: 30 }], { fontPx: 24, minFontPx: 18, maxLines: 1, steps: ['shrink', 'remove'] }, 24, measureAt(price));
    eq(tight.outcome, 'fitted'); eq(tight.runs.length, 1); eq(lineText(tight.lines[0][0]), 'now $29');
    const without = searchRunsFit(price, (rs) => tokens(rs), [{ width: 100, height: 30 }], { fontPx: 24, minFontPx: 18, maxLines: 1, steps: ['shrink'] }, 24, measureAt(price));
    eq(without.outcome, 'incomplete'); eq(without.runs.length, 2);
    const three = [{ text: 'a', optional: true }, { text: 'b' }, { text: 'c', optional: true }];
    eq(optionalSteps(three).map(l => l.map(x => x.text).join('')), ['abc', 'ab', 'b']);
  },
  'read-along: a spoken run lights while its words are spoken by a line on the same text (6.8.1, 6.11)'() {
    const runs = [{ text: 'Bring ', highlight: 'spoken' }, { text: 'it on', highlight: 'spoken' }, { text: '.', highlight: false }];
    eq([...spokenRuns(runs, { line: 'l', text: 'Bring it on.', word: 0, words: wordSegments('Bring it on.') })], [0]);
    eq([...spokenRuns(runs, { line: 'l', text: 'Bring it on.', word: 2, words: wordSegments('Bring it on.') })], [1]);
    eq([...spokenRuns(runs, { line: 'l', text: 'Bring it on.', word: -1, words: wordSegments('Bring it on.') })], []);
    eq([...spokenRuns(runs, { line: 'l', text: 'Another text', word: 0, words: wordSegments('Another text') })], [], 'another line lights nothing');
    eq([...spokenRuns(runs, null)], []);
  },
  'evalRuns: literal runs are templates with highlight formulas; a field gives literal content'() {
    const ev = { eval: (f) => (f === 'sale' ? true : f === 'field' ? { en: [{ text: '{{ x }}', style: 'strong' }] } : null), template: (t) => t.replace('{{ x }}', 'X'), language: 'en' };
    eq(evalRuns({ runs: [{ text: '{{ x }}!', highlight: 'sale', optional: true }] }, ev), [{ text: 'X!', style: null, optional: true, highlight: true }]);
    eq(evalRuns({ runs: 'field' }, ev), [{ text: '{{ x }}', style: 'strong', optional: false, highlight: false }]);
  },
  'no markup in content; contrast by WCAG 2.2'() {
    eq(markupIn('Bring it on.'), null); eq(markupIn('a\nb'), null);
    eq(markupIn('<b>x</b>'), 'a tag'); eq(markupIn('Fish &amp; chips'), 'an entity'); eq(markupIn('a\tb'), 'a control character');
    eq(markupIn('3 < 4'), null, 'a lone less-than sign is not a tag');
    eq(Math.round(contrast('#000000', '#ffffff')), 21);
    eq(contrast('#zzz', '#fff'), null);
  },
  'play: the runs draw as styled tspans; the accessible name is the whole text once (6.8.1)'() {
    const { node, text } = play();
    const h1 = node('ad', 'head-1'); const h2 = node('ad', 'head-2');
    eq(h1.attrs['aria-label'], 'RAIN? Bring it on.');
    eq(h2.attrs['aria-hidden'], 'true'); ok(!('aria-label' in h2.attrs));
    ok(text(h1).includes('<tspan font-weight="800" fill="#b3261e">RAIN?</tspan>'), text(h1));
    ok(!h1.children.map(c => text(c)).join('').includes('Bring'), 'the second line flows into the linked part');
    ok(text(h2).includes('<tspan font-weight="700">Bring it on.</tspan>'), text(h2));
    ok(text(node('ad', 'legal')).includes('font-style="italic" fill="#4f5b62"'), 'legal text in its own style');
  },
  'play: a frame that draws fewer parts takes the text in those (the strip)'() {
    const { node, text } = play('en', 'strip');
    const h1 = node('ad', 'head-1');
    ok(!node('ad', 'head-2'), 'the strip draws one part');
    ok(text(h1).includes('RAIN?') && text(h1).includes('Bring it on.'), text(h1));
    eq((text(h1).match(/<tspan x=/g) || []).length, 2, 'two lines in one part');
  },
  'play: a word lit by a value; per-language runs from a use (5.3.1)'() {
    const { p, d, node, text } = play();
    ok(!text(node('ad', 'price')).includes('data-hsvg-lit'), 'not lit at start');
    ok(p.activate('ad', 'sale').ok); d.paint();
    ok(/<tspan[^>]*stroke="#ffd84d"[^>]*>now \$29<\/tspan>/.test(text(node('ad', 'price'))), text(node('ad', 'price')));
    eq(node('ad/new-tag', 'words').attrs['aria-label'], 'New colours');
    const de = play('de');
    eq(de.node('ad/new-tag', 'words').attrs['aria-label'], 'Neue Farben');
  },
  'play: a text binding with flow flows as one plain run (6.8.1)'() {
    const f = structuredClone(files);
    f['scenes/ad/scene.json'].bindings[0] = { id: 'headline-text', target: 'head-1', 'rich-text': { text: 'Plain\nwords', flow: ['head-2'] } };
    const { experience } = loadExperience(mapSource(f), schemas());
    const p = new Player(experience); ok(p.start().ok);
    const d = new Drawing(p); d.mountScene('ad', 'tall'); d.paint();
    const h1 = d.frames.ad.byLocal.get('head-1'); const h2 = d.frames.ad.byLocal.get('head-2');
    eq(h1.attrs['aria-label'], 'Plain words');
    ok(d.serialize(h1).includes('>Plain</tspan>') && d.serialize(h2).includes('>words</tspan>'), d.serialize(h1) + d.serialize(h2));
  },
  'play: read-along lights the run whose word the block\'s own spoken line is on (6.8.1, 6.11)'() {
    const f = structuredClone(files);
    f['scenes/ad/scene.json'].bindings[2]['rich-text'].runs = [{ text: 'Offer ends ', style: 'legal', highlight: 'spoken' }, { text: 'Sunday.', style: 'legal', highlight: 'spoken' }];
    f['scenes/ad/scene.json'].addons = { lines: { lines: { offer: { text: 'Offer ends Sunday.', durationMs: 900 } } } }; // three words, 300 ms each
    f['experience.json'].needs = ['rich-text', 'lines']; // read-along follows a spoken line (D18)
    const { experience } = loadExperience(mapSource(f), schemas());
    const p = new Player(experience); ok(p.start().ok);
    const d = new Drawing(p); d.mountScene('ad', 'tall');
    const legal = () => d.serialize(d.frames.ad.byLocal.get('legal'));
    d.paint(); ok(!legal().includes('data-hsvg-lit'), 'silent: nothing lit');
    p.lines.say('ad', 'offer'); p.advance(0); d.paint();
    ok(/data-hsvg-lit="true"[^>]*>Offer ends</.test(legal()) && !/data-hsvg-lit="true"[^>]*>Sunday/.test(legal()), legal());
    p.advance(650); d.paint(); // word 2 of 0..2
    ok(/data-hsvg-lit="true"[^>]*>Sunday\.</.test(legal()) && !/data-hsvg-lit="true"[^>]*>Offer/.test(legal()), legal());
    p.advance(400); d.paint(); ok(!legal().includes('data-hsvg-lit'), 'the line ended: nothing lit');
  },
};
