# Custom HTML widgets (2.1 draft)

This is a 2.1 draft. It is not part of HyperSVG 2.0: no 2.0 engine, checker or schema reads it as grammar. A 2.0
file that uses what it describes is refused (`E-DRAFT`, "not in 2.0; a 2.1 draft"), and the message names this draft.

The keys: a shell use's `custom` and `fallback`, and the `widgets` grant with its `set`, `emit`, `read` and `listen`
lists. In 2.0 the `widgets` add-on draws declared widgets only (`capabilities/widgets.md`).

**Custom HTML widgets** are written by the host, never by content. The shell only reserves the place.

```json
{"id": "lead-form", "custom": "crm-lead-form", "into": "side-panel", "fallback": {"use": "contact-card"}}
```

- The host registers an implementation under that name (host code, or reviewed capability code). **[review]**
- It reaches the experience only through the host API (10.6), limited by the `widgets` grant for that name: the inputs
  it may set, the triggers it may fire, the outputs it may read or hear. Its writes are changes with source `widget`
  (A9.7). **[playing]**
- A `widgets` grant is always optional and never needs listing in `optional`: without the implementation or the grant, the slot shows its `fallback` SVG
  widget (a use without `into`), or stays empty. The experience
  must still work. **[review]**
