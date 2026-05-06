## Why

`BookIndex` and `chapterIndex` are ambiguous names for the book content tree: they can be read as a database index, search index, or a chapter-only API surface. The model actually represents a book release's content structure: a JSON forest of volumes, parts, chapters, and materialized chapter links.

This project is still in development, so the rename should happen as a single breaking cutover instead of preserving legacy routes, aliases, or read-path compatibility.

## What Changes

- **BREAKING**: Rename the persistence model from `BookIndex` to `BookContentStructure`.
- **BREAKING**: Rename the `Book.chapterIndex` relation to `Book.contentStructure`.
- **BREAKING**: Rename the JSON field from `index` to `nodes`, because it stores the content-structure forest rather than an index implementation detail.
- **BREAKING**: Rename contract types and schemas:
  - `BookIndexDTO` -> `BookContentStructureDTO`
  - `BookIndexPath` -> `BookContentStructurePath`
  - `bookIndexNodeSchema` -> `bookContentStructureNodeSchema`
  - `bookIndexDTOSchema` -> `bookContentStructureDTOSchema`
- **BREAKING**: Replace the book API routes:
  - `GET /book/:unitId/chapterIndex` -> `GET /book/:unitId/content-structure`
  - `PUT /book/:unitId/chapterIndex` -> `PUT /book/:unitId/content-structure`
- **BREAKING**: Rename API client/query surfaces:
  - `bookApi.getChapterIndex` -> `bookApi.getContentStructure`
  - `bookApi.updateChapterIndex` -> `bookApi.updateContentStructure`
  - `bookQueries.chapterIndex` -> `bookQueries.contentStructure`
  - `bookKeys.chapterIndex` -> `bookKeys.contentStructure`
  - `bookChapterIndexQuery` -> `bookContentStructureQuery`
- Remove legacy BookIndex `id` read-path compatibility and migration helpers from production code.
- Remove old `chapterIndex` API/query aliases and any compatibility route for the old path.
- Document the repository's development-stage compatibility policy in `AGENTS.md` and `CLAUDE.md`: do not add backward-compatible aliases, legacy routes, or compatibility adapters for internal development-stage renames unless a change explicitly grants an exception.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `type-extension-book`: Rename the book content tree model, relation, field, DTO, route, and frontend-owned TOC cache wording from BookIndex/chapterIndex/index to BookContentStructure/contentStructure/nodes.
- `type-extension-post`: Clarify that chapter ordering and grouping live in BookContentStructure, not Post.
- `typed-json-fields`: Rename the typed JSON schema requirement from `bookIndexNodeSchema` / `BookIndex.index` to `bookContentStructureNodeSchema` / `BookContentStructure.nodes`.
- `book-detail-tab-layout`: Update the Content tab requirement to load `bookQueries.contentStructure(releaseUnitId)`.
- `book-detail-release-selector`: Update release-selection behavior to reload the selected release's content structure.

## Impact

- Affected packages:
  - `package/contract`: book content structure schemas and exported TypeScript types.
  - `package/server`: Prisma schema, migration, book service/API, chapter materialization, tests, factory/seed paths.
  - `package/api`: book API client, query keys, query options, mutations, cache invalidation.
  - `package/app`: book reader/editor/library components and route-level data loading.
  - `package/folio`: no required rename for `chapterIndex: number`; that field represents reader position, not the book content structure API.
- API compatibility:
  - No compatibility route is provided for `/book/:unitId/chapterIndex`.
  - No API client aliases are provided for `chapterIndex`.
- Data compatibility and migration:
  - Development-stage migration may rename or recreate the table/field.
  - Legacy BookIndex node `id` compatibility is removed; persisted content structure nodes use `chapterUnitId` only.
  - Dev/demo data should be regenerated or migrated in one step; old clients and old data shapes are not supported.
- Documentation:
  - `AGENTS.md` and `CLAUDE.md` will record the no-compatibility default for development-stage internal changes.
