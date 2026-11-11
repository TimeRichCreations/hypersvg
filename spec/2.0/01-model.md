# 1. The model

Format id: `hsvg/2.0`. The short form of this model, in three sizes, is `MODEL.md`.

This section defines the few ideas everything else is built from. Every later section uses these words with these
meanings. Section 11 lists the words; where an older spec used a word differently, the rename table of A13.4 gives the new name.

The section numbers skip 1.9 and 1.11: those sections moved out, and the table at the end says where. The examples
name pieces that ship with the core: the one-page example (`docs/one-page/example/`), the guide's harbour
(`docs/guide/examples/harbour/`) and the orientation recipe (`skill/2.0/examples/recipes/orientation/`).

## 1.1 Principles

1. **Everything is a block.** An ad, a mascot, a scene, a game, a lesson, a slide show and an infographic are all
   blocks. They differ in their settings, not in kind.
2. **Drawings own shapes; JSON owns meaning.** The SVG drawing is the source of truth for how things look and where
   they are. JSON describes content, values, behaviour and rules. There is one format, played directly.
3. **No code in content.** Content never contains scripts, HTML or selectors. Conditions and computed values use one
   small formula language with a closed grammar and budgets (section 5).
4. **Every change passes the same checks.** A value can change through a control, a reaction, an editor, an AI agent,
   an HTML widget or a server. Each change is checked for type, bounds and rules. An edit is also checked against
   editor rights; a change while playing, against the seat's inputs and the host's grants (A9.7).
5. **Rules are invariants.** A rule says what must always hold. It is proven from the files, by playing, or by
   review. Blocks declare which rules they guarantee.
6. **One way to do each thing.** When two forms would express the same thing, the spec keeps one.
7. **Closed by default across boundaries.** Nothing reaches a host page, a network, storage or a person's data unless
   it is granted.
8. **A small, closed core.** The core stays small and stops growing (1.12). Everything else is an add-on, through one
   door (chapter 12): a block names a module or capability in `needs`, and a preset in `presets`.

## 1.2 The ladder

Everything drawn sits on one ladder. Each rung is built from the rungs below it. Components and every rung above
them are **blocks** (1.3). Elements and parts are the pieces drawings are made of: a part's jobs (1.6) show on the
faces of the block whose drawing holds it.

| Rung | What it is | Files | Example |
|---|---|---|---|
| **element** | Plain SVG: a path, rect, text. Needs no name. | SVG | the shading inside an arm |
| **part** | A named piece of one drawing that does something (its jobs, 1.6) | SVG | the star of the one-page example, a price label, a wheel |
| **component** | A reusable block with its own drawing and its own JSON document; it may hold other components | SVG + JSON | a card of Memory match, a button, an offer block, a set of answer cards |
| **scene** | One moment: a game screen, an ad moment, a slide | JSON, naming SVG drawings | the play scene of Memory match, one step of an animated ad |
| **shell** | The screen around scenes: a master drawing with slots for the **stage** (where scenes play) and for pieces that stay, such as a top bar (10.1) | JSON, naming SVG drawings | the harbour recipe's frame, with its stage slot and its turn button |
| **experience** | Scenes linked in a story graph | JSON | Memory match, an ad, a lesson |

A **frame** is one drawing of a block at one size or shape (a 300×250 ad, Memory match's tall phone drawing, a button
drawn for a narrow slot). Scenes, components and shells all have frames. It is not a rung.

The **host** is where an experience runs: its own page, an ad placement, a portal, an app, an AI assistant, or someone
else's web page (section 10). The host is not a rung.

Drawings mark only element, part, component and screen. (A **compound**, components arranged as one, is now a
component that holds other components. The upgrade tool rewrites `data-hsvg-kind="compound"`.) Scenes, shells and experiences are JSON
documents that refer to drawings.

## 1.3 The block

Every rung from component up is a **block**. A block has an outside and an inside.

- **The outside is four faces** (1.4): places, inputs, rules, outputs. This is all that other blocks may see or use,
  and all that an editor may change at a use. The body changes only when the definition itself is edited.
- **The inside is the body** (1.5): values and behaviour. It is private to the block.

A block is defined once and used many times; each use gives its inputs and has its own scope. What may cross a
trust boundary (a host page, storage, the network) is a **grant**, closed by default (10.5). An **add-on** is an
ability the block needs: a module or capability is named in `needs` (10.7), a preset in `presets` (12.3). Seals, editor rights and the trust record are tools' business (the
tool reference, A9).

