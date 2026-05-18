## 1. Contract additions

- [ ] 1.1 Extend `ChapterTreeItem` in `package/contract/src/book.ts` with optional `id?: string` and `updatedAt?: string` fields; update `bookContentStructureNodeSchema` (the recursive `t.Recursive(...)`) to include both as `t.Optional(t.String())`.
- [ ] 1.2 Add inline TSDoc on the two new fields explaining read-vs-write semantics (server populates on reads; server uses `id` to identify rows on writes; server ignores `updatedAt` on writes).
- [ ] 1.3 Update `package/contract/src/book.test.ts` to cover the additive fields (read-shape includes them, write-shape accepts and roundtrips them).
- [ ] 1.4 Run `bun --filter=@rezics/contract test` and `bun run format` to confirm contract package builds clean.

## 2. Prisma schema — add normalized table (additive)

- [ ] 2.1 In `package/server/prisma/schema.prisma`, add the `BookContentStructureNode` model with fields per design D1: `id`, `bookUnitId`, `parentId`, `sortKey`, `chapterUnitId`, `title`, `noContent`, `rating`, `createdAt`, `updatedAt`. The `chapterUnitId` FK SHALL declare `onDelete: SetNull` (per D9) and SHALL NOT be UNIQUE (multi-link is first-class).
- [ ] 2.2 Add the three indexes: `@@index([bookUnitId, parentId, sortKey])`, `@@index([chapterUnitId])`, `@@index([bookUnitId, updatedAt(sort: Desc)])`.
- [ ] 2.3 Add `nodes BookContentStructureNode[]` relation on `BookContentStructure` and the inverse relation on the new model; keep `BookContentStructure.nodes Json` column in place for now (will be dropped in §10).
- [ ] 2.4 Run `bun --filter=@rezics/server run prisma:generate` and `bun --filter=@rezics/server run prisma:migrate` (name: `add_book_content_structure_node`).
- [ ] 2.5 Confirm the migration applies cleanly to a fresh dev DB and the generated `BookContentStructureNode` types are exported from the Prisma client.

## 3. LexoRank utility

- [ ] 3.1 Create `package/server/src/book/lexorank.ts` with `between(prev: string | null, next: string | null): string` returning a base36 string strictly between the two (treating `null` for either end as "open"); export helpers `firstKey()` and `keyAfter(prev)`.
- [ ] 3.2 Add `package/server/src/book/lexorank.test.ts` covering: append after end, prepend before start, insert in middle, repeated insert-between-same-pair grows the key (documenting the deferred rebalance pathology), lexicographic stability.
- [ ] 3.3 Run `bun --filter=@rezics/server test lexorank` to confirm.

## 4. Tree assembly + path resolution utilities

