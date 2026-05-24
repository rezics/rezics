## 1. Contract And API Shape

- [ ] 1.1 Add `entityAttributionBatchRequestSchema`, op schemas, response schema, and exported types to `package/contract`.
- [ ] 1.2 Add route parameter schema for `PATCH /unit/:unitId/entity-attributions/batch`.
- [ ] 1.3 Ensure batch op role fields use the existing credit and subject attribution role registries.
- [ ] 1.4 Add contract tests covering valid `setCredits`, valid `setSubjects`, mixed-role batches, and invalid role rejection.

## 2. Server Batch Endpoint

- [ ] 2.1 Add a unit-scoped entity attribution batch API route under `package/server/src/unit` or a clearly named attribution domain module mounted from `package/server/src/index.ts`.
- [ ] 2.2 Implement a service helper that derives affected editorial paths from batch ops.
- [ ] 2.3 Implement credit reconciliation for `setCredits`: validate entity eligibility, upsert/update kept rows, create missing rows, delete omitted rows, and preserve `sortOrder`.
- [ ] 2.4 Implement subject reconciliation for `setSubjects`: validate entity eligibility, upsert/update kept rows, create missing rows, delete omitted rows, and preserve `sortOrder` / `weight`.
- [ ] 2.5 Run the existing path-based authority check once for all affected paths before canonical row mutation.
- [ ] 2.6 Wrap batch reconciliation, search projection updates, and history outbox write in one transaction.
- [ ] 2.7 Write one editorial `HistoryOutbox` row with message `entity-attribution.batch` when effective changes occur.
- [ ] 2.8 Detect no-op batches and return success without writing a history row.
- [ ] 2.9 Add server tests for mixed credit/subject commits, validation rollback, no-op behavior, authority rejection, and one-history-row semantics.

## 3. History Schema Documentation

- [ ] 3.1 Add Prisma documentation comments to main server `UnitHistoryClock` and `HistoryOutbox`.
- [ ] 3.2 Add Prisma documentation comments to history service `UnitRevision`, `RevisionContent`, and `StructureEvent`.
- [ ] 3.3 Ensure comments explicitly distinguish canonical commits from autosave, drafts, and uncommitted editor op logs.

## 4. API Client

- [ ] 4.1 Add a typed `entityAttributionApi.batchUpdate(unitId, request)` client method in `package/api`.
- [ ] 4.2 Add TanStack Query mutation support for entity attribution batch commits.
- [ ] 4.3 Invalidate credit attribution, subject attribution, and any shared entity attribution editor query keys for the target Unit after successful batch save.
- [ ] 4.4 Export new API client methods, mutation hooks, and types from the appropriate `package/api` barrel files.

## 5. Shared Entity Frontend Queue

- [ ] 5.1 Create reusable entity attribution edit queue model under `package/app/src/entity`.
- [ ] 5.2 Support initializing the queue from existing credit and subject attribution DTOs.
- [ ] 5.3 Support local add, remove, reorder, and replace operations without immediate server mutation.
- [ ] 5.4 Coalesce local queue state into final per-role `setCredits` and `setSubjects` batch ops.
- [ ] 5.5 Expose dirty-state, save-state, and error-state helpers suitable for book/game/media editor composition.
- [ ] 5.6 Preserve local queue state when batch save fails.

## 6. Book Editor Migration

- [ ] 6.1 Migrate book credit editing from immediate link/unlink mutations to the shared entity attribution queue.
- [ ] 6.2 Save book credit changes through the new entity attribution batch mutation.
- [ ] 6.3 Remove book-local reusable queue logic if present after migration.
- [ ] 6.4 Confirm the book editor still supports selecting/creating Entities through the existing `entity-picker` feature boundary.

## 7. Validation

- [ ] 7.1 Run targeted contract tests for entity attribution batch schemas.
- [ ] 7.2 Run targeted server tests for attribution batch reconciliation and history behavior.
- [ ] 7.3 Run targeted app/API tests for the shared queue and mutation invalidation.
- [ ] 7.4 Run `bun run check:convention`.
- [ ] 7.5 Run `bun run format:check` or format touched files with Biome.
- [ ] 7.6 Search for remaining book-local immediate attribution saves in editor surfaces and confirm multi-edit flows use the batch path.
