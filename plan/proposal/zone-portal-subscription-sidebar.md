---
title: Zone Portal, Subscription List, and Sidebar Cutover
status: active
created: 2026-06-09
completed:
supersededBy:
tags: [zone, realm, subscription, sidebar, search, feed, onboarding]
---

## Why

Zone needs to become Rezics' typed portal/customization surface, not a thin
template row and not a second authority system. Book library, realm discovery,
popular surfaces, fandom-style wiki portals, event portals, and future media
catalogs should be expressible as realm-owned zones with customizable sections,
theme, navigation, search, feed, and optional zone-framed detail routes.

The current implementation has the right seed of the model (`Unit(type=ZONE)` +
`Zone`) but it is wiki-heavy and sidebar/search/feed integration is fragmented:
book/media/game/realm entries are route-specific, `/z/:slug/search` is
content-only, `ZONE` is not subscribable, and joined realms are loaded directly
for the sidebar. This change turns zones and realms into subscription-list
entries with user ordering/pinning, keeps Home as a fixed app entry, and makes
zone ownership/permissions inherit from realms.

## Durable constraints & decisions

- `(type)` `Zone.ownerRealmUnitId` is required. Zone management permissions are
  checked against that owner realm's capabilities; there is no separate zone ACL
  and no user-owned zone model.
- `(test)` Platform/system zones such as Book, Realms, and Popular are ordinary
  zones owned by the Rezics official realm. They may be unsubscribed and later
  recovered like other subscriptions.
- `(comment)` `Zone.ownerRealmUnitId` is authority/permission ownership only.
  It does not imply realm interaction context for comments, reactions, or
  moderation.
- `(type)` Zone presentation context and interaction context are separate:
  zone-framed detail routes may provide theme/navigation/breadcrumbs, but only
  explicit realm routes create realm comment/reaction/moderation context.
- `(test)` `/z/:zoneSlug/post/:postUnitId` and
  `/z/:zoneSlug/wiki/:wikiUnitId` render with zone presentation and direct
  interaction context; `/r/:realmSlug/post/:postUnitId` or
  `/realm/:realmId/post/:postUnitId` render with realm interaction context.
- `(type)` Zone config is versioned typed config, not unstructured
  `template/styling/wiki` drift. Public customization is typed tokens, images,
  layout, navigation, and section definitions. Arbitrary CSS/JS is only allowed
  through reviewed/trusted theme packages later.
- `(test)` Zone search/feed filters are implicit boundaries on zone pages and
  cannot be removed by user filters. User filters can further narrow results.
- `(type)` `SearchScope` and `FeedQuery` support zone scope. Zone scope is valid
  for zone pages/search/feed; it does not apply to comment list/create APIs.
- `(type)` `Subscription` remains the attention/notification edge. Sidebar/list
  ordering and removal state live in `UserSubscriptionListEntry`, not on
  `Subscription`.
- `(type)` `UserSubscriptionListEntry` is generic subscription-list metadata for
  any subscribable Unit type: `userUnitId`, `subscribedUnitId`,
  denormalized `subscribedType`, `position`, `pinned`, `state`.
- `(type)` `UserSubscriptionListEntry.state` is an enum with `ACTIVE` and
  `REMOVED`; do not use ambiguous boolean names such as `hidden`.
- `(test)` Sidebar reads `ACTIVE` list entries and orders by
  `pinned DESC, position ASC, createdAt ASC`. Pinning changes only `pinned`;
  reordering changes only `position` inside the current pinned/non-pinned group.
- `(test)` Subscribe or unmute/reactivate creates or reactivates the list entry.
  Unsubscribe, realm mute, and realm leave mark the entry `REMOVED`. Reorder and
  pin never create or delete `Subscription`.
- `(test)` Registration completion writes default subscriptions and
  `UserSubscriptionListEntry` rows in deterministic default order after the
  user profile and system shelves are bootstrapped.
- `(comment)` Home is a fixed application entry. It may reuse zone section
  components later, but it is not a `ZONE`, not subscribable, and not represented
  by `UserSubscriptionListEntry`.
