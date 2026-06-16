---
title: Zone content max-width as free pixel value
status: active
created: 2026-06-11
completed:
supersededBy:
tags: [zone, contract, app]
---

## Why

`theme.layout.contentWidth` (`"normal" | "wide"`) compiles to UnoCSS classes
(`max-w-6xl` / `max-w-8xl`) via `zoneContentWidthClass()` in
`package/app/src/zone/models/zoneTheme.ts`. That file is plain `.ts`, which
UnoCSS's default pipeline does not scan, so neither class is generated from it —
both survive only because the same literals happen to appear in unrelated `.tsx`
files (`SettingsShell.tsx`, `FeedbackAdminPage.tsx`). Any config-driven class
selection is structurally fragile under UnoCSS build-time extraction, and preset
enums are needlessly coarse anyway.

Replace the enum with a free pixel number `contentMaxWidth` that flows through
the existing theme→CSS-variable pipeline (`zoneThemeCssVars()` →
`--zone-content-max-width`) and is consumed via inline `style`, taking UnoCSS
out of this path entirely. Zone authors get arbitrary widths; default is 1440px.

## Durable constraints & decisions

- (comment, in `zoneTheme.ts`) Theme-driven layout values MUST flow through CSS
  custom properties + inline style, never through runtime-selected utility
  class names: UnoCSS only generates CSS for class literals statically present
  in scanned files (`.tsx` etc., not plain `.ts`), so a class name chosen at
  runtime from config has no generated CSS unless it coincidentally appears
  elsewhere. Extend the existing tokens-only comment block with this why.
- (comment, at the schema field) `contentMaxWidth` is deliberately unclamped
  (no minimum/maximum): a degenerate value only makes that zone ugly, never
  breaks navigation out of it — author freedom over guardrails. `t.Number()`
  already rejects non-numeric JSON garbage.
- (type) `layout.contentMaxWidth: t.Optional(t.Number())` — unit is fixed px;
  no string lengths, no enum presets. `density` stays untouched.
- (type) Default lives in one exported constant
  `ZONE_CONTENT_MAX_WIDTH_DEFAULT = 1440` in `zoneTheme.ts`; the `var()`
  fallback is built from it, never hand-written twice. 1440 matches the design
  system's `8xl = 1440px` reading-container cap (no second magic number).
- (test) `zoneThemeCssVars()` emits `--zone-content-max-width: <n>px` when
  `contentMaxWidth` is set and omits the variable entirely when absent.
- (commit message) v1 hard cutover, no envelope version bump and no upgrade fn:
  dev-stage decision, maintainer re-runs seeds; stored themes with the old
  `contentWidth` field simply fail `parseZoneTheme` and fall back to default
  rendering.

## Tasks

## 1. Contract

- [x] 1.1 `package/contract/src/zone/theme-v1.ts`: in the `layout` object,
      replace `contentWidth` (union) with `contentMaxWidth: t.Optional(t.Number())`.
- [x] 1.2 `package/contract/src/zone/envelopes.test.ts:60`: update theme fixture
      `contentWidth: "wide"` → `contentMaxWidth: 1440`.

## 2. App rendering

- [x] 2.1 `package/app/src/zone/models/zoneTheme.ts`: delete
      `zoneContentWidthClass()`; export `ZONE_CONTENT_MAX_WIDTH_DEFAULT = 1440`;
      extend `zoneThemeCssVars()` to emit `--zone-content-max-width: ${n}px`
      when `theme.layout.contentMaxWidth` is set; extend the header comment with
      the UnoCSS-extraction constraint.
- [x] 2.2 `package/app/src/zone/pages/ZonePortalPage.tsx`: drop the
      `zoneContentWidthClass` import and `widthClass`; content container becomes
      `className="mx-auto w-full px-4 py-8"` plus
      `style={{ maxWidth: \`var(--zone-content-max-width, ${ZONE_CONTENT_MAX_WIDTH_DEFAULT}px)\` }}`.
- [x] 2.3 New `package/app/src/zone/models/zoneTheme.test.ts`: lock the
      emit-when-set / omit-when-absent behavior of `--zone-content-max-width`
      (style follows `zoneManageDraft.test.ts` colocation).

## 3. Manage UI

- [x] 3.1 `package/app/src/zone/components/manage/ZoneManageThemeTab.tsx`:
      replace the content-width `Select` with a numeric `Input`
      (placeholder `1440`, label stays `zone:manage_content_width`); empty →
      `contentMaxWidth: undefined` (pruned), otherwise parsed number. Density
      `Select` untouched.
- [x] 3.2 `package/app/src/zone/models/zoneManageDraft.test.ts:85`: update
      fixture `layout: { contentWidth: "wide" }` → `layout: { contentMaxWidth: 1440 }`.
- [x] 3.3 `package/i18n/locales/{de,en,ja,ko,zh-hans,zh-hant}/zone.json`: remove
      now-unused `manage_width_normal` and `manage_width_wide` keys.

## 4. Factory & seeds

- [x] 4.1 `package/server/src/db/factory/zones.ts:171`:
      `contentWidth: faker.helpers.arrayElement(["normal", "wide"])` →
      `contentMaxWidth: faker.helpers.arrayElement([1152, 1280, 1440])`.
- [x] 4.2 `package/server/src/db/factory/scenarios.ts:1907`:
      `{ contentWidth: "wide", ... }` → `{ contentMaxWidth: 1440, ... }`.
- [x] 4.3 `package/server/src/db/seed/infra/seed-official-zones.ts:146`: same
      replacement, `contentMaxWidth: 1440`.

## 5. Header alignment (same-var bonus)

- [x] 5.1 `package/app/src/zone/components/ZoneHeader.tsx:112`: the sticky bar's
      inner row (`flex h-12 items-center gap-2 px-4 md:gap-3 md:px-6`) gets
      `mx-auto` plus the same
      `style={{ maxWidth: \`var(--zone-content-max-width, ...DEFAULT}px)\` }}`,
      so header content aligns with the content column instead of pinning to
      viewport edges (the sticky background stays full-bleed). The var is
      inherited from the portal root; the fallback keeps it safe standalone.

## 6. Verify

- [ ] 6.1 `task test`, `task format`, `task check:convention` pass.
- [ ] 6.2 Manual: `task dev`, open `/z/<slug>` — content clamps at 1440px by
      default; setting Theme → content width to e.g. `800` narrows the column;
      clearing it restores the default.

## Out of scope

- `layout.density` — remains schema-only and unconsumed; separate decision.
- Per-page width overrides in `page-v1` — wait for a real zone to need it.
- Percentage/viewport-relative widths — rejected: readable measure is absolute.
- UnoCSS `safelist` / `pipeline.include` changes — unnecessary once this path
  stops using classes; the rest of the codebase audits clean.
- Re-running seeds / migrating existing dev rows — maintainer handles.
