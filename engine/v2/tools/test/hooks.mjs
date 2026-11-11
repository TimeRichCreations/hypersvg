// A packed page published without test hooks (packed without --test) is tested through a copy with the hooks on: the
// pack's test flag is set and the CSP's script hash is computed again for the changed script. Nothing else in the
// page changes. The copy is written to the out folder; the page itself is never changed.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MARK = /const pack = \{ files: /;
export function hasHooks(html) { const s = scriptOf(html); return !!s && /, test: true \};/.test(s.text); }
function scriptOf(html) {
  const a = html.indexOf('<script>'); const b = html.indexOf('</script>', a);
  if (a < 0 || b < 0) return null;
  return { start: a + '<script>'.length, end: b, text: html.slice(a + '<script>'.length, b) };
}
// Returns the copy's path, or null when the page is not a packed 2.0 page this can change.
export function withHooks(file, outDir) {
  const html = fs.readFileSync(file, 'utf8');
  const s = scriptOf(html);
  if (!s || !MARK.test(s.text)) return null;
  const i = s.text.search(MARK);
  const close = s.text.indexOf(' };\n', i) >= 0 ? s.text.indexOf(' };\n', i) : s.text.indexOf(' };', i);
  if (close < 0) return null;
  const script = `${s.text.slice(0, close)}, test: true${s.text.slice(close)}`;
  const oldHash = crypto.createHash('sha256').update(s.text, 'utf8').digest('base64');
  const newHash = crypto.createHash('sha256').update(script, 'utf8').digest('base64');
  if (!html.includes(`'sha256-${oldHash}'`)) return null;
  const out = html.slice(0, s.start) + script + html.slice(s.end);
  fs.mkdirSync(outDir, { recursive: true });
  const to = path.join(outDir, `${path.basename(file, path.extname(file))}.hooks.html`);
  fs.writeFileSync(to, out.replace(`'sha256-${oldHash}'`, `'sha256-${newHash}'`));
  return to;
}
