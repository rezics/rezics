## Context

The token system as it stands at the close of `deprecate-mui` is functional but unfinished. Three observations from the codebase audit and the MD3 / Apple HIG research drove the design decisions below.

**Observation 1 — Two generations of names, no migration path.** A grep across `package/*/src/` finds 184 files using long-form `text-rezics-color-*` utilities directly, and 60+ files referencing legacy `rezics-color-fg / rezics-color-bg / rezics-color-primary` names that have been superseded by the newer ladder (`rezics-color-text-* / rezics-color-surface-* / rezics-color-brand-*`). Both generations resolve to similar values; the overlap means a contributor reading the codebase has no way to tell which name is canonical. The 11-name legacy list (`rezics-color-fg`, `-fg-muted`, `-bg`, `-bg-muted`, `-bg-canvas`, `-bg-elevated`, `-bg-hover`, `-bg-selected`, `-primary`, `-secondary`, `-accent`) accounts for 364+ references — too many to migrate inside this token-architecture change without it becoming a 200-file PR. The legacy names must be kept as live aliases here so that proposal 2 (`migrate-to-theme-config-classes`) can land independently.

**Observation 2 — shadcn slots are bound but not absorbed.** `package/ui/src/shared/styles/layers.css` already provides every standard shadcn slot under `.theme-rezics`, but several of those slots alias to the *wrong* rezics name (e.g. `--secondary` → `rezics-color-surface-subtle`, conflating "secondary container" with "muted surface"; `--accent` → `rezics-color-surface-subtle`, the same value as `--muted`). Worse, the rezics namespace lacks the colors that distinguish them in MD3 — `secondary-container`, `tertiary-container`, `surface-container-low/high/highest`, `inverse-surface`, `error-container`. The shadcn surface is *consumed* but is not yet a *superset* of MD3's role vocabulary, which is what the rezics aesthetic actually needs to express depth and emphasis without shadows. Closing that gap is the single highest-leverage change in this proposal.

**Observation 3 — the file conflates four concerns.** `layers.css` owns: the `.theme-rezics` shadcn binding block; the `:root` rezics token table; the `[data-theme="dark"]` override block; the `:lang()` font routing and `prefers-reduced-motion` baseline. Splitting tokens (config-driven, design-system-owned) from baseline (app-shell-owned) is the precondition for adding state-layer / motion / surface-container / density tokens — none of which can land cleanly while baseline and tokens cohabit one file.

The downstream proposals depend on this one:
- Proposal 2 (`migrate-to-theme-config-classes`) needs the legacy aliases to keep working *during* its migration so that incremental codemods don't break unmigrated callers.
- Proposal 3 (`complete-rezics-design-storybook`) needs the system-tier token additions (state-layer opacities, motion ladder, surface-container ladder, density attribute scope) to exist before it can document them as Foundation pages.

## Goals

- Three explicit token tiers (ref / sys / comp), with the system tier owning all light/dark switching.
- One source of truth per role, exposed under at most two names: a rezics name (consumed via UnoCSS theme classes) and a shadcn name (consumed by shadcn primitive internals). No third namespace.
- shadcn slot list is a *strict subset* of the rezics system-tier role list. Adding a shadcn primitive that needs a new slot SHALL extend the rezics system tier first, never the other way around.
- File split: tokens live next to `uno-config.ts`, baseline lives separately. Storybook imports tokens but not baseline.
- `.theme-rezics` selector is on `<html>` so portal subtrees inherit the cascade.
- All current consumer code keeps working (legacy aliases live, eight entry points repointed, no `text-rezics-color-*` migration in scope).
- Contrast invariant (≥4.5:1 text-on-surface, ≥3:1 non-text UI) is enforceable as a script.

## Non-Goals

