---
title: Moderation Governance Model
status: draft
created: 2026-06-03
completed:
supersededBy:
tags: [governance, moderation, realm, unit, comment, audit, history]
---

## Context

Rezics needs moderation across three target families, in two authority tiers:

- **Targets**: a `Unit` (works, posts, shelves, tags, realms), a `(realm, unit)`
  relation (`UnitRealm`), and a `Comment`. Field locks and accounts are
  secondary targets.
- **Tiers**: platform-wide moderation, and container-local moderation (a realm,
  or a post's own discussion thread).

The earlier draft of this document grew a separate vocabulary for each surface:
a global 1:1 `ContentModerationState` table, a realm pair of enums
(`moderationState` + `visibilityState`), a borrowed enum on `Comment`, two
near-identical workflow tables, and three audit/event tables. It then proposed
*adding* more tables on top. That is the complexity this revision removes.

This is an exploration document, not an implementation proposal. It records the
target architecture so it can graduate into `/rezics-propose`. Because the
project is pre-production, prefer a clean cutover over compatibility adapters.

## The Core Idea

Do not unify the *content*. Unify the *moderation layer*.

The tempting move — "comments need moderation, so make `Comment` a `Unit`" — is
wrong here. Comments are high-volume micro-interactions with their own threading
machinery (`ltree path`, `depth`, denormalized reply counts). Folding them into
`Unit` would explode the `Unit` and `UnitRealm` tables and force a `Comment`
extension table anyway. "Everything is a `Unit`" is a rule for *catalog
entities*, not for comments and votes.

Instead, model moderation as three thin layers that every target shares:

```
┌─ ① Serving state  (hot read path · on the row · ONE shared enum) ───────┐
│   Unit.moderationStatus          platform tier, applies everywhere       │  "show it now? how?"
│   UnitRealm.moderationStatus     that realm's tier                        │
│   Comment.moderationStatus       the comment's single context            │
│   *.isLocked                     orthogonal: can it accept new edits?     │
└──────────────────────────────────────────────────────────────────────────┘
              ▲ same transaction: update snapshot + append ledger
┌─ ② Workflow  (ONE ModerationCase table, scope-discriminated) ────────────┐
│   ModerationCase { scope, realmUnitId?, targetKind, targetId, state }     │  "what's queued? who has it?"
└──────────────────────────────────────────────────────────────────────────┘
              │ each decision appends one row
┌─ ③ Audit ledger  (ONE append-only ModerationAction · polymorphic) ───────┐
│   ModerationAction { authority, actor, action, target,                    │  "what happened? who's accountable?"
│     resultingStatus?, resultingLocked?, reason, caseId, reversesActionId }│
└──────────────────────────────────────────────────────────────────────────┘
```

The snapshot stores only what the read path needs. The *why/who/when/history*
lives in the ledger. The *work in progress* lives in the case. These three are
genuinely different and stay separate — but each is modeled once, not per surface.

## Three Orthogonal Axes, Three Owners

A common source of confusion is conflating author intent with moderator action.
Keep three independent axes, each owned by a different actor:

```
Author lifecycle    Unit.status            DRAFT → PUBLISHED → ARCHIVED / DELETED   ← author
Author audience     Unit.visibility        PUBLIC | UNLISTED | PRIVATE              ← author
Moderation          *.moderationStatus     APPROVED | PENDING | REMOVED             ← moderator
```

`Unit.status = DELETED` is **author self-deletion** (Lemmy's `deleted`): not a
moderation event, not logged to the modlog. `moderationStatus = REMOVED` is a
**moderator takedown** (Lemmy's `removed`): logged. They coexist; never merge
them. Comments get the same split: `Comment.deletedAt` (author self-delete,
unlogged) vs `Comment.moderationStatus = REMOVED` (moderator, logged).

Public read = all three gates open: `status = PUBLISHED` **and** `visibility`
allowed-for-route **and** `moderationStatus = APPROVED`. This naturally resolves
the old naming debate (`visibility` vs `servingRestriction` vs `reviewState`):
one name per owner, no competition.

## ① Serving State

```prisma
/// The only moderation lifecycle enum. Shared by Unit, UnitRealm, Comment.
enum ModerationStatus {
  APPROVED // allowed to be served — by default in post-moderation, or by an explicit approval in pre-moderation
  PENDING  // awaiting pre-moderation review; not public yet (default where a realm requires review)
  REMOVED  // taken down by moderation
}
```

`APPROVED` is the green/servable state. It is reached two ways: by default for
author-published content (post-moderation), or by an explicit moderator approval
(pre-moderation). It is deliberately *not* `OK` — `APPROVED` matches the existing
`UnitRealmModerationState.APPROVED` vocabulary and reads unambiguously next to
`PENDING` / `REMOVED`.

The "auto-approved by default" vs "explicitly approved by a moderator"
distinction is **not** a separate enum value. It is derived at read time from
whether a `ModerationAction` exists for the target (see *Moderator overlay*):
an explicit approval has a ledger row (who / when); a default-green row has none,
so the mod UI renders an i18n "auto-approved". This is why the snapshot needs no
`AUTO_APPROVED` state and no `approvedBy` / `approvedAt` columns.

This single enum replaces all of: `ContentModerationStateKind` (4 states),
`UnitRealmModerationState` + `UnitRealmVisibilityState` (a 4×3 grid that is
mostly nonsensical), and `Comment.visibilityState`.

Why one axis instead of review × serving:

- `REJECTED` (failed pre-moderation, never public) and `REMOVED` (taken down
  after publication) are **identical to the read path** — both mean "not served".
  Their difference is audit-only, so it belongs in the ledger, not the snapshot.
- `APPROVED + HIDDEN`, `REMOVED + VISIBLE`, etc. were always contradictions.

### Rendering `REMOVED` is surface-dependent

Whether a `REMOVED` row is dropped or shown as a placeholder is a **read-time
decision, not stored state**. The deciding question is *is this content a primary
list item, or is it referenced by other content?*

```
Primary collection (feed, search, a realm's content list, a user's posts):
    excluded at query time — WHERE moderationStatus = APPROVED.
    The removed row never appears.

Referenced / embedded (a quote, an embed card, a parent comment that still has
replies, an "in reply to X"):
    the API returns a redacted stub — content stripped, only
    { id, moderationStatus: REMOVED, + minimal public label } — and the frontend
    renders an i18n "content removed" placeholder, keeping the reference and the
    surrounding structure intact.
```

The placeholder label ("removed by moderator" vs "removed by post owner") comes
from the latest `ModerationAction`, surfaced only if public. The redacted body is
**never shipped to the client**. A stored `tombstone`/silent flag is added only
if moderators must control placement per action (see Open Questions).

### Lock is orthogonal

`isLocked` (preventing new replies/edits) stays where it already lives —
`Post.isLocked`, `Comment.isLocked`, `UnitRealm.isLocked` — and is independent of
`moderationStatus`. Lock changes are logged as `LOCK`/`UNLOCK` actions.

### Where the field lives

```prisma
model Unit {
  // existing author axes, unchanged:
  status     UnitStatus     @default(DRAFT)   // DRAFT|PUBLISHED|ARCHIVED|DELETED
  visibility UnitVisibility @default(PUBLIC)  // PUBLIC|UNLISTED|PRIVATE
  // new platform-tier moderation snapshot (no separate 1:1 table, no join):
  moderationStatus ModerationStatus @default(APPROVED)
}

model UnitRealm {
  // replaces moderationState + visibilityState:
  moderationStatus ModerationStatus @default(APPROVED) // realm tier; realms that pre-moderate start new relations at PENDING
  isLocked         Boolean          @default(false)
}

model Comment {
  // replaces visibilityState (which borrowed UnitRealmVisibilityState):
  moderationStatus ModerationStatus @default(APPROVED)
  deletedAt        DateTime?        // author self-delete; NOT moderation
  isLocked         Boolean          @default(false)
}
```

Moving global state onto `Unit` (deleting the `ContentModerationState` 1:1 table)
follows the lesson that a moderation-state column on the content row reads far
faster than a join to a side table.

## ② Comments — The New Requirement

A comment is **simpler** than a unit for moderation, because it lives in exactly
one place: under one `rootUnit` (the post), optionally inside one `realmUnit`. A
unit can be in many realms (needs `Unit` + N×`UnitRealm` facets); a comment needs
exactly one `moderationStatus`.

### Who may moderate a comment (authority model)

Three authorities, in precedence order:

```
PLATFORM  platform moderators           → ANY comment, anywhere      (grant-derived: StaffGrant scope=global)
REALM     the comment's realm moderators → comments where Comment.realmUnitId = their realm
                                                                       (grant-derived: StaffGrant scope=realm)
OWNER     the post's owner / permission holder → comments under their post
                                            (Comment.rootUnit owner or a permission role on rootUnit)
```

- **PLATFORM** mods can moderate every comment (and every other target). This is
  the absolute tier.
- **OWNER** is the new capability the product requires: the owner of the post
  (`Comment.rootUnit`) curates the discussion under their own post. Authority is
  *ownership-derived*, not a `StaffGrant`.
- **REALM** mods manage comments that are realm assets, which `Comment.realmUnitId`
  already encodes (see the model comment in `schema.prisma` on `Comment`).

Platform/realm moderation typically flows through a `ModerationCase` (queue,
triage, audit). Owner moderation of one's own thread is a **direct action** —
no case needed — but still appends a `ModerationAction`.

### Precedence (one field, not two)

Recommendation: keep a **single** `Comment.moderationStatus`. "Removed is
removed" because the comment exists in only one place. Enforce tier precedence at
write time:

```
A lower authority may not reverse a higher authority's removal.
  → On RESTORE, read the latest REMOVE action's `authority` from the ledger;
    deny if actor's authority < that authority.
  → OWNER cannot un-remove a PLATFORM takedown. PLATFORM can override anything.
```

This needs no extra column (the ledger already records `authority`). The two-field
alternative (independent `platformStatus` + `localStatus`, effective = AND,
mirroring `Unit`/`UnitRealm`) is only worth it if product needs
"platform-APPROVED *and* owner-still-hidden" to coexist — deferred to Open
Questions.

### Read path

`comment.service.ts` already filters by `visibilityState`. After the cutover it
filters by `moderationStatus` (and `deletedAt IS NULL`): in a flat list it
excludes `REMOVED` (`WHERE moderationStatus = APPROVED`); in a threaded view it
returns a redacted stub for a `REMOVED` comment that still has replies, which the
frontend renders as an i18n "content removed" placeholder so the subtree stays
attached.

## ③ Workflow — One Case, Scope-Discriminated

`RealmModerationQueueItem` is today a near-duplicate of `ModerationCase` (same
`state`, `targetKind`/`targetId`, `reporter`/`subject`/`assignedTo`,
`sourceFeedback`, `reason`, `safeSummary`, `metadata`), and `ModerationCase`
already carries `realmUnitId`. Merge them into one table with a `scope`:

```prisma
model ModerationCase {
  id               String              @id @default(dbgenerated("uuidv7()")) @db.Uuid
  scope            ModerationAuthority // PLATFORM | REALM  (OWNER actions usually skip cases)
  realmUnitId      String?             @db.Uuid // set when scope = REALM
  state            ModerationCaseState
  severity         String?             @db.VarChar(32)

  targetKind       ModerationTargetKind
  targetId         String              @db.VarChar(128)
  addressedUnitId  String?             @db.Uuid // resolved Unit for joins/queues

  reporterUserId   String?             @db.Uuid
  subjectUserId    String?             @db.Uuid
  assignedToUserId String?             @db.Uuid
  sourceFeedbackId String?             @db.Uuid
  parentCaseId     String?             @db.Uuid // escalation (realm → platform) + duplicate links

  reason           String?
  safeSummary      String?
  metadata         Json?
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt
}
```

`RealmModerationQueueState` folds into `ModerationCaseState`. Escalation =
create/link a `parentCaseId` with `scope = PLATFORM` (or flip scope), instead of
copying rows between two tables.

## ③ Audit Ledger — One Table, No Before/After JSON

Replace `ModerationCaseEvent`, `RealmModerationEvent`, and the content/governance
parts of `StaffAuditLog` — **all three of which currently store `before Json?` /
`after Json?`** — with one append-only ledger that stores structured facts and
typed scalar results.

```prisma
enum ModerationTargetKind { UNIT  UNIT_REALM  COMMENT  UNIT_FIELD  ACCOUNT }
enum ModerationAuthority  { PLATFORM  REALM  OWNER }
enum ModerationActorKind  { USER  SYSTEM  AUTOMATION  IMPORT }
enum ModerationActionKind {
  APPROVE  REMOVE  RESTORE
  LOCK  UNLOCK
  FIELD_LOCK  FIELD_UNLOCK
  WARN  ESCALATE  REVERSE  NOTE   // NOTE = workflow-only entry (triage, assignment)
}

model ModerationAction {
  id          String @id @default(dbgenerated("uuidv7()")) @db.Uuid

  authority   ModerationAuthority
  realmUnitId String? @db.Uuid              // set when authority = REALM
  targetKind  ModerationTargetKind
  targetId    String  @db.VarChar(128)      // unitId | commentId | "realmUnitId:unitId" | userId
  targetPath  String? @db.VarChar(256)      // UnitFieldLock.path when targetKind = UNIT_FIELD

  actorKind   ModerationActorKind
  actorUserId String? @db.Uuid
  actionKind  ModerationActionKind

  // Typed resulting state inlined — no ModerationActionEffect child table:
  resultingStatus ModerationStatus?         // when the action changed a moderationStatus
  resultingLocked Boolean?                  // when the action changed an isLocked

  reasonCode    String  @db.VarChar(96)
  reasonText    String?                     // internal-only
  publicMessage String?                     // user-facing, localizable

  caseId           String? @db.Uuid
  reversesActionId String? @db.Uuid         // explicit reversal; never mutate old rows
  requestId        String? @db.VarChar(128) // groups one bulk action across many targets
  idempotencyKey   String  @db.VarChar(160)
  importedFrom     String? @db.VarChar(128)
  createdAt        DateTime @default(now())

  @@unique([idempotencyKey])
  @@index([targetKind, targetId, createdAt])
  @@index([realmUnitId, createdAt])
  @@index([actorUserId, createdAt])
  @@index([caseId, createdAt])
  @@index([actionKind, createdAt])
}
```

Removed from the prior draft as over-engineering:

- **`ModerationActionEffect`** (header + line-items): collapsed into inline
  `resultingStatus`/`resultingLocked`. Multi-target bulk uses `requestId`, not
  one-action-many-effects.
- **`ModerationOutbox` + history projection tables**: deferred. The ledger *is*
  the timeline — query by `(targetKind, targetId)` for a target's history, by
  `actorUserId` for a moderator's actions, by `realmUnitId` for a realm modlog.
  Add a history-service projection later *only* if a combined editorial +
  moderation view or read isolation demands it.
- **`outcomeKind`** (APPLIED/DENIED/...): the ledger records actions that
  *happened*. Denied attempts are a security-log concern, not a moderation fact.

### Why not before/after JSON

The current event/audit tables already demonstrate the problems:

- A second store of potentially sensitive content / PII / private notes, under
  weaker access assumptions than the source rows.
- Schema-hostile: every future field rename must decide whether old before/after
  JSON is still meaningful.
- Expensive and noisy; pretends to be canonical state while the snapshot row is
  the real truth.

Store actor / target / authority / action / reason / typed result instead. To
reconstruct a timeline, order actions by `(targetKind, targetId, createdAt)`. To
answer "current state", read the snapshot row.

## Field Locks & Account Enforcement

These plug into the same ledger without new history tables:

```
UnitFieldLock create/delete  → keep UnitFieldLock as current state;
                               log ModerationAction(targetKind=UNIT_FIELD,
                               targetId=unitId, targetPath=path,
                               actionKind=FIELD_LOCK|FIELD_UNLOCK)

Account / realm membership   → keep current state on RealmMember
(WARN/SILENCE/SUSPEND/BAN/    (RealmMemberState) and AccountEnforcement;
 mute/remove from realm)       log ModerationAction(targetKind=ACCOUNT,
                               targetId=userId, authority=PLATFORM|REALM)
```

(The existing `AccountEnforcementKind` / `RealmMemberState` subsystem is not
redesigned here; it simply emits to the unified ledger.)

## Reporting

Generalize `Feedback` from a unit-only target to a polymorphic one, so comments
(and accounts) can be reported:

```prisma
model Feedback {
  // replace `unitId String?` with a polymorphic address:
  targetKind      ModerationTargetKind?   // REPORT feedback only
  targetId        String?  @db.VarChar(128)
  addressedUnitId String?  @db.Uuid       // resolved Unit for joins, when applicable
  type            FeedbackType @default(REPORT) // REPORT|BUG|FEATURE|OTHER
  // ...
}
```

A comment report becomes `Feedback(targetKind = COMMENT, targetId = commentId)`,
which staff/realm mods convert into a `ModerationCase` exactly as today.

## Service Boundary

Authoritative moderation writes live in the main server/governance database, not
the history service. Snapshot update and ledger append **must commit in one
transaction** — if the row changes but the action is lost (or vice versa),
accountability breaks.

```text
package/server (main DB) owns:
    Unit.moderationStatus
    UnitRealm.moderationStatus / isLocked
    Comment.moderationStatus / deletedAt / isLocked
    Post.isLocked
    UnitFieldLock
    ModerationCase            (workflow, scope-discriminated)
    ModerationAction          (authoritative ledger)

package/history (history DB) owns:
    editorial UnitRevision / UnitRevisionPath / RevisionContent
    StructureEvent
    (moderation timeline projection: deferred; add only if a combined view needs it)
```

Editorial restore/compare stays based on `UnitRevision`. Lock and moderation
changes never enter `UnitRevision`; they are ledger actions.

## Read Path Implications

```text
Global public read:
    Unit.status = PUBLISHED
    Unit.visibility allowed for route
    Unit.moderationStatus = APPROVED
    (no join — state is on the Unit row)

Realm public feed read:
    Unit.status = PUBLISHED  AND  Unit.moderationStatus = APPROVED   (platform tier)
    UnitRealm.realmUnitId = current realm
    UnitRealm.moderationStatus = APPROVED                            (realm tier; effective = AND)

Comment read:
    deletedAt IS NULL
    flat list (user's comments, search):  WHERE moderationStatus = APPROVED   (omit REMOVED)
    threaded view:  APPROVED → render; REMOVED with replies → redacted stub → i18n placeholder

Reference / embed resolution (quote, embed card, "in reply to X"):
    REMOVED target → return a redacted stub (no body) → frontend renders i18n placeholder

Search indexing:
    Exclude Unit.moderationStatus != APPROVED from public global indexes.
    Exclude UnitRealm.moderationStatus != APPROVED from realmIds projection.
    Exclude Comment.moderationStatus != APPROVED / deletedAt from comment indexes.
```

### Moderator overlay (mod mode)

Mod mode renders, in the corner of each content card, the *latest* moderation
state for that target — read from the **ledger**, not just the snapshot:

```text
snapshot moderationStatus              → the badge        (APPROVED | PENDING | REMOVED)
latest ModerationAction for (kind, id) → the detail line  ("approved by @mod · 2d ago",
                                                            "removed by @owner · spam")
no ModerationAction exists             → render the default-state label, e.g. i18n
                                         "auto-approved" — no attribution, because nothing
                                         happened; it is the implicit default green state.
```

This is a moderator-only overlay. Batch-fetch the latest action per visible
target — `@@index([targetKind, targetId, createdAt])` makes "latest per target"
cheap (a lateral/`DISTINCT ON` over the visible id set). The public read path
never does this lookup; it reads only the snapshot column.

## What To Remove / Replace

Schema-level migration direction (`package/server/prisma/schema.prisma`):

```text
DELETE  ContentModerationState + enum ContentModerationStateKind
          → Unit.moderationStatus (backfill: VISIBLE→APPROVED, HIDDEN/TOMBSTONED/REMOVED→REMOVED)

REPLACE UnitRealm.moderationState (enum UnitRealmModerationState)
        + UnitRealm.visibilityState (enum UnitRealmVisibilityState)
          → UnitRealm.moderationStatus : ModerationStatus
            (APPROVED→APPROVED, PENDING_REVIEW→PENDING, REJECTED/REMOVED→REMOVED,
             visibilityState HIDDEN/TOMBSTONED→REMOVED)

REPLACE Comment.visibilityState (borrowed UnitRealmVisibilityState)
          → Comment.moderationStatus : ModerationStatus  + add Comment.deletedAt

MERGE   RealmModerationQueueItem (+ enum RealmModerationQueueState)
          → ModerationCase (+ scope : ModerationAuthority); drop the separate table/enum

DELETE  ModerationCaseEvent, RealmModerationEvent      (before/after JSON event tables)
          → ModerationAction

REPLACE StaffAuditLog content/governance entries        (before/after JSON)
          → ModerationAction
          (open question: keep a slim non-moderation staff audit, or broaden ledger)

KEEP    UnitFieldLock, Post.isLocked, AccountEnforcement/RealmMember state
          → changes logged via ModerationAction

ADD     enum ModerationStatus, ModerationTargetKind, ModerationAuthority,
        ModerationActorKind, ModerationActionKind
        model ModerationAction
        Unit.moderationStatus
        Feedback polymorphic target (targetKind/targetId/addressedUnitId)
```

## Migration Order

1. Add shared enums + `Unit.moderationStatus`, `UnitRealm.moderationStatus`,
   `Comment.moderationStatus`, `Comment.deletedAt`.
2. Add `ModerationAction`; add `scope`/`parentCaseId` to `ModerationCase`;
   make `targetKind` an enum; add `Feedback` polymorphic target.
3. Backfill snapshots from `ContentModerationState`, `UnitRealm` enums,
   `Comment.visibilityState` per the mapping above.
4. Best-effort import `ModerationCaseEvent` / `RealmModerationEvent` /
   `StaffAuditLog` rows into `ModerationAction` (`importedFrom` set; drop
   before/after blobs, keep structured facts).
5. Migrate `RealmModerationQueueItem` rows into `ModerationCase` with `scope=REALM`.
6. Switch governance writes to "update snapshot + append ledger" in one tx;
   add the comment authority checks (PLATFORM / REALM / OWNER + precedence).
7. Update search + read filters to the single `moderationStatus`.
8. Drop `ContentModerationState`, the two event tables, the realm queue table,
   and the old enums.

## Open Questions

- **Silent hide vs placeholder**: is `REMOVED` + render-by-surface enough, or do
  moderators need to choose per action whether a placeholder is left even on
  referenced surfaces? If yes, add one `tombstone Boolean` (not a second enum axis).
- **Comment precedence**: single `moderationStatus` + ledger-enforced precedence
  (recommended) vs two independent layers (`platformStatus` + `localStatus`,
  effective = AND). Do we ever need "platform allows it, owner still hides it"?
- **Owner authority scope**: is "post owner" exactly `Comment.rootUnit.userId`, or
  any holder of a permission role on the root unit? (Authz detail for the service.)
- **StaffAuditLog fate**: does it log non-moderation staff actions (grant changes,
  billing, roles)? If so, keep a slim security/staff audit and fold only
  moderation into `ModerationAction`; if not, replace it entirely.
- **Retention**: how long does the main DB keep ledger rows before cold archive?
  Deletion should be rare and explicit; redaction field-level where legally required.

## Sources

- Reddit "everything is a Thing" two-table model: https://kevin.burke.dev/kevin/reddits-database-has-two-tables/
- Lemmy moderation (deleted vs removed; modlog): https://join-lemmy.org/docs/users/04-moderation.html
- Lemmy modlog API type: https://join-lemmy.org/lemmy-js-client-docs/main/types/GetModlog.html
- Drupal: moderation-state-on-row vs side-table performance: https://www.drupal.org/project/drupal/issues/3097303
- EnterpriseReady audit log (actor/action/target): https://www.enterpriseready.io/features/audit-log/
- Reddit Moderation Queue: https://support.reddithelp.com/hc/en-us/articles/15484440494356-Moderation-Queue
- Discourse Moderation Guide: https://meta.discourse.org/t/discourse-moderation-guide/63116
- Mastodon moderation actions: https://docs.joinmastodon.org/admin/moderation/
- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- GitLab audit event schema: https://docs.gitlab.com/user/compliance/audit_event_schema/
