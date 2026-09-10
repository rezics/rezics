# Zone composition, aggregation and theming

Current contract for declarative Zone composition. The [implementation plan](../plan/README.md) owns remaining work and backend/frontend gates. Executable themes follow [the full-trust contract](custom-theme-full-trust-external-live.md); no bounded-CSS security model is selected.

## 1. Scope and positioning

A Zone is REZICS's declarative sub-site surface: configuration-driven
composition over the shared corpus, lighter than an embedded application
platform and more capable than a wiki skin. Communities that need people,
rules, and publication relations pair a Zone with a Realm; the Zone
itself never grows membership or governance tables.

Composition combines list presentation, bounded query sources, page aggregate execution and explicit theme/presentation contracts. Source and rendering choices remain independent.

## 2. Design principles

1. **Source × presentation orthogonality.** New capability lands as new
   `source` kinds or new presentation parameters on existing blocks, not
   as new block types per combination (Ghost Platform: rendering style is
   a parameter).
2. **Closed, non-Turing configuration.** Query capability stays inside the
   sparse `FilterDocument` / `SearchFeatureInput` contracts; no chained
   pipelines, no expression language (SMW/DPL evidence).
3. **Reusable display copy is a Unit reference.** Block members that carry reusable
   user-visible text use a `labelUnitId`-style reference. Image-local alternative text and
   captions are the narrow inline exception because they describe that image instance.
4. **Local validity stays local.** Depth, total Block count, and query-Block
   count live in each host policy and are enforced when that document is
   written. A document never becomes invalid because another independently
   stored surface is mounted beside it. Cross-surface work limits belong to
   the runtime compositor.
5. **Identity follows the narrowest useful scope.** A Block `_key` is
   stable and unique only among siblings in its containing array. Database
   resource IDs remain outside canonical document JSON. Execution uses a
   typed structural path, while theming uses explicit semantic hooks.
6. **Cacheability is a static property of a source.** Whether a block's
   result may be shared across viewers must be decidable from the persisted
   document alone; randomness is seeded so it caches (DPL `randomcount`
   evidence).
7. **Block-level fault isolation.** One failing query never fails a
   surface (Netflix row bulkhead).
8. **Canonical JSON storage; renderers evolve freely.** No stored render
   output, no byte-compare validation (Gutenberg evidence).
9. **Customization states its actual trust boundary.** Safe appearance remains
   declarative data. The capability-gated v0 Custom Theme preview runs reviewed
   first-party-privileged code under the decision linked above; a future bounded
   mode would require its own separately enforced containment contract.

## 3. Block vocabulary

### 3.1 List presentation profile

`unit-list` gains an optional `presentation` object:

- `itemSize: "sm" | "md" | "lg"` (default `md`) — density intent only;
  the client derives visible slide counts from container width. Persisted
  documents never store breakpoints or pixel values.
- `headingUnitId?` — optional Label Unit rendered as the section heading.
- `viewAllTarget?: NavigationTarget` — optional "more" affordance.

The carousel layout upgrades from the bare CSS overflow scroller to a
progressive shell: CSS scroll-snap as the no-JS base, enhanced after
hydration with the shared SharkUI Carousel (controls, indicators,
`slidesPerPage`/`slidesPerMove` computed from the container). The shelf
becomes a shared component in `libraries/ui/src/custom` reused by the
Realm pinned rail. Cards remain `UnitCard`/`Cover`.

### 3.2 Pinned sorts on Search-executing sources

`FilterDocument` deliberately owns no sort, so blocks cannot express "this
tab is newest-first" today. The pin lands inside the source variants that
actually execute Search, so sources with inherent curated order
(`units`, `collection`) cannot state one:

```
unit-list source: { kind: "search", feature, sort?: SearchSort }
derived query:    { feature, sort?: SearchSort }
feed block:       initialSort?: SearchSort
```

Semantics — a sparse narrowing of the server-owned sort policy, not a
client execution parameter:

- Write-time validation requires a registered `SearchSort` value and
  rejects `relevance` (query text is never persisted, and `relevance` is
  invalid without one).
- Execute-time resolution checks the pin against the server-owned policy
  for the executing surface. A pin the policy no longer offers resolves to
  the surface default and the block result carries an advisory, so
  persisted documents can never freeze the platform's ranking evolution.
- `unit-list` renders no sort control, so its pin is authoritative:
  runtime `state.sort` overrides are rejected for pinned sources. `feed`
  keeps its toolbar, so `initialSort` is only the default and the viewer's
  runtime choice wins.

