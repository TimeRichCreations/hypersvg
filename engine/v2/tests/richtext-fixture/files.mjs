// Rich text (6.8.1, 5.3.1, 7.7): an ad whose headline is one richText field, "RAIN?" (an accent run), a
// line break, then "Bring it on." (strong) It flows across two linked text parts in the tall and square frames and fits in
// one part in the strip. A price has a was-price run (optional: the remove step leaves it out first) and a price run
// lit by a value (sale); legal text has its own style. A tag component takes per-language runs in a use's with.
// formFiles: the same ad in a shell whose form edits the headline as one line (widgets-web.mjs).
export const THEME = {
  colorRoles: { surface: '#ffffff', ink: '#1d2a33', accent: '#b3261e', 'accent-2': '#0b6e70', muted: '#4f5b62',
    success: '#2e7d4f', warning: '#8a5a00', danger: '#b3261e', sun: '#ffd84d' },
};
// The text styles: one list for every theme, under addons.rich-text.styles (D31).
export const STYLES = {
  accent: { colorRole: 'accent', weight: 800 },
  'was-price': { colorRole: 'muted', strike: true },
  price: { colorRole: 'ink', weight: 700, highlightRole: 'sun' },
  legal: { colorRole: 'muted', italic: true },
};
export const HEADLINE = [{ text: 'RAIN?', style: 'accent' }, { text: '\nBring it on.', style: 'strong' }];
// A run as a field item. Every run names a style: the engine's value check needs every declared member (Request 1).
const RUN = { type: 'object', properties: { text: { type: 'string', maxLength: 200 }, style: { type: 'string', maxLength: 48 } }, required: ['text', 'style'], additionalProperties: false };

const head = (id, x, y, w, h, px, anchor = 'start') => `<rect id="${id}-box" data-hsvg-kind="part" data-hsvg-fit="" x="${x}" y="${y}" width="${w}" height="${h}" fill="none"/>
<text id="${id}" data-hsvg-kind="part" x="${anchor === 'middle' ? x + w / 2 : x}" y="${y + px}" font-family="sans-serif" font-size="${px}"${anchor === 'middle' ? ' text-anchor="middle"' : ''}>${id === 'head-1' ? 'RAIN?' : 'Bring it on.'}</text>`;
const frame = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" data-hsvg-version="2.0" data-hsvg-kind="screen">
<title>Rain ad</title>
<rect width="${w}" height="${h}" fill="#ffffff" data-hsvg-layer="backdrop" data-hsvg-color="surface"/>
${body}
</svg>`;
const rest = (px, py, pw, ph, lx, ly, lpx, bx, by, tx, ty) => `<rect id="price-box" data-hsvg-kind="part" data-hsvg-fit="" x="${px}" y="${py}" width="${pw}" height="${ph}" fill="none"/>
<text id="price" data-hsvg-kind="part" x="${px}" y="${py + 24}" font-family="sans-serif" font-size="24">was $40 now $29</text>
<text id="legal" data-hsvg-kind="part" x="${lx}" y="${ly}" font-family="sans-serif" font-size="${lpx}">Offer ends Sunday.</text>
<g id="sale-btn" data-hsvg-kind="part"><rect x="${bx}" y="${by}" width="44" height="44" fill="#ffd84d" data-hsvg-color="sun"/></g>
<g id="tag-slot" data-hsvg-kind="part" data-hsvg-slot="tag" transform="translate(${tx} ${ty})"/>`;

const TALL = frame(300, 600, `${head('head-1', 20, 20, 260, 120, 72)}
${head('head-2', 20, 160, 260, 160, 40)}
${rest(20, 360, 260, 40, 20, 560, 12, 236, 420, 20, 440)}`);
const SQUARE = frame(400, 400, `${head('head-1', 20, 20, 170, 200, 48)}
${head('head-2', 210, 20, 170, 200, 48)}
${rest(20, 250, 360, 40, 20, 380, 12, 336, 300, 20, 310)}`);
const STRIP = frame(728, 90, `${head('head-1', 10, 5, 300, 80, 36)}
${rest(330, 25, 120, 40, 330, 82, 10, 670, 23, 500, 30)}`);
const TAG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 30" width="120" height="30" data-hsvg-version="2.0" overflow="visible">
<title>Tag</title>
<g id="tag" data-hsvg-kind="component"><text id="tag__words" data-hsvg-kind="part" x="0" y="20" font-family="sans-serif" font-size="16">New</text></g>
</svg>`;

