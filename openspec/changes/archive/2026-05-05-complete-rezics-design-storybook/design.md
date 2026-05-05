## Context

Three input streams converge in this proposal: the Apple HIG research, the MD3 research, and the codebase audit. Each contributed specific findings that shape the design.

**From Apple HIG.** The 4-tier label hierarchy (largeTitle / title / headline / body) is structurally simpler than MD3's 11-style Dynamic Type. Apple's spring-default motion (smooth / snappy / bouncy variants) ships no token vocabulary but is deeply opinionated about *which* duration feels tactile (mostly toward the shorter end of the ladder). Materials-over-shadows is Apple's elevation philosophy: depth is communicated by background blur, color shift, or vibrancy, not by `box-shadow`. The 44pt minimum touch target is a hard accessibility floor. SF Symbols' 9 weights × 3 scales × 4 rendering modes is a vast icon system; rezics' lucide-react default is a similar idea at lower fidelity. The "ellipsis for dialogs" writing convention in HIG is a fine-grained voice choice that didn't make it into rezics' voice doc but should.

**From MD3.** The 3-tier ref/sys/comp token model. The 8/12/12/16 state-layer opacity ladder. The 16-step duration ladder + 7 easing curves. The HCT 40/80 contrast invariant (adopted as a *test* via the contrast script). The role vocabulary including `*-container` variants and the surface ladder. The 4dp-step density model is the engineering inspiration but is **not** adopted as a runtime toggle — rezics treats density as per-component-type intrinsic (each component has one correct spacing tier baked into its design vocabulary), not as a user-facing knob.

**From the codebase audit (re-run 2026-05-04).** 30 shadcn primitives at 0% story coverage — the largest single content gap. 14 rezics primitives at 92.9% (the missing one is `TextButton`). 21 composites at 100%. 6 of 7 Foundation MDX galleries already shipped under `package/ui/src/docs/tokens/`, authored against the post-`unify-tokens-single-source` `--colors-*` namespace; only Iconography remains. Two patterns docs already exist: `docs/voice.mdx` (Foundation/Voice) and `docs/patterns.mdx` (Foundation/Patterns). The `--rezics-*` namespace is retired and R9 in `check:convention` bans every `var(--rezics-*)` reference plus asserts `tokens.css` does not exist.

This proposal is the synthesis of those three streams as a *visible* artifact. It is the first time the rezics design system has end-to-end documentation living next to the code.

## Goals

- A contributor opens `bun -F @rezics/ui storybook` and lands on a Foundation page that immediately communicates the rezics philosophy.
- Every token in the role list is visualized — every color swatch, every type sample, every spacing step, every motion duration, every easing curve, every elevation tier, every icon size.
- Every Pattern page demonstrates the rule with a live demo and a do/don't pair.
- The density vocabulary is a documented, instrumented surface. The nine `--padding-*` tokens are emitted as fixed values by the preflight, the rezics-authored opt-in components consume them, and the Foundation/Patterns/Density page visualizes the resulting spacing ladder.
- All 30 shadcn primitives have stories. New contributors can copy the story for the closest existing primitive.
- The Apple HIG and MD3 research is cited *in place* in the docs — not buried in spec text. Each Foundation page has a "Reference" callout naming the research source and the rezics-specific divergence.

## Non-Goals

- Restyling primitives. Stories show the existing visual state; restyling is captured in follow-up issues.
- Multi-package Storybook composition changes. The host + 5-package topology stays.
- Adding new primitives. The "on-demand" rule still applies.
- Migrating mock data to live data. Stories use `*.fixture.ts` per the existing MOCK convention.
- Public Storybook deployment.
- Any change to `convention-enforcement` (R-rules) — out of scope.
- Re-introducing the `--rezics-*` namespace or `tokens.css` — both retired by `unify-tokens-single-source`. Density tokens land in the modern flat namespace.

## Decisions

### Decision 1: Density is per-component-type intrinsic; the vocabulary is nine fixed-value padding tokens

**The model.** Density is a property of the *component type*, not the *user session*. A `Table` row is naturally dense (data scanning), a hero section is naturally spacious (it breathes), a `MenuItem` sits in between. These are design-time facts baked into each component, not runtime preferences. There is no toolbar that flips compact/comfortable/spacious; there is no `<html class="density-compact">`; there is no `--density-step`.

