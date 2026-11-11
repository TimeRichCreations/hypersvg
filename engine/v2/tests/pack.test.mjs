// The packer (tools/pack.mjs): packs a tiny fixture and checks the page, its policy and the package descriptor.
// No browser. The browser run is tests/browser/packed-browser.mjs.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pack, PackError, bundle } from '../tools/pack.mjs';
import { repo, eq, ok } from './helpers.mjs';

const fixture = path.join(repo, 'engine', 'v2', 'tests', 'pack-fixture');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-pack-'));
const rm = (d) => fs.rmSync(d, { recursive: true, force: true });
const sha = (b) => 'sha256:' + crypto.createHash('sha256').update(b).digest('hex');

async function packed() {
  const out = tmp();
  try {
    const r = await pack(fixture, out);
    return { r, html: fs.readFileSync(r.htmlPath, 'utf8'), pkg: JSON.parse(fs.readFileSync(r.packagePath, 'utf8')), out };
  } catch (e) { rm(out); throw e; }
}

export const tests = {
  async 'the CSP carries the hash of the one inline script'() {
    const { html, out } = await packed();
    try {
      const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/)?.[1];
      ok(csp, 'no CSP meta');
      ok(csp.includes("default-src 'none'") && csp.includes("connect-src 'none'"), csp);
      const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
      eq(scripts.length, 1, 'one inline script');
      eq((html.match(/<script/g) || []).length, 1, 'no other script element');
      const hash = crypto.createHash('sha256').update(scripts[0][1], 'utf8').digest('base64');
      ok(csp.includes(`script-src 'sha256-${hash}'`), `hash ${hash} not in ${csp}`);
      ok(!/script-src[^;]*unsafe/.test(csp), 'scripts must not be unsafe');
    } finally { rm(out); }
  },

  async 'the page has no network URLs'() {
    const { html, out } = await packed();
    try {
      ok(!/\b(?:src|href|action|poster)\s*=\s*["']?\s*(?:https?:)?\/\//i.test(html), 'a src/href points at the network');
      ok(!/url\(\s*["']?\s*(?:https?:)?\/\//i.test(html), 'a url() points at the network');
      const markup0 = html.replace(/<script>[\s\S]*?<\/script>/, '');
      ok(!/@import/.test(markup0), 'no @import');
      // An SVG or XML namespace string is the only http:// text allowed in markup.
      const markup = html.replace(/<script>[\s\S]*?<\/script>/, '');
      const urls = markup.match(/https?:\/\/[^\s"'<>)]+/g) || [];
      eq(urls.filter(u => !/^http:\/\/www\.w3\.org\//.test(u)), []);
    } finally { rm(out); }
  },

  async 'every member digest matches its file, and the sound is embedded'() {
    const { r, pkg, html, out } = await packed();
    try {
      eq(pkg.format, 'hsvg/2.0'); eq(pkg.kind, 'package'); eq(pkg.id, 'pack-fixture');
      eq(pkg.experience, 'experience.json'); eq(pkg.needs, [], 'made sounds are core: the fixture needs nothing (D31.2)'); eq(pkg.about.title, 'Packer fixture');
      eq(Object.keys(pkg.members), ['experience.json', 'scenes/one/one.svg', 'scenes/one/scene.json', 'sounds/blip.ogg']);
      eq(r.members, 4);
      for (const [rel, digest] of Object.entries(pkg.members)) {
        ok(/^sha256:[0-9a-f]{64}$/.test(digest), `${rel} digest form`);
        eq(digest, sha(fs.readFileSync(path.join(fixture, ...rel.split('/')))), rel);
      }
      ok(!('package.json' in pkg.members), 'package.json is not its own member');
      // The sound is in the page as base64 of the exact bytes.
      const b64 = fs.readFileSync(path.join(fixture, 'sounds', 'blip.ogg')).toString('base64');
      ok(html.includes(b64), 'sound bytes embedded');
    } finally { rm(out); }
  },

  async 'a folder with a schema error is refused'() {
    const bad = tmp(); const out = tmp();
    try {
      fs.cpSync(fixture, bad, { recursive: true });
      const scene = path.join(bad, 'scenes', 'one', 'scene.json');
      const doc = JSON.parse(fs.readFileSync(scene, 'utf8'));
      doc.values.n.type = 'nonsense';
      fs.writeFileSync(scene, JSON.stringify(doc));
      let err;
      try { await pack(bad, out); } catch (e) { err = e; }
      ok(err instanceof PackError, 'PackError expected');
      ok(err.diags.length > 0, 'findings listed');
      ok(!fs.existsSync(path.join(out, 'pack-fixture.html')), 'nothing written');
    } finally { rm(bad); rm(out); }
  },

  'the bundler keeps module scopes apart and refuses outside imports'() {
    const dir = tmp();
    try {
      fs.writeFileSync(path.join(dir, 'a.mjs'), "import { f } from './b.mjs';\nconst x = 1;\nexport function g() { return x + f(); }\n");
      fs.writeFileSync(path.join(dir, 'b.mjs'), "const x = 10;\nexport function f() { return x; }\n");
      const b = bundle(path.join(dir, 'a.mjs'));
      const run = new Function(`const defs = {}; const cache = {}; function req(n) { if (n in cache) return cache[n]; const exp = cache[n] = {}; defs[n](exp); return exp; }\n${b.defs}\nreturn req(${b.entry}).g();`);
      eq(run(), 11);
      fs.writeFileSync(path.join(dir, 'c.mjs'), "import fs from 'node:fs';\nexport const y = fs;\n");
      let msg = '';
      try { bundle(path.join(dir, 'c.mjs')); } catch (e) { msg = e.message; }
      ok(/node:fs/.test(msg), msg);
    } finally { rm(dir); }
  },
};
