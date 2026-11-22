// The lean player (added after 2.0.0-next.1): the reader without the members' digest pass after an integrity match, the safety pass that
// still runs, a file without integrity played through the full one-file player (fullPlayer), the shared schemas, and
// every option reaching the mount. The page-side play is in browser/lean-fallback-browser.mjs; these tests run what
// needs no DOM. The full player here is a small stand-in module written to a temporary folder: Node imports it by its
// file address as a page imports the real one.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { makeAsset, readAsset, readTrustedAsset, assetPackage } from '../src/asset.mjs';
import { mountAsync, useSchemas } from '../web/asset-lean.mjs';
import { VERSION } from '../src/version.mjs';
import { packAsset } from '../tools/pack.mjs';
import { repo, schemas, eq, ok } from './helpers.mjs';
import { HOSTILE } from './asset-integrity.test.mjs';

const fixture = path.join(repo, 'engine', 'v2', 'tests', 'k2f-fixture');
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'n2b-'));
let packed;
async function lamp() { packed ??= await packAsset(fixture, temp()); return fs.readFileSync(packed.svgPath, 'utf8'); }
const sri = (text) => `sha256-${crypto.createHash('sha256').update(text, 'utf8').digest('base64')}`;
const refusal = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };
// The lamp with one member digest in its record changed: the file's bytes are what a host would hash.
function wrongDigest(svg, rel = 'experience.json') {
  const at = svg.indexOf(`"${rel}":"sha256:`);
  ok(at > 0, `the record lists ${rel}`);
  const d = at + rel.length + 11;
  return svg.slice(0, d) + (svg[d] === '0' ? '1' : '0') + svg.slice(d + 1);
}
const code = (fn) => { try { fn(); return null; } catch (e) { return e.code; } };

// A stand-in for the full one-file player: its VERSION, its sharedSchemas() and its checkedParts, recording each call.
function fullPlayerFile(version = VERSION, { parts = true } = {}) {
  const dir = temp();
  const file = path.join(dir, 'hypersvg-asset.js');
  fs.writeFileSync(file, `
const log = (globalThis.__n2bFull ??= { loads: 0, schemas: 0, mounts: [] });
log.loads++;
export const VERSION = ${JSON.stringify(version)};
export function sharedSchemas() { log.schemas++; return Promise.resolve(globalThis.__n2bSchemas); }
${parts ? `export const checkedParts = {
  mountChecked(element, pkg, options, loadAsset) {
    log.mounts.push({ element, options, loadAsset, members: Object.keys(pkg).sort() });
    return { read: () => undefined, set() {}, on() { return () => {}; } };
  },
  loadAsset() { return 'the full player loadAsset'; },
};` : ''}
`);
  return pathToFileURL(file).href;
}
const log = () => (globalThis.__n2bFull ??= { loads: 0, schemas: 0, mounts: [] });

