## 1. Audit And Migration Preconditions

- [ ] 1.1 Add a migration/parity check that verifies every legacy release work link has an equivalent `UnitWork(role = RELEASE)` row before dropping compatibility storage.
- [ ] 1.2 Run `rg "workUnitId|work-link|WorkLink|chapterUnitId|BookContentStructure|book.contentStructure"` across `package/*` and record the allowed temporary compatibility locations in the implementation notes or task comments.
- [ ] 1.3 Add or update convention checks so new runtime code cannot reference `Unit.workUnitId`, generic `chapterUnitId`, or `BookContentStructure*` outside approved compatibility adapters.

## 2. UnitWork Canonical Cutover

- [ ] 2.1 Remove `Unit.workUnitId` and the `WorkRelease` self-relation from `package/server/prisma/schema.prisma`.
- [ ] 2.2 Add a Prisma migration that drops the legacy `Unit.workUnitId` column after the parity check passes.
- [ ] 2.3 Update `package/server/src/unit-work/` so create/update/delete operations only mutate `UnitWork` and no longer synchronize `Unit.workUnitId`.
- [ ] 2.4 Update book creation and work matching in `package/server/src/book/` to create/read `UnitWork(role = RELEASE)` only.
- [ ] 2.5 Update admin work merge service and job-runner handlers to move membership through `UnitWork` only and remove legacy release pointer progress.
- [ ] 2.6 Update post, shelf, subject/credit attribution, unit mapper, and library DTO mapping to resolve work membership from `UnitWork` only.
- [ ] 2.7 Update `package/search` content and post sync builders to remove `unit.workUnitId` fallback and require included `workMemberships`.
- [ ] 2.8 Remove `UnitWorkReleaseDrift` migration/view usage and the `/unit-work/diagnostics/release-drift` API.

## 3. Work Membership Claim Naming

- [ ] 3.1 Decide whether to rename or remove `package/server/src/unit/work-link*` modules; if retained temporarily, mark them as compatibility wrappers over `UnitWork`.
- [ ] 3.2 Rename contract exports under `package/contract/src/unit/work-link*` to work membership claim names, or remove them if no longer needed.
- [ ] 3.3 Update `package/api/src/unit/work-link*`, notify kinds, email payloads, route summaries, and callers to use the replacement membership naming.
- [ ] 3.4 Port authorization, immediate approval, wiki exception, pending claim, withdrawal, approval, and rejection tests to the replacement `UnitWork` membership flow.
- [ ] 3.5 Run a repo-wide grep for `work-link`, `WorkLink`, and `workLink` and eliminate unapproved runtime references.

## 4. Generic ContentStructure Contract Cleanup

- [ ] 4.1 Remove `chapterUnitId` from generic `package/contract/src/content-structure.ts` node schemas and TypeScript interfaces.
- [ ] 4.2 Remove `chapterUnitId`, `beforeChapterUnitId`, and `afterChapterUnitId` from generic content-history operation schemas in `package/contract/src/content-history.ts`.
- [ ] 4.3 Update `package/server/src/content-structure/mapper.ts` and `service.ts` so generic reads, writes, operation planning, and history payloads use only `contentUnitId`.
- [ ] 4.4 Update generic `package/api/src/content-structure/` clients, query keys, mutations, and tests to use `ownerUnitId`/`contentUnitId` only.
- [ ] 4.5 Keep any remaining book-specific compatibility conversion inside `package/server/src/book/`, `package/server/src/chapter/`, or clearly named app book adapters.
- [ ] 4.6 Run a repo-wide grep for `chapterUnitId` and ensure remaining references are limited to approved book/chapter adapter surfaces or removed.

## 5. Book And App Callsite Migration

- [ ] 5.1 Update book editor/reader helpers in `package/app/src/book-library/` and `package/app/src/book-edit/` to treat `contentUnitId` as the only node identity field.
- [ ] 5.2 Update `useEnsureChapterUnit`, chapter creation dialogs, TOC editors, chapter lists, progress pickers, and read sections to consume materialization `contentUnitId`.
- [ ] 5.3 Update `package/api/src/book/` compatibility wrappers or migrate internal app call sites to `contentStructure` APIs where book-specific response shaping is unnecessary.
- [ ] 5.4 Update route comments and adapter code for `$chapterId` params so they explicitly represent materialized content Unit ids.
- [ ] 5.5 Update Storybook fixtures, mocks, and generated test data to remove generic `chapterUnitId` and `book.contentStructure` payloads.

## 6. History Event Cutover

- [ ] 6.1 Update server content-structure history writes to emit `contentStructure.content.batch` with `contentUnitId` operation fields only.
- [ ] 6.2 Update `package/history` ingestion tests and DTO tests to treat `contentStructure.content.batch` as canonical.
- [ ] 6.3 Keep legacy `book.contentStructure.batch` display support only for pre-cutover rows, if needed, and document it in tests.
- [ ] 6.4 Update app history rendering and fixtures to prefer generic event names and field labels.

## 7. Tests And Verification

- [ ] 7.1 Run targeted contract tests for `content-structure`, `content-history`, `unit-work`, book/chapter materialization, and notification claim schemas.
- [ ] 7.2 Run targeted server tests for `unit-work`, book creation/work matching, chapter materialization, content-structure update/history, post/shelf work membership, and admin work merge.
- [ ] 7.3 Run targeted search and job-runner tests for work-domain projection, `UnitWork` CDC routing, and admin merge repair.
- [ ] 7.4 Run targeted API/app tests for content-structure queries, book reader/editor, progress picker, review/excerpt/remark target flows, and history display.
- [ ] 7.5 Run `bun run check:convention`.
- [ ] 7.6 Run `bun run format:check`.
- [ ] 7.7 Run `openspec validate cleanup-unit-work-content-structure-schema --strict`.
