# The HyperSVG guide

This guide teaches the whole format on its own, to people and to any AI tool. Every word and mark has an example.
Each example is cut from a small folder in `docs/guide/examples/` that checks and plays clean.

HyperSVG makes two things from the same format:

- **Level 1, an asset.** One drawing and its JSON, with knobs. It packs into one **HyperSVG** that shows its rest
  pose anywhere and plays when a page places it. Start here.
- **Level 2, an experience.** Scenes, links, a shell and blocks. It packs into one **Experience**: an offline HTML
  page that runs on its own.

An asset is a small experience, so everything you learn at level 1 holds at level 2.

## 1. Your first asset: a lamp

An asset is **a drawing plus decisions**. The drawing is SVG; marks on it (`data-hsvg-*` attributes) say which shapes
are parts and how they may move. The decisions are JSON; they say what a person can do and what the parts show. There
is no program code. The lamp is three files (`docs/guide/examples/lamp/`):

```text
experience.json   the asset: its knobs (inputs), what it sends (outputs), its one scene
lamp.json         the scene: a toggle, its reaction and three bindings
lamp.svg          the drawing
```

```json
"inputs": {
  "lit":    {"kind": "knob", "type": "boolean", "initial": false},
  "height": {"kind": "knob", "type": "number", "minimum": 0.5, "maximum": 1.5, "initial": 1}
},
"outputs": {"switched": {"kind": "event"}},
"story": {"start": "lamp", "scenes": {"lamp": "lamp.json"}, "endless": true}
```

The **knobs** are what a page may set: here, whether the lamp is lit and how tall it is. The **outputs** are what the
asset sends out. The toggle and the page both change the same `lit` knob. The bulb reads that knob directly, so the picture and the host always agree:

```json
{
  "format": "hsvg/2.0",
  "kind": "scene",
  "id": "lamp",
  "drawing": "lamp.svg",
  "controls": {"switch": {"kind": "toggle", "target": "switch", "value": "lit", "event": "flip"}},
  "on": {
    "flip": [{"actions": [{"emit": "switched"}]}]
  },
  "bindings": [
    {"target": "lamp", "scale": "height"},
    {"target": "bulb", "variant": "lit ? 'on' : 'off'"},
    {"target": "switch-words", "text": "Turn {{ lit ? 'off' : 'on' }}"}
  ]
}
```

The drawing marks the parts the JSON names. The lamp may grow from 0.5 to 1.5 around its foot; the bulb has two
drawn variants:

```svg
<g id="lamp" data-hsvg-kind="part" data-hsvg-role="lamp" data-hsvg-pivot="200 180" data-hsvg-motion="scale 0.5..1.5">
  <g id="bulb" data-hsvg-kind="part" data-hsvg-label="Bulb">
    <g data-hsvg-variant="off"><circle cx="200" cy="110" r="50" fill="#555555"/></g>
    <g data-hsvg-variant="on" display="none"><circle cx="200" cy="110" r="50" fill="#ffd45e"/></g>
  </g>
</g>
<g id="switch" data-hsvg-kind="part" data-hsvg-role="action">
  <rect x="140" y="220" width="120" height="50" rx="25" fill="#d84315"/>
  <text id="switch-words" data-hsvg-kind="part" x="200" y="252" …>Turn on</text>
</g>
```

A plain role word such as `lamp` is listed once in the experience: `"roles": {"lamp": {"appliesTo": ["part"]}}`.

**Check, play and pack it:**

```sh
npx @hypersvg/core check lamp            # 0 findings means it is ready
npx @hypersvg/core test lamp --quick     # play every control; a browser pass if Playwright is there
npx @hypersvg/core pack --asset lamp out # one HyperSVG: out/lamp.svg
npx @hypersvg/core pack lamp out         # or one Experience: out/lamp.html
```

**The HyperSVG.** `out/lamp.svg` is the drawing with its marks, and the JSON inside `<metadata>` as data, never as
script. It shows the rest pose in an `<img>`, a design tool, a README or a browser tab. `npx @hypersvg/core unpack
out/lamp.svg lamp` gives the folder back. You author in separate files and ship one file.

**Place it in a page.** Load the shared player once, then place any number of assets:

```html
<script type="module" src="./node_modules/@hypersvg/core/engine/v2/web/asset-web.mjs"></script>
<hypersvg-asset src="lamp.svg" lit="true" height="1.2"></hypersvg-asset>
```

