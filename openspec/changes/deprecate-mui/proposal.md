## Why

The `establish-design-system` change shipped a token-driven foundation (`package/ui/src/config/tokens/`), the `--rezics-*` CSS custom-property namespace, light/dark surfaces, brand-specific typography (CJK-routed `font-sans` / `font-serif`), and an explicitly Apple-inspired borderless aesthetic. That foundation is now load-bearing — Storybook, voice/patterns docs, and adoption audits all derive from it. MUI was kept as the "primary component library" partly because shadcn coverage was incomplete at the time and partly out of inertia. Both reasons have lapsed.

What we have today is the worst kind of overlap: **three component vocabularies in active use at once.**

- `@mui/material` (509 imports across 347 files) — full-cost runtime (Emotion + JSS-style runtime CSS-in-JS), an extra theming surface (`createTheme` / `useTheme`) parallel to our token system, sx prop syntax (518 occurrences across 159 files) parallel to UnoCSS, and Material-Design defaults (rounded buttons, ripple, density helpers) that fight the borderless rezics aesthetic on every surface they touch.
- `@mui/icons-material` (210 imports across 113 files) — pulls in Material Icons by name; visually inconsistent with shadcn's lucide-default vocabulary; bundle-cost-per-icon model.
- `shadcn/ui` (`package/ui/src/shadcn/`, 30+ primitives already wrapped) — uses Radix primitives + Tailwind/UnoCSS. Already wired to our tokens via the `--rezics-*` namespace. This is the path the rest of the design system was built for.

The cost of running all three:
- **Conceptual cost**: every UI decision has to consult two policies (MUI-first vs shadcn-only) and produce code in two different idioms. The `mui-vs-shadcn.md` skill exists *because* of this friction.
- **Bundle cost**: `@mui/material` + `@mui/icons-material` + `@mui/lab` ship runtime CSS-in-JS, theme objects, and icon SVGs that are duplicated functionally by what shadcn + UnoCSS + lucide already deliver.
- **Aesthetic cost**: the foundation spec already encodes "borderless cards", "no decorative box-shadow on sections", "brand-fill is fill-only", "warm parchment canvas, not pure white" — Material Design defaults work *against* every one of these.
- **Maintenance cost**: token changes (e.g. the recent `--rzc-*` → `--rezics-*` rename) have to be reflected through the MUI theme adapter *and* the UnoCSS preset *and* `layers.css`. Three sources of truth fan out from one token change.

The decision is to converge on **one component vocabulary**: shadcn primitives for everything shadcn already covers (the majority surface), custom rezics-owned primitives for the small set shadcn does not cover (RatingInput, EmptyState, Spinner, etc.), `lucide-react` icons by default with `@tabler/icons-react` as the named fallback when lucide lacks a glyph, and UnoCSS classes derived from the `--rezics-*` token system for all styling. MUI is removed from runtime, dependencies, specs, and skills. Authoring custom primitives is *permitted* but is **not in scope for this migration** — primitives are added on demand as the migration uncovers gaps, each governed by its own change.

The pre-migration window is unusually clean: no other UI work is planned in parallel until this lands. We exploit that to do the mechanical sweeps (sx → UnoCSS, MUI icon → lucide) without merge-conflict overhead.

## What Changes

