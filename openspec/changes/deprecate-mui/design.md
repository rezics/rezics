## Context

The rezics frontend currently runs three component vocabularies in parallel: MUI Material (`@mui/material` + `@mui/icons-material` + `@mui/lab`), shadcn primitives (Radix-based, in `package/ui/src/shadcn/`), and rezics-owned primitives (in `package/ui/src/primitive/` and `package/ui/src/composite/`). MUI was the foundation when the system was first built. The `establish-design-system` change layered an explicit Apple-inspired, parchment-and-warm-stone aesthetic on top, and the `--rezics-*` token system became the source of truth. shadcn coverage has since reached parity with the MUI surface area we actually use. Maintaining all three systems pays a triple cost: the AI skill needs an explicit `mui-vs-shadcn.md` decision tree, the CSS bundle ships Emotion + Material Icons + lucide-react, and every token rename has to be reflected through the MUI theme adapter, the UnoCSS preset, and `layers.css`.

Concrete inventory at the start of this change:

| Surface | Files | Imports |
| --- | --- | --- |
| `@mui/material` | 347 | 509 |
| `@mui/icons-material` | 113 | 210 |
| `@mui/lab` | 1 | 1 |
| `sx={…}` props | 159 | 518 |
| `useTheme()` / `theme.palette/spacing/breakpoints/typography` | 32 | — |
| `lucide-react` | 1 | 1 |
| `@rezics/ui/shadcn` primitives already shipped | — | 30+ |

`@rezics/editor` has zero MUI imports and zero MUI dependency declarations today. `@rezics/folio` declares no MUI dependency in its `package.json` but resolves two MUI icon imports transitively through the workspace and is treated as a 2-file fix-up. The remaining packages — `@rezics/ui`, `@rezics/app`, `@rezics/admin`, `@rezics/storybook-config` — all declare MUI dependencies and host the bulk of the work.

The pre-migration window is unusually quiet: no concurrent UI work is planned. We exploit that to treat the migration as an atomic refactor — one change, many phased tasks, all merged together — rather than a series of partial states bleeding through `dev`.

This document records the decisions that shape that migration. The proposal explains *why* the migration happens; this design explains *how*. The specs in `specs/**/*.md` capture the resulting requirements.

## Goals / Non-Goals

**Goals:**

1. Remove `@mui/material`, `@mui/icons-material`, `@mui/lab`, and `@material/material-color-utilities` from every `package/*/package.json` in the monorepo.
2. Remove every `from "@mui/..."` and `from '@mui/...'` import from every source file under `package/*/src/`.
3. Remove every `sx` prop usage from React components, replacing it with UnoCSS classes derived from the `--rezics-*` token system.
4. Remove every `useTheme()` / `theme.palette/spacing/breakpoints/typography` runtime access, replacing it with `var(--rezics-*)` references and small TypeScript breakpoint constants.
5. Replace every MUI icon import with a `lucide-react` icon (default) or an `@tabler/icons-react` icon (named fallback when lucide lacks the glyph).
6. Replace every MUI component usage with either a shadcn primitive from `@rezics/ui/shadcn` or a rezics-owned custom primitive from `@rezics/ui/primitive` / `@rezics/ui/composite`. Author the small set of new custom primitives required to make this possible — `RatingInput`, `EmptyState`, `Spinner` — and the lightweight wrappers around shadcn primitives (e.g. `IconButton`-shaped wrapper around shadcn `Button` for parity with the MUI ergonomics).
7. Rewrite `@rezics/storybook-config/src/preview.tsx` to drop MUI's `ThemeProvider`, `StyledEngineProvider`, and `CssBaseline`, and switch theme strictly via the `[data-theme]` attribute and the `--rezics-*` cascade.
8. Update the rezics-design AI skill (`SKILL.md`, `mui-vs-shadcn.md`, `patterns.md`) to reflect the shadcn-or-custom policy and the lucide-default / tabler-fallback icon vocabulary.
9. Add a convention-check rule (R8) to `bun run check:convention` that fails the gate on any `@mui/` import in `package/*/src/`. R8 enforcement begins at the end of this change.
10. Preserve the visual identity of every screen — pixel parity is not required, but no surface SHALL gain or lose its visual identity. Returning users should not notice the migration.

**Non-Goals:**

