## 1. Contract And Vocabulary

- [ ] 1.1 Add `creationMode` contract types for wiki-capable create requests in `package/contract`.
- [ ] 1.2 Add `PostKind.WIKI` to the contract enum and update generated/derived PostKind schemas.
- [ ] 1.3 Define shared `UnitAuthorityRoleKey` values (`owner`, `maintainer`, `editor`, `viewer`) in `package/contract`.
- [ ] 1.4 Define shared semantic field-key vocabularies for Unit common fields, Book, Entity, Game, Media, attribution fields, and wiki post body.
- [ ] 1.5 Add contract schemas for lock metadata, collaborator metadata, authority errors, and locked-field rejection payloads.
- [ ] 1.6 Add contract schemas for history outbox payload categories and history read DTOs (`UnitRevision`, `RevisionContent`, timeline page, single revision).
- [ ] 1.7 Add tests for field-key vocabulary coverage and stable literal values used by server/app/api.
- [ ] 1.8 Run contract type checks and update any generated exports affected by new enums or schemas.

## 2. Main Schema And Seed Infrastructure

- [ ] 2.1 Add `UnitCollaborator` to `package/server/prisma/schema.prisma` with primary key `(unitId, userId)` and role indexes.
- [ ] 2.2 Add `UnitFieldLock` to `package/server/prisma/schema.prisma` with primary key `(unitId, fieldKey)` and locked-by indexes.
- [ ] 2.3 Add `UnitHistoryClock` to `package/server/prisma/schema.prisma` for per-Unit monotonic history sequence allocation.
- [ ] 2.4 Add `HistoryOutbox` to `package/server/prisma/schema.prisma` with status, attempts, payload, sequence, unit id, actor id, and processing metadata.
- [ ] 2.5 Add Prisma relations from `Unit`/`User` to collaborators and locks without disrupting existing relation names.
- [ ] 2.6 Create and review the main server Prisma migration for authority and outbox tables.
- [ ] 2.7 Update server seed code to create or upsert `rezics` and `rezics-wiki` USER Units and User rows.
- [ ] 2.8 Ensure seeded infra users have no `authUserId` and cannot be used as login identities.
- [ ] 2.9 Add seed tests or seed verification helpers proving idempotency for `rezics` and `rezics-wiki`.
- [ ] 2.10 Run `bun --filter=@rezics/server run prisma:generate`.

## 3. Server Authority Core

- [ ] 3.1 Create a shared `package/server/src/unit/authority` module for owner, collaborator, admin, surface-policy, and lock admission checks.
- [ ] 3.2 Implement admin/root override detection using existing permission helpers.
- [ ] 3.3 Implement primary owner admission using `Unit.userId`.
- [ ] 3.4 Implement collaborator lookup and role-to-capability checks.
- [ ] 3.5 Implement sparse lock lookup using `fieldKey in ["*", ...changedFieldKeys]`.
- [ ] 3.6 Implement non-collaborative surface short-circuit so ordinary post/review/remark/reply edits do not query locks.
- [ ] 3.7 Implement typed authority errors that include blocked field keys when locks deny a community edit.
- [ ] 3.8 Add unit tests for type-alone denial, `rezics-wiki` ownership with locked fields, whole-object locks, owner bypass, collaborator allow, admin override, and non-collaborative short-circuit.
- [ ] 3.9 Add tests proving no community edit is granted solely because a Unit has type BOOK/ENTITY/GAME/MEDIA.

## 4. Lock And Collaborator APIs

- [ ] 4.1 Add server services for listing, adding, updating, and removing Unit collaborators.
- [ ] 4.2 Add server services for listing, creating, and deleting Unit field locks.
- [ ] 4.3 Add API routes for collaborator management with owner/maintainer/admin gating.
- [ ] 4.4 Add API routes for field lock management with owner/maintainer/admin gating.
- [ ] 4.5 Ensure lock and collaborator mutations write history/audit outbox records where applicable.
- [ ] 4.6 Add `package/api` clients and hooks for collaborator list/mutation workflows.
- [ ] 4.7 Add `package/api` clients and hooks for field lock list/mutation workflows.
- [ ] 4.8 Add tests for unauthorized lock/collaborator mutation attempts and admin override behavior.

## 5. Transactional History Outbox In Main

- [ ] 5.1 Implement a main-server helper to allocate `UnitHistoryClock` sequence values inside an existing Prisma transaction.
- [ ] 5.2 Implement a main-server helper to write `HistoryOutbox` rows inside the same transaction as canonical mutations.
- [ ] 5.3 Implement canonical payload hashing or canonical serialization helpers shared by outbox builders.
- [ ] 5.4 Implement editorial payload builders for Unit common fields, translations, support languages, extension rows, credit attribution, subject attribution, tags, and post slots.
- [ ] 5.5 Implement structure-event payload builders for Book content-structure operations.
- [ ] 5.6 Add tests proving canonical mutation rollback also rolls back the outbox row.
- [ ] 5.7 Add tests proving consecutive edits write distinct payloads and ordered per-Unit sequences.
- [ ] 5.8 Add tests proving main does not call history service HTTP inside mutation transactions.

