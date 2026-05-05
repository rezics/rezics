## Why

The `@rezics/ui/shadcn` directory currently vendors shadcn's `new-york-v4` style — a `radix-ui`-based registry with a stripped-down visual language. Three problems compound:

1. **Missing tactile feedback.** The `new-york-v4` Button has `transition-all hover:bg-primary/90` and nothing else. shadcn's current canonical themes (the Luma family on the v4 site) ship `active:not-aria-[haspopup]:translate-y-px` — a press-down feedback that is the visual signature of the rezics-aligned aesthetic. Our buttons feel inert by comparison; the parchment-voice / Apple-influenced direction calls for tactile press feedback. (User flagged this directly: "爲什麼項目內的 button … 完全沒有他的動效啊", then confirmed the new-york-v4 baseline is what's installed and what needs to change.)
2. **`radix-ui` is in maintenance mode.** Radix Primitives saw 1 commit in 2026; `@base-ui/react` (built by ex-Radix + ex-MUI + ex-Floating UI maintainers) ships 20+ commits/month and is the active development line. Continuing on `radix-ui` accumulates a dependency that no longer receives feature work.
3. **Two-axis registry, one axis chosen.** shadcn now publishes a primitive × theme matrix (`<primitive>-<theme>`): primitives are `radix` or `base`; themes are `luma` / `lyra` / `maia` / `mira` / `nova` / `sera` / `vega`. Our current `new-york` style predates this matrix. Picking explicitly along both axes (base × luma) replaces an outdated implicit choice.

After exploration the user picked **Path P: trust luma, 0 modifications** — vendor shadcn primitives as shipped from the `base-luma` registry, accept their styling decisions, and reserve the rezics design vocabulary for *rezics-authored* code (`package/ui/src/primitive/`, `package/ui/src/composite/`, app-level composites). The boundary is firm: shadcn primitives consume the spacing values shadcn ships with; rezics-authored components consume the closed nine-token `--padding-*` vocabulary defined in `complete-rezics-design-storybook/specs/design-system-density/spec.md`.

The Path-P trade is "stop fighting shadcn." Patching vendored primitives to consume rezics tokens creates a divergence drift surface every time shadcn updates. Trusting luma lets `pnpm dlx shadcn@latest add <primitive>` run cleanly forever, with the rezics flavor concentrated in the components rezics actually owns.

## What Changes

- **CHANGED**: `package/ui/components.json` — `style` flips from `"new-york"` to `"base-luma"` (or to the canonical registry URL once shadcn confirms the addressing form). `iconLibrary` stays `"lucide"`. Aliases unchanged.
- **CHANGED**: `package/ui/package.json` — `radix-ui` removed from dependencies; `@base-ui/react` added (latest stable, ≥1.4.1). Other package.json files (`@rezics/admin`, `@rezics/app`, `@rezics/folio`, `@rezics/editor`) — only the few cases where `radix-ui` is imported directly (verify; should be `@rezics/ui/shadcn` consumers only).
- **CHANGED**: every file in `package/ui/src/shadcn/*.tsx` **except `carousel.tsx` and `sidebar.tsx`** is re-vendored from `base-luma` (the `pnpm dlx shadcn@latest add <name>` form will be used so the registry handles the mechanical work). Vendored files retain Path-P fidelity: no manual edits to spacing, color tokens, or behavior. The files that need a deliberate touch:
  - **`carousel.tsx`** — kept as-is (heavy local customization: imports `@/primitive/carousel/ArrowButton`, retains the deprecated `arrowVariant` no-op prop). Documented as a Path-P exception.
  - **`sidebar.tsx`** — kept as-is (14 commits of customization). Documented as a Path-P exception. Future shadcn `sidebar` updates will be hand-merged.
- **CHANGED**: `asChild`-based composition pattern (Radix idiom) is replaced by `render`-prop composition (base-ui idiom) at every callsite. A codemod handles the mechanical translation; manual cleanup covers cases where `render` requires a function form. Affected: app-level files that use `asChild` on shadcn primitives (audit during 2.1).
- **CHANGED**: `package/ui/src/config/uno-config.ts` — extend the `RADIUS` scale to add `"4xl": "32px"` so Luma's larger-radius primitives have a token to bind to. The existing eight entries (`xs` 4 → `2xl` 24, plus `pill` and `full`) are unchanged.
- **CHANGED**: the nine `--padding-*` token *values* in `uno-config.ts` are recalibrated against Luma's intrinsic padding so rezics-authored components placed adjacent to vendored shadcn primitives on the same page render at a coherent rhythm. Recalibration is per-token, justified case-by-case during 4.x; the closed-vocabulary rule from `design-system-density/spec.md` is preserved (still nine entries).
- **CHANGED**: `openspec/specs/ui-component-foundation/spec.md` — the wrapper sentence in Requirement-1 ("Radix-based, token-aligned via the flat `--colors-*` CSS custom-property cascade") updates to "**base-ui-based**, token-aligned via the flat `--colors-*` CSS custom-property cascade." All other Requirements (component-selection policy, custom-primitive placement, on-demand custom-primitive rule, `@rezics/ui/shadcn` re-export rule) preserve their authoritative form unchanged.
- **NOT IN SCOPE**: Patching vendored `base-luma` primitives to consume rezics tokens. Path P explicitly rejects this. Tokens recalibrate; primitives don't. (Note that the `complete-rezics-design-storybook` change is being corrected in parallel to roll back any prior patches that wired `--padding-*` into `package/ui/src/shadcn/*.tsx`.)
- **NOT IN SCOPE**: Re-introducing a runtime density toggle. `complete-rezics-design-storybook` codifies density as per-component-type intrinsic; this change preserves that boundary (no `--density-step` is reintroduced through the back door).
- **NOT IN SCOPE**: Building a parallel `base-mira`/`base-nova`/etc. theme switch. Luma is the chosen theme; alternatives stay theoretical until a future OpenSpec change.
- **NOT IN SCOPE**: Visual restyling of rezics-authored primitives or composites. Their tokens may be recalibrated (Phase 4) but their structure is unchanged.
- **NOT IN SCOPE**: Server, contract, backend, or routing changes. Frontend dependency + token recalibration only.

