# A10. Hosts and packages

This is a reference chapter of the tool reference (`reference/README.md`): for people who build editors, hosts,
packers and checkers. A first experience needs none of it.

## A10.1 Host profiles


A host profile says what one host runs, grants and limits. It is a document:

```json
{
  "format": "hsvg/2.0",
  "kind": "host-profile",
  "id": "ad-network-a",
  "capabilities": ["shell", "motion", "effects", "synth"],
  "grants": {"storage": [], "openUrl": true},
  "budgets": {"archiveBytes": 614400, "lengthMs": 30000},
  "rules": [{"id": "ad-weight", "kind": "budget", "measure": "archiveBytes", "maximum": "host"}],
  "level": "import-ready",
  "requireSignature": false,
  "requireSignedReviews": false,
  "keys": []
}
```

| Key | Meaning |
|---|---|
| `capabilities` | The capabilities this host runs, by name (10.7). Absent: every capability the player has. Core actions and controls always run. A package that needs a capability outside the list is refused at mount, before anything plays (`E-HOST-RUNS`). |
| `grants` | What the host gives across its boundary, in the shape of 10.5. Anything not listed is denied. |
| `limits` | How far this host lets content raise capacity limits: a map from limit id to a value from the format value to its `upTo` (A10.8). Anything not listed stays at the format value. A package that raises a limit further is refused at mount (`E-HOST-LIMIT`). |
| `budgets` | Values for `budget` rules with `"maximum": "host"` (A10.3): a map keyed by measure, or a list of `{measure, on, maximum}` for a measure that has a value per subject (`fontBytes`, `unpackedBytes`). The word `"host"` in a budget `maximum` is a literal word, read before formulas. |
| `options` | Default options for the axes whose selector is `host`, `{<axis id>: <option>}`, used when the mount gives none (10.6, 7.1). Checked against the axis (`E-AXIS-INPUT`). |
| `rules` | Host rules (A11.3). Content cannot waive them (A11.6). The baseline pack applies without being listed (A11.4). |
| `level` | The lowest conformance level it accepts (A10.7). |
| `requireSignature` | Whether a package must carry a valid signature (A9.3). Default `false`. |
| `requireSignedReviews` | Whether admission uses signed reviews only (A9.3); unsigned reviews are advisory there. Default `false`. |
| `keys` | The keys the host trusts, a list of `{id, by, alg, publicKey}` (A9.3). A signature's `key` names an `id`. |
| `urlParams` | Whether the host or adapter adds an `openUrl`'s `with` as query parameters (10.4). |
| `video` | For a video export: `size`, `frameRate` (a whole number, 1 to 60) and `captions` (a list of `vtt` and `burned`). |
| `audience` | Optional: `any` (default) or `children`, which refuses `open` AI steering (A5.1). |
| `retention` | Days to keep stored data (`saved` and `session` values, 5.1.2): an integer of 1 or more (`E-RANGE`, files). Data whose `writtenAt` is more than that many days before the host's `now` is dropped before it is restored. Default: until cleared |
| `readable` | The readable floor in CSS pixels for `readable` rules valued `"host"` (A11.10); 12 when absent. |
| `fonts` | A map from host font family to `{file, digest}` (a font file), so fits with host fonts can be proven (7.6). |

**Host pictures (D40).** A host hands in a picture with `player.picture(name, bytes, type)` (10.6): PNG, JPEG or WebP,
never SVG or code. The engine checks it against `imageBytesEach` and `imagePixelsEach`, as the experience raises them
where the host profile's `limits` allow (A10.8). A refused picture is `E-HOST-PICTURE`.

Export adapters (an ad zip, a video, a learning platform) are a 2.1 draft
(`drafts/delivery-2.1.md`); the packed page is the only 2.0 output.

The 1.x budget profiles carry over as host profiles with the values of A10.3 (`ad`, `wordpress`, `web`, website mascot,
premium mascot). A host or network profile sets its own values, higher or lower. A tool never picks a profile on its own.

## A10.2 Packing for a host

Execution profiles were folded into host profiles: one document per host (decision 11 after R2). What a host runs is
the host profile's `capabilities` (A10.1).

1. **Valid files are not support.** A package can pass every files check and still need something a host does not
   run. Before mounting, the player compares the package's `needs` with the host profile's `capabilities` and refuses
   it before anything plays (`E-HOST-RUNS`).
