// The frame link (10.6) in a real browser. Run alone (it starts a browser):
//   node engine/v2/tests/browser/frame-link-browser.mjs
// It packs frame-link-fixture, shows the packed page in an iframe (srcdoc, sandbox="allow-scripts", no
// allow-same-origin) on a host page from file://, and talks to it with web/frame-host.mjs (inlined in the host page).
// Playwright must already be installed (it is never a dependency).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pack } from '../../tools/pack.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH ? path.join(process.env.PW_PATH, 'node_modules', 'playwright') : 'playwright');
const chromium = pw[process.env.PW_BROWSER || 'chromium'];

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-frame-link-'));
const problems = [];
const want = (c, m) => { console.log(`  ${c ? 'ok' : 'problem'}: ${m}`); if (!c) problems.push(m); };
let browser;
try {
  const packed = await pack(path.join(here, 'frame-link-fixture'), path.join(out, 'pub'));
  const pageHtml = fs.readFileSync(packed.htmlPath, 'utf8');
  // The host helper, inlined: a module script from file:// is refused by the browser.
  const helper = fs.readFileSync(path.join(here, '..', '..', 'web', 'frame-host.mjs'), 'utf8').replace(/^export /gm, '');
  const hostFile = path.join(out, 'host.html');
  fs.writeFileSync(hostFile, `<!doctype html><meta charset="utf-8"><title>host</title><body><script>${helper}\nwindow.connectFrame = connectFrame;</script></body>`);

  browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(hostFile).href);
  const r = await page.evaluate(async (html) => {
    const seen = [];
    window.addEventListener('message', (e) => seen.push(e.data));
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.width = 400; iframe.height = 300;
    const link = window.connectFrame(iframe, { timeout: 30000 });
    iframe.srcdoc = html;
    document.body.append(iframe);
    const res = {};
    const code = (p) => p.then(() => 'none', (e) => e.code);
    res.hello = await link.ready;
    res.tokenLength = link.channel.length;
    await link.set('musicVolume', 0.2);
    res.volume = await link.read('musicVolume');
    await link.set('visitorName', 'Robin');
    res.name = await link.read('visitorName');
    res.scene = await link.scene();
    // emit fires the trigger. The on delivery is shown with the built-in entered, which restart gives: the engine
    // does not yet pass an experience trigger on to its scenes (5.3.3), so the fixture's start reaction stays quiet.
    res.emit = await link.emit('start');
    const heard = [];
    const off = await link.on('entered', (e) => heard.push([e.name, e.detail.scene]));
    await link.restart();
    await new Promise(r => setTimeout(r, 300));
    res.heard = heard;
    await off();
    await link.restart();
    await new Promise(r => setTimeout(r, 300));
    res.heardAfterOff = heard.length;
    res.volumeAfterRestart = await link.read('musicVolume');
    res.refused = await code(link.set('musicVolume', 2));
    res.private = await code(link.read('starts'));
    res.big = await code(link.set('visitorName', 'x'.repeat(70000)));
    // A wrong token gets no reply.
    const before = seen.length;
    iframe.contentWindow.postMessage({ channel: 'A'.repeat(24), v: 1, id: 999, call: 'read', args: ['musicVolume'] }, '*');
    await new Promise(r => setTimeout(r, 500));
    res.wrongTokenReplies = seen.slice(before).filter(m => m && m.id === 999).length;
    // The page's own window is cross-origin to the host.
    try { res.direct = typeof iframe.contentWindow.hsvg; } catch (e) { res.direct = e.name; }
    res.doc = iframe.contentDocument === null;
    link.close();
    res.closed = await code(link.read('musicVolume'));
    // Y3 item 5: event aliases arrive once each; a replaced document ends the link and learns nothing; a new link
    // starts. A second frame, so its page hears a first hello.
    const frame2 = document.createElement('iframe');
    frame2.setAttribute('sandbox', 'allow-scripts');
    const link2 = window.connectFrame(frame2, { timeout: 30000 });
    frame2.srcdoc = html;
    document.body.append(frame2);
    await link2.ready;
    const n = { bare: 0, alias: 0 };
    await link2.on('entered', () => n.bare++);
    await link2.on('hsvg.entered', () => n.alias++);
    await link2.restart();
    await new Promise(r => setTimeout(r, 300));
    res.aliases = n;
    const spy = '<!doctype html><script>addEventListener("message", (e) => parent.postMessage({ spy: JSON.stringify(e.data) }, "*"));</script>';
    const loaded = new Promise(r => frame2.addEventListener('load', r, { once: true }));
    frame2.srcdoc = spy;
    await loaded;
    res.afterReplace = await code(link2.read('musicVolume'));
    await new Promise(r => setTimeout(r, 1200));
    const spyHeard = seen.filter(m => m && typeof m.spy === 'string').map(m => m.spy);
    res.spyHeard = spyHeard;
    res.spyToken = spyHeard.some(x => x.includes(link2.channel));
    const reloaded = new Promise(r => frame2.addEventListener('load', r, { once: true }));
    frame2.srcdoc = html;
    await reloaded;
    const link3 = window.connectFrame(frame2, { timeout: 30000 });
    res.relink = await link3.ready;
    res.relinkRead = await link3.read('musicVolume');
    link3.close();
    return res;
  }, pageHtml);
  console.log(`  ${JSON.stringify(r)}`);
  want(r.hello && r.hello.v === 1 && r.tokenLength >= 22, 'hello is answered {v: 1}');
  want(r.volume === 0.2 && r.name === 'Robin', 'set an input, read it back');
  want(r.scene === 'hello', 'scene() answers the scene');
  want(r.emit === null, 'emit a trigger');
  want(r.heard.length === 1 && r.heard[0][0] === 'entered' && r.heard[0][1] === 'hello' && r.heardAfterOff === 1, 'an on delivery arrives; off stops it');
  want(r.refused === 'E-RANGE' && r.private === 'E-HOST-PRIVATE', 'refused calls reject with their codes');
  want(r.big === 'E-RANGE', 'a message over 64 KiB is refused with E-RANGE');
  want(r.wrongTokenReplies === 0, 'a wrong token gets no reply');
  want(r.direct === 'SecurityError' && r.doc, `the host cannot reach the page's window.hsvg directly (${r.direct})`);
  want(r.closed === 'E-HOST-CLOSED', 'a closed link refuses calls');
  want(r.aliases.bare === 1 && r.aliases.alias === 1, 'entered and hsvg.entered arrive once each');
  want(r.afterReplace === 'E-HOST-CLOSED', 'a replaced document ends the link (E-HOST-CLOSED)');
  want(!r.spyToken && r.spyHeard.every(x => !/"call":"(?!ping")/.test(x)), 'the new document never gets the token or a host call');
  want(r.relink?.v === 1 && typeof r.relinkRead === 'number', 'a new link starts with the new page');
  want(errors.length === 0, `no page errors: ${errors.join('; ')}`);
  await page.close();
} catch (e) {
  problems.push(String(e.stack || e));
  console.log(e);
} finally {
  await browser?.close();
  fs.rmSync(out, { recursive: true, force: true });
}
console.log(problems.length ? `FAILED: ${problems.length} problems` : 'frame link browser: all good');
process.exit(problems.length ? 1 : 0);
