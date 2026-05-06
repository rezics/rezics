## Context

Rezics currently has the following backend surfaces:

- `Realm` is a 1:1 extension of `Unit(type=REALM)`.
- `Tag` identity is represented by `Unit(type=TAG)`.
- `RealmUnit(realmUnitId, unitId)` associates content with a realm feed.
- `UnitTag(unitId, tagUnitId)` stores global tag application and global tag vote aggregation.
- `RealmTagUnit(realmUnitId, tagUnitId, unitId)` stores realm-scoped use of an existing global tag on a target Unit.
- `RealmTagVote(realmUnitId, userId, unitId, tagUnitId)` stores per-member agreement/disagreement on that realm-scoped application.
- The content index stores `realmTagKeys` as `"{realmUnitId}:{tagUnitId}"` machine keys for filtering.

The database shape is mostly capable of the desired product behavior, but its semantics are poorly documented and relation names leak implementation details:

```prisma
realmTagAsRealm
realmTagAsTag
realmTagAsUnit
realmTagVoteAsRealm
realmTagVoteAsTag
realmTagVoteAsUnit
```

These names are technically valid but semantically empty. They encourage future maintainers to reason from table shape instead of product roles.

The product model we want is:

```text
Realm
  subreddit-like community space
  owns membership, posting policy, moderation, rules/about/pinboards, tag curation

RealmUnit
  target Unit appears in / is posted into a realm feed
  independent of semantic tag classification

UnitTag
  global tag application and global voting for target Unit

RealmTagUnit
  a realm-scoped application of an existing global tag to any target Unit
  independent of RealmUnit

RealmTagContext
  pair-level explanatory surface for (realmUnitId, tagUnitId)
  optional materialized contextUnitId carries text/discussion/history
```

The backend change is intentionally larger than a simple migration because it spans Prisma schema naming, services, contracts, seed data, tests, and follow-up frontend contracts.

## Goals / Non-Goals

**Goals:**

- Add `RealmTagContext` as the pair-level interpretation model for `(realmUnitId, tagUnitId)`.
- Keep `RealmTagUnit` independent from `RealmUnit`.
- Preserve global tag vote contribution when creating a realm-scoped tag application.
- Rename Prisma relations to product-role names.
- Make `RealmTagVote` semantically a vote on a `RealmTagUnit` application.
- Add backend validation and JSDoc to prevent repeated conceptual drift.
- Add seed/factory data that makes the intended model visible in development.
- Define frontend follow-up tasks without implementing the frontend in this backend-focused change.

**Non-Goals:**

- Do not make `Realm` a tag/classifier.
- Do not introduce realm-local tag identities.
- Do not require content to be posted into a realm before a realm can classify it.
- Do not remove `RealmUnit`.
- Do not redesign global `UnitTag` or `TagVote`.
- Do not build the final realm-tag context UI in this change.

## Target Design

### Conceptual Model

```text
                 ┌─────────────────────────────┐
                 │ Realm(type=REALM extension) │
                 └──────────────┬──────────────┘
                                │
                  community/feed│membership
                                ▼
                         RealmUnit
                         (realm, unit)

Tag(type=TAG Unit) ───── UnitTag ───── Target Unit
       │              global vote
       │
       │ existing vocabulary only
       ▼
RealmTagContext
(realm, tag) ───── optional contextUnitId
       │
       │ pair-level interpretation
       ▼
RealmTagUnit
(realm, tag, target unit)
       │
       ▼
RealmTagVote
```

### Prisma Model Shape

`RealmTagContext` is new:

```prisma
model RealmTagContext {
  realmUnitId   String  @db.Uuid
  tagUnitId     String  @db.Uuid
  contextUnitId String? @unique @db.Uuid

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  realm       Realm @relation(fields: [realmUnitId], references: [unitId], onDelete: Cascade)
  tag         Unit  @relation("RealmTagContextTag", fields: [tagUnitId], references: [id], onDelete: Cascade)
  contextUnit Unit? @relation("RealmTagContextContent", fields: [contextUnitId], references: [id], onDelete: SetNull)

  @@id([realmUnitId, tagUnitId])
  @@index([tagUnitId])
}
```

`contextUnitId` points to a materialized content Unit, most likely `Unit(type=POST)` with `Post.kind=POST` in phase 1. The identity of the realm-tag pair remains `(realmUnitId, tagUnitId)`.

`RealmTagUnit` keeps the independent triple:

```prisma
model RealmTagUnit {
  realmUnitId String @db.Uuid
  tagUnitId   String @db.Uuid
  unitId      String @db.Uuid

  score     Int     @default(0)
  voteCount Int     @default(0)
  pinned    Boolean @default(false)
  position  String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  realm      Realm @relation("RealmTagApplicationRealm", fields: [realmUnitId], references: [unitId], onDelete: Cascade)
  appliedTag Unit  @relation("RealmTagApplicationAppliedTag", fields: [tagUnitId], references: [id], onDelete: Cascade)
  targetUnit Unit  @relation("RealmTagApplicationTargetUnit", fields: [unitId], references: [id], onDelete: Cascade)

  votes RealmTagVote[] @relation("RealmTagApplicationVotes")

  @@id([realmUnitId, tagUnitId, unitId])
  @@index([realmUnitId, unitId, pinned, position])
  @@index([unitId, realmUnitId])
  @@index([score])
}
```

