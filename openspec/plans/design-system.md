# Design System — Implementation Plan

**Status**: Active plan
**Date**: 2026-05-01
**Scope**: Establish a unified, AI- and human-consumable design system for rezics, codified across `@rezics/ui` tokens, a Claude Code skill, and a multi-package Storybook documentation site.

---

## 1. Context & Motivation

Rezics is functionally mature but visually inconsistent. There is no single source of truth for design language — color palettes, typography scale, spacing, density, motion, and pattern usage are decided ad-hoc per surface. This produces:

- **Drift across surfaces** (`@rezics/app`, `@rezics/admin`, `@rezics/editor`, `@rezics/folio`).
- **No reference for AI agents** generating UI; every session reinvents taste.
- **No reference for human designers/developers** beyond reading existing components.
- **Tribal preferences** (Apple-inspired, MUI-first, borderless, no-emoji-icons) that live only in chat memory, not in artifacts.

The fix is not "more components." Rezics already has `@rezics/ui` with primitive / composite / shadcn layers, MUI 7, Radix, UnoCSS, and React Cosmos. The fix is **codifying the design language** so that all surfaces and all future contributors (human and AI) draw from the same well.

This plan uses `nexu-io/open-design` (a local AI-design tool that bundles 72 reference design systems from brands like Linear, Stripe, Apple, Notion) **as a study source**, not as a runtime dependency. We extract patterns from its bundled reference systems, calibrate to rezics's existing aesthetic preferences, and codify the result.

---

## 2. Architecture

**Single source of truth: code.**
- `package/ui/src/config/tokens/*.ts` — color, typography, spacing, radius, elevation, motion.
- `package/ui/src/config/mui-theme.ts` — MUI theme derived from tokens.
- `package/ui/src/config/uno-config.ts` — UnoCSS preset wired to tokens.
- `package/ui/src/shared/style/layers.css` — CSS custom properties.

**Three projections of that truth:**

| Projection              | Audience                | Artifact                                            |
| ----------------------- | ----------------------- | --------------------------------------------------- |
| **AI**                  | Claude Code agents      | `.claude/skills/rezics-design/` skill               |
| **Human (interactive)** | Designers, developers   | Storybook composition site                          |
| **Human (in-editor)**   | Developers writing code | `CLAUDE.md` UI Conventions anchor pointing to skill |

**Storybook Composition (multi-package + independent):**
- One Storybook per UI-producing package: `ui`, `app`, `editor`, `folio`, `admin` (5 total).
- Each runs standalone (`bun -F @rezics/<pkg> storybook`) — supports independent publishing of `editor`/`folio`/etc.
- A root-level host Storybook aggregates all five via `refs` for a single unified site.
- Shared decorators / framework config extracted to `package/storybook-config/` to avoid 5× duplication.

**OpenSpec is not used** for design system authoring. Specs are repo contracts validated by `check:convention`; design is reference knowledge consumed on demand.

**Reference material** is cloned outside the repo:
- `../example/open-design` (sibling to rezics, not git-tracked, not committed). Used only during Phase 2 analysis.

---

## 3. Goals & Non-Goals

### 3.1 In scope
- Design tokens (color, typography, spacing, radius, elevation, motion) as TypeScript constants.
- MUI theme + UnoCSS preset derived from tokens.
- `.claude/skills/rezics-design/` skill encoding design rules, voice, MUI-vs-shadcn boundaries, do/don't patterns.
- Storybook composition site replacing React Cosmos.
- Token galleries (color swatches, type scale, spacing scale) as MDX stories.
- Migration of existing components to use new tokens / theme.

### 3.2 Out of scope (v1)
- Figma library / design tool exports.
- Cross-repo distribution (npm publish of skill or tokens). Defer until external rezics repos materialize.
- Visual regression CI (Chromatic, Percy). Defer.
- Internationalization of design language docs (skill is English; cosmetic strings are not).

---

## 4. Phases & Tasks

Each task has an ID, an action, and acceptance criteria. Mark complete only when the criteria are demonstrably met.

### Phase 1 — Setup & Bootstrap

- [x] **T1.1** Clone `nexu-io/open-design` to `../example/open-design`.
- [x] **T1.2** Survey open-design top-level structure to locate the 72 design systems' definitions.
- [x] **T1.3** Create research scratch directory.

