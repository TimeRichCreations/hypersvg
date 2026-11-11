// Text fitting (7.6), measured in the browser on the live SVG. Used by the drawing for a text binding with a fit.
// - Whole words: lines break between words and at line feeds; a line feed counts toward maxLines. (Gap: the UAX #14
//   tables are not bundled yet, so scripts without spaces do not break; class SA never breaks anyway.)
// - Font search: from fontPx (default: the drawn size) down to minFontPx in whole units; more than 32 sizes become 32
//   evenly spaced ones with both ends, rounded down, never below minFontPx. The first size at which every line fits
//   the region within maxLines wins.
// - Every line leaves 2% of the region's width free. The lines' height is px * (1 + (n - 1) * lineHeight): the last
//   line carries no leading.
// - wrap "none" keeps only the value's own line breaks.
// - Nothing is clipped: when no size fits, the text is drawn whole at minFontPx and the outcome is "incomplete".
// - The drawn text's anchor gives the alignment; the lines sit inside the region (top first when they overflow).
// - Exact replay: the drawn content is left exactly as drawn, when the drawn text fits its region across. A drawn
//   sample that runs past the region's left or right edge is fitted like any other text (C1 gap 1).
const NS = 'http://www.w3.org/2000/svg';

export function fontSizes(max, min) {
  max = Math.floor(max); min = Math.ceil(min);
  if (max <= min) return [min];
  if (max - min + 1 <= 32) return Array.from({ length: max - min + 1 }, (_, i) => max - i);
  return Array.from({ length: 32 }, (_, i) => Math.max(min, Math.floor(max - (i * (max - min)) / 31)));
}

