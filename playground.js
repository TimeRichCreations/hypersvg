// The HyperSVG playground. Plain ES module, no dependencies. It uses only the player's public modules:
// asset-web.mjs (the <hypersvg-asset> element and sharedSchemas), mount-web.mjs (mount a package of raw files, checked
// before it plays) and src/asset.mjs (assetPackage, to make that package from the editor's files).
import { sharedSchemas } from 'hypersvg/engine/v2/web/asset-web.mjs';
import { mount as mountPackage } from 'hypersvg/engine/v2/web/mount-web.mjs';
import { assetPackage } from 'hypersvg/engine/v2/src/asset.mjs';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const FILES = ['lamp.json', 'lamp.svg', 'experience.json'];
const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const reRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The lamp's source files, fetched once.
const starter = Promise.all(FILES.map((f) => fetch(`examples/lamp/${f}`).then((r) => {
  if (!r.ok) throw new Error(`cannot load examples/lamp/${f} (${r.status})`);
  return r.text();
}))).then((texts) => Object.fromEntries(FILES.map((f, i) => [f, texts[i]])));

// ---------- 2. Two files ----------
// Each highlighted word: the text as it appears in the file, the parts it drives, and a short note.
const SVG_WORDS = [
  ['data-hsvg-kind="part"', '', 'A mark: this shape is a part, so the JSON can point at it by its id.'],
  ['id="lamp"', 'lamp', 'The part named lamp: the bulb and its stem.'],
  ['data-hsvg-pivot="200 180"', 'lamp', 'The point the lamp grows around: its foot.'],
  ['data-hsvg-motion="scale 0.5..1.5"', 'lamp', 'How far the lamp may grow: from half size to one and a half.'],
  ['id="bulb"', 'bulb', 'The part named bulb.'],
  ['data-hsvg-label="Bulb"', 'bulb', 'The name a screen reader says for the bulb.'],
  ['data-hsvg-variant="off"', 'bulb', 'One drawn version of the bulb: grey.'],
  ['data-hsvg-variant="on"', 'bulb', 'The other drawn version: lit. It starts hidden.'],
  ['id="switch"', 'switch', 'The part named switch: the button.'],
  ['data-hsvg-role="action"', 'switch', 'Its job in one word: an action.'],
  ['id="switch-words"', 'switch-words', 'The words on the button, a part of their own.'],
];
const JSON_WORDS = [
  ['"kind": "toggle"', 'switch', 'The switch is a toggle: each press flips it.'],
  ['"target": "switch"', 'switch', 'The toggle lives on the part named switch.'],
  ['"value": "lit"', 'switch bulb switch-words', 'Each press turns lit over. The bulb and the words read lit.'],
  ['"event": "flip"', 'switch', 'Each press also sends the event flip.'],
  ['"emit": "switched"', 'switch', 'On flip, tell the page: switched.'],
  ['"target": "lamp"', 'lamp', 'This binding drives the part named lamp.'],
  ['"scale": "height"', 'lamp', 'The lamp\'s size follows the input height.'],
  ['"target": "bulb"', 'bulb', 'This binding drives the bulb.'],
  ['"variant": "lit ? \'on\' : \'off\'"', 'bulb', 'Show the variant on when lit is true, else off.'],
  ['"target": "switch-words"', 'switch-words', 'This binding drives the button\'s words.'],
  ['"text": "Turn {{ lit ? \'off\' : \'on\' }}"', 'switch-words', 'The words follow lit: Turn on, or Turn off.'],
];

