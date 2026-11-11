// One fast test for any 2.0 experience (T1). It checks the folder, plays it in the Node player (every scene
// reached, every control used), packs it and measures it in a browser, scene by scene, wide and phone.
//   node engine/v2/tools/test.mjs <experience folder | packed page.html> [options]
// Options:
//   --out <dir>          the report (report.json) and the screenshots (shots/*.jpg); default a folder in the temp folder
//   --quick              wide only; no keys, Tab, pointer, dialog or motion checks; no speed
//   --speed              each scene 5 s with the CPU 4x slower (Chromium, CDP): frames a second and long tasks
//   --browsers all       also Firefox and WebKit (wide and phone), with differences against Chromium; or a list
//   --node-only          no browser
//   --no-shots           no screenshots
//   --min-width <px>     the phone pass runs this wide (the narrowest width an asset is meant for); with --quick it
//                        adds the phone pass. The touch-size and text-size rules apply at that width
//   --kit <dir>          a kit the experience pins (may repeat); --allow <id>: an add-on whose code may run (may repeat)
//   --browser required   fail (exit 1, T-BROWSER-SKIPPED) when the browser pass cannot run; the default, optional,
//                        runs the Node part alone and says SKIPPED. --json gives coverage: what ran and what did not
//   --json               print the report as JSON instead of lines
//   thresholds: --text-error 12 --text-warn 14 --hit-error 24 --hit-warn 44 --fps 30 --long-task 200 --cpu 4
// Playwright is found with PW_PATH (a folder holding node_modules/playwright), PW_CHANNEL and PW_BROWSER, as the
// engine's browser tests find it. Without it the Node part runs and the tool says so. Browsers run one at a time.
// Each finding is one line: severity, code, scene, layout and browser, element, number and words. Exit 0 when no error.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { folderSource } from '../src/load.mjs';
import { checkExperience } from '../check/index.mjs';
import { describe } from '../check/diagnostics.mjs';
import { pack } from './pack.mjs';
import { playNode, getSchemas } from './test/node-play.mjs';
import * as B from './test/browser-pass.mjs';
import { hasHooks, withHooks } from './test/hooks.mjs';
import { sweepList, printName, compareFingerprints, table } from './test/sweep.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const repo = path.resolve(here, '..', '..', '..');

export function parseArgs(argv) {
  const o = { targets: [], kits: {}, allow: [], thresholds: {}, browsers: ['chromium'], shots: true };
  const num = { '--text-error': 'textError', '--text-warn': 'textWarn', '--hit-error': 'hitError', '--hit-warn': 'hitWarn', '--fps': 'fps', '--long-task': 'longTask', '--cpu': 'cpu', '--speed-ms': 'speedMs', '--fit-tolerance': 'fitTolerance' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]; const v = () => argv[++i];
    if (a === '--out') o.out = path.resolve(v());
    else if (a === '--quick') o.quick = true;
    else if (a === '--speed') o.speed = true;
    else if (a === '--node-only') o.nodeOnly = true;
    else if (a === '--no-shots') o.shots = false;
    else if (a === '--shots') o.forceShots = true;
    else if (a === '--all') o.all = true;
    else if (a === '--only') o.only = v().split(',');
    else if (a === '--baseline') o.baseline = path.resolve(v());
    else if (a === '--compare') o.compare = path.resolve(v());
    else if (a === '--json') o.json = true;
    else if (a === '--browser') { const b = v(); if (b !== 'required' && b !== 'optional') throw new Error('--browser takes required or optional'); o.browserRequired = b === 'required'; }
    else if (a === '--browsers') { const b = v(); o.browsers = b === 'all' ? ['chromium', 'firefox', 'webkit'] : b.split(','); }
    else if (a === '--kit') { const k = path.resolve(v()); const id = JSON.parse(fs.readFileSync(path.join(k, 'kit.json'), 'utf8')).id; o.kits[id] = k; }
    else if (a === '--allow') o.allow.push(v());
    else if (a === '--min-width') { const w = Number(v()); if (!Number.isInteger(w) || w < 100 || w > 2000) throw new Error('--min-width takes a whole number of CSS pixels, 100 to 2000'); o.minWidth = w; }
    else if (num[a]) o.thresholds[num[a]] = Number(v());
    else if (a.startsWith('--')) throw new Error(`unknown option ${a}`);
    else o.targets.push(path.resolve(a));
  }
  if (process.env.PW_BROWSER && !argv.includes('--browsers')) o.browsers = [process.env.PW_BROWSER];
  return o;
}