No `expression` member ships with the pin: fixed variants belong in the
inline `filterDocument.where`, derived selections arrive as trusted
injections (§3.3), and a "pre-selected but adjustable controls" preset is
deferred until a product need exists — three constraint entrances is one
too many. The Filter document contract is unchanged.

### 3.3 Derived sources (selector → query, exactly one hop)

`unit-list.source` and `feed.feature` gain a `derived` kind:

```
{
  kind: "derived",
  select:
    { kind: "random-tag",
      from: { kind: "collection", collectionId }
          | { kind: "viewer-follows" },
      seed: { kind: "time-bucket", hours: 1 | 6 | 24 }
          | { kind: "request" } },
  query: { feature: SearchFeatureSource, sort?: SearchSort },
  fallback: { kind: "hide" } | { kind: "collection", collectionId }
}
```

Semantics:

- The selector resolves server-side to one Tag Unit; execution applies it
  to the query as a non-removable `tag` `SearchInjection` — the existing
  trusted-injection contract, no new predicate surface.
- **Bounded candidates.** `collection` candidates are the Collection's
  Tag-kind items; `viewer-follows` candidates are the viewer's followed
  Tag Units. Both are bounded, non-corpus sets. Initial tunable: the
  selector considers at most the first 1,000 candidates in stable keyset
  order; larger sets sample within that window. Selectors never execute
  against corpus-scale relations.
- **Seeded randomness.** `time-bucket` derives the pick from the
  server-owned resource context, canonical `BlockPath`, and bucket. For a
  Page this context already includes the route's Page Unit ID; for the main
  Dock it includes the Zone Unit ID and Dock slot. These values remain
  outside document JSON. The pick is deterministic within the bucket,
  reproducible, and shareable across viewers, so the block stays cacheable
  (this is the direct answer to the DPL `randomcount` prohibition).
  `request` re-samples per request and marks the block uncacheable; a
  "shuffle" affordance passes an explicit seed override.
- **Personalization is static.** `viewer-follows` marks the block
  personalized (never shared-cache eligible). For signed-out viewers the
  `fallback` applies: hide the block or substitute the named Collection
  selector.
- Presentation may reference the selection: `headingUnitId` accepts the
  sentinel `"selected"` slot on derived blocks so the heading renders the
  chosen Tag's localized title, composed with an optional prefix Label
  Unit. Dynamic headings therefore need no new i18n mechanism.

### 3.4 Tabs execution semantics

`tabs` remains a pure container. The aggregate execution contract (§4)
executes only the query blocks of the default (first) tab plus all
non-tab blocks; other tabs' query blocks return `skipped` and execute on
activation through the existing per-block endpoint. Clients may prefetch a
tab's blocks on hover/focus. The KadoKado-style section is therefore
`tabs` × (`unit-list` with a `search`/`derived` source and a pinned
`sort`) with no dedicated block type.

### 3.5 The `search` block

The dead `search` entry in `BlockTypeValues` becomes a real block: a
scoped search entry point rendering the standard Filter toolbar and query
input for a `SearchFeatureSource`, submitting to the Zone search surface.
It renders no inline result list in this release, so it adds no query
cost to aggregate execution. (Completing the contract was chosen over
removal because the Zone search surface already exists and the entry
point is the missing piece.)

### 3.6 Collection membership predicate