// Greedy lines of whole words at one size; null when a line feed paragraph cannot be laid out (never: words stay whole).
export function breakLines(text, wrap, measure, width) {
  const paras = String(text).split('\n');
  if (wrap === 'none') return paras;
  const lines = [];
  for (const p of paras) {
    const words = p.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (line && measure(next) > width) { lines.push(line); line = w; } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

// The font search (rule 2) in the order of the fit's steps (7.6). measure(px) gives a width function at that size;
// room is the region's width less 2%, height its height. Returns {px, lines, outcome}.
// - Wrap first (the default steps ["short", "wrap", "shrink"]): at each size from the largest, the words wrap.
// - Shrink first (shrink before wrap in steps, as ["shrink", "wrap"]): the sizes are searched on unwrapped lines (the
//   value's own line breaks); only if none fits do the words wrap, at the smallest size the search reached.
// "short" gives no shorter text here (no short form is declared), so it changes nothing.
export function searchFit(value, fit, drawnPx, measure, room, height) {
  const lh = fit.lineHeight ?? 1.2; const maxLines = fit.maxLines ?? 1;
  const fits = (px, lines, mm) => lines.length <= maxLines && px * (1 + (lines.length - 1) * lh) <= height + 0.01 && lines.every(l => mm(l) <= room);
  const sizes = fontSizes(fit.fontPx ?? drawnPx, fit.minFontPx);
  const steps = Array.isArray(fit.steps) ? fit.steps : ['short', 'wrap', 'shrink'];
  const shrinkFirst = steps.includes('shrink') && steps.includes('wrap') && steps.indexOf('shrink') < steps.indexOf('wrap');
  if (shrinkFirst) {
    for (const px of sizes) { const mm = measure(px); const lines = breakLines(value, 'none', mm, room); if (fits(px, lines, mm)) return { px, lines, outcome: 'fitted' }; }
    const px = sizes[sizes.length - 1]; const mm = measure(px);
    const lines = breakLines(value, fit.wrap, mm, room);
    return { px, lines, outcome: fits(px, lines, mm) ? 'fitted' : 'incomplete' };
  }
  for (const px of sizes) { const mm = measure(px); const lines = breakLines(value, fit.wrap, mm, room); if (fits(px, lines, mm)) return { px, lines, outcome: 'fitted' }; }
  const px = fit.minFontPx;
  return { px, lines: breakLines(value, fit.wrap, measure(px), room), outcome: 'incomplete' };
}

// textEl: the <text>; regionEl: the region <rect>; drawn: {nodes, fontPx} as first drawn. Returns the outcome.
export function fitText(textEl, regionEl, value, fit, drawn) {
  const win = textEl.ownerDocument.defaultView;
  const plain = (s) => String(s).replace(/\s+/g, ' ').trim();
  const sample = plain(value) === plain(drawn.text);
  if (sample) restore(textEl, drawn);
  const b = regionEl.getBBox();
  const m = textEl.getCTM().inverse().multiply(regionEl.getCTM());
  const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([x, y]) => new win.DOMPoint(x, y).matrixTransform(m));
  const rx = Math.min(...pts.map(p => p.x)); const ry = Math.min(...pts.map(p => p.y));
  const rw = Math.max(...pts.map(p => p.x)) - rx; const rh = Math.max(...pts.map(p => p.y)) - ry;
  if (!(rw > 0 && rh > 0)) return null; // not laid out yet: try again at the next paint (a sample shows as drawn)
  if (sample && sampleFits(textEl, rx, rw)) return 'drawn';
  const anchor = win.getComputedStyle(textEl).textAnchor;
  const align = anchor === 'middle' ? 0.5 : anchor === 'end' ? 1 : 0;
  const lh = fit.lineHeight ?? 1.2; const room = rw * 0.98;
  const probe = textEl.ownerDocument.createElementNS(NS, 'tspan');
  textEl.replaceChildren(probe);
  const measure = (px) => (s) => { textEl.style.fontSize = `${px}px`; probe.textContent = s; return probe.getComputedTextLength(); };
  const chosen = searchFit(value, fit, drawn.fontPx, measure, room, rh);
  draw(textEl, chosen, { rx, ry, rw, rh, align, lh, baseline: drawn.baseline });
  textEl.setAttribute('data-hsvg-fitted', chosen.outcome);
  return chosen.outcome;
}

// Each line is its own tspan. Between two lines stands a space at font size 0: the element's text (what a screen
// reader, a live region, copy and find read) keeps the gap between the words, and no line moves, whatever the anchor
// or direction (a space of any width would widen its line's text chunk).
function draw(textEl, { px, lines }, { rx, ry, rw, rh, align, lh, baseline }) {
  textEl.style.fontSize = `${px}px`;
  const doc = textEl.ownerDocument;
  const spans = lines.map((line, i) => {
    const s = doc.createElementNS(NS, 'tspan');
    s.setAttribute('x', String(rx + rw * align));
    s.setAttribute('y', String((baseline ?? ry + px * 0.8) + i * px * lh));
    s.textContent = line;
    return s;
  });
  textEl.replaceChildren(...spans.flatMap((s, i) => (i && lines[i] && lines.slice(0, i).some(Boolean) ? [gap(doc), s] : [s])));
  if (!lines.some(Boolean)) return;
  const ink = textEl.getBBox();
  let dy = 0;
  if (ink.y + ink.height > ry + rh) dy = ry + rh - (ink.y + ink.height);
  if (ink.y + dy < ry) dy = ry - ink.y;
  if (dy) for (const s of spans) s.setAttribute('y', String(Number(s.getAttribute('y')) + dy));
}

// The space between two drawn lines: it keeps the words apart in the text and takes no room (draw above).
export function gap(doc) {
  const g = doc.createElementNS(NS, 'tspan');
  g.setAttribute('font-size', '0');
  g.textContent = ' ';
  return g;
}

// Exact replay (7.6 rule 8) holds for a drawn sample that fits its region across: its ink stays between the region's
// left and right edges (half a unit of slack for measuring). A sample drawn past an edge is fitted instead.
function sampleFits(textEl, rx, rw) {
  const ink = textEl.getBBox();
  if (!(ink.width > 0)) return true;
  return ink.x >= rx - 0.5 && ink.x + ink.width <= rx + rw + 0.5;
}

function restore(textEl, drawn) {
  textEl.style.fontSize = drawn.style ?? '';
  if (!drawn.style) textEl.style.removeProperty('font-size');
  textEl.replaceChildren(...drawn.nodes.map(n => n.cloneNode(true)));
  textEl.removeAttribute('data-hsvg-fitted');
}

// What the text looked like as drawn, kept before the first fit.
export function drawnState(textEl) {
  const win = textEl.ownerDocument.defaultView;
  const first = textEl.querySelector('tspan[y]') || textEl;
  const y = first.getAttribute('y');
  return { nodes: [...textEl.childNodes].map(n => n.cloneNode(true)), text: textEl.textContent, fontPx: parseFloat(win.getComputedStyle(textEl).fontSize) || 16, baseline: y !== null && y !== '' ? Number(y.split(/[\s,]+/)[0]) : null, style: textEl.style.fontSize };
}

// The region of a fit in the text's own coordinates: {rx, ry, rw, rh}, or null before layout.
export function fitGeometry(textEl, regionEl) {
  const win = textEl.ownerDocument.defaultView;
  const b = regionEl.getBBox();
  const m = textEl.getCTM().inverse().multiply(regionEl.getCTM());
  const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([x, y]) => new win.DOMPoint(x, y).matrixTransform(m));
  const rx = Math.min(...pts.map(p => p.x)); const ry = Math.min(...pts.map(p => p.y));
  const rw = Math.max(...pts.map(p => p.x)) - rx; const rh = Math.max(...pts.map(p => p.y)) - ry;
  return rw > 0 && rh > 0 ? { rx, ry, rw, rh } : null;
}

// A measurer on the live text: measure(px)(s) is the width of s at px. It empties the text; drawFit fills it again.
export function textMeasurer(textEl) {
  const probe = textEl.ownerDocument.createElementNS(NS, 'tspan');
  textEl.replaceChildren(probe);
  return (px) => (s) => { textEl.style.fontSize = `${px}px`; probe.textContent = s; return probe.getComputedTextLength(); };
}

// Draws laid-out lines in the region, aligned by the drawn anchor, as fitText does.
export function drawFit(textEl, { px, lines }, geom, drawn, lh) {
  const win = textEl.ownerDocument.defaultView;
  const anchor = win.getComputedStyle(textEl).textAnchor;
  const align = anchor === 'middle' ? 0.5 : anchor === 'end' ? 1 : 0;
  draw(textEl, { px, lines }, { ...geom, align, lh, baseline: drawn.baseline });
}

// Puts the drawn text back as it was first drawn (exact replay, rule 8).
export function restoreDrawn(textEl, drawn) { restore(textEl, drawn); }

// Exact replay (rule 8) for a text under the ladder: the value is the drawn sample and the sample fits its region
// across. The text is then put back as drawn and the ladder takes no step for it.
export function replays(textEl, regionEl, value, drawn) {
  const plain = (s) => String(s).replace(/\s+/g, ' ').trim();
  if (plain(value) !== plain(drawn.text)) return false;
  restore(textEl, drawn);
  const g = fitGeometry(textEl, regionEl);
  return !!g && sampleFits(textEl, g.rx, g.rw);
}
