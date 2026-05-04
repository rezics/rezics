# Tasks — complete-rezics-design-storybook

The change runs in seven phases. Phases 0 and 1 set up the infrastructure (density tokens + global toolbar). Phase 2 ships Foundation pages. Phase 3 ships Patterns pages. Phase 4 migrates density-aware composites. Phase 5 ships shadcn-primitive stories. Phase 6 wires research callouts and verifies. Phase 7 closes the loop.

## Phase 0 — Preflight

- [ ] 0.1 Confirm `complete-rezics-token-system` (proposal 1) and `migrate-to-theme-config-classes` (proposal 2) are landed. The role-list, the system tier, and R9 are all in production.
- [ ] 0.2 Confirm `package/ui/src/docs/tokens/_gallery.tsx` helper exists per `design-system-storybook` Requirement-4 (`Grid`, `Swatch`, `Row`, `SpacingRuler`, `RadiusSample`, `ElevationSample`, `TypeSample`, `MotionSample`, `Do`, `Dont`, `Compare` exports). If the file does not yet exist, scaffold it with these exports as the first sub-task; this proposal then extends it.
- [ ] 0.3 Confirm Storybook 10 runs at the configured ports (6006–6011) per `design-system-storybook` Requirement-2.

## Phase 1 — Density tokens and global toolbar

- [ ] 1.1 Extend `package/ui/src/config/tokens.css` with the system-tier density step:
  ```css
  .theme-rezics[data-density="compact"]     { --rezics-sys-density-step: -4px; }
  .theme-rezics[data-density="comfortable"],
  .theme-rezics                             { --rezics-sys-density-step:  0px; }
  .theme-rezics[data-density="spacious"]    { --rezics-sys-density-step: +6px; }
  ```
- [ ] 1.2 Author the component-tier density tokens for the opt-in list (Table row, List item, Toolbar, FormControl, Sidebar item, Editor toolbar, MenuItem, TabsList item, Breadcrumb item, CommandPalette item) — ~25 tokens total. Each is a `calc(<base> + var(--rezics-sys-density-step))` expression. Document the opt-in / opt-out distinction with a comment block.
- [ ] 1.3 Author the global Density toolbar in `package/storybook-config/src/preview.tsx`:
  - Add a `globalTypes` entry named `density` with default `comfortable` and toolbar items `compact` / `comfortable` / `spacious`.
  - Add a decorator that applies `<html data-density={…}>` from the global value. Stores prior value, restores on cleanup.
  - Verify independence: switching theme does not reset density; switching density does not reset theme.
- [ ] 1.4 Run `bun -F @rezics/ui storybook` and confirm the new toolbar entry appears.

## Phase 2 — Foundation MDX galleries (7 pages)

- [ ] 2.1 Author `package/ui/src/docs/tokens/colors.mdx`:
  - Surface family swatches (background, surface, surface-variant, surface-container-lowest..highest, surface-tint).
  - Brand family swatches with on-* foregrounds.
  - Container variant swatches (primary-container / on-primary-container, error-container, success-container, warning-container, info-container).
  - Inverse swatches.
  - Chart palette swatches (chart-1..5).
  - Sidebar chrome swatches.
  - State-layer demo (hover/focus/pressed/dragged) showing the 8/12/12/16 ladder.
  - Each swatch displays computed contrast against the closest `on-*` role with a pass/fail badge per the proposal-1 contrast invariant.
  - "Reference" callout naming MD3's role taxonomy and HCT contrast invariant; rezics-specific divergence (hand-curated palette, no algorithmic HCT).
- [ ] 2.2 Author `package/ui/src/docs/tokens/typography.mdx`:
  - Type ramp samples for every system-tier role (largeTitle, title, headline, body, label, caption — Apple-inspired naming) at every weight rezics ships.
  - CJK-aware sample (one paragraph in English, one in 繁中, one in 日本語) showing the lang-routing in effect.
  - "Reference" callout: Apple HIG 4-tier label hierarchy + 11-style Dynamic Type as the deeper reference; rezics simplifies to the 4-tier model.
