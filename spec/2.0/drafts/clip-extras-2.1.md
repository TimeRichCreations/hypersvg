# Clip extras (2.1 draft)

This is a 2.1 draft. It is not part of HyperSVG 2.0: no 2.0 engine, checker or schema reads it as grammar. A 2.0
file that uses what it describes is refused (`E-DRAFT`, "not in 2.0; a 2.1 draft"), and the message names this draft.

These clip keys were in the 2.0 text but never built (P1, "Words that look built but are not"). In 2.0 a clip has its
keys, `loop`, `loopMode`, `speed`, `lane`, `reducedMotion`, `tracks` and `markers` (6.7), and each channel has one
writer (9.3).

| Clip key | Meaning |
|---|---|
| `blendMs` | Blend numeric channels from the current pose when replacing; 0..10,000, default 0 |
| `frameRate`, `holdFrames` | Optional key grid 1..240 per second; hold each sample for `holdFrames` frames of that grid, 1..120 |
| `timeRemap` | Optional `[[timeMs, sourceMs], ...]` from 0, `timeMs` rising; linear between pairs; the last `timeMs` equals `durationMs`. At play time `timeMs` the clip shows its keys at `sourceMs`. Poses only, never extra markers |

- `composite` is `replace` (default) or `add`; `add` is allowed on translate, rotate, scale and opacity only. Tracks
  with `add` may share a channel with one `replace` writer: offsets and angles are summed, scale and opacity are
  multiplied. Two `replace` writers on one channel are refused. `E-WRITER` **[files]**
- `wiggle: {amplitude, periodMs, seed}` adds seeded smooth noise to a numeric channel: at cell
  `k = floor(t / periodMs)` the value is `(mix(seed + k) / 2^32 × 2 − 1) × amplitude` (`mix` of 5.6.5 takes one
  number, so the sum is formed first), joined between cells by
  smoothstep; `amplitude` is at least 0 and inside the channel's range, `periodMs` 16..60,000; any time and seed give the same
  sample. **[playing]**
