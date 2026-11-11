# 6. The drawing

A **drawing** is an SVG file. It owns shapes and places: what things look like, where they are, which named parts
they are made of and what each part may do (decision 4). JSON documents (section 2) own meaning, content and
behaviour, and refer to a drawing's parts by id. This section defines the marks a drawing may carry, the jobs of its
parts, variants, roles, paint and layers, accessibility and frames, and how a drawing moves and sounds: clips,
bindings, attachments and audio. Which SVG a drawing may use is in 2.11.

Every rule ends with the check that proves it: **files** (the checker, from the files alone), **playing** (the
engine or a play test) or **review** (a person), as in section 5.

## 6.1 Marks

This is the complete list of `data-hsvg-*` attributes a 2.0 drawing may carry: the **15 marks** of D33. Where a mark
lists values, the first listed is the default. **The SVG side is closed (D28, D34):** every mark is core, whatever
the experience's `needs`; an add-on never adds a mark or a mark value (its settings live in `addons.<name>`). Route places and video boxes are
core marks too; a marked place that nothing names is ignored by the engine, and the checker warns (`W-PLACE-UNUSED`,
5.10). Any other `data-hsvg-*` attribute is an error. Today's earlier marks and the common wrong guesses
(`data-hsvg-look`, `data-hsvg-paint`, `data-hsvg-region`, `data-hsvg-name`, `data-hsvg-part`, …) are `E-WORD-RENAMED`,
with the final form in the message; the tool record of a derived frame is in `<metadata>` (6.6). Marks of earlier formats are converted by the upgrade tool
(A13.9); the variant marks it lists (such as `data-hsvg-state-name`) are still read as aliases, each reported (`W-MARK-ALIAS`). `E-MARK-UNKNOWN`,
`E-MARK-VALUE` (files).

| Attribute | On | Value | Section |
|---|---|---|---|
| `data-hsvg-version` | root `<svg>` | `2.0` | 2.10 |
| `data-hsvg-kind` | see 4.1 | `part`, `component`, `screen` | 4.1 |
| `data-hsvg-role` | part, component | a role word, then a side (`hand left`); or protected-area words on an unpainted `<rect>` (`keep-inside`, `keep-clear`, `keep-empty`, `keep-inside keep-clear`); `decoration` is ornament (D35) | 6.3, 5.10 |
| `data-hsvg-label` | part | plain text, the part's name for people | 6.5 |
| `data-hsvg-pivot` | part, component root | `x y` | 6.2.1 |
| `data-hsvg-motion` | part | channel ranges, `rotate -6..6; scale 1..1.2` | 6.2.1 |
| `data-hsvg-follow` | part | the local id of its leader part | 6.2.1 |
| `data-hsvg-color` | `<g>`, a shape, `<text>`, `<tspan>`, `<use>` | role syntax | 6.2.3 |
| `data-hsvg-text-style` | `<g>`, `<text>`, `<tspan>` | a theme text style: `heading`, `body`, `caption` or a kit's own (D37) | 6.2.3 |
| `data-hsvg-slot` | part (empty `<g>` or `<rect>`) | the slot's name | 5.10 |
| `data-hsvg-fit` | part (`<rect>`, painted or not, D38) | no value or `text` (a text's box), `items` (a layout plan's box), `video` | 5.10 |
| `data-hsvg-repeat` | part (`<g>`) | any value, or none: its child slots hold one item each | 5.10 |
| `data-hsvg-route` | part (`<path>`, `<line>`, `<polyline>`) | `track` or `surface` | 5.10 |
| `data-hsvg-variant` | each variant: a direct child `<g>` of a part with variants | the variant's name | 6.2.4 |
| `data-hsvg-layer` | any `<g>`, part or component | `content`, `backdrop`, `overlay`, `decoration` | 6.4 |

- `data-hsvg-hook` marks a host page, never a drawing (section 10). `E-MARK-UNKNOWN` (files).
- Tools may keep their own data in `data-<tool>-*` attributes (never `data-hsvg-`). Players never read them, and they
  never change what a `data-hsvg-*` attribute says (files).
- Catalogue facts (category, tags, title for a gallery) live in `about` (section 2), not in the drawing.

**Tiers.** What a drawing must say, for the conformance levels of A10.7 (import-ready needs the required
column; library-ready needs the recommended column too). Tools fill in what can be worked out before checking: a
label from the id, a missing `kind="part"`, a namespace on import.

| Where | Required | Recommended | Optional |
|---|---|---|---|
| root `<svg>` | `viewBox`, `data-hsvg-version` | `<title>` | `<desc>`, `<metadata>` (the tool record, 6.6) |
| component root | `data-hsvg-kind`, an `id` that is the namespace | `data-hsvg-role` | `data-hsvg-pivot`, `data-hsvg-layer` |
| part | `data-hsvg-kind="part"`, an `id` | `data-hsvg-role`; `data-hsvg-label`; a pivot if it turns or scales | motion, follow, color, layer |
| screen drawing root | `data-hsvg-kind="screen"` | layers (6.4) | `width` and `height` for an exact size |
| place | its place mark | `data-hsvg-role` on slots | |
| variants | `data-hsvg-variant` on every variant | | |

## 6.2 Parts and their jobs

A part's jobs come from what is attached to it (1.6). One part may have several jobs. A part never stands alone: it
lives in a component or a screen drawing.

### 6.2.1 Moves

**Pivot.** `data-hsvg-pivot="x y"` is the point a part turns, scales and leans around, at rest, in the coordinate
system the part's children are drawn in. On a component root it is the placement point: where it stands
or sits (a character's feet, a badge's centre); the default is the centre of the viewBox.

**Motion range.** `data-hsvg-motion` lists the channels a part may move in and the safe range of each (D31.3). The
channels are named as the JSON words (D33): `move-x`, `move-y`, `rotate`, `lean`, `scale`, `scale-x`, `scale-y`,
`opacity`, `draw`, `line` and `wipe`.
Entries are separated by `;`. Each is a channel and a range written with two dots, `min..max`:
`data-hsvg-motion="scale 1..1.2; rotate -6..6; move-y -60..0"`. Each channel appears at most once; `scale` is not
combined with `scale-x` or `scale-y`. Ranges for `rotate`, `move-x`, `move-y` and `lean` are offsets from rest, so
they contain 0; ranges for `scale` contain 1. `opacity`, `draw`, `wipe` and `line` are absolute values; `opacity`,
`wipe` and `line` contain the drawn value.

| Entry | Measure | Example |
|---|---|---|
| `rotate min..max`, `rotate *` | degrees; `*` turns without limit (wheels) | `rotate -6..6` |
| `scale min..max`, `scale-x min..max`, `scale-y min..max` | factor; `scale` covers both axes | `scale 0.99..1.01` |
| `move-x min..max`, `move-y min..max` | drawing coordinates; a part that moves both ways lists both (`move-x -1.5..1.5; move-y -1.5..1.5`, a pupil) | `move-y 0..28` (an eyelid) |
| `lean min..max` | degrees along x (SVG `skewX`), −85 to 85 | `lean -10..10` |
| `opacity min..max` | 0 ≤ min ≤ max ≤ 1 | `opacity 0.2..1` |
| `draw min..max` | 0 ≤ min ≤ max ≤ 1, the drawn share of the length; the element is a stroked shape and carries `pathLength="1"` | `draw 0..1` |
| `wipe min..max` | 0 ≤ min ≤ max ≤ 1, the share of the part shown | `wipe 0..1` |
| `line min..max` | the line thickness (`stroke-width`), drawing coordinates, 0 to 1000 | `line 1..24` |

