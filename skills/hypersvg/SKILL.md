---
name: hypersvg
description: Make HyperSVG pieces with @hypersvg/core, interactive SVG drawings whose behavior is plain JSON with no program code. Use when asked to make a drawing respond to clicks, toggles, sliders, dials or drags, to build an interactive diagram, product illustration, visual lesson, quiz or small game, or to pack one as a HyperSVG (.svg) or an Experience (.html).
---

# HyperSVG

A piece is a folder: **drawings** (SVG with `data-hsvg-*` marks on the parts that respond), **decisions** (JSON:
values, controls, reactions, bindings) and **`experience.json`** (the entry point). No program code anywhere. It packs
into a **HyperSVG** (one `.svg` for a web page) or an **Experience** (one offline `.html`).

## Workflow (always in this order)

1. **Install once and start from the starter**: `npm install @hypersvg/core`, then `npx hypersvg init <folder>`. It
   writes a working lamp. Change it; do not start from an empty folder. (Without installing, write the full name:
   `npx @hypersvg/core init <folder>`. After a local install both forms work; before it, never `npx hypersvg`:
   that name is another package.)
2. **Draw**: edit the SVG. Every part the JSON names gets an `id` and `data-hsvg-kind="part"`.
3. **Decide**: edit the scene JSON.
4. **Check**: `npx hypersvg check <folder>` until it says `0 findings`. Fix every error. A message that names a word
   names the right one: copy it.
5. **Test**: `npx hypersvg test <folder> --quick`. The Node pass presses every control ("N uses" is how many presses
   it made; it does not prove every path, such as an end screen). Clean means `0 errors`. The `T-*` findings (hit size, text size, clipped text, silent sound) and
   `--min-width` need the browser pass (Playwright, `PW_PATH`); without it, read your bindings once more for logic.
6. **Pack**: `npx hypersvg pack <folder> <out>` (Experience) and/or `npx hypersvg pack --asset <folder> <out>`
   (HyperSVG).

**Renaming the starter**: change the `id` in `experience.json` and in the scene, the scene's file name in
`story.scenes`, and the scene's `drawing` file name together, then delete the old `lamp.json` and `lamp.svg`.

## The three files, smallest form

`experience.json`:

```json
{"format": "hsvg/2.0", "kind": "experience", "id": "light", "language": "en",
 "about": {"title": "Traffic light", "description": "A light you can cycle."},
 "outputs": {"changed": {"kind": "event"}},
 "story": {"start": "main", "scenes": {"main": "main.json"}, "endless": true}}
```

`main.json` (the scene):

```json
{"format": "hsvg/2.0", "kind": "scene", "id": "main", "drawing": "main.svg",
 "values": {"light": {"type": "number", "initial": 0, "minimum": 0, "maximum": 2}},
 "controls": {"next": {"kind": "button", "target": "next", "event": "nextLight", "label": "Next light"}},
 "on": {"nextLight": [{"actions": [{"set": "light", "to": "(light + 1) % 3"}, {"emit": "changed"}]}]},
 "bindings": [
   {"target": "lamp-red",   "variant": "light === 0 ? 'on' : 'off'"},
   {"target": "walk",       "visible": "light === 1"},
   {"target": "next-words", "text": "Light {{ light + 1 }} of 3"}
 ]}
```

`main.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" data-hsvg-version="2.0" data-hsvg-kind="screen">
  <title>Traffic light</title>
  <rect x="-200" y="-200" width="800" height="1000" fill="#1d2b36" data-hsvg-layer="backdrop"/>
  <g data-hsvg-layer="content">
    <g id="lamp-red" data-hsvg-kind="part" data-hsvg-label="Red light">
      <g data-hsvg-variant="off"><circle cx="200" cy="120" r="60" fill="#4a1f1f"/></g>
      <g data-hsvg-variant="on" display="none"><circle cx="200" cy="120" r="60" fill="#e53935"/></g>
    </g>
    <g id="walk" data-hsvg-kind="part"><text x="200" y="430" text-anchor="middle" font-size="40" fill="#ffffff">Walk</text></g>
    <g id="next" data-hsvg-kind="part">
      <rect x="100" y="480" width="200" height="80" rx="40" fill="#d84315"/>
      <text id="next-words" data-hsvg-kind="part" x="200" y="530" text-anchor="middle" font-size="26" fill="#ffffff">Light 1 of 3</text>
    </g>
  </g>
</svg>
```

