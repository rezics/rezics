---
title: Moderation Governance Redesign
status: active
created: 2026-06-03
completed:
supersededBy:
tags: [governance, moderation, realm, unit, comment, contract, app, search]
---

## Why

Moderation is currently spread across mismatched shapes: a global 1:1
`ContentModerationState` table, a realm pair of enums (`UnitRealm.moderationState`
+ `visibilityState`), a borrowed enum on `Comment.visibilityState`, two
near-identical workflow tables (`ModerationCase` + `RealmModerationQueueItem`),
and three audit/event trails (`ModerationCaseEvent`, `RealmModerationEvent`,
`StaffAuditLog`) that each dump `before`/`after` JSON. Comments cannot be
moderated through governance at all (no service path, no audit, no authority
model).

This collapses it into three thin layers shared by every target (the design is
fully argued in `plan/exploration/moderation-governance-model.md`):

1. **Serving state** — one `ModerationStatus { APPROVED | PENDING | REMOVED }`
   inlined on `Unit`, `UnitRealm`, and `Comment`.
2. **Workflow** — one `ModerationCase` with a `scope` discriminator (PLATFORM |
   REALM), replacing the realm queue.
3. **Audit ledger** — one append-only `ModerationAction` (polymorphic target,
   typed resulting state, no before/after JSON), replacing all three event tables.

New capability: **comment moderation** with three authorities
(PLATFORM / REALM / OWNER) and precedence. `REMOVED` content is omitted from
primary lists but rendered as a redacted i18n placeholder where it is referenced.
Mod mode reads the *latest* ledger action per card; absence of an action renders
"auto-approved".

Pre-production: **clean cutover, no compatibility adapters.** A dev DB
reset + reseed is acceptable; a backfill script is optional.

## Durable constraints & decisions

- **One serving enum, three states.** `ModerationStatus = APPROVED | PENDING |
  REMOVED`. No `AUTO_APPROVED`, no separate serving/visibility axis, no
  `approvedBy`/`approvedAt` snapshot columns — "auto vs explicit approval" is
  derived from ledger presence. `(type)`
- **Three orthogonal axes, three owners.** `Unit.status` (author lifecycle,
  incl. `DELETED`), `Unit.visibility` (author audience), `*.moderationStatus`
  (moderator). `status=DELETED`/`Comment.deletedAt` is author self-delete and is
  **never** logged to the ledger; `moderationStatus=REMOVED` is a moderator
  action and **always** is. Never conflate them. `(comment)` `(test)`
- **Snapshot ↔ ledger atomicity.** Any write that changes a `moderationStatus`
  or `isLocked` MUST update the snapshot row and append exactly one
  `ModerationAction` in the **same transaction**. `(comment)` `(test)`
- **Ledger stores facts, not snapshots.** No `before`/`after` JSON anywhere.
  `ModerationAction` carries typed `resultingStatus`/`resultingLocked` only.
  Timeline = order by `(targetKind, targetId, createdAt)`. `(comment)`
- **`idempotencyKey` is unique** on `ModerationAction`; re-applying the same
  decision is a no-op append. `(type)` `(test)`
