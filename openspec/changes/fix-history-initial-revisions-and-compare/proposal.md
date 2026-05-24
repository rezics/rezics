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
- Make the compare page correctly compare post-cutover sparse PATCH payloads,
  including `translations.<language>` object-shaped payloads.
- Keep legacy pre-cutover `slots`-shaped history readable and comparable.

## Non-goals

- Do not backfill existing content that was created before this fix.
- Do not redesign history storage away from outbox ingestion.
- Do not add synchronous history-service HTTP calls to canonical write
  transactions.
- Do not make discussion replies, reactions, tags, or externally-governed
  systems part of editorial history.
- Do not change restore authorization semantics.

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
- Add compare requirements for sparse PATCH-shaped history payloads.
- Update Book translation save/history handling so unchanged fields are not
  emitted into revision payloads or timeline chips.
- Update create flows for Book and Entity so successful canonical creates write
  an initial history outbox row in the same transaction.
- Keep history reads eventually consistent: initial revisions may lag until the
  outbox consumer ingests them.
- Add tests covering Book title-only history chips, sparse PATCH compare, and
  initial creation outbox rows.

## Capabilities

### New Capabilities

- `content-history-compare-ui`: Defines user-facing comparison behavior for
  legacy full-slot payloads and post-cutover sparse PATCH payloads.

### Modified Capabilities

- `content-history-service`: Adds initial creation revision semantics and
  tightens changed-field derivation to effective changed paths.
- `wiki-content-creation`: Clarifies that wiki-capable content creation paths
  that are in content-history scope emit an initial editorial revision.
- `wiki-post-editing`: Preserves and aligns existing wiki post creation history
  behavior with the generalized initial revision rule.

## Impact

- Affected packages:
  - `package/server`: Book, Entity, Chapter, and translation history write
    paths; focused service tests.
  - `package/history`: read-time changed-field derivation remains compatible;
    may need tests for object-shaped translation PATCH payloads.
  - `package/app`: Book history compare model and focused compare tests.
  - `package/contract`: only if helper types or fixtures are needed; no wire
    contract shape change is intended.
- APIs:
  - No public request/response shape change is intended.
  - History timelines will gain additional initial revisions for newly created
    content after this change.
- Backward compatibility:
  - Existing history rows remain readable.
  - Existing sparse PATCH revisions keep their stored payload shape.
  - No backfill migration is planned for already-created content.
- Migration needs:
  - No database schema migration is expected.
  - Existing rows are not rewritten.
