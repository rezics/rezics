## Context

Rezics currently uses `Unit` as the identity and lifecycle spine for books, entities, posts, shelves, realms, tags, and other content. `Unit.userId` is already the owner/custodian pointer, while `Post.authorUserId` records the author of a post. This split is valuable: the new design keeps ownership, authorship, edit actor, and wiki custodian identity separate instead of introducing a parallel wiki object system.

Two draft plans informed this change:

- `openspec/plans/wiki-content-ownership-plan.md` identified the need for a system custodian user and field locks.
- `openspec/plans/history-infrastructure.md` identified the need for Unit revisions, content-addressed snapshot payloads, event history for high-change structures, and normal User rows for bots/system processes.

The design updates both plans with the latest decisions:

- Runtime collaborative edit admission MUST NOT infer openness from `Unit.type` or from `Unit.userId == rezicsWikiUser.unitId`.
- Creation mode determines initial owner and initial lock state only.
- `UnitFieldLock` is the runtime source of truth for protected fields.
- Ordinary posts remain author-owned and non-collaborative; only `Post.kind = WIKI` joins the collaborative edit/history model.
- History is an independent service boundary, but v1 does not depend on CDC, Kafka, Debezium, or an external queue. Main writes a transactional outbox row in the same transaction as canonical content changes.

## Goals / Non-Goals

**Goals:**

- Preserve `Unit` as the shared content identity model.
- Seed `rezics` and `rezics-wiki` as ordinary infra `User` rows with backing `Unit(type=USER)` rows.
- Let ordinary users create catalog and wiki content whose `Unit.userId` is the seeded `rezics-wiki` User's `unitId` through explicit wiki-mode frontend flows.
- Support delegated Unit authority with a `UnitCollaborator` table.
- Support sparse field-level and whole-object locks with a `UnitFieldLock` table.
- Keep lock checks cheap for the common no-lock case.
- Capture history through an independent `package/history` service using a main-DB transactional outbox.
- Keep current canonical reads on main server and history reads on the history service; clients may combine both read results.
- Add a wiki post subtype using existing `Unit` + `Post` primitives.

**Non-Goals:**

- Real-time co-editing, presence, CRDT, or operational transform.
- Moderation approval queues.
- Semantic diff UI.
- CDC or external queue infrastructure.
- A separate WikiPage table or special wiki-only renderer.
- A special actor kind for system/bot writes.
- Automatic backfill of existing development rows into `rezics-wiki`.

## Target Design

### 1. Infra Users

Seed two ordinary users:

```text
rezics
  Purpose: official platform account for platform-owned announcements/content.
  Auth: no authUserId, cannot log in.

rezics-wiki
  Purpose: wiki/catalog custodian account for community-owned catalog entries.
  Auth: no authUserId, cannot log in.
```

Both have `Unit(type=USER)` rows and normal `User` rows. They are not a separate actor type. History records, audit logs, ownership checks, and rendering receive their regular `unitId`.

Display policy is product-facing, not schema-facing: app/admin renderers may show content owned by the seeded `rezics-wiki` User's `unitId` as "Community catalog" or equivalent copy, but storage and permission code treat the owner value as a normal user `unitId`.

### 2. Authority Tables

Add delegated Unit authority:

```prisma
model UnitCollaborator {
  unitId    String   @db.Uuid
  userId    String   @db.Uuid
  roleKey   String   @db.VarChar(32)
  addedById String   @db.Uuid
  createdAt DateTime @default(now())

  unit    Unit @relation(fields: [unitId], references: [id], onDelete: Cascade)
  user    User @relation("UnitCollaboratorUser", fields: [userId], references: [unitId], onDelete: Cascade)
  addedBy User @relation("UnitCollaboratorAddedBy", fields: [addedById], references: [unitId], onDelete: Restrict)

  @@id([unitId, userId])
  @@index([userId, roleKey])
  @@index([unitId, roleKey])
}
```

Initial `roleKey` vocabulary:

- `owner`: full delegated authority except primary ownership transfer.
- `maintainer`: can edit unlocked/locked fields according to configured policy and manage wiki content, but cannot transfer primary owner.
- `editor`: can edit collaborative unlocked fields.
- `viewer`: reserved for future restricted collaboration; not used for public wiki v1.

