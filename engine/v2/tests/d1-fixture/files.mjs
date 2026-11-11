// A small experience for the data tests (live-data and the dash channel): one 400 x 300 scene.
// - `regions`: a live rows field of the experience, fed by the host; its fallback is the bundled table `regions`;
// - one ring per row (a repeated use of `ring`): a dash of the row's share from the shares before it, a donut;
// - `gauge`: one arc whose dash is the first row's share, gliding; `trend`: a line that draws on (a dash clip that
//   finishes under reduced motion).
const ROWS = '[{"id":"north","share":0.5},{"id":"south","share":0.3},{"id":"west","share":0.2}]';
const scene = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" data-hsvg-version="2.0" data-hsvg-kind="screen">
<title>Regions</title>
<g id="rings" data-hsvg-kind="part" data-hsvg-repeat="">
<g id="ring-1" data-hsvg-kind="part" data-hsvg-slot="ring-1"/>
<g id="ring-2" data-hsvg-kind="part" data-hsvg-slot="ring-2"/>
<g id="ring-3" data-hsvg-kind="part" data-hsvg-slot="ring-3"/>
<g id="ring-4" data-hsvg-kind="part" data-hsvg-slot="ring-4"/>
</g>
<path id="gauge" data-hsvg-kind="part" d="M250 150 A50 50 0 0 1 350 150" pathLength="1" fill="none" stroke="#168e91" stroke-width="12" data-hsvg-motion="draw 0..1"/>
<polyline id="trend" data-hsvg-kind="part" points="20,280 120,240 220,260 380,200" pathLength="1" fill="none" stroke="#153b4b" stroke-width="3" data-hsvg-motion="draw 0..1"/>
</svg>`;
const ring = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" data-hsvg-version="2.0">
<title>A ring</title>
<g id="ring" data-hsvg-kind="component">
<g transform="rotate(-90 100 100)">
<circle id="ring__arc" data-hsvg-kind="part" cx="100" cy="100" r="80" pathLength="1" fill="none" stroke="#ed795f" stroke-width="24" data-hsvg-motion="draw 0..1"/>
</g>
</g>
</svg>`;
export const files = {
  'experience.json': {
    format: 'hsvg/2.0', kind: 'experience', id: 'regions-live', language: 'en', needs: ['live-data'],
    resources: { regions: { kind: 'data', file: 'data/regions.json', digest: 'sha256:c2358f01b1d72d690641b6728a514abde0d153dabbe1985edf8ac7dee263ab3e' } },
    data: {
      regions: { resource: 'regions', key: 'id', maxRows: 4, columns: { id: { type: 'string', maxLength: 16 }, share: { type: 'number', minimum: 0, maximum: 1 } } },
    },
    inputs: { feed: { kind: 'content', type: 'array', contentType: 'rows', table: 'regions', maxItems: 4,
      items: { type: 'object', properties: { id: { type: 'string', maxLength: 16 }, share: { type: 'number', minimum: 0, maximum: 1 } }, required: ['id', 'share'], additionalProperties: false } } },
    addons: { 'live-data': { inputs: { feed: { fallback: 'regions' } } } },
    blocks: { ring: 'components/ring/component.json' },
    story: { start: 'board', scenes: { board: 'scenes/board/scene.json' }, ends: ['board'] },
  },
  'data/regions.json': ROWS,
  'scenes/board/scene.json': {
    format: 'hsvg/2.0', kind: 'scene', id: 'board', drawing: 'board.svg',
    uses: [{ id: 'rings', use: 'ring', into: 'rings', items: 'feed', key: 'item.id',
      with: { share: 'clamp(item.share, 0, 1)', start: 'clamp(sum(range(index), feed[item].share), 0, 1)' } }],
    clips: { draw: { durationMs: 1000, loopMode: 'hold', tracks: [{ id: 'trend-draw', target: 'trend', channel: 'draw', keys: [[0, 0], [1000, 1]] }] } },
    bindings: [{ id: 'gauge-dash', target: 'gauge', draw: 'clamp(at(feed, 0, {"share": 0}).share, 0, 1)', glide: { durationMs: 400 } }],
    entry: [{ id: 'play-draw', play: 'draw' }],
  },
  'scenes/board/board.svg': scene,
  'components/ring/component.json': {
    format: 'hsvg/2.0', kind: 'component', id: 'ring', drawing: 'ring.svg',
    inputs: { share: { kind: 'knob', type: 'number', minimum: 0, maximum: 1, initial: 0 }, start: { kind: 'knob', type: 'number', minimum: 0, maximum: 1, initial: 0 } },
    bindings: [{ id: 'arc-dash', target: 'arc', draw: 'share', start: 'start' }],
  },
  'components/ring/ring.svg': ring,
};
