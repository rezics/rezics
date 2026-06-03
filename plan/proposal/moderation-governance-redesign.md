---
title: Moderation Governance Redesign
status: active
created: 2026-06-03
completed:
supersededBy:
tags: [governance, moderation, realm, unit, comment, feedback, contract, app, admin, search]
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
2. **Workflow** — one `ModerationCase` with a `ModerationScope` discriminator
   (PLATFORM | REALM), replacing the realm queue.
3. **Audit ledger** — one append-only `ModerationAction` (polymorphic target,
   typed resulting state, no before/after JSON), replacing moderation event
   trails. `StaffAuditLog` remains only as a slim log for non-moderation
   privileged ops.

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
- **Ledger stores facts, not snapshots.** No `before`/`after` JSON on moderation
  actions. `ModerationAction` carries typed `resultingStatus`/`resultingLocked`
  only. Latest action/timeline ordering is deterministic:
  `ORDER BY createdAt DESC, id DESC`. `(comment)` `(test)`
- **`idempotencyKey` is request-scoped and unique.** A duplicate request returns
  the existing action and does not append. The key MUST NOT be semantic
  `target+action`, because repeated remove/restore cycles are valid moderation
  facts. Prefer an explicit client/server request id, falling back to a derived
  key from request id + target + action attempt. `(type)` `(test)`
