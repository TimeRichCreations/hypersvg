# A14. Kits and libraries

This is a reference chapter of the tool reference (`reference/README.md`): for people who build editors, hosts,
packers and checkers. A first experience needs none of it.

A kit is a versioned set of definitions; a library is a kit with a catalogue; a template is an experience to
start from. The core says only what a kit pin and `with` do (chapter 4, "Kits and templates").

## A14.1 Kits and versions (was 4.8)

A **kit** is a versioned set of block definitions, rule packs, themes and resources that kit experiences use. It is the
definition side of kit experiences (A14.2). "Family" stays a descriptive word for the ads one kit makes.

```json
{
  "format": "hsvg/2.0",
  "kind": "kit",
  "id": "robin-delivery",
  "about": {"title": "Robin's deliveries", "author": "TimeRich Creations", "license": "CC-BY-4.0",
            "version": "2.1.0"},
  "rights": {"designer": {"label": "Designer", "may": ["edit", "changeKit"]},
             "copywriter": {"label": "Copywriter", "may": ["edit"]}},
  "blocks": {
    "ride-out": "blocks/ride-out.json",
    "delivery-stop": "blocks/delivery-stop.json",
    "gazette-page": "blocks/gazette-page.json",
    "robin-screen": "shell/robin-screen.json"
  },
  "inputs": {
    "rideSpeed": {"kind": "knob", "type": "number", "minimum": 0.5, "maximum": 1.5, "step": 0.05, "initial": 1,
                  "editableBy": ["designer"]},
    "senderName": {"kind": "content", "contentType": "text", "type": "string", "maxLength": 24,
                   "initial": "Robin", "editableBy": ["copywriter"]}
  },
  "rulePacks": [{"use": "robin-riding@1.0.0"}, {"use": "hsvg-accessibility@2.0.0"}],
  "theme": "robin-day",
  "themes": {"robin-day": {"colorRoles": {"surface": "#fff4d8", "ink": "#153b4b", "accent": "#e6af42",
                                          "accent-2": "#168e91", "muted": "#4f6b73", "success": "#2e7d4f",
                                          "warning": "#8a5a00", "danger": "#b3261e"}}},
  "resources": {"nunito-700": {"kind": "font", "file": "resources/fonts/nunito-700.woff2", "family": "Nunito",
                               "weight": 700, "digest": "sha256:3b9d0e5f…", "license": "OFL-1.1"}},
  "evidence": "evidence/"
}
```

| Key | Meaning |
|---|---|
| `blocks` | Definition id to file. A kit holds definitions of any rung: components, scenes, shells. |
| `inputs` | The kit's own content fields and knobs, which every kit experience sets in its top-level `with` (5.3). |
| `rulePacks` | Rule packs every kit experience keeps: the kit's own by path, another kit's by `use` with a pin (A11.4). |
| `themes`, `theme` | The kit's themes, and the one used when nothing selects another (7.7). |
| `resources` | Fonts, images, sounds, icon sets and data, as a map (2.6). |
| `roles` | The kit's own role words: id to `{aliases, jobGroup, appliesTo, schema?}` (6.3). |
| `axes`, `rules`, `waivers`, `needs`, `language`, `data` | As on an experience (7.1, A11.3, A11.6, 10.11, 2.7, 2.8). |
| `aliases` | Old definition id to current definition id, so older references still resolve (A13.4, C-19). |
| `rights` | Editor rights (A9.6): right id to `{label, may}`; `may` is required. |
| `evidence` | Folder of stored receipts with its index (A8.1). |
| `samples` | The kit's sample kit experiences, by id to file; a template kit needs one (A14.3), and a kit's play tests mount them (A8.5). |
| `about` | Title, author, licence, the kit version (below) and the trust record (A9.3). |
| `catalogue` | The kit's catalogue file (below): what it offers, one entry per item. A kit with a catalogue is a **library** (D24). |

### Versions

A kit version is `major.minor.patch`, with no leading zeros, and an optional pre-release part (`2.2.0-draft.1`). A
published kit experience never pins a pre-release. The checker compares two versions of a kit and refuses a wrong class
(`E-KIT-VERSION`, files). The comparison covers every document the kit's digest covers (A9.3):

| Class | Allowed changes |
|---|---|
| patch | Body and drawing fixes only. Every face of every block (places, inputs, rules, outputs) and every kit input stays the same. |
| minor | Adds blocks, inputs with `initial` values, outputs, `should` rules, resources and theme values. May widen bounds. Changing an input's `initial` is minor. |
| patch, also | Changes to words, translations, resource files and theme values. |
| own class | Moving a pinned rule pack takes that pack's version class. |
| major | Anything else, including any change to `editableBy` or rights: removes or renames blocks, inputs or outputs; narrows bounds; adds or strengthens a `must` rule; moves a rule pack to a new major version; changes rights. |

