# A8. Checking

This is a reference chapter of the tool reference (`reference/README.md`): for people who build editors, hosts,
packers and checkers. A first experience needs none of it.

## A8.1 Receipts and evidence

A **receipt** is the result of one run. `run` says which: `check`, `fit`, `play-test`, `review`, `export` or
`change`. It names exactly what was run, on what, and what came out. Only the tool that ran writes it; a receipt made
by hand is not evidence.

```json
{
  "format": "hsvg/2.0",
  "kind": "receipt",
  "id": "summer-sale-728x90-fit",
  "run": "fit",
  "subject": "scene:summer-sale",
  "digest": "sha256:9f3c41d2e8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1",
  "profile": "ad",
  "date": "2026-11-04T14:05:00Z",
  "status": "reduced",
  "verdicts": { "geometry": "pass", "content": "complete", "layout": "changed", "reference": "not-run",
                "review": "not-run" },
  "selected": { "size": "728x90", "shape": "strip",
                "layouts": { "scene:summer-sale": "leaderboard" },
                "tiers": { "message.headline": "short" }, "options": { "headline-test": "warm" },
                "language": "en", "theme": "harbour-day" },
  "steps": [
    { "kind": "spacing", "name": "gap", "from": 16, "to": 10 },
    { "kind": "give-way", "rule": "harbour-ads/legal-fits", "subject": "field:legal.text", "step": "shrink", "to": 9 }
  ],
  "rules": [
    { "rule": "harbour-brand/fonts", "result": "pass", "proof": "files" },
    { "rule": "harbour-brand/cta-length", "result": "note", "proof": "files", "detail": "21 characters, at most 18" },
    { "rule": "harbour-ads/legal-fits", "result": "pass", "proof": "files" },
    { "rule": "hsvg-baseline/readable", "result": "pass", "proof": "files" }
  ],
  "unmet": [],
  "waivers": [],
  "packs": ["harbour-ads@1.0.0", "harbour-brand@2.1.0", "hsvg-baseline@2.0.0"],
  "score": 0.82,
  "authority": { "checker": "hsvg-check 2.0.0", "measurer": "chromium 131", "fonts": ["bitter-700", "inter-400"] }
}
```

| Key | Held by | Meaning |
|---|---|---|
| `format`, `kind` | every run | `"hsvg/2.0"` and `"receipt"`. |
| `id` | every run | Kebab-case, unique in the evidence. A re-run on one day takes a counter suffix, `-<n>` (`summer-sale-728x90-fit-2`). |
| `run` | every run | `check`, `fit`, `play-test`, `review`, `export` or `change`. |
| `subject` | every run | A typed reference (2.9) to what was run on: `scene:summer-sale`, `document:harbour-ad`, `play-test:cliff-delivery`. |
| `digest` | every run | The digest of what the receipt proves (A9.3). |
| `date` | every run | ISO 8601 date and time, UTC. |
| `status` | every run | One of the four statuses below. |
| `rules` | every run | One result row per rule: `rule`, `result`, `proof`, and `detail` when there is something to say. A `solvable` result adds `witness` (A11.1). |
| `selected`, `steps`, `shares`, `unmet` | `fit` | The choice on every axis, the steps taken, the shares and the subjects that could not be placed (A8.3, below). |
| `adapter`, `output`, `bytes`, `notCarried` | `export` | As A10.1 lists. |
| `previous`, `by`, `changes`, `errors` | `change` | As A9.2 lists. |
| `steps` | `play-test` | As A8.5 lists; the rules checked are rows of `rules`. |
| `profile`, `verdicts`, `waivers`, `packs`, `score`, `authority`, `kit` | any run | The host profile used; the separate verdicts (below); the waived rules with their reason and right (A11.6); the packs that applied, pinned (2.9); the score (A8.2); the checker, measurer and fonts that made the receipt; the kit version a re-check used (A14.1). |

- **Status** is one of: `pass` (every `must` rule holds, no give-way step used), `reduced` (every `must` rule holds;
  give-way steps were used), `incomplete` (a making run could not make a complete output within the rules), `fail` (a check
  found a broken `must` rule). Notes never change the status. A `must` rule that is `not-run` makes the status
  `incomplete`, never `pass`.
