// The flower of docs/one-page/FIRST-STEPS.md, section 3, copied here so the browser check does not
// depend on the guide's text. Its button has no label: its name is its only <text>, "Grow" (11).
export const files = {
  'experience.json': {
  "format": "hsvg/2.0",
  "kind": "experience",
  "id": "grow-a-flower",
  "about": {"title": "Grow a flower"},
  "story": {"start": "garden", "scenes": {"garden": "scenes/garden/scene.json"}}
},
  'scenes/garden/scene.json': {
  "format": "hsvg/2.0",
  "kind": "scene",
  "id": "garden",
  "drawing": "garden.svg",
  "values": {
    "stage": {"type": "string", "enum": ["seed", "bud", "bloom"], "maxLength": 5, "initial": "seed"}
  },
  "controls": {
    "grow": {"kind": "button", "target": "grow-button", "event": "grew"}
  },
  "on": {
    "grew": [
      {"guard": "stage === 'seed'", "actions": [{"set": "stage", "to": "'bud'"}]},
      {"guard": "stage === 'bud'", "actions": [{"set": "stage", "to": "'bloom'"}, {"play": "sway"}]}
    ]
  },
  "clips": {
    "sway": {"durationMs": 1200, "loop": true, "loopMode": "ping-pong", "reducedMotion": "rest",
      "tracks": [{"target": "flower", "channel": "rotate", "keys": [[0, -6], [1200, 6, "ease-in-out"]]}]}
  },
  "bindings": [
    {"target": "flower", "variant": "stage"},
    {"target": "status", "text": "A {{ stage }}"}
  ]
},
  'scenes/garden/garden.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" data-hsvg-version="2.0" data-hsvg-kind="screen">
  <title>Grow a flower</title>
  <rect id="sky" data-hsvg-layer="backdrop" x="0" y="0" width="400" height="300" fill="#e8f4ff"/>
  <rect id="soil" data-hsvg-layer="backdrop" x="0" y="200" width="400" height="100" fill="#8a5a3b"/>
  <g id="flower" data-hsvg-kind="part" data-hsvg-pivot="200 200" data-hsvg-motion="rotate -6..6">
    <g data-hsvg-variant="seed">
      <ellipse cx="200" cy="194" rx="12" ry="8" fill="#5b3a1e"/>
    </g>
    <g data-hsvg-variant="bud" display="none">
      <path d="M200 200 V140" stroke="#3f8f3a" stroke-width="6"/>
      <ellipse cx="200" cy="130" rx="12" ry="18" fill="#e0607e"/>
    </g>
    <g data-hsvg-variant="bloom" display="none">
      <path d="M200 200 V110" stroke="#3f8f3a" stroke-width="6"/>
      <circle cx="200" cy="80" r="22" fill="#f28fb0"/>
      <circle cx="170" cy="96" r="20" fill="#f28fb0"/>
      <circle cx="230" cy="96" r="20" fill="#f28fb0"/>
      <circle cx="200" cy="96" r="14" fill="#ffd34d"/>
    </g>
  </g>
  <text id="status" data-hsvg-kind="part" x="200" y="235" text-anchor="middle"
        font-family="sans-serif" font-size="22" fill="#ffffff">A seed</text>
  <g id="grow-button" data-hsvg-kind="part" data-hsvg-role="action">
    <rect x="140" y="248" width="120" height="44" rx="22" fill="#3f8f3a"/>
    <text x="200" y="277" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#ffffff">Grow</text>
  </g>
</svg>`,
};
