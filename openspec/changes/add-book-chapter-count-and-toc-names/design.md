## Context

`Book` already stores book-level summary facts (`pageCount`, `textLength`) that are cheap to render on list/detail screens. Chapter count is currently only derivable by loading the content-structure tree and walking it on the client or server.

The content-structure model has also moved away from legacy `BookIndex` / `chapterIndex` language. On the data boundary, `BookContentStructure` is accurate. In UI code, however, names like `ChapterTreeEditor` are too narrow because the tree includes volumes, parts, appendix groups, unmaterialized nodes, and other non-chapter TOC entries.

## Goals / Non-Goals

**Goals:**

- Add a durable `Book.chapterCount` cache for cheap book summary rendering.
- Define `chapterCount` as readable TOC entry count, not unique materialized chapter Unit count.
- Keep the cache synchronized when content-structure nodes are inserted, deleted, moved, or saved.
- Expose the count through `BookDTO` and render it in book summary metadata.
- Use `BookContentStructure` for data/API names and `BookToc*` / `Toc*` for UI/editor names.
- Remove live references to old `BookIndex`, `chapterIndex`, and `chapterIndexNodes` naming where touched by this change.

**Non-Goals:**

- Re-designing BookContentStructure storage. This change builds on the normalized node table.
- Adding direct chapter-count search ranking or sorting in Meili.
- Materializing unmaterialized nodes just to count them.
- Enforcing a unique chapter count by `chapterUnitId`.
- Renaming archived OpenSpec history or generated route names that happen to contain `Index` as route terminology.

## Decisions

### D1. Store `chapterCount` on `Book`

`Book.chapterCount Int @default(0)` is the primary source for book-level summary display.

Alternatives considered:

- **Compute from `BookContentStructureNode` on every book read**: accurate but adds an aggregate query to common book list/detail paths.
- **Store on `BookContentStructure`**: closer to the source tree, but book summary screens mostly receive `BookDTO`, not the content-structure container. It would force either extra joins or duplicate DTO plumbing.
- **Store on `Book` (chosen)**: aligns with `textLength` and `pageCount` as book-level facts and keeps list/detail reads cheap.

### D2. Count readable TOC entries, not unique chapter Units

The cache value is:

```sql
COUNT(*) WHERE bookUnitId = ? AND noContent = false
```

This counts node occurrences. It intentionally does not use `COUNT(DISTINCT chapterUnitId)` because the same chapter Unit may be referenced by multiple content-structure nodes. A duplicated preface, appendix reference, or curated alternate TOC path is visible to the reader as multiple entries and should be counted that way.

Unmaterialized readable nodes count. `chapterUnitId` is not required because materialization is on-demand; a TOC entry can be a legitimate chapter slot before it has a Unit identity.

### D3. Recompute the cache on structure writes

The content-structure save path should recompute `Book.chapterCount` from the submitted tree / resulting node rows inside the same transaction as node mutations and the container `updatedAt` bump.

Other synchronization points:

- Book creation initializes `chapterCount = 0`.
- Factory and seed paths set the final count after inserting node rows.
- A one-time migration backfills existing books from `BookContentStructureNode`.
- Chapter body edits do not change `chapterCount`.
- Materialization that only fills `chapterUnitId` does not change `chapterCount`.
- Updating `noContent` does change `chapterCount`.

### D4. Keep data names and UI names separate

Use these naming boundaries:

| Layer | Preferred naming | Rationale |
| --- | --- | --- |
| Prisma / server / contract / API | `BookContentStructure`, `BookContentStructureNode`, `BookContentStructurePath` | Exact domain data model |
| Shared contract tree item | `BookContentStructureItem` | Wire item assembled from node rows without colliding with the Prisma row model |
| App/editor components | `BookTocEditor`, `BookTocTree`, `BookTocNode` | User-facing interaction is editing a table of contents |
| Visible copy | TOC / table of contents / Traditional Chinese localized text | Avoid exposing implementation terms |

`chapterIndexNodes` should not be used for new work. If the Prisma inverse relation needs to remain temporarily for generated client compatibility, rename it during implementation to a `contentStructureNodes`-style relation and update generated types/callsites.

### D5. Frontend display placement

Book detail should show chapter count as book metadata:

- Hero brief strip: `Book · N chapters · N words · ISBN ...`
- Metadata panel: localized `chapter_count` row next to text length, page count, and format.

It should not become a `BookHeroStatCards` item because those cards currently represent linked social/association stats (reviews, shelves, tags). Chapter count is intrinsic metadata.

## Risks / Trade-offs

- [Risk] Cached count drift if a write path mutates nodes without recomputing `Book.chapterCount`. Mitigation: centralize count recomputation in the content-structure service transaction and add tests for create/save/delete/noContent updates.
- [Risk] `chapterCount` semantics could be mistaken for materialized chapter Units. Mitigation: document it as readable TOC entry count and test repeated `chapterUnitId` rows.
- [Risk] Broad frontend renames can create noisy diffs. Mitigation: scope to live Book TOC editor/model/component names and avoid archived docs or generated route names unless regeneration requires it.
- [Risk] Current canonical specs may lag recently completed content-structure normalization. Mitigation: this change's spec adds count behavior without reintroducing JSON storage assumptions.

## Migration Plan

1. Add `Book.chapterCount` with default `0`.
2. Backfill from normalized node rows using `COUNT(*) WHERE noContent = false` grouped by `bookUnitId`.
3. Regenerate Prisma client.
4. Update server read/write paths, factory, and tests.
5. Update contract/API/app naming and display.

Rollback: the field is additive. If rollout must be reverted before clients depend on it, stop writing/reading `chapterCount` and leave the column in place until a later cleanup migration.
