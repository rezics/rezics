## Why

Rezics was functionally mature but visually inconsistent. There was no single source of truth for design language — color palettes, typography scale, spacing, density, motion, and pattern usage were decided ad-hoc per surface. This produced four problems:

- Drift across surfaces (`@rezics/app`, `@rezics/admin`, `@rezics/editor`, `@rezics/folio`).
- No reference for AI agents generating UI; every session reinvented taste.
- No reference for human designers/developers beyond reading existing components.
- Tribal preferences (Apple-inspired, MUI-first, borderless, no-emoji-icons) that lived only in chat memory, not in artifacts.

The fix is not "more components." Rezics already has `@rezics/ui` with primitive / composite / shadcn layers, MUI 7, Radix, and UnoCSS. The fix is **codifying the design language** so all surfaces and all future contributors (human and AI) draw from the same well — and replacing the unmaintained React Cosmos fixture system with a documentation-grade Storybook composition site that doubles as the canonical visual reference.

## What Changes

- **ADDED**: Foundation v1 design tokens authored as TypeScript constants in `package/ui/src/config/tokens/` covering color (semantic + scale, light + dark with verified contrast ratios), typography (Inter + Source Han Sans + CJK regional routing via `:lang()`, viewport-clamped 8-step scale, line-height policy), spacing (8px base), radius (Apple-inspired 8-step), elevation (4-tier modal-only shadow stack), and motion (4 durations + 3 easings, with `prefers-reduced-motion` collapse).
- **ADDED**: Single CSS custom property namespace `--rezics-*` injected via `package/ui/src/shared/styles/layers.css`, with `[data-theme="dark"]` mode toggle and `:lang()` regional CJK routing.
- **ADDED**: MUI theme (`package/ui/src/config/theme.ts`) and UnoCSS preset (`package/ui/src/config/uno-config.ts`) both derived from the same token TypeScript modules so MUI components and UnoCSS utility classes consume identical CSS variables and switch modes together.
- **ADDED**: Multi-package Storybook composition site — one independent Storybook per UI-producing package (`ui`, `editor`, `folio`, `admin`, `app`) plus a root host that aggregates them via `refs`. Shared decorators / framework config live in a new workspace package `@rezics/storybook-config`.
- **ADDED**: Six MDX token galleries under `package/ui/src/docs/tokens/` (colors, typography, spacing, radius, elevation, motion) rendering live token swatches and samples.
- **ADDED**: Voice (`package/ui/src/docs/voice.mdx`) and Patterns (`package/ui/src/docs/patterns.mdx`) as the canonical do/don't reference, mirroring the AI-side `.claude/skills/rezics-design/` skill.
- **ADDED**: `.claude/skills/rezics-design/` skill (SKILL.md, voice.md, tokens.md, patterns.md, mui-vs-shadcn.md) so AI agents generating UI consume the same design rules as human readers.
- **REMOVED**: React Cosmos and all per-package `cosmos.config.json` / `cosmos.decorator.tsx` / `vite.cosmos.config.ts` files; 41 fixtures across 4 packages migrated to Storybook stories.
- **AUDITED**: Per-package adoption sweeps (`@rezics/app`, `@rezics/admin`, `@rezics/editor`, `@rezics/folio`, `@rezics/ui`); all Hard-Never violations (brand-color text scatter, emoji-as-icon chrome, line-height < 1.30) fixed inline. Defensible items (MUI sx pixel numerics, CodeMirror highlight literals, reader-theme runtime parameters) and large refactors (editor markdown-prose CSS palette, editor toolbar chrome) explicitly deferred to dedicated future PRs.
- **NAMING**: Late-stage rename `--rzc-*` → `--rezics-*` for CSS custom properties and font-family local fallback names; the `rezics` brand abbreviation does not need further compression.

## Capabilities

### New Capabilities

- `design-system-foundation`: Token sources of truth in `package/ui/src/config/tokens/`, the `--rezics-*` CSS custom property namespace, MUI theme derivation, and UnoCSS preset binding.
- `design-system-storybook`: Storybook 10 as canonical documentation site, multi-package composition topology, port assignments, and `@rezics/storybook-config` shared package.
- `design-system-voice-patterns`: `voice.mdx` + `patterns.mdx` as canonical mood / do-don't reference; pairs with the `.claude/skills/rezics-design/` skill.
- `design-system-adoption`: Per-package adoption audit format and the criteria distinguishing Hard-Never violations from defensible / deferred items.

### Modified Capabilities

None. This change adds new specs; no existing specs are modified.

## Impact

- **Affected packages**: `@rezics/ui` (tokens, theme, uno-config, MDX docs, layers.css, stories), `@rezics/storybook-config` (new), `@rezics/app` / `@rezics/admin` / `@rezics/editor` / `@rezics/folio` (Storybook setup, Cosmos removal, audit fixes), root workspace (`.storybook/` host, root scripts).
- **Dependencies added**: `storybook@^10.3`, `@storybook/addon-docs@^10`, `@storybook/react-vite@^10` (per UI package), `concurrently@^9` (root). `@rezics/storybook-config` added as a workspace devDependency where the package consumes Storybook.
- **Dependencies removed**: `react-cosmos`, `react-cosmos-plugin-vite` from all 5 packages; `cosmos` / `cosmos-export` npm scripts removed.
- **APIs**: No external API surface affected. Internal CSS-variable namespace is a contract for Storybook consumers and component authors; the namespace `--rezics-*` is the only supported prefix going forward.
- **Backward compatibility**: `getTheme` / `getDynamicTheme` exports from `@rezics/ui/config/theme` preserved; existing `@rezics/app` / `@rezics/admin` / `@rezics/folio` consumers compile unchanged. Light/dark theme switching now also honors `[data-theme="dark"]` on `<html>` for non-MUI consumers (UnoCSS classes), with a transitional `html.dark` alias.
- **Migration**: All Cosmos call sites and fixtures already migrated; no action required from feature authors. New stories follow the conventions documented in `CONTRIBUTING.md` (port table) and `.claude/skills/rezics-design/`. The `--rzc-*` → `--rezics-*` rename has been swept repo-wide; any external worktree or cherry-pick needs to apply the same `sed 's/--rzc-/--rezics-/g'` and the three font-family local-name renames (`'rzc-sans'` → `'rezics-sans'`, etc.).
