## ADDED Requirements

### Requirement: R9 — Token consumption SHALL go through `uno-config.ts` `theme.colors` short names

The `tool/scripts/check-convention.ts` script SHALL implement a ninth rule (R9) that fails when any source file under `package/*/src/` contains any of the following three patterns:

1. **Long-form rezics-prefixed utility classes.** A className utility whose body matches the regex `\b(text|bg|border|ring|divide|from|to|fill|stroke|outline|caret|accent|placeholder|via)-rezics-color-\w+` — i.e. a Tailwind/UnoCSS prefix followed by `-rezics-color-` followed by a token name. The curated short names defined in `package/ui/src/config/uno-config.ts` `theme.colors` are the canonical consumption surface; long-form variants bypass the curation.

2. **Raw `var(--rezics-*)` inside className-receiving contexts.** A `var(--rezics-` substring appearing inside a JSX `className=""` string literal, a `cn(…)` argument, a `clsx(…)` argument, a template literal interpolated into a className attribute, or a `tw\`…\`` tagged template (if any). The pattern is detected via the same AST traversal as the codemod (ts-morph for `.tsx` / `.ts`; regex for `.mdx`).

3. **Legacy generation rezics names.** A reference to any of the 11 deprecated names — `rezics-color-fg`, `rezics-color-fg-muted`, `rezics-color-bg`, `rezics-color-bg-muted`, `rezics-color-bg-canvas`, `rezics-color-bg-elevated`, `rezics-color-bg-hover`, `rezics-color-bg-selected`, `rezics-color-primary`, `rezics-color-secondary`, `rezics-color-accent` — whether in long-form utility class form, `var(--rezics-color-…)` form, or any other reference style. These names are retained as `@deprecated` aliases inside `tokens.css` *only* so the migration in `migrate-to-theme-config-classes` could land file-by-file; consumer code SHALL no longer reference them.

The rule SHALL apply to every `*.ts`, `*.tsx`, `*.js`, `*.jsx`, and `*.mdx` file under `package/*/src/`. The rule SHALL NOT apply to `*.css` files (which are token-definition sites), to `*.fixture.ts` files (which may contain literal violations to test conventions), or to files inside `package/ui/src/config/tokens.css` (the canonical token table that defines the deprecated aliases).

R9 SHALL be activated at the end of the `migrate-to-theme-config-classes` change implementation — once the codemod has driven all three patterns to zero. R9's `expected-violations.json` allowlist SHALL contain only SVG-inline-style exceptions (cases where a `<rect fill={`var(--rezics-sys-color-chart-1)`} />`-style usage cannot yet be expressed as a UnoCSS class). The allowlist SHALL be reviewed quarterly and SHALL be empty if a UnoCSS shortcut covers every listed case.

The check MAY use ts-morph for AST-aware className identification (preferred) or a regex sweep as the fallback. If ts-morph adds significant startup cost to `bun run check:convention`, the implementation MAY fall back to a regex pre-filter that surfaces candidate sites, then runs ts-morph only on candidate files.

#### Scenario: Long-form rezics utility class fails

- **WHEN** a `.tsx` or `.ts` file under `package/*/src/` contains a className like `text-rezics-color-text-primary` or `bg-rezics-color-surface-elevated`
- **THEN** `bun run check:convention` exits with status 1 and prints the offending file, line number, the matched class, and the R9 spec reference

#### Scenario: Raw `var(--rezics-*)` in className fails

- **WHEN** a `.tsx` or `.ts` file under `package/*/src/` contains `className={`color: var(--rezics-sys-color-text-primary)`}` or `cn("base", `text-[var(--rezics-sys-color-text-primary)]`)` or any equivalent raw CSS-variable use inside a className-receiving context
- **THEN** `bun run check:convention` exits with status 1 and prints the offending site

#### Scenario: Legacy generation name fails

