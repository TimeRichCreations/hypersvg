// The drawings of the noughts showcase, as functions that return SVG text. make.mjs places them in each frame.
// Art direction (A1): light from the window at the top right. Lit edges are light, shaded edges dark, and cast
// shadows fall to the bottom left. One line weight (3 to 4 units for outlines), round caps, round corners.
// Palette: desk wood #c48a55, paper #fbfaf4 with blue rules #cfdcef, your X in blue ink #2456c8, Bolt's O in
// orange ink #ef7d2d, Bolt in teal #5bb6b0 with a dark screen #10242c and cyan eyes #7ef3ff, highlights in gold
// #ffd34d, the winning line in raspberry #e5445f.
import { STAGE, SHEET, CELL, K, GRID, CX, CY, cellCentre, HEAD, SHOULDER, PEN, WRIST0, TUBE_MAX } from './geometry.mjs';

export const C = {
  wood: '#c48a55', woodLight: '#dca673', woodDark: '#8e5a30', paper: '#fbfaf4', rule: '#cfdcef', margin: '#f2b8b8',
  x: '#2456c8', o: '#ef7d2d', graphite: '#4a4f57', teal: '#5bb6b0', tealLight: '#9fe6df', tealDark: '#357f7b',
  tealLine: '#24605d', screen: '#10242c', cyan: '#7ef3ff', gold: '#ffd34d', raspberry: '#e5445f', ink: '#2b3036',
  cream: '#fff6df',
};

// A small deterministic random source, so the hand-drawn wobble is the same on every build.
export function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const n1 = (n) => (Math.round(n * 10) / 10).toString();

// ---------- shared definitions ----------
// Wood grain as a tiling pattern (two planks tall): long soft streaks and a few knots. A pattern costs no filter surface.
function grainPattern() {
  const r = rng(11); const W = 420; const H = 300; const out = [];
  for (let k = 0; k < 46; k++) {
    const y = r() * H; const amp = 2 + r() * 5; const dark = r() < 0.62;
    const x0 = r() * 120 - 20; const len = 200 + r() * 260;
    out.push(`<path d="M${n1(x0)} ${n1(y)}C${n1(x0 + len * 0.3)} ${n1(y - amp)} ${n1(x0 + len * 0.6)} ${n1(y + amp)} ${n1(x0 + len)} ${n1(y - amp * 0.3)}" fill="none" stroke="${dark ? '#6b3f1c' : '#f0c796'}" stroke-opacity="${n1((dark ? 0.16 : 0.2) + r() * 0.08)}" stroke-width="${n1(1 + r() * 2.2)}" stroke-linecap="round"/>`);
    if (x0 + len > W - 10) out.push(`<path d="M${n1(x0 - W)} ${n1(y)}C${n1(x0 - W + len * 0.3)} ${n1(y - amp)} ${n1(x0 - W + len * 0.6)} ${n1(y + amp)} ${n1(x0 - W + len)} ${n1(y - amp * 0.3)}" fill="none" stroke="${dark ? '#6b3f1c' : '#f0c796'}" stroke-opacity="0.18" stroke-width="2" stroke-linecap="round"/>`);
  }
  for (const [kx, ky] of [[90, 60], [310, 210]]) out.push(`<ellipse cx="${kx}" cy="${ky}" rx="15" ry="7" fill="none" stroke="#6b3f1c" stroke-opacity="0.2" stroke-width="2.5"/><ellipse cx="${kx}" cy="${ky}" rx="8" ry="3.5" fill="#6b3f1c" fill-opacity="0.14"/>`);
  return `<pattern id="p-grain" width="${W}" height="${H}" patternUnits="userSpaceOnUse">${out.join('')}</pattern>`;
}
export function defs() {
  return `<defs>
    <linearGradient id="g-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9a06a"/><stop offset="0.5" stop-color="#c48a55"/><stop offset="1" stop-color="#a86f40"/></linearGradient>
    ${grainPattern()}
    <radialGradient id="g-vignette" cx="0.62" cy="0.3" r="0.9"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#2a1608" stop-opacity="0.5"/></radialGradient>
    <linearGradient id="g-window" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c9" stop-opacity="0.55"/><stop offset="0.5" stop-color="#fff3c9" stop-opacity="0"/></linearGradient>
    <linearGradient id="g-paper" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f0eee1"/></linearGradient>
    <pattern id="p-squares" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M0 0H18M0 0V18" fill="none" stroke="#cfdcef" stroke-width="1.2"/></pattern>
    <linearGradient id="g-teal" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fe6df"/><stop offset="0.45" stop-color="#5bb6b0"/><stop offset="1" stop-color="#357f7b"/></linearGradient>
    <linearGradient id="g-tube" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fe6df"/><stop offset="0.35" stop-color="#5bb6b0"/><stop offset="1" stop-color="#2f716d"/></linearGradient>
    <linearGradient id="g-tube-v" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2f716d"/><stop offset="0.5" stop-color="#5bb6b0"/><stop offset="1" stop-color="#9fe6df"/></linearGradient>
    <radialGradient id="g-screen" cx="0.5" cy="0.4" r="0.8"><stop offset="0" stop-color="#1d4350"/><stop offset="1" stop-color="#10242c"/></radialGradient>
    <radialGradient id="g-eye" cx="0.5" cy="0.4" r="0.7"><stop offset="0" stop-color="#d8fcff"/><stop offset="1" stop-color="#7ef3ff"/></radialGradient>
    <radialGradient id="g-halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffe9a0" stop-opacity="0.9"/><stop offset="1" stop-color="#ffd34d" stop-opacity="0"/></radialGradient>
    <linearGradient id="g-metal" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f7f8"/><stop offset="1" stop-color="#a9b6bb"/></linearGradient>
    <linearGradient id="g-glove" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfd9dc"/></linearGradient>
    <linearGradient id="g-eraser" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc2cf"/><stop offset="1" stop-color="#e8809a"/></linearGradient>
    <linearGradient id="g-card" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf5"/><stop offset="1" stop-color="#efe9d5"/></linearGradient>
    <linearGradient id="g-note" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff9d6"/><stop offset="1" stop-color="#f4e7a8"/></linearGradient>
    <linearGradient id="g-button" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#f0b429"/></linearGradient>
    <linearGradient id="g-button-down" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0b429"/><stop offset="1" stop-color="#d99a14"/></linearGradient>
    <linearGradient id="g-button-teal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fded7"/><stop offset="1" stop-color="#4aa39d"/></linearGradient>
    <filter id="f-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="f-soft-sm" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>
  </defs>`;
}

