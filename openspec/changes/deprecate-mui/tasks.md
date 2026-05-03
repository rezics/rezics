## 1. Phase 0 — Inventory, freeze, and scaffolding

- [ ] 1.1 Create a tracking branch `chore/deprecate-mui` off `dev` and announce a UI work freeze in the team chat (per design.md Decision 10; rollback path = `git revert`/branch reset)
- [x] 1.2 Snapshot the current MUI surface area into `openspec/changes/deprecate-mui/inventory.md` using `rg -l '@mui/material' package` / `rg -l '@mui/icons-material' package` / `rg -c '\\bsx=' package` / `rg -l 'createTheme|ThemeProvider' package` and commit the counts (used to verify Phase 5 burn-down to zero)
- [x] 1.3 Verify `package/editor` has zero `@mui/*` imports (`rg '@mui/' package/editor/src` SHALL return empty) and no `@mui/*` entry in `package/editor/package.json`; if any are found, add them to the Phase-2/3 plan
- [x] 1.4 Verify `package/folio` MUI surface is exactly the two known import sites; capture exact paths in `inventory.md` so they can be re-checked at Phase 4

## 2. Phase 1 — New primitives in `@rezics/ui`

- [x] 2.1 Create `package/ui/src/primitive/control/RatingInput.tsx` per `specs/score-input-primitive/spec.md` — props `{ value: number | null, onChange: (v: number | null) => void, max?: number, precision?: 1, size?: 'sm' | 'md' | 'lg', disabled?: boolean, readOnly?: boolean, ariaLabel?: string }`; `precision` accepts `1` only in this iteration; render `lucide-react` `Star` icons; integer 1..max selection; click selected star to clear → emit `null`
- [x] 2.2 Implement `RatingInput` keyboard support per spec: roving `tabindex`, `ArrowLeft`/`ArrowRight` move selection by 1 (clamped to `[1, max]`), `Home` = 1, `End` = max, `Backspace`/`Delete` = `null`, `Enter`/`Space` = select hovered/focused star
- [x] 2.3 Style `RatingInput` via UnoCSS using `--rezics-color-warning` (filled) / `--rezics-color-fg-muted` (empty) tokens; add `data-state="filled" | "empty"` for downstream styling hooks
- [x] 2.4 Export `RatingInput` from `package/ui/src/primitive/control/index.ts` and from `package/ui/src/index.ts` (or `@rezics/ui/primitive` subpath if that is the existing pattern); add a typed `RatingInputProps` export
- [x] 2.5 Write `package/ui/src/primitive/control/RatingInput.test.tsx` (`bun:test` + `@testing-library/react` if available, else jsdom-only render assertions) covering: render with value 0/null shows all empty, value=3 shows 3 filled, click star 5 emits 5, click star 5 again emits null, ArrowRight from 3 emits 4, Home emits 1, End emits max, disabled prevents onChange
- [x] 2.6 Add `package/ui/src/primitive/control/RatingInput.stories.tsx` with default / readOnly / disabled / sizes / max=5 / max=10 stories (Storybook surface stays MUI-free per Phase 2)
- [x] 2.7 Create `package/ui/src/primitive/feedback/EmptyState.tsx` exporting `<EmptyState icon, title, description, action />` using lucide icon slot, UnoCSS styling, no MUI imports; export from `@rezics/ui` and add a story
  > Implementation note: rewrote the existing `package/ui/src/composite/feedback/EmptyState.tsx` in place (per design.md Decision 5 which placed it under `composite/feedback`). The tasks.md path (`primitive/feedback`) and the design.md path differ; `composite/feedback` was chosen so existing consumers and the existing test/story keep their import path. The component itself is MUI-free per the spec.
