## Context

Before this change, rezics had three competing notions of "design":

1. **Code reality** — `@rezics/ui` exported MUI 7 + Radix + shadcn primitives, UnoCSS classes, and per-component CSS, with no shared color / spacing / typography source. Each package picked its own values inline.
2. **Tribal knowledge** — design preferences (Apple-inspired, MUI-first, borderless, no-emoji-icons, parchment-not-glass) were stored in chat-memory entries and one-off PR reviews, never codified.
3. **React Cosmos fixtures** — 41 component fixtures across `@rezics/ui` / `@rezics/app` / `@rezics/editor` / `@rezics/folio` for visual exercise, but no documentation surface, no token galleries, no MDX, no compositional view across packages, and no first-class addon ecosystem.

The cost showed up in three places: AI sessions reinvented taste each conversation; new contributors had to reverse-engineer style from existing components; visual drift accumulated across `app` / `admin` / `editor` / `folio` because no contract bound them.

Constraints that shaped the solution:

- **MUI is the foundation.** The design system has to *generate* a MUI theme rather than replace it. Any token shape that doesn't map to `palette` / `spacing` / `shape` / `typography` is a non-starter.
- **UnoCSS is the utility layer.** UnoCSS classes consumed in components must auto-switch with mode, which means they have to bind to CSS custom properties, not raw values.
- **Multi-package independence.** `@rezics/editor` and `@rezics/folio` ship as standalone packages; their Storybooks must run independently from the rest. The host has to compose, not own.
- **Accessibility is non-negotiable for text.** The brand color `#f4606c` fails WCAG AA for body text on parchment (2.83:1) and on white (3.12:1). The system has to forbid `brand-fill` as text color and route brand-colored text through a separate, contrast-verified token (`text-brand` = `#C4433A` on light, `#fa7882` on dark).
- **CJK first-class.** rezics's primary audience uses Traditional Chinese; type tokens need to handle Latin (Inter) + CJK (Source Han Sans) layered via `unicode-range` + `:lang()` regional switching, with `font-size-adjust` to harmonize x-heights.
- **Reduce dependence on chat memory.** Anything captured only in `MEMORY.md` is fragile; this change moves design rules into source-controlled artifacts (token files, MDX docs, skill files).

## Goals / Non-Goals

**Goals**

- One source of truth for design tokens, in TypeScript, consumed by both MUI theme and UnoCSS preset.
- One CSS custom property namespace (`--rezics-*`) bound to those tokens, available to non-MUI consumers and DevTools inspection.
- Storybook 10 as the canonical documentation site, with a 5-package composition topology and a host aggregator at `:6006`.
- AI-readable design reference (`.claude/skills/rezics-design/`) and human-readable counterpart (`voice.mdx` + `patterns.mdx`), both deriving from the same Foundation v1 brief.
- Per-package adoption audits closing every Hard-Never violation (brand-color text scatter, emoji-as-icon chrome, line-height < 1.30); defensible items deferred with documented rationale.
- React Cosmos fully retired; no `cosmos.config.json` / `react-cosmos` devDeps remaining.

**Non-Goals**

- Figma library / design tool exports. Code is the source of truth.
- Cross-repo distribution (npm publish of skill or tokens). Deferred until external rezics repos exist.
- Visual regression CI (Chromatic, Percy). Deferred to v2.
- Internationalization of design language docs. Skill and MDX are English; cosmetic strings are not internationalized.
- Component primitive forms (Button shape, Input border policy, Card structure). Deferred to a separate "Atomic Primitives" brief.
- Surface-specific briefs (Library family, UGC, Tag, Admin design language). Each gets its own brief inheriting from Foundation v1.

## Decisions

### Decision 1 — Tokens are TypeScript constants, CSS variables are the runtime contract

```ts
// package/ui/src/config/tokens/colors.ts
export const surfaces = { canvas: '#f5f4ed', base: '#faf9f5', /* ... */ } as const;
export const text = { primary: '#1d1d1f', secondary: '#6e6e73', brand: '#C4433A', /* ... */ } as const;
```

The token modules are the canonical source. `package/ui/src/shared/styles/layers.css` injects the same values as `--rezics-color-*` / `--rezics-space-*` / etc. on `:root`, with `[data-theme="dark"]` overriding for dark mode. MUI theme (`config/theme.ts`) and UnoCSS preset (`config/uno-config.ts`) both consume the TypeScript modules; UnoCSS shortcuts resolve to `var(--rezics-…)` rather than literal values so utility classes auto-switch with mode.

