// The logic core and the logic port (added for 2.0.0-next.2): src/logic-core.mjs carries no checker; src/logic.mjs keeps
// its API and adds readAsset and VERSION; web/logic-port.mjs gives a page player's logic-only engine to the replay
// recorder, reading a file as the lean mount does. Each test fails without its addition.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { eq, ok, repo, schemas, throwsCode } from './helpers.mjs';
import * as logicEntry from '../src/logic.mjs';
import { readAsset, assetPackage } from '../src/asset.mjs';
import { VERSION } from '../src/version.mjs';

const v2 = path.join(repo, 'engine', 'v2');
const imp = (...p) => import(pathToFileURL(path.join(v2, ...p)).href);

// The files a module loads: with the engine's module list tool when it is there, else a small walk.
async function closure(entry) {
  const tool = path.join(v2, 'tools', 'module-list.mjs');
  if (fs.existsSync(tool)) return (await import(pathToFileURL(tool).href)).moduleList([entry]);
  const RE = /(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|import\s*['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g;
  const seen = new Set();
  const go = (f) => { if (seen.has(f)) return; seen.add(f); for (const m of fs.readFileSync(f, 'utf8').replace(/^\s*\/\/.*$/gm, '').matchAll(RE)) go(path.resolve(path.dirname(f), m[1] || m[2] || m[3])); };
  go(entry);
  return [...seen].map(f => path.relative(repo, f).split(path.sep).join('/')).sort();
}
const CHECKER = (f) => f === 'engine/v2/src/load.mjs' || f === 'engine/v2/src/load-asset.mjs' || /^engine\/v2\/schema\/(?!json-strict\.mjs$)/.test(f);

const PIECES = ['valid-one-scene.svg', 'valid-component.svg'].map(f => fs.readFileSync(path.join(repo, 'spec', '2.0', 'conformance', 'hypersvg', f), 'utf8'));

export const tests = {
  async 'logic-core.mjs and logic-port.mjs carry no checker (load.mjs, the schema modules); logic.mjs does'() {
    for (const f of [path.join(v2, 'src', 'logic-core.mjs'), path.join(v2, 'web', 'logic-port.mjs')]) {
      const list = await closure(f);
      eq(list.filter(CHECKER), [], `${path.basename(f)} loads no checker`);
    }
    ok((await closure(path.join(v2, 'src', 'logic.mjs'))).includes('engine/v2/src/load.mjs'), 'logic.mjs loads the checker');
  },
  'logic.mjs keeps its names and adds readAsset and VERSION'() {
    eq(Object.keys(logicEntry).sort(), ['VERSION', 'canonicalJson', 'fingerprint', 'fingerprintOf', 'logic', 'readAsset', 'stateDocument']);
    eq(logicEntry.VERSION, VERSION);
    eq(logicEntry.readAsset(PIECES[0]).id, readAsset(PIECES[0]).id);
    let e = null; try { logicEntry.logic(assetPackage(readAsset(PIECES[0]))); } catch (x) { e = x; }
    ok(e instanceof TypeError && /schemas/.test(e.message), 'a package still needs schemas, as before');
    eq(logicEntry.logic(assetPackage(readAsset(PIECES[0])), { schemas: schemas(), epochMs: 0 }).fingerprint().slice(0, 7), 'sha256:', 'a package with schemas plays');
  },
  async 'the logic core takes an experience; a package refuses with E-TYPE'() {
    const core = await imp('src', 'logic-core.mjs');
    throwsCode(() => core.logic(assetPackage(readAsset(PIECES[0]))), 'E-TYPE');
    throwsCode(() => core.logic({}), 'E-TYPE');
  },
  async 'logicPort is frozen, has exactly its members, and asset-lean.mjs and asset-web.mjs export the same object'() {
    const { logicPort } = await imp('web', 'logic-port.mjs');
    ok(Object.isFrozen(logicPort), 'frozen');
    eq(Object.keys(logicPort).sort(), ['VERSION', 'canonicalJson', 'fingerprint', 'fingerprintOf', 'loadTrusted', 'logic', 'readAsset', 'stateDocument']);
    eq(logicPort.VERSION, VERSION);
    eq((await imp('web', 'asset-lean.mjs')).logicPort === logicPort, true, 'asset-lean.mjs');
    eq((await imp('web', 'asset-web.mjs')).logicPort === logicPort, true, 'asset-web.mjs');
  },
  async 'loadTrusted plays a HyperSVG as the checked load does: the same state fingerprints, step by step'() {
    const { logicPort } = await imp('web', 'logic-port.mjs');
    for (const svg of PIECES) {
      const pkg = assetPackage(readAsset(svg));
      const a = logicEntry.logic(pkg, { schemas: schemas(), epochMs: 0 });
      const b = logicPort.logic(logicPort.loadTrusted(pkg), { epochMs: 0 });
      eq(b.state(), a.state(), 'the state document at the start');
      for (const step of [{ t: 0, source: 'start', payload: [null] }, { t: 700, source: 'setSize', payload: [{ width: 320, height: 200 }] }, { t: 2100, source: 'motion', payload: [true] }]) {
        try { a.feed(step); } catch { /* refused the same way */ }
        try { b.feed(step); } catch { /* refused the same way */ }
        eq(b.fingerprint(), a.fingerprint(), `after ${step.source}`);
      }
      a.advance(5000); b.advance(5000);
      eq(b.fingerprint(), a.fingerprint(), 'after 5 s');
    }
  },
  async 'loadTrusted refuses a reader error with its code, and anything but members'() {
    const { logicPort } = await imp('web', 'logic-port.mjs');
    const files = readAsset(PIECES[0]).files;
    let e = null; try { logicPort.loadTrusted({ ...files, 'experience.json': '{ not json' }); } catch (x) { e = x; }
    ok(e && /^E-/.test(e.code) && Array.isArray(e.diagnostics), `a reader error: ${e?.code} ${e?.message}`);
    throwsCode(() => logicPort.loadTrusted(null), 'E-TYPE');
  },
};