- **Comment authority + precedence.** Authority to moderate a comment:
  PLATFORM (global capability) → any; REALM (realm capability where
  `Comment.realmUnitId` = grantee's realm) → that realm's comments; OWNER
  (`Comment.rootUnit.userId` or a permission role on the root unit) → comments
  under their post. A lower authority MUST NOT reverse a higher authority's
  removal (on RESTORE, compare against the latest REMOVE action's `authority`).
  PLATFORM overrides all. `(comment)` `(test)`
- **Owner moderation skips the case** (direct action) but still appends a
  `ModerationAction(authority=OWNER)`. `(comment)`
- **`REMOVED` rendering is surface-dependent and never ships the body.** Primary
  collections (feed/search/realm list/user posts) exclude `REMOVED` at query
  time (`WHERE moderationStatus = APPROVED`). Referenced/embedded surfaces
  (quote, embed, parent comment with replies, "in reply to") receive a **redacted
  stub** — `{ id, moderationStatus: REMOVED, public label }`, no content — which
  the frontend renders as an i18n placeholder. Author-deleted (`deletedAt`) uses
  the same placeholder path with a different label. `(comment)` `(test)`
- **Mod overlay reads the ledger; public reads do not.** Public read path reads
  only the snapshot column (no join). Mod mode batch-fetches latest action per
  visible target via `@@index([targetKind, targetId, createdAt])`; no action ⇒
  render default-state label (e.g. "auto-approved"). `(comment)` `(test)`
- **One case, scope-discriminated.** `ModerationCase.scope ∈ {PLATFORM, REALM}`;
  realm escalation links `parentCaseId` with `scope=PLATFORM`. `RealmModeration
  QueueItem` and its state enum are deleted. `(type)`
- **Contract enums are lowercase string unions** mirroring Prisma UPPERCASE via
  the existing `lower()` mapper convention; keep that pattern for the new enums.

## 0. Schema foundation (`package/server/prisma/schema.prisma`)

- [ ] 0.1 Add enums: `ModerationStatus { APPROVED PENDING REMOVED }`,
  `ModerationTargetKind { UNIT UNIT_REALM COMMENT UNIT_FIELD ACCOUNT }`,
  `ModerationAuthority { PLATFORM REALM OWNER }`,
  `ModerationActorKind { USER SYSTEM AUTOMATION IMPORT }`,
  `ModerationActionKind { APPROVE REMOVE RESTORE LOCK UNLOCK FIELD_LOCK FIELD_UNLOCK WARN ESCALATE REVERSE NOTE }`.
- [ ] 0.2 Add `Unit.moderationStatus ModerationStatus @default(APPROVED)`.
- [ ] 0.3 `UnitRealm`: drop `moderationState`/`visibilityState`; add
  `moderationStatus ModerationStatus @default(APPROVED)`. Update `@@index`es that
  referenced the old columns.
- [ ] 0.4 `Comment`: drop `visibilityState`; add
  `moderationStatus ModerationStatus @default(APPROVED)` + `deletedAt DateTime?`.
  Replace the `@@index([visibilityState])` with `@@index([moderationStatus])`.
- [ ] 0.5 Add model `ModerationAction` per the exploration doc (authority,
  realmUnitId?, targetKind, targetId, targetPath?, actorKind, actorUserId?,
  actionKind, resultingStatus?, resultingLocked?, reasonCode, reasonText?,
  publicMessage?, caseId?, reversesActionId?, requestId?, idempotencyKey unique,
  importedFrom?, createdAt; indexes on `[targetKind,targetId,createdAt]`,
  `[realmUnitId,createdAt]`, `[actorUserId,createdAt]`, `[caseId,createdAt]`,
  `[actionKind,createdAt]`).
- [ ] 0.6 `ModerationCase`: add `scope ModerationAuthority` + `parentCaseId String?`;
  change `targetKind` to `ModerationTargetKind`; keep `realmUnitId`. Fold
  `RealmModerationQueueState` values into `ModerationCaseState` (add `REVIEWING`
  if needed). Drop the `contentStates`/`events`/`realmQueueItems` relations that
  point at removed models.
- [ ] 0.7 `Feedback`: drop `unitId`; add polymorphic
  `targetKind ModerationTargetKind?` + `targetId String?` + `addressedUnitId String?`.
- [ ] 0.8 Delete models `ContentModerationState`, `ModerationCaseEvent`,
  `RealmModerationEvent`, `RealmModerationQueueItem`; delete enums
  `ContentModerationStateKind`, `UnitRealmModerationState`,
  `UnitRealmVisibilityState`, `RealmModerationQueueState`. Remove their back-relations
  on `Unit`/`User`/`Realm`/`Feedback`.
- [ ] 0.9 `StaffAuditLog`: grep all callers; move content/governance-moderation
  writes to `ModerationAction`. If no non-moderation callers remain, delete the
  model + `mapStaffAuditLogToDTO`; otherwise strip `before`/`after` columns and
  keep it for non-moderation privileged ops only. Record the decision in the apply
  commit.
- [ ] 0.10 `bun --filter=@rezics/server run prisma:generate` then
  `prisma:migrate` (dev reset acceptable).

## 1. Backend write path & ledger (`package/server/src/governance/`)

- [ ] 1.1 Add a ledger helper (new `moderation-action.service.ts` or a method on
  `GovernanceModerationService`): `appendModerationAction(tx, {...})` that writes
  one row; expose `latestActionFor(targetKind, targetId)` and
  `latestActionsFor(targetKind, ids[])` (DISTINCT ON `(targetId) … ORDER BY
  createdAt DESC`).
- [ ] 1.2 Rework global content setters in `moderation.service.ts`: replace
  `setGlobalContentState`/`hideGlobal`/`tombstoneGlobal`/`restoreGlobal` with
  `setUnitModerationStatus({ unitId, actorUserId, action: APPROVE|REMOVE|RESTORE,
  reasonCode, ... })` writing `Unit.moderationStatus` + ledger in one tx. Delete
  `getGlobalContentState`/`listGlobalContentStates` (read snapshot via Unit).
- [ ] 1.3 Rework realm setters: replace `setRealmUnitVisibilityState`/`hideInRealm`/
  `tombstoneInRealm`/`restoreInRealm`/`setRealmUnitModerationState`/`approveInRealm`/
  `rejectInRealm`/`removeFromRealm` with `setRealmUnitModerationStatus({ realmUnitId,
  unitId, action, ... })` writing `UnitRealm.moderationStatus` + ledger (authority=REALM).
- [ ] 1.4 Add lock actions: `setLock({ targetKind, targetId, isLocked, ... })`
  writing `Post.isLocked`/`Comment.isLocked`/`UnitRealm.isLocked` + LOCK/UNLOCK ledger.
- [ ] 1.5 Merge realm queue into cases: fold `createRealmQueueItem*`,
  `decideRealmQueueItem`, `escalateRealmQueueItem`, `listRealmQueue*` into the case
  methods with `scope=REALM`; escalation sets `parentCaseId` + `scope=PLATFORM`.
  Update `decideCase`/`triageCase`/`assignCase` to append `ModerationAction`
  (NOTE for pure workflow, typed action otherwise) instead of `ModerationCaseEvent`.
- [ ] 1.6 Replace `governanceAuditService.append*` calls for content/realm decisions
  with `appendModerationAction`. Keep `audit.service.ts` only for any surviving
  non-moderation privileged ops (per 0.9).
- [ ] 1.7 Update `governance.mapper.ts`: remove `mapContentModerationStateToDTO`,
  `mapModerationCaseEventToDTO`, `mapRealmQueueItemToDTO`, `mapRealmModerationEventToDTO`;
  add `mapModerationActionToDTO`; update `mapModerationCaseToDTO` for `scope`/`parentCaseId`.
  Update `types.ts` row aliases accordingly.
- [ ] 1.8 Update `governance.api.ts`: collapse `/content/.../hide|tombstone` and
  realm `hide|tombstone|reject` into `approve|remove|restore`; replace `/realm-queue`
  + `/realms/:id/queue*` routes with scoped `/cases` routes; add
  `GET /moderation/:targetKind/:targetId/actions` (ledger timeline) and a batch
  `POST /moderation/overlays` (latest action per target). Keep `assertGovernancePolicy`/
  `assertStaff` gating.

## 2. Comment moderation (`package/server/src/comment/` + governance)

- [ ] 2.1 `comment.service.ts` read filter: change `visibilityState: { in:
  ["VISIBLE","TOMBSTONED"] }` to status-aware logic — flat/list modes
  `WHERE moderationStatus = APPROVED AND deletedAt IS NULL`; threaded/subtree modes
  keep a `REMOVED`/`deletedAt` row **only if it has replies** and return it as a
  redacted stub.
- [ ] 2.2 `comment.service.ts` `create`: default `moderationStatus = APPROVED`
  (or `PENDING` when the realm pre-moderates — gate on a realm setting if present,
  else always APPROVED).
- [ ] 2.3 `comment.service.ts` `delete`: set `deletedAt = now()` (author self-delete)
  instead of `visibilityState=TOMBSTONED`; clear `content` to `Prisma.JsonNull`.
  Keep author-only ownership check.
- [ ] 2.4 Add `resolveCommentModerationAuthority(identity, comment)` →
  `PLATFORM | REALM | OWNER | null`: PLATFORM from `capability.service`
  (global moderation capability), REALM when `comment.realmUnitId` matches a realm
  capability/membership-mod, OWNER when `comment.rootUnit.userId === identity.userId`
  or a permission role on the root unit. `(test)`
- [ ] 2.5 Add `moderateComment({ commentId, actorUserId, action: REMOVE|RESTORE|
  LOCK|UNLOCK, reasonCode, ... })` on `GovernanceModerationService`: resolve
  authority, enforce precedence (RESTORE denied if actor authority < latest REMOVE
  authority), write `Comment.moderationStatus`/`isLocked` + ledger
  (targetKind=COMMENT) in one tx; enqueue comment search sync. `(test)`
- [ ] 2.6 `comment.mapper.ts`: map `moderationStatus`; for `REMOVED`/`deletedAt`
  emit a redacted stub (no `content`) with a public label + `removedBy` authority;
  drop `isTombstone` (or derive from `moderationStatus===REMOVED`).
- [ ] 2.7 `comment.api.ts`: add `POST /:id/moderation` (requireLogin) →
  `moderateComment`; ensure list/get apply the new filter. Mount stays in `index.ts`.

## 3. Contract (`package/contract/src/`)

- [ ] 3.1 `realm/governance.ts`: add `moderationStatusSchema` (approved|pending|
  removed), `moderationAuthoritySchema`, `moderationTargetKindSchema`,
  `moderationActionKindSchema`, `ModerationActionDTO`, and a `ModerationOverlayDTO`
  ({ moderationStatus, latestAction? }). Update `ModerationCaseDTO` for
  `scope`/`parentCaseId`. Remove `ContentModerationStateDTO`,
  `ContentModerationStateKind`, `ModerationCaseEventDTO`,
  `RealmModerationQueueItemDTO`, `RealmModerationQueueStateSchema`,
  `RealmModerationDecisionKindSchema`, `RealmModerationEventDTO`,
  `StaffAuditLogDTO` (unless 0.9 keeps a slim one).
- [ ] 3.2 `realm/publication.ts`: remove `UnitRealmModerationState` +
  `UnitRealmVisibilityState`; add `moderationStatus` to the realm unit DTO.
- [ ] 3.3 `comment/comment.ts`: `CommentDTO` → add `moderationStatus`, optional
  `removedReason`/`removedByAuthority` public label; `content` optional when removed;
  drop `isTombstone` and the deprecated `unitId`. Add a `CommentModerationInput`.

## 4. Read paths & search

- [ ] 4.1 Grep every read query that filtered on the old enums
  (`moderationState`, `visibilityState`, `ContentModerationState`) across
  `package/server/src` (unit, post, realm feed, search) and switch to
  `moderationStatus = APPROVED` (+ `Unit.moderationStatus = APPROVED` for the
  platform tier in realm feeds).
- [ ] 4.2 Meilisearch sync (`meili.service.ts` + `enqueueModeratedContentSearch`/
  `enqueueRealmMembershipSearch`/`enqueueCommentSync`): exclude
  `moderationStatus != APPROVED` (and `deletedAt`) from indexed documents and from
  the `realmIds` projection.
- [ ] 4.3 Implement the batch overlay read behind `POST /moderation/overlays`
  (1.8 / 1.1): given visible `(targetKind, ids)`, return `{ id, moderationStatus,
  latestAction|null }`. Used only by mod mode.

## 5. Frontend (`package/api` + `package/app` + `package/i18n`)

- [ ] 5.1 `@rezics/api/governance/*`: replace `hide/tombstone/approve/reject/remove/
  restore` content mutations with `approve/remove/restore` + `moderateComment` +
  `setLock`; update `governance.queries.ts` for `ModerationActionDTO`/timeline;
  repoint `post.api.ts getModerationOverlays` to the new `ModerationOverlayDTO`.
- [ ] 5.2 `app/src/post/components/item/PostCard.tsx`: render the
  `moderationStatus` badge (APPROVED/PENDING/REMOVED) from the snapshot; in mod
  mode render a latest-action detail line from the overlay (`removed by @x · reason`),
  falling back to i18n "auto-approved" when `latestAction` is null. Remove the
  `realmVisibilityState` rendering.
- [ ] 5.3 `app/src/realm/components/RealmContentModerationActions.tsx`: collapse the
  menu to Approve / Remove / Restore / Lock (drop Hide + Tombstone); i18n-ize all
  labels; drive visibility of actions off `moderationStatus`.
- [ ] 5.4 New `RemovedContentPlaceholder` component (shared, e.g. under
  `app/src/components/`): renders the redacted-stub i18n placeholder for
  referenced `REMOVED`/`deletedAt` content (distinct labels for moderator-removed
  vs author-deleted). Wire references/embeds/threaded parents to it; ensure
  primary feeds omit instead.
- [ ] 5.5 Comment moderation UI: render `RemovedContentPlaceholder` for removed
  comments in threads; add a gated Remove/Restore control for users with authority
  (owner of the post / realm mod / platform mod). (If no comment feature exists
  under `app/src`, add the minimal moderation affordance where comments render.)
- [ ] 5.6 `package/i18n/locales/en/`: add moderation keys (new `moderation.json`
  or extend `community.json`): status labels, action labels,
  `content_removed_by_moderator`, `content_deleted_by_author`, `auto_approved`,
  decision reason prefix.
- [ ] 5.7 Staff pages (`app/src/staff/`): point `StaffCaseDetailPage`/`StaffAuditPage`
  at the `ModerationAction` timeline (ledger) instead of case/realm events.

## 6. Migration, tests & cleanup

- [ ] 6.1 Dev cutover: migrate (reset) + `bun --filter=@rezics/server run
  seed:factory`. Optional best-effort backfill script (snapshot from old enums;
  import old events into `ModerationAction` with `importedFrom`) only if preserving
  dev data; otherwise skip.
- [ ] 6.2 `knip` + grep to remove all dead references to deleted models/enums/DTOs/
  mutations/components across server, contract, api, app.
- [ ] 6.3 Tests: rewrite `moderation.service.test.ts`, `governance.api.test.ts`,
  comment tests; add tests for comment authority + precedence (2.4/2.5),
  snapshot↔ledger atomicity (1.x), `REMOVED` redaction never shipping body (2.6/4),
  list/feed/search exclusion (4.1/4.2), mod overlay auto-approved vs latest action
  (4.3/5.2), idempotency (1.1). `(test)`
- [ ] 6.4 `bun run format` · `bun run check:convention` · `bun run check:tokens` ·
  `bun run knip` · `bun test` green.

## Out of scope

- Redesigning the `AccountEnforcement` / `RealmMember` / `StaffGrant` subsystems —
  they only emit to the unified ledger (`targetKind=ACCOUNT`); no schema change here.
- History-service moderation-timeline projection (`ModerationOutbox` + projected
  tables) — deferred; the ledger is queried in place.
- Per-action stored `tombstone`/silent flag — default is render-by-surface; add
  only if product needs moderators to choose placement (exploration Open Question).
- Two-layer comment state (`platformStatus` + `localStatus`) — default is a single
  field + ledger precedence (exploration Open Question).
- Cryptographic tamper-evidence / hash-chaining of the ledger.
- Building a full standalone comment feature UI beyond the moderation affordances.
