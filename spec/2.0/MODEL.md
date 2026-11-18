# HyperSVG 2.0: the model

The model in three sizes. Each uses every word with the same meaning; each adds detail to the one before. It describes
2.0 as built. What waits for 2.1 is in the last section, "Later".

## Simple (for people)

HyperSVG turns an SVG into a hyper drawing: named parts that respond, with JSON beside the drawing that says what they
do, so people and AI tools can read, check, change and reuse it. You keep the drawing and its JSON as plain files, and
pack them into a HyperSVG, one `.svg` file to place in any page, or an Experience, one `.html` page that runs on its
own.

## Medium (for the spec)

HyperSVG is a format for interactive drawings made of plain files, and a small engine that checks, packs and plays them.
SVG drawings own how things look, JSON documents own what they mean and do, and conditions are formulas, never scripts.
What you make is an experience, named after its main file, `experience.json`, whatever it packs into; an asset is a
small one: one drawing and its JSON, with its knobs as inputs. Everything with an outside and an inside is a block: a
component (a reusable drawing with its JSON, which may hold other components, drawn in place or placed in its slots), a
scene, a shell (the screen around the scenes, with one stage slot) or the experience itself. A block's outside is four
faces (places, inputs, rules, outputs); its inside, the body, holds values and behaviour. The JSON is written in seven
sentence shapes (values, controls, reactions, clips, bindings, story and the door) with 29 words, and a drawing carries
15 marks. Neither list loses or changes a word in 2.x; a minor version may only add a value in a list that exists, such
as a control kind, and only when no preset or add-on can do the job. A drawing is made of named parts with jobs (it
moves, holds content, takes a theme colour, is the target of a control, is a place, or has variants), grouped in layers
(content, backdrop, overlay, decoration) that stack in document order; each drawing at one size is a frame. Controls
(button, toggle, choice, slider, dial, drag) and other events start reactions, whose actions set values, play clips and
sounds, and emit outputs; machines keep states; bindings show values in parts. The story links scenes on an event, after
a time or on a choice, optionally grouped into chapters; a scene's output events are its outcomes, and the story follows
them. A block is shown in representations, defined by what changes (the size or shape, the layout, the content tier, the
language, a variant, or the theme) and who picks it (the space, an input, the host or a person); in the core every
layout is drawn. The checker proves what it can from the files. The packer makes an Experience (one offline `.html`
page) or a HyperSVG (one `.svg`, with its JSON inside as data), and `unpack` splits a HyperSVG again. The player plays
it in two halves: the logic, which keeps the values and follows the story and needs no page, and the drawing, which
shows it and hears presses and keys. A host plays it, grants what it may cross, and reaches it only through the host
API: inputs and pictures in, outputs out. Everything else is an add-on through one door (`needs`, `presets`, `addons`,
`call`): a preset, a logic module or a capability, which may also add a control kind, a binding channel or a clip
channel as a value carrying its name. Add-ons are chosen and fingerprinted when the experience is made; nothing new
arrives while it plays. The rule language, kits, libraries, templates, variations, editor rights, packages and host
profiles are the tool reference. The official add-ons (AI, seats, spoken lines, layout plans, physics and the others),
the kit and its templates, the library, the showcases and the skills live outside the base repository.

## Expanded (for a first-time reader)

**What it is.** HyperSVG is a way to make drawings that respond, from plain files. You draw in SVG and name the parts;
beside the drawing, JSON says what the parts do. What you make is called an **experience**, after its main file,
`experience.json`, whatever it packs into: an ad, a lesson, a game, an infographic, a lamp on a web page. It serves a
purpose, the reason it exists, such as getting a click or teaching a skill. The smallest experience is an **asset**: one
drawing and its JSON, with knobs a page may set, such as whether the lamp is lit and how tall it is. An asset is a small
experience, so everything here holds for both.

The files are plain. SVG drawings own how things look; JSON documents own what they mean and do; and conditions are
short formulas in one small language, never scripts, so content can be read, checked and safely changed by people and AI
tools alike. Heavier logic, such as a game's rules, comes from reviewed logic modules, fingerprinted when the experience
is made, never from code in the content. Three tools work on the files: a checker proves what it can before anything
runs, a packer makes the outputs, and a small player plays them, adding an add-on's code only when the experience names
it.

