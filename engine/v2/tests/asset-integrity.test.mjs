// D56: a HyperSVG placed with a host-held fingerprint (integrity, the Subresource Integrity form "sha256-<base64>"),
// and the safety pass that always runs (src/asset-safety.mjs). The page-side play is in the browser suite
// (browser/asset-integrity-browser.mjs); these tests run what needs no DOM: the hash, the compare, the safety pass, the
// lean load, the module graph of the lean entry, and pack --asset's integrity line.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeAsset, readAsset } from '../src/asset.mjs';
import { drawingSafety, assetSafety, ELEMENTS, IMAGE_TYPES } from '../src/asset-safety.mjs';
import { parseIntegrity, integrityOf, verifyIntegrity } from '../src/integrity.mjs';
import { mountAsync, leanLoad } from '../web/asset-lean.mjs';
import { mount } from '../web/asset-web.mjs';
import { checkDrawing } from '../schema/drawing-check.mjs';
import { loadExperience } from '../src/load.mjs';
import { Player } from '../src/story.mjs';
import { hostApi } from '../src/host.mjs';
import { packAsset } from '../tools/pack.mjs';
import { repo, schemas, eq, ok, mapSource } from './helpers.mjs';

const fixture = path.join(repo, 'engine', 'v2', 'tests', 'k2f-fixture');
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'd56-'));
let packed;
async function lamp() { packed ??= await packAsset(fixture, temp()); return fs.readFileSync(packed.svgPath, 'utf8'); }
const sri = (text) => `sha256-${crypto.createHash('sha256').update(text, 'utf8').digest('base64')}`;
// A packed asset with one member changed and every digest inside made again: what a careful tamperer hands in.
function resealed(svg, edit, rel = null) {
  const a = readAsset(svg);
  rel ??= a.drawing;
  return makeAsset({ id: a.id, drawing: a.drawing, files: { ...a.files, [rel]: edit(a.files[rel]) } });
}
const refusal = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };
// The browser's own global crypto, taken away for one call (a page not served over HTTPS or from localhost).
async function withoutWebCrypto(fn) {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
  try { return await fn(); } finally { Object.defineProperty(globalThis, 'crypto', saved); }
}

// Hostile drawings: each edit puts something into the lamp's drawing that must never reach a page.
export const HOSTILE = {
  script: (t) => t.replace('</svg>', '<script>window.hacked = 1</script></svg>'),
  'script in CDATA': (t) => t.replace('</svg>', '<script><![CDATA[window.hacked = 1]]></script></svg>'),
  foreignObject: (t) => t.replace('</svg>', '<foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject></svg>'),
  'event handler': (t) => t.replace('<title>', '<g onload="window.hacked = 1"/><title>'),
  'event handler, upper case': (t) => t.replace('<title>', '<rect width="1" height="1" ONCLICK="window.hacked = 1"/><title>'),
  'javascript: link': (t) => t.replace('</svg>', '<a href="javascript:window.hacked=1"><rect width="9" height="9"/></a></svg>'),
  'javascript: on use': (t) => t.replace('</svg>', '<use href="javascript:window.hacked=1"/></svg>'),
  'image from outside': (t) => t.replace('</svg>', '<image href="https://example.invalid/x.png" width="9" height="9"/></svg>'),
  'image by relative path': (t) => t.replace('</svg>', '<image href="x.png" width="9" height="9"/></svg>'),
  'image with a hidden scheme': (t) => t.replace('</svg>', '<image href="java&#9;script:window.hacked=1" width="9" height="9"/></svg>'),
  'image as an html data URI': (t) => t.replace('</svg>', '<image href="data:text/html,&lt;script&gt;window.hacked=1&lt;/script&gt;" width="9" height="9"/></svg>'),
  'use of an outside file': (t) => t.replace('</svg>', '<use xlink:href="https://example.invalid/s.svg#a" xmlns:xlink="http://www.w3.org/1999/xlink"/></svg>'),
  'fill from outside': (t) => t.replace('<title>', '<rect width="9" height="9" fill="url(https://example.invalid/p.svg#g)"/><title>'),
  'style url': (t) => t.replace('<title>', '<rect width="9" height="9" style="fill:url(//example.invalid/p.svg#g)"/><title>'),
  'style escape': (t) => t.replace('<title>', '<rect width="9" height="9" style="fill:\\75rl(//example.invalid/p)"/><title>'),
  'style import': (t) => t.replace('<title>', '<rect width="9" height="9" style="@import \'//example.invalid/s.css\'"/><title>'),
  'image function': (t) => t.replace('<title>', '<rect width="9" height="9" mask="image(\'//example.invalid/m.png\')"/><title>'),
  'style element': (t) => t.replace('</svg>', '<style>rect{fill:url(//example.invalid/p)}</style></svg>'),
  'set to javascript:': (t) => t.replace('</svg>', '<set attributeName="href" to="javascript:window.hacked=1"/></svg>'),
  animate: (t) => t.replace('</svg>', '<animate attributeName="x" from="0" to="9" dur="1s"/></svg>'),
  feImage: (t) => t.replace('</svg>', '<filter id="f9"><feImage href="https://example.invalid/i.png"/></filter></svg>'),
  'element in another namespace': (t) => t.replace('</svg>', '<h:script xmlns:h="http://www.w3.org/1999/xhtml">window.hacked = 1</h:script></svg>'),
  'xml:base': (t) => t.replace('<title>', '<g xml:base="https://example.invalid/"/><title>'),
  'url in tool data': (t) => t.replace('<title>', '<g data-x="url(https://example.invalid/t)"/><title>'),
  doctype: (t) => `<!DOCTYPE svg [<!ENTITY x "y">]>\n${t}`,
};
const PI = (svg) => `<?xml-stylesheet href="https://example.invalid/s.css"?>\n${svg}`;

