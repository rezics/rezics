## ADDED Requirements

### Requirement: Api Unit Store Construction

`@rezics/api` SHALL provide an Api Unit Store that is constructed from an existing TanStack `QueryClient` and SHALL avoid module-level singleton collection instances.

#### Scenario: Isolated store instances

- **WHEN** two callers create stores from two different `QueryClient` instances
- **THEN** cached units loaded into one store SHALL NOT appear in the other store

#### Scenario: App-owned QueryClient

- **WHEN** an app provider creates its existing TanStack `QueryClient`
- **THEN** it SHALL be able to create an Api Unit Store from that client without creating a separate network cache client

### Requirement: Unit Id Subset Reuse

The Api Unit Store SHALL support id-subset reads for unit-backed DTOs and SHALL fetch only missing unit ids when a later id-subset query overlaps with units already present in the collection.

#### Scenario: Overlapping book ids

- **WHEN** `useBooksByIds(["id1", "id2", "id3"])` has loaded all three books and `useBooksByIds(["id2", "id3", "id4"])` is requested before the cached units are stale
- **THEN** the Unit Store SHALL reuse `id2` and `id3` from the collection and request only `id4` from the network

#### Scenario: Identical id subset

- **WHEN** the same id subset is requested again while the associated TanStack Query entry is fresh
- **THEN** the Unit Store SHALL rely on TanStack Query freshness and SHALL NOT force an additional network request

### Requirement: Domain-Local Collections

Each supported unit-backed domain SHALL expose a domain-local collection adapter in `@rezics/api` and SHALL keep domain fetch details out of app feature code.

#### Scenario: Book collection adapter

- **WHEN** app code needs books by unit id
- **THEN** it SHALL call an API package book hook or helper rather than constructing a TanStack DB live query in the app package

#### Scenario: Domain fetch ownership

- **WHEN** a domain supports id-subset loading through an existing list endpoint
- **THEN** the domain collection adapter SHALL own translating unit ids into that endpoint's filter shape

### Requirement: React Hook Result Shape

The Api Unit Store SHALL expose domain hooks with a stable API-oriented result shape and SHALL NOT require normal app consumers to inspect TanStack DB collection internals.

#### Scenario: Non-suspense hook

- **WHEN** a consumer calls a domain id-subset hook
- **THEN** the hook result SHALL include `data`, `isLoading`, `isError`, `error`, `isReady`, `refetch`, and `missingIds`

#### Scenario: Collection internals hidden

- **WHEN** a consumer handles loading or error UI
- **THEN** it SHALL NOT need to read `collection.utils.lastError`, `errorCount`, or other TanStack DB internals directly

#### Scenario: Refetch semantics

- **WHEN** a consumer calls `refetch` on a domain id-subset hook
- **THEN** the call SHALL be equivalent to `queryClient.invalidateQueries` against the subset's queryKey
- **AND** SHALL NOT expose or invoke TanStack DB Query Collection's own refetch surface

#### Scenario: Partial response is not a hole

- **WHEN** the server returns fewer DTOs than requested ids (filtered, deleted, or unauthorized)
- **THEN** `data` SHALL contain only the returned DTOs in caller-id order, without `undefined` holes
- **AND** the absent ids SHALL be exposed via `missingIds`

### Requirement: Detail Reads Through Unit Store

For each domain that adopts a Unit Store collection, single-id detail reads SHALL go through the Unit Store and SHALL NOT retain a parallel `<domain>Keys.detail` read path.

#### Scenario: Detail hook is a single-id Unit Store read

- **WHEN** a consumer calls `useBookDetail(id)` (or the equivalent detail hook) for a migrated domain
- **THEN** the hook SHALL be implemented as a single-id Unit Store read
- **AND** no separate `queryOptions({ queryKey: bookKeys.detail(id) })` SHALL remain registered for that domain

#### Scenario: No legacy setQueryData in mutations

- **WHEN** a migrated domain's mutation succeeds with a complete DTO
- **THEN** the mutation handler SHALL write the DTO via `collection.utils.writeUpsert`
- **AND** SHALL NOT also call `queryClient.setQueryData(<domain>Keys.detail, dto)`

### Requirement: Subset QueryKey Normalization And Transparent Chunking

Id-subset hooks SHALL normalize the input id list (sort, dedupe) before deriving the TanStack Query queryKey, and SHALL transparently chunk requests that exceed the server's `MAX_IDS` limit.

#### Scenario: Concurrent overlapping subsets collapse in flight

- **WHEN** two components mount in the same tick with id lists that, after sort + dedupe, are equal
- **THEN** the Unit Store SHALL issue exactly one underlying TanStack Query request, not two

