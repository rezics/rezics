## Context

Three input streams converge in this proposal: the Apple HIG research, the MD3 research, and the codebase audit. Each contributed specific findings that shape the design.

**From Apple HIG.** The 4-tier label hierarchy (largeTitle / title / headline / body) is structurally simpler than MD3's 11-style Dynamic Type. Apple's spring-default motion (smooth / snappy / bouncy variants) ships no token vocabulary but is deeply opinionated about *which* duration feels tactile (mostly toward the shorter end of the ladder). Materials-over-shadows is Apple's elevation philosophy: depth is communicated by background blur, color shift, or vibrancy, not by `box-shadow`. The 44pt minimum touch target is a hard accessibility floor. SF Symbols' 9 weights × 3 scales × 4 rendering modes is a vast icon system; rezics' lucide-react default is a similar idea at lower fidelity. The "ellipsis for dialogs" writing convention in HIG is a fine-grained voice choice that didn't make it into rezics' voice doc but should.

**From MD3.** The 3-tier ref/sys/comp token model. The 8/12/12/16 state-layer opacity ladder. The 16-step duration ladder + 7 easing curves. The HCT 40/80 contrast invariant (adopted as a *test* via proposal 1's `check:tokens` script). The role vocabulary including `*-container` variants and the `surface-container-{lowest,low,…,highest}` ladder. The 4dp-step density model (default / -1 / -2 / -3) — adopted as a *three-mode user-facing system* (compact / comfortable / spacious), not the four-step engineering one, because the rezics-borderless aesthetic needs gentler step boundaries than MD3's pointer-driven dense data UIs.

**From the codebase audit.** 39 shadcn primitives at 0% story coverage — the largest single content gap. 14 rezics primitives at 92.9% (one missing — Spinner most likely). 21 composites at 100%. The contrast invariant: the audit confirmed every existing rezics light/dark pair clears 4.5:1 in the legacy palette; the new system-tier additions (proposal 1) need verification, which the contrast script provides. The audit captures `--radius` as a literal `0.5rem` in `.theme-rezics` (fixed by proposal 1) and the shadcn-superset gap (also fixed by proposal 1). Story coverage is the dominant remaining issue.

This proposal is the synthesis of those three streams as a *visible* artifact. It is the first time the rezics design system has end-to-end documentation living next to the code.

## Goals

- A contributor opens `bun -F @rezics/ui storybook` and lands on a Foundation page that immediately communicates the rezics philosophy.
- Every token in proposal 1's role list is visualized — every color swatch, every type sample, every spacing step, every motion duration, every easing curve, every elevation tier.
- Every Pattern page demonstrates the rule with a live demo and a do/don't pair.
- The three-mode density system is a working feature, not a documented intent. A toolbar entry switches it. Components react. Storybook shows it side by side.
- All 39 shadcn primitives have stories. New contributors can copy the story for the closest existing primitive.
- The Apple HIG and MD3 research is cited *in place* in the docs — not buried in spec text. Each Foundation page has a "Reference" callout naming the research source and the rezics-specific divergence.
- The design system surface is decoupled from token-config status. A new color token shows up in the Foundation page even if `uno-config.ts` doesn't yet expose a UnoCSS short name for it. The user's earlier feedback explicitly: "rezics token always exists even without override; storybook does not show override status".

## Non-Goals

- Restyling primitives. Stories show the existing visual state; restyling is captured in follow-up issues.
- Multi-package Storybook composition changes. The host + 5-package topology stays.
- Adding new primitives. The "on-demand" rule still applies.
- Migrating mock data to live data. Stories use `*.fixture.ts` per the existing MOCK convention.
- Public Storybook deployment.
- Any change to `convention-enforcement` (R-rules) — that's proposal 2's scope.

## Decisions

### Decision 1: Density is three modes, not four

MD3 specifies 4 density steps (default, -1, -2, -3). Apple HIG doesn't have a comparable knob — Apple's density story is "the platform decides." rezics chooses **three user-facing modes**: `compact`, `comfortable`, `spacious`.

- `compact` — admin tables, editor toolbars, debug-overlay components, dense data lists. Maps to MD3 step -2.
- `comfortable` — the default for application content. Cards, navigation, forms, dialogs. Maps to MD3 step 0.
- `spacious` — hero sections, reading view, onboarding flows. Maps roughly to MD3 step +1 (which MD3 doesn't have; rezics extends one step beyond MD3's "default" into reading-friendly air).

The system-tier token implementing this:

```css
.theme-rezics[data-density="compact"]     { --rezics-sys-density-step: -4px; }
.theme-rezics[data-density="comfortable"] { --rezics-sys-density-step:  0px; } /* default */
.theme-rezics[data-density="spacious"]    { --rezics-sys-density-step: +6px; }
```

Where the density steps end up actually applied is in component-tier tokens. Example:

```css
.theme-rezics {
  --rezics-comp-table-row-padding-y: calc(8px + var(--rezics-sys-density-step));
  --rezics-comp-list-item-padding-y: calc(12px + var(--rezics-sys-density-step));
  --rezics-comp-toolbar-padding-y:  calc(8px + var(--rezics-sys-density-step));
  --rezics-comp-form-control-padding-y: calc(8px + var(--rezics-sys-density-step));
}
```

Not every component opts in. The opt-in list:
- `Table` row, `List` item, `Toolbar`, `FormControl` (TextField + Select + Combobox), `Sidebar` item, `Editor` toolbar, `MenuItem`, `TabsList` item, `Breadcrumb` item, `CommandPalette` item.

Components that *do not* opt in (always render at the comfortable default):
- Hero sections, reading view, book covers, dialog content surfaces, onboarding screens, marketing surfaces.

**Why three modes, not MD3's four.** Three is enough discrimination for application UX (low-information density / default / leisurely), and the labels (`compact` / `comfortable` / `spacious`) communicate intent better than `-2 / 0 / +1`. MD3's four-step ladder is engineered for pointer-driven dense pro tools; rezics is reading-and-browsing software with admin areas, so the asymmetry "1 dense step, 1 default, 1 leisurely" matches the actual use cases.

**Why density never affects type.** Apple HIG and MD3 both forbid this for legibility — type size carries information, and density that re-flows type breaks reading habits. rezics adopts the same constraint. Density affects only padding, gap, min-height, and similar spacing dimensions.

**Why `data-density` not class.** Class-based `density-compact` / `density-comfortable` would conflict with shadcn primitive class lists. Attribute-based `[data-density="compact"]` lives in the same namespace as `[data-theme="dark"]` and is consistent with the `.theme-rezics` selector pattern from proposal 1.

**Why on the same scope as `.theme-rezics`.** Density needs to propagate to portals (Dialog, Tooltip), so it shares the `<html>` placement. Toolbar updates `<html data-density="…">` directly.

### Decision 2: Foundation pages are seven, not six

`design-system-storybook/spec.md` Requirement-4 specified six MDX galleries: colors, typography, spacing, radius, elevation, motion. This change adds a seventh: **Iconography**. Reasons:

- Lucide-react is the canonical icon library after `deprecate-mui`. It deserves a Foundation page showing the rezics standard sizes (16 / 20 / 24px), the canonical mapping table from former MUI icons to lucide names, the named-fallback rule (when lucide lacks a glyph, use `@tabler/icons-react`), and a sample of which icons appear in which contexts (which means is the lucide adoption already spreading consistently across the app).
- Apple HIG ships SF Symbols with 9 weights × 3 scales × 4 rendering modes; lucide doesn't have that fidelity, but rezics can still document its three sizes and three weights (regular / semibold / bold via the lucide `strokeWidth` prop).

The seven Foundation pages:

| # | Title | Source | Apple/MD3 reference |
|---|-------|--------|---------------------|
| 1 | Foundation/Tokens/Colors | `package/ui/src/docs/tokens/colors.mdx` | MD3 role taxonomy, HCT contrast invariant |
| 2 | Foundation/Tokens/Typography | `…/typography.mdx` | Apple 4-tier label hierarchy (largeTitle/title/headline/body) |
| 3 | Foundation/Tokens/Spacing | `…/spacing.mdx` | MD3 4dp grid, rezics 4-px-grid mapping |
| 4 | Foundation/Tokens/Radius | `…/radius.mdx` | rezics 8-step scale (xs/sm/md/lg/xl/2xl/pill/full); Apple's continuous radius is mentioned as a "differs from rezics" note |
| 5 | Foundation/Tokens/Elevation | `…/elevation.mdx` | Apple materials-over-shadows; MD3 tonal elevation; rezics surface-container ladder as the canonical mechanism |
| 6 | Foundation/Tokens/Motion | `…/motion.mdx` | MD3 16-duration + 7-easing ladder; Apple spring-default with rezics-spring custom curve |
| 7 | Foundation/Tokens/Iconography | `…/iconography.mdx` | lucide-react default; tabler fallback; rezics 16/20/24 sizes; canonical mapping table |

Each page renders live tokens via the shared `_gallery.tsx` helpers (already specified in `design-system-storybook` Requirement-4) and includes a "Reference" callout naming the Apple HIG and MD3 sources with one-line summaries.

### Decision 3: Patterns pages are six, not "TBD"

The current `design-system-storybook` spec has no Patterns pages explicitly — only references to `Foundation/Patterns` for the abstraction-vs-split rule (cluster overview docs reference it). This change makes Patterns a first-class section with six pages:

| # | Title | Concept |
|---|-------|---------|
| 1 | Foundation/Patterns/Parchment Voice | The rezics philosophy: borderless cards, parchment canvas, brand-fill is fill-only, depth-via-color-not-shadow, ellipsis-for-dialogs writing. Do/don't pairs. The Apple HIG "feel" + the rezics-specific divergences. |
| 2 | Foundation/Patterns/Density | Live three-mode demo (compact / comfortable / spacious) with a representative composite (probably Toolbar + FormControl + List). Toolbar entry in Storybook lets the page user flip modes. |
| 3 | Foundation/Patterns/State Layer | Hover / Focus / Pressed / Dragged demos showing the 8/12/12/16 ladder applied as quiet rectangular tints. Includes a "what we don't do" sample showing MD3's full-bleed circular ripple as the rejected alternative. |
| 4 | Foundation/Patterns/Depth Without Shadow | Live demo of the surface-container ladder (canvas → low → high) showing how depth is communicated by tonal shift, not shadow. Modal is the *one* exception (uses shadow-modal token); shown as the rule that proves the principle. |
| 5 | Foundation/Patterns/Inverse Surface | Snackbars, dark-on-light pull-quotes, "switch to dark mode" preview button. When and when not to use inverse-surface. |
| 6 | Foundation/Patterns/Layout & Breakpoints | Single page covering the rezics breakpoints (xsm:450px, sm:640px, md:768px, lg:1024px, xl:1280px, 2xl:1536px, 8xl:1440px), container widths, the rationale for `xsm` and `8xl` as rezics-specific additions. |

Plus the existing `Foundation/Patterns` abstraction-vs-split page (already required by `design-system-storybook` spec) — that becomes a seventh Pattern page, but it's not new in this change; it's documented elsewhere.

### Decision 4: shadcn primitives get full story coverage in this change

39 shadcn primitives, 0% coverage today. This is the largest content gap and the highest-leverage fix.

**Per-primitive story file structure.** Each `package/ui/src/shadcn/<primitive>/<Primitive>.stories.tsx` covers, at minimum:
- `Default` — the most-common rendering.
- One story per documented variant (e.g. Button: `Default`, `Secondary`, `Outline`, `Ghost`, `Link`, `Destructive`).
- `Disabled` (where the primitive supports a disabled state).
- `Loading` (where applicable, e.g. Button with `pending` prop).
- `InsideCard` / `InsideDialog` / `InsideSidebar` for primitives where the surrounding surface affects the visual read (Button, FormControl, Badge, Tabs).
- `WithDensity` (where the primitive is in the density opt-in list — this story renders three side-by-side at compact / comfortable / spacious).

A small set of primitives has more visual variants and therefore more stories. The test is: every documented user-facing variant has a story. Stories are short (≤30 lines each); the file structure is consistent across all 39 primitives so a contributor can clone the closest existing primitive's story file and adapt.

**Why all 39 in one change.** Spreading them across changes leaves the design system in a partially-documented state for too long. The work is mechanical (copy a 30-line file, swap the import, customize the variants). The aggregate cost is ~1,200 lines of stories across 39 files; the individual files are tractable.

### Decision 5: Storybook Density toolbar mirrors the Theme toolbar

`package/storybook-config/src/preview.tsx` adds a global toolbar entry for density alongside the existing theme toggle. The two are independent axes:

- Theme: Light / Dark — updates `<html data-theme="…">`.
- Density: Compact / Comfortable / Spacious — updates `<html data-density="…">`.

Storybook's `globalTypes` mechanism handles both. When the user switches one, the other persists. Stories never need to opt out — the global is decorating-via-decorator, applied everywhere.

The Density toolbar appears in every package's Storybook (the shared config provides it; per-package previews inherit). Stories for components that don't opt into density still render at every density level (they just look identical at all three).

### Decision 6: Foundation pages cite research sources inline

Each Foundation page ends with a "Reference" callout (rendered as a styled MDX block) that:
- Names the Apple HIG / MD3 spec page.
- States the rezics-specific divergence in one line.

Example for `Foundation/Tokens/Motion`:
> **Reference.** rezics motion adopts the MD3 duration ladder (50–1000ms in 16 steps) and easing curves (standard / standard-decelerate / standard-accelerate / emphasized variants) verbatim, plus a rezics-specific `spring` curve for tactile feedback (`cubic-bezier(0.34, 1.56, 0.64, 1)`). Apple HIG ships no token vocabulary; we use HIG's spring-default sensibility to choose *which* duration to default to (mostly the shorter end). MD3 source: m3.material.io/styles/motion/easing-and-duration. Apple source: developer.apple.com/design/human-interface-guidelines/motion.

This keeps the research visible. A contributor reading the Motion page knows where the values came from and where the rezics decisions diverged.

### Decision 7: Patterns pages explicitly state the "we don't do this" alternatives

The Apple HIG / MD3 hybrid means rezics adopts some things and rejects others. The Patterns pages are the right place to make these rejections *visible* — not as critique of MD3 but as clarification of intent. Examples:

- Patterns/State Layer: shows MD3's full-bleed circular ripple as the "we don't do this" sample. Reason: rezics borderless aesthetic; ripple's organic-spread visual signature reads as Material brand, not rezics brand.
- Patterns/Depth Without Shadow: shows a sample of MD3's dp shadow ladder (Level 1 / Level 3 / Level 5) as the "we don't do this." Reason: shadow is reserved for modals only in rezics; in-flow depth is tonal.
- Patterns/Parchment Voice: shows a glossy-glass-dashboard sample (Tailwind Catalyst / shadcn-default) as the "we don't do this." Reason: rezics is parchment-archive, not glass-dashboard.

Each rejection is paired with a *replacement* — what we do instead and why.

### Decision 8: Storybook reads tokens from CSS, not from TS

The Foundation pages use `getComputedStyle(document.documentElement).getPropertyValue("--rezics-sys-color-text-primary")` (or equivalent) to read live token values rather than importing the TS token modules. Reasons:

- Round-trips through the `.theme-rezics` cascade exactly the way real consumers do — tokens that work in stories work in production.
- Theme switching automatically updates the gallery without re-fetching from a TS source.
- Decouples the gallery from the TS-export shape — tokens that aren't exported as TS still appear in the gallery.

The `_gallery.tsx` helper provides a `useToken(name: string)` hook that wraps `getComputedStyle` reads and re-runs on `[data-theme]` / `[data-density]` change.

### Decision 9: Density implementation is a single PR phase

Density is the only "real implementation" addition in this proposal — every other piece is documentation. Implementation phase order:

1. Author the system-tier `--rezics-sys-density-step` token in `tokens.css` (proposal 1's `tokens.css` is extended).
2. Author the component-tier tokens for the opt-in list (~10 components × 2-3 dimensions each = ~25 tokens).
3. Update each opt-in component's source CSS / className strings to consume the component-tier tokens.
4. Update each opt-in component's existing story file to add a `WithDensity` axis story.
5. Author the global Density toolbar in `package/storybook-config/src/preview.tsx`.
6. Author the `Foundation/Patterns/Density` MDX page using the live demo.

Steps 3–4 are the bulk of the diff. Step 3 changes ~30 component source files; step 4 adds ~10 new stories.

### Decision 10: Story coverage of shadcn primitives uses an inventory table, not a discovery scan

`package/ui/src/shadcn/` has a known list of primitives. The change author hand-lists all 39 in `tasks.md` Phase 5; each gets a checkbox; no primitive is missed. Reasons:

- A discovery scan ("for each .tsx in shadcn/, ensure a sibling .stories.tsx exists") risks missing edge cases (primitives that ship multiple components in one file, primitives with non-standard naming).
- A hand-list is small and explicit. Reviewers can see "Spinner story" as a checkbox and confirm it's done.

Decision: tasks.md enumerates the 39 primitives.

## Trade-offs

- **Three-mode density vs MD3 four-step.** Chose three. Trade-off: less continuous tunability. Acceptable — application UX rarely needs four steps; the three-mode labels are clearer.
- **Density attribute scope on `<html>` vs subtree.** Chose `<html>`. Trade-off: a future "this section uses compact density even though the rest of the app is comfortable" pattern becomes harder. If that case arises, the spec is amended; today there is no such case.
- **Storybook reads from CSS via `getComputedStyle` vs TS imports.** Chose CSS. Trade-off: the gallery has a tiny perf overhead on every theme/density switch. Negligible; values are cached after first read.
- **One change for all 39 shadcn stories vs phased.** Chose one. Trade-off: large PR. Mitigated by the per-primitive file structure (each ≤30 lines, mostly mechanical).
- **Patterns pages with explicit "we don't do this" samples vs positive-only.** Chose explicit rejection samples. Trade-off: the page is longer. Acceptable — the rejection is the *thing the page is teaching*; without it the page is just a positive example with no reason to exist.
- **Foundation/Patterns/Density vs shipping density without docs.** Chose to ship density and document it together. Trade-off: more in this change. Justified — density is the user's explicit ask, and an undocumented feature would silently regress.

## Open Questions

- Do the density steps `-4px` / `0px` / `+6px` need calibration? Default values are educated guesses informed by MD3 (-4dp per step) and rezics' more breathable baseline. Implementation phase will refine via visual test of the three-mode demo at `Foundation/Patterns/Density`. If the gap between modes feels off, adjust before this change ships.
- Does Storybook's `globalTypes` toolbar support icons, or only text labels? Default: use text labels. If icons cleanly available via the existing addon configuration, switch to lucide icons (`Maximize2` / `Square` / `Minimize2`). Optional polish.
- Should the `Foundation/Patterns/Inverse Surface` page also document the snackbar primitive's surface use? Default: yes, since snackbars are the canonical inverse-surface consumer.
- Where do the 39 shadcn-primitive stories live in Storybook's tree? Default: under a `Primitives/` top-level group (`Primitives/Button`, `Primitives/Dialog`, etc.). Already implied by the `design-system-storybook` spec but not explicit. Confirm by reviewing the existing 14 rezics-primitive stories' tree placement.
- Does this change need to interact with the open-question from proposal 1 about the `tertiary` role family? Default: no — Foundation/Tokens/Colors documents whatever the system-tier ships; if `tertiary` is aliased to `accent` in proposal 1's final state, the gallery shows them as one entry with a note.