- `(test)` Sidebar has no label above Home. Labeled sections start with
  `All Zones` and `All Realms` as their first entries before the user's active
  subscription entries.
- `(test)` Recovery is user-owned: removed entries can be reactivated when the
  target still exists and is subscribable/visible to the user. Recovery is best
  effort and does not guarantee that deleted/private targets can be restored.

## Tasks

## 1. Contracts and storage shape

- [ ] 1.1 Extend `package/contract/src/subscription/channel-registry.ts` with
  `ZONE` channels and matching notification kind registry entries in
  `package/contract/src/notification/kind-registry.ts` as needed for zone
  feed/section/announcement/theme events.
- [ ] 1.2 Add `UserSubscriptionListEntry` contract schemas and DTOs under
  `package/contract/src/subscription/` with `ACTIVE | REMOVED` state,
  `subscribedType`, `position`, `pinned`, list/reorder/pin/recover inputs, and
  type-filtered list query shapes.
- [ ] 1.3 Extend `package/server/src/db/schema/engagement.ts` with
  `UserSubscriptionListEntry`, its state enum, uniqueness on
  `(userUnitId, subscribedUnitId)`, and indexes for
  `(userUnitId, state, subscribedType, pinned, position)` and recovery reads.
- [ ] 1.4 Generate Drizzle migrations with `task db:generate` after schema
  source changes; do not hand-author ordinary migration SQL.
- [ ] 1.5 Update schema export tests in
  `package/server/src/db/schema/schema-exports.test.ts` for the new table and
  enum.
- [ ] 1.6 Extend `package/contract/src/realm/zone.ts` or move zone contracts to
  a first-class `package/contract/src/zone/` module so zone DTO/config includes
  `ownerRealmUnitId`, `configVersion`, typed `pages`, typed `sections`, theme
  token/image/layout config, and optional realm-primary presentation linkage.
- [ ] 1.7 Update `package/server/src/db/schema/zone.ts` with
  `ownerRealmUnitId`, `configVersion`, and the new config fields while keeping
  existing wiki config mappable during development cutover.

## 2. Zone ownership, config, and seeds

- [ ] 2.1 Update `package/server/src/zone/zone.service.ts` create/update
  inputs, validation, repository writes, and DTO hydration for
  `ownerRealmUnitId`, `configVersion`, section config, and theme config.
- [ ] 2.2 Update `package/server/src/zone/zone.api.ts`,
  `package/api/src/zone/zone.api.ts`, and `package/api/src/zone/zone.*.ts`
  types/queries/mutations for owner realm and versioned config.
- [ ] 2.3 Replace admin-only zone create/update checks with owner-realm
  capability checks, using existing governance/realm capability patterns rather
  than creating zone-specific role tables.
- [ ] 2.4 Fix zone slug hydration so `ZoneDTO.slug` is preserved instead of
  mapped to an empty string when reading by slug.
- [ ] 2.5 Add or update seed infrastructure so the Rezics official realm owns
  official zones for Book, Realms, and Popular, with deterministic slugs and
  typed section presets.
- [ ] 2.6 Update `package/server/src/db/factory/zones.ts` away from mock
  template names such as `featured-carousel` toward versioned zone config
  fixtures that exercise content sections, feed sections, and wiki sections.
- [ ] 2.7 Add zone service tests for owner realm validation, lifecycle behavior,
  slug lookup, config version mapping, and invalid section/unit references.

## 3. Subscription list service

- [ ] 3.1 Add a server service module for `UserSubscriptionListEntry` under
  `package/server/src/subscription/` that can activate, mark removed, pin,
  reorder, list active entries, list removed entries, and recover entries.
- [ ] 3.2 Make `package/server/src/subscription/subscription.service.ts`
  coordinate `Subscription` writes with list entry activation/removal for all
  subscribable targets, while preserving existing subscriber counters.
- [ ] 3.3 Update direct realm subscription writes in
  `package/server/src/realm/realm.service.ts` (`joinRealm`, `removeMember`,
  `muteRealm`, `unmuteRealm`) so they use the shared subscription/list-entry
  helper or perform equivalent list-entry writes in the same local transaction.