The earlier spelling, `rotate(-6 6) translate-y(0 4)`, read like an SVG transform and meant something else. It is
refused with a message that shows the new form: `data-hsvg-motion "rotate(-90 90)" is the old spelling; write
"rotate -90..90"`. The upgrade tool converts every drawing (`scale(1 1.2)` to `scale 1..1.2`, `translate(60)` to
`move-x -60..60; move-y -60..60`, `rotate(*)` to `rotate *`). `E-MARK-VALUE` (files).

Today's earlier channel names are `E-WORD-RENAMED` with the final one: `translate-x` is `move-x`, `translate-y` is
`move-y`, `translate` is `move-x` and `move-y`, `skew` is `lean`, `dash` is `draw` and `stroke-width` is `line` (D33)
(files).

- `rotate`, `scale`, `scale-x`, `scale-y` and `lean` need a pivot. `E-PIVOT` (files).
- **The pivot sits on the part.** A part that turns or grows (a limited `rotate`, `lean` or `scale` range) with its
  pivot outside what it draws, by more than its box's longer side and more than 5% of the drawing's viewBox, warns: it would swing around a point
  away from it, as when the art moved and the pivot stayed. A pivot several parts share is a centre on purpose (a
  dial's ticks) and is not judged; `rotate *` spins freely. `W-PIVOT-OUTSIDE` (files).
- A range states what was tested, not a wish. Every clip key, binding, slider, drag and add-on input on the part is proven
  inside it (5.6.7). `E-MOTION-RANGE` (files).
- A part without `data-hsvg-motion` moves only with its parent. The `variant` channel needs no range: it chooses among
  drawn variants (6.2.4).
- The **honest motion label** is derived, never written: `rotate *` is *exact*, a range is *limited*, none is
  *static* (files).
- Components move as wholes (entrances, slides) without a range; their placement point is the root
  pivot.

**No transform on movers.** A part with `data-hsvg-motion`, or the target of any channel, carries no `transform`
attribute and no `transform` in `style`. Put static offsets on an inner `<g>`. A slot is the exception: it keeps its
placing `transform`, a clip may target it to move the mounted use, and its channels apply after that transform. `E-MOVER-TRANSFORM` (files).

**Nesting is movement.** A part's `<g>` holds the parts that move with it: the tail's base holds its middle, which
holds its tip. Document order is paint order (6.4).

**Follow.** When paint order puts a part outside the part it moves with, it stays where paint order needs it and
names that part: `data-hsvg-follow="branch-owl"`. It moves as if nested inside the leader: the motion of the
leader's ancestors applies first, then the leader's, then its own. The motion of its real parent in the file no
longer applies. It keeps its own ranges, paint position, variants and opacity.

- The leader is a part (or a screen-drawing component root, 4.1) of the same drawing, neither an ancestor nor a descendant, with no loop through leaders or
  real parents. `E-FOLLOWS` (files).
- A reader without follow support leaves the follower where it is; the picture is still right at rest.
- Follow is drawn; attach is an action (6.9); nesting is a use inside a block (11.3).

```svg
<g id="owl-on-branch__tail" data-hsvg-kind="part" data-hsvg-role="tail"
   data-hsvg-follow="owl" data-hsvg-pivot="660 1230" data-hsvg-motion="rotate -4..4">…</g>
<g id="owl-on-branch__branch" data-hsvg-kind="part" data-hsvg-role="prop">…</g>
<g id="owl-on-branch__owl" data-hsvg-kind="part" data-hsvg-role="body" data-hsvg-motion="move-y -20..0">…</g>
```

### 6.2.2 Holds content

A part holds content when a binding (6.8) writes a content field (5.3.1) into it. The drawing marks the
place; the JSON declares the field and binds it. One way: content never comes from a drawing mark alone.

| Content | Drawn as | Binding (6.8) |
|---|---|---|
| words, numbers | a `<text>` part holding one text node, or one `<tspan>` per drawn line and nothing else; or a `<tspan>` part holding one text node (a line that changes alone) | `text` |
| a picture | an `<image>` part; its `x`, `y`, `width`, `height` are the box, `preserveAspectRatio` says contain (`meet`) or cover (`slice`) | `picture` |
| an icon | an **icon place**: a nested `<svg>` part with `data-hsvg-role="icon"`, `x`, `y`, `width`, `height` and a `viewBox` | `variant` as `icon` |
| a colour | any part with a colour role (6.2.3) | `color` |

An ad button with a text place, its fit box, an icon place and colour roles (its JSON is in 4.4):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 100" data-hsvg-version="2.0">
  <title>Amber signal button</title>
  <g id="amber-signal-button" data-hsvg-kind="component" data-hsvg-role="action">
    <rect id="amber-signal-button__shadow" data-hsvg-kind="part" data-hsvg-role="shadow"
          data-hsvg-layer="decoration" x="12" y="17" width="354" height="76" rx="23" fill="#090a12" opacity="0.32"/>
    <rect id="amber-signal-button__surface" data-hsvg-kind="part" data-hsvg-role="surface"
          data-hsvg-color="accent" x="7" y="7" width="354" height="76" rx="23" fill="#f5c98f"/>
    <rect id="amber-signal-button__label-box" data-hsvg-kind="part" data-hsvg-fit=""
          x="31" y="30" width="262" height="36" fill="none"/>
    <text id="amber-signal-button__label" data-hsvg-kind="part" data-hsvg-role="label"
          data-hsvg-color="ink" x="31" y="56" fill="#2e2230"
          font-family="Archivo, sans-serif" font-size="23" font-weight="800">EXPLORE THE WORK</text>
    <svg id="amber-signal-button__icon" data-hsvg-kind="part" data-hsvg-role="icon"
         x="302" y="24" width="42" height="42" viewBox="0 0 24 24">
      <path d="M5 12h12M12 6l6 6-6 6" fill="none" stroke="#ffe9c4" stroke-width="2"/>
    </svg>
  </g>
</svg>
```

- **Drawn content is the sample.** The drawn words, picture or icon are what a plain browser shows and what a preview
  shows before a value arrives. The field's `initial` (section 5) is the value; the drawn text should equal it in the
  default language (review).
- **Text is live.** A text part is a `<text>` with its `font-family` named and a generic fallback (`Bitter,
  serif`), never outlines. Outlines are for a wordmark whose exact shape matters more than editing (review).
- **Fit.** A text that may change carries a fit on its binding (section 7.6). The fit names its fit box (`data-hsvg-fit`, 5.10)
  by local id. A bound text holds one text node, or one `<tspan>` per drawn line (the table above); when the fit
  wraps it, the engine writes the lines as `<tspan>` children.
- **Icons by id.** An icon set (2.6) holds `<symbol>` elements with `data-hsvg-role="icon"`, each named by its `id`
  and with a `viewBox`. An icon place is a part with `data-hsvg-role="icon"`; its drawn icon is the default. A `variant`
  binding with `"as": "icon"` gives an icon's id, and the player draws that symbol in the place, in the symbol's
  `viewBox`: `{"target": "icon", "variant": "status", "as": "icon"}` with `status` holding `'clock'`. The id is looked
  up in the active theme's `icons` set, then in the icon-set resources in declaration order; with no match the drawn
  icon stays. The drawing inside an icon place holds no parts (the copy carries no ids). A binding as `icon` on a part
  that is no icon place is `E-PLACE` (files, playing). Today's `data-hsvg-icon` is `E-WORD-RENAMED` (D33) (files).

  ```svg
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" data-hsvg-version="2.0">
    <symbol id="clock" data-hsvg-role="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#153b4b"/></symbol>
  </svg>
  ```
- Text that never changes (a decorative "01") is not content and needs no part.

### 6.2.3 Takes colour

`data-hsvg-color` names a theme colour role for a shape's `fill`, `stroke`, or both. A bare role means fill:
`data-hsvg-color="accent"`. Qualified, in either order: `data-hsvg-color="fill:surface stroke:ink"`. Each
paint appears at most once; empty values, unknown paints and mixed bare and qualified forms are errors.
`E-COLOR-ROLE` (files).

- **Roles.** The eight core roles are `surface`, `ink`, `accent`, `accent-2`, `muted`, `success`, `warning` and
  `danger`. A kit's theme may add its own roles (section 7.7), named in the id grammar and different from the core
  ones. A drawing checked with its kit may name only roles that kit's themes define (`E-COLOR-ROLE`); checked alone,
  a role outside the core warns (`W-COLOR-ROLE-THEME`) (files).
- **Drawn paints stay.** Every marked paint keeps its drawn `fill` or `stroke` value (including gradients) in the
  file. Without a theme, drawn paints win and the engine leaves them alone. With a theme, each marked paint takes its
  role's colour; unmarked paints keep theirs. A paint drawn as `none` stays `none` (playing).
- A `<g>` passes the role down through normal SVG inheritance. A child with its own explicit paint keeps it unless it
  carries its own role (playing).
- No CSS variables in drawings (2.11). Exporters may write variables as a render form (section 10).
- A colour binding (6.8) changes which role paints a part at play, for example the bike colour a player picks.
- **Text styles.** `data-hsvg-text-style` names a theme text style for a text: `heading`, `body`, `caption` or a kit's
  own (7.7, D37). With a theme, the text takes the style's font; without one, its drawn `font-family` stays. A `<g>`
  passes it down. Checked with its kit, the style must exist in every theme (`E-THEME-ROLES`); checked alone, a style
  other than `heading`, `body` and `caption` warns (`W-COLOR-ROLE-THEME`). Today's `display` and `text` are
  `E-WORD-RENAMED`: write `heading` and `body` (files). Example:
  `<text id="card__title" data-hsvg-kind="part" data-hsvg-text-style="heading" …>Harbour days</text>`.

### 6.2.4 Has variants

A part may keep several finished drawings, its **variants**: a mouth open and closed, a tyre firm and flat, a button idle
and pressed, a logo for light and dark. Exactly one shows.

```svg
<g id="robin-hero__mouth" data-hsvg-kind="part" data-hsvg-role="mouth"
   data-hsvg-pivot="352 212">
  <g data-hsvg-variant="closed"><path d="M330 210q22 8 44 0" fill="none" stroke="#153b4b" stroke-width="4"/></g>
  <g data-hsvg-variant="open" display="none"><path d="M330 206q22 26 44 0z" fill="#c8423b"/></g>
  <g data-hsvg-variant="smile" display="none"><path d="M328 204q24 22 48 0" fill="none" stroke="#153b4b" stroke-width="4"/></g>
</g>
```

1. A part with variants is a `<g>` whose direct child `<g>` elements carry `data-hsvg-variant`, each naming one variant.
   Names follow the id grammar and are unique in the part; there are at least two variants. The **rest variant** is the
   one shown in the file. `E-LOOK` (files; the code keeps its old name: a look is now a variant).
2. **Display fallback.** The rest variant has no `display="none"`; every other variant has `display="none"`. Static
   CSS never overrides it. A reader that knows nothing of variants shows the rest variant (files).
3. **One pivot.** A part with variants that moves has one pivot, and every variant uses it. A variant child carries no
   pivot, motion or transform. Motion acts on the part, so it moves whichever variant shows. `E-LOOK` (files).
4. A variant may hold its own sub-parts, with their own ids, roles, pivots and ranges. Children of the part that are
   not variants are always shown, in document order (files).
5. **Selectors.** A `variant` binding or a `variant` clip track chooses by a value (6.7, 6.8); a control by
   interaction (5.11); an add-on through the door (the `lines` add-on's mouth); a theme or host by an option on the
   `look` axis (section 7; the axis keeps its name). Switching is instant. One writer owns a part's variant channel.
   `E-WRITER` (files).
6. **Rest.** Stopped and reduced-motion playback show rest variants in place of variants that a clip drives.
   A variant chosen by a binding or a control is a choice, not motion, and stays (playing).
7. **Every frame and layout** draws every variant of every part the JSON names. `E-LOOK-NOT-DRAWN` (files).
8. **Review.** A variant's review lives in the trust record, narrowed with `of` (`robin-hero/mouth/open`, A9.3).
   A variant whose latest review is `draft` or `blocked` is never selected while playing and is left out of exports;
   an editor may show it. The rest variant can never be left out this way: a part whose rest variant is `draft` or `blocked` is not
   ready to play (playing).
9. **Not a variant.** The same parts laid out differently is a layout (section 7). A machine state is behaviour
   (section 5). A theme recolours; it does not redraw. Facing left or right is a `scale` binding on `axis` `x` (−1 or
   1), which mirrors about the pivot and keeps text readable, or two variants when the turned drawing differs.

### 6.2.5 Drawn whole

Every part that can move, hide, change variant or be recoloured on its own is drawn complete, including what other parts
cover. Moving, hiding or recolouring a part never shows a hole, a cut edge or background where something should be.
Covered geometry is a simple mass that continues the outline under the cover. A tool that invents covered geometry
lists it in the trust record's `inferred` (A9.3) until a person checks it. Elements inside one part may be cut
against each other. Proof: render each moving part hidden and shifted in turn and look for holes (review, the "x-ray"
check).

## 6.3 Roles

`data-hsvg-role` says a part's or component's job in words: what it is for, never how it looks, where it sits or how
it behaves (`label`, not `white-text` or `top-text`; no category prefix: `label`, not `button-label`).

1. **One flat registry.** Every role word comes from one registry of jobs. Each entry has an id, a `prefix` (the id
   in camelCase, used in field names, 5.3.1), aliases, a **job
   group**, what it applies to (part, component, slot) and, for content jobs, a **role schema**: the
   content fields every block with that role takes (5.3.1). The registry is `vocabularies.json` beside the spec:
   every entry with its job group, what it applies to and its schema; below are the groups and a few examples. A word
   may be both a component role and a part role (`caption`, `prop`). Content roles also apply to parts (a headline
   text part has the role `message`); the schema duty of rule 5 is for components only.
2. **Aliases.** A role word may be an alias (`headline` for `message`, `cta` for `action`). Readers resolve it; writers
   write the role id (files).
3. **Kits and experiences extend it.** A kit's `roles` map (section 2) adds entries. An experience may hold its own
   `roles` map the same way, for its own drawings only, with or without a kit. Neither redefines a core role or alias,
   and an experience's role never redefines its kit's. `E-ROLE-KIT` (files).
4. **Unknown roles warn.** A word in none of the core registry, the kit's and the experience's is valid and reported, never guessed.
   Rules that work by job group treat it as having none. `W-ROLE-UNKNOWN` (files).
5. **Same role, same schema.** A component whose role has a schema declares at least the schema's required fields
   as content fields named `<role>.<field>` (section 5.3.1), with the schema's type and `contentType` and bounds no
   wider than the schema's, the role id in camelCase: `pricing.amount`, `action.text`,
   `beforeAfter.before`. Content then has the same names in every kit, brief and receipt. Its required fields are
   bound in every layout. `E-ROLE-SCHEMA` (files). A block may also declare fields of other roles' schemas (a
   `pricing` component with `message.kicker`); the duty is for its own role only.
6. **Side.** A side is a role word after the role: `data-hsvg-role="hand left"` (`left`, `right` as the viewer sees
   the picture; `near`, `far` from the viewer). It qualifies the part's role, so presets find the near wing or the left
   ear. It never changes behaviour on its own. One role word and one side at most; today's `data-hsvg-side` is
   `E-WORD-RENAMED` (D33) (files).
7. **Protected areas** are role words too, on an unpainted `<rect>`: `keep-inside`, `keep-clear`, `keep-empty`, or
   `keep-inside keep-clear` (5.10). `E-PLACE`, `E-MARK-VALUE` (files).

**Content roles and their fields.** `vocabularies.json` (`roles`) gives every role's schema: its fields, which are
required, their types, bounds and the smallest tier that shows them. Three examples (`*` required):

| Role | Fields |
|---|---|
| `message` | `headline`* (text 180), `kicker` (text 80, medium), `subheadline` (text 360, medium), `accentText` (text 120, rich) |
| `pricing` | `amount`* (number), `currency` (text 12), `qualifier` (text 100, medium), `previousAmount` (number, medium), `terms` (text 280, rich) |
| `action` | `text`* (text 100), `supportingText` (text 180, medium), `url` (url, medium), `media` (picture, rich) |

**Job groups** let rules speak of many roles at once ("info gives way before message", section 8): `identity`,
`message`, `media`, `info`, `event`, `utility`, `action`, `contact`, `legal`, `backdrop`. The list is closed.
`vocabularies.json` (`jobGroups`, `roles`) puts each core role in its group, with its aliases: for example
`message` (headline, title) and `question` are message roles; `pricing` (offer, price) and `testimonial` are info
roles; `action` (cta) and `next` are action roles; `backdrop` and `ornament` are backdrop roles. `goal`,
`collectible`, `prop`, `panel`, `stage` and `widget` have no group. The roles `question`, `answer` and `back`
apply to parts as well as to components and slots: a quiz card or a drawn Back button may carry them.

The eighteen content roles of the adaptive role registry keep their fields, limits and tiers as role schemas.
Primary or secondary is the layout's choice, not the role: both are `action`.

**Core part roles** have no job group. `vocabularies.json` (`partRoles`) lists them: character parts (`head`,
`eye`, `mouth`, `arm`, `tail` and the rest) and component parts (`surface`, `label`, `icon`, `shadow` and the
rest). Plain words for moving bits (`wheel`, `door`, `needle`) are valid and reported until a kit or the experience
lists them: `"roles": { "wheel": { "appliesTo": ["part"] } }`.

The surface of a component (the plate, the pill, the disc) is the part with role `surface`; resize kinds act on it
(section 7). Segments of one chain share a role; nesting gives their order.

## 6.4 Paint and layers

**Paint order is document order.** What comes later paints over what comes earlier. There is no z-index and no
separate tab order (6.5).

`data-hsvg-layer` says what job a `<g>`, part or component does in the picture, and so how rules and budgets treat
what it paints. Descendants inherit it; a descendant may set its own. The first value, `content`, is the default.

| Layer | Meaning | What changes |
|---|---|---|
| `content` | Words, pictures and controls that matter | Fit, allocation and obstruction checks count it. |
| `backdrop` | What everything sits on: sky, wall, a full-bleed photo | Only backdrop may extend beyond the viewBox (bleed). Allocation budgets do not count it. It is never an obstacle. It holds no control. |
| `overlay` | Painted over content on purpose: a scene border, a sticker, a caption strip | It may cover content only where a `relation` rule allows `overlay` (section 8); it never covers a control or a `keep-clear` protected area. |
| `decoration` | Glows, sparkles, shadows: paint that may give way when the picture is simplified (D35) | It holds no content binding and no control. Give-way steps may simplify it. Assistive technology does not see it. |

`data-hsvg-layer="decoration"` is a layer value; `data-hsvg-role="decoration"` (6.3) is a role, ornament that screen
readers skip. One does not imply the other (D35). Today's `data-hsvg-paint` is `E-WORD-RENAMED`: write
`data-hsvg-layer` with the same value (files).

```svg
<g id="sparkles" data-hsvg-layer="decoration">…</g>
```

**Layers.** A `<g>` that carries `data-hsvg-layer` is a **layer**, and its value says how what it paints is treated. Layers
nest: a layer inside a component, or inside another layer, stacks within it in document order. The top-level layers
of a screen drawing usually come in this order: a `backdrop` layer, a `decoration` layer behind content, the
`content` layer, a `decoration` layer in front, an `overlay` layer. Anything outside a layer is `content`. A use
mounted in a slot takes the slot's layer unless it sets its own.

- In a screen drawing, bleed beyond the viewBox is `backdrop` only: painted extent outside the viewBox. Painted
  extent is the geometry's bounding box grown by half the stroke width, the filter region for a filtered element, and
  the pinned measurer's box for text (or `not-run`), after clip paths and masks. A component's viewBox is not a paint
  limit (a shadow may reach past it). Unpainted
  geometry, such as a route, may extend beyond it. `E-PAINT` (files).
- Content in front of an overlay, or an overlay over a control or a `keep-clear` protected area at rest, is reported.
  `W-PAINT-OVER` (files); the `clear` rule proves it while moving (playing).
- The upgrade tool turns the 1.x layer bands into these layer values (A13.9).

## 6.5 Accessibility inside drawings

The engine gives a drawing its accessible structure from the marks; authors write no ARIA (2.11).

1. **Names.** The root `<title>` is the drawing's accessible name (recommended; required for library-ready;
   `W-A11Y-TITLE` when it is missing, files). `<desc>`
   is a longer description. Both are plain text, only as children of the root `<svg>`. A part's name for people is
   `data-hsvg-label`; without it, its local id in words (`near-wing` is "Near wing"). A control's accessible name is
   its `label` (5.11), else its target's `data-hsvg-label`, else the text of its only `<text>`; the id fallback does
   not count for controls, and a control with no name is an error. `E-A11Y-NAME` (files).
2. **What is exposed.** A drawing without controls is one image named by its title. Text bound to content is exposed
   as text in document order. Control targets are exposed as controls. A part that is not a control target and has a
   `data-hsvg-label`, or a `label` binding (6.8), is a named image: the engine gives it that name on the page, so a
   game piece reads as "White knight". Such a part, or a drawing's root, that holds a control target is a named
   group instead, so its controls are never hidden inside an image. `backdrop` and `decoration` paint is hidden from
   assistive technology. A text binding with a fit keeps the full text as the accessible name. A text part with the
   role `feedback` is a polite live region: the engine announces its text when it changes or becomes visible
   (playing).
3. **Focus order is document order** of control targets in the mounted drawing, uses expanded where their slots sit
   (section 10 adds shell slots). There is no `tabindex`. Option targets are focused in document order (playing).
4. **Labels match.** A label differs from a control's visible words only by adding to them, so speech input finds it
   (review). A control with no visible words (a whole-screen click area) is exempt.
5. **Reduced motion.** Every part with variants has a rest variant, and every part reads right at rest. Under reduced
   motion the engine shows finished or resting clips (6.7), and rest variants only where a clip or speech chose the
   variant; variants chosen by bindings and controls stay (playing).
6. **Readable.** Text is live text at or above the readable floor at the final output size (rule `readable`). Hit
   targets meet `hit-target` (section 8) (files, playing).
7. **Colour is never the only signal.** Right and wrong, on and off, are also shown by shape, words or a variant. Theme
   contrast is checked per theme (section 7); contrast of colours drawn without roles is reviewed (review).
8. **Nothing in the bleed** that must be read or pressed (review).

## 6.6 Frames

A **frame** is one drawing of a block at one size or one shape (1.2). Each frame is its own drawing file. A
scene's or shell's frames are screen drawings, with `data-hsvg-kind="screen"` on the root; a component's
frames are component drawings (2.10). The block's document names its frames through its layouts
(section 7). The rules below apply to every frame; those about bleed and the protected area apply to screen drawings.

- **Exact size or shape.** A frame for an exact size (a 300×250 ad) sets `width` and `height` equal to its viewBox
  size, in CSS pixels (`E-SVG-ROOT`); exact replay (7.6, rule 8) happens at that size. A frame for a shape (`wide`, `tall`) leaves them out: the player fits its viewBox in the
  space, centred, keeping its proportions (files).
- **The viewBox is the protected area**, a `keep-inside` protected area: controls, words, the main action and the whole travel
  of moving controls stay inside it, with at least 2 CSS pixels around each control for its focus mark. The player draws that mark as a ring that follows the control's outline, curves included, and reaches about 7 CSS pixels past it (a 2 px gap, a 3 px band, a 2 px halo); a clip path above the control shapes the ring but does not cut it; in forced colours, or where a ring cannot be drawn, it is the plain outline. The mark shows when focus came from the keyboard, not after a mouse or touch press (5.11). The root never uses `preserveAspectRatio` with
  `slice`. `E-SVG-ROOT` (files).
- **Bleed.** Backdrop drawn beyond the viewBox fills the extra space when the container's shape differs. It is not
  clipped to the viewBox. Nothing that matters goes in the bleed (files, review).
- **The same names in every frame of a block:** every part, place and slot name the JSON names, with the same kind
  and place mark; every variant; the same motion channels (ranges may differ with scale); the same colour roles; repeat
  capacity that fits the list (the shared invariants of 7.1). A missing name is an error naming the file. `E-LAYOUT-MISSING` (files).
- **Derived frames.** A frame a tool made from drawn ones (a solved layout plan of the `fit` add-on, for example)
  carries a **tool record** and its receipt. The tool record is one JSON object in a `<metadata>` element, a direct
  child of the root (at most one): `{"derived": "derived"}`; once a person edits the frame, `"derived": "edited"`. A
  baked frame's record also holds the text give-way steps the bake took (`"steps"`: `<rule id>:<step>`, once per time,
  space-separated, A11.5), so a baked page shows its steps in the ladder's read-out and the ambient `layout` value as
  a live one does; the plan's steps are in the receipt. A malformed record is `E-MARK-VALUE`. The packer keeps the
  record in a derived frame (the player reads it) and strips it from every other drawing. Today's
  `data-hsvg-derived` and `data-hsvg-steps` are `E-WORD-RENAMED` (D33):
  `<metadata>{"derived": "derived", "steps": "fits-title:shrink"}</metadata>`. An
  edited frame is never overwritten without an explicit request. Only an explicit promote makes it a drawn frame: it
  drops the mark, and tools then learn from it and never overwrite it (files).
- **The HyperSVG's record.** A HyperSVG (2.13, D45) carries the tool record `{"asset": {...}}`: the asset's other
  files as data, written by `pack --asset` right after the root start tag. The drawing check only checks that `asset`
  is one JSON object; `unpack` and the asset player check the record itself (10.14) (files).
- `<title>` names the block at that size.

Robin's harbour stop, wide frame: a backdrop layer with bleed, a content layer with a slot, a walking surface, a
fit box and a protected area, and an overlay layer with the onward control (its JSON is in 4.2 and 4.3).

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" data-hsvg-version="2.0" data-hsvg-kind="screen">
  <title>Harbour Row</title>
  <g id="sky" data-hsvg-layer="backdrop">
    <rect x="-400" y="-200" width="2000" height="1200" fill="#bfe4de"/>
  </g>
  <g id="world" data-hsvg-layer="content">
    <path id="road" data-hsvg-kind="part" data-hsvg-route="surface" d="M-400 690H1600" fill="none"/>
    <g id="robin-mount" data-hsvg-kind="part" data-hsvg-slot="robin" transform="translate(140 420) scale(0.4)"/>
    <rect id="bruno-face" data-hsvg-kind="part" data-hsvg-role="keep-inside keep-clear"
          x="820" y="300" width="160" height="150" fill="none"/>
    <rect id="caption-box" data-hsvg-kind="part" data-hsvg-fit="" x="60" y="40" width="520" height="96" fill="none"/>
    <text id="caption" data-hsvg-kind="part" data-hsvg-color="ink" x="60" y="80" fill="#153b4b"
          font-family="Nunito, sans-serif" font-size="32">Bruno is waiting for his parcel.</text>
  </g>
  <g id="controls" data-hsvg-layer="overlay">
    <g id="onward" data-hsvg-kind="part" data-hsvg-role="next" data-hsvg-label="Onward">
      <rect x="1040" y="680" width="120" height="80" rx="40" fill="#e6af42" data-hsvg-color="accent"/>
      <path d="M1085 700l30 20-30 20z" fill="#153b4b" data-hsvg-color="ink"/>
    </g>
  </g>
</svg>
```

## 6.7 Clips

A **clip** is motion over time: tracks of keys on drawn parts, in milliseconds on the block's local clock.

```json
"clips": {
  "wave": {
    "durationMs": 900, "lane": "gesture",
    "tracks": [{"id": "wing-lift", "target": "left-wing", "channel": "rotate",
                "keys": [[0, 0], [400, 35, "ease-out"], [800, 0, "ease-in-out"]],
                "stagger": {"targets": ["right-wing"], "eachMs": 80}}],
    "markers": [{"id": "wave-top", "atMs": 400, "event": "waved"}]
  },
  "pedal": {"durationMs": 600, "loop": true, "speed": "gear",
            "tracks": [{"id": "crank-turn", "target": "crank", "channel": "rotate", "keys": [[0, 0], [600, 360]]}]}
}
```

| Clip key | Meaning |
|---|---|
| `durationMs` | Required. 1..3,600,000 |
| `loop` | `false` (default), `true`, or an iteration count 1..1,000,000 |
| `loopMode` | `repeat` (default), `ping-pong`, or `hold` (keep the final pose until stopped). A clip that is not `hold` releases its pose when it ends, as `stop` does. |
| `speed` | Positive formula sampled at `play`, 0.01..100, default 1; it multiplies the owner's clock speed (3.10) |
| `lane` | Optional lane name (an id), per block. Playing a clip on a busy lane replaces the clip there. A clip without a lane is its own lane. |
| `reducedMotion` | `finish` (default), `rest` or `keep`. `finish` shows the pose at the clip's end (a `ping-pong` clip with an even count ends on its first key) |
| `tracks` | Required. 1 to 1024 tracks: `target`, `channel` (a word, below) with its `as` and `axis`, `keys`, optional `id` and `stagger` |
| `markers` | Up to 256 `{id, atMs, event}`, inside the duration |

- `keys` are `[timeMs, value, easing?]` with times rising from 0 to at most `durationMs`, up to 4096 per track. The
  value is a formula sampled at `play`. **[files]**
- `stagger: {targets, eachMs}` starts copies of the track on more parts, `eachMs` (0..10,000) apart; each copy's last key, delayed,
  still lies within `durationMs`. **[files]**
- A clip targets parts of its own block. To move a part inside a used component, pass an input that the component's
  own clip or binding reads (Robin's `walking` input). Each channel still has one writer (9.3). **[files]**

**Channels.** A track's `channel` is one of the words a binding uses (6.8, D33): `move`, `rotate`, `scale`,
`opacity`, `color`, `draw` and `variant`, with the same `as` and `axis`. Every one is core (D28), colour animation,
`draw` and `move` along a route included. A route needs no add-on: its path code is part of the core engine
(`engine/v2/src/route.mjs`). An add-on may add a channel of its own (D39), named `<add-on>.<channel>` and declared in
its manifest's `paints` (12.5), with the add-on in `needs`: `{"target": "pennant", "channel": "example.sway.swing",
"keys": [[0, 0], [300, 1]]}`. The checker proves every key inside the channel's declared range. The `motion` add-on's
`motion.morph` (in the add-ons release, with `motion` in `needs`) is such a channel.

**Draw** is the drawn share of a stroked shape's length, 0..1, from an optional `start`
(a number or a numeric formula, 0..1, default 0) written beside the word in the track or binding. The target is a
`<path>`, `<circle>`, `<ellipse>`, `<line>`, `<polyline>`, `<polygon>` or `<rect>` with a stroke that is not `none` and
`pathLength="1"`; it moves inside its `draw min..max` motion range. Only `stroke-dasharray` and `stroke-dashoffset` are
written, and `visibility` at a share of 0; the pattern has period 1, so on a closed shape a dash that passes the end goes on from the beginning. One
ring per row of a repeated use makes a donut (each ring's `start` is the shares before it:
`sum(range(index), rows[item].share)`), one arc makes a gauge or a progress ring, and one path a line that draws on. A
circle starts at its rightmost point and runs clockwise; turn it in an inner group (`rotate(-90 cx cy)`) to start at the
top. A share of 0 hides the part, whatever its caps (round caps would draw a dot); a share above 0 shows it again. `E-TYPE`, `E-MOTION-RANGE`,
`E-RANGE` **[files]**, **[playing]**

| Word, `as` and `axis` (first listed = default) | Value | The drawing's motion channel |
|---|---|---|
| `move` with `axis` `x` or `y` (`axis` is required) | SVG units | `move-x`, `move-y` |
| `move` with `axis` `route` | 0..1, progress along the drawn route place named in the track's or binding's `route` key (`data-hsvg-route="track"`, 5.10), in its drawn direction. The part's placement point follows the route; a part that must turn along it also gets a `rotate` track | (no range) |
| `rotate` (`as` `spin`) | Degrees about the part's pivot, unwrapped (0 to 720 turns twice) | `rotate` |
| `rotate` with `as` `lean` | −85..85 degrees, along x | `lean` |
| `scale` (`as` `stretch`, `axis` `both`, `x` or `y`) | Positive factors about the pivot; `both` writes both axes. On a binding, −1 on `x` mirrors the part (a part facing left; 6.8) | `scale`, `scale-x`, `scale-y` |
| `scale` with `as` `line` | Line thickness in drawing coordinates, 0..1000 | `line` |
| `opacity` | 0..1 | `opacity` |
| `color` with `as` `fill` or `stroke` | A six-digit hex colour, `#rrggbb`. Keys blend per red, green and blue in sRGB, rounded to whole numbers. The target has a drawn paint of that kind that is not `none`. Colour roles use the colour binding instead | (no range) |
| `draw` (`as` `line`) | 0..1, the drawn share of the length from `start` (above) | `draw` |
| `draw` with `as` `wipe` | 0..1 reveal through a rectangle in a clip path, from the rectangle's x | (no range) |
| `variant` | A drawn variant name (6.2.4); held until the next key; ignores easing | (no range) |

An old channel name in a track (`"channel": "translate-x"`) is `E-WORD-RENAMED` with the final form (11.5).

**Easing** belongs to the destination key. The named easings are CSS's: `linear` (default), `ease` (0.25, 0.1, 0.25,
1), `ease-in` (0.42, 0, 1, 1), `ease-out` (0, 0, 0.58, 1), `ease-in-out` (0.42, 0, 0.58, 1), and `cubic-bezier(x1, y1,
x2, y2)` for any other curve (the array `[x1, y1, x2, y2]` means the same), with x in 0..1 and y in −4..4; no other CSS
easing is allowed. Two words are not CSS: `hold` and `theme` (the active theme's motion easing, 7.7). Before the first
key a track holds the first key's value; after the last, the last key's value. The
engine solves the cubic with 48 bisection steps; it never bakes a sample table. **[playing]** The checker proves that
every key and overshoot stays inside the part's motion range. `E-MOTION-RANGE` **[files]**

- `play` starts a clip from its beginning; `stop` releases its pose and restores the drawing. `stop` with
  `keep: true` leaves each part at its value at that moment instead, until another writer moves it or its block
  enters afresh (as 0.1's stop did). A marker exactly at
  `durationMs` fires. `ended:<clip-id>` fires
  once per run: at the natural end, or with `interrupted: true` when stopped or replaced. **[playing]**
- Markers fire once per crossed iteration on speed-adjusted time, in reverse order on ping-pong reverse runs. Each
  crossing is a deadline on the one schedule (3.10), so large and split advances give the same events. More than 100
  crossings of one clip at one engine millisecond is a runaway clip: `E-EVENT-LOOP`. A marker's event becomes an output when declared as an output event (5.12). **[playing]**
- **Reduced motion.** `finish` shows the final pose at once; `rest` shows the first key; an endless loop shows its
  first key. Markers and `ended` still fire at their normal times. `keep` plays normally and is for motion that is
  the content, not decoration. Timers never change. **[playing]**, **[review]** for `keep`

## 6.8 Bindings

A **binding** ties a value to the drawing. It repaints when a name its formula reads changes. The `bindings` list
replaces `hsvg/0.1` `shows` and the imperative `show`, `hide` and `state` actions. Each binding has a `target`, exactly one of the keys below, and an optional `id`
(2.1 rule 4).

A binding's key is its word (D33). There are ten: `text`, `label`, `visible`, `variant`, `color`, `move`, `rotate`,
`scale`, `opacity` and `draw`. `as` and `axis` say which sort; the first listed value is the default.

| Word | Value | Writes |
|---|---|---|
| `text` | Template; optional `fit` (7.6, its drawn box named with `box`) and `case` (`upper` or `lower`) | The text; the full text stays the accessible name. `case` changes only what is shown, by the active language's rules; the accessible name and every formula keep the text as written, and the fit measures the shown text. A text that reads `elapsed` (a count-up) is fitted once, for its value at rest, and its accessible name is that value; under reduced motion it should show that value at once (read `reducedMotion`) |
| `label` | Template | The part's accessible name (a picture's alt text, a translated logo name). It is a binding of its own |
| `visible` | Boolean formula | Display and accessibility; a hidden control leaves the focus order. The binding owns visibility: `true` shows a part drawn with `display="none"` |
| `variant` (`as` `drawn`, `picture`, `icon`) | Formula giving a variant name; as `picture`, a picture resource id; as `icon`, an icon's id in an icon set (6.2.2) | Which drawn variant of the part shows (6.2.4); the image of a drawn picture place; the icon in an icon place |
| `color` (`as` `marked`, `fill`, `stroke`) | As `marked`: a formula giving a colour role name, with an optional `role`, a colour role the part's drawing marks. As `fill` or `stroke`: a `#rrggbb` colour formula, with an optional `glide` | Which theme colour role paints the part (7.7): its paints marked with `role` take that role's colour; without `role`, every marked paint of the part does; a part with no marked paint takes it as its fill. As `fill` or `stroke`, that paint (6.7) |
| `move` (`axis` `x`, `y` or `route`, required) | Numeric formula; optional `glide`; `route` names the route for `axis` `route` | The motion of 6.7 |
| `rotate` (`as` `spin`, `lean`) | Numeric formula; optional `glide` | The motion of 6.7 |
| `scale` (`as` `stretch`, `line`, `box`; `axis` `both`, `x`, `y` for `stretch`) | As `stretch` or `line`: numeric formula; optional `glide`. As `box`: a formula giving `[width, height]` in the drawing's units, each at least 1, with an optional `anchor`, `[x, y]` of `start`, `middle` or `end` (default the middle); the target is a `<rect>` slot or region | The motion of 6.7. On `axis` `x`, −1 mirrors the part about its pivot and keeps its text readable: a formula that gives only −1 and 1 faces a part left or right, and needs no motion range. As `box`: the rectangle's size while playing, about its anchor; what is placed in it sees a new space and chooses again: its frame, layout, tier and give-way steps (7.4, 7.9, A11.5) |
| `opacity` | Numeric formula; optional `glide` | The motion of 6.7 |
| `draw` (`as` `line`, `wipe`, `points`) | As `line` or `wipe`: numeric formula; optional `glide`; `start` for `line`. As `points`: a formula giving 2 to 512 (`linePoints`) numbers (y values, spread evenly in x) or `[x, y]` pairs; `area` names a drawn `<rect>` part, the plot box; optional `range`: `{"x": [lo, hi], "y": [lo, hi]}` (default x: the item indexes, y: 0..1); the target is a `<polyline>` | The motion of 6.7. As `points`: the polyline's points: each value mapped into the area's box, y upwards; a value outside its range sits on the box's edge. The drawing keeps the line's style, the axes and the frame |
| an add-on's name | An object the add-on's manifest closes (`draws`, chapter 12): `{"target": "screen", "media": {...}}` | What that add-on paints on the target. It is the target's only writer |
| an add-on's channel, `<add-on>.<channel>` | A numeric formula inside the channel's declared range (`paints`, 12.5, D39): `{"target": "flag", "example.sway.swing": "wind / 5"}` | The part channels the add-on's writer sets (its manifest's `onto`), each inside the part's drawn motion range |