**Why not Tailwind preset only**: Tailwind/UnoCSS preset alone would not give MUI components the same colors. We need both projections binding to the same variables.

**Why not CSS-in-JS only**: MUI's emotion engine generates per-component class names that bypass `data-theme` switching unless the component re-renders. Static CSS vars switch instantly without re-renders.

**Trade-off**: token authors must keep the TypeScript module, the `layers.css` injection, and the MUI/UnoCSS bindings in sync. Mitigated by co-locating all four in `package/ui/src/config/` + `shared/styles/` and by gating any token addition through the same review.

### Decision 2 — `--rezics-*` is the only CSS custom property namespace

Originally the prefix was `--rzc-*` (compressed). Late-stage rename to `--rezics-*` was applied after the user pointed out that `rezics` is itself the brand abbreviation; further compression to `rzc` strips semantics for no meaningful saving in authored code (UnoCSS shortcuts handle most surface-level brevity).

**Rule**: the namespace is mandatory. Components that need a design value either use a token through the MUI theme, an UnoCSS class, or `var(--rezics-…)` directly. Hard-coded hex / px values for color and spacing are violations (see `design-system-adoption` capability).

**Trade-off**: 5-character-longer var names than `--rzc-*`. Acceptable because authored sites are mostly tokens themselves (one-time write) or routed through UnoCSS shortcuts.

### Decision 3 — Multi-package Storybook with `refs` composition, not a single monolithic Storybook

Each UI-producing package owns its own `.storybook/` and runs standalone:

| Port | Instance        | Owner                                            |
| ---- | --------------- | ------------------------------------------------ |
| 6006 | host            | root `.storybook/` (aggregator)                  |
| 6007 | `@rezics/ui`    | foundation, tokens, primitives                   |
| 6008 | `@rezics/editor`| CodeMirror                                       |
| 6009 | `@rezics/folio` | reader (txt / epub)                              |
| 6010 | `@rezics/admin` | admin app                                        |
| 6011 | `@rezics/app`   | main app                                         |

The host at `:6006` composes all five via `refs`. Chrome unsafe-port restrictions (`:6000`, `:6566`, `:6665–6669`, `:6697`) drove the assignment; these are documented in `CONTRIBUTING.md`.

**Why not a single root-only Storybook**: `@rezics/editor` and `@rezics/folio` are publishable; their Storybooks must build standalone for downstream consumers.

**Trade-off**: 6 storybook processes when running everything concurrently. Mitigated by `bun -F <pkg> storybook` for selective dev, and by `concurrently@^9` orchestrating `bun run storybook` for the full set.

### Decision 4 — Shared Storybook config lives in a workspace package

Without extraction, each `.storybook/` shell duplicated ~50 lines of framework config + theme decorators + UnoCSS plugin wiring across 6 instances. Extracted to `@rezics/storybook-config` with two entrypoints:

- `.` — `baseStorybookConfig`, `baseStorybookViteConfig`. No JSX; safe for Storybook's node-side `main.ts` loader.
- `./preview` — `withRezicsTheme(getTheme, { canvas })`, `themeGlobalTypes`, `basePreviewParameters`.

UnoCSS is loaded via dynamic import and declared as an optional peer, so consumers passing `{ uno: false }` (editor, host) don't pull it.

**Why not a `tool/` or `script/` directory**: workspace package gives clean dependency tracking and `package.json` exports map; tool dirs would need ad-hoc TS path setup.

### Decision 5 — Adoption audits use a fixed format with three resolution categories

Each per-package audit produces:

- **Severity**: Small / Medium / Large by violation count and category mix.
- **Counts**: hex literals, font sizes, line heights, pixel spacing, raw `<a>`, emoji icons.
- **Top offenders**: 3–5 worst files with violation counts.
- **Fixed in this phase**: violations resolved inline.
- **Deferred**: split into "defensible" (MUI sx pixel numerics, CodeMirror API, reader runtime params) vs "warrants dedicated PR" (large CSS palette migrations).

**Hard-Never categories** (always fix):

- Brand color (`#f4606c`) used as text color or scattered as a literal.
- Emoji as UI chrome icon (✕ ☰ ▶ ▼ ★ etc.). Content emoji is fine.
- `line-height` below 1.30 floor.
- Raw `<a href>` for outbound links (covered by separate `outbound-link-protection` spec).

**Defensible categories** (document, do not force-migrate):

