# 4. Blocks

A **block** is anything with four faces and a body (1.3). This section says how blocks are written and reused: the
drawing kinds, the block documents and their keys, uses, the component document and repeated uses.

## 4.1 Drawing kinds

`data-hsvg-kind` names a drawing's rungs. The list is closed: `part`, `component`, `screen`. Any other value is an
error. `E-KIND` (files). `compound` is gone: components arranged as one are one component.
`data-hsvg-kind="compound"` is refused with the fix (write `data-hsvg-kind="component"`; its top-level parts are
its members, as before), and the upgrade tool rewrites it.

| Kind | On | Meaning |
|---|---|---|
| (none) | any SVG element | An **element**: plain SVG inside a part. It needs no name. |
| `part` | an element or `<g>` inside a component or a screen drawing | A named piece that does something (6.2). Parts nest; a child moves with its parent. |
| `component` | the top-level `<g>` of a component drawing, or a `<g>` in a screen drawing | One object placed, moved and edited as a whole. In a screen drawing it is defined where it stands and is not reusable; its root may be the target of a control, binding, clip or follow, like a part. A component may hold several objects arranged as one (a price chip and a badge): each is drawn in place as a top-level part, its group carrying its role (a part inside keeps its own role, A13.5); where its source is recorded, `parts` in the JSON names it (4.4). A member that must stay a live, separately versioned component is a slot and a use instead. |
| `screen` | the root `<svg>` of a screen drawing | A scene or shell at one size or shape. |

- A `component` never sits inside another `component` in the same file. A component
  inside another is a use: a slot in the drawing and a use in the JSON (section 2). `E-KIND` (files).
- A **placed copy** is a nested `<svg>` that holds a whole component drawing inside a screen drawing, as earlier ad
  layouts did. It is allowed in import files and in exports. It is a copy, not a use: its ids carry its own namespace
  (2.12), and the no-copy rule (A11.1) reports it when a use would do (files).
- **A variant is not a part.** A direct child `<g>` that carries `data-hsvg-variant` is a variant of its parent part (6.2.4); it
  needs no id and no kind of its own.
- **Every element that carries a job mark is a part.** The job marks are `data-hsvg-pivot` (except on a component root), `-motion`, `-follow`, `-slot`, `-fit`, `-repeat` and `-route`,
  and being the target of a binding, clip or control. A colour role alone is a paint mark, not a job: an
  element that only takes the theme's colour needs no kind; one that a `color` binding targets is a part. Writers write `data-hsvg-kind="part"` on it. A reader that
  finds a job without the kind treats the element as a part and warns, and so does a reader that finds
  `data-hsvg-role`, `-side`, `-label` or `-type-role` on an element without a kind. A part without an id is
  `E-ID-SHAPE`. `W-KIND-MISSING` (files).

## 4.2 Block documents

Experience, scene, shell and component documents are **block documents**. Their top-level keys come
from the faces (1.4), the body (1.5) and the block properties (1.3). Each key is defined once.
`documents.json` beside the spec lists, for each document kind, every key it allows, its type, whether it is
required and the section that defines it; the checker reads it (`E-KEY-UNKNOWN`, `E-KEY-REQUIRED`). The keys by group:

| Group | Keys | Sections |
|---|---|---|
| Header and description | `format`, `kind`, `id`, `about` (its `title` and `description`) | 2.2, 2.5 |
| The faces | `inputs`, `outputs` | 5.3, 5.4 |
| The body | `values`, `computed`; behaviour: `on`, `entry`, `exit`, `machines`, `clips`, `bindings`, `controls` | 5, 6 |
| Drawing and representations | `drawing`, `layouts`, `axes`, `theme`, `themes` | 6, 7 |
| Composition | `uses`, `blocks` | 4.3 |
| The experience | `story`, `shell`, `with`, `audio`, `audioSynths`, `grants` | 3, 4.3, 6.10, 10 |
| Scenes and shells | `slots`, `hideSlots`, `clock`, `firstFocus`, `music` | 3, 10.1, 6.10 |
| Files | `resources`, `language`, `data` | 2.6 to 2.8 |
| The door | `needs`, `presets`, `addons` (and the `call` action, 5.15.3) | 10.11, 12 |