`glide` is `{durationMs, easing}` (`durationMs` 1..10,000, required; `easing` optional, default `linear`).

```json
"bindings": [
  {"id": "caption-text", "target": "caption", "text": "{{ words.welcome }}",
   "fit": {"box": "caption-fit", "fontPx": 24, "minFontPx": 18, "maxLines": 2}},
  {"id": "caption-name", "target": "caption", "label": "{{ words.welcomeSpoken }}"},
  {"id": "next-visible", "target": "next-wrap", "visible": "canNext"},
  {"id": "mouth-look", "target": "mouth", "variant": "mood === 'happy' ? 'smile' : 'rest'"},
  {"id": "wheel-turn", "target": "wheel", "rotate": "clamp(distance * 2, 0, 3600)",
   "glide": {"durationMs": 120, "easing": "linear"}},
  {"id": "cart-go", "target": "cart", "move": "progress", "axis": "route", "route": "road"},
  {"id": "bee-face", "target": "bee", "scale": "goingLeft ? -1 : 1", "axis": "x"},
  {"id": "buy-color", "target": "buy-button", "color": "onSale ? 'accent' : 'surface'"},
  {"id": "ring-line", "target": "ring", "color": "'#d94f30'", "as": "stroke"}
]
```

An old key is `E-WORD-RENAMED` with the final form (11.5): `channel` with `value` is the word of 6.7 (`translate-x`
is `move` on `axis` `x`, `skew` is `rotate` as `lean`, `stroke-width` is `scale` as `line`, `fill` and `stroke` are
`color` as `fill` or `stroke`, `dash` is `draw`, `wipe` is `draw` as `wipe`); `look` is `variant`; `picture` and
`icon` are `variant` as `picture` or `icon`; `size` is `scale` as `box`; `points` is `draw` as `points`; `face` is
`scale` on `axis` `x` (−1 faces left); a `label` written beside another word is a binding of its own; a fit's
`region` is `box`.

