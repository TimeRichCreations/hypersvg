// The test tool (engine/v2/tools/test.mjs), its parts that need no browser. The browser part has its
// own test: engine/v2/tests/browser/t1-test-browser.mjs.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repo, eq, ok } from './helpers.mjs';
import { playNode } from '../tools/test/node-play.mjs';
import { parseArgs, line, testOne } from '../tools/test.mjs';
import { hasHooks, withHooks } from '../tools/test/hooks.mjs';
import { compareBrowsers } from '../tools/test/browser-pass.mjs';
import { pack } from '../tools/pack.mjs';

const fixture = path.join(repo, 'engine', 'v2', 'tests', 't1-fixture');

export const tests = {
  async 'the Node walk reaches every scene by Next and Back and uses every control once'() {
    const r = await playNode(fixture);
    eq(r.scenes.map(s => s.id), ['a', 'b']);
    eq(r.scenes[1].path, ['a#next press']);
    eq(r.findings, []);
    // a: Next, the slider at Home, End and one step, both options, a wait; b: Back, a wait.
    ok(r.uses >= 9, `uses ${r.uses}`);
  },
  async 'the tool without a browser: check and Node only, exit data and lines'() {
    const rep = await testOne(fixture, { ...parseArgs([fixture, '--node-only']) }, {});
    eq(rep.errors, 0);
    eq(rep.node.scenes, 2);
    ok(rep.times.check >= 0 && rep.times.node >= 0);
  },
  'options: thresholds, browsers, quick'() {
    const o = parseArgs(['x', '--text-error', '11', '--hit-warn', '40', '--browsers', 'all', '--quick', '--speed']);
    eq(o.thresholds, { textError: 11, hitWarn: 40 });
    eq(o.browsers, ['chromium', 'firefox', 'webkit']);
    ok(o.quick && o.speed);
    eq(parseArgs(['x', '--browsers', 'firefox']).browsers, ['firefox']);
    let threw = false; try { parseArgs(['--nope']); } catch { threw = true; }
    ok(threw, 'an unknown option is refused');
  },
  'one line per finding: severity, code, scene, layout, browser, element, number, words'() {
    eq(line({ severity: 'error', code: 'T-HIT-SMALL', scene: 'a', layout: 'phone', browser: 'chromium', element: 'a#next', value: '20x20', message: 'small' }), 'ERROR T-HIT-SMALL a phone chromium a#next [20x20]: small');
    eq(line({ severity: 'warning', code: 'W-X', scene: '', element: 'f.json /x', value: null, message: 'm' }), 'WARNING W-X - f.json /x: m');
  },
  async 'a page packed without --test gets a copy with its hooks on and its script hash computed again'() {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 't1-hooks-'));
    const k = await pack(fixture, out, {});
    const html = fs.readFileSync(k.htmlPath, 'utf8');
    ok(!hasHooks(html), 'a published page has no hooks');
    const copy = withHooks(k.htmlPath, path.join(out, 'hooks'));
    const h2 = fs.readFileSync(copy, 'utf8');
    ok(hasHooks(h2), 'the copy has them');
    const script = h2.slice(h2.indexOf('<script>') + 8, h2.indexOf('</script>'));
    ok(h2.includes(`'sha256-${crypto.createHash('sha256').update(script, 'utf8').digest('base64')}'`), 'the CSP names the new script');
    const hash = (x) => `'sha256-${crypto.createHash('sha256').update(x.slice(x.indexOf('<script>') + 8, x.indexOf('</script>')), 'utf8').digest('base64')}'`;
    ok(h2.replace(', test: true };', ' };').replace(hash(h2), hash(html)) === html, 'only the flag and the hash change');
    ok(fs.readFileSync(k.htmlPath, 'utf8') === html, 'the page itself is not changed');
    const t = await pack(fixture, path.join(out, 't'), { test: true });
    ok(hasHooks(fs.readFileSync(t.htmlPath, 'utf8')), 'a --test page has hooks');
  },
  'another browser against Chromium: text boxes and values'() {
    const m = (w, v) => ({ s: { texts: [{ id: 'label', text: 'Heat in the winding', box: { x: 0, y: 0, w, h: 16 } }], controls: [{ id: 'c', name: 'Volts', value: '1', valueText: v }] } });
    eq(compareBrowsers(m(100, '1 V'), m(101, '1 V'), 'firefox', 'wide'), []);
    const d = compareBrowsers(m(100, '1 V'), m(117, '2 V'), 'firefox', 'wide');
    eq(d.map(x => x.code), ['T-BROWSER-TEXT', 'T-BROWSER-VALUE']);
  },
};
