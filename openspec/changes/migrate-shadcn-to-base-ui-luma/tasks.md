# Tasks — migrate-shadcn-to-base-ui-luma

The change runs in six phases. Phase 1 swaps the dependency and registry style. Phase 2 ships the `asChild` → `render` codemod and migrates callsites. Phase 3 re-vendors 28 of 30 primitives from `base-luma`. Phase 4 recalibrates tokens (`RADIUS` gains `4xl`; nine `--padding-*` values reviewed). Phase 5 verifies. Phase 6 closes spec/skill loops.

> Path-P boundary: vendored shadcn source in `package/ui/src/shadcn/` is **not** patched to consume rezics tokens. Re-vendoring the primitive from `base-luma` is the canonical state. The two exceptions are `carousel.tsx` and `sidebar.tsx` (per Decision 2 in `design.md`).

## Phase 0 — Preflight

- [x] 0.1 Confirm `complete-rezics-design-storybook` (corrected, no 3-mode density toggle) is in flight or landed. The nine fixed-value `--padding-*` tokens are emitted from `package/ui/src/config/uno-config.ts`. No `--density-step`.
- [x] 0.2 Confirm `bun run check:convention` passes on the current tree.
- [x] 0.3 Audit the shadcn primitive list: `ls package/ui/src/shadcn/*.tsx`. Confirm 30 primitive files. Identify carousel.tsx, sidebar.tsx, theme-switch.tsx as the three "do not auto-vendor" files (carousel + sidebar are Path-P exceptions; theme-switch is rezics-custom and not a shadcn primitive).
- [x] 0.4 `git log` per primitive (under `package/ui/src/shadcn/<name>.tsx`) to surface any primitive with >2 commits of local history. Flag for manual reconciliation during Phase 3.

## Phase 1 — Dependency swap and registry style