// ---------- the desk (backdrop and decoration) ----------
// A wood desk with planks and grain, light from the window top right, a soft dark edge. w, h: the frame.
export function desk(w, h) {
  const X0 = -w; const Y0 = -h; const W = w * 3; const H = h * 3; // the bleed reaches past the frame
  const planks = [];
  const plankH = 150;
  for (let y = Math.floor(Y0 / plankH) * plankH; y < h + h; y += plankH) {
    planks.push(`<path d="M${X0} ${y}H${X0 + W}" stroke="#5e3a1b" stroke-opacity="0.45" stroke-width="3" fill="none"/>`);
    planks.push(`<path d="M${X0} ${y + 3}H${X0 + W}" stroke="#efc08f" stroke-opacity="0.35" stroke-width="2" fill="none"/>`);
    const off = ((y / plankH) % 2 === 0 ? 0.31 : 0.67) * w;
    planks.push(`<path d="M${n1(off)} ${y}v${plankH}" stroke="#5e3a1b" stroke-opacity="0.4" stroke-width="3" fill="none"/>`);
  }
  return `<rect x="${X0}" y="${Y0}" width="${W}" height="${H}" fill="url(#g-wood)"/>
    <rect x="${X0}" y="${Y0}" width="${W}" height="${H}" fill="url(#p-grain)"/>
    ${planks.join('\n    ')}
    <rect x="${X0}" y="${Y0}" width="${W}" height="${H}" fill="url(#g-window)"/>
    <rect x="${X0}" y="${Y0}" width="${W}" height="${H}" fill="url(#g-vignette)"/>`;
}

// ---------- Bolt ----------
// Drawn in the stage's space; (HEAD.x, HEAD.y) is the middle of the head.
const MOODS = ['idle', 'thinking', 'happy', 'dizzy', 'shrug', 'sleepy', 'determined'];
export { MOODS };

