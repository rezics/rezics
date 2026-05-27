## 1. Generic Content-Structure Schema

- [x] 1.1 Add Prisma models for `ContentStructure` and `ContentStructureNode` keyed by `ownerUnitId`.
- [x] 1.2 Rename the node identity column from `chapterUnitId` semantics to `contentUnitId`.
- [x] 1.3 Preserve existing normalized tree behavior: parent links, LexoRank `sortKey`, non-unique content-unit references, per-node timestamps, rating/noContent/title cache fields, and cascade/delete semantics.
- [x] 1.4 Add migrations/backfill from `BookContentStructure` / `BookContentStructureNode` to generic tables.
- [x] 1.5 Add drift/parity checks proving generic rows reconstruct the same book trees before compatibility cleanup.

## 2. Generic Server Domain

- [x] 2.1 Create `package/server/src/content-structure/` with `.api.ts`, `.service.ts`, `.mapper.ts`, and `.types.ts`.
- [x] 2.2 Move tree assembly, path parsing/resolution, diff planning, and batch save logic out of the book domain.
- [x] 2.3 Expose generic read/update APIs by `ownerUnitId`.
- [x] 2.4 Keep book content-structure endpoints as compatibility wrappers over the generic service.
- [x] 2.5 Update history event writing so generic mutations emit generic content-structure payloads and book-specific event names remain compatibility only.

## 3. Book/Chapter Adapter

- [x] 3.1 Refactor chapter materialization to resolve generic `ContentStructureNode` rows by `ownerUnitId` path.
- [x] 3.2 Keep book-specific materialization responsible for creating `Unit(type=POST)` + `Post(kind=CHAPTER)`.
- [x] 3.3 Change materialization responses to expose canonical `contentUnitId`, with `chapterUnitId` only as documented compatibility.
- [x] 3.4 Update chapter rename/content propagation to update generic `ContentStructureNode(contentUnitId)` rows.
- [x] 3.5 Preserve `Book.chapterCount` recalculation for readable book content-structure nodes.

## 4. Contracts And API Clients

- [x] 4.1 Add generic content-structure DTO schemas/types in `package/contract`.
- [x] 4.2 Re-export or alias book-named DTOs only where compatibility is required.
- [x] 4.3 Add `package/api` generic content-structure client/query keys/mutations.
- [ ] 4.4 Convert internal app/api imports that do not need book-specific semantics to generic names.
- [ ] 4.5 Keep `targetUnitId` reserved for interactions; content-structure node identity must remain `contentUnitId`.

## 5. Seeds, Factories, And Cross-Domain Consumers

- [x] 5.1 Update book factories/seeds to write generic content-structure rows.
- [ ] 5.2 Provide helper APIs for game/media/series fixtures to create content-structure nodes for release parts or series members.
- [ ] 5.3 Update seed reports and fixture docs to use `ownerUnitId` / `contentUnitId` terminology.

## 6. Admin Work Merge Async Execution

- [x] 6.1 Change admin work merge start to create a durable operation and enqueue execution instead of synchronously moving memberships in the request path.
- [ ] 6.2 Add job-runner handlers that process membership moves, legacy release sync, optional metadata copy, and repair enqueueing in resumable batches.
- [ ] 6.3 Persist item-level progress and enough before-state for revert as each batch completes.
- [ ] 6.4 Ensure operation status reflects queued/running/completed/failed states after repair commands are enqueued.
- [ ] 6.5 Keep dry-run preview synchronous, but make active merge execution async/resumable.

## 7. Verification

- [ ] 7.1 Run targeted contract tests for generic content-structure DTOs and compatibility aliases.
- [ ] 7.2 Run targeted server tests for generic tree read/write/path resolution, book wrappers, chapter materialization, and history events.
- [ ] 7.3 Run migration/parity tests for existing book content-structure rows.
- [ ] 7.4 Run job-runner/server tests for queued admin work merge execution and resumability.
- [x] 7.5 Run `openspec validate finish-unit-work-domain-archive-gaps --strict`.
