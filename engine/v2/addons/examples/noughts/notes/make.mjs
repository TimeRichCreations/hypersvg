// Builds the noughts showcase files from the art (art.mjs) and the numbers (geometry.mjs).
//   node engine/v2/addons/examples/noughts/notes/make.mjs
// It writes experience.json, words/en.csv, data/lines.csv, scenes/pick/* and scenes/game/* next to this folder.
// Then run: node skill/2.0/tools/digest.mjs <experience folder>   (fills in the file digests)
//           node engine/v2/tools/addon.mjs pin <experience folder>  (pins the three example add-ons)
// Node 20+ standard library only. The files it writes are the experience; this script is only the pencil.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as A from './art.mjs';
import { STAGE, SHEET, CELL, GRID, CX, CY, cellCentre, HEAD, SHOULDER, WRIST0, armTable, restPose, r1 } from './geometry.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const write = (rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
const json = (o) => JSON.stringify(o, null, 2) + '\n';
const C = A.C;

// ---------- words ----------
const WORDS = {
  title: 'Noughts and crosses',
  subtitle: 'Play against Bolt, the desk robot',
  pickLevel: 'Pick how clever Bolt is',
  easy: 'Easy', fair: 'Fair', hard: 'Hard',
  easyNote: 'Bolt takes it slow.',
  fairNote: 'Bolt plays a fair game.',
  hardNote: 'Bolt never loses.',
  play: 'Play',
  you: 'You (X)', bolt: 'Bolt (O)', draws: 'Draws',
  newGame: 'New game', changeLevel: 'Change level',
  level: 'Level',
  yourMove: 'Your move',
  thinking: 'Bolt is thinking',
  youWin: 'You win!',
  boltWins: 'Bolt wins.',
  aDraw: 'A draw.',
  clearing: 'Rubbing out',
  cell: 'Cell',
  markX: 'X', markO: 'O', markEmpty: 'empty',
  board: 'Board',
  levelGroup: 'Bolt\'s level',
};
const csv = (o) => 'id,text\n' + Object.entries(o).map(([k, v]) => `${k},${/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v}`).join('\n') + '\n';

// ---------- frames ----------
const FRAMES = {
  wide: { w: 960, h: 600, stage: 'translate(36 12) scale(0.9)', suffix: '' },
  tall: { w: 600, h: 960, stage: 'translate(0 8)', suffix: '.tall' },
};

// ---------- small parts ----------
const font = 'font-family="sans-serif"';
const text = (id, x, y, size, fill, str, extra = '') => `<text id="${id}" data-hsvg-kind="part" x="${x}" y="${y}" text-anchor="middle" ${font} font-size="${size}" font-weight="700" fill="${fill}" ${extra}>${str}</text>`;

function button(id, role, x, y, w, h, fillId, labelId, labelStr, labelFill = C.ink) {
  const r = Math.min(26, h / 2);
  const face = (down, extra = '') => `<rect x="${x}" y="${y + (down ? 6 : 0)}" width="${w}" height="${h - 6}" rx="${r}" fill="url(#${down ? 'g-button-down' : fillId})" stroke="#8a5a0a" stroke-width="3"${extra}/>`;
  return `<g id="${id}" data-hsvg-kind="part" data-hsvg-role="${role}">
        <g data-hsvg-variant="idle"><rect x="${x}" y="${y + 6}" width="${w}" height="${h - 6}" rx="${r}" fill="#5d3a12"/>${face(false)}<path d="M${x + r} ${y + 8}h${w - 2 * r}" stroke="#fff8d8" stroke-width="3" stroke-linecap="round" opacity="0.8"/></g>
        <g data-hsvg-variant="hover" display="none"><rect x="${x}" y="${y + 6}" width="${w}" height="${h - 6}" rx="${r}" fill="#5d3a12"/>${face(false)}<rect x="${x}" y="${y}" width="${w}" height="${h - 6}" rx="${r}" fill="#ffffff" opacity="0.22"/><path d="M${x + r} ${y + 8}h${w - 2 * r}" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/></g>
        <g data-hsvg-variant="pressed" display="none"><rect x="${x}" y="${y + 8}" width="${w}" height="${h - 8}" rx="${r}" fill="#5d3a12"/>${face(true)}</g>
        <g data-hsvg-variant="focus" display="none"><rect x="${x}" y="${y + 6}" width="${w}" height="${h - 6}" rx="${r}" fill="#5d3a12"/>${face(false)}<rect x="${x - 5}" y="${y - 5}" width="${w + 10}" height="${h + 4}" rx="${r + 5}" fill="none" stroke="${C.x}" stroke-width="3.5" stroke-dasharray="9 6" stroke-linecap="round"/></g>
        <g data-hsvg-variant="disabled" display="none"><rect x="${x}" y="${y + 6}" width="${w}" height="${h - 6}" rx="${r}" fill="#7b7468"/><rect x="${x}" y="${y + 3}" width="${w}" height="${h - 6}" rx="${r}" fill="#cfc8b6" stroke="#8d8672" stroke-width="3" stroke-dasharray="9 6"/></g>
        ${text(labelId, x + w / 2, y + h / 2 + 3 + 8, h > 70 ? 28 : 24, labelFill, labelStr)}
      </g>`;
}

function tally(prefix, labelId, who, x, y, w, labelY, countY, marksY, colour, size) {
  const cx = x + w / 2; const k = 7; const gap = 14;
  const strokes = [];
  const x0 = cx - 2 * gap;
  for (let i = 0; i < 4; i++) strokes.push(`<path id="${prefix}-m${i + 1}" data-hsvg-kind="part" data-hsvg-motion="draw 0..1" pathLength="1" d="M${r1(x0 + i * gap)} ${marksY}l${i % 2 ? 1.5 : -1} ${size > 40 ? 32 : 22}" fill="none" stroke="${colour}" stroke-width="5" stroke-linecap="round"/>`);
  strokes.push(`<path id="${prefix}-m5" data-hsvg-kind="part" data-hsvg-motion="draw 0..1" pathLength="1" d="M${r1(x0 - 12)} ${marksY + (size > 40 ? 26 : 18)}L${r1(x0 + 3 * gap + 12)} ${marksY + 4}" fill="none" stroke="${colour}" stroke-width="5" stroke-linecap="round"/>`);
  return `<g id="${prefix}" data-hsvg-kind="part">
        ${text(labelId, cx, labelY, size > 40 ? 22 : 24, C.ink, who)}
        <text id="${prefix}-count" data-hsvg-kind="part" x="${cx}" y="${countY}" text-anchor="middle" ${font} font-size="${size}" font-weight="700" fill="${colour}" data-hsvg-pivot="${cx} ${countY - size * 0.3}" data-hsvg-motion="scale 1..1.35">0</text>
        ${strokes.join('\n        ')}
      </g>`;
}

