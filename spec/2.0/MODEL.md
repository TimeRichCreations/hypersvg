# HyperSVG 2.0: the model

The model in three sizes. Each uses every word with the same meaning; each adds detail to the one before. It
describes 2.0 as built. What waits for 2.1 is in the last section, "Later".

## Simple (for people)

An experience serves a purpose through its story: scenes, built from ready-made parts, drawn in layers and laid out
for every screen. Rules keep it on track, and AI may help where the host allows it.

## Medium (for the spec)

An experience serves a purpose through its story, which links scenes, optionally grouped into chapters. Scenes are
built from components and compounds (components made of components), which bring drawings; they are usually taken
from a kit, pinned once by the experience and used by everything inside. Every component, compound, scene and shell
is drawn as one or more frames (one drawing at one size), each made of layers with paint roles (backdrop, content,
decoration, overlay) that stack in drawing order, and shown in representations, defined by what changes (the shape,
the layout, the content tier, the language, a look or the theme) and who picks it (the space, an input, the host or a
person); a layout is either drawn or computed by a layout plan. A copy made from an original and then changed is a
variation, which records what it came from; a template is a starter experience that a tool copies this way. Each
scene reports outcomes, what happened in it, and the story follows them. Rules are conditions whose place decides
their job (in a block's rules they must always hold; on a link they say when that way is open); they are proven from
the files where possible, otherwise tested by playing or reviewed by a person. Optional abilities are capabilities
and add-ons that the experience names and the host allows. Where the host allows AI, an AI character answers from
fixed creator text and checked values, and an AI agent may take a seat; neither has authority over values or
outcomes beyond that seat's moves.

## Expanded (for a first-time reader)

**What it is.** An experience is what we make and a person uses: an ad, a lesson, a game, a website guide. It serves
a purpose, the reason it exists, such as getting a click or teaching a skill.

An experience is plain files. SVG drawings own how things look; JSON documents own what they mean and do; and
conditions are short formulas in one small language, never scripts, so content can be checked and safely edited by
people and AI alike. Heavier logic, such as the rules of chess, comes from reviewed logic modules, fingerprinted when
the experience is made, never from code in the content. A small player plays the files, adding optional capabilities
only when an experience needs them, and a checker proves what it can from the files before anything runs.

**How it unfolds.** Its story is the plan for how it unfolds: scenes, joined by links that say which scene can come
next, by time, by an event or by a choice. When several links could fire, the first in the list wins; a link may also
visit a scene and return to the one that sent it. Scenes may be grouped into chapters. A shell is the screen around
the scenes, such as a top bar that stays while scenes change; it has one stage slot, where the scenes show.

**What it is made of.** Everything we build is a block, and a scene uses only the kinds it needs:
- a component: one reusable object, such as a button or a character;
- a compound: several components that act as one, such as an offer box.

Scenes and shells are blocks too, and the experience itself is the largest block. Blocks usually come from a kit: a
versioned set of blocks, themes, resources, presets and rules. An experience that pins a kit version is a kit
experience. A library is a kit with a catalogue, so any experience can pick one item from it. A block or a list of
blocks can also repeat once for each item of a list, such as four answer cards or the bars of a chart.

**How a block works.** Every block has an outside and an inside. The outside has four faces: places (slots and areas
where other things go), inputs (what may be changed, such as its text or a speed), rules (what it promises) and
outputs (what it reports, such as "pressed"). The inside, its body, holds its values and behaviour; other blocks,
editors and hosts reach it only through the faces.

Behaviour reacts to events (a press, a key, a timer, scrolling, a signal from the page, an output of a block inside
it) with actions: set a value, play a motion or a sound, say a spoken line, or report an output. A scene's outputs are
its outcomes: the story follows them to choose the next scene. Behaviour can also keep states, such as "waiting" and
"answered". Each value lasts for a set time: while its scene is shown, for the run, for the session, or saved across
visits.

A sealed block can change only through its inputs. Its rules are proven once, for every value those inputs allow,
and that proof is reused wherever the block is used; what depends on where it is placed, such as its size or crop, is
still checked at each use.

**How the drawing comes alive.** A block with a drawing is drawn in SVG, and each drawing at one size is a frame (a
drawing, not an image in a video). A drawing is made of named parts, and each part has jobs: it moves, holds content,
takes a theme colour, reacts to a press, marks a place, or has several looks (a mouth open or closed). Bindings tie the
block's values to its parts: a score shows in a text part, a mood picks a look. Motion moves parts over time; sounds
and spoken lines play with captions, and sound starts only after a person's first press. Logic reaches the drawing
only by part names and declared sizes, never by raw SVG, so the art can be redrawn without touching the logic.

Each frame is made of layers that stack in drawing order: what is drawn later sits on top. Every layer has a paint
role: a backdrop (which may reach past the edges on other screen shapes and is never in the way), content (the
words, pictures and buttons that matter), decoration (which screen readers skip) and an overlay (which may cover
content only where a rule allows). Layers nest: a component has its own layers, which stay together, and a placed
component sits in the scene layer that holds its slot. The shell stacks the same way, with the scene on its stage
and an overlay, such as a caption bar, above it. The order never changes while playing, so covering rules can be
proven; depth comes from motion and from which copy is visible. Parallax is each layer moving with the same scroll
or time at its own speed; Robin circles a tree because a copy of the trunk in front of him shows only while he is
behind it; and a dragon can wrap round a ball when both are drawn as one compound, the back of the body before the
ball and the front after it.

The same block can be shown in different representations, defined by what changes (the shape, the layout, the
content tier, the language, a look or the theme) and who picks it (the space available, an input, the host or a
person). A content tier is short, medium or rich copy that the author wrote; the engine never invents words. The
layout for each screen size is either drawn or computed by a layout plan (rows, columns or a grid). A representation
is another view of the same block; a variation is different: a separate copy made from an original and then changed,
such as a winter version of a summer ad, which records what it came from. A template is a starter experience: the
`new` tool copies it as a variation, with new ids, and checks the copy.

**How it stays right.** Each scene reports outcomes, what happened in it, such as "parcel delivered". A rule is a
condition, and where it is written decides its job: in a block's rules it must always hold, and on a link it says
when that way is open. Every rule that applies must hold; two that conflict both fail, and the checker names both.

Rules have strengths. A must rule that fails stops publishing, and while playing, a change that would break it is
refused and the experience goes on. A should rule only adds a note. A give-way rule bends in set steps down to a
limit: a headline may shrink step by step, but never below its smallest size. Rules are proven from the files where
possible; otherwise they are tested by playing or reviewed by a person.

Every change, whether from a person, an editor, the host or a participant, passes the same checks, in order, one
change at a time. Each input names who may change it (a copywriter the headline, a marketer the price), and every
edit is checked against those rights before it is saved. A participant may make only the moves their seat allows,
such as moving a piece only on their turn.

The player gives every drawing its accessible structure from the parts and their roles: names, keyboard order,
captions for spoken lines, and a calm version under reduced motion.

**AI.** Where the host allows AI, an AI character answers a person's questions: its persona is fixed creator text,
the values it may see travel as facts, and every answer is checked (plain text of a set length, or one of the declared
options) before content sees it, with a written fallback when no AI is there. An AI agent may also take a seat and
play like a person; then it is a participant, with only that seat's moves.

**Where it runs and travels.** An experience runs on a host: its own page, an ad placement, someone else's website,
an app or an AI assistant. The host grants what the experience may reach, such as storage or elements of the page,
and nothing else, and it runs the optional abilities the experience needs (capabilities, such as physics or AI).
The door to the outside is the host API: values go in, events come out; a page in a sandboxed frame uses the same
verbs through the frame link; `live-data` brings in data from declared sources. People, AI agents and programs take
part through seats, each a participant's place on one page, such as the two sides of a chess game. Outside
developers add presets, logic modules and capabilities through the add-on door, chosen and fingerprinted when the
experience is made. An experience travels as one package with a fingerprint (digest) for every file, and can be
exported for other places: an ad network, a learning platform, or a video, which follows the timed path, keeps the
look and captions, and loses the interaction.

**One kind of thing, set differently.** An ad, a lesson, a game and a mascot are the same kind of thing set
differently: how many sizes, how scenes are joined (by time, events, choices or scrolling), what changes them, what
they remember, and where they run.

**Which word to use.** One moment of the story is a scene; a group of scenes is a chapter; another view of the same
block is a representation; a changed copy is a variation; a starter experience to copy is a template; a value someone
may set is an input; a stacked group of a drawing with a paint role is a layer.

**A small example.** The bakery's 300×250 banner is one experience with the purpose "get a click", made from the
bakery kit. Its story has three scenes, hook, offer and end card, linked by time. The end card holds a button, a
component with a label input that only a copywriter may change and a "pressed" output, and the kit's rule says the
logo is never cropped. Its 300×250 layout is drawn, and its 728×90 layout is computed by a layout plan. When a person
presses the button, the end card reports the outcome "clicked"; the ad network, the host, which allows no storage
and no AI, opens the bakery's page and counts the click.

The button's files, shortened:

```svg
<g id="cta" data-hsvg-kind="component" data-hsvg-role="action">
  <rect id="cta__surface" data-hsvg-kind="part" data-hsvg-color="accent" x="0" y="0" width="180" height="48" rx="24"/>
  <text id="cta__label" data-hsvg-kind="part" x="24" y="31">ORDER NOW</text>
</g>
```

```json
{"kind": "component", "id": "cta", "drawing": "cta.svg",
 "inputs":   {"label": {"kind": "content", "type": "string", "maxLength": 18, "initial": "Order now",
                        "editableBy": ["copywriter"]}},
 "outputs":  {"pressed": {"kind": "event"}},
 "controls": {"press": {"kind": "button", "target": "surface", "event": "pressed"}},
 "bindings": [{"id": "label-text", "target": "label", "text": "{{ label }}"}],
 "rules":    [{"id": "label-fits", "kind": "fits", "subject": "field:label"}]}
```

The SVG names two parts, surface and label; the JSON gives the button one input (the label, which only a copywriter
may change), one output ("pressed"), a binding that writes the label into the label part, and one rule (the label
always fits).

## Later (2.1)

These are designed or drafted, not in 2.0. Drafts with their grammar are in `drafts/`; a 2.0 checker refuses them
(`E-DRAFT`).

- **Goals, journeys and achievements.** Goals are declared measures of the purpose that outcomes move ("all parcels
  delivered"); a person's journey is the path they actually take; it earns achievements when the goals they name are
  reached.
- **AI roles.** Beyond characters and seats: AI that assists (explains, guides), chooses among ways that are already
  valid, or judges something a person made into declared levels, always with a record.
- **Nested experiences, logical blocks and split screen** (`drafts/structure-2.1.md`).
- **Content options and the seed selector** for A/B tests (`drafts/content-options-2.1.md`).
- **More effect kinds** (`drafts/effect-kinds-2.1.json`) and **page actions that move the actor**
  (`drafts/page-actions-2.1.json`).
- **Remote seats**: players on different devices (`drafts/remote-seats-2.1.json`). The `bridge` plan they were designed
  with is removed from the base (D40): runtime import is outside the standard.
