## Why

`UserUnitProgress.lastPosition` currently stores a JSON discriminated union (`contentStructurePath` or `chapter` kinds) to remember the user's last reading position. The `contentStructurePath` variant uses `path: number[]` (positional indices into the TOC tree), which silently becomes wrong whenever the TOC is reordered. The `chapter` variant uses `contentUnitId`, which cannot disambiguate the same chapter appearing at multiple nodes (multi-link TOC). There is also no per-node completion record, so the system cannot surface "X/Y chapters read" or per-chapter checkmarks. Finally, `ContentStructureNode` only supports hard delete, so a TOC restructure permanently destroys both reading-position and any future per-node progress with no user recourse.

Now is the right time because the project is pre-release: there is no production data to migrate and no external client depending on the JSON shape.

## What Changes

- **BREAKING (no compat required)**: Remove `UserUnitProgress.lastPosition Json?` and the `contentStructurePath` / `chapter` lastPosition discriminated union from `@rezics/contract`. Replace with `lastReadNodeId String?` (FK to `ContentStructureNode`) plus `lastReadAnchor Json?` (currently `{ text: string(<=200) }`, JSON for forward extension).
- Add `isDeleted Boolean` + `deletedAt DateTime?` to `ContentStructureNode`. Hard delete is no longer supported.
- Soft-delete semantics: deleting a node promotes its non-deleted children to the book root (`parentId = null`). Multi-selected descendants of a deleted node stay buried with it. Restoring a node returns it to its original `parentId` and `sortKey` (LexoRank guarantees no collision); if the original parent is itself deleted, fallback to `parentId = null`.
- `ContentStructureService.update()` (the full-tree submit path) replaces hard `deleteMany` with soft delete and rejects any submitted node id whose row is `isDeleted = true` (no implicit resurrection).
- Add `ContentStructureService.softDeleteNodes(ownerUnitId, nodeIds[])` and `restoreNodes(ownerUnitId, nodeIds[])` for explicit batch delete/restore.
- History outbox: `node.delete` event payload gains `softDelete: true`; add `node.restore` event.
- Add `UserContentNodeProgress (userId, nodeId, completedAt)` table for **manual** per-node completion. Not auto-written on visit (non-linear books). Populated only by explicit user action.
- `UserUnitProgress.completedCount` redefined as "full-book re-read counter" (independent from per-node table).
- Add `POST /unit-progress/:bookUnitId/node-completion` endpoint to toggle a node completion mark.
- Add `/book/:bookId/node/:nodeId` route on the frontend. Resolves to: empty-node placeholder + create-chapter CTA when `node.contentUnitId === null`; deleted placeholder when `node.isDeleted` or chapter Unit `status === DELETED`; reading view otherwise. The existing `/chapter/:contentUnitId` route stays.
- Remove `kind: "contentStructurePath"` producer in `BookReadChapterSection.tsx`; consumer in `ActiveProgressModal.tsx` switches to read `lastReadNodeId` and resolve title via the loaded TOC.

Out of scope for this change: trash/restore UI surface, the manual "mark as read" UI surface, deprecation of `/chapter/:contentUnitId`.

## Capabilities

### New Capabilities
- `user-content-node-progress`: per-(user, node) manual completion marks. Backs "X/Y chapters read" and per-chapter checkmarks.

### Modified Capabilities
- `content-structure`: nodes gain soft-delete state; new batch soft-delete and restore service methods with children-promote-to-root semantics; existing `update()` no longer hard-deletes and rejects resurrection of deleted ids.
- `user-unit-progress`: `lastPosition` JSON union replaced by `lastReadNodeId` FK + `lastReadAnchor` JSON. `completedCount` semantics narrow to "full-book re-read counter".
- `type-extension-book`: add `/book/:bookId/node/:nodeId` route covering reading, empty-node placeholder, and deleted-node placeholder.

## Impact

**Affected packages**:
- `package/server` — `prisma/schema.prisma` schema changes, `src/content-structure/service.ts` (soft delete, restore, update flow), `src/content-structure/mapper.ts` (filter `isDeleted`), `src/progress/progress.service.ts` (FK fields + node completion), `src/progress/progress.api.ts` (new endpoint), history-outbox event additions.
- `package/contract` — `src/progress.ts` (remove `unitLastPositionSchema` / `contentStructurePathLastPositionSchema` / `chapterLastPositionSchema`; add `lastReadAnchorSchema`, `nodeCompletionToggleBodySchema`; update `unitProgressUpsertBodySchema` and `unitProgressRowDTOSchema`), `src/content-structure.ts` (filter notes; no schema change to node DTO since `isDeleted` rows are filtered at read time).
- `package/app` — delete `book-library/models/bookContentStructurePath.ts` callsites that depend on `kind: contentStructurePath`, update `BookReadChapterSection.tsx`, update `ActiveProgressModal.tsx`, add `/book/:bookId/node/:nodeId` route and feature.
- `package/server/prisma/seed`, `package/server/prisma/factory` — adjust seeds that touch `lastPosition` or hard-delete nodes.
- `openspec/specs/type-extension-book/spec.md` — currently references `contentStructurePath`; align with new model.

**Database migration**: schema change is breaking; since project is pre-release, prisma migration drops `lastPosition` and adds new columns directly. No data migration required.

**Backward compatibility**: none required. No published clients depend on the removed schema.

**Cross-cutting**:
- `progress-search-index` capability — verify index inputs don't depend on removed `lastPosition` fields.
- Any read path on `ContentStructureNode` must add `WHERE isDeleted = false`. A repo-wide audit is part of implementation.
