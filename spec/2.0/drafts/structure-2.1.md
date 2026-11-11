# Structure: logical blocks, nested experiences and split screen (a 2.1 draft)

Not part of HyperSVG 2.0. Decision 4 after R2 took these three out of 2.0; none was built. A 2.0 file that uses one
is refused with `E-DRAFT` ("not in 2.0; a 2.1 draft"), and the message names this file. Variations (4.10) stay in
2.0, as templates (D24).

What a 2.0 checker refuses, and where:

| Use | Where | Path in the message |
|---|---|---|
| A document of kind `logical-block` | any document | `kind` |
| A use with `places` (a use of a logical block) | `uses[i]` of any block | `uses[i].places` |
| An `experiences` list (a nested experience) | the experience | `experiences` |
| `story.start` as a map of stage slots | the experience | `story.start` |
| A link with `slot` | the experience | `story.links[i].slot` |
| A shell with two or more stage slots | the shell | `slots` |

The text below is the 2.0 draft text these features had, kept for 2.1. Section numbers point to the 2.0 spec.

## 1. Logical blocks

A **logical block** brings no drawing of its own. It groups other things by reference: parts from several drawings,
components, values, behaviour and rules. "Ride the road" is a logical block that uses the road from a scene's
drawing, the wheels from the bike component's drawing and the speed value. It is not a rung: it is used inside a
scene, a shell or a component, on the places it is given.

- Document kind `logical-block`, a flat file `blocks/<id>.json`. Keys: the header, `about`, `places`, `inputs`,
  `rules`, `waivers`, `outputs`, `values`, `computed`, `on`, `entry`, `exit`, `machines`, `clips`, `bindings`,
  `effects`, `uses`, `needs`. It has no `drawing` and no `layouts`.
- **Its places.** `places` lists what the block works on, and each use supplies them in its own `places` map, by
  address. Ride-the-road gets the road from the scene's drawing and the wheels from the bike's:
  `{"road": {"kind": "route"}, "front-wheel": {"kind": "part"}}`. The supplied place must have that kind, and a part
  inside a use must be exposed by it (files).
- **A use of it** has `places` and no `into`, and a logical block's own uses have none either:

```json
{"id": "ride", "use": "ride-road", "places": {"road": "road", "front-wheel": "bike/front-wheel"}, "with": {"speed": "speed"}}
```

- Its clips, bindings and effects target the places it is given. Its rules are its guarantees (8.7):

```json
"rules": [
  { "id": "wheels-on-road", "kind": "on-route", "subject": ["part:front-wheel", "part:back-wheel"],
    "route": "place:road", "tolerance": 2, "proof": "files" },
  { "id": "speed-in-range", "kind": "limit", "subject": "input:speed", "minimum": 0, "maximum": 9 }
]
```

In 2.0 the same job is a component that draws its part, or rules and bindings on the scene itself.

## 2. Nested experiences

A **nested experience** is an experience that lists kit experiences of one kit instead of telling a story of its own: it
has an `experiences` key and no `story`. The kit is chosen once, on the nested experience, and every listed experience
pins it.

```json
{
  "format": "hsvg/2.0",
  "kind": "experience",
  "id": "robins-delivery-rounds",
  "kit": "robin-delivery",
  "experiences": [
    {"id": "round-harbour", "file": "experiences/round-harbour/experience.json"},
    {"id": "round-cliff", "file": "experiences/round-cliff/experience.json", "unlockedBy": ["round-harbour"]}
  ]
}
```

| Nested experience key | Holds |
|---|---|
| `kit` | The kit id (a string) every listed experience pins (`E-REF-UNKNOWN`) |
| `experiences` | 1 to 256 entries `{id, file, unlockedBy?}`; ids unique; every file is a kit experience of `kit`; `unlockedBy` names other listed experiences (`E-REF-UNKNOWN`), with no cycle (`E-CYCLE`) |
| `about`, `theme`, `axes` | As on any experience (2.5, 7.7, 7.1); the listed experiences may narrow them |
| `rulePacks`, `rules` | As on any experience (8.3, 8.2); they apply to every listed experience |
| `limits` | As on any experience (9.8.1); the package raises each limit as far as any of its experiences asks |

- A nested experience carries these keys and the header only (`E-KEY-UNKNOWN`). A listed experience is never itself
  nested: nesting is one level deep.
- **Versions.** A nested experience's check notes listed experiences not on the kit's newest version (a should rule).
  Making a new kit version re-checks the kit experiences of every nested experience the kit knows.
- **Unlocking.** A kit experience is available when every kit experience in `unlockedBy` has reached an ending at
  least once. The nested experience keeps, per kit experience, the latest ending scene and its result outputs as
  `saved` data keyed by the nested experience id (5.1.2): it needs the `storage` grant (without it, every kit
  experience is available), and `resetSaved` on the nested experience clears it. Without `unlockedBy`, a kit
  experience is always available. It hears each listed experience's `ended` output (3.8).
- Rules written in a nested experience rank as pack rules (8.6). Its theme and axes come between the kit's and the
  kit experience's (7.1, 7.7).

A folder:

```text
robins-delivery-rounds/
  experience.json
  experiences/
    round-harbour/
      experience.json      pins robin-delivery 2.1.0
      words/en.csv
```

In 2.0, a course of rounds is several kit experiences of one kit, each packed on its own; a host page links them.

## 3. Split screen

A shell may have two or more stage slots. Each shows its own scene from the one story graph, with its own local clock
and its own visit stack. They share the experience's values, store, queue and engine clock.

- `story.start` becomes a map from stage slot id to a start: `"start": {"stage-left": "lesson", "stage-right": "diagram"}`.
  Every stage slot needs one (the 2.0 draft code was `E-SHELL-START`).
- A link replaces the scene in the slot that holds its `from` scene, unless it names another stage slot in `slot`
  (3.2): `"slot": "stage-right"`. A lesson on the left can then change the diagram on the right. A link from the shell
  replaces the scene in the first stage slot unless it names one.
- "First stage slot" always means the first in the shell drawing's document order. Every frame of a shell draws
  its slots in the same relative order (`E-SHELL-SLOT`), so the first stage slot does not change with the screen.
- Each stage slot may carry its own `clock`, for example to replay a demonstration at half speed beside a live
  exercise.
- Stage slots other than the first need a `label`, so the two landmarks can be told apart. The first stage slot is
  the `main` landmark; the others are labelled `region`s (10.3).
- **Endings.** The experience ends when the first stage slot reaches an ending; endings in other slots are reported
  as `entered`, not `ended` (3.8).

In 2.0 a shell has exactly one stage slot.
