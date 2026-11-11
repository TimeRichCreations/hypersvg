# Logic modules

A logic module is reviewed code the host provides (10.7, A9.3). Content never carries code. It names a module in
`needs` with its exact version, pins its digest in `about.trust.pins`, and calls its exports with the `call` action.

```json
"needs": ["chess@0.1.0"],
"about": {"trust": {"pins": {"chess@0.1.0": "sha256:…"}}},
"entry": [{"id": "legal", "call": "chess.legalMoves", "with": {"position": "position"}, "to": {"moves": "legal"}}]
```

## Files

| File | Does |
|---|---|
| `chess/chess.mjs` | The chess rules: the reviewed code. Pure, imports nothing, names no global |
| `chess/index.mjs` | The module record: name, version, exports (the manifest beside the spec), digest. Importing it registers it |
| `chess-opponent/` | A seat program (A4.1): `choose({view, legal})` returns the key of one legal entry. The seats capability runs it; content never calls it. It is pinned in `about.trust.pins` and listed in the lock, and is not yet in the spec's registry |
| `lock.json` | The reviewed lock of this engine's own hosts (the checker, the packer, test hosts) |
| `make-lock.mjs` | Writes `lock.json` and each `index.mjs` digest line. Run it after a reviewed change |
| `../src/modules.mjs` | The call action, admission and the confined executor |
| `../src/host.mjs` | `modulePort({lock, maxMs, maxSteps, clock})`: the host's module port |
| `../check/modules.mjs` | `E-MODULE-CALL` and `E-MODULE-REVIEW` on files |

A module's digest is SHA-256 of its code file with LF line ends, so Windows and Linux checkouts agree.

## Run

```sh
node engine/v2/modules/make-lock.mjs          # after a reviewed change to a module's code
node engine/v2/modules/make-lock.mjs --check  # exit 1 when the lock or a digest line is stale
```

A host serves a module like this:

```js
import 'engine/v2/modules/chess/index.mjs';             // registers the module
import { modulePort } from 'engine/v2/src/host.mjs';
mount(el, pkg, { capabilities: { chess: modulePort({ lock: { 'chess@0.1.0': 'sha256:…' } }) } });
```

A packed page is its own host. The packer bundles a module only when `needs` pins it, and gives the page a lock that
lists exactly the modules it carries.

## When a module runs

At mount, a module installs only if all of these hold. Else the mount faults.

1. `needs` names it (`chess@0.1.0`), and the experience's `about.trust.pins` pins that name (`E-MODULE-REVIEW`).
2. The pin is the module's digest (`E-MODULE-REVIEW`).
3. The host's reviewed lock lists the same digest (`E-MODULE-REVIEW`).
4. The host's port was made by `modulePort` (`E-MODULE-CONFINEMENT`). The port holds a lock and limits, never code.
   The executor is always made by `src/modules.mjs`, so a host cannot hand in one that does not confine.

A call checks, in order: the export exists and `with` and `to` match it exactly (`E-MODULE-CALL`); the inputs fit
the export's `with` schema; the module runs within its budgets; the result fits `returns`; every output fits the
value it goes to. Only then are the outputs written. Any failure faults the transaction with no partial output
(`E-MODULE-RESULT`).

## Trusted code, not a sandbox (D26)

In 2.0 a module is trusted code. It runs in the page, in the engine's own realm. It is admitted only by its
fingerprint (the digest of every file it runs, imports included) and the host's grant (the reviewed lock), with a
step budget kept per player. Nothing isolates it at run time. Real isolation (a worker or similar, a hard time
limit) may come in 2.1 or later as an engine-internal hardening, with no format change (D40).

## What "confined" means here

"Confined" means reviewed and budgeted, not isolated.


- The module's code imports nothing and names no global: no page, storage, network, clock or random source. A fast
  test reviews the source for banned names, `try` and `catch`. Another runs it in a fresh Node context with no
  globals, not even `Date` or `Math`, and gets the same answers.
- `make(step)` gets only `step`, the executor's counter. The module calls it once per unit of work (a square looked
  at, a move made). This is coarser than "one instruction".
- Each call gets a deep-frozen copy of its checked inputs. The result is copied out with `structuredClone`, so a
  function or a shared object cannot leave.
- The executor stops a call by throwing from `step` once the step budget (`budgetSteps`, default 10,000,000) or the
  time budget (`budgetMs`, at most 1000) is spent. It reads its own clock every 1,024 steps. Once stopped, every
  later `step` throws again, and the result is thrown away even if the module caught the stop.
- The time budget also holds for a module that never calls `step`. Before a module runs, its loader adds a time
  check, `__hsvgTick()`, to every loop condition and function body (`tools/meter.mjs`): the packer for every logic
  module in a page, and `tools/addons.mjs` for an outside module loaded in Node. The check counts no step; every
  1,024 checks it reads the clock and stops the call as `step` does. A module may not use the name `__hsvgTick`.
  A built-in module imported directly in Node (`import './chess/index.mjs'`) is not rewritten: there only `step`
  checks the budget.
- In a packed page an outside module's files run in strict mode, in a scope where every name the module does not
  declare reads as undefined, except the language's plain objects (`Math`, `JSON`, `Object`, `Array` and the like)
  (`tools/pack.mjs` bundle). This shuts out the page's names. It is not isolation.
- A host may set smaller budgets (`maxMs`, `maxSteps`), never larger.
- Work in `make` itself, outside a call, is refused at mount.

## Planned for 2.1: isolation

A 2.0 host does not have these. They are analysed in 2.1:

- Run the module in a realm of its own (a worker, a sandboxed frame or WebAssembly) with no host objects, so review
  is not the only guard against globals.
- A stop the module cannot catch or delay (WebAssembly fuel, or terminating a worker), and a memory cap.
- Count real instructions, not the module's own `step` calls.
- Check the digest of the bytes it actually loads against its lock, at load time. (In 2.0, `tools/addons.mjs`
  loadAddons does this for outside modules in Node, and the packer for a packed page.)

## Seat programs

A program fills a player seat (A4.1). It is a module like any other: reviewed code, a digest, a lock entry. The
experience names it in the seat's `program` key and pins it in `about.trust.pins`; the host's reviewed lock is the
seats port, made by `modulePort` (`mount(..., {capabilities: {seats: modulePort({lock})}})`). The seats capability
loads it in its own confined executor and calls `choose` with the seat's view and legal list. A program that is not
pinned, not in the lock or not served faults with `E-MODULE-REVIEW`, and its seat forfeits. A packed page does not
carry programs yet (the packer bundles only modules in `needs`).
