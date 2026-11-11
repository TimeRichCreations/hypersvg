# 7. Representations and layouts

One definition makes many outputs: an ad in twelve sizes and three languages, Robin on a wide screen and a phone, a
lesson in a light and a dark theme. Each output is a **representation** of the same block: it is defined by what
changes (an axis: the layout, the theme, the words) and who picks it (a selector: the screen size, the host, the
person). This section defines that one mechanism (axes and selectors), then sizes and shapes, frames, layouts, layout
plans, fitting, themes, languages and content tiers.

Each alternative has its own word: a **size** or **shape**, a **layout**, a content **tier**, a **language**, a
**variant** (a drawn alternative of one part, on the axis named `look`) or a **theme**.

## 7.1 Axes and selectors

An **axis** is one independent way an output may differ. A **selector** says who or what picks the option on an
axis.

| Axis | Its options are | Declared in | Default selector |
|---|---|---|---|
| `shape` | sizes and shapes (7.2) | `axes` (this section) | `space` |
| `layout` | a block's layouts (7.4) | the block's `layouts` | `space` |
| `content` | tiers (7.9) | content fields (section 5) and `axes` | `space`; only `space` or `input` may pick a tier: `host` and `person` are refused on this axis (`E-RANGE`) |
| `language` | languages (7.8) | word files (section 2) and `axes` | `host`, then the default language |
| `look` | a part's drawn variants | the drawing (section 6) | `input`: a value, through a binding (6.8) |
| `theme` | the kit's themes (7.7) | the kit's `themes` | `person`: the `theme` key of the experience, else the kit's |

| Selector | Who picks | When | Example |
|---|---|---|---|
| `space` | the player or a tool, from the space available | at play; at export for a fixed size | a 728×90 ad placement picks the strip shape and the one-row layout |
| `input` | a value whose type is a choice of the axis's options (an input, knob or setting) | at play | the player picks German in Settings |
| `host` | the host profile or the host page, through the mount option `options` (10.6) | at mount | the page's language; an ad network's colourway |
| `person` | an editor | at make or export time; written into the output | the brand owner exports the night colourway |

An axis needs an `axes` entry only to declare its options or to use a selector other than its default. A kit for an
ad family:

```json
"axes": [
  { "axis": "shape", "select": "space",
    "sizes": { "300x250": "must", "336x280": "must", "728x90": "must",
               "160x600": "must", "320x50": "should" } },
  { "axis": "content", "select": "space",
    "tiers": [ { "tier": "short", "shape": { "maxHeight": 120 } },
               { "tier": "medium", "shape": { "maxPixels": 90000 } },
               { "tier": "rich" } ] },
  { "axis": "language", "select": "host", "default": "en",
    "options": { "en": {}, "de": {}, "ar": { "direction": "rtl" } } },
  { "axis": "theme", "select": "person", "options": ["harbour-day", "harbour-night"] }
]
```

Robin's experience:

```json
"axes": [
  { "axis": "shape", "select": "space", "shapes": { "wide": { "minAspect": 1 }, "tall": { "maxAspect": 1 } } }
]
```

- An entry's `id` defaults to its axis word. Two entries on one axis need distinct ids.
- `subject` limits an entry to one subject (a field, a part). `default` names the option used when the selector gives none.
  In 2.0, language and theme picks apply to the whole experience; picks per subject wait.
- An `input` selector names, in `value`, the input, knob, setting or plain value (of the declaring block or the
  experience) whose choices are exactly the axis's options
  (`E-AXIS-INPUT`); `value` is required with `input` (`E-KEY-REQUIRED`) and refused with any other selector (`E-TYPE`).
  The value's pick applies from boot: a language or tier picked by input is in force at the first paint, not only
  after the value changes.
- `sizes` and `shapes` go with the `shape` axis, `tiers` with `content`, and an options map with `language`; other
  option names are ids.
- Axes may be declared on a kit, experience, scene or component. An inner entry with the same id narrows the
  outer one for its subject: it may list fewer options, never new ones. An inner `shape` entry narrows its kit's sizes
  for layout choice as well as for true size (7.3): a layout made for a size the inner entry drops is not chosen.