- [ ] 4.1 Replace `package/server/src/book/book-content-structure.ts` with new utilities operating on `BookContentStructureNode` rows: `buildTree(rows)` returning `ChapterTreeItem[]` (server-walks `parentId` map and sorts children by `sortKey`), `resolvePath(rows, path)` returning the target node row (or `null` if path doesn't resolve), and `pathToNodeId(rows, path)` as a convenience wrapper.
- [ ] 4.2 Keep `BookContentStructurePathError` and `parseBookContentStructurePath` / `validateBookContentStructurePath` exports as-is (still used by API layer for wire validation).
- [ ] 4.3 Update `package/server/src/book/book-content-structure.test.ts` to cover: assembly preserves sibling order via sortKey, missing children produce empty arrays, path resolution walks `sortKey`-ordered children at each level, stale paths return `null` instead of throwing.
- [ ] 4.4 Run `bun --filter=@rezics/server test book-content-structure`.

## 5. Server reads — switch BookContentStructure fetch to rows

- [ ] 5.1 In `package/server/src/book/book.service.ts`, replace the `getBookContentStructure(bookUnitId)` implementation: fetch `BookContentStructureNode` rows for the book, call `buildTree`, return `BookContentStructureResponse { bookUnitId, nodes, createdAt, updatedAt }` where `updatedAt` is the container row's `updatedAt`.
- [ ] 5.2 Ensure every returned `ChapterTreeItem` carries its `id` and `updatedAt` populated from the row.
- [ ] 5.3 Remove the now-unused JSON normalization path from this method (`normalizeBookContentStructureValue` will be deleted in §11).
- [ ] 5.4 Run `bun --filter=@rezics/server test book` and exercise the endpoint from a dev session against a migrated dataset (after §9).

## 6. Server writes — diff-based TOC save

- [ ] 6.1 In `package/server/src/book/book.service.ts`, replace `updateBookContentStructure(bookUnitId, nodes)` to perform diff-based mutation:
  - Fetch current rows for the book.
  - Walk the submitted tree to collect `(id?, parentId, sortKey, title, noContent, rating, chapterUnitId)` triples; allocate `sortKey` via `between(...)` for nodes without one (new inserts).
  - Compute the three sets: UPDATE (id present, any field differs), INSERT (no id, or id not in current set), DELETE (current row id not in submitted set).
  - Apply all mutations + bump `BookContentStructure.updatedAt` in a single `prisma.$transaction`.
  - Return the re-assembled tree.
- [ ] 6.2 Guard against root-node `parentId` cycles by walking the submitted tree depth-first (a child's `parentId` is its in-tree parent id, regardless of what the client claimed).
- [ ] 6.3 Add unit-level tests in `book.service.test.ts` (create if absent) covering: no-op save issues zero mutations, single rename issues exactly one UPDATE, delete subtree issues N DELETEs, insert new sibling issues one INSERT with a `sortKey` between neighbors, **submitted tree with two nodes carrying the same `chapterUnitId` succeeds and produces two rows linked to that chapter** (per spec "TOC save creates two nodes pointing at the same chapter").
- [ ] 6.4 Run `bun --filter=@rezics/server test book`.

## 7. Materialization — path resolves to row

- [ ] 7.1 In `package/server/src/chapter/chapter.service.ts`, update the materialization flow to: parse `req.path` via `parseBookContentStructurePath`, fetch the book's `BookContentStructureNode` rows, resolve the target row via `resolvePath`, reject with conflict if (a) the row's title doesn't match `expectedTitle`, or (b) the container `updatedAt` doesn't match `expectedBookContentStructureUpdatedAt`.
- [ ] 7.2 If the row already has `chapterUnitId`, return it (`alreadyMaterialized: true`); otherwise create the chapter `Unit` + `Post` + `UnitTranslation` and `UPDATE` the row's `chapterUnitId`.
- [ ] 7.3 Bump the container `BookContentStructure.updatedAt` only when a `chapterUnitId` is newly assigned to a row.
- [ ] 7.4 Update `package/server/src/chapter/chapter.materialization.test.ts` to cover: row-based resolution, stale-path rejection (title mismatch), stale-path rejection (updatedAt mismatch), concurrent materialization is idempotent.
- [ ] 7.5 Run `bun --filter=@rezics/server test chapter`.

## 8. Chapter-edit propagation — bump node updatedAt + title (multi-link aware)

- [ ] 8.1 In `package/server/src/chapter/chapter.service.ts`, in the chapter body update path, add `prisma.bookContentStructureNode.updateMany({ where: { chapterUnitId }, data: { updatedAt: new Date() } })` inside the existing transaction. `updateMany` is mandatory (not `update`) because per D9 / spec a chapter MAY be linked from multiple nodes; this single indexed query touches all of them.
- [ ] 8.2 Ensure 8.1 does NOT bump the container `BookContentStructure.updatedAt` for any of the affected books (per the spec scenario "Chapter content edit does not bump container updatedAt").
- [ ] 8.3 In the chapter title rename path (where `UnitTranslation.title` is updated), add `prisma.bookContentStructureNode.updateMany({ where: { chapterUnitId }, data: { title: newTitle, updatedAt: new Date() } })` inside the same transaction. Also bump the container `BookContentStructure.updatedAt` for every distinct `bookUnitId` whose node rows were updated (title rename IS a structure-shape change per D6). Use `findMany({ where: { chapterUnitId }, select: { bookUnitId: true } })` to enumerate the affected containers, then `updateMany` over the resulting bookUnitId set.
- [ ] 8.4 Tests in `chapter.service.test.ts` (create if absent): body-only edit on a single-link chapter bumps exactly one node `updatedAt` and no container; body edit on a multi-link chapter (2+ nodes across books) bumps every linked node and no container; title rename on a multi-link chapter updates `title` on every linked node and bumps the container `updatedAt` of every affected book exactly once.
- [ ] 8.5 Run `bun --filter=@rezics/server test chapter`.

## 9. Factory + seed migration (all factory write sites + multi-link fixture)

- [ ] 9.1 In `package/server/prisma/factory/books.ts` at the inline Book creation (~lines 79-81), change `contentStructure: { create: { nodes: [] as Prisma.InputJsonValue } }` to `contentStructure: { create: {} }`. The container row is created empty; node rows are inserted in 9.3.
- [ ] 9.2 Replace the in-memory `serializeTree(...)` JSON builder (~lines 228-235) with a `flattenTreeToRows(...)` helper that depth-first walks the generated tree and emits `BookContentStructureNode` row inputs: each row gets a fresh UUID, a `parentId` from the walker stack, a `sortKey` allocated via `keyAfter(prevSibling.sortKey)` from §3, and the existing `title` / `noContent` / (optional) `chapterUnitId` fields.
- [ ] 9.3 At the place where `serializeTree(tree)` was returned and later written via `updateContentStructure`, instead batch-insert all flattened rows via `prisma.bookContentStructureNode.createMany({ data: rows })` (split into BATCH chunks consistent with the rest of `books.ts`).
- [ ] 9.4 Delete or repurpose `updateContentStructure(prisma, bookId, nodes)` (~lines 325-334) — its JSON write target no longer exists. Callers (if any other than the one in this file) must switch to the new row-insert path; grep for `updateContentStructure` to confirm.
- [ ] 9.5 In `package/server/prisma/factory/orchestrator.ts`, update the step label at line 128 from "Chapters + BookContentStructure" to "Chapters + BookContentStructureNode rows" (cosmetic but reflects the new model).
- [ ] 9.6 In `package/server/prisma/seed/database.ts` cleanup, add `prisma.bookContentStructureNode.deleteMany()` to a cleanup group that runs BEFORE `prisma.bookContentStructure.deleteMany()` (FK order). After the `nodes` column is dropped in §11 the order requirement is the same because the FK from node → container still exists.
- [ ] 9.7 **Multi-link factory fixture**: add a small factory option (e.g. `multiLinkChapterProbability: number` plumbed into `chapterPlan` or a fixed preset) that, after the regular materialized rows are created, picks `K` materialized chapter Units and inserts an additional `BookContentStructureNode` row for each — same `chapterUnitId`, different `parentId` / `sortKey`, `title` cloned from the source row. Default `K = 0` so existing seeds are unchanged; the multi-link preset (§9.8) sets a meaningful value.
- [ ] 9.8 Add a factory preset under `package/utils/src/factory/presets/` named `book-multi-link-toc.ts` that seeds one or two small books containing duplicated chapter references (e.g. "preface appears at top level and again inside an appendix section"). Wire it into `presets/index.ts`. This preset exists specifically so multi-link semantics can be exercised end-to-end without manual SQL.
- [ ] 9.9 Run `bun --filter=@rezics/server run seed:factory:fast` and confirm clean load. Run the new preset (`bun --filter=@rezics/server run seed:factory -- --preset book-multi-link-toc` or equivalent) and inspect the DB: at least one `chapterUnitId` SHALL have multiple matching `BookContentStructureNode` rows.

## 10. One-time migration script for existing data

- [ ] 10.1 Create `package/server/prisma/migrations-runtime/normalize-book-content-structure.ts` (a one-off Bun script): iterate every `BookContentStructure` row, parse legacy `nodes` JSON via the existing `normalizeBookContentStructureValue`, depth-first walk it, allocate a UUID + `sortKey` per node, batch-insert `BookContentStructureNode` rows preserving `chapterUnitId`, `title`, `noContent`, `rating`.
- [ ] 10.2 Add a verification pass to the same script: for each book, re-fetch new rows, assemble via `buildTree`, compare structurally (titles, children order, `chapterUnitId`, `noContent`, `rating`) against the source JSON; log the offending `bookUnitId` and exit non-zero on any divergence; print summary `migrated: N books, M nodes` on success.
- [ ] 10.3 Add a `--dry-run` flag that does the verification without inserting.
- [ ] 10.4 Add `bun --filter=@rezics/server run migrate:content-structure` script to `package/server/package.json`.
- [ ] 10.5 Run the script with `--dry-run`, then for real, against a fresh dev DB seeded with the legacy factory shape (temporarily revert §9 in a separate branch to verify migration of legacy data, then re-apply §9).

## 11. Drop legacy nodes column

- [ ] 11.1 In `package/server/prisma/schema.prisma`, remove the `nodes Json` column from `BookContentStructure`.
- [ ] 11.2 Run `bun --filter=@rezics/server run prisma:migrate` (name: `drop_book_content_structure_nodes_json`).
- [ ] 11.3 Delete the legacy helpers in `package/server/src/book/book-content-structure.ts` that operated on the JSON shape (`normalizeBookContentStructureValue`, `normalizeBookContentStructureNode`, `getBookContentStructureNode`, `updateBookContentStructureNode`).
- [ ] 11.4 `bun run knip` and fix any unused exports surfaced by the deletion.

## 12. App / frontend consumption (additive)

- [ ] 12.1 In `package/app/src/book-library/`, update the TOC editor save flow (`ChapterTreeEditor`, related models in `book-edit`) so submitted nodes preserve their `id` round-tripped from reads. No new mutation API needed; existing save endpoint stays the same shape.
- [ ] 12.2 Surface the new per-node `updatedAt` in `ContentChapterVirtualTree` / `ChapterArboristNode` as a small "last updated" affordance (gated behind a feature flag if the design system component isn't ready yet — track as follow-up if so).
- [ ] 12.3 Run `bun --filter=@rezics/app run build` and exercise the TOC editor in a browser session: create, rename, move, delete a chapter — confirm each issues a single small request and that no `nodes` JSON payload is sent.

## 13. Cleanup + verification

- [ ] 13.1 Repo-wide grep for `BookContentStructure.nodes`, `bookContentStructure.update.*nodes`, `Prisma.InputJsonValue.*nodes` and confirm no remaining references outside the change's own files.
- [ ] 13.2 Run `bun run format`, `bun run check:convention`, `bun run check:tokens`, `bun run knip`.
- [ ] 13.3 Run `bun test` at repo root; investigate and fix any failures.
- [ ] 13.4 Manual smoke test against a migrated dev dataset: open a book content page, materialize a chapter, edit a chapter body, observe per-node `updatedAt` updates and container `updatedAt` unchanged; rename a chapter, observe both update.
- [ ] 13.5 Capture before/after timing measurements (`getBookContentStructure` p50/p95 on a representative book, single-chapter rename write cost) and note them in the change archive when archiving.
