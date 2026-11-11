// A shell whose stage slot follows two values (6.8 size, 5.10, D1), for the stage browser run and the fast tests.
// - The stage slot is a <rect> sized by [w, h] about its top-left corner. Two slider handles write w and h: drag the
//   right handle to change the width and the bottom handle to change the height. The turn button swaps them
//   (landscape and portrait).
// - Scene ad is the layout fixture's ad (four exact sizes); scene harbour has wide and tall layouts.
// - The theme and the language are picked by input (7.1): the colour and language options write experience values.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ad = path.resolve(here, '..', '..', 'layout-fixture', 'scenes', 'ad');
const adFiles = Object.fromEntries(fs.readdirSync(ad).map(f => [`scenes/ad/${f}`, fs.readFileSync(path.join(ad, f), 'utf8')]));

const button = (id, x, y, fill) => `<g id="${id}" data-hsvg-kind="part"><rect x="${x}" y="${y}" width="50" height="50" rx="6" fill="${fill}"/></g>`;
const shellSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 800" data-hsvg-version="2.0" data-hsvg-kind="screen">
<title>Stage</title>
<rect id="backdrop" width="1000" height="800" fill="#fff4d8" data-hsvg-layer="backdrop" data-hsvg-color="surface"/>
<rect id="stage-box" data-hsvg-kind="part" data-hsvg-slot="stage" x="20" y="20" width="300" height="250" fill="none"/>
<g id="width-handle" data-hsvg-kind="part" data-hsvg-motion="move-x -250..600"><rect x="310" y="120" width="20" height="50" rx="4" fill="#153b4b"/></g>
<g id="height-handle" data-hsvg-kind="part" data-hsvg-motion="move-y -200..510"><rect x="140" y="260" width="50" height="20" rx="4" fill="#153b4b"/></g>
${button('turn-btn', 940, 20, '#e6af42')}
${button('next-btn', 940, 90, '#0f6f72')}
${button('day-btn', 940, 160, '#fff4d8')}
${button('night-btn', 940, 230, '#10212b')}
${button('en-btn', 940, 300, '#9cf')}
${button('de-btn', 940, 370, '#fc6')}
<text id="greeting" data-hsvg-kind="part" x="940" y="460" font-family="sans-serif" font-size="16" fill="#153b4b">Hello</text>
</svg>`;
const harbourSvg = (w, h, label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" data-hsvg-version="2.0" data-hsvg-kind="screen">
<title>Harbour</title>
<rect width="${w}" height="${h}" fill="#cde" data-hsvg-layer="backdrop"/>
<text id="label" data-hsvg-kind="part" x="10" y="30" font-family="sans-serif" font-size="20" fill="#153b4b">${label}</text>
<g id="button" data-hsvg-kind="part"><rect x="10" y="${h - 60}" width="60" height="50" rx="4" fill="#e6af42"/></g>
<text id="count" data-hsvg-kind="part" x="90" y="${h - 25}" font-family="sans-serif" font-size="20" fill="#153b4b">0</text>
</svg>`;

