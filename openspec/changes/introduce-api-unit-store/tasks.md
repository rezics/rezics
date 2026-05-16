## 0. Status: LOCKED — Do Not Apply

- [ ] 0.1 **This change is locked. Do not run `/opsx:apply introduce-api-unit-store` yet.**
- [ ] 0.2 Reasons for lock:
  - `@tanstack/react-db` is still 0.1.x (beta); semantics around overlapping subset deltas, eviction, and direct-write vs in-flight-refetch precedence may shift before v1.
  - The work is a normalization / performance optimization, not a correctness fix; the existing TanStack Query path is acceptable for now.
  - Several decisions captured in design.md (detail-via-store, stale-refetch race, eviction policy) need to be validated by a small spike or by waiting for TanStack DB v1+ before locking implementation.
- [ ] 0.3 Unlock criteria (any one is enough to revisit):
  - TanStack DB ships v1 with documented overlap-delta and write-precedence semantics.
  - A duplicate-fetch hot path becomes measurable in production and the cost of waiting outweighs the cost of integrating a beta dependency.
  - A scoped spike on book + post proves the cancelQueries + direct-write pattern works under our mutation patterns.
- [ ] 0.4 Until unlocked, the proposal, design, and spec are reference material only. The package.json dependency additions for `@tanstack/react-db` and `@tanstack/query-db-collection` have already landed but are unused — that is intentional and acceptable.

## 1. Dependencies And Store Skeleton

- [ ] 1.1 Add `@tanstack/react-db` and `@tanstack/query-db-collection` to `package/api`. (Already applied to package.json; verify versions are still compatible at unlock time.)
- [ ] 1.2 Create `package/api/src/unit-store/` with `createApiUnitStore(queryClient)` and public store types.
- [ ] 1.3 Ensure store construction creates isolated collection instances per `QueryClient`.
- [ ] 1.4 Add root or package exports for the Unit Store without using `db` or `entityStore` naming.
- [ ] 1.5 Remove `package/api/src/react-query/persist.ts` (`attachPersistence`) and drop unused deps `@tanstack/query-sync-storage-persister` and `@tanstack/react-query-persist-client` from `package/api/package.json`. Cache responsibility moves to the Unit Store.

## 2. Shared Id-Subset Infrastructure

- [ ] 2.1 Implement `unit-store/id-subset-collection.ts` for `unitId eq` and `unitId in` load subset parsing.
- [ ] 2.2 Implement missing-id detection against the current TanStack DB collection state.
- [ ] 2.3 Implement result merging and caller-provided id order preservation.
- [ ] 2.4 Implement shared hook result mapping for `data`, `isLoading`, `isError`, `error`, `isReady`, and `refetch`.
- [ ] 2.5 `refetch` SHALL invalidate the subset's TanStack Query keys (`queryClient.invalidateQueries`) rather than calling a Query Collection-level refetch. No separate TanStack DB refresh path is exposed to consumers.
- [ ] 2.6 Normalize id-subset query keys (sort + dedupe) before constructing the queryKey so concurrent overlapping callers hit the same in-flight query.
- [ ] 2.7 Transparent chunking: when caller ids exceed the contract `MAX_IDS` (currently 200), the adapter SHALL split into multiple `/list` POSTs internally and merge; the hook API SHALL NOT expose the limit.
- [ ] 2.8 Partial response shape: when a requested id is not returned by the server (filtered, deleted, or not accessible), the hook SHALL drop it from `data` and expose it via a `missingIds: string[]` field. No `undefined` holes.
- [ ] 2.9 Add targeted tests for overlapping subsets, identical fresh subsets, order preservation, normalized queryKey collapsing, chunking above MAX_IDS, partial / missingIds handling, and isolated QueryClient instances.

## 3. Domain Collections And Hooks

- [ ] 3.1 Add domain-local collection adapters for unit-backed domains that already expose `listGetQueryBase` / `listPostBodyBase` (`POST /{resource}/list { ids }`). First-batch candidates: `book`, `post`, `tag`, `shelf`, `realm`. Domains without an `ids` endpoint (e.g. `link` as of writing) SHALL be skipped silently — this change does NOT add new server endpoints.
- [ ] 3.2 Add additional unit-backed domain adapters discovered during implementation if they expose complete DTOs and id-based loading.
- [ ] 3.3 Expose domain hooks such as `useBooksByIds`, `usePostsByIds`, `useTagsByIds`, and `useShelvesByIds` from `@rezics/api`.
- [ ] 3.4 Keep domain fetch translation inside `package/api` adapters rather than in `package/app` or `package/admin`. Each adapter unwraps the `{ books, total }` / `{ posts, total }` envelope into the DTO array fed to the collection.
- [ ] 3.5 Detail reads via the Unit Store: for each migrated domain, replace the standalone detail hook (`useBookDetail(id)` etc.) with a single-id read against the Unit Store. Do NOT keep a parallel `bookDetailQuery` / `bookKeys.detail` read path. If a domain cannot finish detail migration in this change, exclude that domain from the first batch.
- [ ] 3.6 Add tests for each first-pass domain adapter's id filter translation, hook ordering behavior, and detail-via-store equivalence with the previous `useQuery(bookDetailQuery)` callsite.