- **Tool reference keys.** A file may also carry keys that tools read and the player ignores or the packer
  flattens: `$schema`, the `about` records (`trust`, `version`, `license` and the rest), `kit`, `picks`, `parts`,
  `places`, `promote`, `seal`, `rights`, `roles`, `rules`, `rulePacks`, `waivers`, `saveStamp` and `limits`. They are
  defined in the tool reference (`reference/`). A first experience needs none of them.
- **Add-on keys** live in the `addons` pocket, never at the top level (10.7, chapter 12).
- A scene, shell or component has a `drawing`, `layouts`, or both. A layout without its own `drawing`
  lays out the block's `drawing` with its plan (7.4), so a block with such a layout needs a `drawing`; a block
  whose layouts are all drawn has none of its own. An experience has neither. A key that
  is not allowed beside another is `E-KEY-CONFLICT`; a missing required key is `E-KEY-REQUIRED` (files).
- An experience's behaviour lives in its scenes and its shell; the experience document holds values and the graph,
  not reactions.
- A **kit experience** is an experience with a `kit` pin ("Kits and templates", below). Its scenes and its shell are
  uses of kit definitions, filled through `with`. It never carries `values`, `computed`, behaviour keys, `blocks`,
  `drawing` or `layouts` (`E-KIT-BODY`); the keys it may carry are listed in the tool reference (A14.2). (files)

Robin's harbour stop as a scene document (its wide frame is the example in 6.6):

```json
{
  "format": "hsvg/2.0",
  "kind": "scene",
  "id": "stop-harbour",
  "about": {"title": "Harbour Row"},
  "layouts": [
    {"id": "wide", "shape": "wide", "drawing": "stop-harbour.svg"},
    {"id": "tall", "shape": "tall", "drawing": "stop-harbour.phone.svg"}
  ],
  "uses": [{"id": "robin", "use": "robin-hero", "into": "robin", "with": {"walking": "false"}}],
  "values": {"delivered": {"type": "boolean", "initial": false}},
  "outputs": {"onward": {"kind": "event"}},
  "controls": {
    "onward": {"kind": "button", "target": "onward", "event": "onward", "enabled": "delivered",
               "label": "{{ words.onward }}", "disabledLabel": "{{ words.deliverFirst }}"}
  },
  "bindings": [
    {"id": "caption-text", "target": "caption", "text": "{{ words.harbourWaiting }}", "fit": {"box": "caption-box", "minFontPx": 22, "maxLines": 2}}
  ],
  "rules": [{"id": "bruno-visible", "kind": "clear", "subject": "place:bruno-face", "of": ["controls"]}],
  "resources": {
    "harbour-words-en": {"kind": "words", "file": "words/en.csv", "language": "en", "digest": "sha256:2b7e90c1…"}
  }
}
```

## 4.3 Uses and places

A **use** mounts a definition in a place and supplies its inputs. Uses are a list, because their order breaks ties
on the clock (3.10). Section 4.5 adds `items` and `key` for a repeated use.

```json
"uses": [
  {"id": "robin", "use": "robin-hero", "into": "robin", "with": {"walking": "speed > 0"}},
  {"id": "parcel", "use": "parcel", "into": "parcel-spot"},
  {"id": "answers", "use": "answer-card", "into": "answer-slots", "items": "question.choices", "key": "item.id",
   "with": {"label": "{{ item.label }}", "chosen": "picked === item.id"}}
]
```

| Key | Meaning |
|---|---|
| `id` | The use's id, unique among the document's uses, never equal to one of its value names (2.9). |
| `use` | The definition: an id in the experience's `blocks`, or in the pinned kit's `blocks`. |
| `into` | An id: a slot name in this block's drawing, a repeat (`data-hsvg-repeat`) for a repeated use (5.10), or an `items` fit box (the `fit` add-on). An `into` drawn in no frame is `E-REF-UNKNOWN`; drawn in some frames only, `E-LAYOUT-MISSING`. |
| `with` | Input name to formula (5.3). |
| `items`, `key` | A repeated use (4.5). |
| `clock` | The use's local clock (3.10). |
| `grants` | Grants passed down by name (10.5). |
| `layout` | This block's layout id to the used block's layout id: in those layouts the use shows that one instead of choosing by its own `when` (7.4). |