export function eyes(mood) {
  const L = [HEAD.x - 22, HEAD.y - 8]; const R = [HEAD.x + 22, HEAD.y - 8];
  const eye = (x, y, rx, ry) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#g-eye)"/><circle cx="${x + 3}" cy="${y - ry * 0.35}" r="${n1(rx * 0.28)}" fill="#ffffff"/>`;
  const arc = (x, y, up) => `<path d="M${x - 11} ${y + (up ? 6 : -4)}Q${x} ${y + (up ? -12 : 12)} ${x + 11} ${y + (up ? 6 : -4)}" fill="none" stroke="${C.cyan}" stroke-width="5" stroke-linecap="round"/>`;
  switch (mood) {
    case 'idle': return eye(...L, 10, 12) + eye(...R, 10, 12);
    case 'thinking': return eye(L[0] + 3, L[1] - 3, 9, 8) + eye(R[0] + 3, R[1] - 3, 9, 8)
      + `<path d="M${L[0] - 10} ${L[1] - 18}l16 -5" stroke="${C.cyan}" stroke-width="3.5" stroke-linecap="round" fill="none"/><path d="M${R[0] - 6} ${R[1] - 20}l16 4" stroke="${C.cyan}" stroke-width="3.5" stroke-linecap="round" fill="none"/>`;
    case 'happy': return arc(L[0], L[1], true) + arc(R[0], R[1], true);
    case 'dizzy': {
      const sp = (x, y) => `<path d="M${x} ${y}m0 -2a2 2 0 1 1 -2 2a5 5 0 1 1 5 5a8 8 0 1 1 -8 -8a11 11 0 1 1 11 11" fill="none" stroke="${C.cyan}" stroke-width="3" stroke-linecap="round"/>`;
      return sp(L[0] + 1, L[1]) + sp(R[0] + 1, R[1]);
    }
    case 'sleepy': return arc(L[0], L[1] + 2, false) + arc(R[0], R[1] + 2, false)
      + `<path d="M${L[0] - 12} ${L[1] - 10}l-6 -6M${R[0] + 12} ${R[1] - 10}l6 -6" stroke="${C.cyan}" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.7"/>`;
    case 'determined': return `<path d="M${L[0] - 11} ${L[1] - 8}h22v10a11 10 0 0 1 -22 0z" fill="url(#g-eye)"/><path d="M${R[0] - 11} ${R[1] - 8}h22v10a11 10 0 0 1 -22 0z" fill="url(#g-eye)"/>`
      + `<path d="M${L[0] - 14} ${L[1] - 18}l26 8" stroke="${C.cyan}" stroke-width="4.5" stroke-linecap="round" fill="none"/><path d="M${R[0] + 14} ${R[1] - 18}l-26 8" stroke="${C.cyan}" stroke-width="4.5" stroke-linecap="round" fill="none"/>`;
    case 'shrug': return eye(L[0], L[1] - 3, 10, 13) + `<path d="M${R[0] - 11} ${R[1] + 2}h22" stroke="${C.cyan}" stroke-width="5" stroke-linecap="round" fill="none"/>`
      + `<path d="M${L[0] - 12} ${L[1] - 24}q12 -8 24 0" stroke="${C.cyan}" stroke-width="3.5" stroke-linecap="round" fill="none"/>`;
    default: return '';
  }
}
export function mouth(mood) {
  const x = HEAD.x; const y = HEAD.y + 24;
  const st = `fill="none" stroke="${C.cyan}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"`;
  switch (mood) {
    case 'idle': return `<path d="M${x - 14} ${y}Q${x} ${y + 9} ${x + 14} ${y}" ${st}/>`;
    case 'thinking': return `<path d="M${x - 10} ${y + 2}h20" ${st}/>`;
    case 'happy': return `<path d="M${x - 18} ${y - 4}Q${x} ${y + 20} ${x + 18} ${y - 4}z" fill="${C.cyan}" stroke="${C.cyan}" stroke-width="3" stroke-linejoin="round"/><path d="M${x - 9} ${y + 6}Q${x} ${y + 12} ${x + 9} ${y + 6}" fill="none" stroke="#10242c" stroke-width="3" stroke-linecap="round"/>`;
    case 'dizzy': return `<path d="M${x - 18} ${y + 2}l6 -6l6 8l6 -8l6 8l6 -8l6 6" ${st}/>`;
    case 'sleepy': return `<ellipse cx="${x}" cy="${y + 3}" rx="6" ry="7" ${st}/>`;
    case 'determined': return `<path d="M${x - 15} ${y + 3}h30" ${st}/><path d="M${x - 15} ${y + 3}v-4M${x + 15} ${y + 3}v-4" fill="none" stroke="${C.cyan}" stroke-width="3.5" stroke-linecap="round"/>`;
    case 'shrug': return `<path d="M${x - 16} ${y + 4}q8 -8 16 0q8 8 16 0" ${st}/>`;
    default: return '';
  }
}