Every block in 2.0 is a rung with a drawing or a document of its own. Logical blocks (blocks with no drawing,
working on places they are given) are a 2.1 draft (`drafts/structure-2.1.md`). A component is a block
that brings its own drawing and always has its JSON document; for a drawing that has none, a tool writes a minimal
`component.json`, and the block has only the faces its drawing marks (its places).

## 1.4 The four faces

| Face | Question it answers | Contents |
|---|---|---|
| **places** | Where can things go? | slots (attach points too), fit boxes, repeats, protected areas, routes, page hooks (1.7) |
| **inputs** | What can be changed from outside? | content fields, triggers and knobs (section 5) |
| **rules** | What must always hold? | invariants the block guarantees, each with a strength (section 8) |
| **outputs** | What does it report? | typed events, results and records (5.4, 5.12) |

A **content field** is a typed input for words, pictures or data. A **knob** is a bounded input that may be
adjusted, such as speed or difficulty; a **setting** is a knob shown to the player. Content fields and knobs hold
values the block reads. A **trigger** is an input with no stored value: something happened.

## 1.5 The body

| Part of the body | Meaning |
|---|---|
| **values** | Named, typed, bounded data with a lifetime: `moment` (while its owner is active: a scene from entry to exit, a component while mounted), `run` (until the experience closes or restarts), `session` (until the browser session ends) or `saved` (across runs). |
| **behaviour** | What happens: **reactions** to events, **machines** (state machines), **actions** (one operation each, such as writing a value), **clips** (motion over time), **bindings** from values to the drawing, and **effects** (running motion recipes, such as a spring). |

Behaviour never reaches outside its block except through outputs and the actions the host grants (section 5).

## 1.6 Parts and their jobs

A part is a named piece of a drawing. What it does comes from what is attached to it. One part may have several
jobs. A job is attached in one of two ways: a mark in the drawing (`data-hsvg-pivot`, `data-hsvg-slot`,
`data-hsvg-variant` and the others of section 6), or a key in the block's JSON that names the part by its id (a binding,
a control, a clip). The drawing says what a part is and may do; the JSON says what happens. No fact is written in both
(10.12).

| Job | What is attached | Example |
|---|---|---|
| **moves** | a pivot, a range, `follow` another part | an arm, a wheel |
| **holds content** | a content field with limits | a headline, a price, a photo |
| **takes colour** | a colour role from the theme | a button surface |
| **reacts** | it is the target of a **control**: something a person presses, picks, slides or drags; using it writes a value or queues an event (5.11) | a button, a draggable parcel |
| **is a place** | it is a slot, fit box, repeat, protected area or route (1.7) | a mount point, a caption box |
| **has variants** | drawn alternatives selected by a value | a mouth open or closed, a happy or sad face |

A part also has a **role**: its job in words, from the role registry (`data-hsvg-role`, for example `action`,
`legal`, `label`). A role is not a **colour role**, which names a theme colour (7.7).

Paint order is document order. A part may declare its layer (`data-hsvg-layer`) as content, backdrop, overlay or decoration (6.4).

## 1.7 Places

Five kinds of place are drawn in a block's drawing. The sixth, the page hook, is on the host page.

| Place | Meaning |
|---|---|
| **slot** | A drawn place where a component or a scene is mounted. |
| **fit box**, **repeat** | A drawn box with a purpose (`data-hsvg-fit`): fitting text, holding a layout plan, showing a recorded video; a group whose child slots hold repeated items (`data-hsvg-repeat`). |
| **attach point** | An empty slot `<g>` inside a moving part that a use can ride on (`bike.basket-point`, 6.9). |
| **protected area** | A box that must stay visible (a face, a logo, a product). |
| **route** | A drawn path things move along (a road, a surface to walk on). |
| **page hook** | An element of a host page that the site owner marks and allows (`data-hsvg-hook`). |

## 1.8 Joining: the story graph

Scenes are joined in a **story graph**. Each **link** fires on an event (an answer, a finish line), on time
(`afterMs`, a number of milliseconds, or `afterLine`, when a spoken line ends) or on a **choice** (an option offered to a seat, which fires the link when picked).
A timeline is a graph whose links are all timed. A lesson or game uses event links. An interactive video mixes both.
A **visit** opens another scene and returns to the one that opened it, through a stack of at most 16.

One engine clock drives each experience. Scenes, components and stage slots may each have a local clock: its own
start time, pause and speed, counted from the engine clock. A data story's stage slot may take its local time from
the scroll position instead (3.10).

