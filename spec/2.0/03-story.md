# 3. The story

This section says how scenes are joined into an experience by its story, how time runs, and how scenes are grouped
into chapters. It builds on section 1: a scene is one moment, and an experience links scenes in a story graph.
Decisions 5 and 6 are binding here: one engine clock per experience, and links owned by the graph.

Rules end with the check that proves them: **[files]** (the checker, from the files alone), **[playing]** (the
engine at run time, or a play test), **[review]** (a person). Every code is in `errors.json`.

## 3.1 The story graph

The **story graph** belongs to the experience document, under `story`. Its nodes are scenes. Its edges are
**links**. Scenes never name other scenes: a scene reports an **outcome**, and the graph decides where that leads.

| Key | Meaning | Example |
|---|---|---|
| `start` | Required. The first scene, or an ordered list of `{to, when}` (3.8) | `"start":"intro"` |
| `scenes` | Required. Scene id to scene file, or to a use of a kit definition (A14.2) | `"scenes":{"intro":"scenes/intro/scene.json"}` |
| `links` | Ordered list of links (3.2) | see below |
| `ends` | Optional. Scenes that end the experience; every scene with no way out is an ending anyway (3.8) | `"ends":["ending"]` |
| `resumeAt` | Scenes a returning player may resume at (3.8) | `"resumeAt":["hub-map"]` |
| `lifetime` | How long link counts, visit counts and the resume scene last: `run` (default), `session` or `saved` (5.1.2) | `"lifetime":"saved"` |
| `endless` | `true` when the experience has no ending (a website mascot, a kiosk); default `false` | `"endless":true` |
| `chapters` | Named groups of scenes; an ordered chapter has built-in Next and Back (3.12) | see 3.12 |

A trimmed example from Robin's Grand Delivery:

```json
{
  "format": "hsvg/2.0",
  "kind": "experience",
  "id": "robins-grand-delivery",
  "shell": "shell/robin-screen.json",
  "story": {
    "start": "intro",
    "lifetime": "saved",
    "scenes": {
      "intro": "scenes/intro/scene.json",
      "hub-map": "scenes/hub-map/scene.json",
      "ride": "scenes/ride/scene.json",
      "stop-harbour": "scenes/stop-harbour/scene.json",
      "fix-tyre": "scenes/fix-tyre/scene.json",
      "ending": "scenes/ending/scene.json"
    },
    "ends": ["ending"],
    "resumeAt": ["hub-map", "stop-harbour"],
    "links": [
      {"id": "intro-begin", "from": "intro", "on": "begin", "to": "hub-map", "transition": "fade", "transitionMs": 300},
      {"id": "hub-harbour", "from": "hub-map", "on": "pickStop", "when": "event.stop === 'stop-harbour'", "to": "stop-harbour"},
      {"id": "hub-ride", "from": "hub-map", "on": "pickStop", "to": "ride", "carry": {"destination": "{{ event.stop }}"}},
      {"id": "harbour-onward", "from": "stop-harbour", "on": "onward", "to": "ride"},
      {"id": "harbour-flat", "from": "stop-harbour", "on": "flatTyre", "to": "fix-tyre", "visit": true},
      {"id": "tyre-back", "from": "fix-tyre", "on": "fixed", "return": true, "when": "canReturn"},
      {"id": "tyre-alone", "from": "fix-tyre", "on": "fixed", "to": "hub-map"},
      {"id": "ride-finish", "from": "ride", "on": "allDelivered", "to": "ending"},
      {"id": "screen-map", "from": "robin-screen", "on": "map", "to": "hub-map"}
    ]
  }
}
```

Rules:

- Every scene id is kebab-case. A scene given by file has its document's id as its key; a scene that is a use of a
  definition (A14.2) has its own key, such as `banner` for a use of `bakery-banner`. A one-scene story needs no `links`. Every `from` and `to` names a listed scene; a `to` may
  also name an ordered chapter (3.12), and a `from` the experience's shell (10.1). Scene ids, chapter ids and the shell id
  share one namespace (`E-ID-DUPLICATE`). **[files]**
