# Content options and the seed selector (a 2.1 draft)

Not part of HyperSVG 2.0. Decision 5 after R2 took them out of 2.0; neither was built. The content axis keeps
**tiers** (short, medium, rich; 7.9). A 2.0 file that uses one of these is refused with `E-DRAFT` ("not in 2.0; a
2.1 draft"), and the message names this file.

| Use | Path in the message |
|---|---|
| A content value written as `{"options": {...}}` (an `initial`, or a value in a `with`) | `inputs.<name>.initial`, `with.<name>` |
| An `axes` entry with `"select": "seed"` | `axes[i].select` |

The rule kind `seeds` ("every option a seed can pick keeps every rule") and the mount option `seed` went with them.

The text below is the 2.0 draft text, kept for 2.1. Section numbers point to the 2.0 spec.

## Content options

A **content option** is a named alternative set of wordings for a field, for an A/B test or a campaign choice:

```json
"message.headline": {
  "options": {
    "fresh": { "medium": "Fresh sourdough, delivered warm", "short": "Fresh sourdough" },
    "warm":  { "medium": "Warm bread at your door by 8", "short": "Warm bread by 8" }
  }
}
```

- An option is chosen by a `content` entry in `axes` (here `headline-test`, by seed).
- Every option has the same fields and the same required meaning (7.1).
- Content written at a use (a kit experience's own words) wins over the options. New content never falls back to older
  copy.
- A content option never changes colours or layout.
- The checker checks every content option a seed or person can pick.

## The seed selector

| Selector | Who picks | When | Example |
|---|---|---|---|
| `seed` | the experience's seed, the mount option `seed` (10.6) | at mount, deterministic | an A/B test of two headlines |

```json
{ "axis": "content", "id": "headline-test", "select": "seed", "subject": "field:message.headline",
  "options": ["fresh", "warm"] }
```

- **Order of choosing.** `person`, `host`, `input`, `seed`, then `space` last.
- **Seeds.** The experience's seed is the host mount option `seed` (10.6): an integer, default 0. A seed picks option
  `mix(seed + p) % n` of an entry's `n` options, with the mixer of 5.6.5, where `p` is the zero-based position of the
  entry in the merged `axes` list (the kit's entries, then the kit experience's); the options of a map are ordered by
  id. Every option a seed can pick is proven before publishing (rule `seeds`). The option picked is recorded in the
  receipt's `selected.options` (A8.3) so results can be compared. A host may fix the option for a viewer instead
  (`host` selector).
- **The rule `seeds`** (in `hsvg-baseline`): every option a seed can pick keeps every other rule. Proof: files, playing.
- **Served play.** The server picks content options by seed, viewer group or data.

In 2.0 an A/B test is two kit experiences (or two packages) with different content; the host picks which one to mount.
