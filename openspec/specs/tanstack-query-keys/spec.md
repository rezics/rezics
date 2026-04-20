## ADDED Requirements

### Requirement: Query keys come from per-domain factories

Every interactive TanStack Query `queryKey` in the frontend (`package/app`, `package/admin`, `package/ui`) SHALL be produced by a key factory module at `package/api/src/<domain>/<domain>.keys.ts`. Components, pages, hooks, and selectors SHALL NOT write `queryKey: [...]` literals inline. The only files permitted to construct key arrays are the `.keys.ts` factory files themselves and the adjacent `.queries.ts` / `.mutations.ts` files that wrap `useQuery` / `queryOptions` / `useMutation`.

#### Scenario: Factory is the source of a component-used key
- **WHEN** a component uses a query via a hook from `@rezics/api`
- **THEN** the `queryKey` SHALL originate from a factory function in `package/api/src/<domain>/<domain>.keys.ts`
- **AND** the component SHALL NOT contain a `queryKey: [` literal

#### Scenario: New domain gains a key factory
- **WHEN** a new frontend-visible domain is introduced (e.g., tag, realm)
- **THEN** a `<domain>.keys.ts` file SHALL be created in `package/api/src/<domain>/` before any `useQuery` hook is written for that domain
- **AND** the factory SHALL export an object with hierarchical keys following the `all() / lists() / list(filters) / details() / detail(id)` pattern

### Requirement: Filter parameters are embedded in the key array

When a key factory function accepts parameters that vary the server response (for example `kind`, `limit`, `cursor`, `sort`, `searchTerm`, or a filters object), the factory SHALL embed those parameters into the returned key array. A factory SHALL NOT accept response-varying parameters that are silently consumed and omitted from the key.

#### Scenario: Post by-target factory includes filters
- **WHEN** `postKeys.byTarget(bookUnitId, { kind: PostKind.REVIEW, limit: 20 })` is called
- **THEN** the returned key SHALL include both the `targetUnitId` and the filters object (as a serializable literal or `null` when filters are absent)
- **AND** a subsequent call with `{ kind: PostKind.REMARK, limit: 20 }` SHALL produce a non-equal key
- **AND** the two calls SHALL NOT share a cache entry

#### Scenario: Filter-bearing list factories are filter-aware
- **WHEN** any factory function takes filter parameters (kind, limit, cursor, sort, search term, or filters object)
- **THEN** those parameters SHALL appear in the returned key array in a deterministic position
- **AND** omitting a filter SHALL produce a deterministic shape (e.g., trailing `null` rather than an absent slot)

### Requirement: Array parameters in keys are normalized

When a key contains a parameter that is a collection of identifiers (for example `targetIds` for a batch query), the factory SHALL normalize the collection before placing it in the key: duplicates SHALL be removed and the order SHALL be deterministic (e.g., lexicographic sort). Two factory calls with the same set of identifiers SHALL produce identical keys regardless of input order or duplication.

#### Scenario: Batch reaction summary key is order-stable
- **GIVEN** `reactionKeys.summaryBatch(["b", "a", "a"])` and `reactionKeys.summaryBatch(["a", "b"])`
- **WHEN** both keys are compared
- **THEN** they SHALL be structurally equal
- **AND** TanStack Query SHALL treat them as the same cache entry

#### Scenario: Empty array is handled deterministically
- **WHEN** a factory receives an empty array for a collection parameter
- **THEN** the key SHALL contain a normalized empty-array sentinel (e.g., `[]`) in the expected position
- **AND** the returned key SHALL remain deterministic

### Requirement: Batch reaction summary has a dedicated factory and hook

A `reactionKeys.summaryBatch(targetIds)` factory SHALL exist in `package/api/src/reaction/reaction.keys.ts` and a corresponding `useBatchReactionSummary(targetIds, options?)` hook SHALL exist in `package/api/src/reaction/reaction.queries.ts`. The scalar `reactionKeys.summary(targetId)` and batch `reactionKeys.summaryBatch(targetIds)` SHALL share the `["reactions", "summary", ...]` prefix so that invalidation via `reactionKeys.summaries()` affects both.

#### Scenario: Components consume the batch hook
- **WHEN** a page needs reaction summaries for multiple targets (e.g., a review list, a shelf view)
- **THEN** it SHALL call `useBatchReactionSummary(targetIds)` rather than writing a `queryKey: ["reaction-summary-batch", …]` literal

#### Scenario: Invalidation reaches both scalar and batch entries
- **WHEN** a reaction mutation succeeds
- **THEN** calling `queryClient.invalidateQueries({ queryKey: reactionKeys.summaries() })` SHALL invalidate both scalar `summary(targetId)` entries and batch `summaryBatch(targetIds)` entries

### Requirement: Convention check forbids inline queryKey literals

`bun run check:convention` SHALL fail when the pattern `queryKey: [` appears in any file under `package/app/`, `package/admin/`, or `package/ui/`. The check SHALL allow the pattern only in files under `package/api/src/**/*.{keys,queries,mutations}.ts`. The failure message SHALL cite the offending file and line and SHALL suggest migrating to a per-domain factory.

#### Scenario: Inline queryKey in a page fails the check
- **GIVEN** a file `package/app/src/review/pages/ReviewsPage.tsx` containing `queryKey: ["reaction-summary-batch", …]`
- **WHEN** `bun run check:convention` is run
- **THEN** the check SHALL fail
- **AND** the output SHALL name the offending file and line

#### Scenario: Factory file is permitted
- **GIVEN** a file `package/api/src/reaction/reaction.keys.ts` constructing key arrays
- **WHEN** `bun run check:convention` is run
- **THEN** the check SHALL pass

#### Scenario: Query options file is permitted
- **GIVEN** a file `package/api/src/post/post.queries.ts` that composes `queryKey: postKeys.byTarget(id, filters)` inside a `queryOptions` call
- **WHEN** `bun run check:convention` is run
- **THEN** the check SHALL pass (the literal pattern `queryKey: [` is absent; only a factory invocation appears)