- An experience with one scene still has a story: that scene, which is its ending (a static banner). An `endless`
  story (an ambient mascot, a kiosk) has no ending: its scene stays until the host closes the experience (10.6).
  **[files]**
- A scene may be listed once. Two nodes that show the same drawing are two scene documents, or two uses of one
  scene definition. Any experience may list a scene as a use, `"q1": {"use": "question", "with": {"row": "q1"}}`,
  of a definition in its `blocks` or its kit (A14.2). Five question screens are five uses of one definition, or one
  scene that steps through a data table. **[files]**

## 3.2 Links

A link is one edge. It fires in exactly one of three ways: **on** an event, **after** a time, or as a **choice**
someone picks.

| Key | Meaning | Example |
|---|---|---|
| `id` | Optional (2.1 rule 4); required on a choice link and on a link with `max`. Kebab-case, unique in the experience (`E-ID-DUPLICATE`) | `"id":"harbour-onward"` |
| `from` | Required. The scene (or the shell) the link leaves | `"from":"stop-harbour"` |
| `to` | The destination scene. Exactly one of `to` and `return` | `"to":"ride"` |
| `return` | `true`: resume the scene that visited this one (3.7). A return link takes no `carry`; its `transition` applies | `"return":true` |
| `on` | Fires when this event happens while `from` is mounted (3.3) | `"on":"onward"` |
| `afterMs` | Fires this many milliseconds after `from` entered, on its local clock (3.4) | `"afterMs":2500` |
| `choice` | Offered as an option; the value is its label template (3.5) | `"choice":"{{words.toHarbour}}"` |
| `when` | Formula; the link is eligible only while it is true. Default true | `"when":"score >= 3"` |
| `carry` | Destination input name to value, evaluated when the link fires. A formula, text in single quotes (D36, 5.6.1). A name that is not an input of the destination is `E-REF-UNKNOWN` | `"carry":{"destination":"event.stop"}` |
| `max` | The link fires at most this many times within the graph lifetime (1..1024) | `"max":2` |
| `visit` | `true`: suspend `from` instead of ending it (3.7) | `"visit":true` |
| `transition` | `cut` (default), `fade` or `slide`; `fade` and `slide` need `transitionMs` 1..2000. `slide` moves the new scene in from the end side (the right in a left-to-right language) and the old one out; `slideFrom: "start"` reverses it. Under reduced motion a `slide` is a `cut`, and a `fade` is also a cut. A fade overlaps: the new scene's clock starts when the link fires, and the leaving scene is shown fading out over it but takes no input and runs nothing | `"transition":"fade","transitionMs":300` |

Exactly one of `on`, `afterMs` and `choice`, and exactly one of `to` and `return`, is required (`E-KEY-REQUIRED`,
`E-KEY-CONFLICT`); `visit` with `return`, and `carry` with `return`, conflict (`E-KEY-CONFLICT`); `fade` without
`transitionMs`, and `max` or `transitionMs` out of range, are `E-KEY-REQUIRED` and `E-RANGE`. **[files]**

