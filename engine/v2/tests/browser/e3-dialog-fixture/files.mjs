// A shell with a stage and a dialog slot. The scene has two controls,
// one opens the dialog. The slot's label is a template ({{ convName }}). The dialog's card (a component in the <g> slot) has two controls: Other and Close.
const shellSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>Frame</title>
<rect id="stage-box" x="0" y="0" width="400" height="300" fill="none" data-hsvg-slot="stage" data-hsvg-kind="part"/>
<g id="dlg" data-hsvg-kind="part" data-hsvg-slot="conv" transform="translate(80 60)"><rect x="-80" y="-60" width="400" height="300" fill="#000" fill-opacity="0.4"/></g>
</svg>`;
const cardSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>Card</title>
<g id="card" data-hsvg-kind="component"><rect width="240" height="180" fill="#fff" data-hsvg-layer="backdrop"/>
<text id="body" x="20" y="40" font-size="14">Card words</text>
<g id="other" data-hsvg-kind="part"><rect x="20" y="110" width="90" height="48" fill="#9cf"/></g>
<g id="close" data-hsvg-kind="part"><rect x="130" y="110" width="90" height="48" fill="#fc6"/></g></g>
</svg>`;
const sceneSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" data-hsvg-version="2.0" data-hsvg-kind="screen"><title>Scene</title>
<rect width="400" height="300" fill="#cde" data-hsvg-layer="backdrop"/>
<g id="go" data-hsvg-kind="part"><rect x="40" y="40" width="100" height="48" fill="#8c8"/></g>
<g id="info" data-hsvg-kind="part"><rect x="260" y="40" width="100" height="48" fill="#c8c"/></g>
</svg>`;
export const files = {
  'experience.json': {
    format: 'hsvg/2.0', kind: 'experience', id: 'e3-dialog', shell: 'shell/frame.json',
    blocks: { card: 'components/card/component.json' },
    story: { start: 'a', scenes: { a: 'scenes/a/scene.json' }, ends: ['a'] },
  },
  'shell/frame.json': {
    format: 'hsvg/2.0', kind: 'shell', id: 'frame', drawing: 'frame.svg',
    slots: {
      stage: { kind: 'stage', label: 'Stage' },
      conv: { kind: 'dialog', label: '{{ convName }}', openValue: 'convOpen' },
    },
    values: { convOpen: { type: 'boolean', initial: false }, convName: { type: 'string', maxLength: 40, initial: 'Conventions' } },
    uses: [{ id: 'card', use: 'card', into: 'conv' }],
    on: { 'card.closed': [{ actions: [{ close: 'conv' }] }] },
  },
  'shell/frame.svg': shellSvg,
  'components/card/component.json': {
    format: 'hsvg/2.0', kind: 'component', id: 'card', drawing: 'card.svg',
    outputs: { closed: { kind: 'event' }, other: { kind: 'event' } },
    controls: { other: { kind: 'button', target: 'other', event: 'other', label: 'Other' }, close: { kind: 'button', target: 'close', event: 'closed', label: 'Close' } },
  },
  'components/card/card.svg': cardSvg,
  'scenes/a/scene.json': { format: 'hsvg/2.0', kind: 'scene', id: 'a', drawing: 'a.svg',
    outputs: { go: { kind: 'event' } },
    controls: { go: { kind: 'button', target: 'go', event: 'go', label: 'Go' }, info: { kind: 'button', target: 'info', event: 'info', label: 'Info' } },
    on: { info: [{ actions: [{ open: 'conv' }] }] } },
  'scenes/a/a.svg': sceneSvg,
};
