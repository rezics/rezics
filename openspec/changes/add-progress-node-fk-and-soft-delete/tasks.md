## 1. Schema migration

- [ ] 1.1 Add `isDeleted Boolean @default(false)` and `deletedAt DateTime?` to `ContentStructureNode` in `package/server/prisma/schema.prisma`; replace existing `@@index([ownerUnitId, parentId, sortKey])` with `@@index([ownerUnitId, parentId, sortKey, isDeleted])` and add `@@index([ownerUnitId, isDeleted, updatedAt(sort: Desc)])`.
- [ ] 1.2 Drop `lastPosition Json?` from `UserUnitProgress`; add `lastReadNodeId String? @db.Uuid`, `lastReadAnchor Json?`, and `lastReadNode ContentStructureNode? @relation("UserUnitProgressLastNode", fields: [lastReadNodeId], references: [id], onDelete: SetNull)` plus inverse relation `userProgressLastNode UserUnitProgress[] @relation("UserUnitProgressLastNode")` on `ContentStructureNode`.
- [ ] 1.3 Add `UserContentNodeProgress` model with composite `@@id([userId, nodeId])`, `completedAt DateTime @default(now())`, FKs to `User.unitId` (cascade) and `ContentStructureNode.id` (cascade), index `@@index([nodeId])`; add inverse relations on `User` and `ContentStructureNode`.
- [ ] 1.4 Run `bun --filter=@rezics/server run prisma:migrate` to generate the destructive migration; confirm migration drops `lastPosition` and adds the new columns/tables.
- [ ] 1.5 Run `bun --filter=@rezics/server run prisma:generate` and verify the Prisma client types reflect the new model surface.

## 2. Contract layer changes (`@rezics/contract`)

- [ ] 2.1 In `package/contract/src/progress.ts`, remove `contentStructurePathLastPositionSchema`, `chapterLastPositionSchema`, `unitLastPositionSchema`, and the corresponding exported TS types (`ContentStructurePathLastPosition`, `ChapterLastPosition`, `UnitLastPosition`).
- [ ] 2.2 Add `lastReadAnchorSchema = t.Object({ text: t.String({ minLength: 1, maxLength: 200 }) }, { additionalProperties: false })` and export `LastReadAnchor`.
- [ ] 2.3 Update `unitProgressUpsertBodySchema`: drop `lastPosition`, add `lastReadNodeId: t.Optional(t.Nullable(t.String()))`, `lastReadAnchor: t.Optional(t.Nullable(lastReadAnchorSchema))`.
- [ ] 2.4 Update `unitProgressRowDTOSchema`: drop `lastPosition`, add `lastReadNodeId: t.Nullable(t.String())`, `lastReadAnchor: t.Nullable(lastReadAnchorSchema)`.
- [ ] 2.5 Add `nodeCompletionToggleBodySchema = t.Object({ nodeId: t.String(), isCompleted: t.Boolean() })` and export `NodeCompletionToggleBody`.
- [ ] 2.6 Update `package/contract/src/progress.test.ts` to cover the new shapes and the rejection of `lastPosition` and `{ text: "" }`.
- [ ] 2.7 Repo grep `unitLastPositionSchema|contentStructurePathLastPositionSchema|chapterLastPositionSchema|UnitLastPosition|ContentStructurePathLastPosition|ChapterLastPosition` — confirm zero matches outside the removal commit.

## 3. Backend: content-structure soft delete

