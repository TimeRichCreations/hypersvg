# hypersvg local export

Not published. Licence: Apache-2.0 (LICENSE).

- Source commit: `af14fe6ba718322749a361ba5c6a8040072b011c`. No Git history exported.
- Policy: `release/hypersvg.files.txt`; SHA-256 `337ef61990fbbfb25bb3e8fd635b4d3e631fe02008c336c382c0720edf2118ee`.
- Selected committed files: 792; 6720902 bytes.
- Excluded committed entries: 8538; 281765668 bytes.
- Export payload before this report: 803 files; 6787508 bytes. This report is an additional generated file.
- Names and bytes came from a temporary Git index and commit blobs. Dirty, staged, ignored and untracked worktree files are not inputs.
- Secret/private-path and licence checks passed before and after target checks. Pattern scanning is not proof against every encoding.

## Checks

- CHECK PASS: leak check, 803 files
- OMITTED: engine/v2/tests/w4u-upgrade.test.mjs (not exported): not exported: it tests the 0.1 upgrade tool (docs/spec-2.0-work), which stays out of the public repository.
- OMITTED: engine/v2/tests/w5m-upgrade.test.mjs (not exported): not exported: it tests the 0.1 upgrade tool (docs/spec-2.0-work), which stays out of the public repository.
- OMITTED: engine/v2/tests/x1-security.test.mjs (not exported): not exported: it plants a fake credential literal; the leak check refuses it. The authors' CI still runs it.
- OMITTED: examples/2.0-live-dashboards/tests/host.test.mjs (not exported): not exported: it plants a fake login URL; the leak check refuses it. The authors' CI still runs it.
- OMITTED: engine/v2/tests/a2-mouth-drawing.test.mjs (in hypersvg-addons): tests a built-in capability or module (D30); the file moves to hypersvg-addons.
- OMITTED: engine/v2/tests/a2-mouth.test.mjs (in hypersvg-addons): tests a built-in capability or module (D30); the file moves to hypersvg-addons.
- OMITTED: engine/v2/tests/d1-data.test.mjs (in hypersvg-addons): tests a built-in capability or module (D30); the file moves to hypersvg-addons.
- OMITTED: engine/v2/tests/s1-board.test.mjs (in hypersvg-addons): tests a built-in capability or module (D30); the file moves to hypersvg-addons.
- OMITTED: engine/v2/tests/s1-seats.test.mjs (in hypersvg-addons): tests a built-in capability or module (D30); the file moves to hypersvg-addons.
- OMITTED: engine/v2/tests/stage5-effects.test.mjs (in hypersvg-addons): tests a built-in capability or module (D30); the file moves to hypersvg-addons.
- OMITTED: engine/v2/tests/w5p-page-check.test.mjs (in hypersvg-addons): tests a built-in capability or module (D30); the file moves to hypersvg-addons.
- OMITTED: engine/v2/tests/w5p-page.test.mjs (in hypersvg-addons): tests a built-in capability or module (D30); the file moves to hypersvg-addons.
- OMITTED: engine/v2/tests/w6l-board.test.mjs (in hypersvg-addons): tests a built-in capability or module (D30); the file moves to hypersvg-addons.
- OMITTED: engine/v2/tests/w6l-chess.test.mjs (in hypersvg-addons): tests a built-in capability or module (D30); the file moves to hypersvg-addons.
- OMITTED: engine/v2/tests/w6v-media-check.test.mjs (in hypersvg-addons): tests a built-in capability or module (D30); the file moves to hypersvg-addons.
- OMITTED: engine/v2/tests/y3-resize.test.mjs (in hypersvg-addons): tests a built-in capability or module (D30); the file moves to hypersvg-addons.
- OMITTED: examples/2.0-ad-studio/tests/studio.test.mjs (in hypersvg-addons): tests the ad studio example, which needs fit, ladder, rich-text and shell (D30); it moves to hypersvg-addons with the example.
- OMITTED: engine/v2/tests/a1-fit.test.mjs :: a page that needs fit solves live; one that does not carries no solver: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/a1-fit.test.mjs :: the fit capability's code (the module and the solver) is within capabilityBundleBytes, gzip level 9 (10.11): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/a2-audio-web.test.mjs :: the mouth follows the voice loudness, and closes when the voice stops: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/a2-audio-web.test.mjs :: a character runs its own mouth: only while its when is true, and with a channel it gives numbers (6.11): add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/ai-check.test.mjs :: a session or saved value, or an experience run value, may not hold an answer: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/ai-check.test.mjs :: the value a reaction to ai:answered sets must be a moment value: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/ai-check.test.mjs :: a quoted seat of ai.ask names a character seat in addons.ai.seats (E-REF-UNKNOWN): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/ai-check.test.mjs :: derived values: a computed value of the answer, then a reaction to its change: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/ai-check.test.mjs :: events emitted from an answer carry the taint; an output event is refused: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/ai-check.test.mjs :: machines and timers: a tainted transition taints the machine, its states and active(): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/ai-check.test.mjs :: outputs, records, the host API, page actions and module calls are refused: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/ai-check.test.mjs :: uses' inputs and triggers are refused: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/ai-check.test.mjs :: link when and carry may not read a tainted value: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/ai-check.test.mjs :: free text: only the with of a call ai.ask may read it: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/ai-engine.test.mjs (all tests): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/b1a-format.test.mjs :: D28: physics through the door: addons.physics and physics.throw check clean and play: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/b1a-format.test.mjs :: D28: an unknown key in the physics pocket names the capability and where its words are listed: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/b1a-format.test.mjs :: D28: a call is checked against the manifest: verb, inputs, literals, the body it names: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/b1a-format.test.mjs :: D28: physics controls are keyed by a drag control of the block: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/b1a-format.test.mjs :: D28: the old words are gone from the core: physics, physicsThrow, releaseVelocity: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/b1a-format.test.mjs :: D28: physics.throw without physics in needs faults E-NEEDS-MISSING at play: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/b1b-door.test.mjs :: item 3: a built-in humanOnly call (snapshot.save) runs from a press and is refused from a timer, in the engine and the checker: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/b1b-door.test.mjs :: item 3: the checker flags a built-in humanOnly call on a timer path (W-HUMAN-ONLY-PATH): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/b4-proof.test.mjs :: packing twice gives the same page digest (a trace is tied to the bytes): in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/b4b-engine.test.mjs :: item 2 (D36): a call's string input is a formula in the checker too: quoted text, a name, and bare words refused: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/b4c-motion.test.mjs :: face: the example checks clean: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/b4c-motion.test.mjs :: face: right is as drawn; left mirrors about the pivot, inside the channels, and the text reads the right way: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/b4c-motion.test.mjs :: face: a mirrored part in a mirrored part leaves its text as drawn (two mirrors cancel): in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/b4c-motion.test.mjs :: face: a facing scale is a number: a word faults at paint (E-TYPE), and the checker refuses a literal one: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/b4c-motion.test.mjs :: face: under reduced motion the face still follows its value (a choice, not motion): in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/b4c-motion.test.mjs :: wipe: the example checks clean: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/b4c-motion.test.mjs :: wipe: the part owns one clip path; its rectangle grows from the box's left edge with the share shown: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/b4c-motion.test.mjs :: wipe: half way through an ease-out key, the share is the eased value: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/b4c-motion.test.mjs :: wipe: under reduced motion the wipe ends at its last key at once: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/b4c-motion.test.mjs :: wipe: a binding drives it, with a glide: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/b4c-motion.test.mjs :: wipe: a stopped clip puts the drawn clip-path back: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/b4c-motion.test.mjs :: wipe: the checker refuses a wipe on a part that draws its own clip-path (E-WRITER): in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/b4c-motion.test.mjs :: clock: the example checks clean: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/b4c-motion.test.mjs :: clock: at speed 0.5 the use's clip, timer and elapsed run at half speed; the scene runs at its own: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/b4c-motion.test.mjs :: clock: at speed 2 the use runs twice as fast: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/b4c-motion.test.mjs :: clock: a speed change keeps the remaining local time of each deadline: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/b4c-motion.test.mjs :: clock: split and whole advances give the same events at speed 0.5: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/b4c-motion.test.mjs :: clock: paused holds the use and the blocks under it; it hears paused and resumed with the reason authored: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/b4c-motion.test.mjs :: clock: the host pause holds a use at speed 0.5 on top of its speed: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/b4c-motion.test.mjs :: clock: the checker proves a scene clock's speed (E-CLOCK-SPEED) and that paused is a boolean: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/b4c-motion.test.mjs :: scroll: a clock's source and spanMs are refused as a 2.1 draft (E-DRAFT), on a scene and on a use: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/check-budgets.test.mjs :: effectsPerBlock: more effects in one block than the limit is E-RANGE (A1): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/check-coverage.test.mjs (all tests): needs docs/spec-2.0-work (the internal spec work folder and its upgrade tool), which is not exported.
- OMITTED: engine/v2/tests/check-formula.test.mjs :: effect parameters are proven inside their stated range (E-RANGE): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/check-refs.test.mjs :: a setting that no play item names is E-WRITE-INPUT: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/check-refs.test.mjs :: a synth is a sound: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/check-story.test.mjs :: a link on lines:ended:<line> names a line of the scene (afterLine before D31): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/check-story.test.mjs :: choice links need a place and a way on: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/check-story.test.mjs :: a scene with choice links needs a way on when none is eligible: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/check-story.test.mjs :: a scene has at most 16 choice links (E-RANGE): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/check-story.test.mjs :: a capability event needs the capability in needs (E-NEEDS-MISSING): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/check-story.test.mjs :: a link on a capability event needs the capability: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/check-story.test.mjs :: a declared need no content uses is W-NEEDS-UNUSED: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/check-story.test.mjs :: a signal heard must be granted (E-GRANT): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/check-story.test.mjs :: a link on a signal must be granted: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/check-story.test.mjs :: a page action and its hook must be granted (E-GRANT): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/check-story.test.mjs :: a seat filler beyond human must be granted: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/check-w4k.test.mjs :: formulas.md gives each function its own example, the row functions and the operators: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/check-w4k.test.mjs :: keys.md lists the nested keys of controls, links, bindings, actions and uses: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/e1-fixes.test.mjs :: size limits come from limits.json: 10,000 a capability, 120,000 the core (D7, D8): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/e1-fixes.test.mjs :: the packer reports the engine sizes of the page it packs: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/e1-fixes.test.mjs :: a kit experience whose scenes are uses (not files) has no places read, and does not fail: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/e2-joins.test.mjs :: E-CONTENT-REQUIRED: a required field never has an empty wording, in its initial or a use's with (7.9): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/e2-joins.test.mjs :: a contrast rule's own ratio applies to each text style; without one, 4.5:1 (8.9): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/e2-joins.test.mjs :: a line mouth blends its from look at 1 - mix and its look at mix, by group opacity (6.11): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/e2-joins.test.mjs :: checkContent: richText styles and markup; each wording of a tier or language object (5.3.1): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/e2-joins.test.mjs :: a richText initial per language mounts, and reads in the active language: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/e2-joins.test.mjs :: a run without a style is accepted when the field's items do not require one: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/e2-joins.test.mjs :: setInput on a richText field checks its styles and its markup at play (5.3.1): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/e2-joins.test.mjs :: media: attachMedia in a srcdoc frame does not throw: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/e2-text.test.mjs :: rich text: lines in one part are kept apart by a space at size 0 (6.8.1): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/e3-lean.test.mjs :: lines: without it in needs the checker says E-NEEDS-MISSING and the engine stops with it; with it a line runs: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e3-lean.test.mjs :: rich-text: without it the checker refuses its settings, rich-text bindings and richText fields; the engine stops at mount: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e3-lean.test.mjs :: ladder: a package that needs fit and has a fits, limit or keep give-way rule needs ladder (checker and engine): add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e3-lean.test.mjs :: union of needs: a page that names none of the three carries none of their code, and the core carries no checker or kit loader: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e3-lean.test.mjs :: kits flattened at pack time: the flattened studio ad is what the kit loader gives, without its drawings' texts: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e3-lean.test.mjs :: a packed kit experience carries the flattened form and no kit loader; a kit finding stops the pack: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e3-lean.test.mjs :: sizes: the packer refuses when the core is over coreBundleBytes, as for a capability (E-ENGINE-SIZE): add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e3-lean.test.mjs :: shell outputs: host.on hears a shell's declared output event, with no page wrapper: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e3-lean.test.mjs :: a theme's type role naming a font the package does not carry is E-REF-UNKNOWN; a font resource passes: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e3-lean.test.mjs :: host.seat gives a seat to a filler through the seats port; an unknown seat or filler is refused: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e4-joins.test.mjs :: size: each logic module is measured against capabilityBundleBytes: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e4-joins.test.mjs :: modules: a module needs names that no package or host carries is E-MODULE-REVIEW at mount: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e4-joins.test.mjs :: modules: chess-opponent is a registered module with its manifest; the board game names it in needs: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e4-joins.test.mjs :: seats: with the page's own lock, the black seat starts with its program and plays (a packed page): add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e4-joins.test.mjs :: seats: an input from the agent door goes through requestAtPlay and leaves a receipt: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e4-joins.test.mjs :: tiers: resolveRuns takes the nearest longer tier, else the nearer shorter, as wordingAt does (7.9): add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e4-joins.test.mjs :: tiers: a component's initial takes a tier object; the block reads its tier's wording: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e4-joins.test.mjs :: tiers: host.set accepts a tier or language object on a content field, each wording checked (10.6): add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e4-joins.test.mjs :: spoken holds line, text and word when idle: "", "" and -1 (5.5): add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e4-joins.test.mjs :: tiers: an empty initial of a required text field is E-CONTENT-REQUIRED; required: false is fine: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e4-joins.test.mjs :: kits: a one-name formula with keeps the input's declaration; the block holds the tier object (A4 Request 1): add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e4-joins.test.mjs :: kits: the checker sees the declaration: field:<name> resolves for a fed input: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e4-joins.test.mjs :: plan steps live: the fit capability's solver applies the block's rules: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e4-joins.test.mjs :: plan steps live: with fit, the drawing re-solves the plan as a column: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e4-joins.test.mjs :: small: START names hsvg preview; the README names proof.mjs guide, the guides folder and the studio's browser test; preview speaks of srcdoc; the fast run has the studio test: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/e4-joins.test.mjs :: checker: limit rules hold on the values in initial, with and words (E-RULE), as the change tool says: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e4-joins.test.mjs :: checker: W-MOUNT-LIMIT when the estimated filter surface is over the mount limit (9.8): add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e4-joins.test.mjs :: changes: check.mjs --rights prints the rights table (A9.1): add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e4-joins.test.mjs :: changes: --previous-kit gives the checker the kit before a version change (E-KIT-VERSION, 4.8): add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e4-joins.test.mjs :: ambient layout: a built-in a formula reads (the player writes it, 7.1, 5.5); a value of the author named layout hides it (D22): add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e5-freeze.test.mjs :: door refusals: seat o, which sees only turn, open and count, does not learn handX from a refusal or its receipt: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e5-freeze.test.mjs :: seats: act checks that the entry is still allowed, not only that the view, occupant and turn are the same: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e5-freeze.test.mjs :: turns: with alternating turns the engine writes the seat on turn into turns.value: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e5-freeze.test.mjs :: turns: simultaneous turns refuse value (E-TYPE); alternating checks that the value can hold each seat: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e5-freeze.test.mjs :: turns: the seats run state lives with the graph memory, so a resumed run keeps the turn and the moves: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e5-freeze.test.mjs :: a person's setting can turn on reducedMotion; it stays on while the system asks for it: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e5-freeze.test.mjs :: records and the seat log only grow: resetSaved keeps the published rows and the accepted inputs: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e5-freeze.test.mjs :: dash: a share of 0 hides the part whatever its caps, and a share above 0 shows it again: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/e5-freeze.test.mjs :: fed rows: a text column takes tier and language objects; a word column is checked against the words in scope: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/f1a-newcomer.test.mjs :: item 6: "is not an input of" lists the inputs (a template use, a kit with, a component use): in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/f1a-newcomer.test.mjs :: item 7: pack counts the files left out (--verbose names them) and refuses to replace another experience's package.json: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/k1-dial.test.mjs :: item 3: the oven example checks clean; its spoken value is the formatted heat, read back by the Node player: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/k2a-addons.test.mjs (all tests): in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/l1-lines-check.test.mjs (all tests): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/l1-lines.test.mjs (all tests): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/limits-runtime.test.mjs :: effectsPerBlock: a block with more effects than the limit is refused when it mounts (E-RANGE, A1): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/limits-runtime.test.mjs :: deliveriesPerTransaction: more deliveries than the limit in one transaction fault (E-EVENT-LOOP): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/limits-runtime.test.mjs :: capabilityBundleBytes: each capability's runtime code is at most capabilityBundleBytes gzip level 9 (10.11); fit is its own files, not core text fitting: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/limits.test.mjs :: physics refuses more bodies than the player's limit: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/q1-plan-fitbox.test.mjs :: baked: the derived frames carry the moved region; a baked page shows it where the live one does: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/q1-player.test.mjs :: widgets: no theme keeps the browser look (no CSS): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/q1-player.test.mjs :: widgets: colours by role, type roles, radius and border from the theme: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/q1-player.test.mjs :: widgets: every gap and padding is a multiple of 8 units: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/q1-player.test.mjs :: widgets: outline shapes give the corner radius; extends applies: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/r1-richtext-check.test.mjs (all tests): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/r1-richtext.test.mjs (all tests): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/s1-check.test.mjs (all tests): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/skill-refs.test.mjs :: skill/2.0/tools/make-refs.mjs --check finds every page up to date: make-refs.mjs --check rebuilds the reference pages from docs/spec-2.0-work, which is not exported.
- OMITTED: engine/v2/tests/skill.test.mjs (all tests): in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/stage5-physics.test.mjs :: a thrown body rises, falls, reports each contact once on entry and rests; bodies start asleep: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/stage5-physics.test.mjs :: the same configuration and commands give the same motion: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/stage5-physics.test.mjs :: one large advance runs every 120 Hz step it covers (9.4): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/stage5-physics.test.mjs :: one advance of 20 s equals many small advances: the same world, events and log (9.4): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/stage5-physics.test.mjs :: a static body cannot be thrown; an unknown body is a fault; the step rolls back: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/stage5-physics.test.mjs :: a body whose target has no translate ranges is refused at mount (E-MOTION-RANGE): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/stage5-physics.test.mjs :: a moving body hits a peer: both report hit, with the other id; contacts filter what is reported: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/stage5-physics.test.mjs :: a deadline at the same time goes before a physics tick; events run as their own step: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/stage5-physics.test.mjs :: reduced motion: the simulation runs and its events fire; the body is drawn at rest: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/stage5-snapshot.test.mjs :: a person's press delivers the request; padding defaults to 8; the press's reaction goes on: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/stage5-snapshot.test.mjs :: a timer, host or seat cannot save (E-HUMAN-ONLY); a disabled control does nothing: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/stage5-snapshot.test.mjs :: without the snapshot capability the call is refused (E-NEEDS-MISSING): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/stage5-snapshot.test.mjs :: the host writes progress into the status value, at most 200 characters: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/t1-sweep.test.mjs :: the sweep list: every 2.0 experience folder, sorted, no private or source folders: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/v1-change.test.mjs :: shape: a refused request writes nothing and its receipt says which check failed: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/v1-change.test.mjs :: proof: a copywriter shortens an ad headline; it passes, the digest changes, the receipt lists every check: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/v1-change.test.mjs :: proof: the same request without the right is E-RIGHTS, and nothing is written: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/v1-change.test.mjs :: proof: with a stale expected it is E-CHANGE-STALE; a stale old is too: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/v1-change.test.mjs :: proof: a headline that breaks a must rule is E-RULE, and passes once a waiver covers it: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/v1-change.test.mjs :: proof: a kit change renames an input, then moves the kit version: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/v1-change.test.mjs :: replay: a retry with the same id returns the first receipt and writes nothing; other content is E-CHANGE-SHAPE: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/v1-change.test.mjs :: reach: kit inputs and literal scene inputs are written into with as plain words; formulas, inner paths and unknown names are refused: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/v1-change.test.mjs :: reach: a kit pin moves by publish, and the full checker runs on the copy: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/v1-change.test.mjs :: rights: the table of a kit experience and of an experience made without a kit: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/v1-change.test.mjs :: make: a request from two folders, and from a studio's edited values; it applies: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/v1-change.test.mjs :: cli: make, then apply with the authenticated by; exit codes 0, 1 and 2; rights prints the table: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/v1-change.test.mjs :: kit change: the kit's sample kit experiences are checked with the changed kit: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w2e-load.test.mjs :: stands alone: only the upgrade tool tests reach docs/ from engine/v2/tests (the tests of a work tool): it lists the two tests of the 0.1 upgrade tool by name, and those are not exported.
- OMITTED: engine/v2/tests/w2e-pack.test.mjs :: csp: every capability of the spec has an entry, and the policy denies the network whatever needs say: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/w3c-capabilities.test.mjs :: the core imports no capability module: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/w3c-capabilities.test.mjs :: only capabilities in needs are installed, even when registered: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/w3c-capabilities.test.mjs :: a capability in needs that is not installed: its field, action and control are E-NEEDS-MISSING: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/w3c-capabilities.test.mjs :: a capability not in needs stays E-NEEDS-MISSING although the dev player registered it: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/w3c-capabilities.test.mjs :: the AI fixture bundles ai and widgets, not physics, effects or snapshot: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/w3c-capabilities.test.mjs :: a packed page lists its capability modules and registers them before the player boots: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/w4r-runtime.test.mjs :: the audio capability: synths and the loudness mouth ship only when needs names audio (W3-C Request 4): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/w4r-runtime.test.mjs :: a made sound plays without the synth module (core, D31.2); the module gives only the mouth page part: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/w4s-boundaries.test.mjs :: the engine installs a capability that only a scene or a block names in its needs: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/w4s-boundaries.test.mjs :: the packer bundles and declares the union of needs: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/w5c-checker.test.mjs :: a character seat and an ask check clean (the AI fixture): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/w5c-checker.test.mjs :: an ask with inputs missing names the inputs, not the page capability: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/w5c-checker.test.mjs :: an ask with the ai need missing is blamed on ai: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/w5c-checker.test.mjs :: a character seat with keys missing is checked as a character, not refused for its kind: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/w5c-checker.test.mjs :: an unknown action is named as unknown, not blamed on a capability: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/w5c-checker.test.mjs :: E-WIDGET-PAINT: an overlay slot after a declared widget slot that it crosses: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/w5c-checker.test.mjs :: W-NEEDS-UNUSED: a need named by a scene and used by no document is judged at the scene; the message says union: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/w5f-runtime.test.mjs :: ai.mjs works on its door: no aiView, no engine reference, its state rolls back (10.11): add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/w5f-runtime.test.mjs :: a page part gets a page door: copies to read, whole steps to write, faults on the page's stop path: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: the three ads check with 0 findings, from their folders (the kit is found in a parent kits/ folder): add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: a kit experience plays: scenes are uses of kit definitions, its with and the kit inputs reach the drawing: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: the 15 s story: three timed links of 5 s, the end at 15 s: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: a kit block is used like an experience block; its words are the kit words: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: with: a literal becomes the input initial, a formula becomes a computed value of the scene: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: the kit's needs join the union: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: a kit experience's settings name a kit knob, and the setting changes it: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: a second theme in the kit changes the colours of all three ads: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: E-KIT-PIN: a missing kit, a wrong version, a wrong digest; the right digest passes: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: E-KIT-VERSION: each change needs its class; a smaller step is refused: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: E-KIT-VERSION through the checker: opts.previousKit: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: E-ROLE-KIT: a kit role word that is a core role or alias is refused, in the kit file: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: kit roles are known: a drawing's kit role is not unknown; without the kit role it is: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: E-THEME-ROLES: a theme without a role the kit uses: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: E-SEAL: a with that names a sealed body value; open definitions are not sealed: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: E-SEAL: a promotion of a sealed body value; W-RIGHTS-WIDEN: a promotion that adds a right: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: E-SEAL-LEAK: a sealed body that reads or writes outside itself: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: E-SEAL-DIGEST: a sealed definition in a reviewed kit needs its digest; a draft kit does not: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: E-RIGHTS: a kit experience may set only inputs an editor may change: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: E-RIGHTS-UNKNOWN: an editableBy that names a right the kit does not declare: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: E-KIT-BODY: a kit experience with values of its own, or a scene file: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: a scene use of a definition the kit lacks is E-REF-UNKNOWN; a kit path that leaves the kit is E-PATH: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: applyKit is pure data: the kit document is not changed: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: each ad packs with its kit: kits, members with digests, and the page plays from the packed files: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5k-kits.test.mjs :: a kit inside the experience folder (the package layout) is packed once, not twice: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/w5m-motion.test.mjs :: morph blends paths of the same structure, and refuses others (6.7): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/w5m-motion.test.mjs :: the packer ships the motion module only when needs names motion (10.11): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/w5m-motion.test.mjs :: the checker: morph paths of another structure, points on a rect (6.7, 6.8): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/w5m-motion.test.mjs :: the checker: a morph without needs motion is refused; route needs nothing (D31): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/w6l-modules.test.mjs :: a call runs at entry and writes its outputs: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/w6l-modules.test.mjs :: calls in a reaction: apply a move, then read the status: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/w6l-modules.test.mjs :: an illegal move faults the transaction and nothing is written: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/w6l-modules.test.mjs :: a malformed position faults the call (E-MODULE-RESULT): add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/w6l-modules.test.mjs :: inputs are checked against the export before the call: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/w6l-modules.test.mjs :: with and to must match the export exactly (E-MODULE-CALL, also at play): add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/w6l-modules.test.mjs :: admission: needs, pin and the reviewed lock (E-MODULE-REVIEW): add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/w6l-modules.test.mjs :: admission: a port the host made itself does not confine (E-MODULE-CONFINEMENT): add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/w6l-modules.test.mjs :: modulePort checks its lock and limits: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/w6l-modules.test.mjs :: review: the chess code imports nothing and names no global, clock, random source or catch: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/w6l-modules.test.mjs :: confinement: the chess code runs the same in a context with no globals at all: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/w6l-modules.test.mjs :: the reviewed lock and the module digest are fresh (make-lock.mjs): add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/w6l-modules.test.mjs :: the chess exports are the manifest beside the spec, and the version is the manifest's: add-on test: imports a built-in capability's code when it loads, so none of its tests can run in the core; it runs in the hypersvg-addons checks until the file is split.
- OMITTED: engine/v2/tests/w6m-readme.test.mjs (all tests): reads the authors' repository AGENTS.md at import, which is not exported.
- OMITTED: engine/v2/tests/w6v-media.test.mjs (all tests): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/x2-speed.test.mjs :: item 1: the valid 60-row dashboard takes a feed that changes every row (was E-EVENT-LOOP from 50 rows): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/x2-speed.test.mjs :: item 1: 1024 rows (dataTableRows) take a feed that changes every row, and one with all new keys: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/x2-speed.test.mjs :: item 1: a key press and an ambient change with more than 100 live blocks do not fault: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/x2-speed.test.mjs :: item 1: a real loop still faults; a fan-out counts once per cause, not once per block: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/x2-speed.test.mjs :: item 5: admitting and removing 512 repeated uses walks the live blocks a fixed number of times, not once per mount: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/x2-speed.test.mjs :: item 5: the running counts still refuse the use over liveRepeatedUses, after a rollback too: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/x2-speed.test.mjs :: item 3: a paint that changes nothing writes no attribute (the line chart after its clip ended): in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/x2-speed.test.mjs :: item 3: a moving clip writes only the attributes whose value changed: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/x2-speed.test.mjs :: item 2: with nothing changed, a paint evaluates no binding; idle, no block reads time: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/x2-speed.test.mjs :: item 2: a change paints the changed rows and their scene only, and draws what a whole paint draws: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/x2-speed.test.mjs :: item 2: a running clip keeps its block live; it holds still once the clip ends: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/x2-speed.test.mjs :: item 2: a binding that reads elapsed keeps its block live: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/x3-correctness.test.mjs :: X3.8 destroy removes the caption box; a resize after it never brings it back (10.6): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/x3-correctness.test.mjs :: X3.9 the change tool with --out: a retry returns the first receipt; a refused replay never overwrites it (9.10): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/x3-correctness.test.mjs :: X3.9 one kit digest: the checker and the change tool agree, and a sample's scene moves it (A9.3): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/x3-correctness.test.mjs :: X3.9 the rich-text editor indexes text by UTF-16 units: typing, styling and deleting next to an emoji (6.8.1): add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/x4-truth.test.mjs :: X4 baggage 1: fonts and colors rules with no evaluator are listed not-run by check.mjs: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/x4-truth.test.mjs :: X4 power 3: maxItems 7 or 500 over a 6-slot repeat region is E-REPEAT-CAPACITY, 6 passes: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/x4-truth.test.mjs :: X4 architecture 7: own needs, plus the experience's for scenes and the shell; the checker and the engine agree: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/x4-truth.test.mjs :: X4 architecture 10: a code quoted in a one-off spec edit script is not produced; the upgrade tool still is: Architecture 10 needs docs/spec-2.0-work (the internal spec work folder and its upgrade tool), which is not exported. Newcomer F1 checks the authors' repository README.md (with its 0.1 page); the export's front page is the one-page README proposal.
- OMITTED: engine/v2/tests/x4-truth.test.mjs :: X4 newcomer F1: README.md leads with 2.0 (the kit, START.md, the skill); its links resolve; its commands run: Architecture 10 needs docs/spec-2.0-work (the internal spec work folder and its upgrade tool), which is not exported. Newcomer F1 checks the authors' repository README.md (with its 0.1 page); the export's front page is the one-page README proposal.
- OMITTED: engine/v2/tests/x4-truth.test.mjs :: X4 newcomer F4: a link on an event nothing sends says how to send it; an event the scene sends needs no outputs (D31.4): in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/x5-status.test.mjs :: X5.14 the status table: six status words, every evidence file exists: names spec/2.0/DECISIONS.md as evidence; the decisions log is not exported (it names this PC's bench folder).
- OMITTED: engine/v2/tests/x6-addons.test.mjs :: every add-on the engine ships checks clean: the eight starters and the three examples: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/x6-addons.test.mjs :: the eight starter presets expand into content that checks with no finding: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/x7a-library.test.mjs :: the starter catalogue checks clean, and every block, resource and theme of the kit has an item: in another repository: needs a skill, kit, template, library or showcase example, some with an add-on too (D41); runs in that repository, laid over the base (and the add-ons).
- OMITTED: engine/v2/tests/x7a-library.test.mjs :: a catalogue with each mistake gets E-CATALOGUE with a message that says the fix: in another repository: needs a skill, kit, template, library or showcase example, some with an add-on too (D41); runs in that repository, laid over the base (and the add-ons).
- OMITTED: engine/v2/tests/x7a-library.test.mjs :: an experience that pins the kit gets the catalogue checked too: in another repository: needs a skill, kit, template, library or showcase example, some with an add-on too (D41); runs in that repository, laid over the base (and the add-ons).
- OMITTED: engine/v2/tests/x7a-library.test.mjs :: an experience picks items of the starter: a component, a layout, a shell, a resource and a theme, and checks clean: in another repository: needs a skill, kit, template, library or showcase example, some with an add-on too (D41); runs in that repository, laid over the base (and the add-ons).
- OMITTED: engine/v2/tests/x7a-library.test.mjs :: picks keep the kit's pin, seals and rights: in another repository: needs a skill, kit, template, library or showcase example, some with an add-on too (D41); runs in that repository, laid over the base (and the add-ons).
- OMITTED: engine/v2/tests/x7a-library.test.mjs :: a pick that cannot be used is refused, with what to do: in another repository: needs a skill, kit, template, library or showcase example, some with an add-on too (D41); runs in that repository, laid over the base (and the add-ons).
- OMITTED: engine/v2/tests/x7a-library.test.mjs :: a package of picked items carries only what they reach, and the page plays it flattened: in another repository: needs a skill, kit, template, library or showcase example, some with an add-on too (D41); runs in that repository, laid over the base (and the add-ons).
- OMITTED: engine/v2/tests/x7a-library.test.mjs :: hsvg new makes each of the six starter templates: new id, derivedFrom, the kit brought, checked and packed: in another repository: needs a skill, kit, template, library or showcase example, some with an add-on too (D41); runs in that repository, laid over the base (and the add-ons).
- OMITTED: engine/v2/tests/x7a-library.test.mjs :: hsvg new refuses a folder that exists, a bad name and an unknown template: in another repository: needs a skill, kit, template, library or showcase example, some with an add-on too (D41); runs in that repository, laid over the base (and the add-ons).
- OMITTED: engine/v2/tests/x7a-library.test.mjs :: a copy of a copy names its direct source, and a new experience from a plain folder works too: in another repository: needs a skill, kit, template, library or showcase example, some with an add-on too (D41); runs in that repository, laid over the base (and the add-ons).
- OMITTED: engine/v2/tests/x7a-library.test.mjs :: hsvg add picks one item for an experience, pinned to the library's version, and checks: in another repository: needs a skill, kit, template, library or showcase example, some with an add-on too (D41); runs in that repository, laid over the base (and the add-ons).
- OMITTED: engine/v2/tests/y1-fixes.test.mjs :: item 7: a reserved event name is refused as an emitted event, as in every author-chosen producer: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/y1-fixes.test.mjs :: item 7: the checker accepts changed:hsvg.<name> for a built-in value and refuses it for an unknown one: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/y2-change.test.mjs :: Y2.7 two changes against the same revision: one commits, the other is refused as stale: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/y2-change.test.mjs :: Y2.7 a failed receipt write leaves nothing written, so the same request passes on retry: add-on test: needs an ad the core release does not ship (the ad template, the ad kind, the ad recipes or the kit ads; release/core-examples.json, "addons"); runs in the hypersvg-addons checks. The tests named "core kit: ..." run in the core on engine/v2/tests/kit-fixture.
- OMITTED: engine/v2/tests/y3-fixes.test.mjs :: item 1: a nested component whose required text cannot fit at a must size stops the pack: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/y3-fixes.test.mjs :: item 1: a nested placement shared by a must and a should size keeps the must class: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/y3-fixes.test.mjs :: item 2: a component rule on field:<its id>.<field> applies to its own field, as the bare form does: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/y3-fixes.test.mjs :: item 3: a kit scene's with formula is checked as a formula, at the authored field: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/y3-fixes.test.mjs :: item 3: a with formula of several words reports at the authored field, not inside the kit; a valid one passes: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/y3-fixes.test.mjs :: item 4: a declared limits.liveRepeatedUses a host can admit is accepted by the checker; the default still refuses: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/y3-fixes.test.mjs :: item 6: change.mjs apply never trusts a request's own by; with no --right/--who/--source it is refused: add-on test: needs a built-in capability, its manifest or an example that needs one (D30); runs in the hypersvg-addons checks.
- OMITTED: engine/v2/tests/y3-fixes.test.mjs :: item 6: openUrl's with carries only ids and numbers: the checker refuses words, the engine never sends them: needs an example the core release does not ship (release/core-examples.json does not list it): examples/2.0-round1. It runs in the authors' repository.
- OMITTED: engine/v2/tests/y3-fixes.test.mjs :: item 6: hsvg new and hsvg add write the kit's digest into the pin, so a changed kit file is found: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- OMITTED: engine/v2/tests/y3-fixes.test.mjs :: item 7: START says how to build the kit from the source; the template guide's first edits check clean: in another repository: needs a skill, kit, template, library or showcase example (D41); runs in that repository, laid over the base.
- CHECK PASS: engine/v2 fast tests (1073 passed, 277 omitted)
- CHECK PASS: release leak tests
- CHECK PASS: hsvg check docs/one-page/example
- CHECK PASS: hsvg pack docs/one-page/example
- CHECK PASS: hsvg check docs/one-page/example
- CHECK PASS: hsvg check engine/v2/addons/examples/noughts
- CHECK PASS: hsvg check engine/v2/addons/examples/lamp
- CHECK PASS: hsvg check skill/2.0/examples/kinds/infographic
- CHECK PASS: hsvg check skill/2.0/examples/recipes/orientation
- CHECK PASS: hsvg check engine/v2/addons/examples/doors
- CHECK PASS: hsvg check docs/guide/examples/lamp
- CHECK PASS: hsvg check docs/guide/examples/harbour
- CHECK PASS: hsvg check docs/guide/examples/ad
- CHECK PASS: hsvg check docs/guide/examples/list
- CHECK PASS: hypersvg --version
- CHECK PASS: hypersvg init
- CHECK PASS: hypersvg check the starter
- CHECK PASS: hypersvg pack the starter
- PUBLIC CHECKS PASS: leak check, fast tests, check and pack, the door examples and the hypersvg command.

## Packaging adaptations

The lean base (D41). Engine and spec bytes are unchanged, with one exception: `engine/v2/src/capabilities/all.mjs` is an empty module, since the core carries no built-in capability (D30). `README.md`, `GUIDE.md`, `AGENTS.md` and `EXTENDING.md` come from the sources `release/lean.json` names; the README must carry the Apache-2.0 licence line. `CONTRIBUTING.md` is `release/CONTRIBUTING.md`. `package.json` is `release/npm-package.json` (D44), checked. Tests that need left-out material are listed in `release/public-omissions.json`; the checks print each omission and do not claim those tests ran.

Every target receives a README, its verbatim policy, this report and LICENSE (Apache-2.0, the person's choice); the core and the add-ons also a CI entry point. The policy excludes undecided art and provider fixtures; no secret is redacted into an exported file. Art rights, final links/wording and publication remain decisions for the person.

## Selected Git files

| File | Bytes | SHA-256 |
|---|---:|---|
| bin/hypersvg.mjs | 9320 | b4cdbfab8ec719ca6e3529a6e60fbe302a72b791c1cd27a9710211e270114fcb |
| bin/starter/AGENTS.md | 958 | a375b944da92971a686f3209aeb825c857e754d5df9685d414252f224fc34f1e |
| docs/browser-embedding.md | 2341 | d9130276db778b6b7f04e6b50732ce75f9b13ac937d786ea6940e5d1b4e75975 |
| docs/guide/examples/ad/ad-160x600.svg | 904 | 7755da6366adeeccc1eefee6aaadafda856a4f504162e0b18564a96312ac3f9c |
| docs/guide/examples/ad/ad-728x90.svg | 900 | 7d194c4f73964c8275a3e2240d656604152f14ae36ebf29eca43bb50675d73bf |
| docs/guide/examples/ad/ad.json | 345 | e8a53378e7790e0d30da531df393093f06fd6e2ed09f288f2d90eba98e2cb5ef |
| docs/guide/examples/ad/experience.json | 632 | 47d571890ab238d80ad2a713df11113be84929e5f5ad41c8aece0ddcc494a602 |
| docs/guide/examples/harbour/crate/component.json | 526 | 5c6ce40c1c1c739226b02fbfedf661ee07ce40e1363198123193de04b97c901d |
| docs/guide/examples/harbour/crate/crate.svg | 806 | dd143e13d3d25cf2a585f46ed24997c5b428087564411a7b1007561f14d4f221 |
| docs/guide/examples/harbour/experience.json | 2455 | ab22bce50c0ff8ae0ac6dfd757712fd3fcdc08ab11b5fa900ee98c85eaffa8c1 |
| docs/guide/examples/harbour/gate.json | 236 | 55dfb25d8c5d4c6e0cf02a50bdfb262e046263036c92e8e70bccecbd36db0881 |
| docs/guide/examples/harbour/gate.svg | 752 | 785866cde97be7021e0a164aba29af92ba9eed0ea64c411746ae89d92f18470c |
| docs/guide/examples/harbour/harbour.json | 4791 | a67cc8154c0ec7ab6acea8fc4503e0babe2ef712be8b9c592a097cda0b8cd9f3 |
| docs/guide/examples/harbour/harbour.svg | 5838 | f280b608e451dba6928232bd39d60d4ab4e2f55b6e8e2071cd0db08192bb6c8a |
| docs/guide/examples/harbour/shell.json | 1170 | 62aab62e75f605c5e9ab2bb6abf1cbc709c1a97655d9c795e02ea6ab140621db |
| docs/guide/examples/harbour/shell.svg | 1418 | 7af9d812f061819f73dcb7980978e65534cb3ba56a7337a09125e2f6915b9839 |
| docs/guide/examples/lamp/experience.json | 554 | 8d51040446878602950bad84c8b5e80355c766e2a2701c37c65fb14a2b5524bc |
| docs/guide/examples/lamp/lamp.json | 444 | 6183600c86ca809417626695608ad62671ad6ecf0a88e7099b4fa2d5ee2a5682 |
| docs/guide/examples/lamp/lamp.svg | 1052 | c20685696e23e403e343b6f6cfa83210457d27f4d158415be77d40ed03a1c1cd |
| docs/guide/examples/light/experience.json | 279 | 4ad574e1a8a839e2301c34b1cdf76f543db18750d403cf37779255f8aff95b3e |
| docs/guide/examples/light/light.json | 595 | 39f55eab727be274eec7a1b5cbbeb2ab6074887b432b6bcdcb18494963f2309d |
| docs/guide/examples/light/light.svg | 1397 | 6ca9159819eaaa01ec0a7d0e2305cef630f9753258dfac87ef5874dcfa8dd018 |
| docs/guide/examples/list/coast.json | 1140 | 4a76a05f88b0f94e2284ee333a8db5756280ec96498c3e862a1e8527d1e4111f |
| docs/guide/examples/list/coast.svg | 1265 | 47795e75c63ae9fbddaf56d6725a89cb7eed26ad8e5719588591519771aa7863 |
| docs/guide/examples/list/experience.json | 239 | 980ae1ad68229a8749f5406a1d6980c1cb1bbae30a6f465c552dec64e2739c23 |
| docs/guide/examples/list/sign/component.json | 246 | 752a51f0f0bb9312f40a82699b82d14928b68c0aa2b434a903668d8519cfe8e2 |
| docs/guide/examples/list/sign/sign.svg | 413 | 3f595d5f1031e0a939644c70768d63befc725aa50ad076eb6d1b61ba20ab1f86 |
| docs/one-page/example/experience.json | 192 | 3777d82237c0cb2894675c9f83b3019949a260f9adc6f08790127de7827b811d |
| docs/one-page/example/scenes/hello/hello.svg | 874 | 12f35af95b75ad21792f2b914613b09496609412c7eeffd94118f309712e773c |
| docs/one-page/example/scenes/hello/scene.json | 655 | 80b61bd21672481078c6f667091b07bf71ab74301704e13ab00c134f87987512 |
| docs/readme/lamp-off.svg | 497 | 234a99f5d5004d7fb63cbadc0062332880354d643bb3c1e4aa9ef2f85b94fdd3 |
| docs/readme/lamp-on.svg | 497 | 8315c660614b212b4237800d832b1caf407c7efb37fde572b93f51d3bce05123 |
| docs/readme/lamp-preview.svg | 1824 | 7584d1f851723d3892289b5bb7ede7fcfa25d991798a57f336cb6f5093727318 |
| engine/v2/README.md | 32617 | e88313d55980240ae4b39f467c87486fc26e24fece982064382c69292d559827 |
| engine/v2/addons/README.md | 4292 | 5bfbb862aa870b832676b1b1ea4e67db0f3eab401ee22ea6d688aa5155b2907e |
| engine/v2/addons/breathe/manifest.json | 1627 | 18416c0568057a95b9e78ffbce33f0f6a669594b2c524338c3535f9aa3158d51 |
| engine/v2/addons/examples/addons/example.glow/index.mjs | 2005 | 5503be79d5fffe1e1efde0ffbc30be2e68e1845e202fd8717a40cd7ceb429471 |
| engine/v2/addons/examples/addons/example.glow/manifest.json | 1263 | b7318acd10b3719f8355ec2748801c7a76652d39e9e73dd14f8650e25f528f28 |
| engine/v2/addons/examples/addons/example.noughts/index.mjs | 2336 | b8fd6fd0de389f50977dfc188a1817e2a85703784362215c22b8dfa73ab6a006 |
| engine/v2/addons/examples/addons/example.noughts/manifest.json | 1525 | 4ae967c5bd78237918ccc62b4c193e8a35c9ca0f8b68d637c75852e0eb3169ed |
| engine/v2/addons/examples/addons/example.noughts/tests/noughts.test.mjs | 1247 | 4efade2ff3c76e5370ee106e1f0a869b60284ea9c78d7abd0972ed0f6e59a4d0 |
| engine/v2/addons/examples/addons/example.shake/manifest.json | 1084 | ec2487615d5ef9d8d226addc088eb400c65abc12259ab15d45ac8d98cf09f685 |
| engine/v2/addons/examples/addons/example.steps/index.mjs | 1448 | f91fe9af8f3712fc8909144d8a75c2c3dd100cbf3d0fa6cd1ae80190cbd814ba |
| engine/v2/addons/examples/addons/example.steps/manifest.json | 628 | 465711962da0ed69679230491ac4b03ba8e465e7c20f2038a7504438cccbeab2 |
| engine/v2/addons/examples/addons/example.sway/index.mjs | 506 | a011cbe22a261dcb1be4d7679ce654914b4b69d1441b86c2fa2ea09d93d3703c |
| engine/v2/addons/examples/addons/example.sway/manifest.json | 624 | abccec592ae777d67c75b73e51652154fe47a71b880a763bc517ad1f65d2911c |
| engine/v2/addons/examples/addons/example.tint/index.mjs | 1311 | 981493accc6778b1962973ae9122bb520f2437df242dc1d66821fb446748eb19 |
| engine/v2/addons/examples/addons/example.tint/manifest.json | 1197 | eb22ca06a8af2b760c3acf1316e710ceca8e2be5fe9a40abb5e08ffe8d85faee |
| engine/v2/addons/examples/doors/experience.json | 845 | d1276970e6fe15afba60b965213374177739e40294ce41eef9498f8e0a9400ff |
| engine/v2/addons/examples/doors/scenes/yard/scene.json | 757 | d377501ee2c6a3a127273f79f06cd034c81f1051f21cadffd861a90ba54eb99f |
| engine/v2/addons/examples/doors/scenes/yard/yard.svg | 1231 | 0ee25bfcbf0b7c2f13afa3952e3159a51506a948e39e1516430f1ae4ac45cd9e |
| engine/v2/addons/examples/lamp/experience.json | 589 | fea8bda7db47223c0b15361dee17ed0a6afc77b49e1ff628298df463a35ce69a |
| engine/v2/addons/examples/lamp/scenes/room/room.svg | 647 | 6d712c215947e148e1627f0679f8f5781725182f1087a5ea219bc2427d8f2122 |
| engine/v2/addons/examples/lamp/scenes/room/scene.json | 703 | 4a59ca229fbbaf7b6ed454c54dea0e01e9a231b7fdc1c276102c00b36efb8590 |
| engine/v2/addons/examples/noughts/data/lines.csv | 99 | 0935ce6cb195f4841db701a4305a21b4a5e72fa83da0daf610e5243d6b22403c |
| engine/v2/addons/examples/noughts/experience.json | 4433 | e03e6039388f63166464b4d010d64c5fc0a8de4d5718a342629b680fe51d99be |
| engine/v2/addons/examples/noughts/notes/art.mjs | 30382 | e22f87ab8fc74fe8367c02ef9c8cd02962a3dd81c6655ea207458de678280579 |
| engine/v2/addons/examples/noughts/notes/geometry.mjs | 2163 | 97f03965b3f9d4aa0f47b7bd954184e515c8a0955008e5064d1d957b65c06dfa |
| engine/v2/addons/examples/noughts/notes/make.mjs | 40394 | 53c416377dd0d78ec6cf4ebb75ee7adfe488f96509415af8834a87cbc668f4e6 |
| engine/v2/addons/examples/noughts/scenes/game/game.svg | 68337 | 1d0785d6615d0ed226fddf29f4066949fe6a72e28cf63678e21f03ad82145327 |
| engine/v2/addons/examples/noughts/scenes/game/game.tall.svg | 70660 | 68b4249bfc81877f8166fab7aef05b32777d112e240a7805c71309657de8d2b9 |
| engine/v2/addons/examples/noughts/scenes/game/scene.json | 34910 | ea21a24bbcfb7312421f3ecac3240276469eb0b324c53ff3af33aaf6bd3486f7 |
| engine/v2/addons/examples/noughts/scenes/pick/pick.svg | 40506 | e5e7d1978448cb48032617f44034d847e529d24353fd8db7cf54ac2444eda0cd |
| engine/v2/addons/examples/noughts/scenes/pick/pick.tall.svg | 42037 | 294a41760f9c508889f8267b46d7002d98577f280b629bf9d28e41e69edcc8a7 |
| engine/v2/addons/examples/noughts/scenes/pick/scene.json | 7047 | cd985ba06f11fa893337530ff39d130252ce88924e22b572ff0a15ea43b7763b |
| engine/v2/addons/examples/noughts/tests/play-in-browser.mjs | 10301 | 510b07605f0d2b9224d423181065804195f878014a84e31bc45d04f23961feed |
| engine/v2/addons/examples/noughts/words/en.csv | 528 | 127982a01a2a2097ae74e5aac34ce5bf94793bce42367860aef0b790e61fac4d |
| engine/v2/addons/gentle-motion/manifest.json | 723 | 7cdb51e2890b74d05ee34a522fc8dcadcd79e8ebafd9499d5514ed5e33fe24e3 |
| engine/v2/addons/pop-in/manifest.json | 1968 | a078d249352271b09847b4e1965df6aee4610f344771e9dc4d4e574420877f6d |
| engine/v2/addons/wobble/manifest.json | 1822 | c4201c9c9808958fcf8cdbd667c49dc6df976803aa7833708513baac2e88fae6 |
| engine/v2/check/absent.mjs | 2683 | e1df2329864d1c53297ce6131102539009a7c0c6cbdc1aca1d04608e2b68c727 |
| engine/v2/check/actions.mjs | 4652 | 1a09bcb5fc71192b9283a2baae57ce555c92761e9e13b357e40e65445542d48a |
| engine/v2/check/addons.mjs | 8733 | 43be6ab2579897250f25740ac45b23a7371882e772077f402c380712e54c934a |
| engine/v2/check/budgets.mjs | 3502 | c7c1aa1137e96f4fc580c06017814cc7552e0e358c2ec2a8a5a8ff0da15f1278 |
| engine/v2/check/builtins.mjs | 8875 | ef0dc62539fb971812cf7444da942bb7da1cf3d8e72faa84671b505e8bb28e43 |
| engine/v2/check/catalogue.mjs | 8400 | 617a391738da321f05bb2df0df9c7e1cf5674b9d764faf34934931a2f2c4df1d |
| engine/v2/check/cycles.mjs | 4941 | 280022223be825b13683588786b62c6491f0a53a16ae50e76c6af9bf78699433 |
| engine/v2/check/diagnostics.mjs | 8231 | 661029e6fb3907436b88a56a399035fd03a11aea7b51026f52c63e6fe9cb0724 |
| engine/v2/check/digest.mjs | 4010 | 203491bb8eb275bc98d011a36bdee8380261a92f26a853ec9468d68a362d8a48 |
| engine/v2/check/drawing-rules.mjs | 9018 | a823f5ff64aef25de5cdd62623d2f047f88b6c273b8a054f7189d88f24b2b24c |
| engine/v2/check/filters.mjs | 2755 | a32b72f6fd7eaa498dc87c3520fb26ae7025ca50f5fee1e34a2089d920165f68 |
| engine/v2/check/flow.mjs | 12301 | 3fe2beb5757a0b27d88cb3a992c302b8479096e824460c46332a205fcc62e62e |
| engine/v2/check/formula/index.mjs | 27302 | b51e067b3578f650bd4858910a794fbeb0a9aff3c6c10546c89b4ab91ae5f202 |
| engine/v2/check/formula/infer.mjs | 23922 | 9b3c0a8fd41680a2e25035582719e7a7d52990f72a842103b1334734aa647f8a |
| engine/v2/check/formula/motion.mjs | 2288 | 35443cb39d83248ce2f4ce55c5f3449d3a86a8c11573e94345222a6fa7f5e6be |
| engine/v2/check/formula/params.mjs | 1269 | 2850c27a0e7b023aa96834bc3137c09705591d14b63ad199a5997bcf15875654 |
| engine/v2/check/formula/sites.mjs | 19436 | 7870884b479cfafb65f574dff7fc2910a0cda49e776ebdef4ca4dc7b4d9bf31b |
| engine/v2/check/frames.mjs | 4596 | 334f91f8919631aceba0c8a115de572ffc5c2111b88e4e322bc6b3de057c291c |
| engine/v2/check/index.mjs | 7154 | 2fd1dd06234e3efd52ba2810cfb0078de9f4b92b2fcdf7454f6c576c8ba383e1 |
| engine/v2/check/kits.mjs | 23382 | 3f233bb01fb576955f3e568af7f8b5264cfb787c121bc1c3eacd86044d7899e1 |
| engine/v2/check/live.mjs | 3386 | 35db05e7d21c5b1a54dfa241c1488a4ce175f8dc2ce3580429b79477985d108f |
| engine/v2/check/lookalikes.mjs | 8040 | 5e948e87353ff734db2ae19655ea7477bee1b6e44caa7772d5874f163c55e9b6 |
| engine/v2/check/media.mjs | 14744 | 02169c5d14a541e6ed722f4eb069c31ff65d39d4c4fc023e113e8b533cf82523 |
| engine/v2/check/modules.mjs | 12284 | 9a351ae7217eedec5e621483e4c99956c61c672cc6b6acc8083a6365f59f812f |
| engine/v2/check/motion.mjs | 9924 | ffae123905db7fa8cd2b312baf6903cabd11a6c230171ef2593dbce953b55d03 |
| engine/v2/check/optional.mjs | 434 | dbe68620432b6f51de0a357ecd337fac5bf3a53eee6086769725ca5ac3d2a553 |
| engine/v2/check/packages.mjs | 2840 | 2f4d8d84778932af0f485b5e19d31b30ae96582500bf40a06a382d510d9baca9 |
| engine/v2/check/page.mjs | 11963 | f4a2e056b39a9c0d61abe28b3cf039037947a46a4b3b45d87d3cde60061e7864 |
| engine/v2/check/paint.mjs | 5404 | 6757dafc873097e37c4d926119078688a60bfe5e2daa763bf513cec5bb36ae82 |
| engine/v2/check/paint/geometry.mjs | 8713 | 1fac2e1ce66aaa7ae45a55f0747495664a731cb5d0c617dedab8ea68e52cfc02 |
| engine/v2/check/paint/measure.mjs | 8324 | e911679e291e8a50bd15b03ddff495c10b84acc208ef7fa9c4ae6b3e62b006a6 |
| engine/v2/check/paths.mjs | 6564 | 570189a0903c1bc417358522d411df46e6569308224785559b354fb923bfb86a |
| engine/v2/check/pivots.mjs | 4590 | 10f89f0bb86a732af540577acf9f1f68c8761b68e2fdbbb6bf5251483daa318f |
| engine/v2/check/places.mjs | 2272 | ff6481a81a3df73bd14d0328d82f80e731dbc67052a744e7772b5249d88992e3 |
| engine/v2/check/plans.mjs | 16288 | 8e732c045b94f5c338ec49ffff2564eefe9d25245c7bc6a28e1104594d01fe55 |
| engine/v2/check/refs.mjs | 32716 | 136732005b4221d4851c9647320b493afd2d5ef33dd47cabacea7832b2109b6b |
| engine/v2/check/refs/drawn.mjs | 1669 | b14323061b722be13250bbcfab3b07818b74073fad79bc911064ef289deb5105 |
| engine/v2/check/refs/events.mjs | 2173 | 744c6ee01f9a4035d5f54fac8753f0be7093bd912401c07ac06a04a085b19140 |
| engine/v2/check/refs/walk.mjs | 3979 | 91e3811225bfe2dbd8c60f334cc96641d53581cb3c812423312dc7af4c4829f5 |
| engine/v2/check/renamed.mjs | 10687 | fc3b93e2ec5e2703b2e3ab5cb1e7ae2feff763c758f964712b4f2ef04bae9a5b |
| engine/v2/check/resources.mjs | 7487 | b993cf57e0debad6f4388d7b36e4dea74a1bd6239736a9bb6e7c131cb3145976 |
| engine/v2/check/review.mjs | 13190 | 36373430b222ca5f55abcc8a8f66a9206b0bfc54a2e3f2f2bf04915384949e96 |
| engine/v2/check/roles.mjs | 5807 | d6706185dc54a540f1747063449c526ed5e776177906320fc55e6c79533205c4 |
| engine/v2/check/rules/combine.mjs | 1928 | 448e107d3d5f8dd702ec09a03e9d71e0c99f12ce6e820b6e1d352fc71c4f06f1 |
| engine/v2/check/rules/index.mjs | 15566 | 7da6ed069114fdd9e0a0a5f0f3948043bc58b719b76c17b93e1d1bb5fd774204 |
| engine/v2/check/rules/playing.mjs | 4080 | c0ca344091f864f326be097ff5442c83fcc0a604b75ca8e3dd8ae40aad5d7f17 |
| engine/v2/check/rules/tables.mjs | 1428 | 4f82f306a1770fe802e308ef6fe70c5b002dcf449984c2249e48c2e308e51e56 |
| engine/v2/check/rules/values.mjs | 9214 | faae3c48f2f831a993850a5fd9736063e2a65ecdb97600ceb1e2bf813def9321 |
| engine/v2/check/say.mjs | 1231 | edc09b5f66074b56ec2888c2ca2e353ad588b92207f4f9b5d6d7b9b7c32a28ae |
| engine/v2/check/seats.mjs | 10567 | 101df931651686f9fd2ecc18f57ab64b8ad09d6b54cf3542b0943ffe0ff1c4cb |
| engine/v2/check/sliders.mjs | 13925 | 4690f9ba84795ef62e835d59eb19d17543d29a089cc478bafba7a9b06354770c |
| engine/v2/check/stage.mjs | 3891 | 690db7a4f54077fa838a8c3e394a2d8c36936efa1ef973151deb54cf1b6408ee |
| engine/v2/check/story.mjs | 549 | 68f4f50fe2d6f16b0c8b5fa7e2b50f090f811084bf8b522e971371fe90d708eb |
| engine/v2/check/story/grants.mjs | 3808 | bdd12828ee3d668afadd9bae0841c4378b6e38cd7fd3867e513ae7c461bd0d3f |
| engine/v2/check/story/graph.mjs | 24359 | 059ba11e93d70c48ad02c578069f30bba1db5df2c2233c1ba7297749d97a812d |
| engine/v2/check/story/model.mjs | 5790 | cc96c40095a364624dca702edbe39654def36e4eb782827eb953d010042c0d9c |
| engine/v2/check/story/needs.mjs | 11140 | cae282751d754ee88a1531a394ea0ea3e77f9cf150f858cede8664121389f35d |
| engine/v2/check/structure.mjs | 5012 | 2a7161ed9bbcfbc6620b6573bcf2626dfacb59264ae49559fcb0dd1c6becd406 |
| engine/v2/check/tiers.mjs | 3681 | a1c84f8c0782bdac2e8ed65c3d1280ddd221776f6942815ce01e5ddf0173c1d2 |
| engine/v2/check/words.mjs | 5451 | aff2b993c2e81cf7aa7174880a335a51880a29d4e253dfa4f2b493ee8ceb9ad5 |
| engine/v2/check/writers.mjs | 6939 | e469e39170dfa16e39fcb556d683d031565b6edd2e700e589096fabfc3adccfd |
| engine/v2/modules/README.md | 6912 | 513151dfa273182c45f7909ce5f4a4f83876da33c79efc4181047ed5adc152cf |
| engine/v2/modules/lock.json | 196 | 9fbb966de532e478470eee86b1260f6e38e715dd73f7d4be4d8684e5f8610208 |
| engine/v2/modules/make-lock.mjs | 4066 | 56014345b5ac45fa373e3e18037c62b1b71a70c16d0b9a626db3a1ece2171a3d |
| engine/v2/schema/check-document.mjs | 6803 | 4aa3574a0b942ad88f2a21fb64bb4dd3a5c4a0b4b1d351d9a5fb8adb59e20f59 |
| engine/v2/schema/drafts.mjs | 8221 | 30eacb98207e0d78eeca7f3b3a9883e7dafb8f32a0c9f8d7b67065cf87dba64f |
| engine/v2/schema/drawing-check.mjs | 25241 | 763b09e005a4d9a4918bf6ae60f9f9fe6797d1954339cc5c2a60aee15ebf248b |
| engine/v2/schema/json-strict.mjs | 3640 | 9fb53d237b4d7ff523da54e73da7fe2d6d5fe19c076e582a59ac46cf3eb8921b |
| engine/v2/schema/load.mjs | 1030 | d38205ad4140e6a45e0cfa785442b2b2756285a0936df0596a31a98f9d4ccd8e |
| engine/v2/schema/validate.mjs | 10170 | ec8c66ec5d33717730a241c9117569cac077188d51bcc1908802d2960cf7fad6 |
| engine/v2/schema/xml.mjs | 5136 | 0a772b1f97580da6f821bd0050394515d71b9df2e9666ddff43e93554c2c4563 |
| engine/v2/src/addon-door.mjs | 15363 | c9283ef3bff2b3182d94bb6ad94ea4472a7b9d2b49f859075cf6df7f55e209d9 |
| engine/v2/src/addons.mjs | 30080 | 66a2f5d32d18d8e017a86ce1c63e3792498adf1c0827f40b2616ef16480f8973 |
| engine/v2/src/asset.mjs | 6393 | 86c5d75894a2007c60f7966b365e4d59009228763797636dd6ccf243afc377ce |
| engine/v2/src/binding-words.mjs | 3114 | feab1402e0a316f51bad975913fdc27ac271ce145e6ea92449a9d5af72630b85 |
| engine/v2/src/capabilities.mjs | 29424 | d5a62ef78966544e464f1a65a5720228ff4449bc2a0eb95eb34b6aaa0b93433a |
| engine/v2/src/capabilities/all.mjs | 203 | 41a697965c3fd3ccae0edbc2bdbd065d4199f83b94b71ff0d9b26bd28fc8a2e8 |
| engine/v2/src/drawing.mjs | 104743 | d23661863da5ac6fe1c618b66a9bc6c907ef963b90f0c0506f56543c7a41c21c |
| engine/v2/src/ends.mjs | 645 | 96e75ddc72c85bd4cd252af2365d0bde43aa3f9993e2021d0dfac5d92971a9aa |
| engine/v2/src/entry-key.mjs | 1057 | 56df11392043381170e759fe4934a9892791ca91b234e45e3bc0d0228659c423 |
| engine/v2/src/fit.mjs | 10535 | 29ae88fb9da3964675aab0d86cefc9a5a924ee6d881b5693b61e28de1f245a07 |
| engine/v2/src/formula.mjs | 28501 | 98dcc55b260b7504fb9ad2a2d32c80f0d3e5145c851e8b388fd88d9d9800b42d |
| engine/v2/src/grants-asked.mjs | 2609 | 5785a22bd99c5f6fc0ec88ddf094eeea78025685a1f4e049abeaef87c7bd2890 |
| engine/v2/src/host-profile.mjs | 13761 | 091577b0de500b79090f204fe18852f98a7d3144550bfb72fc474a2dfec000f8 |
| engine/v2/src/host.mjs | 21389 | 9ff03da5d3982a445777a67c247d02e1fbb7cf294400babd4389911a20f1641e |
| engine/v2/src/kit.mjs | 21657 | 08cfbcb10a91fb5a2ee6a892bd9b71f9525734350f9305a326c4f2651d256bab |
| engine/v2/src/ladder.mjs | 7772 | 128bec1fa138d48c1813ecc532fc6ba3f2942c782f63f17afb97e5e8fa709785 |
| engine/v2/src/layout.mjs | 13801 | 8e3b5fd79b8f5c97297e7390391d77ddf0e97237f617932e3473942b113fdf17 |
| engine/v2/src/limits-runtime.mjs | 23598 | f79f14c5c98a05560d31bd2d0fac7070b45a471de07a12e5c5c6d14611914c3b |
| engine/v2/src/limits.mjs | 5493 | 9e137be62d457b094b01a83b781fcc2774b1f4494051f7b04f5ee7eff007d78c |
| engine/v2/src/load.mjs | 15829 | ecf0f10a3424c5536c7f6fccefbba5571fd103c3d5477fddc533465637035e29 |
| engine/v2/src/marks.mjs | 1581 | d8c2c2fcc8069049b5fd9c6498de7fc973362c4868c834d5afb051c9ae04ce9c |
| engine/v2/src/members.mjs | 3840 | 34c2e80a10c54ad6b9af7d96a2e7f030be69ef8cb7f6e1823d97a1e830dceea0 |
| engine/v2/src/mixer.mjs | 5499 | c529fcff7b5c3d7ddad323ea0d25225ff73683b22dc23d925995d8b9402637b6 |
| engine/v2/src/modules.mjs | 11627 | 02df94808bf080beb6f2c94fdafabbc7e1111ba6080d4b0a027f95b5553a932c |
| engine/v2/src/paint-channels.mjs | 1805 | 0bcddbda3f201522341f9f08529ed0d302cf0575b035e9242a61b432a3b57635 |
| engine/v2/src/physics.mjs | 3190 | df28cd9cdb9b2256281a20147bb869546d31d8efecf8e9b0def3fbf5fb1b8a73 |
| engine/v2/src/plan.mjs | 27283 | d1b7b4a1da53797de58b9ae9ece040ddd2e37a63e0eedf9dba19bb1cc0e239f1 |
| engine/v2/src/read.mjs | 14793 | d8b364ee0cbbcd1c517d2b8edd728dea0dccd092c82ed752f053e92468710428 |
| engine/v2/src/route.mjs | 6536 | f285f6e808744fbb0eb397c5030e08e31bbe2213ca4c237a46ae3e4a758b461a |
| engine/v2/src/runtime.mjs | 118555 | d4866d29aba8e4b078fe240ef481e48b1c9d152d571ddd9bd32e65cc600a4e76 |
| engine/v2/src/storage.mjs | 6226 | e32447e262b969199c73a39aca397df1a797031a5a6c6cbe70a4c2ae9d7fd610 |
| engine/v2/src/story.mjs | 18711 | 64051347947246205339dba0a7fe6f927e841efb750823f0610ba23eeefb9a25 |
| engine/v2/src/tiers.mjs | 7982 | 5e9f34ea49953b6fde3570a930bfc68f901f4ec0941df5bc6c2d7018a4004cb2 |
| engine/v2/src/widgets-of.mjs | 1119 | e62c164e20fa9483c96429aa342e3d9c0e088f3799be0e27c82d11f49674cd2c |
| engine/v2/src/words.mjs | 2399 | f7a42434684597109728c93c3c1616d258a3ec1cd6c2d712440a1cd11dbdaf3d |
| engine/v2/tests/a1-check.test.mjs | 4198 | d67bda40b043894a33041dfcc002bd6f0de52f45cb294657e095fd19e6572c08 |
| engine/v2/tests/a1-fit.test.mjs | 15204 | d45853f92c494ee0da8fa2c5ce0005e0d474e75b473c4898bd41a415c3b51e28 |
| engine/v2/tests/a1-plan.test.mjs | 11420 | e0198f907796055089bdbc570c82dab0aefa5dfa8ed5cbee026af97d5bf2a64e |
| engine/v2/tests/a2-audio-web.test.mjs | 9455 | 8298e33724e4b6dc5295e698d6acc8022acdb8c245bfa4bd7cea20c6998e243d |
| engine/v2/tests/a2-check-tiers.test.mjs | 3113 | 9c51cde54048c6e797d9e654ea122b6515e342ecb9e25d3e5a8cc939f9682ac3 |
| engine/v2/tests/a2-ladder.test.mjs | 9699 | f550a94cfa80c9197d5eacd96cfc4a98d6196b15e297474b00e32d1d7270018e |
| engine/v2/tests/a2-sound-length.test.mjs | 4994 | 418165ccf5b385b78fa9a63bff99f2db0b5c88424d0eae06de54f7e1f320675e |
| engine/v2/tests/a2-sound-pause.test.mjs | 3006 | 29a0f9d53e72e2bb597544c9720cf9c372d1cd079a9e4f394310796b2ab21cab |
| engine/v2/tests/a2-tiers-drawing.test.mjs | 4239 | f57a0c014d51620c7626987ea84f5c34dae60e7492f211bc18d5be36916e721e |
| engine/v2/tests/ai-check.test.mjs | 8140 | b50be18145174971d582275912517f3d32f1ad84111d2608288d9c394e20ad63 |
| engine/v2/tests/ai-engine.test.mjs | 11809 | 4921eb9ef4c7bc9f5a99108145d8cfc475f1827d6bd2408019533e87162fb1ba |
| engine/v2/tests/ai-fixture/experience.json | 2630 | 4226b90096f7d63dbcd715161cd1c3a436e3b6c290d467348e80f500c2714bf6 |
| engine/v2/tests/ai-fixture/make-words.mjs | 2939 | 3519ed1f4605cd1dbba67e524106ef405de76e9c2e9663e7758a41ce2b12164d |
| engine/v2/tests/ai-fixture/scenes/desk/desk.svg | 403 | e40123938cb9478bceb3fdc19c2a081f57881352ce0bd0ef8e08210e8453fa33 |
| engine/v2/tests/ai-fixture/scenes/desk/scene.json | 1724 | eecea84f84cb2a31bff8ce3ffb86471e27df8f47a95f6824747ba0e8c68037ce |
| engine/v2/tests/ai-fixture/shell/frame.json | 581 | b88071a4d409093e011c95f6a1dc728312a13da775ab1202149cbbb44459e322 |
| engine/v2/tests/ai-fixture/shell/frame.svg | 446 | 61c926fbd9dcd2b4337bb6a1e344c6bd6a53250f439b0cbc7f0827fabb1d191b |
| engine/v2/tests/b1a-format.test.mjs | 11379 | 5e08d31afc749bb8bb525a14b92bd6bfefb770c2913170c591d2add5b19b10e6 |
| engine/v2/tests/b1b-door.test.mjs | 23460 | 2a57ca89d0af231ed1ddcc847ddbac6af1e301d04e026cf7d56fd53b17c43112 |
| engine/v2/tests/b1c-authoring.test.mjs | 23205 | cccb07e5d70bd821b42ee460ab0677fb3e0e24f971164884946c529e3a38017a |
| engine/v2/tests/b4-proof.test.mjs | 11477 | 9e8912c934480b0719355477f7c9f8b65358bac5fcbfe3342dc111bd1b9eb3c5 |
| engine/v2/tests/b4a-access.test.mjs | 6464 | 55af818cd6c7484ed46305fb37eae4e91c46006ea2ba828253d6542de46e5553 |
| engine/v2/tests/b4b-engine.test.mjs | 18868 | e173578bb1e223b36fd5d2e64e98792551ae09da7fbcc90e42edb81baf26c016 |
| engine/v2/tests/b4c-motion.test.mjs | 15218 | 9f91af668a3e88bab7f696a30daca7558992b340eddb395f0d113830931d2a70 |
| engine/v2/tests/bench/frames-bench.mjs | 2967 | acdeeee4bb9951c3236122915681c0e9798286237dcc3f9738c61a3f3a07ab3c |
| engine/v2/tests/bench/speed-browser.mjs | 3457 | 8b16cba3c6c1f7e4d260974ee425595a3a95f5f6079dd521a6a5b0647782262b |
| engine/v2/tests/browser/ai-browser.mjs | 5870 | bdaed85438516031a4e1ae7cdf8765538b8b6228d1d9cb0ab91698680db99ac2 |
| engine/v2/tests/browser/b4a-access-browser.mjs | 10001 | b44d990e82b3ed2f8d754037d063eedad9197d18fdb955e9dd71be92f32a0aac |
| engine/v2/tests/browser/b4a-fixture/files.mjs | 3597 | 0f47f34da6cf2d8d13892949bbe9d635ebbed34cf339dc556c57e5991b138cf7 |
| engine/v2/tests/browser/b4b-browser.mjs | 3519 | c068a06efd5bc7ef1b0c8cf66f4dd3750b3226b0b8448453d8667fc095fdded2 |
| engine/v2/tests/browser/b4b-fixture/files.mjs | 2882 | 9c5d55813e962d4358f7b6e7a79a824617ec0ee8b263fd4ab26b4fc1941158d7 |
| engine/v2/tests/browser/b4c-motion-browser.mjs | 7949 | d30251154a9b420d7665c6c4c91217605e18c25378827e8d63d7d106d928593c |
| engine/v2/tests/browser/baked-browser.mjs | 3320 | 7cc99846a9549cc1d57b26d5b9967bd924825641477ffef22aafe72a97671501 |
| engine/v2/tests/browser/drawing-browser.mjs | 17526 | d7939f7786da6fd9228392c7b202b426f90d49022ba55d07ddf697fda2e17876 |
| engine/v2/tests/browser/drawing-fixture/files.mjs | 7761 | f2ef462edac9cf714d84def2a204b43053ef476231bc64a0929edc8b5a5d7c9e |
| engine/v2/tests/browser/e1-controls-browser.mjs | 33425 | d6daa158bbe8355e89e914f9859e2a864089e0137ada3434abf9d286153f2be9 |
| engine/v2/tests/browser/e2-pointer-browser.mjs | 11520 | 190fa8ac86b2ad6d4a2acab86cc2449a6b19e43772917c20c836b29dcf5e4c19 |
| engine/v2/tests/browser/e3-dialog-browser.mjs | 7383 | 9a6ecd8f1728530b1b276a9288e329eed6c8b1448e19cb6a0228853d28e5a60d |
| engine/v2/tests/browser/e3-dialog-fixture/files.mjs | 3202 | 7531bbfd631b3968b2bce17f6deeb5f480036fb1c6b0afbf3a211716e879dfff |
| engine/v2/tests/browser/f1a-openurl-browser.mjs | 6215 | 738e38fd2ea3edfe10319e6b7f8d51fd928be64f424c43e9b9d4d5f83ce84bad |
| engine/v2/tests/browser/f1a-quiz-focus-browser.mjs | 3535 | 0bce91d23c25a55b83ae0b354981b7d4c82595d648d6c432740364373af55185 |
| engine/v2/tests/browser/f1b-tint-browser.mjs | 3769 | 009cb57843adb71f1d547f227c834dccafac0844e3cecb67af937444712a2834 |
| engine/v2/tests/browser/f1c-browser.mjs | 6877 | 24bc98cbe0b194091e81a3fc6c8d865d2b8e44c87e6d627e4fcc44b7ccd53ce6 |
| engine/v2/tests/browser/f2-slider-browser.mjs | 12137 | 19f4528cf6ebbff87662d3c9a6557633dc575f66c8f24366147a211ec3e046dc |
| engine/v2/tests/browser/fault-browser.mjs | 7502 | 94704b3e229a1a12305098e5a1b8d70ed71e877a4c46429f135bff903b07009b |
| engine/v2/tests/browser/fault-fixture/files.mjs | 2087 | 330658f5baf9b915c845770913a4d4bc6bf8dbd9886da6c8228843ddd72cfda2 |
| engine/v2/tests/browser/fault-fixture/missing.mjs | 4961 | 45691bf74911d42ea5376925a466ac7b9112884e0436334047157a0d54d0a789 |
| engine/v2/tests/browser/fit-browser.mjs | 9595 | eabd90e81bb028b4df6ae6aee4f9b3e09479bae2edde35a592e7e91a8570d821 |
| engine/v2/tests/browser/fit-fixture/files.mjs | 4023 | 8dd9d2ac12ee4a4caf2de02744c7941b8379fef769f60588b240925f55e2ef0e |
| engine/v2/tests/browser/frame-link-browser.mjs | 7603 | c859f3f7befc71c7eaebe7d4691195269599f3a728f604b6f099888b6eed6913 |
| engine/v2/tests/browser/frame-link-fixture/experience.json | 738 | b1cf6c35d61ea84f1a8229737677edc69692ea2a35428f787963f2215b5da466 |
| engine/v2/tests/browser/frame-link-fixture/scenes/hello/hello.svg | 1038 | 3fe7ede2ebdf74070b052e7d53935e01c91c80bdac1b13b5df06d64edba6c59b |
| engine/v2/tests/browser/frame-link-fixture/scenes/hello/scene.json | 995 | 66ede06bce937e06b0b9306354b533fff8e4c0d5168e4e6206b04367f55f8abb |
| engine/v2/tests/browser/host-outputs-browser.mjs | 4373 | 4c9030ea32397abb3feb8720e8e46b8878c90d4e207f132b16b4be59769934e7 |
| engine/v2/tests/browser/input-browser.mjs | 16432 | bad429be8d7875b0222a6b90758f84da3618b495ef548e4d91a1a0a65253b030 |
| engine/v2/tests/browser/input-fixture/files.mjs | 4972 | 172468bde930cff8a6d4ec765f887f599f78d881f42904727603dba3fa989097 |
| engine/v2/tests/browser/joins-browser.mjs | 10791 | 7be84a597d80a973aacecec019851b00529d3144a30839c584f6bae65c8c4e15 |
| engine/v2/tests/browser/k1-dial-browser.mjs | 21441 | 102d10ff2b2dbc6188bbb6d758e59b2e156cb25ebf6458e0bd809f964b465aa2 |
| engine/v2/tests/browser/k2b-marks-browser.mjs | 4899 | c84b53c1d1fed88d495c896843d74434833cfa66c8c6346a83163545002dbc30 |
| engine/v2/tests/browser/k2d-doors-browser.mjs | 9520 | 5484349fecb2ef593120e034489816c0dbcaf478c12a7224ade8a55f6a8914ae |
| engine/v2/tests/browser/k2f-asset-browser.mjs | 19407 | ad4ad4efe2e1afabd5d965ce5e284c099692d3620026810ad993f2f96b7d93dd |
| engine/v2/tests/browser/k2g-hooks-browser.mjs | 6962 | f56486e9340d21b69b327c3fe41fa387a84efba08d0dfd7c0032739fe48ccbf6 |
| engine/v2/tests/browser/k2g-polish-browser.mjs | 4900 | c9046e292d4873b0d24c8f189ceaddccd07781da33658314814af57da750e095 |
| engine/v2/tests/browser/k2g-sound-browser.mjs | 5682 | daee260b6519c76a4a102e99271a5445ae4b03cf103259c092d91d11b644936d |
| engine/v2/tests/browser/k2h-test-browser.mjs | 6033 | 90d26116a26c675e58e0d4fc326281256ea62afc9bded582d6121be32810ad79 |
| engine/v2/tests/browser/kit-ads-browser.mjs | 8068 | 93a0421ec114feba62559b0ca3b791be986e7aeb244ba38bc85dd61e48fe6e0e |
| engine/v2/tests/browser/ladder-browser.mjs | 8705 | 4356c72a63dae022e91b9149d955b63afcf1b23ccda40d708d41a729175f1ddb |
| engine/v2/tests/browser/layout-browser.mjs | 6097 | cf2a01dacc858a45026945529f7d7504d588cfaaf25dfe3e01695da27b1bcde5 |
| engine/v2/tests/browser/lines-browser.mjs | 10115 | 45b825182bc7a4540637ef0d923d5db1b25359df4b330445d6c0a134032036d6 |
| engine/v2/tests/browser/motion-browser.mjs | 15214 | df0372338f509329ee9bc8d8dd137a94bc67548287388f4dc4327effa2b4e99e |
| engine/v2/tests/browser/motion-fixture/files.mjs | 5520 | 57912f9661c2378fca918e985d9a279486e827ee4a6254a06308e76cbc33257e |
| engine/v2/tests/browser/mount-browser.mjs | 8159 | d4ce352a1536eb3f0eda11145a0b2eb4fc867fa57199fe7d2f7eaec405b1a82e |
| engine/v2/tests/browser/plan-browser.mjs | 8939 | fa12eb79c3ae555376e408a06cde54e6153a54b95e8e70aba6e52a3282662c6e |
| engine/v2/tests/browser/preview-browser.mjs | 7801 | 8c6ac4f38fd423a231d4f385da6638a6c428ce8f4677eacca6bef561e32338b8 |
| engine/v2/tests/browser/q1-player-browser.mjs | 11136 | 1470042e69d112465988dfdc52737c5fd39a5303801d359d7c30f4070bc60d8c |
| engine/v2/tests/browser/richtext-browser.mjs | 11052 | b02936b4a211a2a3c05da8505494538f01ee68016225d723ae81ee39956a83bc |
| engine/v2/tests/browser/shell-browser.mjs | 7812 | 0e2240ab976a70e17dc223f91f03d25dc7ff0503ce378f5d98a95ad704d98670 |
| engine/v2/tests/browser/shell-fixture/files.mjs | 3809 | 2e0adbc1eded5ba6e2fe3db1ce3c38573c6e3e769f01cc37763406d0730f0d52 |
| engine/v2/tests/browser/stage-browser.mjs | 9189 | ed1d0dd5a5067c4dcb3ada2a22cc7f48c83a89c70e74105b4b98134d2f9e7a57 |
| engine/v2/tests/browser/stage-fixture/files.mjs | 7020 | 488454ef9f2a43dc762f960177bf1355f354e9a120ea129ff1366e8a9c8499a5 |
| engine/v2/tests/browser/t1-test-browser.mjs | 4292 | 8a678e0c56b8c6262aab26a9d0f1e593bbce4a9c081703176a474d3c2d8313e4 |
| engine/v2/tests/browser/w9e4-press-browser.mjs | 7375 | 7328332d42371ec26036462e994e9972b8971b78d44a4f32365480b204c9f0fb |
| engine/v2/tests/browser/w9e6-touch-browser.mjs | 7985 | 05495c03a10b3af77289eb6e010e4f29aa39137f41b1bd8cbb0567064ba08610 |
| engine/v2/tests/browser/x1-browser.mjs | 3634 | fa45dd7281616b5be6e6a0dc17860cf955f2d2971917522e86e4ccfddf7b8dff |
| engine/v2/tests/browser/x2-paint-browser.mjs | 6018 | cd63b0008dc1b8714ba3cea7e8777b7de54add4a993e8343bf4eadc7270a3c16 |
| engine/v2/tests/browser/x3-browser.mjs | 6193 | c6298b3c6b781fa8f1403af04336f7811c3507df05c8888125cb542575cc54ac |
| engine/v2/tests/browser/x3-fixture/files.mjs | 1391 | c6269272f9b6797014ca14176391adec63ca56afd0655a08f2be39118b8d8ef8 |
| engine/v2/tests/browser/x6-addons-browser.mjs | 6046 | 01dfb95aff61e670d12310acf3aef01a8e049ef14d8235e2c6deffd888f52c8d |
| engine/v2/tests/browser/x7a-library-browser.mjs | 4673 | b8b07a1246eef0a558d3b28d62cc54c7d8163ccd9ffde0fe4856e36b9730ffd9 |
| engine/v2/tests/change-fixture/experience.json | 1407 | ee79db60bf1ba0ba53baa33f4f0ff9cabeb53558116bcc52b3c275f7793c51a2 |
| engine/v2/tests/change-fixture/scenes/one/one.svg | 340 | e14f766d447e4bdfab671b84a1d4787eb5806e7d6ad84d092c9df483384e337b |
| engine/v2/tests/change-fixture/scenes/one/scene.json | 164 | cf622e6570df53c2c19fda1244a17951cf942cd5f4059765582044c23ee7d1d3 |
| engine/v2/tests/check-budgets.test.mjs | 4645 | 370b77b402d4065c1c999134ccdb7188899c37e638de88cd0339512cde3ceebc |
| engine/v2/tests/check-coverage.test.mjs | 2780 | d9756fee794d9a606fb8d89d958b439f2e727d27dd063e35799467ad48e16bf4 |
| engine/v2/tests/check-files-codes.test.mjs | 11865 | 059f0373e0f0a2d35dc2bd344937d8c27904fd80925d93343930030b54c715d1 |
| engine/v2/tests/check-formula.test.mjs | 24901 | c3770f8df748da873567e862ecadf3a58f4da0bba00d209fab39d8e0db5bfcc3 |
| engine/v2/tests/check-refs.test.mjs | 14978 | 29839a0f694726ccc32f4dc5afaf2128de16032c2c8c8b9851415f4836b07afa |
| engine/v2/tests/check-rules.test.mjs | 15178 | 722bc1acc21ed393a26061471fdacdb937e2a8716fd0ea3571c6b40bd1f2a4fc |
| engine/v2/tests/check-story.test.mjs | 17806 | dfb3b0eb321a3e3a9ea560d1d0cc4d41295773785ddcc2225d05befbd513e587 |
| engine/v2/tests/check-w4k.test.mjs | 21397 | 851afb71736a00212c24ad3c705d55f02c09ac9e4142cb26a2dc7f898c4b4aa8 |
| engine/v2/tests/d1-fixture/files.mjs | 3914 | 5361a142dd43e4e9b377e11bb8fc3dd0656c920e23460e3e6000cf0ec983a845 |
| engine/v2/tests/e1-controls.test.mjs | 3753 | 80d18c187d809f73ece3345decfad79a54d1966bb6b401cdf24c581d245e127b |
| engine/v2/tests/e1-fixes.test.mjs | 9699 | 5c3a8fbb80a93a6a9434402980c187678b9703a45c766a31ea345a94ccf77abf |
| engine/v2/tests/e1-fixture/experience.json | 278 | a2b5fe65ab8fe8c18205405c87c18abbb9a9a9c35cb8a5411964ad1c72189db0 |
| engine/v2/tests/e1-fixture/scenes/s/s.svg | 3246 | fe9a2660eaca2556eb02912b89fd1cff669c9260d325b1d7dbc32434a4d814fe |
| engine/v2/tests/e1-fixture/scenes/s/scene.json | 2669 | 360ec0f5e093efa270076dfe4dff0a1f2d8cd0f96ec780690a921fc30e2d010d |
| engine/v2/tests/e2-fixture/experience.json | 465 | 9f3e470b30f67455a76ac1e294cb65b99af8947ab32495bc696a0e1cb7ae6ba7 |
| engine/v2/tests/e2-fixture/scenes/one/one.svg | 1825 | 187c6d630bea17f0ea138c38c62ee5707ce791564128592415dacf6a14dd7924 |
| engine/v2/tests/e2-fixture/scenes/one/scene.json | 1318 | 68c56b05561ae66224168d0c5428bb57104d684fc4d4a3c449d28081db0c940b |
| engine/v2/tests/e2-fixture/scenes/two/scene.json | 189 | 52d985dd9eb7020a0b73db414d1e37f951f9cb0846915d8f90c77b37078134f8 |
| engine/v2/tests/e2-fixture/scenes/two/two.svg | 595 | ae1dabfaddee8e88a71d9e09ba55b2c7d9315e23398a3830f3c9be98a47a712c |
| engine/v2/tests/e2-joins.test.mjs | 21857 | 888f7cfd0f23d5840a5e3ecd8bf2ee049dc842322d1b156676a9f37cbe9eec1c |
| engine/v2/tests/e2-label.test.mjs | 2930 | 92bf3fbd1e6b6137b96d64234f887ae57b4cfd03c79a5a5e886b0e4cbb0c7ffd |
| engine/v2/tests/e2-text.test.mjs | 3893 | 978ed95eb5442cb877a19d45388c62972575af18866d0bad5e5da9e4967fe511 |
| engine/v2/tests/e3-dialog.test.mjs | 1977 | 47a7b384cbc2e58ecb25bb5c50d3118e6b1ad664abced0141f06634d31cb5549 |
| engine/v2/tests/e3-lean.test.mjs | 19082 | 16c7a9e33dad9881fe3d3062244245353f45a0aff82cae415015448a4bf8321e |
| engine/v2/tests/e4-joins.test.mjs | 28623 | 5d60455e420c0110fdc0578173630629f47f22a8acdb58dea5aefb280de98093 |
| engine/v2/tests/e5-freeze.test.mjs | 21971 | 35786d034722b08a63c30d29693899ad79c77342ee1b1148e60dca682dcc61f3 |
| engine/v2/tests/f1a-fixture/lanes/experience.json | 405 | c0042cf74fa84f41e9b1b8d821e6c897627ff7e275985f55729af526318b1f1f |
| engine/v2/tests/f1a-fixture/lanes/scenes/orchard/orchard.svg | 1422 | bdc5e3b3bc196ad4a58164967f7d7049ff2935f7f04ae02db8d5e49d7e49a205 |
| engine/v2/tests/f1a-fixture/lanes/scenes/orchard/scene.json | 1545 | 0016be4eb6f1a1fe3663f95beaa6eab5d7ea801051cf6e7d2874d2d77392256c |
| engine/v2/tests/f1a-fixture/lanes/scenes/result/result.svg | 574 | c035a0e78da8589188ee87b0cb52e552dffe51be1469fb569b08144e83785a9e |
| engine/v2/tests/f1a-fixture/lanes/scenes/result/scene.json | 201 | dbc7e14cf1c4a151eff62d48e57e08fe8b69fba5c793925dcba9d2236467846a |
| engine/v2/tests/f1a-newcomer.test.mjs | 8310 | ba2724c73463af086e2b7cf0bdaae58f6f643ac7a7fed8aa98f008c5cec857e3 |
| engine/v2/tests/f1b-door2.test.mjs | 9888 | 00244295ba3d1ceeeb5ba9fd66a1722dbe5c14ec66434cc69962f7854cc2ea81 |
| engine/v2/tests/f1c-security.test.mjs | 22880 | 7f0fb729e096804aad104f68bbbe2cfaaf88ca30df9f2922d76bbb9ff22cc401 |
| engine/v2/tests/follow.test.mjs | 2197 | 7858629e186cff3c0b06a2cd39d8c629d150924ae4230e99884e4e0ca8af008a |
| engine/v2/tests/helpers.mjs | 1983 | 46ea7ac6835d3fb8b33a9415e15a11f678dc08c04af720d111593ba8c5415eda |
| engine/v2/tests/host-fixture/experience.json | 621 | 38de742769534b3a2fb5c074ca23fe5128a7b08e4303e1076a2a4b3cda16e000 |
| engine/v2/tests/host-fixture/scenes/one/one.svg | 340 | e14f766d447e4bdfab671b84a1d4787eb5806e7d6ad84d092c9df483384e337b |
| engine/v2/tests/host-fixture/scenes/one/scene.json | 455 | 2332e4cab3d8a41cd599f94ec0b755407c6e74e01e3513589e7aa6ec36b733ba |
| engine/v2/tests/host-profile.test.mjs | 10673 | c6f0217239493bb468d00fc672576ab2c3ecb99e617246379d3cd893f811de2b |
| engine/v2/tests/k1-dial.test.mjs | 16534 | 8e81d734a5bf14f6e3d170cdf2f4d727f33d5c2c6119366b4f615f31fcc8afaf |
| engine/v2/tests/k1-fixture/components/knob/component.json | 1378 | 2ed2662a88c89e96f6d70f244e268ef0697f8840d4c9f06a1b7e13a473a8b0b2 |
| engine/v2/tests/k1-fixture/components/knob/knob.svg | 796 | 8e7035307c96464e4cc196b55ad009501ac23741933b13a99f1e05cbbd7df075 |
| engine/v2/tests/k1-fixture/components/level/component.json | 1142 | 6463a1d85e7ca5b1c1ec58e263685597c803f07db152ad9e9f5417e6a02ad628 |
| engine/v2/tests/k1-fixture/components/level/level.svg | 534 | baed9ad0e965db8b53ea638fc0963afaf8f2e8d6bafae06757b158562fc00d40 |
| engine/v2/tests/k1-fixture/experience.json | 411 | 736dd1e623d0ea4ec81623176561a61e2d41f4bd22626eec731b1c3ff14625fd |
| engine/v2/tests/k1-fixture/scenes/s/s.svg | 1202 | 3db3fc27fa8e3ca80b79220576eac6dd77a927837610acc7962471a19b8f3a8d |
| engine/v2/tests/k1-fixture/scenes/s/scene.json | 2080 | a0781542fbb0b3694032d158847d7ab1dc216200cc65a9df23acba69bdc01672 |
| engine/v2/tests/k2a-addons.test.mjs | 2863 | f443084baeea0b9689885ba749f146f8ab18cc979e15be2688ab2756234cb923 |
| engine/v2/tests/k2b-fixture/components/bike/bike.svg | 574 | 24415f757474d9f24e0ec3b0bf258eff2d386c8f407f96bc09d0996bb8cfc949 |
| engine/v2/tests/k2b-fixture/components/bike/component.json | 329 | 246fd1f9591b27bb2088fad0643009493c1cf8749605502d9a9203d0cf6bebd8 |
| engine/v2/tests/k2b-fixture/components/parcel/component.json | 95 | be96ec050f103caecc86733f6a88fa1303e6058decaa875e1fbd112737c90b59 |
| engine/v2/tests/k2b-fixture/components/parcel/parcel.svg | 307 | 7b89ec0d4318948499dad52c71cafddf1b8582e0c980cf734d614417cc8dc799 |
| engine/v2/tests/k2b-fixture/experience.json | 594 | 6985871202d8ca1ce5f01ab153537f94a0bcfa9087986cb15cf7810ea4a335d7 |
| engine/v2/tests/k2b-fixture/resources/icons.svg | 497 | 8f4ff88854f97eba52772847904ccdddb3fb51b9fa22dd2ee0a3ec141fd8749c |
| engine/v2/tests/k2b-fixture/scenes/s/s.svg | 1410 | 837ed009d2a6fe67c9711c8e54a4f8660c105ba234f7cf04b5d85a456a233674 |
| engine/v2/tests/k2b-fixture/scenes/s/scene.json | 2484 | 758b66a8e4556efae7818150ae903ac0ea5e4902e2c378602e3a23814250ca32 |
| engine/v2/tests/k2b-marks.test.mjs | 19389 | 5a74dfd34fb94139de4d953491878f4c070bde2f605780519e9328eb752b0eea |
| engine/v2/tests/k2c-words.test.mjs | 3152 | a7072f1f6913094e74a99794494d90d778a9ac7a5c608784d8dbbe3a0b9d756e |
| engine/v2/tests/k2d-doors.test.mjs | 22170 | a0616cc00660c84be077a660ba603fabbf98bf08fae4470587edf215edc8fcce |
| engine/v2/tests/k2e-checker.test.mjs | 10605 | 974bc9a491cedd806cedb186274b1d2ac9c322912aa0c93d7c833e8608706686 |
| engine/v2/tests/k2e-fixture/experience.json | 493 | d6d8a78e9bec37915c6f8afa13eb6cbb736a51e31dbe08be3da744d3dbdbd060 |
| engine/v2/tests/k2e-fixture/scenes/done/done.svg | 10667 | 1396dc48a79a3a5bf52b3cf6a3310a80a5ac2387e54b130b1dbe0e570218738f |
| engine/v2/tests/k2e-fixture/scenes/done/scene.json | 268 | f7004c0ae912c7f47a3486c85d915aa4110e40cfbe65c096123b95cff1af924c |
| engine/v2/tests/k2e-fixture/scenes/sort/scene.json | 4854 | fa1093605e7b1595c87f9216f43023e1da14a2c96f2868b28fcd286832de6b61 |
| engine/v2/tests/k2e-fixture/scenes/sort/sort.svg | 14424 | 2e6580d9978d422fca08d974f56a06462b74d69f6dd6f30dbca463580d5e7cd0 |
| engine/v2/tests/k2f-asset.test.mjs | 12774 | 3c3a4645d1255aee186a3974903a74fab53882873e6576eee5c6d63ba98dfdfd |
| engine/v2/tests/k2f-fixture/experience.json | 811 | b1b9d5d3855bfd4d308a9f2caba19d852c02e5ce19c66161ccd321fcdd2d00d8 |
| engine/v2/tests/k2f-fixture/scenes/lamp/lamp.svg | 1576 | 858a13a46be3fb6fc1a788b5074879eabe05932ca0ba15a2bb84e93f2b98517f |
| engine/v2/tests/k2f-fixture/scenes/lamp/scene.json | 926 | 60d7a79b40cd448075b92452fddf4e53f96454bfb0c5f94792ab83d14a243e47 |
| engine/v2/tests/k2g-polish.test.mjs | 9191 | 215a481e54654841c62e5dd013ff2456f38b2a694eb7e7a9806324c1a61253b1 |
| engine/v2/tests/k2h-admission.test.mjs | 2961 | 1c00fb8e1086c8f4cfdf32e2c6f33bd7192dca5a6034f2cf9adac412b188b597 |
| engine/v2/tests/k2h-isolation.test.mjs | 2738 | f501dd660aedbb7388d92cd7c7cfa846b5f8d227bc069ba12f7e6fb4fee84c7f |
| engine/v2/tests/k2h-polish.test.mjs | 13644 | acff40430220a9908cf600319803470e127cb893dbbc70ce18efc8f22f04560d |
| engine/v2/tests/k2j-newcomer.test.mjs | 5183 | efe7fe615653bb676f32aee450b12f16250ed0b53cdb262f923205726bc075d3 |
| engine/v2/tests/kit-fixture/README.md | 716 | 959781abc9d37188d51d127f42cf8ed34fb91d29817b52e514d656c06e4fdc16 |
| engine/v2/tests/kit-fixture/kits/tale-kit/blocks/badge/badge.svg | 716 | 99e6bf7c66cf1dcb65f682fa09690966f9ed0e7157967728f54c0eede8004ce1 |
| engine/v2/tests/kit-fixture/kits/tale-kit/blocks/badge/component.json | 574 | 663499fcbdb894c61ee69489b7e90748a479fef9383e5f6514fe5c86d85f4dd1 |
| engine/v2/tests/kit-fixture/kits/tale-kit/blocks/button/button.svg | 603 | 522356a06da5609184271a477c344a577f42be0e1e30474fff00788af6a462dc |
| engine/v2/tests/kit-fixture/kits/tale-kit/blocks/button/component.json | 529 | 2f73c8f81b268e24cafaa478af428b3fc1b63477dacf855cf3b6a50e34e85322 |
| engine/v2/tests/kit-fixture/kits/tale-kit/blocks/title/component.json | 362 | b1d6f1bcc82f7d36efa8dffc96917282695c98c81923294348101c45eff46619 |
| engine/v2/tests/kit-fixture/kits/tale-kit/blocks/title/title.svg | 410 | e60ef8aa7b328fc2c0bfae3d7aebd81a3921a3e19f07f16a02a2112bf69be9a4 |
| engine/v2/tests/kit-fixture/kits/tale-kit/kit.json | 1967 | 6263b4e7b0b97a599c90e36dbbc896dbb95f371f159244d272ed74b67a7320b2 |
| engine/v2/tests/kit-fixture/kits/tale-kit/scenes/page/page.svg | 1002 | 5b80803746d8e43c857ee67c330329fbe5b975585cbb2eac46184ee39845f2ee |
| engine/v2/tests/kit-fixture/kits/tale-kit/scenes/page/scene.json | 1812 | 63e274191681277f86446caa2717f3cc33cc8dcd3bfc05073a8a15c9e1657021 |
| engine/v2/tests/kit-fixture/kits/tale-kit/words/en.csv | 27 | 87c3abc0922393d085baade2580fb180f0f3640508ece8d1f838f9265e27abc2 |
| engine/v2/tests/kit-fixture/tales/fox-tale/experience.json | 881 | cdfb53c3a01b31a6ce11442fc7455d6fe35a6952bbad981ada4ae55df9802388 |
| engine/v2/tests/kit-fixture/tales/fox-tale/words/en.csv | 60 | 166270d13ffdce9f3a7d8ff5d9e7fad14a93dd2d48c4258012e079d0c61bb103 |
| engine/v2/tests/l1-lines-check.test.mjs | 4161 | 1bc127c0c576fd901cdad3b676fba2c7223d7aafb966dbe1f8ce4bfa0674d9fc |
| engine/v2/tests/l1-lines.test.mjs | 10970 | fefbf038ec79c491cde76d6be600dda2db249621669aba63233555fb5b854b04 |
| engine/v2/tests/ladder-fixture/experience.json | 1690 | 1110a5e66e4de2fc2218cebbdf712cf6ce8e22509edfb4b4c27d46d1ee618e12 |
| engine/v2/tests/ladder-fixture/scenes/ad/ad-300x250.svg | 1179 | 749d9c2168c1544868c84b4e2a273ca5a1982696bbd2927e6393bcafcd470a03 |
| engine/v2/tests/ladder-fixture/scenes/ad/ad-320x50.svg | 1170 | 10e131fdaeaf97a0833d5f15709723d830e88772a08ddd8b02527b4cd7a175b0 |
| engine/v2/tests/ladder-fixture/scenes/ad/ad-728x90.svg | 1173 | 47966592ae352da28f2a402689f566adebb8bbfc1319c4f90c5a636bb6dfa934 |
| engine/v2/tests/ladder-fixture/scenes/ad/ad-970x250.svg | 1178 | d1184347dd886ad3ff9976c325090488cf9413744c2763b49c26e3e528040f39 |
| engine/v2/tests/ladder-fixture/scenes/ad/scene.json | 1787 | 6a6e43bb9969fc60868e0a8398cad58329af844dd91d7625f9c91114a390b6fa |
| engine/v2/tests/layout-fixture/experience.json | 386 | 5baac47228daa6bbc0d0728d181b812ff43b5fe1aff994a94f41e6d555a0053c |
| engine/v2/tests/layout-fixture/scenes/ad/ad-160x600.svg | 594 | 1fb736c170c781c1ff93525025ebd1f69940c3831b4c94a864c36aa87a169ae3 |
| engine/v2/tests/layout-fixture/scenes/ad/ad-300x250.svg | 594 | cdcd46f1f954b9976b04e85e59d056f6df226f3a9d126bd4761b9d20293ade2d |
| engine/v2/tests/layout-fixture/scenes/ad/ad-320x50.svg | 588 | b5c83256cfb738117d10a14c2e181355986732805c40f4d29b4f975c2d2bc28f |
| engine/v2/tests/layout-fixture/scenes/ad/ad-728x90.svg | 590 | 8657beee1e2de2ac455a5f1bc9c7dd62ea5061b2f17f3992d3946ac8cf4452a7 |
| engine/v2/tests/layout-fixture/scenes/ad/scene.json | 789 | f5a504925dd07ec0b7a072d9121704e31054fad9cefe1256678b44a6fa6f3211 |
| engine/v2/tests/limits-runtime.test.mjs | 14510 | b22724ddcfbcc0b2300827a521941ecd4b62e1334e13f68859951e3bd9c0bf6b |
| engine/v2/tests/limits.test.mjs | 8404 | bfa56fb3c10af27eb3c76f590ced37c9d133ea7afd4ef61168d24ac7d3182c2a |
| engine/v2/tests/lines-fixture/components/parrot/component.json | 4416 | 49683370c57571e9bf3b677118b49da4acecc93bb1bd518ebf8ceff88dd60bae |
| engine/v2/tests/lines-fixture/components/parrot/hello-en.wav | 9644 | 2f2bd27c2b0521924bd67aa6e8f0c013ddc20fbf3b0280a558973a0eb04f460f |
| engine/v2/tests/lines-fixture/components/parrot/parrot.svg | 701 | 4ece13cdb271846cbc7886da1115e928864297e423516a33cfe0803af0008aa4 |
| engine/v2/tests/lines-fixture/experience.json | 675 | ca309a2536674b35c1049158f078170540fe9ba287b7f694ba9fcd5f8085fe60 |
| engine/v2/tests/lines-fixture/make-tone.mjs | 1567 | 1f1a56d7769669e44c41a515494ee929775390e27d245df7432fabe5ebf6d2cc |
| engine/v2/tests/lines-fixture/scenes/talk/scene.json | 1108 | 3d13d956e83e3601ba1efea767d6092a6fde406f8dafe0b052363f11be3830d9 |
| engine/v2/tests/lines-fixture/scenes/talk/talk.svg | 666 | 520ad917b5357495b48c39f56f21d0e0eb52af704407d83d0b4dbafef6133fc7 |
| engine/v2/tests/lines-fixture/words/en.csv | 55 | ae786dc2d66ece04c8e803e199e0a3b927e88f97c7d4c3225323b67b176057ed |
| engine/v2/tests/lines-fixture/words/es.csv | 54 | b332ec4c91bf4c8a33709f4720a55948117576684376625817802fed8727252e |
| engine/v2/tests/p2-focus-ring.test.mjs | 3855 | 1c5a7628a3e26bfaaf2767495fd6e8af7d34a8e8304e9309e4f25966bddffa11 |
| engine/v2/tests/pack-fixture/experience.json | 441 | cac91602095409245b6c8b7f5ea388a46579cecab631bf5bfcf78dba52d322c3 |
| engine/v2/tests/pack-fixture/scenes/one/one.svg | 319 | 557148106ef1abc9255092a3e141a5a38e2740fe6fb6e6d969fffabdc0d351f8 |
| engine/v2/tests/pack-fixture/scenes/one/scene.json | 361 | 9ad97ac4535339130f2f073412b4686d84754288b6a7fb3a49125182842ab8d6 |
| engine/v2/tests/pack-fixture/sounds/blip.ogg | 50 | 3f587973d13bfc179d6f340735fdb90abba763b3faf3658aa9e3abc05cc911d3 |
| engine/v2/tests/pack.test.mjs | 5243 | 79da684a6eb621428e7a16d040a17c093034c452874b9f7093d4bbe75ed829ef |
| engine/v2/tests/plan-fixture/components/offer/component.json | 1534 | 1c354d93049f2f48bcf5f7fdf4050f1a515196ae4977313cf51c19ab766c8725 |
| engine/v2/tests/plan-fixture/components/offer/offer.svg | 676 | 4bae54212fe44d8dd6c0a5a426513e42095ae5e3b53ceaaadcebb7bb2aecfe9c |
| engine/v2/tests/plan-fixture/components/photo/component.json | 134 | 2e3f613af59ebd0b1c66566606b214decb13181f3df8cef3ebcdcbe965a17054 |
| engine/v2/tests/plan-fixture/components/photo/photo.svg | 357 | 2ff390f18bb1d0204b01e8c9c05c8ddb77a871bb99a89bf0b6007226aa3c54cb |
| engine/v2/tests/plan-fixture/experience.json | 536 | b9356a491768cb14196b574f180deb35475e27ae744a697bc80a495123a112e0 |
| engine/v2/tests/plan-fixture/scenes/ad/ad.svg | 469 | 93b5700109d957db68d6a486ca9adfd4fa5f906ae3ca80a114f33a92b894e20b |
| engine/v2/tests/plan-fixture/scenes/ad/scene.json | 395 | 3bac6ad753fdf7e12c980174fb4ef794b9baa30eb9444e5f6b6dc88626abcb8f |
| engine/v2/tests/q1-plan-fitbox.test.mjs | 5223 | 3e18c2fe8d58fe31535c01c02f4b02d364e0ac70a38c0ab8d59b33e0697cee8a |
| engine/v2/tests/q1-player.test.mjs | 4628 | e3bdf9ddd32b6a27e8b7d76b36b0c1415969b7cd4e93b2e297c09f1a77bfb36d |
| engine/v2/tests/r1-richtext-check.test.mjs | 4816 | de1063635b85743a56e1404d8ad932fa8b6d272bdd1c69c243051c23cdb98b3a |
| engine/v2/tests/r1-richtext.test.mjs | 12918 | c6b546fc3d3dc29cd5596408ccad5901b14fa81792c7eef29e09a92e73eba5ee |
| engine/v2/tests/richtext-fixture/files.mjs | 7356 | c9d22be041ff0f687ceb98736afaad772ab3343a5c3f1e3aea53c1336a732c1e |
| engine/v2/tests/rio-r1.test.mjs | 4674 | b40dccbfed3edcd5afd9ff3ab1a39e7b52a771ac2be95c43695c56f34e4aaccf |
| engine/v2/tests/run.mjs | 1803 | a6ba5aa5f1459e86352f797bef5859395dcbb3dc982f1282143e4df9d2e9df31 |
| engine/v2/tests/s1-check.test.mjs | 10340 | aadcaadaa17377105736676d11453384c3cc4b5b3312b077a1befc62fa2a01c9 |
| engine/v2/tests/skill-refs.test.mjs | 756 | 2052565cd1f6716853518c06528d92f221c4c0c7e5bb685c3119613eed4e3ee6 |
| engine/v2/tests/skill.test.mjs | 1485 | a2d3f4a8e1927bd12cb1bd16e42e68f0b7246b44f5337d489707b942c7b67cff |
| engine/v2/tests/stage1-load.test.mjs | 3539 | 6fe814a4cb9dc5cd609fc91228838c62a2d4ad27a1c3e04e70338d571c8c997c |
| engine/v2/tests/stage2-core.test.mjs | 9677 | df97a5f577d19cc4ff6b8cbb967c78756ef6fe4f923b0885bad6e46bf933c25c |
| engine/v2/tests/stage2-formula.test.mjs | 3594 | af988f56ceb17ea132d5b713155a24dfc675f6009602d14a736c40485a157a4a |
| engine/v2/tests/stage3-story.test.mjs | 7116 | 603a17ea6b699b24a249a39e5e9f38eec54b0ae00d6fd5f50dfd296121a2c48a |
| engine/v2/tests/stage4-drawing.test.mjs | 5354 | b7a999a4da3fbaf67cedf4e6038111b125f3d5e2f7a7eec8eef349ce62e74f72 |
| engine/v2/tests/stage5-physics.test.mjs | 8262 | 00077c2b2eec0453421f70baa06b3edd46ffb7cfae9fce7df090349d779a2c9a |
| engine/v2/tests/stage5-snapshot.test.mjs | 3081 | d926a4feb2a74f46469ca5f33b81eb16de1e92075fc158607f4fce3ec8d2e684 |
| engine/v2/tests/stage5-sound.test.mjs | 7068 | f2c7fc5ddab7c7ffdc1af55aef9ae50c4bd9b3e0a9aeb3d7cee9a6a1115d2957 |
| engine/v2/tests/stage6-fit.test.mjs | 1442 | 9e3c5e41b0983e3f05416f989fac9e4992f34a77aa64e2dbfa5e7d7a2a8d1064 |
| engine/v2/tests/stage6-host.test.mjs | 5452 | 5e88d804a40a6c431ca3cc2619d352c50ea4298d7d20f052c6b31ca3f20e59b6 |
| engine/v2/tests/stage6-input.test.mjs | 4341 | a3faf87acf5231a364c40ca805f7d84f4b4d2e122b260e1555db6f4c2f9d9903 |
| engine/v2/tests/stage6-storage.test.mjs | 6699 | 91420351dc11b9520980c490c64e5026b09e0d10b2e60f3685991580c8beb6f6 |
| engine/v2/tests/stage7-shell.test.mjs | 5920 | c17de05f81a90a106904966746cbfeb365700a83d8c6c24f1bb9ec3a6aaebb3e |
| engine/v2/tests/t1-fixture/experience.json | 460 | 4b8ab25f3963f393247fe63f613da0655419b347d682e9d59ee3a6edbb93be5c |
| engine/v2/tests/t1-fixture/scenes/a/a.svg | 1207 | db86c860829a3c67468daf03fd79593a7d04d268dabf5b40a2ed9cee7cc4c7a5 |
| engine/v2/tests/t1-fixture/scenes/a/scene.json | 789 | e48ef2d9de57b3575b748695fe0488c30566ed892e7183f9be135893f77f6288 |
| engine/v2/tests/t1-fixture/scenes/b/b.svg | 495 | 21e962b635c88bebdcdf1aaa70934408e6982fc8fa4803d9b5094430f8d24e7f |
| engine/v2/tests/t1-fixture/scenes/b/scene.json | 196 | 2eaabd35f1ebd0dd42b3a53cedb154f3239fa1b994056ee9c77288b43a2ced7b |
| engine/v2/tests/t1-review.test.mjs | 4480 | 6fc024eba27d7454e856121cf6bb3a74df13749f0827fc9d46046100390576a5 |
| engine/v2/tests/t1-sweep.test.mjs | 2164 | 944b2bc1fcb8626a222b317952a00bc489c8e461a9479806dfd5d824d5888d05 |
| engine/v2/tests/t1-test-tool.test.mjs | 4052 | d288b038617926a4b41ed3dfa558f61d9f25fe7e04a5563f41862a54a0c851f7 |
| engine/v2/tests/v1-change.test.mjs | 43790 | 82df8f28471cdf4eda14e8081f46c6631c138b3e11a16b5f7669cd4278ab72c4 |
| engine/v2/tests/w2e-load.test.mjs | 4790 | df27afd14d36e291072b0b9ae3036c76f1c0da73ef4295657f2f904c93a6678a |
| engine/v2/tests/w2e-pack.test.mjs | 4572 | 1a2e0122b2e947bf712566a40280177b97bbced2c9529049ca4c29b0bbe1e2e3 |
| engine/v2/tests/w2e-transaction.test.mjs | 9934 | aff119fd046833e6e5f8e4a453f096ecaf8449dd019a7967ab7b0808acc3c1be |
| engine/v2/tests/w3c-capabilities.test.mjs | 9416 | 785945ef2ef902945348d4d08285e509b61ae9498783eed39b5280bf93967240 |
| engine/v2/tests/w3e-faults.test.mjs | 3621 | 6ae3fb60c7a0f40b5475cedc46d8cab36e8ee2159fff9f607717b9b38a27790b |
| engine/v2/tests/w3l-layout.test.mjs | 10238 | 58f16411ce9cfe3a356a701f8f13fc3ae1ec3d0e4c3ecdf7fa0ada4be15be387 |
| engine/v2/tests/w4d-helpers.mjs | 1258 | bc661af6e0866dcfad22862c22e2d192c260653637616148e144b55591dadfa1 |
| engine/v2/tests/w4d-motion.test.mjs | 2032 | 09f8ef14611cf3d4026901bbecc110bcd9a12cd8507c524d2f63365410fe09a9 |
| engine/v2/tests/w4d-pivot.test.mjs | 1135 | 2a3cc1ea05950dddddaad03ae32af7ff4f1637fc41d21cee8a56d9b517297189 |
| engine/v2/tests/w4d-placement.test.mjs | 2619 | 1e621d22a54c669931be0f26195536425004914c61c4222733433755a9de123b |
| engine/v2/tests/w4d-snap.test.mjs | 1595 | 90483dcc4a6fe286ce587a97ae47b5e52db63f9314be18afbdb94f8c3e1035d4 |
| engine/v2/tests/w4r-runtime.test.mjs | 16732 | 33790ae1a28955c41e51a0a61e06b53fcfdb0428dfbfd161d87e45dea601b603 |
| engine/v2/tests/w4s-boundaries.test.mjs | 17048 | 61f696cea47eb76f9a7352e57afefac1154b75a9ce52d022d47331b1e770aebc |
| engine/v2/tests/w5-functions.test.mjs | 1076 | acf12799a4147163e7a2909ebbcb36c028b2947f334c1a883bccca8e1d5f3699 |
| engine/v2/tests/w5c-checker.test.mjs | 12223 | b3aaac849074003f1ed064254fa9624770e9aae39cd28362daded137ccf7ae6a |
| engine/v2/tests/w5d-focus.test.mjs | 576 | 5dd5242e3ae63c962ebee2f3cbd6d3181bf763ebc4918029d8356d0195acf4c8 |
| engine/v2/tests/w5d-visible.test.mjs | 1778 | cf7a3d599e1a54a3b83ad640f82b7efe3d59c58b46a2c91bbcad9730ddb7b695 |
| engine/v2/tests/w5f-runtime.test.mjs | 20977 | ca68c8bc10e0d9fe8c3583eba97b6bbe72097887d60c79e609d9227c0aaf3c57 |
| engine/v2/tests/w5k-kits.test.mjs | 30951 | 239bffc26404d7f79bd3f21c9340b6757b71e739b9afe0bcb035f0b6e6e2cecf |
| engine/v2/tests/w5m-motion.test.mjs | 14924 | 72f365ea6a29491700ff0271235822590922bdb4b0b88f5b0f470b7fd8a3bf7c |
| engine/v2/tests/w6l-modules.test.mjs | 13997 | f2cbc88e8e7c9734e29caec7453d0389cb690ff774529d0a649659cb2308abc7 |
| engine/v2/tests/w6m-readme.test.mjs | 2564 | c6c481db430a14972b4fe60be470b2035bccfda5be84ebd567e3fd04311b6dec |
| engine/v2/tests/w6v-media.test.mjs | 11015 | d70f9f683cd7230eea37d94ffcfcc1dd2488bfe7e3a8f6edadceead2915b6402 |
| engine/v2/tests/w7a3-stage.test.mjs | 14952 | 5dccc29d82220a0f63bace66ae2dcae59602515d3e969d73554d83c4f4673b81 |
| engine/v2/tests/w9e4-fixture/experience.json | 276 | 137b1c4247fbb1126e799ba679ea3f991013556b402024de0dc98a78ca959a74 |
| engine/v2/tests/w9e4-fixture/scenes/one/one.svg | 3423 | f1b36682da71b6024f58ef5559c9d59caeae07bb8ab7489576a701642950fefd |
| engine/v2/tests/w9e4-fixture/scenes/one/scene.json | 889 | c859b08bee6ac268903736cf8a95e30fd89c2801958b200d8e8397f526ca5225 |
| engine/v2/tests/w9e4-words.test.mjs | 5669 | ec7d6fc4ed9a378516140dfdfdc67df5812d3c21d2d06bfa115257948fb68e0c |
| engine/v2/tests/w9e5-computed-cache.test.mjs | 6626 | b2d1271e014d41d322c118b61b31e0158ba6a89ae0d469a04609172bbcbd9bdf |
| engine/v2/tests/x2-dashboard.mjs | 2673 | 7924b4e4b66aa459e3bff7245fa7196733d6fc219c3b6a63eef6b0af9c74c80e |
| engine/v2/tests/x2-speed.test.mjs | 10504 | 703e2fb02bbbc3235e903b5f356d7ee864925c53d38e63704f9a7f405691effa |
| engine/v2/tests/x3-correctness.test.mjs | 28514 | 2e76e3d5f033c6db1482d0204fffb24f91330b3be5ea6dedca338786b10e5c0b |
| engine/v2/tests/x4-truth.test.mjs | 15964 | caa4fc1dedf0f98eed0f40eb124bd217bf52dd491f6cb9d08730ebeb125a4ca1 |
| engine/v2/tests/x5-format.test.mjs | 6170 | 69891a2275e3ef10aa53a5a7b9d3fa3d18745c8abfa38085951bd544c522d9ba |
| engine/v2/tests/x5-frame-link.test.mjs | 6987 | f6ac34cc8306af69e21a2604363b6cd6e799f5f05b008c9d017a52fcf06dba64 |
| engine/v2/tests/x5-status.test.mjs | 3229 | abe06beae4a5385f33de89bc4f6d4dc1006145c719be7827b6c89bfff5d2d540 |
| engine/v2/tests/x6-addons.test.mjs | 17412 | a13a6eb81331f3ac393a69b1151ffd67e47c0ae5994f7e6ad99b103baef069cb |
| engine/v2/tests/x7a-fixture/picks/experience.json | 645 | b129026aae371b3c87dc39a5c8e760509e221accf00914d0b00f83f6a1ba8122 |
| engine/v2/tests/x7a-fixture/picks/scenes/home/home.svg | 717 | 607f87d0d9bd6e10d535aa3c5a207114d43d9d708ef01694fe37ac7c61ee8331 |
| engine/v2/tests/x7a-fixture/picks/scenes/home/scene.json | 434 | 9007bd6b0c2a66f6a7ff240c185a6ab3ea774c0ab4c35f66da070e881e0ff364 |
| engine/v2/tests/x7a-library.test.mjs | 15055 | fcdeef9c7fe5b0193b5f7c31c2f0055b1e3078c41063e0500ff6ea2e733a2310 |
| engine/v2/tests/x9-noughts.test.mjs | 8421 | 5735a94e403e3ea8ba10fbdafaeab1fcebdfb17af9491d5a020cc9daf3d51946 |
| engine/v2/tests/y1-fixes.test.mjs | 21789 | 2a6f935cecfe4cff6f54bf81e19214a91472e39af9ea16d7bf6b6b65ab7b8cea |
| engine/v2/tests/y2-change.test.mjs | 4016 | d6868780ef17ed51da10fd8ec0f9ae70c6a7296abaa14c31db59e2ed6e1d2395 |
| engine/v2/tests/y2-host-clock.test.mjs | 9558 | c5b7ee993260f9d8c0627d22fbd7d171b2df56f099c86564a99d007c9e9598d5 |
| engine/v2/tests/y2-mount.test.mjs | 2806 | ad54e2d770865b303e89c1c9521841fa26e274c8b54cc8b076ccdfd7694e1a02 |
| engine/v2/tests/y3-fixes.test.mjs | 34516 | f56045dbf6906b3394d2f624e30ec992b3916fdbc81cadcfbf7b7a496a1c3674 |
| engine/v2/tools/addon.mjs | 15454 | cb92ccdcf0db01eeb3e96f9c6f5bc5fba47b67e1c927606e0d2423630c104cc3 |
| engine/v2/tools/addons.mjs | 17158 | 8794470112befb759f53b3549326a848e7cd0be90c0609323af60101e731f093 |
| engine/v2/tools/change.mjs | 5076 | 60f30d81aed58174fec85cc4470e09d446713cc1487f0d20a870bb6e73a812c2 |
| engine/v2/tools/change/apply.mjs | 24559 | 537b7bd52fd73914dce27b37e3d071066f0c2eb5f409d24966b02c49c548c4a7 |
| engine/v2/tools/change/folder.mjs | 4316 | 28f707f5d6544c1e1b9a76ff4bde12e0d5c7d1342ebf772eb13acd450318d42b |
| engine/v2/tools/change/make.mjs | 3764 | 4b6a5c91bd86d7e9d5c517eccc112e06c4e911a9c92b2aee90931249d6591f15 |
| engine/v2/tools/change/play.mjs | 11566 | 429900664e5fe4d0adebbc734c00e56efb662e511ad084dab307286b52a8e22a |
| engine/v2/tools/change/request.mjs | 7584 | d221df4ce8d279d0fbf0de10555f64407ece1cabf70f720c0d8be2508d44b76d |
| engine/v2/tools/change/rights.mjs | 5734 | c94d841a9110cc0ce9d5ce243e2a5d5926ab9079b6f49b8382f2b19e32bb79c8 |
| engine/v2/tools/change/rules.mjs | 3261 | 2c69eba03b566c5db651c74d00d1e349198f770d1909c7e38963db6f02701b58 |
| engine/v2/tools/change/targets.mjs | 13914 | 5647ab9a980831910844a82600b398e8b76480f44cab36c713208bd264e5dd5c |
| engine/v2/tools/check.mjs | 6888 | e6c7db8cd5c3816d5cb67f07f0c51e9a579e7a61bee37a9ef96961142819e56d |
| engine/v2/tools/library.mjs | 18886 | be654df4cd1ca67f7f0d9b8ecea364dbc593c9389d89806e5dceecaf3dc08f10 |
| engine/v2/tools/make-limits.mjs | 3327 | be7e55a393118ff5b1959fa4bea23732ce969610cf9bfd9ce2f368c242f4c6c7 |
| engine/v2/tools/make-owned.mjs | 6376 | 435adafbc4d18875ec08110890713fd1ce1dcabd59647c96e2dcb67cd23bc829 |
| engine/v2/tools/meter.mjs | 8724 | a6cf59b5d6d590a02fb046413ef37c50d7ac6588d4dcdc38d1286d4d8a210afe |
| engine/v2/tools/pack.mjs | 78093 | f557a63c305e88af3dbf519d3e12188decb3fb44dadb055b6cf10a24bc25d510 |
| engine/v2/tools/preview.mjs | 9743 | e59bc6d83f3b5794433e428b0b632dbe6e6a34d764a9ff787b0a4fe294467062 |
| engine/v2/tools/previous-kit.mjs | 1388 | a97d7b896000218e6ee9dc50ec47516cb39f3f8293cd2a6fee8355c4ab0c9693 |
| engine/v2/tools/proof/FORMAT.md | 3419 | 763aebbf599157137b28324ad6a783a5e95485a83bfd518f21b0fb8162b41c6f |
| engine/v2/tools/proof/README.md | 6997 | c515a8d6d6910748a337651b5c75d6bdd8248747fb822e5b8527da758a8d3d5b |
| engine/v2/tools/proof/baked.mjs | 4867 | 11b6f4d02074d8a2cde5a39a13338f387fc643ec57ab5fef711dd99ec819782e |
| engine/v2/tools/proof/browser.mjs | 18467 | 93514373614836be76b05a7fe5469eb0aff8d53d9e99e19aa71aae092fe00592 |
| engine/v2/tools/proof/build.mjs | 5937 | 6e334cb02c28c7da6c38dbaaf34137ceaec1e245fc90e936da10168de96571cf |
| engine/v2/tools/proof/certificate.mjs | 14807 | c780072ae2bfd0de7941fb5db0ca30d49fbea53b8d01db117bbfeee75260c0fa |
| engine/v2/tools/proof/explore.mjs | 16735 | 7da3827c029d871ffa41275388f533980ddff9db905444be3399ff242fca0e29 |
| engine/v2/tools/proof/format.mjs | 6776 | 9c90baaa93f42c57ffa4b2b6b03f9474db6459f6b21ebaa9afa7f38d8a0fa26d |
| engine/v2/tools/proof/proof.mjs | 12658 | 7048f575fdcf7c836a8106952804f121f5561217cf98c76902e663c8dcde4054 |
| engine/v2/tools/proof/tests/proof-browser.mjs | 5858 | fd290480453f12aefdf38b4e57b029442df74db3363235e7a9d1d0adc7008694 |
| engine/v2/tools/strip.mjs | 3622 | 332e07c1c558067804dfe0cdd13ee9de9cec3195ae82442624091cb269a8f6e4 |
| engine/v2/tools/test.mjs | 20427 | 422554eb1e44c35db9c80e8bdb0f64ba7bcbb057dfef76e9219bb5bbe7f212cb |
| engine/v2/tools/test/browser-pass.mjs | 33211 | f82b4b2dc62080b794decfee6664ee68b147162368fe65f9f58d6a5fd0b78a8d |
| engine/v2/tools/test/hooks.mjs | 1830 | f31513820ea9ac3d645e50513bda443e072c183ac9ad168e770eefa42971c016 |
| engine/v2/tools/test/node-play.mjs | 12592 | 6dca05bb1e2e2644906babfcc45ad480bfec52c8a5e1c3a558772f78036264f9 |
| engine/v2/tools/test/page.mjs | 21983 | 5f60e9ee130e30243bf4f2a3ed96927e04d7c22b14614d739be8e201bbc069c8 |
| engine/v2/tools/test/sweep.mjs | 4469 | 73d9f030d275822923dc5b0cb54861d4b40346313d08bc882fa2896ee43f1d6d |
| engine/v2/tools/unpack.mjs | 2508 | 0c53118c2d7f07866525d6cec601e02ce5ee33de0edad626e58e5f860aa9d9a6 |
| engine/v2/web/asset-web.mjs | 11998 | 451c2ab275e4dfe0a48c8e013ca158f97b9f31ddf1997cc775453fe7240497d3 |
| engine/v2/web/audio-web.mjs | 14671 | e9e339e78b25c300bf41017bdf78b32edeefb87edf03ed8a62517e213816c1ef |
| engine/v2/web/export-web.mjs | 2413 | 519fe528d64dc4ea4d2d3c4b1bf93fe4974d27737e44332b8edcccc72fee26c7 |
| engine/v2/web/frame-host.mjs | 6436 | 5e24d2599b6c1c37df2f177d88cb97619272ab333de54717d68c0d6128afe950 |
| engine/v2/web/frame-link.mjs | 4992 | 376d30b8e91cd386652b169aae4b8faf02f0ec55399397ce9bf92bfaf7fb8483 |
| engine/v2/web/index.html | 1091 | 309cb4d7d7a61c2a79d206929b4c6a7cbf131d34e495eedbc33e45bb66e4c34e |
| engine/v2/web/input-web.mjs | 66293 | 3b7f83b4234e245708019afed7c75c0cde3b27c98fd1c6453078e09055274386 |
| engine/v2/web/mount-web.mjs | 4594 | b40d6729c179e97a11882a66c39843d6dcff68c42a29bc7db8e18a4a99c8dcc9 |
| engine/v2/web/packed-entry.mjs | 2290 | 867106ceb271fa5cb723088f362d7cc13e209180db163b63e4b7581bb0e20395 |
| engine/v2/web/player-web.mjs | 45899 | 36ca9dda187a2b5c786275f649a0e59daa6fcb41df4c8423f22b53f74b94a201 |
| llms.txt | 806 | 1fe132e45e8813675ba424a459d6af76964257e00009d0b165c9111c3a435068 |
| release/addons-tests.json | 35401 | 8eade3ba484cdfc8633771ffb6e622d59266b63ea69a45cba4f3d1dd6c6677fb |
| release/browser-smoke.mjs | 12713 | 8f38a0fdb690881af18f457d2281289dadcb5fc009e926f2a2b315f250cdf367 |
| release/checks.mjs | 9948 | e3bb25a0afa647994d4efae27be1cf52dfa5d28fe8145d8500445dc76eae0cd9 |
| release/leak.test.mjs | 10496 | 7e0911905366bf75880015eb20f2eb1b78b7257914f04e48d9ab4131e92c752e |
| release/lean-tests.json | 7104 | e80b2fbc7b3ec60fb35e310f7b82150e4c351c105329683cb11e01ad33126f62 |
| release/policy.mjs | 3619 | f957463f8cbeb653cd91b82790f1e07f49d00b427799ddc03be284c825087ecf |
| release/public-omissions.json | 2728 | fb1608ec0109ac5d43bcc475eb0d43f5497ce9aa9fdb35e17a9e327f5fb599d2 |
| release/public-words.json | 2812 | c1912caa7195c0005d93fe7ff8885fe068abe95b74cea535474913691837b02f |
| release/scan.mjs | 2770 | b75cfe8171f678705fd56b1cc9e4b37ffd25ab2edc44b1b27267d46d5368b303 |
| release/verify.mjs | 10234 | 2fe1ed8edfc8e1985a29cea5278c6bd484edecda684dcfa149bce0cbf78bbc3d |
| skill/2.0/examples/kinds/infographic/components/bar/bar.svg | 2074 | 377bcbff5ec81430beaacd9577b5c93698e7d415355b02319c2bb0e08b2b6c08 |
| skill/2.0/examples/kinds/infographic/components/bar/component.json | 548 | c2a35d680b897b29858c0205f44493baf621e92203cb7aa7ceaabbc2282714de |
| skill/2.0/examples/kinds/infographic/data/fruit.json | 204 | 30cef2cda1b1a57f48d5bb7919e8a656a155f576cff7e8ac7e4b140c5c96af70 |
| skill/2.0/examples/kinds/infographic/experience.json | 758 | 52ffe2a0e742b1f45457b277d41f50f3f5a03edba1934966bb8b1bb47a74f11d |
| skill/2.0/examples/kinds/infographic/scenes/chart/chart.svg | 11219 | e24744b426ca4e9163c6bd4eb90773cdc57c5cc6763c543f05d2b9a281dc1cc1 |
| skill/2.0/examples/kinds/infographic/scenes/chart/scene.json | 255 | e0ae64c1f06d443c32040f576803b54d5788ee97f382e22c5fdf8df098ff4e96 |
| skill/2.0/examples/recipes/orientation/experience.json | 660 | 529693d5d562dececd4d27e947f68628c241fb944670f20c2ed913b727d3f53f |
| skill/2.0/examples/recipes/orientation/scenes/harbour/harbour-square.svg | 3302 | d63e736f216666dd7817b7dcc03e44c945bd1a8ca2fa2175d9d0bdbf71c1d9ec |
| skill/2.0/examples/recipes/orientation/scenes/harbour/harbour-tall.svg | 3203 | a6b0f38ba615b7a549e0e536749ca01c3ca48a3e2593bc8157e51271501149a7 |
| skill/2.0/examples/recipes/orientation/scenes/harbour/harbour-wide.svg | 3586 | f400f6ba280b7871d81d0fdd0eb6707350f7f258a4040ea1ee4d579d329a0a4e |
| skill/2.0/examples/recipes/orientation/scenes/harbour/scene.json | 972 | 6c493be685f9867543b4c83b809d1847ff43a94bd9a7efa5801a84c2a418fbc6 |
| skill/2.0/examples/recipes/orientation/shell/frame.json | 1723 | f2ae61f2e807acc7353eb19c926f5e687b0a8b123ca9215df01922f699bd6320 |
| skill/2.0/examples/recipes/orientation/shell/frame.svg | 2286 | 00453eca3babe48ca3417736a33cdaf44c01dfbaf970d4413fe1ded3f838d667 |
| skills/hypersvg/SKILL.md | 15243 | 0420d7efc137e1b1cfb17602249d9d331ba2951f17b9a239e988586459f2849e |
| spec/2.0/01-model.md | 14916 | 75807aa7f086f5e9fbd85b6b536db1205fa87b37305ba6dc72f5191a0e34ea16 |
| spec/2.0/02-files-and-names.md | 36598 | d385e6c80136b46e15f38df4f508aecc4921bc331ed7078f3f756893d26364ed |
| spec/2.0/03-story.md | 32425 | 39e8a6a30264603fea9fa6c09557373ba20075ef504602d8f24ecb39d17617e9 |
| spec/2.0/04-blocks.md | 15655 | e2701f9d65792396bc9d5666a4ccb6c6201b6ad3872a7897463bad7bd8681a8b |
| spec/2.0/05-faces-and-body.md | 87636 | d2f79d063c1a8456ca603914a743ef07b1113d00a632ab32c790580dfbd5b5b3 |
| spec/2.0/06-drawing.md | 56756 | 3be761545708095578be1043dccd12380565b8ada4edfcc38d215ae42c4bc15d |
| spec/2.0/07-representations.md | 32570 | f4f57d7241a8db866c5ba1c2a11a67d2dff57186d2d4d1411c1bbda956ba1d3a |
| spec/2.0/08-rules.md | 1246 | d44f3eaf19cff262407789b85840cc577593d818eecdc5422d30504b0aaf13fa |
| spec/2.0/09-engine.md | 13103 | 1f749604fbda50c2e755788eebfb65c37e5afc182dcf0532abbb34633a077f22 |
| spec/2.0/10-hosts-and-delivery.md | 44380 | b90e6bea398a0e3f2897bd4c29cf37b088106ebb1545cc0c27329a3e12916a33 |
| spec/2.0/11-vocabulary.md | 9706 | 85070608dbd5be1c90866b63ed93daf1c8ca04439c00c61e1b8cb62336dba56f |
| spec/2.0/12-writing-an-addon.md | 54160 | 13b26aa318ef332ef75b48093a57942a4a093e37e76a2bf68e8f263195467789 |
| spec/2.0/MODEL.md | 13781 | 9dcc494072c387d67a7437759eb5ee5e421ceb20dc01fcf52315240848ebf87e |
| spec/2.0/README.md | 14247 | 591c51de53575b4ae121675cd542367e64ae242ad5d13cc2aeee1dea923d82c7 |
| spec/2.0/addons/a01-effects.md | 266 | c3c2577e1ea892ae705db386d389159ad8138509b0f1877e732af566c5f4fbc7 |
| spec/2.0/addons/a02-media.md | 262 | 4304e361dc133030a6857e0c2fce1b971f958d5f22898ada4a37d0f6c7b90268 |
| spec/2.0/addons/a03-page.md | 278 | 3235a9c10409ffab2e12f0212587dd531fe3c418f8d51e1a4d42c719c2c9458d |
| spec/2.0/addons/a04-seats.md | 262 | 20259f2b694de2ab5e5e9f65c8964f7d14b817482c114190a01bd94fcaeb2846 |
| spec/2.0/addons/a05-ai.md | 292 | 20682628876433e0745e2132b5ec20ae8f5b188122b206a2f07bb20fbaeaf188 |
| spec/2.0/addons/a06-widgets.md | 266 | 17926702c0af5ce719851acff101ee746aa37166c70790e21ad1850880977ba5 |
| spec/2.0/addons/a07-fit.md | 258 | cd61515177d2b9d159baf81f2bae5011029bfe5ee2e0489e70a326d3318e13bc |
| spec/2.0/addons/a08-checking.md | 232 | a77ee8b86ec4757c72b2b7eef1244ae0772441c33169da5385e005303716d0b5 |
| spec/2.0/addons/a09-trust.md | 534 | 8c668f61cf27ed16fbad0f32c3e13938c9ced71c60a21c94f91d20450d9b075e |
| spec/2.0/addons/a10-exports.md | 252 | ff6ef642a3efe9d30f9b46ecfd4b119237912901b99de09284b09b69bd22b293 |
| spec/2.0/addons/a11-rule-packs.md | 234 | 52815d7085c1d788296da5640f1b3fdbda9524eb0f7cd2979445cec82f7c3663 |
| spec/2.0/addons/a12-publishing.md | 239 | 14edf1efc49a2bf25a48d0d1e5abf29c43352346ddeb64d64f5a78b8cfdc50d1 |
| spec/2.0/addons/a13-migration.md | 236 | de4c5fff2381fff47d9e140fc7ec5376b837a677149f3cd2fbf8b4d6b7844658 |
| spec/2.0/capabilities.json | 11736 | 514624eea28f3073a90c33de2e2911f1c88910aaea1a6af0b0daf69c10685c7b |
| spec/2.0/decision-index.md | 7882 | b82c175ee64d476db643cc4442134a658ea3441f2577c45205fefc9007cb87cc |
| spec/2.0/documents.json | 295916 | e1501e11458579fa9bdeb77d65fb938c9a88a93f202066c27f0584b72b77e125 |
| spec/2.0/drafts/README.md | 3845 | 963b439797d1d8b1aad760f7f95e0d6780d987f43bf796570687a2b6dc8b1567 |
| spec/2.0/drafts/choice-places-2.1.md | 1012 | a5dc8af2f34ad3b236ebf9115a9a98ce269776671b6987b52dfa4f100f4c0d2e |
| spec/2.0/drafts/choices-2.1.json | 661 | 6f7e33cdbdb9162e3808e8087aa2f9dc4a37485903bfba7cc6dcaba81d3a3081 |
| spec/2.0/drafts/clip-extras-2.1.json | 1622 | 13d2ef0ca3318d7c41a01edd6305289308750dc75dceecdeeed297cc2cc8fcc2 |
| spec/2.0/drafts/clip-extras-2.1.md | 1746 | 4dfad14e090f36e18dcdeef4be43bbec1dfec2e685779cf3f8199fe453774f45 |
| spec/2.0/drafts/content-options-2.1.md | 2901 | d97e290cfc3b5964ed41689814fb479ccdc312c9a64e8a08243507110e566b4f |
| spec/2.0/drafts/custom-widgets-2.1.md | 1318 | 7efef26034ad752283b0d27c2324e980c01f9608122289df6b720a7ddcce4628 |
| spec/2.0/drafts/delivery-2.1.json | 4174 | 44caaed13dccd564ecd5cf2924c34a82cdb61198fc0a8dd5ad49fa2ed645277f |
| spec/2.0/drafts/delivery-2.1.md | 9596 | e2567489d1d63aec292996d8d293f7ff3c129243735b0b19b0bc7a224634e8fd |
| spec/2.0/drafts/effect-kinds-2.1.json | 15685 | a13dae565c81715c85ef4f34417ff007cb4e9938f6bc5ba1b8b9b53e53e2642d |
| spec/2.0/drafts/page-actions-2.1.json | 4898 | b575e9aa96fe10e881f26e2302eb399523efb2d3580a4ed1ee56cc9ee2747bcb |
| spec/2.0/drafts/remote-seats-2.1.json | 11567 | e703aebc387830d15753d502f9bd10da02cfdac7294bfcaaf46f8f34bab35247 |
| spec/2.0/drafts/scroll-clock-2.1.json | 2550 | 85b2c9e2fc6250313c64bbed043aad2fe12bad8837b077f9fbe2465cba05d467 |
| spec/2.0/drafts/structure-2.1.md | 6847 | d547dcf4f681b7e219023d3590950a2b3bf3a420eb2d037287a6326069369798 |
| spec/2.0/errors.json | 71389 | 7d309a87d10dce8e8fef04a3ed52707b40f6cb3d49fbabc5b56e23d8858aabb3 |
| spec/2.0/limits.json | 38473 | ad23556910b5bcf75af2a2234f75dc1fab91daa4b0351f9929600601a2b3c451 |
| spec/2.0/packs/hsvg-accessibility.json | 1004 | b14929cdfa3806899a9e4c0c9d9e40a1f3e7c23cce78d73a078ec9c9b18b0334 |
| spec/2.0/packs/hsvg-baseline.json | 2026 | 346c17de66cba2fea38d15724cab8481e5f5d84f96eaae6c170072fe16210c03 |
| spec/2.0/packs/hsvg-page.json | 808 | 6994132d897f908d0b1823a90eb8a4d80fb1b0a55798410592d804ef3820e8e9 |
| spec/2.0/reference/README.md | 2331 | 6c49644c5a378687e2ff8f84e5713d020b3f4b4905699801317327f2ccd2a4fa |
| spec/2.0/reference/a08-checking.md | 16984 | 8904c9a0e77fbcbfe767f6954c30329493b6bd7b00a79c7a44fbe3126bb0c218 |
| spec/2.0/reference/a09-editing-and-trust.md | 32474 | 161c81fea029197c1d41ea90597b569f6684ab74c9ba2e346d167a36c32944f0 |
| spec/2.0/reference/a10-hosts-and-packages.md | 23126 | 3372659d8c60be9168f0ca63b308a4217d07517d951fa74f718c903c42865ff5 |
| spec/2.0/reference/a11-rules.md | 27627 | f37599cd1ffe08d755855a3acaf6fe1d16953f0462740c4d7512c39364dc42f3 |
| spec/2.0/reference/a12-publishing.md | 1832 | 158a130f41033aec27b8a153b97b0b0c214494758c7a42aaeff60c3af47ae515 |
| spec/2.0/reference/a13-migration.md | 65224 | 75922572f55ef33ec65728db6872327375e546157d8af8addfdc72c25a1f8afd |
| spec/2.0/reference/a14-kits-and-libraries.md | 18581 | fd8345e39f17483fab55dfbdb3cb1f141daa231990c8e38c3dc94e187fb5b7cc |
| spec/2.0/renames.json | 56499 | 4bf58b67c91003c4c8c59dacc36ab43bac98047785eec66bb76731b01cd9c39c |
| spec/2.0/schemas/README.md | 3219 | 0a6678805451b918bd01620c4c821b43dfb522c6299c009a8dda8bf68f747040 |
| spec/2.0/schemas/addons/a01-effects.schema.json | 722 | f6072035f5a081f11f3d563f4a463c7f7a576abdf43eccf9028662c0e55c7667 |
| spec/2.0/schemas/addons/a02-media.schema.json | 714 | 0d8ce7ccdd5f402571a82d95858679e46af8747fae98aa471679eda8d72b77dc |
| spec/2.0/schemas/addons/a03-page.schema.json | 1998 | ec2a7789ec2dd885613e0da2963d16cb3a4ae7018403f857c6fc570c7962ffd4 |
| spec/2.0/schemas/addons/a04-seats.schema.json | 966 | 295bb3fb6492e6ce2a764a4bf89c3999b4a12e1a13ea1604053c708306629e9b |
| spec/2.0/schemas/addons/a05-ai.schema.json | 738 | 32b8c7efa4e75975fd193d57bcbd849a06c3ac7527a8189363ef849f96f4b797 |
| spec/2.0/schemas/addons/a06-widgets.schema.json | 835 | b09ad5b5cd7bff12f9cf3f52a81432025845165d31ea5afc2a8fdd4eb4a0f0e0 |
| spec/2.0/schemas/addons/a07-fit.schema.json | 596 | 2f788c7054962e9057c3f0a610266ed850e3b172c27f2521eff8a16bdc35d00f |
| spec/2.0/schemas/addons/a08-checking.schema.json | 4025 | 02200cada3440f487ba3d4cf7ed8c31f748268d42d47b1661d501580a87eba89 |
| spec/2.0/schemas/addons/a09-trust.schema.json | 2576 | fef27a2de3130549eeb3a5e7a494bbbca058ac6d5e53a63588944d9a7b3b4d5c |
| spec/2.0/schemas/addons/a10-exports.schema.json | 3263 | c3228185bc67a3f7006a0fcf49d90af740cbb03dc7407ef2661bd292297aff01 |
| spec/2.0/schemas/addons/a11-rule-packs.schema.json | 616 | d0db6a74190eb8292357f4dccf3bae0062ff15f717fed7f50740b1cb9690a315 |
| spec/2.0/schemas/addons/a12-publishing.schema.json | 611 | 3fd9ec84f08521411073e2cb6d7e9f9e4afa87f38a5c66e3b8a69a9b3101c9a6 |
| spec/2.0/schemas/addons/a13-migration.schema.json | 1256 | 7d14af058593e5f2e6ceece6f72633adce924bbbd049b0c8aaf6bb362c78a438 |
| spec/2.0/schemas/capabilities/ai.schema.json | 16055 | 3f70b4623682ba69a1b1481f2226d76df9712e632355f0e17c22b2ccaa32645b |
| spec/2.0/schemas/capabilities/chess-opponent.schema.json | 2303 | 76c47206e2890e5e881d1a9cb9f54491c01474ca25ac8962b9c3c5e2cf4cf258 |
| spec/2.0/schemas/capabilities/chess.schema.json | 3969 | b34756330ba622342b5d248f3c24ac913d0e5db7ac7595d47e0c50b6c73ca2c5 |
| spec/2.0/schemas/capabilities/effects.schema.json | 14066 | 07d07381ba9e15be48ffa1db56044316f8b00ecb008c3d77e056da21926fee83 |
| spec/2.0/schemas/capabilities/fit.schema.json | 1211 | 25cacdb5d00ef947c0c0eb52cbfc385b7884846e102db819f50fae80ab840a5c |
| spec/2.0/schemas/capabilities/ladder.schema.json | 1488 | 13d84e851a2b1312e5558d6a9a6d5e4e86dc188130c2ff481eae0e8f36268277 |
| spec/2.0/schemas/capabilities/lines.schema.json | 10381 | 89d893d2c940cd6049ba0c202f357c1d57f70dda3ecdf03fb344b0ccffb45152 |
| spec/2.0/schemas/capabilities/live-data.schema.json | 2994 | 4bc614aa30aa13640c706332174519663bb60594a8f8f53a4bdc748cc9f35704 |
| spec/2.0/schemas/capabilities/media.schema.json | 10096 | 8700107d0308d4e2c9e318a122adfc2c61e9daf258b35cbea65376d5f5bcfd33 |
| spec/2.0/schemas/capabilities/motion.schema.json | 1708 | 9fc207d957e4d019deadc9bce8ecc5b1741022243848a8486b8b584216e1d031 |
| spec/2.0/schemas/capabilities/page.schema.json | 12688 | ff95feea108e9dd805ebeb8a95e0270cb4c8b6b0a725cc9f8cf9d22bc139b796 |
| spec/2.0/schemas/capabilities/physics.schema.json | 16268 | 543b8f6e91cfeab271aa7da8d856c5270d50f3faabadb8904a103c088832b21c |
| spec/2.0/schemas/capabilities/rich-text.schema.json | 9903 | 658ad69051387614c1588ee104ebb88b1b2ee2dea8ef3343406be286311096cb |
| spec/2.0/schemas/capabilities/seats.schema.json | 12377 | 1f552f994b567fc212d7d469847d492dffba9f6ce826066cbb67c001dac02028 |
| spec/2.0/schemas/capabilities/snapshot.schema.json | 4831 | b027fc41a7d989d2f5699d4f41883f266bcc82b26b7fbe681a75ef7653dd766a |
| spec/2.0/schemas/capabilities/synth.schema.json | 8377 | 1ec8a1b1ffa9b5664b19617d89d59e8d147a73e4e180ee07bc719b770d949989 |
| spec/2.0/schemas/capabilities/widgets.schema.json | 19623 | 4feb4dca61fb5b16059f76c10f0b6f64f50151cc8d1391af993093b8bd408332 |
| spec/2.0/schemas/core/capability.schema.json | 9829 | 47a2f27be9ea46623f5c0189006b80d84cfbcf3e838bc5f7aa8eb41584954466 |
| spec/2.0/schemas/core/change.schema.json | 2424 | 56561a19aecfd426bb2afc0d421b85ad2638ba78339d2349fa391ebde5e508c7 |
| spec/2.0/schemas/core/component.schema.json | 195548 | 4c52d0f7abe57c2eac7ae820f23e944c6a269eaa2fd5275194d2a1558a26536b |
| spec/2.0/schemas/core/document.schema.json | 4082 | b235861fe9c4404f82b24199facd8c5fa97343f44e8954f7b6aa1f565d3a3118 |
| spec/2.0/schemas/core/drawing.rules.json | 26543 | 5e2b8edea1db679bac8de5bab886756cb7460ec87bbaf681deb735db8ab26416 |
| spec/2.0/schemas/core/experience.schema.json | 152253 | 037ad2cc1695821f816ea34bdfaae168e78779f65e671beecdc1630752bdee7d |
| spec/2.0/schemas/core/host-profile.schema.json | 55773 | 0943298a4d06f7d78872c7125fd11adcc8c067d5b7cabf7045ba5863be308bce |
| spec/2.0/schemas/core/kit.schema.json | 110825 | cb49f8da1cc0c274d8b79275e9aec366cd4c08351dba97e319ebd0604d461415 |
| spec/2.0/schemas/core/package.schema.json | 10432 | 2bb96c3da085c0a9fdda98f164430121d1e957ff36148344c0e86b5833ec22d9 |
| spec/2.0/schemas/core/play-test.schema.json | 1489 | 4f706d5da89257d45c556911406acc8e5ca255d45f726e47d932c85907a3503f |
| spec/2.0/schemas/core/receipt.schema.json | 4890 | 75d502d28bc6f21619249b4a3d8dd59529161450eee7d2fc4953a7c569ff9754 |
| spec/2.0/schemas/core/rule-pack.schema.json | 79266 | 9b4df9194c6c19081937da1650b38ff22cae0d97192f7cf83917c3d76d1099f0 |
| spec/2.0/schemas/core/scene.schema.json | 197375 | 238b9a7ff76a36b9c021b8a40c242c92d5a2793fc8348fefce15025f61910f8c |
| spec/2.0/schemas/core/shell.schema.json | 191785 | da87344da690260283b94c9d0b7185165cdcb019584eb55d828667eaaef92773 |
| spec/2.0/schemas/examples/context.json | 2789 | 4d4c57d218f9167642b6a1e2aefc831d57e75a8357df7bb45cd804b1ae271fb9 |
| spec/2.0/schemas/examples/invalid/documents/E-DRAFT.logical-block.json | 107 | d80ccd561c294ea141238324461757aa329fb5c8eb7e5e4bd967dc8268634d27 |
| spec/2.0/schemas/examples/invalid/documents/E-DRAFT.nested-experience.json | 266 | ccd16497be101d697d0512d0bd7991bf9eada8ec794e862d73bfbe3e3f8c10c1 |
| spec/2.0/schemas/examples/invalid/documents/E-DRAFT.split-screen-shell.json | 247 | 3cdde042253b982c5ecf4774aae7ea9bb7a2a7706f21e59c8ee56d5cd2fb9efa |
| spec/2.0/schemas/examples/invalid/documents/E-DRAFT.split-screen-start.json | 281 | 9901843102fbc076b9387763b821c8f73bb39de9a4c194f914789e929ce76622 |
| spec/2.0/schemas/examples/invalid/documents/E-HEADER.compound-is-not-a-kind.json | 84 | bb7ba9c1f869896ba44ddf3e382dfae1ac298f1b467df54a5fe4de208ef8da7f |
| spec/2.0/schemas/examples/invalid/documents/E-HEADER.old-format.json | 59 | 010864583f95c2fd0cf81dc1e77fb80ab38082a057b68f60474ebb81dae9b9a8 |
| spec/2.0/schemas/examples/invalid/documents/E-HEADER.unknown-kind.json | 62 | 09370b6e3562b62f722ee8d5527b0db57db085db1b6f266415cca2f4e29107c2 |
| spec/2.0/schemas/examples/invalid/documents/E-ID-FILE.flat.json | 170 | 78a57c8c851cf86fd43e2cb9ffb6cb9da8f1910f82721d4ade466295c22027ac |
| spec/2.0/schemas/examples/invalid/documents/E-ID-FILE.folder.json | 91 | 94c0f4b07f8336b4e961faa5ebd74fb47e50dd3ebb69cfd7c69d39b61c4c4126 |
| spec/2.0/schemas/examples/invalid/documents/E-JSON.not-an-object.json | 13 | c983f7e35a92a448ed4383cf28f3305b9bd9672f43be9204b13c3e19f6207f6f |
| spec/2.0/schemas/examples/invalid/documents/E-JSON.proto-key.json | 100 | 43f2914c615d6f137d845138ad2d6674896391ede48253a8606ed1b87559e0a0 |
| spec/2.0/schemas/examples/invalid/documents/E-JSON.repeated-key.json | 82 | 456954d8f091215e30128523ffbe6b1763f04976c6dc54a3f10c251961d17a25 |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-REQUIRED.axis-input-without-value.json | 172 | 7b20fa671f66e5f156835f2c59f7843bec35845f2d4d203001ec12f84b3182d9 |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-REQUIRED.capability-no-grammar.json | 165 | e17e2c7d199afc8766451bdff705cd22420f8e89a43dd134b419b0f8b049e2ff |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-REQUIRED.change-edit-no-reason.json | 199 | 45054bd9232b6c5a583d088c277db26e9a93e99e36100bcd522f55d7fff0133f |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-REQUIRED.experience-no-story.json | 129 | 6e5771d4052af304e701a9429dd187042048c3d1a26c85523ddf88ae50e4ca14 |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-REQUIRED.kit-no-about.json | 73 | 855f32063b93249eda437fa3747b9ecd5c1443c119b6936fe8b2cca87b7d80e6 |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-REQUIRED.package-no-members.json | 177 | d2b0eb592534263a707009a27e70a09de9ed309cd6cdbfa850bf32b9c22ddb26 |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-REQUIRED.receipt-no-run.json | 225 | 6299067a735488cf1345c52bda9a7f5ac30d5604b5859ff58297cdaad42157c7 |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-REQUIRED.rule-pack-no-rules.json | 128 | b0dcb58280de551cfb033ddba0a3d1908fe14a1478602ecad7855bad5e2bdb6f |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-REQUIRED.scene-no-drawing.json | 76 | d559a45d2911fb685443f29d39c8cfe25dd700bc70a55a917ce5ad223cff6aa9 |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-REQUIRED.shell-no-slots.json | 81 | b26c4558ba40e698042f21e3a9d70be05b0827a272189d51ccbae6f66b12fa63 |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-UNKNOWN.host-profile-key.json | 124 | c5f4f18a6aa8e147969ef517250bf1176bd7905b0ce77015bedcf0213f28bbea |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-UNKNOWN.limits-safety.json | 145 | 77cc69a6ff501673d3d01417ee18b03e21eb471e225f5c983b788c8b5c83984d |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-UNKNOWN.scene-key.json | 96 | d0a6affe8bf577b4cd660d390713028726b8bd9e66b70ee904e54fda832dc1e7 |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-UNKNOWN.synth-key.json | 270 | 9c71505b673ba950891e6c67c05e2ca2f7188714b53a13336aa327b68fe0695d |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-UNKNOWN.x-key.json | 103 | 3b91be15480fd6965b79a416418b1e1fd2cba525161365bdfe243a527aea748f |
| spec/2.0/schemas/examples/invalid/documents/E-KIT-BODY.blocks.json | 122 | ca15aa2c4002cc0ac89ce07613a5388c78ec8a5544b4bd97b4e73621dc66737e |
| spec/2.0/schemas/examples/invalid/documents/E-KIT-BODY.values.json | 122 | 6550896fa1c770e64d38ccb8b0965928b41de5dc21ce1a341715eaa2a67dac70 |
| spec/2.0/schemas/examples/invalid/documents/E-NEEDS-MISSING.ai-settings.json | 134 | 5f6f58e8bfc5ff92d5cb7776b496da1fafd0fe6eea8d16eb3fac5b6d110b87c3 |
| spec/2.0/schemas/examples/invalid/documents/E-NEEDS-MISSING.drag-velocity.json | 321 | 7d7b343df3bc292b705baefd4b1180aa6d2d6da3aa733ebe516844da5f6da891 |
| spec/2.0/schemas/examples/invalid/documents/E-NEEDS-MISSING.page-settings.json | 113 | 2b4baa3b00eada150f40904c117193ec78d7531099a7d6a472edb77667a0947e |
| spec/2.0/schemas/examples/invalid/documents/E-NEEDS-MISSING.physics-key.json | 118 | 7f982d70d2acc3263973709758bd427d70a8fc04eb2ca264c4a9f470e8c42af4 |
| spec/2.0/schemas/examples/invalid/documents/E-NEEDS-MISSING.snapshot-settings.json | 268 | 01fccc6918345519c2f8b3700f3da91fefc0cda3fbf515170139395d6605032b |
| spec/2.0/schemas/examples/invalid/documents/E-NEEDS-UNKNOWN.json | 113 | cd34044a7909a241ffa949464a497e30a234f8cce3b4c6bf6a84ea854a808416 |
| spec/2.0/schemas/examples/invalid/documents/E-RANGE.limits-above-up-to.json | 145 | a467753ccb557610035308ae6a70e4b52331dc5f51b99a10371fb3427a60bc56 |
| spec/2.0/schemas/examples/invalid/documents/E-RANGE.limits-below-format.json | 107 | 3aa0e02d3034ea77bb8f1689efd5cee9793f010c81c93809f8dbd78f761657a2 |
| spec/2.0/schemas/examples/invalid/documents/E-RANGE.synth-pitch.json | 252 | d210bc1430752c31cf571070e5908eff8d2f527c2d64d3179b647ace20e9fda1 |
| spec/2.0/schemas/examples/invalid/documents/E-RULE.give-way-contrast.json | 260 | ba97b885fb2507d3683ebcaf440c64e6ca7966159639e47d359fc267d37b86b9 |
| spec/2.0/schemas/examples/invalid/documents/E-TYPE.axis-value-without-input.json | 194 | 37af91408993fac74b152e2bb109e701dd04b71170fdfc9f0df55e902ac9d57d |
| spec/2.0/schemas/examples/invalid/documents/E-TYPE.drawing-number.json | 75 | 52b40d69e4fe3be203fb4fabafd0b1dd28f199657e44a9ab253cc5f720875cfc |
| spec/2.0/schemas/examples/invalid/documents/E-TYPE.host-profile-capabilities.json | 91 | 62646aab469f730adf8116b9cec9c56b7c1c02c356018501f23f920d4a5f9947 |
| spec/2.0/schemas/examples/invalid/documents/E-TYPE.play-test-steps.json | 78 | 5ba82413231c7db9401b6327ef0617cc56e798eb7167a63ac588cf50a64d246d |
| spec/2.0/schemas/examples/invalid/documents/E-TYPE.rules-object.json | 96 | 5bbca72269eb16f53f2aeb56a41a4a0f0f3902ebc907edd31b572ae0d93fd410 |
| spec/2.0/schemas/examples/invalid/documents/E-TYPE.synth-wave.json | 255 | 10189b11edfe88c191be3de239b6525ba4f2a5aad2c430fec0cbed710743a4aa |
| spec/2.0/schemas/examples/invalid/drawings/E-A11Y-OWNED.aria.svg | 169 | 31c2498da0d08c10b33ae630b69fcdaa8f99543c4444eb27761444ba96ed779b |
| spec/2.0/schemas/examples/invalid/drawings/E-A11Y-OWNED.tabindex.svg | 167 | 016a5521c8282a0e78734aa791f15643934d1411ca45058e10aaaa4c59056a2e |
| spec/2.0/schemas/examples/invalid/drawings/E-COLOR-ROLE.color-role.svg | 297 | b9d88ad8bda49170c8ecd9d8c212c83a23e8d22e4ba0149a476590c41a0d7b8b |
| spec/2.0/schemas/examples/invalid/drawings/E-ID-DUPLICATE.svg | 176 | ad91c8c2ed6439c742a0e335a1bbd0b619dd639742d2b042ed28d23266cf8961 |
| spec/2.0/schemas/examples/invalid/drawings/E-ID-SHAPE.not-namespaced.svg | 259 | fb17ec30fa4b625a4a6f170779032f3f59d4c1a8b9bb6c794dbddfee2cf91755 |
| spec/2.0/schemas/examples/invalid/drawings/E-ID-SHAPE.part-without-id.svg | 246 | e5e3117eb2d98390e59e8d0be8e83581949763967b087adb896cb10638ef4ea4 |
| spec/2.0/schemas/examples/invalid/drawings/E-ID-SHAPE.screen-double-underscore.svg | 157 | 2d4e7b44c8f3c6c90c4961e2b90ba6771d7f1274fa0f714871a767a4472ef347 |
| spec/2.0/schemas/examples/invalid/drawings/E-KIND.component-in-component.svg | 243 | 5123e5f5b3eb2f47ecf6ba86aa958ba9f29bcc57c6db6e8bcf705e066bd4aea7 |
| spec/2.0/schemas/examples/invalid/drawings/E-KIND.component-transform.svg | 285 | 6a9074d810c45716b458e5ff15f3e8e35df21e9ab75401bda9db794ac0303d91 |
| spec/2.0/schemas/examples/invalid/drawings/E-KIND.root-kind-component.svg | 157 | fd85f523da259cf3b5f281185d05a0069098c6db0981f789bec80b6d6b2a05a8 |
| spec/2.0/schemas/examples/invalid/drawings/E-KIND.two-components.svg | 171 | c7bd60224e5dba946abb9112d9030081e0f4f1798b50a70b147f3ed1dc6148ef |
| spec/2.0/schemas/examples/invalid/drawings/E-KIND.unknown-kind.svg | 260 | 544e3bbcb976ee3d211e0675dcef64b928d0e570aecd1377f0a89d6dd37f3974 |
| spec/2.0/schemas/examples/invalid/drawings/E-LOOK.bad-name.svg | 395 | ec07c0beefd01785166fa98455e2d20d5c0f2cd8b4559d27db087337c3bc454f |
| spec/2.0/schemas/examples/invalid/drawings/E-LOOK.not-in-part.svg | 256 | eea0becf0df5a11effdf8d4daf836d007cb3633e9785a72362fa906d012f90b1 |
| spec/2.0/schemas/examples/invalid/drawings/E-LOOK.one-look.svg | 312 | 843fe9262139a8e477a163ae45cdac08b8df230d4193dcad36ba3d20bc4724ea |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-UNKNOWN.alias-without-a13.svg | 423 | 0a5a8a9d90142219306b098ab9f9d9c3a68f03a0f50d1d83f67f1b984ee29219 |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-UNKNOWN.made-up.svg | 288 | 908ba558adb431028cc2d64f85e2526e6dee9ab5d5f9efa788676dbd946e468c |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-UNKNOWN.page-hook.svg | 295 | b9eaf2600fc30f19a95d725e24398cbb58d8e9490efb2ce614738a7b44bd1940 |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.derived.svg | 174 | c91f37c582962e540eff949cd7f39b46fcefe369f0fc92c6a029c023c0e80bfe |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.fit.svg | 279 | 8a699babfd7e6cfb4c0064e8510a99f0b9b1d81e7a3ffe88d2f0df130cbd8127 |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.follows.svg | 282 | 6a8c914ca7ca3d5a6901f571486058623447dc54dcfb57345ed820d001009953 |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.keep.svg | 227 | a6d35996ea1a8099e61d79188555cb1ddb2180c9f99cc1653e7336b967f1d780 |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.label.svg | 278 | 45fce86fc406bb350cc5d6113cb043b70a0d2b4a39a1eb4461cafb8e0b913b1d |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.motion.svg | 289 | 6f35cea56061ff0155db9e0958a1817ea6838612065db9cae9d4a953220a21b9 |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.paint.svg | 159 | 951a431d3e62d9fdf49562c6740f61a1e3900f57412121c940ed9223b4e9352d |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.pivot.svg | 283 | 2fec65c6d0acffbcb8da5eee5bb77fb36adccdc564b72bc4a281451cf75d2758 |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.role.svg | 286 | 1634f90ba5110d8468df41113e08661505e7fe0ad5a4312ff46eb4e5cd22c82e |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.route.svg | 190 | 83e7a6ff8906a738552943ffd61c40181be86a75633ed52bcc7b8a933d368dea |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.slot.svg | 261 | 5627f9f4e378ec88f62886de522a1860d9aaa3eff42b00d6c239398a512e5e96 |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.steps.svg | 204 | 712ad52f8bb1d3cdec29a0dfad0393b5ca83e4475e626983fe8cd25c36868771 |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.two-sides.svg | 291 | a81af0fc76f907b7be5a1e9255a3a236d8da7971e5aa71c5b56925b6c822718b |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.type-role.svg | 275 | 11fa9cb66c3c387dd17d41be7a82f6050ac33d22ac873bb1ba25fd4ad1e6f51a |
| spec/2.0/schemas/examples/invalid/drawings/E-MOTION-RANGE.rotate.svg | 313 | 23b37950af61f2f193c4ef24b0958f7bcbe50f1f6c837f8b2e70f0ff6a962c82 |
| spec/2.0/schemas/examples/invalid/drawings/E-MOVER-TRANSFORM.svg | 316 | 5cd07299c4d825c0d21e99427f50a62f6af0d4ac1ca9d68ae778b82fa84a567f |
| spec/2.0/schemas/examples/invalid/drawings/E-PIVOT.rotate-no-pivot.svg | 292 | da72b565b617d60852937979d0a6e0ad615eeb66f819d12a5019d832bc8e0032 |
| spec/2.0/schemas/examples/invalid/drawings/E-PLACE.fit-element.svg | 251 | ab1df93fdcafeee2b81eebe10673482d911906c26a1d896278bbc377f0436d2b |
| spec/2.0/schemas/examples/invalid/drawings/E-PLACE.keep-painted.svg | 216 | 3130dcaa61c979bb61a65548100d6713c7403351bd6ab0e8eb8d6b2810c81b7d |
| spec/2.0/schemas/examples/invalid/drawings/E-PLACE.repeat-element.svg | 278 | 559f3d1c26707fbf11227059c14ad2247c5c24618b9cffd0a6ba671df69307e1 |
| spec/2.0/schemas/examples/invalid/drawings/E-PLACE.slot-twice.svg | 319 | 0928a32266738eb00bf39fadea385ca1f76507512ae0b02ade4c2165ed39f843 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-LIMIT.blur.svg | 191 | b221054ce5721549dd992bc4356cf4dc3b779001e7a229fa8021d702d3979e2b |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-LIMIT.octaves.svg | 186 | a52357218e330f3c2e0b8837d09f15cbe1770b50e6494724fb3aa50bebdb4564 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-LIMIT.use-cycle.svg | 179 | 604c8874c55fffb6647fd9c4697859cdf85009fad10487aaef6444d23d7da319 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-PARSE.doctype.svg | 187 | 89c04c3b769ccffc3e657413ea07d82b6b9cfb76e7012ae799016218ac3a561a |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-PARSE.processing-instruction.svg | 151 | 5723173f7e6cfbac2eebb5fc54a27f88311d9d22e626dd9254331d8c0aa3b8c0 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-PARSE.unclosed.svg | 119 | 0f67a552daf4ca30e416a7d8b4b4f6bcc5f74a3f8104b5f493252e8b83561f9d |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-PARSE.unknown-entity.svg | 145 | 37f2c4d5494f33ba5f5cce242239616c4810940478a456627f99f4b76e345407 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-ROOT.no-version.svg | 86 | 8fe74bc2bff00638ff2479062c3dc2be90e07389d093536490ec0703ce266da0 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-ROOT.no-viewbox.svg | 90 | 72bf11d2a27214139d65c906e6672f0f4521aa8a16cbe3e48a454bf2bd4bcdd7 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-ROOT.size-not-viewbox.svg | 133 | 8ddc1a117b5cb2eed4601d3afb0ae1ae88e403a3cce7dfc84ef2ef061aec206e |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-ROOT.slice.svg | 147 | 78e9a8a16352c92d0cdbc9e4d9a30594a597b155c960997254814d2f7cd1c02a |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-ROOT.version-0-1.svg | 110 | e7f273690f40e18897e8adc15c1e40fb1e06a8ca30f18d5cc67950ba90798c53 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-ROOT.version-on-part.svg | 282 | 4f23ff040dd68cd7b09aee6ec93320084b1ccec252dc3b0b0787f9f223fdf0ee |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-UNSAFE.animate.svg | 188 | 7a73b818e5c4becc00b940359131c08828f5604f7b1e9be0845bd5bcd3cec805 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-UNSAFE.foreign-object.svg | 158 | 5286082d3c578e2d0caa51a31fe11ea188ea5430e0b3f3b8e65130f46a1d2b2c |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-UNSAFE.onclick.svg | 168 | e1dd8abba149ed3a817ac50017839b1c0af9de6eaebb124df672f2fcc39d6be4 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-UNSAFE.other-namespace.svg | 199 | 6eb3368f98e0991b61698d8a02b3f60074494a6fca7fec66c0daa3b8edf20bb1 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-UNSAFE.remote-image.svg | 188 | b5907d41c58d2fa5e0bd03de67505b55719ca1b311f55023be3fbe0c0a7a59db |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-UNSAFE.remote-url.svg | 189 | 2d512a06673ae11a23ee2ecc222f47c1e355b81d936bb338b4e56216a02824ea |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-UNSAFE.script.svg | 144 | 38c8a1bfe74f8722a31ea0784f84b3365d84f2941f8a106165d2277f5cdad220 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-UNSAFE.style-import.svg | 172 | 7d2f4dfd17025bf65fc42f891ab5cc3fd9ee8b7fab41ecfb47105d056a14c64d |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-UNSAFE.style-position.svg | 178 | f28001b77487a7908e58ccf33eaef68330c494915179210082e8e020b073dd86 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-UNSAFE.unknown-attribute.svg | 177 | ee75200f964ef613f0ff36893378db39adaa83f8e209c3c473eb974503ab4920 |
| spec/2.0/schemas/examples/invalid/drawings/E-WORD-RENAMED.anchor.svg | 286 | 9b46d42f118146f0a694543d3836af3e4d190bbe8e8843ec03677769e1501428 |
| spec/2.0/schemas/examples/invalid/drawings/E-WORD-RENAMED.icon.svg | 305 | 94dd95f18855b94484caa85143ea8d755a77ce47074da90a354d6f556b34945c |
| spec/2.0/schemas/examples/valid/documents/capability.json | 224 | aa0fb65cd6176da8b6583ff7f018adffcd4c04cc8147058fdb76b840fe48bcda |
| spec/2.0/schemas/examples/valid/documents/change-play.json | 257 | e80478d5ac16d2fd51077a27084c4e1b03d52402a2edd1341b53040b56d8706b |
| spec/2.0/schemas/examples/valid/documents/change.json | 360 | d1d864adec34547ae1800d69b61e0b79c4ec1a9c4a3fa300da369d05bad4b8ec |
| spec/2.0/schemas/examples/valid/documents/component-compound.json | 116 | 2e2d8fa0550a572bc712587be6fa414f14e80f0fc61d94f574799411ce9191e8 |
| spec/2.0/schemas/examples/valid/documents/component.json | 568 | 08390c81a8325da325db7f0318ea93fb610612b827dd7593814b298628bc1b55 |
| spec/2.0/schemas/examples/valid/documents/experience-axis-input.json | 199 | 4086da6adc1c6aa04493ff90506843d8e5f459e25a3b812091b6ae7e82cb18b1 |
| spec/2.0/schemas/examples/valid/documents/experience-kit.json | 260 | 506f2b3efef483d22ee16d1a61558bd1bb672e26c441d96b60154dd87cb9c06b |
| spec/2.0/schemas/examples/valid/documents/experience-limits.json | 362 | 776f5d2694ae0a083274576ae8cfb70a987e85581251b1c8551ff2602946cb0d |
| spec/2.0/schemas/examples/valid/documents/experience-page.json | 330 | 30c5df32ad475b36168313978cdca060a2fa90707254617d8a1114560fba1338 |
| spec/2.0/schemas/examples/valid/documents/experience-roles.json | 455 | cb3b1ff8ad4cdc863edb6139875f9c789a05771281d4eeb82ba480af3c1d5245 |
| spec/2.0/schemas/examples/valid/documents/experience-seats.json | 493 | d6af3b321073946b12245c71615b9126473fb124a58b4a81773750129d677f3d |
| spec/2.0/schemas/examples/valid/documents/experience-synth.json | 345 | 228bad4d5a95d4b8dbbc44e6701c5d0aca3a558d8bbc232df19d31c531eafb9c |
| spec/2.0/schemas/examples/valid/documents/experience.json | 253 | b7ba73e08956f35bfe5e026792904244ff17304d35449790a5442ac270d2a5f9 |
| spec/2.0/schemas/examples/valid/documents/host-profile-limits.json | 259 | 8a510c569bdc1add8baf4fee93a84fbff8f116675aaae8130e1d92bd4c5169d7 |
| spec/2.0/schemas/examples/valid/documents/host-profile.json | 151 | f5ee70baf9d4c586c64b24dae517a32b6c353a7db43faede77b54672a08d04b4 |
| spec/2.0/schemas/examples/valid/documents/kit.json | 151 | 6f44f5315f49ce6a7eeefc3f496d003210e2cdcc6caa0cf72ea13872f4bd677a |
| spec/2.0/schemas/examples/valid/documents/package.json | 203 | 2cb95df5569663e588281fc107a0ba51836bf06e7d0bef0005507c9658a9164d |
| spec/2.0/schemas/examples/valid/documents/play-test.json | 93 | 8a5ff3350024f7f468fd1f27d832e4b764fcb82e1c058bb175123b44046d0805 |
| spec/2.0/schemas/examples/valid/documents/receipt.json | 267 | 35a53a31ee4e7e5aa5e881f56c73f4d573b863a8422c73982e22234708824b79 |
| spec/2.0/schemas/examples/valid/documents/rule-pack.json | 252 | 67c8d782a3ae2deb0aa1a6bf8bd7127ea04c1d95278262f38671e703d323a11e |
| spec/2.0/schemas/examples/valid/documents/scene-flat.json | 170 | 78a57c8c851cf86fd43e2cb9ffb6cb9da8f1910f82721d4ade466295c22027ac |
| spec/2.0/schemas/examples/valid/documents/scene-inherited-needs.json | 369 | a1d33629bd109a4ef5d349191a2f36cbe1d3b4c3580cc9ad500c4eb77d423688 |
| spec/2.0/schemas/examples/valid/documents/scene-physics.json | 572 | 221d23cf42fdaeddb30730573926ba1d80987c2d234efb284039dc63728fa5c8 |
| spec/2.0/schemas/examples/valid/documents/scene.json | 289 | 9c5306252ffc6ada5ef3d6ddf08aa4245660e9222ffeeade867b6a4728816d97 |
| spec/2.0/schemas/examples/valid/documents/shell.json | 164 | 9ece70ef1e6c5755c7a7c298b5ccb0f34f50d89ca21ec217fbb6572f110e4d47 |
| spec/2.0/schemas/examples/valid/drawings/W-KIND-MISSING.role-without-kind.svg | 269 | 08e1dbcb00de5ff3316392bfb9ed030424d9aa1ebf839a94d159337dc79ceedd |
| spec/2.0/schemas/examples/valid/drawings/W-MARK-ALIAS.look-alias.svg | 423 | 0a5a8a9d90142219306b098ab9f9d9c3a68f03a0f50d1d83f67f1b984ee29219 |
| spec/2.0/schemas/examples/valid/drawings/component-all-marks.svg | 2013 | 5921f64ac2a65d22b0c8d110eeaf2fbc2fe42ee3576c65f629fbbb8e9695927d |
| spec/2.0/schemas/examples/valid/drawings/component-button.svg | 391 | 3d3cf43f3da0ae9c6bd29e82118d66842dafc0d72770b591ebfa41977eec328e |
| spec/2.0/schemas/examples/valid/drawings/compound.svg | 392 | d70c4a31f5dfc4cbb3f3a14793fcd788770f0c2883bf3826168e36184b93b1ef |
| spec/2.0/schemas/examples/valid/drawings/screen-exact-size.svg | 247 | aceb6c6ceed4c01e2dc1b4313aeb4d88047e871785484530c59d456259b728f7 |
| spec/2.0/schemas/examples/valid/drawings/screen-placed-copy.svg | 329 | 02e09ebc9221b53485c96534b421c661a9aac132ba8c295bf167cae39d729b1e |
| spec/2.0/schemas/examples/valid/drawings/screen.svg | 1981 | 6ff7fa83e46c65cd036e7e269d485a6dc7b64a047b6ee6d25e38e45e3dbc7264 |
| spec/2.0/vocabularies.json | 63506 | d37697ba9be7687d981b6be2b5a1be42a1541ef157a6d1c172db8aa71ddedf42 |

## Export payload (before this report)

| File | Bytes | SHA-256 |
|---|---:|---|
| .gitattributes | 416 | b82126ec1a7737027826a4353d234f0497eebded5aea24bf834c1f543e2a0987 |
| .github/workflows/checks.mjs | 62 | e40bb0b08753d8603febd7c197506d21c7357978de016e6171ce41f2e17a9545 |
| .github/workflows/checks.yml | 949 | 429da7c47f24826584604d65b148538d3219ea6e2d90b17e80ce530454b1c69a |
| AGENTS.md | 1532 | 9adbf6fea5a623a6d551062ccd0ea4a749e95fe8e3a743d0a6936f92163f1fed |
| CONTRIBUTING.md | 5428 | e9543b613c8274c50135ad9ddcf5f9ac79acaa27ffab3a789740ecdc31896f0a |
| EXTENDING.md | 5499 | 6c12494f7d6d8f43da6e1cc8c93ff14f0be767f190f1ca59e3656d46cace6f62 |
| GUIDE.md | 24256 | 410c5cb6639c62a759eb77a108c9ad5d06d64ea23effa666183825e8b3323e16 |
| LICENSE | 11357 | c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4 |
| README.md | 5443 | 21149817fae156c09a780fb46b01d10450a7efc21185b1bc13520ba17a55b1dd |
| bin/hypersvg.mjs | 9320 | b4cdbfab8ec719ca6e3529a6e60fbe302a72b791c1cd27a9710211e270114fcb |
| bin/starter/AGENTS.md | 958 | a375b944da92971a686f3209aeb825c857e754d5df9685d414252f224fc34f1e |
| docs/browser-embedding.md | 2341 | d9130276db778b6b7f04e6b50732ce75f9b13ac937d786ea6940e5d1b4e75975 |
| docs/guide/examples/ad/ad-160x600.svg | 904 | 7755da6366adeeccc1eefee6aaadafda856a4f504162e0b18564a96312ac3f9c |
| docs/guide/examples/ad/ad-728x90.svg | 900 | 7d194c4f73964c8275a3e2240d656604152f14ae36ebf29eca43bb50675d73bf |
| docs/guide/examples/ad/ad.json | 345 | e8a53378e7790e0d30da531df393093f06fd6e2ed09f288f2d90eba98e2cb5ef |
| docs/guide/examples/ad/experience.json | 632 | 47d571890ab238d80ad2a713df11113be84929e5f5ad41c8aece0ddcc494a602 |
| docs/guide/examples/harbour/crate/component.json | 526 | 5c6ce40c1c1c739226b02fbfedf661ee07ce40e1363198123193de04b97c901d |
| docs/guide/examples/harbour/crate/crate.svg | 806 | dd143e13d3d25cf2a585f46ed24997c5b428087564411a7b1007561f14d4f221 |
| docs/guide/examples/harbour/experience.json | 2455 | ab22bce50c0ff8ae0ac6dfd757712fd3fcdc08ab11b5fa900ee98c85eaffa8c1 |
| docs/guide/examples/harbour/gate.json | 236 | 55dfb25d8c5d4c6e0cf02a50bdfb262e046263036c92e8e70bccecbd36db0881 |
| docs/guide/examples/harbour/gate.svg | 752 | 785866cde97be7021e0a164aba29af92ba9eed0ea64c411746ae89d92f18470c |
| docs/guide/examples/harbour/harbour.json | 4791 | a67cc8154c0ec7ab6acea8fc4503e0babe2ef712be8b9c592a097cda0b8cd9f3 |
| docs/guide/examples/harbour/harbour.svg | 5838 | f280b608e451dba6928232bd39d60d4ab4e2f55b6e8e2071cd0db08192bb6c8a |
| docs/guide/examples/harbour/shell.json | 1170 | 62aab62e75f605c5e9ab2bb6abf1cbc709c1a97655d9c795e02ea6ab140621db |
| docs/guide/examples/harbour/shell.svg | 1418 | 7af9d812f061819f73dcb7980978e65534cb3ba56a7337a09125e2f6915b9839 |
| docs/guide/examples/lamp/experience.json | 554 | 8d51040446878602950bad84c8b5e80355c766e2a2701c37c65fb14a2b5524bc |
| docs/guide/examples/lamp/lamp.json | 444 | 6183600c86ca809417626695608ad62671ad6ecf0a88e7099b4fa2d5ee2a5682 |
| docs/guide/examples/lamp/lamp.svg | 1052 | c20685696e23e403e343b6f6cfa83210457d27f4d158415be77d40ed03a1c1cd |
| docs/guide/examples/light/experience.json | 279 | 4ad574e1a8a839e2301c34b1cdf76f543db18750d403cf37779255f8aff95b3e |
| docs/guide/examples/light/light.json | 595 | 39f55eab727be274eec7a1b5cbbeb2ab6074887b432b6bcdcb18494963f2309d |
| docs/guide/examples/light/light.svg | 1397 | 6ca9159819eaaa01ec0a7d0e2305cef630f9753258dfac87ef5874dcfa8dd018 |
| docs/guide/examples/list/coast.json | 1140 | 4a76a05f88b0f94e2284ee333a8db5756280ec96498c3e862a1e8527d1e4111f |
| docs/guide/examples/list/coast.svg | 1265 | 47795e75c63ae9fbddaf56d6725a89cb7eed26ad8e5719588591519771aa7863 |
| docs/guide/examples/list/experience.json | 239 | 980ae1ad68229a8749f5406a1d6980c1cb1bbae30a6f465c552dec64e2739c23 |
| docs/guide/examples/list/sign/component.json | 246 | 752a51f0f0bb9312f40a82699b82d14928b68c0aa2b434a903668d8519cfe8e2 |
| docs/guide/examples/list/sign/sign.svg | 413 | 3f595d5f1031e0a939644c70768d63befc725aa50ad076eb6d1b61ba20ab1f86 |
| docs/one-page/example/experience.json | 192 | 3777d82237c0cb2894675c9f83b3019949a260f9adc6f08790127de7827b811d |
| docs/one-page/example/scenes/hello/hello.svg | 874 | 12f35af95b75ad21792f2b914613b09496609412c7eeffd94118f309712e773c |
| docs/one-page/example/scenes/hello/scene.json | 655 | 80b61bd21672481078c6f667091b07bf71ab74301704e13ab00c134f87987512 |
| docs/readme/lamp-off.svg | 497 | 234a99f5d5004d7fb63cbadc0062332880354d643bb3c1e4aa9ef2f85b94fdd3 |
| docs/readme/lamp-on.svg | 497 | 8315c660614b212b4237800d832b1caf407c7efb37fde572b93f51d3bce05123 |
| docs/readme/lamp-preview.svg | 1824 | 7584d1f851723d3892289b5bb7ede7fcfa25d991798a57f336cb6f5093727318 |
| engine/v2/README.md | 32617 | e88313d55980240ae4b39f467c87486fc26e24fece982064382c69292d559827 |
| engine/v2/addons/README.md | 4292 | 5bfbb862aa870b832676b1b1ea4e67db0f3eab401ee22ea6d688aa5155b2907e |
| engine/v2/addons/breathe/manifest.json | 1627 | 18416c0568057a95b9e78ffbce33f0f6a669594b2c524338c3535f9aa3158d51 |
| engine/v2/addons/examples/addons/example.glow/index.mjs | 2005 | 5503be79d5fffe1e1efde0ffbc30be2e68e1845e202fd8717a40cd7ceb429471 |
| engine/v2/addons/examples/addons/example.glow/manifest.json | 1263 | b7318acd10b3719f8355ec2748801c7a76652d39e9e73dd14f8650e25f528f28 |
| engine/v2/addons/examples/addons/example.noughts/index.mjs | 2336 | b8fd6fd0de389f50977dfc188a1817e2a85703784362215c22b8dfa73ab6a006 |
| engine/v2/addons/examples/addons/example.noughts/manifest.json | 1525 | 4ae967c5bd78237918ccc62b4c193e8a35c9ca0f8b68d637c75852e0eb3169ed |
| engine/v2/addons/examples/addons/example.noughts/tests/noughts.test.mjs | 1247 | 4efade2ff3c76e5370ee106e1f0a869b60284ea9c78d7abd0972ed0f6e59a4d0 |
| engine/v2/addons/examples/addons/example.shake/manifest.json | 1084 | ec2487615d5ef9d8d226addc088eb400c65abc12259ab15d45ac8d98cf09f685 |
| engine/v2/addons/examples/addons/example.steps/index.mjs | 1448 | f91fe9af8f3712fc8909144d8a75c2c3dd100cbf3d0fa6cd1ae80190cbd814ba |
| engine/v2/addons/examples/addons/example.steps/manifest.json | 628 | 465711962da0ed69679230491ac4b03ba8e465e7c20f2038a7504438cccbeab2 |
| engine/v2/addons/examples/addons/example.sway/index.mjs | 506 | a011cbe22a261dcb1be4d7679ce654914b4b69d1441b86c2fa2ea09d93d3703c |
| engine/v2/addons/examples/addons/example.sway/manifest.json | 624 | abccec592ae777d67c75b73e51652154fe47a71b880a763bc517ad1f65d2911c |
| engine/v2/addons/examples/addons/example.tint/index.mjs | 1311 | 981493accc6778b1962973ae9122bb520f2437df242dc1d66821fb446748eb19 |
| engine/v2/addons/examples/addons/example.tint/manifest.json | 1197 | eb22ca06a8af2b760c3acf1316e710ceca8e2be5fe9a40abb5e08ffe8d85faee |
| engine/v2/addons/examples/doors/experience.json | 845 | d1276970e6fe15afba60b965213374177739e40294ce41eef9498f8e0a9400ff |
| engine/v2/addons/examples/doors/scenes/yard/scene.json | 757 | d377501ee2c6a3a127273f79f06cd034c81f1051f21cadffd861a90ba54eb99f |
| engine/v2/addons/examples/doors/scenes/yard/yard.svg | 1231 | 0ee25bfcbf0b7c2f13afa3952e3159a51506a948e39e1516430f1ae4ac45cd9e |
| engine/v2/addons/examples/lamp/experience.json | 589 | fea8bda7db47223c0b15361dee17ed0a6afc77b49e1ff628298df463a35ce69a |
| engine/v2/addons/examples/lamp/scenes/room/room.svg | 647 | 6d712c215947e148e1627f0679f8f5781725182f1087a5ea219bc2427d8f2122 |
| engine/v2/addons/examples/lamp/scenes/room/scene.json | 703 | 4a59ca229fbbaf7b6ed454c54dea0e01e9a231b7fdc1c276102c00b36efb8590 |
| engine/v2/addons/examples/noughts/data/lines.csv | 99 | 0935ce6cb195f4841db701a4305a21b4a5e72fa83da0daf610e5243d6b22403c |
| engine/v2/addons/examples/noughts/experience.json | 4433 | e03e6039388f63166464b4d010d64c5fc0a8de4d5718a342629b680fe51d99be |
| engine/v2/addons/examples/noughts/notes/art.mjs | 30382 | e22f87ab8fc74fe8367c02ef9c8cd02962a3dd81c6655ea207458de678280579 |
| engine/v2/addons/examples/noughts/notes/geometry.mjs | 2163 | 97f03965b3f9d4aa0f47b7bd954184e515c8a0955008e5064d1d957b65c06dfa |
| engine/v2/addons/examples/noughts/notes/make.mjs | 40394 | 53c416377dd0d78ec6cf4ebb75ee7adfe488f96509415af8834a87cbc668f4e6 |
| engine/v2/addons/examples/noughts/scenes/game/game.svg | 68337 | 1d0785d6615d0ed226fddf29f4066949fe6a72e28cf63678e21f03ad82145327 |
| engine/v2/addons/examples/noughts/scenes/game/game.tall.svg | 70660 | 68b4249bfc81877f8166fab7aef05b32777d112e240a7805c71309657de8d2b9 |
| engine/v2/addons/examples/noughts/scenes/game/scene.json | 34910 | ea21a24bbcfb7312421f3ecac3240276469eb0b324c53ff3af33aaf6bd3486f7 |
| engine/v2/addons/examples/noughts/scenes/pick/pick.svg | 40506 | e5e7d1978448cb48032617f44034d847e529d24353fd8db7cf54ac2444eda0cd |
| engine/v2/addons/examples/noughts/scenes/pick/pick.tall.svg | 42037 | 294a41760f9c508889f8267b46d7002d98577f280b629bf9d28e41e69edcc8a7 |
| engine/v2/addons/examples/noughts/scenes/pick/scene.json | 7047 | cd985ba06f11fa893337530ff39d130252ce88924e22b572ff0a15ea43b7763b |
| engine/v2/addons/examples/noughts/tests/play-in-browser.mjs | 10301 | 510b07605f0d2b9224d423181065804195f878014a84e31bc45d04f23961feed |
| engine/v2/addons/examples/noughts/words/en.csv | 528 | 127982a01a2a2097ae74e5aac34ce5bf94793bce42367860aef0b790e61fac4d |
| engine/v2/addons/gentle-motion/manifest.json | 723 | 7cdb51e2890b74d05ee34a522fc8dcadcd79e8ebafd9499d5514ed5e33fe24e3 |
| engine/v2/addons/pop-in/manifest.json | 1968 | a078d249352271b09847b4e1965df6aee4610f344771e9dc4d4e574420877f6d |
| engine/v2/addons/wobble/manifest.json | 1822 | c4201c9c9808958fcf8cdbd667c49dc6df976803aa7833708513baac2e88fae6 |
| engine/v2/check/absent.mjs | 2683 | e1df2329864d1c53297ce6131102539009a7c0c6cbdc1aca1d04608e2b68c727 |
| engine/v2/check/actions.mjs | 4652 | 1a09bcb5fc71192b9283a2baae57ce555c92761e9e13b357e40e65445542d48a |
| engine/v2/check/addons.mjs | 8733 | 43be6ab2579897250f25740ac45b23a7371882e772077f402c380712e54c934a |
| engine/v2/check/budgets.mjs | 3502 | c7c1aa1137e96f4fc580c06017814cc7552e0e358c2ec2a8a5a8ff0da15f1278 |
| engine/v2/check/builtins.mjs | 8875 | ef0dc62539fb971812cf7444da942bb7da1cf3d8e72faa84671b505e8bb28e43 |
| engine/v2/check/catalogue.mjs | 8400 | 617a391738da321f05bb2df0df9c7e1cf5674b9d764faf34934931a2f2c4df1d |
| engine/v2/check/cycles.mjs | 4941 | 280022223be825b13683588786b62c6491f0a53a16ae50e76c6af9bf78699433 |
| engine/v2/check/diagnostics.mjs | 8231 | 661029e6fb3907436b88a56a399035fd03a11aea7b51026f52c63e6fe9cb0724 |
| engine/v2/check/digest.mjs | 4010 | 203491bb8eb275bc98d011a36bdee8380261a92f26a853ec9468d68a362d8a48 |
| engine/v2/check/drawing-rules.mjs | 9018 | a823f5ff64aef25de5cdd62623d2f047f88b6c273b8a054f7189d88f24b2b24c |
| engine/v2/check/filters.mjs | 2755 | a32b72f6fd7eaa498dc87c3520fb26ae7025ca50f5fee1e34a2089d920165f68 |
| engine/v2/check/flow.mjs | 12301 | 3fe2beb5757a0b27d88cb3a992c302b8479096e824460c46332a205fcc62e62e |
| engine/v2/check/formula/index.mjs | 27302 | b51e067b3578f650bd4858910a794fbeb0a9aff3c6c10546c89b4ab91ae5f202 |
| engine/v2/check/formula/infer.mjs | 23922 | 9b3c0a8fd41680a2e25035582719e7a7d52990f72a842103b1334734aa647f8a |
| engine/v2/check/formula/motion.mjs | 2288 | 35443cb39d83248ce2f4ce55c5f3449d3a86a8c11573e94345222a6fa7f5e6be |
| engine/v2/check/formula/params.mjs | 1269 | 2850c27a0e7b023aa96834bc3137c09705591d14b63ad199a5997bcf15875654 |
| engine/v2/check/formula/sites.mjs | 19436 | 7870884b479cfafb65f574dff7fc2910a0cda49e776ebdef4ca4dc7b4d9bf31b |
| engine/v2/check/frames.mjs | 4596 | 334f91f8919631aceba0c8a115de572ffc5c2111b88e4e322bc6b3de057c291c |
| engine/v2/check/index.mjs | 7154 | 2fd1dd06234e3efd52ba2810cfb0078de9f4b92b2fcdf7454f6c576c8ba383e1 |
| engine/v2/check/kits.mjs | 23382 | 3f233bb01fb576955f3e568af7f8b5264cfb787c121bc1c3eacd86044d7899e1 |
| engine/v2/check/live.mjs | 3386 | 35db05e7d21c5b1a54dfa241c1488a4ce175f8dc2ce3580429b79477985d108f |
| engine/v2/check/lookalikes.mjs | 8040 | 5e948e87353ff734db2ae19655ea7477bee1b6e44caa7772d5874f163c55e9b6 |
| engine/v2/check/media.mjs | 14744 | 02169c5d14a541e6ed722f4eb069c31ff65d39d4c4fc023e113e8b533cf82523 |
| engine/v2/check/modules.mjs | 12284 | 9a351ae7217eedec5e621483e4c99956c61c672cc6b6acc8083a6365f59f812f |
| engine/v2/check/motion.mjs | 9924 | ffae123905db7fa8cd2b312baf6903cabd11a6c230171ef2593dbce953b55d03 |
| engine/v2/check/optional.mjs | 434 | dbe68620432b6f51de0a357ecd337fac5bf3a53eee6086769725ca5ac3d2a553 |
| engine/v2/check/packages.mjs | 2840 | 2f4d8d84778932af0f485b5e19d31b30ae96582500bf40a06a382d510d9baca9 |
| engine/v2/check/page.mjs | 11963 | f4a2e056b39a9c0d61abe28b3cf039037947a46a4b3b45d87d3cde60061e7864 |
| engine/v2/check/paint/geometry.mjs | 8713 | 1fac2e1ce66aaa7ae45a55f0747495664a731cb5d0c617dedab8ea68e52cfc02 |
| engine/v2/check/paint/measure.mjs | 8324 | e911679e291e8a50bd15b03ddff495c10b84acc208ef7fa9c4ae6b3e62b006a6 |
| engine/v2/check/paint.mjs | 5404 | 6757dafc873097e37c4d926119078688a60bfe5e2daa763bf513cec5bb36ae82 |
| engine/v2/check/paths.mjs | 6564 | 570189a0903c1bc417358522d411df46e6569308224785559b354fb923bfb86a |
| engine/v2/check/pivots.mjs | 4590 | 10f89f0bb86a732af540577acf9f1f68c8761b68e2fdbbb6bf5251483daa318f |
| engine/v2/check/places.mjs | 2272 | ff6481a81a3df73bd14d0328d82f80e731dbc67052a744e7772b5249d88992e3 |
| engine/v2/check/plans.mjs | 16288 | 8e732c045b94f5c338ec49ffff2564eefe9d25245c7bc6a28e1104594d01fe55 |
| engine/v2/check/refs/drawn.mjs | 1669 | b14323061b722be13250bbcfab3b07818b74073fad79bc911064ef289deb5105 |
| engine/v2/check/refs/events.mjs | 2173 | 744c6ee01f9a4035d5f54fac8753f0be7093bd912401c07ac06a04a085b19140 |
| engine/v2/check/refs/walk.mjs | 3979 | 91e3811225bfe2dbd8c60f334cc96641d53581cb3c812423312dc7af4c4829f5 |
| engine/v2/check/refs.mjs | 32716 | 136732005b4221d4851c9647320b493afd2d5ef33dd47cabacea7832b2109b6b |
| engine/v2/check/renamed.mjs | 10687 | fc3b93e2ec5e2703b2e3ab5cb1e7ae2feff763c758f964712b4f2ef04bae9a5b |
| engine/v2/check/resources.mjs | 7487 | b993cf57e0debad6f4388d7b36e4dea74a1bd6239736a9bb6e7c131cb3145976 |
| engine/v2/check/review.mjs | 13190 | 36373430b222ca5f55abcc8a8f66a9206b0bfc54a2e3f2f2bf04915384949e96 |
| engine/v2/check/roles.mjs | 5807 | d6706185dc54a540f1747063449c526ed5e776177906320fc55e6c79533205c4 |
| engine/v2/check/rules/combine.mjs | 1928 | 448e107d3d5f8dd702ec09a03e9d71e0c99f12ce6e820b6e1d352fc71c4f06f1 |
| engine/v2/check/rules/index.mjs | 15566 | 7da6ed069114fdd9e0a0a5f0f3948043bc58b719b76c17b93e1d1bb5fd774204 |
| engine/v2/check/rules/playing.mjs | 4080 | c0ca344091f864f326be097ff5442c83fcc0a604b75ca8e3dd8ae40aad5d7f17 |
| engine/v2/check/rules/tables.mjs | 1428 | 4f82f306a1770fe802e308ef6fe70c5b002dcf449984c2249e48c2e308e51e56 |
| engine/v2/check/rules/values.mjs | 9214 | faae3c48f2f831a993850a5fd9736063e2a65ecdb97600ceb1e2bf813def9321 |
| engine/v2/check/say.mjs | 1231 | edc09b5f66074b56ec2888c2ca2e353ad588b92207f4f9b5d6d7b9b7c32a28ae |
| engine/v2/check/seats.mjs | 10567 | 101df931651686f9fd2ecc18f57ab64b8ad09d6b54cf3542b0943ffe0ff1c4cb |
| engine/v2/check/sliders.mjs | 13925 | 4690f9ba84795ef62e835d59eb19d17543d29a089cc478bafba7a9b06354770c |
| engine/v2/check/stage.mjs | 3891 | 690db7a4f54077fa838a8c3e394a2d8c36936efa1ef973151deb54cf1b6408ee |
| engine/v2/check/story/grants.mjs | 3808 | bdd12828ee3d668afadd9bae0841c4378b6e38cd7fd3867e513ae7c461bd0d3f |
| engine/v2/check/story/graph.mjs | 24359 | 059ba11e93d70c48ad02c578069f30bba1db5df2c2233c1ba7297749d97a812d |
| engine/v2/check/story/model.mjs | 5790 | cc96c40095a364624dca702edbe39654def36e4eb782827eb953d010042c0d9c |
| engine/v2/check/story/needs.mjs | 11140 | cae282751d754ee88a1531a394ea0ea3e77f9cf150f858cede8664121389f35d |
| engine/v2/check/story.mjs | 549 | 68f4f50fe2d6f16b0c8b5fa7e2b50f090f811084bf8b522e971371fe90d708eb |
| engine/v2/check/structure.mjs | 5012 | 2a7161ed9bbcfbc6620b6573bcf2626dfacb59264ae49559fcb0dd1c6becd406 |
| engine/v2/check/tiers.mjs | 3681 | a1c84f8c0782bdac2e8ed65c3d1280ddd221776f6942815ce01e5ddf0173c1d2 |
| engine/v2/check/words.mjs | 5451 | aff2b993c2e81cf7aa7174880a335a51880a29d4e253dfa4f2b493ee8ceb9ad5 |
| engine/v2/check/writers.mjs | 6939 | e469e39170dfa16e39fcb556d683d031565b6edd2e700e589096fabfc3adccfd |
| engine/v2/modules/README.md | 6912 | 513151dfa273182c45f7909ce5f4a4f83876da33c79efc4181047ed5adc152cf |
| engine/v2/modules/lock.json | 196 | 9fbb966de532e478470eee86b1260f6e38e715dd73f7d4be4d8684e5f8610208 |
| engine/v2/modules/make-lock.mjs | 4066 | 56014345b5ac45fa373e3e18037c62b1b71a70c16d0b9a626db3a1ece2171a3d |
| engine/v2/schema/check-document.mjs | 6803 | 4aa3574a0b942ad88f2a21fb64bb4dd3a5c4a0b4b1d351d9a5fb8adb59e20f59 |
| engine/v2/schema/drafts.mjs | 8221 | 30eacb98207e0d78eeca7f3b3a9883e7dafb8f32a0c9f8d7b67065cf87dba64f |
| engine/v2/schema/drawing-check.mjs | 25241 | 763b09e005a4d9a4918bf6ae60f9f9fe6797d1954339cc5c2a60aee15ebf248b |
| engine/v2/schema/json-strict.mjs | 3640 | 9fb53d237b4d7ff523da54e73da7fe2d6d5fe19c076e582a59ac46cf3eb8921b |
| engine/v2/schema/load.mjs | 1030 | d38205ad4140e6a45e0cfa785442b2b2756285a0936df0596a31a98f9d4ccd8e |
| engine/v2/schema/validate.mjs | 10170 | ec8c66ec5d33717730a241c9117569cac077188d51bcc1908802d2960cf7fad6 |
| engine/v2/schema/xml.mjs | 5136 | 0a772b1f97580da6f821bd0050394515d71b9df2e9666ddff43e93554c2c4563 |
| engine/v2/src/addon-door.mjs | 15363 | c9283ef3bff2b3182d94bb6ad94ea4472a7b9d2b49f859075cf6df7f55e209d9 |
| engine/v2/src/addons.mjs | 30080 | 66a2f5d32d18d8e017a86ce1c63e3792498adf1c0827f40b2616ef16480f8973 |
| engine/v2/src/asset.mjs | 6393 | 86c5d75894a2007c60f7966b365e4d59009228763797636dd6ccf243afc377ce |
| engine/v2/src/binding-words.mjs | 3114 | feab1402e0a316f51bad975913fdc27ac271ce145e6ea92449a9d5af72630b85 |
| engine/v2/src/capabilities/all.mjs | 203 | 41a697965c3fd3ccae0edbc2bdbd065d4199f83b94b71ff0d9b26bd28fc8a2e8 |
| engine/v2/src/capabilities.mjs | 29424 | d5a62ef78966544e464f1a65a5720228ff4449bc2a0eb95eb34b6aaa0b93433a |
| engine/v2/src/drawing.mjs | 104743 | d23661863da5ac6fe1c618b66a9bc6c907ef963b90f0c0506f56543c7a41c21c |
| engine/v2/src/ends.mjs | 645 | 96e75ddc72c85bd4cd252af2365d0bde43aa3f9993e2021d0dfac5d92971a9aa |
| engine/v2/src/entry-key.mjs | 1057 | 56df11392043381170e759fe4934a9892791ca91b234e45e3bc0d0228659c423 |
| engine/v2/src/fit.mjs | 10535 | 29ae88fb9da3964675aab0d86cefc9a5a924ee6d881b5693b61e28de1f245a07 |
| engine/v2/src/formula.mjs | 28501 | 98dcc55b260b7504fb9ad2a2d32c80f0d3e5145c851e8b388fd88d9d9800b42d |
| engine/v2/src/grants-asked.mjs | 2609 | 5785a22bd99c5f6fc0ec88ddf094eeea78025685a1f4e049abeaef87c7bd2890 |
| engine/v2/src/host-profile.mjs | 13761 | 091577b0de500b79090f204fe18852f98a7d3144550bfb72fc474a2dfec000f8 |
| engine/v2/src/host.mjs | 21389 | 9ff03da5d3982a445777a67c247d02e1fbb7cf294400babd4389911a20f1641e |
| engine/v2/src/kit.mjs | 21657 | 08cfbcb10a91fb5a2ee6a892bd9b71f9525734350f9305a326c4f2651d256bab |
| engine/v2/src/ladder.mjs | 7772 | 128bec1fa138d48c1813ecc532fc6ba3f2942c782f63f17afb97e5e8fa709785 |
| engine/v2/src/layout.mjs | 13801 | 8e3b5fd79b8f5c97297e7390391d77ddf0e97237f617932e3473942b113fdf17 |
| engine/v2/src/limits-runtime.mjs | 23598 | f79f14c5c98a05560d31bd2d0fac7070b45a471de07a12e5c5c6d14611914c3b |
| engine/v2/src/limits.mjs | 5493 | 9e137be62d457b094b01a83b781fcc2774b1f4494051f7b04f5ee7eff007d78c |
| engine/v2/src/load.mjs | 15829 | ecf0f10a3424c5536c7f6fccefbba5571fd103c3d5477fddc533465637035e29 |
| engine/v2/src/marks.mjs | 1581 | d8c2c2fcc8069049b5fd9c6498de7fc973362c4868c834d5afb051c9ae04ce9c |
| engine/v2/src/members.mjs | 3840 | 34c2e80a10c54ad6b9af7d96a2e7f030be69ef8cb7f6e1823d97a1e830dceea0 |
| engine/v2/src/mixer.mjs | 5499 | c529fcff7b5c3d7ddad323ea0d25225ff73683b22dc23d925995d8b9402637b6 |
| engine/v2/src/modules.mjs | 11627 | 02df94808bf080beb6f2c94fdafabbc7e1111ba6080d4b0a027f95b5553a932c |
| engine/v2/src/paint-channels.mjs | 1805 | 0bcddbda3f201522341f9f08529ed0d302cf0575b035e9242a61b432a3b57635 |
| engine/v2/src/physics.mjs | 3190 | df28cd9cdb9b2256281a20147bb869546d31d8efecf8e9b0def3fbf5fb1b8a73 |
| engine/v2/src/plan.mjs | 27283 | d1b7b4a1da53797de58b9ae9ece040ddd2e37a63e0eedf9dba19bb1cc0e239f1 |
| engine/v2/src/read.mjs | 14793 | d8b364ee0cbbcd1c517d2b8edd728dea0dccd092c82ed752f053e92468710428 |
| engine/v2/src/route.mjs | 6536 | f285f6e808744fbb0eb397c5030e08e31bbe2213ca4c237a46ae3e4a758b461a |
| engine/v2/src/runtime.mjs | 118555 | d4866d29aba8e4b078fe240ef481e48b1c9d152d571ddd9bd32e65cc600a4e76 |
| engine/v2/src/storage.mjs | 6226 | e32447e262b969199c73a39aca397df1a797031a5a6c6cbe70a4c2ae9d7fd610 |
| engine/v2/src/story.mjs | 18711 | 64051347947246205339dba0a7fe6f927e841efb750823f0610ba23eeefb9a25 |
| engine/v2/src/tiers.mjs | 7982 | 5e9f34ea49953b6fde3570a930bfc68f901f4ec0941df5bc6c2d7018a4004cb2 |
| engine/v2/src/widgets-of.mjs | 1119 | e62c164e20fa9483c96429aa342e3d9c0e088f3799be0e27c82d11f49674cd2c |
| engine/v2/src/words.mjs | 2399 | f7a42434684597109728c93c3c1616d258a3ec1cd6c2d712440a1cd11dbdaf3d |
| engine/v2/tests/a1-check.test.mjs | 4198 | d67bda40b043894a33041dfcc002bd6f0de52f45cb294657e095fd19e6572c08 |
| engine/v2/tests/a1-fit.test.mjs | 15204 | d45853f92c494ee0da8fa2c5ce0005e0d474e75b473c4898bd41a415c3b51e28 |
| engine/v2/tests/a1-plan.test.mjs | 11420 | e0198f907796055089bdbc570c82dab0aefa5dfa8ed5cbee026af97d5bf2a64e |
| engine/v2/tests/a2-audio-web.test.mjs | 9455 | 8298e33724e4b6dc5295e698d6acc8022acdb8c245bfa4bd7cea20c6998e243d |
| engine/v2/tests/a2-check-tiers.test.mjs | 3113 | 9c51cde54048c6e797d9e654ea122b6515e342ecb9e25d3e5a8cc939f9682ac3 |
| engine/v2/tests/a2-ladder.test.mjs | 9699 | f550a94cfa80c9197d5eacd96cfc4a98d6196b15e297474b00e32d1d7270018e |
| engine/v2/tests/a2-sound-length.test.mjs | 4994 | 418165ccf5b385b78fa9a63bff99f2db0b5c88424d0eae06de54f7e1f320675e |
| engine/v2/tests/a2-sound-pause.test.mjs | 3006 | 29a0f9d53e72e2bb597544c9720cf9c372d1cd079a9e4f394310796b2ab21cab |
| engine/v2/tests/a2-tiers-drawing.test.mjs | 4239 | f57a0c014d51620c7626987ea84f5c34dae60e7492f211bc18d5be36916e721e |
| engine/v2/tests/ai-check.test.mjs | 8140 | b50be18145174971d582275912517f3d32f1ad84111d2608288d9c394e20ad63 |
| engine/v2/tests/ai-engine.test.mjs | 11809 | 4921eb9ef4c7bc9f5a99108145d8cfc475f1827d6bd2408019533e87162fb1ba |
| engine/v2/tests/ai-fixture/experience.json | 2630 | 4226b90096f7d63dbcd715161cd1c3a436e3b6c290d467348e80f500c2714bf6 |
| engine/v2/tests/ai-fixture/make-words.mjs | 2939 | 3519ed1f4605cd1dbba67e524106ef405de76e9c2e9663e7758a41ce2b12164d |
| engine/v2/tests/ai-fixture/scenes/desk/desk.svg | 403 | e40123938cb9478bceb3fdc19c2a081f57881352ce0bd0ef8e08210e8453fa33 |
| engine/v2/tests/ai-fixture/scenes/desk/scene.json | 1724 | eecea84f84cb2a31bff8ce3ffb86471e27df8f47a95f6824747ba0e8c68037ce |
| engine/v2/tests/ai-fixture/shell/frame.json | 581 | b88071a4d409093e011c95f6a1dc728312a13da775ab1202149cbbb44459e322 |
| engine/v2/tests/ai-fixture/shell/frame.svg | 446 | 61c926fbd9dcd2b4337bb6a1e344c6bd6a53250f439b0cbc7f0827fabb1d191b |
| engine/v2/tests/b1a-format.test.mjs | 11379 | 5e08d31afc749bb8bb525a14b92bd6bfefb770c2913170c591d2add5b19b10e6 |
| engine/v2/tests/b1b-door.test.mjs | 23460 | 2a57ca89d0af231ed1ddcc847ddbac6af1e301d04e026cf7d56fd53b17c43112 |
| engine/v2/tests/b1c-authoring.test.mjs | 23205 | cccb07e5d70bd821b42ee460ab0677fb3e0e24f971164884946c529e3a38017a |
| engine/v2/tests/b4-proof.test.mjs | 11477 | 9e8912c934480b0719355477f7c9f8b65358bac5fcbfe3342dc111bd1b9eb3c5 |
| engine/v2/tests/b4a-access.test.mjs | 6464 | 55af818cd6c7484ed46305fb37eae4e91c46006ea2ba828253d6542de46e5553 |
| engine/v2/tests/b4b-engine.test.mjs | 18868 | e173578bb1e223b36fd5d2e64e98792551ae09da7fbcc90e42edb81baf26c016 |
| engine/v2/tests/b4c-motion.test.mjs | 15218 | 9f91af668a3e88bab7f696a30daca7558992b340eddb395f0d113830931d2a70 |
| engine/v2/tests/bench/frames-bench.mjs | 2967 | acdeeee4bb9951c3236122915681c0e9798286237dcc3f9738c61a3f3a07ab3c |
| engine/v2/tests/bench/speed-browser.mjs | 3457 | 8b16cba3c6c1f7e4d260974ee425595a3a95f5f6079dd521a6a5b0647782262b |
| engine/v2/tests/browser/ai-browser.mjs | 5870 | bdaed85438516031a4e1ae7cdf8765538b8b6228d1d9cb0ab91698680db99ac2 |
| engine/v2/tests/browser/b4a-access-browser.mjs | 10001 | b44d990e82b3ed2f8d754037d063eedad9197d18fdb955e9dd71be92f32a0aac |
| engine/v2/tests/browser/b4a-fixture/files.mjs | 3597 | 0f47f34da6cf2d8d13892949bbe9d635ebbed34cf339dc556c57e5991b138cf7 |
| engine/v2/tests/browser/b4b-browser.mjs | 3519 | c068a06efd5bc7ef1b0c8cf66f4dd3750b3226b0b8448453d8667fc095fdded2 |
| engine/v2/tests/browser/b4b-fixture/files.mjs | 2882 | 9c5d55813e962d4358f7b6e7a79a824617ec0ee8b263fd4ab26b4fc1941158d7 |
| engine/v2/tests/browser/b4c-motion-browser.mjs | 7949 | d30251154a9b420d7665c6c4c91217605e18c25378827e8d63d7d106d928593c |
| engine/v2/tests/browser/baked-browser.mjs | 3320 | 7cc99846a9549cc1d57b26d5b9967bd924825641477ffef22aafe72a97671501 |
| engine/v2/tests/browser/drawing-browser.mjs | 17526 | d7939f7786da6fd9228392c7b202b426f90d49022ba55d07ddf697fda2e17876 |
| engine/v2/tests/browser/drawing-fixture/files.mjs | 7761 | f2ef462edac9cf714d84def2a204b43053ef476231bc64a0929edc8b5a5d7c9e |
| engine/v2/tests/browser/e1-controls-browser.mjs | 33425 | d6daa158bbe8355e89e914f9859e2a864089e0137ada3434abf9d286153f2be9 |
| engine/v2/tests/browser/e2-pointer-browser.mjs | 11520 | 190fa8ac86b2ad6d4a2acab86cc2449a6b19e43772917c20c836b29dcf5e4c19 |
| engine/v2/tests/browser/e3-dialog-browser.mjs | 7383 | 9a6ecd8f1728530b1b276a9288e329eed6c8b1448e19cb6a0228853d28e5a60d |
| engine/v2/tests/browser/e3-dialog-fixture/files.mjs | 3202 | 7531bbfd631b3968b2bce17f6deeb5f480036fb1c6b0afbf3a211716e879dfff |
| engine/v2/tests/browser/f1a-openurl-browser.mjs | 6215 | 738e38fd2ea3edfe10319e6b7f8d51fd928be64f424c43e9b9d4d5f83ce84bad |
| engine/v2/tests/browser/f1a-quiz-focus-browser.mjs | 3535 | 0bce91d23c25a55b83ae0b354981b7d4c82595d648d6c432740364373af55185 |
| engine/v2/tests/browser/f1b-tint-browser.mjs | 3769 | 009cb57843adb71f1d547f227c834dccafac0844e3cecb67af937444712a2834 |
| engine/v2/tests/browser/f1c-browser.mjs | 6877 | 24bc98cbe0b194091e81a3fc6c8d865d2b8e44c87e6d627e4fcc44b7ccd53ce6 |
| engine/v2/tests/browser/f2-slider-browser.mjs | 12137 | 19f4528cf6ebbff87662d3c9a6557633dc575f66c8f24366147a211ec3e046dc |
| engine/v2/tests/browser/fault-browser.mjs | 7502 | 94704b3e229a1a12305098e5a1b8d70ed71e877a4c46429f135bff903b07009b |
| engine/v2/tests/browser/fault-fixture/files.mjs | 2087 | 330658f5baf9b915c845770913a4d4bc6bf8dbd9886da6c8228843ddd72cfda2 |
| engine/v2/tests/browser/fault-fixture/missing.mjs | 4961 | 45691bf74911d42ea5376925a466ac7b9112884e0436334047157a0d54d0a789 |
| engine/v2/tests/browser/fit-browser.mjs | 9595 | eabd90e81bb028b4df6ae6aee4f9b3e09479bae2edde35a592e7e91a8570d821 |
| engine/v2/tests/browser/fit-fixture/files.mjs | 4023 | 8dd9d2ac12ee4a4caf2de02744c7941b8379fef769f60588b240925f55e2ef0e |
| engine/v2/tests/browser/frame-link-browser.mjs | 7603 | c859f3f7befc71c7eaebe7d4691195269599f3a728f604b6f099888b6eed6913 |
| engine/v2/tests/browser/frame-link-fixture/experience.json | 738 | b1cf6c35d61ea84f1a8229737677edc69692ea2a35428f787963f2215b5da466 |
| engine/v2/tests/browser/frame-link-fixture/scenes/hello/hello.svg | 1038 | 3fe7ede2ebdf74070b052e7d53935e01c91c80bdac1b13b5df06d64edba6c59b |
| engine/v2/tests/browser/frame-link-fixture/scenes/hello/scene.json | 995 | 66ede06bce937e06b0b9306354b533fff8e4c0d5168e4e6206b04367f55f8abb |
| engine/v2/tests/browser/host-outputs-browser.mjs | 4373 | 4c9030ea32397abb3feb8720e8e46b8878c90d4e207f132b16b4be59769934e7 |
| engine/v2/tests/browser/input-browser.mjs | 16432 | bad429be8d7875b0222a6b90758f84da3618b495ef548e4d91a1a0a65253b030 |
| engine/v2/tests/browser/input-fixture/files.mjs | 4972 | 172468bde930cff8a6d4ec765f887f599f78d881f42904727603dba3fa989097 |
| engine/v2/tests/browser/joins-browser.mjs | 10791 | 7be84a597d80a973aacecec019851b00529d3144a30839c584f6bae65c8c4e15 |
| engine/v2/tests/browser/k1-dial-browser.mjs | 21441 | 102d10ff2b2dbc6188bbb6d758e59b2e156cb25ebf6458e0bd809f964b465aa2 |
| engine/v2/tests/browser/k2b-marks-browser.mjs | 4899 | c84b53c1d1fed88d495c896843d74434833cfa66c8c6346a83163545002dbc30 |
| engine/v2/tests/browser/k2d-doors-browser.mjs | 9520 | 5484349fecb2ef593120e034489816c0dbcaf478c12a7224ade8a55f6a8914ae |
| engine/v2/tests/browser/k2f-asset-browser.mjs | 19407 | ad4ad4efe2e1afabd5d965ce5e284c099692d3620026810ad993f2f96b7d93dd |
| engine/v2/tests/browser/k2g-hooks-browser.mjs | 6962 | f56486e9340d21b69b327c3fe41fa387a84efba08d0dfd7c0032739fe48ccbf6 |
| engine/v2/tests/browser/k2g-polish-browser.mjs | 4900 | c9046e292d4873b0d24c8f189ceaddccd07781da33658314814af57da750e095 |
| engine/v2/tests/browser/k2g-sound-browser.mjs | 5682 | daee260b6519c76a4a102e99271a5445ae4b03cf103259c092d91d11b644936d |
| engine/v2/tests/browser/k2h-test-browser.mjs | 6033 | 90d26116a26c675e58e0d4fc326281256ea62afc9bded582d6121be32810ad79 |
| engine/v2/tests/browser/kit-ads-browser.mjs | 8068 | 93a0421ec114feba62559b0ca3b791be986e7aeb244ba38bc85dd61e48fe6e0e |
| engine/v2/tests/browser/ladder-browser.mjs | 8705 | 4356c72a63dae022e91b9149d955b63afcf1b23ccda40d708d41a729175f1ddb |
| engine/v2/tests/browser/layout-browser.mjs | 6097 | cf2a01dacc858a45026945529f7d7504d588cfaaf25dfe3e01695da27b1bcde5 |
| engine/v2/tests/browser/lines-browser.mjs | 10115 | 45b825182bc7a4540637ef0d923d5db1b25359df4b330445d6c0a134032036d6 |
| engine/v2/tests/browser/motion-browser.mjs | 15214 | df0372338f509329ee9bc8d8dd137a94bc67548287388f4dc4327effa2b4e99e |
| engine/v2/tests/browser/motion-fixture/files.mjs | 5520 | 57912f9661c2378fca918e985d9a279486e827ee4a6254a06308e76cbc33257e |
| engine/v2/tests/browser/mount-browser.mjs | 8159 | d4ce352a1536eb3f0eda11145a0b2eb4fc867fa57199fe7d2f7eaec405b1a82e |
| engine/v2/tests/browser/plan-browser.mjs | 8939 | fa12eb79c3ae555376e408a06cde54e6153a54b95e8e70aba6e52a3282662c6e |
| engine/v2/tests/browser/preview-browser.mjs | 7801 | 8c6ac4f38fd423a231d4f385da6638a6c428ce8f4677eacca6bef561e32338b8 |
| engine/v2/tests/browser/q1-player-browser.mjs | 11136 | 1470042e69d112465988dfdc52737c5fd39a5303801d359d7c30f4070bc60d8c |
| engine/v2/tests/browser/richtext-browser.mjs | 11052 | b02936b4a211a2a3c05da8505494538f01ee68016225d723ae81ee39956a83bc |
| engine/v2/tests/browser/shell-browser.mjs | 7812 | 0e2240ab976a70e17dc223f91f03d25dc7ff0503ce378f5d98a95ad704d98670 |
| engine/v2/tests/browser/shell-fixture/files.mjs | 3809 | 2e0adbc1eded5ba6e2fe3db1ce3c38573c6e3e769f01cc37763406d0730f0d52 |
| engine/v2/tests/browser/stage-browser.mjs | 9189 | ed1d0dd5a5067c4dcb3ada2a22cc7f48c83a89c70e74105b4b98134d2f9e7a57 |
| engine/v2/tests/browser/stage-fixture/files.mjs | 7020 | 488454ef9f2a43dc762f960177bf1355f354e9a120ea129ff1366e8a9c8499a5 |
| engine/v2/tests/browser/t1-test-browser.mjs | 4292 | 8a678e0c56b8c6262aab26a9d0f1e593bbce4a9c081703176a474d3c2d8313e4 |
| engine/v2/tests/browser/w9e4-press-browser.mjs | 7375 | 7328332d42371ec26036462e994e9972b8971b78d44a4f32365480b204c9f0fb |
| engine/v2/tests/browser/w9e6-touch-browser.mjs | 7985 | 05495c03a10b3af77289eb6e010e4f29aa39137f41b1bd8cbb0567064ba08610 |
| engine/v2/tests/browser/x1-browser.mjs | 3634 | fa45dd7281616b5be6e6a0dc17860cf955f2d2971917522e86e4ccfddf7b8dff |
| engine/v2/tests/browser/x2-paint-browser.mjs | 6018 | cd63b0008dc1b8714ba3cea7e8777b7de54add4a993e8343bf4eadc7270a3c16 |
| engine/v2/tests/browser/x3-browser.mjs | 6193 | c6298b3c6b781fa8f1403af04336f7811c3507df05c8888125cb542575cc54ac |
| engine/v2/tests/browser/x3-fixture/files.mjs | 1391 | c6269272f9b6797014ca14176391adec63ca56afd0655a08f2be39118b8d8ef8 |
| engine/v2/tests/browser/x6-addons-browser.mjs | 6046 | 01dfb95aff61e670d12310acf3aef01a8e049ef14d8235e2c6deffd888f52c8d |
| engine/v2/tests/browser/x7a-library-browser.mjs | 4673 | b8b07a1246eef0a558d3b28d62cc54c7d8163ccd9ffde0fe4856e36b9730ffd9 |
| engine/v2/tests/change-fixture/experience.json | 1407 | ee79db60bf1ba0ba53baa33f4f0ff9cabeb53558116bcc52b3c275f7793c51a2 |
| engine/v2/tests/change-fixture/scenes/one/one.svg | 340 | e14f766d447e4bdfab671b84a1d4787eb5806e7d6ad84d092c9df483384e337b |
| engine/v2/tests/change-fixture/scenes/one/scene.json | 164 | cf622e6570df53c2c19fda1244a17951cf942cd5f4059765582044c23ee7d1d3 |
| engine/v2/tests/check-budgets.test.mjs | 4645 | 370b77b402d4065c1c999134ccdb7188899c37e638de88cd0339512cde3ceebc |
| engine/v2/tests/check-coverage.test.mjs | 2780 | d9756fee794d9a606fb8d89d958b439f2e727d27dd063e35799467ad48e16bf4 |
| engine/v2/tests/check-files-codes.test.mjs | 11865 | 059f0373e0f0a2d35dc2bd344937d8c27904fd80925d93343930030b54c715d1 |
| engine/v2/tests/check-formula.test.mjs | 24901 | c3770f8df748da873567e862ecadf3a58f4da0bba00d209fab39d8e0db5bfcc3 |
| engine/v2/tests/check-refs.test.mjs | 14978 | 29839a0f694726ccc32f4dc5afaf2128de16032c2c8c8b9851415f4836b07afa |
| engine/v2/tests/check-rules.test.mjs | 15178 | 722bc1acc21ed393a26061471fdacdb937e2a8716fd0ea3571c6b40bd1f2a4fc |
| engine/v2/tests/check-story.test.mjs | 17806 | dfb3b0eb321a3e3a9ea560d1d0cc4d41295773785ddcc2225d05befbd513e587 |
| engine/v2/tests/check-w4k.test.mjs | 21397 | 851afb71736a00212c24ad3c705d55f02c09ac9e4142cb26a2dc7f898c4b4aa8 |
| engine/v2/tests/d1-fixture/files.mjs | 3914 | 5361a142dd43e4e9b377e11bb8fc3dd0656c920e23460e3e6000cf0ec983a845 |
| engine/v2/tests/e1-controls.test.mjs | 3753 | 80d18c187d809f73ece3345decfad79a54d1966bb6b401cdf24c581d245e127b |
| engine/v2/tests/e1-fixes.test.mjs | 9699 | 5c3a8fbb80a93a6a9434402980c187678b9703a45c766a31ea345a94ccf77abf |
| engine/v2/tests/e1-fixture/experience.json | 278 | a2b5fe65ab8fe8c18205405c87c18abbb9a9a9c35cb8a5411964ad1c72189db0 |
| engine/v2/tests/e1-fixture/scenes/s/s.svg | 3246 | fe9a2660eaca2556eb02912b89fd1cff669c9260d325b1d7dbc32434a4d814fe |
| engine/v2/tests/e1-fixture/scenes/s/scene.json | 2669 | 360ec0f5e093efa270076dfe4dff0a1f2d8cd0f96ec780690a921fc30e2d010d |
| engine/v2/tests/e2-fixture/experience.json | 465 | 9f3e470b30f67455a76ac1e294cb65b99af8947ab32495bc696a0e1cb7ae6ba7 |
| engine/v2/tests/e2-fixture/scenes/one/one.svg | 1825 | 187c6d630bea17f0ea138c38c62ee5707ce791564128592415dacf6a14dd7924 |
| engine/v2/tests/e2-fixture/scenes/one/scene.json | 1318 | 68c56b05561ae66224168d0c5428bb57104d684fc4d4a3c449d28081db0c940b |
| engine/v2/tests/e2-fixture/scenes/two/scene.json | 189 | 52d985dd9eb7020a0b73db414d1e37f951f9cb0846915d8f90c77b37078134f8 |
| engine/v2/tests/e2-fixture/scenes/two/two.svg | 595 | ae1dabfaddee8e88a71d9e09ba55b2c7d9315e23398a3830f3c9be98a47a712c |
| engine/v2/tests/e2-joins.test.mjs | 21857 | 888f7cfd0f23d5840a5e3ecd8bf2ee049dc842322d1b156676a9f37cbe9eec1c |
| engine/v2/tests/e2-label.test.mjs | 2930 | 92bf3fbd1e6b6137b96d64234f887ae57b4cfd03c79a5a5e886b0e4cbb0c7ffd |
| engine/v2/tests/e2-text.test.mjs | 3893 | 978ed95eb5442cb877a19d45388c62972575af18866d0bad5e5da9e4967fe511 |
| engine/v2/tests/e3-dialog.test.mjs | 1977 | 47a7b384cbc2e58ecb25bb5c50d3118e6b1ad664abced0141f06634d31cb5549 |
| engine/v2/tests/e3-lean.test.mjs | 19082 | 16c7a9e33dad9881fe3d3062244245353f45a0aff82cae415015448a4bf8321e |
| engine/v2/tests/e4-joins.test.mjs | 28623 | 5d60455e420c0110fdc0578173630629f47f22a8acdb58dea5aefb280de98093 |
| engine/v2/tests/e5-freeze.test.mjs | 21971 | 35786d034722b08a63c30d29693899ad79c77342ee1b1148e60dca682dcc61f3 |
| engine/v2/tests/f1a-fixture/lanes/experience.json | 405 | c0042cf74fa84f41e9b1b8d821e6c897627ff7e275985f55729af526318b1f1f |
| engine/v2/tests/f1a-fixture/lanes/scenes/orchard/orchard.svg | 1422 | bdc5e3b3bc196ad4a58164967f7d7049ff2935f7f04ae02db8d5e49d7e49a205 |
| engine/v2/tests/f1a-fixture/lanes/scenes/orchard/scene.json | 1545 | 0016be4eb6f1a1fe3663f95beaa6eab5d7ea801051cf6e7d2874d2d77392256c |
| engine/v2/tests/f1a-fixture/lanes/scenes/result/result.svg | 574 | c035a0e78da8589188ee87b0cb52e552dffe51be1469fb569b08144e83785a9e |
| engine/v2/tests/f1a-fixture/lanes/scenes/result/scene.json | 201 | dbc7e14cf1c4a151eff62d48e57e08fe8b69fba5c793925dcba9d2236467846a |
| engine/v2/tests/f1a-newcomer.test.mjs | 8310 | ba2724c73463af086e2b7cf0bdaae58f6f643ac7a7fed8aa98f008c5cec857e3 |
| engine/v2/tests/f1b-door2.test.mjs | 9888 | 00244295ba3d1ceeeb5ba9fd66a1722dbe5c14ec66434cc69962f7854cc2ea81 |
| engine/v2/tests/f1c-security.test.mjs | 22880 | 7f0fb729e096804aad104f68bbbe2cfaaf88ca30df9f2922d76bbb9ff22cc401 |
| engine/v2/tests/follow.test.mjs | 2197 | 7858629e186cff3c0b06a2cd39d8c629d150924ae4230e99884e4e0ca8af008a |
| engine/v2/tests/helpers.mjs | 1983 | 46ea7ac6835d3fb8b33a9415e15a11f678dc08c04af720d111593ba8c5415eda |
| engine/v2/tests/host-fixture/experience.json | 621 | 38de742769534b3a2fb5c074ca23fe5128a7b08e4303e1076a2a4b3cda16e000 |
| engine/v2/tests/host-fixture/scenes/one/one.svg | 340 | e14f766d447e4bdfab671b84a1d4787eb5806e7d6ad84d092c9df483384e337b |
| engine/v2/tests/host-fixture/scenes/one/scene.json | 455 | 2332e4cab3d8a41cd599f94ec0b755407c6e74e01e3513589e7aa6ec36b733ba |
| engine/v2/tests/host-profile.test.mjs | 10673 | c6f0217239493bb468d00fc672576ab2c3ecb99e617246379d3cd893f811de2b |
| engine/v2/tests/k1-dial.test.mjs | 16534 | 8e81d734a5bf14f6e3d170cdf2f4d727f33d5c2c6119366b4f615f31fcc8afaf |
| engine/v2/tests/k1-fixture/components/knob/component.json | 1378 | 2ed2662a88c89e96f6d70f244e268ef0697f8840d4c9f06a1b7e13a473a8b0b2 |
| engine/v2/tests/k1-fixture/components/knob/knob.svg | 796 | 8e7035307c96464e4cc196b55ad009501ac23741933b13a99f1e05cbbd7df075 |
| engine/v2/tests/k1-fixture/components/level/component.json | 1142 | 6463a1d85e7ca5b1c1ec58e263685597c803f07db152ad9e9f5417e6a02ad628 |
| engine/v2/tests/k1-fixture/components/level/level.svg | 534 | baed9ad0e965db8b53ea638fc0963afaf8f2e8d6bafae06757b158562fc00d40 |
| engine/v2/tests/k1-fixture/experience.json | 411 | 736dd1e623d0ea4ec81623176561a61e2d41f4bd22626eec731b1c3ff14625fd |
| engine/v2/tests/k1-fixture/scenes/s/s.svg | 1202 | 3db3fc27fa8e3ca80b79220576eac6dd77a927837610acc7962471a19b8f3a8d |
| engine/v2/tests/k1-fixture/scenes/s/scene.json | 2080 | a0781542fbb0b3694032d158847d7ab1dc216200cc65a9df23acba69bdc01672 |
| engine/v2/tests/k2a-addons.test.mjs | 2863 | f443084baeea0b9689885ba749f146f8ab18cc979e15be2688ab2756234cb923 |
| engine/v2/tests/k2b-fixture/components/bike/bike.svg | 574 | 24415f757474d9f24e0ec3b0bf258eff2d386c8f407f96bc09d0996bb8cfc949 |
| engine/v2/tests/k2b-fixture/components/bike/component.json | 329 | 246fd1f9591b27bb2088fad0643009493c1cf8749605502d9a9203d0cf6bebd8 |
| engine/v2/tests/k2b-fixture/components/parcel/component.json | 95 | be96ec050f103caecc86733f6a88fa1303e6058decaa875e1fbd112737c90b59 |
| engine/v2/tests/k2b-fixture/components/parcel/parcel.svg | 307 | 7b89ec0d4318948499dad52c71cafddf1b8582e0c980cf734d614417cc8dc799 |
| engine/v2/tests/k2b-fixture/experience.json | 594 | 6985871202d8ca1ce5f01ab153537f94a0bcfa9087986cb15cf7810ea4a335d7 |
| engine/v2/tests/k2b-fixture/resources/icons.svg | 497 | 8f4ff88854f97eba52772847904ccdddb3fb51b9fa22dd2ee0a3ec141fd8749c |
| engine/v2/tests/k2b-fixture/scenes/s/s.svg | 1410 | 837ed009d2a6fe67c9711c8e54a4f8660c105ba234f7cf04b5d85a456a233674 |
| engine/v2/tests/k2b-fixture/scenes/s/scene.json | 2484 | 758b66a8e4556efae7818150ae903ac0ea5e4902e2c378602e3a23814250ca32 |
| engine/v2/tests/k2b-marks.test.mjs | 19389 | 5a74dfd34fb94139de4d953491878f4c070bde2f605780519e9328eb752b0eea |
| engine/v2/tests/k2c-words.test.mjs | 3152 | a7072f1f6913094e74a99794494d90d778a9ac7a5c608784d8dbbe3a0b9d756e |
| engine/v2/tests/k2d-doors.test.mjs | 22170 | a0616cc00660c84be077a660ba603fabbf98bf08fae4470587edf215edc8fcce |
| engine/v2/tests/k2e-checker.test.mjs | 10605 | 974bc9a491cedd806cedb186274b1d2ac9c322912aa0c93d7c833e8608706686 |
| engine/v2/tests/k2e-fixture/experience.json | 493 | d6d8a78e9bec37915c6f8afa13eb6cbb736a51e31dbe08be3da744d3dbdbd060 |
| engine/v2/tests/k2e-fixture/scenes/done/done.svg | 10667 | 1396dc48a79a3a5bf52b3cf6a3310a80a5ac2387e54b130b1dbe0e570218738f |
| engine/v2/tests/k2e-fixture/scenes/done/scene.json | 268 | f7004c0ae912c7f47a3486c85d915aa4110e40cfbe65c096123b95cff1af924c |
| engine/v2/tests/k2e-fixture/scenes/sort/scene.json | 4854 | fa1093605e7b1595c87f9216f43023e1da14a2c96f2868b28fcd286832de6b61 |
| engine/v2/tests/k2e-fixture/scenes/sort/sort.svg | 14424 | 2e6580d9978d422fca08d974f56a06462b74d69f6dd6f30dbca463580d5e7cd0 |
| engine/v2/tests/k2f-asset.test.mjs | 12774 | 3c3a4645d1255aee186a3974903a74fab53882873e6576eee5c6d63ba98dfdfd |
| engine/v2/tests/k2f-fixture/experience.json | 811 | b1b9d5d3855bfd4d308a9f2caba19d852c02e5ce19c66161ccd321fcdd2d00d8 |
| engine/v2/tests/k2f-fixture/scenes/lamp/lamp.svg | 1576 | 858a13a46be3fb6fc1a788b5074879eabe05932ca0ba15a2bb84e93f2b98517f |
| engine/v2/tests/k2f-fixture/scenes/lamp/scene.json | 926 | 60d7a79b40cd448075b92452fddf4e53f96454bfb0c5f94792ab83d14a243e47 |
| engine/v2/tests/k2g-polish.test.mjs | 9191 | 215a481e54654841c62e5dd013ff2456f38b2a694eb7e7a9806324c1a61253b1 |
| engine/v2/tests/k2h-admission.test.mjs | 2961 | 1c00fb8e1086c8f4cfdf32e2c6f33bd7192dca5a6034f2cf9adac412b188b597 |
| engine/v2/tests/k2h-isolation.test.mjs | 2738 | f501dd660aedbb7388d92cd7c7cfa846b5f8d227bc069ba12f7e6fb4fee84c7f |
| engine/v2/tests/k2h-polish.test.mjs | 13644 | acff40430220a9908cf600319803470e127cb893dbbc70ce18efc8f22f04560d |
| engine/v2/tests/k2j-newcomer.test.mjs | 5183 | efe7fe615653bb676f32aee450b12f16250ed0b53cdb262f923205726bc075d3 |
| engine/v2/tests/kit-fixture/README.md | 716 | 959781abc9d37188d51d127f42cf8ed34fb91d29817b52e514d656c06e4fdc16 |
| engine/v2/tests/kit-fixture/kits/tale-kit/blocks/badge/badge.svg | 716 | 99e6bf7c66cf1dcb65f682fa09690966f9ed0e7157967728f54c0eede8004ce1 |
| engine/v2/tests/kit-fixture/kits/tale-kit/blocks/badge/component.json | 574 | 663499fcbdb894c61ee69489b7e90748a479fef9383e5f6514fe5c86d85f4dd1 |
| engine/v2/tests/kit-fixture/kits/tale-kit/blocks/button/button.svg | 603 | 522356a06da5609184271a477c344a577f42be0e1e30474fff00788af6a462dc |
| engine/v2/tests/kit-fixture/kits/tale-kit/blocks/button/component.json | 529 | 2f73c8f81b268e24cafaa478af428b3fc1b63477dacf855cf3b6a50e34e85322 |
| engine/v2/tests/kit-fixture/kits/tale-kit/blocks/title/component.json | 362 | b1d6f1bcc82f7d36efa8dffc96917282695c98c81923294348101c45eff46619 |
| engine/v2/tests/kit-fixture/kits/tale-kit/blocks/title/title.svg | 410 | e60ef8aa7b328fc2c0bfae3d7aebd81a3921a3e19f07f16a02a2112bf69be9a4 |
| engine/v2/tests/kit-fixture/kits/tale-kit/kit.json | 1967 | 6263b4e7b0b97a599c90e36dbbc896dbb95f371f159244d272ed74b67a7320b2 |
| engine/v2/tests/kit-fixture/kits/tale-kit/scenes/page/page.svg | 1002 | 5b80803746d8e43c857ee67c330329fbe5b975585cbb2eac46184ee39845f2ee |
| engine/v2/tests/kit-fixture/kits/tale-kit/scenes/page/scene.json | 1812 | 63e274191681277f86446caa2717f3cc33cc8dcd3bfc05073a8a15c9e1657021 |
| engine/v2/tests/kit-fixture/kits/tale-kit/words/en.csv | 27 | 87c3abc0922393d085baade2580fb180f0f3640508ece8d1f838f9265e27abc2 |
| engine/v2/tests/kit-fixture/tales/fox-tale/experience.json | 881 | cdfb53c3a01b31a6ce11442fc7455d6fe35a6952bbad981ada4ae55df9802388 |
| engine/v2/tests/kit-fixture/tales/fox-tale/words/en.csv | 60 | 166270d13ffdce9f3a7d8ff5d9e7fad14a93dd2d48c4258012e079d0c61bb103 |
| engine/v2/tests/l1-lines-check.test.mjs | 4161 | 1bc127c0c576fd901cdad3b676fba2c7223d7aafb966dbe1f8ce4bfa0674d9fc |
| engine/v2/tests/l1-lines.test.mjs | 10970 | fefbf038ec79c491cde76d6be600dda2db249621669aba63233555fb5b854b04 |
| engine/v2/tests/ladder-fixture/experience.json | 1690 | 1110a5e66e4de2fc2218cebbdf712cf6ce8e22509edfb4b4c27d46d1ee618e12 |
| engine/v2/tests/ladder-fixture/scenes/ad/ad-300x250.svg | 1179 | 749d9c2168c1544868c84b4e2a273ca5a1982696bbd2927e6393bcafcd470a03 |
| engine/v2/tests/ladder-fixture/scenes/ad/ad-320x50.svg | 1170 | 10e131fdaeaf97a0833d5f15709723d830e88772a08ddd8b02527b4cd7a175b0 |
| engine/v2/tests/ladder-fixture/scenes/ad/ad-728x90.svg | 1173 | 47966592ae352da28f2a402689f566adebb8bbfc1319c4f90c5a636bb6dfa934 |
| engine/v2/tests/ladder-fixture/scenes/ad/ad-970x250.svg | 1178 | d1184347dd886ad3ff9976c325090488cf9413744c2763b49c26e3e528040f39 |
| engine/v2/tests/ladder-fixture/scenes/ad/scene.json | 1787 | 6a6e43bb9969fc60868e0a8398cad58329af844dd91d7625f9c91114a390b6fa |
| engine/v2/tests/layout-fixture/experience.json | 386 | 5baac47228daa6bbc0d0728d181b812ff43b5fe1aff994a94f41e6d555a0053c |
| engine/v2/tests/layout-fixture/scenes/ad/ad-160x600.svg | 594 | 1fb736c170c781c1ff93525025ebd1f69940c3831b4c94a864c36aa87a169ae3 |
| engine/v2/tests/layout-fixture/scenes/ad/ad-300x250.svg | 594 | cdcd46f1f954b9976b04e85e59d056f6df226f3a9d126bd4761b9d20293ade2d |
| engine/v2/tests/layout-fixture/scenes/ad/ad-320x50.svg | 588 | b5c83256cfb738117d10a14c2e181355986732805c40f4d29b4f975c2d2bc28f |
| engine/v2/tests/layout-fixture/scenes/ad/ad-728x90.svg | 590 | 8657beee1e2de2ac455a5f1bc9c7dd62ea5061b2f17f3992d3946ac8cf4452a7 |
| engine/v2/tests/layout-fixture/scenes/ad/scene.json | 789 | f5a504925dd07ec0b7a072d9121704e31054fad9cefe1256678b44a6fa6f3211 |
| engine/v2/tests/limits-runtime.test.mjs | 14510 | b22724ddcfbcc0b2300827a521941ecd4b62e1334e13f68859951e3bd9c0bf6b |
| engine/v2/tests/limits.test.mjs | 8404 | bfa56fb3c10af27eb3c76f590ced37c9d133ea7afd4ef61168d24ac7d3182c2a |
| engine/v2/tests/lines-fixture/components/parrot/component.json | 4416 | 49683370c57571e9bf3b677118b49da4acecc93bb1bd518ebf8ceff88dd60bae |
| engine/v2/tests/lines-fixture/components/parrot/hello-en.wav | 9644 | 2f2bd27c2b0521924bd67aa6e8f0c013ddc20fbf3b0280a558973a0eb04f460f |
| engine/v2/tests/lines-fixture/components/parrot/parrot.svg | 701 | 4ece13cdb271846cbc7886da1115e928864297e423516a33cfe0803af0008aa4 |
| engine/v2/tests/lines-fixture/experience.json | 675 | ca309a2536674b35c1049158f078170540fe9ba287b7f694ba9fcd5f8085fe60 |
| engine/v2/tests/lines-fixture/make-tone.mjs | 1567 | 1f1a56d7769669e44c41a515494ee929775390e27d245df7432fabe5ebf6d2cc |
| engine/v2/tests/lines-fixture/scenes/talk/scene.json | 1108 | 3d13d956e83e3601ba1efea767d6092a6fde406f8dafe0b052363f11be3830d9 |
| engine/v2/tests/lines-fixture/scenes/talk/talk.svg | 666 | 520ad917b5357495b48c39f56f21d0e0eb52af704407d83d0b4dbafef6133fc7 |
| engine/v2/tests/lines-fixture/words/en.csv | 55 | ae786dc2d66ece04c8e803e199e0a3b927e88f97c7d4c3225323b67b176057ed |
| engine/v2/tests/lines-fixture/words/es.csv | 54 | b332ec4c91bf4c8a33709f4720a55948117576684376625817802fed8727252e |
| engine/v2/tests/p2-focus-ring.test.mjs | 3855 | 1c5a7628a3e26bfaaf2767495fd6e8af7d34a8e8304e9309e4f25966bddffa11 |
| engine/v2/tests/pack-fixture/experience.json | 441 | cac91602095409245b6c8b7f5ea388a46579cecab631bf5bfcf78dba52d322c3 |
| engine/v2/tests/pack-fixture/scenes/one/one.svg | 319 | 557148106ef1abc9255092a3e141a5a38e2740fe6fb6e6d969fffabdc0d351f8 |
| engine/v2/tests/pack-fixture/scenes/one/scene.json | 361 | 9ad97ac4535339130f2f073412b4686d84754288b6a7fb3a49125182842ab8d6 |
| engine/v2/tests/pack-fixture/sounds/blip.ogg | 50 | 3f587973d13bfc179d6f340735fdb90abba763b3faf3658aa9e3abc05cc911d3 |
| engine/v2/tests/pack.test.mjs | 5243 | 79da684a6eb621428e7a16d040a17c093034c452874b9f7093d4bbe75ed829ef |
| engine/v2/tests/plan-fixture/components/offer/component.json | 1534 | 1c354d93049f2f48bcf5f7fdf4050f1a515196ae4977313cf51c19ab766c8725 |
| engine/v2/tests/plan-fixture/components/offer/offer.svg | 676 | 4bae54212fe44d8dd6c0a5a426513e42095ae5e3b53ceaaadcebb7bb2aecfe9c |
| engine/v2/tests/plan-fixture/components/photo/component.json | 134 | 2e3f613af59ebd0b1c66566606b214decb13181f3df8cef3ebcdcbe965a17054 |
| engine/v2/tests/plan-fixture/components/photo/photo.svg | 357 | 2ff390f18bb1d0204b01e8c9c05c8ddb77a871bb99a89bf0b6007226aa3c54cb |
| engine/v2/tests/plan-fixture/experience.json | 536 | b9356a491768cb14196b574f180deb35475e27ae744a697bc80a495123a112e0 |
| engine/v2/tests/plan-fixture/scenes/ad/ad.svg | 469 | 93b5700109d957db68d6a486ca9adfd4fa5f906ae3ca80a114f33a92b894e20b |
| engine/v2/tests/plan-fixture/scenes/ad/scene.json | 395 | 3bac6ad753fdf7e12c980174fb4ef794b9baa30eb9444e5f6b6dc88626abcb8f |
| engine/v2/tests/q1-plan-fitbox.test.mjs | 5223 | 3e18c2fe8d58fe31535c01c02f4b02d364e0ac70a38c0ab8d59b33e0697cee8a |
| engine/v2/tests/q1-player.test.mjs | 4628 | e3bdf9ddd32b6a27e8b7d76b36b0c1415969b7cd4e93b2e297c09f1a77bfb36d |
| engine/v2/tests/r1-richtext-check.test.mjs | 4816 | de1063635b85743a56e1404d8ad932fa8b6d272bdd1c69c243051c23cdb98b3a |
| engine/v2/tests/r1-richtext.test.mjs | 12918 | c6b546fc3d3dc29cd5596408ccad5901b14fa81792c7eef29e09a92e73eba5ee |
| engine/v2/tests/richtext-fixture/files.mjs | 7356 | c9d22be041ff0f687ceb98736afaad772ab3343a5c3f1e3aea53c1336a732c1e |
| engine/v2/tests/rio-r1.test.mjs | 4674 | b40dccbfed3edcd5afd9ff3ab1a39e7b52a771ac2be95c43695c56f34e4aaccf |
| engine/v2/tests/run.mjs | 1803 | a6ba5aa5f1459e86352f797bef5859395dcbb3dc982f1282143e4df9d2e9df31 |
| engine/v2/tests/s1-check.test.mjs | 10340 | aadcaadaa17377105736676d11453384c3cc4b5b3312b077a1befc62fa2a01c9 |
| engine/v2/tests/skill-refs.test.mjs | 756 | 2052565cd1f6716853518c06528d92f221c4c0c7e5bb685c3119613eed4e3ee6 |
| engine/v2/tests/skill.test.mjs | 1485 | a2d3f4a8e1927bd12cb1bd16e42e68f0b7246b44f5337d489707b942c7b67cff |
| engine/v2/tests/stage1-load.test.mjs | 3539 | 6fe814a4cb9dc5cd609fc91228838c62a2d4ad27a1c3e04e70338d571c8c997c |
| engine/v2/tests/stage2-core.test.mjs | 9677 | df97a5f577d19cc4ff6b8cbb967c78756ef6fe4f923b0885bad6e46bf933c25c |
| engine/v2/tests/stage2-formula.test.mjs | 3594 | af988f56ceb17ea132d5b713155a24dfc675f6009602d14a736c40485a157a4a |
| engine/v2/tests/stage3-story.test.mjs | 7116 | 603a17ea6b699b24a249a39e5e9f38eec54b0ae00d6fd5f50dfd296121a2c48a |
| engine/v2/tests/stage4-drawing.test.mjs | 5354 | b7a999a4da3fbaf67cedf4e6038111b125f3d5e2f7a7eec8eef349ce62e74f72 |
| engine/v2/tests/stage5-physics.test.mjs | 8262 | 00077c2b2eec0453421f70baa06b3edd46ffb7cfae9fce7df090349d779a2c9a |
| engine/v2/tests/stage5-snapshot.test.mjs | 3081 | d926a4feb2a74f46469ca5f33b81eb16de1e92075fc158607f4fce3ec8d2e684 |
| engine/v2/tests/stage5-sound.test.mjs | 7068 | f2c7fc5ddab7c7ffdc1af55aef9ae50c4bd9b3e0a9aeb3d7cee9a6a1115d2957 |
| engine/v2/tests/stage6-fit.test.mjs | 1442 | 9e3c5e41b0983e3f05416f989fac9e4992f34a77aa64e2dbfa5e7d7a2a8d1064 |
| engine/v2/tests/stage6-host.test.mjs | 5452 | 5e88d804a40a6c431ca3cc2619d352c50ea4298d7d20f052c6b31ca3f20e59b6 |
| engine/v2/tests/stage6-input.test.mjs | 4341 | a3faf87acf5231a364c40ca805f7d84f4b4d2e122b260e1555db6f4c2f9d9903 |
| engine/v2/tests/stage6-storage.test.mjs | 6699 | 91420351dc11b9520980c490c64e5026b09e0d10b2e60f3685991580c8beb6f6 |
| engine/v2/tests/stage7-shell.test.mjs | 5920 | c17de05f81a90a106904966746cbfeb365700a83d8c6c24f1bb9ec3a6aaebb3e |
| engine/v2/tests/t1-fixture/experience.json | 460 | 4b8ab25f3963f393247fe63f613da0655419b347d682e9d59ee3a6edbb93be5c |
| engine/v2/tests/t1-fixture/scenes/a/a.svg | 1207 | db86c860829a3c67468daf03fd79593a7d04d268dabf5b40a2ed9cee7cc4c7a5 |
| engine/v2/tests/t1-fixture/scenes/a/scene.json | 789 | e48ef2d9de57b3575b748695fe0488c30566ed892e7183f9be135893f77f6288 |
| engine/v2/tests/t1-fixture/scenes/b/b.svg | 495 | 21e962b635c88bebdcdf1aaa70934408e6982fc8fa4803d9b5094430f8d24e7f |
| engine/v2/tests/t1-fixture/scenes/b/scene.json | 196 | 2eaabd35f1ebd0dd42b3a53cedb154f3239fa1b994056ee9c77288b43a2ced7b |
| engine/v2/tests/t1-review.test.mjs | 4480 | 6fc024eba27d7454e856121cf6bb3a74df13749f0827fc9d46046100390576a5 |
| engine/v2/tests/t1-sweep.test.mjs | 2164 | 944b2bc1fcb8626a222b317952a00bc489c8e461a9479806dfd5d824d5888d05 |
| engine/v2/tests/t1-test-tool.test.mjs | 4052 | d288b038617926a4b41ed3dfa558f61d9f25fe7e04a5563f41862a54a0c851f7 |
| engine/v2/tests/v1-change.test.mjs | 43790 | 82df8f28471cdf4eda14e8081f46c6631c138b3e11a16b5f7669cd4278ab72c4 |
| engine/v2/tests/w2e-load.test.mjs | 4790 | df27afd14d36e291072b0b9ae3036c76f1c0da73ef4295657f2f904c93a6678a |
| engine/v2/tests/w2e-pack.test.mjs | 4572 | 1a2e0122b2e947bf712566a40280177b97bbced2c9529049ca4c29b0bbe1e2e3 |
| engine/v2/tests/w2e-transaction.test.mjs | 9934 | aff119fd046833e6e5f8e4a453f096ecaf8449dd019a7967ab7b0808acc3c1be |
| engine/v2/tests/w3c-capabilities.test.mjs | 9416 | 785945ef2ef902945348d4d08285e509b61ae9498783eed39b5280bf93967240 |
| engine/v2/tests/w3e-faults.test.mjs | 3621 | 6ae3fb60c7a0f40b5475cedc46d8cab36e8ee2159fff9f607717b9b38a27790b |
| engine/v2/tests/w3l-layout.test.mjs | 10238 | 58f16411ce9cfe3a356a701f8f13fc3ae1ec3d0e4c3ecdf7fa0ada4be15be387 |
| engine/v2/tests/w4d-helpers.mjs | 1258 | bc661af6e0866dcfad22862c22e2d192c260653637616148e144b55591dadfa1 |
| engine/v2/tests/w4d-motion.test.mjs | 2032 | 09f8ef14611cf3d4026901bbecc110bcd9a12cd8507c524d2f63365410fe09a9 |
| engine/v2/tests/w4d-pivot.test.mjs | 1135 | 2a3cc1ea05950dddddaad03ae32af7ff4f1637fc41d21cee8a56d9b517297189 |
| engine/v2/tests/w4d-placement.test.mjs | 2619 | 1e621d22a54c669931be0f26195536425004914c61c4222733433755a9de123b |
| engine/v2/tests/w4d-snap.test.mjs | 1595 | 90483dcc4a6fe286ce587a97ae47b5e52db63f9314be18afbdb94f8c3e1035d4 |
| engine/v2/tests/w4r-runtime.test.mjs | 16732 | 33790ae1a28955c41e51a0a61e06b53fcfdb0428dfbfd161d87e45dea601b603 |
| engine/v2/tests/w4s-boundaries.test.mjs | 17048 | 61f696cea47eb76f9a7352e57afefac1154b75a9ce52d022d47331b1e770aebc |
| engine/v2/tests/w5-functions.test.mjs | 1076 | acf12799a4147163e7a2909ebbcb36c028b2947f334c1a883bccca8e1d5f3699 |
| engine/v2/tests/w5c-checker.test.mjs | 12223 | b3aaac849074003f1ed064254fa9624770e9aae39cd28362daded137ccf7ae6a |
| engine/v2/tests/w5d-focus.test.mjs | 576 | 5dd5242e3ae63c962ebee2f3cbd6d3181bf763ebc4918029d8356d0195acf4c8 |
| engine/v2/tests/w5d-visible.test.mjs | 1778 | cf7a3d599e1a54a3b83ad640f82b7efe3d59c58b46a2c91bbcad9730ddb7b695 |
| engine/v2/tests/w5f-runtime.test.mjs | 20977 | ca68c8bc10e0d9fe8c3583eba97b6bbe72097887d60c79e609d9227c0aaf3c57 |
| engine/v2/tests/w5k-kits.test.mjs | 30951 | 239bffc26404d7f79bd3f21c9340b6757b71e739b9afe0bcb035f0b6e6e2cecf |
| engine/v2/tests/w5m-motion.test.mjs | 14924 | 72f365ea6a29491700ff0271235822590922bdb4b0b88f5b0f470b7fd8a3bf7c |
| engine/v2/tests/w6l-modules.test.mjs | 13997 | f2cbc88e8e7c9734e29caec7453d0389cb690ff774529d0a649659cb2308abc7 |
| engine/v2/tests/w6m-readme.test.mjs | 2564 | c6c481db430a14972b4fe60be470b2035bccfda5be84ebd567e3fd04311b6dec |
| engine/v2/tests/w6v-media.test.mjs | 11015 | d70f9f683cd7230eea37d94ffcfcc1dd2488bfe7e3a8f6edadceead2915b6402 |
| engine/v2/tests/w7a3-stage.test.mjs | 14952 | 5dccc29d82220a0f63bace66ae2dcae59602515d3e969d73554d83c4f4673b81 |
| engine/v2/tests/w9e4-fixture/experience.json | 276 | 137b1c4247fbb1126e799ba679ea3f991013556b402024de0dc98a78ca959a74 |
| engine/v2/tests/w9e4-fixture/scenes/one/one.svg | 3423 | f1b36682da71b6024f58ef5559c9d59caeae07bb8ab7489576a701642950fefd |
| engine/v2/tests/w9e4-fixture/scenes/one/scene.json | 889 | c859b08bee6ac268903736cf8a95e30fd89c2801958b200d8e8397f526ca5225 |
| engine/v2/tests/w9e4-words.test.mjs | 5669 | ec7d6fc4ed9a378516140dfdfdc67df5812d3c21d2d06bfa115257948fb68e0c |
| engine/v2/tests/w9e5-computed-cache.test.mjs | 6626 | b2d1271e014d41d322c118b61b31e0158ba6a89ae0d469a04609172bbcbd9bdf |
| engine/v2/tests/x2-dashboard.mjs | 2673 | 7924b4e4b66aa459e3bff7245fa7196733d6fc219c3b6a63eef6b0af9c74c80e |
| engine/v2/tests/x2-speed.test.mjs | 10504 | 703e2fb02bbbc3235e903b5f356d7ee864925c53d38e63704f9a7f405691effa |
| engine/v2/tests/x3-correctness.test.mjs | 28514 | 2e76e3d5f033c6db1482d0204fffb24f91330b3be5ea6dedca338786b10e5c0b |
| engine/v2/tests/x4-truth.test.mjs | 15964 | caa4fc1dedf0f98eed0f40eb124bd217bf52dd491f6cb9d08730ebeb125a4ca1 |
| engine/v2/tests/x5-format.test.mjs | 6170 | 69891a2275e3ef10aa53a5a7b9d3fa3d18745c8abfa38085951bd544c522d9ba |
| engine/v2/tests/x5-frame-link.test.mjs | 6987 | f6ac34cc8306af69e21a2604363b6cd6e799f5f05b008c9d017a52fcf06dba64 |
| engine/v2/tests/x5-status.test.mjs | 3229 | abe06beae4a5385f33de89bc4f6d4dc1006145c719be7827b6c89bfff5d2d540 |
| engine/v2/tests/x6-addons.test.mjs | 17412 | a13a6eb81331f3ac393a69b1151ffd67e47c0ae5994f7e6ad99b103baef069cb |
| engine/v2/tests/x7a-fixture/picks/experience.json | 645 | b129026aae371b3c87dc39a5c8e760509e221accf00914d0b00f83f6a1ba8122 |
| engine/v2/tests/x7a-fixture/picks/scenes/home/home.svg | 717 | 607f87d0d9bd6e10d535aa3c5a207114d43d9d708ef01694fe37ac7c61ee8331 |
| engine/v2/tests/x7a-fixture/picks/scenes/home/scene.json | 434 | 9007bd6b0c2a66f6a7ff240c185a6ab3ea774c0ab4c35f66da070e881e0ff364 |
| engine/v2/tests/x7a-library.test.mjs | 15055 | fcdeef9c7fe5b0193b5f7c31c2f0055b1e3078c41063e0500ff6ea2e733a2310 |
| engine/v2/tests/x9-noughts.test.mjs | 8421 | 5735a94e403e3ea8ba10fbdafaeab1fcebdfb17af9491d5a020cc9daf3d51946 |
| engine/v2/tests/y1-fixes.test.mjs | 21789 | 2a6f935cecfe4cff6f54bf81e19214a91472e39af9ea16d7bf6b6b65ab7b8cea |
| engine/v2/tests/y2-change.test.mjs | 4016 | d6868780ef17ed51da10fd8ec0f9ae70c6a7296abaa14c31db59e2ed6e1d2395 |
| engine/v2/tests/y2-host-clock.test.mjs | 9558 | c5b7ee993260f9d8c0627d22fbd7d171b2df56f099c86564a99d007c9e9598d5 |
| engine/v2/tests/y2-mount.test.mjs | 2806 | ad54e2d770865b303e89c1c9521841fa26e274c8b54cc8b076ccdfd7694e1a02 |
| engine/v2/tests/y3-fixes.test.mjs | 34516 | f56045dbf6906b3394d2f624e30ec992b3916fdbc81cadcfbf7b7a496a1c3674 |
| engine/v2/tools/addon.mjs | 15454 | cb92ccdcf0db01eeb3e96f9c6f5bc5fba47b67e1c927606e0d2423630c104cc3 |
| engine/v2/tools/addons.mjs | 17158 | 8794470112befb759f53b3549326a848e7cd0be90c0609323af60101e731f093 |
| engine/v2/tools/change/apply.mjs | 24559 | 537b7bd52fd73914dce27b37e3d071066f0c2eb5f409d24966b02c49c548c4a7 |
| engine/v2/tools/change/folder.mjs | 4316 | 28f707f5d6544c1e1b9a76ff4bde12e0d5c7d1342ebf772eb13acd450318d42b |
| engine/v2/tools/change/make.mjs | 3764 | 4b6a5c91bd86d7e9d5c517eccc112e06c4e911a9c92b2aee90931249d6591f15 |
| engine/v2/tools/change/play.mjs | 11566 | 429900664e5fe4d0adebbc734c00e56efb662e511ad084dab307286b52a8e22a |
| engine/v2/tools/change/request.mjs | 7584 | d221df4ce8d279d0fbf0de10555f64407ece1cabf70f720c0d8be2508d44b76d |
| engine/v2/tools/change/rights.mjs | 5734 | c94d841a9110cc0ce9d5ce243e2a5d5926ab9079b6f49b8382f2b19e32bb79c8 |
| engine/v2/tools/change/rules.mjs | 3261 | 2c69eba03b566c5db651c74d00d1e349198f770d1909c7e38963db6f02701b58 |
| engine/v2/tools/change/targets.mjs | 13914 | 5647ab9a980831910844a82600b398e8b76480f44cab36c713208bd264e5dd5c |
| engine/v2/tools/change.mjs | 5076 | 60f30d81aed58174fec85cc4470e09d446713cc1487f0d20a870bb6e73a812c2 |
| engine/v2/tools/check.mjs | 6888 | e6c7db8cd5c3816d5cb67f07f0c51e9a579e7a61bee37a9ef96961142819e56d |
| engine/v2/tools/library.mjs | 18886 | be654df4cd1ca67f7f0d9b8ecea364dbc593c9389d89806e5dceecaf3dc08f10 |
| engine/v2/tools/make-limits.mjs | 3327 | be7e55a393118ff5b1959fa4bea23732ce969610cf9bfd9ce2f368c242f4c6c7 |
| engine/v2/tools/make-owned.mjs | 6376 | 435adafbc4d18875ec08110890713fd1ce1dcabd59647c96e2dcb67cd23bc829 |
| engine/v2/tools/meter.mjs | 8724 | a6cf59b5d6d590a02fb046413ef37c50d7ac6588d4dcdc38d1286d4d8a210afe |
| engine/v2/tools/pack.mjs | 78093 | f557a63c305e88af3dbf519d3e12188decb3fb44dadb055b6cf10a24bc25d510 |
| engine/v2/tools/preview.mjs | 9743 | e59bc6d83f3b5794433e428b0b632dbe6e6a34d764a9ff787b0a4fe294467062 |
| engine/v2/tools/previous-kit.mjs | 1388 | a97d7b896000218e6ee9dc50ec47516cb39f3f8293cd2a6fee8355c4ab0c9693 |
| engine/v2/tools/proof/FORMAT.md | 3419 | 763aebbf599157137b28324ad6a783a5e95485a83bfd518f21b0fb8162b41c6f |
| engine/v2/tools/proof/README.md | 6997 | c515a8d6d6910748a337651b5c75d6bdd8248747fb822e5b8527da758a8d3d5b |
| engine/v2/tools/proof/baked.mjs | 4867 | 11b6f4d02074d8a2cde5a39a13338f387fc643ec57ab5fef711dd99ec819782e |
| engine/v2/tools/proof/browser.mjs | 18467 | 93514373614836be76b05a7fe5469eb0aff8d53d9e99e19aa71aae092fe00592 |
| engine/v2/tools/proof/build.mjs | 5937 | 6e334cb02c28c7da6c38dbaaf34137ceaec1e245fc90e936da10168de96571cf |
| engine/v2/tools/proof/certificate.mjs | 14807 | c780072ae2bfd0de7941fb5db0ca30d49fbea53b8d01db117bbfeee75260c0fa |
| engine/v2/tools/proof/explore.mjs | 16735 | 7da3827c029d871ffa41275388f533980ddff9db905444be3399ff242fca0e29 |
| engine/v2/tools/proof/format.mjs | 6776 | 9c90baaa93f42c57ffa4b2b6b03f9474db6459f6b21ebaa9afa7f38d8a0fa26d |
| engine/v2/tools/proof/proof.mjs | 12658 | 7048f575fdcf7c836a8106952804f121f5561217cf98c76902e663c8dcde4054 |
| engine/v2/tools/proof/tests/proof-browser.mjs | 5858 | fd290480453f12aefdf38b4e57b029442df74db3363235e7a9d1d0adc7008694 |
| engine/v2/tools/strip.mjs | 3622 | 332e07c1c558067804dfe0cdd13ee9de9cec3195ae82442624091cb269a8f6e4 |
| engine/v2/tools/test/browser-pass.mjs | 33211 | f82b4b2dc62080b794decfee6664ee68b147162368fe65f9f58d6a5fd0b78a8d |
| engine/v2/tools/test/hooks.mjs | 1830 | f31513820ea9ac3d645e50513bda443e072c183ac9ad168e770eefa42971c016 |
| engine/v2/tools/test/node-play.mjs | 12592 | 6dca05bb1e2e2644906babfcc45ad480bfec52c8a5e1c3a558772f78036264f9 |
| engine/v2/tools/test/page.mjs | 21983 | 5f60e9ee130e30243bf4f2a3ed96927e04d7c22b14614d739be8e201bbc069c8 |
| engine/v2/tools/test/sweep.mjs | 4469 | 73d9f030d275822923dc5b0cb54861d4b40346313d08bc882fa2896ee43f1d6d |
| engine/v2/tools/test.mjs | 20427 | 422554eb1e44c35db9c80e8bdb0f64ba7bcbb057dfef76e9219bb5bbe7f212cb |
| engine/v2/tools/unpack.mjs | 2508 | 0c53118c2d7f07866525d6cec601e02ce5ee33de0edad626e58e5f860aa9d9a6 |
| engine/v2/web/asset-web.mjs | 11998 | 451c2ab275e4dfe0a48c8e013ca158f97b9f31ddf1997cc775453fe7240497d3 |
| engine/v2/web/audio-web.mjs | 14671 | e9e339e78b25c300bf41017bdf78b32edeefb87edf03ed8a62517e213816c1ef |
| engine/v2/web/export-web.mjs | 2413 | 519fe528d64dc4ea4d2d3c4b1bf93fe4974d27737e44332b8edcccc72fee26c7 |
| engine/v2/web/frame-host.mjs | 6436 | 5e24d2599b6c1c37df2f177d88cb97619272ab333de54717d68c0d6128afe950 |
| engine/v2/web/frame-link.mjs | 4992 | 376d30b8e91cd386652b169aae4b8faf02f0ec55399397ce9bf92bfaf7fb8483 |
| engine/v2/web/index.html | 1091 | 309cb4d7d7a61c2a79d206929b4c6a7cbf131d34e495eedbc33e45bb66e4c34e |
| engine/v2/web/input-web.mjs | 66293 | 3b7f83b4234e245708019afed7c75c0cde3b27c98fd1c6453078e09055274386 |
| engine/v2/web/mount-web.mjs | 4594 | b40d6729c179e97a11882a66c39843d6dcff68c42a29bc7db8e18a4a99c8dcc9 |
| engine/v2/web/packed-entry.mjs | 2290 | 867106ceb271fa5cb723088f362d7cc13e209180db163b63e4b7581bb0e20395 |
| engine/v2/web/player-web.mjs | 45899 | 36ca9dda187a2b5c786275f649a0e59daa6fcb41df4c8423f22b53f74b94a201 |
| llms.txt | 806 | 1fe132e45e8813675ba424a459d6af76964257e00009d0b165c9111c3a435068 |
| package.json | 1751 | 281f20fa3c774db0c78b841a626033adaec332ed56684da7041ff7bb9651b5d9 |
| release/EXPORT-POLICY.txt | 9913 | 337ef61990fbbfb25bb3e8fd635b4d3e631fe02008c336c382c0720edf2118ee |
| release/addons-tests.json | 35401 | 8eade3ba484cdfc8633771ffb6e622d59266b63ea69a45cba4f3d1dd6c6677fb |
| release/browser-smoke.mjs | 12713 | 8f38a0fdb690881af18f457d2281289dadcb5fc009e926f2a2b315f250cdf367 |
| release/checks.mjs | 9948 | e3bb25a0afa647994d4efae27be1cf52dfa5d28fe8145d8500445dc76eae0cd9 |
| release/leak.test.mjs | 10496 | 7e0911905366bf75880015eb20f2eb1b78b7257914f04e48d9ab4131e92c752e |
| release/lean-tests.json | 7104 | e80b2fbc7b3ec60fb35e310f7b82150e4c351c105329683cb11e01ad33126f62 |
| release/policy.mjs | 3619 | f957463f8cbeb653cd91b82790f1e07f49d00b427799ddc03be284c825087ecf |
| release/public-omissions.json | 2728 | fb1608ec0109ac5d43bcc475eb0d43f5497ce9aa9fdb35e17a9e327f5fb599d2 |
| release/public-words.json | 2812 | c1912caa7195c0005d93fe7ff8885fe068abe95b74cea535474913691837b02f |
| release/scan.mjs | 2770 | b75cfe8171f678705fd56b1cc9e4b37ffd25ab2edc44b1b27267d46d5368b303 |
| release/verify.mjs | 10234 | 2fe1ed8edfc8e1985a29cea5278c6bd484edecda684dcfa149bce0cbf78bbc3d |
| skill/2.0/examples/kinds/infographic/components/bar/bar.svg | 2074 | 377bcbff5ec81430beaacd9577b5c93698e7d415355b02319c2bb0e08b2b6c08 |
| skill/2.0/examples/kinds/infographic/components/bar/component.json | 548 | c2a35d680b897b29858c0205f44493baf621e92203cb7aa7ceaabbc2282714de |
| skill/2.0/examples/kinds/infographic/data/fruit.json | 204 | 30cef2cda1b1a57f48d5bb7919e8a656a155f576cff7e8ac7e4b140c5c96af70 |
| skill/2.0/examples/kinds/infographic/experience.json | 758 | 52ffe2a0e742b1f45457b277d41f50f3f5a03edba1934966bb8b1bb47a74f11d |
| skill/2.0/examples/kinds/infographic/scenes/chart/chart.svg | 11219 | e24744b426ca4e9163c6bd4eb90773cdc57c5cc6763c543f05d2b9a281dc1cc1 |
| skill/2.0/examples/kinds/infographic/scenes/chart/scene.json | 255 | e0ae64c1f06d443c32040f576803b54d5788ee97f382e22c5fdf8df098ff4e96 |
| skill/2.0/examples/recipes/orientation/experience.json | 660 | 529693d5d562dececd4d27e947f68628c241fb944670f20c2ed913b727d3f53f |
| skill/2.0/examples/recipes/orientation/scenes/harbour/harbour-square.svg | 3302 | d63e736f216666dd7817b7dcc03e44c945bd1a8ca2fa2175d9d0bdbf71c1d9ec |
| skill/2.0/examples/recipes/orientation/scenes/harbour/harbour-tall.svg | 3203 | a6b0f38ba615b7a549e0e536749ca01c3ca48a3e2593bc8157e51271501149a7 |
| skill/2.0/examples/recipes/orientation/scenes/harbour/harbour-wide.svg | 3586 | f400f6ba280b7871d81d0fdd0eb6707350f7f258a4040ea1ee4d579d329a0a4e |
| skill/2.0/examples/recipes/orientation/scenes/harbour/scene.json | 972 | 6c493be685f9867543b4c83b809d1847ff43a94bd9a7efa5801a84c2a418fbc6 |
| skill/2.0/examples/recipes/orientation/shell/frame.json | 1723 | f2ae61f2e807acc7353eb19c926f5e687b0a8b123ca9215df01922f699bd6320 |
| skill/2.0/examples/recipes/orientation/shell/frame.svg | 2286 | 00453eca3babe48ca3417736a33cdaf44c01dfbaf970d4413fe1ded3f838d667 |
| skills/hypersvg/SKILL.md | 15243 | 0420d7efc137e1b1cfb17602249d9d331ba2951f17b9a239e988586459f2849e |
| spec/2.0/01-model.md | 14916 | 75807aa7f086f5e9fbd85b6b536db1205fa87b37305ba6dc72f5191a0e34ea16 |
| spec/2.0/02-files-and-names.md | 36598 | d385e6c80136b46e15f38df4f508aecc4921bc331ed7078f3f756893d26364ed |
| spec/2.0/03-story.md | 32425 | 39e8a6a30264603fea9fa6c09557373ba20075ef504602d8f24ecb39d17617e9 |
| spec/2.0/04-blocks.md | 15655 | e2701f9d65792396bc9d5666a4ccb6c6201b6ad3872a7897463bad7bd8681a8b |
| spec/2.0/05-faces-and-body.md | 87636 | d2f79d063c1a8456ca603914a743ef07b1113d00a632ab32c790580dfbd5b5b3 |
| spec/2.0/06-drawing.md | 56756 | 3be761545708095578be1043dccd12380565b8ada4edfcc38d215ae42c4bc15d |
| spec/2.0/07-representations.md | 32570 | f4f57d7241a8db866c5ba1c2a11a67d2dff57186d2d4d1411c1bbda956ba1d3a |
| spec/2.0/08-rules.md | 1246 | d44f3eaf19cff262407789b85840cc577593d818eecdc5422d30504b0aaf13fa |
| spec/2.0/09-engine.md | 13103 | 1f749604fbda50c2e755788eebfb65c37e5afc182dcf0532abbb34633a077f22 |
| spec/2.0/10-hosts-and-delivery.md | 44380 | b90e6bea398a0e3f2897bd4c29cf37b088106ebb1545cc0c27329a3e12916a33 |
| spec/2.0/11-vocabulary.md | 9706 | 85070608dbd5be1c90866b63ed93daf1c8ca04439c00c61e1b8cb62336dba56f |
| spec/2.0/12-writing-an-addon.md | 54160 | 13b26aa318ef332ef75b48093a57942a4a093e37e76a2bf68e8f263195467789 |
| spec/2.0/MODEL.md | 13781 | 9dcc494072c387d67a7437759eb5ee5e421ceb20dc01fcf52315240848ebf87e |
| spec/2.0/README.md | 14247 | 591c51de53575b4ae121675cd542367e64ae242ad5d13cc2aeee1dea923d82c7 |
| spec/2.0/addons/a01-effects.md | 266 | c3c2577e1ea892ae705db386d389159ad8138509b0f1877e732af566c5f4fbc7 |
| spec/2.0/addons/a02-media.md | 262 | 4304e361dc133030a6857e0c2fce1b971f958d5f22898ada4a37d0f6c7b90268 |
| spec/2.0/addons/a03-page.md | 278 | 3235a9c10409ffab2e12f0212587dd531fe3c418f8d51e1a4d42c719c2c9458d |
| spec/2.0/addons/a04-seats.md | 262 | 20259f2b694de2ab5e5e9f65c8964f7d14b817482c114190a01bd94fcaeb2846 |
| spec/2.0/addons/a05-ai.md | 292 | 20682628876433e0745e2132b5ec20ae8f5b188122b206a2f07bb20fbaeaf188 |
| spec/2.0/addons/a06-widgets.md | 266 | 17926702c0af5ce719851acff101ee746aa37166c70790e21ad1850880977ba5 |
| spec/2.0/addons/a07-fit.md | 258 | cd61515177d2b9d159baf81f2bae5011029bfe5ee2e0489e70a326d3318e13bc |
| spec/2.0/addons/a08-checking.md | 232 | a77ee8b86ec4757c72b2b7eef1244ae0772441c33169da5385e005303716d0b5 |
| spec/2.0/addons/a09-trust.md | 534 | 8c668f61cf27ed16fbad0f32c3e13938c9ced71c60a21c94f91d20450d9b075e |
| spec/2.0/addons/a10-exports.md | 252 | ff6ef642a3efe9d30f9b46ecfd4b119237912901b99de09284b09b69bd22b293 |
| spec/2.0/addons/a11-rule-packs.md | 234 | 52815d7085c1d788296da5640f1b3fdbda9524eb0f7cd2979445cec82f7c3663 |
| spec/2.0/addons/a12-publishing.md | 239 | 14edf1efc49a2bf25a48d0d1e5abf29c43352346ddeb64d64f5a78b8cfdc50d1 |
| spec/2.0/addons/a13-migration.md | 236 | de4c5fff2381fff47d9e140fc7ec5376b837a677149f3cd2fbf8b4d6b7844658 |
| spec/2.0/capabilities.json | 11736 | 514624eea28f3073a90c33de2e2911f1c88910aaea1a6af0b0daf69c10685c7b |
| spec/2.0/decision-index.md | 7882 | b82c175ee64d476db643cc4442134a658ea3441f2577c45205fefc9007cb87cc |
| spec/2.0/documents.json | 295916 | e1501e11458579fa9bdeb77d65fb938c9a88a93f202066c27f0584b72b77e125 |
| spec/2.0/drafts/README.md | 3845 | 963b439797d1d8b1aad760f7f95e0d6780d987f43bf796570687a2b6dc8b1567 |
| spec/2.0/drafts/choice-places-2.1.md | 1012 | a5dc8af2f34ad3b236ebf9115a9a98ce269776671b6987b52dfa4f100f4c0d2e |
| spec/2.0/drafts/choices-2.1.json | 661 | 6f7e33cdbdb9162e3808e8087aa2f9dc4a37485903bfba7cc6dcaba81d3a3081 |
| spec/2.0/drafts/clip-extras-2.1.json | 1622 | 13d2ef0ca3318d7c41a01edd6305289308750dc75dceecdeeed297cc2cc8fcc2 |
| spec/2.0/drafts/clip-extras-2.1.md | 1746 | 4dfad14e090f36e18dcdeef4be43bbec1dfec2e685779cf3f8199fe453774f45 |
| spec/2.0/drafts/content-options-2.1.md | 2901 | d97e290cfc3b5964ed41689814fb479ccdc312c9a64e8a08243507110e566b4f |
| spec/2.0/drafts/custom-widgets-2.1.md | 1318 | 7efef26034ad752283b0d27c2324e980c01f9608122289df6b720a7ddcce4628 |
| spec/2.0/drafts/delivery-2.1.json | 4174 | 44caaed13dccd564ecd5cf2924c34a82cdb61198fc0a8dd5ad49fa2ed645277f |
| spec/2.0/drafts/delivery-2.1.md | 9596 | e2567489d1d63aec292996d8d293f7ff3c129243735b0b19b0bc7a224634e8fd |
| spec/2.0/drafts/effect-kinds-2.1.json | 15685 | a13dae565c81715c85ef4f34417ff007cb4e9938f6bc5ba1b8b9b53e53e2642d |
| spec/2.0/drafts/page-actions-2.1.json | 4898 | b575e9aa96fe10e881f26e2302eb399523efb2d3580a4ed1ee56cc9ee2747bcb |
| spec/2.0/drafts/remote-seats-2.1.json | 11567 | e703aebc387830d15753d502f9bd10da02cfdac7294bfcaaf46f8f34bab35247 |
| spec/2.0/drafts/scroll-clock-2.1.json | 2550 | 85b2c9e2fc6250313c64bbed043aad2fe12bad8837b077f9fbe2465cba05d467 |
| spec/2.0/drafts/structure-2.1.md | 6847 | d547dcf4f681b7e219023d3590950a2b3bf3a420eb2d037287a6326069369798 |
| spec/2.0/errors.json | 71389 | 7d309a87d10dce8e8fef04a3ed52707b40f6cb3d49fbabc5b56e23d8858aabb3 |
| spec/2.0/limits.json | 38473 | ad23556910b5bcf75af2a2234f75dc1fab91daa4b0351f9929600601a2b3c451 |
| spec/2.0/packs/hsvg-accessibility.json | 1004 | b14929cdfa3806899a9e4c0c9d9e40a1f3e7c23cce78d73a078ec9c9b18b0334 |
| spec/2.0/packs/hsvg-baseline.json | 2026 | 346c17de66cba2fea38d15724cab8481e5f5d84f96eaae6c170072fe16210c03 |
| spec/2.0/packs/hsvg-page.json | 808 | 6994132d897f908d0b1823a90eb8a4d80fb1b0a55798410592d804ef3820e8e9 |
| spec/2.0/reference/README.md | 2331 | 6c49644c5a378687e2ff8f84e5713d020b3f4b4905699801317327f2ccd2a4fa |
| spec/2.0/reference/a08-checking.md | 16984 | 8904c9a0e77fbcbfe767f6954c30329493b6bd7b00a79c7a44fbe3126bb0c218 |
| spec/2.0/reference/a09-editing-and-trust.md | 32474 | 161c81fea029197c1d41ea90597b569f6684ab74c9ba2e346d167a36c32944f0 |
| spec/2.0/reference/a10-hosts-and-packages.md | 23126 | 3372659d8c60be9168f0ca63b308a4217d07517d951fa74f718c903c42865ff5 |
| spec/2.0/reference/a11-rules.md | 27627 | f37599cd1ffe08d755855a3acaf6fe1d16953f0462740c4d7512c39364dc42f3 |
| spec/2.0/reference/a12-publishing.md | 1832 | 158a130f41033aec27b8a153b97b0b0c214494758c7a42aaeff60c3af47ae515 |
| spec/2.0/reference/a13-migration.md | 65224 | 75922572f55ef33ec65728db6872327375e546157d8af8addfdc72c25a1f8afd |
| spec/2.0/reference/a14-kits-and-libraries.md | 18581 | fd8345e39f17483fab55dfbdb3cb1f141daa231990c8e38c3dc94e187fb5b7cc |
| spec/2.0/renames.json | 56499 | 4bf58b67c91003c4c8c59dacc36ab43bac98047785eec66bb76731b01cd9c39c |
| spec/2.0/schemas/README.md | 3219 | 0a6678805451b918bd01620c4c821b43dfb522c6299c009a8dda8bf68f747040 |
| spec/2.0/schemas/addons/a01-effects.schema.json | 722 | f6072035f5a081f11f3d563f4a463c7f7a576abdf43eccf9028662c0e55c7667 |
| spec/2.0/schemas/addons/a02-media.schema.json | 714 | 0d8ce7ccdd5f402571a82d95858679e46af8747fae98aa471679eda8d72b77dc |
| spec/2.0/schemas/addons/a03-page.schema.json | 1998 | ec2a7789ec2dd885613e0da2963d16cb3a4ae7018403f857c6fc570c7962ffd4 |
| spec/2.0/schemas/addons/a04-seats.schema.json | 966 | 295bb3fb6492e6ce2a764a4bf89c3999b4a12e1a13ea1604053c708306629e9b |
| spec/2.0/schemas/addons/a05-ai.schema.json | 738 | 32b8c7efa4e75975fd193d57bcbd849a06c3ac7527a8189363ef849f96f4b797 |
| spec/2.0/schemas/addons/a06-widgets.schema.json | 835 | b09ad5b5cd7bff12f9cf3f52a81432025845165d31ea5afc2a8fdd4eb4a0f0e0 |
| spec/2.0/schemas/addons/a07-fit.schema.json | 596 | 2f788c7054962e9057c3f0a610266ed850e3b172c27f2521eff8a16bdc35d00f |
| spec/2.0/schemas/addons/a08-checking.schema.json | 4025 | 02200cada3440f487ba3d4cf7ed8c31f748268d42d47b1661d501580a87eba89 |
| spec/2.0/schemas/addons/a09-trust.schema.json | 2576 | fef27a2de3130549eeb3a5e7a494bbbca058ac6d5e53a63588944d9a7b3b4d5c |
| spec/2.0/schemas/addons/a10-exports.schema.json | 3263 | c3228185bc67a3f7006a0fcf49d90af740cbb03dc7407ef2661bd292297aff01 |
| spec/2.0/schemas/addons/a11-rule-packs.schema.json | 616 | d0db6a74190eb8292357f4dccf3bae0062ff15f717fed7f50740b1cb9690a315 |
| spec/2.0/schemas/addons/a12-publishing.schema.json | 611 | 3fd9ec84f08521411073e2cb6d7e9f9e4afa87f38a5c66e3b8a69a9b3101c9a6 |
| spec/2.0/schemas/addons/a13-migration.schema.json | 1256 | 7d14af058593e5f2e6ceece6f72633adce924bbbd049b0c8aaf6bb362c78a438 |
| spec/2.0/schemas/capabilities/ai.schema.json | 16055 | 3f70b4623682ba69a1b1481f2226d76df9712e632355f0e17c22b2ccaa32645b |
| spec/2.0/schemas/capabilities/chess-opponent.schema.json | 2303 | 76c47206e2890e5e881d1a9cb9f54491c01474ca25ac8962b9c3c5e2cf4cf258 |
| spec/2.0/schemas/capabilities/chess.schema.json | 3969 | b34756330ba622342b5d248f3c24ac913d0e5db7ac7595d47e0c50b6c73ca2c5 |
| spec/2.0/schemas/capabilities/effects.schema.json | 14066 | 07d07381ba9e15be48ffa1db56044316f8b00ecb008c3d77e056da21926fee83 |
| spec/2.0/schemas/capabilities/fit.schema.json | 1211 | 25cacdb5d00ef947c0c0eb52cbfc385b7884846e102db819f50fae80ab840a5c |
| spec/2.0/schemas/capabilities/ladder.schema.json | 1488 | 13d84e851a2b1312e5558d6a9a6d5e4e86dc188130c2ff481eae0e8f36268277 |
| spec/2.0/schemas/capabilities/lines.schema.json | 10381 | 89d893d2c940cd6049ba0c202f357c1d57f70dda3ecdf03fb344b0ccffb45152 |
| spec/2.0/schemas/capabilities/live-data.schema.json | 2994 | 4bc614aa30aa13640c706332174519663bb60594a8f8f53a4bdc748cc9f35704 |
| spec/2.0/schemas/capabilities/media.schema.json | 10096 | 8700107d0308d4e2c9e318a122adfc2c61e9daf258b35cbea65376d5f5bcfd33 |
| spec/2.0/schemas/capabilities/motion.schema.json | 1708 | 9fc207d957e4d019deadc9bce8ecc5b1741022243848a8486b8b584216e1d031 |
| spec/2.0/schemas/capabilities/page.schema.json | 12688 | ff95feea108e9dd805ebeb8a95e0270cb4c8b6b0a725cc9f8cf9d22bc139b796 |
| spec/2.0/schemas/capabilities/physics.schema.json | 16268 | 543b8f6e91cfeab271aa7da8d856c5270d50f3faabadb8904a103c088832b21c |
| spec/2.0/schemas/capabilities/rich-text.schema.json | 9903 | 658ad69051387614c1588ee104ebb88b1b2ee2dea8ef3343406be286311096cb |
| spec/2.0/schemas/capabilities/seats.schema.json | 12377 | 1f552f994b567fc212d7d469847d492dffba9f6ce826066cbb67c001dac02028 |
| spec/2.0/schemas/capabilities/snapshot.schema.json | 4831 | b027fc41a7d989d2f5699d4f41883f266bcc82b26b7fbe681a75ef7653dd766a |
| spec/2.0/schemas/capabilities/synth.schema.json | 8377 | 1ec8a1b1ffa9b5664b19617d89d59e8d147a73e4e180ee07bc719b770d949989 |
| spec/2.0/schemas/capabilities/widgets.schema.json | 19623 | 4feb4dca61fb5b16059f76c10f0b6f64f50151cc8d1391af993093b8bd408332 |
| spec/2.0/schemas/core/capability.schema.json | 9829 | 47a2f27be9ea46623f5c0189006b80d84cfbcf3e838bc5f7aa8eb41584954466 |
| spec/2.0/schemas/core/change.schema.json | 2424 | 56561a19aecfd426bb2afc0d421b85ad2638ba78339d2349fa391ebde5e508c7 |
| spec/2.0/schemas/core/component.schema.json | 195548 | 4c52d0f7abe57c2eac7ae820f23e944c6a269eaa2fd5275194d2a1558a26536b |
| spec/2.0/schemas/core/document.schema.json | 4082 | b235861fe9c4404f82b24199facd8c5fa97343f44e8954f7b6aa1f565d3a3118 |
| spec/2.0/schemas/core/drawing.rules.json | 26543 | 5e2b8edea1db679bac8de5bab886756cb7460ec87bbaf681deb735db8ab26416 |
| spec/2.0/schemas/core/experience.schema.json | 152253 | 037ad2cc1695821f816ea34bdfaae168e78779f65e671beecdc1630752bdee7d |
| spec/2.0/schemas/core/host-profile.schema.json | 55773 | 0943298a4d06f7d78872c7125fd11adcc8c067d5b7cabf7045ba5863be308bce |
| spec/2.0/schemas/core/kit.schema.json | 110825 | cb49f8da1cc0c274d8b79275e9aec366cd4c08351dba97e319ebd0604d461415 |
| spec/2.0/schemas/core/package.schema.json | 10432 | 2bb96c3da085c0a9fdda98f164430121d1e957ff36148344c0e86b5833ec22d9 |
| spec/2.0/schemas/core/play-test.schema.json | 1489 | 4f706d5da89257d45c556911406acc8e5ca255d45f726e47d932c85907a3503f |
| spec/2.0/schemas/core/receipt.schema.json | 4890 | 75d502d28bc6f21619249b4a3d8dd59529161450eee7d2fc4953a7c569ff9754 |
| spec/2.0/schemas/core/rule-pack.schema.json | 79266 | 9b4df9194c6c19081937da1650b38ff22cae0d97192f7cf83917c3d76d1099f0 |
| spec/2.0/schemas/core/scene.schema.json | 197375 | 238b9a7ff76a36b9c021b8a40c242c92d5a2793fc8348fefce15025f61910f8c |
| spec/2.0/schemas/core/shell.schema.json | 191785 | da87344da690260283b94c9d0b7185165cdcb019584eb55d828667eaaef92773 |
| spec/2.0/schemas/examples/context.json | 2789 | 4d4c57d218f9167642b6a1e2aefc831d57e75a8357df7bb45cd804b1ae271fb9 |
| spec/2.0/schemas/examples/invalid/documents/E-DRAFT.logical-block.json | 107 | d80ccd561c294ea141238324461757aa329fb5c8eb7e5e4bd967dc8268634d27 |
| spec/2.0/schemas/examples/invalid/documents/E-DRAFT.nested-experience.json | 266 | ccd16497be101d697d0512d0bd7991bf9eada8ec794e862d73bfbe3e3f8c10c1 |
| spec/2.0/schemas/examples/invalid/documents/E-DRAFT.split-screen-shell.json | 247 | 3cdde042253b982c5ecf4774aae7ea9bb7a2a7706f21e59c8ee56d5cd2fb9efa |
| spec/2.0/schemas/examples/invalid/documents/E-DRAFT.split-screen-start.json | 281 | 9901843102fbc076b9387763b821c8f73bb39de9a4c194f914789e929ce76622 |
| spec/2.0/schemas/examples/invalid/documents/E-HEADER.compound-is-not-a-kind.json | 84 | bb7ba9c1f869896ba44ddf3e382dfae1ac298f1b467df54a5fe4de208ef8da7f |
| spec/2.0/schemas/examples/invalid/documents/E-HEADER.old-format.json | 59 | 010864583f95c2fd0cf81dc1e77fb80ab38082a057b68f60474ebb81dae9b9a8 |
| spec/2.0/schemas/examples/invalid/documents/E-HEADER.unknown-kind.json | 62 | 09370b6e3562b62f722ee8d5527b0db57db085db1b6f266415cca2f4e29107c2 |
| spec/2.0/schemas/examples/invalid/documents/E-ID-FILE.flat.json | 170 | 78a57c8c851cf86fd43e2cb9ffb6cb9da8f1910f82721d4ade466295c22027ac |
| spec/2.0/schemas/examples/invalid/documents/E-ID-FILE.folder.json | 91 | 94c0f4b07f8336b4e961faa5ebd74fb47e50dd3ebb69cfd7c69d39b61c4c4126 |
| spec/2.0/schemas/examples/invalid/documents/E-JSON.not-an-object.json | 13 | c983f7e35a92a448ed4383cf28f3305b9bd9672f43be9204b13c3e19f6207f6f |
| spec/2.0/schemas/examples/invalid/documents/E-JSON.proto-key.json | 100 | 43f2914c615d6f137d845138ad2d6674896391ede48253a8606ed1b87559e0a0 |
| spec/2.0/schemas/examples/invalid/documents/E-JSON.repeated-key.json | 82 | 456954d8f091215e30128523ffbe6b1763f04976c6dc54a3f10c251961d17a25 |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-REQUIRED.axis-input-without-value.json | 172 | 7b20fa671f66e5f156835f2c59f7843bec35845f2d4d203001ec12f84b3182d9 |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-REQUIRED.capability-no-grammar.json | 165 | e17e2c7d199afc8766451bdff705cd22420f8e89a43dd134b419b0f8b049e2ff |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-REQUIRED.change-edit-no-reason.json | 199 | 45054bd9232b6c5a583d088c277db26e9a93e99e36100bcd522f55d7fff0133f |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-REQUIRED.experience-no-story.json | 129 | 6e5771d4052af304e701a9429dd187042048c3d1a26c85523ddf88ae50e4ca14 |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-REQUIRED.kit-no-about.json | 73 | 855f32063b93249eda437fa3747b9ecd5c1443c119b6936fe8b2cca87b7d80e6 |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-REQUIRED.package-no-members.json | 177 | d2b0eb592534263a707009a27e70a09de9ed309cd6cdbfa850bf32b9c22ddb26 |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-REQUIRED.receipt-no-run.json | 225 | 6299067a735488cf1345c52bda9a7f5ac30d5604b5859ff58297cdaad42157c7 |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-REQUIRED.rule-pack-no-rules.json | 128 | b0dcb58280de551cfb033ddba0a3d1908fe14a1478602ecad7855bad5e2bdb6f |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-REQUIRED.scene-no-drawing.json | 76 | d559a45d2911fb685443f29d39c8cfe25dd700bc70a55a917ce5ad223cff6aa9 |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-REQUIRED.shell-no-slots.json | 81 | b26c4558ba40e698042f21e3a9d70be05b0827a272189d51ccbae6f66b12fa63 |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-UNKNOWN.host-profile-key.json | 124 | c5f4f18a6aa8e147969ef517250bf1176bd7905b0ce77015bedcf0213f28bbea |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-UNKNOWN.limits-safety.json | 145 | 77cc69a6ff501673d3d01417ee18b03e21eb471e225f5c983b788c8b5c83984d |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-UNKNOWN.scene-key.json | 96 | d0a6affe8bf577b4cd660d390713028726b8bd9e66b70ee904e54fda832dc1e7 |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-UNKNOWN.synth-key.json | 270 | 9c71505b673ba950891e6c67c05e2ca2f7188714b53a13336aa327b68fe0695d |
| spec/2.0/schemas/examples/invalid/documents/E-KEY-UNKNOWN.x-key.json | 103 | 3b91be15480fd6965b79a416418b1e1fd2cba525161365bdfe243a527aea748f |
| spec/2.0/schemas/examples/invalid/documents/E-KIT-BODY.blocks.json | 122 | ca15aa2c4002cc0ac89ce07613a5388c78ec8a5544b4bd97b4e73621dc66737e |
| spec/2.0/schemas/examples/invalid/documents/E-KIT-BODY.values.json | 122 | 6550896fa1c770e64d38ccb8b0965928b41de5dc21ce1a341715eaa2a67dac70 |
| spec/2.0/schemas/examples/invalid/documents/E-NEEDS-MISSING.ai-settings.json | 134 | 5f6f58e8bfc5ff92d5cb7776b496da1fafd0fe6eea8d16eb3fac5b6d110b87c3 |
| spec/2.0/schemas/examples/invalid/documents/E-NEEDS-MISSING.drag-velocity.json | 321 | 7d7b343df3bc292b705baefd4b1180aa6d2d6da3aa733ebe516844da5f6da891 |
| spec/2.0/schemas/examples/invalid/documents/E-NEEDS-MISSING.page-settings.json | 113 | 2b4baa3b00eada150f40904c117193ec78d7531099a7d6a472edb77667a0947e |
| spec/2.0/schemas/examples/invalid/documents/E-NEEDS-MISSING.physics-key.json | 118 | 7f982d70d2acc3263973709758bd427d70a8fc04eb2ca264c4a9f470e8c42af4 |
| spec/2.0/schemas/examples/invalid/documents/E-NEEDS-MISSING.snapshot-settings.json | 268 | 01fccc6918345519c2f8b3700f3da91fefc0cda3fbf515170139395d6605032b |
| spec/2.0/schemas/examples/invalid/documents/E-NEEDS-UNKNOWN.json | 113 | cd34044a7909a241ffa949464a497e30a234f8cce3b4c6bf6a84ea854a808416 |
| spec/2.0/schemas/examples/invalid/documents/E-RANGE.limits-above-up-to.json | 145 | a467753ccb557610035308ae6a70e4b52331dc5f51b99a10371fb3427a60bc56 |
| spec/2.0/schemas/examples/invalid/documents/E-RANGE.limits-below-format.json | 107 | 3aa0e02d3034ea77bb8f1689efd5cee9793f010c81c93809f8dbd78f761657a2 |
| spec/2.0/schemas/examples/invalid/documents/E-RANGE.synth-pitch.json | 252 | d210bc1430752c31cf571070e5908eff8d2f527c2d64d3179b647ace20e9fda1 |
| spec/2.0/schemas/examples/invalid/documents/E-RULE.give-way-contrast.json | 260 | ba97b885fb2507d3683ebcaf440c64e6ca7966159639e47d359fc267d37b86b9 |
| spec/2.0/schemas/examples/invalid/documents/E-TYPE.axis-value-without-input.json | 194 | 37af91408993fac74b152e2bb109e701dd04b71170fdfc9f0df55e902ac9d57d |
| spec/2.0/schemas/examples/invalid/documents/E-TYPE.drawing-number.json | 75 | 52b40d69e4fe3be203fb4fabafd0b1dd28f199657e44a9ab253cc5f720875cfc |
| spec/2.0/schemas/examples/invalid/documents/E-TYPE.host-profile-capabilities.json | 91 | 62646aab469f730adf8116b9cec9c56b7c1c02c356018501f23f920d4a5f9947 |
| spec/2.0/schemas/examples/invalid/documents/E-TYPE.play-test-steps.json | 78 | 5ba82413231c7db9401b6327ef0617cc56e798eb7167a63ac588cf50a64d246d |
| spec/2.0/schemas/examples/invalid/documents/E-TYPE.rules-object.json | 96 | 5bbca72269eb16f53f2aeb56a41a4a0f0f3902ebc907edd31b572ae0d93fd410 |
| spec/2.0/schemas/examples/invalid/documents/E-TYPE.synth-wave.json | 255 | 10189b11edfe88c191be3de239b6525ba4f2a5aad2c430fec0cbed710743a4aa |
| spec/2.0/schemas/examples/invalid/drawings/E-A11Y-OWNED.aria.svg | 169 | 31c2498da0d08c10b33ae630b69fcdaa8f99543c4444eb27761444ba96ed779b |
| spec/2.0/schemas/examples/invalid/drawings/E-A11Y-OWNED.tabindex.svg | 167 | 016a5521c8282a0e78734aa791f15643934d1411ca45058e10aaaa4c59056a2e |
| spec/2.0/schemas/examples/invalid/drawings/E-COLOR-ROLE.color-role.svg | 297 | b9d88ad8bda49170c8ecd9d8c212c83a23e8d22e4ba0149a476590c41a0d7b8b |
| spec/2.0/schemas/examples/invalid/drawings/E-ID-DUPLICATE.svg | 176 | ad91c8c2ed6439c742a0e335a1bbd0b619dd639742d2b042ed28d23266cf8961 |
| spec/2.0/schemas/examples/invalid/drawings/E-ID-SHAPE.not-namespaced.svg | 259 | fb17ec30fa4b625a4a6f170779032f3f59d4c1a8b9bb6c794dbddfee2cf91755 |
| spec/2.0/schemas/examples/invalid/drawings/E-ID-SHAPE.part-without-id.svg | 246 | e5e3117eb2d98390e59e8d0be8e83581949763967b087adb896cb10638ef4ea4 |
| spec/2.0/schemas/examples/invalid/drawings/E-ID-SHAPE.screen-double-underscore.svg | 157 | 2d4e7b44c8f3c6c90c4961e2b90ba6771d7f1274fa0f714871a767a4472ef347 |
| spec/2.0/schemas/examples/invalid/drawings/E-KIND.component-in-component.svg | 243 | 5123e5f5b3eb2f47ecf6ba86aa958ba9f29bcc57c6db6e8bcf705e066bd4aea7 |
| spec/2.0/schemas/examples/invalid/drawings/E-KIND.component-transform.svg | 285 | 6a9074d810c45716b458e5ff15f3e8e35df21e9ab75401bda9db794ac0303d91 |
| spec/2.0/schemas/examples/invalid/drawings/E-KIND.root-kind-component.svg | 157 | fd85f523da259cf3b5f281185d05a0069098c6db0981f789bec80b6d6b2a05a8 |
| spec/2.0/schemas/examples/invalid/drawings/E-KIND.two-components.svg | 171 | c7bd60224e5dba946abb9112d9030081e0f4f1798b50a70b147f3ed1dc6148ef |
| spec/2.0/schemas/examples/invalid/drawings/E-KIND.unknown-kind.svg | 260 | 544e3bbcb976ee3d211e0675dcef64b928d0e570aecd1377f0a89d6dd37f3974 |
| spec/2.0/schemas/examples/invalid/drawings/E-LOOK.bad-name.svg | 395 | ec07c0beefd01785166fa98455e2d20d5c0f2cd8b4559d27db087337c3bc454f |
| spec/2.0/schemas/examples/invalid/drawings/E-LOOK.not-in-part.svg | 256 | eea0becf0df5a11effdf8d4daf836d007cb3633e9785a72362fa906d012f90b1 |
| spec/2.0/schemas/examples/invalid/drawings/E-LOOK.one-look.svg | 312 | 843fe9262139a8e477a163ae45cdac08b8df230d4193dcad36ba3d20bc4724ea |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-UNKNOWN.alias-without-a13.svg | 423 | 0a5a8a9d90142219306b098ab9f9d9c3a68f03a0f50d1d83f67f1b984ee29219 |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-UNKNOWN.made-up.svg | 288 | 908ba558adb431028cc2d64f85e2526e6dee9ab5d5f9efa788676dbd946e468c |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-UNKNOWN.page-hook.svg | 295 | b9eaf2600fc30f19a95d725e24398cbb58d8e9490efb2ce614738a7b44bd1940 |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.derived.svg | 174 | c91f37c582962e540eff949cd7f39b46fcefe369f0fc92c6a029c023c0e80bfe |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.fit.svg | 279 | 8a699babfd7e6cfb4c0064e8510a99f0b9b1d81e7a3ffe88d2f0df130cbd8127 |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.follows.svg | 282 | 6a8c914ca7ca3d5a6901f571486058623447dc54dcfb57345ed820d001009953 |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.keep.svg | 227 | a6d35996ea1a8099e61d79188555cb1ddb2180c9f99cc1653e7336b967f1d780 |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.label.svg | 278 | 45fce86fc406bb350cc5d6113cb043b70a0d2b4a39a1eb4461cafb8e0b913b1d |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.motion.svg | 289 | 6f35cea56061ff0155db9e0958a1817ea6838612065db9cae9d4a953220a21b9 |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.paint.svg | 159 | 951a431d3e62d9fdf49562c6740f61a1e3900f57412121c940ed9223b4e9352d |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.pivot.svg | 283 | 2fec65c6d0acffbcb8da5eee5bb77fb36adccdc564b72bc4a281451cf75d2758 |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.role.svg | 286 | 1634f90ba5110d8468df41113e08661505e7fe0ad5a4312ff46eb4e5cd22c82e |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.route.svg | 190 | 83e7a6ff8906a738552943ffd61c40181be86a75633ed52bcc7b8a933d368dea |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.slot.svg | 261 | 5627f9f4e378ec88f62886de522a1860d9aaa3eff42b00d6c239398a512e5e96 |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.steps.svg | 204 | 712ad52f8bb1d3cdec29a0dfad0393b5ca83e4475e626983fe8cd25c36868771 |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.two-sides.svg | 291 | a81af0fc76f907b7be5a1e9255a3a236d8da7971e5aa71c5b56925b6c822718b |
| spec/2.0/schemas/examples/invalid/drawings/E-MARK-VALUE.type-role.svg | 275 | 11fa9cb66c3c387dd17d41be7a82f6050ac33d22ac873bb1ba25fd4ad1e6f51a |
| spec/2.0/schemas/examples/invalid/drawings/E-MOTION-RANGE.rotate.svg | 313 | 23b37950af61f2f193c4ef24b0958f7bcbe50f1f6c837f8b2e70f0ff6a962c82 |
| spec/2.0/schemas/examples/invalid/drawings/E-MOVER-TRANSFORM.svg | 316 | 5cd07299c4d825c0d21e99427f50a62f6af0d4ac1ca9d68ae778b82fa84a567f |
| spec/2.0/schemas/examples/invalid/drawings/E-PIVOT.rotate-no-pivot.svg | 292 | da72b565b617d60852937979d0a6e0ad615eeb66f819d12a5019d832bc8e0032 |
| spec/2.0/schemas/examples/invalid/drawings/E-PLACE.fit-element.svg | 251 | ab1df93fdcafeee2b81eebe10673482d911906c26a1d896278bbc377f0436d2b |
| spec/2.0/schemas/examples/invalid/drawings/E-PLACE.keep-painted.svg | 216 | 3130dcaa61c979bb61a65548100d6713c7403351bd6ab0e8eb8d6b2810c81b7d |
| spec/2.0/schemas/examples/invalid/drawings/E-PLACE.repeat-element.svg | 278 | 559f3d1c26707fbf11227059c14ad2247c5c24618b9cffd0a6ba671df69307e1 |
| spec/2.0/schemas/examples/invalid/drawings/E-PLACE.slot-twice.svg | 319 | 0928a32266738eb00bf39fadea385ca1f76507512ae0b02ade4c2165ed39f843 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-LIMIT.blur.svg | 191 | b221054ce5721549dd992bc4356cf4dc3b779001e7a229fa8021d702d3979e2b |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-LIMIT.octaves.svg | 186 | a52357218e330f3c2e0b8837d09f15cbe1770b50e6494724fb3aa50bebdb4564 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-LIMIT.use-cycle.svg | 179 | 604c8874c55fffb6647fd9c4697859cdf85009fad10487aaef6444d23d7da319 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-PARSE.doctype.svg | 187 | 89c04c3b769ccffc3e657413ea07d82b6b9cfb76e7012ae799016218ac3a561a |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-PARSE.processing-instruction.svg | 151 | 5723173f7e6cfbac2eebb5fc54a27f88311d9d22e626dd9254331d8c0aa3b8c0 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-PARSE.unclosed.svg | 119 | 0f67a552daf4ca30e416a7d8b4b4f6bcc5f74a3f8104b5f493252e8b83561f9d |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-PARSE.unknown-entity.svg | 145 | 37f2c4d5494f33ba5f5cce242239616c4810940478a456627f99f4b76e345407 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-ROOT.no-version.svg | 86 | 8fe74bc2bff00638ff2479062c3dc2be90e07389d093536490ec0703ce266da0 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-ROOT.no-viewbox.svg | 90 | 72bf11d2a27214139d65c906e6672f0f4521aa8a16cbe3e48a454bf2bd4bcdd7 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-ROOT.size-not-viewbox.svg | 133 | 8ddc1a117b5cb2eed4601d3afb0ae1ae88e403a3cce7dfc84ef2ef061aec206e |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-ROOT.slice.svg | 147 | 78e9a8a16352c92d0cdbc9e4d9a30594a597b155c960997254814d2f7cd1c02a |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-ROOT.version-0-1.svg | 110 | e7f273690f40e18897e8adc15c1e40fb1e06a8ca30f18d5cc67950ba90798c53 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-ROOT.version-on-part.svg | 282 | 4f23ff040dd68cd7b09aee6ec93320084b1ccec252dc3b0b0787f9f223fdf0ee |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-UNSAFE.animate.svg | 188 | 7a73b818e5c4becc00b940359131c08828f5604f7b1e9be0845bd5bcd3cec805 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-UNSAFE.foreign-object.svg | 158 | 5286082d3c578e2d0caa51a31fe11ea188ea5430e0b3f3b8e65130f46a1d2b2c |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-UNSAFE.onclick.svg | 168 | e1dd8abba149ed3a817ac50017839b1c0af9de6eaebb124df672f2fcc39d6be4 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-UNSAFE.other-namespace.svg | 199 | 6eb3368f98e0991b61698d8a02b3f60074494a6fca7fec66c0daa3b8edf20bb1 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-UNSAFE.remote-image.svg | 188 | b5907d41c58d2fa5e0bd03de67505b55719ca1b311f55023be3fbe0c0a7a59db |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-UNSAFE.remote-url.svg | 189 | 2d512a06673ae11a23ee2ecc222f47c1e355b81d936bb338b4e56216a02824ea |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-UNSAFE.script.svg | 144 | 38c8a1bfe74f8722a31ea0784f84b3365d84f2941f8a106165d2277f5cdad220 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-UNSAFE.style-import.svg | 172 | 7d2f4dfd17025bf65fc42f891ab5cc3fd9ee8b7fab41ecfb47105d056a14c64d |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-UNSAFE.style-position.svg | 178 | f28001b77487a7908e58ccf33eaef68330c494915179210082e8e020b073dd86 |
| spec/2.0/schemas/examples/invalid/drawings/E-SVG-UNSAFE.unknown-attribute.svg | 177 | ee75200f964ef613f0ff36893378db39adaa83f8e209c3c473eb974503ab4920 |
| spec/2.0/schemas/examples/invalid/drawings/E-WORD-RENAMED.anchor.svg | 286 | 9b46d42f118146f0a694543d3836af3e4d190bbe8e8843ec03677769e1501428 |
| spec/2.0/schemas/examples/invalid/drawings/E-WORD-RENAMED.icon.svg | 305 | 94dd95f18855b94484caa85143ea8d755a77ce47074da90a354d6f556b34945c |
| spec/2.0/schemas/examples/valid/documents/capability.json | 224 | aa0fb65cd6176da8b6583ff7f018adffcd4c04cc8147058fdb76b840fe48bcda |
| spec/2.0/schemas/examples/valid/documents/change-play.json | 257 | e80478d5ac16d2fd51077a27084c4e1b03d52402a2edd1341b53040b56d8706b |
| spec/2.0/schemas/examples/valid/documents/change.json | 360 | d1d864adec34547ae1800d69b61e0b79c4ec1a9c4a3fa300da369d05bad4b8ec |
| spec/2.0/schemas/examples/valid/documents/component-compound.json | 116 | 2e2d8fa0550a572bc712587be6fa414f14e80f0fc61d94f574799411ce9191e8 |
| spec/2.0/schemas/examples/valid/documents/component.json | 568 | 08390c81a8325da325db7f0318ea93fb610612b827dd7593814b298628bc1b55 |
| spec/2.0/schemas/examples/valid/documents/experience-axis-input.json | 199 | 4086da6adc1c6aa04493ff90506843d8e5f459e25a3b812091b6ae7e82cb18b1 |
| spec/2.0/schemas/examples/valid/documents/experience-kit.json | 260 | 506f2b3efef483d22ee16d1a61558bd1bb672e26c441d96b60154dd87cb9c06b |
| spec/2.0/schemas/examples/valid/documents/experience-limits.json | 362 | 776f5d2694ae0a083274576ae8cfb70a987e85581251b1c8551ff2602946cb0d |
| spec/2.0/schemas/examples/valid/documents/experience-page.json | 330 | 30c5df32ad475b36168313978cdca060a2fa90707254617d8a1114560fba1338 |
| spec/2.0/schemas/examples/valid/documents/experience-roles.json | 455 | cb3b1ff8ad4cdc863edb6139875f9c789a05771281d4eeb82ba480af3c1d5245 |
| spec/2.0/schemas/examples/valid/documents/experience-seats.json | 493 | d6af3b321073946b12245c71615b9126473fb124a58b4a81773750129d677f3d |
| spec/2.0/schemas/examples/valid/documents/experience-synth.json | 345 | 228bad4d5a95d4b8dbbc44e6701c5d0aca3a558d8bbc232df19d31c531eafb9c |
| spec/2.0/schemas/examples/valid/documents/experience.json | 253 | b7ba73e08956f35bfe5e026792904244ff17304d35449790a5442ac270d2a5f9 |
| spec/2.0/schemas/examples/valid/documents/host-profile-limits.json | 259 | 8a510c569bdc1add8baf4fee93a84fbff8f116675aaae8130e1d92bd4c5169d7 |
| spec/2.0/schemas/examples/valid/documents/host-profile.json | 151 | f5ee70baf9d4c586c64b24dae517a32b6c353a7db43faede77b54672a08d04b4 |
| spec/2.0/schemas/examples/valid/documents/kit.json | 151 | 6f44f5315f49ce6a7eeefc3f496d003210e2cdcc6caa0cf72ea13872f4bd677a |
| spec/2.0/schemas/examples/valid/documents/package.json | 203 | 2cb95df5569663e588281fc107a0ba51836bf06e7d0bef0005507c9658a9164d |
| spec/2.0/schemas/examples/valid/documents/play-test.json | 93 | 8a5ff3350024f7f468fd1f27d832e4b764fcb82e1c058bb175123b44046d0805 |
| spec/2.0/schemas/examples/valid/documents/receipt.json | 267 | 35a53a31ee4e7e5aa5e881f56c73f4d573b863a8422c73982e22234708824b79 |
| spec/2.0/schemas/examples/valid/documents/rule-pack.json | 252 | 67c8d782a3ae2deb0aa1a6bf8bd7127ea04c1d95278262f38671e703d323a11e |
| spec/2.0/schemas/examples/valid/documents/scene-flat.json | 170 | 78a57c8c851cf86fd43e2cb9ffb6cb9da8f1910f82721d4ade466295c22027ac |
| spec/2.0/schemas/examples/valid/documents/scene-inherited-needs.json | 369 | a1d33629bd109a4ef5d349191a2f36cbe1d3b4c3580cc9ad500c4eb77d423688 |
| spec/2.0/schemas/examples/valid/documents/scene-physics.json | 572 | 221d23cf42fdaeddb30730573926ba1d80987c2d234efb284039dc63728fa5c8 |
| spec/2.0/schemas/examples/valid/documents/scene.json | 289 | 9c5306252ffc6ada5ef3d6ddf08aa4245660e9222ffeeade867b6a4728816d97 |
| spec/2.0/schemas/examples/valid/documents/shell.json | 164 | 9ece70ef1e6c5755c7a7c298b5ccb0f34f50d89ca21ec217fbb6572f110e4d47 |
| spec/2.0/schemas/examples/valid/drawings/W-KIND-MISSING.role-without-kind.svg | 269 | 08e1dbcb00de5ff3316392bfb9ed030424d9aa1ebf839a94d159337dc79ceedd |
| spec/2.0/schemas/examples/valid/drawings/W-MARK-ALIAS.look-alias.svg | 423 | 0a5a8a9d90142219306b098ab9f9d9c3a68f03a0f50d1d83f67f1b984ee29219 |
| spec/2.0/schemas/examples/valid/drawings/component-all-marks.svg | 2013 | 5921f64ac2a65d22b0c8d110eeaf2fbc2fe42ee3576c65f629fbbb8e9695927d |
| spec/2.0/schemas/examples/valid/drawings/component-button.svg | 391 | 3d3cf43f3da0ae9c6bd29e82118d66842dafc0d72770b591ebfa41977eec328e |
| spec/2.0/schemas/examples/valid/drawings/compound.svg | 392 | d70c4a31f5dfc4cbb3f3a14793fcd788770f0c2883bf3826168e36184b93b1ef |
| spec/2.0/schemas/examples/valid/drawings/screen-exact-size.svg | 247 | aceb6c6ceed4c01e2dc1b4313aeb4d88047e871785484530c59d456259b728f7 |
| spec/2.0/schemas/examples/valid/drawings/screen-placed-copy.svg | 329 | 02e09ebc9221b53485c96534b421c661a9aac132ba8c295bf167cae39d729b1e |
| spec/2.0/schemas/examples/valid/drawings/screen.svg | 1981 | 6ff7fa83e46c65cd036e7e269d485a6dc7b64a047b6ee6d25e38e45e3dbc7264 |
| spec/2.0/vocabularies.json | 63506 | d37697ba9be7687d981b6be2b5a1be42a1541ef157a6d1c172db8aa71ddedf42 |