**Two outputs.** The same folder packs two ways. An **Experience** is one offline `.html` page: the player, every file
and the add-ons it names. It opens from a file and makes no network requests. A **HyperSVG** is one `.svg` file: the
start scene's drawing with its marks, and the asset's JSON inside `<metadata>` as data, never as script. A HyperSVG
shows its rest pose wherever an SVG shows: an `<img>`, a design tool, a README. It plays when a page loads the shared
player and places it with a `<hypersvg-asset>` tag or `mount()`. The tag's attributes set its knobs, and it sends its
outputs as page events. `unpack` turns a HyperSVG back into its folder, so you author in separate files and ship one. A
HyperSVG holds only text and carries no code: no kit, no script, no add-on code, and no picture, sound, font or video
file.

**How it unfolds.** Its story is the plan for how it unfolds: scenes, joined by links that say which scene can come
next, on an event, after a time or on a choice. When several links could fire, the first in the list wins; a link may
also visit a scene and return to the one that sent it. Scenes may be grouped into chapters. A shell is the screen around
the scenes, such as a top bar that stays while scenes change; it has one stage slot, where the scenes show, and may have
overlay and dialog slots. The core does not draw choices; an add-on shows them.

**What it is made of.** Everything we build is a block. A component is one reusable object with its own drawing and
JSON, such as a button, a crate or a character. A component may hold other components: drawn in place as its parts, or
placed in its slots. Scenes and shells are blocks too, and the experience itself is the largest block. A scene places a
component with a use, which fills the component's inputs; a use can also repeat once for each item of a list, such as
four answer cards or the bars of a chart. Blocks may also come from a kit: a versioned set of blocks, themes, resources
and rules that an experience pins. A library is a kit with a catalogue, from which an experience picks single items.
Kits and libraries are part of the format and written in the tool reference; they live in their own repositories.

**How a block works.** Every block has an outside and an inside. The outside has four faces: places (slots and other
drawn places where things go), inputs (what may be changed from outside: content such as its text, knobs such as a
speed, and triggers), rules (what it promises) and outputs (what it reports, such as "pressed"). The inside, its body,
holds its values and behaviour; other blocks, editors and hosts reach it only through the faces.

Behaviour starts from events: a control (a button, toggle, choice, slider, dial or drag), a key, a timer, a changed
value, the player coming into view, or an output of a block inside it. A reaction answers an event with actions: set a
value, choose with `if`, emit an output, play or stop a clip or a sound, open or close a dialog, or call the player (to
open a web address, for example) or an add-on. A scene's outputs are its outcomes: the story follows them to choose the
next scene. A machine keeps states, such as "waiting" and "answered", with timers of its own. Each value lasts for a set
time: while its scene is shown, for the run, for the session, or saved across visits, where the host allows storage.

A block may be sealed, so that a use can change only its inputs and its proven rules hold wherever it is used. Seals and
those proofs are tools' business, in the tool reference.

**How the drawing comes alive.** A block with a drawing is drawn in SVG, and each drawing at one size is a frame (a
drawing, not an image in a video). A drawing is made of named parts, marked with `data-hsvg-*` attributes. Each part has
jobs: it moves within the ranges its marks allow, holds content, takes a theme colour, is the target of a control, marks
a place, or has variants (a mouth open or closed). Bindings tie the block's values to its parts: a score shows in a text
part, a mood picks a variant, a speed turns a wheel. Clips move parts over time. Sounds play from files or are made from
a few numbers, and sound starts only after a person's first press. Logic reaches the drawing only by part names and
declared sizes, never by raw SVG, so the art can be redrawn without touching the logic. No add-on adds a mark: the
drawing side is closed.

A group in a drawing may say which layer it is: content (the default: the words, pictures and controls that matter), a
backdrop (which may reach past the edges on other screen shapes and is never in the way), an overlay (which may cover
content only where a rule allows), or decoration (paint that may give way when the picture is simplified, and that
screen readers skip). Layers stack in document order: what is drawn later sits on top. Layers nest: a component has its
own layers, which stay together, and a placed component sits in the layer that holds its slot. The shell stacks the same
way, with the scene on its stage and an overlay, such as a caption bar, above it. The order never changes while playing,
so covering can be proven; depth comes from clips and from which copy is visible. Parallax is each layer moving at its
own speed on the same clock; a character circles a tree because a copy of the trunk in front of it shows only while it
is behind; and a dragon can wrap round a ball when both are drawn as one component, the back of the body before the ball
and the front after it.

