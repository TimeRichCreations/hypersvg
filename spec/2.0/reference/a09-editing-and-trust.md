# A9. Editing and trust

This is a reference chapter of the tool reference (`reference/README.md`): for people who build editors, hosts,
packers and checkers. A first experience needs none of it.

It holds the editor protocol in one place: seals, promoted inputs, editor rights, the changes
protocol, the rights table, checking a change, and the trust record.

## A9.1 The rights table

The **rights table** is the one place checked. The checker computes it from the kit's `rights`, the `editableBy` of
every exposed input (the outermost declaration along each promotion chain), the `waivableBy` of every rule (A11.6) and
the seat rows of A4.1. It is never written by hand. Editors, agents, hosts and servers never decide rights any
other way.

```json
{
  "kit": {"id": "rain-gear", "version": "3.0.0"},
  "edit": {
    "harbour-ad/headline": ["copywriter"],
    "harbour-ad/price": ["marketer", "brand-owner"]
  },
  "waive": {"harbour-brand/cta-length": ["brand-owner"]},
  "abilities": {
    "review": ["brand-owner", "reviewer"],
    "publish": ["brand-owner", "marketer"],
    "changeKit": ["brand-owner", "designer"]
  },
  "seats": {}
}
```

The table is per kit, or per experience when there is no kit; `seats` maps each seat id to its `inputs` and `view`
(A4.1).

`hsvg check --rights` prints it. A host that enforces rights derives it with the same checker. A kit version change
(A14.1) takes the earlier kit as `--previous-kit <folder>`, so `E-KIT-VERSION` can compare the two.

## A9.2 Checking a change

### Checks, in order

Nothing is written unless every check passes. Checks run in order; each reports every failure it finds, and a
failing check stops the checks after it. A request changes one document: for a pointer change, `target` is that
document's id, `address` is relative to the experience or kit folder that holds the document
(`blocks/ride-out.json#/inputs/windStrength`), and `expected` is that document's digest. A kit change is several requests, the kit's `about.version` change last; each next
request's `expected` is the previous receipt's `digest`.

1. **Shape.** The request is well formed and within its limits (`E-CHANGE-SHAPE`).
2. **Replay.** If `id` was already used for this target, return its first receipt, pass or fail, and apply nothing.
   The same `id` with different content is `E-CHANGE-SHAPE`.
3. **Revision.** `expected` equals the current digest (edit) or revision (play). Each `old` equals the current value
   (`E-CHANGE-STALE`).