Each attribute sets the knob of the same name; changing an attribute sets it again. `element.inputs()` lists each
knob's name, type and bounds, so any page or tool can build its own panel. The element sends each output as a page
event named `hsvg:<output>` (here `hsvg:switched`). A host places an asset itself with `mount(element, assetSvg,
inputs, {schemas})` from `@hypersvg/core/asset`, and hears its outputs with `on`. The player checks the asset before it plays, and refuses anything an asset cannot hold.

Serve the page over HTTP. The relative module URL above works from a project with the package installed; bare package imports need a bundler or import map. Direct `mount` requires schemas; see [browser embedding](docs/browser-embedding.md).

## 2. The rule for settings, and the formula rule

Some words take a **setting** (`as`, `axis`, `transition`). **The first listed value is the default:** leave the
setting out to get it. Two things are always written: `axis` on `move` and on a `slider`, and the `kind` of every
control, input and output.

**One formula rule.** Every value slot holds a **formula**: a `set`'s `to`, a use's `with`, a choice option's
`value`, the name in `play`, an `emit`'s or a `call`'s `with`. Text in a formula is in single quotes: `"to": "'Right!'"`,
`{"play": "'bell'", "as": "sound", "volume": 0.5}`. An empty text is `"''"`. Only words a person reads (`text` and `label` bindings)
are plain words with `{{ formula }}` inside: `"text": "Turn {{ lit ? 'off' : 'on' }}"`.

## 3. The 15 drawing marks

Only parts need an `id`. The examples come from `docs/guide/examples/harbour/` and its crate.

| Mark | Says | Example |
|---|---|---|
| `data-hsvg-version` | the format version, on the root | `<svg viewBox="0 0 800 500" data-hsvg-version="2.0" data-hsvg-kind="screen">` |
| `data-hsvg-kind` | `part` (JSON can point at it), `component` (a block's root), `screen` (a scene's root) | `<g id="boat" data-hsvg-kind="part">` |
| `data-hsvg-role` | a part's job in one word, then any side (`left`, `right`, `near`, `far`) | `data-hsvg-role="flag"`, `data-hsvg-role="lid near"` |
| `data-hsvg-label` | the name a person hears | `data-hsvg-label="Harbour flag"` |
| `data-hsvg-pivot` | the point it turns and grows around | `data-hsvg-pivot="600 140"` |
| `data-hsvg-motion` | which ways it may move, and how far | `data-hsvg-motion="move-x 0..200"`, `"rotate *"` |
| `data-hsvg-follow` | the part it moves with, though drawn elsewhere | `<g id="wake" data-hsvg-follow="boat">` |
| `data-hsvg-variant` | one drawn version of a part | `<g data-hsvg-variant="bright" display="none">` |
| `data-hsvg-color` | a theme colour | `data-hsvg-color="accent"`, `"fill:surface"`, `"fill:warning stroke:muted"` |
| `data-hsvg-text-style` | a theme text style: `heading`, `body`, `caption` | `<text id="title" data-hsvg-text-style="heading">` |
| `data-hsvg-layer` | a group's job: `content`, `backdrop`, `overlay`, `decoration` | `<rect id="sea" data-hsvg-layer="backdrop">` |
| `data-hsvg-slot` | where a block is placed | `<g id="lead-spot" data-hsvg-kind="part" data-hsvg-slot="lead-spot"/>` |
| `data-hsvg-fit` | a box: `text` (default), `items` or `video` | `<rect id="title-box" data-hsvg-kind="part" data-hsvg-fit="" … fill="#2e7d32"/>` |
| `data-hsvg-repeat` | a group whose child slots hold one item each | `<g id="crates" data-hsvg-kind="part" data-hsvg-repeat="">` |
| `data-hsvg-route` | a drawn path: `track` (things move along it), `surface` (things stand on it) | `<path id="gull-path" data-hsvg-kind="part" data-hsvg-route="track" …/>` |

What the marks mean in detail:

- **Motion.** Channels with ranges `min..max`, split by `;`: `move-x`, `move-y`, `rotate`, `lean` (degrees), `scale`,
  `scale-x`, `scale-y`, `line` (line thickness), `opacity`, `draw`, `wipe` (0 to 1). `rotate *` turns without end. A
  part moves only on the channels it lists, within their ranges. Mirroring needs no range: bind `scale` on `axis` `x`
  to `-1` or `1`.
