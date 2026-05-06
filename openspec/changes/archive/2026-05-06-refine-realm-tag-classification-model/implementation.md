## Implementation Notes

### 1.1 Usage Inventory and Rename Map

Inventory command:

```bash
rg -n "RealmTagUnit|RealmTagVote|RealmUnit|UnitTag|TagVote|realmTagAsRealm|realmTagAsTag|realmTagAsUnit|realmTagVoteAsRealm|realmTagVoteAsTag|realmTagVoteAsUnit" package openspec --glob '!**/node_modules/**'
```

Current generated-client consumers of removed relation field names:

- `package/server/prisma/schema.prisma`
- `package/search/src/sync.ts`
- `package/server/src/post/post.service.ts`
- `package/server/src/post/post.service.test.ts`

Current realm-tag vote selector consumers:

- `package/server/src/realm/realm.service.ts`

Rename map:

- `Unit.realmTagAsRealm` / `@relation("RealmTagRealm")` -> `Realm.tagApplications` / `@relation("RealmTagApplicationRealm")`
- `RealmTagUnit.realm` type `Unit` -> `RealmTagUnit.realm` type `Realm`
- `Unit.realmTagAsTag` / `@relation("RealmTagTag")` -> `Unit.realmTagApplicationsAsAppliedTag` / `@relation("RealmTagApplicationAppliedTag")`
- `RealmTagUnit.tag` -> `RealmTagUnit.appliedTag`
- `Unit.realmTagAsUnit` / `@relation("RealmTagUnit")` -> `Unit.realmTagApplicationsAsTargetUnit` / `@relation("RealmTagApplicationTargetUnit")`
- `RealmTagUnit.unit` -> `RealmTagUnit.targetUnit`
- `Unit.realmTagVoteAsRealm`, `Unit.realmTagVoteAsTag`, `Unit.realmTagVoteAsUnit` -> removed
- `RealmTagVote.realm`, `RealmTagVote.tag`, `RealmTagVote.unit` -> `RealmTagVote.application`
- `RealmTagVote` unique selector `realmUnitId_userId_unitId_tagUnitId` -> `realmUnitId_tagUnitId_unitId_userId`

### 1.8 RealmTagUnit Index Review

Observed query paths from `rg`:

- list by `(realmUnitId, unitId)` with pin/position and score ordering
- list by `(unitId, realmUnitId)` for content/search sync
- filter/list by `(tagUnitId, realmUnitId)`
- moderation discovery by `score` with optional `realmUnitId`

Retained indexes:

- `@@index([realmUnitId, unitId])`
- `@@index([unitId, realmUnitId])`
- `@@index([tagUnitId, realmUnitId])`
- `@@index([realmUnitId, unitId, pinned, position])`
- `@@index([score])`

Removed overlapping suffix index:

- `@@index([realmUnitId, unitId, score])`

### Frontend Follow-up Audit

- Render realm tag highlights as sections keyed by resolved realm display data, with resolved global tag titles below.
- Use compact `realmTitle:tagTitle` badges only in constrained surfaces such as chips or search filter summaries.
- Add route/query follow-up for slug/id parsing forms such as `realmSlug:tagSlug`, `realmTitle:tagTitle`, and exact UUID fallbacks.
- Avoid full frontend redesign in this change; backend contracts, search keys, and seed examples are the stable foundation for later UI work.

### Final Implementation Decisions

- Materialized realm-tag context content uses `Unit(type=POST)` plus `Post.kind=POST` in phase 1.
- Realm-tag context update/materialize permissions allow platform admins, the realm Unit owner, and realm members with `owner`, `admin`, or `moderator` role.
- Retained RealmTagUnit indexes cover `(realmUnitId, unitId)`, `(unitId, realmUnitId)`, `(tagUnitId, realmUnitId)`, pin ordering, and score-based moderation discovery.
- `realmTagKeys` remain machine-facing search keys formatted exactly as `"{realmUnitId}:{tagUnitId}"`.
