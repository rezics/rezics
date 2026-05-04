# Tasks — complete-rezics-token-system

The change is structured into seven phases. Phases 0–2 add the new architecture without removing the old; Phase 3 fills the role gaps; Phase 4 wires the consumer entry points; Phase 5 adds enforcement; Phase 6 deletes the back-compat shim and finalizes; Phase 7 verifies and unblocks proposal 2.

## Phase 0 — Spec preflight & directory scaffolding

- [ ] 0.1 Land the proposal, design, and spec deltas (this PR's own artifacts) without code changes. Reviewers confirm the role list, the file split, and the deprecation list before any code moves.
- [ ] 0.2 Create `package/ui/src/config/tokens.css` (empty file with section banners) and `package/ui/src/config/base.css` (empty). No imports rewired yet.
- [ ] 0.3 Add the new `package/ui/src/config/` exports to `package/ui/package.json` `exports` field — `./config/tokens.css` and `./config/base.css` as bare CSS subpath exports.
- [ ] 0.4 Confirm `bun -F @rezics/ui run typecheck` and `bun run check:convention` still pass with empty new files.

## Phase 1 — Author the new token table in `tokens.css`

- [ ] 1.1 Author the reference tier in `tokens.css` (`--rezics-ref-color-*`, `--rezics-ref-radius-*`, `--rezics-ref-shadow-*`, `--rezics-ref-font-*`). Migrate the values currently inlined in `package/ui/src/config/tokens/{colors,radius,shadow,typography}.ts` — the TS source stays authoritative for values that JS code reads (e.g. breakpoint constants); CSS reads from `tokens.css` directly.
- [ ] 1.2 Author the system tier (`--rezics-sys-color-*`, `--rezics-sys-state-*`, `--rezics-sys-motion-*`). Map every system token to a reference token via `var()`. Light-mode block under `.theme-rezics`, dark-mode override under `.theme-rezics[data-theme="dark"]`. Match the role list in `design.md` Decision 2 exactly.
- [ ] 1.3 Author the shadcn-superset slots (unprefixed: `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--border`, `--input`, `--ring`, `--radius`, `--chart-1..5`, `--sidebar*`). Each resolves to a system-tier value via `var(--rezics-sys-color-…)`. Replace the literal `0.5rem` for `--radius` with `var(--rezics-ref-radius-md)`. Replace the inlined OKLCH literal `--chart-*` values with `var(--rezics-sys-color-chart-*)` references.
- [ ] 1.4 Author the legacy-alias block. Each of the 11 legacy names (`rezics-color-fg`, `-fg-muted`, `-bg`, `-bg-muted`, `-bg-canvas`, `-bg-elevated`, `-bg-hover`, `-bg-selected`, `-primary`, `-secondary`, `-accent`) gets an `@deprecated` comment and a `var(--rezics-sys-color-…)` redirect.
- [ ] 1.5 Author the rezics-name aliases for motion / easing (`--rezics-motion-fast/base/slow/page`, `--rezics-ease-out/in-out/spring`) pointing into the new MD3 ladder per Decision 7.
- [ ] 1.6 Author the small component-tier set (`--rezics-comp-button-quiet-container`, `--rezics-comp-card-elevated-surface`, `--rezics-comp-snackbar-container`) per Decision 1 examples. Component tier is intentionally short; do not preemptively add tokens that have no consumer yet.

## Phase 2 — Split baseline into `base.css` and rewire from `layers.css`

- [ ] 2.1 Move `:lang(zh)` / `:lang(ja)` / `:lang(ko)` font-routing rules from `package/ui/src/shared/styles/layers.css` to `package/ui/src/config/base.css`.
- [ ] 2.2 Move the `@media (prefers-reduced-motion: reduce)` global block to `base.css`.
- [ ] 2.3 Move any other resets that previously cohabited `layers.css` (audit the file end-to-end).
- [ ] 2.4 Rewrite `package/ui/src/shared/styles/layers.css` as a back-compat shim:
  ```css
  /* @deprecated — use @rezics/ui/config/tokens.css and @rezics/ui/config/base.css. */
  @import url('../../config/tokens.css');
  @import url('../../config/base.css');
  ```
- [ ] 2.5 Confirm every existing consumer continues to compile. `bun -F @rezics/app run dev`, `bun -F @rezics/admin run dev`, `bun -F @rezics/folio run dev`, plus `bun -F @rezics/ui run storybook` all serve. No visual regression.

## Phase 3 — Fill the role-vocabulary gaps

- [ ] 3.1 Author values for the new system-tier roles that did not previously have a rezics counterpart, in both light and dark modes:
  - `surface-container-lowest`, `-low`, `-container`, `-high`, `-highest` (parchment ladder)
  - `primary-container`, `on-primary-container` (quieter brand role)
  - `error-container`, `on-error-container`
  - `success-container`, `on-success-container`, `warning-container`, `on-warning-container`, `info-container`, `on-info-container`
  - `inverse-surface`, `inverse-on-surface`, `inverse-primary`
  - `surface-tint` (tonal-elevation overlay color, usually the brand)
  - `chart-1..5` (curated rezics 5-step palette, replacing the OKLCH literals)
  - `sidebar-{background, foreground, primary, primary-foreground, accent, accent-foreground, border, ring}` (curated rezics sidebar chrome)
- [ ] 3.2 Add the matching TypeScript exports in `package/ui/src/config/tokens/colors.ts` for any role that JS code may need. Mode-aware bindings handled the same way `text-primary` / `surface-canvas` already are.
- [ ] 3.3 Add UnoCSS theme entries in `package/ui/src/config/uno-config.ts` for the new system-tier color roles. Each new role gets a short-name class (`bg-surface-container-low`, `text-on-primary-container`, `bg-error-container`, etc.). Reorganize the `theme.colors` object to mirror the role taxonomy from `tokens.css`.
- [ ] 3.4 Add the state-layer shortcuts in `uno-config.ts` (`state-hover` / `state-focus` / `state-pressed`) per Decision 8.
- [ ] 3.5 Add the motion duration short-names in `uno-config.ts`. The 16-step ladder is exposed as `duration-short1..extra-long4`; existing `duration-fast/base/slow/page` keep working via the alias map.

## Phase 4 — Repoint the eight consumer entry points

- [ ] 4.1 Update `package/ui/components.json` `tailwind.css` field from `src/shared/styles/layers.css` to `src/config/tokens.css`.
- [ ] 4.2 Update `package/ui/src/config/uno-config.ts` import: `import './shared/styles/layers.css'` → `import './config/tokens.css'`.
- [ ] 4.3 Update `package/app/src/app/App.tsx` import to `@rezics/ui/config/tokens.css` and `@rezics/ui/config/base.css`.
- [ ] 4.4 Update `package/admin/src/app/App.tsx` import to `@rezics/ui/config/tokens.css` and `@rezics/ui/config/base.css`.
- [ ] 4.5 Update each Storybook preview (`package/ui/.storybook/preview.tsx`, `package/admin/.storybook/preview.tsx`, `package/app/.storybook/preview.tsx`, `package/folio/.storybook/preview.tsx`, `.storybook/preview.tsx` at root) to import `@rezics/ui/config/tokens.css` only — Storybook does not need `base.css`.
- [ ] 4.6 Confirm the `.theme-rezics` class is applied to `<html>` (not `<body>`, not a subtree) in every app shell and Storybook preview. Where it is currently on `<body>` or a subtree, move it to `<html>`. Verify modal/tooltip/dropdown portals (`document.body` children) inherit the cascade by opening one in each app.

## Phase 5 — Enforcement and contrast script

- [ ] 5.1 Add `tool/scripts/check-tokens.ts` implementing the contrast-invariant assertions from Decision 10. Use `culori` for OKLCH parsing.
- [ ] 5.2 Wire `bun run check:tokens` into `package.json` scripts. Run as part of the PR merge gate, not pre-commit (slower script).
- [ ] 5.3 Run `bun run check:tokens` locally and fix any contrast violations introduced by Phase 3 (likely candidates: `surface-container-low` vs `on-surface` in dark mode; `primary-container` vs `on-primary-container` border cases).

## Phase 6 — Delete the back-compat shim

- [ ] 6.1 Run `rg "shared/styles/layers.css" package/` and confirm zero matches outside the shim file itself.
- [ ] 6.2 Delete `package/ui/src/shared/styles/layers.css`.
- [ ] 6.3 Remove the `./shared/styles/layers.css` entry from `package/ui/package.json` `exports` field if it was declared (audit shows it was implicit via `./*` glob; confirm whichever is the case).

## Phase 7 — Verification and proposal-2 unblock

- [ ] 7.1 `bun -F @rezics/ui run typecheck` passes.
- [ ] 7.2 `bun -F @rezics/ui run build` passes.
- [ ] 7.3 Every Storybook (`@rezics/ui`, `@rezics/admin`, `@rezics/app`, `@rezics/folio`) builds and serves with light/dark toggle working on every newly-added system-tier role. Manual visual sweep of one page per app confirms no regression.
- [ ] 7.4 `bun run check:convention` passes (no new violations).
- [ ] 7.5 `bun run check:tokens` passes (contrast invariant clean).
- [ ] 7.6 `rg "from .@rezics/ui/shared/styles/layers.css." package/` returns zero matches.
- [ ] 7.7 `rg "var(--rezics-color-(fg|bg|primary|secondary|accent))" package/*/src/` is captured as a snapshot — this is the legacy-alias consumption baseline that proposal 2 will drive to zero. Save under `tool/scripts/expected-violations.json` as the R9 starting baseline (informational; no enforcement yet — that comes in proposal 2).
- [ ] 7.8 Add a comment to `package/ui/src/config/tokens.css` referencing the openspec change ID and the deprecation timeline, so the next contributor reads the migration story without needing to dig through git history.
