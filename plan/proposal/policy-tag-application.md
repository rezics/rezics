---
title: Policy tag applications
status: completed
created: 2026-06-17
completed: 2026-06-17
supersededBy:
tags: [contract, server, api, app, tag, realm, governance]
---

## Why
The open tag system is intentionally global: ordinary users can apply TAG Units
through `UnitTag` and `TagVote`, and realm pages can still use those same global
tags without creating realm-local tag identities. A small number of tags need a
different path: platform-managed or realm-managed applications such as
notification tags, official curated lists, or realm-maintained rankings. Those
must not slow down or complicate the ordinary tag vote path.

This change adds a sparse policy-tag path. `PolicyTagRule` records that a TAG
Unit is policy-controlled in a global or realm scope and ties management to
governance policy actions. `PolicyTagApplication` records the managed fact that
a policy-controlled tag applies to a Unit. Search/list/picker entry points choose
whether a tag filter uses the ordinary `UnitTag` source or the policy source;
that query-source choice is not stored on the tag itself.

## Durable constraints & decisions
- (type) Ordinary tag behavior remains `UnitTag` + `TagVote`. Policy tags do
  not add fields such as `official` to `TagVote`, do not fork TAG Unit identity,
  and do not change the normal tag hot path.
- (type) `RealmTagApplication` is not the realm-local tag system. Its existing
  contract/schema comments must be corrected so it is not mistaken for
  policy-managed realm tagging.
- (type) `PolicyTagRule` stores policy-control identity for one `(scope,
  tagUnitId)`. It does not store query strategy, render mode, picker mode, or
  whether ordinary `UnitTag` can exist.
- (type) Policy-tag management uses governance actions, not arbitrary
  per-row capability strings. Add policy actions for rule management and
  application management; both resolve to the existing `tag.curate`
  capability through the governance registry.
- (type) `requiredCapability` may appear in DTOs only as read-only effective
  authority derived from governance action definitions. Create/update inputs
  must not allow callers to choose a weaker or unrelated capability.
- (type) `PolicyTagApplication` references `PolicyTagRule` by `ruleId` and
  uses `unique(ruleId, unitId)`. Scope and TAG identity are owned by the rule,
  avoiding nullable composite keys on the application table.
- (test) At most one active policy-tag rule exists for a global tag, and at most
  one active policy-tag rule exists for a `(realmUnitId, tagUnitId)` pair.
- (test) Creating, updating, reordering, and deleting policy-tag applications
  requires the policy-tag application management action in the target scope.
- (test) Ordinary users may still create ordinary `UnitTag` / `TagVote` rows for
  a tag that also has a policy-tag rule. Policy-tag search/list/rendering must
  ignore those ordinary votes only when the caller explicitly selects the policy
  source.
- (type) Tag query source belongs to the calling query/picker configuration:
  `normal` means existing `UnitTag` / `TagVote`; `policy` means
  `PolicyTagApplication`.
- (comment) `Realm.extra.tagTree` remains an ordered picker hint. If it gains a
  `querySource` hint, that hint selects the list/search source for that picker
  node; it does not constrain ordinary tagging.
- (test) Policy-tag list reads can initially resolve Unit ids through the
  database and hydrate existing Unit/content responses. Do not add Meilisearch
  `policyTagKeys` unless policy-tag query volume or result size requires it.
- (type) Tag Unit identity DTOs must be separated from UnitTag application DTOs.
  Tag CRUD and tag detail routes return tag-unit-shaped data, not `UnitTagDTO`.

## 1. Contract Shape
- [x] 1.1 Add `package/contract/src/tag/policy-tag.ts` with
  `policyTagScopeSchema`, `policyTagRuleDTOSchema`,
  `policyTagApplicationDTOSchema`, list responses, path params, and mutation
  bodies.
- [x] 1.2 Add policy-tag rule state values, starting with `active` and
  `archived`, so policy rules can be retired without deleting application
  history during normal operation.
- [x] 1.3 Add `policyTagAuthoritySchema` as read-only DTO data containing the
  rule-management action, application-management action, and derived effective
  capability.
- [x] 1.4 Add policy actions to
  `package/contract/src/permission/action.ts`: rule management and application
  management for policy tags.
- [x] 1.5 Add `tagQuerySourceSchema` and a reusable tag filter shape that can
  express `{ tagUnitId, source?: "normal" | "policy" }`, with `normal` as the
  default when source is absent.
- [x] 1.6 Extend `tagTreeNodeSchema` in
  `package/contract/src/realm/realm-extra.ts` with optional `querySource`, and
  keep the contract text clear that tagTree remains a picker hint.
- [x] 1.7 Add a tag Unit DTO contract separate from `UnitTagDTO`, then update
  tag CRUD/detail/list contracts that currently conflate tag identity with
  scored tag application rows.
- [x] 1.8 Add contract tests for policy-tag scope validation, read-only
  authority shape, rejected arbitrary capability input, tag query-source
  defaults, and tag Unit DTO separation.
- [x] 1.9 Export the new policy-tag contract from
  `package/contract/src/tag/index.ts` and `package/contract/src/index.ts`.

## 2. Governance
- [x] 2.1 Add policy-tag rule/application actions to the governance action
  registry under the existing tag governance family, both requiring
  `tag.curate`.
- [x] 2.2 Confirm whether realm owner/admin/moderator should imply
  `tag.curate`; if product behavior says moderators maintain policy tags by
  default, add the implied realm capability in
  `package/server/src/governance/capability.service.ts`.
- [x] 2.3 Add governance tests proving global `tag.curate`, realm-scoped
  `tag.curate`, ROOT, missing capability, and cross-realm capability behavior
  for policy-tag actions.

