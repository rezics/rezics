## Context

`UserUnitProgress.lastPosition` is currently a `Json?` column carrying a discriminated union with two `kind`s: `contentStructurePath` (a numeric path `number[]` into the TOC tree) and `chapter` (a `contentUnitId`). Both shapes exist because the system needs to remember a reader's position even when the target node has no materialized chapter Unit yet (empty TOC placeholder).

Reality check on real usage today:
- `contentStructurePath` is produced in exactly one place: `package/app/src/book-read/sections/BookReadChapterSection.tsx:110` (the "save my place" button on the empty-chapter view).
- `chapter` is consumed in exactly one place: `package/app/src/progress-status/components/ActiveProgressModal.tsx:49` (pre-fill the chapter picker).

The path representation is fragile: a TOC reorder silently invalidates the `number[]`. The chapter representation can't distinguish multi-link TOC occurrences. There is also no per-node completion record, so the system cannot show "X/Y chapters read" or per-row checkmarks.

`ContentStructureNode.id` is already globally unique and **stable across move, rename, and re-parent** (verified in `package/server/src/content-structure/service.ts:73–151` — diff-based update preserves ids; only removal from the submitted tree deletes a row). Today's only stability hazard is hard delete: a removed node takes any references with it.

Project is in active development per `CLAUDE.md`; no production data, no external client depends on the JSON shape.

## Goals / Non-Goals

**Goals**

- Replace fragile JSON path / chapter discriminators with a stable FK pointing at `ContentStructureNode.id`.
- Introduce `lastReadAnchor` for in-chapter resume position using a text snippet (resilient to small content edits), shaped as JSON `{ text }` to allow non-breaking extension later.
- Add per-(user, node) completion tracking driven only by explicit user action — never by passive visits — because rezics handles both linear and non-linear books.
- Move `ContentStructureNode` lifecycle to soft delete so reading positions, completion marks, and (subsequently) lastReadNodeId survive TOC restructuring; orphaned descendants promote to book root rather than vanishing.
- Open a node-scoped reading URL `/book/:bookId/node/:nodeId` that unifies the empty-node placeholder, reading view, and (later) deleted-node placeholder behind one path.

**Non-Goals**

- The trash / restore UI surface. Schema + service ship here; the editor surface ships separately.
- A "mark as read" UI surface inside the chapter reader. The endpoint and table land here; the button ships separately.
- Deprecating or moving `/chapter/:contentUnitId` — it stays.
- Backward compatibility shims for the removed JSON shape. Pre-release; no compat needed.
- A `viewedAt` event log or analytics aggregation table — out of scope.

## Decisions

### 1. FK + JSON anchor instead of an extended `lastPosition` discriminator

`UserUnitProgress` drops `lastPosition Json?` and gains:

```prisma
lastReadNodeId  String?  @db.Uuid
lastReadAnchor  Json?    // { text: string(<=200) } | null

lastReadNode    ContentStructureNode? @relation(
  "UserUnitProgressLastNode",
  fields: [lastReadNodeId], references: [id], onDelete: SetNull)
```

**Alternative considered**: add a third `kind: "contentStructureNode"` to the JSON union. Rejected — keeping JSON forces every reader to parse a discriminator, and every consumer to handle three legacy variants. With a real FK column the DB enforces referential integrity, queries can join naturally, and there is exactly one shape to validate.

**Why `onDelete: SetNull`** despite soft delete: defensive — soft delete is the policy, but if a hard delete ever does land (admin tooling, GDPR, accidents), null is a safer terminal state than a dangling uuid.

**Why JSON for `lastReadAnchor` (not `String?`)**: the immediate need is just a text snippet (`{ text }`), but a future precise resume might want `{ before, after, paragraphIndex }`. JSON allows that without a schema migration. The marginal cost over `String?` is one `jsonb` decode per read — negligible. Convention: empty = `null` (never `{}`), validated in the contract layer (`@rezics/contract`), max text length 200.

### 2. Per-node completion is a **manual** join table

```prisma
model UserContentNodeProgress {
  userId      String   @db.Uuid
  nodeId      String   @db.Uuid
  completedAt DateTime @default(now())

  user User                  @relation(...)
  node ContentStructureNode  @relation(
    fields: [nodeId], references: [id], onDelete: Cascade)

  @@id([userId, nodeId])
  @@index([nodeId])
}
```

No `progress`, no `isCompleted` (presence == true), no `lastSeenAt`, no `totalTimeMs`. Writes happen only when the user explicitly marks a node as completed via the new endpoint.