- **REMOVED**: `@mui/material`, `@mui/icons-material`, `@mui/lab` from runtime, `package.json` dependencies, and TypeScript imports across **all** consuming packages — `@rezics/ui`, `@rezics/app`, `@rezics/admin`, `@rezics/storybook-config`, `@rezics/folio` (2 import sites). `@rezics/editor` SHALL be confirmed MUI-free; today it imports nothing from `@mui/*`, this change codifies that as a constraint.
- **REMOVED**: `@material/material-color-utilities` (the dynamic theme generator built on top of Material's HCT space). Dynamic theming, if retained, is rewired to a token-only path or discontinued; either decision is captured in `design.md`.
- **REMOVED**: `package/ui/src/config/theme.ts` MUI `createTheme` factory and the `getTheme` / `getDynamicTheme` exports. The token modules in `package/ui/src/config/tokens/*` remain authoritative; the MUI projection layer goes.
- **REMOVED**: `useTheme()`, `theme.palette`, `theme.spacing`, `theme.breakpoints`, `theme.typography` runtime accesses (32 files). Replaced by `var(--rezics-*)` references, UnoCSS classes, and a small set of TypeScript exports for the few places that need a JS-side breakpoint constant.
- **REMOVED**: `sx` prop usage (518 occurrences, 159 files). All converted to UnoCSS classes deriving from the same tokens, or to extracted CSS modules where compositional logic warrants it.
- **REMOVED**: `mui-vs-shadcn.md` decision-table in `.claude/skills/rezics-design/`. Replaced by a single `component-selection.md` reflecting the new shadcn-or-custom policy.
- **CHANGED**: Component selection policy from **"MUI-first, shadcn supplement, custom last resort"** to **"shadcn-or-custom; no third option"**. shadcn primitives are the default; rezics-owned primitives in `package/ui/src/primitive/` and `package/ui/src/composite/` are the alternative when shadcn does not provide a fitting primitive or when the rezics aesthetic requires a non-Radix-based implementation.
- **CHANGED**: Icon policy from **"`@mui/icons-material` default, `lucide-react` when MUI absent"** to **"`lucide-react` default, `@tabler/icons-react` named fallback when lucide lacks the glyph"**. A canonical mapping table SHALL be added to the design skill so authors know which icon to reach for. Tabler is added as a dependency only after the migration sweep identifies which glyphs actually require it (no preemptive inclusion).
- **CHANGED**: Storybook theme switching: `@rezics/storybook-config/src/preview.tsx` SHALL stop importing from `@mui/material` and SHALL toggle theme strictly via `[data-theme]` on `<html>` plus the `--rezics-*` cascade. Story rendering ceases to depend on MUI's `ThemeProvider` / `StyledEngineProvider` / `CssBaseline`.
- **CHANGED**: `score-input-primitive` capability — replaces the MUI `<Rating>` requirement with a rezics-owned `RatingInput` primitive (lucide `Star` glyphs, integer `precision={1}`, `max={SCORE_MAX}` from `@rezics/contract`). The primitive lives in `package/ui/src/primitive/control/RatingInput.tsx` and is built and tested as part of this migration (it is the one custom primitive blocking removal of `@mui/material`).
- **CHANGED**: `query-error-display` capability — replaces MUI `Alert` / `Collapse` with shadcn `Alert` and shadcn `Collapsible`.
- **CHANGED**: `list-empty-state` capability — replaces "composed of MUI primitives (Stack, Typography, …)" with "composed of token-driven rezics primitives".
- **CHANGED**: `post-reply-composer`, `book-detail-tab-layout`, `admin-auth-pages`, `settings-layout`, `app-search-feature`, `realm-frontend`, `review-remark-ux`, `tag-interaction-component`, `dissolve-app-shell` capabilities — references to specific MUI components (`TextField size="small"`, `Tabs variant="scrollable"`, `Card`, `Chip`, `SecurityOutlined` icon, etc.) replaced by the corresponding shadcn primitive or custom primitive plus icon-from-lucide reference.
- **CHANGED**: `design-system-foundation` capability — drops the "MUI theme exposes light/dark themes" Requirement and the "MUI theme imports tokens, not literals" Scenario. Tokens remain the single source of truth; the MUI projection layer is no longer mandated to exist.
- **CHANGED**: `design-system-voice-patterns` capability — "MUI-first component policy" Requirement replaced by "shadcn-or-custom component policy"; icon-policy Requirement updated from "MUI Material Icons or shadcn lucide-react" to "lucide-react default, tabler fallback".
- **CHANGED**: `design-system-storybook` capability — drops the "MUI ThemeProvider" toolbar requirement, retains the `[data-theme]` cascade requirement.
- **CHANGED**: `design-system-adoption` capability — the "defensible" categories that referenced MUI APIs (icon `fontSize` numerics, sx integer multiples) are removed; the corresponding violations are now actionable, not defensible.
- **ADDED**: `ui-component-foundation` capability — the new spec governing "shadcn-or-custom, no-MUI" component selection, including the constraint that `@mui/*` packages SHALL NOT appear in any `package/*/package.json` and that no source file SHALL import from `@mui/*`.
- **ADDED**: `icon-system` capability — codifies the lucide-default / tabler-fallback rule, the canonical mapping table from former MUI icon names, and the constraint that emoji SHALL NOT be used as UI chrome.
- **ADDED**: `convention-enforcement` capability gains a new **R8** rule via `bun run check:convention`: any source file under `package/*/src/` containing a literal `@mui/` SHALL fail the gate. R8 enforcement begins at the end of this change.
- **NOT IN SCOPE**: Promoting custom primitives across packages (e.g. `@rezics/app`-local primitives into `@rezics/ui`). Each new primitive lives where it is first needed; promotion is a future concern.
- **NOT IN SCOPE**: Touching the deferred large refactors from prior adoption audits (`MarkdownEditor.css` palette, editor toolbar chrome, `package/folio/src/styles/theme.ts` reader theme tokenization). These remain on their own dedicated PR tracks per `design-system-adoption` Requirement-3 — none of them depend on MUI today.
- **NOT IN SCOPE**: Visual redesign. The migration SHALL preserve the *visual outcome* of every screen at the level of "a returning user does not notice" — pixel parity is not required, but no surface SHALL gain or lose its visual identity. Shadcn defaults are restyled to match the rezics aesthetic via UnoCSS classes, not redesigned.
- **NOT IN SCOPE**: Server-side, contract, or backend changes. Frontend-only.

## Capabilities

### New Capabilities

- `ui-component-foundation`: The component selection policy for rezics frontend code. Encodes the "shadcn-or-custom, no-MUI" rule, the surface-area inventory (which shadcn primitives the project relies on, which custom primitives the project owns), the prohibition on `@mui/*` imports anywhere in `package/*/src/`, and the convention check (R8) that enforces it.
- `icon-system`: The icon vocabulary policy. Codifies `lucide-react` as the default icon source, `@tabler/icons-react` as the named fallback when lucide lacks a glyph, the canonical mapping from former MUI icon names to lucide names, and the prohibition on emoji as UI chrome.

### Modified Capabilities

- `design-system-foundation`: Drops the "MUI theme exposes light/dark themes" Requirement and the "MUI theme imports tokens, not literals" Scenario. Adds the constraint that token modules SHALL NOT import from `@mui/*` and SHALL be projected to consumers only via CSS custom properties and a thin TypeScript surface (no `createTheme` adapter).
- `design-system-voice-patterns`: Replaces "MUI-first component policy" Requirement with "shadcn-or-custom component policy". Updates the icon-policy Requirement from "MUI Material Icons or shadcn lucide-react" to "lucide-react default, tabler fallback". Updates the sx-vs-UnoCSS guidance.
- `design-system-storybook`: Drops the "Storybook MUI ThemeProvider toolbar" Requirement; retains the `[data-theme]` cascade Requirement. Updates the preview.tsx layout description.
- `design-system-adoption`: Removes the "MUI icon fontSize numerics" and "MUI sx integer multiples for spacing" entries from the defensible categories (those APIs no longer exist post-migration). Adds an `@mui/*` import as a Hard-Never violation.
- `score-input-primitive`: Replaces the MUI `<Rating>` requirement with a rezics-owned `RatingInput` primitive in `package/ui/src/primitive/control/RatingInput.tsx`. Updates Scenarios accordingly.
- `query-error-display`: Replaces MUI `Alert` / `Collapse` with shadcn `Alert` + `Collapsible`.
- `list-empty-state`: Replaces "composed of MUI primitives" with "composed of rezics primitives" (tokenized layout primitives + shadcn `Button` for the optional action slot).
- `post-reply-composer`: Replaces "approximately the height of a `TextField` of MUI `size="small"`" with a token-pinned height (`--rezics-space-10` / `40px`) anchored to the rezics input scale.
- `book-detail-tab-layout`: Replaces "MUI `Tabs` with `variant="scrollable"`" with shadcn `Tabs` plus a horizontal-scroll `ScrollArea` for the overflow case. The fixed-right language dropdown placement is preserved.
- `admin-auth-pages`: Updates the icon prescription from `SecurityOutlined`/`AdminPanelSettingsOutlined` (MUI) to `Shield` / `ShieldUser` (lucide). Updates the "Use MUI components (Card, CardContent, Button, Typography, etc.)" guidance to the shadcn equivalents.
- `settings-layout`: Replaces "horizontal scrollable MUI Tabs" with shadcn `Tabs` inside a `ScrollArea`.
- `app-search-feature`: Replaces "removable MUI chips" with shadcn `Badge` + lucide `X` action affordance.
- `realm-frontend`: Updates any MUI references to their shadcn / rezics-primitive equivalents (audited per `rg`).
- `review-remark-ux`: Updates any MUI references to their shadcn / rezics-primitive equivalents (audited per `rg`).
- `tag-interaction-component`: Updates any MUI references to their shadcn / rezics-primitive equivalents (audited per `rg`).
- `dissolve-app-shell`: Drops the "`@rezics/app` imports `getTheme` from `@rezics/ui`" Requirement (the MUI factory it referenced no longer exists). Retains the `@rezics/app-shell` dissolution requirements.
- `convention-enforcement`: Adds R8 — any source file containing `from "@mui/` (or any equivalent string form) SHALL fail `bun run check:convention`. Updates the enforcement summary to reflect R8.

## Impact

- **Affected packages**:
  - `@rezics/ui` (`package/ui`) — `@mui/material`, `@mui/icons-material`, `@mui/lab`, `@material/material-color-utilities` removed from `dependencies`. `src/config/theme.ts`, `src/config/dynamicTheme.ts` removed (token modules remain). `src/composite/`, `src/primitive/`, `src/editor/` MUI usages migrated to shadcn / custom primitives. New `RatingInput`, `EmptyState`, `Spinner` primitives authored. `lucide-react` already in deps; `@tabler/icons-react` added on first use.
  - `@rezics/app` (`package/app`) — largest delta. ~340 MUI imports across ~290 files migrated. `sx` props converted to UnoCSS classes. MUI theme accesses converted to `var(--rezics-*)` and small TS-side breakpoint constants exported from `@rezics/ui`. `@mui/*` removed from `dependencies`.
  - `@rezics/admin` (`package/admin`) — every page-level MUI usage migrated. Admin retains its compact-density voice via UnoCSS density classes. `@mui/*` removed from `dependencies`.
  - `@rezics/storybook-config` (`package/storybook-config`) — `preview.tsx` rewritten to drop `ThemeProvider` / `StyledEngineProvider` / `CssBaseline`. `@mui/material` removed from `dependencies` and `peerDependencies`.
  - `@rezics/folio` (`package/folio`) — 2 import sites in `Folio.tsx` and `plugins/txt/TxtSettings.tsx` migrated to lucide icons. (Folio has no `@mui/*` in `package.json`, so the removal is at the import level only.)
  - `@rezics/editor` (`package/editor`) — already MUI-free. This change adds an enforcement check that ensures it stays that way.
- **Files touched (estimate)**: ~363 source files across `package/ui`, `package/app`, `package/admin`, plus 2 in `package/folio` and 1 in `package/storybook-config`. Plus 17 spec files in `openspec/specs/`, 2 skill files in `.claude/skills/rezics-design/`, the project `CLAUDE.md`, and the convention checker.
- **Imports changed (estimate)**: ~509 `@mui/material` imports → shadcn / custom primitive imports; ~210 `@mui/icons-material` imports → lucide / tabler imports; ~518 `sx` prop usages → UnoCSS classes; ~32 `useTheme` / `theme.*` runtime accesses → `var(--rezics-*)` / TS constants.
- **Dependencies removed**: `@mui/material`, `@mui/icons-material`, `@mui/lab`, `@material/material-color-utilities`. (`@emotion/*` is examined and removed if no remaining consumer; this is verified during Phase 6.)
- **Dependencies added**: `@tabler/icons-react` (added on first fallback use, not preemptively). `lucide-react` is already a dependency of `@rezics/ui`.
- **APIs**:
  - `@rezics/ui` exports change: `getTheme`, `getDynamicTheme`, `applyDynamicThemeToDOM`, `dynamicColorsToPalette`, `extractColorFromImage`, `generateDynamicColors`, `PRESET_COLORS`, `DynamicColorScheme` are removed. New exports include the custom primitives (`RatingInput`, `EmptyState`, `Spinner` — exact list finalized in `design.md`) and breakpoint constants if any.
  - The `@rezics/ui/shadcn` subpath export is unchanged (its internal implementations are token-aligned but its module surface is the same).
- **Backward compatibility**: This change is a closed-shop refactor — `@rezics/ui` is workspace-internal, no external consumers exist outside the monorepo. All call sites are migrated atomically per phase, no compatibility shims are kept. Removed exports are removed, not aliased.
- **Migration**: The change is structured into six in-this-PR-batch phases (Phase 0 spec changes through Phase 5 dependency removal + R8 enforcement). Phase 0 ships first as a doc-and-spec preflight; Phases 1–5 ship as a connected sequence guarded by per-phase convention-check gates so an incomplete migration cannot ship a broken state. Detailed sequencing is in `tasks.md`.
- **Verification**: After Phase 5, `rg "@mui/" package/*/src/` SHALL return zero matches, `rg "@mui/" package/*/package.json` SHALL return zero matches, `bun run check:convention` SHALL pass with R8 active, every Storybook story SHALL render without the MUI `ThemeProvider`, and every page in `@rezics/app` and `@rezics/admin` SHALL render without console errors related to missing theme context.
- **Risk**: The mechanical bulk of the change is low-risk (sx → UnoCSS, icon swaps). The medium-risk surfaces are `Dialog` modal stacking (z-index ordering), `Tabs` overflow scroll behavior, `TextField` form-state semantics in auth flows, and `Rating` keyboard navigation in the new custom primitive. Each is called out in `design.md` with a verification approach.