2. **Authoring-only features.** Some features are for authoring only: give-way steps, layout plans that were baked per
   shape, draft looks, the adaptive envelope. The capability registry beside the spec marks them `authoringOnly`. They may
   live in kits. The packer bakes them before it computes digests: it writes the derived frames a plan gives
   (the `fit` add-on), unless the block lists `fit` in `needs`, applies give-way results, and leaves out authoring-only packs,
   steps and draft looks. It then recomputes every digest it changed, drops the reviews of changed documents, and
   records the source digest in `trust.provenance.packedFrom`. A package that still holds an authoring-only feature fails
   (review). Packing never removes a look that a binding or a clip names: a blocked or draft look stays in
   the file and is never selected (6.2.4).
3. A feature that is valid in the spec but missing from a host's profile is not authoring-only. It is simply refused on that
   host.

## A10.3 Budgets

A **budget** is a rule of kind `budget`: a numeric cap on one measure. It may attach anywhere: a block, a scene, an
experience, a kit, a host profile.

| Measure | Counted on |
|---|---|
| `archiveBytes` | The actual final archive of an export, every member included (drawings, JSON, fonts, sounds, preview, and the packed player and capability code). One archive per output size unless the host takes a family as one archive. |
| `unpackedBytes` | The expanded package, or one member with `subject` (its path in the package). |
| `files` | The number of files in the archive. |
| `fontBytes` | One embedded font (`on: "resource:<id>"`), or all of them with `on: "resources"`. |
| `soundBytes` | All sound resources. |
| `videoBytes` | All video resources (2.6). |
| `lengthMs` | The timed length of the experience along its timed links (the path a video follows): engine time from the start until no timed link can fire any more and the last scene's lines and clips have ended, plus its `endHoldMs`; fades overlap (3.2). |
| `tableRows` | Rows of one data table. |
| `repeatItems` | Live items of one repeat. |
| `pathsRewritten` | Drawn paths rewritten per animation tick by live effects. |
| `suspendChars` | Characters of the suspend data a learning platform keeps: the serialised `saved` values and graph memory (A10.1). |

The format's own limits (formula budgets in 5.6.6, engine limits in 9.8, all listed in `limits.json`) are not budgets:
they hold everywhere, a host may let content raise only the capacity limits that allow it (A10.8), and a budget may
only be stricter.

**Valued by the host.** `"maximum": "host"` takes the value from the `budgets` of the host profile of the run or
export (A10.1). A number written
in content may only be stricter than the host's (A11.7). If the host profile gives no value, the budget is `not-run`,
never a pass.

```json
"rules": [
  { "id": "ad-weight", "kind": "budget", "measure": "archiveBytes", "maximum": "host" },
  { "id": "ad-length", "kind": "budget", "measure": "lengthMs", "maximum": 15000 }
]
```

Host profiles (A10.1) carry values such as these, from the 1.x budget profiles:

| Host profile | `archiveBytes` | Other |
|---|---|---|
| `ad` | 153,600 (150 KiB) | `unpackedBytes` 16,777,216 |
| `mascot` | 81,920 (80 KiB) | `pathsRewritten` at most 3 per tick |
| `premium-humanoid` | 153,600 (150 KiB) | as `mascot` |
| `web`, `wordpress` | 16,777,216 (16 MiB) | each member at most 8 MiB expanded; one embedded font at most 512 KiB, all fonts 1 MiB |

- **Measured, not estimated.** A budget on an export qualifies only from the actual final bytes. A reconstructed or
  estimated archive is reported, never a pass.
- **Nothing is dropped to fit.** Content is never left out silently to meet a budget. Over budget is a failure (or
  a hold for an export), with the measured numbers.
- The player's own size limits are a project decision, not format. Receipts report engine and capability bytes apart from
  content bytes.

## A10.4 The frame link (was in 10.6)

A host may show a packed page in a sandboxed iframe (`sandbox="allow-scripts"`, never `allow-same-origin`, 10.4). The
host page cannot then reach `window.hsvg`. The **frame link** carries the host API across the frame by messages. It is
built: the page side is in every packed page (`engine/v2/web/frame-link.mjs`), and the host side is a small helper a
host page imports (`engine/v2/web/frame-host.mjs`, `connectFrame(iframe)`). It carries the host API's calls, never code
(D40).

- **The token.** The host makes a channel token of at least 128 random bits, written base64url (22 to 256 characters of
  `A-Z a-z 0-9 _ -`).