- MUI icon `fontSize: 14|16|18|20|24` numerics (MUI's pixel-based icon-sizing API).
- MUI sx `width|height|gap|padding` integer multiples (resolve through `theme.spacing()`).
- CodeMirror `highlight.ts` hex literals (CodeMirror's `HighlightStyle` API takes literal colors).
- Vendor pseudo-element overrides (`:-webkit-autofill` background).
- Reader-theme runtime parameters in `package/folio/src/styles/theme.ts` (light/dark/sepia palettes are user-facing book-reader settings).

This split protects future audits from churning over things that are not actually wrong.

## Risks

| Risk                                                            | Status                                                                                                          |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Storybook 10 + Vite 8 + UnoCSS incompatibility                  | **Resolved**. Phase 5 spike confirmed Storybook 10.3.6 builds clean; all 6 dists exit 0.                        |
| Multi-Storybook concurrent dev too slow                         | **Mitigated**. `bun -F <pkg> storybook` for selective dev; only host needs all running.                         |
| Token migration breaks existing visual surfaces                 | **Mitigated**. Phase 9 audits caught all Hard-Never violations; remaining defensible items documented.          |
| CJK font subsetting / preload pipeline missing                  | **Deferred**. Foundation v1 declares the strategy (`unicode-range` + `:lang()` + subsetting) but the actual font-asset subsetting + `<link rel=preload>` integration is implemented per-app on demand. Latin fonts ship cleanly today. |
| Skill drift over time without enforcement                       | **Accepted**. Cosmos had no enforcement either; mitigation is quarterly review (manual or `/loop` audit), not part of this change.                                                                                  |
| Visual regression CI not in place                               | **Deferred to v2**. Storybook builds clean per CI; `bun run check:convention` covers code-level conventions.    |

## Rollout

This change is post-hoc — the work shipped over Phase 1–9 across multiple commits before this change document was authored. The rollout was:

1. **Phase 1–2**: External `nexu-io/open-design` reference cloned to `../example/open-design`; sub-agents extracted token shapes from 72 reference systems. **GATE-A** approved Foundation v1 brief on 2026-05-01.
2. **Phase 3**: Token TypeScript modules + MUI theme + UnoCSS preset + `layers.css` shipped; smoke-tested in `@rezics/app` dev server.
3. **Phase 4**: `.claude/skills/rezics-design/` shipped (SKILL.md + voice.md + tokens.md + patterns.md + mui-vs-shadcn.md). `CLAUDE.md` updated with `## UI Work` pointer.
4. **Phase 5**: Storybook 10 + Vite 8 + React 19 spike for `@rezics/ui` + `@rezics/editor` + root host. **GATE-B** approved.
5. **Phase 6**: Storybook extended to `@rezics/folio` / `@rezics/admin` / `@rezics/app`; shared config extracted to `@rezics/storybook-config`; root scripts via `concurrently`.
6. **Phase 7**: Six MDX token galleries + `voice.mdx` + `patterns.mdx` shipped under `package/ui/src/docs/`.
7. **Phase 8**: Cosmos retirement — 41 fixtures migrated; devDeps + config files removed. **GATE-C** approved.
8. **Phase 9**: Per-package adoption audits ran; all Hard-Never violations fixed; defensible / large-refactor items documented and deferred.
9. **Late-stage**: `--rzc-*` → `--rezics-*` rename across 22 files; user feedback memory updated.

This change folder consolidates the above into the OpenSpec audit trail. Archive moves it to `openspec/changes/archive/2026-05-01-establish-design-system/` and applies the four spec deltas to `openspec/specs/`.

## Alternatives Considered

- **Single mega-token JSON consumed via `style-dictionary` build step.** Rejected — adds a build step and a JSON authoring layer; TypeScript modules are typed, refactor-safe, and consumed by the same toolchain that ships them.
- **`@vanilla-extract/css` for type-safe CSS-in-TS.** Rejected — replaces emotion in MUI's hot path, would force UnoCSS to coexist with a third style runtime; not worth the migration cost when CSS variables already give us mode switching.
- **Tailwind v4 native instead of UnoCSS.** Rejected — UnoCSS is already in use across packages, supports the existing Tailwind / shadcn presets, and produces smaller bundles via on-demand atomic generation.
- **Stay on React Cosmos.** Rejected at GATE-B — Cosmos has no MDX, no docs panel, no addon ecosystem, and minimal maintenance velocity. Storybook 10 ships docs, controls, and `refs` composition out of the box.
- **Single root-only Storybook with all packages mounted.** Rejected (Decision 3) because `@rezics/editor` and `@rezics/folio` need to build standalone for downstream consumers.
- **Keep `--rzc-*` prefix.** Rejected late-stage — `rezics` is the brand abbreviation; further compression strips semantics without buying meaningful brevity. Renamed across 22 files in one sweep.