- Variant names exist in every frame; colour roles in every theme of the kit; pictures and icons are declared
  resources, never URLs. `E-LOOK-NOT-DRAWN`, `E-THEME-ROLES` (7.7), `E-REF-UNKNOWN` **[files]**, **[playing]**
- A motion value is proven inside the motion range (5.6.7). **[files]**
- **Glide.** When a motion binding's value changes, `glide` moves the part from the value shown to the new one over
  `durationMs`, with its easing; a `color` as `fill` or `stroke` blends. The block keeps painting until it arrives. The
  glide starts at the paint that first shows the new value. Under reduced motion it jumps. **[playing]**
- **Case.** `case` on a text binding shows the text in upper or lower case by the active language's rules (`Straße`
  shows `STRASSE`); the accessible name keeps the text as written. Texts that a give-way ladder lays out keep their
  tier wordings and are not cased in 2.0. **[playing]**
- A binding writes only its own attribute: text, visibility, transform, stroke dash, the chosen variant, the colour role
  or the image reference. It never writes path data, outside references or style text. **[files]**
- Bindings target their own block's parts; a scene never binds to shell parts (10.1). **[files]**
- Binding formulas are evaluated in the compute phase, after the queue is empty and before commit (9.2, step 6); a fault there faults the transaction. A binding
  that reads `elapsed` is also evaluated at each tick or manual clock step; a fault there stops the
  experience. Bindings then
  repaint once per tick (9.2, step 9). An unchanged value rewrites nothing. A redraw at
  another shape keeps values, machine states, clip time and focus, and applies the bindings again. **[playing]**