const sevOrder = { error: 0, warning: 1, note: 2 };
export const line = (f) => `${f.severity.toUpperCase()} ${f.code} ${f.scene || '-'}${f.layout ? ` ${f.layout}` : ''}${f.browser ? ` ${f.browser}` : ''} ${f.element || '-'}${f.value !== null && f.value !== undefined ? ` [${f.value}]` : ''}: ${f.message}`;

// Tests one target. browsers: {name: launched browser} (opened by the caller, one at a time is fine). Returns the report.
export async function testOne(target, o, browsers = {}) {
  const t0 = Date.now();
  const isPage = /\.html?$/i.test(target);
  const name = isPage ? path.basename(target).replace(/\.html?$/i, '') : path.basename(target);
  const findings = []; const times = {}; const report = { target: path.relative(repo, target) || target, name, findings, times };
  const add = (f) => findings.push(f);
  let node = null; let file = isPage ? target : null;
  if (!isPage) {
    // 1. The checker.
    let s = Date.now();
    const source = await folderSource(target, { kits: o.kits });
    const r = checkExperience(source, getSchemas(), { review: true }); // with the review findings (check.mjs --review)
    for (const d of describe(r.diags, source, r.experience)) add({ code: d.code, severity: d.code.startsWith('E-') ? 'error' : 'warning', scene: '', element: `${d.file}${d.line ? `:${d.line}` : ''} ${d.pointer}`, value: null, message: d.message, from: 'check' });
    times.check = Date.now() - s;
    // 2. The Node player.
    s = Date.now();
    if (r.experience && !r.diags.some(d => d.code.startsWith('E-'))) {
      const allow = o.allowAll ? Object.keys(r.experience.addons || {}).concat(o.allow || []) : o.allow;
      node = await playNode(target, { kits: o.kits, allow });
      for (const f of node.findings) add({ severity: 'error', ...f, from: 'node' });
      report.node = { scenes: node.scenes.length, of: Object.keys(node.experience?.scenes || {}).length, uses: node.uses, steps: node.steps };
    }
    times.node = Date.now() - s;
    // 3. Pack, with the test hooks.
    if (!o.nodeOnly && Object.keys(browsers).length && r.experience && !r.diags.some(d => d.code.startsWith('E-'))) {
      s = Date.now();
      const out = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-test-pack-'));
      try {
        const allow = o.allowAll ? Object.keys(r.experience.addons || {}).concat(o.allow) : o.allow;
        const k = await pack(target, out, { test: true, kits: o.kits, allow, acceptFindings: false });
        file = k.htmlPath; report.bytes = k.bytes;
      } catch (e) { add({ code: 'T-PACK', severity: 'error', scene: '', element: 'pack', value: null, message: String(e.message).split('\n')[0].slice(0, 300) }); }
      times.pack = Date.now() - s;
    }
  }
  if (file && !o.nodeOnly && Object.keys(browsers).length && !findings.some(f => f.code === 'T-PACK')) {
    report.bytes ??= fs.statSync(file).size;
    // A page published without the test hooks is tested through a copy with them on (test/hooks.mjs).
    if (isPage && !hasHooks(fs.readFileSync(file, 'utf8'))) {
      const copy = withHooks(file, path.join(o.out || os.tmpdir(), 'hooks'));
      if (!copy) add({ code: 'T-PAGE-ERROR', severity: 'error', scene: '', element: 'page', value: null, message: 'the page has no test hooks and is not a packed 2.0 page whose hooks can be turned on: pack it with --test' });
      else { report.hooks = 'the page has no test hooks: a copy with the pack\'s test flag on (and its script hash computed again) was tested; nothing else changed'; file = copy; }
    }
    // The scenes and their paths: from the Node walk, or walked in the page when only the page is given.
    let scenes;
    let s = Date.now();
    const chromium = browsers.chromium || Object.values(browsers)[0];
    // A scene's own actions (the uses tried there) are replayed for the fingerprints of --baseline and --compare.
    if (node?.scenes.length) scenes = node.scenes.map(sc => ({ id: sc.id, actions: node.paths.get(sc.id).map(strip), uses: (node.used?.get(sc.id) || []).map(strip) }));
    else {
      const w = await B.walkPage(chromium, file);
      for (const e of w.errors) add({ code: 'T-PAGE-ERROR', severity: 'error', scene: '', element: 'start', value: null, message: e });
      scenes = w.scenes; report.walk = { scenes: scenes.length };
      times.walk = Date.now() - s;
    }
    const shotsDir = o.shots && o.out ? path.join(o.out, 'shots') : null;
    if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
    const layouts = o.quick && !o.minWidth ? ['wide'] : ['wide', 'phone'];
    if (o.minWidth) report.phoneWidth = o.minWidth;
    const base = {}; const prints = {};
    report.browsers = {};
    for (const [bn, br] of Object.entries(browsers)) {
      s = Date.now();
      report.browsers[bn] = {};
      for (const ln of layouts) {
        const r = await B.layoutPass(br, bn, file, scenes, ln, { ...o, quickOnly: o.quick, shots: shotsDir, name });
        for (const f of r.findings) add(f);
        report.browsers[bn][ln] = Object.fromEntries(Object.entries(r.measures).map(([k, m]) => [k, summary(m)]));
        (report.checked ??= {})[`${bn} ${ln}`] = r.counts;
        if (bn === 'chromium') { base[ln] = r.measures; if (o.baseline || o.compare) prints[ln] = r.prints; }
        else if (base[ln]) for (const f of B.compareBrowsers(base[ln], r.measures, bn, ln)) add(f);
        if (r.shots.length) (report.shots ??= []).push(...r.shots.map(x => path.relative(o.out, x)));
      }
      times[bn] = Date.now() - s;
    }
    if (o.speed && browsers.chromium) {
      s = Date.now();
      const sp = await B.speedPass(browsers.chromium, file, scenes, o);
      for (const f of sp.findings) add(f);
      report.speed = sp.rows; times.speed = Date.now() - s;
    }
    report.scenes = scenes.map(sc => sc.id);
    // Kept for the other browsers' passes (morePass), not written to the report.
    Object.defineProperty(report, 'run', { value: { file, scenes, base, prints }, enumerable: false });
  }
  findings.sort((a, b) => (sevOrder[a.severity] - sevOrder[b.severity]) || String(a.code).localeCompare(String(b.code)) || String(a.scene).localeCompare(String(b.scene)));
  times.total = Date.now() - t0;
  report.errors = findings.filter(f => f.severity === 'error').length;
  report.warnings = findings.filter(f => f.severity === 'warning').length;
  return report;
}
const strip = (a) => ({ t: a.t, addr: a.addr, cid: a.cid, arg: a.arg === undefined ? null : a.arg, link: a.link, dialog: a.dialog, ms: a.ms, what: a.what });
// What the report keeps of a scene's measures: the smallest text, the controls' boxes and names.
const summary = (m) => ({
  layout: m.layout, stage: m.stage,
  smallestText: m.texts.reduce((a, x) => (!a || x.px < a.px ? { id: x.id, px: x.px, text: x.text } : a), null),
  controls: m.controls.filter(c => c.shown).map(c => ({ id: c.id, role: c.role, name: c.name, value: c.valueText ?? c.value, box: c.box, enabled: c.enabled })),
});

