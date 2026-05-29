## Context

A book's table of contents is a tree of `ContentStructureNode` rows (stable
`uuidv7` ids). Reading is currently reachable two ways:

- `/book/:bookId/read/:chapterId` — keyed by the materialized content Unit
  (`contentUnitId`). Rendered by `book-read/*` (`BookReadLayout` →
  `BookReadChapterPage` → `BookReadChapterSection`). To address an *empty* node it
  uses a sentinel chapter id `EMPTY_CHAPTER_ROUTE_ID = "__bookContentStructurePath"`
  plus a `BookContentStructurePath` encoded into `?path=&title=` search params.
- `/book/:bookId/node/:nodeId` — keyed by `ContentStructureNode.id`. Rendered by
  `book-read-node/*` (`BookReadNodePage` → `BookReadNodeSection` →
  `EmptyNodeView` / `ReadingNodeView` / `DeletedNodeView`), with state resolved by
  `resolveNodeView`.

Three TOC components each reimplement the sentinel+path link logic:
`book-library/components/Chapter/{ChapterList,ContentChapterVirtualTree,ChapterArboristNode}.tsx`.
The path machinery lives in `book-library/models/bookContentStructurePath.ts`
(`encode/decodeBookContentStructurePath`, occurrence helpers, `EMPTY_CHAPTER_ROUTE_ID`).

Backend materialize (`POST /chapter/materialize/book/:bookUnitId`,
`chapterService.materializeByBookPath`) accepts `{ path, expectedTitle,
expectedBookContentStructureUpdatedAt }`. It walks the tree via
`contentStructureService.getNodeByPath` → `resolveContentStructurePath`, then writes
`tx.contentStructureNode.update({ where: { id: node.id }, data: { contentUnitId } })`.
The path is only an indirection to recover `node.id`.

Constraints: dev-stage clean cutover (no URL back-compat, update all internal call
sites in the same change); feature layering per `package/app/docs/feature standard.md`
(`models/` stays React-free; external access via feature `index.ts`); contract-first
DTOs in `@rezics/contract`, frontend access via `@rezics/api`.

## Goals / Non-Goals

**Goals:**

- `/book/:bookId/node/:nodeId` is the single reading route; `/read/:chapterId` is deleted.
- Materialize is node-addressed: request body `{ nodeId }`; stale-path guards removed.
- All TOC links and the post-materialize navigation target address by `nodeId`.
- Empty/reading chapter behaviors preserved with no regression on the node view.
- Dead path/sentinel client machinery removed where nothing else references it.

**Non-Goals:**

- No change to `/book/:bookId/edit/:chapterId`, `/review/new/:bookUnitId`, chapter
  discussion targeting, or `GET /chapter/:unitId` — these key on content identity by design.
- No removal of the generic content-structure service's path parsing/resolution
  (`resolveContentStructurePath`, `getNodeByPath`) — series and internal flows keep it.
  Only the book-chapter materialize *contract* drops `path`.
- No database migration; no progress-data change (`lastReadNodeId` already node-keyed).
- No redirect/compat shim for old `/read/:chapterId` URLs.

## Decisions

### D1. Node id is the canonical reading address (not content id)

