## Why

The `complete-rezics-token-system` change (proposal 1) lands a clean three-tier architecture and seals the role list as a strict superset of shadcn. With that in hand, the next problem becomes load-bearing: **consumer code is not actually using the curated short-name API.**

The codebase audit makes this concrete:

- **184 distinct files** contain at least one long-form rezics-token utility class — `text-rezics-color-fg-muted`, `bg-rezics-color-surface-elevated`, `border-rezics-color-border-whisper`, `ring-rezics-color-border-focus`. Total occurrences: 418 (`text-`) + 92 (`bg-`) + 87 (`border-`) + 9 (`ring-`) + 1 (`divide-`) = **607 long-form utility uses**.
- **60+ files** reach for the legacy generation names — `rezics-color-fg`, `rezics-color-bg`, `rezics-color-primary`, `rezics-color-secondary`, `rezics-color-accent` — a vocabulary that has been superseded by the newer `rezics-color-text-*` / `rezics-color-surface-*` ladder. Total references: 364+.
- **Zero enforcement.** No convention rule today bans raw `var(--*)` in a className string, or bans the long-form `text-rezics-color-*` pattern, or detects when a contributor reaches for the legacy generation name.

The user's original P2 problem statement was: "rezics token consumption is wrong — code currently writes long-form `text-rezics-color-text-secondary` directly, bypassing the curated `uno theme.colors` short-name API. Code should always go through theme config (e.g. `text-text-secondary`), never raw rezics tokens."

Why this matters in practice:

- **The short names are the design surface.** The whole point of `uno-config.ts` `theme.colors` is to be the curated, designer-controlled vocabulary. When code writes `text-rezics-color-text-secondary` instead of `text-text-secondary`, it bypasses the curation — a future rename of the rezics token (which has happened: `--rzc-*` → `--rezics-*`, and the legacy ↔ ladder migration is happening *now*) hits 184 files instead of one config entry.
- **Mixed generations are a correctness hazard.** A page that uses `text-rezics-color-fg` for body text and `text-text-primary` for a card title is using two roles that *should* mean the same thing but came from two generations. Light/dark behavior is identical today by construction, but the next time either role drifts (e.g. text-primary tightens for accessibility), the codebase has two different "primary text" colors silently coexisting.
- **The role list now exists.** Proposal 1 establishes the canonical role vocabulary and the rezics-as-superset principle. Without a migration, that proposal lands without anyone *using* it — the codebase keeps reaching for `rezics-color-*` names and the new system-tier additions (`primary-container`, `surface-container-low`, `inverse-surface`, etc.) sit unused.
- **Future enforcement needs a baseline.** Adding R9 to `bun run check:convention` requires a clean codebase — no raw `var(--*)` in className, no long-form `text-rezics-color-*`, no legacy-generation references. Without the migration, R9 either ships with a 184-file allowlist (defeating the purpose) or it doesn't ship.

The migration is mechanical (codemod-driven) and large (607 long-form occurrences + 364 legacy occurrences across 244+ distinct files), but it has a clean exit condition: when the grep targets return zero, R9 turns on and the design system has one canonical consumption surface.

## What Changes

- **CHANGED**: All 184 files containing long-form rezics-token utility classes are migrated to the curated short-name API:
  - `text-rezics-color-text-primary` → `text-text-primary`
  - `text-rezics-color-text-secondary` → `text-text-secondary`
  - `text-rezics-color-text-tertiary` → `text-text-tertiary`
  - `text-rezics-color-fg` → `text-text-primary` (legacy → canonical)
  - `text-rezics-color-fg-muted` → `text-text-secondary` (legacy → canonical)
  - `bg-rezics-color-surface-canvas` → `bg-surface-canvas`
  - `bg-rezics-color-surface-elevated` → `bg-surface-elevated`
  - `bg-rezics-color-bg` → `bg-surface-canvas` (legacy → canonical)
  - `bg-rezics-color-bg-muted` → `bg-surface-subtle` (legacy → canonical)
  - `bg-rezics-color-bg-elevated` → `bg-surface-elevated` (legacy → canonical)
  - `bg-rezics-color-bg-hover` → `hover:bg-surface-subtle` (the `-hover` suffix collapses into the modifier)
  - `bg-rezics-color-bg-selected` → `bg-surface-selected` (or context-appropriate; codemod produces a TODO for human review where the legacy meaning is ambiguous)
  - `bg-rezics-color-primary` → `bg-brand-fill` (legacy → canonical)
  - `bg-rezics-color-secondary` → `bg-surface-subtle` (legacy → canonical; matches current alias)
  - `bg-rezics-color-accent` → `bg-surface-subtle` (legacy → canonical; matches current alias)
  - `border-rezics-color-border` → `border-border-default`
  - `border-rezics-color-border-whisper` → `border-border-whisper`
  - `border-rezics-color-border-defined` → `border-border-defined`
  - `border-rezics-color-border-focus` → `border-border-focus`
  - `ring-rezics-color-border-focus` → `ring-border-focus`
  - And the analogous mappings for every other rezics-prefixed long-form variant the audit identified.
