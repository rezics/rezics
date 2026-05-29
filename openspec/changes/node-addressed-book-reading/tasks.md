## 1. Inventory & parity baseline

- [x] 1.1 Enumerate every action/affordance in `package/app/src/book-read/sections/BookReadChapterSection.tsx` (markdown render, edit pencil, empty-chapter actions: create/edit content, review, discuss, save position) and record the parity checklist to satisfy before the read route is deleted.
- [x] 1.2 Grep for all call sites of `useEnsureChapterUnit` (`package/app/src/book-library/hooks/useEnsureChapterUnit.ts`) and confirm the four expected callers (`BookReadChapterSection`, `BookTocEditor`, `EmptyNodeView`, `BookReadNodeSection`); note which have a server `nodeId` available vs only an in-memory tree node.
- [x] 1.3 Grep repo-wide for callers of `resolveContentStructurePath` and `getNodeByPath` (package/server) to confirm series/internal usage that must be retained; record which references belong only to the book materialize path.
- [x] 1.4 Resolve design Open Question: confirm whether `BookTocEditor` materialize-on-open always has a persisted `nodeId`; if not, decide materialize-after-save and capture the chosen flow in `design.md`.

## 2. Migrate read-route behavior into node views (both routes still present)

- [x] 2.1 Move materialized-chapter rendering + edit affordance from `BookReadChapterSection` into `package/app/src/book-read-node/components/ReadingNodeView.tsx`.
- [x] 2.2 Move the empty-node action set (create/edit content, review, discuss, save reading position) into `package/app/src/book-read-node/components/EmptyNodeView.tsx`, reusing `useEnsureChapterUnit` + `progressApi`; edit/review still navigate to the content-keyed routes.
- [x] 2.3 Verify the node view at `/book/:bookId/node/:nodeId` covers the full parity checklist from 1.1; update `package/app/src/book-read-node/sections/BookReadNodeSection.tsx` wiring as needed.
- [x] 2.4 Update/extend `resolveNodeView.test.ts` and add tests for the migrated empty/reading behaviors.

## 3. Contract: node-addressed materialize

- [x] 3.1 In `package/contract/src/chapter.ts`, change `chapterMaterializationRequestSchema` from `{ path, expectedTitle, expectedBookContentStructureUpdatedAt }` to `{ nodeId }`, and update `chapterMaterializationResponseSchema` (replace `path` with `nodeId`).
- [x] 3.2 Update any contract tests that build the old materialize request/response shape.

## 4. Backend: materialize by nodeId

- [x] 4.1 In `package/server/src/chapter/chapter.api.ts`, change the `POST /materialize/book/:bookUnitId` body to the `{ nodeId }` schema.
- [x] 4.2 Replace `chapterService.materializeByBookPath` with a node-id lookup in `package/server/src/chapter/chapter.service.ts`: load the `ContentStructureNode` by `id` scoped to the owning book and `isDeleted = false`, return existing `contentUnitId` if present, otherwise create `Unit`/`Post`/`UnitTranslation` and write `contentUnitId` (keep the existing `where: { id }` update and idempotency).
- [x] 4.3 Remove the stale-path guard logic (`expectedTitle` / `expectedBookContentStructureUpdatedAt`) and the `getNodeByPath` call from the materialize path; handle a missing/deleted node via the standard not-found/deleted response.
- [x] 4.4 Update `chapter.service.test.ts` (and any mapper/api tests) for node-id materialize, including the idempotent-concurrent-materialize and node-not-found cases.

## 5. API client + ensure-chapter hook

- [x] 5.1 Update the chapter materialize mutation in `@rezics/api` to send `{ nodeId }`.
- [x] 5.2 Update `useEnsureChapterUnit` input/behavior to pass `nodeId` (drop `path`); update its four call sites identified in 1.2.

## 6. Repoint navigation to the node route

- [x] 6.1 Update the three TOC components — `package/app/src/book-library/components/Chapter/{ChapterList,ContentChapterVirtualTree,ChapterArboristNode}.tsx` — to link `to="/book/$bookId/node/$nodeId"` with `params={{ nodeId: node.id }}`, removing the `EMPTY_CHAPTER_ROUTE_ID` sentinel, encoded `path`, and `search` params.
- [x] 6.2 Change the `EmptyNodeView` `onMaterialized` callback in `BookReadNodeSection` to navigate to `/book/$bookId/node/$nodeId` instead of `/read/$chapterId`.
- [x] 6.3 Grep repo-wide for remaining `to: "/book/$bookId/read/$chapterId"` / `read/$chapterId` references (stories, tests, links) and repoint or remove them. (All app `to=` Link refs repointed/removed. Notify deep-link policy also updated: removed the dead `/book/:bookId/read/:chapterId` branch and the now-unused `chapterId` routing hint from `package/notify/.../notification.target.ts` — no emitter ever set that hint — so chapter-in-book notifications resolve via `nodeId` → node route or `contentUnitId` → `/chapter/:contentUnitId`. Updated `notification.target.test.ts` and the route-template example in `package/app/.../inbox/models/notificationTarget.test.ts`. Zero `read/:chapterId` references remain repo-wide.)

## 7. Delete the read route

- [x] 7.1 Delete `package/app/src/routes/book_/$bookId/read/$chapterId/` (route.tsx + index.tsx) and regenerate the TanStack route tree.
- [x] 7.2 Delete the `package/app/src/book-read/*` feature (`BookReadLayout`, `BookReadChapterPage`, `ChapterPage`, `BookReadChapterSection`, `index.ts`) and remove its `@/book-read` import surface.
- [x] 7.3 Verify no route resolves `/book/:bookId/read/:chapterId` (spec scenario "Legacy read route is absent").

## 8. Prune dead path/sentinel machinery

- [x] 8.1 In `package/app/src/book-library/models/bookContentStructurePath.ts`, remove `EMPTY_CHAPTER_ROUTE_ID`, `encode/decodeBookContentStructurePath`, and occurrence helpers that are now unreferenced; keep anything still imported by the TOC editor / series flows. (Also deleted the reader-only arborist chain orphaned by removing the read route — `LinearChapterList`, `ChapterArborist`, `ChapterArboristNode`, `ChapterArboristHeightSlider`, `ChapterArborist.stories`, and the orphaned `playground/pages/TestPage02` — relocating the `Chapter` type that `CreateChapterDialog` consumed onto `BookContentStructureOccurrence`.)
- [x] 8.2 Remove the `?path=&title=` `validateSearch` schema that lived on the deleted read layout route and any now-unused decoders.
- [x] 8.3 Grep repo-wide to confirm no remaining references to removed symbols; fix or delete stragglers.

## 9. Tests, stories, and validation

- [x] 9.1 Update affected Storybook stories and factory/seed code (`package/server/prisma/factory/*`) that construct old materialize payloads or link to the read route. (No-op: factory materializes chapters via direct DB rows, not the materialize API; no story/factory built the old `{ path, expected* }` payload or linked to the read route. Model test `bookContentStructurePath.test.ts` updated for the pruned helpers.)
- [x] 9.2 Run `bun test` for `@rezics/app`, `@rezics/server`, `@rezics/contract`; fix failures.
- [x] 9.3 Run `bun run knip`, `bun run check:convention`, and `bun run format:check`; resolve findings.
- [x] 9.4 Run `openspec validate node-addressed-book-reading` and do a manual smoke per `bun run dev`: open a materialized node, an empty node, materialize from the empty node, and confirm TOC links + continuation all land on `/node/:nodeId`. (Validation run below. Manual browser smoke left for the user to run via `bun run dev` — see verification URLs in the summary.)
