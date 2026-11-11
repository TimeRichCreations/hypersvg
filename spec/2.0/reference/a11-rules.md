# A11. Rules

This is a reference chapter of the tool reference (`reference/README.md`): for people who build editors, hosts,
packers and checkers. A first experience needs none of it.

Rules are the checker's language. This chapter holds the extra rule kinds (A11.1) and what was chapter 8 (A11.2 to
A11.10: section 8.n is A11.n+1).

## A11.1 Learning, game, page and process rules

### Learning

| Kind | Parameters | Holds when | Proof |
|---|---|---|---|
| `answers-spread` | `positions` (the number of options), `column` (on a `data:` subject: the column holding each row's correct position, 1..`positions`) | Over the table's rows, the correct answer sits in each position about equally often (counts at most one apart). A position is an option's place in its control (5.11). | files |
| `feedback` | `answer` (an event), `shows` (a part path), `withinMs`, `minShowMs` | After each `answer` event, `shows` becomes visible within `withinMs` and stays visible at least `minShowMs`, on the engine clock; a browser run also measures the paint. A parameter may read a knob (A11.2), so a timer and the rule share one number. | playing |
| `scoring` | `minimum`, `maximum`, `once`, `per` (on a `value:` subject) | The score stays in bounds and changes only in reactions to a seat's input (a control event or a choice), never on entry, exit or a timer. With `once`, no two changes in one run share a `per` value (a formula read in the changing reaction, such as `question.id`). | files, playing |

### Game

| Kind | Parameters | Holds when | Proof |
|---|---|---|---|
| `on-route` | `route`, `tolerance` | The subject stays on the drawn route (a wheel touches the road), within `tolerance` drawing coordinates. | files by construction, else playing |
| `solvable` | `goal` (an output event or result that counts as won), `searchBudget` (inputs tried, 1..1,000,000) | Every playable scene of a game can be won (every level solvable): a bounded search over the legal inputs (A4.1) and harness actions (A8.5) finds a winning input log. Drags, holds and throws are drawn by the seeded mixer (5.6.5): straight paths between two points in the target's motion range, over 100..2000 ms. The receipt keeps that log under `witness`, and the witness is replayed to confirm. | playing |

Graph validity (every scene reachable, no dead ends, bounded timed loops) is a format check of 3.9, not a rule kind.

### Page conduct

For blocks on someone else's page. The good-guest rules of A3.1 that have a rule kind are `must` rules written with
these kinds and the layout and accessibility kinds of A11.10; their values come from the experience's `page` key
(`promptLimit`), and a host profile may make them stricter. The other good-guest rows are engine behaviour (A3.1).

| Kind | Parameters | Holds when | Proof |
|---|---|---|---|
| `prompt-limit` | `count`, `windowMs` (default: the experience's `page.promptLimit`) | Unasked hints stay within `count` per rolling window. | playing |
| `pause-offscreen` | none | Sound, timers and motion pause while the block is off screen. | playing |
| `dismissible` | none | Minimise and close are always available; minimise keeps a restore control. | playing |

### Process

| Kind | Parameters | Holds when | Proof |
|---|---|---|---|
| `budget` | `measure`, `maximum` | See A10.3. | files |
| `no-copy` | `minBytes` (200) | No two parts of one experience are exact copies above `minBytes` canonical bytes; copies become definition and use. | files |
| `judgement` | `ask` | A reviewer answers a plain question yes ("Does the headline read first?"). | review |

## A11.2 What a rule is (was 8.1)

A rule is a JSON object with these keys:

| Key | Required | Meaning |
|---|---|---|
| `id` | yes | Kebab-case id, unique in its document. |
| `kind` | yes | One word from the closed list of rule kinds (A11.10). |
| `subject` | no | The address of what the rule is about (A11.3). Without it, everything in the rule's scope. |
| `strength` | no | `must` (default), `should` or `give-way` (A11.5). |
| `proof` | no | `files`, `playing` or `review`, or a list of them. Defaults to the kind's proof kind (A11.10). A proof kind the rule kind cannot give is `E-RULE`. |
| `when` | no | A formula (section 5). The rule applies only while it is true. A pack rule's formulas read the pack's inputs; a document rule's read that document's names. A `files` proof treats a `when` it cannot evaluate as true. |
| `layouts` | no | Layout ids where the rule holds; default all. `when` cannot read the shape (5.8), so this is how a rule about one layout is scoped. |
| `waivableBy` | no | Editor rights that may waive this rule (A11.6). Without it the rule cannot be waived. |
| `weight` | no | A number 0..10. For `should` rules: how much the rule counts in a score (A8.2). Default 1. |
| `steps` | give-way | Give-way rules only: the ordered steps the rule may use, from the list in A11.5. Which steps a kind may use is in A11.5. |
| `priority` | no | Give-way rules only: a number 0..1, higher matters more (A11.5). Default 0.5. |
| `floor` | give-way | Give-way rules only: the limit no step may pass: `{"minTextPx": n}` (CSS pixels at the output), `{"minShare": n}` or `{"keep": true}`, or several in one object; each applies (A11.5). |
| `reviewBy` | no | Review proofs only: `person`, so that an agent's review never counts (A11.9). |
| other keys | by kind | The kind's parameters (A11.10). Literals, or a formula string (section 5) where the kind expects a number or a yes/no, such as the name of a pack's knob. |

A rule with an unknown `kind`, `strength`, `proof` kind, step or budget `measure` is `E-RULE`. A waiver of an unknown
rule is `E-REF-UNKNOWN`. A waiver in a kit without `until` is `E-KEY-REQUIRED`.

Two rules, one from a Robin block and one from a brand rule pack:

```json
{ "id": "wheels-on-road", "kind": "on-route", "subject": "role:wheel", "route": "place:road",
  "tolerance": 2, "when": "isRiding", "proof": "playing" }
```

```json
{ "id": "cta-length", "kind": "limit", "subject": "field:action.text", "maxLength": 18,
  "strength": "should", "weight": 2, "waivableBy": ["brand-owner"] }
```

"Always" depends on the subject. A rule about play (wheels on the road) holds at every moment of play while its
`when` is true. A rule about outputs (text fits) holds in every output: every shape, size, language, tier
and theme (section 7). A rule in a kit holds in every kit experience made from that kit.

Rules live in JSON. Drawings carry no rules (decision 4): a drawing says what things are and where they are; the
JSON beside it says what must hold.

The format's own constraints are not authored rules. Safe content, the closed set of keys, one writer per property,
unique ids, "words never decide" (section 5) and graph validity (3.9) are format checks (2.11, 2.1, 9.3, 2.9, 5.8, 3.9).
They always hold, they appear in no rules face, and nobody can waive them.

## A11.3 Where rules attach (was 8.2)

A rule is written in the `rules` list of one document. It applies to its subject in that document and in every
block used inside it.

| Attached to | Written in | Example |
|---|---|---|
| a part | the JSON of the block whose drawing holds the part | the price label never wraps to a third line |
| a block (a component) | its own `rules` list: these are its guarantees (A11.8) | the ride block keeps both wheels on the road |
| a scene | the scene document | nothing covers the answer buttons in the quiz scene |
| the story graph | the experience document | the score stays between 0 and 10, and each question counts once |
| the host | the host profile (A10.1) | an ad placement export weighs at most 150 KiB zipped |

The `subject` is an address (section 2). This section uses these forms:

| Form | Subject |
|---|---|
| `part:front-wheel` | one part, by id |
| `role:action` | every part or component with that role |
| `field:action.text` | one content field: in a component's rules `field:<block id>.<field>`; in a plan item `field:<field>` (the `fit` add-on) |
| `input:speed` | one input of the block (a knob, a content field or a trigger) |
| `value:score` | one value of the document |
| `place:caption-box` | one place (slot, region, anchor, safe area, route) |
| `use:answer-2` | one use of a block |
| `scene:quiz` | one scene |
| `color:accent` | one theme colour role, in every theme (contrast rules) |
| `data:questions` | one data table (2.8) |
| `controls` | every part that is the target of a control |
| `graph` | the story graph of the experience |
| a list of the above | each of them |

A rule written in a document whose subject matches nothing in that document or in any block used inside it is an
error (`E-RULE-SUBJECT`), so a rule cannot pass by being about nothing. A rule from a pack applies only where its subject exists: `role:legal` in a pack does
nothing in an ad without legal text.

`value:score` names a value of the document (an experience's score, for example) in rules such as `scoring`.

## A11.4 Rule packs (was 8.3)

A **rule pack** is a named, versioned set of rules for one domain. It is its own document:

```json
{
  "format": "hsvg/2.0",
  "kind": "rule-pack",
  "id": "harbour-brand",
  "about": { "title": "Harbour brand rules", "version": "2.1.0" },
  "domain": "brand",
  "inputs": {
    "ctaMaxLength": { "kind": "knob", "type": "number", "minimum": 8, "maximum": 30, "step": 1, "initial": 18,
                      "editableBy": ["brand-owner"] }
  },
  "rules": [
    { "id": "fonts", "kind": "fonts", "families": ["Bitter", "Inter"], "waivableBy": ["brand-owner"] },
    { "id": "logo-kept", "kind": "keep", "subject": "role:identity", "minSize": [64, 24] },
    { "id": "logo-protected", "kind": "protected", "subject": "role:identity" },
    { "id": "legal-kept", "kind": "keep", "subject": "role:legal" },
    { "id": "cta-length", "kind": "limit", "subject": "field:action.text", "maxLength": "ctaMaxLength",
      "strength": "should", "waivableBy": ["brand-owner"] },
    { "id": "accent-colors", "kind": "colors", "subject": "role:action",
      "roles": { "accent": ["#e6af42", "#d66a32"] } }
  ]
}
```

- **Domains** are words, not grammar: `brand`, `learning`, `game`, `accessibility`, `layout`, `page`. A pack may mix
  rule kinds; the domain helps people find it.
- **Knobs.** A pack may declare knobs on its `inputs` (5.3.2). Its rules read them by name. A use sets them with
  `with`, inside their bounds.
- **Authoring only.** `"authoringOnly": true` marks a pack used only while making: its results are baked into the
  outputs, and the packer leaves it out of packages (A10.1, A10.2).
- **Using a pack.** A kit lists the packs its kit experiences keep in `rulePacks` (A14.1). An entry is the path of a pack the
  kit holds (it is versioned with the kit), or a use of another kit's pack, pinned as `<id>@<version>` (2.9). An
  experience or a scene may add packs the same way:

```json
"rulePacks": [
  "rules/riding.json",
  { "use": "harbour-brand@2.1.0", "with": { "ctaMaxLength": 16 } },
  { "use": "hsvg-accessibility@2.0.0" }
]
```

- **Resolving a `use`.** A pack `use` (`<id>@<version>`) resolves in the pinned kits, then in the shipped packs; one
  that resolves nowhere is `E-REF-UNKNOWN`. A kit's own packs are named by path.
- A pack applies downward: to the document that lists it and every block used inside it. A block cannot remove a
  pack applied above it.
- **The baseline.** Every experience is checked against the open pack `hsvg-baseline`. It holds the minimum
  accessibility and layout rules: readable text (A11.10), colour contrast of the theme roles, a keyboard path and a name
  for every control, hit targets of at least 44 px, reduced motion that keeps meaning, focus never stolen, nothing
  covering a control, and `no-copy` (no exact copies, A14.3). Its values come from the host profile. Receipts list it like any other pack.
- **The page pack.** Every experience that has a `page` key is also checked against the open pack `hsvg-page`,
  without listing it. It holds the good-guest rules of A3.1: `prompt-limit`, `pause-offscreen`, `dismissible`,
  `reduced-motion` and `focus`.
- **Open packs.** The spec ships three packs: `hsvg-baseline`, `hsvg-page` and one fuller pack,
  `hsvg-accessibility`, for lessons, games and apps. It adds to the baseline: reading order for every control, captions
  for every spoken line, contrast for every control and every drawn text, and a wait of at least 20 seconds on a
  timed link that leaves a scene offering choices or controls (`timing`). A kit lists it when it wants it.
- **Versions.** A rule pack has a version in `about.version` (A14.1). Changing a pack makes the evidence of every block it applies
  to stale, so they are checked again. Kit experiences pin a kit version, and the kit pins its pack versions.
- A pack is plain data. Whether its owner publishes it or keeps it is not a format question; the format is the same.

## A11.5 Strengths (was 8.4)

| Strength | When the rule does not hold | Typical use |
|---|---|---|
| `must` | An error. Save, publish and export are refused. A change that would break it is refused before it applies (`E-RULE`, A9.7). | brand fonts, required legal text, file weight, wheels on the road |
| `should` | A note. It never fails anything. Receipts and editors show it; scores count it (A8.2). | the CTA ideally under 18 characters, a mascot's wave keeps hands below the head |
| `give-way` | The rule may be met by ordered steps, down to a floor. Past the floor a making run gives an incomplete output; a check reports a fail. | small print shrinks, then uses its short wording, then goes |

**Every change.** The changes protocol (A9.7) checks the `must` rules on a copy before anything is written. A rule
already proven over the whole declared range of an input (A11.8) holds for any value inside its bounds, so for such a
change the bounds check is the rule check.

**Making and playing.** Give-way rules are used while making: a fit or an export applies their steps and bakes the result into the output (7.6). While playing, a text binding's own fit still shrinks and wraps (7.6). Running give-way rules while playing is the `ladder` add-on (`capabilities/ladder.md`).

## A11.6 Waivers (was 8.5)

A **waiver** lets one rule not hold in one place, for a stated reason, approved by someone with the right to do so.

```json
"waivers": [
  { "rule": "harbour-brand/fonts", "subject": "field:action.text", "size": "728x90",
    "reason": "The network's leaderboard template fixes the button font.", "by": "brand-owner" }
]
```

- `rule` names the rule: `<pack or block id>/<rule id>`. `subject` limits the waiver to a subject inside the rule's scope;
  optional `size`, `language` or `theme` limit it to one option of that axis (section 7).
- `waivers` is a list in the kit, experience, scene or block document that holds the rule's use (4.2).
- `reason` is required and not empty (`E-WAIVER-REASON`).
- `by` is an editor right. It must be in the rule's `waivableBy`, and the person or agent who saved the waiver must
  hold it. A waiver is saved by a change request (A9.7) whose address is `<document id>/waivers`, with `old`
  absent (adding) or the current entry, and `new` the waiver entry or `null` (removing); two waivers of one rule are
  told apart by their `subject`, `size`, `language` and `theme`; check 6 (A9.2) passes for a right
  in the rule's `waivableBy`. A rule without `waivableBy` cannot be waived. A refusal of the right is `E-RIGHTS`, as
  for every change (A9.2).
- `until` names a kit version; the waiver lapses when the kit moves past it. It is required for a waiver in a kit
  and optional in a single experience.
- Host rules and `hsvg-baseline` rules cannot be waived in content. A host changes its own values in its host profile.
- A waived rule appears in every receipt as `waived`, with the reason and the right. The waiver lives in the content
  that holds it, and the change receipt that added it (A9.7) records who saved it.
- A `should` rule needs no waiver; it never fails.

Waivers replace the earlier "policy exceptions with a why" and the copy rule's exception.

## A11.7 Precedence (was 8.6)

**Every rule that applies must hold.** Rules reach a subject from three sources: the **host** (its profile), **rule
packs** (listed by the kit, experience or scene; `hsvg-baseline` is a pack that cannot be waived) and **block
guarantees** (a rule in a scene, shell or component). No source outranks another: a rule from any source holds, or the
check fails.

1. **Collect** every rule that applies to the subject, after waivers.
2. **Combine** rules of the same kind and strength: the strictest bound wins (the larger minimum, the smaller
   maximum); `families` and colour lists intersect; a subject kept by any `keep` rule is kept. For parameters without
   a minimum or maximum direction, a smaller `tolerance`, a shorter `withinMs`, a longer `minShowMs`, a higher
   `ratio`, `minPx` or `minMs`, and a lower `count` are stricter. Rules of other kinds are not combined: each must
   hold. Rules of different strengths each keep their own strength, so a stricter `should` bound adds a note above a
   looser `must` bound; it never becomes `must`. A weaker rule never relaxes a stricter one.
3. **Conflicts.** If two rules cannot both hold (an empty font list, a minimum above a maximum, a different `case`,
   `positions` or `of`), both fail: the checker reports `E-RULE-CONFLICT` at each, naming the other. One of them needs
   a change or a waiver. A conflict between `must` rules blocks publishing and export; between `should` rules it is a
   note.
4. **Give-way.** The floor is the strictest floor. The step order comes from the most specific subject that gives one,
   whole (orders are not merged): part over block over scene over experience over host.

| Subject | Host | Rule pack | Block guarantee | Applies |
|---|---|---|---|---|
| `legal.text` size | a host `readable` rule with `byRole` `{legal: 9}` | brand: at least 10 px | at least 8 px | at least 10 px, `must` |
| file weight | at most 150 KiB zipped | ad kit: at most 120 KiB | none | at most 120 KiB |
| fonts | system fonts only | brand: Bitter, Inter | uses Bitter | conflict: both the host rule and the brand rule fail, each naming the other |
| CTA length | none | brand `should` at most 18 | none | a note above 18 |

## A11.8 Guarantees (was 8.7)

A block's rules face lists the rules it **guarantees**. A guarantee is a promise checked with the block, not at each
use.

- **Checked over the whole input range.** The checker proves a guarantee for every value its inputs may take, not
  only the defaults: by reasoning over bounds where it can (files, 5.6.7), and by playing at the corners and at
  sampled points of each knob's range where it must (playing). The receipt says which. A sampled guarantee counts
  for uses, and its receipt says it was sampled.
- **Sealed blocks are checked once.** When a block is sealed (A9.4), its guarantees are proven and the
  receipts are stored in the kit's evidence under the block's digest. Every use of that block reuses a whole-range
  proof from files while the digest matches. A use is then checked only for its inputs: types and bounds.
- **Only whole-range proofs from files are reused at every use.** Sampled evidence (fits at listed sizes, play
  tests, exploring) holds only under the conditions its receipt records: sizes, fonts, measurer, host profile and
  capability versions. Under other conditions it is run again, or reported `not-run`.
- **Open blocks** are checked again at every use.
- **A guarantee meets a demand.** When a rule pack demands a rule of the same kind on the same subject, and a block
  guarantees it with bounds at least as strict, the demand is met by the guarantee. Nothing is checked twice.
- **By construction.** The cheapest guarantee is one the block makes true by how it is built, proven from the files.
  Robin's ride block binds each wheel's height to the drawn road (6.8); the checker proves the binding exists
  and covers every wheel, so `wheels-on-road` holds without sampling.

In `components/bike/component.json`, the bike component (4.4):

```json
"rules": [
  { "id": "wheels-on-road", "kind": "on-route", "subject": ["part:front-wheel", "part:back-wheel"],
    "route": "place:road", "tolerance": 2, "proof": "files" },
  { "id": "speed-in-range", "kind": "limit", "subject": "input:speed", "minimum": 0, "maximum": 9 }
]
```

A guarantee is the base of verifiable kit experiences: new kit experiences reuse verified blocks, so they keep the kit's rules
without being checked from scratch.

## A11.9 Proof kinds (was 8.8)

Every rule says how it is proven. There are three proof kinds.

| Kind | Who proves it | It can prove | It cannot prove |
|---|---|---|---|
| `files` | The checker, reading drawings, JSON and resources, with a pinned text measurer and pinned fonts. | Structure, references, bounds over input ranges, places drawn in every frame, text fit at declared limits, contrast of theme roles, the weight of a built package, graph reachability, answer spread over authored data, guarantees by construction. | What only exists when running: painted covering after clips and filters, timing, motion between keys, open-ended play, quality. |
| `playing` | The play harness (A8.5): real input paths, a controlled clock, a fixed seed, fixtures, samples at fixed times, a real browser. | Painted bounds, covering, focus order and focus successors, a part staying on a route at every sample, feedback timing, a game level won by a bounded search, reduced motion keeping meaning. | Anything between samples; outcomes beyond the search budget; quality. |
| `review` | A person or an agent, looking at exact files named by digest. | Hierarchy, balance, legibility in context, brand fit, claims, likeness to a reference. | Nothing automatic. |

- A rule may list several kinds; all must pass: `"proof": ["files", "review"]`.
- **Sampled proofs say so.** A playing proof reports how many samples it took and what it sampled. A sampled pass is not
  proof of continuous clearance.
- **Only a whole-range proof from files is reused at every use of a sealed block** (A11.8). Sampled evidence is valid
  under the conditions its receipt records, and is run again or reported `not-run` under others.
- **A bounded search that ends is not a proof.** Running out of search budget gives a `not-run` (in a check) or an
  incomplete output (in a making run), never a pass and never a proof of impossibility.
- **The text measurer.** The reference text measurer is headless Chromium at a pinned version, named in a receipt's
  `authority.measurer` (A8.1). A host font is pinned by its font file; there is no metrics-file format. A checker
  without the measurer reports fit proofs `not-run`.
- **Reviews.** A review names who looked (`person` or `agent:<name>`), the files' digests, the date and a note. A rule
  may require `"reviewBy": "person"`; an agent's review then never counts. A changed file makes its review stale.

## A11.10 Rule kinds (was 8.9)

Rule kinds are a closed list. Each has parameters and a default proof kind. Where two proof kinds are listed, the checker
proves what it can from the files and the rest by playing; both run. A capability may add a kind only with a declared
grammar and a checker (section 10).

### Layout

| Kind | Parameters | Holds when | Proof |
|---|---|---|---|
| `inside` | `of` (an address: a place, part, region or slot) | The subject stays inside it, also while it moves. | files, playing |
| `clear` | `of` (addresses; default: everything else painted) | The subject is not covered by, and does not cover, the listed things. *Covered by* means painted over by later-painted content that is not `backdrop` or `decoration` paint (6.4) and not one of the subject's own parts. With no `of`, only "not covered by" is checked. "Nothing covers a control" is `clear` with `"subject": "controls"` and no `of`. | files, playing |
| `fits` | none (uses the field's fit, section 7) | The content fits its place in the matrix the checker runs (7.1): every `must` size in every language, with the pressure cases (A8.4), and every theme that changes fonts or spacing. | files |
| `intrinsic` | none | The subject keeps its drawn size under resizing (icons, button height, radii). | files |
| `relation` | `is` (`beside` or `overlay`), `to` | The geometry between two subjects holds in every output. | files |
| `reading-order` | `order` (addresses) | Document order, focus order and visual order agree for the listed things. | files, playing |

### Content

| Kind | Parameters | Holds when | Proof |
|---|---|---|---|
| `limit` | `minimum`, `maximum`, `minLength`, `maxLength`, `maxLines`, `case` (`upper`, `lower`, `title`) | The value stays in the limits. A length may be a map from language to number with a `default` (7.8). | files |
| `keep` | `minSize` `[w, h]` in CSS pixels at the output size | The subject is present and visible in every output, at least that big. Never removed by give-way. | files, playing |
| `protected` | none | The subject is never recoloured, restyled, stretched, cropped further or replaced. | files |

### Brand

| Kind | Parameters | Holds when | Proof |
|---|---|---|---|
| `fonts` | `families` (font family names) | Every text in the subject uses an allowed family; generic fallbacks (`serif`, `sans-serif`) in its stack are ignored. | files |
| `colors` | `roles` (colour role to allowed colours, 7.7), optional `exhaustive: true` | Each colour role used by the subject takes an allowed colour. With `exhaustive`, every painted fill and stroke in the subject carries a colour role, so no paint escapes the rule. | files |

A brand pack also uses `limit` (call-to-action length), `keep` (logo, legal text) and `protected` (logo).

### Accessibility

| Kind | Parameters | Holds when | Proof |
|---|---|---|---|
| `readable` | `minTextPx` (a number, or `"host"`), optional `byRole` (`{"legal": 9}`; per role, combined like `minTextPx`) | No text is drawn smaller than `minTextPx` at the final output size (never at a canvas zoom). `"host"` takes the host profile's `readable` value, 12 px when it gives none; the baseline pack uses `"host"`, so a print host may set a lower floor and content may only be stricter. | files |
| `contrast` | `ratio`, `largeRatio`, optional `against` (a colour role or an address) | Text and its background reach the ratio (4.5 and 3 for large text, as WCAG 2.2). With `against`, the subject's colours (a logo, a label) are checked against that role or part in every theme. | files |
| `keyboard` | none | Every control has a keyboard path and an accessible name. | files, playing |
| `hit-target` | `minPx` | Every control is at least `minPx` square on screen (44 by default): each control target's painted box, at the scale of the smallest declared size, against `minPx`. The 2.0 checker does not measure painted boxes, so it reports the rule `not-run`, never a pass, as it does `readable` without a measurer (A11.9). | files |
| `reduced-motion` | none | With reduced motion, timers, markers, captions and choices still run; visual motion finishes or rests. | playing |
| `focus` | none | Focus is never stolen and has a defined successor when its control disappears. | playing |
| `captions` | none | Every spoken line has a caption. | files |
| `timing` | `minMs` (default 20000) | A timed link that leaves a scene while it offers choices or usable controls waits at least `minMs` on the scene's clock, or the person can pause that clock (the shell's pause, 3.10). | files, playing |