**Order of choosing.** Selectors resolve in this order: `person`, `host`, `input`, then `space` last. Across
axes, choices are made in this order; on one axis, an entry's own selector decides, and only a `person` or `host`
choice may override it. Space choices are measured with the language and theme already chosen.
Inside `space`: first the shape; then, for each block from the outside in, the tier is chosen once from the block's
space and its layouts are tried in the order of 7.4: for each layout in list order, try it unreduced, each
field being fitted (7.6), and the first whose content fits wins; if none fits, the give-way steps (7.6) are applied to the
first layout that applies only. A layout that fits only after give-way steps does not count as fitting while a later
layout that applies fits unreduced.

**The `layout` ambient value.** The player keeps a read-only ambient value `layout` (5.5): for each block on screen,
by its address, its `frame` (the layout or frame id chosen), its `tier` and its `steps` (the give-way steps taken, if any). It is the same read-out as the host's `ladder()` (10.6). Content reads it like any ambient value, so
a studio made of content can show the chosen frames and steps beside its stage. It never feeds back into choosing.

**Each option changes only its axis.** Choosing on one axis never resets another. A theme never changes words or
layout. A content tier never changes colours. A language changes words, direction, fonts and
per-language limits only. A layout never changes content. A switch at play (a resize, a new language) keeps
every other choice that still fits.

**Shared invariants.** Every option on an axis keeps what the other options have:

| Axis | Every option keeps | Proof |
|---|---|---|
| `shape`, `layout` | The same content fields and field names; the same ids for parts with jobs and for every place the JSON names; the same colour roles; every variant drawn; every rule holding. A scaled copy is not a layout. | files |
| `content` | The same fields and types; only optional fields may be empty; the same meaning. | files, review |
| `language` | The same word ids or fewer (a missing translation falls back to the default word and warns, 2.7); every field within its limits for that language. | files |
| `look` | The same part id and pivot; every variant drawn whole, including what other parts cover; one rest variant. | files, review |
| `theme` | Every colour role and text style of the kit; the contrast rules. | files |

A missing name in one option is an error that names the file (`E-LAYOUT-MISSING`, `E-THEME-ROLES`).

**Combinations.** The checker fits every `must` size in every language, with the pressure cases of A8.4, and again
in every theme that changes fonts or spacing (sizes times languages times those themes, not times every other axis),
and checks the colour rules in every theme. A `should` size runs only the `drawn` and `longest` cases, and may end
incomplete with a reason. The kit's evidence names the
envelope that was tested (section A8.1). A size outside the envelope may be asked for and fits or ends incomplete; an option
outside the declared options of any other axis is refused, never guessed.

## 7.2 Sizes and shapes

A **size** is an exact width and height in CSS pixels, written `"300x250"`. The string is its id.

A **shape** is a named **range**: a set of conditions on the space. Every key present must hold. Minimums are
inclusive, maximums exclusive.

| Key | Condition |
|---|---|
| `minAspect`, `maxAspect` | width / height |
| `minWidth`, `maxWidth`, `minHeight`, `maxHeight` | CSS pixels |
| `minPixels`, `maxPixels` | width × height |
| `direction` | `ltr` or `rtl`, the chosen language's direction (7.8) |

The format names eight **standard shapes**. Every size belongs to exactly one of them.

| Shape | Aspect (width / height) | Example size |
|---|---|---|
| `skyscraper` | under 0.45 | 160x600 |
| `tall` | 0.45 to under 0.7 | 300x600 |
| `portrait` | 0.7 to under 0.9 | 1080x1350 |
| `square` | 0.9 to under 1.3 | 300x250 |
| `landscape` | 1.3 to under 2.5 | 1200x630 |
| `banner` | 2.12 to under 5 | 970x250 |
| `strip` | 5 to under 10 | 728x90 |
| `superwide` | 10 and over | 970x90 |

A kit or experience may name its own shapes in its shape axis's `shapes` map (7.1; Robin's `wide` and `tall`). A kit's map replaces the standard
shapes for its blocks, so its `tall` is not the standard `tall`. Inside one map, shapes must not overlap (`E-RANGE`).
An aspect no shape covers is unsupported: an output there is incomplete, with a reason. The active shape and the player box
are the ambient input `size` (5.5); they are presentation only and never decide behaviour (5.8).

**Envelope.** The smallest `must` size is the smallest supported size of the experience (5.11, A11.10); one shape
alone is allowed. The `sizes` map gives each listed size a class, using the rule strengths: `must` (fits with all required content; an incomplete output
blocks publishing) or `should` (fitted and recorded; an incomplete output is allowed with a reason). Sizes not listed may
be asked for; they fit or end incomplete. For a shape-only axis (no `sizes` map), the `must` sizes are each frame at its own viewBox
size and the edges of its `shape` range.