- **Comment authority + precedence.** Authority to moderate a comment:
  PLATFORM (global capability) → any; REALM (realm capability where
  `Comment.realmUnitId` = grantee's realm) → that realm's comments; OWNER
  (`Comment.rootUnit.userId` or root-unit collaborator `owner`/`maintainer`) →
  comments under their post. `editor` is not sufficient by default. A lower
  authority MUST NOT reverse a higher authority's removal. On RESTORE, compare
  against the latest effective REMOVE action (a REMOVE not already reversed by a
  later RESTORE), inside the same transaction/lock used to update the snapshot.
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
- **Redacted stubs are inert.** A removed/deleted comment stub MUST NOT expose
  author identity, markdown body, poll embed, reactions, reply controls, or other
  engagement affordances unless a route explicitly opts into staff-only detail.
  `(test)`
- **Mod overlay reads the ledger; public reads do not.** Public read path reads
  only the snapshot column (no join). Mod mode batch-fetches latest action per
  visible target via `@@index([targetKind, targetId, createdAt, id])`; no action
  ⇒ render default-state label (e.g. "auto-approved"). `(comment)` `(test)`
- **Case scope is not authority.** `ModerationCase.scope` uses
  `ModerationScope { PLATFORM, REALM }`. `ModerationAuthority` remains
  `{ PLATFORM, REALM, OWNER }` for action authorship/precedence. Owner actions
  skip cases. `(type)` `(test)`
- **One case, scope-discriminated.** `ModerationCase.scope ∈ {PLATFORM, REALM}`;
  realm escalation creates a `scope=PLATFORM` case and links the realm case to it
  via `parentCaseId`. `RealmModerationQueueItem` and its state enum are deleted.
  `(type)`
- **Target/action vocabulary is closed and complete.** Prisma target/action
  enums must cover all migrated moderation facts, including `FEEDBACK` targets
  and account/realm-member enforcement actions. Legacy string targets
  (`realm-unit-submission`, `realm-content-owner-delegation`, etc.) must either
  map to a typed target or be explicitly preserved as imported legacy metadata.
  `(type)` `(test)`
- **Public eligibility helper is canonical.** `publicUnitEligibilityWhere` and
  every equivalent server/search helper MUST gate on `Unit.moderationStatus =
  APPROVED` in addition to author lifecycle/audience rules. `(test)`
- **Search is a first-class migration surface.** `package/search` must move from
  old state tables/enums to `moderationStatus`, exclude removed/deleted content,
  and update comment/feedback schemas in the same cutover. `(test)`
- **`StaffAuditLog` is retained slim.** It is not a moderation ledger. Keep it
  for non-moderation privileged admin/editorial ops only, strip `before`/`after`,
  and update dashboards/routes that currently read staff audit rows. `(type)`
- **Contract enums are lowercase string unions** mirroring Prisma UPPERCASE via
  the existing `lower()` mapper convention; keep that pattern for the new enums.

## 0. Schema foundation (`package/server/prisma/schema.prisma`)

- [x] 0.1 Add enums: `ModerationStatus { APPROVED PENDING REMOVED }`,
  `ModerationScope { PLATFORM REALM }`,
  `ModerationTargetKind { UNIT UNIT_REALM COMMENT UNIT_FIELD ACCOUNT REALM_MEMBER FEEDBACK }`,
  `ModerationAuthority { PLATFORM REALM OWNER }`,
  `ModerationActorKind { USER SYSTEM AUTOMATION IMPORT }`,
  `ModerationActionKind { APPROVE REMOVE RESTORE LOCK UNLOCK FIELD_LOCK FIELD_UNLOCK WARNING SILENCE SUSPENSION BAN RATE_LIMIT TRUST_RESTRICTION REVOKE_ENFORCEMENT MUTE_MEMBER REMOVE_MEMBER BAN_MEMBER RESTORE_MEMBER ESCALATE REVERSE NOTE }`.
- [x] 0.2 Add `Unit.moderationStatus ModerationStatus @default(APPROVED)`.
- [x] 0.3 `UnitRealm`: drop `moderationState`/`visibilityState`; add
  `moderationStatus ModerationStatus @default(APPROVED)`. Update `@@index`es that
  referenced the old columns.
- [x] 0.4 `Comment`: drop `visibilityState`; add
  `moderationStatus ModerationStatus @default(APPROVED)` + `deletedAt DateTime?`.
  Replace the `@@index([visibilityState])` with `@@index([moderationStatus])`.
- [x] 0.5 Add model `ModerationAction` per the exploration doc (authority,
  realmUnitId?, targetKind, targetId, targetPath?, actorKind, actorUserId?,
  actionKind, resultingStatus?, resultingLocked?, reasonCode, reasonText?,
  publicMessage?, caseId?, reversesActionId?, requestId?, idempotencyKey unique,
  importedFrom?, createdAt; indexes on `[targetKind,targetId,createdAt,id]`,
  `[targetKind,targetId,actionKind,createdAt,id]`, `[realmUnitId,createdAt,id]`,
  `[actorUserId,createdAt,id]`, `[caseId,createdAt,id]`,
  `[actionKind,createdAt,id]`). Add a self-relation for `reversesActionId`.
- [x] 0.6 `ModerationCase`: add `scope ModerationScope` + `parentCaseId String?`;
  change `targetKind` to `ModerationTargetKind`; keep `realmUnitId`. Fold
  `RealmModerationQueueState` values into `ModerationCaseState` (add `REVIEWING`
  if needed). Keep `duplicateOfCaseId` for duplicate resolution; use
  `parentCaseId` only for escalation. Drop the `contentStates`/`events`/
  `realmQueueItems` relations that point at removed models. Map old string
  targets (`content`, `realm-unit-submission`, `realm-content`,
  `content-owner-delegation`, `realm-content-owner-delegation`) to the new enum
  or imported legacy metadata during the cutover.
- [x] 0.7 `Feedback`: replace unit-only addressing with polymorphic
  `targetKind ModerationTargetKind?` + `targetId String?` + `addressedUnitId String?`.
  Either delete `unitId` in the clean cutover or keep it only as a deprecated
  generated/compat field that mirrors `addressedUnitId`; do not keep two
  independent sources of truth. Add indexes for `[targetKind, targetId]` and
  `[addressedUnitId]`.
- [x] 0.8 Delete models `ContentModerationState`, `ModerationCaseEvent`,
  `RealmModerationEvent`, `RealmModerationQueueItem`; delete enums
  `ContentModerationStateKind`, `UnitRealmModerationState`,
  `UnitRealmVisibilityState`, `RealmModerationQueueState`. Remove their back-relations
  on `Unit`/`User`/`Realm`/`Feedback`.
- [x] 0.9 `StaffAuditLog`: keep the model for non-moderation privileged ops
  (`admin-account`, `admin-repair-job`, collaborative metadata, realm rules/lists,
  etc.), but strip `before`/`after` and stop writing content/governance/account
  enforcement facts to it. Update its DTO/mapper/routes to the slim shape.
- [x] 0.10 `AccountEnforcement`: keep the enforcement state table, but stop
  linking it to `StaffAuditLog`. Replace `auditLogId` with optional ledger links
  (`decisionActionId`, `revocationActionId` or equivalent) if a durable
  relation is useful; otherwise rely on `ModerationAction.targetKind=ACCOUNT`
  + `targetId`. Enforcement apply/revoke must append ledger rows.
- [x] 0.11 Add/repair back-relations on `Unit`/`User` for `ModerationAction`,
  `ModerationCase.parentCase`, feedback target fields, and any kept slim
  `StaffAuditLog` relations. Update seed delete/reset order for the new ledger
  and removed tables.
- [ ] 0.12 `bun --filter=@rezics/server run prisma:generate` then
  `prisma:migrate` (dev reset acceptable).

## 1. Backend write path, policy & ledger (`package/server/src/`)

- [x] 1.1 Add a ledger helper (new `governance/moderation-action.service.ts` or a
  focused method on `GovernanceModerationService`): `appendModerationAction(tx,
  {...})` writes one row inside the caller transaction; duplicate
  `idempotencyKey` returns the existing row. Expose `latestActionFor` and
  `latestActionsFor(targetKind, ids[])` using deterministic ordering
  `createdAt DESC, id DESC`. Expose `latestEffectiveRemoveFor` for RESTORE
  precedence (`REMOVE` not already reversed by a later RESTORE). `(test)`
- [x] 1.2 Centralize moderation target/action validation: every action kind must
  declare allowed targets, resulting snapshot field(s), and whether it may carry
  `resultingStatus`/`resultingLocked`. Legacy imported target strings are mapped
  in one place rather than scattered string switches. `(test)`
- [x] 1.3 Update policy/capability resolution: platform capabilities cover global
  unit/comment/account actions; realm roles/capability grants cover realm-scoped
  content/comment actions; owner authority covers only root-unit owner or
  collaborator `owner`/`maintainer`. Add explicit capability keys for any new
  comment, account enforcement, and realm member moderation actions. `(test)`
- [x] 1.4 Update canonical public eligibility helpers:
  `publicUnitEligibilityWhere`, `isPublicEligibleUnit`, and equivalent read-path
  helpers must require `Unit.moderationStatus = APPROVED` in addition to
  `status=PUBLISHED` and `visibility=PUBLIC`. `(test)`
- [x] 1.5 Rework global content setters in `governance/moderation.service.ts`:
  replace `setGlobalContentState`/`hideGlobal`/`tombstoneGlobal`/`restoreGlobal`
  with `setUnitModerationStatus({ unitId, actorUserId, action:
  APPROVE|REMOVE|RESTORE, reasonCode, ... })` writing `Unit.moderationStatus` +
  ledger in one tx. Delete `getGlobalContentState`/`listGlobalContentStates`
  (read snapshot via Unit).
- [x] 1.6 Rework realm setters: replace `setRealmUnitVisibilityState`/
  `hideInRealm`/`tombstoneInRealm`/`restoreInRealm`/
  `setRealmUnitModerationState`/`approveInRealm`/`rejectInRealm`/
  `removeFromRealm` with `setRealmUnitModerationStatus({ realmUnitId, unitId,
  action, ... })` writing `UnitRealm.moderationStatus` + ledger
  (`authority=REALM`) in one tx.
- [x] 1.7 Add lock actions: `setLock({ targetKind, targetId, isLocked, ... })`
  writing `Post.isLocked`/`Comment.isLocked`/`UnitRealm.isLocked` + LOCK/UNLOCK
  ledger in one tx.
- [ ] 1.8 Merge realm queue into cases: fold `createRealmQueueItem*`,
  `decideRealmQueueItem`, `escalateRealmQueueItem`, `listRealmQueue*` into case
  methods with `scope=REALM`; escalation creates/links a platform case through
  `parentCaseId`. Update `decideCase`/`triageCase`/`assignCase` to append
  `ModerationAction` (NOTE for pure workflow, typed action otherwise) instead of
  `ModerationCaseEvent`.
- [x] 1.9 Update account enforcement and realm member moderation flows:
  `governance/enforcement.service.ts` and any realm member mute/remove/ban/restore
  service must append `ModerationAction` rows (`targetKind=ACCOUNT` or
  `REALM_MEMBER`) for apply/revoke/restore. Keep their state tables for active
  enforcement/membership state; do not write these facts to `StaffAuditLog`.
- [x] 1.10 Keep `governance/audit.service.ts` only for slim non-moderation
  privileged logs. Update callers in `admin-account`, `admin-repair-job`,
  `unit/collaborative-metadata.ts`, `realm/realm.service.ts`, and stats/admin
  routes to the slim DTO shape.
- [x] 1.11 Update `governance.mapper.ts`: remove
  `mapContentModerationStateToDTO`, `mapModerationCaseEventToDTO`,
  `mapRealmQueueItemToDTO`, `mapRealmModerationEventToDTO`; add
  `mapModerationActionToDTO`; update `mapModerationCaseToDTO` for
  `scope`/`parentCaseId`. Keep/update `mapStaffAuditLogToDTO` only if 0.9 keeps
  the slim log. Update `types.ts` row aliases accordingly.
- [ ] 1.12 Update `governance.api.ts`: collapse `/content/.../hide|tombstone` and
  realm `hide|tombstone|reject` into `approve|remove|restore`; replace
  `/realm-queue` + `/realms/:id/queue*` routes with scoped `/cases` routes; add
  `GET /moderation/:targetKind/:targetId/actions` (ledger timeline) and a batch
  `POST /moderation/overlays` (latest action per visible target). Keep
  `assertGovernancePolicy`/`assertStaff` gating and add comment/account/realm
  member action gates.
- [x] 1.13 Update `stat/stats.service.ts` and admin stats DTOs to count scoped
  `ModerationCase` rows and recent `ModerationAction` rows instead of
  `RealmModerationQueueItem`/old `StaffAuditLog` moderation entries.

## 2. Comment moderation (`package/server/src/comment/` + governance)

- [x] 2.1 `comment.service.ts` read filter: change `visibilityState: { in:
  ["VISIBLE","TOMBSTONED"] }` to status-aware logic. Flat/list/search-backed
  modes use `WHERE moderationStatus = APPROVED AND deletedAt IS NULL`.
  Threaded/subtree modes first fetch approved descendants, then include removed
  or author-deleted ancestors only when needed to preserve tree structure; those
  ancestors return redacted stubs. `getById` for public surfaces returns 404 or a
  stub based on the route contract, never the original body. `(test)`
- [x] 2.2 `comment.service.ts` `create`: default `moderationStatus = APPROVED`
  (or `PENDING` when the realm pre-moderates — gate on a realm setting if present,
  else always APPROVED).
- [x] 2.3 `comment.service.ts` `delete`: set `deletedAt = now()` (author self-delete)
  instead of `visibilityState=TOMBSTONED`; clear `content` to `Prisma.JsonNull`.
  Keep author-only ownership check.
- [x] 2.4 Add `resolveCommentModerationAuthority(identity, comment)` →
  `PLATFORM | REALM | OWNER | null`: PLATFORM from `capability.service`
  (global moderation capability), REALM when `comment.realmUnitId` matches a realm
  role/capability (`owner`/`admin`/`moderator` or `queue.realm.decide` equivalent),
  OWNER when `comment.rootUnit.userId === identity.userId` or root-unit
  collaborator role is `owner`/`maintainer`. `(test)`
- [x] 2.5 Add `moderateComment({ commentId, actorUserId, action: REMOVE|RESTORE|
  LOCK|UNLOCK, reasonCode, ... })` on `GovernanceModerationService`: resolve
  authority, lock/select the comment row, enforce precedence using
  `latestEffectiveRemoveFor(COMMENT, commentId)` (RESTORE denied if actor
  authority < latest effective REMOVE authority), write
  `Comment.moderationStatus`/`isLocked` + ledger (targetKind=COMMENT) in one tx;
  enqueue comment search sync after commit. `(test)`
- [x] 2.6 `comment.mapper.ts`: map `moderationStatus`; for `REMOVED`/`deletedAt`
  emit a redacted stub with a public label + optional public `removedByAuthority`.
  The stub must omit `content`, author/profile fields, reactions, poll/embed data,
  and reply affordance flags unless a staff-only DTO explicitly requests them.
  Drop `isTombstone` (or derive it locally only during the cutover).
- [x] 2.7 `comment.api.ts`: add `POST /:id/moderation` (requireLogin) →
  `moderateComment`; ensure list/get apply the new filter and document which
  routes return stubs vs 404. Mount stays in `index.ts`.
- [x] 2.8 Update `@rezics/api` comment client/mutations and any optimistic cache
  invalidation so remove/restore/lock updates invalidate comment lists, post
  detail, moderation overlays, and search sync consumers consistently.

## 3. Contract (`package/contract/src/`)

- [ ] 3.1 `realm/governance.ts`: add `moderationStatusSchema` (approved|pending|
  removed), `moderationScopeSchema`, `moderationAuthoritySchema`,
  `moderationTargetKindSchema`, `moderationActionKindSchema`,
  `ModerationActionDTO`, and a `ModerationOverlayDTO` ({ moderationStatus,
  latestAction? }). Update `ModerationCaseDTO` for `scope`/`parentCaseId`.
  Remove `ContentModerationStateDTO`, `ContentModerationStateKind`,
  `ModerationCaseEventDTO`, `RealmModerationQueueItemDTO`,
  `RealmModerationQueueStateSchema`, `RealmModerationDecisionKindSchema`,
  `RealmModerationEventDTO`. Keep `StaffAuditLogDTO` only as a slim
  non-moderation admin log DTO with no `before`/`after`.
- [x] 3.2 `realm/publication.ts`: remove `UnitRealmModerationState` +
  `UnitRealmVisibilityState`; add `moderationStatus` to the realm unit DTO.
- [x] 3.3 `comment/comment.ts`: `CommentDTO` → add `moderationStatus`, optional
  `removedReason`/`removedByAuthority` public label; `content` optional when
  removed/deleted; add a clear `isRedacted`/`redactionKind` field if the UI needs
  to distinguish moderator removal from author deletion. Drop `isTombstone`. Add
  `CommentModerationInput`.
- [x] 3.4 `engagement/feedback.ts`: replace unit-only report addressing with
  polymorphic `targetKind`/`targetId` plus optional `addressedUnitId`; update
  create/list filters and DTOs so targetless feedback, feedback-about-feedback,
  comments, and units are representable without overloading `unitId`.
- [x] 3.5 `permission/*`: add/update capability keys and policy action names for
  comment moderation, account enforcement ledger actions, realm member moderation,
  and scoped case decisions. Contract tests should prove lower-case DTO values map
  to Prisma UPPERCASE enums through the existing `lower()` convention.

## 4. Read paths & search

- [ ] 4.1 Grep every read query that filtered on the old enums
  (`moderationState`, `visibilityState`, `ContentModerationState`) across
  `package/server/src`, `package/search/src`, `package/api`, `package/app`, and
  `package/admin`. Known server targets include post reads/mappers,
  realm feeds/lists, zone/search projections, stats, target semantics tests, and
  comment list/get. Switch public reads to `moderationStatus = APPROVED`
  (+ `Unit.moderationStatus = APPROVED` for the platform tier in realm feeds).
- [x] 4.2 `package/search/src/sync.ts`: replace `contentModerationState`,
  `UnitRealm.moderationState`, `UnitRealm.visibilityState`, and
  `Comment.visibilityState` checks with `moderationStatus`; exclude
  `moderationStatus != APPROVED` and `deletedAt` from unit/post/comment indexed
  documents and from `realmIds` projections. Update `publicSearchableUnitWhere`,
  `isPublicIndexableContentUnit`, `isPublicIndexablePostUnit`,
  `isPublicIndexableComment`, `realmIdsForSearch`, and
  `realmSearchProjectionSelect`. `(test)`
- [x] 4.3 Update search schemas and sync payloads for comments/feedback:
  comment documents carry `moderationStatus` (or omit removed docs entirely);
  feedback sync uses `targetKind`/`targetId`/`addressedUnitId` instead of
  `unitId`. Remove any old `visibilityState`/`unitId` assumptions from
  consumers. `(test)`
- [x] 4.4 Implement the batch overlay read behind `POST /moderation/overlays`
  (1.12 / 1.1): given visible `(targetKind, ids)`, return `{ id,
  moderationStatus, latestAction|null }`. Used only by mod mode.
- [x] 4.5 Update `package/server/src/unit/target-semantics.schema.test.ts` and any
  convention checks that assert the old moderation tables/enums/indexes. The new
  schema test should assert `ModerationAction`, typed targets, `ModerationScope`,
  `Unit/UnitRealm/Comment.moderationStatus`, and the deterministic ledger
  indexes.

## 5. Frontend (`package/api` + `package/app` + `package/admin` + `package/i18n`)

- [ ] 5.1 `@rezics/api/governance/*`: replace `hide/tombstone/approve/reject/remove/
  restore` content mutations with `approve/remove/restore` + `moderateComment` +
  `setLock`; update `governance.queries.ts` for `ModerationActionDTO`/timeline;
  repoint `post.api.ts getModerationOverlays` to the new `ModerationOverlayDTO`.
  Update `@rezics/api/comment` for remove/restore/lock and cache invalidation.
- [x] 5.2 `app/src/post/components/item/PostCard.tsx`: render the
  `moderationStatus` badge (`approved`/`pending`/`removed`) from the snapshot; in mod
  mode render a latest-action detail line from the overlay (`removed by @x · reason`),
  falling back to i18n "auto-approved" when `latestAction` is null. Remove the
  `realmVisibilityState` rendering.
- [x] 5.3 `app/src/realm/components/RealmContentModerationActions.tsx`: collapse the
  menu to Approve / Remove / Restore / Lock (drop Hide + Tombstone); i18n-ize all
  labels; drive visibility of actions off `moderationStatus`.
- [ ] 5.4 New `RemovedContentPlaceholder` component (shared, e.g. under
  `app/src/components/`): renders the redacted-stub i18n placeholder for
  referenced `REMOVED`/`deletedAt` content (distinct labels for moderator-removed
  vs author-deleted). Wire references/embeds/threaded parents to it; ensure
  primary feeds omit instead. The placeholder must not render inside another card
  when the surrounding component is already carded.
- [ ] 5.5 Comment moderation UI: render `RemovedContentPlaceholder` for removed
  comments in threads; add a gated Remove/Restore control for users with authority
  (owner of the post / realm mod / platform mod). Update
  `app/src/post/components/item/PostReply.tsx` so redacted comments suppress
  `PostAuthorHeader`, `PostBodyMarkdown`, `PollEmbed`, `ReactionBar`, reply
  affordances, and any author/profile links.
- [x] 5.6 `package/i18n/locales/en/`: add moderation keys (new `moderation.json`
  or extend `community.json`): status labels, action labels,
  `content_removed_by_moderator`, `content_deleted_by_author`, `auto_approved`,
  decision reason prefix.
- [ ] 5.7 Staff pages (`app/src/staff/`): point `StaffCaseDetailPage`/`StaffAuditPage`
  at the `ModerationAction` timeline (ledger) instead of case/realm events.
- [ ] 5.8 Realm pages (`app/src/realm/sections/RealmModerationQueueSection.tsx`,
  realm content actions, realm filters): remove old queue DTO/state assumptions,
  use scoped cases and `moderationStatus`, and update route/search params from
  free-form target strings to typed contract values.
- [ ] 5.9 Admin governance UI (`package/admin/src/governance/pages/*`) and admin
  stats cards: replace `RealmModerationQueueItemDTO`, old staff-audit moderation
  rows, and old target/status labels with `ModerationCase`,
  `ModerationAction`, and slim `StaffAuditLogDTO` where appropriate.

## 6. Migration, tests & cleanup

- [ ] 6.1 Dev cutover: migrate (reset) + `bun --filter=@rezics/server run
  seed:factory`. Optional best-effort backfill script (snapshot from old enums;
  import old events into `ModerationAction` with `importedFrom`) only if preserving
  dev data; otherwise skip. Update seed reset/delete order for
  `ModerationAction`, `ModerationCase`, `StaffAuditLog`, `AccountEnforcement`,
  feedback, comments, and removed moderation tables before running the seed.
- [ ] 6.2 `knip` + grep to remove all dead references to deleted models/enums/DTOs/
  mutations/components across server, contract, api, app, admin, and search.
  Required patterns include `ContentModerationState`, `RealmModerationQueueItem`,
  `RealmModerationEvent`, `ModerationCaseEvent`, `UnitRealmModerationState`,
  `UnitRealmVisibilityState`, `visibilityState`, `realmVisibilityState`,
  `realmModerationState`, and feedback `unitId` callsites.
- [ ] 6.3 Tests: rewrite `moderation.service.test.ts`, `governance.api.test.ts`,
  `enforcement.service.test.ts`, contract governance/comment/feedback tests,
  search sync tests, target-semantics schema tests, and comment service/mapper
  tests. Add coverage for comment authority + precedence (2.4/2.5),
  snapshot↔ledger atomicity (1.x), deterministic latest-action ordering,
  `REMOVED` redaction never shipping body/author/reactions (2.6/5.5),
  list/feed/search exclusion (4.1/4.2), feedback polymorphic target filters
  (0.7/3.4/4.3), mod overlay auto-approved vs latest action (4.4/5.2), and
  idempotency semantics (1.1). `(test)`
- [ ] 6.4 Validation: `bun --filter=@rezics/server run prisma:generate`,
  `bun run format`, `bun run check:convention`, `bun run check:tokens`,
  `bun run knip`, `bun test`, plus package-level tests/typechecks for
  `@rezics/contract`, `@rezics/search`, `@rezics/api`, `@rezics/app`, and
  `@rezics/admin` where scripts exist.

## Out of scope

- Redesigning the `AccountEnforcement` / `RealmMember` / `StaffGrant` business
  rules. Existing enforcement/member state tables stay; this plan only moves
  their moderation/audit facts into `ModerationAction` and removes any dependency
  on moderation writes in `StaffAuditLog`.
- History-service moderation-timeline projection (`ModerationOutbox` + projected
  tables) — deferred; the ledger is queried in place.
- Per-action stored `tombstone`/silent flag — default is render-by-surface; add
  only if product needs moderators to choose placement (exploration Open Question).
- Two-layer comment state (`platformStatus` + `localStatus`) — default is a single
  field + ledger precedence (exploration Open Question).
- Cryptographic tamper-evidence / hash-chaining of the ledger.
- Building a full standalone comment feature UI beyond the moderation affordances.
