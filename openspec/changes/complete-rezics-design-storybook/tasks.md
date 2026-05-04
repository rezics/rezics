# Tasks — complete-rezics-design-storybook

The change runs in seven phases. Phase 0 confirms what the post-`unify-tokens-single-source` tree already provides. Phase 1 ships the density token system. Phase 2 ships the seventh Foundation page (Iconography). Phase 3 ships the five new Patterns pages. Phase 4 migrates density-aware composites. Phase 5 ships shadcn-primitive stories + the one missing rezics primitive story. Phase 6 verifies. Phase 7 closes the loop.

> Token namespace: this change uses the post-`unify-tokens-single-source` flat namespace (`--colors-*`, `--font-*`, `--radius-*`, `--shadow-*`, `--duration-*`, `--easing-*`, `--state-*-opacity`, plus the new `--density-step` and `--padding-*` set). The legacy `--rezics-*` namespace is **forbidden by R9** and `package/ui/src/config/tokens.css` **must not exist**.

## Phase 0 — Preflight

- [x] 0.1 Confirm `complete-rezics-token-system`, `migrate-to-theme-config-classes`, and `unify-tokens-single-source` are landed: `bun run check:convention` passes (R9 active); `package/ui/src/config/tokens.css` does not exist; `--colors-*` / `--font-*` / `--radius-*` / `--shadow-*` / `--duration-*` / `--easing-*` / `--state-*-opacity` are all emitted by the preflight in `package/ui/src/config/uno-config.ts`.
- [x] 0.2 Confirm `package/ui/src/docs/tokens/_gallery.tsx` exports: `Grid`, `Swatch`, `Row`, `SpacingRuler`, `RadiusSample`, `ElevationSample`, `TypeSample`, `MotionSample`, `Do`, `Dont`, `Compare`. (Already verified during proposal review on 2026-05-04.) Phase 3 extends this file with four new exports.
- [x] 0.3 Confirm Storybook 10 runs on the configured ports per `design-system-storybook` Requirement-2: `bun -F @rezics/ui storybook` starts successfully.
- [x] 0.4 Confirm the existing 6 Foundation MDX pages render: `Foundation/Tokens/Colors`, `…/Typography`, `…/Spacing`, `…/Radius`, `…/Elevation`, `…/Motion`. Each shows live tokens. (No edits in this phase; verification only.)
- [x] 0.5 Confirm the existing 2 patterns MDX pages render: `Foundation/Voice` (`docs/voice.mdx`) and `Foundation/Patterns` (`docs/patterns.mdx`).

## Phase 1 — Density tokens and global toolbar

All token emission lives in `package/ui/src/config/uno-config.ts`. No new file in `config/`; no resurrection of `tokens.css`.

- [x] 1.1 Extend `package/ui/src/config/uno-config.ts` with a `DENSITY_STEP` constant and emit `--density-step` from the preflight:
  - `:root, :host { --density-step: 0px; }` (comfortable default; bundled into the existing static-tokens preflight block).
  - A new selector block: `.density-compact { --density-step: -2px; } .density-spacious { --density-step: 2px; }`.
- [x] 1.2 In the same file, define and emit the component-tier `--padding-*` tokens for the opt-in list. Each is `calc(<base> + var(--density-step))`. Final list (final base values pinned during 4.1 visual review):
  - `--padding-table-row-y` (base `8px`)
  - `--padding-list-item-y` (base `12px`)
  - `--padding-toolbar-y` (base `8px`)
  - `--padding-formfield-y` (base `8px`)
  - `--padding-sidebar-item-y` (base `8px`)
  - `--padding-tab-item-y` (base `8px`)
  - `--padding-menu-item-y` (base `6px`)
  - `--padding-breadcrumb-y` (base `4px`)
  - `--padding-command-item-y` (base `8px`)
  - Add an in-source comment block documenting the opt-in / opt-out distinction (cross-reference `design-system-density/spec.md`).
