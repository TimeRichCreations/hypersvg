#!/usr/bin/env node
// The 2.0 proof tools on the command line. Run one at a time: each starts a browser.
//   node engine/v2/tools/proof/proof.mjs certify <experience folder> <out folder> [--size WxH] [--steps n] [--time ms] [--guide file]
//   node engine/v2/tools/proof/proof.mjs guide   <experience folder> <out folder> <guide.json> [--size WxH]
//   node engine/v2/tools/proof/proof.mjs record  <experience folder> <out folder> <inputs.json>
//   node engine/v2/tools/proof/proof.mjs replay  <experience folder> <out folder> <trace.json>
//   node engine/v2/tools/proof/proof.mjs baked   <experience folder> <out folder>   (each baked size measured in the browser)
//   node engine/v2/tools/proof/proof.mjs certify-all <work folder> [--only name,name] [--certificates folder] [--products file]
// certify-all reads the list of products from --products (a JSON file {products: [...]}, folders from the repository
// root, guides beside the file), else from products.json here, which names the authors' own products and is not in the
// core release.
// The packed page and the exploration go in the out (or work) folder; keep it outside the repository.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildProduct, repo } from './build.mjs';
import { launchBrowser, record, replay, defaultStart } from './browser.mjs';
import { explore, defaults } from './explore.mjs';
import { measureBaked } from './baked.mjs';
import { certify, markdown } from './certificate.mjs';
import { CERTIFICATE, validateGuide, validateInput } from './format.mjs';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
export const certificatesDir = path.join(repo, 'docs', 'briefs', '2.0-wave7', 'certificates');
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n'); };
const flag = (args, name) => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const size = (s) => { const m = /^(\d+)x(\d+)$/.exec(s || ''); if (!m) throw new Error(`--size takes WxH, not ${s}`); return { width: +m[1], height: +m[2] }; };

// Reads a guide (format.mjs validateGuide). An area's trace file is read relative to the guide; its acts are played.
export function loadGuide(file) {
  const guide = validateGuide(JSON.parse(fs.readFileSync(file, 'utf8')));
  for (const area of guide.areas) {
    if (!area.trace) continue;
    const trace = JSON.parse(fs.readFileSync(path.resolve(path.dirname(file), ...area.trace.split('/')), 'utf8'));
    let t = 0;
    for (const input of trace.acts || []) { validateInput(input, t); t = input.t; }
    area.acts = trace.acts;
  }
  return guide;
}

// A product that did not pack still gets a certificate: status fail, with the packer's reason.
export function packFailure(product, error) {
  const reasons = (error.diags || []).slice(0, 12).map(d => `${d.code} ${d.file ?? ''} ${d.path ?? ''}`.trim());
  return {
    format: CERTIFICATE, product: { id: product.name, folder: product.folder, title: product.name }, fingerprint: null, status: 'fail',
    properties: { packs: { result: 'fail', reason: error.message, findings: reasons } },
    unknowns: ['Nothing was played: the packer refused the product, so every play property is unknown.'],
  };
}
const packFailureMd = (c) => [`# ${c.product.id}`, '', `Folder \`${c.product.folder}\`. Status: **fail**: it does not pack.`, '', `- ${c.properties.packs.reason}`, ...c.properties.packs.findings.map(f => `- \`${f}\``), '', ...c.unknowns.map(u => `- ${u}`), ''].join('\n');