export const tests = {
  // ---------- the integrity value ----------
  async 'D56: the integrity value is sha256- and the base64 SHA-256 of the exact bytes, with Web Crypto or without'() {
    const svg = await lamp();
    const bytes = new TextEncoder().encode(svg);
    eq(await integrityOf(bytes), sri(svg));
    eq(await integrityOf(bytes, null), sri(svg), 'the plain hash gives the same value');
    eq(await verifyIntegrity(bytes, sri(svg)), 'subtle');
    eq(await verifyIntegrity(bytes, sri(svg), null), 'script');
    eq(await verifyIntegrity(bytes, `sha256-${'A'.repeat(43)}= ${sri(svg)}?ct=image/svg+xml`), 'subtle', 'any one of several values matches; an option is ignored');
  },
  'D56: a malformed integrity value is E-ASSET-INTEGRITY'() {
    for (const v of ['', '   ', 'sha256-abc', 'sha384-' + 'A'.repeat(64), 'md5-xyz', `sha256:${'a'.repeat(64)}`, null, 42]) {
      let e = null; try { parseIntegrity(v); } catch (x) { e = x; }
      eq(e?.code, 'E-ASSET-INTEGRITY', `${JSON.stringify(v)}: ${e?.message}`);
    }
  },

  // ---------- a match, a mismatch, a resealed file ----------
  async 'D56: a match plays with no schemas: the lean load reads the asset and the engine plays it'() {
    const svg = await lamp();
    const bytes = new TextEncoder().encode(svg);
    eq(await verifyIntegrity(bytes, sri(svg)), 'subtle');
    const a = readAsset(svg);
    eq(assetSafety(a.files), [], 'the safety pass passes the lamp');
    const loaded = leanLoad(mapSource(a.files));
    ok(loaded.experience, JSON.stringify(loaded.diags));
    const p = new Player(loaded.experience, {});
    ok(p.start().ok);
    const host = hostApi(p);
    const heard = [];
    host.on('hsvg.changed', (e) => heard.push(e.detail));
    ok(p.activate('lamp', 'power', undefined, 'person').ok);
    eq(host.read('on'), true);
    host.set('shade', 'sky');
    eq(heard, [{ name: 'on', value: true, by: 'person' }, { name: 'shade', value: 'sky', by: 'host' }]);
    // The lean load reads what the checked load reads.
    const full = loadExperience(mapSource(a.files), schemas());
    eq(Object.keys(loaded.experience.scenes), Object.keys(full.experience.scenes));
    eq(loaded.experience.doc, full.experience.doc, 'the same experience document, grants included');
  },
  async 'D56: a mismatch is refused with E-ASSET-INTEGRITY before anything is read'() {
    const svg = await lamp();
    const other = svg.replace('<title>Lamp</title>', '<title>Lamb</title>');
    const e = await refusal(() => mountAsync(null, other, {}, { integrity: sri(svg) }));
    eq(e?.code, 'E-ASSET-INTEGRITY', e?.message);
    ok(/does not match its integrity value/.test(e.message) && e.message.includes(sri(other)), e.message);
    const bad = await refusal(() => mountAsync(null, svg, {}, { integrity: 'sha256-nope' }));
    eq(bad?.code, 'E-ASSET-INTEGRITY', bad?.message);
  },
  async 'D56: a tampered file with its inner digests made again is refused on the integrity path'() {
    const svg = await lamp();
    const tampered = resealed(svg, (t) => t.replace('"label": "Brightness"', '"label": "Dimmer"'), 'scenes/lamp/scene.json');
    ok(tampered !== svg && tampered.includes('Dimmer'), 'the member changed');
    ok(readAsset(tampered), 'the digests inside the file match again: they protect nothing');
    const e = await refusal(() => mountAsync(null, tampered, {}, { integrity: sri(svg) }));
    eq(e?.code, 'E-ASSET-INTEGRITY', e?.message);
    const drawn = resealed(svg, (t) => t.replace('<title>', '<title>Hello '));
    eq((await refusal(() => mountAsync(null, drawn, {}, { integrity: sri(svg) })))?.code, 'E-ASSET-INTEGRITY');
  },
  async 'D56: bytes are hashed as given; text is hashed as its UTF-8'() {
    const svg = await lamp();
    const bytes = new TextEncoder().encode(svg);
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...bytes]);
    eq((await refusal(() => mountAsync(null, withBom, {}, { integrity: sri(svg) })))?.code, 'E-ASSET-INTEGRITY', 'a byte order mark is a different file');
    eq((await refusal(() => mountAsync(null, 7, {}, { integrity: sri(svg) })))?.code, 'E-ASSET');
  },

  // ---------- the safety pass ----------
  'D56: the safety pass knows the allowed subset of the drawing rules'() {
    const rules = schemas().drawing;
    eq([...ELEMENTS].sort(), [...rules.elements.allowed].sort());
    eq([...IMAGE_TYPES].sort(), [...rules.limits.imageDataTypes].sort());
    for (const r of rules.elements.refused) ok(!ELEMENTS.includes(r), `${r} is refused`);
  },
  async 'D56: every hostile drawing is refused by the safety pass, and by the drawing check too'() {
    const drawing = readAsset(await lamp()).files['scenes/lamp/lamp.svg'];
    eq(drawingSafety(drawing), []);
    for (const [name, edit] of Object.entries({ ...HOSTILE, 'processing instruction': PI })) {
      const t = edit(drawing);
      ok(t !== drawing, `${name}: the edit applies`);
      const s = drawingSafety(t);
      ok(s.length && s.every(d => /^E-SVG-(UNSAFE|PARSE|ROOT)$/.test(d.code)), `${name}: ${JSON.stringify(s)}`);
      // A relative image path passes the drawing check alone; the checker refuses it as an undeclared picture.
      if (name !== 'image by relative path') ok(checkDrawing(t, schemas().drawing).diags.some(d => d.code.startsWith('E-')), `${name}: the drawing check refuses it too`);
    }
  },
  async 'D56: a hostile asset is refused with integrity (even one the host approved) and without it'() {
    const svg = await lamp();
    for (const [name, edit] of Object.entries(HOSTILE)) {
      let bad;
      try { bad = resealed(svg, edit); } catch (e) { ok(e.code === 'E-ASSET', `${name}: ${e.message}`); continue; } // no <svg> root to carry the record
      const withIt = await refusal(() => mountAsync(null, bad, {}, { integrity: sri(bad) }));
      ok(/^E-SVG-(UNSAFE|PARSE|ROOT)$/.test(withIt?.code || ''), `${name} with integrity: ${withIt?.code} ${withIt?.message}`);
      ok(withIt.diagnostics?.length && withIt.diagnostics[0].file === 'scenes/lamp/lamp.svg', `${name}: the safety pass names the file`);
      const without = await refusal(() => mount(null, bad, {}, { schemas: schemas() }));
      ok(/^E-SVG-(UNSAFE|PARSE|ROOT)$/.test(without?.code || ''), `${name} without integrity: ${without?.code} ${without?.message}`);
      const later = await refusal(() => mountAsync(null, bad, {}, { schemas: schemas() }));
      ok(/^E-SVG-(UNSAFE|PARSE|ROOT)$/.test(later?.code || ''), `${name} with mountAsync and no integrity: ${later?.code}`);
    }
  },
  async 'D56: the safety pass runs on the full path too, before the schema check, and checks every drawing of an asset'() {
    const svg = await lamp();
    // A picture named by a relative path: the schema check alone says E-REF-UNKNOWN (no such declared picture); the
    // safety pass, which runs first, says E-SVG-UNSAFE (an asset names nothing outside its file).
    const bad = resealed(svg, HOSTILE['image by relative path']);
    ok(loadExperience(mapSource(readAsset(bad).files), schemas()).diags.some(d => d.code === 'E-REF-UNKNOWN'), 'the schema check finds E-REF-UNKNOWN');
    const e = await refusal(() => mount(null, bad, {}, { schemas: schemas() }));
    eq(e?.code, 'E-SVG-UNSAFE', `the safety pass refused it first: ${e?.code} ${e?.message}`);
    ok(/of an <image> in an asset/.test(e.message), e.message);
    eq(assetSafety({ 'a.json': '{}', 'scenes/x/tall.svg': '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>' }).map(d => `${d.code} ${d.file}`), ['E-SVG-UNSAFE scenes/x/tall.svg']);
  },
  async 'D56: every drawing that passes the drawing check passes the safety pass (the lamp, the guide and the examples)'() {
    const rules = schemas().drawing;
    const roots = ['engine/v2/tests', 'examples', 'docs/guide'].map(r => path.join(repo, ...r.split('/')));
    let n = 0;
    const walk = (d) => {
      if (!fs.existsSync(d)) return;
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { if (!['node_modules', 'private', 'sources'].includes(e.name)) walk(p); continue; }
        if (!p.endsWith('.svg')) continue;
        const t = fs.readFileSync(p, 'utf8');
        if (!/data-hsvg-version="2/.test(t) || checkDrawing(t, rules).diags.some(x => x.code.startsWith('E-'))) continue;
        n++;
        // A drawing of an experience may name a declared picture by its path; an asset holds no picture file.
        const s = drawingSafety(t).filter(x => !/of an <image> in an asset/.test(x.message));
        eq(s, [], path.relative(repo, p));
      }
    };
    roots.forEach(walk);
    ok(n > 50, `only ${n} drawings found`);
  },

  // ---------- without Web Crypto ----------
  async 'D58: without Web Crypto, the plain hash compares, and a match skips the schema check there too'() {
    const svg = await lamp();
    // A file that only the schema check refuses: a scene with a key no scene has.
    const odd = resealed(svg, (t) => t.replace('"kind": "scene",', '"kind": "scene", "extra": 1,'), 'scenes/lamp/scene.json');
    eq(assetSafety(readAsset(odd).files), [], 'the safety pass has nothing against it');
    const hostile = resealed(svg, HOSTILE.script);
    await withoutWebCrypto(async () => {
      eq(globalThis.crypto, undefined);
      eq((await refusal(() => mountAsync(null, odd, {}, { integrity: sri(svg) })))?.code, 'E-ASSET-INTEGRITY', 'a mismatch is refused');
      eq((await refusal(() => mountAsync(null, hostile, {}, { integrity: sri(hostile) })))?.code, 'E-SVG-UNSAFE', 'a match still meets the safety pass');
      const lean = await refusal(() => mountAsync(null, odd, {}, { integrity: sri(odd) }));
      ok(!['E-ASSET-INTEGRITY', 'E-KEY-UNKNOWN'].includes(lean?.code), `a match needs no schemas and runs no schema check: ${lean?.code} ${lean?.message}`);
    });
    // With Web Crypto and a match, the schema check is skipped: the lean load takes the file the host vouched for.
    ok(leanLoad(mapSource(readAsset(odd).files)).experience, 'the lean load does not run the schema check');
  },
  async 'D56: the lean load refuses an add-on preset and a kit, which an asset never uses'() {
    const a = readAsset(await lamp());
    const preset = { ...a.files, 'scenes/lamp/scene.json': a.files['scenes/lamp/scene.json'].replace('"kind": "scene",', '"kind": "scene", "presets": [{"use": "sparkle"}],') };
    eq(leanLoad(mapSource(preset)).diags.map(d => d.code), ['E-ASSET']);
    const kit = { ...a.files, 'experience.json': a.files['experience.json'].replace('"language": "en",', '"language": "en", "kit": {"id": "k", "version": "1.0.0"},') };
    ok(!leanLoad(mapSource(kit)).experience, 'a kit pin is refused by the reader');
  },
  async 'D56: mount without integrity needs the schemas; mountAsync takes the shared set (added after 2.0.0-next.1)'() {
    const svg = await lamp();
    const e = await refusal(() => mountAsync(null, svg, {}, { schemas: { not: 'schemas' } }));
    ok(e instanceof TypeError && /schemas/.test(e.message), String(e));
    const m = await refusal(() => mount(null, svg, {}, {}));
    ok(m instanceof TypeError && /schemas/.test(m.message), String(m));
  },

  // ---------- the lean load ----------
  'D56: the lean entry downloads no schema validation, no checker, no kit and no add-on machinery'() {
    const graph = (file) => {
      const seen = new Set();
      const walk = (f) => {
        if (seen.has(f)) return;
        seen.add(f);
        const t = fs.readFileSync(f, 'utf8');
        for (const m of t.matchAll(/^\s*(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm)) {
          const s = m[1] || m[2];
          if (s.startsWith('.')) walk(path.resolve(path.dirname(f), s));
        }
      };
      walk(path.join(repo, ...file.split('/')));
      return [...seen].map(f => path.relative(path.join(repo, 'engine', 'v2'), f).split(path.sep).join('/'));
    };
    const lean = graph('engine/v2/web/asset-lean.mjs');
    for (const m of ['schema/validate.mjs', 'schema/check-document.mjs', 'schema/drawing-check.mjs', 'schema/drafts.mjs', 'src/kit.mjs', 'src/addons.mjs', 'src/load.mjs', 'web/mount-web.mjs']) ok(!lean.includes(m), `the lean entry loads ${m}`);
    for (const m of ['web/player-web.mjs', 'src/asset.mjs', 'src/asset-safety.mjs', 'src/integrity.mjs']) ok(lean.includes(m), `the lean entry lacks ${m}`);
    ok(graph('engine/v2/web/asset-web.mjs').includes('web/mount-checked.mjs'), 'asset-web.mjs keeps the checked mount for mount()'); // N5: mount-checked.mjs, without kit or add-on code
  },

  // ---------- the tool ----------
  async 'D56: pack --asset prints the file\'s integrity value'() {
    const out = temp();
    const r = spawnSync(process.execPath, [path.join(repo, 'engine', 'v2', 'tools', 'pack.mjs'), '--asset', fixture, out], { encoding: 'utf8' });
    eq(r.status, 0, r.stdout + r.stderr);
    const line = r.stdout.split('\n').find(l => l.startsWith('integrity '));
    const file = fs.readFileSync(path.join(out, 'lamp.svg'));
    eq(line, `integrity sha256-${crypto.createHash('sha256').update(file).digest('base64')}`);
    const again = await packAsset(fixture, temp());
    eq(`integrity ${again.integrity}`, line, 'packAsset returns it too');
  },
};