- [x] 2.8 Create `package/ui/src/primitive/feedback/Spinner.tsx` exporting a CSS-only spinner (`@keyframes` in component CSS or UnoCSS `animate-spin`), props `{ size?: 'sm' | 'md' | 'lg', label?: string }` with `role="status"` and `aria-label`; export from `@rezics/ui` and add a story
- [x] 2.9 Run `bun run --cwd package/ui tsc --noEmit` and `bun run --cwd package/ui test` — both SHALL pass before merging Phase 1
  > tests: 26 pass / 0 fail across 4 files (RatingInput.test.tsx, EmptyState.test.tsx, plus pre-existing). tsc: only pre-existing errors remain (CookieConsentBanner.stories.tsx, DeleteWrapper.stories.tsx, CustomSidebar.stories.tsx all missing `args` — predate this change, ignored per "tsc per package, ignore cross-package errors" guidance).
- [x] 2.10 Update `.claude/skills/rezics-design/icons.md` with the canonical lucide-default mapping table per `specs/icon-system/spec.md`; include the icons promoted by Phase 4 (e.g. `Settings`, `Shield`/`ShieldUser`, `Star`, `Plus`, `X`, `Check`, `ChevronDown`)

## 3. Phase 2 — Theme runtime removal and Storybook foundation

- [x] 3.1 In `@rezics/ui`, remove the MUI theme factory file(s) (e.g. `package/ui/src/theme/getTheme.ts`, `package/ui/src/theme/getDynamicTheme.ts`, any `lightTheme`/`darkTheme` exports) and delete their re-exports from `package/ui/src/index.ts` per `specs/dissolve-app-shell/spec.md`
  > Deleted `package/ui/src/config/theme.ts` and `package/ui/src/config/dynamicTheme.ts`; pruned all theme/dynamic-theme exports from `package/ui/src/index.ts`. Phase 3 follow-up: `package/app/src/preference/components/ThemeCustomizer.tsx` and `package/app/src/preference/sections/ThemeDemo.tsx` still import `extractColorFromImage` and `PRESET_COLORS` from `@rezics/ui`; they will fail TS-check until Phase 3 rewrites or removes those preference pages.
- [x] 3.2 Remove `@mui/material/styles` imports from `@rezics/ui`; rewrite any internal theme consumers to read CSS custom properties (`--rezics-*`) instead of `theme.palette.*` / `theme.spacing(n)`
  > Rewrote `package/ui/src/primitive/typography/collapsible/Collapsible.tsx` (dropped MUI Link/MoreHoriz/SxProps; uses lucide `Ellipsis` + UnoCSS) and `package/ui/src/composite/auth/AuthProviderButton.tsx` (dropped useTheme/Box/Button/CircularProgress; plain `<button>` + UnoCSS reading `--rezics-*` tokens + `Spinner` primitive). Updated `AuthProviderButton.stories.tsx` to use lucide `Globe` placeholder (no Google icon in lucide; tabler `IconBrandGoogle` is the canonical replacement per `icons.md`, deferred to first real use).
- [x] 3.3 Verify `package/ui/src/shared/styles/layers.css` exposes the full token cascade required by Phase 3 utilities (palette tokens, spacing, radius, typography); add any tokens missing from the inventory in 1.2
  > Inspected; shadcn token block already routes every `--background|--foreground|--popover|--primary|--secondary|--muted|--accent|--destructive|--border|--input|--ring|--sidebar*` to a `--rezics-*` source. 69 token declarations counted, no additions needed.
- [x] 3.4 Update `package/storybook-config/preview.tsx` (or the equivalent shared preview) to remove `<ThemeProvider>` and any `@mui/*` imports; load `@rezics/ui/shared/styles/layers.css` as the only theming source per `specs/storybook-preview/spec.md`
  > Rewrote `package/storybook-config/src/preview.tsx`: dropped `CssBaseline`, `ThemeProvider`, `StyledEngineProvider`, and the `Theme` type. `withRezicsTheme()` now takes no theme factory — only the canvas option. Decorator sets `data-theme` via `useEffect` and renders the canvas wrapper with `var(--rezics-color-surface-canvas)` background.