- [ ] 3.4 Add list-entry endpoints to
  `package/server/src/subscription/subscription.api.ts`: active list by type,
  removed/recovery list by type, pin/unpin, reorder, remove from list, and
  recover.
- [ ] 3.5 Add frontend API modules in `package/api/src/subscription/` for active
  list entries, removed list entries, pin/reorder/remove/recover mutations, and
  cache invalidation keyed by subscribed type.
- [ ] 3.6 Add tests proving subscribe/unsubscribe, realm join/leave, realm
  mute/unmute, pin/unpin, reorder, and recovery keep `Subscription`,
  subscriber counts, and `UserSubscriptionListEntry` consistent.
- [ ] 3.7 Keep recovery best-effort: tests should cover missing target,
  unsubscribable target, and private realm permission failures without requiring
  cross-table rollback of unrelated user state.

## 4. Registration defaults and recovery

- [ ] 4.1 Add a contract or server-owned registry for default registration
  subscriptions and sidebar order, covering official zones and the Rezics
  official realm.
- [ ] 4.2 Extend `package/server/src/user/service/user.service.ts`
  `completeProfileSetup` so after system shelf bootstrap and default realm join
  it also subscribes the user to official zones and creates default
  `UserSubscriptionListEntry` rows in deterministic fractional order.
- [ ] 4.3 Ensure default registration seeding is idempotent for users who repeat
  completion or already have some default subscriptions/list entries.
- [ ] 4.4 Add server tests in `package/server/src/user/service/` covering
  complete-registration default subscriptions, default entry order, and
  idempotency.
- [ ] 4.5 Add a user recovery page route under `package/app/src/routes/_mainLayout/user/me/`
  and corresponding user feature page/components for removed subscriptions.
- [ ] 4.6 Recovery UI must list official removed entries separately from other
  removed entries and provide clear restore failures when the target cannot be
  recovered.

## 5. Sidebar cutover

- [ ] 5.1 Update `package/app/src/core/components/navigation/MainNavigation.tsx`
  so the primary hard-coded Book/Game/Media/Realms entries are replaced by the
  target shape: fixed Home, labeled Zones, and labeled Realms.
- [ ] 5.2 Update `package/app/src/core/layouts/MainLayout.tsx` to query
  `UserSubscriptionListEntry` for `ZONE` and `REALM` entries instead of
  `myRealmsQuery` for sidebar population.
- [ ] 5.3 Keep Home as an unlabeled fixed entry outside subscription data.
- [ ] 5.4 Build the Zones section so its first entry is `All Zones`, followed by
  active `ZONE` list entries ordered by pinned/position/createdAt.
- [ ] 5.5 Build the Realms section so its first entry is `All Realms`, followed
  by active `REALM` list entries ordered by pinned/position/createdAt.
- [ ] 5.6 Extend navigation item types/rendering in
  `package/app/src/core/components/navigation/navigation.ts` and
  `NavigationList.tsx` only as needed for future pin/reorder affordances; keep
  current simple links if drag/drop is deferred.
- [ ] 5.7 Add focused navigation/sidebar tests in
  `package/app/src/core/components/navigation/MainNavigation.test.ts` for Home
  label behavior, All entries, pinned ordering, removed-entry exclusion, and
  authenticated/unauthenticated states.

## 6. Zone pages, sections, and presentation context

- [ ] 6.1 Replace placeholder `DefaultZoneTemplate` and `BookZoneTemplate` paths
  in `package/app/src/zone/templates/` with a typed zone page renderer that
  consumes `zone.pages.home.sections`.
- [ ] 6.2 Add section renderer primitives in `package/app/src/zone/` for latest
  content, popular/ranked content, feed, review stream, shelf carousel, realm
  list, tag/navigation groups, wiki collections, and manual content blocks.
- [ ] 6.3 Reuse existing book/search/feed/list components where practical, but
  host zone-specific query and implicit-filter state in zone models/hooks
  rather than duplicating DTOs in app code.