**The vocabulary.** The preflight in `uno-config.ts` emits nine component-tier `--padding-*` tokens at fixed values:

```css
:root, :host {
  --padding-breadcrumb-y:   4px;  /* tightest — sibling-of-text affordance */
  --padding-menu-item-y:    6px;  /* dropdown rows */
  --padding-table-row-y:    8px;
  --padding-toolbar-y:      8px;
  --padding-formfield-y:    8px;
  --padding-sidebar-item-y: 8px;
  --padding-tab-item-y:     8px;
  --padding-command-item-y: 8px;
  --padding-list-item-y:    12px; /* loosest — touch-affinity rows */
}
```

The values describe a deliberate ladder: `4 / 6 / 8 / 12`. Breadcrumb is tightest because it lives in a sentence; menu items run inside dropdown popovers and want denser stacks; the cluster at 8px is the rezics "default repeating-row tier"; list items are loosest because they're often the primary touch target on a page.

These nine tokens are the **closed density vocabulary** for rezics-authored components. Adding a tenth requires an OpenSpec change.

**The opt-in list** (rezics-authored components consuming the vocabulary):
- `Table` row, `List` item, `Toolbar`, FormField (TextField + Select + Combobox), `Sidebar` item, `MenuItem`, `TabsList` item, `Breadcrumb` item, `CommandPalette` item.

**The opt-out list** (rezics-authored components using ad-hoc spacing utilities):
- Hero sections, reading view, book covers, dialog content surfaces, onboarding screens, marketing surfaces.

**Vendored shadcn primitives are not patched.** The vocabulary applies to rezics-authored code (`package/ui/src/primitive/`, `package/ui/src/composite/`, app-level composites). Vendored shadcn primitives in `package/ui/src/shadcn/` consume the spacing values shadcn ships with — patching them to consume rezics tokens would create a divergence drift surface every time shadcn updates. (See `migrate-shadcn-to-base-ui-luma` for the rezics-tokens-vs-shadcn-tokens boundary.)

**Why density never affects type.** Apple HIG and MD3 both forbid this for legibility — type size carries information, and density that re-flows type breaks reading habits. rezics adopts the same constraint. The vocabulary contains only spacing-named tokens; no `--font-*` token varies by component type.

**Why no runtime toggle.** Three reasons:

1. *Cost.* A runtime toggle requires a `density-compact` / `density-spacious` cascade root, decorator wiring, three stories per primitive (`Compact` / `Comfortable` / `Spacious` × every story file), per-app density-class plumbing, and review burden on every spacing decision ("does this opt in to density or not?"). The cost compounds across 30 shadcn primitives + 14 rezics primitives + 21 composites.
2. *Lack of evidence.* The original 3-mode framing came from an MD3 reading; the user explicitly corrected it as "complex, do later" once the design intent (per-component intrinsic) was articulated. There is no concrete user surface today that benefits from a runtime toggle.
3. *Reversibility.* The current decision is intentionally narrow. If a future need emerges (e.g. an admin power-user mode that visibly tightens every list/table on the page), an OpenSpec change can introduce `--density-step` on top of the fixed-value vocabulary without a refactor — the calc-expression form would slot in cleanly.

### Decision 2: Foundation pages are seven; six already ship, Iconography is the missing one

`design-system-storybook/spec.md` Requirement-4 specified six MDX galleries: colors, typography, spacing, radius, elevation, motion. As of the codebase audit, all six exist under `package/ui/src/docs/tokens/`, authored against the modern `--colors-*` / `--font-*` / `--radius-*` / `--shadow-*` / `--duration-*` / `--easing-*` namespace. This change adds the **seventh: Iconography**.