4. **Reach.** Each address resolves (`E-REF-UNKNOWN`) to one of four targets: an exposed input (`@<tag>` reaches one
   language of a text field, 2.9; for a field fed by `words.<key>` the change is written into the target's own words
   file for that language and that resource's `digest` is updated, A9.7); a waiver, `<document id>/waivers` with the entry in `old` and `new` (A11.6); a review, `<document id>/review`
   (append-only, `new` the entry, the digest unchanged); a kit experience's kit pin,
   `<experience id>/kit` (A14.1); or, for a kit change, a document path and JSON pointer
   (`blocks/ride-out.json#/inputs/windStrength`). In an open definition any declared value may be reached; in a
   sealed one only inputs, except by a kit change (`E-SEAL`). Body values are never reachable at play
   (`E-HOST-PRIVATE`). A pointer change adds when `old` is absent and removes when `new` is `null`; a rename is a
   removal and an addition in one request, and one request may hold changes of several kinds.
5. **Type and bounds.** Each `new` has the declared type and lies within the bounds and on the step lattice
   (`E-TYPE`, `E-RANGE`). Values are never clamped. A waiver's `new` is a waiver entry (A11.6); a kit pin's is
   `{"id", "version", "digest"?}`.
6. **Rights.** Edit: the rights table lets `by.right` edit each input address (`E-RIGHTS`); a waiver needs a right
   in the rule's `waivableBy` (A11.6); a kit pin needs `publish` (A14.1); a review needs `review`; a pointer change
   into a kit's documents (a definition, a rule, a right, a renamed input) needs `changeKit`, and into a kit experience or
   an experience made without a kit (links, `start`, `theme`, axis choices, `words`, uses' `into` and order,
   `promote`) needs `edit`. Each refusal is `E-RIGHTS`; a promotion `from` that is unknown or too deep is
   `E-PROMOTE`. Play: the seat's `inputs` allow it
   (`E-SEAT-INPUT`) and the host's grants allow it (`E-GRANT`); the rights table's `seats` rows list each seat's
   `inputs` and `view` (A4.1).
7. **Rules.** All changes are applied to a copy. Every `must` rule of each affected block, rule pack and host profile
   whose proof includes `files` is checked on the copy, budgets included (section 8); the others are `not-run` in the
   receipt and never refuse. A broken rule refuses the request (`E-RULE`, naming the rule)
   unless a waiver covers it. `should` rules add notes. A change never alters the values it asks for: give-way steps
   (A11.5) act on the outputs made from them, and the receipt records any steps the check used.
8. **Apply.** All changes apply at once. At edit time the document gets a new digest and its effective review status
   is recomputed (A9.3). At play time the store commits one transaction.

### The receipt

Every request gets a receipt in the shape of A8.1, with `run: "change"`.

```json
{
  "format": "hsvg/2.0",
  "kind": "receipt",
  "id": "chg-7f3a",
  "run": "change",
  "subject": "document:harbour-ad",
  "digest": "sha256:a91e33c0…",
  "previous": "sha256:5d1c0f9a…",
  "date": "2026-11-04T14:12:00Z",
  "status": "pass",
  "by": {"source": "agent", "right": "copywriter", "who": "agent:rio"},
  "changes": [{"address": "harbour-ad/headline", "old": "Rain? Bring it on.", "new": "Rain? Go!"}],
  "rules": [{"rule": "harbour-brand/cta-length", "result": "pass", "proof": "files"}]
}
```

`status` is `pass` (applied), `reduced` (applied with give-way steps) or `fail` (refused, with an `errors` list of
diagnostics, 10.12). A change receipt is never `incomplete`: rules that are `not-run` never refuse it. The receipt
lists one verdict per check in `verdicts` (`shape`, `replay`, `revision`, `reach`, `type`, `rights`, `rules`,
`apply`, each `pass`, `fail` or `not-run`), and the document's recomputed review status as `verdicts.review`. A
play-time receipt names `document:<experience id>` as its subject and `revision:<n>` as its `digest` and `previous`
(A9.7). A refusal leaves the old state untouched, and its `digest` equals `previous`. Changes inside a
running experience from its own controls and reactions get no receipt; a host may summarise play-time receipts. Receipts are append-only. A host may keep them as its
audit trail; the trail itself is outside the format.

## A9.3 The trust record

`about.trust` is the trust record of a block definition, kit, experience or package. It never grants anything. The
engine reads only three things from it: the digest (seals, A9.4), look reviews (6.2.4) and pins (reviewed code).

```json
"trust": {
  "provenance": {
    "madeWith": ["HyperSVG portal 2.0.3", "trace-builder 1.4.0"],
    "madeBy": ["person:mk", "agent:sol"],
    "sources": ["reference picture, kept outside the package"],
    "inferred": ["robin-hero/wing-left"],
    "substitutions": [{"resource": "display-font", "with": "Inter", "reason": "license"}]
  },
  "review": [
    {"status": "candidate", "by": "agent:reviewer", "date": "2026-11-03", "digest": "sha256:5d1c0f9a…",
     "note": "Every check passes at four sizes."},
    {"status": "accepted", "by": "person:mk", "date": "2026-11-04", "digest": "sha256:5d1c0f9a…",
     "note": "Looked at all four sizes."}
  ],
  "digest": "sha256:5d1c0f9a…",
  "pins": {"chess@0.1.0": "sha256:77e01b2d…"}
}
```

`signature` is absent here: it belongs on packages (below).

A block, kit or package whose effective status is `blocked` is refused at use, pack, export and publish
(review).

### Provenance

- `madeWith`: tools and versions. `madeBy`: people and agents, as `person:<id>` or `agent:<id>`.
- `sources`: what the work was made from, in words. Private paths never appear in a trust record (files).
- `inferred`: paths (2.9) of parts or looks a tool drew that no person has checked, including covered geometry
  (6.2.5). It replaces `data-hsvg-inferred`.
- `substitutions`: every substituted font or asset. A substitute is never claimed as exact.
- `upgradedFrom`: for a file made by the upgrade tool (A13.3): `format`, the source's `id` when it had one, its
  `digest`, for a source of several files with no single digest `files` (base name to the old hash), `from`, in
  words, what the source itself said it came from (a catalog card's `from`), and `report`, the path of the upgrade
  report (A13.3, rule 5).
  `derivedFrom` (A14.3) names only 2.0 sources.
- `notes`: free text on how the work was made (design traits, a reuse recipe), at most 4,000 characters. Private
  paths never appear here either.

### Review status

One list of statuses for blocks, looks, kits and packages:

| Status | Meaning | Who may set it |
|---|---|---|
| `draft` | Being made; may fail checks. | anyone |
| `candidate` | The full checker passes on this digest. | a person or an agent |
| `accepted` | A person has looked at these exact bytes. | a person only, through a right with `review` |
| `blocked` | Not usable; the note says why. | a person or an agent |

Each review entry has `status`, `by`, `date` (ISO 8601), `digest` and `note` (at most 2,000 characters; required for
`blocked`). An optional `of` narrows it to one look or one frame (`"of": "robin-hero/mouth/open"`). Reviews are
append-only. A look whose effective status (below) is `draft` or `blocked` is never selected while playing and is left out
of exports; an editor may still show it (6.2.4).

The **effective status** is computed, never trusted from the file: the last review in the list whose digest equals
the current digest (for a review with `of`, the document's digest). A `blocked` lapses with a change, as `accepted`
does. If none matches, it is `candidate` when the checker passes now and `draft` otherwise. So an accepted item that
changes loses `accepted` until a person reviews it again. An `accepted` review by an agent is `E-TRUST-REVIEW`
(files): the checker reads the `by` prefix only; the host makes sure the name is true (identity, A9.6). An agent
that sets `candidate` or `blocked` works under a right with `review`. The one `accepted` a tool writes is the copy the
upgrade tool carries over when a review survives an upgrade (A13.3, rule 10).

### Digest

- The algorithm is SHA-256, written `sha256:` and 64 lowercase hex digits.
- A JSON document's digest is the hash of one value: the canonical JSON of `{"document": <the document>, "files":
  {<path>: <digest>}}`, then one final LF. The document has `about.trust.digest`, `about.trust.review` and
  `about.trust.signature` removed first; their parent objects stay, even when empty (`"trust": {}`). `files` lists
  every file the document declares (drawings, words, data, resources; the scenes, blocks and kits it names by
  their own document digest; a package's `members`) by its digest, paths relative to the document with `/`, and is
  `{}` when it declares none. `evidence/` is never covered, so storing a
  receipt changes no digest.
- Canonical JSON is the JSON Canonicalization Scheme (RFC 8785): compact, object keys sorted by UTF-16 code units,
  numbers in the ECMAScript form, minimal string escapes, UTF-8.
- Worked example. A rule pack whose `about` is `{"title": "Quiet", "version": "1.0.0", "trust": {"digest": "…"}}`
  and whose one rule is `{"id": "no-sound", "kind": "budget", "measure": "soundBytes", "maximum": 0}` hashes these
  bytes, followed by one LF:

  ```text
  {"document":{"about":{"title":"Quiet","trust":{},"version":"1.0.0"},"format":"hsvg/2.0","id":"quiet-pack","kind":"rule-pack","rules":[{"id":"no-sound","kind":"budget","maximum":0,"measure":"soundBytes"}]},"files":{}}
  ```

  Its digest is `sha256:c70b3e81616e3cba79366ec2d6367473955e766f7c5037cf9d0139bdd5202810`.
- An SVG drawing's or a binary file's digest is the hash of its exact bytes.
- When a digest covers another document, it uses that document's digest, so adding a review never changes a kit's
  digest. A kit's digest covers, by their digests, every document it names: its `blocks`, its own rule packs, its
  resources and words, and its sample kit experiences.
- **There is no cycle.** A kit experience's digest covers its kit through the pin object only (`id`, `version` and the
  `digest` literal when present, A14.1), never through the kit's computed digest. A kit's digest covers its sample
  kit experiences. So a kit experience depends on its kit by name and version, and the kit depends on its kit experiences by digest.
- A sealed definition whose recorded digest differs from the recomputed one is not sealed (`E-SEAL-DIGEST`). Uses
  cannot rely on its proofs, and its effective status falls back as above. A sealing tool checks a definition and
  records its digest (a tool for kit makers; the base's command has no `seal`).

### Reviewed code

Code never lives in content or in packages. SVG and JSON carry no scripts (sections 6 and 2), and `hsvg/0.1` logic
files are gone (10.7). Code comes only from the host: the core player, capability code and registry modules such as `chess`.
Code reaches the engine by one of three contracts (10.7): a **module** is pure code that content names and calls, a **privileged
capability** (`page`, `synth`, `shell`, `media`, `ai`, `live-data`) is reviewed host code that receives
named host ports, and an **engine capability** is built into the engine and reviewed with it. A module runs only when:

1. content names it in `needs` with its exact version (10.11);
2. the trust record pins that version's digest in `about.trust.pins`, so the package records which reviewed bytes it
   was checked with;
3. the host's reviewed lock lists the same digest (the lock is a map from `<name>@<version>` to digest; trusted
   keys are a list of `{id, by, alg: "ed25519", publicKey}`, the raw 32-byte key in base64);
4. the host runs it in the engine's confined executor, made by `modulePort`: only its declared inputs and outputs, no
   host ports, and a step budget kept per player (`E-MODULE-CONFINEMENT`, playing).

**A module is trusted code, not a sandbox (D26).** In 2.0 it runs in the page's own realm. It is admitted only by its
fingerprint (the digest covers every file it runs, imports included) and the host's grant. Its review (no network,
storage, page or clock access) is the guard; the step budget is cooperative. Real isolation (a worker or similar, a
hard time limit) may come in 2.1 or later as an engine-internal hardening, with no format change (D40).

A **privileged capability** is named in `needs` by name only. The host pins it in its reviewed lock under the manifest
version, and it runs only when that lock lists it. It is not confined this way: it receives only the host ports (page,
storage, audio output, network, timers) that the engine has checked against the experience's grants (10.5). An
**engine capability** is named in `needs` by name only and has nothing to pin. Only modules need the confinement rule.

A failure of 1 to 3 is `E-MODULE-REVIEW` (files, playing). A name, a `needs` entry or a pin in content only identifies code the
host already trusts. It never makes code trusted.

### Signed reviews

**Experimental (2.1).** Signing (signed reviews and package signatures) is not settled in 2.0. No 2.0 tool proves it, it has no error code, and it may change in
2.1. A 2.0 file may carry its keys.

A review that affects admission (`accepted` or `blocked`) may be signed as an **attestation**: `{subject digest, status,
of?, by, date, note?}`, signed by a key the host trusts (`keys` in the host profile, A10.1). Each entry of `keys` is
`{id, by, alg, publicKey}`; the signature's `key` names that `id`.

```json
{"status": "accepted", "by": "person:mk", "date": "2026-11-04", "digest": "sha256:5d1c0f9a…",
 "signature": {"key": "k-2026-1", "alg": "ed25519", "value": "<base64>"}}
```

- The bytes signed are the canonical JSON (RFC 8785, see Digest) of `{"subject": <the review's digest>, "status", "of"
  (when present), "by", "date", "note" (when present)}`; `value` is standard base64 with padding. `alg` is `ed25519`
  in 2.0. The signature is not part of any digest.
- A host whose profile has `requireSignedReviews` (A10.1) admits and blocks only by signed reviews: only a signed
  `accepted` admits, and only a signed `blocked` blocks. On such a host, unsigned reviews are advisory. The host checks
  the signature, that the key is trusted and that `by` matches the key. Whether `by` holds the `review` right is
  checked when the review is written, not by the host. A signature that does not verify with a key the host trusts for
  `by` fails, and the review counts as unsigned. `requireSignature` stays the switch for packages (below).
- A later signed review by a right with `review` (A9.6) replaces a signed `blocked`. An unsigned review never does.
  **[playing]**

### Signature

**Experimental (2.1).** The package signature is not settled in 2.0. No 2.0 tool proves it, it has no error code, and it may change in
2.1. A 2.0 file may carry its keys.

- A signature is optional in the open format. A host profile may require one (A10.1). Paid packs require one.
- It signs a package digest (A10.5): the bytes signed are the ASCII text of `over` (`sha256:` and the hex), and
  `value` is standard base64 with padding. `alg` is `ed25519` in 2.0:
  `{"by": "publisher:timerich", "key": "k-2026-1", "alg": "ed25519", "over": "sha256:…", "value": "<base64>"}`.
  `key` names the `id` of an entry in the host's `keys` (A10.1), as it does for a review.
- The host or the served player verifies it before mounting: `over` equals the recomputed package digest, and the
  signature verifies with a key the host trusts for `by`. A failure, or a missing signature where one is required, means
  nothing plays.
- Key lists belong to hosts, not to packages.

## A9.4 Seals (was 4.6)

A block definition may declare `seal`:

- `"open"`: everything in the block may be edited. Use it for drafts.
- `"sealed"`: only the block's declared inputs (content fields, knobs, triggers) may change. The body (body values
  and all behaviour) is fixed. The checker proves the body once, over the whole range of every input (5.6.7, A11.8),
  so every use is proven without checking the body again. Only whole-range proofs from files are reused this way at
  every use. Sampled evidence (fits at listed sizes, play tests, exploring) holds only under the conditions its
  receipt records (sizes, fonts, measurer, host profile, capability versions); under other conditions it is run
  again or reported `not-run` (A11.8, A11.9).

**Default.** A definition without `seal` is `sealed` when a kit lists it and `open` otherwise. A detached copy
(below) and every definition `instantiate` copies (A14.3) is written with `"seal": "open"`.

Example: a sealed offer block in an ad kit. The input declarations are those of 5.3; this section adds `seal` and the
meaning of `editableBy`.

```json
{
  "format": "hsvg/2.0",
  "kind": "component",
  "id": "offer-block",
  "seal": "sealed",
  "drawing": "offer-block.svg",
  "inputs": {
    "headline":  {"kind": "content", "contentType": "text", "type": "string", "maxLength": 40,
                  "initial": "Rain? Bring it on.", "editableBy": ["copywriter"]},
    "price":     {"kind": "content", "contentType": "text", "type": "string", "maxLength": 8,
                  "initial": "£24", "editableBy": ["marketer"]},
    "badgeTilt": {"kind": "knob", "type": "number", "minimum": -8, "maximum": 8, "step": 1, "initial": 0,
                  "editableBy": ["designer"]},
    "pulse":     {"kind": "trigger"}
  },
  "outputs": {"pressed": {"kind": "event"}}
}
```

### What a sealed block must not do

1. Its body must not read or write anything outside the block except through its inputs, its places, its outputs,
   granted actions (section 10), the ambient inputs (5.5) and its kit's words, data and resources. This is the liftable check: a sealed block can be lifted into any container. An
   outside reference is refused with `E-SEAL-LEAK`, naming the reference (files).
2. A sealed definition in a kit that has any review entry (`candidate` or `accepted`) records its own digest in
   its `about.trust.digest` (A9.3); the kit's recorded reviews decide this, not its computed status. A missing or wrong digest is `E-SEAL-DIGEST` (files). In a draft kit a seal needs no
   digest yet; a recorded digest that does not match still unseals.

### What may change in a sealed use

A use mounts a definition in a place and gives its inputs (`use`, `into`, `with`). For a sealed definition:

| Change at the use | Allowed |
|---|---|
| An input value, within its type and bounds, by a right named in `editableBy` (A9.6) | yes |
| The place the use is mounted in (`into`) and its order among sibling uses | yes |
| A selection along a representation axis the definition declares: shape, layout, content tier, language, a look given as an input, theme (section 7) | yes |
| A per-use lock on a knob, preferred or locked (section 7) | yes |
| Promoting an inner input to the container (A9.5) | yes |
| A body value; any reaction, machine, action, clip, binding or effect | no |
| The definition's drawing, parts, places, rules or outputs | no |
| An input's type or bounds, wider or narrower | no |
| A rule added inside the block | no; add it to the container (section 8) |

A refused change gets `E-SEAL`, with the address of the use and of the definition (files).

### Changing the body of a sealed use

"Fixed means fixed." There are exactly two ways:

1. **Edit the definition.** This makes a new kit version (A14.1). Every use of the definition is checked again.
2. **Detach the use.** The use becomes an open copy of the definition, local to the container, with
   `about.derivedFrom` set (A14.3). The copy no longer shares the definition's proof, digest or reviews.

An open definition is checked as a whole at every use. Its guarantees hold only where that use's check passes.

## A9.5 Promoted inputs (was 4.7)

A container chooses which inputs of the blocks inside it it exposes as its own. It lists them in `promote`.
Everything else stays sealed at the value its use gives.

```json
{
  "format": "hsvg/2.0",
  "kind": "scene",
  "id": "harbour-ad",
  "drawing": "harbour-ad.svg",
  "uses": [
    {"id": "offer", "use": "offer-block", "into": "offer-slot", "with": {"badgeTilt": 4}}
  ],
  "promote": [
    {"from": "offer/headline", "as": "headline"},
    {"from": "offer/price", "editableBy": ["marketer", "brand-owner"]}
  ]
}
```

1. `from` is the path `<use id>/<input name>` of an input of a direct child use (2.9), or, in an experience,
   `<scene id>/<input name>` of a scene in its story graph. A deeper input is reachable only if every container on
   the way promotes it. Control carries up the nesting one level at a time (files).
2. The promoted input appears on the container's inputs face, named `as` (default: the inner name). It keeps its
   `kind`, type, bounds and `initial`. Promotion never widens or narrows bounds (files). The promote entry may carry
   its own `initial`: that is the value the container gives the inner input, and an edit to the promoted input writes
   it there.
3. A promoted name must not collide with the container's own inputs or another promoted name (`E-PROMOTE`, files).
4. A promoted input must not also be given in the use's `with`. It has one source (`E-PROMOTE`, files).
5. `editableBy` on the promote entry is the container's decision. Without it, the inner list is copied. Every right
   named must be declared in the container's kit (`E-RIGHTS-UNKNOWN`), so a list copied from another kit's block must
   be rewritten; rights never map between kits. A list that adds a right the inner declaration of the same kit did not
   name gets the warning `W-RIGHTS-WIDEN` (files): in the example above, `brand-owner` on `price` warns.
6. Changes address the promoted input at the container (`harbour-ad/headline`), never the inner path. A change that
   addresses an inner input directly is refused with `E-SEAL`; the fix names the promoted address (files, playing).
7. An input that no container promotes cannot be changed from outside: not by editors, seats, hosts or servers. A
   kit experience's `with` values are the kit experience's own content, so they follow rule 8 instead.
   A settings item may name a knob only once it is on the experience's inputs face, declared there or promoted to it.
8. **Where an edit is written.** An edit to an input writes the value where that input gets it: a promoted input's
   value in the promote entry's `initial`; a direct use's input in that use's `with`; a definition's own input in
   its `initial`. In a kit experience, a value is in the `with` of a kit definition's use (address `<experience>/<scene
   key>/<input>`), or, for a kit input, in the kit experience's top-level `with` (address `<experience>/<input>`). `old` and
   `new` are literal values; the tool writes the quoted form into `with`. An input whose current `with` is not a
   literal cannot be edited (`E-RIGHTS`). These are
   the addresses the rights table lists for a kit experience.

## A9.6 Editor rights (was 9.9)

Editor rights say what an editor may change. They are about making: save and publish. Seats are runtime
participants (A4.1). A person's job in a team is not a role: *role* means a part's job (section 6).

### Rights are declared per kit

Each kit declares its rights; an experience made without a kit may declare its own `rights` the same way. The
recommended starter list has five:

```json
"rights": {
  "brand-owner": {"label": "Brand owner", "may": ["edit", "review", "publish", "changeKit"]},
  "designer": {"label": "Designer", "may": ["edit", "changeKit"]},
  "copywriter": {"label": "Copywriter", "may": ["edit"]},
  "marketer": {"label": "Marketer", "may": ["edit", "publish"]},
  "reviewer": {"label": "Reviewer", "may": ["review"]}
}
```

- Right ids are kebab-case, unique in the kit, at most 32 per kit. A kit may rename, drop or add rights (files).
- `may` lists abilities from this closed list:

| Ability | Lets the right |
|---|---|
| `edit` | change input values whose `editableBy` names this right |
| `review` | add a review to a trust record (A9.3) |
| `publish` | publish a package (section 10) or move a kit experience's kit pin (A14.1) |
| `changeKit` | change definitions, rules, rights, themes or resources, which makes a new kit version. A pointer change (A9.2, check 4) passes check 6 only with this ability; waivers and kit pins have their own rights there. |

Waiving a rule is not a kit-wide ability. Each rule names the rights that may waive it in `waivableBy` (A11.6).

### `editableBy` on each input

- Each content field and knob may carry `editableBy`, a list of right ids (5.3).
- A missing or empty list means no editor may change the value. Only a kit change (`changeKit`) can.
- Triggers have no stored value and carry no `editableBy`.
- A knob shown to the player is a setting (5.3.2). Changing it at play time is a seat's change, checked by grants
  (section 10), not by editor rights. A settings item's `when` must agree: `"make"` needs a non-empty `editableBy`
  (`E-SETTING`, files).

### Enforcement

- **On save.** Every saved edit is a change request (A9.7) with the editor's right. Rights are check 6 (A9.2).
- **On publish.** The publisher's right has `publish`. The full checker passes (section 10). Where a host holds the
  documents, every change since the last published version has a receipt that names a right allowed at that time.
- **Hosted use.** The server holds the documents. It binds each connection to a verified identity and each identity
  to rights. It applies the changes protocol itself. Checks in a browser editor are a convenience, never the
  enforcement.
- **Local files.** Anyone who holds the files can edit them. Rights are then declarations the checker can audit
  (`hsvg check --changes old/ new/ --as copywriter`), not a lock. Security comes from where rules are enforced and who
  may publish, not from the file.
- **Identity.** Names in files never establish identity. The host binds identities to rights.

## A9.7 The changes protocol (was 9.10)

Every change, from any source, passes the same checks (1.1, principle 4). One request shape is used by editors, AI
agents, HTML widgets, the host API, servers and tests.

- An **edit-time** change (`"at": "edit"`) changes a document and makes a new revision of it.
- A **play-time** change (`"at": "play"`) changes a running experience's store, in one transaction (9.2).

The checks a change passes, in order, and the receipt it leaves are in A9.2. The core names them by number: check 4
is reach (the address resolves) and check 6 is rights.

### The change request

```json
{
  "format": "hsvg/2.0",
  "kind": "change",
  "id": "chg-7f3a",
  "at": "edit",
  "target": "harbour-ad",
  "expected": "sha256:5d1c0f9a…",
  "by": {"source": "agent", "right": "copywriter", "who": "agent:rio"},
  "reason": "Shorter headline for the 320x50 size",
  "changes": [
    {"address": "harbour-ad/headline", "old": "Rain? Bring it on.", "new": "Rain? Go!"}
  ]
}
```

| Field | Meaning |
|---|---|
| `id` | Request id, kebab-case, unique per target. A retry with the same id returns the first receipt and applies nothing. |
| `at` | `edit` or `play`. |
| `target` | The document id (edit) or the running experience's id (play). |
| `expected` | Edit: the digest of the document the request was made against; required. Play: the store revision (an integer the engine adds one to at each committed transaction); optional. |
| `by.source` | `editor`, `agent`, `widget`, `host`, `server`, `seat` or `test`. |
| `by.right` | Edit: the editor right used. Play: the seat id (A4.1), or absent for the host. |
| `by.who` | The authenticated identity: `person:<id>`, `agent:<id>`, `server:<id>`, `host`, `seat:<id>`, `widget:<name>` or `test`. |
| `reason` | Plain text, at most 500 characters. Required at edit time. |
| `changes` | 1 to 256 items, each with `address` (section 2), `old` and `new`. Firing a trigger has `new: null` and no `old`. |

`by` is filled by whoever authenticated the source. A value supplied by the requester itself is replaced, never
trusted. The change tool takes the authenticated `by` from its flags (`--right`, `--who`, `--source`); without
them it refuses the request (`E-RIGHTS`), since a request alone has no rights. A waiver (A11.6) is saved through this protocol like any other edit.

- **Play-time receipts.** A play has no document digest. Its receipt names the subject `document:<experience id>`
  and writes the store revision as `revision:<n>` in `digest` and `previous`. A play request's `expected` is an
  integer.
- **Words.** A change to a field whose value is fed by `words.<key>` addresses one language with `@<tag>`
  (`harbour-ad/headline@de`). It is written into the target's own words file for that language (2.9), and that
  resource's `digest` (5.3.1) is updated. Every place that reads the word changes with it. Without `@<tag>` such a
  field is not a literal and the change is refused (`E-RIGHTS`, A9.5 rule 8).

### One path for every source

| Source | How it uses the protocol |
|---|---|
| Editor (the portal or another tool) | Each saved edit is one edit-time request. |
| AI agent (MCP or WebMCP tools) | Each tool call is one request. The tool never writes files any other way. |
| Declared HTML widget (A6.1) | A `form` sends play-time requests; `apply: confirm` sends all items as one request. |
| Custom HTML widget | Only through the host API, within its `widgets` grant (10.5). |
| Host API (`player.set`, 10.6) | One play-time change with source `host`. The refusal is thrown before any write. |
| Server (data feed, dynamic content, hosted editor) | Edit or play requests with a `server:` identity. |
| Test harness (A8.5) | Play-time requests with source `test`. |
| Controls and reactions inside the experience | Already inside a transaction (9.2). Type, bounds and rules are checked the same way; editor rights do not apply. |

A tool that writes a document by another path does not conform (review).