- **Variants.** Put `data-hsvg-variant` on each direct child `<g>` of a part. All but one carry `display="none"`.
- **Roles that act.** `decoration`: ornament; screen readers skip it and it holds no control or text. `icon`: an icon
  place (a nested `<svg>`), or a `<symbol id="clock" data-hsvg-role="icon">` in an icon set. On an unpainted `<rect>`,
  one or two of `keep-inside` (never cropped), `keep-clear` (nothing painted over it), `keep-empty` (only backdrop).
  List plain role words (`flag`, `wheel`) in the experience's `roles`, or the checker warns.
- **Colours.** `data-hsvg-color` goes on any shape or group, part or not. The roles are `surface`, `ink`, `accent`,
  `accent-2`, `muted`, `success`, `warning`, `danger`. A bare role means fill.
- **Layers.** `backdrop` may run past the edges. `overlay` paints over the rest on purpose. `decoration` is paint that
  may give way when the picture is simplified.
- **Places.** A slot is an empty group. Inside a part, a slot is an attach point for `player.attach`. A fit box may
  be painted.
- **Add-on values never go in a drawing.** The drawing names the part; the JSON says the rest (section 6.7). Tool
  records go in `<metadata>`.

## 4. The 29 JSON words

From `docs/guide/examples/harbour/` (`harbour.json`, `shell.json`, `crate/component.json`).

