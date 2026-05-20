## 1. Contract Shape

- [x] 1.1 Extend `package/contract/src/content-history.ts` with `book.contentStructure.batch` structure-event payload schemas and typed operation variants for node create, update, move, delete, link, unlink, and bulk replace.
- [x] 1.2 Update history revision DTOs to distinguish metadata-safe timeline data from optional raw `content` payload data.
- [x] 1.3 Add contract types for history display resolution statuses (`OK`, `DELETED`, `GONE`, `RESTRICTED`) for actor and Unit references.
- [x] 1.4 Add contract types for restore source metadata, including source revision sequence.
- [x] 1.5 Add contract tests covering structure batch payload validation, optional raw payload omission, and restore metadata.

## 2. History Service Storage and Reads

- [x] 2.1 Update `package/history/src/revision/revision.service.ts` so editorial content hashes are computed from canonical content payload when the outbox row does not supply the correct content hash.
- [x] 2.2 Ensure `RevisionContent` upsert deduplicates identical editorial `slots` payloads across different sequences and actors.
- [x] 2.3 Ensure `StructureEvent` ingestion accepts and persists `book.contentStructure.batch` payloads idempotently.
- [x] 2.4 Update `package/history/src/revision/revision.api.ts` to honor raw-payload visibility inputs or response shape controls once the authority contract is available.
- [x] 2.5 Add targeted tests in `package/history/src/revision` and `package/history/src/outbox` for canonical hash deduplication and structure batch event retries.

## 3. Main Server History Writers

- [x] 3.1 Update `package/server/src/unit/history-outbox.ts` to compute and store editorial `payloadHash` from revision content slots instead of full outbox metadata.
- [x] 3.2 Refactor `package/server/src/book/book.service.ts` TOC diff planning so the save path produces a typed operations list before applying node mutations.
- [x] 3.3 Write one `HistoryOutbox` structure event inside the same TOC save transaction when the operations list is non-empty.
- [x] 3.4 Ensure no-op TOC saves write no history outbox row and leave `BookContentStructure.updatedAt` unchanged.
- [x] 3.5 Include actor id and optional edit message in TOC structure history writes for user saves and bot sync callers.
- [x] 3.6 Add server tests for create/update/move/delete/link/unlink operation payloads and one-sequence-per-save behavior.

## 4. Authority and Resolution APIs

- [x] 4.1 Define server-side authority helpers for history timeline visibility, raw payload visibility, compare access, and restore eligibility.
- [ ] 4.2 Apply Unit visibility checks to history proxy/read endpoints exposed through the app-facing API boundary.
- [x] 4.3 Add or extend batch actor resolution so history UI can resolve `actorUserId` values without per-row requests.
- [x] 4.4 Add or extend batch Unit reference resolution for ids found in history payloads, including `OK`, `DELETED`, `GONE`, and `RESTRICTED` statuses.
- [x] 4.5 Add tests for public viewer, owner, maintainer, admin, deleted actor, and restricted reference cases.

## 5. API Client and Query Keys

- [x] 5.1 Update `package/api/src/history` DTO usage and query helpers for timeline metadata, single revision reads, structure-event timelines, and optional raw payload access.
- [x] 5.2 Add `@rezics/api` helpers for actor/reference batch resolution with stable TanStack Query keys.
- [x] 5.3 Add compare query helpers that fetch base and target revisions and expose a client-side compare input shape.
- [x] 5.4 Update API tests to cover generated URLs, query keys, raw payload flags, structure-event endpoints, and resolution cache keys.

## 6. Frontend Diff Foundation

- [x] 6.1 Add frontend dependencies for `diff` and the selected React diff renderer, preferring `react-diff-view` unless implementation evaluation proves another renderer fits better.
- [x] 6.2 Decide whether to add `@formatjs/intl-segmenter` immediately or implement a dynamic polyfill hook after native-support testing.
- [x] 6.3 Create app-local compare utilities for scalar fields, Markdown source fields, JSON fallback fields, and semantic collections.
- [x] 6.4 Implement CJK-aware inline token diff using `Intl.Segmenter` with safe character-level fallback.
- [x] 6.5 Add unit tests for English Markdown, Chinese Markdown, scalar changes, added/removed tags, updated credits, unknown slot fallback, and unchanged field omission.

## 7. Product History UI

- [x] 7.1 Replace the current basic `BookHistoryPage` timeline with a product page organized into editorial, content-structure, and authority views.
- [x] 7.2 Build revision timeline rows with resolved actor display, changed field chips, message, created time, compare action, restore action when authorized, and ingestion-lag-friendly empty states.
- [x] 7.3 Build revision detail sections for translations, extension metadata, credits, subjects, tags, authority records, and restricted/raw fallback states.
- [x] 7.4 Build structure-event timeline rows that collapse one `book.contentStructure.batch` event and expand ordered operations.
- [ ] 7.5 Build compare route/surface with base/target selection, changed-field navigation, split/unified controls, Markdown source diff, semantic collection diffs, and raw fallback for authorized viewers.
- [ ] 7.6 Build restore flow that loads a selected revision into the normal edit path, requires confirmation, and preserves later history.
- [ ] 7.7 Ensure history and compare UI use localized copy, accessible icon labels, keyboard-reachable controls, and non-color-only status indicators.
- [ ] 7.8 Verify responsive layouts for desktop and narrow mobile widths, especially unified compare mode and long CJK text.

## 8. Fixtures, Storybook, and Visual QA

- [ ] 8.1 Add app or Storybook fixtures for editorial revision timelines, structure batch events, authority events, deleted actors, restricted references, empty history, ingestion lag, and raw payload authorization.
- [ ] 8.2 Add stories or route fixtures for Markdown diff in English, Chinese, Japanese, long prose, and large collapsed hunks.
- [ ] 8.3 Run browser verification for history timeline, revision detail, compare, structure-event expansion, restore confirmation, and mobile compare layout.

## 9. Repo-Wide Migration and Cleanup

- [ ] 9.1 Search for UUID-only history displays and migrate them to actor/reference resolution.
- [ ] 9.2 Search for raw `JSON.stringify(payload)` history UI and move it behind authorized raw payload affordances.
- [ ] 9.3 Ensure new public exports include required file suffixes across package boundaries.
- [ ] 9.4 Remove or replace unnecessary container/show wrappers encountered in touched history UI.

## 10. Validation

- [x] 10.1 Run targeted contract tests for content-history schemas.
- [x] 10.2 Run targeted server tests for TOC save history outbox and authority checks.
- [x] 10.3 Run targeted history service tests for ingestion, deduplication, and read APIs.
- [x] 10.4 Run targeted API client tests for history query keys and URLs.
- [x] 10.5 Run targeted app tests for compare utilities and history UI states.
- [x] 10.6 Run `bun run format:check`.
- [x] 10.7 Run `bun run check:convention`.
- [x] 10.8 Run `openspec validate complete-content-history-v2 --strict`.
