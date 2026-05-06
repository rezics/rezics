## Context

The current book content tree is named `BookIndex` in Prisma and contract types, while the API and frontend query surfaces expose it as `chapterIndex`. Both names are ambiguous:

- `BookIndex` can mean a database index, search index, or generic book lookup index.
- `chapterIndex` suggests a chapter-only route and conflicts with legitimate reader state fields such as `chapterIndex: number`.
- The stored JSON is a forest of content nodes, not an implementation-level index.

The target model name is `BookContentStructure`. It describes a book release's ordered content structure: volumes, parts, chapters, and links to materialized chapter Units through `chapterUnitId`.

This is a development-stage breaking change. The implementation should prefer a single cutover over compatibility bridges.

## Goals / Non-Goals

**Goals:**

- Rename the domain model, contract surface, API route, query surface, and Prisma relation to `BookContentStructure`.
- Rename the JSON field from `index` to `nodes`.
- Remove production read-path compatibility for legacy BookIndex node `id` fields.
- Remove old `chapterIndex` API and query aliases.
- Record the repository's development-stage no-compatibility default in `AGENTS.md` and `CLAUDE.md`.
- Keep reader-local `chapterIndex: number` state unchanged unless it refers to the book content structure API.

**Non-Goals:**

- No event-sourced content-structure history.
- No relational normalization of each content node.
- No compatibility endpoint for `/book/:unitId/chapterIndex`.
- No support for legacy clients or legacy content-tree JSON that uses `id`.
- No rename of unrelated "compatible" language required for external protocols or third-party tooling.

## Decisions

### D1 — Use `BookContentStructure` as the canonical domain name

The canonical domain name SHALL be `BookContentStructure`.

Rationale: the model represents the structure of a book's content, not a search index, database index, or chapter-only list. `BookContentStructure` is explicit enough for current TOC behavior and broad enough for future volume/part/section nodes.

Alternatives considered:

- `BookContentIndex`: better than `BookIndex`, but keeps the overloaded `Index` term.
- `BookStructureIndex`: still vague because "structure" does not specify content structure and it retains `Index`.
- `BookTableOfContents`: precise for TOC-only use, but too narrow for future content-structure metadata.

### D2 — Rename `index` to `nodes`

The Prisma JSON field and DTO property SHALL be `nodes`.

Rationale: the value is a JSON forest of nodes. `nodes` avoids both `index` ambiguity and the awkward `BookContentStructure.structure` repetition.

Alternatives considered:

- `structure`: clear but repetitive on `BookContentStructure`.
- `content`: too broad and could be confused with chapter body content.
- Keep `index`: lowest churn, but preserves the core ambiguity this change is removing.

### D3 — Use scoped API method names and URL paths

The server route SHALL be `/book/:unitId/content-structure`. The API client inside the book module SHALL use `getContentStructure` and `updateContentStructure`, while exported DTO/type names keep the full `BookContentStructure` prefix.

Rationale: the `/book/:unitId` route scope already supplies "Book", so repeating it in route and method names adds noise. Shared contract names need the prefix because they cross package boundaries.

### D4 — Remove compatibility instead of aliasing

The implementation SHALL remove old `/chapterIndex` routes, `chapterIndex` query aliases, `BookIndex` helper aliases, and legacy `id` normalization.

Rationale: this project is still in development. Compatibility shims make future work harder by keeping stale vocabulary alive and by hiding invalid data shapes. A single breaking cutover is simpler and easier to verify.

### D5 — Distinguish content-structure naming from reader position naming

Reader-local `chapterIndex: number` fields in `package/folio` SHALL remain valid when they represent an ordinal position in a flattened chapter array.

Rationale: those fields are not the old content-structure API name. Renaming them to `contentStructure` would make them less accurate. If a later cleanup wants clearer reader naming, `activeChapterIndex` or `chapterOrdinal` should be considered separately.

## Risks / Trade-offs

- [Risk] Prisma migration may drop data if generated as table recreation → Mitigation: since this is dev-stage, table recreation is acceptable when documented; if preserving local data is useful, use an explicit rename migration without adding compatibility code.
- [Risk] Remaining `BookIndex`/`chapterIndex` references in archived OpenSpec changes or lockfiles may confuse grep audits → Mitigation: verification should focus on live source and active specs; archived change history may retain historical language.
- [Risk] Existing frontend imports may rely on old aliases → Mitigation: remove aliases and let TypeScript identify every callsite during implementation.
- [Risk] `BookContentStructure.nodes` can still store invalid opaque JSON if server validation remains weak → Mitigation: contract schema and server helper normalization should operate on the canonical `ChapterTreeItem`/node shape and should not accept legacy `id`.

## Migration Plan

1. Update active OpenSpec specs to the new canonical names through this change.
2. Rename Prisma model/relation/field:
   - `BookIndex` -> `BookContentStructure`
   - `Book.chapterIndex` -> `Book.contentStructure`
   - `BookContentStructure.index` -> `BookContentStructure.nodes`
3. Add a development-stage migration for the table/column rename or recreation.
4. Rename contract types, schemas, and comments.
5. Rename server helper module and service/API methods.
6. Replace routes with `/book/:unitId/content-structure`; do not keep `/chapterIndex`.
7. Rename API client methods, query keys, query options, mutations, and invalidation keys.
8. Update app callsites, editor save/export labels, reader data loading, and seed/factory paths.
9. Delete BookIndex legacy `id` migration/normalization helpers and tests.
10. Add the no-compatibility policy to `AGENTS.md` and `CLAUDE.md`.
11. Verify with targeted `rg`, tests, and type checks.

Rollback strategy: because this is a dev-stage breaking rename, rollback means reverting the change or resetting dev data. No runtime compatibility bridge is part of the rollback plan.

## Open Questions

- None. The chosen name is `BookContentStructure`, the JSON property is `nodes`, and compatibility with the old names is intentionally out of scope.
