# Decision index

Code comments, tests and spec pages cite design decisions by number, such as `(D36)`. This page says what each
number means for a reader of these files. Each entry is a short title and its effect on the format, the engine or the
tools. The numbers are not continuous: only the decisions that public files cite are listed.

`release/verify.mjs` checks that every number a public file cites has an entry here.

- **D1 A slot's size may follow values.** A `<rect>` slot or region may take `[width, height]` from a formula while
  the page plays (6.8 `size`, 5.10). What is placed in it then chooses its frame, layout, tier and give-way steps again.
- **D2 The give-way ladder runs live.** A block that needs `fit` gives way while playing with the same steps,
  priorities and floors as at bake time (8.4), so a live page and a baked page match.
- **D3 True size.** An experience whose shape axis lists only exact sizes, shown alone as the whole page, is drawn at
  its true size and centred, never scaled up to fill the window (7.3).
- **D7 The add-on bundle limit.** The code of one add-on in a packed page is at most 10,000 bytes, gzip level 9
  (`capabilityBundleBytes`, 10.11).
- **D8 The core bundle limit.** The core player in a packed page is at most 120,000 bytes, gzip level 9
  (`coreBundleBytes`, 10.11).
- **D11 Later, not in 2.0.** Seats on different devices, hosted version history and a few other features wait for
  2.1. They are drafts outside the 2.0 registry (`drafts/`); 2.0 has seats on one page only (A4.1).
- **D18 A lean core.** Rich text, the give-way ladder at play and spoken lines are add-ons, not core. A packed page
  loads each one only when `needs` names it.
- **D19 The lean core goes further.** The packed page leaves out the schema and drawing checkers, because the packer
  has already checked every file. Kits are flattened at pack time, with every kit check and digest kept.
- **D22 Names never clash.** A word followed by `(` is a function; a word without is a value, so a value may share a
  function's name. An author's own name wins over a built-in value inside its scope, and the built-in stays reachable
  as `hsvg.<name>`; the checker warns when a name hides a built-in.
- **D23 Three kinds of add-on.** A preset (JSON values only), a logic module (a pure function, pinned by its digest)
  and a capability (code in the page, allowed by the host, pinned, within the size limit). Each is a folder with a
  `manifest.json`; an experience names it in `needs` (presets in `presets`). Outside names are `owner.name`.
- **D24 Libraries and templates.** A library is a kit: a versioned package of reusable items with a catalogue. A
  template is a starter experience that a tool copies and gives new ids. Both live outside the base repository (D41).
- **D25 No general bridge in 2.0.** 2.0 keeps the core door (values in, events out), the frame link (the host API
  across a sandboxed frame) and the add-on door. A general door for loading parts or code while a page runs is not
  part of the base (D40).
- **D26 Logic modules are trusted code.** A logic module runs in the page. It is admitted only by its digest
  (covering every file it runs) and the host's grant, with a step budget per player. It is not a sandbox.
- **D27 The growth rule.** The sentence shapes of the JSON are closed for all of 2.x. A new core word may only be a
  new value in an existing slot, added in a minor version when nothing else can do the job, and old files keep
  working. Everything else is an add-on, through the same door.
- **D28 The core boundary.** Every JSON word belongs to exactly one place: the core, an add-on, the tool reference,
  a 2.1 draft, or nowhere. Built-in add-ons use the door as outside ones do: settings in `addons.<name>`, actions as
  `call`, events as `<name>:<event>`. The drawing side is closed: an add-on never adds an SVG attribute.
- **D29 Optional ids and safe defaults.** `id` is optional on actions, reactions, bindings and clip tracks. Every word
  outside the first set a person learns has a default, so leaving it out is always safe.
- **D30 The core comes first.** This repository holds the core: no core schema names a built-in add-on, and the
  base ships none. The official add-ons come in their own release, `hypersvg-addons`.
- **D31 The core word list and the add-on door.** The author-facing words were sorted: 225 stay in the frozen core,
  the rest move to add-ons, the tool reference or the 2.1 drafts. It also settled two-dot motion ranges
  (`scale 1..1.2`), three inferences (an event a story link hears needs no `outputs` entry; `ends` is optional; the
  packer writes the `openUrl` and storage grant requests from use) and the add-on door's parts (`draws`, `humanOnly`,
  `contentTypes`, `grants`, `writes`, events as `<addon>:<event>:<subject>`). Its rule for words and formulas was
  replaced by D36.
- **D32 A knob is a slider measured round a centre.** Rotary input uses a slider's keys, accessibility, range and
  events; only the measuring changes (the pointer is read as an angle about the pivot). D33 names it `dial`.
- **D33 The final words.** The JSON has 29 words and the drawing 15 marks. In every list of values the first listed
  value is the default. A common wrong guess gets a checker hint that names the right word, never a second spelling.
  The control kinds are `button`, `toggle`, `choice`, `slider`, `dial` and `drag`.
- **D34 The drawing side stays closed.** No add-on value goes in a drawing mark. An add-on's settings live in the
  experience's JSON (`addons.<name>`).
- **D35 Decoration.** `data-hsvg-role="decoration"` is ornament: screen readers skip it, and it holds no control or
  text. Paint that may give way when a picture is simplified is `data-hsvg-layer="decoration"`.
- **D36 One formula rule.** `set ... to`, a use's `with` and every other value slot hold a formula, with text in
  single quotes (`"to": "'Right!'"`). Only words a person reads (`text` and `label` bindings, text slots in content)
  are plain words, with `{{ formula }}` inside.
- **D37 Text styles.** The text styles are `heading`, `body` and `caption`, in the theme and in
  `data-hsvg-text-style`.
- **D38 A fit box may be painted.** `data-hsvg-fit` may sit on a painted shape.
- **D39 The add-on growth slots.** Besides calls, events and settings, an add-on may add a control kind, a binding
  channel and a clip track channel. Each is a value carrying the add-on's name (`"kind": "acme.text-input"`) and needs
  the add-on in `needs`. No core word or mark is added.
- **D40 The closed box.** Nothing new arrives while a page runs, except data and pictures through the host API. A
  picture is checked data (its type, byte size and dimensions), shown in a picture place; it is never SVG or code.
- **D41 A lean base.** This repository holds the format (the core spec, and the engine with its player, checker,
  packer and tests), one tiny example per door, a short guide and the `hypersvg` command. Skills, kits, libraries,
  showcases and the official add-ons live in their own repositories.
- **D42 A stable standard.** Files made for 2.0 keep working in every later 2.x. The base changes only by a recorded
  decision, extensions never need a change to it, and versions follow semver.
- **D44 Delivery.** The npm package `@hypersvg/core` has no dependencies and needs Node 20 or later. It carries one
  `hypersvg` command (`init`, `check`, `test`, `pack`), the player for embedding, the schemas and the guide.
  Playwright stays optional.
- **D45 One base, one format, two outputs.** A reusable asset and a whole experience are the same format. An
  experience packs into one offline HTML page (an Experience); an asset packs into one HyperSVG (`pack --asset`), whose
  JSON rides inside as data. A HyperSVG shows its rest pose anywhere and plays when a page loads the player.
