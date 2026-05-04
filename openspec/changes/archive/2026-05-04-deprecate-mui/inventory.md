# MUI surface inventory — start of `deprecate-mui`

Snapshot taken at the start of Phase 0 implementation. Counts are reconciled against `proposal.md` Context table; small drift is expected since proposal-time and apply-time scans were taken at different commits.

## Aggregate counts

| Surface | Files | Imports / occurrences |
| --- | --- | --- |
| `@mui/material` | 352 | 518 |
| `@mui/icons-material` | 116 | 214 |
| `@mui/lab` | 4 (3 source + 1 `package.json` × 3) | 1 source occurrence in `package/app/src/playground/pages/TestPage.tsx` |
| `sx={…}` props | 159 | 520 |
| `createTheme` / `<ThemeProvider>` (excluding markdown / READMEs) | 7 source files | — |
| `@mui/material/styles` source imports | 11 | 13 |
| `@mui/x-*` (DataGrid etc.) | 0 | 0 |

## Per-package breakdown

| Package | `@mui/material` files | `@mui/icons-material` files | `sx={…}` props | `sx={…}` files |
| --- | --- | --- | --- | --- |
| `@rezics/ui` | 46 | 13 | 84 | 25 |
| `@rezics/app` | 263 | 82 | 282 | 104 |
| `@rezics/admin` | 41 | 19 | 153 | 29 |
| `@rezics/storybook-config` | 2 | 0 | 0 | 0 |
| `@rezics/folio` | 0 | 2 | 1 | 1 |
| `@rezics/editor` | 0 | 0 | 0 | 0 |

## `package.json` declarations

`@mui/*` listed as a dependency in:

- `package/ui/package.json` — `@mui/material@7.3.1`, `@mui/icons-material@7.3.1`, `@mui/lab@7.0.0-beta.16`
- `package/app/package.json` — `@mui/material`, `@mui/icons-material`, `@mui/lab`
- `package/admin/package.json` — `@mui/material`, `@mui/icons-material`, `@mui/lab`
- `package/storybook-config/package.json` — `@mui/material` (peerDependency)

`@material/material-color-utilities` listed as a dependency in:

- `package/ui/package.json`
- `package/app/package.json`
- `package/admin/package.json`

## `@mui/material/styles` source consumers (Phase 2 target)

These are the files that import from `@mui/material/styles`. Phase 2 (tasks §3.1–3.9) is responsible for deleting the two `@rezics/ui` consumers and rewriting App.tsx. The remaining six in `@rezics/app` are migrated as part of Phase 3 (tasks §4); task 3.9's rg gate (`@mui/material/styles|getTheme\(|<ThemeProvider`) will therefore remain non-empty until Phase 3 completes its `useTheme` / `styled` sweep across `@rezics/app`.

Files (11 total source):

1. `package/ui/src/config/theme.ts` — ✅ deleted in Phase 2 (3.1)
2. `package/ui/src/config/dynamicTheme.ts` — ✅ deleted in Phase 2 (3.1)
3. `package/ui/src/primitive/typography/collapsible/Collapsible.tsx` — ✅ rewritten in Phase 2 (3.2)
4. `package/ui/src/composite/auth/AuthProviderButton.tsx` — ✅ rewritten in Phase 2 (3.2)
5. `package/app/src/app/App.tsx` — ✅ rewritten in Phase 2 (3.7)
6. `package/admin/src/app/App.tsx` — ✅ rewritten in Phase 2 (3.7)
7. `package/app/src/home/sections/NoticeBoard.tsx` — **Phase 3**
8. `package/app/src/core/components/header/MainLayoutHeader.tsx` — **Phase 3**
9. `package/app/src/search/components/SearchFilter.tsx` — **Phase 3**
10. `package/app/src/book-library/components/Chapter/ChapterArboristNode.tsx` — **Phase 3**
11. `package/app/src/book-library/components/Chapter/ChapterArboristHeightSlider.tsx` — **Phase 3**

## End-of-Phase-2 status

Task 3.9 gate (`rg '@mui/material/styles|getTheme\(|<ThemeProvider' package`):

| Package | Hits at end of Phase 2 |
| --- | --- |
| `package/ui/` | 0 |
| `package/admin/` | 0 |
| `package/storybook-config/` | 0 |
| `package/folio/` | 0 |
| `package/app/` | 5 source + 1 markdown doc — all known Phase 3 targets above plus `package/app/docs/DYNAMIC_THEME_README.md` (doc, not code) |

Phase 2 introduces the following follow-ups for Phase 3:

- `@rezics/ui` no longer exports `getTheme`, `getDynamicTheme`, `applyDynamicThemeToDOM`, `generateDynamicColors`, `extractColorFromImage`, `dynamicColorsToPalette`, `PRESET_COLORS`, `DynamicColorScheme`. Two `@rezics/app` files (`preference/components/ThemeCustomizer.tsx`, `preference/sections/ThemeDemo.tsx`) still import `extractColorFromImage` / `PRESET_COLORS` and will fail TS-check until Phase 3 either rewrites those preference pages on a token-only basis or scope-cuts the dynamic-accent-color feature.
- The dynamic accent-color feature (custom user color → MUI palette) was retired with the App.tsx rewrite. Re-implementation as token-only writes (set `--rezics-color-brand-fill` etc. on `:root`) is Phase 3 follow-up.
- `Phase 4` icon work (folio `@mui/icons-material` sites) and the broader Phase 3 sweep are unaffected by Phase 2 changes.

## `@rezics/folio` import sites (task 1.4)

Folio has 4 MUI icon imports across 2 files (proposal estimate of "2 imports" was per-file, not per-symbol):

```
package/folio/src/Folio.tsx:1: CloseIcon from "@mui/icons-material/Close"
package/folio/src/Folio.tsx:2: MenuIcon  from "@mui/icons-material/Menu"
package/folio/src/plugins/txt/TxtSettings.tsx:1: CheckCircleIcon from "@mui/icons-material/CheckCircle"
package/folio/src/plugins/txt/TxtSettings.tsx:2: CloseIcon       from "@mui/icons-material/Close"
```

`package/folio/package.json` declares no `@mui/*` dependency — the imports resolve transitively through the workspace. These are migrated as part of Phase 4 (task 5.1).

## `@rezics/editor` MUI-free verification (task 1.3)

```
$ rg '@mui/' package/editor/src
(empty)

$ rg '@mui|material-color-utilities' package/editor/package.json
(empty)
```

`@rezics/editor` is confirmed MUI-free in source and `package.json`. R8 will guard this state going forward.

## `@mui/lab` source usage

Single occurrence: `package/app/src/playground/pages/TestPage.tsx`. Migrated in tasks 4.2.3 (LoadingButton replacement).

## Burn-down targets (Phase 5 verification)

End-of-migration acceptance is `rg` returning empty for all of:

```
rg '@mui/' package/*/src/
rg '@mui/' package/*/package.json
rg '@material/material-color-utilities' package/*/package.json
rg '\bsx=' package/{ui,app,admin,folio}/src
```

R8 (added in tasks 6.5) enforces the first two as a permanent constraint.