- **Hello.** The host sends `{call: "hello", channel}` to the frame's window. The page takes the first hello that
  comes from its parent window, once, and answers `{channel, id, ok: true, value: {v: 1}}`. A page that is not in a
  frame does nothing. A hello that comes before the page is ready waits until it is ready.
- **Every message carries the token.** A message with another token, from another window, or a second hello is
  dropped with no reply.
- **Calls.** The envelope is `{channel, v: 1, id, call, args}`. The calls are the host API's verbs (above): `set`,
  `emit`, `read`, `on`, `off`, `pause`, `resume`, `restart`, `scene`, `seat`, `clearStorage`, `setPartition` and
  `ladder`. The reply is `{channel, id, ok: true, value}` or `{channel, id, ok: false, error: {code, message}}`. Only
  `read`, `scene` and `ladder` reply with a value. Any other call, or another `v`, is `E-HOST-CALL`. `picture` (10.6) is
  not a frame link call in 2.0: a message is at most 64 KiB. A host that hands in pictures mounts the player in its
  own page.
- **Events.** After `on(name)`, each event comes as `{channel, v: 1, call: "on", name, detail}`. `off(name)` stops it.
  A built-in output's bare name and `hsvg.<name>` are one event: the page sends it once, and the host side gives it
  once to each listener, whichever name it used. `off` of one name keeps the listeners of the other.
- **Size.** A message is at most 64 KiB: the UTF-8 bytes of its JSON (`E-RANGE`).
- **Same rules as the host API.** Each call is the same call as on `window.hsvg`, with the same checks and codes
  (`E-HOST-PRIVATE`, `E-REF-UNKNOWN`, `E-RANGE` and the others above). A page that could not start answers
  `E-HOST-CLOSED`.
- **Closing.** `destroy`, or the page going away, closes the link. The page then says `{channel, call: "bye"}`, and
  the host side ends the link at once.
- **One document per link.** When the frame loads a document again after the hello, the host side holds its calls
  and sends `{call: "ping"}` with no token. The page that holds the link answers `{channel, call: "pong"}`, and the
  held calls go on. With no pong within a short time (one second by default), the link ends. An ended link refuses
  the calls still waiting, and every later call, with `E-HOST-CLOSED`. The new document never gets the token or a
  call. To talk to it, the host opens a new link (`connectFrame`) with a new token.
- **Content sends nothing.** Content never sends messages itself. **[playing]**

## A10.5 Packages (was 10.8)

A **package** is one experience with everything it needs, as one `.hsvg` ZIP or as the same files in a folder. There
is one package format. Its descriptor is `package.json`.

```json
{
  "format": "hsvg/2.0",
  "kind": "package",
  "id": "harbour-sale",
  "about": {
    "title": "Harbour sale",
    "version": "1.2.0",
    "author": "Rain Gear Co.",
    "license": "LicenseRef-Rain-Gear-Ads",
    "preset": "animated-ad",
    "trust": {"digest": "sha256:e40b17aa…"}
  },
  "experience": "experience.json",
  "kits": {"rain-gear": {"version": "3.0.0", "path": "kits/rain-gear/kit.json"}},
  "needs": ["fit"],
  "inputs": [
    {"address": "harbour-sale/headline", "kind": "content", "type": "string", "maxLength": 40,
     "editableBy": ["copywriter"]},
    {"address": "harbour-sale/price", "kind": "content", "type": "string", "maxLength": 8,
     "editableBy": ["marketer", "brand-owner"]}
  ],
  "members": {
    "experience.json": "sha256:3b9a0d51…",
    "scenes/sale/sale.svg": "sha256:c1f4e902…",
    "scenes/sale/sale.tall.svg": "sha256:8d22b7e0…",
    "kits/rain-gear/kit.json": "sha256:61aa09fe…",
    "kits/rain-gear/blocks/offer-block.json": "sha256:f0e3c8b1…",
    "resources/fonts/bitter-700.woff2": "sha256:0a7d2c44…",
    "…": "abridged: every other file the entry reaches"
  }
}
```

| Key | Meaning |
|---|---|
| `experience` | The experience document that plays first. |
| `kits` | Every kit the package carries, by id, with its pinned version and path. |
| `needs` | The union of all capability needs in the package (10.11). |
| `inputs` | The input list: every input exposed at the entry (5.3, A9.5), with kind, type, bounds and `editableBy`; `[]` when there are none. It replaces the earlier package `slots`. The checker recomputes it and refuses a mismatch. |
| `members` | Every other file in the package, by path, with the SHA-256 digest of its exact bytes. |
| `about` | Title, version, author, licence, preset, level and the trust record (A9.3). |
| `findings` | Only when the package was made with the checker's errors accepted (a test build): each `{code, file, path}`. A host refuses such a package. A page packed from it shows that it is not for publishing. |