1. **Visual redesign**. Shadcn defaults are restyled to match the rezics aesthetic via UnoCSS classes, not redesigned. The migration preserves outcomes, not pixels.
2. **Promoting custom primitives across packages**. Each new primitive lives where it is first needed. Cross-package promotion (e.g. `@rezics/app`-local primitive into `@rezics/ui`) is a future concern.
3. **Touching the deferred large refactors** flagged by prior adoption audits — `MarkdownEditor.css` palette migration, editor toolbar chrome rewrite, `package/folio/src/styles/theme.ts` reader-theme tokenization. None depend on MUI; all stay on their own dedicated PR tracks per `design-system-adoption` Requirement-3.
4. **Server-side, contract, or backend changes**. Frontend-only.
5. **Backward-compatibility shims**. `@rezics/ui` is workspace-internal with no external consumers; removed exports are removed, not aliased. The change is closed-shop.
6. **Custom primitive design beyond the three named blockers**. `RatingInput`, `EmptyState`, `Spinner` ship with this change because removing MUI is impossible without them. Any other rezics-owned primitive someone might want — a richer `Combobox`, a custom `DatePicker`, a bespoke `DataTable` — is out of scope and SHALL be governed by its own change.
7. **i18n / translation key changes**. Components migrate, copy stays.

## Decisions

### Decision 1 — Single change, phased tasks, atomic merge

**Choice:** This is one OpenSpec change (`deprecate-mui`) with one set of phased tasks. The full migration merges as a connected sequence. No partial state is allowed to ship to `dev`.

**Rationale:** The user has explicitly stated no other UI work will land while this is in flight, eliminating the merge-conflict pressure that would otherwise force phased changes. With that constraint relaxed, the cost of running multiple parallel changes (re-deriving inventories, re-validating spec deltas, coordinating `R8` enforcement) exceeds the benefit. A single change with phased *tasks* keeps the spec coherent (one set of requirements, one diff) while preserving phased execution semantics during implementation.

**Alternatives considered:**

- **Six separate OpenSpec changes (Phase 0 through Phase 5).** Rejected. Higher coordination cost, six sets of validation, and risk that an intermediate phase becomes visible state. The pre-migration window's quietness invalidates the main argument for splitting.
- **Per-package changes (`deprecate-mui-app`, `-admin`, `-ui`, `-storybook-config`).** Rejected. Cross-package coupling (the `@rezics/ui` MUI theme is consumed by `@rezics/app` and `@rezics/admin`) means per-package changes would have to land in a strict sequence with intermediate compat shims. That is exactly the half-migrated state we are avoiding.

### Decision 2 — Component selection policy: shadcn-or-custom

**Choice:** Replace the existing "MUI-first, shadcn supplement, custom last resort" policy with **"shadcn primitives by default; rezics-owned custom primitives when shadcn does not cover the case or when the rezics aesthetic requires a non-Radix-based implementation."** Drop "no third option" — there is no third option.

**Rationale:** Two policies are simpler than three. Shadcn already covers everything in the MUI Top-15 surface (see Decision 4 matrix below) and its Radix base is already aligned with our accessibility and portal-mounting expectations. The "custom" tier exists for the small surface where shadcn does not fit (the `RatingInput` is the canonical example: no shadcn primitive for star-rating; an MUI-style implementation built on Radix `ToggleGroup` would be over-abstracted; a small dedicated component is clearer).

**Alternatives considered:**

- **shadcn-only.** Rejected. Some primitives (e.g. star rating, certain content-display surfaces) have no shadcn analogue, and forcing them through Radix toggle / select primitives produces worse code than a small custom component.
- **Custom-only.** Rejected. Shadcn's wrapped Radix primitives are mature, accessible, and aesthetically close to our target. Reimplementing dialog, dropdown, popover, tooltip, command palette would be a multi-week distraction from the migration's actual goal.

### Decision 3 — Icon vocabulary: lucide default, tabler fallback

**Choice:** `lucide-react` is the default icon source. `@tabler/icons-react` is the named fallback used **only** when lucide lacks a glyph the design needs. The decision per icon SHALL be recorded in a canonical mapping table in the rezics-design skill (`.claude/skills/rezics-design/icons.md`), keyed by former MUI icon name where applicable.

