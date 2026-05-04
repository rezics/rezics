# `package/ui/src/config/` — design-token consumption surface

Three files together define how every consumer references rezics design tokens:

| File | Role |
| --- | --- |
| `tokens/` + `tokens.css` | The token table. Three tiers: `--rezics-ref-color-*` (raw palette), `--rezics-sys-color-*` (semantic system roles), `--rezics-color-*` (deprecated 11-name aliases retained only as `@deprecated` until the legacy-alias-deletion follow-up lands). |
| `uno-config.ts` | The **only** consumer-facing surface. `theme.colors` exposes curated short names (`text-primary`, `bg-surface-elevated`, `border-border-whisper`, `fill-brand-fill`, …) that resolve to `var(--rezics-sys-color-*)`. |
| `base.css` | Global base styles. Not a token surface. |

## Consumption rule

Application code SHALL consume tokens via the curated short names exposed by `uno-config.ts` `theme.colors`. The following are R9 violations enforced by `bun run check:convention`:

1. **Long-form utility classes** — `text-rezics-color-text-primary`, `bg-rezics-color-surface-elevated`, etc.
2. **Raw `var(--rezics-…-color-…)` in className contexts** — `text-[var(--rezics-sys-color-text-primary)]`, `cn("border-[var(--rezics-color-border-whisper)]")`, etc.
3. **Deprecated 11-name generation references** — `rezics-color-fg`, `rezics-color-bg`, `rezics-color-primary`, `rezics-color-secondary`, `rezics-color-accent`, plus their `-muted` / `-canvas` / `-elevated` / `-hover` / `-selected` variants.

Inline `style={{}}` references to `var(--rezics-sys-color-*)` are permitted (SVG `fill`, gradient stops in `style`, etc.) — these don't go through the className utility surface. When ≥3 callsites share an inline-style need, prefer promoting it to a UnoCSS shortcut in `uno-config.ts`.

## Adding or removing a short name

`uno-config.ts` `theme.colors` is governed by [`openspec/specs/ui-component-foundation/spec.md`](../../../../openspec/specs/ui-component-foundation/spec.md). Additions and removals require an OpenSpec change updating that spec.

## Where to look first

- Need a text color? → `theme.colors.text.{primary, secondary, tertiary, disabled, brand, on-brand}`.
- Need a surface? → `theme.colors.surface.{canvas, base, elevated, subtle, sunken, container, container-low, container-high, container-highest, container-lowest, variant, tint}`.
- Need a brand color? → `theme.colors.brand.{fill, hover, active, text, container, on-container}`.
- Need a status color? → `theme.colors.{success, warning, error, info}.{fill, text, container, on-container}`.
- Need a sentiment color (vote / poll)? → `theme.colors.sentiment.{positive-fill, positive-text, negative-fill, negative-text}`.
- Need a border? → `theme.colors.border.{whisper, defined, strong, focus, error}` or `theme.colors.outline.{DEFAULT, variant}`.

The full list lives in `uno-config.ts` `theme.colors`. If a needed token is missing, the answer is to extend the surface (and update the spec) — not to bypass it.