export const files = {
  'experience.json': {
    format: 'hsvg/2.0', kind: 'experience', id: 'stage-run', language: 'en', shell: 'shell/frame.json',
    about: { title: 'Stage fixture: a resizable stage' },
    axes: [
      { axis: 'shape', select: 'space', shapes: { wide: { minAspect: 1 }, tall: { maxAspect: 1 } } },
      { axis: 'theme', select: 'input', value: 'colourway', options: ['day', 'night'] },
      { axis: 'language', select: 'input', value: 'lang', options: { en: {}, de: {} } },
    ],
    theme: 'day',
    themes: {
      day: { colorRoles: { surface: '#fff4d8', ink: '#153b4b' } },
      night: { colorRoles: { surface: '#10212b', ink: '#fff4d8' } },
    },
    values: {
      colourway: { type: 'string', enum: ['day', 'night'], maxLength: 8, initial: 'day' },
      lang: { type: 'string', enum: ['en', 'de'], maxLength: 8, initial: 'en' },
    },
    resources: {
      'words-en': { kind: 'words', file: 'words/en.csv', language: 'en', digest: `sha256:${'1'.padStart(64, '0')}` },
      'words-de': { kind: 'words', file: 'words/de.csv', language: 'de', digest: `sha256:${'2'.padStart(64, '0')}` },
    },
    story: { start: 'ad', scenes: { ad: 'scenes/ad/scene.json', harbour: 'scenes/harbour/scene.json' }, ends: ['harbour'],
      links: [{ id: 'to-harbour', from: 'frame', on: 'next', to: 'harbour' }] },
  },
  'words/en.csv': 'id,text\nhello,Hello\n',
  'words/de.csv': 'id,text\nhello,Hallo\n',
  'shell/frame.json': {
    format: 'hsvg/2.0', kind: 'shell', id: 'frame', drawing: 'frame.svg',
    slots: { stage: { kind: 'stage', label: 'Stage' } },
    values: {
      w: { type: 'number', initial: 300, minimum: 50, maximum: 900 },
      h: { type: 'number', initial: 250, minimum: 50, maximum: 760 },
      tmp: { type: 'number', initial: 0, minimum: 0, maximum: 900 },
    },
    controls: {
      width: { kind: 'slider', target: 'width-handle', value: 'w', axis: 'x', range: [-250, 600], label: 'Stage width' },
      height: { kind: 'slider', target: 'height-handle', value: 'h', axis: 'y', range: [-200, 510], label: 'Stage height' },
      turn: { kind: 'button', target: 'turn-btn', event: 'turn', label: 'Turn: landscape or portrait' },
      next: { kind: 'button', target: 'next-btn', event: 'next', label: 'Next scene' },
      colour: { kind: 'choice', value: 'colourway', label: 'Colours', options: {
        day: { target: 'day-btn', value: "'day'", label: 'Day' }, night: { target: 'night-btn', value: "'night'", label: 'Night' } } },
      lang: { kind: 'choice', value: 'lang', label: 'Language', options: {
        en: { target: 'en-btn', value: "'en'", label: 'English' }, de: { target: 'de-btn', value: "'de'", label: 'Deutsch' } } },
    },
    outputs: { next: { kind: 'event' } },
    on: { turn: [{ id: 'swap', actions: [{ id: 'keep-w', set: 'tmp', to: 'w' }, { id: 'w-is-h', set: 'w', to: 'h' }, { id: 'h-is-w', set: 'h', to: 'tmp' }] }] },
    bindings: [
      { id: 'stage-size', target: 'stage-box', as:'box', scale: '[w, h]', anchor: ['start', 'start'] },
      { id: 'width-at', target: 'width-handle', axis: 'x', move: 'w - 300' },
      { id: 'height-at', target: 'height-handle', axis: 'y', move: 'h - 250' },
      { id: 'greeting-text', target: 'greeting', text: '{{ words.hello }}' },
    ],
  },
  'shell/frame.svg': shellSvg,
  ...adFiles,
  'scenes/harbour/scene.json': {
    format: 'hsvg/2.0', kind: 'scene', id: 'harbour', about: { title: 'Harbour' },
    layouts: [{ id: 'wide', shape: 'wide', drawing: 'harbour-wide.svg' }, { id: 'tall', shape: 'tall', drawing: 'harbour-tall.svg' }],
    values: { taps: { type: 'number', initial: 0, minimum: 0, maximum: 1000 } },
    controls: { tap: { kind: 'button', target: 'button', label: 'Tap' } },
    on: { 'press:button': [{ id: 'count', actions: [{ id: 'add', set: 'taps', to: 'taps + 1' }] }] },
    bindings: [{ id: 'count-text', target: 'count', text: '{{ taps }}' }],
  },
  'scenes/harbour/harbour-wide.svg': harbourSvg(320, 180, 'wide'),
  'scenes/harbour/harbour-tall.svg': harbourSvg(180, 320, 'tall'),
};
// Every file as text, as a source reads them.
export const texts = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