- **CHANGED**: All raw `var(--rezics-*)` references inside JSX `className=""` strings, `cn()` calls, and template literals are migrated to short-name UnoCSS classes. Today this pattern is rare but not zero — the audit found instances in inline styles for chart fills, sparkline strokes, and a handful of sidebar.tsx usages. Each instance is rewritten to a UnoCSS theme class or, where the property is one UnoCSS does not natively expose (e.g. `fill` for SVG), to a CSS variable referenced from the *uno-config.ts* curated set rather than an inline literal.
- **CHANGED**: `package/ui/src/config/uno-config.ts` is amended so that every short-name class the codemod targets actually exists in `theme.colors`. The proposal-1 reorganization adds `text-on-primary-container`, `bg-surface-container-low`, etc.; this proposal confirms each migration target resolves to a valid UnoCSS class before the codemod runs. Where a target is missing, it is added (the codemod is gated on a complete name table).
- **ADDED**: The codemod itself — `tool/scripts/codemod-theme-classes.ts` — using `ts-morph` for AST-aware className parsing. Falls back to a regex sweep for `*.css` / `*.mdx` / story files that don't go through TS. Codemod runs in two modes: `--dry-run` (prints diffs, no writes) and `--apply` (writes). Each phase of the rollout in `tasks.md` documents the exact file glob.
- **ADDED**: `convention-enforcement` R9 — `bun run check:convention` SHALL fail when any source file under `package/*/src/` contains:
  - A className utility matching `\b(text|bg|border|ring|divide|from|to|fill|stroke)-rezics-color-` — long-form rezics-prefixed utility class.
  - A raw `var(--rezics-` inside a className string, `cn()` argument, or template literal interpolated into a className.
  - A reference to a legacy-generation rezics name (`rezics-color-fg`, `-fg-muted`, `-bg`, `-bg-muted`, `-bg-canvas`, `-bg-elevated`, `-bg-hover`, `-bg-selected`, `-primary`, `-secondary`, `-accent`) — whether long-form-utility or `var(--*)` form.
  R9 is activated at the *end* of this change, after the codemod has driven all three patterns to zero. R9 has a small, time-limited allowlist for inline style attributes that genuinely need the CSS variable (e.g. SVG `fill` props receiving a theme color) — these are captured in `expected-violations.json` with a comment explaining each exception.
- **ADDED**: Documentation in `package/ui/src/config/uno-config.ts` itself — a top-of-file comment block that names the consumption surface ("All UI code SHALL reach for these short names. Long-form `text-rezics-color-*` is forbidden by R9.") and points to the spec.
- **ADDED**: A short README at `package/ui/src/config/README.md` (the `config/` folder will already exist post-proposal-1) explaining the three-tier model, the consumption surface, the R9 enforcement, and the migration history. This is the only new doc — Storybook galleries land in proposal 3.
- **REMOVED** (after R9 activates): Once consumer references reach zero, a follow-up change deletes the 11 legacy-name aliases from `tokens.css` (Decision 6 of proposal 1). That deletion is **not in scope for this change** — this change ends with the aliases still live and the consumption surface clean. The deletion change is small enough to land independently and lets reviewers confirm "consumer code no longer references the legacy names" as a final discrete step.
- **NOT IN SCOPE**: Adding new component primitives.
- **NOT IN SCOPE**: Storybook content (proposal 3).
- **NOT IN SCOPE**: Deleting `--rezics-color-*` from the system tier. The system tier itself stays prefixed; this change is about *className utilities* in consumer code, not about CSS-variable definition sites.
- **NOT IN SCOPE**: Modifying any visual outcome. The codemod produces visually-identical pages — every long-form name resolves to the same OKLCH value as its short-name counterpart, by construction.
- **NOT IN SCOPE**: Server, contract, backend, or routing changes. Frontend className strings only.

