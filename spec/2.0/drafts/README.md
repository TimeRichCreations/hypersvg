# Drafts outside the 2.0 registry

These files are not part of HyperSVG 2.0. No 2.0 engine, checker or schema reads them as grammar. A 2.0 file that uses
what they describe is refused: a need is `E-NEEDS-UNKNOWN`, anything else is `E-DRAFT` ("not in 2.0; a 2.1 draft"),
and the message names the draft. The list the checker uses is `engine/v2/schema/drafts.mjs`.

A `.md` draft holds the text; a `.json` draft (`"format": "hsvg/2.1-draft"`, `"kind": "grammar-draft"`) holds the
grammar as 2.0 had it, so 2.1 can start from it. The three `.json` drafts of D31 (`choices`, `clip-extras`,
`delivery`) came out of the 2.0 grammar.

| Draft | What it holds | Why it waits |
|---|---|---|
| `remote-seats-2.1.json` | The `remote-seats` capability: seats on different devices (D11). 2.0 has seats on one page only (A4.1). | Needs a runtime door that is outside the base standard (D40). |
| `effect-kinds-2.1.json` | The effect kinds `spring`, `aim`, `follow`, `limit` and `dynamics`, with their 2.0 grammar (A1.1). 2.0 keeps `particles`. | Never built; decision 3 after R2. |
| `page-actions-2.1.json` | The page actions `goSpot`, `grab`, `carryTo` and `giveBack`, with their 2.0 grammar (A3.1). 2.0 keeps `point`, `highlight`, `scroll`, `focus` and `invoke`. | Never built; decision 2 after R2. |
| `structure-2.1.md` | Logical blocks, nested experiences and split screen, with their 2.0 draft text. 2.0 keeps kit experiences (4.9) and variations as templates (4.10, D24). | Never built; decision 4 after R2. |
| `clip-extras-2.1.md`, `clip-extras-2.1.json` | The clip keys `wiggle`, `timeRemap`, `frameRate`, `holdFrames`, a track's `composite` and a clip's `blendMs`. | Never built (P1). |
| `choice-places-2.1.md`, `choices-2.1.json` | `choiceRegion` and `choicesAtMs`: drawn places for choices inside a scene. 2.0 shows choices through an add-on (3.5). | Only the checker read them; never built (P1). |
| `delivery-2.1.md`, `delivery-2.1.json` | Export adapters (ad zip, video, learning platforms) with `report`, `endHoldMs` and `clickArea`; served play (update, withdraw, A/B); the `network` grant and the `site` storage scope. | Never built. |
| `custom-widgets-2.1.md` | Host-written HTML widgets: a shell use's `custom` and `fallback`, and the `widgets` grant. | Experimental in 2.0 before; never proven (P1). |
| `content-options-2.1.md` | Content options (named alternative wordings), the `seed` selector, the rule kind `seeds` and the mount option `seed`. 2.0 keeps tiers. | Never built; decision 5 after R2. |

## Experimental parts of 2.0

These stay in the 2.0 text, marked **Experimental (2.1)**. No 2.0 tool proves them and they have no error code
(decision 10 after R2). A 2.0 file may carry their keys; they may change in 2.1.

| Part | Where |
|---|---|
| Conformance levels | A10.7, `about.level` |
| The ZIP profile | A10.5 "Paths and the ZIP profile" (the path rules stay 2.0) |
| Signed reviews and package signatures | A9.3 |
| Play tests and their harness | A8.5 |

## Error codes removed in 2.0

Decision 9 after R2: a code stays only if something produces it. The coverage test
(`engine/v2/tests/check-coverage.test.mjs`) proves that every code in `errors.json` is produced. These were removed:
`E-ABOUT-FACT`, `E-AUTHORING-ONLY`, `E-BUDGET`, `E-CLOCK-SEEK`, `E-CLOSURE`, `E-EVIDENCE-MISSING`,
`E-EXEC-UNSUPPORTED`, `E-EXPORT-CARRY`, `E-FACT-TWICE`, `E-FIXTURE`, `E-FONT-COVERAGE`, `E-LEVEL`, `E-PLAY`,
`E-PLAY-INVARIANT`, `E-PRIVATE-REF`, `E-SHELL-REACH`, `E-SHELL-START`, `E-SIGNATURE`, `E-STORY-STUCK`,
`E-TRUST-BLOCKED`, `E-UPGRADE-INCOMPLETE`, `E-UPGRADE-PARITY`, `E-UPGRADE-ROUNDTRIP`, `E-WIDGET-FALLBACK`,
`E-WIDGET-KIND`, `E-ZIP`, `W-ICON-UNKNOWN`, `W-LEVEL-RECOMMENDED`, `W-SAMPLE-DIFFERS`. The rules they named stay
where the spec states them, marked review (a person or a later tool checks them) or experimental.
