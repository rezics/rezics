## Context

Two related but distinct consumption-surface failures co-exist in the codebase today.

**Failure A — long-form rezics-prefixed utility classes bypass the curated short-name API.**

The intent of `package/ui/src/config/uno-config.ts` `theme.colors` is to be the canonical, designer-controlled list of color names available in className utilities. When a designer wants to rename a role, they edit one entry in `theme.colors`; every consumer reads the new value automatically. That's the design contract.

The audit shows the contract is broken. 184 files reach for the *underlying* rezics CSS variable name through UnoCSS's auto-utility-from-CSS-variable feature, not through the curated theme map. `text-rezics-color-fg-muted` works because UnoCSS's `preset-wind4` treats *every* `--rezics-*` CSS variable as an automatically-available class; the developer writes the long form and gets a class, even though the curated short name (`text-text-secondary`) exists for the same value. There is no syntactic distinction between "intended consumption" and "accidental bypass."

The cost of leaving this in place: any future role rename hits the long-form names individually, since they reference the rezics variable directly rather than the curated alias. The "edit one entry in `theme.colors`" contract becomes a 184-file find-and-replace.

**Failure B — two generations of role names co-exist in consumer code.**

Per the audit, 60+ files (364+ references) still reach for legacy generation names: `rezics-color-fg`, `rezics-color-bg`, `rezics-color-primary`, `rezics-color-secondary`, `rezics-color-accent`, and the `rezics-color-bg-{muted,canvas,elevated,hover,selected}` family. The new ladder (`text-text-primary`, `text-text-secondary`, `bg-surface-canvas`, `bg-surface-subtle`, etc.) is partially adopted; the legacy names still work because the proposal-1 token system keeps them as live aliases. So a contributor reading the codebase encounters both vocabularies side by side with no signal which is canonical.

The two failures interact: most legacy-name references are *also* long-form (e.g. `text-rezics-color-fg-muted`), so they're a single migration target with a two-step rewrite (long-form-and-legacy → short-form-and-canonical).

**Why a codemod, not a manual sweep.**

