# 11. Vocabulary

One word, one meaning. Section authors use these words exactly. Where an earlier draft of 2.0 used a word
differently, 11.5 gives the new word; for `hsvg/0.1` and older drafts, the rename table of the upgrade tool (A13.4). Earlier files are converted by the upgrade tool (A13),
never read by the player.

## 11.1 Core words

| Word | Meaning | Section |
|---|---|---|
| **block** | Anything with four faces and a body: a component, scene, shell or experience. | 1.3 |
| **rung** | One level of the ladder, smallest first: element, part, component, scene, shell, experience. Elements and parts are pieces of drawings; the other rungs are blocks. | 1.2 |
| **element** | Plain SVG inside a part. | 1.2, 6 |
| **part** | A named piece of one drawing that does something. | 1.6, 6.2 |
| **component** | A reusable block with its own drawing and its own JSON document. | 1.2, 4.4 |
| **scene** | One moment of an experience: a node of its story graph. | 1.2, 3.1 |
| **frame** | One drawing of a block at one size or shape: a component drawing or a screen drawing. | 1.2, 6.6, 7.3 |
| **layer** | A `<g>` with `data-hsvg-layer` (content, backdrop, overlay, decoration): the job it does in the picture. Layers nest and stack in document order. | 6.4 |
| **shell** | The screen around scenes: a master drawing with slots. | 10.1 |
| **experience** | Scenes linked in a story graph. | 1.2, 3 |
| **kit** | A versioned set of block definitions, themes and resources; an experience made from it pins its version. | 4, A14 |
| **add-on** | Anything beyond the core, through the one door: a preset, a logic module or a capability. A built-in add-on is called a capability in the registries. | 10.7, 12 |
| **door** | `needs`, the `addons` pocket and `call`: the one way an add-on reaches content. | 10.7, 12 |
| **host** | Where an experience runs (a page, an ad placement, an app). It gives the experience its grants. | 10.4 |
| **places** | The drawn places of a block: slots (attach points too), fit boxes, repeats, protected areas, routes. | 1.4, 1.7, 5.10 |
| **inputs** | The face: content fields, triggers, knobs. | 1.4, 5.3 |
| **rules** | The face: invariants the checker proves (A11). | 1.4, 8 |
| **outputs** | The face: typed events, results and records. | 1.4, 5.4, 5.12 |
| **body** | A block's inside: values and behaviour. | 1.5 |
| **value** | Named, typed, bounded data with a lifetime. | 5.1 |
| **behaviour** | Reactions (to events), machines (state machines), actions (one operation each), clips (motion over time) and bindings (values to the drawing). Running effects are an add-on (10.7). | 5.12 to 5.16 |
| **role** | A part's or component's job in words, from the role registry. Not a colour role. | 6.3 |
| **variant** | A drawn alternative of a part (`data-hsvg-variant`; earlier called a look). | 6.2.4, 7.1 |
| **layout** | One placement of the same parts for a shape or size, at any rung. | 7.4 |
| **representation** | One way a block is shown, defined by what changes (an axis) and who picks it (a selector). | 1.10, 7 |
| **link** | A story-graph edge that fires on an event, on time or on a choice. | 3.2 |
| **lifetime** | How long a value lasts: `moment` (while its owner is active), `run` (until the experience closes or restarts), `session` (until the browser session ends), `saved` (across runs). | 5.1.2 |
| **grant** | What a host allows an experience, or a container allows a use, across a trust boundary; closed by default. | 10.5 |
| **partition** | An opaque name the host gives at mount that separates stored values, such as a learner or a signed-in account; `device` when none is given. | 5.1.2, 10.6 |
| **resource** | A font, image, sound, video, captions file, icon set or data file, with hash and licence. | 2.6 |
| **theme** | A kit-level bundle of colour roles, type, spacing, shapes and easing. | 7.7 |
| **about** | A document's title and description; its other fields are records for tools. | 2.5 |

Other defined words: **component drawing**, **screen drawing** (4.1); **layer** (6.4); **job group** (6.3);
**control** (5.11); **pinned name**, **path** (2.9); **content field**, **knob**, **setting**, **trigger** (5.3);
**reaction**, **machine**, **machine state**, **action**, **record**, **exit** (5.13 to 5.16); **clip**, **binding**
(6.7, 6.8); **slot**, **fit box**, **repeat**, **protected area**, **route** (1.7, 5.10); **visit**, **timed link**,
**chapter** (3.7, 3.4, 3.12); **axis**, **selector**, **tier**, **shape**, **size**, **design scale** (7); **formula
slot**, **template slot**, **literal slot** (5.6.1); **transaction**, **source** (9.2); **package** (10.8); **preset**, **logic module**,
**capability** (12). Words of the tool reference (receipt, rule pack, waiver, seal, digest, signature, editor rights,
host profile) and of the add-ons (seat, page hook, spoken line, effect, layout plan) are defined on their own pages.