export const tests = {
  // ---------- the reader without the digest pass ----------
  async 'after an integrity match the members are not hashed again; the result is readAsset\'s with the digests'() {
    const svg = await lamp();
    const a = readAsset(svg);
    const t = readTrustedAsset(svg);
    eq({ id: t.id, drawing: t.drawing, files: t.files }, a, 'the same asset');
    const record = JSON.parse(/<metadata>([^<]*)<\/metadata>/.exec(svg)[1]).asset;
    eq(t.digests, record.members, 'the digests are the record\'s');
    // A changed digest is caught by readAsset only: readTrustedAsset computes none.
    const bad = wrongDigest(svg);
    eq(code(() => readAsset(bad)), 'E-PACKAGE-DIGEST');
    eq(code(() => readTrustedAsset(bad)), null, 'no digest is computed after an integrity match');
  },
  async 'the reader without digests still checks the record: its shape, member names and paths'() {
    const svg = await lamp();
    const a = readAsset(svg);
    const record = JSON.parse(/<metadata>([^<]*)<\/metadata>/.exec(svg)[1]);
    const withRecord = (r) => svg.replace(/<metadata>[^<]*<\/metadata>/, `<metadata>${JSON.stringify(r).replace(/[<>&]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)}</metadata>`);
    const edit = (fn) => { const r = structuredClone(record); fn(r.asset); return withRecord(r); };
    eq(readTrustedAsset(withRecord(record)).files, a.files, 'the record written again reads the same');
    const cases = {
      'a member listed but missing': [edit((x) => { x.members['gone.json'] = x.members['experience.json']; }), 'E-PACKAGE-MEMBER'],
      'a file not listed': [edit((x) => { x.files['extra.json'] = '{}'; }), 'E-PACKAGE-MEMBER'],
      'a path that climbs': [edit((x) => { x.files['../up.json'] = '{}'; x.members['../up.json'] = x.members['experience.json']; }), 'E-ASSET'],
      'a digest that is not one': [edit((x) => { x.members['experience.json'] = 'sha256:nope'; }), 'E-ASSET', 'E-PACKAGE-DIGEST'],
      'an extra key': [edit((x) => { x.more = 1; }), 'E-ASSET'],
      'another format': [edit((x) => { x.format = 'hsvg/9'; }), 'E-ASSET'],
      'no members': [edit((x) => { delete x.members; }), 'E-ASSET'],
    };
    for (const [name, [text, want, full = want]] of Object.entries(cases)) {
      eq(code(() => readTrustedAsset(text)), want, name);
      eq(code(() => readAsset(text)), full, `${name} (readAsset)`);
    }
    eq(code(() => readTrustedAsset(svg, { maxBytes: 10 })), 'E-ASSET', 'the size limit');
  },
  async 'assetPackage with the known digests gives the same package, hashing only what changed'() {
    const svg = await lamp();
    const a = readAsset(svg); const t = readTrustedAsset(svg);
    const same = (x, y) => eq(Object.fromEntries(Object.entries(x).map(([k, v]) => [k, [...v]])), Object.fromEntries(Object.entries(y).map(([k, v]) => [k, [...v]])));
    same(assetPackage({ id: t.id, files: t.files, digests: t.digests }), assetPackage(a));
    // A digest given is used as it is: the package lists it (so a changed member must not keep its old digest).
    const fake = { ...t.digests, 'experience.json': `sha256:${'0'.repeat(64)}` };
    const desc = JSON.parse(new TextDecoder().decode(assetPackage({ id: t.id, files: t.files, digests: fake })['package.json']));
    eq(desc.members['experience.json'], `sha256:${'0'.repeat(64)}`);
  },

  // ---------- the safety pass runs on every mount ----------
  async 'a file that matches its integrity and carries a script is refused: the safety pass still runs'() {
    const svg = await lamp();
    const a = readAsset(svg);
    for (const name of ['script', 'event handler', 'javascript: link', 'foreignObject']) {
      const bad = makeAsset({ id: a.id, drawing: a.drawing, files: { ...a.files, [a.drawing]: HOSTILE[name](a.files[a.drawing]) } });
      const e = await refusal(() => mountAsync(null, bad, {}, { integrity: sri(bad) }));
      ok(e && /^E-ASSET-(UNSAFE|FOREIGN|SCRIPT|HANDLER|URL)|^E-/.test(e.code) && !['E-ASSET-INTEGRITY', 'E-PACKAGE-DIGEST'].includes(e.code), `${name}: ${e?.code} ${e?.message}`);
      ok(e.diagnostics?.length, `${name}: the safety pass names what it found (${e.code})`);
      // With a member digest wrong too, the safety pass is what refuses it: no digest is computed.
      const both = wrongDigest(bad);
      const f = await refusal(() => mountAsync(null, both, {}, { integrity: sri(both) }));
      eq(f?.code, e.code, `${name}: the same refusal with a wrong member digest`);
    }
  },

  // ---------- the full player for a file without integrity ----------
  async 'without integrity, fullPlayer checks and plays the file, with its schemas and every option unchanged'() {
    const svg = await lamp();
    globalThis.__n2bSchemas = schemas();
    const address = `${fullPlayerFile()}?ver=7`;
    const before = { ...log(), mounts: log().mounts.length };
    const onError = () => {}; const clock = { now: () => 0 }; const onMove = () => {}; const timeLimits = { turnMs: 50 };
    const given = { partition: 'p1', onError, timeLimits, faultBox: false, nonce: 'n0nce', theme: null, options: { size: 'm' }, hostWords: null, clock, onMove, colors: { accent: '#d84315' }, sleep: true, muted: true, test: false };
    const host = await mountAsync('the element', svg, {}, { ...given, fullPlayer: address });
    ok(typeof host.inputs === 'function', 'the host API of place()');
    eq(log().loads - before.loads, 1, 'the full player is imported once');
    eq(log().schemas - before.schemas, 1, 'the schemas come from the full player');
    const m = log().mounts.at(-1);
    eq(m.element, 'the element');
    eq(m.loadAsset(), 'the full player loadAsset', 'the full player\'s own loader');
    ok(m.options.schemas === globalThis.__n2bSchemas, 'the full player\'s schemas reach its checked mount');
    for (const [k, v] of Object.entries(given)) ok(m.options[k] === v, `${k} reaches the mount unchanged`);
    ok(!('fullPlayer' in m.options) && !('integrity' in m.options), 'fullPlayer and integrity are the lean player\'s own');
    // A second mount: no second import, no second schemas request.
    await mountAsync('again', svg, {}, { fullPlayer: address });
    eq(log().loads - before.loads, 1, 'still one import for this address');
    eq(log().schemas - before.schemas, 1, 'the page keeps one set of schemas');
    eq(log().mounts.length - before.mounts, 2);
    eq(log().mounts.at(-1).options.partition, 'asset-lamp', 'an option not given is the default');
  },
  async 'a full player of another version, without a checked mount, or that cannot load, is refused with E-ASSET'() {
    const svg = await lamp();
    globalThis.__n2bSchemas = schemas();
    const other = fullPlayerFile('2.0.0-next.0');
    const e = await refusal(() => mountAsync(null, svg, {}, { schemas: schemas(), fullPlayer: other }));
    eq(e?.code, 'E-ASSET', e?.message);
    ok(e.message.includes('2.0.0-next.0') && e.message.includes(VERSION) && e.message.includes(other), `the message names both versions and the address: ${e.message}`);
    const none = fullPlayerFile(VERSION, { parts: false });
    const n = await refusal(() => mountAsync(null, svg, {}, { schemas: schemas(), fullPlayer: none }));
    eq(n?.code, 'E-ASSET', n?.message);
    ok(n.message.includes(none), n.message);
    const gone = pathToFileURL(path.join(temp(), 'missing', 'hypersvg-asset.js')).href;
    const g = await refusal(() => mountAsync(null, svg, {}, { schemas: schemas(), fullPlayer: gone }));
    eq(g?.code, 'E-ASSET', g?.message);
    ok(g.message.includes(gone), `the message names the address: ${g.message}`);
    // Nothing of the file played: no mount was made by a refused full player.
    ok(!log().mounts.some(x => x.element === null), 'no mount');
  },
  async 'with integrity, fullPlayer is not loaded: the lean mount plays the file'() {
    const svg = await lamp();
    const gone = pathToFileURL(path.join(temp(), 'never', 'hypersvg-asset.js')).href;
    const e = await refusal(() => mountAsync(null, svg, {}, { integrity: sri(svg), fullPlayer: gone }));
    ok(e && e.code !== 'E-ASSET', `the lean mount ran (no element here): ${e?.code} ${e?.message}`);
  },

  // ---------- the shared schemas ----------
  async 'mountAsync without integrity and without schemas takes the shared set'() {
    const svg = await lamp();
    useSchemas(schemas());
    const e = await refusal(() => mountAsync(null, svg, {}, {}));
    ok(e && !(e instanceof TypeError && /options\.schemas/.test(e.message)), `it went past the schemas to the mount (no element here): ${e}`);
  },

  // ---------- the new options reach play() ----------
  'place(), the lean mount and the checked mount give sleep and muted to play()'() {
    const src = (f) => fs.readFileSync(path.join(repo, 'engine', 'v2', 'web', f), 'utf8');
    const lean = src('asset-lean.mjs'); const checked = src('mount-checked.mjs');
    ok(/function place\([^)]*\bsleep, muted \}/.test(lean) && /mountPackage\(element, [^;]*\bsleep, muted \}\)/.test(lean), 'place() takes and forwards them');
    ok(/function leanMount\([^)]*\bsleep, muted \}/.test(lean) && /play\(container, \{[^;]*\bsleep, muted \}\)/.test(lean), 'the lean mount gives them to play()');
    ok(/function mountChecked\([^)]*\bsleep, muted \}/.test(checked) && /play\(container, \{[^;]*\bsleep, muted \}\)/.test(checked), 'the checked mount gives them to play()');
  },
};