| # | Title | Source | Status | Apple/MD3 reference |
|---|-------|--------|--------|---------------------|
| 1 | Foundation/Tokens/Colors | `package/ui/src/docs/tokens/colors.mdx` | exists; this change adds inline contrast badges | MD3 role taxonomy, HCT contrast invariant |
| 2 | Foundation/Tokens/Typography | `…/typography.mdx` | exists | Apple 4-tier label hierarchy |
| 3 | Foundation/Tokens/Spacing | `…/spacing.mdx` | exists | MD3 4dp grid, rezics preset-wind4 mapping |
| 4 | Foundation/Tokens/Radius | `…/radius.mdx` | exists | rezics 8-step scale |
| 5 | Foundation/Tokens/Elevation | `…/elevation.mdx` | exists | Apple materials-over-shadows; MD3 tonal elevation |
| 6 | Foundation/Tokens/Motion | `…/motion.mdx` | exists | MD3 16-duration + 7-easing ladder |
| 7 | Foundation/Tokens/Iconography | `…/iconography.mdx` | **NEW** | lucide-react default; Apple SF Symbols reference |

The Iconography page renders live samples at the rezics standard sizes (16 / 20 / 24 px), the canonical mapping table from former MUI icon names to lucide names for icons currently used in the codebase, and the named-fallback rule (when lucide lacks a glyph, use `@tabler/icons-react`).

The change does *not* rewrite the existing six pages. If a Reference callout or a contrast badge is missing on an existing page, that's a follow-up; otherwise the existing pages stay as-is.

### Decision 3: Patterns are seven; two already ship, five are new

The two existing patterns docs are not duplicated:

- `docs/voice.mdx` — Foundation/Voice — covers the parchment philosophy, the four mood pillars, the canvas/text/brand color choices, the typography family selection rationale. **This change does not replace it.** New patterns pages cross-link to it where the voice context applies.
- `docs/patterns.mdx` — Foundation/Patterns — covers abstraction-vs-split, do/don't pairs at the layout level. **This change does not replace it.** It stays at the docs root as the index page; new pattern detail pages live under `Foundation/Patterns/<Page>` titles in the new `docs/patterns/` directory.

The five new pages:

| # | Title | Concept |
|---|-------|---------|
| 3 | Foundation/Patterns/Density | Visualizes the nine-token `--padding-*` ladder (breadcrumb tightest → list-item loosest) and renders each density-bearing rezics component at its intrinsic spacing tier. Documents the opt-in/opt-out classification and the "density never affects type" rule. No mode switcher — density is per-component-type intrinsic, not runtime. |
| 4 | Foundation/Patterns/State Layer | Hover / Focus / Pressed / Dragged demos showing the 8/12/12/16 ladder applied as quiet rectangular tints. "We don't do this" sample showing MD3's full-bleed circular ripple as the rejected alternative. |
| 5 | Foundation/Patterns/Depth Without Shadow | Live demo of the canvas → base → elevated → subtle → sunken surface ladder showing how depth is communicated by tonal shift. `shadow-modal` is the *one* exception (modal-only); shown as the rule that proves the principle. |
| 6 | Foundation/Patterns/Inverse Surface | Snackbars, dark-on-light pull-quotes, "switch to dark mode" preview button. When and when not. |
| 7 | Foundation/Patterns/Layout & Breakpoints | Visual ruler of the rezics breakpoints (`xsm:450px`, `sm:640`, `md:768`, `lg:1024`, `xl:1280`, `2xl:1536`, `8xl:1440`), container widths, the `xsm`-and-`8xl` rezics-specific rationale. |

Pages 1 and 2 in this taxonomy are the existing Voice and Patterns docs; the new pages are 3–7.

### Decision 4: 30 shadcn primitives get full story coverage

The rezics fork of `package/ui/src/shadcn/` ships **30 primitives** (not the 39+ canonical-shadcn count). The actual list, confirmed by `ls package/ui/src/shadcn/` on 2026-05-04:

```
alert, avatar, badge, breadcrumb, button, card, carousel, chart,
checkbox, collapsible, command, context-menu, dialog, drawer,
dropdown-menu, input, label, popover, select, separator, sheet,
sidebar, skeleton, sonner, table, tabs, theme-switch, toggle,
toggle-group, tooltip
```