The same block can be shown in different representations, defined by what changes (the size or shape, the layout, the
content tier, the language, a variant, or the theme) and who picks it (the space available, an input, the host or a
person). A content tier is short, medium or rich copy that the author wrote; the engine never invents words. In the
core, the layout for each size is drawn: one drawing per size, with the same part names. A layout computed by a layout
plan (rows, columns or a grid) comes with the `fit` add-on. A representation is another view of the same block; a
variation is different: a separate copy made from an original and then changed, such as a winter version of a summer ad,
which records what it came from. A template is a starter experience that a tool copies as a variation, with new ids, and
checks. Variations and templates are tools' business; the templates live with the kit.

**How it stays right.** Each scene reports outcomes, what happened in it, such as "parcel delivered". A link may carry a
condition, a formula: the link is open only while it is true. A block's rules are what it promises, such as "the logo is
never cropped"; the checker reads them. Every rule that applies must hold; two that conflict both fail, and the checker
names both.

Rules have strengths. A must rule that fails stops publishing. A should rule only adds a note. A give-way rule bends in
set steps down to a limit: a headline may shrink step by step, but never below its smallest size. Rules are proven from
the files where possible; otherwise they are tested by playing or reviewed by a person. The rule language is in the tool
reference. The player does not run rules while playing: a text's own fit still shrinks and wraps it, and give-way while
playing is the `ladder` add-on. The format's own limits, such as safe content and unique ids, always hold and need no
rule.

Every change, whether from a person, an editor, the host or an add-on, passes the same checks, in order, one change at a
time: type, bounds, rules and grants. Who may edit which input, such as a copywriter the headline, is written in the
tool reference.

The player gives every drawing its accessible structure from the parts and their roles: names, keyboard handling and
order, spoken feedback, and a calm version under reduced motion.

**What comes through the door.** The core is small and stays put: files made for 2.0 keep working in every 2.x.
Everything else is an add-on, ours or anyone's, and every add-on uses one door: the experience names it in `needs` (a
preset in `presets`), its settings sit in `addons`, its actions are calls and its events carry its name. There are three
kinds: a preset (JSON only), a logic module (a pure function, pinned by its fingerprint) and a capability (code in the
page that the host allows). An add-on may also add a control kind, a binding channel or a clip channel, each as a value
carrying its name. Add-ons are chosen and fingerprinted when the experience is made; nothing new arrives while a page
plays, except data and pictures through the host API. The official add-ons come in their own release: AI characters,
seats for players and AI agents, spoken lines and captions, layout plans, physics, particles, rich text, recorded video,
HTML widgets, page hooks on someone else's page, rows a host feeds and others. Where the host allows AI, an AI character
answers from fixed creator text and checked values, and an AI agent may take a seat and play like a person, with only
that seat's moves. The base repository holds four presets and one tiny example for each door. An experience that names
an official add-on checks with a warning without the add-ons release, and packs only with it.

**Where it runs and travels.** An experience runs on a host: its own page, an ad placement, an app, an AI assistant, or
someone else's website (with the page add-on). A HyperSVG runs in any page that loads the player. The player has two
halves: the logic, which keeps the values, runs the reactions and follows the story and needs no page, and the drawing,
which shows it in the page and hears presses and keys. The host grants what the experience may reach, such as storage or
opening a web address, and nothing else; the packer writes what the experience asks for, and the host decides. The host
also runs the add-ons the experience needs, or refuses it. The door to the outside is the host API: values and pictures
go in, events come out. A page in a sandboxed frame uses the same verbs through the frame link, and an AI assistant
reaches an experience the same way, through an adapter in the host. An Experience comes with a short description,
`package.json`, that lists a fingerprint (digest) of every file; a HyperSVG carries the same list inside it, and a file
that no longer matches is refused. These digests catch accidents, not tampering: a host that must trust a file keeps its
fingerprint on its own server.

**One kind of thing, set differently.** An ad, a lesson, a game, a mascot and a lamp on a page are the same kind of
thing set differently: how many sizes, how scenes are joined (by time, events or choices), what changes them, what they
remember, which output they ship as, and where they run.

