# HyperSVG 2.0: the core spec

HyperSVG is interactive SVG: a drawing owns the shapes, and a few JSON documents say what changes, what a person can
do and how scenes join. Format id `hsvg/2.0`. **Status (November 2026): release candidate `2.0.0-next.0`.** Files
made for 2.0 keep working in every 2.x (1.12). This folder is the core spec: what every player runs. Add-ons and
tools have their own pages (below).

## Start here: one working experience

An experience is a folder: `experience.json`, one scene document and its drawing. The lamp in
`docs/guide/examples/lamp/` is the starter that `hypersvg init` copies.

```json
{
  "format": "hsvg/2.0",
  "kind": "experience",
  "id": "lamp",
  "language": "en",
  "about": {"title": "Lamp", "description": "A lamp with a switch. Knobs: lit and height. It sends switched."},
  "inputs": {
    "lit":    {"kind": "knob", "type": "boolean", "initial": false},
    "height": {"kind": "knob", "type": "number", "minimum": 0.5, "maximum": 1.5, "initial": 1}
  },
  "outputs": {"switched": {"kind": "event"}},
  "roles": {"lamp": {"appliesTo": ["part"]}},
  "story": {"start": "lamp", "scenes": {"lamp": "lamp.json"}, "endless": true}
}
```

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

The drawing `lamp.svg` has parts with the ids `lamp`, `bulb`, `switch` and `switch-words`. Two inputs (`lit`,
`height`), an output, a control, a reaction and three bindings: five of the seven sentence shapes (1.12). Check it
and pack it, as a HyperSVG (one `.svg`) or as an Experience (one `.html` page):

```sh
node engine/v2/tools/check.mjs docs/guide/examples/lamp
node engine/v2/tools/pack.mjs --asset docs/guide/examples/lamp out/lamp-svg
node engine/v2/tools/pack.mjs docs/guide/examples/lamp out/lamp-page
```

## Read in this order

1. [1. The model](01-model.md): blocks, faces and body, and the seven sentence shapes (1.12).
2. [5. Faces and body](05-faces-and-body.md) and [6. The drawing](06-drawing.md): values, controls, reactions,
   clips and bindings.
3. [3. The story](03-story.md): how scenes join.
4. The other chapters when you need them. [11. Vocabulary](11-vocabulary.md) holds every word and its default.

## Status

This is the one status table for 2.0; `engine/v2/README.md` points here. A fast test
(`engine/v2/tests/x5-status.test.mjs`) checks it where every evidence file is present: every evidence file exists,
every capability in `capabilities.json` has a row, and every draft in `drafts/` has a row. Some evidence is a test of
an add-on, the kit or the library, which have their own repositories. So in this repository that test is listed as
omitted (`release/public-omissions.json`), and the checks print `OMITTED` for it: it did not run here.

- **built**: the 2.0 engine (`engine/v2/`) does it, and the evidence is a test that runs it.
- **built in part**: built, with the gaps the notes name.
- **not built**: in the 2.0 text, not in the engine yet.
- **experimental (2.1)**: in the 2.0 text, marked so; no tool proves it and it has no error code.
- **draft (2.1)**: not in 2.0. The checker refuses it (`E-DRAFT` or `E-NEEDS-UNKNOWN`); its text is in `drafts/`.
- **planned (2.1)**: decided for 2.1, not written yet.

Rows named "Capability" or "Module" are the official add-ons. They are built, and they come with the add-ons release
(`hypersvg-addons`), not with this base: their code, pages and tests are not in this package.