The Search field registry gains a `collection` membership field
("Unit is an item of Collection X"), compiled against `collection_item`
with its existing indexes, usable from Filter controls and injections.
This is distinct from the existing `UnitPredicate.collection` ("this Unit
is a Collection whose items match"), which keeps its semantics. Dynamic,
query-backed Collections remain out of scope, per the Collection schema's
standing note.

### 3.7 Query-block budgets

`BlockHostPolicy` gains `maxQueryBlocks`, counting blocks that execute
Search/Feed work (`feed`, `unit-list` with `search`/`derived` source,
future query blocks). Initial tunables, enforced at write time alongside
the existing depth/count rules:

| Host policy | maxQueryBlocks |
| --- | --- |
| Zone Page | 24 |
| Dock | 6 |
| Wiki Post Portable Text | 6 |

Wiki Posts already embed `unit-list` structurally; the budget makes that
existing capability safe rather than newly granting it. Existing
persisted documents are not retroactively invalidated; the budget applies
on the next write.

### 3.8 Block identity and execution addressing

`_key` is an array-member identity, following the same locality as a
renderer list key:

- every `blocks[]` requires unique Block keys among its direct children;
- every `columns[]` and `tabs[]` requires unique container keys among
  its own direct children;
- different arrays, nesting levels, documents, and mounted surfaces may
  reuse the same key;
- a document key, container key, and Block key never share an implicit
  global namespace.

Executable Blocks are addressed inside one loaded document by a typed,
keyed structural path rather than a bare Block key or array indexes:

```
BlockPath =
  [{ slot: "blocks", key: BlockKey },
   { slot: "columns" | "tabs", key: ContainerKey },
   ...,
   { slot: "blocks", key: BlockKey }]
```

Keyed paths survive sibling reordering. Moving a Block to another container
changes its path, which is a document revision change and is already covered
by revision binding. Page Unit IDs, Zone Unit IDs, and Dock ownership remain
in database rows and request context; they are never copied into Page or Dock
JSON. A renderer may carry that ownership in an in-memory envelope for
authorization, logging, cache partitioning, or seeded execution.

### 3.9 Ownership context is not Block identity

The aggregate and continuation routes obtain the owning Zone and Page from
their URL path and load the main Dock through that Zone. A request names an
executable Block only by its `BlockPath` inside that already selected document.
There is therefore no persisted or request-level
`{ documentKind, documentId, blockKey }` identity tuple, and no document UUID is
injected into Page or Dock JSON.

Page, Dock, Wiki, comment, and future recommendation documents validate their
own sibling arrays independently. Mounting them together does not cause a
second write validation. The runtime compositor may load Page and Dock together
to allocate a bounded execution budget and return results in separate `page`
and `dock` branches; that is scheduling, not cross-document identity or
validity. Comments remain a separate renderer and do not enter this aggregate.

## 4. Page aggregate execution

### 4.1 Contract

One new endpoint executes a rendered surface's eager query blocks in one
request:

```
POST /search/zones/:zoneId/pages/:pageId/execute
body: { pageRevision?, includeDock?: boolean = true,
        pageBlocks?: [{ path: BlockPath, state? }],
        dockBlocks?: [{ path: BlockPath, state? }] }
→ { pageRevision,
    page: { results: [{ path,
        outcome:
          { kind: "ok", items, nextCursor?, selected? }
        | { kind: "error", code }
        | { kind: "skipped", reason: "budget" | "inactive-tab" } }] },
    dock?: { results: [{ path, outcome }] } }
```

- **Persisted-query semantics.** The server resolves every executed query
  from the stored Page or Dock document; the request may only name a
  runtime-validated path inside the corresponding response branch and
  per-Block continuation state. Clients cannot inject queries, so the
  endpoint adds no new query attack surface and inherits each Block's
  existing authorization (hosting-Zone context enforced, viewer-relative
  predicates require the viewer).
- Omitted per-surface Block selections mean the default automatic candidates:
  all non-tab query Blocks plus the default tab's (§3.4). Explicit path lists
  serve tab activation and refresh.
- The Zone mounts the independently stored Dock as two presentation regions:
  top-level menu Blocks in the Zone header (including its mobile portal), and
  every other top-level Dock Block in a separate Dock composition region before
  Page content. Both regions retain `surface = dock`; they do not become Page
  Blocks and are not revalidated against the Page.
- `pageRevision` binds results to the document revision the client
  rendered; a mismatch returns the current revision so the client refetches
  the projection. `GET /zones/:zoneId/render` is unchanged and remains the
  cache-friendly projection read.
- **Dual cursors.** Each block result carries its own opaque `nextCursor`;
  in-block paging continues on the surface-owned routes
  `/search/zones/:zoneId/dock/block-executions`,
  `/search/zones/:zoneId/pages/:pageId/block-executions`, and their
  `feed-block-executions` counterparts. Those bodies contain only `path`,
  continuation `state`, an optional derived-selection seed, and localization
  hints. They contain neither a document discriminator nor client-supplied
  Filter injections.
  Derived blocks echo the `selected` reference (hydrated with the standard
  presentation projection).

### 4.2 Execution and isolation

The server fans out block executions in parallel with a bounded
concurrency and a per-block timeout (initial tunables: concurrency 4,
timeout 2 s). A block failure or timeout yields that block's `error`
entry; the surface response itself succeeds whenever the document resolves
(Netflix row-bulkhead behavior).

The runtime compositor, not a cross-document write validator, owns the
initial automatic-execution budget of eight. It collects independently valid
Page and Dock candidates, selects at most eight in stable tree order under a
deterministic Page/Dock fairness policy, and executes at concurrency four.
Unused allocation may be borrowed by the other surface; non-selected
candidates return `skipped` and remain available through explicit path
execution. API quota charges the selected count. Service admission is bounded
against database-pool headroom, and every underlying Search, Collection, and
hydration query consumes the same server-side deadline.

`inactive-tab` work starts automatically only when the lazy tab is activated.
`budget` work never starts automatically after the aggregate response: Search
and Feed retain their ordinary submit controls, while a Collection-backed list
shows an explicit load action. This preserves the eight-query request-path cap
instead of merely moving excess automatic work into follow-up requests.

Adding comments, recommendations, or another renderer therefore adds another
runtime contributor; it never creates a new persisted Page/Dock compatibility
invariant.

### 4.3 Caching posture

This release ships no shared result cache: every block execution is a
bounded index-backed query, and correctness never depends on caching. The
contract is nonetheless cache-ready: shared-cache eligibility is decidable
statically per block (§2 principle 5, §3.3), `time-bucket` seeds make
random blocks deterministic within a bucket, and canonical
`SearchFeatureInput` hashing already exists for keying. A shared TTL cache
for non-personalized blocks is a later, additive decision.

## 5. Workload assumptions and growth math

Recorded against the repository baseline of 500,000,000 rows per
corpus-scale relation, with 3,000,000,000-row estimates.

- **Read path.** One aggregate call = ≤ 8 block executions, each an
  existing bounded Search/Feed execution (candidate seed via selective
  indexes, `maxCandidatesScanned 4096`, page ≤ 20 for eager fills), run at
  concurrency 4. Cost scales with the number of blocks and the existing
  per-query bounds, not with corpus size; at 3 B Units the governing factor
  remains index selectivity of the underlying Search paths, unchanged by
  this program. Hydration is ≤ 8 × 20 presentations per call, within the
  existing batch-hydration shape.
- **Selectors.** Sampling executes only over bounded sets (Collection
  items of one Collection; one viewer's followed Tags), capped at 1,000
  candidates in keyset order — O(cap) index-only work independent of
  corpus scale. No `ORDER BY random()` over corpus relations exists or is
  introduced.
- **Write amplification.** Aggregate execution adds no persisted write path
  beyond ordinary document edits. In particular, there is no Zone-wide
  Block-key or eager-count projection and a Dock write never scans or
  revalidates the Zone's Pages.
- **Custom class hooks.** A Block carries at most 8 class tokens and a
  Composition document at most 256, each at most 64 ASCII characters.
  Validation and rendering are `O(Blocks + tokens)` with no lookup, join, or
  per-token entitlement call. Assuming 5 styled Blocks × 2 tokens and about 32
  JSON bytes/token, the raw incremental payload averages about 320 bytes per
  adopted document: 160 GB at 500 M documents and 960 GB at 3 B. The hard
  per-document ceiling is roughly 17 KiB. Classes are never indexed because
  the only read path loads the complete document by Composition identity;
  indexing them would add corpus-scale write amplification without serving a
  request path. Track adoption, bytes and tokens per document at mean/p95/p99,
  budget rejection rate, and stylesheet selector cost.
- **Failure modes.** Per-block timeout/error degrades one block to a
  client-rendered empty/fallback state; the page never 5xxs for one block.
  API quota counts one unit per selected Block (initial tunable), while a
  separate service-wide admission gate prevents authenticated interactive
  traffic from exhausting the database pool.
- **Skew.** Popular Zones concentrate identical non-personalized block
  queries; the seeded determinism of §3.3 makes those results shareable
  the moment a shared cache is added, which is the designated relief valve
  if hot-Zone load becomes measurable. Thresholds: sustained p95 aggregate
  latency > 500 ms or a single Zone exceeding 100 aggregate calls/s
  triggers the caching decision.

## 6. Appearance and execution

Safe appearance uses declarative tokens/presets with server-owned contracts. The selected Custom Theme mode is exact-host, exact-revision full-trust external-live execution with explicit review, eligibility, resource evidence and kill control. CSS scoping is not its security boundary. Theme data does not grant ordinary content, membership or administration permissions. Capacity and incident procedures follow the owning theme contract.

## 7. Community pairing

A Zone composes pages and navigation. A Realm owns membership, rules and local publication/selection. Pairing them does not merge identity, copy grants or transfer content ownership. References and query results always enforce current target visibility.

## 8. Tag Path and relationship graphs

Tag/Expression/Path/Sense/Application semantics follow [Tag Path architecture](tag-paths.md). Display labels are projections rather than relationship authority. A [Relationship Graph Block](database/relationship-graph.md) saves a bounded query descriptor and renders an authorized subgraph; it does not embed another editable graph. Its contract is verified in the backend phase, and its renderer follows backend acceptance.

## 9. Qualification

Use [the current frontend plan](../plan/frontend.md), affected deterministic/Storybook checks and [backend acceptance](../plan/backend-acceptance.md). Do not use old screenshot counts, retired CSS compilers, obsolete migration recipes or completed delivery diaries as current acceptance gates. Compatibility with earlier block formats is not a requirement of the current program.