- [x] 1.1 In `package/ui/components.json`, change `"style": "new-york"` to the Luma value. Try short alias `"base-luma"` first; if the shadcn CLI does not recognize it, fall back to the registry URL form. Verify by running `bunx shadcn@latest add button --dry-run` (or the bun-equivalent CLI invocation) and confirming the source shown is the Luma Button (look for `active:not-aria-[haspopup]:translate-y-px`).
- [x] 1.2 In `package/ui/package.json`, add `@base-ui/react` `^1.4.1` (latest stable at migration time). Keep `radix-ui` until Phase 3.30 per the 1.5 adjustment, because current vendored primitives still import it. Run `bun install` and confirm the lockfile updates.
- [x] 1.3 Audit direct `radix-ui` imports across the monorepo: `rg "from \"radix-ui\"|from 'radix-ui'" package/`. Expected matches: only inside `package/ui/src/shadcn/*.tsx` (those will be replaced by Phase 3). Any direct `radix-ui` import in app packages (`admin`/`app`/`folio`/`editor`) is unexpected — investigate.
- [x] 1.4 Audit transitive Radix dependencies via `bun pm ls | rg radix`. Document any owned-by-us packages that bring Radix transitively. Owners not us (e.g. `cmdk`) — note for Phase 5 verification. Phase-1 audit: source imports are only in `package/ui/src/shadcn/*.tsx`; owned manifests with Radix dependencies are `package/ui/package.json` (expected until Phase 3.30) and `package/app/package.json` (no matching source imports; remove in final dependency cleanup if still unused).
- [x] 1.5 Smoke test: `bun -F @rezics/ui storybook` still starts (using the still-Radix-based primitives — they haven't been re-vendored yet). The dependency swap alone shouldn't break Storybook because vendored primitive source still imports `radix-ui` until Phase 3 — confirm we don't break the build by removing the dependency before Phase 3 lands. **Adjustment:** keep `radix-ui` in `dependencies` until Phase 3.x completes, then remove in Phase 3 final. Update 1.2 plan accordingly.

## Phase 2 — `asChild` → `render` codemod

- [x] 2.1 Audit usage: `rg "asChild" package/{admin,app,folio,editor,ui}/src/`. Catalog match counts per file. Expected total: <30 callsites in app packages, plus ~10–15 internal uses inside shadcn vendored source (those are addressed by Phase 3 re-vendor).
- [x] 2.2 Author `tool/migrations/asChild-to-render.ts`. AST-rewrite (use TypeScript Compiler API or ts-morph; check if either is already a project dep) `<Foo asChild>{child}</Foo>` to `<Foo render={(props) => <child... {...props} />} />`. Emit a warning + skip when the JSX child is non-trivial (multiple children, conditional fragments, function children).
- [x] 2.3 Dry-run the codemod against `package/{admin,app,folio,editor}/src/`. Review the output diff. Manual cleanup for warnings. Commit the transformed callsites in one commit per package (so revert is granular).
- [x] 2.4 `rg "asChild" package/{admin,app,folio,editor}/src/` returns zero matches (or only matches with `// @ts-expect-error` shims documenting why a manual translation isn't yet possible — log each for Phase 5 follow-up).

## Phase 3 — Re-vendor 28 primitives from base-luma

Each primitive gets its own commit. The shadcn CLI does the work. Smoke-test in Storybook after each commit using the existing primitive story files (Phase 5 of `complete-rezics-design-storybook`).

**Skip list:** `carousel.tsx` (Path-P exception), `sidebar.tsx` (Path-P exception), `theme-switch.tsx` (rezics-custom).

- [x] 3.1 alert
- [x] 3.2 avatar
- [x] 3.3 badge
- [x] 3.4 breadcrumb
- [x] 3.5 button (verify `active:not-aria-[haspopup]:translate-y-px` is in the vendored source)
- [x] 3.6 card
- [x] 3.7 chart
- [x] 3.8 checkbox
- [x] 3.9 collapsible
- [x] 3.10 command
- [x] 3.11 context-menu
- [x] 3.12 dialog
- [x] 3.13 drawer
- [x] 3.14 dropdown-menu
- [x] 3.15 input
- [x] 3.16 label
- [x] 3.17 popover
- [x] 3.18 select
- [x] 3.19 separator
- [x] 3.20 sheet
- [x] 3.21 skeleton
- [x] 3.22 sonner
- [x] 3.23 table
- [x] 3.24 tabs
- [x] 3.25 toggle (verified against official `base-luma` registry output; no press-down translation currently ships for Toggle)
- [x] 3.26 toggle-group (verified against official `base-luma` registry output; no press-down translation currently ships for ToggleGroup)
- [x] 3.27 tooltip
- [x] 3.28 (placeholder for any primitive surfaced during 0.3 audit not on this list) — base-luma CLI also surfaced `input-group.tsx` and `textarea.tsx` while re-vendoring the planned primitive set; kept as registry output.
- [x] 3.29 Add Path-P exception comment to `carousel.tsx` and `sidebar.tsx` (top-of-file): "Path-P exception — see `openspec/changes/migrate-shadcn-to-base-ui-luma/design.md` Decision 2. Do not run `shadcn@latest add` against this file."
- [x] 3.30 Final dependency cleanup: now that the 28 primitives no longer import `radix-ui`, remove `radix-ui` from `package/ui/package.json` `dependencies` (the action originally scheduled in 1.2 is now safely executable). `bun install`. Confirm no source imports `radix-ui`: `rg "from \"radix-ui\"|from 'radix-ui'" package/` returns zero matches. Note: `sidebar.tsx` keeps the narrow `@radix-ui/react-slot` dependency as a Path-P exception implementation detail.

## Phase 4 — Token recalibration

- [x] 4.1 In `package/ui/src/config/uno-config.ts`, extend the `RADIUS` constant with `"4xl": "32px"`. The corresponding `theme.borderRadius` entry needs a sibling `"4xl": RADIUS["4xl"]` so UnoCSS's `rounded-4xl` utility resolves.
- [x] 4.2 Verify Luma source uses `rounded-4xl` for multiple primitives (Button, Card, Dialog, Drawer, Command, InputGroup). No vendored source directly references `--radius-4xl`; the required binding is through UnoCSS's `theme.borderRadius["4xl"]`.
- [x] 4.3 Audit Luma's intrinsic padding for each of the nine density-bearing primitive families. Method: render the rezics primitive Storybook stories side-by-side with the corresponding Luma reference (which is the vendored source after Phase 3); read computed padding via the browser inspector; tabulate. Implementation note: audited the vendored `base-luma` class source directly after Phase 3; values are recorded inline in `PADDING_BASE`.
- [x] 4.4 For each of the nine `--padding-*` tokens, decide: keep current value, or recalibrate to match Luma. Record the decision in a brief 9-row table inline in `uno-config.ts`'s `PADDING_BASE` constant comment block. Token names are unchanged; only the right-hand-side values may change.
- [x] 4.5 Update rezics-authored composites that consume the recalibrated tokens. Pixel parity is **not** required for this change (a deliberate adjustment); visual sweep confirms the rezics-authored composite + adjacent Luma primitive land at a coherent rhythm. Runtime consumers use the token names, so value-only recalibration applies without callsite rewrites; the mirrored density docs table was updated.

## Phase 5 — Verification

- [x] 5.1 `bun -F @rezics/ui run build-storybook` — succeeds. Used the repo's working Bun filter form: `bun --filter='@rezics/ui' run build-storybook`.
- [x] 5.2 All five Storybook builds (`@rezics/ui`, `@rezics/admin`, `@rezics/app`, `@rezics/folio`, `@rezics/editor`) plus the root host succeed.
- [ ] 5.3 Manual visual sweep: open `bun -F @rezics/ui storybook`. For each of the 28 re-vendored primitives, open its `Default` story and confirm the visual treatment matches Luma's expected output. **Special focus:** Button — confirm the press-down feedback (`active:not-aria-[haspopup]:translate-y-px`) is visible. Toggle and ToggleGroup should match the official `base-luma` registry output, which does not currently ship press-down translation.
- [x] 5.4 `rg "from \"radix-ui\"|from 'radix-ui'" package/` returns zero matches in source files.
- [x] 5.5 `rg "asChild" package/{admin,app,folio,editor}/src/` returns zero matches (or only documented `@ts-expect-error` shims, with follow-up tickets).
- [x] 5.6 `bun run check:tokens` passes (HCT 40/80 contrast invariant on the recalibrated token set).
- [x] 5.7 `bun run check:convention` passes — all R-rules, especially R5 (SafeLink) and R9 (no `--rezics-*`).
- [ ] 5.8 Per-package `bunx tsc --noEmit`: `@rezics/ui`, `@rezics/admin`, `@rezics/app`, `@rezics/folio`, `@rezics/editor` — each clean independently (per the documented policy).
  - Blocked: `@rezics/folio` is clean, but `@rezics/ui`, `@rezics/admin`, `@rezics/app`, and `@rezics/editor` currently fail independently. Failures include migration-related Base UI typing/callsite differences plus pre-existing package alias, Storybook args, and unrelated route typing issues.
- [x] 5.9 Confirm no density-toggle regression: `rg "--density-step|density-compact|density-spacious|WithDensity" package/` returns zero matches in source. (Path-P does not reintroduce these; this check guards against an accidental Luma file shipping a density mechanism we didn't catch.)

## Phase 6 — Close the loop

- [x] 6.1 Update `openspec/specs/ui-component-foundation/spec.md` Requirement-1: change "Radix-based, token-aligned via the flat `--colors-*` CSS custom-property cascade" to "**base-ui-based**, token-aligned via the flat `--colors-*` CSS custom-property cascade." All other Requirements stay verbatim.
- [x] 6.2 Update `CLAUDE.md`'s "UI Component Policy" section: replace the "shadcn primitives from `@rezics/ui/shadcn` are the default; rezics-owned custom primitives (`@rezics/ui/primitive/`, `@rezics/ui/composite/`) cover gaps" sentence with a clarification that shadcn primitives are vendored from the `base-luma` registry (Path P — no rezics-side modifications). Note `carousel.tsx` and `sidebar.tsx` as Path-P exceptions.
- [x] 6.3 Update `.claude/skills/rezics-design/` references where they describe shadcn as Radix-based. Point at the relevant section of `migrate-shadcn-to-base-ui-luma/design.md`.
- [ ] 6.4 Tag the OpenSpec change for archival once review is complete.
- [x] 6.5 Open a follow-up tracking issue: "Reconcile `carousel.tsx` and `sidebar.tsx` against future shadcn updates" — out of scope for this change. GitHub issue: https://github.com/rezics/rezics/issues/33
