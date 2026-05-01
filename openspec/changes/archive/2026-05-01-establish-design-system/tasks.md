## 1. Foundation research and brief

- [x] 1.1 Clone `nexu-io/open-design` to `../example/open-design` (sibling, not git-tracked).
- [x] 1.2 Survey open-design top-level structure to locate definitions for the 72 bundled design systems.
- [x] 1.3 Sub-agent extract token shape across all 72 systems → `openspec/plans/design-system-research/02-token-shape-survey.md`.
- [x] 1.4 Sub-agent shortlist 3–5 reference systems (apple, claude, notion, mintlify, cursor) → `openspec/plans/design-system-research/03-reference-shortlist.md`.
- [x] 1.5 Author rezics design direction brief v0 → `openspec/plans/design-system-research/04-rezics-direction-brief.md`.
- [x] 1.6 Supersede v0 with Foundation v1 → `openspec/plans/design-system-research/briefs/01-foundation-v1.md`.
- [x] 1.7 GATE-A: user approved Foundation v1 with all defaults (2026-05-01).

## 2. Token sources of truth

- [x] 2.1 Author `package/ui/src/config/tokens/colors.ts` — semantic + scale, light + dark, with verified contrast ratios.
- [x] 2.2 Author `package/ui/src/config/tokens/typography.ts` — `font-sans` / `font-serif` / `font-mono` triad with Latin + CJK layering, viewport-clamped 8-step type scale, line-height policy (`leading-reader` 1.60 / `leading-body` 1.55 / `leading-ui` 1.40 / `leading-dense` 1.30), weights (400/500/600), `font-size-adjust: ex-height 0.522`.
- [x] 2.3 Author `package/ui/src/config/tokens/spacing.ts` — 8px base scale (`space-0` through `space-16`).
- [x] 2.4 Author `package/ui/src/config/tokens/radius.ts` — Apple-inspired tier (`xs` 4px through `2xl` 24px, `pill`, `full`).
- [x] 2.5 Author `package/ui/src/config/tokens/elevation.ts` — light + dark 4-tier modal-only shadow stack.
- [x] 2.6 Author `package/ui/src/config/tokens/motion.ts` — durations (120/200/350/500ms) + easings (`ease-out`, `ease-in-out`, `ease-spring`).
- [x] 2.7 Aggregate barrel: `package/ui/src/config/tokens/index.ts`.

## 3. CSS custom property namespace and theme bindings

- [x] 3.1 Inject CSS custom properties via `package/ui/src/shared/styles/layers.css` on `:root` and `[data-theme="dark"]` (with transitional `html.dark` alias).
- [x] 3.2 Add `:lang()` regional CJK routing — `:lang(zh-Hans)` / `:lang(ja)` / `:lang(ko)` switch `--rezics-font-sans-cjk` / `--rezics-font-serif-cjk` to the regional Source Han variant; default is TC.
- [x] 3.3 Add global `@media (prefers-reduced-motion: reduce)` rule collapsing animation/transition durations to 0ms.
- [x] 3.4 Refactor `package/ui/src/config/theme.ts` to derive MUI `lightTheme` / `darkTheme` from token modules. Preserve `getTheme` / `getDynamicTheme` public API; consumers in `app` / `admin` / `folio` must compile unchanged.
- [x] 3.5 Wire tokens into `package/ui/src/config/uno-config.ts` — add `brand` / `surface` / `text` / `success` / `warning` / `error` / `info` / `border` namespaces resolving to `var(--rezics-*)`. Preserve legacy `primary` / `secondary` MUI references.
- [x] 3.6 Smoke-test in `@rezics/app` dev server: Vite boots clean; `--rezics-*` vars served via `layers.css`; UnoCSS preflight resolves `border-border` to `border-whisper`.
- [x] 3.7 Late-stage rename across 22 files: `--rzc-*` → `--rezics-*` for all CSS custom properties; `'rzc-sans'` / `'rzc-serif'` / `'rzc-mono'` → `'rezics-sans'` / `'rezics-serif'` / `'rezics-mono'` for font-family local fallback names. Verified via `rg "rzc"` returning zero matches.

## 4. Claude skill (AI-readable design reference)

- [x] 4.1 Create `.claude/skills/rezics-design/SKILL.md` with frontmatter trigger, top-level rules, decision quickstart, hard never-list, and sub-file pointers.
- [x] 4.2 Author `.claude/skills/rezics-design/voice.md` — mood pillars (parchment archive), tone-per-surface table, reference systems, litmus test.
- [x] 4.3 Author `.claude/skills/rezics-design/tokens.md` — full cheatsheet for surfaces / text / brand / semantic / borders / spacing / radius / motion / elevation / typography + common-mistakes table.
- [x] 4.4 Author `.claude/skills/rezics-design/patterns.md` — 12 do/don't sections covering layout, cards, buttons, inputs, links, icons, color, typography, spacing, mode handling, mock convention, admin/app density.
- [x] 4.5 Author `.claude/skills/rezics-design/mui-vs-shadcn.md` — selection table (MUI primary / shadcn supplement / custom last), decision flows for modal/form/empty-state, cross-cutting rules.
- [x] 4.6 Add `## UI Work` section to `CLAUDE.md` (4-line pointer; no rule duplication).

