---
title: Moderation Governance Model
status: draft
created: 2026-06-03
completed:
supersededBy:
tags: [governance, moderation, realm, unit, audit, history]
---

## Context

Rezics needs two moderation scopes:

- **Global moderation**: applies to a `Unit` everywhere.
- **Realm moderation**: applies to one `(realmUnitId, unitId)` relation.

Those scopes should share the same moderation vocabulary where the semantics are
the same, but they must not share the same current-state storage. Hot read paths
are different: global reads filter `Unit`; realm feed reads filter `UnitRealm`.

This is an exploration document, not an implementation proposal. It records the
current architectural direction so it can graduate into `/rezics-propose`.

## Naming Decision

Keep `Unit.visibility = PUBLIC | UNLISTED | PRIVATE`.

That field has the stronger public-product meaning: who the Unit is meant to be
available to under normal publication rules. Do not rename it just to make room
for moderation.

The moderation-result field should not be named `visibilityState`, because
`visible` is not a policy and because it competes with `Unit.visibility`.
Use a restriction name instead:

```prisma
enum ModerationServingRestriction {
  NONE
  HIDDEN
  TOMBSTONE
}
```

Meaning:

- `NONE`: no moderation serving restriction.
- `HIDDEN`: remove from public discovery/list/search/feed surfaces, but allow
  privileged/direct moderation reads.
- `TOMBSTONE`: render a tombstone shell instead of the original content where a
  placeholder is needed for thread continuity or auditability.

This is not just a visual style. It affects serving: SQL filters, Meilisearch
documents, feed membership, DTO content redaction, and render behavior.

## Are Other Systems This Complex?

Not all systems expose this complexity in one table, but mature moderation
systems separate the same concerns:

- Reddit separates community mod queue from mod log. Queue actions include
  approve/remove/spam/lock; mod log is used to find who acted.
- Discourse separates review queue workflow from content approval/hidden/delete
  effects and has both site-wide and category approval.
- Mastodon separates reports, account warnings/actions, local/server-scope
  moderation, appeals, and reversible/non-reversible consequences.
- Lemmy separates instance admins from community moderators and exposes modlog
  filters by community, moderator, target, and action type.
- Slack/GitLab/Google Cloud audit logs model actor/action/entity/context rather
  than dumping arbitrary before/after object snapshots.

The lesson is not "copy their schemas". The lesson is: high-traffic community
moderation eventually needs separate current state, workflow, and audit/event
records.

Sources used during exploration:

- Reddit Moderation Queue: https://support.reddithelp.com/hc/en-us/articles/15484440494356-Moderation-Queue
- Reddit Moderation Log: https://support.reddithelp.com/hc/en-us/articles/15484543117460-Moderation-Log
- Discourse Moderation Guide: https://meta.discourse.org/t/discourse-moderation-guide/63116
- Mastodon moderation actions: https://docs.joinmastodon.org/admin/moderation/
- Mastodon admin reports API: https://docs.joinmastodon.org/methods/admin/reports/
- Lemmy moderation docs: https://join-lemmy.org/docs/users/04-moderation.html
- Lemmy modlog API type: https://join-lemmy.org/lemmy-js-client-docs/main/types/GetModlog.html
- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- Slack Audit Logs API: https://docs.slack.dev/admins/audit-logs-api
- GitLab audit event schema: https://docs.gitlab.com/user/compliance/audit_event_schema/
- Google Cloud AuditLog: https://docs.cloud.google.com/service-infrastructure/docs/service-control/reference/rpc/google.cloud.audit

## Service Boundary

Authoritative moderation writes should live in the main server/governance
database, not in the history service.

Reason: snapshot update and authoritative moderation ledger append must commit
atomically. If the Unit/UnitRealm row changes but the moderation action is lost,
or the action is written but the state rolls back, moderation accountability is
broken.

The history service should receive an outbox projection for timelines, compare
views, exports, and long-term retention. It should not be the writer of truth for
moderation state.

