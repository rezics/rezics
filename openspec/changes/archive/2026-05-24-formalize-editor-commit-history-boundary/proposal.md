## Why

Rezics now has both low-frequency editorial forms and high-frequency editor surfaces such as shelf curation, table-of-contents editing, wiki content, and entity attribution selection. Without an explicit commit boundary, frontend add/remove/reorder gestures can accidentally become multiple permanent history versions instead of one meaningful editorial save.

This change formalizes the distinction between editor draft/op-log state and canonical history commits, then closes the immediate gap for entity attribution editing by introducing a batch commit surface shared by book, game, media, and future library content.

## What Changes

- Define a repository-wide rule that `HistoryOutbox`, `UnitRevision`, `RevisionContent`, and `StructureEvent` represent canonical commits, not autosave drafts, per-keystroke edits, or per-click UI operations.
- Add Prisma schema comments documenting the version model:
  - main server `HistoryOutbox` and `UnitHistoryClock`;
  - history service `UnitRevision`, `RevisionContent`, and `StructureEvent`.
- Introduce a unit-scoped entity attribution batch endpoint:
  - `PATCH /unit/:unitId/entity-attributions/batch`
  - request body `{ ops, baseVersion?, message? }`
  - batch ops reconcile final per-role sets for credits and subjects.
- Define the frontend model as an entity-feature-owned local edit queue, not a book-local implementation. Book, game, media, and future library content reuse the same entity attribution editing substrate.
- Keep existing single link/unlink credit and subject endpoints available for simple immediate actions, but entity attribution editor surfaces SHALL use the batch commit path when saving multiple local edits as one semantic change.

## Capabilities

### New Capabilities

- `editor-commit-history-boundary`: Defines the distinction between draft/op-log/autosave state and canonical history commits, including Prisma documentation requirements for the history version model.
- `entity-attribution-batch-editing`: Defines unit-scoped batch commit semantics for credit and subject attribution editing, including shared frontend entity edit queue ownership.

### Modified Capabilities

- `content-history-service`: Clarifies that editorial revisions and structure events are canonical commit records rather than editor autosave or UI operation logs.
- `attribution`: Adds batch commit semantics for credit attribution reconciliation.
- `subject-attribution`: Adds batch commit semantics for subject attribution reconciliation.
- `attribution-api-client`: Adds typed frontend API client and mutation support for the entity attribution batch endpoint.
- `app-entity-feature-architecture`: Moves reusable entity attribution edit state into the entity feature instead of book-local code.

## Impact

- Affected packages: `package/contract`, `package/server`, `package/history`, `package/api`, and `package/app`.
- API impact: adds `PATCH /unit/:unitId/entity-attributions/batch`; no removal of existing credit/subject link-unlink endpoints in this change.
- Database impact: schema comments only; no new table or migration data movement required for the thin change.
- Frontend impact: entity attribution editor state becomes reusable infrastructure under the entity feature and book editing migrates to that shared queue.
- Backward compatibility: existing immediate attribution APIs remain available, but multi-edit entity attribution UIs should stop replaying local changes as multiple server mutations.
