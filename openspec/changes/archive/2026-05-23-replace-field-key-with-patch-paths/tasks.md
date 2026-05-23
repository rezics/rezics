## 1. Precondition

- [x] 1.1 Verify `rename-realm-tag-application` is archived (`openspec/changes/archive/rename-realm-tag-application/` exists, working tree contains no `RealmTagUnit` references in server/contract/api/app code, Prisma schema uses `RealmTagApplication`). If not, stop work and complete `rename-realm-tag-application` first.

## 2. Contract Schema

- [x] 2.1 Remove `UnitFieldKey`, `UnitCommonFieldKey`, `BookFieldKey`, `EntityFieldKey`, `GameFieldKey`, `MediaFieldKey`, `AttributionFieldKey`, `WikiPostFieldKey`, `UNIT_FIELD_KEYS`, `unitFieldKeySchema`, and `lockFieldKeySchema` from `package/contract/src/content-authority.ts`. Retain `UNIT_FIELD_LOCK_ALL = "*"` as the whole-Unit sentinel.
- [x] 2.2 Add `unitFieldLockSchema` with `path: t.String()` instead of `fieldKey`. Export `LockPath = string | typeof UNIT_FIELD_LOCK_ALL`.
- [x] 2.3 Add `EXTERNALLY_GOVERNED_PATHS = ["tags", "realmTagApplications"] as const` and a helper `isExternallyGoverned(path: string): boolean` using prefix-boundary match.
- [x] 2.4 Replace `revisionSlotNameSchema` and `editorialRevisionPayloadSchema.slots` with `editorialRevisionPayloadSchema.patch: t.Record(t.String(), t.Any())` in `package/contract/src/content-history.ts`. Remove the `revisionSlotName` type export.
- [x] 2.5 Add `editorialPatchSchema` representing a sparse JSON sub-tree (recursive `t.Record(t.String(), t.Any())` with optional `$unset: string[]` directive).
- [x] 2.6 Add `editorialPatchSubmissionSchema` describing a single editorial PATCH request body (patch sub-tree + optional message). Export TypeScript types.
- [x] 2.7 Update contract tests for `content-authority` and `content-history` to reflect the new shapes. Remove all tests that enumerate `UNIT_FIELD_KEYS`. Add tests for `isExternallyGoverned` and lock-path prefix matching.

## 3. Database And Prisma

- [x] 3.1 Rename `UnitFieldLock.fieldKey` column to `path`; drop the enum check constraint if any.
- [x] 3.2 Drop `UnitRevision.changedFieldKeys` column. For pre-cutover legacy revisions, run a one-shot data migration that copies the legacy `changedFieldKeys` array into the JSON payload as `legacyChangedKeys` before the column is dropped, so the history reader can still display them.
- [x] 3.3 Add a migration step that maps existing `UnitFieldLock` rows to path strings via a hand-curated mapping (`identity.title` → drop and emit a `translations` container lock; `bibliographic.isbn13` → `extension.isbn13`; `credits.authors` → `credits.authors`; `post.body` → `post.body`; `tags`, `subjects` predicate filters → log warning and drop because they are now externally governed or moved into role-keyed object sub-trees). The mapping table lives in the migration script.
- [x] 3.4 Run `bun --filter=@rezics/server run prisma:generate`.

## 4. Editorial PATCH Server

- [x] 4.1 Delete `package/server/src/unit/collaborative-metadata.ts::loadEditorialSlots`. Remove all callsites.
- [x] 4.2 Update editorial PATCH endpoints (post, book, entity, unit translation, user description, wiki) to accept a sparse JSON sub-tree using `editorialPatchSubmissionSchema`. Persist the sub-tree leaf-by-leaf via the existing Prisma services.
- [x] 4.3 Implement sparse merge semantics: object values recursively merge; array values replace whole; `null` writes SQL NULL; `$unset: [path...]` removes the listed keys.
- [x] 4.4 Reject editorial PATCH whose path intersects `EXTERNALLY_GOVERNED_PATHS` with a 400-style error whose body includes the offending path and a `useApi` hint pointing at the dedicated governance API.
- [x] 4.5 Update `package/server/src/unit/authority.service.ts` lock checks: replace field-key intersection with bidirectional prefix matching over the submitted PATCH leaf paths and stored `UnitFieldLock.path` values. Implement the matcher as a small utility shared with the contract test suite.
- [x] 4.6 Update the rejection error DTO to return the offending lock path and the offending PATCH path so the editor can narrow the PATCH.
- [x] 4.7 Update unit field lock creation API to accept `path: string` instead of `fieldKey: UnitFieldKey`. Validate that the path does not intersect `EXTERNALLY_GOVERNED_PATHS`.