- Migrating long-form `text-rezics-color-*` consumer code to short-name `text-text-primary` (proposal 2).
- Building Foundation MDX galleries or a density attribute scope in Storybook (proposal 3).
- HCT algorithmic palette generation. The rezics palette stays hand-curated; the MD3 contrast invariant is adopted as a *test* over the curated values, not as a generator.
- Removing the legacy 11-name aliases. Their consumers are migrated in proposal 2; the aliases are deleted in a follow-up change after that lands.
- Restyling any visual surface. This is a token-architecture refactor; visual outcomes are pixel-stable.
- Adding new component primitives. The "custom primitives are added on demand" rule from `ui-component-foundation/spec.md` Requirement-5 still applies.
- Adopting MD3's ripple, dp shadow ladder, full-pill button defaults, or surface-tint-via-primary-blending. These are visual choices that conflict with the rezics borderless-parchment aesthetic.

## Decisions

### Decision 1: Three-tier token architecture (ref / sys / comp)

Adopt MD3's tier model wholesale.

- **Reference tier** (`--rezics-ref-*`) — raw palette, type ramp, spacing scale, radius scale, shadow recipes, ease curves. Mode-invariant. Authored once, referenced by the system tier.
- **System tier** (`--rezics-sys-*`) — semantic roles. Light/dark resolved here by remapping system tokens to different reference values. Owns the role vocabulary that consumer code (UnoCSS classes, shadcn primitives, custom primitives) reads.
- **Component tier** (`--rezics-comp-*`) — only authored where a component's mapping is non-obvious. Most components reference system tokens directly via UnoCSS theme classes; the component tier is reserved for cases like "the quiet button uses primary-container, not primary" where the binding deserves a name.

**Why three tiers, not two.** A two-tier model (raw + semantic) is what the rezics namespace was implicitly using until now. The pain point: when light/dark mode needs a different *reference* value (e.g. a darker container in dark mode), there is no clean way to express it without duplicating the role definition. The three-tier model makes "the system token is light/dark-aware, the reference token is mode-invariant" load-bearing. Reference values never change between modes; only the system tier's mapping changes.

**Why not run all three tiers through the rezics prefix.** The reference tier is internal — no consumer outside the design system reads `--rezics-ref-*`. Stripping the rezics prefix from internal tiers is a small saving that would mean two naming conventions inside one file. Keep all three tiers prefixed (`--rezics-ref-*`, `--rezics-sys-*`, `--rezics-comp-*`) for one-grep navigation. Only the shadcn-superset slots are unprefixed, because shadcn primitives expect them as `--card`, `--primary`, etc.