export function printReport(rep) {
  if (rep.hooks) console.log(`NOTE ${rep.hooks}`);
  for (const f of rep.findings) console.log(line(f));
  for (const x of rep.coverage?.omitted || []) console.log(`NOT COVERED ${x.part}: ${x.why}`);
  for (const [k, c] of Object.entries(rep.checked || {})) console.log(`checked ${k}: ${Object.entries(c).map(([a, b]) => `${b} ${a}`).join(', ')}`);
  const t = rep.times;
  const parts = Object.entries(t).filter(([k]) => k !== 'total').map(([k, v]) => `${k} ${(v / 1000).toFixed(1)} s`).join(', ');
  console.log(`${rep.name}: ${rep.errors} errors, ${rep.warnings} warnings; ${rep.scenes?.length ?? rep.node?.scenes ?? 0} scenes${rep.node ? ` (Node: ${rep.node.scenes} of ${rep.node.of} reached, ${rep.node.uses} uses)` : ''}; ${(t.total / 1000).toFixed(1)} s (${parts})`);
}

export async function openBrowsers(o) {
  if (o.nodeOnly) return { browsers: {}, note: null };
  const pw = B.playwright();
  if (!pw) return { browsers: {}, note: 'Playwright is not installed (set PW_PATH to a folder holding node_modules/playwright): the Node part ran, the browser part did not' };
  const browsers = {}; const failed = [];
  for (const n of o.browsers) { try { browsers[n] = await B.launch(pw, n); } catch (e) { failed.push(`${n}: ${String(e.message).split('\n')[0]}`); } }
  return { browsers, note: failed.length ? `could not start ${failed.join('; ')}` : null };
}