// Escapes a file and wraps each listed word in a focusable <mark>. One pass, so marks never nest.
export function highlight(text, words) {
  const html = escapeHtml(text);
  const byText = new Map(words.map(([t, part, note]) => [escapeHtml(t), { part, note }]));
  const seen = new Set();
  const re = new RegExp([...byText.keys()].sort((a, b) => b.length - a.length).map(reRegex).join('|'), 'g');
  return html.replace(re, (m) => {
    const w = byText.get(m);
    const first = !seen.has(m); seen.add(m);
    const note = escapeHtml(w.note).replace(/"/g, '&quot;');
    return `<mark class="tok${w.part ? '' : ' mark'}" tabindex="${first ? 0 : -1}" data-part="${w.part}" data-note="${note}">${m}</mark>`;
  });
}

// The boxes of the lamp's parts, measured on the source drawing (drawing units, viewBox 0 0 400 300).
function partBoxes(svgText) {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const svg = doc.documentElement;
  if (svg.nodeName !== 'svg') return {};
  const ids = [...svg.querySelectorAll('[id]')].map((e) => e.id);
  for (const e of svg.querySelectorAll('[id]')) e.setAttribute('data-src-id', e.id), e.removeAttribute('id');
  const probe = document.importNode(svg, true);
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:400px;height:300px;visibility:hidden';
  document.body.append(probe);
  const boxes = {};
  for (const id of ids) {
    const e = probe.querySelector(`[data-src-id="${CSS.escape(id)}"]`);
    try { const b = e.getBBox(); boxes[id] = { x: b.x, y: b.y, w: b.width, h: b.height }; } catch { /* not drawn */ }
  }
  probe.remove();
  return boxes;
}

async function twoFiles() {
  const files = await starter;
  $('#code-svg code').innerHTML = highlight(files['lamp.svg'], SVG_WORDS);
  $('#code-json code').innerHTML = highlight(files['lamp.json'], JSON_WORDS);
  const boxes = partBoxes(files['lamp.svg']);
  const spot = $('#spot');
  const note = $('#files-note');
  const resting = note.textContent;
  const show = (tok) => {
    const parts = tok.dataset.part.split(' ').filter(Boolean);
    $$('.tok.on').forEach((t) => t.classList.remove('on'));
    $$('.tok').filter((t) => t.dataset.part && t.dataset.part.split(' ').some((p) => parts.includes(p))).forEach((t) => t.classList.add('on'));
    spot.innerHTML = parts.filter((p) => boxes[p]).map((p) => {
      const b = boxes[p]; const pad = 6;
      return `<rect x="${b.x - pad}" y="${b.y - pad}" width="${b.w + 2 * pad}" height="${b.h + 2 * pad}" rx="10"/>`;
    }).join('');
    note.textContent = tok.dataset.note;
  };
  const hide = () => { $$('.tok.on').forEach((t) => t.classList.remove('on')); spot.innerHTML = ''; note.textContent = resting; };
  for (const tok of $$('#files .tok')) {
    tok.addEventListener('mouseenter', () => show(tok));
    tok.addEventListener('mouseleave', hide);
    tok.addEventListener('focus', () => show(tok));
    tok.addEventListener('blur', hide);
  }
}

// ---------- 3. Change it ----------
const EXAMPLES = {
  words: {
    file: 'lamp.json', find: /"text": "Turn \{\{ lit \? 'off' : 'on' \}\}"/,
    to: '"text": "{{ lit ? \'Switch off\' : \'Switch on\' }}"',
    say: 'The button now says Switch on. Press it: the words follow lit.',
  },
  colour: {
    file: 'lamp.svg', find: /fill="#ffd45e"/, to: 'fill="#7cd4ff"', lit: true,
    say: 'The lit bulb is now blue. The page set lit to true so you can see it.',
  },
  height: {
    file: 'experience.json', find: /("height":\s*\{[^}]*"initial":\s*)1(\s*\})/, to: '$11.4$2',
    say: 'The lamp starts at height 1.4, inside its drawn range of 0.5 to 1.5.',
  },
  unsafe: {
    file: 'lamp.svg', find: /<g id="switch" /, to: '<g id="switch" onclick="alert(\'hi\')" ',
    say: 'The player refused the drawing. Press Reset, or remove the onclick.',
  },
  typo: {
    file: 'lamp.json', find: /"variant":/, to: '"varient":',
    say: 'The player refused the scene. Press Reset, or fix the word.',
  },
};