export async function certifyProduct(browser, product, work, guides = here) {
  const out = path.join(work, product.name);
  fs.rmSync(out, { recursive: true, force: true });
  // A product the packer refuses is a failing certificate. When it packs with its findings accepted, it is still
  // played, so the certificate also shows what a person would meet; it never passes.
  let build; let refused = null;
  const folder = path.join(repo, ...product.folder.split('/'));
  try { build = await buildProduct(folder, out); } catch (e) {
    refused = packFailure(product, e);
    try { build = await buildProduct(folder, out, { acceptFindings: true }); } catch { return { certificate: refused, md: null, exploration: null }; }
  }
  const start = { ...defaultStart, viewport: product.viewport || defaultStart.viewport };
  const opts = Object.fromEntries(['stepBudget', 'timeBudgetMs', 'pointerBudget', 'waitMs', 'settleMs'].filter(k => product[k] !== undefined).map(k => [k, product[k]]));
  if (product.guide) opts.guide = loadGuide(path.join(guides, ...product.guide.split('/')));
  const exploration = await explore(browser, build, { ...opts, start });
  const certificate = certify(build, exploration);
  certificate.product.name = product.name;
  if (refused) {
    certificate.properties = { packs: refused.properties.packs, ...certificate.properties };
    certificate.status = 'fail';
    certificate.receipt.status = 'fail';
    certificate.receipt.rules.unshift({ rule: 'proof/packs', result: 'fail', proof: 'files', detail: refused.properties.packs.reason });
    certificate.unknowns.unshift('The packer refused this product; it was played from a page packed with its findings accepted (never for publishing).');
  }
  write(path.join(out, 'exploration.json'), exploration);
  return { certificate, md: markdown(certificate), exploration };
}

export function indexMarkdown(rows) {
  return ['# Certificates for 2.0 packed pages', '',
    'Made by `node engine/v2/tools/proof/proof.mjs certify-all <work folder>`. One JSON and one Markdown file per product.',
    'Results: pass, pass (observed) = true on the explored paths, unknown = not proved within the budgets, FAIL.', '',
    '| Product | Status | Finishable | Keyboard | Pointer | Scenes | Network | Errors | Budgets | Replay |', '|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(({ name, c }) => {
      const p = c.properties;
      if (p.packs && !p.finishable) return `| [${name}](${name}.md) | fail | does not pack | | | | | | | |`;
      const r = (x) => x.result === 'pass-observed' ? 'pass (obs.)' : x.result === 'fail' ? '**FAIL**' : x.result;
      return `| [${name}](${name}.md) | ${c.status}${p.packs ? ' (does not pack)' : ''} | ${r(p.finishable)} | ${r(p.keyboard)} ${p.keyboard.used}/${p.keyboard.seen} | ${r(p.pointer)} | ${r(p.scenes)} ${p.scenes.reached.length}/${p.scenes.reached.length + p.scenes.unreached.length} | ${r(p.network)} | ${r(p.errors)} | ${r(p.budgets)} | ${r(p.replay)} |`;
    }), ''].join('\n');
}

// The products certify-all certifies: {products, guides (the folder their guide paths start from)}.
export function productList(file = null) {
  const f = file ? path.resolve(file) : path.join(here, 'products.json');
  if (!fs.existsSync(f)) {
    throw new Error(file ? `certify-all: no products file ${file}` : 'certify-all: products.json is not in this release (it names the authors\' own products); give a list with --products <file>: {"products": [{"name": "my-lesson", "folder": "examples/my-lesson"}]}');
  }
  const { products } = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!Array.isArray(products)) throw new Error(`certify-all: ${f} has no products list`);
  return { products, guides: path.dirname(f) };
}