- **Separate verdicts.** Geometry, content completeness, layout change, reference match and review are reported
  apart, never folded into one pass. `content: "complete"` means every required field is present with an authored
  wording; it does not mean nothing gave way.
- **Rule results** are `pass`, `fail`, `note` (a `should` rule not met), `waived` or `not-run`, each with its proof
  kind.
- **An incomplete output** lists each unmet subject, the rule, the reason and what blocks it, and the single changes that would make
  the output, best first:

```json
"unmet": [
  { "subject": "field:offer.terms", "rule": "harbour-ads/terms-fit",
    "reason": "Needs 88 px of height; 61 px left at 9 px text.",
    "blocking": [ { "knob": "gap", "value": 10, "needs": 6 } ],
    "options": [ { "change": "Allow the step remove on offer.terms", "keeps": "removes" },
                 { "change": "Set gap to 6", "keeps": "outside" } ] }
]
```

  `keeps` says what a change costs: `in-range` (stays inside the kit's ranges), `outside` (leaves a range; a person's
  choice), `removes` (drops optional content). An incomplete output is marked so in every preview and is never
  exported as complete.
- **Evidence** is the stored set of receipts. A kit or package keeps it in `evidence/`, with the index
  `evidence/index.json`: `{"receipts": [{id, run, subject, digest, status}], "envelope", "measured": {<field>:
  {maxChars, minWidth, tiers}}}`. `envelope` names what was tested (sizes, languages, tiers, themes, content cases)
  and the declared limits (what the kit does not support). `measured` holds, per content field, the numbers a fit
  measured (7.6). Receipts are keyed by the digest of what they prove and the versions of the packs that applied; a
  receipt whose digest or pack versions no longer match is stale and is not counted.
- **Runs add their own keys.** A play test receipt adds the steps run and what was explored (A8.5). An export
  receipt adds the adapter, the output digest, the actual bytes and what was not carried (A10.1). A change receipt
  (A9.2) has the status `pass` or `reduced` when applied and `fail` when refused, and lists the changes; its `note`
  results are the `should` rules not met.
- Reports (an accessibility conformance report, a review sheet) are views of receipts, not separate records.

## A8.2 Recommendations and scores

A **recommendation** is a `should` rule. It never fails anything. It shows as a note to the editor and in receipts.

A **score** weighs recommendations. For one output, the score is the total `weight` of the `should` rules that hold,
divided by the total weight of the `should` rules that apply (waived rules and rules whose `when` is false do not
apply), rounded to three decimals. With no `should` rule applying, there is no score. A receipt may report it.

- Scores rank; they never gate. No status depends on a score.
- The player never reads scores. It chooses layouts and content by the rules of section 7.
- A tool that makes outputs (a fit, an export, a kit builder) may use scores to choose among outputs that all pass,
  and records the score in the receipt.
- A review heuristic is a `should` rule with proof `review`, often of kind `judgement`.
- A kit may carry packs of recommendations. They use the same rule kinds and strengths as any other pack.

## A8.3 Receipts and incomplete outputs

A fit leaves a receipt (section A8.1) with `"run": "fit"`. Its `selected` names the choice on every axis, and it
lists shares and steps:

```json
"selected": { "size": "160x600", "shape": "skyscraper",
              "layouts": { "scene:summer-sale": "skyscraper", "use:offer": "stacked" },
              "tiers": { "message.headline": "short" }, "options": { "headline-test": "warm" },
              "language": "de", "theme": "harbour-day" },
"shares": [ { "id": "media", "requested": 50, "effective": 50, "actual": 46.2 } ],
"steps": [ { "kind": "spacing", "name": "gap", "from": 16, "to": 12 },
           { "kind": "give-way", "rule": "harbour-ads/legal-fits", "subject": "field:legal.text", "step": "short" } ]
```

- **An incomplete output** could not be made within the rules. Every preview of it is visibly marked incomplete,
  the unmet subjects are listed with reasons and options (section A8.1), and the parts that fit are still shown.
- An incomplete output is never exported as complete. An export of a family leaves incomplete sizes out and says why.
- Being incomplete is not proof that nothing could fit. It says what blocked this search and which single changes would help.
- Incomplete outputs are kept in evidence, so the kit's envelope is honest about the sizes it does not support.