220 estimated files, 970+ rewrite sites. A regex find-replace can do the trivial cases but can't disambiguate:
- Conditional patterns: `cn("base", isMuted && "text-rezics-color-fg-muted")`.
- Variant-driven patterns: ``cn(\`bg-${kind === "elevated" ? "rezics-color-bg-elevated" : "rezics-color-bg"}\`)``.
- Multi-class strings split across template literal segments.
- Comments inside JSX that look like className but aren't.

ts-morph parses TypeScript / JSX AST-aware and identifies the *string-literal positions inside className-receiving expressions*, which is the precise scope where R9 should apply.

**Why R9 needs zero baseline.**

The current convention check (R5, R8) is run as a pre-commit hook plus PR merge gate. It uses an `expected-violations.json` baseline only for genuine grandfathered exceptions (R5 has a couple). R8 (no MUI) ships with a hard-zero baseline by design. R9 follows R8's model: if we ship R9 with a 184-file allowlist, the rule has no enforcement bite — every new file gets added to the allowlist by reflex. The migration drives consumer code to zero before R9 turns on; once on, it's an absolute rule.

The codemod's design has to support that: dry-run, apply, idempotent, verifiable. The migration plan in `tasks.md` does the bulk in one phase plus a small clean-up phase for the AST-skipped dynamic interpolation cases.

## Goals

- 100% of long-form `(text|bg|border|ring|divide|from|to|fill|stroke)-rezics-color-*` utility usages migrated to short-name API.
- 100% of legacy generation names (`rezics-color-fg/bg/primary/secondary/accent` family) migrated to canonical successors.
- Raw `var(--rezics-*)` references inside JSX className contexts migrated to UnoCSS theme classes (non-CSS callsites only — `*.css` files are unchanged).
- R9 ships hard-zero (no per-site allowlist except the small inline-style exception list).
- Visual outcome of every page: pixel-stable. The codemod is value-preserving by construction.
- A single short README at `package/ui/src/config/README.md` makes the consumption surface and R9 discoverable for future contributors.
- Codemod is reproducible and idempotent — re-running on a clean repo produces zero changes.

## Non-Goals

- Restyling any surface. Visual outcomes are pixel-stable.
- Migrating CSS-side `var(--rezics-*)` references. CSS files (token definitions, primitive style files) reference the system tier directly by design.
- Deleting the legacy-name aliases from `tokens.css`. That happens in a follow-up change after this lands and R9 confirms zero consumer references.
- Adding new component primitives.
- Storybook content (proposal 3).
- Server, contract, backend, or routing changes.
- Any changes outside `package/*/src/` and `tool/scripts/`.

## Decisions

### Decision 1: Codemod uses ts-morph for `.tsx` / `.ts`, regex for `.css` / `.mdx`

ts-morph parses TypeScript / JSX correctly and exposes the AST. The codemod walks every JSX `Attribute` named `className`, every `CallExpression` whose callee is `cn` (or `clsx` if any callsite uses it), and every `TaggedTemplateExpression` whose tag is `tw` (none currently exist, but defensive). For each, it identifies string literals and the static portions of template literals. Within those, it applies the substitution map.

For `.css` and `.mdx` files, the codemod uses regex — these formats don't have a usable AST for our purpose, and the substitutable portions are simple enough that regex is reliable.

The codemod skips:
- Dynamic interpolations (`${variable}` segments of template literals where the substituted value isn't a known string).
- String concatenations across non-template boundaries (`"text-" + (foo ? "rezics-color-fg" : "primary")`).
- Comment contents.
- Test fixtures named `*.fixture.ts` (these may intentionally contain literal violations to test the convention checker).

Skipped sites are reported separately for human review. The audit suggests ~5–10 dynamic-interpolation sites total; manageable manually.

**Why ts-morph over an oxc-based pass.** oxc-parser is faster but lacks the convenient JSX-attribute traversal helpers ts-morph provides. The migration runs once; speed isn't the constraint. Correctness on JSX-attribute / `cn()` argument identification is. Choose ts-morph.

### Decision 2: Substitution map is exhaustive and reviewed before the codemod runs

The codemod reads its substitution map from `tool/scripts/migrate-theme-classes.map.json`. The map has the structure:

```jsonc
{
  "exact": {
    "text-rezics-color-text-primary":  "text-text-primary",
    "text-rezics-color-text-secondary": "text-text-secondary",
    "text-rezics-color-fg":             "text-text-primary",
    "text-rezics-color-fg-muted":       "text-text-secondary",
    "bg-rezics-color-bg":               "bg-surface-canvas",
    "bg-rezics-color-bg-muted":         "bg-surface-subtle",
    "bg-rezics-color-bg-elevated":      "bg-surface-elevated",
    "bg-rezics-color-bg-hover":         "hover:bg-surface-subtle",
    "bg-rezics-color-primary":          "bg-brand-fill",
    "border-rezics-color-border-whisper": "border-border-whisper",
    "ring-rezics-color-border-focus":   "ring-border-focus",
    /* ... full list captured in the map file ... */
  },
  "ambiguous": {
    "bg-rezics-color-bg-selected": {
      "default": "bg-surface-selected",
      "needs_review": true,
      "comment": "Some sites mean 'currently selected nav item' (bg-surface-selected); some mean 'fadeable hover-state' (hover:bg-surface-subtle). Review before applying."
    }
  },
  "var": {
    "var(--rezics-color-fg)":         "<replace with UnoCSS class context-dependent>",
    "var(--rezics-color-fg-muted)":   "<replace with UnoCSS class context-dependent>"
  }
}
```

`exact` map: 1:1 substitution, applied in `--apply` mode automatically.

`ambiguous` map: 1:1 default substitution applied + `// TODO(R9-codemod): verify intent` comment inserted on the changed line. Humans confirm or rewrite.