// Bolt's body parts. `armSocket`: the stage draws the arm in its own layer; here only the shoulder pads.
export function bolt({ withBulb = true, dots = true } = {}) {
  const hx = HEAD.x; const hy = HEAD.y; const hw = HEAD.w; const hh = HEAD.h;
  const top = hy - hh / 2; const left = hx - hw / 2;
  const looks = (fn) => MOODS.map((m, i) => `<g data-hsvg-variant="${m}"${i ? ' display="none"' : ''}>${fn(m)}</g>`).join('\n          ');
  const torsoTop = 170; const torsoH = 190;
  return `
      <g id="bolt" data-hsvg-kind="part" data-hsvg-pivot="${hx} 360" data-hsvg-motion="move-y -16..4">
        <ellipse cx="${hx - 26}" cy="372" rx="132" ry="16" fill="#3d2410" opacity="0.38" filter="url(#f-soft)"/>
        <rect x="${hx - 38}" y="342" width="76" height="28" rx="10" fill="#2c6a67"/>
        <rect x="${hx - 70}" y="354" width="140" height="26" rx="13" fill="#24605d"/>
        <path d="M${hx - 70} 360a13 13 0 0 1 13 -6h114a13 13 0 0 1 13 6" fill="none" stroke="#9fe6df" stroke-width="2.5" opacity="0.8"/>
        <g id="bolt-torso" data-hsvg-kind="part">
          <rect x="${hx - 100}" y="${torsoTop}" width="200" height="${torsoH}" rx="40" fill="url(#g-teal)" stroke="${C.tealLine}" stroke-width="3.5"/>
          <path d="M${hx - 82} ${torsoTop + 16}a30 30 0 0 1 30 -10h104" fill="none" stroke="#e8fffb" stroke-width="5" stroke-linecap="round" opacity="0.65"/>
          <rect x="${hx - 100}" y="${torsoTop + 118}" width="200" height="6" fill="#24605d" opacity="0.45"/>
          <circle cx="${hx - 70}" cy="${torsoTop + 150}" r="5" fill="#d9fbf7" stroke="${C.tealLine}" stroke-width="2"/><circle cx="${hx + 70}" cy="${torsoTop + 150}" r="5" fill="#d9fbf7" stroke="${C.tealLine}" stroke-width="2"/>
          <g id="bolt-chest" data-hsvg-kind="part" data-hsvg-pivot="${hx} ${torsoTop + 50}" data-hsvg-motion="scale 1..1.06">
            <rect x="${hx - 52}" y="${torsoTop + 22}" width="104" height="58" rx="16" fill="#1b4a52" stroke="${C.tealLine}" stroke-width="3"/>
            <rect x="${hx - 46}" y="${torsoTop + 28}" width="92" height="20" rx="9" fill="#2a6a72" opacity="0.8"/>
            <circle cx="${hx - 28}" cy="${torsoTop + 58}" r="7" fill="#ffd34d"/><circle cx="${hx - 28}" cy="${torsoTop + 56}" r="2.6" fill="#fff6cf"/>
            <circle cx="${hx}" cy="${torsoTop + 58}" r="7" fill="#7ef3ff"/><circle cx="${hx}" cy="${torsoTop + 56}" r="2.6" fill="#ffffff"/>
            <circle cx="${hx + 28}" cy="${torsoTop + 58}" r="7" fill="#ef7d2d"/><circle cx="${hx + 28}" cy="${torsoTop + 56}" r="2.6" fill="#ffe8cf"/>
          </g>
        </g>
        <path d="M${hx + 70} ${torsoTop + 20}v120" stroke="#2f716d" stroke-width="3" opacity="0.5"/>
        <rect x="${hx - 22}" y="${top + hh - 6}" width="44" height="30" rx="8" fill="#2f716d" stroke="${C.tealLine}" stroke-width="3"/>
        <path d="M${hx - 22} ${top + hh + 6}h44M${hx - 22} ${top + hh + 14}h44" stroke="#1b4a52" stroke-width="2" opacity="0.7"/>
        <g id="bolt-shoulder-r" data-hsvg-kind="part">
          <rect x="${hx + 84}" y="${SHOULDER[1] - 12}" width="28" height="120" rx="14" fill="url(#g-tube-v)" stroke="${C.tealLine}" stroke-width="3"/>
          <circle cx="${hx + 98}" cy="${SHOULDER[1]}" r="30" fill="url(#g-teal)" stroke="${C.tealLine}" stroke-width="3.5"/>
          <circle cx="${hx + 98}" cy="${SHOULDER[1]}" r="11" fill="url(#g-metal)" stroke="${C.tealLine}" stroke-width="2.5"/>
        </g>
        <g id="bolt-head" data-hsvg-kind="part" data-hsvg-pivot="${hx} ${top + hh + 8}" data-hsvg-motion="rotate -14..14">
          <g id="bolt-head-bob" data-hsvg-kind="part" data-hsvg-pivot="${hx} ${top + hh + 8}" data-hsvg-motion="rotate -12..12; move-y -10..0">
            ${withBulb ? `<path d="M${hx} ${top}V${top - 18}" stroke="${C.tealLine}" stroke-width="4" stroke-linecap="round"/>
            <g id="bolt-bulb" data-hsvg-kind="part" data-hsvg-pivot="${hx} ${top - 24}" data-hsvg-motion="scale 1..1.25; opacity 0.55..1">
              <circle cx="${hx}" cy="${top - 24}" r="22" fill="url(#g-halo)"/>
              <circle cx="${hx}" cy="${top - 24}" r="9" fill="#ffd34d" stroke="${C.tealLine}" stroke-width="3"/>
              <circle cx="${hx - 2}" cy="${top - 27}" r="3" fill="#fffbe0"/>
            </g>` : ''}
            <rect x="${left - 12}" y="${hy - 22}" width="14" height="44" rx="7" fill="#2f716d" stroke="${C.tealLine}" stroke-width="3"/>
            <rect x="${left + hw - 2}" y="${hy - 22}" width="14" height="44" rx="7" fill="url(#g-teal)" stroke="${C.tealLine}" stroke-width="3"/>
            <rect x="${left}" y="${top}" width="${hw}" height="${hh}" rx="36" fill="url(#g-teal)" stroke="${C.tealLine}" stroke-width="3.5"/>
            <path d="M${left + 20} ${top + 18}a22 22 0 0 1 22 -9h62" fill="none" stroke="#e8fffb" stroke-width="5" stroke-linecap="round" opacity="0.7"/>
            <rect x="${hx - 58}" y="${hy - 44}" width="116" height="84" rx="24" fill="url(#g-screen)" stroke="#0a171c" stroke-width="3"/>
            <path d="M${hx - 48} ${hy - 30}q30 -14 80 -6l-6 16q-34 -8 -68 4z" fill="#ffffff" opacity="0.1"/>
            <g id="bolt-eyes" data-hsvg-kind="part" data-hsvg-pivot="${hx} ${hy - 8}" data-hsvg-motion="move-x -6..6; move-y -5..5; scale-y 0.05..1">
          ${looks(eyes)}
            </g>
            <g id="bolt-mouth" data-hsvg-kind="part">
          ${looks(mouth)}
            </g>
            ${dots ? `            <g id="bolt-dots" data-hsvg-kind="part" data-hsvg-motion="opacity 0..1">
              <circle id="bolt-dot-1" data-hsvg-kind="part" data-hsvg-motion="opacity 0.25..1" cx="${hx + 38}" cy="${hy + 26}" r="3.4" fill="${C.cyan}"/>
              <circle id="bolt-dot-2" data-hsvg-kind="part" data-hsvg-motion="opacity 0.25..1" cx="${hx + 48}" cy="${hy + 26}" r="3.4" fill="${C.cyan}"/>
              <circle id="bolt-dot-3" data-hsvg-kind="part" data-hsvg-motion="opacity 0.25..1" cx="${hx + 58}" cy="${hy + 26}" r="3.4" fill="${C.cyan}"/>
            </g>`: ''}
          </g>
        </g>
        <g id="bolt-shoulder-l" data-hsvg-kind="part">
          <circle cx="${SHOULDER[0]}" cy="${SHOULDER[1]}" r="31" fill="url(#g-teal)" stroke="${C.tealLine}" stroke-width="3.5"/>
          <path d="M${SHOULDER[0] - 14} ${SHOULDER[1] - 20}a24 24 0 0 1 30 -4" fill="none" stroke="#e8fffb" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
        </g>
      </g>`;
}