## 6.9 Attach and follow

Three things look alike but are different (11.3): follows, nesting and attach. **Follows** is drawn (6.2.1): a part moves as if nested inside a leader part,
taking its transform only. **Nesting** is a use inside a block (`uses`, 4.3). **Attach** is the player's call
`player.attach` (5.15.1):

```json
[{"id": "load", "call": "player.attach", "with": {"part": "'parcel'", "to": "'bike.basket-point'"}},
 {"id": "unload", "call": "player.attach", "with": {"part": "'parcel'", "to": "null"}}]
```

**An attach point is a slot** (D33): an empty `<g data-hsvg-slot>` inside the part the use rides on, placed at the
point. A use's block lists it in `places` as a `slot` (4.3):

```svg
<g id="bike__frame" data-hsvg-kind="part" data-hsvg-motion="move-x 0..200">
  <path d="M0 0h80"/>
  <g id="bike__basket-point" data-hsvg-kind="part" data-hsvg-slot="basket-point" transform="translate(64 -20)"/>
</g>
```

- `player.attach` puts a use of this block (`part`, quoted) on a slot (`to`), written `'<use-id>.<slot>'`
  (`'bike.basket-point'`), or the slot alone for one of this block's own `<g>` slots. The use's drawing moves into that
  slot: it rides on the part that holds the slot, with its placement point at the slot's origin, and is drawn where
  the slot is in paint order. With `to` `null`, or `to` naming the use's own home slot (its `into`), it goes back
  where it was drawn. A use mounted in a `<rect>` slot keeps its box. **[playing]**
