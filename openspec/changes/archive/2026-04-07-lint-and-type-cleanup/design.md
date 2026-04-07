## Context

The monorepo has 104 biome lint errors and ~100 TypeScript type errors accumulated over time. Biome is configured with recommended rules plus custom overrides (unused vars/imports as warnings, explicit any off). TypeScript uses project references with a shared `tsconfig.base.json` (strict mode, ESNext, Bundler resolution). Several packages have incomplete tsconfig settings (missing `jsx`, missing `DOM.Iterable` lib).

## Goals / Non-Goals

**Goals:**
- Eliminate all 104 biome lint errors (errors only, not warnings)
- Eliminate all TypeScript type errors across every package
- Ensure `bunx biome check .` and `tsc --noEmit` per package report zero errors
- Preserve all existing runtime behavior

**Non-Goals:**
- Fixing biome warnings (unused variables, unused imports, import type style)
- Refactoring code beyond what's needed for the fix
- Adding new tests or documentation
- Changing any user-facing behavior or API contracts

## Decisions

### 1. Fix strategy for `noArrayIndexKey` errors (16 occurrences)
Use `biome-ignore` suppression for static/render-only lists where items have no stable identity (e.g., skeleton placeholders, static brand logos, color swatches). For dynamic lists where items have natural IDs, use those IDs. Rationale: forcing synthetic keys on truly static lists adds complexity with no benefit.

### 2. Fix strategy for `dangerouslySetInnerHTML` errors (5 occurrences)
Add `biome-ignore lint/security/noDangerouslySetInnerHtml: <reason>` inline comments. These are all intentional HTML rendering (markdown content, epub chapters, style injection). Rationale: the lint rule is correct in general, but these usages are by design and the content is sanitized/trusted at the boundary.

### 3. Fix strategy for `useHookAtTopLevel` errors (3 occurrences)
Restructure components to call hooks unconditionally, moving conditional logic after the hook call. For route hooks wrapped in try/catch, use optional parameters or conditional rendering patterns instead. Rationale: hooks must follow React's rules; conditional hook calls cause runtime bugs.

### 4. TypeScript config fixes over code workarounds
Add missing tsconfig settings (`jsx: "react-jsx"` in preview, `DOM.Iterable` in lib arrays) rather than rewriting code to avoid iterators. Rationale: the code is correct; the config just needs to declare the runtime features it uses.

### 5. Generated files (`routeTree.gen.ts`, `mock/routeTree.gen.ts`)
Auto-fix with `biome check --write` for organize-imports. For `noBannedTypes` in generated mock route files, add `biome-ignore` since these files are auto-generated. Rationale: generated files should not be manually maintained.

### 6. Dead code in `token.book.api.ts`
Remove unreachable code after the early return. The endpoint already returns 403 — the dead code below was likely left from a previous implementation.

## Risks / Trade-offs

- **[Risk] Conditional hook restructuring may change rendering behavior** → Mitigation: test affected pages (BookEditLayout, ReviewNewPage, UserPage) manually after changes.
- **[Risk] Suppressing `noArrayIndexKey` hides potential issues** → Mitigation: only suppress for truly static lists; add comment explaining why.
- **[Risk] Adding dependencies (`react-i18next` to ui)** → Mitigation: add as `devDependencies` only since UI package consumers already provide these at runtime.
