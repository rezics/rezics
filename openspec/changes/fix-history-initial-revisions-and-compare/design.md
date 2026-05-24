## Context

The history service stores post-cutover editorial revisions as sparse PATCH
payloads ingested from the main server's transactional `HistoryOutbox`. This is
good for write isolation and idempotent ingestion, but two current assumptions
are wrong:

- The first editable state of some content types is created without a history
  row, so sequence 1 can represent a later edit instead of the initial version.
- The Book compare UI compares stored revision payloads as if every revision
  were a complete state snapshot. Sparse PATCH payloads are not complete state
  snapshots.

The observed Book case exposes both issues. Two revision payloads exist and the
title differs, but `compareTranslations()` only understands array-shaped
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

Book/Entity edit
  └─ canonical DB transaction
      └─ HistoryOutbox with effective changed PATCH only

Compare page
  └─ reads enough revision content to build effective states
      └─ compares normalized legacy slots and sparse PATCH payloads
```

## Goals / Non-Goals

**Goals:**

- Make initial versions visible for history-scoped Book and Entity content.
- Keep wiki post creation history behavior intact.
- Store effective editorial PATCH payloads so `changedFieldKeys` reflects real
  changes.
- Compare sparse PATCH-shaped history payloads correctly, including
  object-shaped translations.
- Preserve legacy `slots` payload compatibility.

**Non-Goals:**

- No backfill for existing content that was created before this change.
- No schema migration unless implementation discovers an unavoidable constraint.
- No synchronous call from canonical writes to the history service.
- No general Chapter content-history rollout in this change.
- No change to restore authorization rules.

## Decisions

### 1. Treat initial creation as the first editorial revision

Book and Entity creation will write a `HistoryOutbox` row inside the same
transaction as the canonical create. The payload should be a full initial
editorial patch for fields that are part of the editable content surface:

- Book: unit-level editable metadata, Book extension metadata, and provided
  translations.
- Entity: entity metadata and provided translations.
- Wiki post: keep the existing `wiki-post.create` revision.

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

### 3. Compare effective states when possible

The compare page should not compare two sparse PATCH payloads as if they were
complete snapshots. It should normalize revisions into comparable effective
states:

1. Legacy `slots`/array-shaped payloads remain directly comparable.
2. Post-cutover PATCH payloads are folded in sequence order from the earliest
   available initial revision through the requested base and target.
3. If an older history window lacks an initial revision, the UI may fall back to
   comparing stored payloads and should still understand object-shaped
   translations.

This can be implemented in the app using existing history read endpoints, or
behind an API helper without changing the public wire contract. A dedicated
history compare endpoint is a future optimization, not required for this fix.

Alternative considered: compare only the target revision's changed paths
against the base payload. Rejected because non-adjacent revision comparison
needs effective state, not only the target patch.

### 4. Normalize translation payload shapes in one model layer

`compareRevisionSlots` should accept both:

- legacy/full state shape: `translations: [{ language, title, ... }]`
- PATCH shape: `translations: { "zh-hant": { title, ... } }`

The normalization belongs in `package/app/src/book-library/models` rather than
the page component so it can be tested without rendering.

## Risks / Trade-offs

- **Risk: initial create payloads become too broad** → Limit them to editable
  content-history paths and keep externally governed fields out.
- **Risk: compare reconstruction needs many revisions for long histories** →
  Start with existing paginated reads and cap/fallback behavior; a dedicated
  compare endpoint can follow if needed.
- **Risk: existing sparse rows before this fix still over-report chips** →
  Do not rewrite old rows; new writes become correct, and compare remains
  tolerant of old payloads.
- **Risk: two writes during create can disturb sequence order** → Write the
  initial history row in the same DB transaction after canonical rows exist and
  before commit.

## Rollout Plan

1. Add focused model tests for sparse PATCH compare and translation object
   normalization.
2. Update server writers to emit effective patches and initial create outbox
   rows.
3. Add service tests for Book and Entity initial create history payloads.
4. Verify existing wiki post creation history behavior remains unchanged.
5. Run targeted tests, then `bun run check:convention`.

Rollback is straightforward because no schema migration is expected. Reverting
the code stops new initial revisions and effective-patch emission but leaves
already ingested rows valid.

## Open Questions

- Should Chapter content updates become editorial history in a separate change?
  If yes, Chapter creation should gain an initial revision in that same change.
- Should the history service eventually expose a first-class compare endpoint
  that returns effective base/target states for long timelines?