## Rules that the checker enforces

- **No code**: no `<script>`, no `onclick` or other event attributes, no outside addresses (`http:` images, links to
  other files). Gradients, clip paths, masks and `url(#id)` references inside the file are fine.
- **Names**: two kinds. **Value names** (values, inputs, outputs, events) are camelCase with no dashes: `pickA`,
  `nextLight`. **Ids** (parts, controls, options, clips, machines, states, scenes) are lower case with dashes:
  `lamp-red`, `pick-a`. Each at most 48 characters.
- **Formulas**: every value slot is a formula. **Text in a formula is in single quotes**: `"to": "'Done'"`,
  `"variant": "on ? 'on' : 'off'"`, `{"play": "'bell'", "as": "sound"}`. Only `text` and `label` bindings are plain
  words with `{{ formula }}` inside. Operators: `+ - * / %`, `=== !== < <= > >=`, `&& || !`, `a ? b : c`.
  Functions (the list is closed): `min max clamp floor ceil round pow sqrt exp log sin cos length at includes lookup
  append filter count sum minBy fold sort range pick shuffle random active numberText formatNumber plural`.
- **Always write** the `kind` of every control, input and output, and `axis` on `move` bindings and sliders.
- **Variants**: each direct child `<g>` of a part carries `data-hsvg-variant`; all but one have `display="none"`.
- **Numbers have bounds**: every number value and input states `minimum` and `maximum` (`E-KEY-REQUIRED`).
- **Motion**: a part moves, turns, scales or fades only on channels its `data-hsvg-motion` lists, within the
  ranges: `data-hsvg-motion="rotate -135..135; opacity 0..1"`. The channels: `move-x`, `move-y`, `rotate`, `lean`,
  `scale`, `scale-x`, `scale-y`, `opacity`, `draw`, `line`, `wipe`. Its pivot (`data-hsvg-pivot="x y"`) sits inside
  it. The checker proves each binding stays in range; when it cannot (a `%` of a changing number), wrap the formula in
  `clamp(..., min, max)`.
- **Control names**: a control is named by the single `<text>` drawn inside it. With two or more texts, or none,
  give it a `label`; add a `label` binding when the name changes (`"label": "Answer A: {{ questions[step].a }}"`).
  A `label` starts with the words drawn on the control (`W-NAME-HIDES-LABEL`): "Start: turn the blades", not
  "Begin" over a button that shows "Start".
- **Roles**: built-in role words include `action`, `next`, `back`, `close`, `answer`, `question`, `feedback`,
  `message`, `decoration` and `icon`. Other plain words (`wheel`, `lamp`) are listed in `experience.json`:
  `"roles": {"wheel": {"appliesTo": ["part"]}}`, or the checker warns. An element with a role (or any other job)
  also carries `data-hsvg-kind="part"` (`W-KIND-MISSING`).
- **Colours**: a theme colour goes through `data-hsvg-color="accent"` and a `color` binding (default `as` `marked`).
  `color` with `as` `fill` or `stroke` takes `#rrggbb`, never a role name.
- **Values and inputs.** `values` holds a block's own state, in the scene (private to it) or in `experience.json`
  (shared by every scene, and the only values an experience output can read). `inputs` (`knob`, `content`,
  `trigger`) are what a page may set. A control may write a knob directly with `"value": "<knob>"`, but a `set`
  action never writes an input (`E-WRITE-INPUT`): declare a value and write that.
- **Hit areas**: at 390 px phone width every control needs 44 px. Draw buttons large. Decoration drawn over a control
  can carry `pointer-events="none"`.

## The words, in one line each

