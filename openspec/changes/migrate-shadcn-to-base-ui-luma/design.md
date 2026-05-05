## Context

Three observations converge in this change.

**The current state.** `package/ui/components.json` declares `"style": "new-york"`, an early shadcn style that pre-dates the v4 site's primitive × theme matrix. The vendored primitives use `radix-ui` directly. Visual treatment is minimal: Button has `transition-all hover:bg-primary/90` and no press feedback. The user noticed this directly while comparing rezics buttons to shadcn's official site, where Buttons press down on click via `active:not-aria-[haspopup]:translate-y-px`.

**Where shadcn moved.** As of late 2025 / early 2026, the shadcn registry exposes a two-axis selection: primitives are `radix` or `base` (where `base` means `@base-ui/react`); themes are one of seven aesthetic profiles (`luma` / `lyra` / `maia` / `mira` / `nova` / `sera` / `vega`). The Luma family ships the press-down feedback inline in the Button component, plus larger radii, denser shadows, and a more cohesive visual ladder than `new-york`. `@base-ui/react` is built by ex-Radix + ex-MUI + ex-Floating UI maintainers — the active development line for headless React primitives. Radix Primitives have entered maintenance mode (1 commit in 2026 vs 20+ commits/month in `@base-ui/react`).

**The Path-P decision.** The user explored four levels of involvement:
- Path A — keep `new-york`, hand-port the press-down to our Button.
- Path B — switch to `radix-luma`, keep Radix but adopt Luma styling.
- Path C — switch to `base-luma`, both axes upgraded.
- Path P — Path C with **0 modifications** to vendored shadcn source. The rezics design vocabulary lives only in rezics-authored code; vendored primitives consume the values shadcn ships with.

Path P chosen. The reasoning is "stop fighting shadcn." Patching vendored primitives to consume rezics tokens creates work every time shadcn updates and a divergence drift surface every time we pull. Trusting Luma keeps the registry CLI clean and concentrates rezics taste in the layers we actually own.

## Goals

- Vendored shadcn primitives ship with their out-of-the-box Luma values for spacing, typography references, color tokens. No rezics overlay on the shadcn surface.
- The press-down feedback (`active:not-aria-[haspopup]:translate-y-px`) is visible on Button without rezics-side edits. Toggle and ToggleGroup follow the official `base-luma` registry output, which does not currently ship press-down translation.
- `@base-ui/react` is the headless primitive base. `radix-ui` is removed.
- `pnpm dlx shadcn@latest add <primitive>` (or the bun-equivalent CLI invocation) succeeds against the configured `base-luma` registry without manual surgery.
- The rezics density vocabulary (the nine `--padding-*` tokens from `complete-rezics-design-storybook`) is preserved. Its values are recalibrated against Luma's intrinsic padding so rezics-authored composites placed adjacent to vendored shadcn primitives render at a coherent rhythm.
- The `RADIUS` scale gains `4xl: 32px` so Luma's larger-radius primitives bind to a token rather than a magic number.

## Non-Goals

- Porting the rezics design vocabulary into vendored shadcn source. Path P explicitly rejects this.
- Re-introducing a runtime density toggle. `complete-rezics-design-storybook` codifies density as per-component-type intrinsic; this change preserves that boundary.
- Building a theme-switcher across Luma / Mira / Nova / etc. — Luma is the chosen theme.
- Re-vendoring `carousel.tsx` or `sidebar.tsx`. They have heavy local customization and stay as Path-P exceptions.
- Visual restyling of rezics-authored primitives or composites.

## Decisions

### Decision 1: Path P — trust Luma, vendor unmodified

Vendored shadcn primitives in `package/ui/src/shadcn/*.tsx` are pulled from the `base-luma` registry **as shipped**. No rezics-side edits to spacing values, color tokens, animation curves, or behavior.

The rezics design vocabulary (the closed nine-token `--padding-*` set from `complete-rezics-design-storybook/specs/design-system-density/spec.md`) applies to **rezics-authored** code only:

- `package/ui/src/primitive/` — rezics primitives (e.g. `TextButton`, `RatingInput`, `EmptyState`, `Spinner`).
- `package/ui/src/composite/` — rezics composites.
- `package/admin/src/`, `package/app/src/`, `package/folio/src/`, `package/editor/src/` — app-level composites authored in those trees.

The rezics token namespace and the shadcn-shipped values coexist. They don't collide because they target different files.

**Why Path P over Path C.** Path C left the door open to "small tasteful patches" — a token swap here, a radius adjustment there. In practice every patch is a future merge conflict when shadcn updates the primitive. Path P forecloses this by making the boundary unambiguous: vendored = untouched, rezics-authored = fully styled.

### Decision 2: `carousel.tsx` and `sidebar.tsx` are Path-P exceptions

Two files in `package/ui/src/shadcn/` carry heavy local customization and are **not** re-vendored:

- **`carousel.tsx`** — imports `@/primitive/carousel/ArrowButton`, retains the deprecated `arrowVariant` prop as a no-op for callsite compatibility, uses `lucide-react` `ChevronLeft` / `ChevronRight` icons explicitly. Re-vendoring would discard all of this.
- **`sidebar.tsx`** — 14 commits of local history. Layout, prop surface, and behavior have diverged enough that mechanical re-vendoring would produce visible regressions.

These two stay on their current `radix-ui`-based implementations. Future shadcn `sidebar` / `carousel` updates are hand-merged on demand, not auto-applied. Both files SHALL carry a top-of-file comment documenting the Path-P exception status, so the next contributor knows not to run the shadcn CLI against them.

The two exceptions are deliberately the entirety of the exception list. Adding a third primitive to the exception list SHALL require updating Decision-2 in this design and the corresponding Requirement in `specs/ui-component-foundation/spec.md`.

### Decision 3: `asChild` → `render` callsite migration via codemod + manual cleanup

`@base-ui/react` replaces Radix's `asChild` composition pattern with a `render` prop. The translation is mechanical for the common case:

```tsx
// Before (Radix idiom)
<Button asChild>
  <Link to="/foo">Click</Link>
</Button>

// After (base-ui idiom)
<Button render={(props) => <Link to="/foo" {...props}>Click</Link>} />
```

A codemod (single-file Bun/Node script under `tool/migrations/asChild-to-render.ts`) handles ~95% of cases by AST-rewriting `asChild` JSX attributes to `render` callback form. Manual cleanup covers:

- Cases where the original child was non-trivial (multiple children, conditional fragments) — these need a function that composes the children explicitly.
- Cases where `asChild` was nested (e.g. `Trigger asChild` wrapping `Button asChild`) — these need a per-callsite read.

The codemod runs once during Phase 2; its output is reviewed before commit. The codemod source is committed under `tool/migrations/` for traceability but is not kept in the runtime path.

### Decision 4: `RADIUS` gains `4xl: 32px`; the eight existing entries stay

Luma uses larger radii than `new-york`. Inspecting Luma's source confirms `rounded-4xl` utility usage for Button, Card, Dialog, Drawer, Command, InputGroup, and other large surfaces. The rezics RADIUS scale today stops at `2xl: 24px`, so vendored Luma primitives using `rounded-4xl` need an UnoCSS `theme.borderRadius["4xl"]` entry to resolve.

Adding a single entry — `4xl: 32px` — wires the scale through. The intermediate `3xl` is intentionally **not** added: there is no Luma primitive in this migration that uses `rounded-3xl` as a missing scale gap we need to introduce, and adding scale entries with no explicit migration need creates a "what's this for?" question on every future review.

If a future Luma primitive (or rezics-authored composite) needs `3xl`, an OpenSpec change adds it then.

### Decision 5: The nine `--padding-*` token values are recalibrated against Luma

Luma's intrinsic padding for repeating-row affordances differs from the rezics-set values defined in `complete-rezics-design-storybook`:

| Token | Current value | Luma intrinsic | Recalibration plan |
|-------|---------------|-----------------|--------------------|
| `--padding-breadcrumb-y` | 4px | TBD (audit during 4.x) | match Luma if it ships a denser value |
| `--padding-menu-item-y` | 6px | TBD | match Luma |
| `--padding-table-row-y` | 8px | TBD | match Luma |
| `--padding-toolbar-y` | 8px | TBD | match Luma |
| `--padding-formfield-y` | 8px | TBD | match Luma (Luma FormField is the most consequential calibration) |
| `--padding-sidebar-item-y` | 8px | (rezics-authored — sidebar.tsx is a Path-P exception) | leave at 8px |
| `--padding-tab-item-y` | 8px | TBD | match Luma |
| `--padding-menu-item-y` | 6px | TBD | match Luma |
| `--padding-command-item-y` | 8px | TBD | match Luma |
| `--padding-list-item-y` | 12px | (rezics composite — Luma has no equivalent) | leave at 12px |

**The recalibration is value-only, not vocabulary.** The closed-nine-entry rule from `design-system-density/spec.md` is preserved. We do not add or remove tokens; we adjust which fixed length each token resolves to so a rezics-authored composite placed next to a vendored Luma primitive on the same page lands at a coherent vertical rhythm.

The audit happens in Phase 4: render each opt-in primitive's Storybook story alongside its rezics-authored cousin (Toolbar, FormField, etc.), measure visual rhythm, adjust the nine values once.

### Decision 6: Dependency swap is `radix-ui` out, `@base-ui/react` in (≥1.4.1)

`@base-ui/react` 1.4.1 is the version pinned by Luma's registry as of authorship. The lower bound `≥1.4.1` is set in `package/ui/package.json` to allow Bun to pick up patch releases without lockfile churn.

`radix-ui` is removed from every package's `dependencies`. Transitive Radix usage via packages we don't own (e.g. `cmdk` ships its own Radix dep) stays — it's not under our `package.json` so we don't manage it. Direct rezics imports of `radix-ui` are migrated; an audit during 1.x confirms zero direct imports remain.

The `@rezics/ui/shadcn` index re-export surface is unchanged. Consumers continue to import `@rezics/ui/shadcn/button` (or whichever primitive) and notice no import-path change.