`var` map: tracked for reporting; sites are listed but not auto-rewritten (the right replacement depends on the calling context — `style={{ color: var(--rezics-color-fg) }}` becomes `className="text-text-primary"` plus removing the inline style; the codemod can't infer the right class without reading the JSX attribute structure, so it flags for human action).

**Why one centralized map rather than codified inside the codemod.** Reviewers should be able to read the map as a flat document, see exactly which legacy names map to which canonical names, and approve / amend before the codemod runs. The map file becomes the artifact of record.

### Decision 3: Migration runs in three phases

- **Phase A: low-stakes packages** — `@rezics/folio`, `@rezics/editor`, `@rezics/admin` (in that order). Smaller files, less interactive surface area, easier visual verification. Per-package commit.
- **Phase B: high-stakes packages** — `@rezics/app`. The bulk of consumer files. Per-feature subfolder commits where possible (e.g. `package/app/src/post/`, `package/app/src/book/`, etc.) so the diff is reviewable.
- **Phase C: design-system internals** — `@rezics/ui`'s own `src/composite/`, `src/primitive/`, `src/shadcn/` files. These are the most-imported consumers and migrating them last lets reviewers see the migration's effect on real callers before changing the design system's own surface. Plus a final pass on the small remaining files (`package/storybook-config/`, `package/app-shell/`, etc.).

**Why phased.** The whole migration *could* be one PR, but a 220-file PR is unreviewable. Phasing by package gives reviewers a manageable chunk per pass, lets each phase ship independently if needed, and lets us catch any visual regression early (in `@rezics/folio`, which has the smallest surface) before doing the bulk migration.

### Decision 4: R9 is hard-zero with a tiny inline-style allowlist

R9's primary form: any of the three forbidden patterns in `package/*/src/` `.tsx` / `.ts` / `.mdx` files fails the check.

The single allowed exception: SVG attributes that genuinely require a CSS variable value (e.g. an `<rect fill={`var(--rezics-sys-color-chart-1)`} />` that pulls a chart color via inline). These cases:
- Live exclusively in a small set of chart / data-viz primitives.
- Are recorded in `tool/scripts/expected-violations.json` under an `R9` section with a `comment` field.
- Can be promoted into a UnoCSS class the moment a `fill-chart-1` class is wired in `theme.colors` (which proposal-1 sets up; this proposal can choose to do the wiring or defer).

R9 SHALL NOT support inline `// rezics-disable-next-line` comments or any per-site escape hatch. The allowlist is the only escape.

**Why the SVG allowance.** UnoCSS does not expose `fill-*` classes by default in preset-wind4 in a way that drives chart colors cleanly. The pragmatic choice: until `fill-chart-1`/`stroke-chart-1` shortcuts are wired, allow the inline-style use as a tiny well-defined exception. Once the shortcuts ship (proposal 3 or a dedicated small change), the allowlist drops to zero.

### Decision 5: README is short and points to specs

`package/ui/src/config/README.md` is a one-pager:
- Short intro: "These files are the consumption surface for the rezics design system."
- Link to `openspec/specs/ui-component-foundation/spec.md`.
- The R9 rule statement: "Use the short names (`text-text-primary`, `bg-surface-canvas`, `border-border-whisper`). Do not write long-form `text-rezics-color-*` classes. Do not reference legacy generation names."
- A short "if you need a name that isn't here" section pointing to the OpenSpec change-proposal flow.

Not a tutorial. Not a token gallery (that's Storybook). Just a sign that says "you've found the door, here's the rule, here's where to read more."

### Decision 6: Codemod is committed, not run-and-discarded

`tool/scripts/codemod-theme-classes.ts` and the substitution map (`migrate-theme-classes.map.json`) stay in the repo after the migration. Reasons:
- Re-running on `dev` from a long-lived feature branch catches new long-form usages introduced during the merge race.
- A future "migrate the next role rename" can fork the codemod's structure rather than re-implementing AST traversal.
- The map is a historical record — when someone asks "what did `rezics-color-fg` map to?", they read the map.

The script becomes a no-op once R9 ships (zero matches to rewrite). It stays available; it costs nothing.

## Trade-offs

- **One big migration vs many small.** Chose three phases (Folio/Editor/Admin → App → UI internals). Trade-off: each phase carries the codemod tool through three commits before retirement. Mitigated by the phases being short (codemod runs in seconds; review is the cost).
- **ts-morph runtime cost vs simpler regex.** Chose ts-morph. Trade-off: codemod takes ~10–20 seconds on the full repo vs ~1 second for regex. Acceptable.
- **Centralized map file vs codified rules.** Chose map file. Trade-off: one extra file to maintain. Mitigated by the map being short (~30 entries) and the migration being one-time.
- **R9 hard-zero vs allowlist.** Chose hard-zero with one tiny SVG exception. Trade-off: more migration work upfront. Justified — R8 (no MUI) demonstrates that hard-zero rules are the only ones that stay enforced.
- **Migrate UI internals last vs first.** Chose last. Trade-off: while consumers use the canonical names, the design-system primitives still use the long-form names for one phase. Acceptable — the primitives' rendering is unchanged either way (same CSS variable resolution); the migration in Phase C is a name-only change.

## Open Questions

- Does this change wire up `fill-chart-1` / `stroke-chart-1` UnoCSS shortcuts to remove the SVG-inline exception? Default: no — that's a small wiring change that fits cleanly in proposal 3 (Storybook charts/data-viz coverage). If the audit during Phase A finds more than ~5 SVG-inline sites, reconsider.
- Should `cn(…)` argument detection account for the `clsx` library too? Default: detect both, but the audit suggests `cn` is the only tool used. Confirm during the codemod's first dry-run.
- Does the codemod attempt to also flatten `cn("text-base", "text-text-primary")` into `cn("text-base text-text-primary")`? Default: no. That's an unrelated simplification; out of scope.
- Does the codemod normalize utility ordering (`text-sm font-bold text-text-primary` vs `font-bold text-sm text-text-primary`)? Default: no. UnoCSS doesn't care about order; the migration leaves order untouched to keep diffs minimal.
- Where exactly does R9's SPEC_LINK point? Default: `openspec/specs/ui-component-foundation/spec.md` (where the consumption-surface rule lives) plus a cross-reference comment in `convention-enforcement/spec.md` to the new R9 Requirement (this proposal's spec delta).