**Alternative considered**: auto-write on every node visit, surface "continue reading" from `MAX(lastSeenAt)`. Rejected — reference books, anthologies, choose-your-own-path readers visit nodes non-linearly; auto-writes produce noisy histories that don't reflect "what the user has actually read." Manual marking matches reader intent.

**Cascade choice**: `onDelete: Cascade` is set defensively. Soft delete is the policy; cascade is unreachable under the policy. If hard delete ever happens, cascade is correct.

### 3. `completedCount` redefined: full-book re-read counter

Previously documented as "completions" in a loose sense. With per-node completion now living in its own table, `UserUnitProgress.completedCount` is repurposed as **the number of times the user has read the full book**. The automatic increment on status `→ COMPLETED` (in the existing upsert spec) continues to apply unchanged. The per-node table answers "which chapters did the user mark read", and a derived "X/Y chapters" count is computed from `COUNT(UserContentNodeProgress) / countReadableContentStructureItems` at read time when the UI needs it.

This split avoids ambiguity: `completedCount` is a book-level milestone counter; `UserContentNodeProgress` is chapter-level granularity.

### 4. ContentStructureNode soft delete with children-promote-to-root

```prisma
model ContentStructureNode {
  // ... existing ...
  isDeleted Boolean   @default(false)
  deletedAt DateTime?

  @@index([ownerUnitId, parentId, sortKey, isDeleted])
}
```

Deleting a node:

1. Promote every **non-deleted** child whose `parentId` matches a deleted target up to `parentId = null` (book root), **except** children that are themselves in the same batch — those stay buried with their parent.
2. Set `isDeleted = true`, `deletedAt = now()` on the targets.

Restoring a node:

1. If the original `parentId` is null **or** still references an alive node → restore with original `parentId` and original `sortKey` (LexoRank guarantees no collision in practice; the column is a base36 fractional index per `package/server/src/book/lexorank.ts`).
2. If the original parent is itself deleted → fall back to `parentId = null`, keep original `sortKey`.
3. Children are not restored. They long since promoted to root; reorganizing them is a user action, not an automatic restore.

**Alternatives considered**:

- Strict cascade (delete children too): rejected — user said it's worse than empty-node UX; reading progress vanishes silently.
- Lazy parent-isDeleted filter (don't update children's `parentId`, hide them via JOIN filter): rejected — the user explicitly wants promoted children to be top-level entries the user can still see and use, not hidden behind a deleted ancestor.

### 5. `update()` flow no longer hard-deletes; rejects resurrection

The existing `ContentStructureService.update()` (`package/server/src/content-structure/service.ts:73`) currently diffs the submitted tree and hard-deletes nodes missing from the submission. Under soft delete:

- Diff continues. Missing nodes from `current` (filtered to `isDeleted = false`) become a soft-delete batch, processed via the same children-promote-to-root rule.
- `current` set when diffing **excludes** `isDeleted = true` rows. Those rows do not participate in the diff at all.
- If the submitted tree carries an id whose row has `isDeleted = true`, `update()` throws (`AppError`, 409). Resurrection must go through the explicit `restoreNodes` path.

This keeps tree-edit semantics unchanged for users who never touch the trash, while preventing accidental "I dropped a node back into the editor and now it's alive again" surprises.

### 6. Batch delete / restore as separate service methods

```ts
contentStructureService.softDeleteNodes(ownerUnitId, nodeIds[], options): Promise<void>
contentStructureService.restoreNodes(ownerUnitId, nodeIds[], options): Promise<void>
```

Distinct from `update()` because their input shape is different (id list, not whole tree) and their semantics are different (no diff). Both reuse the existing `writeSequencedHistoryOutbox` helper to emit history events:

- Delete: existing `node.delete` event, payload extended with `softDelete: true` and the child-promotion summary (which child ids were promoted to root).
- Restore: new event `node.restore`. Payload mirrors the delete shape (placement after restore).

### 7. `/book/:bookId/node/:nodeId` is one URL with three rendered states

The route resolves a node by `nodeId` and dispatches:

| Condition | View |
|---|---|
| `node.isDeleted = true` **or** chapter Unit `status = DELETED` | Deleted-node placeholder; owner sees a restore CTA (UI lands in a later change) |
| `node.contentUnitId = null` and `node.isDeleted = false` | Empty-node placeholder + "Create chapter" CTA. On create, set `node.contentUnitId` and stay at the same URL |
| Otherwise | Reading view: chapter content + TOC sidebar highlighting this node + "Mark as read" toggle that writes `UserContentNodeProgress` |