### The descriptor is the superset of the earlier ones

| Earlier field | In `package.json` |
|---|---|
| `hsvg-experience/1` `format`, `id`, `title` | `format`, `id`, `about.title` |
| `drawing.files`, `chapters`, `media`, `theme` | `members` (drawings, documents, resources) |
| `checksums` | `members` and `about.trust.digest` |
| `capabilities`, `requires`, `modules` | `needs`, with exact versions for modules; their digests in `about.trust.pins` (A9.3) |
| `hsvg-package/1` `name`, `version`, `made_with` | `about.title`, `about.version`, `about.trust.provenance.madeWith` |
| `kind` (ad or mascot), `suits` | `about.preset`, `about.tags` |
| `sizes`, `fluid` | the shapes and sizes of the entry's scenes (7.2) |
| `slots` | `inputs` |
| `moves`, `mascot` | clips and kit content (6.7 and A14.1) |
| `bytes.zip` | dropped: bytes are measured, never asserted (A10.3) |
| Lean `assets`, `dependencies`, `integrity` | `members`, the closure check, `about.trust.digest` |

### Integrity

- Every file except `package.json` appears in `members` exactly once. A missing, extra or repeated member fails
  (`E-PACKAGE-MEMBER`). No undeclared file is ignored (files).
- Member digests cover exact bytes. A mismatch, or a wrong package digest, fails (`E-PACKAGE-DIGEST`, files). A wrong
  `experience`, `kits`, `needs` or `inputs` fails (`E-PACKAGE-DESCRIPTOR`, files).
- A package carries only the files its entry reaches; never `evidence/`, `tests/` or a kit's sample kit experiences. Its
  receipts are kept beside it. Member paths are checked after resolution (2.1).
- The **package digest** is the digest of `package.json` as a JSON document (A9.3): canonical JSON with
  `about.trust.digest`, `review` and `signature` removed, its members as its declared files. It is written in
  `about.trust.digest`, and a signature signs it. Every package carries it.
- Digests detect damage. They do not prove who made a package, that it is safe, or that it may be used.
- **Closure.** Every resource the package's documents name is a member. A font the package relies on but does not
  carry must be named in `needs` as `font:<family>`, so the dependence is disclosed (review).

### Paths and the ZIP profile

The path rules are 2.0 (`E-PATH`). **Experimental (2.1).** The ZIP profile (the member and archive rules after them) is not settled in 2.0. No 2.0 tool proves it, it has no error code, and it may change in
2.1. A 2.0 file may carry its keys.

These rules carry over from the 1.x experience package unchanged:

- Paths use the fixed `portable-names/1` repertoire: forward slashes; segments of ASCII letters, digits, `_`, `-`,
  `.` and fixed precomposed Latin and Greek ranges; at most 240 UTF-8 bytes. `.` and `..` segments, absolute paths,
  backslashes, URLs, drive prefixes, controls, trailing dots and Windows device names fail. Paths that collide under
  the fixed case fold fail, as does a file that is also another file's parent (`E-PATH`, files).
- Members are stored or raw DEFLATE. ZIP64, encryption, multi-disk archives, directory entries, symlinks, extra
  fields, comments and data descriptors fail. Local and central records must agree.
- Readers cap the archive at 16 MiB, each expanded member at 8 MiB, all expanded members at 16 MiB, and the member
  count at 1,024. A `video` member (2.6) may be up to 64 MiB, and video members together up to 256 MiB; the 16 MiB
  archive and expanded caps count every other member. Caps are enforced from headers before decompressing and again
  on the actual output.
- Writers sort member paths, fix timestamps to 1980-01-01, write mode `0644`, use DEFLATE level 9 and write no
  comments. The reference packer gives the same archive bytes for the same files; other writers give the same member
  bytes and digests.
- Tools validate a whole package before extracting it, extract only into a folder that does not exist, and never
  follow links.

## A10.6 Run packed and run served (was 10.9)

An experience runs in one of two ways. Both play the same package with the same player.