The exact index list should be finalized during implementation after checking PostgreSQL query plans, but the target is to avoid overlapping indexes that only differ by suffix.

`RealmTagVote` should point at the application:

```prisma
model RealmTagVote {
  realmUnitId String @db.Uuid
  tagUnitId   String @db.Uuid
  unitId      String @db.Uuid
  userId      String @db.Uuid
  value       Int

  createdAt DateTime @default(now())

  application RealmTagUnit @relation(
    "RealmTagApplicationVotes",
    fields: [realmUnitId, tagUnitId, unitId],
    references: [realmUnitId, tagUnitId, unitId],
    onDelete: Cascade
  )

  @@id([realmUnitId, tagUnitId, unitId, userId])
  @@index([userId])
}
```

This removes the need for `realmTagVoteAsRealm`, `realmTagVoteAsTag`, and `realmTagVoteAsUnit` on `Unit`.

### Relation Naming

Replace implementation-shaped names:

```prisma
realmTagAsRealm
realmTagAsTag
realmTagAsUnit
```

with product-role names:

```prisma
model Realm {
  tagApplications RealmTagUnit[]    @relation("RealmTagApplicationRealm")
  tagContexts     RealmTagContext[]
}

model Unit {
  realmTagApplicationsAsAppliedTag RealmTagUnit[] @relation("RealmTagApplicationAppliedTag")
  realmTagApplicationsAsTargetUnit RealmTagUnit[] @relation("RealmTagApplicationTargetUnit")

  realmTagContextsAsTag     RealmTagContext[] @relation("RealmTagContextTag")
  realmTagContextsAsContent RealmTagContext[] @relation("RealmTagContextContent")
}
```

`Realm` is an extension model, so the realm side belongs there. `Tag` has no dedicated extension model today, so tag-side relations remain on `Unit`.

### Global Vote Contribution

Creating a `RealmTagUnit` through the standard authenticated member path SHALL:

1. verify caller membership in the realm,
2. verify `realmUnitId` is a `REALM`,
3. verify `tagUnitId` is a `TAG`,
4. upsert or create the `RealmTagUnit`,
5. insert or update the caller's `RealmTagVote`,
6. idempotently create or preserve the caller's global `TagVote(userId, unitId, tagUnitId, +1)`,
7. recompute `RealmTagUnit.score/voteCount`,
8. recompute or update `UnitTag.score/voteCount` according to the existing global tag vote rules,
9. patch search fields for both global tags and realm-tag keys.

Global `TagVote` remains unique by `(userId, unitId, tagUnitId)`. If the same user applies the same tag to the same Unit through multiple realms, global voting still counts once.

### Backend APIs

Add a realm-tag context API surface. Exact route naming can be finalized during implementation, but recommended routes are:

- `GET /realm-tag-contexts/:realmUnitId/:tagUnitId`
- `PUT /realm-tag-contexts/:realmUnitId/:tagUnitId`
- `POST /realm-tag-contexts/:realmUnitId/:tagUnitId/materialize`

Response DTO:

```ts
type RealmTagContextDTO = {
  realmUnitId: string
  tagUnitId: string
  contextUnitId: string | null
  realm?: RealmDTO
  tag?: UnitDTO
  contextUnit?: UnitDTO
  createdAt?: string | Date
  updatedAt?: string | Date
}
```

Materialization creates the context row if missing and creates `contextUnitId` if absent. It should be idempotent.

### JSDoc / Documentation Requirements

Add JSDoc near contract schemas and service methods:

```ts
/**
 * Realm is a subreddit-like community space, not a tag/classifier.
 *
 * RealmUnit uses a junction-table shape similar to UnitTag, but its meaning is
 * community/feed membership, not semantic tagging.
 */
```

```ts
/**
 * RealmTagUnit records a realm-scoped application of an existing global tag
 * to any target Unit.
 *
 * It does not create a realm-local tag. It also does not require the target
 * Unit to be posted into the Realm via RealmUnit.
 */
```

```ts
/**
 * RealmTagContext stores the explanatory surface for a `(realmUnitId, tagUnitId)`
 * pair. The pair is the identity; `contextUnitId` is only a materialized content
 * carrier for explanation, examples, discussion, and history.
 */
```

### Seed Support

Seed data should demonstrate the product model:

- at least one realm with rules/about/pinboard/tagTree,
- shared global tags used by multiple realms,
- the same tag interpreted by different realms,
- realm-tag applications on Units both inside and outside the realm feed,
- a materialized realm-tag context Unit explaining one pair.

This is not merely demo data; it protects semantics by making product behavior visible during local development and story/test setup.

### Frontend Follow-up Boundary

Frontend work after backend completion should focus on:

- rendering realm-tag highlights as realm sections with a realm title and tag titles below,
- compact `realmTitle:tagTitle` badge rendering only in constrained contexts,
- routes for `/realm/:realmSlug/tag/:tagSlug`,
- query syntax parsing for `realmSlug:tagSlug`, `realmTitle:tagTitle`, and mixed id/slug refs,
- fixing existing components that render raw tag ids instead of translated labels,
- removing UI copy that implies realms create local tags.

These are intentionally follow-up tasks, not part of the initial backend implementation.

## Decisions

### Decision 1: Add `RealmTagContext` as a pair-level table

`contextUnitId` belongs to `(realmUnitId, tagUnitId)`, not to each `(realmUnitId, tagUnitId, unitId)` application row.

Alternatives considered:

- Add `contextUnitId` to `RealmTagUnit`: rejected because it duplicates pair-level data across every target Unit and risks inconsistency.
- Make `realmId:tagId` a new Unit: rejected because it creates a fake tag/entity identity.
- Store explanation text in `Realm.extra`: rejected because it becomes unindexed shadow schema and cannot naturally support discussion/history.

### Decision 2: Keep `RealmTagUnit` independent from `RealmUnit`

A realm can classify any target Unit, even if the target was not posted into that realm feed.

Alternatives considered:

- FK `RealmTagUnit(realmUnitId, unitId)` to `RealmUnit`: rejected because it incorrectly forces all realm-scoped classification to be feed membership.
- Require automatic `RealmUnit` creation when classifying: rejected because classification and posting are separate community actions.

### Decision 3: Move realm-side relations to `Realm`

The realm role in a realm-tag application should be exposed through `Realm`, not through a generic reverse relation on `Unit`.

Alternatives considered:

- Keep `realmTagAsRealm`: rejected because the name has no product meaning.
- Add a dedicated `Tag` extension model now: deferred because it is a larger tag architecture change.

### Decision 4: Model `RealmTagVote` as a vote on the application

The vote does not need three independent reverse Unit relations. Its business target is the `RealmTagUnit` application.

Alternatives considered:

- Keep three Unit FKs: rejected because it creates noisy generated relations and makes cascades service-dependent.
- Store realm tag score only on `RealmTagUnit` without votes: rejected because individual member agreement/disagreement is required.

### Decision 5: Preserve global vote contribution

Realm-scoped application improves global discovery but must not amplify a single user's global vote through multiple realms.

Alternatives considered:

- Client double-write only: rejected because it creates partial success and hides product semantics in frontend coordination.
- No global vote contribution: rejected because realm-tag activity would not improve global tag discovery.

## Risks / Trade-offs

- **[Migration risk] Relation rename breaks generated Prisma consumers** → Mitigation: update all server/search references in one implementation phase and run typecheck/tests.
- **[Global vote amplification] Same user applies the same tag through many realms** → Mitigation: rely on the existing `TagVote(userId, unitId, tagUnitId)` uniqueness and make global contribution idempotent.
- **[Context Unit type ambiguity] It is unclear whether context content should be `POST`, `SHELF`, or a future wiki type** → Mitigation: use `POST` in phase 1 as the existing materialized discussion/content surface; leave room for future wiki specialization.
- **[Index churn] Removing indexes without query-plan validation may hurt production paths** → Mitigation: treat index pruning as measured work with `EXPLAIN` and known query inventory.
- **[Frontend temporarily inconsistent] Backend semantics may land before UI catches up** → Mitigation: tasks include a frontend audit/follow-up phase but implementation remains backend-first.
- **[Existing specs conflict] Older specs mention client double-write and realm/tag symmetry imprecisely** → Mitigation: spec deltas explicitly replace those requirements.

## Migration Plan

1. Add `RealmTagContext` table and contract types.
2. Add Prisma relation renames and update generated client consumers.
3. Backfill `RealmTagContext` only where seed/demo or existing data requires it; no row is required for every existing realm-tag pair.
4. Change `RealmTagVote` relation to reference `RealmTagUnit` as the application.
5. Update `createRealmTagUnit` to idempotently contribute global `TagVote`.
6. Update sync triggers to patch both `realmTagKeys` and global tag fields when a standard realm-tag application write contributes global vote.
7. Add seed examples.
8. Run focused tests for:
   - context materialization,
   - realm-tag application without RealmUnit,
   - global vote idempotency,
   - relation cascade on application delete,
   - seed validity.
9. Run typecheck and relevant Bun tests.

Rollback:

- `RealmTagContext` can be left unused if rollback is needed; it does not change existing application rows.
- Relation renames require code rollback with Prisma regeneration.
- Global vote contribution changes should be guarded by tests and can be reverted to client double-write if necessary, but the target design should remove that frontend responsibility.

## Open Questions

- Should `contextUnitId` create a generic `POST` or should we introduce a future dedicated wiki/page PostKind?
- Should context materialization be owner/moderator-only, or can any realm member create the first context Unit?
- Should `RealmTagContext` expose editable short summary fields in its own table, or should all human-readable content live in `contextUnitId`?
- Which `RealmTagUnit` indexes should remain after measured query-plan review?
- Should the final frontend route prefer slugs (`/realm/:realmSlug/tag/:tagSlug`) with id fallback, or unit ids for exactness?
