# Tasks — complete-rezics-design-storybook

The change runs in seven phases. Phase 0 confirms what the post-`unify-tokens-single-source` tree already provides. Phase 1 ships the density vocabulary (nine fixed-value `--padding-*` tokens, no toolbar). Phase 2 ships the seventh Foundation page (Iconography). Phase 3 ships the five new Patterns pages. Phase 4 migrates density-bearing rezics-authored composites onto the vocabulary. Phase 5 ships shadcn-primitive stories + the one missing rezics primitive story. Phase 6 verifies. Phase 7 closes the loop.

> Token namespace: this change uses the post-`unify-tokens-single-source` flat namespace (`--colors-*`, `--font-*`, `--radius-*`, `--shadow-*`, `--duration-*`, `--easing-*`, `--state-*-opacity`, plus the new fixed-value `--padding-*` set). **No `--density-step` is introduced; no `density-compact` / `density-spacious` classes; no Storybook density toolbar.** The legacy `--rezics-*` namespace is **forbidden by R9** and `package/ui/src/config/tokens.css` **must not exist**.

## Phase 0 — Preflight

- [x] 0.1 Confirm `complete-rezics-token-system`, `migrate-to-theme-config-classes`, and `unify-tokens-single-source` are landed: `bun run check:convention` passes (R9 active); `package/ui/src/config/tokens.css` does not exist; `--colors-*` / `--font-*` / `--radius-*` / `--shadow-*` / `--duration-*` / `--easing-*` / `--state-*-opacity` are all emitted by the preflight in `package/ui/src/config/uno-config.ts`.
- [x] 0.2 Confirm `package/ui/src/docs/tokens/_gallery.tsx` exports: `Grid`, `Swatch`, `Row`, `SpacingRuler`, `RadiusSample`, `ElevationSample`, `TypeSample`, `MotionSample`, `Do`, `Dont`, `Compare`. (Already verified during proposal review on 2026-05-04.) Phase 3 extends this file with four new exports.
- [x] 0.3 Confirm Storybook 10 runs on the configured ports per `design-system-storybook` Requirement-2: `bun -F @rezics/ui storybook` starts successfully.
- [x] 0.4 Confirm the existing 6 Foundation MDX pages render: `Foundation/Tokens/Colors`, `…/Typography`, `…/Spacing`, `…/Radius`, `…/Elevation`, `…/Motion`. Each shows live tokens. (No edits in this phase; verification only.)
- [x] 0.5 Confirm the existing 2 patterns MDX pages render: `Foundation/Voice` (`docs/voice.mdx`) and `Foundation/Patterns` (`docs/patterns.mdx`).

## Phase 1 — Density vocabulary (nine fixed-value tokens)

All token emission lives in `package/ui/src/config/uno-config.ts`. No new file in `config/`; no resurrection of `tokens.css`. **No Storybook toolbar** — density is per-component-type intrinsic; there is no runtime knob (see `design-system-density/spec.md`).

> Rollback note: the original Phase-1 plan (now corrected by user direction on 2026-05-05) added a system-tier `--density-step`, class-based overrides on `<html>`, and a Storybook density toolbar. Tasks 1.1–1.4 below are written for the corrected scope. Where prior implementation shipped the rejected mechanism, the explicit rollback steps are flagged. The implementation tracks the corrected scope going forward.

- [x] 1.1 In `package/ui/src/config/uno-config.ts`, redefine the `PADDING_BASE` constant so each entry is a fixed `<length>` (no `calc()`). Emit nine component-tier `--padding-*` tokens directly:
  - `--padding-breadcrumb-y: 4px` (tightest — sibling-of-text affordance)
  - `--padding-menu-item-y: 6px` (dropdown rows)
  - `--padding-table-row-y: 8px`
  - `--padding-toolbar-y: 8px`
  - `--padding-formfield-y: 8px`
  - `--padding-sidebar-item-y: 8px`
  - `--padding-tab-item-y: 8px`
  - `--padding-command-item-y: 8px`
  - `--padding-list-item-y: 12px` (loosest — touch-affinity rows)
  - Update the in-source comment block to document the opt-in / opt-out distinction and the "rezics-authored only, not vendored shadcn" boundary (cross-reference `design-system-density/spec.md`).