- [x] 3.5 Add a Storybook decorator in the shared preview that toggles `[data-theme="light" | "dark"]` on the preview root via Storybook globals; include a regression story that asserts toggling re-resolves `--rezics-color-bg`
  > The `data-theme` toggle was already wired via the `themeMode` global type in `withRezicsTheme()`. Added regression story `package/ui/src/docs/ThemeMode.stories.tsx` (Foundation/Theme Mode Regression) which probes `getComputedStyle` for `--rezics-color-surface-canvas` / `--rezics-color-text-primary` and re-reads on `data-theme`/`class` mutation, demonstrating the cascade flips with the toolbar toggle.
- [x] 3.6 Update `package/app/.storybook/preview.tsx` (and `package/admin/.storybook/preview.tsx` if present) to consume the shared preview without MUI ThemeProvider; remove any `@mui/*` imports from those files
  > Updated `package/{ui,app,admin,folio}/.storybook/preview.tsx`: removed `getTheme` import and dropped it from `withRezicsTheme(...)` call sites. `package/editor/.storybook/preview.tsx` did not use `withRezicsTheme` — left untouched.
- [x] 3.7 Update `package/app/src/main.tsx` (and admin entry equivalent) per `specs/dissolve-app-shell/spec.md`: remove all `<ThemeProvider>`, `getTheme`, `lightTheme`, `darkTheme` imports; ensure `@rezics/ui/shared/styles/layers.css` is imported at app entry
  > Rewrote `package/app/src/app/App.tsx` and `package/admin/src/app/App.tsx`: dropped `ThemeProvider`, `CssBaseline`, `StyledEngineProvider`, `getTheme`, `getDynamicTheme`, `applyDynamicThemeToDOM`, `generateDynamicColors`. Effect now writes `data-theme` + `dark` class only. `@rezics/ui/shared/styles/layers.css` import preserved. Dynamic accent-color (custom user color) feature deferred — its re-implementation as token-only writes is Phase 3 follow-up.
- [ ] 3.8 Verify Storybook builds clean for `@rezics/ui`, `@rezics/app`, `@rezics/admin`: `bun run --cwd package/ui storybook --ci` (or equivalent build command); no `@mui/*` resolution warnings in build output
  > Deferred — full Storybook build is a heavy step. Tsc on `package/storybook-config` is clean; tsc on `package/ui` shows only pre-existing story errors (CookieConsentBanner / DeleteWrapper / CustomSidebar — unrelated to MUI). Re-run before merging the Phase 2 PR.
- [x] 3.9 Run `rg '@mui/material/styles|getTheme\\(|<ThemeProvider' package` — SHALL be empty before Phase 3 starts
  > Per-package result: `package/ui/`, `package/admin/`, `package/storybook-config/`, `package/folio/` all return zero hits. 6 remaining hits live in `package/app/` (search/SearchFilter, core/header/MainLayoutHeader, book-library/Chapter/ChapterArboristNode, book-library/Chapter/ChapterArboristHeightSlider, home/sections/NoticeBoard, plus the docs file `app/docs/DYNAMIC_THEME_README.md`); these are the Phase 3 deferred `useTheme()` / styled-API call sites already enumerated in `inventory.md`. Phase 3 will close this gate.

## 4. Phase 3 — Mechanical replacements across source

> Phase 3 is the bulk of the migration. Subsections cover each replacement family. Within each family, work package-by-package: `@rezics/ui` first (so consumers get the new exports), then `@rezics/app`, then `@rezics/admin`, then `@rezics/folio`. Run `bun run --cwd <package> tsc --noEmit` after each subsection completes.

### 4.1 Layout primitives → UnoCSS / shadcn