<!-- status -->
| Area | Sections | Status | Evidence | Notes |
|---|---|---|---|---|
| Files, ids, resources, words, data | 2 | built | `engine/v2/tests/stage1-load.test.mjs`, `engine/v2/tests/d1-data.test.mjs` | |
| Story, links, visits, chapters, clocks, timelines | 3 | built | `engine/v2/tests/stage3-story.test.mjs` | one stage slot |
| Blocks, uses, components, repeats; seals and promoted inputs | 4.1 to 4.5, A9.4, A9.5 | built | `engine/v2/tests/stage4-drawing.test.mjs`, `engine/v2/tests/w4d-placement.test.mjs` | |
| Kits and kit experiences | A14.1, A14.2 | built | `engine/v2/tests/w5k-kits.test.mjs` | |
| Variations and templates | A14.3 | built in part | `spec/2.0/04-blocks.md` | the template tool comes with the kit, in its own repository |
| Values, formulas, controls, events, machines, actions | 5 | built | `engine/v2/tests/stage2-core.test.mjs`, `engine/v2/tests/stage2-formula.test.mjs` | |
| Drawing, looks, layers, clips, bindings | 6 | built | `engine/v2/tests/stage4-drawing.test.mjs`, `engine/v2/tests/w4d-motion.test.mjs` | |
| Sound and music (core) | 6.10 | built | `engine/v2/tests/stage5-sound.test.mjs` | sound byte budgets (A10.3) not built |
| Layouts, layout plans, fitting, content tiers, themes, languages | 7 | built in part | `engine/v2/tests/stage6-fit.test.mjs`, `engine/v2/tests/a1-plan.test.mjs`, `engine/v2/tests/a2-ladder.test.mjs` | line breaks at spaces and line feeds only (no UAX #14 tables); a plan that repeats a list is solved while playing only |
| Rules, rule packs, waivers, precedence | 8 | built | `engine/v2/tests/check-rules.test.mjs` | rules that files cannot prove are listed `not-run` (A11.9) |
| Transactions, clock, limits, editor rights, changes | 9 | built in part | `engine/v2/tests/w2e-transaction.test.mjs`, `engine/v2/tests/limits.test.mjs`, `engine/v2/tests/v1-change.test.mjs` | some limits are not enforced yet; hosted change history waits for 2.1 |
| Shell, landmarks, focus order | 10.1 to 10.3 | built | `engine/v2/tests/stage7-shell.test.mjs` | |
| Grants | 10.5 | built | `engine/v2/tests/host-profile.test.mjs` | |
| Host API and the frame link | 10.6 | built | `engine/v2/tests/stage6-host.test.mjs`, `engine/v2/tests/x5-frame-link.test.mjs`, `engine/v2/tests/browser/frame-link-browser.mjs` | |
| Host profiles | A10.1 | built | `engine/v2/tests/host-profile.test.mjs`, `engine/v2/tests/x5-format.test.mjs` | execution profiles are folded in (`capabilities`) |
| Packages and the packed page | A10.5, A10.6 | built in part | `engine/v2/tests/pack.test.mjs` | run served (update, withdraw) and the saving scope `site` are not built |
| The checker | 10.12 | built in part | `engine/v2/tests/check-coverage.test.mjs` | fonts and facts compared with the drawing are review rules; `E-PAINT` runs only with `--paint` |
| Capability `shell` | 10.1 | built | `engine/v2/tests/stage7-shell.test.mjs` | |
| Capability `page` | A3 | built | `engine/v2/tests/w5p-page.test.mjs` | |
| Capability `seats` | A4 | built | `engine/v2/tests/s1-seats.test.mjs` | seats on one page |
| Capability `ai` | A5 | built | `engine/v2/tests/ai-engine.test.mjs` | |
| Capability `fit` | A7 | built | `engine/v2/tests/a1-fit.test.mjs` | |
| Capability `ladder` | the `ladder` add-on | built | `engine/v2/tests/a2-ladder.test.mjs` | |
| Capability `rich-text` | the `rich-text` add-on | built | `engine/v2/tests/r1-richtext.test.mjs` | |
| Capability `lines` | the `lines` add-on | built in part | `engine/v2/tests/l1-lines.test.mjs` | the mouth's blend over `blendMs` (the look changes at once); word breaks use a bundled subset of UAX #29 |
| Capability `physics` | 10.7 | built | `engine/v2/tests/stage5-physics.test.mjs` | |
| Capability `motion` | 6.7 | built | `engine/v2/tests/w5m-motion.test.mjs` | |
| Capability `synth` | 6.10 | built | `engine/v2/tests/a2-audio-web.test.mjs`, `engine/v2/tests/a2-mouth.test.mjs` | |
| Capability `effects` | A1 | built | `engine/v2/tests/stage5-effects.test.mjs` | particles only |
| Capability `live-data` | 10.7 | built | `engine/v2/tests/d1-data.test.mjs` | |
| Capability `snapshot` | 10.7 | built | `engine/v2/tests/stage5-snapshot.test.mjs` | |
| Capability `media` | A2 | built | `engine/v2/tests/w6v-media.test.mjs` | |
| Module `chess` | 10.7 | built | `engine/v2/tests/w6l-chess.test.mjs` | |
| Module `chess-opponent` | A4.1 | built | `engine/v2/tests/s1-board.test.mjs` | |
| Declared widgets | A6.1 | built | `engine/v2/tests/stage7-shell.test.mjs`, `engine/v2/tests/browser/shell-browser.mjs` | |
| Receipts, scores, pressure cases | A8.1 to A8.4 | built in part | `engine/v2/tools/proof/README.md` | the proof tool writes play receipts |
| Rights table, checking a change, the trust record | A9.1 to A9.3 | built in part | `engine/v2/tests/v1-change.test.mjs` | review status and trust profiles are review rules |
| More rule kinds | A11 | built in part | `engine/v2/tests/check-rules.test.mjs` | |
| Migration from `hsvg/0.1` | A13 | built in part | `spec/2.0/reference/a13-migration.md` | the in-memory upgrade of A13.2 is not built: an `hsvg/0.1` file is refused with `E-HEADER` |
| Add-ons: presets, logic modules, capabilities | 12 | built in part | `spec/2.0/12-writing-an-addon.md`, `engine/v2/tests/x6-addons.test.mjs` | the door is built; the official add-ons come in their own release |
| Libraries and the starter library | A14 | built in part | `engine/v2/tests/x7a-library.test.mjs` | pick-and-use is built; the libraries come in their own repository |
| Conformance levels | A10.7 | experimental (2.1) | `spec/2.0/10-hosts-and-delivery.md` | |
| The ZIP profile | A10.5 | experimental (2.1) | `spec/2.0/10-hosts-and-delivery.md` | the path rules are built |
| Signed reviews and package signatures | A9.3 | experimental (2.1) | `spec/2.0/reference/a09-editing-and-trust.md` | |
| Play tests | A8.5 | experimental (2.1) | `spec/2.0/reference/a08-checking.md` | |
| Export adapters (`report`, `clickArea`, `endHoldMs`), served play, the `network` grant, the `site` scope | A10 | draft (2.1) | `spec/2.0/drafts/delivery-2.1.md`, `spec/2.0/drafts/delivery-2.1.json` | the packed page is the only output; the words are refused with `E-DRAFT` |
| Custom HTML widgets | A6 | draft (2.1) | `spec/2.0/drafts/custom-widgets-2.1.md` | |
| Clip extras (`wiggle`, `timeRemap`, `frameRate`, `holdFrames`, `composite`, a clip's `blendMs`) | 6.7 | draft (2.1) | `spec/2.0/drafts/clip-extras-2.1.md`, `spec/2.0/drafts/clip-extras-2.1.json` | refused with `E-DRAFT` |
| Choice places (`choiceRegion`, `choicesAtMs`) | 3.5 | draft (2.1) | `spec/2.0/drafts/choice-places-2.1.md`, `spec/2.0/drafts/choices-2.1.json` | refused with `E-DRAFT`; 2.0 shows choices with the `widgets` add-on's choices widget |
| Remote seats | A4 | draft (2.1) | `spec/2.0/drafts/remote-seats-2.1.json` | |
| Effect kinds other than particles | A1 | draft (2.1) | `spec/2.0/drafts/effect-kinds-2.1.json` | |
| Page actions `goSpot`, `grab`, `carryTo`, `giveBack` | A3 | draft (2.1) | `spec/2.0/drafts/page-actions-2.1.json` | |
| Logical blocks, nested experiences, split screen | 4 | draft (2.1) | `spec/2.0/drafts/structure-2.1.md` | |
| Content options and the `seed` selector | 7 | draft (2.1) | `spec/2.0/drafts/content-options-2.1.md` | the content axis keeps tiers |
| The scroll clock source (`clock.source`, `spanMs`) | 3.10 | draft (2.1) | `spec/2.0/drafts/scroll-clock-2.1.json` | an authored clock's `speed` and `paused` are built |
| Host pictures (`player.picture`) | 10.6 | built | `engine/v2/tests/k2d-doors.test.mjs`, `engine/v2/tests/browser/k2d-doors-browser.mjs` | the `bridge` plan is removed: runtime import is outside the standard |
| Goals, journeys, achievements, AI roles | `MODEL.md` | planned (2.1) | `spec/2.0/MODEL.md` | |

## The chapters

| Chapter | What it holds |
|---|---|
| [1. The model](01-model.md) | blocks, faces and body, the seven sentence shapes, the growth rule and the core boundary |
| [2. Files and names](02-files-and-names.md) | documents, folders, resources, words, data, ids and addresses, drawing files |
| [3. The story](03-story.md) | scenes and links, visits, endings, clocks, timelines, chapters |
| [4. Blocks](04-blocks.md) | block documents, uses, components, repeated uses, kits and templates |
| [5. Faces and body](05-faces-and-body.md) | values, inputs, outputs, formulas, places and controls, events, reactions, machines, actions |
| [6. The drawing](06-drawing.md) | marks, parts, looks, roles, layers, frames, clips, bindings, sound |
| [7. Representations and layouts](07-representations.md) | axes and selectors, sizes and shapes, layouts, fitting, theme, languages, tiers |
| [8. Rules](08-rules.md) | what a rule is; the rule language is in the tool reference |
| [9. The engine](09-engine.md) | the execution model, one writer, one clock, lifecycle, replay, limits |
| [10. Hosts and delivery](10-hosts-and-delivery.md) | shell, hosts, grants, host API, the door, packing, `needs`, the checker, accessibility |
| [11. Vocabulary](11-vocabulary.md) | core words, defaults, retired words, look-alikes |
| [12. Writing an add-on](12-writing-an-addon.md) | the door: presets, logic modules and capabilities, with worked examples |

## Add-ons and the tool reference

The core chapters describe the core only. Two other folders hold the rest:

- The official add-ons' pages (effects, media, page, seats, ai, widgets, fit, ladder, lines, rich-text, physics,
  live-data, motion, snapshot, synth), one beside each manifest. They come with the add-ons release, not with this
  base, so they are not in this folder here.
- [`reference/`](reference/README.md): the tool reference, for people who build editors, hosts, packers and
  checkers (A8 to A14: checking, editing and trust, hosts and packages, rules, publishing, migration, kits and
  libraries).

The machine files beside the sections are the single source for lists: `errors.json` (every code),
`renames.json` (every rename), `vocabularies.json`, `documents.json`, `capabilities.json` (the add-ons' manifests
come with the add-ons release), and the rule packs in `packs/`.

## History

Some sections name a decision as `D` and a number (for example D45). [The decision index](decision-index.md) says
what each number means for a reader of these files. The full log of why each choice was made is not published; the
spec says everything a reader needs.

## Open

Everything in this folder is open, under the repository's licence.
