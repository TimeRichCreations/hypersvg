# 2. Files and names

JSON documents own meaning, content and behaviour; drawings (section 6) own shapes and places. This section defines
what every file shares: the header, the closed list of document kinds, folders, `about`, resources, words, data
tables, the one grammar for ids and addresses, and what a drawing file is and which SVG it may use.

Rules end with their check: **files**, **playing** or **review**, as in section 5.

## 2.1 JSON documents

1. A document is one UTF-8 JSON object. Duplicate keys are refused before anything else is read. Numbers are finite.
   The keys `__proto__`, `prototype` and `constructor` are refused everywhere. `E-JSON` (files).
2. **Closed.** Every key is defined by this spec, by the tool reference, or by an add-on's manifest inside the
   `addons` pocket (10.7); an add-on's words are allowed only in a document whose `needs` names that add-on, or that
   belongs to an experience or kit whose `needs` does (its scenes, shell and definitions inherit it). Any other key is an error. There are no `x-` keys: tool data lives in the tool's own sidecar outside the format, never packed.
   `E-KEY-UNKNOWN` (files).
3. **Maps and lists.** In a map, the key is the entry's id or name; an entry never repeats it in an `id` field. A list
   is used only where order matters (links, uses, tracks, layouts, bindings, rules, action lists: they are
   tried, drawn or applied in list order). Key order in an object means nothing; list order is kept.
   `E-KEY-UNKNOWN`, `E-ID-DUPLICATE` (files).
4. **Ids in lists are optional (D29)** on actions, reactions, bindings, clip tracks and story links. An entry without
   an id is keyed by its position in its list, written as a path: `bindings[2]`, `clips.walk.tracks[0]`,
   `on.press:go[0].actions[1]`. Messages name that position. An id starts with a letter and holds no dot or bracket,
   so a position never equals an id. An entry needs an id only where something outside its list names it:
   - a choice link, which is picked by its id (3.5);
   - a link with `max`, whose count is saved (3.6);
   - an action whose end an `on` map hears by id (the `page` add-on's `page:ended:<id>`; without an id the event is
     keyed by position, and nothing hears it).
   Values, controls, clips, machines, uses, scenes, layouts and clip markers keep their names, because content refers
   to them. A tool that needs a stable address asks for an id and says why. (files)
5. **Measures.** Times are whole milliseconds, in fields ending in `Ms`. Angles are degrees. Geometry is in drawing
   coordinates; `Px` means CSS pixels. Points are `[x, y]`, boxes `[x, y, w, h]`. Colours are `#rrggbb` (files).
6. **Text is text.** No HTML, CSS, selectors, scripts or code in any value: values are never parsed as markup, so
   `5 < 6` and `Tom & Jerry` are plain text and need no check. Formulas and templates appear only where
   section 5 allows them (files).
7. **Paths** to files are relative to the document that names them, stay inside the folder of the experience or kit
   that document belongs to, name regular files, and follow the portable names of A10.5: forward slashes, no `.`
   segments, `..` only while the path stays inside that folder, no absolute paths, URLs or backslashes. `E-PATH`; a path that names no file is `E-FILE-MISSING` (files).
8. In this spec's examples, a digest ending in `…` is shortened; real files hold all 64 hex digits.
9. Drawings are not JSON documents. They have no header; `data-hsvg-version` marks them (2.10).

## 2.2 The header

Every document has three header keys:

```json
{"format": "hsvg/2.0", "kind": "scene", "id": "stop-harbour"}
```

| Key | Value |
|---|---|
| `format` | Exactly `hsvg/2.0`. |
| `kind` | One of the kinds in 2.3. |
| `id` | The document's id (2.9). |
| `$schema` | Optional: an editor schema address. Never fetched by a player. |

- Readers accept `hsvg/0.1`, the 1.x chapters and sidecars only through the upgrade tool, on a copy (A13).
  Any other `format` is refused. `E-HEADER` (files).
- **A later minor version.** A 2.0 engine refuses a document whose `format` is a later minor version (`hsvg/2.1`), and
  a drawing whose `data-hsvg-version` is one (`2.1`), with its own code, so the person knows to use a newer engine.
  Functions and built-in values added in a later version never need this: an author's own names win (5.9). The
  version changes only for real format changes. `E-VERSION-NEWER` (files).