#### Scenario: Caller exceeds MAX_IDS

- **WHEN** a caller passes more ids than the server's `MAX_IDS` (currently 200)
- **THEN** the adapter SHALL split the request into multiple `/list` POSTs internally and merge results
- **AND** the hook API SHALL NOT surface the limit to the caller

### Requirement: Stale Refetch Must Not Overwrite Mutation Result

Mutations that write authoritative DTOs SHALL prevent already-in-flight subset refetches from overwriting the fresh data, using `queryClient.cancelQueries` before the direct write and returning `{ refetch: false }` from the persistence handler.

#### Scenario: In-flight refetch loses to fresh mutation

- **WHEN** a subset refetch is in flight returning stale DTOs for a unit
- **AND** a mutation completes with the fresh DTO for the same unit
- **THEN** the mutation handler SHALL call `queryClient.cancelQueries` for the affected subset prefix before `writeUpsert`
- **AND** the in-flight stale response SHALL NOT overwrite the freshly written DTO

#### Scenario: Mutation handler skips automatic refetch

- **WHEN** a mutation handler writes a fresh authoritative DTO into the collection
- **THEN** the handler SHALL return `{ refetch: false }` so the Query Collection's automatic post-handler refetch does not re-issue the network round-trip

### Requirement: Manual Eviction And Auth Reset

The Api Unit Store SHALL expose manual eviction utilities and SHALL be reset on viewer or permission scope changes, since TanStack DB has no built-in size-based eviction as of v0.6.

#### Scenario: Per-id eviction

- **WHEN** a consumer (or the API layer) calls `<store>.<domain>.evict(ids)`
- **THEN** the named rows SHALL be removed from the collection without affecting other rows

#### Scenario: Full store reset

- **WHEN** the authenticated viewer or permission scope changes
- **THEN** the Api Unit Store SHALL be reset so that DTOs scoped to the previous viewer do not leak

### Requirement: Wrapped Beta Dependency

`package/app` and `package/admin` SHALL NOT import `@tanstack/react-db` or `@tanstack/query-db-collection` directly; only `package/api` may.

#### Scenario: Convention check forbids direct import

- **WHEN** `bun run check:convention` runs against the repo
- **THEN** any direct import of `@tanstack/react-db` or `@tanstack/query-db-collection` from `package/app/**` or `package/admin/**` SHALL fail the convention check (proposed rule R10)

### Requirement: Id Order Preservation

Id-subset hooks SHALL return units ordered according to the caller-provided id list.

#### Scenario: Raw collection order differs

- **WHEN** TanStack DB returns units in a different order than the requested ids
- **THEN** the API hook SHALL reorder the returned DTOs to match the requested ids

### Requirement: Query Freshness And Invalidation

The Api Unit Store SHALL use TanStack Query for freshness, retry, background refetch, and invalidation behavior.

#### Scenario: Stale unit subset

- **WHEN** an active Unit Store subset query becomes stale and TanStack Query refetch policy executes
- **THEN** the Unit Store SHALL update its collection from the refetched query result

#### Scenario: Mutation invalidates membership queries

- **WHEN** a mutation may change list membership, ordering, aggregates, permissions, visibility, or search results
- **THEN** the mutation path SHALL invalidate the relevant TanStack Query keys in addition to any Unit Store DTO write

### Requirement: Mutation Success Synchronization

Mutations that return complete authoritative unit DTOs SHALL update the corresponding Api Unit Store collection from the success response.

#### Scenario: Full DTO mutation response

- **WHEN** a post update mutation succeeds and returns a complete `PostDTO`
- **THEN** the post collection in the Api Unit Store SHALL be updated with that DTO without requiring an immediate post detail refetch

#### Scenario: Partial mutation response

- **WHEN** a mutation succeeds but does not return a complete authoritative DTO
- **THEN** the mutation path SHALL invalidate the affected unit collection or subset so active readers can refetch authoritative data

### Requirement: Explicit Phase One Scope

The first Api Unit Store implementation SHALL provide read-model and success-response synchronization only and SHALL NOT introduce local persistence or optimistic mutation workflows.

#### Scenario: No IndexedDB persistence

- **WHEN** the first implementation is complete
- **THEN** unit DTOs SHALL remain in memory through TanStack DB and TanStack Query rather than IndexedDB or another persistent local store

#### Scenario: Optimistic mutation deferred

- **WHEN** a mutation is implemented during this change
- **THEN** it SHALL NOT introduce TanStack DB optimistic transaction behavior unless a later OpenSpec change explicitly expands the scope