**Controls** (`kind`, plus `target`, `event`, `label`, `enabled` as a yes-or-no formula): `button`, `toggle` (writes
a boolean `value`), `choice` (`options`, writes `value`), `slider` (`axis`, `range` = the handle's travel in drawing
units; the value's `minimum` and `maximum` map onto it; `positions` to snap; bind the handle with
`{"target": "handle", "move": "speed", "axis": "x"}` so it shows the value), `dial` (`range` = degrees of turn such
as `[-135, 135]`; the value's `minimum` and `maximum` map onto it; `positions` to snap; bind `rotate` to the value so
the part shows it), `drag` (`drops`,
`accept`, `event`). When you hide a control with a `visible` binding, give it `"enabled"` with the same yes-or-no formula.
**Actions**: `set` (`to`), `if` (`then`, `else`), `emit` (an event; `as` record or trigger), `play` (a clip; `as`
sound), `stop`, `open`, `close` (a dialog), `call` (`player.setting`, `player.attach`, `player.openUrl`,
`player.resetSaved`). **Bindings**: `text` (with `fit` to wrap in a box), `label`, `visible`, `variant`, `color`,
`move` (`axis` x, y or route), `rotate`, `scale`, `opacity`, `draw` (a share 0 to 1). **Structure**: reactions (in
`on`, with an optional `guard`; `"changed:<name>"` runs when a value or input changes, also when a page sets an
input), `entry` (actions run when the block starts), `machines` (states, `after` timers, `active('state')`; an event transition has an
`id`), `clips` (`tracks` of `[ms, value]` keys; `play` it), story `links` (between scenes), `uses` (a block in a slot).

**Marks**: `data-hsvg-version` (root), `-kind` (`part`, `screen`, `component`), `-role`, `-label`, `-pivot`,
`-motion`, `-follow`, `-variant`, `-color`, `-text-style`, `-layer` (`backdrop`, `content`, `overlay`,
`decoration`), `-slot`, `-fit` (a box text wraps in), `-repeat`, `-route`.

## Patterns

- **On and off**: a `toggle` writing a boolean, and a `variant` binding `"x ? 'on' : 'off'"`.
- **Cycle through states**: a number value with `minimum` and `maximum`, a `button`, and
  `{"set": "n", "to": "(n + 1) % 3"}`. Or a `machine` with states and event transitions (each with an `id`).
- **Show only when**: a `visible` binding with a yes-or-no formula.
- **A dial or knob**: `"controls": {"temp": {"kind": "dial", "target": "knob", "value": "temperature", "range":
  [-135, 135], "positions": 21, "label": "Temperature", "valueText": "{{ temperature }} °C"}}`, a binding
  `{"target": "knob", "rotate": "(temperature - 10) / 20 * 270 - 135"}`, and on the part
  `data-hsvg-pivot` at its centre and `data-hsvg-motion="rotate -135..135"`.
- **Animate**: a clip in `clips`, started by `{"play": "<clip>"}`; the part lists the channel in `data-hsvg-motion`.
- **Speed that follows a value**: a clip's `speed` is read once, at `play`. For blades that turn as fast as a slider
  says, bind `rotate` to the clock `elapsed` (milliseconds) and keep the angle smooth when the speed changes. Number
  values `speed`, `rate` (0 to 2 turns a second), `phase` (0 to 360) and `since` (0 to 1000000000000), then:

  ```json
  "on": {"changed:speed": [{"actions": [
    {"set": "phase", "to": "(phase + (elapsed - since) * rate * 0.36) % 360"},
    {"set": "since", "to": "elapsed"}, {"set": "rate", "to": "speed"}]}]},
  "bindings": [{"target": "blades", "rotate": "clamp((phase + (elapsed - since) * rate * 0.36) % 360, 0, 360)"}]
  ```

  The blades part has `data-hsvg-pivot` at the hub and `data-hsvg-motion="rotate 0..360"`.
- **Timed steps**: a machine whose states use `after: [{"delayMs": 800, "target": "next"}]`.
- **A sound**: `"audioSynths": {"click": {"wave": "sine", "from": 880, "to": 660, "durationMs": 90, "gain": 0.4}}`
  in `experience.json`, then `{"play": "'click'", "as": "sound"}`. Sound is never the only signal.