## A8.4 Pressure cases

**Pressure cases.** The checker fits every `must` size with six kinds of content. A field's length in them is
its `maxLength`, lowered by any `must` `limit` on it; a `should` limit only adds a note:

| Case | Content |
|---|---|
| `drawn` | the content as drawn |
| `short` | the shortest authored wording of every field |
| `rich` | the longest authored wording and every optional field |
| `longest` | every field at its `maxLength`, filled from the reserved word `sampleText` of that language (2.7); without it, the field's longest authored wording repeated to `maxLength` |
| `missing-required` | a required field left empty: the case passes when the checker reports `E-CONTENT-REQUIRED`; nothing is invented |
| `unbreakable` | a field holding one long unbroken word: the sample character `M` repeated to the field's `maxLength`. The case passes when the word fits, or when the output is incomplete and that is reported as non-blocking |

## A8.5 Play tests

**Experimental (2.1).** The play-test document and its harness is not settled in 2.0. No 2.0 tool proves it, it has no error code, and it may change in
2.1. A 2.0 file may carry its keys.

Some rules hold only while playing (A11.9). Play tests prove them.

**The play harness.** In explicit test mode the player exposes `window.hsvgTest`:

| Method | Does |
|---|---|
| `start(frameId, fixtures)` | Mounts the experience at that scene (the start scene when null) with the fixtures |
| `scene(slot?)` | The id of the scene a stage slot shows (the first by default) |
| `press(target)`, `longPress(target, ms)`, `key(code)` | A person's press, long press or key on a control target |
| `option(control, optionId)`, `slide(control, value)` | Picks an option; moves a slider to a value |
| `choose(linkId)` | Picks an offered choice link |
| `drag(target, points, ms)` | Drags along points `[[x, y], ...]` in the target's drawing coordinates over `ms` and releases |
| `signal(name, payload?)` | Delivers a granted page signal (A3.1), such as `signal('visible:signup')`. `signal('scroll', {progress, slot})` with `slot` sets that scroll-driven stage slot's measured progress instead (3.10), as in `{progress: 0.4, slot: 'story'}` |
| `page(boxes)` | Sets the page fixture: hook name to a box `[x, y, w, h]`, `"missing"` or `"ambiguous"`, and the window size |
| `reload()` | Reloads the page: the player is destroyed and mounted again with the stored values |
| `seat(seatId, filler, identity?)` | Fills a seat as one identity; `legal(seatId)`, `act(seatId, key)` and `leave(seatId)` use the agent door (A4.1) |
| `advance(ms)` | Moves the engine clock and runs every deadline due |
| `text(id)`, `look(id)`, `visible(id)`, `name(id)` | Reads what a person sees on a part |
| `channel(id, channel)` | Reads a part's motion channel value (6.7) |
| `soundCount()` | Sounds playing now |
| `rules()` | Per play-checked rule, its id and `pass`, `fail` or `not-run` at the current step |

Test mode is turned on by the host, never by content: `mount(container, package, {host, test: true})` exposes
`window.hsvgTest`. It drives the real input, clock and render paths. Production packs omit it. Harness input
(`press`, `longPress`, `key`, `option`, `slide`, `choose`, `drag` and the other person steps) counts as trusted person input
(5.15.4), so human-only actions can be play-tested.
Fixtures are closed literals: `values` and `saved` (address `<owner>/<name>` to a value, such as `quiz/seen`), `seed`, `now`, `reducedMotion`, `language`, `size`, `voice`,
`inputMode` (5.5), `page` (the page fixture of `page(boxes)`) and, for a kit's tests, `sample` (the sample kit experience
to mount). Anything else in a fixture is refused.

**Behaviour suites.** A play test is a document:

```json
{
  "format": "hsvg/2.0",
  "kind": "play-test",
  "id": "cliff-delivery",
  "start": {"scene": "cliff", "fixtures": {"seed": 7, "now": 0, "inputMode": "keyboard"}},
  "steps": [
    {"press": "parcel-button"},
    {"advance": 1200},
    {"expect": {"look": "robin-hero/mouth", "is": "open"}},
    {"expect": {"output": "onward"}},
    {"expect": {"output": "delivered", "is": true}}
  ],
  "rules": ["robin-riding/wheels-on-road", "delivery-stop/parcel-in-basket-or-delivered"],
  "explore": {"runs": 200, "steps": 100, "seed": 1}
}
```