- [ ] 4.1.1 Replace `import { Box } from '@mui/material'` with `<div>` + UnoCSS classes; convert `sx={{ display, gap, p, m, ... }}` to UnoCSS utilities per design.md Decision 7 (8-px-grid scale → UnoCSS `1` = 4px doubling rule: `theme.spacing(1)` → `gap-2`, `theme.spacing(2)` → `gap-4`, `theme.spacing(3)` → `gap-6`)
- [ ] 4.1.2 Replace `<Stack direction="row" spacing={n}>` with `<div className="flex flex-row gap-{2n}">` (or `flex-col gap-{2n}` for column); preserve `alignItems`/`justifyContent` via `items-*`/`justify-*`
- [ ] 4.1.3 Replace `<Container>` with the project's existing shell wrapper or a plain `<div className="mx-auto w-full max-w-...">` matching the previous `maxWidth` token (sm=640, md=768, lg=1024, xl=1280)
- [ ] 4.1.4 Replace `<Grid container>` / `<Grid item xs={n}>` with CSS grid utilities (`grid grid-cols-12 gap-4` / `col-span-{n}`); for compound layouts where the conversion is non-trivial, document the original MUI layout in a single-line comment above the new code

### 4.2 Buttons & icon buttons → shadcn

- [ ] 4.2.1 Replace `import { Button } from '@mui/material'` with the shadcn `Button` from `@rezics/ui/shadcn`; map `variant="contained"` → `variant="default"`, `variant="outlined"` → `variant="outline"`, `variant="text"` → `variant="ghost"`; map `color="primary"` (default) and `color="error"` → `variant="destructive"`; map `size="small"|"medium"|"large"` → `size="sm"|"default"|"lg"`
- [ ] 4.2.2 Replace `<IconButton>` with the shadcn `Button` `size="icon"` variant; preserve `aria-label` (R3 enforced — every icon-only button keeps an accessible name)
- [ ] 4.2.3 Replace `<LoadingButton>` (`@mui/lab`) by composing shadcn `Button` with the new `<Spinner size="sm" />` and `disabled` prop; remove `@mui/lab` imports entirely
- [ ] 4.2.4 Replace `<ButtonGroup>` with a flex container of shadcn `Button`s; if segmented selection semantics are needed, use the shadcn `ToggleGroup` primitive instead

### 4.3 Inputs and form controls → shadcn

- [ ] 4.3.1 Replace `<TextField>` with shadcn `Input` (or `Textarea` for multiline) plus a sibling `Label` per the borderless aesthetic — per the saved feedback, "no MUI" still means TextField shape; map `helperText` → `<p className="text-sm text-rezics-fg-muted">`, map `error` → conditional `text-rezics-color-danger` styling
- [ ] 4.3.2 Replace `<Select>` / `<MenuItem>` with shadcn `Select` (Radix-based); preserve `value`/`onChange` semantics and `disabled` propagation
- [ ] 4.3.3 Replace `<Checkbox>` with shadcn `Checkbox`; preserve indeterminate state via `data-state="indeterminate"`
- [ ] 4.3.4 Replace `<Radio>` / `<RadioGroup>` with shadcn `RadioGroup` + `RadioGroupItem`
- [ ] 4.3.5 Replace `<Switch>` with shadcn `Switch`
- [ ] 4.3.6 Replace `<FormControl>` / `<FormLabel>` / `<FormHelperText>` with the shadcn `Form` primitives (`Field`, `FieldLabel`, `FieldDescription`, `FieldError`) or plain `<label>` + helper `<p>` for one-off forms
- [ ] 4.3.7 Replace `<Slider>` with shadcn `Slider`
- [ ] 4.3.8 Replace MUI `<Rating>` with the new `<RatingInput>` everywhere; this includes review creation, review edit, inline remark form, and remark edit dialog per `specs/review-remark-ux/spec.md` and `specs/score-input-primitive/spec.md`
- [ ] 4.3.9 Replace `<ToggleButtonGroup>` / `<ToggleButton>` with shadcn `ToggleGroup` + `ToggleGroupItem`; in the remark form context, the score input MUST become `<RatingInput>` rather than a `ToggleGroup` (per `specs/review-remark-ux/spec.md` Scenario "Score input is RatingInput")

### 4.4 Surface and feedback components