```text
package/server (main DB)
  owns:
    Unit.reviewState
    Unit.servingRestriction
    UnitRealm.reviewState
    UnitRealm.servingRestriction
    Post.isLocked
    UnitRealm.isLocked
    UnitFieldLock
    ModerationCase
    RealmModerationQueueItem
    ModerationAction
    ModerationActionEffect
    ModerationOutbox

package/history (history DB)
  owns:
    editorial UnitRevision
    structure StructureEvent
    projected moderation timeline, ingested from ModerationOutbox
```

The history service can show moderation events alongside editorial history, but
it should store them in a different table/model from `UnitRevision`.

## Why Not Store Before/After JSON

Do not store full `before` / `after` object snapshots in moderation history.

Problems:

- It creates a second database of potentially sensitive content, PII, private
  notes, raw reports, and future fields with weaker access assumptions.
- It is schema-hostile. Every future field rename has to decide whether old
  before/after JSON is still meaningful.
- It is expensive and noisy at scale.
- It makes the audit log pretend to be canonical state, while the real canonical
  state is the snapshot table.

Store structured action facts and typed scalar effects instead:

- actor
- target
- scope
- action kind
- outcome
- reason code/message
- related workflow ids
- resulting target version
- typed effect value

To reconstruct a timeline, order actions by `(target, targetVersion, createdAt)`.
To answer "what is current state", read the snapshot row.

## Current Schema To Remove Or Replace

These are not implementation commands. This is the schema-level migration
direction.

### package/server/prisma/schema.prisma

Remove global content moderation state as a separate 1:1 snapshot table:

```prisma
// DELETE after backfill into Unit
enum ContentModerationStateKind {
  VISIBLE
  HIDDEN
  TOMBSTONED
  REMOVED
}

// DELETE after backfill into Unit.reviewState / Unit.servingRestriction
model ContentModerationState {
  moderatedUnitId String @id @db.Uuid
  state           ContentModerationStateKind @default(VISIBLE)
  decidedById     String? @db.Uuid
  caseId          String? @db.Uuid
  reason          String?
  metadata        Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  moderatedUnit Unit @relation(fields: [moderatedUnitId], references: [id], onDelete: Cascade)
  decidedBy     User? @relation("ContentModerationStateDecidedBy", fields: [decidedById], references: [unitId], onDelete: SetNull)
  case          ModerationCase? @relation(fields: [caseId], references: [id], onDelete: SetNull)

  @@index([state, updatedAt])
  @@index([decidedById, updatedAt])
  @@index([caseId])
}
```

Rename realm current-state fields:

```prisma
// REPLACE
enum UnitRealmModerationState {
  PENDING_REVIEW
  APPROVED
  REJECTED
  REMOVED
}

enum UnitRealmVisibilityState {
  VISIBLE
  HIDDEN
  TOMBSTONED
}

model UnitRealm {
  moderationState UnitRealmModerationState @default(APPROVED)
  visibilityState UnitRealmVisibilityState @default(VISIBLE)
  isLocked        Boolean @default(false)
}
```

with:

```prisma
// ADD/RENAME
enum ModerationReviewState {
  PENDING_REVIEW
  APPROVED
  REJECTED
  REMOVED
}

enum ModerationServingRestriction {
  NONE
  HIDDEN
  TOMBSTONE
}

model UnitRealm {
  realmUnitId String @db.Uuid
  unitId      String @db.Uuid

  reviewState        ModerationReviewState @default(APPROVED)
  servingRestriction ModerationServingRestriction @default(NONE)
  isLocked           Boolean @default(false)
  moderationVersion  BigInt @default(0)
  createdAt          DateTime @default(now())

  realm Unit @relation("RealmContent", fields: [realmUnitId], references: [id], onDelete: Cascade)
  unit  Unit @relation("UnitInRealm", fields: [unitId], references: [id], onDelete: Cascade)

  @@id([realmUnitId, unitId])
  @@index([unitId])
  @@index([realmUnitId, createdAt])
  @@index([realmUnitId, reviewState, servingRestriction, createdAt])
  @@index([realmUnitId, reviewState, servingRestriction, isLocked, createdAt])
}
```

Add global current-state fields to `Unit`:

```prisma
// ADD to model Unit
model Unit {
  id String @id @default(dbgenerated("uuidv7()")) @db.Uuid

  // Existing field. Keep this name unless a separate product-wide rename is
  // planned.
  visibility UnitVisibility @default(PUBLIC)

  reviewState        ModerationReviewState @default(APPROVED)
  servingRestriction ModerationServingRestriction @default(NONE)
  moderationVersion  BigInt @default(0)
}
```

Rationale: `Unit.reviewState` and `Unit.servingRestriction` are hot read
snapshot fields. They are not the moderation history.

## New Authoritative Moderation History Schema

### package/server/prisma/schema.prisma

The main service owns these tables.

```prisma
enum ModerationScopeKind {
  GLOBAL
  REALM
}

enum ModerationTargetKind {
  UNIT
  UNIT_REALM
  POST
  COMMENT
  UNIT_FIELD
  ACCOUNT
}

enum ModerationActorKind {
  USER
  STAFF
  SYSTEM
  AUTOMATION
  IMPORT
}

enum ModerationActionKind {
  APPROVE
  REJECT
  REMOVE
  RESTORE
  HIDE
  TOMBSTONE
  LOCK
  UNLOCK
  FIELD_LOCK
  FIELD_UNLOCK
  WARN
  ESCALATE
  REVERSE
  NOOP
}

enum ModerationOutcomeKind {
  APPLIED
  NOOP
  DENIED
  SUPERSEDED
}

enum ModerationEffectKind {
  SET_REVIEW_STATE
  SET_SERVING_RESTRICTION
  SET_LOCK_STATE
  CREATE_FIELD_LOCK
  DELETE_FIELD_LOCK
  APPLY_ACCOUNT_ENFORCEMENT
  REVOKE_ACCOUNT_ENFORCEMENT
}

model ModerationAction {
  id             String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  scopeKind      ModerationScopeKind
  targetKind     ModerationTargetKind

  /// Primary target Unit when the target has one. For UNIT_FIELD this is the
  /// Unit owning the field path. For UNIT_REALM this is the content Unit.
  unitId         String? @db.Uuid
  realmUnitId    String? @db.Uuid
  targetId       String @db.VarChar(128)

  actorKind      ModerationActorKind
  actorUserId    String? @db.Uuid
  actionKind     ModerationActionKind
  outcomeKind    ModerationOutcomeKind @default(APPLIED)

  reasonCode     String @db.VarChar(96)
  reasonText     String?
  publicMessage  String?
  policyKey      String? @db.VarChar(96)
  policyVersion  Int?

  caseId         String? @db.Uuid
  queueItemId    String? @db.Uuid
  appealId       String? @db.Uuid
  reportId       String? @db.Uuid

  /// Link to the action this reverses. Reversal is explicit; do not mutate old
  /// action rows.
  reversesActionId String? @db.Uuid

  requestId      String? @db.VarChar(128)
  idempotencyKey String @db.VarChar(160)
  importedFrom   String? @db.VarChar(128)
  createdAt      DateTime @default(now())

  effects ModerationActionEffect[]

  actor User? @relation("ModerationActionActor", fields: [actorUserId], references: [unitId], onDelete: SetNull)

  @@unique([idempotencyKey])
  @@index([scopeKind, createdAt])
  @@index([targetKind, targetId, createdAt])
  @@index([unitId, createdAt])
  @@index([realmUnitId, createdAt])
  @@index([actorUserId, createdAt])
  @@index([caseId, createdAt])
  @@index([queueItemId, createdAt])
  @@index([actionKind, createdAt])
  @@index([reasonCode, createdAt])
}

model ModerationActionEffect {
  id          String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  actionId    String @db.Uuid
  effectKind  ModerationEffectKind
  fieldKey    String @db.VarChar(96)

  /// Typed scalar value only: enum string, boolean, short id, or null. Do not
  /// store whole object snapshots.
  value       String?

  /// Field-level target such as UnitFieldLock.path.
  path        String? @db.VarChar(256)

  /// Resulting version on Unit or UnitRealm after applying this action.
  targetVersion BigInt?

  createdAt DateTime @default(now())

  action ModerationAction @relation(fields: [actionId], references: [id], onDelete: Cascade)

  @@index([actionId])
  @@index([effectKind, createdAt])
  @@index([fieldKey, value])
  @@index([path])
}

model ModerationOutbox {
  id        String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  actionId  String @db.Uuid
  topic     String @db.VarChar(96)
  payload   Json
  createdAt DateTime @default(now())
  claimedAt DateTime?
  processedAt DateTime?
  attempts  Int @default(0)
  lastError String?

  @@index([topic, createdAt])
  @@index([processedAt, createdAt])
  @@index([actionId])
}
```

