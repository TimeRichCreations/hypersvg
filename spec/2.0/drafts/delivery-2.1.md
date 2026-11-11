# Delivery profiles, exports and served play (2.1 draft)

This is a 2.1 draft. It is not part of HyperSVG 2.0: no 2.0 engine, checker or schema reads it as grammar. A 2.0
file that uses what it describes is refused (`E-DRAFT`, "not in 2.0; a 2.1 draft"), and the message names this draft.

It holds the delivery contracts that are not built: export adapters and the keys they read
(`report`, `endHoldMs`, `clickArea`), served play (update, withdraw, A/B content, signatures at load), the `network`
grant and the `site` storage scope. In 2.0 the packed page is the only output (10.8), and a host reaches the player
through the host API (10.6).

## The `network` grant and the `site` storage scope

- `network`: named requests to addresses the host configures. Reserved in 2.0; no named request is defined.
- `site`: a `storage` scope keyed by the site's origin instead of the page path, for a mascot that follows a visitor
  across a site's pages.

## The click area (was in 10.4)

An experience's `clickArea` names a `url` content field, or is `{"field", "with"}` to pass URL
parameters. The player then puts one press area over the
whole screen, behind every other control; a press on it runs `openUrl` on that field. It needs no shell. Ad adapters map
it to the network's click macro; the field's address is the landing page where the network takes one, and the
network's own landing page wins otherwise. The click area is exempt from `clear` and from "nothing covers a control".


## Exports (was A10.1)

An **export** projects a checked package into another artifact for one host: an ad network's zip, a video, a
learning-platform package, a WordPress block, an AI assistant's scene. The source is never edited in the export. A
change goes to the source, and the export is made again.

An **export request** names the host profile and, per representation axis, the options to make; by default every
`required` size, the default language and the default theme. One output, with one receipt, is made per combination. It is tool input,
not a document: `{"package": "summer-sale/package.json", "profile": "ad", "options": {"shape": ["300x250", "728x90"],
"language": ["en", "de"], "theme": ["harbour-day", "harbour-night"]}}` makes eight outputs. A tool runs the
request (in the reference tools, `hsvg export <package> --profile <id>`) and writes the receipt.

Every export adapter must:

1. take a package that passes the checker, and never change it;
2. name its host profile and run that profile's rules and budgets on the **actual output bytes** (A10.3); an estimate
   is not a pass;
3. map every feature the package uses, or report it as not carried. A feature the output cannot carry fails the
   export when a `must` rule depends on it, and gives a note otherwise;
4. leave out authoring-only rules (give-way steps and rule packs marked authoring-only, section 8);
5. write a receipt (A8.1) with `run: "export"`, adding `adapter` (id and version), `profile`, `output` (the output
   digest), `bytes` (the actual size) and `notCarried` (a list of features with reasons). Its `digest` is the package
   digest;
6. refuse a resource whose `license` is `LicenseRef-Private` or starts with `LicenseRef-Private-`, so a private
   reference picture never leaves (`E-PRIVATE-LEAK`).

Export adapters are plugins (10.11). The spec defines their checked contract, not their code. An export that cannot carry
recorded video (the `media` capability, A2.1) reports each `video` resource in `notCarried`.

| Export | Host profile | Main limits (values live in the profile) | Click and result handling | Must report as not carried |
|---|---|---|---|---|
| Ad network (HTML5 zip) | `ad`, or one per network | `archiveBytes` 150 KiB for `ad` (A10.3); a network profile sets its own | The experience's `clickArea` (10.4) becomes the network's click macro (`clickTag`); behaviour names no URL. The adapter maps `entered`, `firstInput`, `openUrl`, `self:visible` and `self:hidden` (10.4) to the network's measurement of impressions, viewability and clicks; content holds no measurement code and no identifiers. | network, storage, page hooks (AI sources and agent or program seats are refused: the `ad` profile gives no such grant, `E-GRANT`) |
| Video | `video` | `lengthMs`, and the profile's `video` key: `size` (one of the shape axis's sizes), `frameRate`, `captions` (`vtt`, `burned` or both) | Every event link needs an `afterMs` fallback; the export follows the timed path (3.11). The video ends when the last ending scene's lines and non-looping clips end, plus its `endHoldMs` (a scene key, default 0). Control targets and the click area are hidden. Voiced lines play their recordings. A choice scene plays its choice window with the options shown and none picked until the default link fires; an ending's event links need no fallback. | controls, untimed choices, saved memory |
| Learning platform | `scorm-1-2`, `scorm-2004`, `xapi`, `cmi5`, `lti-1-3` | `suspendChars` (SCORM 1.2: 4,096; SCORM 2004: 64,000) | The experience's `report` key maps its results and records to the standard (below). `saved` values and graph memory become the stored state. | network beyond the platform's API; AI seats unless granted |
| WordPress | `wordpress` | `archiveBytes` 16 MiB | Page hooks are marked by the site owner in the block settings (A3.1). Output events become host events. | outside calls and tracking |
| AI assistant host | `assistant` | the host's scene and size limits | An agent fills a seat through host tools (A4.1). Output results return as typed results. | page hooks, custom widgets, network, storage |

