## Context

The frontend currently uses `react-i18next` and TypeScript locale modules under `package/app/src/locale/`. Several reusable UI components in `package/ui` also import `react-i18next` directly, while other UI package code imports Rezics product/domain dependencies such as `@rezics/contract`, `@rezics/api`, and TanStack Router. This makes it difficult to share `@rezics/ui` with multiple Rezics projects that need the visual system but not the same product catalog, router, API client, or app-level translation resources.

The target architecture separates locale ownership from message ownership:

```txt
app/admin shell
  owns active locale selection
        |
        | sync locale
        v
+----------------------+       +----------------------+
| @rezics/i18n         |       | @rezics/ui/i18n      |
| product/domain text  |       | UI component text    |
+----------------------+       +----------------------+
        |                              |
        v                              v
app/admin features              @rezics/ui components
```

The app/admin shell remains responsible for current-locale state, persistence, routing strategy, and language switching. Message catalogs are split by ownership: app/admin share product/domain translations, while `@rezics/ui` owns only component-internal text. Both catalogs use Paraglide JS generated message functions compiled from JSON source files.

## Goals / Non-Goals

**Goals:**

- Replace frontend `react-i18next` usage with Paraglide JS generated message functions.
- Let app and admin share one product/domain i18n package.
- Let `@rezics/ui` translate its own generic component text without depending on app/admin translation files.
- Keep the active locale as a single app/admin shell state and synchronize it into all frontend i18n runtimes.
- Use official Paraglide/Inlang JSON message files rather than JSON5 or a custom file-format plugin.
- Preserve the canonical five locale codes and fallback behavior.
- Keep `@rezics/ui` portable by removing product/domain translation ownership from reusable UI components.

**Non-Goals:**

- Introducing JSON5, JSONC, YAML, or a custom Inlang plugin.
- Changing the canonical language registry in `@rezics/contract`.
- Translating server responses, email templates, or backend validation errors in this change.
- Redesigning UI components or changing visual design tokens.
- Introducing a third-party UI component library.
- Solving external translation management workflow beyond Paraglide/Inlang-compatible JSON source files.

## Decisions

### Decision 1: Use Paraglide JS as the frontend i18n compiler and runtime

Paraglide compiles JSON message files into tree-shakeable, typed message functions. Components import message functions directly instead of calling `t()` with string keys.

Alternative considered: keep `react-i18next` and introduce a UI-local i18next namespace. This would preserve the existing runtime API but continue to require a runtime translation resolver and would keep `@rezics/ui` tied to `react-i18next`.

### Decision 2: Split product/domain messages from UI component messages

Create a shared app/admin product/domain i18n package, likely `package/i18n`, for feature copy, domain labels, and product workflows. Keep `package/ui` message files scoped to reusable UI component internals only.

Examples owned by `@rezics/ui`:

- `ui.password.show`
- `ui.password.hide`
- `ui.dialog.close`
- `ui.pagination.next`
- `ui.select.no_options`

Examples owned by product/domain i18n:

- `auth.login.title`
- `book.detail.metadata`
- `content_rating.general`
- `attribution.credit.author`
- `search.scope.book`

Alternative considered: put all messages in the app/admin i18n package. This makes UI consumers pass labels or wrappers for every reusable component, which weakens UI package portability.

### Decision 3: App/admin own the active locale and synchronize package runtimes

Each Paraglide output has its own runtime. App/admin language switching SHALL update the shared product/domain runtime and the UI runtime from one shell-level locale state.

Implementation shape:

```ts
setProductLocale(locale, { reload: false });
setUiLocale(locale, { reload: false });
```

The concrete helper can live in the app/admin shell or the shared i18n package. The important boundary is that `@rezics/ui` does not independently infer locale from URL, cookie, or localStorage.

Alternative considered: let `@rezics/ui` auto-detect locale. This risks mismatches where app/admin render one language while UI components render another.

### Decision 4: Use official JSON message files

Language source files SHALL be JSON files accepted by the official Paraglide/Inlang plugin path. JSON5 is not part of this change.

Alternative considered: JSON5 with a custom Inlang plugin. This would allow comments but would add plugin maintenance and increase risk for Sherlock/Fink/CLI compatibility. The project can revisit a metadata or custom format later if translation context becomes painful.

### Decision 5: Keep contract as the language registry, not the UI message dependency

`@rezics/contract` continues to define canonical language codes and language metadata. `@rezics/ui` can align with those locale codes at package integration boundaries, but reusable UI components SHALL NOT import contract domain registries or DTOs to translate generic component text.

Alternative considered: continue importing contract types/enums in UI components. This keeps the UI package coupled to Rezics product semantics and works against multi-project reuse.

## Risks / Trade-offs

- Runtime synchronization bugs -> Centralize language switching in one helper and add tests that verify app/admin and UI runtimes render the same active locale after a language change.
- Large migration surface -> Migrate package by package and keep the change as an internal clear cutover rather than supporting both `react-i18next` and Paraglide long term.
- Dynamic message lookup can harm tree-shaking -> Prefer direct message imports or explicit message maps over dynamic string-key access.
- Missing JSON comments/context -> Use clear key naming and, if needed, add adjacent metadata documentation later without blocking the official JSON path.
- Multiple Paraglide runtimes can reload unexpectedly -> Use `{ reload: false }` where locale updates happen inside an already-running SPA shell, and centralize any intentional full-page reload behavior.
- Storybook stories may need i18n setup -> Add Storybook decorators or preview setup for both product/domain and UI message runtimes where stories render translated components.

## Migration Plan

1. Add Paraglide configuration for the shared product/domain i18n package and for `package/ui`.
2. Convert existing app locale modules to JSON message files while preserving canonical locale codes.
3. Add generated Paraglide exports and package subpath exports for product/domain messages, product/domain runtime, UI messages, and UI runtime.
4. Add a shell-level language helper that sets the active locale in both runtimes.
5. Migrate app/admin providers and language toggles to the Paraglide runtime.
6. Replace `useTranslation()` and `t()` callsites with generated message functions.
7. Move generic UI component text into the UI message catalog and remove `react-i18next` imports from `package/ui`.
8. Move product/domain labels out of `package/ui` or provide domain adapter wrappers outside the portable UI surface.
9. Remove `i18next` and `react-i18next` dependencies once no callsites remain.
10. Run formatting, convention checks, targeted tests, and Storybook smoke checks for translated UI components.

Rollback is expected to happen by reverting this change during development. The migration is intentionally a clear internal cutover, not a dual-runtime compatibility layer.

## Open Questions

- Should the shared product/domain package be named `@rezics/i18n`, `@rezics/app-i18n`, or another scoped name?
- Should `@rezics/ui` expose its i18n runtime as `@rezics/ui/i18n/runtime` or through a narrower helper such as `@rezics/ui/i18n`?
- Which package should own the final shell-level `setRezicsLocale()` helper: `package/i18n`, `package/app`, or a shared frontend utilities package?
