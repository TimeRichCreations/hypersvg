// The preview page: one offline page that shows an experience at every declared size, side by side
// at true size, or each member of a kit family; plus one free slot with a drag handle to resize it.
//   node engine/v2/tools/preview.mjs <experience folder> [<more folders> ...] <out folder> [--accept-findings]
// Writes <out>/preview.html and, beside it, each folder packed (tools/pack.mjs) as <out>/pages/<id>.html. The preview
// page shows them in frames; nothing is fetched from a network. A page in a frame is a host's slot (web/player-web.mjs
// boot), so it fills its frame: a frame of an exact size shows that size's layout at one unit per CSS pixel.
// A packed page also runs from a srcdoc frame (its sounds and media read from memory: web/audio-web.mjs assetsBase),
// so a host may embed the pages in one file; this tool writes them beside the preview page.
// The sizes: the experience's shape axis sizes (the innermost entry, 7.1); for a shape-only axis, each frame of its
// shell or start scene at its viewBox size (7.2). It is a tool's page, not a player feature: the player knows nothing of it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pack, PackError } from './pack.mjs';
import { loadExperience, folderSource } from '../src/load.mjs';
import { loadSchemas } from '../schema/load.mjs';
import { trueSizes, viewBoxAspect } from '../src/layout.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..');

// The sizes to show for a loaded experience: [{width, height}].
export function previewSizes(exp) {
  const sizes = trueSizes(exp.doc);
  if (sizes) return sizes;
  const block = exp.shell || exp.scenes?.[exp.doc.story?.start];
  const out = [];
  for (const d of Object.values(block?.drawings || {})) {
    const m = /<svg\b[^>]*?\sviewBox\s*=\s*["']([^"']+)["']/.exec(String(d.text || ''));
    const v = m ? m[1].trim().split(/[\s,]+/).map(Number) : [];
    if (v.length === 4 && v[2] > 0 && v[3] > 0 && viewBoxAspect(d.text) && !out.some(s => s.width === v[2] && s.height === v[3])) out.push({ width: v[2], height: v[3] });
  }
  return out;
}

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const scriptJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

