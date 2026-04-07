## Why

The codebase has accumulated **104 biome lint errors** and **~100 TypeScript type errors** across all packages. These include correctness issues (hooks called conditionally, unreachable code), accessibility violations (missing button types, keyboard handlers), suspicious patterns (implicit any, array index keys), and broken type-checking (missing tsconfig flags, wrong argument counts). Cleaning these up now prevents them from compounding and ensures CI lint/type gates can be enforced.

## What Changes

- Fix all 104 biome lint **errors** across the monorepo (warnings are excluded)
- Fix TypeScript type errors across all packages: `app`, `ui`, `admin`, `api`, `editor`, `folio`, `preview`, `search`, `app-shell`
- Add missing tsconfig flags (`jsx`, `DOM.Iterable` lib) where needed
- Add missing dev dependencies (`react-i18next` types in `ui`, `zustand` types in `admin`)
- Remove dead code (unreachable statements, unused `@ts-expect-error` directives)
- Add `biome-ignore` suppressions only for intentional patterns (`dangerouslySetInnerHTML` for HTML rendering)

## Capabilities

### New Capabilities

_None — this is a cleanup change with no new functionality._

### Modified Capabilities

_None — no spec-level behavior changes._

## Impact

- **Affected packages**: `package/app`, `package/ui`, `package/admin`, `package/api`, `package/editor`, `package/folio`, `package/preview`, `package/search`, `package/app-shell`, `package/contract`, `package/server`, `package/jwt`
- **~75 source files** modified across the monorepo
- **5 tsconfig.json** files updated (preview, editor, folio, ui, api/app-shell)
- **No breaking changes** — all fixes preserve existing runtime behavior
- **No API changes** — only internal code quality improvements
- **Backward compatible** — no migration needed
