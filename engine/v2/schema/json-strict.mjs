// Strict JSON reading for HyperSVG 2.0 documents (2.1 rule 1): one UTF-8 JSON object, no repeated key, finite
// numbers, and never the keys __proto__, prototype or constructor. Any failure is E-JSON.
// Plain ES module with no imports, so the browser engine can use it too.

const UNSAFE = new Set(['__proto__', 'prototype', 'constructor']);

export class JsonError extends Error {
  constructor(message, at) { super(message); this.code = 'E-JSON'; this.at = at; }
}

export function parseStrict(text) {
  if (typeof text !== 'string') throw new JsonError('not text', 0);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  let i = 0;
  const ws = () => { while (i < text.length && ' \t\n\r'.includes(text[i])) i++; };
  const fail = (m) => { throw new JsonError(`${m} at character ${i}`, i); };
  const value = (path) => {
    ws();
    const c = text[i];
    if (c === '{') return object(path);
    if (c === '[') return array(path);
    if (c === '"') return string();
    if (c === 't' && text.startsWith('true', i)) { i += 4; return true; }
    if (c === 'f' && text.startsWith('false', i)) { i += 5; return false; }
    if (c === 'n' && text.startsWith('null', i)) { i += 4; return null; }
    return number();
  };
  const object = (path) => {
    i++;
    const out = Object.create(null);
    ws();
    if (text[i] === '}') { i++; return toPlain(out); }
    for (;;) {
      ws();
      if (text[i] !== '"') fail('expected a key');
      const k = string();
      if (UNSAFE.has(k)) fail(`the key "${k}" is refused`);
      if (Object.prototype.hasOwnProperty.call(out, k)) fail(`the key "${k}" is repeated in ${path || 'the document'}`);
      ws();
      if (text[i] !== ':') fail('expected ":"');
      i++;
      out[k] = value(path ? `${path}.${k}` : k);
      ws();
      if (text[i] === ',') { i++; continue; }
      if (text[i] === '}') { i++; return toPlain(out); }
      fail('expected "," or "}"');
    }
  };
  const array = (path) => {
    i++;
    const out = [];
    ws();
    if (text[i] === ']') { i++; return out; }
    for (;;) {
      out.push(value(`${path}[${out.length}]`));
      ws();
      if (text[i] === ',') { i++; continue; }
      if (text[i] === ']') { i++; return out; }
      fail('expected "," or "]"');
    }
  };
  const string = () => {
    const start = i;
    i++;
    let s = '';
    for (;;) {
      if (i >= text.length) fail('unterminated string');
      const c = text[i];
      if (c === '"') { i++; return s; }
      if (c < ' ') fail('control character in a string');
      if (c === '\\') {
        const e = text[i + 1];
        const map = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
        if (e in map) { s += map[e]; i += 2; continue; }
        if (e === 'u') {
          const h = text.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(h)) fail('bad \\u escape');
          s += String.fromCharCode(parseInt(h, 16)); i += 6; continue;
        }
        fail('bad escape');
      }
      s += c; i++;
    }
    // unreachable
    return start;
  };
  const number = () => {
    const m = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/.exec(text.slice(i, i + 400));
    if (!m) fail('unexpected character');
    i += m[0].length;
    const n = Number(m[0]);
    if (!Number.isFinite(n)) fail('number is not finite');
    return n;
  };
  ws();
  if (text[i] !== '{') fail('a document is one JSON object');
  const doc = value('');
  ws();
  if (i !== text.length) fail('text after the object');
  return doc;
}

function toPlain(o) {
  const out = {};
  for (const k of Object.keys(o)) out[k] = o[k];
  return out;
}