- **Resolution.** `use` resolves in the experience's `blocks`, then in the pinned kit's `blocks`; a kit definition
  resolves in its own kit. A name defined in both is refused, so no definition hides another. `E-REF-UNKNOWN`,
  `E-NAME-SHADOW` (files).
- **Definitions** an experience brings are listed in `blocks`, id to file:
  `"blocks": {"robin-hero": "components/robin-hero/component.json", "parcel": "components/parcel/component.json"}`. A kit lists
  its own the same way (A14.1). Each key equals the id of the document it names. Scenes are listed in the story graph
  (3.1), not in `blocks`; a scene definition that several scenes use (3.1) is listed in `blocks`.
- A use never targets the inside of another use. It reaches a used block only through that block's faces: its
  inputs, outputs and the places it exposes (section 4). `E-SEAL` (files).
- Recursive definitions and mounting cycles are refused. `E-CYCLE` (files).

**The places face.** `places` maps a place name to its kind, named as its mark: `slot` (an attach point too, 6.9), `fit`, `repeat`, `keep`
(a protected area), `route` or `part`.

```json
"places": {"basket-point": {"kind": "slot"}, "badge-mount": {"kind": "slot"}}
```

- In a block with a drawing, `places` lists the drawn places its containers may use: attach to (`bike.basket`), mount
  into, lay out or cover. The name is the place's local id (a slot's name for a slot), and its kind matches its mark
  in every drawing of the block. Places not listed are private. Listing a place exposes it; its kind is checked
  against the mark, so `places` is not a second statement of a drawing fact.
  `E-PLACE`, `E-SEAL` (files).

## 4.4 The component document

A component is one JSON file beside its drawing, in its own folder. Its sections are the keys of 4.2: the four face
keys, the body (`values`, `computed`, behaviour, `controls`), `parts` and `about`. A fit is written on the text
binding that needs it (7.6), and measured fit values go to evidence (A8.1): there is no separate fit section.

An ad button, sealed, from an ad kit. Its drawing is the example in 6.2.2.

```json
{
  "format": "hsvg/2.0",
  "kind": "component",
  "id": "amber-signal-button",
  "about": {
    "title": "Amber signal button",
    "category": "button",
    "tags": ["cta", "rounded", "arrow"],
    "author": "TimeRich Creations",
    "license": "LicenseRef-TimeRich-Ads",
    "version": "1.0.0"
  },
  "seal": "sealed",
  "drawing": "amber-signal-button.svg",
  "inputs": {
    "action.text": {"kind": "content", "type": "string", "maxLength": 24, "initial": "EXPLORE THE WORK"}
  },
  "outputs": {"pressed": {"kind": "event"}},
  "controls": {
    "press": {"kind": "button", "target": "surface", "event": "pressed", "label": "{{ action.text }}"}
  },
  "bindings": [
    {"id": "label-text", "target": "label", "text": "{{ action.text }}", "fit": {"box": "label-box", "fontPx": 24, "minFontPx": 18, "maxLines": 1}}
  ]
}
```

Robin riding, with a clip on its own parts and an exposed attach slot:

```json
{
  "format": "hsvg/2.0",
  "kind": "component",
  "id": "robin-hero",
  "about": {"title": "Robin the courier, riding", "author": "TimeRich Creations",
            "license": "LicenseRef-TimeRich-Robin", "version": "2.1.0"},
  "drawing": "robin-hero.svg",
  "places": {"near-hand": {"kind": "slot"}},
  "inputs": {"walking": {"kind": "knob", "type": "boolean", "initial": false}},
  "clips": {
    "walk": {"durationMs": 1100, "loop": true, "tracks": [
      {"id": "near-thigh-swing", "target": "near-thigh", "channel": "rotate",
       "keys": [[0, 12], [550, -12, "ease-in-out"], [1100, 12, "ease-in-out"]]}]}
  },
  "on": {
    "changed:walking": [{"id": "walk-or-rest", "actions": [
      {"id": "walk-start", "if": "walking", "then": [{"id": "play-walk", "play": "walk"}],
       "else": [{"id": "stop-walk", "stop": "walk"}]}]}]
  }
}
```