### Phase 2 — Analyze open-design (semi-auto, with review gate)

- [x] **T2.1** Sub-agent extracts token shape across all 72 systems → `02-token-shape-survey.md`.
- [x] **T2.2** Sub-agent shortlists 3–5 reference systems → `03-reference-shortlist.md` (apple, claude, notion, mintlify, cursor).
- [x] **T2.3** Author **rezics design direction brief**.
  - v0 `04-rezics-direction-brief.md` superseded by `briefs/01-foundation-v1.md`.
- [x] **🚦 GATE-A** User approved `briefs/01-foundation-v1.md` with all defaults (2026-05-01).

### Phase 3 — Codify Design Tokens

- [x] **T3.1** Author `package/ui/src/config/tokens/colors.ts` (semantic + scale, light + dark).
- [x] **T3.2** Author `package/ui/src/config/tokens/typography.ts` (families, viewport-clamp scale, line-heights, weights, font-size-adjust).
- [x] **T3.3** Author `package/ui/src/config/tokens/spacing.ts` (8px base scale).
- [x] **T3.4** Author `package/ui/src/config/tokens/radius.ts` (xs/sm/md/lg/xl/2xl/pill/full).
- [x] **T3.5** Author `package/ui/src/config/tokens/elevation.ts` (light + dark 4-tier modal shadows).
- [x] **T3.6** Author `package/ui/src/config/tokens/motion.ts` (120/200/350/500ms + easings).
- [x] **T3.7** Aggregate barrel: `package/ui/src/config/tokens/index.ts`.
- [x] **T3.8** Refactor `package/ui/src/config/theme.ts` to consume tokens.
  - Public API (`getTheme`, `getDynamicTheme`) preserved; consumers in app/admin/folio unchanged.
  - Adds `lightTheme` / `darkTheme` exports.
- [x] **T3.9** Wire tokens into `package/ui/src/config/uno-config.ts`.
  - Adds `brand` / `surface` / `text` / `success` / `warning` / `error` / `info` / `border` namespaces resolving to `var(--rzc-*)`. Preserves legacy `primary` / `secondary` MUI references.
- [x] **T3.10** Inject CSS custom properties via `package/ui/src/shared/styles/layers.css`.
  - `:root` + `[data-theme="dark"], html.dark` (transitional alias for current app shell). `:lang()` regional CJK routing. `prefers-reduced-motion` global rule.
- [x] **T3.11** Smoke-test in `@rezics/app` dev server.
  - Vite boots clean; `--rzc-*` vars served via layers.css; Uno preflight resolves `border-border` to our whisper token. Visual audit deferred to Phase 9.

### Phase 4 — Author Claude Skill

- [x] **T4.1** Create `.claude/skills/rezics-design/SKILL.md` (frontmatter trigger, top-level rules, decision quickstart, hard never-list, sub-file pointers).
- [x] **T4.2** Create `voice.md` — mood (parchment archive), tone-per-surface table, reference systems, litmus test.
- [x] **T4.3** Create `tokens.md` — full cheatsheet for surfaces / text / brand / semantic / borders / spacing / radius / motion / elevation / typography + common-mistakes table.
- [x] **T4.4** Create `patterns.md` — 12 do/don't sections with code snippets covering layout, cards, buttons, inputs, links, icons, color usage, typography, spacing, mode handling, mock convention, admin/app density.
- [x] **T4.5** Create `mui-vs-shadcn.md` — selection table (MUI primary, shadcn supplement, custom last), decision flows for modal/form/empty-state, cross-cutting rules.
- [x] **T4.6** Add `## UI Work` section to `CLAUDE.md` (4-line pointer, no rule duplication).

### Phase 5 — Storybook Spike (go/no-go)

- [x] **T5.1** Verify Storybook **10** + Vite 8 + React 19 compatibility matrix (release notes / GitHub issues).
  - **Done**: Storybook **10.3.6** (current latest). Spike doc at `openspec/plans/design-system-research/05-storybook-spike.md`. Compat green: vite ^5–^8, react ^16.8–^19.
- [x] **T5.2** Add minimal `package/ui/.storybook/{main.ts,preview.tsx}` + 1 demo story.
  - **Done**: `package/ui/.storybook/` with isolated `vite.config.ts` (avoids the broken `tanstackRouter` plugin in `package/ui/vite.config.ts`). Demo story `Tokens.stories.tsx` (Surfaces / Buttons / Typography / Brand). `react-dom@^19.2.4` added to package deps.