This is intentionally not named `AuditLog`. It is a domain ledger for
moderation/governance actions. A security audit log can still exist elsewhere.

## Workflow Schema

Workflow tables stay in main/governance. They are not current serving state and
not the canonical moderation ledger.

Keep or remodel:

```prisma
model ModerationCase {
  id String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  state ModerationCaseState @default(NEW)
  // report grouping, assignment, severity, subject, target address
}

model RealmModerationQueueItem {
  id String @id @default(dbgenerated("uuidv7()")) @db.Uuid
  realmUnitId String @db.Uuid
  state RealmModerationQueueState @default(NEW)
  // realm intake, assignment, linked global case, source feedback
}
```

But workflow transitions should append `ModerationAction` when they change
serving state, lock state, account enforcement, or field locks.

Pure workflow transitions can append lighter action kinds:

```text
case triaged       -> ModerationAction(actionKind=NOOP, targetKind=UNIT, outcome=APPLIED)
queue assigned     -> ModerationAction(actionKind=NOOP, targetKind=UNIT_REALM, outcome=APPLIED)
queue escalated    -> ModerationAction(actionKind=ESCALATE, targetKind=UNIT_REALM)
case reversed      -> ModerationAction(actionKind=REVERSE, reversesActionId=...)
```

## Lock Modeling

Lock state is control-plane state, not editorial revision state.

### Current snapshot storage

Keep current snapshot fields where they are used:

```prisma
model Post {
  unitId String @id @db.Uuid
  isLocked Boolean @default(false)
}

model UnitRealm {
  isLocked Boolean @default(false)
}

model UnitFieldLock {
  unitId     String @db.Uuid
  path       String @db.VarChar(256)
  lockedById String @db.Uuid
  reason     String?
  createdAt  DateTime @default(now())

  @@id([unitId, path])
  @@index([lockedById, createdAt])
}
```

### History storage

Do not put lock changes into `UnitRevision`.

```text
Post.isLocked change:
  ModerationAction(targetKind=POST, actionKind=LOCK|UNLOCK)
  ModerationActionEffect(effectKind=SET_LOCK_STATE, fieldKey=isLocked, value=true|false)

UnitRealm.isLocked change:
  ModerationAction(scopeKind=REALM, targetKind=UNIT_REALM, realmUnitId=...)
  ModerationActionEffect(effectKind=SET_LOCK_STATE, fieldKey=isLocked, value=true|false)

UnitFieldLock create/delete:
  ModerationAction(targetKind=UNIT_FIELD, unitId=..., actionKind=FIELD_LOCK|FIELD_UNLOCK)
  ModerationActionEffect(effectKind=CREATE_FIELD_LOCK|DELETE_FIELD_LOCK, fieldKey=unitFieldLock, path=...)
```

`UnitFieldLock` should not need a separate moderation history table unless we
choose physically separate ledgers. In the unified header/effect model it is a
first-class target kind.

## History Service Projection Schema

### package/history/prisma/schema.prisma

Add projected moderation timeline tables. These are read/projection tables, not
the write source of truth.