**Why component tier is conservative.** MD3's component tier is large (every variant of every component named explicitly). For rezics that would mean ~200 component tokens for negligible gain — most components consume system tokens directly. Rule: only author a component token when the binding is non-obvious *or* when a component has multiple semantically-distinct variants that share a structural role. Examples that *do* deserve a component token:
- `--rezics-comp-button-quiet-container` → `var(--rezics-sys-color-primary-container)` (the "quiet button uses container, not fill" rule deserves an explicit name so it's audit-able).
- `--rezics-comp-card-elevated-surface` → `var(--rezics-sys-color-surface-container-low)` (the "elevated card uses surface-container-low, not surface" mapping is the only one that survives across light/dark with depth-via-color preserved).
- `--rezics-comp-snackbar-container` → `var(--rezics-sys-color-inverse-surface)` (snackbars are the canonical inverse-surface consumer).

### Decision 2: rezics absorbs shadcn vocabulary as a strict superset

The `.theme-rezics` block holds *both* the rezics-prefixed system-tier vars and the unprefixed shadcn slots. The shadcn slots resolve to system-tier values via `var()` chain. There is no separate aliasing layer.

**Why not a separate aliasing layer.** An earlier draft of this proposal had two parallel namespaces (`--rezics-color-*` for the design system, `--card` / `--primary` / etc. for shadcn) that connected through an alias file. The user rejected this: "rezics 是 superset" — rezics owns all names. The single-block model means one diff to add a new role, one place to find the canonical mapping, no risk of the two namespaces drifting.

**Why keep the shadcn names unprefixed.** Shadcn primitives are authored to read `var(--card)` / `var(--primary)`. Renaming them to `var(--rezics-card)` would diverge from upstream and require a custom shadcn CLI fork. The cost-benefit is wrong — keep the unprefixed shadcn slots, scope them under `.theme-rezics` so they don't bleed into other selectors, and they stay drop-in compatible with any future shadcn primitive copied from the registry.

**The role list (system tier).** The full rezics system-tier role list, organized to match MD3's role taxonomy, is:

```
Surface family:
  --rezics-sys-color-background           (== shadcn --background)
  --rezics-sys-color-on-background        (== shadcn --foreground)
  --rezics-sys-color-surface              (the parchment canvas)
  --rezics-sys-color-on-surface           (text on surface)
  --rezics-sys-color-surface-variant      (== shadcn --muted)
  --rezics-sys-color-on-surface-variant   (== shadcn --muted-foreground)
  --rezics-sys-color-surface-container-lowest
  --rezics-sys-color-surface-container-low
  --rezics-sys-color-surface-container
  --rezics-sys-color-surface-container-high
  --rezics-sys-color-surface-container-highest
  --rezics-sys-color-surface-tint         (used by tonal-elevation overlays)

Brand family:
  --rezics-sys-color-primary              (== shadcn --primary, == rezics brand-fill)
  --rezics-sys-color-on-primary           (== shadcn --primary-foreground, == rezics text-on-brand)
  --rezics-sys-color-primary-container    (the quieter brand role; chips, badges, tonal banners)
  --rezics-sys-color-on-primary-container

Secondary family (preserved for future use; today aliased to surface ladder):
  --rezics-sys-color-secondary            (== shadcn --secondary)
  --rezics-sys-color-on-secondary         (== shadcn --secondary-foreground)
  --rezics-sys-color-secondary-container
  --rezics-sys-color-on-secondary-container

Tertiary / accent family:
  --rezics-sys-color-tertiary             (== shadcn --accent)
  --rezics-sys-color-on-tertiary          (== shadcn --accent-foreground)
  --rezics-sys-color-tertiary-container
  --rezics-sys-color-on-tertiary-container

Semantic states (success / warning / error / info):
  --rezics-sys-color-error                (== shadcn --destructive)
  --rezics-sys-color-on-error             (== shadcn --destructive-foreground)
  --rezics-sys-color-error-container
  --rezics-sys-color-on-error-container
  --rezics-sys-color-success / -on-success / -container / -on-container
  --rezics-sys-color-warning / -on-warning / -container / -on-container
  --rezics-sys-color-info / -on-info / -container / -on-container
  --rezics-sys-color-sentiment-positive / -negative   (review / rating / score family)

Lines:
  --rezics-sys-color-outline              (== shadcn --input)
  --rezics-sys-color-outline-variant      (== shadcn --border)

Inverse family:
  --rezics-sys-color-inverse-surface
  --rezics-sys-color-inverse-on-surface
  --rezics-sys-color-inverse-primary

Charts:
  --rezics-sys-color-chart-1 .. -chart-5  (== shadcn --chart-1 .. --chart-5)

Sidebar chrome:
  --rezics-sys-color-sidebar-background    (== shadcn --sidebar-background)
  --rezics-sys-color-sidebar-foreground    (== shadcn --sidebar-foreground)
  --rezics-sys-color-sidebar-primary       (== shadcn --sidebar-primary)
  --rezics-sys-color-sidebar-primary-foreground
  --rezics-sys-color-sidebar-accent
  --rezics-sys-color-sidebar-accent-foreground
  --rezics-sys-color-sidebar-border
  --rezics-sys-color-sidebar-ring

State layer (opacities, used by overlay treatments):
  --rezics-sys-state-hover-opacity:    0.08
  --rezics-sys-state-focus-opacity:    0.12
  --rezics-sys-state-pressed-opacity:  0.12
  --rezics-sys-state-dragged-opacity:  0.16

Focus ring:
  --rezics-sys-color-ring                 (== shadcn --ring; usually == --primary)

Motion:
  --rezics-sys-motion-duration-short1   :  50ms
  --rezics-sys-motion-duration-short2   : 100ms
  --rezics-sys-motion-duration-short3   : 150ms (alias: rezics-motion-fast)
  --rezics-sys-motion-duration-short4   : 200ms
  --rezics-sys-motion-duration-medium1  : 250ms (alias: rezics-motion-base)
  --rezics-sys-motion-duration-medium2  : 300ms
  --rezics-sys-motion-duration-medium3  : 350ms
  --rezics-sys-motion-duration-medium4  : 400ms (alias: rezics-motion-slow)
  --rezics-sys-motion-duration-long1    : 450ms
  --rezics-sys-motion-duration-long2    : 500ms (alias: rezics-motion-page)
  --rezics-sys-motion-duration-long3    : 550ms
  --rezics-sys-motion-duration-long4    : 600ms
  --rezics-sys-motion-duration-extra-long1 : 700ms
  --rezics-sys-motion-duration-extra-long2 : 800ms
  --rezics-sys-motion-duration-extra-long3 : 900ms
  --rezics-sys-motion-duration-extra-long4 : 1000ms
  --rezics-sys-motion-easing-linear                 : cubic-bezier(0, 0, 1, 1)
  --rezics-sys-motion-easing-standard               : cubic-bezier(0.2, 0, 0, 1)
  --rezics-sys-motion-easing-standard-decelerate    : cubic-bezier(0, 0, 0, 1)   (alias: rezics-ease-out)
  --rezics-sys-motion-easing-standard-accelerate    : cubic-bezier(0.3, 0, 1, 1)
  --rezics-sys-motion-easing-emphasized             : cubic-bezier(0.2, 0, 0, 1) (alias: rezics-ease-in-out)
  --rezics-sys-motion-easing-emphasized-decelerate  : cubic-bezier(0.05, 0.7, 0.1, 1)
  --rezics-sys-motion-easing-emphasized-accelerate  : cubic-bezier(0.3, 0, 0.8, 0.15)
  --rezics-sys-motion-easing-spring                 : cubic-bezier(0.34, 1.56, 0.64, 1)  (rezics-specific, non-MD3)

Radius (mostly stays as-is, retained at reference tier):
  --rezics-ref-radius-xs / -sm / -md / -lg / -xl / -2xl / -pill / -full
  Shadcn binding: --radius : var(--rezics-ref-radius-md)

Shadow (minimal palette, retained):
  --rezics-ref-shadow-1 / -2 / -3 / -modal
  Shadcn binding: shadcn slots reference these via the existing UnoCSS map.

Typography (reference tier; system tier exposes only role names):
  --rezics-ref-font-sans / -serif / -mono / -sans-cjk / -serif-cjk
```

**Why this list.** It is the union of (a) what shadcn slots already exist in `.theme-rezics`, (b) what MD3 roles we adopt (surface-container ladder, *-container variants, inverse roles), (c) what rezics has hand-built (sentiment-positive/-negative for review UX). It is *not* the union of every MD3 role. We skip MD3's `surface-bright` / `surface-dim` / `scrim` / `shadow-color` (no rezics consumer; if a future use case appears, it extends the list per Requirement governance). We skip MD3's tertiary if no concrete consumer needs a third brand color today; the rezics palette has one brand color and uses sentiment / semantic roles for the rest, so `tertiary` is reserved as a name and aliased to `accent` until a consumer needs a distinct value.

### Decision 3: Strategy B — wrapped, unprefixed-where-internal, scoped to `<html>`

The full token table is authored once under `.theme-rezics { … }`. Dark mode is `.theme-rezics[data-theme="dark"] { … }`. The selector is applied to `<html>`, not to a subtree.

**Why under a class selector and not at `:root`.** Authoring at `:root` is the implicit default and works fine when there's exactly one theme. Once we start documenting tokens in Storybook with mode toggles, *and* if rezics ever becomes a consumable design system used by another project, the class-scoped pattern keeps the design system isolatable — `<div class="theme-rezics">` works as a subtree marker for dual-theme demo screens. We pay no runtime cost for this; CSS class selector specificity is identical.

**Why apply to `<html>`.** Portal-rendered components (Radix Dialog, Tooltip, Dropdown, Toast) render into `document.body`. A subtree-scoped `.theme-rezics` would not cascade into portals. Applying to `<html>` solves this with zero special-casing in primitives.

**Why retain the `--rezics-` prefix on system-tier vars even though we're inside `.theme-rezics`.** The selector scope already isolates from external CSS, but we still need to distinguish *rezics-owned* vars from *shadcn-owned* vars at a glance when reading the file. `--rezics-sys-color-text-primary` reads as design-system, `--card` reads as shadcn. Each is consumed differently (the former by UnoCSS theme classes, the latter by shadcn primitive internals). One file, two consumer audiences, two prefixes — keeps the role legible without inventing a third namespace.

**Why dark mode is a sibling block, not a nested override.** Browsers parse a 600-line `.theme-rezics { … } .theme-rezics[data-theme="dark"] { … }` exactly as fast as a nested `@layer`. Sibling is plainer to read and works in every CSS file the design system needs (no `@layer` requirement on consumer apps).

### Decision 4: File split — `tokens.css` next to `uno-config.ts`, `base.css` separate

`package/ui/src/shared/styles/layers.css` (228 lines today) becomes:

- `package/ui/src/config/tokens.css` (≈300 lines after gap fill) — the entire `.theme-rezics` token table (ref / sys / comp / shadcn-superset slots) and the `[data-theme="dark"]` override block. Authored alongside `uno-config.ts` so theme work touches one folder.
- `package/ui/src/config/base.css` (≈30 lines) — `:lang()` font routing, `prefers-reduced-motion` global, the small set of legacy resets that previously cohabited `layers.css`. This is *baseline*, not tokens.

**Why next to `uno-config.ts`.** UnoCSS theme classes resolve to these CSS variables. When a designer adds a token, they add it to `tokens.css` and reference it from `uno-config.ts` in the same folder. Today they edit `shared/styles/layers.css` and `config/uno-config.ts` in two folders — the same logical change, two file-tree locations.

**Why split baseline out.** Storybook needs tokens but not the baseline (Storybook has its own preview-level resets). The two app shells (`@rezics/app/src/app/App.tsx`, `@rezics/admin/src/app/App.tsx`) need both. Splitting lets each consumer import only what they need; keeps Storybook bundles smaller; makes the design-system / app-shell boundary explicit.

**Why not three files (one for each tier).** Tier separation lives inside `tokens.css` as comment-banner sections (`/* === REFERENCE TIER === */`, etc.), not as separate files. The whole point of three tiers is that they're read together — splitting them across files makes "where does this color come from?" a multi-file grep. One file, three sections, one read.

### Decision 5: `components.json` path moves

`package/ui/components.json` `tailwind.css` field moves from `src/shared/styles/layers.css` to `src/config/tokens.css`. Future shadcn CLI runs read tokens from the canonical location and any new generated primitive references the tokens already-defined. A back-compat shim (`src/shared/styles/layers.css` re-exports `config/tokens.css` and `config/base.css`) lives through the change and is deleted in the final task once the eight entry points are repointed.

### Decision 6: Legacy generation token names stay as live `@deprecated` aliases

The 11-name legacy list — `rezics-color-fg`, `-fg-muted`, `-bg`, `-bg-muted`, `-bg-canvas`, `-bg-elevated`, `-bg-hover`, `-bg-selected`, `-primary`, `-secondary`, `-accent` — is kept in `tokens.css` as alias declarations:

```css
.theme-rezics {
  /* @deprecated Use --rezics-sys-color-on-surface instead. Removed when consumers migrate (proposal 2). */
  --rezics-color-fg: var(--rezics-sys-color-on-surface);
  /* @deprecated Use --rezics-sys-color-on-surface-variant instead. */
  --rezics-color-fg-muted: var(--rezics-sys-color-on-surface-variant);
  /* @deprecated Use --rezics-sys-color-surface instead. */
  --rezics-color-bg: var(--rezics-sys-color-surface);
  /* … etc. for the 11-name list */
}
```

**Why keep them.** Migrating 364+ references inside this token-architecture change makes it a 200-file PR. Splitting into two changes lets reviewers reason about token architecture (this proposal) and consumer-code migration (proposal 2) separately. The aliases cost nothing at runtime — same CSS variable graph, one extra `var()` indirection, browser resolves at parse time.

**Why deprecate, not delete.** Each alias has a `@deprecated` comment naming its successor and the migration's target proposal. A grep-based audit at the end of proposal 2 confirms zero consumer references; the follow-up change deletes them. This avoids mid-flight breakage and gives proposal 2 the freedom to migrate file-by-file.

### Decision 7: Adopt MD3 motion verbatim, alias rezics names into the ladder

The MD3 16-step duration ladder (50–1000ms across short/medium/long/extra-long) and the MD3 5-curve easing set (`linear, standard, standard-decelerate, standard-accelerate, emphasized, emphasized-decelerate, emphasized-accelerate`) are adopted as system-tier tokens verbatim. The rezics-specific names (`fast/base/slow/page` durations, `out/in-out/spring` easings) are kept as named aliases pointing into the MD3 ladder:

```
--rezics-motion-fast    → var(--rezics-sys-motion-duration-short3)        (150ms)
--rezics-motion-base    → var(--rezics-sys-motion-duration-medium1)       (250ms)
--rezics-motion-slow    → var(--rezics-sys-motion-duration-medium4)       (400ms)
--rezics-motion-page    → var(--rezics-sys-motion-duration-long2)         (500ms)
--rezics-ease-out       → var(--rezics-sys-motion-easing-standard-decelerate)
--rezics-ease-in-out    → var(--rezics-sys-motion-easing-emphasized)
--rezics-ease-spring    → cubic-bezier(0.34, 1.56, 0.64, 1)               (rezics-specific, non-MD3)
```

**Why adopt MD3 verbatim.** Motion is the strongest engineering contribution in MD3 — the duration ladder and easing curves are tuned for perceptual smoothness across thousands of UI transitions. Apple HIG says "use spring-default with smooth/snappy/bouncy variants" but ships no token vocabulary. The hybrid: MD3 ladder is the *vocabulary*, Apple sensibility says *which* duration to choose for each interaction (mostly toward the shorter end of the ladder, with the spring easing for tactile responses).

**Why keep the rezics-specific spring.** Apple's "default" spring across iOS has a slight overshoot characteristic that matches the rezics-tactile-feedback aesthetic (rating-star bounce, button press). MD3's emphasized curve is decelerative without overshoot. Both have a place — keep `spring` as a named rezics easing distinct from MD3's emphasized.

### Decision 8: State-layer is opacity-driven, not visual-bleed

State-layer adoption is the *opacity ladder* (8/12/12/16) plus the *role-based color choice* (the overlay color is the corresponding `on-*` role, ensuring contrast in both modes). The visual treatment is *not* MD3's full-bleed circular ripple. rezics applies the overlay as a quiet rectangular tint matching the borderless aesthetic.

UnoCSS exposure (added in proposal 1's `uno-config.ts` review):

```ts
shortcuts: {
  'state-hover': 'before:absolute before:inset-0 before:bg-current before:opacity-0 hover:before:opacity-[var(--rezics-sys-state-hover-opacity)]',
  'state-focus': '…',
  'state-pressed': '…',
}
```

**Why this and not 5/10/15/20.** The MD3 8/12/12/16 ladder is contrast-tested and accessibility-vetted. Inventing rezics-specific numbers gains nothing.

**Why no ripple.** Ripple is a Material Design visual signature explicitly at odds with the rezics borderless-parchment aesthetic. Keeping the opacity behavior without the ripple is the whole point of "adopt architecture, not visual style."

### Decision 9: uno-config overrides are kept in full

The codebase audit confirmed every current `uno-config.ts` override is either brand-specific (Foundation v1 colors, CJK-aware fonts, semantic motion names) or architectural (minimal shadow palette, custom radius scale). Zero overrides are redundant restatements of Tailwind v4 defaults. The user's original concern (P3: "don't override Tailwind 4 unnecessarily") is *already satisfied* by the current config. No keys are removed.

The one cosmetic change in this proposal: re-organize the `theme.colors` object in `uno-config.ts` to mirror the system-tier role taxonomy (surface family, brand family, …, state, motion) so authors reading uno-config.ts see the same structure as `tokens.css`. Same content, two files reorganized in lockstep.

### Decision 10: Contrast invariant becomes a script, not an afterthought

A new script, `tool/scripts/check-tokens.ts`, asserts:
- Every `surface-*` ↔ `on-surface-*` pair clears 4.5:1 in light AND dark modes.
- Every `*-container` ↔ `on-*-container` pair clears 4.5:1.
- Every `primary` / `error` / `warning` / `info` / `success` ↔ corresponding `on-*` pair clears 4.5:1.
- Every `outline` / `outline-variant` clears 3:1 against its target surface.

Implemented using `culori` (already a transitive dep via UnoCSS) for color parsing, no new dep. Run by `bun run check:tokens` and added to the convention check umbrella so CI catches contrast regressions.

**Why a script not just a Storybook gallery.** Galleries help humans audit; scripts catch regressions when a designer shifts a tone in `tokens/colors.ts`. Both have a role; this change adds the script (the gallery comes in proposal 3).

## Trade-offs

- **One big tokens.css vs split-by-tier.** Chose one file for one-grep navigation. Trade-off: the file gets long (~300 lines after gap fill). Mitigated by section banners and one consistent ordering (surface → brand → state-color-roles → state-layer → motion → typography → spacing → radius → shadow).
- **Keep legacy aliases vs migrate now.** Chose keep. Trade-off: the file carries 11 deprecated names through proposal 2. Mitigated by the explicit `@deprecated` comments and a follow-up deletion change.
- **MD3 motion ladder vs rezics 4-name set.** Chose MD3 ladder + rezics aliases. Trade-off: 16 duration tokens may feel like overkill for a project of rezics' size. Mitigated by the alias map — most rezics code keeps using `motion-fast / -base / -slow / -page`, the full ladder is available when designers reach for it.
- **`<html>` placement of `.theme-rezics` vs subtree.** Chose `<html>`. Trade-off: a future "embed this rezics-themed component inside a non-rezics host" use case is out of scope. Acceptable — rezics is application-internal today.
- **Strict superset of shadcn vs rezics-namespace-only.** Chose superset. Trade-off: if shadcn upstream adds a new slot in v5, rezics has to extend its system tier to accept it. Mitigated by the role-list governance Requirement (any new slot requires the system-tier role to exist first).
- **Three-tier vs two-tier.** Chose three. Trade-off: adds a `ref/sys/comp` mental model. Mitigated by Storybook docs in proposal 3 and the small component-tier (only authored where the binding is non-obvious).

## Open Questions

- Will the `tertiary` role family ship with distinct values, or stay aliased to `accent`? Default: aliased until a concrete consumer needs distinct tones. Confirmed when the rezics palette gets its first three-color combination need (likely the chart palette work in proposal 3).
- Should `surface-container-{lowest,low,…,highest}` be five steps or three? MD3 ships five; rezics borderless-parchment may only need three (canvas / card / elevated). Default: ship all five at the system tier; UnoCSS exposes only the three rezics-canonical names; the other two are reserved for future use. Proposal 3 documents which three are canonical.
- Does the back-compat shim `shared/styles/layers.css` get deleted at the end of this change or carried into proposal 2? Default: delete at the end of this change. The eight entry points are short and well-known; repointing all of them in this PR is cleaner than a phased delete.
- Should the contrast-check script run as part of `bun run check:convention` or as a separate `bun run check:tokens`? Default: separate. Convention-check is fast and runs on every commit; token-check parses CSS variables and compares OKLCH distances, slower. Run on PR merge gate, not pre-commit.