## Capabilities

### Modified Capabilities

- `convention-enforcement`: Adds Requirements covering R9 — long-form rezics-prefixed utility classes, raw `var(--rezics-*)` in className strings, and legacy-generation rezics names are all forbidden in source code. Adds the R9 SPEC_LINK entry and the small inline-style allowlist mechanism.

## Impact

- **Affected packages**: `@rezics/app`, `@rezics/admin`, `@rezics/ui` (its own `src/composite/` and `src/primitive/` files are heavy users of the long-form pattern), `@rezics/folio`, `@rezics/editor`. `@rezics/server`, `@rezics/auth`, `@rezics/contract`, `@rezics/api`, `@rezics/jwt` are unaffected (no className strings).
- **Files touched (estimate)**: 184 long-form-utility consumers + ~60 legacy-name consumers (with overlap). Estimated 220 distinct files. Plus `tool/scripts/check-convention.ts` (R9 wiring), `tool/scripts/codemod-theme-classes.ts` (new), `tool/scripts/expected-violations.json` (R9 allowlist), `package/ui/src/config/uno-config.ts` (new short-name additions for migration targets and a top-of-file comment block), `package/ui/src/config/README.md` (new doc), and the spec / proposal / tasks files for this change.
- **Imports changed**: None at the import-statement level. This change is className-string only.
- **Dependencies added**: `ts-morph` as a `devDependencies` entry under the workspace root (or an existing toolchain package — confirmed during Phase 1). Already a transitive dep of `oxc-parser`-related toolchain elsewhere; check first before adding.
- **Backward compatibility**: The 11 legacy-name aliases stay live in `tokens.css` through this change (per proposal 1's Decision 6). After this change lands and R9 is active, a follow-up small change deletes the aliases. Until that follow-up lands, the legacy names *still resolve* if any external tool somehow references them — but R9 makes the project's own source code free of them.
- **Verification**:
  - `bun run check:convention` SHALL pass with R9 active.
  - `rg "(text|bg|border|ring|divide|from|to|fill|stroke)-rezics-color-" package/*/src/` SHALL return zero matches at the end of the change.
  - `rg "var\(--rezics-" package/*/src/` SHALL return only matches inside `*.css` files (which are token definition sites or styles permitted to reference the system tier directly), not inside `.tsx` / `.ts` files.
  - `rg "rezics-color-(fg|bg|primary|secondary|accent)\b" package/*/src/` SHALL return zero matches at the end of the change.
  - Manual visual sweep across one representative page per package confirms no regression. The codemod is value-preserving by construction (every long-form name has a short-name counterpart resolving to the same CSS variable), so visual diffs are expected to be zero.
  - Type-check (`bun -F <pkg> run typecheck`) and unit tests pass per package.
- **Risk**: Medium. The codemod is large but mechanical. The two notable risk surfaces:
  1. **Ambiguous legacy-meaning mappings.** `rezics-color-bg-hover` semantically means "the hover state of the background." Sometimes that's `hover:bg-surface-subtle`; sometimes it's `hover:bg-surface-selected` depending on context. The codemod produces a `// TODO(R9-codemod):` comment in those cases, which a human resolves before R9 ships.
  2. **Template literal / `cn()` interpolation cases.** A pattern like `cn("text-base", isMuted && "text-rezics-color-fg-muted")` is straightforward; a pattern like ``cn(`bg-${variant}-rezics-color-surface-${depth}`)`` is not. The codemod skips dynamic interpolations and reports them; humans rewrite the few that exist (audit suggests ~5–10 sites total). Mitigation: the dry-run output lists every dynamic case separately so reviewers can scope the manual work before starting.
  Tertiary risk: the migration may surface previously-hidden bugs (e.g. a page that used `bg-rezics-color-bg-elevated` because the author meant `bg-surface-elevated` and the legacy alias accidentally resolved to the same thing, but a future role drift would have broken the page). The codemod brings these to the surface; we resolve them as we encounter them.