- [x] **T5.3** Wire UnoCSS preset + MUI ThemeProvider in `preview.tsx`.
  - **Done**: `preview.tsx` imports `virtual:uno.css` + `layers.css`, wraps stories in `StyledEngineProvider` + `ThemeProvider` + `CssBaseline`, exposes a Light/Dark global toolbar that toggles `[data-theme]` + `html.dark`.
- [x] **T5.4** Add minimal `package/editor/.storybook/` + 1 demo story.
  - **Done**: `Editor.stories.tsx` with Markdown + JSON CodeMirror demos. Build emits `Editor.stories-*.js` + CodeMirror chunks.
- [x] **T5.5** Add root-level `.storybook/main.ts` with `refs` pointing to ui + editor.
  - **Done**: Root `.storybook/` host with `refs.ui` (port 6001) + `refs.editor` (port 6002). Demo `Welcome.stories.tsx`. `react`/`react-dom` added at root devDeps.
- [x] **T5.6** Validate `storybook build` for both packages and host produces deployable static dist.
  - **Done**: All three `storybook build` runs succeed — `package/ui/storybook-static/`, `package/editor/storybook-static/`, root `storybook-static/`. Each `index.json` lists the expected story IDs.
- [x] **🚦 GATE-B** User reviews spike outcome. Decide: full migration (Phase 6/7) or fall back (revise plan).

### Phase 6 — Storybook Build-Out

**Topology**: 5 publishable surfaces each own their Storybook so they can ship standalone; the root host on `:6006` composes them via `refs`. Chrome blocks `:6000` (`ERR_UNSAFE_PORT` — X11), `:6566`, `:6665–6669`, and `:6697` — the assignments below avoid those. Storybook's own default is `:6006`.

| Port | Instance         | Owner                                            |
| ---- | ---------------- | ------------------------------------------------ |
| 6006 | host             | root `.storybook/` (aggregator)                  |
| 6007 | `@rezics/ui`     | foundation, tokens, primitives — done in Phase 5 |
| 6008 | `@rezics/editor` | CodeMirror — done in Phase 5                     |
| 6009 | `@rezics/folio`  | reader (txt / epub)                              |
| 6010 | `@rezics/admin`  | admin app                                        |
| 6011 | `@rezics/app`    | main app                                         |

