## Context

The history service stores post-cutover editorial revisions as sparse PATCH
payloads ingested from the main server's transactional `HistoryOutbox`. This is
good for write isolation and idempotent ingestion, but three current
assumptions are wrong:

- The first editable state of some content types is created without a history
  row, so sequence 1 can represent a later edit instead of the initial version.
- Initial creation and edit writers do not agree on which paths belong to
  editorial scope, so even when both write history they can disagree on what
  to record for the same field state.
- The Book compare UI compares stored revision payloads as if every revision
  were a complete state snapshot. Sparse PATCH payloads are not complete state
  snapshots, and folding them in app code does not scale to long histories or
  non-adjacent comparisons.

The observed Book case exposes the writer issues. Two revision payloads exist
and the title differs, but `compareTranslations()` only understands array-shaped
translations, while stored PATCH payloads use `translations.<language>`.
Timeline chips also over-report because the frontend submits full translation
draft fields, and the server stores that submitted PATCH instead of reducing it
to effective changed fields.

Current data flow:

```text
Book edit form
  └─ submits translation PATCH with title + unchanged fields
      └─ main server applies effective DB changes
          └─ HistoryOutbox stores submitted PATCH
              └─ history service derives chips from stored PATCH leaves
                  └─ compare UI treats PATCH as full snapshot
```

Target data flow:

```text
Book/Entity create
  └─ canonical DB transaction
      └─ HistoryOutbox sequence 1 with initial effective editorial payload
          (paths = editorial path scope for content type)

Book/Entity edit
  └─ canonical DB transaction
      └─ HistoryOutbox with effective changed PATCH only
          (paths ⊆ editorial path scope for content type)

History service ingest
  └─ writes UnitRevision (canonical, unchanged shape)
      └─ explodes effective PATCH into UnitRevisionPath rows
          keyed by (unit_id, sequence, path)

Compare page
  └─ calls history service compare(unit, base, target)
      └─ history service computes path-union over (base, target]
          and resolves latest-touch-per-path at each endpoint
              via single index seek per path
```

## Goals / Non-Goals

**Goals:**

- Make initial versions visible for history-scoped Book and Entity content.
- Keep wiki post creation history behavior intact.
- Store effective editorial PATCH payloads so `changedFieldKeys` reflects real
  changes.
- Define editorial path scope per content type so initial creation, edit
  writers, and chip derivation share one source of truth.
- Make compare between any two revisions of the same Unit cheap and correct,
  regardless of distance between them.
- Preserve legacy `slots` payload compatibility by projecting them into the
  same per-path index.

**Non-Goals:**

- No synthesized initial revisions for content created before this change.
- No synchronous call from canonical writes to the history service.
- No general Chapter content-history rollout in this change.
- No change to restore authorization rules.
- No per-array-element snapshot rows; arrays remain whole leaf values.

## Decisions

### 1. Treat initial creation as the first editorial revision

Book and Entity creation will write a `HistoryOutbox` row inside the same
transaction as the canonical create. The payload is a full initial editorial
patch covering the same editorial path scope that later edit revisions emit:

- Book: unit-level editable metadata, Book extension metadata, and provided
  translations.
- Entity: entity metadata and provided translations.
- Wiki post: keep the existing `wiki-post.create` revision.

The path coverage equality is the load-bearing invariant. We define a per
content-type `editorialPathScope` in shared server code (`package/server` or
`package/contract`) that the create writer, the edit writer, and the chip
derivation all reference. The initial revision's leaf path set SHALL equal
the set of paths that an edit reaching the same state would emit.

Alternative considered: create synthetic initial revisions in the history
service by reading main current state. Rejected because the history service must
not reconstruct canonical history by later reading mutable main state.

### 2. Store effective PATCH payloads, not raw submitted bodies

Canonical writers should remove unchanged paths before calling
`writeEditorialMetadataHistory`. For translation updates, this means the server
compares against the previous row and builds a patch containing only changed
leaf values. If no effective leaf changed, the writer creates no outbox row.

Alternative considered: keep storing the raw submitted PATCH and attach a
separate changed-path list. Rejected because post-cutover `changedFieldKeys` is
defined as a derived projection, not canonical stored state.

### 3. Materialize a per-path snapshot index in the history service

The history service maintains a derived `UnitRevisionPath` table populated by
the outbox consumer. Every editorial revision's effective PATCH is exploded
into one row per leaf path:

```text
UnitRevisionPath
  unit_id     uuid
  sequence    bigint
  path        text       -- editorial leaf path, e.g. "translations.zh-hant.title"
  value       jsonb      -- leaf value as written in the PATCH
  revision_id uuid       -- back reference to UnitRevision
  PRIMARY KEY (unit_id, sequence, path)
  INDEX        (unit_id, path, sequence DESC)
```

Leaf granularity follows the editorial PATCH path vocabulary (the same
vocabulary used by `changedFieldKeys` derivation):

- Nested objects in the payload explode through each level.
- Scalars terminate as a leaf row.
- Arrays terminate as a leaf row whose value is the whole array. No row is
  ever emitted for individual array elements.