## 11.2 Retired words

These words are not used in the spec, except as quoted from an earlier file: **look** as the name of a part's drawn
alternative (now **variant**), **press** and **option** as control kinds (now **button** and **choice**), **paint**
as a mark (now **layer**), **region** (now **fit box**, except SVG's filter region and ARIA's region), **safe area** (now
**protected area**), **compound** (now a **component** that holds components), **smart SVG** (now **HyperSVG**), **state** (alone; **machine state** is kept), **zone**, **area** (alone; **protected area** is kept), **cast**, **unit**,
**mode** (as a core word), **group** (except SVG `<g>`, a settings group, **job group** and an audio group),
**master** (except the shell's master drawing and the master volume and mute), **rules kit**, **family package**.

## 11.3 Look-alikes that are not duplicates

- **attach**, **follow** and nesting: attaching puts a use on a slot; follow makes a part move with another;
  nesting is a block inside a block.
- **scene** and **variant**: a website mascot's moment (idle, greet, point) is a scene of the mascot experience; a
  drawn alternative of one part (a mouth open or closed) is a variant.
- **layout**, **variant** and **tier**: the same parts laid out differently; a part drawn differently;
  shorter or longer words. When upgrading an earlier file's "variant" or "look", ask which of the three changed.
- **frame** and **layout**: a layout names a placement for a shape or size; its frame is the drawing
  that shows it.
- **grant** and **add-on**: a grant lets an experience cross a trust boundary while it runs; an add-on is an ability
  the experience needs: a module or capability named in `needs`, a preset named in `presets`.
- **preset of the door** (12.3) and **product label** (`about.preset`, A14.4): content a preset expands into, versus a
  word that labels a product.
- **link**, **route**, **path**, **exit**: a story-graph edge between scenes; a drawn line things move along; an
  address of a thing inside documents (`stop-harbour/robin`); the action list run on leaving a scene or machine state (`player.openUrl` leaves for a web address).
- **shape** (the axis of 7.2, such as `wide`) and the theme's **outline** (a control's corners and border, 7.7).

## 11.4 Defaults

Every word outside the learn-first set has a default, so leaving it out is safe (D29). Most defaults are stated where
the word is defined. This table adds the ones only the engine knew, and the ones D29 proposes. **engine**: the engine
does this today. **proposed**: the default the format takes (D29); until the engine takes it, leaving the word out is
still refused.

| Word | Where | Default | Status |
|---|---|---|---|
| `accept` | drag control | every drop in `drops` is accepted | engine |
| `drops` | drag control | none: every release is a miss, and the item goes home | engine |
| `missEvent` | drag control | nothing is queued on a refused or missed drop | engine |
| `picked` | drag control | no value tracks the pick-up | engine |
| `held` | button, toggle, slider, dial | no value tracks the hold | engine |
| `axis` | slider | `x` | engine |
| `range` | slider | `[0, 1]` today; proposed: the target's drawn motion range on `axis` | engine, proposed |
| `label` | control | the target's `data-hsvg-label`, else the text of its only `<text>` (6.5) | engine |
| `disabledLabel` | control | the control keeps its label and is announced as unavailable | engine |
| `range` | `draw` binding as `points` | x: the item indexes; y: 0..1 | engine |
| `fit` | `text` binding | today none (the text is written as is); proposed: fit to the drawn text's box | engine, proposed |
| `slideFrom` | link, chapter | `end` | engine |
| `back` | chapter | no Back links | engine |
| `before` | chapter | Back from the first present step does nothing | engine |
| `after` | ordered chapter | Next from the last present step does nothing | proposed |
| `transitionMs` | link, chapter with `fade` or `slide` | the active theme's motion `durationMs`, else 300 | proposed |
| `use` | object form of a story scene | the scene's own key (`"quiz": {"with": {...}}` uses `quiz`) | proposed |
| `value` | an option of a choice | the option's id | proposed |
| `then` | `if` | `[]` | proposed |
| `maxLength` | string type | the longest `enum` member, else 1024 | proposed |
| `maxItems` | array type | 1024 | proposed |
| `required` | object type | every property | proposed |
| `additionalProperties` | object type | `false`, its only value | proposed |
| `box` | a text fit | the target text's drawn box in each frame | proposed |
| `minFontPx` | a text fit | the readable floor at the output size | proposed |
| `area` | `draw` binding as `points` | the target polyline's drawn bounding box | proposed |
| `eachMs`, `targets` | a track's `stagger` | 0, `[]` | proposed |
| `atMs` | a clip marker | 0 | proposed |