// Bolt's arm is a telescoping tube. It hangs straight down at angle 0. `arm` turns about the shoulder; the tube is
// four strokes that draw out from the shoulder (the `draw` channel); the collars slide with it; and the hand with its
// pen slides out along the arm. The hand is painted last, above everything, and follows `arm`.
export function arm() {
  const [sx, sy] = SHOULDER; const wy = sy + WRIST0;
  const stroke = (id, w, colour, dx = 0, op = 1) => `<path id="${id}" data-hsvg-kind="part" data-hsvg-motion="draw 0..1" pathLength="1" d="M${sx + dx} ${sy}V${sy + TUBE_MAX}" fill="none" stroke="${colour}" stroke-width="${w}" stroke-linecap="round"${op < 1 ? ` stroke-opacity="${op}"` : ''}/>`;
  const ring = (k) => `<g id="arm-ring-${k}" data-hsvg-kind="part" data-hsvg-motion="move-y 0..${TUBE_MAX}">
          <rect x="${sx - 20}" y="${sy - 6}" width="40" height="12" rx="5" fill="url(#g-metal)" stroke="${C.tealLine}" stroke-width="3"/>
          <path d="M${sx - 12} ${sy - 2}h14" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.8"/>
        </g>`;
  return `
      <g id="arm" data-hsvg-kind="part" data-hsvg-pivot="${sx} ${sy}" data-hsvg-motion="rotate -120..120; move-y -16..4" pointer-events="none">
        ${stroke('arm-tube-edge', 32, C.tealLine)}
        ${stroke('arm-tube', 25, C.teal)}
        ${stroke('arm-tube-shade', 8, '#2f716d', -8, 0.75)}
        ${stroke('arm-tube-shine', 5, '#e8fffb', 6, 0.8)}
        ${[1, 2, 3, 4].map(ring).join('\n        ')}
        <circle cx="${sx}" cy="${sy}" r="18" fill="url(#g-metal)" stroke="${C.tealLine}" stroke-width="3.5"/>
        <circle cx="${sx}" cy="${sy}" r="6.5" fill="#7ea0a8" stroke="${C.tealLine}" stroke-width="2"/>
      </g>
      <g id="arm-hand" data-hsvg-kind="part" data-hsvg-follow="arm" data-hsvg-pivot="${sx} ${wy + PEN}" data-hsvg-motion="move-y 0..${TUBE_MAX}; rotate -14..14" pointer-events="none">
        <ellipse cx="${sx - 7}" cy="${wy + PEN + 4}" rx="10" ry="6" fill="#3d2410" opacity="0.28" filter="url(#f-soft-sm)"/>
        <path d="M${sx - 4.5} ${wy + 6}l-1 ${PEN - 6}l5.5 5l5.5 -5l-1 -${PEN - 6}z" fill="#f1c27d" stroke="${C.ink}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M${sx - 1.6} ${wy + PEN - 1}l1.6 4.4l1.6 -4.4z" fill="${C.ink}"/>
        <rect x="${sx - 6.5}" y="${wy + 2}" width="13" height="14" rx="3" fill="#ef7d2d" stroke="${C.ink}" stroke-width="2"/>
        <path d="M${sx - 20} ${wy - 8}a20 18 0 0 1 40 0v9a20 18 0 0 1 -40 0z" fill="url(#g-glove)" stroke="${C.tealLine}" stroke-width="3"/>
        <path d="M${sx - 14} ${wy - 5}a5 4 0 0 1 8 -2M${sx - 3} ${wy - 7}a5 4 0 0 1 8 0M${sx + 8} ${wy - 5}a5 4 0 0 1 8 2" fill="none" stroke="#9fb0b5" stroke-width="2" stroke-linecap="round"/>
        <path d="M${sx - 13} ${wy - 14}a14 10 0 0 1 20 -3" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.9"/>
      </g>`;
}