## 1.10 Representations

A **representation** is one way the same block is shown, defined by what changes and who picks it. One mechanism
covers every representation (section 7). What changes is an axis: **size or shape**, **layout** (the
same parts laid out differently), **content** (a **tier**: short, medium or rich copy), **language**,
**variant** (a different drawing of a part; the axis is named `look`) and **theme**. Each axis has a selector: the space available, an input, the
host or a person. A changed copy of a block is not a representation but a **variation** (A14.3).
A **variant** is always a drawn alternative of one part, never a changed copy of a block.

## 1.12 The core and how it grows

**Seven sentence shapes.** Every experience is written with seven shapes. They are closed for all of 2.x (D27):

| Shape | Words | Says |
|---|---|---|
| values | `values`, `computed`, `inputs`, `outputs` | what it remembers, and what it works out from that (5.1 to 5.4) |
| controls | `controls` | what a person can press, pick, slide, turn or drag (5.11) |
| reactions | `on`, `entry`, `exit`, `machines` | when an event happens, do these things (5.12 to 5.15) |
| clips | `clips` | motion over time (6.7) |
| bindings | `bindings` | what the drawing shows, from the values (6.8) |
| story | `story` | the scenes and how they join (3) |
| the door | `needs`, `presets`, `addons`, `call` | what an add-on adds (10.7, 12) |

A computed value is a value: it is worked out from other names. A machine is a reaction: its states hear events, and
its `after` timers are events of time. The same seven lists are on every page that names the sentences (the README,
the one-page guide and this chapter).

**The growth rule (D27).**

1. The seven shapes never change in 2.x.
2. A new core word may only be a new value in a slot that exists: a control kind, an animation channel, an action
   verb, a formula function, a role. It is added only when existing words, a preset or an add-on cannot do the job,
   only in a minor version, and old files keep working.
3. Everything else is an add-on, ours or anyone's, through the same door.
4. The formula language (5.6) is settled. Its function list is a slot under rule 2.

**The core boundary (D28, D30, D31).** Every word of the format is in exactly one place:

| Place | What it holds | Where it is written |
|---|---|---|
| **core** | The frozen words every player runs: the seven shapes, files and names, the drawing marks, layouts, themes, sound | chapters 1 to 12 |
| **add-on** | A built-in add-on's words, each in its own pocket | its own page and manifest, which come with the add-ons release |
| **tool reference** | What editors, hosts, packers and checkers read and write: rights, change requests, receipts, packages, host profiles, play tests, rules, kits | `reference/` |
| **2.1 draft** | Designed, not built; refused in 2.0 (`E-DRAFT`) | `drafts/` |

The SVG side is closed too: an add-on never adds a drawing mark (6.1). The core is released first, with the door and
its example add-ons; the built-in add-ons follow in their own release, each with a version and a tier (D30).

**The chapters.**

| Chapter | Holds |
|---|---|
| 1. The model | this chapter |
| 2. Files and names | documents, header, kinds, folders, about, resources, words, data, ids and addresses, drawing files, allowed SVG |
| 3. The story | the story graph, links, outcomes, timed and choice links, visits, start and endings, clocks, timelines, chapters |
| 4. Blocks | drawing kinds, block documents, uses, components, repeated uses, kits and templates |
| 5. Faces and body | values, inputs, outputs, ambient inputs, formulas, places and controls, events, reactions, machines, actions, records |
| 6. The drawing | marks, parts, variants, roles, paint and layers, accessibility in drawings, frames, clips, bindings, attach, sound |
| 7. Representations and layouts | axes and selectors, sizes and shapes, frames, layouts, fitting, theme, languages, content tiers |
| 8. Rules | what a rule is; the rule language is in the tool reference (A11) |
| 9. The engine | the execution model: store, transactions, one writer, one clock, lifecycle, replay, checks, limits |
| 10. Hosts and delivery | shell, landmarks, hosts, grants, host API, the door, packing, `needs`, the checker, the accessibility contract |
| 11. Vocabulary | core words, defaults, retired words, look-alikes |
| 12. Writing an add-on | the door: presets, logic modules and capabilities, with worked examples |

## Moved out of this chapter

| Was | Now |
|---|---|
| 1.9 The five dials (product labels) | The tool reference, A14.4: they label products in libraries and galleries |
| 1.11 Seats, editors and trust | Seats: the `seats` add-on; editor rights and the trust record: A9 |
| The compound rung (1.2) | A component that holds other components |
