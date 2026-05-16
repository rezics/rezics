## Why

The API client currently caches server state by TanStack Query document keys, so overlapping unit-id queries cannot consistently reuse already-loaded unit DTOs across lists, detail views, hydration helpers, and future local cache work. Introducing an API-owned Unit Store gives `@rezics/api` a normalized, unit-id-addressable read model while keeping TanStack Query responsible for network execution, freshness, retries, and invalidation.

This is needed now because book, post, tag, shelf, and related unit surfaces increasingly compose the same units through different query shapes, and duplicate entity-body fetching will become more expensive as the client adds richer list and hydration workflows.

## What Changes

- Add an `api-unit-store` capability implemented in `package/api`.
- Introduce TanStack DB as the normalized collection layer for unit DTOs.
- Add `package/api/src/unit-store/` infrastructure for reusable id-subset loading, shared result ordering, shared error mapping, and store construction from an existing TanStack `QueryClient`.
- Add domain-local collection adapters for unit-backed API domains, starting with book, post, tag, shelf, realm, link, and other first-class unit DTOs where list/detail APIs support id-based loading.
- Expose domain React hooks from `@rezics/api` such as `useBooksByIds(ids)` instead of requiring app packages to compose `useLiveQuery` directly.
- Preserve existing TanStack Query APIs during migration; this change is additive and does not remove existing query option factories or hooks.
- Add mutation synchronization conventions so full DTO mutation responses update the Unit Store, while list membership, ordering, aggregate, permission, and search effects still invalidate the relevant TanStack Query keys.
- Defer optimistic mutation workflows and IndexedDB/local persistence to later changes.

## Capabilities

### New Capabilities

- `api-unit-store`: Defines the API package's TanStack DB-backed Unit Store, id-subset reuse behavior, React hook surface, error model, ordering guarantees, and mutation synchronization policy.

### Modified Capabilities

- None.

## Impact

- Affected packages:
  - `package/api`: Adds TanStack DB dependencies, Unit Store infrastructure, domain-local collections, domain hooks, tests, and mutation synchronization helpers.
  - `package/app`: Can migrate unit-id hydration and detail/list composition workflows to the new `@rezics/api` hooks over time.
  - `package/admin`: Can opt into the same store for admin unit surfaces when useful, using its own `QueryClient` instance.
- Dependencies:
  - Adds `@tanstack/react-db` and `@tanstack/query-db-collection` to `@rezics/api`.
- Compatibility:
  - Existing TanStack Query keys and query option factories remain available.
  - Existing pages continue to work until they are explicitly migrated.
  - No IndexedDB, offline-first behavior, or optimistic mutation behavior is introduced in this change.
- Migration:
  - Migrate high-value id hydration paths first, then domain detail/list consumers where the Unit Store reduces duplicate entity-body fetching.
  - Mutation code must be updated when a migrated domain writes unit DTOs so the Unit Store and existing query invalidation stay consistent.

