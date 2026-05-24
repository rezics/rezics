## Why

Content history currently misses some initial creation commits and can mislead
users after ordinary edits. A Book title-only edit is persisted in history, but
the compare page can render no changes, while timeline chips show many fields
because the revision payload captured the submitted sparse body rather than the
effective changed paths.

This matters now because history is becoming a user-facing restore and audit
surface. The first user-visible version of history-scoped content must be
available, and compare output must match what actually changed.

## Problem

- Book creation does not create an initial `HistoryOutbox` revision, so the
  first timeline entry can be a later edit rather than the created state.
- Entity and Chapter creation follow the same pattern: canonical content is
  created without a corresponding initial content-history revision.
- Wiki post creation already writes an initial revision, but this behavior is
  not generalized across history-scoped content creation.
- The Book history compare model treats `translations` as an array of
  translation records, while post-cutover history stores sparse PATCH payloads
  such as `translations.zh-hant.title`.
- Book edit submits full translation draft fields on every save, so the
  history service derives chips for unchanged `summary`, `subtitle`, and
  nested `description` fields when only `title` changed.

## Goals

- Record initial history revisions for every content creation path that is in
  editorial content-history scope.
- Preserve existing wiki post initial-history behavior.
- Ensure history revision payloads and `changedFieldKeys` reflect effective
  changes, not merely fields present in a submitted form body.
- Align initial creation payload coverage with edit revision payload coverage
  so the two writers share a single editorial path scope.
- Provide a per-path snapshot index in the history service so compare between
  any two revisions is bounded by the number of editorial paths rather than the
  number of revisions between them.
- Make the compare page correctly compare any two revisions, including
  non-adjacent ones, without folding PATCH payloads in the app layer.
- Keep legacy pre-cutover `slots`-shaped history readable and comparable.

## Non-goals

- Do not synthesize initial revisions for content that was created before this
  fix landed. The per-path snapshot index is backfilled from existing revision
  rows; no new editorial revisions are invented for pre-existing content.
- Do not redesign history storage away from outbox ingestion.
- Do not add synchronous history-service HTTP calls to canonical write
  transactions.
- Do not make discussion replies, reactions, tags, or externally-governed
  systems part of editorial history.
- Do not change restore authorization semantics.
- Do not introduce per-array-element snapshot rows; arrays remain a single
  leaf value per path.

## Scope

Initial revision coverage applies to content creation paths that already expose
or participate in editable content history:

- Book creation, including wiki and personal creation modes.
- Entity creation, including wiki and personal creation modes.
- Wiki post creation, preserving the existing initial revision behavior.

Chapter content creation remains outside this change because Chapter updates do
not currently emit editorial revisions; if Chapter content history is added, its
initial creation revision should be specified with that capability. Normal post
replies, reaction/vote writes, tag governance, realm tag applications, user
profile creation, and generic low-level Unit creation remain outside this
change unless an existing spec explicitly puts them in content history scope.

## What Changes

- Add content-history requirements for initial creation revisions.
- Define editorial path scope per content type as the single source shared by
  initial creation, edit writers, and `changedFieldKeys` derivation.
- Add compare requirements for sparse PATCH-shaped history payloads.
- Update Book translation save/history handling so unchanged fields are not
  emitted into revision payloads or timeline chips.
- Update create flows for Book and Entity so successful canonical creates write
  an initial history outbox row in the same transaction.
- Materialize a per-path snapshot index in the history service, populated by
  the outbox consumer on every editorial revision and seeded once by
  backfilling existing revisions.
- Add a path-snapshot compare reconstruction in the history service that
  returns base and target values per editorial path for any (base, target)
  sequence pair on the same Unit.
- Move Book compare from app-layer payload folding to the new reconstruction
  API.
- Keep history reads eventually consistent: initial revisions may lag until the
  outbox consumer ingests them.
- Add tests covering Book title-only history chips, sparse PATCH compare,
  initial creation outbox rows, non-adjacent compare, and the path-snapshot
  index lifecycle.

## Capabilities

### New Capabilities

- `content-history-compare-ui`: Defines user-facing comparison behavior for
  legacy full-slot payloads and post-cutover sparse PATCH payloads.

### Modified Capabilities

- `content-history-service`: Adds initial creation revision semantics, tightens
  changed-field derivation to effective changed paths, introduces a derived
  per-path snapshot index, and exposes a path-snapshot compare reconstruction.
- `wiki-content-creation`: Clarifies that wiki-capable content creation paths
  that are in content-history scope emit an initial editorial revision.
- `wiki-post-editing`: Preserves and aligns existing wiki post creation history
  behavior with the generalized initial revision rule.

## Impact

- Affected packages:
  - `package/server`: Book, Entity, and translation history write paths; Book
    and Entity create flows gain initial history outbox writes; focused service
    tests.
  - `package/history`: new derived per-path snapshot table, outbox-consumer
    ingestion that explodes effective PATCH payloads into path rows, backfill
    of existing revisions, and a path-snapshot compare reconstruction API.
  - `package/app`: Book history compare moves from local payload folding to
    the new history service compare API; focused tests.
  - `package/contract`: types for the new compare reconstruction API and
    shared editorial path scope helpers.
- APIs:
  - New history service compare reconstruction endpoint(s) for path-snapshot
    based base/target value retrieval.
  - No change to existing outbox or revision read endpoints.
  - History timelines will gain additional initial revisions for newly created
    content after this change.
- Backward compatibility:
  - Existing canonical history rows remain readable and unchanged.
  - Existing sparse PATCH revisions keep their stored payload shape; the new
    per-path index is derived state.
  - Existing revisions, including pre-cutover slot-shaped payloads, are
    re-projected into the new per-path index via a one-time backfill.
- Migration needs:
  - Main server: no schema migration.
  - History service: new `UnitRevisionPath` table (or equivalent) plus the
    `(unit_id, path, sequence)` composite index for latest-touch lookup, and a
    one-time backfill that explodes every existing revision payload into path
    rows.