- [x] 1.3 Author the global Density toolbar in `package/storybook-config/src/preview.tsx`:
  - Extend the existing `themeGlobalTypes` (or add a sibling `densityGlobalType`) with a `density` entry: default `"comfortable"`, toolbar items `"compact"` / `"comfortable"` / `"spacious"`. Reuse the existing icon channel pattern (text labels are sufficient; icons optional).
  - Add a class-toggle decorator that mirrors the theme-mode pattern: read the global `density` value and set/remove `density-compact` / `density-spacious` classes on `<html>`, leaving the comfortable default with no class.
  - Verify independence: switching theme does not reset density; switching density does not reset theme.
- [x] 1.4 Run `bun -F @rezics/ui storybook` and confirm the new toolbar entry appears alongside the Light/Dark toggle.

## Phase 2 — Iconography Foundation page

The other six Foundation pages already ship; this phase adds the seventh and verifies the existing six remain healthy.

- [x] 2.1 Author `package/ui/src/docs/tokens/iconography.mdx`:
  - Live samples of representative lucide-react icons at the three rezics standard sizes (16 / 20 / 24 px).
  - The canonical mapping table for icons currently used in the codebase (former MUI icon name → lucide name). Source: scan `package/app/src/**/*.tsx` and `package/admin/src/**/*.tsx` for icon imports; tabulate.
  - The named-fallback rule (when lucide lacks a glyph, use `@tabler/icons-react`).
  - The `<Meta title="Foundation/Tokens/Iconography" />` placement to match the other six.
  - "Reference" callout: Apple SF Symbols as the deeper reference (9 weights × 3 scales × 4 rendering modes); lucide-react is the rezics adoption at lower fidelity; tabler is the named fallback.