- [x] **T6.1** Extract shared config to `package/storybook-config/`.
  - **Done**: New workspace package `@rezics/storybook-config` with two entrypoints — `.` exports `baseStorybookConfig` + `baseStorybookViteConfig` (no JSX, safe for Storybook's node-side `main.ts` loader); `./preview` exports `withRezicsTheme(getTheme, { canvas })`, `themeGlobalTypes`, `basePreviewParameters`. UnoCSS is loaded via dynamic import and declared as an optional peer, so `editor` + `host` (which pass `{ uno: false }`) don't pull it. All 6 `.storybook/` shells reduced to thin wrappers (3-line `main.ts`, ~15-line `preview.tsx`, 3-line `vite.config.ts`). Latent bugs fixed in passing: folio + app preview now import `@rezics/ui/shared/styles/layers.css` (canvas `var(--rzc-*)` previously resolved to nothing); folio's vite config now actually loads the UnoCSS plugin its preview's `virtual:uno.css` import depended on. Root `package.json` gained `"type": "module"` so the host (root `.storybook/`) can import the ESM-only config package — verified no root-level `.js` files exist that would break (`tool/` is already its own type-module package). `bun run build-storybook` produces all 6 dists with exit 0; story counts unchanged from pre-refactor (1+4+2+1+1+1).
- [x] **T6.2** Add Storybook to `@rezics/folio` (port 6009).
  - **Done**: `.storybook/` + `Folio.stories.tsx` (Placeholder reader). Build clean.
- [x] **T6.3** Add Storybook to `@rezics/admin` (port 6010).
  - **Done**: `.storybook/` (with MUI theme + UnoCSS in `preview.tsx`) + `AdminDensity.stories.tsx` (Users table). Build clean.
- [x] **T6.4** Add Storybook to `@rezics/app` (port 6011).
  - **Done**: `.storybook/` (with MUI theme + UnoCSS + parchment canvas) + `AppSection.stories.tsx` (Recent Books). Build clean.
- [x] **T6.5** Update root `.storybook/main.ts` refs to include all 5 packages.
  - **Done**: Host now refs ui (6007), editor (6008), folio (6009), admin (6010), app (6011). Welcome story updated with port table.
- [x] **T6.6** Add root scripts: `bun storybook` (concurrently runs all + host) and `bun storybook:build` (builds all + host).
  - **Done**: `concurrently@^9` orchestrates `storybook:all` / `build-storybook:all` with color-prefixed labels for host/ui/editor/folio/admin/app. Validated end-to-end via `bun run build-storybook` (all 6 dists built, exit 0).
- [x] **T6.7** Document port convention in `CONTRIBUTING.md` (incl. the Chrome unsafe-ports note).
  - **Done**: New `## Storybook` section with 6-row port table, Chrome unsafe-ports footnote (`:6000`, `:6566`, `:6665–6669`, `:6697`), and run instructions.

### Phase 7 — Token Galleries & Design Docs (MDX)

- [x] **T7.1** Author `package/ui/src/docs/tokens/colors.mdx` rendering all color tokens as swatches.
- [x] **T7.2** Author `package/ui/src/docs/tokens/typography.mdx` rendering type scale.
- [x] **T7.3** Author `package/ui/src/docs/tokens/spacing.mdx` rendering spacing scale.
- [x] **T7.4** Author `package/ui/src/docs/tokens/radius.mdx`, `elevation.mdx`, `motion.mdx`.

  **T7.1–T7.4 completed.** Six MDX galleries under `package/ui/src/docs/tokens/` (`colors`, `typography`, `spacing`, `radius`, `elevation`, `motion`) plus a shared `_gallery.tsx` helper module (Grid, Swatch, Row, SpacingRuler, RadiusSample, ElevationSample, TypeSample, MotionSample). Wired by adding `@storybook/addon-docs` to `baseStorybookConfig` (Storybook 10 split docs out of core; this is now a peer-dep of `@rezics/storybook-config`) and extending the stories pattern to include `../src/**/*.mdx`. Each gallery imports `Meta` from `@storybook/addon-docs/blocks` to set its title under `Foundation/Tokens/{Name}`; built `index.json` confirms all six docs entries plus a clean folio build.
- [x] **T7.5** Author `package/ui/src/docs/voice.mdx` — design language for human readers (mirrors skill voice.md).
- [x] **T7.6** Author `package/ui/src/docs/patterns.mdx` — do/don't gallery.

  **T7.5–T7.6 completed.** `voice.mdx` (mood pillars + parchment swatches, tone-per-surface table, "don't say" Do/Dont compare, reference systems, litmus test) and `patterns.mdx` (12 do/don't sections — layout, cards, buttons, inputs, links, icons, color, typography, spacing, mode handling, mock convention, admin/app density — with rendered Compare cards where the contrast is visual). Added `Do` / `Dont` / `Compare` helpers to `tokens/_gallery.tsx`. `bun run build-storybook` for `@rezics/ui` exits clean; `storybook-static/index.json` registers `foundation-voice--docs` and `foundation-patterns--docs` under `Foundation/`.

### Phase 8 — Cosmos Retirement

- [x] **T8.1** Inventory existing Cosmos fixtures across `package/ui` (and any other package using Cosmos).
  - **Accept**: `openspec/plans/design-system-research/08-cosmos-fixture-inventory.md`.

  **Done.** 41 fixtures across 4 packages: `@rezics/ui` (8, on `.test.tsx`), `@rezics/app` (19), `@rezics/editor` (9), `@rezics/folio` (5). `@rezics/admin` has scripts + devDeps but zero fixtures — pure deletion. Inventory flags a **suffix conflict in `@rezics/ui`**: `cosmos.config.json` set `fixtureFileSuffix: "test"`, so the 12 `.test.tsx` files split into 8 cosmos fixtures (rename to `.stories.tsx`) and 4 real `bun:test` files (keep `.test.tsx`). Inventory also notes T8.3/T8.4's current wording only covers `package/ui` — actual delete scope is 4 cosmos.config.json files (ui/app/editor/folio), 2 cosmos.decorator.tsx files (ui/app), 2 vite.cosmos.config.ts files (editor/folio), and devDeps in 5 packages. Tighten at GATE-C.
- [x] **T8.2** Migrate each fixture to a Storybook story (mechanical).
  - **Accept**: Per-package PRs; each fixture has a story counterpart.

  **Done.** Migrated 41 fixtures → stories across 4 packages: ui (8), folio (5), editor (9), app (19 — 17 stories + 2 commented-out fixtures dropped). Cosmos `useFixtureInput`/`useFixtureSelect` mapped to Storybook `args` + `argTypes` (radio/range/boolean/text controls). Multi-fixture default-export-as-object converted to multiple named `StoryObj` exports per CSF file. App preview adds `QueryClientProvider` decorator (mirrors deleted `cosmos.decorator.tsx`). All 5 package storybooks build clean.
- [x] **T8.3** Remove `react-cosmos`, `react-cosmos-plugin-vite` from `package/ui/package.json`.

  **Done.** Stripped `react-cosmos` + `react-cosmos-plugin-vite` devDeps and `cosmos`/`cosmos-export` npm scripts from all 5 packages (ui, app, editor, folio, admin). `bun install` resyncs the lockfile cleanly.
- [x] **T8.4** Delete `cosmos.config.json`, `cosmos.decorator.tsx`.

  **Done.** Deleted 4× `cosmos.config.json` (ui/app/editor/folio), 2× `cosmos.decorator.tsx` (ui/app), 2× `vite.cosmos.config.ts` (editor/folio), and the leftover cosmos-only `package/ui/src/main.tsx` entry. `rg "react-cosmos|useFixtureInput|useFixtureSelect"` returns zero source-code matches (only docs/spec history).
- [ ] **🚦 GATE-C** Final user check: Storybook covers everything Cosmos did before deletion.

### Phase 9 — Adoption Audits (per package)

- [ ] **T9.1** Audit `@rezics/app` against tokens; open PR replacing hardcoded values.
- [ ] **T9.2** Audit `@rezics/admin`.
- [ ] **T9.3** Audit `@rezics/editor`.
- [ ] **T9.4** Audit `@rezics/folio`.
- [ ] **T9.5** Audit `@rezics/ui` internal components.

---

## 5. Open Decisions

- **D1** — Storybook **10** + Vite 8 + React 19 compatibility. Resolved by T5.1 spike (Storybook 10.3.6 covers our stack natively).
- **D2** — Whether to publish skill / tokens to npm for external rezics repos. **Deferred** until external repos exist.
- **D3** — Visual regression CI (Chromatic). **Deferred** to v2.
- **D4** — Whether `@rezics/storybook-config` should live in `package/` or be a standalone tool. **Default**: `package/storybook-config/` (workspace-internal).

---

## 6. Risks

| Risk                                                                 | Likelihood  | Mitigation                                                                                                                     |
| -------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Storybook 10 + Vite 8 + UnoCSS incompatibility                       | Resolved    | Phase 5 spike confirmed Storybook 10.3.6 builds clean against our stack. Fallback (stay on Cosmos + MDX route) was not needed. |
| open-design's 72 systems are wrapped in non-machine-readable formats | Medium      | Sub-agent reports back at T2.1; if blocked, fall back to manual sampling of top 5 candidate brands.                            |
| Token migration breaks existing visual surfaces                      | Medium-High | Smoke-test in T3.11; full audits gated to Phase 9 (post-Storybook).                                                            |
| Multi-Storybook concurrent dev too slow                              | Low         | Document selective `bun -F <pkg> storybook` usage; only host needs all running.                                                |
| Skill drift over time without enforcement                            | Medium      | Cosmos has no enforcement either; mitigation = quarterly review (`/loop` audit agent), not this plan.                          |

---

## 7. References

- `nexu-io/open-design` — https://github.com/nexu-io/open-design
- Existing UI package: `package/ui/`
- Existing convention specs: `openspec/specs/api-route-conventions/`, `openspec/specs/outbound-link-protection/`
- Existing user feedback memories (in `~/.claude/projects/.../memory/`): admin role, UI library priority, UI design style, MOCK convention.

---

## 8. Workflow Reminders

- This is a **task-heavy plan**, not a complex one. Progress is measured by ticked boxes.
- Three review gates require user approval; do not skip them.
- Research outputs in `openspec/plans/design-system-research/` are transient — may be deleted after the plan completes.
- Each phase can be executed in a separate session; this plan is the durable handoff.
