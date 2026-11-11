# Proof tools for 2.0 packed pages

These tools play a packed 2.0 page in a real browser and write a certificate: what the page showed, with
evidence, and what it could not show. They port the 0.1 tools in `tools/proof/` to the 2.0 packed page.

They use Node's standard library and an installed Playwright Chromium. Playwright is never a dependency: set
`PW_PATH` to a folder that holds `node_modules/playwright` (or `PW_CHANNEL=chrome` for an installed Chrome).
Each command starts one browser. Run them one at a time.

```sh
node engine/v2/tools/proof/proof.mjs certify <experience> <out> [--size 960x600] [--steps 150] [--time 120000]
node engine/v2/tools/proof/proof.mjs record  <experience> <out> <inputs.json>
node engine/v2/tools/proof/proof.mjs replay  <experience> <out> <trace.json>
node engine/v2/tools/proof/proof.mjs guide   <experience> <out> <guide.json>   # play a guide alone: scenes per area
node engine/v2/tools/proof/proof.mjs certify-all <work folder> [--only name,name] [--certificates <folder>]
node engine/v2/tests/run.mjs b4-proof                       # fast tests, no browser
node engine/v2/tools/proof/tests/proof-browser.mjs          # the tools in a browser (about 1 minute)
```

`certify-all` certifies every product in its list and writes `<name>.json`, `<name>.md` and an index `README.md`
to the certificates folder (`--certificates`). Packed pages and explorations go in the work folder. Keep it outside
the repository. A large experience takes about 7 minutes; most products take 1 to 3 minutes.

`products.json` and `guides/` name the authors' own products and are not in this repository. Give your own list with
`--products <file>`.

## Files

| File | Does |
|---|---|
| `format.mjs` | Canonical JSON, digests, control keys, the checks on an input and a trace |
| `build.mjs` | Packs a product with `engine/v2/tools/pack.mjs`; the page digest, sizes, capability bundle sizes, story |
| `browser.mjs` | Opens the packed page, observes it, drives it by keyboard and pointer; `record` and `replay` |
| `explore.mjs` | The explorer: keyboard paths from the start, a pointer pass, and the traces to each ending |
| `certificate.mjs` | The certificate and its Markdown |
| `proof.mjs` | The command line |
| `products.json` | The products to certify, with their viewport, budgets and guide (the authors' list; not in this repository) |
| `guides/` | Guides for the large experiences (not in this repository) |

## How a page is played

- The page is the exact packed file, opened from `file:` with `?clock=manual`. Its CSP is unchanged.
- Every request outside `file:`, `data:` and `blob:` is blocked and noted, and so are WebSockets and CSP violations.
- The tools read the page through its test hooks (`window.hsvg`): the scene, the engine clock, every block's values
  and inputs, the player's controls, and the outputs the player reports. Time moves only by `hsvg.advance(ms)`, in steps of at
  most 100 ms, as the page's own clock moves it.
- Input is real browser input: Tab to reach a control, then Enter, Space or an arrow; or a mouse click or drag at
  the control's box. No control handler is called directly. No event is made up.
- Control names and roles are Chromium's accessibility tree. Player controls are joined to it by DOM id. Other
  interactive nodes in the stage are the shell's HTML widgets (A6.1).
- Each path starts a fresh browser context: storage is empty.

## The explorer

- From each state it tries, by keyboard alone, every usable control: a press with Enter; each option (Tab to the
  group, arrows to the option, Enter); a slider one step (ArrowRight; ArrowUp on a spin button); a drag on each of
  its drops (Enter, ArrowRight to the drop, Enter); a checkbox with Space. After each use the clock moves
  `settleMs` (500). It also tries waiting `waitMs` (3000).
- A state is the scene, every block's values and inputs, the usable controls with their names and shown state
  (checked, pressed, expanded, value), the deadlines still to come (owner and time left), and physics bodies still moving (to 10 units). Time is
  not part of it.
- Order: a state in a scene not yet expanded first; then, turn about, the newest state and the oldest.
- Budgets: `stepBudget` (150 inputs tried), `timeBudgetMs` (120 s), `pointerBudget` (40). A step is one path.
- A control has a keyboard witness when its use showed an output, a scene or value change, or a change in what the
  controls show. Text fields are not explored.
- The pointer pass replays each keyboard witness's start state and uses the control once by the pointer.
- The first keyboard path to each ending (`story.ends`, 3.8) is recorded and replayed. With no ending reached, the
  longest path is.

## Guides

A large experience is too big to search from the start in the budgets. A guide (`proof-guide/2.0`, see
[FORMAT.md](FORMAT.md)) lists areas. Each area is played from the start, by keyboard, before the search. Every state
on the way joins the search's frontier, so the search also starts from deep scenes. A step names a control by its key
(`addr#cid`), a key, or a wait. `optional: true` skips a step whose control is not usable now (a gull to duck).
`products.json` names a product's guide. Write one with `proof.mjs guide`: it plays the guide alone and prints the
scenes each area reached and where it stopped.

## The certificate

`proof-certificate/2.0`: the product, the page digest, the policy, what was explored, `status`, `properties`,
`unknowns`, `failures`, the ending witness, an A8.1 play-test `receipt`, and `evidenceHash` (the digest of the
exploration). See [FORMAT.md](FORMAT.md).

| Property | Pass means |
|---|---|
| `finishable` | an ending scene was reached by keyboard alone (`not-applicable` when the story is endless) |
| `keyboard` | every control seen usable was used by keyboard alone; declared controls never on screen are listed by reason (`neverSeenBy`: dialog, other layouts, scene not reached, not shown) |
| `pointer` | every control with a keyboard witness was also used by the pointer |
| `scenes` | every scene was reached; else each one not reached is listed with why |
| `network` | `pass-observed`: no request outside the file on the paths explored |
| `errors` | `pass-observed`: no page error, CSP report or engine fault on the paths explored |
| `budgets` | `pass-observed`: the measures stayed within the limits (9.8, 10.11) on the paths explored; the core bundle within `coreBundleBytes` and each capability module within `capabilityBundleBytes` (gzip 9, from `limits.json`, as the packer measures them) |
| `replay` | each recorded trace played again to the same scene, time, values and outputs at every step (9.6) |

A result is `pass`, `pass-observed`, `fail`, `unknown` or `not-applicable`. Missing evidence is `unknown`, never
`pass`. `status` is `fail` with any fail, `incomplete` with any unknown, else `pass`. A product the packer refuses
fails (`packs`); when it packs with its findings accepted, it is still played.
