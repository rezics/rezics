## Why

The current rezics design token system carries the duplicate-namespace scar tissue from two prior partial migrations (`complete-rezics-token-system`, `migrate-to-theme-config-classes`). Concretely:

- `package/ui/src/config/tokens/colors.ts` defines `lightColors` / `darkColors` as TypeScript constants, but **no runtime consumer reads them** — they are dead at runtime.
- `package/ui/src/config/tokens.css` (~660 lines) hand-writes the runtime token namespace under `.theme-rezics`, including ref / sys / comp tiers, shadcn flat slots, and 11 deprecated aliases — duplicating what the TS modules already express.
- 558 occurrences across 42 files reference `var(--rezics-*)` directly. Most of these come from the legacy long-name cascade and have no architectural reason to carry the `--rezics-` prefix once we own the entire variable namespace.
- `unocss-preset-shadcn` is loaded purely to handle 4 keyframes and 32 CSS variable slots; its `themeCSSVarKeys` filter silently drops any extra key, which is the original technical reason the parallel `--rezics-sys-color-*` namespace was introduced.

The user's intent for the design system has been clear and consistent: **one source, flat names, shadcn-compatible by inclusion, rezics identity in values not prefixes**. The implementation diverged because each prior change scoped itself too narrowly. This proposal collapses the entire stack into a single TypeScript source and lets UnoCSS preset-wind4's built-in theme→CSS-var generator do the work.

## What Changes

- **BREAKING** Repurpose `package/ui/src/config/tokens/colors.ts` as the **single, canonical** token source. Light + dark are exported as plain TypeScript objects with hex literals.
- **BREAKING** Delete `package/ui/src/config/tokens.css` entirely. No replacement file. The runtime CSS variables become a side-effect of UnoCSS preset-wind4's on-demand theme-variable generation plus a small dark-mode preflight.
- **BREAKING** Remove the entire `--rezics-{ref,sys,comp,color,space,radius,motion,ease,shadow,font}-*` namespace. The runtime CSS variables become flat names matching wind4's convention: `--colors-primary`, `--colors-surface-elevated`, `--radius-lg`, etc.
- **BREAKING** Rewrite `package/ui/src/config/uno-config.ts` to derive `theme.colors` (and `theme.radius`, `theme.motion`, etc.) directly from the TS source, plus a `preflights` entry that emits `.dark { --colors-*: …; }` from `darkColors`.
- **BREAKING** Remove `unocss-preset-shadcn` from dependencies. Its 4 keyframes (`accordion-down/up`, `collapsible-down/up`) move into `uno-config.ts` as inline `rules`. The 32 shadcn theme CSS variables (`--primary`, `--background`, …) become entries in `theme.colors` whose names are accessed via UnoCSS-generated `--colors-*` vars; shadcn primitives consume them through className utilities (`bg-primary`, `text-foreground`), not through raw `var(--primary)`.
- **BREAKING** Codemod ~558 occurrences across the monorepo that reference `var(--rezics-*)` to either:
  - flat `var(--colors-*)` (when used in inline `style={{}}` for SVG fills, gradient stops, etc.); OR
  - the curated short className utility (`text-primary`, `bg-surface-elevated`, …) — already the preferred path under R9.
- Update `package/ui/src/check-tokens.ts` and the R9 rule in `bun run check:convention` so the namespace check enforces the new flat names and forbids the now-removed `--rezics-*` namespace.
- The design-system-foundation spec is rewritten end-to-end: every requirement that mentions `--rezics-*` either drops the prefix or moves to a wind4-derived flat-name expectation. The mode-switch mechanism stays the same conceptually (class on `<html>`) but the selector becomes `.dark` (matching wind4's default `dark: 'class'` mode) instead of `[data-theme="dark"]`.

This change is intentionally **one-shot**. There are no transitional aliases, no codegen layers wrapping the old namespace, and no phased rollout. The codemod runs once, all consumers move to the flat name in the same PR, and the legacy namespace is gone.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `design-system-foundation`: Drops the `--rezics-*` prefix requirement, replaces hand-written `layers.css` token declarations with UnoCSS-derived emission, switches the dark-mode selector to `.dark`, and re-anchors the "single source of truth" requirement to `tokens/colors.ts` plus `uno-config.ts` (no parallel CSS file).
- `ui-component-foundation`: Updates the prose in "Component selection policy is shadcn-or-custom" that mentions "token-aligned via the `--rezics-*` CSS custom-property cascade" to reflect the new flat-name cascade. No requirement-level behavior change beyond namespace.

## Impact

**Affected packages:**

- `package/ui` — token source, UnoCSS config, check-tokens script, all consumed `var(--rezics-*)` references in shadcn primitives and shared styles
- `package/app` — inline styles, MDX, Storybook themes
- `package/admin` — same
- `package/editor` — same
- `package/folio` — same
- `package/storybook` — Storybook MDX docs that reference token names
- `bin/check-convention.ts` — R9 rule update
- Root `package.json` — drop `unocss-preset-shadcn` dependency

**APIs / dependencies:**

- Removed: `unocss-preset-shadcn`
- Kept: `@unocss/preset-wind4` (already in use, becomes the only color-handling preset)
- No new dependencies

**Backward compatibility:** None. The `--rezics-*` namespace is removed in the same PR that ships the codemod. Any external code (storybook stories, MDX, .env-driven themes) that referenced `var(--rezics-*)` will break unless covered by the codemod. The codemod sweep is part of the change.

**Migration notes:** Documented in `tasks.md` as a step-by-step. No tool runs after the merge — the codemod is one-shot.