### Decision 7: `components.json` `style` value is set explicitly

`package/ui/components.json` `style` flips from `"new-york"` to `"base-luma"`. The exact value matches whatever shadcn's CLI accepts as the addressing form (TBD during 1.x — the form may be a registry URL like `"https://ui.shadcn.com/r/base-luma"` or a short alias). The value is verified by running `pnpm dlx shadcn@latest add button` (or `bunx shadcn@latest add button`) once during 1.x and confirming it pulls Luma source.

`iconLibrary: "lucide"` stays. Aliases stay.

### Decision 8: Implementation phase order

The phases sequence the highest-leverage work first (dependency swap unblocks everything; vendor swap is the bulk; calibration follows the visual evidence).

1. **Phase 1** — `components.json` style flip + dependency swap (`radix-ui` out, `@base-ui/react` in). Smoke-test that the shadcn CLI can talk to the new registry.
2. **Phase 2** — Codemod authoring (`tool/migrations/asChild-to-render.ts`) + dry-run audit (`rg "asChild" package/`). Run codemod; review output; commit transformed callsites.
3. **Phase 3** — Re-vendor 28 of 30 shadcn primitives via the shadcn CLI (excluding `carousel.tsx` and `sidebar.tsx`). Each primitive gets its own commit so reverts are surgical. After each commit, run the storybook story for that primitive (existing stories from `complete-rezics-design-storybook` Phase 5) and confirm it renders.
4. **Phase 4** — Token recalibration: extend `RADIUS` with `4xl: 32px`; audit and adjust the nine `--padding-*` values per Decision-5.
5. **Phase 5** — Verification: storybook builds, type-check, contrast, convention. Visual sweep on every primitive story. Confirm press-down feedback visible on Button and confirm Toggle + ToggleGroup match the official `base-luma` registry output.
6. **Phase 6** — Spec + skill updates: `ui-component-foundation/spec.md` Requirement-1 wording flip; `CLAUDE.md` "UI Component Policy" section update; `.claude/skills/rezics-design/` references updated.

## Trade-offs

- **Path P vs Path C ("trust Luma, but tweak").** Chose Path P. Trade-off: when Luma's choice clashes with rezics's choice (e.g. Luma's Button radius vs rezics's `xl: 16px`), we live with Luma's. Acceptable — the boundary is what makes the design tractable. If a specific clash becomes intolerable, the recourse is to author a rezics-authored alternative primitive (which the existing custom-primitive policy already covers), not to patch vendored shadcn.
- **`@base-ui/react` vs staying on `radix-ui`.** Chose to migrate. Trade-off: the migration is real cost (codemod + ~30 callsite cleanups). Acceptable — Radix is in maintenance, and locking ourselves to maintenance dependencies compounds tech debt. Reading the maintainer roster (ex-Radix + ex-MUI + ex-Floating UI on `@base-ui/react`) signals the active line.
- **`carousel.tsx` and `sidebar.tsx` as exceptions vs forced re-vendor.** Chose exceptions. Trade-off: those two files drift from the Luma baseline. Acceptable — the local customizations exist for documented reasons (carousel: `ArrowButton` integration; sidebar: 14 commits of layout work). A forced re-vendor would discard work we'd have to redo.
- **`RADIUS` extension `4xl: 32px` vs binding-to-magic-number.** Chose to extend. Trade-off: the scale grows. Acceptable — bindings to `--radius-4xl` from vendored Luma source need a target; the alternative (let them resolve to `unset`) is worse.
- **Token recalibration value-only vs vocabulary expansion.** Chose value-only. Trade-off: if Luma uses a density tier that our nine tokens don't match (e.g. an extra-tight selectable-row at 3px), we either leave it at the Luma default (vendored primitive only) or stretch a token. Acceptable — the closed-vocabulary discipline is the point; Luma + nine tokens covers the realistic surface.
- **Codemod for `asChild` migration vs hand migration.** Chose codemod. Trade-off: codemod authoring time. Acceptable — the alternative is ~30 manual rewrites, all mechanical, and a codemod also documents the translation rule for future audits.

## Open Questions

- What is the exact form of `style` in `components.json` for Luma? `"base-luma"` short alias vs registry URL? Default: try short alias first; fall back to URL if the CLI doesn't recognize it.
- Does Luma's Button actually use `--radius-4xl`, or does it use a different binding? Default: confirm by `pnpm dlx shadcn@latest add button` and reading the vendored source. Recalibration of the RADIUS scale follows the evidence.
- Are there transitive Radix dependencies inside packages we don't own (`cmdk`, etc.) that interact poorly with `@base-ui/react` in the same React tree? Default: audit during 1.x. If a clash surfaces, consider replacing `cmdk` with an `@base-ui/react`-native alternative.
- Should `theme-switch.tsx` (rezics-custom, co-located in `shadcn/` for chrome-tier reasons) be touched by this change? Default: no — it's rezics-authored, not vendored. It stays unchanged unless its dependency on a Radix primitive surfaces during 1.x audit.
