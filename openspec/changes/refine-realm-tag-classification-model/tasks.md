## 1. Schema and Migration

- [ ] 1.1 Inventory all current `RealmTagUnit`, `RealmTagVote`, `RealmUnit`, `UnitTag`, and `TagVote` Prisma usages with `rg`, and record the exact rename map before editing generated-client consumers.
- [ ] 1.2 Add the `RealmTagContext` model to `package/server/prisma/schema.prisma` with composite id `(realmUnitId, tagUnitId)`, optional unique `contextUnitId`, timestamps, and relations to `Realm`, `Unit(type=TAG)`, and context content Unit.
- [ ] 1.3 Rename realm-tag application relations in `schema.prisma` from generic reverse names to role names such as realm application, applied global tag, target Unit, and application votes.
- [ ] 1.4 Move the realm side of realm-tag application relations to the `Realm` extension model where Prisma permits it, and keep only tag/target/content reverse relations on `Unit`.
- [ ] 1.5 Change `RealmTagVote` so its business relation targets `RealmTagUnit(realmUnitId, tagUnitId, unitId)` instead of three independent Unit reverse relations.
- [ ] 1.6 Update the `RealmTagVote` composite id and all Prisma unique selector names consistently across schema, services, tests, and migrations.
- [ ] 1.7 Add schema comments or adjacent source JSDoc explaining `Realm`, `RealmUnit`, `RealmTagUnit`, `RealmTagVote`, and `RealmTagContext` semantics.
- [ ] 1.8 Review current `RealmTagUnit` indexes against actual query paths and keep only indexes needed for list-by-realm/unit, list-by-unit/realm, tag filtering, pin ordering, and moderation discovery.
- [ ] 1.9 Create the Prisma migration for `RealmTagContext`, relation renames, vote relation changes, and any measured index changes.
- [ ] 1.10 Run Prisma generation for `@rezics/server` and fix generated-client type errors introduced by relation and selector renames.

## 2. Contracts and API Client

- [ ] 2.1 Add `RealmTagContextDTO`, read response, update input, materialize response, and route param schemas to `package/contract/src/realm.ts`.
- [ ] 2.2 Add JSDoc to `RealmTagUnitDTO`, `RealmTagVoteDTO`, and new `RealmTagContextDTO` describing product semantics and non-goals.
- [ ] 2.3 Add server contract schemas for `GET`, `PUT`, and materialize operations keyed by `(realmUnitId, tagUnitId)`.
- [ ] 2.4 Export new contract types from the existing contract package public entry point.
- [ ] 2.5 Add API client methods in `package/api/src/realm/realm.api.ts` for realm-tag context read, update, and materialize.
- [ ] 2.6 Add TanStack Query options/hooks in `package/api/src/realm` for realm-tag context read and mutations.
- [ ] 2.7 Update API client comments that currently describe client-side global/realm double-write behavior.

## 3. Realm Tag Context Backend

- [ ] 3.1 Add `package/server/src/realm/realm-tag-context.service.ts` or equivalent service methods for get, upsert/update, and materialize operations.
- [ ] 3.2 Add validation helpers that assert `realmUnitId` references an existing REALM Unit and `tagUnitId` references an existing TAG Unit.
- [ ] 3.3 Implement context read behavior for existing and missing context rows according to the contract.
- [ ] 3.4 Implement context update/upsert behavior without creating any `RealmTagUnit` row as a side effect.
- [ ] 3.5 Implement idempotent materialization that creates the context row if missing and creates exactly one context content Unit when `contextUnitId` is absent.
- [ ] 3.6 Decide the phase-1 materialized content type using existing Post/Unit primitives, and document the decision in service comments.
- [ ] 3.7 Enforce realm content permissions for context update/materialize through the existing realm permission service.
- [ ] 3.8 Add `realm-tag-context` Elysia routes and mount them in `package/server/src/index.ts`.
- [ ] 3.9 Add mapper functions for `RealmTagContextDTO`, including optional realm/tag/context content includes.
- [ ] 3.10 Add focused service and route tests for create, read, missing row, invalid realm/tag type, unauthorized write, and idempotent materialization.

## 4. RealmTagUnit and RealmTagVote Behavior

