// A strict, small XML reader for HyperSVG 2.0 drawings (2.10, 2.11). It accepts elements, attributes, text,
// comments, CDATA and the XML declaration; it refuses a DOCTYPE, entity declarations, processing instructions and
// any entity other than the five predefined ones and character references. Errors carry code E-SVG-PARSE.
// Plain ES module with no imports.

export class XmlError extends Error {
  constructor(message, at) { super(message); this.code = 'E-SVG-PARSE'; this.at = at; }
}

const NAME = /^[A-Za-z_][A-Za-z0-9_.:-]*/;
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeEntities(s, at = 0) {
  return s.replace(/&([^;&\s]*);?/g, (m, name) => {
    if (!m.endsWith(';')) throw new XmlError(`bare "&" at ${at}`, at);
    if (name in ENT) return ENT[name];
    let cp;
    if (/^#x[0-9a-fA-F]+$/.test(name)) cp = parseInt(name.slice(2), 16);
    else if (/^#[0-9]+$/.test(name)) cp = parseInt(name.slice(1), 10);
    else throw new XmlError(`unknown entity &${name}; at ${at}`, at);
    if (cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) throw new XmlError(`bad character reference at ${at}`, at);
    return String.fromCodePoint(cp);
  });
}

// Returns the root element: {name, attrs: {name: value}, attrOrder: [...], children: [...], text, line}.
// Text children are {text}.
export function parseXml(src) {
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);
  let i = 0;
  let line = 1;
  const adv = (n) => { for (let k = 0; k < n; k++) if (src[i + k] === '\n') line++; i += n; };
  const fail = (m) => { throw new XmlError(`${m} (line ${line})`, i); };
  const ws = () => { while (i < src.length && ' \t\r\n'.includes(src[i])) adv(1); };
  const misc = () => {
    for (;;) {
      ws();
      if (src.startsWith('<!--', i)) { const e = src.indexOf('-->', i + 4); if (e < 0) fail('unterminated comment'); adv(e + 3 - i); continue; }
      if (src.startsWith('<!DOCTYPE', i) || src.startsWith('<!ENTITY', i)) fail('a DOCTYPE or entity declaration is refused');
      if (src.startsWith('<?', i)) fail('a processing instruction is refused');
      return;
    }
  };
  // XML declaration
  if (src.startsWith('<?xml', i) && /\s/.test(src[i + 5] || '')) {
    const e = src.indexOf('?>', i);
    if (e < 0) fail('unterminated XML declaration');
    adv(e + 2 - i);
  }
  misc();
  if (src[i] !== '<') fail('no root element');
  const root = element();
  misc();
  if (i < src.length) fail('content after the root element');
  return root;

  function element() {
    const startLine = line;
    adv(1);
    const m = NAME.exec(src.slice(i, i + 200));
    if (!m) fail('bad element name');
    const name = m[0];
    adv(name.length);
    const attrs = {};
    const attrOrder = [];
    for (;;) {
      const before = i;
      ws();
      if (src.startsWith('/>', i)) { adv(2); return { name, attrs, attrOrder, children: [], line: startLine }; }
      if (src[i] === '>') { adv(1); break; }
      if (i === before) fail(`expected whitespace in <${name}>`);
      const am = NAME.exec(src.slice(i, i + 200));
      if (!am) fail(`bad attribute in <${name}>`);
      const an = am[0];
      adv(an.length);
      ws();
      if (src[i] !== '=') fail(`attribute ${an} has no value`);
      adv(1);
      ws();
      const q = src[i];
      if (q !== '"' && q !== "'") fail(`attribute ${an} is not quoted`);
      const e = src.indexOf(q, i + 1);
      if (e < 0) fail('unterminated attribute value');
      const raw = src.slice(i + 1, e);
      if (raw.includes('<')) fail(`"<" in attribute ${an}`);
      if (Object.prototype.hasOwnProperty.call(attrs, an)) fail(`attribute ${an} repeated on <${name}>`);
      // XML attribute-value normalization: a literal tab, CR or LF reads as a space; a character reference (&#9;) keeps
      // its character, as a browser's XML parser does.
      attrs[an] = decodeEntities(raw.replace(/[\t\n\r]/g, ' '), i);
      attrOrder.push(an);
      adv(e + 1 - i);
    }
    const children = [];
    for (;;) {
      if (i >= src.length) fail(`<${name}> is not closed`);
      if (src.startsWith('</', i)) {
        adv(2);
        if (!src.startsWith(name, i)) fail(`</${name}> expected`);
        adv(name.length);
        ws();
        if (src[i] !== '>') fail('bad end tag');
        adv(1);
        return { name, attrs, attrOrder, children, line: startLine };
      }
      if (src.startsWith('<!--', i)) { const e = src.indexOf('-->', i + 4); if (e < 0) fail('unterminated comment'); adv(e + 3 - i); continue; }
      if (src.startsWith('<![CDATA[', i)) { const e = src.indexOf(']]>', i); if (e < 0) fail('unterminated CDATA'); children.push({ text: src.slice(i + 9, e) }); adv(e + 3 - i); continue; }
      if (src.startsWith('<!', i)) fail('a declaration inside the drawing is refused');
      if (src.startsWith('<?', i)) fail('a processing instruction is refused');
      if (src[i] === '<') { children.push(element()); continue; }
      const e = src.indexOf('<', i);
      const raw = src.slice(i, e < 0 ? src.length : e);
      children.push({ text: decodeEntities(raw, i) });
      adv(raw.length);
    }
  }
}