- **Ids and file names.** A document that is the main file of its own folder (`scenes/stop-harbour/scene.json`,
  `components/robin-hero/component.json`) has the folder's name as its id. A document in a flat file
  (`scenes/hook.json`, `shell/robin-screen.json`, `rules/harbour-brand.json`) has the file's base name. The ids
  of the other kinds (play test, receipt, host profile) need not match a file name; a `package.json` takes
  its entry experience's id. `E-ID-FILE` (files).

## 2.3 Document kinds

The `kind` list is closed. There is no compound kind: components arranged as one are a component (4.1).

| Kind | What it is | Usual file | Defined in |
|---|---|---|---|
| `experience` | Scenes linked in a story graph. With a `kit` pin it is a **kit experience**. | `experience.json` | 3, 4.2, A14.2 |
| `scene` | One moment: a scene, an ad moment, a slide, a node of the story graph. | `scenes/<id>/scene.json` | 3.1, 4.2 |
| `shell` | The screen around scenes: a drawing with slots for stages and widgets. | `shell/<id>.json` | 10.1 |
| `component` | A reusable block with its own drawing. | `components/<id>/component.json` | 4.4 |
| `kit` | A versioned set of definitions, themes and resources. | `kit.json` | A9.4, A14 |
| `rule-pack` | Shared rules for one domain, for the checker. | `rules/<id>.json` | A11.4 |
| `receipt`, `change`, `play-test`, `package`, `host-profile` | Records and messages for tools: a check's receipt, a change request, a play test, a package descriptor, a host's profile. | (various) | the tool reference: A8, A9.7, A10 |
| `capability` | A built-in add-on's manifest. It comes with the add-ons release. | `capabilities/<id>.json` | 10.7, 12 |

- An unknown kind is refused. `E-HEADER` (files).
- The upgrade tool keeps `scene`, maps chapter files to their kinds, and turns the editor `layout` document into a
  tool sidecar outside the format (A13).

## 2.4 Folders

A folder is edited, reviewed, moved and versioned as one: a scene, a component or a kit lives in its own folder.

An experience:

```text
robins-grand-delivery/
  experience.json              about, story, blocks, axes, values, resources, words, data
  shell/
    robin-screen.json          the shell (10.1)
    robin-screen.svg           its wide frame
    robin-screen.phone.svg     its tall frame
  scenes/
    stop-harbour/
      scene.json
      stop-harbour.svg         wide frame
      stop-harbour.phone.svg   tall frame
      words/en.csv             the scene's own words
  components/
    robin-hero/
      component.json
      robin-hero.svg
  resources/
    fonts/  images/  sounds/  icons/
  data/
    stops.csv
  words/
    en.csv
  tests/
    cliff-delivery.json   a play test (A8.5); kept beside a package, never a member
```

Code is never part of a folder: logic modules come from the host (10.7, A9.3).

A kit, and a kit experience made from it:

```text
robin-delivery/                    robins-delivery-rounds/
  kit.json                           experience.json
  components/<id>/…                  experiences/
  blocks/<id>.json                     round-harbour/
  scenes/<id>/…                          experience.json      pins robin-delivery 2.1.0
  shell/<id>.json, <id>.svg              words/en.csv
  rules/<id>.json      rule packs
  resources/…
  words/<language>.csv
  evidence/            receipts (A8.1)
  samples/<id>/…       sample kit experiences (a template kit needs one, A14.3)
```

- Every file in a folder is named by a document or a drawing; a file named by nothing is reported. `W-FILE-UNUSED`
  (files). The `tests/` and `evidence/` folders are exempt: play tests and receipts live there.
- A package (A10.5) carries the experience folder and the pinned kits, with a digest for every member.

## 2.5 About

`about` is the descriptive part of a document. **It never decides anything:** no formula, guard, link, rule or player
reads it (5.8). `E-WORDS-DECIDE` (files).

| Field | Value |
|---|---|
| `title` | Plain text, at most 1,024 UTF-8 bytes |
| `description` | Plain text |

Its other fields are records for tools and libraries: `author`, `credits`, `license`, `category`, `tags`, `preset`,
`ages`, `version`, `derivedFrom`, `template`, `level` and the trust record `trust` (provenance, reviews, digest, pins,
signature). They are defined in the tool reference (A9.3, A10.7, A14). `about.title` is a catalogue title; a drawing's
`<title>` is its accessible name (6.5).

## 2.6 Resources

A **resource** is a file a document uses that is not a JSON document or a drawing: an image, a font, a sound, a video,
an icon set, a data file or a words file. Each is declared once, in the `resources` map of one document, and used by its id.