(`theme-switch` is a rezics-custom primitive co-located in `shadcn/` because it's chrome-tier and shipped with the theme system. It gets a story for completeness.)

**Per-primitive story file structure.** Each `package/ui/src/shadcn/<primitive>.stories.tsx` covers, at minimum:
- `Default` — the most-common rendering.
- One story per documented variant (e.g. Button: `Default`, `Secondary`, `Outline`, `Ghost`, `Link`, `Destructive`).
- `Disabled` (where the primitive supports a disabled state).
- `Loading` (where applicable, e.g. Button with `pending` prop).
- `InsideCard` / `InsideDialog` / `InsideSidebar` for primitives where the surrounding surface affects the visual read (Button, Input, Badge, Tabs).
Stories are short (≤30 lines each); the file structure is consistent across all 30 primitives so a contributor can clone the closest existing primitive's story file and adapt. **No `WithDensity` axis** — density is per-component-type intrinsic, not a runtime axis (Decision 1).

**Why all 30 in one change.** Spreading them across changes leaves the design system in a partially-documented state for too long. The work is mechanical (copy a 30-line file, swap the import, customize the variants). The aggregate cost is ~900 lines of stories across 30 files; the individual files are tractable.

### Decision 5: Storybook toolbar stays at one axis (Light/Dark only)

`package/storybook-config/src/preview.tsx` keeps its existing single global toolbar entry for theme (Light / Dark, toggling `<html class="dark">`). **No density toolbar is added.** This follows directly from Decision 1: density is per-component-type intrinsic, so there is nothing for a global toolbar to flip.

The Foundation/Patterns/Density page communicates density by *showing* — it renders each density-bearing rezics component side-by-side at its intrinsic spacing tier, so a viewer sees the breadcrumb-tightest → list-item-loosest ladder at a glance. This is a documentation surface, not a configuration UI.

### Decision 6: Foundation pages cite research sources inline

Each Foundation page ends with a "Reference" callout (rendered as a styled MDX block) that:
- Names the Apple HIG / MD3 spec page.
- States the rezics-specific divergence in one line.

Example for `Foundation/Tokens/Motion`:
> **Reference.** rezics motion adopts the MD3 duration ladder (50–1000ms in 16 steps) and easing curves (standard / standard-decelerate / standard-accelerate / emphasized variants) verbatim, plus a rezics-specific `spring` curve for tactile feedback (`cubic-bezier(0.34, 1.56, 0.64, 1)`). Apple HIG ships no token vocabulary; we use HIG's spring-default sensibility to choose *which* duration to default to (mostly the shorter end). MD3 source: m3.material.io/styles/motion/easing-and-duration. Apple source: developer.apple.com/design/human-interface-guidelines/motion.

This change adds the callout to the Iconography page and verifies the existing six pages already carry one (adding any that's missing as part of Phase 2 verification, not a separate task).

### Decision 7: Patterns pages explicitly state the "we don't do this" alternatives

The Apple HIG / MD3 hybrid means rezics adopts some things and rejects others. The Patterns pages are the right place to make these rejections *visible* — not as critique of MD3 but as clarification of intent. Examples:

- Patterns/State Layer: shows MD3's full-bleed circular ripple as the "we don't do this" sample. Reason: rezics borderless aesthetic; ripple's organic-spread visual signature reads as Material brand, not rezics brand.
- Patterns/Depth Without Shadow: shows a sample of MD3's dp shadow ladder as the "we don't do this." Reason: shadow is reserved for modals only in rezics; in-flow depth is tonal.
- Patterns/Density: shows MD3's runtime 4-step density toggle as the rejected alternative. Reason: rezics treats density as per-component-type intrinsic (each component has one correct spacing tier), so there is no need for users or apps to flip a knob — the design vocabulary already encodes the right answer per component.

Each rejection is paired with a *replacement* — what we do instead and why.

### Decision 8: Storybook reads tokens from CSS, not from TS

The Foundation pages use `getComputedStyle(document.documentElement).getPropertyValue("--colors-text-primary")` (or equivalent) to read live token values rather than importing the TS token modules. Reasons:

- Round-trips through the cascade exactly the way real consumers do — tokens that work in stories work in production.
- Theme/density switching automatically updates the gallery without re-fetching from a TS source.
- Decouples the gallery from the TS-export shape.

The existing `_gallery.tsx` helper in `package/ui/src/docs/tokens/_gallery.tsx` already implements this pattern; the four new Patterns-demo exports inherit it.

### Decision 9: Implementation phase order

The ordering reflects the post-`unify-tokens-single-source` reality (most Foundation work already done) and the dependency graph (density vocabulary needed before density-bearing composites can migrate).

1. **Phase 1** — Density vocabulary. Extend the preflight in `uno-config.ts` with the nine fixed-value `--padding-*` tokens. **No `preview.tsx` changes** (no density toolbar).
2. **Phase 2** — Iconography MDX page (the seventh Foundation entry). Verify the existing six Foundation pages still render and have Reference callouts.
3. **Phase 3** — Five new Patterns pages under `docs/patterns/`. Includes the four new `_gallery.tsx` exports the pages depend on.
4. **Phase 4** — Density-bearing composite migration. Each opt-in rezics-authored composite consumes the corresponding `--padding-*` token. Vendored shadcn primitives are not touched.
5. **Phase 5** — 30 shadcn-primitive stories + the 1 missing rezics-primitive story (`TextButton`).
6. **Phase 6** — Verification (build, type-check, contrast, convention).
7. **Phase 7** — CLAUDE.md + skill cross-links.

Phases 4 and 5 are the bulk of the diff. Phase 4 changes ~10 rezics-authored component source files. Phase 5 adds 31 story files (mostly mechanical).

### Decision 10: Story coverage of shadcn primitives uses an inventory list, not a discovery scan

The task list (`tasks.md` Phase 5) hand-enumerates all 30 primitives. Reasons:

- A discovery scan ("for each .tsx in shadcn/, ensure a sibling .stories.tsx exists") risks missing edge cases (primitives that ship multiple components in one file, primitives with non-standard naming).
- A hand-list is small and explicit. Reviewers can see "Spinner story" as a checkbox and confirm it's done.

## Trade-offs

- **Per-component intrinsic density vs runtime toggle.** Chose intrinsic. Trade-off: no end-user "I want everything tighter" affordance, no admin power-user mode. Acceptable — the user explicitly framed runtime variants as "complex, do later." If demand emerges, a future OpenSpec change can layer `--density-step` on top of the fixed-value vocabulary without a refactor.
- **Closed nine-token vocabulary vs open extension.** Chose closed. Trade-off: any new density-bearing component type requires a vocabulary extension OpenSpec change. Acceptable — the friction is the point: it forces designers to ask "is this a new component type, or does it slot into an existing tier?" before adding a tenth token.
- **Density tokens in the existing preflight vs a new file.** Chose preflight extension. Reason: `unify-tokens-single-source` retired `tokens.css` and centralized emission in `uno-config.ts`; resurrecting a separate token file would regress R9. Trade-off: `uno-config.ts` grows. Acceptable — it's already the single emission surface for the entire token system.
- **Vocabulary applies to rezics-authored code only, not vendored shadcn.** Chose to leave shadcn untouched. Trade-off: vendored shadcn primitives may have spacing that doesn't perfectly align with the rezics ladder. Acceptable — the alignment task is calibration, not patching, and is owned by `migrate-shadcn-to-base-ui-luma` (recalibrate the nine token *values* against Luma's intrinsic padding so visual rhythm matches without modifying shadcn source).
- **Storybook reads from CSS via `getComputedStyle` vs TS imports.** Chose CSS. Trade-off: the gallery has a tiny perf overhead on every theme switch. Negligible.
- **One change for all 30 shadcn stories vs phased.** Chose one. Trade-off: large PR. Mitigated by the per-primitive file structure (each ≤30 lines, mostly mechanical).
- **Patterns pages with explicit "we don't do this" samples vs positive-only.** Chose explicit rejection samples. Trade-off: longer pages. Acceptable — the rejection is the *thing the page is teaching*.

## Open Questions

- Do the nine token values (`4 / 6 / 8 / 8 / 8 / 8 / 8 / 8 / 12`) need recalibration once visual review compares them against Luma's intrinsic padding? Default: keep the values; defer recalibration to `migrate-shadcn-to-base-ui-luma` if a misalignment surfaces between rezics-authored composites and adjacent vendored shadcn primitives on the same page.
- Should Foundation/Patterns/Inverse Surface document the `Sonner` primitive's surface use? Default: yes — `Sonner` (toast) is the canonical inverse-surface consumer.
- Where do the 30 shadcn-primitive stories live in Storybook's tree? Default: under a `Primitives/` top-level group (`Primitives/Button`, `Primitives/Dialog`, etc.). Confirm by checking the existing rezics-primitive stories' tree placement.
