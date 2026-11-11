# The 2.0 engine

Plays `hsvg/2.0` experiences. Plain ES modules, no dependencies. Node 20 or later for the tools and tests.

It stands on its own: nothing in `src/`, `web/`, `check/`, `tools/` or `schema/` imports from outside `engine/v2/`
(a fast test, `tests/w2e-load.test.mjs`, proves it). Other tools may import the schema tools from here.

## Commands

From the repository root.

```sh
node engine/v2/tests/run.mjs [filter]                       # the fast tests, no browser (about 20 s)
node engine/v2/tools/check.mjs <experience folder>          # the checker (10.12)
node engine/v2/tools/check.mjs <folder> --json              # the same, as one JSON array
node engine/v2/tools/check.mjs <folder> --only refs,story   # some rule families only
node engine/v2/tools/check.mjs <folder> --paint             # also painted extent (E-PAINT)
node engine/v2/tools/check.mjs <folder> --review            # also the review findings: W-NAME-HIDES-LABEL, W-TEXT-SMALL
node engine/v2/tools/pack.mjs <experience folder> <out folder>              # an Experience: one offline HTML file + package.json
node engine/v2/tools/pack.mjs <folder> <out> --host <host-profile.json>     # with a host profile in the page
node engine/v2/tools/pack.mjs <folder> <out> --accept-findings              # pack despite errors (tests only)
node engine/v2/tools/pack.mjs <folder> <out> --allow <owner.name>           # carry a module or capability add-on: you allow it as the page's host (spec 12)
node engine/v2/tools/pack.mjs --asset <asset folder> <out>                  # one HyperSVG, <out>/<id>.svg (spec 2.13, 10.14)
node engine/v2/tools/unpack.mjs <id>.svg <folder>                           # the asset folder back; pack again gives the same bytes
node engine/v2/tools/addon.mjs new <preset|module|capability> <owner.name> [--in <folder>]   # a working add-on with a test (spec 12)
node engine/v2/tools/addon.mjs check <add-on folder>          # the manifest and files, each finding with its fix, and the digest
node engine/v2/tools/addon.mjs pin <experience folder>        # pin every outside add-on it names, after review
# engine/v2/tools/addons.mjs: the add-on door's file side (digest, code review, loadAddons for a host in Node); the pure
# part is src/addons.mjs, the engine side src/addon-door.mjs. Starter presets and examples: engine/v2/addons/.
node engine/v2/tools/library.mjs new <name> --from <template> [--in <folder>]   # a new experience from a template (spec 4.10; hsvg new)
node engine/v2/tools/library.mjs add <library> <item> [--to <experience>]      # pick one library item (spec 4.8; hsvg add)
node engine/v2/tools/library.mjs check <kit folder>            # a kit alone: kit.json and its catalogue (E-CATALOGUE)
node engine/v2/tools/check.mjs <folder> --kit <kit folder>     # find a pinned or picked kit in that folder
node engine/v2/tools/preview.mjs <folder> [<folders> ...] <out>        # every size side by side at true size, and a free slot to drag
node engine/v2/tools/change.mjs apply <folder> <request.json> --right <id> --who <who> --source <source> [--out <folder>]   # a change request: eight checks, a new revision, a receipt; the flags are the authenticated by (9.10)
node engine/v2/tools/change.mjs make <before> <after folder | edits.json> --id <id> --right <id> --who <who>   # a request from an edit
node engine/v2/tools/change.mjs rights <folder>                # the rights table (A9.1)
node engine/v2/tools/check.mjs <folder> --rights               # the same rights table, as `hsvg check --rights`
node engine/v2/tools/check.mjs <folder> --previous-kit <kit>    # E-KIT-VERSION against the kit before a version change (engine/v2/tools/previous-kit.mjs)
node engine/v2/tools/proof/proof.mjs certify <folder> <out>     # play it in a browser; write a certificate (one browser)
node engine/v2/tools/proof/proof.mjs guide <folder> <out> <guide.json>   # play a guided path only; guides live in tools/proof/guides/
node engine/v2/tools/proof/proof.mjs baked <folder> <out>       # measure each baked page in a browser: text in its cell, above its floor
node engine/v2/tools/make-limits.mjs [--check]              # src/limits.mjs from spec/2.0/limits.json
node engine/v2/tools/make-owned.mjs [--check]               # OWNED_FIELDS in src/capabilities.mjs
# engine/v2/tools/strip.mjs: the packer builds the engine without its comments; sizes (10.7) are measured on that
# engine/v2/tools/meter.mjs: the packer and the add-on loader add a time check to every loop and function of a logic module
```

