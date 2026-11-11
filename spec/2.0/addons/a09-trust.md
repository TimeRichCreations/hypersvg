# A9. Trust and editing

Moved. This reference chapter is now [`reference/a09-editing-and-trust.md`](../reference/a09-editing-and-trust.md), in the tool reference.
This file stays only because the schema tools read the first line of each file in this folder.

One rule is kept here for the tests that read this file: logic modules and add-on code are
trusted code, not a sandbox (D26). A module runs in the page, admitted only by its fingerprint and the host's grant, with a step budget
per player. Real isolation is planned for 2.1.