Existing revisions are projected into this table by a one-time backfill that
walks every `UnitRevision`, including pre-cutover slot-shaped payloads, and
applies the same leaf-emission rule.

Alternative considered: query JSONB patch columns at compare time with GIN
indexes. Rejected: the latest-touch-per-path query needs to filter by a
specific path and order by sequence, which is hard to plan reliably without an
exploded table. The derived table makes the query a single index seek per path.

### 4. Compare via path-snapshot reconstruction (Approach A: range-union)

Compare for unit `U` between sequence `B` and sequence `T` is computed entirely
inside the history service:

```sql
-- Step 1: paths touched in the open-closed range (B, T]
SELECT DISTINCT path
FROM UnitRevisionPath
WHERE unit_id = U AND sequence > B AND sequence <= T;

-- Step 2: for each path P in the result, the latest value at or before each
-- endpoint X ∈ {B, T}
SELECT DISTINCT ON (path) path, value, sequence AS from_sequence
FROM UnitRevisionPath
WHERE unit_id = U AND path = ANY(:paths) AND sequence <= :X
ORDER BY path, sequence DESC;
```

Step 1 produces the candidate path set. Step 2 runs twice (once per endpoint),
and each `DISTINCT ON (path)` is served by the `(unit_id, path, sequence DESC)`
index as one seek per path. Total cost is `O(|paths_in_range| × 2 index seeks)`
and is independent of the number of revisions between `B` and `T`.

For a path whose first touch lies above `B`, the base-side query returns no
row; the compare result renders the path as additive (null base → target
value). This naturally handles "missing initial revision" cases for content
created before this change.

Alternatives considered:

- **Approach B — full reconstruction at each endpoint.** Drop the range-union
  step; for every path ever touched by the unit, resolve latest-at-B and
  latest-at-T, then diff. Worst case is equivalent to Approach A. It does more
  work for short ranges but stays bounded by the editorial path scope. Kept as
  a future fallback only if Approach A's step-1 scan ever becomes a hot spot;
  not implemented now.
- **Fold PATCH payloads in app code.** Rejected: O(revisions) cost, breaks for
  long histories, duplicates work the history service is better positioned to
  do, and forces the client to understand legacy payload shapes.
- **Compare only the target revision's changed paths against the base payload.**
  Rejected: misses paths touched only by intermediate revisions in the range.

## Risks / Trade-offs

- **Risk: initial create payloads become too broad or drift from edit payloads**
  → Define `editorialPathScope` per content type as a single shared module that
  both create and edit writers reference. Add an assertion-style test that the
  two writers produce identical path sets for the same input state.
- **Risk: per-path index write amplification on outbox ingest** → Average
  edits touch a handful of paths, so amplification stays well under 10×.
  Bulk inserts in the ingest transaction are cheap for Postgres at expected
  volumes.
- **Risk: backfill cost on existing revisions** → One-time scan over every
  `UnitRevision`. Run as a maintenance migration; the table is bounded and the
  per-row work is small (explode JSON and insert leaf rows).
- **Risk: legacy slots-shaped payloads explode differently from PATCH-shaped
  payloads** → Backfill normalizes both into the same leaf vocabulary. After
  backfill, callers of the path-snapshot index see one shape only.
- **Risk: existing sparse rows before this fix still over-report chips** →
  Do not rewrite canonical revision payloads; new writes become correct.
  Chip derivation reads from the path index, so post-backfill chips track the
  effective leaves stored in the index.
- **Risk: two writes during create can disturb sequence order** → Write the
  initial history row in the same DB transaction after canonical rows exist and
  before commit.
- **Risk: path vocabulary drifts between writer, ingest, and reader** → Share
  a single explosion helper. Test that `editorialPathScope` keys, ingest leaf
  emission, and chip derivation produce the same paths for the same payload.

## Rollout Plan

1. Define `editorialPathScope` per content type and a shared leaf-explosion
   helper.
2. Update server writers to emit effective patches and initial create outbox
   rows referencing the shared scope.
3. Add the `UnitRevisionPath` table and ingest path that explodes incoming
   revisions into leaf rows. New revisions are indexed from day one.
4. Add the path-snapshot compare reconstruction API in the history service.
5. Backfill existing revisions into `UnitRevisionPath` (one-time migration).
6. Move Book compare in `package/app` from local payload folding to the new
   API.
7. Add service tests for Book and Entity initial create history payloads,
   path-snapshot ingest, backfill, and adjacent/non-adjacent compare.
8. Verify existing wiki post creation history behavior remains unchanged.
9. Run targeted tests, then `bun run check:convention`.

Rollback considerations:

- Code revert stops new initial revisions and effective-patch emission. Already
  ingested rows stay valid.
- The `UnitRevisionPath` table is derived state. Dropping it is safe; rebuilding
  it is the same backfill that originally populated it.

## Open Questions

- Should Chapter content updates become editorial history in a separate change?
  If yes, Chapter creation should gain an initial revision in that same change
  and add its paths to `editorialPathScope`.
- Should the path-snapshot compare API be paginated for unit types with very
  wide editorial scope (e.g., many language translations)? Defer until we see
  a real wide-scope unit; current scope is comfortably bounded.
