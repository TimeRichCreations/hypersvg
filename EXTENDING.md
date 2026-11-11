# Extending HyperSVG

The base is a stable standard. Files made for 2.0 keep working in every 2.x. The 29 JSON words and 15 drawing marks
stay the same; a minor version may only add a value in a slot that exists, such as a control kind or a formula
function (spec 1.12). You extend it through doors. Each door has a spec section and one tiny working example in this
repository. An extension never needs a change to the base.

## Add-ons: presets, logic modules and capabilities

An add-on is a folder with a `manifest.json`. `needs` names it, with the versions it was made for
(`"example.glow@1.0.0"`), and the experience pins its digest. Its settings go in `"addons": {"<name>": {...}}`, its
actions are calls (`{"call": "<name>.<verb>", "with": {...}}`) and its events are `<name>:<event>:<subject>`.

- A **preset** is JSON only: a ready-made clip you name in `presets`. Examples: `engine/v2/addons/wobble/` and
  `engine/v2/addons/examples/addons/example.shake/`. Spec: `spec/2.0/12-writing-an-addon.md` 12.3.
- A **logic module** works out an answer from values, such as the computer's move in a game. Example:
  `engine/v2/addons/examples/addons/example.noughts/`, played in `engine/v2/addons/examples/noughts/`. Spec: 12.4.
- A **capability** adds behaviour the engine runs, such as a glow. Examples: `example.glow` and `example.tint` in
  `engine/v2/addons/examples/addons/`; the lamp in `engine/v2/addons/examples/lamp/` uses the tint. Spec: 12.5.

An add-on may also add a control kind, a binding channel and a clip track channel. Each is a **value** that
carries the add-on's name and needs the add-on in `needs`; no core word or mark is added:

- a control kind: `{"kind": "example.steps.stepper", "target": "dial", "value": "wind"}`;
- a binding channel: `{"target": "flag", "example.sway.swing": "wind / 5"}`;
- a clip track channel: `{"target": "flag", "channel": "example.sway.swing", "keys": [[0, 0], [500, 1]]}`.

Both are played in `engine/v2/addons/examples/doors/`. An add-on never adds a mark to a drawing. A control kind meets
the same accessibility contract as a core control (10.13): a role, a name, the value and its bounds, the keyboard.

Make one: `npx @hypersvg/core addon new <preset|module|capability> <owner.name>` (from a clone, `node bin/hypersvg.mjs
addon new ...`). Check it with `addon check <folder>`, test an experience that uses it with `test <folder> --allow
<owner.name>`, and version it with semver. Chapter 12 says how (12.8 to 12.10).

## Components

A component is a block with its own drawing and JSON, used inside a scene with `use`. Its inputs are what the scene
fills with `with`; its slots are where other things attach. Example: the crate in
`docs/guide/examples/harbour/crate/`, used once with `with` and three times with `items`. Spec:
`spec/2.0/04-blocks.md` and `spec/2.0/05-faces-and-body.md`.

## The host API

A web page that holds a player talks to it through one small API: `set` an input, `emit` a trigger, `on` to hear an
output, `read` a result, and `pause`, `resume`, `restart`, `destroy`. It reaches only the experience's faces, never
its inside. A page that shows a packed page in a sandboxed iframe uses the frame link
(`engine/v2/web/frame-host.mjs`; the code is in `engine/v2/README.md`).

The host may also hand in **pictures**: `player.picture(name, bytes, type)` for a content input with
`"contentType": "picture"`. The engine checks the type (PNG, JPEG or WebP), the byte size and the dimensions; a
picture place shows it. A picture is checked data, never code. A HyperSVG is placed the same way. The page loads
the player module by its address and passes the schemas:

```js
import { mount, sharedSchemas } from './node_modules/@hypersvg/core/engine/v2/web/asset-web.mjs';
const svg = await (await fetch('./assets/lamp.svg')).text();
const lamp = mount(document.querySelector('#lamp'), svg, { lit: true }, { schemas: await sharedSchemas() });
lamp.on('hsvg.changed', (e) => console.log(e.detail));
```

Serve the page over http or https. Spec: `spec/2.0/10-hosts-and-delivery.md` 10.6 and 10.14; more in
`docs/browser-embedding.md`.

## Sizes, themes and languages

One experience can make many outputs. A scene lists one drawing per size in `layouts`. A theme holds the colours and
text styles that the marks name, so a new look is one change. Word files give each language its own wording. Examples:
`docs/guide/examples/ad/` (two sizes, one theme) and `skill/2.0/examples/recipes/orientation/`. Spec:
`spec/2.0/07-representations.md`.

## The upgrade tool

Files made for 2.0 keep working in every 2.x, so the base has no 2.x upgrade tool yet. The upgrade rules for
earlier files are in `spec/2.0/reference/a13-migration.md`.

## The test harness

One command checks a folder, plays every scene and control in Node, packs it, and measures it in a browser if
Playwright is installed: `npx @hypersvg/core test <folder>` (or `node engine/v2/tools/test.mjs <folder>`). Playwright
is never a dependency; `--browser required` fails when the browser pass cannot run. An add-on is tested the same way, with `--allow <id>` for its code. Spec:
`spec/2.0/reference/a08-checking.md` A8.5.

## Outside the standard

Nothing new arrives while a page runs, except data and pictures through the host API. Importing SVG, parts or
code at run time is not part of the standard. Anyone may build it privately, as a layer outside the base that a file
names in `needs`. A file that needs such a layer works only where that layer is installed.