**Eligibility.** A link is eligible when its `from` is mounted (the scene in its stage slot, or the shell), its `when`
is true, its `max` is not used up, and every condition an add-on adds holds (the `page` add-on: the hooks a
destination's entry names are found). `when` and `carry` are formulas (section 5). They read, in this order: the `event` payload of the
firing event, the `from` scene's interface (its inputs and declared result outputs, never its body), then the
experience's values, then the ambient inputs (5.5) such as `canReturn`. A name found in two of these places is refused
(`E-NAME-SHADOW`). **[files]**

**Selection.** Links are tried in list order. For one event, at most one link fires: the first eligible link whose
`from` and `on` match. **[playing]**

**Fallback.** Among the links that share one `from` and one `on`, the last must have no `when` and no `max`, so an
outcome that has links always goes somewhere (`E-STORY-FALLBACK`). This rule is for `on` links; choice links have
their own (3.5), and timed links need none. **[files]**

**Carry.** `carry` writes the destination's inputs before its entry actions run. Every carried name must be a declared
input of the destination; an input without `initial` (5.3) must be carried (`E-KEY-REQUIRED`). A scene that can be
entered without a link (in `start`, in `resumeAt`, or a step of an ordered chapter) gives every input an `initial`
(`E-KEY-REQUIRED`). Carried values are not stored: after a reload, a resumed scene starts from its `initial`s.
Values are checked by type and bounds like any other change (section 5); a failed check stops the link with
`E-TYPE` or `E-RANGE` before the source scene is touched. **[files]** for names and static types, **[playing]** for values.

**Firing.** When a link fires, the engine does these steps in one transaction:

1. Evaluate `carry`.
2. In the stage slot: if `visit` is true, suspend the scene
   mounted there (3.7). Otherwise end it, running its exit actions, then end every suspended scene in that slot's
   visit stack, newest first, each with its own exit actions. Queued events of ended scenes are discarded; those of a
   suspended scene are kept and delivered on return. Scenes in other slots, and the shell, are never ended by a
   link.
3. Count the link (for `max`).
4. Enter the destination fresh: create its values, write carried inputs (`carry` overrides a use's `with` for the
   same input), start its local clock (3.10), run its entry actions, settle, and request its first paint.
5. Report the experience output `entered` with `{slot, scene, link}`; if the destination is in `ends`, report `ended` with
   `{scene}` as 3.8 says.

**A scene is always shown.** A link from a scene never fires before that scene's first paint; a link from the shell
never fires before the experience's first paint. "Settle" in the firing steps means: run queued events until the
queue is empty (9.2). An outcome reported
during entry is held; after the first paint, its link fires as a new transaction (9.2). This keeps every scene a real moment and stops
zero-time loops. **[playing]**

## 3.3 Outcomes and event links

A scene reports an **outcome** by emitting an event (5.15.1). Any output event of a scene may be an outcome; the scene
does not know where it leads.

**An event a link hears is an output (D31.4).** When a story link names an event that its `from` scene emits, that
event needs no `outputs` entry: the checker infers a payload-free output event. So changing scene takes two pieces,
an `emit` and a link. This holds for scenes only. A component keeps declaring its outputs, because its parent hears
them. An event with a payload is still declared, so the payload is typed. **[files]**

```json
{"on": {"game.onward": [{"id": "ride-onward", "actions": [
  {"id": "next-route-stop", "set": "routeStop", "to": "min(4, routeStop + 1)"},
  {"id": "report-onward", "emit": "onward"}
]}]}}
```

Here the scene `stop-harbour` relays its `game` component's `onward` event as its own outcome. Links never reach
inside a scene: a component's events become outcomes only when the scene relays them (decision 1). **[files]**

An `on` name resolves to exactly one of:

| Source | Written as | Example |
|---|---|---|
| An output event of `from` (a scene or the shell) | its name | `"on":"onward"` |
| An output event of the shell, for a link from a scene | `shell.<event>` | `"on":"shell.next"`: one Next button in the shell drives every slide that has such a link |
| A trigger on the experience's inputs face (a host input) | its name | `"on":"next"` |
| The player's own visibility signal (10.4) | `signal:self:visible`, `signal:self:hidden` | `"on":"signal:self:hidden"` |
| An event of an add-on, heard while `from` is mounted (door 2, chapter 12) | `<addon>:<event>` or `<addon>:<event>:<subject>` | `"on":"lines:ended:narration"`, `"on":"media:ended:intro"` |

A name that is both an output of `from` and an experience trigger is refused (`E-NAME-SHADOW`). An `on` name that is
none of these is refused (`E-REF-UNKNOWN`). **[files]**

**Order.** An outcome queues like any emitted event (section 5). When it is taken from the queue: the scene's own
reactions run first (they may write the experience's values, 5.1.3), then the graph picks a link. So the scene may
record a result before it ends, and `when` sees that write. If one transaction emits two
linked outcomes, the first fires its link and the second is discarded with the scene. **[playing]**

An exit action list may not emit an outcome (`E-NAVIGATION`). **[files]**

## 3.4 Timed links

A **timed link** has `afterMs`. It fires when the `from` scene's local time reaches its value.

- `afterMs` is a number or a formula, evaluated once at the scene's entry, in 1..3600000 ms (`E-RANGE`); a formula
  reads names as `when` does (3.2). **[files]**
- `afterMs` counts on the scene's local clock, so pause and speed (3.10) apply. A suspended scene's
  timed links wait with its clock and continue after return. **[playing]**
- `when` is tested only at the deadline. If it is false then, the link is used up for this entry; it does not fire
  later. **[playing]**
- Several timed links from one scene fire in deadline order; at equal deadlines, list order. At an equal engine time,
  timed links of every owner run after all other deadlines (3.10). **[playing]**
- Timed links keep their timing under reduced motion. **[playing]**
- A timed link is a time limit for a person: its time is multiplied by the person's `timeLimits` setting (5.5, 10.13),
  and 0 holds it off. **[playing]**
- A timed link from the shell counts on the shell's local clock (from the start of the run). **[files]**
- A link that waits for a spoken line is not a timed link. It hears the `lines` add-on's event
  `lines:ended:<line>` (3.3); the earlier key `afterLine` is gone, and the upgrade tool rewrites it.

## 3.5 Choice links

A `choice` link is offered as an option. Picking it fires it.

- **Label.** The `choice` value is a text template (5.7); the full label is the option's accessible name.
- **Who shows and picks.** The core does not draw choices. An add-on shows the eligible choices and lets a person or a
  seat pick one by its link id: the `widgets` add-on's `choices` widget, or the `seats` add-on. A scene with choice
  links and nothing to show them is refused (`E-STORY-CHOICE-PLACE`). Drawn places for choices inside a scene
  (`choiceRegion`, `choicesAtMs`) are a 2.1 draft (`drafts/choice-places-2.1.md`, grammar in
  `drafts/choices-2.1.json`); a 2.0 file that uses them is refused with `E-DRAFT`. **[files]**
- **Limits.** In 2.0 a scene has at most 16 choice links (`E-RANGE`). A choice link needs an `id`, because it is picked by
  it. **[files]**
- **Eligibility** is evaluated when the option is shown and again when it is picked. An ineligible choice is hidden
  and disabled. **[playing]**
- **Fallback.** A scene with choice links must also have a way on when none is eligible: a choice link without
  `when` and `max`, or an `on` or timed link from that scene (`E-STORY-CHOICE-FALLBACK`). **[files]**
- Picking a choice interrupts the scene's unfinished clips; they stop with the scene's exit. **[playing]**

## 3.6 Bounded counts

`max` bounds how often a link fires. Counts last for the graph lifetime (3.8). When a link's count reaches `max`, it
is no longer eligible, and the next link in order is tried. A link with `max` cannot be a fallback.

**Visit counts.** `visits` is a built-in read-only map (5.5): `visits['quiz']` is how many times the scene `quiz` has
been entered within the graph lifetime (3.8), counting fresh entries, not returns. The engine keeps it with the link
counts, and `resetSaved` clears both. A scene that was never entered reads 0; a key that is not a scene id is
`E-REF-UNKNOWN`. Start and resume entries count as visits. This is how the upgrade tool converts the earlier
portal story files' visit counts (A13.10): `visits['quiz'] >= 2`. **[files]**, **[playing]**

## 3.7 Visits and returns

A link with `visit: true` **suspends** its `from` scene and enters the destination. A link with `return: true`
**resumes** the scene that visited. This carries the `hsvg/0.1` visit contract forward unchanged in meaning.

- **The stack.** Each stage slot has its own visit stack of at most **16** suspended scenes. A visit that would make
  17 stops with `E-RETURN`. **[playing]**
- **Suspend keeps everything:** local values, machine states, the remaining time of timers and timed links, clip
  positions, component uses, seeds, focus and variants. It releases holds and cancels drags. It does not run exit
  actions. The suspended scene's local clock stops. **[playing]**
- **The visited scene** enters fresh. It reads the experience's current values; its writes to them remain after
  return.
- **Return** ends the visited scene with its exit actions, restores the caller without entry actions, updates
  bindings that read changed values, and restarts the caller's clock where it stopped. The caller then receives the
  built-in event `returned` with payload `{scene}`, the visited scene's id (5.12). It runs through ordinary reactions
  before time advances. A visited scene that must report more writes an experience value before it returns.
  **[playing]**
- **Any other link** from any scene in the slot ends the whole stack, newest first, with exit actions (3.2). **[playing]**
- `canReturn` is true while the slot's stack is not empty. A return link is ineligible while the stack is empty, so
  it needs a fallback link from the same scene and event unless every way into its scene (links, `start`,
  `resumeAt`, chapter steps) is a visit (`E-STORY-RETURN`). **[files]**
- For the graph rules (3.9), a return link is an edge to every scene that has a visit link into its `from`.
- A cycle made only of visit links is refused (`E-STORY-VISIT-CYCLE`); the longest chain of visit links anywhere in
  the graph must be at most 16. **[files]**
- Sounds are not snapshots: they do not resume or replay on return.

**Focus** follows the `hsvg/0.1` rules: after a plain link, the scene's `firstFocus` control (a scene key) if set and
usable, else the first usable control of the new scene; after a visit,
the visited scene's first usable control; after a return, the control whose activation started the visit if still
usable, else the caller's previous control, else its first. Focus moves only if it belonged to the player. **[playing]** The engine builds the first rule: on every new stage
scene, focus goes to `firstFocus` if usable, else to the first usable control. The rules after a visit and a return
are not built yet. A `firstFocus` that names no control of the scene is `E-REF-UNKNOWN`, with the list of its
controls. **[files]**

## 3.8 Start, resume and endings

**Start.** `start` is a scene or ordered chapter id, or an ordered list of `{to, when}` whose last entry has no `when`
(else `E-STORY-FALLBACK`). The first true entry wins. A start `when` reads the experience's values and the ambient
inputs. A start or resume entry reports `entered` with `link: ""`. The list form
replaces the earlier portal story files' entry routes ("returning visitors see a different intro"):

```json
"start": [{"to": "welcome-back", "when": "visits['intro'] > 0"}, {"to": "intro"}]
```

With the graph lifetime `saved`, `visits['intro']` remembers earlier runs.

**Graph lifetime.** `lifetime` sets how long link counts, visit counts and the last resume scene last, with the
lifetimes of 5.1.2: `run` (until the experience is closed or restarted), `session` or `saved`. `session` and `saved` need the storage
grant and follow the same keys, restore and failure rules as values; invalid stored data is dropped with
`save:invalid`, never guessed. The visit stack is never stored.

**Resume.** Entering a scene listed in `resumeAt` records it as its stage slot's resume scene. When the player mounts
and the graph lifetime still holds a resume scene, the engine enters that scene fresh instead of `start`. With the
graph lifetime `run`, nothing survives to the next mount, so `resumeAt` only matters with `session` or `saved`. Restart (the
`player.resetSaved`) clears the stored link counts and resume scene with the `session` and `saved` values. Entering an
ending clears the resume scene, so a finished tour or lesson starts again from `start` on the next mount; a `start`
entry that tests `visits` or a saved value can then skip it.

**Endings.** `ends` is optional (D31.4). Without it, every scene with no outgoing link (counting the shell's links
for its slot) is an ending. With `ends` written, the endings are the scenes it lists, which may still have links
("play again"), and a scene with no way out that `ends` does not list is a dead end (`E-STORY-DEAD-END`). Entering an ending reports the experience output `ended` with `{scene}`: at
entry when no timed link from it has a deadline or a count left, otherwise when the last of them is used up; hosts
and records hear it. So an animated ad whose end card loops back
reports `ended` only on its last pass. An ending may still have links ("play again").

## 3.9 Graph validity

The checker proves these from the files. It treats every `when` as possibly true; it does not assume a condition will
ever change. Behaviour that only playing can reveal is covered by play tests (A8.5).

| Rule | Meaning | Code | Check |
|---|---|---|---|
| Reachable | Every scene is reachable from some `start` entry through links | `E-STORY-UNREACHABLE` | [files] |
| No silent dead ends | Without `ends`, a scene with no way out is an ending (3.8). If it emits an event that no link and no reaction hears, the checker warns: a link is likely missing. With `ends` written, a scene with no way out that is not listed is refused; the first finding folds in what follows from it (unreachable scenes, no ending). With `endless`, a scene stays until the host closes the experience (10.6) | `W-STORY-UNHEARD`, `E-STORY-DEAD-END` | [files] |
| Can end | From every scene, some ending is reachable through links without `max`, so an end remains when every bound is used up. Skipped when `endless` is true | `E-STORY-NO-END` | [files] |
| Endings exist | Some scene is an ending unless `endless` is true. When every scene has a way out and no `ends` is written, this says so | `E-STORY-NO-END` | [files] |
| Bounded timed loops | Every cycle made only of timed links contains a link with `max` | `E-STORY-LOOP` | [files] |
| Outcomes exist | Every `on` names an event of `from` that some action or control emits (declared or inferred, 3.3), a trigger, a granted signal or an add-on's event | `E-REF-UNKNOWN` | [files] |
| Fallbacks | 3.2 and 3.5 | `E-STORY-FALLBACK`, `E-STORY-CHOICE-FALLBACK` | [files] |
| Returns and visits | 3.7 | `E-STORY-RETURN`, `E-STORY-VISIT-CYCLE`, `E-RETURN` | [files], [playing] |
| Scene shown | No link fires before its scene's first paint | (engine rule) | [playing] |
| No stuck scene | Run with no input for 60,000 ms of engine time (or the host profile's `lengthMs` budget), every scene reached either leaves or ends; otherwise it is stuck. Waiting on a control, choice, seat input, host trigger or granted page signal is not stuck | none | [review] |

Event cycles that wait on a seat (a hub the player returns to) are allowed: the person drives them. Endless ambient
motion belongs in a looping clip inside one scene, not in a loop of scenes.

## 3.10 Clocks

One **engine clock** drives each experience, in milliseconds. One store, one event queue and one chronological
schedule go with it (section 5). Nothing else advances time.

**Local clocks.** Each stage slot, scene and component use has a local clock: a child of its owner's clock (the
engine for stage slots and the shell, the stage slot for its scene, the scene for its components). A local clock has:

- an **origin**: zero when its owner was created (the slot at mount, the scene at entry, the component at mount);
- an optional **pause**: a boolean formula; while true, its local time stops;
- an optional **speed**: a number or formula whose proven range lies within 0.01..100 (`E-CLOCK-SPEED`).

```json
"clock": {"speed": "playbackSpeed", "paused": "videoPaused"}
```

`clock` may appear on a scene document, on a component use and on a stage slot (10.1). **[files]**

**Rules.**

- Effective speed is the product of the speeds of the clock and all its ancestors. The checker proves the product
  of every chain within 0.01..64 (`E-CLOCK-SPEED`). A clock is paused when it or any
  ancestor is paused. **[playing]**
- All deadlines (timers, timed links, clip markers, clip ends and line ends) of every owner sit on one schedule in
  engine time.
  When a speed or pause changes, pending deadlines keep their remaining local time and are rescheduled; a rescheduled
  deadline that falls between whole engine milliseconds rounds up to the next whole millisecond. **[playing]**
- At equal engine times, deadlines run in owner order, depth first: the shell, then each stage slot (in the shell
  drawing's order) with its scene and that scene's components, parent before child, siblings in use order; within one owner in scheduling order; timed links of every owner run after all other deadlines, in the same owner order (3.4). Large and
  split advances give the same events and motion. **[playing]**
- Pause reasons add up: a hidden page, a host pause (10.6), an open dialog slot that pauses (10.1), authored `paused`
  formulas, and the reasons an add-on gives (the `page` add-on's `actor`, the `media` add-on's `buffering`). Time resumes only when every reason has cleared. A paused owner's sounds pause with it. **[playing]**
- **Heard pauses.** When a stage slot's clock pauses, its scene and that scene's components hear the built-in event
  `paused`; when it runs again, `resumed`. The payload is `{reason}`: the reason that paused it, or the last to clear:
  `dialog`, `hidden`, `host`, `authored`, or an add-on's reason. A scene so learns that a dialog covers it, and may
  close its own panels, without seeing the shell's body (10.1). **[playing]**
- Speed scales timers, `afterMs` links (3.4) and clips. Sounds keep their own rate (6.10).
- Ambient reads: `elapsed` is the reading owner's local time; `now` is UTC milliseconds rounded to seconds, fixed by
  test fixtures. Neither can drive a clock's speed bounds.
- Tests use manual time: `advance(ms)` moves the engine clock and drains deadlines in order (A8.5).
- A child player (a preview inside an editor) runs on its parent's clock and starts at zero when mounted; it is a
  host matter, not content.

**Scroll as a source.** A stage slot may take its time from scroll position instead of the engine clock:

```json
"clock": {"source": "scroll", "spanMs": 12000}
```

The engine measures each scroll-driven slot's scroll progress itself, on every web host, as a number from 0 to 1:
0 when the slot's box first reaches the bottom of the window, 1 when it leaves the top. That stretch is the slot's scroll span. `spanMs` (1..3,600,000) goes with `source`, and only with it. The slot's local time is progress × `spanMs`, so it may run both ways. A scroll-driven slot
holds only timeline scenes (3.11) and no machine timers, so every scroll position maps to one scene. **[review]** Clips and timed links
follow the scroll time: scrolling back shows the earlier scene again, and clips are sampled at the new time.
`elapsed` reads the scene's local time, which follows the slot's scroll time from the scene's start. Under reduced motion each
scene shows its clips' end poses; the scene shown still follows scroll. **[playing]**

**Seeking.** A scroll-driven slot holds scenes whose behaviour is visual only: bindings, clips, effects and timed
links. Every action list reachable in the slot's scenes (entry and exit lists, `on` reactions, and
marker handlers) that writes values, adds records, plays sounds or makes add-on calls is not allowed there.
**[review]** In a scroll-driven slot, each marker crossed forward fires once, in time order (its
handler is visual only). Seeking back re-samples poses and nothing else. A jump an add-on makes (a video seek) or a host `scene`
call fires no marker it skips. **[playing]**

## 3.11 Timelines

A **timeline** is a story graph (or the part shown in one stage slot) whose links are all timed links without
`when`, in one chain from `start`, with at most one loop link back; only that loop link carries `max`. Animated ads and slide videos are
timelines.

A timeline can be **seeked**: any time maps to exactly one scene and its local time. So the checker can compute its
length, a scroll can drive it, and a tool can render it as video. Its `afterMs` values may read only
literals, content fields and knobs that no setting changes during play (5.3.2). **[files]**

An animated ad, one shape of a family (300×250):

```json
"story": {
  "start": "hook",
  "scenes": {
    "hook": "scenes/hook/scene.json",
    "offer": "scenes/offer/scene.json",
    "end-card": "scenes/end-card/scene.json"
  },
  "ends": ["end-card"],
  "links": [
    {"id": "hook-offer", "from": "hook", "afterMs": 2500, "to": "offer", "transition": "fade", "transitionMs": 250},
    {"id": "offer-end", "from": "offer", "afterMs": "offerHoldMs", "to": "end-card"},
    {"id": "loop-again", "from": "end-card", "afterMs": 3000, "to": "hook", "max": 2}
  ]
}
```

It plays three times (once, then twice more through `loop-again`) and stops on the end card. With `offerHoldMs` at most 4000, the checker proves that one full pass
lasts at most 9500 ms and that motion stops on the end card after at most 25,500 ms (two full passes, then hook and
offer). An ad-network budget can check that number (section 8).

A **slide video** is a timeline of slides. A slide that moves on when its narration ends (a link `on` the `lines`
add-on's `lines:ended:<line>`) makes the graph mixed: it still plays, but it is not seekable.

## 3.12 Chapters

A **chapter** is a named group of scenes. A chapter with `next` is **ordered**: it has built-in Next and Back, as in
a slide deck, a guided tour or the steps of a lesson. That saves writing a pair of links for every step and every
skip. A chapter without `next` only names its group: the `chapter` ambient input then says which chapter is on the
stage.

```json
"chapters": [
  {"id": "settings-steps", "scenes": ["step-name", "step-alerts", "step-theme", "step-language", "step-save"],
   "next": "next", "back": "back", "before": "welcome", "after": "tour-end"}
]
```

- `scenes` lists the steps in order. `next` and `back` name the outcomes (or `shell.<event>`, 3.3) that move forward
  and back. `after` is where Next from the last present step goes; `before`, if given, is where Back from the first
  present step goes. A link may name an ordered chapter's id as its `to`, and so may `start`: that enters its first
  present step.
- **Present steps.** A step is skipped while its optional `skipWhen` formula is true, or while an add-on says it is
  absent (the `page` add-on: a hook its entry names is missing) (`"scenes": [{"scene": "step-theme", "skipWhen":
  "!hasThemes"}]`). Skipping is decided when the link fires.
- The engine builds the links in list order after the experience's own `links`, which are tried first. They are
  ordinary links in every other way: they carry nothing and take the chapter's optional `transition`,
  `transitionMs` and `slideFrom`.

| Key | Holds |
|---|---|
| `id` | Required; kebab-case, unique among the experience's scene ids, chapter ids and shell id (`E-ID-DUPLICATE`) |
| `scenes` | 1 to 64 steps: scene ids, or `{scene, skipWhen}`; each a listed scene (`E-REF-UNKNOWN`), in at most one chapter (`E-ID-DUPLICATE`) |
| `next`, `back` | The outcome names (or `shell.<event>`) that move forward and back; `next` makes the chapter ordered |
| `after` | Required in an ordered chapter: where Next from the last present step goes (a scene or another ordered chapter) |
| `before` | Optional: where Back from the first present step goes |
| `transition`, `transitionMs`, `slideFrom` | As on a link (3.2); copied into every link the chapter builds |

The built links have ids `<chapter>-next-<n>` and `<chapter>-back-<n>` (`n` the step, from 1). Entering an ordered
chapter with no present step goes to its `after`. `skipWhen` reads the experience's values and the ambient inputs.

- `chapter` is an ambient input (5.5): `{id, index, count}` of the chapter on the stage; in an ordered chapter it
  counts present steps only, so "Step 2 of 4" is right when a step is skipped.
- The graph rules of 3.9 apply to the built links. A scene may be in at most one chapter. **[files]**, **[playing]**