// ---------- the paper ----------
// jittered hand-drawn marks, one per cell: a cross in blue ink, a nought in orange ink.
export function xPath(i) {
  const r = rng(101 + i * 17); const [cx, cy] = cellCentre(i); const a = 31 * K;
  const j = () => (r() - 0.5) * 5;
  const p = (x, y) => `${n1(cx + x + j())} ${n1(cy + y + j())}`;
  return `M${p(-a, -a + 2)}C${p(-8, -10)} ${p(8, 8)} ${p(a, a)}M${p(a - 2, -a)}C${p(8, -10)} ${p(-8, 8)} ${p(-a + 2, a - 1)}`;
}
export function oPath(i) {
  // A hand-drawn nought: a slightly wobbly ring, started at the top, round anticlockwise, overshooting a little.
  const r = rng(303 + i * 29); const [cx, cy] = cellCentre(i); const R = 30 * K;
  const phase = r() * 6.28; const amp = 1.6 + r();
  const pts = [];
  const start = -95; const end = start - 372; const steps = 20;
  for (let k = 0; k <= steps; k++) {
    const t = (start + (end - start) * (k / steps)) * Math.PI / 180;
    const rr = R + amp * Math.sin(2 * t + phase) + (k / steps) * 3.2 * K;
    pts.push([cx + Math.cos(t) * rr * 1.02, cy + Math.sin(t) * rr * 1.06]);
  }
  // Catmull-Rom to cubic bezier
  let d = `M${n1(pts[0][0])} ${n1(pts[0][1])}`;
  for (let k = 0; k < pts.length - 1; k++) {
    const p0 = pts[Math.max(0, k - 1)]; const p1 = pts[k]; const p2 = pts[k + 1]; const p3 = pts[Math.min(pts.length - 1, k + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${n1(c1[0])} ${n1(c1[1])} ${n1(c2[0])} ${n1(c2[1])} ${n1(p2[0])} ${n1(p2[1])}`;
  }
  return d;
}

export const LINES = [
  ['row1', 0, 1, 2], ['row2', 3, 4, 5], ['row3', 6, 7, 8], ['col1', 0, 3, 6], ['col2', 1, 4, 7], ['col3', 2, 5, 8],
  ['diag1', 0, 4, 8], ['diag2', 2, 4, 6],
];
function winPath(a, c) {
  const [x1, y1] = cellCentre(a); const [x2, y2] = cellCentre(c);
  const dx = x2 - x1; const dy = y2 - y1; const len = Math.hypot(dx, dy); const e = 34 * K / len;
  const j = (k) => ((a * 7 + c * 3 + k) % 5 - 2) * 1.2;
  return `M${n1(x1 - dx * e)} ${n1(y1 - dy * e + j(1))}L${n1(x2 + dx * e)} ${n1(y2 + dy * e + j(2))}`;
}

export function paper() {
  const g = GRID; const s = SHEET; const gs = CELL * 3;
  const gridLines = [
    ['grid-1', `M${g.x + CELL} ${g.y - 6}L${g.x + CELL + 1.5} ${g.y + gs + 5}`],
    ['grid-2', `M${g.x + CELL * 2} ${g.y + gs + 6}L${g.x + CELL * 2 - 1.5} ${g.y - 5}`],
    ['grid-3', `M${g.x - 6} ${g.y + CELL + 1}L${g.x + gs + 5} ${g.y + CELL - 1}`],
    ['grid-4', `M${g.x + gs + 6} ${g.y + CELL * 2 - 1}L${g.x - 5} ${g.y + CELL * 2 + 1.5}`],
  ].map(([id, d]) => `<path id="${id}" data-hsvg-kind="part" data-hsvg-motion="draw 0..1" pathLength="1" d="${d}" fill="none" stroke="${C.graphite}" stroke-width="5" stroke-linecap="round"/>`).join('\n          ');
  const cells = [];
  for (let i = 0; i < 9; i++) {
    const [cx, cy] = cellCentre(i); const x = cx - CELL / 2; const y = cy - CELL / 2;
    cells.push(`<g id="cell-${i}" data-hsvg-kind="part" data-hsvg-role="action">
            <g data-hsvg-variant="idle"><rect x="${x + 4}" y="${y + 4}" width="${CELL - 8}" height="${CELL - 8}" rx="14" fill="#ffffff" fill-opacity="0.01"/></g>
            <g data-hsvg-variant="hover" display="none"><rect x="${x + 4}" y="${y + 4}" width="${CELL - 8}" height="${CELL - 8}" rx="14" fill="${C.gold}" fill-opacity="0.28"/></g>
            <g data-hsvg-variant="pressed" display="none"><rect x="${x + 6}" y="${y + 6}" width="${CELL - 12}" height="${CELL - 12}" rx="14" fill="${C.gold}" fill-opacity="0.5" stroke="#b98a14" stroke-width="2.5" stroke-dasharray="6 5"/></g>
            <g data-hsvg-variant="focus" display="none"><rect x="${x + 5}" y="${y + 5}" width="${CELL - 10}" height="${CELL - 10}" rx="14" fill="${C.gold}" fill-opacity="0.2" stroke="${C.x}" stroke-width="3.5" stroke-dasharray="9 6" stroke-linecap="round"/></g>
            <g data-hsvg-variant="disabled" display="none"><rect x="${x + 4}" y="${y + 4}" width="${CELL - 8}" height="${CELL - 8}" rx="14" fill="#ffffff" fill-opacity="0.01"/></g>
          </g>`);
  }
  const marks = []; const winlines = [];
  for (let i = 0; i < 9; i++) {
    marks.push(`<path id="x-${i}" data-hsvg-kind="part" data-hsvg-motion="draw 0..1" pathLength="1" d="${xPath(i)}" fill="none" stroke="${C.x}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`);
    marks.push(`<path id="o-${i}" data-hsvg-kind="part" data-hsvg-motion="draw 0..1" pathLength="1" d="${oPath(i)}" fill="none" stroke="${C.o}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  for (const [id, a, b, c] of LINES) {
    winlines.push(`<path id="win-${id}" data-hsvg-kind="part" data-hsvg-motion="draw 0..1" pathLength="1" d="${winPath(a, c)}" fill="none" stroke="${C.raspberry}" stroke-width="9" stroke-linecap="round"/>`);
  }
  // blue rules over the whole sheet; a red margin line down the left
  return `
      <g id="board" data-hsvg-kind="part" data-hsvg-motion="move-x -12..12">
        <g id="paper-halo" data-hsvg-kind="part" data-hsvg-motion="opacity 0..1" pointer-events="none">
          <rect x="${s.x - 16}" y="${s.y - 16}" width="${s.w + 32}" height="${s.h + 32}" rx="22" fill="none" stroke="${C.gold}" stroke-width="26" stroke-opacity="0.32"/>
          <rect x="${s.x - 9}" y="${s.y - 9}" width="${s.w + 18}" height="${s.h + 18}" rx="15" fill="none" stroke="#ffe27a" stroke-width="12" stroke-opacity="0.75"/>
        </g>
        <rect x="${s.x - 6}" y="${s.y + 6}" width="${s.w + 8}" height="${s.h + 6}" rx="6" fill="#3d2410" opacity="0.35" filter="url(#f-soft)"/>
        <rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="5" fill="url(#g-paper)" stroke="#d8d3c0" stroke-width="2"/>
        <rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="5" fill="url(#p-squares)"/>
        <path d="M${s.x + 26} ${s.y}V${s.y + s.h}" stroke="${C.margin}" stroke-width="2.5" opacity="0.8"/>
        <path d="M${s.x + s.w - 4} ${s.y + 14}v${s.h - 30}" stroke="#e8e3d0" stroke-width="3" opacity="0.8"/>
        <g fill="#c9c3ac" opacity="0.8"><circle cx="${s.x + 12}" cy="${s.y + 60}" r="5"/><circle cx="${s.x + 12}" cy="${s.y + s.h / 2}" r="5"/><circle cx="${s.x + 12}" cy="${s.y + s.h - 60}" r="5"/></g>
        <g id="grid" data-hsvg-kind="part">
          ${gridLines}
        </g>
        <g id="marks" data-hsvg-kind="part" data-hsvg-motion="opacity 0..1">
          ${marks.join('\n          ')}
          ${winlines.join('\n          ')}
        </g>
        <g id="cells" data-hsvg-kind="part">
          ${cells.join('\n          ')}
        </g>
      </g>`;
}

// ---------- the desk things: pencil and eraser ----------
export function pencil() {
  // Lying at the right of the paper, slightly slanted. A static group (not a part).
  return `<g transform="translate(512 340) rotate(-8)">
        <ellipse cx="-12" cy="112" rx="14" ry="110" fill="#3d2410" opacity="0.3" filter="url(#f-soft-sm)"/>
        <rect x="-11" y="0" width="22" height="190" rx="3" fill="#f2b632" stroke="#8a5a0a" stroke-width="2.5"/>
        <rect x="-11" y="0" width="7" height="190" rx="2" fill="#ffe27a" opacity="0.8"/>
        <path d="M-11 190l11 36l11 -36z" fill="#f1c27d" stroke="#8a5a0a" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M-4 212l4 14l4 -14z" fill="${C.graphite}"/>
        <rect x="-11" y="-14" width="22" height="14" rx="3" fill="#c9ced1" stroke="#7b8488" stroke-width="2.5"/>
        <rect x="-11" y="-30" width="22" height="18" rx="6" fill="url(#g-eraser)" stroke="#a14a63" stroke-width="2.5"/>
      </g>`;
}
export function eraser() {
  const ex = 536; const ey = 604;
  return `
      <g id="eraser" data-hsvg-kind="part" data-hsvg-pivot="${ex} ${ey}">
        <ellipse cx="${ex - 6}" cy="${ey + 14}" rx="30" ry="9" fill="#3d2410" opacity="0.32" filter="url(#f-soft-sm)"/>
        <rect x="${ex - 28}" y="${ey - 15}" width="56" height="30" rx="8" fill="url(#g-eraser)" stroke="#a14a63" stroke-width="3"/>
        <rect x="${ex - 28}" y="${ey - 15}" width="22" height="30" rx="8" fill="#4a7fd1" stroke="#2c4f8a" stroke-width="3"/>
        <path d="M${ex - 8} ${ey - 8}h28" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
      </g>`;
}
export const eraserRoute = () => `<path id="eraser-route" data-hsvg-kind="part" data-hsvg-route="track" d="M536 604C500 590 486 420 440 372L176 372L440 420L176 468L440 516L176 564L440 596C480 612 520 612 536 604" fill="none" stroke="none"/>`;

// A mug and a sticky note, to fill the left of the desk. Static drawings, in stage space.
export function props() {
  return `<g transform="translate(24 380) rotate(-6)">
        <rect x="6" y="8" width="84" height="64" rx="4" fill="#3d2410" opacity="0.3" filter="url(#f-soft-sm)"/>
        <rect x="0" y="0" width="84" height="64" rx="3" fill="url(#g-note)" stroke="#a8903a" stroke-width="3"/>
        <path d="M12 20h56M12 34h42M12 48h50" stroke="#b9a35a" stroke-width="3" stroke-linecap="round" fill="none"/>
        <rect x="26" y="-8" width="32" height="14" rx="3" fill="#ffffff" opacity="0.5"/>
      </g>
      <g transform="translate(70 560)">
        <ellipse cx="-4" cy="46" rx="48" ry="12" fill="#3d2410" opacity="0.34" filter="url(#f-soft-sm)"/>
        <path d="M32 -16c26 -4 30 38 2 40" fill="none" stroke="#a14a63" stroke-width="9" stroke-linecap="round"/>
        <path d="M-34 -28h66v52a33 22 0 0 1 -66 0z" fill="#e8809a" stroke="#a14a63" stroke-width="3.5" stroke-linejoin="round"/>
        <ellipse cx="-1" cy="-28" rx="33" ry="9" fill="#5a3418" stroke="#a14a63" stroke-width="3.5"/>
        <path d="M-26 -14v34" stroke="#ffe3ea" stroke-width="5" stroke-linecap="round" opacity="0.7"/>
        <path d="M-12 -44q-6 -8 0 -16M6 -44q-6 -8 0 -16" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
      </g>`;
}

export { STAGE };
