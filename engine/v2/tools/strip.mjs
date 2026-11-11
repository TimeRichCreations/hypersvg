// The production build's comment stripper (10.11: the engine's sizes are measured on the built bundle). It removes
// JavaScript comments from a module's source and keeps everything else as written: strings, template literals (with
// their ${...} parts), regular expression literals, every line break (so automatic semicolons and the bundler's line
// patterns are unchanged) and the code's own spacing. A line left empty goes. Node standard library only.
// The source must be valid JavaScript; a division and a regular expression are told apart by what precedes the slash.
const REGEX_AFTER = new Set([...'(,=:[!&|?{};+-*%<>~^']);
const REGEX_WORDS = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await', 'instanceof']);
const WORD = /[A-Za-z0-9_$]/;

export function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let last = ''; // the last significant character of code
  let word = ''; // the identifier or keyword that ends just before, if any
  const braces = []; // 'b' for a code brace, 't' for a template's ${
  const regexOk = () => (last === '' || REGEX_AFTER.has(last) || REGEX_WORDS.has(word));
  const template = () => { // from after a backtick to its closing backtick or a ${ (which returns to code)
    for (;;) {
      if (i >= n) throw new Error('an unclosed template literal');
      const c = src[i];
      if (c === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
      if (c === '`') { out += c; i++; last = '`'; word = ''; return; }
      if (c === '$' && src[i + 1] === '{') { out += '${'; i += 2; braces.push('t'); last = '{'; word = ''; return; }
      out += c; i++;
    }
  };
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end < 0) throw new Error('an unclosed comment');
      out += src.slice(i, end).includes('\n') ? '\n' : ' ';
      i = end + 2; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) { if (src[j] === '\\') j++; if (src[j] === '\n') throw new Error('a line break in a string'); j++; }
      if (j >= n) throw new Error('an unclosed string');
      out += src.slice(i, j + 1); i = j + 1; last = c; word = ''; continue;
    }
    if (c === '`') { out += c; i++; template(); continue; }
    if (c === '}' && braces.length && braces[braces.length - 1] === 't') { braces.pop(); out += c; i++; template(); continue; }
    if (c === '{') braces.push('b');
    if (c === '}') braces.pop();
    if (c === '/' && regexOk()) {
      let j = i + 1; let cls = false;
      while (j < n) {
        const x = src[j];
        if (x === '\\') { j += 2; continue; }
        if (x === '\n') throw new Error('a line break in a regular expression');
        if (cls) { if (x === ']') cls = false; } else if (x === '[') cls = true; else if (x === '/') break;
        j++;
      }
      j++;
      while (j < n && WORD.test(src[j])) j++; // flags
      out += src.slice(i, j); i = j; last = '/'; word = ''; continue;
    }
    out += c; i++;
    if (WORD.test(c)) { word = (WORD.test(src[i - 2] ?? '') && out.length > 1 ? word : '') + c; last = c; } else if (!/\s/.test(c)) { last = c; word = ''; } else if (c === '\n' || c === ' ' || c === '\t') { /* keep last and word */ }
  }
  if (braces.length) throw new Error('unbalanced braces');
  return out.split('\n').filter(l => l.trim() !== '').map(l => l.replace(/[ \t]+$/, '')).join('\n') + '\n';
}
