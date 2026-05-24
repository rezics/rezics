## Context

The current API client stores server state in per-domain TanStack Query caches:
`bookKeys.detail(unitId)`, `realmKeys.detail(unitId)`, `postKeys.detail(unitId)`,
and so on. Many domain DTOs embed `translations[]` from the shared
`UnitTranslation` table.

The generic Unit translation mutation updates only `unitKeys.detail(unitId)` and
`unitKeys.lists()`. That is not enough for pages whose authoritative read model
is a domain detail query. Book edit is the visible failure:

```text
bookQueries.detail(bookId) -> stale BookDTO.translations
        ^
        |
unitApi.upsertTranslation(bookId, lang) succeeds
        |
        v
editor.clearDraft(lang)
        |
        v
currentDraft falls back to stale BookDTO.translations
```

There is a second race when the Book page saves metadata and translation in the
same submit. `updateBookMutation` writes a full `BookDTO` into
`bookKeys.detail(bookId)`, but that response can be produced before the
translation write is visible. If the translation mutation is not allowed to patch
the same detail cache after success, the metadata response can leave a mixed
state: new metadata with old translations.

## Approach

### 1. Centralize translation cache patching

Add a small helper in `@rezics/api` that can update an embedded
`translations[]` array for any cached DTO with `{ unitId, translations? }`.

Expected behavior:

- upsert: replace the translation with the same `language`, or append it if it
  is missing;
- delete: remove the translation with that `language`;
- source update: replace or append the returned translation/source payload if the
  endpoint returns enough data, otherwise invalidate the affected detail cache.

This helper should operate on specific query keys supplied by the caller. It
should not try to infer Unit type from an id.

### 2. Let generic Unit translation mutations accept affected detail keys

Extend `useUpsertTranslationMutation` and `useDeleteTranslationMutation` with an
option such as:

```ts
affectedDetailKeys?: (variables, data) => readonly QueryKey[]
```

The default behavior remains the current `unitKeys` invalidation. Callers that
edit domain DTOs can additionally patch/invalidate `bookKeys.detail(bookId)`,
`realmKeys.detail(realmId)`, or another domain key.

For Book edit, use this option rather than open-coded cache writes in the page.
This keeps the UI flow focused on editor state and keeps cache policy in
`@rezics/api`.

### 3. Book edit save ordering

Book edit should not clear the language draft until the relevant detail cache
contains the just-saved translation or the detail query has been invalidated and
refetched.

For saves that include both metadata and translation:

- avoid parallel writes overwriting each other's cache results; either sequence
  cache synchronization carefully or perform a final targeted patch/invalidation
  after all writes complete;
- if a mutation returns a full `BookDTO`, patching `bookKeys.detail` must preserve
  any fresher embedded translation already written during the same submit.

### 4. Direct Unit translation callers

Audit direct calls to `unitApi.upsertTranslation`:

- `RealmManagePage` already invalidates `realmKeys.detail(realmId)` after save;
  keep or migrate it to the shared mutation path.
- `PinboardAdminSection` edits arbitrary pinned Units and only refetches its
  local pinboard view. It should invalidate or patch affected domain detail
  caches when the Unit type is known from the editor context; if the type is not
  known, invalidate `unitKeys.detail(unitId)` and the pinboard query explicitly.
- `SetSourceReleaseControl` currently invalidates only `unitKeys.detail(workId)`;
  in Book edit it must update or invalidate `bookKeys.detail(bookId)`.

### 5. In-flight stale response protection

Before writing mutation results into a detail cache, cancel active detail queries
for the same key when possible. This prevents an older in-flight detail refetch
from landing immediately after a successful mutation and overwriting fresh
client state.

This is a local protection for legacy TanStack Query detail caches, not the full
Unit Store `cancelQueries -> writeUpsert -> refetch:false` design.

## Non-Goals

- Do not introduce TanStack DB or any Unit Store code.
- Do not add optimistic editing.
- Do not redesign domain DTOs or add DTO version fields.
- Do not change server write semantics unless a response lacks enough
  authoritative data to patch the cache safely.

## Risks

- Over-patching a DTO shape can hide server changes. Keep helper scope narrow:
  only `translations[]`, only on explicitly supplied detail keys.
- Generic invalidation can be too broad. Prefer exact detail keys, then list or
  search prefixes only when membership, ordering, visibility, or aggregate
  output may change.
- Some direct callers may not know Unit type. In those cases, use explicit local
  refetch plus `unitKeys.detail` invalidation and leave a follow-up TODO only if
  the current context cannot safely identify a domain cache.