- JSON names drawing things by local id (`near-thigh`, not `robin-hero__near-thigh`; 2.12). (files)
- **No fact twice.** JSON never repeats a drawing fact: pivots, motion ranges, roles, variant names, colour roles, place
  marks. It refers to them by name. (review)
- **`parts`** holds the one part fact a drawing cannot: where a member of a component (a top-level part drawn from another component) came
  from. Map from the member's local
  id to `{"derivedFrom": {"id", "version", "digest"}}` (A14.3):
  `"parts": {"price": {"derivedFrom": {"id": "violet-price-chip", "version": "1.2.0", "digest": "sha256:4be1…"}}}`.
  Protection, sizes and limits on parts are rules (section 8), not part facts. (files)
- **Layouts.** A component with several drawings lists them in `layouts` (7.4). All of them share the
  namespace and ids (2.12). Recommended names: `<id>.svg`, `<id>-<layout>.svg`.

## 4.5 Repeated uses

A **repeated use** is a use (`id`, `use`, `into`, `with`, 4.3) made once per row of a list. It adds `items` and
`key`.

```json
"uses": [
  {"id": "answers", "use": "answer-card", "into": "answer-slots", "items": "question.choices", "key": "item.id",
   "with": {"label": "{{ item.label }}", "chosen": "picked === item.id"}}
]
```

- `items` gives an array. `key` gives, for each row, a string in the id grammar (kebab-case, at most 48 characters).
  `with` reads `item` and `index`. Duplicate keys fault. `E-ID-DUPLICATE` **[playing]**
- A repeated use over a data table (`data.<name>`) takes the table's `maxRows` as the list's `maxItems`.
- `into` names a repeat (5.10), or the place of an add-on's layout plan that repeats this use. In a
  repeat its direct child slots, in document order, hold the uses. Slot ids are the same
  in every frame. The list's `maxItems` must fit the slots in every frame; at most 256 live repeated uses
  (also the `repeatItems` budget, A10.3). `E-REPEAT-CAPACITY` **[files]**, **[playing]**
- A changed list keeps uses whose keys remain (moving them to their new slots), creates uses for new keys and removes
  uses for gone keys after their exit lists. Reordering never renames. A removed and re-added key starts with fresh
  `moment` values; `saved` values restore. **[playing]**
- Repeated uses are flat: a repeated use inside a repeated block is refused. `E-REPEAT-NESTED` **[files]**
- Events from repeated uses arrive as `<use-id>.<event>` with `event.itemKey`. An `emit` as a trigger on a repeated use
  fires every row; to reach one row, add `"itemKey": "<formula>"` to that `emit`, outside the payload
  check. **[playing]**

## Kits and templates

A **kit** is a versioned set of block definitions, themes and resources. An experience made from one pins its version
(`"kit": {"id": "robin-delivery", "version": "2.1.0"}`): its scenes and shell are then uses of the kit's definitions,
and its `with` maps fill their inputs. A **template** is a checked experience to start from:
`hsvg new <name> --from <template>` copies it. A kit's definitions are sealed: a use gives inputs only.

Kits, versions, pins, libraries, pick-and-use, seals, promoted inputs and variations are tools' business. They are in
the tool reference: A14 (`reference/a14-kits-and-libraries.md`) and A9 (`reference/a09-editing-and-trust.md`).

## Moved out of this chapter

| Was | Now |
|---|---|
| Seal, digest and signature (the opening table) | A9.3, A9.4 |
| 4.6 Seals | A9.4 |
| 4.7 Promoted inputs | A9.5 |
| 4.8 Kits and versions | A14.1 |
| 4.9 Kit experiences | A14.2 |
| 4.10 Variations | A14.3 |