## 6. History Service Package

- [ ] 6.1 Add `package/history` workspace with Bun package metadata, tsconfig, Elysia entrypoint, and scripts.
- [ ] 6.2 Add `package/history/prisma/schema.prisma` for `UnitRevision`, `RevisionContent`, structure event storage, ingestion cursors, and processing metadata.
- [ ] 6.3 Add history service env validation using the repo's `@t3-oss/env-core` + Valibot pattern.
- [ ] 6.4 Implement the outbox consumer with claim, process, retry, failure, and idempotency behavior.
- [ ] 6.5 Implement `RevisionContent` upsert by content hash.
- [ ] 6.6 Implement `UnitRevision` insertion with unique `(unitId, sequence)`.
- [ ] 6.7 Implement structure event ingestion for Book content-structure events.
- [ ] 6.8 Add `GET /history/unit/:unitId/revisions` timeline endpoint.
- [ ] 6.9 Add `GET /history/unit/:unitId/revisions/:sequence` single revision endpoint.
- [ ] 6.10 Add structure event read endpoints required by Book content-structure history.
- [ ] 6.11 Add health/readiness endpoints matching existing service patterns.
- [ ] 6.12 Add unit tests for revision ingestion, idempotent retries, duplicate content hashes, failed outbox retry, and sequence uniqueness.
- [ ] 6.13 Add service integration notes or scripts to local dev orchestration if required.

## 7. Server Creation Modes

- [ ] 7.1 Add server-side resolver for the seeded `rezics-wiki` user id.
- [ ] 7.2 Update book creation input handling to accept wiki vs personal creation intent.
- [ ] 7.3 Ensure wiki-mode book creation stamps `Unit.userId = rezics-wiki`.
- [ ] 7.4 Ensure personal-mode book creation stamps `Unit.userId = current user`.
- [ ] 7.5 Apply initial lock policy for personal-mode wiki-capable content.
- [ ] 7.6 Update entity creation to support wiki-mode creation for EntityPicker/catalog flows.
- [ ] 7.7 Keep personal entity/self-claim creation owned by the current user.
- [ ] 7.8 Add or update game/media creation mode handling if those create APIs exist in the current codebase.
- [ ] 7.9 Reject or ignore client-submitted owner ids on wiki-mode create requests.
- [ ] 7.10 Add tests for ordinary user wiki-mode creation of `rezics-wiki` owned BOOK and ENTITY Units.
- [ ] 7.11 Add tests for personal-mode creation remaining current-user owned and closed by initial policy.

## 8. Collaborative Metadata Mutations

- [ ] 8.1 Identify current server endpoints that mutate Book metadata, Entity metadata, Unit translations, credit attribution, subject attribution, and tags.
- [ ] 8.2 For the first rollout batch, choose endpoints that will become collaborative and document skipped endpoints in code comments or tasks.
- [ ] 8.3 Add changed-field-key mapping for each migrated mutation request.
- [ ] 8.4 Wrap each migrated mutation in the shared authority/lock gate before canonical writes.
- [ ] 8.5 Write history outbox rows for each migrated mutation after canonical writes in the same transaction.
- [ ] 8.6 Ensure owner/admin-only endpoints that are not collaborative keep existing behavior and do not query `UnitFieldLock`.
- [ ] 8.7 Add targeted tests for locked attribution fields, locked translation title fields, unlocked community edits, owner edits, and collaborator edits.

## 9. Wiki Post Backend

- [ ] 9.1 Add `PostKind.WIKI` support to server Prisma enum usage and post contract mappings.
- [ ] 9.2 Update post DTO mappers and validators to include WIKI without breaking existing post kinds.
- [ ] 9.3 Add wiki post create service path that creates `Unit(type=POST)` with `userId = rezics-wiki` and `Post.authorUserId = actor`.
- [ ] 9.4 Add wiki post update service path that edits `Post.body` through collaborative authority with changed field key `post.body`.
- [ ] 9.5 Ensure ordinary post update paths remain author/owner-only and do not enter community lock checks.
- [ ] 9.6 Ensure `Post.isLocked` remains thread/reply lock semantics and is not used as field protection.
- [ ] 9.7 Write history outbox rows for wiki post create and body update mutations.
- [ ] 9.8 Add tests for wiki post creation, wiki post target Unit assignment, unlocked body edit, locked body edit, ordinary review denial, and `Post.isLocked` separation.

## 10. API Package