## 5. Storybook spike (`@rezics/ui` + `@rezics/editor` + host)

- [x] 5.1 Verify Storybook 10 + Vite 8 + React 19 compatibility — Storybook 10.3.6 confirmed, spike doc at `openspec/plans/design-system-research/05-storybook-spike.md`.
- [x] 5.2 Add minimal `package/ui/.storybook/{main.ts,preview.tsx,vite.config.ts}` + `Tokens.stories.tsx` (Surfaces / Buttons / Typography / Brand). Isolated `vite.config.ts` avoids `tanstackRouter` plugin in `package/ui/vite.config.ts`. Add `react-dom@^19.2.4`.
- [x] 5.3 Wire UnoCSS preset + MUI ThemeProvider + Light/Dark global toolbar in `preview.tsx`.
- [x] 5.4 Add minimal `package/editor/.storybook/` + `Editor.stories.tsx` (Markdown + JSON CodeMirror demos).
- [x] 5.5 Add root-level `.storybook/main.ts` with `refs` pointing to `ui` (`:6001`) + `editor` (`:6002`). Demo `Welcome.stories.tsx`.
- [x] 5.6 Validate `storybook build` for `@rezics/ui`, `@rezics/editor`, and root — all three produce `storybook-static/` with valid `index.json`.
- [x] 5.7 GATE-B: user approved spike outcome; full migration proceeds.

## 6. Storybook build-out (folio + admin + app + shared config + host)

- [x] 6.1 Extract shared Storybook config to new workspace package `@rezics/storybook-config` with `.` (config) and `./preview` (theme decorator) entrypoints. UnoCSS loaded via dynamic import as optional peer; `editor` + `host` pass `{ uno: false }`.
- [x] 6.2 Add Storybook to `@rezics/folio` (port 6009) with `Folio.stories.tsx` (Placeholder reader).
- [x] 6.3 Add Storybook to `@rezics/admin` (port 6010) with MUI theme + UnoCSS in `preview.tsx` and `AdminDensity.stories.tsx` (Users table).
- [x] 6.4 Add Storybook to `@rezics/app` (port 6011) with MUI theme + UnoCSS + parchment canvas in `preview.tsx` and `AppSection.stories.tsx` (Recent Books).
- [x] 6.5 Update root `.storybook/main.ts` refs to include all 5 packages (ui 6007, editor 6008, folio 6009, admin 6010, app 6011); update Welcome story with port table.
- [x] 6.6 Add root scripts `bun storybook` (concurrently runs all + host) and `bun storybook:build` (builds all + host) via `concurrently@^9` with color-prefixed labels.
- [x] 6.7 Document the port convention in `CONTRIBUTING.md` with the Chrome unsafe-ports footnote (`:6000`, `:6566`, `:6665–6669`, `:6697`).
- [x] 6.8 Fix latent bugs uncovered during extraction: folio + app preview now import `@rezics/ui/shared/styles/layers.css`; folio's vite config now actually loads UnoCSS; root `package.json` gained `"type": "module"` so the host can import the ESM-only config package.

## 7. Token galleries and design docs (MDX)

- [x] 7.1 Author `package/ui/src/docs/tokens/colors.mdx` rendering all color tokens as swatches.
- [x] 7.2 Author `package/ui/src/docs/tokens/typography.mdx` rendering type scale.
- [x] 7.3 Author `package/ui/src/docs/tokens/spacing.mdx` rendering spacing scale.
- [x] 7.4 Author `package/ui/src/docs/tokens/radius.mdx`, `elevation.mdx`, `motion.mdx`.
- [x] 7.5 Author shared `package/ui/src/docs/tokens/_gallery.tsx` helper module exporting `Grid`, `Swatch`, `Row`, `SpacingRuler`, `RadiusSample`, `ElevationSample`, `TypeSample`, `MotionSample`, `Do`, `Dont`, `Compare`.
- [x] 7.6 Add `@storybook/addon-docs` as peer-dep of `@rezics/storybook-config`; extend stories pattern in `baseStorybookConfig` to include `../src/**/*.mdx`.
- [x] 7.7 Author `package/ui/src/docs/voice.mdx` — design language for human readers, mirrors `.claude/skills/rezics-design/voice.md`.
- [x] 7.8 Author `package/ui/src/docs/patterns.mdx` — 12 do/don't sections paralleling the skill's `patterns.md`.

## 8. React Cosmos retirement