```json
"resources": {
  "bitter-700": {"kind": "font", "file": "resources/fonts/bitter-700.woff2", "family": "Bitter", "weight": 700,
                 "digest": "sha256:0a7d2c44…", "license": "OFL-1.1", "source": "Bitter 2.110"},
  "croissant-photo": {"kind": "image", "file": "resources/images/croissant.webp", "width": 1200, "height": 900,
                      "digest": "sha256:7c90e1b3…", "license": "LicenseRef-Bakery-Stock",
                      "source": "Bakery photo library, item 4471"},
  "harbour-line": {"kind": "icon-set", "file": "resources/icons/harbour-line.svg", "digest": "sha256:e2d4a815…",
                   "license": "ISC", "source": "lucide 0.468.0, outline subset"},
  "bell": {"kind": "sound", "file": "resources/sounds/bell.wav", "durationMs": 640, "digest": "sha256:51f0c3aa…"},
  "welcome-clip": {"kind": "video", "file": "resources/video/welcome.mp4", "durationMs": 21000, "width": 1280,
                   "height": 720, "digest": "sha256:3b81d6e0…",
                   "captions": {"en": "welcome-captions-en"}},
  "welcome-captions-en": {"kind": "captions", "file": "resources/video/welcome.en.vtt", "language": "en",
                          "digest": "sha256:a4c7e152…"},
  "stops": {"kind": "data", "file": "data/stops.csv", "digest": "sha256:9e3b7d02…"},
  "words-en": {"kind": "words", "file": "words/en.csv", "language": "en", "digest": "sha256:c6a1f48e…"}
}
```

| Field | Kinds | Meaning |
|---|---|---|
| `kind` | all | `image`, `font`, `sound`, `video`, `captions`, `icon-set`, `data` or `words`. Required. |
| `file` | all | The path (2.1). Required. |
| `digest` | all | The SHA-256 of the exact bytes, `sha256:` and 64 lower-case hex digits (A9.3). Tools write it. Required. Examples in this spec shorten it with `…`. |
| `license`, `source` | all | Licence as in `about`; where the file came from, in words. Never fetched. |
| `family`, `weight`, `style` | font | The family name drawings use (required); a weight or `[min, max]` for a variable font (default 400); `normal` or `italic` (default `normal`) |
| `width`, `height` | image, video | Pixel size, measured by tools and checked against the file; for an SVG image, its viewBox size |
| `durationMs` | sound, video | Measured length, checked against the file; for a video, at most 86,400,000 (24 hours) |
| `poster` | video | Optional: the id of an `image` resource shown before the video plays and when it cannot |
| `captions` | video | Optional: a map from a language tag (7.8) to the id of a `captions` resource in that language |
| `language` | words, captions | The language tag of the file. Required. |

| Kind | Formats | Limits |
|---|---|---|
| `image` | PNG, JPEG, GIF, WebP; SVG checked by the rules of 2.11 | 8 MiB each |
| `font` | WOFF2 | 512 KiB each; 1 MiB for all fonts of one package |
| `sound` | WAV, OGG, MP3 | 200,000 bytes each; 2,000,000 bytes for all sounds; at most 30 s decoded |
| `video` | MP4 (H.264 video, AAC audio) or WebM (VP9 video), a local file. Played by the `media` add-on | 64 MiB each; a `videoBytes` budget (all video resources together, A10.3) may only lower this. Package members: A10.5 |
| `captions` | WebVTT, UTF-8, one file per language, in the manner of `words` (2.7) | 8 MiB |
| `icon-set` | SVG: a root `<svg>` with `data-hsvg-version`, holding `<symbol>` elements, each with a `viewBox` and `data-hsvg-role="icon"`, named by its `id` (6.2.2) | 1 MiB |
| `data` | CSV (RFC 4180) or JSON (2.8) | 8 MiB, 1,024 rows per table |
| `words` | CSV with the header `id,text` (2.7) | 8 MiB |

- **Checked.** The file exists, its signature matches its suffix, its bytes match `digest`, and it is within its
  limits. Host budgets may be stricter (A10.3); a host may let content raise these limits (A10.8). `E-RESOURCE`
  (files).
- **Declared once.** A file is declared by one resource only. Two declarations of one path, or of equal digests in one
  document, are refused; a package stores each digest once. `E-RESOURCE-TWICE` (files).
- **Used by id.** Picture and icon content (5.3.1), theme fonts and icon sets (7.7), data tables (2.8), words (2.7),
  sounds (6.10), and videos with their captions name resources by id. A key that accepts only one kind of resource takes the bare id. A drawing's
  `<image>` may also give the image resource's path, relative to the drawing file, for a resource its document or
  (for a kit definition) its kit declares (2.11). `E-REF-UNKNOWN` (files).