**Words that define their parent** have no useful default and stay required inside it: `items` and `properties` (they
are part of saying an array's or object's type), a choice's `options`, `scene` in a chapter step's object
form. Leaving out the parent is safe.

## 11.5 Renamed words

These words changed while 2.0 was drafted (D28 to D38). The player reads only the new words. The checker finds an old
word and names the new form (`E-WORD-RENAMED`, 5.11, 5.15.1, 6.7, 6.8; a drawing's old mark or channel, 6.1). Words of
`hsvg/0.1` and earlier drafts are in the rename table of the upgrade tool (A13.4). `renames.json` holds both tables,
with the same row ids.

| Row | Old | New | Where |
|---|---|---|---|
| R-01 | `"kind": "press"` | `"kind": "button"` | control (5.11) |
| R-02 | `"kind": "press"` with `checked` | `"kind": "toggle"`; `checked` becomes its `value` | control (5.11) |
| R-03 | `"kind": "option"` | `"kind": "choice"` | control (5.11) |
| R-04 | `"kind": "slider"` with `"axis": "angle"` | `"kind": "dial"`, with no `axis` | control (5.11) |
| R-05 | `add` (with `by`) | `{"set": "n", "to": "n + 1"}` | action (5.15.1) |
| R-06 | `toggle` | `{"set": "on", "to": "!on"}` | action (5.15.1) |
| R-07 | `trigger` | `emit` with `"as": "trigger"` | action (5.15.1) |
| R-08 | `record` | `emit` with `"as": "record"` | action (5.15.1) |
| R-09 | `sound` | `play` with `"as": "sound"`; the sound's name is a formula (`"'bell'"`) | action (5.15.1) |
| R-10 | `gain` | `volume` | `play` as a sound (5.15.1) |
| R-11 | `openUrl` | `{"call": "player.openUrl", "with": {"field": ...}}` | action (5.15.3, 5.15.4) |
| R-12 | `setting` | `{"call": "player.setting", "with": {...}}` | action (5.15.3, 5.15.4) |
| R-13 | `resetSaved` | `{"call": "player.resetSaved"}` (`"with": {"settings": true}` for the settings) | action (5.15.3, 5.15.4) |
| R-14 | `attach` | `{"call": "player.attach", "with": {"part": ..., "to": ...}}` | action (5.15.3) |
| R-15 | `detach` | `player.attach` with `"to": "null"` | action (5.15.3) |
| R-16 | `{"channel": <name>, "value": <formula>}` | the word is the key: `{"move": <formula>, "axis": "x"}` | binding (6.8) |
| R-17 | channel `translate-x`, `translate-y`, `route` | `move` with `axis` `x`, `y` or `route` | binding (6.8), track (6.7) |
| R-18 | channel `skew` | `rotate` with `as` `lean` | binding (6.8), track (6.7) |
| R-19 | channel `scale-x`, `scale-y` | `scale` with `axis` `x` or `y` | binding (6.8), track (6.7) |
| R-20 | channel `stroke-width` | `scale` with `as` `line` | binding (6.8), track (6.7) |
| R-21 | channel `fill`, `stroke` | `color` with `as` `fill` or `stroke` | binding (6.8), track (6.7) |
| R-22 | channel `dash` | `draw` | binding (6.8), track (6.7) |
| R-23 | channel `wipe` | `draw` with `as` `wipe` | binding (6.8), track (6.7) |
| R-24 | channel or binding key `look` | `variant` | binding (6.8), track (6.7) |
| R-25 | channel `morph` | `motion.morph`, a value of the motion add-on | binding (6.8), track (6.7) |
| R-26 | binding key `picture` | `variant` with `as` `picture` | binding (6.8) |
| R-27 | binding key `icon` | `variant` with `as` `icon` | binding (6.8) |
| R-28 | binding key `size` | `scale` with `as` `box` | binding (6.8) |
| R-29 | binding key `points` | `draw` with `as` `points` | binding (6.8) |
| R-30 | binding key `face` | `scale` on `axis` `x`: `-1` faces left, `1` faces right | binding (6.8) |
| R-31 | `label` beside another word in one binding | `label` as its own binding | binding (6.8) |
| R-32 | `region` in a text's `fit` or a layout's `fit.<id>` | `box` | text fit (7.6), layout (7.4) |
| R-33 | a bare text or `{{ }}` in a value slot: `"to": "Fox at dawn"`, `"with": {"title": "{{ cta }}"}` | a formula, text in single quotes: `"to": "'Fox at dawn'"`, `"with": {"title": "cta"}` | formula slot (5.6.1) |
| R-34 | `data-hsvg-follows` | `data-hsvg-follow` | mark (6.1) |
| R-35 | `data-hsvg-look` | `data-hsvg-variant` | mark (6.1, 6.2.4) |
| R-36 | `data-hsvg-color-role` | `data-hsvg-color` (same values) | mark (6.1, 6.2.3) |
| R-37 | `data-hsvg-type-role` `display`, `text` | `data-hsvg-text-style` `heading`, `body` (and `caption`) | mark (6.1), theme (7.7) |
| R-38 | `data-hsvg-paint` | `data-hsvg-layer` (same values, plus `decoration`) | mark (6.1, 6.4) |
| R-39 | `data-hsvg-region="fit"` | `data-hsvg-fit` (no value, or `text`) | mark (6.1, 5.10) |
| R-40 | `data-hsvg-region="layout-plan"` | `data-hsvg-fit="items"` | mark (6.1) |
| R-41 | `data-hsvg-region="video"` | `data-hsvg-fit="video"` | mark (6.1) |
| R-42 | `data-hsvg-region="repeat"` | `data-hsvg-repeat` | mark (6.1, 5.10) |
| R-43 | `data-hsvg-side="left"` | a role word: `data-hsvg-role="hand left"` | mark (6.1, 6.3) |
| R-44 | `data-hsvg-safe-area="keep-clear"` | `data-hsvg-role="keep-clear"` on an unpainted `<rect>` | mark (6.1, 5.10) |
| R-45 | `data-hsvg-icon` | `<symbol id="clock" data-hsvg-role="icon">`, named by its id; an icon place is a part with role `icon` | mark (6.1) |
| R-46 | `data-hsvg-anchor="x y"` | an empty `<g data-hsvg-slot="<name>">` at the point | mark (6.1, 6.9) |
| R-47 | `data-hsvg-derived`, `data-hsvg-steps` on the root | the tool record: one JSON object in `<metadata>` | mark (6.1) |
| R-48 | `data-hsvg-kind="compound"` | `data-hsvg-kind="component"` | mark (4.1, 6.1) |
| R-49 | `data-hsvg-fit` written by the player on a fitted text | `data-hsvg-fitted` | player (7.6) |
| R-50 | motion channel `translate-x`, `translate-y` | `move-x`, `move-y` | `data-hsvg-motion` (6.2.1) |
| R-51 | motion channel `translate` (both axes) | `move-x` and `move-y`, each with its range | `data-hsvg-motion` (6.2.1) |
| R-52 | motion channel `skew` | `lean` | `data-hsvg-motion` (6.2.1) |
| R-53 | motion channel `dash` | `draw` | `data-hsvg-motion` (6.2.1) |
| R-54 | motion channel `stroke-width` | `line` | `data-hsvg-motion` (6.2.1) |
| R-55 | motion ranges `scale(1 1.2) rotate(-6 6)`, `rotate(*)` | `scale 1..1.2; rotate -6..6`, `rotate *` | `data-hsvg-motion` (6.2.1) |
| R-56 | text styles `display`, `text` | `heading`, `body` (the theme key stays `typeRoles`) | theme (7.7) |
| R-57 | place kinds `region`, `anchor`, `safe-area` | `fit`, `slot`, `keep` | a block's `places` (5.10) |
| R-58 | capability `shell`; `uses[].declared`; the experience's `settings` for widgets | the add-on `widgets`; `addons.widgets.settings` (`slots` and `hideSlots` are core) | add-on (10.7) |
| R-59 | a built-in capability's block (`physics`, `effects`, `lines`, `page`, `play`) and its actions (`physicsThrow`, `say`, `mediaPlay` and the rest) | `addons.<name>` and calls `<name>.<verb>`; events `<name>:<event>` | add-on (10.7, 12) |
| R-60 | a link's `afterLine` | `"on": "lines:ended:<line>"`, an event of the `lines` add-on | link (3.2) |
| R-61 | page marks `data-hsvg-target`, `-spot`, `-grab`, `-action` | `data-hsvg-hook` on host pages, an add-on word | add-on (10.7) |
| R-62 | manifest `channels` | `writes` (the older form is still read) | add-on manifest (12) |
| R-63 | smart SVG | HyperSVG: the `.svg` output (`pack --asset`) | output (2.13, 10.14) |
| R-64 | the packed page | an Experience: the `.html` output | output (10.8, 10.14) |