// ---------- Bolt's arm table, for formulas ----------
const AT = armTable();
const REST = restPose();
const arr = (xs) => '[' + xs.map(v => r1(v)).join(', ') + ']';

// ---------- game drawing ----------
function gameSvg(frame) {
  const F = FRAMES[frame]; const wide = frame === 'wide';
  const P = wide
    ? { status: [612, 28, 324, 104], tally: [612, 148, 324, 236], again: [612, 404, 324, 80], change: [612, 500, 324, 72] }
    : { status: [24, 650, 552, 64], tally: [24, 726, 552, 140], again: [24, 878, 300, 64], change: [336, 878, 240, 64] };
  const [sx, sy, sw, sh] = P.status; const [tx, ty, tw, th] = P.tally;
  const colw = tw / 3;
  const tallyBoxes = [
    tally('tally-you', 'tally-you-label', 'You', tx, ty, colw, wide ? ty + 92 : ty + 30, wide ? ty + 160 : ty + 78, wide ? ty + 178 : ty + 94, C.x, wide ? 56 : 44),
    tally('tally-bolt', 'tally-bolt-label', 'Bolt', tx + colw, ty, colw, wide ? ty + 92 : ty + 30, wide ? ty + 160 : ty + 78, wide ? ty + 178 : ty + 94, C.o, wide ? 56 : 44),
    tally('tally-draw', 'tally-draw-label', 'Draws', tx + 2 * colw, ty, colw, wide ? ty + 92 : ty + 30, wide ? ty + 160 : ty + 78, wide ? ty + 178 : ty + 94, C.graphite, wide ? 56 : 44),
  ];
  const sparkles = [[112, 210, 1.1], [478, 190, 1], [112, 330, 0.9], [572, 330, 0.8], [124, 470, 0.8], [566, 470, 0.8], [470, 70, 0.8], [150, 100, 0.7]].map(([x, y, s]) => `<path d="M${x} ${y - 20 * s}l${5 * s} ${14 * s}l${15 * s} ${1 * s}l-${12 * s} ${9 * s}l${4 * s} ${15 * s}l-${12 * s} -${9 * s}l-${12 * s} ${9 * s}l${4 * s} -${15 * s}l-${12 * s} -${9 * s}l${15 * s} -${1 * s}z" fill="${C.gold}" stroke="#b98a14" stroke-width="2.5" stroke-linejoin="round"/>`).join('\n          ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${F.w} ${F.h}" data-hsvg-version="2.0" data-hsvg-kind="screen">
  <title>Noughts and crosses</title>
  <desc>Art direction: a wooden desk lit from the window at the top right; squared paper with blue ink for you (X) and orange ink for Bolt (O); Bolt is a rounded teal robot with a dark screen face and cyan eyes. Round caps, outlines 3 to 4 units, soft shadows fall to the bottom left.</desc>
  ${A.defs()}
  <g id="desk" data-hsvg-layer="backdrop">
    ${A.desk(F.w, F.h)}
  </g>
  <g id="content" data-hsvg-layer="content">
    <g transform="${F.stage}">
      ${A.props()}
      ${A.pencil()}
      <g id="level-tag" data-hsvg-kind="part">
        <rect x="14" y="24" width="150" height="44" rx="8" fill="url(#g-card)" stroke="#8a7a50" stroke-width="3"/>
        <circle cx="28" cy="46" r="5" fill="#8a7a50"/>
        <text id="level-name" data-hsvg-kind="part" x="97" y="53" text-anchor="middle" ${font} font-size="21" font-weight="700" fill="${C.ink}">Level: Fair</text>
      </g>
      ${A.bolt()}
      ${A.paper()}
      ${A.eraserRoute()}
      ${A.eraser()}
      ${A.arm()}
      <g id="sparkles" data-hsvg-kind="part" data-hsvg-motion="opacity 0..1" pointer-events="none">
        <g id="sparkles-spin" data-hsvg-kind="part" data-hsvg-pivot="300 300" data-hsvg-motion="scale 0.94..1.06">
          ${sparkles}
        </g>
      </g>
    </g>
    <g id="panel" data-hsvg-kind="part">
      <rect x="${sx + 4}" y="${sy + 8}" width="${sw}" height="${sh}" rx="18" fill="#3d2410" opacity="0.3" filter="url(#f-soft-sm)"/>
      <rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="18" fill="url(#g-note)" stroke="#a8903a" stroke-width="3"/>
      <rect x="${sx + sw / 2 - 40}" y="${sy - 12}" width="80" height="24" rx="4" fill="#ffffff" opacity="0.55" stroke="#c9c3ac" stroke-width="2"/>
      <g id="status-win" data-hsvg-kind="part">
        <rect x="${sx + 2}" y="${sy + 2}" width="${sw - 4}" height="${sh - 4}" rx="16" fill="#ffd34d" fill-opacity="0.75"/>
        <rect x="${sx + 8}" y="${sy + 8}" width="${sw - 16}" height="${sh - 16}" rx="12" fill="none" stroke="#b98a14" stroke-width="2.5" stroke-dasharray="3 7" stroke-linecap="round"/>
        ${[sx + 38, sx + sw - 38].map(x => `<path d="M${x} ${sy + sh / 2 - 17}l5 11l12 1.5l-9 8l2.5 12l-10.5 -6l-10.5 6l2.5 -12l-9 -8l12 -1.5z" fill="#fff6cf" stroke="#b98a14" stroke-width="3" stroke-linejoin="round"/>`).join('')}
      </g>
      <g id="status-lose" data-hsvg-kind="part">
        <rect x="${sx + 2}" y="${sy + 2}" width="${sw - 4}" height="${sh - 4}" rx="16" fill="#ef7d2d" fill-opacity="0.28"/>
      </g>
      <rect id="status-box" data-hsvg-kind="part" data-hsvg-fit="" x="${sx + 20}" y="${sy + 18}" width="${sw - 40}" height="${sh - 36}" fill="none"/>
      <text id="status" data-hsvg-kind="part" data-hsvg-role="feedback" x="${sx + sw / 2}" y="${sy + sh / 2 + 9}" text-anchor="middle" ${font} font-size="${wide ? 28 : 26}" font-weight="700" fill="${C.ink}">Your move</text>
      <rect x="${tx + 4}" y="${ty + 8}" width="${tw}" height="${th}" rx="18" fill="#3d2410" opacity="0.3" filter="url(#f-soft-sm)"/>
      <rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="18" fill="url(#g-card)" stroke="#8a7a50" stroke-width="3"/>
      <path d="M${tx + colw} ${ty + 16}v${th - 32}M${tx + 2 * colw} ${ty + 16}v${th - 32}" stroke="#d9d2b8" stroke-width="3" stroke-dasharray="3 7" stroke-linecap="round"/>
      ${tallyBoxes.join('\n      ')}
      ${button('again', 'action', ...P.again.slice(0, 4).map((v, i) => v), 'g-button', 'again-label', 'New game')}
      ${button('change-level', 'action', ...P.change.slice(0, 4), 'g-button-teal', 'change-label', 'Change level', '#0f3b39')}
    </g>
  </g>
</svg>
`;
}


// ---------- JSON ----------
const ids = (n) => Array.from({ length: n }, (_, i) => i);
const mk = (o) => o;
const mood = "active('over') ? (winner === 'X' ? 'dizzy' : (winner === 'O' ? 'happy' : 'shrug')) : (active('inking') ? 'determined' : ((active('thinking') || active('reaching')) ? 'thinking' : (level === 1 ? 'sleepy' : (level === 3 ? 'determined' : 'idle'))))";
const gl = (ms, easing = 'ease-in-out') => ({ durationMs: ms, easing });
const angleTable = arr(AT.map(a => a.angle)); const slideTable = arr(AT.map(a => a.slide));

export function experienceJson(pins = {}, digests = {}) {
  return {
    format: 'hsvg/2.0', kind: 'experience', id: 'noughts', language: 'en',
    about: {
      title: 'Noughts and crosses',
      description: 'Play noughts and crosses against Bolt, a desk robot who thinks, reaches across the paper and draws its O. A logic module chooses the move; a capability makes the win glow; a preset shakes the paper when a cell is taken.',
      trust: { pins },
    },
    needs: ['example.noughts@1.0.0', 'example.glow@1.0.0'],
    resources: {
      'words-en': { kind: 'words', file: 'words/en.csv', language: 'en', digest: digests.words || 'sha256:' },
      lines: { kind: 'data', file: 'data/lines.csv', digest: digests.lines || 'sha256:' },
    },
    data: {
      lines: {
        resource: 'lines', key: 'id', maxRows: 8,
        columns: {
          id: { type: 'string', maxLength: 5 },
          a: { type: 'number', minimum: 0, maximum: 8 },
          b: { type: 'number', minimum: 0, maximum: 8 },
          c: { type: 'number', minimum: 0, maximum: 8 },
        },
      },
    },
    axes: [{ axis: 'shape', select: 'space', shapes: { wide: { minAspect: 1 }, tall: { maxAspect: 1 } } }],
    values: {
      level: { type: 'number', minimum: 1, maximum: 3, initial: 2 },
      wins: { type: 'number', minimum: 0, maximum: 99, initial: 0 },
      losses: { type: 'number', minimum: 0, maximum: 99, initial: 0 },
      draws: { type: 'number', minimum: 0, maximum: 99, initial: 0 },
    },
    audioSynths: {
      tap: { wave: 'triangle', from: 520, to: 400, durationMs: 80, gain: 0.3, releaseMs: 40 },
      inkX: { wave: 'noise', from: 3000, to: 2200, durationMs: 160, gain: 0.16, attackMs: 10, releaseMs: 60 },
      inkO: { wave: 'noise', from: 2600, to: 1800, durationMs: 260, gain: 0.16, attackMs: 10, releaseMs: 100 },
      nope: { wave: 'square', from: 190, to: 120, durationMs: 170, gain: 0.18, releaseMs: 70 },
      win: { wave: 'sine', from: 523, to: 1046, durationMs: 420, gain: 0.3, attackMs: 10, releaseMs: 240 },
      lose: { wave: 'sine', from: 330, to: 196, durationMs: 460, gain: 0.26, attackMs: 10, releaseMs: 260 },
      even: { wave: 'triangle', from: 392, to: 370, durationMs: 300, gain: 0.24, releaseMs: 160 },
      sweep: { wave: 'noise', from: 1200, to: 900, durationMs: 1000, gain: 0.1, attackMs: 80, releaseMs: 400 },
      hum: { wave: 'sine', from: 330, to: 360, durationMs: 220, gain: 0.12, attackMs: 40, releaseMs: 120 },
    },
    story: {
      start: 'pick',
      scenes: { pick: 'scenes/pick/scene.json', game: 'scenes/game/scene.json' },
      ends: ['game'],
      links: [
        { id: 'pick-to-game', from: 'pick', on: 'play', to: 'game', transition: 'slide', transitionMs: 450 },
        { id: 'game-to-pick', from: 'game', on: 'changeLevel', to: 'pick', transition: 'slide', transitionMs: 450, slideFrom: 'start' },
      ],
    },
  };
}


export function pickJson() {
  const opts = {};
  [['easy', 1], ['fair', 2], ['hard', 3]].forEach(([id, n]) => { opts[id] = { target: `level-${n}`, value: String(n), label: `{{ words.${id} }}`, keys: [`Digit${n}`] }; });
  const bindings = [];
  [['title', 'title'], ['subtitle', 'subtitle'], ['pick-label', 'pickLevel'], ['play-label', 'play']].forEach(([t, w]) => bindings.push({ id: `${t}-text`, target: t, text: `{{ words.${w} }}` }));
  [[1, 'easy'], [2, 'fair'], [3, 'hard']].forEach(([n, id]) => {
    bindings.push({ id: `level-${n}-name-text`, target: `level-${n}-name`, text: `{{ words.${id} }}` });
    bindings.push({ id: `level-${n}-note-text`, target: `level-${n}-note`, text: `{{ words.${id}Note }}`, fit: { box: `level-${n}-note-box`, minFontPx: 13, maxLines: 2 } });
    bindings.push({ id: `level-${n}-ticks`, target: `level-${n}-on`, visible: `level === ${n}` });
  });
  bindings.push({ id: 'eyes-mood', target: 'bolt-eyes', variant: "level === 1 ? 'sleepy' : (level === 3 ? 'determined' : 'idle')" });
  bindings.push({ id: 'mouth-mood', target: 'bolt-mouth', variant: "level === 1 ? 'sleepy' : (level === 3 ? 'determined' : 'idle')" });
  bindings.push({ id: 'eyes-follow', target: 'bolt-eyes', axis: 'x', move: 'clamp(1.5 + level * 1.4, -6, 6)', glide: gl(320) });
  bindings.push({ id: 'eyes-look-down', target: 'bolt-eyes', axis: 'y', move: 'clamp(1 + level * 0.6, -5, 5)', glide: gl(320) });
  bindings.push({ id: 'head-leans', target: 'bolt-head', rotate: 'clamp((level - 2) * 4, -14, 14)', glide: gl(380) });
  return {
    format: 'hsvg/2.0', kind: 'scene', id: 'pick',
    layouts: [{ id: 'wide', shape: 'wide', drawing: 'pick.svg' }, { id: 'tall', shape: 'tall', drawing: 'pick.tall.svg' }],
    outputs: { play: { kind: 'event' } },
    controls: {
      levels: { kind: 'choice', value: 'level', event: 'levelled', label: '{{ words.levelGroup }}', options: opts },
      go: { kind: 'button', target: 'play', event: 'play', label: '{{ words.play }}' },
    },
    on: {
      levelled: [{ id: 'level-chosen', actions: [{ id: 'tap-level', play: "'tap'", as: 'sound', group: 'sounds' }] }],
      play: [{ id: 'play-chosen', actions: [{ id: 'tap-play', play: "'tap'", as: 'sound', group: 'sounds' }] }],
    },
    entry: [{ id: 'bulb-on', play: 'bulb' }, { id: 'breathe-on', play: 'breathe' }, { id: 'blink-on', play: 'blink' }, { id: 'sway-on', play: 'sway' }, { id: 'wave-on', play: 'wave' }],
    clips: {
      bulb: { durationMs: 1500, loop: true, loopMode: 'ping-pong', reducedMotion: 'rest', tracks: [
        { id: 'bulb-grows', target: 'bolt-bulb', channel: 'scale', keys: [[0, 1], [1500, 1.2, 'ease-in-out']] },
        { id: 'bulb-glows', target: 'bolt-bulb', channel: 'opacity', keys: [[0, 0.6], [1500, 1, 'ease-in-out']] },
      ] },
      breathe: { durationMs: 2400, loop: true, loopMode: 'ping-pong', reducedMotion: 'rest', tracks: [{ id: 'chest-swells', target: 'bolt-chest', channel: 'scale', keys: [[0, 1], [2400, 1.05, 'ease-in-out']] }] },
      blink: { durationMs: 3800, loop: true, reducedMotion: 'rest', tracks: [{ id: 'eyes-blink', target: 'bolt-eyes', channel: 'scale', axis: 'y', keys: [[0, 1], [3500, 1], [3580, 0.1, 'ease-in'], [3700, 1, 'ease-out'], [3800, 1]] }] },
      sway: { durationMs: 2600, loop: true, loopMode: 'ping-pong', reducedMotion: 'rest', tracks: [{ id: 'head-bobs', target: 'bolt-head-bob', channel: 'move', axis: 'y', keys: [[0, 0], [2600, -3, 'ease-in-out']] }] },
      wave: { durationMs: 1800, loop: true, loopMode: 'ping-pong', reducedMotion: 'rest', tracks: [{ id: 'arm-waves', target: 'pick-arm', channel: 'rotate', keys: [[0, -8], [1800, 24, 'ease-in-out']] }] },
    },
    bindings,
  };
}

export function gameJson() {
  const cellOptions = {};
  for (const i of ids(9)) {
    cellOptions[`c${i}`] = {
      target: `cell-${i}`, value: String(i), keys: [`Digit${i + 1}`],
      label: `{{ words.cell }} ${i + 1}, {{ at(board, ${i}, '') === 'X' ? words.markX : (at(board, ${i}, '') === 'O' ? words.markO : words.markEmpty) }}`,
    };
  }
  const bindings = [];
  for (const i of ids(9)) {
    bindings.push({ id: `x-${i}-draws`, target: `x-${i}`, draw: `at(board, ${i}, '') === 'X' ? 1 : 0`, glide: gl(320, 'ease-out') });
    bindings.push({ id: `o-${i}-draws`, target: `o-${i}`, draw: `at(board, ${i}, '') === 'O' && !(reply === ${i} && (active('thinking') || active('reaching'))) ? 1 : 0`, glide: gl(480) });
  }
  for (const [id] of A.LINES) bindings.push({ id: `win-${id}-draws`, target: `win-${id}`, draw: `active('over') && winLine === '${id}' ? 1 : 0`, glide: gl(520) });
  bindings.push({ id: 'marks-fade', target: 'marks', opacity: "active('erasing') ? 0 : 1", glide: gl(700) });
  bindings.push({ id: 'arm-turns', target: 'arm', rotate: 'reachAngle', glide: gl(640) });
  bindings.push({ id: 'hand-slides', target: 'arm-hand', axis: 'y', move: 'reachSlide', glide: gl(640) });
  for (const id of ['arm-tube-edge', 'arm-tube', 'arm-tube-shade', 'arm-tube-shine']) bindings.push({ id: `${id}-draws`, target: id, draw: `(reachSlide + ${WRIST0}) / 440`, glide: gl(640) });
  for (let k = 1; k <= 4; k++) bindings.push({ id: `arm-ring-${k}-slides`, target: `arm-ring-${k}`, axis: 'y', move: `(reachSlide + ${WRIST0}) * ${k * 0.2}`, glide: gl(640) });
  bindings.push({ id: 'head-tilts', target: 'bolt-head', rotate: "active('thinking') ? -8 : (active('reaching') ? -3 : (active('inking') ? 4 : 0))", glide: gl(420) });
  bindings.push({ id: 'eyes-mood', target: 'bolt-eyes', variant: 'mood' });
  bindings.push({ id: 'mouth-mood', target: 'bolt-mouth', variant: 'mood' });
  bindings.push({ id: 'eyes-glance-x', target: 'bolt-eyes', axis: 'x', move: 'clamp(reachCell >= 0 ? (reachCell % 3 - 1) * 4 : 0, -6, 6)', glide: gl(300) });
  bindings.push({ id: 'eyes-glance-y', target: 'bolt-eyes', axis: 'y', move: 'clamp(reachCell >= 0 ? 3 : 0, -5, 5)', glide: gl(300) });
  bindings.push({ id: 'dots-show', target: 'bolt-dots', opacity: "active('thinking') ? 1 : 0", glide: gl(200, 'ease-out') });
  bindings.push({ id: 'sparkles-show', target: 'sparkles', opacity: "cheered && !active('erasing') ? 1 : 0", glide: gl(400, 'ease-out') });
  bindings.push({ id: 'status-win-shows', target: 'status-win', visible: "active('over') && winner === 'X'" });
  bindings.push({ id: 'status-lose-shows', target: 'status-lose', visible: "active('over') && winner === 'O'" });
  bindings.push({ id: 'halo-pulses', target: 'paper-halo', opacity: 'glow' });
  bindings.push({ id: 'status-text', target: 'status', text: "{{ thinkingNow ? words.thinking : (active('over') ? (winner === 'X' ? words.youWin : (winner === 'O' ? words.boltWins : words.aDraw)) : (active('erasing') ? words.clearing : words.yourMove)) }}", fit: { box: 'status-box', minFontPx: 18, maxLines: 2 } });
  bindings.push({ id: 'level-text', target: 'level-name', text: '{{ words.level }}: {{ level === 1 ? words.easy : (level === 2 ? words.fair : words.hard) }}' });
  bindings.push({ id: 'again-text', target: 'again-label', text: '{{ words.newGame }}' });
  bindings.push({ id: 'change-text', target: 'change-label', text: '{{ words.changeLevel }}' });
  for (const [p, label, v, word] of [['tally-you', 'you', 'wins', 'you'], ['tally-bolt', 'bolt', 'losses', 'bolt'], ['tally-draw', 'draw', 'draws', 'draws']]) {
    bindings.push({ id: `${p}-label-text`, target: `${p}-label`, text: `{{ words.${word} }}` });
    bindings.push({ id: `${p}-count-text`, target: `${p}-count`, text: `{{ ${v} }}` });
    for (let k = 1; k <= 5; k++) bindings.push({ id: `${p}-m${k}-draws`, target: `${p}-m${k}`, draw: `${v} >= ${k} ? 1 : 0`, glide: gl(260, 'ease-out') });
  }
  const keys = (pairs, d = 0) => pairs;
  const clips = {
    'grid-in': { durationMs: 1100, tracks: [{ id: 'grid-draws', target: 'grid-1', channel: 'draw', keys: [[0, 0], [520, 1, 'ease-out']], stagger: { targets: ['grid-2', 'grid-3', 'grid-4'], eachMs: 160 } }] },
    sweep: { durationMs: 1100, reducedMotion: 'rest', tracks: [{ id: 'eraser-travels', target: 'eraser', channel: 'move', axis: 'route', route: 'eraser-route', keys: [[0, 0], [1100, 1, 'ease-in-out']] }] },
    dance: { durationMs: 1200, loop: 2, reducedMotion: 'rest', tracks: [
      { id: 'dance-body', target: 'bolt', channel: 'move', axis: 'y', keys: [[0, 0], [150, -14, 'ease-out'], [300, 0, 'ease-in'], [450, -14, 'ease-out'], [600, 0, 'ease-in'], [750, -14, 'ease-out'], [900, 0, 'ease-in'], [1200, 0]] },
      { id: 'dance-arm', target: 'arm', channel: 'move', axis: 'y', keys: [[0, 0], [150, -14, 'ease-out'], [300, 0, 'ease-in'], [450, -14, 'ease-out'], [600, 0, 'ease-in'], [750, -14, 'ease-out'], [900, 0, 'ease-in'], [1200, 0]] },
      { id: 'dance-head', target: 'bolt-head-bob', channel: 'rotate', keys: [[0, 0], [300, -8, 'ease-in-out'], [600, 8, 'ease-in-out'], [900, -8, 'ease-in-out'], [1200, 0, 'ease-in-out']] },
    ] },
    dizzy: { durationMs: 1500, reducedMotion: 'rest', tracks: [
      { id: 'dizzy-head', target: 'bolt-head-bob', channel: 'rotate', keys: [[0, 0], [220, -10, 'ease-in-out'], [520, 9, 'ease-in-out'], [820, -6, 'ease-in-out'], [1120, 3, 'ease-in-out'], [1500, 0, 'ease-out']] },
    ] },
    shrug: { durationMs: 1000, reducedMotion: 'rest', tracks: [
      { id: 'shrug-body', target: 'bolt', channel: 'move', axis: 'y', keys: [[0, 0], [100, 2, 'ease-in'], [280, -8, 'ease-out'], [760, -8], [1000, 0, 'ease-in-out']] },
      { id: 'shrug-arm', target: 'arm', channel: 'move', axis: 'y', keys: [[0, 0], [100, 2, 'ease-in'], [280, -8, 'ease-out'], [760, -8], [1000, 0, 'ease-in-out']] },
      { id: 'shrug-head', target: 'bolt-head-bob', channel: 'rotate', keys: [[0, 0], [280, 8, 'ease-in-out'], [760, 8], [1000, 0, 'ease-in-out']] },
    ] },
    bulb: { durationMs: 1500, loop: true, loopMode: 'ping-pong', reducedMotion: 'rest', tracks: [
      { id: 'bulb-grows', target: 'bolt-bulb', channel: 'scale', keys: [[0, 1], [1500, 1.2, 'ease-in-out']] },
      { id: 'bulb-glows', target: 'bolt-bulb', channel: 'opacity', keys: [[0, 0.6], [1500, 1, 'ease-in-out']] },
    ] },
    breathe: { durationMs: 2400, loop: true, loopMode: 'ping-pong', reducedMotion: 'rest', tracks: [
      { id: 'chest-swells', target: 'bolt-chest', channel: 'scale', keys: [[0, 1], [2400, 1.05, 'ease-in-out']] },
    ] },
    blink: { durationMs: 3800, loop: true, reducedMotion: 'rest', tracks: [
      { id: 'eyes-blink', target: 'bolt-eyes', channel: 'scale', axis: 'y', keys: [[0, 1], [3500, 1], [3580, 0.1, 'ease-in'], [3700, 1, 'ease-out'], [3800, 1]] },
    ] },
    sway: { durationMs: 2600, loop: true, loopMode: 'ping-pong', reducedMotion: 'rest', tracks: [
      { id: 'head-bobs', target: 'bolt-head-bob', channel: 'move', axis: 'y', keys: [[0, 0], [2600, -3, 'ease-in-out']] },
    ] },
    dots: { durationMs: 1500, loop: true, reducedMotion: 'rest', tracks: [
      { id: 'dot-1-blinks', target: 'bolt-dot-1', channel: 'opacity', keys: [[0, 0.25], [250, 1, 'ease-out'], [600, 0.25, 'ease-in'], [1000, 0.25]], stagger: { targets: ['bolt-dot-2', 'bolt-dot-3'], eachMs: 220 } },
    ] },
    twinkle: { durationMs: 1400, loop: true, loopMode: 'ping-pong', reducedMotion: 'rest', tracks: [
      { id: 'sparkles-twinkle', target: 'sparkles-spin', channel: 'scale', keys: [[0, 0.94], [1400, 1.06, 'ease-in-out']] },
    ] },
    'pop-you': { durationMs: 520, tracks: [{ id: 'you-count-pops', target: 'tally-you-count', channel: 'scale', keys: [[0, 1], [160, 1.35, 'ease-out'], [520, 1, 'ease-in-out']] }] },
    'pop-bolt': { durationMs: 520, tracks: [{ id: 'bolt-count-pops', target: 'tally-bolt-count', channel: 'scale', keys: [[0, 1], [160, 1.35, 'ease-out'], [520, 1, 'ease-in-out']] }] },
    'pop-draw': { durationMs: 520, tracks: [{ id: 'draw-count-pops', target: 'tally-draw-count', channel: 'scale', keys: [[0, 1], [160, 1.35, 'ease-out'], [520, 1, 'ease-in-out']] }] },
  };
  const turn = {
    id: 'turn', call: 'example.noughts.turn',
    with: { board: 'board', cell: 'cell', level: 'level' },
    to: { board: 'board', winner: 'winner', reply: 'reply' },
  };
  const machines = [{
    id: 'round', initial: 'your-turn',
    states: {
      'your-turn': {
        on: {
          picked: [
            { id: 'cell-taken', guard: "at(board, cell, '') !== ''", actions: [{ id: 'shake', play: 'nope' }, { id: 'buzz', play: "'nope'", as: 'sound', group: 'sounds' }] },
            { id: 'place-x', actions: [turn, { id: 'new-seed', set: 'seed', to: '(seed * 7 + 3) % 100000' }, { id: 'scratch-x', play: "'inkX'", as: 'sound', group: 'sounds' }, { id: 'moved', emit: 'moved' }] },
          ],
          moved: [
            { id: 'bolt-replies', guard: 'reply >= 0', target: 'thinking' },
            { id: 'game-ends', target: 'over' },
          ],
          again: [{ id: 'rub-out', target: 'erasing' }],
        },
      },
      thinking: {
        entry: [{ id: 'hum-hm', play: "'hum'", as: 'sound', group: 'sounds' }],
        after: [{ id: 'bolt-decides', delayMs: 'random(550, 1150, seed)', target: 'reaching' }],
      },
      reaching: { after: [{ id: 'arm-arrives', delayMs: 660, target: 'inking' }] },
      inking: {
        entry: [{ id: 'scratch-o', play: "'inkO'", as: 'sound', group: 'sounds' }],
        after: [
          { id: 'o-done-over', delayMs: 560, guard: "winner !== ''", target: 'over' },
          { id: 'o-done-play-on', delayMs: 560, guard: "winner === ''", target: 'your-turn' },
        ],
      },
      over: {
        entry: [
          { id: 'you-won', if: "winner === 'X'", then: [
            { id: 'count-win', set: 'wins', to: 'min(99, wins + 1)' },
            { id: 'pop-wins', play: 'pop-you' },
            { id: 'win-chime', play: "'win'", as: 'sound', group: 'sounds' },
            { id: 'dizzy-bolt', play: 'dizzy' },
            { id: 'glow', call: 'example.glow.pulse', with: { times: '3' } },
          ] },
          { id: 'bolt-won', if: "winner === 'O'", then: [
            { id: 'count-loss', set: 'losses', to: 'min(99, losses + 1)' },
            { id: 'pop-losses', play: 'pop-bolt' },
            { id: 'lose-note', play: "'lose'", as: 'sound', group: 'sounds' },
            { id: 'bolt-dances', play: 'dance' },
          ] },
          { id: 'nobody-won', if: "winner === 'draw'", then: [
            { id: 'count-draw', set: 'draws', to: 'min(99, draws + 1)' },
            { id: 'pop-draws', play: 'pop-draw' },
            { id: 'even-note', play: "'even'", as: 'sound', group: 'sounds' },
            { id: 'bolt-shrugs', play: 'shrug' },
          ] },
        ],
        on: { again: [{ id: 'rub-out-again', target: 'erasing' }] },
      },
      erasing: {
        entry: [{ id: 'sweep-starts', play: 'sweep' }, { id: 'sweep-sound', play: "'sweep'", as: 'sound', group: 'sounds' }],
        after: [{
          id: 'paper-clean', delayMs: 1100, target: 'your-turn',
          actions: [
            { id: 'clear', set: 'board', to: "['', '', '', '', '', '', '', '', '']" },
            { id: 'no-winner', set: 'winner', to: '' },
            { id: 'no-reply', set: 'reply', to: '-1' },
            { id: 'no-cheer', set: 'cheered', to: 'false' },
          ],
        }],
      },
    },
  }];
  return {
    format: 'hsvg/2.0', kind: 'scene', id: 'game',
    layouts: [{ id: 'wide', shape: 'wide', drawing: 'game.svg' }, { id: 'tall', shape: 'tall', drawing: 'game.tall.svg' }],
    presets: [{ use: 'example.shake@1.0.0', as: 'nope', with: { target: 'board', distance: 10 } }],
    addons: { 'example.glow': { part: 'board', color: '#ffb800', level: 'glow' } },
    outputs: { changeLevel: { kind: 'event' } },
    values: {
      board: { type: 'array', maxItems: 9, items: { type: 'string', enum: ['', 'X', 'O'], maxLength: 1 }, initial: ['', '', '', '', '', '', '', '', ''] },
      cell: { type: 'number', minimum: 0, maximum: 8, initial: 0 },
      winner: { type: 'string', enum: ['', 'X', 'O', 'draw'], initial: '', maxLength: 4 },
      reply: { type: 'number', minimum: -1, maximum: 8, initial: -1 },
      seed: { type: 'number', minimum: 0, maximum: 99999, initial: 17 },
      glow: { type: 'number', minimum: 0, maximum: 1, initial: 0 },
      cheered: { type: 'boolean', initial: false },
    },
    computed: {
      lineRows: "filter(data.lines, at(board, item.a, '') !== '' && at(board, item.a, '') === at(board, item.b, '') && at(board, item.a, '') === at(board, item.c, ''))",
      winLine: "length(lineRows) > 0 ? at(lineRows, 0, data.lines[0]).id : ''",
      thinkingNow: "active('thinking') || active('reaching') || active('inking')",
      reachCell: "(active('reaching') || active('inking')) ? reply : -1",
      reachAngle: `at(${angleTable}, reachCell, ${r1(REST.angle)})`,
      reachSlide: `at(${slideTable}, reachCell, ${REST.slide})`,
      mood,
    },
    controls: {
      cells: { kind: 'choice', value: 'cell', event: 'picked', enabled: "active('your-turn')", label: '{{ words.board }}', options: cellOptions },
      again: { kind: 'button', target: 'again', event: 'again', enabled: "active('your-turn') || active('over')", label: '{{ words.newGame }}' },
      'change-level': { kind: 'button', target: 'change-level', event: 'changeLevel', enabled: "active('your-turn') || active('over')", label: '{{ words.changeLevel }}' },
    },
    on: {
      'example.glow:faded': [{ id: 'cheer', actions: [{ id: 'cheered', set: 'cheered', to: 'true' }] }],
    },
    entry: [
      { id: 'draw-grid', play: 'grid-in' }, { id: 'bulb-on', play: 'bulb' }, { id: 'breathe-on', play: 'breathe' }, { id: 'blink-on', play: 'blink' },
      { id: 'sway-on', play: 'sway' }, { id: 'dots-on', play: 'dots' }, { id: 'twinkle-on', play: 'twinkle' },
    ],
    machines, clips, bindings,
  };
}


// ---------- pick drawing ----------
function levelCard(n, x, y, w, h, mood, noteRegion) {
  const cx = x + w / 2; const k = w / 168; // face scale
  const faceY = y + 20;
  const base = (stroke = '#8a7a50', shadow = true) => `${shadow ? `<rect x="${x + 4}" y="${y + 9}" width="${w}" height="${h}" rx="18" fill="#3d2410" opacity="0.32"/>` : ''}<rect x="${x}" y="${y + (shadow ? 0 : 5)}" width="${w}" height="${h - (shadow ? 0 : 5)}" rx="18" fill="url(#g-card)" stroke="${stroke}" stroke-width="3"/>`;
  const sc = 0.82 * k;
  return `<g id="level-${n}" data-hsvg-kind="part" data-hsvg-role="action">
        <g data-hsvg-variant="idle">${base()}</g>
        <g data-hsvg-variant="hover" display="none">${base('#b98a14')}<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#ffd34d" opacity="0.18"/></g>
        <g data-hsvg-variant="pressed" display="none">${base('#8a7a50', false)}<rect x="${x}" y="${y + 5}" width="${w}" height="${h - 5}" rx="18" fill="#000" opacity="0.08"/></g>
        <g data-hsvg-variant="focus" display="none">${base()}<rect x="${x - 6}" y="${y - 6}" width="${w + 12}" height="${h + 12}" rx="22" fill="none" stroke="${C.x}" stroke-width="3.5" stroke-dasharray="9 6" stroke-linecap="round"/></g>
        <g transform="translate(${r1(cx - HEAD.x * sc)} ${r1(faceY - (HEAD.y - 44) * sc)}) scale(${r1(sc)})">
          <rect x="${HEAD.x - 58}" y="${HEAD.y - 44}" width="116" height="84" rx="24" fill="url(#g-screen)" stroke="#0a171c" stroke-width="3.5"/>
          ${A.eyes(mood)}${A.mouth(mood)}
        </g>
        ${text(`level-${n}-name`, cx, y + h - 70, 30, C.ink, 'Easy')}
        <rect id="level-${n}-note-box" data-hsvg-kind="part" data-hsvg-fit="" x="${x + 12}" y="${y + h - 56}" width="${w - 24}" height="44" fill="none"/>
        <text id="level-${n}-note" data-hsvg-kind="part" x="${cx}" y="${y + h - 34}" text-anchor="middle" ${font} font-size="17" fill="#4a4f57">note</text>
        <g id="level-${n}-on" data-hsvg-kind="part">
          <rect x="${x - 4}" y="${y - 4}" width="${w + 8}" height="${h + 8}" rx="21" fill="none" stroke="${C.gold}" stroke-width="6"/>
          <circle cx="${x + w - 6}" cy="${y + 6}" r="19" fill="${C.gold}" stroke="#8a5a0a" stroke-width="3"/>
          <path d="M${x + w - 15} ${y + 7}l7 7l12 -15" fill="none" stroke="#5d3a12" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
      </g>`;
}

function pickSvg(frame) {
  const wide = frame === 'wide'; const F = FRAMES[frame];
  const boltT = wide ? 'translate(-134 90) scale(1.3)' : 'translate(15 141) scale(0.95)';
  const banner = wide ? [452, 28, 480, 112] : [24, 24, 552, 104];
  const label = wide ? [452, 158, 480] : [24, 518, 552];
  const cw = wide ? 150 : 168; const ch = wide ? 214 : 214;
  const cardY = wide ? 232 : 580;
  const cardX = wide ? [452, 616, 780] : [24, 216, 408];
  const play = wide ? [452, 484, 480, 84] : [24, 826, 552, 88];
  const moods = ['sleepy', 'idle', 'determined'];
  const [bx, by, bw, bh] = banner;
  const [sx, sy] = SHOULDER;
  const hx = HEAD.x;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${F.w} ${F.h}" data-hsvg-version="2.0" data-hsvg-kind="screen">
  <title>Noughts and crosses: pick a level</title>
  <desc>Art direction: a wooden desk lit from the window at the top right; Bolt, a rounded teal robot with a dark screen face and cyan eyes, stands behind three paper level cards. Round caps, outlines 3 to 4 units, soft shadows fall to the bottom left.</desc>
  ${A.defs()}
  <g id="desk" data-hsvg-layer="backdrop">
    ${A.desk(F.w, F.h)}
  </g>
  <g id="content" data-hsvg-layer="content">
    <g transform="${boltT}">
      ${A.bolt({ dots: false })}
      <g id="pick-arm" data-hsvg-kind="part" data-hsvg-pivot="${sx} ${sy}" data-hsvg-motion="rotate -12..40">
        <path d="M${sx} ${sy}l-34 112" fill="none" stroke="${C.tealLine}" stroke-width="32" stroke-linecap="round"/>
        <path d="M${sx} ${sy}l-34 112" fill="none" stroke="${C.teal}" stroke-width="25" stroke-linecap="round"/>
        <path d="M${sx - 8} ${sy + 4}l-32 104" fill="none" stroke="#2f716d" stroke-opacity="0.75" stroke-width="8" stroke-linecap="round"/>
        <path d="M${sx + 6} ${sy + 4}l-32 104" fill="none" stroke="#e8fffb" stroke-opacity="0.8" stroke-width="5" stroke-linecap="round"/>
        <g transform="rotate(16 ${sx - 34} ${sy + 112})">
          <rect x="${sx - 54}" y="${sy + 78}" width="40" height="12" rx="5" fill="url(#g-metal)" stroke="${C.tealLine}" stroke-width="3"/>
          <path d="M${sx - 56} ${sy + 114}a22 19 0 0 1 44 0v9a22 19 0 0 1 -44 0z" fill="url(#g-glove)" stroke="${C.tealLine}" stroke-width="3"/>
          <path d="M${sx - 48} ${sy + 116}a5 4 0 0 1 8 -2M${sx - 37} ${sy + 114}a5 4 0 0 1 8 0M${sx - 26} ${sy + 116}a5 4 0 0 1 8 2" fill="none" stroke="#9fb0b5" stroke-width="2" stroke-linecap="round"/>
        </g>
        <circle cx="${sx}" cy="${sy}" r="18" fill="url(#g-metal)" stroke="${C.tealLine}" stroke-width="3.5"/>
        <circle cx="${sx}" cy="${sy}" r="6.5" fill="#7ea0a8" stroke="${C.tealLine}" stroke-width="2"/>
      </g>
      <path d="M${hx + 98 - 22} 332a22 19 0 0 1 44 0v9a22 19 0 0 1 -44 0z" fill="url(#g-glove)" stroke="${C.tealLine}" stroke-width="3"/>
      <path d="M${hx + 98 - 14} 334a5 4 0 0 1 8 -2M${hx + 98 - 3} 332a5 4 0 0 1 8 0M${hx + 98 + 8} 334a5 4 0 0 1 8 2" fill="none" stroke="#9fb0b5" stroke-width="2" stroke-linecap="round"/>
    </g>
    <g id="pick-paper" transform="rotate(-1.4 ${wide ? 690 : 300} ${wide ? 400 : 700})">
      <rect x="${wide ? 432 : 8}" y="${wide ? 152 : 520}" width="${wide ? 516 : 584}" height="${wide ? 426 : 330}" rx="6" fill="#3d2410" opacity="0.3" filter="url(#f-soft)" transform="translate(-6 8)"/>
      <rect x="${wide ? 432 : 8}" y="${wide ? 152 : 520}" width="${wide ? 516 : 584}" height="${wide ? 426 : 330}" rx="6" fill="url(#g-paper)" stroke="#d8d3c0" stroke-width="2"/>
      <rect x="${wide ? 432 : 8}" y="${wide ? 152 : 520}" width="${wide ? 516 : 584}" height="${wide ? 426 : 330}" rx="6" fill="url(#p-squares)"/>
    </g>
    <g id="banner" data-hsvg-kind="part">
      <rect x="${bx + 4}" y="${by + 8}" width="${bw}" height="${bh}" rx="18" fill="#3d2410" opacity="0.32" filter="url(#f-soft-sm)"/>
      <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="18" fill="url(#g-note)" stroke="#a8903a" stroke-width="3"/>
      <rect x="${bx + bw / 2 - 40}" y="${by - 12}" width="80" height="24" rx="4" fill="#ffffff" opacity="0.55" stroke="#c9c3ac" stroke-width="2"/>
      <text id="title" data-hsvg-kind="part" data-hsvg-role="message" x="${bx + bw / 2}" y="${by + (wide ? 56 : 54)}" text-anchor="middle" ${font} font-size="${wide ? 40 : 38}" font-weight="700" fill="${C.ink}">Noughts and crosses</text>
      <text id="subtitle" data-hsvg-kind="part" x="${bx + bw / 2}" y="${by + (wide ? 88 : 86)}" text-anchor="middle" ${font} font-size="21" fill="#4a4f57">Play against Bolt</text>
    </g>
    <g id="pick-label-wrap" data-hsvg-kind="part">
      <rect x="${label[0] + 20}" y="${label[1]}" width="${label[2] - 40}" height="40" rx="12" fill="url(#g-card)" stroke="#8a7a50" stroke-width="3"/>
      <text id="pick-label" data-hsvg-kind="part" x="${label[0] + label[2] / 2}" y="${label[1] + 28}" text-anchor="middle" ${font} font-size="22" font-weight="700" fill="${C.ink}">Pick how clever Bolt is</text>
    </g>
    ${[1, 2, 3].map(n => levelCard(n, cardX[n - 1], cardY, cw, ch, moods[n - 1])).join('\n    ')}
    ${button('play', 'action', play[0], play[1], play[2], play[3], 'g-button', 'play-label', 'Play')}
    ${wide ? A.pencil().replace('translate(512 340) rotate(-8)', 'translate(404 566) rotate(80) scale(0.62)') : ''}
  </g>
</svg>
`;
}

export { gameSvg, pickSvg };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  write('words/en.csv', csv(WORDS));
  write('data/lines.csv', 'id,a,b,c\n' + A.LINES.map(l => l.join(',')).join('\n') + '\n');
  for (const f of Object.keys(FRAMES)) { write(`scenes/game/game${FRAMES[f].suffix}.svg`, gameSvg(f)); write(`scenes/pick/pick${FRAMES[f].suffix}.svg`, pickSvg(f)); }
  write('scenes/pick/scene.json', json(pickJson()));
  write('experience.json', json(experienceJson()));
  write('scenes/game/scene.json', json(gameJson()));
  console.log('files written');
}