function editor() {
  const area = Object.fromEntries($$('.code-edit').map((t) => [t.dataset.file, t]));
  const tabs = $$('#change [role="tab"]');
  const stage = $('#edit-stage');
  const status = $('#edit-status');
  const errorBox = $('#edit-error');
  let host = null;
  let first = null;

  const select = (tab, focus = false) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    }
    if (focus) tab.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      select(tabs[(to + tabs.length) % tabs.length], true);
    });
  });

  const showError = (e) => {
    const list = Array.isArray(e.diagnostics) && e.diagnostics.length ? e.diagnostics : null;
    const code = e.code || 'Error';
    errorBox.innerHTML = `<strong>The player refused it: ${escapeHtml(code)}</strong>${escapeHtml(list ? `${list.length} finding${list.length > 1 ? 's' : ''}:` : e.message)}`
      + (list ? `<ul>${list.map((d) => `<li><span class="code-word">${escapeHtml(d.code)}</span> ${escapeHtml([d.file, d.path].filter(Boolean).join(' '))}: ${escapeHtml(d.message)}</li>`).join('')}</ul>` : '');
    errorBox.hidden = false;
    errorBox.dataset.code = code;
  };
  const clearError = () => { errorBox.hidden = true; errorBox.textContent = ''; delete errorBox.dataset.code; };

  const apply = async ({ lit = false, say = '' } = {}) => {
    const schemas = await sharedSchemas();
    const files = Object.fromEntries(FILES.map((f) => [f, area[f].value]));
    const box = document.createElement('div');
    let next;
    try {
      next = mountPackage(box, assetPackage({ id: 'lamp', files }), {
        schemas, partition: 'playground-edit',
        onError: (d) => showError({ code: d?.code, message: d?.message || String(d) }),
      });
    } catch (e) {
      showError(e);
      stage.classList.add('stale');
      status.textContent = say || 'The player refused the files. The last good lamp is shown faded.';
      stage.dataset.state = 'refused';
      return false;
    }
    try { host?.destroy(); } catch { /* already closed */ }
    host = next;
    stage.replaceChildren(box);
    stage.classList.remove('stale');
    clearError();
    if (lit) host.set('lit', true);
    status.textContent = say || 'Applied. This lamp plays your files.';
    stage.dataset.state = 'playing';
    return true;
  };

  const reset = async () => {
    for (const f of FILES) area[f].value = first[f];
    select(tabs[0]);
    await apply({ say: 'Back to the starter files.' });
  };

  starter.then((files) => {
    first = files;
    for (const f of FILES) area[f].value = files[f];
    return apply({ say: 'Your lamp, from the files in the editor.' });
  }).catch((e) => showError(e));

  $('#apply').addEventListener('click', () => apply());
  $('#reset').addEventListener('click', () => reset());
  for (const t of Object.values(area)) {
    t.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); apply(); }
    });
  }
  for (const b of $$('[data-example]')) {
    b.addEventListener('click', () => {
      const ex = EXAMPLES[b.dataset.example];
      const t = area[ex.file];
      if (!ex.find.test(t.value)) t.value = first[ex.file];
      t.value = t.value.replace(ex.find, ex.to);
      select(tabs.find((x) => x.dataset.file === ex.file));
      apply({ lit: ex.lit, say: ex.say });
    });
  }
}

// ---------- 4. Settings and events ----------
const WHO = { host: 'the page', person: 'the lamp\'s switch' };
const fmt = (v) => (typeof v === 'number' ? String(Math.round(v * 100) / 100) : JSON.stringify(v));