const scene = {
  format: 'hsvg/2.0', kind: 'scene', id: 'ad',
  layouts: [
    { id: 'tall', shape: 'tall', drawing: 'tall.svg' },
    { id: 'square', shape: 'square', drawing: 'square.svg' },
    { id: 'strip', shape: 'strip', drawing: 'strip.svg' },
  ],
  values: { sale: { type: 'boolean', initial: false } },
  controls: { sale: { kind: 'button', target: 'sale-btn', label: 'Sale' } },
  on: { 'press:sale-btn': [{ id: 'flip', actions: [{ id: 'flip-sale', set: 'sale', to: '!sale' }] }] },
  uses: [{ id: 'new-tag', use: 'tag', into: 'tag', with: { label: { en: [{ text: 'New ', style: 'strong' }, { text: 'colours', style: 'emphasis' }], de: [{ text: 'Neue ', style: 'strong' }, { text: 'Farben', style: 'emphasis' }] } } }],
  bindings: [
    { id: 'headline-runs', target: 'head-1', 'rich-text': { runs: 'headline', flow: ['head-2'] }, fit: { box: 'head-1-box', fontPx: 72, minFontPx: 12, maxLines: 3 } },
    { id: 'price-runs', target: 'price', 'rich-text': { runs: [{ text: 'was $40 ', style: 'was-price', optional: true }, { text: 'now $29', style: 'price', highlight: 'sale' }] },
      fit: { box: 'price-box', fontPx: 24, minFontPx: 18, maxLines: 1, steps: ['shrink', 'remove'] } },
    { id: 'legal-runs', target: 'legal', 'rich-text': { runs: [{ text: 'Offer ends Sunday. Terms apply.', style: 'legal' }] } },
  ],
};
const experience = {
  format: 'hsvg/2.0', kind: 'experience', id: 'rich-ad', language: 'en', needs: ['rich-text'], theme: 'day', themes: { day: THEME }, addons: { 'rich-text': { styles: STYLES } },
  inputs: { headline: { kind: 'content', type: 'array', contentType: 'richText', styles: ['accent', 'strong', 'emphasis'], maxItems: 8, items: RUN, initial: HEADLINE } },
  story: { start: 'ad', scenes: { ad: 'scenes/ad/scene.json' }, ends: ['ad'] },
};
const tag = { format: 'hsvg/2.0', kind: 'component', id: 'tag', needs: ['rich-text'], drawing: 'tag.svg',
  inputs: { label: { kind: 'content', type: 'array', contentType: 'richText', styles: ['strong', 'emphasis'], maxItems: 4, items: RUN, initial: [{ text: 'New', style: 'strong' }] } },
  bindings: [{ id: 'words-runs', target: 'words', 'rich-text': { runs: 'label' } }] };

export const files = {
  'experience.json': { ...experience, blocks: { tag: 'blocks/tag/component.json' } },
  'blocks/tag/component.json': tag,
  'blocks/tag/tag.svg': TAG,
  'scenes/ad/scene.json': scene,
  'scenes/ad/tall.svg': TALL,
  'scenes/ad/square.svg': SQUARE,
  'scenes/ad/strip.svg': STRIP,
};

// The same ad in a shell: the stage on the left, a widget slot on the right whose declared form edits the headline.
// The form is live: each edit is one checked change of the field.
const SHELL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" data-hsvg-version="2.0" data-hsvg-kind="screen">
<title>Rich text editor</title>
<rect width="800" height="600" fill="#eeeeee" data-hsvg-layer="backdrop"/>
<rect id="stage-box" x="0" y="0" width="300" height="600" fill="none" data-hsvg-slot="stage" data-hsvg-kind="part"/>
<rect id="editor-box" x="320" y="20" width="460" height="200" fill="none" data-hsvg-slot="editor" data-hsvg-kind="part"/>
</svg>`;
export const formFiles = {
  ...files,
  'experience.json': { ...files['experience.json'], needs: ['rich-text', 'widgets'], shell: 'shell/frame.json' },
  'shell/frame.json': {
    format: 'hsvg/2.0', kind: 'shell', id: 'frame', needs: ['widgets'], drawing: 'frame.svg',
    slots: { stage: { kind: 'stage', label: 'Stage' }, editor: { kind: 'widget', label: 'Editor' } },
    addons: { widgets: { editor: { form: { items: ['headline'], apply: 'live' } } } },
  },
  'shell/frame.svg': SHELL,
};