1. `steps` use the harness methods. `expect` checks what a player sees or a host hears: text, a look, visibility, an
   accessible name, an output, the current scene. `{"output": <event>}` passes when that output event was heard since
   the last step; with `is`, it compares an output result. It never reads a sealed block's body.
2. **Rules checked by playing.** Every rule named in `rules` is checked after each settled step: a step
   after which the queue is empty and no deadline is due at the current time. Every harness method is a step,
   its name the key and its arguments the other keys: `{"press": id}`, `{"longPress": id, "ms": n}`, `{"key": code}`,
   `{"option": control, "id": optionId}`, `{"slide": control, "value": n}`, `{"choose": linkId}`,
   `{"drag": target, "points": [...], "ms": n}`, `{"signal": name, "payload": {...}}`, `{"page": {...}}`,
   `{"seat": id, "filler": kind, "identity": name}`, `{"act": seat, "key": k}`, `{"leave": seat}`,
   `{"reload": true}`, `{"advance": ms}`. An `expect` names one of
   `text`, `look`, `visible`, `name`, `channel`, `sounds` (a count), `legal` (a seat's list), `output`, `scene` (a scene id, in the stage slot) or `offered` (a choice link id) with `is`. Parts are named by path from the stage scene
   (`kitchen/door`, through its uses: `kitchen/cook/hat`), or from the shell as `shell/<path>`. An event output's
   `is` compares its last payload. The `size` fixture is `{"width", "height"}` in CSS pixels. A broken
   rule names the step, the scene and the rule. A failed `expect` fails the play test.
3. **Exploring.** With `explore`, the tester plays seeded random input sequences within the given budget and checks
   the rules after every settled step. The budget is `runs` × `steps`. A failure records the seed and the
   shortest failing sequence it finds by removing steps one at a time while it still fails. In run `r`, step `k`
   takes entry `mix(seed + r × steps + k) % n` (5.6.5) of the seat's legal list in document order (A4.1); shrinking
   removes steps from the end, then from the front, while it still fails. So the same seed gives the same run in
   every tool.
   Kits reviewed as `accepted` explore at least 200 runs of 100 steps; drafts may use less.
   The same seed always gives the same run. Running out of budget is `not-run` for an unproven rule, never a pass
   (A11.9).
4. Hooks never wait on wall time. Runs are deterministic: the same package, fixtures and seed give the same result.

**Receipts and evidence.** Every run writes a receipt (A8.1) with `run: "play-test"`:

```json
{
  "format": "hsvg/2.0",
  "kind": "receipt",
  "id": "cliff-delivery-2026-11-04",
  "run": "play-test",
  "subject": "play-test:cliff-delivery",
  "digest": "sha256:e40b17aa…",
  "date": "2026-11-04T15:02:00Z",
  "status": "pass",
  "rules": [
    {"rule": "robin-riding/wheels-on-road", "result": "pass", "proof": "playing", "detail": "20,000 settled steps"},
    {"rule": "delivery-stop/parcel-in-basket-or-delivered", "result": "pass", "proof": "playing"}
  ],
  "authority": {"player": "2.0.0", "profile": "player-2-0", "browser": "chromium 131"}
}
```

The kit's evidence is its stored set of receipts (A8.1). A kit or package reviewed as `accepted` must have, for its
current digest, a passing receipt for every rule whose proof kind is `playing` (review).

## A8.6 Review findings

Some warnings are review findings: `check.mjs --review` and `test.mjs` report them, and a plain check does not. They
point at a likely slip that the art may also mean on purpose.

- **A hard-coded theme colour.** With two or more themes, a drawn `fill` that is exactly a colour of the theme in use
  (the experience's or kit's `theme`, else the first), with no colour mark on the shape or a group around it (6.2.3),
  is `W-COLOR-UNMARKED`. A change of theme leaves it as drawn. White, black and a role that every theme paints alike
  are left out. The message names the role and the mark to add. (Stress test B: a hard-coded colour was missed by
  every check.)
