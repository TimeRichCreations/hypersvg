# The tool reference

For people who build editors, hosts, packers and checkers. The core spec (chapters 1 to 12) is enough to write an
experience; nothing here is needed for a first one. These chapters say what tools read and write around the core:
editing rights and change requests, receipts and play tests, packages and host profiles, the checker's rule language,
kits and libraries, publishing and the upgrade tool.

| Chapter | What it holds |
|---|---|
| [A8. Checking](a08-checking.md) | receipts and evidence, scores, pressure cases, play tests |
| [A9. Editing and trust](a09-editing-and-trust.md) | the rights table, checking a change, the trust record, seals, promoted inputs, editor rights, the changes protocol |
| [A10. Hosts, packages and exports](a10-hosts-and-packages.md) | host profiles, packing for a host, budgets, the frame link, packages, served play, conformance levels, raising limits |
| [A11. Rules](a11-rules.md) | the checker's rule language: rules, rule packs, strengths, waivers, precedence, guarantees, proof kinds, rule kinds |
| [A12. Publishing](a12-publishing.md) | the open-only test pass and the publish leak check |
| [A13. Migration](a13-migration.md) | the upgrade tool's manual: from `hsvg/0.1` and SVG 1.x, and the one rename table |
| [A14. Kits and libraries](a14-kits-and-libraries.md) | kits, versions and pins, catalogues, pick-and-use, kit experiences, variations |

**Labels.** The labels A8 to A13 are the old reference chapters' labels, kept so that the registries (`errors.json`,
`limits.json`, `documents.json`) stay valid. A1 to A7 now name the add-on pages (`../capabilities/README.md`). A
section moved here from the core keeps its old number in its heading, as "(was 9.10)", and each core chapter ends with
a table of what left it. The old files in `../addons/` are stubs that point here (the schema tools read their first
line).

**Section numbers moved from the core.**

| Was | Now |
|---|---|
| 4.6 Seals, 4.7 Promoted inputs | A9.4, A9.5 |
| 4.8 Kits and versions, 4.9 Kit experiences, 4.10 Variations | A14.1, A14.2, A14.3 |
| 8.1 to 8.9 | A11.2 to A11.10 |
| 9.8.1 Raising limits | A10.8 |
| 9.9 Editor rights, 9.10 The changes protocol | A9.6, A9.7 |
| The frame link (10.6), 10.8 Packages, 10.9 Run served, 10.10 Conformance levels | A10.4, A10.5, A10.6, A10.7 |
