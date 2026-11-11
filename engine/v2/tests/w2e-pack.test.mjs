// The packer marks a page packed with --accept-findings (review finding 9), and its policy leaves out
// nothing a capability in needs uses (finding 10). No browser; tests/browser/packed-browser.mjs plays a packed page.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pack, PackError, contentSecurityPolicy, CAPABILITY_CSP } from '../tools/pack.mjs';
import { repo, spec, eq, ok } from './helpers.mjs';

const fixture = path.join(repo, 'engine', 'v2', 'tests', 'pack-fixture');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-w2e-'));
const rm = (d) => fs.rmSync(d, { recursive: true, force: true });
const directives = (csp) => Object.fromEntries(csp.split(';').map(s => s.trim().split(/\s+/)).map(([k, ...v]) => [k, v.join(' ')]));

// The pack fixture with one error: a control aimed at a part the drawing does not have.
function broken() {
  const dir = tmp();
  fs.cpSync(fixture, dir, { recursive: true });
  const f = path.join(dir, 'scenes', 'one', 'scene.json');
  const doc = JSON.parse(fs.readFileSync(f, 'utf8'));
  doc.controls.lost = { kind: 'button', target: 'not-drawn', label: 'Lost' };
  fs.writeFileSync(f, JSON.stringify(doc));
  return dir;
}

export const tests = {
  async 'findings: a page packed with --accept-findings says so in package.json, the html and a visible notice'() {
    const src = broken(); const out = tmp();
    try {
      let refused = null;
      try { await pack(src, out); } catch (e) { refused = e; }
      ok(refused instanceof PackError, 'without --accept-findings the packer refuses');
      const r = await pack(src, out, { acceptFindings: true });
      const pkg = JSON.parse(fs.readFileSync(r.packagePath, 'utf8'));
      ok(Array.isArray(pkg.findings) && pkg.findings.length >= 1, 'package.json lists the findings');
      ok(pkg.findings.every(d => d.code.startsWith('E-') && typeof d.file === 'string' && typeof d.path === 'string'), JSON.stringify(pkg.findings));
      ok(pkg.findings.some(d => d.file === 'scenes/one/scene.json'), 'with the file');
      const html = fs.readFileSync(r.htmlPath, 'utf8');
      ok(html.includes(`<html lang="en" data-hsvg-findings="${pkg.findings.length}">`), 'the html element is marked');
      const notice = html.match(/<div id="hsvg-findings" role="note"[^>]*>([^<]*)<\/div>/);
      ok(notice && /Not for publishing/.test(notice[1]) && notice[1].includes(pkg.findings[0].code), `a visible notice: ${notice?.[1]}`);
      ok(!/display:\s*none|visibility:\s*hidden/.test(notice[0]), 'the notice is not hidden');
    } finally { rm(src); rm(out); }
  },
  async 'findings: a clean page has no findings key, no mark and no notice'() {
    const out = tmp();
    try {
      const r = await pack(fixture, out);
      const pkg = JSON.parse(fs.readFileSync(r.packagePath, 'utf8'));
      ok(!('findings' in pkg));
      const html = fs.readFileSync(r.htmlPath, 'utf8');
      ok(!html.includes('data-hsvg-findings') && !html.includes('hsvg-findings'));
      eq(r.accepted, []);
    } finally { rm(out); }
  },
  'csp: every capability of the spec has an entry, and the policy denies the network whatever needs say'() {
    const caps = fs.readdirSync(path.join(spec, 'capabilities')).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
    const missing = caps.filter(c => !(c in CAPABILITY_CSP) && !['ai', 'live-data', 'remote-seats'].includes(c));
    eq(missing, [], 'capabilities with no CSP entry');
    for (const c of caps) {
      const d = directives(contentSecurityPolicy('h', { needs: [c] }));
      eq(d['default-src'], "'none'", c); eq(d['connect-src'], "'none'", c);
      eq(d['frame-src'], "'none'", c); eq(d['worker-src'], "'none'", c); eq(d['object-src'], "'none'", c);
      eq(d['script-src'], "'sha256-h'", c);
    }
  },
  'csp: what the built capabilities use is allowed'() {
    // snapshot: a data: SVG drawn on a canvas and a blob: PNG; drawings: data: images; the player: style attributes.
    const d = directives(contentSecurityPolicy('h', { needs: ['synth', 'snapshot', 'shell', 'fit', 'physics', 'effects'] }));
    eq(d['img-src'], 'data: blob:');
    eq(d['style-src'], "'unsafe-inline'");
    eq(d['media-src'], "'none'", 'sound is Web Audio from bytes: no media element');
    eq(directives(contentSecurityPolicy('h', { fonts: true }))['font-src'], 'data:');
    ok(!('font-src' in d), 'no fonts without font files');
    eq(directives(contentSecurityPolicy('h', { needs: ['media'] }))['media-src'], 'blob: data:', 'recorded video plays from embedded bytes');
  },
};
