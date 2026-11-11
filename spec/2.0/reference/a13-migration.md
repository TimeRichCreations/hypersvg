# A13. Migration

This is a reference chapter of the tool reference (`reference/README.md`): for people who build editors, hosts,
packers and checkers. A first experience needs none of it.

## A13.1 What is upgraded

| Source | How it is marked | Used by |
|---|---|---|
| `hsvg/0.1` documents | `"format": "hsvg/0.1"` | the open repository, the large showcase experiences, templates, skill examples |
| Runtime JSON before 0.1 | `"hsvg": "experience/0.1"`, `"scene/0.1"`, `"authoring": "short/0.1"` | older open-repository experiences |
| SVG drawings | `data-hsvg-version` `1.2`, `1.1`, `1.0` or `0.4` | the portal, the ad catalog, the character library |
| Sidecars | `"format": "hsvg-brief"` (and `-tokens`, `-policy`, `-motion`, `-receipt`, `-roles`, `-components`), version `0.1` | portal templates and ads |
| Ad catalog | `"card": "hsvg-ad-catalog/0.2"`, `provenance.json`, `catalog.json`, `aliases.json` | the ad library |
| Interaction chapters | `"hsvg-<chapter>": "1.0"` (and the trial's `0.1`) | portal mascots, tours, games |
| Packages | `hsvg-experience/1`, `hsvg-package/1` | portal exports |
| Others | `template/0.1`, `template-values/0.1`, `extension/0.2`, `lean-family-v1` | templates, extensions, Canvas.fit |

Sources without a field table here (`hsvg-package/1`, `extension/0.2`, `template/0.1` and the runtime JSON before 0.1)
are upgraded by the earlier tools first, as their rows say.

The interaction chapters were unpublished 1.0 contracts. Their mechanisms are now open sections of this spec.

## A13.2 Readers during the transition

1. Writers write only `hsvg/2.0` documents and `data-hsvg-version="2.0"` drawings.
2. **Migration lives in the converter, not in the reader.** A 2.0 reader reads 2.0 files only. It does
   not upgrade in memory: an old file is refused (rule 4), and the upgrade tool (A13.3) runs on a copy,
   with a report and a person. The player has no second code path.
3. An upgraded copy whose report has only mechanical rows plays. One with review rows or unconverted items opens in
   editors but is refused for play, with the upgrade report, until a person has confirmed
   every review row and fixed every item (rule 5 of A13.3).
4. Unknown versions fail: an unknown `format` is `E-HEADER`, and an unknown `data-hsvg-version` on a drawing is
   `E-SVG-ROOT`. The fixes of both codes name the upgrade tool (A13.3).
5. **Old marks.** The old page marks `data-hsvg-target`, `-spot`, `-grab` and `-action` leave the reader: the
   converter maps them to page hooks when a host page is imported (the `page` add-on; the step `page-marks.mjs`). The
   host page check names an old mark with its new spelling and the converter (`E-HOOK-MARK`). The old look marks
   `data-hsvg-states`, `-state` and `-state-name` are still read as aliases in drawings, each reported
   (`W-MARK-ALIAS`), until the transition ends. Writers never write them.
6. The transition ends at a version or date the person sets. After it, old versions are refused with a message that
   names the upgrade command.

## A13.3 The upgrade tool

```sh
hsvg upgrade <source> <destination> --report upgrade-report.json --check
hsvg downgrade <upgraded> <destination> --report <upgrade-report.json>
```

The base ships no upgrade command (D41, D42): this is the interface an upgrade tool offers, outside the base.
`hsvg downgrade` writes the source version from the upgraded files and the report; its exit codes are those of 10.12.
`--check` runs the round trip (rule 8) and the parity run (rule 9).

1. **It works on a copy of a whole experience**: every scene, component and settings document of the source, so links come from
   every scene's `go`. It never upgrades one scene alone. The destination must not exist. The source never changes; the tool compares the source's
   digests before and after.
2. **It admits the source first** with the rules of the source's own version. A source that fails its own checks is
   refused (`E-UPGRADE-SOURCE`): fix it in its own version first. The digest in each `source` entry of the report is
   the source's own integrity digest when its format has one, else the SHA-256 of its bytes.
3. **It names every rename.** The report lists each change: source file and pointer, destination file and pointer,
   the rename-table row id (A13.4) and the treatment. Pointers are JSON Pointers in JSON files and `<id>` or
   `<id>@<attribute>` in SVG files, with `svg` for the root element. A removal has `"to": null` and keeps the removed
   value in `old`. One entry may cover every instance of one row in one file (`pointers`, a list); confirming it
   confirms them all.
4. **Treatments.** *Mechanical*: applied. *Review*: applied, and flagged for a person to confirm. *None* (no clean
   mapping): not converted; reported with path, reason and fix. *Dropped*: not carried; listed in the report, and
   never blocks. *Per-row*: the row leads to other rows, and each follows its own treatment. Nothing is dropped or
   changed silently.
5. **It reports what it could not convert.** The run status is `complete` (mechanical rows only), `review` (some
   review rows) or `incomplete` (some unconverted items). A `dropped` item never makes a run `incomplete`. The report
   is written where `--report` says, outside the destination folder, so it is never a package member. It never
   repeats a private path the tool removed; it names only the pointer. An unconverted item is left out of the output
   and listed. A person confirms a review row by
   setting its `confirmed: true`, and marks a fixed item `fixed: true` after fixing the output. A document with
   `trust.provenance.upgradedFrom` names its report path in `upgradedFrom.report` (A9.3), relative to the destination folder; the checker reads that
   report and, until every review row is confirmed and every item fixed, refuses the output with
   in the upgrade report, pointing at each one. Treatments in the table are defaults: one
   instance may need more care than its row (a `go` to a destination that is not a known list is unconverted although
   A-10 is review).
6. **It keeps ids.** It never renumbers. Ids change only by the renames the table lists (A-27). SVG ids never change, except that a component drawing's ids take the component's
   namespace (2.12) when its root id differs from the document id; the tool lists the map, and `hsvg downgrade`
   restores it. An `id` that only repeats its map key is dropped (the
   key is the id, section 5). Where 2.0 needs an id the source lacks, the tool makes one by a fixed rule
   (`<owner id>-<kind>-<n>`, `n` counting from 1 per owner and kind in document order) and lists it. The owner is the
   part, binding or document the new item belongs to; the kind is its 2.0 key or mark word (`region`, `binding`,
   `rule`, `link`, `reaction`, `action`, `use`). A link's id is `<scene>-<event>` instead, with the event in
   kebab-case (then `-2`, `-3` on a clash). An id over 48 characters (2.9) keeps its first 40 characters, then `-`,
   then the first 7 hex digits of its SHA-256 (the hash input is the full id's UTF-8 bytes). Every generated link id goes in `lists.generatedIds`. The ids in the
   examples of A13.5 are written by hand. File paths are kept.
7. **It is deterministic.** The same source gives the same output bytes and the same report.
8. **It round-trips where possible.** For every mechanical row, `hsvg downgrade` back to the source version
   reproduces the source: equal canonical JSON, and SVG bytes equal once renamed attributes are restored. The
   downgrade reads the report, which keeps what rounding and merging changed. `--check` adds this test
   (review). Review rows and unconverted items are exempt and listed.
9. **It checks behaviour.** When the source has a behaviour suite or recorded traces, the tool runs them on the old
   player and the upgraded files on the new player, and compares values, event order, scene changes and logical time.
   Pixels and audio samples are not compared. The tool converts the suite with the files (`state(id)` becomes
   `look(id)`). A difference fails, unless the report lists it as expected (a changed random draw,
   reaction order after a `go`) and a person has confirmed it.
10. **Reviews survive only exactly.** A review survives when downgrading the upgraded file reproduces the reviewed
    bytes. The trust record then keeps the old review and adds `upgradedFrom` (A9.3) to its provenance, and the tool
    appends a copy of the review with the new digest, the same `by` and `date`, and the note "carried by upgrade", so
    the review counts for the new digest. The tool decides this at upgrade time and records it in the report;
    later edits do not bring a review back. Otherwise the review is kept as history and no longer matches (A9.3).
11. **Value conversions are listed** with old and new values (seconds to milliseconds, merged sounds, random draws
    that change, A13.10).

The report is JSON with these keys:

| Key | Holds |
|---|---|
| `format` | `"hsvg-upgrade-report/1"`. |
| `source` | A list of `{format, digest}`, one per source format. |
| `status` | `complete`, `review` or `incomplete` (rule 5). |
| `renames` | One entry per rename (rule 3): `row`, `from` and `to` (each `{file, pointer}`), `pointers` (a list, when one entry covers every instance of a row in a file), `treatment`, `note`, `confirmed` (review rows) and `old` (the removed value, for a removal). `pointers`, `note`, `confirmed` and `old` are optional. |
| `lists` | An open map keyed by topic: each row that says "is listed" names its topic. The topics used here are `values` (rule 11), `generatedIds` (rule 6), `names` (row A-42), `shellCandidates`, `hostValues`, `focusOrder` and `expectedDifferences`. |
| `notConverted` | One entry per unconverted item: `file`, `pointer`, `row`, `reason`, `fix` and `fixed`. |

```json
{
  "format": "hsvg-upgrade-report/1",
  "source": [{"format": "hsvg/0.1", "digest": "sha256:91c4d2e7…"}],
  "status": "incomplete",
  "renames": [
    {"row": "A-19", "from": {"file": "scenes/stop-harbour/scene.json", "pointer": "/shows"},
     "to": {"file": "scenes/stop-harbour/scene.json", "pointer": "/bindings"}, "treatment": "mechanical"},
    {"row": "A-10", "from": {"file": "scenes/stop-harbour/scene.json", "pointer": "/on/press:onward/0/actions/1"},
     "to": {"file": "experience.json", "pointer": "/story/links/14"}, "treatment": "review",
     "note": "go became output event onward and link stop-harbour-onward", "confirmed": false}
  ],
  "lists": {
    "values": [{"file": "scenes/stop-harbour/scene.json", "pointer": "/clips/wave/durationMs", "old": 0.8, "new": 800}],
    "generatedIds": [{"file": "experience.json", "pointer": "/story/links/14", "id": "stop-harbour-onward"}],
    "shellCandidates": ["map button in 42 drawings"], "hostValues": ["bestScore"],
    "focusOrder": [], "expectedDifferences": []
  },
  "notConverted": [
    {"file": "behaviour.json", "pointer": "/states/root/states/play/states/memory", "row": "D-09",
     "reason": "History states have no 2.0 machine form (5.14).",
     "fix": "Store the last step in a value and enter it from a guarded transition.", "fixed": false}
  ]
}
```

## A13.4 The rename table

Words follow section 11. This is the one rename list: documents, drawings, sidecars, chapters, packages, earlier
words (W) and earlier error codes (K). This markdown table is the source. `renames.json` beside the spec is generated from it (row,
group, from, to, treatment) and has the same row ids. The last column is the default treatment: M = mechanical,
R = review, N = none (no clean mapping), D = dropped (listed, never blocks). A row that leads to other rows says "per
row".

### A. From `hsvg/0.1` documents

| Row | `hsvg/0.1` | `hsvg/2.0` | |
|---|---|---|---|
| A-01 | `"format": "hsvg/0.1"` | `"format": "hsvg/2.0"` | M |
| A-02 | `kind`: `experience`, `component`, `settings` | `experience` and `component` stay; a `settings` document becomes the experience's `settings` key (5.3.2) | M |
| A-03 | `kind: "scene"` | `kind: "scene"` (the file path is kept) | M |
| A-04 | settings item `value` (a stored value) and `step` | item `knob`; the value moves to the experience's inputs face as a knob with `step` (5.3.2); a `set` of it in a person's control becomes `player.setting`, and a reset of it `resetSaved` with `settings: true` (5.15) | R |
| A-05 | settings item `when: "play"` | same: the knob is a setting | M |
| A-06 | settings item `when: "make"` | same; the knob gets `editableBy` (default `["designer"]`), and an experience without rights gets the starter rights (A9.6) | R |
| A-07 | `kind: "layout"` | editor sidecar outside the format, never packed | M |
| A-08 | `title` | `about.title` | M |
| A-09 | `story.initial`, `story.scenes` | `story.start`, `story.scenes` (A13.11); `ends` are the scenes with no outgoing `go`; `lifetime` is `saved` when any value is kept, else `run`; a kept value that held the resume scene becomes `resumeAt` | R |
| A-10 | `go` action | `emit` of a declared output event plus a story-graph link (A13.11, A13.5). A destination that is a value with an `enum` of scenes, a computed value whose formula is a known list, or a column of a data table read with `lookup` gives one link per scene | R |
| A-11 | `go` with `transition` | the link's `transition`, with `transitionMs` | M |
| A-12 | `visit`, `return`; `returned` payload `{scene}` | links with `visit: true` and `return: true`; each return link gets a fallback link, whose destination is an unconverted item unless every way into the scene is a visit (3.7); payload `{scene}` | R |
| A-13 | `values`; `keep: true` | values; `lifetime: "saved"` (5.1.2) | M |
| A-14 | `computed` | `computed` | M |
| A-15 | `states` (statecharts) | `machines`; a state is a machine state (5.14) | M |
| A-16 | `on` (event to rules) | reactions, still under `on` (5.13) | M |
| A-17 | `after[].delay` (already milliseconds in 0.1) | `after[].delayMs`, same number | M |
| A-18 | `entry`, `exit` | same | M |
| A-19 | `shows` | `bindings` (6.8) | M |
| A-20 | show `state` (drawn state) | binding `look` | M |
| A-21 | actions `state`, `show`, `hide` | a value write plus a `look` or `visible` binding (5.15.1 has no imperative drawing actions) | R |
| A-22 | show `token` / `value` | binding `color` (6.8, 7.7) with `role` the token's name: only the paints that used `var(--token)` change | M |
| A-23 | show `fit` (`region`, `fontPx`, `minFontPx`, `maxLines`) | `fit` on the text binding (7.6); the region gets `data-hsvg-region="fit"` in every frame | M |
| A-24 | control `kind: "choice"`; a press control's `hold` | choice control (5.11), whose own `target` goes (each option keeps its target); `held` | M |
| A-25 | component `inputs` | inputs with `kind` `content`, `knob` or `trigger` (5.3); a counter used as a pulse becomes a trigger, and each caller's increment becomes `emit` as a trigger; an entry that reads a pulse at mount has no 2.0 form and is listed | R |
| A-26 | component `outputs` (formulas) | outputs of kind `result` (5.4) | M |
| A-27 | `instances` (`component`, `target`, `with`) | `uses` (`use`, `into`, `with`) (4.3); `into` is the `data-hsvg-slot` name of the element `target` named; a use id equal to a value or computed name gets the suffix `-use`, and its events follow | M |
| A-28 | `each` (`items`, `key`, `component`, `region`, `with`) | a repeated use: a `uses` entry with `use`, `into`, `with`, `items` and `key` (4.5) | M |
| A-29 | `instances['x'].out` in formulas | `uses['x'].out` (5.4) | M |
| A-30 | `tokens` | colour roles in the experience's own `themes`, or its kit's (7.7): a token named like a core role maps to it; every other token becomes a role of its own name, so a character's colours never follow `surface` or `ink` | R |
| A-31 | `sounds` (`file`, `volume`) | one sound resource per file; `volume` becomes gain where it is played | R |
| A-32 | `data` tables, `words` | data and words resources; the default language is the `language` key (2.7) | M |
| A-33 | `extensions` | `needs`, derived from content (10.11); a capability no content uses is listed | M |
| A-34 | extension fields (`physics`, `audio`, `audioMouth`, `audioSynths`, `snapshot`) | the capability's 2.0 grammar (10.7); a physics burst that only emits becomes a `particles` effect (A1.1) with `start: "play"`, made in a new empty group `<layer>-particles` after the layer, whose transform fits the burst `viewBox` into the layer's box (meet) in each drawing; `audioMouth` (a mouth moved by loudness) and `audioSynths` (made sounds) keep their names under the `synth` capability (`capabilities/synth.json`; the 0.1 extension `audio` is the 2.0 capability `synth`), times in ms | R; N where a manifest does not cover a field |
| A-35 | `audioPlay`; clip `period`; glide `ms` | `sound` with `group`; `periodMs`; `durationMs` (6.7) | M |
| A-36 | `aiSeats`, `aiAsk` | character seats with the `ai` grant (A5.1); `ask` | R |
| A-37 | `audioSettings` (drawn panel), `aiSettings`, `tuneSettings` | the `open` action on a dialog slot (10.1) with a `form` or SVG widget (A6.1); until a shell exists, the drawn panel stays in its scene, shown by a value through a `visible` binding, its controls changing settings with `setting` (5.15) | R |
| A-38 | `drawing` (one SVG, or `wide` / `tall`) | `drawing`, or `layouts` with `when` `wide` and `tall` (7.4); the experience gets the shape axis of 7.1 (`wide` from aspect 1, `tall` below) | M |
| A-39 | scene field `inputMode`; built-ins `now`, `elapsed`, `reducedMotion`, `muted`, `volume` | ambient inputs (5.5); a `set` of `muted` or `volume` becomes `player.setting` | M |
| A-40 | `logic` declarations and `logic/*.js` files | a reviewed registry module named in `needs` (10.7, A9.3) | N until a reviewed module exists |
| A-41 | shared values a host set with `player.set` | none exposed; the report lists them for the author to move onto the inputs face (10.6) | R |
| A-42 | ids, value names, formulas, templates | unchanged (decision 3), apart from the renames of A-27 and hyphenated value names, which become camelCase and are listed (`lists.names`; a collision, such as `a-b` and `aB`, is unconverted); an `id` equal to its map key is dropped | M |
| A-43 | focus order by `controls` declaration order | focus order by document order of targets (6.5); the tool reports every scene where the two orders differ | R |
| A-44 | two clips that write one channel of one target | the same `lane`, named after the target (6.7) | R |
| A-45 | a clip with no tracks, used as a timer | a machine `after` timer (5.14) | R |
| A-46 | `audio` extension keys: the mix (`groups`, `mutes`) and a scene's `audio.music` (`name`, `fade`) | the core mix on the experience (6.10); the scene's `music` with `sound` and `fadeMs` | M |
| A-47 | a reaction key `physicsEvent:<event>:<body>` with an optional percent-encoded `:<other>` | `physics:<event>:<body>` (10.7); the other part becomes the guard `event.other === '<other>'`, joined to the reaction's own guard with `&&` | M |
| A-48 | a reaction to `ended:<clip>` (0.1 fired it only when the clip finished; `stop` and a new `play` dropped the clip silently) | the same reaction with the guard `!event.interrupted`, joined to its own guard with `&&` (5.12: 2.0 also fires it, interrupted, on stop and replay); a timer clip's `Stop` (A-45) returns to idle without its ended event | M |
| A-49 | an event a component emits that a parent hears as `<instance>.<event>` (0.1 passed every emitted event up) | an output event of the component, `{"kind": "event"}` (5.4, 5.12: only a declared output event leaves a block) | M |
| A-50 | values, knobs or a graph with `keep` or a stored lifetime (0.1 kept them on the device without asking) | the experience asks for the `storage` grant with the `session` and `saved` scopes it uses (5.1.2, 10.5) | M |
| A-51 | a drag control's `accept` (0.1: whether the item snaps onto the drop; every hit still sent `event` with the drop) | removed, so every hit sends `event` as before and the item goes home (5.11); with `accept` other than `false`, the snap is not carried and the row is reviewed | M, R |
| A-52 | a channel binding whose value 0.1 checked only at play (the 0.1 player stopped with a fault, `E-MOTION-RANGE`, when the value left the part's motion range; it never clamped) | where the 2.0 checker cannot prove the range (5.6.7), the same formula inside `clamp(f, lo, hi)`, lo..hi being the part's motion range; every value 0.1 played is unchanged. A part whose range differs between layouts is listed, not clamped | R |
| A-53 | a control with `enabled` (0.1 drew its target at opacity 0.45 while it could not be used, 1 while it could, whatever the drawing had) | an opacity binding on the target, `(enabled) ? 1 : 0.45`, with the motion range `opacity(0.45 1)` widened to any range it had (6.2.1); an opacity binding the target already has joins it as `min(look, formula)`; a `choice` dims its group, the 0.1 target; a `transform` on the target moves to a new plain `<g>` around it. A target that is a look, or a component drawing's top `<g>` with a transform, is not converted. Without it 2.0 shows a disabled look only where the drawing has one (6.2.4) | M, R |
| A-54 | a clip that is not endless (0.1 kept every part at its last sampled value when a clip ended) | `loopMode: "hold"`, so the final pose stays until the clip is stopped or replaced (6.7). An endless clip (`loop: true`) never ends and is unchanged | M |

### B. From SVG 1.x drawings

| Row | SVG 1.x | `hsvg/2.0` | |
|---|---|---|---|
| B-01 | `data-hsvg-version` `1.2`, `1.1`, `1.0`, `0.4` | `2.0` | M |
| B-02 | `data-hsvg-kind` `artboard`, `component`, `compound`, `part` | `artboard` becomes `screen`; `compound` becomes `component` (D31); the others are unchanged; every element with a job gets `data-hsvg-kind="part"` (4.1) | M |
| B-03 | `data-hsvg-slot` on an empty `<g>` that a use mounts into | a slot (drawn place); `-slot-target` removed | M |
| B-04 | `data-hsvg-slot` (and `-slot-target`) on a node that shows a value | a part holding a content field, with a binding in JSON (A13.5) | M |
| B-05 | icon slot: `data-hsvg-icon-meaning`, `-icon-package`, `-icon-source`; pre-1.2 `data-hsvg-icon-slot` | an icon place with `data-hsvg-icon` (6.2.2), plus a content field with `contentType: "icon"` and an `icon` binding when the icon was editable; package and source go to the icon-set resource | M |
| B-06 | colour slot (`attr:fill`, `css:--…` on a shared colour) | a colour role on the part (7.7) | R |
| B-07 | `data-hsvg-states`, `-state`, `-state-name` | look marks (6.2.4), with `display="none"` on every look but the rest look; readers still accept the old marks, writers never write them | M |
| B-08 | `data-hsvg-state-review` `draft` / `redo` / `approved` and its note | a trust review `of` the look: `draft` to `draft`, `redo` to `blocked`, `approved` to `candidate` (A9.3); an `approved` never becomes `accepted`, since it does not say a person gave it | R |
| B-09 | `data-hsvg-inferred="auto"` / `"person"` | listed in `about.trust.provenance.inferred` / removed | M |
| B-10 | `data-hsvg-layer` (five bands) | `data-hsvg-layer` on the layer (6.4); paint outside the viewBox by a part that is not backdrop is listed, to fix by hand | M |
| B-11 | `data-hsvg-place` (library name) | a slot and a use in JSON (`uses[].use`, `into`) | M |
| B-12 | page marks `data-hsvg-target="signup"` (and `-spot`, `-grab`, `-action`) | `data-hsvg-hook="target:signup"` (and `spot:`, `grab:`, `control:`), converted when the host page is imported (A13.2) | M |
| B-13 | manifest `<metadata id="<ns>__hsvg">` | `about` (id, version), trust provenance; `variant.of` becomes a look or a layout | R |
| B-14 | built-in motion `<style … data-hsvg-role="motion">` | a clip (6.7) | R |
| B-15 | colour variables `--hsvg-primary`, `-secondary`, `-accent`, `-surface`, `-text` | `data-hsvg-color`: `primary` to `accent`, `secondary` to `ink`, `accent` to `accent-2`, `surface` to `surface`, `text` to the kit role `on-accent` (7.7), which the tool adds to every theme of the kit with the old colour | R |
| B-16 | `data-hsvg-role`, `-label`, `-pivot`, `-motion`, `-side`, `-follows` | unchanged; on the root `<svg>` or a component root, `-label` becomes the root `<title>` when there is none (else it is listed), and `-motion` is listed | M |
| B-17 | `data-hsvg-category`, `-tags` | `about.category`, `about.tags` of the owning document (2.5) | M |
| B-18 | a named `font-family` that is neither generic nor a font resource | a `font:<family>` need (10.11), or a font resource when the source carries the file | R |
| B-19 | paints `var(--name, #hex)`, in attributes or `style` text | the fallback colour, with `data-hsvg-color` naming the token's role (row A-30) | R |
| B-20 | `data-hsvg-scene` | dropped: the scene names its frames | M |
| B-21 | `data-hsvg-kind="anchor"` | a part with `data-hsvg-anchor="0 0"`, keeping its transform | M |
| B-22 | motion range `reveal(min max)` | `draw(min max)`, adding `pathLength="1"` to the element | M |
| B-23 | `<title>` inside a part; `aria-hidden="true"`; authored `role`, `aria-*`, `tabindex` | `data-hsvg-label`; `data-hsvg-layer="decoration"`; removed and listed (the player writes them, 6.5) | M |
| B-24 | ids in JSON with the namespace (`robin__near-wing`) | local ids (`near-wing`) | M |
| B-25 | a nested `<svg>` used as a coordinate system (not a placed copy or icon place) | a `<g>` with the same `transform`, and a clip path when it clipped | R |
| B-26 | a `<symbol>` that no `<use>` names | its content as a `<g display="none">`, listed; where something opened it, a `visible` binding shows it | R |
| B-27 | a mover (a part with `data-hsvg-motion`, or a channel target) that carries a `transform` | the `transform` moves to a new wrapping `<g>`; the drawing renders the same (6.2.1) | M |
| B-28 | an id outside the id grammar (camelCase, `_`, `.`) | the same id in kebab-case, with `-2`, `-3` on a clash; the JSON follows (2.12) | M |
| B-29 | an id with `__` in a screen drawing, outside a placed copy | `__` becomes `-`; the JSON follows (2.12) | M |
| B-30 | a scene drawing of an `hsvg/0.1` document with no `data-hsvg-version` | the 2.0 root marks: `data-hsvg-version="2.0"`, `data-hsvg-kind="screen"` | M |
| B-31 | `focusable`; an empty `data-hsvg-label` | removed (the player owns focus, 6.5; an empty label says nothing) | M |
| B-32 | `data-hsvg-kind="text"` (not a 1.x kind) | removed; listed, so a part with a job is marked `part` by hand | R |
| B-33 | looks on a component root (`data-hsvg-states` on the component `<g>`) | the looks wrapped in a new part `<namespace>__face`; controls on a look target that part, and press controls that land on one part become one (6.2.4) | R |
| B-34 | `data-hsvg-slot-target` on a mount that a use fills | kept as a slot; `slot-target` removed (a use, not a value, fills it) | R |
| B-35 | looks on a component of a screen drawing (`data-hsvg-states` on a component `<g>` that is not the root of a component drawing) | the component becomes a part: looks belong to parts (6.2.4), and a component defined in place is used like one (4.1) | R |
| B-36 | a use in a `<g>` slot (0.1 and runtime JSON drew the component with its drawing's own `x`, `y`, `width` and `height`: the viewBox origin less `x`, `y` sat on the slot's origin) | `translate(dx dy)` after the slot's `transform`, (dx, dy) being the root's pivot (default the viewBox centre, 6.2.1) less the viewBox origin plus the root's `x` and `y`; a pivot on the slot moves by (-dx, -dy), so clips on it turn about the same point. It draws as before. A component whose layouts need different moves, a root whose `width` or `height` is not its viewBox size (0.1 scaled it), and one slot that two uses need moved apart are listed | M |

### C. From sidecars and the ad catalog

| Row | Earlier | `hsvg/2.0` | |
|---|---|---|---|
| C-01 | `hsvg-brief` `fields`, `short`, `assets`, `icons`, `language` | content values with tiers (7.9); resource ids; icon field values; the language axis | M |
| C-02 | `hsvg-tokens` `colors`, `type`, `spacing` (with options and ranges) | theme values; ranges become knob bounds (7.7) | M |
| C-03 | `hsvg-policy` `parts` (`priority`, `steps`, `neverRemove`), `floorPx`, `removeBelowHeight` | rule pack: give-way rules, `keep` rules, `readable` (A11.5, A11.10); `removeBelowHeight` becomes a layout with `when: {"maxHeight": <n>}` whose layout plan leaves the part out (7.4); rules cannot read the space (A11.2) | R |
| C-04 | `hsvg-motion` clips (`duration`, `delay`, key `t` in seconds; targets `part:`, `role:`, `slot:`, `layer:`) | clips in ms, a clip `delay` added to every key time and to `durationMs`; targets as addresses, where `role:`, `slot:` and `layer:` targets expand to one track per matching part | M |
| C-05 | `hsvg-receipt` | receipt (A8.1) | M |
| C-06 | `hsvg-roles` (role word to content category) | role map: role word to job group | M |
| C-07 | `hsvg-components` (`resize`, `keepAspect`, `corners`, `padding`, `anchor`, `crop`, `versions`) | sizing, layouts and layout plans (7.4, the `fit` add-on) | R |
| C-08 | card `card`, `id`, `version` | component header and `about.version` | M |
| C-09 | card `kind`, `category`, `job`, `alsoJobs`, `tags` | rung mark, category, role (A13.5, catalog items), `about.tags`; `alsoJobs` words join the tags | M |
| C-10 | card `look` (`family`, `tone`, `on`; `on` becomes `ground`) | the `about` of the kit's theme (7.7); an item upgraded without a kit lists it | M |
| C-11 | card `layer` | a layer with `data-hsvg-layer` | M |
| C-12 | card `fields` (`type`, `required`, `case`, `fontRole`) | content fields (5.3.1) with `editableBy` `["copywriter", "marketer"]`; `case` becomes the text binding's `case` (6.8); `fontRole` becomes `data-hsvg-text-style` on the bound part (6.2.3) | R |
| C-13 | card `colors` (brand role to parts) | colour roles on those parts | M |
| C-14 | card `variants[]` (`file`, `shapes`, `viewBox`, `resize`, `minWidth`, `fit`, `sha256`) | layouts with `shape` ranges, `resize`, and text bindings with `fit` (A13.5, catalog items); `sha256` is the drawing digest | R |
| C-15 | card `members` | a component's members (top-level parts); a member's job follows the role order of A13.5 | M |
| C-16 | card `from` | `about.trust.provenance.upgradedFrom.from` (`derivedFrom` names only 2.0 sources) | M |
| C-17 | card `status`, `reviews` | trust reviews (A13.3, rule 10), against the card's source digest (A13.5) | M |
| C-18 | `provenance.json` | `about.trust.provenance`; free notes go to `notes`; private paths removed, and the report names only their pointers | R |
| C-19 | `catalog.json`, `aliases.json` | a kit of components; the kit's `aliases` map for old ids (A14.1) | M |
| C-20 | card `ground` (what the item sits on) | a `contrast` rule with `against` that colour role (A11.10) | R |
| C-21 | an item whose job is `action` with no control | a `press` control on its `surface` part (else its root part) with event `pressed`, and the output event `pressed` (5.11) | R |
| C-22 | `checks.json`, preview images | not carried: tools make new receipts and previews; listed | D |

### D. From the interaction chapters

| Row | Chapter JSON | `hsvg/2.0` | |
|---|---|---|---|
| D-01 | `"hsvg-<chapter>": "1.0"` (or `0.1`) | `"format": "hsvg/2.0"` and a document kind | M |
| D-02 | condition objects `{var,op,value}`, `{all}`, `{any}`, `{not}`; `{visits,op,value}` | formulas; a visit count reads the built-in `visits` (A13.10, 3.6) | R |
| D-03 | computed `{type,op,args}`, `cases`, helpers; `set.from` | formulas; `set` with `to` (A13.10) | R |
| D-04 | ordered text parts with number formats | templates with `formatNumber` (A13.10) | M |
| D-05 | `behaviour.variables`, `story.variables`, `chat.variables` | values (one store, as before) | R |
| D-06 | `persistence`: `none`, `session`, `device`, `host` | `lifetime` (5.1.2): `session` keeps its name, `none` becomes `run`, `device` becomes `saved`, and `host` becomes `saved` with the `storage` grant (10.5) | R |
| D-07 | `behaviour.inputs` (boolean, number, string, trigger) | inputs with `kind` `knob`, `content` or `trigger` | R |
| D-08 | `behaviour.states` (atomic, compound, parallel) | machines (5.14) | M |
| D-09 | `history` and `final` states | none: 2.0 machines have neither (5.14) | N |
| D-10 | `on` transitions; `after` keyed by decimal-ms strings | reactions; `after` with numeric `delayMs` | M |
| D-11 | `behaviour.actions` registry; `set`; `emit`; `play`, `stop`; `say` | core actions (5.15.1); `emit` of an output event | M |
| D-12 | `scroll`, `point`, `go-spot` | capability actions `scroll` and `point` (5.15.2), under `pageActions` grants (10.5); `go-spot` has no 2.0 form (`goSpot` is a 2.1 draft) and is listed | M; N for `go-spot` |
| D-13 | `add-to-cart`, `open-contact` | `invoke` on an `action` hook, human-only (5.15.4, A3.1) | M |
| D-14 | `start-story`, `start-tour` | links into a scene (section 3) | R |
| D-15 | `mode` (hero, companion, tour, chat, carried, minimised, closed) | presentation scenes joined by page signals (A3.1) | R |
| D-16 | `grab`, `carry-to`, `throw`, `hide`, `reveal`, `give-back` | `throw` becomes the physics capability's action; `grab`, `carry-to` and `give-back` have no 2.0 form (a 2.1 draft) and are listed; `hide` and `reveal` become a value write plus a `visible` binding (6.8) | R |
| D-17 | story beats, choices with `maxVisits`, routes, visits, `waitMs` | scene behaviour, choice links with `max`, a `start` list or link `when`, visit counts, timed links (A13.11) | M |
| D-18 | tour steps | scenes with page hooks (A5.2) | R |
| D-19 | `select-limb-driver`, procedural limbs, rig | none while rigging is on hold | N |
| D-20 | page targets, spots, floors, docks | page hooks and page conduct rules (A3.1, A11.10) | M |
| D-21 | lines (captions, word timing, mouth cues) | spoken lines (the `lines` add-on); cue times in seconds become ms | M |
| D-22 | clips chapter (motion channels v2) | clips (6.7), `timeRemap` included; the `trim` and `stroke-dash` channels are not carried (`draw` covers stroke draw-on) | M; D for those two |
| D-23 | `theme.json` | a theme (7.7) | M |
| D-24 | slots chapter (effect recipes, providers); dynamics; particles | effects with capability needs (A1.1) | M |
| D-25 | mascot chapter colour slots, parts and holds | colour roles, parts and looks | R |
| D-26 | gateway `inbound`, `outbound`, `requests` | the host API, triggers, output events and `network` grants (10.5, 10.6) | R |
| D-27 | chat (scripted answers, finder), AI chapter | finders and character seats (A5.1, A5.2) | R |
| D-28 | agent chapter (door, seats, turns, results) | player seats (A4.1) | R |
| D-29 | adaptive chapter | layouts and fitting, authoring only (section 7) | R |
| D-30 | `x-` keys | a tool sidecar outside the format, listed | M |

### P. From packages and other containers

| Row | Earlier | `hsvg/2.0` | |
|---|---|---|---|
| P-01 | `hsvg-experience/1` `manifest.json` | `package.json` (A10.5 table) | M |
| P-02 | `delivery.json`, `hsvg-interaction-lab/1` | refused, as in 1.x | D |
| P-03 | `hsvg-package/1` (`sizes`, `slots`, `moves.json`, `mascot`, `fluid`, `bytes`) | package and experience: frames, content fields and the input list, clips, kit content, a size range; `bytes` dropped | R |
| P-04 | `template/0.1` with typed slots and `example/` | a template kit (`about.template: true`); slots become kit inputs; the example becomes the sample kit experience (A14.3) | R |
| P-05 | `template-values/0.1` | a kit experience's `with` values | M |
| P-06 | `extension/0.2` manifest | capability manifest with `"format": "hsvg/2.0"` (10.7) | R |
| P-07 | `hsvg-reviewed/1` lock | the host's reviewed lock, pinning 2.0 bundles | M |
| P-08 | `lean-family-v1` (`master`, `assets`, `components`, `canonical`, `integrity`) | a kit with resources and one sample kit experience that shows the master with its drawn content (so mounted checks can run); the JSON master becomes an SVG drawing through a tool that round-trips (decision 4); the rows P-11 to P-23 below cover its parts | R |
| P-09 | runtime JSON and short forms | first the one-time map in `hsvg/0.1`'s `format-migration.md`, then table A, in one run | per row |
| P-10 | runtime `rules[]` (`on`, `if`, `do`, `every`, `after`) | reactions grouped by trigger (A13.5) | R |
| P-11 | Lean `master` with no scene nodes | a drawing assembled from `canonical.placements` and the component originals | R |
| P-12 | Lean `responsive.arrangements` (`when`, `layout`, `unit`, `name`, `aspect`) | plan-only layouts on the master drawing (7.4), in source order, `shape` from `when`, `scale` from `unit`, `label` from `name`; `aspect` dropped | R |
| P-13 | Lean `representations`, and a parent's choice of one | component layouts; the choice becomes the use's `layout` map (4.3) | R |
| P-14 | Lean text policy per representation (`min`, `preferred`, `max`, `maxLines`, `minReadable`, `wrap`, `lineHeight`) | the binding's `fit`, and each layout's own `fit` (7.4): `preferred` becomes `fontPx`, the larger of `min` and `minReadable` becomes `minFontPx`, `maxLines`, `wrap` and `lineHeight` carry over; a `max` above `preferred` is listed (2.0 never grows text past `fontPx`), and so is a floor below the host's | R |
| P-15 | Lean `contentOptions` and `omit` | content tiers chosen by `person` with a `default` (7.9); an omitted element's field gets `tier`; a text field's `maxLength` is its longest authored wording, listed for review | R |
| P-16 | Lean `weight` | the plan child's `weight` (the `fit` add-on) | M |
| P-17 | Lean `replacementCatalog` (`slots`, `candidates`, field maps, `required`, `protected`, `styleBindings`) | a replaceable use with `choices` and `pick` (4.3); each candidate a component whose inputs carry the slot's field names; `protected` fields get no `editableBy`; `styleBindings` become colour and type roles on the candidate's parts | R |
| P-18 | Lean `treatments` | components with their roles (`surface`, `backdrop`), placed as plan items with `fit: "stretch"` | M |
| P-19 | Lean `canonical.relationships` | `relation` rules, scoped with `layouts` (A11.2) to where they hold | R |
| P-20 | Lean scene node ids | SVG ids; an id repeated in one drawing gets its element's id as a prefix | M |
| P-21 | Lean `integrity`, `dependencies`, `runtimeVersion` | `upgradedFrom.digest` is the family's own integrity digest (A9.3); `needs`; dropped | M |
| P-22 | Lean role words `media`, `identity`, `message`, `surface`, `information` | the core roles `media`, `identity`, `message`; `surface` stays a part role; `information` becomes the `info`-group role its fields match (`specifications` when none fits better), for review | R |
| P-23 | Lean image `sourceRect` | the plan item's `crop` (the `fit` add-on); `patch` is listed | R |
| P-24 | runtime `data-hsvg-place` with `data-hsvg-as` whose parts the scene's own JSON names | the piece's drawing written in where it stands, as the 0.x player did: its root a component defined in place (4.1), its ids `<as>__<local>`, which B-29 then flattens. A use (B-11) would hide the parts the JSON names | R |
| P-25 | runtime event names (control `event` and `missEvent`, `emit`, marker `event`, rule `on`) | camelCase value names (2.9): `choose-comic` becomes `chooseComic` | M |
| P-26 | the runtime `save` extension's scene lists (`save`, `saveLists`) | `keep: true` on each listed declaration; review when the scenes list different values, since a kept value is kept in every scene | M |
| P-27 | runtime synthesised `sounds` (`wave`, `from`, `to`, `ms`, `volume`, `attackMs`, `releaseMs`) and `{"do": "sound", "name": …}` | `audioSynths` and the `audioSynth` action of `hsvg/0.1`, then row A-34; a file sound is not converted | M |
| P-28 | runtime `clipSets` and clips | the loader's copies (`<as>-<recipe>`, targets renamed) as plain clips; tracks and markers get ids `<clip>-track-<n>` and `<clip>-marker-<n>`; string key values become quoted literals | M |
| P-29 | runtime `controls` list | controls with ids `<target>-control-<n>` (`__` in the target written `-`); conditions become formulas; a choice's `options` map `{target: value}` becomes option objects with the target as id | M |
| P-30 | runtime `bindings` | `shows` with ids `<target>-binding-<n>`; `text` becomes a template (a `join` becomes `{{ }}` spans); each `fit.box` becomes a drawn `<rect>` `<target>-region-<n>` beside its text, in the text's coordinates, in every drawing; a text with a `transform` is not converted | M |
| P-31 | the runtime `type` control (`type` extension) with a drawn `keyboard` | reactions to the drawn keys' press events: a letter appends to the value while it is shorter than `maxLength`, `Backspace` returns to the text before the last key (a list value `<value>Typed`), `Enter` sends the field's event; typing on a physical keyboard into the field is not carried | R |
| P-32 | runtime `add` on a number with `min` and `max` | `set` with `clamp(<value> + (<by>), min, max)`: the 0.x add kept the value inside its bounds | R |
| P-33 | runtime `go` with `transition: "slide"` | `transition: "fade"` (links have cut and fade) | R |
| P-34 | runtime `every` and `after` rules | one machine per rule, `<scene>-timer-<n>`: `after` is a one-shot timer to a final state; `every` a self-target timer that re-arms from its due time; a guard becomes an `if` action | R |
| P-35 | `data-hsvg-slot` and `-slot-target` in a runtime drawing (template marks) | dropped and listed: no template fills a runtime experience, and its bindings write those texts | D |
| P-36 | runtime built-ins `muted` and `volume` | the ambient inputs of the same names (5.5); a `toggle` of `muted` becomes a `set` that row A-39 turns into `player.setting` (human-only) | R |
| P-37 | a runtime value or computed value whose name 2.0 reserves (5.9: `chapter`, `count`, `size` and the rest) | `own<Name>` (`ownChapter`): runtime JSON had none of those built-ins, so the name is the content's own value | M |

### W. Earlier words

Words an earlier spec or tool used, and the 2.0 word. "Lean" below is Canvas.fit Lean, an earlier layout engine whose ideas section 7 absorbs.

| Row | Earlier word or meaning | New word | |
|---|---|---|---|
| W-01 | `data-hsvg-slot` as a content input; template slots; value slots | **content field** with a binding | R |
| W-02 | effect slots | **effect** | R |
| W-03 | package manifest `slots` | input list | R |
| W-04 | mascot colour slots | **colour role** | R |
| W-05 | Lean replacement slot, swap contract | **replaceable use** (`choices`, `pick`, 4.3) | R |
| W-06 | zone, area, rect, focal | **region** (or a box `[x, y, w, h]`); the key `focal` is a point `[x, y]` (7.4, the `fit` add-on), not a region | R |
| W-07 | `data-hsvg-place` as a library name | a slot and a use in JSON (`uses[].use`, `into`) | R |
| W-08 | host-page anchor; `data-hsvg-target`, `-spot`, `-grab`, `-action` | **page hook** (`data-hsvg-hook`; the old marks are converted at import) | R |
| W-09 | registry `anchorRoleIds` | `attachTo` | R |
| W-10 | statechart state | **machine state** | R |
| W-11 | drawn state, `state` action and show, mood, control idle/hover/pressed | **look** | R |
| W-12 | review state, card status | review status (in the trust record) | R |
| W-13 | catalog look, tokens, style meaning of "look" | **theme** | R |
| W-14 | legacy `rules` array of event → actions | **reactions** (`on`) | R |
| W-15 | rules module | logic module | R |
| W-16 | policy rules, rules kit | **rule pack** | R |
| W-17 | Lean family rules | **layouts** | R |
| W-18 | variant (bare), alternate | **layout**, **tier** or **look**, by meaning | R |
| W-19 | "Version A/B" | two kit experiences (content options are a 2.1 draft) | R |
| W-20 | `data-hsvg-layer` | a **layer**: a `<g>` with `data-hsvg-layer` | R |
| W-21 | page layer | **overlay slot** | R |
| W-22 | frame category (borders, mounts) | the role `mount` (6.3) | R |
| W-23 | Lean layout frame | a `free` node of a layout plan | R |
| W-24 | Lean master, frozen original | original | R |
| W-25 | Lean "sealed" | **digest** (never the new seal) | R |
| W-26 | signed package | **signature** | R |
| W-27 | family (as a package) | **kit** (family stays a descriptive word) | R |
| W-28 | piece | component file | R |
| W-29 | cast, unit | no 2.0 word: a cast is a set of uses, a unit is a component | R |
| W-30 | editor roles | **editor rights** | R |
| W-31 | seat roles | seat kind | R |
| W-32 | the "inputs" dial | **liveness** | R |
| W-33 | `go` action | `emit` of an output event plus a link | R |
| W-34 | choice control | choice control (`"kind": "choice"`, D33) | R |
| W-35 | content category | job group | R |
| W-36 | wording ladder, content depth | **tier** | R |
| W-37 | billing licence | plan (outside the format) | R |
| W-38 | seconds (`*Sec` fields) | milliseconds (`*Ms`) | R |

### K. Error codes

Codes of earlier 2.0 drafts and their 2.0 code. A tool that meets an old code reports the new one.

| Row | Earlier code | 2.0 code | |
|---|---|---|---|
| K-01 | `E-EXPRESSION` | `E-FORMULA` | M |
| K-02 | `E-SETTING-GROUP` | `E-SETTING` | M |
| K-03 | `E-C-DRIVES` | `E-WORDS-DECIDE` | M |
| K-04 | `E-STATE-INITIAL` | `E-MACHINE-INITIAL` | M |
| K-05 | `E-STATE-TARGET` | `E-MACHINE-TARGET` | M |
| K-06 | `E-STATE-NOT-DRAWN` | `E-LOOK-NOT-DRAWN` | M |
| K-07 | `E-EACH-CAPACITY` | `E-REPEAT-CAPACITY` | M |
| K-08 | `E-EACH-NESTED` | `E-REPEAT-NESTED` | M |
| K-09 | `E-FILE-ID` | `E-ID-FILE` | M |
| K-10 | `E-SVG-REFUSED` | `E-SVG-UNSAFE` | M |
| K-11 | `E-WORDS-LANGUAGE` | `E-WORDS` | M |
| K-12 | `E-DATA-CELL` | `E-DATA` | M |
| K-13 | `E-REF-NAMESPACE` | `E-ID-SHAPE` | M |
| K-14 | `E-CONTROL` | `E-REF-UNKNOWN` or E-WRITER, by cause | R |
| K-15 | `E-KEY-REMOVED` | `E-KEY-UNKNOWN` (an earlier key in a 2.0 file) | R |
| K-16 | `E-WAIVER-RIGHT` | `E-RIGHTS` | M |

## A13.5 Conversions that need care

**`data-hsvg-slot`.** It keeps only its place meaning. A drawing alone cannot show whether a use mounts into a node,
so the tool decides by the marks on it: a `-slot-target` present means a value (rows B-04, B-05); an empty `<g>` with
none means a place (row B-03). A slot is an empty `<g>` that a use mounts into. Every other `data-hsvg-slot` marks a
value: the node becomes a part, and the value becomes a content field with a binding.

```xml
<!-- 1.2 -->
<text id="offer__headline" data-hsvg-slot="message.headline" data-hsvg-label="Headline">Rain? Bring it on.</text>
<g id="offer__badge-mount" data-hsvg-slot="badge"/>
<!-- 2.0 -->
<text id="offer__headline" data-hsvg-kind="part" data-hsvg-role="message" data-hsvg-label="Headline">Rain? Bring it on.</text>
<g id="offer__badge-mount" data-hsvg-kind="part" data-hsvg-slot="badge"/>
```

```json
"inputs": {"message.headline": {"kind": "content", "contentType": "text", "type": "string", "maxLength": 40,
                                "initial": "Rain? Bring it on."}},
"bindings": [{"id": "headline-text", "target": "headline", "text": "{{ message.headline }}"}]
```

The binding follows `-slot-target` or its default: `text` gives a text binding, `icon` an icon binding, and a colour
target (`attr:fill`, `attr:stroke`, `css:--…`) a colour role (B-06); other `attr:…` and `style:…` targets have no 2.0
binding and are unconverted. The JSON names the
part by its local id (`headline`, 2.12). A catalog slot name `<job>.<field>` is written with the role's camelCase
prefix (`beforeAfter.before`) as the content field's name `<role>.<field>` (5.3.1): the job is the role (6.3),
written by its role id (`headline` is an alias of `message`).
Deeper names such as `features.items.1.title` become a `rows` field and its column (2.9), and are flagged for
review.

**States to looks.** `data-hsvg-states`, `-state` and `-state-name` become the look marks. Everything that named a
drawn state follows: a `state` show becomes a `look` binding; a `state`, `show` or `hide` action becomes a value write
that a `look` or `visible` binding reads; a `state` clip channel becomes a look channel; the harness `state(id)`
becomes `look(id)`; `E-STATE-NOT-DRAWN` becomes `E-LOOK-NOT-DRAWN`. Statecharts are not looks: they become machines.

**Seconds to milliseconds.** Every time in seconds (`hsvg-motion` `duration`, `delay` and key `t`; mouth cue times;
the sidecar clock; any `*Sec` field) is multiplied by 1,000 and rounded to the nearest whole millisecond, halves up.
The field gets an `Ms` name (`duration` becomes `durationMs`; a key's `t` becomes the first item of the key, 6.7). Every value whose rounding changed it is listed in the report.

**`go` actions to story-graph links.** A scene reports an outcome; the graph links it (A13.11).

```json
// 0.1, in scene stop-harbour
"on": {"press:onward": [{"id": "leave-harbour", "guard": "delivered", "actions": [
  {"id": "save-stop", "set": "lastStop", "to": "'harbour'"},
  {"id": "to-hub", "go": "'hub-map'", "transition": "fade"}]}]}
// 2.0, in scene stop-harbour
"on": {"press:onward": [{"id": "leave-harbour", "guard": "delivered", "actions": [
  {"id": "save-stop", "set": "lastStop", "to": "harbour"},
  {"id": "to-hub", "emit": "onward"}]}]},
"outputs": {"onward": {"kind": "event"}}
// 2.0, in the experience's story graph
{"id": "stop-harbour-onward", "from": "stop-harbour", "on": "onward", "to": "hub-map",
 "transition": "fade", "transitionMs": 300}
```

The output event is the reacted-to event's name with its prefix removed (`press:onward` and `game.onward` give
`onward`) when that is a valid value name not yet taken; otherwise it is `go<Destination>` in camelCase (`goHubMap`).
The link id is `<scene>-<event>` with the event in kebab-case (`stop-harbour-go-hub-map`). The tool writes the 0.1 player's fade length (300 ms) as
`transitionMs` and lists it. A `go` whose destination is a formula
becomes an `emit` with payload `{"to": <formula>}`, where `to` is a string of at most 48 characters, and one link per
possible destination, each with `when`, plus a fallback. A known list is string literals and conditionals of string
literals. The tool writes one link per destination with the id `<scene>-<event>-<n>` (`n` counting from 1), then a
fallback link to the last literal. The generated links follow the scene's existing links, in reaction order. An
unknown list is unconverted: the tool leaves the action out and names it. This row is
*review*: in 0.1 a `go` stopped other machines' reactions to the same event; with an output they run before the link
fires (3.3). The parity run (A13.3, rule 9) shows any difference. The same `go` in many scenes (a map button drawn in
every scene) is reported as a shell candidate (section 10).

**Condition objects to formulas** (decision 3, A13.10). Operators map one to one: `eq` `===`, `ne` `!==`, `lt` `<`, `lte`
`<=`, `gt` `>`, `gte` `>=`; `all` `&&`, `any` `||`, `not` `!`. String values become quoted literals; references
become names. Order and laziness are kept, and parentheses are added.

```json
{"all": [{"var": "score", "op": "gte", "value": 3}, {"not": {"var": "phase", "op": "eq", "value": "practice"}}]}
```

becomes `"(score >= 3) && (!(phase === 'practice'))"`. The result must pass the formula grammar and budgets (5.6).

**`rules` arrays to reactions.** The old runtime ran every matching rule; reactions run the first passing alternative.
Rules with `every` or `after` become machine timers (5.14).
Rules with the same trigger therefore become one reaction with ordered `if` actions, never a list of alternatives.

```json
// runtime JSON
"rules": [
  {"on": "answered", "if": {"var": "correct", "op": "eq", "value": true}, "do": [{"add": "score", "by": 1}]},
  {"on": "answered", "do": [{"emit": "next"}]}]
// 2.0
"on": {"answered": [{"id": "on-answered", "actions": [
  {"id": "score-if-correct", "if": "correct === true", "then": [{"id": "score-up", "add": "score", "by": 1}]},
  {"id": "report-next", "emit": "next"}]}]}
```

The old `add` clamped silently; the new one refuses overflow. Where overflow was possible, the tool writes `set` with
`clamp(...)` and flags the row.

**Settings and tunables to knobs and settings.** A stored value that a settings item names, or an old `tunable` value,
becomes a knob on the inputs face, with the item's `step`, the value's bounds and the value's `initial`.
The settings item names it with `knob` and keeps its group, label and `when` (5.3.2). `when: "make"` also gives the
knob `editableBy` (row A-06). A `keep` on the old value becomes the knob's `lifetime: "saved"`. A local tunable
becomes a knob of its scene or component, and settings may name it once a container promotes it (A9.5).

**Catalog items** (rows B-15, B-16, C-09 to C-22).

- **Roles.** A part keeps its own `data-hsvg-role` (B-16). A slot job (B-04) or a member job (C-15) becomes the role
  only of a part that has none. Otherwise the job lives in the content field's name (`pricing.amount`), and the part
  keeps its finer role (`value`).
- **Shapes.** A catalog variant's `shapes` name ad shapes, but a 2.0 component chooses its layout by the slot it
  is placed in (7.4). The tool orders the variants by viewBox aspect and splits at the geometric mean of neighbouring
  aspects, rounded to two decimals: variants of aspect 1.27 and 2.2 get `{"maxAspect": 2.02}` and
  `{"minAspect": 2.02}`. The old shape lists go to the report for review.
- **One namespace.** The variants become layouts of one component, so their drawings take the component's
  namespace (A13.3, rule 6); the tool renames those ids and lists each one.
- **Fitting.** `resize` goes on its layout; the catalog's `insets` (`[top, right, bottom, left]`) and `ends` (the
  lengths of the two ends) mean what 7.4's do and copy unchanged. Each `fit.box` becomes a drawn `<rect data-hsvg-region="fit">` in
  that layout's drawing, with the id `<part>-region-1`; `lineHeight` and `maxLines` carry over. The measured
  values (`maxChars`, `minWidth`, `boxOverlaps`) are evidence: the tool measures again and writes a fit receipt. The
  field's `maxLength` is the largest old `maxChars` (review); a layout whose box cannot fit that text does not
  apply (7.4).
- **Source digest.** A card has no single digest. Its source digest is the A9.3 recipe applied to the card JSON
  without `reviews`, with its variant files as `files`. `upgradedFrom.files` keeps each old per-file hash.
- **Author and licence.** The tool never invents them. An item that joins a kit takes the kit's (A10.7).

**Packages to the one package.** `manifest.json` becomes `package.json`. The tool merges `drawing.files`, `chapters`,
`media` and `theme` into `members`, merges `capabilities`, `requires` and `modules` into `needs` (module digests go to
the trust record), and recomputes every digest. An `hsvg-package/1` archive also gets an experience document built
from its sizes, slots and moves (row P-03).

## A13.6 What a large experience needs

The largest showcase is one `hsvg/0.1` experience: 29 scenes, one settings document, 24 component
definitions, 13 data tables, one words language (`en`), 72 sound entries, 12 colour tokens, the extensions
`snapshot`, `audio`, `physics` and `ai`, plus `aiSeats` and `audioSynths`. It stays a plain experience after the
upgrade; it is not a kit experience.

1. **Mechanical:** headers, scenes to scenes, `states` to machines, `shows` to bindings, `instances` and `each` to
   uses and repeated uses, kept values to `saved`, `wide` and `tall` drawings to frames, data, words and ambient inputs
   (the scene `inputMode` field goes).
2. **Review:** every `go` becomes an output event and a link, so the story graph moves into `experience.json`; the
   settings values become knobs named by settings items, with their group descriptions; the 12 tokens become theme
   colour roles (the bike colour, which follows a value, becomes a `color` binding to a kit role); component inputs
   get a `kind`: content, knob or trigger (counters used as pulses become triggers); the 72 sound entries become
   one resource per file, with gain where each is played; `aiSeats` become character seats; `audioSettings` becomes
   the `open` action on a dialog slot and a settings widget, or stays a drawn panel until the shell redesign
   (row A-37).
3. **Capabilities.** `snapshot`, `synth` (the 0.1 `audio`), `physics` and `ai` have 2.0 manifests (`capabilities/`). A field their
   grammar does not cover is an unconverted item, and the upgrade is then `incomplete`.
4. **Parity.** The experience's behaviour suite must pass on the upgraded files, apart from confirmed expected differences
   (A13.3, rule 9).
5. **Not migration.** Folding the eight near-duplicate hero components into one definition with looks and
   layouts, a shell for the gear, map and help drawn in 44 scene drawings, and a kit with sealed blocks for stops,
   repairs and quizzes are redesigns. Each comes after the upgrade, as its own change with its own parity run.

## A13.7 What the ad library needs

1. Items still written to the Semantic Model v0.3 go to SVG 1.1 first with the existing 1.x converter, then to 2.0.
2. Each item's drawings follow table B and its card table C. The card's fields become the component's content fields;
   its variants become layouts per shape with their sizing and fitting; the five brand colours map to the
   theme's colour roles (row B-15).
3. Accepted items stay accepted only under A13.3, rule 10. Every other item is `candidate` at best until a person
   reviews it again.
4. `catalog.json` becomes a kit of components. The components go in the catalog kit, and each family kit pins it. Old
   ids stay readable through the kit's alias map.
5. Each ad family becomes a kit. Campaign ads made from it become kit experiences that pin it. Its policies become rule
   packs.
6. The upgrade carries only mechanisms. Which layouts, rules and scores work best is content in private kits and rule
   packs; no open document names it.
7. Every item must reach `library-ready` (A10.7). The recolour test and the two-copies test run as playing checks at mount.

## A13.8 Migration checklist

1. Copy or commit the source. Record its digests.
2. Run the source's own checker at its own version. Fix failures there.
3. Port the capabilities the source uses to 2.0 manifests, or accept them as unconverted for now.
4. Run `hsvg upgrade <source> <destination> --report upgrade-report.json --check`.
5. Read the report. A person confirms every review row and fixes every unconverted item in the destination.
6. Give real editor rights where the tool used a default (row A-06), and move host-set values onto the inputs face
   (row A-41).
7. Run the 2.0 checker, then the playing checks at mount at every frame.
8. Run the parity check on the source's suite or traces. It must match.
9. Run the play tests and store their receipts as evidence.
10. See which reviews survived the round trip. A person reviews the rest.
11. Seal finished definitions with `hsvg seal`, which records their digests.
12. Pack, and run each export the project uses with its host profile.
13. Keep the old files unchanged until the person signs off the move.

## A13.9 Older drawings

Readers of SVG 1.x drawings run the upgrade tool (A13) on a copy. The old look marks below stay readable as
aliases in 2.0 drawings, without an upgrade (A13.2); the old page marks are read on host pages only (A3.1). Writers
never write them. Every other row below is applied by the upgrade tool; table B of A13.4 holds these rows and more,
with row ids, and the tool reports by those.

| SVG 1.x | 2.0 |
|---|---|
| `data-hsvg-version` `1.2`, `1.1`, `1.0`, `0.4` | `2.0` |
| `data-hsvg-states` | dropped: the names come from the look children (an alias, checked to agree) |
| `data-hsvg-state` | dropped: the rest look is the one shown |
| `data-hsvg-state-name` | `data-hsvg-variant` (alias) |
| `data-hsvg-state-review`, `-review-note` | a review with `of` in the trust record (A9.3) |
| `data-hsvg-inferred` | the trust record's `inferred` list (A9.3) |
| `data-hsvg-slot` on an empty `<g>` a use mounts into | `data-hsvg-slot` with the same name; `-slot-target` removed |
| `data-hsvg-slot` on a node that shows a value | a part; a content field and a binding in JSON (A13.5) |
| `data-hsvg-icon-meaning`; pre-1.2 `data-hsvg-icon-slot` | `data-hsvg-icon` on an icon place; package and source go to the icon-set resource |
| `data-hsvg-layer` | `data-hsvg-layer` on the layer: `background` to `backdrop`, `effects-background` and `effects-foreground` to `decoration`, `content` and other names to `content`, `foreground` to `overlay` |
| `data-hsvg-category`, `data-hsvg-tags` | `about.category`, `about.tags` (section 2) |
| `data-hsvg-scene` | dropped: the scene names its frames |
| `data-hsvg-place` with `data-hsvg-as` | a slot and a use in JSON |
| `data-hsvg-kind="anchor"` | a part with `data-hsvg-anchor="0 0"`, keeping its transform |
| `--hsvg-*` colour variables in `<style>` | colour roles: `primary` to `accent`, `secondary` to `ink`, `accent` to `accent-2`, `surface` to `surface`, `text` to the kit role `on-accent` (7.7) |
| `<metadata id="<ns>__hsvg">` | `about` and the trust record; `variant.of` becomes a look or a layout |
| built-in motion `<style … data-hsvg-role="motion">` | a clip (6.7) |
| `reveal(min max)` range | `draw(min max)` |
| `<title>` inside a part | `data-hsvg-label` |
| `aria-hidden="true"` | `data-hsvg-layer="decoration"` |
| ids in JSON with the namespace (`robin__near-wing`) | local ids (`near-wing`) |

## A13.10 From JSON condition objects

Earlier portal files wrote conditions and computed values as JSON objects. The upgrade tool (A13.5) writes each one as
a formula. The mapping is exact unless the last column says otherwise.

| Earlier JSON | Formula |
|---|---|
| `{"var": "x"}` | `x` (hyphenated names become camelCase; the tool lists each rename) |
| `{"var": "x", "op": "eq", "value": 3}` | `x === 3`; `ne` `!==`, `lt` `<`, `lte` `<=`, `gt` `>`, `gte` `>=` |
| `{"all": [a, b]}`, `{"any": [a, b]}`, `{"not": a}` | `(a) && (b)`, `(a) \|\| (b)`, `!(a)` |
| `{"op": "add", "args": [a, b, c]}` | `a + b + c`; `sub` `-`, `mul` `*`, `div` `/`, `pow` `pow(a, b)` |
| `{"cases": [{"when": w, "value": v}], "fallback": f}` | `w ? v : f`, nested in case order |
| `{"literal": data}`, `{"object": {"k": e}}` | the JSON as a formula literal: `[...]`, `{"k": e}` |
| `{"item": "id"}`, `{"item": "value"}` | `item.id`, `item.value` |
| `{"visits": "quiz", "op": "gte", "value": 2}` | `visits['quiz'] >= 2` (3.6) |
| helper `count` with `filter: {field, op, value}` | `count(list, item.field === value)` |
| helper `sum`; `min`/`max` with `field` | `sum(list, item.field)`; `minBy(list, item.field).field`, `minBy(list, -item.field).field` |
| helper `any`, `all` | `count(list, item.f) > 0`, `count(list, !item.f) === 0` |
| helper `contains` | `count(list, item === value) > 0` |
| helper `pick`, `lookup` | `at(list, index, fallback)`, `at(table, key, fallback)` |
| helper `shuffle`, `random` | the same names with the 5.6.5 mixer. **Draws change**: the tool reports every use. |
| text parts `[{"text": ...}, {"var": "x", "format": {"decimals": 2, "grouping": true}}]` | a template: `"... {{ formatNumber(x, 2, true) }}"` |
| `{"call": "chess.legalMoves", "args": [...]}` inside a condition | a `call` action writing a value before the reaction (10.7). **Restructured**: the tool reports it. |
| `set` with `from` | `set` with `to` |

## A13.11 From `go` to fire link

`hsvg/0.1` put links inside scene behaviour as `go`, `visit` and `return` actions. In 2.0 a scene emits an outcome and
the graph fires a link. The upgrade tool (A13) converts on a copy and names every rename:

| `hsvg/0.1` | 2.0 |
|---|---|
| `story.initial` | `story.start` |
| `story.scenes` | `story.scenes`; scene documents become scene documents |
| `{"id":"v2-map-go","go":"'hub-map'"}` in scene `stop-harbour` | action `{"id":"v2-map-go","emit":"goHubMap"}`, output event `goHubMap`, link `{"id":"stop-harbour-go-hub-map","from":"stop-harbour","on":"goHubMap","to":"hub-map"}` |
| `go` with `transition` | the link's `transition` |
| `go` with a computed destination | `emit` with payload `{"to": <formula>}` and one link per possible destination, each with `when: "event.to === '<id>'"`, plus a fallback to the last literal. If the destinations are not a known list (A13.5), the action is unconverted and the tool names it |
| `visit` | a link with `visit: true` |
| `return` | a link with `return: true`; each return link gets a fallback link, whose destination is an unconverted item unless every way into the scene is a visit (3.7) |
| `returned` payload `{scene}` | `returned` payload `{scene}` |
| the same `go` in many scenes (a map button drawn in every scene) | reported as a shell candidate; moving it into a shell is an authoring step (section 10) |
| earlier portal story files: beats, choices with `maxVisits`, routes, visit counts | scene behaviour, choice links with `max`, a `start` list or link `when`, `visits` (3.6) |

The terminal-navigation rule of `hsvg/0.1` becomes 3.3: reporting an outcome is not terminal; the reaction finishes,
then the link fires.