**Learning platforms.** An experience meant for a learning platform says what it reports in its `report` key:

```json
"report": {"completed": "completed", "passed": "passed", "score": "score",
           "interactions": {"record": "answers", "id": "question", "response": "choice", "correct": "correct"}}
```

- `completed` and `passed` name boolean output results; `score` names a number output result with `minimum` and
  `maximum`. Each is optional. `interactions` names a record and the row properties that give each interaction's id,
  the learner's response and whether it was right (a boolean). `E-REF-UNKNOWN`, `E-TYPE` (files). A reported score's
  `maximum` is above its `minimum`. `E-RANGE` (files).
- The pass mark is the experience's own: `passed` is its formula. Adapters write no mastery score, so the platform does
  not recompute success.
- Rows are sent when published; results are written when they change and on unmount; the platform's commit runs when
  an ending is entered.

| Standard | Completion and success | Score | Each interaction row | Stored state |
|---|---|---|---|---|
| `scorm-1-2` | `cmi.core.lesson_status`: `passed` or `failed` once `completed` is true and `passed` is reported; else `completed` or `incomplete` | `cmi.core.score.raw`, `.min`, `.max` from the score and its bounds | `cmi.interactions.n`: `id`, `type` `choice`, `student_response`, `result` `correct` or `wrong`, `time` from `atMs` | `cmi.suspend_data`; `cmi.core.lesson_location` is the resume scene; `cmi.core.exit` is `suspend` until an ending is entered |
| `scorm-2004` | `cmi.completion_status`, `cmi.success_status` | `cmi.score.raw`, `.min`, `.max`, and `.scaled` = (raw − min) / (max − min) | as above, with `learner_response` and `result` `correct` or `incorrect` | `cmi.suspend_data`, `cmi.location`, `cmi.exit` |
| `xapi`, `cmi5` | statements `completed`, and `passed` or `failed` | `result.score` with `raw`, `min`, `max`, `scaled` | statement `answered` with `result.response` and `result.success` | one State API document |
| `lti-1-3` | `activityProgress` `Completed`; `gradingProgress` `FullyGraded` | `scoreGiven` = score − min, `scoreMaximum` = max − min | not carried | not carried |

- **Suspend data** is the canonical JSON (A9.3) of `{"stamp": <saveStamp>, "values": {<owner address>/<name>: value},
  "graph": {"counts": {<link id>: n}, "visits": {<scene id>: n}, "resume": {<slot id>: <scene id>}}}`.
  `suspendChars` counts its characters in the worst case the declared bounds and link `max` counts allow (A10.3).
  Over the profile's budget the export fails; nothing is trimmed. A running player whose data would
  pass the limit emits `save:unavailable` and keeps the run in memory.

Other projections (motion to Lottie or CSS, a PNG snapshot) follow the same contract. A motion export states, per
channel, what it maps and what it cannot carry.


## Run served (was in 10.9)

A player on a host page loads the package from a server at run time. This allows:

- **update:** the server serves a new package version; the next load plays it;
- **withdraw:** the server stops serving it; the player shows that it is withdrawn and plays nothing;
- **A/B content:** the server picks which package to serve, by viewer group or data;
- **signatures:** when the host profile requires them, the player verifies the signature (A9.3) before mounting.

Rules for served play:

1. The server checks a package (10.12) before it serves it. The player still checks every member digest against
   `members` before mounting, and refuses a mismatch (`E-PACKAGE-DIGEST`).
2. Only the host fetches packages. The experience itself makes no network requests; the `network` grant is reserved (10.5).
3. A served experience must also pack. Live data inputs carry a bundled fallback (10.7).
4. Loading at run time hides nothing: what is shipped to a viewer can be copied. Security comes from server-side
   checks, rights and signatures (A9.7, A9.3), not from serving.