- [ ] 2.3 Author `package/ui/src/docs/tokens/spacing.mdx`:
  - Spacing scale ruler (preset-wind4 single-spacing model values rezics retains).
  - rezics-specific additions noted (xsm:450px breakpoint, 8xl:1440px container).
  - "Reference" callout: MD3 4dp grid as the underlying engineering; rezics maps the same idea to the preset-wind4 single-spacing model.
- [ ] 2.4 Author `package/ui/src/docs/tokens/radius.mdx`:
  - All 8 radius steps (xs/sm/md/lg/xl/2xl/pill/full) demoed as sample shapes.
  - "Reference" callout: rezics 8-step scale; Apple's continuous-radius-via-superellipse noted as a "differs from rezics."
- [ ] 2.5 Author `package/ui/src/docs/tokens/elevation.mdx`:
  - The surface-container ladder demoed as the rezics depth mechanism (canvas → low → container → high → highest, vertically stacked).
  - The shadow ladder (shadow-1, shadow-2, shadow-3, shadow-modal) shown as a separate, secondary mechanism reserved for modals.
  - A "we don't do this" sample showing MD3 dp shadow ladder with the rezics rejection rationale.
  - "Reference" callout: Apple HIG materials-over-shadows; MD3 tonal elevation; rezics uses surface-container ladder.
- [ ] 2.6 Author `package/ui/src/docs/tokens/motion.mdx`:
  - Live demo of all 16 duration tokens (animated bars triggered by toolbar play button).
  - Live demo of all 7 easing curves (visualized as cubic-bezier preview SVGs + animated samples).
  - "Reference" callout: MD3 16-duration + 7-easing ladder verbatim; rezics-specific spring curve described.
- [ ] 2.7 Author `package/ui/src/docs/tokens/iconography.mdx`:
  - lucide-react default samples at the three rezics standard sizes (16 / 20 / 24 px).
  - The canonical mapping table (former MUI icon name → lucide name) for the icons currently used in the codebase.
  - The named-fallback rule (when lucide lacks a glyph, use `@tabler/icons-react`).
  - "Reference" callout: Apple SF Symbols as the deeper reference; lucide is the rezics adoption.