- [ ] 2.2 (Optional polish — only if missing during 0.4 verification.) Add a "Reference" callout to any of the existing six Foundation pages that lack one. Otherwise skip.
- [x] 2.3 (Per the Colors-page contrast-badge addition in proposal `What Changes`.) Extend `_gallery.tsx`'s `Swatch` to compute and display contrast against the closest `on-*` role; apply to the Colors page swatches. Defer if the existing `Swatch` already shows contrast badges.
- [ ] 2.4 Run `bun -F @rezics/ui run build-storybook` and confirm `storybook-static/index.json` contains all 7 Foundation/Tokens/* entries.
- [ ] 2.5 Sanity-check Iconography in dev mode (`bun -F @rezics/ui storybook`). Toggle theme — icons remain visible against canvas in both modes. Toggle density — icons unchanged (icon size is not a density signal).

## Phase 3 — New Patterns MDX pages (5 pages)

Pages live under a new `package/ui/src/docs/patterns/` directory. Existing `docs/voice.mdx` and `docs/patterns.mdx` are not moved or duplicated.

- [x] 3.1 Extend `package/ui/src/docs/tokens/_gallery.tsx` with the four new Patterns helpers:
  - `<DensityDemo>` — renders a representative composite three times (compact / comfortable / spacious) side-by-side. Each instance forces a wrapper class (`density-compact` / no-class / `density-spacious`) so the three render simultaneously regardless of the `<html>` global state.
  - `<StateLayerDemo>` — renders an interactive surface with hover / focus / pressed / dragged annotated overlays at the 8/12/12/16 ladder.
  - `<DepthDemo>` — renders the canvas → base → elevated → subtle → sunken surface ladder vertically stacked with labels.
  - `<InverseSurfaceDemo>` — renders a snackbar example and a pull-quote example using inverse-surface tokens.
  - The 11 existing exports stay unchanged.
- [x] 3.2 Author `package/ui/src/docs/patterns/density.mdx` (`<Meta title="Foundation/Patterns/Density" />`):
  - Live `<DensityDemo>` rendering Toolbar + FormField + List in three modes side-by-side.
  - The opt-in list and the opt-out list (cross-reference `design-system-density/spec.md`).
  - The "density never affects type" rule explicit, with a sample showing typography unchanged across modes.
  - The four-mode-of-MD3 → three-mode-of-rezics rationale, including the rejected MD3 4-step ladder as the "we don't do this."
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
- [ ] 3.7 Run `bun -F @rezics/ui run build-storybook`. Confirm 5 new Foundation/Patterns/* entries register in `index.json` (in addition to the 2 existing — `Foundation/Voice` and `Foundation/Patterns` — for a total of 7 patterns-tier entries).

## Phase 4 — Density-aware composite migration

For the opt-in list, swap fixed-padding utilities for the `--padding-*` token. Pixel parity at the comfortable default is guaranteed by construction (the calc resolves to the same value).

- [x] 4.1 For each composite/primitive in the opt-in list, update the source to consume the component-tier token. Files to touch (verify each; some may already use a CSS variable):
  - `package/ui/src/shadcn/table.tsx` — row padding-y → `var(--padding-table-row-y)` (base `8px`).
  - `package/ui/src/shadcn/sidebar.tsx` — item padding → `var(--padding-sidebar-item-y)`.
  - `package/ui/src/shadcn/tabs.tsx` — list item padding → `var(--padding-tab-item-y)`.
  - `package/ui/src/shadcn/breadcrumb.tsx` — item padding → `var(--padding-breadcrumb-y)`.
  - `package/ui/src/shadcn/command.tsx` — item padding → `var(--padding-command-item-y)`.
  - `package/ui/src/shadcn/dropdown-menu.tsx`, `context-menu.tsx` — item padding → `var(--padding-menu-item-y)`.
  - `package/ui/src/shadcn/input.tsx`, `select.tsx` — wrapper padding → `var(--padding-formfield-y)`.
  - Composite Toolbar (location TBD during Phase 4) — `var(--padding-toolbar-y)`.
  - List items rendered via `package/ui/src/composite/` (audit during 4.1) — `var(--padding-list-item-y)`.
- [x] 4.2 For each opt-in composite/primitive, add a `WithDensity` story rendering compact / comfortable / spacious side-by-side via `<DensityDemo>`. Tick alongside the corresponding Phase 5 entry (e.g. `Phase 5.X` for shadcn primitives).
- [ ] 4.3 Visual sweep at the comfortable default — confirm pixel parity with the pre-migration state. Diff against `git stash` baseline if needed.
- [ ] 4.4 Visual sweep at compact and spacious — confirm no layout breakage. Adjust the Phase-1 `--density-step` values (`-2px` / `+2px`) only if visual review explicitly warrants. Adjust component-tier base values only if a specific component reveals a calibration miss.
- [x] 4.5 Migrate the consumer references in `@rezics/admin` (admin tables consume the density-aware shadcn `table.tsx`; verify `<html class="density-compact">` is set on the admin app's root so admin defaults to compact). For `@rezics/app`, density stays at the default (comfortable); no per-app density-class write needed unless a specific surface (e.g. an admin-style route inside the app) opts into compact.

## Phase 5 — Shadcn primitive stories (30) + missing rezics primitive (1)

The 30 shadcn primitives confirmed by `ls package/ui/src/shadcn/` on 2026-05-04 (excluding `index.ts` and `sections/`). Each story file: `package/ui/src/shadcn/<primitive>.stories.tsx`.

- [x] 5.1 Alert (`alert.tsx`)
- [x] 5.2 Avatar (`avatar.tsx`)
- [x] 5.3 Badge (`badge.tsx`)
- [x] 5.4 Breadcrumb (`breadcrumb.tsx`) — also `WithDensity`
- [x] 5.5 Button (`button.tsx`)
- [x] 5.6 Card (`card.tsx`)
- [x] 5.7 Carousel (`carousel.tsx`)
- [x] 5.8 Chart (`chart.tsx`)
- [x] 5.9 Checkbox (`checkbox.tsx`)
- [x] 5.10 Collapsible (`collapsible.tsx`)
- [x] 5.11 Command (`command.tsx`) — also `WithDensity`
- [x] 5.12 ContextMenu (`context-menu.tsx`) — also `WithDensity`
- [x] 5.13 Dialog (`dialog.tsx`)
- [x] 5.14 Drawer (`drawer.tsx`)
- [x] 5.15 DropdownMenu (`dropdown-menu.tsx`) — also `WithDensity`
- [x] 5.16 Input (`input.tsx`) — also `WithDensity`
- [x] 5.17 Label (`label.tsx`)
- [x] 5.18 Popover (`popover.tsx`)
- [x] 5.19 Select (`select.tsx`) — also `WithDensity`
- [x] 5.20 Separator (`separator.tsx`)
- [x] 5.21 Sheet (`sheet.tsx`)
- [x] 5.22 Sidebar (`sidebar.tsx`) — also `WithDensity`
- [x] 5.23 Skeleton (`skeleton.tsx`)
- [x] 5.24 Sonner (`sonner.tsx`)
- [x] 5.25 Table (`table.tsx`) — also `WithDensity`
- [x] 5.26 Tabs (`tabs.tsx`) — also `WithDensity`
- [x] 5.27 ThemeSwitch (`theme-switch.tsx`) — rezics-custom; covers light/dark toggle behaviour.
- [x] 5.28 Toggle (`toggle.tsx`)
- [x] 5.29 ToggleGroup (`toggle-group.tsx`)
- [x] 5.30 Tooltip (`tooltip.tsx`)
- [x] 5.31 (rezics primitive) `package/ui/src/primitive/button/TextButton.stories.tsx` — the missing 14th primitive story identified by the audit.
- [ ] 5.32 If the Phase-4 audit surfaces a composite-tier file that needs a Toolbar story (or any other density opt-in component without an existing story), add it here.

(Phase 5 entries that also carry `WithDensity` reference Phase 4.2's per-component Density story — same file, just an additional `export const WithDensity`.)

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
  - Density toggle works on Foundation/Patterns/Density and on Density-axis primitive stories.
  - Contrast badges read correctly on Foundation/Tokens/Colors swatches.
- [x] 6.4 `bun run check:tokens` passes (contrast script — should be unaffected by this change but verify). ✓ All 50 contrast checks pass.
- [x] 6.5 `bun run check:convention` passes — **R9 must not regress**: no `--rezics-*` references introduced; `package/ui/src/config/tokens.css` does not appear. ✓ R9 clean; total violations match baseline. (Note: renamed `package/ui/src/docs/patterns/` → `pattern/` to satisfy R4 folder-naming-convention; the Storybook MDX titles remain `Foundation/Patterns/<Name>`.)
- [x] 6.6 Per-package `bunx tsc --noEmit`: `@rezics/ui`, `@rezics/admin`, `@rezics/app`, `@rezics/folio` all clean (modulo pre-existing cross-package `@/...` alias noise from importing `../ui/src/shadcn/*` paths, which the user's documented policy treats as expected and ignored).

## Phase 7 — Close the loop

- [ ] 7.1 Update `CLAUDE.md`'s "UI Work" section to mention the Storybook entry point (`bun -F @rezics/ui storybook`) and the Foundation/Patterns documentation as the canonical reference. Add a line about the density global toolbar.
- [ ] 7.2 Update `.claude/skills/rezics-design/` skill files to reference the new Storybook pages where appropriate (the skill should not duplicate documentation, just point to it).
- [ ] 7.3 Tag the OpenSpec change for archival once review is complete.
- [ ] 7.4 Open a follow-up tracking issue: "Restyle pass on shadcn primitives that still carry MUI-era visual defaults" — surfaced by the new Phase-5 stories. Out of scope for this change.