- [x] 1.2 **Rollback `--density-step`.** Remove the `DENSITY_STEP` constant, the `:root, :host { --density-step: 0px; }` emission, and the `.density-compact { --density-step: -2px; } .density-spacious { --density-step: 2px; }` selector block from `package/ui/src/config/uno-config.ts`. Verify `rg "density-step|DENSITY_STEP" package/ui/src/config/uno-config.ts` returns zero matches.
- [x] 1.3 **Rollback Storybook density toolbar.** In `package/storybook-config/src/preview.tsx`, remove any `density` `globalType` entry, the toolbar items (`compact` / `comfortable` / `spacious`), and the class-toggle decorator that reads the density global and writes `density-compact` / `density-spacious` on `<html>`. The Light/Dark theme toggle stays. Verify `rg "density-compact|density-spacious|density.*globalType" package/storybook-config/` returns zero matches.
- [x] 1.4 Run `bun -F @rezics/ui storybook` and confirm: (a) only the Light/Dark toolbar entry is visible (no Density entry); (b) the nine `--padding-*` tokens resolve to their fixed values via `getComputedStyle(document.documentElement).getPropertyValue("--padding-table-row-y")` etc. in the browser console.

## Phase 2 — Iconography Foundation page

The other six Foundation pages already ship; this phase adds the seventh and verifies the existing six remain healthy.

- [x] 2.1 Author `package/ui/src/docs/tokens/iconography.mdx`:
  - Live samples of representative lucide-react icons at the three rezics standard sizes (16 / 20 / 24 px).
  - The canonical mapping table for icons currently used in the codebase (former MUI icon name → lucide name). Source: scan `package/app/src/**/*.tsx` and `package/admin/src/**/*.tsx` for icon imports; tabulate.
  - The named-fallback rule (when lucide lacks a glyph, use `@tabler/icons-react`).
  - The `<Meta title="Foundation/Tokens/Iconography" />` placement to match the other six.
  - "Reference" callout: Apple SF Symbols as the deeper reference (9 weights × 3 scales × 4 rendering modes); lucide-react is the rezics adoption at lower fidelity; tabler is the named fallback.