### Kit experiences pin a kit version

A kit experience is an experience made from a kit (A14.2). It pins one exact version, and may add the kit's digest:

```json
"kit": {"id": "robin-delivery", "version": "2.1.0", "digest": "sha256:0c4e7a19…"}
```

Readers resolve exactly the pinned version, never "the latest". A missing kit or version, or a digest mismatch, is
`E-KIT-PIN` (files). What a kit experience may do is fixed here and in A14.2: fill content fields, set knobs, choose the
layouts and looks the kit offers, combine kit definitions in its own story graph, add its own words and
resources, and add rules stricter than the kit's (A11.7). Its own definitions, values, behaviour or drawings are
refused (`E-KIT-BODY`), and so is a `with` outside a definition's inputs, bounds or editor rights (`E-TYPE`,
`E-RANGE`, `E-RIGHTS`). Anything more is a kit change, made
by a right with `changeKit`, as a new kit version.

### Re-checking kit experiences when a kit changes

Making a new kit version re-checks every kit experience the kit knows: its `samples`, and every kit experience
file the tool is given (A14.2):

1. Each kit experience is checked against the new version without changing it: the kit tool's full checker run with
   `--against-kit <id>@<new version>` (not an option of the base's `check`, 10.12) resolves the kit experience's pin to that version for the run (10.12), and the kit's
   play tests (A8.5).
2. Each result is stored as a receipt in the kit's evidence, keyed by the kit experience's digest and the kit version the
   run used (the receipt's `kit`).
3. A kit experience that passes may move its pin. Moving a pin is a change request with the address `<experience id>/kit`,
   `old` and `new` the pin objects, by a right with `publish`; check 4 (A9.2) accepts this address for that ability. A pin
   move runs the full checker on the copy with the new pin and refuses on any error. `--against-kit` replaces both
   the pin's version and its digest. Sample kit experiences inside a kit pin the version only (no digest).
4. A kit experience that fails stays on its old pin. The report lists its errors. No pin ever moves silently.

The same holds when a rule pack the kit pins gets a new version: the kit moves to it only in a new kit version.

### The catalogue

A **library** is a kit with a catalogue. kit.json names the file (`"catalogue": "catalogue.json"`). Each item has an
id, a type, a title, 1 to 8 tags, one line, a preview image in the kit, and names exactly one thing of the kit:

```json
{
  "format": "hsvg/2.0", "kind": "catalogue", "kit": "hsvg-starter", "version": "1.0.0",
  "items": {
    "icon-star": {"type": "icon", "title": "Star icon", "tags": ["icon", "control"],
                  "line": "A star icon button with idle, pressed, disabled and selected looks.",
                  "preview": "previews/icon-star.svg", "block": "icon-star"},
    "bg-meadow-dawn": {"type": "background", "title": "Meadow at dawn", "tags": ["nature", "warm"],
                       "line": "Soft hills, a rising sun and long grass.", "preview": "previews/bg-meadow-dawn.svg",
                       "resource": "bg-meadow-dawn"}
  }
}
```

| Type | Names |
|---|---|
| `icon`, `character`, `control` | a `block`: a component the kit lists |
| `layout` | a `block`: a scene the kit lists (with slots, or a layout plan) |
| `shell` | a `block`: a shell the kit lists |
| `background`, `image`, `video`, `sound`, `font` | a `resource` of that kind (a background is an image) |
| `theme` | a `theme` of the kit |
| `preset` | a `preset`: an add-on preset's name (chapter 12) |
| `rule-pack` | a `rulePack`: a rule pack use the kit lists (A11.4) |

The catalogue's `kit` and `version` are the kit's id and `about.version`, so a new kit version updates its catalogue.
The checker validates the catalogue of every kit an experience pins or picks from, and `check` on a kit folder checks
the kit alone (`E-CATALOGUE`, files). Each finding says the fix.

### Pick-and-use

Any experience can use items of a library without being made from it. It lists them in `picks`, each library pinned
to one exact version (as a kit pin, with an optional digest).
It picks from at most 16 libraries, and at most 256 items from each:

```json
"picks": [{"id": "hsvg-starter", "version": "1.0.0", "items": ["icon-star", "frame-quiz", "theme-starter-night"]}]
```

**The rule.** Each item joins the experience under the id the kit gives the thing it names, exactly as the kit has
it, with the definitions it uses:

- a component joins the experience's blocks, so its own scenes may use it
  (`"uses": [{"id": "star", "use": "icon-star", "into": "star-slot"}]`);
- a scene or a shell is used as in a kit experience: a story scene `{"use": "frame-quiz", "with": {...}}`, or
  `"shell": {"use": "shell-paper"}`;
- a resource joins `resources`, its file read from the kit;
- a theme joins `themes` (with the theme it extends); `theme` may select it.

A picked definition is sealed (A9.4): a use gives inputs only (`E-SEAL`, `E-TYPE`, `E-RANGE`). The kit's rights join
the experience's, so its inputs' `editableBy` holds (`E-RIGHTS`). The pin is checked as a kit pin (`E-KIT-PIN`): the
exact version, and the digest when given. An unknown item, or a story scene or shell that uses a definition no item
picked, is `E-REF-UNKNOWN`; an id the experience already uses is `E-ID-DUPLICATE`. A preset or a rule pack is used
by its own door (`presets`, chapter 12; `rulePacks`, A11.4), never picked. The kit's own `rules`, `rulePacks` and
inputs do not join: they are about the kit's experiences, not one item. Readers find a picked library as they find a
kit (`kits/<id>/`, A10.5); a package carries only the kit files its picked items reach. **[files]**

**Pick-and-use and kit experiences (A14.2).** A kit experience is made from one kit: it has all of the kit and nothing
of its own. A picking experience is the author's own: it has its own scenes, blocks and drawings, and borrows named
items. A kit experience never picks (`E-KIT-BODY`): to use another library's item, add it to the kit as a new kit
version. `hsvg add <library> <item>` writes a pick (A14.3).

## A14.2 Kit experiences (was 4.9)

A **kit experience** is an experience that pins a kit version and is built only from that kit's definitions.
Nested experiences (an experience that lists kit experiences of one kit) are a 2.1 draft
(`drafts/structure-2.1.md`); in 2.0 each kit experience is packed on its own, and a host page links them.

A kit experience names its kit and exact version (A14.1). Here every scene is a use of a kit definition. A `with`
value is a formula, with text in single quotes (5.6.1, D36):

```json
{
  "format": "hsvg/2.0",
  "kind": "experience",
  "id": "round-cliff",
  "kit": {"id": "robin-delivery", "version": "2.1.0"},
  "shell": {"use": "robin-screen"},
  "story": {
    "start": "depart",
    "scenes": {
      "depart": {"use": "ride-out", "with": {"destination": "stop-cliff", "windStrength": 2}},
      "cliff": {"use": "delivery-stop", "with": {"stopName": "{{ words.cliff }}", "parcels": 3}},
      "gazette": {"use": "gazette-page", "with": {"headline": "{{ words.cliffHeadline }}"}}
    },
    "ends": ["gazette"],
    "links": [
      {"id": "depart-arrive", "from": "depart", "on": "arrived", "to": "cliff"},
      {"id": "cliff-done", "from": "cliff", "on": "onward", "to": "gazette"}
    ]
  }
}
```

**What a kit experience may do** is set by A14.1: set kit content and knobs; link uses of kit definitions in its own story
graph; select along the kit's representation axes; add words, resources and rules stricter than the kit's. It may carry the keys 4.2 lists for kit experiences and nothing else. It must not
declare values, behaviour or drawings of its own, define blocks, or weaken a kit rule (`E-KIT-BODY`); a waiver by a right in the rule's `waivableBy` is a recorded
exception, not a weaker rule (A11.6). Anything more is a new kit version (A14.1). **[files]**

**Checks.** A sealed kit definition is verified once, in the kit, so every use is verified (A9.4). A kit experience
check therefore runs only: the pin (`E-KIT-PIN`), every `with` against the definition's declared inputs, bounds and
editor rights (`E-TYPE`, `E-RANGE`, `E-RIGHTS`), the graph rules of 3.9, and the kit's rule packs on the whole kit experience
(section 8). Errors name the broken kit rule. **[files]**, plus the kit's play tests **[playing]**.

**Versions.** A kit experience pins one exact kit version. A new kit version re-checks every kit experience the kit knows (A14.1);
a kit experience that passes may move its pin by a change request, and one that fails stays on its old pin (A14.1). No pin
moves silently. **[files]**

A kit may mark a kit experience as a starting point. Starting from it copies the kit experience and records `about.derivedFrom`
(A14.3); the copy is an independent kit experience, not a live use. An experience that is not made from a kit may still
use single items of a library: pick-and-use (A14.1).

## A14.3 Variations (was 4.10)

A **use** is a live reference: the definition stays the source, and its seal and proofs carry over. A
**variation** is a copy that then differs: it has its own proofs and records its origin.

`about.derivedFrom` records the source at the moment of copying:

```json
"derivedFrom": {"id": "hub", "version": "1.0.0", "digest": "sha256:9f2c71e4…"}
```

- It is required on every derived document and never removed. A copy of a copy names its direct source (files).
- Reviews are not copied: they were about the source's digest. The copy starts with no reviews.
- Resources keep their own licences. The copy keeps the source's licence unless its author changes it.

The tool verb **instantiate** makes variations. It writes to a folder that must not exist, gives the copy its new
document id, keeps internal ids (they are scoped) and runs the checker on the result.

| Call | Result |
|---|---|
| `hsvg new <name> --from <template> [--in <folder>]` | **Built** (`engine/v2/tools/library.mjs`). A new experience in `<folder>/<name>/` that copies the template: a folder with `experience.json`, or the name of a starter template (`library/2.0/templates/`). Its id is `<name>`; `derivedFrom` names the template (its id, its `about.version` or else the version of the kit it pins, and its digest); reviews are not copied; a kit the new folder cannot find is copied into its `kits/<id>/` (A10.5); the kit pin gets the kit's digest (A9.3), so a later change to a kit file is `E-KIT-PIN`; the result is checked. |
| `hsvg add <library> <item> [--to <experience>]` | **Built.** Adds one catalogue item to the experience's `picks` (A14.1), pinned to the library's version and its digest (A9.3); brings the kit if the experience cannot find it; checks. One experience pins one version of a library. On a kit experience of the same kit it changes nothing (the item is there). |
| `hsvg instantiate <kit> <experience-id> --from <sample-id> [values.json]` | A new kit experience in `./<experience-id>/` that pins the kit and copies the sample kit experience, with `derivedFrom` naming the sample (A14.2). `values.json` maps input addresses to values. |
| `hsvg instantiate <kit> <new-kit-id> --kit` | A new kit (a fork) in `./<new-kit-id>/` with a new id, at version `0.1.0`; `derivedFrom` names the source kit. |
| Detach, in an editor | The use's definition is copied into the container as an open local definition (A9.4). |

A **template** is a starter experience that `hsvg new` copies (D24): any checked experience, usually a kit experience of
a library. The 2.0 starter templates are in `library/2.0/templates/`. A kit may also be marked for starting from: `"about": {"template": true}`. A template kit holds at least one
sample kit experience that passes its checks, with the receipt in its evidence. "Save as template" sets the mark on a kit.
The `template/0.1` fill tool is replaced by `instantiate` (A13).

The no-copy rule (A11.1) refuses exact copies inside one experience; a copy must be a use or declare `derivedFrom`.

## A14.4 Product labels: the five dials (was 1.9)

A product is a setting of five dials. A **product label** is a named dial setting (`about.preset`). It is a description word for libraries and galleries
and never decides anything; it is not a preset of the add-on door (12.3). Preset ids are kebab-case (2.5).

| Dial | Values |
|---|---|
| **sizes** | one shape, a few shapes (wide, tall), or many sizes |
| **joined by** | nothing (one scene), time, events, scroll, page signals |
| **liveness** | what makes it change: nothing (static), content set before it runs, data fed while it runs, or triggers (player or seat input) |
| **lifetime** | none (nothing outlives the moment), run, session, saved: the lifetimes of 1.5 |
| **host** | own page, ad placement, portal, app, AI assistant, someone else's page; delivered by running packed, running served, or an export (section 10) |

| Preset | Sizes | Joined by | Liveness | Lifetime | Host |
|---|---|---|---|---|---|
| static banner | many sizes | nothing | content | none | ad placement (export) |
| animated ad | many sizes | time | content, data | none | ad placement (export) |
| interactive ad | many sizes | time, events | data, triggers | none | ad placement, portal |
| slide video | a few shapes | time, or a Next trigger | content | run | page, video export |
| interactive video | a few shapes | time, choices | triggers | run (the path taken) | page |
| data story | a few shapes | scroll | data | none | page |
| lesson | a few shapes | events | triggers, knobs | saved | page, app, learning platform |
| game | a few shapes | events | triggers | saved | page, app |
| website mascot | one shape | page signals | triggers, AI | session | someone else's page |
| tour | one shape | events, page signals | triggers | session | someone else's page |