- [ ] 3.1 In `package/server/src/content-structure/service.ts`, modify `getByOwnerUnitId` and `getNodeByPath` to filter `isDeleted: false` in the `findMany`/`findUniqueOrThrow` queries.
- [ ] 3.2 Modify `update()` to filter `current` rows to `isDeleted: false`. Detect submitted ids that match a row with `isDeleted: true` and throw `AppError(409, "content_structure_node_deleted")` before any write.
- [ ] 3.3 Replace the `tx.contentStructureNode.deleteMany` branch in `update()` with the new `softDeleteNodes` flow: promote non-target children's `parentId` to `null`, then mark targets `isDeleted = true, deletedAt = now()`. Bump container `updatedAt` once.
- [ ] 3.4 Implement `softDeleteNodes(ownerUnitId, nodeIds[], options)`: idempotent (skip already-deleted), children-promote-to-root respecting "targets keep buried targets" rule (filter `id: { notIn: nodeIds }` on the promote step), single history outbox row per call with operation `node.delete` payload extended with `softDelete: true` and `promotedChildIds`.
- [ ] 3.5 Implement `restoreNodes(ownerUnitId, nodeIds[], options)`: look up original `parentId`; if the original parent is `isDeleted: true`, fall back to `parentId: null`; preserve original `sortKey`. Skip targets that are not `isDeleted = true`. Single history outbox row per call with new operation `node.restore` payload (`nodeId`, resulting `parentId`, resulting `sortKey`, `fallbackToRoot`).
- [ ] 3.6 In `package/server/src/content-structure/mapper.ts`, ensure `buildContentStructureTree` and `resolveContentStructurePath` operate over caller-filtered rows (callers already filter; verify no inference of deleted nodes inside the mapper). Add a `// soft delete: callers MUST filter isDeleted` invariant comment at the top.
- [ ] 3.7 In `package/server/src/content-structure/types.ts`, extend `ContentStructureNodeRow` and `ExistingContentStructureRow` with `isDeleted` and `deletedAt` to keep types accurate at service-layer touchpoints.
- [ ] 3.8 Extend `planContentStructureOperations` so the `node.delete` operation it emits carries `softDelete: true` and `promotedChildIds: string[]` derived from the diff context (or change callers to emit the payload directly if the diff signature can't carry it).
- [ ] 3.9 Add a `node.restore` payload type in `package/contract/src/content-structure.ts` (or its history adjacent module) so consumers can decode it.
- [ ] 3.10 Write unit tests for: soft delete single → children promote; batch with parent + selected child → child stays buried; restore with alive parent; restore with dead parent (root fallback); update() rejects deleted id; update() ignores deleted rows from baseline.

## 4. Backend: progress service & route

- [ ] 4.1 In `package/server/src/progress/progress.service.ts`, replace all `lastPosition` reads/writes with `lastReadNodeId` + `lastReadAnchor`. Update the upsert function signature and the row mapper accordingly. Reject upserts whose `lastReadNodeId` points to a soft-deleted node (409).
- [ ] 4.2 In `package/server/src/progress/progress.service.ts`, add `toggleNodeCompletion(userId, bookUnitId, nodeId, isCompleted)`: validate `node.ownerUnitId === bookUnitId` (422 otherwise) and `node.isDeleted === false` (409 otherwise); upsert/delete `UserContentNodeProgress` row; do NOT touch `UserUnitProgress`.
- [ ] 4.3 In `package/server/src/progress/progress.api.ts`, register `POST /me/units/:unitId/node-completion` route bound to `toggleNodeCompletion`. Use `nodeCompletionToggleBodySchema` for body validation. Wire authentication and per-user scoping the same way the existing progress endpoints do.
- [ ] 4.4 Update `package/server/src/progress/progress.service.test.ts` to cover: upsert with `lastReadNodeId`; upsert rejecting deleted node; toggle on (idempotent), toggle off (idempotent), toggle on a deleted node rejected, toggle on a cross-book node rejected.
- [ ] 4.5 Audit `package/server/src/book/book.service.ts` and `package/server/src/chapter/chapter.service.ts` for `lastPosition` reads or `BookContentStructure.path`-style consumers tied to it; update or remove.

## 5. Backend: history outbox events

- [ ] 5.1 In `package/server/src/unit/history-outbox.ts`, extend the structure event payload types to model the new `softDelete`, `promotedChildIds`, and `node.restore` fields. Add type-level discriminator for `node.restore`.
- [ ] 5.2 Verify `buildStructureEventPayload` accepts the new operation shape without runtime validation gaps. Add a unit test exercising both `node.delete (softDelete: true)` and `node.restore` payloads.
- [ ] 5.3 Audit `package/job-runner/src/sequin/router.ts` and any downstream consumer of structure events; surface the new fields where the consumer needs to act on them (or leave existing consumers tolerant — verify they don't reject unknown payload keys).

## 6. Frontend: progress + reader

- [ ] 6.1 In `package/app/src/book-read/sections/BookReadChapterSection.tsx`, replace the `handleSaveBookPosition` body that constructs `kind: "contentStructurePath"` with an upsert carrying `lastReadNodeId: node.id` (resolve `node` via the loaded TOC — the row already exposes `id`). Remove all references to `kind: "contentStructurePath"`.
- [ ] 6.2 In `package/app/src/progress-status/components/ActiveProgressModal.tsx`, replace the `lastPositionChapterId` helper that reads `lp.kind === "chapter"` with a helper that reads `lp.lastReadNodeId` and resolves the chapter id via the loaded TOC. Update the modal's pre-fill flow.
- [ ] 6.3 In `package/app/src/progress-status/hooks/useChapterPicker.ts`, update any logic that consumes `lastPosition` to use `lastReadNodeId`.
- [ ] 6.4 Update `@rezics/api` (or the equivalent app-facing API client) hooks (`useUpdateUnitProgress`, etc.) to surface the new field names in their typings — the contract change in §2 should drive this through.
- [ ] 6.5 Repo grep `lastPosition|kind: "contentStructurePath"|kind === "chapter"|ChapterLastPosition|ContentStructurePathLastPosition` under `package/app/src` — confirm zero matches outside the removal commit.

## 7. Frontend: /book/:bookId/node/:nodeId route

- [ ] 7.1 Add a new route `/book/:bookId/node/:nodeId` to the app router. Hook into existing TanStack Router or equivalent registration in `package/app/src` per the existing route convention.
- [ ] 7.2 Add a new feature folder `package/app/src/book-read-node/` (or extend `book-read/`) following the layered feature structure in `package/app/docs/feature standard.md`: `models/` (pure resolution: given node + chapter Unit, dispatch view state), `hooks/`, `components/`, `sections/`, `index.ts`.
- [ ] 7.3 Implement the three-state view dispatch: deleted placeholder, empty-node placeholder with "Create chapter" CTA, reading view with TOC sidebar + "Mark as read" toggle.
- [ ] 7.4 In the empty-node CTA flow, reuse `useEnsureChapterUnit` (or the materialization endpoint it wraps); call materialization by `nodeId` (extend `useEnsureChapterUnit` if it currently only accepts paths).
- [ ] 7.5 In the reading view, write `lastReadNodeId` to `UserUnitProgress` on mount / scroll-debounced updates. Wire the "Mark as read" toggle to the new `POST /me/units/:unitId/node-completion` endpoint.
- [ ] 7.6 In the deleted-node placeholder, render a restore CTA for users with edit permission (use `useCanEdit`). The CTA SHALL call the `restoreNodes` content-structure service path (add an API client hook for it).
- [ ] 7.7 Update the TOC sidebar component to highlight the current `nodeId` and to show per-node completion checkmarks driven by `UserContentNodeProgress` rows fetched per book.

## 8. Backend: client helpers and seed updates

- [ ] 8.1 In `package/app/src/book-library/models/bookContentStructurePath.ts` and `package/app/src/book-library/models/bookContentStructurePath.test.ts`, keep the path utilities (TOC editor still needs them) but remove any function that constructs a `kind: "contentStructurePath"` payload.
- [ ] 8.2 Update `package/server/prisma/factory/content-structure.ts`, `package/server/prisma/factory/books.ts`, `package/server/prisma/seed/database.ts`, and any other factory/seed that writes `lastPosition` or hard-deletes content-structure rows. Replace with `lastReadNodeId` / `lastReadAnchor` writes and the new soft delete service.
- [ ] 8.3 Update `package/utils/src/factory/presets/book-multi-link-toc.ts` if it currently exercises the multi-link case via `chapter` lastPosition; the multi-link demo should now exercise the `nodeId` precision instead.
- [ ] 8.4 Audit `package/server/prisma/seed/**` for any TOC fixture that hard-deletes nodes via `prisma.contentStructureNode.delete`; route through the new service or remove if it was only proving the old hard-delete path.

## 9. Sweep, doc, and verification

- [ ] 9.1 Repo grep `contentStructureNode.deleteMany|contentStructureNode.delete\(` outside `softDeleteNodes` — confirm there are no other hard-delete callsites in application code (admin tooling excepted).
- [ ] 9.2 Repo grep `isDeleted: false` across content-structure read paths to confirm every list/find call includes the filter; missing filters become bugs.
- [ ] 9.3 Update `openspec/specs/type-extension-book/spec.md` scenario "Book-level progress stores path without materialization" to reference `lastReadNodeId` (the delta in this change handles the requirement; this task validates that the delta archives cleanly).
- [ ] 9.4 Run `bun run check:convention` and `bun run check:tokens` at the repo root; resolve any new violations.
- [ ] 9.5 Run `bun run format` and `bun run knip`; address unused exports introduced or revealed by the cutover.
- [ ] 9.6 Run `bun --filter=@rezics/server test` and `bun --filter=@rezics/contract test`; ensure all updated tests pass.
- [ ] 9.7 Start `bun run dev`, navigate to a book with a TOC, exercise: read a chapter (verify `lastReadNodeId` is set in the progress row), mark a chapter as read (verify row appears in `UserContentNodeProgress`), unmark (verify row deleted), open an empty-node URL (verify placeholder), soft-delete a node via the TOC editor (verify children promote to root and the deleted node disappears from the visible TOC), restore via API (verify the node returns to its original placement).
- [ ] 9.8 Open and resolve `openspec/changes/add-progress-node-fk-and-soft-delete/specs/type-extension-book/spec.md` references — verify archive readiness with `openspec status --change "add-progress-node-fk-and-soft-delete"`.
