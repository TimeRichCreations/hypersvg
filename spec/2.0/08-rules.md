# 8. Rules

A **rule** says what must always hold. Rules are the third face of a block (1.4). A first experience needs none.

Rules are invariants only. Something that happens on an event is a **reaction** (section 5), never a rule. A rule
never changes a value, never runs code and never draws.


**Rules are the checker's.** A file may carry `rules`, `rulePacks` and `waivers`. The checker reads them; the player
does not run them while playing, except give-way rules through the `ladder` add-on (its page comes with the add-ons release). The
rule language (what a rule is, where it attaches, rule packs, strengths, waivers, precedence, guarantees, proof kinds
and rule kinds) is in the tool reference, A11.

**The format's own constraints are not rules.** Safe content (2.11), the closed set of keys (2.1), one writer per
property (9.3), unique ids (2.9), "words never decide" (5.8) and graph validity (3.9) always hold. They appear in no
rules face, and nobody can waive them.

## Moved out of this chapter

| Was | Now |
|---|---|
| 8.1 to 8.9 | The tool reference, A11.2 to A11.10 (`reference/a11-rules.md`): section 8.n is A11.n+1 |
| Give-way rules while playing (in 8.4) | The `ladder` add-on (its page comes with the add-ons release) |