- The checker and the packer stop on errors (`E-`). Warnings (`W-`) are listed only.
- The change tool (9.10, A9.2) saves edits as new revisions. It runs shape, replay, revision, reach, type and bounds,
  rights, rules and apply, in order, and writes nothing unless all pass. The receipt goes beside the request
  (`<request>.receipt.json`) and, on a pass, into `evidence/changes/<target>/<id>.json`. A retry with the same id gives the first
  receipt. `--right`, `--who` and `--source` are the authenticated `by`; they replace the request's own.
- `--accept-findings` is for tests while a person decides. Never use it to publish.
- The packer bakes layout plans (7.5) that do not solve while playing: a derived frame per declared size beside the
  block's document (`<layout>-<W>x<H>.derived.svg`, listed in its `layouts`), and a fit receipt per frame in
  `<out>/evidence/`. A block whose `needs` (or the experience's) names `fit` solves while playing instead.
- `--json` gives severity, line, column, pointer, address, reason and fix for each finding (10.12). Plain output adds
  `:line:column`.
- After `set-limit.mjs` or a change to `spec/2.0/capabilities.json`, run `make-limits.mjs` or `make-owned.mjs`. A
  fast test fails while a generated file is stale.

The spec's tools, which use `schema/`. They are the authors' tools and are not in this repository
(`docs/spec-2.0-work/`); the generated files they write are, and the fast tests check them. An older file is upgraded with the upgrade tool (A13.3, `spec/2.0/reference/a13-migration.md`), which the base does not ship.

```sh
node docs/spec-2.0-work/tools/schema/make-schemas.mjs spec/2.0 [--check]   # spec/2.0/schemas from the machine files
node docs/spec-2.0-work/tools/schema/check-schemas.mjs spec/2.0 --strict   # schemas, examples, limits
node docs/spec-2.0-work/tools/schema/check-folder.mjs spec/2.0 <folder>    # every file of a folder against the schemas
node docs/spec-2.0-work/tools/upgrade/upgrade.mjs <old folder> <new folder> # hsvg/0.1 to 2.0
```

## Browser tests

Each one starts a browser. Run them **one at a time**, never in parallel. They need Playwright, which is never a
dependency: set `PW_PATH` to a folder that holds `node_modules/playwright`. `PW_CHANNEL=chrome` uses an installed
Chrome. `w9e4-press` and `w9e6-touch` need Firefox too.

This is the authors' full list. A suite that plays an official add-on, the kit or a library is not in this repository,
or stops at its start with a missing file: it runs in that repository. The suites that play the showcases are listed
apart, with the showcases. The npm package holds none of them.

```sh
node engine/v2/tests/browser/fault-browser.mjs        # a fault from a control, key, test hook or timer stops with a message
node engine/v2/tests/browser/x3-browser.mjs           # a key fault stops before its shortcut; size and changed:size; destroy leaves nothing
node engine/v2/tests/browser/input-browser.mjs        # controls by real mouse and keyboard, roles, focus
node engine/v2/tests/browser/mount-browser.mjs        # the host API: mount, read, set, pause, restart, destroy
node engine/v2/tests/browser/shell-browser.mjs        # the shell: stage, dialogs, the settings form, the table widget
node engine/v2/tests/browser/ai-browser.mjs           # the AI fixture: quick replies, written answers, intents
node engine/v2/tests/browser/fit-browser.mjs          # text fitting on a small fixture
node engine/v2/tests/browser/layout-browser.mjs       # an ad in four sizes: exact sizes, true size, resize
node engine/v2/tests/browser/plan-browser.mjs         # layout plans: an offer at five sizes, live and baked give the same boxes
node engine/v2/tests/browser/stage-browser.mjs        # a stage slot sized by values: drag handles, turn, theme and language by input
node engine/v2/tests/browser/preview-browser.mjs      # the preview page: a kit family side by side, the free slot dragged
node engine/v2/tests/browser/ladder-browser.mjs       # content tiers and give-way steps in four ad sizes, live and baked
node engine/v2/tests/browser/joins-browser.mjs        # layouts tried unreduced before give-way steps; the ladder read-out
node engine/v2/tests/browser/richtext-browser.mjs     # rich text: runs, styles, linked parts, highlight, the form's run editor, at three sizes
node engine/v2/tests/browser/drawing-browser.mjs      # slots, repeats, pivots, motion, snap by mouse and keys
node engine/v2/tests/browser/motion-browser.mjs       # route, morph, fill and stroke channels, slide, stop keep
node engine/v2/tests/browser/kit-ads-browser.mjs      # the kit ads, packed, each at its own size
node engine/v2/tests/browser/page-browser.mjs         # the page capability on a host page: hooks, signals
node engine/v2/tests/browser/media-browser.mjs        # the packed video explainer: chapters by key, the video plays, pauses, a marker
node engine/v2/tests/browser/board-game-browser.mjs   # the packed board game: chess for two by keyboard and pointer, illegal moves refused
node engine/v2/tests/browser/seats-browser.mjs        # seats: the board game against its program by keyboard, then an agent through the door
node engine/v2/tests/browser/host-outputs-browser.mjs # a packed page: player.on and the host API's on
node engine/v2/tests/browser/q1-player-browser.mjs  # pressed looks, true size in the stage, language from boot, shell outputs, layout, themed form
node engine/v2/tests/browser/lines-browser.mjs        # spoken lines: captions, words, the mouth, muted, Spanish, a recording
node engine/v2/tests/browser/x2-paint-browser.mjs     # paints only what changed: no writes when idle, a change while paused is painted
node engine/v2/tests/browser/baked-browser.mjs        # the proof tool measures the Ad Studio's baked pages: text in its cell, above its floor
node engine/v2/tests/browser/x1-browser.mjs           # a published page has no test hooks; a --test page keeps them
node engine/v2/tests/browser/x6-addons-browser.mjs    # an outside module, capability and preset from a folder outside the engine, packed and played
node engine/v2/tests/browser/f1b-tint-browser.mjs     # the door 2 example (example.tint): a draws binding and a content type, packed and played
node engine/v2/tests/browser/f1c-browser.mjs          # inputs of the Q1c review that froze or broke a packed page now stop with a fault message
node engine/v2/tests/browser/f1a-openurl-browser.mjs   # a link press with no host: one console line on a page alone, a notice in the dev player
node engine/v2/tests/browser/f2-slider-browser.mjs    # every showcase slider, wide and tall: a press on its path, a drag of its handle, touch and keys
node engine/v2/tests/browser/k1-dial-browser.mjs      # knobs (a slider with axis angle), wide and tall: grab, turn both ways, past 180 degrees and the ends, taps, touch, keys, reduced motion
node engine/v2/tests/browser/k2b-marks-browser.mjs     # icons by id drawn in an icon place; player.attach puts a use on a slot, it rides with the part, and goes back home
node engine/v2/tests/browser/k2d-doors-browser.mjs     # the doors of D39 and D40: an add-on control kind (role, value text, keys) and channel (binding, clip track); a host picture shown in a picture place
node engine/v2/tests/browser/k2f-asset-browser.mjs     # the HyperSVG (D45): the <img> rest pose, three <hypersvg-asset> cars on one player, inputs(), the latest change wins, events, the tall layout, mount(), refused assets
node engine/v2/tests/browser/k2g-hooks-browser.mjs     # a --test page's hooks: play and stop a clip and paint, each part's painted box, a fault stops the page
node engine/v2/tests/browser/k2g-sound-browser.mjs     # made sounds (audioSynths) really play: after a click each tone and noise node starts, and its stop comes after its start
node engine/v2/tests/browser/k2g-polish-browser.mjs    # a control's name on the page: its label, else its part's data-hsvg-label, else its drawn words (10.13); test.mjs --min-width runs the phone pass at that width
node engine/v2/tests/browser/k2h-test-browser.mjs      # test.mjs finds clipped text (T-TEXT-CLIPPED, wide and phone) and a sound that never starts (T-SOUND-SILENT); no false late settle under reduced motion
node engine/v2/tests/browser/t1-test-browser.mjs     # the test tool on a fixture with planted problems (--browsers all: Firefox and WebKit too)
node engine/v2/tests/browser/e1-controls-browser.mjs  # how controls reach people: a finger drag on a drag item, group names, Page Up and Down, the focus ring, the held drag
node engine/v2/tests/browser/e2-pointer-browser.mjs   # after a click or a tap no focus ring (Tab shows it); a disabled control shows the default cursor
node engine/v2/tests/browser/e3-dialog-browser.mjs   # a shell dialog is a real dialog: role, aria-modal, name; the rest inert; Tab cycles inside; Escape and focus return
node engine/v2/tests/browser/w9e4-press-browser.mjs  # a mouse press on a press or option activates it once, also in Firefox when the pressed look swaps the part (firefox, chromium)
node engine/v2/tests/browser/w9e6-touch-browser.mjs  # a finger's tap on a press or option activates it once, also in Firefox; a touch that moves 30 px activates nothing (firefox, chromium, webkit)
node engine/v2/tests/browser/f1a-quiz-focus-browser.mjs   # the quiz template by keyboard: after Next, focus is on the first answer (the group's tab stop)
node engine/v2/tests/browser/frame-link-browser.mjs   # the frame link: a host page drives a packed page in a sandboxed srcdoc frame
node engine/v2/tests/browser/x7a-library-browser.mjs   # the six starter templates made with hsvg new, and a page of picked items, packed and played by keyboard
node engine/v2/tests/browser/b4a-access-browser.mjs     # the accessibility contract (10.13): scene titles announced
node engine/v2/tests/browser/b4b-browser.mjs           # a control's label defaults to its only <text> (the flower's "Grow")
node engine/v2/tests/browser/b4c-motion-browser.mjs     # the motion examples (examples/2.0-motion): face, wipe and an authored clock, packed and played
node examples/2.0-ad-studio/tests/studio-browser.mjs  # the Ad Studio: presets, drag, edits, export and the preview page
node engine/v2/tests/bench/frames-bench.mjs <folder> 600 1 4 --full  # speed: ms per frame of an experience's steps in Node (advance 16 ms and paint)
node engine/v2/tests/bench/speed-browser.mjs <page.html> <scene,...>    # speed: fps and longest task at 4x CPU in Chromium (a --test page)
node skill/2.0/tests/water-cycle-browser.mjs          # the skill's worked lesson
node skill/2.0/tests/examples-browser.mjs [name ...]  # the skill's examples
```

To play an experience in a browser, serve the repository and open `engine/v2/web/index.html` (the browser tests
show how the page gets its files). `?start=<scene>` starts at a scene. `?clock=manual` stops the clock for tests.
`?partition=<id>` keeps a separate set of saved values.

A packed page is a published page: it has none of these hooks, and `window.hsvg` is the host API only (10.6). Pack
with `--test` (or `pack(..., { test: true })`) for a test page that keeps them: the address hooks above, and
`window.hsvg` as the whole page state (`player`, `advance`, `press`, `drawing`, `errors`). Its test hooks:

- `advance(ms)` moves the manual clock; `press(address, control, arg)` presses a control by id.
- `play(address, clip)` and `stop(address, clip)` play or stop a clip as the `play` and `stop` actions do, in one
  transaction, and paint. With no address (`null`), the scene on the stage. A clip the block does not have is the
  action's own fault, and the page stops (9.2).
- `boxes()` gives each part's painted box as drawn now (clips, glides and bindings applied), in page pixels from the
  stage's top left: `{<id>: {x, y, width, height, shown}}`, keyed `<scene>__<id>`. In the page itself every id also
  carries the player's mount prefix (`hsvg1__lamp__switch`), so several players on one page never reach each other's
  gradients, clips or uses; `boxes()` leaves the prefix out. Page ids are not addresses: a host names things by
  address. `shown` is false for a part that is not displayed, is hidden or has no size.

After a stop, every hook does nothing.

## How a host mounts a package

A packed page needs nothing: it carries its files, its checked flag and the capability modules its needs names.

A host page that plays a package itself calls `mount` from `web/mount-web.mjs` (it carries the checkers; the player
and a packed page do not):

```js
import { mount } from './engine/v2/web/mount-web.mjs';
import './engine/v2/src/capabilities/synth.mjs';   // each capability module the host serves
import './engine/v2/src/capabilities/widgets.mjs';   // (or src/capabilities/all.mjs for every one)
import { pagePort, aiPort } from './engine/v2/src/host.mjs';

const schemas = await fetch('/schemas.json').then(r => r.json());   // the host serves these
const host = mount(container, pkg, {
  schemas,                       // required: the objects of spec/2.0/schemas, as schema/load.mjs gives them
  host: profile,                 // the host profile (A10.1), or null
  partition: 'device',           // which saved values to use
  capabilities: { page: pagePort(document), ai: aiPort({ ... }) },   // ports, only for what the host grants
  onError: (e) => { ... },       // a fault that stopped play
});
host.on('entered', fn); host.read('score'); host.set('name', 'Ana'); host.pause('menu'); host.resume('menu');
```

- `pkg` maps each member path to its bytes (`Uint8Array`) and includes `package.json` (10.8).
- `package.json` lists every member with the SHA-256 digest of its bytes. `mount` checks them first: a changed
  member throws `E-PACKAGE-DIGEST`; a missing or extra one throws `E-PACKAGE-MEMBER`. Nothing plays.
- `schemas` is required. In Node, `loadSchemas(path.join(repo, 'spec', '2.0'))` from `schema/load.mjs` gives them;
  serve them to the page as JSON.
- A mounted package does not vouch for itself (10.9). Every document and drawing goes through the document checker
  first. A refused document throws with its code (`e.code`, `e.diagnostics`) before anything plays. An `hsvg/0.1`
  file is `E-HEADER`; upgrade it with the upgrade tool first.
- Capability modules register themselves when imported. The engine installs only those the package's needs names.
  A need with no module stops play with `E-NEEDS-MISSING`. Instead of imports, pass `modules: [...]` (the records
  the modules register).
- The host profile limits what the package may do: raised limits (`E-HOST-LIMIT`), grants (`E-GRANT`), axes
  (`E-AXIS-INPUT`), budgets, retention.
- The returned API is face-only (10.6): `on`, `read`, `set`, `emit`, `pause`, `resume`, `scene`, `restart`,
  `clearStorage`, `setPartition`, `destroy`. `set` is checked before any write.

### Frame link

A host can show a packed page in a sandboxed iframe and still use the host API. The two windows talk by
`postMessage` (10.6). Every packed page carries the page side (`web/frame-link.mjs`). The host page uses
`connectFrame` from `web/frame-host.mjs`, which is not part of a packed page.

```js
import { connectFrame } from './engine/v2/web/frame-host.mjs';

const iframe = document.createElement('iframe');
iframe.setAttribute('sandbox', 'allow-scripts');   // no allow-same-origin
const link = connectFrame(iframe);                 // makes a random channel token, sends hello
iframe.srcdoc = packedHtml;                        // or iframe.src = 'ad.html'
document.body.append(iframe);
await link.ready;                                  // the page answered: {v: 1}
await link.set('musicVolume', 0.2);
const score = await link.read('score');
const off = await link.on('entered', ({ name, detail }) => { ... });
await link.emit('start');
link.close();
```

- Every call returns a promise. A refused call rejects with an `Error` that carries the page's `code`.
- The calls are `set`, `emit`, `read`, `on`, `off`, `pause`, `resume`, `restart`, `scene`, `seat`, `clearStorage`,
  `setPartition` and `ladder`. Any other call is refused with `E-HOST-CALL`.
- The page takes the first `hello` from its parent window only. Every later message must carry the same token and
  come from the parent. Anything else is dropped with no reply.
- A message over 64 KiB is refused with `E-RANGE`.
- The page's `window.hsvg` stays out of reach: the frame is cross-origin to the host.
- `destroy` inside the page, or the page closing, ends the link.
- Test: `node engine/v2/tests/browser/frame-link-browser.mjs` (fast page-side tests: `tests/x5-frame-link.test.mjs`).

## What is in it

| Folder or file | Does |
|---|---|
| `schema/` | The schema tools: `load.mjs` (reads `spec/2.0/schemas`), `validate.mjs` (the JSON Schema subset), `json-strict.mjs` (the strict JSON reader), `check-document.mjs` (headers, keys, types and bounds of a document), `drafts.mjs` (grammar that is a 2.1 draft, refused with `E-DRAFT`), `xml.mjs` (the XML reader), `drawing-check.mjs` (the drawing rules) |
| `src/read.mjs` | The player's reader (stage 1): parses 2.0 files, words and data tables. It checks nothing and reads no kit, so a packed page carries no checker (D19) |
| `src/load.mjs` | Reads and checks 2.0 files against the schemas, with the limits the experience raises, and kits: it passes the schema and drawing checkers and the kit loader to `read.mjs`. The dev player, `mount` and the tools use it |
| `src/kit.mjs` | Turns a kit experience into the form the player plays (4.8, 4.9). The dev player loads it; the packer flattens a kit experience with it (`flattenKit`), so a packed page carries no kit loader |
| `src/limits.mjs`, `src/limits-runtime.mjs` | The format limits, raised limits and admission (9.8.1). `limits.mjs` is generated |
| `src/runtime.mjs`, `src/formula.mjs` | Values, formulas, reactions, machines, actions, steps that roll back (stage 2) |
| `src/story.mjs` | Scenes, links, timed links, visits, chapters (stage 3) |
| `src/drawing.mjs` | Frames, uses, bindings, clips, looks, the theme (stage 4) |
| `src/layout.mjs`, `src/fit.mjs` | Which layout applies (7.4), and text fitting (7.6) |
| `src/plan.mjs`, `src/capabilities/fit.mjs` | The layout-plan solver (7.5, A7.1) and the `fit` capability that exposes it as `engine.planSolver`. The core never imports the solver; the packer and the checker do |
| `src/tiers.mjs` | Content tiers (7.9) and the give-way rules' step tables and step order (8.4): the core's part. The drawing chooses each block's tier and wording; a baked page shows the packer's ladder result |
| `src/ladder.mjs`, `src/ladder-draw.mjs`, `src/capabilities/ladder.mjs` | The `ladder` capability: the give-way ladder at play (8.4, D2) and its text steps, floors. The drawing runs it for blocks that need `fit`; `drawing.ladder` reports each block's tier and steps. The packer runs the same ladder when it bakes |
| `src/richtext.mjs`, `src/richtext-draw.mjs`, `web/richtext-web.mjs`, `src/capabilities/rich-text.mjs`, `check/richtext.mjs` | The `rich-text` capability (6.8.1, 5.3.1, 7.7): runs, text styles, richText fields, linked text parts, read-along, and the form's run editor (`richTextEditor`, used by `web/widgets-web.mjs`); their checks |
| `src/storage.mjs` | Saved and session values, saved knobs and the story's memory (5.1.2, 3.8) |
| `src/host.mjs`, `src/host-profile.mjs` | The host API (10.6), the page and AI ports, and the host profile (A10.1) |
| `src/mixer.mjs`, `src/mouth.mjs` | Sound and music (6.10), and the loudness mouth |
| `src/lines.mjs`, `src/words.mjs`, `src/capabilities/lines.mjs`, `check/lines.mjs`, `web/captions-web.mjs` | The `lines` capability (6.11): `say`, word times and events, `spoken`, `ended`, `afterLine`, mouth cues; their checks and the `captions` rule (8.9); captions in the shell's `captions` overlay or a default box. `words.mjs` is the one word splitter. `web/audio-web.mjs` plays a line's recording |
| `src/capabilities.mjs` | The capability registry, the doors and the generated `OWNED_FIELDS` |
| `src/capabilities/` | One module per capability: `ai`, `effects`, `fit`, `ladder`, `lines`, `live-data`, `media`, `motion`, `page`, `physics`, `rich-text`, `seats`, `snapshot`, `synth`, `widgets` (the shell's HTML widgets; it was `shell`: the shell's structure is core). `all.mjs` imports them all. `live-data` checks rows a host feeds to a `live` field against its table and plays the fallback table otherwise; `motion` adds `dash` (a stroked shape's drawn share) beside route, morph, fill, stroke and stroke-width |
| `src/capabilities/seats.mjs`, `check/seats.mjs` | Player seats (A4.1): fillers, inputs, views, turns, time limits and fallbacks, the end of play, legal lists, programs, the agent door and the host port, exposed as `player.seats`; their checks |
| `src/capabilities/media.mjs`, `web/media-web.mjs`, `check/media.mjs` | The media capability (A2.1): video places on the block's clock, `mediaPlay`, `mediaPause`, `mediaSeek`, markers |
| `src/modules.mjs`, `modules/`, `check/modules.mjs` | Logic modules (10.7): the `call` action, step and time budgets, the host's module port and the reviewed lock; the `chess` module |
| `src/physics.mjs`, `src/effects.mjs`, `src/ai.mjs`, `src/ai-words.mjs` | The capabilities' own code |
| `web/player-web.mjs` | The player in a page: `boot()` for test and packed pages, `play()` |
| `web/mount-web.mjs` | `mount()` for hosts (10.6): checks the package, then plays it |
| `web/asset-web.mjs` | HyperSVGs in a page (D45, 10.14): `mount(element, assetSvg, inputs)`, the `<hypersvg-asset>` element, `inputs()`; one player for many assets. Not in the core bundle |
| `src/asset.mjs` | The HyperSVG file: write it, read it and check its record and digests (shared by the packer, `unpack` and the page) |
| `src/members.mjs` | A package's member rules (10.8) and a plain SHA-256, shared by the checker and `mount` |
| `web/input-web.mjs` | Controls by pointer and keyboard, roles, tab stops, names, focus (5.11, 10.3) |
| `web/audio-web.mjs`, `web/snapshot-web.mjs`, `web/widgets-web.mjs`, `web/page-web.mjs` | Page parts: sound, PNG snapshots, the shell's widgets, the page capability |
| `web/packed-entry.mjs` | The packed page's entry |
| `web/export-web.mjs` | A studio's "save changes" export: the edited input values as a change draft for `change.mjs make` |
| `check/` | The checker (10.12): one module per rule family, listed in `check/index.mjs`. Every code is in `spec/2.0/errors.json` |
| `tools/` | `check.mjs`, `pack.mjs` (10.8, 10.9), `preview.mjs` (every size side by side), `change.mjs` (change requests), `previous-kit.mjs` (the kit before a version change), `make-limits.mjs`, `make-owned.mjs`, `unpack.mjs` (a HyperSVG back into its folder, D45), `strip.mjs` (the production build's comment stripper), `test.mjs` and `test/` (one test for any experience: checker, Node walk, browser measures) |
| `tools/change/` | Change requests (9.10, A9.2): `request.mjs` (shape, replay, value checks shared by edit and play), `targets.mjs` (reach: inputs, `@<tag>`, waivers, reviews, kit pins, pointers), `rights.mjs` (the rights table, A9.1), `rules.mjs` (rules on the copy), `apply.mjs` (the eight checks and the receipt), `play.mjs` (play-time requests to a running player), `make.mjs`, `folder.mjs` (the copy in memory and digests, A9.3) |
| `tests/` | `run.mjs` and the `*.test.mjs` files (fast); `browser/` (one at a time); `bench/` |

## What is built

The one status table of 2.0 is in [`spec/2.0/README.md`](../../spec/2.0/README.md#status): what is built, built in
part, not built, experimental and a 2.1 draft, each with its evidence. A fast test (`tests/x5-status.test.mjs`)
keeps it true.

## Parity with the old engine

The authors compared this engine with the 0.1 player (`parity.mjs`, A13.3 rule 9): the same presses and time, scene
by scene. That comparison and its report stay with the authors, since 0.1 files were never public.

## Play-time rules worth knowing

- **Needs** are the union of the needs of the experience, its scenes, its shell and its blocks (10.11).
- **Names:** a role-prefixed field such as `action.text` is one name, in the engine as in the checker (5.3.1).
- **At mount**, every value's and input's `initial` must fit its type and bounds, else the mount faults (5.1, 5.3).
- **`changed:`** is queued only when a value, knob or setting differs (9.2 step 4).
- **Snap** (5.11): an accepted drop of a `snap` drag rests in the same step as the drop.
- **Repeated uses** (4.5) follow a changed list: kept keys keep their uses, new keys mount, gone keys leave after
  their exit lists. Duplicate keys are `E-ID-DUPLICATE`.
- **Focus** (5.11): after a scene change, focus is on the new scene's first control.
- **Resizable slots** (6.8 `size`, 5.10): a size binding gives a `<rect>` slot or region a box about its anchor; what
  is placed in it chooses its frame and layout again, with every value kept. A slider handle can write the values.
- **Picking by input** (7.1): an axis with `select: "input"` follows its value at once (shape, layout, content, language,
  theme). A pick outside the axis's options stops with `E-AXIS-INPUT`.
- **True size** (7.3): a booted page made only in exact sizes shows the size nearest the window at one unit per CSS
  pixel, centred, never scaled up. A page in a frame, or mounted by a host, fills its slot.
- **A resize** (7.3, 7.4) keeps each block's current layout while it applies and fits unreduced. A use whose kept
  layout takes give-way steps, or whose text comes out incomplete, chooses again in list order, as a fresh load at
  that size does (`web/player-web.mjs` `learnFits`; `tests/y3-resize.test.mjs`).
- **Outputs** (10.6, 5.16): in a dev or `--test` page, `window.hsvg.player.on(name, fn)` hears what the host API's `on`
  hears; in a published page, `window.hsvg.on(name, fn)` is the host API's `on`.
- **Layout plans** (7.5): a block that solves while playing solves when its frame mounts, before its uses mount, and
  again when its space changes. Parts move by a translate and a scale on their transform; a use's `<rect>` slot takes
  the solved box; a cropped or covering item sits in a group clipped to its box. A plan-only layout grows the block's
  viewBox to the space (7.4). Without the solver, a plan-only layout shows the nearest baked frame by aspect.

## Testing a 2.0 experience in one command

`engine/v2/tools/test.mjs` tests an experience folder, or a packed page, in one go:

```sh
node engine/v2/tools/test.mjs <experience folder | page.html> [--out <dir>] [--quick] [--speed] [--browsers all]
node engine/v2/tools/test.mjs --all [--only <part>] [--quick] [--baseline <dir> | --compare <dir>]
```

- It runs the checker, then plays the experience in the Node player: every scene it can reach, every control used.
- It packs the folder with the test hooks and opens it from `file:` in Chromium, wide (1280 x 800) and phone
  (390 x 844, touch). In each scene it measures text sizes, hit areas, names and values, radio groups, image
  containers, Tab order and focus marks, keys, clicks and taps, dialogs, reduced motion and fitted text.
- `--speed` runs each scene 5 s with the CPU 4x slower and a slider in use. `--browsers all` repeats the pass in
  Firefox and WebKit and lists differences against Chromium.
- Each finding is one line with a code (`T-TEXT-SMALL`, `T-HIT-SMALL`, ...). The report (`<name>.report.json`) and
  a JPEG per scene and layout go to `--out`. It exits 0 when there is no error.
- Playwright is a test tool only: set `PW_PATH` to a folder holding `node_modules/playwright`. Without it the Node
  part runs and the tool says so. Browsers run one at a time.
- A page packed without `--test` is tested through a copy with its hooks turned on. The page itself is not changed.
- The checker runs with `--review` here: W-NAME-HIDES-LABEL (a name without the visible words) and W-TEXT-SMALL (text
  under the floor where a layout's scale is known).
- Fast tests: `node engine/v2/tests/run.mjs t1-`. Browser test: `node engine/v2/tests/browser/t1-test-browser.mjs`.