This table augments `Unit.userId`; it does not replace it. `Unit.userId` remains the accountable primary owner/custodian.

### 3. Sparse Field Locks

Add lock rows only where locks exist:

```prisma
model UnitFieldLock {
  unitId     String   @db.Uuid
  fieldKey   String   @db.VarChar(96)
  lockedById String   @db.Uuid
  reason     String?
  createdAt  DateTime @default(now())

  unit     Unit @relation(fields: [unitId], references: [id], onDelete: Cascade)
  lockedBy User @relation("UnitFieldLockLockedBy", fields: [lockedById], references: [unitId], onDelete: Restrict)

  @@id([unitId, fieldKey])
  @@index([lockedById, createdAt])
}
```

`fieldKey = "*"` locks the whole object for community edits. Field keys are contract-defined semantic keys, not raw database columns.

Examples:

```text
identity.title
identity.subtitle
identity.cover
bibliographic.isbn13
bibliographic.publicationDate
credits.authors
credits.publishers
entity.kind
entity.verified
post.body
```

Performance model:

- Personal/non-collaborative endpoints reject community edits before lock lookup.
- Collaborative edit endpoints perform one sparse lookup:
  `WHERE unitId = ? AND fieldKey IN ("*", ...changedFieldKeys)`.
- Most Units have no lock rows, so the common case is a single indexed empty result.
- Lock rows are small and bounded by number of locked fields, not by number of Units.

### 4. Runtime Edit Admission

Runtime admission does not use `Unit.type` or owner identity as a shortcut for openness.

Pseudocode:

```text
canEditUnitFields(actor, unit, changedFieldKeys, surfacePolicy):
  if actor is ROOT/ADMIN:
    return allow("admin override", audit=true)

  if actor.userId == unit.userId:
    return allow("primary owner")

  collaborator = find UnitCollaborator(unit.id, actor.userId)
  if collaborator role grants this surface/fields:
    return allow("collaborator")

  if surfacePolicy.collaborative !== true:
    return deny("surface is not collaborative")

  locks = UnitFieldLock where unitId = unit.id and fieldKey in ["*", ...changedFieldKeys]
  if locks not empty:
    return deny("field locked")

  return allow("community edit")
```

`surfacePolicy.collaborative` is endpoint/product policy. It is true for explicit wiki edit surfaces such as wiki catalog field edits and `Post.kind = WIKI` body edits. It is false for ordinary post updates, review/remark edits, personal shelf edits, and owner-only profile content.

Creation mode controls initial state:

```text
wiki creation:
  Unit.userId = rezicsWikiUser.unitId
  no whole-object lock by default
  optional initial field locks according to server policy

personal creation:
  Unit.userId = currentUser.unitId
  UnitFieldLock("*") by default when the type also has collaborative edit surfaces
```

### 5. Main Writes And History Service

History is an independent service package (`package/history`) with its own Prisma schema and database connection. Main remains the write authority for canonical content and permission checks.

Write flow:

```text
Client
  -> package/server API
     1. authenticate actor
     2. compute changedFieldKeys
     3. run authority/lock gate
     4. write canonical rows in main DB
     5. build post-commit-exact history payload inside the same transaction
     6. write HistoryOutbox row inside the same transaction
  -> commit

package/history
  -> poll/claim HistoryOutbox rows from main DB through a service account/API or shared DB access
  -> persist UnitRevision / RevisionContent / structure events in history DB
  -> mark outbox rows processed or failed
```

Main MUST NOT call history over HTTP inside the canonical DB transaction. That would create dual-write failure modes:

- history write succeeds but main rolls back;
- main commits but remote history call fails;
- remote latency holds main DB locks open.

The transactional outbox is the v1 reliability boundary. It is not a full queue system and does not require CDC. If a future CDC/queue system is introduced, it can replace the outbox consumer without changing mutation endpoint semantics.

### 6. History Payloads

History outbox events store the exact changed payload or snapshot generated from the transaction view. The history service MUST NOT reconstruct a revision by later reading main current state; consecutive edits could otherwise cause history to record the wrong version.

Editorial revision payloads use slot names:

```json
{
  "unitId": "uuid",
  "sequence": 42,
  "actorUserId": "uuid",
  "changedFieldKeys": ["identity.title", "credits.authors"],
  "slots": {
    "unit": {},
    "translations": [],
    "extension": {},
    "credits": [],
    "subjects": [],
    "tags": [],
    "post": {}
  }
}
```

Reference payloads store Unit ids, not denormalized display fields. UI/history clients resolve display names through main server batch resolve APIs.

Sequence generation options:

- v1 preferred: main DB `UnitHistoryClock(unitId, nextSequence)` updated transactionally with canonical mutation and outbox write.
- Alternative: history service assigns sequence on consume. Rejected because it can preserve consume order but cannot easily prove main mutation order across retries and concurrent edits.

### 7. History Storage

Initial history service schema:

```prisma
model UnitRevision {
  id               String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  unitId           String   @db.Uuid
  sequence         BigInt
  contentHash      String   @db.VarChar(64)
  actorUserId      String   @db.Uuid
  changedFieldKeys String[]
  message          String?
  createdAt        DateTime
  ingestedAt       DateTime @default(now())

  content RevisionContent @relation(fields: [contentHash], references: [hash])

  @@unique([unitId, sequence])
  @@index([unitId, createdAt(sort: Desc)])
  @@index([actorUserId, createdAt])
  @@index([contentHash])
}

model RevisionContent {
  hash      String   @id @db.VarChar(64)
  payload   Json
  createdAt DateTime @default(now())

  revisions UnitRevision[]
}
```

Book content structure history remains event-based:

- add/update/remove/move content structure nodes;
- link/unlink materialized chapter Unit ids;
- bulk replace for imports;
- periodic snapshots if reconstruction cost becomes high.

This is separate from `Post.kind = WIKI` body history, which is snapshot-based editorial history.

### 8. Wiki Posts

Wiki posts use existing primitives:

```text
Unit(type=POST)
  userId = rezicsWikiUser.unitId for wiki-mode creation
  normal Unit translations for title/summary if needed

Post
  kind = WIKI
  authorUserId = creator of the first version
  targetUnitId = subject Unit when attached to a book/entity/realm/tag/etc.
  body = current markdown
```

Ordinary `POST`, `REVIEW`, `REMARK`, `REPLY`, `EXCERPT`, and `CHAPTER` content remains author/owner-controlled and does not enter community lock checks. `Post.isLocked` keeps its existing thread/reply semantics and is not reused as field-level wiki protection.

### 9. API And Frontend

Server/API:

- creation endpoints accept a constrained `creationMode` where applicable;
- clients cannot submit arbitrary owner ids for wiki creation;
- server resolves the seeded `rezics-wiki` User internally and writes its `unitId`;
- update endpoints compute changed field keys server-side or validate client-provided keys against request body;
- authority/lock rejection returns typed 403 errors with locked field metadata;
- history read endpoints are exposed by `package/history` and wrapped by `package/api`.

Frontend:

- `/book/new` or its successor provides clear catalog/wiki vs personal creation modes;
- EntityPicker inline create uses wiki creation mode;
- wiki post editor creates/updates `Post.kind = WIKI`;
- ordinary post/review/remark editors keep existing author-only semantics;
- history timelines query history service and resolve current display references from main server;
- owner/collaborator UI exposes lock controls only where the actor can manage locks;
- content whose owner id is the seeded `rezics-wiki` User's `unitId` renders as community catalog/wiki content, not as a normal human profile card.

## Decisions

### Decision 1: Lock table is the runtime fact source

Use `UnitFieldLock` rows, not `Unit.lockedFields: String[]`.

Alternatives considered:

- `Unit.lockedFields String[]`: simpler reads, but lacks lock author, reason, and future audit/expiry shape.
- Per-cell/locale lock rows from day one: precise but too fine-grained before UI evidence.

Rationale: sparse rows preserve performance and make locks first-class enough for audit and future workflows.

### Decision 2: Runtime openness is endpoint policy, not type/owner inference

Do not allow community edits merely because `Unit.type` is wiki-eligible or `Unit.userId == rezicsWikiUser.unitId`.

Alternatives considered:

- `type in [BOOK, ENTITY, GAME, MEDIA]` means open: rejected because personal BOOK/work content exists.
- `ownerId == rezicsWikiUser.unitId` means open: rejected because wiki-owned fields may still be locked or fully protected.