- [x] 8.1 Inventory existing Cosmos fixtures across all packages → `openspec/plans/design-system-research/08-cosmos-fixture-inventory.md`. 41 fixtures across `@rezics/ui` (8), `@rezics/app` (19), `@rezics/editor` (9), `@rezics/folio` (5); `@rezics/admin` had scripts + devDeps but zero fixtures.
- [x] 8.2 Resolve `@rezics/ui` suffix conflict: `cosmos.config.json` had `fixtureFileSuffix: "test"`; the 12 `.test.tsx` files split into 8 cosmos fixtures (rename to `.stories.tsx`) and 4 real `bun:test` files (keep `.test.tsx`).
- [x] 8.3 Migrate each fixture to a Storybook story. Cosmos `useFixtureInput` / `useFixtureSelect` mapped to Storybook `args` + `argTypes` (radio/range/boolean/text controls). Multi-fixture default-export-as-object converted to multiple named `StoryObj` exports per CSF file. App preview adds `QueryClientProvider` decorator (mirrors deleted `cosmos.decorator.tsx`).
- [x] 8.4 Strip `react-cosmos` + `react-cosmos-plugin-vite` devDeps and `cosmos` / `cosmos-export` npm scripts from all 5 packages.
- [x] 8.5 Delete 4× `cosmos.config.json` (ui/app/editor/folio), 2× `cosmos.decorator.tsx` (ui/app), 2× `vite.cosmos.config.ts` (editor/folio), and the leftover cosmos-only `package/ui/src/main.tsx` entry.
- [x] 8.6 Verify `rg "react-cosmos|useFixtureInput|useFixtureSelect"` returns zero source-code matches.
- [x] 8.7 GATE-C: user confirmed Storybook covers everything Cosmos did before deletion.

## 9. Per-package adoption audits

- [x] 9.1 Audit `@rezics/app` against tokens. 43 violations (Small severity). Fixed: `preference/components/ThemeCustomizer.tsx` extracted `BRAND_DEFAULT_COLOR = "#f4606c"` constant, replaces 3 inline brand-color literals (Hard Never #1). Deferred: 26 MUI icon `fontSize` numerics (defensible — MUI's pixel-based icon-sizing API), 5 `lineHeight` numerics (none below 1.30 floor).
- [x] 9.2 Audit `@rezics/admin`. 25 violations (Small severity), all defensible: 1 webkit autofill hex (`:-webkit-autofill` vendor pseudo-element), `fontSize: 13` on monospace table cell (admin-density rule #12), MUI theme-spacing multiples, pixel column widths.
- [x] 9.3 Audit `@rezics/editor`. ~95 hex literals (Medium severity); 54 are CodeMirror highlight literals (defensible per CodeMirror API contract). The 41 chrome literals (`MarkdownEditor.css` 44× GitHub Primer-flavored markdown prose palette, `toolbar.css` / `panel/index.ts` toolbar chrome) deferred to a dedicated PR with visual review.
- [x] 9.4 Audit `@rezics/folio`. ~50 chrome violations (Medium severity). Fixed: `Folio.tsx` ✕/☰ emoji-as-icons → `<CloseIcon>` / `<MenuIcon>` + `aria-label` (Hard Never #3); 2× `rgba(128, 128, 128, 0.2)` borders → `var(--rezics-color-border-whisper)`. `toc/TocPanel.tsx` ▶/▼ disclosure emoji → CSS triangle using `currentColor`; rgba separator → `border-whisper`. `plugins/txt/TxtSettings.tsx` ★/✕ emoji → `<CheckCircleIcon>` / `<CloseIcon>`; `#22c55e` ×2 → `success-fill`, `#ef4444` → `error-fill`, `#888` → `text-tertiary`, 4 rgba grays → `surface-subtle` / `surface-sunken` / `border-defined`. Deferred: reader-theme `light/dark/sepia` palette (runtime book-reader parameters), content-zone padding in renderers (deliberate text margins).
- [x] 9.5 Audit `@rezics/ui` internal components. 23 violations across 13 files (Small-to-Medium severity), zero hex literals. Fixed: `composite/navigation/ArrowForwardIcon.tsx` `lineHeight: "1"` → `1.3` and `editor/RezicsMarkdownEditor.tsx` `lineHeight: 1` → `1.3` (Hard Never #6 — line-height ≥ 1.30). Deferred: 16 MUI primitive pixel dimensions (avatar/icon/modal sizing, anchor positioning) — additive design proposal, not a fix.
- [x] 9.6 Aggregate per-package audits → `openspec/plans/design-system-research/09-adoption-audits.md` with severity, counts, top offenders, fixed vs deferred breakdown. Hard-Never violations remaining across all 5 packages: zero.

## 10. Validation

- [x] 10.1 `bun run build-storybook` succeeds for all 6 instances (host + 5 package storybooks); `index.json` lists expected story IDs in each.
- [x] 10.2 `rg "react-cosmos|useFixtureInput|useFixtureSelect"` returns zero source-code matches.
- [x] 10.3 `rg "rzc"` returns zero matches across the entire repo.
- [x] 10.4 `bun run check:convention` passes (R1–R7).
- [x] 10.5 Smoke-test that `@rezics/app`, `@rezics/admin`, `@rezics/folio` consumers of `getTheme` / `getDynamicTheme` compile unchanged.
