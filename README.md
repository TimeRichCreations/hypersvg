# HyperSVG

**Turn an SVG into a hyper drawing: parts that respond, with behavior you can read, check, change and reuse.**

Pack it as a **HyperSVG**, one `.svg` file to place in any page, or as an **Experience**, one `.html` page that
runs on its own, even offline.

<p align="center">
  <img src="https://cdn.jsdelivr.net/npm/@hypersvg/core@2.0.0-next.0/docs/readme/lamp-preview.svg" width="360" alt="An animated preview of the starter lamp: the switch is pressed, the bulb lights and the words change">
</p>
<p align="center"><em>An animated preview of the starter lamp. <a href="https://timerichcreations.github.io/hypersvg/">Try the real one</a>.</em></p>

## Make your first one in 5 steps

You need Node 20 or later. Nothing else.

### 1. Create

```sh
npx @hypersvg/core init my-lamp
```

```text
my-lamp/
  lamp.svg          the picture
  lamp.json         what the switch does
  experience.json   what a page may set (lit, height) and hear (switched)
  GUIDE.md, AGENTS.md   for you and your coding assistant
```

### 2. Look

The drawing gives a name to each part that does something. The bulb is drawn twice, off and on:

```svg
<g id="bulb" data-hsvg-kind="part">
  <g data-hsvg-variant="off"><circle cx="200" cy="110" r="50" fill="#555555"/></g>
  <g data-hsvg-variant="on" display="none"><circle cx="200" cy="110" r="50" fill="#ffd45e"/></g>
</g>
```

The JSON says what happens:

```json
"controls": {"switch": {"kind": "toggle", "target": "switch", "value": "lit", "event": "flip"}},
"bindings": [
  {"target": "bulb", "variant": "lit ? 'on' : 'off'"},
  {"target": "switch-words", "text": "Turn {{ lit ? 'off' : 'on' }}"}
]
```

Read it as sentences. The switch turns `lit` on and off. The bulb shows `on` or `off`, and the words follow.

| `lit` is false | `lit` is true |
|---|---|
| <img src="https://cdn.jsdelivr.net/npm/@hypersvg/core@2.0.0-next.0/docs/readme/lamp-off.svg" width="240" alt="The lamp switched off"> | <img src="https://cdn.jsdelivr.net/npm/@hypersvg/core@2.0.0-next.0/docs/readme/lamp-on.svg" width="240" alt="The lamp switched on"> |

### 3. Change

In `my-lamp/lamp.json`, replace the binding for `switch-words` with:

```json
{"target": "switch-words", "text": "{{ lit ? 'Switch off' : 'Switch on' }}"}
```

You changed what the button says, without touching the picture or the behavior.

### 4. Check

```sh
npx @hypersvg/core check my-lamp
```

`0 findings` means it is ready. A mistake comes back with the file, the line and what is wrong:

```text
E-SVG-UNSAFE lamp.svg:12:5 switch: event attribute onclick
```

Neither file may hold script, so you can check a file from a teammate or an AI tool before anything plays.

### 5. Pack

As an **Experience**, one page that runs on its own:

```sh
npx @hypersvg/core pack my-lamp out
```

Double-click `out/lamp.html`. Press the switch, or press Tab and then Enter. It works offline, with no server.

Or as a **HyperSVG**, to place in a web page:

```sh
npx @hypersvg/core pack --asset my-lamp out
```

Put `out/lamp.svg` next to your web page, and add one line that loads the player:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@hypersvg/core@2.0.0-next.0/engine/v2/web/asset-web.mjs"></script>

<hypersvg-asset src="lamp.svg" lit="true">
  <img src="lamp.svg" alt="A lamp">
</hypersvg-asset>
```

The lamp now responds on your page. `lit="true"` sets one of its inputs, and the `<img>` inside shows the still
picture until the player is ready. In an `<img>` alone, a design tool or a README, `lamp.svg` stays a still
picture.

- Serve the page over http or https. Opening it straight from disk does not work, because the player loads the file.
- Keep the exact version in the address (`@2.0.0-next.0`), so an update never changes your page by surprise.
- To host the player yourself (for offline use or a strict site), copy `node_modules/@hypersvg/core` to your site
  and point the script line at your copy. [Embedding](docs/browser-embedding.md) has the details.

## Why HyperSVG

- **Your artwork stays SVG.** The behavior lives beside it in JSON. Both are plain text you can read and review.
- **Safe to accept.** No script in either file: the checker refuses it.
- **Mistakes caught early.** The checker names the fix, and packing stops on errors.
- **One file to share.** An Experience runs anywhere. A HyperSVG is reused across pages, and many share one player.
- **Accessible controls.** Every control gets keyboard handling and its role. You choose clear labels and contrast.
- **A small core that stays put.** 29 JSON words and 15 drawing marks, stable across 2.x. Add-ons bring more.

The npm name `hypersvg` belongs to another package, so write `npx @hypersvg/core` until you install ours. After
`npm install @hypersvg/core`, the short `npx hypersvg` works.

## Next steps

- **Scenes, stories and reusable parts:** the [guide](GUIDE.md) goes from the lamp to a two-scene harbour.
- **Working examples:** [docs/guide/examples/](docs/guide/examples/).
- **HyperSVGs in your site or app:** [embedding](docs/browser-embedding.md).
- **Test it in a browser:** `npx hypersvg test my-lamp --quick` (with Playwright installed).
- **Coding assistants:** [AGENTS.md](AGENTS.md). **Add-ons:** [EXTENDING.md](EXTENDING.md).
- **The specification:** [spec/2.0](spec/2.0/README.md). **Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md).

HyperSVG 2.0 is a release candidate (`2.0.0-next.0`). Licensed under [Apache-2.0](LICENSE).
