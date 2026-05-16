## Status: Locked

This change is locked at proposal/design time and is NOT scheduled for implementation. See `tasks.md` §0 for the lock rationale and unlock criteria. Treat this document and the spec under `specs/api-unit-store/` as decisions captured for the future implementation.

## Context

`@rezics/api` currently exposes domain API clients, TanStack Query keys, and query option factories. This works well for document-shaped cache entries, but overlapping unit-id queries do not naturally share entity bodies. For example, two book id subsets with two overlapping ids create two query results even though the same `BookDTO` instances should be reusable by `unitId`.

Rezics also has a domain concept named "entity", so this change uses the name **Api Unit Store** for the normalized API client read model. The store is API-owned and is derived from the same TanStack `QueryClient` that the app/admin providers already create.

Target data flow:

```txt
React app/admin
  useBooksByIds(ids)
        |
        v
@rezics/api domain hook
        |
        v
Api Unit Store collection
        |
        v
TanStack DB Query Collection
        |
        v
TanStack Query queryFn / invalidation / staleTime
        |
        v
domain API client
```

## Goals / Non-Goals

**Goals:**

- Provide a normalized, unit-id-addressable read model for unit-backed DTOs in `@rezics/api`.
- Reuse already-loaded unit DTOs across overlapping id-subset queries.
- Keep TanStack Query as the source of network execution, retry, freshness, background refetch, and invalidation behavior.
- Expose domain hooks that feel like existing TanStack Query hooks and hide TanStack DB composition from `package/app` and `package/admin`.
- Preserve caller-provided id order for id-subset hooks.
- Define mutation synchronization rules for full DTO success responses and related query invalidation.

**Non-Goals:**

- Do not introduce IndexedDB, local persistence, offline-first sync, RxDB, PowerSync, or Electric.
- Do not implement optimistic mutation flows in this change.
- Do not replace all existing TanStack Query callsites.
- Do not infer complex search, pagination, or filtered list membership from local cached units.
- Do not use `db` or `entityStore` naming for this capability.

## Decisions

### Use `apiUnitStore` Naming

The public concept is **Api Unit Store**. Code should use names such as `apiUnitStore`, `unitStore`, `createApiUnitStore`, and `package/api/src/unit-store/`.

Alternatives considered:

- `db`: rejected because it is too broad and unclear.
- `entityStore`: rejected because `entity` has a specific rezics domain meaning.
- `collectionStore`: rejected because it names the implementation rather than the API role.

### Build Store Instances From QueryClient

The store is constructed from an existing TanStack `QueryClient`:

```ts
const queryClient = createQueryClient()
const apiUnitStore = createApiUnitStore(queryClient)
```

This avoids module-level singleton collections and keeps app, admin, Storybook, and tests isolated.

### Use TanStack DB Query Collection For Phase 1

Each domain collection uses TanStack DB Query Collection in `syncMode: "on-demand"`. The collection receives live query subset options from TanStack DB and delegates network work to TanStack Query.

TanStack DB does not currently turn overlapping `inArray(unitId, ids)` predicates into a missing-id delta before calling `queryFn`. The shared id-subset loader will therefore inspect the current collection state, fetch only missing ids, and return cached plus fetched units to TanStack DB.

### Provide A Shared Id-Subset Collection Factory

`package/api/src/unit-store/id-subset-collection.ts` will implement the generic pattern:

- extract `unitId eq` and `unitId in` predicates from TanStack DB load subset options
- read matching cached units from the collection
- call the domain `fetchByIds(missingIds)` only for missing ids
- return results in requested id order
- provide shared hook/result helpers

Domain adapters stay thin:

```txt
package/api/src/book/book.collection.ts
package/api/src/post/post.collection.ts
package/api/src/tag/tag.collection.ts
package/api/src/shelf/shelf.collection.ts
```

### Implement Domains Where Server Already Exposes `ids`

Adapters are only introduced for domains that already use `listGetQueryBase` / `listPostBodyBase` (i.e. expose `POST /{resource}/list { ids }`). At the time of this design that means `book`, `post`, `tag`, `shelf`, `realm`, `unit`, `entity`, `chapter`, `feedback`, `notification`, `dm`, `user`. Domains without an `ids` endpoint (e.g. `link`) are silently skipped — this change does not introduce new server endpoints.

### Normalize Subset QueryKey And Chunk Transparently

The id-subset query key MUST be derived from a sorted-and-deduplicated id list before being handed to TanStack Query, so two concurrent overlapping callers collapse into one in-flight network request.