- [x] 2.2 (Optional polish — only if missing during 0.4 verification.) Add a "Reference" callout to any of the existing six Foundation pages that lack one. Otherwise skip.
- [x] 2.3 (Per the Colors-page contrast-badge addition in proposal `What Changes`.) Extend `_gallery.tsx`'s `Swatch` to compute and display contrast against the closest `on-*` role; apply to the Colors page swatches. Defer if the existing `Swatch` already shows contrast badges.
- [x] 2.4 Run `bun -F @rezics/ui run build-storybook` and confirm `storybook-static/index.json` contains all 7 Foundation/Tokens/* entries.
- [ ] 2.5 Sanity-check Iconography in dev mode (`bun -F @rezics/ui storybook`). Toggle theme — icons remain visible against canvas in both modes. Toggle density — icons unchanged (icon size is not a density signal).

## Phase 3 — New Patterns MDX pages (5 pages)

Pages live under a new `package/ui/src/docs/patterns/` directory. Existing `docs/voice.mdx` and `docs/patterns.mdx` are not moved or duplicated.

- [x] 3.1 Extend `package/ui/src/docs/tokens/_gallery.tsx` with the four new Patterns helpers (rewrite `<DensityDemo>` if it was previously authored against the 3-mode scope):
  - `<DensityDemo>` — renders the nine-token `--padding-*` ladder as labelled rows, each row showing the token name, its resolved value, and a sample component (or sample bar) rendered at that padding. Sorted ascending by value (breadcrumb 4px → list-item 12px). **No mode switcher, no class toggling — values are read once via `getComputedStyle`.**
  - `<StateLayerDemo>` — renders an interactive surface with hover / focus / pressed / dragged annotated overlays at the 8/12/12/16 ladder.
  - `<DepthDemo>` — renders the canvas → base → elevated → subtle → sunken surface ladder vertically stacked with labels.
  - `<InverseSurfaceDemo>` — renders a snackbar example and a pull-quote example using inverse-surface tokens.
  - The 11 existing exports stay unchanged.
- [x] 3.2 Author `package/ui/src/docs/patterns/density.mdx` (`<Meta title="Foundation/Patterns/Density" />`):
  - Live `<DensityDemo>` rendering the nine-token ladder.
  - The opt-in list and the opt-out list (cross-reference `design-system-density/spec.md`).
  - The "density is per-component-type intrinsic, not a runtime toggle" framing as the page's lead concept.
  - The "density never affects type" rule explicit.
  - The MD3 runtime 4-step density toggle as the rejected alternative ("we don't do this — rezics encodes density in the component vocabulary, not in a user knob").
  - "Reference" callout naming the MD3 density spec.
- [x] 3.3 Author `package/ui/src/docs/patterns/state-layer.mdx` (`<Meta title="Foundation/Patterns/State Layer" />`):
  - Live `<StateLayerDemo>` showing hover/focus/pressed/dragged.
  - Annotated opacities (8/12/12/16, sourced from `--state-*-opacity`).
  - The role-driven overlay color rule (overlay color = `on-*` of the surface).
  - "We don't do this" sample showing MD3 full-bleed circular ripple with the rejection rationale (rezics borderless aesthetic).
  - "Reference" callout naming the MD3 state-layer spec.
- [x] 3.4 Author `package/ui/src/docs/patterns/depth-without-shadow.mdx` (`<Meta title="Foundation/Patterns/Depth Without Shadow" />`):
  - Live `<DepthDemo>` rendering the canvas → base → elevated → subtle → sunken surface ladder.
  - The "shadow is reserved for modals only" rule with the modal-only `shadow-modal` example.
  - "We don't do this" sample showing MD3 dp shadow ladder.
  - "Reference" callout naming Apple HIG materials and MD3 tonal-elevation spec.
- [x] 3.5 Author `package/ui/src/docs/patterns/inverse-surface.mdx` (`<Meta title="Foundation/Patterns/Inverse Surface" />`):
  - Live `<InverseSurfaceDemo>` (snackbar + pull-quote).
  - When and when not to use inverse-surface (snackbars yes; full-bleed dark sections only when the page-context flips).
  - Cross-link to the `Sonner` primitive story (Phase 5).
- [x] 3.6 Author `package/ui/src/docs/patterns/layout-and-breakpoints.mdx` (`<Meta title="Foundation/Patterns/Layout & Breakpoints" />`):
  - Visual ruler of all rezics breakpoints (xsm:450, sm:640, md:768, lg:1024, xl:1280, 2xl:1536, 8xl:1440).
  - Container width samples at each breakpoint.
  - The xsm-and-8xl rezics-specific rationale (smaller-than-mobile-tablet split; ultra-wide reading containers).
- [x] 3.7 Run `bun -F @rezics/ui run build-storybook`. Confirm 5 new Foundation/Patterns/* entries register in `index.json` (in addition to the 2 existing — `Foundation/Voice` and `Foundation/Patterns` — for a total of 7 patterns-tier entries).

## Phase 4 — Density-bearing composite migration (rezics-authored only)

For the opt-in list, swap inline fixed-padding utilities for the corresponding `var(--padding-*)` token. Pixel parity is guaranteed by construction — each token resolves to the same fixed value the component used inline before.

**Scope boundary:** the migration applies to **rezics-authored components** in `package/ui/src/primitive/`, `package/ui/src/composite/`, and app-level composites (`package/admin/src/`, `package/app/src/`, `package/folio/src/`). **Vendored shadcn primitives in `package/ui/src/shadcn/` are NOT modified** — they consume the spacing values shadcn ships with. (Recalibrating the rezics token *values* against Luma's intrinsic padding is owned by `migrate-shadcn-to-base-ui-luma`, not this change.) If prior implementation patched `shadcn/*.tsx` files to consume rezics tokens, those patches MUST be reverted.

- [x] 4.1 Audit each opt-in composite/primitive and update **rezics-authored** sources to consume the component-tier token. Likely files:
  - Composite Toolbar (location: audit `package/ui/src/composite/`) — `var(--padding-toolbar-y)`.
  - Composite List item (audit `package/ui/src/composite/`) — `var(--padding-list-item-y)`.
  - rezics FormField wrapper (if it exists outside `shadcn/input.tsx`) — `var(--padding-formfield-y)`.
  - App-level rezics-authored composites that render their own breadcrumb/menu/tab/sidebar/command rows — wire to the matching token.
  - **Do not edit** `package/ui/src/shadcn/table.tsx`, `sidebar.tsx`, `tabs.tsx`, `breadcrumb.tsx`, `command.tsx`, `dropdown-menu.tsx`, `context-menu.tsx`, `input.tsx`, `select.tsx`. If the prior implementation edited these to consume `var(--padding-*)`, **revert** those edits in this phase.
- [x] 4.2 **Rollback `WithDensity` stories.** For every story file in `package/ui/src/shadcn/*.stories.tsx`, `package/ui/src/primitive/**/*.stories.tsx`, and `package/ui/src/composite/**/*.stories.tsx`, remove any `export const WithDensity` story (and its imports) that renders compact / comfortable / spacious via `<DensityDemo>`. Verify `rg "WithDensity|density-compact|density-spacious" package/ui/src/` returns zero source matches outside the spec/proposal/design files.
- [ ] 4.3 Visual sweep — confirm pixel parity with the pre-migration state for every rezics-authored composite touched. Diff against `git stash` baseline if needed.
- [x] 4.4 (Removed) — was "visual sweep at compact and spacious." No runtime modes exist.
- [x] 4.5 **Rollback per-app density classes.** Audit `package/admin/`, `package/app/`, `package/folio/`, `package/editor/` for any code that writes `density-compact` / `density-spacious` to `<html>` on mount (typical entry points: `src/main.tsx`, `src/App.tsx`, root layout files). Remove. Density is per-component-type intrinsic, not per-app.

## Phase 5 — Shadcn primitive stories (30) + missing rezics primitive (1)

The 30 shadcn primitives confirmed by `ls package/ui/src/shadcn/` on 2026-05-04 (excluding `index.ts` and `sections/`). Each story file: `package/ui/src/shadcn/<primitive>.stories.tsx`.

- [x] 5.1 Alert (`alert.tsx`)
- [x] 5.2 Avatar (`avatar.tsx`)
- [x] 5.3 Badge (`badge.tsx`)
- [x] 5.4 Breadcrumb (`breadcrumb.tsx`)
- [x] 5.5 Button (`button.tsx`)
- [x] 5.6 Card (`card.tsx`)
- [x] 5.7 Carousel (`carousel.tsx`)
- [x] 5.8 Chart (`chart.tsx`)
- [x] 5.9 Checkbox (`checkbox.tsx`)
- [x] 5.10 Collapsible (`collapsible.tsx`)
- [x] 5.11 Command (`command.tsx`)
- [x] 5.12 ContextMenu (`context-menu.tsx`)
- [x] 5.13 Dialog (`dialog.tsx`)
- [x] 5.14 Drawer (`drawer.tsx`)
- [x] 5.15 DropdownMenu (`dropdown-menu.tsx`)
- [x] 5.16 Input (`input.tsx`)
- [x] 5.17 Label (`label.tsx`)
- [x] 5.18 Popover (`popover.tsx`)
- [x] 5.19 Select (`select.tsx`)
- [x] 5.20 Separator (`separator.tsx`)
- [x] 5.21 Sheet (`sheet.tsx`)
- [x] 5.22 Sidebar (`sidebar.tsx`)
- [x] 5.23 Skeleton (`skeleton.tsx`)
- [x] 5.24 Sonner (`sonner.tsx`)
- [x] 5.25 Table (`table.tsx`)
- [x] 5.26 Tabs (`tabs.tsx`)
- [x] 5.27 ThemeSwitch (`theme-switch.tsx`) — rezics-custom; covers light/dark toggle behaviour.
- [x] 5.28 Toggle (`toggle.tsx`)
- [x] 5.29 ToggleGroup (`toggle-group.tsx`)
- [x] 5.30 Tooltip (`tooltip.tsx`)
- [x] 5.31 (rezics primitive) `package/ui/src/primitive/button/TextButton.stories.tsx` — the missing 14th primitive story identified by the audit.
- [x] 5.32 If the Phase-4 audit surfaces a composite-tier file that needs a Toolbar story (or any other density opt-in component without an existing story), add it here.

(Per Decision 1 in `design.md`, no `WithDensity` axis stories exist. Phase 4.2 rolls back any that the prior implementation shipped.)

## Phase 6 — Verification

- [x] 6.1 `bun -F @rezics/ui run build-storybook` — `storybook-static/index.json` contains:
  - 7 Foundation/Tokens/* entries (Colors, Typography, Spacing, Radius, Elevation, Motion, Iconography). ✓
  - 7 Foundation/Patterns/* entries (Voice, Patterns, Density, State Layer, Depth Without Shadow, Inverse Surface, Layout & Breakpoints) — including the 2 existing. ✓
  - 30 Primitives/* shadcn entries + the new TextButton primitive entry. ✓
  - The 13 existing rezics-primitive entries and the 23 composite entries all still register. ✓
- [x] 6.2 All five storybook builds complete with status 0: `@rezics/ui`, `@rezics/admin`, `@rezics/folio`, `@rezics/app`, `@rezics/editor`, plus the root host (`bun run build-storybook:host`). Cleanup: removed stale `import "@rezics/ui/config/tokens.css"` and `import { getTheme } from "@rezics/ui/config/theme"` references left over from `unify-tokens-single-source` in five `.storybook/preview.tsx` files (root host, ui, admin, app, folio).
- [ ] 6.3 Manual sweep: open `bun -F @rezics/ui storybook`. Visit each Foundation page (7), each Patterns page (7), and 5 representative Primitive stories. Confirm:
  - Tokens render live.
  - Theme toggle works on every page.
  - Foundation/Patterns/Density renders the nine-token vocabulary ladder; no toolbar mode switcher is present.
  - Contrast badges read correctly on Foundation/Tokens/Colors swatches.
- [x] 6.7 `rg "--density-step|density-compact|density-spacious|WithDensity" package/` returns zero matches in source files (`.tsx`, `.ts`, `.css`, `.mdx`). Acceptable matches only inside `openspec/changes/` artifacts that document what is not introduced or what is rolled back.
- [x] 6.4 `bun run check:tokens` passes (contrast script — should be unaffected by this change but verify). ✓ All 50 contrast checks pass.
- [x] 6.5 `bun run check:convention` passes — **R9 must not regress**: no `--rezics-*` references introduced; `package/ui/src/config/tokens.css` does not appear. ✓ R9 clean; total violations match baseline. (Note: renamed `package/ui/src/docs/patterns/` → `pattern/` to satisfy R4 folder-naming-convention; the Storybook MDX titles remain `Foundation/Patterns/<Name>`.)
- [x] 6.6 Per-package `bunx tsc --noEmit`: `@rezics/ui`, `@rezics/admin`, `@rezics/app`, `@rezics/folio` all clean (modulo pre-existing cross-package `@/...` alias noise from importing `../ui/src/shadcn/*` paths, which the user's documented policy treats as expected and ignored).

## Phase 7 — Close the loop

- [x] 7.1 Update `CLAUDE.md`'s "UI Work" section to mention the Storybook entry point (`bun -F @rezics/ui storybook`) and the Foundation/Patterns documentation as the canonical reference. Update the existing density-toolbar reference to instead point at Foundation/Patterns/Density as the vocabulary documentation surface (and remove any mention of compact/comfortable/spacious as a runtime toggle).
- [x] 7.2 Update `.claude/skills/rezics-design/` skill files to reference the new Storybook pages where appropriate (the skill should not duplicate documentation, just point to it).
- [ ] 7.3 Tag the OpenSpec change for archival once review is complete.
- [ ] 7.4 Open a follow-up tracking issue: "Restyle pass on shadcn primitives that still carry MUI-era visual defaults" — surfaced by the new Phase-5 stories. Out of scope for this change.