- **WHEN** a `.tsx` or `.ts` file under `package/*/src/` contains `text-rezics-color-fg`, `bg-rezics-color-bg-muted`, `var(--rezics-color-primary)`, or any other reference to the 11 deprecated names
- **THEN** `bun run check:convention` exits with status 1 and prints the offending site with a one-line note pointing to the canonical successor name

#### Scenario: SVG-inline exception passes via allowlist

- **WHEN** a file appears in `tool/scripts/expected-violations.json` under the `R9` section with a `comment` field explaining the SVG-inline necessity
- **THEN** R9 reports the violation as expected and does not fail the run

#### Scenario: New SVG-inline use without allowlist entry fails

- **WHEN** a file not in the R9 allowlist gains a new `<rect fill={`var(--rezics-sys-color-chart-1)`} />`-style use
- **THEN** R9 fails on the new violation
- **AND** the contributor SHALL be redirected to either (a) add a `fill-chart-1` UnoCSS shortcut and migrate the callsite, or (b) add the file to the allowlist with a justification comment, requiring reviewer approval

#### Scenario: CSS file is exempt

- **WHEN** a `*.css` file under `package/*/src/` contains `var(--rezics-color-fg)` or any other rezics CSS-variable reference
- **THEN** R9 SHALL NOT fail
- **AND** the rule applies only to `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.mdx` source files

#### Scenario: tokens.css is exempt

- **WHEN** `package/ui/src/config/tokens.css` defines `--rezics-color-fg: var(--rezics-sys-color-on-surface)` as a deprecated-alias declaration
- **THEN** R9 SHALL NOT fail (CSS files are exempt and `tokens.css` is the canonical alias definition site)

#### Scenario: Rule documented in CLAUDE.md

- **WHEN** a contributor reads `CLAUDE.md`'s convention-enforcement section
- **THEN** the section (or an adjacent section) mentions R9 in one line and points to `openspec/specs/ui-component-foundation/spec.md` and `openspec/specs/convention-enforcement/spec.md` as authoritative sources

### Requirement: R9 SPEC_LINK and Rule type are registered in the check script

The `SPEC_LINK` map in `tool/scripts/check-convention.ts` SHALL include the entry `R9: "openspec/specs/ui-component-foundation/spec.md"`. The `Rule` union type SHALL include `"R9"`. The script's preamble comment SHALL list R9 in the rule summary table with a one-line description.

#### Scenario: SPEC_LINK includes R9

- **WHEN** `tool/scripts/check-convention.ts` is inspected
- **THEN** the `SPEC_LINK` map SHALL contain `R9: "openspec/specs/ui-component-foundation/spec.md"`
- **AND** the `Rule` union type SHALL include `"R9"`
- **AND** the preamble comment SHALL list R9 with a one-line description naming the three forbidden patterns

### Requirement: Codemod and substitution map are committed artifacts

The codemod implementing the migration — `tool/scripts/codemod-theme-classes.ts` — and its substitution map — `tool/scripts/migrate-theme-classes.map.json` — SHALL be committed to the repository and retained after the migration completes.

The codemod SHALL be idempotent: re-running it on a repository that already has zero R9 violations SHALL produce zero changes and exit with status 0.

The substitution map SHALL be human-readable JSON with three sections: `exact` (1:1 substitutions), `ambiguous` (substitutions that need human verification), and `var` (raw `var(--*)` references that the codemod reports but does not auto-rewrite). Each entry's purpose SHALL be inferable from a comment field.

#### Scenario: Codemod is idempotent

- **WHEN** `bun tool/scripts/codemod-theme-classes.ts --apply package/` is run on a clean repository
- **THEN** zero files SHALL be modified
- **AND** the script SHALL exit with status 0

#### Scenario: Substitution map is reviewable

- **WHEN** `tool/scripts/migrate-theme-classes.map.json` is inspected
- **THEN** the map SHALL contain `exact`, `ambiguous`, and `var` sections
- **AND** each substitution SHALL be a single-line entry pairing a long-form name with a short-form name