async function main() {
  let o;
  try { o = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(2); }
  if (o.all) {
    // The sweep's list, one after another in one browser. Add-ons the experiences name may run: this is a test pack.
    o.targets = sweepList().filter(rel => !o.only || o.only.some(x => rel.includes(x))).map(rel => path.join(repo, rel));
    o.allowAll = true;
    if (!o.forceShots) o.shots = false;
  }
  if (!o.targets.length) { console.log('usage: node engine/v2/tools/test.mjs <experience folder | page.html> [--out <dir>] [--quick] [--speed] [--browsers all] [--browser required] [--min-width <px>] [--node-only] [--no-shots] [--json]\n       node engine/v2/tools/test.mjs --all [--only <part,part>] [--quick] [--baseline <dir> | --compare <dir>]'); process.exit(2); }
  o.out ??= fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-test-'));
  fs.mkdirSync(o.out, { recursive: true });
  // One browser at a time: each is opened, used for every target and closed before the next.
  const order = o.browsers.includes('chromium') ? ['chromium', ...o.browsers.filter(b => b !== 'chromium')] : o.browsers;
  const reports = [];
  const { browsers, note } = await openBrowsers({ ...o, browsers: [order[0]] });
  // A browser pass that cannot run is said loudly, and is an error with --browser required (R08).
  const skipped = o.nodeOnly ? null : (note || (Object.keys(browsers).length ? null : 'no browser started'));
  const info = o.json ? console.error : console.log; // with --json, stdout holds only the JSON report
  if (skipped) info(`${o.browserRequired ? 'ERROR' : 'SKIPPED'} the browser pass did not run: ${skipped}${o.browserRequired ? '' : '. The result covers the checker and the Node player only; add --browser required to fail instead'}`);
  const t0 = Date.now();
  for (const target of o.targets) {
    let rep;
    try { rep = await testOne(target, o, browsers); } catch (e) { rep = { target: path.relative(repo, target), name: path.basename(target), findings: [{ code: 'T-TOOL', severity: 'error', scene: '', element: 'tool', value: null, message: String(e.message).split('\n')[0].slice(0, 300) }], times: { total: 0 }, errors: 1, warnings: 0 }; }
    rep.coverage = coverage(o, skipped);
    if (skipped && o.browserRequired) { rep.findings.unshift({ code: 'T-BROWSER-SKIPPED', severity: 'error', scene: '', element: 'browser', value: null, message: `the browser pass did not run (${skipped}), and --browser required asks for it` }); rep.errors++; }
    reports.push(rep);
    if (o.all) console.log(`${rep.errors ? 'FAIL' : 'ok  '} ${rep.target} ${rep.errors} errors, ${rep.warnings} warnings, ${(rep.times.total / 1000).toFixed(1)} s`);
    if (o.baseline && rep.run) { fs.mkdirSync(o.baseline, { recursive: true }); fs.writeFileSync(path.join(o.baseline, `${printName(rep.target)}.json`), JSON.stringify({ target: rep.target, prints: rep.run.prints })); }
  }
  for (const b of Object.values(browsers)) await b.close();
  // The other browsers repeat the wide and phone pass, one at a time.
  for (const bn of order.slice(1)) {
    const { browsers: one, note: n2 } = await openBrowsers({ ...o, browsers: [bn] });
    if (n2) info(`NOTE ${n2}`);
    if (!one[bn]) continue;
    for (const rep of reports) await morePass(rep, o, bn, one[bn]);
    await one[bn].close();
  }
  for (const rep of reports) {
    fs.writeFileSync(path.join(o.out, `${o.all ? printName(rep.target) : rep.name}.report.json`), JSON.stringify(rep, null, 1));
    if (o.json) console.log(JSON.stringify(rep, null, 1)); else if (!o.all) printReport(rep);
  }
  // --compare: every difference against the saved fingerprints.
  let changed = 0;
  if (o.compare) {
    for (const rep of reports) {
      const f = path.join(o.compare, `${printName(rep.target)}.json`);
      if (!rep.run) continue;
      if (!fs.existsSync(f)) { console.log(`CHANGED ${rep.target}: no baseline in ${o.compare}`); changed++; continue; }
      const d = compareFingerprints(JSON.parse(fs.readFileSync(f, 'utf8')).prints, rep.run.prints);
      for (const x of d) console.log(`CHANGED ${rep.target} ${x.layout} ${x.scene}${x.step ? ` after "${x.step}"` : ''}: ${x.what} ${x.detail}`);
      changed += d.length;
      rep.changed = d.length;
    }
    if (o.all) for (const f of fs.readdirSync(o.compare).filter(f => f.endsWith('.json'))) if (!reports.some(r => `${printName(r.target)}.json` === f)) { console.log(`CHANGED ${f.slice(0, -5)}: in the baseline, not swept now`); changed++; }
    console.log(`compare: ${changed} differences against ${o.compare}`);
  }
  if (o.all) {
    const top = (r) => { const k = {}; for (const f of r.findings) if (f.severity === 'error') k[f.code] = (k[f.code] || 0) + 1; return Object.entries(k).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => `${c} ${n}`).join(', '); };
    console.log(table(reports.map(r => ({ target: r.target, scenes: r.scenes?.length ?? r.node?.scenes ?? 0, errors: r.errors, warnings: r.warnings, ms: r.times.total, top: top(r) }))));
    console.log(`${reports.length} experiences, ${reports.filter(r => !r.errors).length} without errors; ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  if (o.baseline) console.log(`baseline: ${reports.filter(r => r.run).length} fingerprints in ${o.baseline}`);
  (o.json ? console.error : console.log)(`report: ${o.out}`);
  process.exit(reports.some(r => r.errors) || changed ? 1 : 0);
}

// What a run covered, for the report and --json: the parts that ran, and the parts left out with the reason.
export function coverage(o, skipped) {
  const ran = ['check', 'node']; const omitted = [];
  if (o.nodeOnly) omitted.push({ part: 'browser', why: '--node-only' });
  else if (skipped) omitted.push({ part: 'browser', why: skipped });
  else {
    ran.push('browser');
    if (o.quick) omitted.push({ part: 'keys, Tab, pointer, dialog and motion checks', why: '--quick' });
    if (o.quick && !o.minWidth) omitted.push({ part: 'the phone pass', why: '--quick (add --min-width to run it)' });
  }
  return { ran, omitted };
}

// Another browser's wide and phone pass for a report already made in Chromium, with the differences.
async function morePass(rep, o, bn, br) {
  const s = Date.now();
  if (!rep.run) return;
  const { file, scenes, base } = rep.run;
  const layouts = o.quick && !o.minWidth ? ['wide'] : ['wide', 'phone'];
  rep.browsers[bn] = {};
  for (const ln of layouts) {
    const r = await B.layoutPass(br, bn, file, scenes, ln, { ...o, quickOnly: o.quick, shots: o.shots ? path.join(o.out, 'shots') : null, name: rep.name });
    rep.findings.push(...r.findings, ...B.compareBrowsers(base[ln] || {}, r.measures, bn, ln));
    rep.browsers[bn][ln] = Object.fromEntries(Object.entries(r.measures).map(([k, m]) => [k, summary(m)]));
    (rep.checked ??= {})[`${bn} ${ln}`] = r.counts;
    if (r.shots.length) (rep.shots ??= []).push(...r.shots.map(x => path.relative(o.out, x)));
  }
  rep.times[bn] = Date.now() - s; rep.times.total += rep.times[bn];
  rep.findings.sort((a, b) => (sevOrder[a.severity] - sevOrder[b.severity]) || String(a.code).localeCompare(String(b.code)) || String(a.scene).localeCompare(String(b.scene)));
  rep.errors = rep.findings.filter(f => f.severity === 'error').length;
  rep.warnings = rep.findings.filter(f => f.severity === 'warning').length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