When a caller requests more than `listPostBodyBase`'s `MAX_IDS` (currently 200), the adapter MUST chunk internally and merge results. The hook surface MUST NOT leak this limit.

### Partial Response Shape

When the server omits an id from the response (filtered by visibility, deleted, or unauthorized), the hook returns the available DTOs in caller order and exposes the absent ids via `missingIds: string[]`. The `data` array MUST NOT contain `undefined` holes.

### Prefer Domain Hooks Over Direct React DB Usage

`package/app` and `package/admin` should consume domain hooks such as `useBooksByIds(ids)` rather than importing `useLiveQuery` for normal unit-id reads.

The default hook result shape should align with TanStack Query ergonomics:

```ts
{
  data,
  isLoading,
  isError,
  error,
  isReady,
  refetch,
  missingIds, // ids the server did not return (filtered / deleted / unauthorized)
}
```

Advanced TanStack DB primitives may remain available inside `@rezics/api` for specialized API-layer composition, but app feature code should not need them for common reads.

This is enforced by a `check:convention` rule (R10) that bans direct imports of `@tanstack/react-db` and `@tanstack/query-db-collection` from `package/app/**` and `package/admin/**`. Only `package/api/**` may consume those packages.

### Detail Reads Also Go Through The Unit Store

For each migrated domain, the standalone detail hook (`useBookDetail(id)`, `usePostDetail(id)`, …) MUST become a thin wrapper over a single-id Unit Store read. The legacy `<domain>Keys.detail` queryKey is retired for migrated domains — there is no parallel detail read path during or after migration. A domain that cannot finish detail migration in one go is excluded from the first batch.

Rationale: keeping `setQueryData(<domain>Keys.detail, dto)` alive after the Unit Store lands turns the mutation write site into a permanently dual-write API. The cleaner end state is a single write path (`collection.utils.writeUpsert`) and a single read path (Unit Store). The migration cost is per domain, not per callsite, so this is bounded.

### Refetch Semantics

The `refetch` returned from domain hooks is equivalent to `queryClient.invalidateQueries({ queryKey: <subset queryKey> })`. We do NOT expose TanStack DB Query Collection's own `refetch` to consumers. This keeps invalidation, retry, and staleTime behavior anchored in one place (TanStack Query) and avoids consumers learning two refresh APIs.

### Preserve Id Order

Id-subset hooks must return units ordered by the caller-provided ids. TanStack DB live query output order is not treated as authoritative for id-subset reads.

### Error Handling

The Unit Store will map TanStack DB collection errors to the API hook result shape. UI code should not depend directly on `collection.utils.errorCount`, `lastError`, or collection internals.

Suspense hooks are out of scope for the first pass. Non-suspense hooks must expose error state explicitly.

### Mutation Synchronization And Stale-Refetch Race

TanStack DB's Query Collection docs explicitly acknowledge the race:

> "Direct writes update the collection immediately and also update the TanStack Query cache. However, they do not prevent the normal query sync behavior. If your queryFn returns data that conflicts with your direct writes, the query data will take precedence."
> — Query Collection docs

There is no built-in version/timestamp arbitration. Without intervention, an already-in-flight subset refetch that resolves AFTER a mutation's `writeUpsert` will overwrite the fresh DTO with stale server state.

The canonical mitigation borrows from TanStack Query's optimistic-update pattern: cancel in-flight subset queries that could contain the mutated id BEFORE writing, then suppress the post-handler automatic refetch.

```ts
// Inside the mutation's onSuccess / persistence handler:
await queryClient.cancelQueries({ queryKey: bookCollectionKeyPrefix })
bookCollection.utils.writeBatch(() => {
  bookCollection.utils.writeUpsert(freshDTO)
})
// list / aggregate / search side effects:
queryClient.invalidateQueries({ queryKey: bookKeys.lists() })
return { refetch: false } // skip the QueryCollection auto-refetch
```

Rules:

- **Full authoritative DTO response**: cancelQueries → writeUpsert → return `{ refetch: false }` → invalidate only the affected list / aggregate / search keys.
- **Partial or non-authoritative response**: cancelQueries → invalidate the affected subset and let TanStack Query refetch fresh data; do NOT writeUpsert.
- **Cross-domain effects** (e.g. book update affects a realm aggregate): explicitly invalidate the affected list/aggregate queryKey in the same mutation. The Unit Store does not infer cross-domain consequences.
- **Legacy `setQueryData(<domain>Keys.detail, dto)` is removed** in the same step that migrates the detail read path (see "Detail Reads Also Go Through The Unit Store"). Mutations migrated to Unit Store must not retain the legacy detail write.

