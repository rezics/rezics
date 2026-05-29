## Why

Book reading is addressed two incompatible ways at once. The legacy route
`/book/:bookId/read/:chapterId` keys navigation by the materialized content Unit
(`contentUnitId`), while `/book/:bookId/node/:nodeId` keys it by the structural
node (`ContentStructureNode.id`). The content-keyed route cannot address an
*empty* (unmaterialized) position, so it smuggles structure information through a
sentinel route id (`EMPTY_CHAPTER_ROUTE_ID = "__bookContentStructurePath"`) plus a
path encoded into search params — and three separate table-of-contents components
each reimplement that workaround.

This is not just untidy, it is incorrect. The data model already supports the
same `contentUnitId` appearing at multiple nodes (`type-extension-book`:
"Multiple BookContentStructureNode rows may reference the same chapter Unit"), so
content-keyed navigation is **ambiguous** about *which* occurrence the reader is
at — yet reading progress is recorded as `UserUnitProgress.lastReadNodeId`, which
is node-keyed. The materialize API compounds this: it accepts `path: number[]` and
carries `expectedTitle` / `expectedBookContentStructureUpdatedAt` guards whose only
purpose is to detect a TOC reorder racing the request and shifting what the path
points at. Every empty position is *already* a real `ContentStructureNode` row with
a stable `uuidv7` id (the materialize service walks the path only to recover
`node.id` and then writes `where: { id: node.id }`), so path-addressing is a leaky
abstraction over a row+id store, and node-addressing is strictly more correct:
stable under reorder, unambiguous under content reuse.

`type-extension-book` already declares `nodeId` the preferred materialization key
"required for `/book/:bookId/node/:nodeId` interactions", but the implemented API
still only accepts `path`. This change closes that gap and converges reading
navigation on the node.

## What Changes

This change converges **reading navigation** on `ContentStructureNode.id`. It does
**not** touch how content is edited, reviewed, or discussed — those legitimately
operate on content identity (`contentUnitId`), not position.

**Guiding principle:** the *node* owns navigation, progress, and the table of
contents; the *content Unit* (`contentUnitId`) owns editing, review, discussion,
and content fetch.

- **BREAKING** Remove the `/book/:bookId/read/:chapterId` route entirely.
  `/book/:bookId/node/:nodeId` becomes the sole canonical reading surface. This is
  a clean dev-stage cutover — no redirect, no URL back-compat.
- **BREAKING** Make the materialize API node-addressed:
  `POST /chapter/materialize/book/:bookUnitId` accepts `{ nodeId }` instead of
  `{ path }`, and drops the `expectedTitle` / `expectedBookContentStructureUpdatedAt`
  stale-path guards (a `nodeId` cannot go stale under reorder). The service change is
  small because it already updates by `where: { id: node.id }`.
- Point all three TOC components (`ChapterList`, `ContentChapterVirtualTree`,
  `ChapterArboristNode`) at `to="/book/$bookId/node/$nodeId"` with
  `params={{ nodeId: node.id }}`, dropping the sentinel + path + search-param logic.
- Change the post-materialization navigation target (the `EmptyNodeView`
  `onMaterialized` callback in `BookReadNodeSection`) from `/read/:chapterId` to
  `/node/:nodeId`.
- Migrate the empty/reading chapter behaviors currently living in the read route's
  page (`BookReadChapterSection`) — the edit / review / discuss / save-progress
  actions, the edit affordance, and markdown rendering — into the node-side views
  (`EmptyNodeView` / `ReadingNodeView`) so no functionality is lost when the read
  route is removed.
- Remove now-dead client machinery once nothing addresses by path:
  `EMPTY_CHAPTER_ROUTE_ID`, `encode/decodeBookContentStructurePath`, and the
  occurrence-path helpers in `bookContentStructurePath.ts` (delete what is
  unreferenced after the cutover; keep only what other features still use).

**Non-goals (explicitly unchanged, content-keyed):**

- `/book/:bookId/edit/:chapterId` (editing operates on content).
- `/review/new/:bookUnitId` (review targets content).
- Chapter discussion via `ReplyComposer` `targetUnitId` (interaction target).
- `GET /chapter/:unitId` content fetch — still the content carrier; the node route
  itself calls it.
- The generic content-structure path parsing/resolution used internally or by
  series flows; only the *client-facing materialize contract* drops `path`.

## Capabilities

### New Capabilities
<!-- None — this consolidates existing behavior onto a single addressing scheme. -->

### Modified Capabilities

- `type-extension-book`: Chapter Unit materialization becomes node-addressed only —
  `nodeId` is required and `BookContentStructurePath` is removed from the
  materialization contract; the "Materialization rejects stale BookContentStructure
  paths" requirement is dropped because node ids are stable under reorder.
- `app-library-workflows`: `/book/:bookId/node/:nodeId` is established as the sole
  canonical reading surface; the `/book/:bookId/read/:chapterId` route is removed and
  the empty/reading chapter actions are served from the node reading view.

(The generic content-structure service's path parsing/resolution — `content-structure`
spec — is intentionally **retained** for internal and series flows; only the
book-chapter *materialization contract* in `type-extension-book` drops `path`, so
no `content-structure` delta is needed.)

## Impact

- **package/app**: removes `routes/book_/$bookId/read/$chapterId/*`; updates the node
  reading feature (`book-read-node/*`) to absorb empty/reading chapter behaviors;
  updates the three TOC link components under
  `book-library/components/Chapter/*`; updates `useEnsureChapterUnit` to pass
  `nodeId`; prunes `book-library/models/bookContentStructurePath.ts`. The legacy
  `book-read/*` feature (`BookReadLayout`, `BookReadChapterPage`,
  `BookReadChapterSection`) is removed once its behavior is migrated.
- **package/server**: `chapter.api.ts` materialize route body switches to `{ nodeId }`;
  `chapter.service.ts` `materializeByBookPath` is replaced by a node-id lookup
  (drops `getNodeByPath`/`resolveContentStructurePath` usage in the materialize path
  and the stale-path guards).
- **package/contract**: `chapterMaterializationRequestSchema` /
  `chapterMaterializationResponseSchema` change shape (`path` → `nodeId`); remove the
  `expectedTitle` / `expectedBookContentStructureUpdatedAt` fields.
- **package/api**: chapter materialize client and `useEnsureChapterUnit`-adjacent
  mutation call sites updated to the new request shape.
- **Backward compatibility**: none retained — this is an internal dev-stage cutover.
  All internal call sites are updated in the same change per the repo's clean-cutover
  rule. Any existing `/read/:chapterId` URLs (bookmarks/shares) stop resolving.
- **Migration needs**: no database migration — empty nodes are already persisted rows
  with stable ids. Code/route migration only.