## 3. Database Model
- [x] 3.1 Add `PolicyTagRule` and `PolicyTagApplication` to an appropriate
  server schema file, likely `package/server/src/db/schema/tagging.ts` unless
  the implementation extracts a policy-tag schema unit.
- [x] 3.2 Model `PolicyTagRule` with `id`, `scopeKind`, nullable
  `realmUnitId`, `tagUnitId`, `state`, creator/updater user ids, reason, and
  timestamps.
- [x] 3.3 Model `PolicyTagApplication` with `id`, `ruleId`, `unitId`,
  `position`, optional metadata, actor user ids, and timestamps.
- [x] 3.4 Add partial unique indexes for active policy-tag rules:
  global unique by `tagUnitId`, realm unique by `(realmUnitId, tagUnitId)`.
- [x] 3.5 Add `unique(ruleId, unitId)`, ordered list lookup on
  `(ruleId, position, createdAt, unitId)`, and hydration lookup on
  `(unitId, ruleId)` for `PolicyTagApplication`.
- [x] 3.6 Add relations/schema exports for the new tables.
- [x] 3.7 Generate Drizzle migrations from schema changes. Do not hand-author
  ordinary generated migration SQL.

## 4. Server Domain
- [x] 4.1 Add a `package/server/src/policy-tag/` domain with
  `policy-tag.api.ts`, `.service.ts`, `.mapper.ts`, and `.types.ts`.
- [x] 4.2 Implement rule create/read/update/archive operations. Rule writes
  require the policy-tag rule management action in the requested scope.
- [x] 4.3 Implement application upsert/list/patch/delete operations.
  Application writes require the policy-tag application management action for
  the rule scope.
- [x] 4.4 Validate that every `tagUnitId` points to a live `Unit(type=TAG)`.
- [x] 4.5 Keep policy-tag application writes independent from `UnitTag`,
  `TagVote`, `RealmTagApplication`, and `UnitRealm`.
- [x] 4.6 Add list reads for `(scope, tagUnitId)` that return paginated
  `PolicyTagApplicationDTO` rows ordered by `position`, then stable fallback
  columns.
- [x] 4.7 Add per-unit hydration reads so card/detail surfaces can request
  policy applications only when the surface explicitly wants them.
- [x] 4.8 Mount the policy-tag API from `package/server/src/index.ts`.
- [x] 4.9 Add focused server tests for rule uniqueness, rule archive behavior,
  application uniqueness, application ordering, authorization, and separation
  from ordinary tag votes.

## 5. Search and List Integration
- [x] 5.1 Update the relevant list/search contract types to accept tag filters
  with `source?: "normal" | "policy"` where tag filtering is exposed.
- [x] 5.2 Keep `source=normal` routed to existing UnitTag/Meilisearch tag id
  behavior.
- [x] 5.3 Route `source=policy` through DB lookup of `PolicyTagApplication`
  Unit ids, then hydrate through existing list/content flows.
- [x] 5.4 Add tests proving policy-source filters do not read `UnitTag` and
  normal-source filters do not read `PolicyTagApplication`.
- [x] 5.5 Leave Meilisearch `policyTagKeys` out of the implementation unless
  apply-time investigation shows the DB-first path cannot support the target
  list sizes.

## 6. API Package
- [x] 6.1 Add `package/api/src/policy-tag/` with API functions, query keys,
  queries, mutations, and index exports matching the server route names.
- [x] 6.2 Add API tests for rule CRUD, application CRUD, list pagination, and
  URL/query serialization of policy-tag scopes.
- [x] 6.3 Update tag API client typings so tag identity routes return the new
  tag Unit DTO rather than `UnitTagDTO`.
- [x] 6.4 Export policy-tag API helpers from `package/api/src/index.ts`.

## 7. App Management Surfaces
- [x] 7.1 Add a realm tag policy management surface under realm settings or the
  existing realm tag preferences area. It must use tag search/picker UI and
  never ask users to paste raw tag or Unit ids.
- [x] 7.2 Let managers create/archive policy-tag rules for a realm and manage
  ordered `PolicyTagApplication` rows for each rule.
- [x] 7.3 Add global policy-tag management only behind the existing platform
  admin/staff surface, not inside ordinary realm settings.
- [x] 7.4 Update realm tag picker/tagTree editing so a node may choose normal
  or policy query source when configuring list/filter behavior.
- [x] 7.5 Keep feed cards rendering ordinary `UnitTag` chips by default. Policy
  tags render only on surfaces that explicitly request policy applications.
- [x] 7.6 Repair tag page/editor data usage so tag identity display and tag
  application voting data are not conflated.
- [x] 7.7 If tag color/avatar/icon editing is touched in this work, keep native
  SVG support documented as a storage/rendering requirement but do not depend
  on the current Cloudflare media path until that pipeline is verified.

## 8. Cleanup and Naming
- [x] 8.1 Correct misleading `RealmTagApplication` comments in contract and
  schema files so future readers do not confuse it with policy-tag
  applications.
- [x] 8.2 Update imports/exports and schema export tests for new policy-tag
  contracts and tables.
- [x] 8.3 Add or update seed/factory helpers only if tests need policy-tag
  fixtures; do not seed broad default policy tags.

## Out of scope
- Replacing the ordinary global tag vote system.
- Blocking ordinary `UnitTag` / `TagVote` writes for tags that also have a
  policy-tag rule.
- Adding Meilisearch `policyTagKeys` before DB-first policy-tag queries are
  proven insufficient.
- Building or replacing the media upload pipeline required for robust native SVG
  avatar/icon storage.