## 5. History Outbox

- [x] 5.1 Update `buildEditorialRevisionPayload` (in `package/server/src/unit/history-outbox.ts`) to accept `patch: Record<string, unknown>` instead of `slots`. Recompute `payloadHash` over the patch sub-tree via existing `canonicalSerialize`.
- [x] 5.2 Update `writeHistoryOutbox` callers across `book.service.ts`, `post.service.ts`, `authority.service.ts`, `collaborative-metadata.ts` (or successor) to pass the submitted patch rather than re-loading slots.
- [x] 5.3 Skip outbox writes entirely for PATCH leaves whose path intersects `EXTERNALLY_GOVERNED_PATHS`. (Defensive — these PATCHes are already rejected at the endpoint, but the outbox writer should not assume.)

## 6. History Service

- [x] 6.1 Update `package/history/src/outbox/outbox-consumer.ts` to recognize both `slots`-shape (pre-cutover) and `patch`-shape (post-cutover) editorial payloads. Compute `contentHash` from the patch sub-tree for post-cutover payloads.
- [x] 6.2 Add a derived `changedFieldKeys` projection: walk the stored patch sub-tree and emit one entry per leaf path. Cache per revision in the read DTO; do not persist.
- [x] 6.3 For pre-cutover revisions, read `changedFieldKeys` from the preserved legacy data (`legacyChangedKeys` in the payload, written by the migration in 3.2).
- [x] 6.4 Update `package/history/src/revision/revision.service.ts` read paths so timeline DTOs return the derived list.
- [x] 6.5 Update revision restore: restore is a client-mediated normal editorial PATCH with descriptive restore metadata (`source revision` + `restored paths`). The metadata SHALL be stored on the new revision for UI/audit display, while the submitted PATCH goes through normal authority and lock gating.

## 7. Frontend

- [x] 7.1 Update lock creation UI: the "lock target" picker offers canonical PATCH paths derived from `@rezics/contract` input schemas instead of an enum. Display path strings; show localized labels via a small lookup map.
- [x] 7.2 Update history timeline render: `changedFieldKeys` are free-form path strings; the UI translates the most common paths (e.g. `translations.<lang>.title`, `post.content.main`, `credits.authors`) to localized labels via a lookup; unknown paths render as the raw path.
- [x] 7.3 Update editorial save flows (post editor, wiki editor, attribution editor) to submit sparse PATCH bodies containing only changed sub-trees.
- [x] 7.4 Update lock rejection error display: surface the offending lock path and PATCH path so the editor can narrow the submission.

## 8. Externally-Governed Path Endpoints

- [x] 8.1 Confirm that `tags` and `realmTagApplications` writes already route through dedicated APIs (`/tags/*`, `/realm-tag-applications/*` post-rename). Add an integration test that proves an editorial PATCH targeting these paths is rejected with the externally-governed error.
- [x] 8.2 Confirm `UnitFieldLock` creation rejects paths under `EXTERNALLY_GOVERNED_PATHS`. Add a test.

## 9. Validation

- [x] 9.1 Run package-level tests for `package/contract`, `package/server`, `package/history`, `package/api`, and affected `package/app` features.
- [x] 9.2 Run `bun run check:convention`.
- [x] 9.3 Run `bun run format:check`.
- [x] 9.4 Run `bun run knip` and confirm no orphan exports remain (`UnitFieldKey`, `revisionSlotName`, etc.). `knip` still reports existing baseline unused files/deps/exports, but targeted `UnitFieldKey` / `revisionSlotName` references are absent.
- [ ] 9.5 Browser smoke test: create a `UnitFieldLock` on a specific path via the lock UI, attempt an editorial PATCH that intersects it, observe the rejection error includes both the lock path and the patch path. Then attempt an editorial PATCH on `tags`, observe the externally-governed rejection pointing at the tag API.
- [ ] 9.6 Browser smoke test: edit a wiki, save, check that the history timeline displays the derived changed paths and that the revision detail shows the submitted PATCH (not a full snapshot).