- [ ] 4.1 Update `RealmService.createRealmTagUnit` so the standard write path validates realm/tag types before writing.
- [ ] 4.2 Update `createRealmTagUnit` to idempotently create or preserve the caller's global `TagVote(userId, unitId, tagUnitId, +1)` inside the same transaction as the realm application and vote work.
- [ ] 4.3 Update global `UnitTag.score` and `UnitTag.voteCount` recomputation or aggregate maintenance according to the existing global tag vote rules.
- [ ] 4.4 Preserve idempotency when the same user creates the same realm-tag application repeatedly, including both `RealmTagVote` and global `TagVote`.
- [ ] 4.5 Preserve single global vote semantics when the same user applies the same tag to the same Unit through multiple realms.
- [ ] 4.6 Update `RealmService.castRealmTagVote` to use the new application relation and selector names.
- [ ] 4.7 Update `RealmService.deleteRealmTagUnit` to rely on the application-vote relation cascade or an equivalent transaction, without deleting or decrementing global `UnitTag`.
- [ ] 4.8 Update legacy `/realm/:realmUnitId/tags` alias behavior so authenticated calls route through the standard backend-owned contribution path.
- [ ] 4.9 Remove service comments that say the client is expected to double-write global and realm tag writes.
- [ ] 4.10 Add tests proving `RealmTagUnit` can be created without `RealmUnit(realmUnitId, unitId)`.
- [ ] 4.11 Add tests proving RealmUnit deletion does not delete RealmTagUnit rows.
- [ ] 4.12 Add tests proving RealmTagUnit deletion does not delete or modify UnitTag aggregates.
- [ ] 4.13 Add tests proving invalid non-TAG `tagUnitId` and non-REALM `realmUnitId` writes are rejected.
- [ ] 4.14 Add tests proving global TagVote contribution is idempotent across retries and across multiple realms.

## 5. Existing Tag Context and Search Index

- [ ] 5.1 Update `package/server/src/tag/tag-context.service.ts` so `GET /tags/for-unit/:unitId/context` returns realm highlights using resolved global tag display data and never emits a fake tag for `realm:tag`.
- [ ] 5.2 Add optional `contextUnitId` or context route reference to realm highlight tag entries if a `RealmTagContext` row exists and the contract includes it.
- [ ] 5.3 Update `package/search/src/sync.ts` relation includes and mapping after Prisma relation renames.
- [ ] 5.4 Preserve `realmTagKeys` formatting as `"{realmUnitId}:{tagUnitId}"` and keep it machine-facing only.
- [ ] 5.5 Add or update search sync tests proving a document can have `realmTagKeys` without the corresponding `realmIds`.
- [ ] 5.6 Verify `package/server/src/meili/content/content.service.ts` filters still build exact `realmTagKeys` filters after schema changes.
- [ ] 5.7 Update contract comments in `package/contract/src/meili/content.ts` to state that `realmTagKeys` are filter keys, not display labels.

## 6. Seed and Product Semantics

- [ ] 6.1 Extend server seed helpers under `package/server/src/infra` with reusable helpers for global tags, realm community metadata, realm tag contexts, and realm tag applications.
- [ ] 6.2 Seed at least one subreddit-like realm with translations, membership, rules/about/pinboard data, and `extra.tagTree`.
- [ ] 6.3 Seed shared global tag Units reused by more than one realm, without creating realm-local tag identities.
- [ ] 6.4 Seed `RealmTagContext` rows explaining how a realm interprets at least one shared tag.
- [ ] 6.5 Seed at least one materialized context content Unit linked by `contextUnitId`.
- [ ] 6.6 Seed `RealmTagUnit` applications for targets inside a realm feed and targets outside that realm feed.
- [ ] 6.7 Ensure seed-created realm tag applications also produce consistent `RealmTagVote`, global `TagVote`, `RealmTagUnit`, and `UnitTag` aggregate rows.
- [ ] 6.8 Add a repeat-run or reset verification test proving seeded composite-key rows remain deterministic and idempotent.

## 7. Frontend and API Follow-up Audit

- [ ] 7.1 Audit `package/api/src/tag/useTagInRealm.ts` and remove or deprecate client double-write behavior once backend global contribution is verified.
- [ ] 7.2 Audit frontend realm tag rendering components for raw `realmTagKeys`, raw ids, or copy implying realm-local tags.
- [ ] 7.3 Record follow-up UI tasks for rendering realm tag highlights as realm sections with a realm title and normal tag titles below.
- [ ] 7.4 Record follow-up UI tasks for compact `realmTitle:tagTitle` badge rendering in constrained contexts.
- [ ] 7.5 Record follow-up route/query tasks for mixed slug/id parsing such as `realmSlug:tagSlug` and `realmTitle:tagTitle`.
- [ ] 7.6 Verify no full frontend redesign is implemented before backend contracts and seeds are stable.

## 8. Repo-wide Migration and Verification

- [ ] 8.1 Run `rg` for removed relation names and update all remaining references: `realmTagAsRealm`, `realmTagAsTag`, `realmTagAsUnit`, `realmTagVoteAsRealm`, `realmTagVoteAsTag`, and `realmTagVoteAsUnit`.
- [ ] 8.2 Run `rg` for client double-write terminology and update docs/comments to the backend-owned contribution model.
- [ ] 8.3 Run targeted Bun tests for realm services, realm tag vote services, tag context service, post service filters, search sync, and seed helpers.
- [ ] 8.4 Run relevant package typechecks or builds for `package/server`, `package/contract`, `package/api`, and `package/search`.
- [ ] 8.5 Run OpenSpec validation/status for `refine-realm-tag-classification-model` and fix any spec/task formatting issues.
- [ ] 8.6 Update implementation notes with any final decisions about materialized context Unit type, context permissions, and retained indexes.