The node owns *position*; the content Unit owns *content*. Reading, progress, TOC,
and per-node completion are positional and already node-keyed (`lastReadNodeId`,
`UserContentNodeProgress`, the node route). Content reuse — the same `contentUnitId`
at multiple nodes (`type-extension-book`: "Multiple BookContentStructureNode rows may
reference the same chapter Unit") — makes content-id addressing *ambiguous* about
which occurrence the reader is at, while node-id is unambiguous. **Alternative
considered:** keep both routes and redirect `/read` → `/node`. Rejected: it preserves
the ambiguous addressing and the sentinel/path machinery, buying nothing in a
dev-stage codebase with a clean-cutover rule.

### D2. Materialize keys on nodeId; drop path and the stale guards

The service already resolves to `node.id` and updates `where: { id }`, so switching
the contract to `{ nodeId }` is a small change: look the row up by id (filtered to the
owning book + `isDeleted = false`) instead of walking a path. The
`expectedTitle` / `expectedBookContentStructureUpdatedAt` guards exist solely to catch
a reorder shifting a numeric path; a uuid cannot drift under reorder, so they are
removed (see the REMOVED requirement in the `type-extension-book` delta). Idempotency
(return existing `contentUnitId`) is unchanged. **Alternative considered:** accept
both `path` and `nodeId`. Rejected: leaves the leaky abstraction and two code paths;
the spec already names `nodeId` the preferred key.

### D3. Migrate read-route behavior into the node views before deletion

`BookReadChapterSection` currently carries: markdown render of a materialized chapter,
the edit pencil, and the empty-chapter action set (create/edit content, review,
discuss, save position) via `useEnsureChapterUnit` + `progressApi`. These must land in
`ReadingNodeView` (materialized: render + edit affordance) and `EmptyNodeView` (empty:
the action set) so deleting the read route loses nothing. The node already resolves
empty vs reading via `resolveNodeView`, so this is a behavior move, not new control
flow. Edit/review still navigate to the existing content-keyed routes after on-demand
materialization. **Alternative considered:** delete the read route first and backfill
later. Rejected: guarantees a functionality gap window.

### D4. Prune path/sentinel machinery only after callers are gone

After D1–D3, sweep references to `EMPTY_CHAPTER_ROUTE_ID`,
`encode/decodeBookContentStructurePath`, and the occurrence helpers. Delete what is
unreferenced; keep anything the TOC editor / series flows still import. This ordering
(callers first, then delete defs) keeps each step compiling.

## Risks / Trade-offs

- **Behavior regression when the read route is deleted** → Migrate D3 first and gate
  deletion on a parity check: enumerate every action/affordance in
  `BookReadChapterSection` and confirm an equivalent exists in the node views before
  removing `book-read/*`.
- **`useEnsureChapterUnit` still threads a `path`** (its input takes `{ title, path,
  contentUnitId }`) → Update the hook and the materialize client to pass `nodeId`;
  audit all four call sites (`BookReadChapterSection`, `BookTocEditor`, `EmptyNodeView`,
  `BookReadNodeSection`). The TOC editor materializes from its own in-memory tree where
  a server `nodeId` may be absent for unsaved nodes — confirm the editor save persists
  the row (yielding an id) before materialize, or materialize post-save.
- **Old `/read/:chapterId` bookmarks/shares break** → Accepted per dev-stage clean
  cutover; no redirect.
- **Path resolution still used elsewhere** → Scope the removal to the materialize
  contract only; leave `resolveContentStructurePath`/`getNodeByPath` for series and
  internal callers (verified before deletion).
- **Contract shape change ripples to mock/tests** → `chapterMaterializationRequest/
  ResponseSchema` change; update `@rezics/api` client, factory/seed, and any contract
  tests that build the old `{ path, expected* }` body.

## Migration Plan

1. Land D3 (move behaviors into node views) while both routes still exist.
2. Change the contract + backend materialize to `{ nodeId }` (D2); update `@rezics/api`
   client and all materialize call sites.
3. Repoint the three TOC components and the `onMaterialized` callback to the node route (D1).
4. Delete the `/read/:chapterId` route and the `book-read/*` feature.
5. Prune dead path/sentinel machinery (D4).
6. Update affected tests/stories/factory; run `bun test`, `knip`, `check:convention`.

Rollback: revert the change set; no data migration to undo.

## Open Questions (resolved)

- **TOC editor materialize-on-open — persisted `nodeId`?** *Resolved: materialize
  requires a persisted `nodeId`.* `BookContentStructureOccurrence.nodeId` is
  round-tripped from server reads and is `undefined` only for client-created nodes
  not yet saved. `BookTocEditor.handleNavigateToChapter` already gates navigation on
  the chapter being persisted (it previously alerted when neither `contentUnitId` nor
  `path` was present). The gate is switched to require `contentUnitId || nodeId`:
  an unsaved node must be saved (which assigns its server id) before it can be
  materialized/opened. `useEnsureChapterUnit` therefore takes `{ contentUnitId,
  nodeId, title }` and throws if both `contentUnitId` and `nodeId` are absent. No
  materialize-after-save coupling is introduced.
- **Are `resolveContentStructurePath` / `getNodeByPath` used elsewhere?** *Resolved:
  yes — keep them.* `getNodeByPath` is called by the book materialize path (removed
  here) **and** `contentStructureService` retains `resolveContentStructurePath`
  (used by `service.ts` line ~388 for series/internal node resolution). Only the
  `getNodeByPath` call inside `chapter.service.materializeByBookPath` is removed; the
  `getNodeByPath` method and `resolveContentStructurePath` stay for other callers.

## Parity checklist (task 1.1 — gate before deleting `book-read/*`)

Every affordance in `BookReadChapterSection` and its node-view equivalent:

| Read-route affordance (`BookReadChapterSection`) | Node-view equivalent |
| --- | --- |
| Render materialized chapter markdown (`md.render` + `handleExternalLinkClick`) | `ReadingNodeView` (already present) |
| Chapter title heading | `ReadingNodeView` / `EmptyNodeView` |
| Edit pencil → `/book/$bookId/edit/$contentUnitId` (canEdit) | `ReadingNodeView` (added) |
| Empty: description + actions hint copy | `EmptyNodeView` (added) |
| Empty: "Save reading position" (book progress, no materialize) | `EmptyNodeView` (added) |
| Empty: create chapter content → ensure → node URL (canEdit) | `EmptyNodeView` "Edit content" CTA → `onMaterialized` (node URL); the editor is then reachable via `ReadingNodeView`'s edit pencil |
| Empty: "Write chapter review" → ensure + `/review/new/$bookUnitId` | `EmptyNodeView` (added) |
| Empty: "Discuss chapter" → ensure + inline `ReplyComposer` + `PostListSection` | `EmptyNodeView` (added) |

Note: the read route had two save actions — a no-materialize "Save reading position" and a materialize-then-save "Save chapter progress". The latter is dropped: it contradicts the `type-extension-book` scenario "Book-level progress stores nodeId without materialization". Only the no-materialize save survives.