export async function run(args) {
  args = [...args];
  const command = args.shift();
  if (command === 'certify-all') {
    const work = path.resolve(args.shift() || fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-proof-')));
    const only = flag(args, '--only')?.split(',') ?? null;
    const dir = path.resolve(flag(args, '--certificates') || certificatesDir);
    const list = productList(flag(args, '--products'));
    const { products } = list;
    const browser = await launchBrowser();
    try {
      for (const product of products.filter(p => !only || only.includes(p.name))) {
        const t = Date.now();
        const { certificate, md } = await certifyProduct(browser, product, work, list.guides);
        write(path.join(dir, `${product.name}.json`), certificate);
        write(path.join(dir, `${product.name}.md`), md ?? packFailureMd(certificate));
        console.log(`${product.name}: ${certificate.status} (${Math.round((Date.now() - t) / 1000)} s)`);
      }
    } finally { await browser.close(); }
    const rows = products.filter(p => fs.existsSync(path.join(dir, `${p.name}.json`))).map(p => ({ name: p.name, c: JSON.parse(fs.readFileSync(path.join(dir, `${p.name}.json`), 'utf8')) }));
    write(path.join(dir, 'README.md'), indexMarkdown(rows));
    return;
  }
  const viewport = flag(args, '--size'); const steps = flag(args, '--steps'); const time = flag(args, '--time'); const guideFile = flag(args, '--guide');
  const [folder, out, file] = args;
  if (!['certify', 'record', 'replay', 'guide', 'baked'].includes(command) || !folder || !out) throw new Error('usage: proof.mjs <certify|record|replay|guide|baked|certify-all> <experience folder> <out folder> [file]');
  const start = { ...defaultStart, ...(viewport ? { viewport: size(viewport) } : {}) };
  const build = await buildProduct(folder, path.join(out, 'packed'));
  const browser = await launchBrowser();
  try {
    if (command === 'baked') {
      // A7.1: the packer bakes with the pinned estimate; here each baked page is measured with the browser's fonts.
      const r = await measureBaked(browser, build);
      write(path.join(out, 'baked.json'), r);
      for (const row of r.sizes) console.log(`${row.size}: ${row.problems.length ? row.problems.map(p => `${p.text} ${p.problem}`).join('; ') : 'every text inside its cell, at or above the floor'}`);
      console.log(`baked: ${r.result}`);
      if (r.result === 'fail') process.exitCode = 1;
    } else if (command === 'record') {
      const input = JSON.parse(fs.readFileSync(file, 'utf8'));
      const trace = await record(browser, build, input.acts, { start: input.start || start });
      write(path.join(out, 'trace.json'), trace);
      console.log(`recorded ${trace.acts.length} inputs; scene ${trace.expect.scene}`);
    } else if (command === 'replay') {
      const result = await replay(browser, build, JSON.parse(fs.readFileSync(file, 'utf8')));
      write(path.join(out, 'replay.json'), result);
      if (!result.pass) throw new Error(`replay differs: ${result.differences.join(', ') || result.actual.expect.error}`);
      console.log('replay: the same at every checkpoint');
    } else if (command === 'guide') {
      // Plays the guide only (no search, pointer pass or record): each area's scenes, and where it stopped.
      const exploration = await explore(browser, build, { start, guide: loadGuide(file), stepBudget: 0, pointerBudget: 0, record: false });
      write(path.join(out, 'guide-run.json'), exploration);
      for (const g of exploration.guided) console.log(`${g.area}: ${g.inputs} inputs; scenes ${g.scenes.join(', ')}${g.failed ? `; STOPPED at ${g.failed}` : ''}`);
      console.log(`scenes reached: ${exploration.scenes.length} of ${build.story?.scenes.length ?? '?'}; not reached: ${(build.story?.scenes || []).filter(s => !exploration.scenes.includes(s)).join(', ') || 'none'}`);
    } else {
      // Say the budget at once and show progress (R2 newcomer F5): a run takes up to the keyboard budget plus half of
      // it for the pointer pass, and a stop by the time budget is an unknown, not a failure.
      const budget = time ? +time : defaults.timeBudgetMs;
      console.log(`certify: time budget ${Math.round(budget / 1000)} s for the keyboard pass and up to ${Math.round(budget / 2000)} s for the pointer pass (about ${Math.ceil(budget * 1.5 / 60000)} min at most); a stop by the time budget is an unknown, not a failure`);
      const exploration = await explore(browser, build, { start, ...(steps ? { stepBudget: +steps } : {}), ...(time ? { timeBudgetMs: +time } : {}), ...(guideFile ? { guide: loadGuide(guideFile) } : {}), progress: (line) => console.log(`certify: ${line}`) });
      const c = certify(build, exploration);
      write(path.join(out, 'exploration.json'), exploration);
      write(path.join(out, 'certificate.json'), c);
      write(path.join(out, 'certificate.md'), markdown(c));
      console.log(markdown(c));
    }
  } finally { await browser.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exitCode = 1; });
}