- The slot is drawn in every frame (and listed in the use's `places`). `part` is a use; a drawn part moves with its
  parent or follows a leader (6.2.1). Loops are refused when the checker can see them; at run time an attach onto a
  slot inside the use itself faults. `E-REF-UNKNOWN`, `E-CYCLE` **[files]**, **[playing]**
- Today's `data-hsvg-anchor` is `E-WORD-RENAMED`: draw an empty slot `<g>` at the point (D33) (files).
- Attachments are part of the store: rolled back with a failed transaction, kept by a visit and across redraws,
  cleared on the owner's fresh entry. Write an initial attachment as an `entry` action. **[playing]**
- At most 256 `player.attach` calls per block. **[files]**

## 6.10 Audio

**Sounds** are resources (section 2). Where a sound is used, an optional `gain`, a literal number 0..1 (default 1), sets its level; it
replaces the `hsvg/0.1` file `volume`. The experience declares its mix:

```json
"audio": {"groups": {"music": "musicVolume", "sounds": "soundsVolume", "voice": "voiceVolume"},
          "mutes": {"music": "musicMuted"}, "fadeMs": 400}
```

- `groups` and `mutes` map the three groups `music`, `sounds` and `voice` to knobs (5.3.2); the mix's `fadeMs` (0..10,000) is the default music fade. Knobs are numbers bounded within 0..1 and booleans; a person's `player.setting` may write them at play. **[files]**
- A scene's (or a shell's) `music` is `{"sound": "harbour-loop", "fadeMs": 900, "gain": 0.8}`, `fadeMs`
  0..10,000; `whilePaused` is `play` (the default) or `pause`, for a scene's music while that scene is paused; a scene's music wins over the shell's while it plays. Components have no music. Music loops. Entering a scene
  with the same music continues it; different music crossfades; no music fades out. At most two music sources play
  at once. **[playing]**