The existing `/chapter/:contentUnitId` route is kept untouched — it serves chapter-only views (search results, deep links, contexts without a book). It cannot precisely represent "which TOC occurrence I'm at" in a multi-link book; `/book/:bookId/node/:nodeId` exists for that.

`BookReadChapterSection.tsx` (the current consumer of `kind: contentStructurePath`) is rewritten to route via `/book/:bookId/node/:nodeId` and write `lastReadNodeId` instead of the JSON path payload.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Forgetting `WHERE isDeleted = false` in a query path lets deleted nodes leak into TOC reads | Audit checklist in tasks.md: enumerate every read path (service, mapper, factory, frontend hooks); add a soft-delete-aware test for the TOC GET. |
| Children-promote-to-root surprises users who expect deletion to bury the subtree | Document the rule in TOC editor help copy (UI change is out of scope for this change but flag for the editor follow-up); the multi-select delete path lets a user bury a whole subtree by selecting all of it. |
| Restored node's original `sortKey` could collide with a new key inserted at the same fractional position during the deletion window | LexoRank collisions are vanishingly rare (base36 fractional strings extend); even if they occur, lexicographic compare with id tiebreak keeps siblings deterministic. Add a unit test for the collision case and accept the tiebreak. |
| `UserContentNodeProgress` rows leak after manual hard-delete bypass (e.g., admin tooling) | Cascade FK handles it. Defensive choice noted in §2. |
| Removing the JSON union without compat breaks any out-of-tree consumer | Pre-release; no out-of-tree consumers. Grep for the removed schema names (`contentStructurePathLastPositionSchema`, `chapterLastPositionSchema`, `unitLastPositionSchema`) and remove the producer/consumer in the same change. |
| Anchor text `null` vs `{}` vs `{ text: "" }` ambiguity | Contract validates `null` as "no anchor"; `{ text }` with non-empty text otherwise. Empty string is rejected at the contract layer. |
| `type-extension-book` spec currently references `lastPosition` (the "Book-level progress stores path without materialization" scenario) | The scenario describes the OLD behavior. The spec delta in this change updates it to "stores `lastReadNodeId` without materialization". |

## Migration Plan

This is a development-stage repo with no production data. Migration is a clean cutover, not a data migration.

1. **Schema migration**: Single prisma migration drops `UserUnitProgress.lastPosition`, adds `lastReadNodeId` + `lastReadAnchor`, adds `isDeleted` + `deletedAt` on `ContentStructureNode`, creates `UserContentNodeProgress` table, adds related indexes.
2. **Contract changes**: Remove `unitLastPositionSchema`, `contentStructurePathLastPositionSchema`, `chapterLastPositionSchema` from `@rezics/contract`. Add `lastReadAnchorSchema`, `nodeCompletionToggleBodySchema`. Update `unitProgressUpsertBodySchema` and `unitProgressRowDTOSchema`.
3. **Server flip**: `ContentStructureService.update()` switches to soft delete + resurrection rejection. New methods `softDeleteNodes` / `restoreNodes`. Progress service grows `toggleNodeCompletion(userId, nodeId, isCompleted)` and updates its row mapper for the new columns. New `POST /unit-progress/:bookUnitId/node-completion` route.
4. **Frontend cutover**:
   - `BookReadChapterSection.tsx` writes `lastReadNodeId` instead of `kind: "contentStructurePath"`.
   - `ActiveProgressModal.tsx` reads `lastReadNodeId` and looks up the title via the loaded TOC, replacing the `kind: "chapter"` chapterUnitId path.
   - Add `/book/:bookId/node/:nodeId` route + page wiring.
5. **Seed adjustments**: Any factory or seed touching `lastPosition` updates to the new fields; any seed hard-deleting nodes updates to the soft-delete service (or is removed if it was only for testing the old path).
6. **Sweep**: Repo grep for the removed names; delete remaining references; spec docs in `type-extension-book` updated to match.

No rollback strategy beyond `git revert` — pre-release. The prisma migration is destructive on the JSON column.

## Open Questions

None at design time. Two implementation-time questions are tracked in tasks:

- Exact placement of `lastReadAnchor` validation (server boundary vs service boundary vs contract-only).
- Whether `node.restore` outbox event needs a payload field for "original parentId vs fallback parentId" decisions (likely yes; tasks.md notes it).