async function settings() {
  const el = $('#lamp-panel');
  const form = $('#panel');
  const log = $('#log');
  form.addEventListener('submit', (e) => e.preventDefault());
  const empty = () => { log.innerHTML = '<li><span class="empty">No events yet. Press the switch or move a setting.</span></li>'; };
  empty();
  $('#log-clear').addEventListener('click', empty);

  const add = (kind, text, by) => {
    $('.empty', log)?.parentElement.remove();
    const top = log.firstElementChild;
    // A slider sends many changes; keep one line per run of changes to the same input by the same source.
    if (top && top.dataset.key === `${kind}:${text.split(' ')[0]}:${by}` && kind === 'changed') {
      $('.what', top).textContent = text;
      return;
    }
    const li = document.createElement('li');
    li.dataset.key = `${kind}:${text.split(' ')[0]}:${by}`;
    li.dataset.kind = kind;
    li.innerHTML = `<span class="ev${kind === 'changed' ? '' : ' out'}">${escapeHtml(`hsvg:${kind}`)}</span><span class="what">${escapeHtml(text)}</span>${by ? `<span class="by">by ${escapeHtml(WHO[by] || by)} (${escapeHtml(by)})</span>` : ''}`;
    log.prepend(li);
    while (log.children.length > 40) log.lastElementChild.remove();
  };

  let controls = {};
  try { await el.ready; } catch (e) { form.innerHTML = `<p class="muted">The lamp did not start: ${escapeHtml(e.code || '')} ${escapeHtml(e.message)}</p>`; return; }
  form.replaceChildren();
  for (const input of el.inputs()) {
    if (input.kind === 'trigger') continue;
    const id = `in-${input.name}`;
    const field = document.createElement('div');
    field.className = 'field';
    const range = input.type === 'number' ? ` ${input.minimum ?? ''}..${input.maximum ?? ''}` : '';
    const meta = `<span class="meta">${escapeHtml(input.kind)}, ${escapeHtml(input.type)}${escapeHtml(range)}</span>`;
    if (input.type === 'boolean') {
      field.innerHTML = `<label for="${id}">${escapeHtml(input.name)}</label><span class="switch"><input type="checkbox" role="switch" id="${id}"><span aria-hidden="true"></span></span>${meta}`;
      const box = $('input', field);
      box.checked = !!input.value;
      box.addEventListener('change', () => el.set(input.name, box.checked));
      controls[input.name] = (v) => { box.checked = !!v; };
    } else if (input.type === 'number') {
      const min = input.minimum ?? 0; const max = input.maximum ?? 100;
      const step = input.step ?? Math.max(0.01, Math.round(((max - min) / 100) * 100) / 100);
      field.innerHTML = `<label for="${id}">${escapeHtml(input.name)}</label><output for="${id}"></output><input type="range" id="${id}" min="${min}" max="${max}" step="${step}">${meta}`;
      const slider = $('input', field); const out = $('output', field);
      slider.value = String(input.value); out.textContent = fmt(input.value);
      slider.addEventListener('input', () => { el.set(input.name, Number(slider.value)); out.textContent = fmt(Number(slider.value)); });
      controls[input.name] = (v) => { slider.value = String(v); out.textContent = fmt(v); };
    } else if (Array.isArray(input.enum)) {
      field.innerHTML = `<label for="${id}">${escapeHtml(input.name)}</label><select id="${id}">${input.enum.map((o) => `<option>${escapeHtml(o)}</option>`).join('')}</select>${meta}`;
      const sel = $('select', field); sel.value = input.value;
      sel.addEventListener('change', () => el.set(input.name, sel.value));
      controls[input.name] = (v) => { sel.value = v; };
    } else {
      field.innerHTML = `<label for="${id}">${escapeHtml(input.name)}</label><input id="${id}" type="text">${meta}`;
      const t = $('input', field); t.value = input.value ?? '';
      t.addEventListener('change', () => el.set(input.name, t.value));
      controls[input.name] = (v) => { t.value = v ?? ''; };
    }
    form.append(field);
  }
  el.addEventListener('hsvg:changed', (e) => {
    const { name, value, by } = e.detail || {};
    controls[name]?.(value);
    add('changed', `${name} = ${fmt(value)}`, by);
  });
  for (const o of el.host.outputs()) el.addEventListener(`hsvg:${o.name}`, () => add(o.name, `the lamp sent ${o.name}`, ''));
}

// ---------- 5 and 6: load heavy sections when they come near ----------
function whenNear(target, fn, margin = '300px') {
  if (!('IntersectionObserver' in window)) { fn(); return; }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
  }, { rootMargin: margin });
  io.observe(target);
}

function showcase() {
  const frame = $('#showcase');
  whenNear(frame, () => { frame.src = frame.dataset.src; });
}

function cars() {
  const grid = $('#cars-grid');
  whenNear(grid, async () => {
    grid.dataset.state = 'loading';
    const placed = $$('.car-card', grid).map((card) => {
      const slot = $('.car-slot', card);
      const car = document.createElement('hypersvg-asset');
      car.setAttribute('src', 'assets/car.svg');
      car.setAttribute('length', card.dataset.length);
      car.setAttribute('colour', card.dataset.colour);
      car.setAttribute('roof-open', card.dataset.roof);
      car.append(...slot.childNodes);
      slot.append(car);
      return car;
    });
    const results = await Promise.allSettled(placed.map((c) => c.ready));
    grid.dataset.state = results.every((r) => r.status === 'fulfilled') ? 'playing' : 'refused';
  }, '200px');
}

twoFiles().catch((e) => { $('#files-note').textContent = `Could not load the files: ${e.message}`; });
editor();
settings();
showcase();
cars();
