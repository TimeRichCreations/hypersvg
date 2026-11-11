// The engine's one word splitter (6.11, 6.8.1): spoken lines (lines.mjs) and rich text's read-along (richtext.mjs)
// count words the same way. Its own module, so each capability carries it without the other.
// ---------- words (UAX #29, a bundled subset) ----------
// The word-like segments of a text: runs of letters, marks and digits, joined across MidLetter, MidNum and MidNumLet
// as WB6, WB7, WB11 and WB12 say, and across ExtendNumLet (WB13a, WB13b); each Han, Hiragana or other ideographic
// character is one segment. Spaces and punctuation are not words. Uses the regular expression engine's own Unicode
// properties, never the host's Intl.
const IDEO = /[\p{Script=Han}\p{Script=Hiragana}]/u;
const LETTER = /[\p{L}\p{M}\p{Nl}]/u;
const DIGIT = /[\p{Nd}]/u;
const EXTEND = /[\p{M}\p{Cf}‍]/u;
const MID_LETTER = new Set([':', '·', '·', '՟', '״', '‧', '︓', '﹕', '：']);
const MID_NUM_LET = new Set(['.', "'", '‘', '’', '․', '﹒', '＇', '．']);
const MID_NUM = new Set([',', ';', ';', '։', '،', '؍', '٬', '߸', '⁄', '︐', '︔', '﹐', '﹔', '，', '；']);
const EXTEND_NUM_LET = /[\p{Pc} ]/u;

export function wordSegments(text) {
  const cps = Array.from(String(text ?? ''));
  const offs = []; let o = 0; for (const c of cps) { offs.push(o); o += c.length; }
  offs.push(o);
  const kind = (c) => (c === undefined ? null : IDEO.test(c) ? 'ideo' : LETTER.test(c) ? 'letter' : DIGIT.test(c) ? 'digit' : EXTEND_NUM_LET.test(c) ? 'enl' : null);
  const out = [];
  let i = 0;
  while (i < cps.length) {
    const k = kind(cps[i]);
    if (!k || k === 'enl') { i++; continue; }
    const start = i;
    i++;
    while (i < cps.length && EXTEND.test(cps[i])) i++;
    if (k !== 'ideo') {
      let last = k;
      for (;;) {
        const c = cps[i]; const n = kind(c);
        if (n === 'letter' || n === 'digit' || n === 'enl') { last = n === 'enl' ? last : n; i++; continue; }
        if (c !== undefined && EXTEND.test(c)) { i++; continue; }
        const next = kind(cps[i + 1]);
        if (last === 'letter' && next === 'letter' && (MID_LETTER.has(c) || MID_NUM_LET.has(c))) { i += 2; continue; }
        if (last === 'digit' && next === 'digit' && (MID_NUM.has(c) || MID_NUM_LET.has(c))) { i += 2; continue; }
        break;
      }
    }
    out.push({ start: offs[start], end: offs[i], text: cps.slice(start, i).join('') });
  }
  return out;
}
