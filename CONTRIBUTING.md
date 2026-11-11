# Contributing to HyperSVG

Thank you for helping. This page says how to run the checks, what the rules are and how to propose an add-on.

HyperSVG keeps drawing in SVG and decisions in JSON. An experience holds no program code. Only the engine
(`engine/v2`) runs JavaScript in the page.

## Run the checks

You need Node 20 or later and nothing else for the main checks:

```sh
node .github/workflows/checks.mjs
```

This runs the main job of CI, in a few minutes, with no browser:

- the leak check on every file (no keys, no private paths, no secret files);
- the fast tests of the engine, and the leak tests;
- `hsvg check` and `hsvg pack` on `docs/one-page/example`;
- `hsvg check` on every door example (see `EXTENDING.md`);
- the `hypersvg` command (`bin/hypersvg.mjs`): `--version`, `init`, `check` and `pack`.

CI has a second job, the browser check (`.github/workflows/checks.yml`, `browser-consumer`). It packs the npm
package, installs it in an empty folder and plays the lamp in Chromium: several players on one page, the keyboard,
the host API and a packed page. To run it yourself, install Playwright outside this folder and point `PW_PATH` at it:

```sh
PW_PATH=<folder with node_modules/playwright> node release/browser-smoke.mjs
```

The engine's own browser suites are listed in `engine/v2/README.md`; run them one at a time.

One part at a time:

```sh
node release/checks.mjs --suite engine                    # engine/v2 fast tests
node --test release/leak.test.mjs                         # the leak check
node bin/hypersvg.mjs --help                              # the one command
node engine/v2/tools/check.mjs docs/one-page/example      # check one experience
node engine/v2/tools/pack.mjs docs/one-page/example out/  # pack it into an Experience (one HTML page)
```

Some tests print `OMITTED` with a reason. They need material that is not in this repository: an add-on
(`release/addons-tests.json`; they run with the add-ons), a skill, kit, library or showcase example
(`release/lean-tests.json`; they run in those repositories) or private material (`release/public-omissions.json`). An
omitted test did not run. Never mark a failing test as omitted to make the checks pass.

## The rules

1. **No dependencies.** The engine is plain JavaScript (ES modules). Tools use only Node's standard library. No npm
   packages, CDNs, web fonts or network requests at run time.
2. **Windows-safe paths.** Build paths with `path.join` and `fileURLToPath`, never by joining strings. Every script
   must run on Windows and Linux. File names must be portable: no reserved names (`con`, `nul`, ...), no names that
   differ only in case.
3. **Tests.** A change to behaviour comes with a test that fails without it. Keep the fast tests fast: no browser,
   no network. Run the checks before you open a pull request.
4. **Plain docs.** Write in short, plain sentences. Say what a thing does and how to run it.
5. **No secrets.** Never commit keys, tokens, passwords, `.env` files or paths to your own computer. The leak check
   refuses them. A test that needs a fake key builds it from pieces, so the file itself holds none.
6. **Only what the base needs.** The base holds the format, one tiny example per door and the guide. It holds no
   built-in capability. Skills, the kit, templates, the component library and showcases live in their own
   repositories.

## Where things are

| Folder | What |
|---|---|
| `spec/2.0/` | The core spec, the tool reference (`reference/`) and drafts of later versions (`drafts/`, not in the npm package) |
| `engine/v2/` | The engine (player, checker, packer), its tools and tests, and the add-on door's examples (`engine/v2/addons/`) |
| `bin/` | The one `hypersvg` command of the npm package |
| `docs/guide/examples/` | The guide's examples; the lamp is the starter of `hypersvg init` |
| `docs/one-page/example/` | A small story example, used by the checks |
| `docs/browser-embedding.md` | How to put a HyperSVG in a web page |
| `skill/2.0/examples/` | Two door examples: a component (`kinds/infographic`) and representations (`recipes/orientation`) |
| `release/` | The leak check, the checks CI runs, the browser smoke test and the export's own records |

## Propose an add-on

An add-on adds to HyperSVG through one door: spec chapter 12, "Writing an add-on"
(`spec/2.0/12-writing-an-addon.md`). There are three kinds: a preset, a logic module and a capability.

1. Read chapter 12 and its worked examples (`engine/v2/addons/examples/`).
2. Make one: `node bin/hypersvg.mjs addon new <preset|module|capability> <owner.name>`. It writes a working
   add-on with a manifest, a README and a test.
3. Check it: `node bin/hypersvg.mjs addon check <add-on folder>`, and run its test.
4. Use it in an experience: name it in `needs`, then pin it with `node bin/hypersvg.mjs addon pin <experience folder>`
   after you have read its files. Its code runs in `test` only with `--allow <owner.name>`.

Your own add-on can live in your own repository. To propose one as an official add-on, open an issue first. Say what
it does, which kind it is, who needs it, what it asks the host for (grants) and how it is tested. Official add-ons
live in a separate repository, `hypersvg-addons`. Each has its own version and a tier, stable or experimental, that
the maintainers approve.

A change to the door itself, or a new core word, needs a spec change first. Open an issue to discuss it.