// Packs each folder and writes <out>/preview.html. Returns {htmlPath, members: [{id, title, sizes, page}], bytes}.
export async function preview(folders, outDir, { acceptFindings = false } = {}) {
  const schemas = loadSchemas(path.join(repo, 'spec', '2.0'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvg-preview-'));
  const members = [];
  fs.mkdirSync(path.join(outDir, 'pages'), { recursive: true });
  try {
    for (const [i, folder] of folders.entries()) {
      // A preview is an author's tool page, never published: its pages keep the test hooks (pack --test).
      const r = await pack(folder, path.join(tmp, String(i)), { acceptFindings, test: true });
      const loaded = loadExperience(await folderSource(path.resolve(folder)), schemas);
      const exp = loaded.experience;
      let name = `${r.id}.html`;
      for (let n = 2; members.some(m => m.page === `pages/${name}`); n++) name = `${r.id}-${n}.html`;
      fs.copyFileSync(r.htmlPath, path.join(outDir, 'pages', name));
      members.push({ id: r.id, title: exp?.doc.about?.title || r.id, sizes: exp ? previewSizes(exp) : [], page: `pages/${name}` });
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  const htmlPath = path.join(outDir, 'preview.html');
  const html = page(members);
  fs.writeFileSync(htmlPath, html);
  return { htmlPath, members, bytes: Buffer.byteLength(html) };
}

function page(members) {
  const title = members.length === 1 ? `${members[0].title}: every size` : `A family of ${members.length}: every size`;
  // One row: every size of every member, side by side.
  const many = members.length > 1;
  const figures = members.flatMap((m, i) => m.sizes.map(s => `<figure data-member="${escapeHtml(m.id)}"><iframe title="${escapeHtml(m.title)}, ${s.width} by ${s.height}" src="${escapeHtml(m.page)}" data-member-index="${i}" data-size="${s.width}x${s.height}" width="${s.width}" height="${s.height}" style="width:${s.width}px;height:${s.height}px"></iframe><figcaption>${many ? `${escapeHtml(m.title)}, ` : ''}${s.width} × ${s.height}</figcaption></figure>`));
  const sections = `<section class="sizes"><div class="row">${figures.join('')}</div></section>`;
  const all = members.flatMap(m => m.sizes.map(s => `${s.width}x${s.height}`)).filter((s, i, a) => a.indexOf(s) === i);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; padding: 16px; font: 15px/1.4 system-ui, sans-serif; background: #f3f1ec; color: #1d2a30; }
  h1 { font-size: 20px; margin: 0 0 12px; } h2 { font-size: 16px; margin: 20px 0 8px; }
  .row { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start; overflow-x: auto; padding: 4px; }
  figure { margin: 0; } figcaption { font-size: 13px; color: #4f6b73; margin-top: 4px; }
  iframe { border: 0; display: block; outline: 1px solid #b8c4c8; background: #fff; }
  .free { margin-top: 28px; } .tools { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
  .tools button, .tools select { font: inherit; padding: 4px 10px; }
  #slot { position: relative; width: 300px; height: 250px; outline: 1px dashed #4f6b73; }
  #slot iframe { width: 100%; height: 100%; }
  #handle { position: absolute; right: -14px; bottom: -14px; width: 28px; height: 28px; border-radius: 50%; background: #153b4b; cursor: nwse-resize; touch-action: none; }
  #handle:focus-visible { outline: 3px solid #e6af42; outline-offset: 2px; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>Each frame is shown at its true size: one drawing unit per CSS pixel.</p>
${sections}
<section class="free">
<h2>Free size</h2>
<div class="tools">
<label>Show <select id="pick">${members.map((m, i) => `<option value="${i}">${escapeHtml(m.title)}</option>`).join('')}</select></label>
${all.map(s => `<button type="button" data-preset="${s}">${s.replace('x', ' × ')}</button>`).join('')}
<span id="readout" aria-live="polite">300 × 250</span>
</div>
<div id="slot"><iframe id="free" title="Free size"></iframe><div id="handle" role="slider" tabindex="0" aria-label="Resize the free slot: arrows change the width and height" aria-valuetext="300 by 250"></div></div>
</section>
<script id="pages" type="application/json">${scriptJson(members.map(m => m.page))}</script>
<script>
(function () {
  'use strict';
  var pages = JSON.parse(document.getElementById('pages').textContent);
  var slot = document.getElementById('slot'); var free = document.getElementById('free');
  var handle = document.getElementById('handle'); var readout = document.getElementById('readout'); var pick = document.getElementById('pick');
  free.src = pages[0];
  pick.addEventListener('change', function () { free.src = pages[Number(pick.value)]; });
  function size(w, h) {
    w = Math.max(20, Math.min(2000, Math.round(w))); h = Math.max(20, Math.min(2000, Math.round(h)));
    slot.style.width = w + 'px'; slot.style.height = h + 'px';
    readout.textContent = w + ' × ' + h; handle.setAttribute('aria-valuetext', w + ' by ' + h);
    window.previewSize = { width: w, height: h };
  }
  window.sizeSlot = size;
  var drag = null;
  handle.addEventListener('pointerdown', function (e) {
    var b = slot.getBoundingClientRect();
    drag = { x: e.clientX, y: e.clientY, w: b.width, h: b.height };
    handle.setPointerCapture(e.pointerId); e.preventDefault();
  });
  handle.addEventListener('pointermove', function (e) { if (drag) size(drag.w + e.clientX - drag.x, drag.h + e.clientY - drag.y); });
  handle.addEventListener('pointerup', function () { drag = null; });
  handle.addEventListener('pointercancel', function () { drag = null; });
  handle.addEventListener('keydown', function (e) {
    var b = slot.getBoundingClientRect(); var step = e.shiftKey ? 50 : 10;
    var d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d) { size(b.width + d[0], b.height + d[1]); e.preventDefault(); }
  });
  var presets = document.querySelectorAll('[data-preset]');
  for (var j = 0; j < presets.length; j++) presets[j].addEventListener('click', function () { var s = this.getAttribute('data-preset').split('x'); size(Number(s[0]), Number(s[1])); });
  size(300, 250);
})();
</script>
</body>
</html>
`;
}

// Command line.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const acceptFindings = args.includes('--accept-findings');
  const plain = args.filter(a => !a.startsWith('--'));
  if (plain.length < 2) { console.log('usage: node engine/v2/tools/preview.mjs <experience folder> [<more folders> ...] <out folder> [--accept-findings]'); process.exit(2); }
  const out = path.resolve(plain.pop());
  try {
    const r = await preview(plain, out, { acceptFindings });
    for (const m of r.members) console.log(`${m.id}: ${m.sizes.map(s => `${s.width}x${s.height}`).join(', ') || 'no sizes'}`);
    console.log(`wrote ${r.htmlPath} (${r.bytes} bytes)`);
  } catch (e) {
    if (!(e instanceof PackError)) throw e;
    for (const d of e.diags.slice(0, 200)) console.log(`${d.code} ${d.file} ${d.path}: ${d.message}`);
    console.log(e.message);
    process.exit(1);
  }
}