## 7.3 Frames

A **frame** is one drawing of a block at one size or one shape. What a frame is, and the rules for its file (exact
size, the protected area, bleed, the same names in every frame, derived frames), are in 6.6. A block names its frames
through its layouts (7.4). This section says how the player places, chooses and switches frames.

- **At play** the player fits the viewBox inside the container, centred, keeping its proportions, and lets the bleed
  fill the rest. It never stretches characters or crops controls. For a scene mounted in a shell, the container is the
  stage slot's box (10.1).
- **True size.** An experience whose `shape` axis lists only exact sizes (an ad), shown as the whole page on its own,
  is drawn at its true size (one drawing unit per CSS pixel at design scale 1), centred, at the size nearest the
  window; it is never scaled up to fill the window. A host that places it in a slot gives it that slot's size.
  "Shown as the whole page" means a booted page that is not in a frame; in a frame or a host's slot it fills its slot.
  The size nearest the window is the declared size nearest by aspect (as below), scaled down only in a smaller window.
  True size applies to the stage: with a shell (10.1), the stage slot holds the scene at its true size and the shell
  keeps its own size around it; the shell is never shrunk to the scene's size.
- **Choosing** follows 7.4. When no layout applies to the space (no exact size, no `shape` that contains it),
  the player uses the nearest by aspect (the smallest absolute difference of the natural log of width ÷ height),
  scaled uniformly and centred. A layout's aspect is its drawing's viewBox aspect (the block's for a plan-only
  layout); ties go to list order. The readable floor still applies; if scaling breaks it, the output is incomplete.
- **Design scale.** The output size divided by the frame's viewBox size (uniform, the smaller of the two ratios).
  Intrinsic sizes and `fixed` resizing multiply by it.
- **Switching** at play (a resize, a rotated phone) changes placement only. Values, machine states, focus, the visit
  stack and clip time are kept. The current frame is kept while it still applies, so a resize does not flicker.
  Reduced motion never changes which frame is chosen.

## 7.4 Layouts

A **layout** is one named placement of the same parts, for one shape or size. It is drawn (or computed by a layout
plan of the `fit` add-on). Any block that changes with shape may have layouts: a component, a scene, a shell. A scene's layouts are its frames.

Robin's harbour stop:

```json
"layouts": [
  { "id": "wide", "shape": "wide", "drawing": "stop-harbour.svg" },
  { "id": "tall", "shape": "tall", "drawing": "stop-harbour.phone.svg" }
]
```

An ad scene:

```json
"layouts": [
  { "id": "rectangle",   "size": "300x250", "drawing": "summer-300x250.svg" },
  { "id": "skyscraper",  "size": "160x600", "drawing": "summer-160x600.svg" },
  { "id": "leaderboard", "size": "728x90",  "drawing": "summer-728x90.svg" },
  { "id": "phone-strip", "size": "320x50",  "drawing": "summer-320x50.svg" }
]
```

An offer component with two drawn layouts:

```json
"layouts": [
  { "id": "row",     "shape": { "minAspect": 1.3 }, "drawing": "offer-row.svg" },
  { "id": "stacked", "shape": { "maxAspect": 1.3 }, "drawing": "offer-stacked.svg" }
]
```

| Key | Meaning |
|---|---|
| `id` | Kebab-case, unique in the block. Names say the layout: `row`, `stacked`, `grid`, `wide`, `tall`. |
| `size` or `shape` | Exactly one: an exact size, or a shape name or an inline range. Both is `E-KEY-CONFLICT`, neither `E-KEY-REQUIRED`, and an unknown shape name `E-REF-UNKNOWN`. |
| `drawing` | The drawing for this layout: a frame for scenes and shells, a drawing file for components. |
| `fit` | Binding id to fit keys (7.6) that replace that binding's `fit` in this layout. |
| `label` | Optional words for people. Never read by behaviour. |

A layout has a `drawing`, or a layout plan of the `fit` add-on, or both. Without `drawing` it uses the block's own
drawing.

- **Plan-only layouts.** A layout without its own drawing lays out the block's drawing at the space's
  aspect: the viewBox grows about its centre to that aspect (its height kept when the space is wider, its width when
  it is taller), and a root place drawn edge to edge grows with it. The design scale (7.3) is the space's size over
  that viewBox. A player without the `fit` add-on shows the baked frames.