## 4. Error And Freshness Behavior

- [ ] 4.1 Map TanStack DB Query Collection error state into the shared API hook result shape.
- [ ] 4.2 Add tests showing hook consumers do not need to read `collection.utils` internals for common error UI.
- [ ] 4.3 Ensure domain adapters use TanStack Query `staleTime` rather than introducing a separate TTL concept.
- [ ] 4.4 Add tests or probes proving stale active subset queries refetch through TanStack Query and update the collection.

## 5. Mutation Synchronization

- [ ] 5.1 Add shared helper(s) for writing complete authoritative DTOs into the relevant Unit Store collection after successful mutations.
- [ ] 5.2 Update migrated domain mutations that return full DTOs to use the canonical write-race-safe sequence:
  1. `queryClient.cancelQueries({ queryKey: <subset prefix containing unitId> })` — terminate any already-in-flight subset refetch.
  2. `collection.utils.writeUpsert(dto)` (within `writeBatch` if multiple ids).
  3. Return `{ refetch: false }` from the persistence handler to skip the collection's automatic post-handler refetch.
  4. `queryClient.invalidateQueries({ queryKey: <list / aggregate / search keys whose membership may have changed> })`.
- [ ] 5.3 Remove legacy `queryClient.setQueryData(<domain>Keys.detail, dto)` calls from migrated mutations — they become dead code once detail reads go through the Unit Store (see 3.5). Do NOT keep both write paths.
- [ ] 5.4 Ensure mutations that can affect membership, ordering, aggregates, permissions, visibility, or search still invalidate relevant TanStack Query keys.
- [ ] 5.5 Ensure partial or uncertain mutation responses cancel in-flight subset refetches and invalidate the affected collection or subset (no `writeUpsert` when response is not authoritative).
- [ ] 5.6 Add tests for: full DTO success writes, the cancelQueries-before-write order, list/search invalidation behavior, and a regression test where an in-flight subset request returning stale data does NOT overwrite a freshly mutated DTO.

## 6. Eviction, Reset, And Convention Enforcement

- [ ] 6.1 Expose `<store>.<domain>.evict(ids: string[])` and `<store>.reset()` utilities so consumers can manually free DTOs in long sessions, on logout, or on route boundaries. (TanStack DB has no built-in size-based eviction as of v0.6 — Issue #865 in TanStack/db.)
- [ ] 6.2 Wire `AuthProvider` viewer/permission changes to call `<store>.reset()` automatically — cached DTOs may be permission-scoped and must not leak across identities.
- [ ] 6.3 Provide a dev-only `<store>.utils.size()` (or equivalent) so memory growth is observable during testing.
- [ ] 6.4 Add a `check:convention` rule (proposed name **R10**) that forbids direct imports of `@tanstack/react-db` and `@tanstack/query-db-collection` from `package/app/**` and `package/admin/**`. Only `package/api/**` may import them. Wrappers are the only public surface.
- [ ] 6.5 Add a `check:convention` assertion that no migrated domain retains read callers of `<domain>Keys.detail` after detail-via-store migration (regression guard against parallel read paths).

## 7. Consumer Migration

- [ ] 7.1 Identify high-value duplicate-fetch paths in `package/app`, starting with shelf/unit hydration and repeated detail reads.
- [ ] 7.2 Migrate selected app consumers to the new domain hooks while preserving existing user-visible behavior.
- [ ] 7.3 Migrate selected admin consumers only where the Unit Store provides a clear benefit.
- [ ] 7.4 Use repo-wide search to verify migrated consumers no longer duplicate id-subset hydration logic and no longer read `<domain>Keys.detail` directly.

## 8. Validation

- [ ] 8.1 Run targeted `bun test` coverage for `package/api/src/unit-store` and migrated domain adapters.
- [ ] 8.2 Run `bunx tsc -p package/api/tsconfig.json --noEmit`.
- [ ] 8.3 Run affected app/admin TypeScript checks or builds if consumer code is migrated.
- [ ] 8.4 Run `bun run check:convention` and confirm R10 (and the no-`<domain>Keys.detail`-readers rule) pass.
- [ ] 8.5 Run `openspec validate introduce-api-unit-store --strict`.