**Controls** (the control's `kind`). A control sends its `event`; `enabled` is a yes-or-no formula. A control is
named by the words drawn in it, else give it a `label`.

| Word | Example |
|---|---|
| `button` | `"go": {"kind": "button", "target": "go", "event": "load", "enabled": "score < 99"}` |
| `toggle` | `"lamp": {"kind": "toggle", "target": "lamp", "value": "lampOn", "label": "Lamp"}` |
| `choice` | `"pick": {"kind": "choice", "value": "pick", "event": "picked", "options": {"a": {"target": "card-a", "value": "'a'"}, "b": {"target": "card-b", "value": "'b'"}}}` |
| `slider` | `"speed": {"kind": "slider", "axis": "x", "target": "handle", "value": "speed", "range": [0, 200], "label": "Speed", "valueText": "{{ speed }} km/h"}` |
| `dial` | `"wind": {"kind": "dial", "target": "vane", "value": "wind", "range": [-45, 45], "label": "Wind", "valueText": "{{ wind }} degrees"}` |
| `drag` | `"parcel": {"kind": "drag", "target": "parcel", "drops": ["basket", "bin"], "accept": "event.drop === 'basket'", "event": "loaded", "missEvent": "missed", "label": "Parcel"}` |

A slider's handle and a dial's part show the value only when you bind them: `{"target": "handle", "move": "speed",
"axis": "x"}`, `{"target": "vane", "rotate": "wind"}`. A drag reads `accept` at the drop; a refused or missed drop
goes home and sends `missEvent`.

**Actions.**

| Word | Example |
|---|---|
| `set` | `{"set": "score", "to": "score + 1"}`, `{"set": "note", "to": "'Loaded!'"}` |
| `if` | `{"if": "score > 9", "then": [{"emit": "done"}], "else": [{"set": "note", "to": "'Keep going'"}]}` |
| `emit` (`as`: event, record, trigger) | `{"emit": "done"}`, `{"emit": "trips", "as": "record", "with": {"stop": "'quay'"}}`, `{"emit": "lead.shake", "as": "trigger"}` |
| `play` (`as`: clip, sound) | `{"play": "roll"}`, `{"play": "'bell'", "as": "sound", "volume": 0.5}` |
| `stop` | `{"stop": "roll", "keep": true}` (`keep` freezes the parts where they are) |
| `open` | `{"open": "settings"}` (a dialog slot of the shell) |
| `close` | `{"close": "settings"}` |
| `call` | `{"call": "player.attach", "with": {"part": "'lead'", "to": "'spare.lid-point'"}}` |

The built-in calls are `player.openUrl`, `player.setting`, `player.resetSaved` and `player.attach`:

```json
"mute": [{"actions": [{"call": "player.setting", "with": {"muted": true}}]}],
"forget": [{"actions": [{"call": "player.resetSaved"}]}],
"shop": [{"actions": [{"call": "player.openUrl", "with": {"field": "'shopLink'"}}]}]
```

`player.openUrl` opens the address in an input with `"contentType": "url"`; the experience asks for it with
`"grants": {"openUrl": true}`. `player.attach` moves a use onto a slot, written `'<use>.<slot>'`; `"to": "null"`
takes it back home. The sound `bell` is made in the experience: `"audioSynths": {"bell": {"wave": "sine", "from":
880, "to": 660, "durationMs": 120, "gain": 0.4}}`.

**Bindings** (what a part shows). The key is the word; the value is a formula.

| Word | Example |
|---|---|
| `text` | `{"target": "title", "text": "{{ note }}", "fit": {"box": "title-box", "minFontPx": 18, "maxLines": 2}}` |
| `label` (what a screen reader says) | `{"target": "parcel", "label": "Parcel, {{ score }} loaded"}` |
| `visible` | `{"target": "badge", "visible": "score > 9"}` |
| `variant` (`as`: drawn, picture, icon) | `{"target": "beam", "variant": "lampOn ? 'bright' : 'dim'"}` |
| `color` (`as`: marked, fill, stroke) | `{"target": "lamp", "color": "lampOn ? 'success' : 'ink'"}`, `{"target": "rope", "color": "tension > 3 ? '#b3261e' : '#5a3a30'", "as": "stroke"}` |
| `move` (`axis`: x, y, route) | `{"target": "boat", "move": "speed", "axis": "x"}`, `{"target": "gull", "move": "flight", "axis": "route", "route": "gull-path"}` |
| `rotate` (`as`: spin, lean) | `{"target": "vane", "rotate": "wind"}`, `{"target": "flag", "rotate": "wind / 2", "as": "lean"}` |
| `scale` (`as`: stretch, line, box; `axis`: both, x, y) | `{"target": "rope", "scale": "tension", "as": "line"}`, `{"target": "gull", "scale": "wind < 0 ? -1 : 1", "axis": "x"}` (−1 mirrors) |
| `opacity` | `{"target": "haze", "opacity": "lampOn ? 0.3 : 1"}` |
| `draw` (`as`: line, wipe, points) | `{"target": "trail", "draw": "speed / 200"}`, `{"target": "curtain", "draw": "flight", "as": "wipe"}` |

`color` `as` `marked` (the default) gives a theme role to the paints the drawing marks with `data-hsvg-color`; `fill`
and `stroke` take `#rrggbb`. A colour is a theme role wherever it can be. `variant` with `"as": "icon"` picks an icon
by its `id` on an icon place. `draw` is a share from 0 to 1; a path that draws carries `pathLength="1"`.

**Structure.**

| Word | Example |
|---|---|
| `reaction` (an entry in `on`) | `"picked": [{"actions": [{"set": "flight", "to": "pick === 'a' ? 1 : 0"}]}]`; a reaction may add a `"guard": "speed > 0"` |
| `machine` | section 6.4 |
| `clip` | `"roll": {"durationMs": 800, "loop": true, "speed": "max(0.25, pace)", "tracks": [{"target": "wheel", "channel": "rotate", "keys": [[0, 0], [800, 360]]}]}` |
| `link` (`transition`: cut, fade, slide) | `{"id": "in", "from": "gate", "on": "start", "to": "harbour", "transition": "fade", "transitionMs": 300}` in the story's `links` |
| `use` | `{"id": "lead", "use": "crate", "into": "lead-spot", "with": {"name": "'Lead'"}}` |

A clip's tracks hold keys `[ms, value]` on a `channel` named like a binding word, with its `as` or `axis`:
`{"target": "lid", "channel": "move", "axis": "y", "keys": [[0, 0], [150, -8], [300, 0]]}`.

**Values, inputs and outputs.** A value has a `type` (`number`, `boolean`, `string`, `array`, `object`) and lives as
long as its owner; `"lifetime": "saved"` keeps it for next time. Inputs are what a parent or a host may change:
`content` (words or pictures), `knob` (a value with limits) or `trigger` (a signal). Outputs leave the block: `result`
(a value others read), `event` or `record`.

```json
"best": {"type": "number", "initial": 0, "minimum": 0, "maximum": 99, "lifetime": "saved"}
"pace": {"kind": "knob", "type": "number", "initial": 2, "minimum": 1, "maximum": 5}
"inputs": {"name": {"kind": "content", "type": "string", "maxLength": 12, "initial": "Crate"}, "shake": {"kind": "trigger"}},
"score": {"kind": "result", "type": "number", "minimum": 0, "maximum": 99, "value": "score"},
"done": {"kind": "event"},
```

**A button that cycles** (`docs/guide/examples/light/`). A block's values sit in one `values` block, beside
`controls` and `on`. Here a number value with bounds, a button and one reaction cycle a light through three states:

```json
"values": {"light": {"type": "number", "initial": 0, "minimum": 0, "maximum": 2}},
"controls": {"next": {"kind": "button", "target": "next", "event": "nextLight", "label": "Next light"}},
"on": {"nextLight": [{"actions": [{"set": "light", "to": "(light + 1) % 3"}]}]},
```

A binding shows it: `{"target": "lamp-red", "variant": "light === 0 ? 'on' : 'off'"}`. For states with their own
timers, use a machine (section 6.4); each of its event transitions has an `id`.

Put `values` in a scene for state that only that scene uses. Put it in `experience.json` for state that every scene
shares; an experience's outputs read only these. Every number states its `minimum` and `maximum`. A `set` writes a
value, never an input (`E-WRITE-INPUT`); a control may write a knob directly with `"value"`.

## 5. Level 2: an experience

An experience is a story of scenes. `docs/guide/examples/harbour/` has two scenes, a link between them, a shell with
a settings dialog, and a crate block used four times.

```json
"shell": "shell.json",
"blocks": {
  "crate": "crate/component.json"
},
```

The story names the first scene, the scenes, the links and the endings. A link fires on an event. A block inside
another is a `use`; its `with` fills the block's inputs. A shell holds the scenes: its slot `kind` is `widget`,
`stage`, `overlay` or `dialog`.

```json
"slots": {
  "stage": {"kind": "stage", "label": "Harbour"},
  "settings": {"kind": "dialog", "label": "Settings", "openValue": "settingsOpen"}
},
```

## 6. Seven structures, one example each

**6.1 Layouts per size** (`docs/guide/examples/ad/`). A scene drawn once per size lists `layouts` instead of
`drawing`. Every drawing has the same part ids, and sets `width` and `height` equal to its `viewBox`.

```json
"layouts": [{"id": "wide", "size": "728x90", "drawing": "ad-728x90.svg"},
            {"id": "tall", "size": "160x600", "drawing": "ad-160x600.svg"}],
```

The experience names the sizes: `"axes": [{"axis": "shape", "select": "space", "sizes": {"728x90": "must", "160x600":
"must"}}]`.

**6.2 The theme** (`docs/guide/examples/ad/`). The colours that colour marks paint, changed once here:

```json
"theme": "harbour",
"themes": {"harbour": {"colorRoles": {"surface": "#fff7ec", "ink": "#3e2723", "accent": "#d84315",
  "accent-2": "#168e91", "muted": "#8d6e63", "success": "#2e7d32", "warning": "#8a5a00", "danger": "#b3261e"}}},
```

**6.3 Repeated uses.** A use with `items` repeats once per item into the child slots of a repeat group. `key` names
the item:

```json
{"id": "crates", "use": "crate", "into": "crates", "items": "range(3)", "key": "item", "with": {"name": "stops[item]"}}
```

**6.4 A timed machine.** A machine moves between states on events and on timers (`after`). A formula asks
`active('<state>')`. A transition on an event always names itself with an `id`; a timer in `after` needs none. A
blinking buoy light:

```json
"machines": [{"id": "buoy", "initial": "on", "states": {
  "on": {"after": [{"delayMs": 1000, "target": "off"}]}, "off": {"after": [{"delayMs": 500, "target": "on"}]}}}],
{"target": "buoy-light", "variant": "active('on') ? 'on' : 'off'"},
```

**6.5 `entry`.** A scene's `entry` actions run each time the scene starts:

```json
"entry": [{"set": "note", "to": "'Ahoy!'"}, {"play": "roll"}],
```

**6.6 What a choice sends.** A choice writes the picked option's `value` into its own value, then sends its `event`.
With `"pick": {"type": "string", "initial": "", "maxLength": 1}` nothing is picked at the start. Each option is named
by its own `label`, else by the words drawn in it.

```json
"picked": [{"actions": [{"set": "flight", "to": "pick === 'a' ? 1 : 0"}]}]
```

**6.7 An add-on block and its event** (`docs/guide/examples/physics/`, in the add-ons release). An add-on works only when `needs` lists it. Its
settings go in the block's `addons.<name>`, never in a drawing. Its values start with its name (`physics.kick`). Its
events are `<add-on>:<event>:<subject>`.

```json
"needs": ["physics"],
"addons": {"physics": {"bodies": {
  "ball": {"target": "ball", "shape": {"kind": "circle", "radius": 20}, "origin": [100, 300], "rest": [0, 0], "bounce": 0.4}}}},
"throw": [{"actions": [{"call": "physics.kick", "with": {"body": "'ball'", "vx": 300, "vy": -500}}]}],
"physics:hit:ball": [{"guard": "baskets < 99", "actions": [{"set": "baskets", "to": "baskets + 1"}]}]
```

`needs` goes on the experience; `addons` goes on the scene that uses it. The official add-ons, physics among them,
come in their own release: without it the checker says `W-ADDON-ABSENT` and the packer waits. `EXTENDING.md` shows
how to write your own.

## 7. Content is data: the list pattern

Keep content in values, not inside formulas. Then a tool can add, change or remove it without touching the rest. What
repeats (questions, steps, towns) is one list of rows (`docs/guide/examples/list/`):

```json
"towns": {"type": "array", "maxItems": 4, "items": {"type": "object", "properties": {
            "name": {"type": "string", "maxLength": 20}, "x": {"type": "number", "minimum": 0, "maximum": 400}},
            "required": ["name", "x"], "additionalProperties": false},
          "initial": [{"name": "Harbour Row", "x": 0}, {"name": "Mill Lane", "x": 200}, {"name": "The Point", "x": 400}]},
"stop": {"type": "number", "initial": 0, "minimum": 0, "maximum": 3}
```

Formulas read the list: `list[i].key`, `at(list, i, fallback)`, `length(list)`, `includes(list, x)`,
`lookup(list, 'key', x, fallback)` and `append(list, x, maxItems)`. A number that counts along the list takes
`maxItems - 1` as its bound. Everything else counts the list, so a new row needs no other change:

```json
"controls": {"next": {"kind": "button", "target": "next", "event": "next", "label": "Next town", "enabled": "stop < length(towns) - 1"}},
{"target": "where", "text": "{{ towns[stop].name }} ({{ stop + 1 }} of {{ length(towns) }})"},
{"target": "boat", "move": "towns[stop].x", "axis": "x"}
```

A block drawn once per row is a use with `items`: `"items": "range(length(towns))", "key": "item",` and
`"with": {"name": "towns[item].name"}`. A colour is a theme role, never a colour in a formula. A new size is one more
layout.

## 8. Check, test, pack

```sh
npx @hypersvg/core check <folder>             # every file, before anything plays
npx @hypersvg/core test <folder> --quick      # play every scene and control; a browser pass if Playwright is there
npx @hypersvg/core pack <folder> <out>        # one Experience: an offline HTML page
npx @hypersvg/core pack --asset <folder> <out> # one HyperSVG (an asset)
```

`pack` writes `<out>/<id>.html` and `<out>/package.json`, a short description of the page (packing a second
experience into the same folder replaces it). `pack --asset` writes `<out>/<id>.svg`. Both print the engine's size
(`engine sizes, gzip 9: core 118727 of 120000`) and the files they left out because nothing reaches them.

For an asset, `npx @hypersvg/core test <folder> --min-width 320` runs the phone pass at the narrowest width it is meant for;
the touch-size and text-size rules apply there. `npx @hypersvg/core check <folder> --json` gives each finding with its
level (`error` or `warning`), its file and its line, for a tool to read. The browser pass also finds text cut off at
the drawing's edge (`T-TEXT-CLIPPED`) and a sound that never starts (`T-SOUND-SILENT`). Without Playwright the test
says `SKIPPED`; `--browser required` makes that an error, and `--json` lists what ran and what did not (`coverage`).

From a clone of the repository, the same tools are `node engine/v2/tools/check.mjs`, `test.mjs` and `pack.mjs`.
Always check before you pack. Fix every error; read every warning. A message that names a word names the right one:
copy it. The packed page opens from a file, makes no network requests and runs no code but the engine and the add-ons
`needs` names.

## 9. Where to go next

The spec is in `spec/2.0/`:

- `01-model.md`: the model in one page.
- `03-story.md`: scenes, links and endings.
- `04-blocks.md`, `05-faces-and-body.md`: blocks, values, inputs, outputs, actions.
- `06-drawing.md`: the marks in full.
- `07-representations.md`: sizes, themes, languages, text fit.
- `10-hosts-and-delivery.md`: hosts, the host API, packing, HyperSVG assets, the checker.
- `12-writing-an-addon.md` and `EXTENDING.md`: the doors.