- **Made sounds (D31.2).** The experience's `audioSynths` maps sound names to synthesised sounds, at most 64:
  `"audioSynths": {"tap": {"wave": "sine", "from": 880, "to": 660, "durationMs": 90, "gain": 0.4}}`. `wave` is `sine`,
  `square`, `triangle`, `sawtooth` or `noise`; `from` and `to` are a pitch glide in hertz (20..20000); `durationMs`
  (1..10,000) and `gain` (0..1) are required; `attackMs` and `releaseMs` (0..10,000) are optional. A made sound is played with `play` as a sound
  by its name, and uses the same mixer, groups and mutes as a recorded one. Its name never equals a sound resource's id.
  A made sound needs no add-on: no `needs` entry, nothing to install. The loudness mouth is not core: it is the
  `synth` add-on's (`"addons": {"synth": {"mouth": {...}}}`). **[files]**, **[playing]**
- `play` as a sound plays in `sounds` or `voice`. Level is master `volume` × group knob × fade × the sound's `volume` (a music's or made sound's `gain`); master or
  group mute silences. Changes reach sounds already playing. **[playing]**
- Each use owns its mixer. Removing a use stops its sounds and pending decodes, not its parent's. **[playing]**
- A sound file the browser cannot fetch or decode stays silent and never stops the experience. The player reports it
  once per file to the host's error callback and the console. `W-SOUND-UNPLAYABLE` **[playing]**
- Sound starts only after a trusted person gesture; earlier requests stay silent. Music may start at the next eligible
  gesture; speech is never queued for later. Sounds pause with their owner's clock (3.10) and with a hidden page, each resuming where it stopped; music
  (unless its `whilePaused` is `pause`) and the shell's sounds go on while a scene is paused; and
  keep their own rate under clock speed. Reduced motion does not change sound. **[playing]**
- At most four copies of one sound and 16 one-shot sounds play at once; a sound over either limit does not start. Byte budgets come from the host profile
  (`soundBytes`, A10.3). **[playing]**, **[files]**
- Sound is never the only signal: what is heard is also shown. **[review]**
