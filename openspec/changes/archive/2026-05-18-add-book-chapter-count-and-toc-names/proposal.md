## Why

Book pages need a cheap, book-level chapter count for list/detail rendering without loading the full content-structure tree. The current frontend naming also mixes implementation and UI concepts: `BookContentStructure` is the correct data-domain name, while reader/editor screens should speak in TOC terms.

## What Changes

- Add `Book.chapterCount` as a cached integer summary alongside existing book-level facts such as `textLength` and `pageCount`.
- Define `chapterCount` as the number of readable TOC entries represented by `BookContentStructureNode` rows where `noContent = false`.
- Preserve multi-link semantics: repeated nodes that reference the same `chapterUnitId` are counted as separate readable TOC entries.
- Update Book DTO/read surfaces to expose `chapterCount` from the `Book` record.
- Keep data/API naming aligned with `BookContentStructure`, including contract DTOs, API clients, query keys, and path helpers.
- Rename frontend UI/editor concepts away from `ChapterTree*` where they represent the whole book TOC rather than only chapters. Preferred names: `BookTocEditor`, `BookTocTree`, `BookTocNode`.
- Do not introduce or depend on `chapterIndexNodes`; any old `BookIndex`/`chapterIndex` terminology remains historical only.

## Capabilities

### New Capabilities

<!-- None. This changes existing book/content-structure behavior. -->

### Modified Capabilities

- `type-extension-book`: Book records expose a cached `chapterCount`; BookContentStructure mutation behavior keeps the cache in sync; frontend-facing naming boundaries are clarified.

## Impact

- `package/server` - Prisma schema, migrations, book creation/update paths, content-structure save path, factory/seed generation, and book mapper/types.
- `package/contract` - `BookDTO`, create/update schemas if needed, and content-structure item/type naming exports.
- `package/api` - book DTO types and any renamed frontend-facing content-structure type imports.
- `package/app` - book detail hero/metadata display and TOC editor/component naming.
- `package/admin` - any shared book DTO or TOC editor imports affected by the frontend naming cleanup.

Backward compatibility: `chapterCount` is additive on the wire and defaults to `0`. Existing clients that ignore it keep working. Component/type renames are internal development-stage cutovers and should update all live internal callsites in the same implementation change.

Migration: existing books need a one-time backfill from `BookContentStructureNode` rows. New books default to `chapterCount = 0`, and future TOC saves recompute the cache in the same transaction as node mutations.