- **Content as data** (a quiz, steps): one array value, and formulas that read it.

  ```json
  "questions": {"type": "array", "maxItems": 10,
    "items": {"type": "object", "properties": {"q": {"type": "string", "maxLength": 80},
      "a": {"type": "string", "maxLength": 30}, "right": {"type": "string", "maxLength": 1}},
      "required": ["q", "a", "right"], "additionalProperties": false},
    "initial": [{"q": "Which planet is largest?", "a": "Jupiter", "right": "a"}]},
  "step": {"type": "number", "initial": 0, "minimum": 0, "maximum": 10},
  "picked": {"type": "string", "initial": "", "maxLength": 1},
  "score": {"type": "number", "initial": 0, "minimum": 0, "maximum": 10}
  ```

  `step` may reach `length(questions)`, which is the score screen, so its `maximum` equals `maxItems`. Read the
  current row safely with `questions[min(step, length(questions) - 1)].q`. Branch with `if`, or guard a reaction:

  ```json
  "pickA": [{"actions": [{"set": "picked", "to": "'a'"},
    {"if": "questions[step].right === 'a'", "then": [{"set": "score", "to": "score + 1"}]}]}],
  "next": [{"guard": "picked !== ''", "actions": [{"set": "step", "to": "step + 1"}, {"set": "picked", "to": "''"}]}]
  ```
- **Long text**: a `text` binding with `"fit": {"box": "q-box", "minFontPx": 16, "maxLines": 3}`, and a box part in
  the drawing: `<rect id="q-box" data-hsvg-kind="part" data-hsvg-fit="" x="40" y="80" width="320" height="90"
  fill="none"/>`. Draw a short placeholder text, since a still picture shows the drawn text.
- **More scenes**: add scenes to `story.scenes` and `links` that fire on an event (`GUIDE.md` section 5).

## Common findings and their fixes

| Finding | Fix |
|---|---|
| `E-FORMULA` ... unknown name | Text without quotes: write `'words'` in single quotes |
| `E-REF-UNKNOWN` | A name that does not exist: check the id in the SVG, the value name, the clip name |
| `E-TYPE` not a camelCase name | A value or event name: rename it `likeThis`, no dashes |
| `E-TYPE` on a colour | Use a theme role with `as` `marked`, or `#rrggbb` with `fill`/`stroke` |
| `E-KEY-REQUIRED` | Add the missing key, often `kind`, `axis`, or a number's `maximum` |
| `E-MOTION-RANGE` ... not proven | Wrap the binding's formula in `clamp(..., min, max)` |
| `W-NAME-HIDES-LABEL` | Start the `label` with the words drawn on the control |
| `W-KIND-MISSING` | Add `data-hsvg-kind="part"` to the element |
| `W-CONTROL-STILL` | Add the binding the message gives, so the handle shows its value |
| `E-WRITE-INPUT` | A `set` wrote an input: declare a value under `values` and write that instead |
| `E-MOTION-RANGE` | Add the channel and range to the part's `data-hsvg-motion` |
| `E-A11Y-NAME` | One `<text>` inside the control, or a `label` |
| `E-SVG-UNSAFE` | Remove the script, event attribute or outside address |
| `E-WORD-RENAMED` | Use the word the message names |
| `W-ROLE-UNKNOWN` | List the role in `experience.json` `roles` |
| `T-HIT-SMALL`, `T-TEXT-SMALL` | Draw controls and text larger (44 px hit area at phone width) |
| `T-TEXT-CLIPPED` | Keep text inside the drawing's `viewBox`, or wrap it with `fit` |

## Which output

- **HyperSVG** (`pack --asset`): goes inside a web page. A still picture in an `<img>`; live after one script line,
  with each attribute setting the input of the same name:

  ```html
  <script type="module" src="https://cdn.jsdelivr.net/npm/@hypersvg/core@2.0.0-next.0/engine/v2/web/asset-web.mjs"></script>
  <hypersvg-asset src="thermostat.svg" temperature="12"><img src="thermostat.svg" alt="A thermostat"></hypersvg-asset>
  ```

  Serve the page over http or https. Text only: no sound files, pictures, fonts or add-ons (made sounds are fine).
- **Experience** (`pack`): one `.html` a person opens on its own, offline. Holds everything.

Read `GUIDE.md` (in the package) for every word and mark with an example, and `docs/guide/examples/` for working
folders.
