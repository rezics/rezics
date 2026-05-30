# `package/ui/src/config/` — design-token consumption surface

Three files together define how every consumer references rezics design tokens:

| File | Role |
| --- | --- |
| `tokens/colors.ts` | The single source of truth — `lightColors` and `darkColors` objects shaped as the unified rezics + shadcn-32 token tree. |
| `uno-config.ts` | The **only** consumer-facing surface. `theme.colors = lightColors`; UnoCSS preset-wind4 emits each leaf as a flat `--colors-<path>` custom property under `:root, :host`. A `preflights[]` entry emits `.dark { --colors-*: … }` from `darkColors`, plus the static `--font-*` / `--radius-*` / `--shadow-*` / `--duration-*` / `--easing-*` / `--state-*-opacity` tokens. The shortcut layer exposes curated short utility names (`text-primary`, `bg-surface-elevated`, `border-border-whisper`, `fill-brand-fill`, …). |
| `base.css` | Global base styles + `:lang()` CJK font-stack routing (`--font-sans-cjk` / `--font-serif-cjk`). Not a token surface. |

## Consumption rule

Application code SHALL consume tokens via the curated short names exposed by `uno-config.ts` `theme.colors`. R9 in `bun run check:convention` bans every `var(--rezics-*)` reference in source files (`.css`, `.ts`, `.tsx`, `.js`, `.jsx`, `.mdx`); the `--rezics-*` namespace is retired in favor of the single-source flat `--colors-*` cascade. R9 also asserts that `package/ui/src/config/tokens.css` does not exist.

For raw CSS and inline style cases, reference the flat tokens directly (`var(--colors-text-primary)`, `var(--shadow-modal)`, etc.). When ≥3 callsites share an inline-style need, prefer promoting it to a UnoCSS shortcut in `uno-config.ts`.

## Mode switching

Dark mode is class-based: set `class="dark"` on `<html>`. The `.dark` selector in the preflight overrides `--colors-*` with `darkColors` values; `dark:` UnoCSS variants resolve through the same selector (`dark: 'class'` in the config).

## Adding or removing a short name

Add or remove a curated short name by editing the `shortcuts` layer and `theme.colors` tree in `uno-config.ts`; the leaf must exist in `tokens/colors.ts` (`lightColors` / `darkColors`) so the `--colors-*` cascade resolves. `bun run check:tokens` enforces token consistency.

## Where to look first

- Need a text color? → `theme.colors.text.{primary, secondary, tertiary, disabled, brand, on-brand}`.
- Need a surface? → `theme.colors.surface.{canvas, base, elevated, subtle, sunken, container, container-low, container-high, container-highest, container-lowest, variant, tint}`.
- Need a brand color? → `theme.colors.brand.{fill, hover, active, text, container, on-container}`.
- Need a status color? → `theme.colors.semantic.{success, warning, error, info}.{fill, text, container, on-container}`.
- Need a sentiment color (vote / poll)? → `theme.colors.sentiment.{positive, negative}.{fill, text}`.
- Need a border? → `theme.colors.border.{whisper, defined, strong, focus, error}`.
- Need a shadcn role? → top-level `theme.colors.{primary, secondary, accent, muted, card, popover, destructive, input, ring, background, foreground}`, each with `DEFAULT` and (where applicable) `foreground`.

The full list lives in `tokens/colors.ts`. If a needed token is missing, the answer is to extend the surface — not to bypass it.