```prisma
model ModerationTimelineEvent {
  id              String @id @db.Uuid
  sourceActionId  String @unique @db.Uuid
  scopeKind       String @db.VarChar(32)
  targetKind      String @db.VarChar(64)
  unitId          String? @db.Uuid
  realmUnitId     String? @db.Uuid
  targetId        String @db.VarChar(128)
  actorKind       String @db.VarChar(32)
  actorUserId     String? @db.Uuid
  actionKind      String @db.VarChar(64)
  outcomeKind     String @db.VarChar(32)
  reasonCode      String @db.VarChar(96)
  reasonText      String?
  publicMessage   String?
  caseId          String? @db.Uuid
  queueItemId     String? @db.Uuid
  reversesActionId String? @db.Uuid
  createdAt       DateTime
  ingestedAt      DateTime @default(now())

  effects ModerationTimelineEffect[]

  @@index([unitId, createdAt(sort: Desc)])
  @@index([realmUnitId, createdAt(sort: Desc)])
  @@index([targetKind, targetId, createdAt(sort: Desc)])
  @@index([actorUserId, createdAt(sort: Desc)])
  @@index([actionKind, createdAt(sort: Desc)])
}

model ModerationTimelineEffect {
  id            String @id @db.Uuid
  eventId       String @db.Uuid
  effectKind    String @db.VarChar(64)
  fieldKey      String @db.VarChar(96)
  value         String?
  path          String? @db.VarChar(256)
  targetVersion BigInt?

  event ModerationTimelineEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@index([eventId])
  @@index([fieldKey, value])
  @@index([path])
}
```

This lets history UI show:

```text
Unit timeline = editorial UnitRevision + structure StructureEvent + moderation timeline
Realm moderation timeline = moderation timeline where realmUnitId = X
Field lock timeline = moderation timeline where targetKind = UNIT_FIELD and path = X
```

But restore/editorial compare remains based on `UnitRevision`, not moderation
events.

## Read Path Implications

Global public content reads:

```text
Unit.status = PUBLISHED
Unit.visibility in PUBLIC/UNLISTED rules depending on route
Unit.reviewState = APPROVED
Unit.servingRestriction = NONE
```

Realm public feed reads:

```text
Unit.status = PUBLISHED
Unit.reviewState = APPROVED
Unit.servingRestriction = NONE
UnitRealm.realmUnitId = current realm
UnitRealm.reviewState = APPROVED
UnitRealm.servingRestriction = NONE
```

Tombstone-aware thread reads:

```text
Allow TOMBSTONE rows for continuity, but DTO content is redacted and rendered as
a tombstone shell.
```

Moderator overlay reads:

```text
Return Unit review/restriction state and bounded UnitRealm state overlays for
the requested ids.
```

Search indexing:

```text
Exclude Unit.servingRestriction != NONE from public global indexes.
Exclude UnitRealm.servingRestriction != NONE from realmIds projection.
Keep privileged moderation search/indexes separate if needed.
```

## Migration Direction

Because this project is still in development and a full data migration is
planned, prefer a clean cutover over compatibility adapters.

High-level migration order:

1. Add shared enums and Unit/UnitRealm snapshot fields.
2. Add `ModerationAction`, `ModerationActionEffect`, and `ModerationOutbox`.
3. Backfill Unit snapshot from `ContentModerationState`.
4. Backfill UnitRealm snapshot from current `moderationState` and
   `visibilityState`.
5. Import existing `ModerationCaseEvent`, `RealmModerationEvent`, and
   `StaffAuditLog` into `ModerationAction` as best-effort historical actions.
   Mark imported rows with `importedFrom`.
6. Update governance service writes to update snapshot + append ledger in one
   transaction.
7. Update search filters to read Unit/UnitRealm snapshot fields.
8. Add history-service ingestion projection from `ModerationOutbox`.
9. Remove `ContentModerationState` and old event tables once migrated.

Open question: keep old `ModerationCaseEvent` / `RealmModerationEvent` as
workflow-local timelines, or fold workflow transitions into `ModerationAction`
and delete the old event tables. The cleaner long-term model is to fold them,
but the proposal should check UI needs before deleting.

## Open Questions

- Should `reviewState = REMOVED` and `servingRestriction = TOMBSTONE` always be
  paired for hard moderator removals, or can removed content be fully hidden
  with no tombstone on non-thread surfaces?
- Should `reasonText` be internal-only while `publicMessage` is user-facing and
  localization-friendly?
- Should automation actions require `policyKey + policyVersion` and a nullable
  `actorUserId`, or should automation run through a system user Unit?
- Should moderator actions support multi-target bulk actions as one parent
  action plus child effects, or as many independent actions sharing a
  `requestId`?
- How long should main DB retain authoritative ledger rows before cold archive?
  For accountability, deletion should be rare and explicit; redaction should be
  field-level where legally required.