Optimistic mutation flows remain out of scope; the cancel + writeUpsert path is forward-compatible with TanStack DB optimistic transactions when they are introduced.

If a future scenario emerges where stale writes still slip through (e.g. WebSocket-driven background updates, server-streamed mutations from other clients), the upgrade path is to add a `version` / `updatedAt` field to DTOs and compare in the shared id-subset loader before merging. This is explicitly future work.

### StaleTime

The Unit Store uses TanStack Query `staleTime`. Domain adapters may use existing domain defaults. This change does not introduce a separate TTL concept.

### Memory Footprint, Eviction, And Auth Reset

TanStack DB does NOT currently support max-cache-size, size-based eviction, or per-row gcTime — confirmed in TanStack/db Issue #865 ("We are intending to work on persistence after v1 of DB."). TanStack Query's `gcTime` only collects the underlying queryFn cache; collection rows persist independently.

Phase 1 accepts unbounded growth in long sessions but provides explicit escape hatches:

- `<store>.<domain>.evict(ids: string[])` removes specific rows.
- `<store>.reset()` clears all collections.
- `AuthProvider` calls `<store>.reset()` automatically when viewer or permission scope changes — DTOs may be permission-scoped and must not leak across identities.
- `<store>.utils.size()` (dev-only) exposes row counts for observability.

If TanStack DB ships eviction in a later version, swap the manual API for the native one in a follow-up OpenSpec change.

### Removing `attachPersistence`

`package/api/src/react-query/persist.ts` (and its two `@tanstack/query-sync-storage-persister` / `@tanstack/react-query-persist-client` dependencies) are unused. Persistence is conceptually owned by the Unit Store going forward (and is itself deferred until TanStack DB ships v1+ persistence). The persist file and deps are removed in task 1.5 to avoid leaving a misleading API behind.

## Risks / Trade-offs

- TanStack DB is beta (react-db at 0.1.x) → keep integration behind `@rezics/api` wrappers (R10) and revisit on v1+. The blog claims auto-delta/auto-collapse but the docs and RFC #676 confirm the framework today does not deduplicate already-loaded ids — adapter logic owns that.
- Missing-id delta loading is custom adapter logic → centralize it in one shared factory and test overlap cases.
- Full DTO success responses can become over-trusted → require list/search/aggregate invalidation when mutation side effects are broader than the returned DTO.
- Existing mutation invalidation keys may not match new collection keys → add domain mutation tasks to upsert or invalidate Unit Store collections explicitly.
- Id-subset order differs from TanStack DB raw output → always sort by requested ids in hook helpers.
- Store instances could accidentally become singletons → require construction from `QueryClient` and test isolated clients.
- Stale subset refetch overwriting a fresh mutation result → mitigated by the cancelQueries + writeUpsert + refetch:false pattern in the Mutation section; if external (non-mutation) update sources appear later, escalate to a per-DTO version field.
- Memory growth unbounded (no built-in eviction in TanStack DB) → provide `evict` / `reset` utils and auto-reset on auth change; defer real eviction to TanStack DB v1+.
- "Total" and other envelope fields from `/list` endpoints → adapter unwraps `{ books, total }` etc. and only feeds the DTO array into the collection; tests guard against accidental envelope leakage.

## Migration Plan

1. Add TanStack DB dependencies and the `unit-store` infrastructure to `package/api`.
2. Implement all first-pass domain collections for unit-backed DTOs with id-based list/detail APIs.
3. Add domain hooks and tests for id overlap, order preservation, errors, and QueryClient isolation.
4. Update mutation success/invalidation paths for migrated domains.
5. Migrate high-value hydration paths first, especially shelf/unit composition and repeated detail reads.
6. Migrate app/admin consumers incrementally while keeping existing query options available.

Rollback strategy:

- Existing TanStack Query APIs remain in place.
- If a migrated hook causes issues, the feature can return to existing query option factories without server changes.
- TanStack DB usage remains confined to `@rezics/api`, limiting rollback scope.

## Open Questions

- Should `unit` itself be a collection (acting as the join base for projected domain views), or should concrete domain collections remain the only public hooks? Decision deferred until first-batch domains are working.
- For domains whose `/list` endpoint applies viewer-scope filtering (e.g. book's `status=PUBLISHED, visibility=PUBLIC` for non-admins), is the Unit Store's "missing in response" signal sufficient, or do we need an explicit "not accessible" reason? Likely fine for phase 1 but worth re-evaluating during book migration.