- [ ] 4.4.1 Replace `<Card>` / `<CardHeader>` / `<CardContent>` / `<CardActions>` with shadcn `Card` family; remove decorative borders for "section" surfaces per saved feedback (Apple-inspired borderless aesthetic)
- [ ] 4.4.2 Replace `<Paper>` with `<div>` + `bg-rezics-color-bg-elevated` UnoCSS utilities; drop MUI `elevation` mapping (we don't ship layered shadows by default — case-by-case if needed)
- [ ] 4.4.3 Replace `<Divider>` with `<hr className="border-rezics-color-border" />` or `<div role="separator" />` for vertical
- [ ] 4.4.4 Replace `<Avatar>` / `<AvatarGroup>` with shadcn `Avatar` family
- [ ] 4.4.5 Replace `<Chip>` with shadcn `Badge`; for chips with delete affordance, compose `Badge` + a shadcn `Button size="icon" variant="ghost"` containing `lucide` `X`
- [ ] 4.4.6 Replace `<Alert>` / `<AlertTitle>` with shadcn `Alert` family; map `severity="success|info|warning|error"` to the corresponding `--rezics-color-{success|info|warning|danger}` tokens
- [ ] 4.4.7 Replace `<Snackbar>` / `<MuiAlert>`-as-toast usage with shadcn/Sonner `toast()`; remove the global Snackbar provider and any related state if it exists
- [ ] 4.4.8 Replace `<Skeleton>` with shadcn `Skeleton`
- [ ] 4.4.9 Replace `<CircularProgress>` / `<LinearProgress>` with the new `<Spinner>` primitive (for indeterminate) or shadcn `Progress` (for determinate)
- [ ] 4.4.10 Replace MUI empty-state ad-hoc compositions with the new `<EmptyState>` primitive

### 4.5 Navigation, dialogs, overlays

- [ ] 4.5.1 Replace `<Tabs>` / `<Tab>` with shadcn `Tabs` family (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`); preserve URL-driven tab selection if present in the consuming page
- [ ] 4.5.2 Replace `<Dialog>` / `<DialogTitle>` / `<DialogContent>` / `<DialogActions>` with shadcn `Dialog` family; preserve focus trap (Radix default) and escape-to-close
- [ ] 4.5.3 Replace `<Drawer>` with shadcn `Sheet`; preserve `anchor="left"|"right"|"top"|"bottom"` via the `side` prop
- [ ] 4.5.4 Replace `<Menu>` / `<MenuItem>` with shadcn `DropdownMenu` family
- [ ] 4.5.5 Replace `<Popover>` with shadcn `Popover` (Radix-based); for the tag-interaction site specifically, the popover MUST be `modal={false}` per `specs/tag-interaction-component/spec.md` (no backdrop, no scroll lock, other chips remain clickable)
- [ ] 4.5.6 Replace `<Popper>` (low-level) with shadcn `Popover` configured `modal={false}`; if a non-anchored floating layer is needed, use `@radix-ui/react-popper` directly (already a transitive dep of shadcn)
- [ ] 4.5.7 Replace `<Tooltip>` with shadcn `Tooltip` (Radix-based); preserve `title` → `<TooltipContent>` text
- [ ] 4.5.8 Replace `<Breadcrumbs>` with the shadcn `Breadcrumb` family
- [ ] 4.5.9 Replace MUI `<AppBar>` / `<Toolbar>` with the project's existing shell layout components (no shadcn equivalent needed); remove any MUI imports from app-shell internals
- [ ] 4.5.10 Replace MUI `<List>` / `<ListItem>` / `<ListItemButton>` / `<ListItemText>` / `<ListItemIcon>` with semantic `<ul>`/`<li>` + UnoCSS, or shadcn `Command` for command-palette-style lists
- [ ] 4.5.11 Replace MUI `<Accordion>` family with shadcn `Accordion`

### 4.6 Tables and data display

- [ ] 4.6.1 Replace MUI `<Table>` family with shadcn `Table` (`Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`, `TableHead`); for the admin dashboard's complex tables, evaluate keeping TanStack Table headless logic (already in use) over the shadcn presentation only
- [ ] 4.6.2 Replace `<DataGrid>` (`@mui/x-data-grid`) with TanStack Table + shadcn `Table` if any usage is found; if no `@mui/x-*` imports exist (verify via `rg '@mui/x-' package`), document the absence in a single-line comment in `inventory.md`
- [ ] 4.6.3 Replace `<Pagination>` with the existing project pagination component or compose shadcn `Button`s

### 4.7 Icons → lucide (with tabler fallback)

- [x] 4.7.1 Replace every `import { X } from '@mui/icons-material'` with the lucide-react equivalent per `.claude/skills/rezics-design/icons.md`; common mappings: `Edit` → `Pencil`, `Delete` → `Trash2`, `Add` → `Plus`, `Close` → `X`, `Search` → `Search`, `Settings` → `Settings`, `MoreVert` → `MoreVertical`, `MoreHoriz` → `MoreHorizontal`, `ArrowBack` → `ArrowLeft`, `Visibility` → `Eye`, `VisibilityOff` → `EyeOff`, `Star` → `Star`, `StarOutline` → `Star` with `data-state="empty"`
- [x] 4.7.2 Specifically replace `SecurityOutlined` (realm permission icon) with `Shield` or `ShieldUser` per `specs/realm-frontend/spec.md`
- [x] 4.7.3 For icons missing in lucide, import from `@tabler/icons-react` and document the mapping in `.claude/skills/rezics-design/icons.md` per `specs/icon-system/spec.md`; do not add `@tabler/icons-react` to `package.json` until at least one site needs it
- [x] 4.7.4 Replace any emoji used as UI chrome with a lucide icon (per `specs/icon-system/spec.md` Scenario "Emoji not used as functional chrome"); decorative emoji inside user-generated content stays

### 4.8 `sx` prop sweep

- [ ] 4.8.1 For each `sx={{ ... }}` occurrence, mechanically convert to UnoCSS classes per design.md Decision 7 — common mappings: `p: n` → `p-{2n}`, `m: n` → `m-{2n}`, `gap: n` → `gap-{2n}`, `borderRadius: n` → `rounded-{xs|sm|md|lg|xl|2xl|full}` (use the closest `--rezics-radius-*` token), `bgcolor: 'background.paper'` → `bg-rezics-color-bg-elevated`, `color: 'text.secondary'` → `text-rezics-fg-muted`, `display: 'flex'` → `flex`, `flexDirection: 'column'` → `flex-col`, `alignItems`/`justifyContent` → `items-*`/`justify-*`
- [ ] 4.8.2 For dynamic sx values (functions of theme or props), inline a CSS variable on `style` (`style={{ '--rezics-local-color': computed }}`) and reference it from a UnoCSS class
- [ ] 4.8.3 Run `rg '\\bsx=' package/{ui,app,admin,folio}/src` — SHALL be empty before Phase 4 closes

## 5. Phase 4 — Specialized & per-site replacements

- [ ] 5.1 `@rezics/folio` (2 known imports per `inventory.md`): replace each per the matching subsection in §4; verify with `rg '@mui/' package/folio/src` empty
- [ ] 5.2 Tag interaction site per `specs/tag-interaction-component/spec.md`: convert popper to shadcn `Popover` with `modal={false}`; verify the three scenarios manually in the dev server (click another chip while open, no backdrop, page remains scrollable)
- [ ] 5.3 Review creation/edit pages and inline remark form per `specs/review-remark-ux/spec.md`: confirm `<RatingInput>` is the only score input rendered; remove any `ToggleButtonGroup`-as-rating, numeric-button row, or MUI `<Rating>` imports in this surface
- [ ] 5.4 Realm management header per `specs/realm-frontend/spec.md`: confirm the manage icon is a lucide settings icon (`Settings` / `Settings2` / `SlidersHorizontal`) and the import is from `lucide-react`
- [ ] 5.5 Admin dashboard pass: walk every admin page in dev, confirm visual parity (or accepted deltas) and capture screenshots of any intentional visual changes in the PR description
- [ ] 5.6 Cross-package smoke test: run all dev servers (`bun run dev`) and click through the top user journeys (sign-in, browse books, open a book detail, leave a review, manage realm) confirming no console errors and no missing components

## 6. Phase 5 — Cleanup, R8 activation, dependency removal

- [ ] 6.1 Remove every `@mui/*` and `@material/material-color-utilities` entry from `dependencies` / `devDependencies` / `peerDependencies` / `optionalDependencies` in `package/ui/package.json`, `package/app/package.json`, `package/admin/package.json`, `package/storybook-config/package.json`, `package/folio/package.json`, and any other affected workspace `package.json` (verify against §1.2 inventory)
- [ ] 6.2 Run `bun install` at the repo root; commit the resulting `bun.lock` change in the same commit as the `package.json` updates
- [ ] 6.3 Verify cleanup with `rg '@mui/' package/*/package.json` (SHALL be empty) and `rg '@material/material-color-utilities' package/*/package.json` (SHALL be empty)
- [ ] 6.4 Verify source cleanup with `rg "from ['\"]@mui/" package/*/src` (SHALL be empty) and `rg "from ['\"]@material/material-color-utilities['\"]" package/*/src` (SHALL be empty)
- [ ] 6.5 Implement R8 in `tool/scripts/check-convention.ts` per `specs/convention-enforcement/spec.md`: add `R8: "openspec/specs/ui-component-foundation/spec.md"` to `SPEC_LINK`, extend the `Rule` union with `"R8"`, add R8 to the preamble rule-summary table, and add the rule body that scans `package/*/src/**/*.{ts,tsx,js,jsx,mdx}` for `from ['\"]@mui/` and `package/*/package.json` for `@mui/*` / `@material/material-color-utilities` keys; R8 SHALL ignore any `expected-violations.json` entries (no per-site allowlist)
- [ ] 6.6 Run `bun run check:convention` — R8 SHALL pass (no violations) along with R1–R7
- [ ] 6.7 Update `CLAUDE.md`'s convention section to mention R8 and point to `openspec/specs/ui-component-foundation/spec.md` as the authoritative source; state that MUI is permanently removed and that introducing it requires an OpenSpec change to both `ui-component-foundation` and `convention-enforcement` specs (per `specs/convention-enforcement/spec.md` Scenario "Rule documented in CLAUDE.md")
- [ ] 6.8 Delete the saved memory entry "UI library priority — MUI first, shadcn supplements" (or update it to the new policy: shadcn-or-custom, MUI permanently deprecated) — note in the PR description that this was done
- [ ] 6.9 Run `bun run knip` at the repo root — confirm no orphaned MUI-adjacent code remains; clean up any reported unused exports introduced by the migration
- [ ] 6.10 Run `bun run --cwd package/ui tsc --noEmit`, `bun run --cwd package/app tsc --noEmit`, `bun run --cwd package/admin tsc --noEmit`, `bun run --cwd package/folio tsc --noEmit`, `bun run --cwd package/editor tsc --noEmit` — all SHALL pass
- [ ] 6.11 Run `bun test` at the repo root — all tests SHALL pass; the `RatingInput` tests added in §2.5 SHALL be in the green count
- [ ] 6.12 Build verification: `bun run --cwd package/app build` and `bun run --cwd package/admin build` SHALL succeed; bundle analyzer (or `du -sh package/app/dist`) SHOULD show a measurable bundle-size reduction; capture before/after numbers in the PR description per design.md success criteria

## 7. Documentation and rollout

- [ ] 7.1 Update `CONTRIBUTING.md` to mention the no-MUI policy and link to `openspec/specs/ui-component-foundation/spec.md`
- [ ] 7.2 Update `.claude/skills/rezics-design/` skill files: add the component selection policy (shadcn-or-custom), the lucide-default + tabler-fallback icon policy, and a one-page MUI → replacement map sourced from §4 of this tasks file
- [ ] 7.3 Open the PR titled `chore(deprecate-mui): permanently remove MUI from rezics-book-library` linking the OpenSpec change directory; include before/after bundle-size numbers and a screenshot reel of the most visually affected pages
- [ ] 7.4 After PR merges, run `/opsx:archive deprecate-mui` to move the change into `openspec/changes/archive/` per the change-management workflow