- [ ] 2.8 Run `bun -F @rezics/ui run build-storybook` and confirm all 7 Foundation entries appear in `index.json`.
- [ ] 2.9 Sanity-check each page in dev mode (`bun -F @rezics/ui storybook`). Toggle theme — every swatch updates. Toggle density — pages remain stable (Foundation pages don't show density variance).

## Phase 3 — Patterns MDX pages (6 pages)

- [ ] 3.1 Extend `_gallery.tsx` with the new Patterns helpers:
  - `<DensityDemo>` — renders a representative composite three times (compact / comfortable / spacious) side-by-side.
  - `<StateLayerDemo>` — renders an interactive surface with hover / focus / pressed / dragged annotated overlays.
  - `<DepthDemo>` — renders the surface-container ladder vertically stacked with labels.
  - `<InverseSurfaceDemo>` — renders a snackbar example and a pull-quote example using inverse-surface.
  - `<DontVsDo>` (or extend existing `Compare`) — side-by-side rejection-vs-rezics samples.
- [ ] 3.2 Author `package/ui/src/docs/patterns/parchment-voice.mdx`:
  - The rezics philosophy statement (borderless cards, parchment canvas, brand-fill is fill-only, depth-via-color-not-shadow, ellipsis-for-dialogs writing).
  - Do/don't pairs covering at least: "borderless card" vs "bordered card", "fill-brand button" vs "outlined-brand button", "tonal banner" vs "shadow-card banner".
  - A "we don't do this" sample showing a glossy-glass-dashboard surface (Tailwind Catalyst / shadcn-default) as the rejection.
- [ ] 3.3 Author `package/ui/src/docs/patterns/density.mdx`:
  - Live `<DensityDemo>` rendering Toolbar + FormControl + List in three modes side-by-side.
  - The opt-in component list (Table, List item, Toolbar, etc.).
  - The opt-out component list (Hero, reading view, book covers, etc.).
  - The "density never affects type" rule explicit, with a sample showing typography unchanged across modes.
  - The four-mode-of-MD3 → three-mode-of-rezics rationale.
- [ ] 3.4 Author `package/ui/src/docs/patterns/state-layer.mdx`:
  - Live `<StateLayerDemo>` showing hover/focus/pressed/dragged.
  - Annotated opacities (8/12/12/16).
  - The role-driven overlay color rule (overlay color = `on-*` of the surface).
  - "We don't do this" sample showing MD3 full-bleed circular ripple with the rejection rationale.
- [ ] 3.5 Author `package/ui/src/docs/patterns/depth-without-shadow.mdx`:
  - Live `<DepthDemo>` rendering the surface-container ladder.
  - The "shadow is reserved for modals only" rule with the modal-only `shadow-modal` example.
  - "We don't do this" sample showing MD3 dp shadow ladder.
- [ ] 3.6 Author `package/ui/src/docs/patterns/inverse-surface.mdx`:
  - Live `<InverseSurfaceDemo>` (snackbar + pull-quote).
  - When and when not to use inverse-surface.
- [ ] 3.7 Author `package/ui/src/docs/patterns/layout-and-breakpoints.mdx`:
  - Visual ruler of all rezics breakpoints (xsm:450, sm:640, md:768, lg:1024, xl:1280, 2xl:1536, 8xl:1440).
  - Container width samples at each breakpoint.
  - The xsm-and-8xl rezics-specific rationale (smaller-than-mobile-tablet split; ultra-wide reading containers).
- [ ] 3.8 Run `bun -F @rezics/ui run build-storybook`. Confirm 6 Patterns entries register in `index.json`.

## Phase 4 — Density-aware composite migration

- [ ] 4.1 For each composite in the opt-in list, update its source to consume the component-tier density token:
  - `package/ui/src/composite/Table/...` — row padding-y consumes `--rezics-comp-table-row-padding-y`.
  - `package/ui/src/composite/List/...` — item padding consumes the corresponding token.
  - `package/ui/src/composite/Toolbar/...`, `FormControl/...`, etc.
  - Repeat for each ~10 composites in the list.
- [ ] 4.2 For each opt-in composite, add a `WithDensity` story in its existing story file rendering compact / comfortable / spacious side-by-side via `<DensityDemo>`.
- [ ] 4.3 Visual sweep at the comfortable default — confirm pixel parity with the pre-migration state.
- [ ] 4.4 Visual sweep at compact and spacious — confirm no layout breakage. Adjust the system-tier `--rezics-sys-density-step` values if a mode feels too tight or too loose; preserve the Phase-1 default values unless visual review explicitly warrants adjustment.
- [ ] 4.5 Migrate the consumer references in `@rezics/admin` (admin tables consume the density-aware composites; verify `data-density="compact"` is set on the admin-app `<html>` so admin defaults to compact). For `@rezics/app`, density stays at the default (`comfortable`); no per-app density-attribute writes needed unless a specific surface (e.g. `/admin/`-style routes inside the app) needs to opt into compact.

## Phase 5 — Shadcn primitive stories (39 primitives)

The 39 shadcn primitives in `package/ui/src/shadcn/` requiring stories. Tick each as the story file ships. Each story file follows the structure described in `design.md` Decision 4.

- [ ] 5.1 Accordion
- [ ] 5.2 AlertDialog
- [ ] 5.3 Alert
- [ ] 5.4 AspectRatio
- [ ] 5.5 Avatar
- [ ] 5.6 Badge
- [ ] 5.7 Breadcrumb
- [ ] 5.8 Button
- [ ] 5.9 Calendar
- [ ] 5.10 Card
- [ ] 5.11 Carousel
- [ ] 5.12 Chart (already partially documented in `Foundation/Tokens/Colors`; primitive story still required)
- [ ] 5.13 Checkbox
- [ ] 5.14 Collapsible
- [ ] 5.15 Command
- [ ] 5.16 ContextMenu
- [ ] 5.17 Dialog
- [ ] 5.18 Drawer
- [ ] 5.19 DropdownMenu
- [ ] 5.20 Form (per shadcn's Form abstraction; covers FormField + FormItem + FormLabel + FormMessage)
- [ ] 5.21 HoverCard
- [ ] 5.22 Input
- [ ] 5.23 InputOTP
- [ ] 5.24 Label
- [ ] 5.25 Menubar
- [ ] 5.26 NavigationMenu
- [ ] 5.27 Pagination
- [ ] 5.28 Popover
- [ ] 5.29 Progress
- [ ] 5.30 RadioGroup
- [ ] 5.31 Resizable
- [ ] 5.32 ScrollArea
- [ ] 5.33 Select
- [ ] 5.34 Separator
- [ ] 5.35 Sheet
- [ ] 5.36 Skeleton
- [ ] 5.37 Slider
- [ ] 5.38 Sonner (toast)
- [ ] 5.39 Switch
- [ ] 5.40 Table
- [ ] 5.41 Tabs
- [ ] 5.42 Textarea
- [ ] 5.43 Toggle
- [ ] 5.44 ToggleGroup
- [ ] 5.45 Tooltip

(The exact 39 are confirmed during Phase 5.0 by listing `package/ui/src/shadcn/`. The list above includes the canonical shadcn registry; some entries may not exist in the rezics fork; deletions / additions are tracked here as Phase 5 begins.)

- [ ] 5.46 If any primitive in the rezics fork is *not* in the shadcn canonical registry but exists in `package/ui/src/shadcn/`, add it to the list and ship a story for it.
- [ ] 5.47 If the rezics rezics-primitive `Spinner` does not yet have a story (the audit showed 13/14 = 92.9%, so one is missing), ship that story too.

## Phase 6 — Verification

- [ ] 6.1 `bun -F @rezics/ui run build-storybook` — `storybook-static/index.json` contains:
  - 7 Foundation/Tokens/* entries.
  - 6 Foundation/Patterns/* entries.
  - 39+ Primitives/* entries (one per shadcn primitive).
  - The 14 rezics-primitive entries (existing) and the 21 composite entries (existing) all still register.
- [ ] 6.2 `bun -F @rezics/admin run build-storybook` and `bun -F @rezics/app run build-storybook` and `bun -F @rezics/folio run build-storybook` and `bun -F @rezics/editor run build-storybook` and `bun storybook:build` (root host) — all five complete with status 0.
- [ ] 6.3 Manual sweep: open `bun -F @rezics/ui storybook`. Visit each Foundation page (7), each Patterns page (6), and 5 representative Primitive stories. Confirm:
  - Tokens render live.
  - Theme toggle works on every page.
  - Density toggle works on Foundation/Patterns/Density and on Density-axis primitive stories.
  - Contrast badges read correctly on Foundation/Tokens/Colors swatches.
- [ ] 6.4 `bun run check:tokens` passes (proposal 1's contrast script — should be unaffected by this change but verify).
- [ ] 6.5 `bun run check:convention` passes (R9 from proposal 2 — verify no new violations introduced by Density-axis composite migration).
- [ ] 6.6 `bun -F @rezics/ui run typecheck` passes. `bun -F @rezics/admin run typecheck`, `bun -F @rezics/app run typecheck`, `bun -F @rezics/folio run typecheck` all pass.

## Phase 7 — Close the loop

- [ ] 7.1 Update `CLAUDE.md`'s "UI Work" section to mention the Storybook entry point (`bun -F @rezics/ui storybook`) and the Foundation/Patterns documentation as the canonical reference.
- [ ] 7.2 Update `.claude/skills/rezics-design/` skill files to reference the new Storybook pages where appropriate (the skill should not duplicate documentation, just point to it).
- [ ] 7.3 Tag the OpenSpec change for archival once review is complete.
- [ ] 7.4 Open a follow-up tracking issue: "Restyle pass on shadcn primitives that still carry MUI-era visual defaults" — surfaced by the new Phase-5 stories. Out of scope for this change; the surface that this change creates will reveal which primitives need restyling. Captured as the natural next initiative.