Rationale: creation mode sets initial facts; runtime checks read facts.

### Decision 3: Transactional outbox over synchronous history HTTP writes

Main writes canonical content and a history outbox row in one DB transaction.

Alternatives considered:

- Main calls history service inside transaction: rejected due to dual-write and lock-duration risk.
- Wait for CDC/queue: rejected because this change should not depend on future infrastructure.
- In-process history package: rejected for target architecture because user wants independent service and history read APIs decoupled from main.

Rationale: transactional outbox is the smallest reliable bridge between main canonical data and independent history service.

### Decision 4: Wiki post is a Post subtype

Use `Post.kind = WIKI`, not a separate WikiPage table.

Alternatives considered:

- New `WikiPage` extension table: rejected because it creates a separate system for content that already fits Unit/Post.
- Store wiki body in `Unit.extra`: rejected because body/history/edit permissions become untyped and harder to index.

Rationale: `Post` already has author, target, body, replies, and markdown rendering. A wiki subtype keeps the model cohesive.

### Decision 5: `rezics` and `rezics-wiki` are ordinary users

No `ActorKind`, no system user side table, no special history path.

Alternatives considered:

- Reuse root: rejected because root is admin authority, not content custodian.
- Single `system` user: rejected because product semantics benefit from separating official platform actions from wiki custodian ownership.

Rationale: two ordinary users give clear ownership semantics without special code paths.

## Risks / Trade-offs

- [Risk] Lock checks add an extra query to collaborative edits. -> Mitigation: only collaborative surfaces query locks; table is sparse and indexed by `(unitId, fieldKey)`.
- [Risk] History service lags behind main writes. -> Mitigation: UI treats history as eventually consistent, outbox lag is observable, and canonical reads still come from main.
- [Risk] Outbox payloads become large for full snapshots. -> Mitigation: payloads are content-addressed in history, and large/high-frequency structures use event payloads instead of full snapshots.
- [Risk] Field-key vocabulary drifts from request bodies. -> Mitigation: define field keys in `package/contract`, map changed request fields server-side, and add tests for each mutation endpoint.
- [Risk] `rezics-wiki` rendering leaks as a normal user card. -> Mitigation: add shared identity classification for infra users and UI tests around catalog bylines.
- [Risk] Collaborator roles become too broad. -> Mitigation: keep initial roles small and enforce capabilities in a shared authority helper rather than scattered string checks.
- [Risk] Creating a new history package adds operational complexity. -> Mitigation: mirror existing service package patterns (`notify`, `reaction`) and keep v1 consumption polling-based.

## Rollout Plan

1. Add contract vocabulary and schema types for creation mode, field keys, authority roles, locks, history payloads, and `PostKind.WIKI`.
2. Seed `rezics` and `rezics-wiki`.
3. Add main schema tables: `UnitCollaborator`, `UnitFieldLock`, `UnitHistoryClock`, and `HistoryOutbox`.
4. Add shared server authority helper and migrate one low-risk collaborative endpoint behind it.
5. Add `package/history` service skeleton, Prisma schema, outbox consumer, and read APIs.
6. Add history outbox payload builders for Units and wiki posts.
7. Add wiki creation APIs and frontend creation-mode flows.
8. Add wiki post editor and history timeline UI.
9. Expand mutation coverage to Book/Entity/Game/Media attribution and metadata fields.
10. Add admin lock/collaborator/history inspection tools.
11. Run validation, then enable wiki-mode creation in app navigation.

Rollback:

- Disable frontend wiki creation entry points.
- Keep seeded users and new tables; they are inert when no endpoints write to them.
- Pause history outbox consumption if history service has issues; main canonical writes continue, and pending outbox rows can be replayed after fixes.

## Open Questions

- Exact public labels for `rezics` and `rezics-wiki` in app/admin UI.
- Whether personal-mode BOOK/GAME/MEDIA should always receive `UnitFieldLock("*")` or only when a collaborative endpoint exists for that type.
- Whether `maintainer` can manage locks by default or only `owner`/primary owner can.
- Which first metadata endpoints should become collaborative in the initial rollout versus remaining owner/admin-only.
- Whether history service reads main `HistoryOutbox` directly or main exposes an internal claim/ack API for stricter service boundaries.