- [ ] 6.4 Add route files for zone-framed details where needed:
  `/z/$slug/post/$postUnitId`, `/z/$slug/wiki/$wikiUnitId`, and
  `/z/$slug/unit/$unitId`.
- [ ] 6.5 Ensure zone-framed detail routes pass presentation context only. They
  must not pass `realmUnitId` into `PostThreadPage`, comment components,
  reaction scope helpers, or moderation actions.
- [ ] 6.6 Keep explicit realm routes as the only route family that creates realm
  interaction context; realm routes may use a primary zone theme for
  presentation if configured.
- [ ] 6.7 Add app tests/models proving zone-framed links, direct links, and
  realm-context links resolve to different `PageContext`/href shapes.

## 7. Zone search and feed scope

- [ ] 7.1 Extend `package/contract/src/search/scope.ts` with
  `{ kind: "zone"; zoneUnitId: string }`.
- [ ] 7.2 Update `package/app/src/search/models/scope.ts` and header/search
  route resolution so `/z/:slug/search` resolves to zone search scope after
  slug lookup.
- [ ] 7.3 Replace `package/app/src/zone/pages/ZoneSearchPage.tsx` content-only
  search with `FederatedSearchPage` using zone scope and zone implicit filters.
- [ ] 7.4 Update `package/server/src/meili/search/filters.ts` and
  `federated.service.ts` so zone scope applies zone filters across permitted
  content, post, shelf, comment search where appropriate. Comments should only
  be scoped by zone when the zone config explicitly defines direct-content
  search boundaries; zone scope must not map to realm comment partition.
- [ ] 7.5 Extend `package/contract/src/feed/feed.ts` with zone feed scope and
  update `package/server/src/feed/feed.service.ts` to resolve zone source
  config into feed queries/rows.
- [ ] 7.6 Update `package/api/src/feed/` and `package/app/src/feed/` consumers so
  zone feed sections can query `scope: "zone"` with zone implicit filters.
- [ ] 7.7 Add tests for zone search/filter inheritance, unremovable implicit
  filters, zone feed queries, and separation from realm comment/moderation
  context.

## 8. Zone management and theme boundaries

- [ ] 8.1 Add or extend zone management pages under `package/app/src/zone/` and
  routes so realm-authorized managers can edit zone sections, navigation,
  theme tokens/images/layout, and lifecycle.
- [ ] 8.2 Wire zone management permission hints through owner-realm capabilities,
  matching existing `RealmManagePage` and governance patterns.
- [ ] 8.3 Define public theme config as typed tokens and media references only;
  leave arbitrary CSS/JS for a later reviewed `ThemePackage` plan.
- [ ] 8.4 Add UI and server tests proving users without owner-realm capability
  cannot mutate zone config, while allowed realm managers can.

## 9. Cleanup and cutover

- [ ] 9.1 Move book library, realm discovery, and popular sidebar destinations
  to official zone routes where the app links need to expose zone behavior.
- [ ] 9.2 Keep Home as the app route and allow it to reuse zone section
  components without becoming a zone.
- [ ] 9.3 Remove or redirect obsolete sidebar-only assumptions in
  `MainNavigation`, route tests, and i18n strings once zone/realm subscription
  sections are live.
- [ ] 9.4 Run focused contract, server, API, app model, and navigation tests
  covering the new subscription list, zone config, registration defaults,
  sidebar rendering, zone search, and zone feed.
- [ ] 9.5 Run `task check:convention` and `task format:check` after the code
  change lands.

## Out of scope

- Replacing the app Home route with a zone.
- Arbitrary user-authored CSS/JS, reviewed theme marketplace packages, paid
  themes, or theme revenue sharing.
- Full drag-and-drop sidebar implementation if pin/reorder API and model tests
  land first; the UI can start with explicit pin/reorder controls.
- Backward compatibility for old internal zone templates beyond a clear
  development-stage cutover.
- Moving direct Unit identity, comment partitions, reaction scopes, or
  moderation authority into zone context.