- [ ] 10.1 Add `package/api` clients for authority and lock endpoints.
- [ ] 10.2 Add `package/api` clients for history timeline and single revision reads.
- [ ] 10.3 Add `package/api` create helpers that expose `creationMode` without exposing arbitrary owner ids.
- [ ] 10.4 Add `package/api` wiki post create/update/list/detail helpers.
- [ ] 10.5 Add React Query keys and hooks for history reads with eventual-consistency-friendly empty states.
- [ ] 10.6 Add error mapping for locked-field authority errors so app/admin can render actionable messages.
- [ ] 10.7 Add tests for API request bodies, query keys, error mapping, and history DTO parsing.
- [ ] 10.8 Update public exports and run repo-wide search for stale PostKind exhaustiveness checks.

## 11. Frontend Creation And Editing Surfaces

- [ ] 11.1 Load `rezics-design` before editing frontend JSX/CSS for this phase.
- [ ] 11.2 Update `/book/new` or its successor to expose clear catalog/wiki and personal creation paths.
- [ ] 11.3 Ensure catalog/wiki book creation submits `creationMode = "wiki"`.
- [ ] 11.4 Ensure personal book creation submits personal creation intent and communicates ownership correctly.
- [ ] 11.5 Update `EntityPicker` inline create to use wiki-mode entity creation.
- [ ] 11.6 Add or update personal entity/self-registration UI to keep personal ownership.
- [ ] 11.7 Add wiki post editor UI for `PostKind.WIKI` create/update flows.
- [ ] 11.8 Preserve unsaved drafts when locked-field errors occur in wiki post editor.
- [ ] 11.9 Render `rezics-wiki` owned catalog content as community catalog/wiki ownership, not a normal user owner card.
- [ ] 11.10 Add frontend tests/stories for catalog vs personal creation mode and locked-field error states.

## 12. History And Authority UI

- [ ] 12.1 Add history timeline route or surface for Unit revision history.
- [ ] 12.2 Add empty-state UI for history timelines when the history service has not ingested revisions yet.
- [ ] 12.3 Add single revision view that renders slot payloads and resolves referenced Unit ids through main server APIs.
- [ ] 12.4 Add lock status affordances on collaborative edit forms where the viewer needs to understand blocked fields.
- [ ] 12.5 Add owner/maintainer UI for managing field locks where in scope for v1.
- [ ] 12.6 Add collaborator management UI where in scope for v1 or mark as admin-only if deferred.
- [ ] 12.7 Add admin UI for inspecting history outbox lag/failures if operationally required.
- [ ] 12.8 Verify responsive layout and accessibility for new history/wiki/lock surfaces.

## 13. Admin And Operations

- [ ] 13.1 Add admin routes or pages for searching Unit locks and collaborators.
- [ ] 13.2 Add admin override flows for removing problematic locks or collaborators.
- [ ] 13.3 Add operational visibility for `HistoryOutbox` pending/failed row counts.
- [ ] 13.4 Add a safe retry mechanism for failed outbox rows.
- [ ] 13.5 Add documentation for pausing history consumption without blocking main canonical writes.
- [ ] 13.6 Add documentation for seeded infra user purpose and ownership semantics.

## 14. Search, Indexing, And Rendering Integration

- [ ] 14.1 Audit search/index DTOs that expose `userId` or owner fields.
- [ ] 14.2 Ensure search result renderers treat `rezics-wiki` as community catalog ownership.
- [ ] 14.3 Ensure wiki post documents are indexed with an appropriate kind and target Unit relationship.
- [ ] 14.4 Ensure ordinary posts remain filtered/rendered by author semantics.
- [ ] 14.5 Add tests for `rezics-wiki` owner rendering in search or card contexts.

## 15. Migration And Compatibility

- [ ] 15.1 Confirm no automatic backfill is required for existing development rows.
- [ ] 15.2 Add a one-off verification script or query to list existing wiki-shaped rows by owner for manual review.
- [ ] 15.3 Keep existing owner-only edit endpoints working until explicitly migrated.
- [ ] 15.4 Add migration notes for API consumers that need to pass `creationMode`.
- [ ] 15.5 Run repo-wide search for direct owner-id create inputs and ensure wiki creation paths resolve owner server-side.

## 16. Validation

- [ ] 16.1 Run `bun --filter=@rezics/contract test` or the closest available contract validation command.
- [ ] 16.2 Run targeted server tests for authority, locks, creation mode, wiki posts, and outbox helpers.
- [ ] 16.3 Run `bun --filter=@rezics/server run prisma:generate`.
- [ ] 16.4 Run targeted history service tests.
- [ ] 16.5 Run `bun --filter=@rezics/api test` or targeted API package tests.
- [ ] 16.6 Run affected app tests or Storybook checks for creation/history/wiki UI.
- [ ] 16.7 Run `bun run format:check`.
- [ ] 16.8 Run `bun run check:convention`.
- [ ] 16.9 Run `openspec validate content-authority-history-locks --strict`.
