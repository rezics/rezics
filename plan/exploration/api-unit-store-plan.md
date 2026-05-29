# Api Unit Store Plan

This plan condenses `introduce-api-unit-store` into a short future implementation
plan. This direction is **not scheduled for implementation yet**. The original
change is locked and should only be revisited after TanStack DB becomes more
stable or duplicate DTO fetching becomes a measurable cost.

---

## 1. Background

`@rezics/api` currently relies on TanStack Query query keys to cache server
state. That works well for document-shaped query results, but it does not
naturally reuse DTO bodies by `unitId`. Different lists, detail views, and
hydration helpers can each hold their own document cache entry even when they
contain the same unit.

Api Unit Store adds a normalized read model inside `@rezics/api`:

- Read and write DTOs by `unitId`.
- Reuse already-loaded unit DTOs.
- Keep network execution, retry, freshness, and invalidation in TanStack Query.
- Keep `package/app` and `package/admin` away from direct TanStack DB usage.

---

## 2. Goals And Non-Goals

### Goals

- Add `createApiUnitStore(queryClient)` in `package/api`.
- Use TanStack DB Query Collection for unit-backed DTO collections.
- Expose domain hooks such as `useBooksByIds(ids)` and `usePostsByIds(ids)`.
- Reuse overlapping id-subsets and fetch only missing ids.
- Preserve caller-provided id order.
- Synchronize successful mutations that return complete DTOs into the Unit Store.
- Require app/admin consumers to use `@rezics/api` wrappers instead of importing
  TanStack DB directly.

### Non-Goals

- Do not introduce IndexedDB, offline-first behavior, or local persistence.
- Do not implement optimistic mutations.
- Do not replace all existing TanStack Query callsites in one pass.
- Do not infer complex search, pagination, ordering, permission, or aggregate
  results from local cached units.
- Do not add server endpoints; only support domains that already expose id-based
  list APIs.

---

## 3. Approach

### Store Construction

Api Unit Store is created from the existing `QueryClient`. It must not use
module-level singleton collections:

```ts
const queryClient = createQueryClient()
const apiUnitStore = createApiUnitStore(queryClient)
```

This keeps app, admin, Storybook, and tests isolated from one another.

### Id-Subset Collection

Add shared id-subset infrastructure under `package/api/src/unit-store/`:

- Parse `unitId eq` and `unitId in` predicates.
- Read already-present DTOs from the current collection.
- Call the domain `fetchByIds` only for missing ids.
- Sort and dedupe ids before deriving query keys so identical subsets share
  in-flight queries.
- Chunk internally when the caller exceeds the server `MAX_IDS`; the hook API
  does not expose that limit.
- Put ids omitted by the server into `missingIds`; do not put `undefined` holes
  in `data`.

### Domain Adapters

Each supported domain owns a thin adapter in `package/api`, for example:

- `book.collection.ts`
- `post.collection.ts`
- `tag.collection.ts`
- `shelf.collection.ts`
- `realm.collection.ts`

The first batch should include only domains that already support
`POST /{resource}/list { ids }` and return complete DTOs. Domains without an ids
endpoint are skipped.

### Hook Surface

Expose API-style hook results to app/admin:

```ts
{
  data,
  isLoading,
  isError,
  error,
  isReady,
  refetch,
  missingIds,
}
```

`refetch` should be equivalent to `queryClient.invalidateQueries(...)`. Do not
expose TanStack DB collection-level refetch behavior to consumers.

### Detail Read Cutover

For each migrated domain, detail hooks become single-id Unit Store reads. The
same domain should not keep a parallel `<domain>Keys.detail` read path, and it
should not keep legacy `queryClient.setQueryData(<domain>Keys.detail, dto)`
dual-writes.

### Mutation Sync

When a mutation returns a complete authoritative DTO:

1. Call `queryClient.cancelQueries(...)` first so an in-flight stale refetch
   cannot overwrite the fresh mutation result.
2. Write the DTO with `collection.utils.writeUpsert(dto)`.
3. Return `{ refetch: false }` to skip Query Collection's automatic refetch.
4. Invalidate query keys for membership, ordering, aggregates, permissions,
   visibility, or search results that may have changed.

If the mutation response is partial or not authoritative, invalidate instead of
writing to the Unit Store.

---

## 4. Implementation Steps

- [ ] Before unlocking, re-check TanStack DB version, Query Collection semantics,
      and known gaps.
- [ ] Add the `unit-store/` skeleton and `createApiUnitStore(queryClient)` in
      `package/api`.
- [ ] Implement the shared id-subset collection factory: missing-id loading,
      order preservation, query key normalization, chunking, and `missingIds`.
- [ ] Add first-batch domain collection adapters; likely candidates are book,
      post, tag, shelf, and realm.
- [ ] Expose domain hooks so app/admin do not need direct TanStack DB usage.
- [ ] Convert migrated domain detail reads to single-id Unit Store reads.
- [ ] Update migrated domain mutations: complete DTOs use cancel + upsert +
      targeted invalidation; incomplete responses only invalidate.
- [ ] Add store reset, per-domain evict, and dev-only size observability.
- [ ] Add a `check:convention` rule that forbids direct imports of
      `@tanstack/react-db` and `@tanstack/query-db-collection` from
      `package/app/**` and `package/admin/**`.
- [ ] Migrate selected high-value hydration/detail duplicate-read paths.

---

## 5. Validation

- [ ] `package/api` Unit Store tests: overlap reuse, identical subsets, order,
      query key collapse, chunking, partial response, and isolated QueryClient.
- [ ] Domain adapter tests: id filter translation, envelope unwrap, and
      detail-via-store behavior.
- [ ] Mutation tests: cancel-before-write, full DTO upsert, partial response
      invalidation, and stale in-flight refetch not overwriting a fresh DTO.
- [ ] `bunx tsc -p package/api/tsconfig.json --noEmit`.
- [ ] `bun run check:convention`.
- [ ] `openspec validate introduce-api-unit-store --strict`.

---

## 6. Risks And Unlock Criteria

### Main Risks

- TanStack DB is still beta-leaning, and overlap delta, eviction, direct writes,
  and refetch precedence may change.
- Id-subset missing-id loading is custom logic and must stay centralized and
  well tested.
- Memory has no size-based eviction today, so phase one relies on `evict` and
  `reset`.
- Complete DTO mutation writes must protect against stale in-flight refetches
  overwriting fresh data.
- Once detail reads are cut over for a domain, the domain should not keep a
  legacy detail cache path in parallel.

### Unlock Criteria

Revisit implementation when any one of these is true:

- TanStack DB v1 ships with stable Query Collection semantics for subsets,
  eviction, and write/refetch behavior.
- Production data or profiling shows duplicate unit DTO fetching is a real cost.
- A small book + post spike proves overlap reuse and mutation sync are reliable.