- **Scope.** A resource id resolves in the document that names it, then in the experience (for its scenes, shell and
  definitions) or the kit (for a kit's definitions). A sealed definition resolves only in itself and its kit. An id
  declared at two levels is refused (`E-NAME-SHADOW`, files), except a `words` resource: an owner's words win (2.7).
- **Licence.** A resource made by the document's own author takes the document's `about.license`. Fonts, icon sets
  and images from someone else need their own `license` and `source`, at every level (A10.7); whether a file is
  someone else's is a review question (files, review).
- **No remote files.** A resource is always a local file in the package. Data from a server is a host request through
  grants (10.5), not a resource (files).
- **Closure.** Every family in every `font-family` stack a drawing names (compared case-folded, without quotes) is a
  font resource in scope, a generic family (`serif`,
  `sans-serif`, `monospace`, `system-ui`), or a host font named in `needs` as `font:<family>` (10.11). Host fonts are
  named in the experience's (or kit's) `needs`; its scenes and definitions inherit them. (review: the 2.0 checker
  does not read fonts)
- **One sound, one file.** A sound is one resource; each use sets its own gain (6.10), so one WAV is declared once.
- An image embedded in a drawing as a `data:` URI belongs to that drawing and its licence (2.11).

## 2.7 Words and languages

Visible prose lives in words files: one CSV per language and owner, declared as `words` resources. The exceptions
are a content field's `initial` (section 5), a drawing's sample text (6.2.2) and the literal text of templates
(5.7), all in the default language, and a text field's language object (5.3.1), which holds its own languages. In an experience with more than one language, each template literal warns
(`W-WORDS-MISSING`).

```text
id,text
onward,Onward
harbourWaiting,Bruno is waiting for his parcel.
parcelsLeft.one,One parcel left
parcelsLeft.other,"{{ formatNumber(parcels, 0, true) }} parcels left"
decimalMark,.
groupMark,","
```

```json
"language": "en"
```

- **The file.** UTF-8 without a byte order mark, RFC 4180 quoting (LF or CRLF line ends), the exact header `id,text`. Word ids are value names (2.9), optionally followed by `.<plural form>`, unique in the
  file. `E-WORDS` (files).
- **The `language` key** names the default language: the language of the block's drawn text, its `initial` content and
  its default words. It is required on an experience or kit that has words files; other documents inherit it. Scenes, the shell and the experience's own definitions share the experience's default; a kit's
  definitions share the kit's. The default language has a file holding every word id. `E-WORDS` (files).
- **Translations** have the same ids or fewer. A translation that adds an id is refused (`E-WORDS-UNKNOWN`); a
  missing translation shows the default word and warns (`W-WORDS-MISSING`) (files, playing).
- **Owners and fallback.** A scene, shell or component may own words. A lookup tries the owner's words
  through the whole language fallback below, then the experience's (or, for a kit definition, the kit's) the same
  way. A sealed definition falls back only to its kit's words. An owner may use an id the experience also has; the
  owner's word wins for the owner (files).
- **Language fallback.** The active language (7.8), then the same tag without its last subtag (`en-in` to `en`), then
  the default language (playing).
- **Plural forms.** A word with plural forms has rows `<id>.<form>`, forms from `zero`, `one`, `two`, `few`, `many`
  and `other`; `other` is required. The word id is `<id>`; formulas read a form with `plural(count, '<id>')` (5.6.4).
  The form is chosen by the count with the active language's CLDR cardinal plural rule, as the platform gives it
  (`Intl.PluralRules`, type `cardinal`). The engine bundles no plural tables. Where the platform has no
  `Intl.PluralRules`, or does not know the language, the fixed fallback applies: `one` for a count of exactly 1,
  else `other`. A form with no row reads `other`. `E-WORDS` (files, playing).
- **Sample text.** The reserved word id `sampleText` gives a language's sample for the `longest` pressure case (7.6).
- **Number marks.** The reserved word ids `decimalMark` and `groupMark` give a language's marks for `formatNumber`
  (5.6.4); the defaults are `.` and `,` (playing).
- **Templates.** A word may hold a template; it is expanded once, in the scope that reads it (5.7). It is still plain
  text: no markup.
- **Words never decide** (5.8). A data cell or a choice that must translate holds a word id, not prose (files).
- **Locale data** other than words (text direction) is an option of the language axis (7.8). Fonts must cover every
  character of every language they show (7.8, review).