**Rationale:** Lucide is already a declared dependency of `@rezics/ui` and is the icon vocabulary shadcn uses. Anchoring on lucide minimizes net-new dependencies, gives the project visual icon consistency (lucide's stroke-based style fits the borderless rezics aesthetic), and keeps the bundle predictable. Tabler exists as the safety valve because lucide's catalog (~1100 icons) has gaps in vendor logos and a small number of business-domain glyphs (e.g. specialized brand affordances). Naming tabler as the *only* fallback prevents the migration from sprawling into "use whatever icon library each contributor knows" — that is exactly the maintenance hell the change exists to avoid.

**Alternatives considered:**

- **Tabler default.** Rejected. Larger bundle base; no shadcn anchor.
- **Lucide-only, custom SVG for missing glyphs.** Considered. Rejected for now to avoid spawning a separate SVG-curation track. If during migration we find tabler is invoked fewer than ~5 times, the policy can be tightened to "lucide-only" in a follow-up change.
- **Heroicons / Phosphor / Iconoir.** Rejected. None offers a meaningful advantage over lucide for our aesthetic, and adopting any of them would require building an icon catalog from scratch.

**Implementation note:** `@tabler/icons-react` is added to `package/ui/package.json` *only* once a tabler glyph is actually invoked during the migration. Preemptive inclusion is forbidden. If tabler is never invoked, it is never added.

### Decision 4 — Component replacement matrix

The table below records the canonical replacement for each MUI primitive observed in the inventory. "Custom" entries name the rezics-owned primitive that ships with this change.

| MUI source | Count | Replacement | Notes |
| --- | --- | --- | --- |
| `Typography` | 92 | `<h1/h2/h3/p/span>` + UnoCSS class | Token-driven (`text-2xl text-text-primary`, etc.). The `Typography` abstraction was rarely earning its keep. |
| `Box` | 60 | `<div>` + UnoCSS class | Pure layout container; UnoCSS class handles all styling concerns. |
| `Button` | 44 | `@rezics/ui/shadcn` `Button` | Variants reconciled (rezics-design `brand-fill` background = shadcn `default`). |
| `Stack` | 37 | `<div>` + UnoCSS flex/gap classes | `flex flex-col gap-N` etc. |
| `TextField` | 21 | `@rezics/ui/shadcn` `Input` + `Label` | The MUI variant prop ("standard" / "filled" / "outlined") collapses; rezics standard is borderless underline (per voice). |
| `IconButton` | 21 | shadcn `Button` `variant="ghost" size="icon"` | Plus a thin local wrapper named `IconButton` only if call sites benefit ergonomically. |
| `Chip` | 20 | shadcn `Badge` | Removable variant adds an inline `X` icon button. |
| `CircularProgress` | 16 | Custom `Spinner` primitive | New primitive (Decision 5). |
| `Card` / `CardContent` | 27 | shadcn `Card` / `CardContent` | shadcn equivalent already exists. |
| `Divider` | 13 | `<hr>` + UnoCSS or shadcn `Separator` | Preference: shadcn `Separator` for consistency. |
| `Avatar` | 12 | shadcn `Avatar` | shadcn equivalent already exists. |
| `Tooltip` | 10 | shadcn `Tooltip` | shadcn equivalent already exists. |
| `MenuItem` / `Menu` | 16 | shadcn `DropdownMenu` (`DropdownMenuItem`, `DropdownMenuContent`) | API shape differs — composer pattern instead of items array. |
| `Alert` | 9 | shadcn `Alert` | shadcn equivalent already exists; the `query-error-display` spec migrates accordingly. |
| `Tabs` / `Tab` | 16 | shadcn `Tabs` / `TabsList` / `TabsTrigger` | Overflow handled by shadcn `ScrollArea` per `book-detail-tab-layout` and `settings-layout` updates. |
| `Paper` | 6 | `<div>` + UnoCSS | Paper was a thin wrapper over `Box` with elevation. Use UnoCSS surface classes. |
| `useTheme` | 7 | `var(--rezics-*)` references + small TS breakpoint constants if needed | TypeScript breakpoint constants exported from `@rezics/ui/config/breakpoints` for the rare JS-side use. |
| `Skeleton` | 5 | shadcn `Skeleton` | shadcn equivalent already exists. |
| `ListItemText` / `ListItemIcon` / `ListItemButton` | 13 | shadcn `DropdownMenu` items or plain JSX | Many call sites are inside a Menu and migrate together. |
| `FormControlLabel` | 5 | `<label>` + shadcn `Checkbox` / `RadioGroup` | shadcn equivalents handle the wiring. |
| `Dialog` / `DialogContent` | 10 | shadcn `Dialog` | shadcn equivalent already exists; transitions revert from MUI Slide/Zoom to shadcn defaults (Decision 7). |
| `ThemeProvider` | 3 | Removed | No replacement; the only call sites were Storybook preview and one Folio bootstrap. |
| `Rating` | 3 | Custom `RatingInput` primitive | New primitive (Decision 5). |
| `Grid` | 2 | `<div>` + UnoCSS grid | `grid grid-cols-N gap-N`. |
| `Container` | 2 | `<div>` + UnoCSS `mx-auto max-w-*` | Container was a fixed-width wrapper. |
| `Checkbox` | 6 | shadcn `Checkbox` | shadcn equivalent already exists. |
| `useMediaQuery` | 1 | UnoCSS responsive classes or `window.matchMedia` direct | The single call site is reviewed individually. |
| `Zoom` (transition) | 1 | Removed | Single call site; revert to default fade. |
| `Toolbar` / `SvgIcon` / `styled` | 3 | Case-by-case | Each reviewed individually; no general replacement rule. |
| `CardMedia` | 3 | `<img>` or `<RezicsImage>` | `<RezicsImage>` is the existing rezics-owned image primitive. |
| `Tooltip`-like patterns inside MenuItem | — | shadcn `DropdownMenu.Item` | Aligns with overall menu migration. |

The matrix is non-exhaustive (small-count primitives are reviewed individually). Every replacement is verified on first use; if a shadcn primitive does not in fact deliver the expected behavior, the gap is recorded and a custom primitive is added with its own design decision.

### Decision 5 — New custom primitives ship with this change

Three custom primitives are net-new and ship inside the migration because removing MUI is impossible without them.

**`RatingInput`** — `package/ui/src/primitive/control/RatingInput.tsx`. Star rating control. Props: `value: number | null`, `onChange: (next: number | null) => void`, `max: number = SCORE_MAX`, `precision: 1`, `size?: "sm" | "md" | "lg"`, `disabled?: boolean`, `readOnly?: boolean`. Renders `max` lucide `Star` icons; clicking the currently-selected star emits `null` (matching MUI's "click again to clear" behavior, which the existing spec depends on). Keyboard support: arrow-left / arrow-right to decrement / increment, `0` to clear, `1`–`9` (or first digit of double-digit `max`) to set. Focus management uses a single roving tabindex on a `[role="radiogroup"]` wrapper. The component SHALL be authored *with* its tests (a `RatingInput.test.tsx` covering keyboard, click-to-clear, max boundary).

**`EmptyState`** — `package/ui/src/composite/feedback/EmptyState.tsx`. Already specified in `list-empty-state` spec; reauthored in this change to use rezics primitives + shadcn `Button` rather than MUI `Stack` + `Typography`. Same prop surface (`title`, `description?`, `icon?`, `action?`).

**`Spinner`** — `package/ui/src/primitive/feedback/Spinner.tsx`. Replaces every `<CircularProgress>` call site. Props: `size?: "sm" | "md" | "lg"`, `label?: string` (rendered as `aria-label`). Implementation uses lucide `Loader2` with a `motion-spin` UnoCSS class deriving from `--rezics-motion-base`. The component is intentionally minimal — anything more specialized (linear progress, determinate progress) is out of scope and will be added if a real call site emerges.

These three are the **only** custom primitives shipping with this change. Anything else (richer Combobox, DatePicker, DataTable, etc.) is explicitly out of scope per Non-Goal-6.

### Decision 6 — Theme handoff: drop `createTheme`, project tokens via CSS variables only

**Choice:** Delete `package/ui/src/config/theme.ts` (the MUI `createTheme` factory) and `package/ui/src/config/dynamicTheme.ts` (the Material-color-utilities-based dynamic theme generator). Token modules in `package/ui/src/config/tokens/*` remain authoritative. Consumers receive tokens *only* through (a) the `--rezics-*` CSS custom properties declared in `layers.css`, (b) the UnoCSS preset that maps to those CSS variables, and (c) a small TypeScript breakpoints export at `package/ui/src/config/breakpoints.ts` for the rare JS-side need.

**Rationale:** The MUI theme adapter is the bridge to a system being removed. Keeping it would mean either (a) a permanent dead-code adapter, or (b) a thin compat shim that nothing consumes. Better to delete the bridge with the bank.

**Dynamic theme decision:** `dynamicTheme.ts` currently allows extracting a color from a book cover image and generating a Material-3-style HCT palette around it. This is invoked from one composite in `@rezics/ui` (the cover-image-driven gradient). Two options:

- **(A) Drop the feature entirely.** Lower-cost; the gradient was nice-to-have, not load-bearing.
- **(B) Reimplement on top of a smaller color-extraction utility (e.g. `colorthief` or a hand-rolled k-means).** Higher-cost; preserves the feature.

This change picks **(A)** as the default — drop the feature — and treats reintroduction as a future change governed by a separate proposal. The composite that depended on it falls back to a static gradient using `--rezics-color-brand-fill` and `--rezics-color-surface-elevated`. This is recorded as a deliberate trade-off (see Risks below).

**Alternatives considered:**

- **Keep `createTheme` as a thin token-projection layer.** Rejected. Would require keeping `@mui/material/styles` as a dependency of `@rezics/ui` purely to support a no-op adapter that nothing imports.
- **Build a custom non-MUI theme provider.** Rejected. The CSS-variable cascade *is* the theme; React Context is not needed for token resolution.

### Decision 7 — `sx` → UnoCSS conversion is mechanical, not interpretive

**Choice:** Convert `sx` props to UnoCSS classes one prop at a time, mechanically. The mapping is:

- `sx={{ color: 'text.secondary' }}` → `className="text-text-secondary"`
- `sx={{ p: 2 }}` (MUI 8px scale × 2 = 16px) → `className="p-4"` (UnoCSS 4px scale × 4 = 16px)
- `sx={{ display: 'flex', gap: 1 }}` → `className="flex gap-2"`
- `sx={{ bgcolor: 'background.paper' }}` → `className="bg-surface-base"`

The conversion table is documented in `design.md` of this change (this section, by reference) and replicated in the rezics-design skill so AI agents converge on the same mapping. Where a `sx` prop is genuinely conditional (`sx={isActive ? {...} : {...}}`), the conversion uses `clsx`/`cn` from `@rezics/ui` to compose conditional classes.

**Rationale:** UnoCSS classes derive from the same `--rezics-*` token system, so the conversion is value-preserving. The MUI 8px-vs-UnoCSS 4px scale difference is the one trap — every numeric `sx` value is doubled when crossing into UnoCSS. This is the single biggest source of accidental regressions; the rezics-design skill documents it explicitly and the convention checker SHALL include a soft warning when migration commits introduce numerically suspicious UnoCSS class numbers.

**Alternatives considered:**

- **Keep `sx` and rebuild it as a custom prop on rezics primitives.** Rejected. Reinventing CSS-in-TS on top of CSS variables is exactly the parallel-system problem we are escaping.
- **Use raw inline `style={{...}}`.** Rejected. UnoCSS provides token-aware shorthand and we already lean on it elsewhere.

### Decision 8 — Storybook preview rewrite

**Choice:** Rewrite `package/storybook-config/src/preview.tsx` to:

1. Drop imports from `@mui/material` and `@mui/material/styles`.
2. Toggle theme via a single `[data-theme]` attribute setter on `<html>` driven by Storybook's `globals` toolbar.
3. Continue importing `@rezics/ui/shared/styles/layers.css` so `--rezics-*` resolves.
4. Remove the `withRezicsTheme` decorator (it was the MUI ThemeProvider wrapper). No replacement decorator is needed.
5. Remove the `THEME_BROADCAST_EVENT` cross-iframe broadcast — actually retain it; the cross-iframe broadcast is independent of MUI and useful for the multi-package Storybook composition.

**Rationale:** The MUI ThemeProvider was load-bearing only for components that consumed `useTheme()` at runtime. Once those calls are migrated to `var(--rezics-*)` references, no provider is needed. The `[data-theme]` cascade alone delivers the theme-switching behavior.

### Decision 9 — Convention check (R8) and lint gate

**Choice:** Add R8 to `bun run check:convention`: any source file under `package/*/src/` containing a literal `@mui/` SHALL fail the gate. The check uses `rg "@mui/" package/*/src/ -l` and fails if the result is non-empty. R8 is **inactive during Phases 1–4** (added to the convention-check source code but not in the failure list), and **activated at the end of Phase 5** once the last MUI import has been removed. The `package/*/package.json` files are also checked for `"@mui` and `"@material/material-color-utilities"` strings.

**Rationale:** R8 is the durable guarantor that the migration cannot be partially undone. Activating it mid-migration would block the migration itself (every intermediate commit would fail R8). Activating it at the end transforms the migration into a permanent property of the codebase. Pre-commit and PR-merge gates already run `check:convention`, so R8 ships in the same enforcement posture as R5 (SafeLink), R7 (factory ctx.draw).

**Alternatives considered:**

- **ESLint rule.** Considered. Rejected because the project's ESLint configuration is light and the convention checker is the established mechanism for repo-wide rules. Adding a single rule via the convention checker keeps the pattern.
- **Activate R8 progressively (one package at a time).** Rejected. The migration ships atomically (Decision 1); progressive R8 has no consumer.

### Decision 10 — Phase ordering and dependency graph

The implementation is split into six task phases. Phases run in strict order; intra-phase tasks may parallelize.

```
Phase 0 — Specs, skill, design freeze (no code)
   │
   ▼
Phase 1 — Custom primitives (RatingInput, EmptyState, Spinner)
   │     + Storybook preview rewrite
   │     + Tabler dep added on first use
   ▼
Phase 2 — Icon migration (210 imports → lucide / tabler)
   │     - low risk, mostly mechanical
   ▼
Phase 3 — Layout / sx migration (Box, Stack, Typography, Divider, Paper, Container, Grid)
   │     - largest mechanical phase
   │     - sx → UnoCSS conversion
   │     - useTheme() → var(--rezics-*) for typography / spacing references
   ▼
Phase 4 — Interactive primitive migration (Button, TextField, IconButton, Chip,
   │     Card, Tabs, Dialog, Tooltip, Alert, Avatar, Skeleton, Menu, MenuItem,
   │     Checkbox, FormControlLabel, ListItem*, Rating)
   │     - per-feature visual review
   │     - score-input call sites switch to RatingInput
   │     - ChipPicker (app-search-feature) switches to Badge + X
   ▼
Phase 5 — Theme delete + dependency removal + R8 activation
         - delete theme.ts, dynamicTheme.ts
         - remove @mui/material, @mui/icons-material, @mui/lab,
           @material/material-color-utilities from all package.json
         - run bun install; verify lockfile is clean
         - activate R8; run check:convention; run typecheck per package
         - update CLAUDE.md and rezics-design skill final state
```

Phase 0 is structural — it freezes the spec deltas and the design before code moves. Phase 1 builds the *replacements* before Phase 2–4 *consume* them. Phase 5 is the final cleanup; it cannot start until Phases 1–4 are complete.

**Per-phase verification gates:**

- **End of Phase 1:** new primitives have unit tests passing; Storybook builds without MUI ThemeProvider for `@rezics/ui`.
- **End of Phase 2:** `rg "from ['\"]@mui/icons-material" package/*/src/` returns zero matches.
- **End of Phase 3:** `rg "sx=\\{" package/*/src/` returns zero matches; `rg "useTheme\\(\\)" package/*/src/` returns zero matches; `rg "from ['\"]@mui/material/styles" package/*/src/` returns zero matches.
- **End of Phase 4:** `rg "from ['\"]@mui/material" package/*/src/` returns zero matches.
- **End of Phase 5:** `rg "@mui/" package/*/src/` returns zero matches; `rg "\"@mui" package/*/package.json` returns zero matches; `bun run check:convention` passes; `bun run typecheck` passes for `@rezics/ui`, `@rezics/app`, `@rezics/admin`, `@rezics/storybook-config`, `@rezics/folio`, `@rezics/editor`; every Storybook builds.

### Decision 11 — Folio and editor handling

**Folio:** Two MUI icon imports (`Folio.tsx`, `plugins/txt/TxtSettings.tsx`). These migrate as part of Phase 2. `package/folio/package.json` is verified MUI-free at the start *and* end of the change.

**Editor:** Already MUI-free. The change adds a regression guard: R8 enforcement covers `package/editor/src/` and the convention check verifies `package/editor/package.json` declares no `@mui/*` dependency. `package/editor/README.md` is updated only if it references MUI in prose.

### Decision 12 — `@rezics/ui` exports change is breaking-but-internal

**Choice:** `@rezics/ui` removes `getTheme`, `getDynamicTheme`, `applyDynamicThemeToDOM`, `dynamicColorsToPalette`, `extractColorFromImage`, `generateDynamicColors`, `PRESET_COLORS`, and `DynamicColorScheme` from its public surface. New exports include `RatingInput`, `EmptyState`, `Spinner`, and (if needed) breakpoint constants.

**Rationale:** `@rezics/ui` is workspace-internal. The only consumers are sibling packages in this monorepo — all migrated atomically as part of this change. No external consumers, no compat shims.

## Risks / Trade-offs

### Risk 1 — Dialog z-index / portal stacking regressions

Migrating `Dialog` from MUI to shadcn changes the portal mounting strategy. MUI mounts portals via React 18 `createPortal` to `document.body` with a managed z-index stack. Shadcn (Radix) does the same but with different default z-index values. Modal-on-modal scenarios (e.g. confirm-cancel inside an open dialog) may regress.

**Mitigation:** Phase 4 includes an explicit task to verify modal-on-modal scenarios for: `RealmManagePage` confirm-leave, `BookEdit` discard-changes confirm, `TokenCreateDialog` followed by copy-success toast, `ImageModal` opened from `EditorImageInsert`. Each is exercised in the dev server before Phase 4 closes.

### Risk 2 — Tabs scrollable overflow behavior

MUI `Tabs variant="scrollable" scrollButtons="auto"` is feature-rich: it auto-scrolls the active tab into view, shows arrow buttons when overflow, and handles RTL. shadcn `Tabs` does not provide scrollable variant; we wrap it in `ScrollArea` (Decision 4). Auto-scroll-into-view is added per call site if needed. RTL is not currently a project concern.

**Mitigation:** Phase 4 includes a task to verify the book-detail tab bar scrolls correctly on a viewport narrower than the tab strip width, both on initial render with a non-default active tab and after switching tabs by URL change.

### Risk 3 — TextField form-state semantics in auth flows

MUI `TextField` ties together `<input>`, `<label>`, helper text, and error state into a single declarative API. shadcn `Input` + `Label` + custom `<p>` for helper text is more compositional but exposes more surface area for inconsistency. Auth pages (`LoginPage`, `RegisterPage`, `ResetPasswordPage`, `CompleteRegistrationPage`) all rely on this pattern and exercise the error-state handoff.

**Mitigation:** Phase 4 starts by migrating one auth page (`LoginPage`) end-to-end and reviewing with the user before propagating. A `FormField` composite wraps the shadcn primitives with the rezics ergonomics — *if* the first migration shows the raw shadcn API is too verbose. The composite, if added, lives in `package/ui/src/composite/forms/field/FormField.tsx` and *is* in scope for this change because it would be a blocker.

### Risk 4 — RatingInput keyboard behavior parity

MUI `<Rating>` ships well-tested keyboard support: arrow keys, home/end, click-to-clear. The custom `RatingInput` (Decision 5) reimplements this. Risk: subtle regressions in screen-reader announcements or focus-order edge cases.

**Mitigation:** `RatingInput` ships *with* its tests covering arrow keys, `0` to clear, `Tab` in/out, and `aria-checked` state for screen readers. The tests run in `bun test` and gate Phase 1 closure.

### Risk 5 — Dynamic theme feature deletion may surprise users

Decision 6 drops `dynamicTheme.ts`. The book-cover-driven gradient feature goes away. Users on a book detail page will see a static brand-tinted gradient instead of a cover-color-derived one.

**Mitigation:** This is a deliberate trade-off, not a regression — the migration's primary goal supersedes the feature. The replacement static gradient is visually acceptable. If users miss the feature, a future change reintroduces it on a non-Material-3 color-extraction backend (`colorthief` or k-means in pure TS).

### Risk 6 — Bundle parity verification

The migration's de facto promise is "smaller bundle, same UX." Without measurement, we cannot verify the first half. A bundle-size measurement (`vite build --report` or `rollup-plugin-visualizer`) is captured before Phase 0 and after Phase 5 to confirm.

**Mitigation:** Phase 0 includes a baseline bundle measurement task. Phase 5 includes a delta measurement task. The delta is recorded in the change archive. If the bundle does not shrink (unlikely but possible if shadcn pulls more Radix surface than expected), it is investigated before R8 activation, not after.

### Risk 7 — Translation key drift

A migration that touches 363 files risks accidental copy changes. The change explicitly carries no copy changes (Non-Goal 7). Translation keys are mechanically preserved.

**Mitigation:** Phase 5's verification gate includes a `git diff` review filter for `t("...")` calls — any change in the argument string is flagged for explicit review.

### Risk 8 — Storybook composition site temporarily breaks

Phase 1 rewrites `storybook-config/preview.tsx`. Until it lands, intermediate commits may not render correctly under Storybook. This is acceptable because the change is atomic to `dev`.

**Mitigation:** None needed beyond the atomic-merge constraint.

### Risk 9 — Emotion residue

`@mui/material` depends on `@emotion/react` and `@emotion/styled`. After Phase 5, these may remain as transitively-installed packages if any other dependency consumes Emotion. The change verifies whether `@emotion/*` can be removed from the lockfile and either removes them (preferred) or documents why they stay.

**Mitigation:** Phase 5 includes a `bun pm ls @emotion/react` task; if no consumer remains, the package.json explicitly excludes it; otherwise the dependency tree is logged in the archive.

### Trade-off: maintenance burden of three new primitives

Adding `RatingInput`, `EmptyState`, `Spinner` adds three custom primitives to the maintenance surface — the very thing the migration aims to reduce. The trade-off is conscious: removing 3 large library dependencies (MUI core + icons + lab) and three sx/theme/createTheme parallel systems pays for itself many times over relative to three small, locally-maintained primitives.

## Migration Plan

### Rollout

The migration ships as one PR (or one `dev`-merged commit chain) covering all six phases. The PR description summarizes the per-phase verification gates and links to the change archive entry. There is no canary, no feature flag, no incremental rollout — `@rezics/ui` is workspace-internal and the change is a refactor, not a behavior change.

### Rollback strategy

The migration is a rebase-and-revert candidate if catastrophic regressions are discovered post-merge. Because it is a single connected change, `git revert <merge-commit> -m 1` restores the previous state cleanly. No data migration, no schema change, no environment variable change accompanies the migration, so revert is purely a code revert. Spec and skill updates revert with the same commit.

### Communication

The user has explicitly stated no other UI work is in flight, so no team-coordination sequence is needed. The change archive entry is the durable record.

### Order of operations summary

1. Phase 0 — write all spec deltas, update skill, freeze design (this PR's first commits).
2. Phase 1 — author `RatingInput`, `EmptyState`, `Spinner`; rewrite Storybook preview; add `@tabler/icons-react` only if first tabler glyph is invoked.
3. Phase 2 — migrate icons (113 files).
4. Phase 3 — migrate layout primitives + sx + useTheme (~290 files mostly in `app`).
5. Phase 4 — migrate interactive primitives, with auth-page bellwether first.
6. Phase 5 — delete theme.ts / dynamicTheme.ts; remove dependencies; activate R8; verify all gates; update CLAUDE.md.

## Open Questions

1. **Does `@emotion/*` have non-MUI consumers in the monorepo?** Resolved at Phase 5 start; if no consumer, removed; if a consumer (e.g. a shadcn primitive transitively pulls Emotion through some other path), retained and logged. Today we assume no consumer.

2. **Do any `package/app` or `package/admin` files import directly from `@mui/material/styles`?** Sample showed 32 files use `useTheme` / `theme.*`. Phase 0 includes a task to enumerate these and classify them — most should resolve to `var(--rezics-*)` references; any that need a runtime theme value (e.g. a `transition` cubic-bezier read at JS-time) is migrated to a small TS-side constants module.

3. **Does any storybook story explicitly depend on MUI's `ThemeProvider` for rendering correctness (e.g. an MUI-only component story)?** Phase 1 verifies this by enumerating all `*.stories.tsx` files and confirming each renders without `ThemeProvider` after the preview rewrite.

4. **Does `dynamicTheme.ts` have any consumer beyond the cover-gradient composite?** Phase 0 includes a `rg generateDynamicColors\\|extractColorFromImage\\|applyDynamicThemeToDOM\\|PRESET_COLORS\\|DynamicColorScheme` audit. If a second consumer is found, Decision 6 is revisited.

5. **Should the `IconButton` ergonomic wrapper around shadcn `Button` be included?** Resolved during Phase 4 first migration: if `<Button variant="ghost" size="icon"><Icon /></Button>` is verbose enough at scale to warrant a wrapper, add it as `IconButton` in `@rezics/ui/primitive/button/IconButton.tsx`; otherwise leave the call sites verbose.

6. **Tabler dependency timing.** Decision 3 says tabler is added only on first use. If Phase 2 finishes without invoking tabler, the dependency is never added and the policy effectively collapses to lucide-only — which we accept as a successful outcome, not a violation.

7. **Bundle baseline.** Phase 0 captures the baseline; Phase 5 records the delta. If the delta is *positive* (bundle grew), the change is investigated before R8 activation. We do not have a hard threshold; "smaller, ideally meaningfully smaller" is the qualitative bar.
