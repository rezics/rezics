## Context

The current history system already separates canonical writes from history persistence through `HistoryOutbox`, `UnitHistoryClock`, `UnitRevision`, `RevisionContent`, and `StructureEvent`. The important missing rule is product semantics: those records represent committed user-visible changes, not editor draft state or every small UI gesture.

Two existing surfaces show both sides of the model:

- Book content structure already behaves as a logical batch. The frontend edits a tree locally and the server records one `book.contentStructure.batch` structure event for the save.
- Credit and subject attribution editing currently exposes link/unlink mutations. A UI that lets the user add, remove, and reorder several entities can accidentally produce several editorial revisions if it replays each local gesture to the server.

The entity attribution case is cross-domain. Books use it today, but games, media, posts, chapters, and future library content need the same editing substrate.

## Goals / Non-Goals

**Goals:**

- Document that history tables store canonical commit records, not autosave or draft operation streams.
- Add schema comments that make the version model visible where future maintainers will look first.
- Add a unit-scoped entity attribution batch endpoint for one semantic save of credit and subject attribution sets.
- Move reusable entity attribution edit queue state into the app `entity` feature so book/game/media/library editors do not reimplement the same queue.
- Preserve existing single link/unlink APIs for simple immediate operations.

**Non-Goals:**

- Implement a persistent autosave/draft database.
- Implement CRDT, collaborative cursors, or real-time multi-user editing.
- Redesign `ContentDoc` slot editing.
- Add history coverage to every high-change structure such as shelf or realm extra in this change.
- Remove existing credit or subject link/unlink endpoints.

## Decisions

### Decision: History records are commit records

`HistoryOutbox` SHALL be written only for canonical mutations that are in history scope. A client draft, autosave tick, local op-log entry, drag event, entity picker selection, or keystroke SHALL NOT write `HistoryOutbox` directly.

Rationale:

- History UI needs meaningful restore points and comparisons.
- Per-click revisions obscure semantic changes and make revert/compare noisy.
- Existing book content structure already proves the batch event pattern.

Alternatives considered:

- Record every UI operation as a revision. Rejected because the timeline becomes an editor recovery log rather than product history.
- Store autosaves in `UnitRevision`. Rejected because draft retention, ownership, and conflict semantics differ from published history.

### Decision: Entity attribution batch endpoint is unit-scoped

The server exposes:

```text
PATCH /unit/:unitId/entity-attributions/batch
```

The request shape is:

```ts
type EntityAttributionBatchRequest = {
  baseVersion?: string;
  message?: string;
  ops: EntityAttributionBatchOp[];
};
```

The initial op family reconciles final per-role sets:

```ts
type EntityAttributionBatchOp =
  | {
      op: "setCredits";
      role: CreditAttributionRoleKey;
      entries: Array<{ entityId: string; sortOrder?: number }>;
    }
  | {
      op: "setSubjects";
      role: SubjectAttributionRoleKey;
      entries: Array<{
        entityId: string;
        sortOrder?: number;
        weight?: number | null;
      }>;
    };
```

Rationale:

- Attributions belong to the target content Unit, not to the referenced Entity.
- `setCredits` / `setSubjects` capture final state after local editing and avoid persisting transient UI intent.
- One request can validate authority, reconcile rows, update search projections, and write one history revision.

Alternatives considered:

- `PATCH /entity-attributions/batch`: rejected because the route hides the target Unit identity and conflicts with the meaning of Entity as the referenced object.
- `POST /unit/:unitId/entity-attributions/commit`: rejected because current API style uses resource mutation verbs and shelf already uses `/batch`.
- Add/remove/reorder ops over the wire: deferred. The client may keep that local queue, but the canonical request should submit final per-role sets first.

### Decision: Batch commit writes one editorial revision

The batch service SHALL run in one transaction:

1. Derive affected patch paths, for example `credits.authors` and `subjects.primary_character`.
2. Run the existing path-based authority check once for the affected paths.
3. Validate role keys and entity eligibility.
4. Reconcile `CreditAttribution` and `SubjectAttribution` rows to match the requested final sets.
5. If no effective row changes occur, write no history.
6. If at least one role changes, write one `HistoryOutbox` editorial revision with default message `entity-attribution.batch` unless the request provides `message`.

The history patch stores final sparse state, not the local UI op log.

Rationale:

- This matches the existing editorial PATCH model: revision payloads are content state for restore/compare, not transport logs.
- A single revision can describe a multi-role editor save.
- No new history category is required because credits and subjects are editorial metadata.

### Decision: Shared frontend queue belongs to the entity feature

Reusable local edit state for entity attribution editing SHALL live under `package/app/src/entity`. Book-specific UI may compose it, but it SHALL NOT own the queue implementation.

The frontend queue may expose helpers such as:

- initialize from existing credit and subject DTOs;
- add/remove/reorder entries locally;
- coalesce repeated local edits into final per-role `setCredits` / `setSubjects` ops;
- report dirty state and failed save errors.

Rationale:

- Book authors are the first consumer, not the owner of the abstraction.
- Game, media, wiki, chapter, and other library content will need the same entity attribution editor.
- Keeping queue logic in `models/` or hooks avoids React component coupling and respects the app feature layering rules.

### Decision: Schema comments are part of the change

The implementation SHALL add concise Prisma documentation comments:

- main server:
  - `UnitHistoryClock`
  - `HistoryOutbox`
- history service:
  - `UnitRevision`
  - `RevisionContent`
  - `StructureEvent`

The comments SHALL state that these models represent canonical history commits and SHALL NOT be used for editor autosave/draft/op-log persistence.

Rationale:

- The risk is conceptual misuse by future changes, not just missing code.
- Prisma schema is the first place maintainers inspect persistence semantics.

## Risks / Trade-offs

- [Risk] Existing book credit editor may still call link/unlink directly. -> Mitigation: migrate the book editor to the shared entity queue and batch endpoint in this change.
- [Risk] `setCredits` may be less expressive than an operation log for audit. -> Mitigation: product history needs final semantic state; local intent can stay in the frontend queue or future draft system.
- [Risk] No persistent draft means browser refresh can lose unsaved entity attribution edits. -> Mitigation: persistent draft/autosave is explicitly deferred; current scope only prevents multiple history revisions per save.
- [Risk] Multiple role sets in one request may partially validate. -> Mitigation: the batch commit is transactional; any validation failure rejects the whole request and writes no history.

## Rollout

1. Add contract schemas/types for `EntityAttributionBatchRequest`, ops, response, and route params.
2. Add the unit-scoped server endpoint and service reconciliation.
3. Add API client method, mutation hook, and query invalidation.
4. Move/reuse frontend entity attribution edit queue under `package/app/src/entity`.
5. Migrate book credit editing to save through the batch endpoint.
6. Add schema comments for history commit semantics.
7. Run targeted contract/server/app tests and convention checks.