## 2.8 Data tables

A **data table** is typed rows of content, checked before play. Tables are declared in `data`, by a name that formulas
read as `data.<name>` (section 5).

```json
"data": {
  "stops": {"resource": "stops", "key": "id", "maxRows": 16,
            "columns": {"id": {"type": "string", "maxLength": 32},
                        "nameWord": {"type": "string", "maxLength": 48, "word": true},
                        "parcels": {"type": "number", "minimum": 0, "maximum": 9}}}
}
```

| Field | Meaning |
|---|---|
| `resource` | A `data` resource (2.6). Optional: a table without one only gives the shape of a `rows` content field (below), and `data.<name>` reads no rows |
| `key` | Required: a string column whose values are unique |
| `columns` | Column name to a type of 5.1.1 (no `initial`); a string column may add `word` or `text` (below) |
| `maxRows` | Required: 1 to 1,024 |

- Table names are value names; column names follow 5.9. `E-NAME-SHAPE` (files).
- **CSV**: UTF-8 without a byte order mark, RFC 4180 (LF or CRLF line ends), a header of exactly the declared columns, any order. Number
  cells use JSON number syntax; boolean cells are `true` or `false`; an empty cell is an empty string in a string
  column and an error in any other; strings stay strings; no type is guessed. Arrays and objects need a JSON file. **JSON**: an array of
  closed row objects with every column. `E-DATA` (files).
- Every cell is checked against its column before play. Row order is the authored order (files).
- A key used as a repeated use's row key must follow the id grammar; give the table a separate id column if needed
  (4.5) (files, playing).
- Text a person reads is a word id in a cell, never prose that a condition could read (5.8). A string column with
  `"word": true` holds word ids: every cell is checked against the words in scope in every language
  (`E-REF-UNKNOWN`, files). A table that shapes a `rows` content field may instead mark a column `"text": true`: its
  cells are words a person reads, edited under the field's rights (5.3.1); in the field's value a cell may be a tier
  object or a language object, as a `text` field's value may. Like any `text` field they never feed a condition
  (5.8).