**Which word to use.** One moment of the story is a scene; a group of scenes is a chapter; a drawn alternative of a part
is a variant; another view of the same block is a representation; a changed copy is a variation; a starter experience to
copy is a template; a value someone may set is an input, and a bounded one is a knob; a group of a drawing that says its
job in the picture is a layer; a small experience with knobs is an asset; HyperSVG names the format and its engine, and
also the packed `.svg`; the packed `.html` page is an Experience; anything beyond the core is an add-on.

**A small example.** The bakery's banner is one experience with the purpose "get a click". Its story has three scenes,
hook, offer and end card, linked by time. Each scene is drawn twice, at 300×250 and at 728×90, with the same part names.
The end card holds a button, a component with one content input (its words) and a "pressed" output, and a protected area
keeps the logo inside the picture. When a person presses the button, the end card asks the player to open the bakery's
page and reports the outcome "clicked". The banner packs as an Experience. The ad placement, its host, allows opening
that address and nothing else: no storage and no AI. Counting the click is the host's business.

The button's files:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 48" data-hsvg-version="2.0">
  <title>Order button</title>
  <g id="cta" data-hsvg-kind="component" data-hsvg-role="action">
    <rect id="cta__surface" data-hsvg-kind="part" data-hsvg-role="surface" data-hsvg-fit="" data-hsvg-color="accent" x="0" y="0" width="180" height="48" rx="24" fill="#d84315"/>
    <text id="cta__label" data-hsvg-kind="part" data-hsvg-role="label" data-hsvg-color="surface" x="90" y="31" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#ffffff">Order now</text>
  </g>
</svg>
```

```json
{"format": "hsvg/2.0", "kind": "component", "id": "cta", "drawing": "cta.svg",
 "inputs":   {"action.text": {"kind": "content", "type": "string", "maxLength": 18, "initial": "Order now"}},
 "outputs":  {"pressed": {"kind": "event"}},
 "controls": {"press": {"kind": "button", "target": "surface", "event": "pressed", "label": "{{ action.text }}"}},
 "bindings": [{"target": "label", "text": "{{ action.text }}", "fit": {"box": "surface", "minFontPx": 14}}]}
```

The SVG names two parts, surface and label. The JSON gives the button one input (its words, `action.text`: a component
with the role `action` names it so), one output ("pressed"), a button on the surface, and a binding that writes the
words into the label and keeps them inside the surface, shrinking them if needed. The checker finds nothing to fix.

## Later (2.1)

These are designed or drafted, not in 2.0. A 2.1 may only add: files made for 2.0 keep working. Drafts with their
grammar are in `drafts/` in the repository; a 2.0 checker refuses them (`E-DRAFT`, or `E-NEEDS-UNKNOWN` for a need).
Words an add-on owns arrive with a version of that add-on, not with the base.

In the format:

- **Goals, journeys and achievements.** Goals are declared measures of the purpose that outcomes move ("all parcels
  delivered"); a person's journey is the path they actually take; it earns achievements when the goals they name are
  reached.
- **Nested experiences, logical blocks and split screen** (`drafts/structure-2.1.md`).
- **Content options and the seed selector** for A/B tests (`drafts/content-options-2.1.md`).
- **Clip extras**: `wiggle`, `timeRemap`, `frameRate`, `holdFrames`, a track's `composite` and a clip's `blendMs`
  (`drafts/clip-extras-2.1.md`).
- **Choice places**: drawn places for choices inside a scene (`drafts/choice-places-2.1.md`).
- **A scroll clock**: a stage slot whose time follows scrolling (`drafts/scroll-clock-2.1.json`).
- **Delivery**: export adapters (an ad network's zip, a learning platform, a video), served play, the `network` grant
  and the `site` storage scope (`drafts/delivery-2.1.md`).
- **Custom HTML widgets** written by the host (`drafts/custom-widgets-2.1.md`).
- **Hosted change history.**

Through add-ons:

- **AI roles** (the `ai` add-on): AI that assists (explains, guides), chooses among ways that are already valid, or
  judges something a person made into declared levels, always with a record.
- **More effect kinds** (`drafts/effect-kinds-2.1.json`, the `effects` add-on) and **page actions that move the actor**
  (`drafts/page-actions-2.1.json`, the `page` add-on).
- **Remote seats**: players on different devices (`drafts/remote-seats-2.1.json`). They need a runtime door that is
  outside the base standard; the `bridge` plan they were designed with is removed from the base.
