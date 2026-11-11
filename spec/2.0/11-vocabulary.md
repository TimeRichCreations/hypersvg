# 11. Vocabulary

One word, one meaning. Section authors use these words exactly. Where an earlier spec used a word differently, the
rename table of the upgrade tool (A13.4) gives the new word. Earlier files are converted by the upgrade tool (A13),
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
| **behaviour** | Reactions (to events), machines (state machines), actions (one operation each), clips (motion over time), bindings (values to the drawing) and effects (running motion recipes, such as a spring). | 5.12 to 5.16 |
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
**chapter** (3.7, 3.4, 3.12); **axis**, **selector**, **tier**, **shape**, **size**, **design scale** (7); **text
slot**, **formula slot** (5.6.1); **transaction**, **source** (9.2); **package** (10.8); **preset**, **logic module**,
**capability** (12). Words of the tool reference (receipt, rule pack, waiver, seal, digest, signature, editor rights,
host profile) and of the add-ons (seat, page hook, spoken line, effect, layout plan) are defined on their own pages.

## 11.2 Retired words

These words are not used in the spec, except as quoted from an earlier file: **look** as the name of a part's drawn
alternative (now **variant**), **state** (alone; **machine state** is kept), **zone**, **area** (alone; **protected area** is kept), **cast**, **unit**,
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
  address of a thing inside documents (`stop-harbour/robin`); the action list run on leaving a scene or machine state (`openUrl` leaves for a web address).
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