- Words files and data tables change only with a new version of their document. What an editor may change is a
  content field (A9.6): a `text` field, or a `rows` field with `text` columns (a teacher's quiz questions).
- A content field of `contentType` `rows` takes rows in a table's shape (5.3.1). There are no network tables; data
  from a server arrives through a granted host request (10.5).

## 2.9 Addresses and ids

**Names.** One grammar per kind of name:

| Name | Grammar | Used for |
|---|---|---|
| id | `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`, at most 48 characters | documents, scenes, uses, definitions, local drawing ids, slot names, variants, controls, options, links, clips, tracks, markers, lines, effects, machines, machine states, reactions, actions, bindings, rules, resources, themes, roles, layouts, rights, chapters |
| value name | `^[a-z][a-zA-Z0-9]*$`, at most 48 characters, not reserved (5.9) | values, computed values, inputs, outputs, events, word ids, data tables |
| content field name | a value name, or a role and a value name joined by one dot (5.3.1) | `headline`, `action.text`, `pricing.amount` |
| drawing id | `<namespace>__<local id>` in a component drawing (2.12) | SVG ids only, never JSON |
| size | `<width>x<height>`, whole CSS pixels | `300x250` (7.2) |
| version | `major.minor.patch`, optional `-pre-release` | `about.version`, pins |
| pinned name | `<id>@<version>` | `needs` (10.11), rule pack uses (A11.4), trust `pins` (A9.3), receipt `packs` (A8.1) |
| digest | `sha256:` and 64 lower-case hex digits | resources, trust, pins |
| language tag | lower-case BCP 47: `^[a-z]{2,3}(-[a-z0-9]{2,8})*$` | words, the language axis |
| icon id | the id grammar (`clock`, `arrow-left`) | an icon `<symbol>`, icon content |

- **Scopes.** Each document is a scope. Its JSON ids are unique across kinds (the ids of nested things, such as
  machine states, clip tracks and markers, and options, are unique within their parent); its value names are unique and never
  shadow an outer name (5.1.3); a use id never equals a value name of the same document. Its drawing's local ids are
  unique in the drawing; they may equal a JSON id, because every key says which it expects (a `target` names a drawn
  part). A use id equal to a value name is `E-ID-DUPLICATE`. `E-ID-DUPLICATE`, `E-NAME-SHADOW` (files).
- **Stable.** Ids are never renumbered. Moving a block, translating words or changing a drawing keeps them. A copy
  gets new ids or records `derivedFrom` (A14.3) (files).

**References inside a document** are local: an id or a name of this document or its drawing (`"target": "near-wing"`,
`"into": "robin"`, `"use": "robin-hero"`).

**Dots** appear in four places only. Everywhere else a reference into a use is a path (below).

- A role-prefixed content field name: `action.text` (5.3.1). It is a name, not a reference. One language of a text
  field is addressed as `<address>@<tag>` (`banner/message.headline@de`).
- A use's events and triggers: `<use-id>.<event>`, as `robin.arrived` in an `on` key (5.12) or
  `{"emit": "mascot.celebrate", "as": "trigger"}` (5.15.1).
- An attach target: `"to": "bike.basket"` (6.9), sugar for the path `bike/basket`; checkers print the path.
- A column of one row of a `rows` content field, only after `field:` in a typed reference:
  `field:features.items.2.title` (rows count from 1; the `fit` add-on).

In formulas, a use's output values are read as `uses['<use-id>'].<output>` (5.4).

**Paths** name anything from outside its document: ids joined by `/`, from a scene (or the shell, or a kit definition)
down through uses to a local id. Inside a document a path starts at one of its own uses (`bike/front-wheel`).

```text
stop-harbour/robin/near-wing          a part of a use, in a scene
stop-harbour/answers/q2-b/label       a part of one repeated use, by its row key
robin-hero/mouth/open                 a variant of a part, in a definition (a review's "of", A9.3)
offer/message.headline                an input of a direct use, as promote names it (A9.5)
robins-grand-delivery/stop-harbour/robin/near-wing     the same part, absolute
```

- A path is written from the experience (or kit) that holds it; the absolute form adds the experience's or kit's id
  in front. A repeated use adds its row key after its id. A variant adds its name after its part.
- Paths are what diagnostics, receipts, changes, play tests and editor sidecars use (files).

**Typed references.** Where a key accepts several kinds of thing (a rule's subject, a layout item, a receipt), the
reference carries its kind: `<kind>:<reference>`.

| Prefix | Names | Example |
|---|---|---|
| `part:` | a drawn part | `part:front-wheel` |
| `place:` | a place (slot, fit box, repeat, protected area, route) | `place:caption-box` |
| `field:` | a content field | `field:action.text` |
| `input:` | any input | `input:rideSpeed` |
| `value:` | a value of the document | `value:score` |
| `use:` | a use | `use:product-photo` |
| `scene:` | a scene | `scene:quiz` |
| `document:` | a whole document (a receipt's subject, A8.1) | `document:harbour-ad` |
| `role:` | everything with a role | `role:legal` |
| `resource:` | a resource | `resource:bitter-700` |

The prefixes `color:` (a theme colour role), `data:` (a data table) and `play-test:` (a play test, as a receipt
subject) work the same way. Three bare words also select things in rules (section 8): `controls` (every control
target), `graph` (the story graph) and `resources` (every resource, A10.3). They are not CSS selectors, which content never contains (2.1). A typed reference may hold a path or a dotted form
after its prefix (`part:robin/near-wing`).

**Diagnostics name both sides.** A problem found at a use names the use site and the definition (10.12):

```text
E-RANGE  scenes/stop-harbour/scene.json /uses/2/with/speed   stop-harbour/bike/speed
         definition components/bike/component.json /inputs/speed   bike/speed
         speed 14 is above the maximum 12. Use 2 to 12, or ask for a kit version with a wider range.
```

## 2.10 What a drawing is

1. A drawing is plain SVG. It must render correctly in a browser that knows nothing of HyperSVG, except that a use
   mounted in a slot appears only once the player mounts it or an export writes it in as a placed copy (4.1). Meaning lives only in
   `data-hsvg-*` attributes (6.1) and in the id rules (2.12) (review).
2. A drawing is UTF-8 XML with one root `<svg>` in the SVG namespace. The root has a finite `viewBox` with positive
   width and height, and `data-hsvg-version="2.0"`. `E-SVG-ROOT` (files).
3. Every drawing file is one **frame** of one block: its drawing at one size or shape (6.6). There are two
   forms:
   - A **component drawing** holds one component: exactly one top-level drawn element, a `<g>` marked
     `data-hsvg-kind="component"`. Only `<title>`, `<desc>` and `<defs>` may sit beside it. The `<g>`
     carries no `transform`. `E-KIND` (files).
   - A **screen drawing** holds one scene or one shell. Its root `<svg>` is marked `data-hsvg-kind="screen"`.
4. Each drawing belongs to exactly one block document, which names it (section 2). Two documents naming one drawing
   is an error; reuse is a use, not a shared file. `E-DRAWING-OWNER` (files).
5. Drawings mark only element, part, component and screen (decision 11, D31). Scenes, shells and
   experiences are JSON documents.
6. A tool may author in another form, such as a JSON scene it renders to SVG, only when its output is a 2.0 drawing
   and reading that drawing back gives the same scene (decision 4). The format holds only the SVG (review).

## 2.11 Allowed SVG

A drawing uses a closed subset of SVG. Anything outside it is refused by the checker and by the browser mount, which
share one parser and one rule set. `E-SVG-UNSAFE` (files).

**SVG elements allowed.**

| Use | SVG elements |
|---|---|
| Structure | `svg` (the root, a placed copy, an icon place), `g`, `defs`, `symbol`, `use`, `title`, `desc`, `metadata` (the tool record only, 6.6) |
| Shapes | `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon` |
| Text | `text`, `tspan`, `textPath` |
| Pictures | `image` |
| Paint | `linearGradient`, `radialGradient`, `stop`, `pattern`, `marker` |
| Clipping | `clipPath`, `mask` |
| Filters | `filter`, `feBlend`, `feColorMatrix`, `feComponentTransfer`, `feFuncR`, `feFuncG`, `feFuncB`, `feFuncA`, `feComposite`, `feDropShadow`, `feFlood`, `feGaussianBlur`, `feMerge`, `feMergeNode`, `feMorphology`, `feOffset`, `feTurbulence`, `feDisplacementMap` |

Canvas.fit Lean's six element types are this subset seen from JSON: `text` is `<text>`, `image` is `<image>`, `rect`,
`ellipse` and `line` are the shapes of the same names, and `vector` is `<path>` and `<g>` with gradients, masks and
clips.

**Refused.** `<script>`, `<foreignObject>`, `<style>`, `<a>`, every animation element (`animate`,
`animateTransform`, `animateMotion`, `set`, `mpath`), `feImage`, `<switch>`, `<view>`, SVG fonts, HTML elements, event
attributes (`on…`), DOCTYPEs, entity declarations and processing instructions (the `<?xml version="1.0" encoding="UTF-8"?>` declaration
is allowed). Ordinary character references such as
`&amp;` work. A drawing that is not well-formed UTF-8 XML, or holds a DOCTYPE, an entity declaration or a processing
instruction, is refused whole: `E-SVG-PARSE` (files).

**Attributes.** The closed list is in `vocabularies.json` (`svgAttributes`): the geometry attributes of each allowed
element and the SVG presentation attributes (`fill`, `stroke` and its family, `opacity`, `fill-opacity`, `fill-rule`,
`clip-path`, `mask`, `filter`, `transform`, `font-*`, `text-anchor`, `letter-spacing`, `display`, `visibility`,
`pointer-events`, `paint-order`, `vector-effect`, `preserveAspectRatio`, `pathLength` and the rest of that group);
also `id`, `class` (inert: no stylesheet reads it), `href` (`xlink:href` is read as `href`), `style`, the marks of
6.1, `data-<tool>-*`, and the declarations `xmlns` and `xmlns:xlink`. Other XML namespaces are refused. The player owns `role`, `tabindex` and `aria-*`: authored ones
are refused (6.5). `E-A11Y-OWNED` (files).

**Addresses.** `href` on `<use>` and every `url(…)` point to a local `#id`. `href` on `<image>` is a `data:` URI of
type `image/png`, `image/jpeg`, `image/gif`, `image/webp` or `image/svg+xml`, or the path, relative to the drawing
file, of an image resource the owning document (or, for a kit definition, its kit) declares (2.6). An
`image/svg+xml` data URI is not parsed: a browser shows an SVG image inert (no script, no links, nothing fetched),
and the page's CSP allows images only from `data:` and `blob:`. No `http:`, `https:`, `javascript:` or other scheme
anywhere. Addresses are read as a browser reads them: entities and CSS escapes decoded, every tab, CR and LF
removed, and C0 controls and spaces at the ends removed, before the scheme test (files).

**CSS.** Only `style` attributes, with plain declarations of the presentation properties in `svgAttributes`, plus
`mix-blend-mode`, `isolation`, `touch-action` and, on the root, `background-color`: no `@import`, no comments, no `url()` except a local
`url(#id)`, no positioning properties (`position`, `z-index`, `inset`, `top`, `left`, `right`, `bottom`), no custom
properties (`--name`). At most 65,536 UTF-16 units of `style` text per drawing (files).

**Limits.** At most 30,000 SVG elements and 4,000,000 characters per drawing; at most 8 nested `<use>` references and
no cycles; at most 100,000 elements once every `<use>` is expanded; at most 32 primitives per filter and 64 filter or
mask applications per drawing; `stdDeviation` and `feMorphology` radii lie in 0–32 and `numOctaves` in 0–4. Anything
over a limit is refused, never clamped. `E-SVG-LIMIT` (files).

## 2.12 Ids and names in drawings

The id grammar is section 2's: kebab-case, `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`, at most 48 characters. In a namespaced id
(rule 2) the namespace and the local id each follow it.

1. **Unique.** Every `id` in a file is unique, `<defs>` included. `E-ID-DUPLICATE` (files).
2. **Component drawings are namespaced.** The component root's id is its **namespace**, which equals
   the component's document id. Every other id in the file is `<namespace>__<local>`, where `<local>` follows the id
   grammar: `robin-hero__near-wing`. The double underscore appears only as this separator. `E-ID-SHAPE` (files).
3. **Screen drawing ids** follow the id grammar and contain no `__`, except inside a placed copy, whose ids carry the copy's
   own namespace (files).
4. **JSON uses local ids.** A block's JSON names the things in its own drawing by local id: `near-wing`, not
   `robin-hero__near-wing`. In a screen drawing the local id is the id. The namespace exists so that drawings can be
   composed as plain SVG without clashes; it never appears in JSON (files).
5. **Layout drawings share ids.** All drawings of one component's layouts use the same namespace and the
   same ids for everything the JSON names (section 7). Only one is mounted at a time (files).
6. **Mounted ids.** When the player mounts a use, it replaces the definition's namespace with the use's path joined
   by `__` (`ride__robin__near-wing`) in ids and in every local reference: `href`, `url(#…)`, `data-hsvg-follow`.
   Authors never write mounted ids; addresses (section 2) name things instead. A mounted scene's own ids take the
   scene id the same way (`hook__headline`), so two scenes shown together during a fade never clash (playing).
   When several players share a page, the host also gives each mount an outer namespace, such as
   `hsvg1__hook__headline`, and rewrites those same local references. This prefix stays stable for that mount.
   It does not change authored ids, JSON addresses or the host API; generated DOM ids are not authoring addresses.
7. **Slot names** are the values of `data-hsvg-slot` (5.10). They follow the id grammar and are unique in the
   drawing (files).

## 2.13 The HyperSVG (D45)

An **asset** is a small experience: one drawing and its JSON, with its knobs as declared inputs (5.3). It is the same
format as any experience, checked by the same checker. It ships as one file, a **HyperSVG** `<id>.svg`:

- The file is the start scene's drawing, byte for byte, with one line added right after the root `<svg>` start tag:
  the tool record (6.6) with the key `asset`.
- The record holds `format` (`hsvg/2.0`), `id`, `drawing` (the folder path of the drawing the file is), `members`
  (every file of the asset with the SHA-256 of its exact bytes, the drawing too, as a package's members, 10.8) and
  `files` (every member but the drawing, as text). Other layouts' drawings (a tall frame) are files too.
- The record is JSON written with `<`, `>` and `&` as `\u` escapes, so it holds no markup. It is data, never script.
- The file is a valid SVG and a valid 2.0 drawing. An `<img>`, a design tool or a browser tab shows the rest pose.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" data-hsvg-version="2.0" data-hsvg-kind="screen">
<metadata>{"asset":{"format":"hsvg/2.0","id":"car","drawing":"scenes/drive/car.svg","members":{...},"files":{...}}}</metadata>
  <title>Roadster</title>
  ...
</svg>
```

An asset holds only text: its documents and drawings. It uses no kit and no add-on or capability (its `needs` is
empty), and no picture, sound, font or video file. Its drawing carries no tool record of its own. The HyperSVG is at
most `dataBytesEach` bytes. Anything else is `E-ASSET` (files).

**Author in separate files, ship as one file.** The artist keeps the drawing and the JSON stays clean.
`pack --asset` joins them; `unpack` splits them again (10.14). Pack, unpack and pack again give the same bytes. A
changed member no longer matches its digest: `E-PACKAGE-DIGEST` or `E-PACKAGE-MEMBER` (files, playing).