## Capabilities

### Modified Capabilities

- `ui-component-foundation`: the "Radix-based" framing in Requirement-1 swaps to "base-ui-based." The shadcn-or-custom selection policy itself is unchanged; the implementation primitive base under shadcn changes.

### New Capabilities

None. This change updates the implementation underlying an existing capability; it does not introduce a new one.

## Impact

- **Affected packages**:
  - `@rezics/ui` (`package/ui`) — most impact. 28 of 30 shadcn primitive source files re-vendored from `base-luma` (carousel and sidebar excluded). Dependency swap (`radix-ui` out, `@base-ui/react` in). `components.json` style update. Token recalibration in `uno-config.ts` (`RADIUS` gets `4xl`; nine `--padding-*` values revisited).
  - `@rezics/admin`, `@rezics/app`, `@rezics/folio`, `@rezics/editor` — minor: callsites using `asChild` migrate to `render`. Estimated <30 callsites total based on a `rg "asChild" package/{admin,app,folio,editor}/src/` audit (run during 2.1).
- **Files added**: 0 (no new spec files; this change only modifies `ui-component-foundation`). The four OpenSpec artifacts (`proposal.md`, `design.md`, `tasks.md`, `specs/ui-component-foundation/spec.md`) are themselves new but live under `openspec/changes/migrate-shadcn-to-base-ui-luma/`.
- **Files changed**:
  - `package/ui/components.json` (1 file, 1 line).
  - `package/ui/package.json` + lockfile (dependency swap).
  - `package/ui/src/shadcn/*.tsx` × 28 (re-vendored from `base-luma`).
  - `package/ui/src/config/uno-config.ts` (RADIUS extension + nine `--padding-*` value recalibrations).
  - Callsite migrations (`asChild` → `render`) across <30 files in app packages.
- **Imports changed**: any direct `radix-ui` import becomes `@base-ui/react`. The `@rezics/ui/shadcn` re-export surface is preserved — consumers of `@rezics/ui/shadcn/<primitive>` notice no import-path change.
- **Dependencies**: `radix-ui` removed; `@base-ui/react` added (≥1.4.1). Sub-package dependencies that bundle Radix transitively are reviewed during 1.x.
- **Backward compatibility**: callsite-level breakage is concentrated in `asChild` → `render` migrations. The codemod covers the mechanical case; ~5 callsites are expected to need manual translation (e.g. when `asChild` was used with a non-trivial child).
- **Verification**:
  - `bun -F @rezics/ui storybook` and `bun -F @rezics/ui run build-storybook` both succeed.
  - All five Storybook builds (`@rezics/ui`, `@rezics/admin`, `@rezics/app`, `@rezics/folio`, `@rezics/editor`) plus the root host succeed.
  - Visual sweep (manual): every shadcn-primitive Storybook story renders; the press-down feedback (`active:translate-y-px`) is visible on Button, Toggle, ToggleGroup, and any other primitive whose Luma source ships it.
  - `rg "from \"radix-ui\"|from 'radix-ui'" package/` returns zero matches in source.
  - `rg "asChild" package/{admin,app,folio,editor}/src/` returns zero matches (or only matches inside `// @ts-expect-error` shims documented during migration).
  - `bun run check:convention` passes (R5 SafeLink, R7 plan.draw, R9 token namespace).
  - `bun run check:tokens` passes (HCT 40/80 contrast invariant).
  - Per-package `bunx tsc --noEmit`: each package clean independently (per the user's documented policy).
- **Risk**: Medium. The vendor swap touches 28 primitive files; while shadcn's CLI handles the mechanical re-vendor, individual primitives may have local edits that the swap discards. Mitigation: review every primitive's `git log` before swap; flag any primitive with >2 commits of local history (beyond the carousel/sidebar exceptions) for manual reconciliation. The token recalibration risk is low — the nine values move toward Luma's defaults, not away.
