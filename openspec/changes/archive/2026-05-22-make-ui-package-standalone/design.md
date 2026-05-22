## Context

`@rezics/ui` has already separated its component i18n runtime from app/admin product i18n. The remaining portability problem is not product awareness itself: every intended consumer is still a Rezics project, so shared domain vocabulary from `@rezics/contract` is acceptable when it represents stable product semantics.

The problem is app-shell ownership. Current UI package code imports runtime capabilities that belong to a consuming application:

- TanStack Router links and route progress.
- `@rezics/api` search/upload clients.
- App-specific URL navigation behavior.
- Demo/dashboard sections exported from the shadcn barrel.

The target architecture keeps product-related UI in `@rezics/ui` when it is reusable across Rezics projects, but makes navigation, data fetching, upload, search, auth/session, and shell state explicit host capabilities.

```txt
app/admin/folio shell
  owns router, API client, auth, cache, upload, route progress
        |
        | injects adapters / wraps components
        v
@rezics/ui
  owns design system, shadcn primitives, shared UI behavior,
  generic component i18n, and reusable Rezics product presentation
```

## Goals / Non-Goals

**Goals:**

- Make `@rezics/ui` reusable across Rezics projects without requiring a specific router, API client, server package, or app shell.
- Keep `@rezics/ui/shadcn`, `@rezics/ui/uno.config`, and common core exports free of router/API/server imports.
- Preserve Base UI as the shadcn primitive foundation.
- Allow `@rezics/contract` as shared Rezics vocabulary while reducing unnecessary contract imports.
- Convert router/API-backed UI behavior to injected host capabilities.
- Add convention checks so the dependency boundary does not regress.

**Non-Goals:**

- Turning `@rezics/ui` into a generic non-Rezics UI kit.
- Removing all `@rezics/contract` imports from `@rezics/ui`.
- Redesigning components or changing visual design tokens.
- Replacing the editor package or changing editor core behavior.
- Changing the Paraglide/i18n architecture completed by `replace-i18n-with-paraglide`.

## Decisions

### Decision 1: Treat `@rezics/ui` as Rezics ecosystem UI, not generic UI

`@rezics/ui` MAY contain product-aware components when those components are useful across Rezics projects. Product-aware does not mean app-bound: reusable UI can understand Rezics domain vocabulary, but it SHALL NOT own runtime capabilities such as navigation, fetching, uploading, auth, cache, or route progress.

Alternative considered: remove all product components from `@rezics/ui`. Rejected because the consumers are Rezics projects and would otherwise duplicate shared presentation components.

### Decision 2: Dependency tiers define what can be imported where

`@rezics/ui` dependencies fall into tiers:

| Tier | Policy |
|---|---|
| Design/runtime foundation | React, Base UI, shadcn-derived code, UnoCSS, icons, and UI-local helper libraries are allowed. |
| Shared Rezics vocabulary | `@rezics/contract` is allowed for stable domain vocabulary, preferably as type-only imports or enum/constant-level usage. |
| Host capabilities | Router, API client, auth/session, upload, search, cache, route progress, and app/admin internals are injected or wrapped by the host. |
| Server/runtime internals | `@rezics/server` and app/admin feature internals are not UI package dependencies. |

Alternative considered: rely on bundler tree-shaking to hide unused router/API code. Rejected because the package boundary would remain unclear, external consumers would still need incompatible dependencies installed, and accidental imports could break otherwise portable entrypoints.

### Decision 3: Host capability injection is the default pattern

Components that need application-owned behavior SHALL accept explicit adapters through props, context, or app-owned wrappers.

Examples:

```ts
type LinkRenderer = (props: {
  href: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) => React.ReactNode;

type UserSearchAdapter<User> = (query: string) => Promise<User[]>;

type ImageUploadAdapter = (file: File) => Promise<{ url: string; alt?: string }>;
```

The concrete shape can vary by component, but the dependency direction is stable: app/admin imports API/router and passes behavior down; `@rezics/ui` does not import API/router for core surfaces.

Alternative considered: create a separate `@rezics/ui-...` adapter package. Rejected for now because the intended consumers install `@rezics/ui` as the Rezics UI package, and explicit subpaths/wrappers are enough.

### Decision 4: Keep shadcn barrel pure

`@rezics/ui/shadcn` is the primitive re-export surface. It SHALL NOT re-export demo dashboards, product sections, or examples that import `@rezics/contract` or app-specific behavior. Demo sections can remain in source for Storybook or documentation, but must be behind explicit non-core paths.

Alternative considered: keep the current barrel and trust consumers to import only named primitives. Rejected because barrel imports and generated dependency graphs can still pull unrelated code into the consumer's type and bundling surface.

### Decision 5: Router-specific components become app-owned or adapter-only

Primitive `Link`, `TextLink`, `SafeLink`, and `GlobalProgressBar` currently couple shared UI to TanStack Router. This change moves router-specific behavior into app/admin wrappers or explicit adapter entrypoints.

For safe external-link handling, `@rezics/ui` can keep URL classification and modal behavior, but app-route rendering must be host-provided.

Alternative considered: keep TanStack Router as a peer dependency. Rejected for core exports because it still forces every Rezics UI consumer to share the same router integration.

### Decision 6: API-backed editor affordances use injected sources

Mention search and image upload are reusable UI affordances, but their data sources belong to app/admin. `RezicsMarkdownEditor` and related providers SHALL accept user search and upload adapters instead of importing `@rezics/api`.

Alternative considered: move the whole editor wrapper out of `@rezics/ui`. Rejected because the editor presentation is shared UI; only the data source needs to be injected.

## Risks / Trade-offs

- Adapter APIs can become inconsistent across components -> Define small named adapter types and reuse them where possible.
- Refactoring imports can touch many app/admin files -> Use a clear internal cutover and keep compatibility wrappers only where they reduce churn without hiding the new boundary.
- Contract usage can creep back into behavior helpers -> Add convention checks and review guidance distinguishing shared vocabulary from app policy.
- Storybook examples may lose easy mock behavior -> Provide local mock adapters in stories.
- SafeLink behavior can regress for app routes -> Add tests for external, rezics, blocked, and injected app-route rendering.

## Migration Plan

1. Inventory `package/ui/src` imports from `@tanstack/react-router`, `@rezics/api`, `@rezics/server`, and `@rezics/contract`.
2. Classify each component as core reusable, product-aware reusable, router-adapted, editor-adapted, or app-owned wrapper.
3. Remove demo/product sections from the main `@rezics/ui/shadcn` barrel.
4. Introduce host adapter types for link rendering, mention search, and image upload.
5. Refactor `SafeLink`, primitive link exports, route progress, mention search, and upload providers to use host adapters or app-owned wrappers.
6. Update app/admin imports and wrappers to provide TanStack Router and `@rezics/api` implementations.
7. Review `@rezics/contract` imports and remove low-value dependencies such as defaults that can be props or local constants.
8. Update package dependency declarations.
9. Add convention checks for forbidden imports in core UI surfaces.
10. Run format, convention checks, type/build checks, and Storybook smoke checks.

Rollback is expected to be a development-stage revert of this change. No long-term dual API is required unless a compatibility wrapper is explicitly kept for migration ergonomics.

## Open Questions

- Should router adapter exports live under `@rezics/ui/router` for shared adapter types only, or should all concrete TanStack wrappers live in app/admin?
- Should editor API adapters be props on `RezicsMarkdownEditor`, context providers, or both?
- Which current product-aware components should remain in root exports after the boundary is tightened?