**Run packed.** The trusted packer checks the package, then writes **one offline HTML file**: the core player, the
capabilities in `needs`, and every member embedded. The page carries a script-hash Content Security Policy with
network access denied. It opens from `file:` and makes no network requests. Served play and its `network` grant
are a 2.1 draft (`drafts/delivery-2.1.md`). The packer has checked every file, so the page carries the parsers and no checker; a kit experience is
flattened into the form the player plays, with every kit check, pin, seal, right and digest made at pack time, so the
page carries no kit loader (D19). A packed page vouches only for itself:
a host serving strangers' packages checks and packs them itself, one origin per experience (10.4).

**Run served** (a server loads the package at run time, with update, withdraw and A/B content) is a 2.1 draft
(`drafts/delivery-2.1.md`).

## A10.7 Conformance levels (was 10.10)

**Experimental (2.1).** This section is not settled in 2.0. No 2.0 tool proves it, it has no error code, and it may change in
2.1. A 2.0 file may carry its keys.

What a file must say comes in three tiers: **required**, **recommended** and **optional**. A file reaches a level:

- **import-ready**: every required item is present and nothing is wrong or unsafe. A player or portal opens it right.
- **library-ready**: import-ready, and every recommended item is present. It can be shared, searched and reused.

Optional items add motion, editing and search help. The drawing tiers (attributes on parts, places and frames)
are in section 6. For documents, `about` and the trust record need:

| Item | Required | Recommended | Optional |
|---|---|---|---|
| `format`, `kind`, `id` | every document | | |
| `about.version` | kits, rule packs, packages | every document | |
| `about.title` | packages | every document | |
| `about.author`, `about.license` | | every document | |
| `about.description` | | experiences, kits, packages | others |
| `about.trust.provenance` | | every document | |
| `about.trust.review` (at least one entry) | | kits, packages | |
| `about.trust.digest` | packages; sealed definitions in a kit with any review entry (A9.4) | every published document | |
| `about.derivedFrom` | every derived document (A14.3) | | |
| licence and source on a resource | third-party fonts and images | every resource | |
| `about.tags`, `about.preset`, `about.credits`, `about.template` | | | every document |

1. A tool may report the level reached, and list missing recommended items as notes;
   "every document" means every document that carries `about`. A definition inside a
   kit that has no `author` or `license` of its own takes the kit's.
2. `about.level` is an optional claim. A 2.0 checker does not check it. A library
   asks for `library-ready`.
3. **Unknown keys stay errors at every level** (`E-KEY-UNKNOWN`). Levels say how much is declared, never how much may
   be invented.
4. **Open words.** Roles, categories and tags come from lists that grow. A word not in a list is a warning, not an
   error. Structure is fixed.
5. Tools fill in what can be worked out (a label from an id, a binding target from its element) before checking.

## A10.8 Where limits live, and raising them (was 9.8.1)

**One list.** `limits.json` beside the spec lists every format limit: those of this section, the formula budgets
(5.6.6), the resource limits (2.6), the drawing limits (2.11) and the counts the grammars cap. Each limit has an id,
a value, a unit, the section that states it, a reason, and a class:

- **safety**: stops runaway content (loops, runaway formulas, deep nesting). It never changes.
- **capacity**: how big or rich an experience may be. A capacity limit with an `upTo` may be raised, but never past
  `upTo`. One without `upTo` is fixed, and its entry says why.

The grammars mark each limited node with `x-hsvg-limit` and the limit id. The tables of the spec repeat the values
for reading; `limits.json` is the source. A format value changes only by the person's decision, recorded in
DECISIONS.md.

**A host raises, content asks.**

- A host profile's `limits` (A10.1) says how far that host lets content go: a map from capacity limit id to a value
  from the format value to `upTo`.
- An experience's `limits` says how far it needs to go, in the same shape. The run's raised limits are the largest
  value each id has in any experience of the package. A safety limit, a fixed limit or an unknown id is
  `E-KEY-UNKNOWN`; a value outside the format value to `upTo` is `E-RANGE`. **[files]**
- The checker checks the package against the format values, raised where the experience asks. **[files]**
- At mount, the engine admits the package only if the host profile allows every raised limit at least as far as it
  is raised. A host without a profile allows only the format values. Otherwise mounting stops with `E-HOST-LIMIT`.
  **[playing]**
- While playing, the engine applies the raised values the experience asks for, never the host's, so a package
  behaves the same on every host that admits it. **[playing]**
- Budgets (A10.3) still apply and may only be stricter.

```json
"limits": {"soundBytesEach": 1000000, "soundBytesAll": 8000000, "soundMsEach": 180000}
```