- **Overlaps.** Layout `shape` ranges may overlap; list order decides (below).

- **Drawn layouts are authoritative for fixed art.** A scene, a character, a finished ad design: their
  layouts are drawn, and no solver changes them.
- **When one applies.** A use's `layout` map (4.3) decides first, where it names this one. Otherwise its
  `size` equals, or its `shape` contains, the block's space: the output size for a scene,
  the slot it is placed in for a component (the slot's box in the parent's chosen frame, at the output's design
  scale). And its content fits (7.6).
- **Which one.** The exact size first; then the current layout while it still applies and fits; then the first
  in list order that applies and fits. A tool that makes outputs may choose among those that fit by score
  (section A8.2) and records its choice in the receipt. If some apply but none fits, the output is incomplete; if none
  applies, the nearest-aspect rule of 7.3 is used.
- **Derived layouts.** A tool's derived frame (6.6) is listed in `layouts` like a drawn one, with its
  `size` or `shape` and its `drawing`; the drawing's tool record (`<metadata>`, 6.6) says `derived`.

**Placing a component in a slot.** A component placed in a slot of another size is scaled as a whole, keeping its aspect, and centred. Other ways to fill a slot (`resize`: `hug`, `nine-slice`, `stretch-x` and the rest) and layout plans are the `fit` add-on, whose page comes with the add-ons release.

## 7.6 Fitting

A text that may change carries a **fit** on its `text` binding (6.8); a layout may replace it (7.4). `box` names the
drawn box the text stays inside (D33; the old key `region` is `E-WORD-RENAMED`):

```json
{"id": "headline-text", "target": "headline", "text": "{{ message.headline }}", "fit": {"box": "headline-box", "fontPx": 28, "minFontPx": 20, "maxLines": 2}}
```

| Key | Meaning |
|---|---|
| `box` | Required. A box drawn as a rectangle with no transform, with the same id in every frame. It may be painted (D38). Fit boxes may overlap. |
| `fontPx` | The largest font size, in drawing coordinates, 1..1000. Optional: by default the drawn text's size in each frame. |
| `minFontPx` | The smallest font size, in drawing coordinates, 1..1000. Required. |
| `maxLines` | 1 to 32; default 1. The box's height also bounds the lines, so one binding serves frames of different sizes. |
| `wrap` | `words` (default) or `none` (keep the drawn line breaks). |
| `lineHeight` | Line distance as a multiple of the font size, 0.5..4; default 1.2. |
| `steps` | The default order of give-way steps for this field (A11.5). Default `["short", "wrap", "shrink"]`. A `fits` rule's `steps` (A11.5) on the field replaces it. For each layout in list order (7.4), try it unreduced; if none fits, apply the steps to the first layout that applies only (7.1). Rule 2 below, the font search, runs inside the `shrink` step. The player follows the order: with `["shrink", "wrap"]` it searches sizes on unwrapped lines first, and only if none fits does it wrap, at the smallest size the search reached. A step not in the list of A11.5 is `E-RULE`. |

The drawn text's anchor gives the alignment. Fitting follows these rules:

1. **Whole words.** Lines break only at Unicode line-break opportunities (UAX #14, Unicode 16.0, bundled with the
   engine and checker, never taken from the host's `Intl`), with its default tailoring (equal to CSS `line-break: normal`). This covers
   scripts written without spaces, except class SA. There is no break inside a run of class SA (Thai, Lao, Khmer,
   Myanmar); authors mark breaks there with U+200B. "Whole words"
   means no break inside a UAX #14 segment. Every word is kept; no hyphen is added. A line feed in the value is a
   forced break and counts toward `maxLines`.
2. **Font search.** From `fontPx` down to `minFontPx` in whole drawing units; when that is more than 32 sizes, 32
   evenly spaced ones including both ends, each rounded down to a whole unit, never below `minFontPx`. Each candidate
   is measured as whole lines in the actual font. The first size at which every line fits the box within `maxLines`
   wins. A fit must leave 2% of the box's width free on every line, so a browser that measures slightly wider
   still fits. The 2% applies in rule 2, in rule 4 and at `minFontPx`.
3. **Readable floor.** The `readable` rule (section 8) applies at the final output size. The stricter of `minFontPx`
   (scaled to the output) and the floor wins. There is no hidden tiny-text fallback.
4. **Unbreakable words** (a long web address, a code) that do not fit leave the output incomplete. Text is never clipped silently.
   `ellipsis` is used only where the field's steps list it; the full text stays the accessible name.
5. **Intrinsic sizes.** Icons, button height and padding, corner radii and stroke widths keep their drawn size times
   the design scale. They never stretch with their container.
6. **Spacing first.** Theme spacing tightens within its ranges before any give-way step.
7. **Protected areas.** A keep-inside protected area (a face, a logo, a product) stays wholly visible in every layout and
   crop. A keep-clear protected area has nothing else painted over it. A `cover` crop follows its `focal` point and never
   cuts into a protected area. A protected picture keeps its crop.
8. **Exact replay.** At a drawn frame's own size, with the drawn content and no edits, the output is that frame
   unchanged. New content at that size is fitted, never replaced by the drawn words. Returning to the drawn content
   restores exact replay.
9. **Measured, not guessed.** Fits are measured by the reference text measurer, headless Chromium at a pinned version
   named in a receipt's `authority.measurer` (A8.1), with the named fonts. A host font is pinned by its font file (the
   host profile's `fonts`, A10.1); there is no metrics-file format. Text whose only fonts are generic families, or host
   fonts the profile does not pin, has no pinned measurer: its fit proofs are `not-run`, and so are all fit proofs in a
   checker without the measurer. Tools write measured values into
   evidence: the most characters that fit (`maxChars`), the smallest display width (`minWidth`, which is
   `ceil(floor × viewBox width / smallest font size)`) and the tiers that fit. Nobody writes them by hand.

## 7.7 Theme

A **theme** is a named bundle that makes many blocks look alike: colours, type, spacing, shapes, motion and icons. A
kit holds its themes in its `themes` map (A14.1); an experience made without a kit may hold its own the same way. The kit's `theme` key names the one used when nothing selects
another; an experience's `theme` overrides it. From a kit document:

```json
"theme": "harbour-day",
"themes": {
  "harbour-day": {
    "colorRoles": { "surface": "#fff4d8", "ink": "#153b4b", "accent": "#e6af42", "accent-2": "#168e91",
                    "muted": "#4f6b73", "success": "#2e7d4f", "warning": "#8a5a00", "danger": "#b3261e",
                    "bike-amber": "#e6af42", "bike-teal": "#168e91", "bike-coral": "#ee795f" },
    "typeRoles": { "heading": { "font": "bitter-700", "fallback": "Georgia, serif" },
                   "body": { "font": "inter-400", "fallback": "Arial, sans-serif" } },
    "spacing": { "gap": { "minimum": 8, "initial": 16, "maximum": 24 },
                 "padding": { "minimum": 12, "initial": 20, "maximum": 28 } },
    "outline": { "control": "pill", "radius": { "minimum": 4, "initial": 12, "maximum": 20 },
                 "border": { "width": 2, "style": "solid" } },
    "motion": { "durationMs": 240, "easing": "ease-out" },
    "icons": "harbour-line",
    "about": { "family": "harbour", "tone": ["warm", "playful"], "ground": "light" }
  },
  "harbour-night": {
    "extends": "harbour-day",
    "colorRoles": { "surface": "#10212b", "ink": "#fff4d8", "muted": "#bfe4de", "success": "#6fcf97",
                    "warning": "#f2c94c", "danger": "#ff8a80" },
    "about": { "family": "harbour", "tone": ["warm"], "ground": "dark" }
  }
}
```

| Key | Holds |
|---|---|
| `colorRoles` | Optional: a theme may hold only fonts and icons. Every colour role: the eight core roles (`surface`, `ink`, `accent`, `accent-2`, `muted`, `success`, `warning`, `danger`) and the kit's own roles (`bike`). Six-digit hex. |
| `typeRoles` | Text styles (`heading`, `body`, `caption` and the kit's own, D37): a font resource (section 2, required), optional `byLanguage` fonts (`{"ar": "noto-naskh-400"}`) and a fallback stack. Each font names a font resource the package carries, in the theme's scope (the experience's, or the kit's for a kit's themes); any other name is `E-REF-UNKNOWN` (files). |
| `spacing` | Named spacing values in drawing coordinates; the names are ids. |
| `outline` | Control outline (`control`: `rounded`, `square` or `pill`), corner radius, border width and style (`style`: `solid`, `dashed` or `dotted`). |
| `motion` | `durationMs` and `easing` (a named CSS easing of 6.7: `linear`, `ease`, `ease-in`, `ease-out` or `ease-in-out`; or `cubic-bezier(x1, y1, x2, y2)`; nothing else) for engine controls and transitions. |
| `icons` | An icon-set resource; icons are chosen by id (6.2.2). |
| `extends` | One other theme of the same kit, which extends nothing itself. Each leaf given here (one colour role, one spacing value) replaces the same leaf; the rest is kept. |
| `about` | Descriptive only: `family`, `tone` (a list of words), `ground` (`light`, `dark`, `any`). Never decides anything. |

- **Values are knobs** (5.3.2). A literal is fixed. An object with `minimum`, `initial` and `maximum` lets an editor
  move the value inside its range; `initial` with `enum` limits it to a list. Theme knobs are for editors; a player
  never changes a theme value.
- **Readers' text size.** In 2.0, text follows the drawing's scale only: a text is as large as its drawing is at the
  output size, and a reader cannot enlarge it or change letter and word spacing apart from the drawing (the browser's
  page zoom scales everything). A reader text scale is planned for a later version, as a built-in value; an author's
  own value of the same name will hide it (5.9), so adding it breaks no 2.0 file.
- **Selecting.** `"theme": "harbour-day"` on the experience, or a `theme` axis. A **colourway** is a theme
  that changes only colours, usually with `extends`.
- **Drawings keep their paints.** A drawing names roles with `data-hsvg-color` (section 6). Without a theme,
  drawn paints win and the engine leaves them alone. With a theme, each named paint takes its role's colour. The
  player may render roles as CSS variables (`--hsvg-<role>`) with the drawn paint as fallback; that is a render form,
  never authored. Texts name text styles with `data-hsvg-text-style` the same way (6.2.3).
- **A theme changes how things look, nothing else.** It never changes behaviour, values, grants, words, or which
  layout and content are chosen. Its spacing and outline values change measurements inside a layout.
- **Rules in every theme.** Every theme of a kit has every colour role and text style the kit uses
  (`E-THEME-ROLES`). The baseline contrast rules hold in each one: ink and muted on surface 4.5:1, success, warning
  and danger on surface 4.5:1, the focus colour (`accent-2`) 3:1, and every kit role named `on-<role>` on `<role>`
  4.5:1 (a label on the accent colour). The baseline pack states the core pairs with `color:` subjects (A11.3); the
  checker adds the `on-<role>` pairs from each kit's own roles. No theme reduces a control below the hit-target
  minimum. Fonts are resources with licences, and their bytes count in budgets (section A10.3).
- A colour that follows a value at play (the bike colour the player picks) is a `color` binding (6.8) that chooses
  among theme roles by that value (`bike-amber`, `bike-teal`, `bike-coral`), not a new theme and not a change to a
  theme value. Fitting at play may tighten spacing for one output; that never changes the theme.
- A theme is not a **variant** (a drawn alternative of a part) and not a style pack (a drawing technique, kept in
  plugins).

## 7.8 Languages

Language is an axis. Its options are lowercase language tags (BCP 47): `en`, `de`, `ar`, `en-in`.

```json
{ "axis": "language", "select": "host", "default": "en",
  "options": { "en": {}, "de": {}, "ar": { "direction": "rtl" } } }
```

| Option key | Meaning | Default |
|---|---|---|
| `direction` | `ltr` or `rtl` | `ltr` |

The language axis's `default` is the block's default language (`language`, 2.7) unless it names another.
Number marks are words (`decimalMark`, `groupMark`, 2.7).

- **Words.** All visible prose comes from word files, one per language (section 2), or from a text field's language
  object (5.3.1). The default language has every
  word. A missing translation shows the default word and reports `W-WORDS-MISSING`.
- **Per-language limits.** A length limit may differ by language:
  `{ "id": "cta-length-de", "kind": "limit", "subject": "field:action.text", "maxLength": { "default": 18, "de": 24 } }`.
- **Every language at every shape.** The checker fits every `must` size in every language, with the pressure
  cases of 7.6.
- **Fonts cover the script.** Every character of every word in a language must be in that text style's font
  resources for that language (its `byLanguage` font, else its font), or, for a text with no text style, in a font
  resource its `font-family` stack names. A font resource may be a subset; coverage is checked against its glyphs.
  Generic families and host fonts cannot be checked from files: their coverage proof is `not-run` unless the host
  profile's `fonts` pins a font file. (review: the 2.0 checker does not read fonts)
- **Direction.** `direction: "rtl"` sets text direction; `start` alignment means the right edge, so a drawn
  `text-anchor` of `start` or `end` swaps sides in right-to-left text, and `middle` stays. Fitting measures the advance
  width of the shaped line, or its ink bounds where they reach beyond it (Arabic swashes). The engine sets the
  direction of every bound text from the active language; unbound drawn text keeps the drawing's. A layout may
  declare `"shape": { "direction": "rtl" }` to mirror its layout; without one, the drawn layout is kept. Drawings,
  routes and motion are never mirrored automatically.
- **Words never decide.** No condition, link or choice depends on displayed words (section 5), so switching language
  never changes behaviour. A switch at play keeps values, machine states, focus, and the layout if it still
  fits.
- **Plural forms** live in the words files (2.7) and are chosen by a count with `plural(count, 'word-id')`
  (5.6.4).
- **Spoken lines.** A line's text comes from words, so it follows the language; its recording is chosen from
  `voices` by the active language (the `lines` add-on), and without one the line runs silently on its timing.

## 7.9 Content tiers and options

A **tier** is a depth of content: `short`, `medium` or `rich`. A content field (5.3.1) may declare `tier`, the
smallest tier in which it appears; the default is `short`. A `short` field appears at every tier; a `rich` field only
when rich is chosen. Required fields are `short`.

A field's value may give one wording per tier:

```json
"message.headline": {
  "rich": "Fresh sourdough, baked at dawn and delivered warm",
  "medium": "Fresh sourdough, delivered warm",
  "short": "Fresh sourdough"
}
```

- **Choosing a tier.** One selector per content axis: `space` (the axis's `tiers` list: the first entry
  whose `shape` contains the space; an entry without `shape` is the last resort), or `input` (a value whose choices are
  the tiers). Or no selector: the axis's `default` fixes the tier. The thresholds are the kit's; the format sets none.
  With `input`, the axis's `default` is the tier until one is chosen
  (`{"axis": "content", "select": "input", "value": "depth", "default": "medium"}`); without it, `rich`. The
  `host` and `person` selectors are not used on the content axis.
- **Whose space.** The tier is chosen from the space of the block that declares the content entry (the experience's
  entry uses the scene's space). A block without an entry of its own takes its parent's tier. With no content axis,
  the tier is `rich`.
- **Reading a field.** Formulas, `visible` bindings and templates that mix a field with other words read the chosen
  tier's wording, and an empty value for a field left out at that tier.
- **With a tier chosen,** each field uses its wording for that tier. Where none is given, it uses the nearest longer
  wording given, else the nearest shorter one. Then the field's give-way steps apply: by default `short` takes the next shorter authored wording
  before anything shrinks.
- **Never invented.** The engine never summarises, never cuts words and never writes new wording. Only wordings the
  author supplied may stand in for a field.
- A field left out at the chosen tier reads as empty: an empty string, `false`, an empty list. A `visible` binding
  on a left-out flag hides its part.
- A drawing's sample text is the wording of the tier chosen at that frame's own size, or the `default` tier for
  other selectors.
- Tiered wordings are written where content is written: a field's `initial` (a component's too), or a use's `with` (a
  kit experience's content, A14.2). A tier or language object is accepted wherever a content field's value is: `initial`,
  `with` and the host's `set` (10.6). Each wording is checked as the field's value would be.
- **A one-name formula keeps the declaration.** A use's `with` whose value is a formula of one name (`"=cta"`) passes
  the named input through: the field keeps that input's declaration (its tier object, `tier`, `required` and
  `optional`), so the checker sees it and its `field:<name>` subject resolves.
- A formula sees the tier of the drawing's last paint.
- An empty wording on an optional field means "leave it out at this tier". A required field never has an empty
  wording (`E-CONTENT-REQUIRED`). An empty `initial` of a required field (`""`, or runs with no words) is
  `E-CONTENT-REQUIRED` too. The upgrade from 0.1 writes such a field as `required: false`.

Content options (named alternative wordings for a field, for an A/B test) and the `seed` selector are a 2.1
draft (`drafts/content-options-2.1.md`). In 2.0 an A/B test is two kit experiences with different content.
